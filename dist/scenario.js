'use strict';
// Scenario-specific read-only views. The source browser and diff engine are in app.js.
function agentIcon(agent){return `<img src="${assetURL(`icons/${agent==='claude'?'claude':'codex'}.svg`)}" class="icon brand-icon ${agent==='claude'?'claude-icon':'codex-icon'}" alt="" aria-hidden="true">`}
let navigationHistory=[];
let airScrollObserver;
function initScenario(){
  document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='5'){e.preventDefault();scenarioAction('toggle-debug')}if(e.altKey&&e.key==='ArrowLeft'&&!/INPUT|SELECT/.test(e.target.tagName)){e.preventDefault();navigateBack()}});
  document.addEventListener('click',e=>{if($('.spring-popup')&&!e.target.closest('.spring-popup')&&!e.target.closest('[data-action="spring-nav"]'))closeOverlay()});
  bindDebugInteractions();
  $('.snapshot-status').textContent='Local scenario';
  renderDebugger();
}
function renderScenarioSession(t){
  airScrollObserver?.disconnect();
  if(session(t.session).agent==='claude')renderClaude(t);else renderCodex(t);
}
function airToolGroups(activity){
  const groups=[];
  for(const item of activity){
    if(item.type==='message'){groups.push({message:item});continue}
    if(!groups.at(-1)?.tools)groups.push({tools:[]});
    groups.at(-1).tools.push(item);
  }
  return groups;
}
function airGroupLabel(tools){
  const count=kind=>tools.filter(t=>t.kind===kind).length;
  const commands=count('execute'),edits=count('edit'),reads=tools.filter(t=>t.kind==='read'&&t.title.startsWith('Read file')).length,searches=count('search');
  const parts=[],plural=(n,s)=>n+' '+s+(n===1?'':'s');
  if(commands)parts.push('Ran '+plural(commands,'command'));
  if(edits){parts.push('edited '+plural(edits,'file'));const rest=tools.length-commands-edits;if(rest)parts.push('used '+plural(rest,'tool'))}
  else{if(reads)parts.push('read '+plural(reads,'file'));if(searches)parts.push('ran '+plural(searches,'search').replace(/searchs$/,'searches'));const rest=tools.length-commands-reads-searches;if(rest)parts.push('used '+plural(rest,'tool'))}
  return parts.join(', ').replace(/^./,c=>c.toUpperCase());
}
function airToolOutput(a){return a.content?.find(c=>c.type==='diff')?.patch.text||a.output||'No file contents or tool output were included in the session record.'}
function airOutputMarkup(text){
  // Highlight the recorded text as data. Never interpret terminal escape codes
  // or markup from a command's output as HTML.
  const tokens=/\b(?:[a-zA-Z_$][\w$]*\.){2,}[a-zA-Z_$][\w$]*\b|\b[\da-f]{7,}\b|\b\d+(?:\.\d+)?\b/g;
  let html='',at=0;
  for(const match of text.matchAll(tokens)){html+=esc(text.slice(at,match.index))+`<span class="air-output-token">${esc(match[0])}</span>`;at=match.index+match[0].length}
  return html+esc(text.slice(at));
}
function airToolPanel(a,t){
  const command=typeof a.rawInput==='string'?a.rawInput:a.rawInput?.command,expanded=!!t.toolOutputExpanded?.[a.id];
  return `<div class="air-tool-output ${expanded?'expanded':''}" data-output-tool="${esc(a.id)}"><details class="air-output-options"><summary class="icon-button" title="Tool output options" aria-label="Tool output options">${icon('more')}</summary><div class="air-output-menu"><button data-action="air-copy-output" data-tool="${esc(a.id)}">Copy output</button></div></details><div class="air-tool-preview" id="output-${esc(a.id)}">${command?`<pre class="air-tool-input">${esc(command)}</pre>`:''}<pre class="air-tool-result">${airOutputMarkup(airToolOutput(a))}</pre></div><button class="air-tool-show-more" data-action="air-tool-output-size" data-tool="${esc(a.id)}" aria-expanded="${expanded}" aria-controls="output-${esc(a.id)}"><span>Show ${expanded?'less':'more'}</span>${icon('chevron')}</button></div>`;
}
function airToolRow(a,t){
  const edit=a.content?.find(c=>c.type==='diff'),path=edit?.path||a.locations?.[0]?.path;
  let content;
  if(edit)content=`<span>Edited</span><button class="air-file-link" data-action="air-edit-diff" data-tool="${esc(a.id)}">${esc(base(path))}</button><span class="air-inline-stats"><span class="green">+${edit.diffStats.added}</span> <span class="red">−${edit.diffStats.removed}</span></span>`;
  else if(a.kind==='read'&&path)content=`<span>Read</span><button class="air-file-link" data-action="air-tool-file" data-tool="${esc(a.id)}">${esc(base(path))}</button>`;
  else content=`<span>${a.kind==='search'?'Searched':a.kind==='execute'?'Ran':a.kind==='read'?'Read':'Used'}</span> <span class="air-tool-description">${esc(a.title)}</span>`;
  if(edit)return `<div class="air-tool-row">${content}</div>`;
  return `<details class="air-tool-entry" data-tool-entry="${esc(a.id)}" ${t.toolEntries?.[a.id]?'open':''}><summary class="air-tool-row air-tool-command" title="${esc(a.title)}">${content}${icon('chevron','air-tool-chevron')}</summary>${airToolPanel(a,t)}</details>`;
}
function airActivity(turn,t){
  return airToolGroups(turn.activity).map((g,i)=>g.message?`<div class="air-commentary markdown">${markdown(g.message.text)}</div>`:`<details class="air-tool-group" data-tool-group="${i}" ${t.toolGroups?.[i]?'open':''}><summary>${icon(g.tools.some(x=>x.kind==='edit')?'terminal':g.tools.some(x=>x.kind==='search')?'search':'eye')}<span>${esc(airGroupLabel(g.tools))}</span>${icon('chevron','air-disclosure')}</summary><div class="air-tool-list">${g.tools.map(a=>airToolRow(a,t)).join('')}</div></details>`).join('');
}
function airChangesCard(turn,s){
  return `<div class="changes-card air-changes-card"><div class="changes-heading">${turn.changes.length} file${turn.changes.length===1?'':'s'} changed <span class="muted">· Since last turn</span></div>${turn.changes.map(ch=>`<button class="change-row" data-action="chat-diff" data-session="${s.id}" data-turn="${turn.id}" data-path="${esc(ch.path)}" title="Open diff: ${esc(ch.path)}">${icon('java')}<span class="change-name">${esc(base(ch.path))}</span><span class="air-inline-stats"><span class="green">+${ch.added}</span> <span class="red">−${ch.removed}</span></span></button>`).join('')}</div>`;
}
function renderCodex(t){
  const s=session(t.session),turn=s.turns[0],totals=project('main').changes.reduce((v,c)=>({added:v.added+c.added,removed:v.removed+c.removed}),{added:0,removed:0});
  const completed=new Date(turn.endedAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'Europe/Tallinn'});
  $('#content').innerHTML=`<div class="content-toolbar session-toolbar air-session-toolbar codex-toolbar"><span class="session-path">notify-hub</span>${icon('branch')}<span class="scope">main</span><span class="grow"></span><div class="air-review"><button class="text-button" data-action="review-session">${icon('review')}<span>Review Code</span><span class="air-inline-stats"><span class="green">+${totals.added}</span> <span class="red">−${totals.removed}</span></span></button><button class="icon-button air-review-menu" data-action="air-review-menu" title="Choose code comparison" aria-label="Choose code comparison">${icon('chevron','down')}</button></div>${ib('search','Find in chat','find-chat')}${ib('more','Session information','session-info')}</div><div id="chat-find" ${t.findOpen?'':'hidden'}></div>
  <div class="air-chat-viewport"><div class="chat-scroll codex-scroll" tabindex="0" aria-label="Codex session transcript"><div class="chat-body"><article class="chat-turn" id="turn-0"><div class="user-message markdown">${markdown(turn.prompt)}</div><details class="work-details air-work" data-activity-turn="${turn.id}" ${t.activityOpen?'open':''}><summary><span>Worked for ${turn.workSeconds}s</span>${icon('chevron','air-disclosure')}</summary><div class="air-activity">${airActivity(turn,t)}</div></details><div class="assistant-answer markdown">${markdown(turn.answer)}</div>${airChangesCard(turn,s)}<div class="air-answer-actions">${ib('copy','Copy response','air-copy-answer')}<button class="icon-button air-report-problem" title="Report a problem" aria-label="Report a problem" disabled>${icon('flag')}</button><time datetime="${new Date(turn.endedAt).toISOString()}">${completed}</time></div></article></div></div><div class="air-scroll-anchor"><button class="icon-button air-scroll-bottom" data-action="air-scroll-bottom" title="Scroll to bottom" aria-label="Scroll to bottom" hidden>${icon('arrow-down')}</button></div></div>
  <div class="air-compose-area"><div class="ide-composer air-composer" tabindex="0" role="textbox" aria-readonly="true" aria-label="Read-only suggested follow-up"><span class="composer-draft">${esc(s.draft)}</span><div class="composer-controls"><button disabled aria-label="Add attachment (read-only)">${icon('plus')}</button><span class="grow"></span><span class="context-ring" title="${esc(s.events.filter(e=>e.type==='UsageUpdated').at(-1)?.payload.totalTokens.toLocaleString())} tokens used" aria-label="Context usage"></span><button disabled aria-label="Voice input (read-only)">${icon('mic')}</button><button class="composer-send" disabled aria-label="Send (read-only)">${icon('arrow-up')}</button></div></div><div class="composer-model">${agentIcon('codex')}<span>${esc(s.model)}</span><span class="air-review-mode">Auto review</span><span class="grow"></span>${icon('user')}<span>JetBrains AI</span></div></div>`;
  const sc=$('.codex-scroll'),bottom=$('.air-scroll-bottom');
  const updateScroll=()=>{
    t.scroll=sc.scrollTop;bottom.hidden=sc.scrollHeight-sc.clientHeight-sc.scrollTop<35;
    $$('.air-tool-output').forEach(panel=>{const preview=$('.air-tool-preview',panel);if(preview.getClientRects().length)$('.air-tool-show-more',panel).hidden=!panel.classList.contains('expanded')&&preview.scrollHeight<=preview.clientHeight+1});
  };
  sc.scrollTop=t.scroll||0;sc.addEventListener('scroll',updateScroll,{passive:true});
  $('[data-activity-turn]').addEventListener('toggle',e=>{t.activityOpen=e.target.open;updateScroll();persist()});
  $$('[data-tool-group]').forEach(g=>g.addEventListener('toggle',()=>{t.toolGroups||={};t.toolGroups[g.dataset.toolGroup]=g.open;updateScroll();persist()}));
  $$('[data-tool-entry]').forEach(entry=>entry.addEventListener('toggle',()=>{t.toolEntries||={};t.toolEntries[entry.dataset.toolEntry]=entry.open;updateScroll();persist()}));
  airScrollObserver=new ResizeObserver(updateScroll);airScrollObserver.observe(sc);airScrollObserver.observe($('.chat-body'));
  updateScroll();
  if(t.findOpen)renderChatFind(t);
}
function airTool(id){return session(activeTab().session).turns[0].activity.find(a=>a.id===id)}
function inspectAirTool(a){
  if(!a)return;
  const entry=$$('[data-tool-entry]').find(el=>el.dataset.toolEntry===a.id);
  if(entry)entry.open=!entry.open;
}
function resizeAirToolOutput(el){
  const t=activeTab(),panel=el.closest('.air-tool-output'),expanded=!panel.classList.contains('expanded');
  t.toolOutputExpanded||={};t.toolOutputExpanded[el.dataset.tool]=expanded;
  panel.classList.toggle('expanded',expanded);el.setAttribute('aria-expanded',expanded);$('span',el).textContent=expanded?'Show less':'Show more';
  const sc=$('.codex-scroll');
  if(!expanded&&el.getBoundingClientRect().top<sc.getBoundingClientRect().top)sc.scrollTop+=panel.getBoundingClientRect().top-sc.getBoundingClientRect().top-10;
  persist();
}

function renderClaude(t){
  const s=session(t.session),turn=s.turns[0];
  const commands=[
    ['Read','SecurityConfig.java','Security rules protect /api/notify/**, /api/health and /api/channels. All other requests are permitted.'],
    ['Read','DashboardController.java','Found POST enable, POST disable, PUT explicit state, and POST channel registration.'],
    ['Read','NotificationDispatcher.java','Inspected dispatch(), exception handling, configuration fields and transformation rules.'],
    ['Search','rateLimit|maxRetryAttempts','Both configuration fields are declared and injected; neither is used in the dispatch path.']
  ];
  $('#content').innerHTML=`<div id="chat-find" ${t.findOpen?'':'hidden'}></div>
  <div class="chat-scroll claude-scroll" tabindex="0" aria-label="Claude Code Air TUI transcript"><div class="chat-body terminal-body"><div class="claude-welcome"><pre class="claude-mascot"> ▐▛███▜▌
▝▜█████▛▘
  ▘▘ ▝▝</pre><div><strong>Claude Code</strong> <span class="muted">v2.1.330</span><br><span class="muted">Sonnet 4.5 · Claude Pro</span><br><span class="muted">~/IdeaProjects/screencasts/air-demo/notify-hub</span></div></div>
  <article id="turn-0"><div class="terminal-prompt"><span>❯</span><div>${esc(turn.prompt)}</div></div><div class="terminal-response"><span class="terminal-bullet">⏺</span>I’ll inspect the project structure, security configuration and notification flow, then report concrete findings without changing files.</div>
  <div class="terminal-tools">${commands.map(([kind,name,output],i)=>`<details class="terminal-tool" ${t.terminalTools?.[i]?'open':''} data-terminal-tool="${i}"><summary><span class="green">⏺</span> <b>${kind}</b><span>(${esc(name)})</span><span class="tool-expand muted">${icon('chevron')}</span></summary><div class="terminal-output">⎿ &nbsp;${esc(output)}${kind==='Read'?`<br> &nbsp;&nbsp;<button class="terminal-link" data-action="terminal-file" data-name="${esc(name)}">Open ${esc(name)}</button>`:''}</div></details>`).join('')}</div>
  <div class="terminal-response"><span class="terminal-bullet">⏺</span><div><b>Review complete. I found 4 issues:</b><div class="terminal-findings">${s.findings.map((f,i)=>`<div class="terminal-finding"><b>${i+1}. <span class="${f.priority==='P1'?'red':'amber'}">[${f.priority}]</span> ${esc(f.title)}</b><br><button class="terminal-link" data-action="finding-file" data-index="${i}">${esc(base(f.path))}:${f.line}</button><p>${esc(f.detail)}</p></div>`).join('')}</div><span class="muted">No files changed. No tests run.</span></div></div><div class="terminal-duration">✻ Worked for 3m 20s</div></article></div></div>
  <div class="terminal-input" aria-label="Read-only Claude Code TUI prompt"><span>❯</span><span class="terminal-cursor"></span><span class="grow"></span>${icon('lock')}</div><div class="terminal-status"><span>?</span> for shortcuts<span class="grow"></span>Read-only transcript</div>`;
  const sc=$('.chat-scroll');sc.scrollTop=t.scroll||0;sc.addEventListener('scroll',()=>{t.scroll=sc.scrollTop},{passive:true});
  $$('[data-terminal-tool]').forEach(d=>d.addEventListener('toggle',()=>{t.terminalTools||={};t.terminalTools[d.dataset.terminalTool]=d.open}));
  if(t.findOpen)renderChatFind(t);
}
function goToSource(path,line=1,source=state.project,remember=true){
  const t=activeTab();if(remember&&t)navigationHistory.push({tab:{...t},scroll:$('.code-scroll')?.scrollTop});
  openFile(path,source);
  const row=sourceLineElement(line);if(row){row.classList.add('navigation-line');const sc=$('.code-scroll');sc.scrollTop=Math.max(0,sourceLineTop(row,sc)-sc.clientHeight/2);activeTab().scroll=sc.scrollTop;persist()}
}
function navigateBack(){const prev=navigationHistory.pop();if(!prev)return;openTab(prev.tab);if($('.code-scroll')&&prev.scroll!==undefined)$('.code-scroll').scrollTop=prev.scroll;}
const projectTypeIndexes=new WeakMap();
function javaDeclarationText(text){
  // Keep offsets and newlines while excluding examples and quoted text.
  return text.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\/|"""[\s\S]*?"""|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,s=>s.replace(/[^\n]/g,' '));
}
function projectTypeIndex(source){
  const files=project(source).files;if(projectTypeIndexes.has(files))return projectTypeIndexes.get(files);
  const index={files:new Map(),byName:new Map(),byQualifiedName:new Map()};
  for(const [path,file] of Object.entries(files)){
    if(!path.endsWith('.java'))continue;
    const code=javaDeclarationText(file.text),packageName=code.match(/\bpackage\s+([\w.]+)\s*;/)?.[1]||'';
    const meta={packageName,imports:[...code.matchAll(/\bimport\s+(?:static\s+)?([\w$.*]+)\s*;/g)].map(m=>m[1]),types:[]};
    index.files.set(path,meta);
    const owners=[];
    for(const match of code.matchAll(/\b(class|interface|record|enum)\s+([A-Za-z_$][\w$]*)\b/g)){
      while(owners.length&&owners.at(-1).end<match.index)owners.pop();
      const name=match[2],offset=match.index+match[0].lastIndexOf(name),body=code.indexOf('{',offset+name.length);
      let end=body,depth=0;if(body>=0){for(;end<code.length;end++){if(code[end]==='{')depth++;else if(code[end]==='}'&&!--depth)break}}
      const relativeName=(owners.length?owners.at(-1).relativeName+'.':'')+name;
      const type={name,path,kind:match[1],relativeName,qualifiedName:(packageName?packageName+'.':'')+relativeName,line:code.slice(0,offset).split('\n').length,column:offset-code.lastIndexOf('\n',offset-1)-1,end};
      meta.types.push(type);owners.push(type);
      for(const [map,key] of [[index.byName,name],[index.byQualifiedName,type.qualifiedName]]){if(!map.has(key))map.set(key,[]);map.get(key).push(type)}
    }
  }
  projectTypeIndexes.set(files,index);return index;
}
function resolveProjectType(reference,t){
  const index=projectTypeIndex(t.source),meta=index.files.get(t.path);if(!meta)return null;
  const ref=reference.split('#')[0].replace(/^@/,'').replace(/\s/g,''),[head,...tail]=ref.split('.'),suffix=tail.length?'.'+tail.join('.'):'';
  const unique=types=>types?.length===1?types[0]:null,qualified=name=>unique(index.byQualifiedName.get(name));
  const direct=qualified(ref);if(direct)return direct;
  const imported=meta.imports.filter(i=>i.endsWith('.'+head));
  if(imported.length)return unique(imported.map(i=>qualified(i+suffix)).filter(Boolean));
  const local=meta.types.filter(type=>type.name===head).map(type=>qualified(type.qualifiedName+suffix)).filter(Boolean);
  if(local.length)return unique(local);
  const samePackage=qualified((meta.packageName?meta.packageName+'.':'')+ref);if(samePackage)return samePackage;
  return unique(meta.imports.filter(i=>i.endsWith('.*')).map(i=>qualified(i.slice(0,-1)+ref)).filter(Boolean));
}
function projectTypeLink(label,target,source){
  const button=document.createElement('button');button.className='type-link';button.textContent=label;
  button.title='Go to declaration of '+target.name;button.dataset.action='type-nav';button.dataset.path=target.path;button.dataset.line=target.line;button.dataset.source=source;
  return button;
}
function decorateProjectTypeReferences(t){
  if(!t.path.endsWith('.java'))return;
  $$('.code-text .syn-type,.code-text .syn-annotation').forEach(span=>{
    const row=span.closest('.code-line'),code=span.closest('.code-text'),range=document.createRange();range.selectNodeContents(code);range.setEndAfter(span);
    const prefix=range.toString(),reference=prefix.match(/(?:[A-Za-z_$][\w$]*\s*\.\s*)*[A-Za-z_$][\w$]*$/)?.[0];
    const target=reference&&resolveProjectType(reference,t);if(!target)return;
    if(target.path===t.path&&target.line===+row.dataset.line&&target.column===prefix.length-span.textContent.length)return;
    span.replaceChildren(projectTypeLink(span.textContent,target,t.source));
  });
  $$('.rendered-doc a[data-java-ref]').forEach(anchor=>{
    const target=resolveProjectType(anchor.dataset.javaRef,t);if(!target)return;
    const button=projectTypeLink(anchor.textContent,target,t.source);button.classList.add('doc-type-link');anchor.replaceWith(button);
  });
}
function springNavigation(t=activeTab()){return (data.springByProject?.[t.source]||data.spring||{})[t.path]||{}}
function goToSpringTarget(target,source){
  if(!target.library){goToSource(target.path,target.line,source);return}
  const t=activeTab();if(t)navigationHistory.push({tab:{...t},scroll:$('.code-scroll')?.scrollTop});
  openLibrarySource(target.library,target.line);
}
function decorateSource(t){
  const springs=springNavigation(t);
  $$('.code-line').forEach(row=>{
    const n=+row.dataset.line,meta=springs[n],paused=t.source==='main'&&t.path===data.debugger.file&&n===data.debugger.line;
    const gutter=$('.source-gutter',row);
    gutter.innerHTML=paused?`<span class="breakpoint" title="Breakpoint · suspended at line 65" aria-label="Breakpoint at line 65">${editorIcon('breakpoint')}</span>`:meta?`<button class="spring-gutter ${meta.kind==='property'?'property-gutter':''}" data-action="spring-nav" data-line="${n}" title="${esc(meta.title)}" aria-label="${esc(meta.title)} at line ${n}">${meta.kind==='property'?editorIcon('spring-property'):icon(meta.title.startsWith('Choose Autowired')?'spring-autowires':'spring-usages')}</button>`:'';
    if(meta?.propertyKey){
      const text=$('.code-text',row),walker=document.createTreeWalker(text,NodeFilter.SHOW_TEXT);
      let node;while(node=walker.nextNode()){
        const index=node.textContent.indexOf(meta.propertyKey);if(index<0)continue;
        const link=document.createElement('button');link.className='type-link property-link';link.textContent=meta.propertyKey;link.dataset.action='spring-nav';link.dataset.line=n;link.title='Go to configuration property '+meta.propertyKey;
        node.replaceWith(document.createTextNode(node.textContent.slice(0,index)),link,document.createTextNode(node.textContent.slice(index+meta.propertyKey.length)));break;
      }
    }
    if(paused)row.classList.add('execution-line');
    if(t.path===data.debugger.file&&t.source==='main'){
      if(n===61||paused){
        const values=document.createElement('span');values.className='debug-inline-values';
        values.innerHTML=(paused?`<button class="inline-value dispatcher-inline" data-action="debug-inspect" data-key="watches-0" aria-label="Inspect dispatcher">${icon('spring-bean')}dispatcher: NotificationDispatcher@21423</button>`:'')+`<button class="inline-value" data-action="debug-inspect" data-key="variables-2" aria-label="Inspect notification">notification: &quot;${esc(data.debugger.notificationSummary)}&quot;</button>`;
        row.append(values);
        if(paused){const text=$('.code-text',row),part=[...text.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.includes('dispatcher.'));if(part){const [before,after]=part.textContent.split('dispatcher.');const btn=document.createElement('button');btn.className='debug-expression';btn.dataset.action='debug-inspect';btn.dataset.key='watches-0';btn.setAttribute('aria-label','Inspect dispatcher expression');btn.textContent='dispatcher';part.replaceWith(document.createTextNode(before),btn,document.createTextNode('.'+after))}}
      }
      if(n===59){
        const route=$('.syn-str',row);if(route){route.innerHTML=`<button class="debug-endpoint-link" data-action="debug-security-menu">${icon('endpoint-badge')}&quot;/notify&quot;</button>`}
        const security=document.createElement('button');security.className='debug-security-inlay';security.dataset.action='debug-security-menu';security.setAttribute('aria-label','Endpoint security: ADMIN');security.innerHTML=icon('lock')+icon('unlock-debug')+' ADMIN'+icon('chevron','down');row.append(security);
      }
      if(n===60&&!meta)gutter.innerHTML=`<button class="spring-gutter" data-action="debug-security-menu" aria-label="POST /api/notify endpoint">${icon('spring-endpoint')}</button>`;
    }
  });
  decorateProjectTypeReferences(t);
  decorateSourceLogpoint(t);
}
function navigateSpring(el){
  const t=activeTab(),meta=springNavigation(t)[el.dataset.line];if(!meta)return;
  closeOverlay();
  if(meta.targets.length===1){goToSpringTarget(meta.targets[0],t.source);return}
  if(!meta.targets.length)return;
  overlayPreviousFocus=el;
  const property=meta.kind==='property',usage=meta.kind==='usage',title=property?'Choose Property':usage?'Choose Bean Usage':'Choose Bean';
  $('#overlay-root').innerHTML=`<section class="spring-popup" role="dialog" aria-label="${title}"><header>${title}</header><div role="listbox" aria-label="${property?'Properties':usage?'Bean usages':'Beans'}">${meta.targets.map((x,i)=>{
    const file=base(x.path),name=file.replace(/\.java$/,''),bean=x.beanName||(/^[A-Z]{2}/.test(name)?name:name[0].toLowerCase()+name.slice(1));
    return `<button class="spring-target" role="option" aria-selected="${i===0}" tabindex="${i===0?0:-1}" data-action="spring-target" data-origin-line="${el.dataset.line}" data-index="${i}">${projectIcon(property?(file.endsWith('.properties')?'properties':'yaml'):'spring-class')}<span>${esc(property?x.label+' = '+x.value:bean)} <span class="spring-target-file">(${esc(file)}${property?':'+x.line:''})</span></span></button>`;
  }).join('')}</div></section>`;
  const popup=$('.spring-popup'),r=el.getBoundingClientRect();
  const width=popup.offsetWidth,height=popup.offsetHeight;
  popup.style.left=Math.max(8,Math.min(r.right,innerWidth-width-8))+'px';
  popup.style.top=Math.max(8,r.bottom+1+height<=innerHeight-8?r.bottom+1:r.top-height-1)+'px';
  const options=$$('.spring-target',popup);
  const select=button=>options.forEach(option=>{const selected=option===button;option.setAttribute('aria-selected',selected);option.tabIndex=selected?0:-1});
  options.forEach((button,i)=>{
    button.addEventListener('focus',()=>select(button));
    button.addEventListener('pointermove',()=>{select(button);button.focus({preventScroll:true})});
    button.addEventListener('keydown',e=>{
      let next;if(e.key==='ArrowDown')next=(i+1)%options.length;else if(e.key==='ArrowUp')next=(i-1+options.length)%options.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=options.length-1;
      if(next!==undefined){e.preventDefault();options[next].focus({preventScroll:true})}
    });
  });
  options[0].focus({preventScroll:true});
}
function scenarioAction(name,el,e){
  if(debugAction(name,el,e))return true;
  switch(name){
    case 'air-scroll-bottom':$('.codex-scroll').scrollTo({top:$('.codex-scroll').scrollHeight,behavior:'smooth'});return true;
    case 'air-tool-output-size':resizeAirToolOutput(el);return true;
    case 'air-copy-output':el.closest('details').open=false;navigator.clipboard.writeText(airToolOutput(airTool(el.dataset.tool))).then(()=>toast('Tool output copied.'),()=>toast('Clipboard access is unavailable in this browser.'));return true;
    case 'air-tool-file':{const a=airTool(el.dataset.tool),path=a.locations?.[0]?.path,match=path&&Object.keys(project('main').files).find(p=>path.endsWith('/'+p));if(match)goToSource(match,1,'main');else inspectAirTool(a);return true}
    case 'air-edit-diff':{const a=airTool(el.dataset.tool),edit=a.content.find(c=>c.type==='diff'),path=Object.keys(project('main').files).find(p=>edit.path.endsWith('/'+p));openDiff(path,{session:activeTab().session,turn:session(activeTab().session).turns[0].id});return true}
    case 'air-source':closeOverlay();goToSource(el.dataset.path,1,'main');return true;
    case 'air-copy-answer':navigator.clipboard.writeText(session(activeTab().session).turns[0].answer).then(()=>toast('Response copied.'),()=>toast('Clipboard access is unavailable in this browser.'));return true;
    case 'air-review-menu':{const s=session(activeTab().session),sum=cs=>cs.reduce((v,c)=>({added:v.added+c.added,removed:v.removed+c.removed}),{added:0,removed:0});dialog('Review Code',`<div class="dialog-body air-review-options"><button data-action="air-review-turn">${icon('agent')}<span>This session<small>1 file changed · ${esc(s.id)}</small></span>${stats(sum(s.changes))}</button><button data-action="air-review-workspace">${icon('branch')}<span>Working tree<small>All changes in the project snapshot</small></span>${stats(sum(project('main').changes))}</button></div>`);return true}
    case 'air-review-turn':closeOverlay();{const s=session(activeTab().session);openDiff(s.changes[0].path,{session:s.id})}return true;
    case 'air-review-workspace':closeOverlay();openCommit();return true;
    case 'open-claude':openSession('claude-review');return true;
    case 'toggle-debug':state.showDebugger=!state.showDebugger;renderDebugger();persist();return true;
    case 'reset-scene':localStorage.removeItem(storageKey);location.reload();return true;
    case 'nav-back':navigateBack();return true;
    case 'execution-point':closeOverlay();state.debugFrame=0;state.showDebugger=true;renderDebugger();goToSource(data.debugger.file,65,'main');return true;
    case 'spring-nav':navigateSpring(el);return true;
    case 'spring-target':{const t=activeTab(),target=springNavigation(t)[el.dataset.originLine].targets[+el.dataset.index];closeOverlay();goToSpringTarget(target,t.source);return true}
    case 'type-nav':{const source=el.dataset.source||activeTab().source,target=el.dataset.path;if(project(source).files[target])goToSource(target,+el.dataset.line||1,source);return true}
    case 'terminal-file':{const path=Object.keys(project('baseline').files).find(x=>base(x)===el.dataset.name);if(path)goToSource(path,1,'baseline');return true}
    case 'finding-file':{const f=session('claude-review').findings[+el.dataset.index];goToSource(f.path,f.line,'baseline');return true}

  }
  return false;
}
