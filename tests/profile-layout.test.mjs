import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const script = readFileSync(new URL('../content.js', import.meta.url), 'utf8');

// Mirrors the two separate GitHub profile columns. IDs identify fixture nodes only;
// the extension must find the blocks from GitHub's classes and headings.
function fixture({ readme = true, pinned = true, contributions = true, highlights = true, repoMeta = false } = {}) {
  return `<!doctype html><html><head>${repoMeta ? '<meta name="octolytics-dimension-repository_nwo" content="Example/Example">' : ''}</head><body><main><div class="Layout">
    <aside class="Layout-sidebar"><div class="js-profile-editable-replace">
      <div id="github-profile-identity"><img class="avatar-user" alt=""><h1 class="vcard-names">Example</h1></div>
      <div class="d-flex flex-column">
        <div id="github-profile-action"><button type="button" class="js-profile-editable-edit-button">Edit profile</button></div>
        <div id="profile-info" class="js-profile-editable-area"><a href="/Example?tab=followers">Followers</a><a href="https://example.com">Website</a></div>
      </div>
      <div id="profile-achievements" class="border-top color-border-muted tmp-pt-3 tmp-mt-3 d-none d-md-block"><h2>Achievements</h2><a href="/achievements">Badge</a></div>
      ${highlights ? '<div id="profile-highlights" class="border-top color-border-muted tmp-pt-3 tmp-mt-3 d-none d-md-block"><h2>Highlights</h2><a href="/highlights">Developer Program Member</a></div>' : ''}
    </div></aside>
    <div class="Layout-main"><turbo-frame id="user-profile-frame"><div class="position-relative">
      ${readme ? '<div id="profile-readme" class="Box tmp-mt-4 profile-readme"><a href="/Example/Example/blob/main/README.md">Example/README.md</a><article class="markdown-body">Readme</article></div>' : ''}
      ${pinned ? '<div id="profile-pinned" class="tmp-mt-4"><div class="js-pinned-items-reorder-container"><h2>Pinned</h2><ol class="js-pinned-items-reorder-list"><li class="pinned-item-list-item"><a href="/Example/Project">Project</a></li></ol></div></div>' : ''}
      ${contributions ? '<div id="profile-contributions" class="tmp-mt-4 position-relative"><h2>Contribution activity</h2><a href="/Example?tab=overview">Activity</a></div>' : ''}
    </div></turbo-frame></div>
  </div></main></body></html>`;
}

async function profile(config = {}, { settings = { mode: 'site', theme: 'github', sites: {} }, blocks = {} } = {}) {
  const dom = new JSDOM(fixture(blocks), { url: 'https://github.com/Example', runScripts: 'outside-only' });
  const { window } = dom;
  window.matchMedia = () => ({ matches: false });
  window.HTMLDialogElement.prototype.showModal = function () { throw new Error('Profile editor must not block GitHub'); };
  window.HTMLDialogElement.prototype.show = function () { this.setAttribute('open', ''); };
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  window.chrome = {
    storage: {
      local: { get: (_, callback) => callback({ settings }), set: (_, callback) => callback() },
      onChanged: { addListener(callback) {
        window.updateBetterGitHubSettings = value => callback({ settings: { newValue: value } }, 'local');
      } }
    },
    runtime: { sendMessage: (_, callback) => callback({ config, assetBase: 'https://raw.githubusercontent.com/Example/Example/main/.bettergithub.json' }) }
  };
  window.eval(script);
  await new Promise(resolve => setTimeout(resolve, 250));
  return dom;
}

function siblingIds(parent, prefix) {
  return [...parent.children].map(child => child.id).filter(id => id.startsWith(prefix));
}

test('Compact UI covers profiles in both modes without moving native blocks or editing the README', async () => {
  const settings = { mode: 'global', theme: 'compact', global: {}, sites: {} };
  const dom = await profile({}, { settings });
  const { document, updateBetterGitHubSettings } = dom.window;
  const main = document.querySelector('#user-profile-frame > .position-relative');
  const readme = document.querySelector('.markdown-body').outerHTML;
  const order = siblingIds(main, 'profile-');
  const infoParent = document.getElementById('profile-info').parentElement;
  const editButton = document.querySelector('.js-profile-editable-edit-button');
  const editMarkup = editButton.outerHTML;
  for (const theme of ['compact', 'compact-light', 'compact']) {
    updateBetterGitHubSettings({ ...settings, theme });
    assert.equal(document.documentElement.dataset.bghCompactProfile, 'yes');
    assert.ok(document.querySelector('[data-bgh-compact-part="profile-layout"]'));
    assert.equal(document.querySelector('.markdown-body').outerHTML, readme);
    assert.deepEqual(siblingIds(main, 'profile-'), order);
    assert.equal(document.getElementById('profile-info').parentElement, infoParent);
    assert.equal(editButton.outerHTML, editMarkup);
  }
  updateBetterGitHubSettings({ ...settings, theme: 'github' });
  assert.equal(document.documentElement.hasAttribute('data-bgh-compact-profile'), false);
  assert.equal(document.querySelectorAll('[data-bgh-compact-part]').length, 0);
  updateBetterGitHubSettings(settings);
  updateBetterGitHubSettings({ ...settings, themeDisabled: true });
  assert.equal(document.documentElement.hasAttribute('data-bgh-compact-profile'), false);
  assert.equal(document.querySelectorAll('[data-bgh-compact-part]').length, 0);
  assert.equal(document.querySelector('.markdown-body').outerHTML, readme);
  dom.window.close();
});

test('pausing restores original profile blocks and removes the editor and decorations', async () => {
  const dom = await profile({ banner: 'banner.png', layout: {
    profile: ['pinned', 'readme', 'contributions'],
    profileSidebar: ['highlights', 'achievements', 'info']
  } });
  const { document, updateBetterGitHubSettings } = dom.window;
  const original = new JSDOM(fixture()).window.document;
  document.getElementById('bgh-gear').click();
  updateBetterGitHubSettings({ mode: 'site', theme: 'github', sites: {}, themeDisabled: true });
  for (const id of ['profile-info', 'profile-readme', 'profile-pinned', 'profile-contributions', 'profile-achievements', 'profile-highlights']) {
    const node = document.getElementById(id);
    const expected = original.getElementById(id);
    assert.equal(node.parentElement.className, expected.parentElement.className, id);
    assert.equal(node.previousElementSibling?.id, expected.previousElementSibling?.id, id);
  }
  assert.equal(document.querySelector('[id^="bgh-"], .bgh-layout-handle, .bgh-reordered'), null);
  assert.equal(document.documentElement.hasAttribute('data-bgh'), false);
  dom.window.close();
});

test('profile previews background and banner from profile-repository shorthand and restores saved images on close', async () => {
  const dom = await profile({ appearance: { theme: 'forest', background: 'saved.png' }, banner: 'saved-banner.png' });
  const { window } = dom;
  const { document } = window;
  const base = 'https://raw.githubusercontent.com/Example/Example/main/';
  const background = () => document.documentElement.style.getPropertyValue('--bgh-background-image');
  const banner = () => document.querySelector('#bgh-profile-banner img')?.src;
  const type = (input, value) => {
    input.value = value;
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  document.getElementById('bgh-gear').click();
  const form = document.getElementById('bgh-form');
  type(form.elements.background, 'Example/image.png');
  type(form.elements.banner, 'Example/image.png');
  assert.equal(background(), `url("${base}image.png")`);
  assert.equal(banner(), base + 'image.png');
  type(form.elements.banner, './Example/image.png');
  assert.equal(banner(), base + 'Example/image.png');
  type(form.elements.banner, '');
  assert.equal(banner(), undefined);
  document.getElementById('bgh-close').click();
  assert.equal(background(), `url("${base}saved.png")`);
  assert.equal(banner(), base + 'saved-banner.png');
  dom.window.close();
});

test('published profile JSON reorders both columns by moving original siblings', async () => {
  const dom = await profile({ layout: {
    profile: ['pinned', 'readme', 'contributions'],
    profileSidebar: ['highlights', 'achievements', 'info']
  } });
  const doc = dom.window.document;
  const right = doc.querySelector('#user-profile-frame > .position-relative');
  const left = doc.querySelector('.js-profile-editable-replace');
  const nodes = Object.fromEntries(['profile-readme', 'profile-pinned', 'profile-contributions', 'profile-info', 'profile-achievements', 'profile-highlights'].map(id => [id, doc.getElementById(id)]));
  assert.deepEqual(siblingIds(right, 'profile-'), ['profile-pinned', 'profile-readme', 'profile-contributions']);
  assert.deepEqual(siblingIds(left, 'profile-'), ['profile-highlights', 'profile-achievements', 'profile-info']);
  assert.equal(left.firstElementChild.id, 'github-profile-identity');
  assert.equal(left.children[1].firstElementChild.id, 'github-profile-action');
  for (const [id, node] of Object.entries(nodes)) assert.equal(doc.getElementById(id), node);
  assert.equal(doc.querySelector('#profile-pinned .pinned-item-list-item a')?.getAttribute('href'), '/Example/Project');
  dom.window.close();
});

test('six-dot handles appear only after BetterGitHub layout editing starts and keep links clickable', async () => {
  const dom = await profile();
  const doc = dom.window.document;
  assert.equal(doc.querySelectorAll('[data-bgh-drag-handle]').length, 0);
  let nativeClicks = 0;
  doc.querySelector('#profile-pinned a').addEventListener('click', event => { nativeClicks++; event.preventDefault(); });
  doc.getElementById('bgh-gear').click();
  assert.equal(doc.getElementById('bgh-dialog')?.open, true);
  assert.equal(doc.getElementById('bgh-dialog')?.classList.contains('bgh-layout-editing'), true);
  for (const id of ['info', 'achievements', 'highlights', 'readme', 'pinned', 'contributions']) {
    const handle = doc.querySelector(`button[data-bgh-drag-handle="${id}"]`);
    assert.ok(handle, `missing ${id} handle`);
    assert.equal(handle.querySelectorAll('svg circle').length, 6);
  }
  doc.querySelector('#profile-pinned a').click();
  assert.equal(nativeClicks, 1);
  const edit = doc.querySelector('#github-profile-action button');
  assert.equal(edit?.textContent, 'Edit profile');
  assert.equal(edit.nextElementSibling?.id, 'bgh-gear');
  assert.equal(doc.querySelector('[data-bgh-drag-handle="info"]').parentElement.id, 'profile-info');
  assert.equal(doc.querySelector('#github-profile-identity [data-bgh-drag-handle]'), null);
  doc.getElementById('bgh-layout-cancel').click();
  assert.equal(doc.querySelectorAll('[data-bgh-drag-handle]').length, 0);
  assert.equal(doc.querySelector('#bgh-edit-layout').hidden, false);
  doc.getElementById('bgh-edit-layout').click();
  assert.equal(doc.querySelectorAll('[data-bgh-drag-handle]').length, 6);
  doc.getElementById('bgh-close').click();
  assert.equal(doc.querySelectorAll('[data-bgh-drag-handle]').length, 0);
  dom.window.close();
});

test('profile blocks move down with ArrowDown and a downward drop', async () => {
  const dom = await profile();
  const { window } = dom;
  const doc = window.document;
  doc.getElementById('bgh-gear').click();
  const main = doc.querySelector('#user-profile-frame > .position-relative');
  const readme = doc.querySelector('[data-bgh-drag-handle="readme"]');
  readme.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  assert.deepEqual(siblingIds(main, 'profile-'), ['profile-pinned', 'profile-readme', 'profile-contributions']);
  readme.dispatchEvent(new window.Event('dragstart', { bubbles: true }));
  doc.getElementById('profile-contributions').dispatchEvent(new window.Event('drop', { bubbles: true, cancelable: true }));
  assert.deepEqual(siblingIds(main, 'profile-'), ['profile-pinned', 'profile-contributions', 'profile-readme']);
  dom.window.close();
});

test('profile editor saves both orders locally and exports the same JSON arrays', async () => {
  const dom = await profile();
  const { window } = dom;
  const doc = window.document;
  let saved;
  let blob;
  window.chrome.storage.local.set = (value, callback) => { saved = value.settings; callback(); };
  window.URL.createObjectURL = value => { blob = value; return 'blob:profile-layout-test'; };
  window.URL.revokeObjectURL = () => {};
  doc.addEventListener('click', event => { if (event.target.download) event.preventDefault(); });
  doc.getElementById('bgh-gear').click();
  const drag = doc.querySelector('[data-bgh-drag-handle="pinned"]');
  const target = doc.querySelector('#profile-readme');
  drag.dispatchEvent(new window.Event('dragstart', { bubbles: true }));
  target.dispatchEvent(new window.Event('dragover', { bubbles: true, cancelable: true }));
  target.dispatchEvent(new window.Event('drop', { bubbles: true, cancelable: true }));
  const leftDrag = doc.querySelector('[data-bgh-drag-handle="highlights"]');
  const leftTarget = doc.querySelector('#profile-info');
  leftDrag.dispatchEvent(new window.Event('dragstart', { bubbles: true }));
  leftTarget.dispatchEvent(new window.Event('dragover', { bubbles: true, cancelable: true }));
  leftTarget.dispatchEvent(new window.Event('drop', { bubbles: true, cancelable: true }));
  doc.getElementById('bgh-export').click();
  const json = await new Promise((resolve, reject) => {
    const reader = new window.FileReader();
    reader.onload = () => resolve(JSON.parse(reader.result));
    reader.onerror = reject;
    reader.readAsText(blob);
  });
  assert.deepEqual(json.layout.profile, ['pinned', 'readme', 'contributions']);
  assert.deepEqual(json.layout.profileSidebar, ['highlights', 'info', 'achievements']);
  assert.equal(saved, undefined, 'export must not save the local draft');
  doc.getElementById('bgh-layout-save').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(Array.from(saved.sites['profile:example/example'].layout.profile), json.layout.profile);
  assert.deepEqual(Array.from(saved.sites['profile:example/example'].layout.profileSidebar), json.layout.profileSidebar);
  dom.window.close();
});

test('unknown IDs and absent cards do not create nodes or handles', async () => {
  const dom = await profile({ layout: {
    profile: ['unknown', 'contributions', 'pinned', 'readme'],
    profileSidebar: ['unknown', 'highlights', 'achievements', 'info']
  } }, { blocks: { pinned: false, highlights: false } });
  const doc = dom.window.document;
  assert.equal(doc.getElementById('profile-pinned'), null);
  assert.equal(doc.getElementById('profile-highlights'), null);
  doc.getElementById('bgh-gear').click();
  assert.equal(doc.querySelector('[data-bgh-drag-handle="pinned"]'), null);
  assert.equal(doc.querySelector('[data-bgh-drag-handle="highlights"]'), null);
  assert.equal(doc.querySelector('[data-bgh-drag-handle="unknown"]'), null);
  assert.deepEqual(siblingIds(doc.querySelector('#user-profile-frame > .position-relative'), 'profile-'), ['profile-contributions', 'profile-readme']);
  dom.window.close();
});

test('profile editor opens with no README and ignores repository metadata on a profile URL', async () => {
  const dom = await profile({}, { blocks: { readme: false, repoMeta: true } });
  const doc = dom.window.document;
  doc.getElementById('bgh-gear').click();
  assert.equal(doc.querySelector('#bgh-dialog.bgh-layout-editing')?.open, true);
  assert.equal(doc.querySelector('[data-bgh-drag-handle="readme"]'), null);
  for (const name of ['pinned', 'contributions', 'info', 'achievements', 'highlights']) {
    assert.ok(doc.querySelector(`[data-bgh-drag-handle="${name}"]`), name);
  }
  assert.equal(doc.querySelector('#bgh-target').textContent, 'Профиль Example');
  dom.window.close();
});

async function stageProfile(previous) {
  const dom = await profile();
  const { window } = dom;
  const doc = window.document;
  let draft;
  window.chrome.runtime.sendMessage = (message, callback) => {
    if (message.type === 'bettergithub:open-editor') {
      draft = message.draft;
      callback({ ok: true });
      return;
    }
    assert.deepEqual(JSON.parse(JSON.stringify(message)), {
      type: 'bettergithub:editor-target', owner: 'Example', repository: 'Example'
    });
    callback({ branch: 'main', filename: 'bettergithub.json', exists: true, config: previous });
  };
  doc.getElementById('bgh-gear').click();
  const form = doc.getElementById('bgh-form');
  form.elements.theme.value = 'amethyst';
  form.elements.theme.dispatchEvent(new window.Event('change', { bubbles: true }));
  doc.getElementById('bgh-github-save').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  dom.window.close();
  assert.equal(draft.filename, 'bettergithub.json');
  return JSON.parse(draft.json);
}

test('profile GitHub handoff preserves separate repository settings and clears old profile fields', async () => {
  const repositoryConfig = {
    appearance: { theme: 'midnight', accent: '#123456' },
    layout: { sidebar: ['packages', 'about'] },
    banner: 'assets/repository-banner.png',
    customField: { keep: true }
  };
  const staged = await stageProfile({
    ...repositoryConfig,
    layout: { ...repositoryConfig.layout, profile: ['pinned'], profileSidebar: ['info'] },
    profile: { banner: 'outdated.png' }
  });
  for (const [key, value] of Object.entries(repositoryConfig)) {
    assert.deepEqual(staged[key], value, `repository field ${key} changed`);
  }
  assert.equal(staged.profile.appearance.theme, 'amethyst');
  assert.deepEqual(staged.profile.layout.profile, ['readme', 'pinned', 'contributions']);
  assert.deepEqual(staged.profile.layout.profileSidebar, ['info', 'achievements', 'highlights']);
  assert.equal(staged.profile.layout.sidebar, undefined);
  assert.equal(staged.profile.banner, undefined);
});

test('profile GitHub handoff replaces the legacy root profile shown in the editor', async () => {
  const staged = await stageProfile({
    appearance: { theme: 'universe-dark' },
    layout: { profile: ['readme', 'pinned'], profileSidebar: ['info'] },
    banner: 'legacy-banner.png',
    icon: 'legacy-icon.png',
    profile: { appearance: { theme: 'forest' } }
  });
  assert.deepEqual(Object.keys(staged), ['profile']);
  assert.equal(staged.profile.appearance.theme, 'amethyst');
  assert.deepEqual(staged.profile.layout.profile, ['readme', 'pinned', 'contributions']);
});

test('profile editor adds handles when README and Pinned hydrate after opening', async () => {
  const dom = await profile({}, { blocks: { readme: false, pinned: false, contributions: false } });
  const doc = dom.window.document;
  doc.getElementById('bgh-gear').click();
  assert.equal(doc.querySelector('#bgh-layout-toolbar') !== null, true);
  assert.equal(doc.querySelector('[data-bgh-drag-handle="readme"]'), null);
  const main = doc.querySelector('#user-profile-frame > .position-relative');
  main.innerHTML = '<div class="profile-readme"><a href="/Example/Example/blob/main/README.md">README</a></div><div><div class="js-pinned-items-reorder-container"><h2>Pinned</h2></div></div><div class="tmp-mt-4 position-relative"><h2>Contributions</h2></div>';
  await new Promise(resolve => setTimeout(resolve, 450));
  for (const name of ['readme', 'pinned', 'contributions']) assert.ok(doc.querySelector(`[data-bgh-drag-handle="${name}"]`), name);
  dom.window.close();
});

test('saved profile theme applies locally and survives a fresh page', async () => {
  const dom = await profile();
  const doc = dom.window.document;
  let saved;
  dom.window.chrome.storage.local.set = (value, done) => { saved = value.settings; done(); };
  doc.getElementById('bgh-gear').click();
  const form = doc.getElementById('bgh-form');
  form.elements.theme.value = 'amethyst';
  form.elements.theme.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  form.elements.background.value = 'blob/main/изображение.png';
  form.elements.backgroundDim.value = '12';
  form.elements.backgroundPosition.value = 'bottom';
  form.elements.effectStrength.value = '80';
  form.elements.effect.value = 'glow';
  form.elements.effect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal(doc.documentElement.dataset.bghEffect, 'glow');
  assert.equal(doc.documentElement.style.getPropertyValue('--bgh-background-dim'), '12%');
  form.requestSubmit();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(doc.documentElement.dataset.bghTheme, 'amethyst');
  assert.equal(saved.sites['profile:example/example'].appearance.theme, 'amethyst');
  dom.window.close();
  const fresh = await profile({}, { settings: saved });
  const root = fresh.window.document.documentElement;
  assert.equal(root.dataset.bghTheme, 'amethyst');
  assert.equal(root.dataset.bghEffect, 'glow');
  assert.equal(root.style.getPropertyValue('--bgh-background-position'), 'bottom');
  assert.equal(root.style.getPropertyValue('--bgh-effect-strength'), '80%');
  assert.equal(root.style.getPropertyValue('--bgh-background-image'),
    'url("https://raw.githubusercontent.com/Example/Example/main/' + encodeURIComponent('изображение.png') + '")');
  fresh.window.close();
});

test('theme selection previews immediately and closing discards the preview', async () => {
  const dom = await profile({ appearance: { theme: 'amethyst' } });
  const doc = dom.window.document;
  assert.equal(doc.documentElement.dataset.bghTheme, 'amethyst');
  doc.getElementById('bgh-gear').click();
  const theme = doc.querySelector('#bgh-form [name="theme"]');
  theme.value = 'forest';
  theme.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal(doc.documentElement.dataset.bghTheme, 'forest');
  doc.getElementById('bgh-close').click();
  assert.equal(doc.documentElement.dataset.bghTheme, 'amethyst');
  dom.window.close();
});

test('profile editor keeps the panel open and reports a storage failure', async () => {
  const dom = await profile();
  const doc = dom.window.document;
  dom.window.chrome.runtime.lastError = { message: 'storage unavailable' };
  doc.getElementById('bgh-gear').click();
  const theme = doc.querySelector('#bgh-form [name="theme"]');
  theme.value = 'amethyst';
  theme.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  doc.getElementById('bgh-layout-save').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(doc.getElementById('bgh-dialog').open, true);
  assert.match(doc.getElementById('bgh-mode-hint').textContent, /storage unavailable/);
  dom.window.close();
});
