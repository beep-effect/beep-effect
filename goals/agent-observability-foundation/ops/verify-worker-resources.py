#!/usr/bin/env python3
"""Disposable real-worker resource proof. Never starts or changes the held forwarder."""
import argparse
import hashlib
import http.client
import json
import os
from pathlib import Path
import re
import shutil
import socket
import sqlite3
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import uuid

parser = argparse.ArgumentParser()
parser.add_argument('--workspace', required=True, type=Path)
parser.add_argument('--exercise-oom', action='store_true', help='Explicitly trigger a bounded memory-limit kill; this can cause KDE Memory Shortage notifications. Routine runs use a controlled stop.')
parser.add_argument('--caddy', required=True, type=Path, help='Checksum-verified official Caddy 2.11.7 Linux amd64 binary; no installation')
args = parser.parse_args()
workspace = args.workspace.resolve(strict=True)
caddy = args.caddy.resolve(strict=True)
caddy_hash = hashlib.sha256(caddy.read_bytes()).hexdigest()
assert caddy_hash == '678ade3bfc088749c81a681adc603333ee0bb023b6a6cfe3c0f58bef8ff854e9', 'Unexpected Caddy binary'
fixture = workspace / 'packages/tooling/library/ai-metrics/test/fixtures/observation-worker-process.ts'
assert fixture.is_file(), 'Missing owned worker fixture'
bun = Path(subprocess.run([shutil.which('bun'), '--no-env-file', '-p', 'process.execPath'], cwd=workspace, capture_output=True, text=True, check=True, timeout=15).stdout.strip()).resolve(strict=True)
root = Path(tempfile.mkdtemp(prefix='foundation-worker-resources-'))
os.chmod(root, 0o700)
database = root / 'journal.sqlite'
lock = root / 'worker.lock'
ready = root / 'ready.json'
env = dict(os.environ, XDG_RUNTIME_DIR=f'/run/user/{os.getuid()}', DBUS_SESSION_BUS_ADDRESS=f'unix:path=/run/user/{os.getuid()}/bus')
units = []
evidence = {'scope': 'disposable synthetic worker only', 'productionRollout': False,
            'fixtureSha256': hashlib.sha256(fixture.read_bytes()).hexdigest(), 'runs': [], 'proxies': [],
            'proxyBinary': {'version': '2.11.7', 'sha256': caddy_hash,
                            'archiveSha256': '727b91701a392de6ebc5027509f548bf39979e5216340d0faed8fa5e69c84f8b'}}
properties = {
    'Slice': 'agent-runs.slice',
    'MemoryMax': '536870912', 'MemorySwapMax': '0', 'CPUQuota': '50%', 'TasksMax': '64',
    'LimitNOFILE': '256', 'LimitFSIZE': '2097152', 'LimitCORE': '0', 'RuntimeMaxSec': '60',
    'TimeoutStopSec': '10', 'KillMode': 'control-group', 'OOMPolicy': 'stop', 'Restart': 'no',
    'NoNewPrivileges': 'yes', 'UMask': '0077', 'StandardOutput': 'null', 'StandardError': 'journal',
}

def command(argv, timeout=15, check=True):
    return subprocess.run(argv, env=env, stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=timeout, check=check)

def show(unit):
    keys = ['ActiveState', 'SubState', 'MainPID', 'Result', 'ControlGroup', 'MemoryPeak', 'ExecMainCode', 'ExecMainStatus']
    output = command(['/usr/bin/systemctl', '--user', 'show', unit] + [f'--property={key}' for key in keys]).stdout
    return dict(line.split('=', 1) for line in output.splitlines() if '=' in line)

def start():
    ready.unlink(missing_ok=True)
    unit = f'beep-observation-proof-{uuid.uuid4().hex[:12]}.service'
    units.append(unit)
    argv = ['/usr/bin/systemd-run', '--user', '--quiet', '--service-type=exec', f'--unit={unit}', f'--working-directory={workspace}', '--setenv=PATH=/usr/bin:/bin']
    argv += [f'--property={key}={value}' for key, value in properties.items()]
    # Effect runMain uses exit 130 after signal-driven scoped interruption.
    argv += ['--property=SuccessExitStatus=130']
    argv += ['/usr/bin/flock', '--nonblock', '--no-fork', '--conflict-exit-code', '73', str(lock), str(bun), '--no-env-file', '--max-http-header-size=16384', str(fixture), str(database), str(ready)]
    command(argv)
    deadline = time.monotonic() + 30
    while not ready.exists():
        state = show(unit)
        assert state['ActiveState'] not in ('failed', 'inactive'), f'Worker startup failed: {state["Result"]}'
        assert time.monotonic() < deadline, 'Worker startup deadline'
        time.sleep(.1)
    data = json.loads(ready.read_text())
    state = show(unit)
    assert data['pid'] == int(state['MainPID']), 'Unexpected worker owner'
    assert data['control'] == {'accepting': False, 'active': 0, 'maintenance': False, 'closed': False}, 'Worker did not start paused'
    assert data['socketPath'] == str(database) + '.sock', 'Unexpected private worker socket'
    assert Path(data['socketPath']).stat().st_mode & 0o777 == 0o600, 'Worker socket permissions'
    cg = Path('/sys/fs/cgroup') / state['ControlGroup'].lstrip('/')
    assert state['ControlGroup'].endswith(unit), 'Unexpected cgroup owner'
    observed = {name: (cg / name).read_text().strip() for name in ['memory.max', 'memory.swap.max', 'pids.max', 'cpu.max']}
    assert observed == {'memory.max': '536870912', 'memory.swap.max': '0', 'pids.max': '64', 'cpu.max': '50000 100000'}, 'Resource ceiling mismatch'
    limits = Path(f'/proc/{data["pid"]}/limits').read_text()
    assert re.search(r'Max open files\s+256\s+256\s+files', limits), 'File descriptor limit mismatch'
    assert re.search(r'Max file size\s+2097152\s+2097152\s+bytes', limits), 'File size limit mismatch'
    assert re.search(r'Max core file size\s+0\s+0\s+bytes', limits), 'Core dump limit mismatch'
    assert re.search(r'^NoNewPrivs:\s+1$', Path(f'/proc/{data["pid"]}/status').read_text(), re.M), 'Missing no-new-privileges'
    stat = lock.stat()
    owned = False
    # Btrfs subvolume stat devices can differ from /proc/locks superblock devices.
    # Bind the lock to the exact open descriptor via fstat, then inspect that fd's kernel lock.
    for descriptor in Path(f'/proc/{data["pid"]}/fd').iterdir():
        try:
            opened = descriptor.stat()
            if (opened.st_dev, opened.st_ino) != (stat.st_dev, stat.st_ino):
                continue
            info = Path(f'/proc/{data["pid"]}/fdinfo/{descriptor.name}').read_text()
            owned |= re.search(rf'^lock:\s+\d+:\s+FLOCK\s+ADVISORY\s+WRITE\s+{data["pid"]}\s+[0-9a-f]+:[0-9a-f]+:{stat.st_ino}\s+0\s+EOF$', info, re.M) is not None
        except FileNotFoundError:
            continue
    assert owned, 'Worker does not own the expected descriptor lock'
    contender = command(['/usr/bin/flock', '--nonblock', '--conflict-exit-code', '73', str(lock), '/usr/bin/true'], check=False)
    assert contender.returncode == 73, 'Second owner was not refused'
    record = {'unit': unit, 'observedCgroupLimits': observed, 'kernelLockOwnerVerified': True, 'secondOwnerExit': 73, 'startsPaused': True}
    evidence['runs'].append(record)
    data['origin'] = start_proxy(data['socketPath'])
    return unit, data, cg, record

def start_proxy(socket_path):
    # Reserve a candidate port; Caddy must bind it exclusively or startup fails.
    # Readiness is correlated with Caddy's PID owning the exact listening socket.
    with socket.socket() as reservation:
        reservation.bind(('127.0.0.1', 0))
        port = reservation.getsockname()[1]
    unit = f'beep-observation-proxy-proof-{uuid.uuid4().hex[:12]}.service'
    config_path = root / f'{unit}.json'
    config = {
        'admin': {'disabled': True},
        'apps': {'http': {'servers': {'proof': {
            'listen': [f'127.0.0.1:{port}'], 'protocols': ['h1'],
            'automatic_https': {'disable': True},
            'read_header_timeout': '2s', 'read_timeout': '4s',
            'write_timeout': '8s', 'idle_timeout': '2s', 'max_header_bytes': 16384,
            "routes": [
                {"match": [{"expression": "{http.request.header.Content-Length} != '' && int({http.request.header.Content-Length}) > 262144"}],
                 "handle": [{"handler": "static_response", "status_code": 413,
                             "headers": {"Content-Type": ["application/json"], "Cache-Control": ["no-store"]},
                             "body": '{"code":8,"message":"Request exceeds local intake size limit"}'}]},
                {'handle': [{'handler':'request_body','max_size':262144}, {'handler': 'reverse_proxy',
                'upstreams': [{'dial': f'unix/{socket_path}'}],
                'transport': {'protocol': 'http', 'versions': ['1.1'],
                              'dial_timeout': '1s', 'response_header_timeout': '5s',
                              'read_timeout': '5s', 'write_timeout': '2s',
                              'keep_alive': {'enabled': False}},
            }]}],
        }}}},
    }
    config_path.write_text(json.dumps(config))
    config_path.chmod(0o600)
    units.append(unit)
    proxy_properties = dict(properties, MemoryMax='134217728', CPUQuota='25%', LimitNOFILE='128')
    argv = ['/usr/bin/systemd-run', '--user', '--quiet', '--service-type=exec', f'--unit={unit}',
            f'--working-directory={root}', '--setenv=GOMEMLIMIT=96MiB', '--setenv=GOMAXPROCS=2']
    argv += [f'--property={key}={value}' for key, value in proxy_properties.items()]
    command(argv + [str(caddy), 'run', '--config', str(config_path)])
    deadline = time.monotonic() + 10
    origin = f'http://127.0.0.1:{port}'
    while True:
        state = show(unit)
        assert state['ActiveState'] not in ('failed', 'inactive'), 'Proxy startup failed'
        assert time.monotonic() < deadline, 'Proxy startup deadline'
        try:
            if request(origin, '/__fixture/state', timeout=1)[0] == 200:
                break
        except (OSError, urllib.error.URLError):
            pass
        time.sleep(.1)
    pid = int(state['MainPID'])
    descriptors = set()
    for descriptor in Path(f'/proc/{pid}/fd').iterdir():
        try:
            descriptors.add(os.readlink(descriptor))
        except FileNotFoundError:
            pass
    listener = [line.split() for line in Path(f'/proc/{pid}/net/tcp').read_text().splitlines()[1:]
                if line.split()[1] == f'0100007F:{port:04X}' and line.split()[3] == '0A']
    assert len(listener) == 1 and f'socket:[{listener[0][9]}]' in descriptors, 'Proxy does not own listener'
    cg = Path('/sys/fs/cgroup') / state['ControlGroup'].lstrip('/')
    observed = {name: (cg / name).read_text().strip() for name in ['memory.max', 'memory.swap.max', 'pids.max', 'cpu.max']}
    assert observed == {'memory.max': '134217728', 'memory.swap.max': '0', 'pids.max': '64', 'cpu.max': '25000 100000'}, 'Proxy resource ceiling mismatch'
    limits = Path(f'/proc/{pid}/limits').read_text()
    assert re.search(r'Max open files\s+128\s+128\s+files', limits), 'Proxy descriptor limit mismatch'
    assert re.search(r'Max core file size\s+0\s+0\s+bytes', limits), 'Proxy core dump limit mismatch'
    assert re.search(r'^NoNewPrivs:\s+1$', Path(f'/proc/{pid}/status').read_text(), re.M), 'Proxy no-new-privileges mismatch'
    evidence['proxies'].append({'unit': unit, 'observedCgroupLimits': observed,
                               'observedFileDescriptorLimit': 128, 'coreDumpsDisabled': True,
                               'noNewPrivileges': True, 'loopbackListenerOwnerVerified': True, 'config': config})
    return origin

def request(origin, path, body=None, timeout=8):
    req = urllib.request.Request(origin + path, data=body, headers={'Content-Type': 'application/json', 'Connection': 'close'}, method='POST' if body is not None else 'GET')
    try:
        response = urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req, timeout=timeout)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        data = response.read(65537)
        assert len(data) <= 65536, 'Unbounded fixture response'
        return response.status, dict(response.headers), data

def metric(cg):
    return {key: int(value) for key, value in (line.split() for line in (cg / 'cpu.stat').read_text().splitlines())}

def journal():
    with sqlite3.connect(database.as_uri() + '?mode=ro', uri=True, timeout=2) as connection:
        assert connection.execute('PRAGMA integrity_check').fetchone() == ('ok',), 'Journal integrity failure'
        rows = connection.execute('SELECT receipt_id,payload FROM observation_intake_pages').fetchall()
        assert len(rows) == 1, 'Unexpected admitted population'
        assert 'synthetic-private-prompt' not in rows[0][1], 'Private fixture content escaped projection'
        assert connection.execute('SELECT count(*) FROM observation_native_receipts').fetchone() == (1,), 'Receipt population mismatch'
        return rows[0][0]

try:
    print(f'Proof directory: {root}', flush=True)
    unit, data, cg, record = start()
    origin = data['origin']
    status, headers, _ = request(origin, '/v1/traces', b'{}')
    assert status == 503 and 'x-observation-receipt' not in {k.lower() for k in headers}, 'Paused listener accepted data'
    early_statuses = []
    # Under-limit uploads can still be refused before body consumption. Verify
    # the proxy preserves those statuses instead of substituting a broken-pipe 502.
    port = int(origin.rsplit(':', 1)[1])
    for method, path, content_type, expected in [
        ('POST', '/v1/traces', 'application/json', 503),
        ('POST', '/v1/traces', 'text/plain', 415),
        ('PUT', '/v1/traces', 'application/json', 405),
        ('POST', '/unknown', 'application/json', 404),
    ] * 6:
        connection = http.client.HTTPConnection('127.0.0.1', port, timeout=8)
        try:
            connection.request(method, path, body=b' ' * 131072,
                               headers={'Content-Type': content_type, 'Connection': 'close'})
            reply = connection.getresponse()
            early_statuses.append(reply.status)
            assert len(reply.read(65537)) <= 65536, 'Unbounded early rejection response'
            assert reply.getheader('x-observation-receipt') is None, 'Early rejection received receipt'
            assert reply.status == expected, f'Early rejection mismatch: {reply.status} expected {expected}'
        finally:
            record['earlyRejectionStatuses'] = early_statuses
            connection.close()
    assert request(origin, '/__fixture/resume', b'')[0] == 200
    body = json.dumps({'resourceSpans': [{'scopeSpans': [{'spans': [{'traceId': '1' * 32, 'spanId': '2' * 16, 'attributes': [{'key': 'input.value', 'value': {'stringValue': 'synthetic-private-prompt'}}]}]}]}]}).encode()
    status, headers, _ = request(origin, '/v1/traces', body)
    assert status == 200, 'Synthetic admission failed'
    receipt = next(value for key, value in headers.items() if key.lower() == 'x-observation-receipt')
    assert journal() == receipt
    oversized_statuses = []
    for _ in range(24):
        status, refusal_headers, _ = request(origin, '/v1/traces', b' ' * 262145)
        oversized_statuses.append(status)
        assert 'x-observation-receipt' not in {key.lower() for key in refusal_headers}, 'Oversize request received receipt'
    record['oversizedBodyStatuses'] = oversized_statuses
    assert oversized_statuses == [413] * 24, f'Runtime body limit response mismatch: {oversized_statuses}'
    port = int(origin.rsplit(':', 1)[1])
    # Exercise the streaming limit independently of the declared-length matcher.
    # Repeat exact accepted bytes first so success cannot create another receipt.
    chunked_statuses = []
    for payload, expected in [(body, 200), (b' ' * 262145, 413)] * 6:
        connection = http.client.HTTPConnection('127.0.0.1', port, timeout=8)
        try:
            connection.request('POST', '/v1/traces',
                               body=(payload[offset:offset + 16384] for offset in range(0, len(payload), 16384)),
                               headers={'Content-Type': 'application/json', 'Connection': 'close'},
                               encode_chunked=True)
            reply = connection.getresponse()
            chunked_statuses.append(reply.status)
            assert len(reply.read(65537)) <= 65536, 'Unbounded chunked response'
            if expected == 200:
                assert reply.getheader('x-observation-receipt') == receipt, 'Chunked replay changed receipt'
            else:
                assert reply.getheader('x-observation-receipt') is None, 'Chunked oversize received receipt'
            assert reply.status == expected, f'Chunked body response mismatch: {reply.status} expected {expected}'
        finally:
            record['chunkedBodyStatuses'] = chunked_statuses
            connection.close()
    with socket.create_connection(('127.0.0.1', port), timeout=3) as client:
        # Go's HTTP server allows a bounded 4 KiB read-ahead above MaxHeaderBytes.
        client.sendall(b'GET /__fixture/state HTTP/1.1\r\nHost: localhost\r\nX-Proof: ' + b'a' * 25000 + b'\r\n\r\n')
        response = client.recv(4096)
        assert b'431' in response.split(b'\r\n', 1)[0], 'Runtime header limit not enforced'
    with socket.create_connection(('127.0.0.1', port), timeout=6) as client:
        client.sendall(b'POST /v1/traces HTTP/1.1\r\nHost: localhost\r\n')
        started = time.monotonic()
        assert client.recv(4096) == b'', 'Incomplete header connection not closed'
        idle_seconds = time.monotonic() - started
    record.update(bodyLimitBytes=262144, oversizedBodyStatus=413, configuredHeaderLimitBytes=16384, oversizedHeaderProbeBytes=25000, oversizedHeaderStatus=431, incompleteHeaderClosedSeconds=round(idle_seconds, 3))
    with socket.create_connection(('127.0.0.1', port), timeout=6) as client:
        client.sendall(b'POST /v1/traces HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: 1000\r\nConnection: close\r\n\r\n{')
        started = time.monotonic()
        response = http.client.HTTPResponse(client)
        response.begin()
        assert response.status == 503 and response.getheader('x-observation-receipt') is None, 'Incomplete body was not refused without acceptance'
        assert len(response.read(65537)) <= 65536, 'Unbounded incomplete-body response'
        record['incompleteBodyRefusedSeconds'] = round(time.monotonic() - started, 3)
        record['incompleteBodyStatus'] = response.status
    assert journal() == receipt, 'Refused requests changed the accepted population'
    status, _, raw = request(origin, '/__fixture/discovery', b'')
    discovery = json.loads(raw)
    assert status == 200 and discovery['discovery']['roots'][0]['state'] == 'complete', 'Streaming discovery did not complete'
    assert discovery['discovery']['roots'][0]['entries'] == 12, 'Discovery entry population mismatch'
    assert discovery['discovery']['activeHelpers'] == 0 and discovery['sweep']['outcomes'] == [], 'Discovery helper did not close or unexpected source was admitted'
    assert journal() == receipt, 'Directory-only proof changed accepted data'
    record['streamingDiscovery'] = {'entries': 12, 'completed': True, 'activeHelpersAfterCycle': 0, 'admittedFiles': 0}
    status, _, raw = request(origin, '/__fixture/fd', b'')
    fd = json.loads(raw)
    assert status == 200 and fd['exhausted'] and 0 < fd['opened'] < 256, 'File descriptor ceiling not enforced'
    record['fileDescriptorExhaustion'] = fd
    assert request(origin, '/__fixture/state')[0] == 200, 'Worker did not recover from descriptor pressure'
    before = metric(cg)
    assert request(origin, '/__fixture/cpu', b'')[0] == 200
    after = metric(cg)
    delta = {key: after[key] - before[key] for key in ['usage_usec', 'nr_throttled', 'throttled_usec']}
    assert delta['nr_throttled'] > 0 and delta['usage_usec'] <= 1400000, 'CPU ceiling not exercised'
    record['cpuBurnDelta'] = delta
    status, _, raw = request(origin, '/__fixture/backup', b'')
    assert status == 200, 'Bounded physical snapshot failed'
    backup_receipt = json.loads(raw)
    backup_root = Path(str(database) + '.backup')
    backup_file = backup_root / 'journal.sqlite'
    assert backup_file.stat().st_size <= 1048576, 'Snapshot exceeded proof budget'
    assert hashlib.sha256(backup_file.read_bytes()).hexdigest() == backup_receipt['manifest']['snapshotDigest'], 'Snapshot byte digest mismatch'
    assert hashlib.sha256((backup_root / 'manifest.json').read_bytes()).hexdigest() == backup_receipt['manifestDigest'], 'Manifest digest mismatch'
    with sqlite3.connect(backup_file.as_uri() + '?mode=ro', uri=True, timeout=2) as connection:
        assert connection.execute('PRAGMA integrity_check').fetchone() == ('ok',), 'Independent snapshot integrity failure'
        assert connection.execute('SELECT receipt_id FROM observation_intake_pages').fetchall() == [(receipt,)], 'Snapshot receipt population mismatch'
    assert request(origin, '/v1/traces', body)[0] == 503, 'Backup unexpectedly resumed admission'
    assert request(origin, '/__fixture/resume', b'')[0] == 200
    record['physicalSnapshotUnderResourceLimits'] = backup_receipt
    print('Verified OS ceilings, ownership, body/header/idle limits, descriptor pressure and CPU throttling.', flush=True)
    record['memoryLimitExercised'] = args.exercise_oom
    if args.exercise_oom:
        # Explicit failure qualification only, after the verified cap and zero swap.
        print('Explicit OOM proof: KDE may show a Memory Shortage notification for this disposable service.', flush=True)
        try:
            request(origin, '/__fixture/memory', b'', timeout=10)
        except (OSError, urllib.error.URLError):
            pass
        deadline = time.monotonic() + 10
        state = show(unit)
        while state['ActiveState'] not in ('failed', 'inactive') or state['MainPID'] != '0':
            assert time.monotonic() < deadline, 'Memory probe did not stop the owned worker'
            time.sleep(.1)
            state = show(unit)
        assert state['Result'] == 'oom-kill', f'Expected bounded OOM termination, observed {state["Result"]}'
        record['memoryTermination'] = {key: state[key] for key in ['Result', 'MemoryPeak', 'ExecMainCode', 'ExecMainStatus']}
    else:
        command(['/usr/bin/systemctl', '--user', 'stop', unit])
        assert show(unit)['MainPID'] == '0', 'Controlled stop did not finish'
    assert journal() == receipt
    assert hashlib.sha256(backup_file.read_bytes()).hexdigest() == backup_receipt['manifest']['snapshotDigest'], 'Worker restart changed independent snapshot'
    print('Owned worker stopped; committed receipt and independent snapshot remain intact.', flush=True)
    # Do not overlap two proxy budgets while checking the restart.
    prior_proxy = evidence['proxies'][-1]['unit']
    command(['/usr/bin/systemctl', '--user', 'stop', prior_proxy])
    assert show(prior_proxy)['MainPID'] == '0', 'Prior proxy did not stop before restart'
    second, reopened, _, record2 = start()
    assert request(reopened['origin'], '/v1/traces', body)[0] == 503, 'Restart unexpectedly resumed admission'
    assert request(reopened['origin'], '/__fixture/resume', b'')[0] == 200
    status, headers, _ = request(reopened['origin'], '/v1/traces', body)
    assert status == 200
    assert next(value for key, value in headers.items() if key.lower() == 'x-observation-receipt') == receipt
    assert journal() == receipt
    record2.update(exactReceiptReplayAfterRestart=True, restartCause='memory-limit' if args.exercise_oom else 'controlled-stop', priorJournalIntegrity=True, explicitResumeRequired=True)
    evidence['deliberateMemoryExhaustion'] = args.exercise_oom
    evidence.update(result='passed', aggregateMemoryCeilingBytes=671088640, aggregateCpuQuotaPercent=75, aggregateTasksCeiling=128, databaseCeilingBytes=1048576, perFileCeilingBytes=2097152, aggregateFilesystemQuotaQualified=False, backendDeliveryQualified=False, runtimeEntrypoint='test fixture only; not production launcher', receiptSha256=hashlib.sha256(receipt.encode()).hexdigest())
except BaseException as error:
    evidence.update(result='failed', failureType=type(error).__name__)
    raise
finally:
    cleanup = []
    for unit in units:
        command(['/usr/bin/systemctl', '--user', 'stop', unit], timeout=15, check=False)
        state = show(unit)
        cleanup.append({'unit': unit, 'mainPID': state['MainPID'], 'activeState': state['ActiveState'], 'result': state['Result'], 'exitStatus': state['ExecMainStatus']})
        command(['/usr/bin/systemctl', '--user', 'reset-failed', unit], check=False)
    evidence['cleanup'] = cleanup
    evidence['ownedWorkersStopped'] = all(item['mainPID'] == '0' for item in cleanup)
    if not evidence['ownedWorkersStopped']:
        evidence.update(result='failed', failureType='OwnedCleanupIncomplete')
    (root / 'verification.json').write_text(json.dumps(evidence, indent=2) + '\n')
    os.chmod(root / 'verification.json', 0o600)
    print(f'Evidence: {root / "verification.json"}', flush=True)
    assert evidence['ownedWorkersStopped'], 'Owned proof process remains active'
