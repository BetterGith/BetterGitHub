import{Builder,By,until}from'selenium-webdriver';import firefox from'selenium-webdriver/firefox.js';import{resolve}from'node:path';import{mkdirSync,writeFileSync}from'node:fs';import assert from'node:assert/strict';
mkdirSync('test-results',{recursive:true});
const options=new firefox.Options().setBinary(process.env.FIREFOX_BINARY||'C:\\Program Files\\Mozilla Firefox\\firefox.exe').addArguments('-headless','-no-remote');
const d=await new Builder().forBrowser('firefox').setFirefoxOptions(options).setFirefoxService(new firefox.ServiceBuilder().addArguments('--allow-system-access')).build();
try{
 await d.manage().window().setRect({width:1440,height:1000});const id=await d.installAddon(resolve('dist/firefox'),true);await d.get('about:blank');await d.setContext(firefox.Context.CHROME);const base=await d.executeScript('return WebExtensionPolicy.getByID(arguments[0]).getURL("");',id);await d.setContext(firefox.Context.CONTENT);
 await d.get(base+'options.html');await d.wait(until.elementLocated(By.css('[data-configure-plugin=pluginQuickNavigation]')),5000);
 assert.equal((await d.findElement(By.id('featured')).getRect()).height,190);
 assert.equal((await d.findElements(By.css('.theme-author'))).length,11);
 await d.findElement(By.css('[data-panel=plugins]')).click();
 const search=await d.findElement(By.id('plugin-search'));await search.sendKeys('Page Navigator');
 assert.equal((await d.findElements(By.css('.plugin-card:not([hidden])'))).length,1);
 const button=await d.findElement(By.css('[data-configure-plugin=pluginQuickNavigation]'));assert.equal(await button.getText(),'');assert.ok((await button.findElements(By.css('svg'))).length===1);
 await button.click();await d.wait(until.elementIsVisible(d.findElement(By.id('plugin-settings-dialog'))),5000);assert.equal(await d.findElement(By.css('#plugin-settings-dialog h2')).getText(),'Page Navigator');await d.findElement(By.css('#plugin-settings-dialog [data-close]')).click();
 await search.clear();await search.sendKeys('not-a-plugin');assert.equal(await d.findElement(By.id('plugin-empty')).isDisplayed(),true);await search.clear();await search.sendKeys(' ');
 assert.equal((await d.findElements(By.css('.plugin-card:not([hidden])'))).length,6);
 writeFileSync('test-results/catalog-polish-firefox.png',await d.takeScreenshot(),'base64');
 await d.manage().window().setRect({width:390,height:900});assert.equal(await d.executeScript('return document.documentElement.scrollWidth>innerWidth'),false);
 console.log('PASS Firefox: compact recommendation, author names, icon-only plugin settings, plugin search/empty state and narrow layout.');
}finally{await d.quit();}
