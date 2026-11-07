import { chromium } from 'playwright-core';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const extension = resolve(root, 'dist', 'chromium');
const profile = '';
const installedBrowser = chromium.executablePath();
const browserCache = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
const fallbackBrowser = existsSync(browserCache) ? readdirSync(browserCache)
  .filter(name => /^chromium-\d+$/.test(name)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
  .map(name => join(browserCache, name, 'chrome-win64', 'chrome.exe')).find(existsSync) : null;
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  executablePath: existsSync(installedBrowser) ? installedBrowser : fallbackBrowser || undefined,
  headless: true,
  viewport: { width: Number(process.env.BGH_VIEWPORT_WIDTH) || 1345, height: Number(process.env.BGH_VIEWPORT_HEIGHT) || 891 },
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
});

try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 15000 });
  const id = new URL(worker.url()).host;
  const options = await context.newPage();
  await options.goto(`chrome-extension://${id}/options.html`);
  await options.evaluate(() => chrome.storage.local.set({ settings: { mode: 'global', theme: 'universe', global: {}, sites: {} } }));

  const page = await context.newPage();
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      window.bghThemeAtDomReady = document.documentElement.dataset.bghTheme || null;
    }, { once: true });
  });
  await page.goto('https://github.com/YarilaFox/CultOfTheLambTalk', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.bghTheme === 'universe');
  await page.waitForFunction(() => [...document.querySelectorAll('nav.bgh-universe-tabs a[data-tab-item]')].some(link => link.getBoundingClientRect().width > 0), undefined, { timeout: 15000 });
  await page.locator('[data-testid="directory-content"]').waitFor();
  const active = () => page.locator('#bgh-cursor-trail span[style*="opacity: 1"]').count();
  await page.mouse.move(10, 400);
  const trailOnBackground = await active();
  const files = await page.locator('[data-testid="directory-content"]').boundingBox();
  await page.mouse.move(files.x + files.width / 2, files.y + 40);
  const trailOnFiles = await active();
  const sidebar = await page.locator('[class*="borderGrid__"]').first().boundingBox();
  await page.mouse.move(sidebar.x + sidebar.width / 2, sidebar.y + 80);
  const trailOnSidebar = await active();
  const repoGear = await page.locator('#bgh-gear').evaluate(node => {
    const box = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return { x: box.x, y: box.y, width: box.width, height: box.height, display: style.display, visibility: style.visibility, opacity: style.opacity, color: style.color, background: style.backgroundColor, elementAtCenter: document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.outerHTML.slice(0, 220), parent: node.parentElement?.outerHTML.slice(0, 600) };
  });
  if (process.env.BGH_REPO_GEAR_DEBUG) console.log(JSON.stringify({ repoGear }, null, 2));
  if (process.env.BGH_REPO_GEAR_CROP) await page.screenshot({ path: process.env.BGH_REPO_GEAR_CROP, clip: { x: Math.max(0, repoGear.x - 80), y: Math.max(0, repoGear.y - 30), width: 260, height: 90 } });
  if (process.env.BGH_REPO_SCREENSHOT) await page.screenshot({ path: process.env.BGH_REPO_SCREENSHOT });
  await page.locator('#bgh-gear').click();
  await page.locator('#bgh-dialog[open]').waitFor();
  if (process.env.BGH_REPO_EDITOR_SCREENSHOT) await page.screenshot({ path: process.env.BGH_REPO_EDITOR_SCREENSHOT });
  const swatches = await page.locator('#bgh-dialog .bgh-color-swatch').evaluateAll(nodes =>
    nodes.map(node => getComputedStyle(node).backgroundColor));
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#bgh-export').click();
  const download = await downloadPromise;
  const downloadFailure = await download.failure();
  if (downloadFailure) throw new Error(`Export download failed: ${downloadFailure}`);
  const exported = JSON.parse(readFileSync(await download.path(), 'utf8'));
  const result = await page.evaluate(() => ({
    themeAtDomReady: window.bghThemeAtDomReady,
    currentTheme: document.documentElement.dataset.bghTheme,
    activeTabs: [...document.querySelectorAll('nav.bgh-universe-tabs a[data-tab-item]')].filter(link => link.getBoundingClientRect().width > 0).length,
    cursorPool: document.querySelectorAll('#bgh-cursor-trail span').length,
    trailPointerEvents: getComputedStyle(document.getElementById('bgh-cursor-trail')).pointerEvents
  }));
  Object.assign(result, { trailOnBackground, trailOnFiles, trailOnSidebar, repoGear, editorOpened: true, swatches, exportedTheme: exported.appearance?.theme, exportedSections: exported.layout?.sidebar?.length, downloadName: download.suggestedFilename() });
  await options.evaluate(() => chrome.storage.local.set({ settings: { mode: 'site', theme: 'github', global: {}, sites: {
    'profile:yarilafox/yarilafox': { appearance: { theme: 'amethyst' }, layout: { profile: ['readme', 'pinned', 'contributions'], profileSidebar: ['info', 'achievements', 'highlights'] } }
  } } }));
  const profilePage = await context.newPage();
  await profilePage.goto('https://github.com/YarilaFox', { waitUntil: 'domcontentloaded' });
  await profilePage.waitForFunction(() => document.documentElement.dataset.bghTheme === 'amethyst', undefined, { timeout: 20000 });
  result.profileTheme = await profilePage.evaluate(() => document.documentElement.dataset.bghTheme);
  await profilePage.locator('#bgh-gear').click();
  result.profileHandleCount = await profilePage.locator('[data-bgh-drag-handle]').count();
  result.profileEditorDocked = await profilePage.locator('#bgh-dialog[open].bgh-layout-editing').count() === 1;
  result.readmeGripOutside = await profilePage.locator('[data-bgh-drag-handle="readme"]').evaluate(handle => {
    const grip = handle.getBoundingClientRect();
    const block = handle.closest('.bgh-layout-target')?.getBoundingClientRect();
    const atPoint = document.elementFromPoint(grip.x + grip.width / 2, grip.y + grip.height / 2);
    return Boolean(block && grip.width <= 20 && grip.right <= block.left && (atPoint === handle || handle.contains(atPoint)));
  });
  if (process.env.BGH_SCREENSHOT) await profilePage.screenshot({ path: process.env.BGH_SCREENSHOT });
  const pinnedHandle = profilePage.locator('[data-bgh-drag-handle="pinned"]');
  await pinnedHandle.focus();
  await pinnedHandle.press('ArrowUp');
  const highlightsHandle = profilePage.locator('[data-bgh-drag-handle="highlights"]');
  await highlightsHandle.focus();
  await highlightsHandle.press('ArrowUp');
  result.profilePinnedMoved = await profilePage.evaluate(() => {
    const readme = document.querySelector('#user-profile-frame .profile-readme');
    const pinned = document.querySelector('#user-profile-frame .js-pinned-items-reorder-container')?.parentElement;
    return Boolean(readme && pinned && (pinned.compareDocumentPosition(readme) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  await profilePage.locator('#bgh-layout-save').click();
  await profilePage.waitForFunction(() => !document.querySelector('[data-bgh-drag-handle]'));
  result.savedProfileOrder = await options.evaluate(async () => {
    const value = await chrome.storage.local.get('settings');
    return value.settings?.sites?.['profile:yarilafox/yarilafox']?.layout?.profile;
  });
  result.savedProfileSidebar = await options.evaluate(async () => {
    const value = await chrome.storage.local.get('settings');
    return value.settings?.sites?.['profile:yarilafox/yarilafox']?.layout?.profileSidebar;
  });
  await options.evaluate(async () => {
    const { settings } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({ settings: { ...settings, language: 'en' } });
  });
  await profilePage.locator('#bgh-gear').click();
  result.englishEditorTitle = await profilePage.locator('#bgh-dialog header h2').textContent();
  await profilePage.locator('#bgh-dialog .bgh-color-swatch').first().click();
  result.englishColorTitle = await profilePage.locator('.bgh-color-head strong').textContent();
  console.log(JSON.stringify(result, null, 2));
  if (result.themeAtDomReady !== 'universe' || result.activeTabs < 1 || result.cursorPool !== 40 || result.trailOnBackground < 1 || result.trailOnFiles !== 0 || result.trailOnSidebar !== 0 || result.trailPointerEvents !== 'none' || !result.editorOpened || swatches.length !== 6 || new Set(swatches).size !== 6 || result.exportedTheme !== 'universe' || result.exportedSections !== 5 || result.profileTheme !== 'amethyst' || result.profileHandleCount !== 6 || !result.profileEditorDocked || !result.readmeGripOutside || !result.profilePinnedMoved || result.savedProfileOrder?.[0] !== 'pinned' || result.savedProfileSidebar?.[1] !== 'highlights' || result.englishEditorTitle !== 'Profile appearance' || result.englishColorTitle !== 'Choose color') process.exitCode = 1;
} finally {
  await context.close();
}
