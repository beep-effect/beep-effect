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
research = Path(__file__).resolve().parent
source_reader = research / "native-future-flag-availability.py"
source_reader_bytes = source_reader.read_bytes()
source_reader_node = next(n for n in ast.parse(source_reader_bytes).body
                          if isinstance(n, ast.FunctionDef) and n.name == "read_contained_source")
source_reader_namespace = {"os": os}
exec(compile(ast.Module(body=[source_reader_node], type_ignores=[]), str(source_reader), "exec"), source_reader_namespace)
read_contained_source = source_reader_namespace["read_contained_source"]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--stable', type=Path, help='Pinned stable executable; defaults to this checkout installation')
parser.add_argument('--pins', type=Path, help='Reviewed feature-local pin observation; defaults to errors-only-client-pins.json')
parser.add_argument('--output', type=Path, help='Fresh private report path; existing reports are refused')
args = parser.parse_args()
report_dir = repo / '.beep/errors-only-controls'
report_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
report_dir.chmod(0o700)
output = args.output if args.output else report_dir / 'presentation.json'
assert not output.exists()
shared = repo / 'goals/turborepo-quality-cache-adoption/research/native-selection-controls.py'
pins_file = (args.pins or repo / "goals/turborepo-quality-cache-adoption/research/errors-only-client-pins.json").resolve()
pins_file.relative_to(repo)
source_paths = [Path(__file__).resolve(), shared, pins_file, repo / ".bun-version", source_reader]
captured_sources = {path: (source_reader_bytes if path == source_reader else read_contained_source(path, repo) if path == pins_file else path.read_bytes()) for path in source_paths}
node = next(n for n in ast.parse(captured_sources[shared]).body if isinstance(n, ast.FunctionDef) and n.name == 'invoke')
namespace = dict(time=time, subprocess=subprocess, os=os, signal=signal, deadline=time.monotonic() + 90)
exec(compile(ast.Module(body=[node], type_ignores=[]), str(shared), 'exec'), namespace)
invoke = namespace['invoke']
pins = json.loads(captured_sources[pins_file])
assert all((read_contained_source(path, repo) if path == pins_file else path.read_bytes()) == data for path, data in captured_sources.items()), "Observation sources changed before probes."
bun = Path(subprocess.check_output(['bun', '--no-env-file', '-p', 'process.execPath'], text=True).strip())
clients = {
    'stable': args.stable.resolve() if args.stable else repo / 'node_modules/@turbo/linux-64/bin/turbo',
    'canary': Path.home() / '.cache/beep/turbo-goals-clients' / pins['canary']['packageVersion'] / 'turbo',
}
cache = Path.home() / '.cache/beep/turbo-errors-only-probe'
cache.mkdir(mode=0o700, parents=True, exist_ok=True)
assert subprocess.check_output([str(bun), '--version'], text=True, timeout=5).strip() == captured_sources[repo / '.bun-version'].decode().strip(), 'Bun pin changed'
bun_digest = hashlib.sha256(bun.read_bytes()).hexdigest()
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
        (root / 'task.mjs').write_text('import fs from "node:fs"; fs.appendFileSync("execution.marker", "ran\\n"); console.log("FIXTURE_STDOUT"); console.error("FIXTURE_STDERR"); process.exit(Number(process.argv[2]));\n')
        env = {'PATH': '/usr/bin:/bin', 'HOME': str(root / 'home'), 'CI': '1', 'TURBO_TELEMETRY_DISABLED': '1', 'NO_COLOR': '1'}
        base = [
            '/usr/bin/bwrap', '--unshare-all', '--die-with-parent', '--new-session',
            '--ro-bind', '/usr/lib', '/usr/lib', '--symlink', 'usr/lib', '/lib',
            '--symlink', 'usr/lib', '/lib64', '--dir', '/bin', '--ro-bind', '/usr/bin/bash', '/bin/sh',
            '--dir', '/tools', '--ro-bind', str(binary.resolve()), '/tools/turbo',
            '--ro-bind', str(bun), '/tools/bun', '--bind', str(root), '/work',
            '--tmpfs', '/tmp', '--dir', '/etc', '--dir', '/home', '--dir', '/home/probe',
            '--dev', '/dev', '--proc', '/proc', '--chdir', '/work', '--clearenv',
            '--setenv', 'PATH', '/tools', '--setenv', 'HOME', '/home/probe',
            '--setenv', 'CI', '1', '--setenv', 'NO_COLOR', '1',
            '--setenv', 'TURBO_TELEMETRY_DISABLED', '1', '--setenv', 'TOKIO_WORKER_THREADS', '2',
            '/tools/turbo', '--skip-infer', '--single-package', '--no-update-notifier', 'run', 'probe',
            '--ui=stream', '--cache=local:rw', '--summarize',
        ]
        for logs, task_exit in [('errors-only', 0), ('errors-only', 7), ('full', 0)]:
            for flag in [False, True]:
                (root / 'package.json').write_text(json.dumps({'name': 'log-probe', 'version': '0.0.0', 'packageManager': 'bun@1.4.4', 'scripts': {'probe': f'bun --no-env-file ./task.mjs {task_exit}'}}))
                (root / 'turbo.json').write_text(json.dumps({'futureFlags': {'errorsOnlyShowHash': flag}, 'tasks': {'probe': {'cache': False, 'outputs': []}}}))
                before = set((root / '.turbo/runs').glob('*.json'))
                prior_runs = (root / 'execution.marker').read_text().count('ran\n') if (root / 'execution.marker').exists() else 0
                code, stdout, stderr = invoke([*base, '--output-logs=' + logs], root, env)
                summaries = set((root / '.turbo/runs').glob('*.json')) - before
                assert len(summaries) == 1, (channel, flag, code, stdout[:400], stderr[:400])
                summary = json.loads(next(iter(summaries)).read_text())
                assert len(summary['tasks']) == 1
                task = summary['tasks'][0]
                assert (root / 'execution.marker').read_text().count('ran\n') == prior_runs + 1
                text = (stdout + stderr).decode(errors='replace')
                task_hash = task['hash']
                assert task['execution']['exitCode'] == task_exit
                assert (code == 0) == (task_exit == 0)
                rows.append({
                    'channel': channel, 'clientSha256': pins[channel]['sha256'],
                    'flag': flag, 'outputLogs': logs, 'expectedTaskExit': task_exit,
                    'exit': code, 'taskExit': task['execution']['exitCode'], 'taskHash': task_hash,
                    'hashVisible': task_hash in text, 'stdoutVisible': 'FIXTURE_STDOUT' in text,
                    'stderrVisible': 'FIXTURE_STDERR' in text, 'taskExecuted': True,
                    'networkIsolated': True, 'output': text,
                })
for row in rows:
    visible = row['outputLogs'] == 'full' or row['expectedTaskExit'] != 0
    assert row['stdoutVisible'] == visible and row['stderrVisible'] == visible
    assert row['hashVisible'] == (visible or row['flag'])
assert all((read_contained_source(path, repo) if path == pins_file else path.read_bytes()) == data for path, data in captured_sources.items()), "Observation sources changed."
assert hashlib.sha256(bun.read_bytes()).hexdigest() == bun_digest, "Bun executable changed."
assert all(hashlib.sha256(binary.read_bytes()).hexdigest() == pins[channel]["sha256"] for channel, binary in clients.items()), "Native executable changed."
report = {
    "sourceBindings": [{"path": path.relative_to(repo).as_posix(), "sha256": hashlib.sha256(data).hexdigest()} for path, data in captured_sources.items()],
    "sourceAndToolsUnchanged": True,
    'authority': 'Pinned synthetic presentation controls; no computation qualification, adoption or performance claim.',
    'pinsSha256': hashlib.sha256(captured_sources[pins_file]).hexdigest(),
    'driverSha256': hashlib.sha256(captured_sources[Path(__file__).resolve()]).hexdigest(),
    'reusedInvokeSha256': hashlib.sha256(captured_sources[shared]).hexdigest(),
    'bunSha256': bun_digest,
    'rows': rows,
}
with os.fdopen(os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as report_file:
    report_file.write(json.dumps(report, indent=2) + "\n")
print(json.dumps({'cases': len(rows), 'channels': sorted(clients), 'assertionsPassed': True, 'report': str(output)}))
