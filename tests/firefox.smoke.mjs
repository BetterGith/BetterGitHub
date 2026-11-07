import { firefox } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const browser = await firefox.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, bypassCSP: true });
  await page.goto('https://github.com/YarilaFox', { waitUntil: 'domcontentloaded' });
  await page.locator('.vcard-names').waitFor({ timeout: 20000 });
  await page.evaluate(() => {
    const marker = document.createElement('meta');
    marker.name = 'octolytics-dimension-repository_nwo';
    marker.content = 'YarilaFox/YarilaFox';
    document.head.append(marker);
    window.testSettings = { mode: 'site', theme: 'github', global: {}, sites: {} };
    window.chrome = {
      storage: { local: {
        get: (_key, done) => done({ settings: window.testSettings }),
        set: (value, done) => { window.testSettings = value.settings; done(); }
      }, onChanged: { addListener() {} } },
      runtime: { sendMessage: (_message, done) => done({ config: null, assetBase: null }) }
    };
  });
  await page.evaluate(readFileSync(resolve(root, 'color-picker.js'), 'utf8'));
  await page.addStyleTag({ content: readFileSync(resolve(root, 'content.css'), 'utf8') });
  await page.addStyleTag({ content: readFileSync(resolve(root, 'color-picker.css'), 'utf8') });
  await page.evaluate(readFileSync(resolve(root, 'content.js'), 'utf8'));
  await page.locator('#bgh-gear').waitFor();
  await page.locator('#bgh-gear').click();
  await page.locator('#bgh-layout-toolbar').waitFor();
  const handles = await page.locator('[data-bgh-drag-handle]').evaluateAll(nodes => nodes.map(node => node.dataset.bghDragHandle));
  const readmeGripOutside = await page.locator('[data-bgh-drag-handle="readme"]').evaluate(handle => {
    const grip = handle.getBoundingClientRect();
    const block = handle.closest('.bgh-layout-target')?.getBoundingClientRect();
    const atPoint = document.elementFromPoint(grip.x + grip.width / 2, grip.y + grip.height / 2);
    return Boolean(block && grip.width <= 20 && grip.right <= block.left && (atPoint === handle || handle.contains(atPoint)));
  });
  await page.locator('#bgh-form select[name="theme"]').selectOption('amethyst');
  const preview = await page.evaluate(() => ({ theme: document.documentElement.dataset.bghTheme, saved: window.testSettings.sites?.['profile:yarilafox/yarilafox']?.appearance?.theme || null }));
  await page.locator('#bgh-layout-save').click();
  await page.waitForFunction(() => document.documentElement.dataset.bghTheme === 'amethyst');
  const result = await page.evaluate(({ handles, preview, readmeGripOutside }) => ({
    theme: document.documentElement.dataset.bghTheme,
    savedTheme: window.testSettings.sites?.['profile:yarilafox/yarilafox']?.appearance?.theme,
    handles,
    preview,
    readmeGripOutside
  }), { handles, preview, readmeGripOutside });
  console.log(JSON.stringify(result, null, 2));
  if (result.theme !== 'amethyst' || result.savedTheme !== 'amethyst' || result.preview.theme !== 'amethyst' || result.preview.saved !== null || !result.readmeGripOutside || !['readme', 'pinned', 'info'].every(name => result.handles.includes(name))) process.exitCode = 1;
} finally {
  await browser.close();
}
