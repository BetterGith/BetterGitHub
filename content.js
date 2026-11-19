(() => {
  'use strict';
  const DEFAULT_ORDER = ['about', 'releases', 'packages', 'contributors', 'languages'];
  const PROFILE_MAIN_ORDER = ['readme', 'pinned', 'contributions'];
  const PROFILE_SIDE_ORDER = ['info', 'achievements', 'highlights'];
  const PROFILE_TITLES = { readme: 'README', pinned: 'Pinned', contributions: 'Contributions', achievements: 'Achievements', highlights: 'Highlights' };
  const TITLES = { about: 'About', releases: 'Releases', packages: 'Packages', contributors: 'Contributors', languages: 'Languages' };
  const RESERVED = new Set(['about', 'account', 'apps', 'blog', 'collections', 'contact', 'customer-stories', 'dashboard', 'enterprise', 'events', 'explore', 'features', 'issues', 'join', 'login', 'logout', 'marketplace', 'new', 'notifications', 'orgs', 'organizations', 'pricing', 'pulls', 'search', 'security', 'settings', 'signup', 'site', 'sponsors', 'team', 'topics', 'trending']);
  const PRESETS = {
    'rounded-light': { base: '#f3f3f6', surface: '#ffffff', text: '#202127', muted: '#626570', border: '#dcdde5', accent: '#19724e' },
    github: null,
    compact: null,
    'compact-light': null,
    rounded: { base: '#101012', surface: '#1b1b20', text: '#f2f2f5', muted: '#aaaab8', border: '#34343e', accent: '#91e2bd' },
    universe: { base: '#e9edec', surface: '#f3f6f5', text: '#050807', muted: '#4c5b58', border: '#d3dcd9', accent: '#008b2b' },
    'universe-dark': { base: '#090d0b', surface: '#111a15', text: '#f0f7f2', muted: '#a6baa9', border: '#2c4032', accent: '#00c943' },
    midnight: { base: '#0b1020', surface: '#141b30', text: '#e7ecfa', muted: '#a4b0ca', border: '#34415b', accent: '#79a9ff' },
    amethyst: { base: '#130e1d', surface: '#20172d', text: '#f4eaff', muted: '#bdaacb', border: '#49375e', accent: '#c68cff' },
    forest: { base: '#0c1714', surface: '#152720', text: '#e7f4ec', muted: '#acc5b5', border: '#345846', accent: '#7ad7a0' },
    light: { base: '#f6f8fc', surface: '#ffffff', text: '#182236', muted: '#5b6980', border: '#d5deec', accent: '#335fc7' }
  };
  const BACKGROUND_DEFAULTS = { backgroundDim: 56, backgroundPosition: 'center', effectStrength: 40 };
  const BACKGROUND_POSITIONS = ['center', 'top', 'bottom'];
  const BACKGROUND_EFFECTS = ['none', 'gradient', 'glow'];

  function backgroundOptions(appearance) {
    const percentage = (value, fallback) => Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : fallback;
    return {
      backgroundDim: percentage(appearance.backgroundDim, BACKGROUND_DEFAULTS.backgroundDim),
      backgroundPosition: BACKGROUND_POSITIONS.includes(appearance.backgroundPosition) ? appearance.backgroundPosition : BACKGROUND_DEFAULTS.backgroundPosition,
      effectStrength: percentage(appearance.effectStrength, BACKGROUND_DEFAULTS.effectStrength)
    };
  }

  function backgroundFormOptions(form) {
    return backgroundOptions({
      backgroundDim: form.elements.backgroundDim.valueAsNumber,
      backgroundPosition: form.elements.backgroundPosition.value,
      effectStrength: form.elements.effectStrength.valueAsNumber
    });
  }

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
  async function loadContentFont(family, filename) {
    try {
      // Chromium resolves relative URLs in injected CSS against the GitHub page.
      const response = await fetch(api.runtime.getURL(`fonts/${filename}`));
      if (!response.ok) return;
      const font = new FontFace(family, await response.arrayBuffer(), { weight: '200 900', display: 'swap' });
      document.fonts.add(await font.load());
    } catch (error) {
      console.warn(`BetterGitHub could not load ${family}:`, error);
    }
  }
  if (typeof FontFace === 'function' && api.runtime?.getURL) {
    loadContentFont('Better Mona Sans', 'MonaSansVF-opsz-wght.woff2');
    loadContentFont('Better Mona Sans Mono', 'MonaSansMonoVF-wght.woff2');
  }
  let settings = DEFAULT_SETTINGS;
  let pluginDimLightThemes;
  let pluginRepositoryThemes;
  let compactUI = null;
  let compactSectionUI = null;
  const compactProfileNodes = new Set();
  let preferencesReady = false;
  let preferencesLoading = null;
  const profileRestorePoints = new Map();
  let page = null;
  let remote = null;
  let assetBase = null;
  let runId = 0;
  let timer = null;
  let currentKey = '';
  let profileEdit = false;
  let profileDraft = null;
  let profileBeforeEdit = null;
  let profileEditController = null;
  let profileDragging = null;
  let repoDraft = null;
  let repoMainDraft = null;
  let repoEditController = null;
  let editorPreview = null;
  let previewKey = '';
  let githubDraftRunning = false;
  let githubDraftSeen = false;
  let githubEditorDraft = null;
  let githubDraftInvalidating = false;
  let githubOrganizationDraftSeen = '';

  const loadPreferences = () => new Promise(resolve => api.storage.local.get(
    ['settings', 'pluginDimLightThemes', 'pluginRepositoryThemes'], resolve));
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
  const editorDraftGet = async () => (await send({ type: 'bettergithub:editor-draft' })).draft;
  const editorDraftUpdate = (draft, flags) => send({ type: 'bettergithub:update-editor-draft', createdAt: draft.createdAt, ...flags });
  const hex = value => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : null;
  const safeName = value => typeof value === 'string' && /^[A-Za-z0-9_.-]{1,100}$/.test(value);
  const siteKey = item => item ? (item.kind === 'site' ? 'site:github' : `${item.kind}:${item.owner}/${item.repository || ''}`.toLowerCase()) : '';

  function safeUrl(value, context, download = false) {
    if (typeof value !== 'string' || value.length > 2048) return null;
    let candidate = value.trim();
    const explicitRelative = candidate.startsWith('./');
    if (explicitRelative) candidate = candidate.slice(2);
    if (!/^[a-z][a-z\d+.-]*:/i.test(candidate) && !candidate.startsWith('//')) {
      if (!context || !candidate || candidate.startsWith('/') || !/^[\p{L}\p{M}\p{N}_./ -]+$/u.test(candidate) || candidate.split('/').some(segment => !segment || segment === '.' || segment === '..')) return null;
      const repo = context.configRepo || context.repository;
      if (!safeName(context.owner) || !safeName(repo)) return null;
      try {
        const base = assetBase ? new URL(assetBase) : new URL(`https://raw.githubusercontent.com/${context.owner}/${repo}/HEAD/`);
        if (base.protocol !== 'https:' || base.hostname !== 'raw.githubusercontent.com' || base.username || base.password) return null;
        const segments = candidate.split('/');
        // Profile files live in OWNER/OWNER, so accept OWNER/image.png as shorthand.
        if (!download && !explicitRelative && context.kind === 'profile' &&
            segments.length > 1 && segments[0].toLowerCase() === context.owner.toLowerCase()) segments.shift();
        const encoded = segments.map(encodeURIComponent).join('/');
        candidate = !download && /^blob\/[^/]+\/.+/.test(encoded)
          ? `https://raw.githubusercontent.com/${context.owner}/${repo}/${encoded.slice(5)}`
          : new URL(encoded, base).href;
      } catch { return null; }
    }
    try {
      const url = new URL(candidate);
      if (url.protocol !== 'https:' || url.username || url.password) return null;
      const host = url.hostname.toLowerCase();
      const allowed = host === 'github.com' || host === 'raw.githubusercontent.com' || host.endsWith('.githubusercontent.com');
      if (!allowed || (download && (host !== 'github.com' || !/^\/[^/]+\/[^/]+\/releases\/(?:download\/|latest\/download\/)/.test(url.pathname)))) return null;
      if (!download && url.origin === 'https://github.com') {
        const file = url.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/(.+\/.+)$/);
        if (file && safeName(file[1]) && safeName(file[2])) {
          return `https://raw.githubusercontent.com/${file[1]}/${file[2]}/${file[3]}`;
        }
      }
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

  function profileSidebar() {
    return document.querySelector('.Layout-sidebar .js-profile-editable-replace') ||
      document.querySelector('.vcard-names')?.closest('.js-profile-editable-replace');
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
    const side = profileSidebar();
    const about = side?.querySelector('.js-profile-editable-area');
    const wrapper = about?.parentElement;
    // GitHub nests About beside the native profile actions in a shared wrapper.
    // Move only About, keeping the identity and action controls in place.
    if (wrapper && wrapper.parentElement === side && wrapper.children.length > 1 &&
        !about.querySelector('.vcard-names, .avatar-user')) {
      rememberProfilePosition(about);
      wrapper.after(about);
    }
    const sideChildren = [...(side?.children || [])];
    const heading = node => node.querySelector(':scope > h2, :scope > h3')?.textContent.trim().toLowerCase() || '';
    const achievements = sideChildren.filter(node => heading(node).startsWith('achievements'));
    const highlights = sideChildren.filter(node => heading(node).startsWith('highlights'));
    const info = sideChildren.filter(node => (node === about || about?.parentElement === node) &&
      !node.querySelector('.vcard-names, .avatar-user, .js-profile-editable-edit-button, .user-following-container'));
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
    for (const node of known) rememberProfilePosition(node);
    for (const name of desired) for (const node of section.groups[name]) parent.insertBefore(node, anchor);
  }

  function rememberProfilePosition(node) {
    if (profileRestorePoints.has(node)) return;
    const anchor = document.createComment('BetterGitHub original profile position');
    node.before(anchor);
    profileRestorePoints.set(node, anchor);
  }

  function restoreProfileLayout() {
    for (const [node, anchor] of profileRestorePoints) {
      if (anchor.isConnected && node.isConnected) anchor.replaceWith(node);
      else anchor.remove();
    }
    profileRestorePoints.clear();
  }

  function applyProfileLayout(config) {
    if (page.kind !== 'profile' && page.kind !== 'org') return;
    const mainOrder = profileEdit ? profileDraft?.main : config.layout?.profile;
    const sideOrder = profileEdit ? profileDraft?.side : config.layout?.profileSidebar;
    if (!Array.isArray(mainOrder) && !Array.isArray(sideOrder)) return;
    const sections = profileSections();
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

  function softenLightBackgrounds(colors) {
    if ((pluginDimLightThemes ?? settings.dimLightThemes) !== true || !hex(colors.base)) return colors;
    const channels = colors.base.slice(1).match(/../g).map(channel => parseInt(channel, 16) / 255);
    const linear = channels.map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
    const luminance = linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
    if (luminance < .5) return colors;
    const softened = { ...colors };
    for (const key of ['base', 'surface']) {
      if (!hex(colors[key])) continue;
      softened[key] = '#' + colors[key].slice(1).match(/../g).map(channel =>
        Math.round(parseInt(channel, 16) * .84 + 24 * .16).toString(16).padStart(2, '0')).join('');
    }
    return softened;
  }

  function applyTheme(config) {
    const disabled = settings.themeDisabled === true;
    const preview = previewKey === siteKey(page) ? editorPreview?.appearance : null;
    const visual = disabled ? {} : preview || (settings.mode === 'global' ? settings.global || {} : config.appearance || {});
    const theme = disabled ? 'github' : preview?.theme || (settings.mode === 'global' ? settings.theme : (visual.theme || 'github'));
    const preset = disabled ? null : Object.hasOwn(PRESETS, theme) ? PRESETS[theme] : PRESETS.midnight;
    const root = document.documentElement;
    if (root.dataset.bgh !== 'themed' && !['compact', 'compact-light'].includes(root.dataset.bghTheme)) originalColorMode = root.getAttribute('data-color-mode');
    const nativeTheme = theme === 'github' || theme === 'compact' || theme === 'compact-light';
    root.dataset.bgh = nativeTheme ? 'github' : 'themed';
    root.dataset.bghTheme = theme;
    const githubMode = nativeTheme ? (theme === 'compact-light' ? 'light' : theme === 'compact' ? 'dark' : originalColorMode) : (theme === 'light' || theme === 'universe' || theme === 'rounded-light' ? 'light' : 'dark');
    if (githubMode) root.setAttribute('data-color-mode', githubMode);
    else root.removeAttribute('data-color-mode');
    let colors = preset ? { ...preset } : {};
    for (const key of ['base', 'surface', 'text', 'muted', 'border', 'accent']) {
      const picked = hex(visual[key]);
      if (picked) colors[key] = picked;
    }
    colors = softenLightBackgrounds(colors);
    for (const key of ['base', 'surface', 'text', 'muted', 'border', 'accent']) {
      if (colors[key]) root.style.setProperty(`--bgh-${key}`, colors[key]);
      else root.style.removeProperty(`--bgh-${key}`);
    }
    const background = safeUrl(visual.background, page);
    root.style.setProperty('--bgh-background-image', background ? `url("${background.replace(/["\\]/g, '')}")` : 'none');
    root.dataset.bghBackground = background ? 'yes' : 'no';
    root.dataset.bghEffect = BACKGROUND_EFFECTS.includes(visual.effect) ? visual.effect : 'none';
    const { backgroundDim, backgroundPosition, effectStrength } = backgroundOptions(visual);
    root.style.setProperty('--bgh-background-dim', `${backgroundDim}%`);
    root.style.setProperty('--bgh-background-position', backgroundPosition);
    root.style.setProperty('--bgh-effect-strength', `${effectStrength}%`);
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
    let fallback = null;
    for (const heading of document.querySelectorAll('[class*="borderGrid__"] h2, .BorderGrid h2, aside h2')) {
      const row = heading.closest('[class*="sidebarSection__"], .BorderGrid-row, [class*="borderGridRow__"]') || heading.closest('.BorderGrid-cell');
      if (heading.textContent?.trim().toLowerCase().startsWith(name) && row) {
        fallback ||= row;
        if (row.getClientRects().length && getComputedStyle(row).visibility !== 'hidden') return row;
      }
    }
    return fallback;
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
    const readme = document.querySelector('main .markdown-body');
    if (!code || !readme) return {};
    let parent = code.parentElement;
    while (parent && !parent.contains(readme)) parent = parent.parentElement;
    if (!parent || parent === document.body ||
        [...parent.children].filter(node => !node.matches('[data-bgh-compact-part="branch-info"]')).length !== 2) return {};
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
      if (page.kind === 'org') addGear(about);
    }
    if (page.kind === 'repo') addGear();
    if (page.kind === 'profile') addProfileGear();
    if (!about && page.kind !== 'repo') {
      const profile = document.querySelector('.vcard-names, .orghead h1, [data-testid="organization-header"] h1, [data-testid="profile-header"]');
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
      if (page.kind === 'org' && profile && !document.getElementById('bgh-gear')) {
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
    const title = document.querySelector('[data-testid="repo-name-wrapper"] strong, #repository-container-header strong, .vcard-names, .orghead h1, [data-testid="organization-header"] h1');
    if (iconUrl && title) {
      if (!icon) { icon = document.createElement('img'); icon.id = 'bgh-repo-icon'; icon.alt = ''; title.prepend(icon); }
      if (icon.src !== iconUrl) icon.src = iconUrl;
    } else icon?.remove();
  }

  function addProfileGear() {
    const side = profileSidebar();
    if (!side) return;
    const edit = side.querySelector('.js-profile-editable-edit-button, [data-testid="edit-profile-button"], a[href="/settings/profile"]');
    const action = edit || side.querySelector('.user-following-container');
    const identity = [...side.children].find(node => node.matches('.vcard-names') || node.querySelector('.vcard-names'));
    const anchor = action || identity;
    if (!anchor) return;
    let button = document.getElementById('bgh-gear');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.id = 'bgh-gear';
    }
    button.classList.add('btn', 'btn-block');
    if (button.textContent !== 'BetterGitHub') button.textContent = 'BetterGitHub';
    button.dataset.bghPlacement = 'profile-action';
    if (button.previousElementSibling !== anchor) anchor.after(button);
  }

  function repositorySettingsButton() {
    return document.querySelector('[aria-label="Edit repository details"], [aria-label="Edit repository details and topics"], [title="Edit repository details"]');
  }

  function addRepositoryAppearanceAction() {
    const existing = document.getElementById('bgh-gear');
    const nativeGear = repositorySettingsButton();
    if (pluginRepositoryThemes === false || isGitHubFileEditor() || !nativeGear) { existing?.remove(); return; }
    const target = document.getElementById(nativeGear.getAttribute('aria-controls') || nativeGear.getAttribute('data-dialog-id'));
    const dialogs = [...document.querySelectorAll('dialog, [role="dialog"], details-dialog')];
    const nativeDialog = target || nativeGear.closest('details')?.querySelector('details-dialog') || dialogs.find(dialog =>
      dialog.id !== 'bgh-dialog' &&
      (/edit repository details/i.test(dialog.querySelector('h1, h2, h3, [slot="title"]')?.textContent || '') ||
       dialog.querySelector('input[name="repo_description"], input#repo_description')));
    const form = nativeDialog?.querySelector('form') || nativeDialog;
    if (!form) { existing?.remove(); return; }
    let button = existing;
    if (button && button.dataset.bghPlacement !== 'repo-settings') { button.remove(); button = null; }
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.id = 'bgh-gear';
      button.dataset.bghPlacement = 'repo-settings';
      const save = form.querySelector('button[type="submit"]');
      button.className = save?.className || 'btn';
      button.classList.remove('btn-primary', 'Button--primary');
      for (const attribute of ['data-component', 'data-size']) {
        if (save?.hasAttribute(attribute)) button.setAttribute(attribute, save.getAttribute(attribute));
      }
      button.setAttribute('data-variant', 'default');
    }
    const label = ui('Оформление BetterGitHub', 'BetterGitHub appearance');
    if (button.textContent !== label) button.textContent = label;
    if (button.parentElement !== form) form.append(button);
  }

  function addGear(about) {
    if (page.kind === 'repo') { addRepositoryAppearanceAction(); return; }
    if (page.kind === 'repo' && isGitHubFileEditor()) {
      document.getElementById('bgh-gear')?.remove();
      return;
    }
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
    if (button.dataset.bghPlacement === 'profile-action') {
      button.classList.remove('btn', 'btn-block');
      button.textContent = '✦ BetterGitHub';
    }
    button.dataset.bghPlacement = 'repo';
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

  function restoreCompactUI() {
    if (!compactUI) return;
    const { header, anchor, marked, moved } = compactUI;
    for (const { node, anchor: original } of moved.reverse()) {
      if (original.isConnected) {
        if (node.isConnected) original.replaceWith(node);
        else original.remove();
      }
    }
    if (anchor.isConnected) {
      if (header.isConnected) anchor.replaceWith(header);
      else anchor.remove();
    } else if (header.isConnected) header.remove();
    for (const node of marked) {
      node.removeAttribute('data-bgh-compact-part');
      node.removeAttribute('data-bgh-compact-docked');
      node.removeAttribute('data-bgh-compact-offscreen');
      node.style.removeProperty('--bgh-compact-x');
      node.style.removeProperty('--bgh-compact-y');
      node.style.removeProperty('--bgh-compact-nav-space');
    }
    header.removeAttribute('data-bgh-compact-duplicate');
    compactUI = null;
  }

  function positionCompactActions() {
    for (const state of [compactUI, compactSectionUI]) positionCompactActionGroup(state);
  }

  function positionCompactActionGroup(state) {
    if (!state?.navigation || !state.topActions.length) return;
    const { navigation, topActions } = state;
    const rect = navigation.getBoundingClientRect();
    const dock = innerWidth >= 768 && navigation.isConnected && rect.height > 0;
    for (const action of topActions) action.toggleAttribute('data-bgh-compact-docked', dock);
    if (!dock) {
      navigation.style.removeProperty('--bgh-compact-nav-space');
      return;
    }
    // Keep native controls inside their React root so GitHub's handlers and menus still work.
    const widths = topActions.map(action => action.getBoundingClientRect().width);
    const height = Math.max(...topActions.map(action => action.getBoundingClientRect().height));
    const width = widths.reduce((sum, value) => sum + value, 0) + Math.max(0, widths.length - 1) * 4;
    navigation.style.setProperty('--bgh-compact-nav-space', `${width + 12}px`);
    const more = navigation.querySelector('[data-component="overflow-menu-button"]');
    const moreRect = more?.getBoundingClientRect();
    let left = (moreRect?.width ? moreRect.left : rect.right) - width - 10;
    const top = moreRect?.height ? moreRect.top + (moreRect.height - height) / 2 : rect.top + (rect.height - height) / 2;
    const offscreen = rect.bottom <= 0 || rect.top < 0 || rect.top >= innerHeight;
    for (let index = 0; index < topActions.length; index++) {
      const action = topActions[index];
      action.style.setProperty('--bgh-compact-x', `${left}px`);
      action.style.setProperty('--bgh-compact-y', `${top}px`);
      action.toggleAttribute('data-bgh-compact-offscreen', offscreen);
      left += widths[index] + 4;
    }
  }

  function restoreCompactSection() {
    if (!compactSectionUI) return;
    const { moved, marked } = compactSectionUI;
    for (const { node, anchor } of moved.reverse()) {
      if (anchor.isConnected) {
        if (node.isConnected) anchor.replaceWith(node);
        else anchor.remove();
      } else if (node.isConnected) node.remove();
    }
    for (const node of marked) {
      node.removeAttribute('data-bgh-compact-part');
      node.removeAttribute('data-bgh-compact-docked');
      node.removeAttribute('data-bgh-compact-offscreen');
      for (const name of ['x', 'y', 'nav-space']) node.style.removeProperty(`--bgh-compact-${name}`);
    }
    compactSectionUI = null;
  }

  function restoreCompactProfile() {
    document.documentElement.removeAttribute('data-bgh-compact-profile');
    for (const node of compactProfileNodes) {
      if (node.dataset.bghCompactPart?.startsWith('profile-')) node.removeAttribute('data-bgh-compact-part');
    }
    compactProfileNodes.clear();
  }

  function applyCompactProfile() {
    document.documentElement.dataset.bghCompactProfile = 'yes';
    // Mark existing wrappers only; keep native profile order, controls and README content intact.
    const mark = (node, part) => {
      if (!node) return;
      node.dataset.bghCompactPart = `profile-${part}`;
      compactProfileNodes.add(node);
    };
    // GitHub can keep a hidden responsive/server-rendered copy while hydrating the visible profile.
    for (const identity of document.querySelectorAll('.vcard-names')) {
      const layout = identity.closest('.Layout');
      mark(layout, 'layout');
      const sidebar = layout?.querySelector(':scope > .Layout-sidebar');
      mark(sidebar, 'sidebar');
      for (const block of sidebar?.querySelectorAll('.js-profile-editable-replace > .border-top') || []) mark(block, 'side-section');
    }
    for (const frame of document.querySelectorAll('[id="user-profile-frame"]')) {
      const stack = frame.querySelector(':scope > .position-relative');
      mark(stack, 'stack');
      for (const block of stack?.children || []) {
        if (block.matches('script, style')) continue;
        mark(block, 'block');
      }
    }
    for (const nav of document.querySelectorAll('nav, .UnderlineNav')) {
      if ([...nav.querySelectorAll('a[href]')].some(link => link.getAttribute('href')?.startsWith(`/${page.owner}?tab=`))) mark(nav, 'navigation');
    }
    for (const node of compactProfileNodes) if (!node.isConnected) compactProfileNodes.delete(node);
  }

  function applyCompactSection() {
    const key = location.pathname;
    const title = document.querySelector('main [data-testid="header-title"], main h1[data-component="PH_Title"]');
    const search = document.querySelector('main input[role="combobox"], main input[type="search"]');
    const list = document.querySelector('main [id$="-list-view-container"], main [class*="projectListWrapper__"]');
    if (compactSectionUI && (compactSectionUI.key !== key || !compactSectionUI.root?.isConnected ||
        (title && compactSectionUI.title !== title) || (list && compactSectionUI.list !== list) ||
        (search && compactSectionUI.search !== search) || compactSectionUI.staticHeader?.querySelector('button, a[href]'))) restoreCompactSection();
    if (!compactSectionUI) {
      const marked = [], moved = [];
      const mark = (node, part) => {
        if (!node || node.dataset.bghCompactPart === part) return;
        node.dataset.bghCompactPart = part;
        if (!marked.includes(node)) marked.push(node);
      };
      const move = (node, parent, before) => {
        const anchor = document.createComment('BetterGitHub compact section original position');
        node.before(anchor);
        moved.push({ node, anchor });
        parent.insertBefore(node, before);
      };
      const navigation = document.querySelector('nav:has(a[data-tab-item])');
      mark(navigation, 'navigation');
      const sectionLayout = (title || list || search)?.closest('[class*="PageLayout-PageLayoutWrapper-"]');
      mark(sectionLayout, 'section-layout');
      const topActions = [];
      let row = null;
      if (title?.matches('[data-testid="header-title"]')) {
        // Find the complete title/action row, stopping before search or list content.
        for (let parent = title.parentElement; parent && !parent.matches('main, header'); parent = parent.parentElement) {
          if (parent.querySelector('input, [role="search"], [role="list"]')) break;
          const actions = [...parent.children].filter(child => !child.contains(title) &&
            child.querySelector('button, a[data-component="Button"], a.btn'));
          if (actions.length) { row = parent; topActions.splice(0, topActions.length, ...actions); }
        }
      } else if (title) {
        row = title.closest('[data-component="PH_Header"], [class*="PageHeader-PageHeader-"]');
        topActions.push(...[...(row?.querySelectorAll('[data-component="PH_Actions"], [data-component="PH_ActionsArea"]') || [])]
          .filter(node => node.querySelector('button, a[href]')));
      }
      mark(title, 'section-title');
      mark(row, 'section-heading-row');
      for (const actions of topActions) mark(actions, 'section-actions');
      const layoutHeader = title?.closest('header[class*="PageLayout-Header-"]');
      mark(layoutHeader, 'section-layout-header');
      if (layoutHeader) {
        mark(layoutHeader.querySelector('[class*="HeaderHorizontalDivider"]'), 'section-divider');
        if (!layoutHeader.querySelector('input, button, a[href]')) mark(layoutHeader, 'section-static-header');
      }
      if (search && list) {
        const searchRegion = search.closest('search, [role="search"], [class*="searchInputWrapper__"]') || search.closest('[role="form"], form');
        const frame = list.parentElement;
        if (searchRegion && !searchRegion.contains(list)) {
          mark(searchRegion, 'section-search');
          mark(frame, 'section-frame');
          mark(list, 'section-list');
          if (!frame.contains(searchRegion)) move(searchRegion, frame, list);
          // Remove spacing wrappers between the list and its layout pane, without changing sidebar widths.
          for (let parent = frame.parentElement; parent && !parent.matches('main, header') &&
              !parent.className?.includes('PageLayout-PageLayoutWrapper-'); parent = parent.parentElement) {
            mark(parent, 'section-content');
          }
        }
      }
      // Legacy tabs use Subhead instead of PageHeader; tighten their chrome without hiding content titles.
      for (const subhead of document.querySelectorAll('main .Subhead')) mark(subhead, 'section-subhead');
      compactSectionUI = { key, root: title || list || document.querySelector('main'), title, list, search, moved, marked, navigation, topActions,
        staticHeader: layoutHeader?.dataset.bghCompactPart === 'section-static-header' ? layoutHeader : null };
    }
    positionCompactActions();
  }

  function applyCompactUI() {
    const route = location.pathname.split('/').filter(Boolean);
    const projectDashboard = page?.kind === 'site' && route.length === 3 && route[2] === 'projects';
    const profilePage = page?.kind === 'profile' && Boolean(document.querySelector('.vcard-names'));
    const enabled = settings.themeDisabled !== true && ['compact', 'compact-light'].includes(document.documentElement.dataset.bghTheme) && (page?.kind === 'repo' || projectDashboard || profilePage);
    const root = document.documentElement;
    if (!enabled) {
      restoreCompactUI();
      restoreCompactSection();
      restoreCompactProfile();
      root.removeAttribute('data-bgh-compact');
      return;
    }
    root.dataset.bghCompact = 'yes';
    if (profilePage) {
      restoreCompactUI();
      restoreCompactSection();
      applyCompactProfile();
      return;
    }
    restoreCompactProfile();
    if (route.length === 3 && ['pulls', 'issues', 'actions', 'projects', 'wiki', 'security', 'pulse', 'settings', 'discussions'].includes(route[2])) {
      restoreCompactUI();
      applyCompactSection();
      return;
    }
    restoreCompactSection();
    const branch = document.querySelector('button.overview-ref-selector, button[id^="ref-picker-repos-header"]');
    const code = [...document.querySelectorAll('main button, #repo-content-pjax-container button')]
      .find(button => button.querySelector('.octicon-code') && button.getAttribute('aria-haspopup') === 'true');
    if (!branch || !code || !document.querySelector('[data-testid="directory-content"]')) {
      restoreCompactUI();
      return;
    }
    const controls = code.parentElement;
    let toolbar = controls;
    while (toolbar && !toolbar.contains(branch)) toolbar = toolbar.parentElement;
    if (!toolbar || toolbar.matches('main, body, #repo-content-pjax-container')) {
      restoreCompactUI();
      return;
    }
    if (compactUI && (!compactUI.header.isConnected || compactUI.controls !== controls ||
        compactUI.key !== siteKey(page))) restoreCompactUI();
    if (!compactUI) {
      const actions = document.querySelector('[data-testid="repo-header-actions"]');
      const title = document.querySelector('#repo-title-component, [data-testid="repo-name-wrapper"]');
      if (!actions || !title) return;
      let header = actions.parentElement;
      while (header && !header.contains(title)) header = header.parentElement;
      if (!header || header.contains(toolbar)) return;
      const marked = [];
      const mark = (node, part) => {
        if (!node || node.dataset.bghCompactPart === part) return;
        node.dataset.bghCompactPart = part;
        if (!marked.includes(node)) marked.push(node);
      };
      const source = header.parentElement;
      const anchor = document.createComment('BetterGitHub compact actions');
      header.before(anchor);
      mark(toolbar, 'toolbar');
      mark(controls, 'controls');
      mark(header, 'header');
      mark(actions, 'actions');
      mark(title, 'title');
      if (title.parentElement !== header && !title.parentElement.contains(actions)) mark(title.parentElement, 'title-wrapper');
      const navigation = document.querySelector('nav:has(a[data-tab-item="code"])');
      mark(navigation, 'navigation');
      const topActions = [];
      for (const name of ['watch', 'fork', 'star']) {
        const button = actions.querySelector(`[data-testid="${name}-button"], .octicon-${name === 'watch' ? 'eye' : name === 'fork' ? 'repo-forked' : 'star'}, .octicon-${name === 'watch' ? 'bell' : name === 'fork' ? 'repo-forked' : 'star-fill'}`);
        let item = button;
        while (item && item.parentElement !== actions) item = item.parentElement;
        if (item) {
          mark(item, 'top-action');
          topActions.push(item);
        }
      }
      const directory = document.querySelector('[data-testid="directory-content"]');
      mark(directory.parentElement, 'files');
      if (source.children.length === 1) mark(source, 'source');
      const search = [...controls.children].find(node => node.querySelector('input[role="combobox"]'));
      mark(search, 'search');
      controls.insertBefore(header, code);
      compactUI = { header, anchor, marked, mark, controls, toolbar, navigation, topActions,
        visibilityLabel: title.querySelector('[data-testid="repo-visibility-label"]'), moved: [], key: siteKey(page) };
    }
    const repositoryPath = `/${page.owner}/${page.repository}`.toLowerCase();
    const breadcrumb = [...document.querySelectorAll('[class*="Breadcrumbs"] a, .AppHeader-context a, [class*="contextRegion"] a')]
      .find(link => link.getAttribute('href')?.toLowerCase() === repositoryPath &&
        link.textContent.trim().toLowerCase() === page.repository.toLowerCase() &&
        link.checkVisibility?.() !== false);
    compactUI.header.toggleAttribute('data-bgh-compact-duplicate', Boolean(breadcrumb));
    const move = (node, parent, before = null) => {
      if (!node || node.parentElement === parent) return;
      if (!compactUI.moved.some(entry => entry.node === node)) {
        const anchor = document.createComment('BetterGitHub compact original position');
        node.before(anchor);
        compactUI.moved.push({ node, anchor });
      }
      parent.insertBefore(node, before);
    };
    const forkOrigin = document.querySelector('[data-testid="fork-parent"]');
    if (forkOrigin) {
      compactUI.mark(forkOrigin, 'fork-origin');
      move(forkOrigin, compactUI.toolbar);
    }
    for (const heading of document.querySelectorAll('[class*="borderGrid__"] h2, .BorderGrid h2, aside h2')) {
      const section = heading.closest('[class*="sidebarSection__"], .BorderGrid-cell, [class*="borderGridCell__"], .BorderGrid-row, [class*="borderGridRow__"]');
      if (!section) continue;
      compactUI.mark(section, 'sidebar-section');
      const row = section.closest('.BorderGrid-row, [class*="borderGridRow__"]');
      if (row && row !== section) compactUI.mark(row, 'sidebar-row');
      for (const description of section.querySelectorAll('p')) {
        if (description.textContent.trim() === 'No description, website, or topics provided.') compactUI.mark(description, 'empty-description');
      }
    }
    const aboutHeading = headingRow('about')?.querySelector('h2');
    const visibility = document.querySelector('[data-testid="repo-visibility-label"]') || compactUI.visibilityLabel;
    if (visibility && aboutHeading && (typeof aboutHeading.checkVisibility !== 'function' || aboutHeading.checkVisibility())) {
      compactUI.visibilityLabel = visibility;
      compactUI.mark(aboutHeading, 'about-heading');
      move(visibility, aboutHeading);
    } else if (visibility) {
      const original = compactUI.moved.find(entry => entry.node === visibility)?.anchor;
      if (original?.isConnected && visibility.parentElement !== original.parentElement) original.after(visibility);
    }
    compactUI.mark(headingRow('contributors'), 'contributors');
    const readme = document.querySelector('main .markdown-body');
    if (readme) {
      let stack = document.querySelector('[data-testid="directory-content"]').parentElement;
      while (stack && !stack.contains(readme)) stack = stack.parentElement;
      if (stack && !stack.matches('main, body')) {
        compactUI.mark(stack, 'content-stack');
        let readmeFrame = readme;
        while (readmeFrame.parentElement !== stack) readmeFrame = readmeFrame.parentElement;
        compactUI.mark(readmeFrame, 'readme-frame');
        let codeFrame = document.querySelector('[data-testid="directory-content"]');
        while (codeFrame.parentElement !== stack) codeFrame = codeFrame.parentElement;
        if (codeFrame.dataset.bghCompactPart !== 'files') compactUI.mark(codeFrame, 'code-frame');
        const branchInfo = document.querySelector('[data-testid="branch-info-bar"]');
        if (branchInfo && (branchInfo.parentElement === stack.parentElement || branchInfo.parentElement === stack)) {
          compactUI.mark(branchInfo, 'branch-info');
          move(branchInfo, stack, stack.firstChild);
        }
      }
    }
    positionCompactActions();
  }

  function disablePageFeatures() {
    restoreCompactUI();
    restoreCompactSection();
    restoreCompactProfile();
    document.documentElement.removeAttribute('data-bgh-compact');
    editorPreview = null;
    previewKey = '';
    stopRepoEditor();
    if (profileEdit) stopProfileEditor(false);
    restoreProfileLayout();
    applyTheme({});
    for (const container of document.querySelectorAll('.bgh-reordered, .bgh-main-reordered')) {
      for (const child of container.children) child.style.order = '';
      container.classList.remove('bgh-reordered', 'bgh-main-reordered');
    }
    const dialog = document.getElementById('bgh-dialog');
    if (dialog?.open) dialog.close();
    document.querySelectorAll('[id^="bgh-"]').forEach(node => node.remove());
    document.querySelectorAll('[data-bgh-original-code]').forEach(node => node.removeAttribute('data-bgh-original-code'));
    const root = document.documentElement;
    for (const attribute of [...root.attributes]) {
      if (attribute.name.startsWith('data-bgh')) root.removeAttribute(attribute.name);
    }
    for (let index = root.style.length - 1; index >= 0; index--) {
      const property = root.style.item(index);
      if (property.startsWith('--bgh-')) root.style.removeProperty(property);
    }
  }

  function apply() {
    if (settings.themeDisabled === true) { disablePageFeatures(); return; }
    if (!page) { applyCompactUI(); return; }
    const config = siteConfig();
    applyTheme(config);
    applyCompactUI();
    if (page.kind === 'site') return;
    if (page.kind === 'repo') { reorderSidebar(config); reorderRepoMain(config); }
    else applyProfileLayout(config);
    addVisuals(editorPreview && previewKey === siteKey(page) ? { ...config, ...editorPreview } : config);
    replaceCodeButton(config);
    if (repoDraft && page.kind === 'repo' && repoSections().some(({ name, column, row }) => !row.querySelector(`.bgh-layout-handle[data-bgh-column="${column}"][data-bgh-drag-handle="${name}"]`))) renderRepoHandles();
    const gear = document.getElementById('bgh-gear');
    if (gear) { gear.title = ui('Открыть редактор BetterGitHub', 'Open BetterGitHub editor'); gear.setAttribute('aria-label', gear.title); }
    const install = document.getElementById('bgh-install');
    if (install) { install.textContent = ui('↓ Установить', '↓ Install'); install.title = ui('Скачать файл установки', 'Download installer'); }
  }

  function startRepoEditor() {
    if (page?.kind !== 'repo' || !document.querySelector('#bgh-dialog[open]') || !repositorySettingsButton() || repoDraft) return;
    const config = siteConfig();
    repoDraft = sanitizeOrder(config.layout?.sidebar);
    repoMainDraft = repoMainOrder(config.layout?.repository);
    document.getElementById('bgh-edit-layout').hidden = true;
    document.getElementById('bgh-layout-hint').hidden = false;
    apply();
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
    if (page?.kind === 'repo') {
      const edit = document.getElementById('bgh-edit-layout');
      const hint = document.getElementById('bgh-layout-hint');
      if (edit) edit.hidden = false;
      if (hint) hint.hidden = true;
    }
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
    const orderFor = column => column === 'repo' ? repoDraft : repoMainDraft;
    const move = (column, from, to) => {
      const order = [...orderFor(column)];
      const fromIndex = order.indexOf(from), toIndex = order.indexOf(to);
      if (fromIndex < 0 || toIndex < 0 || from === to) return;
      order.splice(fromIndex, 1);
      order.splice(toIndex, 0, from);
      if (column === 'repo') repoDraft = order;
      else repoMainDraft = order;
      apply();
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
        const target = elements.find(node => getComputedStyle(node).display !== 'none') || elements[0];
        if (getComputedStyle(target).display === 'none') continue;
        target.classList.add('bgh-layout-target');
        const handle = document.createElement('button');
        handle.type = 'button';
        handle.className = 'bgh-layout-handle';
        handle.dataset.bghDragHandle = name;
        handle.dataset.bghColumn = column;
        handle.draggable = true;
        handle.innerHTML = '<svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true"><circle cx="3" cy="3" r="1.3"/><circle cx="7" cy="3" r="1.3"/><circle cx="3" cy="8" r="1.3"/><circle cx="7" cy="8" r="1.3"/><circle cx="3" cy="13" r="1.3"/><circle cx="7" cy="13" r="1.3"/></svg>';
        handle.title = `${ui('Переместить', 'Move')} ${name === 'info' ? ui('О себе', 'About') : PROFILE_TITLES[name]}`;
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
      effect: BACKGROUND_EFFECTS.includes(effect) ? effect : 'none',
      ...backgroundFormOptions(form)
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
    for (const [key, value] of Object.entries(BACKGROUND_DEFAULTS)) {
      if (exported.appearance[key] === value) delete exported.appearance[key];
    }
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

  function replacePublishedProfile(previous, profile) {
    const output = { ...previous, profile };
    const layout = previous.layout;
    if (!layout || !(Object.hasOwn(layout, 'profile') || Object.hasOwn(layout, 'profileSidebar'))) return output;

    const repositoryLayout = { ...layout };
    delete repositoryLayout.profile;
    delete repositoryLayout.profileSidebar;
    if (Object.keys(repositoryLayout).length) output.layout = repositoryLayout;
    else delete output.layout;

    // Older profile exports kept their palette and images next to the profile layout.
    // If the file also configures the repository, its root palette and images belong there.
    if (!Object.hasOwn(repositoryLayout, 'sidebar') && !Object.hasOwn(repositoryLayout, 'repository') &&
        !previous.installUrl) {
      delete output.appearance;
      delete output.banner;
      delete output.icon;
    }
    return output;
  }

  async function stageGitHubSave(form, savedDraft = null) {
    const context = savedDraft || page;
    const config = savedDraft ? savedDraft.organizationConfig : readEditorConfig(form);
    if (!config) return;
    const owner = context.owner;
    const repository = context.configRepo || context.repository;
    if (!safeName(owner) || !safeName(repository)) return;
    const hint = document.getElementById(savedDraft ? 'bgh-github-draft-status' : 'bgh-mode-hint');
    const setupTab = context.kind === 'org' && !savedDraft ? window.open('about:blank', '_blank') : null;
    hint.textContent = context.kind === 'org'
      ? ui(`Организация ${owner}: ищу файл темы в ${owner}/.github…`, `Organization ${owner}: finding its theme in ${owner}/.github…`)
      : context.kind === 'profile'
      ? ui(`Профиль ${owner}: ищу файл оформления в ${owner}/${repository}…`, `Profile ${owner}: finding its appearance file in ${owner}/${repository}…`)
      : ui('Ищу файл и основную ветку репозитория…', 'Finding the file and default branch…');
    try {
      const target = await send({ type: 'bettergithub:editor-target', owner, repository });
      if (target.missingRepository && context.kind === 'org' && repository === '.github') {
        if (savedDraft) throw new Error(ui('Публичный репозиторий .github ещё недоступен. Завершите его создание и попробуйте снова.', 'The public .github repository is not available yet. Finish creating it and try again.'));
        const organizationConfig = publishedConfig(config);
        await githubDraftSet({
          owner, repository, kind: 'org', awaitingRepository: true,
          organizationConfig, createdAt: Date.now(), filename: '.bettergithub.json',
          json: `${JSON.stringify({ organization: organizationConfig }, null, 2)}\n`
        });
        const url = new URL('https://github.com/new');
        url.searchParams.set('owner', owner);
        url.searchParams.set('name', '.github');
        url.searchParams.set('visibility', 'public');
        if (setupTab && !setupTab.closed) setupTab.location.href = url.href;
        else window.location.href = url.href;
        hint.textContent = ui('Тема сохранена в черновике. Создайте публичный .github с README, затем нажмите «Продолжить сохранение темы».', 'Theme saved as a draft. Create a public .github with a README, then choose “Continue saving theme”.');
        return;
      }
      if (target.error || typeof target.branch !== 'string' || !['.bettergithub.json', 'bettergithub.json'].includes(target.filename)) {
        throw new Error(target.error || 'Invalid GitHub response');
      }
      const previous = target.config && typeof target.config === 'object' && !Array.isArray(target.config) ? target.config : {};
      const published = publishedConfig(config);
      const output = context.kind === 'profile' ? replacePublishedProfile(previous, published)
        : context.kind === 'org' ? { ...previous, organization: published }
        : previous.profile || previous.organization
          ? { ...previous, ...published, layout: { ...(previous.layout || {}), ...published.layout } }
          : published;
      const draft = {
        owner, repository, branch: target.branch, filename: target.filename,
        exists: Boolean(target.exists), prepared: true, createdAt: Date.now(),
        kind: context.kind, json: `${JSON.stringify(output, null, 2)}\n`
      };
      const opened = await send({ type: 'bettergithub:open-editor', draft });
      if (!opened.ok) throw new Error(opened.error || 'Could not open the editor tab');
      setupTab?.close();
      hint.textContent = context.kind === 'profile'
        ? ui(`Открыт файл оформления профиля ${owner}/${repository}/${target.filename}. Проверьте его и подтвердите коммит на GitHub.`, `Opened the profile appearance file ${owner}/${repository}/${target.filename}. Review it and commit on GitHub.`)
        : ui(`Открыт редактор ${target.filename}. Проверьте файл и подтвердите коммит на GitHub.`, `Opened the ${target.filename} editor. Review the file and commit on GitHub.`);
    } catch (error) {
      setupTab?.close();
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
      effect: String(data.get('effect') || 'none'),
      ...backgroundFormOptions(form)
    };
    for (const name of ['accent', 'base', 'surface', 'text', 'muted', 'border']) {
      const color = hex(String(data.get(name)));
      if (color) appearance[name] = color;
    }
    editorPreview = {
      appearance,
      banner: String(data.get('banner') || '').trim(),
      icon: String(data.get('icon') || '').trim()
    };
    previewKey = siteKey(page);
    apply();
  }

  function clearEditorPreview() {
    if (!editorPreview) return;
    editorPreview = null;
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
    text('#bgh-form header h2', page.kind === 'org' ? 'Оформление организации' : page.kind === 'profile' ? 'Оформление профиля' : 'Оформление страницы', page.kind === 'org' ? 'Organization appearance' : page.kind === 'profile' ? 'Profile appearance' : 'Page appearance');
    dialog.querySelector('#bgh-close')?.setAttribute('aria-label', ui('Закрыть', 'Close'));
    for (const [name, ru, en] of [
      ['theme', 'Тема', 'Theme'], ['accent', 'Акцент', 'Accent'],
      ['base', 'Фон страницы', 'Page background'], ['surface', 'Поверхности', 'Surfaces'],
      ['text', 'Текст', 'Text'], ['muted', 'Вторичный текст', 'Secondary text'],
      ['border', 'Границы', 'Borders'],
      ['background', 'Фон (HTTPS GitHub или путь в репозитории)', 'Background (GitHub HTTPS URL or repository path)'],
      ['backgroundDim', 'Затемнение', 'Darkening'],
      ['backgroundPosition', 'Положение картинки', 'Image position'],
      ['effectStrength', 'Сила эффекта', 'Effect strength'],
      ['effect', 'Эффект фона', 'Background effect'], ['banner', 'Баннер над About', 'Banner above About'],
      ['icon', 'Значок рядом с названием', 'Icon next to the name'],
      ['installUrl', 'Прямая ссылка установки', 'Direct install URL']
    ]) label(name, ru, en);
    text('.bgh-colors legend', 'Цвета темы', 'Theme colors');
    for (const [value, ru, en] of [
      ['universe', 'GitHub Universe — светлая', 'GitHub Universe — light'],
      ['universe-dark', 'GitHub Universe — тёмная', 'GitHub Universe — dark'],
      ['midnight', 'Полночь', 'Midnight'], ['amethyst', 'Аметист', 'Amethyst'],
      ['forest', 'Лес', 'Forest'], ['light', 'Светлая', 'Light'],
      ['rounded', 'Округлая', 'Rounded'],
      ['compact', 'Compact UI', 'Compact UI'],
      ['compact-light', 'Compact UI', 'Compact UI'],
      ['rounded-light', 'Округлая светлая', 'Rounded light']
    ]) text(`[name="theme"] option[value="${value}"]`, ru, en);
    for (const [value, ru, en] of [
      ['none', 'Нет', 'None'], ['gradient', 'Мягкий градиент', 'Soft gradient'], ['glow', 'Свечение', 'Glow']
    ]) text(`[name="effect"] option[value="${value}"]`, ru, en);
    for (const [value, ru, en] of [
      ['center', 'По центру', 'Center'], ['top', 'Сверху', 'Top'], ['bottom', 'Снизу', 'Bottom']
    ]) text(`[name="backgroundPosition"] option[value="${value}"]`, ru, en);
    text('#bgh-layout-hint', 'Перемещайте блоки на странице за ручки из шести точек. Изменения сохранятся после нажатия «Сохранить локально».', 'Drag sections on the page using the six-dot handles. Changes are saved when you click “Save locally”.');
    text('#bgh-edit-layout', 'Изменить расположение блоков', 'Edit section layout');
    text('#bgh-reset', 'Сбросить локальные настройки', 'Reset local settings');
    text('#bgh-export', 'Скачать JSON', 'Download JSON');
    text('#bgh-github-save', page.kind === 'profile' ? 'Файл профиля в GitHub' : 'Открыть в GitHub', page.kind === 'profile' ? 'Profile file on GitHub' : 'Open in GitHub');
    if (page.kind === 'org') text('#bgh-github-save', 'Сохранить тему организации в GitHub', 'Save organization theme to GitHub');
    text('#bgh-form button[type="submit"]', 'Сохранить локально', 'Save locally');
    text('#bgh-form > p.bgh-hint:last-child',
      'Настройки здесь видны только вам. Для всех посетителей добавьте .bettergithub.json в репозиторий.',
      'These settings are visible only to you. Add .bettergithub.json to the repository to share them.');
    if (page.kind === 'org') text('#bgh-form > p.bgh-hint:last-child',
      `Для публикации темы организации сохраните её в ${page.owner}/.github/.bettergithub.json.`,
      `To publish the organization theme, save it in ${page.owner}/.github/.bettergithub.json.`);
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
    if (settings.themeDisabled === true || !page || (page.kind === 'repo' && (pluginRepositoryThemes === false || !repositorySettingsButton()))) return;
    let dialog = document.getElementById('bgh-dialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'bgh-dialog';
      dialog.innerHTML = `<form method="dialog" id="bgh-form"><header><h2>Оформление страницы</h2><button type="button" id="bgh-close" aria-label="Закрыть">×</button></header><p id="bgh-target"></p><p id="bgh-mode-hint" class="bgh-hint"></p><label>Тема<select name="theme"><option value="github">GitHub</option><option value="compact">Compact UI</option><option value="compact-light">Compact UI</option><option value="universe">GitHub Universe — светлая</option><option value="universe-dark">GitHub Universe — тёмная</option><option value="rounded">Округлая</option><option value="rounded-light">Округлая светлая</option><option value="midnight">Полночь</option><option value="amethyst">Аметист</option><option value="forest">Лес</option><option value="light">Светлая</option></select></label><fieldset class="bgh-colors"><legend>Цвета темы</legend><label>Акцент<input name="accent" type="color"></label><label>Фон страницы<input name="base" type="color"></label><label>Поверхности<input name="surface" type="color"></label><label>Текст<input name="text" type="color"></label><label>Вторичный текст<input name="muted" type="color"></label><label>Границы<input name="border" type="color"></label></fieldset><label>Фон (HTTPS GitHub или путь в репозитории)<input name="background" type="text" placeholder="image.png"></label><label>Затемнение <input name="backgroundDim" type="range" min="0" max="100" value="56"><output data-background-value="backgroundDim"></output></label><label>Положение картинки<select name="backgroundPosition"><option value="center">По центру</option><option value="top">Сверху</option><option value="bottom">Снизу</option></select></label><label>Эффект фона<select name="effect"><option value="none">Нет</option><option value="gradient">Мягкий градиент</option><option value="glow">Свечение</option></select></label><label>Сила эффекта <input name="effectStrength" type="range" min="0" max="100" value="40"><output data-background-value="effectStrength"></output></label><label>Баннер над About<input name="banner" type="text" placeholder="assets/banner.png"></label><label>Значок рядом с названием<input name="icon" type="text" placeholder="assets/icon.png"></label><label>Прямая ссылка установки<input name="installUrl" type="url" placeholder="https://github.com/…/releases/download/…"></label><p id="bgh-layout-hint" class="bgh-hint"></p><footer><button type="button" id="bgh-reset">Сбросить локальные настройки</button><button type="button" id="bgh-export">Скачать JSON</button><button type="button" id="bgh-github-save">Открыть в GitHub</button><button type="submit">Сохранить локально</button></footer><p class="bgh-hint">Настройки здесь видны только вам. Для всех посетителей добавьте .bettergithub.json в репозиторий.</p></form>`;
      document.body.append(dialog);
      const editLayout = document.createElement('button');
      editLayout.type = 'button';
      editLayout.id = 'bgh-edit-layout';
      editLayout.textContent = 'Переместить блоки профиля';
      dialog.querySelector('#bgh-mode-hint').after(editLayout);
      editLayout.addEventListener('click', () => {
        if (page?.kind === 'repo') startRepoEditor();
        else startProfileEditor();
      });
      dialog.querySelector('[name="theme"]').addEventListener('change', event => {
        const form = dialog.querySelector('form');
        fillEditorColors(form, event.target.value);
        previewEditor(form);
      });
      dialog.querySelector('form').addEventListener('input', event => {
        if (!event.target.matches('.bgh-colors input, [name="background"], [name="banner"], [name="icon"], [name="backgroundDim"], [name="effectStrength"]')) return;
        if (event.target.type === 'range') event.target.nextElementSibling.value = `${event.target.value}%`;
        previewEditor(event.currentTarget);
      });
      dialog.querySelector('form').addEventListener('change', event => {
        if (event.target.matches('[name="effect"], [name="backgroundPosition"]')) previewEditor(event.currentTarget);
      });
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
        editorPreview = null;
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
    form.elements.effect.value = BACKGROUND_EFFECTS.includes(visual.effect) ? visual.effect : 'none';
    for (const [name, value] of Object.entries(backgroundOptions(visual))) {
      form.elements[name].value = value;
    }
    for (const output of form.querySelectorAll('[data-background-value]')) {
      output.value = `${form.elements[output.dataset.backgroundValue].value}%`;
    }
    form.elements.banner.value = config.banner || '';
    form.elements.icon.value = config.icon || '';
    form.elements.installUrl.value = config.installUrl || '';
    dialog.querySelector('#bgh-layout-hint').hidden = !repoDraft;
    dialog.querySelector('#bgh-edit-layout').hidden = !['profile', 'repo'].includes(page.kind) || Boolean(repoDraft);
    globalThis.BGHColorPicker?.attach(dialog);
    if (!dialog.open) dialog.show();
    if (page.kind === 'profile' && !profileEdit) startProfileEditor();
  }

  function isGitHubFileEditor() {
    return /^\/[^/]+\/[^/]+\/(?:edit|new)\//.test(location.pathname);
  }

  function matchesGitHubDraft(draft) {
    if (settings.themeDisabled === true || !draft || Date.now() - draft.createdAt > 20 * 60_000 || typeof draft.json !== 'string') return false;
    let path;
    try { path = decodeURIComponent(location.pathname); } catch { return false; }
    const prefix = `/${draft.owner}/${draft.repository}/${draft.exists ? 'edit' : 'new'}/${draft.branch}`;
    if (!draft.exists && new URLSearchParams(location.search).get('filename') !== draft.filename) return false;
    return path.toLowerCase() === `${prefix}${draft.exists ? `/${draft.filename}` : ''}`.toLowerCase();
  }

  async function maybeResumeOrganizationDraft() {
    if (settings.themeDisabled === true) return;
    const path = location.pathname.toLowerCase();
    if (path !== '/new' && !/^\/[^/]+\/\.github\/?$/.test(path)) return;
    const draft = await githubDraftGet();
    if (settings.themeDisabled === true) return;
    if (!draft?.awaitingRepository || draft.kind !== 'org' || draft.repository !== '.github' ||
        !safeName(draft.owner) || !draft.organizationConfig?.appearance ||
        typeof draft.json !== 'string' || Date.now() - draft.createdAt > 20 * 60_000) return;
    const creating = path === '/new' && new URLSearchParams(location.search).get('owner')?.toLowerCase() === draft.owner.toLowerCase() &&
      new URLSearchParams(location.search).get('name') === '.github';
    const repository = path.replace(/\/$/, '') === `/${draft.owner}/.github`.toLowerCase();
    if (!creating && !repository) return;
    while (!document.body) await new Promise(resolve => setTimeout(resolve, 100));
    if (settings.themeDisabled === true) return;
    const key = `${draft.createdAt}:${path}`;
    if (githubOrganizationDraftSeen === key) return;
    githubOrganizationDraftSeen = key;
    document.getElementById('bgh-github-draft')?.remove();
    const tray = showGitHubDraft(draft);
    tray.querySelector('#bgh-github-draft-status').textContent = creating
      ? ui(`Создайте публичный репозиторий ${draft.owner}/.github и включите README. Затем нажмите «Продолжить сохранение темы».`, `Create the public ${draft.owner}/.github repository and include a README. Then choose “Continue saving theme”.`)
      : ui('Черновик темы организации сохранён. Продолжите, чтобы открыть файл темы в редакторе GitHub.', 'Your organization theme draft is saved. Continue to open its file in GitHub’s editor.');
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'bgh-organization-continue';
    button.textContent = ui('Продолжить сохранение темы', 'Continue saving theme');
    button.addEventListener('click', async () => {
      button.disabled = true;
      try { await stageGitHubSave(null, draft); }
      finally { button.disabled = false; }
    });
    tray.querySelector('div').prepend(button);
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
      status.textContent = ui('JSON скопирован. Выделите весь текст в редакторе, вставьте JSON и проверьте изменения.', 'JSON copied. Select all text in the editor, paste the JSON, and review the changes.');
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
    return lines.replace(/\r/g, '').trimEnd() === json.trimEnd();
  }

  function syncGitHubPasteButton() {
    const draft = githubEditorDraft;
    const existing = document.getElementById('bgh-github-paste');
    if (!isGitHubFileEditor() || !matchesGitHubDraft(draft)) {
      existing?.remove();
      if (draft) {
        githubEditorDraft = null;
        githubDraftSeen = false;
        document.getElementById('bgh-github-draft')?.remove();
      }
      return;
    }
    if (existing) return;

    const actions = [...document.querySelectorAll(':is(main, [role="main"], #repo-content-pjax-container) :is(button, a)')];
    const label = action => (action.getAttribute('aria-label') || action.textContent).trim();
    const cancel = actions.find(action => /^cancel changes$/i.test(label(action)));
    if (!cancel) return;
    const commit = actions.find(action => /^commit changes(?:\.\.\.|…)?$/i.test(label(action)));
    if (!commit) return;
    let anchor = cancel;
    while (!anchor.parentElement.contains(commit)) anchor = anchor.parentElement;
    if (anchor.parentElement.matches('main, [role="main"], #repo-content-pjax-container, body')) return;

    const paste = document.createElement('button');
    paste.type = 'button';
    paste.id = 'bgh-github-paste';
    paste.className = cancel.className || 'btn';
    for (const attribute of ['data-variant', 'data-size', 'data-component']) {
      if (cancel.hasAttribute(attribute)) {
        paste.setAttribute(attribute, cancel.getAttribute(attribute));
      }
    }
    paste.textContent = 'Paste BetterGitHub';
    paste.disabled = githubDraftRunning;
    paste.addEventListener('click', async () => {
      if (!matchesGitHubDraft(draft)) return;
      const status = showGitHubDraft(draft).querySelector('#bgh-github-draft-status');
      paste.disabled = true;
      try {
        const filled = await fillGitHubEditor(draft.json);
        status.textContent = filled
          ? ui('Текст заменён. Проверьте изменения перед коммитом.', 'The text was replaced. Review the changes before committing.')
          : ui('Не удалось заменить текст. Скопируйте JSON и вставьте его вместо всего текста файла.', 'Could not replace the text. Copy the JSON and paste it over the entire file.');
      } finally { paste.disabled = false; }
    });
    anchor.before(paste);
  }

  async function maybeFillGitHubDraft() {
    if (settings.themeDisabled === true) return;
    if (githubDraftRunning || githubDraftSeen) return;
    if (!isGitHubFileEditor()) return;
    githubDraftRunning = true;
    try {
      let draft = await editorDraftGet();
      if (!matchesGitHubDraft(draft)) return;
      githubDraftSeen = true;
      let cleanedDraft = false;
      if (draft.kind === 'profile') {
        // Drafts prepared by earlier versions can still contain the legacy root settings.
        const config = JSON.parse(draft.json);
        if (config?.profile && typeof config.profile === 'object' && !Array.isArray(config.profile)) {
          const cleaned = replacePublishedProfile(config, config.profile);
          if (JSON.stringify(cleaned) !== JSON.stringify(config)) {
            draft = { ...draft, json: `${JSON.stringify(cleaned, null, 2)}\n` };
            cleanedDraft = true;
          }
        }
      }
      while (!document.body) await new Promise(resolve => setTimeout(resolve, 100));
      if (!matchesGitHubDraft(draft)) {
        githubDraftSeen = false;
        return;
      }
      githubEditorDraft = draft;
      syncGitHubPasteButton();
      const tray = showGitHubDraft(draft);
      const status = tray.querySelector('#bgh-github-draft-status');
      if (draft.attempted) {
        if (cleanedDraft) {
          status.textContent = ui('Черновик очищен. Чтобы обновить текст в редакторе, нажмите Paste BetterGitHub или скопируйте JSON.', 'The draft was cleaned up. To update the editor, use Paste BetterGitHub or copy the JSON.');
          return;
        }
        status.textContent = ui('Автовставка уже выполнялась. Проверьте файл перед коммитом.', 'Automatic insertion already ran. Review the file before committing.');
        return;
      }
      const marked = await editorDraftUpdate(draft, { attempted: true });
      if (!marked.ok) return;
      for (let attempt = 0; attempt < 40; attempt++) {
        if (!matchesGitHubDraft(draft)) return;
        const filled = await fillGitHubEditor(draft.json);
        if (filled === true) {
          await editorDraftUpdate(draft, { handled: true });
          status.textContent = ui('JSON вставлен один раз. Проверьте файл и нажмите «Commit changes» на GitHub.', 'JSON inserted once. Review the file and click “Commit changes” on GitHub.');
          return;
        }
        if (filled === false) break;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      status.textContent = ui('Автовставка не сработала. Скопируйте JSON и вставьте его вручную.', 'Automatic insertion failed. Copy the JSON and paste it manually.');
    } finally {
      githubDraftRunning = false;
      const paste = document.getElementById('bgh-github-paste');
      if (paste) paste.disabled = false;
    }
  }

  async function maybeRefreshPublishedDraft() {
    if (settings.themeDisabled === true || githubDraftInvalidating) return;
    let path;
    try { path = decodeURIComponent(location.pathname); } catch { return; }
    if (!/^\/[^/]+\/[^/]+\/(?:blob|commit)\//.test(path)) return;
    githubDraftInvalidating = true;
    try {
      const draft = await editorDraftGet();
      if (settings.themeDisabled === true) return;
      if (!(draft?.prepared || draft?.attempted) || draft.invalidated) return;
      const root = `/${draft.owner}/${draft.repository}`.toLowerCase();
      const file = `${root}/blob/${draft.branch}/${draft.filename}`.toLowerCase();
      const commit = `${root}/commit/`;
      if (path.toLowerCase() !== file && !path.toLowerCase().startsWith(commit)) return;
      const response = await send({ type: 'bettergithub:invalidate', owner: draft.owner, repository: draft.repository });
      if (!response.ok) return;
      await editorDraftUpdate(draft, { invalidated: true });
      await new Promise((resolve, reject) => api.storage.local.set({
        publishedRevision: Date.now()
      }, () => api.runtime.lastError ? reject(new Error(api.runtime.lastError.message)) : resolve()));
    } finally { githubDraftInvalidating = false; }
  }

  async function start() {
    const next = identify();
    const key = siteKey(next);
    if (!preferencesReady) {
      const preferences = await (preferencesLoading ||= loadPreferences());
      if (siteKey(identify()) !== key) return;
      settings = { ...DEFAULT_SETTINGS, ...preferences?.settings };
      pluginDimLightThemes = preferences?.pluginDimLightThemes;
      pluginRepositoryThemes = preferences?.pluginRepositoryThemes;
      preferencesReady = true;
    }
    if (settings.themeDisabled === true) {
      page = next;
      currentKey = key;
      apply();
      return;
    }
    maybeResumeOrganizationDraft().catch(error => console.warn('BetterGitHub organization theme:', error));
    syncGitHubPasteButton();
    maybeFillGitHubDraft().catch(error => console.warn('BetterGitHub GitHub editor:', error));
    maybeRefreshPublishedDraft().catch(error => console.warn('BetterGitHub GitHub refresh:', error));
    if (key === currentKey && page) {
      apply();
      if (profileHandlesStale()) renderProfileHandles();
      return;
    }
    if (profileEdit) stopProfileEditor(false);
    stopRepoEditor();
    restoreProfileLayout();
    clearEditorPreview();
    const openDialog = document.getElementById('bgh-dialog');
    if (openDialog?.open) openDialog.close();
    currentKey = key;
    page = next;
    remote = null; assetBase = null;
    if (!page) { applyCompactUI(); return; }
    const id = ++runId;
    apply();
    if (page.kind === 'site') return;
    const response = await send({ type: 'bettergithub:load', ...page });
    if (id !== runId || siteKey(identify()) !== key) return;
    remote = response.config;
    assetBase = response.assetBase;
    apply();
  }

  function schedule() {
    if (timer !== null) return;
    // GitHub can keep mutating while it loads; do not restart the delay on every mutation.
    timer = setTimeout(() => { timer = null; start(); }, 50);
  }
  api.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.publishedRevision && settings.themeDisabled !== true && page && page.kind !== 'site') {
      const expected = siteKey(page);
      const id = ++runId;
      send({ type: 'bettergithub:load', ...page }).then(response => {
        if (id !== runId || siteKey(identify()) !== expected) return;
        remote = response.config;
        assetBase = response.assetBase;
        apply();
      });
    }
    if (area !== 'local') return;
    const wasDisabled = settings.themeDisabled === true;
    if (changes.pluginDimLightThemes) pluginDimLightThemes = changes.pluginDimLightThemes.newValue;
    if (changes.pluginRepositoryThemes) pluginRepositoryThemes = changes.pluginRepositoryThemes.newValue;
    if (changes.settings) settings = { ...DEFAULT_SETTINGS, ...changes.settings.newValue };
    if (settings.themeDisabled === true) {
      runId++;
      githubDraftSeen = false;
      githubEditorDraft = null;
    } else if (wasDisabled) {
      currentKey = '';
      schedule();
    }
    if (changes.settings || changes.pluginDimLightThemes || changes.pluginRepositoryThemes) {
      const dialog = document.getElementById('bgh-dialog');
      if (page?.kind === 'repo' && pluginRepositoryThemes === false && dialog?.open) {
        dialog.querySelector('#bgh-close')?.click();
      } else {
        apply();
      }
      if (changes.settings && dialog && page) translateEditor(dialog);
      if (changes.settings && profileEdit) renderProfileHandles();
    }
  });
  addEventListener('popstate', schedule);
  addEventListener('resize', () => { positionCompactActions(); schedule(); });
  addEventListener('scroll', positionCompactActions, { passive: true });
  document.addEventListener('turbo:before-render', restoreCompactUI);
  document.addEventListener('turbo:before-cache', restoreCompactUI);
  document.addEventListener('turbo:before-render', restoreCompactSection);
  document.addEventListener('turbo:before-cache', restoreCompactSection);
  document.addEventListener('turbo:before-render', restoreCompactProfile);
  document.addEventListener('turbo:before-cache', restoreCompactProfile);
  document.addEventListener('click', event => {
    if (!event.target.closest?.('#bgh-gear')) return;
    event.preventDefault();
    event.stopPropagation();
    const nativeDialog = event.target.closest('dialog, [role="dialog"], details-dialog');
    if (nativeDialog && nativeDialog.id !== 'bgh-dialog') {
      if (nativeDialog.matches('dialog') && typeof nativeDialog.close === 'function') nativeDialog.close();
      else if (nativeDialog.closest('details')) nativeDialog.closest('details').open = false;
      else nativeDialog.querySelector('[aria-label="Close"], [aria-label="Close dialog"], [data-close-dialog]')?.click();
    }
    openPanel();
  }, true);
  addEventListener('turbo:load', schedule);
  new MutationObserver(records => {
    if (records.some(record => !record.target.closest?.('#bgh-cursor-trail, #bgh-dialog, #bgh-gear-menu, #bgh-tools-dialog, #bgh-tools-launchers, #bgh-tools-toast'))) schedule();
  }).observe(document.documentElement, { childList: true, subtree: true });
  start();
})();
