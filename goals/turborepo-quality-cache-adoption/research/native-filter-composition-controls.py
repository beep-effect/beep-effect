"""Assert affected/filter composition on frozen native clients in offline fixtures.

The real CI lane shapes motivate the fixture; this is not a Beep task execution.
Both streams and each owned process group use the existing bounded collector.
Reports require a fresh output path and contain no absolute paths or env values.
"""

import argparse
import ast
import datetime
import hashlib
import json
import os
import selectors
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path
if sys.flags.optimize:
    raise SystemExit('Native filter composition requires assertions; optimized execution is refused.')
assert sys.platform == 'linux', 'Native controls require Linux'
os.umask(0o077)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--stable', type=Path)
parser.add_argument('--isolate-task-flags', action='store_true', help='Compare all four task-selection flag combinations with one-flag counterfactual pairs.')
arguments = parser.parse_args()
assert not arguments.output.exists(), 'Existing reports are refused'
repo = Path(__file__).resolve().parents[3]
research = Path(__file__).resolve().parent
source_reader = research / "native-future-flag-availability.py"
source_reader_bytes = source_reader.read_bytes()
source_reader_node = next(n for n in ast.parse(source_reader_bytes).body
                          if isinstance(n, ast.FunctionDef) and n.name == "read_contained_source")
source_reader_namespace = {"os": os}
exec(compile(ast.Module(body=[source_reader_node], type_ignores=[]), str(source_reader), "exec"), source_reader_namespace)
read_contained_source = source_reader_namespace["read_contained_source"]
pin_file = research / "errors-only-client-pins.json"
source_paths = [Path(__file__).resolve(), research / 'errors-only-client-pins.json', research / 'native-future-flag-availability.py', repo / '.bun-version', repo / 'turbo.json', repo / 'packages/tooling/tool/cli/src/commands/Ci/CiLane.ts']
source_bytes = {path: (source_reader_bytes if path == source_reader else read_contained_source(path, repo) if path == pin_file else path.read_bytes()) for path in source_paths}
source_bindings = [{'path': p.relative_to(repo).as_posix(), 'sha256': hashlib.sha256(v).hexdigest()} for p, v in source_bytes.items()]
pins = json.loads(source_bytes[research / 'errors-only-client-pins.json'])
harness = research / 'native-future-flag-availability.py'
body = source_bytes[harness]
node = next((n for n in ast.parse(body).body if isinstance(n, ast.FunctionDef) and n.name == 'run_bounded'))
ns = {'time': time, 'os': os, 'selectors': selectors, 'signal': signal, 'subprocess': subprocess, 'start': time.monotonic()}
exec(compile(ast.Module(body=[node], type_ignores=[]), str(harness), 'exec'), ns)

def invoke(argv, root, env):
    ns['command'] = argv[1:]
    return ns['run_bounded'](argv[0], root, env)

def checked(argv, root, env):
    code, out, err = invoke(argv, root, env)
    assert code == 0, (argv[:3], code, err[-500:])
    return out.decode().strip()
assert all((read_contained_source(path, repo) if path == pin_file else path.read_bytes()) == data for path, data in source_bytes.items()), "Observation sources changed before probes."
bun = Path(subprocess.check_output(['bun', '--no-env-file', '-p', 'process.execPath'], text=True, timeout=5).strip())
version = subprocess.check_output([str(bun), '--version'], text=True, timeout=5).strip()
tool_paths = {'bun': bun, 'bwrap': Path('/usr/bin/bwrap'), 'git': Path('/usr/bin/git')}
tool_hashes = {key: hashlib.sha256(path.read_bytes()).hexdigest() for key, path in tool_paths.items()}
assert version == source_bytes[repo / '.bun-version'].decode().strip()
cache = Path.home() / '.cache/beep/turbo-filter-composition-controls'
cache.mkdir(mode=0o700, parents=True, exist_ok=True)
clients = {'stable': arguments.stable or repo / 'node_modules/@turbo/linux-64/bin/turbo', 'canary': Path.home() / '.cache/beep/turbo-goals-clients' / pins['canary']['packageVersion'] / 'turbo'}
rows = []
observed_versions = {}

fixed_flags = {'globalConfiguration': True, 'filterUsingTasks': True, 'affectedUsingTaskInputs': True}
flag_variants = [('configured', fixed_flags)]
if arguments.isolate_task_flags:
    flag_variants = [(f'affected:{str(affected).lower()}/filter:{str(filtered).lower()}',
                      {**fixed_flags, 'affectedUsingTaskInputs': affected, 'filterUsingTasks': filtered})
                     for affected in [False, True] for filtered in [False, True]]

def expected_tasks(changed, selector, flags):
    # A bare Git range names changed owners; dependent traversal needs an ellipsis.
    if selector == 'filter-range' and changed in ['product', 'product-unmatched']:
        return [] if changed == 'product-unmatched' and flags['filterUsingTasks'] else ['product#probe']
    if changed == 'product-unmatched':
        # --affected also traverses the filter resolver: either flag narrows it.
        task_inputs = flags['affectedUsingTaskInputs'] or flags['filterUsingTasks']
        affected = [] if task_inputs else ['product#probe', 'storybook#probe']
    else:
        affected = {'product': ['product#probe', 'storybook#probe'], 'labs': ['labs#probe'], 'unrelated': ['unrelated#probe'], 'global': ['labs#probe', 'product#probe', 'storybook#probe', 'unrelated#probe']}[changed]
    if selector in ['affected', 'filter-range']:
        return affected
    if selector == 'labs':
        return ['labs#probe']
    if selector in ['labs-affected', 'labs-affected-only']:
        return ['labs#probe'] if changed in ['labs', 'global'] else []
    if selector == 'storybook-affected':
        return [task for task in affected if task in ['product#probe', 'storybook#probe']]
    if selector == 'exclude-labs-affected':
        return [task for task in affected if task != 'labs#probe']
    if selector == 'two-positive-affected':
        return [task for task in affected if task in ['labs#probe', 'unrelated#probe']]
    raise AssertionError('Unknown selector')
for channel, binary in clients.items():
    assert hashlib.sha256(binary.read_bytes()).hexdigest() == pins[channel]['sha256'], 'Native client pin changed'
    for variant, flags in flag_variants:
        with tempfile.TemporaryDirectory(prefix='composition-' + channel + '-', dir=cache) as name:
            root = Path(name)
            (root / 'home').mkdir()
            env = {'HOME': str(root / 'home'), 'PATH': str(bun.parent) + ':/usr/bin:/bin', 'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': '/dev/null', 'TURBO_TELEMETRY_DISABLED': '1'}
            (root / 'package.json').write_text(json.dumps({'name': 'filter-composition-controls', 'private': True, 'packageManager': 'bun@' + version, 'workspaces': ['packages/*', 'apps/labs/*', 'apps/storybook']}))
            (root / '.gitignore').write_text('.turbo/\n')
            (root / 'global.txt').write_text('base')
            (root / 'turbo.json').write_text(json.dumps({'futureFlags': flags, 'global': {'inputs': ['global.txt'], 'remoteCache': {'enabled': False}}, 'tasks': {'probe': {'cache': False, 'inputs': ['input.txt'], 'dependsOn': ['^probe'], 'outputs': []}}}))
            directories = {'product': 'packages/product', 'unrelated': 'packages/unrelated', 'labs': 'apps/labs/example', 'storybook': 'apps/storybook'}
            for package, directory in directories.items():
                d = root / directory
                d.mkdir(parents=True)
                (d / 'input.txt').write_text('base')
                (d / 'notes.txt').write_text('outside task inputs')
                m = {'name': package, 'version': '0.0.0', 'scripts': {'probe': 'echo UNEXPECTED > execution.marker'}}
                if package == 'storybook':
                    m['dependencies'] = {'product': 'workspace:*'}
                (d / 'package.json').write_text(json.dumps(m))
            checked([str(bun), '--no-env-file', 'install', '--offline', '--lockfile-only', '--ignore-scripts'], root, env)
            checked(['/usr/bin/git', 'init', '--template=', '-b', 'main'], root, env)
            checked(['/usr/bin/git', 'config', 'user.name', 'Native Fixture'], root, env)
            checked(['/usr/bin/git', 'config', 'user.email', 'fixture@example.invalid'], root, env)
            checked(['/usr/bin/git', 'add', '--', '.'], root, env)
            checked(['/usr/bin/git', '-c', 'commit.gpgsign=false', 'commit', '-m', 'base'], root, env)
            base = checked(['/usr/bin/git', 'rev-parse', 'HEAD'], root, env)
            launch = ['/usr/bin/bwrap', '--unshare-all', '--die-with-parent', '--new-session', '--ro-bind', '/usr/lib', '/usr/lib', '--symlink', 'usr/lib', '/lib', '--symlink', 'usr/lib', '/lib64', '--dir', '/bin', '--ro-bind', '/usr/bin/bash', '/bin/sh', '--dir', '/tools', '--ro-bind', str(binary.resolve()), '/tools/turbo', '--ro-bind', str(bun), '/tools/bun', '--ro-bind', '/usr/bin/git', '/tools/git', '--bind', str(root), '/work', '--tmpfs', '/tmp', '--dir', '/etc', '--dir', '/home', '--dir', '/home/probe', '--dev', '/dev', '--proc', '/proc', '--chdir', '/work', '--clearenv', '--setenv', 'PATH', '/tools', '--setenv', 'HOME', '/home/probe', '--setenv', 'CI', '1', '--setenv', 'TURBO_TELEMETRY_DISABLED', '1', '--setenv', 'GIT_CONFIG_NOSYSTEM', '1', '--setenv', 'NO_COLOR', '1', '--setenv', 'TOKIO_WORKER_THREADS', '2']
            observed_version = checked(
                [*launch, '/tools/turbo', '--skip-infer', '--version'], root, env
            )
            assert observed_version == pins[channel]['reportedVersion'], 'Native version changed'
            observed_versions[channel] = observed_version
            selectors = {'affected': ['--affected'], 'labs': ['--filter=./apps/labs/**'], 'labs-affected': ['--filter=./apps/labs/**', '--affected'], 'storybook-affected': ['--filter=storybook', '--affected'], 'exclude-labs-affected': ['--filter=!./apps/labs/**', '--affected'], 'labs-affected-only': ['--filter=./apps/labs/**', '--affected', '--only'], 'two-positive-affected': ['--filter=labs', '--filter=unrelated', '--affected']}
            if arguments.isolate_task_flags:
                selectors['filter-range'] = ['--filter=[BASE...HEAD]']
            cases = ['product', 'labs', 'unrelated', 'global']
            if arguments.isolate_task_flags:
                cases.append('product-unmatched')
            for case in cases:
                checked(['/usr/bin/git', 'checkout', '-b', 'change-' + case, base], root, env)
                path = root / ('global.txt' if case == 'global' else directories['product'] + '/notes.txt' if case == 'product-unmatched' else directories[case] + '/input.txt')
                path.write_text('changed')
                checked(['/usr/bin/git', 'add', '--', '.'], root, env)
                checked(['/usr/bin/git', '-c', 'commit.gpgsign=false', 'commit', '-m', 'change ' + case], root, env)
                head = checked(['/usr/bin/git', 'rev-parse', 'HEAD'], root, env)
                for label, selector_args in selectors.items():
                    resolved_selectors = [arg.replace('BASE...HEAD', base + '...' + head) for arg in selector_args]
                    argv = [*launch, '--setenv', 'TURBO_SCM_BASE', base, '--setenv', 'TURBO_SCM_HEAD', head, '/tools/turbo', '--skip-infer', '--no-update-notifier', 'run', 'probe', *resolved_selectors, '--dry=json', '--concurrency=1', '--env-mode=strict']
                    code, out, err = invoke(argv, root, env)
                    assert code == 0, (channel, case, label, code, err[-700:])
                    plan = json.loads(out)
                    selected = sorted((x['taskId'] for x in plan['tasks']))
                    expected = expected_tasks(case, label, flags)
                    assert selected == expected, ('Selection composition changed', channel, case, label, selected, expected)
                    assert all((x['command'] == 'echo UNEXPECTED > execution.marker' for x in plan['tasks']))
                    rows.append({'channel': channel, 'variant': variant, 'futureFlags': flags, 'changed': case, 'selector': label, 'tasks': selected, 'expectedTasks': expected, 'assertionsPassed': True, 'allSelectedTasksExecutable': True, 'noTaskExecuted': True, 'stdoutBytes': len(out), 'stderrBytes': len(err), 'stdoutSha256': hashlib.sha256(out).hexdigest(), 'stderrSha256': hashlib.sha256(err).hexdigest()})
                    assert not list(root.rglob('execution.marker'))
assert len(rows) == (320 if arguments.isolate_task_flags else 56)
comparisons = []
if arguments.isolate_task_flags:
    indexed = {(r['channel'], r['changed'], r['selector'],
                r['futureFlags']['affectedUsingTaskInputs'],
                r['futureFlags']['filterUsingTasks']): r for r in rows}
    assert len(indexed) == 320, 'Duplicate or missing factorial control'
    for channel in clients:
        for changed in cases:
            for selector in selectors:
                for varied in ['affectedUsingTaskInputs', 'filterUsingTasks']:
                    fixed = 'filterUsingTasks' if varied == 'affectedUsingTaskInputs' else 'affectedUsingTaskInputs'
                    for fixed_value in [False, True]:
                        pair = []
                        for enabled in [False, True]:
                            flags = {varied: enabled, fixed: fixed_value}
                            pair.append(indexed[(channel, changed, selector,
                                                 flags['affectedUsingTaskInputs'], flags['filterUsingTasks'])])
                        disabled, enabled = pair
                        differences = [flag for flag in fixed_flags
                                       if disabled['futureFlags'][flag] != enabled['futureFlags'][flag]]
                        assert differences == [varied], 'Counterfactual changed another flag'
                        comparisons.append({'channel': channel, 'changed': changed, 'selector': selector,
                                            'variedFlag': varied, 'fixedFlag': fixed, 'fixedValue': fixed_value,
                                            'disabledTasks': disabled['tasks'], 'enabledTasks': enabled['tasks']})
    assert len(comparisons) == 320, 'Incomplete one-flag comparison matrix'

assert all((hashlib.sha256(read_contained_source(path, repo) if path == pin_file else path.read_bytes()).hexdigest() == entry['sha256'] for path, entry in zip(source_paths, source_bindings))), 'Source changed during observation'
assert all((hashlib.sha256(path.read_bytes()).hexdigest() == tool_hashes[key] for key, path in tool_paths.items())), 'Tool changed during observation'
assert all((hashlib.sha256(binary.read_bytes()).hexdigest() == pins[channel]['sha256'] for channel, binary in clients.items())), 'Client changed during observation'
result = {'schemaVersion': 'cache-native-filter-composition-controls/v1', 'recordedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'authority': 'Synthetic native selection only; no current-root execution, task qualification, hosted proof, performance claim or production change.', 'sourceRevision': subprocess.check_output(['/usr/bin/git', 'rev-parse', 'HEAD'], cwd=repo, text=True, timeout=5).strip(), 'sourceState': 'working-tree-bound', 'sourceBindings': source_bindings, 'clients': {channel: {'reportedVersion': observed_versions[channel], 'sha256': pins[channel]['sha256']} for channel in clients}, 'toolSha256': tool_hashes, 'bunVersion': version, 'fixtureFutureFlags': fixed_flags if not arguments.isolate_task_flags else None, 'oneFlagAtATime': arguments.isolate_task_flags, 'configurationVariants': [{'variant': name, 'futureFlags': flags} for name, flags in flag_variants], 'networkIsolated': True, 'repositoryNotMounted': True, 'onlySyntheticInputs': True, 'captureBounds': {'wholeSeconds': 600, 'perProcessSeconds': 20, 'stdoutBytes': 1048576, 'stderrBytes': 65536}, 'cases': len(rows), 'rows': rows, 'counterfactualComparisons': comparisons, 'oneFlagComparisons': len(comparisons), 'sourceAndToolsUnchanged': True}
encoded = json.dumps(result, indent=2) + '\n'
assert len(encoded.encode()) <= 1024 * 1024, 'Compact report exceeds one MiB'
arguments.output.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
with arguments.output.open('x') as report:
    report.write(encoded)
print(json.dumps({'cases': len(rows), 'oneFlagComparisons': len(comparisons), 'sourceAndToolsUnchanged': True, 'allAssertionsPassed': True}))
