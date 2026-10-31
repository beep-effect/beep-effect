"""Pinned, network-isolated task-log presentation controls; no repository edits."""

from pathlib import Path
import argparse
import ast
import hashlib
import json
import os
import signal
import subprocess
import tempfile
import time

if not __debug__:
    raise SystemExit("Assertion checks are required.")

repo = Path(__file__).resolve().parents[3]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--stable', type=Path, help='Pinned stable executable; defaults to this checkout installation')
parser.add_argument('--pins', type=Path, help='Reviewed feature-local pin observation; defaults to errors-only-client-pins.json')
parser.add_argument('--output', type=Path, help='Fresh private report path; existing reports are refused')
args = parser.parse_args()
report_dir = repo / '.beep/errors-only-controls'
report_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
report_dir.chmod(0o700)
output = args.output if args.output else report_dir / 'cache.json'
assert not output.exists()
shared = repo / 'goals/turborepo-quality-cache-adoption/research/native-selection-controls.py'
node = next(n for n in ast.parse(shared.read_text()).body if isinstance(n, ast.FunctionDef) and n.name == 'invoke')
namespace = dict(time=time, subprocess=subprocess, os=os, signal=signal, deadline=time.monotonic() + 90)
exec(compile(ast.Module(body=[node], type_ignores=[]), str(shared), 'exec'), namespace)
invoke = namespace['invoke']
pins_file = args.pins or repo / 'goals/turborepo-quality-cache-adoption/research/errors-only-client-pins.json'
pins = json.loads(pins_file.read_text())
bun = Path(subprocess.check_output(['bun', '--no-env-file', '-p', 'process.execPath'], text=True).strip())
clients = {
    'stable': args.stable.resolve() if args.stable else repo / 'node_modules/@turbo/linux-64/bin/turbo',
    'canary': Path.home() / '.cache/beep/turbo-goals-clients' / pins['canary']['packageVersion'] / 'turbo',
}
cache = Path.home() / '.cache/beep/turbo-errors-only-probe'
cache.mkdir(mode=0o700, parents=True, exist_ok=True)
assert subprocess.check_output([str(bun), '--version'], text=True, timeout=5).strip() == (repo / '.bun-version').read_text().strip(), 'Bun pin changed'
for channel, binary in clients.items():
    assert hashlib.sha256(binary.read_bytes()).hexdigest() == pins[channel]['sha256'], channel + ' native pin changed'
    version = subprocess.check_output([str(binary), '--skip-infer', '--version'], cwd=repo, env={'PATH': '/usr/bin:/bin', 'TURBO_TELEMETRY_DISABLED': '1'}, text=True, timeout=5).strip()
    assert version == pins[channel]['reportedVersion'], channel + ' reported version changed'
rows = []
for channel, binary in clients.items():
    assert hashlib.sha256(binary.read_bytes()).hexdigest() == pins[channel]['sha256']
    with tempfile.TemporaryDirectory(dir=cache) as name:
        root = Path(name)
        (root / 'home').mkdir()
        work = root / 'packages/probe'
        work.mkdir(parents=True)
        (work / 'task.mjs').write_text('import fs from "node:fs"; fs.appendFileSync("execution.marker", "ran\\n"); fs.writeFileSync("result.txt", "fixture-result"); fs.chmodSync("result.txt", 0o755); console.log("FIXTURE_STDOUT"); console.error("FIXTURE_STDERR"); process.exit(Number(process.argv[2]));\n')
        env = {'PATH': '/usr/bin:/bin', 'HOME': str(root / 'home'), 'CI': '1', 'TURBO_TELEMETRY_DISABLED': '1', 'NO_COLOR': '1'}
        (root / '.gitignore').write_text('.turbo/\nexecution.marker\nresult.txt\n')
        subprocess.run(['git', 'init', '-q', str(root)], env={**env, 'GIT_CONFIG_NOSYSTEM': '1'}, check=True, capture_output=True)
        base = [
            '/usr/bin/bwrap', '--unshare-all', '--die-with-parent', '--new-session',
            '--ro-bind', '/usr/lib', '/usr/lib', '--symlink', 'usr/lib', '/lib',
            '--symlink', 'usr/lib', '/lib64', '--dir', '/bin', '--ro-bind', '/usr/bin/bash', '/bin/sh',
            '--dir', '/tools', '--ro-bind', str(binary.resolve()), '/tools/turbo',
            '--ro-bind', str(bun), '/tools/bun', '--ro-bind', '/usr/bin/git', '/tools/git', '--bind', str(root), '/work',
            '--tmpfs', '/tmp', '--dir', '/etc', '--dir', '/home', '--dir', '/home/probe',
            '--dev', '/dev', '--proc', '/proc', '--chdir', '/work', '--clearenv',
            '--setenv', 'PATH', '/tools', '--setenv', 'HOME', '/home/probe',
            '--setenv', 'CI', '1', '--setenv', 'NO_COLOR', '1',
            '--setenv', 'TURBO_TELEMETRY_DISABLED', '1', '--setenv', 'TOKIO_WORKER_THREADS', '2',
            '/tools/turbo', '--skip-infer', '--no-update-notifier', 'run', 'probe',
            '--ui=stream', '--cache=local:rw', '--summarize',
        ]
        for flag in [False, True]:
            for phase in ['cold', 'warm', 'forced']:
                logs, task_exit = 'errors-only', 0
                if phase == 'warm':
                    (work / 'result.txt').unlink()
                (root / 'package.json').write_text(json.dumps({'name': 'log-probe-root', 'private': True, 'packageManager': 'bun@1.4.4', 'workspaces': ['packages/*'], 'dependencies': {'log-probe': 'workspace:*'}}))
                (work / 'package.json').write_text(json.dumps({'name': 'log-probe', 'version': '0.0.0', 'scripts': {'probe': f'bun --no-env-file ./task.mjs {task_exit}'}}))
                if not (root / 'bun.lock').exists():
                    lock_code, _, lock_error = invoke([str(bun), '--no-env-file', 'install', '--lockfile-only', '--ignore-scripts', '--offline'], root, {**env, 'PATH': str(bun.parent) + ':/usr/bin:/bin'})
                    assert lock_code == 0 and (root / 'bun.lock').exists(), lock_error[:400]
                (root / 'turbo.json').write_text(json.dumps({'futureFlags': {'errorsOnlyShowHash': flag}, 'tasks': {'probe': {'cache': True, 'outputs': ['execution.marker', 'result.txt']}}}))
                before = set((root / '.turbo/runs').glob('*.json'))
                prior_runs = (work / 'execution.marker').read_text().count('ran\n') if (work / 'execution.marker').exists() else 0
                command = [*base, '--output-logs=' + logs, '--cache-dir=.turbo/cache']
                if phase in ['cold', 'forced']:
                    command[command.index('--cache=local:rw')] = '--cache=local:w'
                code, stdout, stderr = invoke(command, root, env)
                summaries = set((root / '.turbo/runs').glob('*.json')) - before
                assert len(summaries) == 1, (channel, flag, code, stdout[:400], stderr[:400])
                summary = json.loads(next(iter(summaries)).read_text())
                assert len(summary['tasks']) == 1
                task = summary['tasks'][0]
                checkpoint = dict(channel=channel, flag=flag, phase=phase, taskHash=task['hash'], cache=task['cache'], inputs=list(task.get('inputs', {})), priorRuns=prior_runs, currentRuns=(work / 'execution.marker').read_text().count('ran\n'))
                (report_dir / 'cache-case.json').write_text(json.dumps(checkpoint, indent=2) + '\n')
                assert (work / 'execution.marker').read_text().count('ran\n') == prior_runs + (phase != 'warm')
                assert (work / 'result.txt').read_text() == 'fixture-result'
                assert (work / 'result.txt').stat().st_mode & 0o777 == 0o755
                assert (task['cache']['status'] == 'HIT') == (phase == 'warm')
                text = (stdout + stderr).decode(errors='replace')
                task_hash = task['hash']
                assert task['execution']['exitCode'] == task_exit
                assert (code == 0) == (task_exit == 0)
                rows.append({
                    'channel': channel, 'clientSha256': pins[channel]['sha256'],
                    'flag': flag, 'outputLogs': logs, 'expectedTaskExit': task_exit,
                    'exit': code, 'taskExit': task['execution']['exitCode'], 'taskHash': task_hash,
                    'phase': phase, 'cacheStatus': task['cache']['status'], 'outputRestored': True,
                    'taskInputs': task['inputs'], 'taskId': task['taskId'],
                    'hashVisible': task_hash in text, 'stdoutVisible': 'FIXTURE_STDOUT' in text,
                    'stderrVisible': 'FIXTURE_STDERR' in text, 'taskExecuted': phase != 'warm',
                    'networkIsolated': True, 'output': text,
                })
for channel in clients:
    group = [row for row in rows if row['channel'] == channel]
    assert len({row['taskHash'] for row in group}) == 1
    assert all(row['taskInputs'] == group[0]['taskInputs'] for row in group)
for row in rows:
    assert row['hashVisible'] == row['flag']
    assert not row['stdoutVisible'] and not row['stderrVisible']
report = {
    'authority': 'Pinned two-workspace constant-cache-directory controls; no computation qualification, adoption or performance claim.',
    'pinsSha256': hashlib.sha256(pins_file.read_bytes()).hexdigest(),
    'driverSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'reusedInvokeSha256': hashlib.sha256(shared.read_bytes()).hexdigest(),
    'bunSha256': hashlib.sha256(bun.read_bytes()).hexdigest(),
    'rows': rows,
}
output.write_text(json.dumps(report, indent=2) + '\n')
output.chmod(0o600)
print(json.dumps({'cases': len(rows), 'channels': sorted(clients), 'assertionsPassed': True, 'report': str(output)}))
