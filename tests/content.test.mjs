import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const script = readFileSync(new URL('../content.js', import.meta.url), 'utf8');
const html = `<!doctype html><html><head><meta name="octolytics-dimension-repository_nwo" content="Example/Project"></head><body>
<div data-testid="repo-name-wrapper"><strong>Project</strong></div>
<nav><a data-tab-item="code" href="/Example/Project"><span data-component="text">Code</span></a><a data-tab-item="issues" href="/Example/Project/issues"><span data-component="text">Issues</span></a></nav>
<main><button><span>Code</span></button><a href="/Example/Project/readme">Readme text</a><div class="borderGrid__VCnF9i">
<div class="sidebarSection__oqw6Y8"><h2>About <button type="button" id="github-gear" aria-label="Edit repository details" aria-controls="repo-details">⚙</button></h2></div>
<div class="sidebarSection__oqw6Y8"><h2>Releases</h2></div>
<div class="sidebarSection__oqw6Y8"><h2>Packages</h2></div>
<div class="sidebarSection__oqw6Y8"><h2>Contributors</h2></div>
<div class="sidebarSection__oqw6Y8"><h2>Languages</h2></div>
</div></main><dialog id="repo-details"><h2>Edit repository details</h2><form><input name="repo_description"><button type="submit" class="btn btn-primary">Save changes</button></form></dialog></body></html>`;

async function page(config, { settings = { mode: 'site', theme: 'universe', sites: {} }, plugins = {}, assetBase = 'https://raw.githubusercontent.com/Example/Project/main/.bettergithub.json', markup = html, url = 'https://github.com/Example/Project', githubDraft = null, editorDraft = null } = {}) {
  const dom = new JSDOM(markup, { url, runScripts: 'outside-only' });
  const { window } = dom;
  window.matchMedia = () => ({ matches: false });
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  window.HTMLDialogElement.prototype.show = function () { this.setAttribute('open', ''); };
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  window.chrome = {
    storage: {
      local: { get: (key, callback) => callback(key === 'githubDraft' ? { githubDraft } : { settings, ...plugins }), set: (_, callback) => callback() },
      onChanged: { addListener(callback) {
        window.updateBetterGitHubStorage = changes => callback(changes, 'local');
        window.updateBetterGitHubSettings = value => window.updateBetterGitHubStorage({ settings: { newValue: value } });
      } }
    },
    runtime: { sendMessage: (message, callback) => callback(message.type === 'bettergithub:editor-draft'
      ? { draft: editorDraft } : { config, assetBase, installUrl: null }) }
  };
  window.eval(script);
  await new Promise(resolve => setTimeout(resolve, 250));
  return dom;
}

const compactMarkup = `<!doctype html><html><head><meta name="octolytics-dimension-repository_nwo" content="Example/Project"></head><body>
<nav class="contextRegion"><a href="/Example/Project">Project</a></nav>
<main>
  <div id="native-heading"><div id="native-action-row">
    <div id="repo-title-component"><img alt="Example"><div data-testid="repo-name-wrapper">Project</div><span data-testid="repo-visibility-label">Public</span></div>
    <div><ul data-testid="repo-header-actions"><li><button id="native-fork">Fork</button></li><li><button id="native-star">Star</button></li></ul></div>
  </div></div>
  <div id="native-toolbar"><div><button class="overview-ref-selector">main</button></div><div id="native-controls"><div><input role="combobox" aria-label="Go to file"></div><button id="native-code" aria-haspopup="true"><svg class="octicon-code"></svg>Code</button></div></div>
  <div data-testid="directory-content"><table><tbody><tr><td>README.md</td></tr></tbody></table></div>
  <article class="markdown-body"><h1>Project</h1><hr><table><tbody><tr><td>Document cell</td></tr></tbody></table><p>Keep the document layout.</p></article>
</main></body></html>`;

const compactSectionMarkup = `<!doctype html><html><head><meta name="octolytics-dimension-repository_nwo" content="Example/Project"></head><body>
<nav><ul><li><a data-tab-item="code" href="/Example/Project">Code</a></li><li><a data-tab-item="pull-requests" href="/Example/Project/pulls">Pull requests</a></li></ul></nav>
<main><header class="prc-PageLayout-Header-example"><div><div id="section-action-row"><div><h1 data-testid="header-title">All pull requests</h1></div><div id="section-actions"><a data-component="Button" href="/Example/Project/labels"><svg class="octicon-tag"></svg>Labels</a><button id="native-section-menu" aria-haspopup="true"><svg class="octicon-milestone"></svg>Milestones</button><a data-component="Button" data-variant="primary" href="/Example/Project/compare">New pull request</a></div></div>
<div id="search-source"><div role="search"><input role="combobox" value="is:pr state:open"><button id="native-search-clear">Clear</button></div></div></div><div class="prc-PageLayout-HeaderHorizontalDivider-example"></div></header>
<div><div id="section-list-wrapper"><div id="repo-list-view-container"><div id="repo-list-view-metadata"><button>Author</button></div><ul role="list"><li>Existing result</li></ul></div></div></div></main></body></html>`;

for (const route of ['pulls', 'issues']) test(`Compact UI joins ${route} controls without replacing native buttons or search`, async () => {
  const settings = { mode: 'global', theme: 'compact', global: {}, sites: {} };
  const dom = await page({}, { settings, markup: compactSectionMarkup, url: `https://github.com/Example/Project/${route}` });
  const { document, updateBetterGitHubSettings } = dom.window;
  const actions = document.getElementById('section-actions');
  const nativeMarkup = new JSDOM(compactSectionMarkup).window.document.getElementById('section-actions').innerHTML;
  assert.equal(actions.innerHTML, nativeMarkup);
  assert.equal(document.querySelector('h1').dataset.bghCompactPart, 'section-title');
  assert.equal(actions.dataset.bghCompactPart, 'section-actions');
  const search = document.querySelector('[role="search"]');
  const input = search.querySelector('input');
  assert.equal(search.parentElement.id, 'section-list-wrapper');
  assert.equal(search.nextElementSibling.id, 'repo-list-view-container');
  assert.equal(input.value, 'is:pr state:open');
  let menuClicks = 0;
  document.getElementById('native-section-menu').addEventListener('click', () => menuClicks++);
  document.getElementById('native-section-menu').click();
  assert.equal(menuClicks, 1);
  updateBetterGitHubSettings({ ...settings, themeDisabled: true });
  assert.equal(search.parentElement.id, 'search-source');
  assert.equal(actions.innerHTML, nativeMarkup);
  assert.equal(document.querySelectorAll('[data-bgh-compact-part]').length, 0);
  updateBetterGitHubSettings(settings);
  assert.equal(search.parentElement.id, 'section-list-wrapper');
  dom.window.history.pushState({}, '', '/Example/Project/pull/12');
  dom.window.dispatchEvent(new dom.window.Event('popstate'));
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(search.parentElement.id, 'search-source');
  assert.equal(document.querySelectorAll('[data-bgh-compact-part]').length, 0, 'Do not hide individual PR titles');
  dom.window.close();
});

test('Compact UI follows a replaced section root without leaving duplicate search fields', async () => {
  const dom = await page({}, { settings: { mode: 'global', theme: 'compact-light', global: {}, sites: {} },
    markup: compactSectionMarkup, url: 'https://github.com/Example/Project/pulls' });
  const { document } = dom.window;
  const replacement = new dom.window.DOMParser().parseFromString(compactSectionMarkup, 'text/html').querySelector('main');
  document.querySelector('main').replaceWith(document.adoptNode(replacement));
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(document.querySelectorAll('main input[role="combobox"]').length, 1);
  assert.equal(document.querySelector('[role="search"]').parentElement.id, 'section-list-wrapper');
  assert.equal(document.querySelectorAll('[data-bgh-compact-part="section-actions"]').length, 1);
  dom.window.close();
});

test('Compact UI updates during continuous GitHub mutations instead of waiting for page idle', async () => {
  const dom = await page({}, { settings: { mode: 'global', theme: 'compact', global: {}, sites: {} },
    markup: compactSectionMarkup, url: 'https://github.com/Example/Project/pulls' });
  const { document } = dom.window;
  const replacement = new dom.window.DOMParser().parseFromString(compactSectionMarkup, 'text/html').querySelector('main');
  document.querySelector('main').replaceWith(document.adoptNode(replacement));
  const activity = dom.window.setInterval(() => {
    const marker = document.createElement('span');
    document.body.append(marker);
    marker.remove();
  }, 10);
  await new Promise(resolve => setTimeout(resolve, 120));
  dom.window.clearInterval(activity);
  assert.equal(document.querySelector('[role="search"]').parentElement.id, 'section-list-wrapper');
  assert.equal(document.querySelectorAll('[data-bgh-compact-part="section-actions"]').length, 1);
  dom.window.close();
});

for (const path of ['/orgs/Example/projects', '/Example/Project/projects']) test(`Compact UI follows Projects without repository metadata: ${path}`, async () => {
  const dom = await page({}, { settings: { mode: 'global', theme: 'compact', global: {}, sites: {} },
    markup: compactSectionMarkup.replace('<meta name="octolytics-dimension-repository_nwo" content="Example/Project">', ''),
    url: `https://github.com${path}` });
  assert.equal(dom.window.document.querySelector('[role="search"]').parentElement.id, 'section-list-wrapper');
  assert.equal(dom.window.document.querySelector('[data-bgh-compact-part="section-frame"]').id, 'section-list-wrapper');
  dom.window.close();
});

test('Compact UI joins a legacy div README and keeps private metadata stable across repeated theme switches', async () => {
  const markup = compactMarkup
    .replace('<div id="repo-title-component">', '<div class="TitleWrapper" style="flex:1;width:100%"><div id="repo-title-component">')
    .replace('>Public</span></div>', '>Private</span></div></div>')
    .replace('<div data-testid="directory-content">', '<div id="legacy-stack"><div id="legacy-files"><div data-testid="directory-content">')
    .replace('</table></div>\n  <article class="markdown-body">', '</table></div></div><div id="legacy-readme" class="Box"><div class="Box-header">README</div><div class="Box-body"><div class="markdown-body">')
    .replace('</article>', '</div></div></div></div>');
  const settings = { mode: 'global', theme: 'compact', global: {}, sites: {} };
  const dom = await page({}, { settings, markup });
  const { document, updateBetterGitHubSettings } = dom.window;
  const content = document.querySelector('.markdown-body').outerHTML;
  for (let index = 0; index < 6; index++) {
    updateBetterGitHubSettings({ ...settings, theme: index % 2 ? 'compact-light' : 'compact' });
    assert.equal(document.querySelector('[data-bgh-compact-part="title-wrapper"]').className, 'TitleWrapper');
    assert.equal(document.querySelector('[data-bgh-compact-part="readme-frame"]').id, 'legacy-readme');
    assert.equal(document.querySelector('[data-bgh-compact-part="content-stack"]').id, 'legacy-stack');
    assert.equal(document.querySelectorAll('[data-testid="repo-visibility-label"]').length, 1);
    assert.equal(document.querySelector('[data-testid="repo-visibility-label"]').textContent, 'Private');
    assert.equal(document.querySelector('.markdown-body').outerHTML, content);
    updateBetterGitHubSettings({ ...settings, themeDisabled: true });
    assert.equal(document.querySelectorAll('[data-bgh-compact-part]').length, 0);
    assert.equal(document.getElementById('native-action-row').parentElement.id, 'native-heading');
  }
  dom.window.close();
});

for (const legacy of [false, true]) test(`Compact UI places visibility beside About and restores it (${legacy ? 'legacy' : 'modern'} sidebar)`, async () => {
  const sidebar = legacy
    ? '<aside><div class="BorderGrid"><div class="BorderGrid-row"><div class="BorderGrid-cell"><h2>About</h2><p>No description, website, or topics provided.</p></div></div><div class="BorderGrid-row"><div class="BorderGrid-cell"><h2>Releases</h2><p>Latest release</p></div></div></div></aside>'
    : '<aside><div class="borderGrid__example"><div class="sidebarSection__example"><h2>About</h2><p>Description</p></div><div class="sidebarSection__example"><h2>Releases</h2><p>Latest release</p></div></div></aside>';
  const settings = { mode: 'global', theme: 'compact', global: {}, sites: {} };
  const dom = await page({}, { settings, markup: compactMarkup.replace('</main>', sidebar + '</main>') });
  const { document, updateBetterGitHubSettings } = dom.window;
  const label = document.querySelector('[data-testid="repo-visibility-label"]');
  assert.equal(label.parentElement.tagName, 'H2');
  assert.equal(label.previousSibling.textContent, 'About');
  assert.equal(document.getElementById('native-controls').contains(label), false);
  assert.equal(document.querySelectorAll('[data-bgh-compact-part="sidebar-section"]').length, 2);
  if (legacy) assert.equal(document.querySelector('[data-bgh-compact-part="empty-description"]').tagName, 'P');
  updateBetterGitHubSettings({ ...settings, theme: 'compact-light' });
  assert.equal(document.querySelectorAll('[data-testid="repo-visibility-label"]').length, 1);
  updateBetterGitHubSettings({ ...settings, themeDisabled: true });
  assert.equal(label.parentElement.id, 'repo-title-component');
  assert.equal(document.querySelectorAll('[data-bgh-compact-part]').length, 0);
  assert.equal(document.querySelector('aside h2').textContent, 'About');
  dom.window.close();
});

test('Compact UI moves native actions, retains visibility and restores the original DOM on disable', async () => {
  const dom = await page({}, { markup: compactMarkup });
  const { document, updateBetterGitHubSettings } = dom.window;
  const header = document.getElementById('native-action-row');
  const originalParent = header.parentElement;
  const readme = document.querySelector('.markdown-body').outerHTML;
  const fork = document.getElementById('native-fork');
  let clicks = 0;
  fork.addEventListener('click', () => { clicks++; });
  assert.equal(document.documentElement.hasAttribute('data-bgh-compact'), false);

  updateBetterGitHubSettings({mode:'global',theme:'compact',global:{},sites:{}});
  assert.equal(document.documentElement.dataset.bghCompact, 'yes');
  assert.equal(header.parentElement.id, 'native-controls');
  assert.equal(header.nextElementSibling.id, 'native-code');
  assert.equal(header.hasAttribute('data-bgh-compact-duplicate'), true);
  assert.ok(header.querySelector('[data-testid="repo-visibility-label"]'));
  assert.equal(document.querySelectorAll('#native-fork').length, 1);
  fork.click();
  assert.equal(clicks, 1);
  assert.equal(document.querySelector('.markdown-body').outerHTML, readme);

  updateBetterGitHubSettings({mode:'global',theme:'github',global:{},sites:{}});
  assert.equal(header.parentElement, originalParent);
  assert.equal(header.hasAttribute('data-bgh-compact-duplicate'), false);
  assert.equal(document.querySelectorAll('[data-bgh-compact-part]').length, 0);
  assert.equal(document.documentElement.hasAttribute('data-bgh-compact'), false);
  assert.equal(document.querySelector('.markdown-body').outerHTML, readme);
  dom.window.close();
});

test('Compact UI keeps the repository title when no breadcrumb exists and clears on profile navigation', async () => {
  const dom = await page({}, {
    markup: compactMarkup.replace('<nav class="contextRegion"><a href="/Example/Project">Project</a></nav>', ''),
    settings: {mode:'global',theme:'compact',global:{},sites:{}}
  });
  const { document } = dom.window;
  const header = document.getElementById('native-action-row');
  assert.equal(header.parentElement.id, 'native-controls');
  assert.equal(header.hasAttribute('data-bgh-compact-duplicate'), false);
  dom.window.history.pushState({}, '', '/Example');
  dom.window.dispatchEvent(new dom.window.Event('popstate'));
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(document.documentElement.hasAttribute('data-bgh-compact'), false);
  assert.equal(header.parentElement.id, 'native-heading');
  dom.window.close();
});

test('Compact UI light switches GitHub to light and restores the original mode when paused', async () => {
  const settings = { mode: 'global', theme: 'compact-light', global: {}, sites: {} };
  const dom = await page({}, { settings, markup: compactMarkup.replace('<html>', '<html data-color-mode="dark">') });
  const root = dom.window.document.documentElement;
  assert.equal(root.dataset.bghTheme, 'compact-light');
  assert.equal(root.dataset.bghCompact, 'yes');
  assert.equal(root.getAttribute('data-color-mode'), 'light');
  dom.window.updateBetterGitHubSettings({ ...settings });
  assert.equal(root.getAttribute('data-color-mode'), 'light');
  dom.window.updateBetterGitHubSettings({ ...settings, themeDisabled: true });
  assert.equal(root.getAttribute('data-color-mode'), 'dark');
  assert.equal(root.hasAttribute('data-bgh'), false);
  assert.equal(dom.window.document.querySelectorAll('[data-bgh-compact-part]').length, 0);
  dom.window.close();
});

test('Compact UI separates fork metadata from actions and joins the branch status to files', async () => {
  const nativeButtons = '<button id="contribute" class="prc-Button-ButtonBase" data-variant="default" aria-haspopup="true"><svg class="octicon octicon-git-pull-request"></svg><span>Contribute</span><svg class="octicon octicon-triangle-down"></svg></button><button id="sync-fork" class="prc-Button-ButtonBase" data-variant="default" aria-haspopup="true"><svg class="octicon octicon-sync"></svg><span>Sync fork</span><svg class="octicon octicon-triangle-down"></svg></button>';
  const markup = compactMarkup
    .replace('<div><ul data-testid="repo-header-actions">', '<div id="fork-origin-parent"><span data-testid="fork-parent">forked from <a href="/Upstream/Project">Upstream/Project</a></span></div><div><ul data-testid="repo-header-actions">')
    .replace('<div data-testid="directory-content">', `<div id="branch-original-parent"><div data-testid="branch-info-bar"><a href="/Upstream/Project/compare">This branch is behind</a>${nativeButtons}</div><div id="file-stack"><div id="file-frame"><div data-testid="directory-content">`)
    .replace('</table></div>\n  <article', '</table></div></div><div id="readme-frame"><div><div class="js-snippet-clipboard-copy-unpositioned"><article')
    .replace('</article>', '</article></div></div></div></div></div>');
  const settings = { mode: 'global', theme: 'compact', global: {}, sites: {} };
  const dom = await page({ layout: { repository: ['readme', 'code'] } }, { settings, markup });
  const { document, updateBetterGitHubSettings } = dom.window;
  const origin = document.querySelector('[data-testid="fork-parent"]');
  const status = document.querySelector('[data-testid="branch-info-bar"]');
  const sync = document.getElementById('sync-fork');
  const buttonMarkup = () => [...status.querySelectorAll('button')].map(node => node.outerHTML).join('');
  assert.equal(buttonMarkup(), nativeButtons, 'Keep native button classes, icons, carets and menu attributes intact');
  let clicks = 0;
  sync.addEventListener('click', () => clicks++);
  assert.equal(origin.parentElement.id, 'native-toolbar');
  assert.equal(document.getElementById('native-controls').contains(origin), false);
  assert.equal(origin.querySelector('a').getAttribute('href'), '/Upstream/Project');
  assert.equal(status.parentElement.id, 'file-stack');
  assert.equal(status.nextElementSibling.id, 'file-frame');
  assert.equal(document.getElementById('readme-frame').style.order, '0');
  assert.equal(document.getElementById('file-frame').style.order, '1');
  sync.click();
  assert.equal(clicks, 1);
  updateBetterGitHubSettings({ ...settings, themeDisabled: true });
  assert.equal(origin.parentElement.id, 'fork-origin-parent');
  assert.equal(status.parentElement.id, 'branch-original-parent');
  assert.equal(status.nextElementSibling.id, 'file-stack');
  assert.equal(buttonMarkup(), nativeButtons);
  assert.equal(document.querySelectorAll('[data-bgh-compact-part]').length, 0);
  sync.click();
  assert.equal(clicks, 2);
  dom.window.close();
});

test('applies repository JSON to current GitHub sidebar and install action', async () => {
  const dom = await page({
    appearance: { theme: 'universe', accent: '#008b2b' },
    banner: 'assets/баннер.png', icon: 'assets/icon.png',
    installUrl: 'https://github.com/Example/Project/releases/download/v1/setup.zip',
    layout: { sidebar: ['contributors', 'about', 'releases', 'packages', 'languages'] }
  });
  const doc = dom.window.document;
  assert.equal(doc.documentElement.dataset.bghTheme, 'universe');
  assert.equal(doc.documentElement.getAttribute('data-color-mode'), 'light');
  assert.equal(doc.getElementById('bgh-universe-masthead'), null);
  assert.equal(doc.querySelectorAll('#bgh-cursor-trail span').length, 40);
  assert.equal(doc.querySelector('#bgh-banner img')?.src, 'https://raw.githubusercontent.com/Example/Project/main/assets/' + encodeURIComponent('баннер.png'));
  assert.equal(doc.querySelector('#bgh-banner')?.style.order, '1');
  assert.equal(doc.querySelector('#bgh-repo-icon')?.src, 'https://raw.githubusercontent.com/Example/Project/main/assets/icon.png');
  assert.equal(doc.querySelector('#bgh-install')?.href, 'https://github.com/Example/Project/releases/download/v1/setup.zip');
  assert.equal(doc.querySelector('[class*="borderGrid__"]')?.classList.contains('bgh-reordered'), true);
  assert.equal([...doc.querySelectorAll('[class*="borderGrid__"] > [class*="sidebarSection__"]')].find(row => row.querySelector('h2')?.textContent === 'Contributors')?.style.order, '0');
  dom.window.close();
});

test('turning themes off restores GitHub even when the page has an author theme', async () => {
  const settings = { mode: 'site', theme: 'midnight', sites: {} };
  const dom = await page({
    appearance: { theme: 'universe', accent: '#008b2b', background: 'assets/bg.png' },
    layout: { sidebar: ['contributors', 'about', 'releases', 'packages', 'languages'] }
  }, { settings, markup: html.replace(/<html(?=[\s>])/, '<html data-color-mode="dark"') });
  const { document, updateBetterGitHubSettings } = dom.window;
  const root = document.documentElement;
  assert.equal(root.getAttribute('data-color-mode'), 'light');
  assert.equal(root.dataset.bghBackground, 'yes');
  updateBetterGitHubSettings({ ...settings, themeDisabled: true });
  assert.equal(root.dataset.bgh, undefined);
  assert.equal(root.getAttribute('data-color-mode'), 'dark');
  assert.equal(root.dataset.bghBackground, undefined);
  assert.equal(root.style.getPropertyValue('--bgh-accent'), '');
  assert.equal(document.getElementById('bgh-cursor-trail'), null);
  assert.equal(document.querySelector('.bgh-reordered'), null);
  updateBetterGitHubSettings({ ...settings, themeDisabled: false });
  assert.equal(root.dataset.bghTheme, 'universe');
  assert.equal(root.dataset.bghBackground, 'yes');
  dom.window.close();
});

test('rounded theme applies through page settings and clears its palette on theme off', async () => {
  const settings = { mode: 'site', theme: 'github', language: 'en', sites: {} };
  const dom = await page({ appearance: { theme: 'rounded' } }, { settings });
  const { document, updateBetterGitHubSettings } = dom.window;
  const root = document.documentElement;
  assert.equal(root.dataset.bghTheme, 'rounded');
  assert.equal(root.getAttribute('data-color-mode'), 'dark');
  assert.equal(root.style.getPropertyValue('--bgh-accent'), '#91e2bd');
  assert.equal(document.getElementById('bgh-cursor-trail'), null);
  document.getElementById('bgh-gear').click();
  assert.equal(document.querySelector('#bgh-form [name="theme"]').value, 'rounded');
  assert.equal(document.querySelector('#bgh-form option[value="rounded"]').textContent, 'Rounded');
  updateBetterGitHubSettings({ ...settings, themeDisabled: true });
  assert.equal(root.dataset.bghTheme, undefined);
  assert.equal(root.style.getPropertyValue('--bgh-accent'), '');
  dom.window.close();
});

test('softening light themes changes backgrounds while preserving text, icons and accent', async () => {
  const settings = { mode: 'site', theme: 'github', dimLightThemes: true, sites: {} };
  const appearance = { theme: 'rounded-light', text: '#ffffff', muted: '#aabbcc', accent: '#123456' };
  const dom = await page({ appearance }, { settings });
  const { document, updateBetterGitHubSettings } = dom.window;
  const root = document.documentElement;
  const color = name => root.style.getPropertyValue(`--bgh-${name}`);
  assert.equal(root.dataset.bghTheme, 'rounded-light');
  assert.equal(root.getAttribute('data-color-mode'), 'light');
  assert.notEqual(color('base'), '#f3f3f6');
  assert.notEqual(color('surface'), '#ffffff');
  assert.equal(color('text'), '#ffffff');
  assert.equal(color('muted'), '#aabbcc');
  assert.equal(color('accent'), '#123456');
  const softenedBase = color('base');
  updateBetterGitHubSettings({ ...settings });
  assert.equal(color('base'), softenedBase, 'reapplying does not compound the dimming');
  updateBetterGitHubSettings({ ...settings, dimLightThemes: false });
  assert.equal(color('base'), '#f3f3f6');
  assert.equal(color('surface'), '#ffffff');
  dom.window.close();
});

test('dark palettes retain their colors when softening is enabled', async () => {
  const dom = await page({ appearance: { theme: 'rounded' } }, {
    settings: { mode: 'site', theme: 'github', dimLightThemes: true, sites: {} }
  });
  const root = dom.window.document.documentElement;
  assert.equal(root.style.getPropertyValue('--bgh-base'), '#101012');
  assert.equal(root.style.getPropertyValue('--bgh-surface'), '#1b1b20');
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

test('adds appearance to the native repository details dialog and preserves the GitHub action', async () => {
  const dom = await page({});
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#bgh-install'), null);
  assert.equal(doc.querySelector('[data-bgh-original-code]'), null);
  assert.equal(doc.querySelector('.bgh-reordered'), null);
  assert.equal(doc.querySelector('main button')?.textContent.trim(), 'Code');
  let nativeClicks = 0;
  doc.getElementById('github-gear').addEventListener('click', () => { nativeClicks++; doc.getElementById('repo-details').showModal(); });
  doc.getElementById('github-gear').click();
  assert.equal(nativeClicks, 1);
  assert.equal(doc.getElementById('bgh-dialog'), null);
  assert.equal(doc.getElementById('bgh-gear').textContent, 'Оформление BetterGitHub');
  assert.equal(doc.getElementById('bgh-gear').closest('dialog').id, 'repo-details');
  const replacement = doc.getElementById('bgh-gear').cloneNode(true);
  doc.getElementById('bgh-gear').replaceWith(replacement);
  doc.getElementById('bgh-gear').click();
  assert.equal(doc.getElementById('bgh-dialog')?.open, true);
  assert.equal(nativeClicks, 1);
  assert.equal(doc.getElementById('repo-details').open, false);
  dom.window.close();
});

test('shows the repository editor when About uses an unrecognized wrapper', async () => {
  const markup = html.replace('class="sidebarSection__oqw6Y8"><h2>About', 'class="newAboutLayout"><h2>About');
  const dom = await page({}, { markup });
  const doc = dom.window.document;
  const nativeGear = doc.getElementById('github-gear');
  const editor = doc.getElementById('bgh-gear');
  assert.ok(editor);
  assert.equal(editor.closest('dialog').id, 'repo-details');
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

test('repository visitors without native edit access get no appearance action', async () => {
  const markup = html.replace(/<button[^>]*id="github-gear"[^>]*>.*?<\/button>/, '');
  const dom = await page({ appearance: { theme: 'rounded' } }, { markup });
  const doc = dom.window.document;
  assert.equal(doc.documentElement.dataset.bghTheme, 'rounded');
  assert.equal(doc.getElementById('bgh-gear'), null);
  assert.equal(doc.getElementById('bgh-dialog'), null);
  dom.window.close();
});

test('disabling the repository theme editor closes its preview and keeps the published theme', async () => {
  const dom = await page({ appearance: { theme: 'rounded-light' } }, {
    settings: { mode: 'site', dimLightThemes: true }
  });
  const { document, updateBetterGitHubStorage } = dom.window;
  const root = document.documentElement;
  assert.equal(root.style.getPropertyValue('--bgh-surface'), '#dadada');
  document.getElementById('bgh-gear').click();
  const dialog = document.getElementById('bgh-dialog');
  const preset = dialog.querySelector('[name="theme"]');
  preset.value = 'rounded';
  preset.dispatchEvent(new dom.window.Event('change'));
  assert.equal(root.dataset.bghTheme, 'rounded');

  updateBetterGitHubStorage({
    pluginRepositoryThemes: { newValue: false },
    pluginDimLightThemes: { newValue: false }
  });
  assert.equal(dialog.open, false);
  assert.equal(document.getElementById('bgh-gear'), null);
  assert.ok(document.getElementById('github-gear'));
  assert.equal(root.dataset.bghTheme, 'rounded-light');
  assert.equal(root.style.getPropertyValue('--bgh-surface'), '#ffffff');

  updateBetterGitHubStorage({ pluginRepositoryThemes: { newValue: true } });
  assert.ok(document.getElementById('bgh-gear'));
  dom.window.close();
});

test('appearance action follows a lazily rendered native details dialog', async () => {
  const markup = html.replace(/<dialog id="repo-details">.*?<\/dialog>/, '');
  const dom = await page({}, { markup });
  const { document } = dom.window;
  assert.equal(document.getElementById('bgh-gear'), null);
  const nativeDialog = document.createElement('dialog');
  nativeDialog.id = 'repo-details';
  nativeDialog.innerHTML = '<h2>Edit repository details</h2><button type="button" aria-label="Close">Close</button><input name="repo_description"><button type="submit">Save changes</button>';
  document.body.append(nativeDialog);
  nativeDialog.showModal();
  await new Promise(resolve => setTimeout(resolve, 250));
  const appearance = document.getElementById('bgh-gear');
  assert.equal(appearance?.parentElement, nativeDialog);
  assert.equal(appearance.type, 'button');
  assert.equal(document.querySelectorAll('#bgh-gear').length, 1);
  appearance.click();
  assert.equal(nativeDialog.open, false);
  assert.equal(document.getElementById('bgh-dialog')?.open, true);
  document.getElementById('bgh-close').click();
  document.getElementById('github-gear').remove();
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(document.getElementById('bgh-gear'), null);
  dom.window.close();
});

test('stages repository JSON and opens the edit route for existing bettergithub.json', async () => {
  const dom = await page({});
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

const organizationMarkup = '<!doctype html><html><body><main><div class="orghead"><h1>Example</h1></div></main></body></html>';

test('modern organization header exposes the organization theme action in English', async () => {
  const dom = await page({}, {
    markup: organizationMarkup.replace('class="orghead"', 'data-testid="organization-header"'),
    url: 'https://github.com/Example', settings: { language: 'en', mode: 'site', theme: 'github', sites: {} }
  });
  const doc = dom.window.document;
  doc.getElementById('bgh-gear').click();
  assert.equal(doc.querySelector('#bgh-form h2').textContent, 'Organization appearance');
  assert.equal(doc.getElementById('bgh-github-save').textContent, 'Save organization theme to GitHub');
  assert.match(doc.querySelector('#bgh-form > p.bgh-hint:last-child').textContent, /Example\/\.github\/\.bettergithub\.json/);
  dom.window.close();
});

test('organization button saves to .github and preserves the other config scopes', async () => {
  const dom = await page({}, { markup: organizationMarkup, url: 'https://github.com/Example' });
  const { window } = dom;
  const doc = window.document;
  let draft;
  const previous = { appearance: { theme: 'midnight' }, profile: { banner: 'keep.png' }, custom: true };
  window.open = () => ({ close() {} });
  window.chrome.runtime.sendMessage = (message, done) => {
    if (message.type === 'bettergithub:open-editor') {
      draft = message.draft;
      done({ ok: true });
      return;
    }
    assert.equal(message.owner, 'Example');
    assert.equal(message.repository, '.github');
    done({ branch: 'docs', filename: 'bettergithub.json', exists: true, config: previous });
  };
  doc.getElementById('bgh-gear').click();
  assert.match(doc.querySelector('#bgh-form h2').textContent, /организации/);
  const form = doc.getElementById('bgh-form');
  form.elements.theme.value = 'forest';
  doc.getElementById('bgh-github-save').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(draft.branch, 'docs');
  assert.equal(draft.repository, '.github');
  const output = JSON.parse(draft.json);
  for (const [key, value] of Object.entries(previous)) assert.deepEqual(output[key], value);
  assert.equal(output.organization.appearance.theme, 'forest');
  assert.equal(draft.kind, 'org');
  dom.window.close();
});

test('missing organization repository keeps the theme through creation and resumes in its editor', async () => {
  const dom = await page({}, { markup: organizationMarkup, url: 'https://github.com/Example' });
  const { window } = dom;
  let draft;
  const opened = { closed: false, location: {} };
  window.open = () => opened;
  window.chrome.storage.local.set = (value, done) => { draft = value.githubDraft; done(); };
  window.chrome.runtime.sendMessage = (_, done) => done({ missingRepository: true });
  window.document.getElementById('bgh-gear').click();
  window.document.getElementById('bgh-form').elements.theme.value = 'forest';
  window.document.getElementById('bgh-github-save').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  const create = new URL(opened.location.href);
  assert.equal(create.pathname, '/new');
  assert.equal(create.searchParams.get('owner'), 'Example');
  assert.equal(create.searchParams.get('name'), '.github');
  assert.equal(create.searchParams.get('visibility'), 'public');
  assert.equal(draft.awaitingRepository, true);
  assert.equal(draft.organizationConfig.appearance.theme, 'forest');
  assert.equal(JSON.parse(draft.json).organization.appearance.theme, 'forest');
  dom.window.close();

  const creating = await page({}, { markup: '<html><body><main>Create a repository</main></body></html>', url: create.href, githubDraft: draft });
  assert.ok(creating.window.document.getElementById('bgh-organization-continue'));
  assert.match(creating.window.document.getElementById('bgh-github-draft-status').textContent, /README/);
  creating.window.close();

  const repository = await page({}, { markup: html.replaceAll('Project', '.github'), url: 'https://github.com/Example/.github', githubDraft: draft });
  let prepared;
  repository.window.chrome.runtime.sendMessage = (message, done) => {
    if (message.type === 'bettergithub:open-editor') {
      prepared = message.draft;
      done({ ok: true });
      return;
    }
    assert.equal(message.repository, '.github');
    done({ branch: 'main', filename: '.bettergithub.json', exists: false, config: null });
  };
  repository.window.document.getElementById('bgh-organization-continue').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(prepared.filename, '.bettergithub.json');
  assert.equal(prepared.exists, false);
  assert.equal(prepared.awaitingRepository, undefined);
  assert.equal(prepared.kind, 'org');
  assert.equal(JSON.parse(prepared.json).organization.appearance.theme, 'forest');
  assert.equal(JSON.parse(prepared.json).appearance, undefined);
  repository.window.close();
});

test('organization draft does not appear on another owner or after expiry', async () => {
  const draft = {
    owner: 'Example', repository: '.github', kind: 'org', awaitingRepository: true,
    organizationConfig: { appearance: { theme: 'forest' } }, json: '{}', createdAt: Date.now()
  };
  for (const [url, saved] of [
    ['https://github.com/new?owner=Other&name=.github', draft],
    ['https://github.com/Other/.github', draft],
    ['https://github.com/Example/.github', { ...draft, createdAt: Date.now() - 21 * 60_000 }]
  ]) {
    const dom = await page({}, { markup: '<html><body><main></main></body></html>', url, githubDraft: saved });
    assert.equal(dom.window.document.getElementById('bgh-organization-continue'), null);
    dom.window.close();
  }
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
        get: (_, callback) => callback({ settings: {} })
      },
      onChanged: { addListener() {} }
    },
    runtime: { sendMessage: (message, callback) => {
      if (message.type === 'bettergithub:editor-draft') return callback({ draft });
      if (message.type === 'bettergithub:update-editor-draft') {
        if (message.attempted) draft.attempted = true;
        if (message.handled) draft.handled = true;
        return callback({ ok: true });
      }
      callback({ config: { appearance: { theme: 'amethyst' } } });
    } }
  };
  window.eval(script);
  await new Promise(resolve => setTimeout(resolve, 180));
  const doc = window.document;
  assert.equal(doc.documentElement.dataset.bghTheme, 'amethyst', 'the configured theme remains visible in the editor');
  assert.equal(doc.getElementById('bgh-gear'), null, 'appearance button is hidden on file editor routes');
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
        get: (_, callback) => callback({ settings: {} })
      },
      onChanged: { addListener() {} }
    },
    runtime: { sendMessage: (message, callback) => callback(message.type === 'bettergithub:editor-draft' ? { draft } : { config: null }) }
  };
  revisit.window.eval(script);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(revisit.window.document.querySelector('textarea[name="value"]').value, 'my later edit');
  assert.match(revisit.window.document.getElementById('bgh-github-draft-status').textContent, /уже выполнялась|already ran/i);
  revisit.window.close();
});

test('cleans an old profile draft and replaces the editor only when explicitly requested', async () => {
  const profile = { appearance: { theme: 'forest' } };
  const legacy = {
    appearance: { theme: 'midnight' },
    layout: { profile: ['readme'], profileSidebar: ['info'] },
    profile
  };
  const draft = {
    owner: 'Example', repository: 'Example', branch: 'main', filename: 'bettergithub.json',
    kind: 'profile', exists: true, attempted: true, createdAt: Date.now(), json: JSON.stringify(legacy)
  };
  const dom = await page({}, {
    markup: '<html><head><meta name="octolytics-dimension-repository_nwo" content="Example/Example"></head><body><main><div id="editor-actions"></div><textarea name="value">an unsaved edit</textarea></main></body></html>',
    url: 'https://github.com/Example/Example/edit/main/bettergithub.json',
    editorDraft: draft
  });
  const { document } = dom.window;
  const editor = document.querySelector('textarea[name="value"]');
  const panel = document.getElementById('bgh-github-draft');
  assert.equal(editor.value, 'an unsaved edit');
  assert.deepEqual(JSON.parse(panel.querySelector('textarea').value), { profile });
  const actions = document.getElementById('editor-actions');
  actions.innerHTML = '<div><a class="Button Button--secondary" data-variant="default" data-size="medium">Cancel changes</a></div><div><button>Commit changes…</button></div>';
  await new Promise(resolve => setTimeout(resolve, 250));
  const replace = document.getElementById('bgh-github-paste');
  assert.equal(replace.textContent, 'Paste BetterGitHub');
  assert.equal(replace.className, actions.querySelector('a').className);
  assert.equal(replace.dataset.variant, 'default');
  assert.equal(actions.firstElementChild, replace);
  assert.equal(document.getElementById('bgh-gear'), null);
  const changed = new Promise(resolve => editor.addEventListener('input', resolve, { once: true }));
  replace.click();
  await changed;
  assert.deepEqual(JSON.parse(editor.value), { profile });
  dom.window.close();
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
  assert.equal(Object.keys(saved.sites).length, 1);
  assert.equal(Object.values(saved.sites)[0].appearance, undefined);
  assert.equal(doc.documentElement.dataset.bghTheme, 'amethyst');
  assert.equal(doc.documentElement.style.getPropertyValue('--bgh-base'), '#112233');
  dom.window.close();
});

test('site mode without a repository appearance uses original GitHub theme', async () => {
  const dom = await page({}, { settings: { mode: 'site', theme: 'universe', global: { accent: '#123456' }, sites: {} } });
  assert.equal(dom.window.document.documentElement.dataset.bghTheme, 'github');
  dom.window.close();
});

test('six-dot handles reorder repository sections on the page and export the draft', async () => {
  const dom = await page({});
  const { window } = dom;
  const doc = window.document;
  let blob;
  window.URL.createObjectURL = value => { blob = value; return 'blob:bettergithub-test'; };
  window.URL.revokeObjectURL = () => {};
  doc.addEventListener('click', event => { if (event.target.download) event.preventDefault(); });
  assert.equal(doc.querySelectorAll('.bgh-layout-handle').length, 0);
  doc.getElementById('bgh-gear').click();
  assert.equal(doc.querySelectorAll('.bgh-layout-handle').length, 0);
  doc.getElementById('bgh-edit-layout').click();
  assert.equal(doc.querySelector('#bgh-order'), null);
  const handles = doc.querySelectorAll('.bgh-layout-handle');
  assert.equal(handles.length, 5);
  assert.equal(handles[0].draggable, true);
  assert.equal(handles[0].querySelectorAll('svg circle').length, 6);
  handles[0].dispatchEvent(new window.Event('dragstart', { bubbles: true }));
  handles[3].closest('.bgh-layout-target').dispatchEvent(new window.Event('dragover', { bubbles: true, cancelable: true }));
  handles[3].closest('.bgh-layout-target').dispatchEvent(new window.Event('drop', { bubbles: true, cancelable: true }));
  assert.equal(handles[0].closest('.bgh-layout-target').style.order, '3');
  handles[0].dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  const expected = ['releases', 'packages', 'about', 'contributors', 'languages'];
  assert.equal(handles[0].closest('.bgh-layout-target').style.order, '2');
  doc.getElementById('bgh-export').click();
  const reader = new window.FileReader();
  const json = await new Promise((resolve, reject) => {
    reader.onload = () => resolve(JSON.parse(reader.result));
    reader.onerror = reject;
    reader.readAsText(blob);
  });
  assert.deepEqual(json.layout.sidebar, expected);
  doc.getElementById('bgh-close').click();
  assert.equal(doc.querySelectorAll('.bgh-layout-handle').length, 0);
  assert.equal(handles[0].parentElement, null);
  assert.equal(doc.querySelector('.bgh-reordered'), null);
  dom.window.close();
});

test('file panel moves below README from the page and persists only after saving the layout', async () => {
  const markup = html.replace('<main>', '<main><div id="repo-main"><section id="files"><div data-testid="directory-content">Files</div></section><section id="repo-readme"><article class="markdown-body">README</article></section></div>');
  const dom = await page({}, { markup });
  const { window } = dom;
  const doc = window.document;
  let saved;
  window.chrome.storage.local.set = (value, callback) => { saved = value.settings; callback(); };
  assert.equal(doc.querySelectorAll('.bgh-layout-handle').length, 0);
  doc.getElementById('bgh-gear').click();
  doc.getElementById('bgh-edit-layout').click();
  const grip = doc.querySelector('[data-bgh-column="repo-main"][data-bgh-drag-handle="code"]');
  assert.ok(grip);
  grip.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(doc.getElementById('files').style.order, '1');
  assert.equal(doc.getElementById('repo-readme').style.order, '0');
  assert.equal(saved, undefined);
  doc.querySelector('#bgh-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(Array.from(Object.values(saved.sites)[0].layout.repository), ['readme', 'code']);
  assert.equal(doc.querySelectorAll('.bgh-layout-handle').length, 0);
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
