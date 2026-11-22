"""Read ACP records as data. Nothing in a transcript is ever executed."""
from pathlib import Path
import collections, json, re

SESSION_LOG = Path('/Users/anton/Library/Caches/JetBrains/IntelliJIdea2026.3/acp/projects/bd20dbf4/threads/acp%3Aeccab739/events.jsonl')

def apply_recorded_patch(before, patch):
    old = before.splitlines(True)
    result, cursor = [], 0
    for hunk in re.split(r'(?=^@@ )', patch, flags=re.M)[1:]:
        header, *lines = hunk.splitlines(True)
        start = int(re.match(r'@@ -(\d+)', header)[1]) - 1
        result.extend(old[cursor:start])
        cursor = start
        for line in lines:
            if line[0] in ' -':
                assert old[cursor] == line[1:], 'Recorded patch context has drifted'
                cursor += 1
            if line[0] in ' +': result.append(line[1:])
    return ''.join(result + old[cursor:])

def import_codex(make_diff):
    events = [json.loads(line) for line in SESSION_LOG.read_text().splitlines()]
    created = next(e for e in events if e['type'] == 'ThreadCreated')
    cwd, sid = created['payload']['cwd'], created['threadId']
    messages, tools = {}, {}
    for e in events:
        p = e['payload']
        if e['type'] in ('MessageDelta', 'MessageChunk'):
            key = p.get('messageId') or p.get('protocolMessageId')
            assert key, 'Message needs a stable record identifier'
            if key not in messages:
                messages[key] = dict(id=key, type='message', role=p['role'], phase=p.get('messagePhase'), timestamp=e['timestamp'], seq=e['seq'], text='')
            messages[key]['text'] += p.get('contentDelta', '')
            messages[key]['endedAt'] = e['timestamp']
        elif e['type'] == 'ToolCallUpdated':
            key = p['toolCallId']
            if key not in tools:
                tools[key] = dict(id=key, type='tool', timestamp=e['timestamp'], seq=e['seq'], output='')
            tools[key].update({k:v for k,v in p.items() if k != 'toolCallId'})
        elif e['type'] == 'ToolCallOutput':
            tool = tools[p['toolCallId']]
            tool['output'] = ('' if p.get('outputOperation') == 'replace' else tool['output']) + p.get('contentDelta', '')
    prompt = next(m for m in messages.values() if m['role'] == 'User')
    final = next(m for m in messages.values() if m['phase'] == 'Final')
    activity = sorted([m for m in messages.values() if m['phase'] == 'Working'] + list(tools.values()), key=lambda x:x['seq'])
    edit = next(t for t in tools.values() if t['kind'] == 'edit')['content'][0]
    path = str(Path(edit['path']).relative_to(cwd))
    # The full before version is present in the first terminal read, before its sed error.
    read = next(t['output'] for t in tools.values() if t['kind'] == 'execute' and 'SecurityConfig.java' in t['title'])
    before = read[read.index('package com.example.notifyhub.config;'):read.index('\nsed:')]+ '\n'
    after = apply_recorded_patch(before, edit['patch']['text'])
    change = make_diff(path, before, after, sid, 'Session changes')
    assert (change['added'], change['removed']) == (7,2)
    ended = next(e['timestamp'] for e in events if e['type'] == 'PromptTurnFinished')
    # Air measures work between the first assistant output and the final output.
    work_seconds = round((final['endedAt'] - activity[0]['timestamp']) / 1000)
    turn = dict(id=prompt['id'],timestamp=prompt['timestamp'],prompt=prompt['text'],attachments=[],activity=activity,answer=final['text'].strip(),changes=[change],endedAt=ended,workSeconds=work_seconds)
    configs = next(e['payload']['configOptions'] for e in reversed(events) if e['type']=='ConfigOptionUpdated')
    config = {x['id']:x for x in configs}
    model = next(o['name'] for o in config['model']['options'] if o['value']==config['model']['value'])
    summary = json.loads(SESSION_LOG.with_name('summary.json').read_text())
    s = dict(id=sid,title=summary['displayTitle'],tabTitle='Secure channel controls with ADMIN role',agent='codex',model=model+' '+config['reasoning_effort']['value'].capitalize(),cwd=cwd,archived=False,createdAt=created['timestamp'],updatedAt=ended,turns=[turn],changes=[change],events=events,eventCount=len(events),eventTypes=dict(collections.Counter(e['type'] for e in events)),fixture=False,sourceLog=str(SESSION_LOG),draft=next(e['payload']['text'] for e in events if e['type']=='PromptSuggestionsUpdated'))
    return s
