"""Read-only reconstruction of the IDEA suspension captured on 2026-11-22."""
from pathlib import Path
import copy, re


def debugger_snapshot(controller, dispatcher, files):
    def node(name, value, children=None, kind='value', **meta):
        result = dict(name=name, value=value, kind=kind, **meta)
        if children is not None:
            result['children'] = children
        return result

    def string(name, value):
        return node(name, '"' + value + '"', kind='string')

    def source(name):
        path = next(p for p in files if p.endswith('/' + name + '.java'))
        line = next(i + 1 for i, text in enumerate(files[path]['text'].splitlines())
                    if 'public class ' in text or 'public interface ' in text)
        return dict(path=path, line=line)

    def spring(bean_name, class_name):
        target = source(class_name)
        definitions = [node('Declared in', class_name + ', class', navigate=target),
            node('scope', 'singleton'),
            node('bean class name', 'com.example.notifyhub.' + target['path'].split('/notifyhub/')[1].removesuffix('.java').replace('/', '.')),
            node('definition type', 'SCANNED')]
        if class_name == 'NotificationController':
            definitions.append(node('Depends on', '{notificationDispatcher}', [node('notificationDispatcher', 'NotificationDispatcher', navigate=source('NotificationDispatcher'))]))
        if class_name == 'NotificationDispatcher':
            definitions += [node('Injected into', '{notificationController}', [node('notificationController', 'NotificationController', navigate=source('NotificationController'))]),
                node('Depends on', '{channelService, templateResolver, notificationLogRepository, footerTransformer, headerTransformer, styleTransformer}', [node(c[0].lower() + c[1:], c, navigate=source(c)) for c in ['ChannelService', 'TemplateResolver', 'NotificationLogRepository', 'FooterTransformer', 'HeaderTransformer', 'StyleTransformer']])]
        return [node('definition', bean_name, definitions, kind='bean', navigate=target),
            node('context', 'notify-hub', [node('profiles', 'default')], kind='context')]

    rules = [('transform.header', 'Important Update'), ('transform.footer', 'Sent via NotifyHub'),
             ('transform.style', 'formal'), ('transform.truncate', 'disabled'), ('audit.trace', 'true')]
    entries = [node(str(i), f'"{k}" → "{v}"', [string('key', k), string('value', v)]) for i, (k, v) in enumerate(rules)]
    summary = 'Notification[recipient=user@example.com, channel=email, templateCode=welcome, locale=en, payload={}, rules={' + ', '.join(k + '=' + v for k, v in rules) + '}]'
    notification = node('notification', '{Notification@21420}', [string('recipient', 'user@example.com'),
        string('channel', 'email'), string('templateCode', 'welcome'), string('locale', 'en'),
        node('payload', '{LinkedHashMap@21455} size = 0', []),
        node('rules', '{LinkedHashMap@21456} size = 5', entries, explore=True)],
        kind='parameter', summary='"' + summary + '"', fullValue=summary)
    channels = node('channelService', '{ChannelService@21445}', spring('channelService', 'ChannelService') + [
        node('sendersByChannel', '{ConcurrentHashMap@21459} size = 3', [
            node('"' + k + '"', '{' + t + '}', spring(t[0].lower() + t[1:], t), kind='bean')
            for k, t in [('sms', 'SmsNotificationSender'), ('email', 'EmailNotificationSender'), ('push', 'PushNotificationSender')]], explore=True),
        node('enabledByChannel', '{ConcurrentHashMap@21460} size = 3', [
            node('"' + k + '"', 'true') for k in ['sms', 'email', 'push']], explore=True)], kind='bean')
    bean = node('dispatcher', '{NotificationDispatcher@21423}', spring('notificationDispatcher', 'NotificationDispatcher') + [
        string('defaultChannel', 'email'), node('rateLimit', '50'), node('maxRetryAttempts', '3'), channels,
        node('templateResolver', '{TemplateResolver@21446}', spring('templateResolver', 'TemplateResolver') + [
            node('templateRepository', '{$Proxy160@21465}', spring('notificationTemplateRepository', 'NotificationTemplateRepository'), kind='bean'),
            node('messageSource', '{ResourceBundleMessageSource@21466}', [string('basename', 'messages')])], kind='bean'),
        node('logRepository', '{$Proxy159@21447}', spring('notificationLogRepository', 'NotificationLogRepository'), kind='bean'),
        node('transformersByName', '{HashMap@21448} size = 3', [
            node('"' + k + '"', '{' + t + '}', spring(k + 'Transformer', t), kind='bean')
            for k, t in [('header', 'HeaderTransformer'), ('footer', 'FooterTransformer'), ('style', 'StyleTransformer')]], explore=True)], kind='bean')
    security = node('security context', '{TestingAuthenticationToken}', [node('credentials', 'null'),
        string('principal', 'TestUser'),
        node('authorities', '{Collections$UnmodifiableRandomAccessList@21427} size = 1', [
            node('0', '{SimpleGrantedAuthority} "ROLE_ADMIN"', [string('role', 'ROLE_ADMIN')])], explore=True),
        node('details', 'null'), node('authenticated', 'true')], kind='security', summary='TestUser [ROLE_ADMIN]')
    console = (Path(__file__).resolve().parents[1] / 'fixtures/debugger/console.log').read_text()
    frames = []
    for raw in (Path(__file__).resolve().parents[1] / 'fixtures/debugger/stack.txt').read_text().splitlines():
        match = re.match(r'\s*at (.+)\((.+)\)', raw)
        if not match:
            continue
        qualified, location = match.groups()
        class_name, _, method = qualified.rpartition('.')
        package, _, simple = class_name.rpartition('.')
        line = int(location.rsplit(':', 1)[1]) if re.search(r':\d+$', location) else -1
        frame = dict(label=f'{method}:{line}, {simple} ({package})')
        if not frames:
            frame.update(path=controller, line=65)
        frames.append(frame)
    assert len(frames) == 127
    return dict(file=controller, line=65, thread='http-nio-8080-exec-1', hiddenFrames=len(frames)-1,
        capturedAt='2026-11-22T18:42:02.616+02:00',
        provenance='Visible values and object IDs captured from the paused IDEA instance and supplied screenshots. Full startup console supplied by the user on 22 November 2026. Nested Spring metadata and unexpanded service details are reconstructed from project sources.',
        notificationSummary=summary,
        variables=[security, node('this', '{NotificationController@21421}', spring('notificationController', 'NotificationController') + [copy.deepcopy(bean), string('applicationName', 'notify-hub')], kind='bean'), notification],
        watches=[dict(copy.deepcopy(bean), watch=True)],
        savedWatches=[string('notification.recipient()', 'user@example.com'),
            node('notification.rules()', '{LinkedHashMap@21456} size = 5', copy.deepcopy(entries), explore=True),
            string('dispatcher.defaultChannel', 'email'), node('dispatcher.rateLimit', '50'),
            string('notification.rules().get("transform.truncate")', 'disabled')],
        frames=frames,
        console=console)
