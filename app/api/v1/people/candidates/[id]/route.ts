import { type NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";
import { updateCandidateSchema } from "@/lib/people/schemas";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireRole("viewer");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const supabase = await createClient();

  const { data: candidate, error } = await supabase
    .from("vertice_candidates")
    .select(
      "*, resumes:vertice_candidate_resumes(*), applications:vertice_job_applications(*, job:vertice_job_openings(*, company:client_companies(*)))"
    )
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .single();

  if (error || !candidate) {
    return fail("not_found", "Candidato não encontrado.", 404);
  }

  return ok(candidate);
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

  const parsed = updateCandidateSchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", parsed.error.issues[0]?.message || "Dados inválidos", 422);
  }

  const supabase = await createClient();

  const updatePayload: Record<string, unknown> = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };

  if ("current_role" in parsed.data && !("current_job_title" in parsed.data)) {
    updatePayload.current_job_title = parsed.data.current_role;
  }

  const { data: updated, error } = await supabase
    .from("vertice_candidates")
    .update(updatePayload)
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .select()
    .single();

  if (error || !updated) {
    return fail("update_failed", error?.message || "Erro ao atualizar candidato.", 500);
  }

  await audit({
    action: "people.candidate_updated",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "vertice_candidate",
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
    .from("vertice_candidates")
    .delete()
    .eq("id", id)
    .eq("organization_id", authz.org.orgId);

  if (error) {
    return fail("delete_failed", error.message, 500);
  }

  await audit({
    action: "people.candidate_deleted",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "vertice_candidate",
    resourceId: id,
  });

  return ok({ deleted: true, id });
}
