import { type NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";
import { createCompanySchema } from "@/lib/people/schemas";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authz = await requireRole("viewer");
  if (!authz.ok) return authz.response;

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim() || "";
  const status = url.searchParams.get("status")?.trim() || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get("limit") || "25", 10)));
  const offset = (page - 1) * limit;

  const supabase = await createClient();

  let query = supabase
    .from("client_companies")
    .select("*, contacts:client_company_contacts(*), jobs:vertice_job_openings(*)", { count: "exact" })
    .eq("organization_id", authz.org.orgId)
    .order("legal_name", { ascending: true })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`legal_name.ilike.%${search}%,trade_name.ilike.%${search}%,city.ilike.%${search}%,industry.ilike.%${search}%`);
  }
  if (status) {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query;

  if (error) {
    return fail("database_error", error.message, 500);
  }

  const companies = (data || []).map((c: any) => ({
    ...c,
    contacts_count: Array.isArray(c.contacts) ? c.contacts.length : 0,
    open_jobs_count: Array.isArray(c.jobs) ? c.jobs.filter((j: any) => j.status === "open").length : 0,
  }));

  return ok({
    data: companies,
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

  const parsed = createCompanySchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", parsed.error.issues[0]?.message || "Dados inválidos", 422);
  }

  const supabase = await createClient();

  const { data: created, error } = await supabase
    .from("client_companies")
    .insert({
      organization_id: authz.org.orgId,
      ...parsed.data,
      owner_user_id: authz.user.id,
    })
    .select()
    .single();

  if (error || !created) {
    return fail("database_error", error?.message || "Erro ao criar empresa", 500);
  }

  audit({
    action: "people.company_created",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "client_company",
    resourceId: created.id,
    metadata: { legal_name: created.legal_name },
  });

  return ok(created, { status: 201 });
}
