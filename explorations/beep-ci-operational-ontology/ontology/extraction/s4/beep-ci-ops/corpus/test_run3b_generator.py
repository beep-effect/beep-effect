"""Stage B privacy, loss census, and independent pin-contract regressions.

Run: UV_CACHE_DIR=~/.cache/beep/uv-cache uv run --offline --with pyyaml python
     -m unittest discover -s <corpus-directory> -p test_run3b_generator.py
Fixtures are synthetic and never touch scheduler state or the frozen corpora.
"""
import collections
import contextlib
import copy
import dataclasses
import importlib.util
import io
import json
import os
import re
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
                       "runScope": {"unitName": f"user-{os.getuid()}.slice", "attachedPid": 4242}}}
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
    def test_identifier_tokens_preserve_ordinary_words_and_cover_process_names(self):
        safe = {key: 1234 for key in ("rapid", "cupid", "lipid", "RAPID", "Cupid", "stepId", "failedStepId", "STEPID")}
        private = {key: 5678 for key in ("pid", "ppid", "ownerPid", "attachedPid", "legacyLockOwnerPid", "claudePid", "ownerProcStart", "xPid", "y_pid", "z-pid")}
        for key in safe:
            self.assertFalse(etl.process_member(key), key)
        for key in private:
            self.assertTrue(etl.process_member(key), key)
        result = etl.redact({**safe, **private}, b"a" * 32, collections.Counter())
        self.assertEqual({key: result[key] for key in safe}, safe)
        self.assertFalse(set(private) & set(result))
        etl.scan_output_bytes([("safe.json", etl.encode_json(result)),
                                  ("safe.properties", etl.encode_properties_projection([result]))])
        # Uppercase acronym forms normalize like their camelCase twins, so each gets its own object.
        for key in ("ownerPID", "attachedPID", "ownerPROCSTART", "OWNER_PID"):
            self.assertTrue(etl.process_member(key), key)
            single = etl.redact({key: 5678, "rapid": 42}, b"a" * 32, collections.Counter())
            self.assertNotIn(key, single)
            self.assertEqual(single["rapid"], 42)

    def test_serialized_escaped_process_values_are_wholly_replaced(self):
        values = ('a"secret', 'secret\\', 'secret\\\\',
                  json.dumps({"detail": 'nested"secret', "tail": "secret\\"}), '')
        for key in ("ownerPid", "attachedPid", "ownerProcStart", "pid"):
            for value in values:
                for depth in range(4):
                    message = json.dumps({key: value, "failedStepId": "check", "rapid": 42})
                    for _ in range(depth):
                        message = json.dumps({"message": message})
                    with self.subTest(key=key, value=value, depth=depth):
                        with self.assertRaises(SystemExit):
                            etl.scan_output_bytes([("raw.json", etl.encode_json({"message": message}))])
                        redacted = etl.redact_string(message)
                        self.assertEqual(etl.redact_string(redacted), redacted)
                        etl.scan_output_bytes([("safe.json", etl.encode_json({"message": redacted})),
                                                  ("safe.properties", etl.encode_properties_projection([{"message": redacted}]))])
                        decoded = redacted
                        for _ in range(depth):
                            decoded = json.loads(decoded)["message"]
                        self.assertEqual(json.loads(decoded), {key: "<redacted>", "failedStepId": "check", "rapid": 42})

    def test_free_text_quoted_process_values_are_wholly_replaced(self):
        for message in (r'ownerPid="a\"secret"', r'pid "secret\\"', r"ownerPid='a\'secret'"):
            with self.subTest(message=message):
                with self.assertRaises(SystemExit):
                    etl.scan_output_bytes([("raw", etl.encode_json({"message": message}))])
                redacted = etl.redact_string(message)
                self.assertNotIn("secret", redacted)
                self.assertEqual(etl.redact_string(redacted), redacted)
                etl.scan_output_bytes([("safe", etl.encode_json({"message": redacted}))])

    def test_serialized_escaped_keys_are_consumed_as_whole_strings(self):
        for depth in range(4):
            message = r'{"owner\u0050id":"a\"secret","note\"ownerPid":"keep","tail\\":"keep"}'
            for _ in range(depth):
                message = json.dumps({"message": message})
            with self.subTest(depth=depth):
                with self.assertRaises(SystemExit):
                    etl.scan_output_bytes([("raw.json", etl.encode_json({"message": message}))])
                redacted = etl.redact_string(message)
                self.assertEqual(etl.redact_string(redacted), redacted)
                etl.scan_output_bytes([("safe.json", etl.encode_json({"message": redacted}))])
                decoded = redacted
                for _ in range(depth):
                    decoded = json.loads(decoded)["message"]
                self.assertEqual(json.loads(decoded), {"ownerPid": "<redacted>", 'note"ownerPid': "keep", "tail\\": "keep"})

    def test_serialized_process_variants_are_redacted_at_every_escape_depth(self):
        private = {"ownerPid": 1234, "ownerProcStart": "start-fixture", "attachedPid": 5678,
                   "legacyLockOwnerPid": "9012", "claudePid": 3456, "ppid": 6789,
                   "futureProcessStartTicks": "ticks-fixture", "rapid": 42, "failedStepId": "check"}
        for depth in range(4):
            message = json.dumps(private)
            for _ in range(depth):
                message = json.dumps({"message": message})
            with self.assertRaises(SystemExit):
                etl.scan_output_bytes([("raw.json", etl.encode_json({"message": message}))])
            redacted = etl.redact_string(message)
            self.assertEqual(etl.redact_string(redacted), redacted)
            etl.scan_output_bytes([("redacted.json", etl.encode_json({"message": redacted})),
                                      ("redacted.properties", etl.encode_properties_projection([{"message": redacted}]))])
            decoded = redacted
            for _ in range(depth):
                decoded = json.loads(decoded)["message"]
            decoded = json.loads(decoded)
            self.assertEqual(decoded, {key: value if key in ("rapid", "failedStepId") else
                                      "<redacted>" if isinstance(value, str) else None
                                      for key, value in private.items()})
        for key in private:
            if key in ("rapid", "failedStepId"):
                continue
            message = "{'" + key + "': 'start-fixture'}"
            self.assertNotIn("start-fixture", etl.redact_string(message))
            bare = key + "=start-fixture"
            self.assertNotIn("start-fixture", etl.redact_string(bare))
            with self.assertRaises(SystemExit):
                etl.scan_output_bytes([("fixture", bare.encode())])

    def test_custody_variants_are_bound_to_payload_bytes(self):
        row = {"pid": 123, "procStart": "start", "nested": {"ownerPid": 456, "ownerProcStart": "start"},
               "scope": {"attachedPid": 789}, "future": {"claudePid": 321}}
        redacted = etl.redact(row, b"a" * 32, collections.Counter())
        variants = etl.owner_ref_census(redacted)
        self.assertEqual(dict(variants), dict.fromkeys(etl.OWNER_VARIANTS, 1))
        receipt = {"owner_refs_by_variant": dict(variants), "redaction_counts": {"owner_refs": 4}}
        etl.verify_owner_census(receipt, [redacted], False)
        receipt["owner_refs_by_variant"].update(pid_pair=0, ownerpid=2)
        with self.assertRaisesRegex(SystemExit, "variant accounting differs from pinned bytes"):
            etl.verify_owner_census(receipt, [redacted], False)
        del redacted["ownerRefVariant"]
        with self.assertRaisesRegex(SystemExit, "missing or invalid"):
            etl.owner_ref_census(redacted)

    def test_current_tree_citations_survive_missing_capture_commit(self):
        file = etl.REPO_RUN + "AdmissionJournal.ts"
        citation = etl.source_cite(file, 'export class AdmissionProtocol extends')
        manifest = {"corpus_commit": "0" * 40, "source": citation}
        with patch.object(etl.subprocess, "run", side_effect=AssertionError("historical git read")):
            etl.verify_source_citations(manifest)
            for changed in ({"line": 0}, {"line": citation["line"] + 1},
                            {"file": "missing-fixture.ts"}, {"needle": "missing fixture anchor"}):
                with self.assertRaises(SystemExit):
                    etl.verify_source_citations({"source": {**citation, **changed}})

    def test_fleet_root_covers_clone_and_sibling_worktree_layouts(self):
        root = Path("/workspace/projects")
        self.assertEqual(etl.fleet_root(root / "beep-effect8"), root)
        self.assertEqual(etl.fleet_root(root / "beep-effect8-worktrees/stage-b-review-fixes"), root)

    def test_process_variants_mint_local_custody_before_removal(self):
        salt = b"a" * 32
        payload = {"schemaVersion": "yeet-admission-lease/v1", "pid": 4242, "procStart": "lease-start",
                   "ownerPid": 9, "ownerProcStart": "lower-precedence",
                   "runScope": {"attachedPid": 1234},
                   "attempt": {"ownerPid": 4242, "ownerProcStart": "lease-start", "attachedPid": 9}}
        rows, receipt = etl.transform_source(etl.encode_json(payload), "live", salt, False)
        actual = rows[0]
        self.assertEqual(actual["ownerRef"], actual["attempt"]["ownerRef"])
        self.assertEqual(actual["runScope"]["ownerRef"], etl.sha256(f"1234:<absent>:{salt.hex()}".encode())[:12])
        self.assertEqual(receipt["owner_refs_by_variant"], {"pid_pair": 1, "ownerpid": 1, "attachedpid": 1, "weak": 0})
        self.assertEqual(receipt["redaction_counts"]["owner_refs_without_start"], 1)
        etl.scan_output_bytes([("lease.json", etl.encode_json(actual)),
                               ("lease.properties", etl.encode_properties_projection(rows))])
        attempt = {"schemaVersion": etl.ATTEMPT_SCHEMA, "_tag": "attempt-started", "attemptId": "fixture",
                   "ownerPid": 4242, "ownerProcStart": 9876}
        rows, receipt = etl.transform_source(etl.encode_ndjson([attempt]), "attempts", salt)
        self.assertEqual(rows[0]["ownerRef"], etl.sha256(f"4242:9876:{salt.hex()}".encode())[:12])
        self.assertEqual(receipt["owner_refs_by_variant"]["ownerpid"], 1)

    def test_normalized_variants_and_unpaired_identities_have_custody(self):
        for payload in ({"OWNER_PID": 1234, "owner-proc-start": "start"}, {"ownerProcStart": "start"},
                        {"parentPid": 1234}, {"futureProcessStartTicks": 42}, {"processId": 1234}):
            with self.subTest(keys=list(payload)):
                actual = etl.redact(payload, b"a" * 32, collections.Counter())
                self.assertEqual(list(actual), ["ownerRef", "ownerRefVariant"])
                self.assertEqual(etl.eligible_property_pairs(payload), [])
        for missing in (None, ""):
            counts = collections.Counter()
            etl.redact({"ownerPid": 1234, "ownerProcStart": missing}, b"a" * 32, counts)
            self.assertEqual(counts["owner_refs_without_start"], 1)
        with self.assertRaisesRegex(SystemExit, "ambiguous"):
            etl.redact({"ownerPid": 1, "owner_pid": 2}, b"a" * 32, collections.Counter())

    def test_deployed_process_schema_members_are_covered(self):
        files = (etl.REPO_RUN + "RunScope.schemas.ts", etl.YEET + "AttemptJournal.ts",
                 etl.REPO_RUN + "AttemptTerminationJournal.ts", etl.REPO_RUN + "QualityScheduler.schemas.ts",
                 etl.REPO_RUN + "AdmissionJournal.ts")
        observed = set()
        for file in files:
            fields = re.findall(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*S\.", (etl.REPO_ROOT / file).read_text(), re.MULTILINE)
            identities = {key for key in fields if re.search(r"pid|procstart|processstart", key, re.IGNORECASE)}
            self.assertTrue(identities, file)
            for key in identities:
                self.assertTrue(etl.process_member(key), (file, key))
            observed.update(identities)
        self.assertTrue({"attachedPid", "ownerPid", "ownerProcStart", "pid", "procStart"} <= observed)
        self.assertRegex((etl.REPO_ROOT / etl.YEET / "Provenance.ts").read_text(), r"claudePid: S\.")
        self.assertIn("const legacyLockOwnerPid =", (etl.REPO_ROOT / etl.REPO_RUN / "AdmissionJournal.ts").read_text())

    def test_deployed_execution_join_keys_survive_redaction_and_projection(self):
        # Enumerate the deployed verdict/attempt, retained journal, and execution schemas.
        files = (etl.YEET + "Verdict.ts", etl.YEET + "AttemptJournal.ts",
                 etl.YEET + "ProofState.ts", etl.REPO_RUN + "AttemptTerminationJournal.ts",
                 etl.REPO_RUN + "RepoRun.models.ts")
        observed = set()
        for file in files:
            fields = re.findall(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(?:S\.|UUID)",
                                (etl.REPO_ROOT / file).read_text(), re.MULTILINE)
            observed.update(key for key in fields if etl.normalized_member(key).endswith("id"))
        identities = {"ownerPid", "pid"}
        joins = observed - identities
        self.assertEqual(joins, {"attemptId", "runId", "failedStepId", "stepId", "taskId", "id"})
        for key in joins:
            self.assertFalse(etl.process_member(key), key)
        for key in identities:
            self.assertTrue(etl.process_member(key), key)
        for key in ("STEP_ID", "failed-step-id"):
            self.assertFalse(etl.process_member(key), key)
        verdict = {"runId": "fixture-run", "attemptId": "fixture-attempt",
                   "failedStepId": "full:check", "failureKind": "step-exit"}
        payload = {"schemaVersion": etl.ATTEMPT_SCHEMA, "_tag": "attempt-finished",
                   "attemptId": "fixture-attempt", "stepId": "full:check", "taskId": "fixture#check",
                   "id": "full:check",
                   "verdict": verdict}
        rows, receipt = etl.transform_source(etl.encode_ndjson([payload]), "attempts", b"a" * 32)
        self.assertEqual(rows, [payload])
        self.assertEqual(sum(receipt["owner_refs_by_variant"].values()), 0)
        pairs = etl.eligible_property_pairs(rows[0])
        self.assertIn(("failureKind", "step-exit"), pairs)
        for key in joins:
            self.assertIn((key, payload.get(key, verdict.get(key))), pairs)
        etl.scan_output_bytes([("attempts.ndjson", etl.encode_ndjson(rows)),
                               ("attempts.properties", etl.projected_bytes(rows, "organic"))])

    def test_process_residue_uses_keys_in_both_formats(self):
        keys = ("attachedPid", "ownerPid", "ownerProcStart", "pid", "ppid", "processId",
                "OWNER_PID", "attached-pid", "owner_proc_start", "futureProcessStartTicks")
        for key in keys:
            for data in (etl.encode_json({key: "identity"}), f"{key}=identity\n".encode()):
                with self.subTest(key=key, data=data):
                    with self.assertRaisesRegex(SystemExit, "process identity member"):
                        etl.scan_output_bytes([("fixture", data)])
        with self.assertRaisesRegex(SystemExit, "process identity member"):
            etl.scan_output_bytes([("escaped.json", b'{"owner\\u0050id":42}')])
        benign = {"description": 'rapid cupid lipid attachedPid ownerProcStart ownerPid word',
                  "words": ["pid", "ownerPid", "ownerProcStart"], "rapidly": "safe"}
        self.assertEqual(etl.redact(benign, b"a" * 32, collections.Counter()), benign)
        etl.scan_output_bytes([("safe.json", etl.encode_json(benign)),
                               ("safe.properties", etl.encode_properties_projection([benign]))])
        self.assertIn(("words", "ownerPid"), etl.eligible_property_pairs(benign))

    def test_host_paths_require_left_boundaries_in_rewrite_and_scan(self):
        with patch.object(etl, "FLEET_ROOT", Path("/workspace")):
            for root, token in (("/workspace", "<fleet>"), ("/home", "<home>"), ("/tmp", "<tmp>"),
                                ("/proc", "<proc>"), ("/dev/shm", "<shm>")):
                for prefix in ("packages", "packages/", "word_", "word.", "~", "-", "A", "0", "/"):
                    relative = prefix + root + "/use-cases/x.test.ts"
                    self.assertEqual(etl.redact_string(relative), relative)
                    etl.scan_output_bytes([(relative, relative.encode())])
                for prefix in ("", " ", '"', "=", "(", ":", "//", ":/", "file://", "file:/"):
                    for suffix in ("", "/beep-effect/x"):
                        absolute = prefix + root + suffix
                        expected = prefix + ("/" if prefix == "file://" else "") + token + suffix
                        self.assertEqual(etl.redact_string(absolute), expected)
                        with self.assertRaisesRegex(SystemExit, "host path"):
                            etl.scan_output_bytes([("fixture", absolute.encode())])
                self.assertEqual(etl.redact_string(root + "-other/x"), root + "-other/x")
                etl.scan_output_bytes([("fixture", (root + "-other/x").encode())])
            for relative in ("packages/run/user/123/state", "packages/proc/123/status", "packages/~/.beep/runtime/state"):
                self.assertEqual(etl.redact_string(relative), relative)
                etl.scan_output_bytes([("fixture", relative.encode())])
            aliases = {"/workspace/fixture": "<synthetic-checkout:contender-a>"}
            self.assertEqual(etl.redact_string("packages/workspace/fixture/x", aliases), "packages/workspace/fixture/x")

    def test_uri_authorities_bound_host_roots_in_rewrite_and_scan(self):
        with patch.object(Path, "home", return_value=Path("/home/alice")), \
                patch.object(etl, "FLEET_ROOT", Path("/workspace")):
            for scheme in ("file", "sftp", "git+ssh", "x.y-z0", "FILE"):
                for authority in ("", "localhost", "host:2222", "[::1]:2222"):
                    for path, expected in (("/home/alice/x", "<home>/x"),
                                           ("/home/x", "<home>/x"),
                                           ("/tmp/x", "<tmp>/x"),
                                           ("/proc/123/s", "<proc>/<process>/s"),
                                           ("/run/user/123/state", "<runtime>/state"),
                                           ("/dev/shm/x", "<shm>/x"),
                                           ("/workspace/project/x", "<fleet>/project/x")):
                        raw = f"{scheme}://{authority}{path}"
                        redacted = f"{scheme}://{authority}/{expected}"
                        with self.subTest(raw=raw):
                            self.assertEqual(etl.redact_string(raw), redacted)
                            self.assertEqual(etl.redact_string(redacted), redacted)
                            for label, data in (("fixture", raw.encode()), (raw, b""),
                                                ("fixture.json", etl.encode_json({"uri": raw}))):
                                with self.assertRaisesRegex(SystemExit, "host path"):
                                    etl.scan_output_bytes([(label, data)])
                            etl.scan_output_bytes([(redacted, redacted.encode())])

    def test_uri_authorities_preserve_non_root_paths_and_stop_at_delimiters(self):
        for value in ("packages/home/x", "https://example.com/homepage/x",
                      "file://host/packages/home/x", "file://host/tmp-other/x",
                      "file://host\npackages/home/x", "file://host packages/home/x",
                      "file://host'packages/home/x", 'file://host"packages/home/x'):
            with self.subTest(value=value):
                self.assertEqual(etl.redact_string(value), value)
                etl.scan_output_bytes([("fixture", value.encode())])
        raw = 'file://localhost/tmp/x "sftp://host/proc/123/s"'
        expected = 'file://localhost/<tmp>/x "sftp://host/<proc>/<process>/s"'
        self.assertEqual(etl.redact_string(raw), expected)
        etl.scan_output_bytes([("fixture", expected.encode())])

    def test_file_uri_host_roots_preserve_scheme_and_reject_raw_residue(self):
        # Model Alice's home explicitly so the fixture is independent of the test host.
        with patch.object(Path, "home", return_value=Path("/home/alice")), \
                patch.object(etl, "FLEET_ROOT", Path("/workspace")):
            for raw, expected in (("file:///home/alice/x", "file:///<home>/x"),
                                  ("file:///proc/123/status", "file:///<proc>/<process>/status"),
                                  ("file:///workspace/project/x", "file:///<fleet>/project/x"),
                                  ("file:///tmp/x", "file:///<tmp>/x"),
                                  ("file:///dev/shm/x", "file:///<shm>/x"),
                                  ("file:///run/user/123/state", "file:///<runtime>/state")):
                with self.subTest(raw=raw):
                    self.assertEqual(etl.redact_string(raw), expected)
                    self.assertEqual(etl.redact_string(expected), expected)
                    for label, data in (("fixture", raw.encode()), (raw, b"")):
                        with self.assertRaisesRegex(SystemExit, "host path"):
                            etl.scan_output_bytes([(label, data)])
                    etl.scan_output_bytes([(expected, expected.encode())])
            aliases = {"/workspace/fixture": "<synthetic-checkout:contender-a>"}
            self.assertEqual(etl.redact_string("file:///workspace/fixture/x", aliases),
                             "file:///<synthetic-checkout:contender-a>/x")

    def test_uri_authority_redaction_keeps_synthetic_alias_precedence(self):
        with patch.object(etl, "FLEET_ROOT", Path("/workspace")):
            aliases = {"/workspace/fixture": "<synthetic-checkout:contender-a>"}
            raw = "file://localhost/workspace/fixture/x"
            expected = "file://localhost/<synthetic-checkout:contender-a>/x"
            self.assertEqual(etl.redact_string(raw, aliases), expected)
            self.assertEqual(etl.redact_string(expected, aliases), expected)
            etl.scan_output_bytes([(expected, expected.encode())])

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
        self.assertEqual(receipt["redaction_counts"]["owner_refs_without_start"], 1)
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
               b'{"pid":123}', b'{"pid":null}', b'{"procStart":"raw"}', b"nonce-123.lease.json", b"merged-preview-1234",
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
        etl.scan_output_bytes([("safe.properties", b'message={"pid":null,"proofTier":"full"}\n')])
        with self.assertRaises(SystemExit):
            etl.scan_output_bytes([("unsafe.properties", b'message={"pid":null}\nother={"pid":123}\n')])

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
        self.patches.enter_context(patch.object(etl, "source_cite", return_value=etl.source_cite(etl.REPO_RUN + "AdmissionJournal.ts", "export class AdmissionProtocol extends")))
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

    def test_committed_repair_history_for_both_populations(self):
        script = etl.REPO_ROOT / "goals/codex-security-findings-2026-09-08/research/scripts/resanitize-corpora.py"
        spec = importlib.util.spec_from_file_location("repair_stage_b", script)
        repair = importlib.util.module_from_spec(spec)
        with patch.object(sys, "dont_write_bytecode", True):
            spec.loader.exec_module(repair)
        cache = etl.REPO_ROOT / ".beep/corpus-test-repos"
        cache.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=cache) as name:
            repo = Path(name)
            corpus = repo / "corpus"
            corpus.mkdir()
            generator = corpus / etl.SCRIPT.name
            generator.write_text("# original Stage B generator fixture\n")
            outputs = {p: corpus / ("run3b-" + p) for p in ("fleet", "synthetic")}

            def git(*args):
                return subprocess.run(["git", "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
                                       "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", *args],
                                      cwd=repo, check=True, capture_output=True, text=True).stdout.strip()

            with patch.object(etl, "SCRIPT", generator), patch.object(etl, "OUTPUT_ROOTS", outputs), \
                 patch.object(repair, "ROOT", repo), patch.object(repair, "CORPUS", corpus), \
                 patch.object(repair, "load_generator", return_value=etl), \
                 contextlib.redirect_stdout(io.StringIO()):
                originals = {}
                messages = {}
                for population, root in outputs.items():
                    emitted, metadata = etl.capture(population, self.export if population == "synthetic" else None)
                    raw = next(e for e in emitted if e.receipt["kind"] == "admission")
                    rows = etl.decode_ndjson(raw.data, raw.path)
                    rows[0]["message"] = '{"pid":1234567,"proofTier":"full"}'
                    messages[population] = raw.path
                    payloads = {raw.path: etl.encode_ndjson(rows),
                                etl.projection_path(raw.path): etl.projected_bytes(rows, metadata["provenance"])}
                    emitted = [dataclasses.replace(e, data=payloads.get(e.path, e.data)) for e in emitted]
                    def remove_variants(value):
                        if isinstance(value, dict):
                            value.pop("ownerRefVariant", None)
                            for child in value.values():
                                remove_variants(child)
                        elif isinstance(value, list):
                            for child in value:
                                remove_variants(child)
                    old_payloads = {}
                    for entry in emitted:
                        if entry.receipt["kind"] == etl.PROJECTION_KIND:
                            continue
                        old_rows = etl.decode_ndjson(entry.data, entry.path) if entry.path.endswith(".ndjson") else [etl.decode_json(entry.data, entry.path)]
                        remove_variants(old_rows)
                        old_payloads[entry.path] = etl.encode_ndjson(old_rows) if entry.path.endswith(".ndjson") else etl.encode_json(old_rows[0])
                        old_payloads[etl.projection_path(entry.path)] = etl.projected_bytes(old_rows, metadata["provenance"])
                    emitted = [dataclasses.replace(entry, data=old_payloads[entry.path]) for entry in emitted]
                    metadata["custody"].pop("variant_source")
                    metadata["admission_roots"][0]["journal"].pop("owner_refs_by_variant")
                    manifest = etl.finish_manifest(metadata, emitted, population)
                    for e in emitted:
                        destination = root / e.path
                        destination.parent.mkdir(parents=True, exist_ok=True)
                        destination.write_bytes(e.data)
                    (root / etl.MANIFEST_NAME).write_bytes(manifest)
                    originals[population] = etl.sha256(manifest)
                git("init", "-q")
                git("add", ".")
                git("commit", "-qm", "fixture: capture Stage B populations")
                source_ref = git("rev-parse", "HEAD")
                generator.write_text("# committed updated Stage B generator fixture\n")
                git("add", ".")
                git("commit", "-qm", "fixture: update generator")
                for population, root in outputs.items():
                    other = outputs["synthetic" if population == "fleet" else "fleet"]
                    untouched = tree_bytes(other)
                    repair.repair(etl.__name__, population=population, finding="CSF-012")
                    self.assertEqual(tree_bytes(other), untouched)
                    rows = etl.decode_ndjson((root / messages[population]).read_bytes(), "fixture")
                    self.assertEqual(json.loads(rows[0]["message"]), {"pid": None, "proofTier": "full"})
                    before = tree_bytes(root)
                    repair.repair(etl.__name__, population=population, finding="CSF-012")
                    self.assertEqual(tree_bytes(root), before)
                    repair.repair(etl.__name__, source_ref, population, finding="CSF-013")
                    self.assertEqual(tree_bytes(other), untouched)
                    manifest = yaml.safe_load((root / etl.MANIFEST_NAME).read_bytes())
                    self.assertEqual(manifest["security_resanitization"]["source_manifest_sha256"], originals[population])
                    self.assertEqual(manifest["security_resanitization"]["changed_raw_payloads"], 1)
                    self.assertTrue(manifest["custody"]["census_migration"]["legacy"])
                    self.assertTrue(manifest["security_resanitization"]["custody_census_migration"]["legacy"])
                    self.assertEqual(manifest["provenance"], "organic" if population == "fleet" else "synthetic")
                    projection = (root / etl.projection_path(messages[population])).read_bytes()
                    self.assertEqual(projection, etl.projected_bytes(rows, manifest["provenance"]))
                    etl.verify_output_tree(root, population)

    def test_ready_gate_refuses_without_emission(self):
        (self.export / "READY").unlink()
        with self.assertRaisesRegex(SystemExit, "READY"):
            etl.capture("synthetic", self.export)
        self.assertFalse(self.outputs["synthetic"].exists())

    def test_synthetic_requires_each_termination_journal(self):
        for label in ("dead-lease", "dead-ticket"):
            journal = next((self.export / "checkouts" / label).rglob("attempts.ndjson"))
            original = journal.read_bytes()
            try:
                journal.unlink()
                with self.assertRaisesRegex(SystemExit, "exactly one attempts.ndjson"):
                    etl.capture("synthetic", self.export)
            finally:
                journal.write_bytes(original)

    def test_synthetic_rejects_duplicate_journals_and_termination_rows(self):
        journal = next((self.export / "checkouts/dead-lease").rglob("attempts.ndjson"))
        duplicate = journal.parent.with_name("duplicate") / journal.name
        duplicate.parent.mkdir()
        duplicate.write_bytes(journal.read_bytes())
        with self.assertRaisesRegex(SystemExit, "exactly one attempts.ndjson"):
            etl.capture("synthetic", self.export)
        duplicate.unlink()
        journal.write_bytes(journal.read_bytes() * 2)
        with self.assertRaisesRegex(SystemExit, "exactly one attempt-terminated row"):
            etl.capture("synthetic", self.export)

    def test_synthetic_rejects_missing_row_mismatched_attempt_and_reason(self):
        for label in ("dead-lease", "dead-ticket"):
            journal = next((self.export / "checkouts" / label).rglob("attempts.ndjson"))
            original = journal.read_bytes()
            row = etl.decode_ndjson(original, "fixture")[0]
            for changed, error in (([], "exactly one attempt-terminated row"),
                                   ([{**row, "attemptId": "wrong"}], "attemptId differs"),
                                   ([{**row, "reason": "wrong"}], "reason differs")):
                try:
                    journal.write_bytes(etl.encode_ndjson(changed))
                    with self.assertRaisesRegex(SystemExit, error):
                        etl.capture("synthetic", self.export)
                finally:
                    journal.write_bytes(original)

    def test_termination_join_receipt_is_recomputed_at_replay(self):
        emitted, metadata = etl.capture("synthetic", self.export)
        joins = metadata["termination_join"]
        for label, reason in (("dead-lease", "lease-eviction"), ("dead-ticket", "queued-submitter-death")):
            self.assertEqual(joins[label], {"journal_path": f"attempts/{label}/main-fixture/attempts.ndjson",
                "attemptId": "lease-attempt" if label == "dead-lease" else "ticket-attempt",
                "attemptId_match": True, "reason": reason})
        metadata["termination_join"]["dead-lease"]["reason"] = "invented"
        # Recompute byte totals and hashes to isolate the receipt binding check.
        with self.assertRaisesRegex(SystemExit, "synthetic termination join"):
            etl.write_staged_capture(emitted, etl.finish_manifest(metadata, emitted, "synthetic"), self.outputs["synthetic"], "synthetic")

    def test_termination_join_replay_rejects_coherent_missing_payload(self):
        emitted, metadata = etl.capture("synthetic", self.export)
        removed = "attempts/dead-ticket/main-fixture/attempts.ndjson"
        emitted = [payload for payload in emitted if payload.path not in (removed, etl.projection_path(removed))]
        metadata["sources"] = [receipt for receipt in metadata["sources"] if receipt.get("path") != removed]
        next(checkout for checkout in metadata["checkouts"] if checkout["checkout"] == "dead-ticket")["attempt_files"] = 0
        with self.assertRaisesRegex(SystemExit, "exactly one attempts.ndjson"):
            etl.write_staged_capture(emitted, etl.finish_manifest(metadata, emitted, "synthetic"), self.outputs["synthetic"], "synthetic")

    def test_contender_a_accepts_absent_journal_but_rejects_nonempty(self):
        journal = next((self.export / "checkouts/contender-a").rglob("attempts.ndjson"))
        journal.unlink()
        etl.capture("synthetic", self.export)
        journal.write_bytes(next((self.export / "checkouts/dead-lease").rglob("attempts.ndjson")).read_bytes())
        with self.assertRaisesRegex(SystemExit, "contender-a attempts receipt must be empty"):
            etl.capture("synthetic", self.export)

    def test_malformed_synthetic_contender_journal_refuses_pin(self):
        journal = next((self.export / "checkouts/contender-a").rglob("attempts.ndjson"))
        journal.write_text("{bad json\n")
        with self.assertRaisesRegex(SystemExit, "synthetic source has undecodable rows"):
            self.run_main("--synthetic-root", self.export)
        self.assertFalse(self.outputs["synthetic"].exists())

    def test_coherent_variant_receipt_and_aggregate_rewrite_is_rejected(self):
        emitted, metadata = etl.capture("synthetic", self.export)
        for census in (metadata["admission_roots"][0]["journal"]["owner_refs_by_variant"],
                       metadata["custody"]["owner_refs_by_variant"]):
            census["pid_pair"] -= 1
            census["ownerpid"] += 1
        with self.assertRaisesRegex(SystemExit, "variant accounting differs from pinned bytes"):
            etl.write_staged_capture(emitted, etl.finish_manifest(metadata, emitted, "synthetic"), self.outputs["synthetic"], "synthetic")

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
