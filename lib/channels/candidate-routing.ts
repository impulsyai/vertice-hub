/**
 * ROTEAMENTO SEMÂNTICO DE CONTATOS — CANDIDATE ≠ CRM LEAD (Fase 4.4A)
 *
 * ─── A Regra Inviolável do Produto ─────────────────────────────────────────
 *
 * CANDIDATO / TALENTO   = RECRUTAMENTO & SELEÇÃO (R&S)
 * EMPRESA / DECISOR     = CRM COMERCIAL
 *
 * CANDIDATO NUNCA DEVE VIRAR CRM LEAD.
 *
 * ─── Princípio Fail-Closed na Classificação ─────────────────────────────────
 *
 * A mensagem e conversa JÁ estão persistidas na Inbox quando este passo roda.
 * Se ocorrer qualquer falha técnica que impeça provar com segurança que o contato
 * NÃO é um candidato, o sistema assume o estado `indeterminate` e SUPRIME os
 * efeitos comerciais (nascimento de lead, campanhas de venda, cadências de
 * follow-up e agentes de IA de vendas).
 *
 * ─── Semântica dos Estados ──────────────────────────────────────────────────
 *
 * candidate       = Há evidência de Candidate (por contact_id ou phone_e164).
 * company_contact = Candidate descartado sem erro técnico e há vínculo B2B.
 * unknown         = Candidate descartado sem erro técnico e sem vínculo conhecido.
 * indeterminate   = Falha técnica impediu descartar Candidate com segurança (Fail-Closed).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { phoneLookupVariants } from "./phone-variants";
import { logger } from "@/lib/logger";

export type ContactDomainKind =
  | "candidate"
  | "company_contact"
  | "unknown"
  | "indeterminate";

export interface ContactDomainContext {
  kind: ContactDomainKind;
  contactId: string;
  candidateId: string | null;
  /** Indica se o vínculo contact <-> candidate foi estabelecido nesta invocação */
  newlyLinked?: boolean;
  /** Motivo técnico para o estado indeterminado ou fail-safe */
  reason?: string;
}

export interface ResolverContextoParams {
  organizationId: string;
  contactId: string;
}

/**
 * Identifica a natureza semântica do contato dentro da organização.
 * Garante estrito isolamento multi-tenant e classificação Fail-Closed para efeitos comerciais.
 */
export async function resolverContextoDoContato(
  admin: SupabaseClient,
  params: { organizationId: string; contactId: string },
): Promise<ContactDomainContext> {
  const { organizationId, contactId } = params;
  let candidateCheckFailed = false;
  let failureReason: string | undefined;

  try {
    // ─── CASO A: Vínculo explícito já existente por contact_id ───────────────
    const { data: byContact, error: errContact } = await admin
      .from("vertice_candidates")
      .select("id, contact_id, phone_e164")
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)
      .maybeSingle();

    if (errContact) {
      logger.warn("candidate-routing: erro ao buscar candidato por contact_id", {
        organization_id: organizationId,
        contact_id: contactId,
        error: errContact.message.slice(0, 120),
      });
      candidateCheckFailed = true;
      failureReason = "candidate_by_contact_query_error";
    }

    // Se já encontramos evidência positiva de Candidate, retornamos imediatamente
    if (byContact) {
      return {
        kind: "candidate",
        contactId,
        candidateId: byContact.id,
      };
    }

    // ─── CASO B: Reconhecimento por telefone e auto-link seguro ──────────────
    const { data: contact, error: errContactPhone } = await admin
      .from("contacts")
      .select("phone_number")
      .eq("organization_id", organizationId)
      .eq("id", contactId)
      .maybeSingle();

    if (errContactPhone) {
      logger.warn("candidate-routing: erro ao buscar telefone do contato", {
        organization_id: organizationId,
        contact_id: contactId,
        error: errContactPhone.message.slice(0, 120),
      });
      candidateCheckFailed = true;
      failureReason = failureReason ?? "contact_phone_query_error";
    }

    const rawPhone = contact?.phone_number;
    if (!errContactPhone && rawPhone && typeof rawPhone === "string" && rawPhone.trim().length > 0) {
      const variants = phoneLookupVariants(rawPhone);

      if (variants.length > 0) {
        const { data: byPhoneRows, error: errPhone } = await admin
          .from("vertice_candidates")
          .select("id, contact_id, phone_e164")
          .eq("organization_id", organizationId)
          .in("phone_e164", variants);

        if (errPhone) {
          logger.warn("candidate-routing: erro ao buscar candidatos por telefone", {
            organization_id: organizationId,
            contact_id: contactId,
            error: errPhone.message.slice(0, 120),
          });
          candidateCheckFailed = true;
          failureReason = failureReason ?? "candidate_by_phone_query_error";
        } else {
          const candidates = byPhoneRows ?? [];

          // Proteção contra ambiguidade: múltiplos candidatos com variantes do mesmo número
          if (candidates.length > 1) {
            logger.warn("candidate-routing: múltiplos candidatos encontrados para o mesmo número (inconsistência)", {
              organization_id: organizationId,
              contact_id: contactId,
              candidate_count: candidates.length,
            });
            // Fail-safe: há evidência positiva de Candidate. Retorna candidate sem CRM Lead.
            return {
              kind: "candidate",
              contactId,
              candidateId: null,
            };
          }

          if (candidates.length === 1) {
            const candidate = candidates[0]!;

            // Já vinculado a este mesmo contato
            if (candidate.contact_id === contactId) {
              return {
                kind: "candidate",
                contactId,
                candidateId: candidate.id,
              };
            }

            // Se contact_id for null, tenta o auto-link atômico
            if (candidate.contact_id === null) {
              const { data: updated, error: errUpdate } = await admin
                .from("vertice_candidates")
                .update({ contact_id: contactId })
                .eq("organization_id", organizationId)
                .eq("id", candidate.id)
                .is("contact_id", null)
                .select("id, contact_id")
                .maybeSingle();

              if (errUpdate) {
                logger.warn("candidate-routing: erro no auto-link do candidato (permanece candidate)", {
                  organization_id: organizationId,
                  contact_id: contactId,
                  candidate_id: candidate.id,
                  error: errUpdate.message.slice(0, 120),
                });
              }

              if (updated) {
                logger.info("pos-entrada: candidate vinculado ao contact", {
                  organization_id: organizationId,
                  contact_id: contactId,
                  candidate_id: candidate.id,
                });

                return {
                  kind: "candidate",
                  contactId,
                  candidateId: candidate.id,
                  newlyLinked: true,
                };
              }

              // Em caso de corrida concorrente, verifica se outro worker vinculou
              const { data: recheck } = await admin
                .from("vertice_candidates")
                .select("id, contact_id")
                .eq("organization_id", organizationId)
                .eq("id", candidate.id)
                .maybeSingle();

              return {
                kind: "candidate",
                contactId,
                candidateId: candidate.id,
                newlyLinked: recheck?.contact_id === contactId,
              };
            }

            // Candidate já possui outro contact_id vinculado: NÃO sobrescreve, mas reconhece como candidato
            logger.info("candidate-routing: candidato já possui outro contact_id vinculado", {
              organization_id: organizationId,
              contact_id: contactId,
              candidate_id: candidate.id,
            });

            return {
              kind: "candidate",
              contactId,
              candidateId: candidate.id,
            };
          }
        }
      }
    }

    // Se houve qualquer falha técnica na busca de candidatos e não encontramos candidato positivo:
    // Princípio Fail-Closed: NÃO classificar como unknown ou company. Retornar indeterminate!
    if (candidateCheckFailed) {
      return {
        kind: "indeterminate",
        contactId,
        candidateId: null,
        reason: failureReason ?? "candidate_verification_failed",
      };
    }

    // ─── CASO C: Contato de empresa parceira/cliente B2B ────────────────────
    // Só é avaliado após Candidate ser seguramente descartado sem erro técnico.
    const { data: companyContact, error: errCompany } = await admin
      .from("client_company_contacts")
      .select("id, client_company_id")
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)
      .limit(1)
      .maybeSingle();

    if (errCompany) {
      logger.warn("candidate-routing: erro ao checar client_company_contacts", {
        organization_id: organizationId,
        contact_id: contactId,
        error: errCompany.message.slice(0, 120),
      });
    }

    if (companyContact) {
      return {
        kind: "company_contact",
        contactId,
        candidateId: null,
      };
    }

    // ─── CASO D: Contato desconhecido (Unknown) ──────────────────────────────
    // Candidate descartado com sucesso sem erro técnico, sem vínculo B2B.
    return {
      kind: "unknown",
      contactId,
      candidateId: null,
    };
  } catch (err) {
    logger.error("candidate-routing: exceção inesperada ao resolver contexto", {
      organization_id: organizationId,
      contact_id: contactId,
      error: err instanceof Error ? err.message.slice(0, 160) : "desconhecido",
    });

    // Em caso de exceção inesperada geral: FAIL-CLOSED
    return {
      kind: "indeterminate",
      contactId,
      candidateId: null,
      reason: "unexpected_exception",
    };
  }
}
