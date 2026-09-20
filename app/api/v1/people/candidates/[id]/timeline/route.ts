import { type NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const DIRECT_ACTIONS = [
  "people.candidate_created",
  "people.candidate_updated",
  "people.candidate_contact_linked",
] as const;

const RELATED_ACTIONS = [
  "people.resume_uploaded",
  "people.application_created",
  "people.application_stage_changed",
] as const;

interface AuditRow {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authz = await requireRole("viewer");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const supabase = await createClient();
  const { data: candidate } = await supabase
    .from("vertice_candidates")
    .select("id")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();

  if (!candidate) return fail("not_found", "Candidato não encontrado.", 404);

  // O audit log é append-only e tem RLS restritiva para a tela administrativa.
  // A rota já confirmou tenant + papel; a leitura administrativa aqui evita
  // conceder acesso amplo ao audit log para um agente só por causa do dossiê.
  const admin = createAdminClient();
  const [directResult, relatedSnakeResult, relatedCamelResult] = await Promise.all([
    admin
      .from("api_audit_log")
      .select("id, created_at, actor_user_id, action, resource_type, resource_id, metadata")
      .eq("organization_id", authz.org.orgId)
      .eq("resource_type", "vertice_candidate")
      .eq("resource_id", id)
      .in("action", [...DIRECT_ACTIONS])
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("api_audit_log")
      .select("id, created_at, actor_user_id, action, resource_type, resource_id, metadata")
      .eq("organization_id", authz.org.orgId)
      .in("action", [...RELATED_ACTIONS])
      .eq("metadata->>candidate_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("api_audit_log")
      .select("id, created_at, actor_user_id, action, resource_type, resource_id, metadata")
      .eq("organization_id", authz.org.orgId)
      .in("action", [...RELATED_ACTIONS])
      .eq("metadata->>candidateId", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (directResult.error || relatedSnakeResult.error || relatedCamelResult.error) {
    return ok([]);
  }

  const directRows = (directResult.data ?? []) as AuditRow[];
  const relatedRows = [
    ...((relatedSnakeResult.data ?? []) as AuditRow[]),
    ...((relatedCamelResult.data ?? []) as AuditRow[]),
  ];
  const rows = [...directRows, ...relatedRows]
    .filter((row, index, all) => all.findIndex((item) => item.id === row.id) === index)
    .sort((left, right) => right.created_at.localeCompare(left.created_at));

  const actorIds = [...new Set(rows.map((row) => row.actor_user_id).filter(Boolean))] as string[];
  const actorNames = new Map<string, string>();
  await Promise.all(
    actorIds.map(async (actorId) => {
      const { data } = await admin.auth.admin.getUserById(actorId);
      const metadata = asRecord(data.user?.user_metadata);
      const name =
        (typeof metadata.full_name === "string" && metadata.full_name) ||
        (typeof metadata.name === "string" && metadata.name) ||
        data.user?.email?.split("@")[0] ||
        "Usuário";
      actorNames.set(actorId, name);
    }),
  );

  return ok(
    rows.map((row) => ({
      id: row.id,
      created_at: row.created_at,
      actor_user_id: row.actor_user_id,
      actor_name: row.actor_user_id ? (actorNames.get(row.actor_user_id) ?? "Usuário") : "Sistema",
      action: row.action,
      resource_type: row.resource_type,
      resource_id: row.resource_id,
      metadata: asRecord(row.metadata),
    })),
  );
}
