#!/usr/bin/env python3
"""Copy the installed IDEA Database Tools artwork with its source manifest."""
import json
from pathlib import Path
from zipfile import ZipFile

IDE = Path.home() / 'Applications/IntelliJ IDEA 2026.3.app/Contents'
DEST = Path(__file__).resolve().parents[1] / 'dist/icons/database'
DEST.mkdir(parents=True, exist_ok=True)
DB = 'plugins/DatabaseTools/lib/modules/intellij.database.jar'
PLATFORM = 'lib/intellij.platform.icons.jar'
assets = {name: (DB, 'icons/expui/' + resource + '_dark.svg') for name, resource in {
    'table': 'table', 'schema': 'schema', 'database': 'database',
    'folder': 'objectGroup', 'objects': 'databaseObjectsGroup', 'virtual-folder': 'virtualFolder',
    'column': 'column', 'column-required': 'columnDot', 'column-index': 'columnDotIndex', 'column-key': 'columnGoldKeyDotIndex',
    'key': 'goldKey', 'index': 'index', 'index-unique': 'indexUnique',
    'sequence': 'sequence', 'settings': 'manageDataSources', 'console': 'console',
    'submit': 'submitDB', 'rollback': 'rollback', 'transpose': 'dataStructure',
    'view': 'virtualView', 'filter': 'funnelRegular', 'preview': 'previewChanges',
}.items()}
assets.update({name: (PLATFORM, resource) for name, resource in {
    'postgres': 'providers/postgresql_dark.svg',
    'add': 'expui/general/add_dark.svg', 'remove': 'expui/general/remove_dark.svg',
    'refresh': 'expui/general/refresh_dark.svg', 'history': 'expui/general/history_dark.svg',
    'locate': 'expui/general/locate_dark.svg', 'expand': 'expui/general/expandAll_dark.svg',
    'collapse': 'expui/general/collapseAll_dark.svg', 'more': 'expui/general/moreVertical_dark.svg',
    'hide': 'expui/general/hide_dark.svg', 'search': 'expui/general/search_dark.svg',
    'eye': 'expui/general/show_dark.svg', 'gear': 'expui/general/settings_dark.svg',
    'import': 'expui/general/import_dark.svg', 'export': 'expui/general/export_dark.svg',
    'sort': 'expui/general/sortBy_dark.svg',
}.items()})
manifest = {}
for name, (jar, resource) in assets.items():
    with ZipFile(IDE / jar) as archive:
        (DEST / (name + '.svg')).write_bytes(archive.read(resource))
    manifest[name] = {'jar': str(IDE / jar), 'resource': resource}
(DEST / 'sources.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Database icons: {len(manifest)} installed IDEA assets')
