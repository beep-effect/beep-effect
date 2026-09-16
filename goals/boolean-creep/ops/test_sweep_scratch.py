"""Exercise scratch isolation through the real shell launcher with a fake agent."""
from pathlib import Path
import shutil
import stat
import subprocess
import tempfile
import unittest


class SweepScratchTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="sweep-scratch-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.ops = self.root / "goals/boolean-creep/ops"
        self.ops.mkdir(parents=True)
        original = Path(__file__).parent
        for name in ("run-sweep-lane.sh", "run-sweep-refresh-continuations.sh"):
            shutil.copy2(original / name, self.ops / name)
        (self.ops / "prompts").mkdir()
        (self.ops / "prompts/sweep-lane-round1.md").write_text("Lane {{LANE}} {{ROUND}}")
        self.bin = self.root / "bin"
        self.bin.mkdir()
        for name, body in {
            "git": "#!/bin/sh\nprintf '%040d\\n' 1\n",
            "grok": "#!/bin/sh\nprintf 'fake agent only\\n'\n",
        }.items():
            target = self.bin / name
            target.write_text(body)
            target.chmod(0o700)
        self.home = self.root / "home"
        self.home.mkdir(mode=0o700)
        self.env = {
            "PATH": f"{self.bin}:/usr/bin:/bin",
            "HOME": str(self.home),
            "TMPDIR": str(self.root / "untrusted-tmp"),
        }

    def run_lane(self, **extra):
        return subprocess.run(
            ["bash", str(self.ops / "run-sweep-lane.sh"), "test-lane", "test-round", "1", "packages/example/src"],
            env={**self.env, **extra}, capture_output=True, text=True, check=False,
        )

    def test_default_ignores_tmpdir_and_reserves_private_unique_runs(self):
        for _ in range(2):
            result = self.run_lane()
            self.assertEqual(result.returncode, 0, result.stderr)
        runs = list((self.home / ".cache/beep/boolean-creep").glob("lane-*"))
        self.assertEqual(len(runs), 2)
        self.assertFalse(Path(self.env["TMPDIR"]).exists())
        for run in runs:
            self.assertEqual(stat.S_IMODE(run.stat().st_mode), 0o700)
            prompt = run / "prompts/test-round/test-lane.md"
            transcript = run / "transcripts/test-round/test-lane.ndjson"
            self.assertEqual(stat.S_IMODE(prompt.stat().st_mode), 0o600)
            self.assertEqual(stat.S_IMODE(transcript.stat().st_mode), 0o600)
            self.assertIn("fake agent", transcript.read_text())

    def test_refuses_symlink_and_shared_roots_without_modifying_victim(self):
        victim = self.root / "victim"
        victim.mkdir(mode=0o700)
        link = self.root / "link"
        link.symlink_to(victim, target_is_directory=True)
        result = self.run_lane(BOOLEAN_CREEP_SCRATCH=str(link / "nested"))
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(list(victim.iterdir()), [])
        shared = self.root / "shared"
        shared.mkdir()
        shared.chmod(0o777)
        result = self.run_lane(BOOLEAN_CREEP_SCRATCH=str(shared))
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(stat.S_IMODE(shared.stat().st_mode), 0o777)
        self.assertEqual(list(shared.iterdir()), [])

    def test_continuations_leave_scratch_default_to_the_lane(self):
        helper = self.ops / "run-sweep-lane.sh"
        helper.write_text('#!/bin/sh\ntest -z "${BOOLEAN_CREEP_SCRATCH+x}"\n')
        helper.chmod(0o700)
        result = subprocess.run(
            ["bash", str(self.ops / "run-sweep-refresh-continuations.sh")],
            env=self.env, capture_output=True, text=True, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
