import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Capture the actual extension on a public repository, never a redrawn GitHub fixture.
const root = resolve(import.meta.dirname, '..');
const source = 'https://github.com/YarilaFox/figcraft';
const themes = ['compact', 'compact-light', 'universe', 'universe-dark', 'github', 'rounded', 'rounded-light', 'midnight', 'amethyst', 'forest', 'light'];
const output = join(root, 'previews');
const extension = join(root, 'dist/chromium');
const cache = process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'ms-playwright');
const executablePath = process.env.CHROMIUM_BINARY || (cache && existsSync(cache) && readdirSync(cache)
  .filter(name => /^chromium-\d+$/.test(name)).sort((a,b) => +b.split('-')[1] - +a.split('-')[1])
  .map(name => join(cache, name, 'chrome-win64', 'chrome.exe')).find(existsSync));
if (!existsSync(join(extension, 'manifest.json'))) throw new Error('Build Chromium first: powershell -NoProfile -File build.ps1 -Target chromium');
mkdirSync(output, { recursive: true });
const context = await chromium.launchPersistentContext('', {
  ...(executablePath ? { executablePath } : { channel: 'chromium' }), headless: true,
  viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce',
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
});
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const setTheme = theme => worker.evaluate(theme => chrome.storage.local.set({
    settings: { mode: 'global', theme, language: 'en', global: {}, sites: {} },
    pluginDimLightThemes: false, pluginRepositoryThemes: false,
    pluginCommandPalette: false, pluginQuickNavigation: false, pluginRepositorySwitcher: false, pluginQuickActions: false
  }), theme);
  await setTheme('github');
  const page = await context.newPage();
  await page.goto(source, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-testid="directory-content"]').waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-testid="directory-content"] .Skeleton'));
  await page.evaluate(() => document.fonts.ready);
  const meta = await page.locator('meta[name="octolytics-dimension-repository_nwo"]').getAttribute('content');
  if (meta?.toLowerCase() !== 'yarilafox/figcraft') throw new Error('Unexpected source repository');
  const results = [];
  for (const theme of themes) {
    // Reload avoids carrying a preceding theme's native color-mode restoration into GitHub Original.
    await setTheme(theme);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(theme => document.documentElement.dataset.bghTheme === theme, theme);
    await page.locator('[data-testid="directory-content"]').waitFor();
    if (theme.startsWith('compact')) await page.locator('[data-bgh-compact-part="sidebar-section"]').first().waitFor({state:'attached'});
    await page.waitForFunction(() => ![...document.querySelectorAll('[class*="sidebarSection__"] *')]
      .some(node => /skeleton/i.test(typeof node.className === 'string' ? node.className : '') && node.checkVisibility()));
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      window.scrollTo(0, 0);
    });
    const filename = `${theme}.png`;
    await page.screenshot({ path: join(output, filename), type: 'png', animations: 'disabled', clip: { x: 0, y: 69, width: 1440, height: 810 } });
    results.push({ theme, file: filename, bytes: statSync(join(output, filename)).size });
    console.log(`Captured ${theme}`);
  }
  writeFileSync(join(output, 'captures.json'), JSON.stringify({ source, capturedAt: new Date().toISOString(), width: 1440, height: 810, results }, null, 2) + '\n');
  console.log(`Saved ${results.length} real previews (${Math.round(results.reduce((sum,r) => sum+r.bytes,0)/1024)} KiB)`);
} finally { await context.close(); }
