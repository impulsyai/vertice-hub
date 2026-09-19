import { describe, expect, it } from "vitest";
import { createLeadSchema, updateLeadSchema } from "@/lib/schemas/leads";
import { buildCardInput } from "@/lib/kanban/card-state";
import type { Lead } from "@/lib/types/leads";

describe("CRM B2B Oportunidades - Schemas & Card State", () => {
  const validUUID1 = "02ca7a9f-b4c7-4d00-b616-756f97e54b7e";
  const validUUID2 = "4c3e4b68-4461-4a78-aea2-f873444dfdac";
  const pipelineId = "b9f9e577-09d5-47e1-8888-999900001111";
  const stageId = "c8e8d466-18c4-46d0-8888-999900002222";

  it("createLeadSchema valida payload de Oportunidade B2B com empresa, decisor e responsável", () => {
    const payload = {
      pipeline_id: pipelineId,
      stage_id: stageId,
      title: "Projeto Teste Vértice — Diretoria",
      description: "Escopo de R&S executivo",
      client_company_id: validUUID2,
      contact_id: validUUID1,
      owner_user_id: validUUID1,
      value_cents: 500000,
      currency: "BRL",
      expected_close_date: "2026-10-15",
      tags: ["r&s", "hunting"],
      source: "manual",
    };

    const parsed = createLeadSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.client_company_id).toBe(validUUID2);
      expect(parsed.data.contact_id).toBe(validUUID1);
      expect(parsed.data.owner_user_id).toBe(validUUID1);
      expect(parsed.data.value_cents).toBe(500000);
    }
  });

  it("createLeadSchema aceita lead legado sem client_company_id e sem contact_id", () => {
    const payload = {
      pipeline_id: pipelineId,
      stage_id: stageId,
      title: "Lead Legado / Inbound",
    };

    const parsed = createLeadSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.client_company_id).toBeUndefined();
      expect(parsed.data.contact_id).toBeUndefined();
    }
  });

  it("createLeadSchema rejeita client_company_id que não seja UUID", () => {
    const payload = {
      pipeline_id: pipelineId,
      stage_id: stageId,
      title: "Inválido",
      client_company_id: "not-a-uuid",
    };

    const parsed = createLeadSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it("updateLeadSchema aceita atualização de client_company_id e contact_id", () => {
    const patch = {
      client_company_id: validUUID2,
      contact_id: validUUID1,
      value_cents: 850000,
    };

    const parsed = updateLeadSchema.safeParse(patch);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.client_company_id).toBe(validUUID2);
      expect(parsed.data.contact_id).toBe(validUUID1);
    }
  });

  it("buildCardInput extrai corretamente empresa, decisor, cargo e fechamento previsto", () => {
    const lead: Lead = {
      id: "lead-1",
      organization_id: "org-1",
      pipeline_id: pipelineId,
      stage_id: stageId,
      title: "Projeto Teste Vértice",
      description: "Recrutamento",
      status: "open",
      lost_reason: null,
      position_in_stage: 1000,
      value_cents: 500000,
      currency: "BRL",
      owner_user_id: "user-1",
      owner_kind: "user",
      owner_agent_id: null,
      assigned_at: "2026-09-18T10:00:00Z",
      last_activity_at: "2026-09-18T12:00:00Z",
      expected_close_date: "2026-10-30",
      closed_at: null,
      source: "manual",
      source_metadata: {},
      external_id: null,
      custom_fields: {},
      tags: ["b2b"],
      created_at: "2026-09-18T10:00:00Z",
      updated_at: "2026-09-18T10:00:00Z",
      created_by_user_id: "user-1",
      client_company_id: validUUID2,
      company: {
        id: validUUID2,
        trade_name: "Empresa Teste Vértice",
        legal_name: "Empresa Teste Vértice Ltda",
      },
      contact_id: validUUID1,
      contact: {
        id: validUUID1,
        name: "Decisor Teste Vértice 2",
        email: "decisor@vertice.com",
        phone: "+5581999998888",
        role_in_company: "diretor RH",
      },
    };

    const ownerNames = new Map([["user-1", "Mariana Vértice"]]);
    const card = buildCardInput(lead, {
      stageName: "Novo",
      ownerNames,
    });

    expect(card.title).toBe("Projeto Teste Vértice");
    expect(card.companyName).toBe("Empresa Teste Vértice");
    expect(card.contactName).toBe("Decisor Teste Vértice 2");
    expect(card.contactRole).toBe("diretor RH");
    expect(card.expectedCloseDate).toBe("2026-10-30");
    expect(card.owner.name).toBe("Mariana Vértice");
  });

  it("buildCardInput lida graciosamente com lead sem empresa ou sem contato", () => {
    const legacyLead: Lead = {
      id: "lead-2",
      organization_id: "org-1",
      pipeline_id: pipelineId,
      stage_id: stageId,
      title: "Lead Sem Empresa",
      description: null,
      status: "open",
      lost_reason: null,
      position_in_stage: 2000,
      value_cents: null,
      currency: "BRL",
      owner_user_id: null,
      owner_kind: null,
      owner_agent_id: null,
      assigned_at: null,
      last_activity_at: null,
      expected_close_date: null,
      closed_at: null,
      source: "inbound",
      source_metadata: {},
      external_id: null,
      custom_fields: {},
      tags: [],
      created_at: "2026-09-18T10:00:00Z",
      updated_at: "2026-09-18T10:00:00Z",
      created_by_user_id: null,
      client_company_id: null,
      company: null,
      contact_id: null,
      contact: null,
    };

    const card = buildCardInput(legacyLead, {
      stageName: "Novo",
      ownerNames: new Map(),
    });

    expect(card.title).toBe("Lead Sem Empresa");
    expect(card.companyName).toBeNull();
    expect(card.contactName).toBeNull();
    expect(card.contactRole).toBeNull();
    expect(card.expectedCloseDate).toBeNull();
    expect(card.owner.name).toBeNull();
    expect(card.owner.kind).toBeNull();
  });
});
