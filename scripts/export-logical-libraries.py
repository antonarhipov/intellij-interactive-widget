#!/usr/bin/env python3
"""Snapshot the cached Spring Boot source JARs shown by IDEA's logical view."""
from pathlib import Path
import json
import re
import zipfile

APP = Path(__file__).resolve().parents[1]
VERSION = '4.0.2'
ARTIFACTS = [
    'jdbc', 'autoconfigure', 'actuator-autoconfigure', 'health',
    'micrometer-metrics', 'data-jpa', 'data-commons', 'webmvc', 'flyway',
    'hibernate', 'servlet', 'http-converter', 'jackson', 'transaction',
    'security', 'micrometer-observation', 'persistence', 'tomcat', 'validation',
]
groups = []
for artifact in ARTIFACTS:
    artifact = 'spring-boot-' + artifact
    cache = Path.home() / '.m2/repository/org/springframework/boot' / artifact / VERSION
    binary = cache / f'{artifact}-{VERSION}.jar'
    sources = cache / f'{artifact}-{VERSION}-sources.jar'
    with zipfile.ZipFile(binary) as jar, zipfile.ZipFile(sources) as source_jar:
        imports = jar.read('META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports').decode()
        configs = []
        for qualified in imports.splitlines():
            if not qualified or qualified.startswith('#'):
                continue
            path = qualified.replace('.', '/').split('$')[0] + '.java'
            text = source_jar.read(path).decode()
            name = qualified.rsplit('.', 1)[-1]
            bean_name = name if name[:2].isupper() else name[:1].lower() + name[1:]
            declaration = re.search(r'^(?:public\s+)?(?:final\s+)?class\s+' + re.escape(name) + r'\b', text, re.M)
            configs.append({
                'id': qualified, 'name': name, 'beanName': bean_name,
                'path': path, 'text': text,
                'line': text[:declaration.start()].count('\n') + 1 if declaration else 1,
            })
        configs.sort(key=lambda c: c['beanName'])
        groups.append({'jar': sources.name, 'configs': configs})
(APP / 'dist/logical-libraries.json').write_text(json.dumps(groups, ensure_ascii=False, separators=(',', ':')))
print(f'Logical libraries: {len(groups)} cached source JARs, {sum(len(g["configs"]) for g in groups)} configurations')
