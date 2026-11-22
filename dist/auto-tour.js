'use strict';
// The tour operates the same read-only controls as a visitor. Trusted input
// cancels the current animation before the application's click handler runs.
let autoTour=null;
class AutomaticTour{
  constructor(){
    this.preferenceKey=storageKey+'-automatic-tour';this.motion=matchMedia('(prefers-reduced-motion: reduce)');
    let preference;try{preference=JSON.parse(localStorage.getItem(this.preferenceKey))}catch{}
    this.enabled=typeof preference==='boolean'?preference:!this.motion.matches;
    this.loop=false;try{this.loop=JSON.parse(localStorage.getItem(this.preferenceKey+'-loop'))===true}catch{}
    this.playing=false;this.hasStarted=false;this.completed=false;this.pace=1;this.position=null;
    this.cursor=document.createElement('div');this.cursor.id='auto-tour-cursor';this.cursor.setAttribute('aria-hidden','true');this.cursor.hidden=true;
    this.cursor.innerHTML='<span class="tour-cursor-core"></span><span class="tour-click-ring"></span><svg class="tour-cursor-pointer" viewBox="0 0 20 24"><path d="M2 2v17l4.6-4.4 3.8 7.4 3-1.6-3.8-7.2H16Z" fill="#16171a" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';document.body.append(this.cursor);
    const activity=e=>{
      if(!e.isTrusted||e.type==='pointermove'&&!e.movementX&&!e.movementY)return;
      if(this.playing)this.stop('paused');
      this.schedule(20000);
    };
    for(const type of ['pointerdown','pointermove','click','wheel','keydown','touchstart'])document.addEventListener(type,activity,{capture:true,passive:true});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop('paused');else this.schedule(6000)});
    window.addEventListener('resize',()=>{this.stop('paused');this.schedule(6000)});
    this.motion.addEventListener('change',()=>{this.stop('paused');this.schedule(6000)});
    this.schedule(5000);
  }
  status(value){document.documentElement.dataset.autoTour=value}
  setEnabled(enabled){
    this.enabled=enabled;try{localStorage.setItem(this.preferenceKey,JSON.stringify(enabled))}catch{}
    if(enabled){this.hasStarted=false;this.completed=false}
    this.stop(enabled?'waiting':'off');if(enabled)this.schedule(1200);
  }
  setLoop(loop){
    this.loop=loop;try{localStorage.setItem(this.preferenceKey+'-loop',JSON.stringify(loop))}catch{}
    this.hasStarted=false;this.completed=false;this.stop(this.enabled?'waiting':'off');
    if(this.enabled)this.schedule(1200);
  }
  schedule(delay){
    clearTimeout(this.timer);
    if(!this.enabled){this.status('off');return}
    if(this.hasStarted&&!(this.loop&&this.completed)){if(!this.playing)this.status(this.completed?'complete':'paused');return}
    if(document.hidden)return;
    this.status(this.playing?'playing':'waiting');
    this.timer=setTimeout(()=>this.start(),delay);
  }
  stop(status='paused'){
    clearTimeout(this.timer);this.controller?.abort();this.controller=null;this.playing=false;
    this.cursor.hidden=true;this.cursor.classList.remove('clicking');this.position=null;
    document.querySelectorAll('.auto-tour-hover').forEach(el=>el.classList.remove('auto-tour-hover'));
    this.status(this.enabled?(this.completed?'complete':status):'off');
  }
  async start(){
    if(this.playing||this.hasStarted&&!(this.loop&&this.completed)||!this.enabled||document.hidden)return;
    // Let visitors finish menus, dialogs, text selection and search first.
    if($('#overlay-root').childElementCount||$('.air-output-options[open]')||!getSelection()?.isCollapsed||document.activeElement?.matches('input,textarea,[contenteditable="true"]')){this.schedule(4000);return}
    clearTimeout(this.timer);this.controller=new AbortController();const signal=this.controller.signal;
    this.hasStarted=true;this.completed=false;this.playing=true;this.status('playing');this.cursor.hidden=false;
    try{
      await this.walk(signal);
      if(!signal.aborted){this.completed=true;this.stop('complete');if(this.loop)this.schedule(10000)}
    }catch(error){
      if(signal.aborted)return;
      this.stop('paused');document.documentElement.dataset.autoTourStep='unavailable';
      console.warn('Automatic tour paused:',error.message);
    }
  }
  check(signal){signal.throwIfAborted()}
  wait(ms,signal){
    this.check(signal);
    return new Promise((resolve,reject)=>{
      const done=()=>{signal.removeEventListener('abort',cancel);resolve()};
      const timer=setTimeout(done,ms*this.pace),cancel=()=>{clearTimeout(timer);signal.removeEventListener('abort',cancel);reject(signal.reason)};
      signal.addEventListener('abort',cancel,{once:true});
    });
  }
  animate(duration,update,signal){
    this.check(signal);duration*=this.motion.matches?0:this.pace;
    if(!duration){update(1);return Promise.resolve()}
    return new Promise((resolve,reject)=>{
      const started=performance.now();let frame;
      const cancel=()=>{cancelAnimationFrame(frame);signal.removeEventListener('abort',cancel);reject(signal.reason)};
      const tick=now=>{
        const p=Math.min(1,(now-started)/duration);update(p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2);
        if(p<1)frame=requestAnimationFrame(tick);else{signal.removeEventListener('abort',cancel);resolve()}
      };
      signal.addEventListener('abort',cancel,{once:true});frame=requestAnimationFrame(tick);
    });
  }
  target(selector){
    const el=typeof selector==='function'?selector():document.querySelector(selector);
    if(!el||!el.getClientRects().length||getComputedStyle(el).visibility==='hidden')throw Error('Control is not visible: '+selector);
    return el;
  }
  async move(x,y,signal){
    const from=this.position||{x:innerWidth-44,y:28};this.position={x:from.x,y:from.y};
    await this.animate(Math.min(1400,Math.max(650,Math.hypot(x-from.x,y-from.y))),p=>{
      this.position={x:from.x+(x-from.x)*p,y:from.y+(y-from.y)*p};
      this.cursor.style.transform=`translate3d(${this.position.x}px,${this.position.y}px,0)`;
    },signal);
  }
  async reveal(el,signal){
    for(let sc=el.parentElement;sc&&sc!==document.body;sc=sc.parentElement){
      if(!/(auto|scroll)/.test(getComputedStyle(sc).overflow+getComputedStyle(sc).overflowX+getComputedStyle(sc).overflowY))continue;
      const r=el.getBoundingClientRect(),s=sc.getBoundingClientRect();
      const bottomInset=sc.matches('.codex-scroll')?56:12;
      const x=r.left<s.left+12?r.left-s.left-12:r.right>s.right-12?r.right-s.right+12:0;
      const y=r.top<s.top+12?r.top-s.top-12:r.bottom>s.bottom-bottomInset?r.bottom-s.bottom+bottomInset:0;
      if(!x&&!y)continue;
      const left=sc.scrollLeft,top=sc.scrollTop;
      await this.animate(900,p=>{sc.scrollLeft=left+x*p;sc.scrollTop=top+y*p},signal);
    }
  }
  async click(selector,signal,hold=2400){
    let el=this.target(selector);await this.reveal(el,signal);
    const r=el.getBoundingClientRect(),x=Math.max(8,Math.min(innerWidth-8,r.left+r.width/2)),y=Math.max(8,Math.min(innerHeight-8,r.top+r.height/2));
    el.classList.add('auto-tour-hover');
    await this.move(x,y,signal);await this.wait(350,signal);this.check(signal);
    this.cursor.classList.add('clicking');await this.wait(120,signal);
    el=this.target(selector);
    if(el.disabled||!el.contains(document.elementFromPoint(x,y)))throw Error('Control is covered: '+selector);
    el.click();el.classList.remove('auto-tour-hover');
    await this.wait(300,signal);this.cursor.classList.remove('clicking');await this.wait(hold,signal);
  }
  async scroll(selector,fraction,signal,hold=3500){
    const el=this.target(selector),r=el.getBoundingClientRect();
    await this.move(Math.min(innerWidth-20,r.right-24),Math.max(60,Math.min(innerHeight-40,r.top+r.height*.55)),signal);
    const from=el.scrollTop,to=Math.max(0,el.scrollHeight-el.clientHeight)*fraction;
    await this.animate(2400,p=>{el.scrollTop=from+(to-from)*p},signal);await this.wait(hold,signal);
  }
  async type(selector,text,signal){
    await this.click(selector,signal,100);const el=this.target(selector);el.focus({preventScroll:true});el.value='';
    for(const character of text){this.check(signal);el.value+=character;el.dispatchEvent(new Event('input',{bubbles:true}));await this.wait(65,signal)}
    await this.wait(1100,signal);
  }
  async expand(selector,signal){
    const el=this.target(selector);
    if(el.tagName==='DETAILS'){if(!el.open)await this.click(()=>el.querySelector('summary'),signal)}
    else if(el.closest('[role="treeitem"]').getAttribute('aria-expanded')!=='true')await this.click(()=>el.querySelector('.variable-caret'),signal);
  }
  async scene(name,run,signal){
    this.check(signal);document.documentElement.dataset.autoTourStep=name;
    document.dispatchEvent(new CustomEvent('auto-tour-step',{detail:name}));await run();
  }
  async sessions(signal){if(!$('.sessions-panel').getClientRects().length)await this.click('.sessions-rail',signal)}
  async file(path,signal){
    const tab=()=>$$('[data-tab]').find(el=>el.dataset.tab==='file:main:'+path);
    if(tab())await this.click(tab,signal);
    else{await this.click('.main-search',signal);await this.type('#file-search',base(path),signal);await this.click(()=>$$('[data-search-path]').find(el=>el.dataset.searchPath===path),signal)}
  }
  async walk(signal){
    const scene=(name,run)=>this.scene(name,run,signal);
    // Reset only the presentation details needed for this demonstration.
    state.sessionQuery='';state.agentFilter='all';$('#session-search').value='';$('#agent-filter').value='all';renderSessionList();
    for(const t of state.tabs.filter(t=>t.type==='session')){t.scroll=0;t.activityOpen=false;t.toolGroups={};t.toolEntries={};t.toolOutputExpanded={};t.terminalTools={}}
    await scene('agent-sessions',async()=>{await this.sessions(signal)});
    await scene('claude-session',async()=>{await this.click('[data-session="claude-review"]',signal,4500);await this.expand('[data-terminal-tool="0"]',signal);await this.wait(2000,signal)});
    await scene('claude-review',async()=>{await this.scroll('.claude-scroll',.45,signal,5500);await this.scroll('.claude-scroll',1,signal,5500)});
    await scene('codex-session',async()=>{if(state.showDebugger)await this.click('.debug-rail',signal);await this.sessions(signal);await this.click(()=>$$('.session-item').find(el=>el.dataset.session===data.targetSession),signal,4500);await this.scroll('.codex-scroll',0,signal,2500);await this.expand('.air-work',signal)});
    await scene('codex-tools',async()=>{
      const source=()=>$$('.air-tool-entry').find(el=>el.querySelector('summary').title.includes("sed -n '1,150p'"));
      await this.expand(()=>source().closest('.air-tool-group'),signal);await this.expand(source,signal);await this.wait(4500,signal);
      await this.click(()=>source().querySelector('.air-tool-show-more'),signal,5000);
      const output=source().querySelector('.air-tool-output'),sc=$('.codex-scroll');
      await this.scroll('.codex-scroll',Math.min(1,(sc.scrollTop+output.getBoundingClientRect().top-sc.getBoundingClientRect().top+300)/Math.max(1,sc.scrollHeight-sc.clientHeight)),signal,5000);
      await this.click(()=>source().querySelector('summary'),signal,2500);
      const diff=()=>$$('.air-tool-entry').find(el=>el.querySelector('summary').title.startsWith('git diff --'));
      await this.expand(()=>diff().closest('.air-tool-group'),signal);await this.expand(diff,signal);await this.wait(5000,signal);
    });
    await scene('session-log',async()=>{
      await this.click('[data-action="session-info"]',signal);
      await this.click('[data-action="air-show-events"]',signal,3000);await this.type('#event-search','ToolCall',signal);
      await this.click('.event-row',signal,4000);await this.click(()=>$$('.event-row')[3],signal,4000);
      await this.scroll('.event-detail',.5,signal,4000);await this.click('[data-action="events-session"]',signal);
    });
    await scene('session-diff',async()=>{
      await this.scroll('.codex-scroll',1,signal);await this.click('.air-changes-card .change-row',signal,5500);
      await this.click('[data-action="jd-unified"]',signal,5000);
      await this.click('[data-action="jd-full-diff"]',signal,5000);
      await this.click('[data-action="jd-split"]',signal,5500);
    });
    await scene('notification-controller',async()=>{
      await this.file(data.debugger.file,signal);if(!state.showDebugger)await this.click('.debug-rail',signal);
      if(state.debugTab!=='debugger')await this.click('[data-action="debug-tab"][data-tab-name="debugger"]',signal);
      if(state.debugView!=='frames')await this.click('[data-action="debug-frame-view"][data-view="frames"]',signal);
      await this.click('.frame-row[data-index="0"]',signal,4000);
    });
    await scene('debugger-variables',async()=>{
      await this.expand('.debug-variables [data-key="variables-2"]',signal);
      await this.expand('.debug-variables [data-key="variables-2-5"]',signal);await this.wait(4000,signal);
    });
    await scene('inline-watch',async()=>{
      await this.click('.dispatcher-inline',signal,3500);await this.expand('.debug-inspector [data-key="inspector-0-5"]',signal);
      await this.wait(4000,signal);await this.click('.debug-inspector [data-action="close-overlay"]',signal);
    });
    await scene('saved-watches',async()=>{
      if(!state.debugSavedWatches){await this.click('[data-action="debug-options"]',signal);await this.click('[data-action="debug-saved-watches"]',signal)}
      await this.expand('.debug-variables [data-key="savedWatches-1"]',signal);await this.wait(4500,signal);
    });
    await scene('application-console',async()=>{
      await this.click('[data-action="debug-tab"][data-tab-name="console"]',signal);await this.scroll('.debug-console-output',0,signal,4000);
      await this.scroll('.debug-console-output',1,signal,4500);await this.click('[data-action="debug-tab"][data-tab-name="debugger"]',signal);
    });
    await scene('spring-navigation',async()=>{
      const sc=$('.code-scroll'),left=sc.scrollLeft;await this.animate(550,p=>{sc.scrollLeft=left*(1-p)},signal);
      await this.click('.spring-gutter[data-line="23"]',signal,5000);
    });
    await scene('return-to-breakpoint',async()=>{await this.file(data.debugger.file,signal);await this.click('.frame-row[data-index="0"]',signal,4500)});
    document.documentElement.dataset.autoTourStep='complete';document.dispatchEvent(new CustomEvent('auto-tour-step',{detail:'complete'}));
  }
}
function automaticTourMenu(){return `<button class="automatic-tour-option" role="menuitemcheckbox" aria-checked="${!!autoTour?.enabled}" data-action="toggle-auto-tour"><span>Automatic tour</span><span class="grow"></span>${autoTour?.enabled?icon('check'):''}</button>${autoTour?.enabled?`<button class="automatic-tour-option automatic-tour-loop" role="menuitemcheckbox" aria-checked="${autoTour.loop}" data-action="toggle-auto-tour-loop"><span>Loop playback</span><span class="grow"></span>${autoTour.loop?icon('check'):''}</button><p class="automatic-tour-hint">${autoTour.loop?'Repeats after a short pause.':'Plays once. Toggle off and on to replay.'} Interact to take over.</p>`:''}`}
function initAutomaticTour(){autoTour=new AutomaticTour()}
