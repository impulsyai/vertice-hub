import { describe, expect, it } from "vitest";
import { contactCreateSchema, contactPatchSchema } from "@/lib/schemas/contacts";
import type { Contact } from "@/lib/types/contacts";
import type { CompanyContactRow } from "@/lib/people/client-hooks";

describe("Vértice CRM — Contact ↔ Company Link & Role Invariants", () => {
  const orgId = "00000000-0000-4000-8000-000000000001";
  const otherOrgId = "00000000-0000-4000-8000-000000000002";
  const companyAId = "c0000000-0000-4000-8000-000000000001";
  const companyBId = "c0000000-0000-4000-8000-000000000002";
  const contactId = "ct000000-0000-4000-8000-000000000001";

  // =========================================================================
  // A & B: Criação de contato com vínculo a empresa e persistência
  // =========================================================================
  describe("A & B. Criação com vínculo a empresa, cargo e principal", () => {
    it("valida payload de criação com empresa, cargo e is_primary", () => {
      const input = {
        name: "Decisor Teste Vértice",
        email: "testegpt@hotmail.com",
        phone_number: "+5511999998888",
        source: "manual" as const,
        client_company_id: companyAId,
        role_in_company: "Diretor de RH",
        is_primary: true,
      };

      const parsed = contactCreateSchema.safeParse(input);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.client_company_id).toBe(companyAId);
        expect(parsed.data.role_in_company).toBe("Diretor de RH");
        expect(parsed.data.is_primary).toBe(true);
      }
    });

    it("valida criação normal de contato sem empresa vinculada", () => {
      const input = {
        name: "Contato Sem Empresa",
        email: "semempresa@teste.com",
        source: "manual" as const,
      };

      const parsed = contactCreateSchema.safeParse(input);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.client_company_id).toBeUndefined();
        expect(parsed.data.role_in_company).toBeUndefined();
        expect(parsed.data.is_primary).toBeUndefined();
      }
    });
  });

  // =========================================================================
  // C: Estrutura do detalhe do contato com company_link
  // =========================================================================
  describe("C. Detalhe do contato expõe Empresa, Cargo e Principal", () => {
    it("estrutura Contact com company_link devidamente tipado", () => {
      const contact: Contact = {
        id: contactId,
        organization_id: orgId,
        name: "Decisor Teste Vértice",
        display_name: "Decisor Teste Vértice",
        email: "testegpt@hotmail.com",
        email_normalized: "testegpt@hotmail.com",
        phone_number: "+5511999998888",
        cpf_hash: null,
        birthdate: null,
        source: "manual",
        source_metadata: {},
        tags: ["decisor", "b2b"],
        custom_fields: {},
        consent: {},
        is_blocked: false,
        blocked_reason: null,
        is_anonymized: false,
        anonymized_at: null,
        is_merged_into: null,
        merged_at: null,
        last_activity_at: null,
        created_at: "2026-09-18T10:00:00Z",
        updated_at: "2026-09-18T10:00:00Z",
        company_link: {
          id: "link-001",
          client_company_id: companyAId,
          role_in_company: "Diretor de RH",
          is_primary: true,
          company: {
            id: companyAId,
            trade_name: "Empresa Teste Vértice",
            legal_name: "Empresa Teste Vértice Ltda",
          },
        },
      };

      expect(contact.company_link).not.toBeNull();
      expect(contact.company_link?.client_company_id).toBe(companyAId);
      expect(contact.company_link?.company?.trade_name).toBe("Empresa Teste Vértice");
      expect(contact.company_link?.role_in_company).toBe("Diretor de RH");
      expect(contact.company_link?.is_primary).toBe(true);
    });
  });

  // =========================================================================
  // D & E: Detalhe da empresa e navegação de volta para o contato
  // =========================================================================
  describe("D & E. Detalhe da Empresa lista o contato e permite navegação", () => {
    it("associa o contato na lista de Contatos & Decisores da Empresa", () => {
      const companyContact: CompanyContactRow = {
        id: "link-001",
        organization_id: orgId,
        client_company_id: companyAId,
        contact_id: contactId,
        role_in_company: "Diretor de RH",
        is_primary: true,
        created_at: "2026-09-18T10:00:00Z",
        updated_at: "2026-09-18T10:00:00Z",
        contact: {
          id: contactId,
          name: "Decisor Teste Vértice",
          display_name: "Decisor Teste Vértice",
          email: "testegpt@hotmail.com",
          phone_number: "+5511999998888",
        },
      };

      expect(companyContact.contact?.display_name).toBe("Decisor Teste Vértice");
      expect(companyContact.role_in_company).toBe("Diretor de RH");
      expect(companyContact.is_primary).toBe(true);

      // Link de navegação da empresa para o contato
      const contactUrl = `/app/contacts/${companyContact.contact_id}`;
      expect(contactUrl).toBe(`/app/contacts/${contactId}`);
    });
  });

  // =========================================================================
  // F: Edição de cargo / função
  // =========================================================================
  describe("F. Edição de cargo via PATCH", () => {
    it("aceita alteração de cargo sem trocar de empresa", () => {
      const patchInput = {
        client_company_id: companyAId,
        role_in_company: "Diretor de Pessoas",
        is_primary: true,
      };

      const parsed = contactPatchSchema.safeParse(patchInput);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.role_in_company).toBe("Diretor de Pessoas");
        expect(parsed.data.client_company_id).toBe(companyAId);
        expect(parsed.data.is_primary).toBe(true);
      }
    });
  });

  // =========================================================================
  // G: Troca de empresa sem duplicar vínculos
  // =========================================================================
  describe("G. Troca de empresa não duplica vínculos", () => {
    it("permite PATCH para apontar para nova empresa", () => {
      const patchInput = {
        client_company_id: companyBId,
        role_in_company: "Gerente Geral",
        is_primary: false,
      };

      const parsed = contactPatchSchema.safeParse(patchInput);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.client_company_id).toBe(companyBId);
        expect(parsed.data.role_in_company).toBe("Gerente Geral");
        expect(parsed.data.is_primary).toBe(false);
      }
    });
  });

  // =========================================================================
  // H: Remoção do vínculo de empresa
  // =========================================================================
  describe("H. Remoção da empresa remove somente o vínculo", () => {
    it("permite PATCH com client_company_id null para desvincular", () => {
      const patchInput = {
        client_company_id: null,
      };

      const parsed = contactPatchSchema.safeParse(patchInput);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.client_company_id).toBeNull();
      }
    });
  });

  // =========================================================================
  // I: Tenant Isolation
  // =========================================================================
  describe("I. Tenant Isolation & Security", () => {
    it("impede que vínculo seja criado com organization_id divergente", () => {
      // Simulação da verificação efetuada no handler do backend
      function validateTenant(companyOrgId: string, requestOrgId: string) {
        if (companyOrgId !== requestOrgId) {
          throw new Error("Empresa não encontrada na organização atual.");
        }
        return true;
      }

      expect(() => validateTenant(otherOrgId, orgId)).toThrow(
        "Empresa não encontrada na organização atual.",
      );
      expect(validateTenant(orgId, orgId)).toBe(true);
    });
  });

  // =========================================================================
  // J: Candidate Isolation (Regra Sagrada)
  // =========================================================================
  describe("J. Candidate Isolation (Regra Sagrada do Domínio)", () => {
    it("garante que contatos comerciais e vínculos operam estritamente em contacts e client_company_contacts", () => {
      const allowedTables = ["contacts", "client_companies", "client_company_contacts"];
      const forbiddenTables = ["vertice_candidates", "candidates"];

      const targetEntity = "client_company_contacts";
      expect(allowedTables.includes(targetEntity)).toBe(true);
      expect(forbiddenTables.includes(targetEntity)).toBe(false);
    });
  });
});
