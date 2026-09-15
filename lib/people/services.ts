import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Candidate } from "./types";

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

export function normalizeLinkedInUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url = raw.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, "");
}

export interface CandidateInput {
  full_name: string;
  email?: string | null;
  phone_e164?: string | null;
  linkedin_url?: string | null;
  city?: string | null;
  state?: string | null;
  current_job_title?: string | null;
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
 * Deduplicação robusta e race-safe de candidatos por e-mail normalizado, telefone E.164 ou contact_id.
 * Em caso de colisão concorrente (23505), recupera o registro vencedor sem explodir a requisição.
 */
export async function getOrCreateCandidate(
  supabase: SupabaseClient,
  organizationId: string,
  input: CandidateInput,
): Promise<{ candidate: Candidate; created: boolean }> {
  const normEmail = input.email ? input.email.trim().toLowerCase() : null;
  const normPhone = input.phone_e164 ? normalizePhone(input.phone_e164) : null;
  const normLinkedIn = normalizeLinkedInUrl(input.linkedin_url);

  // 1. Busca prévia por e-mail normalizado
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

  // 2. Busca prévia por telefone E.164
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

  // 3. Busca prévia por contact_id
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

  // 4. Montagem do payload de criação com current_job_title
  const payload = {
    organization_id: organizationId,
    full_name: input.full_name.trim(),
    email: normEmail,
    phone_e164: normPhone,
    linkedin_url: normLinkedIn,
    city: input.city?.trim() || null,
    state: input.state?.trim() || null,
    current_job_title: (input.current_job_title ?? input.current_role)?.trim() || null,
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

  if (error) {
    // Tratamento de corrida concorrente: unique_violation (23505)
    if (error.code === "23505") {
      if (normEmail) {
        const { data: retryEmail } = await supabase
          .from("vertice_candidates")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("email_normalized", normEmail)
          .maybeSingle();
        if (retryEmail) return { candidate: retryEmail as Candidate, created: false };
      }
      if (normPhone) {
        const { data: retryPhone } = await supabase
          .from("vertice_candidates")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("phone_e164", normPhone)
          .maybeSingle();
        if (retryPhone) return { candidate: retryPhone as Candidate, created: false };
      }
      if (input.contact_id) {
        const { data: retryContact } = await supabase
          .from("vertice_candidates")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("contact_id", input.contact_id)
          .maybeSingle();
        if (retryContact) return { candidate: retryContact as Candidate, created: false };
      }
    }
    throw new Error(`Erro ao criar candidato: ${error.message || "Registro não retornado"}`);
  }

  if (!created) {
    throw new Error("Erro ao criar candidato: registro não retornado.");
  }

  return { candidate: created as Candidate, created: true };
}
