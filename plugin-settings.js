(() => {
  'use strict';
  const core = globalThis.BetterGitHubCommands;
  const kinds = { pluginCommandPalette: 'commands', pluginQuickNavigation: 'navigation', pluginRepositorySwitcher: 'repositories', pluginQuickActions: 'actions' };
  const names = { commands: 'Command Palette', navigation: 'Page Navigator', repositories: 'Repository Switcher', actions: 'Quick Actions' };
  const keys = ['settings', 'commandCustom', 'commandShortcuts', 'navigationPinned', 'navigationHistory', 'navigationPreserveSection', 'navigatorIncludeComments', 'navigatorIncludeChanges', 'quickActionsContextMenu'];
  const strings = {
    ru: { configure:'Настроить', close:'Закрыть', shortcuts:'Горячие клавиши', shortcutHelp:'Нажми сочетание с Ctrl, ⌘ или Alt. Esc отменяет запись. Пустое поле выключает сочетание.', clear:'Очистить', reset:'По умолчанию', custom:'Мои команды', title:'Название', type:'Действие', link:'Открыть HTTPS-ссылку', copy:'Скопировать текст', value:'Ссылка или текст', add:'Добавить команду', remove:'Удалить', saved:'Сохранено', failed:'Не удалось сохранить.', invalid:'Проверь название и HTTPS-ссылку или текст.', conflict:'Сочетание занято, зарезервировано или не поддерживается.', templates:'Подстановки: {repo}, {owner}, {repository}, {url}. Ссылки открываются, текст копируется.', recent:'Очистить последние команды', pins:'Закреплённые репозитории', repo:'owner/repository', pin:'Закрепить', empty:'Пока ничего нет', history:'Очистить историю репозиториев', preserve:'Сохранять текущий раздел', comments:'Показывать комментарии Issue и PR', changes:'Показывать изменённые файлы PR', context:'Открывать меню по Alt + правый клик', shortcut:'Сочетание', count:'Недавних репозиториев', tooMany:'Достигнут лимит: 50 записей.' },
    en: { configure:'Configure', close:'Close', shortcuts:'Keyboard shortcuts', shortcutHelp:'Press a shortcut with Ctrl, ⌘ or Alt. Esc cancels recording. Empty disables the shortcut.', clear:'Clear', reset:'Default', custom:'Custom commands', title:'Name', type:'Action', link:'Open HTTPS link', copy:'Copy text', value:'URL or text', add:'Add command', remove:'Remove', saved:'Saved', failed:'Could not save.', invalid:'Check the name and HTTPS URL or text.', conflict:'Shortcut is already used, reserved or unsupported.', templates:'Templates: {repo}, {owner}, {repository}, {url}. Links open and text is copied.', recent:'Clear recent commands', pins:'Pinned repositories', repo:'owner/repository', pin:'Pin', empty:'Nothing here yet', history:'Clear repository history', preserve:'Keep the current section', comments:'Include Issue and PR comments', changes:'Include changed PR files', context:'Open menu with Alt + right-click', shortcut:'Shortcut', count:'Recent repositories', tooMany:'Limit reached: 50 entries.' }
  };
  let preferences = {}, kind, panel, content, status, lastLanguage;
  let queue = Promise.resolve();
  const lang = () => preferences.settings?.language === 'en' ? 'en' : 'ru';
  const t = key => strings[lang()][key];
  function el(tag, text, cls) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; return node; }
  const get = () => new Promise((resolve,reject) => chrome.storage.local.get(keys, values => chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve(values)));
  const set = patch => new Promise((resolve,reject) => chrome.storage.local.set(patch, () => chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve()));
  function message(type) { return new Promise((resolve,reject) => chrome.runtime.sendMessage({type}, result => chrome.runtime.lastError || result?.error ? reject(new Error(result?.error || chrome.runtime.lastError.message)) : resolve(result))); }
  function report(key, error = false) { if (status) { status.textContent = t(key); status.classList.toggle('is-error',error); } }
  function save(update, rerender = false) {
    queue = queue.catch(() => {}).then(async () => { const previous = await get(); const patch = update(previous); await set(patch); preferences = { ...previous, ...patch }; report('saved'); if (rerender) render(); });
    return queue.catch(error => report(error.message === 'Shortcut collision' ? 'conflict' : error.message === 'Limit' ? 'tooMany' : 'failed',true));
  }
  function button(text, action, cls) { const b = el('button',text,cls); b.type='button'; b.addEventListener('click',action); return b; }
  function section(title) { const s=el('section',undefined,'plugin-settings-section'); s.append(el('h3',title)); content.append(s); return s; }
  function field(title,input) { const label=el('label',undefined,'plugin-settings-field'); label.append(el('span',title),input); return label; }
  function checkbox(title,key,defaultValue) {
    const input=el('input'); input.type='checkbox'; input.checked=preferences[key] ?? defaultValue;
    const label=el('label',undefined,'plugin-settings-check'); label.append(input,el('span',title));
    input.addEventListener('change',()=>{const value=input.checked;void save(()=>({[key]:value}));}); return label;
  }
  function shortcutControl(id, title, target = content) {
    const row=el('div',undefined,'shortcut-row'), input=el('input'); input.type='text'; input.readOnly=true;
    input.value=core.bindings(preferences)[id] || ''; input.setAttribute('aria-label',`${t('shortcut')}: ${title}`);
    const apply = value => {
      const normalized=core.shortcut(value);
      if (normalized===null) { report('conflict',true); return; }
      void save(previous => {
        const bindings=core.bindings(previous);
        const candidate=normalized.replace('Mod','Ctrl');
        if(normalized && Object.entries(bindings).some(([key,binding])=>key!==id && binding && [binding.replace('Mod','Ctrl'),binding.replace('Mod','Meta')].includes(candidate)))throw new Error('Shortcut collision');
        return { commandShortcuts:{ ...previous.commandShortcuts,[id]:normalized } };
      }).then(()=>{input.value=core.bindings(preferences)[id]||'';});
    };
    input.addEventListener('keydown',event=>{
      if(event.key==='Tab')return;
      event.preventDefault(); event.stopPropagation();
      if(event.key==='Escape'){input.blur();return;}
      if(['Backspace','Delete'].includes(event.key)){apply('');return;}
      if(['Control','Shift','Alt','Meta'].includes(event.key))return;
      const value=core.shortcutFromEvent(event);if(value===null){report('conflict',true);return;}apply(value);
    });
    row.append(field(title,input),button(t('clear'),()=>apply('')),button(t('reset'),()=>apply(core.defaults[id] || '')));target.append(row);
  }
  function customCommands() {
    const s=section(t('custom'));s.append(el('p',t('templates'),'help-text'));
    const custom=core.normalizeCustom(preferences.commandCustom);
    for(const command of custom){
      const row=el('div',undefined,'custom-command');
      const title=el('input');title.type='text';title.value=command.title;title.maxLength=80;
      const type=el('select');for(const [value,label]of[['link',t('link')],['copy',t('copy')]]){const o=el('option',label);o.value=value;type.append(o);}type.value=command.type;
      const value=el('input');value.type='text';value.value=command.value;value.maxLength=2048;
      const update=()=>{const next={...command,title:title.value,type:type.value,value:value.value};if(!core.normalizeCustom([next]).length){report('invalid',true);return;}
        void save(previous=>({commandCustom:core.normalizeCustom(previous.commandCustom).map(item=>item.id===command.id?next:item)}));};
      for(const input of[title,type,value])input.addEventListener('change',update);
      row.append(field(t('title'),title),field(t('type'),type),field(t('value'),value));
      shortcutControl(`custom:${command.id}`,t('shortcut'),row);
      row.append(button(t('remove'),()=>void save(previous=>{const bindings={...previous.commandShortcuts};delete bindings[`custom:${command.id}`];return{commandCustom:core.normalizeCustom(previous.commandCustom).filter(item=>item.id!==command.id),commandShortcuts:bindings};},true)));
      s.append(row);
    }
    const add=el('form',undefined,'custom-command');
    const title=el('input');title.type='text';title.required=true;title.maxLength=80;title.name='commandTitle';
    const type=el('select');type.name='commandType';for(const[value,label]of[['link',t('link')],['copy',t('copy')]]){const o=el('option',label);o.value=value;type.append(o);}
    const value=el('input');value.type='text';value.required=true;value.maxLength=2048;value.name='commandValue';
    const submit=el('button',t('add'));submit.type='submit';
    add.append(field(t('title'),title),field(t('type'),type),field(t('value'),value),submit);
    add.addEventListener('submit',event=>{event.preventDefault();const command={id:crypto.randomUUID(),title:title.value,type:type.value,value:value.value};
      if(!core.normalizeCustom([command]).length){report('invalid',true);return;}
      void save(previous=>{const commands=core.normalizeCustom(previous.commandCustom);if(commands.length>=50)throw new Error('Limit');return{commandCustom:[...commands,command]};},true);
    });s.append(add);
  }
  function render() {
    if(!panel?.open)return;
    content.replaceChildren();panel.querySelector('h2').textContent=names[kind];panel.querySelector('[data-close]').setAttribute('aria-label',t('close'));lastLanguage=lang();
    const shortcuts=section(t('shortcuts'));shortcuts.append(el('p',t('shortcutHelp'),'help-text'));shortcutControl(kind,names[kind],shortcuts);
    if(kind==='commands'){
      for(const [id,name]of Object.entries(names))if(id!=='commands')shortcutControl(id,name,shortcuts);
      const actions=section(lang()==='ru'?'Сочетания для действий плагинов':'Plugin action shortcuts');
      const choice=el('select'); choice.setAttribute('aria-label',lang()==='ru'?'Действие плагина':'Plugin action');
      for(const [id,title]of [['copy:repository-url','Copy repository URL'],['copy:https','Copy HTTPS clone URL'],['copy:ssh','Copy SSH clone URL'],['copy:page','Copy page URL'],['copy:permalink','Copy file permalink'],['open:github-dev','Open in github.dev'],['compare:branches','Compare branches']]){const option=el('option',title);option.value=`quick-actions:${id}`;choice.append(option);}
      const binding=el('div');actions.append(choice,binding);const showBinding=()=>{binding.replaceChildren();shortcutControl(choice.value,choice.selectedOptions[0].textContent,binding);};choice.addEventListener('change',showBinding);showBinding();
      customCommands();content.append(button(t('recent'),async()=>{try{await message('bettergithub:clear-command-history');report('saved');}catch{report('failed',true);}}));
    }else if(kind==='repositories'){
      content.append(checkbox(t('preserve'),'navigationPreserveSection',true));
      const s=section(t('pins'));const pins=Array.isArray(preferences.navigationPinned)?preferences.navigationPinned:[];
      if(!pins.length)s.append(el('p',t('empty'),'help-text'));
      for(const item of pins){if(!core.repoName(item.name))continue;const row=el('div',undefined,'pinned-settings-row');row.append(el('span',item.name),button(t('remove'),()=>void save(previous=>({navigationPinned:(previous.navigationPinned||[]).filter(pin=>pin.name.toLowerCase()!==item.name.toLowerCase())}),true)));s.append(row);}
      const add=el('form',undefined,'pinned-settings-row'),input=el('input');input.type='text';input.required=true;input.maxLength=201;input.name='repository';input.setAttribute('aria-label',t('repo'));input.placeholder=t('repo');
      const submit=el('button',t('pin'));submit.type='submit';add.append(input,submit);s.append(add);
      add.addEventListener('submit',event=>{event.preventDefault();const name=core.repoName(input.value.trim());if(!name){report('invalid',true);return;}void save(previous=>{const pins=Array.isArray(previous.navigationPinned)?previous.navigationPinned:[];if(pins.length>=50)throw new Error('Limit');return{navigationPinned:[...pins.filter(pin=>pin.name.toLowerCase()!==name.toLowerCase()),{name,pinnedAt:Date.now()}]};},true);});
      content.append(el('p',`${t('count')}: ${preferences.navigationHistory?.length || 0}`),button(t('history'),async()=>{try{await message('bettergithub:clear-repository-history');report('saved');}catch{report('failed',true);}}));
    }else if(kind==='navigation')content.append(checkbox(t('comments'),'navigatorIncludeComments',true),checkbox(t('changes'),'navigatorIncludeChanges',true));
    else if(kind==='actions')content.append(checkbox(t('context'),'quickActionsContextMenu',false));
  }
  async function open(plugin){
    kind=kinds[plugin];if(!kind)return;
    preferences=await get();
    if(!panel){
      panel=el('dialog');panel.id='plugin-settings-dialog';panel.setAttribute('aria-labelledby','plugin-settings-title');
      const header=el('header'),heading=el('h2');heading.id='plugin-settings-title';const close=button('×',()=>panel.close());close.dataset.close='';header.append(heading,close);
      content=el('div',undefined,'plugin-settings-content');status=el('p',undefined,'theme-status');status.setAttribute('role','status');panel.append(header,content,status);document.body.append(panel);
    }
    if(!panel.open)panel.showModal();render();
  }
  for(const [plugin,kind]of Object.entries(kinds)){
    const card=document.querySelector(`[name="${plugin}"]`)?.closest('.plugin-card');if(!card)continue;
    const configure=button('⚙',()=>void open(plugin).catch(()=>report('failed',true)),'plugin-configure');configure.dataset.configurePlugin=plugin;configure.setAttribute('aria-haspopup','dialog');card.append(configure);
  }
  function updateLabels(){for(const b of document.querySelectorAll('[data-configure-plugin]')){b.textContent=t('configure');b.setAttribute('aria-label',`${t('configure')}: ${names[kinds[b.dataset.configurePlugin]]}`);}}
  chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local')return;for(const key of keys)if(Object.hasOwn(changes,key))preferences[key]=changes[key].newValue;updateLabels();if(panel?.open&&lastLanguage!==lang())render();});
  void get().then(values=>{preferences=values;updateLabels();const plugin=new URLSearchParams(location.search).get('plugin');if(kinds[plugin]){document.querySelector('[data-panel="plugins"]')?.click();return open(plugin);}if(plugin){document.querySelector('[data-panel="plugins"]')?.click();document.querySelector(`[name="${CSS.escape(plugin)}"]`)?.focus();}}).catch(()=>{});
})();
