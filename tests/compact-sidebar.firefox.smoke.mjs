import {Builder,By,until} from 'selenium-webdriver';import firefox from 'selenium-webdriver/firefox.js';import {resolve} from 'node:path';import {writeFileSync,mkdirSync} from 'node:fs';import assert from 'node:assert/strict';
const options=new firefox.Options().setBinary('C:\\Program Files\\Mozilla Firefox\\firefox.exe').addArguments('-headless','-no-remote');
const d=await new Builder().forBrowser('firefox').setFirefoxOptions(options).setFirefoxService(new firefox.ServiceBuilder().addArguments('--allow-system-access')).build();
mkdirSync('test-results',{recursive:true});
try{
await d.manage().window().setRect({width:1440,height:1050});const id=await d.installAddon(resolve('dist/firefox'),true);await d.get('about:blank');await d.setContext(firefox.Context.CHROME);const base=await d.executeScript('return WebExtensionPolicy.getByID(arguments[0]).getURL("");',id);await d.setContext(firefox.Context.CONTENT);
for(const theme of ['compact','compact-light']){
 await d.get(base+'popup.html');await d.executeAsyncScript('const done=arguments[arguments.length-1];chrome.storage.local.set({settings:{mode:"global",theme:arguments[0],global:{},sites:{}}},()=>done(true));',theme);
 await d.get('https://github.com/YarilaFox/figcraft');await d.wait(until.elementLocated(By.css('[data-bgh-compact-part="sidebar-section"]')),15000);
 const borders=await d.executeScript('const s=document.createElement("style");s.textContent="@layer github-utilities { [class*=sidebarSection__] { border-block:1px solid red !important; padding-block:16px !important; } }";document.head.append(s);document.documentElement.removeAttribute("data-bgh-compact");return [...document.querySelectorAll("[class*=sidebarSection__]")].map(el=>({top:getComputedStyle(el).borderTopWidth,bottom:getComputedStyle(el).borderBottomWidth,padding:getComputedStyle(el).paddingBlock}));');
 assert.ok(borders.length>=5);for(const b of borders){assert.equal(b.top,'0px');assert.equal(b.bottom,'0px');assert.equal(b.padding,'4px');}
 writeFileSync('test-results/sidebar-divider-firefox-'+theme+'.png',await d.takeScreenshot(),'base64');
}
console.log('PASS Firefox: live FigCraft, dark/light, late important utility layers and missing toolbar marker; sidebar borders remain zero and padding stays compact.');
}finally{await d.quit();}
