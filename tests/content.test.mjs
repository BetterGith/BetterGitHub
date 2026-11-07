import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const script = readFileSync(new URL('../content.js', import.meta.url), 'utf8');
const html = `<!doctype html><html><head><meta name="octolytics-dimension-repository_nwo" content="Example/Project"></head><body>
<div data-testid="repo-name-wrapper"><strong>Project</strong></div>
<nav><a data-tab-item="code" href="/Example/Project"><span data-component="text">Code</span></a><a data-tab-item="issues" href="/Example/Project/issues"><span data-component="text">Issues</span></a></nav>
<main><button><span>Code</span></button><a href="/Example/Project/readme">Readme text</a><div class="borderGrid__VCnF9i">
<div class="sidebarSection__oqw6Y8"><h2>About <button type="button" id="github-gear" aria-label="Edit repository details">⚙</button></h2></div>
<div class="sidebarSection__oqw6Y8"><h2>Releases</h2></div>
<div class="sidebarSection__oqw6Y8"><h2>Packages</h2></div>
<div class="sidebarSection__oqw6Y8"><h2>Contributors</h2></div>
<div class="sidebarSection__oqw6Y8"><h2>Languages</h2></div>
</div></main></body></html>`;

async function page(config, { settings = { mode: 'site', theme: 'universe', sites: {} }, assetBase = 'https://raw.githubusercontent.com/Example/Project/main/.bettergithub.json', markup = html } = {}) {
  const dom = new JSDOM(markup, { url: 'https://github.com/Example/Project', runScripts: 'outside-only' });
  const { window } = dom;
  window.matchMedia = () => ({ matches: false });
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  window.HTMLDialogElement.prototype.show = function () { this.setAttribute('open', ''); };
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  window.chrome = {
    storage: {
      local: { get: (_, callback) => callback({ settings }), set: (_, callback) => callback() },
      onChanged: { addListener() {} }
    },
    runtime: { sendMessage: (_, callback) => callback({ config, assetBase, installUrl: null }) }
  };
  window.eval(script);
  await new Promise(resolve => setTimeout(resolve, 250));
  return dom;
}

test('applies repository JSON to current GitHub sidebar and install action', async () => {
  const dom = await page({
    appearance: { theme: 'universe', accent: '#008b2b' },
    banner: 'assets/banner.png', icon: 'assets/icon.png',
    installUrl: 'https://github.com/Example/Project/releases/download/v1/setup.zip',
    layout: { sidebar: ['contributors', 'about', 'releases', 'packages', 'languages'] }
  });
  const doc = dom.window.document;
  assert.equal(doc.documentElement.dataset.bghTheme, 'universe');
  assert.equal(doc.documentElement.getAttribute('data-color-mode'), 'light');
  assert.equal(doc.getElementById('bgh-universe-masthead'), null);
  assert.equal(doc.querySelectorAll('#bgh-cursor-trail span').length, 40);
  assert.equal(doc.querySelector('#bgh-banner img')?.src, 'https://raw.githubusercontent.com/Example/Project/main/assets/banner.png');
  assert.equal(doc.querySelector('#bgh-banner')?.style.order, '1');
  assert.equal(doc.querySelector('#bgh-repo-icon')?.src, 'https://raw.githubusercontent.com/Example/Project/main/assets/icon.png');
  assert.equal(doc.querySelector('#bgh-install')?.href, 'https://github.com/Example/Project/releases/download/v1/setup.zip');
  assert.equal(doc.querySelector('[class*="borderGrid__"]')?.classList.contains('bgh-reordered'), true);
  assert.equal([...doc.querySelectorAll('[class*="borderGrid__"] > [class*="sidebarSection__"]')].find(row => row.querySelector('h2')?.textContent === 'Contributors')?.style.order, '0');
  dom.window.close();
});

test('rejects script URLs and off-site install redirects', async () => {
  const dom = await page({ banner: 'javascript:alert(1)', icon: 'https://evil.example/icon.png', installUrl: 'https://github.com/redirect?url=https://evil.example' });
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#bgh-banner'), null);
  assert.equal(doc.querySelector('#bgh-repo-icon'), null);
  assert.equal(doc.querySelector('#bgh-install'), null);
  dom.window.close();
});

test('keeps GitHub gear native and opens the BetterGitHub editor from its own button', async () => {
  const dom = await page({});
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#bgh-install'), null);
  assert.equal(doc.querySelector('[data-bgh-original-code]'), null);
  assert.equal(doc.querySelector('.bgh-reordered'), null);
  assert.equal(doc.querySelector('main button')?.textContent.trim(), 'Code');
  let nativeClicks = 0;
  doc.getElementById('github-gear').addEventListener('click', () => nativeClicks++);
  doc.getElementById('github-gear').click();
  assert.equal(nativeClicks, 1);
  assert.equal(doc.getElementById('bgh-dialog'), null);
  assert.equal(doc.getElementById('bgh-gear').textContent, '✦ BetterGitHub');
  doc.getElementById('bgh-gear').click();
  assert.equal(doc.getElementById('bgh-dialog')?.open, true);
  assert.equal(nativeClicks, 1);
  dom.window.close();
});

test('shows the repository editor when About uses an unrecognized wrapper', async () => {
  const markup = html.replace('class="sidebarSection__oqw6Y8"><h2>About', 'class="newAboutLayout"><h2>About');
  const dom = await page({}, { markup });
  const doc = dom.window.document;
  const nativeGear = doc.getElementById('github-gear');
  const editor = doc.getElementById('bgh-gear');
  assert.ok(editor);
  assert.equal(editor.previousElementSibling, doc.querySelector('[data-testid="repo-name-wrapper"]'));
  assert.equal(nativeGear.parentElement.closest('.newAboutLayout') !== null, true);
  let nativeClicks = 0;
  nativeGear.addEventListener('click', () => nativeClicks++);
  editor.click();
  assert.equal(doc.getElementById('bgh-dialog')?.open, true);
  assert.equal(nativeClicks, 0);
  nativeGear.click();
  assert.equal(nativeClicks, 1);
  dom.window.close();
});

test('stages repository JSON and opens the edit route for existing bettergithub.json', async () => {
  const dom = await page({});
  const { window } = dom;
  const doc = window.document;
  let draft;
  let opened;
  window.open = () => (opened = { closed: false, location: { href: 'about:blank' } });
  window.chrome.storage.local.set = (value, callback) => {
    if (value.githubDraft) draft = value.githubDraft;
    callback();
  };
  window.chrome.runtime.sendMessage = (message, callback) => {
    assert.deepEqual(JSON.parse(JSON.stringify(message)), {
      type: 'bettergithub:editor-target', owner: 'Example', repository: 'Project'
    });
    callback({ branch: 'main', filename: 'bettergithub.json', exists: true });
  };
  doc.getElementById('bgh-gear').click();
  const form = doc.getElementById('bgh-form');
  form.elements.theme.value = 'forest';
  form.elements.theme.dispatchEvent(new window.Event('change', { bubbles: true }));
  form.elements.banner.value = 'assets/banner.png';
  doc.getElementById('bgh-github-save').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(opened.location.href, 'https://github.com/Example/Project/edit/main/bettergithub.json');
  assert.equal(draft.filename, 'bettergithub.json');
  assert.equal(draft.exists, true);
  assert.equal(draft.owner, 'Example');
  assert.equal(draft.repository, 'Project');
  assert.equal(draft.branch, 'main');
  assert.ok(Date.now() - draft.createdAt < 5_000);
  assert.equal(draft.json.endsWith('\n'), true);
  const json = JSON.parse(draft.json);
  assert.equal(json.appearance.theme, 'forest');
  assert.equal(json.banner, 'assets/banner.png');
  assert.deepEqual(json.layout.sidebar, ['about', 'releases', 'packages', 'contributors', 'languages']);
  dom.window.close();
});

test('inserts staged JSON once and leaves later GitHub editor changes alone', async () => {
  const draft = {
    owner: 'Example', repository: 'Project', branch: 'main', filename: 'bettergithub.json',
    exists: true, createdAt: Date.now(), json: '{"appearance":{"theme":"forest"}}\n'
  };
  const dom = new JSDOM('<!doctype html><html><head><meta name="octolytics-dimension-repository_nwo" content="Example/Project"></head><body><div id="repository-container-header"><strong>Project</strong></div><main><textarea name="value">old file</textarea></main></body></html>', {
    url: 'https://github.com/Example/Project/edit/main/bettergithub.json', runScripts: 'outside-only'
  });
  const { window } = dom;
  window.chrome = {
    storage: {
      local: {
        get: (key, callback) => callback(key === 'githubDraft' ? { githubDraft: draft } : { settings: {} }),
        set: (value, callback) => { Object.assign(draft, value.githubDraft); callback(); }
      },
      onChanged: { addListener() {} }
    },
    runtime: { sendMessage: (_, callback) => callback({ config: { appearance: { theme: 'amethyst' } } }) }
  };
  window.eval(script);
  await new Promise(resolve => setTimeout(resolve, 180));
  const doc = window.document;
  assert.equal(doc.documentElement.dataset.bghTheme, 'amethyst', 'the configured theme remains visible in the editor');
  assert.equal(doc.querySelector('textarea[name="value"]').value, draft.json);
  assert.equal(doc.querySelector('#bgh-github-draft textarea').value, draft.json);
  assert.equal(draft.attempted, true);
  assert.equal(draft.handled, true);
  assert.match(doc.getElementById('bgh-github-draft-status').textContent, /один раз|inserted once/i);
  doc.querySelector('textarea[name="value"]').value = 'my later edit';
  doc.body.append(doc.createElement('div'));
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(doc.querySelector('textarea[name="value"]').value, 'my later edit');
  dom.window.close();

  const revisit = new JSDOM('<!doctype html><html><body><textarea name="value">my later edit</textarea></body></html>', {
    url: 'https://github.com/Example/Project/edit/main/bettergithub.json', runScripts: 'outside-only'
  });
  revisit.window.chrome = {
    storage: {
      local: {
        get: (key, callback) => callback(key === 'githubDraft' ? { githubDraft: draft } : { settings: {} }),
        set: (value, callback) => { Object.assign(draft, value.githubDraft); callback(); }
      },
      onChanged: { addListener() {} }
    },
    runtime: { sendMessage: (_, callback) => callback({ config: null }) }
  };
  revisit.window.eval(script);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(revisit.window.document.querySelector('textarea[name="value"]').value, 'my later edit');
  assert.match(revisit.window.document.getElementById('bgh-github-draft-status').textContent, /уже выполнялась|already ran/i);
  revisit.window.close();
});

test('exports validated editor values as a repository JSON file', async () => {
  const dom = await page({ appearance: { theme: 'forest', base: '#102030', ignored: 'secret' } });
  const { window } = dom;
  const doc = window.document;
  let saved = 0;
  window.chrome.storage.local.set = () => { saved++; };
  let blob;
  let downloaded;
  window.URL.createObjectURL = value => { blob = value; return 'blob:bettergithub-test'; };
  window.URL.revokeObjectURL = () => {};
  doc.addEventListener('click', event => {
    if (event.target.download) {
      downloaded = { name: event.target.download, href: event.target.href };
      event.preventDefault();
    }
  });
  doc.getElementById('bgh-gear').click();
  const form = doc.getElementById('bgh-form');
  form.elements.theme.value = 'amethyst';
  form.elements.theme.dispatchEvent(new window.Event('change', { bubbles: true }));
  form.elements.accent.value = '#123456';
  form.elements.base.value = '#102030';
  form.elements.background.value = 'assets/background.png';
  form.elements.banner.value = 'assets/banner.png';
  form.elements.icon.value = '';
  form.elements.installUrl.value = 'https://github.com/Example/Project/releases/download/v1/setup.zip';
  doc.getElementById('bgh-export').click();
  assert.deepEqual(downloaded, { name: '.bettergithub.json', href: 'blob:bettergithub-test' });
  const reader = new window.FileReader();
  const json = await new Promise((resolve, reject) => {
    reader.onload = () => resolve(JSON.parse(reader.result));
    reader.onerror = reject;
    reader.readAsText(blob);
  });
  assert.deepEqual(json, {
    appearance: { theme: 'amethyst', accent: '#123456', background: 'assets/background.png', effect: 'none', base: '#102030', surface: '#20172d', text: '#f4eaff', muted: '#bdaacb', border: '#49375e' },
    layout: { sidebar: ['about', 'releases', 'packages', 'contributors', 'languages'] },
    banner: 'assets/banner.png',
    installUrl: 'https://github.com/Example/Project/releases/download/v1/setup.zip'
  });
  assert.equal(saved, 0);
  dom.window.close();
});

test('exports the visible global appearance and accepts safe image paths before JSON is published', async () => {
  const dom = await page(
    { appearance: { theme: 'forest', accent: '#008b2b' } },
    { settings: { mode: 'global', theme: 'universe-dark', global: { accent: '#123456', base: '#102030', background: 'assets/global.png', effect: 'glow', ignored: 'secret' }, sites: {} }, assetBase: null }
  );
  const { window } = dom;
  const doc = window.document;
  assert.equal(doc.documentElement.dataset.bghTheme, 'universe-dark');
  assert.match(doc.documentElement.style.getPropertyValue('--bgh-background-image'), /raw\.githubusercontent\.com\/Example\/Project\/HEAD\/assets\/global\.png/);
  let blob;
  let downloads = 0;
  window.URL.createObjectURL = value => { blob = value; downloads++; return 'blob:bettergithub-test'; };
  window.URL.revokeObjectURL = () => {};
  doc.addEventListener('click', event => { if (event.target.download) event.preventDefault(); });
  doc.getElementById('bgh-gear').click();
  const form = doc.getElementById('bgh-form');
  assert.equal(form.elements.theme.value, 'universe-dark');
  assert.equal(form.elements.accent.value, '#123456');
  assert.equal(form.elements.background.value, 'assets/global.png');
  form.elements.banner.value = 'assets/banner.png';
  doc.getElementById('bgh-export').click();
  const reader = new window.FileReader();
  const json = await new Promise((resolve, reject) => {
    reader.onload = () => resolve(JSON.parse(reader.result));
    reader.onerror = reject;
    reader.readAsText(blob);
  });
  assert.deepEqual(json.appearance, { theme: 'universe-dark', accent: '#123456', background: 'assets/global.png', effect: 'glow', base: '#102030', surface: '#111a15', text: '#f0f7f2', muted: '#a6baa9', border: '#2c4032' });
  assert.equal(json.banner, 'assets/banner.png');
  assert.deepEqual(json.layout.sidebar, ['about', 'releases', 'packages', 'contributors', 'languages']);
  window.alert = () => {};
  form.elements.banner.value = '../escape.png';
  doc.getElementById('bgh-export').click();
  assert.equal(downloads, 1);
  dom.window.close();
});

test('saving page editor updates the visible global theme and colors', async () => {
  const dom = await page({}, { settings: { mode: 'global', theme: 'universe', global: {}, sites: {} } });
  const doc = dom.window.document;
  let saved;
  dom.window.chrome.storage.local.set = (value, callback) => { saved = value.settings; callback(); };
  doc.getElementById('bgh-gear').click();
  const form = doc.getElementById('bgh-form');
  form.elements.theme.value = 'amethyst';
  form.elements.theme.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  form.elements.base.value = '#112233';
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(saved.theme, 'amethyst');
  assert.equal(saved.global.base, '#112233');
  assert.equal(doc.documentElement.dataset.bghTheme, 'amethyst');
  assert.equal(doc.documentElement.style.getPropertyValue('--bgh-base'), '#112233');
  dom.window.close();
});

test('site mode without a repository appearance uses original GitHub theme', async () => {
  const dom = await page({}, { settings: { mode: 'site', theme: 'universe', global: { accent: '#123456' }, sites: {} } });
  assert.equal(dom.window.document.documentElement.dataset.bghTheme, 'github');
  dom.window.close();
});

test('dragging editor cards changes exported sidebar order while arrow controls remain available', async () => {
  const dom = await page({});
  const { window } = dom;
  const doc = window.document;
  let blob;
  window.URL.createObjectURL = value => { blob = value; return 'blob:bettergithub-test'; };
  window.URL.revokeObjectURL = () => {};
  doc.addEventListener('click', event => { if (event.target.download) event.preventDefault(); });
  doc.getElementById('bgh-gear').click();
  const rows = doc.querySelectorAll('.bgh-order-row');
  assert.equal(rows.length, 5);
  assert.equal(rows[0].draggable, true);
  rows[0].dispatchEvent(new window.Event('dragstart', { bubbles: true }));
  rows[3].dispatchEvent(new window.Event('dragover', { bubbles: true, cancelable: true }));
  rows[3].dispatchEvent(new window.Event('drop', { bubbles: true, cancelable: true }));
  assert.deepEqual(JSON.parse(doc.getElementById('bgh-order').dataset.order), ['releases', 'packages', 'contributors', 'about', 'languages']);
  doc.querySelector('[aria-label="Поднять About"]').click();
  const expected = ['releases', 'packages', 'about', 'contributors', 'languages'];
  assert.deepEqual(JSON.parse(doc.getElementById('bgh-order').dataset.order), expected);
  doc.getElementById('bgh-export').click();
  const reader = new window.FileReader();
  const json = await new Promise((resolve, reject) => {
    reader.onload = () => resolve(JSON.parse(reader.result));
    reader.onerror = reject;
    reader.readAsText(blob);
  });
  assert.deepEqual(json.layout.sidebar, expected);
  dom.window.close();
});

test('uses distinct temporary symbols for repository tabs and restores labels', async () => {
  const dom = await page({ appearance: { theme: 'universe' } });
  const doc = dom.window.document;
  const code = doc.querySelector('a[data-tab-item="code"]');
  const issues = doc.querySelector('a[data-tab-item="issues"]');
  code.dispatchEvent(new dom.window.Event('pointerenter'));
  issues.dispatchEvent(new dom.window.Event('pointerenter'));
  assert.match(code.querySelector('[data-component="text"]').dataset.bghScramble, /^[<>{}/]+$/);
  assert.match(issues.querySelector('[data-component="text"]').dataset.bghScramble, /^[?!#@]+$/);
  assert.equal(code.querySelector('[data-component="text"]').textContent, 'Code');
  assert.equal(code.hasAttribute('aria-label'), false);
  code.dispatchEvent(new dom.window.Event('pointerleave'));
  issues.dispatchEvent(new dom.window.Event('pointerleave'));
  assert.equal(code.querySelector('[data-component="text"]').textContent, 'Code');
  assert.equal(issues.querySelector('[data-component="text"]').textContent, 'Issues');
  assert.equal(code.querySelector('[data-component="text"]').hasAttribute('data-bgh-scramble'), false);
  issues.querySelector('[data-component="text"]').textContent = 'Issues 2';
  issues.dispatchEvent(new dom.window.Event('pointerenter'));
  issues.dispatchEvent(new dom.window.Event('pointerleave'));
  assert.equal(issues.querySelector('[data-component="text"]').textContent, 'Issues 2');
  dom.window.close();
});

test('draws only on empty background, clears over files and sidebar', async () => {
  const dom = await page({ appearance: { theme: 'universe' } });
  const doc = dom.window.document;
  const tiles = doc.querySelectorAll('#bgh-cursor-trail span');
  const background = doc.querySelector('main');
  const link = doc.querySelector('main a');
  const sidebar = doc.querySelector('[class*="borderGrid__"]');
  doc.elementFromPoint = (x) => x < 120 ? background : x < 180 ? link : sidebar;
  const pointer = (target, x, y) => target.dispatchEvent(new dom.window.MouseEvent('pointermove', { bubbles: true, clientX: x, clientY: y }));
  pointer(background, 100, 100);
  assert.equal([...tiles].some(tile => tile.style.opacity === '1'), true);
  pointer(link, 150, 100);
  assert.equal([...tiles].filter(tile => tile.style.opacity === '1').length, 0);
  pointer(sidebar, 200, 100);
  assert.equal([...tiles].filter(tile => tile.style.opacity === '1').length, 0);
  dom.window.close();
});

test('applies a selected global theme on GitHub pages without a repository', async () => {
  const dom = new JSDOM('<!doctype html><html><body><main>GitHub</main></body></html>', { url: 'https://github.com/', runScripts: 'outside-only' });
  let requests = 0;
  dom.window.chrome = {
    storage: {
      local: { get: (_, callback) => callback({ settings: { mode: 'global', theme: 'universe-dark', global: { accent: '#00c943' }, sites: {} } }) },
      onChanged: { addListener() {} }
    },
    runtime: { sendMessage: () => { requests++; } }
  };
  dom.window.eval(script);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(dom.window.document.documentElement.dataset.bghTheme, 'universe-dark');
  assert.equal(requests, 0);
  dom.window.close();
});
