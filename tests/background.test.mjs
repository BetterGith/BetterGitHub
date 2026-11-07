import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const script = readFileSync(new URL('../background.js', import.meta.url), 'utf8');

function background(files, { apiStatus = 200, htmlBranch = 'main' } = {}) {
  const requests = [];
  let listener;
  const chrome = { runtime: { id: 'test-extension', onMessage: { addListener(callback) { listener = callback; } } } };
  const fetch = async url => {
    requests.push(url);
    const parsed = new URL(url);
    if (parsed.hostname === 'api.github.com') return apiStatus === 200
      ? { ok: true, json: async () => ({ default_branch: 'main' }) }
      : { ok: false, status: apiStatus };
    if (parsed.hostname === 'github.com') return {
      ok: true, text: async () => `<script>{"defaultBranch":"${htmlBranch}"}</script>`
    };
    const file = Object.entries(files).find(([name]) => parsed.pathname.endsWith(`/${name}`))?.[1];
    return file ? {
      ok: true,
      arrayBuffer: async () => Uint8Array.from(Buffer.from(JSON.stringify(file))).buffer
    } : { ok: false, status: 404 };
  };
  runInNewContext(script, { chrome, fetch, atob, TextDecoder, Uint8Array, URL, Date, console });
  const load = () => new Promise(resolve => listener({ type: 'bettergithub:load', owner: 'YarilaFox', repository: 'YarilaFox', kind: 'profile' }, { id: 'test-extension' }, resolve));
  const target = () => new Promise(resolve => listener({ type: 'bettergithub:editor-target', owner: 'YarilaFox', repository: 'YarilaFox' }, { id: 'test-extension' }, resolve));
  const invalidate = () => new Promise(resolve => listener({ type: 'bettergithub:invalidate', owner: 'YarilaFox', repository: 'YarilaFox' }, { id: 'test-extension' }, resolve));
  return { load, target, invalidate, requests };
}

test('loads a profile config exported with the dot removed by Chrome', async () => {
  const worker = background({ 'bettergithub.json': { appearance: { theme: 'amethyst' } } });
  const result = await worker.load();
  assert.equal(result.config.appearance.theme, 'amethyst');
  assert.match(worker.requests[0], /raw\.githubusercontent\.com\/YarilaFox\/YarilaFox\/HEAD\/\.bettergithub\.json$/);
  assert.match(worker.requests[1], /raw\.githubusercontent\.com\/YarilaFox\/YarilaFox\/HEAD\/bettergithub\.json$/);
  assert.match(result.assetBase, /\/HEAD\/bettergithub\.json$/);
});

test('loads scoped profile settings instead of repository root settings', async () => {
  const worker = background({ 'bettergithub.json': {
    appearance: { theme: 'midnight' },
    layout: { sidebar: ['about', 'packages'] },
    profile: {
      appearance: { theme: 'amethyst' },
      layout: { profile: ['pinned', 'readme', 'contributions'] }
    }
  } });
  const result = await worker.load();
  assert.equal(result.config.appearance.theme, 'amethyst');
  assert.deepEqual(Array.from(result.config.layout.profile), ['pinned', 'readme', 'contributions']);
  assert.equal(result.config.layout.sidebar, undefined);
});

test('uses legacy root settings when no profile scope exists', async () => {
  const worker = background({ 'bettergithub.json': {
    appearance: { theme: 'forest' },
    layout: { profile: ['readme', 'pinned', 'contributions'] }
  } });
  const result = await worker.load();
  assert.equal(result.config.appearance.theme, 'forest');
  assert.deepEqual(Array.from(result.config.layout.profile), ['readme', 'pinned', 'contributions']);
});

test('prefers the canonical dotted config when both names exist', async () => {
  const worker = background({ '.bettergithub.json': { appearance: { theme: 'universe' } }, 'bettergithub.json': { appearance: { theme: 'amethyst' } } });
  const result = await worker.load();
  assert.equal(result.config.appearance.theme, 'universe');
  assert.equal(worker.requests.length, 1);
});

test('GitHub editor target reuses undotted file instead of creating a duplicate', async () => {
  const worker = background({ 'bettergithub.json': { appearance: { theme: 'amethyst' } } });
  assert.deepEqual(JSON.parse(JSON.stringify(await worker.target())), {
    branch: 'main', exists: true, filename: 'bettergithub.json',
    config: { appearance: { theme: 'amethyst' } }
  });
  assert.match(worker.requests[1], /\/main\/\.bettergithub\.json$/);
  assert.match(worker.requests[2], /\/main\/bettergithub\.json$/);
});

test('GitHub editor target creates dotted file only when neither name exists', async () => {
  const worker = background({});
  assert.deepEqual({ ...await worker.target() }, { branch: 'main', exists: false, filename: '.bettergithub.json', config: null });
});

test('API rate limit does not prevent raw profile config loading', async () => {
  const worker = background({ 'bettergithub.json': { profile: { appearance: { theme: 'forest' } } } }, { apiStatus: 403 });
  const result = await worker.load();
  assert.equal(result.config.appearance.theme, 'forest');
  assert.equal(worker.requests.some(url => url.includes('api.github.com')), false);
});

test('API rate limit falls back to public branch HTML and reuses existing file', async () => {
  const config = { appearance: { theme: 'midnight' }, profile: { appearance: { theme: 'forest' } } };
  const worker = background({ 'bettergithub.json': config }, { apiStatus: 403 });
  assert.deepEqual(JSON.parse(JSON.stringify(await worker.target())), {
    branch: 'main', exists: true, filename: 'bettergithub.json', config
  });
  assert.match(worker.requests[0], /api\.github\.com\/repos\/YarilaFox\/YarilaFox$/);
  assert.match(worker.requests[1], /github\.com\/YarilaFox\/YarilaFox$/);
  assert.match(worker.requests[2], /\/main\/\.bettergithub\.json$/);
  assert.match(worker.requests[3], /\/main\/bettergithub\.json$/);
});

test('invalidates cached config after returning from GitHub editor', async () => {
  const files = { 'bettergithub.json': { profile: { appearance: { theme: 'midnight' } } } };
  const worker = background(files);
  assert.equal((await worker.load()).config.appearance.theme, 'midnight');
  files['bettergithub.json'].profile.appearance.theme = 'amethyst';
  assert.equal((await worker.load()).config.appearance.theme, 'midnight');
  assert.equal((await worker.invalidate()).ok, true);
  assert.equal((await worker.load()).config.appearance.theme, 'amethyst');
});
