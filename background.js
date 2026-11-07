const CONFIG_NAME = '.bettergithub.json';
const CONFIG_FALLBACK_NAME = 'bettergithub.json';
const MAX_CONFIG_BYTES = 64 * 1024;
const cache = new Map();

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
  if (!response.ok) return null;
  const html = await response.text();
  const match = html.match(/"defaultBranch":"([^"\\]*(?:\\.[^"\\]*)*)"/);
  if (!match) return null;
  let branch;
  try { branch = JSON.parse(`"${match[1]}"`); } catch { return null; }
  return typeof branch === 'string' && /^[A-Za-z0-9._/-]{1,255}$/.test(branch) && !branch.includes('..') && !branch.includes('//') && !branch.startsWith('/') && !branch.endsWith('/') ? branch : null;
}

async function defaultBranch(owner, repository) {
  try {
    const info = await githubJson(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`);
    if (typeof info?.default_branch === 'string' && info.default_branch) return info.default_branch;
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
  if (sender.id !== chrome.runtime.id || !['bettergithub:load', 'bettergithub:editor-target', 'bettergithub:invalidate'].includes(message?.type)) return;
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
      const branch = await defaultBranch(owner, repository);
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
