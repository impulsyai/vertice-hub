import { type NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";
import { updateApplicationStageSchema } from "@/lib/people/schemas";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const authz = await requireRole("agent");
  if (!authz.ok) return authz.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("invalid_json", "JSON inválido.", 400);
  }

  const parsed = updateApplicationStageSchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", parsed.error.issues[0]?.message || "Dados inválidos", 422);
  }

  const supabase = await createClient();

  // Validar se a candidatura pertence à organização (identidade candidate_id e job_opening_id imutáveis)
  const { data: currentApp } = await supabase
    .from("vertice_job_applications")
    .select("id, stage, candidate_id, job_opening_id")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();

  if (!currentApp) {
    return fail("not_found", "Candidatura não encontrada.", 404);
  }

  const { data: updated, error } = await supabase
    .from("vertice_job_applications")
    .update({
      stage: parsed.data.stage,
      rejection_reason: parsed.data.rejection_reason ?? null,
      notes: parsed.data.notes ?? undefined,
      stage_changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .select("*, candidate:vertice_candidates(*), job:vertice_job_openings(*)")
    .single();

  if (error || !updated) {
    return fail("update_failed", error?.message || "Erro ao atualizar estágio.", 500);
  }

  await audit({
    action: "people.application_stage_changed",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "vertice_job_application",
    resourceId: id,
    metadata: {
      old_stage: currentApp.stage,
      new_stage: parsed.data.stage,
      candidate_id: currentApp.candidate_id,
      job_id: currentApp.job_opening_id,
    },
  });

  return ok(updated);
}
