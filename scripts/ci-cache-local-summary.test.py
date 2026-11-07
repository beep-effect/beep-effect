"""Tiny-fixture controls; never executes a native pilot, installer or toolchain."""
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("local_summary", HERE / "ci-cache-local-summary.py")
summary = importlib.util.module_from_spec(spec)
spec.loader.exec_module(summary)
REVISION = "a" * 40
SYNTHETIC = "SYNTHETIC_NOT_A_REAL_SECRET_7351"
CLIENT = {"version": "2.11.10", "sha256": "b" * 64, "namespace": "team_beep_local_observation_v1"}
CONTRACT_OUTPUT = Path(os.environ["BEEP_CACHE_SUMMARY_CONTRACT_OUTPUT"])


def fixture():
    request = {"channel": "stable", "client": CLIENT, "selection": "full"}
    report = {
        "schemaVersion": "cache-pilot-local/v5", "authority": "local-observation-only",
        "sourceRevision": REVISION, "channel": "stable", "client": CLIENT,
        "key": {"computation": "@beep/types#lint"}, "selection": "full",
        "checks": [{"name": "bounded-control", "passed": True}],
        "runs": [{}], "mutations": [{}], "nonExecutions": [{}],
    }
    return report, request


class SummaryControls(unittest.TestCase):
    def test_success_and_synthetic_payload_redaction(self):
        report, request = fixture()
        report["privatePath"] = "/private/" + SYNTHETIC
        report["runs"] = [{"stdout": SYNTHETIC}]
        report["checks"] = [{"name": SYNTHETIC, "passed": False}]
        raw = json.dumps(report).encode()
        projected = summary.summarize(raw, json.dumps(request), REVISION, "stable", "@beep/types#lint")
        self.assertNotIn(SYNTHETIC, json.dumps(projected))
        self.assertNotIn("/private/", json.dumps(projected))
        self.assertFalse(projected["allChecksPassed"])
        self.assertFalse(projected["qualificationGranted"])
        self.assertEqual(projected["failedLabelSha256"], [hashlib.sha256(SYNTHETIC.encode()).hexdigest()])
        self.assertEqual(projected["privateReceipt"]["sha256"], hashlib.sha256(raw).hexdigest())

    def test_wrong_source_authority_client_and_non_boolean_results_refuse(self):
        original, request = fixture()
        for field, value in [("sourceRevision", "c" * 40), ("authority", "qualified"),
                             ("selection", "controls"), ("client", {**CLIENT, "sha256": "c" * 64}),
                             ("checks", [{"name": "fixture", "passed": "true"}]), ("runs", [])]:
            report = copy.deepcopy(original)
            report[field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                summary.summarize(json.dumps(report), json.dumps(request), REVISION, "stable", "@beep/types#lint")

    def test_fanout_and_published_failure_labels_are_bounded(self):
        report, request = fixture()
        report["checks"] = [{"name": f"control-{n}", "passed": False} for n in range(100)]
        projected = summary.summarize(json.dumps(report), json.dumps(request), REVISION, "stable", "@beep/types#lint")
        self.assertEqual(len(projected["failedLabelSha256"]), 64)
        self.assertEqual(projected["omittedFailedLabels"], 36)
        report["checks"] *= 11
        with self.assertRaises(ValueError):
            summary.summarize(json.dumps(report), json.dumps(request), REVISION, "stable", "@beep/types#lint")

    def test_reader_accepts_regular_files_and_refuses_aliases_and_overflow(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            file = root / "receipt"
            file.write_bytes(b"fixture")
            self.assertEqual(summary.read_regular(file, 7), b"fixture")
            with self.assertRaises(ValueError):
                summary.read_regular(file, 6)
            alias = root / "alias"
            alias.symlink_to(file)
            with self.assertRaises(OSError):
                summary.read_regular(alias, 7)
            fifo = root / "fifo"
            os.mkfifo(fifo)
            with self.assertRaises(ValueError):
                summary.read_regular(fifo, 7)

    def test_publication_is_exclusive_and_does_not_print_private_values(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            report, request = fixture()
            report["privatePayload"] = SYNTHETIC
            source = root / "receipt.json"
            source.write_text(json.dumps(report))
            input_file = root / "request.json"
            input_file.write_text(json.dumps(request))
            output = root / "public.json"
            command = [sys.executable, "-I", "-S", "-B", str(HERE / "ci-cache-local-summary.py"),
                       "--report", str(source), "--request", str(input_file), "--output", str(output),
                       "--revision", REVISION, "--channel", "stable", "--computation", "@beep/types#lint"]
            first = subprocess.run(command, capture_output=True, timeout=5)
            self.assertEqual(first.returncode, 0, first.stderr)
            public = output.read_bytes()
            CONTRACT_OUTPUT.write_bytes(public)
            self.assertNotIn(SYNTHETIC.encode(), public + first.stdout + first.stderr)
            self.assertLessEqual(len(public), summary.SUMMARY_LIMIT)
            self.assertEqual(output.stat().st_mode & 0o777, 0o600)
            second = subprocess.run(command, capture_output=True, timeout=5)
            self.assertEqual(second.returncode, 1)
            self.assertEqual(output.read_bytes(), public)


class PreparationControls(unittest.TestCase):
    def test_both_request_layouts_preserve_json_and_output_framing(self):
        source = (HERE / "ci-cache-pilot-inputs.sh").read_text()
        blocks = re.findall("python3 - <<'PY'\n(.*?)\nPY", source, re.S)
        self.assertEqual(len(blocks), 2)
        for mode, computation, profile in [
            ("signed", "@beep/identity#lint", "packages/foundation/modeling/identity/turbo.json"),
            ("local", "@beep/types#lint", "packages/foundation/primitive/types/turbo.json"),
        ]:
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory:
                root = Path(directory) / "root"
                root.mkdir()
                private = Path(directory) / "private"
                private.mkdir()
                native = root / "node_modules/@turbo/linux-64/bin/turbo"
                native.parent.mkdir(parents=True)
                native.write_bytes(b"fixture-native-never-executed")
                pins = root / "goals/turborepo-quality-cache-adoption/research/errors-only-client-pins.json"
                pins.parent.mkdir(parents=True)
                pins.write_text(json.dumps({"stable": {"reportedVersion": "2.11.10", "sha256": hashlib.sha256(native.read_bytes()).hexdigest()}}))
                config = root / profile
                config.parent.mkdir(parents=True)
                config.write_text(json.dumps({"tasks": {"lint": {"cache": False}}}))
                biome = root / "node_modules/@biomejs/cli-linux-x64/biome"
                biome.parent.mkdir(parents=True)
                biome.write_bytes(b"fixture-biome-never-executed")
                node = root / "fixture-bin/node"
                node.parent.mkdir()
                node.write_text("fixture-node-never-executed")
                node.chmod(0o500)
                output = root / "outputs"
                relative = ".beep/cache/protected-producer-trial" if mode == "signed" else ".beep/cache/local-pilot-observation"
                env = {"BEEP_CACHE_PRODUCER_PRIVATE_ROOT": str(private), "BEEP_CACHE_PRODUCER_CHANNEL": "stable",
                       "BEEP_CACHE_PILOT_COMPUTATION": computation, "BEEP_CACHE_PILOT_MODE": mode,
                       "BEEP_CACHE_PILOT_INPUTS": relative, "GITHUB_RUN_ID": "11", "GITHUB_RUN_ATTEMPT": "1",
                       "GITHUB_SHA": REVISION, "GITHUB_OUTPUT": str(output), "PATH": str(node.parent)}
                previous = Path.cwd()
                try:
                    os.chdir(root)
                    with mock.patch.dict(os.environ, env, clear=True):
                        exec(compile(blocks[0], "pilot-inputs-first", "exec"), {})
                        folder = root / relative
                        self.assertEqual(len(output.read_text().splitlines()), 3)
                        self.assertEqual(json.loads((folder / "activation-request.json").read_text())["computation"], computation)
                        for name in ("activation.json", "dependencies.json"):
                            (folder / name).write_text("{}\n")
                        with mock.patch("subprocess.run") as git:
                            exec(compile(blocks[1], "pilot-inputs-second", "exec"), {})
                            self.assertEqual(git.call_count, 2)
                        prepared = json.loads((folder / "request.json").read_text())
                        pilot = prepared["pilot"] if mode == "signed" else prepared
                        self.assertEqual(pilot["selection"], "full")
                        self.assertEqual(pilot["client"]["namespace"], "team_beep_signed_canary_v1" if mode == "signed" else "team_beep_local_observation_v1")
                        self.assertEqual(len(pilot["worktrees"]), 2)
                finally:
                    os.chdir(previous)

    def test_signed_types_and_unknown_modes_refuse_before_any_tool_executes(self):
        for mode, computation in [("signed", "@beep/types#lint"), ("unknown", "@beep/identity#lint"),
                                  ("local", "@beep/unknown#lint")]:
            result = subprocess.run(["/usr/bin/bash", str(HERE / "ci-cache-pilot-inputs.sh"), mode, computation],
                                    env={"PATH": "/nonexistent"}, capture_output=True, timeout=5)
            self.assertEqual(result.returncode, 64)

    def test_cleanup_refuses_foreign_inputs_and_preserves_them(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            workspace = root / "workspace"
            workspace.mkdir()
            runner = root / "runner"
            runner.mkdir()
            private = runner / "beep-cache-local-observation.abc123"
            private.mkdir()
            foreign = root / "foreign"
            foreign.mkdir()
            (foreign / "sentinel").write_text("preserve")
            env = {"PATH": "/usr/bin", "HOME": str(root), "GITHUB_WORKSPACE": str(workspace), "RUNNER_TEMP": str(runner),
                   "GITHUB_RUN_ID": "11", "GITHUB_RUN_ATTEMPT": "1", "TRIAL_ROOT": str(private),
                   "TRIAL_INPUTS": str(foreign), "TRIAL_WORKTREE_A": "", "TRIAL_WORKTREE_B": ""}
            result = subprocess.run(["/usr/bin/bash", str(HERE / "ci-cache-pilot-cleanup.sh"), "local"],
                                    env=env, capture_output=True, timeout=5)
            self.assertEqual(result.returncode, 1)
            self.assertEqual((foreign / "sentinel").read_text(), "preserve")
            self.assertFalse(private.exists())
            self.assertIn(b"Refusing unexpected producer input directory", result.stdout)


if __name__ == "__main__":
    unittest.main()
