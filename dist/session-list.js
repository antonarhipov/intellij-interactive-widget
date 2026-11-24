'use strict';
// Air's session browser. Options only change the presentation of the snapshot.
const sessionMenuChoices={
  mode:[['active','Active'],['done','Done'],['all','All']],
  show:[['showTime','Time'],['showCost','Cost'],['showChanges','Changes']],
  statuses:[['inProgress','In Progress'],['inputRequired','Input Required'],['unread','Unread'],['draft','Draft']],
  limit:[['5','5 Sessions'],['10','10 Sessions'],['15','15 Sessions'],['0','All Sessions']],
  group:[['date','Date'],['status','Status'],['unread','Unread'],['project','Project'],['none','None']],
};
let sessionsMenuKey=null;
function initSessionsState(stored){
  state.sessionsView={mode:'active',showTime:true,showCost:true,showChanges:true,statuses:[],limit:15,group:'none',serviceSessions:false,...stored?.sessionsView};
  const view=state.sessionsView;
  if(!sessionMenuChoices.mode.some(([id])=>id===view.mode))view.mode='active';
  if(!sessionMenuChoices.group.some(([id])=>id===view.group))view.group='none';
  if(![0,5,10,15].includes(view.limit))view.limit=15;
  view.statuses=(Array.isArray(view.statuses)?view.statuses:[]).filter(id=>sessionMenuChoices.statuses.some(([key])=>id===key));
  state.sessionsExpanded={};state.sessionGroupsCollapsed={};state.sessionQuery='';
}
function sessionsWindowShell(){return `<section class="side-panel sessions-panel" aria-label="Agent Sessions"><div class="side-header"><h2>Agent Sessions</h2><span class="grow"></span>${ib('more','Agent Sessions view options','sessions-options')}${ib('minus','Hide Agent Sessions','toggle-sessions')}</div><div class="sessions-actions">${newSessionSelector()}<button class="add-folder-preview" disabled title="Read-only project snapshot">${icon('folder')}Add Folder</button><span class="grow"></span><button class="icon-button" data-action="session-filter" aria-label="Filter and View Options" title="Filter and View Options" aria-haspopup="menu" aria-expanded="false">${editorIcon('session-filters')}</button><button class="icon-button" data-action="session-search-toggle" aria-label="Search Sessions" title="Search Sessions">${editorIcon('session-search')}</button></div><div class="sessions-search-tools" hidden><label class="sessions-search-field">${editorIcon('session-search')}<input id="session-search" aria-label="Search sessions" autocomplete="off" spellcheck="false"></label><button class="icon-button" data-action="session-search-close" aria-label="Close Search" title="Close Search">${editorIcon('session-close')}</button></div><div id="session-list" class="session-list" role="list" aria-label="Agent sessions"></div>${sessionUsageWidget()}</section>`}
function sessionTimestamp(s){return Number(s.updatedAt||s.createdAt||s.turns?.at(-1)?.timestamp)||0}
function sessionAge(timestamp,now=Date.now()){
  const minutes=Math.max(0,Math.floor((now-timestamp)/60000));
  if(minutes<1)return 'now';if(minutes<60)return minutes+'m';
  const hours=Math.floor(minutes/60);if(hours<24)return hours+'h';
  const days=Math.floor(hours/24);if(days<30)return days+'d';
  if(days<365)return Math.floor(days/30)+'mo';return Math.floor(days/365)+'y';
}
function sessionStatus(s){return s.status||'ready'}
function sessionListView(){return autoTour?.playing?{...state.sessionsView,mode:'all',statuses:[],limit:0,group:'none'}:state.sessionsView}
function filteredSessions(view=sessionListView()){
  const q=state.sessionQuery.trim().toLowerCase();
  const sessions=data.sessions.filter(s=>
    (view.mode==='all'||(view.mode==='done')===!!s.archived)&&
    (view.serviceSessions||!s.serviceSession)&&
    (!view.statuses.length||view.statuses.includes(sessionStatus(s)))&&
    (!q||[s.title,s.id,...s.turns.map(t=>t.prompt||'')].join(' ').toLowerCase().includes(q))
  );
  return view.limit?sessions.slice(0,view.limit):sessions;
}
function sessionGroupLabel(s,view){
  switch(view.group){
    case 'date':return new Intl.DateTimeFormat('en',{month:'short',day:'numeric',year:'numeric'}).format(sessionTimestamp(s));
    case 'status':return ({ready:'Ready',inProgress:'In progress',inputRequired:'Input required',unread:'Unread',draft:'Draft'})[sessionStatus(s)]||'Ready';
    case 'unread':return s.unread?'Unread':'Read';
    case 'project':return s.cwd?.split('/').filter(Boolean).at(-1)||'notify-hub';
    default:return '';
  }
}
function renderAgentSessionList(){
  const el=$('#session-list');if(!el)return;
  const view=sessionListView(),sessions=filteredSessions(view),t=activeTab();
  if(t?.type==='session')state.selectedSession=t.session;
  const selected=state.selectedSession||data.targetSession;
  function row(s){
    const time=sessionTimestamp(s),changes=view.showChanges?s.changes||[]:[],expanded=!!state.sessionsExpanded[s.id];
    return `<div class="session-entry">${changes.length?`<button class="session-expander ${expanded?'expanded':''}" data-action="session-expand" data-session-id="${esc(s.id)}" aria-label="${expanded?'Collapse':'Expand'} changes for ${esc(s.title)}" aria-expanded="${expanded}">${icon('chevron')}</button>`:''}<button class="session-item ${selected===s.id?'selected'+(t?.type==='session'?'':' inactive'):''}" role="listitem" data-session="${esc(s.id)}" title="${esc(s.title)}\n${esc(s.id)}">${agentIcon(s.agent)}<span class="title">${esc(s.title)}</span>${view.showCost&&typeof s.cost==='number'?`<span class="session-cost">$${s.cost.toFixed(2)}</span>`:''}${view.showTime&&time?`<time class="age" datetime="${new Date(time).toISOString()}" title="${esc(new Date(time).toLocaleString('en',{dateStyle:'long',timeStyle:'short'}))}">${sessionAge(time)}</time>`:''}</button>${expanded&&changes.length?`<div class="session-changes">${changes.map(c=>`<button class="session-change" data-action="chat-diff" data-session="${esc(s.id)}" data-turn="${esc(s.turns.find(turn=>turn.changes?.some(change=>change.path===c.path))?.id||'')}" data-path="${esc(c.path)}">${fileIcon(c.path)}<span>${esc(base(c.path))}</span><span class="grow"></span><span class="green">+${c.added}</span><span class="red">−${c.removed}</span></button>`).join('')}</div>`:''}</div>`;
  }
  const groups=new Map();for(const s of sessions){const label=sessionGroupLabel(s,view);if(!groups.has(label))groups.set(label,[]);groups.get(label).push(s)}
  el.innerHTML=[...groups].map(([label,items])=>label?`<section class="session-group"><button class="session-group-heading" data-action="session-group-toggle" data-group="${esc(label)}" aria-expanded="${!state.sessionGroupsCollapsed[label]}">${icon('chevron',state.sessionGroupsCollapsed[label]?'':'down')}<span>${esc(label)}</span><span class="session-group-count">${items.length}</span></button>${state.sessionGroupsCollapsed[label]?'':items.map(row).join('')}</section>`:items.map(row).join('')).join('')||'<div class="no-results">No matching sessions</div>';
  $('#session-count').textContent=sessions.length;
}
function toggleSessionSearch(open){
  closeOverlay();$('.sessions-actions').hidden=open;$('.sessions-search-tools').hidden=!open;
  if(open)$('#session-search').focus();
  else{state.sessionQuery='';$('#session-search').value='';renderSessionList();$('[data-action="session-search-toggle"]').focus()}
}
function sessionsMenuSummary(key){
  const view=state.sessionsView;
  if(key==='show'){const selected=sessionMenuChoices.show.filter(([id])=>view[id]);return selected.length===3?'All':selected.length?selected.map(([,label])=>label).join(', '):'None'}
  if(key==='statuses')return view.statuses.length?sessionMenuChoices.statuses.filter(([id])=>view.statuses.includes(id)).map(([,label])=>label).join(', '):'All';
  if(key==='limit')return view.limit||'All';
  return sessionMenuChoices[key].find(([id])=>id===view[key])?.[1]||'';
}
function openSessionOptions(anchor){
  if(anchor.getAttribute('aria-expanded')==='true'){closeOverlay();return}
  closeOverlay();overlayPreviousFocus=anchor;sessionsMenuKey=null;
  const r=anchor.getBoundingClientRect(),width=Math.min(196,innerWidth-16),left=Math.max(8,Math.min(innerWidth-width-8,r.left));
  $('#overlay-root').innerHTML=`<div class="sessions-menu sessions-options-menu" role="menu" aria-label="Filter and View Options" style="left:${left}px;top:${Math.max(8,Math.min(innerHeight-155,r.bottom+4))}px;width:${width}px">${[['mode','Filter Sessions'],['show','Show'],['statuses','Statuses'],['limit','Sessions Visible'],['group','Group By']].map(([key,label],i)=>`${i===1||i===4?'<hr role="separator">':''}<button class="session-menu-row ${i===0?'selected':''} ${key==='mode'?'session-filter-mode':''}" role="menuitem" aria-haspopup="menu" aria-expanded="false" data-action="session-submenu" data-key="${key}"><span>${label}</span><span class="session-menu-value">${esc(sessionsMenuSummary(key))}</span>${icon('chevron')}</button>`).join('')}</div>`;
  anchor.setAttribute('aria-expanded','true');$('.sessions-options-menu button').focus({preventScroll:true});
  $$('.sessions-options-menu button').forEach(button=>button.addEventListener('pointerenter',()=>{button.focus({preventScroll:true});openSessionSubmenu(button)}));
}
function closeSessionSubmenu(){
  $('.sessions-submenu')?.remove();const key=sessionsMenuKey;sessionsMenuKey=null;
  $$('.sessions-options-menu button').forEach(button=>button.setAttribute('aria-expanded','false'));
  return key&&$(`.sessions-options-menu [data-key="${key}"]`);
}
function openSessionSubmenu(anchor,focus=false){
  const key=anchor.dataset.key,view=state.sessionsView;
  closeSessionSubmenu();sessionsMenuKey=key;
  $$('.sessions-options-menu button').forEach(b=>b.classList.toggle('selected',b===anchor));anchor.setAttribute('aria-expanded','true');
  const checkbox=key==='show'||key==='statuses';
  const options=sessionMenuChoices[key].map(([id,label])=>{
    const checked=key==='show'?!!view[id]:key==='statuses'?view.statuses.includes(id):String(view[key])===id;
    return `<button class="session-menu-choice" role="menuitem${checkbox?'checkbox':'radio'}" aria-checked="${checked}" data-action="session-setting" data-key="${key}" data-value="${id}"><span class="session-option-check">${checked?icon('check'):''}</span><span>${label}</span></button>`;
  }).join('')+(key==='mode'?`<hr role="separator"><button class="session-menu-choice" role="menuitemcheckbox" aria-checked="${view.serviceSessions}" data-action="session-setting" data-key="show" data-value="serviceSessions"><span class="session-option-check">${view.serviceSessions?icon('check'):''}</span><span>Show Service Sessions</span></button>`:'');
  const root=$('.sessions-options-menu').getBoundingClientRect(),r=anchor.getBoundingClientRect(),width=Math.min(key==='mode'?211:176,innerWidth-16),left=root.right+width<innerWidth-8?root.right-3:Math.max(8,root.left-width+3);
  $('#overlay-root').insertAdjacentHTML('beforeend',`<div class="sessions-menu sessions-submenu" role="menu" aria-label="${esc(anchor.firstElementChild.textContent)}" style="left:${left}px;top:${r.top-7}px;width:${width}px">${options}</div>`);
  const sub=$('.sessions-submenu');sub.style.top=Math.max(8,Math.min(innerHeight-sub.offsetHeight-8,r.top-7))+'px';
  if(focus)($('[aria-checked="true"]',sub)||$('button',sub)).focus({preventScroll:true});
}
function openSessionsToolMenu(anchor){
  if(anchor.getAttribute('aria-expanded')==='true'){closeOverlay();return}
  closeOverlay();overlayPreviousFocus=anchor;
  const r=anchor.getBoundingClientRect(),width=Math.min(303,innerWidth-16);
  const row=(label,action,extra='',symbol='',hint='')=>`<button class="session-tool-row" role="menuitem" data-action="${action}" ${extra}><span class="session-tool-icon">${symbol}</span><span>${label}</span>${hint?`<span class="session-tool-hint">${hint}</span>`:''}${action==='session-tool-submenu'?icon('chevron'):''}</button>`;
  $('#overlay-root').innerHTML=`<div class="sessions-menu session-tool-menu" role="menu" aria-label="Agent Sessions view options" style="left:${Math.max(8,Math.min(innerWidth-width-8,r.left+9))}px;top:${Math.max(8,Math.min(innerHeight-191,r.top+10))}px;width:${width}px">${row('Refresh','session-tool-refresh')}<hr role="separator">${row('Speed Search','session-speed-search','',editorIcon('session-search'),'⌘F or any symbol')}<hr role="separator">${['View Mode','Move to','Resize'].map((label,i)=>row(label,'session-tool-submenu',`data-tool-menu="${i}" aria-haspopup="menu" aria-expanded="false"`)).join('')}<hr role="separator">${row('Remove from Sidebar','session-tool-dismiss')}</div>`;
  anchor.setAttribute('aria-expanded','true');$('.session-tool-menu button').focus({preventScroll:true});
  $$('.session-tool-menu>button').forEach(button=>button.addEventListener('pointerenter',()=>{
    button.focus({preventScroll:true});
    if(button.dataset.toolMenu!==undefined)openSessionToolSubmenu(button);else closeSessionToolSubmenu();
  }));
}
function closeSessionToolSubmenu(){
  const anchor=$('.session-tool-menu [aria-expanded="true"]');$('.session-tool-submenu')?.remove();anchor?.setAttribute('aria-expanded','false');return anchor;
}
function openSessionToolSubmenu(anchor,focus=false){
  closeSessionToolSubmenu();anchor.setAttribute('aria-expanded','true');
  const key=anchor.dataset.toolMenu,choices=key==='0'?['Dock Pinned','Dock Unpinned','Undock','Float','Window']:key==='1'?['Left Top','Left Bottom','Bottom Left','Bottom Right','Right Top','Right Bottom']:['Stretch to Left','Stretch to Right','Stretch to Top','Stretch to Bottom','Maximize Tool Window'];
  const root=$('.session-tool-menu').getBoundingClientRect(),r=anchor.getBoundingClientRect(),width=209;
  const content=choices.map((label,i)=>{const checked=key!=='2'&&i===0,resize=key==='2'&&i<2;return `<button class="session-menu-choice" role="${key==='2'?'menuitem':'menuitemradio'}" ${key!=='2'?`aria-checked="${checked}"`:''} ${checked||resize?`data-action="${resize?'session-tool-resize':'session-tool-dismiss'}" data-direction="${i}"`:'disabled'}><span class="session-option-check">${checked?icon('check'):''}</span><span>${label}</span></button>`}).join('');
  $('#overlay-root').insertAdjacentHTML('beforeend',`<div class="sessions-menu session-tool-submenu" role="menu" aria-label="${esc(anchor.children[1].textContent)}" style="left:${root.right+width<innerWidth-8?root.right-3:Math.max(8,root.left-width+3)}px;top:${r.top-7}px;width:${width}px">${content}</div>`);
  const sub=$('.session-tool-submenu');sub.style.top=Math.max(8,Math.min(innerHeight-sub.offsetHeight-8,r.top-7))+'px';if(focus)$('button:not(:disabled)',sub).focus({preventScroll:true});
}
function sessionsAction(name,el){
  switch(name){
    case 'sessions-options':openSessionsToolMenu(el);return true;
    case 'session-tool-submenu':openSessionToolSubmenu(el,true);return true;
    case 'session-tool-dismiss':closeOverlay();return true;
    case 'session-tool-refresh':closeOverlay();renderSessionList();return true;
    case 'session-speed-search':toggleSessionSearch(true);return true;
    case 'session-tool-resize':state.width=Math.max(220,Math.min(600,state.width+(el.dataset.direction==='0'?-20:20)));document.documentElement.style.setProperty('--sidebar',state.width+'px');closeOverlay();persist();return true;
    case 'session-filter':{const button=$('.sessions-actions [data-action="session-filter"]');openSessionOptions(button.getClientRects().length?button:$('.sessions-panel [data-action="sessions-options"]'));return true}
    case 'session-search-toggle':toggleSessionSearch($('.sessions-search-tools').hidden);return true;
    case 'session-search-close':toggleSessionSearch(false);return true;
    case 'session-submenu':openSessionSubmenu(el,true);return true;
    case 'session-setting':{
      const {key,value}=el.dataset,view=state.sessionsView;
      if(key==='show')view[value]=!view[value];
      else if(key==='statuses')view.statuses=view.statuses.includes(value)?view.statuses.filter(v=>v!==value):[...view.statuses,value];
      else view[key]=key==='limit'?+value:value;
      state.sessionGroupsCollapsed={};closeOverlay();renderSessionList();persist();return true;
    }
    case 'session-expand':state.sessionsExpanded[el.dataset.sessionId]=!state.sessionsExpanded[el.dataset.sessionId];renderSessionList();return true;
    case 'session-group-toggle':state.sessionGroupsCollapsed[el.dataset.group]=!state.sessionGroupsCollapsed[el.dataset.group];renderSessionList();return true;
    default:return false;
  }
}
function initSessionListUI(){
  const more=$('.sessions-panel [data-action="sessions-options"]');more.setAttribute('aria-haspopup','menu');more.setAttribute('aria-expanded','false');
  $('#session-search').addEventListener('input',e=>{state.sessionQuery=e.target.value;renderSessionList()});
  $('#session-search').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();toggleSessionSearch(false)}else if(e.key==='ArrowDown'){e.preventDefault();$('.session-item')?.focus()}});
  document.addEventListener('click',e=>{if($('.sessions-menu')&&!e.target.closest('.sessions-menu,[data-action="session-filter"],[data-action="sessions-options"],[data-action="project-options"]'))closeOverlay()});
  document.addEventListener('keydown',e=>{
    const projectTarget=e.target.closest('.project-panel,.project-tool-menu'),searchTarget=projectTarget||e.target.closest('.sessions-panel,.session-tool-menu'),typing=e.target.matches('input,textarea,select');
    if(searchTarget&&!typing&&((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='f'||!e.metaKey&&!e.ctrlKey&&!e.altKey&&e.key.length===1&&e.key!==' '&&!e.target.closest('.sessions-menu'))){
      e.preventDefault();e.stopPropagation();if(projectTarget){closeOverlay();projectSearch(!e.metaKey&&!e.ctrlKey?e.key:undefined)}else{toggleSessionSearch(true);if(!e.metaKey&&!e.ctrlKey){$('#session-search').value=e.key;state.sessionQuery=e.key;renderSessionList()}}return;
    }
    const menu=e.target.closest('.sessions-menu');if(!menu)return;
    const rows=$$('button:not(:disabled)',menu),i=rows.indexOf(document.activeElement);let target;
    if(['ArrowDown','ArrowUp','Home','End'].includes(e.key))target=rows[e.key==='Home'?0:e.key==='End'?rows.length-1:(i+(e.key==='ArrowDown'?1:-1)+rows.length)%rows.length];
    else if(e.key==='ArrowRight'&&e.target.matches('[data-action="session-submenu"]'))openSessionSubmenu(e.target,true);
    else if(e.key==='ArrowRight'&&e.target.matches('[data-action="session-tool-submenu"]'))openSessionToolSubmenu(e.target,true);
    else if(e.key==='ArrowRight'&&e.target.matches('[data-action="project-tool-submenu"]'))openProjectToolSubmenu(e.target,true);
    else if(e.key==='ArrowLeft'||e.key==='Escape'){if($('.project-tool-submenu'))target=closeProjectToolSubmenu();else if($('.session-tool-submenu'))target=closeSessionToolSubmenu();else if($('.sessions-submenu'))target=closeSessionSubmenu();else closeOverlay()}
    else if(e.key==='Enter'||e.key===' ')e.target.click();
    else if(e.key==='Tab'){closeOverlay();return}else return;
    e.preventDefault();e.stopPropagation();target?.focus({preventScroll:true});
  },true);
}
