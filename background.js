const CONFIG_NAME = '.bettergithub.json';
const CONFIG_FALLBACK_NAME = 'bettergithub.json';
const MAX_CONFIG_BYTES = 64 * 1024;
const cache = new Map();
const extension = globalThis.browser || chrome;
const editorDraftKey = tabId => `editorDraft:${tabId}`;
let repositoryHistoryQueue = Promise.resolve();

function historyRepository(value) {
  if (typeof value !== 'string') return null;
  const parts = value.split('/');
  return parts.length === 2 && parts.every(part => /^[A-Za-z0-9_.-]{1,100}$/.test(part) && part !== '.' && part !== '..') ? parts.join('/') : null;
}

extension.tabs?.onRemoved.addListener(tabId => {
  extension.storage.session.remove(editorDraftKey(tabId)).catch(console.warn);
});

async function openEditor(draft, senderTab) {
  const { owner, repository, branch, filename, exists, json } = draft;
  if (![owner, repository].every(value => typeof value === 'string' && /^[A-Za-z0-9_.-]{1,100}$/.test(value)) ||
      typeof branch !== 'string' || !branch || ![CONFIG_NAME, CONFIG_FALLBACK_NAME].includes(filename) ||
      typeof json !== 'string') throw new Error('Invalid editor draft');
  const base = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
  const ref = encodeURIComponent(branch);
  const url = exists ? `${base}/edit/${ref}/${filename}` : `${base}/new/${ref}?filename=${encodeURIComponent(filename)}`;
  const tab = await extension.tabs.create({ url: 'about:blank', openerTabId: senderTab.id, windowId: senderTab.windowId });
  const key = editorDraftKey(tab.id);
  try {
    await extension.storage.session.set({ [key]: draft });
    await extension.tabs.update(tab.id, { url });
  } catch (error) {
    await Promise.allSettled([extension.storage.session.remove(key), extension.tabs.remove(tab.id)]);
    throw error;
  }
}

async function githubJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json' },
    credentials: 'omit'
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub API: ${response.status}`);
  return response.json();
}

function decodeConfig(value) {
  if (!value || value.type !== 'file' || value.encoding !== 'base64' || typeof value.content !== 'string') return null;
  const binary = atob(value.content.replace(/\s/g, ''));
  if (binary.length > MAX_CONFIG_BYTES) return null;
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  const parsed = JSON.parse(new TextDecoder().decode(bytes));
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? { config: parsed, assetBase: typeof value.download_url === 'string' ? value.download_url : null }
    : null;
}

async function rawConfig(owner, repository, ref, name) {
  const url = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/${encodeURIComponent(ref)}/${name}`;
  const response = await fetch(url, { credentials: 'omit' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub raw: ${response.status}`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_CONFIG_BYTES) throw new Error('Existing config exceeds 64 KB');
  const parsed = JSON.parse(new TextDecoder().decode(bytes));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Existing config is not a JSON object');
  return { config: parsed, assetBase: url };
}

async function publicBranch(owner, repository) {
  const url = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
  const response = await fetch(url, { credentials: 'omit' });
  if (response.status === 404) return { missingRepository: true };
  if (!response.ok) throw new Error(`GitHub: ${response.status}`);
  const html = await response.text();
  const match = html.match(/"defaultBranch":"([^"\\]*(?:\\.[^"\\]*)*)"/);
  if (!match) return {};
  let branch;
  try { branch = JSON.parse(`"${match[1]}"`); } catch { return {}; }
  return typeof branch === 'string' && /^[A-Za-z0-9._/-]{1,255}$/.test(branch) && !branch.includes('..') && !branch.includes('//') && !branch.startsWith('/') && !branch.endsWith('/') ? { branch } : {};
}

async function editorRepository(owner, repository) {
  try {
    const info = await githubJson(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`);
    if (typeof info?.default_branch === 'string' && info.default_branch) return { branch: info.default_branch };
  } catch (error) { console.warn('BetterGitHub branch API:', error); }
  return publicBranch(owner, repository);
}

async function loadConfig(owner, repository) {
  const key = `${owner}/${repository}`.toLowerCase();
  const saved = cache.get(key);
  if (saved && Date.now() - saved.time < (saved.value ? 5 * 60_000 : 30_000)) return saved.value;
  let result = null;
  for (const name of [CONFIG_NAME, CONFIG_FALLBACK_NAME]) {
    try { result = await rawConfig(owner, repository, 'HEAD', name); } catch (error) { console.warn('BetterGitHub config:', error); }
    if (result) break;
  }
  cache.set(key, { value: result, time: Date.now() });
  return result;
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  if (['bettergithub:open-options', 'bettergithub:remember-repository', 'bettergithub:clear-repository-history', 'bettergithub:toggle-repository-pin', 'bettergithub:remember-command', 'bettergithub:clear-command-history'].includes(message?.type)) {
    const optionsPage = typeof sender.url === 'string' && sender.url.split(/[?#]/)[0] === extension.runtime.getURL?.('options.html');
    if ((!Number.isInteger(sender.tab?.id) && !optionsPage) || (sender.frameId !== undefined && sender.frameId !== 0)) return;
    if (message.type === 'bettergithub:open-options') {
      (async () => {
        if (message.plugin !== undefined) {
          if (typeof message.plugin !== 'string' || !/^plugin[A-Z][A-Za-z0-9]{0,60}$/.test(message.plugin)) throw new Error('Invalid plugin');
          await extension.tabs.create({ url: extension.runtime.getURL(`options.html?plugin=${encodeURIComponent(message.plugin)}#plugins`) });
        } else await extension.runtime.openOptionsPage();
        respond({ ok: true });
      })().catch(error => respond({ error: String(error) }));
      return true;
    }
    const job = repositoryHistoryQueue.catch(() => {}).then(async () => {
      if (message.type === 'bettergithub:clear-repository-history') {
        await extension.storage.local.set({ navigationHistory: [] });
        return { ok: true };
      }
      if (message.type === 'bettergithub:clear-command-history') {
        await extension.storage.local.set({ commandHistory: [] }); return { ok: true };
      }
      if (message.type === 'bettergithub:remember-command') {
        if (typeof message.id !== 'string' || !/^[a-zA-Z0-9_:/.-]{1,160}$/.test(message.id)) throw new Error('Invalid command');
        const data = await extension.storage.local.get(['settings', 'pluginCommandPalette', 'commandHistory']);
        if (data.settings?.themeDisabled === true || data.pluginCommandPalette !== true) return { ok: false };
        const history = Array.isArray(data.commandHistory) ? data.commandHistory.filter(item => typeof item?.id === 'string' && item.id !== message.id) : [];
        await extension.storage.local.set({ commandHistory: [{ id: message.id, usedAt: Date.now() }, ...history].slice(0,20) }); return { ok: true };
      }
      const name = historyRepository(message.name);
      if (!name) throw new Error('Invalid repository');
      const data = await extension.storage.local.get(['settings', 'pluginRepositorySwitcher', 'navigationHistory', 'navigationPinned']);
      if (data.settings?.themeDisabled === true || data.pluginRepositorySwitcher !== true) return { ok: false };
      if (message.type === 'bettergithub:toggle-repository-pin') {
        const pins = (Array.isArray(data.navigationPinned) ? data.navigationPinned : []).filter(item => historyRepository(item?.name));
        const found = pins.some(item => item.name.toLowerCase() === name.toLowerCase());
        if (!found && pins.length >= 50) throw new Error('At most 50 pinned repositories');
        const next = found ? pins.filter(item => item.name.toLowerCase() !== name.toLowerCase()) : [...pins, { name, private: message.private === true, pinnedAt: Date.now() }];
        await extension.storage.local.set({ navigationPinned: next }); return { ok: true };
      }
      const history = (Array.isArray(data.navigationHistory) ? data.navigationHistory : [])
        .filter(item => historyRepository(item?.name) && item.name.toLowerCase() !== name.toLowerCase())
        .map(item => ({ name: item.name, private: item.private === true, visitedAt: Number.isFinite(item.visitedAt) ? item.visitedAt : 0 }));
      const next = [{ name, private: message.private === true, visitedAt: Date.now() }, ...history].slice(0, 30);
      await extension.storage.local.set({ navigationHistory: next });
      return { ok: true };
    });
    repositoryHistoryQueue = job;
    job.then(respond, error => respond({ error: String(error) }));
    return true;
  }
  if (['bettergithub:open-editor', 'bettergithub:editor-draft', 'bettergithub:update-editor-draft'].includes(message?.type)) {
    if (!Number.isInteger(sender.tab?.id) || sender.frameId !== 0) return;
    (async () => {
      if (message.type === 'bettergithub:open-editor') {
        await openEditor(message.draft, sender.tab);
        return { ok: true };
      }
      const key = editorDraftKey(sender.tab.id);
      const { [key]: draft } = await extension.storage.session.get(key);
      if (!draft || Date.now() - draft.createdAt > 20 * 60_000) return { draft: null };
      if (message.type === 'bettergithub:editor-draft') return { draft };
      if (message.createdAt !== draft.createdAt) return { ok: false };
      for (const flag of ['attempted', 'handled', 'invalidated']) {
        if (message[flag] === true) draft[flag] = true;
      }
      await extension.storage.session.set({ [key]: draft });
      return { ok: true };
    })().then(respond, error => respond({ error: String(error) }));
    return true;
  }
  if (!['bettergithub:load', 'bettergithub:editor-target', 'bettergithub:invalidate'].includes(message?.type)) return;
  const { owner, repository, kind } = message;
  if (![owner, repository].every(value => typeof value === 'string' && /^[A-Za-z0-9_.-]{1,100}$/.test(value))) {
    respond({ error: 'Invalid repository' });
    return;
  }
  (async () => {
    if (message.type === 'bettergithub:invalidate') {
      cache.delete(`${owner}/${repository}`.toLowerCase());
      respond({ ok: true });
      return;
    }
    if (message.type === 'bettergithub:editor-target') {
      const info = await editorRepository(owner, repository);
      if (info.missingRepository) {
        respond({ missingRepository: true });
        return;
      }
      const { branch } = info;
      if (!branch) {
        respond({ error: 'Repository or default branch unavailable' });
        return;
      }
      for (const filename of [CONFIG_NAME, CONFIG_FALLBACK_NAME]) {
        const file = await rawConfig(owner, repository, branch, filename);
        if (file) {
          respond({ branch, exists: true, filename, config: file.config });
          return;
        }
      }
      respond({ branch, exists: false, filename: CONFIG_NAME, config: null });
      return;
    }
    let file = await loadConfig(owner, repository);
    if (!file && kind === 'profile') file = await loadConfig(owner, '.github');
    const raw = file?.config || null;
    const scope = kind === 'profile' ? 'profile' : kind === 'org' ? 'organization' : null;
    const scoped = scope && raw?.[scope] && typeof raw[scope] === 'object' && !Array.isArray(raw[scope]) ? raw[scope] : raw;
    respond({ config: scoped, assetBase: file?.assetBase || null });
  })().catch(error => respond({ error: String(error) }));
  return true;
});
