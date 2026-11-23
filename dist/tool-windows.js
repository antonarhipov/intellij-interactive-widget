'use strict';
// Docked IDE tool windows. Selections are local presentation state only.
function inactiveToolWindowButton(name,label){return `<button class="icon-button inactive-tool-rail" disabled title="${esc(label)}" aria-label="${esc(label)}">${editorIcon('tool-'+name)}</button>`}
function toolWindowRail(){return `<nav class="activity-bar" aria-label="Tool windows">${ib('commit-tool','Commit (⌘0)','toggle-commit','commit-rail')}${ib('project-tool','Project (⌘1)','toggle-project','project-rail')}${ib('sessions-tool','Agent Sessions (⌘2)','toggle-sessions','sessions-rail')}<span class="rail-divider"></span>${ib('structure-tool','Structure (⌘7)','toggle-structure','structure-rail')}<span class="spacer"></span>${ib('debug','Debug (⌘5)','toggle-debug','debug-rail running-session')}${[['build','Build'],['run','Run'],['services','Services'],['terminal','Terminal'],['problems','Problems'],['vcs','Git']].map(([name,label])=>inactiveToolWindowButton(name,label)).join('')}</nav>`}
function toolWindowsShell(){return `<aside class="side-stack" aria-label="Tool windows sidebar">
  <section class="side-panel commit-panel" aria-label="Commit"><div class="side-header"><h2>Commit</h2><span class="grow"></span>${ib('more','Commit view options','commit-options')}${ib('minus','Hide Commit','toggle-commit')}</div><div id="commit-content" class="commit-content"></div></section>
  ${projectWindowShell()}
  <section class="side-panel sessions-panel" aria-label="Agent Sessions"><div class="side-header"><h2>Agent Sessions</h2><span class="grow"></span>${ib('more','Agent Sessions view options','sessions-options')}${ib('minus','Hide Agent Sessions','toggle-sessions')}</div><div class="sessions-actions">${newSessionSelector()}<button class="add-folder-preview" disabled title="Read-only project snapshot">${icon('folder')}Add Folder</button><span class="grow"></span>${ib('sliders','Filter sessions','session-filter')}${ib('search','Search sessions','session-search-toggle')}</div><div class="side-tools sessions-search-tools" hidden><label class="input-shell">${icon('search')}<input id="session-search" class="filter-input" placeholder="Search sessions" aria-label="Search sessions" autocomplete="off"></label></div><div id="session-filters" hidden class="session-filter"><label><input id="archived-toggle" type="checkbox"> Archived</label><div class="select-wrap"><select id="agent-filter" aria-label="Filter by agent"><option value="all">All agents</option><option value="codex">Codex</option><option value="claude">Claude Code</option></select></div></div><div id="session-list" class="session-list" role="list" aria-label="Agent sessions"></div>${sessionUsageWidget()}</section>
  <div class="panel-grip" role="separator" aria-label="Resize sidebar tool windows" aria-orientation="horizontal" tabindex="0"></div>
  <section class="side-panel structure-panel" aria-label="Structure"><div class="side-header"><h2>Structure</h2><div class="structure-tabs" role="tablist" aria-label="Structure views"><button class="selected" role="tab" aria-selected="true">Logical</button></div><span class="grow"></span>${ib('eye','Structure view options','logical-options')}${ib('more','Structure actions','logical-options')}${ib('minus','Hide Structure','toggle-structure')}</div><div class="logical-search" hidden><label class="input-shell">${icon('search')}<input id="logical-search" placeholder="Search components" aria-label="Search logical structure"></label>${ib('close','Close structure search','logical-search-close')}</div><div id="logical-tree" class="logical-tree" role="tree" aria-label="Spring Boot logical structure"></div></section>
</aside><div class="splitter" role="separator" aria-label="Resize sidebar" aria-orientation="vertical" tabindex="0"></div>`}
function sessionUsageWidget(){return `<div class="session-usage-area">
  <section id="ai-usage-card" class="ai-usage-card" aria-labelledby="ai-usage-plan" hidden>
    <div class="ai-usage-header"><span id="ai-usage-plan">JetBrains Team</span><span class="grow"></span><button class="icon-button" disabled aria-label="AI usage details" title="AI usage details">${editorIcon('usage-details')}</button><button class="icon-button" disabled aria-label="Refresh AI usage" title="Refresh AI usage">${editorIcon('refresh')}</button></div>
    <div class="ai-usage-monthly"><span class="ai-usage-period">Monthly</span><span class="ai-usage-progress" role="progressbar" aria-label="Monthly AI usage remaining" aria-valuemin="0" aria-valuemax="100" aria-valuenow="90" aria-valuetext="90% left till Dec 1"><span></span></span><span class="ai-usage-remaining">90% left</span><span class="ai-usage-renewal">till Dec 1</span></div>
  </section>
  <div class="session-footer"><button data-action="sessions-settings">${editorIcon('settings-small')}Settings</button><span class="grow"></span><button class="session-usage" data-action="sessions-usage" aria-expanded="false" aria-controls="ai-usage-card">AI Usage<svg class="usage-ring" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="30 4.56" transform="rotate(-90 8 8)"/></svg></button><span id="session-count" hidden></span></div>
</div>`}
function toggleSessionUsage(open=$('#ai-usage-card').hidden){
  $('#ai-usage-card').hidden=!open;
  $('[data-action="sessions-usage"]').setAttribute('aria-expanded',String(open));
}
function initToolWindowsState(stored){
  const legacy=state.tabs.find(t=>t.type==='changes'&&t.id===state.active);
  state.tabs=state.tabs.filter(t=>t.type!=='changes');
  if(legacy)state.active=state.tabs.find(t=>t.type==='session'&&t.session===data.targetSession)?.id||state.tabs[0]?.id;
  state.primaryTool=stored?.primaryTool!==undefined?stored.primaryTool:stored?.showSessions&&!stored?.showProject?'sessions':'project';
  if(!['commit','project','sessions',null].includes(state.primaryTool))state.primaryTool='project';
  if(legacy)state.primaryTool='commit';
  state.showStructure=!!stored?.showStructure;state.focusedTool=stored?.focusedTool||(state.showStructure?'structure':state.primaryTool);state.logicalExpanded=stored?.logicalExpanded||{};
  state.commitSelection=stored?.commitSelection||{};state.commitExpanded=stored?.commitExpanded!==false;
  state.commitSelected=stored?.commitSelected||project('main').changes[0]?.path;
  state.sideRatio=stored?.sideRatio||.2;
}
function renderToolWindowVisibility(){
  const primary=state.primaryTool,none=!primary&&!state.showStructure;
  state.showProject=primary==='project';state.showSessions=primary==='sessions';
  $('.side-stack').classList.toggle('hidden',none||(innerWidth<760&&!state.mobileSide));
  for(const name of ['commit','project','sessions']){
    $('.'+name+'-panel').classList.toggle('hidden',primary!==name);
    const rail=$('.'+name+'-rail');rail.classList.toggle('active',primary===name);rail.classList.toggle('unfocused',state.focusedTool!==name);rail.setAttribute('aria-pressed',String(primary===name));
  }
  $('.structure-panel').classList.toggle('hidden',!state.showStructure);$('.structure-rail').classList.toggle('active',state.showStructure);$('.structure-rail').classList.toggle('unfocused',state.focusedTool!=='structure');$('.structure-rail').setAttribute('aria-pressed',String(state.showStructure));
  $('.side-stack').classList.toggle('has-structure',!!primary&&state.showStructure);
  $('.side-stack').style.setProperty('--top-tool-ratio',state.sideRatio);
  $('.panel-grip').style.display=primary&&state.showStructure?'':'none';$('.splitter').style.display=none||innerWidth<760?'none':'';
}
function selectToolWindow(name,toggle=true){
  const revealHidden=toggle&&innerWidth<760&&!state.mobileSide;
  if(name==='structure')state.showStructure=toggle&&!revealHidden?!state.showStructure:true;
  else state.primaryTool=toggle&&!revealHidden&&state.primaryTool===name?null:name;
  state.focusedTool=name==='structure'?state.showStructure?'structure':state.primaryTool:state.primaryTool||'structure';state.mobileSide=!!state.primaryTool||state.showStructure;renderToolWindowContents();renderToolWindowVisibility();persist();
}
function renderToolWindowContents(){renderCommitWindow();renderLogicalStructure()}
function openCommit(path=state.commitSelected){
  closeOverlay();selectToolWindow('commit',false);const changes=project('main').changes;
  path=changes.some(c=>c.path===path)?path:changes[0]?.path;state.commitSelected=path;
  if(path)openDiff(path,{scope:'project',source:'main',commit:true,expandedContext:true});
}
function commitIncluded(path){return state.commitSelection[path]!==false}
function renderCommitWindow(){
  if(!$('#commit-content'))return;const changes=project('main').changes,count=changes.filter(c=>commitIncluded(c.path)).length,all=count===changes.length;
  const checkbox=(action,label,checked,extra='')=>`<button role="checkbox" aria-checked="${checked}" aria-label="${esc(label)}" class="commit-checkbox ${checked?'checked':''}" data-action="${action}" ${extra}>${checked?icon('check'):''}</button>`;
  $('#commit-content').innerHTML=`<div class="commit-toolbar" role="toolbar" aria-label="Commit tools">${ib('refresh','Refresh changes','commit-refresh')}${ib('undo','Rollback changes (read-only)','read-only-action').replace('<button','<button disabled')}${ib('review','Show diff (⌘D)','commit-show-diff')}${ib('shelve','Shelve changes (read-only)','read-only-action').replace('<button','<button disabled')}${ib('eye','Preview diff','commit-show-diff')}<span class="jd-divider"></span>${ib('target','Select active change','commit-select-active')}${ib('expand','Expand change list','commit-expand')}${ib('collapse','Collapse change list','commit-collapse')}</div>
  <div class="commit-changes" role="tree" aria-label="Commit changes"><div class="commit-change-group" role="treeitem" aria-level="1" aria-expanded="${state.commitExpanded}"><button class="commit-caret" data-action="commit-toggle-group" aria-label="${state.commitExpanded?'Collapse':'Expand'} Changes">${icon('chevron',state.commitExpanded?'down':'')}</button>${checkbox('commit-check-all','Include all changes',all)}<button data-action="commit-toggle-group" class="commit-group-label">Changes <span>${changes.length} file${changes.length===1?'':'s'}</span></button></div>${state.commitExpanded?changes.map(c=>`<div class="commit-file ${state.commitSelected===c.path?'selected':''}" role="treeitem" aria-level="2" aria-selected="${state.commitSelected===c.path}" tabindex="0" data-commit-path="${esc(c.path)}">${checkbox('commit-check','Include '+base(c.path),commitIncluded(c.path),`data-path="${esc(c.path)}"`)}<button class="commit-file-label" data-action="commit-file" data-path="${esc(c.path)}" title="${esc(c.path)}">${fileIcon(c.path)}<span>${esc(base(c.path))}</span><small>${esc(parent(c.path))}</small></button></div>`).join(''):''}</div>
  <div class="commit-message-area"><div class="commit-message-toolbar"><label><input type="checkbox" disabled>Amend <span>last commit</span>${icon('chevron','down')}</label>${ib('history','Recent commit messages','commit-message-history')}<button class="icon-button commit-generate" disabled title="Generate Commit Message (read-only)" aria-label="Generate Commit Message (read-only)">${icon('sessions-tool')}</button><span class="grow"></span><span class="commit-modified-count">${count} modified</span></div><textarea class="commit-message" aria-label="Commit message (read-only)" readonly spellcheck="false">refine security rules for dashboard service endpoints

Separate admin-only writes (POST/PUT on /api/dashboard/services) from notification operations, while keeping dashboard reads and static assets public.</textarea><div class="commit-submit"><button class="commit-primary" disabled title="Read-only prototype">Commit</button><button class="commit-push" disabled title="Read-only prototype">Commit and Push…</button><span class="grow"></span>${ib('settings','Commit options','commit-options')}</div></div>`;
  const box=$('[data-action=commit-check-all]');if(count>0&&!all)box.setAttribute('aria-checked','mixed');
}

const logicalModelCache=new Map();
function buildLogicalModel(files){
  const beans=[],kinds={Component:'components',RestController:'controllers',Controller:'controllers',Repository:'repositories',Service:'services',Configuration:'configurations'};
  for(const [path,f] of Object.entries(files)){
    if(!path.endsWith('.java')||!path.includes('/main/java/'))continue;
    const lines=f.text.split('\n'),declaration=f.text.match(/^public\s+(?:abstract\s+)?(?:class|interface)\s+(\w+)[^\n]*/m);if(!declaration)continue;
    const annotation=f.text.match(/^@(Component|RestController|Controller|Repository|Service|Configuration)\b/m);if(!annotation)continue;
    const lineOf=index=>f.text.slice(0,index).split('\n').length;
    const name=declaration[1],bean={id:name,name,path,line:lineOf(declaration.index),kind:kinds[annotation[1]],package:f.text.match(/^package\s+([^;]+)/m)?.[1]||'',beanName:name[0].toLowerCase()+name.slice(1),fields:[],endpoints:[],methods:[],definitions:[],properties:[]};
    const header=f.text.slice(0,declaration.index),prefix=header.match(/@RequestMapping\(\s*"([^"]*)"/)?.[1]||'';bean.endpointPrefix=prefix;
    for(let i=0;i<lines.length;i++){
      const field=lines[i].match(/^\s*private\s+final\s+([\w.<>, ?]+)\s+(\w+)\s*[;=]/);if(field)bean.fields.push({type:field[1].trim(),name:field[2],line:i+1});
      const prop=lines[i].match(/@Value\("\$\{([^}]+)\}"\)/);if(prop)bean.properties.push({value:prop[1],line:i+1});
      const mapping=lines[i].match(/@(Get|Post|Put|Patch|Delete)Mapping(?:\(\s*"([^"]*)"[^\n]*\))?/);
      if(mapping){const method=lines.slice(i+1,i+5).join('\n').match(/public\s+([\w<>, ?]+)\s+(\w+)\s*\(/);if(method)bean.endpoints.push({label:mapping[2]||'/',verb:mapping[1].toUpperCase(),method:method[2],returns:method[1].trim(),line:i+2});}
      const method=/^ {4}\S/.test(lines[i])&&lines.slice(i,i+6).join('\n').match(/^\s*(?:(?:public|private|protected|static|final|default|synchronized)\s+)*([\w<>?, \[\]]+)\s+(\w+)\s*\(([\s\S]*?)\)\s*(?:throws [\w, ]+)?[;{]/);
      if(method&&method[1].trim()&&!/\b(if|switch|catch|for|while|return|new|throw|record)\b/.test(method[1])&&method[2]!==name){
        const parameters=method[3].split(/,(?![^<]*>)/).map(p=>p.trim().replace(/@[\w.]+(?:\([^)]*\))?\s*/g,'').replace(/\s+\w+$/,'')).filter(Boolean).join(', ');
        const m={name:method[2],returns:method[1].trim(),parameters,line:i+1};
        if(/@Bean\b/.test(lines.slice(Math.max(0,i-2),i).join('\n')))bean.definitions.push(m);
        else bean.methods.push(m);
      }
    }
    beans.push(bean);
  }
  const byName=Object.fromEntries(beans.map(b=>[b.name,b]));
  for(const b of beans)for(const field of b.fields){
    const names=field.type.match(/[A-Z]\w*/g)||[];field.targets=[];
    for(const name of names){if(byName[name])field.targets.push(name);else for(const candidate of beans)if(new RegExp('implements\\s+[^\\n{]*\\b'+name+'\\b').test(files[candidate.path].text))field.targets.push(candidate.name);}
    field.targets=[...new Set(field.targets)];
  }
  for(const b of beans)b.usages=beans.filter(candidate=>candidate!==b&&candidate.fields.some(f=>f.targets.includes(b.name))).map(c=>c.name);
  const app=Object.entries(files).find(([p,f])=>p.endsWith('/NotifyHubApplication.java')&&f.text.includes('@SpringBootApplication'));
  return {beans,byName,application:app?{name:'NotifyHubApplication',path:app[0],line:app[1].text.split('\n').findIndex(l=>/^public class/.test(l))+1,package:'com.example.notifyhub'}:null};
}
function logicalModel(){const p=project(state.project);if(!logicalModelCache.has(p.id))logicalModelCache.set(p.id,buildLogicalModel(p.files));return logicalModelCache.get(p.id)}
function logicalNodes(){
  const model=logicalModel(),app=model.application;if(!app)return [];
  const node=(id,label,kind,extra={})=>({id,label,kind,...extra});
  function beanNode(bean,id,ancestors=[]){
    const seen=ancestors.includes(bean.name),children=[];
    if(!seen){
      if(bean.endpoints.length)children.push(node(id+'/endpoints','Endpoints '+bean.endpointPrefix,'endpoint',{open:bean.name==='NotificationController',path:bean.path,line:bean.line,children:bean.endpoints.map(e=>node(id+'/endpoint/'+e.verb+e.label,e.label,'endpoint',{detail:'['+e.verb+']  '+e.method+'(): '+e.returns,path:bean.path,line:e.line}))}));
      if(bean.kind==='configurations')children.push(node(id+'/imports','Imports','scan',{children:[]}));
      const injected=bean.fields.filter(f=>f.targets.length);
      if(injected.length||['controllers','configurations'].includes(bean.kind))children.push(node(id+'/autowires','Autowires','autowire',{open:bean.name==='NotificationController',children:injected.flatMap(f=>f.targets.map(name=>beanNode(model.byName[name],id+'/injection/'+f.name+'/'+name,[...ancestors,bean.name])))}));
      if(bean.definitions.length)children.push(node(id+'/beans','Produced Beans','category',{children:bean.definitions.map(m=>node(id+'/bean/'+m.name,m.name,'bean',{detail:m.name+' | SINGLETON',path:bean.path,line:m.line}))}));
      if(bean.usages?.length)children.push(node(id+'/usages','Autowired In','usages',{children:bean.usages.map(name=>beanNode(model.byName[name],id+'/usage/'+name,[...ancestors,bean.name]))}));
      if(bean.methods.length&&!['controllers','configurations'].includes(bean.kind))children.push(node(id+'/methods','Methods','method',{children:bean.methods.map(m=>node(id+'/method/'+m.name,m.name+'('+m.parameters+'): '+m.returns,'method',{path:bean.path,line:m.line}))}));
    }
    const detail=bean.kind==='components'?bean.beanName:bean.package+(bean.kind==='services'?' | SINGLETON':'');
    return node(id,bean.name,bean.kind==='controllers'?'endpoint':bean.kind==='repositories'?'repository':'bean',{detail,path:bean.path,line:bean.line,open:bean.kind==='controllers'&&ancestors.length===0,children});
  }
  const preferred={components:['StyleTransformer','FooterTransformer','HeaderTransformer'],controllers:['DashboardController','NotificationController','ChannelController'],repositories:['NotificationTemplateRepository','NotificationLogRepository'],services:['PushNotificationSender','DashboardService','EmailNotificationSender','ChannelService','TemplateResolver','NotificationDispatcher','SmsNotificationSender']};
  const groups=['components','controllers','repositories','services','configurations'].map(kind=>{const list=model.beans.filter(b=>b.kind===kind).sort((a,b)=>(preferred[kind]?.indexOf(a.name)??0)-(preferred[kind]?.indexOf(b.name)??0));return node('group/'+kind,kind[0].toUpperCase()+kind.slice(1)+' ('+list.length+')','category',{open:kind!=='configurations',children:list.map(b=>beanNode(b,'bean/'+b.name))})});
  const libraries=(data.logicalLibraries||[]).map(g=>node('library/'+g.jar,g.jar,'library',{children:g.configs.map(c=>node('configuration/'+c.id,c.beanName,'bean',{library:c.id,line:c.line,detail:c.beanName+' | SINGLETON'}))}));
  return [node('application',app.name,'application',{...app,label:app.name,detail:app.package,open:true,children:[node('scanned','Scanned Components','scan',{open:true,children:groups}),node('auto','Auto Configurations','auto',{children:libraries})]})];
}
let logicalVisible=[];
function renderLogicalStructure(){
  const tree=$('#logical-tree');if(!tree)return;const previousScroll=tree.scrollTop,q=(state.logicalQuery||'').toLowerCase();logicalVisible=[];
  const matches=n=>!q||(n.label+' '+(n.detail||'')).toLowerCase().includes(q)||(n.children||[]).some(matches);
  function render(n,depth){if(!matches(n))return '';const open=!!q||(state.logicalExpanded[n.id]??n.open??false),branch=!!n.children?.length;logicalVisible.push(n);
    return `<div class="logical-row ${n.id===state.logicalSelected?'selected':''}" role="treeitem" aria-level="${depth+1}" aria-selected="${n.id===state.logicalSelected}" ${branch?`aria-expanded="${open}"`:''} tabindex="${n.id===state.logicalSelected?0:-1}" data-logical-id="${esc(n.id)}" data-action="logical-select" title="${esc(n.label+(n.detail?' · '+n.detail:''))}" style="padding-left:${10+depth*8}px"><button class="logical-caret" ${branch?`data-action="logical-toggle" data-node="${esc(n.id)}" aria-label="${open?'Collapse':'Expand'} ${esc(n.label)}"`:'tabindex="-1" aria-hidden="true"'}>${branch?icon('chevron',open?'down':''):''}</button>${logicalIcon(n.kind)}<span class="logical-label">${esc(n.label).replace(/ (\(\d+\))$/,'<span class="logical-count"> $1</span>')}</span>${n.detail?`<span class="logical-detail">${esc(n.detail)}</span>`:''}</div>${branch&&open?n.children.map(c=>render(c,depth+1)).join(''):''}`;
  }
  tree.innerHTML=logicalNodes().map(n=>render(n,0)).join('')||'<div class="no-results">No matching components</div>';tree.scrollTop=previousScroll;if(!$('[tabindex="0"]',tree))$('.logical-row',tree)?.setAttribute('tabindex','0');
}
function logicalIcon(kind){const native={bean:'spring-bean',category:'spring-category',endpoint:'spring-endpoint',repository:'spring-repository',autowire:'spring-autowires',usages:'spring-usages'};return `<span class="logical-icon ${kind}" aria-hidden="true">${kind==='application'?fileIcon('NotifyHubApplication.java')+icon('spring-leaf'):kind==='method'?'<span class="logical-method">m</span>':icon(native[kind]||(kind==='library'?'library-jar':kind==='property'?'property-node':kind==='scan'?'spring-scan':'spring-leaf'))}</span>`}
function logicalFind(id,nodes=logicalNodes()){for(const n of nodes){if(n.id===id)return n;const child=logicalFind(id,n.children||[]);if(child)return child}}
function toggleLogical(id){state.focusedTool='structure';renderToolWindowVisibility();const n=logicalFind(id);if(!n?.children?.length)return;state.logicalExpanded[id]=!(state.logicalExpanded[id]??n.open??false);renderLogicalStructure();persist()}
function toolWindowMenu(title,items,anchor){diffPopup(title,items.map(([label,action])=>`<button role="menuitem" data-action="${action}">${label}</button>`).join(''),anchor)}
function toolWindowAction(name,el){
  if(projectAction(name,el))return true;
  if(el?.closest?.('.jd-menu'))closeOverlay();
  switch(name){
    case 'toggle-commit':selectToolWindow('commit');return true;
    case 'toggle-project':selectToolWindow('project');return true;
    case 'toggle-sessions':selectToolWindow('sessions');return true;
    case 'toggle-structure':selectToolWindow('structure');return true;
    case 'show-project':selectToolWindow('project',false);return true;
    case 'choose-source':selectToolWindow('project',false);$('#source-select').focus();$('#source-select').showPicker?.();return true;
    case 'reveal-file':selectToolWindow('project',false);return false;
    case 'project-changes':case 'air-review-workspace':openCommit();return true;
    case 'commit-file':state.commitSelected=el.dataset.path;openCommit(el.dataset.path);return true;
    case 'commit-show-diff':openCommit();return true;
    case 'commit-select-active':{const t=activeTab();if(t?.path&&project('main').changes.some(c=>c.path===t.path))state.commitSelected=t.path;renderCommitWindow();return true}
    case 'commit-refresh':renderCommitWindow();return true;
    case 'commit-toggle-group':state.commitExpanded=!state.commitExpanded;renderCommitWindow();persist();return true;
    case 'commit-expand':state.commitExpanded=true;renderCommitWindow();persist();return true;
    case 'commit-collapse':state.commitExpanded=false;renderCommitWindow();persist();return true;
    case 'commit-check':state.commitSelection[el.dataset.path]=!commitIncluded(el.dataset.path);renderCommitWindow();if(activeTab()?.commit)renderAirDiff(activeTab());persist();return true;
    case 'commit-check-all':{const checked=project('main').changes.every(c=>commitIncluded(c.path));project('main').changes.forEach(c=>state.commitSelection[c.path]=!checked);renderCommitWindow();if(activeTab()?.commit)renderAirDiff(activeTab());persist();return true}
    case 'commit-options':toolWindowMenu('Commit view options',[['Show Diff','commit-show-diff'],['Expand All','commit-expand'],['Collapse All','commit-collapse']],el);return true;
    case 'commit-message-history':dialog('Recent Commit Messages','<div class="dialog-body dialog-copy"><p>refine security rules for dashboard service endpoints</p></div>');return true;
    case 'project-options':toolWindowMenu('Project view options',[['Expand All','expand-all'],['Collapse All','collapse-all'],['Open Commit','project-changes']],el);return true;
    case 'sessions-options':toolWindowMenu('Agent Sessions view options',[['Search Sessions','session-search-toggle'],['Filter Sessions','session-filter']],el);return true;
    case 'sessions-settings':sessionInfo(session());return true;
    case 'sessions-usage':toggleSessionUsage();return true;
    case 'session-search-toggle':{const row=$('.sessions-search-tools');row.hidden=!row.hidden;if(!row.hidden)$('#session-search').focus();return true}
    case 'logical-select':{const n=logicalFind(el.dataset.logicalId);if(!n)return true;state.logicalSelected=n.id;state.focusedTool='structure';renderToolWindowVisibility();if(n.path)goToSource(n.path,n.line,state.project);else if(n.library)openLibrarySource(n.library,n.line);else toggleLogical(n.id);renderLogicalStructure();persist();return true}
    case 'logical-toggle':toggleLogical(el.dataset.node);return true;
    case 'logical-options':toolWindowMenu('Structure view options',[['Expand All','logical-expand-all'],['Collapse All','logical-collapse-all'],['Search Components','logical-search-open']],el);return true;
    case 'logical-expand-all':case 'logical-collapse-all':{closeOverlay();const walk=ns=>ns.forEach(n=>{state.logicalExpanded[n.id]=name==='logical-expand-all';walk(n.children||[])});walk(logicalNodes());renderLogicalStructure();persist();return true}
    case 'logical-search-open':closeOverlay();$('.logical-search').hidden=false;$('#logical-search').focus();return true;
    case 'logical-search-close':$('.logical-search').hidden=true;$('#logical-search').value='';state.logicalQuery='';renderLogicalStructure();return true;
    default:return false;
  }
}
function initToolWindows(){
  $('.session-usage-area').addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!$('#ai-usage-card').hidden){e.preventDefault();e.stopPropagation();toggleSessionUsage(false);$('[data-action="sessions-usage"]').focus()}
  });
  document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&['0','2','7'].includes(e.key)){e.preventDefault();selectToolWindow({'0':'commit','2':'sessions','7':'structure'}[e.key])}});
  $('#logical-search').addEventListener('input',e=>{state.logicalQuery=e.target.value;renderLogicalStructure()});
  $('#logical-tree').addEventListener('keydown',e=>{
    const row=e.target.closest('.logical-row');if(!row)return;const rows=$$('.logical-row'),i=rows.indexOf(row),n=logicalFind(row.dataset.logicalId);let target;
    if(e.key==='ArrowDown')target=rows[Math.min(rows.length-1,i+1)];else if(e.key==='ArrowUp')target=rows[Math.max(0,i-1)];else if(e.key==='Home')target=rows[0];else if(e.key==='End')target=rows.at(-1);
    else if(e.key==='ArrowRight'){if(n.children?.length&&row.getAttribute('aria-expanded')!=='true'){toggleLogical(n.id);target=$(`[data-logical-id="${CSS.escape(n.id)}"]`)}else target=rows[i+1]}
    else if(e.key==='ArrowLeft'){if(row.getAttribute('aria-expanded')==='true'){toggleLogical(n.id);target=$(`[data-logical-id="${CSS.escape(n.id)}"]`)}else{for(let j=i-1;j>=0;j--)if(+rows[j].getAttribute('aria-level')<+row.getAttribute('aria-level')){target=rows[j];break}}}
    else if(e.key==='Enter'||e.key===' '){e.preventDefault();toolWindowAction('logical-select',row);return}else return;
    e.preventDefault();target?.focus();target?.scrollIntoView({block:'nearest'});
  });
  $('#commit-content').addEventListener('keydown',e=>{
    const row=e.target.closest('.commit-file');
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='d'||row&&e.target===row&&e.key==='Enter'){e.preventDefault();openCommit(row?.dataset.commitPath)}
    else if(row&&e.target===row&&e.key===' '){e.preventDefault();toolWindowAction('commit-check',{dataset:{path:row.dataset.commitPath}})}
  });
  for(const button of $$('.activity-bar>.icon-button')){
    button.dataset.tooltip=button.getAttribute('title').replace(/ \((⌘\d)\)/,'  $1');button.removeAttribute('title');
  }
  renderToolWindowVisibility();
}

function librarySource(id){for(const group of data.logicalLibraries||[]){const c=group.configs.find(c=>c.id===id);if(c)return {...c,jar:group.jar}}}
function openLibrarySource(id,line){const source=librarySource(id);if(!source)return;openTab({id:'library:'+id,type:'library',library:id,path:source.path,line:line||source.line});const row=sourceLineElement(line||source.line);row?.classList.add('navigation-target');row?.scrollIntoView({block:'center'});if(innerWidth<760){state.mobileSide=false;renderShellVisibility()}}
function renderLibrarySource(t){
  const source=librarySource(t.library);if(!source){$('#content').innerHTML='<div class="no-results">Library source unavailable</div>';return}
  const lines=source.text.trimEnd().split('\n');
  $('#content').innerHTML=`<div id="file-find" ${t.findOpen?'':'hidden'}></div><div class="code-scroll library-source ${t.wrap?'soft-wrap':''}" tabindex="0" aria-label="${esc(base(t.path))} read-only library source"><div class="code-lines">${renderSourceLines(lines,t)}</div></div>`;
  initSourceEditor(t);
}
