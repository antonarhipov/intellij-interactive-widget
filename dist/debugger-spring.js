'use strict';
// Browsable Spring tool-window state, reconstructed from the supplied IDEA views.
function initDebugSpringState(){
  state.debugSpringView||='beans';state.debugBeanType||='ChannelController';state.debugBeansFocus||='context';
  state.debugHealthExpanded||={db:true,diskSpace:true};
  state.debugEnvironmentExpanded||={'server.ports':true,commandLineArgs:true,'application-debugger.yml':true};
  state.debugSpringSelection||={environment:'debugger-default-channel',health:''};
}
function springTool(name,label,action='',extra=''){
  return `<button class="icon-button" ${action?`data-action="${action}"`:'disabled'} aria-label="${esc(label)}" title="${esc(label)}" ${extra}>${editorIcon(name)}</button>`;
}
function springViewTools(kind){
  const data=`data-spring-kind="${kind}"`,divider='<span class="spring-tool-divider"></span>';
  let tools=springTool('refresh',kind==='beans'?'Refresh Spring beans':kind==='health'?'Refresh health':'Refresh environment','debug-spring-refresh',data)+divider;
  if(kind==='beans')tools+=springTool('spring-update','Update application data')+divider+`<button class="icon-button" disabled aria-label="Group beans by type" title="Group by type">${projectIcon('libraries')}</button>`+divider+springTool('spring-context','Show application contexts','','aria-pressed="true"')+`<button class="icon-button" disabled aria-label="Show application beans" title="Show application beans" aria-pressed="true">${editorIcon('spring-java-config')}</button>`+divider+springTool('spring-dependencies','Show bean dependencies','','aria-pressed="true"')+springTool('spring-inherited','Show inherited beans','','aria-pressed="true"');
  else tools+=`<button class="icon-button" data-action="debug-spring-expand" ${data} aria-label="Expand all ${kind} nodes" title="Expand All">${projectIcon('expand')}</button><button class="icon-button" data-action="debug-spring-collapse" ${data} aria-label="Collapse all ${kind} nodes" title="Collapse All">${projectIcon('collapse')}</button>`+divider+springTool(kind==='health'?'settings-small':'spring-values',kind==='health'?'Health view settings':'Show environment values');
  return `<nav class="spring-view-tools ${kind==='health'?'spring-health-tools':''}" aria-label="${kind==='beans'?'Beans':kind==='health'?'Health':'Environment'} controls">${tools}</nav>`;
}
function debugBeanTypes(){
  const beans=buildLogicalModel(project('main').files).beans.filter(b=>b.kind!=='repositories').map(b=>({...b,key:b.name,hasBean:true}));
  const config=beans.find(b=>b.name==='SecurityConfig');if(config)beans.push({...config,key:'SecurityConfig-class',hasBean:false});
  return beans.sort((a,b)=>a.name.localeCompare(b.name)||Number(b.hasBean)-Number(a.hasBean));
}
function renderDebugBeans(){
  const health=state.debugSpringView==='health',types=debugBeanTypes(),selected=types.find(b=>b.key===state.debugBeanType)||types[0];
  const row=(label,symbol,action,attrs='',selected=false)=>`<button class="spring-bean-row ${selected?'selected':''}" role="option" aria-selected="${selected}" data-action="${action}" ${attrs}>${symbol}<span>${esc(label)}</span>${action!=='debug-bean-instance'?'<i class="spring-bean-next" aria-hidden="true"></i>':''}</button>`;
  const details=state.debugBeanInstance&&selected.hasBean?`<div class="spring-bean-details"><div class="spring-bean-detail-title">${icon('spring-bean')}${esc(selected.beanName)}</div><dl><dt>Type</dt><dd>${esc(selected.package+'.'+selected.name)}</dd><dt>Scope</dt><dd>singleton</dd><dt>Resource</dt><dd><button class="debug-value-link" data-action="debug-source" data-path="${esc(selected.path)}" data-line="${selected.line}">${esc(base(selected.path))}</button></dd><dt>Dependencies</dt><dd>${esc(selected.fields.map(f=>f.name).join(', ')||'—')}</dd></dl><button class="debug-value-link" data-action="debug-source" data-path="${esc(selected.path)}" data-line="${selected.line}">Navigate to Source</button></div>`:'<span class="spring-nothing-selected">Nothing selected</span>';
  const columns=`<div class="spring-bean-columns"><div class="spring-bean-column ${state.debugBeansFocus==='context'?'focused':''}" role="listbox" aria-label="Spring application contexts">${row('notify-hub',editorIcon('spring-context'),'debug-bean-context','',true)}</div><div class="spring-bean-column ${state.debugBeansFocus==='type'?'focused':''}" role="listbox" aria-label="Spring bean types">${types.map(b=>row(b.name,projectIcon('class'),'debug-bean-type',`data-bean-key="${b.key}" aria-label="${b.hasBean?b.name:b.name+' (configuration class)'}" ${b.hasBean?'':'data-no-instances="true"'}`,b.key===selected.key)).join('')}</div><div class="spring-bean-column ${state.debugBeansFocus==='instance'?'focused':''}" role="listbox" aria-label="Spring bean instances">${selected.hasBean?row(selected.beanName,selected.kind==='controllers'?editorIcon('spring-web'):icon('spring-bean'),'debug-bean-instance',`data-bean-key="${selected.key}"`,!!state.debugBeanInstance):''}</div><div class="spring-bean-detail-pane" role="region" aria-label="Bean details">${details}</div></div>`;
  return `<section class="debug-spring-snapshot spring-browser" aria-label="Spring Boot Beans and Health"><div class="spring-subtabs" role="tablist" aria-label="Spring Boot views"><button role="tab" aria-selected="${!health}" class="${health?'':'active'}" data-action="debug-spring-view" data-view="beans">${icon('spring-bean')}Beans</button><button role="tab" aria-selected="${health}" class="${health?'active':''}" data-action="debug-spring-view" data-view="health">${editorIcon('spring-health')}Health</button></div><div class="spring-snapshot-body">${springViewTools(health?'health':'beans')}${health?renderSpringTree('health'):columns}</div></section>`;
}
function healthSnapshotNodes(){
  const property=(key,label,value)=>({key,label,value});
  return [{key:'application',label:'application',status:true},{key:'groups',label:'groups',value:'[liveness, readiness]'},
    {key:'db',label:'db',status:true,children:[property('database','database','PostgreSQL'),property('validationQuery','validationQuery','isValid()')]},
    {key:'diskSpace',label:'diskSpace',status:true,children:[property('exists','exists','true'),property('free','free','94,513,254,400'),property('path','path',project('main').root+'/.'),property('threshold','threshold','10,485,760'),property('total','total','994,662,584,320')]},
    {key:'livenessState',label:'livenessState',status:true},{key:'ping',label:'ping',status:true},{key:'readinessState',label:'readinessState',status:true},
    {key:'ssl',label:'ssl',status:true,children:[property('ssl-status','status','UP')]}];
}
function sourceEnvironmentKeys(){
  const text=Object.values(project('main').files).find(f=>f.path==='src/main/resources/application.yml')?.text||'',stack=[],keys=[];
  for(const line of text.split('\n')){
    const m=line.match(/^(\s*)([\w.-]+):\s*(.*?)\s*$/);if(!m)continue;
    const depth=m[1].length;while(stack.length&&stack.at(-1).depth>=depth)stack.pop();
    const key=[...stack.map(s=>s.key),m[2]].join('.');
    if(m[3])keys.push(key);else stack.push({depth,key:m[2]});
  }
  return keys;
}
function environmentSnapshotNodes(){
  const property=(key,label)=>({key,label,masked:true}),group=(key,labels,spring=false)=>({key,label:key,symbol:spring?'spring-boot':'spring-object',children:labels.map((label,i)=>property(key+'-'+i,label))});
  return [{key:'active-profiles',label:'Active profiles',value:'debugger',symbol:'spring-profile',profile:true},
    group('server.ports',['local.server.port']),group('commandLineArgs',['spring.main.banner-mode','spring.profiles.active']),
    {key:'servletContextInitParams',label:'servletContextInitParams',symbol:'spring-object'},
    group('systemProperties',['java.version','java.vendor','java.home','os.name','os.arch','file.encoding','user.dir']),
    group('systemEnvironment',['JAVA_HOME','PATH','HOME','SHELL','LANG']),
    {key:'application-debugger.yml',label:'application-debugger.yml',symbol:'spring-boot',children:[property('debugger-default-channel','notifyhub.default-channel'),property('debugger-show-sql','spring.jpa.show-sql'),property('debugger-logging-root','logging.level.root')]},
    group('application.yml',sourceEnvironmentKeys(),true),group('applicationInfo',['spring.application.name']),group('Management Server',['local.management.port'])];
}
function springTreeNodes(kind){return kind==='health'?healthSnapshotNodes():environmentSnapshotNodes()}
function springTreeExpansion(kind){return kind==='health'?state.debugHealthExpanded:state.debugEnvironmentExpanded}
function renderSpringTree(kind){
  const expanded=springTreeExpansion(kind),selected=state.debugSpringSelection[kind];
  const render=(nodes,depth=0)=>nodes.map(n=>{
    const branch=!!n.children?.length,open=!!expanded[n.key],indent=depth+(n.indent||0),label=n.label+(n.masked?': ******':n.value!==undefined?': '+n.value:'');
    return `<div role="none"><button class="spring-tree-row ${n.key===selected?'selected':''} ${n.profile?'spring-profile-row':''}" role="treeitem" aria-label="${esc(label)}" aria-level="${depth+1}" aria-selected="${n.key===selected}" ${branch?`aria-expanded="${open}"`:''} tabindex="${n.key===selected||(!selected&&n.key==='application')?0:-1}" data-action="debug-spring-node" data-spring-kind="${kind}" data-spring-key="${esc(n.key)}" style="--spring-tree-depth:${indent}"><span class="spring-tree-caret">${branch?projectIcon(open?'chevron-down':'chevron'):''}</span>${n.status?editorIcon('spring-success'):n.symbol?editorIcon(n.symbol):''}<span class="spring-tree-label ${n.value!==undefined||n.masked?'spring-property-name':''}">${esc(n.label)}${n.value!==undefined||n.masked?':':''}</span>${n.masked?'<strong class="spring-masked-value">******</strong>':n.value!==undefined?`<span class="spring-property-value">${esc(n.value)}</span>`:''}</button>${branch&&open?`<div role="group">${render(n.children,depth+1)}</div>`:''}</div>`;
  }).join('');
  return `<div class="spring-tree-scroll" tabindex="-1"><div class="spring-snapshot-tree spring-${kind}-tree" role="tree" aria-label="${kind==='health'?'Application health':'Environment property sources'}">${render(springTreeNodes(kind))}</div></div>`;
}
function renderDebugEnvironment(){return `<section class="debug-spring-snapshot spring-browser spring-environment" aria-label="Spring Boot environment"><div class="spring-snapshot-body">${springViewTools('environment')}${renderSpringTree('environment')}</div></section>`}
function refreshSpringTree(kind,key){
  const scroll=$('.spring-tree-scroll')?.scrollTop||0;renderDebugger();const tree=$('.spring-tree-scroll');if(tree)tree.scrollTop=scroll;
  const row=$$('.spring-tree-row').find(r=>r.dataset.springKey===key);row?.focus({preventScroll:true});persist();
}
function debugSpringAction(name,el){
  const kind=el?.dataset?.springKind;
  switch(name){
    case 'debug-spring-view':state.debugSpringView=el.dataset.view;renderDebugger();persist();return true;
    case 'debug-bean-context':state.debugBeansFocus='context';state.debugBeanInstance=false;renderDebugger();$('.spring-bean-column [data-action="debug-bean-context"]')?.focus();persist();return true;
    case 'debug-bean-type':state.debugBeanType=el.dataset.beanKey;state.debugBeanInstance=false;state.debugBeansFocus='type';renderDebugger();{const row=$$('[data-action="debug-bean-type"]').find(e=>e.dataset.beanKey===state.debugBeanType);row?.focus({preventScroll:true});row?.scrollIntoView({block:'nearest'})}persist();return true;
    case 'debug-bean-instance':state.debugBeanInstance=true;state.debugBeansFocus='instance';renderDebugger();$('[data-action="debug-bean-instance"]')?.focus();persist();return true;
    case 'debug-spring-node':{
      const key=el.dataset.springKey,expanded=springTreeExpansion(kind);state.debugSpringSelection[kind]=key;
      if(el.hasAttribute('aria-expanded'))expanded[key]=!expanded[key];refreshSpringTree(kind,key);return true;
    }
    case 'debug-spring-refresh':renderDebugger();return true;
    case 'debug-spring-expand':case 'debug-spring-collapse':{
      const expanded=springTreeExpansion(kind),walk=nodes=>nodes.forEach(n=>{if(n.children){expanded[n.key]=name==='debug-spring-expand';walk(n.children)}});walk(springTreeNodes(kind));renderDebugger();persist();return true;
    }
  }
  return false;
}
function bindSpringBrowserInteractions(){
  document.addEventListener('keydown',e=>{
    const row=e.target.closest('.spring-tree-row,.spring-bean-row');if(!row||!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End','Enter',' '].includes(e.key))return;
    e.preventDefault();const tree=row.closest('[role="tree"],[role="listbox"]'),rows=$$('.spring-tree-row,.spring-bean-row',tree),i=rows.indexOf(row);let target;
    if(e.key==='ArrowDown'||e.key==='ArrowUp')target=rows[Math.max(0,Math.min(rows.length-1,i+(e.key==='ArrowDown'?1:-1)))];
    else if(e.key==='Home')target=rows[0];else if(e.key==='End')target=rows.at(-1);
    else if(e.key==='Enter'||e.key===' '){row.click();return}
    else if(row.classList.contains('spring-bean-row')){
      const columns=$$('.spring-bean-column'),column=columns.indexOf(tree),next=columns[column+(e.key==='ArrowRight'?1:-1)];target=$('.selected',next||tree)||$('button',next||tree);
    }else{
      const open=row.getAttribute('aria-expanded');
      if(open!==null&&((e.key==='ArrowRight'&&open==='false')||(e.key==='ArrowLeft'&&open==='true'))){row.click();return}
      if(e.key==='ArrowRight'&&open==='true')target=rows[i+1];
      if(e.key==='ArrowLeft'){const level=+row.getAttribute('aria-level');target=rows.slice(0,i).reverse().find(r=>+r.getAttribute('aria-level')<level)}
    }
    if(target){if(target.classList.contains('spring-bean-row'))target.click();else{state.debugSpringSelection[target.dataset.springKind]=target.dataset.springKey;$$('.spring-tree-row',tree).forEach(r=>{r.classList.toggle('selected',r===target);r.setAttribute('aria-selected',String(r===target));r.tabIndex=r===target?0:-1});target.focus();persist()}}
  });
}
