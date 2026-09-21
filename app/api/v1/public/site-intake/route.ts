import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createContactHandler, patchContactHandler } from "@/app/api/v1/contacts/_handler";
import { createLeadHandler } from "@/app/api/v1/leads/_handler";
import { ApiError } from "@/lib/api/types";
import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { canonicalPhoneBR } from "@/lib/channels/phone-variants";
import { env } from "@/lib/env";
import { funilDeEntrada } from "@/lib/leads/nascimento-do-lead";
import { calculateSha256, getOrCreateCandidate, normalizePhone } from "@/lib/people/services";
import { validateResumeFile } from "@/lib/people/file-validation";
import {
  registerCandidateResumeWithServiceRole,
  ResumeRegistrationError,
} from "@/lib/people/resume-registration";
import type { HandlerCtx } from "@/lib/api/handlers/types";
import type { ContactCreate, ContactPatch, CreateLeadInput } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_RESUME_SIZE = 10 * 1024 * 1024;
const SITE_B2B_TAG = "Origem: Site B2B";
const INTAKE_ACTOR = { type: "webhook_source", id: "site-intake" } as const;
const ALLOWED_SERVICES = new Set([
  "Recrutamento & Seleção",
  "Desenvolvimento de Líderes",
  "Pesquisa de Clima Organizacional",
  "Cargos, Salários & Carreiras",
  "Mapeamento Comportamental",
  "Outplacement",
  "Outro",
]);

const empresaSchema = z.object({
  type: z.literal("empresa"),
  nome: z.string().trim().min(2).max(140),
  empresa: z.string().trim().min(2).max(140),
  cargo: z.string().trim().min(2).max(120),
  whatsapp: z.string().trim().min(10).max(30),
  email: z.string().trim().email().max(140),
  servico: z.string().trim().refine((value) => ALLOWED_SERVICES.has(value), "Serviço inválido"),
  porte: z.string().trim().max(100).optional().default(""),
  desafio: z.string().trim().max(2000).optional().default(""),
});

const candidatoSchema = z.object({
  type: z.literal("candidato"),
  nome: z.string().trim().min(2).max(140),
  whatsapp: z.string().trim().min(10).max(30),
  email: z.string().trim().email().max(140),
  cidade_uf: z.string().trim().max(100).optional().default(""),
  area: z.string().trim().min(2).max(140),
  cargo_objetivo: z.string().trim().max(140).optional().default(""),
  linkedin: z.string().trim().max(250).optional().default(""),
  resumo: z.string().trim().max(2000).optional().default(""),
});

type IntakeFields = Record<string, string>;
type IntakeFile = File | null;

class IntakeError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "IntakeError";
  }
}

function corsHeaders(request: NextRequest): Record<string, string> | null {
  const origin = request.headers.get("origin");
  const configured = env.SITE_INTAKE_ALLOWED_ORIGINS
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const allowed = new Set(
    configured.length > 0
      ? configured
      : [
          "https://verticepessoas.com.br",
          "https://www.verticepessoas.com.br",
          "https://verticeconsultoria.vercel.app",
          "http://localhost:3333",
          "http://127.0.0.1:3333",
        ],
  );

  if (origin && !allowed.has(origin)) return null;

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Site-Intake-Secret",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function getRequestId(request: NextRequest): string {
  return request.headers.get("x-request-id") || randomUUID();
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function opaqueIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

function suppliedSecret(request: NextRequest): string {
  const direct = request.headers.get("x-site-intake-secret")?.trim();
  if (direct) return direct;
  const authorization = request.headers.get("authorization")?.trim() || "";
  return authorization.replace(/^Bearer\s+/i, "").trim();
}

function secretsEqual(actual: string, expected: string): boolean {
  if (!actual || !expected) return false;
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return (
    actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
  );
}

function rateHeaders(cors: Record<string, string>, limit: number, count: number) {
  return {
    ...cors,
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(0, limit - count)),
  };
}

function text(value: FormDataEntryValue | unknown): string {
  return typeof value === "string" ? value : "";
}

function isFile(value: FormDataEntryValue | unknown): value is File {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function",
  );
}

function mimeForFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".doc")) return "application/msword";
  return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

async function readIncomingBody(request: NextRequest): Promise<{
  fields: IntakeFields;
  file: IntakeFile;
}> {
  const contentType = request.headers.get("content-type")?.toLowerCase() || "";
  if (contentType.startsWith("multipart/form-data")) {
    const form = await request.formData();
    const fields: IntakeFields = {};
    let file: IntakeFile = null;
    for (const [key, value] of form.entries()) {
      if (key === "curriculo_file" || key === "curriculo" || key === "file") {
        // Navegadores incluem um File vazio quando o input opcional não foi
        // preenchido; isso não deve ser tratado como um currículo inválido.
        if (isFile(value) && value.size > 0 && value.name) file = value;
        continue;
      }
      const stringValue = text(value);
      if (stringValue) fields[key] = stringValue;
    }
    return { fields, file };
  }

  const payload: unknown = await request.json();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new IntakeError("invalid_json", 400, "Corpo da requisição inválido.");
  }

  const fields: IntakeFields = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      fields[key] = String(value);
    }
  }
  return { fields, file: null };
}

function commonFields(fields: IntakeFields): IntakeFields {
  const type = (fields.type || fields.tipo || "").trim().toLowerCase();
  return {
    ...fields,
    type,
    cidade_uf: fields.cidade_uf || fields.cidade || "",
    area: fields.area || fields.area_atuacao || "",
    cargo_objetivo: fields.cargo_objetivo || fields.cargo || "",
    linkedin: fields.linkedin || "",
    resumo: fields.resumo || fields.mensagem || "",
  };
}

function parseCityState(raw: string): { city: string | null; state: string | null } {
  const parts = raw
    .split(/[\/-]/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return { city: raw.trim() || null, state: null };
  return { city: parts[0] || null, state: parts[1]?.toUpperCase().slice(0, 2) || null };
}

function siteMetadata(fields: IntakeFields): Record<string, unknown> {
  return {
    source: fields.source || "site",
    landing_page: fields.landing_page || fields.page_url || null,
    utm_source: fields.utm_source || null,
    utm_medium: fields.utm_medium || null,
    utm_campaign: fields.utm_campaign || null,
    utm_content: fields.utm_content || null,
  };
}

function handlerContext(organizationId: string, requestId: string): HandlerCtx {
  return {
    organization_id: organizationId,
    actor: INTAKE_ACTOR,
    requestId,
  };
}

async function upsertCompany(
  organizationId: string,
  input: z.infer<typeof empresaSchema>,
  requestId: string,
  metadata: Record<string, unknown>,
) {
  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("client_companies")
    .select("*")
    .eq("organization_id", organizationId)
    .ilike("legal_name", input.empresa)
    .limit(1)
    .maybeSingle();
  if (lookupError) throw new IntakeError("database_error", 500, "Não foi possível consultar a empresa.");

  const porteNote = `[Site B2B] Porte da organização: ${input.porte || "não informado"}`;
  const notes = existing?.notes?.includes("[Site B2B]")
    ? existing.notes
    : [existing?.notes?.trim(), porteNote].filter(Boolean).join("\n\n");

  let company = existing;
  let created = false;
  if (existing) {
    const { data, error } = await admin
      .from("client_companies")
      .update({ notes, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error || !data) throw new IntakeError("database_error", 500, "Não foi possível atualizar a empresa.");
    company = data;
  } else {
    const { data, error } = await admin
      .from("client_companies")
      .insert({
        organization_id: organizationId,
        legal_name: input.empresa,
        status: "prospect",
        notes,
      })
      .select("*")
      .single();
    if (error || !data) throw new IntakeError("database_error", 500, "Não foi possível criar a empresa.");
    company = data;
    created = true;
  }

  await audit({
    action: created ? "people.company_created" : "people.company_updated",
    organizationId,
    resourceType: "client_company",
    resourceId: company.id,
    requestId,
    metadata: { ...metadata, source: "site_b2b", created },
  });

  return company;
}

async function upsertCompanyContact(
  organizationId: string,
  companyId: string,
  input: z.infer<typeof empresaSchema>,
  requestId: string,
  metadata: Record<string, unknown>,
) {
  const admin = createAdminClient();
  const phone = normalizePhone(input.whatsapp);
  if (!phone) throw new IntakeError("validation_error", 422, "WhatsApp inválido.");
  const canonicalPhone = canonicalPhoneBR(phone);
  const email = input.email.trim().toLowerCase();

  const byEmail = await admin
    .from("contacts")
    .select("id, tags, is_anonymized")
    .eq("organization_id", organizationId)
    .eq("email_normalized", email)
    .limit(1)
    .maybeSingle();
  if (byEmail.error) throw new IntakeError("database_error", 500, "Não foi possível consultar o contato.");

  let existing = byEmail.data;
  if (!existing) {
    const byPhone = await admin
      .from("contacts")
      .select("id, tags, is_anonymized")
      .eq("organization_id", organizationId)
      .eq("phone_number", canonicalPhone)
      .limit(1)
      .maybeSingle();
    if (byPhone.error) throw new IntakeError("database_error", 500, "Não foi possível consultar o contato.");
    existing = byPhone.data;
  }

  const tags = Array.from(new Set([...(existing?.tags ?? []), SITE_B2B_TAG]));
  const ctx = handlerContext(organizationId, requestId);
  const contactInput = {
    name: input.nome,
    display_name: input.nome,
    email,
    phone_number: canonicalPhone,
    tags,
    source: "site_b2b",
    source_metadata: metadata,
    client_company_id: companyId,
    role_in_company: input.cargo,
    is_primary: true,
  } satisfies ContactCreate;

  if (existing) {
    if (existing.is_anonymized) {
      throw new IntakeError("contact_blocked", 409, "Este contato não pode ser atualizado.");
    }
    const contact = await patchContactHandler(admin, ctx, existing.id, contactInput satisfies ContactPatch);
    return { id: contact.id, created: false };
  }

  const result = await createContactHandler(admin, ctx, contactInput);
  return { id: result.contact.id, created: true };
}

async function handleEmpresa(
  organizationId: string,
  fields: IntakeFields,
  requestId: string,
) {
  const parsed = empresaSchema.safeParse(commonFields(fields));
  if (!parsed.success) {
    throw new IntakeError("validation_error", 422, parsed.error.issues[0]?.message || "Dados inválidos.");
  }

  const metadata = siteMetadata(fields);
  const company = await upsertCompany(organizationId, parsed.data, requestId, metadata);
  const contact = await upsertCompanyContact(organizationId, company.id, parsed.data, requestId, metadata);
  const admin = createAdminClient();
  const destination = await funilDeEntrada(admin, organizationId);
  if ("erro" in destination) {
    throw new IntakeError("crm_not_configured", 503, "O funil comercial padrão não está configurado.");
  }

  const description = [
    `Porte da organização: ${parsed.data.porte || "não informado"}`,
    parsed.data.desafio ? `Desafio informado pelo cliente:\n${parsed.data.desafio}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 2000);

  let lead: Record<string, unknown>;
  try {
    lead = await createLeadHandler(
      admin,
      handlerContext(organizationId, requestId),
      {
        pipeline_id: destination.pipelineId,
        stage_id: destination.stageId,
        title: `[Site] ${parsed.data.empresa} - ${parsed.data.servico}`.slice(0, 200),
        currency: "BRL",
        description,
        client_company_id: company.id,
        contact_id: contact.id,
        tags: [SITE_B2B_TAG],
        source: "site_b2b",
        source_metadata: metadata,
      } satisfies CreateLeadInput & { source_metadata: Record<string, unknown> },
    );
  } catch (error) {
    if (error instanceof ApiError) throw new IntakeError(error.code, error.status, error.message);
    throw error;
  }

  return {
    success: true,
    type: "empresa",
    company_id: company.id,
    contact_id: contact.id,
    deal_id: String(lead.id),
    message: "Solicitação corporativa recebida com sucesso",
  };
}

async function handleCandidato(
  organizationId: string,
  fields: IntakeFields,
  file: IntakeFile,
  requestId: string,
) {
  const parsed = candidatoSchema.safeParse(commonFields(fields));
  if (!parsed.success) {
    throw new IntakeError("validation_error", 422, parsed.error.issues[0]?.message || "Dados inválidos.");
  }

  const phone = normalizePhone(parsed.data.whatsapp);
  if (!phone) throw new IntakeError("validation_error", 422, "WhatsApp inválido.");
  const { city, state } = parseCityState(parsed.data.cidade_uf);
  const admin = createAdminClient();
  const result = await getOrCreateCandidate(admin, organizationId, {
    full_name: parsed.data.nome,
    email: parsed.data.email,
    phone_e164: phone,
    city,
    state,
    area: parsed.data.area,
    current_job_title: parsed.data.cargo_objetivo || null,
    linkedin_url: parsed.data.linkedin || null,
    notes: parsed.data.resumo || null,
    source: "site_talentos",
    status: "active",
  });

  let candidate = result.candidate;
  if (!result.created) {
    const { data: updated, error } = await admin
      .from("vertice_candidates")
      .update({
        city,
        state,
        area: parsed.data.area,
        current_job_title: parsed.data.cargo_objetivo || null,
        linkedin_url: parsed.data.linkedin || null,
        notes: parsed.data.resumo || null,
        source: "site_talentos",
        status: candidate.status === "do_not_contact" ? candidate.status : "active",
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("id", candidate.id)
      .select("*")
      .single();
    if (error || !updated) throw new IntakeError("database_error", 500, "Não foi possível atualizar o candidato.");
    candidate = updated;
  }

  const metadata = siteMetadata(fields);
  await audit({
    action: result.created ? "people.candidate_created" : "people.candidate_updated",
    organizationId,
    resourceType: "vertice_candidate",
    resourceId: candidate.id,
    requestId,
    metadata: { ...metadata, source: "site_talentos", created: result.created },
  });

  let resumeId: string | null = null;
  if (file) {
    if (file.size <= 0 || file.size > MAX_RESUME_SIZE) {
      throw new IntakeError("file_too_large", 413, "O currículo deve ter até 10MB.");
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const validation = validateResumeFile(
      file.name,
      file.type || mimeForFilename(file.name),
      bytes,
    );
    if (!validation.valid) throw new IntakeError("invalid_file", 415, validation.error || "Currículo inválido.");

    try {
      const registered = await registerCandidateResumeWithServiceRole(
        admin,
        {
          organizationId,
          candidateId: candidate.id,
          originalFilename: file.name,
          mimeType: validation.detectedMime || file.type || mimeForFilename(file.name),
          fileSizeBytes: file.size,
          sha256: calculateSha256(bytes),
          bytes,
          sourceType: "site_talentos",
        },
      );
      resumeId = registered.resume.id;
      await audit({
        action: "people.resume_uploaded",
        organizationId,
        resourceType: "vertice_candidate_resume",
        resourceId: resumeId,
        requestId,
        metadata: { ...metadata, source: "site_talentos", candidateId: candidate.id },
      });
    } catch (error) {
      if (error instanceof ResumeRegistrationError) {
        throw new IntakeError(error.code, error.status, "Não foi possível registrar o currículo.");
      }
      throw error;
    }
  }

  return {
    success: true,
    type: "candidato",
    candidate_id: candidate.id,
    resume_id: resumeId,
    message: "Candidato cadastrado com sucesso",
  };
}

export async function OPTIONS(request: NextRequest): Promise<Response> {
  const cors = corsHeaders(request);
  if (!cors) return new NextResponse(null, { status: 403 });
  const response = new NextResponse(null, { status: 204, headers: cors });
  response.headers.set("X-Request-Id", getRequestId(request));
  return response;
}

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId(request);
  const cors = corsHeaders(request);
  if (!cors) return fail("forbidden_origin", "Origem não autorizada.", 403, { requestId });

  const configuredSecret = env.SITE_INTAKE_SHARED_SECRET.trim();
  if (!configuredSecret) {
    return fail("integration_not_configured", "A ingestão pública ainda não está configurada.", 503, {
      requestId,
      headers: cors,
    });
  }
  if (!secretsEqual(suppliedSecret(request), configuredSecret)) {
    return fail("unauthenticated", "Credencial de integração inválida.", 401, {
      requestId,
      headers: cors,
    });
  }

  const organizationId = env.PUBLIC_SITE_ORGANIZATION_ID.trim();
  if (!z.string().uuid().safeParse(organizationId).success) {
    return fail("integration_not_configured", "A organização do site ainda não está configurada.", 503, {
      requestId,
      headers: cors,
    });
  }

  const ipKey = opaqueIp(getClientIp(request));
  const rate = await checkRateLimit(`public-site-intake:${ipKey}`, 30, 60);
  const limitedHeaders = rateHeaders(cors, rate.limit, rate.count);
  if (!rate.allowed) {
    return fail("rate_limited", "Muitas tentativas. Aguarde um minuto e tente novamente.", 429, {
      requestId,
      headers: limitedHeaders,
    });
  }

  try {
    const { fields, file } = await readIncomingBody(request);
    const normalized = commonFields(fields);
    const type = normalized.type;
    const result =
      type === "empresa"
        ? await handleEmpresa(organizationId, fields, requestId)
        : type === "candidato"
          ? await handleCandidato(organizationId, fields, file, requestId)
          : (() => {
              throw new IntakeError("validation_error", 422, "Tipo de cadastro inválido.");
            })();

    return ok(result, { status: 201, requestId, headers: limitedHeaders });
  } catch (error) {
    if (error instanceof IntakeError) {
      return fail(error.code, error.message, error.status, {
        requestId,
        headers: limitedHeaders,
      });
    }
    if (error instanceof ApiError) {
      return fail(error.code, error.message, error.status, {
        requestId,
        headers: limitedHeaders,
      });
    }
    return fail("internal_error", "Não foi possível processar o cadastro.", 500, {
      requestId,
      headers: limitedHeaders,
    });
  }
}
