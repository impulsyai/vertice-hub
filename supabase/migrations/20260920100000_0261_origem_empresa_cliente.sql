-- 0261: Origem persistida das empresas clientes
-- Mantém a procedência separada de observações livres para a UI e relatórios.

alter table public.client_companies
  add column if not exists source text not null default 'manual';

-- Empresas já recebidas pelo formulário B2B do site têm esta marca no histórico.
update public.client_companies
set source = 'site_b2b'
where source = 'manual'
  and notes ilike '%[Site B2B]%';

notify pgrst, 'reload schema';
