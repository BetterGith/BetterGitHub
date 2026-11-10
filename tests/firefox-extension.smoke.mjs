import { Builder, By, Key, until } from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const options = new firefox.Options().setBinary(process.env.FIREFOX_BINARY || 'C:\\Program Files\\Mozilla Firefox\\firefox.exe');
if (!process.env.BGH_HEADED) options.addArguments('-headless');
const driver = await new Builder().forBrowser('firefox').setFirefoxOptions(options)
  .setFirefoxService(new firefox.ServiceBuilder().addArguments('--allow-system-access')).build();
try {
  await driver.manage().window().setRect({ width: 1100, height: 850 });
  const id = await driver.installAddon(resolve(root, 'dist/firefox'), true);
  await driver.get('about:blank');
  await driver.setContext(firefox.Context.CHROME);
  const widget = await driver.executeScript(`
    const CustomizableUI = window.CustomizableUI;
    const id = arguments[0].toLowerCase().replace(/[^a-z0-9_-]/g, '_') + '-browser-action';
    CustomizableUI.addWidgetToArea(id, CustomizableUI.AREA_NAVBAR);
    return id;
  `, id);
  await driver.wait(until.elementLocated(By.id(widget)), 10000);
  await driver.findElement(By.css('#' + widget + ' .unified-extensions-item-action-button')).click();
  const popup = await driver.wait(async () => {
    const nodes = await driver.findElements(By.css('browser[webextension-view-type="popup"]'));
    for (const node of nodes) {
      try {
        if (await node.isDisplayed() && (await node.getRect()).width >= 370 && await driver.executeScript("return arguments[0].currentURI.spec.endsWith('/popup.html')", node)) return node;
      } catch (error) { if (error.name !== 'StaleElementReferenceError') throw error; }
    }
    return false;
  }, 10000);
  await driver.wait(async () => (await popup.getRect()).width >= 370, 10000);
  const rect = await popup.getRect();
  assert.ok(rect.width >= 370 && rect.width <= 400, JSON.stringify(rect));
  assert.ok(rect.height >= 460 && rect.height <= 555, JSON.stringify(rect));
  mkdirSync(resolve(root, 'test-results'), { recursive: true });
  const snapshot = await driver.executeAsyncScript(`
    const popup = arguments[0], done = arguments[arguments.length - 1];
    setTimeout(async () => {
      try {
        const bitmap = await popup.browsingContext.currentWindowGlobal.drawSnapshot(null, 1, 'white');
        const canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
        canvas.width = bitmap.width; canvas.height = bitmap.height;
        canvas.getContext('2d').drawImage(bitmap, 0, 0);
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        const colors = new Set();
        for (let i = 0; i < pixels.length; i += 16) colors.add(pixels[i] + ',' + pixels[i+1] + ',' + pixels[i+2]);
        done({ image: canvas.toDataURL('image/png').split(',')[1], colors: colors.size });
      } catch (error) { done({ error: String(error) }); }
    }, 500);
  `, popup);
  assert.ok(snapshot.image, snapshot.error);
  assert.ok(snapshot.colors > 50, 'Popup is blank or has not painted');
  writeFileSync(resolve(root, 'test-results/firefox-popup.png'), snapshot.image, 'base64');
  const url = await driver.executeScript('return arguments[0].currentURI.spec', popup);
  await driver.setContext(firefox.Context.CONTENT);
  await driver.get(url);
  await driver.wait(until.elementIsEnabled(driver.findElement(By.id('quick-themes'))), 5000);
  await driver.findElement(By.css('[data-preview-theme="midnight"]')).click();
  const currentAppearance = () => driver.executeAsyncScript(`
    const done = arguments[arguments.length - 1];
    chrome.storage.local.get('settings', ({ settings }) => done([settings?.mode, settings?.theme]));
  `);
  await driver.wait(async () => (await currentAppearance()).join('/') === 'site/midnight', 5000);
  await driver.findElement(By.css('.scope-choice:has(input[value="global"])')).click();
  await driver.wait(async () => (await currentAppearance()).join('/') === 'global/midnight', 5000);
  await driver.navigate().refresh();
  await driver.wait(async () => (await driver.findElement(By.css('input[value="midnight"]')).isSelected())
    && (await driver.findElement(By.css('input[name="theme-scope"][value="global"]')).isSelected()), 5000);
  await driver.findElement(By.css('.scope-choice:has(input[value="site"])')).click();
  await driver.wait(async () => (await currentAppearance()).join('/') === 'site/midnight', 5000);
  assert.equal(await driver.findElement(By.css('input[value="midnight"]')).isSelected(), true);
  assert.equal(await driver.findElement(By.id('plugins-title')).isDisplayed(), true);
  const handles = await driver.getAllWindowHandles();
  await driver.findElement(By.id('open-store')).click();
  const store = await driver.wait(async () => (await driver.getAllWindowHandles()).find(handle => !handles.includes(handle)), 5000);
  await driver.switchTo().window(store);
  await driver.wait(until.elementLocated(By.id('theme-gallery')), 10000);
  assert.match(await driver.getCurrentUrl(), /\/options\.html$/);
  await driver.manage().window().setRect({ width: 1360, height: 1050 });
  await driver.findElement(By.css('[data-panel="plugins"]')).click();
  assert.equal(await driver.findElement(By.id('plugins-panel')).isDisplayed(), true);
  await driver.findElement(By.css('[data-panel="themes"]')).click();
  await driver.findElement(By.css('[data-filter="light"]')).click();
  assert.equal(await driver.findElement(By.id('theme-count')).getText(), '2');
  assert.equal(await driver.findElement(By.id('featured')).isDisplayed(), false);
  await driver.findElement(By.css('#theme-sort option[value="name"]')).click();
  assert.equal(await driver.findElement(By.css('.theme-card:not([hidden]) strong')).getText(), 'Светлая');
  await driver.findElement(By.css('#theme-sort option[value="default"]')).click();
  await driver.findElement(By.css('[data-filter="all"]')).click();
  await driver.findElement(By.css('#header-menu summary')).click();
  await driver.findElement(By.id('open-account')).click();
  assert.equal(await driver.findElement(By.id('account-dialog')).isDisplayed(), true);
  await driver.findElement(By.css('#account-dialog button')).click();
  await driver.findElement(By.id('choose-featured')).click();
  assert.equal(await driver.findElement(By.css('input[value="universe-dark"]')).isSelected(), true);
  await driver.navigate().refresh();
  await driver.wait(async () => driver.findElement(By.css('input[value="midnight"]')).isSelected(), 5000);
  writeFileSync(resolve(root, 'test-results/firefox-store.png'), await driver.takeScreenshot(), 'base64');
  await driver.findElement(By.css('.theme-card--forest')).click();
  await driver.findElement(By.css('.save-button')).click();
  await driver.wait(until.elementTextIs(driver.findElement(By.id('status')), 'Настройки сохранены'), 5000);
  await driver.navigate().refresh();
  await driver.wait(async () => driver.findElement(By.css('input[value="forest"]')).isSelected(), 5000);
  await driver.get(url);
  await driver.wait(until.elementIsEnabled(driver.findElement(By.id('quick-themes'))), 5000);
  const recent = () => driver.executeScript("return [...document.querySelectorAll('.recent-theme input')].map(input => input.value)");
  assert.deepEqual(await recent(), ['forest', 'midnight']);
  await driver.findElement(By.css('.off-preview')).click();
  await driver.wait(until.elementTextIs(driver.findElement(By.id('popup-status')), 'Оформление BetterGitHub выключено.'), 5000);
  await driver.navigate().refresh();
  await driver.wait(async () => driver.findElement(By.css('input[value="off"]')).isSelected(), 5000);
  assert.deepEqual(await recent(), ['forest', 'midnight']);
  await driver.findElement(By.css('[data-preview-theme="midnight"]')).click();
  await driver.wait(async () => (await currentAppearance()).join('/') === 'global/midnight', 5000);
  await driver.wait(async () => (await recent()).join('/') === 'midnight/forest', 5000);
  assert.equal(await driver.findElement(By.css('input[value="off"]')).isSelected(), false);
  await driver.executeAsyncScript("chrome.storage.local.set({settings:{mode:'global',theme:'github',language:'ru',global:{},sites:{}}},arguments[arguments.length-1])");
  await driver.manage().window().setRect({ width: 1750, height: 1050 });
  await driver.get('https://github.com/YarilaFox/CultOfTheLambTalk');
  await driver.wait(until.elementLocated(By.css('[data-testid="directory-content"]')), 20000);
  const codeGrip = By.css('[data-bgh-column="repo-main"][data-bgh-drag-handle="code"]');
  await driver.wait(until.elementLocated(codeGrip), 10000);
  await driver.findElement(codeGrip).sendKeys(Key.ARROW_DOWN);
  await driver.wait(async () => await driver.executeScript("return document.querySelector('[data-bgh-column=repo-main][data-bgh-drag-handle=code]').parentElement.style.order === '1'"), 5000);
  await driver.navigate().refresh();
  await driver.wait(until.elementLocated(codeGrip), 15000);
  assert.ok(await driver.executeScript("const c=document.querySelector('[data-bgh-column=repo-main][data-bgh-drag-handle=code]').parentElement,r=document.querySelector('main article.markdown-body');return r.getBoundingClientRect().top<c.getBoundingClientRect().top"), 'File panel order must survive a reload');
  await driver.executeScript('window.scrollTo(0,0)');
  writeFileSync(resolve(root, 'test-results/firefox-files-below-readme.png'), await driver.takeScreenshot(), 'base64');
  await driver.findElement(codeGrip).sendKeys(Key.ARROW_UP);
  await driver.wait(async () => await driver.executeScript("return document.querySelector('[data-bgh-column=repo-main][data-bgh-drag-handle=code]').parentElement.style.order === '0'"), 5000);
  await driver.executeScript('window.scrollTo(0,0)');
  writeFileSync(resolve(root, 'test-results/firefox-on-page-handles.png'), await driver.takeScreenshot(), 'base64');
  await driver.wait(until.elementLocated(By.id('bgh-gear')), 20000);
  await driver.wait(async () => {
    try {
      await driver.findElement(By.id('bgh-gear')).click();
      return (await driver.findElements(By.css('#bgh-dialog[open]'))).length > 0;
    } catch (error) { if (['StaleElementReferenceError', 'NoSuchElementError'].includes(error.name)) return false; throw error; }
  }, 10000);
  const grips = await driver.wait(until.elementsLocated(By.css('[data-bgh-column="repo"]')), 10000);
  assert.ok(grips.length >= 3, 'Repository sections need on-page handles');
  assert.equal((await driver.findElements(By.id('bgh-order'))).length, 0);
  const matchesTheme = await driver.executeScript(`
    return getComputedStyle(document.getElementById('bgh-dialog')).backgroundColor === getComputedStyle(document.body).backgroundColor;
  `);
  assert.ok(matchesTheme, 'Editor must follow the GitHub page background');
  assert.ok(await driver.executeScript("return [...document.querySelectorAll('[data-bgh-column=repo]')].every(n=>{const r=n.getBoundingClientRect(); return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.bgh-layout-handle')===n})"), 'All repository grips must be clickable');
  writeFileSync(resolve(root, 'test-results/firefox-repo-editor.png'), await driver.takeScreenshot(), 'base64');
  const source = await driver.findElement(By.css('[data-bgh-drag-handle="about"]'));
  const target = await driver.findElement(By.css('[data-bgh-drag-handle="releases"]'));
  const beforeOrder = await driver.executeScript("return arguments[0].closest('.bgh-layout-target').style.order", source);
  await driver.actions({ async: true }).dragAndDrop(source, target).perform();
  await driver.wait(async () => await driver.executeScript("return arguments[0].closest('.bgh-layout-target').style.order", source) !== beforeOrder, 5000);
  await driver.findElement(By.css('#bgh-form button[type="submit"]')).click();
  await driver.wait(async () => (await driver.findElements(By.css('#bgh-dialog[open]'))).length === 0, 5000);
  await driver.get('https://github.com/YarilaFox');
  await driver.wait(until.elementLocated(By.css('.vcard-names #bgh-gear')), 20000);
  await driver.wait(async () => {
    try {
      await driver.findElement(By.css('.vcard-names #bgh-gear')).click();
      return (await driver.findElements(By.css('#bgh-dialog[open]'))).length > 0;
    } catch (error) { if (['StaleElementReferenceError', 'NoSuchElementError'].includes(error.name)) return false; throw error; }
  }, 10000);
  assert.ok((await driver.findElements(By.css('.bgh-layout-handle'))).length >= 3);
  assert.ok(await driver.executeScript("const n=document.querySelector('.vcard-names'),b=document.getElementById('bgh-gear');return Math.abs(n.getBoundingClientRect().left-b.getBoundingClientRect().left)<2"), 'Profile editor button should align with the profile name');
  writeFileSync(resolve(root, 'test-results/firefox-profile-editor.png'), await driver.takeScreenshot(), 'base64');
  console.log(JSON.stringify({ popup: rect, savedTheme: 'forest', screenshot: 'test-results/firefox-popup.png' }));
} catch (error) {
  mkdirSync(resolve(root, 'test-results'), { recursive: true });
  writeFileSync(resolve(root, 'test-results/firefox-error.png'), await driver.takeScreenshot(), 'base64');
  await driver.setContext(firefox.Context.CHROME);
  console.log(await driver.executeScript("return Services.console.getMessageArray().filter(m=>m.sourceName?.includes('moz-extension')).map(m=>({message:m.errorMessage,source:m.sourceName,line:m.lineNumber}))"));
  throw error;
} finally { await driver.quit(); }
