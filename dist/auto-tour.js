'use strict';
// The tour operates the same read-only controls as a visitor. A visitor click
// cancels the current animation before the application's click handler runs.
let autoTour=null;
const automaticTourSpeeds=[.5,1,1.5,2,3];
class AutomaticTour{
  constructor(){
    this.preferenceKey=storageKey+'-automatic-tour';this.motion=matchMedia('(prefers-reduced-motion: reduce)');
    let preference;try{preference=JSON.parse(localStorage.getItem(this.preferenceKey))}catch{}
    this.enabled=typeof preference==='boolean'?preference:!this.motion.matches;
    this.loop=false;try{this.loop=JSON.parse(localStorage.getItem(this.preferenceKey+'-loop'))===true}catch{}
    this.speed=1.5;try{const saved=JSON.parse(localStorage.getItem(this.preferenceKey+'-speed'));if(automaticTourSpeeds.includes(saved))this.speed=saved}catch{}
    this.playing=false;this.hasStarted=false;this.completed=false;this.pace=1;this.position=null;
    this.visible=false;this.takeoverUntil=0;this.loopUntil=0;this.checkpoint=null;
    this.cursor=document.createElement('div');this.cursor.id='auto-tour-cursor';this.cursor.setAttribute('aria-hidden','true');this.cursor.hidden=true;
    this.cursor.innerHTML='<span class="tour-cursor-core"></span><span class="tour-click-ring"></span><svg class="tour-cursor-pointer" viewBox="0 0 20 24"><path d="M2 2v17l4.6-4.4 3.8 7.4 3-1.6-3.8-7.2H16Z" fill="#16171a" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';document.body.append(this.cursor);
    this.annotation=document.createElement('div');this.annotation.id='auto-tour-annotation';this.annotation.setAttribute('role','status');this.annotation.setAttribute('aria-live','polite');this.annotation.setAttribute('aria-atomic','true');this.annotation.hidden=true;document.body.append(this.annotation);
    const activity=e=>{
      if(!e.isTrusted)return;
      this.takeoverUntil=performance.now()+10000;
      if(this.playing)this.stop('paused');
      this.schedule();
    };
    for(const type of ['pointerdown','click'])document.addEventListener(type,activity,{capture:true,passive:true});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop('paused');else this.schedule()});
    window.addEventListener('resize',()=>{this.stop('paused');this.schedule()});
    this.motion.addEventListener('change',()=>{this.stop('paused');this.schedule()});
    // The implicit viewport includes ancestor-frame clipping, so an embedded
    // tour also pauses while its landing-page section is offscreen.
    this.visibility=new IntersectionObserver(([entry])=>{
      this.visible=entry.isIntersecting&&entry.intersectionRatio>0;
      if(this.visible)this.schedule();else this.stop('paused');
    },{threshold:.001});
    this.visibility.observe(document.documentElement);this.schedule();
  }
  status(value){document.documentElement.dataset.autoTour=value}
  setEnabled(enabled){
    this.enabled=enabled;try{localStorage.setItem(this.preferenceKey,JSON.stringify(enabled))}catch{}
    if(enabled){this.reset();this.takeoverUntil=0}
    this.stop(enabled?'waiting':'off');if(enabled)this.schedule();
  }
  setLoop(loop){
    this.loop=loop;try{localStorage.setItem(this.preferenceKey+'-loop',JSON.stringify(loop))}catch{}
    this.reset();this.stop(this.enabled?'waiting':'off');
    if(this.enabled)this.schedule();
  }
  setSpeed(speed){
    if(!automaticTourSpeeds.includes(speed))return;
    this.speed=speed;try{localStorage.setItem(this.preferenceKey+'-speed',JSON.stringify(speed))}catch{}
    this.reset();this.stop(this.enabled?'waiting':'off');
    if(this.enabled)this.schedule();
  }
  reset(){this.hasStarted=false;this.completed=false;this.checkpoint=null;this.loopUntil=0}
  schedule(delay=0){
    clearTimeout(this.timer);
    if(!this.enabled){this.status('off');return}
    if(document.body.classList.contains('survivors-open')){this.status('paused');return}
    if(this.playing)return;
    if(this.completed&&!this.loop){this.status('complete');return}
    if(!this.visible||document.hidden){this.status('paused');return}
    this.status(this.hasStarted&&!this.completed?'paused':'waiting');
    this.timer=setTimeout(()=>this.start(),Math.max(delay,this.takeoverUntil-performance.now(),this.loopUntil-performance.now()));
  }
  stop(status='paused'){
    clearTimeout(this.timer);this.controller?.abort();this.controller=null;this.playing=false;
    this.cursor.hidden=true;this.cursor.classList.remove('clicking');this.position=null;
    this.hideAnnotation();
    if(status==='complete')renderSessionList();
    document.querySelectorAll('.auto-tour-hover').forEach(el=>el.classList.remove('auto-tour-hover'));
    this.status(this.enabled?(this.completed?'complete':status):'off');
  }
  async start(){
    if(document.body.classList.contains('survivors-open')||this.playing||this.completed&&!this.loop||!this.enabled||!this.visible||document.hidden)return;
    if(performance.now()<Math.max(this.takeoverUntil,this.loopUntil)){this.schedule();return}
    clearTimeout(this.timer);this.controller=new AbortController();const signal=this.controller.signal;
    if(this.completed)this.checkpoint=null;
    this.hasStarted=true;this.completed=false;this.playing=true;this.status('playing');this.cursor.hidden=false;
    try{
      // Rebuild the interrupted scene after manual browsing, so closed tabs,
      // dialogs or changed tool windows cannot leave the next target missing.
      closeOverlay();document.activeElement?.blur();getSelection()?.removeAllRanges();
      if(this.checkpoint){state=structuredClone(this.checkpoint.state);document.documentElement.style.setProperty('--sidebar',state.width+'px');renderSidebar();renderTabs();renderContent();renderShellVisibility()}
      await this.walk(signal);
      if(!signal.aborted){this.completed=true;this.checkpoint=null;this.loopUntil=performance.now()+10000;this.stop('complete');if(this.loop)this.schedule()}
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
      const timer=setTimeout(done,ms*this.pace/this.speed),cancel=()=>{clearTimeout(timer);signal.removeEventListener('abort',cancel);reject(signal.reason)};
      signal.addEventListener('abort',cancel,{once:true});
    });
  }
  animate(duration,update,signal){
    this.check(signal);duration*=this.motion.matches?0:this.pace/this.speed;
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
      // Long inline values can be wider than the editor. Show their beginning
      // rather than scrolling to a distant end or an off-screen midpoint.
      const x=r.width>sc.clientWidth-24?r.left-s.left-12:r.left<s.left+12?r.left-s.left-12:r.right>s.right-12?r.right-s.right+12:0;
      const y=r.height>sc.clientHeight-bottomInset-12?r.top-s.top-12:r.top<s.top+12?r.top-s.top-12:r.bottom>s.bottom-bottomInset?r.bottom-s.bottom+bottomInset:0;
      if(!x&&!y)continue;
      const left=sc.scrollLeft,top=sc.scrollTop;
      await this.animate(900,p=>{sc.scrollLeft=left+x*p;sc.scrollTop=top+y*p},signal);
    }
  }
  visibleBounds(el){
    const r=el.getBoundingClientRect();let left=Math.max(8,r.left),right=Math.min(innerWidth-8,r.right),top=Math.max(8,r.top),bottom=Math.min(innerHeight-8,r.bottom);
    for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement){
      const style=getComputedStyle(p),clip=p.getBoundingClientRect();
      if(/auto|scroll|hidden|clip/.test(style.overflowX)){left=Math.max(left,clip.left);right=Math.min(right,clip.right)}
      if(/auto|scroll|hidden|clip/.test(style.overflowY)){top=Math.max(top,clip.top);bottom=Math.min(bottom,clip.bottom)}
    }
    if(right<=left||bottom<=top)throw Error('Control is outside the viewport');
    return {left,right,top,bottom,width:right-left,height:bottom-top};
  }
  hideAnnotation(){this.annotation.hidden=true;this.annotation.textContent=''}
  async annotate(text,selector,signal,placement='above'){
    const el=this.target(selector);await this.reveal(el,signal);this.check(signal);
    const r=this.visibleBounds(el),bubble=this.annotation,gap=16,margin=12,minTop=46;
    bubble.textContent=text;bubble.style.visibility='hidden';bubble.style.left='0px';bubble.style.top='0px';bubble.hidden=false;
    const w=bubble.offsetWidth,h=bubble.offsetHeight,maxLeft=innerWidth-w-margin,maxTop=innerHeight-h-35;
    const candidates={
      above:{x:(r.left+r.right-w)/2,y:r.top-h-gap},
      right:{x:r.right+gap,y:(r.top+r.bottom-h)/2},
      left:{x:r.left-w-gap,y:(r.top+r.bottom-h)/2},
      below:{x:(r.left+r.right-w)/2,y:r.bottom+gap},
      inset:{x:r.right-w-gap,y:r.top+gap},
    };
    // Prefer a nearby free space; a transcript-wide scroll target uses its
    // upper corner until scrolling begins. Callouts never intercept input.
    const order=placement==='inset'?['inset']:placement==='right'?['right','above','below','left']:['above','right','left','below'];
    const spot=order.map(side=>candidates[side]).find(p=>p.x>=margin&&p.x<=maxLeft&&p.y>=minTop&&p.y<=maxTop)||candidates.inset;
    bubble.style.left=Math.max(margin,Math.min(maxLeft,spot.x))+'px';bubble.style.top=Math.max(minTop,Math.min(maxTop,spot.y))+'px';bubble.style.visibility='';
    document.dispatchEvent(new CustomEvent('auto-tour-annotation',{detail:{text,step:document.documentElement.dataset.autoTourStep}}));
    await this.wait(3000,signal);
  }
  async click(selector,signal,hold=2400){
    let el=this.target(selector);await this.reveal(el,signal);
    const r=this.visibleBounds(el),x=(r.left+r.right)/2,y=(r.top+r.bottom)/2;
    el.classList.add('auto-tour-hover');
    await this.move(x,y,signal);await this.wait(350,signal);this.check(signal);
    this.cursor.classList.add('clicking');await this.wait(120,signal);
    el=this.target(selector);
    if(el.disabled||!el.contains(document.elementFromPoint(x,y)))throw Error('Control is covered: '+selector);
    this.hideAnnotation();el.click();el.classList.remove('auto-tour-hover');
    await this.wait(300,signal);this.cursor.classList.remove('clicking');await this.wait(hold,signal);
  }
  async scroll(selector,fraction,signal,hold=3500){
    const el=this.target(selector),r=el.getBoundingClientRect();
    await this.move(Math.min(innerWidth-20,r.right-24),Math.max(60,Math.min(innerHeight-40,r.top+r.height*.55)),signal);
    const from=el.scrollTop,to=Math.max(0,el.scrollHeight-el.clientHeight)*fraction;
    this.hideAnnotation();
    await this.animate(2400,p=>{el.scrollTop=from+(to-from)*p},signal);await this.wait(hold,signal);
  }
  async expand(selector,signal){
    const el=this.target(selector);
    if(el.tagName==='DETAILS'){if(!el.open)await this.click(()=>el.querySelector('summary'),signal)}
    else if(el.closest('[role="treeitem"]').getAttribute('aria-expanded')!=='true')await this.click(()=>el.querySelector('.variable-caret'),signal);
  }
  async scene(name,run,signal){
    this.check(signal);document.documentElement.dataset.autoTourStep=name;
    this.checkpoint={name,state:structuredClone(state)};
    document.dispatchEvent(new CustomEvent('auto-tour-step',{detail:name}));await run();
  }
  async sessions(signal){if(!$('.sessions-panel').getClientRects().length){await this.annotate('Browse your agent sessions','.sessions-rail',signal,'right');await this.click('.sessions-rail',signal)}}
  async walk(signal){
    const resume=this.checkpoint?.name;let reached=!resume;
    const scene=(name,run)=>{if(!reached&&name!==resume)return;reached=true;return this.scene(name,run,signal)};
    // Reset only the presentation details needed for this demonstration.
    if(!resume){
      if(state.showDatabase){state.showDatabase=false;renderDatabaseVisibility()}
      state.sessionQuery='';$('#session-search').value='';$('.sessions-actions').hidden=false;$('.sessions-search-tools').hidden=true;renderSessionList();
      for(const t of state.tabs.filter(t=>t.type==='session')){t.scroll=0;t.activityOpen=false;t.toolGroups={};t.toolEntries={};t.toolOutputExpanded={};t.terminalTools={}}
    }
    await scene('agent-sessions',async()=>{await this.sessions(signal)});
    await scene('claude-session',async()=>{await this.annotate('Read Claude’s code review','[data-session="claude-review"]',signal);await this.click('[data-session="claude-review"]',signal,4500)});
    await scene('claude-review',async()=>{await this.annotate('Explore the review findings','.claude-scroll',signal,'inset');await this.scroll('.claude-scroll',.45,signal,5500);await this.scroll('.claude-scroll',1,signal,5500)});
    await scene('codex-session',async()=>{if(state.showDebugger)await this.click('.debug-rail',signal);await this.sessions(signal);const target=()=>$$('.session-item').find(el=>el.dataset.session===data.targetSession);await this.annotate('See Codex secure the dashboard',target,signal);await this.click(target,signal,4500);await this.scroll('.codex-scroll',0,signal,2500);await this.expand('.air-work',signal)});
    await scene('codex-tools',async()=>{
      const source=()=>$('[data-tool-entry="exec-86124221-7782-4d3d-a353-6a29952fcd3e"]');
      await this.expand(()=>source().closest('.air-tool-group'),signal);await this.annotate('Inspect Codex’s tool output',()=>source().querySelector('summary'),signal);await this.expand(source,signal);
      await this.reveal(source().querySelector('.air-tool-output'),signal);await this.wait(4500,signal);
      await this.click(()=>source().querySelector('summary'),signal,2500);
    });
    await scene('session-diff',async()=>{
      await this.scroll('.codex-scroll',1,signal);const target='.air-changes-card .change-row[data-path$="/SecurityConfig.java"]';await this.annotate('Review the SecurityConfig changes',target,signal);await this.click(target,signal,5500);
    });
    await scene('notification-controller',async()=>{
      await this.annotate('Inspect the paused request','.debug-rail',signal,'right');
      if(!state.showDebugger)await this.click('.debug-rail',signal);
      if(state.debugTab!=='debugger')await this.click('[data-action="debug-tab"][data-tab-name="debugger"]',signal);
      if(state.debugView!=='frames')await this.click('[data-action="debug-frame-view"][data-view="frames"]',signal);
      await this.click('.frame-row[data-index="0"]',signal,4000);
    });
    await scene('inline-variables',async()=>{
      await this.annotate('Explore the dispatcher’s dependencies','.dispatcher-inline',signal);await this.click('.dispatcher-inline',signal,3500);await this.expand('.debug-inspector [data-key="inspector-0-5"]',signal);
      await this.wait(4000,signal);await this.click('.debug-inspector [data-action="close-overlay"]',signal);
      const notification='.execution-line .inline-value[data-key="variables-2"]';await this.annotate('Inspect the notification payload',notification,signal);await this.click(notification,signal,3500);await this.expand('.debug-inspector [data-key="inspector-0-5"]',signal);
      await this.wait(4000,signal);await this.click('.debug-inspector [data-action="close-overlay"]',signal);
    });
    await scene('spring-navigation',async()=>{
      const sc=$('.code-scroll'),left=sc.scrollLeft;await this.animate(550,p=>{sc.scrollLeft=left*(1-p)},signal);
      await this.annotate('Follow the injected Spring service','.spring-gutter[data-line="23"]',signal);
      await this.click('.spring-gutter[data-line="23"]',signal,5000);
    });
    await scene('configuration-property',async()=>{await this.annotate('Jump to the property’s configuration','.property-link[data-line="23"]',signal);await this.click('.property-link[data-line="23"]',signal,5000)});
    document.documentElement.dataset.autoTourStep='complete';document.dispatchEvent(new CustomEvent('auto-tour-step',{detail:'complete'}));
  }
}
function automaticTourMenu(){return `<button class="automatic-tour-option" role="menuitemcheckbox" aria-checked="${!!autoTour?.enabled}" data-action="toggle-auto-tour"><span>Automatic tour</span><span class="grow"></span>${autoTour?.enabled?icon('check'):''}</button>${autoTour?.enabled?`<button class="automatic-tour-option automatic-tour-loop" role="menuitemcheckbox" aria-checked="${autoTour.loop}" data-action="toggle-auto-tour-loop"><span>Loop playback</span><span class="grow"></span>${autoTour.loop?icon('check'):''}</button><label class="automatic-tour-speed" for="auto-tour-speed"><span>Playback speed</span><select id="auto-tour-speed" aria-label="Playback speed">${automaticTourSpeeds.map(speed=>`<option value="${speed}" ${speed===autoTour.speed?'selected':''}>${speed}×</option>`).join('')}</select></label><p class="automatic-tour-hint">${autoTour.loop?'Repeats after a short pause.':'Plays once. Toggle off and on to replay.'} Click to take over. Resumes after 10 seconds without a click.</p>`:''}`}
function initAutomaticTour(){autoTour=new AutomaticTour()}
