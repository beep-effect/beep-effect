from __future__ import annotations

import json
import os
import stat
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from beep_skillopt import preflight

FAKE_CLAUDE = """#!{python}
import json, sys
if sys.argv[1:] == ["--version"]:
    print("9.9.9 (Claude Code)")
elif sys.argv[1:] == ["auth", "status"]:
    print(json.dumps({{"loggedIn": {logged_in}, "email": "someone@example.invalid"}}))
else:
    sys.exit(3)
"""


def _row(row_id: str, severity: str = "P0", kind: str = "local-shard-failed", **capsule: object) -> str:
    return json.dumps({"schemaVersion": "yeet-inbox/v1", "id": row_id, "severity": severity, "kind": kind,
                       "capsule": capsule})


class PreflightTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        (self.root / ".git").write_text("gitdir: elsewhere\n")
        self.out_root = self.root / "out"
        self.inbox = self.root / ".beep" / "inbox"

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def _fake_claude(self, logged_in: bool) -> str:
        path = self.root / f"claude-{logged_in}"
        path.write_text(FAKE_CLAUDE.format(python=sys.executable, logged_in="True" if logged_in else "False"))
        path.chmod(path.stat().st_mode | stat.S_IXUSR)
        return str(path)

    def _cfg(self, claude: str = "", **extra: object) -> dict:
        return {"target_backend": "claude_code_exec", "optimizer_backend": "claude_chat",
                "claude_code_exec_path": claude, "target_model": "claude-opus-5-5",
                "optimizer_model": "claude-opus-5-5", "out_root": str(self.out_root),
                "screen_candidates": True, "baseline_repeats": 3, **extra}

    def _run(self, cfg: dict, **kwargs: object) -> preflight.Report:
        return preflight.run_preflight(cfg, repo_root=self.root, check_clis=False, **kwargs)

    def test_clean_state_passes(self) -> None:
        self.assertEqual(self._run(self._cfg()).failures, [])

    def test_previous_outputs_refuse_unless_resume_or_force(self) -> None:
        (self.out_root / "selection_eval_baseline").mkdir(parents=True)
        (self.out_root / "history.json").write_text("[]")
        failures = self._run(self._cfg()).failures
        self.assertEqual(len(failures), 1)
        self.assertIn("selection_eval_baseline", failures[0])
        self.assertEqual(self._run(self._cfg(), resume=True).failures, [])
        report = self._run(self._cfg(), force=True)
        self.assertEqual(report.failures, [])
        self.assertFalse(self.out_root.exists())
        moved = [p for p in self.root.iterdir() if p.name.startswith("out.prev-")]
        self.assertEqual(len(moved), 1)
        self.assertTrue((moved[0] / "history.json").exists())  # moved aside, never deleted

    def test_unacknowledged_p0_refuses(self) -> None:
        self.inbox.mkdir(parents=True)
        (self.inbox / "failures.ndjson").write_text("\n".join([_row("p0-open"), _row("p1-row", severity="P1")]) + "\n")
        failures = self._run(self._cfg()).failures
        self.assertEqual(len(failures), 1)
        self.assertIn("p0-open", failures[0])
        self.assertNotIn("p1-row", failures[0])

    def test_acknowledged_and_superseded_p0_pass(self) -> None:
        self.inbox.mkdir(parents=True)
        (self.inbox / "acks").mkdir()
        (self.inbox / "acks" / "p0-acked").write_text(json.dumps({"resolution": {"kind": "fix-sha"}}))
        (self.inbox / "dispatch.json").write_text(json.dumps(
            {"schemaVersion": "yeet-dispatch/v1", "headSha": "new", "prNumber": 7}))
        (self.inbox / "failures.ndjson").write_text("\n".join([
            _row("p0-acked"),
            _row("p0-old-head", headSha="old", prNumber=7),
        ]) + "\n")
        self.assertEqual(self._run(self._cfg()).failures, [])

    def test_expired_waiver_does_not_acknowledge(self) -> None:
        self.inbox.mkdir(parents=True)
        (self.inbox / "acks").mkdir()
        (self.inbox / "acks" / "p0-waived").write_text(json.dumps(
            {"resolution": {"kind": "waive", "expiresAt": "2020-01-01T00:00:00Z"}}))
        (self.inbox / "failures.ndjson").write_text(_row("p0-waived") + "\n")
        self.assertEqual(len(self._run(self._cfg()).failures), 1)

    def test_active_file_wins_when_versioned(self) -> None:
        self.inbox.mkdir(parents=True)
        (self.inbox / "failures.ndjson").write_text(_row("p0-stale") + "\n")
        (self.inbox / "active.ndjson").write_text("")
        (self.inbox / "active-p0-safe-v2").write_text("")
        self.assertEqual(self._run(self._cfg()).failures, [])

    def test_cli_probe_uses_auth_status_without_leaking_account(self) -> None:
        good = preflight.Report()
        fake = self._fake_claude(True)
        with mock.patch.dict(os.environ, {"CLAUDE_CLI_BIN": fake}):
            preflight.check_backends(self._cfg(fake), good)
        self.assertEqual(good.failures, [])
        rollout = [n for n in good.notes if n.startswith("rollout target")]
        self.assertTrue(rollout and "logged in" in rollout[0], good.notes)
        self.assertNotIn("example.invalid", " ".join(good.notes + good.failures))

        bad = preflight.Report()
        preflight.check_claude(self._fake_claude(False), "rollout target", bad)
        self.assertEqual(len(bad.failures), 1)
        self.assertIn("not logged in", bad.failures[0])

        missing = preflight.Report()
        preflight.check_claude(str(self.root / "no-such-claude"), "rollout target", missing)
        self.assertIn("not found", missing.failures[0])

    def test_alias_model_is_flagged(self) -> None:
        report = preflight.Report()
        fake = self._fake_claude(True)
        with mock.patch.dict(os.environ, {"CLAUDE_CLI_BIN": fake}):
            preflight.check_backends(self._cfg(fake, target_model="opus"), report)
        self.assertTrue(any("alias" in note for note in report.notes))


if __name__ == "__main__":
    unittest.main()
