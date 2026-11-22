import {readFile,writeFile,mkdir} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root=new URL('../',import.meta.url);
const data=JSON.parse(await readFile(new URL('dist/data.json',root),'utf8'));
data.logicalLibraries=JSON.parse(await readFile(new URL('dist/logical-libraries.json',root),'utf8'));
const sandbox={data,state:{project:'main'},project:id=>data.projects.find(p=>p.id===id)};
vm.createContext(sandbox);
vm.runInContext(await readFile(new URL('dist/tool-windows.js',root),'utf8'),sandbox);
const model=sandbox.buildLogicalModel(data.projects[0].files);
const counts=Object.fromEntries(['components','controllers','repositories','services','configurations'].map(k=>[k,model.beans.filter(b=>b.kind===k).length]));
assert.deepEqual(counts,{components:3,controllers:3,repositories:2,services:7,configurations:1});
assert.equal(model.beans.reduce((n,b)=>n+b.endpoints.length,0),9);
assert.deepEqual(Array.from(model.byName.NotificationController.fields[0].targets),['NotificationDispatcher']);
assert.deepEqual(Array.from(model.byName.NotificationDispatcher.fields.find(f=>f.name==='transformersByName').targets).sort(),['FooterTransformer','HeaderTransformer','StyleTransformer']);
assert(model.byName.StyleTransformer.usages.includes('NotificationDispatcher'));
assert.deepEqual(Array.from(model.byName.StyleTransformer.methods,m=>m.name),['getName','apply']);
assert.equal(model.byName.StyleTransformer.methods[1].parameters,'String, Notification');
assert.deepEqual(Array.from(model.byName.SecurityConfig.definitions,m=>m.name),['filterChain','userDetailsService','passwordEncoder']);
for(const bean of model.beans){
  const lines=data.projects[0].files[bean.path].text.split('\n');
  assert(lines[bean.line-1].includes(bean.name));
  for(const endpoint of bean.endpoints)assert(lines[endpoint.line-1].includes(endpoint.method));
  for(const method of [...bean.methods,...bean.definitions])assert(lines[method.line-1].includes(method.name+'('));
}
const roots=sandbox.logicalNodes(),all=[];
function walk(nodes){for(const node of nodes){all.push(node);walk(node.children||[])}}
walk(roots);
assert.equal(new Set(all.map(n=>n.id)).size,all.length,'Tree identities must be unique through repeated injection paths');
const config=sandbox.logicalFind('bean/SecurityConfig',roots);
assert.deepEqual(Array.from(config.children,n=>n.label),['Imports','Autowires','Produced Beans']);
assert.equal(sandbox.logicalFind('bean/SecurityConfig/beans',roots).children[0].detail,'filterChain | SINGLETON');
assert.equal(sandbox.logicalFind('auto',roots).children.length,19);
const jdbc=data.logicalLibraries[0];
assert.equal(jdbc.jar,'spring-boot-jdbc-4.0.2-sources.jar');
assert.equal(jdbc.configs.length,9);
assert.equal(jdbc.configs[0].beanName,'XADataSourceAutoConfiguration');
for(const group of data.logicalLibraries)for(const c of group.configs){assert(c.text.includes('class '+c.name));assert(c.text.split('\n')[c.line-1].includes(c.name))}
sandbox.state={tabs:[{id:'changes:main',type:'changes'},{id:'session:'+data.targetSession,type:'session',session:data.targetSession}],active:'changes:main'};
sandbox.initToolWindowsState({});
assert.equal(sandbox.state.primaryTool,'commit');
assert(sandbox.state.active.startsWith('session:'));
assert(!sandbox.state.tabs.some(t=>t.type==='changes'));
const report={result:'PASS',componentCounts:counts,endpoints:9,producedBeans:3,libraryJars:19,autoConfigurations:data.logicalLibraries.reduce((n,g)=>n+g.configs.length,0),checks:['Native component groups and endpoint counts','Autowired and reverse-injection relationships','Method signatures and exact source targets','Produced Beans and native configuration labels','Cached source JAR groupings and JavaBeans names','Unique cycle-safe tree identities','Legacy changes editor migrates to Commit dock']};
await mkdir(new URL('evidence/tool-windows-v5/',root),{recursive:true});
await writeFile(new URL('evidence/tool-windows-v5/model-verification.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
