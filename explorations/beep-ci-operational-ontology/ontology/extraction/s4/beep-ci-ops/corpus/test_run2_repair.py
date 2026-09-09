"""Ruling 23 regressions for the run-2 repair path and committed provenance.

Run with ``uv run --offline --with pyyaml python -m unittest discover
-s <corpus-directory> -p test_run2_repair.py``. Fixtures stay in this checkout.
"""
import contextlib
import copy
import importlib.util
import io
import json
import runpy
import socket
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import etl_fleet_corpus as fleet


class RepairRedactionTests(unittest.TestCase):
    def test_numeric_uid_prefixes_match_the_later_generators(self):
        for original, expected in (("uid-0", "uid-<uid>"), ("uid-4294967295.sock", "uid-<uid>.sock"),
                                   ("uid-123suffix", "uid-<uid>suffix")):
            with self.subTest(original=original):
                self.assertEqual(fleet.redact_string_values(original, repair=True), expected)
                with self.assertRaisesRegex(SystemExit, "numeric UID token"):
                    fleet.scan_output_bytes([("fixture", original.encode())])

    def test_repair_only_rewrites_nested_strings_at_every_json_depth(self):
        with patch.object(socket, "gethostname", return_value="fixture-host"):
            digest = fleet.sha256(b"fixture-host")[:12]
            original = f"beep-yeet-proof-locks-{digest}-uid-12345"
            expected = "beep-yeet-proof-locks-<host>-uid-<uid>"
            for depth in range(5):
                with self.subTest(depth=depth):
                    value = {"message": [original], "uid": 12345, "ok": True, "nil": None}
                    self.assertEqual(fleet.redact_string_values(value), value)
                    result = fleet.redact_string_values(value, repair=True)
                    self.assertEqual(result, {**value, "message": [expected]})
                    self.assertEqual(fleet.redact_string_values(result, repair=True), result)
                    fleet.scan_output_bytes([("fixture", fleet.encode_json(result))])
                    original = json.dumps({"message": original})
                    expected = json.dumps({"message": expected})

    def test_safe_lookalikes_keys_and_scalar_types_are_preserved(self):
        with patch.object(socket, "gethostname", return_value="fixture-host"):
            value = {"uid-123": [None, True, False, 123, 1.5],
                     "message": "guid-123 uid-<uid> uid-abc <host> abcdef012345 runId=123"}
            self.assertEqual(fleet.redact_string_values(value, repair=True), value)
            fleet.scan_output_bytes([("fixture", value["message"].encode())])

    def test_scanner_rejects_each_class_in_paths_and_contents_without_echo(self):
        with patch.object(socket, "gethostname", return_value="fixture-host"):
            for private in (fleet.sha256(b"fixture-host")[:12], "uid-12345"):
                for path, data in (("fixture", private.encode()), (private, b"safe")):
                    with self.subTest(path_sensitive=path != "fixture"):
                        with self.assertRaisesRegex(SystemExit, "residue scan failed") as exc:
                            fleet.scan_output_bytes([(path, data)])
                        self.assertNotIn(private, str(exc.exception))

    def test_runtime_hostname_changes_are_not_cached_or_persisted(self):
        for host in ("fixture-alpha", "fixture-beta"):
            with patch.object(socket, "gethostname", return_value=host):
                digest = fleet.sha256(host.encode())[:12]
                self.assertEqual(fleet.redact_string_values(digest, repair=True), "<host>")
                self.assertNotIn(digest, " ".join(fleet.REPAIR_REDACTION_RULES))

    def test_pid_redaction_still_preserves_embedded_json(self):
        for pid in (1234567, "1234567"):
            message = json.dumps({"pid": pid, "runId": 1234567})
            for _ in range(5):
                result = fleet.redact_string_values(message, repair=True)
                fleet.scan_output_bytes([("fixture", result.encode())])
                with self.assertRaises(SystemExit):
                    fleet.scan_output_bytes([("fixture", message.encode())])
                decoded = result
                while isinstance(decoded, str):
                    decoded = json.loads(decoded)
                self.assertEqual(decoded, {"pid": None if isinstance(pid, int) else "<redacted>",
                                           "runId": 1234567})
                message = json.dumps(message)


class CommittedRepairTests(unittest.TestCase):
    def test_history_replay_integrity_and_idempotence(self):
        script = fleet.REPO_ROOT / "goals/codex-security-findings-2026-09-08/research/scripts/resanitize-corpora.py"
        spec = importlib.util.spec_from_file_location("repair_run2_corpora", script)
        repair = importlib.util.module_from_spec(spec)
        with patch.object(sys, "dont_write_bytecode", True):
            spec.loader.exec_module(repair)
        scratch = fleet.REPO_ROOT / ".beep/run2-residue-repair"
        scratch.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=scratch) as name:
            repo = Path(name)
            corpus = repo / "corpus"
            pin = corpus / "run2-fleet"
            pin.mkdir(parents=True)
            generator = corpus / "etl_fleet_corpus.py"
            generator.write_text("# original generator fixture\n")

            def git(*args):
                return subprocess.run(
                    ["git", "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
                     "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", *args],
                    cwd=repo, capture_output=True, text=True, check=True,
                ).stdout.strip()

            def snapshot():
                return {p.relative_to(pin).as_posix(): p.read_bytes()
                        for p in pin.rglob("*") if p.is_file()}

            with patch.object(fleet, "SCRIPT", generator), patch.object(fleet, "OUTPUT_ROOT", pin), \
                 patch.object(repair, "ROOT", repo), patch.object(repair, "CORPUS", corpus), \
                 patch.object(repair, "load_generator", return_value=fleet), \
                 patch.object(socket, "gethostname", return_value="fixture-host"), \
                 patch.object(fleet, "discover_live_capture", side_effect=AssertionError("no live capture")), \
                 contextlib.redirect_stdout(io.StringIO()):
                private = f"beep-yeet-proof-locks-{fleet.sha256(b'fixture-host')[:12]}-uid-12345"
                row = {"schemaVersion": fleet.ADMISSION_SCHEMA, "admittedAtMillis": 1767225600000,
                       "ownerRef": "custody-fixture", "message": private}
                path = "admission/fixture/journal.ndjson"
                raw = fleet.EmittedFile(
                    path=path, data=fleet.encode_ndjson([row]), kind="admission", event_count=1,
                    timestamps=fleet.collect_timestamps(row, path),
                    source="machine admission journal (fixture root), yeet-admission-journal/v1",
                    source_file="journal.ndjson",
                )
                emitted = sorted(fleet.with_properties_projection(raw, [row]), key=lambda item: item.path)
                original = fleet.yaml.safe_load(fleet.build_manifest(emitted))
                first = {"finding": "CSF-012", "source_manifest_sha256": "a" * 64,
                         "changed_raw_payloads": 1, "live_recapture": False,
                         "superseded_manifest_sha256": "b" * 64}
                original["security_resanitization"] = copy.deepcopy(first)
                for entry in emitted:
                    target = pin / entry.path
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(entry.data)
                manifest_path = pin / fleet.MANIFEST_NAME
                original_bytes = fleet.dump_manifest_with_totals(original, sum(len(e.data) for e in emitted))
                manifest_path.write_bytes(original_bytes)
                before = snapshot()
                git("init", "-q")
                git("add", "--", "corpus")
                git("commit", "-qm", "fixture: capture original pin")
                source_ref = git("rev-parse", "HEAD")
                generator.write_text("# committed updated generator fixture\n")
                git("add", "--", "corpus/etl_fleet_corpus.py")
                git("commit", "-qm", "fixture: update generator")

                with self.assertRaisesRegex(SystemExit, "no matching committed provenance"):
                    repair.verify_generator_provenance(fleet, "0" * 64)
                (pin / path).write_bytes(b"corrupted\n")
                corrupted = snapshot()
                with self.assertRaisesRegex(SystemExit, "mismatched integrity"):
                    repair.repair("etl_fleet_corpus")
                self.assertEqual(snapshot(), corrupted)

                # Explicit source replay reads Git, despite corrupt destination bytes.
                repair.repair("etl_fleet_corpus", source_ref)
                repaired = snapshot()
                manifest = fleet.yaml.safe_load(repaired[fleet.MANIFEST_NAME])
                history = manifest["security_resanitization"]
                self.assertEqual({key: history[key] for key in first}, first)
                self.assertEqual(len(history["updates"]), 1)
                update = history["updates"][0]
                self.assertEqual(update["ruling"], "Ruling 23")
                self.assertEqual(update["residue_classes"], ["sha12(hostname)", "uid-[0-9]+"])
                self.assertEqual(update["source_manifest_sha256"], fleet.sha256(original_bytes))
                self.assertEqual(update["changed_raw_payloads"], 1)
                self.assertFalse(update["live_recapture"])
                for entry in emitted:
                    self.assertEqual(repaired[entry.path], before[entry.path].replace(
                        private.encode(), b"beep-yeet-proof-locks-<host>-uid-<uid>"))
                for old, new in zip(original["files"], manifest["files"], strict=True):
                    self.assertEqual({k: v for k, v in old.items() if k not in ("bytes", "sha256")},
                                     {k: v for k, v in new.items() if k not in ("bytes", "sha256")})
                for key in ("capture_instant", "admission", "checkouts", "ordering", "projection_rules"):
                    self.assertEqual(manifest[key], original[key])
                fleet.verify_output_tree(pin)
                repair.repair("etl_fleet_corpus")
                self.assertEqual(snapshot(), repaired)
                repair.repair("etl_fleet_corpus", source_ref)
                replay = fleet.yaml.safe_load(manifest_path.read_bytes())
                self.assertEqual({key: replay["security_resanitization"][key] for key in first}, first)
                self.assertEqual(replay["security_resanitization"]["updates"][0]["source_manifest_sha256"],
                                 fleet.sha256(original_bytes))
                fleet.verify_output_tree(pin)

    def test_ordinary_verify_never_recaptures_or_rewrites(self):
        with patch.object(sys, "argv", [fleet.SCRIPT.name]), \
             patch.object(fleet, "discover_live_capture", side_effect=AssertionError("no live capture")), \
             patch.object(fleet, "write_staged_capture", side_effect=AssertionError("no write")), \
             patch.object(subprocess, "run", side_effect=AssertionError("no subprocess")), \
             contextlib.redirect_stdout(io.StringIO()):
            fleet.main()

    def test_run2_only_cli_never_loads_another_generator(self):
        script = fleet.REPO_ROOT / "goals/codex-security-findings-2026-09-08/research/scripts/resanitize-corpora.py"
        load_spec = importlib.util.spec_from_file_location

        def only_run2(name, path):
            self.assertEqual(name, "etl_fleet_corpus")
            return load_spec(name, path)

        with patch.object(sys, "argv", [str(script), "--run2-only"]), \
             patch.object(sys, "dont_write_bytecode", True), \
             patch.object(importlib.util, "spec_from_file_location", side_effect=only_run2), \
             contextlib.redirect_stdout(io.StringIO()):
            runpy.run_path(str(script), run_name="__main__")


if __name__ == "__main__":
    unittest.main()
