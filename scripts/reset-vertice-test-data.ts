/**
 * Reset controlado dos dados de teste da organização Vértice.
 *
 * O padrão é somente leitura:
 *   pnpm db:reset:vertice -- --organization-id <uuid>
 *
 * Para aplicar, é necessário repetir o UUID e o token literal de confirmação:
 *   pnpm db:reset:vertice -- --organization-id <uuid> \
 *     --confirm-reset RESET-VERTICE-LOCAL-DATA
 *
 * O script aceita apenas uma conexão Postgres local (localhost/127.0.0.1/::1)
 * e nunca toca em organizações diferentes da Vértice validada abaixo.
 */

/* eslint-disable no-console -- CLI de reset precisa relatar impacto e verificação. */
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

const TARGET_ORG_SLUG = "vertice-local";
const TARGET_ORG_NAME = "Vértice — Pessoas & Estratégia";
const RESET_CONFIRMATION = "RESET-VERTICE-LOCAL-DATA";
const RESUME_BUCKET = "candidate-resumes";

const REQUIRED_RELATIONS = [
  "public.organizations",
  "public.channel_sessions",
  "public.crm_pipelines",
  "public.crm_stages",
  "public.messages",
  "public.demandas",
  "public.crm_lead_activities",
  "public.vertice_job_applications",
  "public.vertice_candidate_resumes",
  "public.vertice_candidates",
  "public.crm_leads",
  "public.conversations",
  "public.contacts",
  "public.client_companies",
  "public.vertice_job_openings",
  "public.ai_reply_drafts",
  "public.calendar_appointments",
  "storage.objects",
  "storage.buckets",
] as const;

type Organization = {
  id: string;
  display_name: string;
  slug: string;
};

type ResetCounts = {
  aiReplyDrafts: number;
  calendarAppointments: number;
  messages: number;
  demandas: number;
  leadActivities: number;
  applications: number;
  resumes: number;
  candidates: number;
  leads: number;
  conversations: number;
  contacts: number;
  clientCompanies: number;
  jobCompaniesPreserved: number;
  jobCompaniesDeletable: number;
  allJobs: number;
  openJobs: number;
  channelSessions: number;
  pipelines: number;
  stages: number;
  crmTasks: number;
};

const COUNT_QUERIES: Record<keyof ResetCounts, string> = {
  aiReplyDrafts: `
    select count(*)::int as count
    from public.ai_reply_drafts d
    where d.organization_id = $1
       or d.message_id in (
         select id from public.messages where organization_id = $1
       )
       or d.conversation_id in (
         select id from public.conversations where organization_id = $1
       )
       or d.contact_id in (
         select id from public.contacts where organization_id = $1
       )`,
  calendarAppointments: `
    select count(*)::int as count
    from public.calendar_appointments a
    where a.organization_id = $1
       or a.contact_id in (
         select id from public.contacts where organization_id = $1
       )`,
  messages: `select count(*)::int as count from public.messages where organization_id = $1`,
  demandas: `select count(*)::int as count from public.demandas where organization_id = $1`,
  leadActivities: `select count(*)::int as count from public.crm_lead_activities where organization_id = $1`,
  applications: `select count(*)::int as count from public.vertice_job_applications where organization_id = $1`,
  resumes: `select count(*)::int as count from public.vertice_candidate_resumes where organization_id = $1`,
  candidates: `select count(*)::int as count from public.vertice_candidates where organization_id = $1`,
  leads: `select count(*)::int as count from public.crm_leads where organization_id = $1`,
  conversations: `select count(*)::int as count from public.conversations where organization_id = $1`,
  contacts: `select count(*)::int as count from public.contacts where organization_id = $1`,
  clientCompanies: `select count(*)::int as count from public.client_companies where organization_id = $1`,
  jobCompaniesPreserved: `
    select count(*)::int as count
    from public.client_companies c
    where c.organization_id = $1
      and exists (
        select 1
        from public.vertice_job_openings j
        where j.client_company_id = c.id
      )`,
  jobCompaniesDeletable: `
    select count(*)::int as count
    from public.client_companies c
    where c.organization_id = $1
      and not exists (
        select 1
        from public.vertice_job_openings j
        where j.client_company_id = c.id
      )`,
  allJobs: `select count(*)::int as count from public.vertice_job_openings where organization_id = $1`,
  openJobs: `
    select count(*)::int as count
    from public.vertice_job_openings
    where organization_id = $1 and status = 'open'`,
  channelSessions: `select count(*)::int as count from public.channel_sessions where organization_id = $1`,
  pipelines: `select count(*)::int as count from public.crm_pipelines where organization_id = $1`,
  stages: `select count(*)::int as count from public.crm_stages where organization_id = $1`,
  crmTasks: `select count(*)::int as count from public.crm_tasks where organization_id = $1`,
};

const RESET_TO_ZERO: Array<keyof ResetCounts> = [
  "aiReplyDrafts",
  "calendarAppointments",
  "messages",
  "demandas",
  "leadActivities",
  "applications",
  "resumes",
  "candidates",
  "leads",
  "conversations",
  "contacts",
];

const PRESERVED_COUNTS: Array<keyof ResetCounts> = [
  "allJobs",
  "openJobs",
  "channelSessions",
  "pipelines",
  "stages",
  "crmTasks",
];

function usage(): void {
  console.log(`
Uso seguro:
  pnpm db:reset:vertice -- --organization-id <uuid>

Aplicar o reset irreversível somente após revisar o dry-run:
  pnpm db:reset:vertice -- --organization-id <uuid> \
    --confirm-reset ${RESET_CONFIRMATION}

O script aceita somente um Postgres local e exige a organização
"${TARGET_ORG_NAME}" (${TARGET_ORG_SLUG}).
`);
}

function parseArgs(): { organizationId: string; apply: boolean } {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    usage();
    process.exit(0);
  }

  let organizationId: string | undefined;
  let confirmation: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--organization-id") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--organization-id exige um UUID.");
      }
      organizationId = value;
      index += 1;
      continue;
    }

    if (argument === "--confirm-reset") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`--confirm-reset exige o token literal ${RESET_CONFIRMATION}.`);
      }
      confirmation = value;
      index += 1;
      continue;
    }

    throw new Error(`Argumento desconhecido: ${argument}`);
  }

  if (!organizationId) {
    usage();
    throw new Error("Informe --organization-id; nenhuma organização é inferida automaticamente.");
  }

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      organizationId,
    )
  ) {
    throw new Error("--organization-id não parece ser um UUID válido.");
  }

  if (confirmation !== undefined && confirmation !== RESET_CONFIRMATION) {
    throw new Error(`Token inválido. Para aplicar, use exatamente ${RESET_CONFIRMATION}.`);
  }

  return { organizationId, apply: confirmation === RESET_CONFIRMATION };
}

function getLocalDatabaseUrl(): { value: string; host: string; port: string } {
  const value = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!value) {
    throw new Error("SUPABASE_DB_URL ou DATABASE_URL não foi encontrado no ambiente.");
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("A URL do Postgres não pôde ser interpretada.");
  }

  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (!localHosts.has(parsed.hostname)) {
    throw new Error(
      `Conexão recusada por segurança: host ${parsed.hostname} não é local. ` +
        "Este reset só aceita localhost, 127.0.0.1 ou ::1.",
    );
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("A conexão precisa usar o protocolo postgres:// ou postgresql://.");
  }

  return { value, host: parsed.hostname, port: parsed.port || "5432" };
}

async function count(client: Client, query: string, organizationId: string): Promise<number> {
  const result = await client.query<{ count: string }>(query, [organizationId]);
  return Number(result.rows[0]?.count ?? 0);
}

async function getCounts(client: Client, organizationId: string): Promise<ResetCounts> {
  const counts = {} as ResetCounts;
  for (const key of Object.keys(COUNT_QUERIES) as Array<keyof ResetCounts>) {
    counts[key] = await count(client, COUNT_QUERIES[key], organizationId);
  }
  return counts;
}

async function assertRequiredRelations(client: Client): Promise<void> {
  for (const relation of REQUIRED_RELATIONS) {
    const result = await client.query<{ relation: string | null }>(
      "select to_regclass($1)::text as relation",
      [relation],
    );
    if (!result.rows[0]?.relation) {
      throw new Error(`Relação obrigatória ausente: ${relation}`);
    }
  }
}

async function assertTargetOrganization(
  client: Client,
  organizationId: string,
): Promise<Organization> {
  const result = await client.query<Organization>(
    `
      select id::text, display_name, slug
      from public.organizations
      where id = $1
    `,
    [organizationId],
  );
  const organization = result.rows[0];
  if (!organization) {
    throw new Error(`Organização ${organizationId} não foi encontrada.`);
  }

  if (organization.slug !== TARGET_ORG_SLUG || organization.display_name !== TARGET_ORG_NAME) {
    throw new Error(
      `Organização recusada: encontrada "${organization.display_name}" (${organization.slug}), ` +
        `mas o alvo permitido é "${TARGET_ORG_NAME}" (${TARGET_ORG_SLUG}).`,
    );
  }

  return organization;
}

async function assertResumeBucket(client: Client): Promise<void> {
  const result = await client.query<{ id: string }>(
    "select id from storage.buckets where id = $1",
    [RESUME_BUCKET],
  );
  if (!result.rows[0]) {
    throw new Error(`Bucket de currículos ausente: ${RESUME_BUCKET}`);
  }
}

async function getResumePaths(client: Client, organizationId: string): Promise<string[]> {
  const result = await client.query<{ storage_path: string | null }>(
    `
      select storage_path
      from public.vertice_candidate_resumes
      where organization_id = $1 and storage_path is not null
    `,
    [organizationId],
  );

  return [
    ...new Set(
      result.rows.map((row) => row.storage_path).filter((path): path is string => Boolean(path)),
    ),
  ];
}

async function assertResumePathsAreTenantOwned(
  client: Client,
  organizationId: string,
  paths: string[],
): Promise<void> {
  if (paths.length === 0) return;

  const result = await client.query<{ storage_path: string }>(
    `
      select storage_path
      from public.vertice_candidate_resumes
      where storage_path = any($1::text[])
        and organization_id <> $2
    `,
    [paths, organizationId],
  );
  if (result.rows.length > 0) {
    throw new Error(
      "Reset recusado: existe caminho de currículo compartilhado com outra organização: " +
        result.rows.map((row) => row.storage_path).join(", "),
    );
  }
}

async function countResumeObjects(client: Client, paths: string[]): Promise<number> {
  if (paths.length === 0) return 0;
  const result = await client.query<{ count: string }>(
    `
      select count(*)::int as count
      from storage.objects
      where bucket_id = '${RESUME_BUCKET}'
        and name = any($1::text[])
    `,
    [paths],
  );
  return Number(result.rows[0]?.count ?? 0);
}

function getLocalSupabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL não foi encontrado no ambiente.");
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL não pôde ser interpretado.");
  }

  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (!localHosts.has(parsed.hostname)) {
    throw new Error(
      `Storage recusado por segurança: host ${parsed.hostname} não é local. ` +
        "Este reset só aceita a API Supabase local.",
    );
  }

  return value;
}

async function removeResumeObjectsThroughStorageApi(paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ausente: a Storage API é necessária para remover os currículos.",
    );
  }

  const supabase = createClient(getLocalSupabaseUrl(), serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await supabase.storage.from(RESUME_BUCKET).remove(paths);
  if (error) {
    throw new Error(`Storage API não removeu os currículos: ${error.message}`);
  }
}

async function deleteRows(
  client: Client,
  label: string,
  query: string,
  params: unknown[],
): Promise<number> {
  const result = await client.query(query, params);
  const deleted = result.rowCount ?? 0;
  console.log(`  ${label}: ${deleted} removido(s)`);
  return deleted;
}

function printCounts(title: string, counts: ResetCounts, storageObjects: number): void {
  console.log(`\n${title}`);
  console.table({
    "ai_reply_drafts (dependentes)": counts.aiReplyDrafts,
    "calendar_appointments (dependentes)": counts.calendarAppointments,
    messages: counts.messages,
    demandas: counts.demandas,
    crm_lead_activities: counts.leadActivities,
    vertice_job_applications: counts.applications,
    vertice_candidate_resumes: counts.resumes,
    "resume storage.objects": storageObjects,
    vertice_candidates: counts.candidates,
    crm_leads: counts.leads,
    conversations: counts.conversations,
    contacts: counts.contacts,
    client_companies: counts.clientCompanies,
    "client_companies preservadas por vagas": counts.jobCompaniesPreserved,
    "client_companies removíveis": counts.jobCompaniesDeletable,
    "vertice_job_openings (todos)": counts.allJobs,
    "vertice_job_openings (open)": counts.openJobs,
    channel_sessions: counts.channelSessions,
    crm_pipelines: counts.pipelines,
    crm_stages: counts.stages,
    "crm_tasks (não tocadas)": counts.crmTasks,
  });
}

function assertPostReset(before: ResetCounts, after: ResetCounts): void {
  for (const key of RESET_TO_ZERO) {
    if (after[key] !== 0) {
      throw new Error(`Verificação falhou: ${key} ainda tem ${after[key]} registro(s).`);
    }
  }

  if (after.clientCompanies !== before.jobCompaniesPreserved) {
    throw new Error(
      `Verificação falhou: sobraram ${after.clientCompanies} empresas, ` +
        `mas eram esperadas ${before.jobCompaniesPreserved} empresas vinculadas a vagas.`,
    );
  }

  for (const key of PRESERVED_COUNTS) {
    if (after[key] !== before[key]) {
      throw new Error(
        `Verificação falhou: ${key} mudou de ${before[key]} para ${after[key]}; ` +
          "o reset não deve alterar estruturas preservadas.",
      );
    }
  }
}

async function run(): Promise<void> {
  const { organizationId, apply } = parseArgs();
  const database = getLocalDatabaseUrl();
  const client = new Client({ connectionString: database.value });

  await client.connect();
  try {
    await assertRequiredRelations(client);
    const organization = await assertTargetOrganization(client, organizationId);
    await assertResumeBucket(client);
    const resumePaths = await getResumePaths(client, organizationId);
    await assertResumePathsAreTenantOwned(client, organizationId, resumePaths);
    const before = await getCounts(client, organizationId);
    const beforeStorageObjects = await countResumeObjects(client, resumePaths);

    console.log(`Banco local: ${database.host}:${database.port}`);
    console.log(`Organização alvo: ${organization.display_name} (${organization.slug})`);
    console.log(`UUID: ${organization.id}`);
    console.log(`Modo: ${apply ? "APPLY — remoção solicitada" : "DRY-RUN — nenhuma alteração"}`);
    printCounts("Impacto calculado antes do reset", before, beforeStorageObjects);

    if (!apply) {
      console.log("\nDry-run concluído. Nenhum registro foi alterado.");
      return;
    }

    await client.query("begin");
    await client.query("set local lock_timeout = '5s'");
    await client.query("set local statement_timeout = '60s'");

    let after: ResetCounts | undefined;
    try {
      // Dependências NO ACTION/RESTRICT precisam sair antes dos pais.
      await deleteRows(
        client,
        "ai_reply_drafts",
        `
          delete from public.ai_reply_drafts d
          where d.organization_id = $1
             or d.message_id in (select id from public.messages where organization_id = $1)
             or d.conversation_id in (select id from public.conversations where organization_id = $1)
             or d.contact_id in (select id from public.contacts where organization_id = $1)
        `,
        [organizationId],
      );
      await deleteRows(
        client,
        "calendar_appointments",
        `
          delete from public.calendar_appointments a
          where a.organization_id = $1
             or a.contact_id in (select id from public.contacts where organization_id = $1)
        `,
        [organizationId],
      );
      await deleteRows(
        client,
        "messages",
        "delete from public.messages where organization_id = $1",
        [organizationId],
      );
      await deleteRows(
        client,
        "demandas",
        "delete from public.demandas where organization_id = $1",
        [organizationId],
      );
      await deleteRows(
        client,
        "crm_lead_activities",
        "delete from public.crm_lead_activities where organization_id = $1",
        [organizationId],
      );
      await deleteRows(
        client,
        "vertice_job_applications",
        "delete from public.vertice_job_applications where organization_id = $1",
        [organizationId],
      );

      await deleteRows(
        client,
        "vertice_candidate_resumes",
        "delete from public.vertice_candidate_resumes where organization_id = $1",
        [organizationId],
      );
      await deleteRows(
        client,
        "vertice_candidates",
        "delete from public.vertice_candidates where organization_id = $1",
        [organizationId],
      );
      await deleteRows(
        client,
        "crm_leads",
        "delete from public.crm_leads where organization_id = $1",
        [organizationId],
      );
      await deleteRows(
        client,
        "conversations",
        "delete from public.conversations where organization_id = $1",
        [organizationId],
      );
      await deleteRows(
        client,
        "contacts",
        "delete from public.contacts where organization_id = $1",
        [organizationId],
      );
      await deleteRows(
        client,
        "client_companies sem vaga vinculada",
        `
          delete from public.client_companies c
          where c.organization_id = $1
            and not exists (
              select 1
              from public.vertice_job_openings j
              where j.client_company_id = c.id
            )
        `,
        [organizationId],
      );

      after = await getCounts(client, organizationId);
      assertPostReset(before, after);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }

    if (!after) {
      throw new Error("Reset concluído sem estado de verificação disponível.");
    }

    try {
      await removeResumeObjectsThroughStorageApi(resumePaths);
      const afterStorageObjects = await countResumeObjects(client, resumePaths);
      if (afterStorageObjects !== 0) {
        throw new Error(`ainda existem ${afterStorageObjects} objeto(s) de currículo.`);
      }

      printCounts("Estado verificado após o reset", after, afterStorageObjects);
      console.log("\nReset aplicado e verificado; currículos removidos pela Storage API.");
    } catch (error) {
      throw new Error(
        "Os dados relacionais foram commitados, mas a limpeza do Storage falhou. " +
          `Caminhos a revisar: ${resumePaths.join(", ")}. ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  } finally {
    await client.end();
  }
}

run().catch((error: unknown) => {
  console.error(`\nFalha: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
