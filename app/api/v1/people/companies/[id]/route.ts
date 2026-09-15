import { type NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";
import { updateCompanySchema } from "@/lib/people/schemas";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireRole("viewer");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const supabase = await createClient();

  const { data: company, error } = await supabase
    .from("client_companies")
    .select("*, contacts:client_company_contacts(*, contact:contacts(*)), jobs:vertice_job_openings(*)")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .single();

  if (error || !company) {
    return fail("not_found", "Empresa cliente não encontrada.", 404);
  }

  return ok(company);
}

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

  const parsed = updateCompanySchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", parsed.error.issues[0]?.message || "Dados inválidos", 422);
  }

  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("client_companies")
    .update({
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .select()
    .single();

  if (error || !updated) {
    return fail("update_failed", error?.message || "Erro ao atualizar empresa.", 500);
  }

  await audit({
    action: "people.company_updated",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "client_company",
    resourceId: id,
    metadata: { changes: parsed.data },
  });

  return ok(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const authz = await requireRole("manager");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase
    .from("client_companies")
    .delete()
    .eq("id", id)
    .eq("organization_id", authz.org.orgId);

  if (error) {
    return fail("delete_failed", error.message, 500);
  }

  await audit({
    action: "people.company_deleted",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "client_company",
    resourceId: id,
  });

  return ok({ deleted: true, id });
}
