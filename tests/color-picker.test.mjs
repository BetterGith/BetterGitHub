import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const script = readFileSync(new URL('../color-picker.js', import.meta.url), 'utf8');

test('custom color editor keeps a valid HEX value in the page form', () => {
  const dom = new JSDOM('<dialog><form id="bgh-form"><fieldset><label>Акцент<input type="color" name="accent" value="#c68cff"></label></fieldset></form></dialog>', { runScripts: 'outside-only', url: 'https://github.com/Example' });
  const { window } = dom;
  window.eval(script);
  const dialog = window.document.querySelector('dialog');
  window.BGHColorPicker.attach(dialog);
  window.BGHColorPicker.attach(dialog);
  const source = dialog.querySelector('[name="accent"]');
  const swatch = dialog.querySelector('.bgh-color-swatch');
  assert.equal(source.type, 'hidden');
  assert.equal(dialog.querySelectorAll('.bgh-color-swatch').length, 1);
  swatch.click();
  const input = window.document.querySelector('.bgh-color-hex input');
  input.value = '#123abc';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(new window.FormData(dialog.querySelector('form')).get('accent'), '#123abc');
  assert.equal(swatch.style.getPropertyValue('--bgh-swatch'), '#123abc');
  window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(window.document.querySelector('.bgh-color-popover'), null);
  dom.window.close();
});
