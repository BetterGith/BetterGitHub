import{chromium}from'playwright-core';import{existsSync,readdirSync,readFileSync,mkdirSync}from'node:fs';import{join,resolve}from'node:path';import assert from'node:assert/strict';
const cache=join(process.env.LOCALAPPDATA,'ms-playwright'),exe=readdirSync(cache).filter(n=>/^chromium-\d+$/.test(n)).sort((a,b)=>+b.split('-')[1]-+a.split('-')[1]).map(n=>join(cache,n,'chrome-win64','chrome.exe')).find(existsSync),ext=resolve('dist/chromium');
mkdirSync('test-results',{recursive:true});
const context=await chromium.launchPersistentContext('',{executablePath:exe,headless:true,viewport:{width:1440,height:1100},args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`]});
try{
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
 const theme=value=>worker.evaluate(theme=>chrome.storage.local.set({settings:{mode:'global',theme,global:{},sites:{}}}),value);
 await theme('compact');
 const p=await context.newPage();await p.goto('https://github.com/YarilaFox/figcraft',{waitUntil:'domcontentloaded'});await p.locator('[data-bgh-compact-part="sidebar-section"]').first().waitFor({state:'attached'});
 const readme=await p.locator('main .markdown-body').evaluate(el=>el.innerHTML);
 // Match utility layers that can arrive after extension injection, while leaving native GitHub DOM intact.
 await p.addStyleTag({content:'@layer github-utilities { [class*="sidebarSection__"] { border-block: 1px solid red !important; padding-block:16px !important; margin-block:16px !important; } }'});
 for(const name of ['compact','compact-light']){
  await theme(name);await p.waitForFunction(name=>document.documentElement.dataset.bghTheme===name,name);
  const result=await p.evaluate(()=>{document.documentElement.removeAttribute('data-bgh-compact');return [...document.querySelectorAll('[class*="sidebarSection__"]')].map(el=>{const s=getComputedStyle(el);return{border:s.borderTopWidth+'/'+s.borderBottomWidth,padding:s.paddingBlock,margin:s.marginBlock};});});
  assert.ok(result.length>=5);
  for(const row of result){assert.equal(row.border,'0px/0px');assert.equal(row.padding,'4px');assert.equal(row.margin,'0px');}
  assert.deepEqual(await p.locator('main .markdown-body').evaluate(el=>el.innerHTML),readme);
  await p.screenshot({path:`test-results/sidebar-divider-fixed-${name}.png`});
 }
 await theme('github');await p.waitForFunction(()=>document.documentElement.dataset.bghTheme==='github');
 assert.equal(await p.locator('[class*="sidebarSection__"]').last().evaluate(el=>getComputedStyle(el).borderBottomWidth),'1px','native lines return outside Compact UI');
 const fixture=await context.newPage();
 await fixture.setContent('<html data-bgh-theme="compact"><body><main><aside><div class="BorderGrid"><div class="BorderGrid-row"><div class="BorderGrid-cell"><h2>About</h2><p>Description</p></div></div><div class="BorderGrid-row"><div class="BorderGrid-cell"><h2>Releases</h2><a href="#release">Create a new release</a></div></div></div></aside><article class="markdown-body"><div class="BorderGrid"><div class="BorderGrid-row"><div class="BorderGrid-cell">README</div></div></div></article></main></body></html>');
 await fixture.addStyleTag({content:readFileSync('content.css','utf8')+'\n'+readFileSync('compact-sidebar.css','utf8')});
 await fixture.addStyleTag({content:'@layer github-utilities { .BorderGrid-row, .BorderGrid-cell { border-bottom:1px solid red !important; padding-block:16px !important; margin-block:16px !important; } }'});
 for(const name of ['compact','compact-light']) {
  await fixture.evaluate(name=>document.documentElement.dataset.bghTheme=name,name);
  for(const row of await fixture.locator('aside .BorderGrid-row, aside .BorderGrid-cell').evaluateAll(els=>els.map(el=>getComputedStyle(el).borderBottomWidth)))assert.equal(row,'0px');
  assert.equal(await fixture.locator('.markdown-body .BorderGrid-cell').evaluate(el=>getComputedStyle(el).borderBottomWidth),'1px','README retains its native borders');
 }
 console.log('PASS: modern live FigCraft and legacy sidebar; dark/light; late important utility layer; no toolbar-ready marker; native release link retained; README borders/content preserved; native lines restored outside Compact UI.');
}finally{await context.close();}
