'use strict';
// Presentation of the recorded running session; these controls never execute code.
function editorIcon(name){return `<img class="icon" src="${assetURL(`icons/editor/${name}.svg`)}" alt="" aria-hidden="true">`}
function capturedRunButton(name,title,cls='',menu=false){return `<button class="icon-button captured-run ${cls}" disabled aria-label="${esc(title)}" title="${esc(title)}">${editorIcon(name+(menu&&['restart','stop'].includes(name)?'-menu':''))}</button>`}
function runningConfigurationIcon(){return `<span class="running-configuration-icon">${editorIcon('spring-boot')}<i></i></span>`}
function runControls(menu=false){return capturedRunButton('resume',"Resume 'NotifyHubApplication'",'',menu)+capturedRunButton('restart',"Restart Debug 'NotifyHubApplication'",menu?'':'restart-filled',menu)+capturedRunButton('stop',"Stop 'NotifyHubApplication'",menu?'':'stop-filled',menu)}
const sessionAgentChoices=[{id:'junie',label:'Junie'},{id:'codex',label:'Codex'},{id:'claude',label:'Claude'},{id:'opencode',label:'OpenCode'},{id:'copilot',label:'GitHub Copilot'}];
function selectedSessionAgent(){return sessionAgentChoices.find(a=>a.id===state.newSessionAgent)||sessionAgentChoices[1]}
function newSessionSelectorContent(){return `${editorIcon('agent-'+selectedSessionAgent().id)}<span>New Session</span>`}
function newSessionSelector(){return `<div class="new-session-widget"><button class="new-session" disabled title="New ${selectedSessionAgent().label} Session">${newSessionSelectorContent()}</button><button class="icon-button new-session-dropdown" data-action="new-session-menu" aria-label="New Session options" aria-haspopup="menu" aria-expanded="false">${editorIcon('chevron')}</button></div>`}
function sessionAgentMenu(){const selected=selectedSessionAgent().id;return sessionAgentChoices.map(a=>`<button role="menuitemradio" aria-checked="${selected===a.id}" class="agent-menu-option ${selected===a.id?'selected-agent':''}" data-action="select-session-agent" data-agent="${a.id}">${editorIcon('agent-'+a.id)}<span>${a.label}</span>${selected===a.id?icon('check','agent-menu-check'):''}</button>`).join('')+`<hr role="separator"><button role="menuitem" class="agent-menu-option" data-action="agent-menu-dismiss">${editorIcon('agent-cloud')}<span>Cloud</span></button><button role="menuitem" class="agent-menu-option manage-agents-option" data-action="agent-menu-dismiss"><span>Manage Agents…</span></button>`}
function mainToolbarWidgets(){return `<div class="run-widget" role="group" aria-label="Running debug configuration"><button class="run-config" data-action="run-config-menu" aria-haspopup="menu" aria-expanded="false" title="Run / Debug Configurations" aria-label="NotifyHubApplication, Run / Debug Configurations">${runningConfigurationIcon()}<span>NotifyHubApplication</span>${editorIcon('chevron')}</button>${runControls()}<button class="icon-button run-more" data-action="run-more-menu" title="More Actions" aria-label="More run actions">${editorIcon('more')}</button></div>${newSessionSelector()}<button class="icon-button main-search" data-action="search-files" title="Search Everywhere" aria-label="Search Everywhere">${editorIcon('search')}</button><button class="icon-button main-settings has-update" data-action="ide-settings-menu" title="IDE and Project Settings" aria-label="IDE and Project Settings">${editorIcon('settings')}</button>`}
function rightToolbar(){return `<aside class="right-rail" aria-label="Additional tools"><button class="icon-button has-notification" title="Notifications" aria-label="Notifications">${editorIcon('notifications')}</button><button class="icon-button" title="Database" aria-label="Database">${editorIcon('database')}</button><button class="icon-button" title="Maven" aria-label="Maven">${editorIcon('maven')}</button></aside>`}
function editorToolbarMenu(kind,anchor){
  if(anchor.getAttribute('aria-expanded')==='true'){closeOverlay();return}
  closeOverlay();overlayPreviousFocus=anchor;
  const agents=kind==='new-session-menu',r=(agents?anchor.closest('.new-session-widget'):anchor).getBoundingClientRect(),config=kind==='run-config-menu';
  const width=Math.min(config?322:agents?172:244,innerWidth-16),left=Math.max(8,Math.min(innerWidth-width-8,r.left-(agents?8:0)));
  let content;
  if(config)content=`<div class="run-config-option" role="menuitem" tabindex="0" aria-current="true">${runningConfigurationIcon()}<span>NotifyHubApplication</span><span class="config-actions">${runControls(true)}<button class="icon-button" disabled aria-label="More configuration actions">${editorIcon('more')}</button></span></div><hr><button role="menuitem" disabled class="config-text-option">Current File</button><hr><button role="menuitem" disabled class="config-text-option">Edit Configurations…</button>`;
  else if(kind==='run-more-menu')content=`<button role="menuitem" data-action="execution-point">Show Execution Point</button><hr><button role="menuitem" disabled>Attach to Process…</button><button role="menuitem" disabled>Edit Configurations…</button>`;
  else if(agents)content=sessionAgentMenu();
  else content=`<button role="menuitem" disabled>Settings…</button><button role="menuitem" disabled>Plugins…</button><hr><button role="menuitem" data-action="about">About this prototype</button>`;
  $('#overlay-root').innerHTML=`<div class="menu native-toolbar-menu ${config?'run-configuration-menu':agents?'agent-selector-menu':''}" role="menu" aria-label="${config?'Run / Debug Configurations':agents?'New Session':kind==='run-more-menu'?'Run actions':'IDE and Project Settings'}" style="left:${left}px;top:${r.bottom+4}px;width:${width}px">${content}</div>`;
  anchor.setAttribute('aria-expanded','true');(agents?$('.selected-agent'):$('.native-toolbar-menu [tabindex="0"],.native-toolbar-menu button:not(:disabled)'))?.focus();
}
function editorUIAction(name,el){
  if(['run-config-menu','run-more-menu','new-session-menu','ide-settings-menu'].includes(name)){editorToolbarMenu(name,el);return true}
  if(name==='select-session-agent'){
    const agent=sessionAgentChoices.find(a=>a.id===el.dataset.agent);if(!agent)return true;
    state.newSessionAgent=agent.id;closeOverlay();$$('.new-session').forEach(selector=>{selector.innerHTML=newSessionSelectorContent();selector.title=`New ${agent.label} Session`});persist();return true;
  }
  if(name==='agent-menu-dismiss'){closeOverlay();return true}
  if(name==='toggle-doc'){toggleDocComment(+el.dataset.docStart);return true}
  if(name==='doc-type-nav'){const path=Object.keys(project(activeTab().source).files).find(p=>p.endsWith('/'+el.dataset.type+'.java'));if(path)goToSource(path,1,activeTab().source);return true}
  return false;
}
function initEditorUI(){
  document.addEventListener('click',e=>{if($('.native-toolbar-menu')&&!e.target.closest('.native-toolbar-menu,.run-config,.run-more,.new-session-dropdown,.main-settings'))closeOverlay()});
  document.addEventListener('keydown',e=>{
    if(e.ctrlKey&&e.altKey&&e.key.toLowerCase()==='q'){
      const focused=document.activeElement,doc=focused?.closest('.doc-comment');
      if(focused?.matches('input,textarea,[contenteditable="true"]'))return;
      const visibleDoc=doc||$$('.doc-comment').find(d=>{const r=d.getBoundingClientRect(),s=$('.code-scroll').getBoundingClientRect();return r.bottom>s.top&&r.top<s.bottom});
      if(visibleDoc){e.preventDefault();toggleDocComment(+visibleDoc.dataset.startLine)}
    }
    const menu=$('.native-toolbar-menu');if(!menu)return;
    if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
      e.preventDefault();const items=$$('[role^="menuitem"]:not(:disabled)',menu),index=items.indexOf(document.activeElement);
      const next=e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next]?.focus();
    }
    if(e.key==='Enter'&&document.activeElement?.classList.contains('run-config-option'))closeOverlay();
  });
}

// Javadoc is parsed as text plus a restricted set of formatting tags. Attributes,
// scripts and arbitrary links from the snapshot never become active HTML.
function safeDocHTML(text){
  const template=document.createElement('template');
  template.innerHTML=text.replace(/\{@(code|literal)\s+([\s\S]*?)\}/g,(_,kind,value)=>kind==='code'?`<code>${esc(value)}</code>`:esc(value)).replace(/\{@link(?:plain)?\s+([^}\s]+)(?:\s+([^}]+))?\}/g,(_,ref,label)=>`<code><a>${esc(label||ref)}</a></code>`);
  const allowed=new Set(['P','PRE','CODE','B','STRONG','I','EM','UL','OL','LI','BR','BLOCKQUOTE','TABLE','TBODY','TR','TD','TH','DL','DT','DD','A']);
  const render=n=>n.nodeType===Node.TEXT_NODE?esc(n.textContent):n.nodeType!==Node.ELEMENT_NODE?'':allowed.has(n.tagName)?`<${n.tagName.toLowerCase()}>${[...n.childNodes].map(render).join('')}${n.tagName==='BR'?'':`</${n.tagName.toLowerCase()}>`}`:esc(n.textContent);
  return [...template.content.childNodes].map(render).join('');
}
function javadocContent(raw){
  const text=raw.replace(/^\s*\/\*\*/, '').replace(/\*\/\s*$/, '').split('\n').map(l=>l.replace(/^\s*\* ?/,'')).join('\n').trim();
  const parts=text.split(/\n(?=@(?:param|return|throws|exception|see|since|author|deprecated)\b)/),main=parts.shift(),tags=[];
  for(const part of parts){const m=part.match(/^@(\w+)\s+([\s\S]*)/);if(!m)continue;const [,tag,value]=m;
    if(tag==='param'||tag==='throws'||tag==='exception'){
      const m=value.match(/^(\S+)\s*([\s\S]*)/);if(m)tags.push(`<div class="doc-tag"><span>${tag==='param'?'Params':'Throws'}:</span> <code>${esc(m[1])}</code> – ${safeDocHTML(m[2])}</div>`);
    }else tags.push(`<div class="doc-tag"><span>${({return:'Returns',see:'See Also',since:'Since',author:'Author',deprecated:'Deprecated'})[tag]||tag}:</span> ${safeDocHTML(value)}</div>`);
  }
  return `<div class="doc-prose">${safeDocHTML('<p>'+main.replace(/\n\s*\n/g,'<p>')+'</p>')}</div>${tags.length?`<div class="doc-tags">${tags.join('')}</div>`:''}`;
}
function renderSourceLines(lines,t,changedLines=new Set()){
  const cs={block:false},rows=lines.map((l,i)=>`<div class="code-line" data-line="${i+1}"><span class="line-number ${changedLines.has(i+1)?'changed':''}">${i+1}</span><span class="source-gutter"></span><span class="code-text">${highlight(l,t.path,cs)||' '}</span></div>`);
  if(!t.path.endsWith('.java'))return rows.join('');
  const blocks=[];
  // Only fold complete Javadoc comments starting at the beginning of a source
  // line; comment-looking strings and ordinary block comments stay source.
  for(let i=0;i<lines.length;i++){
    if(!/^\s*\/\*\*/.test(lines[i])){blocks.push(rows[i]);continue}
    let end=i;while(end<lines.length&&!lines[end].includes('*/'))end++;
    if(end===lines.length){blocks.push(rows[i]);continue}
    const start=i+1,source=!!t.sourceDocs?.[start],indent=lines[i].match(/^\s*/)[0].replace(/\t/g,'    ').length;
    blocks.push(`<section class="doc-comment ${source?'show-source':'show-rendered'}" data-start-line="${start}" data-end-line="${end+1}" style="--doc-indent:${indent}ch" aria-label="Javadoc at line ${start}"><div class="doc-source" ${source?'':'hidden'}>${rows.slice(i,end+1).join('')}</div><div class="rendered-doc" ${source?'hidden':''}><span class="doc-gutter" aria-hidden="true"></span><div class="doc-indentation"></div><div class="rendered-doc-body">${javadocContent(lines.slice(i,end+1).join('\n'))}</div></div><button class="doc-toggle" data-action="toggle-doc" data-doc-start="${start}" title="Toggle Rendered View (⌃⌥Q)" aria-label="Toggle Rendered View at line ${start}" aria-pressed="${!source}">${editorIcon(source?'doc-read':'doc-edit')}</button></section>`);
    i=end;
  }
  return blocks.join('');
}
function sourceLineElement(line){const row=$(`.code-line[data-line="${line}"]`),doc=row?.closest('.doc-comment');return doc?.classList.contains('show-rendered')?$('.rendered-doc',doc):row}
function sourceLineTop(row,sc){return row.getBoundingClientRect().top-sc.getBoundingClientRect().top+sc.scrollTop}
let sourceResizeObserver;
function initSourceEditor(t){
  const sc=$('.code-scroll'),code=$('.code-lines');
  const measure=()=>code.style.setProperty('--source-viewport',sc.clientWidth+'px');measure();
  sourceResizeObserver=new ResizeObserver(measure);sourceResizeObserver.observe(sc);
  if(t.findOpen)renderFileFind(t);sc.scrollTop=t.scroll||0;
  if(t.revealLine){const row=sourceLineElement(t.revealLine);if(row)sc.scrollTop=Math.max(0,sourceLineTop(row,sc)-sc.clientHeight/2);delete t.revealLine}
  sc.addEventListener('scroll',()=>{t.scroll=sc.scrollTop},{passive:true});
}
function toggleDocComment(start){
  const t=activeTab(),doc=$(`.doc-comment[data-start-line="${start}"]`);if(!t||!doc)return;
  const sc=$('.code-scroll'),top=doc.getBoundingClientRect().top,scrollLeft=sc.scrollLeft;
  t.sourceDocs||={};t.sourceDocs[start]=!t.sourceDocs[start];
  renderContent();const fresh=$(`.doc-comment[data-start-line="${start}"]`),next=$('.code-scroll');
  next.scrollTop+=fresh.getBoundingClientRect().top-top;next.scrollLeft=scrollLeft;t.scroll=next.scrollTop;
  $('.doc-toggle',fresh)?.focus({preventScroll:true});persist();
}
