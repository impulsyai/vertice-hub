-- 0259_crm_lead_client_company.sql
-- Vértice Hub B2B CRM: Vincula crm_leads diretamente a client_companies
-- com integridade multi-tenant declarativa via Composite Foreign Key (organization_id, client_company_id).

alter table public.crm_leads
  add column if not exists client_company_id uuid references public.client_companies(id) on delete set null;

-- Composite foreign key enforcing same-organization integrity
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'crm_leads_org_company_fk'
  ) then
    alter table public.crm_leads
      add constraint crm_leads_org_company_fk
      foreign key (organization_id, client_company_id)
      references public.client_companies(organization_id, id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_crm_leads_org_client_company
  on public.crm_leads (organization_id, client_company_id)
  where client_company_id is not null;
