(() => {
  'use strict';
  const DEFAULT_ORDER = ['about', 'releases', 'packages', 'contributors', 'languages'];
  const PROFILE_MAIN_ORDER = ['readme', 'pinned', 'contributions'];
  const PROFILE_SIDE_ORDER = ['info', 'achievements', 'highlights'];
  const PROFILE_TITLES = { readme: 'README', pinned: 'Pinned', contributions: 'Contributions', info: 'Профиль и контакты', achievements: 'Achievements', highlights: 'Highlights' };
  const TITLES = { about: 'About', releases: 'Releases', packages: 'Packages', contributors: 'Contributors', languages: 'Languages' };
  const RESERVED = new Set(['about', 'account', 'apps', 'blog', 'collections', 'contact', 'customer-stories', 'dashboard', 'enterprise', 'events', 'explore', 'features', 'issues', 'join', 'login', 'logout', 'marketplace', 'new', 'notifications', 'orgs', 'organizations', 'pricing', 'pulls', 'search', 'security', 'settings', 'signup', 'site', 'sponsors', 'team', 'topics', 'trending']);
  const PRESETS = {
    github: null,
    universe: { base: '#e9edec', surface: '#f3f6f5', text: '#050807', muted: '#4c5b58', border: '#d3dcd9', accent: '#008b2b' },
    'universe-dark': { base: '#090d0b', surface: '#111a15', text: '#f0f7f2', muted: '#a6baa9', border: '#2c4032', accent: '#00c943' },
    midnight: { base: '#0b1020', surface: '#141b30', text: '#e7ecfa', muted: '#a4b0ca', border: '#34415b', accent: '#79a9ff' },
    amethyst: { base: '#130e1d', surface: '#20172d', text: '#f4eaff', muted: '#bdaacb', border: '#49375e', accent: '#c68cff' },
    forest: { base: '#0c1714', surface: '#152720', text: '#e7f4ec', muted: '#acc5b5', border: '#345846', accent: '#7ad7a0' },
    light: { base: '#f6f8fc', surface: '#ffffff', text: '#182236', muted: '#5b6980', border: '#d5deec', accent: '#335fc7' }
  };
  const DEFAULT_SETTINGS = { mode: 'site', theme: 'github', global: {}, sites: {} };
  const ui = (ru, en) => settings.language === 'en' ? en : ru;
  const TAB_SYMBOLS = {
    code: '<>{}/', issues: '?!#@', 'pull-requests': '⇄↔⇆↕', agents: '✦◇◆◈',
    actions: '▶▸▷▹', projects: '▦▧▩□', wiki: '§¶⌘⌁',
    security: '⚑⚠⛨!', insights: '∿⌁↗↝', settings: '⚙⛭✧✦'
  };
  const TRAIL_COLORS = ['#ae85ff', '#f73678', '#c05200', '#583af7', '#5fed83', '#bba00a'];
  const TRAIL_SYMBOLS = ['-', '/', ')', '.', '+', '=', '>', '<', '*', '&', '('];
  const tabRestorers = new WeakMap();
  let trailRoot = null;
  let trailTiles = [];
  let trailIndex = 0;
  let trailEnabled = false;
  let trailBound = false;
  let lastTrailPoint = null;
  let originalColorMode = document.documentElement.getAttribute('data-color-mode');
  const api = chrome;
  let settings = DEFAULT_SETTINGS;
  let page = null;
  let remote = null;
  let assetBase = null;
  let runId = 0;
  let timer;
  let currentKey = '';
  let profileEdit = false;
  let profileDraft = null;
  let profileBeforeEdit = null;
  let profileEditController = null;
  let profileDragging = null;
  let repoDraft = null;
  let repoMainDraft = null;
  let repoSaveQueue = Promise.resolve();
  let repoEditController = null;
  let previewAppearance = null;
  let previewKey = '';
  let githubDraftRunning = false;
  let githubDraftSeen = false;
  let githubDraftInvalidating = false;

  const storageGet = () => new Promise(resolve => api.storage.local.get('settings', data => resolve(data?.settings || {})));
  const storageSet = value => new Promise((resolve, reject) => {
    try {
      api.storage.local.set({ settings: value }, () => {
        const failure = api.runtime.lastError;
        if (failure) reject(new Error(failure.message));
        else resolve();
      });
    } catch (error) { reject(error); }
  });
  const githubDraftGet = () => new Promise(resolve => api.storage.local.get('githubDraft', data => resolve(data?.githubDraft || null)));
  const githubDraftSet = value => new Promise((resolve, reject) => {
    api.storage.local.set({ githubDraft: value }, () => {
      const failure = api.runtime.lastError;
      if (failure) reject(new Error(failure.message));
      else resolve();
    });
  });
  const send = value => new Promise(resolve => api.runtime.sendMessage(value, response => resolve(response || {})));
  const hex = value => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : null;
  const safeName = value => typeof value === 'string' && /^[A-Za-z0-9_.-]{1,100}$/.test(value);
  const siteKey = item => item ? (item.kind === 'site' ? 'site:github' : `${item.kind}:${item.owner}/${item.repository || ''}`.toLowerCase()) : '';

  function safeUrl(value, context, download = false) {
    if (typeof value !== 'string' || value.length > 2048) return null;
    let candidate = value.trim();
    if (candidate.startsWith('./')) candidate = candidate.slice(2);
    if (!/^[a-z][a-z\d+.-]*:/i.test(candidate) && !candidate.startsWith('//')) {
      if (!context || !candidate || candidate.startsWith('/') || !/^[A-Za-z0-9_./-]+$/.test(candidate) || candidate.split('/').some(segment => !segment || segment === '.' || segment === '..')) return null;
      const repo = context.configRepo || context.repository;
      if (!safeName(context.owner) || !safeName(repo)) return null;
      try {
        const base = assetBase ? new URL(assetBase) : new URL(`https://raw.githubusercontent.com/${context.owner}/${repo}/HEAD/`);
        if (base.protocol !== 'https:' || base.hostname !== 'raw.githubusercontent.com' || base.username || base.password) return null;
        candidate = new URL(candidate.split('/').map(encodeURIComponent).join('/'), base).href;
      } catch { return null; }
    }
    try {
      const url = new URL(candidate);
      if (url.protocol !== 'https:' || url.username || url.password) return null;
      const host = url.hostname.toLowerCase();
      const allowed = host === 'github.com' || host === 'raw.githubusercontent.com' || host.endsWith('.githubusercontent.com');
      if (!allowed || (download && (host !== 'github.com' || !/^\/[^/]+\/[^/]+\/releases\/(?:download\/|latest\/download\/)/.test(url.pathname)))) return null;
      return url.href;
    } catch { return null; }
  }

  function identify() {
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments.length === 1 && safeName(segments[0]) && !RESERVED.has(segments[0].toLowerCase())) {
      const owner = segments[0];
      const organization = !document.querySelector('.vcard-names') && Boolean(document.querySelector('.orghead, [data-testid="organization-header"]'));
      return { kind: organization ? 'org' : 'profile', owner, repository: organization ? '.github' : owner, configRepo: organization ? '.github' : owner };
    }
    const nwo = document.querySelector('meta[name="octolytics-dimension-repository_nwo"]')?.content;
    if (segments.length >= 2 && nwo && /^[-\w.]+\/[-\w.]+$/.test(nwo)) {
      const [owner, repository] = nwo.split('/');
      return { kind: 'repo', owner, repository, configRepo: repository };
    }
    if (segments.length >= 2 && !RESERVED.has(segments[0].toLowerCase()) && document.querySelector('#repository-container-header')) {
      return { kind: 'repo', owner: segments[0], repository: segments[1], configRepo: segments[1] };
    }
    return { kind: 'site', owner: '', repository: '' };
  }

  function sanitizeOrder(value) {
    const given = Array.isArray(value) ? value : [];
    return [...new Set([...given.filter(name => DEFAULT_ORDER.includes(name)), ...DEFAULT_ORDER])];
  }

  function sanitizeProfileOrder(value, allowed) {
    const given = Array.isArray(value) ? value : [];
    return [...new Set([...given.filter(name => allowed.includes(name)), ...allowed])];
  }

  function profileSections() {
    const frame = document.querySelector('#user-profile-frame');
    const pinned = frame?.querySelector('.js-pinned-items-reorder-container')?.parentElement;
    let readme = frame?.querySelector('.profile-readme, [data-testid="profile-readme"]');
    const main = readme?.parentElement || pinned?.parentElement || frame?.querySelector(':scope > .position-relative');
    const children = [...(main?.children || [])];
    if (!readme && main) readme = children.find(node => node !== pinned && node.querySelector('.markdown-body') && node.querySelector('a[href*="README.md"]'));
    const contributions = children.find(node => node !== readme && node !== pinned && (node.matches('.tmp-mt-4.position-relative') || node.querySelector('.js-yearly-contributions, [data-testid="contributions"]')));
    const mainGroups = { readme: readme ? [readme] : [], pinned: pinned && pinned.parentElement === main ? [pinned] : [], contributions: contributions ? [contributions] : [] };
    const side = document.querySelector('main .Layout-sidebar .js-profile-editable-replace, .Layout-sidebar .js-profile-editable-replace') || document.querySelector('.vcard-names')?.closest('.js-profile-editable-replace');
    const sideChildren = [...(side?.children || [])];
    const heading = node => node.querySelector(':scope > h2, :scope > h3')?.textContent.trim().toLowerCase() || '';
    const achievements = sideChildren.filter(node => heading(node).startsWith('achievements'));
    const highlights = sideChildren.filter(node => heading(node).startsWith('highlights'));
    const info = sideChildren.filter(node => node.matches('.user-status-container') || node.querySelector('.vcard-names, .js-profile-editable-area'));
    const sideGroups = { info, achievements, highlights };
    return { main: { parent: main, groups: mainGroups }, side: { parent: side, groups: sideGroups } };
  }

  function currentProfileOrder(section, allowed) {
    if (!section.parent) return [];
    return allowed.filter(name => section.groups[name]?.length).sort((a, b) =>
      [...section.parent.children].indexOf(section.groups[a][0]) - [...section.parent.children].indexOf(section.groups[b][0]));
  }

  function placeProfileGroups(section, requested, allowed) {
    const parent = section.parent;
    if (!parent) return;
    const current = currentProfileOrder(section, allowed);
    const desired = sanitizeProfileOrder(requested, allowed).filter(name => section.groups[name]?.length);
    if (desired.length < 2 || current.join('|') === desired.join('|')) return;
    const known = desired.flatMap(name => section.groups[name]);
    if (known.some(node => node.parentElement !== parent)) return;
    const children = [...parent.children];
    const lastIndex = Math.max(...known.map(node => children.indexOf(node)));
    const anchor = children[lastIndex + 1] || null;
    for (const name of desired) for (const node of section.groups[name]) parent.insertBefore(node, anchor);
  }

  function applyProfileLayout(config) {
    if (page.kind !== 'profile' && page.kind !== 'org') return;
    const sections = profileSections();
    const mainOrder = profileEdit ? profileDraft?.main : config.layout?.profile;
    const sideOrder = profileEdit ? profileDraft?.side : config.layout?.profileSidebar;
    if (Array.isArray(mainOrder)) placeProfileGroups(sections.main, mainOrder, PROFILE_MAIN_ORDER);
    if (Array.isArray(sideOrder)) placeProfileGroups(sections.side, sideOrder, PROFILE_SIDE_ORDER);
  }

  function siteConfig() {
    const local = settings.sites?.[siteKey(page)] || {};
    return {
      ...remote,
      ...local,
      appearance: { ...(remote?.appearance || {}), ...(local.appearance || {}) },
      layout: { ...(remote?.layout || {}), ...(local.layout || {}) }
    };
  }

  function applyTheme(config) {
    const disabled = settings.themeDisabled === true;
    const preview = previewKey === siteKey(page) ? previewAppearance : null;
    const visual = disabled ? {} : preview || (settings.mode === 'global' ? settings.global || {} : config.appearance || {});
    const theme = disabled ? 'github' : preview?.theme || (settings.mode === 'global' ? settings.theme : (visual.theme || 'github'));
    const preset = disabled ? null : PRESETS[theme] ?? PRESETS.midnight;
    const root = document.documentElement;
    if (root.dataset.bgh !== 'themed') originalColorMode = root.getAttribute('data-color-mode');
    root.dataset.bgh = theme === 'github' ? 'github' : 'themed';
    root.dataset.bghTheme = theme;
    const githubMode = theme === 'github' ? originalColorMode : (theme === 'light' || theme === 'universe' ? 'light' : 'dark');
    if (githubMode) root.setAttribute('data-color-mode', githubMode);
    else root.removeAttribute('data-color-mode');
    const colors = preset ? { ...preset } : {};
    for (const key of ['base', 'surface', 'text', 'muted', 'border', 'accent']) {
      const picked = hex(visual[key]);
      if (picked) colors[key] = picked;
      if (colors[key]) root.style.setProperty(`--bgh-${key}`, colors[key]);
      else root.style.removeProperty(`--bgh-${key}`);
    }
    const background = safeUrl(visual.background, page);
    root.style.setProperty('--bgh-background-image', background ? `url("${background.replace(/["\\]/g, '')}")` : 'none');
    root.dataset.bghBackground = background ? 'yes' : 'no';
    root.dataset.bghEffect = ['none', 'gradient', 'glow'].includes(visual.effect) ? visual.effect : 'none';
    applyUniversePointerEffect(theme);
    applyUniverseTabEffects(theme);
  }

  function applyUniversePointerEffect(theme) {
    trailEnabled = theme === 'universe' || theme === 'universe-dark';
    if (!trailEnabled) {
      lastTrailPoint = null;
      trailRoot?.remove();
      trailRoot = null;
      trailTiles = [];
      return;
    }
    if (!trailRoot) {
      trailRoot = document.createElement('div');
      trailRoot.id = 'bgh-cursor-trail';
      trailRoot.setAttribute('aria-hidden', 'true');
      trailTiles = Array.from({ length: 40 }, () => {
        const tile = document.createElement('span');
        trailRoot.append(tile);
        return tile;
      });
      document.documentElement.append(trailRoot);
    }
    if (trailBound) return;
    trailBound = true;
    function clearTrail() {
      if (lastTrailPoint) for (const tile of trailTiles) {
        clearTimeout(tile.bghTimer);
        tile.style.opacity = '0';
        tile.style.transform = 'scale(0)';
      }
      lastTrailPoint = null;
    }
    function canDrawAt(x, y, size) {
      const target = document.elementFromPoint?.(x, y);
      if (!target || !target.matches('html, body, main, div, section')) return false;
      if (target.closest('header, nav, a, button, label, summary, form, dialog, input, textarea, select, table, [role="table"], [role="button"], article, .markdown-body, [contenteditable], [class*="Box__"], [class*="PageLayout-Pane-"], [class*="borderGrid__"], [data-testid="directory-content"], #bgh-dialog, #bgh-gear-menu')) return false;
      const directory = document.querySelector('[data-testid="directory-content"]');
      const fileArea = directory?.closest('div[class*="Box__"]') || directory;
      const blocked = [fileArea, ...document.querySelectorAll('header, nav, [class*="PageLayout-Pane-"], [class*="borderGrid__"]')];
      return blocked.every(element => {
        if (!element) return true;
        const rect = element.getBoundingClientRect();
        return !rect.width || !rect.height || x + size <= rect.left || x >= rect.right || y + size <= rect.top || y >= rect.bottom;
      });
    }
    document.addEventListener('pointermove', event => {
      if (!trailEnabled || event.pointerType === 'touch' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const size = Math.max(14, Math.min(18, innerWidth / (innerWidth >= 1200 ? 94 : 67)));
      const point = { x: Math.floor(event.clientX / size), y: Math.floor(event.clientY / size) };
      if (!canDrawAt(point.x * size, point.y * size, size)) { clearTrail(); return; }
      if (lastTrailPoint?.x === point.x && lastTrailPoint?.y === point.y) return;
      const previous = lastTrailPoint;
      lastTrailPoint = point;
      const steps = previous ? Math.min(6, Math.max(Math.abs(point.x - previous.x), Math.abs(point.y - previous.y))) : 1;
      for (let index = 1; index <= steps; index++) {
        const x = previous ? Math.round(previous.x + (point.x - previous.x) * index / steps) : point.x;
        const y = previous ? Math.round(previous.y + (point.y - previous.y) * index / steps) : point.y;
        if (!canDrawAt(x * size, y * size, size)) continue;
        const tile = trailTiles[trailIndex++ % trailTiles.length];
        clearTimeout(tile.bghTimer);
        tile.textContent = Math.random() < .3 ? ' ' : TRAIL_SYMBOLS[Math.floor(Math.random() * TRAIL_SYMBOLS.length)];
        tile.style.left = `${x * size}px`;
        tile.style.top = `${y * size}px`;
        tile.style.width = `${size}px`;
        tile.style.height = `${size}px`;
        tile.style.fontSize = `${size * .45}px`;
        tile.style.backgroundColor = TRAIL_COLORS[Math.floor(Math.random() * TRAIL_COLORS.length)];
        tile.style.opacity = '1';
        tile.style.transform = 'scale(1)';
        tile.bghTimer = setTimeout(() => {
          tile.style.opacity = '0';
          tile.style.transform = 'scale(0)';
        }, 100 + Math.random() * 300);
      }
    }, { capture: true, passive: true });
    document.addEventListener('pointerleave', clearTrail);
  }

  function applyUniverseTabEffects(theme) {
    const active = theme === 'universe' || theme === 'universe-dark';
    for (const link of document.querySelectorAll('nav a[data-tab-item]')) {
      link.closest('nav')?.classList.toggle('bgh-universe-tabs', active);
      if (!active) { tabRestorers.get(link)?.(); continue; }
      if (link.dataset.bghTabEffect) continue;
      let timer = null;
      let activeLabel = null;
      function restore() {
        clearInterval(timer);
        timer = null;
        activeLabel?.classList.remove('bgh-tab-scrambling');
        activeLabel?.removeAttribute('data-bgh-scramble');
        activeLabel = null;
      }
      function scramble() {
        if (!['universe', 'universe-dark'].includes(document.documentElement.dataset.bghTheme) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        restore();
        const label = link.querySelector('[data-component="text"]');
        if (!label || label.children.length) return;
        const original = label.textContent.trim();
        if (!original) return;
        const tab = (link.getAttribute('data-tab-item') || original).toLowerCase();
        const group = Object.keys(TAB_SYMBOLS).find(key => tab.includes(key) || original.toLowerCase().includes(key.replace('-', ' '))) || 'code';
        const symbols = [...TAB_SYMBOLS[group]];
        activeLabel = label;
        label.classList.add('bgh-tab-scrambling');
        let frame = 0;
        function draw() {
          const settled = Math.floor(frame / 1.5);
          label.dataset.bghScramble = [...original].map((character, index) =>
            character === ' ' || index < settled ? character : symbols[Math.floor(Math.random() * symbols.length)]
          ).join('');
          if (settled >= original.length) restore();
          frame++;
        }
        draw();
        timer = setInterval(draw, 32);
      }
      link.dataset.bghTabEffect = 'yes';
      link.addEventListener('pointerenter', scramble);
      link.addEventListener('pointerleave', restore);
      link.addEventListener('click', restore, true);
      tabRestorers.set(link, restore);
    }
  }

  function headingRow(name) {
    for (const heading of document.querySelectorAll('[class*="borderGrid__"] h2, .BorderGrid h2, aside h2')) {
      const row = heading.closest('[class*="sidebarSection__"], .BorderGrid-row');
      if (heading.textContent?.trim().toLowerCase().startsWith(name) && row) return row;
    }
    return null;
  }

  function reorderSidebar(config) {
    const rows = new Map(DEFAULT_ORDER.map(name => [name, headingRow(name)]));
    const parent = rows.get('about')?.parentElement;
    if (!parent) return;
    const configured = !!repoDraft || Array.isArray(config.layout?.sidebar);
    const order = repoDraft || sanitizeOrder(config.layout?.sidebar);
    parent.classList.toggle('bgh-reordered', configured);
    order.forEach((name, index) => {
      const row = rows.get(name);
      if (row?.parentElement === parent) row.style.order = configured ? String(index) : '';
    });
  }

  const repoMainOrder = value => value?.[0] === 'readme' ? ['readme', 'code'] : ['code', 'readme'];
  function repoMainSections() {
    const code = document.querySelector('[data-testid="directory-content"]');
    const readme = document.querySelector('main article.markdown-body');
    if (!code || !readme) return {};
    let parent = code.parentElement;
    while (parent && !parent.contains(readme)) parent = parent.parentElement;
    if (!parent || parent === document.body || parent.children.length !== 2) return {};
    const branch = node => { while (node.parentElement !== parent) node = node.parentElement; return node; };
    const groups = { code: branch(code), readme: branch(readme) };
    return groups.code === groups.readme ? {} : { parent, ...groups };
  }
  function repoSections() {
    const main = repoMainSections();
    return [
      ...DEFAULT_ORDER.map(name => ({ name, column: 'repo', row: headingRow(name), title: TITLES[name] })),
      ...['code', 'readme'].map(name => ({ name, column: 'repo-main', row: main[name], title: name === 'code' ? ui('Файлы', 'Files') : 'README' }))
    ].filter(section => section.row);
  }
  function reorderRepoMain(config) {
    const main = repoMainSections();
    if (!main.parent) return;
    const configured = !!repoMainDraft || Array.isArray(config.layout?.repository);
    main.parent.classList.toggle('bgh-main-reordered', configured);
    (repoMainDraft || repoMainOrder(config.layout?.repository)).forEach((name, index) => { main[name].style.order = configured ? String(index) : ''; });
  }

  function addVisuals(config) {
    const about = headingRow('about');
    if (about) {
      let banner = document.getElementById('bgh-banner');
      const url = safeUrl(config.banner, page);
      if (url) {
        if (!banner) {
          banner = document.createElement('a');
          banner.id = 'bgh-banner';
          banner.target = '_blank';
          banner.rel = 'noopener noreferrer';
          const image = document.createElement('img');
          image.alt = `${page.owner} banner`;
          banner.append(image);
        }
        if (banner.href !== url) banner.href = url;
        if (banner.firstElementChild.src !== url) banner.firstElementChild.src = url;
        banner.style.order = about.style.order;
        if (banner.nextSibling !== about) about.parentElement.insertBefore(banner, about);
      } else banner?.remove();
      if (page.kind !== 'repo') addGear(about);
    }
    if (page.kind === 'repo') addGear();
    if (!about && page.kind !== 'repo') {
      const profile = document.querySelector('.vcard-names, .orghead h1, [data-testid="profile-header"]');
      const parent = profile?.parentElement;
      const url = safeUrl(config.banner, page);
      let banner = document.getElementById('bgh-profile-banner');
      if (url && parent) {
        if (!banner) {
          banner = document.createElement('a');
          banner.id = 'bgh-profile-banner';
          banner.target = '_blank'; banner.rel = 'noopener noreferrer';
          const image = document.createElement('img');
          image.alt = `${page.owner} banner`;
          banner.append(image);
        }
        if (banner.href !== url) banner.href = url;
        if (banner.firstElementChild.src !== url) banner.firstElementChild.src = url;
        if (banner.nextSibling !== profile) parent.insertBefore(banner, profile);
      } else banner?.remove();
      if (profile && !document.getElementById('bgh-gear')) {
        const button = document.createElement('button');
        button.type = 'button'; button.id = 'bgh-gear';
        button.dataset.bghPlacement = 'profile';
        button.title = ui('Открыть редактор BetterGitHub', 'Open BetterGitHub editor');
        button.setAttribute('aria-label', button.title);
        button.textContent = '✦ BetterGitHub';
        profile.append(button);
      }
    }
    let icon = document.getElementById('bgh-repo-icon');
    const iconUrl = safeUrl(config.icon, page);
    const title = document.querySelector('[data-testid="repo-name-wrapper"] strong, #repository-container-header strong, .vcard-names, .orghead h1');
    if (iconUrl && title) {
      if (!icon) { icon = document.createElement('img'); icon.id = 'bgh-repo-icon'; icon.alt = ''; title.prepend(icon); }
      if (icon.src !== iconUrl) icon.src = iconUrl;
    } else icon?.remove();
  }

  function addGear(about) {
    const heading = about?.querySelector('h2, h3');
    const repoName = page.kind === 'repo' ? document.querySelector('[data-testid="repo-name-wrapper"]') : null;
    const repoHeader = page.kind === 'repo' ? document.querySelector('#repository-container-header') : null;
    const main = page.kind === 'repo' ? document.querySelector('main, #repo-content-pjax-container') : null;
    if (!heading && !repoName && !repoHeader && !main) return;
    let button = document.getElementById('bgh-gear');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.id = 'bgh-gear';
      button.dataset.bghPlacement = 'repo';
      button.title = ui('Открыть редактор BetterGitHub', 'Open BetterGitHub editor');
      button.setAttribute('aria-label', button.title);
      button.textContent = '✦ BetterGitHub';
    }
    if (repoName && !repoName.closest('a, button')) {
      if (button.previousElementSibling !== repoName) repoName.after(button);
    } else if (repoHeader) {
      if (button.parentElement !== repoHeader) repoHeader.prepend(button);
    } else if (main) {
      if (button.parentElement !== main) main.prepend(button);
    } else if (button.parentElement !== heading) heading.append(button);
  }

  function replaceCodeButton(config) {
    const existing = document.getElementById('bgh-install');
    const old = document.querySelector('[data-bgh-original-code]');
    if (page.kind !== 'repo') { existing?.remove(); old?.removeAttribute('data-bgh-original-code'); return; }
    const url = safeUrl(config.installUrl, page, true);
    if (!url) { existing?.remove(); old?.removeAttribute('data-bgh-original-code'); return; }
    if (existing?.href === url && old?.isConnected) return;
    existing?.remove(); old?.removeAttribute('data-bgh-original-code');
    const candidates = Array.from(document.querySelectorAll('button, summary')).filter(element => element.textContent?.trim() === 'Code');
    const code = candidates.find(element => element.closest('#repo-content-pjax-container, main'));
    if (!code) return;
    const wrapper = code.closest('details, .btn-group') || code;
    wrapper.dataset.bghOriginalCode = 'yes';
    const link = document.createElement('a');
    link.id = 'bgh-install';
    link.className = 'btn btn-primary';
    link.href = url;
    link.textContent = ui('↓ Установить', '↓ Install');
    link.title = ui('Скачать файл установки', 'Download installer');
    wrapper.after(link);
  }

  function apply() {
    if (!page) return;
    const config = siteConfig();
    applyTheme(config);
    if (page.kind === 'site') return;
    if (page.kind === 'repo') { reorderSidebar(config); reorderRepoMain(config); }
    else applyProfileLayout(config);
    addVisuals(config);
    replaceCodeButton(config);
    if (page.kind === 'repo' && repoSections().some(({ name, column, row }) => !row.querySelector(`.bgh-layout-handle[data-bgh-column="${column}"][data-bgh-drag-handle="${name}"]`))) renderRepoHandles();
    const gear = document.getElementById('bgh-gear');
    if (gear) { gear.title = ui('Открыть редактор BetterGitHub', 'Open BetterGitHub editor'); gear.setAttribute('aria-label', gear.title); }
    const install = document.getElementById('bgh-install');
    if (install) { install.textContent = ui('↓ Установить', '↓ Install'); install.title = ui('Скачать файл установки', 'Download installer'); }
  }

  function stopRepoEditor() {
    repoEditController?.abort();
    repoEditController = null;
    document.querySelectorAll('.bgh-layout-handle[data-bgh-column^="repo"]').forEach(handle => {
      handle.closest('.bgh-layout-target')?.classList.remove('bgh-layout-target', 'bgh-layout-drop-target');
      handle.parentElement.classList.remove('bgh-layout-heading', 'bgh-main-layout-target');
      handle.remove();
    });
    repoDraft = null;
    repoMainDraft = null;
    if (page?.kind === 'repo') { reorderSidebar(siteConfig()); reorderRepoMain(siteConfig()); }
  }

  function layoutStatus(text) {
    let status = document.getElementById('bgh-layout-status');
    if (!status) { status = document.createElement('p'); status.id = 'bgh-layout-status'; status.setAttribute('role', 'status'); document.body.append(status); }
    status.textContent = text;
    clearTimeout(status.bghTimer);
    status.bghTimer = setTimeout(() => status.remove(), 4000);
  }

  function renderRepoHandles() {
    repoEditController?.abort();
    repoEditController = new AbortController();
    const signal = repoEditController.signal;
    document.querySelectorAll('.bgh-layout-handle[data-bgh-column^="repo"]').forEach(node => node.remove());
    let dragged = null;
    const orderFor = column => column === 'repo' ? (repoDraft || sanitizeOrder(siteConfig().layout?.sidebar)) : (repoMainDraft || repoMainOrder(siteConfig().layout?.repository));
    const move = (column, from, to) => {
      const order = [...orderFor(column)];
      const fromIndex = order.indexOf(from), toIndex = order.indexOf(to);
      if (fromIndex < 0 || toIndex < 0 || from === to) return;
      order.splice(fromIndex, 1);
      order.splice(toIndex, 0, from);
      if (document.querySelector('#bgh-dialog[open]')) {
        if (column === 'repo') repoDraft = order;
        else repoMainDraft = order;
        apply();
      } else {
        const key = siteKey(page);
        repoSaveQueue = repoSaveQueue.then(async () => {
          const previous = settings.sites?.[key] || {};
          const next = { ...settings, sites: { ...(settings.sites || {}), [key]: { ...previous, layout: { ...(previous.layout || {}), [column === 'repo' ? 'sidebar' : 'repository']: order } } } };
          await storageSet(next);
          settings = next;
          if (siteKey(page) === key) apply();
          layoutStatus(ui('Расположение сохранено локально', 'Layout saved locally'));
        }).catch(error => layoutStatus(ui('Не удалось сохранить: ', 'Could not save: ') + error.message));
      }
    };
    for (const { name, column, row, title } of repoSections()) {
      row.classList.add('bgh-layout-target');
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'bgh-layout-handle';
      handle.dataset.bghDragHandle = name;
      handle.dataset.bghColumn = column;
      handle.draggable = true;
      handle.innerHTML = '<svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true"><circle cx="3" cy="3" r="1.3"/><circle cx="7" cy="3" r="1.3"/><circle cx="3" cy="8" r="1.3"/><circle cx="7" cy="8" r="1.3"/><circle cx="3" cy="13" r="1.3"/><circle cx="7" cy="13" r="1.3"/></svg>';
      handle.title = ui('Переместить ', 'Move ') + title;
      handle.setAttribute('aria-label', handle.title + ui('; стрелки вверх и вниз меняют порядок', '; use the up and down arrow keys to reorder'));
      let pointerDrag = null;
      let dragFrame = null;
      const clearPointerDrag = () => {
        pointerDrag = null;
        cancelAnimationFrame(dragFrame);
        dragFrame = null;
        handle.classList.remove('bgh-layout-dragging');
        document.querySelectorAll('.bgh-layout-drop-target').forEach(node => node.classList.remove('bgh-layout-drop-target'));
      };
      handle.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        event.preventDefault();
        handle.focus({ preventScroll: true });
        handle.setPointerCapture(event.pointerId);
        pointerDrag = { x: event.clientX, y: event.clientY, target: null };
      }, { signal });
      handle.addEventListener('pointermove', event => {
        if (!pointerDrag || Math.hypot(event.clientX - pointerDrag.x, event.clientY - pointerDrag.y) < 4) return;
        handle.classList.add('bgh-layout-dragging');
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.bgh-layout-target');
        const targetHandle = target?.querySelector('[data-bgh-column="' + column + '"]');
        document.querySelectorAll('.bgh-layout-drop-target').forEach(node => node.classList.remove('bgh-layout-drop-target'));
        pointerDrag.target = targetHandle?.dataset.bghDragHandle || null;
        if (pointerDrag.target && pointerDrag.target !== name) target.classList.add('bgh-layout-drop-target');
        pointerDrag.clientX = event.clientX;
        pointerDrag.clientY = event.clientY;
        if (!dragFrame) {
          const scroll = () => {
            if (!pointerDrag) return;
            const y = pointerDrag.clientY;
            const amount = y < 60 ? -18 : y > innerHeight - 60 ? 18 : 0;
            if (amount) {
              window.scrollBy(0, amount);
              const row = document.elementFromPoint(pointerDrag.clientX, y)?.closest('.bgh-layout-target');
              pointerDrag.target = row?.querySelector('[data-bgh-column="' + column + '"]')?.dataset.bghDragHandle || null;
              document.querySelectorAll('.bgh-layout-drop-target').forEach(node => node.classList.remove('bgh-layout-drop-target'));
              if (pointerDrag.target && pointerDrag.target !== name) row.classList.add('bgh-layout-drop-target');
            }
            dragFrame = requestAnimationFrame(scroll);
          };
          dragFrame = requestAnimationFrame(scroll);
        }
      }, { signal });
      handle.addEventListener('pointerup', event => {
        if (!pointerDrag) return;
        const to = pointerDrag.target;
        clearPointerDrag();
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
        if (to) move(column, name, to);
      }, { signal });
      handle.addEventListener('pointercancel', clearPointerDrag, { signal });
      signal.addEventListener('abort', clearPointerDrag, { once: true });
      handle.addEventListener('dragstart', event => {
        dragged = { name, column };
        event.dataTransfer?.setData('text/plain', name);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      }, { signal });
      handle.addEventListener('dragend', () => {
        dragged = null;
        document.querySelectorAll('.bgh-layout-drop-target').forEach(node => node.classList.remove('bgh-layout-drop-target'));
      }, { signal });
      handle.addEventListener('keydown', event => {
        if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const visible = orderFor(column).filter(id => repoSections().some(section => section.name === id && section.column === column));
        const to = visible[visible.indexOf(name) + (event.key === 'ArrowUp' ? -1 : 1)];
        if (to) move(column, name, to);
      }, { signal });
      row.addEventListener('dragover', event => {
        if (!dragged || dragged.column !== column || dragged.name === name) return;
        event.preventDefault();
        row.classList.add('bgh-layout-drop-target');
      }, { signal });
      row.addEventListener('dragleave', () => row.classList.remove('bgh-layout-drop-target'), { signal });
      row.addEventListener('drop', event => {
        if (!dragged || dragged.column !== column) return;
        event.preventDefault();
        row.classList.remove('bgh-layout-drop-target');
        move(column, dragged.name, name);
        dragged = null;
      }, { signal });
      const heading = column === 'repo' ? row.querySelector('h2, h3') : row;
      heading.classList.add(column === 'repo' ? 'bgh-layout-heading' : 'bgh-main-layout-target');
      heading.append(handle);
    }
  }

  function renderProfileHandles() {
    document.querySelectorAll('.bgh-layout-handle').forEach(node => node.remove());
    document.querySelectorAll('.bgh-layout-target').forEach(node => node.classList.remove('bgh-layout-target', 'bgh-layout-drop-target'));
    profileEditController?.abort();
    profileEditController = new AbortController();
    const signal = profileEditController.signal;
    const sections = profileSections();
    for (const [column, allowed] of [['main', PROFILE_MAIN_ORDER], ['side', PROFILE_SIDE_ORDER]]) {
      const section = sections[column];
      for (const name of allowed) {
        const elements = section.groups[name];
        if (!elements?.length || elements.some(node => node.parentElement !== section.parent)) continue;
        const target = column === 'side' && name === 'info'
          ? elements.at(-1)
          : elements.find(node => getComputedStyle(node).display !== 'none') || elements[0];
        if (getComputedStyle(target).display === 'none') continue;
        target.classList.add('bgh-layout-target');
        const handle = document.createElement('button');
        handle.type = 'button';
        handle.className = 'bgh-layout-handle';
        handle.dataset.bghDragHandle = name;
        handle.dataset.bghColumn = column;
        handle.draggable = true;
        handle.innerHTML = '<svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true"><circle cx="3" cy="3" r="1.3"/><circle cx="7" cy="3" r="1.3"/><circle cx="3" cy="8" r="1.3"/><circle cx="7" cy="8" r="1.3"/><circle cx="3" cy="13" r="1.3"/><circle cx="7" cy="13" r="1.3"/></svg>';
        handle.title = `${ui('Переместить', 'Move')} ${name === 'info' ? ui('Профиль и контакты', 'Profile and contacts') : PROFILE_TITLES[name]}`;
        handle.setAttribute('aria-label', `${handle.title}; ${ui('стрелки вверх и вниз меняют порядок', 'use the up and down arrow keys to reorder')}`);
        target.append(handle);
        function move(from, to) {
          const order = currentProfileOrder(profileSections()[column], allowed);
          if (!order.includes(from) || !order.includes(to) || from === to) return;
          const targetIndex = order.indexOf(to);
          order.splice(order.indexOf(from), 1);
          order.splice(targetIndex, 0, from);
          profileDraft[column] = sanitizeProfileOrder(order, allowed);
          applyProfileLayout(siteConfig());
        }
        handle.addEventListener('dragstart', event => {
          profileDragging = { column, name };
          event.dataTransfer?.setData('text/plain', name);
          if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
        }, { signal });
        handle.addEventListener('dragend', () => {
          profileDragging = null;
          document.querySelectorAll('.bgh-layout-drop-target').forEach(node => node.classList.remove('bgh-layout-drop-target'));
        }, { signal });
        handle.addEventListener('keydown', event => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
          event.preventDefault();
          const order = currentProfileOrder(profileSections()[column], allowed);
          const index = order.indexOf(name) + (event.key === 'ArrowUp' ? -1 : 1);
          if (index >= 0 && index < order.length) move(name, order[index]);
        }, { signal });
        target.addEventListener('dragover', event => {
          if (profileDragging?.column !== column || profileDragging.name === name) return;
          event.preventDefault();
          target.classList.add('bgh-layout-drop-target');
        }, { signal });
        target.addEventListener('dragleave', () => target.classList.remove('bgh-layout-drop-target'), { signal });
        target.addEventListener('drop', event => {
          event.preventDefault();
          target.classList.remove('bgh-layout-drop-target');
          if (profileDragging?.column === column) move(profileDragging.name, name);
          profileDragging = null;
        }, { signal });
      }
    }
  }

  function profileHandlesStale() {
    if (!profileEdit) return false;
    const sections = profileSections();
    for (const [column, allowed] of [['main', PROFILE_MAIN_ORDER], ['side', PROFILE_SIDE_ORDER]]) {
      for (const name of allowed) {
        const nodes = sections[column].groups[name];
        if (nodes?.length && !nodes.some(node => node.querySelector(`:scope > .bgh-layout-handle[data-bgh-drag-handle="${name}"]`))) return true;
      }
    }
    return false;
  }

  function stopProfileEditor(saved = false) {
    if (!profileEdit) return;
    profileEditController?.abort();
    profileEditController = null;
    document.querySelectorAll('.bgh-layout-handle').forEach(node => node.remove());
    document.querySelectorAll('.bgh-layout-target, .bgh-layout-drop-target').forEach(node => node.classList.remove('bgh-layout-target', 'bgh-layout-drop-target'));
    document.getElementById('bgh-layout-toolbar')?.remove();
    document.getElementById('bgh-dialog')?.classList.remove('bgh-layout-editing');
    profileEdit = false;
    if (!saved && profileBeforeEdit) {
      const sections = profileSections();
      placeProfileGroups(sections.main, profileBeforeEdit.main, PROFILE_MAIN_ORDER);
      placeProfileGroups(sections.side, profileBeforeEdit.side, PROFILE_SIDE_ORDER);
    }
    profileDraft = null;
    profileBeforeEdit = null;
    profileDragging = null;
  }

  function startProfileEditor() {
    if (profileEdit) return;
    const sections = profileSections();
    profileBeforeEdit = {
      main: currentProfileOrder(sections.main, PROFILE_MAIN_ORDER),
      side: currentProfileOrder(sections.side, PROFILE_SIDE_ORDER)
    };
    profileDraft = {
      main: sanitizeProfileOrder(profileBeforeEdit.main, PROFILE_MAIN_ORDER),
      side: sanitizeProfileOrder(profileBeforeEdit.side, PROFILE_SIDE_ORDER)
    };
    profileEdit = true;
    const dialog = document.getElementById('bgh-dialog');
    dialog.classList.add('bgh-layout-editing');
    const toolbar = document.createElement('section');
    toolbar.id = 'bgh-layout-toolbar';
    toolbar.innerHTML = '<strong>Расположение профиля</strong><span>Перетаскивайте ⠿ или используйте стрелки на ручке.</span><div><button type="button" id="bgh-layout-save">Сохранить локально</button><button type="button" id="bgh-layout-github">Открыть в GitHub</button><button type="button" id="bgh-layout-export">Скачать JSON</button><button type="button" id="bgh-layout-cancel">Отмена</button></div>';
    dialog.querySelector('#bgh-mode-hint').after(toolbar);
    translateEditor(dialog);
    toolbar.querySelector('#bgh-layout-save').addEventListener('click', () => document.getElementById('bgh-form').requestSubmit());
    toolbar.querySelector('#bgh-layout-github').addEventListener('click', () => stageGitHubSave(document.getElementById('bgh-form')));
    toolbar.querySelector('#bgh-layout-export').addEventListener('click', () => exportEditorConfig(document.getElementById('bgh-form')));
    toolbar.querySelector('#bgh-layout-cancel').addEventListener('click', () => stopProfileEditor(false));
    renderProfileHandles();
  }

  function readEditorConfig(form) {
    const data = new FormData(form);
    const values = Object.fromEntries(['background', 'banner', 'icon', 'installUrl'].map(name => [name, String(data.get(name) || '').trim()]));
    for (const name of ['background', 'banner', 'icon']) {
      if (values[name] && !safeUrl(values[name], page)) { alert(`${ui('Недопустимый адрес', 'Invalid URL')}: ${name}`); return null; }
    }
    if (values.installUrl && !safeUrl(values.installUrl, page, true)) { alert(ui('Ссылка установки должна вести на github.com по HTTPS', 'The install link must be an HTTPS GitHub release URL')); return null; }
    const current = siteConfig();
    const theme = String(data.get('theme'));
    const effect = String(data.get('effect'));
    const appearance = {
      theme: Object.hasOwn(PRESETS, theme) ? theme : 'midnight',
      accent: hex(String(data.get('accent'))) || '#79a9ff',
      background: values.background,
      effect: ['none', 'gradient', 'glow'].includes(effect) ? effect : 'none'
    };
    for (const name of ['base', 'surface', 'text', 'muted', 'border']) {
      const color = hex(String(data.get(name)));
      if (color) appearance[name] = color;
    }
    const layout = page.kind === 'repo'
      ? { sidebar: [...(repoDraft || sanitizeOrder(current.layout?.sidebar))], ...((repoMainSections().parent || current.layout?.repository) ? { repository: [...(repoMainDraft || repoMainOrder(current.layout?.repository))] } : {}) }
      : { profile: profileDraft?.main || current.layout?.profile || PROFILE_MAIN_ORDER, profileSidebar: profileDraft?.side || current.layout?.profileSidebar || PROFILE_SIDE_ORDER };
    return {
      banner: values.banner, icon: values.icon, installUrl: values.installUrl,
      appearance,
      layout
    };
  }

  function publishedConfig(config) {
    const exported = {
      appearance: { ...config.appearance },
      layout: config.layout
    };
    if (!exported.appearance.background) delete exported.appearance.background;
    for (const name of ['banner', 'icon', 'installUrl']) if (config[name]) exported[name] = config[name];
    return exported;
  }

  function exportEditorConfig(form) {
    const config = readEditorConfig(form);
    if (!config) return;
    const exported = publishedConfig(config);
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(exported, null, 2)}\n`], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = '.bettergithub.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function stageGitHubSave(form) {
    const config = readEditorConfig(form);
    if (!config) return;
    const owner = page.owner;
    const repository = page.configRepo || page.repository;
    if (!safeName(owner) || !safeName(repository)) return;
    const hint = document.getElementById('bgh-mode-hint');
    const tab = window.open('about:blank', '_blank');
    hint.textContent = page.kind === 'profile'
      ? ui(`Профиль ${owner}: ищу файл оформления в ${owner}/${repository}…`, `Profile ${owner}: finding its appearance file in ${owner}/${repository}…`)
      : ui('Ищу файл и основную ветку репозитория…', 'Finding the file and default branch…');
    try {
      const target = await send({ type: 'bettergithub:editor-target', owner, repository });
      if (target.error || typeof target.branch !== 'string' || !['.bettergithub.json', 'bettergithub.json'].includes(target.filename)) {
        throw new Error(target.error || 'Invalid GitHub response');
      }
      const previous = target.config && typeof target.config === 'object' && !Array.isArray(target.config) ? target.config : {};
      const published = publishedConfig(config);
      const output = page.kind === 'profile' ? { ...previous, profile: published }
        : page.kind === 'org' ? { ...previous, organization: published }
        : previous.profile || previous.organization
          ? { ...previous, ...published, layout: { ...(previous.layout || {}), ...published.layout } }
          : published;
      const draft = {
        owner, repository, branch: target.branch, filename: target.filename,
        exists: Boolean(target.exists), prepared: true, createdAt: Date.now(),
        kind: page.kind, json: `${JSON.stringify(output, null, 2)}\n`
      };
      await githubDraftSet(draft);
      const base = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
      const branch = encodeURIComponent(target.branch);
      const url = target.exists
        ? `${base}/edit/${branch}/${target.filename}`
        : `${base}/new/${branch}?filename=${encodeURIComponent(target.filename)}`;
      if (tab && !tab.closed) tab.location.href = url;
      else window.location.href = url;
      hint.textContent = page.kind === 'profile'
        ? ui(`Открыт файл оформления профиля ${owner}/${repository}/${target.filename}. Проверьте его и подтвердите коммит на GitHub.`, `Opened the profile appearance file ${owner}/${repository}/${target.filename}. Review it and commit on GitHub.`)
        : ui(`Открыт редактор ${target.filename}. Проверьте файл и подтвердите коммит на GitHub.`, `Opened the ${target.filename} editor. Review the file and commit on GitHub.`);
    } catch (error) {
      tab?.close();
      hint.textContent = `${ui('Не удалось открыть редактор GitHub', 'Could not open the GitHub editor')}: ${error.message}`;
    }
  }

  function fillEditorColors(form, theme, visual = {}) {
    const defaults = PRESETS[theme] || { base: '#0d1117', surface: '#161b22', text: '#f0f6fc', muted: '#8b949e', border: '#30363d', accent: '#79a9ff' };
    for (const name of ['accent', 'base', 'surface', 'text', 'muted', 'border']) {
      form.elements[name].value = hex(visual[name]) || defaults[name];
    }
    form.querySelector('.bgh-colors').disabled = theme === 'github';
  }

  function previewEditor(form) {
    if (!page) return;
    const data = new FormData(form);
    const appearance = {
      theme: Object.hasOwn(PRESETS, data.get('theme')) ? String(data.get('theme')) : 'github',
      background: String(data.get('background') || '').trim(),
      effect: String(data.get('effect') || 'none')
    };
    for (const name of ['accent', 'base', 'surface', 'text', 'muted', 'border']) {
      const color = hex(String(data.get(name)));
      if (color) appearance[name] = color;
    }
    previewAppearance = appearance;
    previewKey = siteKey(page);
    applyTheme(siteConfig());
  }

  function clearEditorPreview() {
    if (!previewAppearance) return;
    previewAppearance = null;
    previewKey = '';
    apply();
  }

  function translateEditor(dialog) {
    const form = dialog.querySelector('#bgh-form');
    if (!form) return;
    const text = (selector, ru, en) => { const node = dialog.querySelector(selector); if (node) node.textContent = ui(ru, en); };
    const label = (name, ru, en) => {
      const node = form.elements[name]?.closest('label');
      const first = [...(node?.childNodes || [])].find(child => child.nodeType === Node.TEXT_NODE);
      if (first) first.textContent = ui(ru, en);
    };
    dialog.dataset.bghLanguage = settings.language === 'en' ? 'en' : 'ru';
    text('#bgh-form header h2', page.kind === 'profile' ? 'Оформление профиля' : 'Оформление страницы', page.kind === 'profile' ? 'Profile appearance' : 'Page appearance');
    dialog.querySelector('#bgh-close')?.setAttribute('aria-label', ui('Закрыть', 'Close'));
    for (const [name, ru, en] of [
      ['theme', 'Тема', 'Theme'], ['accent', 'Акцент', 'Accent'],
      ['base', 'Фон страницы', 'Page background'], ['surface', 'Поверхности', 'Surfaces'],
      ['text', 'Текст', 'Text'], ['muted', 'Вторичный текст', 'Secondary text'],
      ['border', 'Границы', 'Borders'],
      ['background', 'Фон (HTTPS GitHub или путь в репозитории)', 'Background (GitHub HTTPS URL or repository path)'],
      ['effect', 'Эффект фона', 'Background effect'], ['banner', 'Баннер над About', 'Banner above About'],
      ['icon', 'Значок рядом с названием', 'Icon next to the name'],
      ['installUrl', 'Прямая ссылка установки', 'Direct install URL']
    ]) label(name, ru, en);
    text('.bgh-colors legend', 'Цвета темы', 'Theme colors');
    for (const [value, ru, en] of [
      ['universe', 'GitHub Universe — светлая', 'GitHub Universe — light'],
      ['universe-dark', 'GitHub Universe — тёмная', 'GitHub Universe — dark'],
      ['midnight', 'Полночь', 'Midnight'], ['amethyst', 'Аметист', 'Amethyst'],
      ['forest', 'Лес', 'Forest'], ['light', 'Светлая', 'Light']
    ]) text(`[name="theme"] option[value="${value}"]`, ru, en);
    for (const [value, ru, en] of [
      ['none', 'Нет', 'None'], ['gradient', 'Мягкий градиент', 'Soft gradient'], ['glow', 'Свечение', 'Glow']
    ]) text(`[name="effect"] option[value="${value}"]`, ru, en);
    text('#bgh-layout-hint', 'Перемещайте блоки на странице за ручки из шести точек. Изменения сохранятся после нажатия «Сохранить локально».', 'Drag sections on the page using the six-dot handles. Changes are saved when you click “Save locally”.');
    text('#bgh-edit-layout', 'Переместить блоки профиля', 'Move profile sections');
    text('#bgh-reset', 'Сбросить локальные настройки', 'Reset local settings');
    text('#bgh-export', 'Скачать JSON', 'Download JSON');
    text('#bgh-github-save', page.kind === 'profile' ? 'Файл профиля в GitHub' : 'Открыть в GitHub', page.kind === 'profile' ? 'Profile file on GitHub' : 'Open in GitHub');
    text('#bgh-form button[type="submit"]', 'Сохранить локально', 'Save locally');
    text('#bgh-form > p.bgh-hint:last-child',
      'Настройки здесь видны только вам. Для всех посетителей добавьте .bettergithub.json в репозиторий.',
      'These settings are visible only to you. Add .bettergithub.json to the repository to share them.');
    const toolbar = dialog.querySelector('#bgh-layout-toolbar');
    if (toolbar) {
      text('#bgh-layout-toolbar strong', 'Расположение профиля', 'Profile layout');
      text('#bgh-layout-toolbar span', 'Перетаскивайте ⠿ или используйте стрелки на ручке.', 'Drag ⠿ or use the arrow keys on a handle.');
      text('#bgh-layout-save', 'Сохранить локально', 'Save locally');
      text('#bgh-layout-github', page.kind === 'profile' ? 'Файл профиля в GitHub' : 'Открыть в GitHub', page.kind === 'profile' ? 'Profile file on GitHub' : 'Open in GitHub');
      text('#bgh-layout-export', 'Скачать JSON', 'Download JSON');
      text('#bgh-layout-cancel', 'Отмена', 'Cancel');
    }
  }

  function openPanel() {
    if (!page) return;
    let dialog = document.getElementById('bgh-dialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'bgh-dialog';
      dialog.innerHTML = `<form method="dialog" id="bgh-form"><header><h2>Оформление страницы</h2><button type="button" id="bgh-close" aria-label="Закрыть">×</button></header><p id="bgh-target"></p><p id="bgh-mode-hint" class="bgh-hint"></p><label>Тема<select name="theme"><option value="github">GitHub</option><option value="universe">GitHub Universe — светлая</option><option value="universe-dark">GitHub Universe — тёмная</option><option value="midnight">Полночь</option><option value="amethyst">Аметист</option><option value="forest">Лес</option><option value="light">Светлая</option></select></label><fieldset class="bgh-colors"><legend>Цвета темы</legend><label>Акцент<input name="accent" type="color"></label><label>Фон страницы<input name="base" type="color"></label><label>Поверхности<input name="surface" type="color"></label><label>Текст<input name="text" type="color"></label><label>Вторичный текст<input name="muted" type="color"></label><label>Границы<input name="border" type="color"></label></fieldset><label>Фон (HTTPS GitHub или путь в репозитории)<input name="background" type="text" placeholder="assets/background.png"></label><label>Эффект фона<select name="effect"><option value="none">Нет</option><option value="gradient">Мягкий градиент</option><option value="glow">Свечение</option></select></label><label>Баннер над About<input name="banner" type="text" placeholder="assets/banner.png"></label><label>Значок рядом с названием<input name="icon" type="text" placeholder="assets/icon.png"></label><label>Прямая ссылка установки<input name="installUrl" type="url" placeholder="https://github.com/…/releases/download/…"></label><p id="bgh-layout-hint" class="bgh-hint"></p><footer><button type="button" id="bgh-reset">Сбросить локальные настройки</button><button type="button" id="bgh-export">Скачать JSON</button><button type="button" id="bgh-github-save">Открыть в GitHub</button><button type="submit">Сохранить локально</button></footer><p class="bgh-hint">Настройки здесь видны только вам. Для всех посетителей добавьте .bettergithub.json в репозиторий.</p></form>`;
      document.body.append(dialog);
      const editLayout = document.createElement('button');
      editLayout.type = 'button';
      editLayout.id = 'bgh-edit-layout';
      editLayout.textContent = 'Переместить блоки профиля';
      dialog.querySelector('#bgh-mode-hint').after(editLayout);
      editLayout.addEventListener('click', startProfileEditor);
      dialog.querySelector('[name="theme"]').addEventListener('change', event => {
        const form = dialog.querySelector('form');
        fillEditorColors(form, event.target.value);
        previewEditor(form);
      });
      dialog.querySelector('form').addEventListener('input', event => {
        if (event.target.matches('.bgh-colors input, [name="background"]')) previewEditor(event.currentTarget);
      });
      dialog.querySelector('[name="effect"]').addEventListener('change', () => previewEditor(dialog.querySelector('form')));
      dialog.querySelector('#bgh-close').addEventListener('click', () => {
        stopRepoEditor();
        if (profileEdit) stopProfileEditor(false);
        clearEditorPreview();
        dialog.close();
        apply();
      });
      dialog.addEventListener('close', () => {
        stopRepoEditor();
        if (profileEdit) stopProfileEditor(false);
        clearEditorPreview();
        apply();
      });
      dialog.querySelector('#bgh-reset').addEventListener('click', async () => {
        const nextSettings = { ...settings, sites: { ...(settings.sites || {}) } };
        delete nextSettings.sites[siteKey(page)];
        try { await storageSet(nextSettings); }
        catch (error) { dialog.querySelector('#bgh-mode-hint').textContent = `${ui('Не удалось сохранить', 'Could not save')}: ${error.message}`; return; }
        settings = nextSettings;
        stopRepoEditor();
        clearEditorPreview(); dialog.close(); apply();
      });
      dialog.querySelector('#bgh-export').addEventListener('click', () => exportEditorConfig(dialog.querySelector('form')));
      dialog.querySelector('#bgh-github-save').addEventListener('click', () => stageGitHubSave(dialog.querySelector('form')));
      dialog.querySelector('form').addEventListener('submit', async event => {
        event.preventDefault();
        const config = readEditorConfig(event.currentTarget);
        if (!config) return;
        const nextSettings = { ...settings, sites: { ...(settings.sites || {}) } };
        if (nextSettings.mode === 'global') {
          nextSettings.theme = config.appearance.theme;
          nextSettings.global = { ...(nextSettings.global || {}), ...config.appearance };
          nextSettings.sites[siteKey(page)] = {
            ...(nextSettings.sites[siteKey(page)] || {}),
            banner: config.banner, icon: config.icon, installUrl: config.installUrl, layout: config.layout
          };
        } else {
          nextSettings.sites[siteKey(page)] = config;
        }
        try { await storageSet(nextSettings); }
        catch (error) { dialog.querySelector('#bgh-mode-hint').textContent = `${ui('Не удалось сохранить', 'Could not save')}: ${error.message}`; return; }
        settings = nextSettings;
        stopRepoEditor();
        previewAppearance = null;
        previewKey = '';
        if (profileEdit) stopProfileEditor(true);
        dialog.close();
        apply();
      });
    }
    const config = siteConfig();
    const visual = settings.mode === 'global' ? settings.global || {} : config.appearance || {};
    const form = dialog.querySelector('form');
    translateEditor(dialog);
    dialog.querySelector('#bgh-target').textContent = page.kind === 'repo' ? `${page.owner}/${page.repository}` : page.kind === 'profile' ? ui(`Профиль ${page.owner}`, `Profile ${page.owner}`) : page.owner;
    dialog.querySelector('#bgh-mode-hint').textContent = settings.mode === 'global'
      ? ui('Цвета и тема сохранятся для всего GitHub; баннер, ссылка и порядок блоков — для этой страницы.', 'Theme and colors apply across GitHub; banner, link, and layout apply to this page.')
      : ui('Тема и расположение сохранятся для этой страницы.', 'Theme and layout apply to this page.');
    form.elements.theme.value = settings.mode === 'global' ? settings.theme : visual.theme || settings.theme;
    fillEditorColors(form, form.elements.theme.value, visual);
    form.elements.background.value = visual.background || '';
    form.elements.effect.value = visual.effect || 'none';
    form.elements.banner.value = config.banner || '';
    form.elements.icon.value = config.icon || '';
    form.elements.installUrl.value = config.installUrl || '';
    dialog.querySelector('#bgh-layout-hint').hidden = page.kind !== 'repo';
    dialog.querySelector('#bgh-edit-layout').hidden = page.kind !== 'profile';
    globalThis.BGHColorPicker?.attach(dialog);
    if (!dialog.open) dialog.show();
    if (page.kind === 'repo' && !repoDraft) { repoDraft = sanitizeOrder(config.layout?.sidebar); repoMainDraft = repoMainOrder(config.layout?.repository); reorderSidebar(config); }
    if (page.kind === 'profile' && !profileEdit) startProfileEditor();
  }

  function matchesGitHubDraft(draft) {
    if (!draft || Date.now() - draft.createdAt > 20 * 60_000 || typeof draft.json !== 'string') return false;
    let path;
    try { path = decodeURIComponent(location.pathname); } catch { return false; }
    const prefix = `/${draft.owner}/${draft.repository}/${draft.exists ? 'edit' : 'new'}/${draft.branch}`;
    return path.toLowerCase() === `${prefix}${draft.exists ? `/${draft.filename}` : ''}`.toLowerCase();
  }

  function showGitHubDraft(draft) {
    let tray = document.getElementById('bgh-github-draft');
    if (tray) return tray;
    tray = document.createElement('aside');
    tray.id = 'bgh-github-draft';
    const title = document.createElement('strong');
    title.textContent = draft.kind === 'profile'
      ? ui(`BetterGitHub · профиль ${draft.owner} · ${draft.filename}`, `BetterGitHub · profile ${draft.owner} · ${draft.filename}`)
      : `BetterGitHub · ${draft.filename}`;
    const status = document.createElement('p');
    status.id = 'bgh-github-draft-status';
    status.textContent = ui('Подготавливаю файл в редакторе GitHub…', 'Preparing the file in GitHub’s editor…');
    const textarea = document.createElement('textarea');
    textarea.value = draft.json;
    textarea.readOnly = true;
    textarea.setAttribute('aria-label', 'BetterGitHub JSON');
    const actions = document.createElement('div');
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = ui('Скопировать JSON', 'Copy JSON');
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(draft.json); }
      catch { textarea.select(); document.execCommand('copy'); }
      status.textContent = ui('JSON скопирован. Вставьте его в редактор и подтвердите коммит на GitHub.', 'JSON copied. Paste it into the editor and commit on GitHub.');
    });
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', ui('Закрыть', 'Close'));
    close.addEventListener('click', () => tray.remove());
    actions.append(copy, close);
    tray.append(title, status, textarea, actions);
    document.body.append(tray);
    return tray;
  }

  async function fillGitHubEditor(json) {
    const editor = document.querySelector('.cm-editor .cm-content[contenteditable="true"], textarea[name="value"], textarea[name="content"]');
    if (!editor) return null;
    if (editor instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter.call(editor, json);
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 120));
      return editor.value === json;
    }
    editor.focus();
    const selection = getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection.removeAllRanges();
    selection.addRange(range);
    if (!document.execCommand('insertText', false, json)) return false;
    await new Promise(resolve => setTimeout(resolve, 120));
    const lines = [...editor.querySelectorAll(':scope > .cm-line')].map(line => line.textContent).join('\n');
    return lines.replace(/\r/g, '') === json.trimEnd();
  }

  async function maybeFillGitHubDraft() {
    if (githubDraftRunning || githubDraftSeen) return;
    if (!/^\/[^/]+\/[^/]+\/(?:edit|new)\//.test(location.pathname)) return;
    githubDraftRunning = true;
    try {
      const draft = await githubDraftGet();
      if (!matchesGitHubDraft(draft)) return;
      githubDraftSeen = true;
      while (!document.body) await new Promise(resolve => setTimeout(resolve, 100));
      const tray = showGitHubDraft(draft);
      const status = tray.querySelector('#bgh-github-draft-status');
      if (draft.attempted) {
        status.textContent = ui('Автовставка уже выполнялась. Проверьте файл перед коммитом; расширение больше его не изменит.', 'Automatic insertion already ran. Review the file before committing; the extension will not change it again.');
        return;
      }
      await githubDraftSet({ ...draft, attempted: true });
      for (let attempt = 0; attempt < 40; attempt++) {
        const filled = await fillGitHubEditor(draft.json);
        if (filled === true) {
          await githubDraftSet({ ...draft, attempted: true, handled: true });
          status.textContent = ui('JSON вставлен один раз. Проверьте файл и нажмите «Commit changes» на GitHub.', 'JSON inserted once. Review the file and click “Commit changes” on GitHub.');
          return;
        }
        if (filled === false) break;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      status.textContent = ui('Автовставка не сработала. Скопируйте JSON и вставьте его вручную.', 'Automatic insertion failed. Copy the JSON and paste it manually.');
    } finally { githubDraftRunning = false; }
  }

  async function maybeRefreshPublishedDraft() {
    if (githubDraftInvalidating) return;
    let path;
    try { path = decodeURIComponent(location.pathname); } catch { return; }
    if (!/^\/[^/]+\/[^/]+\/(?:blob|commit)\//.test(path)) return;
    githubDraftInvalidating = true;
    try {
      const draft = await githubDraftGet();
      if (!(draft?.prepared || draft?.attempted) || draft.invalidated) return;
      const root = `/${draft.owner}/${draft.repository}`.toLowerCase();
      const file = `${root}/blob/${draft.branch}/${draft.filename}`.toLowerCase();
      const commit = `${root}/commit/`;
      if (path.toLowerCase() !== file && !path.toLowerCase().startsWith(commit)) return;
      const response = await send({ type: 'bettergithub:invalidate', owner: draft.owner, repository: draft.repository });
      if (!response.ok) return;
      await new Promise((resolve, reject) => api.storage.local.set({
        githubDraft: { ...draft, invalidated: true }, publishedRevision: Date.now()
      }, () => api.runtime.lastError ? reject(new Error(api.runtime.lastError.message)) : resolve()));
    } finally { githubDraftInvalidating = false; }
  }

  async function start() {
    maybeFillGitHubDraft().catch(error => console.warn('BetterGitHub GitHub editor:', error));
    maybeRefreshPublishedDraft().catch(error => console.warn('BetterGitHub GitHub refresh:', error));
    const next = identify();
    const key = siteKey(next);
    if (key === currentKey && page) {
      apply();
      if (profileHandlesStale()) renderProfileHandles();
      return;
    }
    if (profileEdit) stopProfileEditor(false);
    stopRepoEditor();
    clearEditorPreview();
    const openDialog = document.getElementById('bgh-dialog');
    if (openDialog?.open) openDialog.close();
    currentKey = key;
    page = next;
    remote = null; assetBase = null;
    if (!page) return;
    const id = ++runId;
    settings = { ...DEFAULT_SETTINGS, ...await storageGet() };
    apply();
    if (page.kind === 'site') return;
    const response = await send({ type: 'bettergithub:load', ...page });
    if (id !== runId || siteKey(identify()) !== key) return;
    remote = response.config;
    assetBase = response.assetBase;
    apply();
  }

  function schedule() { clearTimeout(timer); timer = setTimeout(start, 180); }
  api.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.publishedRevision && page && page.kind !== 'site') {
      const expected = siteKey(page);
      const id = ++runId;
      send({ type: 'bettergithub:load', ...page }).then(response => {
        if (id !== runId || siteKey(identify()) !== expected) return;
        remote = response.config;
        assetBase = response.assetBase;
        apply();
      });
    }
    if (area === 'local' && changes.settings) {
    settings = { ...DEFAULT_SETTINGS, ...(changes.settings.newValue || {}) };
    apply();
    const dialog = document.getElementById('bgh-dialog');
    if (dialog) translateEditor(dialog);
    if (profileEdit) renderProfileHandles();
    }
  });
  addEventListener('popstate', schedule);
  document.addEventListener('click', event => {
    if (!event.target.closest?.('#bgh-gear')) return;
    event.preventDefault();
    event.stopPropagation();
    openPanel();
  }, true);
  addEventListener('turbo:load', schedule);
  new MutationObserver(records => {
    if (records.some(record => !record.target.closest?.('#bgh-cursor-trail, #bgh-dialog, #bgh-gear-menu'))) schedule();
  }).observe(document.documentElement, { childList: true, subtree: true });
  start();
})();
