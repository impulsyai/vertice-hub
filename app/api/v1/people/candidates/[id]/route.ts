import { type NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateCandidateSchema } from "@/lib/people/schemas";
import { phoneLookupVariants } from "@/lib/channels/phone-variants";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authz = await requireRole("viewer");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const supabase = await createClient();

  const { data: candidate, error } = await supabase
    .from("vertice_candidates")
    .select(
      "*, resumes:vertice_candidate_resumes!vertice_candidate_resumes_org_cand_fk(*), applications:vertice_job_applications!vertice_applications_org_cand_fk(*, job:vertice_job_openings!vertice_applications_org_job_fk(*, company:client_companies!vertice_job_openings_org_company_fk(*)))",
    )
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .single();

  if (error || !candidate) {
    return fail("not_found", "Candidato não encontrado.", 404);
  }

  const candidateRow = candidate as { contact_id: string | null; phone_e164: string | null };
  type ContactContext = { id: string; phone_number: string | null };
  let contact: ContactContext | null = null;

  if (candidateRow.contact_id) {
    const { data: linkedContact } = await supabase
      .from("contacts")
      .select("id, phone_number")
      .eq("organization_id", authz.org.orgId)
      .eq("id", candidateRow.contact_id)
      .maybeSingle();
    contact = (linkedContact as ContactContext | null) ?? null;
  }

  if (!contact && candidateRow.phone_e164) {
    const variants = phoneLookupVariants(candidateRow.phone_e164);
    if (variants.length > 0) {
      const { data: phoneContact } = await supabase
        .from("contacts")
        .select("id, phone_number")
        .eq("organization_id", authz.org.orgId)
        .in("phone_number", variants)
        .is("is_merged_into", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      contact = (phoneContact as ContactContext | null) ?? null;
    }
  }

  let conversationId: string | null = null;
  if (contact) {
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("organization_id", authz.org.orgId)
      .eq("contact_id", contact.id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    conversationId = conversation?.id ?? null;
  }

  return ok({
    ...candidate,
    contact_context: contact
      ? {
          contact_id: contact.id,
          phone_number: contact.phone_number,
          conversation_id: conversationId,
        }
      : null,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    .maybeSingle();

  if (error) {
    return fail("update_failed", "Erro ao atualizar candidato.", 500);
  }

  if (!updated) {
    return fail("not_found", "Candidato não encontrado.", 404);
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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const authz = await requireRole("manager");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const supabase = await createClient();

  const { data: resumeRows, error: resumeLookupError } = await supabase
    .from("vertice_candidate_resumes")
    .select("storage_path")
    .eq("candidate_id", id)
    .eq("organization_id", authz.org.orgId);

  if (resumeLookupError) {
    return fail("delete_failed", "Não foi possível preparar a remoção dos currículos.", 500);
  }

  const storagePaths = (resumeRows ?? [])
    .map((row) => row.storage_path)
    .filter((path): path is string => typeof path === "string" && path.length > 0);
  const expectedPrefix = `${authz.org.orgId}/${id}/`;
  const unsafePath = storagePaths.find(
    (path) => !path.startsWith(expectedPrefix) || path.startsWith("/") || path.includes(".."),
  );
  if (unsafePath) {
    logger.error("people.candidate_delete_unsafe_storage_path", {
      organizationId: authz.org.orgId,
      candidateId: id,
    });
    return fail(
      "delete_failed",
      "Foi encontrado um caminho de currículo fora do escopo seguro.",
      500,
    );
  }

  const { data: deletedCandidate, error } = await supabase
    .from("vertice_candidates")
    .delete()
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .select("id")
    .maybeSingle();

  if (error) {
    return fail("delete_failed", error.message, 500);
  }
  if (!deletedCandidate) {
    return fail("not_found", "Candidato não encontrado.", 404);
  }

  let storageCleanup: "none" | "deleted" | "queued" | "failed" = "none";
  if (storagePaths.length > 0) {
    const admin = createAdminClient();
    const { error: removeError } = await admin.storage
      .from("candidate-resumes")
      .remove(storagePaths);

    if (!removeError) {
      storageCleanup = "deleted";
    } else {
      const { error: queueError } = await admin.from("storage_redaction_queue").upsert(
        storagePaths.map((objectPath) => ({
          organization_id: authz.org.orgId,
          request_id: null,
          bucket: "candidate-resumes",
          object_path: objectPath,
          status: "pending",
          attempts: 0,
          processed_at: null,
          error_message: removeError.message,
        })),
        { onConflict: "bucket,object_path" },
      );

      if (queueError) {
        storageCleanup = "failed";
        logger.error("people.candidate_delete_storage_cleanup_failed", {
          organizationId: authz.org.orgId,
          candidateId: id,
          detail: queueError.message,
        });
      } else {
        storageCleanup = "queued";
      }
    }
  }

  await audit({
    action: "people.candidate_deleted",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "vertice_candidate",
    resourceId: id,
    metadata: { storage_cleanup: storageCleanup, resume_count: storagePaths.length },
  });

  return ok({ deleted: true, id, storage_cleanup: storageCleanup });
}
