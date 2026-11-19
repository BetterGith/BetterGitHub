import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{runInNewContext}from'node:vm';
function core(){const sandbox={URL,console};runInNewContext(readFileSync(new URL('../command-core.js',import.meta.url),'utf8'),sandbox);return sandbox.BetterGitHubCommands;}
test('plugins register namespaced commands, respect individual/full OFF and unregister without page events',()=>{
 const c=core();let updates=0;c.subscribe(()=>updates++);
 const remove=c.registerPlugin({id:'repo-health',name:'Repo Health',flag:'pluginHealth',commands:context=>[{id:'analyze',title:'Analyze repository',run:()=>context.repository}]});
 assert.equal(c.collect({repository:'Owner/Repo'},{pluginHealth:false}).length,0);
 const commands=c.collect({repository:'Owner/Repo'},{pluginHealth:true});assert.equal(commands.length,1);assert.equal(commands[0].id,'repo-health:analyze');assert.equal(commands[0].run(),'Owner/Repo');
 assert.equal(c.search(commands,'health analyze').length,1);assert.equal(c.collect({},{settings:{themeDisabled:true},pluginHealth:true}).length,0);
 assert.throws(()=>c.registerPlugin({id:'repo-health',name:'Duplicate',commands:()=>[]}));remove();assert.equal(updates,2);assert.equal(c.collect({},{pluginHealth:true}).length,0);
});
test('shortcut validation preserves GitHub and browser keys; normalized bindings match physical keyboard events',()=>{
 const c=core();for(const binding of ['Ctrl+K','Ctrl+Shift+K','Mod+L','Alt+F4','Shift+A','Ctrl+Ctrl+A','javascript:foo'])assert.equal(c.shortcut(binding),null,binding);
 assert.equal(c.shortcut('Alt+Shift+g'),'Alt+Shift+G');assert.equal(c.shortcut(''),'');assert.equal(c.matchesShortcut('Mod+Shift+Space',{code:'Space',ctrlKey:true,shiftKey:true}),true);
 assert.equal(c.matchesShortcut('Mod+Shift+Space',{code:'Space',metaKey:true,shiftKey:true}),true);assert.equal(c.matchesShortcut('Mod+Shift+Space',{code:'Space',ctrlKey:true,metaKey:true,shiftKey:true}),false);
 assert.equal(c.matchesShortcut('Alt+Shift+R',{code:'KeyR',altKey:true,shiftKey:true}),true);assert.equal(c.bindings({commandShortcuts:{commands:'Ctrl+K'}}).commands,c.defaults.commands);
});
test('custom commands accept HTTPS or copied text, reject execution schemes and expand repository placeholders',()=>{
 const c=core(),values=c.normalizeCustom([{id:'a',title:'Docs',type:'link',value:'https://example.com/{repo}?from={url}'},{id:'b',title:'Clone',type:'copy',value:'git clone git@github.com:{repo}.git'},{id:'c',title:'Unsafe',type:'link',value:'javascript:alert(1)'},{id:'d',title:'Local',type:'link',value:'file:///C:/secret'},{id:'e',title:'Auth',type:'link',value:'https://user:pass@example.com'}]);
 assert.equal(values.length,2);assert.equal(c.expandTemplate(values[1].value,{repository:'Owner/Repo',url:'https://github.com/Owner/Repo'}),'git clone git@github.com:Owner/Repo.git');
 assert.equal(c.expandTemplate(values[0].value,{repository:'Owner/Repo',url:'https://github.com/Owner/Repo#L2'},true),'https://example.com/Owner/Repo?from=https%3A%2F%2Fgithub.com%2FOwner%2FRepo%23L2');
 assert.equal(c.expandTemplate('{repo}',{url:'https://github.com'}),null);assert.equal(c.normalizeCustom([{id:'x',title:'a',type:'copy',value:'one'},{id:'x',title:'b',type:'copy',value:'two'}]).length,1);
});
test('recent command ranking never revives removed or disabled commands',()=>{
 const c=core(),commands=[{id:'a',title:'First'},{id:'b',title:'Second'}];assert.equal(c.search(commands,'',[{id:'removed'},{id:'b'}])[0].id,'b');assert.equal(c.search(commands,'First',[{id:'b'}])[0].id,'a');
});
