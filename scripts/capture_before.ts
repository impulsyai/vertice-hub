import { chromium } from 'playwright';
import { readFileSync, existsSync, mkdirSync } from 'fs';
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
    { folder: '01_shell', file: 'shell_before.png', url: '/app/inbox' },
    { folder: '02_dashboard', file: 'dashboard_before.png', url: '/app' },
    { folder: '03_empresas', file: 'empresas_before.png', url: '/app/crm/empresas' },
    { folder: '04_talentos', file: 'talentos_before.png', url: '/app/recrutamento/talentos' },
    { folder: '05_candidato', file: 'candidato_before.png', url: `/app/recrutamento/talentos/${candidateId}` },
    { folder: '06_vagas', file: 'vagas_before.png', url: '/app/recrutamento/vagas' },
    { folder: '07_vaga', file: 'vaga_before.png', url: `/app/recrutamento/vagas/${jobId}` },
    { folder: '08_candidaturas', file: 'candidaturas_before.png', url: '/app/recrutamento/candidaturas' },
    { folder: '09_funil', file: 'funil_before.png', url: '/app/recrutamento/pipeline' },
    { folder: '10_agenda', file: 'agenda_before.png', url: '/app/agenda' },
    { folder: '11_tarefas', file: 'tarefas_before.png', url: '/app/tasks' },
    { folder: '12_inbox', file: 'inbox_before.png', url: '/app/inbox' },
    { folder: '13_settings', file: 'settings_before.png', url: '/app/settings' },
  ];

  for (const item of desktopScreenshots) {
    console.log(`Navigating to ${item.url} for ${item.folder}...`);
    try {
      await page.goto(`http://localhost:3000${item.url}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1000);
      const targetDir = path.join(baseOut, item.folder, 'before');
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
    { file: '01_mobile_dashboard_before.png', url: '/app' },
    { file: '02_mobile_empresas_before.png', url: '/app/crm/empresas' },
    { file: '03_mobile_talentos_before.png', url: '/app/recrutamento/talentos' },
    { file: '04_mobile_candidato_before.png', url: `/app/recrutamento/talentos/${candidateId}` },
    { file: '05_mobile_vagas_before.png', url: '/app/recrutamento/vagas' },
    { file: '06_mobile_vaga_before.png', url: `/app/recrutamento/vagas/${jobId}` },
    { file: '07_mobile_funil_before.png', url: '/app/recrutamento/pipeline' },
    { file: '08_mobile_agenda_before.png', url: '/app/agenda' },
    { file: '09_mobile_tarefas_before.png', url: '/app/tasks' },
    { file: '10_mobile_inbox_before.png', url: '/app/inbox' },
  ];

  const mobileTargetDir = path.join(baseOut, '14_mobile', 'before');
  mkdirSync(mobileTargetDir, { recursive: true });

  for (const m of mobileScreenshots) {
    console.log(`Navigating to ${m.url} for mobile...`);
    try {
      await mobilePage.goto(`http://localhost:3000${m.url}`, { waitUntil: 'networkidle', timeout: 30000 });
      await mobilePage.waitForTimeout(1000);
      const targetPath = path.join(mobileTargetDir, m.file);
      await mobilePage.screenshot({ path: targetPath, fullPage: false });
      console.log(`[OK Mobile] Saved ${targetPath}`);
    } catch (e) {
      console.error(`[FAIL Mobile] ${m.file}:`, e instanceof Error ? e.message : String(e));
    }
  }

  await mobileContext.close();
  await browser.close();
  console.log('\n=== ALL BEFORE SCREENSHOTS CAPTURED SUCCESSFULLY ===');
}

capture().catch(err => {
  console.error('Fatal error capturing before screenshots:', err);
  process.exit(1);
});
