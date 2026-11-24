'use strict';
let searchEverywhereState=null;
function searchEverywhereIcon(file){
  if(file.path.endsWith('.java')){
    const kind=javaDeclarationText(file.text).match(/\b(class|interface|record|enum)\s+\w+/)?.[1]||'class';
    return projectIcon(kind);
  }
  return projectNodeIcon({path:file.path,name:base(file.path),file:true});
}
function openSearchEverywhere(){
  if($('#search-everywhere')){$('#file-search').focus();return}
  const previous=document.activeElement;closeOverlay();overlayPreviousFocus=previous?.isConnected?previous:$('.main-search');
  const source=state.project,files=Object.values(project(source).files),opened=new Map(state.tabs.filter(t=>t.type==='file').map((t,i)=>[t.path,i]));
  if(activeTab()?.path)opened.set(activeTab().path,-1);
  files.sort((a,b)=>(opened.get(a.path)??Infinity)-(opened.get(b.path)??Infinity)||a.path.localeCompare(b.path));
  searchEverywhereState={source,files,matches:files,selected:0};
  const preview='<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M5 5.5h6M5 8h6M5 10.5h4"/></svg>';
  const findWindow='<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="m10.5 5.5-5 5m0-4v4h4"/></svg>';
  $('#overlay-root').innerHTML=`<div class="overlay search-everywhere-overlay"><section class="search-everywhere-dialog" id="search-everywhere" role="dialog" aria-modal="true" aria-label="Search Everywhere"><header class="se-toolbar"><nav class="se-tabs" role="tablist" aria-label="Search categories">${['All','Classes','Files','Symbols','Actions','Text'].map((label,i)=>`<button role="tab" aria-selected="${i===0}" tabindex="-1" class="${i===0?'active':''}" ${i?'disabled':''}>${label}</button>`).join('')}</nav><label class="se-include"><input type="checkbox" disabled>Include non-project items</label><div class="se-header-actions"><button class="icon-button" disabled aria-label="Preview" title="Preview">${preview}</button><button class="icon-button" disabled aria-label="Search filters" title="Search filters">${icon('filter')}</button><button class="icon-button" disabled aria-label="Open in Find tool window" title="Open in Find tool window">${findWindow}</button></div></header><div class="se-search-area"><label class="se-search-field"><span class="se-search-symbol" aria-hidden="true">${editorIcon('session-search')}${icon('chevron','down')}</span><input id="file-search" role="combobox" aria-label="Search all project files" aria-autocomplete="list" aria-expanded="true" aria-controls="file-results" autocomplete="off" spellcheck="false"><span class="se-command-hint">Type / to see commands</span><button class="icon-button se-clear" aria-label="Clear search" title="Clear search" hidden>${editorIcon('session-close')}</button></label></div><div class="se-results" id="file-results" role="listbox" aria-label="Project files"></div><footer class="se-footer"><span class="se-selected-path"></span><button disabled>Open in Right Split</button></footer></section></div>`;
  $('.search-everywhere-overlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeOverlay()});
  const input=$('#file-search');input.addEventListener('input',renderSearchEverywhereResults);
  input.addEventListener('keydown',e=>{
    const s=searchEverywhereState;
    if(['ArrowDown','ArrowUp','PageDown','PageUp'].includes(e.key)){
      e.preventDefault();selectSearchEverywhereResult(s.selected+(e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:e.key==='PageDown'?10:-10),true);
    }else if(e.key==='Enter'){e.preventDefault();openSearchEverywhereResult()}
  });
  $('#search-everywhere').addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();input.focus()}});
  $('.se-tabs .active').addEventListener('click',()=>input.focus());
  $('.se-clear').addEventListener('click',()=>{input.value='';renderSearchEverywhereResults();input.focus()});
  renderSearchEverywhereResults();input.focus();
}
function renderSearchEverywhereResults(){
  const s=searchEverywhereState,q=$('#file-search').value.trim().toLowerCase(),terms=q.split(/\s+/).filter(Boolean);
  s.matches=s.files.filter(f=>terms.every(term=>f.path.toLowerCase().includes(term)));
  if(q)s.matches.sort((a,b)=>Number(base(b.path).toLowerCase().startsWith(q))-Number(base(a.path).toLowerCase().startsWith(q)));
  $('.se-command-hint').hidden=!!q;$('.se-clear').hidden=!$('#file-search').value;
  $('#file-results').innerHTML=s.matches.map((f,i)=>`<button id="se-file-${i}" class="search-result se-result ${esc(f.status||'')}" role="option" aria-selected="false" tabindex="-1" data-search-path="${esc(f.path)}" data-search-index="${i}" title="${esc(f.path)}">${searchEverywhereIcon(f)}<span class="se-file-label"><span class="se-name">${esc(base(f.path))}</span><span class="se-directory">${esc(parent(f.path)||'·')}</span></span><span class="se-project">notify-hub</span>${projectIcon('module')}</button>`).join('')||'<div class="se-empty">Nothing found</div>';
  $$('.se-result').forEach(button=>{
    button.addEventListener('pointerenter',()=>selectSearchEverywhereResult(+button.dataset.searchIndex));
    button.addEventListener('click',()=>openSearchEverywhereResult(+button.dataset.searchIndex));
  });
  $('#file-results').scrollTop=0;selectSearchEverywhereResult(0);
}
function selectSearchEverywhereResult(index,scroll=false){
  const s=searchEverywhereState;s.selected=Math.max(0,Math.min(s.matches.length-1,index));
  $$('.se-result').forEach((row,i)=>{const selected=i===s.selected;row.classList.toggle('selected',selected);row.setAttribute('aria-selected',String(selected))});
  const file=s.matches[s.selected],path=file?project(s.source).root.replace(/^\/Users\/[^/]+/,'~')+'/'+file.path:'';
  $('.se-selected-path').textContent=path;$('.se-selected-path').title=path;
  if(file)$('#file-search').setAttribute('aria-activedescendant','se-file-'+s.selected);else $('#file-search').removeAttribute('aria-activedescendant');
  if(scroll)$('.se-result.selected')?.scrollIntoView({block:'nearest'});
}
function openSearchEverywhereResult(index=searchEverywhereState.selected){
  const s=searchEverywhereState,file=s.matches[index];if(!file)return;
  closeOverlay();openFile(file.path,s.source);$('.code-scroll')?.focus({preventScroll:true});
}
