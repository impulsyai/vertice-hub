import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Candidate, CandidateResume } from "./types";

export function calculateSha256(buffer: Buffer | Uint8Array): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return `+${digits}`;
}

export interface CandidateInput {
  full_name: string;
  email?: string | null;
  phone_e164?: string | null;
  linkedin_url?: string | null;
  city?: string | null;
  state?: string | null;
  current_role?: string | null;
  current_company?: string | null;
  area?: string | null;
  seniority?: string | null;
  expected_salary?: number | null;
  availability?: string | null;
  status?: string;
  source?: string;
  contact_id?: string | null;
  owner_user_id?: string | null;
  notes?: string | null;
}

/**
 * Deduplicação robusta de candidatos por e-mail normalizado, telefone E.164 ou contact_id.
 * Impede duplicação óbvia de registros no banco.
 */
export async function getOrCreateCandidate(
  supabase: SupabaseClient,
  organizationId: string,
  input: CandidateInput,
): Promise<{ candidate: Candidate; created: boolean }> {
  const normEmail = input.email ? input.email.trim().toLowerCase() : null;
  const normPhone = input.phone_e164 ? normalizePhone(input.phone_e164) : null;

  // 1. Busca por e-mail normalizado
  if (normEmail) {
    const { data: byEmail } = await supabase
      .from("vertice_candidates")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("email_normalized", normEmail)
      .maybeSingle();

    if (byEmail) {
      return { candidate: byEmail as Candidate, created: false };
    }
  }

  // 2. Busca por telefone E.164
  if (normPhone) {
    const { data: byPhone } = await supabase
      .from("vertice_candidates")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("phone_e164", normPhone)
      .maybeSingle();

    if (byPhone) {
      return { candidate: byPhone as Candidate, created: false };
    }
  }

  // 3. Busca por contact_id
  if (input.contact_id) {
    const { data: byContact } = await supabase
      .from("vertice_candidates")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("contact_id", input.contact_id)
      .maybeSingle();

    if (byContact) {
      return { candidate: byContact as Candidate, created: false };
    }
  }

  // 4. Criação do novo candidato
  const payload = {
    organization_id: organizationId,
    full_name: input.full_name.trim(),
    email: normEmail,
    phone_e164: normPhone,
    linkedin_url: input.linkedin_url?.trim() || null,
    city: input.city?.trim() || null,
    state: input.state?.trim() || null,
    current_role: input.current_role?.trim() || null,
    current_company: input.current_company?.trim() || null,
    area: input.area?.trim() || null,
    seniority: input.seniority?.trim() || null,
    expected_salary: input.expected_salary || null,
    availability: input.availability?.trim() || null,
    status: input.status || "active",
    source: input.source || "manual",
    contact_id: input.contact_id || null,
    owner_user_id: input.owner_user_id || null,
    notes: input.notes?.trim() || null,
  };

  const { data: created, error } = await supabase
    .from("vertice_candidates")
    .insert(payload)
    .select("*")
    .single();

  if (error || !created) {
    throw new Error(`Erro ao criar candidato: ${error?.message || "Registro não retornado"}`);
  }

  return { candidate: created as Candidate, created: true };
}
