(() => {
  'use strict';
  const api = chrome;
  const core = globalThis.BetterGitHubCommands;
  if (!core) throw new Error('BetterGitHub command registry is missing');
  const plugins = {
    commands: 'pluginCommandPalette', navigation: 'pluginQuickNavigation',
    repositories: 'pluginRepositorySwitcher', actions: 'pluginQuickActions'
  };
  const names = { commands: 'Command Palette', navigation: 'Page Navigator', repositories: 'Repository Switcher', actions: 'Quick Actions' };
  const buttonIds = { commands: 'bgh-command-palette', navigation: 'bgh-quick-navigation', repositories: 'bgh-repository-switcher', actions: 'bgh-quick-actions' };
  const icons = {
    commands: [['path', { d: 'm4 5 4 5-4 5m7 0h5' }]],
    navigation: [['path', { d: 'M10 2v16M2 10h16m-5-7 3 3-3 3M7 11l-3 3 3 3' }]],
    repositories: [['rect', { x: 3, y: 3, width: 10, height: 12, rx: 1 }], ['path', { d: 'M7 15v3h10V6h-4M6 6h4M6 9h4' }]],
    actions: [['path', { d: 'm11 2-7 9h6l-1 7 7-10h-6Z' }]]
  };
  const reserved = new Set(['about', 'account', 'apps', 'collections', 'dashboard', 'enterprise', 'explore', 'features', 'issues', 'login', 'logout', 'marketplace', 'new', 'notifications', 'orgs', 'organizations', 'pulls', 'search', 'security', 'settings', 'signup', 'sponsors', 'topics', 'users']);
  const labels = {
    ru: {
      pinned: 'Закреплённые', pin: 'Закрепить', unpin: 'Открепить', opened: 'Открыт', comments: 'Комментарии', comment: 'Комментарий', changedFiles: 'Изменённые файлы', sections: 'Разделы страницы', recentCommands: 'Последние команды', custom: 'Мои команды', configure: 'Настроить', pluginSettings: 'Настройки плагина', compare: 'Сравнить ветки', copyRepositoryURL: 'Скопировать URL репозитория', permalink: 'Скопировать постоянную ссылку на файл', githubDev: 'Открыть в github.dev', copyCommit: 'Скопировать ссылку на коммит', noSections: 'На странице пока нет разделов', tools: 'Инструменты BetterGitHub', commands: 'Команды', navigation: 'Переходы', repositories: 'Репозитории', actions: 'Действия',
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
      pinned: 'Pinned', pin: 'Pin', unpin: 'Unpin', opened: 'Open', comments: 'Comments', comment: 'Comment', changedFiles: 'Changed files', sections: 'Page sections', recentCommands: 'Recent commands', custom: 'My commands', configure: 'Configure', pluginSettings: 'Plugin settings', compare: 'Compare branches', copyRepositoryURL: 'Copy repository URL', permalink: 'Copy file permalink', githubDev: 'Open in github.dev', copyCommit: 'Copy commit link', noSections: 'No page sections yet', tools: 'BetterGitHub tools', commands: 'Commands', navigation: 'Navigate', repositories: 'Repositories', actions: 'Actions',
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
  let preferences = {}, ready = false, launcherGroup, dialog, actionMenu, actionSource, mode, items = [], selected = 0;
  const preferenceKeys = ['settings', ...Object.values(plugins), 'pluginDimLightThemes', 'pluginRepositoryThemes', 'navigationHistory', 'navigationPinned', 'navigationPreserveSection', 'commandHistory', 'commandCustom', 'commandShortcuts', 'navigatorIncludeComments', 'navigatorIncludeChanges', 'quickActionsContextMenu'];
  const observedKeys = () => [...new Set([...preferenceKeys, ...core.installed(preferences).map(plugin => plugin.flag).filter(Boolean)])];
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
      finally { input.remove(); previousFocus?.isConnected && previousFocus.focus(); }
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
  function repositoryCommands() {
    const repositories = new Map(), current = context();
    for (const [key, pinned] of [['navigationPinned', true], ['navigationHistory', false]]) {
      const values = Array.isArray(preferences[key]) ? preferences[key] : [];
      for (const item of values.slice(0, pinned ? 50 : 30)) {
        const name = repoName(item?.name);
        if (name && !repositories.has(name.toLowerCase())) repositories.set(name.toLowerCase(), { name, pinned, private: item.private === true });
      }
    }
    if (current && !repositories.has(current.name.toLowerCase())) repositories.set(current.name.toLowerCase(), { name: current.name, pinned: false });
    const query = dialog?.querySelector('input[role="combobox"]')?.value.trim() || '';
    let requested = repoName(query);
    if (!requested && /^https:\/\/github\.com\//i.test(query)) {
      const href = githubURL(query); if (href) requested = repoName(new URL(href).pathname.replace(/^\/|\/$/g, ''));
    }
    if (requested && !repositories.has(requested.toLowerCase())) repositories.set(requested.toLowerCase(), { name: requested, direct: true });
    const suffix = preferences.navigationPreserveSection !== false && ['issues', 'pulls', 'actions', 'releases', 'projects', 'wiki', 'security', 'pulse', 'discussions'].includes(current?.section) ? `/${current.section}` : '';
    return [...repositories.values()].sort((a,b) => Number(Boolean(b.pinned))-Number(Boolean(a.pinned)) || a.name.split('/')[0].localeCompare(b.name.split('/')[0])).map(item => ({
      ...linkCommand(`repo:${item.name.toLowerCase()}`, item.name, `/${item.name}${suffix}`),
      detail: [current?.name.toLowerCase() === item.name.toLowerCase() ? t('opened') : '', item.private ? t('private') : ''].filter(Boolean).join(' · '),
      repository: item.name, private: item.private, pinned: item.pinned, group: `${item.pinned ? t('pinned') : item.direct ? t('openRepo') : t('recent')} · ${item.name.split('/')[0]}`
    }));
  }
  function pageCommands() {
    const result = [], seen = new Set();
    const jump = (target, id, title, group) => {
      if (!target || !title || seen.has(id) || target.checkVisibility?.() === false || target.closest('#bgh-tools-dialog, #bgh-action-menu, .sr-only, [aria-hidden="true"]')) return;
      seen.add(id); result.push({ id, title, detail: group, group, run: () => {
        if (target.isConnected) target.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      } });
    };
    for (const [index, heading] of [...document.querySelectorAll('main .markdown-body :is(h1,h2,h3,h4,h5,h6), #user-profile-frame :is(h1,h2,h3)')].entries()) {
      if (result.length >= 100) break;
      jump(heading, `heading:${heading.id || index}`, heading.textContent.replace(/\s+/g,' ').trim(), t('heading'));
    }
    if (preferences.navigatorIncludeComments !== false) for (const comment of document.querySelectorAll('[id^="issuecomment-"], [id^="pullrequestreview-"], [id^="discussion_r"]')) {
      if (result.length >= 140) break;
      const author = comment.querySelector('.author, [data-testid="comment-author"]')?.textContent.trim() || t('comment');
      const text = comment.querySelector('.markdown-body')?.textContent.replace(/\s+/g,' ').trim().slice(0,90) || '';
      jump(comment, `comment:${comment.id}`, `${author}${text ? ' — '+text : ''}`, t('comments'));
    }
    if (preferences.navigatorIncludeChanges !== false) {
      for (const file of document.querySelectorAll('.file-header[data-path], [data-testid="diff-file-header"], .file[data-path]')) {
        const path = file.getAttribute('data-path') || file.querySelector('[data-path]')?.getAttribute('data-path') || file.textContent.trim().slice(0,120);
        if (result.length >= 180) break;
        jump(file, `file:${path}`, path, t('changedFiles'));
      }
      const current = context();
      if (current?.section === 'pull' && current.number) for (const link of document.querySelectorAll('a[href]')) {
        const href = githubURL(link.getAttribute('href'));
        if (href && new URL(href).pathname === `${current.root}/pull/${current.number}/files` && !seen.has('pr:files')) {
          result.push({ ...linkCommand('pr:files', t('changedFiles'), href), group: t('sections') }); seen.add('pr:files');
        }
      }
    }
    return result;
  }
  function filePermalink(current) {
    if (!current || current.section !== 'blob') return null;
    for (const script of document.querySelectorAll('script[type="application/json"]')) {
      if (script.textContent.length > 3_000_000 || !script.textContent.includes('currentOid')) continue;
      try {
        const payload = JSON.parse(script.textContent).payload;
        const route = payload?.codeViewBlobLayoutRoute || payload?.codeViewLayoutRoute;
        const { path, refInfo } = route || {};
        if (typeof path !== 'string' || typeof refInfo?.name !== 'string' || !/^[a-f0-9]{40,64}$/i.test(refInfo.currentOid || '')) continue;
        if (decodeURIComponent(location.pathname) !== `${current.root}/blob/${refInfo.name}/${path}`) continue;
        const hash = /^#L\d+(?:-L\d+)?$/.test(location.hash) ? location.hash : '';
        return `${location.origin}${current.root}/blob/${refInfo.currentOid}/${path.split('/').map(encodeURIComponent).join('/')}${hash}`;
      } catch { /* Ignore unrelated or stale page data. */ }
    }
    return null;
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
      commands.unshift(copyAction('copy:repository-url', 'copyRepositoryURL', `${location.origin}${current.root}`), copyAction('copy:repository', 'copyRepo', current.name, current.name));
      commands.push({ id: 'open:github-dev', title: t('githubDev'), href: `https://github.dev${location.pathname}${location.hash}` });
      const permalink = filePermalink(current);
      if (permalink) commands.push(copyAction('copy:permalink', 'permalink', permalink));
      if (current.section === 'commit' && /^[a-f0-9]{7,64}$/i.test(location.pathname.split('/')[4] || '')) commands.push(copyAction('copy:commit', 'copyCommit', location.origin + location.pathname));
      commands.push(copyAction('copy:https', 'copyHTTPS', `https://github.com/${current.name}.git`));
      commands.push(copyAction('copy:ssh', 'copySSH', `git@github.com:${current.name}.git`));
      const tabs = [...document.querySelectorAll('nav a[data-tab-item]')];
      if (tabs.some(link => link.dataset.tabItem === 'issues')) commands.push(linkCommand('new:issue', t('newIssue'), `${current.root}/issues/new`));
      if (tabs.some(link => link.dataset.tabItem === 'pull-requests')) commands.push(linkCommand('compare:branches', t('compare'), `${current.root}/compare`));
      if (current.number && ['pull', 'issues'].includes(current.section)) {
        commands.push(copyAction('copy:number', 'copyNumber', `#${current.number}`, `#${current.number}`));
        if (current.section === 'pull') commands.push(copyAction('copy:checkout', 'copyCheckout', `gh pr checkout ${current.number}`));
      }
    }
    return commands.filter(Boolean);
  }
  const commandContext = () => ({ url: location.href, repository: context()?.name || null, section: context()?.section || '', language: preferences.settings?.language || 'ru' });
  const settingsCommand = (id, title, plugin) => ({ id, title, run: () => send({ type: 'bettergithub:open-options', plugin }) });
  core.registerPlugin({ id: 'command-palette', name: names.commands, flag: plugins.commands, commands: () => [settingsCommand('settings', t('pluginSettings'), plugins.commands)] });
  core.registerPlugin({ id: 'page-navigator', name: names.navigation, flag: plugins.navigation, commands: pageCommands });
  core.registerPlugin({ id: 'repository-switcher', name: names.repositories, flag: plugins.repositories, commands: repositoryCommands });
  core.registerPlugin({ id: 'quick-actions', name: names.actions, flag: plugins.actions, commands: actionCommands });
  core.registerPlugin({ id: 'repository-themes', name: 'Repository theme editor', flag: 'pluginRepositoryThemes', defaultEnabled: true, commands: () => [settingsCommand('settings', t('pluginSettings'), 'pluginRepositoryThemes')] });
  core.registerPlugin({ id: 'soften-themes', name: 'Soften light themes', flag: 'pluginDimLightThemes', commands: () => [settingsCommand('settings', t('pluginSettings'), 'pluginDimLightThemes')] });
  core.registerPlugin({ id: 'custom', name: 'Custom commands', flag: plugins.commands, commands: ctx => core.normalizeCustom(preferences.commandCustom).flatMap(command => {
    const value = core.expandTemplate(command.value, ctx, command.type === 'link');
    if (value === null) return [];
    return [{ id: command.id, title: command.title, detail: t('custom'), ...(command.type === 'link' ? { href: value, userLink: true } : { run: () => copy(value) }) }];
  }) });
  function commands() {
    if (mode === 'repositories') return repositoryCommands();
    if (mode === 'actions') return actionCommands();
    if (mode === 'navigation') return pageCommands();
    return unique([
      settingsCommand('bgh:settings', t('settings')),
      ...core.installed(preferences).filter(plugin => plugin.id !== 'custom').map(plugin => settingsCommand(`plugin:${plugin.id}`, `${t('configure')}: ${plugin.name}`, plugin.flag)),
      ...core.collect(commandContext(), preferences)
    ]);
  }
  function destination(command) {
    try {
      const url = new URL(command.href, location.origin);
      return url.protocol === 'https:' && !url.username && !url.password && (command.userLink || ['github.com', 'github.dev'].includes(url.hostname)) ? url.href : null;
    } catch { return null; }
  }
  async function recordCommand(command) {
    if (enabled('commands') && command?.id) await send({ type: 'bettergithub:remember-command', id: command.id });
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
    items = core.search(commands(), query, mode === 'commands' ? preferences.commandHistory : []);
    const list = dialog.querySelector('[role="listbox"]');
    list.replaceChildren();
    let lastGroup;
    for (const [index, command] of items.entries()) {
      const group = command.group || (command.recent ? t('recentCommands') : command.pluginTitle || 'BetterGitHub');
      if (lastGroup !== group) { const heading = node('div', group, 'bgh-tools-group'); heading.setAttribute('role', 'presentation'); list.append(heading); lastGroup = group; }
      const row = node(command.href ? 'a' : 'div');
      row.id = `bgh-tools-option-${index}`; row.setAttribute('role', 'option'); row.tabIndex = -1;
      if (command.href) row.href = command.href;
      row.append(node('span', command.title, 'bgh-tools-label'));
      if (command.detail) row.append(node('small', command.detail));
      row.addEventListener('pointermove', () => select(index));
      row.addEventListener('click', event => {
        if (!enabled(mode)) { event.preventDefault(); return; }
        if (command.href) { if (!destination(command)) { event.preventDefault(); return; } void recordCommand(command).catch(() => {}); close(); return; }
        event.preventDefault(); execute(command);
      });
      if (command.repository) {
        const pin = node('button', command.pinned ? '★' : '☆', 'bgh-repository-pin'); pin.type = 'button'; pin.title = `${t(command.pinned ? 'unpin' : 'pin')}: ${command.repository}`; pin.setAttribute('aria-label', pin.title); pin.setAttribute('aria-pressed', String(Boolean(command.pinned)));
        pin.addEventListener('click', async event => { event.preventDefault(); event.stopPropagation(); try { await send({ type: 'bettergithub:toggle-repository-pin', name: command.repository, private: command.private === true }); } catch { notify(t('failed')); } });
        const wrapper = node('div', undefined, 'bgh-repository-row'); wrapper.append(row, pin); list.append(wrapper);
      } else list.append(row);
    }
    dialog.querySelector('#bgh-tools-empty').hidden = items.length !== 0;
    dialog.querySelector('#bgh-tools-count').textContent = `${t('results')}: ${items.length}`;
    select(0);
  }
  function close() {
    if (actionMenu?.matches(':popover-open')) actionMenu.hidePopover();
    if (dialog?.open) dialog.close();
  }
  function openActionsMenu(source = document.activeElement) {
    if (!enabled('actions') || document.querySelector('dialog[open]')) return;
    if (actionMenu?.matches(':popover-open')) { actionMenu.hidePopover(); actionSource?.focus?.(); return; }
    mode = 'actions';
    actionMenu?.remove();
    actionSource = source;
    actionMenu = node('div'); actionMenu.id = 'bgh-action-menu'; actionMenu.setAttribute('popover', 'auto');
    const group = node('div', undefined, 'bgh-action-items'); group.setAttribute('role', 'menu'); group.setAttribute('aria-label', names.actions);
    actionMenu.append(group); document.body.append(actionMenu);
    // Some Chromium builds expose focusGroup before menu roles/behavior are implemented.
    // Use one explicit ARIA menu and keyboard path in both supported browser families.
    const finish = () => { if (actionSource?.isConnected) actionSource.focus({ preventScroll: true }); if (actionMenu?.matches(':popover-open')) actionMenu.hidePopover(); };
    for (const action of actionCommands()) {
      const command = { ...action, id: `quick-actions:${action.id}` };
      const item = node(command.href ? 'a' : 'button', command.title);
      if (command.href) { const href = destination(command); if (!href) continue; item.href = href; }
      else item.type = 'button';
      item.setAttribute('role', 'menuitem'); item.tabIndex = -1;
      item.addEventListener('pointermove', () => item.focus({ preventScroll: true }));
      item.addEventListener('click', event => {
        if (!enabled('actions')) { event.preventDefault(); return; }
        finish();
        if (command.href) void recordCommand(command).catch(() => {});
        else { event.preventDefault(); void execute(command); }
      });
      group.append(item);
    }
    const configure = node('button', t('pluginSettings')); configure.type = 'button';
    configure.setAttribute('role', 'menuitem'); configure.tabIndex = -1;
    configure.addEventListener('click', () => { finish(); void send({ type: 'bettergithub:open-options', plugin: plugins.actions }).catch(() => notify(t('failed'))); });
    group.append(configure);
    group.addEventListener('keydown', event => {
      if (event.key === 'Tab') { finish(); return; }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(); return; }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const rows = [...group.querySelectorAll('button, a')], current = rows.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length-1 : (current+(event.key === 'ArrowUp' ? -1 : 1)+rows.length)%rows.length;
      event.preventDefault(); rows[next]?.focus();
    });
    actionMenu.showPopover({ source });
    const anchor = source?.getBoundingClientRect?.() || { left: innerWidth-300, bottom: 60 };
    const rect = actionMenu.getBoundingClientRect();
    actionMenu.style.left = `${Math.max(8, Math.min(anchor.left, innerWidth-rect.width-8))}px`;
    actionMenu.style.top = `${Math.max(8, Math.min(anchor.bottom+6, innerHeight-rect.height-8))}px`;
    group.querySelector('a, button')?.focus();
  }
  async function execute(command, newTab = false) {
    if (!command || !enabled(mode)) return;
    close();
    try {
      if (command.href) {
        const href = destination(command);
        if (href) {
          if (newTab) window.open(href, '_blank', 'noopener');
          else location.assign(href);
        }
      } else await command.run();
      await recordCommand(command);
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
    if (kind === 'actions' && typeof HTMLElement.prototype.showPopover === 'function') { openActionsMenu(); return; }
    if (document.querySelector('dialog[open]:not(#bgh-tools-dialog), [role="dialog"][aria-modal="true"]')) return;
    if (!dialog?.isConnected) {
      dialog = node('dialog'); dialog.id = 'bgh-tools-dialog'; dialog.setAttribute('aria-labelledby', 'bgh-tools-title');
      dialog.setAttribute('closedby', 'any');
      dialog.innerHTML = '<header><h2 id="bgh-tools-title"></h2><button type="button" id="bgh-tools-configure">⚙</button><button type="button" id="bgh-tools-close">×</button></header><input type="text" inputmode="search" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="bgh-tools-results"><div id="bgh-tools-results" role="listbox"></div><p id="bgh-tools-empty" hidden></p><div id="bgh-tools-repository-settings"><label><input type="checkbox"><span></span></label><button type="button"></button></div><footer><span id="bgh-tools-count" role="status" aria-live="polite"></span><span id="bgh-tools-keys"></span></footer>';
      document.body.append(dialog);
      dialog.querySelector('#bgh-tools-close').addEventListener('click', close);
      dialog.querySelector('#bgh-tools-configure').addEventListener('click', () => { void send({ type: 'bettergithub:open-options', plugin: plugins[mode] }).catch(() => notify(t('failed'))); close(); });
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
    dialog.querySelector('#bgh-tools-configure').setAttribute('aria-label', t('pluginSettings'));
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
    actionMenu?.remove(); actionMenu = null; dialog = launcherGroup = null; launchers.clear();
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
      button.title = `${names[kind]} · ${core.bindings(preferences)[kind] || ''}`; button.setAttribute('aria-label', names[kind]); button.setAttribute('aria-haspopup', kind === 'actions' ? 'menu' : 'dialog');
    }
    launcherGroup.classList.toggle('bgh-tools-floating', !target);
    if (launcherGroup.parentElement !== (target || document.body)) (target || document.body).append(launcherGroup);
    if (dialog?.open && !enabled(mode)) close();
    if (actionMenu?.matches(':popover-open') && !enabled('actions')) close();
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
  document.addEventListener('contextmenu', event => {
    if (!enabled('actions') || preferences.quickActionsContextMenu !== true || !event.altKey || event.target.closest?.('input,textarea,[contenteditable="true"]')) return;
    event.preventDefault(); openActionsMenu(event.target.closest('a,button') || launchers.get('actions'));
  });
  document.addEventListener('keydown', event => {
    if (!active() || event.defaultPrevented || event.isComposing || event.repeat) return;
    if (event.target.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    const bindings = core.bindings(preferences);
    for (const [id, binding] of Object.entries(bindings)) {
      if (!core.matchesShortcut(binding, event)) continue;
      if (Object.hasOwn(plugins, id) && enabled(id)) { event.preventDefault(); open(id); return; }
      if (enabled('commands')) {
        const command = core.collect(commandContext(), preferences).find(command => command.id === id);
        if (command) { event.preventDefault(); mode = 'commands'; void execute(command); return; }
      }
    }
  });
  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    let changed = false;
    for (const key of observedKeys()) {
      if (Object.hasOwn(changes, key)) { preferences[key] = changes[key].newValue; changed = true; }
    }
    if (!changed) return;
    if (!enabled('repositories')) { generation++; remembered = ''; }
    refresh();
    if (dialog?.open) { const query = dialog.querySelector('input[role="combobox"]').value; open(mode); dialog.querySelector('input[role="combobox"]').value = query; render(); }
  });
  api.storage.local.get(observedKeys(), data => {
    if (api.runtime.lastError) return;
    preferences = { ...data, ...preferences }; ready = true; refresh();
  });
  core.subscribe(() => {
    api.storage.local.get(observedKeys(), data => {
      if (api.runtime.lastError) return;
      preferences = { ...data, ...preferences };
      if (dialog?.open) render();
    });
  });
  document.addEventListener('turbo:before-cache', removeUI);
  document.addEventListener('turbo:load', schedule);
  addEventListener('popstate', schedule);
  addEventListener('resize', schedule);
  new MutationObserver(records => {
    if (active() && records.some(record => !record.target.closest?.('#bgh-tools-dialog, #bgh-action-menu, #bgh-tools-launchers, #bgh-tools-toast'))) schedule();
  }).observe(document, { childList: true, subtree: true });
})();
