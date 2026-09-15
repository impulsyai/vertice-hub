import { type NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";
import { createCandidateSchema } from "@/lib/people/schemas";
import { getOrCreateCandidate } from "@/lib/people/services";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authz = await requireRole("viewer");
  if (!authz.ok) return authz.response;

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim() || "";
  const status = url.searchParams.get("status")?.trim() || "";
  const area = url.searchParams.get("area")?.trim() || "";
  const seniority = url.searchParams.get("seniority")?.trim() || "";
  const city = url.searchParams.get("city")?.trim() || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get("limit") || "25", 10)));
  const offset = (page - 1) * limit;

  const supabase = await createClient();

  let query = supabase
    .from("vertice_candidates")
    .select("*, current_resume:vertice_candidate_resumes(*)", { count: "exact" })
    .eq("organization_id", authz.org.orgId)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,current_role.ilike.%${search}%,current_company.ilike.%${search}%`);
  }
  if (status) {
    query = query.eq("status", status);
  }
  if (area) {
    query = query.eq("area", area);
  }
  if (seniority) {
    query = query.eq("seniority", seniority);
  }
  if (city) {
    query = query.ilike("city", `%${city}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    return fail("database_error", error.message, 500);
  }

  // Filtrar apenas o resumo marcado como is_current para cada candidato
  const candidates = (data || []).map((cand: any) => {
    const resumes = Array.isArray(cand.current_resume) ? cand.current_resume : [];
    const activeResume = resumes.find((r: any) => r.is_current) || resumes[0] || null;
    return { ...cand, current_resume: activeResume };
  });

  return ok({
    data: candidates,
    pagination: {
      page,
      limit,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / limit),
    },
  });
}

export async function POST(req: NextRequest) {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const authz = await requireRole("agent");
  if (!authz.ok) return authz.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("invalid_json", "Corpo da requisição inválido.", 400);
  }

  const parsed = createCandidateSchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", parsed.error.issues[0]?.message || "Dados inválidos", 422);
  }

  const supabase = await createClient();

  try {
    const { candidate, created } = await getOrCreateCandidate(
      supabase,
      authz.org.orgId,
      parsed.data,
    );

    audit({
      action: "people.candidate_created",
      actorUserId: authz.user.id,
      organizationId: authz.org.orgId,
      resourceType: "vertice_candidate",
      resourceId: candidate.id,
      metadata: { full_name: candidate.full_name, created },
    });

    return ok(candidate, { status: created ? 201 : 200 });
  } catch (err: any) {
    return fail("creation_failed", err.message || "Erro ao salvar candidato", 500);
  }
}
