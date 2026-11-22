#!/usr/bin/env python3
"""Verify the recorded session, snapshot fidelity, and navigation/diff targets."""
from pathlib import Path
import hashlib, json, subprocess
from import_session import SESSION_LOG, apply_recorded_patch
app=Path(__file__).resolve().parents[1]
d=json.loads((app/'dist/data.json').read_text())
projects={p['id']:p for p in d['projects']}
base=projects['baseline']; after=projects['main']
report={'scenario':d['scenario'],'sourceFiles':0,'verifiedComparisons':0,'springTargets':0,'fixtureTestsExecuted':False}
s=next(s for s in d['sessions'] if s['agent']=='codex')
assert set(x['id'] for x in d['sessions'])=={'acp:eccab739','claude-review'}
assert not s['fixture'] and s['id']==d['targetSession']
assert s['events']==[json.loads(line) for line in SESSION_LOG.read_text().splitlines()]
assert s['eventCount']==297 and len(s['turns'])==1
turn=s['turns'][0]
assert turn['workSeconds']==43 and len(s['changes'])==1
assert len([a for a in turn['activity'] if a['type']=='message'])==3
assert len([a for a in turn['activity'] if a['type']=='tool'])==13
messages={}
for event in s['events']:
    if event['type'] in ('MessageDelta','MessageChunk'):
        p=event['payload'];key=p.get('messageId') or p.get('protocolMessageId')
        messages[key]=messages.get(key,'')+p.get('contentDelta','')
assert turn['prompt']==messages[turn['id']]
assert turn['answer']==messages[next(e['payload']['protocolMessageId'] for e in s['events'] if e['type']=='MessageChunk' and e['payload'].get('messagePhase')=='Final')].strip()
assert s['draft']==next(e['payload']['text'] for e in s['events'] if e['type']=='PromptSuggestionsUpdated')
for path,f in after['files'].items():
    assert (Path(after['root'])/path).read_bytes().decode('utf-8',errors='replace')==f['text'],path
    report['sourceFiles']+=1
assert 'demo-test.sh' not in base['files'] and 'demo-test.sh' not in after['files']
for c in s['changes']:
    assert c['before']==base['files'][c['path']]['text']
    assert c['after']==after['files'][c['path']]['text']
    edit=next(a for a in turn['activity'] if a.get('kind')=='edit')['content'][0]
    assert apply_recorded_patch(c['before'], edit['patch']['text'])==c['after']
    assert (c['added'],c['removed'])==(7,2)
assert s['changes']==turn['changes']
assert set(c['path'] for c in after['changes'])=={s['changes'][0]['path']}
for c in after['changes']+s['changes']:
    assert [r['left'] for r in c['rows'] if r['left'] is not None]==c['before'].splitlines()
    assert [r['right'] for r in c['rows'] if r['right'] is not None]==c['after'].splitlines()
    assert sum(r['kind']!='equal' and r['right'] is not None for r in c['rows'])==c['added']
    assert sum(r['kind']!='equal' and r['left'] is not None for r in c['rows'])==c['removed']
    report['verifiedComparisons']+=1
assert sum(c['added'] for c in after['changes'])==7
assert sum(c['removed'] for c in after['changes'])==2
modified={c['path'] for c in s['changes']}
for path,f in base['files'].items():
    if path not in modified: assert f['text']==after['files'][path]['text']
security=s['changes'][0]['after']
for route in ['/api/dashboard/services','/api/dashboard/services/**']:
    assert '"'+route+'"' in security
assert security.index('HttpMethod.POST')<security.index('.anyRequest()')
assert security.index('HttpMethod.PUT')<security.index('.anyRequest()')
assert security.count('.hasRole("ADMIN")')==3
for path,lines in d['spring'].items():
    assert path in after['files']
    for line,meta in lines.items():
        assert 0<int(line)<=after['files'][path]['lines']
        for target in meta['targets']:
            if target.get('library'):
                libraries=json.loads((app/'dist/logical-libraries.json').read_text())
                source=next(c for group in libraries for c in group['configs'] if c['id']==target['library'])
                assert source['path']==target['path']
                assert 0<target['line']<=len(source['text'].splitlines())
            else:
                assert target['path'] in after['files']
                assert 0<target['line']<=after['files'][target['path']]['lines']
            report['springTargets']+=1
db=d['debugger']
assert db['line']==65
assert len(db['frames'])==127 and db['hiddenFrames']==126
assert after['files'][db['file']]['text'].splitlines()[64].strip()=='NotificationResult result = dispatcher.dispatch(notification);'
assert [n['name'] for n in db['variables']]==['security context','this','notification']
assert not any(n['name']=='result' for n in db['variables'])
notif=db['variables'][2]
assert len(next(n['children'] for n in notif['children'] if n['name']=='rules'))==5
assert db['variables'][0]['summary']=='TestUser [ROLE_ADMIN]'
assert db['watches'][0]['value']=='{NotificationDispatcher@21423}'
assert len(db['savedWatches'])==5
assert db['console']==(app/'fixtures/debugger/console.log').read_text()
assert len(db['console'].splitlines())==58
assert db['console'].startswith('/Users/anton/.sdkman/candidates/java/current/bin/java -agentlib:jdwp=')
assert "Connected to the target VM, address: '127.0.0.1:57094'" in db['console']
assert ' :: Spring Boot ::                (v4.0.2)' in db['console']
assert 'Starting NotifyHubApplication using Java 25.0.1 with PID 31795' in db['console']
assert db['console'].splitlines()[-1].endswith('Received notification request for recipient: user@example.com')
assert 'Breakpoint reached' not in db['console']
def verify_debug_nodes(nodes):
    for node in nodes:
        if target := node.get('navigate'):
            assert target['path'] in after['files']
            assert 0<target['line']<=after['files'][target['path']]['lines']
        verify_debug_nodes(node.get('children', []))
verify_debug_nodes(db['variables']+db['watches']+db['savedWatches'])
review=next(s for s in d['sessions'] if s['agent']=='claude')
assert review['changes']==[]
for f in review['findings']:
    assert f['needle'] in base['files'][f['path']]['text'].splitlines()[f['line']-1]
report['sourceGitStatus']=subprocess.check_output(['git','-C',base['root'],'status','--porcelain']).decode().splitlines()
report['snapshotSha256']=hashlib.sha256((app/'dist/data.json').read_bytes()).hexdigest()
report['result']='PASS'
(app/'evidence/debugger-v6/data-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
