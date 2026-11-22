import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=new URL('../',import.meta.url),runId=new Date().toISOString().replaceAll(':','-');
const evidence=new URL('output/playwright/auto-tour-v21/'+runId+'/',root);mkdirSync(evidence,{recursive:true});
const wrapper=resolve(homedir(),'.codex/skills/playwright/scripts/playwright_cli.sh');
const cli=(...args)=>spawnSync('bash',[wrapper,'--session','tour-v21',...args],{encoding:'utf8',maxBuffer:4e6,env:{...process.env,npm_config_loglevel:'silent'}});
const opened=cli('open','about:blank');if(opened.status||opened.stdout.includes('### Error'))throw Error(opened.stdout+opened.stderr);
const code=String.raw`async page => {
  const checks=[],errors=[],warnings=[];
  const check=(ok,message)=>{if(!ok)throw Error(message);checks.push(message)};
  const shot=async name=>{await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode().catch(()=>{}))));await page.screenshot({path:${JSON.stringify(evidence.pathname)}+name+'.png'})};
  const settings=()=>page.getByRole('button',{name:'IDE and Project Settings',exact:true});
  const toggle=()=>page.getByRole('menuitemcheckbox',{name:'Automatic tour',exact:true});
  const fresh=async suffix=>{await page.goto('http://127.0.0.1:4173/?workspace=tour-v21-${runId}-'+suffix);await settings().waitFor()};
  const startFast=async()=>{await page.evaluate(()=>{autoTour.stop();autoTour.pace=.025;document.activeElement?.blur();autoTour.enabled=true;autoTour.start()});await page.waitForFunction(()=>autoTour.playing)};
  const completed=async()=>{await page.waitForFunction(()=>!autoTour.playing,{timeout:45000});check(await page.evaluate(()=>document.documentElement.dataset.autoTourStep==='complete'),'Tour completes every scene without missing controls');await page.evaluate(()=>autoTour.stop())};
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text())});
  try{
    await page.setViewportSize({width:1728,height:1117});await fresh('desktop');
    const saved=await page.evaluate(()=>localStorage.getItem(storageKey));
    check(await page.evaluate(()=>autoTour.enabled&&!autoTour.playing),'Automatic tour is enabled initially and waits before starting');
    await page.evaluate(()=>{
      window.tourProof={};window.tourSteps=[];
      document.addEventListener('auto-tour-step',e=>tourSteps.push(e.detail));
      const seen=(name,ok)=>{if(ok)tourProof[name]=true};
      const expanded=selector=>document.querySelector(selector)?.closest('[role="treeitem"]')?.getAttribute('aria-expanded')==='true';
      const inspect=()=>{
        seen('claude',!!document.querySelector('.claude-scroll'));
        seen('claudeScroll',(document.querySelector('.claude-scroll')?.scrollTop||0)>100);
        seen('claudeTool',!!document.querySelector('.terminal-tool[open]'));
        seen('codexTools',!!document.querySelector('.air-work[open] .air-tool-group[open]'));
        seen('recordedTool',!!document.querySelector('.dialog[aria-label="Recorded tool activity"]'));
        seen('recordedEdit',!!document.querySelector('.dialog[aria-label="Recorded file edit"]'));
        seen('sessionLog',document.querySelector('.event-detail')?.textContent.includes('toolCallId'));
        seen('partialSplit',!!document.querySelector('.jd-snapshot-banner')&&!!document.querySelector('.jd-split'));
        seen('partialUnified',!!document.querySelector('.jd-snapshot-banner')&&!!document.querySelector('.jd-unified'));
        seen('fullUnified',!document.querySelector('.jd-snapshot-banner')&&!!document.querySelector('.jd-unified'));
        seen('fullSplit',!document.querySelector('.jd-snapshot-banner')&&!!document.querySelector('.jd-split'));
        seen('notificationRules',expanded('.debug-variables [data-key="variables-2-5"]'));
        seen('inlineInspector',expanded('.debug-inspector [data-key="inspector-0-5"]'));
        seen('savedWatches',expanded('.debug-variables [data-key="savedWatches-1"]'));
        seen('console',document.querySelectorAll('.console-line').length===58&&(document.querySelector('.debug-console-output')?.scrollTop||0)>100);
        seen('springNavigation',document.documentElement.dataset.autoTourStep==='spring-navigation'&&activeTab()?.path?.endsWith('/NotificationDispatcher.java'));
      };
      window.proofObserver=new MutationObserver(inspect);proofObserver.observe(document.body,{subtree:true,childList:true,attributes:true});document.addEventListener('scroll',inspect,true);
    });
    await page.waitForFunction(()=>autoTour.playing,{timeout:10000});
    check(await page.locator('#auto-tour-cursor').isVisible(),'Idle autoplay starts and displays its cursor');
    check(await page.locator('#auto-tour-cursor').evaluate(el=>getComputedStyle(el).pointerEvents==='none'&&el.getAttribute('aria-hidden')==='true'),'Cursor neither intercepts input nor enters the accessibility tree');
    await page.waitForFunction(()=>document.querySelector('.claude-scroll')&&document.querySelector('#auto-tour-cursor.clicking'),{timeout:15000});await shot('claude-cursor');
    await page.evaluate(()=>autoTour.pace=.025);
    await completed();
    const proof=await page.evaluate(()=>{proofObserver.disconnect();return tourProof});
    for(const [key,label] of Object.entries({claude:'Claude Air TUI opens',claudeScroll:'Claude findings scroll into view',claudeTool:'Claude recorded tool expands',codexTools:'Codex work and tool groups expand',recordedTool:'Recorded tool output opens',recordedEdit:'Recorded edit patch opens',sessionLog:'Raw session tool events are browsed',partialSplit:'Partial side-by-side diff opens',partialUnified:'Partial unified diff opens',fullUnified:'Full unified diff opens',fullSplit:'Full side-by-side diff opens',notificationRules:'Notification rules expand in Variables',inlineInspector:'Inline dispatcher inspector expands channelService',savedWatches:'Saved notification rules watch expands',console:'Full startup console scrolls',springNavigation:'Autowired gutter navigates directly to NotificationDispatcher'}))check(!!proof[key],label);
    check(await page.evaluate(()=>activeTab().path===data.debugger.file&&!!document.querySelector('.execution-line[data-line="65"]')),'Tour returns to NotificationController at the breakpoint');
    check(await page.evaluate(()=>localStorage.getItem(storageKey))===saved,'Autoplay leaves the saved visitor layout untouched');
    await shot('complete');
    await page.evaluate(()=>autoTour.schedule(30));await page.waitForFunction(()=>autoTour.playing);await completed();
    check(await page.evaluate(()=>tourSteps.filter(x=>x==='complete').length===2),'The tour repeats successfully with already opened tabs and expanded values');
    await settings().click();check(await toggle().getAttribute('aria-checked')==='true','Top-right settings exposes the checked Automatic tour option');await shot('settings-enabled');
    await toggle().click();check(await page.evaluate(()=>!autoTour.enabled&&!autoTour.playing)&&await page.locator('#auto-tour-cursor').isHidden(),'Disabling the tour hides the cursor and cancels playback');
    await page.reload();await settings().waitFor();check(await page.evaluate(()=>!autoTour.enabled&&document.documentElement.dataset.autoTour==='off'),'The disabled preference survives reload');
    await settings().click();await toggle().click();await page.waitForFunction(()=>autoTour.playing,{timeout:4000});
    check(await page.evaluate(()=>autoTour.enabled),'Enabling the option restarts the tour');
    await page.mouse.move(600,150);check(await page.evaluate(()=>!autoTour.playing)&&await page.locator('#auto-tour-cursor').isHidden(),'A real pointer movement immediately hands control to the visitor');
    const paused=await page.evaluate(()=>state.active);await page.waitForTimeout(650);check(await page.evaluate(()=>state.active)===paused,'Aborted animations cannot fire a delayed click');
    await startFast();await page.mouse.wheel(0,100);await page.waitForFunction(()=>!autoTour.playing,{timeout:1000});check(await page.evaluate(()=>!autoTour.playing),'A real wheel event interrupts playback');
    await startFast();await page.keyboard.press('Escape');check(await page.evaluate(()=>!autoTour.playing),'Keyboard input interrupts playback');
    await settings().click();await page.evaluate(()=>autoTour.start());check(await page.evaluate(()=>!autoTour.playing),'Autoplay waits while a visitor has a menu open');await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Search Everywhere',exact:true}).click();await page.evaluate(()=>autoTour.start());check(await page.evaluate(()=>!autoTour.playing),'Autoplay waits while the visitor is searching');await page.keyboard.press('Escape');
    // Automation pages stay foregrounded. Exercise the hidden-page handler
    // explicitly, and label that boundary as simulated in the evidence.
    await startFast();await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))});
    check(await page.evaluate(()=>!autoTour.playing),'Visibility changes cancel playback (simulated hidden-page event)');
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));autoTour.stop()});
    await page.emulateMedia({reducedMotion:'reduce'});await fresh('reduced');check(await page.evaluate(()=>!autoTour.enabled),'Reduced motion defaults the tour to off');
    await settings().click();check(await toggle().getAttribute('aria-checked')==='false','Reduced-motion visitors see the unchecked option');await page.keyboard.press('Escape');
    await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:700,height:900});await fresh('narrow');await page.evaluate(()=>autoTour.stop());
    check(await settings().isVisible(),'The tour setting remains accessible on narrow windows');await startFast();await completed();await shot('narrow-complete');
    const requests=[],url='http://127.0.0.1:4173/tour-static?workspace=tour-v21-offline-${runId}';
    page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});
    await page.route(url,r=>r.fulfill({path:${JSON.stringify(fileURLToPath(new URL('release/notify-hub-prototype.html',root)))},contentType:'text/html'}));
    await page.context().setOffline(true);await page.setViewportSize({width:1280,height:800});await page.goto(url);await settings().waitFor();
    await startFast();await completed();
    check(await page.locator('img').evaluateAll(async imgs=>{await Promise.all(imgs.map(i=>i.decode().catch(()=>{})));return imgs.every(i=>i.src.startsWith('data:')&&i.naturalWidth>0)}),'Every displayed asset decodes from the offline export');
    check(requests.every(r=>r===url),'The complete offline tour needs no network requests');await shot('offline-complete');
    await page.context().setOffline(false);await page.unroute(url);
    check(errors.length===0&&warnings.length===0,'No runtime, asset, CSP or missing-tour-control errors');
    return {result:'PASS',checks,errors,warnings,proof,browser:page.context().browser().version(),timing:'Initial autoplay and cursor captured at normal speed; subsequent walkthrough actions accelerated without skipping controls.'};
  }catch(error){await shot('failure');return {result:'FAIL',checks,errors,warnings,error:error.message,step:await page.evaluate(()=>document.documentElement.dataset.autoTourStep),proof:await page.evaluate(()=>window.tourProof)}}
  finally{await page.evaluate(()=>autoTour?.stop());await page.context().setOffline(false)}
}`;
writeFileSync(new URL('walkthrough.js',evidence),code);
const run=cli('run-code',code),output=run.stdout+'\n'+run.stderr;writeFileSync(new URL('browser-output.txt',evidence),output);
const result=output.match(/### Result\n([\s\S]*?)\n### Ran Playwright code/);let report;
if(result){report=JSON.parse(result[1]);writeFileSync(new URL('report.json',evidence),JSON.stringify(report,null,2)+'\n')}
console.log(output.split('### Ran Playwright code')[0].slice(0,15000));console.log('Evidence: '+evidence.pathname);
if(run.status||output.includes('### Error')||report?.result!=='PASS')process.exitCode=1;
