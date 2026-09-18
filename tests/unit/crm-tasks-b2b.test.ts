import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { ROLE_RANK, type AuthUser, type Role } from "@/lib/auth/types";
import { emitLeadActivity } from "@/lib/leads/activity-emitter";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: vi.fn(async () => null) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/leads/activity-emitter", () => ({
  emitLeadActivity: vi.fn(async () => ({ ok: true })),
}));

const ORG = "22222222-2222-4222-8222-222222222222";
const ANA = "11111111-1111-4111-8111-111111111111";
const LEAD = "44444444-4444-4444-8444-444444444444";
const COMPANY = "66666666-6666-4666-8666-666666666666";
const CONTACT = "77777777-7777-4777-8777-777777777777";
const TAREFA = "55555555-5555-4555-8555-555555555555";

function sessao(papel: Role) {
  const user: AuthUser = {
    id: ANA,
    email: "ana@example.com",
    full_name: "Ana",
    avatar_url: null,
    is_platform_admin: false,
    idioma: "pt-BR" as const,
    organizations: [{ organization_id: ORG, organization_name: "Org", role: papel }],
  };
  vi.mocked(requireRole).mockImplementation(async (min: Role) =>
    ROLE_RANK[papel] >= ROLE_RANK[min]
      ? { ok: true, user, org: { orgId: ORG, name: "Org", role: papel } }
      : { ok: false, response: fail("forbidden_role", `Requer role >= ${min}.`, 403, {}) },
  );
}

describe("CRM Tasks B2B Linking & Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessao("agent");
  });

  it("permite criar tarefa com vínculos B2B (lead, company, contact, assigned_to)", async () => {
    const { POST } = await import("@/app/api/v1/tasks/route");

    const insertedTask = {
      id: TAREFA,
      organization_id: ORG,
      title: "Fazer follow-up com Empresa Teste Vértice",
      description: "Discutir proposta",
      due_date: "2026-09-19T10:00:00Z",
      priority: "medium",
      status: "pending",
      lead_id: LEAD,
      client_company_id: COMPANY,
      contact_id: CONTACT,
      assigned_to: ANA,
      created_by: ANA,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let insertedPayload: Record<string, unknown> | null = null;

    const mockSupabase = {
      from: vi.fn((table: string) => {
        const query: Record<string, unknown> = {};
        query.select = vi.fn(() => query);
        query.eq = vi.fn(() => query);
        query.insert = vi.fn((payload: Record<string, unknown>) => {
          insertedPayload = payload;
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: insertedTask, error: null })),
            })),
          };
        });
        return query;
      }),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const req = new NextRequest("http://localhost/api/v1/tasks", {
      method: "POST",
      body: JSON.stringify({
        title: "Fazer follow-up com Empresa Teste Vértice",
        description: "Discutir proposta",
        due_date: "2026-09-19T10:00:00Z",
        priority: "medium",
        status: "pending",
        lead_id: LEAD,
        client_company_id: COMPANY,
        contact_id: CONTACT,
        assigned_to: ANA,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.task.id).toBe(TAREFA);
    expect(body.data.task.client_company_id).toBe(COMPANY);
    expect(body.data.task.contact_id).toBe(CONTACT);
    expect(body.data.task.lead_id).toBe(LEAD);
    expect(body.data.task.assigned_to).toBe(ANA);

    expect(insertedPayload).toMatchObject({
      organization_id: ORG,
      title: "Fazer follow-up com Empresa Teste Vértice",
      lead_id: LEAD,
      client_company_id: COMPANY,
      contact_id: CONTACT,
      assigned_to: ANA,
    });

    // Emite atividade na timeline do lead
    expect(emitLeadActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        leadId: LEAD,
        type: "task_created",
        reason: "Fazer follow-up com Empresa Teste Vértice",
        payload: expect.objectContaining({
          due_date: "2026-09-19T10:00:00Z",
          priority: "medium",
          status: "pending",
        }),
      }),
    );
  });

  it("recusa com 422 caso o vínculo de empresa/contato seja de outra organização (FK 23503)", async () => {
    const { POST } = await import("@/app/api/v1/tasks/route");

    const mockSupabase = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: null,
              error: { code: "23503", message: "foreign_key_violation" },
            })),
          })),
        })),
      })),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const req = new NextRequest("http://localhost/api/v1/tasks", {
      method: "POST",
      body: JSON.stringify({
        title: "Tarefa Invasora",
        client_company_id: COMPANY,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("validation_failed");
  });

  it("herda client_company_id e contact_id do lead se não fornecidos explicitamente", async () => {
    const { POST } = await import("@/app/api/v1/tasks/route");

    let insertedPayload: Record<string, unknown> | null = null;

    const mockSupabase = {
      from: vi.fn((table: string) => {
        const query: Record<string, unknown> = {};
        query.select = vi.fn(() => query);
        query.eq = vi.fn(() => query);
        query.maybeSingle = vi.fn(async () => {
          if (table === "crm_leads") {
            return {
              data: {
                client_company_id: COMPANY,
                contact_id: CONTACT,
              },
              error: null,
            };
          }
          return { data: null, error: null };
        });
        query.insert = vi.fn((payload: Record<string, unknown>) => {
          insertedPayload = payload;
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: TAREFA,
                  organization_id: ORG,
                  title: "Tarefa automática",
                  lead_id: LEAD,
                  client_company_id: COMPANY,
                  contact_id: CONTACT,
                  created_by: ANA,
                },
                error: null,
              })),
            })),
          };
        });
        return query;
      }),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const req = new NextRequest("http://localhost/api/v1/tasks", {
      method: "POST",
      body: JSON.stringify({
        title: "Tarefa automática",
        lead_id: LEAD,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(insertedPayload).toMatchObject({
      lead_id: LEAD,
      client_company_id: COMPANY,
      contact_id: CONTACT,
    });
  });
});
