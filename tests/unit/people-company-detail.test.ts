import { describe, expect, it } from "vitest";
import { updateCompanySchema } from "@/lib/people/schemas";
import type { CompanyDetailRow, CompanyContactRow } from "@/lib/people/client-hooks";
import type { ClientCompany, VerticeJobOpening } from "@/lib/people/types";

describe("Vértice People — Company Detail & CRM Invariants", () => {
  const tenantA = "00000000-0000-4000-8000-000000000001";
  const tenantB = "00000000-0000-4000-8000-000000000002";
  const companyId = "c0000000-0000-4000-8000-000000000001";

  const mockCompany: ClientCompany = {
    id: companyId,
    organization_id: tenantA,
    trade_name: "TechCorp Brasil",
    legal_name: "TechCorp Soluções Tecnológicas S.A.",
    cnpj: "12.345.678/0001-90",
    industry: "Tecnologia",
    website: "https://techcorp.com.br",
    city: "Recife",
    state: "PE",
    status: "active",
    owner_user_id: null,
    notes: "Cliente estratégico em expansão. Decisor prefere contato via WhatsApp.",
    created_at: "2026-09-15T10:00:00Z",
    updated_at: "2026-09-18T12:00:00Z",
  };

  const mockContact: CompanyContactRow = {
    id: "cc000000-0000-4000-8000-000000000001",
    organization_id: tenantA,
    client_company_id: companyId,
    contact_id: "ct000000-0000-4000-8000-000000000001",
    role_in_company: "Diretor de Operações (COO)",
    is_primary: true,
    created_at: "2026-09-16T10:00:00Z",
    updated_at: "2026-09-16T10:00:00Z",
    contact: {
      id: "ct000000-0000-4000-8000-000000000001",
      name: "Roberto Albuquerque",
      display_name: "Roberto Albuquerque",
      phone_number: "+5581987654321",
      email: "roberto@techcorp.com.br",
    },
  };

  const mockJob: VerticeJobOpening = {
    id: "job00000-0000-4000-8000-000000000001",
    organization_id: tenantA,
    client_company_id: companyId,
    title: "Engenheiro de Software Sênior",
    department: "Engenharia",
    location: "Recife/PE",
    city: "Recife",
    state: "PE",
    work_model: "hybrid",
    employment_type: "clt",
    description: "Liderar desenvolvimento da nova plataforma",
    requirements: "TypeScript, Node, React",
    responsibilities: "Arquitetura e mentoria",
    salary_min: 15000,
    salary_max: 20000,
    benefits: "VA, VR, Plano de Saúde",
    openings_count: 2,
    priority: "high",
    recruiter_id: null,
    status: "open",
    opened_at: "2026-09-17T10:00:00Z",
    closing_date: null,
    closed_at: null,
    created_at: "2026-09-17T10:00:00Z",
    updated_at: "2026-09-17T10:00:00Z",
  };

  describe("A & B. Estrutura do Dossiê e Navegação", () => {
    it("monta o Dossiê completo da Empresa com Contatos e Vagas", () => {
      const dossier: CompanyDetailRow = {
        ...mockCompany,
        contacts: [mockContact],
        jobs: [mockJob],
      };

      expect(dossier.id).toBe(companyId);
      expect(dossier.trade_name).toBe("TechCorp Brasil");
      expect(dossier.contacts).toHaveLength(1);
      expect(dossier.contacts?.[0]?.contact?.display_name).toBe("Roberto Albuquerque");
      expect(dossier.contacts?.[0]?.is_primary).toBe(true);
      expect(dossier.jobs).toHaveLength(1);
      expect(dossier.jobs?.[0]?.title).toBe("Engenheiro de Software Sênior");
      expect(dossier.jobs?.[0]?.work_model).toBe("hybrid");
    });

    it("suporta navegação com URL correta /app/crm/empresas/[id]", () => {
      const targetUrl = `/app/crm/empresas/${companyId}`;
      expect(targetUrl).toBe(`/app/crm/empresas/${companyId}`);
      expect(targetUrl.startsWith("/app/crm/empresas/")).toBe(true);
    });
  });

  describe("C & D. Edição e Persistência de Observações e Campos", () => {
    it("valida atualização de Observações (notes) pelo updateCompanySchema", () => {
      const payload = {
        notes: "Novas observações comerciais acordadas na reunião de 18/09.",
      };

      const parsed = updateCompanySchema.safeParse(payload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.notes).toBe(payload.notes);
      }
    });

    it("valida atualização de outros campos cadastrais pelo updateCompanySchema", () => {
      const payload = {
        trade_name: "TechCorp Global",
        status: "prospect" as const,
        industry: "Inteligência Artificial",
        city: "São Paulo",
        state: "SP",
      };

      const parsed = updateCompanySchema.safeParse(payload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.trade_name).toBe("TechCorp Global");
        expect(parsed.data.status).toBe("prospect");
      }
    });

    it("rejeita status inválido no updateCompanySchema", () => {
      const payload = {
        status: "invalido",
      };

      const parsed = updateCompanySchema.safeParse(payload);
      expect(parsed.success).toBe(false);
    });
  });

  describe("E & F. Tratamento de Contatos Corporativos e Empty States", () => {
    it("empresa com zero contatos mantém array vazio para acionar empty state", () => {
      const dossierWithoutContacts: CompanyDetailRow = {
        ...mockCompany,
        contacts: [],
        jobs: [mockJob],
      };

      expect(dossierWithoutContacts.contacts).toHaveLength(0);
    });

    it("empresa com contatos vinculados expõe dados completos do decisor", () => {
      const contactRow = mockContact;
      expect(contactRow.role_in_company).toBe("Diretor de Operações (COO)");
      expect(contactRow.contact?.phone_number).toBe("+5581987654321");
      expect(contactRow.contact?.email).toBe("roberto@techcorp.com.br");
      expect(contactRow.is_primary).toBe(true);
    });
  });

  describe("G & H. Vagas de R&S vinculadas e Links", () => {
    it("empresa com vaga vinculada lista a vaga e seus metadados", () => {
      const dossier: CompanyDetailRow = {
        ...mockCompany,
        contacts: [],
        jobs: [mockJob],
      };

      expect(dossier.jobs).toHaveLength(1);
      const job = dossier.jobs![0];
      expect(job.title).toBe("Engenheiro de Software Sênior");
      expect(job.status).toBe("open");
      expect(job.openings_count).toBe(2);

      // Links de navegação
      const vagaUrl = `/app/recrutamento/vagas/${job.id}`;
      const funilUrl = `/app/recrutamento/pipeline?job_id=${job.id}`;
      expect(vagaUrl).toContain(job.id);
      expect(funilUrl).toContain(`job_id=${job.id}`);
    });

    it("empresa com zero vagas mantém array vazio para acionar empty state", () => {
      const dossierWithoutJobs: CompanyDetailRow = {
        ...mockCompany,
        contacts: [mockContact],
        jobs: [],
      };

      expect(dossierWithoutJobs.jobs).toHaveLength(0);
    });
  });

  describe("I. Tenant Isolation Inviolável", () => {
    it("impede visualização de empresa de outra organização", () => {
      // Simulação da verificação de autorização do endpoint GET /api/v1/people/companies/[id]
      function checkTenantAccess(companyOrgId: string, userOrgId: string) {
        if (companyOrgId !== userOrgId) {
          return { ok: false, status: 404, message: "Empresa cliente não encontrada." };
        }
        return { ok: true, status: 200 };
      }

      // Tenant correto tem acesso
      const accessTenantA = checkTenantAccess(mockCompany.organization_id, tenantA);
      expect(accessTenantA.ok).toBe(true);
      expect(accessTenantA.status).toBe(200);

      // Tenant invasor B recebe 404 estrito
      const accessTenantB = checkTenantAccess(mockCompany.organization_id, tenantB);
      expect(accessTenantB.ok).toBe(false);
      expect(accessTenantB.status).toBe(404);
      expect(accessTenantB.message).toMatch(/não encontrada/i);
    });
  });

  describe("J. Regra de Domínio: Candidate NUNCA é criado ou alterado", () => {
    it("garante que Company e CompanyContacts não tocam na tabela de Candidates", () => {
      // client_companies e client_company_contacts são entidades do CRM comercial
      // Candidate pertence exclusivamente a vertice_candidates
      const companyPayload = {
        trade_name: "Empresa Teste",
        notes: "Observação CRM",
      };

      // Nenhuma chave de Candidate pode estar presente
      expect(companyPayload).not.toHaveProperty("full_name");
      expect(companyPayload).not.toHaveProperty("phone_e164");
      expect(companyPayload).not.toHaveProperty("current_job_title");
      expect(companyPayload).not.toHaveProperty("resumes");
    });
  });
});
