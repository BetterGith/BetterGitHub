(() => {
  'use strict';
  const api = chrome;
  const plugins = {
    commands: 'pluginCommandPalette', navigation: 'pluginQuickNavigation',
    repositories: 'pluginRepositorySwitcher', actions: 'pluginQuickActions'
  };
  const names = { commands: 'Command Palette', navigation: 'Quick Navigation', repositories: 'Repository Switcher', actions: 'Quick Actions' };
  const buttonIds = { commands: 'bgh-command-palette', navigation: 'bgh-quick-navigation', repositories: 'bgh-repository-switcher', actions: 'bgh-quick-actions' };
  const shortcuts = { commands: 'Ctrl/⌘ + Shift + Space', navigation: 'Alt + Shift + G', repositories: 'Alt + Shift + R', actions: 'Alt + Shift + A' };
  const icons = {
    commands: [['path', { d: 'm4 5 4 5-4 5m7 0h5' }]],
    navigation: [['path', { d: 'M10 2v16M2 10h16m-5-7 3 3-3 3M7 11l-3 3 3 3' }]],
    repositories: [['rect', { x: 3, y: 3, width: 10, height: 12, rx: 1 }], ['path', { d: 'M7 15v3h10V6h-4M6 6h4M6 9h4' }]],
    actions: [['path', { d: 'm11 2-7 9h6l-1 7 7-10h-6Z' }]]
  };
  const reserved = new Set(['about', 'account', 'apps', 'collections', 'dashboard', 'enterprise', 'explore', 'features', 'issues', 'login', 'logout', 'marketplace', 'new', 'notifications', 'orgs', 'organizations', 'pulls', 'search', 'security', 'settings', 'signup', 'sponsors', 'topics', 'users']);
  const labels = {
    ru: {
      tools: 'Инструменты BetterGitHub', commands: 'Команды', navigation: 'Переходы', repositories: 'Репозитории', actions: 'Действия',
      search: 'Найти команду, раздел или репозиторий…', empty: 'Ничего не найдено', close: 'Закрыть',
      recent: 'Недавний репозиторий', onPage: 'Репозиторий на странице', heading: 'Раздел страницы', openRepo: 'Открыть репозиторий',
      home: 'Главная GitHub', pulls: 'Мои Pull Requests', issues: 'Мои Issues', notifications: 'Уведомления', stars: 'Избранные репозитории',
      copyPage: 'Скопировать ссылку на страницу', copyMarkdown: 'Скопировать ссылку в Markdown',
      copyRepo: 'Скопировать owner/repository', copyHTTPS: 'Скопировать HTTPS URL клонирования', copySSH: 'Скопировать SSH URL клонирования',
      newIssue: 'Создать Issue', newPR: 'Создать Pull Request', copyNumber: 'Скопировать номер',
      copyCheckout: 'Скопировать команду gh pr checkout', top: 'В начало страницы', settings: 'Темы и плагины BetterGitHub',
      copied: 'Скопировано', failed: 'Действие не выполнено. Попробуйте ещё раз.',
      clear: 'Очистить историю', cleared: 'История очищена', preserve: 'Сохранять текущий раздел',
      keys: '↑ ↓ выбрать · Enter открыть · Esc закрыть', private: 'Приватный', results: 'Результатов'
    },
    en: {
      tools: 'BetterGitHub tools', commands: 'Commands', navigation: 'Navigate', repositories: 'Repositories', actions: 'Actions',
      search: 'Find a command, section or repository…', empty: 'No results', close: 'Close',
      recent: 'Recent repository', onPage: 'Repository on this page', heading: 'Page section', openRepo: 'Open repository',
      home: 'GitHub dashboard', pulls: 'My pull requests', issues: 'My issues', notifications: 'Notifications', stars: 'Starred repositories',
      copyPage: 'Copy page URL', copyMarkdown: 'Copy Markdown link',
      copyRepo: 'Copy owner/repository', copyHTTPS: 'Copy HTTPS clone URL', copySSH: 'Copy SSH clone URL',
      newIssue: 'New issue', newPR: 'New pull request', copyNumber: 'Copy number',
      copyCheckout: 'Copy gh pr checkout command', top: 'Scroll to top', settings: 'BetterGitHub themes and plugins',
      copied: 'Copied', failed: 'Action failed. Please try again.',
      clear: 'Clear history', cleared: 'History cleared', preserve: 'Keep the current section',
      keys: '↑ ↓ select · Enter open · Esc close', private: 'Private', results: 'Results'
    }
  };
  let preferences = {}, ready = false, launcherGroup, dialog, mode, items = [], selected = 0;
  const launchers = new Map();
  let timer = null, toastTimer, remembered = '', generation = 0;
  const t = key => labels[preferences.settings?.language === 'en' ? 'en' : 'ru'][key];
  const enabled = kind => ready && preferences.settings?.themeDisabled !== true && preferences[plugins[kind]] === true;
  const active = () => Object.keys(plugins).some(enabled);
  const validName = value => typeof value === 'string' && /^[A-Za-z0-9_.-]{1,100}$/.test(value) && value !== '.' && value !== '..';
  const send = message => new Promise((resolve, reject) => api.runtime.sendMessage(message, result => {
    const error = api.runtime.lastError;
    if (error || result?.error) reject(new Error(error?.message || result.error));
    else resolve(result || {});
  }));
  const localSet = values => new Promise((resolve, reject) => api.storage.local.set(values, () => {
    const error = api.runtime.lastError;
    if (error) reject(new Error(error.message)); else resolve();
  }));
  function githubURL(value) {
    try {
      const url = new URL(value, location.origin);
      return url.origin === 'https://github.com' && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }
  function repoName(value) {
    if (typeof value !== 'string') return null;
    const parts = value.split('/');
    return parts.length === 2 && parts.every(validName) && !reserved.has(parts[0].toLowerCase()) ? parts.join('/') : null;
  }
  function context() {
    const parts = location.pathname.split('/').filter(Boolean);
    const fromMeta = repoName(document.querySelector('meta[name="octolytics-dimension-repository_nwo"]')?.content);
    const path = repoName(parts.slice(0, 2).join('/'));
    if (path && ((fromMeta && fromMeta.toLowerCase() === path.toLowerCase()) || document.querySelector('#repository-container-header'))) {
      return { name: fromMeta || path, root: `/${fromMeta || path}`, section: parts[2] || '', number: /^\d+$/.test(parts[3] || '') ? parts[3] : null };
    }
    return null;
  }
  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function notify(message) {
    document.getElementById('bgh-tools-toast')?.remove();
    const toast = node('div', message);
    toast.id = 'bgh-tools-toast'; toast.setAttribute('role', 'status');
    document.body.append(toast);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.remove(), 3000);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const previousFocus = document.activeElement;
      const input = node('textarea'); input.value = text; input.className = 'bgh-tools-copy';
      document.body.append(input); input.select();
      try { if (!document.execCommand('copy')) throw new Error('Copy failed'); }
      finally { input.remove(); if (previousFocus?.isConnected) previousFocus.focus(); }
    }
    if (active()) notify(t('copied'));
  }
  function unique(commands) {
    const keys = new Set();
    return commands.filter(command => {
      if (keys.has(command.id)) return false;
      keys.add(command.id); return true;
    });
  }
  function linkCommand(id, title, href, detail = '', keywords = '') {
    const url = githubURL(href);
    return url ? { id, title, href: url, detail, keywords } : null;
  }
  function navigationCommands(withHeadings) {
    const result = [
      ['home', '/dashboard', 'главная home dashboard'], ['pulls', '/pulls', 'pr pull requests'],
      ['issues', '/issues', 'задачи issues'], ['notifications', '/notifications', 'уведомления notifications'], ['stars', '/stars', 'избранное stars']
    ].map(([key, href, keywords]) => linkCommand(`global:${key}`, t(key), href, 'GitHub', keywords));
    const current = context();
    const profile = location.pathname.split('/').filter(Boolean);
    for (const link of document.querySelectorAll('nav a[href], .UnderlineNav a[href]')) {
      if (link.closest('#bgh-tools-dialog')) continue;
      const href = githubURL(link.getAttribute('href'));
      if (!href) continue;
      const url = new URL(href);
      const repositoryTab = current && link.hasAttribute('data-tab-item') && (url.pathname === current.root || url.pathname.startsWith(current.root + '/'));
      const profileTab = profile.length === 1 && validName(profile[0]) && url.pathname.toLowerCase() === `/${profile[0]}`.toLowerCase();
      if (!repositoryTab && !profileTab) continue;
      const title = (link.querySelector('[data-component="text"]')?.textContent || link.textContent).replace(/\s+/g, ' ').trim();
      if (title) result.push(linkCommand(`nav:${url.pathname}${url.search}`, title, href, current?.name || profile[0]));
    }
    if (withHeadings) {
      const headings = document.querySelectorAll('main .markdown-body h2, main .markdown-body h3, #user-profile-frame h2, .Layout-sidebar h2');
      let index = 0;
      for (const heading of headings) {
        if (index >= 40 || heading.closest('.sr-only, [aria-hidden="true"], #bgh-tools-dialog') || heading.checkVisibility?.() === false) continue;
        const title = heading.textContent.replace(/\s+/g, ' ').trim();
        if (!title) continue;
        result.push({ id: `heading:${index++}`, title, detail: t('heading'), keywords: 'раздел section heading', run: () => {
          if (heading.isConnected) heading.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        } });
      }
    }
    return result.filter(Boolean);
  }
  function repositoryCommands() {
    const recents = Array.isArray(preferences.navigationHistory) ? preferences.navigationHistory : [];
    const repositories = new Map();
    for (const item of recents.slice(0, 30)) {
      const name = repoName(item?.name);
      if (name) repositories.set(name.toLowerCase(), { name, detail: t('recent'), private: item.private === true });
    }
    for (const link of document.querySelectorAll('a[href]')) {
      if (repositories.size >= 80 || link.closest('#bgh-tools-dialog')) continue;
      const href = githubURL(link.getAttribute('href'));
      if (!href) continue;
      const url = new URL(href);
      if (!/^\/[^/]+\/[^/]+\/?$/.test(url.pathname)) continue;
      const name = repoName(url.pathname.replace(/^\/|\/$/g, ''));
      if (name && !repositories.has(name.toLowerCase())) repositories.set(name.toLowerCase(), { name, detail: t('onPage') });
    }
    const query = dialog?.querySelector('input[role="combobox"]')?.value.trim() || '';
    let requested = repoName(query);
    if (!requested && /^https:\/\/github\.com\//i.test(query)) {
      const href = githubURL(query);
      if (href) requested = repoName(new URL(href).pathname.replace(/^\/|\/$/g, ''));
    }
    if (requested && !repositories.has(requested.toLowerCase())) repositories.set(requested.toLowerCase(), { name: requested, detail: t('openRepo') });
    const current = context();
    const suffix = preferences.navigationPreserveSection !== false && ['issues', 'pulls', 'actions', 'releases', 'projects', 'wiki', 'security', 'pulse', 'discussions'].includes(current?.section) ? `/${current.section}` : '';
    return [...repositories.values()].map(item => linkCommand(`repo:${item.name.toLowerCase()}`, item.name, `/${item.name}${suffix}`, item.detail + (item.private ? ` · ${t('private')}` : ''))).filter(Boolean);
  }
  function actionCommands() {
    const current = context();
    const copyAction = (id, key, value, detail = '') => ({ id, title: t(key), detail, keywords: 'copy скопировать ссылка link', run: () => copy(value) });
    const title = document.title.replace(/\\/g, '\\\\').replace(/[\[\]]/g, '\\$&');
    const commands = [
      copyAction('copy:page', 'copyPage', location.href),
      copyAction('copy:markdown', 'copyMarkdown', `[${title}](${location.href.replace(/\)/g, '%29')})`),
      { id: 'scroll:top', title: t('top'), run: () => window.scrollTo({ top: 0, behavior: 'auto' }) }
    ];
    if (current) {
      commands.unshift(copyAction('copy:repository', 'copyRepo', current.name, current.name));
      commands.push(copyAction('copy:https', 'copyHTTPS', `https://github.com/${current.name}.git`));
      commands.push(copyAction('copy:ssh', 'copySSH', `git@github.com:${current.name}.git`));
      const tabs = [...document.querySelectorAll('nav a[data-tab-item]')];
      if (tabs.some(link => link.dataset.tabItem === 'issues')) commands.push(linkCommand('new:issue', t('newIssue'), `${current.root}/issues/new`));
      if (tabs.some(link => link.dataset.tabItem === 'pull-requests')) commands.push(linkCommand('new:pr', t('newPR'), `${current.root}/compare`));
      if (current.number && ['pull', 'issues'].includes(current.section)) {
        commands.push(copyAction('copy:number', 'copyNumber', `#${current.number}`, `#${current.number}`));
        if (current.section === 'pull') commands.push(copyAction('copy:checkout', 'copyCheckout', `gh pr checkout ${current.number}`));
      }
    }
    return commands.filter(Boolean);
  }
  function commands() {
    let result;
    if (mode === 'repositories') result = repositoryCommands();
    else if (mode === 'actions') result = actionCommands();
    else if (mode === 'navigation') result = navigationCommands(true);
    else result = [
      ...navigationCommands(enabled('navigation')),
      ...(enabled('repositories') ? repositoryCommands() : []),
      ...(enabled('actions') ? actionCommands() : []),
      { id: 'settings', title: t('settings'), run: () => send({ type: 'bettergithub:open-options' }) }
    ];
    return unique(result);
  }
  function score(command, query) {
    if (!query) return 1;
    const title = command.title.toLocaleLowerCase();
    const haystack = `${title} ${command.detail || ''} ${command.keywords || ''} ${command.href || ''}`.toLocaleLowerCase();
    const words = query.split(/\s+/).filter(Boolean);
    if (words.every(word => haystack.includes(word))) return title.startsWith(query) ? 100 : title.includes(query) ? 80 : 50;
    let position = 0;
    for (const char of query.replace(/\s/g, '')) {
      position = haystack.indexOf(char, position);
      if (position < 0) return 0;
      position++;
    }
    return 10;
  }
  function select(index) {
    selected = items.length ? (index + items.length) % items.length : 0;
    const rows = dialog?.querySelectorAll('[role="option"]') || [];
    rows.forEach((row, i) => row.setAttribute('aria-selected', String(i === selected)));
    const input = dialog?.querySelector('input[role="combobox"]');
    if (rows[selected]) {
      input.setAttribute('aria-activedescendant', rows[selected].id);
      rows[selected].scrollIntoView?.({ block: 'nearest' });
    } else input?.removeAttribute('aria-activedescendant');
  }
  function render() {
    if (!dialog?.open) return;
    const input = dialog.querySelector('input[role="combobox"]');
    const query = input.value.trim().toLocaleLowerCase().slice(0, 120);
    items = commands().map((command, index) => ({ command, index, score: score(command, query) }))
      .filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 80).map(item => item.command);
    const list = dialog.querySelector('[role="listbox"]');
    list.replaceChildren();
    for (const [index, command] of items.entries()) {
      const row = node(command.href ? 'a' : 'div');
      row.id = `bgh-tools-option-${index}`; row.setAttribute('role', 'option'); row.tabIndex = -1;
      if (command.href) row.href = command.href;
      row.append(node('span', command.title, 'bgh-tools-label'));
      if (command.detail) row.append(node('small', command.detail));
      row.addEventListener('pointermove', () => select(index));
      row.addEventListener('click', event => {
        if (!enabled(mode)) { event.preventDefault(); return; }
        if (command.href) { close(); return; }
        event.preventDefault(); execute(command);
      });
      list.append(row);
    }
    dialog.querySelector('#bgh-tools-empty').hidden = items.length !== 0;
    dialog.querySelector('#bgh-tools-count').textContent = `${t('results')}: ${items.length}`;
    select(0);
  }
  function close() {
    if (dialog?.open) dialog.close();
  }
  async function execute(command, newTab = false) {
    if (!command || !enabled(mode)) return;
    close();
    try {
      if (command.href) {
        const href = githubURL(command.href);
        if (href) {
          if (newTab) window.open(href, '_blank', 'noopener');
          else location.assign(href);
        }
      } else await command.run();
    } catch { if (active()) notify(t('failed')); }
  }
  function switchMode(kind) {
    if (!enabled(kind)) return;
    mode = kind;
    dialog.querySelector('h2').textContent = names[mode];
    dialog.dataset.toolsPlugin = mode;
    dialog.querySelector('input[role="combobox"]').value = '';
    dialog.querySelector('#bgh-tools-repository-settings').hidden = mode !== 'repositories';
    render(); dialog.querySelector('input[role="combobox"]').focus();
  }
  function open(kind) {
    if (!enabled(kind)) return;
    if (document.querySelector('dialog[open]:not(#bgh-tools-dialog), [role="dialog"][aria-modal="true"]')) return;
    if (!dialog?.isConnected) {
      dialog = node('dialog'); dialog.id = 'bgh-tools-dialog'; dialog.setAttribute('aria-labelledby', 'bgh-tools-title');
      dialog.setAttribute('closedby', 'any');
      dialog.innerHTML = '<header><h2 id="bgh-tools-title"></h2><button type="button" id="bgh-tools-close">×</button></header><input type="text" inputmode="search" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="bgh-tools-results"><div id="bgh-tools-results" role="listbox"></div><p id="bgh-tools-empty" hidden></p><div id="bgh-tools-repository-settings"><label><input type="checkbox"><span></span></label><button type="button"></button></div><footer><span id="bgh-tools-count" role="status" aria-live="polite"></span><span id="bgh-tools-keys"></span></footer>';
      document.body.append(dialog);
      dialog.querySelector('#bgh-tools-close').addEventListener('click', close);
      if (!('closedBy' in HTMLDialogElement.prototype)) {
        const outside = event => {
          const r = dialog.getBoundingClientRect();
          return event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom;
        };
        let pressedOutside = false;
        dialog.addEventListener('pointerdown', event => { pressedOutside = outside(event); });
        dialog.addEventListener('pointerup', event => { if (pressedOutside && outside(event)) close(); });
      }
      const input = dialog.querySelector('input[role="combobox"]');
      input.autofocus = true;
      input.addEventListener('input', render);
      input.addEventListener('keydown', event => {
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          select(event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : selected + (event.key === 'ArrowDown' ? 1 : -1));
        } else if (event.key === 'Enter' && !event.isComposing) {
          event.preventDefault(); execute(items[selected], event.ctrlKey || event.metaKey);
        }
      });
      const preserve = dialog.querySelector('#bgh-tools-repository-settings input');
      preserve.addEventListener('change', async () => {
        const old = preferences.navigationPreserveSection;
        preferences.navigationPreserveSection = preserve.checked; render();
        try { await localSet({ navigationPreserveSection: preserve.checked }); }
        catch { preferences.navigationPreserveSection = old; preserve.checked = old !== false; render(); notify(t('failed')); }
      });
      dialog.querySelector('#bgh-tools-repository-settings button').addEventListener('click', async () => {
        try { await send({ type: 'bettergithub:clear-repository-history' }); notify(t('cleared')); }
        catch { notify(t('failed')); }
      });
    }
    dialog.querySelector('#bgh-tools-close').setAttribute('aria-label', t('close'));
    const input = dialog.querySelector('input[role="combobox"]'); input.placeholder = t('search'); input.setAttribute('aria-label', t('search'));
    dialog.querySelector('#bgh-tools-empty').textContent = t('empty');
    dialog.querySelector('#bgh-tools-keys').textContent = t('keys');
    dialog.querySelector('#bgh-tools-repository-settings span').textContent = t('preserve');
    dialog.querySelector('#bgh-tools-repository-settings button').textContent = t('clear');
    dialog.querySelector('#bgh-tools-repository-settings input').checked = preferences.navigationPreserveSection !== false;
    if (!dialog.open) dialog.showModal();
    switchMode(kind);
  }
  function removeUI() {
    close(); dialog?.remove(); launcherGroup?.remove(); document.getElementById('bgh-tools-toast')?.remove();
    dialog = launcherGroup = null; launchers.clear();
  }
  function refresh() {
    timer = null;
    if (!ready || !document.body) return;
    if (!active()) { generation++; remembered = ''; removeUI(); return; }
    const host = document.querySelector('.AppHeader-globalBar-end, .AppHeader-actions, header .HeaderMenu-right');
    const signup = [...document.querySelectorAll('header a[href*="/signup"]')].find(link => link.checkVisibility?.() !== false);
    const target = innerWidth >= 768 ? host || signup?.parentElement : null;
    if (!launcherGroup?.isConnected) {
      launcherGroup = node('div'); launcherGroup.id = 'bgh-tools-launchers';
      launcherGroup.setAttribute('role', 'toolbar'); launcherGroup.setAttribute('aria-label', 'BetterGitHub');
      launchers.clear();
    }
    for (const kind of Object.keys(plugins)) {
      if (!enabled(kind)) { launchers.get(kind)?.remove(); launchers.delete(kind); continue; }
      if (!launchers.has(kind)) {
        const button = node('button'); button.id = buttonIds[kind]; button.type = 'button'; button.className = 'bgh-tool-launcher'; button.dataset.toolsMode = kind;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        for (const [key, value] of Object.entries({ viewBox: '0 0 20 20', width: 18, height: 18, 'aria-hidden': true })) svg.setAttribute(key, String(value));
        for (const [tag, attributes] of icons[kind]) {
          const shape = document.createElementNS(svg.namespaceURI, tag);
          for (const [key, value] of Object.entries(attributes)) shape.setAttribute(key, String(value));
          svg.append(shape);
        }
        button.append(svg);
        button.addEventListener('click', () => open(kind)); launcherGroup.append(button); launchers.set(kind, button);
      }
      const button = launchers.get(kind);
      button.title = `${names[kind]} · ${shortcuts[kind]}`; button.setAttribute('aria-label', names[kind]); button.setAttribute('aria-haspopup', 'dialog');
    }
    launcherGroup.classList.toggle('bgh-tools-floating', !target);
    if (launcherGroup.parentElement !== (target || document.body)) (target || document.body).append(launcherGroup);
    if (dialog?.open && !enabled(mode)) close();
    const current = context();
    if (enabled('repositories') && current && remembered !== current.name.toLowerCase()) {
      const expected = ++generation;
      remembered = current.name.toLowerCase();
      const isPrivate = /private|приватн/i.test(document.querySelector('[data-testid="repo-visibility-label"]')?.textContent || '');
      send({ type: 'bettergithub:remember-repository', name: current.name, private: isPrivate }).catch(() => {
        if (expected === generation) remembered = '';
      });
    }
  }
  function schedule() { if (timer === null) timer = setTimeout(refresh, 50); }
  document.addEventListener('keydown', event => {
    if (!active() || event.defaultPrevented || event.isComposing || event.repeat) return;
    if (event.target.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    let kind;
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.code === 'Space') kind = 'commands';
    if (event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey) kind = ({ KeyG: 'navigation', KeyR: 'repositories', KeyA: 'actions' })[event.code];
    if (!enabled(kind)) return;
    event.preventDefault(); open(kind);
  });
  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    let changed = false;
    for (const key of ['settings', ...Object.values(plugins), 'navigationHistory', 'navigationPreserveSection']) {
      if (Object.hasOwn(changes, key)) { preferences[key] = changes[key].newValue; changed = true; }
    }
    if (!changed) return;
    if (!enabled('repositories')) { generation++; remembered = ''; }
    refresh();
    if (dialog?.open) { const query = dialog.querySelector('input[role="combobox"]').value; open(mode); dialog.querySelector('input[role="combobox"]').value = query; render(); }
  });
  api.storage.local.get(['settings', ...Object.values(plugins), 'navigationHistory', 'navigationPreserveSection'], data => {
    if (api.runtime.lastError) return;
    preferences = { ...data, ...preferences }; ready = true; refresh();
  });
  document.addEventListener('turbo:before-cache', removeUI);
  document.addEventListener('turbo:load', schedule);
  addEventListener('popstate', schedule);
  addEventListener('resize', schedule);
  new MutationObserver(records => {
    if (active() && records.some(record => !record.target.closest?.('#bgh-tools-dialog, #bgh-tools-launchers, #bgh-tools-toast'))) schedule();
  }).observe(document, { childList: true, subtree: true });
})();
