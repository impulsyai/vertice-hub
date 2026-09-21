import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: {
    PUBLIC_SITE_ORGANIZATION_ID: "11111111-1111-4111-8111-111111111111",
    SITE_INTAKE_SHARED_SECRET: "site-secret",
    SITE_INTAKE_ALLOWED_ORIGINS: "https://verticepessoas.com.br",
  },
  getOrCreateCandidate: vi.fn(),
  audit: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: mocks.env }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));
vi.mock("@/lib/ai/dispatcher/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));
vi.mock("@/lib/audit", () => ({ audit: mocks.audit }));
vi.mock("@/lib/people/services", () => ({
  calculateSha256: vi.fn(),
  getOrCreateCandidate: mocks.getOrCreateCandidate,
  normalizePhone: vi.fn(() => "+5581999999999"),
}));
vi.mock("@/lib/people/file-validation", () => ({
  validateResumeFile: vi.fn(),
}));
vi.mock("@/lib/people/resume-registration", () => ({
  registerCandidateResumeWithServiceRole: vi.fn(),
  registerCandidateResume: vi.fn(),
  ResumeRegistrationError: class ResumeRegistrationError extends Error {},
}));
vi.mock("@/lib/channels/phone-variants", () => ({
  canonicalPhoneBR: vi.fn((phone: string) => phone),
}));
vi.mock("@/app/api/v1/contacts/_handler", () => ({
  createContactHandler: vi.fn(),
  patchContactHandler: vi.fn(),
}));
vi.mock("@/app/api/v1/leads/_handler", () => ({
  createLeadHandler: vi.fn(),
}));
vi.mock("@/lib/leads/nascimento-do-lead", () => ({
  funilDeEntrada: vi.fn(),
}));

import { POST } from "@/app/api/v1/public/site-intake/route";

function request(body: Record<string, string>, secret = "site-secret", origin = "https://verticepessoas.com.br") {
  return new NextRequest("http://localhost/api/v1/public/site-intake", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      "x-site-intake-secret": secret,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/public/site-intake", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, count: 1, limit: 30 });
    mocks.getOrCreateCandidate.mockResolvedValue({
      created: true,
      candidate: {
        id: "22222222-2222-4222-8222-222222222222",
        status: "active",
      },
    });
  });

  it("persiste o candidato no tenant configurado e retorna o id", async () => {
    const response = await POST(
      request({
        type: "candidato",
        nome: "Candidata de Integração",
        whatsapp: "(81) 99999-9999",
        email: "candidata.integracao@example.com",
        cidade_uf: "Recife / PE",
        area: "Recursos Humanos",
        cargo_objetivo: "Analista de Pessoas",
        linkedin: "linkedin.com/in/candidata-integracao",
        resumo: "Payload de teste do site institucional.",
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      data: {
        success: true,
        type: "candidato",
        candidate_id: "22222222-2222-4222-8222-222222222222",
      },
    });
    expect(mocks.getOrCreateCandidate).toHaveBeenCalledWith(
      expect.anything(),
      mocks.env.PUBLIC_SITE_ORGANIZATION_ID,
      expect.objectContaining({
        city: "Recife",
        state: "PE",
        source: "site_talentos",
        phone_e164: "+5581999999999",
      }),
    );
  });

  it("recusa a chamada sem o segredo server-to-server", async () => {
    const response = await POST(
      request(
        {
          type: "candidato",
          nome: "Sem Credencial",
          whatsapp: "81999999999",
          email: "sem.credencial@example.com",
          area: "Recursos Humanos",
        },
        "wrong-secret",
      ),
    );

    expect(response.status).toBe(401);
    expect(mocks.getOrCreateCandidate).not.toHaveBeenCalled();
  });

  it("recusa origens fora da lista permitida", async () => {
    const response = await POST(
      request(
        {
          type: "candidato",
          nome: "Origem Desconhecida",
          whatsapp: "81999999999",
          email: "origem@example.com",
          area: "Recursos Humanos",
        },
        "site-secret",
        "https://origem-nao-autorizada.example",
      ),
    );

    expect(response.status).toBe(403);
    expect(mocks.getOrCreateCandidate).not.toHaveBeenCalled();
  });
});
