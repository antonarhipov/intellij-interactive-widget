'use strict';
// Pure game simulation. Pixels, DOM, timing and IDE state live in survivors.js.
const survivorUpgrades=[
  {id:'rapid',name:'Turbo Run',icon:'performance',description:'Fire 20% faster.',limit:9},
  {id:'damage',name:'Quick Fix',icon:'refactorings',description:'Deal 28% more damage.'},
  {id:'multi',name:'Multicaret',icon:'command-completion',description:'Fire one extra projectile.',limit:4},
  {id:'magnet',name:'Garbage Collector',icon:'search',description:'Collect coins from farther away.',limit:6},
  {id:'health',name:'Hot Reload',icon:'coffee',description:'Gain 25 max health. Fully heal.'},
  {id:'speed',name:'Performance Mode',icon:'performance',description:'Move 12% faster.',limit:6},
  {id:'orbit',name:'Breakpoint',icon:'shield',description:'Add an orbiting bug zapper.',limit:4},
  {id:'freeze',name:'Freeze Frame',icon:'freeze',description:'Projectiles slow their targets.',limit:3},
];
const survivorEnemyTypes={bug:{radius:15,hp:1,speed:45,damage:12,xp:1},glitch:{radius:14,hp:2,speed:69,damage:10,xp:2},freeze:{radius:19,hp:4,speed:31,damage:20,xp:3}};
class SurvivorsEngine{
  constructor(width,height,random=Math.random){
    this.width=Math.max(280,width);this.height=Math.max(260,height);this.random=random;this.phase='ready';this.elapsed=0;this.kills=0;this.collected=0;this.level=1;this.xp=0;this.needed=8;this.ranks={};this.choices=[];
    this.enemies=[];this.bullets=[];this.coins=[];this.particles=[];this.nextId=1;this.spawnIn=.7;this.shotIn=.1;
    this.player={x:this.width/2,y:this.height/2,radius:14,hp:100,maxHp:100,speed:215,fireInterval:.55,damage:1,projectiles:1,pickup:78,orbits:0,freeze:0,invulnerable:0,chilled:0,facing:1,moving:false};
  }
  start(){if(this.phase!=='ready')return;this.phase='running';for(let i=0;i<4;i++){const angle=i*Math.PI/2+.4,r=Math.min(210,this.width*.31,this.height*.31);this.spawn(i===2?'glitch':'bug',this.player.x+Math.cos(angle)*r,this.player.y+Math.sin(angle)*r)}}
  resize(width,height){const sx=width/this.width,sy=height/this.height;this.width=Math.max(280,width);this.height=Math.max(260,height);for(const n of [this.player,...this.enemies,...this.bullets,...this.coins]){n.x*=sx;n.y*=sy}this.clampPlayer()}
  clampPlayer(){const p=this.player;p.x=Math.max(22,Math.min(this.width-22,p.x));p.y=Math.max(Math.min(100,this.height*.28),Math.min(this.height-34,p.y))}
  pause(){if(this.phase==='running'||this.phase==='upgrade'){this.beforePause=this.phase;this.phase='paused'}}
  resume(){if(this.phase==='paused'){this.phase=this.beforePause||'running';this.beforePause=null}}
  spawn(type,x,y){
    if(this.enemies.length>=120)return;
    if(x===undefined){const edge=Math.floor(this.random()*4),padding=24;x=edge===0?-padding:edge===1?this.width+padding:this.random()*this.width;y=edge===2?-padding:edge===3?this.height+padding:100+this.random()*Math.max(1,this.height-134)}
    const spec=survivorEnemyTypes[type],stage=Math.floor(this.elapsed/35),hp=spec.hp+(type==='freeze'?stage*2:type==='glitch'?stage:Math.floor(stage/2));
    const enemy={...spec,type,id:this.nextId++,x,y,hp,maxHp:hp,speed:spec.speed*(1+Math.min(1.4,this.elapsed/180)),slow:0,flash:0,orbHit:0,seed:this.random()*Math.PI*2};this.enemies.push(enemy);return enemy;
  }
  orbitPositions(){return Array.from({length:this.player.orbits},(_,i)=>{const a=this.elapsed*2.7+i*Math.PI*2/this.player.orbits;return {x:this.player.x+Math.cos(a)*53,y:this.player.y+Math.sin(a)*53}})}
  shoot(){
    const p=this.player,targets=this.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-p.x,e.y-p.y)<850).sort((a,b)=>(a.x-p.x)**2+(a.y-p.y)**2-((b.x-p.x)**2+(b.y-p.y)**2));
    if(!targets.length)return;
    for(let i=0;i<p.projectiles;i++){const target=targets[i%targets.length],spread=i>=targets.length?(i%2?1:-1)*.09*Math.ceil(i/targets.length):0,a=Math.atan2(target.y-p.y,target.x-p.x)+spread;this.bullets.push({id:this.nextId++,x:p.x,y:p.y,vx:Math.cos(a)*620,vy:Math.sin(a)*620,life:1.55,damage:p.damage,freeze:p.freeze})}
  }
  damageEnemy(enemy,damage){
    if(enemy.hp<=0)return;enemy.hp-=damage;enemy.flash=.12;
    if(enemy.hp<=0){this.kills++;this.coins.push({id:this.nextId++,x:enemy.x,y:enemy.y,value:enemy.xp,age:0});this.burst(enemy.x,enemy.y,enemy.type==='freeze'?'#86c7ff':enemy.type==='glitch'?'#bd93f9':'#62dba1',7)}
  }
  burst(x,y,color,count){for(let i=0;i<count&&this.particles.length<200;i++){const a=this.random()*Math.PI*2,s=25+this.random()*80;this.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.25+this.random()*.25,max:.5,color})}}
  checkLevel(){
    if(this.xp<this.needed||this.phase!=='running')return;this.xp-=this.needed;this.level++;this.needed=5+this.level*3;
    const pool=survivorUpgrades.filter(u=>!u.limit||(this.ranks[u.id]||0)<u.limit).slice();for(let i=pool.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
    this.choices=pool.slice(0,3);this.phase='upgrade';
  }
  chooseUpgrade(id){
    if(this.phase!=='upgrade'||!this.choices.some(u=>u.id===id))return false;
    const p=this.player;this.ranks[id]=(this.ranks[id]||0)+1;
    if(id==='rapid')p.fireInterval*=.8;if(id==='damage')p.damage*=1.28;if(id==='multi')p.projectiles++;if(id==='magnet')p.pickup+=36;
    if(id==='health'){p.maxHp+=25;p.hp=p.maxHp}if(id==='speed')p.speed*=1.12;if(id==='orbit')p.orbits++;if(id==='freeze')p.freeze++;
    this.choices=[];this.phase='running';this.checkLevel();return true;
  }
  step(dt,input={x:0,y:0}){
    if(this.phase!=='running'||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(.05,dt);this.elapsed+=dt;const p=this.player;
    p.invulnerable=Math.max(0,p.invulnerable-dt);p.chilled=Math.max(0,p.chilled-dt);const length=Math.hypot(input.x,input.y)||1,move=p.speed*(p.chilled ? .68 : 1);
    p.moving=!!(input.x||input.y);if(input.x)p.facing=input.x<0?-1:1;p.x+=input.x/Math.max(1,length)*move*dt;p.y+=input.y/Math.max(1,length)*move*dt;this.clampPlayer();
    this.spawnIn-=dt;if(this.spawnIn<=0){this.spawnIn=Math.max(.16,.95-this.elapsed*.004);const roll=this.random();this.spawn(this.elapsed>16&&roll>.78?'freeze':this.elapsed>7&&roll>.5?'glitch':'bug')}
    this.shotIn-=dt;if(this.shotIn<=0){this.shoot();this.shotIn=p.fireInterval}
    for(const enemy of this.enemies){
      if(enemy.hp<=0)continue;enemy.slow=Math.max(0,enemy.slow-dt);enemy.flash=Math.max(0,enemy.flash-dt);enemy.orbHit=Math.max(0,enemy.orbHit-dt);
      const dx=p.x-enemy.x,dy=p.y-enemy.y,d=Math.hypot(dx,dy)||1,wobble=enemy.type==='glitch'?Math.sin(this.elapsed*6+enemy.seed)*12:0,speed=enemy.speed*(enemy.slow ? .38 : 1);
      enemy.x+=(dx/d*speed-dy/d*wobble)*dt;enemy.y+=(dy/d*speed+dx/d*wobble)*dt;
      if(Math.hypot(enemy.x-p.x,enemy.y-p.y)<enemy.radius+p.radius-4&&p.invulnerable===0){p.hp=Math.max(0,p.hp-enemy.damage);p.invulnerable=.9;if(enemy.type==='freeze')p.chilled=1.1;this.burst(p.x,p.y,'#e77783',8);if(p.hp<=0){this.phase='over';p.moving=false;return}}
    }
    for(const bullet of this.bullets){
      const x=bullet.x,y=bullet.y;bullet.x+=bullet.vx*dt;bullet.y+=bullet.vy*dt;bullet.life-=dt;
      for(const enemy of this.enemies){if(enemy.hp<=0||bullet.life<=0)continue;const dx=bullet.x-x,dy=bullet.y-y,t=Math.max(0,Math.min(1,((enemy.x-x)*dx+(enemy.y-y)*dy)/(dx*dx+dy*dy||1)));
        if(Math.hypot(enemy.x-(x+t*dx),enemy.y-(y+t*dy))<enemy.radius+4){this.damageEnemy(enemy,bullet.damage);if(bullet.freeze)enemy.slow=1.2+bullet.freeze*.5;bullet.life=0;break}}
    }
    if(p.orbits)for(const orb of this.orbitPositions())for(const enemy of this.enemies)if(enemy.hp>0&&enemy.orbHit===0&&Math.hypot(enemy.x-orb.x,enemy.y-orb.y)<enemy.radius+8){this.damageEnemy(enemy,p.damage*1.25);enemy.orbHit=.4}
    for(const coin of this.coins){coin.age+=dt;const dx=p.x-coin.x,dy=p.y-coin.y,d=Math.hypot(dx,dy);if(d<p.pickup){const move=Math.min(d,Math.max(130,d*8)*dt);coin.x+=dx/(d||1)*move;coin.y+=dy/(d||1)*move}if(Math.hypot(p.x-coin.x,p.y-coin.y)<p.radius+7){coin.collected=true;this.xp+=coin.value;this.collected+=coin.value;this.burst(coin.x,coin.y,'#f3cf70',3)}}
    this.enemies=this.enemies.filter(e=>e.hp>0);this.bullets=this.bullets.filter(b=>b.life>0);this.coins=this.coins.filter(c=>!c.collected);
    // Bound old pickups during exceptionally long runs; nearest coins stay available.
    if(this.coins.length>350)this.coins.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y)).length=350;
    for(const fx of this.particles){fx.life-=dt;fx.x+=fx.vx*dt;fx.y+=fx.vy*dt}this.particles=this.particles.filter(fx=>fx.life>0);this.checkLevel();
  }
}
