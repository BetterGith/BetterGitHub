import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../popup.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../popup.js', import.meta.url), 'utf8');

for (const language of ['ru', 'en']) {
  test(`popup uses ${language} from saved settings`, () => {
    const dom = new JSDOM(html, { url: 'https://extension.example/popup.html', runScripts: 'outside-only' });
    const { window } = dom;
    let opened = false;
    window.chrome = {
      runtime: { openOptionsPage: () => { opened = true; } },
      storage: { local: { get: (_, callback) => callback({ settings: { language } }) } }
    };
    window.eval(script);
    assert.equal(window.document.documentElement.lang, language);
    assert.equal(window.document.getElementById('open').textContent, language === 'en' ? 'Open settings' : 'Открыть настройки');
    window.document.getElementById('open').click();
    assert.equal(opened, true);
    dom.window.close();
  });
}
