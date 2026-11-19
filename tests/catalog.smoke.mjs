import{chromium}from'playwright-core';import{existsSync,readdirSync,mkdirSync}from'node:fs';import{join,resolve}from'node:path';import assert from'node:assert/strict';
mkdirSync('test-results',{recursive:true});
const ext=resolve('dist/chromium'),cache=join(process.env.LOCALAPPDATA,'ms-playwright'),exe=readdirSync(cache).filter(n=>/^chromium-\d+$/.test(n)).sort((a,b)=>+b.split('-')[1]-+a.split('-')[1]).map(n=>join(cache,n,'chrome-win64','chrome.exe')).find(existsSync);
const context=await chromium.launchPersistentContext('',{executablePath:exe,headless:true,viewport:{width:1825,height:1080},args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`]});
try{
const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const base=`chrome-extension://${new URL(worker.url()).host}`;
await worker.evaluate(()=>chrome.storage.local.set({settings:{mode:'global',theme:'compact',language:'ru',global:{},sites:{}},pluginQuickNavigation:true}));
const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/options.html');await p.locator('.theme-author').first().waitFor();
for(const width of [1825,1280,800,390]){
 await p.setViewportSize({width,height:1000});await p.evaluate(()=>scrollTo(0,0));
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const feature=await p.locator('#featured').boundingBox();assert.ok(feature.height<=230,`${width}: ${feature.height}`);
 if(width>=800)assert.equal(await p.locator('#featured img').evaluate(el=>getComputedStyle(el).objectPosition),'0% 0%');
 if(width===1825){await p.setViewportSize({width,height:1800});await p.screenshot({path:'test-results/catalog-polish-themes.png',fullPage:true});}
}
assert.equal(await p.locator('.theme-card .theme-author').count(),11);
assert.equal(await p.locator('[data-filter=all]').evaluate(el=>getComputedStyle(el).borderRadius),'6px');
await p.setViewportSize({width:1825,height:1080});await p.locator('[data-panel=plugins]').click();
assert.equal(await p.locator('.plugin-card:not([hidden])').count(),6);
const search=p.locator('#plugin-search');await search.fill('PAGE NAV');assert.equal(await p.locator('.plugin-card:not([hidden])').count(),1);
const configure=p.locator('[data-configure-plugin=pluginQuickNavigation]');assert.equal(await configure.textContent(),'');assert.equal(await configure.locator('svg').count(),1);
assert.equal(await configure.evaluate(el=>el.parentElement.contains(el.closest('.plugin-card').querySelector('input[role=switch]'))),true);
assert.equal(await p.locator('[name=pluginQuickNavigation]').isChecked(),true);
const activeCard=p.locator('.plugin-card').filter({has:p.locator('[name=pluginQuickNavigation]')});
assert.notEqual(await activeCard.evaluate(el=>getComputedStyle(el).boxShadow),'none');
await p.locator('[name=pluginQuickNavigation]').uncheck();await p.mouse.move(1,1);
await p.waitForFunction(()=>getComputedStyle(document.querySelector('[name=pluginQuickNavigation]').closest('.plugin-card')).boxShadow==='none');
await p.locator('[name=pluginQuickNavigation]').check();await p.mouse.move(1,1);
await p.waitForFunction(()=>getComputedStyle(document.querySelector('[name=pluginQuickNavigation]').closest('.plugin-card')).boxShadow!=='none');
await configure.click();await p.locator('#plugin-settings-dialog[open]').waitFor();assert.equal(await p.locator('[name=pluginQuickNavigation]').isChecked(),true);await p.locator('#plugin-settings-dialog [data-close]').click();
await search.fill('zzzz-unknown');assert.equal(await p.locator('.plugin-card:not([hidden])').count(),0);assert.equal(await p.locator('#plugin-empty').isVisible(),true);
await search.fill('');await p.screenshot({path:'test-results/catalog-polish-plugins.png',fullPage:true});
await p.setViewportSize({width:390,height:950});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:'test-results/catalog-polish-plugins-mobile.png',fullPage:true});
await p.locator('[data-panel=themes]').click();await p.locator('#header-menu summary').click();await p.locator('[data-panel=advanced]').click();await p.locator('[name=language]').selectOption('en');await p.locator('[data-panel=plugins]').click();assert.equal(await search.getAttribute('placeholder'),'Search plugins');await search.fill('light');assert.equal(await p.locator('.plugin-card:not([hidden])').count(),1);
assert.deepEqual(errors,[]);console.log('PASS: compact cropped feature, rectangular chips, 11 author labels, icon-only independent plugin settings beside switches, localized search/empty state, responsive desktop/mobile without overflow.');
}finally{await context.close();}
