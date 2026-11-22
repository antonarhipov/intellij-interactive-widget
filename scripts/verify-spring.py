#!/usr/bin/env python3
"""Portable checks for source-derived injection and configuration navigation."""
from pathlib import Path
import json
from spring_navigation import build_spring_navigation, property_index, without_comments

app = Path(__file__).resolve().parents[1]
data = json.loads((app / 'dist/data.json').read_text())
libraries = json.loads((app / 'dist/logical-libraries.json').read_text())
library_sources = {source['id']: source for group in libraries for source in group['configs']}
prefix = 'src/main/java/com/example/notifyhub/'
resources = 'src/main/resources/'
report = {}
for project in data['projects']:
    files, nav = project['files'], data['springByProject'][project['id']]
    assert nav == build_spring_navigation(files, libraries), 'Refresh the source-derived Spring navigation'
    count = 0
    for path, lines in nav.items():
        for line, meta in lines.items():
            assert 0 < int(line) <= files[path]['lines']
            assert meta['targets']
            for target in meta['targets']:
                source = library_sources[target['library']] if target.get('library') else files[target['path']]
                assert 0 < target['line'] <= len(source['text'].splitlines())
                if meta['kind'] == 'property':
                    assert not source['text'].splitlines()[target['line'] - 1].lstrip().startswith('#')
                    assert target in property_index(files)[meta['propertyKey']]
                count += 1
    def targets(name, line):
        return nav[prefix + name][str(line)]['targets']
    def destination(name, line, file, target_line):
        found = targets(name, line)
        assert len(found) == 1 and found[0]['path'].endswith('/' + file) and found[0]['line'] == target_line, (name, line, found)
    for name, line, file, target_line in [
        ('api/ChannelController.java', 18, 'ChannelService.java', 23),
        ('api/DashboardController.java', 29, 'DashboardService.java', 25),
        ('api/DashboardController.java', 30, 'ChannelService.java', 23),
        ('api/NotificationController.java', 23, 'NotificationDispatcher.java', 21),
        ('api/NotificationController.java', 25, 'application.yml', 3),
        ('service/DashboardService.java', 27, 'NotificationLogRepository.java', 17),
        ('service/DashboardService.java', 28, 'ChannelService.java', 23),
        ('service/TemplateResolver.java', 26, 'NotificationTemplateRepository.java', 20),
        ('service/TemplateResolver.java', 27, 'MessageSourceAutoConfiguration.java', 78),
        ('service/NotificationDispatcher.java', 23, 'application-prod.yml', 13),
        ('service/NotificationDispatcher.java', 29, 'application.yml', 22),
        ('config/SecurityConfig.java', 38, 'application.yml', 28),
        ('config/SecurityConfig.java', 39, 'application.yml', 29),
    ]:
        if name == 'config/SecurityConfig.java' and project['id'] == 'baseline':
            line -= 1
        destination(name, line, file, target_line)
    assert [(t['path'], t['line']) for t in targets('service/NotificationDispatcher.java', 26)] == [(resources+'application.yml', 20), (resources+'application-prod.yml', 14)]
    assert [t['beanName'] for t in targets('service/ChannelService.java', 28)] == ['emailNotificationSender', 'pushNotificationSender', 'smsNotificationSender']
    assert {t['beanName'] for t in targets('service/NotificationDispatcher.java', 40)} == {'footerTransformer', 'headerTransformer', 'styleTransformer'}
    assert all('GenericNotificationSender.java' not in t['path'] for lines in nav.values() for meta in lines.values() for t in meta['targets'])
    assert all(str(n) not in nav[prefix+'service/ChannelService.java'] for n in (25, 26)), 'Initialized maps are not injection points'
    assert all(str(n) not in nav[prefix+'service/NotificationDispatcher.java'] for n in range(32, 36)), 'Explicit constructor injection is marked on parameters'
    assert sum(m['kind'] == 'property' for lines in nav.values() for m in lines.values()) == 6
    security = files[prefix+'config/SecurityConfig.java']['text'].splitlines()
    factory = next(i+1 for i, line in enumerate(security) if 'public UserDetailsService userDetailsService(' in line)
    encoder = next(i+1 for i, line in enumerate(security) if 'public PasswordEncoder passwordEncoder(' in line)
    destination('config/SecurityConfig.java', factory, 'SecurityConfig.java', encoder)
    tests = 'src/test/java/com/example/notifyhub/'
    assert nav[tests+'dashboard/DashboardControllerTest.java']['28']['targets'][0]['path'] == prefix+'service/ChannelService.java'
    assert set(nav[tests+'dashboard/DashboardIntegrationTest.java']) == {'28', '31', '34', '37'}
    assert nav[tests+'repository/NotificationTemplateRepositoryTest.java']['21']['targets'][0]['path'] == prefix+'repository/NotificationTemplateRepository.java'
    report[project['id']] = {'gutterLocations': sum(map(len, nav.values())), 'targets': count, 'valueReferences': 6}

assert data['spring'] == data['springByProject']['main']
# Source offsets survive comments; commented demonstration annotations and YAML
# properties must never become navigation destinations.
sample = '// @Value("${fake}")\nString url = "https://example.com"; /* @Autowired */\n'
clean = without_comments(sample)
assert len(clean) == len(sample) and clean.count('\n') == sample.count('\n')
assert '@Value' not in clean and '@Autowired' not in clean and 'https://example.com' in clean
props = property_index({'src/main/resources/example.properties': {'text': '#ignored=value\nnotifyhub.limit = 5\n'},
    'src/main/resources/example.yml': {'text': 'notifyhub:\n  # ignored: true\n  limit: 6\n  nested:\n    key: hello\n'}})
assert len(props['notifyhub.limit']) == 2 and props['notifyhub.nested.key'][0]['line'] == 5
assert not any('ignored' in key for key in props)
print(json.dumps({'result': 'PASS', 'springNavigation': report}, indent=2))
