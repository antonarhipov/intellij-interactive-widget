import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import http from 'node:http';
import {homedir} from 'node:os';
import {resolve,extname} from 'node:path';
import {promisify} from 'node:util';

const root=new URL('../',import.meta.url),site=new URL('release/site/',root);
const evidence=new URL('output/playwright/hover-cache/'+new Date().toISOString().replaceAll(':','-')+'/',root);
await mkdir(evidence,{recursive:true});
const landing=await readFile(new URL('idea-lp.html',site),'utf8'),unversioned=await readFile(new URL('dist/idea-lp.html',root),'utf8');
const versions={};
for(const name of ['index.html','idea-lp.js','idea-lp.css']){
  versions[name]=createHash('sha256').update(await readFile(new URL(name,site))).digest('hex').slice(0,16);
  assert.ok(landing.includes('v='+versions[name]),'Published resource has its content hash: '+name);
}
// Model an already cached, older hover-sensitive build. The published phase
// serves the real current standalone export, not a mocked playback controller.
const legacy='<!doctype html><html data-cache-legacy="true"><body style="margin:0;height:100vh;background:#191a1c;color:white"><p>Cached older widget fixture</p><script>document.documentElement.dataset.playback="playing";document.addEventListener("pointermove",()=>document.documentElement.dataset.playback="paused");</script></body></html>';
let phase='legacy';const widgetRequests=[];
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf'};
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');let body;
    if(url.pathname==='/idea-lp.html')body=phase==='versioned'?landing:unversioned;
    else if(url.pathname==='/index.html'){widgetRequests.push(req.url);body=phase==='legacy'?legacy:await readFile(new URL('index.html',site))}
    else if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return}
    else{assert.ok(!url.pathname.includes('..'));body=await readFile(new URL('.'+url.pathname,site))}
    res.writeHead(200,{'Content-Type':mime[extname(url.pathname)]||'application/octet-stream','Cache-Control':'public, max-age=600'});res.end(body);
  }catch{res.writeHead(404);res.end()}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const cli=async(...args)=>{
  const {stdout,stderr}=await promisify(execFile)('bash',[resolve(homedir(),'.codex/skills/playwright/scripts/playwright_cli.sh'),'--session','hover-cache',...args],{maxBuffer:6e6,env:{...process.env,npm_config_loglevel:'silent'}});
  assert.ok(!stdout.includes('### Error'),stdout+stderr);return stdout;
};
const run=async(name,code)=>{
  const output=await cli('run-code',code);await writeFile(new URL(name+'.txt',evidence),output);
  const result=output.match(/### Result\n([\s\S]*?)\n### Ran Playwright code/);assert.ok(result,output);return JSON.parse(result[1]);
};
try{
  await cli('open','about:blank');
  const visit=async(label)=>run(label,`async page=>{
    await page.setViewportSize({width:1280,height:900});await page.goto(${JSON.stringify(base+'/idea-lp.html?phase=')}+${JSON.stringify(label)});
    await page.locator('#idea-widget-shell').scrollIntoViewIfNeeded();const frame=page.frameLocator('#idea-widget');
    await frame.locator('html[data-cache-legacy="true"]').waitFor();await page.mouse.move(640,450,{steps:10});
    const state=await frame.locator('html').getAttribute('data-playback');if(state!=='paused')throw Error('Legacy fixture should pause on hover');
    return {cachedLegacy:true,hoverPaused:true,iframe:await page.locator('#idea-widget').getAttribute('src')};
  }`);
  const first=await visit('first-visit');assert.equal(widgetRequests.length,1);
  phase='published';
  const stale=await visit('unversioned-update');
  assert.equal(widgetRequests.length,1,'Negative control reuses the cached old iframe even though a newer export is available');
  phase='versioned';
  const current=await run('versioned-update',`async page=>{
    const errors=[],warnings=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning')warnings.push(m.text())});
    await page.goto(${JSON.stringify(base+'/idea-lp.html?phase=versioned')});await page.locator('#idea-widget-shell').scrollIntoViewIfNeeded();
    const frame=page.frameLocator('#idea-widget');await frame.locator('#app[aria-busy="false"]').waitFor();await frame.locator('html[data-auto-tour="playing"]').waitFor({timeout:1500});
    await frame.locator('html').evaluate(()=>{window.hoverStops=[];const stop=autoTour.stop;autoTour.stop=function(...args){hoverStops.push(new Error().stack);return stop.apply(this,args)}});
    for(const [x,y] of [[640,450],[131,309],[320,300],[900,300],[640,700],[1150,400],[650,450]]){
      await page.mouse.move(x,y,{steps:10});await page.waitForTimeout(500);
      if(await frame.locator('html').getAttribute('data-auto-tour')!=='playing')throw Error('Current playback stopped on hover');
    }
    await page.screenshot({path:${JSON.stringify(new URL('current-hover.png',evidence).pathname)}});
    const hoverStops=await frame.locator('html').evaluate(()=>window.hoverStops);if(hoverStops.length)throw Error('Hover interrupted the tour');
    await frame.getByRole('button',{name:'Project (⌘1)',exact:true}).click();
    if(await frame.locator('html').getAttribute('data-auto-tour')==='playing')throw Error('Click must take over');
    const click=await frame.locator('html').evaluate(()=>{autoTour.pace=.05;return autoTour.takeoverUntil-10000});
    await frame.locator('html[data-auto-tour="playing"]').waitFor({timeout:11500});
    const idle=await frame.locator('html').evaluate(()=>performance.now())-click;if(idle<9900||idle>11500)throw Error('Expected ten-second click takeover');
    return {playingThroughSevenHovers:true,hoverStops,clickTakeover:true,resumeAfterMs:idle,errors,warnings,iframe:await page.locator('#idea-widget').getAttribute('src')};
  }`);
  assert.equal(widgetRequests.length,2,'Versioned iframe fetches the real new export');
  assert.ok(widgetRequests[1].includes('v='+versions['index.html']));assert.deepEqual(current.errors,[]);assert.deepEqual(current.warnings,[]);
  const report={result:'PASS',fixture:'Legacy hover handler represents a previously cached build; current phase uses the real Pages export.',first,stale,current,widgetRequests,versions};
  await writeFile(new URL('report.json',evidence),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({result:'PASS',resumeAfterMs:current.resumeAfterMs,evidence:evidence.pathname},null,2));
}finally{await cli('close').catch(()=>{});await new Promise(resolve=>server.close(resolve))}
