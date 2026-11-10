(() => {
  'use strict';

  const quickThemes = document.getElementById('quick-themes');
  const themeScope = document.getElementById('theme-scope');
  const status = document.getElementById('popup-status');
  const strings = {
    ru: {
      store: 'Магазин BetterGitHub', catalog: 'Темы и плагины', theme: 'Тема',
      off: 'Выключить тему', advanced: 'Дополнительно',
      themes: { light: 'Светлая', midnight: 'Полночь', github: 'GitHub', universe: 'Universe · светлая', 'universe-dark': 'Universe · тёмная', amethyst: 'Аметист', forest: 'Лес' },
      scope: 'Оформление страниц', global: 'Моя тема везде', site: 'Тема автора страницы',
      plugins: 'Плагины', noPlugins: 'Плагинов пока нет.',
      siteHint: 'Если автор не задал тему, используется оформление GitHub.',
      globalHint: 'Выбранная тема применяется ко всем страницам GitHub.',
      offHint: 'Оформление BetterGitHub выключено.',
      failed: 'Не удалось сохранить настройки.',
    },
    en: {
      store: 'BetterGitHub Store', catalog: 'Themes and plugins', theme: 'Theme',
      off: 'Turn theme off', advanced: 'Advanced',
      themes: { light: 'Light', midnight: 'Midnight', github: 'GitHub', universe: 'Universe · light', 'universe-dark': 'Universe · dark', amethyst: 'Amethyst', forest: 'Forest' },
      scope: 'Page appearance', global: 'My theme everywhere', site: 'Page author’s theme',
      plugins: 'Plugins', noPlugins: 'No plugins yet.',
      siteHint: 'Pages without an author theme use GitHub’s appearance.',
      globalHint: 'The selected theme applies to every GitHub page.',
      offHint: 'BetterGitHub theming is off.',
      failed: 'Could not save settings.',
    },
  };
  const colorKeys = ['base', 'surface', 'text', 'muted', 'border', 'accent'];
  let savedSettings = {};
  let labels = strings.ru;

  function recentThemes(settings, fallback = []) {
    const history = Array.isArray(settings.recentThemes) ? settings.recentThemes : [];
    const current = settings.theme === 'github' && !history.includes('github') ? null : settings.theme;
    return [...new Set([current, ...history, ...fallback].filter(theme => Object.hasOwn(labels.themes, theme)))].slice(0, 2);
  }

  function renderSelection(settings = {}) {
    savedSettings = settings;
    const mode = settings.mode === 'global' ? 'global' : 'site';
    const selected = settings.themeDisabled === true ? 'off' : settings.theme;
    const recent = recentThemes(settings, ['light', 'midnight']);
    quickThemes.querySelectorAll('.recent-theme').forEach((card, index) => {
      const theme = recent[index];
      card.querySelector('input').value = theme;
      card.querySelector('.theme-preview').dataset.previewTheme = theme;
      card.querySelector('.choice-name').textContent = labels.themes[theme];
    });
    for (const input of quickThemes.querySelectorAll('input')) input.checked = input.value === selected;
    for (const input of themeScope.querySelectorAll('input')) input.checked = input.value === mode;
    status.textContent = labels[selected === 'off' ? 'offHint' : mode === 'site' ? 'siteHint' : 'globalHint'];
    status.classList.remove('is-error');
  }

  chrome.storage.local.get('settings', ({ settings } = {}) => {
    if (chrome.runtime.lastError) {
      status.textContent = labels.failed;
      status.classList.add('is-error');
      return;
    }
    const language = settings?.language === 'en' ? 'en' : 'ru';
    labels = strings[language];
    document.documentElement.lang = language;
    for (const node of document.querySelectorAll('[data-text]')) node.textContent = labels[node.dataset.text];
    for (const node of document.querySelectorAll('[data-label]')) node.setAttribute('aria-label', labels[node.dataset.label]);
    renderSelection(settings);
    quickThemes.disabled = false;
    themeScope.disabled = false;
  });

  function saveSettings(update) {
    if (quickThemes.disabled) return;
    quickThemes.disabled = themeScope.disabled = true;
    chrome.storage.local.get('settings', ({ settings = {} } = {}) => {
      if (chrome.runtime.lastError) return finish();
      const next = update(settings);
      chrome.storage.local.set({ settings: next }, () => {
        finish(chrome.runtime.lastError ? undefined : next);
      });
    });

    function finish(settings) {
      renderSelection(settings ?? savedSettings);
      quickThemes.disabled = themeScope.disabled = false;
      if (!settings) {
        status.textContent = labels.failed;
        status.classList.add('is-error');
      }
    }
  }

  quickThemes.addEventListener('change', event => {
    const theme = event.target.value;
    if (theme === 'off') {
      saveSettings(settings => ({ ...settings, themeDisabled: true }));
      return;
    }
    if (!Object.hasOwn(labels.themes, theme)) return;
    saveSettings(settings => {
      const global = { ...settings.global };
      if (settings.theme !== theme) for (const key of colorKeys) delete global[key];
      const recent = [theme, ...recentThemes(settings).filter(id => id !== theme)].slice(0, 2);
      return { ...settings, mode: settings.mode === 'global' ? 'global' : 'site', theme, themeDisabled: false, recentThemes: recent, global };
    });
  });

  themeScope.addEventListener('change', event => {
    const mode = event.target.value;
    if (mode !== 'site' && mode !== 'global') return;
    saveSettings(settings => ({ ...settings, theme: settings.theme || 'github', mode }));
  });
})();
