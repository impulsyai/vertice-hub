# Vértice People — Arquitetura de Domínio

O **Vértice People** é o módulo vertical de Recrutamento & Seleção (R&S), Gestão de Talentos e Contas B2B construído sobre o downstream controlado **Deskcomm** (`impulsyai/vertice-hub`).

---

## 1. Princípios Arquiteturais

1. **Doutrina Deskcomm Nativa**: O módulo People não cria uma "segunda arquitetura". Utiliza:
   - Identificador multi-tenant obrigatório `organization_id UUID NOT NULL` em todas as entidades.
   - RLS estrita via `fn_user_org_ids()` e `fn_role_at_least(organization_id, 'agent')`.
   - Respostas de API padronizadas com os envelopes `ok(data)` e `fail(code, message, status)`.
   - Validação em runtime via schemas Zod desacoplados em `lib/people/schemas.ts`.
   - Auditoria append-only via `audit()` gravando em `api_audit_log`.
   - Server Components por padrão no Next.js App Router, delegando interatividade para Client Components (`_client.tsx`) com TanStack Query.
   - Guarda de suporte obrigatória (`requireSupportWrite()`) em todos os endpoints mutantes.

2. **Sistema Vivo Interconectado**:
   ```
   Client Company (Cliente B2B)
          ↕ (N:N via client_company_contacts)
     CRM Contact (Identidade Omnichannel / WhatsApp)
          ↕ (opcional contact_id)
   Vertice Candidate (Dossiê de Carreira & Perfil)
          ↕ (1:N versionado)
   Candidate Resume (Bucket Privado candidate-resumes)
          ↕ (1:N)
   Job Opening (Posição aberta para Empresa B2B)
          ↕ (Candidate × Job Opening)
   Job Application (Funil seletivo de 10 etapas)
   ```

3. **Vocabulário do Produto**: Respeito estrito ao vocabulário do usuário (salvaguardado por `tests/unit/vocabulario-do-funil.test.ts`). Termos técnicos como "pipeline" e "kanban" são usados internamente no código, mas a interface apresenta exclusivamente **"Funil de Seleção"**, **"Quadro"** e **"Etapas"**.

---

## 2. Estrutura de Diretórios e Fronteiras

```
app/
├── api/v1/people/
│   ├── applications/              # GET (list), POST (create)
│   │   └── [id]/stage/            # PATCH (atualizar estágio + trigger)
│   ├── candidates/                # GET (list), POST (create/dedupe)
│   │   └── [id]/                  # GET (detail), PATCH (update), DELETE (delete)
│   ├── companies/                 # GET (list), POST (create)
│   │   └── [id]/                  # GET (detail), PATCH (update), DELETE (delete)
│   ├── jobs/                      # GET (list), POST (create)
│   │   └── [id]/                  # GET (detail), PATCH (update), DELETE (delete)
│   └── resumes/                   # POST (upload multipart + SHA-256)
│       └── [id]/download/         # GET (signed URL temporária de 60s)
├── app/
│   ├── crm/empresas/              # Gestão de Empresas Clientes B2B
│   └── recrutamento/
│       ├── page.tsx               # NavHub do grupo Recrutamento
│       ├── talentos/              # Banco de Talentos (lista + [id] dossiê)
│       ├── curriculos/            # Repositório central de arquivos
│       ├── vagas/                 # Vagas abertas (lista + [id] detalhe)
│       ├── candidaturas/          # Visão consolidada de inscrições
│       └── pipeline/              # Funil de Seleção interativo (10 estágios)
lib/
├── people/
│   ├── types.ts                   # Tipos de domínio e constantes de estágio
│   ├── schemas.ts                 # Schemas Zod de validação
│   ├── services.ts                # Deduplicação, SHA-256 e normalizações
│   └── client-hooks.ts            # Hooks React Query para frontend
```
