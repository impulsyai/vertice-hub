# Vértice People — Segurança, RLS e Isolamento

Este documento detalha as garantias de isolamento entre organizações, controle de acesso baseado em papéis (RBAC), proteção contra vazamentos de FK e segurança de arquivos confidenciais do módulo **Vértice People** (Fase 4.2.1 Hardening).

---

## 1. Isolamento Multi-Tenant em Duas Camadas (Defesa em Profundidade)

### Camada 1: RLS (Row-Level Security)
Todas as 6 tabelas de People possuem RLS habilitada (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) e privilégios de `anon` sumariamente revogados (`REVOKE ALL ON ... FROM anon`).
- **Leitura (`SELECT`)**: Restrita a membros ativos da organização via `organization_id IN (SELECT public.fn_user_org_ids())` ou superadministradores da plataforma (`public.fn_is_platform_admin()`).
- **Escrita (`INSERT`, `UPDATE`, `DELETE`)**: Exige ao menos o papel de `agent` na organização (`public.fn_role_at_least(organization_id, 'agent')`).
- **`WITH CHECK`**: Impede que um usuário da Org A tente inserir ou alterar registros apontando para a Org B.

### Camada 2: Integridade Declarativa no Banco (Composite Foreign Keys Same-Org)
RLS por si só não previne falhas de orquestração interna onde uma row da Org B referencia acidentalmente IDs da Org A.
Para tornar isso **estruturalmente impossível no PostgreSQL**:
- Toda relação People utiliza chaves estrangeiras compostas contendo `organization_id`.
- `vertice_job_applications` referencia `vertice_job_openings(organization_id, id)`.
- `vertice_job_applications` referencia `vertice_candidates(organization_id, id)`.
- `vertice_job_applications` referencia `vertice_candidate_resumes(organization_id, candidate_id, id)`.
- `vertice_candidate_resumes` referencia `vertice_candidates(organization_id, id)`.
- `vertice_job_openings` referencia `client_companies(organization_id, id)`.
- `client_company_contacts` referencia `client_companies(organization_id, id)`.

Mesmo que um atacante contorne a camada de API ou uma query privilegiada seja executada, o motor relacional do PostgreSQL aborta a transação com `foreign_key_violation` caso haja divergência de `organization_id` ou caso um currículo não pertença ao candidato da aplicação.

---

## 2. Proteção de Arquivos de Currículos (`candidate-resumes`)

1. **Bucket Privado**:
   O bucket do Supabase Storage `candidate-resumes` é configurado com `public = false`. Nenhuma URL pública ou sem autenticação consegue ler os arquivos.

2. **Validação Forense Binária (`lib/people/file-validation.ts`)**:
   Todo arquivo passa por inspeção de 3 fatores antes de ser persistido:
   - Extensão permitida (`.pdf`, `.doc`, `.docx`).
   - MIME type declarado compatível com a extensão.
   - **Magic bytes**:
     - PDF: Assinatura obrigatória `%PDF-`.
     - DOC: Assinatura de cabeçalho OLE Compound File (`D0 CF 11 E0 A1 B1 1A E1`).
     - DOCX: Assinatura de cabeçalho ZIP/OOXML (`50 4B 03 04` ou `50 4B 05 06`).
   Tentativas de renomear executáveis, scripts ou páginas HTML com extensões `.pdf` são sumariamente rejeitadas com erro 400.

3. **Substituição Atômica e Tratamento de Falhas (Sem Órfãos)**:
   - A substituição do currículo atual é executada via RPC transacional `fn_register_candidate_resume` com bloqueio pessimista `SELECT ... FOR UPDATE` do candidato.
   - Se a gravação no banco de dados falhar por qualquer motivo após o upload para o Storage, o arquivo recém-enviado é imediatamente removido via `supabase.storage.from("candidate-resumes").remove([storagePath])`, impedindo arquivos órfãos.

4. **Download Seguro via Signed URL**:
   O endpoint `/api/v1/people/resumes/:id/download` valida a posse do registro no tenant do usuário ativo e emite uma Signed URL temporária com expiração em **60 segundos**.

---

## 3. Segurança de Funções `SECURITY DEFINER`

Funções de banco de dados executadas com privilégios elevados (ex: `fn_sync_candidate_status_from_applications()`):
1. Possuem `SET search_path = public, pg_temp;` fixado para proteção contra path hijacking.
2. Todo comando `UPDATE` ou `SELECT` filtra estritamente por `organization_id` além do ID do registro (`WHERE id = candidate_id AND organization_id = target_org_id`), impedindo qualquer efeito colateral ou escalada cross-tenant.

---

## 4. Guarda de Suporte e Auditoria Append-Only

1. **Guarda de Suporte (`requireSupportWrite()`)**:
   Todo endpoint mutante (`POST`, `PATCH`, `DELETE`) em `/api/v1/people/*` bloqueia execuções durante sessões de suporte técnico que não possuam permissão explícita de escrita.

2. **Auditoria com `await` Obrigatório**:
   Todas as operações do ciclo de vida de People registram eventos de auditoria imutáveis chamando `await audit({ ... })`:
   - `people.company_created`, `people.company_updated`, `people.company_deleted`
   - `people.candidate_created`, `people.candidate_updated`, `people.candidate_deleted`
   - `people.resume_uploaded`
   - `people.job_created`, `people.job_updated`, `people.job_deleted`
   - `people.application_created`, `people.application_stage_changed`
