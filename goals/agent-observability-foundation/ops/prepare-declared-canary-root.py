#!/usr/bin/env python3
"""Prepare one private, positively identified synthetic Git root for AC12.

This does not send records, enroll a harness or establish a launch population.
Retain this owned directory for both the disposable and live proof stages.
"""
import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workspace', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    workspace = args.workspace.resolve(strict=True)
    output = args.output.absolute()
    # Fail on reuse: no prior fixture, user repository or uncertain attempt is overwritten.
    output.mkdir(mode=0o700)
    repo = output/'repository'
    repo.mkdir(mode=0o700)
    home = output/'home'
    home.mkdir(mode=0o700)
    salt = 'synthetic-launch-proof-salt'
    host_key = 'synthetic-declared-canary-host'
    bun = shutil.which('bun')
    assert bun is not None, 'Bun is required for the actual root-probe command'
    source_files = [Path(__file__).resolve(),
                    workspace/'packages/tooling/tool/cli/src/commands/AIMetrics/internal/Inventory.ts',
                    workspace/'packages/tooling/tool/cli/src/commands/AIMetrics/AIMetrics.command.ts']
    source_files.extend(sorted((workspace/'packages/tooling/library/ai-metrics/src').rglob('*.ts')))

    def source_hashes():
        return {str(p.relative_to(workspace)): hashlib.sha256(p.read_bytes()).hexdigest()
                for p in source_files}

    initial_source_hashes = source_hashes()
    env = {
        'PATH': os.environ['PATH'], 'HOME': str(home),
        'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_CONFIG_NOSYSTEM': '1',
        'BEEP_AI_METRICS_HASH_SALT': salt,
    }

    def run(argv, cwd=repo, timeout=15):
        result = subprocess.run(argv, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                                capture_output=True, timeout=timeout, check=True)
        assert len(result.stdout) <= 262144 and len(result.stderr) <= 65536
        return result.stdout

    git = ['git', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null']
    run(git+['init', '-q', '.'])
    run(git+['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
             'commit', '--allow-empty', '-qm', 'declared observation fixture'])
    run(git+['remote', 'add', 'origin', 'https://example.invalid/observation/synthetic.git'])
    now = datetime.now(timezone.utc)
    declaration = {
        'schemaVersion': 'agent-observation-root-declaration/v1',
        'hostKey': host_key,
        'populationWindowStart': (now-timedelta(minutes=1)).isoformat(),
        'populationWindowEnd': (now-timedelta(seconds=1)).isoformat(),
        'roots': [{'path': str(repo), 'state': 'inspect'}],
    }
    declaration_path = output/'private-declaration.json'
    declaration_path.write_text(json.dumps(declaration)+'\n')
    declaration_path.chmod(0o600)
    probe_bytes = run([bun, '--no-env-file', 'packages/tooling/tool/cli/src/bin.ts',
                       'ai-metrics', 'inventory', 'probe-roots', '--input',
                       str(declaration_path), '--json'], cwd=workspace, timeout=65)
    probe = json.loads(probe_bytes)
    inventory = probe['inventory']
    assert len(inventory['hosts']) == len(inventory['roots']) == len(probe['rootReceipts']) == 1
    host = inventory['hosts'][0]
    root = inventory['roots'][0]
    private_hash = lambda text: hashlib.sha256((salt+'\0'+text).encode()).hexdigest()
    assert host['hostId'] == private_hash('observation-host/v1:'+host_key)
    assert host['identityNamespaceId'] == private_hash('ai-metrics-hash-salt-namespace/v1')
    assert root['hostId'] == host['hostId'] and root['rootId'] == 'root-'+private_hash(str(repo))
    assert root['availability'] == 'present'
    assert all(root[key]['_tag'] == 'Verified' and root[key]['evidenceId'] == root['evidenceId']
               for key in ('repositoryId', 'cloneId', 'worktreeId'))
    assert root['evidenceId'] == probe['rootReceipts'][0]['evidenceId']
    assert all(route['knownLaunches']['_tag'] == route['expectedEvents']['_tag'] == 'Unknown'
               for route in inventory['routes'])
    for private in (str(output), host_key, salt, 'example.invalid'):
        assert private.encode() not in probe_bytes, 'Root probe leaked a private fixture value'
    (output/'root-probe.json').write_bytes(probe_bytes)
    (output/'root-probe.json').chmod(0o600)
    qualification = {
        'schemaVersion': 'synthetic-declared-root-proof/v1',
        'recordedAt': datetime.now(timezone.utc).isoformat(),
        'syntheticOnly': True, 'actualHarnessEnrollment': False,
        'host': host, 'root': root,
        'probeSha256': hashlib.sha256(probe_bytes).hexdigest(),
        'gitHead': run(git+['rev-parse', 'HEAD']).decode().strip(),
        'sourceSha256': initial_source_hashes,
        'disposableStage': 'not-run', 'liveStage': 'not-run',
        'scope': 'Positive declared root identity only; route/event association remains unqualified.',
    }
    assert source_hashes() == initial_source_hashes, 'Source changed during root preparation'
    qualification['sourceStableDuringRun'] = True
    (output/'qualification.json').write_text(json.dumps(qualification, indent=2)+'\n')
    (output/'qualification.json').chmod(0o600)
    print(json.dumps({'result': 'root-identity-qualified',
                      'qualification': str(output/'qualification.json'),
                      'routeProofComplete': False}))


if __name__ == '__main__':
    main()
