import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../navigation.js', import.meta.url), 'utf8');
const flags = ['pluginCommandPalette', 'pluginQuickNavigation', 'pluginRepositorySwitcher', 'pluginQuickActions'];
const markup = `<!doctype html><html><head><meta name="octolytics-dimension-repository_nwo" content="Example/Project"><title>Example Project</title></head><body>
<header><div class="AppHeader-globalBar-end"><button id="native-button">Native</button></div></header>
<nav><a data-tab-item="code" href="/Example/Project">Code</a><a data-tab-item="issues" href="/Example/Project/issues">Issues</a><a data-tab-item="pull-requests" href="/Example/Project/pulls">Pull requests</a></nav>
<main><a href="/Another/Repository">Another repository</a><article class="markdown-body"><h2 id="getting-started">Getting started</h2><p>Document content</p></article><textarea id="editor"></textarea></main></body></html>`;

async function navigation({ data = {}, url = 'https://github.com/Example/Project/pulls', html = markup, all = true } = {}) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
  const { window } = dom;
  const values = { settings: { language: 'en' }, ...(all ? Object.fromEntries(flags.map(key => [key, true])) : {}), ...data };
  const messages = [], copied = [], scrolled = [];
  let changed;
  const update = patch => {
    const changes = Object.fromEntries(Object.entries(patch).map(([key, newValue]) => [key, { oldValue: values[key], newValue }]));
    Object.assign(values, patch); changed(changes, 'local');
  };
  window.matchMedia = () => ({ matches: false });
  window.scrollTo = () => scrolled.push('top');
  window.HTMLElement.prototype.scrollIntoView = function () { if (this.tagName === 'H2') scrolled.push(this.id); };
  window.HTMLDialogElement.prototype.showModal = function () { this.invoker = window.document.activeElement; this.setAttribute('open', ''); };
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.invoker?.focus(); };
  Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async text => copied.push(text) } });
  window.chrome = {
    storage: {
      local: { get: (_, done) => done(values), set: (patch, done) => { update(patch); done(); } },
      onChanged: { addListener(callback) { changed = callback; } }
    },
    runtime: { sendMessage(message, done) {
      messages.push(message);
      if (message.type === 'bettergithub:clear-repository-history') update({ navigationHistory: [] });
      done({ ok: true });
    } }
  };
  window.eval(readFileSync(new URL('../command-core.js', import.meta.url), 'utf8'));
  window.eval(source);
  await new Promise(resolve => setTimeout(resolve, 0));
  const launch = () => window.document.querySelector('.bgh-tool-launcher').click();
  const mode = name => { if(window.document.querySelector('#bgh-tools-dialog')?.open)window.document.getElementById('bgh-tools-close').click(); window.document.querySelector(`[data-tools-mode="${name}"]`).click(); };
  const search = text => {
    const input = window.document.querySelector('#bgh-tools-dialog input[role="combobox"]');
    input.value = text; input.dispatchEvent(new window.Event('input', { bubbles: true })); return input;
  };
  const options = () => [...window.document.querySelectorAll('#bgh-tools-results [role="option"]')];
  return { dom, window, values, update, messages, copied, scrolled, launch, mode, search, options };
}

test('new plugins are opt-in and each has an independent entry point', async () => {
  const off = await navigation({ all: false });
  assert.equal(off.window.document.getElementById('bgh-tools-launchers'), null);
  assert.equal(off.messages.length, 0);
  off.dom.window.close();
  for (const [index, kind] of ['commands', 'navigation', 'repositories', 'actions'].entries()) {
    const item = await navigation({ all: false, data: { [flags[index]]: true } });
    item.launch();
    assert.equal(item.window.document.querySelectorAll('[data-tools-mode]').length, 1);
    assert.equal(item.window.document.querySelector('[data-tools-mode]').dataset.toolsMode, kind);
    assert.ok(item.options().length > 0);
    item.dom.window.close();
  }
});

test('command palette filters results and supports keyboard selection and copy actions', async () => {
  const item = await navigation();
  item.window.document.getElementById('native-button').focus();
  item.window.document.body.dispatchEvent(new item.window.KeyboardEvent('keydown', { code: 'Space', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
  assert.equal(item.window.document.querySelector('#bgh-tools-dialog').open, true);
  const input = item.search('copy HTTPS');
  assert.match(item.options()[0].textContent, /Copy HTTPS clone URL/);
  input.dispatchEvent(new item.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(item.copied, ['https://github.com/Example/Project.git']);
  assert.equal(item.window.document.activeElement.id, 'native-button');
  item.launch(); item.search('');
  const all = item.options();
  const again = item.window.document.querySelector('#bgh-tools-dialog input[role="combobox"]');
  again.dispatchEvent(new item.window.KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
  assert.equal(all.at(-1).getAttribute('aria-selected'), 'true');
  again.dispatchEvent(new item.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  assert.equal(all[0].getAttribute('aria-selected'), 'true');
  item.dom.window.close();
});

test('shortcuts do not interrupt text editing, composition or unrelated dialogs', async () => {
  const item = await navigation();
  const editor = item.window.document.getElementById('editor');
  editor.dispatchEvent(new item.window.KeyboardEvent('keydown', { code: 'Space', ctrlKey: true, shiftKey: true, bubbles: true }));
  item.window.document.body.dispatchEvent(new item.window.KeyboardEvent('keydown', { code: 'Space', ctrlKey: true, shiftKey: true, isComposing: true, bubbles: true }));
  assert.equal(item.window.document.querySelector('#bgh-tools-dialog'), null);
  const native = item.window.document.createElement('dialog'); native.setAttribute('open', ''); item.window.document.body.append(native);
  item.launch();
  assert.equal(item.window.document.querySelector('#bgh-tools-dialog'), null);
  item.dom.window.close();
});

test('quick navigation uses native tabs and scrolls to a heading without modifying the README', async () => {
  const item = await navigation();
  const readme = item.window.document.querySelector('.markdown-body').outerHTML;
  item.launch(); item.mode('navigation');
  assert.equal(item.options().some(option => option.textContent === 'Settings'), false);
  assert.equal(item.options().some(option => option.getAttribute('href') === 'https://github.com/Example/Project/issues'), false, 'Page Navigator does not duplicate native GitHub tabs');
  item.search('Getting started'); item.options()[0].click();
  assert.deepEqual(item.scrolled, ['getting-started']);
  assert.equal(item.window.document.querySelector('.markdown-body').outerHTML, readme);
  item.dom.window.close();
});

test('repository switcher preserves section, validates stored names and clears local history', async () => {
  const item = await navigation({ data: { navigationHistory: [{ name: 'Other/Project', private: true }, { name: 'evil/<script>' }, { name: '../..' }] } });
  item.launch(); item.mode('repositories'); item.search('Other/Project');
  assert.equal(item.options().length, 1);
  assert.equal(item.options()[0].href, 'https://github.com/Other/Project/pulls');
  assert.match(item.options()[0].textContent, /Private/);
  const preserve = item.window.document.querySelector('#bgh-tools-repository-settings input');
  preserve.click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(item.options()[0].href, 'https://github.com/Other/Project');
  assert.equal(item.values.navigationPreserveSection, false);
  item.search('https://github.com/Fresh/Repository');
  assert.equal(item.options()[0].href, 'https://github.com/Fresh/Repository');
  item.search('Other/Project');
  item.window.document.querySelector('#bgh-tools-repository-settings button').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(item.values.navigationHistory, []);
  assert.equal(item.window.document.querySelector('#bgh-tools-dialog script'), null);
  assert.equal(item.window.document.querySelector('#bgh-tools-dialog img'), null);
  item.dom.window.close();
});

test('quick actions are contextual and opening forms never submits them', async () => {
  const item = await navigation({ url: 'https://github.com/Example/Project/pull/42' });
  item.launch(); item.mode('actions');
  assert.ok(item.options().some(option => option.href === 'https://github.com/Example/Project/issues/new'));
  assert.ok(item.options().some(option => option.href === 'https://github.com/Example/Project/compare'));
  assert.equal(item.window.document.querySelector('#bgh-tools-dialog form'), null);
  item.search('checkout'); item.options()[0].click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(item.copied, ['gh pr checkout 42']);
  item.dom.window.close();
});

test('turning plugins or the entire extension off removes UI and disables shortcuts and history writes', async () => {
  const item = await navigation(); item.launch(); item.mode('repositories');
  item.update({ pluginRepositorySwitcher: false });
  assert.equal(item.window.document.querySelector('#bgh-tools-dialog').open, false);
  item.update({ settings: { themeDisabled: true } });
  const count = item.messages.length;
  item.window.document.body.dispatchEvent(new item.window.KeyboardEvent('keydown', { code: 'Space', ctrlKey: true, shiftKey: true, bubbles: true }));
  assert.equal(item.window.document.querySelector('#bgh-tools-launchers, #bgh-tools-dialog, #bgh-tools-toast'), null);
  assert.equal(item.messages.length, count);
  item.update({ settings: { language: 'en', themeDisabled: false } });
  item.launch();
  assert.equal(item.window.document.querySelector('[data-tools-mode="repositories"]'), null);
  item.dom.window.close();
});

function worker(data = {}) {
  const values = { pluginRepositorySwitcher: true, ...data };
  let listener, options = 0;
  const chrome = {
    runtime: { id: 'extension', onMessage: { addListener(fn) { listener = fn; } }, async openOptionsPage() { options++; } },
    storage: { local: { async get() { return structuredClone(values); }, async set(patch) { Object.assign(values, structuredClone(patch)); } } }
  };
  runInNewContext(readFileSync(new URL('../background.js', import.meta.url), 'utf8'), {
    chrome, console, URL, Date, TextDecoder, Uint8Array, fetch() { throw new Error('Navigation history must not use network'); }
  });
  const sender = { id: 'extension', tab: { id: 1 }, frameId: 0 };
  return { values, listener, sender, options: () => options, send: message => new Promise(resolve => listener(message, sender, resolve)) };
}

test('repository history is serialized across tabs, bounded, deduplicated and local', async () => {
  const item = worker();
  await Promise.all(Array.from({ length: 35 }, (_, index) => item.send({ type: 'bettergithub:remember-repository', name: `Owner/Repo${index}` })));
  assert.equal(item.values.navigationHistory.length, 30);
  assert.equal(item.values.navigationHistory[0].name, 'Owner/Repo34');
  await item.send({ type: 'bettergithub:remember-repository', name: 'owner/repo12', private: true });
  assert.equal(item.values.navigationHistory[0].name, 'owner/repo12');
  assert.equal(item.values.navigationHistory.filter(value => value.name.toLowerCase() === 'owner/repo12').length, 1);
  assert.equal(item.values.navigationHistory[0].private, true);
  assert.match((await item.send({ type: 'bettergithub:remember-repository', name: '../..' })).error, /Invalid repository/);
  await item.send({ type: 'bettergithub:clear-repository-history' });
  assert.deepEqual(item.values.navigationHistory, []);
});

test('history obeys disabled settings and opening the store checks extension sender and frame', async () => {
  for (const data of [{ settings: { themeDisabled: true } }, { pluginRepositorySwitcher: false }]) {
    const item = worker(data);
    assert.equal((await item.send({ type: 'bettergithub:remember-repository', name: 'Owner/Repo' })).ok, false);
    assert.equal(item.values.navigationHistory, undefined);
  }
  const item = worker();
  assert.equal(item.listener({ type: 'bettergithub:open-options' }, { ...item.sender, id: 'other' }, () => {}), undefined);
  assert.equal(item.listener({ type: 'bettergithub:open-options' }, { ...item.sender, frameId: 1 }, () => {}), undefined);
  await item.send({ type: 'bettergithub:open-options' });
  assert.equal(item.options(), 1);
});

test('pins and command history serialize across tabs, deduplicate and obey full OFF', async () => {
  const item = worker({pluginCommandPalette:true});
  await Promise.all(['Org/One','Other/Two'].map(name=>item.send({type:'bettergithub:toggle-repository-pin',name})));
  assert.equal(item.values.navigationPinned.length,2);
  await item.send({type:'bettergithub:toggle-repository-pin',name:'org/one'});
  assert.equal(item.values.navigationPinned.length,1);
  await item.send({type:'bettergithub:clear-repository-history'});
  assert.equal(item.values.navigationPinned[0].name,'Other/Two');
  for(let i=0;i<24;i++)await item.send({type:'bettergithub:remember-command',id:`plugin:cmd${i}`});
  assert.equal(item.values.commandHistory.length,20);
  await item.send({type:'bettergithub:remember-command',id:'plugin:cmd12'});
  assert.equal(item.values.commandHistory[0].id,'plugin:cmd12');
  assert.equal(item.values.commandHistory.filter(c=>c.id==='plugin:cmd12').length,1);
  item.values.settings={themeDisabled:true};
  assert.equal((await item.send({type:'bettergithub:remember-command',id:'plugin:blocked'})).ok,false);
  assert.equal((await item.send({type:'bettergithub:toggle-repository-pin',name:'Blocked/Repo'})).ok,false);
  await item.send({type:'bettergithub:clear-command-history'});assert.deepEqual(item.values.commandHistory,[]);
});

test('palette runs registered plugin/custom commands and disabled plugin commands disappear immediately', async () => {
 const item=await navigation({data:{commandCustom:[{id:'clone',title:'My clone command',type:'copy',value:'git clone git@github.com:{repo}.git'}]}});
 item.window.BetterGitHubCommands.registerPlugin({id:'health',name:'Repo Health',flag:'pluginQuickActions',commands:()=>[{id:'analyze',title:'Analyze repository',run:()=>item.copied.push('analysis')}]});
 item.launch();item.search('Repo Health Analyze');assert.equal(item.options().length,1);item.options()[0].click();await new Promise(r=>setTimeout(r,0));assert.deepEqual(item.copied,['analysis']);
 item.launch();item.search('My clone');item.options()[0].click();await new Promise(r=>setTimeout(r,0));assert.equal(item.copied[1],'git clone git@github.com:Example/Project.git');
 item.update({pluginQuickActions:false});item.launch();item.search('Analyze repository');assert.equal(item.options().length,0);item.dom.window.close();
});

test('late plugin providers load their own opt-in flag and follow subsequent storage updates',async()=>{
 const item=await navigation({data:{pluginRepoHealth:true}});
 item.window.BetterGitHubCommands.registerPlugin({id:'repo-health',name:'Repo Health',flag:'pluginRepoHealth',commands:()=>[{id:'analyze',title:'Analyze repository',run:()=>{}}]});
 item.launch();item.search('Repo Health Analyze');assert.equal(item.options().length,1);
 item.update({pluginRepoHealth:false});assert.equal(item.options().length,0);item.dom.window.close();
});

test('Page Navigator includes headings, comments and changes without inventing native tab commands', async()=>{
 const html=markup.replace('</main>','<div id="issuecomment-12"><a class="author">Alice</a><div class="markdown-body">Check the fix</div></div><div class="file-header" data-path="src/main.rs">main.rs</div></main>');
 const item=await navigation({html});item.mode('navigation');item.search('Alice');assert.equal(item.options().length,1);
 item.search('main.rs');assert.equal(item.options().length,1);item.update({navigatorIncludeComments:false,navigatorIncludeChanges:false});item.search('Alice');assert.equal(item.options().length,0);item.search('main.rs');assert.equal(item.options().length,0);item.dom.window.close();
});

test('file action uses a commit SHA and actual path for permalinks, retaining selected lines',async()=>{
 const sha='a'.repeat(40),payload={payload:{codeViewBlobLayoutRoute:{refInfo:{name:'feature/branch',currentOid:sha},path:'src/main.rs'}}};
 const html=markup.replace('</head>',`<script type="application/json">${JSON.stringify(payload)}</script></head>`);
 const item=await navigation({html,url:'https://github.com/Example/Project/blob/feature/branch/src/main.rs#L4-L9'});item.mode('actions');item.search('Copy file permalink');assert.equal(item.options().length,1);item.options()[0].click();await new Promise(r=>setTimeout(r,0));assert.deepEqual(item.copied,[`https://github.com/Example/Project/blob/${sha}/src/main.rs#L4-L9`]);
 item.dom.window.close();
});

test('custom hotkeys activate commands and leave the old launch shortcut alone',async()=>{
 const item=await navigation({data:{commandShortcuts:{commands:'Alt+Shift+C','quick-actions:copy:https':'Alt+Shift+X'}}});
 const key=code=>item.window.document.body.dispatchEvent(new item.window.KeyboardEvent('keydown',{code,altKey:true,shiftKey:true,bubbles:true,cancelable:true}));
 key('KeyX');await new Promise(r=>setTimeout(r,0));assert.deepEqual(item.copied,['https://github.com/Example/Project.git']);key('KeyC');assert.equal(item.window.document.querySelector('#bgh-tools-dialog').open,true);item.dom.window.close();
});

test('clipboard fallback cleans up its textarea and restores focus after copying', async () => {
  const item = await navigation();
  item.window.navigator.clipboard.writeText = async () => { throw new Error('Clipboard unavailable'); };
  item.window.document.execCommand = command => command === 'copy';
  item.window.document.getElementById('native-button').focus();
  item.launch();
  const input = item.search('copy HTTPS');
  input.dispatchEvent(new item.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(item.window.document.querySelector('.bgh-tools-copy'), null);
  assert.equal(item.window.document.activeElement.id, 'native-button');
  assert.equal(item.window.document.getElementById('bgh-tools-toast').textContent, 'Copied');
  item.dom.window.close();
});
