import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const {SurvivorsEngine,upgrades}=vm.runInNewContext(readFileSync(new URL('../dist/survivors-engine.js',import.meta.url),'utf8')+';({SurvivorsEngine,upgrades:survivorUpgrades})');
const checks=[];function check(name,run){run();checks.push(name)}
function rng(){let seed=128;return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
function clean(){const e=new SurvivorsEngine(1000,700,rng());e.start();e.enemies=[];e.spawnIn=1e6;return e}
function advance(e,seconds,input={x:0,y:0}){for(let i=0;i<Math.round(seconds*60);i++)e.step(1/60,input)}
function levelUp(){const e=clean();e.coins=Array.from({length:8},(_,id)=>({id,x:e.player.x,y:e.player.y,value:1,age:0}));e.step(1/60);return e}
function apply(e,id){e.phase='upgrade';e.choices=[upgrades.find(u=>u.id===id)];assert.equal(e.chooseUpgrade(id),true)}
check('A run starts only on request',()=>{const e=new SurvivorsEngine(1000,700);e.step(.05,{x:1,y:0});assert.equal(e.elapsed,0);e.start();assert.equal(e.phase,'running');assert.equal(e.enemies.length,4)});
check('Diagonal movement has the same speed as straight movement',()=>{const a=clean(),b=clean(),p={...a.player};advance(a,.2,{x:1,y:0});advance(b,.2,{x:1,y:1});assert.ok(Math.abs(Math.hypot(a.player.x-p.x,a.player.y-p.y)-Math.hypot(b.player.x-p.x,b.player.y-p.y))<1e-8)});
check('Runzo stays inside the arena',()=>{const e=clean();advance(e,10,{x:-1,y:-1});assert.ok(e.player.x>=22&&e.player.y>=100);advance(e,10,{x:1,y:1});assert.ok(e.player.x<=978&&e.player.y<=666)});
check('Auto-fire hits the nearest target and drops a coin',()=>{const e=clean();const near=e.spawn('bug',e.player.x+95,e.player.y),far=e.spawn('bug',e.player.x+260,e.player.y);advance(e,.25);assert.equal(near.hp<=0,true);assert.equal(far.hp,1);assert.equal(e.kills,1);assert.equal(e.coins.length,1)});
check('Coin collection requires approaching the pickup and grants XP',()=>{const e=clean();e.coins=[{id:1,x:e.player.x+200,y:e.player.y,value:3,age:0}];advance(e,.2);assert.equal(e.xp,0);advance(e,.7,{x:1,y:0});assert.equal(e.collected,3);assert.equal(e.xp,3);assert.equal(e.coins.length,0)});
check('Filling XP pauses gameplay for three distinct upgrades',()=>{const e=levelUp(),at=e.elapsed,x=e.player.x;assert.equal(e.phase,'upgrade');assert.equal(e.level,2);assert.equal(new Set(e.choices.map(u=>u.id)).size,3);advance(e,2,{x:1,y:0});assert.equal(e.elapsed,at);assert.equal(e.player.x,x);assert.equal(e.chooseUpgrade('not-a-choice'),false);const id=e.choices[0].id;assert.equal(e.chooseUpgrade(id),true);assert.equal(e.ranks[id],1);assert.equal(e.phase,'running')});
check('Experience overflow is retained across consecutive level-ups',()=>{const e=clean();e.coins=[{id:1,x:e.player.x,y:e.player.y,value:40,age:0}];e.step(.01);let n=0;while(e.phase==='upgrade'&&n++<10)e.chooseUpgrade(e.choices[0].id);assert.equal(e.level,4);assert.equal(e.xp,7);assert.equal(n,3)});
check('Pause freezes combat, movement and survival time',()=>{const e=clean();e.spawn('freeze',e.player.x,e.player.y);e.pause();const hp=e.player.hp;advance(e,3,{x:1,y:1});assert.equal(e.elapsed,0);assert.equal(e.player.hp,hp);e.resume();assert.equal(e.phase,'running')});
check('Pausing an upgrade returns to the same choices',()=>{const e=levelUp(),choices=e.choices.map(u=>u.id).join(',');e.pause();e.resume();assert.equal(e.phase,'upgrade');assert.equal(e.choices.map(u=>u.id).join(','),choices)});
check('Contact damage has an invulnerability period',()=>{const e=clean();for(let i=0;i<20;i++)e.spawn('bug',e.player.x,e.player.y);e.shotIn=1e6;e.step(.01);const hp=e.player.hp;advance(e,.3);assert.equal(e.player.hp,hp);assert.equal(hp,88)});
check('A lethal hit ends the run and freezes its time',()=>{const e=clean();e.player.hp=1;e.spawn('bug',e.player.x,e.player.y);e.step(.01);assert.equal(e.phase,'over');const at=e.elapsed;advance(e,3);assert.equal(e.elapsed,at);assert.equal(e.player.hp,0)});
check('Upgrades change attack rate, damage, movement and pickup range',()=>{const e=clean(),before={...e.player};for(const id of ['rapid','damage','speed','magnet'])apply(e,id);assert.ok(e.player.fireInterval<before.fireInterval&&e.player.damage>before.damage&&e.player.speed>before.speed&&e.player.pickup>before.pickup)});
check('Multicaret fires additional projectiles',()=>{const e=clean();apply(e,'multi');e.spawn('freeze',e.player.x+150,e.player.y);e.shoot();assert.equal(e.bullets.length,2)});
check('Hot Reload increases maximum health and heals',()=>{const e=clean();e.player.hp=3;apply(e,'health');assert.equal(e.player.maxHp,125);assert.equal(e.player.hp,125)});
check('Freeze Frame slows a target after a projectile hit',()=>{const e=clean();apply(e,'freeze');const enemy=e.spawn('freeze',e.player.x+80,e.player.y);advance(e,.2);assert.ok(enemy.hp<enemy.maxHp&&enemy.slow>0)});
check('Breakpoint orbitals damage nearby enemies',()=>{const e=clean();e.shotIn=1e6;apply(e,'orbit');const enemy=e.spawn('freeze',e.player.x+53,e.player.y);e.step(.01);assert.ok(enemy.hp<enemy.maxHp)});
check('Resize preserves positions and legal player bounds',()=>{const e=clean();e.resize(500,350);assert.ok(Number.isFinite(e.player.x)&&e.player.x<=478&&e.player.y<=316)});
check('Later waves introduce glitches and freezes',()=>{const e=clean();e.spawnIn=.1;e.shotIn=1e6;e.player.hp=1e6;advance(e,45);const types=new Set(e.enemies.map(enemy=>enemy.type));assert.ok(types.has('bug')&&types.has('glitch')&&types.has('freeze'));assert.ok(e.enemies.some(enemy=>enemy.maxHp>4))});
check('Enemy, particle and pickup counts are bounded',()=>{const e=clean();for(let i=0;i<200;i++)e.spawn('bug',-100,-100);assert.equal(e.enemies.length,120);e.burst(0,0,'white',1000);assert.equal(e.particles.length,200);e.coins=Array.from({length:500},(_,id)=>({id,x:-100,y:-100,value:1,age:0}));e.step(.01);assert.equal(e.coins.length,350)});
console.log(JSON.stringify({result:'PASS',checks},null,2));
