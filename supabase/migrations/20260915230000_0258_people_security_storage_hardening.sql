-- 0258_people_security_storage_hardening
-- Fecha a superfÃ­cie SECURITY DEFINER da People Foundation e torna o cleanup
-- de Storage dependente de um object key Ãºnico por tentativa de upload.

-- Esta migration nÃ£o deixa estado de claim/lease permanente. O key Ãºnico Ã©
-- gerado no backend e sÃ³ o fluxo server-side conhece o objeto criado pelo
-- request; Candidate + SHA continua sendo a identidade lÃ³gica deduplicada.
drop policy if exists tenant_delete_unreferenced_candidate_resumes on storage.objects;
drop function if exists public.fn_claim_candidate_resume_cleanup(text, uuid);
drop function if exists public.fn_release_candidate_resume_cleanup(text, uuid);
drop function if exists public.fn_can_delete_candidate_resume_object(text);
drop table if exists public.vertice_resume_cleanup_claims cascade;

-- A RPC permanece SECURITY DEFINER porque precisa promover/demitir versÃµes na
-- mesma transaÃ§Ã£o. A autorizaÃ§Ã£o pertence Ã prÃ³pria funÃ§Ã£o, nÃ£o Ã rota HTTP.
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
set search_path = public, pg_temp
as $$
declare
  v_existing_id uuid;
  v_existing_path text;
  v_extension text;
  v_expected_prefix text;
  v_new_resume public.vertice_candidate_resumes%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not public.fn_role_at_least(p_org_id, 'agent') then
    raise exception 'Insufficient role for organization'
      using errcode = '42501';
  end if;

  perform 1
    from public.vertice_candidates
   where id = p_candidate_id
     and organization_id = p_org_id
   for update;

  if not found then
    raise exception 'Candidate not found in organization'
      using errcode = 'P0002';
  end if;

  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid SHA-256'
      using errcode = '22023';
  end if;

  if p_file_size_bytes is null or p_file_size_bytes <= 0 or p_file_size_bytes > 15728640 then
    raise exception 'Invalid resume size'
      using errcode = '22023';
  end if;

  v_extension := case p_mime_type
    when 'application/pdf' then 'pdf'
    when 'application/msword' then 'doc'
    when 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' then 'docx'
    else null
  end;

  if v_extension is null then
    raise exception 'Invalid resume MIME type'
      using errcode = '22023';
  end if;

  if nullif(btrim(p_original_filename), '') is null
     or lower(p_original_filename) !~ ('[.]' || v_extension || '$') then
    raise exception 'Invalid original filename'
      using errcode = '22023';
  end if;

  select id, storage_path
    into v_existing_id, v_existing_path
    from public.vertice_candidate_resumes
   where organization_id = p_org_id
     and candidate_id = p_candidate_id
     and sha256 = p_sha256
   limit 1;

  v_expected_prefix := p_org_id::text || '/' || p_candidate_id::text || '/';
  if p_storage_path is null
     or (
       p_storage_path <> coalesce(v_existing_path, '')
       and p_storage_path !~ (
         '^' || v_expected_prefix ||
         '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]' ||
         v_extension || '$'
       )
     ) then
    raise exception 'Invalid resume storage path'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
      from storage.objects o
     where o.bucket_id = 'candidate-resumes'
       and o.name = p_storage_path
  ) then
    raise exception 'Resume object not found in storage'
      using errcode = 'P0002';
  end if;

  if v_existing_id is not null then
    update public.vertice_candidate_resumes
       set is_current = false,
           updated_at = now()
     where organization_id = p_org_id
       and candidate_id = p_candidate_id
       and id <> v_existing_id
       and is_current = true;

    update public.vertice_candidate_resumes
       set is_current = true,
           updated_at = now()
     where organization_id = p_org_id
       and candidate_id = p_candidate_id
       and id = v_existing_id
    returning * into v_new_resume;

    return jsonb_build_object('resume', to_jsonb(v_new_resume), 'deduplicated', true);
  end if;

  update public.vertice_candidate_resumes
     set is_current = false,
         updated_at = now()
   where organization_id = p_org_id
     and candidate_id = p_candidate_id
     and is_current = true;

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

revoke execute on function public.fn_register_candidate_resume(uuid, uuid, text, text, text, bigint, text, text, text, text)
  from public, anon, service_role;
grant execute on function public.fn_register_candidate_resume(uuid, uuid, text, text, text, bigint, text, text, text, text)
  to authenticated;

-- Um objeto fÃ­sico tem uma tentativa Ãºnica, mesmo quando o SHA Ã© igual.
create unique index if not exists vertice_candidate_resumes_storage_path_key
  on public.vertice_candidate_resumes (storage_path);

-- FunÃ§Ãµes de trigger nÃ£o sÃ£o endpoints.
alter function public.fn_check_job_is_open_on_application() set search_path = public, pg_temp;
alter function public.fn_ensure_candidate_contact_same_org() set search_path = public, pg_temp;
alter function public.fn_ensure_client_company_contact_same_org() set search_path = public, pg_temp;
alter function public.fn_prevent_application_identity_change() set search_path = public, pg_temp;
alter function public.fn_sync_candidate_status_from_applications() set search_path = public, pg_temp;

revoke execute on function public.fn_check_job_is_open_on_application() from public, anon, authenticated;
revoke execute on function public.fn_ensure_candidate_contact_same_org() from public, anon, authenticated;
revoke execute on function public.fn_ensure_client_company_contact_same_org() from public, anon, authenticated;
revoke execute on function public.fn_prevent_application_identity_change() from public, anon, authenticated;
revoke execute on function public.fn_sync_candidate_status_from_applications() from public, anon, authenticated;

grant execute on function public.fn_check_job_is_open_on_application() to service_role;
grant execute on function public.fn_ensure_candidate_contact_same_org() to service_role;
grant execute on function public.fn_ensure_client_company_contact_same_org() to service_role;
grant execute on function public.fn_prevent_application_identity_change() to service_role;
grant execute on function public.fn_sync_candidate_status_from_applications() to service_role;

-- Metadata de currÃ­culo sÃ³ nasce/muda pela RPC endurecida; a sessÃ£o pode ler.
revoke insert, update, delete on public.vertice_candidate_resumes from authenticated;
grant select on public.vertice_candidate_resumes to authenticated;

-- O bucket nÃ£o oferece DELETE ao cliente. O cleanup server-side usa o key Ãºnico
-- que acabou de gerar e valida tenant, candidato e ausÃªncia de referÃªncia antes
-- de chamar o Storage com o client administrativo.
revoke delete on storage.objects from authenticated;
revoke update on storage.objects from authenticated;
alter table storage.objects enable row level security;
drop policy if exists tenant_delete_unreferenced_candidate_resumes on storage.objects;

drop policy if exists tenant_insert_candidate_resumes on storage.objects;
create policy tenant_insert_candidate_resumes on storage.objects for insert
  with check (
    bucket_id = 'candidate-resumes'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](pdf|doc|docx)$'
    and exists (
      select 1
        from public.user_organizations uo
       where uo.user_id = auth.uid()
         and uo.revoked_at is null
         and uo.organization_id::text = split_part(name, '/', 1)
         and public.fn_role_at_least(uo.organization_id, 'agent')
    )
    and exists (
      select 1
        from public.vertice_candidates c
       where c.organization_id::text = split_part(name, '/', 1)
         and c.id::text = split_part(name, '/', 2)
    )
  );

-- A fila Ã© uma fronteira privilegiada: o worker consome com service_role e
-- apaga o path sem passar pelas policies do bucket.
drop policy if exists tenant_isolation_storage_redaction_queue_all
  on public.storage_redaction_queue;
drop policy if exists tenant_select_storage_redaction_queue
  on public.storage_redaction_queue;
create policy tenant_select_storage_redaction_queue
  on public.storage_redaction_queue
  for select
  to authenticated
  using (organization_id in (select * from public.fn_user_org_ids()));

revoke insert, update, delete on public.storage_redaction_queue
  from public, anon, authenticated;
grant select on public.storage_redaction_queue to authenticated;
grant all on public.storage_redaction_queue to service_role;

-- O apagamento People fica preso ao contato anonimizado.
create or replace function public.fn_redact_people_on_contact_anonymized()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.storage_redaction_queue (
    organization_id,
    request_id,
    bucket,
    object_path
  )
  select r.organization_id, null, 'candidate-resumes', r.storage_path
    from public.vertice_candidate_resumes r
    join public.vertice_candidates c
      on c.organization_id = r.organization_id
     and c.id = r.candidate_id
   where c.organization_id = new.organization_id
     and c.contact_id = new.id
  on conflict (bucket, object_path) do nothing;

  update public.vertice_job_applications a
     set notes = null,
         rejection_reason = null,
         resume_id = null,
         updated_at = now()
    from public.vertice_candidates c
   where c.organization_id = new.organization_id
     and c.contact_id = new.id
     and a.organization_id = c.organization_id
     and a.candidate_id = c.id;

  delete from public.vertice_candidate_resumes r
  using public.vertice_candidates c
   where c.organization_id = new.organization_id
     and c.contact_id = new.id
     and r.organization_id = c.organization_id
     and r.candidate_id = c.id;

  update public.vertice_candidates
     set full_name = 'Candidato Anonimizado #' || substring(id::text from 1 for 8),
         email = null,
         phone_e164 = null,
         linkedin_url = null,
         city = null,
         state = null,
         current_job_title = null,
         current_company = null,
         area = null,
         seniority = null,
         expected_salary = null,
         availability = null,
         notes = null,
         updated_at = now()
   where organization_id = new.organization_id
     and contact_id = new.id;

  return new;
end;
$$;

revoke execute on function public.fn_redact_people_on_contact_anonymized()
  from public, anon, authenticated;
grant execute on function public.fn_redact_people_on_contact_anonymized()
  to service_role;

drop trigger if exists trg_redact_people_on_contact_anonymized on public.contacts;
create trigger trg_redact_people_on_contact_anonymized
  after update of is_anonymized on public.contacts
  for each row
  when (old.is_anonymized = false and new.is_anonymized = true)
  execute function public.fn_redact_people_on_contact_anonymized();

notify pgrst, 'reload schema';
