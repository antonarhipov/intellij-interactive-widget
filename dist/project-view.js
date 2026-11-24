'use strict';
// IDEA's Project pane, backed by the same frozen project and source snapshots.
let projectTreeNodes=new Map();
const projectIcon=name=>`<img class="icon project-native-icon" src="${assetURL(`icons/project/${name}.svg`)}" alt="" aria-hidden="true">`;
const projectTool=(name,title,action,extra='')=>`<button class="icon-button" title="${esc(title)}" aria-label="${esc(title)}" data-action="${action}" ${extra}>${projectIcon(name)}</button>`;

function projectWindowShell(){return `<section class="side-panel project-panel" aria-label="Project">
  <div class="side-header project-header"><button class="project-view-selector" data-action="project-view-menu" aria-label="Project view selector" aria-haspopup="menu"><h2 id="project-view-name">Project</h2>${projectIcon('chevron-down')}</button><span class="grow"></span><div class="project-header-tools" role="toolbar" aria-label="Project tools">${projectTool('add','New File or Directory…','project-new','disabled')}<span class="project-toolbar-divider"></span>${projectTool('locate','Select Opened File (⌥F1, 1)','reveal-file')}${projectTool('expand','Expand Selected','project-expand-selected')}${projectTool('collapse','Collapse All','collapse-all')}${projectTool('more','Project view options','project-options')}${projectTool('hide','Hide Project','toggle-project')}</div></div>
  <select id="source-select" aria-label="Project snapshot" hidden><option value="main">Current version</option><option value="baseline">Before session</option></select>
  <div class="side-tools project-speed-search" hidden><label class="input-shell">${icon('search')}<input id="project-search" class="filter-input" placeholder="Search for…" aria-label="Filter project files" autocomplete="off"></label>${ib('close','Close Project search','project-search-close')}</div>
  <div class="tree-scroll" id="project-tree" role="tree" aria-label="Project files"></div>
</section>`}

function initProjectViewState(stored){
  state.projectView=stored?.projectView||'project';
  state.projectShowExtensions=!!stored?.projectShowExtensions;
  state.projectGroupTabs=stored?.projectGroupTabs!==false;
  if(stored?.projectViewVersion!==7){
    if(!stored?.width||[300,360].includes(stored.width))state.width=396;
    state.expanded=new Set(['','src','src/main','src/main/java','src/main/java/com','src/main/java/com/example','src/main/java/com/example/notifyhub','src/main/java/com/example/notifyhub/config']);
    state.selected='src/main/java/com/example/notifyhub/NotifyHubApplication.java';
  }
}

function projectLibraryTree(){
  const root={name:'External Libraries',path:'@libraries',icon:'libraries',children:{}};
  for(const group of data.logicalLibraries||[]){
    const artifact=group.jar.replace(/-4\.0\.2-sources\.jar$/,'');
    const node={name:`Maven: org.springframework.boot:${artifact}:4.0.2`,path:'@libraries/'+group.jar,icon:'jar',children:{},parent:root.path};
    root.children[group.jar]=node;
    for(const source of group.configs){
      let folder=node;
      const parts=source.path.split('/');
      parts.forEach((name,i)=>{
        const path=node.path+'/'+parts.slice(0,i+1).join('/');
        folder.children[name]||={name,path,parent:folder.path,children:{},file:i===parts.length-1,library:i===parts.length-1?source.id:null,icon:i===parts.length-1?'class':'package'};
        folder=folder.children[name];
      });
    }
  }
  return root;
}

function projectNodeIcon(node){
  if(node.icon)return projectIcon(node.icon);
  const path=node.path,name=node.name;
  if(!node.file){
    if(!path)return projectIcon('module');
    if(/src\/test\/java$/.test(path))return projectIcon('test-source');
    if(/\/java$/.test(path))return projectIcon('source');
    if(/src\/test\/resources$/.test(path))return projectIcon('test-resources');
    if(/\/resources$/.test(path))return projectIcon('resources');
    return projectIcon(path.includes('/java/')?'package':'folder');
  }
  if(path.endsWith('.java')){
    const text=project().files[path]?.text||'';
    if(/^@(Configuration|SpringBootApplication)\b/m.test(text))return projectIcon('spring-factory');
    if(/^@Repository\b/m.test(text)||/extends\s+JpaRepository\b/.test(text))return projectIcon('spring-repository');
    if(/^@(Service|Component|RestController|Controller)\b/m.test(text))return projectIcon('spring-class');
    return projectIcon(/\binterface\s+\w+/.test(text)?'interface':/\brecord\s+\w+/.test(text)?'record':/\benum\s+\w+/.test(text)?'enum':/extends\s+\w*Exception\b/.test(text)?'exception':'class');
  }
  const type=name==='pom.xml'?'maven':name==='docker-compose.yaml'?'compose':name==='Dockerfile'?'docker':/^(\.gitignore|\.dockerignore)$/.test(name)?'ignored':name==='mvnw'?'shell':name.endsWith('.cmd')?'windows':({md:'markdown',yml:'yaml',yaml:'yaml',properties:'properties',xml:'xml',sql:'sql',html:'html',css:'css',js:'js'})[name.split('.').pop()]||'text';
  return projectIcon(type);
}

function renderProjectTree(){
  const el=$('#project-tree');if(!state||!el)return;
  const query=state.projectQuery.toLowerCase(),root=buildTree();root.projectRoot=true;
  const roots=[root];if(state.projectView!=='files')roots.push(projectLibraryTree());
  projectTreeNodes=new Map();visibleTree=[];let html='';
  const matches=node=>node.path.toLowerCase().includes(query)||node.name.toLowerCase().includes(query)||Object.values(node.children).some(matches);
  const render=(node,depth,parentPath)=>{
    node.parent=parentPath;projectTreeNodes.set(node.path,node);
    if(query&&!matches(node))return;
    const open=state.expanded.has(node.path)||!!query,selected=state.selected===node.path;
    const file=project().files[node.path],label=!state.projectShowExtensions&&node.file&&node.name.endsWith('.java')?node.name.slice(0,-5):node.name;
    visibleTree.push(node);
    html+=`<div class="tree-row ${node.projectRoot?'module-root':''} ${file?.status||''} ${selected?'selected':''}" role="treeitem" aria-level="${depth+1}" aria-label="${esc(label)}" ${!node.file?`aria-expanded="${open}"`:''} aria-selected="${selected}" tabindex="${selected?0:-1}" data-path="${esc(node.path)}" data-kind="${node.file?'file':'folder'}" title="${esc(node.projectRoot?project().root:node.library?librarySource(node.library)?.path:node.path)}" style="padding-left:${depth*8}px"><span class="tree-caret">${node.file?'':projectIcon(open?'chevron-down':'chevron')}</span>${projectNodeIcon(node)}<span class="tree-label">${esc(label)}</span>${node.projectRoot?`<span class="project-root-location">${esc(project().root.replace(/^\/Users\/[^/]+/,'~'))}</span>`:''}</div>`;
    const children=Object.values(node.children).sort((a,b)=>Number(!!a.file)-Number(!!b.file)||a.name.localeCompare(b.name));
    if(open)children.forEach(child=>render(child,depth+1,node.path));
    else {const index=child=>{projectTreeNodes.set(child.path,child);Object.values(child.children).forEach(n=>{n.parent=child.path;index(n)})};children.forEach(child=>{child.parent=node.path;index(child)})}
  };
  roots.forEach(node=>render(node,0,null));el.innerHTML=html||'<div class="no-results">No matching files</div>';
  if(!$('.tree-row[tabindex="0"]',el))$('.tree-row',el)?.setAttribute('tabindex','0');
  $('#project-view-name').textContent=state.projectView==='files'?'Project Files':'Project';
}

function projectFocus(path){
  const rows=$$('.tree-row',$('#project-tree')),target=rows.find(row=>row.dataset.path===path);if(!target)return;
  state.selected=path;rows.forEach(row=>{const selected=row===target;row.tabIndex=selected?0:-1;row.classList.toggle('selected',selected);row.setAttribute('aria-selected',String(selected))});
  target.focus({preventScroll:true});target.scrollIntoView({block:'nearest',inline:'nearest'});persist();
}
function projectRowClick(row){
  const node=projectTreeNodes.get(row.dataset.path);if(!node)return;
  state.selected=node.path;
  if(!node.file){state.expanded.has(node.path)?state.expanded.delete(node.path):state.expanded.add(node.path);renderTree()}
  else if(node.library)openLibrarySource(node.library);
  else openFile(node.path);
  projectFocus(node.path);
}
function projectTreeKey(event){
  const row=event.target.closest('.tree-row');if(!row)return;
  const rows=$$('.tree-row',$('#project-tree')),i=rows.indexOf(row),node=projectTreeNodes.get(row.dataset.path);let target;
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='d'){
    if(project().files[node.path]?.status){event.preventDefault();openDiff(node.path,{scope:'project',source:state.project})}return;
  }
  if(!event.metaKey&&!event.ctrlKey&&!event.altKey&&event.key.length===1&&event.key!==' '){event.preventDefault();projectSearch(event.key);return}
  if(event.key==='ArrowDown')target=rows[Math.min(rows.length-1,i+1)];
  else if(event.key==='ArrowUp')target=rows[Math.max(0,i-1)];
  else if(event.key==='Home')target=rows[0];else if(event.key==='End')target=rows.at(-1);
  else if(event.key==='ArrowRight'&&!node.file){if(!state.expanded.has(node.path)){state.expanded.add(node.path);renderTree();target=$$('.tree-row').find(r=>r.dataset.path===node.path)}else target=rows[i+1]}
  else if(event.key==='ArrowLeft'){if(!node.file&&state.expanded.has(node.path)){state.expanded.delete(node.path);renderTree();target=$$('.tree-row').find(r=>r.dataset.path===node.path)}else target=rows.find(r=>r.dataset.path===node.parent)}
  else if(event.key==='Enter'||event.key===' '){event.preventDefault();projectRowClick(row);return}else return;
  event.preventDefault();if(target)projectFocus(target.dataset.path);persist();
}

function projectMenu(title,items,anchor,point){
  const rect=anchor.getBoundingClientRect();closeOverlay();overlayPreviousFocus=document.activeElement;
  const width=260,left=Math.max(8,Math.min(innerWidth-width-8,point?.x??rect.left)),top=Math.min(innerHeight-320,point?.y??rect.bottom+4);
  $('#overlay-root').innerHTML=`<div class="jd-menu-backdrop" data-action="close-overlay"></div><div class="jd-menu project-menu" role="menu" aria-label="${esc(title)}" style="left:${left}px;top:${Math.max(8,top)}px;width:${width}px">${items.map(item=>item==='-'?'<div class="jd-menu-divider"></div>':`<button role="${item.checked!==undefined?'menuitemcheckbox':'menuitem'}" ${item.checked!==undefined?`aria-checked="${item.checked}"`:''} data-action="${item.action}" ${item.path!==undefined?`data-path="${esc(item.path)}"`:''} ${item.value?`data-value="${esc(item.value)}"`:''} ${item.disabled?'disabled':''}><span class="project-menu-check">${item.checked?icon('check'):''}</span><span>${esc(item.label)}</span>${item.shortcut?`<small>${esc(item.shortcut)}</small>`:''}</button>`).join('')}</div>`;
  const buttons=$$('.project-menu button:not(:disabled)');buttons[0]?.focus();
  buttons.forEach((button,i)=>button.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus()}}));
}
function projectSearch(initial){
  $('.project-speed-search').hidden=false;const input=$('#project-search');
  if(initial!==undefined){input.value=initial;state.projectQuery=initial;renderTree()}
  input.focus();
}
function openProjectToolMenu(anchor){
  if(anchor.getAttribute('aria-expanded')==='true'){closeOverlay();return}
  closeOverlay();overlayPreviousFocus=anchor;
  const r=anchor.getBoundingClientRect(),width=Math.min(303,innerWidth-16);
  const row=(label,action,extra='',symbol='',hint='')=>`<button class="session-tool-row" role="menuitem" aria-label="${esc(label)}" data-action="${action}" ${extra}><span class="session-tool-icon">${symbol}</span><span>${label}</span>${hint?`<span class="session-tool-hint">${hint}</span>`:''}${action.endsWith('submenu')?icon('chevron'):''}</button>`;
  const group=(label,key)=>row(label,'project-tool-submenu',`data-project-menu="${key}" aria-haspopup="menu" aria-expanded="false"`);
  $('#overlay-root').innerHTML=`<div class="sessions-menu session-tool-menu project-tool-menu" role="menu" aria-label="Project view options" style="left:${Math.max(8,Math.min(innerWidth-width-8,r.left+9))}px;top:${Math.max(8,Math.min(innerHeight-320,r.top+10))}px;width:${width}px">${group('Behavior','behavior')}${group('Appearance','appearance')}${group('Sort By','sort')}${row('Edit Scopes…','project-native-dismiss')}<hr role="separator">${row('Speed Search','project-search-open','',editorIcon('session-search'),'⌘F or any symbol')}<hr role="separator">${row('Group Tabs','project-group-tabs',`aria-checked="${state.projectGroupTabs}"`,state.projectGroupTabs?icon('check'):'').replace('role="menuitem"','role="menuitemcheckbox"')}${['View Mode','Move to','Resize'].map((label,i)=>row(label,'session-tool-submenu',`data-tool-menu="${i}" aria-haspopup="menu" aria-expanded="false"`)).join('')}<hr role="separator">${row('Remove from Sidebar','project-native-dismiss')}<hr role="separator">${row('Help','about','','<span class="project-help-symbol" aria-hidden="true">?</span>')}</div>`;
  anchor.setAttribute('aria-expanded','true');$('.project-tool-menu button').focus({preventScroll:true});
  $$('.project-tool-menu>button').forEach(button=>button.addEventListener('pointerenter',()=>{
    button.focus({preventScroll:true});
    if(button.dataset.projectMenu)openProjectToolSubmenu(button);
    else{closeProjectToolSubmenu();if(button.dataset.toolMenu!==undefined)openSessionToolSubmenu(button);else closeSessionToolSubmenu()}
  }));
}
function closeProjectToolSubmenu(){
  const anchor=$('.project-tool-menu [data-project-menu][aria-expanded="true"]');$('.project-tool-submenu')?.remove();anchor?.setAttribute('aria-expanded','false');return anchor;
}
function openProjectToolSubmenu(anchor,focus=false){
  closeSessionToolSubmenu();closeProjectToolSubmenu();anchor.setAttribute('aria-expanded','true');
  const key=anchor.dataset.projectMenu,items=key==='appearance'?[
    {label:'Show File Extensions',action:'project-extensions',checked:state.projectShowExtensions},
    {label:'Show Members',checked:false,disabled:true},{label:'Show Visibility Icons',checked:false,disabled:true},
  ]:key==='behavior'?[
    {label:'Open Files with Single Click',checked:true,disabled:true},
    {label:'Open Directories with Single Click',checked:true,disabled:true},
    {label:'Always Select Opened File',checked:false,disabled:true},
  ]:[{label:'Name',checked:true,action:'project-native-dismiss'},{label:'Type',checked:false,disabled:true},{label:'Modification Time (Newest First)',checked:false,disabled:true},{label:'Modification Time (Oldest First)',checked:false,disabled:true},'-',{label:'Folders Always on Top',checked:true,disabled:true}];
  const root=$('.project-tool-menu').getBoundingClientRect(),r=anchor.getBoundingClientRect(),width=key==='appearance'?225:274;
  const content=items.map(item=>item==='-'?'<hr role="separator">':`<button class="session-menu-choice" role="menuitemcheckbox" aria-checked="${item.checked}" ${item.disabled?'disabled':`data-action="${item.action}"`}><span class="session-option-check">${item.checked?icon('check'):''}</span><span>${item.label}</span></button>`).join('');
  $('#overlay-root').insertAdjacentHTML('beforeend',`<div class="sessions-menu session-tool-submenu project-tool-submenu" role="menu" aria-label="${esc(anchor.children[1].textContent)}" style="left:${root.right+width<innerWidth-8?root.right-3:Math.max(8,root.left-width+3)}px;top:${r.top-7}px;width:${width}px">${content}</div>`);
  const sub=$('.project-tool-submenu');sub.style.top=Math.max(8,Math.min(innerHeight-sub.offsetHeight-8,r.top-7))+'px';if(focus)($('button:not(:disabled)',sub)||sub).focus({preventScroll:true});
}
function projectAction(name,el){
  switch(name){
    case 'project-view-menu':projectMenu('Project views',[{label:'Project',action:'project-set-view',value:'project',checked:state.projectView==='project'},{label:'Project Files',action:'project-set-view',value:'files',checked:state.projectView==='files'},'-',{label:'Project Snapshot…',action:'choose-source'}],el);return true;
    case 'project-set-view':closeOverlay();state.projectView=el.dataset.value;renderTree();persist();return true;
    case 'project-options':openProjectToolMenu(el);return true;
    case 'project-tool-submenu':openProjectToolSubmenu(el,true);return true;
    case 'project-native-dismiss':closeOverlay();return true;
    case 'project-group-tabs':closeOverlay();state.projectGroupTabs=!state.projectGroupTabs;persist();return true;
    case 'project-extensions':closeOverlay();state.projectShowExtensions=!state.projectShowExtensions;renderTree();persist();return true;
    case 'project-search-open':closeOverlay();projectSearch();return true;
    case 'project-search-close':$('.project-speed-search').hidden=true;$('#project-search').value='';state.projectQuery='';renderTree();projectFocus(state.selected);return true;
    case 'choose-source':projectMenu('Project snapshot',[{label:'Current version',action:'project-snapshot',value:'main',checked:state.project==='main'},{label:'Before session',action:'project-snapshot',value:'baseline',checked:state.project==='baseline'}],el);return true;
    case 'project-snapshot':closeOverlay();state.project=el.dataset.value;$('#source-select').value=state.project;renderSidebar();persist();return true;
    case 'project-expand-selected':{const selected=projectTreeNodes.get(state.selected)||projectTreeNodes.get('');const node=selected.file?projectTreeNodes.get(selected.parent):selected;const expand=n=>{if(!n.file){state.expanded.add(n.path);Object.values(n.children).forEach(expand)}};expand(node);renderTree();persist();return true}
    case 'project-context-open':closeOverlay();{const row=$$('.tree-row').find(r=>r.dataset.path===el.dataset.path);if(row)projectRowClick(row)}return true;
    case 'project-context-diff':closeOverlay();openDiff(el.dataset.path,{scope:'project',source:state.project});return true;
    default:return false;
  }
}
function initProjectView(){
  const more=$('.project-panel [data-action="project-options"]');more.setAttribute('aria-haspopup','menu');more.setAttribute('aria-expanded','false');
  const tree=$('#project-tree');tree.addEventListener('keydown',projectTreeKey);
  tree.addEventListener('contextmenu',e=>{const row=e.target.closest('.tree-row');if(!row)return;e.preventDefault();projectFocus(row.dataset.path);const node=projectTreeNodes.get(row.dataset.path);projectMenu('Project file actions',[{label:node.file?'Open':'Expand / Collapse',action:'project-context-open',path:node.path},...(node.file&&!node.library?[{label:'Show Diff',action:'project-context-diff',path:node.path,disabled:!project().files[node.path]?.status,shortcut:'⌘D'}]:[])],row,{x:e.clientX,y:e.clientY})});
  $('#project-search').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();projectAction('project-search-close')}else if(e.key==='ArrowDown'){e.preventDefault();$('.tree-row',$('#project-tree'))?.focus()}});
}
