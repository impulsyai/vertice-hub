import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EntradaDeMensagem } from "@/lib/channels/pos-entrada";
import { aplicarEfeitosPosEntrada } from "@/lib/channels/pos-entrada";

// Mocks dos módulos de efeitos externos
const audit = vi.fn(async () => {});
const garantirLeadDaConversa = vi.fn(async () => ({ criado: true, leadId: "lead-1" }) as never);
const acelerarPipelineDeEventos = vi.fn(async () => {});
const autorizarContatoParaIA = vi.fn(async () => {});

vi.mock("@/lib/audit", () => ({ audit: (...a: unknown[]) => audit(...(a as [])) }));
vi.mock("@/lib/leads/nascimento-do-lead", () => ({
  garantirLeadDaConversa: (...a: unknown[]) => garantirLeadDaConversa(...(a as [])),
}));
vi.mock("@/lib/dev/kick-local-pipeline", () => ({
  acelerarPipelineDeEventos: (...a: unknown[]) => acelerarPipelineDeEventos(...(a as [])),
  kickLocalPipeline: vi.fn(async () => {}),
}));
vi.mock("@/lib/ai/elegibilidade/autorizacao", () => ({
  autorizarContatoParaIA: (...a: unknown[]) => autorizarContatoParaIA(...(a as [])),
}));

// In-memory mock database
interface ContactRow {
  id: string;
  organization_id: string;
  phone_number: string | null;
  is_blocked?: boolean;
  blocked_reason?: string | null;
  blocked_at?: string | null;
}

interface CandidateRow {
  id: string;
  organization_id: string;
  contact_id: string | null;
  full_name: string;
  phone_e164: string | null;
}

interface CompanyContactRow {
  id: string;
  organization_id: string;
  client_company_id: string;
  contact_id: string;
}

let contactsDb: ContactRow[] = [];
let candidatesDb: CandidateRow[] = [];
let companyContactsDb: CompanyContactRow[] = [];
let emittedRpcs: Record<string, unknown>[] = [];

/** Cria um mock do Supabase Admin Client fiel às queries de candidate-routing e pos-entrada */
function createMockAdmin() {
  return {
    from(table: string) {
      const currentTable = table;
      const filters: ((row: Record<string, unknown>) => boolean)[] = [];
      let limitVal: number | null = null;

      const builder = {
        select(_cols?: string) {
          return builder;
        },
        eq(col: string, val: unknown) {
          filters.push((r) => r[col] === val);
          return builder;
        },
        in(col: string, vals: unknown[]) {
          filters.push((r) => vals.includes(r[col]));
          return builder;
        },
        is(col: string, val: unknown) {
          if (val === null) {
            filters.push((r) => r[col] === null || r[col] === undefined);
          }
          return builder;
        },
        limit(n: number) {
          limitVal = n;
          return builder;
        },
        async maybeSingle() {
          let pool: Record<string, unknown>[] = [];
          if (currentTable === "vertice_candidates") pool = candidatesDb as unknown as Record<string, unknown>[];
          else if (currentTable === "contacts") pool = contactsDb as unknown as Record<string, unknown>[];
          else if (currentTable === "client_company_contacts") pool = companyContactsDb as unknown as Record<string, unknown>[];

          const filtered = pool.filter((row) => filters.every((f) => f(row)));
          return { data: filtered[0] ?? null, error: null };
        },
        async single() {
          const res = await builder.maybeSingle();
          if (!res.data) return { data: null, error: { message: "Row not found" } };
          return res;
        },
        // Invocado quando aguarda array diretamente (ex: await admin.from(...).select(...))
        then(resolve: (val: unknown) => void) {
          let pool: Record<string, unknown>[] = [];
          if (currentTable === "vertice_candidates") pool = candidatesDb as unknown as Record<string, unknown>[];
          else if (currentTable === "contacts") pool = contactsDb as unknown as Record<string, unknown>[];
          else if (currentTable === "client_company_contacts") pool = companyContactsDb as unknown as Record<string, unknown>[];

          let filtered = pool.filter((row) => filters.every((f) => f(row)));
          if (limitVal !== null) filtered = filtered.slice(0, limitVal);
          return Promise.resolve({ data: filtered, error: null }).then(resolve);
        },
        update(patch: Record<string, unknown>) {
          return {
            eq(col: string, val: unknown) {
              filters.push((r) => r[col] === val);
              return this;
            },
            is(col: string, val: unknown) {
              if (val === null) {
                filters.push((r) => r[col] === null || r[col] === undefined);
              }
              return this;
            },
            select(_cols?: string) {
              return this;
            },
            async maybeSingle() {
              let target: Record<string, unknown> | null = null;
              if (currentTable === "vertice_candidates") {
                const found = candidatesDb.find((r) => filters.every((f) => f(r as unknown as Record<string, unknown>)));
                if (found) {
                  Object.assign(found, patch);
                  target = { ...found } as unknown as Record<string, unknown>;
                }
              } else if (currentTable === "contacts") {
                const found = contactsDb.find((r) => filters.every((f) => f(r as unknown as Record<string, unknown>)));
                if (found) {
                  Object.assign(found, patch);
                  target = { ...found } as unknown as Record<string, unknown>;
                }
              }
              return { data: target, error: null };
            },
            then(resolve: (val: unknown) => void) {
              return this.maybeSingle().then(resolve);
            },
          };
        },
      };

      return builder;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      emittedRpcs.push({ name, ...args });
      return { error: null };
    },
  };
}

describe("Roteamento Semântico de WhatsApp: Candidate ≠ CRM Lead (Fase 4.4A)", () => {
  const ORG_A = "org-vertice-aaa";
  const ORG_B = "org-vertice-bbb";

  beforeEach(() => {
    contactsDb = [];
    candidatesDb = [];
    companyContactsDb = [];
    emittedRpcs = [];

    audit.mockClear();
    garantirLeadDaConversa.mockClear();
    garantirLeadDaConversa.mockResolvedValue({ criado: true, leadId: "lead-crm-1" } as never);
    acelerarPipelineDeEventos.mockClear();
    autorizarContatoParaIA.mockClear();
  });

  // ─── TESTE 1 ─────────────────────────────────────────────────────────────
  it("TESTE 1: Candidate já vinculado a contact_id -> inbound -> NÃO cria crm_lead", async () => {
    const contactId = "contact-cand-1";
    const candidateId = "cand-1";

    contactsDb.push({
      id: contactId,
      organization_id: ORG_A,
      phone_number: "+5531998966398",
    });
    candidatesDb.push({
      id: candidateId,
      organization_id: ORG_A,
      contact_id: contactId,
      full_name: "Candidata Marcela",
      phone_e164: "+5531998966398",
    });

    const admin = createMockAdmin();
    const entrada: EntradaDeMensagem = {
      organizationId: ORG_A,
      contactId,
      conversationId: "conv-1",
      messageId: "msg-1",
      channelSessionId: "sess-waha",
      texto: "Olá, gostaria de saber sobre a vaga de Engenheiro de Software",
      nomeDoContato: "Marcela",
      origem: "waha",
    };

    await aplicarEfeitosPosEntrada(admin as never, entrada);

    // Efeitos comerciais devem ser estritamente suprimidos
    expect(garantirLeadDaConversa).not.toHaveBeenCalled();
    expect(acelerarPipelineDeEventos).not.toHaveBeenCalled();
    expect(emittedRpcs).toHaveLength(0); // nenhum ai_agent.dispatch_requested
  });

  // ─── TESTE 2 ─────────────────────────────────────────────────────────────
  it("TESTE 2: Candidate com mesmo phone_e164 e contact_id NULL -> inbound -> candidate.contact_id é vinculado e NÃO cria crm_lead", async () => {
    const contactId = "contact-new-cand";
    const candidateId = "cand-unlinked";

    // Contato chega com formato canônico (+5531998966398)
    contactsDb.push({
      id: contactId,
      organization_id: ORG_A,
      phone_number: "+5531998966398",
    });
    // Candidate cadastrado previamente pelo recrutador com contact_id NULL
    candidatesDb.push({
      id: candidateId,
      organization_id: ORG_A,
      contact_id: null,
      full_name: "Candidato João",
      phone_e164: "+5531998966398",
    });

    const admin = createMockAdmin();
    const entrada: EntradaDeMensagem = {
      organizationId: ORG_A,
      contactId,
      conversationId: "conv-2",
      messageId: "msg-2",
      channelSessionId: "sess-waha",
      texto: "Enviei meu currículo ontem pelo site",
      nomeDoContato: "João",
      origem: "waha",
    };

    await aplicarEfeitosPosEntrada(admin as never, entrada);

    // Auto-link deve ter ocorrido
    const candAtualizado = candidatesDb.find((c) => c.id === candidateId);
    expect(candAtualizado?.contact_id).toBe(contactId);

    // Lead comercial NÃO deve ser criado
    expect(garantirLeadDaConversa).not.toHaveBeenCalled();
    expect(acelerarPipelineDeEventos).not.toHaveBeenCalled();
  });

  // ─── TESTE 3 ─────────────────────────────────────────────────────────────
  it("TESTE 3: Segunda mensagem do mesmo Candidate -> idempotente -> nenhum lead criado e vínculo inalterado", async () => {
    const contactId = "contact-cand-repeat";
    const candidateId = "cand-repeat";

    contactsDb.push({
      id: contactId,
      organization_id: ORG_A,
      phone_number: "+5531998966398",
    });
    candidatesDb.push({
      id: candidateId,
      organization_id: ORG_A,
      contact_id: contactId,
      full_name: "Candidata Repetida",
      phone_e164: "+5531998966398",
    });

    const admin = createMockAdmin();
    const entrada: EntradaDeMensagem = {
      organizationId: ORG_A,
      contactId,
      conversationId: "conv-3",
      messageId: "msg-3b",
      channelSessionId: "sess-waha",
      texto: "Segunda mensagem de follow-up",
      nomeDoContato: "Candidata",
      origem: "waha",
    };

    await aplicarEfeitosPosEntrada(admin as never, entrada);

    expect(garantirLeadDaConversa).not.toHaveBeenCalled();
    const cand = candidatesDb.find((c) => c.id === candidateId);
    expect(cand?.contact_id).toBe(contactId);
  });

  // ─── TESTE 4 ─────────────────────────────────────────────────────────────
  it("TESTE 4: Mesmo número em OUTRA organization -> não vincula cross-tenant e não acessa candidato externo", async () => {
    const contactIdOrgA = "contact-in-org-a";
    const candidateIdOrgB = "candidate-in-org-b";
    const phoneCompartilhado = "+5531998966398";

    // Contato entra na ORG_A
    contactsDb.push({
      id: contactIdOrgA,
      organization_id: ORG_A,
      phone_number: phoneCompartilhado,
    });
    // Candidate pertence à ORG_B
    candidatesDb.push({
      id: candidateIdOrgB,
      organization_id: ORG_B,
      contact_id: null,
      full_name: "Candidato de Outra Org",
      phone_e164: phoneCompartilhado,
    });

    const admin = createMockAdmin();
    const entrada: EntradaDeMensagem = {
      organizationId: ORG_A,
      contactId: contactIdOrgA,
      conversationId: "conv-4",
      messageId: "msg-4",
      channelSessionId: "sess-waha",
      texto: "Mensagem na Org A",
      nomeDoContato: "Externo",
      origem: "waha",
    };

    await aplicarEfeitosPosEntrada(admin as never, entrada);

    // O candidato da ORG_B NÃO deve ter sido tocado
    const candOrgB = candidatesDb.find((c) => c.id === candidateIdOrgB);
    expect(candOrgB?.contact_id).toBeNull();

    // Como na Org A o contato é desconhecido, o comportamento comercial padrão da Org A roda normalmente
    expect(garantirLeadDaConversa).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ organizationId: ORG_A, contactId: contactIdOrgA }),
    );
  });

  // ─── TESTE 5 ─────────────────────────────────────────────────────────────
  it("TESTE 5: Contato desconhecido -> comportamento atual preservado -> lead continua sendo criado conforme regra existente", async () => {
    const contactId = "contact-desconhecido";

    contactsDb.push({
      id: contactId,
      organization_id: ORG_A,
      phone_number: "+5511988887777",
    });
    // Nenhum candidate e nenhum company contact no banco

    const admin = createMockAdmin();
    const entrada: EntradaDeMensagem = {
      organizationId: ORG_A,
      contactId,
      conversationId: "conv-unknown",
      messageId: "msg-unknown",
      channelSessionId: "sess-waha",
      texto: "Gostaria de contratar a consultoria da Vértice",
      nomeDoContato: "Lead Comercial em Potencial",
      origem: "waha",
    };

    await aplicarEfeitosPosEntrada(admin as never, entrada);

    // Deve chamar garantirLeadDaConversa normalmente
    expect(garantirLeadDaConversa).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organizationId: ORG_A,
        contactId,
        conversationId: "conv-unknown",
      }),
    );
    // E acelerarPipelineDeEventos deve ser chamado
    expect(acelerarPipelineDeEventos).toHaveBeenCalled();
  });

  // ─── TESTE 6 ─────────────────────────────────────────────────────────────
  it("TESTE 6: client_company_contact conhecido -> comportamento comercial existente preservado", async () => {
    const contactId = "contact-diretor-b2b";

    contactsDb.push({
      id: contactId,
      organization_id: ORG_A,
      phone_number: "+5511977776666",
    });
    companyContactsDb.push({
      id: "company-contact-1",
      organization_id: ORG_A,
      client_company_id: "company-empresa-x",
      contact_id: contactId,
    });

    const admin = createMockAdmin();
    const entrada: EntradaDeMensagem = {
      organizationId: ORG_A,
      contactId,
      conversationId: "conv-b2b",
      messageId: "msg-b2b",
      channelSessionId: "sess-waha",
      texto: "Queremos abrir uma nova vaga corporativa",
      nomeDoContato: "Diretor da Empresa X",
      origem: "waha",
    };

    await aplicarEfeitosPosEntrada(admin as never, entrada);

    // Contato de empresa preserva fluxo de CRM comercial
    expect(garantirLeadDaConversa).toHaveBeenCalled();
    expect(acelerarPipelineDeEventos).toHaveBeenCalled();
  });

  // ─── TESTE 7 ─────────────────────────────────────────────────────────────
  it("TESTE 7: Candidate envia opt-out -> contact continua sendo bloqueado normalmente -> nenhum lead", async () => {
    const contactId = "contact-cand-optout";
    const candidateId = "cand-optout";

    contactsDb.push({
      id: contactId,
      organization_id: ORG_A,
      phone_number: "+5531998966398",
      is_blocked: false,
    });
    candidatesDb.push({
      id: candidateId,
      organization_id: ORG_A,
      contact_id: contactId,
      full_name: "Candidato Desistente",
      phone_e164: "+5531998966398",
    });

    const admin = createMockAdmin();
    const entrada: EntradaDeMensagem = {
      organizationId: ORG_A,
      contactId,
      conversationId: "conv-optout",
      messageId: "msg-optout",
      channelSessionId: "sess-waha",
      texto: "PARAR de mandar mensagens",
      nomeDoContato: "Candidato",
      origem: "waha",
    };

    await aplicarEfeitosPosEntrada(admin as never, entrada);

    // 1. Opt-out LGPD continua funcionando incondicionalmente
    const contatoAtualizado = contactsDb.find((c) => c.id === contactId);
    expect(contatoAtualizado?.is_blocked).toBe(true);
    expect(contatoAtualizado?.blocked_reason).toBe("stop_keyword");
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "contact.blocked",
        organizationId: ORG_A,
      }),
    );

    // 2. Nenhum lead comercial gerado
    expect(garantirLeadDaConversa).not.toHaveBeenCalled();
  });

  // ─── TESTE 8 ─────────────────────────────────────────────────────────────
  it("TESTE 8: Concorrência / reentrega -> não cria vínculo duplicado, não troca contact existente e não causa 500", async () => {
    const contactIdOriginal = "contact-original";
    const contactIdNovo = "contact-outro";
    const candidateId = "cand-concorrencia";

    contactsDb.push(
      { id: contactIdOriginal, organization_id: ORG_A, phone_number: "+5531998966398" },
      { id: contactIdNovo, organization_id: ORG_A, phone_number: "+5531998966398" },
    );

    // Candidate já está vinculado ao contactIdOriginal
    candidatesDb.push({
      id: candidateId,
      organization_id: ORG_A,
      contact_id: contactIdOriginal,
      full_name: "Candidato Seguro",
      phone_e164: "+5531998966398",
    });

    const admin = createMockAdmin();

    // Mensagem chega sob o contactIdNovo (conflito ou reentrega de outro socket)
    const entrada: EntradaDeMensagem = {
      organizationId: ORG_A,
      contactId: contactIdNovo,
      conversationId: "conv-concorrente",
      messageId: "msg-concorrente",
      channelSessionId: "sess-waha",
      texto: "Outra mensagem simultânea",
      nomeDoContato: "Novo Contato",
      origem: "waha",
    };

    // Não deve lançar erro
    await expect(aplicarEfeitosPosEntrada(admin as never, entrada)).resolves.not.toThrow();

    // Vínculo original NÃO deve ser sobrescrito
    const cand = candidatesDb.find((c) => c.id === candidateId);
    expect(cand?.contact_id).toBe(contactIdOriginal);

    // E como é candidato, lead comercial é suprimido
    expect(garantirLeadDaConversa).not.toHaveBeenCalled();
  });
});
