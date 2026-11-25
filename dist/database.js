'use strict';
// The Database window only browses the bundled capture. It never sends SQL.
function dbIcon(name){return `<img class="icon" src="${assetURL(`icons/database/${name}.svg`)}" alt="" aria-hidden="true">`}
function dbButton(name,label,action='',cls=''){return `<button class="icon-button ${action?'':'db-decoration'} ${cls}" ${action?`data-action="${action}"`:'disabled'} aria-label="${esc(label)}" title="${esc(label)}">${dbIcon(name)}</button>`}
function dbTable(name){return data.database.tables.find(t=>t.name===name)}
function initDatabaseState(stored){
  state.showDatabase=!!stored?.showDatabase;
  state.databaseWidth=Math.max(300,Math.min(650,Number(stored?.databaseWidth)||Math.round(innerWidth*.28)));
  state.databaseExpanded=stored?.databaseExpanded||Object.fromEntries(['source','database','public','tables','table/notification_log','table/notification_log/columns','table/notification_log/keys','table/notification_log/indexes','objects','virtual-views'].map(k=>[k,true]));
  state.databaseSelected=stored?.databaseSelected||'source';
  state.databaseFocused=false;
  state.tabs=state.tabs.filter(t=>t.type!=='database'||dbTable(t.table));
  if(!state.tabs.some(t=>t.id===state.active))state.active=state.tabs[0]?.id;
}
function databaseShell(){return `<div class="database-splitter" role="separator" aria-label="Resize Database" aria-orientation="vertical" tabindex="0" hidden></div><aside class="database-panel" aria-label="Database tool window" hidden>
  <header class="database-header"><h2>Database</h2><span class="grow"></span>${dbButton('locate','Select Opened Object','db-locate')}${dbButton('expand','Expand All Database Objects','db-expand-all')}${dbButton('collapse','Collapse All Database Objects','db-collapse-all')}${dbButton('more','Database options')}${dbButton('hide','Hide Database','toggle-database')}</header>
  <div class="database-toolbar" role="toolbar" aria-label="Database tools">${dbButton('add','New Data Source')}${dbButton('settings','Data Sources and Drivers')}<i></i>${dbButton('refresh','Refresh','db-refresh')}${dbButton('rollback','Deactivate Data Source')}${dbButton('console','New Query Console')}${dbButton('table','Open Data','db-open-selected')}<button class="db-toolbar-text db-decoration" disabled>DDL</button>${dbButton('transpose','Compare Data Sources')}<i></i>${dbButton('submit','Synchronize')}${dbButton('eye','View Options')}${icon('sessions-tool')}</div>
  <div id="database-tree" class="database-tree" role="tree" aria-label="Database objects"></div>
</aside>`}
function renderDatabaseVisibility(){
  const panel=$('.database-panel');if(!panel)return;
  panel.hidden=!state.showDatabase;$('.database-splitter').hidden=!state.showDatabase;
  $('.workbench').classList.toggle('database-open',state.showDatabase);
  document.documentElement.style.setProperty('--database-width',state.databaseWidth+'px');
  const rail=$('.database-rail');rail?.classList.toggle('active',state.showDatabase);rail?.classList.toggle('unfocused',!state.databaseFocused);rail?.setAttribute('aria-pressed',String(state.showDatabase));
}
function showDatabase(focus=true){state.showDatabase=true;state.databaseFocused=focus;if(focus)state.focusedTool='database';renderToolWindowVisibility();renderDatabaseTree();renderDatabaseVisibility();persist()}
function openDatabaseTable(name){
  if(!dbTable(name))return;
  state.databaseSelected='table/'+name;state.databaseFocused=false;
  openTab({id:'database:'+name,type:'database',table:name});renderDatabaseTree();renderDatabaseVisibility();
  if(innerWidth<760){state.showDatabase=false;state.mobileSide=false;renderShellVisibility();persist()}
  $('.db-grid')?.focus({preventScroll:true});
}
function dbColumnIcon(column){return column.primary?'column-key':column.indexed?'column-index':!column.nullable?'column-required':'column'}
function databaseNodes(){
  const node=(id,label,art,children,extra={})=>({id,label,art,children,...extra});
  const tables=data.database.tables.map(table=>node('table/'+table.name,table.name,'table',[
    node('table/'+table.name+'/columns','columns','folder',table.columns.map(c=>node('table/'+table.name+'/column/'+c.name,c.name,dbColumnIcon(c),null,{detail:c.type+(c.default?' = '+c.default:''),table:table.name,column:c.name})),{count:table.columns.length}),
    node('table/'+table.name+'/keys','keys','folder',table.keys.map(k=>node('table/'+table.name+'/key/'+k.name,k.name,'key',null,{detail:k.definition.replace(/^PRIMARY KEY /,'').replace(/^UNIQUE /,'')+(k.primary?'':' UNIQUE')})),{count:table.keys.length}),
    node('table/'+table.name+'/indexes','indexes','folder',table.indexes.map(i=>node('table/'+table.name+'/index/'+i.name,i.name,i.definition.includes('UNIQUE')?'index-unique':'index',null,{detail:i.definition.slice(i.definition.lastIndexOf('('))+(i.definition.includes('UNIQUE')?' UNIQUE':'')})),{count:table.indexes.length})
  ],{table:table.name}));
  const groups=Object.entries(data.database.objects).map(([name,names])=>node('object/'+name,name,'folder',names.map((s,i)=>node('object/'+name+'/'+i,s,'column',null)),{count:names.length}));
  return [node('source',data.database.dataSource,'postgres',[
    node('database',data.database.database,'database',[
      node('public','public','schema',[node('tables','tables','folder',tables,{count:tables.length}),node('sequences','sequences','folder',data.database.sequences.map(s=>node('sequence/'+s.name,s.name,'sequence',null,{detail:s.type})),{count:data.database.sequences.length})]),
      node('objects','Database Objects','objects',[...groups,node('virtual-views','virtual views','virtual-folder',[node('sessions','sessions','view',null)],{count:1})])
    ],{badge:'1 of 3'})
  ],{badge:'1 of 2',connected:true})];
}
let visibleDatabaseNodes=[];
function renderDatabaseTree(){
  const tree=$('#database-tree');if(!tree)return;visibleDatabaseNodes=[];
  const render=(nodes,level)=>nodes.map(n=>{
    visibleDatabaseNodes.push({...n,level});const branch=!!n.children?.length,open=branch&&!!state.databaseExpanded[n.id],selected=state.databaseSelected===n.id;
    return `<div class="db-tree-row ${selected?'selected':''}" role="treeitem" aria-label="${esc(n.label)}" aria-level="${level}" ${branch?`aria-expanded="${open}"`:''} aria-selected="${selected}" tabindex="${selected?0:-1}" data-db-node="${esc(n.id)}" ${n.table?`data-db-table="${n.table}"`:''} style="--db-depth:${level-1}">
      <button class="db-tree-caret" tabindex="-1" ${branch?`data-action="db-toggle-node" data-node="${esc(n.id)}" aria-label="${open?'Collapse':'Expand'} ${esc(n.label)}"`:'disabled'}>${branch?icon('chevron',open?'down':''):''}</button>
      <span class="db-tree-icon ${n.connected?'db-connected':''}">${dbIcon(n.art)}</span><span class="db-tree-label">${esc(n.label)}</span>${n.badge?`<span class="db-tree-badge">${n.badge}</span>`:''}${n.count!==undefined?`<span class="db-tree-count">${n.count}</span>`:''}${n.detail?`<span class="db-tree-detail" title="${esc(n.detail)}">${esc(n.detail)}</span>`:''}
    </div>${open?render(n.children,level+1):''}`;
  }).join('');
  tree.innerHTML=render(databaseNodes(),1);
}
function selectDatabaseNode(id,focus=false){
  state.databaseSelected=id;
  $$('[data-db-node]').forEach(row=>{const selected=row.dataset.dbNode===id;row.classList.toggle('selected',selected);row.setAttribute('aria-selected',String(selected));row.tabIndex=selected?0:-1;if(selected&&focus)row.focus({preventScroll:true})});persist();
}
function openSelectedDatabaseObject(){
  const selected=visibleDatabaseNodes.find(n=>n.id===state.databaseSelected);
  const name=selected?.table||state.databaseSelected.match(/^table\/([^/]+)/)?.[1];
  if(name){openDatabaseTable(name);if(selected?.column){const t=activeTab();t.dbSelected={row:0,col:dbTable(name).columns.findIndex(c=>c.name===selected.column)};renderDatabaseGrid(t);scrollDatabaseSelection()}}
}
function navigateToDatabaseSource(){closeOverlay();for(const id of ['source','database','public','tables'])state.databaseExpanded[id]=true;state.databaseSelected='source';showDatabase();$('[data-db-node="source"]')?.focus();setDatabaseBreadcrumb(['Database',data.database.dataSource])}
function decorateDatabaseSource(t){
  if(!/\.ya?ml$/.test(t.path))return;
  const file=project(t.source).files[t.path];if(!file?.text.includes('jdbc:postgresql://localhost:5432/notifyhub'))return;
  const line=file.text.split('\n').findIndex(l=>/^\s+datasource:\s*$/.test(l))+1;
  const gutter=$(`.code-line[data-line="${line}"] .source-gutter`);if(gutter)gutter.innerHTML=`<button class="database-source-gutter" data-action="db-navigate-source" aria-label="Navigate to existing datasource" title="Navigate to existing datasource">${editorIcon('database')}</button>`;
}
function setDatabaseBreadcrumb(parts){$('#breadcrumbs').innerHTML=parts.map((p,i)=>(i?icon('chevron'):'')+`<span class="${i===parts.length-1?'truncate':''}">${i===parts.length-1&&dbTable(p)?dbIcon('table'):''}${esc(p)}</span>`).join('')}
function databaseBreadcrumb(t){setDatabaseBreadcrumb(['Database',data.database.dataSource,data.database.database,data.database.schema,'tables',t.table])}

const databaseColumnWidths={
  notification_template:{id:96,channel:152,template_code:220,subject_template:270,body_template:300,locale:140,active:120,created_at:240,updated_at:240},
  notification_log:{id:96,notification_id:410,recipient:270,channel:152,template_code:220,status:150,sent_at:240,error_message:300,created_at:240},
  flyway_schema_history:{installed_rank:235,version:150,description:315,type:120,script:400,checksum:170,installed_by:220,installed_on:245,execution_time:170,success:120}
};
function databaseValue(value){return value===null?'<null>':typeof value==='boolean'?String(value):String(value).replace(/^(\d{4}-\d\d-\d\d)T/,'$1 ')}
function databaseFilter(table,where){
  if(!where?.trim())return {test:()=>true};
  // A deliberately small predicate parser. No eval, SQL execution or network.
  const tokens=where.trim().match(/'(?:''|[^'])*'|\bAND\b|[^']+/gi);
  if(!tokens)return {error:'Use column = value, ILIKE, or IS NULL'};
  const clauses=[];let current='';
  for(const token of tokens){
    if(token.startsWith("'"))current+=token;
    else for(const [i,part] of token.split(/\bAND\b/i).entries()){if(i){clauses.push(current.trim());current=''}current+=part}
  }
  clauses.push(current.trim());const predicates=[];
  for(const clause of clauses){
    const m=clause.match(/^"?(\w+)"?\s*(IS\s+NOT\s+NULL|IS\s+NULL|ILIKE|LIKE|>=|<=|<>|!=|=|>|<)\s*(.*?)\s*$/i);
    if(!m||!table.columns.some(c=>c.name===m[1]))return {error:'Use a column name and =, !=, >, <, LIKE, ILIKE, or IS NULL'};
    const [,column,rawOp,raw]=m,op=rawOp.toUpperCase().replace(/\s+/g,' ');
    let value;
    if(op.startsWith('IS ')){if(raw)return {error:'Unexpected value after IS NULL'};value=null}
    else if(/^'(?:''|[^'])*'$/.test(raw))value=raw.slice(1,-1).replace(/''/g,"'");
    else if(/^-?\d+(?:\.\d+)?$/.test(raw))value=Number(raw);
    else if(/^(true|false)$/i.test(raw))value=raw.toLowerCase()==='true';
    else return {error:'Put text values in single quotes'};
    predicates.push(row=>{const actual=row[column];if(op==='IS NULL')return actual===null;if(op==='IS NOT NULL')return actual!==null;if(actual===null)return false;
      if(op==='LIKE'||op==='ILIKE'){const pattern=String(value).split('').map(c=>c==='%'?'.*':c==='_'?'.':c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('');return new RegExp('^'+pattern+'$',op==='ILIKE'?'i':'').test(String(actual))}
      const a=typeof value==='number'?Number(actual):actual;return op==='='?a===value:op==='!='||op==='<>'?a!==value:op==='>'?a>value:op==='<'?a<value:op==='>='?a>=value:a<=value;
    });
  }
  return {test:row=>predicates.every(test=>test(row))};
}
function databaseRows(t){
  const table=dbTable(t.table),filter=databaseFilter(table,t.dbWhere),rows=table.rows.filter(filter.test||(()=>true)),order=[];let orderError=false;
  for(const item of (t.dbOrder||'').split(',').map(s=>s.trim()).filter(Boolean)){
    const m=item.match(/^"?(\w+)"?(?:\s+(ASC|DESC))?$/i);
    if(!m||!table.columns.some(c=>c.name===m[1])){orderError=true;break}order.push({column:m[1],desc:m[2]?.toUpperCase()==='DESC'});
  }
  if(!orderError&&order.length)rows.sort((a,b)=>{for(const {column,desc} of order){const x=a[column],y=b[column],c=x===y?0:x===null?1:y===null?-1:typeof x==='number'?x-y:String(x).localeCompare(String(y));if(c)return desc?-c:c}return 0});
  return {rows,filterError:filter.error,order,orderError};
}
function databaseTableToolbar(){return `<div class="db-data-toolbar" role="toolbar" aria-label="Table tools">
  ${dbButton('refresh','Refresh','db-table-refresh')}${dbButton('history','Query History')}${capturedRunButton('stop-menu','Cancel Query')}<i></i>${dbButton('add','Add Row')}${dbButton('remove','Delete Row')}${dbButton('rollback','Revert Changes')}${dbButton('preview','Preview Changes')}${dbButton('submit','Submit Changes')}<i></i>
  <button class="db-toolbar-text db-decoration" disabled>Tx: Auto ${editorIcon('chevron')}</button><i></i><button class="db-toolbar-text db-decoration" disabled>DDL</button>${dbButton('search','Find in Table','db-find')}${dbButton('filter','Filter Rows','db-focus-filter')}${dbButton('eye','Column List')}${dbButton('gear','Data Formatting')}<span class="grow"></span>
  <button class="db-toolbar-text db-decoration" disabled>SQL</button><i></i><button class="db-toolbar-text db-decoration" disabled>CSV ${editorIcon('chevron')}</button><i></i>${dbButton('export','Export Data')}${dbButton('import','Import Data')}${dbButton('transpose','Transpose')}${dbButton('eye','View as')}${dbButton('gear','Table Settings')}
</div>`}
function renderDatabaseTable(t){
  $('#content').innerHTML=`<section class="db-table-editor" aria-label="${esc(t.table)} table viewer">${databaseTableToolbar()}
    <div class="db-table-find" ${t.dbFindOpen?'':'hidden'}>${dbIcon('search')}<input aria-label="Find in table" value="${esc(t.dbFind||'')}" placeholder="Find"><span class="db-find-count"></span><span class="grow"></span><button class="icon-button" data-action="db-find-next" aria-label="Next table match">${icon('chevron','down')}</button><button class="icon-button" data-action="db-find-close" aria-label="Close table search">${icon('close')}</button></div>
    <div class="db-filter-bar"><label>${dbIcon('filter')}<input class="db-where" aria-label="WHERE filter" placeholder="WHERE" spellcheck="false" value="${esc(t.dbWhere||'')}"></label><label>${dbIcon('sort')}<input class="db-order" aria-label="ORDER BY" placeholder="ORDER BY" spellcheck="false" value="${esc(t.dbOrder||'')}"></label></div>
    <div class="db-grid-scroll" role="region" aria-label="${esc(t.table)} rows"><div class="db-grid-canvas"></div></div>
    <div class="db-row-count"><button class="db-decoration" disabled><span class="db-row-count-text"></span>${editorIcon('chevron')}</button><i></i>${dbButton('more','Result Set Options')}</div>
  </section>`;
  renderDatabaseGrid(t);initDatabaseTable(t);
}
function renderDatabaseGrid(t){
  const canvas=$('.db-grid-canvas');if(!canvas)return;
  const table=dbTable(t.table),{rows,filterError,order,orderError}=databaseRows(t),widths=table.columns.map(c=>t.dbWidths?.[c.name]||databaseColumnWidths[t.table][c.name]||200),selection=t.dbSelected;
  for(const [selector,error] of [['.db-where',filterError],['.db-order',orderError?'Use a column name followed by ASC or DESC':'']]){const e=$(selector);e.setAttribute('aria-invalid',String(!!error));e.title=error||''}
  canvas.innerHTML=`<table class="db-grid" role="grid" tabindex="0" aria-label="${esc(table.name)} data" aria-readonly="true" aria-rowcount="${rows.length+1}" aria-colcount="${table.columns.length+1}" style="width:${widths.reduce((a,b)=>a+b,32)}px"><colgroup><col style="width:32px">${widths.map((w,i)=>`<col data-db-column="${i}" style="width:${w}px">`).join('')}</colgroup>
    <thead><tr><th class="db-row-number"></th>${table.columns.map((c,i)=>{const sorted=order.find(o=>o.column===c.name);return `<th role="columnheader" aria-sort="${sorted?sorted.desc?'descending':'ascending':'none'}"><button data-action="db-sort" data-column="${c.name}" aria-label="Sort by ${c.name}" title="Sort by ${c.name}">${dbIcon(dbColumnIcon(c))}<span>${c.name}</span><span class="db-sort-arrows ${sorted?(sorted.desc?'descending':'ascending'):''}"></span></button><span class="db-column-resizer" data-db-resize="${i}" role="separator" aria-orientation="vertical" aria-label="Resize ${c.name}" tabindex="0"></span></th>`}).join('')}</tr></thead>
    <tbody>${rows.map((row,r)=>`<tr role="row" aria-rowindex="${r+2}"><th class="db-row-number" scope="row">${r+1}</th>${table.columns.map((c,col)=>{const value=row[c.name],selected=selection?.row===r&&selection?.col===col;return `<td role="gridcell" aria-colindex="${col+2}" aria-selected="${!!selected}" class="${value===null?'db-null ':''}${typeof value==='number'?'db-number ':''}${selected?'db-cell-selected':''}" data-db-row="${r}" data-db-cell="${col}" title="${esc(databaseValue(value))}">${typeof value==='boolean'?'<span class="db-boolean-dot">·</span> ':''}${esc(databaseValue(value))}</td>`}).join('')}</tr>`).join('')}</tbody></table>`;
  $('.db-row-count-text').textContent=rows.length+' '+(rows.length===1?'row':'rows');
  if(t.dbFind)markDatabaseMatches(t);
}
function selectDatabaseCell(t,row,col,scroll=false){
  const count=databaseRows(t).rows.length;if(!count)return;
  t.dbSelected={row:Math.max(0,Math.min(count-1,row)),col:Math.max(0,Math.min(dbTable(t.table).columns.length-1,col))};
  $$('.db-grid td[aria-selected="true"]').forEach(e=>{e.setAttribute('aria-selected','false');e.classList.remove('db-cell-selected')});
  const cell=$(`td[data-db-row="${t.dbSelected.row}"][data-db-cell="${t.dbSelected.col}"]`);cell?.setAttribute('aria-selected','true');cell?.classList.add('db-cell-selected');if(scroll)scrollDatabaseSelection();persist();
}
function scrollDatabaseSelection(){const t=activeTab(),sc=$('.db-grid-scroll'),cell=$(`td[data-db-row="${t.dbSelected?.row}"][data-db-cell="${t.dbSelected?.col}"]`);if(!sc||!cell)return;const r=cell.getBoundingClientRect(),s=sc.getBoundingClientRect();if(r.top<s.top+36)sc.scrollTop+=r.top-s.top-36;if(r.bottom>s.bottom)sc.scrollTop+=r.bottom-s.bottom;if(r.left<s.left+32)sc.scrollLeft+=r.left-s.left-32;if(r.right>s.right)sc.scrollLeft+=r.right-s.right}
function markDatabaseMatches(t){const body=$('.db-grid tbody');if(!body)return;clearMarks(body);const count=t.dbFind?markTextNodes(body,t.dbFind):0;$('.db-find-count').textContent=t.dbFind?count+' matches':'';t.dbMatch=-1}
function initDatabaseTable(t){
  const sc=$('.db-grid-scroll');sc.scrollTop=t.dbScrollTop||0;sc.scrollLeft=t.dbScrollLeft||0;
  let saveTimer;sc.addEventListener('scroll',()=>{t.dbScrollTop=sc.scrollTop;t.dbScrollLeft=sc.scrollLeft;clearTimeout(saveTimer);saveTimer=setTimeout(persist,180)},{passive:true});
  for(const [selector,key] of [['.db-where','dbWhere'],['.db-order','dbOrder']])$(selector).addEventListener('input',e=>{t[key]=e.target.value;t.dbSelected=null;sc.scrollTop=0;renderDatabaseGrid(t);persist()});
  $('.db-table-find input').addEventListener('input',e=>{t.dbFind=e.target.value;markDatabaseMatches(t);persist()});
  $('.db-table-find input').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();databaseAction('db-find-next')}});
  sc.addEventListener('click',e=>{const cell=e.target.closest('td[data-db-cell]');if(cell){selectDatabaseCell(t,+cell.dataset.dbRow,+cell.dataset.dbCell);$('.db-grid').focus({preventScroll:true})}});
  sc.addEventListener('keydown',e=>{
    if(e.target.closest('button,input,[data-db-resize]'))return;
    let {row=0,col=0}=t.dbSelected||{};
    if(['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End','PageDown','PageUp'].includes(e.key)){
      e.preventDefault();if(e.key==='ArrowDown')row++;if(e.key==='ArrowUp')row--;if(e.key==='ArrowLeft')col--;if(e.key==='ArrowRight')col++;if(e.key==='PageDown')row+=Math.max(1,Math.floor(sc.clientHeight/30)-1);if(e.key==='PageUp')row-=Math.max(1,Math.floor(sc.clientHeight/30)-1);if(e.key==='Home'){col=0;if(e.metaKey||e.ctrlKey)row=0}if(e.key==='End'){col=dbTable(t.table).columns.length-1;if(e.metaKey||e.ctrlKey)row=databaseRows(t).rows.length-1}selectDatabaseCell(t,row,col,true);
    }
  });
  sc.addEventListener('pointerdown',e=>{const handle=e.target.closest('[data-db-resize]');if(!handle)return;e.preventDefault();const i=+handle.dataset.dbResize,name=dbTable(t.table).columns[i].name,start=e.clientX,col=$(`col[data-db-column="${i}"]`),width=parseFloat(col.style.width),grid=$('.db-grid'),total=grid.getBoundingClientRect().width;handle.setPointerCapture(e.pointerId);
    const move=ev=>{const w=Math.max(70,Math.min(1200,width+ev.clientX-start));t.dbWidths||={};t.dbWidths[name]=w;col.style.width=w+'px';grid.style.width=total+w-width+'px'};
    const end=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);persist()};handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
  });
  sc.addEventListener('keydown',e=>{const h=e.target.closest('[data-db-resize]');if(!h||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const name=dbTable(t.table).columns[+h.dataset.dbResize].name;t.dbWidths||={};t.dbWidths[name]=Math.max(70,(t.dbWidths[name]||databaseColumnWidths[t.table][name]||200)+(e.key==='ArrowRight'?15:-15));renderDatabaseGrid(t);$(`[data-db-resize="${h.dataset.dbResize}"]`)?.focus();persist()});
}
function databaseAction(name,el){
  const t=activeTab();
  switch(name){
    case 'toggle-database':state.showDatabase=!state.showDatabase;state.databaseFocused=state.showDatabase;if(state.showDatabase)showDatabase();else{renderDatabaseVisibility();persist()}return true;
    case 'db-navigate-source':navigateToDatabaseSource();return true;
    case 'db-toggle-node':{const id=el.dataset.node;state.databaseExpanded[id]=!state.databaseExpanded[id];renderDatabaseTree();selectDatabaseNode(id,true);return true}
    case 'db-open-selected':openSelectedDatabaseObject();return true;
    case 'db-refresh':renderDatabaseTree();return true;
    case 'db-locate':if(t?.type==='database'){for(const id of ['source','database','public','tables'])state.databaseExpanded[id]=true;renderDatabaseTree();selectDatabaseNode('table/'+t.table,true);$('[data-db-node="table/'+t.table+'"]')?.scrollIntoView({block:'nearest'})}return true;
    case 'db-expand-all':{const visit=nodes=>nodes.forEach(n=>{if(n.children?.length){state.databaseExpanded[n.id]=true;visit(n.children)}});visit(databaseNodes());renderDatabaseTree();persist();return true}
    case 'db-collapse-all':state.databaseExpanded={};renderDatabaseTree();selectDatabaseNode('source');return true;
    case 'db-table-refresh':t.dbWhere='';t.dbOrder='';t.dbSelected=null;t.dbScrollTop=0;t.dbScrollLeft=0;renderDatabaseTable(t);persist();return true;
    case 'db-sort':{const column=el.dataset.column;t.dbOrder=t.dbOrder===column+' ASC'?column+' DESC':t.dbOrder===column+' DESC'?'':column+' ASC';$('.db-order').value=t.dbOrder;renderDatabaseGrid(t);persist();return true}
    case 'db-focus-filter':$('.db-where')?.focus();return true;
    case 'db-find':t.dbFindOpen=!t.dbFindOpen;renderDatabaseTable(t);if(t.dbFindOpen)$('.db-table-find input').focus();persist();return true;
    case 'db-find-close':t.dbFindOpen=false;t.dbFind='';renderDatabaseTable(t);persist();return true;
    case 'db-find-next':{const matches=$$('.db-grid mark');if(matches.length){matches.forEach(e=>e.classList.remove('current'));t.dbMatch=((t.dbMatch??-1)+1)%matches.length;matches[t.dbMatch].classList.add('current');matches[t.dbMatch].scrollIntoView({block:'center',inline:'nearest'});$('.db-find-count').textContent=(t.dbMatch+1)+' of '+matches.length}return true}
  }
  return false;
}
function initDatabase(){
  const tree=$('#database-tree');renderDatabaseTree();renderDatabaseVisibility();
  tree.addEventListener('click',e=>{if(e.target.closest('[data-action]'))return;const row=e.target.closest('[data-db-node]');if(!row)return;selectDatabaseNode(row.dataset.dbNode);if(row.dataset.dbTable&&e.target.closest('.db-tree-label'))openSelectedDatabaseObject()});
  tree.addEventListener('dblclick',e=>{if(e.target.closest('[data-action]'))return;const row=e.target.closest('[data-db-node]');if(row){state.databaseSelected=row.dataset.dbNode;openSelectedDatabaseObject()}});
  tree.addEventListener('keydown',e=>{
    if(e.target.closest('button'))return;const index=visibleDatabaseNodes.findIndex(n=>n.id===state.databaseSelected),current=visibleDatabaseNodes[index];if(!current)return;
    const k=e.key;if(!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End','Enter',' '].includes(k))return;e.preventDefault();
    if(k==='Enter'){openSelectedDatabaseObject();return}
    if(k===' '){if(current.children?.length)databaseAction('db-toggle-node',{dataset:{node:current.id}});return}
    let next=index;if(k==='ArrowDown')next++;if(k==='ArrowUp')next--;if(k==='Home')next=0;if(k==='End')next=visibleDatabaseNodes.length-1;
    if(k==='ArrowRight'){if(current.children?.length&&!state.databaseExpanded[current.id]){databaseAction('db-toggle-node',{dataset:{node:current.id}});return}if(current.children?.length)next++}
    if(k==='ArrowLeft'){if(current.children?.length&&state.databaseExpanded[current.id]){databaseAction('db-toggle-node',{dataset:{node:current.id}});return}next=visibleDatabaseNodes.findLastIndex((n,i)=>i<index&&n.level<current.level);if(next<0)next=index}
    selectDatabaseNode(visibleDatabaseNodes[Math.max(0,Math.min(visibleDatabaseNodes.length-1,next))].id,true);
  });
  document.addEventListener('pointerdown',e=>{if(!state.showDatabase)return;state.databaseFocused=!!e.target.closest('.database-panel,.database-rail,.database-source-gutter');renderDatabaseVisibility()});
  document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='f'&&activeTab()?.type==='database'){e.preventDefault();if(!activeTab().dbFindOpen)databaseAction('db-find');else $('.db-table-find input').focus()}});
  const splitter=$('.database-splitter'),setWidth=w=>{state.databaseWidth=Math.max(300,Math.min(650,innerWidth*.5,w));document.documentElement.style.setProperty('--database-width',state.databaseWidth+'px')};
  splitter.addEventListener('pointerdown',e=>{e.preventDefault();splitter.setPointerCapture(e.pointerId);const move=ev=>setWidth(innerWidth-42-ev.clientX),end=()=>{splitter.removeEventListener('pointermove',move);splitter.removeEventListener('pointerup',end);splitter.removeEventListener('pointercancel',end);persist()};splitter.addEventListener('pointermove',move);splitter.addEventListener('pointerup',end);splitter.addEventListener('pointercancel',end)});
  splitter.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();setWidth(state.databaseWidth+(e.key==='ArrowLeft'?15:-15));persist()}});
}
