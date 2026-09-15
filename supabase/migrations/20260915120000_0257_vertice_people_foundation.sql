-- ============================================================================
-- 0257 — VÉRTICE PEOPLE FOUNDATION
--
-- Domínio vertical de Recrutamento & Seleção (R&S) e Empresas B2B para o
-- Vértice Hub (impulsyai/vertice-hub).
--
-- Entidades:
--   - client_companies: Empresas clientes B2B (Tramontina, Petribu, ACLF, etc.)
--   - client_company_contacts: Vínculo N:N contatos upstream ↔ empresas B2B
--   - vertice_candidates: Banco permanente de talentos com identidade omnichannel
--   - vertice_candidate_resumes: Versões de currículos em bucket privado
--   - vertice_job_openings: Vagas abertas para empresas B2B
--   - vertice_job_applications: Candidaturas no pipeline R&S de 10 estágios
--
-- Doutrina Deskcomm:
--   - organization_id NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
--   - RLS ativa em todas as tabelas (leitura tenant-aware; escrita a partir de agent)
--   - REVOKE ALL FROM anon explícito em todas as tabelas
--   - Gatilho reativo de sincronização de status do candidato
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

  constraint client_company_contacts_unique unique (client_company_id, contact_id)
);

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

  current_role text,
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

  constraint vertice_candidates_name_not_empty check (length(btrim(full_name)) > 0),
  constraint vertice_candidates_status_check check (status in ('active', 'in_process', 'hired', 'inactive', 'do_not_contact')),
  constraint vertice_candidates_email_format check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint vertice_candidates_phone_format check (phone_e164 is null or phone_e164 ~ '^\+\d{8,15}$')
);

create index if not exists vertice_candidates_org_status_idx
  on public.vertice_candidates (organization_id, status);

create index if not exists vertice_candidates_org_email_norm_idx
  on public.vertice_candidates (organization_id, email_normalized)
  where email_normalized is not null;

create index if not exists vertice_candidates_org_phone_idx
  on public.vertice_candidates (organization_id, phone_e164)
  where phone_e164 is not null;

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

  constraint vertice_resumes_file_size_limit check (file_size_bytes > 0 and file_size_bytes <= 15728640),
  constraint vertice_resumes_parser_status_check check (parser_status in ('pending', 'parsed', 'failed', 'unsupported')),
  constraint vertice_resumes_candidate_sha_unique unique (candidate_id, sha256)
);

create index if not exists vertice_resumes_candidate_idx
  on public.vertice_candidate_resumes (candidate_id);

create unique index if not exists vertice_resumes_one_current
  on public.vertice_candidate_resumes (candidate_id)
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
-- 8. AUTOMAÇÃO DE STATUS DO CANDIDATO
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_sync_candidate_status_from_applications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cand_id uuid;
  v_current_status text;
  v_has_approved boolean;
  v_has_active boolean;
begin
  v_cand_id := coalesce(new.candidate_id, old.candidate_id);
  if v_cand_id is null then
    return coalesce(new, old);
  end if;

  select status into v_current_status from public.vertice_candidates where id = v_cand_id;
  if not found or v_current_status in ('inactive', 'do_not_contact') then
    return coalesce(new, old);
  end if;

  -- 1. Se tem candidatura aprovada em qualquer vaga
  select exists (
    select 1 from public.vertice_job_applications
    where candidate_id = v_cand_id and stage = 'approved'
  ) into v_has_approved;

  if v_has_approved then
    update public.vertice_candidates
    set status = 'hired', updated_at = now()
    where id = v_cand_id and status <> 'hired';
    return coalesce(new, old);
  end if;

  -- 2. Se tem candidatura em estágio ativo (received até finalist)
  select exists (
    select 1 from public.vertice_job_applications
    where candidate_id = v_cand_id
      and stage in ('received', 'screening', 'vertice_interview', 'assessment', 'shortlist', 'client_interview', 'finalist')
  ) into v_has_active;

  if v_has_active then
    update public.vertice_candidates
    set status = 'in_process', updated_at = now()
    where id = v_cand_id and status <> 'in_process';
  else
    -- Se não tem aprovada nem ativa, e estava 'in_process', volta para 'active'
    if v_current_status = 'in_process' then
      update public.vertice_candidates
      set status = 'active', updated_at = now()
      where id = v_cand_id;
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_candidate_status_on_application on public.vertice_job_applications;
create trigger trg_sync_candidate_status_on_application
  after insert or update or delete on public.vertice_job_applications
  for each row execute function public.fn_sync_candidate_status_from_applications();
