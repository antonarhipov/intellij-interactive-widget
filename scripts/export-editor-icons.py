#!/usr/bin/env python3
"""Copy the installed IDEA icons for the running toolbar and rendered Javadoc."""
from pathlib import Path
import json
import zipfile

IDE = Path.home() / 'Applications/IntelliJ IDEA 2026.3.app/Contents'
DEST = Path(__file__).resolve().parents[1] / 'dist/icons/editor'
DEST.mkdir(parents=True, exist_ok=True)
platform = 'lib/intellij.platform.icons.jar'
assets = {name: (platform, resource) for name, resource in {
    'resume': 'expui/run/resume_dark.svg',
    'restart': 'expui/run/restartDebug_stroke.svg',
    'restart-menu': 'expui/run/restartDebug_dark.svg',
    'stop': 'expui/run/stop_stroke.svg',
    'stop-menu': 'expui/run/stop_dark.svg',
    'more': 'expui/general/moreVertical_dark.svg',
    'search': 'expui/general/search@20x20_dark.svg',
    'settings': 'expui/general/settings@20x20_dark.svg',
    'settings-small': 'expui/general/settings_dark.svg',
    'refresh': 'expui/general/refresh_dark.svg',
    'notifications': 'expui/toolwindows/notifications@20x20_dark.svg',
    'tool-build': 'expui/toolwindows/build@20x20_dark.svg',
    'tool-run': 'expui/toolwindows/run@20x20_dark.svg',
    'tool-services': 'expui/toolwindows/services@20x20_dark.svg',
    'tool-problems': 'expui/toolwindows/problems@20x20_dark.svg',
    'tool-vcs': 'expui/toolwindows/vcs@20x20_dark.svg',
    'chevron': 'expui/general/chevronDown_dark.svg',
    'doc-edit': 'expui/gutter/javadocEdit_dark.svg',
    'doc-read': 'expui/gutter/javadocRead_dark.svg',
    'breakpoint': 'expui/breakpoints/breakpointValid_dark.svg',
    'logpoint': 'expui/breakpoints/breakpointUnsuspendentValid_dark.svg',
    'toolbar-add': 'expui/general/add_dark.svg',
    'toolbar-open': 'expui/general/open_dark.svg',
    'vcs-branch': 'expui/general/vcs.svg',
    'vcs-update': 'expui/vcs/update_dark.svg',
    'vcs-commit': 'expui/vcs/commit_dark.svg',
    'vcs-push': 'expui/vcs/push_dark.svg',
    'vcs-fetch': 'expui/vcs/fetch_dark.svg',
    'vcs-favorite': 'expui/nodes/star_dark.svg',
}.items()}
assets.update({
    'tool-terminal': ('plugins/terminal/lib/terminal.jar', 'icons/expui/toolwindow/terminal@20x20_dark.svg'),
    'toolbar-home': ('plugins/vcs-github/lib/modules/intellij.vcs.github.ultimate.features.jar', 'icons/action/home.svg'),
    'vcs-worktree': ('plugins/vcs-git/lib/vcs-git.jar', 'icons/worktree_dark.svg'),
    'vcs-current': ('lib/intellij.platform.vcs.dvcs.impl.shared.jar', 'icons/new/currentBranchFavoriteLabel_dark.svg'),
    'vcs-tag': ('lib/intellij.platform.vcs.dvcs.impl.shared.jar', 'icons/new/branchLabel_dark.svg'),
    'spring-property': ('plugins/Spring/lib/modules/intellij.spring.jar', 'icons/expui/gutter/springProperty@14x14_dark.svg'),
    'spring-boot': ('plugins/spring-boot-plugin/lib/modules/intellij.spring.boot.shared.jar', 'icons/expui/springBoot_dark.svg'),
    'database': ('plugins/DatabaseTools/lib/modules/intellij.database.jar', 'icons/expui/dbms@20x20_dark.svg'),
    'maven': ('plugins/maven-plugin/lib/intellij.maven.jar', 'images/expui/toolwindow/maven@20x20_dark.svg'),
    'usage-details': ('plugins/air-plugin/lib/modules/intellij.air.frontend.session.toolwindow.jar', 'icons/statisticsEventLogExternal_dark.svg'),
})
air = 'plugins/air-plugin/lib/modules/intellij.air.shared.core.jar'
assets.update({
    'agent-' + name: (air, resource) for name, resource in {
        'junie': 'icons/junie.svg', 'codex': 'icons/codex_dark.svg',
        'claude': 'icons/claude.svg', 'opencode': 'icons/opencode_dark.svg',
        'copilot': 'icons/copilot_dark.svg', 'cloud': 'icons/cloud_dark.svg',
    }.items()
})
manifest = {}
for name, (jar, resource) in assets.items():
    with zipfile.ZipFile(IDE / jar) as archive:
        (DEST / (name + '.svg')).write_bytes(archive.read(resource))
    manifest[name] = {'jar': str(IDE / jar), 'resource': resource}
(DEST / 'sources.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Editor icons: {len(manifest)} installed IDEA assets')
