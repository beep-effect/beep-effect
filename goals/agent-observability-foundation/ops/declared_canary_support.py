"""Bind synthetic route expectations to the retained, reviewed root before send.

This proof-side declaration does not upgrade real harness coverage or add raw
repository paths to telemetry. Both stages must use the same retained root.
"""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess

SALT = 'synthetic-launch-proof-salt'
QUALIFICATION_SHA = '30e49630d28c7b72ed89e17dead852d7eea7fedf7c8c70d357762d7808cec631'
PROBE_SHA = 'ad227f12771ae17d0298334260d825ee393c1db7346444fa6aa5a6c8d0c0856c'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def private_hash(value):
    return sha((SALT+'\0'+value).encode())


class DeclaredCanary:
    def __init__(self, directory, workspace):
        self.directory = directory.absolute()
        self.workspace = workspace
        self.verify()

    def verify(self):
        for name, mode in [('', 0o700), ('repository', 0o700),
                           ('qualification.json', 0o600), ('root-probe.json', 0o600)]:
            info = (self.directory/name).lstat()
            assert not stat.S_ISLNK(info.st_mode) and info.st_uid == os.getuid()
            assert stat.S_IMODE(info.st_mode) == mode
        qualified = (self.directory/'qualification.json').read_bytes()
        probe_bytes = (self.directory/'root-probe.json').read_bytes()
        assert sha(qualified) == QUALIFICATION_SHA and sha(probe_bytes) == PROBE_SHA
        self.qualification = json.loads(qualified)
        probe = json.loads(probe_bytes)
        q = self.qualification
        assert q['probeSha256'] == PROBE_SHA and q['sourceStableDuringRun'] is True
        assert probe['inventory']['hosts'] == [q['host']]
        assert probe['inventory']['roots'] == [q['root']]
        assert all(r['knownLaunches']['_tag'] == r['expectedEvents']['_tag'] == 'Unknown'
                   for r in probe['inventory']['routes'])
        for relative, expected in q['sourceSha256'].items():
            assert sha((self.workspace/relative).read_bytes()) == expected, relative
        git_env = {'PATH': os.environ['PATH'], 'HOME': str(self.directory/'home'),
                   'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_CONFIG_NOSYSTEM': '1'}
        def git(*args):
            return subprocess.check_output(['git', '-c', 'core.fsmonitor=false', *args], cwd=self.directory/'repository',
                                           env=git_env, stdin=subprocess.DEVNULL, timeout=5).decode().strip()
        assert git('rev-parse', 'HEAD') == q['gitHead']
        assert git('remote', 'get-url', 'origin') == 'https://example.invalid/observation/synthetic.git'
        assert not git('status', '--porcelain')
        assert Path(git('rev-parse', '--show-toplevel')).resolve(strict=True) == self.directory/'repository'
        git_dir, common_dir = git('rev-parse', '--path-format=absolute', '--absolute-git-dir', '--git-common-dir').splitlines()
        assert private_hash('worktree/v2:'+str(Path(git_dir).resolve(strict=True))) == q['root']['worktreeId']['id']
        assert private_hash('owning-clone/v2:'+str(Path(common_dir).resolve(strict=True))) == q['root']['cloneId']['id']
        assert sha(b'repository-remote/v2:example.invalid/observation/synthetic') == q['root']['repositoryId']['id']
        assert q['host']['identityNamespaceId'] == private_hash('ai-metrics-hash-salt-namespace/v1')

    def configure(self, config, token):
        self.verify()
        q = self.qualification
        config['intake']['hostId'] = q['host']['hostId']
        assert config['intake']['namespaceId'] == q['host']['identityNamespaceId']
        config['route']['routeId'] = private_hash('synthetic-declared-route/v1:'+token)

    def plan(self, output, config_path, payload, project, stage):
        self.verify()
        config = json.loads(config_path.read_text())
        q = self.qualification
        assert config['intake']['hostId'] == q['host']['hostId']
        assert config['intake']['namespaceId'] == q['host']['identityNamespaceId']
        route_id = config['route']['routeId']
        spans = payload['resourceSpans'][0]['scopeSpans'][0]['spans']
        events = []
        for span in spans:
            surface = next(a['value']['stringValue'] for a in span['attributes']
                           if a['key'] == 'beep.fixture.surface')
            events.append({'surface': surface, 'sourceTraceId': span['traceId'],
                           'sourceSpanId': span['spanId'],
                           'eventId': private_hash('native-span/v1:'+route_id+':'+span['traceId']+':'+span['spanId'])})
        assert {e['surface'] for e in events} == {'cli', 'desktop'} and len(events) == 2
        plan = {'version': 'synthetic-declared-route-plan/v1', 'recordedBeforeSend': True,
                'recordedAt': datetime.now(timezone.utc).isoformat(), 'stage': stage,
                'syntheticOnly': True, 'actualHarnessCoverage': False,
                'associationBasis': 'Explicit synthetic producer declaration; not inferred harness or repository coverage',
                'qualificationSha256': QUALIFICATION_SHA, 'rootProbeSha256': PROBE_SHA,
                'host': q['host'], 'root': q['root'], 'routeId': route_id,
                'project': project, 'expectedEvents': events,
                'workerConfigSha256': sha(config_path.read_bytes()),
                'inputSha256': sha(json.dumps(payload).encode()),
                'realHarnessPopulations': 'Unknown'}
        data = (json.dumps(plan, indent=2)+'\n').encode()
        for forbidden in (str(self.directory), SALT, 'synthetic-declared-canary-host', 'example.invalid'):
            assert forbidden.encode() not in data
        with (output/'declared-route-plan.json').open('xb') as target:
            os.fchmod(target.fileno(), 0o600)
            target.write(data); target.flush(); os.fsync(target.fileno())
        descriptor = os.open(output, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
        return plan, sha(data)
