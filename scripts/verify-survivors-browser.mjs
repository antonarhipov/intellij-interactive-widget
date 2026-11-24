import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
const runId=new Date().toISOString().replaceAll(':','-'),evidence=new URL('../output/playwright/survivors/'+runId+'/',import.meta.url);mkdirSync(evidence,{recursive:true});
const wrapper='/Users/anton/.codex/skills/playwright/scripts/playwright_cli.sh';
const cli=(...args)=>spawnSync('bash',[wrapper,'--session','survivors-verification',...args],{encoding:'utf8',maxBuffer:3e6,env:{...process.env,npm_config_loglevel:'silent'}});
const opened=cli('open','about:blank');if(opened.status||opened.stdout.includes('### Error'))throw Error(opened.stdout+opened.stderr);
const code=String.raw`async page=>{
 const checks=[],errors=[],failures=[],check=(ok,name)=>{if(!ok)throw Error(name);checks.push(name)};
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failures.push(r.url())});
 const shot=async name=>{await page.locator('.survivors-overlay img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));await page.screenshot({path:${JSON.stringify(evidence.pathname)}+name+'.png'})};
 const phase=()=>page.locator('.survivors-overlay').getAttribute('data-phase');
 const state=()=>page.evaluate(()=>{const e=survivorsGame.engine,p=e.player;return {phase:e.phase,time:e.elapsed,x:p.x,y:p.y,hp:p.hp,kills:e.kills,xp:e.xp,level:e.level,choices:e.choices.map(u=>u.id),ranks:{...e.ranks},target:e.coins.length?e.coins.slice().sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0]:e.enemies.slice().sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0]}});
 try{
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1728,height:1117});await page.goto('http://127.0.0.1:4173/?workspace=survivors-${runId}');
  await page.getByRole('tab',{name:'Threads & Variables',exact:true}).waitFor();
  check(await page.locator('.survivors-overlay').count()===0&&await page.evaluate(()=>survivorsGame===null),'Game and animation remain absent until the tool button is used');
  await page.getByRole('button',{name:'IDE and Project Settings',exact:true}).click();await page.getByRole('menuitemcheckbox',{name:'Automatic tour',exact:true}).click();
  const original=await page.evaluate(()=>({tabs:JSON.stringify(state.tabs),active:state.active,debug:JSON.stringify(state.debugExpanded),scene:localStorage.getItem(storageKey)}));
  await page.getByRole('button',{name:'IDE Survivors',exact:true}).click();await page.getByRole('button',{name:'Start run',exact:true}).waitFor();
  check(await page.getByRole('dialog',{name:'IDE Survivors',exact:true}).isVisible(),'Right-side Runzo tool button opens the game');
  check(await page.evaluate(()=>survivorsGame.frame===0&&survivorsGame.engine.elapsed===0),'Introduction consumes no running game loop');
  check(await page.locator('#app').evaluate(e=>e.inert),'The underlying IDE is isolated while playing');await shot('intro');
  await page.getByRole('button',{name:'Start run',exact:true}).click();
  check(await phase()==='running','Start run launches the transparent game overlay');
  const before=await state();await page.keyboard.down('d');await page.waitForTimeout(300);await page.keyboard.up('d');const moved=await state();
  check(moved.x>before.x+30,'The D key moves Runzo across the IDE');
  await page.keyboard.press('Escape');const paused=await state();await page.waitForTimeout(350);const still=await state();
  check(await phase()==='paused'&&still.time===paused.time&&still.x===paused.x,'Escape freezes simulation, movement and the survival clock');await shot('paused');
  await page.keyboard.press('Escape');check(await phase()==='running','Escape resumes the run');
  const held=new Set(),deadline=Date.now()+24000;let current=await state(),steps=0;
  // Play through the actual keyboard interface. Read positions only to steer
  // toward dropped coins; no enemies, pickups, XP or clock values are injected.
  while(current.phase==='running'&&Date.now()<deadline){
   const target=current.target||{x:864,y:558},dx=target.x-current.x,dy=target.y-current.y,desired=new Set();
   if(dx>12)desired.add('d');if(dx< -12)desired.add('a');if(dy>12)desired.add('s');if(dy< -12)desired.add('w');
   for(const key of held)if(!desired.has(key)){await page.keyboard.up(key);held.delete(key)}
   for(const key of desired)if(!held.has(key)){await page.keyboard.down(key);held.add(key)}
   await page.waitForTimeout(160);current=await state();steps++;
   if(steps===12)await shot('combat');
  }
  for(const key of held)await page.keyboard.up(key);
  check(current.kills>0,'Automatic projectiles defeat enemies');
  check(current.level>=2&&current.phase==='upgrade','Collecting real dropped coins fills XP and opens the upgrade choice');
  check(await page.locator('.sv-upgrade').count()===3,'Level-up offers three distinct upgrade cards');await shot('upgrade');
  const frozen=await state();await page.waitForTimeout(250);check((await state()).time===frozen.time,'Choosing an upgrade pauses the world');
  const selected=frozen.choices[1];await page.keyboard.press('2');
  check((await state()).ranks[selected]===1&&await phase()==='running','Number keys apply the selected upgrade and resume play');
  check(await page.locator('.sv-loadout-item').count()===1,'The chosen upgrade appears in the loadout');
  check(await page.evaluate(()=>autoTour.enabled&&!autoTour.playing),'Automatic tour stays enabled but suspended during gameplay');
  await page.getByRole('button',{name:'Pause game',exact:true}).click();await page.getByRole('button',{name:'Back to IDE',exact:true}).click();
  check(await page.evaluate(()=>survivorsGame===null&&!document.querySelector('#app').inert)&&await page.locator('.survivors-canvas').count()===0,'Exiting removes the game and restores the IDE');
  check(await page.evaluate(original=>JSON.stringify(state.tabs)===original.tabs&&state.active===original.active&&JSON.stringify(state.debugExpanded)===original.debug&&localStorage.getItem(storageKey)===original.scene,original),'Game leaves editor tabs, debugger state and the saved IDE scene unchanged');
  check(await page.getByRole('button',{name:'IDE Survivors',exact:true}).evaluate(e=>e===document.activeElement),'Exit restores focus to the game tool button');
  await page.getByRole('button',{name:'Search Everywhere',exact:true}).click();check(await page.getByRole('combobox',{name:'Search all project files',exact:true}).isVisible(),'IDE keyboard and search controls remain usable after the game');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'IDE Survivors',exact:true}).click();await page.getByRole('button',{name:'Start run',exact:true}).waitFor();
  check(await page.getByText('Personal best',{exact:false}).isVisible(),'Personal best is retained for the next run');
  await page.getByRole('button',{name:'Start run',exact:true}).click();
  // Controlled fixture for the loss screen: the next real animation frame
  // applies a lethal contact hit. Earlier movement, combat and XP were unseeded.
  await page.evaluate(()=>{const e=survivorsGame.engine;e.enemies=[];e.player.hp=1;e.shotIn=100;e.spawn('bug',e.player.x,e.player.y)});
  await page.waitForFunction(()=>survivorsGame.engine.phase==='over');check(await page.getByRole('button',{name:'Try again',exact:true}).isVisible(),'Lethal enemy contact opens the end-of-run summary');await shot('game-over');
  await page.getByRole('button',{name:'Try again',exact:true}).click();check((await state()).hp===100&&(await state()).level===1,'Try again starts a fresh run');
  await page.keyboard.down('d');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('d');
  check(await phase()==='paused','Losing window focus pauses the game');await page.getByRole('button',{name:'Resume',exact:true}).click();
  const resume=await state();await page.waitForTimeout(170);check(Math.abs((await state()).x-resume.x)<1,'Resuming does not keep a stale movement key pressed');
  await page.setViewportSize({width:390,height:844});check(await phase()==='paused','Resizing safely pauses and resizes the arena');
  check(await page.locator('.sv-card').evaluate(e=>{const r=e.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight}),'Game menus fit a phone-sized viewport');await shot('narrow');
  await page.getByRole('button',{name:'Back to IDE',exact:true}).click();check(await page.evaluate(()=>survivorsGame===null),'Closing after resize releases the game');
  check(!errors.length&&!failures.length,'No runtime errors or missing artwork');
  return {result:'PASS',checks,errors,failures,keyboardPlay:{steps,kills:current.kills,level:current.level,seconds:current.time},fixture:'Only the game-over scene uses a one-hit contact fixture; combat and first upgrade were played with WASD.',browser:page.context().browser().version()};
 }catch(error){await page.screenshot({path:${JSON.stringify(evidence.pathname)}+'failure.png'});return {result:'FAIL',checks,error:error.message,errors,failures};}
}`;
const r=cli('run-code',code),output=r.stdout+'\n'+r.stderr;writeFileSync(new URL('verification.txt',evidence),output);console.log(output.split('### Ran Playwright code')[0]);console.log('Evidence: '+evidence.pathname);if(r.status||output.includes('### Error')||output.includes('"result":"FAIL"'))process.exitCode=1;
