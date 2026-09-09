"""Stage B privacy, loss census, and independent pin-contract regressions.

Run: UV_CACHE_DIR=~/.cache/beep/uv-cache uv run --offline --with pyyaml python
     -m unittest discover -s <corpus-directory> -p test_run3b_generator.py
Fixtures are synthetic and never touch scheduler state or the frozen corpora.
"""
import collections
import contextlib
import copy
import importlib.util
import io
import json
import os
import socket
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import yaml

spec = importlib.util.spec_from_file_location("etl_run3b_fleet_corpus", Path(__file__).with_name("etl_run3b_fleet_corpus.py"))
etl = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = etl
spec.loader.exec_module(etl)


def event(tag, nonce, **fields):
    version = 1 if tag == "admission-admitted" else 3
    return {"schemaVersion": f"yeet-admission-journal/v{version}", "_tag": tag, "nonce": nonce,
            "pid": 4242, "procStart": "start-fixture", **fields}


def fixture_export(root):
    admission = root / "admission"
    admission.mkdir(parents=True)
    for family in etl.LIVE_FAMILIES:
        (admission / family).mkdir()
    checkout_roots = {label: root / "producer-temp" / label for label in etl.SYNTHETIC_SOURCE_LABELS}
    rows = [event("admission-enqueued", "a", enqueuedAtMillis=1000, checkoutRoot=str(checkout_roots["contender-a"])),
            event("admission-admitted", "a", enqueuedAtMillis=1000, admittedAtMillis=2000),
            event("admission-enqueued", "b", enqueuedAtMillis=2200, checkoutRoot=str(checkout_roots["contender-b"])),
            event("admission-withdrawn", "b", enqueuedAtMillis=2200, withdrawnAtMillis=2300),
            event("admission-lease-evicted", "lease", lastHeartbeatAtMillis=2400, evictedAtMillis=2500,
                  checkoutRoot=str(checkout_roots["dead-lease"]), attemptId="lease-attempt"),
            event("admission-ticket-evicted", "ticket", evictedAtMillis=2600,
                  checkoutRoot=str(checkout_roots["dead-ticket"]), attemptId="ticket-attempt"),
            event("admission-released", "a", releasedAtMillis=3000, checkoutRoot=str(checkout_roots["contender-a"]))]
    for row in rows:
        if row["_tag"] in {"admission-released", "admission-lease-evicted", "admission-ticket-evicted"}:
            del row["procStart"]
    (admission / "journal.ndjson").write_bytes(etl.encode_ndjson(rows))
    (admission / "protocol.json").write_bytes(etl.encode_json({"schemaVersion": etl.PROTOCOL_SCHEMA, "eviction": "on"}))
    claim = {"schemaVersion": "yeet-admission-reap-claim/v1", "_tag": "lease", "nonce": "lease",
             "sourcePath": str(admission / "leases/lease-4242.lease.json"), "claimedAtMillis": 2500,
             "admissionJournal": "pending", "attemptJournal": "complete",
             "lease": {"schemaVersion": "yeet-admission-lease/v1", "nonce": "lease", "pid": 4242,
                       "procStart": "start-fixture", "checkoutRoot": str(checkout_roots["dead-lease"]),
                       "heartbeatAtMillis": 2400, "hotPaths": [str(root / "hot")],
                       "runScope": {"unitName": f"user-{os.getuid()}.slice"}}}
    (admission / "claims/claim.reap.json").write_bytes(etl.encode_json(claim))
    (admission / "claims/claim.reap.json.lock.stage-fixture").write_text("must never be read")
    (admission / "queue/ignored.lock").write_text("must never be read")
    for label in etl.SYNTHETIC_LABELS:
        run = root / "checkouts" / label / ".beep/yeet/runs/main-fixture"
        run.mkdir(parents=True)
        records = [] if label == "contender-a" else [{"schemaVersion": etl.ATTEMPT_SCHEMA,
            "_tag": "attempt-terminated", "attemptId": "lease-attempt" if label == "dead-lease" else "ticket-attempt",
            "reason": "lease-eviction" if label == "dead-lease" else "queued-submitter-death",
            "recordedAt": "2026-01-01T00:00:00.000Z"}]
        (run / "attempts.ndjson").write_bytes(etl.encode_ndjson(records))
    chains = collections.defaultdict(list)
    for row in rows:
        chains[row["nonce"]].append(row["_tag"])
    scenario = {"producer": {"path": "packages/tooling/tool/cli/test/quality-scheduler-synthetic-scenario.test.ts", "sha256": "a" * 64},
                "steps": ["one holder", "one withdrawal", "dead lease and ticket", "holder releases"],
                "capturedAt": "2026-01-01T00:00:00.000Z",
                "expected": {"tags": dict(collections.Counter(r["_tag"] for r in rows)),
                             "chains": [{"nonce": nonce, "tags": tags} for nonce, tags in chains.items()]}}
    (root / "scenario.json").write_bytes(etl.encode_json(scenario))
    (root / "READY").touch()
    return rows, scenario


def tree_bytes(root):
    return {p.relative_to(root).as_posix(): p.read_bytes() for p in root.rglob("*") if p.is_file()}


class RedactionTests(unittest.TestCase):
    def test_nested_claim_custody_and_per_capture_salt(self):
        payload = {"schemaVersion": "yeet-admission-reap-claim/v1", "_tag": "lease", "nonce": "owner",
                   "sourcePath": str(Path(tempfile.gettempdir()) / "owner-4242.lease.json"),
                   "lease": {"pid": 4242, "procStart": "start", "nested": {"pid": 4242, "procStart": "start"}},
                   "ticket": {"pid": 4242, "n": 5, "flag": False, "null": None}}
        rows, receipt = etl.transform_source(etl.encode_json(payload), "live", b"a" * 32, False)
        actual = rows[0]
        self.assertEqual(actual["lease"]["ownerRef"], actual["lease"]["nested"]["ownerRef"])
        self.assertEqual(actual["lease"]["ownerRef"], etl.sha256(f"4242:start:{(b'a' * 32).hex()}".encode())[:12])
        self.assertNotEqual(actual["lease"]["ownerRef"], actual["ticket"]["ownerRef"])
        self.assertEqual(receipt["redaction_counts"]["owner_refs"], 3)
        self.assertEqual(receipt["redaction_counts"]["owner_refs_without_proc_start"], 1)
        self.assertEqual(actual["ticket"]["n"], 5)
        self.assertIs(actual["ticket"]["flag"], False)
        self.assertIsNone(actual["ticket"]["null"])
        self.assertIn("owner-<process>.lease.json", actual["sourcePath"])
        refreshed, _ = etl.transform_source(etl.encode_json(payload), "live", b"b" * 32, False)
        self.assertNotEqual(actual["lease"]["ownerRef"], refreshed[0]["lease"]["ownerRef"])
        encoded = etl.encode_json(actual)
        self.assertNotIn(b"4242", encoded)
        self.assertNotIn((b"a" * 32).hex().encode(), encoded)
        etl.scan_output_bytes([("fixture", encoded)])

    def test_version_exclusions_and_source_order(self):
        rows = [event("admission-admitted", "first"), event("admission-enqueued", "second"),
                {"schemaVersion": "yeet-admission-journal/v2", "_tag": "admission-ticket-evicted", "nonce": "third", "pid": 123},
                {"schemaVersion": "future", "pid": 123}, [], {"schemaVersion": []},
                {"schemaVersion": "yeet-admission-journal/v1", "_tag": "admission-withdrawn", "nonce": "invalid"}]
        data = etl.encode_ndjson(rows) + b'not json\n{"x":1,"x":2}\n'
        retained, receipt = etl.transform_source(data, "admission", b"a" * 32)
        self.assertEqual([r["nonce"] for r in retained], ["first", "second", "third"])
        self.assertEqual(receipt["retained_source_lines"], [1, 2, 3])
        self.assertEqual(receipt["excluded_undecodable"], 6)
        self.assertEqual(receipt["excluded_by_reason"], {"unknown-schema-version": 2, "non-object": 1, "invalid-json": 2, "invalid-envelope": 1})

    def test_residue_rejects_private_classes_without_echoing(self):
        host = socket.gethostname().encode()
        bad = [str(etl.FLEET_ROOT / "private").encode(), str(Path.home() / "private").encode(),
               str(Path(tempfile.gettempdir()) / "private").encode(), b"/home/another/private", b"/tmp/private",
               b"/run/user/9876/state", b"/proc/123/status", b"/dev/shm/state", b"~/.beep/runtime/state",
               b"uid-1234", b"user@1234.service", b"user-1234.slice", b"pid123", b"pid=123", b"pid:123",
               b'{"pid":123}', b'{"procStart":"raw"}', b"nonce-123.lease.json", b"merged-preview-1234",
               host, etl.sha256(host)[:12].encode(), b"ghp_" + b"x" * 25, b"github_pat_" + b"x" * 25,
               b"op://vault/item/field=Abcdef1234567890", b"sk-proj-" + b"x" * 30,
               b"xoxb-" + b"x" * 20, b"AKIA" + b"X" * 16, b"-----BEGIN PRIVATE KEY-----",
               b"authorization: bearer private", b"api_key=" + b"A" * 16, b"https://user:pass@example.invalid"]
        for data in bad:
            with self.subTest(size=len(data)):
                with self.assertRaises(SystemExit) as exc:
                    etl.scan_output_bytes([("fixture", data)])
                self.assertNotIn(data.decode(), str(exc.exception))
        etl.scan_output_bytes([("safe", b"branch=feat/tmpfs-reap\nownerRef=abcdef012345\nuid-<uid>\n<proc>/<process>/status\n")])

    def test_string_rewrites_and_synthetic_mapping(self):
        roots = {str(Path(tempfile.gettempdir()) / "fixture" / label): f"<synthetic-checkout:{label}>" for label in etl.SYNTHETIC_SOURCE_LABELS}
        records = [{"checkoutRoot": root, "command": root + "/run", "hotPaths": [root + "/hot"]} for root in roots]
        self.assertEqual(etl.synthetic_checkout_aliases(records), roots)
        result = etl.redact(records, b"a" * 32, collections.Counter(), aliases=roots)
        for row, token in zip(result, roots.values()):
            self.assertEqual(row["checkoutRoot"], token)
            self.assertEqual(row["command"], token + "/run")
        for value in ("/proc/123/status", "/dev/shm/state", "/run/user/9876/state", "~/.beep/runtime/state", "uid-9876"):
            etl.scan_output_bytes([("rewritten", etl.redact_string(value).encode())])
        with self.assertRaises(SystemExit):
            etl.synthetic_checkout_aliases([{"checkoutRoot": str(Path(tempfile.gettempdir()) / "unknown")}])
        labels = ["fixture/.claude/worktrees/name", "fixture/.beep/name", "fixture%2Fname", "fixture/name"]
        encoded = [etl.checkout_component(label) for label in labels]
        self.assertEqual(len(set(encoded)), len(labels))
        self.assertTrue(all("/" not in label for label in encoded))


class CensusTests(unittest.TestCase):
    def test_all_six_classes_and_root_isolation(self):
        tags = {"win": ["enqueued", "admitted", "released"], "withdrawn": ["enqueued", "withdrawn"],
                "lease-evicted": ["lease-evicted"], "ticket-evicted": ["ticket-evicted"],
                "in-flight": ["enqueued", "admitted"], "pre-v3": ["admitted", "released"]}
        rows = [event("admission-" + tag, nonce, lastHeartbeatAtMillis=10, evictedAtMillis=20)
                for nonce, chain in tags.items() for tag in chain]
        other = [event("admission-enqueued", "win")]
        census = etl.loss_population({"admission/fixture/journal.ndjson": rows, "admission/other/journal.ndjson": other}, ["fixture", "other", "absent"])
        self.assertEqual(census["chain_counts"], {**dict.fromkeys(etl.CHAIN_CLASSES, 1), "in-flight": 2, "unclassified": 0})
        self.assertEqual(census["roots"][-1]["rows"], 0)
        self.assertEqual(census["heartbeat_check"]["checked_rows"], 1)
        self.assertEqual(census["heartbeat_check"]["violations"], 0)
        self.assertIsNone(etl.classify_chain(["admission-enqueued", "admission-released"]))
        self.assertIsNone(etl.classify_chain(["admission-enqueued", "admission-withdrawn", "admission-released"]))
        self.assertNotIn("waitMillis", json.dumps(census))

    def test_heartbeat_invariant_is_a_hard_check(self):
        bad = event("admission-lease-evicted", "bad", lastHeartbeatAtMillis=21, evictedAtMillis=20)
        with self.assertRaises(SystemExit):
            etl.loss_population({"admission/fixture/journal.ndjson": [bad]}, ["fixture"])

    def test_source_citations_resolve_from_committed_needles(self):
        self.assertEqual(etl.source_facts()["known_history_retention"]["value"], 2400)
        self.assertEqual(len(etl.known_losses()), 7)
        self.assertIn("claim", etl.join_keys())


class PinContractTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.export = self.base / "export"
        self.rows, self.scenario = fixture_export(self.export)
        self.outputs = {name: self.base / ("pin-" + name) for name in ("fleet", "synthetic")}
        self.patches = contextlib.ExitStack()
        self.addCleanup(self.patches.close)
        self.patches.enter_context(patch.object(etl, "OUTPUT_ROOTS", self.outputs))
        self.patches.enter_context(patch.object(etl, "admission_sources", return_value=[("fixture", self.export / "admission")]))
        self.patches.enter_context(patch.object(etl, "discover_checkouts", return_value=[("fixture/.claude/worktrees/name", self.export / "checkouts/dead-lease", "linked-worktree")]))
        self.patches.enter_context(patch.object(etl, "source_facts", return_value={}))
        self.patches.enter_context(patch.object(etl, "known_losses", return_value=[]))
        self.patches.enter_context(patch.object(etl, "join_keys", return_value={}))
        self.patches.enter_context(patch.object(etl, "source_cite", return_value={"file": "fixture.md", "line": 1, "needle": "fixture", "sha256": "a" * 64}))
        self.patches.enter_context(patch.object(etl, "git", return_value="a" * 40))

    def run_main(self, *args):
        output = io.StringIO()
        with patch.object(sys, "argv", [str(etl.SCRIPT), *map(str, args)]), contextlib.redirect_stdout(output):
            etl.main()
        return json.loads(output.getvalue())

    def verify_cli(self, population):
        runner = ("import importlib,sys; from pathlib import Path; "
                  "sys.path.insert(0,str(Path(sys.argv[1]).parent)); "
                  "m=importlib.import_module(Path(sys.argv[1]).stem); "
                  "m.verify_output_tree(Path(sys.argv[2]),sys.argv[3])")
        return subprocess.run([sys.executable, "-c", runner, str(etl.SCRIPT), str(self.outputs[population]), population], capture_output=True, text=True, timeout=30)

    def test_ready_gate_refuses_without_emission(self):
        (self.export / "READY").unlink()
        with self.assertRaisesRegex(SystemExit, "READY"):
            etl.capture("synthetic", self.export)
        self.assertFalse(self.outputs["synthetic"].exists())

    def test_expected_mismatch_refuses_pin(self):
        scenario = copy.deepcopy(self.scenario)
        scenario["expected"]["tags"]["admission-enqueued"] += 1
        (self.export / "scenario.json").write_bytes(etl.encode_json(scenario))
        with self.assertRaisesRegex(SystemExit, "tag census"):
            etl.capture("synthetic", self.export)
        scenario = copy.deepcopy(self.scenario)
        scenario["expected"]["chains"][0]["nonce"] = "different"
        (self.export / "scenario.json").write_bytes(etl.encode_json(scenario))
        with self.assertRaisesRegex(SystemExit, "nonce chains"):
            etl.capture("synthetic", self.export)

    def test_independent_roots_and_refreshes(self):
        first = self.run_main()
        self.assertEqual(first["fleet"]["status"], "pinned")
        self.assertEqual(first["synthetic"]["status"], "absent")
        fleet = tree_bytes(self.outputs["fleet"])
        result = self.run_main("--synthetic-root", self.export)
        self.assertEqual(result["synthetic"]["status"], "pinned")
        self.assertEqual(fleet, tree_bytes(self.outputs["fleet"]))
        synthetic = tree_bytes(self.outputs["synthetic"])
        self.run_main("--refresh", "fleet")
        self.assertEqual(synthetic, tree_bytes(self.outputs["synthetic"]))
        self.assertNotEqual(fleet, tree_bytes(self.outputs["fleet"]))
        fleet = tree_bytes(self.outputs["fleet"])
        with patch.object(etl, "admission_sources", side_effect=AssertionError("live read")), patch.object(etl, "discover_checkouts", side_effect=AssertionError("live read")):
            self.run_main("--refresh", "synthetic", "--synthetic-root", self.export)
        self.assertEqual(fleet, tree_bytes(self.outputs["fleet"]))
        self.assertNotEqual(synthetic, tree_bytes(self.outputs["synthetic"]))
        with self.assertRaisesRegex(SystemExit, "required"):
            self.run_main("--refresh", "all")

    def test_verify_never_reads_live_source_export_or_salt(self):
        self.run_main("--synthetic-root", self.export)
        before = {name: tree_bytes(root) for name, root in self.outputs.items()}
        with patch.object(etl, "capture", side_effect=AssertionError("capture")), \
             patch.object(etl, "read_synthetic_export", side_effect=AssertionError("export")), \
             patch.object(etl, "source_cite", side_effect=AssertionError("source")), \
             patch.object(etl.subprocess, "run", side_effect=AssertionError("subprocess")), \
             patch.object(etl.os, "urandom", side_effect=AssertionError("salt")):
            self.run_main("--synthetic-root", self.base / "does-not-exist")
        self.assertEqual(before, {name: tree_bytes(root) for name, root in self.outputs.items()})

    def test_synthetic_provenance_and_lock_exclusion(self):
        self.run_main("--synthetic-root", self.export)
        manifest = yaml.safe_load((self.outputs["synthetic"] / etl.MANIFEST_NAME).read_bytes())
        self.assertEqual(manifest["producer"], self.scenario["producer"])
        self.assertEqual(manifest["scenario_steps"], self.scenario["steps"])
        self.assertEqual(manifest["expected"], self.scenario["expected"])
        self.assertEqual(manifest["scenario_sha256"], etl.sha256((self.export / "scenario.json").read_bytes()))
        self.assertEqual(manifest["admission_roots"][0]["live"][2]["excluded_lock_files"], 1)
        for receipt in manifest["files"]:
            self.assertEqual(receipt["provenance"], "synthetic")
            path = self.outputs["synthetic"] / receipt["path"]
            self.assertNotIn(b"must never be read", path.read_bytes())
            if path.suffix == ".properties":
                self.assertTrue(path.read_bytes().startswith(b"# provenance: synthetic\n"))

    def test_unlisted_nested_manifest_is_not_exempt_from_inventory(self):
        self.run_main("--synthetic-root", self.export)
        root = self.outputs["synthetic"]
        extra = root / "unlisted" / etl.MANIFEST_NAME
        extra.parent.mkdir()
        extra.write_text("unlisted fixture")
        with self.assertRaisesRegex(SystemExit, "inventory"):
            etl.verify_output_tree(root, "synthetic")

    def test_corruption_and_same_length_receipt_or_census_mutation_fail_cli(self):
        self.run_main("--synthetic-root", self.export)
        for name, root in self.outputs.items():
            self.assertEqual(self.verify_cli(name).returncode, 0)
            payload = next(root.rglob("*.properties"))
            original = payload.read_bytes()
            try:
                payload.write_bytes(original + b"corrupt=fixture\n")
                self.assertNotEqual(self.verify_cli(name).returncode, 0)
            finally:
                payload.write_bytes(original)
            target = root / etl.MANIFEST_NAME
            manifest = target.read_bytes()
            mutations = [(b"win: 1", b"win: 2"),
                         (b"min_timestamp_observed: '1970-01-01T00:00:01.000Z'", b"min_timestamp_observed: '1970-01-01T00:00:01.001Z'"),
                         (b"max_timestamp_observed: '1970-01-01T00:00:03.000Z'", b"max_timestamp_observed: '1970-01-01T00:00:03.001Z'")]
            for old, new in mutations:
                self.assertIn(old, manifest)
                mutated = manifest.replace(old, new, 1)
                self.assertEqual(len(manifest), len(mutated))
                try:
                    target.write_bytes(mutated)
                    self.assertNotEqual(self.verify_cli(name).returncode, 0)
                finally:
                    target.write_bytes(manifest)
                self.assertEqual(self.verify_cli(name).returncode, 0)


if __name__ == "__main__":
    unittest.main()
