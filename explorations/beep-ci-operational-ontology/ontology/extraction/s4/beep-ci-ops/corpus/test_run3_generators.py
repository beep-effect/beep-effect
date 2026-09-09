"""Public-safety and pin-contract regressions for the standalone Stage A ETLs.

Run with the generators' offline PyYAML environment:
  python -m unittest discover -s <corpus-directory> -p test_run3_generators.py
Fixtures are synthetic; no fixture traffic touches a real scheduler root.
"""
import collections
import contextlib
import importlib.util
import io
import json
import os
import socket
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


def load(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).parent / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


fleet = load("etl_run3_fleet_corpus")
identity = load("etl_run3_checkout_identity")


class RedactionTests(unittest.TestCase):
    def test_versions_exclusions_order_and_weak_custody(self):
        rows = [
            {"schemaVersion": f"yeet-admission-journal/v{v}", "_tag": "event",
             "pid": 123, "procStart": "start", "nonce": str(v), "weightTokens": 3}
            for v in (1, 2, 3)
        ]
        weak = {"schemaVersion": "yeet-admission-journal/v1", "pid": 123}
        source = fleet.encode_ndjson(rows + [weak, {"schemaVersion": "future", "pid": 123},
                                           {"schemaVersion": []}, [], None])
        source += b'not json\n{"x":1,"x":2}\n'
        actual, receipt = fleet.transform_source(source, "admission", b"a" * 32)
        self.assertEqual([r.get("nonce") for r in actual], ["1", "2", "3", None])
        self.assertEqual(receipt["excluded_undecodable"], 6)
        self.assertEqual(receipt["excluded_by_reason"], {"unknown-schema-version": 2, "non-object": 2, "invalid-json": 2})
        self.assertEqual(receipt["retained_source_lines"], [1, 2, 3, 4])
        self.assertEqual(receipt["redaction_counts"]["owner_refs_without_proc_start"], 1)
        self.assertEqual(len({r["ownerRef"] for r in actual[:3]}), 1)
        self.assertNotEqual(actual[0]["ownerRef"], actual[3]["ownerRef"])
        refreshed, _ = fleet.transform_source(source, "admission", b"b" * 32)
        self.assertNotEqual(actual[0]["ownerRef"], refreshed[0]["ownerRef"])
        self.assertEqual(actual[0]["weightTokens"], 3)
        self.assertFalse(any("pid" in r or "procStart" in r for r in actual))

    def test_all_families_share_rewrite_and_preserve_scalar_types(self):
        for module in (fleet, identity):
            system = Path(os.sep) / "tmp"
            session = Path.home() / "session-temp-fixture"
            with patch.object(module.tempfile, "gettempdir", return_value=str(session)):
                value = {"checkoutRoot": str(module.FLEET_ROOT / "beep-effect-fixture"),
                         "home": str(Path.home() / "data"), "session": str(session / "state"),
                         "system": str(system / "state"), "command": "run pid:123",
                         "hotPaths": [str(session / "hot")],
                         "runScope": {"unitName": "agent-run-fixture.scope"},
                         "bare": str(system), "branch": "feat/tmpfs-reap", "n": 0,
                         "b": True, "null": None, "nested": {"ownerPid": 789, "procStart": "raw"}}
                result = module.redact(value, b"a" * 32, collections.Counter())
                self.assertEqual(result["session"], "<session-tmp>/state")
                self.assertEqual(result["system"], "<tmp>/state")
                self.assertEqual(result["bare"], "<tmp>")
                self.assertEqual(result["branch"], "feat/tmpfs-reap")
                self.assertEqual(result["checkoutRoot"], "<fleet>/beep-effect-fixture")
                self.assertEqual(result["home"], "<home>/data")
                self.assertEqual(result["nested"], {})
                self.assertIs(result["b"], True)
                self.assertIs(result["null"], None)
                self.assertIs(type(result["n"]), int)
                module.scan_output_bytes([("fixture", module.encode_json(result))])

    def test_residue_guard_rejects_every_sensitive_class_without_echo(self):
        for module in (fleet, identity):
            hostname = socket.gethostname().encode()
            bad = [str(module.FLEET_ROOT / "file").encode(), str(Path.home() / "file").encode(),
                   str(Path(tempfile.gettempdir()) / "file").encode(), b"pid:123",
                   b"ghp_" + b"x" * 25, b"github_pat_" + b"x" * 25,
                   b"op://vault/item/field=Abcdef1234567890", hostname,
                   module.sha256(hostname)[:12].encode(), b"https://user:pass@example.invalid/repo"]
            for data in bad:
                with self.subTest(module=module.__name__, size=len(data)):
                    with self.assertRaises(SystemExit) as exc:
                        module.scan_output_bytes([("fixture", data)])
                    self.assertNotIn(data.decode(), str(exc.exception))
            module.scan_output_bytes([("tmpfs-fixture", b"branch=feat/tmpfs-reap\n")])

    def test_hostname_hash_rewrite_and_origin_credential_guard(self):
        for module in (fleet, identity):
            host = socket.gethostname()
            self.assertEqual(module.redact_string(module.sha256(host.encode())[:12]), "<host>")
            url = "git@example.invalid:group/repo.git"
            self.assertEqual(module.redact({"originUrl": url}, None, collections.Counter(), True)["originUrl"], url)
            with self.assertRaises(SystemExit):
                module.guard_origin("https://user:credential@example.invalid/repo")

    def test_projection_preserves_occurrences_arrays_and_eligibility(self):
        row = {"key": "first", "nested": {"key": "second", "null": None},
               "array": [1, False, "x", {"key": "third"}],
               "bad-key": "omit", "multiline": "omit\nthis", "empty": ""}
        expected = b"# record 0\nkey=first\nkey=second\narray=1\narray=false\narray=x\nkey=third\n"
        for module in (fleet, identity):
            self.assertEqual(module.encode_properties_projection([row]), expected)
            self.assertEqual(module.projection_path("attempts/parent-worktrees/name/run/attempts.ndjson"),
                             "attempts/parent-worktrees/name/run/attempts.properties")

    def test_failure_occurrence_is_joined_in_one_object(self):
        records = {"attempts/fixture/run/attempts.ndjson": [
            {"verdict": {"failureKind": "step-exit", "failedStepId": "full:check"}},
            {"failureKind": "step-exit", "child": {"failedStepId": "full:test"}}]}
        evidence = fleet.rider_evidence(records)
        self.assertEqual(evidence["pa-failure-signature"]["structured_occurrences"], 1)
        self.assertEqual(evidence["pa-cache-plan-resolution"]["rider_evidence"], "absent")


class IdentityTests(unittest.TestCase):
    def test_preview_process_names_are_distinct_private_aliases(self):
        snapshot = {"checkouts": [{"path": "root/merged-preview-123"},
                                  {"path": "root/merged-preview-1234"}]}
        aliases = identity.preview_aliases(snapshot)
        rewritten = identity.rewrite_preview_paths(snapshot, aliases)
        self.assertEqual([r["path"] for r in rewritten["checkouts"]],
                         ["root/merged-preview-owner-0000", "root/merged-preview-owner-0001"])
        with self.assertRaises(SystemExit):
            identity.scan_output_bytes([("fixture", identity.encode_json(snapshot))])
        identity.scan_output_bytes([("fixture", identity.encode_json(rewritten))])


    def test_external_labels_are_portable_and_not_hashed(self):
        p = Path.home() / ".codex/worktrees/fixture/beep-effect"
        self.assertEqual(identity.checkout_label(p), "external/operator-home/.codex/worktrees/fixture/beep-effect")

    def test_cache_mount_config_and_process_environment_scope(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            (root / "cache").mkdir()
            (root / "cache/one").write_text("fixture")
            (root / "turbo.json").write_text(json.dumps({"futureFlags": {"globalConfiguration": True},
                "global": {"cacheDir": "cache", "remoteCache": {"enabled": False, "signature": True}}}))
            presence = {"TURBO_TOKEN": True, "TURBO_TEAM": False, "TURBO_API": False}
            result = identity.cache_mount(root, "fixture", presence)
            self.assertEqual(result["turbo_local_cache_entries"], 1)
            self.assertFalse(result["turbo_remote_cache_configured"])
            self.assertTrue(result["turbo_remote_cache_signature_configured"])
            self.assertEqual(result["turbo_remote_cache_env_present"], presence)


class PinnedContractTests(unittest.TestCase):
    def test_ordinary_rerun_cannot_capture_read_source_or_spawn(self):
        for module in (fleet, identity):
            if not module.OUTPUT_ROOT.exists():
                self.fail(module.OUTPUT_ROOT.name + " must be pinned before acceptance tests")
            with patch.object(sys, "argv", [module.SCRIPT.name]), \
                 patch.object(module, "capture", side_effect=AssertionError("live capture forbidden")), \
                 patch.object(module, "source_cite", side_effect=AssertionError("source read forbidden")), \
                 patch.object(module.subprocess, "run", side_effect=AssertionError("subprocess forbidden")), \
                 patch.object(module.os, "urandom", side_effect=AssertionError("new salt forbidden")), \
                 contextlib.redirect_stdout(io.StringIO()):
                module.main()

    def test_pin_corruption_fails_then_original_bytes_verify(self):
        for module in (fleet, identity):
            target = next(p for p in module.OUTPUT_ROOT.rglob("*.properties"))
            original = target.read_bytes()
            try:
                target.write_bytes(original + b"corrupted=fixture\n")
                with self.assertRaises(SystemExit):
                    module.verify_output_tree(module.OUTPUT_ROOT)
            finally:
                target.write_bytes(original)
            module.verify_output_tree(module.OUTPUT_ROOT)


if __name__ == "__main__":
    unittest.main()
