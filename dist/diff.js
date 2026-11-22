'use strict';
// Air's turn diff is the recorded patch fragment; full comparisons use complete versions.
let diffResizeObserver;
function isTurnDiff(t){return t.scope==='session'&&!!t.turn}
function diffPatch(t,ch){
  if(isTurnDiff(t)){
    const turn=session(t.session).turns.find(x=>x.id===t.turn);
    for(const a of turn?.activity||[])for(const c of a.content||[])if(c.type==='diff'&&c.path.endsWith('/'+ch.path))return c.patch.text;
  }
  return ch.patch;
}
function patchOperations(patch){
  const ops=[];let current;
  for(const line of patch.split('\n')){
    if(/^(diff |--- |\+\+\+ |@@|\\)/.test(line)||![' ','+','-'].includes(line[0]))continue;
    const kind=line[0]===' '?'equal':'change';
    if(current?.kind!==kind){current={kind,before:[],after:[]};ops.push(current)}
    if(line[0]!=='+')current.before.push(line.slice(1));
    if(line[0]!=='-')current.after.push(line.slice(1));
  }
  return ops;
}
function completeOperations(ch){
  const ops=[];let current;
  for(const row of ch.rows||[]){
    const kind=row.kind==='equal'?'equal':'change';
    if(current?.kind!==kind){current={kind,before:[],after:[]};ops.push(current)}
    if(row.left!==null)current.before.push(row.left);
    if(row.right!==null)current.after.push(row.right);
  }
  return ops;
}
function diffWords(before,after){
  const tokenize=s=>[...s.matchAll(/[A-Za-z0-9_$]+|\s+|[^\w\s]/g)].map(m=>({text:m[0],start:m.index,end:m.index+m[0].length,changed:true}));
  const a=tokenize(before),b=tokenize(after);
  if(a.length*b.length<180000){
    const table=Array.from({length:a.length+1},()=>new Uint16Array(b.length+1));
    for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)table[i][j]=a[i].text===b[j].text?table[i+1][j+1]+1:Math.max(table[i+1][j],table[i][j+1]);
    let i=0,j=0;while(i<a.length&&j<b.length){if(a[i].text===b[j].text){a[i++].changed=false;b[j++].changed=false}else if(table[i+1][j]>=table[i][j+1])i++;else j++}
  }
  return [a,b].map(tokens=>tokens.filter(t=>t.changed&&!/^\s+$/.test(t.text)).map(t=>[t.start,t.end]));
}
function createDiffModel(t,ch){
  const partial=isTurnDiff(t)&&!t.expandedContext,ops=partial?patchOperations(diffPatch(t,ch)):completeOperations(ch);
  const before=[],after=[],unified=[],groups=[];let oldLine=0,newLine=0;
  const addEqual=(oldText,newText)=>{oldLine++;newLine++;before.push({text:oldText,line:oldLine,kind:'equal'});after.push({text:newText,line:newLine,kind:'equal'});unified.push({text:newText,old:oldLine,new:newLine,kind:'equal'})};
  const gap=n=>{const row={kind:'gap',label:n+' unchanged lines'};before.push({...row});after.push({...row});unified.push({...row});oldLine+=n;newLine+=n};
  ops.forEach((op,i)=>{
    if(op.kind==='equal'){
      const n=op.before.length,fold=!partial&&t.expandedContext===false&&n>8;
      if(!fold)op.before.forEach((text,j)=>addEqual(text,op.after[j]));
      else{const head=i===0?0:3,tail=i===ops.length-1?0:3;for(let j=0;j<head;j++)addEqual(op.before[j],op.after[j]);gap(n-head-tail);for(let j=n-tail;j<n;j++)addEqual(op.before[j],op.after[j])}
      return;
    }
    const index=groups.length,kind=op.before.length&&op.after.length?'modified':op.after.length?'added':'deleted';
    const group={index,kind,oldStart:before.length,newStart:after.length,oldCount:op.before.length,newCount:op.after.length,unifiedStart:unified.length,unifiedCount:op.before.length+op.after.length};
    const ranges=kind==='modified'?diffWords(op.before.join('\n'),op.after.join('\n')):[[],[]];let oldOffset=0,newOffset=0;
    const wordRanges=(rs,offset,length)=>rs.filter(([a,b])=>b>offset&&a<offset+length).map(([a,b])=>[Math.max(0,a-offset),Math.min(length,b-offset)]);
    op.before.forEach(text=>{const row={text,line:++oldLine,kind,group:index,wordRanges:wordRanges(ranges[0],oldOffset,text.length)};before.push(row);unified.push({...row,old:row.line,new:null,kind:'removed',changeKind:kind});oldOffset+=text.length+1});
    op.after.forEach(text=>{const row={text,line:++newLine,kind,group:index,wordRanges:wordRanges(ranges[1],newOffset,text.length)};after.push(row);unified.push({...row,old:null,new:row.line,kind:'added',changeKind:kind});newOffset+=text.length+1});
    groups.push(group);
  });
  return {before,after,unified,groups,partial};
}
function diffHighlight(text,ranges=[]){
  if(/^\s*(?:\/\*\*|\*(?:\/|\s|$))/.test(text))return `<span class="jd-doc-comment">${esc(text)}</span>`;
  const decorate=(start,end)=>{
    const cuts=[start,end,...ranges.flatMap(([a,b])=>[Math.max(start,Math.min(end,a)),Math.max(start,Math.min(end,b))])].sort((a,b)=>a-b);
    return [...new Set(cuts)].slice(0,-1).map((a,i,all)=>{const b=[...new Set(cuts)][i+1];let value=esc(text.slice(a,b)).replace(/ {2,}/g,s=>`<span class="jd-spaces">${s}</span>`);return ranges.some(([x,y])=>a>=x&&a<y)?`<span class="jd-word">${value}</span>`:value}).join('');
  };
  const re=/\/\/.*$|\/\*.*?(?:\*\/|$)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|@[\w.]+|\b(?:package|import|public|private|protected|class|interface|static|final|void|new|return|if|else|throw|throws|true|false|null|this|super|int|boolean)\b|\b[A-Z][A-Z_]{1,}\b|\bConfiguration\b|\b[a-zA-Z_$][\w$]*(?=\s*\()/g;
  let html='',pos=0;
  for(const m of text.matchAll(re)){
    html+=decorate(pos,m.index);const value=m[0],cls=value.startsWith('//')||value.startsWith('/*')?'jd-comment':/^["']/.test(value)?'jd-string':value.startsWith('@')||value==='Configuration'?'jd-annotation':/^[A-Z_]+$/.test(value)?'jd-enum':/^(package|import|public|private|protected|class|interface|static|final|void|new|return|if|else|throw|throws|true|false|null|this|super|int|boolean)$/.test(value)?'jd-keyword':'jd-method';
    html+=`<span class="${cls}">${decorate(m.index,m.index+value.length)}</span>`;pos=m.index+value.length;
  }
  return html+decorate(pos,text.length)||' ';
}
function diffRow(row,i,t,unified=false){
  if(row.kind==='gap')return `<button class="jd-line jd-gap" data-action="jd-context" aria-label="Expand ${row.label}"><span>⋯</span><span>${row.label}</span></button>`;
  return `<div class="jd-line ${row.kind} ${row.changeKind||''} ${row.group!==undefined?'jd-changed':''}" data-row="${i}" ${row.group!==undefined?`data-group="${row.group}"`:''}>${unified?`<span class="jd-uni-gutter"><span>${row.old??''}</span><span>${row.new??''}</span></span>`:''}<span class="jd-code">${diffHighlight(row.text,t.wordHighlight===false?[]:row.wordRanges)}</span></div>`;
}
function renderAirDiff(t){
  diffResizeObserver?.disconnect();
  const list=getChanges(t),ch=list.find(c=>c.path===t.path);
  if(!ch){$('#content').innerHTML='<div class="no-changes">No diff was recorded for this file.</div>';return}
  if(t.expandedContext===undefined)t.expandedContext=!isTurnDiff(t);
  const model=createDiffModel(t,ch),split=t.mode!=='unified',partial=isTurnDiff(t),oldLabel=t.commit?project(t.source).commit:partial?'Before Turn':t.scope==='project'?'HEAD · '+project(t.source).commit:'Before Session',newLabel=t.commit?'Current version':partial?'After Turn':t.scope==='project'?'Working Tree':'After Session';
  const toolbarButton=(id,label,action,disabled=false)=>ib(id,label,action).replace('<button',`<button ${disabled?'disabled':''}`);
  $('#content').innerHTML=`<div class="jd-diff ${split?'jd-split-mode':'jd-unified-mode'} ${t.lineNumbers===false?'jd-no-numbers':''} ${t.whitespaces?'jd-whitespaces':''} ${t.wordHighlight===false?'jd-no-words':''} ${t.commit?'jd-commit-mode':''}">
  <div class="jd-toolbar" role="toolbar" aria-label="Diff tools">${toolbarButton('arrow-up','Previous difference','jd-previous',!model.groups.length||(t.selectedDifference??0)<=0)}${toolbarButton('arrow-down','Next difference','jd-next',!model.groups.length||t.selectedDifference===model.groups.length-1)}<span class="jd-divider"></span>${toolbarButton('pencil','Open current file','jd-source',!project(t.scope==='project'?t.source:'main').files[t.path])}<span class="jd-divider"></span>${t.commit?`<span class="jd-commit-file-navigation">${toolbarButton('arrow-left','Previous changed file','jd-file-previous',list.findIndex(c=>c.path===t.path)<=0)}<button class="jd-file-count" data-action="jd-files" aria-label="Choose changed file">${list.length} file${list.length===1?'':'s'}</button>${toolbarButton('arrow-right','Next changed file','jd-file-next',list.findIndex(c=>c.path===t.path)>=list.length-1)}</span>`:`<button class="jd-session-link" data-action="jd-session">${agentIcon(session(t.session).agent)}<span>Go to Session</span></button><span class="jd-divider"></span><button class="jd-file-count" data-action="jd-files" aria-label="Choose changed file">${list.length} file${list.length===1?'':'s'}</button>`}<span class="jd-divider"></span>${toolbarButton(t.expandedContext?'collapse':'expand',t.expandedContext?'Collapse unchanged context':'Expand unchanged context','jd-context')}<span class="grow"></span><span class="jd-difference-count">${model.groups.length} difference${model.groups.length===1?'':'s'}</span><div class="jd-layout-toggle" role="group" aria-label="Diff layout"><button data-action="jd-split" aria-label="Side by side" title="Side-by-side viewer" aria-pressed="${split}">${icon('split-view')}</button><button data-action="jd-unified" aria-label="Unified" title="Unified viewer" aria-pressed="${!split}">${icon('unified-view')}</button></div>${ib('settings','Diff settings','jd-settings')}</div>
  ${partial?`<div class="jd-snapshot-banner">${icon('info')}<span>This snapshot shows only the agent's changes from that turn. It may not reflect the current state.</span><button data-action="jd-full-diff">Open full diff</button></div>`:''}
  <div class="jd-version-labels ${split?'':'jd-stacked'}"><div>${icon('lock')}<span>${esc(oldLabel)}</span>${t.commit?`<span class="jd-label-path">${esc(t.path)}</span>`:''}</div><div>${t.commit?`<button role="checkbox" aria-label="Include current version in commit" aria-checked="${commitIncluded(t.path)}" class="commit-checkbox ${commitIncluded(t.path)?'checked':''}" data-action="commit-check" data-path="${esc(t.path)}">${commitIncluded(t.path)?icon('check'):''}</button>`:icon('lock')}<span>${esc(newLabel)}</span></div></div>
  <div class="jd-viewport"><div class="jd-scroll" tabindex="0" aria-label="${partial?'Agent turn':'Full'} diff for ${esc(base(ch.path))}">${split?`<div class="jd-split"><div class="jd-pane jd-left" tabindex="0" aria-label="Before diff source">${model.before.map((row,i)=>diffRow(row,i,t)).join('')}</div><div class="jd-center" aria-hidden="true"><svg class="jd-connectors" preserveAspectRatio="none"></svg><div class="jd-before-numbers">${model.before.map(row=>`<span>${row.line??''}</span>`).join('')}</div><div class="jd-after-numbers">${model.after.map(row=>`<span>${row.line??''}</span>`).join('')}</div></div><div class="jd-pane jd-right" tabindex="0" aria-label="After diff source">${model.after.map((row,i)=>diffRow(row,i,t)).join('')}</div></div>`:`<div class="jd-unified" tabindex="0" aria-label="Unified diff source">${model.unified.map((row,i)=>diffRow(row,i,t,true)).join('')}</div>`}</div><div class="jd-overview" aria-label="Difference overview">${model.groups.map(g=>`<button class="jd-overview-mark ${g.kind}" data-action="jd-jump" data-index="${g.index}" aria-label="Go to difference ${g.index+1}"></button>`).join('')}</div></div><div class="jd-horizontal ${split?'':'jd-one-scroll'}">${split?'<div class="jd-scrollbar" data-pane="0"><div></div></div><div></div><div class="jd-scrollbar" data-pane="1"><div></div></div>':'<div class="jd-scrollbar" data-pane="0"><div></div></div>'}</div></div>`;
  const sc=$('.jd-scroll');sc.scrollTop=t.diffScroll||0;
  sc.addEventListener('scroll',()=>{t.diffScroll=sc.scrollTop},{passive:true});
  $$('.jd-pane,.jd-unified').forEach((el,i)=>{el.scrollLeft=t.horizontalScroll?.[i]||0;el.addEventListener('scroll',()=>{t.horizontalScroll||={};t.horizontalScroll[i]=el.scrollLeft},{passive:true})});
  if(t.selectedDifference!==undefined)$$(`[data-group="${t.selectedDifference}"]`).forEach(el=>el.classList.add('jd-selected'));
  const panes=$$('.jd-pane,.jd-unified');
  $$('.jd-scrollbar').forEach(bar=>{const pane=panes[+bar.dataset.pane];bar.firstElementChild.style.width=pane.scrollWidth+'px';bar.scrollLeft=pane.scrollLeft;bar.addEventListener('scroll',()=>{pane.scrollLeft=bar.scrollLeft},{passive:true});pane.addEventListener('scroll',()=>{bar.scrollLeft=pane.scrollLeft},{passive:true})});
  const draw=()=>{drawDiffConnectors(model,t);$$('.jd-scrollbar').forEach(bar=>bar.firstElementChild.style.width=panes[+bar.dataset.pane].scrollWidth+'px')};
  diffResizeObserver=new ResizeObserver(draw);diffResizeObserver.observe($('.jd-viewport'));draw();
}
function drawDiffConnectors(model,t){
  const center=$('.jd-center'),sc=$('.jd-scroll');if(!sc)return;
  const rowHeight=parseFloat(getComputedStyle($('.jd-diff')).getPropertyValue('--diff-row-height'))||26;
  if(center){
    const height=Math.max(model.before.length,model.after.length)*rowHeight,svg=$('.jd-connectors');
    svg.setAttribute('viewBox',`0 0 128 ${Math.max(1,height)}`);svg.style.height=height+'px';
    svg.innerHTML=model.groups.map(g=>{const a=g.oldStart*rowHeight,b=g.newStart*rowHeight,c=(g.oldStart+g.oldCount)*rowHeight,d=(g.newStart+g.newCount)*rowHeight;return `<path class="${g.kind}" d="M0 ${a} H43 C55 ${a} 69 ${b} 85 ${b} H128 V${d} H85 C69 ${d} 55 ${c} 43 ${c} H0 Z"/>`}).join('');
  }
  const total=(t.mode==='unified'?model.unified.length:Math.max(model.before.length,model.after.length))*rowHeight,scale=Math.min(1,sc.clientHeight/Math.max(1,total));
  model.groups.forEach(g=>{const marker=$(`.jd-overview-mark[data-index="${g.index}"]`),start=t.mode==='unified'?g.unifiedStart:g.newStart,count=t.mode==='unified'?g.unifiedCount:g.newCount;marker.style.top=(start*rowHeight*scale)+'px';marker.style.height=Math.max(2,count*rowHeight*scale)+'px'});
}
function jumpDiff(t,direction,index){
  const ch=getChanges(t).find(c=>c.path===t.path),model=createDiffModel(t,ch);if(!model.groups.length)return;
  const next=index??Math.max(0,Math.min(model.groups.length-1,(t.selectedDifference??-1)+direction));t.selectedDifference=next;
  $('[data-action=jd-previous]').disabled=next<=0;$('[data-action=jd-next]').disabled=next>=model.groups.length-1;
  $$('.jd-selected').forEach(el=>el.classList.remove('jd-selected'));
  const rows=$$(`[data-group="${next}"]`);rows.forEach(el=>el.classList.add('jd-selected'));
  const row=rows[0],sc=$('.jd-scroll');if(row)sc.scrollTop=Math.max(0,row.offsetTop-52);
  persist();
}
function diffPopup(title,body,anchor){
  closeOverlay();const r=anchor.getBoundingClientRect(),width=Math.min(380,innerWidth-24),left=Math.max(10,Math.min(innerWidth-width-10,r.right-width));
  $('#overlay-root').innerHTML=`<div class="jd-menu-backdrop" data-action="close-overlay"></div><section class="jd-menu" role="menu" aria-label="${title}" style="left:${left}px;top:${Math.min(r.bottom+5,innerHeight-270)}px;width:${width}px">${body}</section>`;
  $('.jd-menu button')?.focus();$$('.jd-menu button').forEach((button,i,all)=>button.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();all[(i+(e.key==='ArrowDown'?1:-1)+all.length)%all.length].focus()}}));
}
function diffAction(name,el){
  if(!name.startsWith('jd-'))return false;
  const t=activeTab();
  switch(name){
    case 'jd-split':case 'jd-unified':t.mode=name==='jd-split'?'split':'unified';state.diffMode=t.mode;t.diffScroll=0;renderAirDiff(t);persist();break;
    case 'jd-session':openSession(t.session);break;
    case 'jd-full-diff':openDiff(t.path,{scope:'project',source:'main',session:t.session,mode:t.mode,expandedContext:true});break;
    case 'jd-source':{const source=t.scope==='project'?t.source:'main';if(!state.tabs.some(x=>x.id==='file:'+source+':'+t.path))state.tabs.splice(state.tabs.indexOf(t)+1,0,{id:'file:'+source+':'+t.path,type:'file',source,path:t.path});goToSource(t.path,1,source);break}
    case 'jd-previous':jumpDiff(t,-1);break;
    case 'jd-next':jumpDiff(t,1);break;
    case 'jd-jump':jumpDiff(t,0,+el.dataset.index);break;
    case 'jd-context':t.expandedContext=!t.expandedContext;t.diffScroll=0;renderAirDiff(t);persist();break;
    case 'jd-files':{const changes=getChanges(t);diffPopup('Changed files',changes.map(c=>`<button role="menuitem" data-action="jd-file" data-path="${esc(c.path)}">${fileIcon(c.path)}<span class="jd-menu-file"><b>${esc(base(c.path))}</b><small>${esc(parent(c.path)||'Project root')}</small></span>${stats(c)}</button>`).join(''),el);break}
    case 'jd-file-previous':case 'jd-file-next':{const changes=getChanges(t),index=changes.findIndex(c=>c.path===t.path)+(name==='jd-file-next'?1:-1);if(changes[index])diffAction('jd-file',{dataset:{path:changes[index].path}});break}
    case 'jd-file':closeOverlay();t.path=el.dataset.path;if(t.commit){state.commitSelected=t.path;renderCommitWindow()}t.diffScroll=0;t.horizontalScroll={};delete t.selectedDifference;renderTabs();renderAirDiff(t);persist();break;
    case 'jd-settings':{const option=(key,label,checked)=>`<button role="menuitemcheckbox" aria-checked="${checked}" data-action="jd-setting" data-setting="${key}"><span class="jd-menu-check">${checked?icon('check'):''}</span>${label}</button>`;diffPopup('Diff settings',option('wordHighlight','Highlight word differences',t.wordHighlight!==false)+option('lineNumbers','Show line numbers',t.lineNumbers!==false)+option('whitespaces','Show whitespaces',!!t.whitespaces),el);break}
    case 'jd-setting':{const key=el.dataset.setting;t[key]=key==='whitespaces'?!t[key]:t[key]===false;closeOverlay();renderAirDiff(t);persist();break}
  }
  return true;
}
