(() => {
  'use strict';
  const plugins = new Map(), listeners = new Set();
  const defaults = Object.freeze({ commands: 'Mod+Shift+Space', navigation: 'Alt+Shift+G', repositories: 'Alt+Shift+R', actions: 'Alt+Shift+A' });
  const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_:/.-]{1,160}$/.test(value);
  const repoName = value => typeof value === 'string' && /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(value) && value.split('/').every(part => !['.', '..'].includes(part)) ? value : null;
  function registerPlugin(plugin) {
    if (!plugin || !/^[a-z][a-z0-9-]{0,39}$/.test(plugin.id) || typeof plugin.name !== 'string' || typeof plugin.commands !== 'function') throw new Error('Invalid plugin command provider');
    if (plugins.has(plugin.id)) throw new Error(`Already registered: ${plugin.id}`);
    const record = Object.freeze({ ...plugin });
    plugins.set(plugin.id, record); listeners.forEach(notify => notify());
    return () => { if (plugins.get(plugin.id) === record) { plugins.delete(plugin.id); listeners.forEach(notify => notify()); } };
  }
  const enabled = (plugin, preferences) => preferences.settings?.themeDisabled !== true && (plugin.flag ? (preferences[plugin.flag] ?? plugin.defaultEnabled ?? false) === true : true);
  function installed(preferences) {
    return [...plugins.values()].map(plugin => ({ id: plugin.id, name: plugin.name, flag: plugin.flag, enabled: enabled(plugin, preferences) }));
  }
  function collect(context, preferences) {
    const commands = [], used = new Set();
    for (const plugin of plugins.values()) {
      if (!enabled(plugin, preferences)) continue;
      let provided;
      try { provided = plugin.commands(context, preferences); } catch (error) { console.warn('BetterGitHub command provider:', plugin.id, error); continue; }
      if (!Array.isArray(provided)) continue;
      for (const command of provided.slice(0, 100)) {
        if (!command || !validId(command.id) || typeof command.title !== 'string' || (!command.href && typeof command.run !== 'function')) continue;
        const id = `${plugin.id}:${command.id}`;
        if (!validId(id) || used.has(id)) continue;
        used.add(id); commands.push({ ...command, id, pluginId: plugin.id, pluginTitle: plugin.name });
      }
    }
    return commands;
  }
  function shortcut(value) {
    if (typeof value !== 'string' || value.length > 70) return null;
    if (value === '') return '';
    const tokens = value.split('+').map(token => token.trim());
    const key = tokens.pop();
    if (!key || !tokens.length || new Set(tokens).size !== tokens.length || tokens.some(token => !['Mod', 'Ctrl', 'Meta', 'Alt', 'Shift'].includes(token))) return null;
    if (!tokens.some(token => ['Mod', 'Ctrl', 'Meta', 'Alt'].includes(token)) || (tokens.includes('Mod') && (tokens.includes('Ctrl') || tokens.includes('Meta')))) return null;
    const normalizedKey = /^(?:Key)?[a-z]$/i.test(key) ? key.at(-1).toUpperCase() : /^(?:Digit)?[0-9]$/.test(key) ? key.at(-1) : key;
    if (!/^(?:[A-Z0-9]|Space|Enter|F[1-9]|F1[0-2])$/.test(normalizedKey)) return null;
    // Preserve GitHub's own command palette and browser/OS navigation shortcuts.
    if (tokens.some(token => ['Mod', 'Ctrl', 'Meta'].includes(token)) && ['K', 'L', 'T', 'W', 'N', 'Q', 'R', 'O', 'P', 'H', 'J', 'D'].includes(normalizedKey)) return null;
    if (tokens.includes('Alt') && ['F4', 'Space'].includes(normalizedKey)) return null;
    return [...['Mod','Ctrl','Meta','Alt','Shift'].filter(token => tokens.includes(token)), normalizedKey].join('+');
  }
  function shortcutFromEvent(event) {
    const key = /^Key[A-Z]$/.test(event.code) ? event.code.slice(3) : /^Digit\d$/.test(event.code) ? event.code.slice(5) : event.code;
    return shortcut([event.ctrlKey && 'Ctrl', event.metaKey && 'Meta', event.altKey && 'Alt', event.shiftKey && 'Shift', key].filter(Boolean).join('+'));
  }
  function matchesShortcut(binding, event) {
    const normalized = shortcut(binding);
    if (!normalized) return false;
    const parts = normalized.split('+'), key = parts.pop();
    const code = /^[A-Z]$/.test(key) ? `Key${key}` : /^\d$/.test(key) ? `Digit${key}` : key;
    const mod = parts.includes('Mod');
    return event.code === code && Boolean(event.shiftKey) === parts.includes('Shift') && Boolean(event.altKey) === parts.includes('Alt') &&
      (mod ? Boolean(event.ctrlKey) !== Boolean(event.metaKey) : Boolean(event.ctrlKey) === parts.includes('Ctrl') && Boolean(event.metaKey) === parts.includes('Meta'));
  }
  function bindings(preferences) {
    const result = { ...defaults };
    for (const [id, value] of Object.entries(preferences.commandShortcuts || {}).slice(0, 200)) {
      const normalized = shortcut(value);
      if (validId(id) && normalized !== null) result[id] = normalized;
    }
    return result;
  }
  function normalizeCustom(values) {
    if (!Array.isArray(values)) return [];
    const used = new Set();
    return values.slice(0, 50).flatMap(value => {
      if (!value || !validId(value.id) || used.has(value.id) || typeof value.title !== 'string' || !value.title.trim() || !['link', 'copy'].includes(value.type) || typeof value.value !== 'string' || !value.value.trim() || value.value.length > 2048) return [];
      if (value.type === 'link') {
        try { const url = new URL(value.value.replace(/\{(?:repo|owner|repository|url)\}/g, 'example')); if (url.protocol !== 'https:' || url.username || url.password) return []; } catch { return []; }
      }
      used.add(value.id);
      return [{ id: value.id, title: value.title.trim().slice(0, 80), type: value.type, value: value.value }];
    });
  }
  function expandTemplate(value, context, forURL = false) {
    const name = repoName(context.repository), [owner, repository] = name?.split('/') || [];
    const values = { repo: name, owner, repository, url: forURL ? encodeURIComponent(context.url) : context.url };
    let missing = false;
    const expanded = value.replace(/\{(repo|owner|repository|url)\}/g, (_, key) => {
      if (!values[key]) { missing = true; return ''; }
      return values[key];
    });
    return missing ? null : expanded;
  }
  function search(commands, query, history = []) {
    if (!Array.isArray(history)) history = [];
    const recent = new Map(history.slice(0, 20).map((item,index) => [typeof item === 'string' ? item : item.id, 20-index]));
    const q = query.trim().toLocaleLowerCase().slice(0, 120);
    return commands.map((command,index) => {
      const title = command.title.toLocaleLowerCase(), haystack = `${title} ${command.detail || ''} ${command.pluginTitle || ''} ${command.keywords || ''} ${command.href || ''}`.toLocaleLowerCase();
      let rank = !q ? 1 : q.split(/\s+/).every(token => haystack.includes(token)) ? title.startsWith(q) ? 100 : title.includes(q) ? 80 : 50 : 0;
      if (q && !rank) { let pos = 0; rank = 10; for (const char of q.replace(/\s/g,'')) { pos = haystack.indexOf(char,pos); if (pos < 0) { rank = 0; break; } pos++; } }
      return { command, index, rank, recent: recent.get(command.id) || 0 };
    }).filter(item => item.rank).sort((a,b) => b.rank-a.rank || (!q ? b.recent-a.recent : 0) || a.index-b.index).slice(0,80).map(item => ({ ...item.command, recent: !q && Boolean(item.recent) }));
  }
  // Only extension content scripts share this isolated-world global. Page scripts cannot register providers.
  globalThis.BetterGitHubCommands = Object.freeze({ registerPlugin, installed, collect, defaults, shortcut, shortcutFromEvent, matchesShortcut, bindings, normalizeCustom, expandTemplate, repoName, search,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  });
})();
