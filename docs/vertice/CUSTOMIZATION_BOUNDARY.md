# CUSTOMIZATION BOUNDARY
## Fronteiras Arquiteturais e Isolamento de Código do Vértice Hub

---

## 1. Regra de Ouro: Mínimo Diff Core
O código upstream do DeskcommCRM deve ser mantido intacto em 95%+ da árvore.
Todo código específico de Recrutamento & Seleção (R&S) e Empresas B2B deve residir em módulos isolados.

---

## 2. Mapa de Arquitetura e Diretórios

### 2.1. Arquivos Core Tocados (Strict Touch Budget)
Somente pontos canônicos de registro do Deskcomm são alterados:
- `lib/navigation/catalogo.ts`: Registro do grupo `recrutamento` e rotas no `NAV_CATALOG`.
- `lib/navigation/registry.ts`: Exportações e ícones da interface.
- `lib/i18n/dicionario.ts`: Dicionário bilíngue para novos rótulos de navegação (obrigatório para aprovação em `tests/unit/idioma-da-interface.test.ts`).
- `lib/audit/actions.ts`: Adição de códigos canônicos de auditoria `people.*`.
- `supabase/baseline.sql`: Espelhamento idempotente das novas tabelas e policies.

### 2.2. Módulos Isolados (Novos Arquivos)
- **Domínio & Serviços People:** `lib/people/` (tipos, schemas Zod, deduplicação, hash SHA-256 e transições de pipeline).
- **Rotas de API:** `app/api/v1/people/` (`candidates/`, `resumes/`, `jobs/`, `applications/`, `companies/`).
- **Páginas do App:**
  - `app/app/recrutamento/` (`talentos/`, `curriculos/`, `vagas/`, `candidaturas/`, `pipeline/`, `page.tsx`).
  - `app/app/empresas/` (`page.tsx`, `_client.tsx`).
- **Componentes UI:** `components/people/` (tabelas, cards, dialogs, kanban especializado).
- **Migração do Banco de Dados:** `supabase/migrations/20260915120000_0257_vertice_people_foundation.sql`.
- **Testes de Invariantes & RLS:** `tests/invariants/people-rls-isolation.test.ts`.
- **Documentação Especializada:** `docs/vertice/`.

---

## 3. Diretrizes de Banco de Dados & RLS
1. **Multi-tenancy:** Toda tabela possui `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`.
2. **RLS Estrito:** Leitura com `organization_id IN (SELECT public.fn_user_org_ids())` e escrita restrita por papel com `public.fn_role_at_least()`.
3. **Revogação Anon:** `REVOKE ALL ON <table> FROM anon;` explícito em todas as tabelas.
4. **Storage Privado:** Bucket `candidate-resumes` 100% privado com RLS per-tenant via caminho (`organization_id/candidate_id/sha256`).
5. **Automação de Status:** Trigger transacional no banco (`trg_sync_candidate_status_on_application`) mantendo coerência do status do candidato sem depender exclusivamente do frontend.
