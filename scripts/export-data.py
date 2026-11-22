#!/usr/bin/env python3
"""Export explicit project/session snapshots; never modifies their source files."""
from pathlib import Path
import collections, datetime, difflib, json, subprocess
from import_session import import_codex

APP = Path(__file__).resolve().parents[1]
MAIN = Path('/Users/anton/IdeaProjects/screencasts/air-demo/notify-hub')
EXCLUDED_PATHS = {'demo-test.sh'}

def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args]).decode('utf-8', errors='replace')

def show(root, rev, path):
    r = subprocess.run(['git', '-C', str(root), 'show', f'{rev}:{path}'], capture_output=True)
    return r.stdout.decode('utf-8', errors='replace') if r.returncode == 0 else ''

def make_diff(path, before, after, scope, label=''):
    lines = []
    a, b = before.splitlines(), after.splitlines()
    for tag,i,j,k,l in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if tag == 'equal':
            lines.extend({'kind':'equal','old':i+n+1,'new':k+n+1,'left':v,'right':v} for n,v in enumerate(a[i:j]))
        else:
            for n in range(max(j-i,l-k)):
                left = a[i+n] if i+n<j else None
                right = b[k+n] if k+n<l else None
                lines.append({'kind':tag,'old':i+n+1 if left is not None else None,'new':k+n+1 if right is not None else None,'left':left,'right':right})
    patch = ''.join(difflib.unified_diff(before.splitlines(True),after.splitlines(True),fromfile='a/'+path,tofile='b/'+path))
    return {'path':path,'before':before,'after':after,'rows':lines,'patch':patch,'scope':scope,'label':label,
        'added':sum(1 for x in lines if x['kind']!='equal' and x['right'] is not None),
        'removed':sum(1 for x in lines if x['kind']!='equal' and x['left'] is not None)}

def project(root, id, label):
    files = {}
    paths = git(root,'ls-files','-z','--cached','--others','--exclude-standard').split('\0')
    modified = set(git(root,'diff','--name-only','HEAD').splitlines())
    changes = []
    for name in sorted(set(paths) | modified):
        if not name or name in EXCLUDED_PATHS or name.startswith('.idea/') or name.startswith('.git/') or name=='.git': continue
        p = root/name
        if not p.is_file():
            before = show(root, 'HEAD', name)
            if before and name in modified: changes.append(make_diff(name, before, '', id, 'HEAD → Working tree'))
            continue
        raw = p.read_bytes()
        if b'\x00' in raw or len(raw)>1000000: continue
        text = raw.decode('utf-8',errors='replace')
        before = show(root,'HEAD',name)
        status = ('modified' if before else 'added') if name in modified else ''
        files[name] = {'path':name,'text':text,'status':status,'lines':len(text.splitlines()),'bytes':len(raw)}
        if status: changes.append(make_diff(name,before,text,id,'HEAD → Working tree'))
    return {'id':id,'label':label,'root':str(root),'branch':git(root,'branch','--show-current').strip(),
        'commit':git(root,'rev-parse','--short','HEAD').strip(),'files':files,'changes':changes}

# Import the real Codex turn. Claude remains an authored fixture; Debug reconstructs the captured paused state.
import copy
p = project(MAIN, 'main', 'notify-hub · main')
codex = import_codex(make_diff)
changes = codex['changes']
base_project = copy.deepcopy(p)
base_project.update(id='baseline', label='notify-hub · before session', changes=[])
for change in changes:
    path, before, after = change['path'], change['before'], change['after']
    assert p['files'][path]['text'] == after, 'Live source differs from the recorded Codex result: '+path
    base_project['files'][path].update(text=before, status='', lines=len(before.splitlines()), bytes=len(before.encode()))
for f in base_project['files'].values(): f['status'] = ''
controller = 'src/main/java/com/example/notifyhub/api/NotificationController.java'
dispatcher = 'src/main/java/com/example/notifyhub/service/NotificationDispatcher.java'
assert 'NotificationResult result = dispatcher.dispatch(notification);' in p['files'][controller]['text'].splitlines()[64]
now = codex['createdAt']

review_findings = [
    {'priority':'P1','title':'Dashboard channel mutations are publicly accessible','path':'src/main/java/com/example/notifyhub/config/SecurityConfig.java','needle':'.anyRequest()', 'detail':'The ADMIN matcher covers notification operations and /api/channels, but dashboard POST and PUT routes fall through to permitAll(). Anyone can enable or disable a channel. Protect every mutation route, including the explicit-state PUT endpoint.'},
    {'priority':'P2','title':'Retry settings do not drive delivery behavior','path':dispatcher,'needle':'private int maxRetryAttempts', 'detail':'notifyhub.retry.max-attempts is injected, but dispatch() calls sender.send() once. A transient sender failure is recorded as FAILED immediately. Implement the configured retry policy or remove the unused setting.'},
    {'priority':'P2','title':'Rate limiting is configured but never enforced','path':dispatcher,'needle':'private int rateLimit','detail':'notifyhub.rate-limit is read into a field and never checked during dispatch. Operators can configure a limit without affecting request throughput.'},
    {'priority':'P2','title':'Browser Basic authentication needs a CSRF boundary','path':'src/main/java/com/example/notifyhub/config/SecurityConfig.java','needle':'.csrf(', 'detail':'CSRF is disabled globally while HTTP Basic authentication is enabled. Browsers can reuse Basic credentials automatically. Before using authenticated dashboard controls in production, add CSRF protection or use an authentication mechanism that is not ambient in browser requests.'}
]
for f in review_findings:
    f['line']=next(i+1 for i,l in enumerate(base_project['files'][f['path']]['text'].splitlines()) if f['needle'] in l)
claude_prompt='Review this project for code quality issues. Focus on correctness, security and configuration that does not match the implementation. Give concrete findings with file and line references. Do not change any files.'
claude={'id':'claude-review','title':'Review project quality','tabTitle':'Project review · Claude Code','agent':'claude','model':'Claude Sonnet 4.5','cwd':str(MAIN),'archived':False,'createdAt':now-300000,'updatedAt':now-100000,'turns':[{'id':'quality-review-turn','timestamp':now-300000,'prompt':claude_prompt,'attachments':[],'activity':[],'answer':'Review complete. 4 findings, no files changed.','changes':[],'endedAt':now-100000}],'changes':[],'events':[],'eventCount':0,'eventTypes':{},'fixture':True,'findings':review_findings}

from debugger_snapshot import debugger_snapshot
debugger = debugger_snapshot(controller, dispatcher, p['files'])

def path_for(name):
    return next(x for x in p['files'] if x.endswith('/'+name))
def target(name,needle,label=None):
    path=path_for(name)
    line=next(i+1 for i,l in enumerate(p['files'][path]['text'].splitlines()) if needle in l)
    return {'path':path,'line':line,'label':label or name.removesuffix('.java')}
spring={controller:{'23':{'title':'Choose Autowired Bean','targets':[target('NotificationDispatcher.java','public class')]}},dispatcher:{
    '19':{'title':'Choose Bean Usage','targets':[target('NotificationController.java','private final NotificationDispatcher','dispatcher · NotificationController')]},
    '23':{'title':'Spring Configuration Property','targets':[target('application.yml','#  default-channel','notifyhub.default-channel · default: email')]},
    '26':{'title':'Spring Configuration Property','targets':[target('application.yml','  rate-limit','notifyhub.rate-limit = 50')]},
    '29':{'title':'Spring Configuration Property','targets':[target('application.yml','    max-attempts','notifyhub.retry.max-attempts = 3')]},
    '37':{'title':'Choose Autowired Bean','targets':[target('ChannelService.java','public class')]},
    '38':{'title':'Choose Autowired Bean','targets':[target('TemplateResolver.java','public class')]},
    '39':{'title':'Choose Autowired Bean','targets':[target('NotificationLogRepository.java','public interface')]},
    '40':{'title':'Choose Autowired Beans','targets':[target(n+'.java','public class') for n in ['HeaderTransformer','FooterTransformer','StyleTransformer']]}}}
data={'exportedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'targetSession':codex['id'],'projects':[p,base_project], 'sessions':[codex,claude],'debugger':debugger,'spring':spring,'scenario':'debugger-v6','provenance':'Codex acp:eccab739 is imported from its recorded ACP events, including its one-file patch. Project files are a local snapshot. Claude review is authored. Debugger values reconstruct the supplied screenshots and the paused IDEA instance. This prototype does not run agents or code.'}
(APP/'dist/data.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
print(json.dumps({'projectFiles':len(p['files']),'changedFiles':[c['path'] for c in changes],'sessions':len(data['sessions']),'suspendedLine':65,'dataBytes':(APP/'dist/data.json').stat().st_size},indent=2))
