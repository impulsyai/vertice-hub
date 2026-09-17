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
 * ─── Mecânica de Reconhecimento & Auto-Link ─────────────────────────────────
 *
 * Quando uma mensagem inbound entra pelo canal (WhatsApp/WAHA, Meta, Zernio),
 * o contato já existe na tabela `contacts`. Este serviço resolve a semântica:
 *
 * 1. CASO A — Vínculo Direto:
 *    Existe `vertice_candidates` com `contact_id = contacts.id` na mesma org.
 *
 * 2. CASO B — Reconhecimento por Telefone & Auto-Link Seguro:
 *    Existe `vertice_candidates` com `phone_e164` correspondente a alguma das
 *    variantes canônicas de `contacts.phone_number` (`phoneLookupVariants`).
 *    - Se o candidate tiver `contact_id IS NULL`, vincula atomicamente (`is("contact_id", null)`).
 *    - Race-safe: em caso de disputa concorrente, a constraint única e a cláusula
 *      garantem que nenhum vínculo seja corrompido nem sobrescrito.
 *    - Ambiguidade segura: se mais de um candidate casar as variantes do número,
 *      registra alerta e suprime o lead comercial (fail-safe defensivo).
 *
 * 3. CASO C — Contato de Empresa (B2B):
 *    Existe vínculo em `client_company_contacts`. Mantém fluxo comercial.
 *
 * 4. CASO D — Desconhecido (Unknown):
 *    Não casa nenhum registro anterior. Preserva o fluxo padrão atual.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { phoneLookupVariants } from "./phone-variants";
import { logger } from "@/lib/logger";

export type ContactDomainKind = "candidate" | "company_contact" | "unknown";

export interface ContactDomainContext {
  kind: ContactDomainKind;
  contactId: string;
  candidateId: string | null;
  /** Indica se o vínculo contact <-> candidate foi estabelecido nesta invocação */
  newlyLinked?: boolean;
}

export interface ResolverContextoParams {
  organizationId: string;
  contactId: string;
}

/**
 * Identifica a natureza semântica do contato dentro da organização.
 * Garante estrito isolamento multi-tenant (todas as consultas filtram por organization_id).
 */
export async function resolverContextoDoContato(
  admin: SupabaseClient,
  params: { organizationId: string; contactId: string },
): Promise<ContactDomainContext> {
  const { organizationId, contactId } = params;

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
    }

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
    }

    const rawPhone = contact?.phone_number;
    if (rawPhone && typeof rawPhone === "string" && rawPhone.trim().length > 0) {
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
        }

        const candidates = byPhoneRows ?? [];

        // Proteção contra ambiguidade: múltiplos candidatos com variantes do mesmo número
        if (candidates.length > 1) {
          logger.warn("candidate-routing: múltiplos candidatos encontrados para o mesmo número (inconsistência)", {
            organization_id: organizationId,
            contact_id: contactId,
            candidate_count: candidates.length,
          });
          // Fail-safe: há evidência clara de que é candidato. Suprime criação de lead.
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

          // Se contact_id for null, realiza o auto-link atômico
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
              logger.warn("candidate-routing: erro no auto-link do candidato", {
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

    // ─── CASO C: Contato de empresa parceira/cliente B2B ────────────────────
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

    // Em caso de falha catastrófica inesperada, preserva comportamento padrão como fallback
    return {
      kind: "unknown",
      contactId,
      candidateId: null,
    };
  }
}
