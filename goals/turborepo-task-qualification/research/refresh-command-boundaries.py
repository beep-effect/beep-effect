"""Map every retained nested step and executable root to explicit review boundaries."""
import argparse
import collections
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('graph', type=Path)
parser.add_argument('output', type=Path)
args = parser.parse_args()
graph = json.loads(args.graph.read_text())
definitions = {row['id']: row for row in graph['definitions']}
assert len(definitions) == graph['definitionCount'] and not graph['cycles']


def classify(step):
    command = step['command']
    if step['kind'] == 'uninterpreted-shell':
        return 'shell-expression'
    assert step['kind'] == 'terminal-command'
    if ' vitest run' in command:
        if '--coverage' in command: return 'coverage'
        if 'BEEP_VITEST_DOCTEST=' in command: return 'doctest'
        if 'integration' in command.replace('--exclude=test/integration/**', ''): return 'integration-test'
        return 'test'
    if command.startswith('biome check '):
        return 'source-fix' if '--write' in command.split() else 'source-check'
    if command.startswith(('tsc ', 'tsgo ')): return 'compiler'
    if command.startswith('babel '): return 'compiled-output-rewrite'
    if 'docgen' in command: return 'docgen'
    if 'portless ' in command: return 'service'
    if command.startswith(('vite build', 'next build')) or ' next build' in command or ' storybook build' in command: return 'application-build'
    if command.startswith('uv run '): return 'python-tool'
    if command.startswith(('beep-cli ', 'bun run beep ', 'bun run ai-sync ', 'bun run version-sync ')): return 'repository-dispatch'
    if command.startswith('bun run '): return 'file-entrypoint'
    return 'external-tool'


boundaries = {
    'shell-expression': ['shell expansion and cwd', 'nested commands', 'environment', 'writes and capture'],
    'coverage': ['test/config/dependency closure', 'coverage trees and baseline', 'time/random/network/services', 'test verdict and capture'],
    'doctest': ['documentation examples and config', 'BEEP_VITEST_DOCTEST', 'test runtime effects', 'test verdict and capture'],
    'integration-test': ['test/config/dependency closure', 'service and credential ownership', 'external state and verdict', 'writes and capture'],
    'test': ['test/config/dependency closure', 'selection and passWithNoTests', 'time/random/network/services', 'writes and capture'],
    'source-fix': ['selected source/config/ignore closure', 'source writes', 'toolchain identity', 'diagnostics and capture'],
    'source-check': ['selected source/config/ignore closure', 'cross-workspace and installed reads', 'toolchain identity', 'diagnostics and capture'],
    'compiler': ['selected tsconfig and extends/references', 'source and installed type resolution', 'emit/noEmit/incremental settings', 'diagnostics and output trees'],
    'compiled-output-rewrite': ['prior dist tree and Babel configuration', 'plugin resolution', 'dist and source-map writes', 'diagnostics and capture'],
    'docgen': ['source/examples/config and package selection', 'compiler and renderer dependencies', 'generated docs and source writes', 'capture'],
    'service': ['persistent lifetime and readiness', 'ports/processes/environment', 'network and mutable state', 'logs and cleanup'],
    'application-build': ['framework config and source closure', 'environment and build-time network', 'generated assets/output trees', 'absolute paths and logs'],
    'python-tool': ['Python/project/lock/tool identities', 'environment installation and cache', 'selected test/lint source', 'runtime effects and capture'],
    'repository-dispatch': ['downstream argument/cwd interpretation', 'Git and workspace selection', 'dynamic subprocess and output ownership', 'external verdict and capture'],
    'file-entrypoint': ['entrypoint source and imports', 'cwd and argument interpretation', 'file/environment/network/time/random inputs', 'writes and capture'],
    'external-tool': ['resolved executable and dependency identity', 'configuration and selected files', 'possible package resolution/network', 'writes/verdict/capture'],
}
commands = {}
for definition in graph['definitions']:
    for index, step in enumerate(definition['steps']):
        if step['kind'] == 'local-script': continue
        key = (step['kind'], step['command'])
        row = commands.setdefault(key, {'kind': key[0], 'command': key[1], 'family': classify(step), 'sites': []})
        row['sites'].append({'definition': definition['id'], 'step': index})


def families(identifier, ancestors=()):
    assert identifier not in ancestors
    found = set()
    for step in definitions[identifier]['steps']:
        if step['kind'] == 'local-script': found.update(families(step['target'], (*ancestors, identifier)))
        else: found.add(classify(step))
    return found

roots = [{'computation': root['computation'], 'families': sorted(families(root['definition']))} for root in graph['roots']]
assert len(roots) == graph['rootCount'] and all(row['families'] for row in roots)
counts = collections.Counter()
for row in commands.values(): counts[row['family']] += len(row['sites'])
report = {
    'schemaVersion': 'cache-command-boundary-inventory/v1',
    'authority': 'Static command routing and review obligations. No command was executed; family membership is not semantic closure or qualification.',
    'graphSha256': hashlib.sha256(args.graph.read_bytes()).hexdigest(),
    'recipeSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'rootCount': len(roots), 'stepCount': sum(counts.values()), 'familyStepCounts': dict(sorted(counts.items())),
    'families': [{'id': key, 'remainingReview': value} for key, value in sorted(boundaries.items())],
    'commands': sorted(commands.values(), key=lambda row: (row['family'], row['command'])),
    'roots': roots,
    'limits': ['Families are review routing labels, not execution outcomes or policy lifecycle states.',
               'No root is classified from its name alone; it inherits every reachable child family.',
               'Unsupported shell expressions retain their full command and unresolved effects.',
               'Environment assignments, test names and flags do not prove purity, offline operation or absence of writes.'],
}
assert report['stepCount'] == graph['stepCounts']['terminal-command'] + graph['stepCounts']['uninterpreted-shell']
args.output.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({key: report[key] for key in ['rootCount', 'stepCount', 'familyStepCounts']}))
