"""Owned disposable Phoenix with bounded resources and an independent expiry."""
import json
from pathlib import Path
import time
import urllib.error
import uuid

PHOENIX = 'arizephoenix/phoenix@sha256:c542e7de1dc1fdd0f938de337d44ebefa7266e91391eed6e7978523d7f6e1f2f'


class DisposableBackend:
    def __init__(self, command, request):
        self.command, self.request = command, request
        self.token = uuid.uuid4().hex[:12]
        self.name = 'foundation-declared-phoenix-'+self.token
        self.network = self.name+'-net'
        self.created = self.network_created = False
        self.guard = None
        self.evidence = {'syntheticOnly': True, 'image': PHOENIX, 'result': 'incomplete'}

    def start(self):
        available = next(int(line.split()[1])*1024 for line in Path('/proc/meminfo').read_text().splitlines()
                         if line.startswith('MemAvailable:'))
        assert available >= 16*1024**3, 'Insufficient host headroom for disposable backend'
        self.evidence['initialHostAvailableBytes'] = available
        self.command(['docker', 'image', 'inspect', PHOENIX])
        self.network_created = True
        self.command(['docker', 'network', 'create', '--label', 'beep.observation.canary='+self.token, self.network])
        self.created = True
        self.command(['docker', 'run', '-d', '--pull=never', '--name', self.name,
                      '--network', self.network, '--label', 'beep.observation.canary='+self.token,
                      '--memory=2g', '--memory-swap=2g', '--cpus=1', '--pids-limit=128', '--read-only',
                      '--cap-drop=ALL', '--security-opt=no-new-privileges', '--log-driver=none',
                      '--tmpfs=/data:rw,nosuid,size=536870912', '--tmpfs=/tmp:rw,nosuid,size=536870912',
                      '-p', '127.0.0.1::6006', '-e', 'PHOENIX_WORKING_DIR=/data',
                      '-e', 'PHOENIX_ENABLE_AUTH=false', '-e', 'PHOENIX_TELEMETRY_ENABLED=false',
                      '-e', 'PHOENIX_DISABLE_AGENT_ASSISTANT=true', '-e', 'PHOENIX_ALLOWED_SANDBOX_PROVIDERS=NONE', PHOENIX])
        info = json.loads(self.command(['docker', 'inspect', self.name]).stdout)[0]
        self.guard = self.name+'-expiry'
        self.command(['systemd-run', '--user', '--quiet', '--unit='+self.guard, '--on-active=210s',
                      '--timer-property=AccuracySec=1s', '/usr/bin/docker', 'stop', '--time=10', info['Id']])
        limits = info['HostConfig']
        assert limits['Memory'] == limits['MemorySwap'] == 2147483648
        assert limits['NanoCpus'] == 1000000000 and limits['PidsLimit'] == 128
        assert limits['ReadonlyRootfs'] and limits['CapDrop'] == ['ALL']
        assert all(b['HostIp'] == '127.0.0.1' for bindings in info['NetworkSettings']['Ports'].values()
                   for b in (bindings or []))
        self.origin = 'http://'+self.command(['docker', 'port', self.name, '6006/tcp']).stdout.strip()
        self.collector_origin = 'http://'+self.name+':6006'
        deadline = time.monotonic()+60
        while True:
            try:
                if self.request(self.origin+'/healthz') == b'OK': break
            except (OSError, urllib.error.URLError): pass
            assert time.monotonic() < deadline, 'Disposable backend readiness deadline'
            time.sleep(.2)
        self.evidence.update(result='ready', resourceLimitsVerified=True, independentExpirySeconds=210)

    def close(self):
        if self.created:
            found = self.command(['docker', 'inspect', self.name], check=False)
            if found.returncode == 0:
                info = json.loads(found.stdout)[0]
                assert info['Config']['Labels']['beep.observation.canary'] == self.token
                self.command(['docker', 'stop', '--time=10', self.name])
                info = json.loads(self.command(['docker', 'inspect', self.name]).stdout)[0]
                assert not info['State']['Running'] and not info['State']['OOMKilled']
                self.command(['docker', 'rm', self.name])
                assert self.command(['docker', 'inspect', self.name], check=False).returncode != 0
        if self.guard:
            self.command(['systemctl', '--user', 'stop', self.guard+'.timer', self.guard+'.service'], check=False)
            self.command(['systemctl', '--user', 'reset-failed', self.guard+'.service'], check=False)
        if self.network_created:
            found = self.command(['docker', 'network', 'inspect', self.network], check=False)
            if found.returncode == 0:
                info = json.loads(found.stdout)[0]
                assert info['Labels']['beep.observation.canary'] == self.token and not info['Containers']
                self.command(['docker', 'network', 'rm', self.network])
        self.evidence['cleanup'] = 'owned disposable backend and network removed; exported evidence retained'
