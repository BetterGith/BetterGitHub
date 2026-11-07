import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

test('theme selection waits for explicit save', async () => {
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
  const selected = form.querySelector('input[name="theme"][value="universe"]');
  selected.checked = true;
  selected.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(saved.length, 0);
  assert.match(window.document.getElementById('status').textContent, /Сохранить настройки/);

  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].theme, 'universe');
  assert.equal(saved[0].mode, 'global');
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
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
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
    get: (_, callback) => callback({ settings: { mode: 'global', theme: 'github', global: {}, sites: {} } }),
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
  for (const [key, value] of Object.entries(colors)) form.elements[key].value = value;
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
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
  assert.equal(window.document.querySelector('.save-button').textContent, 'Save settings');
  assert.equal(window.document.querySelector('.theme-card--forest strong').textContent, 'Forest');
  assert.equal(window.document.getElementById('palette-hint').textContent, 'Adjust the selected card’s colors. Choosing another card restores its palette.');
  dom.window.close();
});
