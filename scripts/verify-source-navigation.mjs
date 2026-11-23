import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root=new URL('../',import.meta.url),data=JSON.parse(readFileSync(new URL('dist/data.json',root),'utf8'));
const projects=data.projects,sandbox={project:id=>projects.find(p=>p.id===id)};
vm.createContext(sandbox);vm.runInContext(readFileSync(new URL('dist/scenario.js',root),'utf8'),sandbox);
const prefix='src/main/java/com/example/notifyhub/',testPrefix='src/test/java/com/example/notifyhub/';
const report={result:'PASS',types:{},checks:[]};
for(const source of ['main','baseline']){
  const index=sandbox.projectTypeIndex(source),types=Array.from(index.byQualifiedName.values()).flat();
  assert.equal(types.length,40);report.types[source]=types.length;
  for(const type of types){
    const line=projects.find(p=>p.id===source).files[type.path].text.split('\n')[type.line-1];
    assert.equal(line.slice(type.column,type.column+type.name.length),type.name);
    assert.match(line,/\b(class|interface|record|enum)\s+/);
  }
  for(const [file,ref,target,line] of [
    ['api/NotificationController.java','NotificationResult','model/NotificationResult.java',7],
    ['service/NotificationDispatcher.java','NotificationStatus','model/NotificationStatus.java',7],
    ['service/ChannelService.java','NotificationSender','service/NotificationSender.java',12],
    ['api/DashboardController.java','DashboardService','service/DashboardService.java',25],
    ['api/DashboardController.java','AddChannelRequest','api/DashboardController.java',115],
    ['api/DashboardController.java','DashboardController.ServiceToggleRequest','api/DashboardController.java',109],
    ['service/NotificationDispatcher.java','NotificationStatus#BLOCKED','model/NotificationStatus.java',7],
    ['config/SecurityConfig.java','com.example.notifyhub.api.NotificationController','api/NotificationController.java',21],
  ]){
    const resolved=sandbox.resolveProjectType(ref,{source,path:prefix+file});
    assert.equal(resolved?.path,prefix+target);assert.equal(resolved.line,line);
  }
  assert.equal(sandbox.resolveProjectType('IntegrationTestBase',{source,path:testPrefix+'NotifyHubApplicationTests.java'})?.line,23);
  assert.equal(sandbox.resolveProjectType('ResponseEntity',{source,path:prefix+'api/NotificationController.java'}),null);
  assert.equal(sandbox.resolveProjectType('String',{source,path:prefix+'model/Notification.java'}),null);
}
report.checks.push('All 40 Java declarations and original line/column positions in both snapshots','Class, interface, record, enum, nested-record and test-source targets','Imports, qualified references and Javadoc member references','External JDK and Spring types remain unresolved');

const fixture={id:'fixture',files:Object.fromEntries(Object.entries({
  'p/Outer.java':'package p; class Outer { record Inner(int n) {} }',
  'p/Marker.java':'package p; public @interface Marker {}',
  'a/Shared.java':'package a; public class Shared {}',
  'b/Shared.java':'package b; public interface Shared {}',
  'p/Consumer.java':'package p; import b.Shared; class Consumer { String sample="class Imaginary {}"; /* enum Phantom {} */ }',
  'p/External.java':'package p; import external.Outer; class External {}',
  'p/Ambiguous.java':'package p; import a.*; import b.*; class Ambiguous {}',
  'q/Consumer.java':'package q; import p.Outer.Inner; class Consumer {}',
}).map(([path,text])=>[path,{path,text}]))};projects.push(fixture);
const resolve=(ref,path='p/Consumer.java')=>sandbox.resolveProjectType(ref,{source:'fixture',path});
assert.equal(resolve('Shared').qualifiedName,'b.Shared');
assert.equal(resolve('a.Shared').qualifiedName,'a.Shared');
assert.equal(resolve('Outer.Inner').qualifiedName,'p.Outer.Inner');
assert.equal(resolve('Inner','q/Consumer.java').qualifiedName,'p.Outer.Inner');
assert.equal(resolve('Marker').kind,'interface');
assert.equal(resolve('Outer','p/External.java'),null);
assert.equal(resolve('Shared','p/Ambiguous.java'),null);
assert(!sandbox.projectTypeIndex('fixture').byName.has('Imaginary'));
assert(!sandbox.projectTypeIndex('fixture').byName.has('Phantom'));
report.checks.push('Same-named types follow explicit imports; ambiguous wildcards stay inactive','Nested imports, annotation declarations and external-import shadowing','Strings and comments cannot create fake declarations');
console.log(JSON.stringify(report,null,2));
