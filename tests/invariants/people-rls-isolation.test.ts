import pg from "pg";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

const pool = new pg.Pool({
  connectionString: `postgresql://postgres:postgres@127.0.0.1:${process.env.TEST_DB_PORT ?? 54329}/postgres`,
});

type ApiRole = "anon" | "authenticated" | "service_role";

async function asRole(role: ApiRole, user: string | null, query: string, values: unknown[] = []) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${role}`);
    await client.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ role, ...(user ? { sub: user } : {}) }),
    ]);
    const result = await client.query(query, values);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

interface Tenant {
  org: string;
  agent: string;
  viewer: string;
  contact: string;
  company: string;
  candidate: string;
  job: string;
}

async function tenant(tag: string): Promise<Tenant> {
  const fixture: Tenant = {
    org: randomUUID(),
    agent: randomUUID(),
    viewer: randomUUID(),
    contact: randomUUID(),
    company: randomUUID(),
    candidate: randomUUID(),
    job: randomUUID(),
  };
  await pool.query(
    "insert into organizations(id,slug,legal_name,display_name) values($1,$2,$3,$3)",
    [fixture.org, `people-${tag}-${fixture.org.slice(0, 8)}`, `People ${tag}`],
  );
  for (const role of ["agent", "viewer"] as const) {
    const user = fixture[role];
    await pool.query("insert into auth.users(id,email) values($1,$2)", [
      user,
      `${tag}-${role}-${user}@invariant.test`,
    ]);
    await pool.query(
      "insert into user_organizations(user_id,organization_id,role,accepted_at) values($1,$2,$3,now())",
      [user, fixture.org, role],
    );
  }
  await pool.query("insert into contacts(id,organization_id,display_name) values($1,$2,$3)", [
    fixture.contact,
    fixture.org,
    `Contato ${tag}`,
  ]);
  await pool.query(
    "insert into client_companies(id,organization_id,legal_name,status) values($1,$2,$3,'active')",
    [fixture.company, fixture.org, `Empresa ${tag}`],
  );
  await pool.query(
    "insert into vertice_candidates(id,organization_id,contact_id,full_name,email,status,notes) values($1,$2,$3,$4,$5,'active','nota pessoal')",
    [fixture.candidate, fixture.org, fixture.contact, `Candidato ${tag}`, `${tag}@invariant.test`],
  );
  await pool.query(
    "insert into vertice_job_openings(id,organization_id,client_company_id,title,status) values($1,$2,$3,$4,'open')",
    [fixture.job, fixture.org, fixture.company, `Vaga ${tag}`],
  );
  return fixture;
}

async function addAgent(t: Tenant, tag: string): Promise<string> {
  const user = randomUUID();
  await pool.query("insert into auth.users(id,email) values($1,$2)", [
    user,
    `${tag}-${user}@invariant.test`,
  ]);
  await pool.query(
    "insert into user_organizations(user_id,organization_id,role,accepted_at) values($1,$2,'agent',now())",
    [user, t.org],
  );
  return user;
}

const rpc = `select public.fn_register_candidate_resume(
  $1::uuid,$2::uuid,$3::text,$4::text,$5::text,$6::bigint,$7::text,$8::text,$9::text,$10::text
) result`;

function attemptPath(t: Tenant, attempt: string, extension = "pdf") {
  return `${t.org}/${t.candidate}/${attempt}.${extension}`;
}

function args(t: Tenant, sha: string, path = attemptPath(t, "11111111-1111-4111-8111-111111111111")) {
  return [t.org, t.candidate, path, "curriculo.pdf", "application/pdf", 128, sha, "manual", null, null];
}

async function putObject(t: Tenant, sha: string, attempt = "11111111-1111-4111-8111-111111111111") {
  const path = attemptPath(t, attempt);
  await pool.query(
    "insert into storage.objects(bucket_id,name,owner,metadata) values('candidate-resumes',$1,$2,$3)",
    [path, t.agent, { size: 128, mimetype: "application/pdf", sha256: sha }],
  );
  return path;
}

async function beginAsAuthenticated(client: pg.PoolClient, user: string) {
  await client.query("begin");
  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claims',$1,true)", [
    JSON.stringify({ role: "authenticated", sub: user }),
  ]);
}

afterAll(() => pool.end());

describe("People 4.2.2 — ACL, integridade e LGPD", () => {
  it("nega RPC cross-tenant com 42501 e não produz efeito lateral", async () => {
    const a = await tenant("acl-a");
    const b = await tenant("acl-b");
    const sha = "a".repeat(64);
    const path = await putObject(a, sha);
    await expect(asRole("authenticated", b.agent, rpc, args(a, sha, path))).rejects.toMatchObject({
      code: "42501",
    });
    expect(Number((await pool.query("select count(*) from vertice_candidate_resumes where storage_path=$1", [path])).rows[0].count)).toBe(0);
    expect(Number((await pool.query("select count(*) from storage.objects where name=$1", [path])).rows[0].count)).toBe(1);
  });

  it("bloqueia upload de Storage para path de outra organização", async () => {
    const a = await tenant("storage-a");
    const b = await tenant("storage-b");
    const path = attemptPath(a, "22222222-2222-4222-8222-222222222222");
    await expect(
      asRole("authenticated", b.agent, "insert into storage.objects(bucket_id,name,owner) values('candidate-resumes',$1,$2)", [path, b.agent]),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("impede outro agent do mesmo tenant de adotar o object key da tentativa", async () => {
    const a = await tenant("rpc-owner");
    const otherAgent = await addAgent(a, "rpc-owner-other");
    const sha = "9".repeat(64);
    const path = await putObject(a, sha);

    await expect(asRole("authenticated", otherAgent, rpc, args(a, sha, path))).rejects.toMatchObject({
      code: "42501",
    });
    expect(
      Number(
        (await pool.query("select count(*) from vertice_candidate_resumes where storage_path=$1", [path]))
          .rows[0].count,
      ),
    ).toBe(0);
    expect(
      Number((await pool.query("select count(*) from storage.objects where name=$1", [path])).rows[0].count),
    ).toBe(1);
  });

  it("agent da própria organização registra, deduplica e promove atomicamente", async () => {
    const a = await tenant("rpc-ok");
    const firstSha = "1".repeat(64);
    const secondSha = "2".repeat(64);
    const firstPath = await putObject(a, firstSha);
    const first = (await asRole("authenticated", a.agent, rpc, args(a, firstSha, firstPath))).rows[0].result;
    expect(first).toMatchObject({ deduplicated: false, resume: { sha256: firstSha, is_current: true, storage_path: firstPath } });
    const secondPath = await putObject(a, secondSha, "22222222-2222-4222-8222-222222222222");
    const second = (await asRole("authenticated", a.agent, rpc, args(a, secondSha, secondPath))).rows[0].result;
    expect(second).toMatchObject({ deduplicated: false, resume: { sha256: secondSha, is_current: true } });
    const promoted = (await asRole("authenticated", a.agent, rpc, args(a, firstSha, firstPath))).rows[0].result;
    expect(promoted).toMatchObject({ deduplicated: true, resume: { sha256: firstSha, is_current: true } });
    expect(Number((await pool.query("select count(*) from vertice_candidate_resumes where candidate_id=$1 and is_current", [a.candidate])).rows[0].count)).toBe(1);
  });

  it("nega anon, UID nulo, viewer e service_role", async () => {
    const a = await tenant("rpc-deny");
    const roles: Array<[ApiRole, string | null]> = [["anon", null], ["authenticated", null], ["authenticated", a.viewer], ["service_role", null]];
    for (const [role, user] of roles) {
      await expect(asRole(role, user, rpc, args(a, "3".repeat(64)))).rejects.toMatchObject({ code: "42501" });
    }
    expect(Number((await pool.query("select count(*) from vertice_candidate_resumes where candidate_id=$1", [a.candidate])).rows[0].count)).toBe(0);
  });

  it("valida path, SHA, tamanho e MIME antes de mutar", async () => {
    const a = await tenant("rpc-input");
    const invalid = [
      args(a, "4".repeat(64), "fora/path.pdf"),
      args(a, "sha-invalido"),
      args(a, "5".repeat(64)).map((value, index) => (index === 5 ? 0 : value)),
      args(a, "6".repeat(64)).map((value, index) => (index === 4 ? "text/plain" : value)),
    ];
    for (const values of invalid) {
      await expect(asRole("authenticated", a.agent, rpc, values)).rejects.toMatchObject({ code: "22023" });
    }
  });

  it("recusa metadata sem objeto real e escrita autenticada privilegiada", async () => {
    const a = await tenant("rpc-object");
    await expect(asRole("authenticated", a.agent, rpc, args(a, "d".repeat(64)))).rejects.toMatchObject({ code: "P0002" });
    await expect(
      asRole("authenticated", a.agent, "insert into vertice_candidate_resumes(organization_id,candidate_id,storage_path,original_filename,mime_type,file_size_bytes,sha256) values($1,$2,$3,'x.pdf','application/pdf',128,$4)", [a.org, a.candidate, attemptPath(a, "33333333-3333-4333-8333-333333333333"), "e".repeat(64)]),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("concorre com dois object keys, mantém o vencedor e bloqueia DELETE do cliente", async () => {
    const a = await tenant("race");
    const sha = "b".repeat(64);
    const pathA = await putObject(a, sha, "11111111-1111-4111-8111-111111111111");
    const pathB = await putObject(a, sha, "22222222-2222-4222-8222-222222222222");
    const clientA = await pool.connect();
    const clientB = await pool.connect();
    try {
      await beginAsAuthenticated(clientA, a.agent);
      const firstRequest = clientA.query(rpc, args(a, sha, pathA));
      await new Promise((resolve) => setTimeout(resolve, 50));
      await beginAsAuthenticated(clientB, a.agent);
      const secondRequest = clientB.query(rpc, args(a, sha, pathB));
      const first = (await firstRequest).rows[0].result;
      await clientA.query("commit");
      const second = (await secondRequest).rows[0].result;
      await clientB.query("commit");
      expect(first).toMatchObject({ deduplicated: false, resume: { storage_path: pathA } });
      expect(second).toMatchObject({ deduplicated: true, resume: { storage_path: pathA } });
    } finally {
      await clientA.query("rollback").catch(() => undefined);
      await clientB.query("rollback").catch(() => undefined);
      clientA.release();
      clientB.release();
    }
    expect(Number((await pool.query("select count(*) from vertice_candidate_resumes where candidate_id=$1 and sha256=$2", [a.candidate, sha])).rows[0].count)).toBe(1);
    expect(Number((await pool.query("select count(*) from vertice_candidate_resumes where candidate_id=$1 and is_current", [a.candidate])).rows[0].count)).toBe(1);
    expect(Number((await pool.query("select count(*) from storage.objects where name in($1,$2)", [pathA, pathB])).rows[0].count)).toBe(2);
    await expect(asRole("authenticated", a.agent, "delete from storage.objects where bucket_id='candidate-resumes' and name=$1", [pathB])).rejects.toMatchObject({ code: "42501" });
    expect(Number((await pool.query("select count(*) from storage.objects where name in($1,$2)", [pathA, pathB])).rows[0].count)).toBe(2);
  });

  it("referência de qualquer currículo impede a remoção pelo cliente", async () => {
    const a = await tenant("delete-reference");
    const sha = "f".repeat(64);
    const path = await putObject(a, sha);
    await asRole("authenticated", a.agent, rpc, args(a, sha, path));
    await expect(asRole("authenticated", a.agent, "delete from storage.objects where bucket_id='candidate-resumes' and name=$1", [path])).rejects.toMatchObject({ code: "42501" });
  });

  it("RLS e FKs bloqueiam tenant vizinho, currículo de outro candidato e vaga fechada", async () => {
    const a = await tenant("relations-a");
    const b = await tenant("relations-b");
    expect(Number((await asRole("authenticated", b.agent, "select count(*) from vertice_candidates where organization_id=$1", [a.org])).rows[0].count)).toBe(0);
    const path = await putObject(a, "7".repeat(64));
    const resumeA = (await asRole("authenticated", a.agent, rpc, args(a, "7".repeat(64), path))).rows[0].result.resume.id;
    await expect(pool.query("insert into vertice_job_applications(organization_id,job_opening_id,candidate_id,resume_id) values($1,$2,$3,$4)", [b.org, b.job, b.candidate, resumeA])).rejects.toMatchObject({ code: "23503" });
    await pool.query("update vertice_job_openings set status='closed' where id=$1", [a.job]);
    await expect(pool.query("insert into vertice_job_applications(organization_id,job_opening_id,candidate_id) values($1,$2,$3)", [a.org, a.job, a.candidate])).rejects.toMatchObject({ code: "22023" });
  });

  it("status do candidato deriva das candidaturas e preserva bloqueios manuais", async () => {
    const a = await tenant("status");
    const application = randomUUID();
    await pool.query("insert into vertice_job_applications(id,organization_id,job_opening_id,candidate_id,stage) values($1,$2,$3,$4,'received')", [application, a.org, a.job, a.candidate]);
    expect((await pool.query("select status from vertice_candidates where id=$1", [a.candidate])).rows[0].status).toBe("in_process");
    await pool.query("update vertice_job_applications set stage='approved' where id=$1", [application]);
    expect((await pool.query("select status from vertice_candidates where id=$1", [a.candidate])).rows[0].status).toBe("hired");
    await pool.query("update vertice_candidates set status='do_not_contact' where id=$1", [a.candidate]);
    await pool.query("update vertice_job_applications set stage='screening' where id=$1", [application]);
    expect((await pool.query("select status from vertice_candidates where id=$1", [a.candidate])).rows[0].status).toBe("do_not_contact");
  });

  it("anonimização redige People, enfileira Storage e não alcança tenant vizinho", async () => {
    const a = await tenant("lgpd-a");
    const b = await tenant("lgpd-b");
    const sha = "8".repeat(64);
    const path = await putObject(a, sha);
    const registered = (await asRole("authenticated", a.agent, rpc, args(a, sha, path))).rows[0].result.resume;
    await pool.query("insert into vertice_job_applications(organization_id,job_opening_id,candidate_id,resume_id,notes,rejection_reason) values($1,$2,$3,$4,'nota livre','motivo pessoal')", [a.org, a.job, a.candidate, registered.id]);
    const neighborBefore = (await pool.query("select to_jsonb(c) value from vertice_candidates c where id=$1", [b.candidate])).rows[0].value;
    await pool.query("update contacts set is_anonymized=true,anonymized_at=now() where id=$1 and organization_id=$2", [a.contact, a.org]);
    const candidate = (await pool.query("select * from vertice_candidates where id=$1", [a.candidate])).rows[0];
    expect(candidate).toMatchObject({ email: null, phone_e164: null, linkedin_url: null, current_job_title: null, notes: null });
    expect(candidate.full_name).toMatch(/^Candidato Anonimizado #/);
    expect((await pool.query("select notes,rejection_reason,resume_id from vertice_job_applications where candidate_id=$1", [a.candidate])).rows[0]).toEqual({ notes: null, rejection_reason: null, resume_id: null });
    expect(Number((await pool.query("select count(*) from vertice_candidate_resumes where candidate_id=$1", [a.candidate])).rows[0].count)).toBe(0);
    expect(Number((await pool.query("select count(*) from storage_redaction_queue where bucket='candidate-resumes' and object_path=$1", [path])).rows[0].count)).toBe(1);
    expect((await pool.query("select to_jsonb(c) value from vertice_candidates c where id=$1", [b.candidate])).rows[0].value).toEqual(neighborBefore);
  });
});
