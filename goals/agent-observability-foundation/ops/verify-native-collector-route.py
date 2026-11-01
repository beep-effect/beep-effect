#!/usr/bin/env python3
"""Synthetic projector/journal -> collector queue -> isolated Phoenix proof."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import uuid
import http.server
import threading

import jinja2
import yaml

PHOENIX = 'arizephoenix/phoenix@sha256:c542e7de1dc1fdd0f938de337d44ebefa7266e91391eed6e7978523d7f6e1f2f'
COLLECTOR = 'otel/opentelemetry-collector-contrib@sha256:1175b03003053962012f5a231f5567f66a3e8fdb960c7835c0e48f7aa1555806'
CANARY = b'synthetic-private'


def run(argv, timeout=30, env=None, cwd=None):
    result = subprocess.run(argv, capture_output=True, text=True, timeout=timeout, env=env, cwd=cwd)
    if result.returncode:
        raise RuntimeError(f'Owned synthetic command failed ({result.returncode}): {(result.stderr + result.stdout)[-2000:]}')
    return result.stdout.strip()


def get(url, data=None):
    req = urllib.request.Request(url, data=None if data is None else json.dumps(data).encode(),
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=3) as reply:
        body = reply.read(1048577)
        assert len(body) <= 1048576
        return body


def wait(check, seconds=45):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            result = check()
            if result:
                return result
        except (OSError, urllib.error.URLError):
            pass
        time.sleep(0.2)
    raise AssertionError('Synthetic readiness deadline exceeded')


def verify_container(name, memory):
    info = json.loads(run(['docker', 'inspect', name]))[0]
    config = info['HostConfig']
    assert config['Memory'] == config['MemorySwap'] == memory
    assert config['NanoCpus'] == 1000000000 and config['PidsLimit'] == 128
    assert config['ReadonlyRootfs'] and config['CapDrop'] == ['ALL']
    assert info['State']['Running'] and not info['State']['OOMKilled']
    for bindings in info['NetworkSettings']['Ports'].values():
        if bindings:
            assert all(binding['HostIp'] == '127.0.0.1' for binding in bindings)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workspace', required=True, type=Path)
    parser.add_argument('--dankserver', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--replay-qualification', type=Path, help='Explicit prior duplicate proof matching exact images and current collector template')
    parser.add_argument('--include-reconstructed', action='store_true', help='Qualify explicit reconstructed occurrences alongside native spans')
    parser.add_argument('--exercise-qualified-recovery', action='store_true', help='Drop one synthetic transport request after the project exists, then prove query-first qualified replay')
    args = parser.parse_args()
    token = uuid.uuid4().hex[:12]
    network, phoenix, collector, unit = (f'foundation-route-{kind}-{token}' for kind in ('net', 'phoenix', 'otel', 'worker'))
    unit += '.service'
    created = []
    proxy = None
    proxy_thread = None
    proxy_digests = []
    env = {**os.environ, 'XDG_RUNTIME_DIR': f'/run/user/{os.getuid()}',
           'DBUS_SESSION_BUS_ADDRESS': f'unix:path=/run/user/{os.getuid()}/bus'}
    evidence = {'syntheticOnly': True, 'productionDeployment': False, 'result': 'failed',
                'images': {'phoenix': PHOENIX, 'collector': COLLECTOR},
                'fullGoalComplete': False, 'deliberateOomExercise': False}
    temporary = tempfile.TemporaryDirectory(prefix='foundation-route-')
    root = Path(temporary.name)
    root.chmod(0o755)
    try:
        for image in (PHOENIX, COLLECTOR):
            run(['docker', 'image', 'inspect', image])
        run(['docker', 'network', 'create', network])
        created.append(('network', network))
        created.append(('container', phoenix))
        run(['docker', 'run', '-d', '--pull=never', '--name', phoenix, '--network', network,
             '--memory=2g', '--memory-swap=2g', '--cpus=1', '--pids-limit=128', '--read-only',
             '--cap-drop=ALL', '--security-opt=no-new-privileges', '--log-driver=none',
             '--tmpfs=/data:rw,nosuid,size=536870912', '--tmpfs=/tmp:rw,nosuid,size=536870912',
             '-p', '127.0.0.1::6006', '-e', 'PHOENIX_WORKING_DIR=/data',
             '-e', 'PHOENIX_ENABLE_AUTH=false', '-e', 'PHOENIX_TELEMETRY_ENABLED=false',
             '-e', 'PHOENIX_DISABLE_AGENT_ASSISTANT=true', '-e', 'PHOENIX_ALLOWED_SANDBOX_PROVIDERS=NONE', PHOENIX])
        verify_container(phoenix, 2147483648)
        origin = 'http://' + run(['docker', 'port', phoenix, '6006/tcp'])
        wait(lambda: get(origin + '/healthz'), 60)
        template = args.dankserver / 'ansible/roles/monitoring/templates/otel-config.yaml.j2'
        rendered = jinja2.Environment(undefined=jinja2.StrictUndefined).from_string(template.read_text()).render(
            monitoring_otel_metadata_route_enabled=True,
            monitoring_otel_phoenix_project='foundation-synthetic-proof', monitoring_otel_prometheus_exporter_port=9464)
        config = yaml.safe_load(rendered)
        config['exporters']['otlphttp/phoenix']['traces_endpoint'] = f'http://{phoenix}:6006/v1/traces'
        path = root / 'collector.yaml'
        path.write_text(yaml.safe_dump(config))
        path.chmod(0o644)
        queue = root / 'queue'
        queue.mkdir(mode=0o700)
        created.append(('container', collector))
        run(['docker', 'run', '-d', '--pull=never', '--name', collector, '--network', network,
             '--user', f'{os.getuid()}:{os.getgid()}', '--memory=512m', '--memory-swap=512m',
             '--cpus=1', '--pids-limit=128', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges',
             '--log-driver=none', '-p', '127.0.0.1::4318', '-p', '127.0.0.1::4319', '-p', '127.0.0.1::8888',
             '-v', f'{path}:/etc/fixture.yaml:ro', '-v', f'{queue}:/var/lib/otelcol/phoenix',
             COLLECTOR, '--config=/etc/fixture.yaml'])
        verify_container(collector, 536870912)
        evidence['containerResourceLimitsVerified'] = True
        export = 'http://' + run(['docker', 'port', collector, '4319/tcp']) + '/v1/traces'
        legacy = 'http://' + run(['docker', 'port', collector, '4318/tcp']) + '/v1/traces'
        telemetry = 'http://' + run(['docker', 'port', collector, '8888/tcp']) + '/metrics'
        wait(lambda: b'otelcol_exporter_queue_capacity' in get(telemetry))
        # The raw trace endpoint must not acknowledge data into the disk queue.
        def legacy_ready():
            try:
                get(legacy, {'resourceSpans': []})
                raise AssertionError('Raw legacy trace endpoint unexpectedly accepted data')
            except urllib.error.HTTPError as error:
                status = error.code
                error.close()
                assert status == 404
                return True
        wait(legacy_ready)
        # Raw input on the internal metadata route is excluded, not durable
        # acceptance. Its HTTP 200 must not be interpreted as backend visibility.
        raw = {'resourceSpans': [{'scopeSpans': [{'spans': [{
            'traceId': '8' * 32, 'spanId': '8' * 16, 'name': 'claude_code.llm_request',
            'startTimeUnixNano': '1793000000000000001', 'endTimeUnixNano': '1793000000100000001',
            'attributes': [{'key': 'input.value', 'value': {'stringValue': 'synthetic-private-unprojected'}}],
        }]}]}]}
        wait(lambda: get(export, raw) is not None)
        invalid_guards = [
            ('native-export/v1', 'reconstructed', 'observed.message', []),
            ('transcript-export/v1', 'native', 'agent.llm', []),
            ('transcript-export/v1', 'reconstructed', 'agent.llm', []),
            ('transcript-export/v0', 'reconstructed', 'observed.message', []),
            ('transcript-export/v1', 'reconstructed', 'observed.unrecognized', []),
            ('native-export/v1', 'native', 'fixture.cli.llm', []),
            ('native-export/v1', 'native', 'fixture.mobile.llm', []),
        ]
        fixture_attrs = [
            {'key': 'ai_metrics.synthetic', 'value': {'boolValue': True}},
            {'key': 'ai_metrics.fixture.surface', 'value': {'stringValue': 'desktop'}},
            {'key': 'ai_metrics.fixture.provenance', 'value': {'stringValue': 'declared_synthetic_fixture'}},
        ]
        invalid_guards.extend([
            ('native-export/v1', 'native', 'fixture.cli.llm', fixture_attrs),
            ('native-export/v1', 'native', 'agent.llm', fixture_attrs),
        ])
        for index, (version, stream, name, extra) in enumerate(invalid_guards):
            guard_probe = {'resourceSpans': [{
                'resource': {'attributes': [{'key': 'service.name', 'value': {'stringValue': 'beep-agent-observability'}}]},
                'scopeSpans': [{'scope': {'name': 'beep.agent-observation', 'version': version}, 'spans': [{
                    'traceId': f'{index+10:032x}', 'spanId': f'{index+10:016x}', 'name': name,
                    'startTimeUnixNano': '1793000000000000001', 'endTimeUnixNano': '1793000000000000001',
                    'attributes': [{'key': 'ai_metrics.stream', 'value': {'stringValue': stream}}, *extra],
                }]}],
            }]}
            get(export, guard_probe)
        def filtered():
            lines = get(telemetry).decode().splitlines()
            return any(line.startswith('otelcol_processor_filter_spans_filtered{') and float(line.split()[-1]) >= 1 + len(invalid_guards)
                       for line in lines)
        wait(filtered)
        evidence['unprojectedMetadataRouteSpanFilteredAndCounted'] = True
        evidence['invalidProjectionCombinationsFiltered'] = len(invalid_guards)
        database, expected = root / 'journal.sqlite', root / 'expected.json'
        fixture = args.workspace / 'packages/tooling/library/ai-metrics/test/fixtures/native-phoenix-proof.ts'
        recovery_arguments = ['reconstructed'] if args.include_reconstructed else []
        fixture_export = export
        if args.exercise_qualified_recovery:
            qualification_path = args.replay_qualification or args.workspace / 'goals/agent-observability-foundation/ops/native-duplicate-replay-verification.json'
            qualification = json.loads(qualification_path.read_text())
            assert qualification['result'] == 'passed' and qualification['images'] == evidence['images']
            assert qualification['templateSha256'] == hashlib.sha256(template.read_bytes()).hexdigest()
            assert qualification['explicitDuplicateReplay']['identicalPayloadDigests']
            qualification_digest = hashlib.sha256(qualification_path.read_bytes()).hexdigest()
            class DropFirst(http.server.BaseHTTPRequestHandler):
                def log_message(self, *_args):
                    pass
                def do_POST(self):
                    self.connection.settimeout(5)
                    length = int(self.headers.get('Content-Length', '0'))
                    if self.path != '/v1/traces' or not 0 < length <= 1048576:
                        self.send_error(400)
                        return
                    body = self.rfile.read(length)
                    if len(body) != length:
                        self.close_connection = True
                        return
                    proxy_digests.append(hashlib.sha256(body).hexdigest())
                    if len(proxy_digests) == 3:
                        # Preserve uncertainty at the sender: no upstream send
                        # and no acknowledgment. Subsequent requests pass through.
                        self.close_connection = True
                        return
                    request = urllib.request.Request(export, data=body, headers={'Content-Type': 'application/x-protobuf'})
                    with urllib.request.urlopen(request, timeout=5) as response:
                        reply = response.read(65537)
                        assert len(reply) <= 65536
                        self.send_response(response.status)
                        self.send_header('Content-Type', response.headers.get('Content-Type', 'application/x-protobuf'))
                        self.send_header('Content-Length', str(len(reply)))
                        self.end_headers()
                        self.wfile.write(reply)
            proxy = http.server.HTTPServer(('127.0.0.1', 0), DropFirst)
            proxy_thread = threading.Thread(target=proxy.serve_forever, daemon=True)
            proxy_thread.start()
            fixture_export = f'http://127.0.0.1:{proxy.server_port}/v1/traces'
            recovery_arguments = ['reconstructed' if args.include_reconstructed else 'native', qualification_digest]
        # A bounded actual process runs the existing positive projector, durable
        # journal, sender and read-back against distinct export/query origins.
        created.append(('unit', unit))
        run(['systemd-run', '--user', '--wait', '--pipe', '--quiet', '--unit', unit,
             '--slice=agent-runs.slice', '--property=MemoryMax=768M', '--property=MemorySwapMax=0', '--property=CPUQuota=100%',
             '--property=TasksMax=128', '--property=RuntimeMaxSec=60s', '--property=TimeoutStopSec=10s',
             '--property=KillMode=control-group', '--property=NoNewPrivileges=yes', '--property=UMask=0077',
             '--working-directory', str(args.workspace), '/usr/bin/env', 'bun', 'run', str(fixture),
             str(database), origin + '/v1/traces', str(expected), fixture_export] + recovery_arguments, timeout=75, env=env)
        evidence['boundedProjectionProcessCompleted'] = True
        verifier = args.workspace / 'goals/agent-observability-foundation/ops/verify-phoenix-native-proof.py'
        scheduled = json.loads(expected.read_text())['observations']
        assert len(scheduled) == 3 and all(row['automaticScheduling'] and row['readbackPasses'] >= 1 for row in scheduled)
        evidence['automaticSchedulingVerified'] = True
        if args.exercise_qualified_recovery:
            assert scheduled[1]['qualifiedRecovery'] and scheduled[1]['initialState']['state'] == 'unresolved'
            assert scheduled[1]['state']['state'] == 'visible' and scheduled[1]['state']['attempts'] == 3
            assert proxy_digests[2] == proxy_digests[3]
            assert scheduled[1]['interruptedAttemptId'] != scheduled[1]['result']['attemptId']
            evidence['qualifiedRecovery'] = {'result': 'passed', 'initialState': 'unresolved', 'finalState': 'visible',
                'oneRequestDroppedBeforeUpstream': True, 'schedulerReconstructed': True,
                'freshAttemptWithIdenticalPayload': True, 'qualificationDigest': qualification_digest,
                'notProcessCrashProof': True, 'notRealHarnessCoverage': True}

        reconstructed = json.loads(expected.read_text()).get('reconstructedObservations', [])
        assert len(reconstructed) == (6 if args.include_reconstructed else 0)
        if args.exercise_qualified_recovery:
            # Count both sides of the fault boundary. The dropped request is a
            # real sender attempt, but never reaches the collector or Phoenix.
            assert len(proxy_digests) == 7 + len(reconstructed)
        assert all(row['automaticScheduling'] and row['readbackPasses'] >= 1 for row in reconstructed)
        assert all(row['identicalReplayPayload'] and row['repeatedAttemptId'] != row['result']['attemptId'] for row in scheduled)
        def replays_exported():
            samples = get(telemetry).decode().splitlines()
            return any(line.startswith('otelcol_exporter_sent_spans{') and 'exporter="otlphttp/phoenix"' in line
                       and float(line.split()[-1]) >= 6 + len(reconstructed) for line in samples)
        wait(replays_exported)
        # Transport completion precedes asynchronous Phoenix ingestion. Check
        # after a bounded quiet interval and again after the collector stops.
        time.sleep(2)
        readback = root / 'readback.json'
        run(['/usr/bin/python', str(verifier), '--endpoint', origin, '--expected', str(expected), '--output', str(readback)])
        evidence['readback'] = json.loads(readback.read_text())
        stored = get(origin + '/v1/projects/foundation-synthetic-proof/spans?limit=10')
        assert CANARY not in stored
        # Force a normal collector shutdown before examining its persistent file.
        run(['docker', 'stop', '--time=10', collector])
        assert not json.loads(run(['docker', 'inspect', collector]))[0]['State']['OOMKilled']
        verify_container(phoenix, 2147483648)
        time.sleep(1)
        after_replay = json.loads(get(origin + '/v1/projects/foundation-synthetic-proof/spans?limit=10'))
        assert len(after_replay['data']) == 3 + len(reconstructed) and after_replay['next_cursor'] is None
        evidence['explicitDuplicateReplay'] = {'nativeTransportAttempts': 7 if args.exercise_qualified_recovery else 6,
                                               'nativeDroppedBeforeUpstream': 1 if args.exercise_qualified_recovery else 0,
                                               'nativeUpstreamSubmissions': 6,
                                               'uniqueNativeSpansAfterReplay': 3,
                                               'identicalPayloadDigests': True,
                                               'collectorExportCounterVerified': True,
                                               'backendScope': 'exact pinned Phoenix image, immutable project and byte-identical span identities'}
        files = list(queue.iterdir())
        assert len(files) == 1 and files[0].stat().st_size <= 67108864
        for file in [database, *files]:
            assert file.stat().st_size <= 67108864
            assert CANARY not in file.read_bytes()
        evidence.update(result='passed', storedSpans=3+len(reconstructed), nativeSpans=3, reconstructedSpans=len(reconstructed), rawTraceEndpointRefused=True,
                        distinctExportAndReadbackOrigins=True, privateCanariesAbsentFromJournalQueueAndBackend=True,
                        metadataReceiverHostPublishedInProduction=False,
                        collectorGuardIsAuthentication=False, collectorGuardIsSanitizer=False,
                        actualHarnessEnrollment=False,
                        templateSha256=hashlib.sha256(template.read_bytes()).hexdigest(),
                        fixtureSha256=hashlib.sha256(fixture.read_bytes()).hexdigest())
    finally:
        if proxy is not None:
            proxy.shutdown()
            proxy.server_close()
            proxy_thread.join(timeout=6)
            assert not proxy_thread.is_alive()
        failures = []
        for kind, name in reversed(created):
            if kind == 'unit':
                subprocess.run(['systemctl', '--user', 'stop', name], env=env, capture_output=True, timeout=15)
                subprocess.run(['systemctl', '--user', 'reset-failed', name], env=env, capture_output=True, timeout=15)
                state = subprocess.run(['systemctl', '--user', 'show', name, '-p', 'MainPID', '--value'],
                                       env=env, capture_output=True, text=True, timeout=10)
                if state.returncode != 0 or state.stdout.strip() not in ('', '0'):
                    failures.append(name)
            else:
                command = ['docker', 'rm', '-f', name] if kind == 'container' else ['docker', 'network', 'rm', name]
                subprocess.run(command, capture_output=True, timeout=20)
                probe = ['docker', 'inspect', name] if kind == 'container' else ['docker', 'network', 'inspect', name]
                if subprocess.run(probe, capture_output=True, timeout=10).returncode == 0:
                    failures.append(name)
        evidence['ownedResourcesRemoved'] = not failures
        if failures:
            evidence['result'] = 'failed'
        args.output.write_text(json.dumps(evidence, indent=2) + '\n')
        args.output.chmod(0o600)
        temporary.cleanup()
        assert not failures, 'Synthetic resource cleanup failed'
    print('PASS: sanitized journal -> persistent collector -> Phoenix identity/usage/time read-back; invalid projections refused')


if __name__ == '__main__':
    main()
