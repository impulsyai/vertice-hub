import { type NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";
import { updateJobSchema } from "@/lib/people/schemas";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireRole("viewer");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const supabase = await createClient();

  const { data: job, error } = await supabase
    .from("vertice_job_openings")
    .select("*, company:client_companies(*), applications:vertice_job_applications(*, candidate:vertice_candidates(*), resume:vertice_candidate_resumes(*))")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .single();

  if (error || !job) {
    return fail("not_found", "Vaga não encontrada.", 404);
  }

  return ok(job);
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

  const parsed = updateJobSchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", parsed.error.issues[0]?.message || "Dados inválidos", 422);
  }

  const supabase = await createClient();

  // Tratamento de closed_at e opened_at com Record<string, unknown> (sem any)
  const payload: Record<string, unknown> = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.status === "closed" || parsed.data.status === "cancelled") {
    payload.closed_at = new Date().toISOString();
  } else if (parsed.data.status === "open") {
    payload.closed_at = null;
  }

  const { data: updated, error } = await supabase
    .from("vertice_job_openings")
    .update(payload)
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .select()
    .single();

  if (error || !updated) {
    return fail("update_failed", error?.message || "Erro ao atualizar vaga.", 500);
  }

  await audit({
    action: "people.job_updated",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "vertice_job_opening",
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
    .from("vertice_job_openings")
    .delete()
    .eq("id", id)
    .eq("organization_id", authz.org.orgId);

  if (error) {
    return fail("delete_failed", error.message, 500);
  }

  await audit({
    action: "people.job_deleted",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "vertice_job_opening",
    resourceId: id,
  });

  return ok({ deleted: true, id });
}
