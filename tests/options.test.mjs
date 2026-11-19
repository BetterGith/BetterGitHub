import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

test('plugin search filters names/descriptions without changing saved enablement and follows the UI language',async()=>{
 const dom=new JSDOM(readFileSync(new URL('../options.html',import.meta.url),'utf8'),{url:'https://extension.example/options.html#plugins',runScripts:'outside-only'});
 const {window}=dom;const values={settings:{language:'ru',theme:'compact',global:{},sites:{}},pluginQuickNavigation:true};const writes=[];
 window.chrome={storage:{local:{get:(_,done)=>done(values),set:(patch,done)=>{Object.assign(values,patch);writes.push(patch);done();}}}};
 window.eval(readFileSync(new URL('../options.js',import.meta.url),'utf8'));await new Promise(resolve=>setTimeout(resolve,0));
 const search=window.document.getElementById('plugin-search');const type=text=>{search.value=text;search.dispatchEvent(new window.Event('input',{bubbles:true}));};
 type('PAGE NAV');assert.equal(window.document.querySelectorAll('.plugin-card:not([hidden])').length,1);assert.equal(window.document.querySelector('.plugin-card:not([hidden]) input').checked,true);assert.equal(writes.length,0);
 type('несуществующий-плагин');assert.equal(window.document.getElementById('plugin-empty').hidden,false);assert.equal(window.document.querySelectorAll('.plugin-card:not([hidden])').length,0);
 type('');assert.equal(window.document.querySelectorAll('.plugin-card:not([hidden])').length,6);
 const language=window.document.querySelector('[name=language]');language.value='en';language.dispatchEvent(new window.Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(search.placeholder,'Search plugins');type('light themes');assert.equal(window.document.querySelectorAll('.plugin-card:not([hidden])').length,1);dom.window.close();
});

test('navigation plugins have separate switches, save immediately and keep the Plugins tab selected', async () => {
  const html = readFileSync(new URL('../options.html', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../options.js', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://extension.example/options.html#plugins', runScripts: 'outside-only' });
  const { window } = dom;
  const values = { settings: { theme: 'compact', mode: 'global', language: 'en' } };
  const writes = [];
  window.chrome = { storage: { local: {
    get: (_, callback) => callback(values),
    set: (patch, callback) => { Object.assign(values, patch); writes.push(patch); callback(); }
  } } };
  window.eval(script);
  await new Promise(resolve => setTimeout(resolve, 0));
  const form = window.document.getElementById('settings');
  assert.equal(window.document.querySelector('[data-panel="plugins"]').getAttribute('aria-pressed'), 'true');
  assert.equal(window.document.getElementById('plugins-panel').hidden, false);
  for (const key of ['pluginCommandPalette', 'pluginQuickNavigation', 'pluginRepositorySwitcher', 'pluginQuickActions']) {
    assert.equal(form.elements[key].checked, false);
    form.elements[key].click();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(values[key], true);
    assert.deepEqual(Object.keys(writes.at(-1)), [key]);
  }
  assert.equal(values.settings.theme, 'compact');
  window.document.querySelector('[data-panel="themes"]').click();
  assert.equal(window.location.hash, '#themes');
  window.document.querySelector('[data-panel="plugins"]').click();
  assert.equal(window.location.hash, '#plugins');
  dom.window.close();
});

test('both Compact UI variants are themes with the same title and save independently of plugins', async () => {
  const html = readFileSync(new URL('../options.html', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../options.js', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://extension.example/options.html', runScripts: 'outside-only' });
  const { window } = dom;
  let saved;
  window.chrome = { storage: { local: {
    get: (_, callback) => callback({ settings: { theme: 'github', language: 'en', sites: {} } }),
    set: (value, callback) => { saved = value; callback(); }
  } } };
  window.eval(script);
  await new Promise(resolve => setTimeout(resolve, 0));
  const form = window.document.getElementById('settings');
  for (const theme of ['compact', 'compact-light']) {
    const radio = form.querySelector(`#theme-gallery input[value="${theme}"]`);
    assert.equal(radio.closest('label').querySelector('strong').textContent, 'Compact UI');
    radio.click();
    assert.equal(form.querySelector('#palette-fields').disabled, true);
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(saved.settings.theme, theme);
    assert.equal(saved.pluginCompactUI, undefined);
  }
  assert.equal(form.querySelector('#plugins-panel [name="pluginCompactUI"]'), null);
  dom.window.close();
});

test('rounded theme is selectable, translated and saved with its palette', async () => {
  const html = readFileSync(new URL('../options.html', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../options.js', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://extension.example/options.html', runScripts: 'outside-only' });
  const { window } = dom;
  let saved;
  window.chrome = { storage: { local: {
    get: (_, callback) => callback({ settings: { theme: 'github', language: 'en', sites: {} } }),
    set: (value, callback) => { saved = value.settings; callback(); }
  } } };
  window.eval(script);
  await new Promise(resolve => setTimeout(resolve, 0));
  const form = window.document.getElementById('settings');
  assert.ok(form.querySelector('.bottom-actions input[name="mode"]'));
  assert.equal(form.querySelector('#advanced-panel [name="mode"]'), null);
  const radio = form.querySelector('input[value="rounded"]');
  assert.equal(radio.closest('label').querySelector('strong').textContent, 'Rounded');
  radio.checked = true;
  radio.dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(saved.theme, 'rounded');
  assert.equal(saved.mode, 'global');
  assert.equal(saved.global.base, '#101012');
  assert.equal(saved.global.accent, '#91e2bd');
  assert.deepEqual(Array.from(saved.recentThemes), ['rounded']);
  dom.window.close();
});

test('legacy light theme softening stays enabled and plugin toggles save independently of the theme', async () => {
  const html = readFileSync(new URL('../options.html', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../options.js', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://extension.example/options.html#plugins', runScripts: 'outside-only' });
  const { window } = dom;
  const saved = [];
  window.chrome = { storage: { local: {
    get: (_, callback) => callback({ settings: { theme: 'rounded-light', dimLightThemes: true, language: 'en' } }),
    set: (value, callback) => { saved.push(value); callback(); }
  } } };
  window.eval(script);
  await new Promise(resolve => setTimeout(resolve, 0));
  const form = window.document.getElementById('settings');
  assert.equal(form.elements.theme.value, 'rounded-light');
  assert.equal(form.querySelector('#plugins-panel').hidden, false);
  assert.equal(form.querySelectorAll('.plugin-card .official-badge').length, 6);
  assert.equal(form.elements.pluginRepositoryThemes.checked, true);
  const dim = form.elements.pluginDimLightThemes;
  assert.equal(dim.checked, true);
  dim.click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(dim.checked, false);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].pluginDimLightThemes, false);
  assert.equal(saved[0].settings, undefined);
  assert.equal(form.elements.text.value, '#202127');
  assert.equal(form.querySelector('input[value="rounded-light"]').closest('label').querySelector('strong').textContent, 'Rounded');
  form.elements.surface.dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(saved[1].pluginDimLightThemes, undefined);
  assert.equal(saved[1].settings.theme, 'rounded-light');
  assert.equal(saved[1].settings.global.surface, '#ffffff', 'the stored palette retains its original colors');
  dom.window.close();
});

test('theme selection saves immediately without a save button', async () => {
  const html = readFileSync(new URL('../options.html', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../options.js', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://extension.example/options.html', runScripts: 'outside-only' });
  const { window } = dom;
  const saved = [];
  window.chrome = { storage: { local: {
    get: (_, callback) => callback({ settings: { mode: 'site', theme: 'github', global: {}, sites: {} } }),
    set: (value, callback) => { saved.push(value.settings); callback(); }
  } } };
  window.eval(script);
  await new Promise(resolve => setTimeout(resolve, 0));

  const form = window.document.getElementById('settings');
  assert.equal(form.elements.pluginDimLightThemes.checked, false);
  const selected = form.querySelector('input[name="theme"][value="universe"]');
  selected.checked = true;
  selected.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(form.querySelector('button[type="submit"]'), null);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].theme, 'universe');
  assert.equal(saved[0].mode, 'global');
  assert.deepEqual(Array.from(saved[0].recentThemes), ['universe']);
  assert.equal(saved[0].global.accent, '#008b2b');
  assert.equal(window.document.getElementById('status').textContent, 'Настройки сохранены');
  dom.window.close();
});

test('switching presets replaces every palette color and keeps background settings', async () => {
  const html = readFileSync(new URL('../options.html', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../options.js', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://extension.example/options.html', runScripts: 'outside-only' });
  const { window } = dom;
  const initial = {
    mode: 'global', theme: 'forest',
    global: { base: '#010101', surface: '#020202', text: '#030303', muted: '#040404', border: '#050505', accent: '#060606', background: 'https://raw.githubusercontent.com/example/repo/main/bg.png', effect: 'glow' },
    sites: {}
  };
  let saved;
  window.chrome = { storage: { local: {
    get: (_, callback) => callback({ settings: initial }),
    set: (value, callback) => { saved = value.settings; callback(); }
  } } };
  window.eval(script);
  await new Promise(resolve => setTimeout(resolve, 0));

  const form = window.document.getElementById('settings');
  const selected = form.querySelector('input[name="theme"][value="universe"]');
  selected.checked = true;
  selected.dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(saved.theme, 'universe');
  assert.deepEqual(Object.fromEntries(['base', 'surface', 'text', 'muted', 'border', 'accent'].map(key => [key, saved.global[key]])), {
    base: '#e9edec', surface: '#f3f6f5', text: '#050807', muted: '#4c5b58', border: '#d3dcd9', accent: '#008b2b'
  });
  assert.equal(saved.global.background, initial.global.background);
  assert.equal(saved.global.effect, 'glow');
  dom.window.close();
});

test('saves a custom global palette and disables palette controls for original GitHub', async () => {
  const html = readFileSync(new URL('../options.html', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../options.js', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://extension.example/options.html', runScripts: 'outside-only' });
  const { window } = dom;
  let saved;
  window.chrome = { storage: { local: {
    get: (_, callback) => callback({ settings: saved || { mode: 'global', theme: 'github', global: {}, sites: {} } }),
    set: (value, callback) => { saved = value.settings; callback(); }
  } } };
  window.eval(script);
  await new Promise(resolve => setTimeout(resolve, 0));

  const form = window.document.getElementById('settings');
  assert.equal(window.document.getElementById('palette-fields').disabled, true);
  const selected = form.querySelector('input[name="theme"][value="midnight"]');
  selected.checked = true;
  selected.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(window.document.getElementById('palette-fields').disabled, false);
  const colors = { base: '#111111', surface: '#222222', text: '#eeeeee', muted: '#aaaaaa', border: '#333333', accent: '#abcdef' };
  for (const [key, value] of Object.entries(colors)) {
    form.elements[key].value = value;
    form.elements[key].dispatchEvent(new window.Event('change', { bubbles: true }));
  }
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(saved.theme, 'midnight');
  assert.deepEqual(Object.fromEntries(Object.keys(colors).map(key => [key, saved.global[key]])), colors);
  dom.window.close();

  const reloaded = new JSDOM(html, { url: 'https://extension.example/options.html', runScripts: 'outside-only' });
  reloaded.window.chrome = { storage: { local: {
    get: (_, callback) => callback({ settings: saved }),
    set: (_, callback) => callback()
  } } };
  reloaded.window.eval(script);
  await new Promise(resolve => setTimeout(resolve, 0));
  for (const [key, value] of Object.entries(colors)) assert.equal(reloaded.window.document.getElementById('settings').elements[key].value, value);
  assert.equal(reloaded.window.document.getElementById('palette-fields').disabled, false);
  reloaded.window.close();
});

test('language changes update the page and preserve other settings', async () => {
  const html = readFileSync(new URL('../options.html', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../options.js', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://extension.example/options.html', runScripts: 'outside-only' });
  const { window } = dom;
  const settings = { mode: 'global', theme: 'forest', global: { background: 'https://raw.githubusercontent.com/a/b/bg.png' }, sites: { example: { accent: '#123456' } }, extra: 'kept' };
  window.chrome = { storage: { local: {
    get: (_, callback) => callback({ settings }),
    set: (value, callback) => { Object.assign(settings, value.settings); callback(); }
  } } };
  window.eval(script);
  await new Promise(resolve => setTimeout(resolve, 0));
  const language = window.document.querySelector('[name="language"]');
  assert.equal(language.value, 'ru');
  language.value = 'en';
  language.dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(settings.language, 'en');
  assert.equal(settings.extra, 'kept');
  assert.deepEqual(settings.sites, { example: { accent: '#123456' } });
  assert.equal(window.document.documentElement.lang, 'en');
  assert.equal(window.document.querySelector('#settings button[type="submit"]'), null);
  assert.match(window.document.querySelector('[data-i18n="themeDescription"]').textContent, /immediately/);
  assert.equal(window.document.querySelector('.theme-card--forest strong').textContent, 'Forest');
  assert.equal(window.document.getElementById('palette-hint').textContent, 'Adjust the selected card’s colors. Choosing another card restores its palette.');
  dom.window.close();
});

test('failed storage write reports an error instead of success', async () => {
  const html = readFileSync(new URL('../options.html', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../options.js', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://extension.example/options.html', runScripts: 'outside-only' });
  const { window } = dom;
  window.chrome = {
    runtime: { lastError: null },
    storage: { local: {
      get: (_, callback) => callback({ settings: { mode: 'global', theme: 'forest', global: {}, sites: {} } }),
      set: (_, callback) => {
        window.chrome.runtime.lastError = { message: 'Quota exceeded' };
        callback();
        window.chrome.runtime.lastError = null;
      }
    } }
  };
  window.eval(script);
  await new Promise(resolve => setTimeout(resolve, 0));
  window.document.querySelector('input[name="theme"][value="midnight"]').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(window.document.getElementById('status').textContent, /Не удалось сохранить/);
  assert.equal(window.document.getElementById('status').classList.contains('is-error'), true);
  dom.window.close();
});

test('rapid theme, language and scope changes preserve the last choice and unrelated settings', async () => {
  const dom = new JSDOM(readFileSync(new URL('../options.html', import.meta.url), 'utf8'), {
    url: 'https://extension.example/options.html', runScripts: 'outside-only'
  });
  const { window } = dom;
  let settings = { theme: 'forest', mode: 'site', themeDisabled: true, sites: { profile: { banner: 'keep.png' } }, extra: 'keep',
    global: { background: 'https://raw.githubusercontent.com/a/b/main/bg.png', effect: 'glow' } };
  let active = 0, maximum = 0;
  window.chrome = { storage: { local: {
    get: (_, callback) => setTimeout(() => callback({ settings }), 3),
    set: (value, callback) => {
      maximum = Math.max(maximum, ++active);
      setTimeout(() => { settings = value.settings; active--; callback(); }, 8);
    }
  } } };
  window.eval(readFileSync(new URL('../options.js', import.meta.url), 'utf8'));
  await new Promise(resolve => setTimeout(resolve, 15));
  const form = window.document.getElementById('settings');
  form.querySelector('input[value="rounded"]').click();
  form.querySelector('input[value="compact-light"]').click();
  form.elements.language.value = 'en';
  form.elements.language.dispatchEvent(new window.Event('change', { bubbles: true }));
  form.querySelector('input[name="mode"][value="site"]').click();
  await new Promise(resolve => setTimeout(resolve, 160));
  assert.equal(maximum, 1);
  assert.equal(settings.theme, 'compact-light');
  assert.equal(settings.mode, 'site');
  assert.equal(settings.language, 'en');
  assert.equal(settings.themeDisabled, false);
  assert.deepEqual(Array.from(settings.recentThemes), ['compact-light', 'rounded']);
  assert.equal(settings.global.background, 'https://raw.githubusercontent.com/a/b/main/bg.png');
  assert.equal(settings.global.effect, 'glow');
  assert.equal(settings.sites.profile.banner, 'keep.png');
  assert.equal(settings.extra, 'keep');
  assert.equal(window.document.getElementById('status').textContent, 'Settings saved');
  dom.window.close();
});

test('invalid background is not saved and cannot block choosing a theme', async () => {
  const dom = new JSDOM(readFileSync(new URL('../options.html', import.meta.url), 'utf8'), {
    url: 'https://extension.example/options.html', runScripts: 'outside-only'
  });
  const { window } = dom;
  let settings = { theme: 'github', global: { background: 'https://raw.githubusercontent.com/a/b/main/bg.png' } };
  window.chrome = { storage: { local: {
    get: (_, callback) => callback({ settings }),
    set: (value, callback) => { settings = value.settings; callback(); }
  } } };
  window.eval(readFileSync(new URL('../options.js', import.meta.url), 'utf8'));
  await new Promise(resolve => setTimeout(resolve, 0));
  const form = window.document.getElementById('settings');
  form.elements.background.value = 'https://example.com/invalid.png';
  form.elements.background.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(window.document.getElementById('status').classList.contains('is-error'), true);
  form.querySelector('input[value="rounded"]').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(settings.theme, 'rounded');
  assert.equal(settings.global.background, 'https://raw.githubusercontent.com/a/b/main/bg.png');
  form.elements.background.value = '';
  form.elements.background.dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(settings.global.background, '');
  dom.window.close();
});

test('compact settings navigation and theme search keep the selected theme available', async () => {
  const html = readFileSync(new URL('../options.html', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../options.js', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://extension.example/options.html', runScripts: 'outside-only' });
  const { window } = dom;
  window.chrome = { storage: { local: {
    get: (_, callback) => callback({ settings: { mode: 'global', theme: 'forest', global: {}, sites: {} } }),
    set: (_, callback) => callback()
  } } };
  window.eval(script);
  await new Promise(resolve => setTimeout(resolve, 0));
  const doc = window.document;
  doc.getElementById('theme-search').value = 'лес';
  doc.getElementById('theme-search').dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(doc.querySelectorAll('.theme-card:not([hidden])').length, 1);
  assert.equal(doc.querySelector('.theme-card--forest input').checked, true);
  doc.querySelector('[data-panel="advanced"]').click();
  assert.equal(doc.getElementById('themes-panel').hidden, true);
  assert.equal(doc.getElementById('advanced-panel').hidden, false);
  assert.equal(doc.querySelector('[data-panel="advanced"]').getAttribute('aria-pressed'), 'true');
  dom.window.close();
});
