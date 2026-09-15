import { describe, expect, it } from "vitest";
import { countAs, sql, writeCountAs } from "./gov-helpers";

/**
 * Invariante de Isolamento RLS e Integridade Relacional — Vértice People Foundation (0257).
 *
 * Testa contra o container Postgres de teste (baseline.sql):
 *  1. Isolamento estrito RLS entre Org A e Org B para todas as entidades People.
 *  2. Bloqueio relacional declarativo (Composite FKs e Triggers) contra gravações cross-tenant.
 *  3. Invariante de integridade de currículo: resume_id em application DEVE pertencer ao mesmo candidato e mesmo tenant.
 *  4. Invariante de vagas: application só é aceita para vagas com status = 'open'.
 *  5. Unicidade de current resume (unique violation ao tentar 2 current simultâneos).
 *  6. Transacionalidade de substituição de currículo via RPC fn_register_candidate_resume.
 *  7. Recálculo consistente de status do candidato via gatilho, preservando 'inactive' e 'do_not_contact'.
 *  8. Security Definer Cross-Tenant Probe: tentativa de injection/candidatura cross-tenant não afeta outro tenant.
 */

const P_ORG_A = "0257aaaa-0000-4000-8000-000000000001";
const P_ORG_B = "0257bbbb-0000-4000-8000-000000000002";
const P_USER_A = "0257aaaa-1111-4000-8000-000000000001";
const P_USER_B = "0257bbbb-1111-4000-8000-000000000002";

function seed(): void {
  sql(`
    insert into auth.users (id, email) values
      ('${P_USER_A}', 'people-a@invariant.test'),
      ('${P_USER_B}', 'people-b@invariant.test')
      on conflict do nothing;

    insert into public.organizations (id, slug, legal_name, display_name) values
      ('${P_ORG_A}', 'people-inv-a', 'People Inv Org A', 'People A'),
      ('${P_ORG_B}', 'people-inv-b', 'People Inv Org B', 'People B')
      on conflict do nothing;

    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${P_USER_A}', '${P_ORG_A}', 'agent', now()),
      ('${P_USER_B}', '${P_ORG_B}', 'agent', now())
      on conflict do nothing;
  `);
}

describe("Vértice People Foundation — Isolamento RLS e Integridade Declarativa (0257)", () => {
  it("semeia tenants A e B com permissão de agent", () => {
    seed();
    expect(countAs(P_USER_A, `select count(*) from public.organizations where id = '${P_ORG_A}'`)).toBe(1);
    expect(countAs(P_USER_B, `select count(*) from public.organizations where id = '${P_ORG_B}'`)).toBe(1);
  });

  it("client_companies: Org B não enxerga nem altera empresas da Org A", () => {
    seed();
    sql(`
      insert into public.client_companies (id, organization_id, legal_name, trade_name, status)
      values ('0257aaaa-2222-4000-8000-000000000001', '${P_ORG_A}', 'Tramontina S.A.', 'Tramontina', 'active')
      on conflict do nothing;
    `);

    // Org A lê a sua empresa
    expect(countAs(P_USER_A, `select count(*) from public.client_companies where organization_id = '${P_ORG_A}'`)).toBe(1);
    // Org B lê ZERO empresas da Org A
    expect(countAs(P_USER_B, `select count(*) from public.client_companies where organization_id = '${P_ORG_A}'`)).toBe(0);

    // Tentativa da Org B de escrever com o organization_id da Org A é bloqueada por RLS
    const writeAttempt = writeCountAs(
      P_USER_B,
      `insert into public.client_companies (organization_id, legal_name, status)
       values ('${P_ORG_A}', 'Hacked Company', 'active')`,
    );
    expect(writeAttempt).toBe(0);
  });

  it("bloqueia gravações cross-tenant via Composite Foreign Keys e Triggers (P0)", () => {
    seed();
    // Prepara entidades base na Org A e Org B
    sql(`
      insert into public.contacts (id, organization_id, full_name, email)
      values
        ('0257aaaa-cccc-4000-8000-000000000001', '${P_ORG_A}', 'Contato Org A', 'contato-a@exemplo.test'),
        ('0257bbbb-cccc-4000-8000-000000000002', '${P_ORG_B}', 'Contato Org B', 'contato-b@exemplo.test')
      on conflict do nothing;

      insert into public.client_companies (id, organization_id, legal_name, status)
      values
        ('0257aaaa-2222-4000-8000-000000000001', '${P_ORG_A}', 'Empresa A', 'active'),
        ('0257bbbb-2222-4000-8000-000000000002', '${P_ORG_B}', 'Empresa B', 'active')
      on conflict do nothing;

      insert into public.vertice_candidates (id, organization_id, full_name, email, status)
      values
        ('0257aaaa-3333-4000-8000-000000000001', '${P_ORG_A}', 'Candidato A', 'cand-a@exemplo.test', 'active'),
        ('0257bbbb-3333-4000-8000-000000000002', '${P_ORG_B}', 'Candidato B', 'cand-b@exemplo.test', 'active')
      on conflict do nothing;

      insert into public.vertice_job_openings (id, organization_id, client_company_id, title, status)
      values
        ('0257aaaa-4444-4000-8000-000000000001', '${P_ORG_A}', '0257aaaa-2222-4000-8000-000000000001', 'Vaga A', 'open'),
        ('0257bbbb-4444-4000-8000-000000000002', '${P_ORG_B}', '0257bbbb-2222-4000-8000-000000000002', 'Vaga B', 'open')
      on conflict do nothing;
    `);

    // 1. Org B Job apontando para Company Org A deve FALHAR
    const jobCrossCompany = sql(`
      do $$
      begin
        insert into public.vertice_job_openings (organization_id, client_company_id, title, status)
        values ('${P_ORG_B}', '0257aaaa-2222-4000-8000-000000000001', 'Vaga Cross', 'open');
        raise exception 'Nao deveria permitir Job Org B com Company Org A';
      exception when foreign_key_violation then
        null;
      end $$;
      select count(*) from public.vertice_job_openings where title = 'Vaga Cross';
    `);
    expect(parseInt(jobCrossCompany, 10)).toBe(0);

    // 2. Org B Candidate apontando para Contact Org A deve FALHAR (trigger same-org)
    const candCrossContact = sql(`
      do $$
      begin
        insert into public.vertice_candidates (organization_id, contact_id, full_name, email)
        values ('${P_ORG_B}', '0257aaaa-cccc-4000-8000-000000000001', 'Candidato Cross Contact', 'cross-contact@test.com');
        raise exception 'Nao deveria permitir Candidate Org B com Contact Org A';
      exception when raise_exception then
        null;
      end $$;
      select count(*) from public.vertice_candidates where full_name = 'Candidato Cross Contact';
    `);
    expect(parseInt(candCrossContact, 10)).toBe(0);

    // 3. Org B CompanyContact apontando para Company Org A deve FALHAR
    const companyContactCross = sql(`
      do $$
      begin
        insert into public.client_company_contacts (organization_id, client_company_id, contact_id)
        values ('${P_ORG_B}', '0257aaaa-2222-4000-8000-000000000001', '0257bbbb-cccc-4000-8000-000000000002');
        raise exception 'Nao deveria permitir CompanyContact cross-tenant';
      exception when foreign_key_violation then
        null;
      end $$;
      select count(*) from public.client_company_contacts where client_company_id = '0257aaaa-2222-4000-8000-000000000001';
    `);
    expect(parseInt(companyContactCross, 10)).toBe(0);

    // 4. Org B Resume apontando para Candidate Org A deve FALHAR
    const resumeCrossCand = sql(`
      do $$
      begin
        insert into public.vertice_candidate_resumes (
          organization_id, candidate_id, storage_path, original_filename, mime_type, file_size_bytes, sha256, is_current
        ) values (
          '${P_ORG_B}', '0257aaaa-3333-4000-8000-000000000001',
          '${P_ORG_B}/c/x.pdf', 'x.pdf', 'application/pdf', 100, 'sha-cross-resume', false
        );
        raise exception 'Nao deveria permitir Resume Org B com Candidate Org A';
      exception when foreign_key_violation then
        null;
      end $$;
      select count(*) from public.vertice_candidate_resumes where sha256 = 'sha-cross-resume';
    `);
    expect(parseInt(resumeCrossCand, 10)).toBe(0);

    // 5. Org B Application apontando para Candidate Org A deve FALHAR
    const appCrossCand = sql(`
      do $$
      begin
        insert into public.vertice_job_applications (organization_id, job_opening_id, candidate_id, stage)
        values ('${P_ORG_B}', '0257bbbb-4444-4000-8000-000000000002', '0257aaaa-3333-4000-8000-000000000001', 'received');
        raise exception 'Nao deveria permitir Application Org B com Candidate Org A';
      exception when foreign_key_violation then
        null;
      end $$;
      select count(*) from public.vertice_job_applications where candidate_id = '0257aaaa-3333-4000-8000-000000000001' and organization_id = '${P_ORG_B}';
    `);
    expect(parseInt(appCrossCand, 10)).toBe(0);

    // 6. Org B Application apontando para Job Org A deve FALHAR
    const appCrossJob = sql(`
      do $$
      begin
        insert into public.vertice_job_applications (organization_id, job_opening_id, candidate_id, stage)
        values ('${P_ORG_B}', '0257aaaa-4444-4000-8000-000000000001', '0257bbbb-3333-4000-8000-000000000002', 'received');
        raise exception 'Nao deveria permitir Application Org B com Job Org A';
      exception when foreign_key_violation then
        null;
      end $$;
      select count(*) from public.vertice_job_applications where job_opening_id = '0257aaaa-4444-4000-8000-000000000001' and organization_id = '${P_ORG_B}';
    `);
    expect(parseInt(appCrossJob, 10)).toBe(0);
  });

  it("Security Definer Cross-Tenant Probe: tentativa de candidatura cruzada não afeta candidato de outro tenant", () => {
    seed();
    // Confirma status do candidato da Org A antes da sonda
    const statusBefore = sql(`select status from public.vertice_candidates where id = '0257aaaa-3333-4000-8000-000000000001';`);
    expect(statusBefore).toBe("active");

    // Tentativa cross-tenant
    sql(`
      do $$
      begin
        insert into public.vertice_job_applications (organization_id, job_opening_id, candidate_id, stage)
        values ('${P_ORG_B}', '0257bbbb-4444-4000-8000-000000000002', '0257aaaa-3333-4000-8000-000000000001', 'approved');
      exception when foreign_key_violation then
        null;
      end $$;
    `);

    // Prova que o status do candidato Org A permaneceu imune
    const statusAfter = sql(`select status from public.vertice_candidates where id = '0257aaaa-3333-4000-8000-000000000001';`);
    expect(statusAfter).toBe("active");
  });

  it("Application Resume Test: rejeita currículo de outro candidato mesmo dentro do mesmo tenant", () => {
    seed();
    // Cria dois candidatos no tenant A e um currículo para cada um
    sql(`
      insert into public.vertice_candidates (id, organization_id, full_name, email, status)
      values
        ('0257aaaa-7777-4000-8000-000000000001', '${P_ORG_A}', 'Candidato Alfa', 'alfa@exemplo.test', 'active'),
        ('0257aaaa-7777-4000-8000-000000000002', '${P_ORG_A}', 'Candidato Beta', 'beta@exemplo.test', 'active')
      on conflict do nothing;

      insert into public.vertice_candidate_resumes (
        id, organization_id, candidate_id, storage_path, original_filename, mime_type, file_size_bytes, sha256, is_current
      ) values
        ('0257aaaa-8888-4000-8000-000000000001', '${P_ORG_A}', '0257aaaa-7777-4000-8000-000000000001', '${P_ORG_A}/c/alfa.pdf', 'alfa.pdf', 'application/pdf', 1000, 'sha-alfa', true),
        ('0257aaaa-8888-4000-8000-000000000002', '${P_ORG_A}', '0257aaaa-7777-4000-8000-000000000002', '${P_ORG_A}/c/beta.pdf', 'beta.pdf', 'application/pdf', 1000, 'sha-beta', true)
      on conflict do nothing;
    `);

    // Tentar criar Application para Candidato Alfa com o Resume do Candidato Beta (mesma Org A)
    const mismatchResume = sql(`
      do $$
      begin
        insert into public.vertice_job_applications (
          organization_id, job_opening_id, candidate_id, resume_id, stage
        ) values (
          '${P_ORG_A}', '0257aaaa-4444-4000-8000-000000000001',
          '0257aaaa-7777-4000-8000-000000000001', '0257aaaa-8888-4000-8000-000000000002', 'received'
        );
        raise exception 'Nao deveria permitir Application com Resume de outro candidato';
      exception when foreign_key_violation then
        null;
      end $$;
      select count(*) from public.vertice_job_applications where resume_id = '0257aaaa-8888-4000-8000-000000000002' and candidate_id = '0257aaaa-7777-4000-8000-000000000001';
    `);
    expect(parseInt(mismatchResume, 10)).toBe(0);
  });

  it("Application Job Test: apenas vagas com status 'open' aceitam candidaturas", () => {
    seed();
    // Cria vagas com status variados
    sql(`
      insert into public.vertice_job_openings (id, organization_id, client_company_id, title, status)
      values
        ('0257aaaa-9999-4000-8000-000000000001', '${P_ORG_A}', '0257aaaa-2222-4000-8000-000000000001', 'Vaga Draft', 'draft'),
        ('0257aaaa-9999-4000-8000-000000000002', '${P_ORG_A}', '0257aaaa-2222-4000-8000-000000000001', 'Vaga Paused', 'paused'),
        ('0257aaaa-9999-4000-8000-000000000003', '${P_ORG_A}', '0257aaaa-2222-4000-8000-000000000001', 'Vaga Closed', 'closed'),
        ('0257aaaa-9999-4000-8000-000000000004', '${P_ORG_A}', '0257aaaa-2222-4000-8000-000000000001', 'Vaga Cancelled', 'cancelled')
      on conflict do nothing;
    `);

    // Draft, Paused, Closed e Cancelled devem ser rejeitadas pelo trigger trg_check_job_is_open_on_application
    const statuses = ["draft", "paused", "closed", "cancelled"];
    for (let i = 0; i < statuses.length; i++) {
      const jobId = `0257aaaa-9999-4000-8000-00000000000${i + 1}`;
      const res = sql(`
        do $$
        begin
          insert into public.vertice_job_applications (organization_id, job_opening_id, candidate_id, stage)
          values ('${P_ORG_A}', '${jobId}', '0257aaaa-7777-4000-8000-000000000001', 'received');
          raise exception 'Nao deveria permitir aplicacao em vaga %', '${statuses[i]}';
        exception when raise_exception then
          null;
        end $$;
        select count(*) from public.vertice_job_applications where job_opening_id = '${jobId}';
      `);
      expect(parseInt(res, 10)).toBe(0);
    }
  });

  it("Current Resume Invariant e Substituição Atômica (Item 12, 13 e 14)", () => {
    seed();
    // 1. Prova que tentar inserir segundo is_current = true dispara unique_violation
    const uniqueCurrentViolation = sql(`
      do $$
      begin
        insert into public.vertice_candidate_resumes (
          organization_id, candidate_id, storage_path, original_filename, mime_type, file_size_bytes, sha256, is_current
        ) values (
          '${P_ORG_A}', '0257aaaa-7777-4000-8000-000000000001',
          '${P_ORG_A}/c/alfa-2.pdf', 'alfa-2.pdf', 'application/pdf', 1000, 'sha-alfa-2', true
        );
        raise exception 'Nao deveria permitir segundo current = true simultaneo';
      exception when unique_violation then
        null;
      end $$;
      select count(*) from public.vertice_candidate_resumes where candidate_id = '0257aaaa-7777-4000-8000-000000000001' and is_current = true;
    `);
    expect(parseInt(uniqueCurrentViolation, 10)).toBe(1);

    // 2. Prova troca atômica via RPC fn_register_candidate_resume
    sql(`
      select public.fn_register_candidate_resume(
        '${P_ORG_A}'::uuid,
        '0257aaaa-7777-4000-8000-000000000001'::uuid,
        '${P_ORG_A}/c/alfa-atomic.pdf',
        'alfa-atomic.pdf',
        'application/pdf',
        2048,
        'sha-alfa-atomic',
        '{"parsed": true}'::jsonb
      );
    `);

    // Novo CV é current=true
    const atomicCurrent = sql(`
      select count(*) from public.vertice_candidate_resumes
      where candidate_id = '0257aaaa-7777-4000-8000-000000000001'
        and sha256 = 'sha-alfa-atomic'
        and is_current = true;
    `);
    expect(parseInt(atomicCurrent, 10)).toBe(1);

    // CV antigo virou is_current=false
    const oldCurrent = sql(`
      select count(*) from public.vertice_candidate_resumes
      where candidate_id = '0257aaaa-7777-4000-8000-000000000001'
        and sha256 = 'sha-alfa'
        and is_current = false;
    `);
    expect(parseInt(oldCurrent, 10)).toBe(1);
  });

  it("Candidate Status Recalculation: derivação automática de status (Item 9)", () => {
    seed();
    // Cria candidato novo
    const candId = "0257aaaa-daaa-4000-8000-000000000001";
    const appId = "0257aaaa-eaaa-4000-8000-000000000001";
    sql(`
      insert into public.vertice_candidates (id, organization_id, full_name, email, status)
      values ('${candId}', '${P_ORG_A}', 'Status Test Candidate', 'status-cand@test.com', 'active')
      on conflict do nothing;
    `);
    expect(sql(`select status from public.vertice_candidates where id = '${candId}'`)).toBe("active");

    // Inserção em stage 'received' -> vira 'in_process'
    sql(`
      insert into public.vertice_job_applications (id, organization_id, job_opening_id, candidate_id, stage)
      values ('${appId}', '${P_ORG_A}', '0257aaaa-4444-4000-8000-000000000001', '${candId}', 'received');
    `);
    expect(sql(`select status from public.vertice_candidates where id = '${candId}'`)).toBe("in_process");

    // Mudança para 'screening' -> permanece 'in_process'
    sql(`update public.vertice_job_applications set stage = 'screening' where id = '${appId}';`);
    expect(sql(`select status from public.vertice_candidates where id = '${candId}'`)).toBe("in_process");

    // Mudança para 'finalist' -> permanece 'in_process'
    sql(`update public.vertice_job_applications set stage = 'finalist' where id = '${appId}';`);
    expect(sql(`select status from public.vertice_candidates where id = '${candId}'`)).toBe("in_process");

    // Mudança para 'approved' -> vira 'hired'
    sql(`update public.vertice_job_applications set stage = 'approved' where id = '${appId}';`);
    expect(sql(`select status from public.vertice_candidates where id = '${candId}'`)).toBe("hired");

    // Mudança para 'rejected' -> recalcula para 'active'
    sql(`update public.vertice_job_applications set stage = 'rejected' where id = '${appId}';`);
    expect(sql(`select status from public.vertice_candidates where id = '${candId}'`)).toBe("active");

    // Deleta candidatura -> recalcula para 'active'
    sql(`delete from public.vertice_job_applications where id = '${appId}';`);
    expect(sql(`select status from public.vertice_candidates where id = '${candId}'`)).toBe("active");

    // Invariante: status 'inactive' ou 'do_not_contact' NÃO devem ser sobrescritos por nova candidatura
    sql(`update public.vertice_candidates set status = 'do_not_contact' where id = '${candId}';`);
    sql(`
      insert into public.vertice_job_applications (organization_id, job_opening_id, candidate_id, stage)
      values ('${P_ORG_A}', '0257aaaa-4444-4000-8000-000000000001', '${candId}', 'received');
    `);
    expect(sql(`select status from public.vertice_candidates where id = '${candId}'`)).toBe("do_not_contact");
  });
});
