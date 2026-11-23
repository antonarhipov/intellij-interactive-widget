import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';

const root=new URL('../',import.meta.url),runId=new Date().toISOString().replaceAll(':','-');
const evidence=new URL('output/playwright/source-navigation/'+runId+'/',root);mkdirSync(evidence,{recursive:true});
const cli=(...args)=>spawnSync('bash',['/Users/anton/.codex/skills/playwright/scripts/playwright_cli.sh','--session','source-navigation',...args],{encoding:'utf8',maxBuffer:4e6,env:{...process.env,npm_config_loglevel:'silent'}});
const opened=cli('open','about:blank');if(opened.status||opened.stdout.includes('### Error'))throw Error(opened.stdout+opened.stderr);
const code=String.raw`async page=>{
  const checks=[],errors=[],failures=[],coverage={};
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failures.push(r.url())});
  const check=(ok,message)=>{if(!ok)throw Error(message);checks.push(message)};
  const prefix='src/main/java/com/example/notifyhub/';
  const open=async(file,line=1,source='main')=>page.evaluate(({path,line,source})=>goToSource(path,line,source),{path:prefix+file,line,source});
  const active=async(file,line,source='main')=>page.evaluate(({path,line,source})=>activeTab().path===path&&activeTab().source===source&&!!document.querySelector('.navigation-line[data-line="'+line+'"]'),{path:prefix+file,line,source});
  const type=name=>page.locator('.code-text').getByRole('button',{name,exact:true}).first();
  const shot=async name=>page.screenshot({path:${JSON.stringify(evidence.pathname)}+name+'.png'});
  try{
    await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1728,height:1117});
    await page.goto('http://127.0.0.1:4173/?workspace=source-navigation-${runId}');await page.locator('.code-scroll').waitFor();
    const scroll=await page.locator('.code-scroll').evaluate(e=>e.scrollTop);
    const record=page.locator('.code-line[data-line="60"]').getByRole('button',{name:'NotificationResult',exact:true});
    await record.hover();await shot('record-reference');await record.click();
    check(await active('model/NotificationResult.java',7),'A result type opens its record declaration at the original source line');
    await page.keyboard.press('Alt+ArrowLeft');
    check(await page.evaluate(()=>activeTab().path===data.debugger.file)&&Math.abs(await page.locator('.code-scroll').evaluate(e=>e.scrollTop)-scroll)<2,'Back navigation restores the controller and its source scroll position');
    check(await page.locator('.syn-type').filter({hasText:'ResponseEntity'}).getByRole('button').count()===0,'External Spring types do not become project links');
    await open('service/NotificationDispatcher.java',70);await type('NotificationStatus').click();
    check(await active('model/NotificationStatus.java',7),'Enum references open their enum declaration');
    await open('service/ChannelService.java',28);await type('NotificationSender').click();
    check(await active('service/NotificationSender.java',12),'Generic collection element types open their interface declaration');
    await open('api/DashboardController.java',29);await type('DashboardService').click();
    check(await active('service/DashboardService.java',25),'An injected service outside the old allowlist opens its class');
    await open('api/DashboardController.java',65);await type('AddChannelRequest').click();
    check(await active('api/DashboardController.java',115),'Nested records open their own declaration within the controller');await shot('nested-record');
    await page.evaluate(()=>goToSource('src/test/java/com/example/notifyhub/NotifyHubApplicationTests.java',9,'main'));await type('IntegrationTestBase').click();
    check(await page.evaluate(()=>activeTab().path==='src/test/java/com/example/notifyhub/IntegrationTestBase.java'&&!!document.querySelector('.navigation-line[data-line="23"]')),'Test source types open abstract project test declarations');
    await open('config/SecurityConfig.java',32);
    const doc=page.locator('.rendered-doc').getByRole('button',{name:'com.example.notifyhub.api.NotificationController',exact:true});
    await doc.hover();await shot('rendered-javadoc-link');await doc.click();
    check(await active('api/NotificationController.java',21),'Rendered Javadoc fully qualified type links open their declaration');
    await open('service/NotificationDispatcher.java',60);
    await page.locator('.rendered-doc').getByRole('button',{name:'NotificationStatus#BLOCKED',exact:true}).click();
    check(await active('model/NotificationStatus.java',7),'Javadoc member references navigate to the project enum type');
    await open('api/NotificationController.java',60,'baseline');
    await page.locator('.code-line[data-line="60"]').getByRole('button',{name:'NotificationResult',exact:true}).click();
    check(await active('model/NotificationResult.java',7,'baseline'),'Navigation stays in the before-session snapshot when browsing its source');
    const scanned=await page.evaluate(()=>{
      const report={};
      for(const source of ['main','baseline']){
        const totals={files:0,links:0,invalid:[]};
        for(const [path,file] of Object.entries(project(source).files)){
          if(!path.endsWith('.java'))continue;openFile(path,source);totals.files++;
          const text=$$('.code-text').map(e=>e.textContent).join('\n').replace(/\s+$/gm,'').trimEnd();
          if(text!==file.text.replace(/\s+$/gm,'').trimEnd())totals.invalid.push({path,issue:'Source text changed'});
          for(const link of $$('[data-action="type-nav"]')){
            totals.links++;const target=project(source).files[link.dataset.path],line=target?.text.split('\n')[+link.dataset.line-1];
            if(link.dataset.source!==source||!line||!/\b(class|interface|record|enum)\s+/.test(line))totals.invalid.push({path,target:link.dataset.path,line:link.dataset.line});
          }
          const index=projectTypeIndex(source);
          for(const span of $$('.code-text .syn-type:not(:has(button))')){
            if(!index.byName.has(span.textContent))continue;
            const line=+span.closest('.code-line').dataset.line;
            if(!index.files.get(path).types.some(t=>t.name===span.textContent&&t.line===line))totals.invalid.push({path,line,type:span.textContent,issue:'Missing project type link'});
          }
          if($('.syn-comment [data-action="type-nav"],.syn-str [data-action="type-nav"]'))totals.invalid.push({path,issue:'A literal became a type link'});
        }
        report[source]=totals;
      }
      return report;
    });
    Object.assign(coverage,scanned);
    for(const [source,result] of Object.entries(scanned))check(result.files===38&&result.links>100&&!result.invalid.length,'Every Java file in '+source+' retains its original source and only links to valid declarations');
    await page.setViewportSize({width:1280,height:800});await open('api/NotificationController.java',65);
    await page.locator('.code-line[data-line="60"]').getByRole('button',{name:'NotificationResult',exact:true}).click();
    check(await active('model/NotificationResult.java',7),'Type navigation works at laptop size');await shot('record-laptop');
    check(!errors.length&&!failures.length,'No runtime errors or missing assets');
    return {result:'PASS',checks,coverage,errors,failures,browser:page.context().browser().version()};
  }catch(error){await shot('failure');return {result:'FAIL',checks,coverage,errors,failures,error:error.message}}
}`;
const run=cli('run-code',code),output=run.stdout+'\n'+run.stderr;writeFileSync(new URL('browser-output.txt',evidence),output);
const result=output.match(/### Result\n([\s\S]*?)\n### Ran Playwright code/);
if(result)writeFileSync(new URL('report.json',evidence),JSON.stringify(JSON.parse(result[1]),null,2)+'\n');
console.log(output.split('### Ran Playwright code')[0].slice(0,12000));console.log('Evidence: '+evidence.pathname);
if(run.status||output.includes('### Error')||output.includes('"result":"FAIL"'))process.exitCode=1;
