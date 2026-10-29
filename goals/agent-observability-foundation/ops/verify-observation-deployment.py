#!/usr/bin/env python3
"""Install and remove only uniquely named synthetic user units; retain proof artifacts.
The explicit --live-canary option writes synthetic metadata to the tailnet backend.
No real source, provider, secret or historical service is enrolled.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import http.client
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
import uuid

parser = argparse.ArgumentParser()
parser.add_argument('--workspace', required=True, type=Path)
parser.add_argument('--caddy', required=True, type=Path)
parser.add_argument('--live-canary', action='store_true', help='Explicitly send two synthetic metadata records to the tailnet Phoenix through an isolated collector')
parser.add_argument('--dankserver', type=Path)
parser.add_argument('--health-proof', action='store_true', help='Independently scrape actual worker metrics and receive its stopped-worker alert locally')
args = parser.parse_args()
workspace = args.workspace.resolve(strict=True)
caddy = args.caddy.resolve(strict=True)
assert hashlib.sha256(caddy.read_bytes()).hexdigest() == '678ade3bfc088749c81a681adc603333ee0bb023b6a6cfe3c0f58bef8ff854e9'
root = Path(tempfile.mkdtemp(prefix='obs-deploy-', dir='/tmp')); root.chmod(0o700)
artifacts = root/'artifacts space'; artifacts.mkdir(mode=0o700)
state = root/'state'; state.mkdir(mode=0o700)
env = dict(os.environ, XDG_RUNTIME_DIR=f'/run/user/{os.getuid()}', DBUS_SESSION_BUS_ADDRESS=f'unix:path=/run/user/{os.getuid()}/bus')
# The real service receives this synthetic private environment file only.
for name in ['BEEP_AI_METRICS_HASH_SALT', 'BEEP_AI_METRICS_RAW_ARCHIVE_KEY', 'BEEP_OBSERVATION_PHOENIX_API_KEY']:
    env.pop(name, None)
unit_base = 'beep-observation-deploy-' + uuid.uuid4().hex[:12]
installed = {}
live = None
health_proof = None
evidence = {'recordedAt': datetime.now(timezone.utc).isoformat(), 'result': 'incomplete', 'syntheticOnly': True,
            'productionRollout': False, 'goalComplete': False, 'artifactRoot': str(root), 'deliberateMemoryExhaustion': False}

def command(argv, check=True, timeout=30):
    result = subprocess.run(argv, cwd=workspace, env=env, stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=timeout, check=False)
    if check and result.returncode:
        raise RuntimeError(f"{argv[0]} failed ({result.returncode}): {result.stderr[-3000:]} {result.stdout[-1000:]}")
    return result

def private_write(path, text):
    with path.open('x') as f:
        path.chmod(0o600); f.write(text); f.flush(); os.fsync(f.fileno())

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def show(unit):
    value = command(['systemctl', '--user', 'show', unit, '-p', 'MainPID', '-p', 'ActiveState', '-p', 'Result', '-p', 'ControlGroup'])
    return dict(line.split('=', 1) for line in value.stdout.splitlines() if '=' in line)

def private_request(method, path, data=None, headers=None):
    class UnixConnection(http.client.HTTPConnection):
        def connect(self):
            self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            self.sock.settimeout(3); self.sock.connect(str(state/'worker.sock'))
    connection = UnixConnection('localhost', timeout=3)
    try:
        connection.request(method, path, data, headers or {})
        response = connection.getresponse(); body = response.read(65537)
        assert len(body) <= 65536
        return response.status, body
    finally: connection.close()

def public_request(method, path, body=b'', headers=None):
    connection = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
    try:
        connection.request(method, path, body, headers or {})
        response = connection.getresponse(); data = response.read(65537)
        assert len(data) <= 65536
        return response.status, data
    finally: connection.close()

def source_hashes():
    source_files = [workspace/'packages/tooling/tool/cli/src/commands/AIMetrics/ObservationWorker.entry.ts',
                    workspace/'packages/tooling/tool/cli/src/commands/AIMetrics/internal/ObservationDeployment.ts',
                    workspace/'packages/tooling/tool/cli/src/commands/AIMetrics/internal/ObservationWorker.ts',
                    workspace/'packages/tooling/tool/cli/src/commands/AIMetrics/AIMetrics.command.ts', Path(__file__).resolve()]
    if args.live_canary: source_files.append(Path(__file__).with_name('live_canary_support.py').resolve())
    if args.health_proof: source_files.append(Path(__file__).with_name('observation_health_support.py').resolve())
    source_files.extend(sorted((workspace/'packages/tooling/library/ai-metrics/src').rglob('*.ts')))
    return {str(p.relative_to(workspace)): sha(p) for p in source_files}

initial_source_hashes = source_hashes()

try:
    if args.live_canary:
        assert args.dankserver is not None
        from live_canary_support import LiveCanary
        live = LiveCanary(root, args.dankserver.resolve(strict=True), command)
        live.start()
        evidence['liveCanary'] = live.evidence
    bun = Path(command([shutil.which('bun'), '--no-env-file', '-p', 'process.execPath']).stdout.strip()).resolve(strict=True)
    entry = workspace/'packages/tooling/tool/cli/src/commands/AIMetrics/ObservationWorker.entry.ts'
    build = command([str(bun), 'build', str(entry), '--target=bun', '--outfile', str(artifacts/'worker.mjs')], timeout=45)
    private_write(root/'bundle-build.log', build.stdout + build.stderr)
    assert 'will always be undefined' not in build.stderr, 'Bundled entrypoint has an unresolved import'
    shutil.copyfile(caddy, artifacts/'caddy'); (artifacts/'caddy').chmod(0o500)
    private_write(root/'synthetic-salt', 'synthetic-launch-proof-salt')
    writer = workspace/'packages/tooling/library/ai-metrics/test/fixtures/write-observation-launch.ts'
    command([str(bun), '--no-env-file', str(writer), str(state), 'http://127.0.0.1:9', '-'])
    if live:
        live.configure(state/'worker.json')
    launch_config = json.loads((state/'worker.json').read_text())
    launch_config['intake']['maxDatabasePages'] = 1024
    (state/'worker.json').write_text(json.dumps(launch_config))
    evidence['nonMinimalJournalPages'] = 1024
    private_write(state/'worker.lock', '')
    with socket.socket() as reservation:
        reservation.bind(('127.0.0.1', 0)); port = reservation.getsockname()[1]
    request = {'version': 'observation-deployment-request/v1', 'unitBase': unit_base,
               'stateDirectory': str(state), 'artifactDirectory': str(artifacts), 'bunPath': str(bun),
               'hashSaltFile': str(root/'synthetic-salt'), 'intakePort': port, 'runtimeMaxSeconds': 120, 'journalMaxDatabasePages': 1024}
    if not live:
        private_write(root/'synthetic-api-key', 'synthetic-query-credential')
        request['phoenixApiKeyFile'] = str(root/'synthetic-api-key')
    private_write(root/'deployment-request.json', json.dumps(request))
    rendered = command([str(bun), '--no-env-file', 'packages/tooling/tool/cli/src/bin.ts',
                        'ai-metrics', 'install', 'observation-plan', '--input', str(root/'deployment-request.json')])
    assert len(rendered.stdout.encode()) <= 32768
    plan = json.loads(rendered.stdout)
    private_write(artifacts/'intake.json', plan['intakeConfig'])
    private_write(artifacts/'worker.sha256', ''.join(f'{sha(p)}  {p}\n' for p in [artifacts/'worker.mjs', bun, state/'worker.json']))
    private_write(artifacts/'intake.sha256', ''.join(f'{sha(p)}  {p}\n' for p in [artifacts/'caddy', artifacts/'intake.json']))
    command([str(artifacts/'caddy'), 'validate', '--config', str(artifacts/'intake.json')])
    units_root = Path.home()/'.config/systemd/user'; assert units_root.is_dir()
    for key, name_key in [('workerUnit', 'workerUnitName'), ('intakeUnit', 'intakeUnitName')]:
        name = plan[name_key]; assert name.startswith(unit_base) and name.endswith('.service')
        target = units_root/name
        # Poison only these owned units with unrelated synthetic variables;
        # env --ignore-environment must keep them out of both real processes.
        content = plan[key].replace('[Service]\n', '[Service]\nEnvironment=UNRELATED_SYNTHETIC_SECRET=PRIVATE-UNKNOWN-CANARY BEEP_AI_METRICS_HASH_SALT=PRIVATE-WRONG-SALT BEEP_AI_METRICS_RAW_ARCHIVE_KEY=PRIVATE-ARCHIVE-CANARY\n')
        private_write(target, content); installed[name] = content
    command(['systemd-analyze', '--user', 'verify', *[str(units_root/name) for name in installed]])
    command(['systemctl', '--user', 'daemon-reload'])
    worker = plan['workerUnitName']; intake = plan['intakeUnitName']
    command(['systemctl', '--user', 'start', worker])
    deadline = time.monotonic() + 10
    while True:
        try:
            status, data = private_request('GET', '/health')
            if status == 200: break
        except (OSError, http.client.HTTPException): pass
        assert time.monotonic() < deadline, 'Installed worker did not become ready'
        time.sleep(.1)
    health = json.loads(data)
    shared_autosave = Path.home()/'.config/caddy/autosave.json'
    shared_before = shared_autosave.read_bytes() if shared_autosave.exists() else None
    command(['systemctl', '--user', 'start', intake])
    deadline = time.monotonic() + 10
    while True:
        try:
            status, _ = public_request('GET', '/health')
            if status == 404: break
        except (OSError, http.client.HTTPException): pass
        assert time.monotonic() < deadline, 'Installed intake did not become ready'
        time.sleep(.1)
    shared_after = shared_autosave.read_bytes() if shared_autosave.exists() else None
    assert shared_after == shared_before, 'Frontend changed shared Caddy autosave'
    assert not (state/'frontend-config/caddy/autosave.json').exists(), 'Frontend persisted configuration unexpectedly'
    denied = {}
    for method, path in [('GET', '/health'), ('GET', '/metrics'), ('POST', '/control/resume'), ('POST', '/control/pause'),
                         ('GET', '/v1/traces'), ('POST', '/v1/traces/'), ('POST', '/v1/launches'), ('POST', '/maintenance'), ('GET', '/maintenance')]:
        status, _ = public_request(method, path)
        assert status == 404, f'Private route exposed: {method} {path}'
        denied[f'{method} {path}'] = status
    context_status, context_data = private_request('GET', '/maintenance')
    assert context_status == 200
    maintenance_context = json.loads(context_data)
    def maintain(operation, **fields):
        request = {'version': 'observation-maintenance/v1',
                   'hostId': launch_config['intake']['hostId'],
                   'namespaceId': launch_config['intake']['namespaceId'],
                   'targetId': maintenance_context['targetId'],
                   'ownerInstanceId': maintenance_context['ownerInstanceId'],
                   'command': {'_tag': operation, **fields}}
        return private_request('POST', '/maintenance', json.dumps(request).encode(), {'Content-Type': 'application/json'})
    assert maintain('Window')[0] == 200
    assert private_request('DELETE', '/maintenance')[0] == 405
    assert private_request('POST', '/maintenance', b'{}', {'Content-Type': 'text/plain'})[0] == 415
    assert private_request('POST', '/maintenance', b'\xff', {'Content-Type': 'application/json'})[0] == 400
    assert private_request('POST', '/maintenance', b'x'*4097, {'Content-Type': 'application/json'})[0] == 413
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as incomplete:
        incomplete.settimeout(3); incomplete.connect(str(state/'worker.sock'))
        incomplete.sendall(b'POST /maintenance HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: 1000\r\n\r\n{')
        deadline = time.monotonic() + .7
        while maintain('Window')[0] != 503:
            assert time.monotonic() < deadline, 'Concurrent maintenance was not refused'
            time.sleep(.02)
        assert b'408' in incomplete.recv(4096), 'Incomplete maintenance body did not time out'
    assert maintain('Window')[0] == 200
    assert maintain('Pages', afterSequence=0) == (200, b'[]')
    assert private_request('POST', '/control/resume')[0] == 200
    assert maintain('Backup', slot=0)[0] == 503
    assert not (state/'backup-0').exists()
    assert private_request('POST', '/control/pause')[0] == 200
    backup_status, backup_data = maintain('Backup', slot=0)
    assert backup_status == 200
    backup_receipt = json.loads(backup_data)
    manifest_before = (state/'backup-0/manifest.json').read_bytes()
    assert hashlib.sha256(manifest_before).hexdigest() == backup_receipt['manifestDigest']
    assert maintain('Backup', slot=0)[0] == 503
    assert (state/'backup-0/manifest.json').read_bytes() == manifest_before
    assert maintain('Backup', slot=4)[0] == 400
    assert maintain('Backup', slot=1, directory='synthetic-private')[0] == 400
    assert maintain('Seal', epoch=0) == (200, b'null')
    assert maintain('RestoreEvidence', digest='f'*64)[0] == 503
    assert json.loads(private_request('GET', '/health')[1])['control']['accepting'] is False
    evidence['privateMaintenance'] = {'result': 'passed', 'publicRouteDenied': True,
        'activeBackupRefused': True, 'pausedBackupCreated': True, 'backupReceipt': backup_receipt,
        'occupiedSlotPreserved': True, 'invalidSlotAndDestinationRefused': True,
        'emptyWindowSealHeld': True, 'unknownRestoreRefused': True, 'workerRemainsPaused': True,
        'bodyLimitAndUtf8Refusal': True, 'bodyDeadlineAndNoQueue': True,
        'actualAgeBasedExpiryExercised': False}
    paused_status, _ = public_request('POST', '/v1/traces', b'\x00', {'Content-Type': 'application/x-protobuf'})
    assert paused_status == 503, 'Installed worker must stay paused until explicit private control'
    oversized_status, _ = public_request('POST', '/v1/traces', headers={'Content-Length': '262145'})
    assert oversized_status == 413
    started = time.monotonic()
    with socket.create_connection(('127.0.0.1', port), timeout=5) as connection:
        connection.settimeout(5); connection.sendall(b'POST /v1/traces HTTP/1.1\r\nHost: localhost\r\nX-Probe: ')
        reply = connection.recv(4096)
        assert not reply or b'408' in reply or b'400' in reply
    header_seconds = time.monotonic()-started
    assert header_seconds < 5
    worker_state = show(worker); intake_state = show(intake)
    # A response on the selected port is insufficient if another process won it.
    listener_inodes = {line.split()[9] for line in Path('/proc/net/tcp').read_text().splitlines()[1:]
                       if line.split()[1] == f'0100007F:{port:04X}' and line.split()[3] == '0A'}
    descriptors = list(Path(f"/proc/{intake_state['MainPID']}/fd").iterdir()); assert len(descriptors) <= 128
    owned_sockets = set()
    for descriptor in descriptors:
        try: target = os.readlink(descriptor)
        except FileNotFoundError: continue
        if target.startswith('socket:['): owned_sockets.add(target[8:-1])
    assert listener_inodes and listener_inodes <= owned_sockets, 'Response listener was not the installed frontend'

    process_env = Path(f"/proc/{worker_state['MainPID']}/environ").read_bytes()
    assert b'PRIVATE-' not in process_env and b'synthetic-launch-proof-salt' not in process_env
    process_args = Path(f"/proc/{worker_state['MainPID']}/cmdline").read_bytes()
    assert b'PRIVATE-' not in process_args and b'synthetic-launch-proof-salt' not in process_args and b'synthetic-query-credential' not in process_args
    assert b'synthetic-query-credential' not in process_env
    assert b'PRIVATE-' not in data and b'synthetic-launch-proof-salt' not in data and b'synthetic-query-credential' not in data
    worker_env_names = {entry.split(b'=', 1)[0].decode() for entry in process_env.split(b'\0') if entry}
    assert worker_env_names == {'PATH', 'CREDENTIALS_DIRECTORY'}, worker_env_names
    intake_env = Path(f"/proc/{intake_state['MainPID']}/environ").read_bytes()
    intake_env_names = {entry.split(b'=', 1)[0].decode() for entry in intake_env.split(b'\0') if entry}
    assert intake_env_names == {'PATH', 'GOMEMLIMIT', 'GOMAXPROCS', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME'}, intake_env_names
    assert b'PRIVATE-' not in intake_env
    evidence['positiveEnvironmentIsolation'] = {'workerKeys': sorted(worker_env_names), 'intakeKeys': sorted(intake_env_names), 'credentialFilesUsed': True, 'arbitrarySecretCanaryAbsent': True, 'secretsAbsentFromArgvAndHealth': True, 'optionalQueryCredentialTested': not bool(live)}

    worker_limits = Path(f"/proc/{worker_state['MainPID']}/limits").read_text()
    file_limit = next(line.split() for line in worker_limits.splitlines() if line.startswith('Max file size'))
    assert file_limit[3:5] == ['8388608', '8388608']
    evidence['workerFileLimitBytes'] = 8388608
    limits = {}
    for label, current in [('worker', worker_state), ('intake', intake_state)]:
        group = Path('/sys/fs/cgroup'+current['ControlGroup'])
        limits[label] = {key: (group/key).read_text().strip() for key in ['memory.max', 'memory.swap.max', 'cpu.max', 'pids.max']}
    if live:
        live.exercise(state, private_request, public_request)
    if args.health_proof:
        assert args.dankserver is not None
        from observation_health_support import ObservationHealthProof
        health_proof = ObservationHealthProof(root, args.dankserver.resolve(strict=True), state, command)
        health_proof.start()
    command(['systemctl', '--user', 'stop', worker])
    assert show(worker)['MainPID'] == show(intake)['MainPID'] == '0', 'Dependent intake survived worker shutdown'
    if health_proof:
        health_proof.worker_stopped()
    command(['systemctl', '--user', 'start', worker])
    deadline = time.monotonic() + 10
    while True:
        try:
            context_status, context_data = private_request('GET', '/maintenance')
            if context_status == 200: break
        except (OSError, http.client.HTTPException): pass
        assert time.monotonic() < deadline, 'Restarted maintenance context unavailable'
        time.sleep(.1)
    fresh_context = json.loads(context_data)
    assert fresh_context['ownerInstanceId'] != maintenance_context['ownerInstanceId']
    assert all(fresh_context[key] == maintenance_context[key] for key in ['hostId', 'namespaceId', 'targetId'])
    assert maintain('Window')[0] == 409, 'Stale process context accepted after restart'
    maintenance_context = fresh_context
    assert maintain('Window')[0] == 200
    assert maintain('Backup', slot=0)[0] == 503
    assert (state/'backup-0/manifest.json').read_bytes() == manifest_before
    evidence['privateMaintenance']['staleContextRefusedAfterRestart'] = True
    evidence['privateMaintenance']['backupPreservedAcrossRestart'] = True
    command(['systemctl', '--user', 'stop', worker])
    # Installed startup must reject invalid credentials before opening or
    # changing the existing journal, even with a poisoned ambient environment.
    credential_refusals = []
    salt_path = root/'synthetic-salt'
    original_salt = salt_path.read_bytes()
    journal_before_credentials = sha(state/'journal.sqlite')
    try:
        for label, invalid in [('empty', b''), ('oversized', b'x'*4097), ('invalid-utf8', b'\xff'), ('newline', b'synthetic-invalid\n')]:
            salt_path.write_bytes(invalid)
            command(['systemctl', '--user', 'reset-failed', worker], check=False)
            command(['systemctl', '--user', 'start', worker], check=False)
            deadline = time.monotonic() + 5
            while True:
                refused_state = show(worker)
                if refused_state['MainPID'] == '0' and refused_state['ActiveState'] == 'failed': break
                assert time.monotonic() < deadline, 'Invalid credential did not refuse startup'
                time.sleep(.1)
            assert sha(state/'journal.sqlite') == journal_before_credentials
            credential_refusals.append(label)
    finally:
        salt_path.write_bytes(original_salt)
    evidence['invalidCredentialsRefusedBeforeJournalMutation'] = credential_refusals
    bundle_digest = sha(artifacts/'worker.mjs')
    before = sha(state/'journal.sqlite')
    with (artifacts/'worker.mjs').open('a') as f: f.write('\n// controlled integrity failure\n')
    refused = command(['systemctl', '--user', 'start', worker], check=False)
    assert refused.returncode != 0 and show(worker)['MainPID'] == '0'
    assert sha(state/'journal.sqlite') == before
    evidence.update(result='passed', registeredPlanCommand=True, bundledEntrypoint=True, actualInstalledUserUnits=True,
                    sharedCaddyAutosaveUnchanged=True, frontendAutosaveDisabled=True, caddyConfigurationValidated=True, systemdUnitsVerified=True, startsPaused=True,
                    privateRoutesDenied=denied, pausedIntakeStatus=paused_status, oversizedStatus=oversized_status,
                    incompleteHeaderSeconds=round(header_seconds, 3), unrelatedSecretsAbsent=True,
                    limits=limits, dependentIntakeStopped=True, changedBundleRefused=True, journalPreservedOnRefusal=True,
                    verifiedBundleSha256=bundle_digest, artifactSha256={name: sha(artifacts/name) for name in ['worker.sha256', 'caddy', 'intake.json', 'intake.sha256']})
finally:
    if health_proof:
        health_proof.close()
        evidence['independentHealth'] = health_proof.evidence
    cleanup = []
    for name, content in installed.items():
        command(['systemctl', '--user', 'stop', name], check=False)
        status = show(name); assert status['MainPID'] == '0'
        command(['systemctl', '--user', 'reset-failed', name], check=False)
        target = Path.home()/'.config/systemd/user'/name
        assert target.read_text() == content, 'Owned unit changed externally; preserve it'
        target.unlink(); cleanup.append({'unit': name, 'mainPid': 0, 'ownedUnitFileRemoved': True})
    if installed: command(['systemctl', '--user', 'daemon-reload'])
    if live:
        live.close()
        evidence['liveCanary'] = live.evidence
    evidence['cleanup'] = cleanup
    final_source_hashes = source_hashes()
    evidence['sourceSha256'] = initial_source_hashes
    evidence['sourceStableDuringRun'] = final_source_hashes == initial_source_hashes
    if not evidence['sourceStableDuringRun']:
        evidence['result'] = 'failed-source-changed'
    private_write(root/'evidence.json', json.dumps(evidence, indent=2)+'\n')
    print(json.dumps({'result': evidence['result'], 'evidence': str(root/'evidence.json')}))

assert evidence["sourceStableDuringRun"], "Source changed during installed proof; receipt held"
