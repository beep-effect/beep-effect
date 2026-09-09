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
import re
import shutil
import socket
import subprocess
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
legacy = load("etl_fleet_corpus")
stage_b = load("etl_run3b_fleet_corpus")


class RedactionTests(unittest.TestCase):
    def test_generic_uid_and_state_filename_residue_matches_stage_b(self):
        for raw, expected in (("runtime uid-4242", "runtime uid-<uid>"),
                              ("merged-preview-4242", "merged-preview-<process>"),
                              ("nonce-4242.lease.json", "nonce-<process>.lease.json"),
                              ("nonce-4242.ticket.json", "nonce-<process>.ticket.json")):
            self.assertEqual(fleet.redact_string(raw), expected)
            for label, data in (("fixture", raw.encode()), (raw, b"")):
                with self.assertRaisesRegex(SystemExit, "identity"):
                    fleet.scan_output_bytes([(label, data)])
            fleet.scan_output_bytes([(expected, expected.encode())])

    def test_fleet_root_covers_clone_and_sibling_worktree_layouts(self):
        root = Path("/workspace/projects")
        self.assertEqual(fleet.fleet_root(root / "beep-effect8"), root)
        self.assertEqual(fleet.fleet_root(root / "beep-effect8-worktrees/stage-b-review-fixes"), root)

    def test_process_variants_mint_local_custody_before_removal(self):
        salt = b"a" * 32
        payload = {"schemaVersion": "yeet-admission-lease/v1", "pid": 4242, "procStart": "lease-start",
                   "ownerPid": 9, "ownerProcStart": "lower-precedence",
                   "runScope": {"attachedPid": 1234},
                   "attempt": {"ownerPid": 4242, "ownerProcStart": "lease-start", "attachedPid": 9}}
        rows, receipt = fleet.transform_source(fleet.encode_json(payload), "live", salt, False)
        actual = rows[0]
        self.assertEqual(actual["ownerRef"], actual["attempt"]["ownerRef"])
        self.assertEqual(actual["runScope"]["ownerRef"], fleet.sha256(f"1234:<absent>:{salt.hex()}".encode())[:12])
        self.assertEqual(receipt["owner_refs_by_variant"], {"pid_pair": 1, "ownerpid": 1, "attachedpid": 1, "other": 0})
        self.assertEqual(receipt["redaction_counts"]["owner_refs_without_proc_start"], 1)
        fleet.scan_output_bytes([("lease.json", fleet.encode_json(actual)),
                               ("lease.properties", fleet.encode_properties_projection(rows))])
        attempt = {"schemaVersion": fleet.ATTEMPT_SCHEMA, "_tag": "attempt-started", "attemptId": "fixture",
                   "ownerPid": 4242, "ownerProcStart": 9876}
        rows, receipt = fleet.transform_source(fleet.encode_ndjson([attempt]), "attempts", salt)
        self.assertEqual(rows[0]["ownerRef"], fleet.sha256(f"4242:9876:{salt.hex()}".encode())[:12])
        self.assertEqual(receipt["owner_refs_by_variant"]["ownerpid"], 1)

    def test_normalized_variants_and_unpaired_identities_have_custody(self):
        for payload in ({"OWNER_PID": 1234, "owner-proc-start": "start"}, {"ownerProcStart": "start"},
                        {"parentPid": 1234}, {"futureProcessStartTicks": 42}, {"processId": 1234}):
            with self.subTest(keys=list(payload)):
                actual = fleet.redact(payload, b"a" * 32, collections.Counter())
                self.assertEqual(list(actual), ["ownerRef"])
                self.assertEqual(fleet.eligible_property_pairs(payload), [])
        for missing in (None, ""):
            counts = collections.Counter()
            fleet.redact({"ownerPid": 1234, "ownerProcStart": missing}, b"a" * 32, counts)
            self.assertEqual(counts["owner_refs_without_proc_start"], 1)
        with self.assertRaisesRegex(SystemExit, "ambiguous"):
            fleet.redact({"ownerPid": 1, "owner_pid": 2}, b"a" * 32, collections.Counter())

    def test_deployed_process_schema_members_are_covered(self):
        files = (fleet.REPO_RUN + "RunScope.schemas.ts", fleet.YEET + "AttemptJournal.ts",
                 fleet.REPO_RUN + "AttemptTerminationJournal.ts", fleet.REPO_RUN + "QualityScheduler.schemas.ts",
                 fleet.REPO_RUN + "AdmissionJournal.ts")
        observed = set()
        for file in files:
            fields = re.findall(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*S\.", (fleet.REPO_ROOT / file).read_text(), re.MULTILINE)
            identities = {key for key in fields if re.search(r"pid|procstart|processstart", key, re.IGNORECASE)}
            self.assertTrue(identities, file)
            for key in identities:
                self.assertTrue(fleet.process_member(key), (file, key))
            observed.update(identities)
        self.assertTrue({"attachedPid", "ownerPid", "ownerProcStart", "pid", "procStart"} <= observed)
        self.assertEqual(fleet.PROCESS_MEMBER_ALLOWLIST, {"failedstepid", "stepid"})

    def test_execution_step_identifiers_preserve_failure_rider_and_projections(self):
        for file, key in (("Verdict.ts", "failedStepId"), ("ProofState.ts", "stepId")):
            source = (fleet.REPO_ROOT / fleet.YEET / file).read_text()
            self.assertRegex(source, rf"\b{key}: S\.")
        payload = {"schemaVersion": fleet.ATTEMPT_SCHEMA, "_tag": "attempt-finished",
                   "stepId": "full:check", "verdict": {"failedStepId": "full:check", "failureKind": "step-exit"}}
        rows, receipt = fleet.transform_source(fleet.encode_ndjson([payload]), "attempts", b"a" * 32)
        self.assertEqual(rows, [payload])
        self.assertEqual(sum(receipt["owner_refs_by_variant"].values()), 0)
        pairs = fleet.eligible_property_pairs(rows[0])
        self.assertIn(("stepId", "full:check"), pairs)
        self.assertIn(("failedStepId", "full:check"), pairs)
        evidence = fleet.rider_evidence({"attempts/fixture/run/attempts.ndjson": rows})
        self.assertEqual(evidence["pa-failure-signature"]["structured_occurrences"], 1)
        fleet.scan_output_bytes([("attempts.ndjson", fleet.encode_ndjson(rows)),
                                 ("attempts.properties", fleet.encode_properties_projection(rows))])
        for key in ("STEP_ID", "failed-step-id"):
            self.assertFalse(fleet.process_member(key))

    def test_process_residue_uses_keys_in_both_formats(self):
        keys = ("attachedPid", "ownerPid", "ownerProcStart", "pid", "ppid", "processId",
                "OWNER_PID", "attached-pid", "owner_proc_start", "futureProcessStartTicks")
        for key in keys:
            for data in (fleet.encode_json({key: "identity"}), f"{key}=identity\n".encode()):
                with self.subTest(key=key, data=data):
                    with self.assertRaisesRegex(SystemExit, "process identity member"):
                        fleet.scan_output_bytes([("fixture", data)])
        with self.assertRaisesRegex(SystemExit, "process identity member"):
            fleet.scan_output_bytes([("escaped.json", b'{"owner\\u0050id":42}')])
        benign = {"description": 'rapid cupid lipid attachedPid ownerProcStart "ownerPid": word',
                  "words": ["pid", "ownerPid", "ownerProcStart"], "rapidly": "safe"}
        self.assertEqual(fleet.redact(benign, b"a" * 32, collections.Counter()), benign)
        fleet.scan_output_bytes([("safe.json", fleet.encode_json(benign)),
                               ("safe.properties", fleet.encode_properties_projection([benign]))])
        self.assertIn(("words", "ownerPid"), fleet.eligible_property_pairs(benign))

    def test_host_paths_require_left_boundaries_in_rewrite_and_scan(self):
        with patch.object(fleet, "FLEET_ROOT", Path("/workspace")):
            for root, token in (("/workspace", "<fleet>"), ("/home", "<home>"), ("/tmp", "<tmp>"),
                                ("/proc", "<proc>"), ("/dev/shm", "<shm>")):
                for prefix in ("packages", "packages/", "word_", "word.", "~", "-", "A", "0", "/"):
                    relative = prefix + root + "/use-cases/x.test.ts"
                    self.assertEqual(fleet.redact_string(relative), relative)
                    fleet.scan_output_bytes([(relative, relative.encode())])
                for prefix in ("", " ", '"', "=", "(", ":", "//", ":/", "file://", "file:/"):
                    for suffix in ("", "/beep-effect/x"):
                        absolute = prefix + root + suffix
                        self.assertEqual(fleet.redact_string(absolute), prefix + token + suffix)
                        with self.assertRaisesRegex(SystemExit, "host path"):
                            fleet.scan_output_bytes([("fixture", absolute.encode())])
                self.assertEqual(fleet.redact_string(root + "-other/x"), root + "-other/x")
                fleet.scan_output_bytes([("fixture", (root + "-other/x").encode())])
            for relative in ("packages/run/user/123/state", "packages/proc/123/status", "packages/~/.beep/runtime/state"):
                self.assertEqual(fleet.redact_string(relative), relative)
                fleet.scan_output_bytes([("fixture", relative.encode())])

    def test_file_uri_host_roots_preserve_scheme_and_reject_raw_residue(self):
        # Model Alice's home explicitly so the fixture is independent of the test host.
        with patch.object(Path, "home", return_value=Path("/home/alice")), \
                patch.object(fleet, "FLEET_ROOT", Path("/workspace")):
            for raw, expected in (("file:///home/alice/x", "file://<home>/x"),
                                  ("file:///proc/123/status", "file://<proc>/<process>/status"),
                                  ("file:///workspace/project/x", "file://<fleet>/project/x"),
                                  ("file:///tmp/x", "file://<tmp>/x"),
                                  ("file:///dev/shm/x", "file://<shm>/x"),
                                  ("file:///run/user/123/state", "file://<runtime>/state")):
                with self.subTest(raw=raw):
                    self.assertEqual(fleet.redact_string(raw), expected)
                    self.assertEqual(fleet.redact_string(expected), expected)
                    for label, data in (("fixture", raw.encode()), (raw, b"")):
                        with self.assertRaisesRegex(SystemExit, "host path"):
                            fleet.scan_output_bytes([(label, data)])
                    fleet.scan_output_bytes([(expected, expected.encode())])

    def test_embedded_json_remains_parseable_after_redaction(self):
        for module in (fleet, identity, legacy, stage_b):
            for pid in (1234567, "1234567"):
                original = {"pid": pid, "proofTier": "full", "nested": [True, None]}
                for depth in range(4):
                    message = json.dumps(original)
                    for _ in range(depth):
                        message = json.dumps({"message": message})
                    result = module.redact_string(message)
                    for _ in range(depth):
                        result = json.loads(result)["message"]
                    decoded = json.loads(result)
                    self.assertEqual(decoded, {**original, "pid": None if isinstance(pid, int) else "<redacted>"})
                    self.assertEqual(module.redact_string(module.redact_string(message)), module.redact_string(message))

    def test_quoted_process_ids_are_redacted_and_rejected_at_every_json_depth(self):
        for module in (fleet, identity, legacy, stage_b):
            for message in ('pid:1234567', '{"pid":1234567}', '{"PID" : "1234567"}',
                            '{"pid"\n:\t1234567}', 'pid = 1234567',
                            "pid='1234567'", "pid:'1234567'", "{'pid': '1234567'}"):
                for depth in range(4):
                    with self.subTest(module=module.__name__, depth=depth, message=message):
                        result = module.redact_string(message)
                        self.assertNotIn("1234567", result)
                        module.scan_output_bytes([("fixture", module.encode_json({"message": result}))])
                        with self.assertRaises(SystemExit) as exc:
                            module.scan_output_bytes([("fixture", module.encode_json({"message": message}))])
                        self.assertNotIn("1234567", str(exc.exception))
                        message = json.dumps({"message": message})
            unchanged = 'rapid1234567, runId=1234567, elapsedMs=1234567'
            self.assertEqual(module.redact_string(unchanged), unchanged)

    def test_long_nonmatching_pid_text_finishes_in_a_bounded_child(self):
        runner = (
            "import importlib,sys; sys.path.insert(0,sys.argv[1]); "
            "m=importlib.import_module(sys.argv[2]); "
            "messages=['pid'+' '*100000, 'pid'+r'\\n'*50000]; "
            "assert all(m.redact_string(s)==s for s in messages); "
            "m.scan_output_bytes([(str(i),s.encode()) for i,s in enumerate(messages)])"
        )
        for module in (fleet, identity, legacy, stage_b):
            subprocess.run([sys.executable, "-c", runner, str(module.SCRIPT.parent), module.__name__],
                           capture_output=True, check=True, timeout=10)

    def test_legacy_pin_rejects_an_obsolete_redaction_description(self):
        manifest = legacy.yaml.safe_load((legacy.OUTPUT_ROOT / legacy.MANIFEST_NAME).read_bytes())
        with patch.object(legacy.yaml, "safe_load", return_value={**manifest, "redaction_rules": []}):
            with self.assertRaisesRegex(SystemExit, "redaction rule"):
                legacy.verify_output_tree(legacy.OUTPUT_ROOT)

    def test_runtime_proc_shared_memory_and_user_unit_rewrites(self):
        for module in (fleet, identity):
            runtime = str(Path(os.sep) / "run/user" / str(os.geteuid()))
            custom = str(Path.home() / "runtime-fixture")
            with patch.dict(os.environ, {"XDG_RUNTIME_DIR": custom}):
                leaves = [runtime + "/beep-yeet-proof-locks-fixture", custom + "/state",
                          "/proc/123/status", "/dev/shm/state",
                          f"user@{os.geteuid()}.service", f"user-{os.geteuid()}.slice",
                          f"user-runtime-dir@{os.geteuid()}.service"]
                for family in ("admission", "attempts", "verdict", "ledger", "live", "binding"):
                    value = {"family": family, "nested": {"messages": leaves}}
                    result = module.redact(value, None, collections.Counter())
                    self.assertEqual(result["nested"]["messages"], [
                        "<runtime>/beep-yeet-proof-locks-fixture", "<runtime>/state",
                        "<proc>/<process>/status", "<shm>/state", "user@<uid>.service",
                        "user-<uid>.slice", "user-runtime-dir@<uid>.service"])
                    module.scan_output_bytes([("fixture", module.encode_json(result))])
                for leaf in leaves + ["/run/user/"]:
                    with self.assertRaises(SystemExit):
                        module.scan_output_bytes([("fixture", leaf.encode())])

    def test_checkout_encoding_is_single_component_and_collision_free(self):
        labels = ["beep-effect/.claude/worktrees/name", "beep-effect/.beep/yeet/name",
                  "beep-effect__name", "beep-effect/name", "beep-effect%2Fname"]
        for module in (fleet, identity):
            encoded = [module.checkout_component(label) for label in labels]
            self.assertEqual(len(set(encoded)), len(labels))
            self.assertTrue(all("/" not in name for name in encoded))
            self.assertEqual(encoded[0], "beep-effect%2F.claude%2Fworktrees%2Fname")

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
                self.assertEqual(result["nested"], {"ownerRef": fleet.sha256(
                    f"789:<absent>:{(b'a' * 32).hex()}".encode())[:12]} if module is fleet else {})
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


class SyntheticReceiptTests(unittest.TestCase):
    def test_lineage_preserves_reason_and_literal_residue_proof(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            original = self.fixture(fleet, root)
            manifest = fleet.yaml.safe_load(original)
            self.assertEqual(manifest["generator_lineage"], {
                "frozen_sha256": "7d711673d80791ce2aa1c9a1d1d8da6e1ff1867a55962806355fdf44ffd378e3",
                "amended_sha256": fleet.sha256(fleet.SCRIPT.read_bytes()), "ruling": 22,
                "reason": "process-identity variants (ownerProcStart, ownerPid, attachedPid) survived the name allowlist"})
            self.assertIsNone(re.search(rb'attachedPid|ownerProcStart|ownerPid|"pid"', original))
            self.assertEqual(self.verify_cli(fleet, root).returncode, 0)
            for old, new in ((b"ruling: 22", b"ruling: 21"),
                             (b"frozen_sha256: 7", b"frozen_sha256: 8"),
                             (b"  amended_sha256: ", b"  amended_sha255: "),
                             (b"survived the name allowlist", b"survived the name blocklist")):
                with self.subTest(field=old):
                    self.assertIn(old, original)
                    try:
                        (root / fleet.MANIFEST_NAME).write_bytes(original.replace(old, new, 1))
                        result = self.verify_cli(fleet, root)
                        self.assertNotEqual(result.returncode, 0)
                        self.assertIn("generator lineage", result.stderr)
                    finally:
                        (root / fleet.MANIFEST_NAME).write_bytes(original)
            self.assertEqual(self.verify_cli(fleet, root).returncode, 0)

    def test_variant_receipts_and_aggregate_reject_corruption(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            original = self.fixture(fleet, root)
            for index in (0, 1):
                pieces = original.split(b"ownerpid: 0")
                self.assertEqual(len(pieces), 3)
                mutated = b"ownerpid: 0".join(pieces[:index + 1]) + b"ownerpid: 1" + b"ownerpid: 0".join(pieces[index + 1:])
                try:
                    (root / fleet.MANIFEST_NAME).write_bytes(mutated)
                    result = self.verify_cli(fleet, root)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn("variant", result.stderr)
                finally:
                    (root / fleet.MANIFEST_NAME).write_bytes(original)
            self.assertEqual(self.verify_cli(fleet, root).returncode, 0)

    def fixture(self, module, root, message=None):
        scanned = "2026-01-01T00:00:00.000Z"
        if module is fleet:
            path = "admission/fixture/journal.ndjson"
            source = "<fixture-admission>/journal.ndjson"
            rows, census = fleet.transform_source(fleet.encode_ndjson([
                {"schemaVersion": "yeet-admission-journal/v1", "_tag": "admission-admitted",
                 "admittedAtMillis": 1767225600000, "pid": 123}]), "admission", b"a" * 32)
            if message is not None:
                rows[0]["message"] = message
            emitted = module.payload_pair(path, rows, "admission", source, scanned)
            metadata = {"capture_instant": scanned, "admission_roots": [{"label": "fixture",
                "journal": {"path": path, **module.complete(source, scanned), **census}, "live": []}],
                "sources": [], "checkouts": [], "checkout_counts": {},
                "custody": {"owner_refs_by_variant": dict(census["owner_refs_by_variant"])},
                "rider_evidence": module.rider_evidence({path: rows}),
                "proof_ledger": {"checkouts_with_ledger": 0}}
        else:
            label = "fixture/.claude/worktrees/name"
            key = "<fleet>/" + label
            path = f"bindings/{module.checkout_component(label)}.json"
            row = {"path": key, "kind": "linked-worktree", "branch": "fixture", "head": "a" * 40}
            snapshot = {"scannedAt": scanned, "checkouts": [row], "coverage": {"checkoutsDiscovered": 1}}
            probes = {name: {"status": "present", "exit_code": 0} for name in ("head", "branch")}
            binding = {"scannedAt": scanned, "identity_key": key, "snapshot_path": key,
                "within_fleet_root": True, "kind": row["kind"], "branch": row["branch"], "head": row["head"],
                "branch_sha12": module.sha256(b"fixture")[:12], "git_probes": probes,
                "probe_head": row["head"], "probe_branch": row["branch"], "binding_probe_status": "present",
                "binding_probe_matches_snapshot": True, "binding_probe_at": scanned,
                "runs_dir_listing": [], "turbo_remote_cache_env_present": {}}
            emitted = module.payload_pair("fleet-snapshot.json", [snapshot], "fleet-snapshot",
                                          "bun run beep worktree fleet --json", scanned)
            emitted += module.payload_pair(path, [binding], "checkout-binding", key, scanned, checkout=label)
            metadata = {"capture_instant": scanned, "capture_instant_basis": "FleetSnapshot.scannedAt",
                "snapshot_source": {**module.complete("bun run beep worktree fleet --json", scanned),
                    "coverage": snapshot["coverage"], "snapshot_sha256": module.sha256(emitted[0].data)},
                "checkout_counts": {"linked-worktree": 1}, "cache_mounts": {"turbo_remote_cache_env_present": {}},
                "bindings": [{"checkout": label, "identity_key": key, "kind": row["kind"], "path": path,
                    **module.complete(key, scanned), "binding_probe_matches_snapshot": True,
                    "binding_probe_status": "present"}]}
        with patch.object(module, "git", return_value="a" * 40):
            manifest = module.finish_manifest(metadata, emitted)
        for payload in emitted:
            target = root / payload.path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(payload.data)
        (root / module.MANIFEST_NAME).write_bytes(manifest)
        return manifest

    def test_committed_repair_replays_old_pin_and_preserves_initial_provenance(self):
        script = fleet.REPO_ROOT / "goals/codex-security-findings-2026-09-08/research/scripts/resanitize-corpora.py"
        spec = importlib.util.spec_from_file_location("repair_corpora", script)
        repair = importlib.util.module_from_spec(spec)
        # Goal packet snapshots reject hidden-directory and binary residue.
        with patch.object(sys, "dont_write_bytecode", True):
            spec.loader.exec_module(repair)
        cache = fleet.REPO_ROOT / ".beep/corpus-test-repos"
        cache.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=cache) as name:
            repo = Path(name)
            corpus = repo / "corpus"
            pin = corpus / "run3-fleet"
            pin.mkdir(parents=True)
            generator = corpus / "etl_run3_fleet_corpus.py"
            generator.write_text("# original generator fixture\n")

            def git(*args):
                return subprocess.run(["git", "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
                                       "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", *args],
                                      cwd=repo, check=True, capture_output=True, text=True).stdout.strip()

            with patch.object(fleet, "SCRIPT", generator), patch.object(fleet, "OUTPUT_ROOT", pin), \
                 patch.object(repair, "ROOT", repo), patch.object(repair, "CORPUS", corpus), \
                 patch.object(repair, "load_generator", return_value=fleet), \
                 contextlib.redirect_stdout(io.StringIO()):
                original = self.fixture(fleet, pin, '{"pid":1234567,"proofTier":"full"}')
                git("init", "-q")
                git("add", ".")
                git("commit", "-qm", "fixture: capture original pin")
                source_ref = git("rev-parse", "HEAD")
                generator.write_text("# committed updated generator fixture\n")
                git("add", ".")
                git("commit", "-qm", "fixture: update generator")
                repair.repair(fleet.__name__)
                repaired = (pin / fleet.MANIFEST_NAME).read_bytes()
                self.assertEqual(repaired.count(b"generator_lineage:\n"), 1)
                self.assertIsNone(re.search(rb'attachedPid|ownerProcStart|ownerPid|"pid"', repaired))
                repaired_manifest = fleet.yaml.safe_load(repaired)
                self.assertEqual(repaired_manifest["generator_lineage"]["amended_sha256"],
                                 fleet.sha256(generator.read_bytes()))
                first = repaired_manifest["security_resanitization"]
                self.assertEqual(first["source_manifest_sha256"], fleet.sha256(original))
                self.assertEqual(first["changed_raw_payloads"], 1)
                row = fleet.decode_ndjson((pin / "admission/fixture/journal.ndjson").read_bytes(), "fixture")[0]
                self.assertEqual(json.loads(row["message"]), {"pid": None, "proofTier": "full"})
                before = {p.relative_to(pin): p.read_bytes() for p in pin.rglob("*") if p.is_file()}
                repair.repair(fleet.__name__)
                self.assertEqual(before, {p.relative_to(pin): p.read_bytes() for p in pin.rglob("*") if p.is_file()})
                generator.write_text("# next generator fixture\n")
                repair.repair(fleet.__name__)
                updated = fleet.yaml.safe_load((pin / fleet.MANIFEST_NAME).read_bytes())["security_resanitization"]
                self.assertEqual({k: updated[k] for k in first}, first)
                self.assertEqual(updated["updates"][0]["changed_raw_payloads"], 0)
                repair.repair(fleet.__name__, source_ref)
                replay = fleet.yaml.safe_load((pin / fleet.MANIFEST_NAME).read_bytes())["security_resanitization"]
                self.assertEqual(replay["source_manifest_sha256"], fleet.sha256(original))
                self.assertEqual(replay["changed_raw_payloads"], 1)
                with self.assertRaisesRegex(SystemExit, "no matching committed provenance"):
                    repair.verify_generator_provenance(fleet, "0" * 64)

    def verify_cli(self, module, root):
        runner = ("import importlib,sys; from pathlib import Path; "
                  "sys.path.insert(0,str(Path(sys.argv[1]).parent)); "
                  "m=importlib.import_module(Path(sys.argv[1]).stem); "
                  "m.OUTPUT_ROOT=Path(sys.argv[2]); sys.argv=[sys.argv[1]]; m.main()")
        return subprocess.run([sys.executable, "-c", runner, str(module.SCRIPT), str(root)],
                              capture_output=True, text=True, timeout=30)

    def test_same_length_receipt_timestamp_mutation_fails_cli_then_restores(self):
        for module in (fleet, identity):
            with tempfile.TemporaryDirectory() as name:
                root = Path(name)
                original = self.fixture(module, root)
                self.assertEqual(self.verify_cli(module, root).returncode, 0)
                for field in (b"min_timestamp_observed", b"max_timestamp_observed"):
                    old = field + b": '2026-01-01T00:00:00.000Z'"
                    new = field + b": '2026-01-01T00:00:00.001Z'"
                    # Check raw and projection receipts independently.
                    for index in (0, 1):
                        pieces = original.split(old)
                        self.assertGreaterEqual(len(pieces), 3)
                        mutated = old.join(pieces[:index + 1]) + new + old.join(pieces[index + 1:])
                        self.assertEqual(len(mutated), len(original))
                        target = root / module.MANIFEST_NAME
                        try:
                            target.write_bytes(mutated)
                            result = self.verify_cli(module, root)
                            self.assertNotEqual(result.returncode, 0)
                            self.assertIn("receipt", result.stderr)
                        finally:
                            target.write_bytes(original)
                        self.assertEqual(self.verify_cli(module, root).returncode, 0)

    def test_identity_manifest_derived_fields_reject_same_length_edits(self):
        mutations = [(b"capture_instant_basis: FleetSnapshot.scannedAt", b"capture_instant_basis: FleetSnapshot.startedAt"),
                     (b"checkoutsDiscovered: 1", b"checkoutsDiscovered: 2"),
                     (b"binding_probe_status: present", b"binding_probe_status: missing"),
                     (b"kind: linked-worktree", b"kind: invalid-fixture")]
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            original = self.fixture(identity, root)
            for old, new in mutations:
                with self.subTest(field=old):
                    self.assertIn(old, original)
                    mutated = original.replace(old, new, 1)
                    self.assertEqual(len(mutated), len(original))
                    try:
                        (root / identity.MANIFEST_NAME).write_bytes(mutated)
                        self.assertNotEqual(self.verify_cli(identity, root).returncode, 0)
                    finally:
                        (root / identity.MANIFEST_NAME).write_bytes(original)
                    self.assertEqual(self.verify_cli(identity, root).returncode, 0)


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
            with tempfile.TemporaryDirectory() as name:
                root = Path(name) / "pin"
                shutil.copytree(module.OUTPUT_ROOT, root)
                target = next(root.rglob("*.properties"))
                original = target.read_bytes()
                try:
                    target.write_bytes(original + b"corrupted=fixture\n")
                    with self.assertRaises(SystemExit):
                        module.verify_output_tree(root)
                finally:
                    target.write_bytes(original)
                module.verify_output_tree(root)


if __name__ == "__main__":
    unittest.main()
