#!/usr/bin/env python3
"""Qualify changed epoch metadata through an isolated pinned collector/Phoenix."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import uuid

import jinja2
import yaml

spec = importlib.util.spec_from_file_location('route_proof', Path(__file__).with_name('verify-native-collector-route.py'))
route = importlib.util.module_from_spec(spec)
spec.loader.exec_module(route)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--workspace', required=True, type=Path)
parser.add_argument('--dankserver', required=True, type=Path)
parser.add_argument('--output', required=True, type=Path)
args = parser.parse_args()
available = int(next(line.split()[1] for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemAvailable:'))) * 1024
assert available >= 16 * 1024**3
suffix = uuid.uuid4().hex[:12]
network, phoenix, collector, unit = [f'foundation-epoch-{kind}-{suffix}' for kind in ('net', 'phoenix', 'collector', 'worker')]
unit += '.service'
env = dict(os.environ, XDG_RUNTIME_DIR=f'/run/user/{os.getuid()}', DBUS_SESSION_BUS_ADDRESS=f'unix:path=/run/user/{os.getuid()}/bus')
created = []
evidence = {'result': 'failed', 'syntheticOnly': True, 'productionDeployment': False, 'lifecycleAgesUseFixedClock': True, 'images': {'phoenix': route.PHOENIX, 'collector': route.COLLECTOR}}
fixture = args.workspace / 'goals/agent-observability-foundation/ops/epoch-backend-fixture.ts'
template = args.dankserver / 'ansible/roles/monitoring/templates/otel-config.yaml.j2'
evidence['sourceSha256'] = {name: hashlib.sha256(path.read_bytes()).hexdigest() for name, path in [('fixture', fixture), ('template', template), ('verifier', Path(__file__))]}
with tempfile.TemporaryDirectory(prefix='foundation-epoch-') as directory:
    root = Path(directory)
    root.chmod(0o755)
    try:
        route.run(['docker', 'network', 'create', network]); created.append(('network', network))
        created.append(('container', phoenix))
        route.run(['docker', 'run', '-d', '--pull=never', '--name', phoenix, '--network', network,
                   '--memory=2g', '--memory-swap=2g', '--cpus=1', '--pids-limit=128', '--read-only', '--cap-drop=ALL',
                   '--security-opt=no-new-privileges', '--log-driver=none', '--tmpfs=/data:rw,nosuid,size=536870912',
                   '--tmpfs=/tmp:rw,nosuid,size=536870912', '-p', '127.0.0.1::6006', '-e', 'PHOENIX_WORKING_DIR=/data',
                   '-e', 'PHOENIX_ENABLE_AUTH=false', '-e', 'PHOENIX_TELEMETRY_ENABLED=false',
                   '-e', 'PHOENIX_DISABLE_AGENT_ASSISTANT=true', '-e', 'PHOENIX_ALLOWED_SANDBOX_PROVIDERS=NONE', route.PHOENIX])
        route.verify_container(phoenix, 2147483648)
        origin = 'http://' + route.run(['docker', 'port', phoenix, '6006/tcp'])
        route.wait(lambda: route.get(origin + '/healthz'), 60)
        config = yaml.safe_load(jinja2.Environment(undefined=jinja2.StrictUndefined).from_string(template.read_text()).render(
            monitoring_otel_metadata_route_enabled=True, monitoring_otel_phoenix_project='foundation-epoch-proof', monitoring_otel_prometheus_exporter_port=9464))
        config['exporters']['otlphttp/phoenix']['traces_endpoint'] = f'http://{phoenix}:6006/v1/traces'
        path = root / 'collector.yaml'; path.write_text(yaml.safe_dump(config)); path.chmod(0o644)
        queue = root / 'queue'; queue.mkdir(mode=0o700)
        created.append(('container', collector))
        route.run(['docker', 'run', '-d', '--pull=never', '--name', collector, '--network', network,
                   '--user', f'{os.getuid()}:{os.getgid()}', '--memory=512m', '--memory-swap=512m', '--cpus=1', '--pids-limit=128',
                   '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--log-driver=none',
                   '-p', '127.0.0.1::4319', '-p', '127.0.0.1::8888', '-v', f'{path}:/etc/fixture.yaml:ro',
                   '-v', f'{queue}:/var/lib/otelcol/phoenix', route.COLLECTOR, '--config=/etc/fixture.yaml'])
        route.verify_container(collector, 536870912)
        endpoint = 'http://' + route.run(['docker', 'port', collector, '4319/tcp']) + '/v1/traces'
        metrics = 'http://' + route.run(['docker', 'port', collector, '8888/tcp']) + '/metrics'
        route.wait(lambda: b'otelcol_exporter_queue_capacity' in route.get(metrics))
        result = root / 'result.json'
        created.append(('unit', unit))
        route.run(['systemd-run', '--user', '--wait', '--pipe', '--quiet', '--unit', unit, '--slice=agent-runs.slice',
                   '--property=MemoryMax=768M', '--property=MemorySwapMax=0', '--property=CPUQuota=100%',
                   '--property=TasksMax=128', '--property=RuntimeMaxSec=60s', '--property=TimeoutStopSec=5s',
                   '--property=NoNewPrivileges=yes', '--property=UMask=0077', '--working-directory', str(args.workspace),
                   'bun', 'run', str(fixture), str(root/'journal.sqlite'), origin, str(result), endpoint], timeout=75, env=env)
        lifecycle = json.loads(result.read_text())
        evidence['lifecycle'] = lifecycle
        def complete_exports():
            lines = route.get(metrics).decode().splitlines()
            sent = sum(float(line.split()[-1]) for line in lines if line.startswith('otelcol_exporter_sent_spans{') and 'exporter="otlphttp/phoenix"' in line)
            queued = sum(float(line.split()[-1]) for line in lines if line.startswith('otelcol_exporter_queue_size{') and 'exporter="otlphttp/phoenix"' in line)
            return sent == 2 and queued == 0
        route.wait(complete_exports)
        evidence['collectorSuccessfulExports'] = 2
        evidence['collectorQueueDrained'] = True
        route.run(['docker', 'stop', '--time=10', collector])
        # A bounded quiet-window observation, not a permanence guarantee.
        snapshots = []
        for _ in range(3):
            snapshots.append(route.get(origin + '/v1/projects/foundation-epoch-proof/spans?limit=10'))
            time.sleep(1)
        assert all(snapshot == snapshots[0] for snapshot in snapshots)
        evidence['stableBackendSamplesAfterDrain'] = 3
        stored = json.loads(route.get(origin + '/v1/projects/foundation-epoch-proof/spans?limit=10'))
        assert len(stored['data']) == 1 and stored['next_cursor'] is None
        row = stored['data'][0]; attrs = row['attributes']
        evidence['storedSyntheticAttributes'] = attrs
        assert row['context'] == {'trace_id': lifecycle['traceId'], 'span_id': lifecycle['spanId']}
        assert attrs['ai_metrics.event_id'] == lifecycle['stableEventId']
        assert attrs['llm.token_count.total'] == 15
        assert lifecycle['epoch'] == 1 and lifecycle['encodedBytesChanged']
        assert lifecycle['priorWindow']['totals']['visible'] == 1
        assert lifecycle['afterTick']['attempts'] == 1
        assert lifecycle['expired']['_tag'] == 'Some'
        counts = lifecycle['expired']['value']['states']
        if lifecycle['readback']['_tag'] == 'Mismatch':
            assert 'ai_metrics.local_evidence_epoch' not in attrs
            assert lifecycle['state']['state'] == 'accepted-unverified'
            outcome = lifecycle['schedulerTick']['outcomes'][0]
            assert outcome['_tag'] == 'Reconciled' and outcome['result']['_tag'] == 'Mismatch'
            assert lifecycle['syntheticReplayPolicyEnabled']
            assert counts['acceptedUnverified'] == 1 and counts['visible'] == 0
        else:
            assert lifecycle['readback']['_tag'] == 'Visible' and attrs['ai_metrics.local_evidence_epoch'] == 1
            assert counts['visible'] == 1
        evidence.update(result='passed', lifecycle=lifecycle, storedRows=1, storedTokenTotal=15,
                        storedEpoch=attrs.get('ai_metrics.local_evidence_epoch'), backendResponseSha256=hashlib.sha256(json.dumps(stored, sort_keys=True).encode()).hexdigest())
    finally:
        failures = []
        for kind, name in reversed(created):
            if kind == 'unit':
                subprocess.run(['systemctl', '--user', 'stop', name], env=env, capture_output=True, timeout=15)
                probe = subprocess.run(['systemctl', '--user', 'show', name, '-p', 'MainPID', '--value'], env=env, capture_output=True, text=True, timeout=10)
                if probe.returncode != 0 or probe.stdout.strip() not in ('', '0'): failures.append(name)
            else:
                command = ['docker', 'rm', '-f', name] if kind == 'container' else ['docker', 'network', 'rm', name]
                subprocess.run(command, capture_output=True, timeout=20)
                probe = ['docker', 'inspect', name] if kind == 'container' else ['docker', 'network', 'inspect', name]
                if subprocess.run(probe, capture_output=True, timeout=10).returncode == 0: failures.append(name)
        evidence['ownedResourcesRemoved'] = not failures
        if failures: evidence['result'] = 'failed'
        args.output.write_text(json.dumps(evidence, indent=2) + '\n')
        assert not failures, 'Owned cleanup failed'
print(json.dumps({'result': evidence['result'], 'readback': evidence['lifecycle']['readback']['_tag'], 'storedRows': evidence['storedRows']}))
