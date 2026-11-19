import {Builder, By, Key, until} from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';
import {resolve} from 'node:path';
import {mkdirSync, writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';

mkdirSync('test-results', {recursive:true});
const options = new firefox.Options().setBinary(process.env.FIREFOX_BINARY || 'C:\\Program Files\\Mozilla Firefox\\firefox.exe').addArguments('-headless','-no-remote');
const driver = await new Builder().forBrowser('firefox').setFirefoxOptions(options).setFirefoxService(new firefox.ServiceBuilder().addArguments('--allow-system-access')).build();
try {
  await driver.manage().window().setRect({width:1380,height:1050});
  const id=await driver.installAddon(resolve('dist/firefox'),true);
  await driver.get('about:blank'); await driver.setContext(firefox.Context.CHROME);
  const base=await driver.executeScript('return WebExtensionPolicy.getByID(arguments[0]).getURL("");',id);
  await driver.setContext(firefox.Context.CONTENT); await driver.get(base+'options.html#plugins');
  await driver.executeAsyncScript('const done=arguments[arguments.length-1];chrome.storage.local.set({settings:{theme:"compact",mode:"global",language:"en",global:{},sites:{}},pluginCommandPalette:true,pluginRepositorySwitcher:true,pluginQuickNavigation:true,pluginQuickActions:true},()=>done(true));');
  const store=await driver.getWindowHandle();
  const find=selector=>driver.findElement(By.css(selector));
  await driver.wait(until.elementLocated(By.css('[data-configure-plugin="pluginCommandPalette"]')),5000);
  await find('[data-configure-plugin="pluginCommandPalette"]').click();
  await find('#plugin-settings-dialog form [name="commandTitle"]').sendKeys('Clone this repository');
  await find('#plugin-settings-dialog form [name="commandType"] option[value="copy"]').click();
  await find('#plugin-settings-dialog form [name="commandValue"]').sendKeys('git clone https://github.com/{repo}.git');
  await find('#plugin-settings-dialog form button[type="submit"]').click();
  await driver.wait(async()=> (await driver.findElements(By.css('.custom-command'))).length===2,5000);
  const shortcut=await find('.custom-command .shortcut-row input'); await shortcut.click();
  await driver.actions().keyDown(Key.ALT).keyDown(Key.SHIFT).sendKeys('x').keyUp(Key.SHIFT).keyUp(Key.ALT).perform();
  await driver.wait(async()=> (await find('.custom-command .shortcut-row input').getAttribute('value'))==='Alt+Shift+X',5000);
  await find('#plugin-settings-dialog [data-close]').click();
  await driver.switchTo().newWindow('tab'); const repo=await driver.getWindowHandle();
  await driver.get('https://github.com/BetterGith/BetterGitHub');
  await driver.wait(until.elementLocated(By.css('[data-testid="directory-content"]')),15000);
  await driver.wait(until.elementLocated(By.id('bgh-command-palette')),15000);
  await driver.wait(async()=>{
    try { await find('#bgh-command-palette').click(); return true; }
    catch(error) { if(error.name==='StaleElementReferenceError')return false; throw error; }
  },5000);
  let input=await find('#bgh-tools-dialog [role="combobox"]'); await input.sendKeys('Clone this repository',Key.ENTER);
  await driver.wait(until.elementLocated(By.id('bgh-tools-toast')),5000);
  assert.equal(await find('#bgh-tools-toast').getText(),'Copied');
  await driver.actions().keyDown(Key.ALT).keyDown(Key.SHIFT).sendKeys('x').keyUp(Key.SHIFT).keyUp(Key.ALT).perform();
  assert.equal(await find('#bgh-tools-toast').getText(),'Copied');
  await find('#bgh-repository-switcher').click(); await find('.bgh-repository-pin').click();
  await driver.wait(async()=> (await find('.bgh-repository-pin').getAttribute('aria-pressed'))==='true',5000);
  await find('#bgh-tools-close').click();
  await find('#bgh-quick-navigation').click();assert.equal(await find('#bgh-tools-title').getText(),'Page Navigator');
  assert.ok((await driver.findElements(By.css('#bgh-tools-results [role="option"]'))).length>0); await find('#bgh-tools-close').click();
  await find('#bgh-quick-actions').click(); await driver.wait(until.elementLocated(By.css('#bgh-action-menu:popover-open')),5000);
  const menuItems=await driver.findElements(By.css('#bgh-action-menu [role="menuitem"]'));assert.ok(menuItems.length>5);
  await menuItems[0].sendKeys(Key.ARROW_DOWN,Key.ESCAPE);
  await driver.wait(async()=>!(await driver.findElements(By.css('#bgh-action-menu:popover-open'))).length,5000);
  await driver.get('https://github.com/BetterGith/BetterGitHub/blob/main/README.md#L4');
  await driver.wait(until.elementLocated(By.id('bgh-quick-actions')),15000);
  await driver.wait(()=>driver.executeScript(`return [...document.querySelectorAll('script[type="application/json"]')].some(script=>{try{const p=JSON.parse(script.textContent).payload;const r=p?.codeViewBlobLayoutRoute||p?.codeViewLayoutRoute;return r?.path==='README.md'&&/^[a-f0-9]{40,64}$/i.test(r.refInfo?.currentOid||'');}catch{return false;}});`),15000);
  await find('#bgh-quick-actions').click();
  const permalink=await driver.wait(async()=>{
    const items=await driver.findElements(By.css('#bgh-action-menu [role="menuitem"]'));
    for(const item of items)if(await item.getText()==='Copy file permalink')return item;
    return false;
  },5000);
  await permalink.click();assert.equal(await find('#bgh-tools-toast').getText(),'Copied');
  writeFileSync('test-results/command-hub-firefox.png',await driver.takeScreenshot(),'base64');
  await driver.switchTo().window(store);
  const saved=await driver.executeAsyncScript('const done=arguments[arguments.length-1];chrome.storage.local.get(["commandHistory","navigationPinned","commandCustom"],done);');
  assert.ok(saved.commandHistory.some(item=>item.id==='custom:'+saved.commandCustom[0].id));assert.equal(saved.navigationPinned.length,1);
  await driver.executeAsyncScript('const done=arguments[arguments.length-1];chrome.storage.local.set({settings:{themeDisabled:true}},()=>done(true));');
  await driver.switchTo().window(repo);await driver.wait(async()=>!(await driver.findElements(By.css('#bgh-tools-launchers'))).length,5000);
  console.log('PASS Firefox: config button, custom copy template and hotkey, recent command history, persistent pin, Page Navigator, context-menu keyboard handling, file permalink and full OFF.');
} finally { await driver.quit(); }
