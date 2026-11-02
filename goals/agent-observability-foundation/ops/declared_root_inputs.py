"""Canonical source membership for synthetic root preparation and verification."""
import hashlib
from pathlib import Path

if not __debug__:
    raise RuntimeError('Root source verification requires Python assertions to remain enabled')


def verify_declared_root_module(workspace):
    expected = workspace/'goals/agent-observability-foundation/ops/declared_root_inputs.py'
    assert Path(__file__).resolve(strict=True) == expected.resolve(strict=True), 'Root proof must execute the workspace membership module'


def verify_declared_root_execution(workspace, preparer):
    verify_declared_root_module(workspace)
    expected = workspace/'goals/agent-observability-foundation/ops/prepare-declared-canary-root.py'
    assert preparer.resolve(strict=True) == expected.resolve(strict=True), 'Root proof must execute the workspace preparer'


def declared_root_sources(workspace):
    fixed = [
        'goals/agent-observability-foundation/ops/prepare-declared-canary-root.py',
        'goals/agent-observability-foundation/ops/declared_root_inputs.py',
        'packages/tooling/tool/cli/src/commands/AIMetrics/internal/Inventory.ts',
        'packages/tooling/tool/cli/src/commands/AIMetrics/AIMetrics.command.ts',
    ]
    return [workspace/path for path in fixed] + sorted(
        (workspace/'packages/tooling/library/ai-metrics/src').rglob('*.ts'))


def declared_root_source_hashes(workspace):
    # Enumerate on every call: additions and removals during preparation matter too.
    return {str(path.relative_to(workspace)): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in declared_root_sources(workspace)}


def verify_declared_root_sources(workspace, expected):
    assert isinstance(expected, dict), 'Root source hashes must be a mapping'
    current = declared_root_source_hashes(workspace)
    assert set(current) == set(expected), 'Root source membership differs from canonical preparation inputs'
    assert current == expected, 'Root source bytes differ from qualification'
