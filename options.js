(() => {
  'use strict';
  const form = document.getElementById('settings');
  const status = document.getElementById('status');
  const gallery = document.getElementById('theme-gallery');
  const paletteFields = document.getElementById('palette-fields');
  const paletteHint = document.getElementById('palette-hint');
  const pluginStatus = document.getElementById('plugin-status');
  const dimPlugin = form.elements.pluginDimLightThemes;
  const repoPlugin = form.elements.pluginRepositoryThemes;
  const pluginToggles = [...form.querySelectorAll('#plugins-panel input[role="switch"]')];
  const defaultSettings = { mode: 'site', theme: 'github', language: 'ru', global: {}, sites: {} };
  const translations = {
    ru: {
      title: 'BetterGitHub — магазин', settingsSections: 'Разделы магазина', themeNav: 'Темы', pluginsNav: 'Плагины',
      themeHeading: 'Темы оформления', themeDescription: 'Выбери тему для GitHub. Изменения сохраняются и применяются сразу.',
      moreActions: 'Другие действия', signIn: 'Войти через GitHub', accountUnavailable: 'Вход через GitHub пока не подключён.', close: 'Закрыть',
      pluginsDescription: 'Дополнения для интерфейса и функций GitHub.', officialPlugin: 'Официальный плагин',
      themeSort: 'Сортировка тем', sortRecommended: 'Рекомендуемые', sortName: 'По названию', themeFilters: 'Фильтры тем',
      filterAll: 'Все', filterLight: 'Светлые', filterDark: 'Тёмные',
      featured: 'Рекомендуем', featuredDescription: 'Тёмная тема с ярким зелёным акцентом.', chooseTheme: 'Выбрать тему',
      themeList: 'Доступные темы', themeSearch: 'Поиск темы', noThemes: 'Ничего не найдено.', themeHelp: 'Настроить цвета и источник оформления можно в дополнительном разделе.',
      customize: 'ПЕРСОНАЛИЗАЦИЯ', githubThemes: 'Темы GitHub', languageLabel: 'Язык',
      advanced: 'Дополнительно', advancedDescription: 'Оформление из', advancedDescriptionEnd: 'можно применять на отдельных страницах.',
      dimLightThemes: 'Приглушение светлых тем', dimPluginDescription: 'Снижает яркость фона и карточек светлых тем, сохраняя цвет текста.',
      repoThemePlugin: 'Создание тем для репозиториев', repoPluginDescription: 'Добавляет редактор оформления в настройки блока About для тех, кто может их редактировать.',
      commandPalette: 'Command Palette', commandPaletteDescription: 'Общий центр команд плагинов, пользовательских действий и последних команд.',
      quickNavigation: 'Page Navigator', quickNavigationDescription: 'Заголовки README, комментарии и изменённые файлы PR на текущей странице.',
      repositorySwitcher: 'Repository Switcher', repositorySwitcherDescription: 'Закреплённые и недавние репозитории, сгруппированные по владельцу. Данные остаются локально.',
      quickActions: 'Quick Actions', quickActionsDescription: 'Контекстное меню: ссылки, permalink файла, github.dev, коммиты и сравнение веток.',
      modeLabel: 'Оформление страниц', modeGlobal: 'Моя тема', modeSite: 'Темы авторов',
      paletteLegend: 'Цвета моей темы', accent: 'Акцент', base: 'Фон страницы', surface: 'Поверхности', text: 'Текст', muted: 'Вторичный текст', border: 'Границы',
      background: 'Фоновое изображение', effect: 'Эффект фонового изображения', effectNone: 'Нет', effectGradient: 'Мягкий градиент', effectGlow: 'Свечение',
      footer: 'Изображения загружаются только с GitHub. CSS и JavaScript из файлов оформления не выполняются.',
      paletteOriginal: 'Оригинальная тема использует цвета GitHub. Выбери другую карточку, чтобы настроить свою палитру.',
      paletteCustom: 'Измени цвета выбранной карточки под себя. Выбор другой карточки вернёт цвета её палитры.',
      saving: 'Сохранение…', invalidImage: 'Нужен HTTPS-адрес изображения на GitHub.', saved: 'Настройки сохранены', saveFailed: 'Не удалось сохранить настройки. Попробуй ещё раз.',
      themes: { compact: ['Compact UI', 'Тёмная · компактный интерфейс'], 'compact-light': ['Compact UI', 'Светлая · компактный интерфейс'], 'rounded-light': ['Округлая', 'Мягкие светлые карточки'], rounded: ['Округлая', 'Мягкие тёмные карточки'], universe: ['GitHub Universe', 'Светлая'], 'universe-dark': ['GitHub Universe', 'Тёмная'], github: ['GitHub', 'Оригинальная'], midnight: ['Полночь', 'Тёмно-синяя'], amethyst: ['Аметист', 'Фиолетовая'], forest: ['Лес', 'Зелёная'], light: ['Светлая', 'Синий акцент'] }
    },
    en: {
      title: 'BetterGitHub Store', settingsSections: 'Store sections', themeNav: 'Themes', pluginsNav: 'Plugins',
      themeHeading: 'Themes', themeDescription: 'Choose a GitHub theme. Changes save and apply immediately.',
      moreActions: 'More actions', signIn: 'Sign in with GitHub', accountUnavailable: 'GitHub sign-in is not connected yet.', close: 'Close',
      pluginsDescription: 'Add-ons for the GitHub interface and features.', officialPlugin: 'Official plugin',
      themeSort: 'Sort themes', sortRecommended: 'Recommended', sortName: 'By name', themeFilters: 'Filter themes',
      filterAll: 'All', filterLight: 'Light', filterDark: 'Dark',
      featured: 'Recommended', featuredDescription: 'A dark theme with a bright green accent.', chooseTheme: 'Choose theme',
      themeList: 'Available themes', themeSearch: 'Search themes', noThemes: 'No themes found.', themeHelp: 'Customize colors and appearance source in Advanced.',
      customize: 'PERSONALIZATION', githubThemes: 'GitHub themes', languageLabel: 'Language',
      advanced: 'Advanced', advancedDescription: 'Appearance from', advancedDescriptionEnd: 'can apply to individual pages.',
      dimLightThemes: 'Soften light themes', dimPluginDescription: 'Dims backgrounds and cards in light themes while preserving the text color.',
      repoThemePlugin: 'Repository theme editor', repoPluginDescription: 'Adds a theme editor to the About settings for people who can edit repository details.',
      commandPalette: 'Command Palette', commandPaletteDescription: 'One command hub for plugins, custom actions and recently used commands.',
      quickNavigation: 'Page Navigator', quickNavigationDescription: 'Navigate README headings, comments and changed PR files on the current page.',
      repositorySwitcher: 'Repository Switcher', repositorySwitcherDescription: 'Pinned and recent repositories grouped by owner. Your lists stay local.',
      quickActions: 'Quick Actions', quickActionsDescription: 'Context menu for links, file permalinks, github.dev, commits and branch comparison.',
      modeLabel: 'Page appearance', modeGlobal: 'My theme', modeSite: 'Author themes',
      paletteLegend: 'My theme colors', accent: 'Accent', base: 'Page background', surface: 'Surfaces', text: 'Text', muted: 'Secondary text', border: 'Borders',
      background: 'Background image', effect: 'Background image effect', effectNone: 'None', effectGradient: 'Soft gradient', effectGlow: 'Glow',
      footer: 'Images load only from GitHub. CSS and JavaScript from appearance files are not run.',
      paletteOriginal: 'The original theme uses GitHub colors. Choose another card to customize its palette.',
      paletteCustom: 'Adjust the selected card’s colors. Choosing another card restores its palette.',
      saving: 'Saving…', invalidImage: 'Use an HTTPS image URL from GitHub.', saved: 'Settings saved', saveFailed: 'Could not save settings. Try again.',
      themes: { compact: ['Compact UI', 'Dark · compact interface'], 'compact-light': ['Compact UI', 'Light · compact interface'], 'rounded-light': ['Rounded', 'Soft light cards'], rounded: ['Rounded', 'Soft dark cards'], universe: ['GitHub Universe', 'Light'], 'universe-dark': ['GitHub Universe', 'Dark'], github: ['GitHub', 'Original'], midnight: ['Midnight', 'Dark blue'], amethyst: ['Amethyst', 'Purple'], forest: ['Forest', 'Green'], light: ['Light', 'Blue accent'] }
    }
  };
  let language = 'ru';
  let statusKey = '';
  let saveQueue = Promise.resolve();
  let saveRevision = 0;
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
    if (pluginStatus.textContent) pluginStatus.textContent = strings.saveFailed;
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

  const palettes = {
    'compact-light': { base: '#ffffff', surface: '#f6f8fa', text: '#1f2328', muted: '#59636e', border: '#d1d9e0', accent: '#0969da' },
    compact: { base: '#0d1117', surface: '#161b22', text: '#f0f6fc', muted: '#8b949e', border: '#30363d', accent: '#0969da' },
    'rounded-light': { base: '#f3f3f6', surface: '#ffffff', text: '#202127', muted: '#626570', border: '#dcdde5', accent: '#19724e' },
    rounded: { base: '#101012', surface: '#1b1b20', text: '#f2f2f5', muted: '#aaaab8', border: '#34343e', accent: '#91e2bd' },
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
    paletteFields.disabled = theme === 'github' || theme === 'compact' || theme === 'compact-light';
    paletteHint.textContent = translations[language][paletteFields.disabled ? 'paletteOriginal' : 'paletteCustom'];
  }
  const get = () => new Promise((resolve, reject) => chrome.storage.local.get('settings', data => {
    const error = chrome.runtime?.lastError;
    if (error) reject(new Error(error.message || 'Storage read failed'));
    else resolve(data?.settings || {});
  }));
  const writeStorage = values => new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set(values, () => {
        const error = chrome.runtime?.lastError;
        if (error) reject(new Error(error.message || 'Storage write failed'));
        else resolve();
      });
    } catch (error) { reject(error); }
  });
  const set = settings => writeStorage({ settings });
  function saveUpdate(update) {
    const revision = ++saveRevision;
    setStatus('saving');
    // Serialize read/modify/write operations so a slower earlier choice cannot overwrite the latest one.
    saveQueue = saveQueue.catch(() => {}).then(async () => {
      const previous = await get();
      const next = update({ ...defaultSettings, ...previous });
      delete next.gearAction;
      await set(next);
    });
    return saveQueue.then(() => {
      if (revision === saveRevision) setStatus('saved');
    }, () => {
      if (revision === saveRevision) setStatus('saveFailed');
    });
  }
  const validImage = value => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password &&
        (url.hostname === 'github.com' || url.hostname === 'raw.githubusercontent.com' || url.hostname.endsWith('.githubusercontent.com'));
    } catch { return false; }
  };

  async function load() {
    const data = await new Promise(resolve => chrome.storage.local.get(
      ['settings', ...pluginToggles.map(toggle => toggle.name)], resolve));
    const settings = { ...defaultSettings, ...data?.settings };
    form.elements.theme.value = Object.hasOwn(palettes, settings.theme) ? settings.theme : 'github';
    form.elements.mode.value = settings.mode === 'global' ? 'global' : 'site';
    dimPlugin.checked = (data?.[dimPlugin.name] ?? settings.dimLightThemes) === true;
    repoPlugin.checked = data?.[repoPlugin.name] !== false;
    for (const toggle of pluginToggles) {
      if (toggle !== dimPlugin && toggle !== repoPlugin) toggle.checked = data?.[toggle.name] === true;
      toggle.disabled = false;
    }
    language = settings.language === 'en' ? 'en' : 'ru';
    form.elements.language.value = language;
    setPalette(form.elements.theme.value, settings.global);
    form.elements.background.value = settings.global?.background || '';
    form.elements.effect.value = settings.global?.effect || 'none';
    renderLanguage();
  }

  for (const toggle of pluginToggles) {
    toggle.addEventListener('change', async () => {
      const checked = toggle.checked;
      toggle.disabled = true;
      pluginStatus.textContent = '';
      try {
        await writeStorage({ [toggle.name]: checked });
      } catch {
        toggle.checked = !checked;
        pluginStatus.textContent = translations[language].saveFailed;
      } finally {
        toggle.disabled = false;
      }
    });
  }

  form.elements.language.addEventListener('change', () => {
    language = form.elements.language.value === 'en' ? 'en' : 'ru';
    renderLanguage();
    const selectedLanguage = language;
    saveUpdate(previous => ({ ...previous, language: selectedLanguage }));
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
    history.replaceState(null, '', `#${button.dataset.panel}`);
    if (headerMenu.open) {
      headerMenu.open = false;
      document.querySelector('#advanced-heading').focus();
    }
  });
  const initialPanel = location.hash.slice(1);
  panelButtons.find(button => button.dataset.panel === initialPanel)?.click();
  addEventListener('hashchange', () => panelButtons.find(button => button.dataset.panel === location.hash.slice(1))?.click());
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
    form.elements.mode.value = 'global';
    setPalette(radio.value);
    const theme = radio.value;
    const colors = Object.fromEntries(colorKeys.map(key => [key, form.elements[key].value]));
    saveUpdate(previous => {
      const history = Array.isArray(previous.recentThemes) ? previous.recentThemes : [];
      const prior = previous.theme === 'github' && !history.includes('github') ? null : previous.theme;
      return {
        ...previous, mode: 'global', theme, themeDisabled: false,
        global: { ...previous.global, ...colors },
        recentThemes: [...new Set([theme, prior, ...history]
          .filter(id => Object.hasOwn(palettes, id)))].slice(0, 2)
      };
    });
  }
  document.getElementById('choose-featured').addEventListener('click', () => {
    chooseTheme(gallery.querySelector('input[value="universe-dark"]'));
  });
  gallery.addEventListener('change', event => {
    const radio = event.target;
    if (radio instanceof HTMLInputElement && radio.name === 'theme' && Object.hasOwn(palettes, radio.value)) chooseTheme(radio);
  });

  for (const key of [...colorKeys, 'background', 'effect']) {
    const input = form.elements[key];
    const save = () => {
      const value = input.value.trim();
      if (key === 'background' && !validImage(value)) {
        ++saveRevision;
        setStatus('invalidImage');
        return;
      }
      saveUpdate(previous => ({ ...previous, global: { ...previous.global, [key]: value } }));
    };
    input.addEventListener('change', save);
    if (input.type === 'color') input.addEventListener('input', save);
  }
  for (const radio of form.querySelectorAll('[name="mode"]')) radio.addEventListener('change', () => {
    const mode = form.elements.mode.value;
    saveUpdate(previous => ({ ...previous, mode }));
  });
  form.addEventListener('submit', event => event.preventDefault());
  load().catch(() => setStatus('saveFailed'));
})();
