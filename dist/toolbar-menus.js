'use strict';
// Branch names captured from the NotifyHub checkout on 22 November 2026.
// These menus browse the fixture and never run Git or open another project.
const toolbarVcsRefs={local:['main','demo/air-recording-t5','demo/air-recording'],remote:['origin/main','origin/extended'],tags:['air-demo-t7-base','air-demo-t8-base','air-demo-t9-base','air-recording-base-20261118','backup-air-before-t4-20261118','backup-air-rehearsal-20261118','backup-air-t3-20261118','backup-air-t3-worktree-20261118','backup/air-t6-before-t7','backup/air-t7-before-t8','backup/air-t8-before-t9','demo-air-t5-base-103dc40']};
const toolbarVcsExpanded=new Set(['recent','local','remote/origin']);
let toolbarVcsQuery='';
const toolbarVcsActions=[
  {id:'update',label:'Update Project…',icon:'vcs-update',shortcut:'⌘T'},
  {id:'commit',label:'Commit…',icon:'vcs-commit',shortcut:'⌘K'},
  {id:'push',label:'Push…',icon:'vcs-push',shortcut:'⇧⌘K'},
  {id:'new-branch',label:'New Branch…',icon:'toolbar-add',shortcut:'⌥⌘N'},
  {id:'new-worktree',label:'New Worktree…',icon:'vcs-worktree'},
  {id:'checkout',label:'Checkout Tag or Revision…'}
];
function toolbarBranchIcon(){return editorIcon('vcs-branch').replace('class="icon"','class="icon vcs-branch-icon"')}
function toolbarBrowsingWidgets(){return `<button class="toolbar-project" data-action="toolbar-project-menu" aria-label="notify-hub" aria-haspopup="menu" aria-expanded="false"><span class="project-logo" aria-hidden="true">NH</span><span>notify-hub</span>${editorIcon('chevron')}</button><span class="divider"></span><button class="toolbar-branch" data-action="toolbar-vcs-menu" title="Git Branch: main" aria-label="Git Branch: main" aria-haspopup="dialog" aria-expanded="false">${toolbarBranchIcon()}<span id="toolbar-branch">main</span>${editorIcon('chevron')}</button>`}
function toolbarPopupRow(label,iconName,action='toolbar-menu-dismiss',extra=''){
  return `<button class="toolbar-popup-row" role="menuitem" data-action="${action}" ${extra}>${iconName?editorIcon(iconName).replace('class="icon"',`class="icon ${['toolbar-home','vcs-branch'].includes(iconName)?'vcs-branch-icon':''}"`):'<span class="toolbar-icon-space"></span>'}<span>${esc(label)}</span></button>`;
}
function toolbarProjectMenu(){
  const path=project('main').root.replace(/^\/Users\/[^/]+/,'~');
  return `${toolbarPopupRow('New Project…','toolbar-add')}${toolbarPopupRow('Open…','toolbar-open')}${toolbarPopupRow('Clone Repository…','vcs-branch')}<hr role="separator">${toolbarPopupRow('IntelliJ IDEA Home','toolbar-home')}<hr role="separator"><div class="open-projects-heading">Open Projects</div><button class="open-project-card" role="menuitem" aria-current="true" data-action="toolbar-menu-dismiss"><span class="project-logo" aria-hidden="true">NH</span><span class="open-project-name">notify-hub</span><span class="open-project-path">${esc(path)}</span><span class="open-project-branch">${toolbarBranchIcon()}${esc(project('main').branch)}</span></button>`;
}
function openToolbarDropdown(kind,anchor){
  if(anchor.getAttribute('aria-expanded')==='true'){closeOverlay();return}
  closeOverlay();overlayPreviousFocus=anchor;
  const vcs=kind==='toolbar-vcs-menu',r=anchor.getBoundingClientRect(),width=Math.min(vcs?414:560,innerWidth-16);
  const left=Math.max(8,Math.min(innerWidth-width-8,r.left-6)),top=r.bottom+4;
  $('#overlay-root').innerHTML=`<section class="native-toolbar-menu toolbar-popup ${vcs?'vcs-dropdown':'project-dropdown'}" role="${vcs?'dialog':'menu'}" aria-label="${vcs?'Git Branch: '+esc(project().branch):'Projects'}" style="left:${left}px;top:${top}px;width:${width}px;--toolbar-popup-space:${Math.max(80,innerHeight-top-8)}px">${vcs?`<div class="vcs-popup-header"><label class="vcs-popup-search">${editorIcon('search')}<input type="text" placeholder="Search for branches and actions" aria-label="Search for branches and actions" autocomplete="off" spellcheck="false"></label><button class="icon-button" disabled title="Fetch" aria-label="Fetch">${editorIcon('vcs-fetch')}</button><button class="icon-button" disabled title="Settings" aria-label="Git branch settings">${editorIcon('settings-small')}</button></div><div class="vcs-popup-body"></div>`:toolbarProjectMenu()}</section>`;
  anchor.setAttribute('aria-expanded','true');
  if(vcs){
    toolbarVcsQuery='';renderToolbarVcs();
    const search=$('.vcs-popup-search input');search.addEventListener('input',()=>{toolbarVcsQuery=search.value;renderToolbarVcs()});
    $('.vcs-popup-body').addEventListener('pointermove',e=>{const row=e.target.closest('[data-vcs-row]');if(row)selectToolbarVcsRow(row)});
    $('.vcs-popup-body').addEventListener('focusin',e=>{const row=e.target.closest('[data-vcs-row]');if(row)selectToolbarVcsRow(row)});
    search.focus();
  }else $('.project-dropdown [role="menuitem"]')?.focus();
}
function toolbarVcsNodes(){
  const leaf=(id,label,ref,extra={})=>({id,label,ref,...extra});
  const local=id=>[
    leaf(id+'/main','main','main',{current:true,tracking:'origin/main'}),
    {id:id+'/demo',label:'demo',children:toolbarVcsRefs.local.filter(x=>x.startsWith('demo/')).map(ref=>leaf(id+'/'+ref,ref.slice(5),ref))}
  ];
  return [{id:'recent',label:'Recent',children:local('recent')},{id:'local',label:'Local',children:local('local')},
    {id:'remote',label:'Remote',children:[{id:'remote/origin',label:'origin',children:toolbarVcsRefs.remote.map(ref=>leaf('remote/'+ref,ref.slice(7),ref,{favorite:ref==='origin/main'}))}]},
    {id:'tags',label:'Tags',children:toolbarVcsRefs.tags.map(ref=>leaf('tags/'+ref,ref,ref,{tag:true}))}];
}
function renderToolbarVcs(){
  const body=$('.vcs-popup-body');if(!body)return;
  const q=toolbarVcsQuery.trim().toLowerCase(),matches=node=>node.label.toLowerCase().includes(q)||node.ref?.toLowerCase().includes(q)||node.children?.some(matches);
  const actionHTML=toolbarVcsActions.map((a,i)=>`${i===3&&!q?'<hr role="separator">':''}${!q||a.label.toLowerCase().includes(q)?toolbarPopupRow(a.label,a.icon,'toolbar-vcs-action',`data-vcs-row="action/${a.id}" data-command="${a.id}"`).replace('</button>',`${a.shortcut?`<span class="toolbar-shortcut">${a.shortcut}</span>`:''}</button>`):''}`).join('');
  let visibleNodes=0;
  function tree(nodes,level=1,parent='',inheritedMatch=false){
    return nodes.filter(n=>!q||inheritedMatch||matches(n)).map(n=>{
      visibleNodes++;
      const children=!!n.children,expanded=children&&(!!q||toolbarVcsExpanded.has(n.id));
      const caret=children?editorIcon('chevron'):'',image=n.current?editorIcon('vcs-current'):n.favorite?editorIcon('vcs-favorite'):n.tag?editorIcon('vcs-tag'):level>1&&children?editorIcon('toolbar-open'):!children?toolbarBranchIcon():'';
      return `<button class="vcs-tree-row toolbar-popup-row" role="treeitem" aria-level="${level}" aria-selected="false" ${children?`aria-expanded="${expanded}"`:''} data-action="${children?'toolbar-vcs-toggle':'toolbar-menu-dismiss'}" data-vcs-row="${esc(n.id)}" data-vcs-parent="${esc(parent)}" style="--vcs-depth:${level-1}"><span class="vcs-tree-caret ${expanded?'expanded':''}">${caret}</span>${image}<span class="vcs-tree-label">${esc(n.label)}</span>${n.tracking?`<span class="vcs-tracking">${esc(n.tracking)}</span>`:''}${children?'':`<span class="vcs-leaf-arrow">${editorIcon('chevron')}</span>`}</button>${expanded?tree(n.children,level+1,n.id,inheritedMatch||n.label.toLowerCase().includes(q)):''}`;
    }).join('');
  }
  const treeHTML=tree(toolbarVcsNodes());
  body.innerHTML=`${actionHTML?`<div class="vcs-action-list" role="menu" aria-label="Git actions">${actionHTML}</div>`:''}${actionHTML&&treeHTML?'<hr role="separator">':''}${treeHTML?`<div class="vcs-branches" role="tree" aria-label="Git branches">${treeHTML}</div>`:''}${!actionHTML&&!visibleNodes?'<div class="vcs-no-results">Nothing to show</div>':''}`;
  selectToolbarVcsRow($('[data-vcs-row]',body));
}
function selectToolbarVcsRow(row){
  if(!row)return;
  $$('.vcs-popup-body [data-vcs-row]').forEach(item=>{const selected=item===row;item.classList.toggle('selected',selected);if(item.getAttribute('role')==='treeitem')item.setAttribute('aria-selected',selected)});
}
function toggleToolbarVcsGroup(row,expand){
  const id=row.dataset.vcsRow,open=expand??!toolbarVcsExpanded.has(id);
  if(open)toolbarVcsExpanded.add(id);else toolbarVcsExpanded.delete(id);
  renderToolbarVcs();
  const next=$$('[data-vcs-row]').find(x=>x.dataset.vcsRow===id);next?.focus({preventScroll:true});
}
function toolbarVcsKeydown(e){
  const popup=$('.vcs-dropdown');if(!popup)return false;
  const rows=$$('[data-vcs-row]',popup),input=e.target.matches('input'),index=rows.indexOf(document.activeElement);
  if(input&&e.key==='Enter'){e.preventDefault();$('.vcs-popup-body .selected')?.click();return true}
  let next;
  if(e.key==='ArrowDown')next=input?0:(index+1)%rows.length;
  else if(e.key==='ArrowUp')next=input?rows.length-1:(index-1+rows.length)%rows.length;
  else if(!input&&e.key==='Home')next=0;
  else if(!input&&e.key==='End')next=rows.length-1;
  else if(!input&&['ArrowLeft','ArrowRight'].includes(e.key)){
    e.preventDefault();const row=rows[index];if(!row)return true;
    const expanded=row.getAttribute('aria-expanded');
    if(expanded!==null&&(e.key==='ArrowRight'&&expanded==='false'||e.key==='ArrowLeft'&&expanded==='true'))toggleToolbarVcsGroup(row,e.key==='ArrowRight');
    else if(e.key==='ArrowRight'&&expanded==='true')next=index+1;
    else if(e.key==='ArrowLeft')next=rows.findIndex(x=>x.dataset.vcsRow===row.dataset.vcsParent);
    else return true;
  }else return input;
  if(next!==undefined){e.preventDefault();const row=rows[next];row?.focus({preventScroll:true});row?.scrollIntoView({block:'nearest'});return true}
  return false;
}
function toolbarDropdownAction(name,el){
  if(['toolbar-project-menu','toolbar-vcs-menu'].includes(name)){openToolbarDropdown(name,el);return true}
  if(name==='toolbar-vcs-toggle'){toggleToolbarVcsGroup(el);return true}
  if(name==='toolbar-vcs-action'){closeOverlay();if(el.dataset.command==='commit')openCommit();return true}
  if(name==='toolbar-menu-dismiss'){closeOverlay();return true}
  return false;
}
