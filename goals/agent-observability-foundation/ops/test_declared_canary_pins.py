"""Explicit pin admission must precede retained-root or deployment filesystem I/O."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock

from declared_canary_support import DeclaredCanary


class DeclaredCanaryPinTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='declared-canary-pins-')
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.verifier = Path(__file__).resolve().with_name('verify-observation-deployment.py')
        self.qualification_sha = 'a'*64
        self.probe_sha = 'b'*64

    def run_cli(self, flags, *, optimized=False):
        # All inputs deliberately do not exist. Missing-pin guards must fire
        # before resolve(strict=True), which itself prevents backend startup
        # if a regression accidentally admits these synthetic arguments.
        command = [sys.executable]
        if optimized:
            command.append('-O')
        command.extend([str(self.verifier), '--workspace', str(self.root/'missing-workspace'),
                        '--caddy', str(self.root/'missing-caddy'), *flags])
        run = subprocess.run(command, cwd=self.root, stdin=subprocess.DEVNULL,
                             env=dict(os.environ, HOME=str(self.root/'home'),
                                      XDG_CACHE_HOME=str(self.root/'cache'),
                                      XDG_CONFIG_HOME=str(self.root/'config'),
                                      XDG_STATE_HOME=str(self.root/'state')),
                             capture_output=True, text=True, timeout=5)
        self.assertNotEqual(run.returncode, 0)
        self.assertEqual(list(self.root.iterdir()), [], 'Admission refusal created local proof artifacts')
        return run

    def assert_pin_refusal(self, flags, message):
        run = self.run_cli(flags)
        self.assertIn(message, run.stderr)
        self.assertNotIn('FileNotFoundError', run.stderr, 'Inputs were resolved before pin admission')
        return run

    def test_cli_declared_root_requires_both_explicit_pins(self):
        for backend in [[], ['--disposable-canary']]:
            with self.subTest(backend=backend):
                run = self.assert_pin_refusal(
                    [*backend, '--declared-root', str(self.root/'missing-declared-root')],
                    '--declared-root requires both --declared-qualification-sha256 and --declared-probe-sha256')
                self.assertEqual(run.returncode, 2)

    def test_cli_one_sided_pin_pair_is_refused(self):
        for flag, value in [('--declared-qualification-sha256', self.qualification_sha),
                            ('--declared-probe-sha256', self.probe_sha)]:
            with self.subTest(flag=flag):
                self.assert_pin_refusal(
                    ['--disposable-canary', '--declared-root', str(self.root/'missing-declared-root'), flag, value],
                    'Supply both declared-root digests together')

    def test_cli_explicit_pin_pair_requires_a_declared_root(self):
        self.assert_pin_refusal(
            ['--declared-qualification-sha256', self.qualification_sha,
             '--declared-probe-sha256', self.probe_sha],
            'Explicit digests require a declared root')

    def test_cli_valid_pin_pair_reaches_workspace_resolution(self):
        run = self.run_cli(
            ['--disposable-canary', '--declared-root', str(self.root/'missing-declared-root'),
             '--declared-qualification-sha256', self.qualification_sha,
             '--declared-probe-sha256', self.probe_sha])
        self.assertIn('FileNotFoundError', run.stderr)
        self.assertIn('missing-workspace', run.stderr)
        self.assertNotIn('requires both', run.stderr)

    def test_optimized_cli_refuses_before_argument_or_path_processing(self):
        run = self.run_cli([], optimized=True)
        self.assertIn('Deployment proof requires Python assertions to remain enabled', run.stderr)
        self.assertNotIn('FileNotFoundError', run.stderr)

    def test_helper_requires_each_keyword_pin_before_directory_io(self):
        for pins in [{}, {'qualification_sha': self.qualification_sha}, {'probe_sha': self.probe_sha}]:
            with self.subTest(provided=tuple(pins)):
                directory = Mock(spec=Path)
                directory.absolute.side_effect = AssertionError('Directory I/O preceded required pin binding')
                with self.assertRaisesRegex(TypeError, 'required keyword-only argument'):
                    DeclaredCanary(directory, self.root/'missing-workspace', **pins)
                directory.absolute.assert_not_called()


if __name__ == '__main__':
    unittest.main()
