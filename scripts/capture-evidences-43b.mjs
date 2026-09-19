import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const EVIDENCE_DIR = path.resolve(process.cwd(), "evidence/4.3b-final");
fs.mkdirSync(path.join(EVIDENCE_DIR, "desktop"), { recursive: true });
fs.mkdirSync(path.join(EVIDENCE_DIR, "mobile"), { recursive: true });

async function run() {
  console.log("Starting headless Playwright for 4.3B visual evidence...");
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Session
  const desktopContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const email = process.env.TEST_ADMIN_EMAIL;
  const password = process.env.TEST_ADMIN_PASSWORD;
  if (!email || !password) {
    console.error("Defina TEST_ADMIN_EMAIL e TEST_ADMIN_PASSWORD no ambiente para executar.");
    process.exit(1);
  }

  console.log("Logging in via desktop...");
  await page.goto(`${BASE}/login`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/app/, { timeout: 25000 });
  console.log("Logged in successfully!");

  // List of pages to capture
  const routes = [
    { name: "01_dashboard", path: "/app" },
    { name: "02_sidebar", path: "/app" },
    { name: "03_conversas", path: "/app/inbox" },
    { name: "04_radar", path: "/app/radar" },
    { name: "05_agenda", path: "/app/agenda" },
    { name: "06_empresas", path: "/app/crm/empresas" },
    { name: "08_contatos", path: "/app/contacts" },
    { name: "09_opportunity_kanban", path: "/app/pipelines" },
    { name: "10_banco_talentos", path: "/app/recrutamento/talentos" },
    { name: "12_vagas", path: "/app/recrutamento/vagas" },
    { name: "13_funil_selecao", path: "/app/recrutamento/pipeline" },
    { name: "14_tarefas", path: "/app/tasks" },
    { name: "15_desempenho", path: "/app/metrics" },
  ];

  for (const r of routes) {
    try {
      console.log(`[Desktop] Capturing ${r.name} at ${r.path}...`);
      await page.goto(`${BASE}${r.path}`, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, "desktop", `${r.name}.png`), fullPage: false });
    } catch (err) {
      console.error(`Error capturing desktop ${r.name}:`, err.message);
    }
  }

  // Capture detail pages if exist
  try {
    await page.goto(`${BASE}/app/crm/empresas`);
    await page.waitForTimeout(1000);
    const companyLink = page.locator('a[href^="/app/crm/empresas/"]').first();
    if (await companyLink.count()) {
      await companyLink.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, "desktop", "07_company_detail.png"), fullPage: false });
    }
  } catch (e) {
    console.error("Company detail capture error:", e.message);
  }

  try {
    await page.goto(`${BASE}/app/recrutamento/talentos`);
    await page.waitForTimeout(1000);
    const candidateLink = page.locator('a[href^="/app/recrutamento/talentos/"]').first();
    if (await candidateLink.count()) {
      await candidateLink.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(EVIDENCE_DIR, "desktop", "11_candidate_detail.png"), fullPage: false });
    }
  } catch (e) {
    console.error("Candidate detail capture error:", e.message);
  }

  await desktopContext.close();

  // 2. Mobile Session (390x844)
  console.log("Starting Mobile Session (390x844)...");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileContext.newPage();

  console.log("Logging in via mobile...");
  await mobilePage.goto(`${BASE}/login`);
  await mobilePage.locator("#email").fill(email);
  await mobilePage.locator("#password").fill(password);
  await mobilePage.getByRole("button", { name: /entrar/i }).click();
  await mobilePage.waitForURL(/\/app/, { timeout: 25000 });

  for (const r of routes) {
    try {
      console.log(`[Mobile] Capturing ${r.name} at ${r.path}...`);
      await mobilePage.goto(`${BASE}${r.path}`, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
      await mobilePage.waitForTimeout(1000);
      await mobilePage.screenshot({ path: path.join(EVIDENCE_DIR, "mobile", `${r.name}.png`), fullPage: false });
    } catch (err) {
      console.error(`Error capturing mobile ${r.name}:`, err.message);
    }
  }

  // Mobile Company Detail & Candidate Detail
  try {
    await mobilePage.goto(`${BASE}/app/crm/empresas`);
    await mobilePage.waitForTimeout(1000);
    const companyCard = mobilePage.locator('a[href^="/app/crm/empresas/"]').first();
    if (await companyCard.count()) {
      await companyCard.click();
      await mobilePage.waitForTimeout(1500);
      await mobilePage.screenshot({ path: path.join(EVIDENCE_DIR, "mobile", "07_company_detail.png"), fullPage: false });
    }
  } catch (e) {
    console.error("Mobile company detail capture error:", e.message);
  }

  try {
    await mobilePage.goto(`${BASE}/app/recrutamento/talentos`);
    await mobilePage.waitForTimeout(1000);
    const candidateCard = mobilePage.locator('a[href^="/app/recrutamento/talentos/"]').first();
    if (await candidateCard.count()) {
      await candidateCard.click();
      await mobilePage.waitForTimeout(1500);
      await mobilePage.screenshot({ path: path.join(EVIDENCE_DIR, "mobile", "11_candidate_detail.png"), fullPage: false });
    }
  } catch (e) {
    console.error("Mobile candidate detail capture error:", e.message);
  }

  await mobileContext.close();
  await browser.close();
  console.log("All visual evidences captured in evidence/4.3b-final/");
}

run().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
