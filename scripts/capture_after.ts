import { chromium } from 'playwright';
import { readFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import path from 'path';

async function capture() {
  const creds = JSON.parse(readFileSync('./.e2e-creds.json', 'utf8'));
  const baseOut = 'C:/dev/vertice-4.3b-prep';

  const candidateId = '173ede9e-df5f-44c7-aa92-805f72b37a4b';
  const jobId = '746c5768-f30f-4eb5-a118-cea8f7d68bb4';

  const browser = await chromium.launch({ headless: true });
  
  // Desktop Context 1440x900
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Logging in on Desktop...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.getByLabel(/e-?mail/i).fill(creds.users.manager.email);
  await page.getByLabel(/senha/i).fill(creds.password);
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForURL(/\/app(\/|$)/, { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const desktopScreenshots = [
    { folder: '01_shell', file: 'shell_after.png', url: '/app/inbox' },
    { folder: '02_dashboard', file: 'dashboard_after.png', url: '/app' },
    { folder: '03_empresas', file: 'empresas_after.png', url: '/app/crm/empresas' },
    { folder: '04_talentos', file: 'talentos_after.png', url: '/app/recrutamento/talentos' },
    { folder: '05_candidato', file: 'candidato_after.png', url: `/app/recrutamento/talentos/${candidateId}` },
    { folder: '06_vagas', file: 'vagas_after.png', url: '/app/recrutamento/vagas' },
    { folder: '07_vaga', file: 'vaga_after.png', url: `/app/recrutamento/vagas/${jobId}` },
    { folder: '08_candidaturas', file: 'candidaturas_after.png', url: '/app/recrutamento/candidaturas' },
    { folder: '09_funil', file: 'funil_after.png', url: '/app/recrutamento/pipeline' },
    { folder: '10_agenda', file: 'agenda_after.png', url: '/app/agenda' },
    { folder: '11_tarefas', file: 'tarefas_after.png', url: '/app/tasks' },
    { folder: '12_inbox', file: 'inbox_after.png', url: '/app/inbox' },
    { folder: '13_settings', file: 'settings_after.png', url: '/app/settings' },
  ];

  for (const item of desktopScreenshots) {
    console.log(`Navigating to ${item.url} for ${item.folder}...`);
    try {
      await page.goto(`http://localhost:3000${item.url}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1200);
      const targetDir = path.join(baseOut, item.folder, 'after');
      mkdirSync(targetDir, { recursive: true });
      const targetPath = path.join(targetDir, item.file);
      await page.screenshot({ path: targetPath, fullPage: false });
      console.log(`[OK] Saved ${targetPath}`);
    } catch (e) {
      console.error(`[FAIL] ${item.folder}:`, e instanceof Error ? e.message : String(e));
    }
  }

  await context.close();

  // Mobile Context 390x844
  console.log('\nLogging in on Mobile...');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await mobilePage.getByLabel(/e-?mail/i).fill(creds.users.manager.email);
  await mobilePage.getByLabel(/senha/i).fill(creds.password);
  await mobilePage.getByRole('button', { name: /entrar/i }).click();
  await mobilePage.waitForURL(/\/app(\/|$)/, { timeout: 30000 });
  await mobilePage.waitForLoadState('networkidle');
  await mobilePage.waitForTimeout(1500);

  const mobileScreenshots = [
    { file: '01_mobile_dashboard_after.png', url: '/app' },
    { file: '02_mobile_empresas_after.png', url: '/app/crm/empresas' },
    { file: '03_mobile_talentos_after.png', url: '/app/recrutamento/talentos' },
    { file: '04_mobile_candidato_after.png', url: `/app/recrutamento/talentos/${candidateId}` },
    { file: '05_mobile_vagas_after.png', url: '/app/recrutamento/vagas' },
    { file: '06_mobile_vaga_after.png', url: `/app/recrutamento/vagas/${jobId}` },
    { file: '07_mobile_funil_after.png', url: '/app/recrutamento/pipeline' },
    { file: '08_mobile_agenda_after.png', url: '/app/agenda' },
    { file: '09_mobile_tarefas_after.png', url: '/app/tasks' },
    { file: '10_mobile_inbox_after.png', url: '/app/inbox' },
  ];

  const mobileTargetDir = path.join(baseOut, '14_mobile', 'after');
  mkdirSync(mobileTargetDir, { recursive: true });

  for (const m of mobileScreenshots) {
    console.log(`Navigating to ${m.url} for mobile...`);
    try {
      await mobilePage.goto(`http://localhost:3000${m.url}`, { waitUntil: 'networkidle', timeout: 30000 });
      await mobilePage.waitForTimeout(1200);
      const targetPath = path.join(mobileTargetDir, m.file);
      await mobilePage.screenshot({ path: targetPath, fullPage: false });
      console.log(`[OK Mobile] Saved ${targetPath}`);
    } catch (e) {
      console.error(`[FAIL Mobile] ${m.file}:`, e instanceof Error ? e.message : String(e));
    }
  }

  await mobileContext.close();
  await browser.close();

  // Populate 00_REVIEW with curated Before / After pairs
  console.log('\nPopulating 00_REVIEW directory...');
  const reviewDir = path.join(baseOut, '00_REVIEW');
  mkdirSync(reviewDir, { recursive: true });

  const reviewPairs = [
    { srcBefore: '01_shell/before/shell_before.png', srcAfter: '01_shell/after/shell_after.png', prefix: '01_shell' },
    { srcBefore: '02_dashboard/before/dashboard_before.png', srcAfter: '02_dashboard/after/dashboard_after.png', prefix: '02_dashboard' },
    { srcBefore: '03_empresas/before/empresas_before.png', srcAfter: '03_empresas/after/empresas_after.png', prefix: '03_empresas' },
    { srcBefore: '04_talentos/before/talentos_before.png', srcAfter: '04_talentos/after/talentos_after.png', prefix: '04_talentos' },
    { srcBefore: '05_candidato/before/candidato_before.png', srcAfter: '05_candidato/after/candidato_after.png', prefix: '05_candidato' },
    { srcBefore: '06_vagas/before/vagas_before.png', srcAfter: '06_vagas/after/vagas_after.png', prefix: '06_vagas' },
    { srcBefore: '07_vaga/before/vaga_before.png', srcAfter: '07_vaga/after/vaga_after.png', prefix: '07_vaga' },
    { srcBefore: '08_candidaturas/before/candidaturas_before.png', srcAfter: '08_candidaturas/after/candidaturas_after.png', prefix: '08_candidaturas' },
    { srcBefore: '09_funil/before/funil_before.png', srcAfter: '09_funil/after/funil_after.png', prefix: '09_funil' },
    { srcBefore: '10_agenda/before/agenda_before.png', srcAfter: '10_agenda/after/agenda_after.png', prefix: '10_agenda' },
    { srcBefore: '11_tarefas/before/tarefas_before.png', srcAfter: '11_tarefas/after/tarefas_after.png', prefix: '11_tarefas' },
    { srcBefore: '12_inbox/before/inbox_before.png', srcAfter: '12_inbox/after/inbox_after.png', prefix: '12_inbox' },
    { srcBefore: '14_mobile/before/03_mobile_talentos_before.png', srcAfter: '14_mobile/after/03_mobile_talentos_after.png', prefix: '13_mobile_talentos' },
    { srcBefore: '14_mobile/before/04_mobile_candidato_before.png', srcAfter: '14_mobile/after/04_mobile_candidato_after.png', prefix: '14_mobile_candidato' },
    { srcBefore: '14_mobile/before/07_mobile_funil_before.png', srcAfter: '14_mobile/after/07_mobile_funil_after.png', prefix: '15_mobile_funil' },
  ];

  for (const pair of reviewPairs) {
    const fullBefore = path.join(baseOut, pair.srcBefore);
    const fullAfter = path.join(baseOut, pair.srcAfter);
    if (existsSync(fullBefore)) {
      copyFileSync(fullBefore, path.join(reviewDir, `${pair.prefix}_before.png`));
    }
    if (existsSync(fullAfter)) {
      copyFileSync(fullAfter, path.join(reviewDir, `${pair.prefix}_after.png`));
    }
  }

  console.log('00_REVIEW populated successfully!');
  console.log('\n=== ALL AFTER SCREENSHOTS CAPTURED AND REVIEW ASSETS CURATED ===');
}

capture().catch(err => {
  console.error('Fatal error capturing after screenshots:', err);
  process.exit(1);
});
