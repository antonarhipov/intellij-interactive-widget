#!/usr/bin/env python3
"""Copy the installed IDEA New UI icons used by the local Project browser."""
from pathlib import Path
import json
import zipfile

APP = Path(__file__).resolve().parents[1]
IDE = Path.home() / 'Applications/IntelliJ IDEA 2026.3.app/Contents'
DEST = APP / 'dist/icons/project'
DEST.mkdir(parents=True, exist_ok=True)
platform = IDE / 'lib/intellij.platform.icons.jar'
spring = IDE / 'plugins/Spring/lib/modules/intellij.spring.jar'
maven = IDE / 'plugins/maven-plugin/lib/intellij.maven.jar'
docker = Path.home() / 'Library/Application Support/JetBrains/IntelliJIdea2026.3/plugins/clouds-docker-impl/lib/modules/intellij.clouds.docker.shared.jar'
assets = {}
for name, resource in {
    'module': 'nodes/module', 'folder': 'nodes/folder', 'package': 'nodes/package',
    'source': 'nodes/sourceRoot', 'test-source': 'nodes/testSourceFolder',
    'resources': 'nodes/resourcesRoot', 'test-resources': 'nodes/testResourcesRoot',
    'libraries': 'nodes/library', 'jar': 'nodes/jarDirectory', 'class': 'nodes/class',
    'interface': 'nodes/interface', 'record': 'nodes/record', 'enum': 'nodes/enum',
    'exception': 'nodes/exception', 'ignored': 'fileTypes/ignored', 'text': 'fileTypes/text',
    'markdown': 'fileTypes/markdown', 'docker': 'fileTypes/docker', 'shell': 'fileTypes/shell',
    'windows': 'fileTypes/microsoftWindows', 'yaml': 'fileTypes/yaml',
    'properties': 'fileTypes/properties', 'xml': 'fileTypes/xml', 'sql': 'fileTypes/sql',
    'html': 'fileTypes/html', 'css': 'fileTypes/css', 'js': 'fileTypes/javaScript',
    'add': 'general/add', 'locate': 'general/locate', 'expand': 'general/expandAll',
    'collapse': 'general/collapseAll', 'more': 'general/moreVertical',
    'hide': 'general/hide', 'chevron': 'general/chevronRight',
    'chevron-down': 'general/chevronDown',
}.items():
    assets[name] = (platform, 'expui/' + resource)
assets.update({
    'spring-class': (spring, 'icons/expui/springJavaBean'),
    'spring-factory': (spring, 'icons/expui/springBeanFactory'),
    'spring-repository': (spring, 'icons/expui/repositoryBean'),
    'maven': (maven, 'images/expui/build/mavenProject'),
    'compose': (docker, 'icons/expui/dockerCompose'),
})
manifest = {}
for name, (jar, stem) in assets.items():
    with zipfile.ZipFile(jar) as archive:
        resource = stem + '_dark.svg'
        if resource not in archive.namelist():
            resource = stem + '.svg'
        (DEST / (name + '.svg')).write_bytes(archive.read(resource))
        manifest[name] = {'jar': str(jar), 'resource': resource}
(DEST / 'sources.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Project icons: {len(manifest)} installed IDEA assets')
