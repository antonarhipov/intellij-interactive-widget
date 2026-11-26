'use strict';
// A frozen IDEA suspension. All interactions browse the captured state.
let debugInspector=null;
function initDebuggerState(stored){
  if(stored?.debuggerVersion!==6){
    state.debugExpanded={'variables-0':true,'variables-1':true};state.debugFrame=0;
    state.debugVariableScroll=23;state.debugTab='debugger';state.debugHeight=Math.min(380,Math.round(innerHeight*.36));
    const t=state.tabs.find(t=>t.path===data.debugger.file&&t.type==='file');if(t)t.scroll=58*26;
  }
  initDebugSpringState();
  state.debugExpanded||={};state.debugView||='frames';state.debugSelected||='variables-0-3';
}
function debugSymbol(n){return n.kind==='bean'?icon('spring-bean'):n.kind==='context'?icon('copy'):n.kind==='security'?icon('lock'):`<span class="debug-field-symbol">${n.kind==='parameter'?'p':'f'}</span>`}
function variableRows(nodes,prefix,depth=0,expanded=state.debugExpanded){
  return nodes.map((n,i)=>{
    const key=prefix+'-'+i,branch=!!n.children?.length,open=!!expanded[key];
    return `<div class="debug-node" role="treeitem" aria-level="${depth+1}" aria-selected="${state.debugSelected===key}" ${branch?`aria-expanded="${open}"`:''}><div class="variable-row ${state.debugSelected===key?'selected':''}" style="padding-left:${depth*17+5}px" data-key="${key}" tabindex="${state.debugSelected===key?0:-1}" aria-label="${esc(n.name+' = '+n.value+(n.summary?' '+n.summary:''))}"><button class="variable-caret" data-action="variable-toggle" data-key="${key}" aria-label="${open?'Collapse':'Expand'} ${esc(n.name)}" ${branch?'':'disabled tabindex="-1"'}>${branch?icon('chevron',open?'down':''):''}</button>${n.watch?icon('eye','watch-symbol'):''}<button class="variable-label" data-action="variable-select" data-key="${key}">${debugSymbol(n)}<span class="variable-name">${esc(n.name)}</span><span class="variable-equals">=</span><span class="variable-value ${n.kind||''} ${n.value.startsWith('{')?'object-reference':''}">${esc(n.value)}</span>${n.summary?`<span class="variable-summary">${esc(n.summary)}</span>`:''}</button>${n.navigate?`<button class="debug-value-link" data-action="debug-navigate" data-key="${key}">… Navigate</button>`:n.explore?`<button class="debug-value-link" data-action="debug-explore" data-key="${key}">… Explore Elements</button>`:n.fullValue?`<button class="debug-value-link" data-action="debug-full-value" data-key="${key}">… View</button>`:''}</div>${branch&&open?`<div role="group">${variableRows(n.children,key,depth+1,expanded)}</div>`:''}</div>`;
  }).join('');
}
function findVariable(key){const parts=key.split('-');let nodes=parts[0]==='inspector'?[debugInspector?.node]:data.debugger[parts[0]];let n;for(const index of parts.slice(1)){n=nodes?.[+index];nodes=n?.children}return n}
function refreshDebugTrees(){
  const tree=$('.debug-variables>.variable-tree');if(tree){const top=tree.scrollTop,left=tree.scrollLeft;tree.innerHTML=debugTreeContent();tree.scrollTop=top;tree.scrollLeft=left;ensureTreeTabStop(tree)}
  if(debugInspector&&$('.debug-inspector'))renderDebugInspector();
  persist();
}
function ensureTreeTabStop(tree){if(!$('.variable-row[tabindex="0"]',tree)){const row=$('.variable-row',tree);if(row)row.tabIndex=0}}
function debugTreeContent(){return state.debugFrame===0?variableRows(data.debugger.variables,'variables')+variableRows(data.debugger.watches,'watches')+(state.debugSavedWatches?`<div class="debug-saved-label">Watches</div>${variableRows(data.debugger.savedWatches,'savedWatches')}`:''):'<div class="debug-unavailable">Local variables are unavailable for this framework frame.</div>'}
function debugControl(id,title,cls=''){return `<button class="icon-button ${cls}" disabled title="${esc(title)}" aria-label="${esc(title)}">${icon(id)}</button>`}
function renderDebugger(){
  const el=$('#debugger');if(!el)return;el.hidden=!state.showDebugger;$('.debug-rail')?.classList.toggle('active',state.showDebugger);if(!state.showDebugger)return;
  el.style.height=Math.min(state.debugHeight||380,Math.max(180,innerHeight-230))+'px';
  const tabs=[['debugger','Threads & Variables'],['console','Console'],['beans','Beans | Health'],['mappings',editorIcon('spring-web')+'Mappings'],['environment',editorIcon('spring-object')+'Environment']];
  el.innerHTML=`<div class="debug-resizer" role="separator" aria-label="Resize debugger" aria-orientation="horizontal" tabindex="0"></div><header class="debug-header"><strong>Debug</strong><span class="debug-config">${icon('spring-bean')}NotifyHubApplication ${ib('close','Hide debug session','toggle-debug')}</span><span class="grow"></span>${ib('more','Debugger options','debug-options')}${ib('minus','Hide Debug','toggle-debug')}</header><div class="debug-toolbar"><nav class="debug-actions" aria-label="Debugger controls">${debugControl('refresh','Rerun','debug-rerun')}${debugControl('stop-debug','Stop','debug-stop')}<span class="debug-action-divider"></span>${debugControl('play','Resume Program','debug-resume')}${debugControl('pause','Pause Program')}<button class="icon-button" disabled title="Step Over  F8" aria-label="Step Over">${editorIcon('step-over')}</button>${debugControl('step-into-debug','Step Into')}${debugControl('step-out-debug','Step Out')}<span class="debug-action-divider"></span>${debugControl('breakpoints-debug','View Breakpoints','debug-stop')}${debugControl('mute-breakpoints-debug','Mute Breakpoints','debug-stop')}${ib('more','More debugger actions','debug-options')}</nav><div class="debug-tabs" role="tablist" aria-label="Debugger views">${tabs.map(([id,label])=>`<button role="tab" aria-selected="${state.debugTab===id}" class="${state.debugTab===id?'active':''}" data-action="debug-tab" data-tab-name="${id}">${label}</button>`).join('')}</div><span class="grow"></span>${ib('split-view','Debugger layout','debug-options')}</div>${state.debugTab==='console'?renderDebugConsole():state.debugTab==='debugger'?renderDebugVariables():renderDebugSpring()}`;
  const grip=$('.debug-resizer');grip.addEventListener('pointerdown',e=>{e.preventDefault();grip.setPointerCapture(e.pointerId);const y=e.clientY,h=el.offsetHeight;const move=ev=>{state.debugHeight=Math.max(180,Math.min(innerHeight-230,h+y-ev.clientY));el.style.height=state.debugHeight+'px'};const end=()=>{grip.removeEventListener('pointermove',move);grip.removeEventListener('pointerup',end);persist()};grip.addEventListener('pointermove',move);grip.addEventListener('pointerup',end)});
  grip.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();state.debugHeight=Math.max(180,Math.min(innerHeight-230,state.debugHeight+(e.key==='ArrowUp'?20:-20)));el.style.height=state.debugHeight+'px';persist()}});
  const split=$('.debug-frame-resizer');if(split)split.addEventListener('pointerdown',e=>{e.preventDefault();split.setPointerCapture(e.pointerId);const move=ev=>{$('.debug-frames').style.width=(state.debugFramesWidth=Math.max(160,Math.min(el.clientWidth*.6,ev.clientX-el.getBoundingClientRect().left)))+'px'};const end=()=>{split.removeEventListener('pointermove',move);split.removeEventListener('pointerup',end);persist()};split.addEventListener('pointermove',move);split.addEventListener('pointerup',end)});
  split?.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();state.debugFramesWidth=Math.max(160,Math.min(el.clientWidth*.6,(state.debugFramesWidth||280)+(e.key==='ArrowRight'?20:-20)));$('.debug-frames').style.width=state.debugFramesWidth+'px';persist()}});
  $$('.variable-tree',el).forEach(ensureTreeTabStop);
  const tree=$('.debug-variables>.variable-tree',el);if(tree){tree.scrollTop=state.debugVariableScroll||0;tree.addEventListener('scroll',()=>{state.debugVariableScroll=tree.scrollTop},{passive:true})}
}
function renderDebugVariables(){
  return `<div class="debug-body"><section class="debug-frames" aria-label="Stack frames" style="width:${state.debugFramesWidth||280}px"><div class="debug-frame-tabs"><button data-action="debug-frame-view" data-view="frames" class="${state.debugView==='frames'?'active':''}">Frames</button><button data-action="debug-frame-view" data-view="threads" class="${state.debugView==='threads'?'active':''}">Threads</button></div><div class="debug-thread"><span class="thread-check">✓</span><span class="truncate" title="&quot;${esc(data.debugger.thread)}&quot;: RUNNING">"${esc(data.debugger.thread)}": RUNNING</span>${ib('filter','Show all stack frames','debug-hidden-frames')}${icon('chevron','down')}</div><div class="frame-list" role="listbox" aria-label="Stack frames">${state.debugView==='threads'?`<button class="frame-row active" data-action="debug-frame-view" data-view="frames">${icon('chevron')} ${esc(data.debugger.thread)}</button>`:data.debugger.frames.filter((f,i)=>i===0||state.debugHiddenFrames).map((f,i)=>`<button class="frame-row ${state.debugFrame===i?'active':''}" data-action="debug-frame" data-index="${i}" role="option" aria-selected="${state.debugFrame===i}" title="${esc(f.label)}"><span class="frame-icon">${editorIcon('stack-frame')}</span><span>${esc(f.label)}</span></button>`).join('')}${!state.debugHiddenFrames&&state.debugView==='frames'?`<button class="hidden-frames" data-action="debug-hidden-frames">${data.debugger.hiddenFrames} hidden frames</button>`:''}</div><div class="debug-frame-hint">Switch frames from anywhere in the IDE with ⌥⌘↑ and ⌥⌘↓</div></section><div class="debug-frame-resizer" role="separator" aria-orientation="vertical" aria-label="Resize stack frames" tabindex="0"></div><section class="debug-variables" aria-label="Variables and watches"><div class="debug-evaluate"><span>Evaluate expression (↵) or add a watch (⇧⌘↵)</span><span class="grow"></span><span class="debug-language">Java⌃</span><button class="icon-button" disabled title="Expression evaluation is unavailable in this read-only snapshot">${icon('plus')}</button><button class="icon-button" title="Saved watches" aria-label="Saved watches" data-action="debug-saved-watches">${icon('chevron','down')}</button></div><div class="variable-tree" role="tree" aria-label="Variables and watches">${debugTreeContent()}</div></section></div>`;
}
function renderDebugConsole(){
  const lines=data.debugger.console.trimEnd().split('\n').map((l,i)=>{
    if(i===0&&l.includes(' -agentlib:jdwp='))return `<div class="console-line"><button class="console-command" data-action="debug-console-command" aria-expanded="${!!state.debugConsoleCommandExpanded}" aria-label="${state.debugConsoleCommandExpanded?'Collapse':'Expand'} Java command line" title="${state.debugConsoleCommandExpanded?'Collapse':'Expand'} command line">${esc(state.debugConsoleCommandExpanded?l:l.split(' -')[0]+' ...')}</button></div>`;
    const banner=l.match(/^(\s*:: Spring Boot ::)(\s+)(\(v[^)]+\))$/);
    if(banner)return `<div class="console-line"><span class="console-level">${esc(banner[1])}</span>${esc(banner[2]+banner[3])}</div>`;
    const m=l.match(/^(\S+)(\s+INFO\s+)(\d+)(.*?\]\s+\[.*?\]\s+)(\S+)(\s+: )(.*)$/);
    return `<div class="console-line">${m?`${esc(m[1])}<span class="console-level">${esc(m[2])}</span><span class="console-pid">${m[3]}</span>${esc(m[4])}<button class="console-class" data-action="debug-console-source" data-class="${esc(m[5])}">${esc(m[5])}</button>${esc(m[6]+m[7])}`:esc(l)}</div>`;
  }).join('');
  return `<div class="debug-console"><nav class="console-actions" aria-label="Console controls">${ib('arrow-up','Scroll console to top','debug-console-top')}${ib('arrow-down','Scroll console to bottom','debug-console-bottom')}${ib('wrap','Toggle console soft wraps','debug-console-wrap')}${ib('shelve','Scroll console to bottom','debug-console-bottom')}${debugControl('file','Print console')}${debugControl('delete-debug','Clear console')}</nav><div class="debug-console-output ${state.debugConsoleWrap?'soft-wrap':''}" tabindex="0" aria-label="Application console">${lines}<span class="console-cursor"></span></div></div>`;
}
function debugRequestMappings(){
  // Application handlers come from the source snapshot; framework/resource rows
  // reproduce the supplied running application's Mappings view.
  const controllers=buildLogicalModel(project('main').files).beans.filter(b=>b.kind==='controllers');
  const application=controllers.flatMap(c=>(c.endpoints||[]).map(ep=>({path:(c.endpointPrefix||'')+ep.label,verb:ep.verb,handler:c.name+'#'+ep.method,source:c.path,line:ep.line})));
  const rows=[
    {path:'/**'},
    {path:'/actuator',verb:'GET',handler:'WebMvcLinksHandler#links',framework:true},
    {path:'/actuator/health',verb:'GET',handler:'OperationHandler#handle',framework:true},
    {path:'/actuator/health/**',verb:'GET',handler:'OperationHandler#handle',framework:true},
    ...application,
    {path:'/error',handler:'BasicErrorController#errorHtml',framework:true},
    {path:'/error',handler:'BasicErrorController#error',framework:true},
    {path:'/webjars/**'},
  ];
  rows.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:(b.verb||'').localeCompare(a.verb||''));
  return state.debugMappingsDescending?rows.reverse():rows;
}
function renderDebugMappings(){
  const direction=state.debugMappingsDescending?'descending':'ascending';
  return `<div class="debug-mappings"><nav class="mapping-actions" aria-label="Mappings controls"><button class="icon-button" data-action="debug-mappings-refresh" title="Refresh mappings" aria-label="Refresh mappings">${editorIcon('refresh')}</button><span class="mapping-action-divider"></span><button class="icon-button" disabled title="Open in browser" aria-label="Open mapping in browser">${editorIcon('mapping-web')}</button><button class="icon-button mapping-method-action" disabled title="HTTP method" aria-label="Filter by HTTP method">${editorIcon('mapping-method')}<span aria-hidden="true"></span></button><span class="mapping-action-divider"></span><button class="icon-button mapping-table-action" disabled aria-pressed="true" title="Table view" aria-label="Mappings table view">${editorIcon('mapping-table')}</button></nav><div class="mapping-grid-scroll" tabindex="0" aria-label="Request mappings"><table class="mapping-grid" aria-label="Request mappings"><colgroup><col style="width:50%"><col style="width:50%"></colgroup><thead><tr><th scope="col" aria-sort="${direction}"><button class="mapping-sort" data-action="debug-mappings-sort" aria-label="Sort mappings by path ${state.debugMappingsDescending?'ascending':'descending'}">Path ${icon('chevron',state.debugMappingsDescending?'down':'mapping-sort-up')}</button></th><th scope="col">Method</th></tr></thead><tbody>${debugRequestMappings().map(m=>{const target=m.source?`data-action="debug-source" data-path="${esc(m.source)}" data-line="${m.line}"`:'disabled';return `<tr class="${m.framework?'mapping-framework':''}"><td>${m.handler?`<button class="mapping-path" ${target}>${esc(m.path)}</button>${m.verb?` <span class="mapping-verb">[${esc(m.verb)}]</span>`:''}`:`<span class="mapping-resource">${esc(m.path)}</span>`}</td><td>${m.handler?`<button class="mapping-handler" ${target}>${esc(m.handler)}</button>`:''}</td></tr>`}).join('')}</tbody></table></div></div>`;
}
function renderDebugSpring(){return state.debugTab==='mappings'?renderDebugMappings():state.debugTab==='beans'?renderDebugBeans():renderDebugEnvironment()}
function openDebugInspector(key,anchor){
  const n=findVariable(key);if(!n)return;closeOverlay();debugInspector={node:{...n,watch:false},expanded:{'inspector-0':true},anchor:anchor.getBoundingClientRect()};
  $('#overlay-root').innerHTML='<section class="debug-inspector" role="dialog" aria-label="'+esc(n.name)+' inspector"></section>';renderDebugInspector();
}
function renderDebugInspector(){
  const el=$('.debug-inspector');if(!el||!debugInspector)return;const r=debugInspector.anchor,w=Math.min(570,innerWidth-24);
  const scroll=$('.variable-tree',el)?.scrollTop||0;
  el.innerHTML=`<div class="variable-tree" role="tree" aria-label="${esc(debugInspector.node.name)} inspector">${variableRows([debugInspector.node],'inspector',0,debugInspector.expanded)}</div><footer><button disabled>Create renderer</button><button data-action="debug-inline-watch">Add as inline watch</button><span class="grow"></span>${ib('close','Close inspector','close-overlay')}</footer>`;
  el.style.width=w+'px';el.style.left=Math.max(8,Math.min(innerWidth-w-12,r.left))+'px';
  el.style.top=Math.max(8,Math.min(innerHeight-el.offsetHeight-12,r.bottom+2))+'px';
  const tree=$('.variable-tree',el);tree.scrollTop=scroll;ensureTreeTabStop(tree);
}
function inspectVariable(n){if(!n)return;dialog(n.name,`<div class="dialog-body value-inspector">${esc(n.fullValue||n.value)}</div>`)}
function debugSecurityMenu(anchor){
  closeOverlay();const r=anchor.getBoundingClientRect();$('#overlay-root').innerHTML=`<div class="debug-security-menu" role="menu" aria-label="Endpoint security" style="left:${Math.max(8,Math.min(innerWidth-410,r.left))}px;top:${r.bottom+4}px"><button role="menuitem" disabled>Unlock POST /api/notify</button><button role="menuitem" disabled>Unlock POST /api/notify with Custom Credentials</button><button role="menuitem" data-action="debug-security-config">Navigate to Configuration</button></div>`;
}
// The logpoint is an editor inlay, separate from the captured Java source.
function decorateSourceLogpoint(t){
  if(t.source!=='main'||t.path!==data.debugger.file)return;
  const row=$('.code-line[data-line="67"]');if(!row)return;
  const expanded=t.logpointExpanded!==false;
  const marker=`<button class="logpoint-marker" data-action="debug-logpoint-toggle" title="${expanded?'Hide':'Show'} logpoint expression · line 67" aria-label="Logpoint at line 67" aria-expanded="${expanded}" aria-controls="notification-logpoint">${editorIcon('logpoint')}</button>`;
  const inlay=document.createElement('div');inlay.className='logpoint-inlay';inlay.dataset.logpointLine='67';inlay.hidden=!expanded;
  inlay.innerHTML=`<span class="logpoint-line-number" aria-hidden="true"></span><span class="source-gutter logpoint-gutter">${expanded?marker:''}</span><div class="logpoint-expression" id="notification-logpoint" role="group" aria-label="Read-only logpoint expression at line 67" tabindex="0"><span class="logpoint-label">Log:</span><pre><code><span class="syn-str">&quot;Notification &quot;</span> + result.<span class="syn-prop">notificationId</span> +<span class="logpoint-newline" aria-hidden="true">↵</span>
<span class="logpoint-continuation" aria-hidden="true">↳ </span><span class="syn-str">&quot;dispatched: &quot;</span> + result.<span class="syn-prop">message</span></code></pre></div>`;
  row.before(inlay);
  if(!expanded)$('.source-gutter',row).innerHTML=marker;
}
function toggleSourceLogpoint(){
  const t=activeTab(),sc=$('.code-scroll');if(!sc||t?.type!=='file')return;
  const top=sc.scrollTop,left=sc.scrollLeft;
  t.logpointExpanded=t.logpointExpanded===false;
  $('.logpoint-inlay')?.remove();$('.logpoint-marker')?.remove();
  decorateSourceLogpoint(t);
  sc.scrollTop=top;sc.scrollLeft=left;t.scroll=sc.scrollTop;
  $('.logpoint-marker')?.focus({preventScroll:true});persist();
}
function debugAction(name,el,e){
  if(debugSpringAction(name,el))return true;
  switch(name){
    case 'debug-mappings-refresh':renderDebugger();return true;
    case 'debug-mappings-sort':state.debugMappingsDescending=!state.debugMappingsDescending;renderDebugger();$('.mapping-sort').focus({preventScroll:true});return true;
    case 'debug-logpoint-toggle':toggleSourceLogpoint();return true;
    case 'debug-tab':state.debugTab=el.dataset.tabName;renderDebugger();persist();return true;
    case 'debug-frame-view':state.debugView=el.dataset.view;renderDebugger();persist();return true;
    case 'debug-hidden-frames':state.debugHiddenFrames=!state.debugHiddenFrames;renderDebugger();persist();return true;
    case 'debug-frame':state.debugFrame=+el.dataset.index;if(!state.debugFrame)goToSource(data.debugger.file,65,'main');renderDebugger();persist();return true;
    case 'variable-toggle':case 'variable-select':{
      const key=el.dataset.key,n=findVariable(key);state.debugSelected=key;
      const expand=key.startsWith('inspector')?debugInspector.expanded:state.debugExpanded;
      if(name==='variable-toggle'&&n?.children?.length)expand[key]=!expand[key];
      refreshDebugTrees();$(`.variable-row[data-key="${key}"]`)?.focus({preventScroll:true});return true;
    }
    case 'debug-inspect':openDebugInspector(el.dataset.key,el);return true;
    case 'debug-full-value':inspectVariable(findVariable(el.dataset.key));return true;
    case 'debug-explore':openDebugInspector(el.dataset.key,el);return true;
    case 'debug-navigate':{const target=findVariable(el.dataset.key)?.navigate;if(target){closeOverlay();goToSource(target.path,target.line,'main')}return true}
    case 'debug-inline-watch':{const n=debugInspector.node;closeOverlay();const match=data.debugger.watches.findIndex(x=>x.name===n.name);if(match>=0){state.debugExpanded['watches-'+match]=true;state.debugSelected='watches-'+match;state.debugTab='debugger';renderDebugger();$(`[data-key="watches-${match}"]`)?.scrollIntoView({block:'nearest'})}persist();return true}
    case 'debug-security-menu':debugSecurityMenu(el);return true;
    case 'debug-security-config':{const path=Object.keys(project('main').files).find(p=>p.endsWith('/SecurityConfig.java'));const line=project('main').files[path].text.split('\n').findIndex(l=>l.includes('/api/notify'))+1;closeOverlay();goToSource(path,line,'main');return true}
    case 'debug-source':closeOverlay();goToSource(el.dataset.path,+el.dataset.line||1,'main');return true;
    case 'debug-options':{closeOverlay();const r=el.getBoundingClientRect();$('#overlay-root').innerHTML=`<div class="debug-security-menu" role="menu" style="right:${Math.max(8,innerWidth-r.right)}px;top:${r.bottom+4}px"><button role="menuitem" data-action="execution-point">Show execution point</button><button role="menuitem" data-action="debug-saved-watches">${state.debugSavedWatches?'Hide':'Show'} saved watches</button><button role="menuitem" data-action="debug-collapse">Collapse variables</button></div>`;return true}
    case 'debug-saved-watches':closeOverlay();state.debugSavedWatches=!state.debugSavedWatches;state.debugTab='debugger';renderDebugger();persist();return true;
    case 'debug-collapse':closeOverlay();state.debugExpanded={};refreshDebugTrees();return true;
    case 'debug-console-top':$('.debug-console-output').scrollTop=0;$('.debug-console-output').scrollLeft=0;return true;
    case 'debug-console-bottom':$('.debug-console-output').scrollTop=$('.debug-console-output').scrollHeight;return true;
    case 'debug-console-wrap':state.debugConsoleWrap=!state.debugConsoleWrap;renderDebugger();persist();return true;
    case 'debug-console-command':state.debugConsoleCommandExpanded=!state.debugConsoleCommandExpanded;renderDebugger();$('.console-command').focus({preventScroll:true});return true;
    case 'debug-console-source':{const cls=el.dataset.class.split('.').at(-1);const path=Object.keys(project('main').files).find(p=>base(p)===cls+'.java');if(path)goToSource(path,1,'main');return true}
  }
  return false;
}
function bindDebugInteractions(){
  bindSpringBrowserInteractions();
  document.addEventListener('click',e=>{const path=e.composedPath(),insidePopup=path.some(n=>n.matches?.('.debug-inspector,.debug-security-menu'));const row=e.target.closest('.variable-row');if(row&&!e.target.closest('button')){state.debugSelected=row.dataset.key;refreshDebugTrees()}if(insidePopup||e.target.closest('[data-action="debug-inspect"],[data-action="debug-explore"],[data-action="debug-security-menu"],[data-action="debug-options"]'))return;if($('.debug-inspector,.debug-security-menu'))closeOverlay()});
  document.addEventListener('dblclick',e=>{const row=e.target.closest('.variable-row');if(!row)return;const n=findVariable(row.dataset.key);if(n?.children?.length)debugAction('variable-toggle',{dataset:{key:row.dataset.key}});else inspectVariable(n)});
  document.addEventListener('keydown',e=>{
    const row=e.target.closest('.variable-row');if(!row||!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End','Enter',' '].includes(e.key))return;e.preventDefault();
    const tree=row.closest('.variable-tree'),rows=$$('.variable-row',tree),i=rows.indexOf(row),key=row.dataset.key,n=findVariable(key),expanded=key.startsWith('inspector')?debugInspector.expanded:state.debugExpanded;
    let target;
    if(e.key==='ArrowDown'||e.key==='ArrowUp')target=rows[Math.max(0,Math.min(rows.length-1,i+(e.key==='ArrowDown'?1:-1)))];
    else if(e.key==='Home')target=rows[0];else if(e.key==='End')target=rows.at(-1);
    else if(e.key==='Enter'||e.key===' ')n?.children?.length?debugAction('variable-toggle',{dataset:{key}}):inspectVariable(n);
    else if(n?.children?.length&&((e.key==='ArrowRight'&&!expanded[key])||(e.key==='ArrowLeft'&&expanded[key])))debugAction('variable-toggle',{dataset:{key}});
    else if(e.key==='ArrowLeft'&&key.split('-').length>2)target=$(`.variable-row[data-key="${key.slice(0,key.lastIndexOf('-'))}"]`,tree);
    else if(e.key==='ArrowRight'&&expanded[key])target=rows[i+1];
    if(target){rows.forEach(x=>{x.tabIndex=-1;x.classList.remove('selected')});target.tabIndex=0;target.classList.add('selected');state.debugSelected=target.dataset.key;target.focus();persist()}
  });
}
