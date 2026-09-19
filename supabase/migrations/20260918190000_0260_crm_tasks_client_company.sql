-- 0260: Vínculo B2B direto de tarefas com empresas clientes (client_companies)
-- Permite associar uma tarefa comercial a uma empresa cliente (client_companies),
-- com chave estrangeira composta para garantia de isolamento multi-tenant.

alter table public.crm_tasks
  add column if not exists client_company_id uuid references public.client_companies(id) on delete set null;

-- Garante que crm_tasks só aponte para client_companies da mesma organização
alter table public.crm_tasks
  drop constraint if exists crm_tasks_org_company_fk;

alter table public.crm_tasks
  add constraint crm_tasks_org_company_fk
  foreign key (organization_id, client_company_id)
  references public.client_companies(organization_id, id)
  on delete set null;

-- Índices para consultas por organização e empresa / contato / responsável
create index if not exists idx_crm_tasks_org_client_company
  on public.crm_tasks (organization_id, client_company_id)
  where client_company_id is not null;

create index if not exists idx_crm_tasks_org_contact
  on public.crm_tasks (organization_id, contact_id)
  where contact_id is not null;

create index if not exists idx_crm_tasks_org_assigned
  on public.crm_tasks (organization_id, assigned_to)
  where assigned_to is not null;
