# Проверка расширения

## Быстрые проверки

```powershell
npm test
npm run lint:extension
```

Первое проверяет логику, второе — собранный Firefox-аддон через Mozilla web-ext.

## Проверка установленного аддона

```powershell
npm run test:firefox
```

Команда сначала собирает `dist/firefox`, затем Selenium/geckodriver запускает отдельный Firefox с временным профилем и устанавливает аддон. Тест открывает popup из панели браузера и сохраняет `test-results/firefox-popup.png`. Затем он проверяет быстрый выбор темы через настоящее `chrome.storage` и открытие магазина в новой вкладке. Снимок магазина сохраняется в `test-results/firefox-store.png`.

Для наблюдения за тестом: `$env:BGH_HEADED='1'` перед запуском. Путь к другому Firefox можно задать через `FIREFOX_BINARY`.

Тесту требуется управление интерфейсом отдельного Firefox (`geckodriver --allow-system-access`). WebDriver BiDi и порт `--remote-debugging-port` не включены. Не отключайте защиту антивируса ради теста; если она блокирует запуск, сохраните название события для диагностики.

## Разработка с автоматическим обновлением

```powershell
npm run dev:firefox
```

Запускает Mozilla web-ext с временным профилем. Изменения HTML, CSS, JS, манифеста, шрифтов и иконок автоматически копируются в сборку, после чего web-ext перезагружает аддон. Уже открытую страницу GitHub после изменения content script следует обновить. Выход — Ctrl+C.

web-ext использует отладочный интерфейс Firefox для загрузки и обновления аддона. Защитное ПО может блокировать этот режим. Пользовательский профиль Firefox не используется.

## Ручная установка через about:debugging

Если аддон загружен вручную из `dist/firefox/manifest.json`, после изменения исходников:

1. Выполнить `npm run build:firefox`.
2. Нажать «Перезагрузить» у BetterGitHub в `about:debugging`.
3. Закрыть и снова открыть popup. Для content script также обновить вкладку GitHub.

Одна перезагрузка аддона без сборки не копирует изменения из корня проекта в `dist/firefox`.

Инструменты: https://github.com/mozilla/web-ext, https://github.com/SeleniumHQ/selenium, https://github.com/mozilla/geckodriver.
