import { type NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";
import { createJobSchema } from "@/lib/people/schemas";
import type { JobOpening } from "@/lib/people/types";

export const dynamic = "force-dynamic";

interface JobDbRow extends JobOpening {
  applications?: Array<{ id: string; stage: string }>;
}

export async function GET(req: NextRequest) {
  const authz = await requireRole("viewer");
  if (!authz.ok) return authz.response;

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim() || "";
  const status = url.searchParams.get("status")?.trim() || "";
  const companyId = url.searchParams.get("company_id")?.trim() || "";
  const recruiterId = url.searchParams.get("recruiter_id")?.trim() || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get("limit") || "25", 10)));
  const offset = (page - 1) * limit;

  const supabase = await createClient();

  let query = supabase
    .from("vertice_job_openings")
    .select("*, company:client_companies(*), applications:vertice_job_applications(id, stage)", { count: "exact" })
    .eq("organization_id", authz.org.orgId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`title.ilike.%${search}%,department.ilike.%${search}%,city.ilike.%${search}%`);
  }
  if (status) {
    query = query.eq("status", status);
  }
  if (companyId) {
    query = query.eq("client_company_id", companyId);
  }
  if (recruiterId) {
    query = query.eq("recruiter_id", recruiterId);
  }

  const { data, error, count } = await query;

  if (error) {
    return fail("database_error", error.message, 500);
  }

  const rows = (data || []) as unknown as JobDbRow[];

  const jobs = rows.map((j) => {
    const apps = Array.isArray(j.applications) ? j.applications : [];
    return {
      ...j,
      applications_count: apps.length,
      shortlist_count: apps.filter(
        (a) =>
          a.stage === "shortlist" ||
          a.stage === "client_interview" ||
          a.stage === "finalist" ||
          a.stage === "approved"
      ).length,
    };
  });

  return ok({
    data: jobs,
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
    return fail("invalid_json", "JSON inválido.", 400);
  }

  const parsed = createJobSchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", parsed.error.issues[0]?.message || "Dados inválidos", 422);
  }

  const supabase = await createClient();

  // Validar se a empresa pertence à organização (mesmo tenant)
  const { data: company } = await supabase
    .from("client_companies")
    .select("id")
    .eq("id", parsed.data.client_company_id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();

  if (!company) {
    return fail("company_not_found", "Empresa cliente não encontrada na organização.", 404);
  }

  const { data: created, error } = await supabase
    .from("vertice_job_openings")
    .insert({
      organization_id: authz.org.orgId,
      ...parsed.data,
      recruiter_id: parsed.data.recruiter_id || authz.user.id,
      opened_at: parsed.data.status === "open" ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error || !created) {
    return fail("database_error", error?.message || "Erro ao criar vaga", 500);
  }

  await audit({
    action: "people.job_created",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "vertice_job_opening",
    resourceId: created.id,
    metadata: { title: created.title, company_id: created.client_company_id },
  });

  return ok(created, { status: 201 });
}
