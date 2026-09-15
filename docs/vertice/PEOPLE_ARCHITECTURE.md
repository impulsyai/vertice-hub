# Vértice People — Arquitetura de Domínio

O **Vértice People** é o módulo vertical de Recrutamento & Seleção (R&S), Gestão de Talentos e Contas B2B construído sobre o downstream controlado **Deskcomm** (`impulsyai/vertice-hub`).

---

## 1. Princípios Arquiteturais e Hardening (Fase 4.2.1)

1. **Doutrina Deskcomm Nativa e Integridade Declarativa**:
   - Identificador multi-tenant obrigatório `organization_id UUID NOT NULL` em todas as entidades.
   - **Composite Foreign Keys Same-Org**: Todas as relações entre entidades People são blindadas no banco de dados via chaves estrangeiras compostas `(organization_id, entity_id)`, tornando estruturalmente impossível no PostgreSQL apontar uma entidade da Organização B para uma da Organização A.
   - **Vinculação Candidato ↔ Currículo Estrita**: A candidatura (`vertice_job_applications`) valida no próprio banco via FK composta `(organization_id, candidate_id, resume_id)` que o currículo anexado pertence estritamente ao mesmo candidato e à mesma organização.
   - RLS estrita via `fn_user_org_ids()` e `fn_role_at_least(organization_id, 'agent')`.
   - Respostas de API padronizadas com os envelopes `ok(data)` e `fail(code, message, status)`.
   - Validação em runtime via schemas Zod desacoplados em `lib/people/schemas.ts`.
   - Validação forense de arquivos via `lib/people/file-validation.ts` inspecionando MIME types, extensões e magic bytes (%PDF-, OLE DOC, ZIP DOCX).
   - Auditoria append-only com `await audit()` obrigatório em todos os route handlers mutantes.
   - Transacionalidade de substituição de currículos via RPC Postgres `fn_register_candidate_resume` com bloqueio pessimista `FOR UPDATE` do candidato.
   - Limpeza automática de arquivos órfãos no Storage caso a transação no banco de dados falhe.

2. **Sistema Vivo Interconectado**:
   ```
   Client Company (Cliente B2B)
          ↕ (N:N via client_company_contacts com same-org trigger)
     CRM Contact (Identidade Omnichannel / WhatsApp)
          ↕ (opcional contact_id com same-org trigger)
   Vertice Candidate (Dossiê de Carreira & Perfil — current_job_title)
          ↕ (1:N versionado com unique sha256 e atomic current)
   Candidate Resume (Bucket Privado candidate-resumes)
          ↕ (1:N via composite FK organization_id, client_company_id)
   Job Opening (Posição com status = 'open' para nova candidatura)
          ↕ (Candidate × Job Opening com imutabilidade de identidade)
   Job Application (Funil seletivo de 10 etapas + status recalculation)
   ```

3. **Vocabulário do Produto**: Respeito estrito ao vocabulário do usuário (salvaguardado por testes unitários). Termos técnicos como "pipeline" e "kanban" são usados internamente no código, mas a interface apresenta exclusivamente **"Funil de Seleção"**, **"Quadro"** e **"Etapas"**.

---

## 2. Estrutura de Diretórios e Fronteiras

```
app/
├── api/v1/people/
│   ├── applications/              # GET (list), POST (create - só vagas open + same-candidate resume)
│   │   └── [id]/stage/            # PATCH (atualizar estágio + trigger de status)
│   ├── candidates/                # GET (list), POST (create/dedupe race-safe)
│   │   └── [id]/                  # GET (detail), PATCH (update), DELETE (delete)
│   ├── companies/                 # GET (list), POST (create)
│   │   └── [id]/                  # GET (detail), PATCH (update), DELETE (delete)
│   ├── jobs/                      # GET (list), POST (create)
│   │   └── [id]/                  # GET (detail), PATCH (update), DELETE (delete)
│   └── resumes/                   # POST (upload forense + RPC transacional + rollback de storage)
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
│   ├── types.ts                   # Tipos de domínio (current_job_title) e constantes de estágio
│   ├── schemas.ts                 # Schemas Zod de validação (current_job_title + alias)
│   ├── services.ts                # Deduplicação race-safe, SHA-256 e normalizações
│   ├── file-validation.ts         # Validação forense binária (magic bytes)
│   └── client-hooks.ts            # Hooks React Query para frontend
```
