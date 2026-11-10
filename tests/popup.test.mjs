import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const browser of ['chromium', 'firefox']) {
  test(`${browser} routes the toolbar popup and store to separate pages`, () => {
    const manifest = JSON.parse(readFileSync(new URL(`../manifest.${browser}.json`, import.meta.url), 'utf8'));
    assert.equal(manifest.action.default_popup, 'popup.html');
    assert.deepEqual(manifest.options_ui, { page: 'options.html', open_in_tab: true });
    assert.match(readFileSync(new URL('../popup.html', import.meta.url), 'utf8'), /id="open-store" href="options.html" target="_blank"/);
    assert.match(readFileSync(new URL('../options.html', import.meta.url), 'utf8'), /id="theme-gallery"/);
  });
}
