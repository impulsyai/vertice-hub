import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

interface Creds {
  password: string;
  users: Record<string, { email: string } | undefined>;
  duas_orgs?: {
    org_a_id: string;
    org_b_id: string;
    org_b_nome: string;
  };
}

function credentials(): Creds {
  const path = join(process.cwd(), ".e2e-creds.json");
  let creds = JSON.parse(readFileSync(path, "utf8")) as Creds;
  if (!creds.duas_orgs) {
    execFileSync("npx", ["tsx", "scripts/seed-e2e-duas-organizacoes.ts"], { stdio: "inherit" });
    creds = JSON.parse(readFileSync(path, "utf8")) as Creds;
  }
  if (!creds.duas_orgs) throw new Error("seed não gravou duas_orgs");
  return creds;
}

async function login(page: Page, creds: Creds) {
  const manager = creds.users.manager;
  if (!manager) throw new Error("credencial manager ausente");
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(manager.email);
  await page.getByLabel(/senha/i).fill(creds.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/app(\/|$)/, { timeout: 30_000 });
}

async function switchOrganization(page: Page, orgId: string, expectedName?: string) {
  await page.getByTestId("tenant-switcher").click();
  await page.getByTestId(`tenant-switcher-item-${orgId}`).click();
  const switcher = page.getByTestId("tenant-switcher");
  await expect(switcher).toBeEnabled({ timeout: 60_000 });
  if (expectedName) await expect(switcher).toContainText(expectedName, { timeout: 20_000 });
}

async function body<T>(response: import("@playwright/test").APIResponse): Promise<T> {
  return (await response.json()) as T;
}

test.describe.configure({ timeout: 180_000 });

test("Org A conclui o fluxo People e Org B não lê, altera nem baixa os recursos", async ({ page }) => {
  const creds = credentials();
  const orgs = creds.duas_orgs!;
  await login(page, creds);
  await switchOrganization(page, orgs.org_a_id);

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const companyResponse = await page.request.post("/api/v1/people/companies", {
    data: { legal_name: `Empresa People E2E ${suffix}`, trade_name: `People ${suffix}` },
  });
  expect(companyResponse.status()).toBe(201);
  const company = await body<{ data: { id: string } }>(companyResponse);

  const candidateResponse = await page.request.post("/api/v1/people/candidates", {
    data: {
      full_name: `Candidato People E2E ${suffix}`,
      email: `people-${suffix}@deskcomm.test`,
      current_job_title: "Especialista de Pessoas",
    },
  });
  expect(candidateResponse.status()).toBe(201);
  const candidate = await body<{ data: { id: string } }>(candidateResponse);

  const pdf = Buffer.from("%PDF-1.7\n% People Foundation E2E\n1 0 obj\n<<>>\nendobj\n%%EOF");
  const resumeResponse = await page.request.post("/api/v1/people/resumes", {
    multipart: {
      candidate_id: candidate.data.id,
      file: { name: `curriculo-${suffix}.pdf`, mimeType: "application/pdf", buffer: pdf },
    },
  });
  expect(resumeResponse.status()).toBe(201);
  const resume = await body<{ data: { id: string; is_current: boolean } }>(resumeResponse);
  expect(resume.data.is_current).toBe(true);

  const jobResponse = await page.request.post("/api/v1/people/jobs", {
    data: {
      client_company_id: company.data.id,
      title: `Vaga People E2E ${suffix}`,
      status: "open",
    },
  });
  expect(jobResponse.status()).toBe(201);
  const job = await body<{ data: { id: string } }>(jobResponse);

  const applicationResponse = await page.request.post("/api/v1/people/applications", {
    data: {
      candidate_id: candidate.data.id,
      job_opening_id: job.data.id,
      resume_id: resume.data.id,
      stage: "received",
    },
  });
  expect(applicationResponse.status()).toBe(201);

  const dossierResponse = await page.request.get(`/api/v1/people/candidates/${candidate.data.id}`);
  expect(dossierResponse.status()).toBe(200);
  const dossier = await body<{
    data: { resumes: Array<{ id: string; is_current: boolean }>; applications: Array<{ id: string }> };
  }>(dossierResponse);
  expect(dossier.data.resumes).toContainEqual(expect.objectContaining({ id: resume.data.id, is_current: true }));
  expect(dossier.data.applications).toHaveLength(1);

  await switchOrganization(page, orgs.org_b_id, orgs.org_b_nome);

  const forbiddenRead = await page.request.get(`/api/v1/people/candidates/${candidate.data.id}`);
  expect(forbiddenRead.status()).toBe(404);

  const forbiddenWrite = await page.request.patch(`/api/v1/people/candidates/${candidate.data.id}`, {
    data: { notes: "Org B não pode escrever" },
  });
  expect(forbiddenWrite.status()).toBe(404);

  const forbiddenDownload = await page.request.get(`/api/v1/people/resumes/${resume.data.id}/download`);
  expect(forbiddenDownload.status()).toBe(404);

  const list = await page.request.get("/api/v1/people/candidates?limit=100");
  expect(list.status()).toBe(200);
  expect(JSON.stringify(await list.json())).not.toContain(candidate.data.id);
});
