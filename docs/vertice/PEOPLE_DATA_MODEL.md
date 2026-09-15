# Vértice People — Modelo de Dados e Invariantes

Este documento descreve o schema relacional, as regras de integridade e os gatilhos introduzidos pela migração `20260915120000_0257_vertice_people_foundation.sql` e espelhados em `supabase/baseline.sql`.

---

## 1. Entidades Principais

### 1.1 `client_companies`
Representa as empresas B2B contratantes da consultoria (ex: Tramontina, Petribu, ACLF).
- **Campos Principais**: `id`, `organization_id`, `legal_name`, `trade_name`, `cnpj` (opcional), `industry`, `website`, `city`, `state`, `status` (`active`, `prospect`, `inactive`), `owner_user_id`, `notes`.
- **Invariantes**: `legal_name` não pode ser vazio. Multi-tenancy estrito.

### 1.2 `client_company_contacts`
Tabela associativa que vincula contatos corporativos da tabela upstream `contacts` às empresas clientes B2B.
- **Campos Principais**: `id`, `organization_id`, `client_company_id`, `contact_id`, `role_in_company`, `is_primary`.
- **Constraint Única**: `unique(client_company_id, contact_id)`.

### 1.3 `vertice_candidates`
Repositório central e permanente de profissionais e executivos.
- **Campos Principais**: `id`, `organization_id`, `contact_id` (nullable), `full_name`, `email`, `email_normalized` (coluna gerada armazenada `lower(trim(email))`), `phone_e164`, `linkedin_url`, `city`, `state`, `current_role`, `current_company`, `area`, `seniority`, `expected_salary`, `availability`, `status`, `source`, `owner_user_id`, `notes`.
- **Status Canônicos**: `active`, `in_process`, `hired`, `inactive`, `do_not_contact`.
- **Regras de Deduplicação**: O serviço `getOrCreateCandidate()` checa sucessivamente por `email_normalized`, `phone_e164`, `contact_id` e `linkedin_url` antes de instanciar um novo registro.
- **Sem CPF**: Não armazena CPF na V1 por privacidade e LGPD desnecessária nesta fase.

### 1.4 `vertice_candidate_resumes`
Armazenamento privado e versionado de arquivos de currículo (PDF, DOC, DOCX).
- **Campos Principais**: `id`, `organization_id`, `candidate_id`, `storage_path`, `original_filename`, `mime_type`, `file_size_bytes` (limite de 15MB), `sha256`, `source_type`, `source_mailbox`, `source_message_id`, `received_at`, `parser_status` (`pending`, `parsed`, `failed`, `unsupported`), `parsed_at`, `extraction_metadata`, `is_current`.
- **Deduplicação por Hash**: Constraint `unique(candidate_id, sha256)`. Se o mesmo arquivo for enviado novamente para o mesmo candidato, o registro existente é retornado.
- **Invariante de CV Atual**: Partial unique index `create unique index on vertice_candidate_resumes(candidate_id) where is_current = true`. Apenas uma versão por candidato pode ser marcada como ativa/atual simultaneamente.

### 1.5 `vertice_job_openings`
Posições abertas vinculadas a empresas clientes B2B.
- **Campos Principais**: `id`, `organization_id`, `client_company_id`, `title`, `department`, `location`, `city`, `state`, `work_model` (`presential`, `hybrid`, `remote`), `employment_type` (`clt`, `pj`, `internship`, `temporary`), `description`, `requirements`, `responsibilities`, `salary_min`, `salary_max`, `benefits`, `openings_count`, `priority` (`low`, `medium`, `high`, `urgent`), `recruiter_id`, `status` (`draft`, `open`, `paused`, `closed`, `cancelled`), `opened_at`, `closing_date`, `closed_at`.

### 1.6 `vertice_job_applications`
Vínculo entre um candidato e uma vaga em um dos 10 estágios do funil de seleção.
- **Campos Principais**: `id`, `organization_id`, `job_opening_id`, `candidate_id`, `resume_id` (nullable), `stage`, `source`, `recruiter_id`, `rejection_reason`, `notes`, `stage_changed_at`.
- **Constraint Única**: `unique(job_opening_id, candidate_id)`. O mesmo profissional não pode se candidatar duas vezes para a mesma vaga.
- **10 Estágios Canônicos**:
  1. `received` (01 RECEBIDO)
  2. `screening` (02 TRIAGEM)
  3. `vertice_interview` (03 ENTREVISTA VÉRTICE)
  4. `assessment` (04 AVALIAÇÃO)
  5. `shortlist` (05 SHORTLIST)
  6. `client_interview` (06 ENTREVISTA CLIENTE)
  7. `finalist` (07 FINALISTA)
  8. `approved` (08 APROVADO)
  9. `rejected` (09 REPROVADO)
  10. `withdrawn` (10 DESISTIU)

---

## 2. Automação Reativa de Status do Candidato

A função disparada pelo gatilho `trg_sync_candidate_status_on_application` sincroniza o status do candidato de acordo com suas candidaturas ativas:
1. Se qualquer candidatura do candidato for marcada como `approved` → status do candidato atualiza para `hired`.
2. Se o candidato possuir ao menos uma candidatura em estágio ativo (`received` até `finalist`) e não estiver `hired`, `inactive` ou `do_not_contact` → status do candidato atualiza para `in_process`.
3. Se o candidato não possuir nenhuma candidatura ativa e estava com status `in_process` → status do candidato retorna automaticamente para `active`.
