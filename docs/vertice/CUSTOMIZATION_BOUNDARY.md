# CUSTOMIZATION BOUNDARY
## Fronteiras Arquiteturais e Isolamento de Código do Vértice Hub

---

## 1. Regra de Ouro: Mínimo Diff Core
O código upstream do DeskcommCRM deve ser mantido intacto em 95%+ da árvore.
Todo código específico de Recrutamento & Seleção (R&S) e Empresas B2B deve residir em módulos isolados.

---

## 2. Mapa de Arquitetura e Diretórios

### 2.1. Arquivos Core Tocados (Strict Touch Budget)
Somente pontos canônicos de registro e testes de governança do Deskcomm foram alterados:
- `lib/navigation/catalogo.ts`: Registro do grupo `recrutamento` e rotas no `NAV_CATALOG`.
- `lib/navigation/registry.ts`: Exportações e ícones da interface.
- `lib/ui/icons.ts`: Exportação canônica dos ícones `User`, `ArrowLeft`, `Briefcase`, `EnvelopeSimple`, `LinkedinLogo`.
- `lib/i18n/dicionario.ts`: Dicionário bilíngue para novos rótulos de navegação.
- `lib/audit/actions.ts`: Adição de códigos canônicos de auditoria `people.*`.
- `supabase/baseline.sql`: Espelhamento idempotente das tabelas, Composite FKs, RPC `fn_register_candidate_resume` e triggers.
- `tests/unit/sidebar-grupos.test.tsx`: Inclusão do grupo `Recrutamento` na ordem de títulos da Sidebar.
- `tests/invariants/rls-completude-varredura.test.ts`: Registro das 6 tabelas de People em `PROVA_PROPRIA`.

### 2.2. Módulos Isolados (Novos Arquivos)
- **Domínio & Serviços People:** `lib/people/`:
  - `types.ts`: Tipagem forte de domínio (`current_job_title`).
  - `schemas.ts`: Schemas Zod de validação.
  - `services.ts`: Deduplicação race-safe, SHA-256 e normalizações (E.164, LinkedIn).
  - `file-validation.ts`: Validação forense binária (MIME + extensões + magic bytes).
  - `client-hooks.ts`: Hooks React Query para frontend.
- **Rotas de API:** `app/api/v1/people/` (`candidates/`, `resumes/`, `jobs/`, `applications/`, `companies/`).
- **Páginas do App:**
  - `app/app/recrutamento/` (`page.tsx`, `talentos/`, `curriculos/`, `vagas/`, `candidaturas/`, `pipeline/`).
  - `app/app/crm/empresas/` (`page.tsx`, `_client.tsx`).
- **Migração do Banco de Dados:** `supabase/migrations/20260915120000_0257_vertice_people_foundation.sql`.
- **Testes de Invariantes & RLS:** `tests/invariants/people-rls-isolation.test.ts`.
- **Testes Unitários:** `tests/unit/people-hardening.test.ts`.
- **Documentação Especializada:** `docs/vertice/` (`PEOPLE_ARCHITECTURE.md`, `PEOPLE_DATA_MODEL.md`, `PEOPLE_SECURITY.md`).

---

## 3. Diretrizes de Banco de Dados & RLS
1. **Multi-tenancy Relacional Estrito:** Toda tabela possui `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE` e Composite Foreign Keys `(organization_id, id)`.
2. **Same-Org Foreign Keys:** Relações dependentes exigem correspondência de `organization_id` a nível de chave estrangeira do banco.
3. **Imutabilidade e Regras de Negócio:** Triggers no banco garantem imutabilidade de candidatura e barram candidaturas em vagas que não estejam com status `open`.
4. **Troca Atômica de Currículo:** RPC `fn_register_candidate_resume` impede concorrência de múltiplos currículos ativos via lock `FOR UPDATE`.
5. **RLS Estrito:** Leitura com `organization_id IN (SELECT public.fn_user_org_ids())` e escrita restrita por papel com `public.fn_role_at_least()`.
6. **Revogação Anon:** `REVOKE ALL ON <table> FROM anon;` explícito em todas as tabelas.
7. **Storage Privado e Rollback:** Bucket `candidate-resumes` 100% privado com RLS per-tenant via caminho, e deleção imediata de arquivos órfãos em caso de falha de transação.
