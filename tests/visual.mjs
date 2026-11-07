import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = process.argv[2] || resolve(root, 'universe-visual-check.png');
const font = name => readFileSync(resolve(root, 'fonts', name)).toString('base64');
const css = readFileSync(resolve(root, 'content.css'), 'utf8')
  .replace('url("fonts/MonaSansVF-opsz-wght.woff2")', `url("data:font/woff2;base64,${font('MonaSansVF-opsz-wght.woff2')}")`)
  .replace('url("fonts/MonaSansMonoVF-wght.woff2")', `url("data:font/woff2;base64,${font('MonaSansMonoVF-wght.woff2')}")`);
const script = readFileSync(resolve(root, 'content.js'), 'utf8');
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: Number(process.argv.find(arg => arg.startsWith('--width='))?.split('=')[1]) || 1600, height: 1000 }, bypassCSP: true });
  const page = await context.newPage();
  await page.goto('https://github.com/YarilaFox/CultOfTheLambTalk', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="repo-name-wrapper"]');
  await page.waitForFunction(() => [...document.querySelectorAll('nav a[data-tab-item]')].some(link => getComputedStyle(link).visibility === 'visible'), undefined, { timeout: 10000 });
  await page.evaluate(() => {
    window.chrome = {
      storage: {
        local: { get: (_, callback) => callback({ settings: { mode: 'global', theme: 'universe', global: {}, sites: {} } }), set: (_, callback) => callback() },
        onChanged: { addListener() {} }
      },
      runtime: { sendMessage: (_, callback) => callback({ config: null, assetBase: null }) }
    };
  });
  await page.addStyleTag({ content: css });
  await page.evaluate(script);
  await page.locator('[class*="borderGrid__"]').first().waitFor();
  await page.locator('a[aria-label^=".github/workflows"]').first().waitFor({ state: 'attached', timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.evaluate(() => document.fonts.ready);
  const sidebar = page.locator('[class*="borderGrid__"]').first();
  const box = await sidebar.boundingBox();
  await page.mouse.move(box.x + box.width * .5, box.y + Math.min(120, box.height * .4));
  for (let step = 0; step < 12; step++) await page.mouse.move(box.x + 20 + step * 12, box.y + 110 + step * 9);
  const result = await page.evaluate(() => {
    const code = [...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Code');
    const header = document.querySelector('header[role="banner"], .AppHeader');
    const sidebar = document.querySelector('[class*="borderGrid__"]');
    return {
      font: getComputedStyle(document.body).fontFamily,
      fontLoaded: document.fonts.check('16px "Better Mona Sans"'),
      headerBackground: header ? getComputedStyle(header).backgroundColor : null,
      codePresent: Boolean(code),
      codeDisplay: code ? getComputedStyle(code).display : null,
      authorAvatarWidth: Math.round(document.querySelector('[data-testid="author-avatar"] img[data-testid="github-avatar"]')?.getBoundingClientRect().width || 0),
      installPresent: Boolean(document.getElementById('bgh-install')),
      cursorTrailTiles: [...document.querySelectorAll('#bgh-cursor-trail span')].filter(tile => tile.style.opacity === '1').length,
      addedBanner: Boolean(document.getElementById('bgh-banner') || document.getElementById('bgh-universe-masthead')),
      gearMenuAvailable: Boolean(document.getElementById('bgh-gear')),
      visibleTabs: [...document.querySelectorAll('nav.bgh-universe-tabs a[data-tab-item]')].filter(link => getComputedStyle(link).visibility === 'visible').length,
      navGeometry: (() => { const link = document.querySelector('nav.bgh-universe-tabs a[data-tab-item]'); const nav = link?.closest('nav'); const li = link?.closest('li'); const rect = node => { const r = node?.getBoundingClientRect(); return r ? { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) } : null; }; return { nav: rect(nav), li: rect(li), link: rect(link), ul: rect(nav?.querySelector('ul')) }; })()
    };
  });
  await page.screenshot({ path: output, fullPage: false });
  const issueTab = page.locator('nav.bgh-universe-tabs a[data-tab-item="issues"]');
  await issueTab.hover();
  const scrambledTab = await issueTab.locator('[data-component="text"]').getAttribute('data-bgh-scramble');
  await page.waitForTimeout(900);
  const restoredTab = await issueTab.locator('[data-component="text"]').textContent();
  await page.locator('#bgh-gear').click();
  const menuLabels = await page.locator('#bgh-gear-menu [role="menuitem"]').allTextContents();
  const menuOutput = output.replace(/\.png$/i, '-menu.png');
  await page.screenshot({ path: menuOutput, fullPage: false });
  console.log(JSON.stringify({ output, menuOutput, ...result, scrambledTab, restoredTab, menuLabels }, null, 2));
  await context.close();
} finally {
  await browser.close();
}
