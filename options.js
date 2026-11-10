(() => {
  'use strict';
  const form = document.getElementById('settings');
  const status = document.getElementById('status');
  const gallery = document.getElementById('theme-gallery');
  const paletteFields = document.getElementById('palette-fields');
  const paletteHint = document.getElementById('palette-hint');
  const defaultSettings = { mode: 'site', theme: 'github', language: 'ru', global: {}, sites: {} };
  const translations = {
    ru: {
      title: 'BetterGitHub — магазин', settingsSections: 'Разделы магазина', themeNav: 'Темы', pluginsNav: 'Плагины', pluginsEmpty: 'Плагинов пока нет.',
      themeHeading: 'Темы оформления', themeDescription: 'Выбери тему для GitHub. Изменения применятся после сохранения.',
      moreActions: 'Другие действия', signIn: 'Войти через GitHub', accountUnavailable: 'Вход через GitHub пока не подключён.', close: 'Закрыть',
      pluginsDescription: 'Дополнения для интерфейса и функций GitHub.', officialPlugin: 'Официальный плагин',
      themeSort: 'Сортировка тем', sortRecommended: 'Рекомендуемые', sortName: 'По названию', themeFilters: 'Фильтры тем',
      filterAll: 'Все', filterLight: 'Светлые', filterDark: 'Тёмные',
      featured: 'Рекомендуем', featuredDescription: 'Тёмная тема с ярким зелёным акцентом.', chooseTheme: 'Выбрать тему',
      themeList: 'Доступные темы', themeSearch: 'Поиск темы', noThemes: 'Ничего не найдено.', themeHelp: 'Настроить цвета и источник оформления можно в дополнительном разделе.',
      customize: 'ПЕРСОНАЛИЗАЦИЯ', githubThemes: 'Темы GitHub', save: 'Сохранить настройки', languageLabel: 'Язык',
      advanced: 'Дополнительно', advancedDescription: 'Оформление из', advancedDescriptionEnd: 'можно применять на отдельных страницах.',
      modeLabel: 'Источник оформления', modeGlobal: 'Моя тема для всего GitHub', modeSite: 'Оформление страницы, если есть',
      paletteLegend: 'Цвета моей темы', accent: 'Акцент', base: 'Фон страницы', surface: 'Поверхности', text: 'Текст', muted: 'Вторичный текст', border: 'Границы',
      background: 'Фоновое изображение', effect: 'Эффект фонового изображения', effectNone: 'Нет', effectGradient: 'Мягкий градиент', effectGlow: 'Свечение',
      footer: 'Изображения загружаются только с GitHub. CSS и JavaScript из файлов оформления не выполняются.',
      paletteOriginal: 'Оригинальная тема использует цвета GitHub. Выбери другую карточку, чтобы настроить свою палитру.',
      paletteCustom: 'Измени цвета выбранной карточки под себя. Выбор другой карточки вернёт цвета её палитры.',
      selected: 'Тема выбрана — нажми «Сохранить настройки»', invalidImage: 'Нужен HTTPS-адрес изображения на GitHub.', saved: 'Настройки сохранены', saveFailed: 'Не удалось сохранить настройки. Попробуй ещё раз.',
      themes: { universe: ['GitHub Universe', 'Светлая'], 'universe-dark': ['GitHub Universe', 'Тёмная'], github: ['GitHub', 'Оригинальная'], midnight: ['Полночь', 'Тёмно-синяя'], amethyst: ['Аметист', 'Фиолетовая'], forest: ['Лес', 'Зелёная'], light: ['Светлая', 'Синий акцент'] }
    },
    en: {
      title: 'BetterGitHub Store', settingsSections: 'Store sections', themeNav: 'Themes', pluginsNav: 'Plugins', pluginsEmpty: 'No plugins yet.',
      themeHeading: 'Themes', themeDescription: 'Choose a GitHub theme. Changes apply after you save.',
      moreActions: 'More actions', signIn: 'Sign in with GitHub', accountUnavailable: 'GitHub sign-in is not connected yet.', close: 'Close',
      pluginsDescription: 'Add-ons for the GitHub interface and features.', officialPlugin: 'Official plugin',
      themeSort: 'Sort themes', sortRecommended: 'Recommended', sortName: 'By name', themeFilters: 'Filter themes',
      filterAll: 'All', filterLight: 'Light', filterDark: 'Dark',
      featured: 'Recommended', featuredDescription: 'A dark theme with a bright green accent.', chooseTheme: 'Choose theme',
      themeList: 'Available themes', themeSearch: 'Search themes', noThemes: 'No themes found.', themeHelp: 'Customize colors and appearance source in Advanced.',
      customize: 'PERSONALIZATION', githubThemes: 'GitHub themes', save: 'Save settings', languageLabel: 'Language',
      advanced: 'Advanced', advancedDescription: 'Appearance from', advancedDescriptionEnd: 'can apply to individual pages.',
      modeLabel: 'Appearance source', modeGlobal: 'My theme for all of GitHub', modeSite: 'Page appearance, when available',
      paletteLegend: 'My theme colors', accent: 'Accent', base: 'Page background', surface: 'Surfaces', text: 'Text', muted: 'Secondary text', border: 'Borders',
      background: 'Background image', effect: 'Background image effect', effectNone: 'None', effectGradient: 'Soft gradient', effectGlow: 'Glow',
      footer: 'Images load only from GitHub. CSS and JavaScript from appearance files are not run.',
      paletteOriginal: 'The original theme uses GitHub colors. Choose another card to customize its palette.',
      paletteCustom: 'Adjust the selected card’s colors. Choosing another card restores its palette.',
      selected: 'Theme selected — click “Save settings”', invalidImage: 'Use an HTTPS image URL from GitHub.', saved: 'Settings saved', saveFailed: 'Could not save settings. Try again.',
      themes: { universe: ['GitHub Universe', 'Light'], 'universe-dark': ['GitHub Universe', 'Dark'], github: ['GitHub', 'Original'], midnight: ['Midnight', 'Dark blue'], amethyst: ['Amethyst', 'Purple'], forest: ['Forest', 'Green'], light: ['Light', 'Blue accent'] }
    }
  };
  let language = 'ru';
  let statusKey = '';
  let themeChosen = false;
  function setStatus(key) {
    statusKey = key;
    status.textContent = key ? translations[language][key] : '';
    status.classList.toggle('is-error', key === 'saveFailed' || key === 'invalidImage');
  }
  function renderLanguage() {
    const strings = translations[language];
    document.documentElement.lang = language;
    document.title = strings.title;
    for (const element of document.querySelectorAll('[data-i18n]')) element.textContent = strings[element.dataset.i18n];
    for (const element of document.querySelectorAll('[data-i18n-aria]')) {
      const label = strings[element.dataset.i18nAria];
      element.setAttribute('aria-label', label);
      if (element.classList.contains('rail-button')) element.title = label;
    }
    for (const element of document.querySelectorAll('[data-i18n-placeholder]')) element.setAttribute('placeholder', strings[element.dataset.i18nPlaceholder]);
    for (const card of gallery.querySelectorAll('.theme-card')) {
      const [name, description] = strings.themes[card.querySelector('input').value];
      card.querySelector('strong').textContent = name;
      card.querySelector('small').textContent = description;
    }
    paletteHint.textContent = strings[paletteFields.disabled ? 'paletteOriginal' : 'paletteCustom'];
    sortThemes();
    renderPlugins();
    if (statusKey) setStatus(statusKey);
  }
  const themeSearch = document.getElementById('theme-search');
  const themeSort = document.getElementById('theme-sort');
  const themeCount = document.getElementById('theme-count');
  const themeEmpty = document.getElementById('theme-empty');
  const featured = document.getElementById('featured');
  const themeCards = [...gallery.querySelectorAll('.theme-card')];
  const filterButtons = [...document.querySelectorAll('[data-filter]')];
  let tone = 'all';

  function filterThemes() {
    const query = themeSearch.value.trim().toLocaleLowerCase(language);
    let visible = 0;
    for (const card of themeCards) {
      const labels = translations[language].themes[card.querySelector('input').value];
      card.hidden = (tone !== 'all' && tone !== card.dataset.tone) ||
        !labels.join(' ').toLocaleLowerCase(language).includes(query);
      if (!card.hidden) visible++;
    }
    themeCount.textContent = visible;
    themeEmpty.hidden = visible !== 0;
    featured.hidden = Boolean(query) || tone !== 'all';
  }

  function sortThemes() {
    const cards = themeSort.value === 'name' ? [...themeCards].sort((a, b) =>
      a.querySelector('strong').textContent.localeCompare(b.querySelector('strong').textContent, language)
    ) : themeCards;
    gallery.append(...cards);
    filterThemes();
  }

  // Only bundled entries can mark a plugin as official. User page configs cannot grant the badge.
  const bundledPlugins = [];
  function renderPlugins() {
    const list = document.getElementById('plugin-gallery');
    list.replaceChildren();
    for (const plugin of bundledPlugins) {
      const card = document.createElement('article');
      card.className = 'plugin-card';
      const title = document.createElement('h3');
      title.textContent = plugin.name;
      if (plugin.official === true) {
        const badge = document.createElement('span');
        badge.className = 'official-badge';
        badge.setAttribute('role', 'img');
        badge.setAttribute('aria-label', translations[language].officialPlugin);
        badge.title = translations[language].officialPlugin;
        badge.textContent = '✓';
        title.append(badge);
      }
      if (plugin.preview) {
        const preview = document.createElement('img');
        preview.src = plugin.preview;
        preview.alt = '';
        card.append(preview);
      }
      const description = document.createElement('p');
      description.textContent = plugin.description[language];
      card.append(title, description);
      list.append(card);
    }
    list.hidden = bundledPlugins.length === 0;
    document.getElementById('plugin-empty').hidden = !list.hidden;
  }

  const palettes = {
    github: { base: '#0d1117', surface: '#161b22', text: '#f0f6fc', muted: '#8b949e', border: '#30363d', accent: '#0969da' },
    universe: { base: '#e9edec', surface: '#f3f6f5', text: '#050807', muted: '#4c5b58', border: '#d3dcd9', accent: '#008b2b' },
    'universe-dark': { base: '#090d0b', surface: '#111a15', text: '#f0f7f2', muted: '#a6baa9', border: '#2c4032', accent: '#00c943' },
    midnight: { base: '#0b1020', surface: '#141b30', text: '#e7ecfa', muted: '#a4b0ca', border: '#34415b', accent: '#79a9ff' },
    amethyst: { base: '#130e1d', surface: '#20172d', text: '#f4eaff', muted: '#bdaacb', border: '#49375e', accent: '#c68cff' },
    forest: { base: '#0c1714', surface: '#152720', text: '#e7f4ec', muted: '#acc5b5', border: '#345846', accent: '#7ad7a0' },
    light: { base: '#f6f8fc', surface: '#ffffff', text: '#182236', muted: '#5b6980', border: '#d5deec', accent: '#335fc7' }
  };
  const colorKeys = ['base', 'surface', 'text', 'muted', 'border', 'accent'];
  const validColor = value => /^#[\da-f]{6}$/i.test(value || '');
  function setPalette(theme, overrides = {}) {
    for (const key of colorKeys) form.elements[key].value = validColor(overrides[key]) ? overrides[key] : palettes[theme][key];
    paletteFields.disabled = theme === 'github';
    paletteHint.textContent = translations[language][theme === 'github' ? 'paletteOriginal' : 'paletteCustom'];
  }
  const get = () => new Promise(resolve => chrome.storage.local.get('settings', data => resolve(data?.settings || {})));
  const set = settings => new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set({ settings }, () => {
        const error = chrome.runtime?.lastError;
        if (error) reject(new Error(error.message || 'Storage write failed'));
        else resolve();
      });
    } catch (error) { reject(error); }
  });
  const validImage = value => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password &&
        (url.hostname === 'github.com' || url.hostname === 'raw.githubusercontent.com' || url.hostname.endsWith('.githubusercontent.com'));
    } catch { return false; }
  };

  async function load() {
    const settings = { ...defaultSettings, ...await get() };
    form.elements.theme.value = Object.hasOwn(palettes, settings.theme) ? settings.theme : 'github';
    form.elements.mode.value = settings.mode === 'global' ? 'global' : 'site';
    language = settings.language === 'en' ? 'en' : 'ru';
    form.elements.language.value = language;
    setPalette(form.elements.theme.value, settings.global);
    form.elements.background.value = settings.global?.background || '';
    form.elements.effect.value = settings.global?.effect || 'none';
    renderLanguage();
  }

  form.elements.language.addEventListener('change', async () => {
    const previousLanguage = language;
    language = form.elements.language.value === 'en' ? 'en' : 'ru';
    renderLanguage();
    try {
      const previous = await get();
      await set({ ...previous, language });
    } catch {
      language = previousLanguage;
      form.elements.language.value = language;
      renderLanguage();
      setStatus('saveFailed');
    }
  });

  const headerMenu = document.getElementById('header-menu');
  const menuToggle = headerMenu.querySelector('summary');
  const panelButtons = [...document.querySelectorAll('[data-panel]')];
  for (const button of panelButtons) button.addEventListener('click', () => {
    for (const item of panelButtons) {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
      document.getElementById(item.dataset.panel + '-panel').hidden = !active;
    }
    if (headerMenu.open) {
      headerMenu.open = false;
      document.querySelector('#advanced-heading').focus();
    }
  });
  if (location.hash === '#advanced') document.querySelector('[data-panel="advanced"]').click();
  document.addEventListener('click', event => {
    if (!headerMenu.contains(event.target)) headerMenu.open = false;
  });
  headerMenu.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !headerMenu.open) return;
    headerMenu.open = false;
    menuToggle.focus();
  });
  const accountDialog = document.getElementById('account-dialog');
  document.getElementById('open-account').addEventListener('click', () => {
    headerMenu.open = false;
    menuToggle.focus();
    accountDialog.showModal();
  });
  themeSearch.addEventListener('input', filterThemes);
  themeSort.addEventListener('change', sortThemes);
  for (const button of filterButtons) button.addEventListener('click', () => {
    tone = button.dataset.filter;
    for (const item of filterButtons) item.setAttribute('aria-pressed', String(item === button));
    filterThemes();
  });
  function chooseTheme(radio) {
    radio.checked = true;
    themeChosen = true;
    form.elements.mode.value = 'global';
    setPalette(radio.value);
    setStatus('selected');
  }
  document.getElementById('choose-featured').addEventListener('click', () => {
    chooseTheme(gallery.querySelector('input[value="universe-dark"]'));
  });
  gallery.addEventListener('change', event => {
    const radio = event.target;
    if (radio instanceof HTMLInputElement && radio.name === 'theme' && Object.hasOwn(palettes, radio.value)) chooseTheme(radio);
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const background = form.elements.background.value.trim();
    if (!validImage(background)) { setStatus('invalidImage'); return; }
    try {
      const previous = await get();
      const settings = {
        ...defaultSettings, ...previous,
        mode: form.elements.mode.value,
        theme: form.elements.theme.value,
        language,
        global: {
          ...(previous.global || {}),
          ...Object.fromEntries(colorKeys.map(key => [key, form.elements[key].value])),
          background, effect: form.elements.effect.value
        }
      };
      if (themeChosen) {
        const history = Array.isArray(previous.recentThemes) ? previous.recentThemes : [];
        const prior = previous.theme === 'github' && !history.includes('github') ? null : previous.theme;
        settings.recentThemes = [...new Set([settings.theme, prior, ...history]
          .filter(theme => Object.hasOwn(palettes, theme)))].slice(0, 2);
        settings.themeDisabled = false;
      }
      delete settings.gearAction;
      await set(settings);
      themeChosen = false;
      setStatus('saved');
    } catch { setStatus('saveFailed'); }
  });
  load();
})();
