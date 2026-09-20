import { type NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { openSharedContactConversation } from "@/lib/messaging/open-shared-contact-conversation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const authz = await requireRole("agent");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const supabase = await createClient();
  const { data: candidate, error: candidateError } = await supabase
    .from("vertice_candidates")
    .select("id, full_name, contact_id, phone_e164")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();

  if (candidateError) return fail("database_error", candidateError.message, 500);
  if (!candidate) return fail("not_found", "Candidato não encontrado.", 404);
  if (!candidate.contact_id && !candidate.phone_e164) {
    return fail("validation_error", "O candidato não possui telefone ou contato vinculado.", 422);
  }

  try {
    const result = await openSharedContactConversation(createAdminClient(), authz.org.orgId, {
      contact_id: candidate.contact_id ?? undefined,
      phone_number: candidate.phone_e164 ?? undefined,
      name: candidate.full_name,
    });

    if (!candidate.contact_id) {
      const { error: linkError } = await supabase
        .from("vertice_candidates")
        .update({ contact_id: result.contact_id, updated_at: new Date().toISOString() })
        .eq("id", candidate.id)
        .eq("organization_id", authz.org.orgId);
      if (linkError)
        return fail(
          "link_failed",
          "A conversa foi aberta, mas não foi possível vincular o contato ao candidato.",
          500,
        );

      await audit({
        action: "people.candidate_contact_linked",
        actorUserId: authz.user.id,
        organizationId: authz.org.orgId,
        resourceType: "vertice_candidate",
        resourceId: candidate.id,
        metadata: { contact_id: result.contact_id },
      });
    }

    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "open_failed";
    if (message === "session_not_found")
      return fail("not_found", "Sessão de WhatsApp não encontrada.", 404);
    if (message === "contact_not_found") return fail("not_found", "Contato não encontrado.", 404);
    if (message === "invalid_phone") return fail("validation_error", "Telefone inválido.", 422);
    return fail("open_failed", message, 500);
  }
}
