'use strict';
/*
Runzo, Bug, coin and upgrade artwork adapted from https://github.com/glycin/intellij25
MIT License

Copyright (c) 2025 glycin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
let survivorsGame=null,survivorImagesPromise=null;
const survivorArt=name=>assetURL('icons/survivors/'+name);
function survivorTime(seconds){return Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0')}
function loadSurvivorImages(){
  if(!survivorImagesPromise)survivorImagesPromise=Promise.all(['runzo-idle','runzo-move','runzo-hurt','bug','coin'].map(async name=>{const img=new Image();img.src=survivorArt(name+'.png');await img.decode();return [name,img]})).then(Object.fromEntries).catch(e=>{survivorImagesPromise=null;throw e});
  return survivorImagesPromise;
}
function openSurvivors(){if(survivorsGame){survivorsGame.close();return}closeOverlay();survivorsGame=new SurvivorsGame();survivorsGame.open()}
class SurvivorsGame{
  constructor(){this.keys=new Set();this.scope=new AbortController();this.closed=false;this.ready=false;this.frame=0;this.lastHud=0;this.best=0;this.recordKey=storageKey+'-survivors-best';this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;try{const best=JSON.parse(localStorage.getItem(this.recordKey));if(Number.isFinite(best?.seconds))this.best=Math.max(0,best.seconds)}catch{}}
  listen(target,type,handler,options={}){target.addEventListener(type,handler,{...options,signal:this.scope.signal})}
  open(){
    this.trigger=$('[data-action="survivors-toggle"]');this.previousFocus=document.activeElement;this.ide=$('#app');this.wasInert=this.ide.inert;this.ide.inert=true;
    document.body.classList.add('survivors-open');this.trigger?.setAttribute('aria-pressed','true');autoTour?.stop('paused');
    this.root=document.createElement('section');this.root.className='survivors-overlay';this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');this.root.setAttribute('aria-label','IDE Survivors');this.root.tabIndex=-1;
    this.root.innerHTML=`<canvas class="survivors-canvas" role="img" aria-label="Runzo fighting bugs, glitches and freezes over the IDE"></canvas><header class="sv-hud"><div class="sv-hud-title"><img src="${survivorArt('runzo.svg')}" alt=""><span>IDE Survivors</span></div><div class="sv-health"><span class="sv-stat-label">Health <b class="sv-hp-text">100 / 100</b></span><div class="sv-meter" role="meter" aria-label="Runzo health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><i class="sv-hp-fill"></i></div></div><div class="sv-timer"><span class="sv-stat-label">Survived</span><strong class="sv-time" role="timer">0:00</strong></div><div class="sv-kills"><span class="sv-stat-label">Defeated</span><strong class="sv-kill-count">0</strong></div><div class="sv-experience"><span class="sv-stat-label"><b class="sv-level">Level 1</b><span class="sv-xp-text">0 / 8 XP</span></span><div class="sv-meter" role="progressbar" aria-label="Experience" aria-valuemin="0" aria-valuemax="8" aria-valuenow="0"><i class="sv-xp-fill"></i></div></div><button class="icon-button sv-pause" data-game-action="pause" aria-label="Pause game" title="Pause (Esc)">${icon('pause')}</button><button class="icon-button" data-game-action="exit" aria-label="Exit IDE Survivors" title="Back to IDE">${icon('close')}</button></header><div class="survivors-screen"></div><div class="sv-loadout" aria-label="Active upgrades"></div><footer class="sv-controls"><span class="sv-keycaps"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>Move</span><i></i><span>Auto-fire</span><i></i><kbd>Esc</kbd><span>Pause</span></footer><div class="sv-touch-controls" aria-label="Movement controls">${[['up','↑'],['left','←'],['down','↓'],['right','→']].map(([dir,label])=>`<button data-game-move="${dir}" aria-label="Move ${dir}">${label}</button>`).join('')}</div><div class="sv-announcement" role="status" aria-live="polite"></div>`;
    document.body.append(this.root);this.canvas=$('.survivors-canvas',this.root);this.ctx=this.canvas.getContext('2d');this.menu=$('.survivors-screen',this.root);this.resize();this.newEngine();
    this.listen(this.root,'click',e=>{const button=e.target.closest('[data-game-action],[data-upgrade]');e.stopPropagation();if(!button)return;e.preventDefault();if(button.dataset.upgrade){if(this.engine.chooseUpgrade(button.dataset.upgrade))this.syncPhase();return}const action=button.dataset.gameAction;if(action==='exit')this.close();if(action==='start'||action==='restart')this.start();if(action==='pause')this.pause();if(action==='resume')this.resume()});
    this.listen(document,'keydown',e=>this.onKey(e,true),{capture:true});this.listen(document,'keyup',e=>this.onKey(e,false),{capture:true});
    this.listen(window,'blur',()=>this.pause('Paused while you were away.'));this.listen(document,'visibilitychange',()=>{if(document.hidden)this.pause('Paused while you were away.')});
    this.listen(window,'resize',()=>{this.resize();this.draw();if(this.engine.phase==='running')this.pause('The arena changed size. Ready when you are.')});
    for(const button of $$('[data-game-move]',this.root)){
      this.listen(button,'pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);this.keys.add(button.dataset.gameMove)});
      for(const type of ['pointerup','pointercancel','lostpointercapture'])this.listen(button,type,()=>this.keys.delete(button.dataset.gameMove));
    }
    this.syncPhase();
    loadSurvivorImages().then(images=>{if(this.closed)return;this.images=images;this.ready=true;this.syncPhase()}).catch(()=>{if(this.closed)return;this.loadError=true;this.syncPhase()});
  }
  newEngine(){this.engine=new SurvivorsEngine(this.width,this.height);this.renderedPhase=null}
  resize(){
    this.width=Math.max(280,innerWidth);this.height=Math.max(260,innerHeight);this.dpr=Math.min(2,devicePixelRatio||1);this.canvas.width=Math.round(this.width*this.dpr);this.canvas.height=Math.round(this.height*this.dpr);this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);this.ctx.imageSmoothingEnabled=false;
    this.engine?.resize(this.width,this.height);
  }
  start(){if(!this.ready||this.closed)return;this.saveRecord();this.stopLoop();this.newEngine();this.engine.start();this.syncPhase()}
  pause(message=''){if(this.closed||!['running','upgrade'].includes(this.engine.phase))return;this.pauseMessage=message;this.engine.pause();this.syncPhase()}
  resume(){this.engine.resume();this.syncPhase()}
  onKey(e,down){
    if(this.closed)return;e.stopImmediatePropagation();const code=e.code||e.key,move={KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'}[code];
    if(move){e.preventDefault();if(down&&this.engine.phase==='running')this.keys.add(move);else this.keys.delete(move);return}
    if(!down)return;
    if(e.key==='Escape'){e.preventDefault();if(e.repeat)return;if(['ready','over'].includes(this.engine.phase))this.close();else if(this.engine.phase==='paused')this.resume();else this.pause();return}
    if(this.engine.phase==='upgrade'&&/^[123]$/.test(e.key)){e.preventDefault();const choice=this.engine.choices[+e.key-1];if(choice&&this.engine.chooseUpgrade(choice.id))this.syncPhase();return}
    if(e.key==='Tab'){
      const controls=$$('button:not(:disabled),a[href]',this.root).filter(b=>b.getClientRects().length),i=controls.indexOf(document.activeElement);e.preventDefault();controls[(i+(e.shiftKey?-1:1)+controls.length)%controls.length]?.focus();
    }
    if((e.metaKey||e.ctrlKey)&&['p','f','w','1','2','5','7'].includes(e.key.toLowerCase()))e.preventDefault();
  }
  stopLoop(){if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;this.previousFrame=null;this.keys.clear()}
  loop(){
    if(this.frame||this.engine.phase!=='running'||this.closed)return;
    const tick=now=>{this.frame=0;if(this.closed||this.engine.phase!=='running')return;const dt=this.previousFrame===null?0:Math.min(.05,(now-this.previousFrame)/1000);this.previousFrame=now;
      this.engine.step(dt,{x:Number(this.keys.has('right'))-Number(this.keys.has('left')),y:Number(this.keys.has('down'))-Number(this.keys.has('up'))});
      this.draw();if(now-this.lastHud>90){this.updateHud();this.lastHud=now}
      if(this.engine.phase!=='running'){this.syncPhase();return}this.frame=requestAnimationFrame(tick);
    };this.previousFrame=null;this.frame=requestAnimationFrame(tick);
  }
  syncPhase(){
    if(this.closed)return;const phase=this.engine.phase;this.root.dataset.phase=phase;this.keys.clear();this.stopLoop();this.draw();this.updateHud();this.updateLoadout();
    const exit='<button class="sv-secondary" data-game-action="exit">Back to IDE</button>';
    if(phase==='ready')this.menu.innerHTML=`<section class="sv-card sv-intro"><span class="sv-eyebrow">A LITTLE DISTRACTION</span><img class="sv-hero" src="${survivorArt('runzo-idle.png')}" alt="Runzo"><h1>IDE Survivors</h1><p class="sv-lead">One more run. Then back to work.</p><div class="sv-how-to"><p><span class="sv-keycaps"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span> Move Runzo. Attacks fire automatically.</p><p>Squash bugs. Collect coins. Choose your upgrades.</p><p><kbd>Esc</kbd> pauses the action.</p></div><div class="sv-enemy-legend"><span><img src="${survivorArt('bug.png')}" alt="">Bugs</span><span><b class="sv-glitch-symbol">{ }</b>Glitches</span><span><b class="sv-freeze-symbol">❄</b>Freezes</span></div>${this.best?`<p class="sv-best">Personal best <strong>${survivorTime(this.best)}</strong></p>`:''}${this.loadError?'<p class="sv-error">The artwork could not load. Close and reopen to try again.</p>':''}<div class="sv-buttons"><button class="sv-primary" data-game-action="start" ${this.ready?'':'disabled'}>${this.ready?'Start run':this.loadError?'Artwork unavailable':'Loading…'}</button>${exit}</div><small class="sv-credit">Runzo & artwork from IDE Survivors · MIT</small></section>`;
    else if(phase==='paused')this.menu.innerHTML=`<section class="sv-card sv-pause-card"><span class="sv-eyebrow">TAKE A BREATHER</span><h2>Paused</h2><p>${esc(this.pauseMessage||'Even Runzo needs a breakpoint.')}</p><div class="sv-summary"><span><b>${survivorTime(this.engine.elapsed)}</b>survived</span><span><b>${this.engine.kills}</b>defeated</span><span><b>${this.engine.level}</b>level</span></div><div class="sv-buttons"><button class="sv-primary" data-game-action="resume">Resume</button><button class="sv-secondary" data-game-action="restart">Restart run</button>${exit}</div><small>Press Esc to continue.</small></section>`;
    else if(phase==='upgrade')this.menu.innerHTML=`<section class="sv-card sv-upgrade-card"><span class="sv-eyebrow">LEVEL ${this.engine.level}</span><h2>Choose an upgrade</h2><p>Pick one. The bugs can wait.</p><div class="sv-upgrade-grid">${this.engine.choices.map((u,i)=>`<button class="sv-upgrade" data-upgrade="${u.id}" aria-label="${esc(u.name+'. '+u.description)}"><span class="sv-upgrade-number">${i+1}</span><img src="${survivorArt(u.icon+'.png')}" alt=""><strong>${u.name}</strong><span>${u.description}</span><small>${this.engine.ranks[u.id]?'Rank '+(this.engine.ranks[u.id]+1):'New upgrade'}</small></button>`).join('')}</div><small>Choose with the mouse or press 1, 2, or 3.</small></section>`;
    else if(phase==='over'){this.saveRecord();this.menu.innerHTML=`<section class="sv-card sv-game-over"><img class="sv-hero" src="${survivorArt('runzo-hurt.png')}" alt="Runzo"><span class="sv-eyebrow">BUILD FAILED. RUN AGAIN?</span><h2>Good run.</h2><div class="sv-summary"><span><b>${survivorTime(this.engine.elapsed)}</b>survived</span><span><b>${this.engine.kills}</b>defeated</span><span><b>${this.engine.level}</b>level</span></div><p class="sv-best">Personal best <strong>${survivorTime(this.best)}</strong></p><div class="sv-buttons"><button class="sv-primary" data-game-action="restart">Try again</button>${exit}</div></section>`}
    else this.menu.innerHTML='';
    this.menu.hidden=phase==='running';$('.sv-announcement',this.root).textContent=phase==='upgrade'?'Level '+this.engine.level+'. Choose an upgrade.':phase==='over'?'Run ended. Survived '+survivorTime(this.engine.elapsed):phase==='paused'?'Game paused.':'';
    $('.sv-pause',this.root).disabled=!['running','upgrade'].includes(phase);
    if(phase==='running'){this.root.focus({preventScroll:true});this.loop()}else ($('button:not(:disabled)',this.menu)||this.root).focus({preventScroll:true});
    this.renderedPhase=phase;
  }
  updateHud(){
    const e=this.engine,p=e.player;$('.sv-hp-text',this.root).textContent=Math.ceil(p.hp)+' / '+p.maxHp;$('.sv-hp-fill',this.root).style.transform=`scaleX(${p.hp/p.maxHp})`;
    const hp=$('[role="meter"]',this.root);hp.setAttribute('aria-valuenow',String(Math.ceil(p.hp)));hp.setAttribute('aria-valuemax',String(p.maxHp));
    $('.sv-time',this.root).textContent=survivorTime(e.elapsed);$('.sv-kill-count',this.root).textContent=String(e.kills);$('.sv-level',this.root).textContent='Level '+e.level;$('.sv-xp-text',this.root).textContent=Math.min(e.xp,e.needed)+' / '+e.needed+' XP';$('.sv-xp-fill',this.root).style.transform=`scaleX(${Math.min(1,e.xp/e.needed)})`;
    const xp=$('[role="progressbar"]',this.root);xp.setAttribute('aria-valuenow',String(Math.min(e.xp,e.needed)));xp.setAttribute('aria-valuemax',String(e.needed));
  }
  updateLoadout(){const upgrades=survivorUpgrades.filter(u=>this.engine.ranks[u.id]);$('.sv-loadout',this.root).innerHTML=upgrades.map(u=>`<span class="sv-loadout-item" title="${esc(u.name)} · Rank ${this.engine.ranks[u.id]}" aria-label="${esc(u.name)} rank ${this.engine.ranks[u.id]}"><img src="${survivorArt(u.icon+'.png')}" alt=""><b>${this.engine.ranks[u.id]}</b></span>`).join('')}
  saveRecord(){if(this.engine?.elapsed>this.best){this.best=this.engine.elapsed;try{localStorage.setItem(this.recordKey,JSON.stringify({seconds:this.best,kills:this.engine.kills,level:this.engine.level}))}catch{}}}
  draw(){
    const g=this.ctx,e=this.engine;if(!g||!e)return;g.clearRect(0,0,this.width,this.height);if(!this.images||e.phase==='ready')return;const p=e.player,t=e.elapsed;
    for(const coin of e.coins){const size=coin.value>1?18:14;g.save();g.shadowBlur=this.reduced?0:9;g.shadowColor='#f3ca69';g.drawImage(this.images.coin,coin.x-size/2,coin.y-size/2+(this.reduced?0:Math.sin(t*4+coin.id)*1.5),size,size);g.restore()}
    for(const enemy of e.enemies){
      g.save();g.translate(enemy.x,enemy.y);if(enemy.flash>0)g.globalAlpha=.72;
      if(enemy.type==='bug'){g.rotate(Math.atan2(p.y-enemy.y,p.x-enemy.x)+Math.PI/2);g.drawImage(this.images.bug,-21,-21,42,42)}
      if(enemy.type==='glitch'){
        const j=this.reduced?0:Math.round(Math.sin(t*11+enemy.seed)*2);g.shadowColor='#b18bff';g.shadowBlur=this.reduced?0:8;g.fillStyle='#7754b3';g.fillRect(-13+j,-13,26,26);g.fillStyle='#c49aff';g.fillRect(-16,-9,4,8);g.fillRect(12,2,5,8);g.fillStyle='#1b132c';g.fillRect(-9,-7,18,16);g.fillStyle='#e3d2ff';g.fillRect(-6,-3,4,4);g.fillRect(3,-3,4,4);g.fillRect(-4,7,9,2);
      }
      if(enemy.type==='freeze'){
        g.fillStyle='#234d69';g.strokeStyle='#7dc9f4';g.lineWidth=2;g.beginPath();g.moveTo(0,-20);g.lineTo(17,-10);g.lineTo(17,10);g.lineTo(0,20);g.lineTo(-17,10);g.lineTo(-17,-10);g.closePath();g.fill();g.stroke();g.strokeStyle='#b8e4ff';for(let i=0;i<3;i++){g.save();g.rotate(i*Math.PI/3);g.beginPath();g.moveTo(0,-12);g.lineTo(0,12);g.moveTo(-4,-7);g.lineTo(0,-3);g.lineTo(4,-7);g.moveTo(-4,7);g.lineTo(0,3);g.lineTo(4,7);g.stroke();g.restore()}
      }
      g.restore();if(enemy.hp<enemy.maxHp){g.fillStyle='#222630';g.fillRect(enemy.x-14,enemy.y-enemy.radius-9,28,3);g.fillStyle=enemy.slow?'#87c9ff':'#e6818d';g.fillRect(enemy.x-14,enemy.y-enemy.radius-9,28*Math.max(0,enemy.hp/enemy.maxHp),3)}
    }
    for(const bullet of e.bullets){g.strokeStyle=bullet.freeze?'#a1d9ff':'#cdf4bf';g.lineWidth=3;g.lineCap='round';g.beginPath();g.moveTo(bullet.x-bullet.vx*.015,bullet.y-bullet.vy*.015);g.lineTo(bullet.x,bullet.y);g.stroke();g.fillStyle='#fff9d6';g.fillRect(bullet.x-2,bullet.y-2,4,4)}
    for(const orb of e.orbitPositions()){g.save();g.shadowColor='#f1747d';g.shadowBlur=this.reduced?0:9;g.fillStyle='#e56e77';g.beginPath();g.arc(orb.x,orb.y,7,0,Math.PI*2);g.fill();g.strokeStyle='#fac7ca';g.lineWidth=1;g.stroke();g.restore()}
    if(!this.reduced)for(const fx of e.particles){g.globalAlpha=Math.min(1,fx.life/fx.max);g.fillStyle=fx.color;g.fillRect(fx.x-1.5,fx.y-1.5,3,3)}g.globalAlpha=1;
    g.save();g.fillStyle='#0007';g.beginPath();g.ellipse(p.x,p.y+23,21,6,0,0,Math.PI*2);g.fill();g.translate(p.x,p.y+(p.moving&&!this.reduced?Math.sin(t*15)*2:0));g.scale(p.facing,1);if(p.invulnerable>0)g.globalAlpha=.7;g.shadowColor=p.chilled?'#8bd6ff':'#13ca8c';g.shadowBlur=this.reduced?0:10;g.drawImage(this.images[p.invulnerable>.6?'runzo-hurt':p.moving?'runzo-move':'runzo-idle'],-25,-25,50,50);g.restore();
  }
  close(){
    if(this.closed)return;this.closed=true;this.saveRecord();this.stopLoop();this.scope.abort();this.root.remove();this.canvas.width=this.canvas.height=0;this.ide.inert=this.wasInert;document.body.classList.remove('survivors-open');this.trigger?.setAttribute('aria-pressed','false');survivorsGame=null;
    (this.trigger?.isConnected?this.trigger:this.previousFocus)?.focus?.({preventScroll:true});autoTour?.schedule(20000);
  }
}
