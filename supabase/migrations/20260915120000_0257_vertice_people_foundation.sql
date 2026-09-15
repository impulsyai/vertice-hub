-- ============================================================================
-- 0257 — VÉRTICE PEOPLE FOUNDATION (HARDENED)
--
-- Domínio vertical de Recrutamento & Seleção (R&S) e Empresas B2B para o
-- Vértice Hub (impulsyai/vertice-hub).
--
-- Entidades:
--   - client_companies: Empresas clientes B2B (Tramontina, Petribu, ACLF, etc.)
--   - client_company_contacts: Vínculo N:N contatos upstream ↔ empresas B2B (Same-Org FK + Trigger)
--   - vertice_candidates: Banco permanente de talentos com identidade omnichannel (sem CPF, current_job_title)
--   - vertice_candidate_resumes: Versões de currículos em bucket privado (troca atômica via RPC)
--   - vertice_job_openings: Vagas abertas para empresas B2B (Same-Org FK)
--   - vertice_job_applications: Candidaturas no pipeline R&S de 10 estágios (Same-Org & Candidate-Resume FKs)
--
-- Doutrina Deskcomm & Hardening:
--   - organization_id NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
--   - Integridade declarativa same-organization via Foreign Keys compostas (organization_id, id)
--   - RLS ativa em todas as tabelas (leitura tenant-aware; escrita a partir de agent)
--   - REVOKE ALL FROM anon explícito em todas as tabelas e funções
--   - Automação reativa e transacional de status do candidato imune a cross-tenant
--   - Função RPC atômica fn_register_candidate_resume com row-level lock para concorrência
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CLIENT COMPANIES (Empresas B2B Clientes da Consultoria)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.client_companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  legal_name text not null,
  trade_name text,
  cnpj text,
  industry text,
  website text,
  city text,
  state text,
  status text not null default 'active',

  owner_user_id uuid references auth.users(id) on delete set null,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint client_companies_org_id_key unique (organization_id, id),
  constraint client_companies_legal_name_not_empty check (length(btrim(legal_name)) > 0),
  constraint client_companies_status_check check (status in ('active', 'prospect', 'inactive'))
);

create index if not exists client_companies_org_status_idx
  on public.client_companies (organization_id, status);

create index if not exists client_companies_org_name_idx
  on public.client_companies (organization_id, legal_name);

alter table public.client_companies enable row level security;

drop policy if exists client_companies_select on public.client_companies;
create policy client_companies_select on public.client_companies
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );

drop policy if exists client_companies_write on public.client_companies;
create policy client_companies_write on public.client_companies
  using (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'agent'))
  )
  with check (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'agent'))
  );

revoke all on public.client_companies from anon;
grant select, insert, update, delete on public.client_companies to authenticated;
grant all on public.client_companies to service_role;

drop trigger if exists trg_client_companies_updated_at on public.client_companies;
create trigger trg_client_companies_updated_at
  before update on public.client_companies
  for each row execute function public.fn_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CLIENT COMPANY CONTACTS (Vínculo Contato Upstream ↔ Empresa B2B)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.client_company_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  client_company_id uuid not null references public.client_companies(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,

  role_in_company text,
  is_primary boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint client_company_contacts_unique unique (client_company_id, contact_id),
  constraint client_company_contacts_org_company_fk
    foreign key (organization_id, client_company_id)
    references public.client_companies(organization_id, id)
    on delete cascade
);

-- Trigger de integridade: garante que contact_id pertence rigorosamente à mesma organização
create or replace function public.fn_ensure_client_company_contact_same_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.contacts
    where id = new.contact_id and organization_id = new.organization_id
  ) then
    raise exception 'Cross-tenant violation: contact % does not belong to organization %', new.contact_id, new.organization_id
      using errcode = '23503';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_client_company_contacts_same_org on public.client_company_contacts;
create trigger trg_client_company_contacts_same_org
  before insert or update on public.client_company_contacts
  for each row execute function public.fn_ensure_client_company_contact_same_org();

create index if not exists client_company_contacts_org_idx
  on public.client_company_contacts (organization_id);

create index if not exists client_company_contacts_contact_idx
  on public.client_company_contacts (contact_id);

alter table public.client_company_contacts enable row level security;

drop policy if exists client_company_contacts_select on public.client_company_contacts;
create policy client_company_contacts_select on public.client_company_contacts
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );

drop policy if exists client_company_contacts_write on public.client_company_contacts;
create policy client_company_contacts_write on public.client_company_contacts
  using (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'agent'))
  )
  with check (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'agent'))
  );

revoke all on public.client_company_contacts from anon;
grant select, insert, update, delete on public.client_company_contacts to authenticated;
grant all on public.client_company_contacts to service_role;

drop trigger if exists trg_client_company_contacts_updated_at on public.client_company_contacts;
create trigger trg_client_company_contacts_updated_at
  before update on public.client_company_contacts
  for each row execute function public.fn_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. VERTICE CANDIDATES (Banco Permanente de Talentos)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.vertice_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  -- Vínculo opcional com identidade/comunicação de contacts (WhatsApp/Inbox)
  contact_id uuid references public.contacts(id) on delete set null,

  full_name text not null,
  email text,
  email_normalized text generated always as (lower(trim(email))) stored,
  phone_e164 text,
  linkedin_url text,

  city text,
  state text,

  -- current_job_title substitui current_role (evitando conflito com palavra reservada do PostgreSQL)
  current_job_title text,
  current_company text,
  area text,
  seniority text,

  expected_salary numeric,
  availability text,

  status text not null default 'active',
  source text not null default 'manual',
  owner_user_id uuid references auth.users(id) on delete set null,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint vertice_candidates_org_id_key unique (organization_id, id),
  constraint vertice_candidates_name_not_empty check (length(btrim(full_name)) > 0),
  constraint vertice_candidates_status_check check (status in ('active', 'in_process', 'hired', 'inactive', 'do_not_contact')),
  constraint vertice_candidates_email_format check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint vertice_candidates_phone_format check (phone_e164 is null or phone_e164 ~ '^\+\d{8,15}$')
);

-- Trigger de integridade: se contact_id for fornecido, deve pertencer à mesma organização
create or replace function public.fn_ensure_candidate_contact_same_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.contact_id is not null then
    if not exists (
      select 1 from public.contacts
      where id = new.contact_id and organization_id = new.organization_id
    ) then
      raise exception 'Cross-tenant violation: contact % does not belong to organization %', new.contact_id, new.organization_id
        using errcode = '23503';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_candidate_contact_same_org on public.vertice_candidates;
create trigger trg_candidate_contact_same_org
  before insert or update on public.vertice_candidates
  for each row execute function public.fn_ensure_candidate_contact_same_org();

create index if not exists vertice_candidates_org_status_idx
  on public.vertice_candidates (organization_id, status);

-- Índices parciais únicos para deduplicação concorrente segura (Race-Safe Deduplication)
create unique index if not exists vertice_candidates_org_email_norm_uidx
  on public.vertice_candidates (organization_id, email_normalized)
  where email_normalized is not null;

create unique index if not exists vertice_candidates_org_phone_uidx
  on public.vertice_candidates (organization_id, phone_e164)
  where phone_e164 is not null;

create unique index if not exists vertice_candidates_org_contact_uidx
  on public.vertice_candidates (organization_id, contact_id)
  where contact_id is not null;

create index if not exists vertice_candidates_org_area_seniority_idx
  on public.vertice_candidates (organization_id, area, seniority);

alter table public.vertice_candidates enable row level security;

drop policy if exists vertice_candidates_select on public.vertice_candidates;
create policy vertice_candidates_select on public.vertice_candidates
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );

drop policy if exists vertice_candidates_write on public.vertice_candidates;
create policy vertice_candidates_write on public.vertice_candidates
  using (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'agent'))
  )
  with check (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'agent'))
  );

revoke all on public.vertice_candidates from anon;
grant select, insert, update, delete on public.vertice_candidates to authenticated;
grant all on public.vertice_candidates to service_role;

drop trigger if exists trg_vertice_candidates_updated_at on public.vertice_candidates;
create trigger trg_vertice_candidates_updated_at
  before update on public.vertice_candidates
  for each row execute function public.fn_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. VERTICE CANDIDATE RESUMES (Histórico e Versões de Currículos)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.vertice_candidate_resumes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid not null references public.vertice_candidates(id) on delete cascade,

  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  sha256 text not null,

  source_type text not null default 'manual',
  source_mailbox text,
  source_message_id text,
  received_at timestamptz not null default now(),

  parser_status text not null default 'pending',
  parsed_at timestamptz,
  extraction_metadata jsonb not null default '{}'::jsonb,

  is_current boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint vertice_candidate_resumes_org_cand_fk
    foreign key (organization_id, candidate_id)
    references public.vertice_candidates(organization_id, id)
    on delete cascade,

  constraint vertice_candidate_resumes_org_cand_id_key unique (organization_id, candidate_id, id),
  constraint vertice_candidate_resumes_org_id_key unique (organization_id, id),

  constraint vertice_resumes_file_size_limit check (file_size_bytes > 0 and file_size_bytes <= 15728640),
  constraint vertice_resumes_parser_status_check check (parser_status in ('pending', 'parsed', 'failed', 'unsupported')),
  constraint vertice_resumes_candidate_sha_unique unique (candidate_id, sha256)
);

create index if not exists vertice_resumes_candidate_idx
  on public.vertice_candidate_resumes (candidate_id);

-- Invariante: no máximo 1 currículo marcado como is_current = true por candidato
create unique index if not exists vertice_resumes_one_current
  on public.vertice_candidate_resumes (organization_id, candidate_id)
  where is_current = true;

alter table public.vertice_candidate_resumes enable row level security;

drop policy if exists vertice_candidate_resumes_select on public.vertice_candidate_resumes;
create policy vertice_candidate_resumes_select on public.vertice_candidate_resumes
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );

drop policy if exists vertice_candidate_resumes_write on public.vertice_candidate_resumes;
create policy vertice_candidate_resumes_write on public.vertice_candidate_resumes
  using (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'agent'))
  )
  with check (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'agent'))
  );

revoke all on public.vertice_candidate_resumes from anon;
grant select, insert, update, delete on public.vertice_candidate_resumes to authenticated;
grant all on public.vertice_candidate_resumes to service_role;

drop trigger if exists trg_vertice_candidate_resumes_updated_at on public.vertice_candidate_resumes;
create trigger trg_vertice_candidate_resumes_updated_at
  before update on public.vertice_candidate_resumes
  for each row execute function public.fn_set_updated_at();

-- RPC para Registro Atômico e Concorrente de Currículo
create or replace function public.fn_register_candidate_resume(
  p_org_id uuid,
  p_candidate_id uuid,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_sha256 text,
  p_source_type text default 'manual',
  p_source_mailbox text default null,
  p_source_message_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cand record;
  v_existing_id uuid;
  v_new_resume record;
begin
  -- 1. Lock candidate row to serialize concurrent uploads for the same candidate
  select id, organization_id into v_cand
  from public.vertice_candidates
  where id = p_candidate_id and organization_id = p_org_id
  for update;

  if not found then
    raise exception 'Candidate % not found in organization %', p_candidate_id, p_org_id
      using errcode = 'P0002';
  end if;

  -- 2. Check for existing identical resume by SHA-256 for this candidate
  select id into v_existing_id
  from public.vertice_candidate_resumes
  where organization_id = p_org_id
    and candidate_id = p_candidate_id
    and sha256 = p_sha256
  limit 1;

  if v_existing_id is not null then
    -- Already uploaded! Promote it to is_current atomically and demote others
    update public.vertice_candidate_resumes
    set is_current = false, updated_at = now()
    where organization_id = p_org_id
      and candidate_id = p_candidate_id
      and id <> v_existing_id
      and is_current = true;

    update public.vertice_candidate_resumes
    set is_current = true, updated_at = now()
    where id = v_existing_id
    returning * into v_new_resume;

    return jsonb_build_object('resume', to_jsonb(v_new_resume), 'deduplicated', true);
  end if;

  -- 3. Demote prior current resumes for this candidate
  update public.vertice_candidate_resumes
  set is_current = false, updated_at = now()
  where organization_id = p_org_id
    and candidate_id = p_candidate_id
    and is_current = true;

  -- 4. Insert new current resume
  insert into public.vertice_candidate_resumes (
    organization_id,
    candidate_id,
    storage_path,
    original_filename,
    mime_type,
    file_size_bytes,
    sha256,
    source_type,
    source_mailbox,
    source_message_id,
    is_current
  ) values (
    p_org_id,
    p_candidate_id,
    p_storage_path,
    p_original_filename,
    p_mime_type,
    p_file_size_bytes,
    p_sha256,
    coalesce(p_source_type, 'manual'),
    p_source_mailbox,
    p_source_message_id,
    true
  )
  returning * into v_new_resume;

  return jsonb_build_object('resume', to_jsonb(v_new_resume), 'deduplicated', false);
end;
$$;

revoke execute on function public.fn_register_candidate_resume(uuid, uuid, text, text, text, bigint, text, text, text, text) from public, anon;
grant execute on function public.fn_register_candidate_resume(uuid, uuid, text, text, text, bigint, text, text, text, text) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. STORAGE BUCKET PRIVADO: candidate-resumes
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'candidate-resumes',
  'candidate-resumes',
  false,
  15728640,
  array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

drop policy if exists tenant_read_candidate_resumes on storage.objects;
create policy tenant_read_candidate_resumes on storage.objects for select
  using (
    bucket_id = 'candidate-resumes'
    and exists (
      select 1 from public.user_organizations uo
      where uo.user_id = auth.uid()
        and uo.revoked_at is null
        and uo.organization_id = (split_part(name, '/', 1))::uuid
    )
  );

drop policy if exists tenant_insert_candidate_resumes on storage.objects;
create policy tenant_insert_candidate_resumes on storage.objects for insert
  with check (
    bucket_id = 'candidate-resumes'
    and exists (
      select 1 from public.user_organizations uo
      where uo.user_id = auth.uid()
        and uo.revoked_at is null
        and uo.organization_id = (split_part(name, '/', 1))::uuid
        and public.fn_role_at_least(uo.organization_id, 'agent')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. VERTICE JOB OPENINGS (Vagas Abertas para Empresas B2B)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.vertice_job_openings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_company_id uuid not null references public.client_companies(id) on delete cascade,

  title text not null,
  department text,
  location text,
  city text,
  state text,

  work_model text not null default 'presential',
  employment_type text not null default 'clt',

  description text,
  requirements text,
  responsibilities text,

  salary_min numeric,
  salary_max numeric,
  benefits text,

  openings_count int not null default 1,
  priority text not null default 'medium',

  recruiter_id uuid references auth.users(id) on delete set null,
  status text not null default 'draft',

  opened_at timestamptz,
  closing_date date,
  closed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint vertice_job_openings_org_company_fk
    foreign key (organization_id, client_company_id)
    references public.client_companies(organization_id, id)
    on delete cascade,

  constraint vertice_job_openings_org_id_key unique (organization_id, id),

  constraint vertice_jobs_title_not_empty check (length(btrim(title)) > 0),
  constraint vertice_jobs_status_check check (status in ('draft', 'open', 'paused', 'closed', 'cancelled')),
  constraint vertice_jobs_work_model_check check (work_model in ('presential', 'hybrid', 'remote')),
  constraint vertice_jobs_employment_type_check check (employment_type in ('clt', 'pj', 'internship', 'temporary')),
  constraint vertice_jobs_priority_check check (priority in ('low', 'medium', 'high', 'urgent')),
  constraint vertice_jobs_openings_count_check check (openings_count > 0)
);

create index if not exists vertice_jobs_org_status_idx
  on public.vertice_job_openings (organization_id, status);

create index if not exists vertice_jobs_org_company_idx
  on public.vertice_job_openings (organization_id, client_company_id);

alter table public.vertice_job_openings enable row level security;

drop policy if exists vertice_job_openings_select on public.vertice_job_openings;
create policy vertice_job_openings_select on public.vertice_job_openings
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );

drop policy if exists vertice_job_openings_write on public.vertice_job_openings;
create policy vertice_job_openings_write on public.vertice_job_openings
  using (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'agent'))
  )
  with check (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'agent'))
  );

revoke all on public.vertice_job_openings from anon;
grant select, insert, update, delete on public.vertice_job_openings to authenticated;
grant all on public.vertice_job_openings to service_role;

drop trigger if exists trg_vertice_job_openings_updated_at on public.vertice_job_openings;
create trigger trg_vertice_job_openings_updated_at
  before update on public.vertice_job_openings
  for each row execute function public.fn_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. VERTICE JOB APPLICATIONS (Candidaturas no Pipeline R&S de 10 Estágios)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.vertice_job_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  job_opening_id uuid not null references public.vertice_job_openings(id) on delete cascade,
  candidate_id uuid not null references public.vertice_candidates(id) on delete cascade,
  resume_id uuid references public.vertice_candidate_resumes(id) on delete set null,

  stage text not null default 'received',
  source text not null default 'manual',
  recruiter_id uuid references auth.users(id) on delete set null,

  rejection_reason text,
  notes text,

  stage_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint vertice_job_applications_unique unique (job_opening_id, candidate_id),

  -- Same-Org FKs
  constraint vertice_applications_org_job_fk
    foreign key (organization_id, job_opening_id)
    references public.vertice_job_openings(organization_id, id)
    on delete cascade,

  constraint vertice_applications_org_cand_fk
    foreign key (organization_id, candidate_id)
    references public.vertice_candidates(organization_id, id)
    on delete cascade,

  -- Same-Org E Same-Candidate FK para Resume (bloqueia resume de outro candidato/org no DB!)
  constraint vertice_applications_org_cand_resume_fk
    foreign key (organization_id, candidate_id, resume_id)
    references public.vertice_candidate_resumes(organization_id, candidate_id, id)
    on delete set null,

  constraint vertice_job_applications_stage_check check (
    stage in (
      'received',
      'screening',
      'vertice_interview',
      'assessment',
      'shortlist',
      'client_interview',
      'finalist',
      'approved',
      'rejected',
      'withdrawn'
    )
  )
);

-- Imutabilidade de Identidade da Candidatura: (organization_id, candidate_id, job_opening_id) não mudam
create or replace function public.fn_prevent_application_identity_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.candidate_id <> old.candidate_id or new.job_opening_id <> old.job_opening_id or new.organization_id <> old.organization_id then
    raise exception 'Application identity (organization_id, candidate_id, job_opening_id) is immutable'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_application_identity_change on public.vertice_job_applications;
create trigger trg_prevent_application_identity_change
  before update on public.vertice_job_applications
  for each row execute function public.fn_prevent_application_identity_change();

-- Regra de Abertura da Vaga: Criação de candidatura SOMENTE em vaga com status 'open'
create or replace function public.fn_check_job_is_open_on_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_status text;
begin
  select status into v_job_status
  from public.vertice_job_openings
  where id = new.job_opening_id and organization_id = new.organization_id;

  if v_job_status is distinct from 'open' then
    raise exception 'Applications can only be created for open job openings (status is %)', coalesce(v_job_status, 'not found')
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_job_is_open_on_application on public.vertice_job_applications;
create trigger trg_check_job_is_open_on_application
  before insert on public.vertice_job_applications
  for each row execute function public.fn_check_job_is_open_on_application();

create index if not exists vertice_applications_org_job_stage_idx
  on public.vertice_job_applications (organization_id, job_opening_id, stage);

create index if not exists vertice_applications_candidate_idx
  on public.vertice_job_applications (candidate_id);

alter table public.vertice_job_applications enable row level security;

drop policy if exists vertice_job_applications_select on public.vertice_job_applications;
create policy vertice_job_applications_select on public.vertice_job_applications
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );

drop policy if exists vertice_job_applications_write on public.vertice_job_applications;
create policy vertice_job_applications_write on public.vertice_job_applications
  using (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'agent'))
  )
  with check (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'agent'))
  );

revoke all on public.vertice_job_applications from anon;
grant select, insert, update, delete on public.vertice_job_applications to authenticated;
grant all on public.vertice_job_applications to service_role;

drop trigger if exists trg_vertice_job_applications_updated_at on public.vertice_job_applications;
create trigger trg_vertice_job_applications_updated_at
  before update on public.vertice_job_applications
  for each row execute function public.fn_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. AUTOMAÇÃO DE STATUS DO CANDIDATO (ISOLADA POR ORGANIZAÇÃO)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_sync_candidate_status_from_applications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cand_id uuid;
  v_org_id uuid;
  v_current_status text;
  v_has_approved boolean;
  v_has_active boolean;
begin
  v_cand_id := coalesce(new.candidate_id, old.candidate_id);
  v_org_id := coalesce(new.organization_id, old.organization_id);

  if v_cand_id is null or v_org_id is null then
    return coalesce(new, old);
  end if;

  select status into v_current_status from public.vertice_candidates
  where id = v_cand_id and organization_id = v_org_id;

  if not found or v_current_status in ('inactive', 'do_not_contact') then
    return coalesce(new, old);
  end if;

  -- 1. Se possui alguma candidatura aprovada nesta organização
  select exists (
    select 1 from public.vertice_job_applications
    where candidate_id = v_cand_id
      and organization_id = v_org_id
      and stage = 'approved'
  ) into v_has_approved;

  if v_has_approved then
    update public.vertice_candidates
    set status = 'hired', updated_at = now()
    where id = v_cand_id and organization_id = v_org_id and status <> 'hired';
    return coalesce(new, old);
  end if;

  -- 2. Se possui alguma candidatura em estágio ativo nesta organização
  select exists (
    select 1 from public.vertice_job_applications
    where candidate_id = v_cand_id
      and organization_id = v_org_id
      and stage in ('received', 'screening', 'vertice_interview', 'assessment', 'shortlist', 'client_interview', 'finalist')
  ) into v_has_active;

  if v_has_active then
    update public.vertice_candidates
    set status = 'in_process', updated_at = now()
    where id = v_cand_id and organization_id = v_org_id and status <> 'in_process';
  else
    -- Se estava 'in_process' ou 'hired' e agora não tem mais candidaturas aprovadas nem ativas, volta para 'active'
    if v_current_status in ('in_process', 'hired') then
      update public.vertice_candidates
      set status = 'active', updated_at = now()
      where id = v_cand_id and organization_id = v_org_id and status <> 'active';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_candidate_status_on_application on public.vertice_job_applications;
create trigger trg_sync_candidate_status_on_application
  after insert or update or delete on public.vertice_job_applications
  for each row execute function public.fn_sync_candidate_status_from_applications();
