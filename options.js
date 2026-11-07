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
      title: 'BetterGitHub — темы и настройки', eyebrow: 'Оформление GitHub', languageLabel: 'Язык', themeHeading: 'Выбери тему',
      themeDescription: 'Выбери карточку и сохрани настройки, чтобы применить тему ко всему GitHub.', galleryControls: 'Прокрутка тем',
      previousThemes: 'Предыдущие темы', nextThemes: 'Следующие темы', githubThemes: 'Темы GitHub', save: 'Сохранить настройки',
      advanced: 'Дополнительные настройки', advancedDescription: 'Можно использовать оформление из', advancedDescriptionEnd: 'на отдельных страницах или настроить личную тему для всего GitHub.',
      modeLabel: 'Источник оформления', modeGlobal: 'Моя тема для всего GitHub', modeSite: 'Оформление страницы, если есть',
      paletteLegend: 'Цвета моей темы', accent: 'Акцент', base: 'Фон страницы', surface: 'Поверхности', text: 'Текст', muted: 'Вторичный текст', border: 'Границы',
      background: 'Фоновое изображение', effect: 'Эффект фонового изображения', effectNone: 'Нет', effectGradient: 'Мягкий градиент', effectGlow: 'Свечение',
      footer: 'Изображения загружаются только с GitHub. CSS и JavaScript из файлов оформления не выполняются.',
      paletteOriginal: 'Оригинальная тема использует цвета GitHub. Выбери другую карточку, чтобы настроить свою палитру.',
      paletteCustom: 'Измени цвета выбранной карточки под себя. Выбор другой карточки вернёт цвета её палитры.',
      selected: 'Тема выбрана — нажми «Сохранить настройки»', invalidImage: 'Нужен HTTPS-адрес изображения на GitHub.', saved: 'Настройки сохранены',
      themes: { universe: ['GitHub Universe', 'Светлая'], 'universe-dark': ['GitHub Universe', 'Тёмная'], github: ['GitHub', 'Оригинальная'], midnight: ['Полночь', 'Тёмно-синяя'], amethyst: ['Аметист', 'Фиолетовая'], forest: ['Лес', 'Зелёная'], light: ['Светлая', 'Синий акцент'] }
    },
    en: {
      title: 'BetterGitHub — themes and settings', eyebrow: 'GitHub appearance', languageLabel: 'Language', themeHeading: 'Choose a theme',
      themeDescription: 'Choose a card and save your settings to apply the theme across GitHub.', galleryControls: 'Browse themes',
      previousThemes: 'Previous themes', nextThemes: 'Next themes', githubThemes: 'GitHub themes', save: 'Save settings',
      advanced: 'Advanced settings', advancedDescription: 'You can use the appearance from', advancedDescriptionEnd: 'on individual pages or set a personal theme for all of GitHub.',
      modeLabel: 'Appearance source', modeGlobal: 'My theme for all of GitHub', modeSite: 'Page appearance, when available',
      paletteLegend: 'My theme colors', accent: 'Accent', base: 'Page background', surface: 'Surfaces', text: 'Text', muted: 'Secondary text', border: 'Borders',
      background: 'Background image', effect: 'Background image effect', effectNone: 'None', effectGradient: 'Soft gradient', effectGlow: 'Glow',
      footer: 'Images load only from GitHub. CSS and JavaScript from appearance files are not run.',
      paletteOriginal: 'The original theme uses GitHub colors. Choose another card to customize its palette.',
      paletteCustom: 'Adjust the selected card’s colors. Choosing another card restores its palette.',
      selected: 'Theme selected — click “Save settings”', invalidImage: 'Use an HTTPS image URL from GitHub.', saved: 'Settings saved',
      themes: { universe: ['GitHub Universe', 'Light'], 'universe-dark': ['GitHub Universe', 'Dark'], github: ['GitHub', 'Original'], midnight: ['Midnight', 'Dark blue'], amethyst: ['Amethyst', 'Purple'], forest: ['Forest', 'Green'], light: ['Light', 'Blue accent'] }
    }
  };
  let language = 'ru';
  let statusKey = '';
  function setStatus(key) {
    statusKey = key;
    status.textContent = key ? translations[language][key] : '';
  }
  function renderLanguage() {
    const strings = translations[language];
    document.documentElement.lang = language;
    document.title = strings.title;
    for (const element of document.querySelectorAll('[data-i18n]')) element.textContent = strings[element.dataset.i18n];
    for (const element of document.querySelectorAll('[data-i18n-aria]')) element.setAttribute('aria-label', strings[element.dataset.i18nAria]);
    for (const card of gallery.querySelectorAll('.theme-card')) {
      const [name, description] = strings.themes[card.querySelector('input').value];
      card.querySelector('strong').textContent = name;
      card.querySelector('small').textContent = description;
    }
    paletteHint.textContent = strings[paletteFields.disabled ? 'paletteOriginal' : 'paletteCustom'];
    if (statusKey) setStatus(statusKey);
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
  const set = settings => new Promise(resolve => chrome.storage.local.set({ settings }, resolve));
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
    language = form.elements.language.value === 'en' ? 'en' : 'ru';
    renderLanguage();
    const previous = await get();
    await set({ ...previous, language });
  });

  gallery.addEventListener('change', event => {
    const radio = event.target;
    if (!(radio instanceof HTMLInputElement) || radio.name !== 'theme' || !Object.hasOwn(palettes, radio.value)) return;
    form.elements.mode.value = 'global';
    setPalette(radio.value);
    setStatus('selected');
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const background = form.elements.background.value.trim();
    if (!validImage(background)) { setStatus('invalidImage'); return; }
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
    delete settings.gearAction;
    await set(settings);
    setStatus('saved');
  });

  document.getElementById('themes-prev').addEventListener('click', () => gallery.scrollBy({ left: -gallery.clientWidth * .8, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  document.getElementById('themes-next').addEventListener('click', () => gallery.scrollBy({ left: gallery.clientWidth * .8, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  load();
})();
