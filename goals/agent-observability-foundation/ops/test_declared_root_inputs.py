"""Filesystem regressions for complete synthetic-root source membership."""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from declared_root_inputs import declared_root_source_hashes, declared_root_sources, verify_declared_root_sources


class DeclaredRootInputTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='declared-source-membership-')
        self.addCleanup(self.directory.cleanup)
        self.workspace = Path(self.directory.name)
        self.source = self.workspace/'packages/tooling/library/ai-metrics/src/original.ts'
        self.source.parent.mkdir(parents=True)
        self.source.write_text('export const original = true;\n')
        for path in declared_root_sources(self.workspace):
            path.parent.mkdir(parents=True, exist_ok=True)
            if not path.exists():
                path.write_text('fixture input\n')
        self.expected = declared_root_source_hashes(self.workspace)

    def test_complete_matching_snapshot_passes(self):
        verify_declared_root_sources(self.workspace, self.expected)

    def test_added_source_is_detected_and_reenumerated(self):
        added = self.source.with_name('added.ts')
        added.write_text('export const added = true;\n')
        self.assertIn(str(added.relative_to(self.workspace)), declared_root_source_hashes(self.workspace))
        with self.assertRaisesRegex(AssertionError, 'membership differs'):
            verify_declared_root_sources(self.workspace, self.expected)

    def test_removed_source_is_refused(self):
        self.source.unlink()
        with self.assertRaisesRegex(AssertionError, 'membership differs'):
            verify_declared_root_sources(self.workspace, self.expected)

    def test_changed_bytes_are_refused(self):
        self.source.write_text('export const original = false;\n')
        with self.assertRaisesRegex(AssertionError, 'bytes differ'):
            verify_declared_root_sources(self.workspace, self.expected)

    def test_omitted_input_is_refused(self):
        incomplete = dict(self.expected)
        incomplete.pop(str(self.source.relative_to(self.workspace)))
        with self.assertRaisesRegex(AssertionError, 'membership differs'):
            verify_declared_root_sources(self.workspace, incomplete)

    def test_extra_qualification_entry_is_not_read_as_a_path(self):
        extra = dict(self.expected, **{'../outside-private-file': '0'*64})
        with self.assertRaisesRegex(AssertionError, 'membership differs'):
            verify_declared_root_sources(self.workspace, extra)

    def test_optimized_execution_refuses_before_proof(self):
        run = subprocess.run([sys.executable, '-O', str(Path(__file__).with_name('declared_root_inputs.py'))],
                             capture_output=True, timeout=5)
        self.assertNotEqual(run.returncode, 0)
        self.assertIn(b'assertions to remain enabled', run.stderr)


if __name__ == '__main__':
    unittest.main()
