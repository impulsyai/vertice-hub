# Vértice People — Modelo de Dados e Invariantes

Este documento descreve o schema relacional, as regras de integridade e os gatilhos introduzidos pela migração `20260915120000_0257_vertice_people_foundation.sql` e espelhados em `supabase/baseline.sql`, incorporando as melhorias de integridade da **Fase 4.2.1**.

---

## 1. Entidades Principais e Integridade Relacional

### 1.1 `client_companies`
Representa as empresas B2B contratantes da consultoria (ex: Tramontina, Petribu, ACLF).
- **Campos Principais**: `id`, `organization_id`, `legal_name`, `trade_name`, `cnpj` (opcional), `industry`, `website`, `city`, `state`, `status` (`active`, `prospect`, `inactive`), `owner_user_id`, `notes`.
- **Integridade Declarativa**: Constraint `UNIQUE (organization_id, id)` como âncora para composite foreign keys downstream.

### 1.2 `client_company_contacts`
Tabela associativa que vincula contatos corporativos da tabela upstream `contacts` às empresas clientes B2B.
- **Campos Principais**: `id`, `organization_id`, `client_company_id`, `contact_id`, `role_in_company`, `is_primary`.
- **Integridade Declarativa**:
  - `FOREIGN KEY (organization_id, client_company_id) REFERENCES client_companies(organization_id, id) ON DELETE CASCADE`.
  - Trigger `trg_ensure_client_company_contact_same_org` garantindo que `contact_id` pertença rigorosamente ao mesmo `organization_id`.
  - Constraint `UNIQUE (client_company_id, contact_id)`.

### 1.3 `vertice_candidates`
Repositório central e permanente de profissionais e executivos.
- **Campos Principais**: `id`, `organization_id`, `contact_id` (nullable), `full_name`, `email`, `email_normalized` (coluna gerada armazenada `lower(trim(email))`), `phone_e164`, `linkedin_url`, `city`, `state`, `current_job_title` (anteriormente `current_role`), `current_company`, `area`, `seniority`, `expected_salary`, `availability`, `status`, `source`, `owner_user_id`, `notes`.
- **Status Canônicos**: `active`, `in_process`, `hired`, `inactive`, `do_not_contact`.
- **Renomeação Canônica (P0 Fix)**: A coluna foi renomeada definitivamente de `current_role` para `current_job_title` para eliminar colisão de sintaxe com a palavra reservada PostgreSQL `CURRENT_ROLE`. O schema Zod preserva `current_role` como alias mapeado.
- **Integridade Declarativa e Deduplicação Race-Safe**:
  - Constraint `UNIQUE (organization_id, id)`.
  - Trigger `trg_ensure_candidate_contact_same_org` garantindo mesmo tenant para `contact_id`.
  - Índices parciais únicos para proteção concorrente:
    - `vertice_candidates_org_email_idx` ON `(organization_id, email_normalized) WHERE email_normalized IS NOT NULL AND email_normalized <> ''`
    - `vertice_candidates_org_phone_idx` ON `(organization_id, phone_e164) WHERE phone_e164 IS NOT NULL AND phone_e164 <> ''`
    - `vertice_candidates_org_contact_idx` ON `(organization_id, contact_id) WHERE contact_id IS NOT NULL`

### 1.4 `vertice_candidate_resumes`
Armazenamento privado e versionado de arquivos de currículo (PDF, DOC, DOCX).
- **Campos Principais**: `id`, `organization_id`, `candidate_id`, `storage_path`, `original_filename`, `mime_type`, `file_size_bytes` (limite de 15MB), `sha256`, `source_type`, `source_mailbox`, `source_message_id`, `received_at`, `parser_status` (`pending`, `parsed`, `failed`, `unsupported`), `parsed_at`, `extraction_metadata`, `is_current`.
- **Integridade Declarativa**:
  - `FOREIGN KEY (organization_id, candidate_id) REFERENCES vertice_candidates(organization_id, id) ON DELETE CASCADE`.
  - Constraint `UNIQUE (organization_id, candidate_id, id)` que permite validação composta em aplicações seletivas.
  - Constraint `UNIQUE (candidate_id, sha256)` impedindo duplicatas exatas de arquivo para o mesmo candidato.
  - Partial unique index `UNIQUE (organization_id, candidate_id) WHERE is_current = true`, garantindo atomicamente no máximo um currículo atual por candidato.
- **RPC Transacional de Troca de Currículo**: Função Postgres `public.fn_register_candidate_resume(...)` que realiza `SELECT ... FROM vertice_candidates FOR UPDATE`, desmarca currículos vigentes anteriores e insere o novo como `is_current = true` em uma única transação atômica.

### 1.5 `vertice_job_openings`
Posições abertas vinculadas a empresas clientes B2B.
- **Campos Principais**: `id`, `organization_id`, `client_company_id`, `title`, `department`, `location`, `city`, `state`, `work_model`, `employment_type`, `description`, `requirements`, `responsibilities`, `salary_min`, `salary_max`, `benefits`, `openings_count`, `priority`, `recruiter_id`, `status` (`draft`, `open`, `paused`, `closed`, `cancelled`), `opened_at`, `closing_date`, `closed_at`.
- **Integridade Declarativa**:
  - `FOREIGN KEY (organization_id, client_company_id) REFERENCES client_companies(organization_id, id) ON DELETE RESTRICT`.
  - Constraint `UNIQUE (organization_id, id)`.

### 1.6 `vertice_job_applications`
Vínculo entre um candidato e uma vaga em um dos 10 estágios do funil de seleção.
- **Campos Principais**: `id`, `organization_id`, `job_opening_id`, `candidate_id`, `resume_id` (nullable), `stage`, `source`, `recruiter_id`, `rejection_reason`, `notes`, `stage_changed_at`.
- **Integridade Declarativa**:
  - `FOREIGN KEY (organization_id, job_opening_id) REFERENCES vertice_job_openings(organization_id, id) ON DELETE CASCADE`.
  - `FOREIGN KEY (organization_id, candidate_id) REFERENCES vertice_candidates(organization_id, id) ON DELETE CASCADE`.
  - `FOREIGN KEY (organization_id, candidate_id, resume_id) REFERENCES vertice_candidate_resumes(organization_id, candidate_id, id) ON DELETE SET NULL`. Esta constraint impede categoricamente que uma candidatura receba um currículo pertencente a outro candidato ou outro tenant.
  - Constraint `UNIQUE (job_opening_id, candidate_id)`.
- **Gatilhos de Invariante de Negócio**:
  - `trg_prevent_application_identity_change`: Impede mutação de `job_opening_id` ou `candidate_id` em updates comuns da aplicação.
  - `trg_check_job_is_open_on_application`: Impede inserção de candidatura caso o status da vaga seja diferente de `open` (bloqueia `draft`, `paused`, `closed`, `cancelled`).

---

## 2. Automação Reativa de Status do Candidato

A função `public.fn_sync_candidate_status_from_applications()` sincroniza o status do candidato de acordo com suas candidaturas ativas no tenant:
1. Se qualquer candidatura for marcada como `approved` → candidato atualiza para `hired`.
2. Se possuir ao menos uma candidatura em estágio ativo (`received` até `finalist`) e não estiver `hired`, `inactive` ou `do_not_contact` → candidato atualiza para `in_process`.
3. Se todas as candidaturas ativas forem finalizadas (`rejected` ou `withdrawn`) ou deletadas e o candidato estava `in_process` ou `hired` (quando a vaga aprovada foi removida/alterada) → status recalcula coerentemente para `active`.
4. **Proteção Imutável de Governança**: Candidatos marcados manualmente como `inactive` ou `do_not_contact` **NUNCA** têm seu status sobrescrito por automação de candidaturas.
5. **Segurança de Tenant**: Todos os updates internos da função utilizam estritamente `WHERE id = target_candidate_id AND organization_id = target_org_id`.
