#!/usr/bin/env python3
"""Index the saved NotifyHub sources for read-only Spring navigation.

This bounded snapshot indexer handles the declaration forms in this project;
it is not a Java compiler or a report of the application's active beans.
"""
from collections import defaultdict
from pathlib import Path
import argparse
import json
import re

APP = Path(__file__).resolve().parents[1]
ANNOTATION = r'@\w+(?:\([^\n]*?\))?\s*'
FIELD = re.compile(r'^ {4}(?:(?:private|protected|public)[ \t]+)?(?P<final>final[ \t]+)?(?P<type>[\w.]+(?:<[^;\n=]+>)?)[ \t]+(?P<name>\w+)[ \t]*;', re.M)


def without_comments(text):
    # Keep offsets and string literals (including ${...} and URLs) intact.
    pattern = r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|//[^\n]*|/\*[\s\S]*?\*/'
    return re.sub(pattern, lambda m: re.sub(r'[^\n]', ' ', m[0]) if m[0].startswith(('//', '/*')) else m[0], text)


def property_index(files):
    properties = defaultdict(list)
    for path, file in sorted(files.items(), key=lambda item: ('/application.' not in item[0], item[0])):
        if '/resources/' not in path:
            continue
        stack = []
        for line, text in enumerate(file['text'].splitlines(), 1):
            if not text.strip() or text.lstrip().startswith(('#', '!')):
                continue
            if path.endswith(('.yml', '.yaml')):
                match = re.match(r'^( *)([\w.-]+):(?:\s+(.*))?$', text)
                if not match:
                    continue
                indent, key, value = len(match[1]), match[2], match[3]
                while stack and stack[-1][0] >= indent:
                    stack.pop()
                name = '.'.join([part for _, part in stack] + [key])
                if value is None or value.lstrip().startswith('#'):
                    stack.append((indent, key))
                    continue
            elif path.endswith('.properties'):
                match = re.match(r'\s*([\w.-]+)\s*[=:]\s*(.*)', text)
                if not match:
                    continue
                name, value = match.groups()
            else:
                continue
            properties[name].append({'path': path, 'line': line, 'label': name, 'value': value})
    return properties


def parameters(code, opening):
    """Yield parameter text and offsets, respecting generics and annotations."""
    depth, generic, start = 1, 0, opening + 1
    quoted = False
    for i in range(start, len(code)):
        char = code[i]
        if char == '"' and code[i - 1] != '\\':
            quoted = not quoted
        if quoted:
            continue
        if char == '(':
            depth += 1
        elif char == ')':
            depth -= 1
        elif char == '<':
            generic += 1
        elif char == '>':
            generic -= 1
        if depth == 0 or char == ',' and depth == 1 and generic == 0:
            part = code[start:i]
            if part.strip():
                yield part, start + len(part) - len(part.lstrip())
            start = i + 1
            if depth == 0:
                return


def build_spring_navigation(files, libraries):
    code = {path: without_comments(f['text']) for path, f in files.items() if path.endswith('.java')}
    beans, classes = defaultdict(list), {}
    line_of = lambda text, offset: text.count('\n', 0, offset) + 1
    for path, text in code.items():
        declaration = re.search(r'^(?:public\s+)?(?:abstract\s+)?(?:class|interface)\s+(\w+)([^\n{]*)', text, re.M)
        if not declaration:
            continue
        name = declaration[1]
        annotation = re.search(r'^@(Component|Service|Repository|Controller|RestController|Configuration)\b(?:\("([^"]+)"\))?', text[:declaration.start()], re.M)
        classes[path] = (name, annotation, declaration)
        if not annotation or '/main/java/' not in path:
            continue
        target = {'path': path, 'line': line_of(text, declaration.start()), 'label': name,
                  'beanName': annotation[2] or (name if name[:2].isupper() else name[0].lower() + name[1:])}
        beans[name].append(target)
        inherited = re.search(r'\b(?:implements|extends)\s+([^<{]+)', declaration[2])
        if inherited:
            for interface in re.findall(r'\b[A-Z]\w*\b', inherited[1]):
                beans[interface].append(target)
        for method in re.finditer(r'@Bean\b(?:\([^\n]*\))?\s+(?:public\s+)?([\w.<>]+)\s+(\w+)\s*\(', text):
            offset = text.rfind('\n', 0, text.index(method[1], method.start())) + 1
            beans[method[1]].append({'path': path, 'line': line_of(text, offset), 'label': method[2], 'beanName': method[2]})

    # A real bundled Spring factory, available in the dependency source browser.
    for group in libraries:
        for source in group['configs']:
            if source['id'] == 'org.springframework.boot.autoconfigure.context.MessageSourceAutoConfiguration':
                match = re.search(r'^\s*MessageSource messageSource\(', source['text'], re.M)
                if match:
                    offset = source['text'].index('MessageSource messageSource(', match.start())
                    beans['MessageSource'].append({'path': source['path'], 'line': line_of(source['text'], offset),
                        'library': source['id'], 'label': 'messageSource', 'beanName': 'messageSource'})

    result, usages = {}, defaultdict(list)

    def add(path, line, kind, targets, **extra):
        if not targets:
            return
        lines = result.setdefault(path, {})
        meta = lines.setdefault(str(line), {'kind': kind, 'targets': [], **extra})
        for target in targets:
            if target not in meta['targets']:
                meta['targets'].append(target)
        meta['title'] = {'property': 'Spring Configuration Property', 'usage': 'Choose Bean Usage'}.get(kind, 'Choose Autowired Bean' + ('s' if len(meta['targets']) > 1 else ''))

    def inject(path, text, type_name, offset, name):
        targets = []
        for type_part in re.findall(r'\b[A-Z]\w*\b', type_name):
            targets.extend(t for t in beans[type_part] if t not in targets)
        line = line_of(text, offset)
        add(path, line, 'bean', targets)
        if '/main/java/' in path:
            for target in targets:
                if not target.get('library') and target['line'] == line_of(code[target['path']], classes[target['path']][2].start()):
                    usages[target['path']].append({'path': path, 'line': line, 'label': name, 'beanName': name})

    properties = property_index(files)
    for path, text in code.items():
        name, annotation, declaration = classes.get(path, ('', None, None))
        for field in FIELD.finditer(text):
            before = text[:field.start()]
            autowired = re.search(r'@Autowired(?:\([^)]*\))?\s*$', before)
            lombok = annotation and re.search(r'@RequiredArgsConstructor\b', text[:declaration.start()]) and field['final']
            if autowired or lombok:
                inject(path, text, field['type'], field.start(), field['name'])
        if annotation:
            for constructor in re.finditer(r'^    (?:public\s+|protected\s+|private\s+)?' + re.escape(name) + r'\s*\(', text, re.M):
                for part, offset in parameters(text, constructor.end() - 1):
                    clean = re.sub(ANNOTATION, '', part).strip()
                    parameter = re.match(r'(?:final\s+)?([\w.<>, ?]+)\s+(\w+)$', clean)
                    if parameter and '@Value' not in part:
                        inject(path, text, parameter[1], offset, parameter[2])
            for method in re.finditer(r'@Bean\b(?:\([^\n]*\))?\s+(?:public\s+)?[\w.<>]+\s+\w+\s*\(', text):
                for part, offset in parameters(text, method.end() - 1):
                    parameter = re.match(r'\s*([\w.<>, ?]+)\s+(\w+)\s*$', part)
                    if parameter:
                        inject(path, text, parameter[1], offset, parameter[2])
        for value in re.finditer(r'@Value\(\s*"\$\{([^:}]+)(?::[^}]*)?\}"\s*\)', text):
            add(path, line_of(text, value.start()), 'property', properties[value[1]], propertyKey=value[1])

    for path, targets in usages.items():
        annotation = classes[path][1]
        add(path, line_of(code[path], annotation.start()), 'usage', targets)
    return result


def update_navigation(data, libraries):
    data['springByProject'] = {p['id']: build_spring_navigation(p['files'], libraries) for p in data['projects']}
    data['spring'] = data['springByProject']['main']


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true', help='Refresh navigation in the committed snapshot only')
    args = parser.parse_args()
    data = json.loads((APP / 'dist/data.json').read_text())
    update_navigation(data, json.loads((APP / 'dist/logical-libraries.json').read_text()))
    if args.write:
        (APP / 'dist/data.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
    print(json.dumps({project: {'gutterLocations': sum(len(lines) for lines in nav.values()),
        'targets': sum(len(meta['targets']) for lines in nav.values() for meta in lines.values())}
        for project, nav in data['springByProject'].items()}, indent=2))
