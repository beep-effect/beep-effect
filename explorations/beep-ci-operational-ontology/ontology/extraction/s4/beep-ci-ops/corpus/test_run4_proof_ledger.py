"""Run-4 proof-ledger capture: privacy, decode, census, tree-pinned replay and pin-contract regressions.

Run: UV_CACHE_DIR=$HOME/.cache/beep/uv-cache uv run --offline --with pyyaml python -B
     -m unittest discover -s <corpus-directory> -p test_run4_proof_ledger.py
Fixtures are built at runtime under ``$BEEP_CORPUS_TEST_TMP`` (default ``$HOME/.cache/beep/corpus-test-tmp``),
never under the system temp root or the repository; no test reads the live fleet or writes a real pin root.
"""
import ast
import builtins
import collections
import contextlib
import datetime as dt
import hashlib
import importlib.util
import io
import json
import math
import os
import pwd
import re
import socket
import subprocess
import sys
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

import yaml

spec = importlib.util.spec_from_file_location("etl_run4_proof_ledger", Path(__file__).with_name("etl_run4_proof_ledger.py"))
etl = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = etl
spec.loader.exec_module(etl)
RUN3B = Path(__file__).with_name("etl_run3b_fleet_corpus.py")
REAL_REPO = etl.REPO_ROOT
CITED_FILES = (etl.YEET + "ProofFact.ts", etl.YEET + "ProofShadow.ts", etl.YEET + "ProofLedger.ts",
               etl.YEET + "ArtifactPaths.ts", etl.YEET + "Handler.ts", etl.YEET + "AttemptJournal.ts",
               etl.REPO_RUN + "RepoRunArtifacts.ts", etl.REPO_RUN + "QualityScheduler.schemas.ts",
               etl.CLI + "commands/Ci/CiLane.ts", etl.TTC_PLAN)
COPIED = ("_repo_root", "fleet_root", "fail", "sha256", "reject_json_constant", "unique_object", "decode_json",
          "decode_ndjson", "same_json", "host_prefixes", "uri_host_root_pattern", "redact_host_root",
          "redact_pid_match", "redact_process_text", "redact_string", "normalized_member", "process_member",
          "owner_ref_census", "verify_owner_census", "guard_origin", "redact", "encode_ndjson", "encode_json",
          "render_property_scalar", "eligible_property_pairs", "encode_properties_projection", "projected_bytes",
          "projection_path", "parse_timestamp_scalar", "collect_timestamps", "format_timestamp", "timestamp_bounds",
          "validate_component", "checkout_component", "strict_object", "event_census", "locked_name", "instant", "complete", "safe_relative_path",
          "Payload", "record_observations", "verify_fields", "payload_pair", "write_staged_capture",
          "PROCESS_MEMBER_PATTERN", "PID_IN_TEXT", "JSON_STRING_PATTERN", "JSON_TEXT_MEMBER", "TIMESTAMP_KEY",
          "PROPERTY_KEY", "PATH_LEFT_BOUNDARY", "PATH_RIGHT_BOUNDARY", "OWNER_VARIANTS", "OP_REFERENCE_BYTES",
          "OP_REFERENCE_WITH_MATERIAL")
GIT = ["git", "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
       "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", "-c", "init.defaultBranch=main"]


def test_root() -> Path:
    root = Path(os.environ.get("BEEP_CORPUS_TEST_TMP") or Path.home() / ".cache" / "beep" / "corpus-test-tmp")
    if root.resolve() == REAL_REPO.resolve() or REAL_REPO.resolve() in root.resolve().parents:
        raise RuntimeError("test fixtures must live outside the repository")
    root.mkdir(parents=True, exist_ok=True)
    return root


def hexkey(seed: str) -> str:
    return hashlib.sha256(seed.encode()).hexdigest()


def stamp(text: str, days: int = 0) -> str:
    value = dt.datetime.fromisoformat(text[:-1] + "+00:00") + dt.timedelta(days=days)
    return value.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def pair(origin: str, recorded: str, *, lane="quality:coverage", stage="pre-push", outcome="passed",
         branch="feat/fixture", key=None, decision=None, attempt=None, run_branch=None):
    """One shadow row then its fact, in the writer's member order."""
    key = key or hexkey("key:" + recorded + lane + origin)
    epoch = hexkey("epoch")
    attempt = attempt or str(uuid.uuid4())
    shadow = {"kind": "shadow", "schemaVersion": "proof-fact/v1", "attemptId": attempt, "laneId": lane,
              "branch": branch, "stage": stage, "envProfile": "local",
              "decision": decision or {"kind": "miss", "key": key, "reason": "no-fact"},
              "observed": outcome, "durationMs": 1234.5, "recordedAt": recorded}
    fact = {"kind": "fact", "schemaVersion": "proof-fact/v1", "fact": {
        "schemaVersion": "proof-fact/v1",
        "key": {"laneId": lane, "laneClass": "cli-runnable", "commandDigest": hexkey("command:" + lane),
                "envProfile": "local", "inputDigest": hexkey("input:" + lane), "inputSource": "turbo-task-hash",
                "epochDigest": epoch, "key": key},
        "epoch": {"lockfileDigest": hexkey("lock"), "bunVersion": "1.4.2", "nodeVersion": "24",
                  "rootTurboConfigDigest": hexkey("turbo"), "rootTsconfigDigest": hexkey("tsconfig"),
                  "policyPackVersion": "0.1.0", "digest": epoch},
        "outcome": outcome, "durationMs": 1234.5,
        "provenance": {"runId": etl.run_id_for_branch(run_branch or branch), "attemptId": attempt, "originKey": origin,
                       "tier": "full", "stage": stage, "headSha": hashlib.sha1(attempt.encode()).hexdigest(),
                       "hostedRunId": None},
        "recordedAt": recorded, "expiresAt": stamp(recorded, 30)}}
    return [shadow, fact]


def ledger_bytes(rows) -> bytes:
    return b"".join(json.dumps(row, separators=(",", ":")).encode() + b"\n" for row in rows)


def git_dir(path: Path, origin: str | None) -> None:
    (path / ".git").mkdir(parents=True)
    if origin is not None:
        (path / ".git" / "config").write_text(f'[core]\n\tbare = false\n[remote "origin"]\n\turl = {origin}\n')


def linked(checkout: Path, common: Path, name: str) -> None:
    gitdir = common / "worktrees" / name
    gitdir.mkdir(parents=True)
    (gitdir / "commondir").write_text("../..\n")
    checkout.mkdir(parents=True)
    (checkout / ".git").write_text(f"gitdir: {gitdir}\n")


def write_ledger(owner: Path, rows, extra: bytes = b"") -> Path:
    path = owner / ".beep" / "yeet" / "proof-ledger.ndjson"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(ledger_bytes(rows) + extra)
    return path


PUBLIC = "git@github.com:beep-effect/beep-effect.git"


def build_fleet(fleet: Path) -> dict:
    """Clone A (whole ledger), clone B (no ledger), lanes, a Claude-app worktree, a bare owner, a private clone."""
    a, b = fleet / "beep-effect", fleet / "beep-effect2"
    git_dir(a, PUBLIC)
    git_dir(b, "https://github.com/beep-effect/beep-effect")
    lane = fleet / "beep-effect-worktrees" / "lane-a"
    linked(lane, a / ".git", "lane-a")
    write_ledger(lane, [], b"LANE-LEDGER-MUST-NOT-BE-READ\n")
    runs = lane / ".beep" / "yeet" / "runs" / "feat_fixture-0123456789ab"
    runs.mkdir(parents=True)
    (runs / "attempts.ndjson").write_text("LANE-ATTEMPTS-MUST-NOT-BE-READ\n")
    claude = a / ".claude" / "worktrees" / "cw1"
    linked(claude, a / ".git", "cw1")
    bare = fleet / "beep-effect-bare.git"
    (bare / "objects").mkdir(parents=True)
    (bare / "HEAD").write_text("ref: refs/heads/main\n")
    (bare / "config").write_text(f'[core]\n\tbare = true\n[remote "origin"]\n\turl = {PUBLIC}\n')
    lane_b = fleet / "beep-effect-bare-worktrees" / "lane-b"
    linked(lane_b, bare, "lane-b")
    private = fleet / "beep-effect-private"
    git_dir(private, "https://github.com/beep-effect/beep-effect-private.git")
    merged = str(a / ".beep" / "yeet" / "merged-preview-987654321")
    repair = [row for index in range(5) for row in pair(str(a), f"2026-09-27T10:00:0{index}.000Z", stage="repair-loop",
                                                          branch="feat/repair", lane=f"repair:{index}")]
    pre = pair(str(lane), "2026-09-28T13:00:00.000Z", lane="coverage", branch="feat/pre")
    pre[0]["decision"]["reason"] = "undeclared-inputs"
    pre[1]["fact"]["key"]["inputSource"] = "undeclared"
    pre[1]["fact"]["key"]["inputDigest"] = "undeclared"
    k1 = hexkey("shared-key")
    first = pair(str(lane), "2026-09-29T10:00:00.000Z", key=k1)
    hit = pair(str(claude), "2026-09-29T11:00:00.000Z", key=k1,
               decision={"kind": "hit", "key": k1, "factRecordedAt": "2026-09-29T10:00:00.000Z"})
    preview = pair(merged, "2026-09-27T12:00:00.000Z", stage="merged-preview", outcome="failed",
                   lane="merged:check")
    preview[0]["decision"]["reason"] = "changed-package-tripwire"
    k4 = hexkey("unresolved-hit")
    orphan = pair(str(a), "2026-09-30T09:00:00.000Z", key=k4, outcome="failed",
                  decision={"kind": "hit", "key": k4, "factRecordedAt": "2026-09-01T00:00:00.000Z"})
    rows_a = repair + pre + first + hit + preview + orphan
    write_ledger(a, rows_a)
    write_ledger(bare, pair(str(lane_b), "2026-09-26T08:00:00.000Z", lane="bare:lint"))
    write_ledger(private, pair(str(private), "2026-10-01T08:00:00.000Z", branch="private-marker-branch"))
    return {"a": a, "b": b, "lane": lane, "claude": claude, "bare": bare, "lane_b": lane_b, "private": private,
            "merged": merged, "rows_a": rows_a}


def run_git(repo: Path, *args: str) -> str:
    return subprocess.run([*GIT, *args], cwd=repo, check=True, capture_output=True, text=True).stdout.strip()


def build_repo(repo: Path) -> Path:
    """A fixture repository holding the real cited files and a stub lineage generator, with origin/main."""
    for file in CITED_FILES:
        target = repo / file
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes((REAL_REPO / file).read_bytes())
    lineage = repo / etl.CORPUS_REL / etl.LINEAGE_GENERATOR
    lineage.parent.mkdir(parents=True, exist_ok=True)
    lineage.write_bytes(RUN3B.read_bytes())
    run_git(repo, "init", "-q")
    run_git(repo, "add", ".")
    run_git(repo, "commit", "-qm", "fixture: cited sources")
    run_git(repo, "update-ref", "refs/remotes/origin/main", "HEAD")
    return repo


def tree_bytes(root: Path) -> dict:
    return {p.relative_to(root).as_posix(): p.read_bytes() for p in root.rglob("*") if p.is_file()}


def all_bytes(root: Path) -> bytes:
    return b"\n".join(p.relative_to(root).as_posix().encode() + b"\n" + p.read_bytes()
                      for p in sorted(root.rglob("*")) if p.is_file())


class CopyLineageTests(unittest.TestCase):
    def test_copied_definitions_are_byte_identical_to_run3b(self):
        def segments(path):
            source = path.read_text("utf-8")
            lines = source.splitlines(keepends=True)
            found = {}
            for node in ast.parse(source).body:
                names = [node.name] if isinstance(node, (ast.FunctionDef, ast.ClassDef)) else [
                    t.id for t in getattr(node, "targets", []) if isinstance(t, ast.Name)]
                if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
                    names = [node.target.id]
                start = min([node.lineno] + [d.lineno for d in getattr(node, "decorator_list", [])])
                for name in names:
                    found[name] = "".join(lines[start - 1:node.end_lineno])
            return found
        frozen, current = segments(RUN3B), segments(etl.SCRIPT)
        for name in COPIED:
            with self.subTest(name=name):
                self.assertEqual(current[name], frozen[name])
        self.assertNotEqual(current["scan_output_bytes"], frozen["scan_output_bytes"])
        self.assertNotIn("import etl_run3b", etl.SCRIPT.read_text())


class RedactionTests(unittest.TestCase):
    """Run3b RedactionTests behaviours, retargeted at the copied helpers."""

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
        for key in ("ownerPID", "attachedPID", "ownerPROCSTART", "OWNER_PID"):
            self.assertTrue(etl.process_member(key), key)
            single = etl.redact({key: 5678, "rapid": 42}, b"a" * 32, collections.Counter())
            self.assertNotIn(key, single)
            self.assertEqual(single["rapid"], 42)
            etl.scan_output_bytes([(f"{key}.json", etl.encode_json(single)),
                                   (f"{key}.properties", etl.encode_properties_projection([single]))])
            with self.assertRaises(SystemExit):
                etl.scan_output_bytes([(f"{key}-raw.json", etl.encode_json({key: 5678, "rapid": 42}))])
            serialized = json.dumps({key: 5678, "rapid": 42})
            decoded = json.loads(etl.redact_string(serialized))
            self.assertEqual(decoded["rapid"], 42)
            self.assertNotEqual(decoded.get(key), 5678)
            with self.assertRaises(SystemExit):
                etl.scan_output_bytes([(f"{key}-text.txt", serialized.encode())])

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
            message = r'{"ownerPid":"a\"secret","note\"ownerPid":"keep","tail\\":"keep"}'
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
            self.assertEqual(json.loads(decoded), {key: value if key in ("rapid", "failedStepId") else
                                                   "<redacted>" if isinstance(value, str) else None
                                                   for key, value in private.items()})
        for key in private:
            if key in ("rapid", "failedStepId"):
                continue
            self.assertNotIn("start-fixture", etl.redact_string("{'" + key + "': 'start-fixture'}"))
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
        counts = collections.Counter()
        actual = etl.redact(payload, salt, counts)
        self.assertEqual(actual["ownerRef"], actual["attempt"]["ownerRef"])
        self.assertEqual(actual["runScope"]["ownerRef"], etl.sha256(f"1234:<absent>:{salt.hex()}".encode())[:12])
        self.assertEqual({v: counts["owner_refs_variant_" + v] for v in etl.OWNER_VARIANTS},
                         {"pid_pair": 1, "ownerpid": 1, "attachedpid": 1, "weak": 0})
        self.assertEqual(counts["owner_refs_without_start"], 1)
        etl.scan_output_bytes([("lease.json", etl.encode_json(actual)),
                               ("lease.properties", etl.encode_properties_projection([actual]))])

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
            fields = re.findall(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*S\.", (REAL_REPO / file).read_text(), re.MULTILINE)
            identities = {key for key in fields if re.search(r"pid|procstart|processstart", key, re.IGNORECASE)}
            self.assertTrue(identities, file)
            for key in identities:
                self.assertTrue(etl.process_member(key), (file, key))
            observed.update(identities)
        self.assertTrue({"attachedPid", "ownerPid", "ownerProcStart", "pid", "procStart"} <= observed)

    def test_deployed_ledger_key_sets_match_and_carry_no_process_member(self):
        source = (REAL_REPO / etl.YEET / "ProofFact.ts").read_text()

        def members(symbol):
            match = re.search(r"export class " + symbol + r" extends S\.Class<[^>]+>\([^)]*\)\(\s*\{(.*?)\n  \},", source, re.S)
            self.assertIsNotNone(match, symbol)
            return set(re.findall(r"^[ ]{4}([A-Za-z_][A-Za-z0-9_]*)\s*:", match[1], re.MULTILINE))
        expected = {"ProofLedgerFactRow": etl.FACT_ROW_KEYS, "ProofFact": etl.FACT_KEYS, "ProofInputDigest": etl.INPUT_KEYS,
                    "ProofEpoch": etl.EPOCH_KEYS, "ProofProvenance": etl.PROVENANCE_KEYS,
                    "ProofLedgerShadowRow": etl.SHADOW_KEYS, "ProofReuseHit": etl.HIT_KEYS, "ProofReuseMiss": etl.MISS_KEYS}
        for symbol, keys in expected.items():
            with self.subTest(symbol=symbol):
                self.assertEqual(members(symbol), set(keys))
                self.assertFalse(any(etl.process_member(key) for key in keys))
        for key in ("attemptId", "runId", "laneId", "headSha", "hostedRunId", "originKey", "factRecordedAt"):
            self.assertFalse(etl.process_member(key), key)

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
                    if prefix == "~":
                        # Run-4 extension: a bare home-relative path is residue even when not a host root.
                        with self.assertRaisesRegex(SystemExit, "home-relative"):
                            etl.scan_output_bytes([(relative, relative.encode())])
                        continue
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
            for relative in ("packages/run/user/123/state", "packages/proc/123/status"):
                self.assertEqual(etl.redact_string(relative), relative)
            etl.scan_output_bytes([("fixture", b"packages/proc/123/status")])
            # Run-4 extension: a relative runtime-directory continuation still carries a uid.
            with self.assertRaisesRegex(SystemExit, "uid"):
                etl.scan_output_bytes([("fixture", b"packages/run/user/123/state")])

    def test_uri_authorities_bound_host_roots_in_rewrite_and_scan(self):
        with patch.object(Path, "home", return_value=Path("/home/alice")), \
                patch.object(etl, "FLEET_ROOT", Path("/workspace")):
            for scheme in ("file", "sftp", "git+ssh", "x.y-z0", "FILE"):
                for authority in ("", "localhost", "host:2222", "[::1]:2222"):
                    for path, expected in (("/home/alice/x", "<home>/x"), ("/home/x", "<home>/x"),
                                           ("/tmp/x", "<tmp>/x"), ("/proc/123/s", "<proc>/<process>/s"),
                                           ("/run/user/123/state", "<runtime>/state"), ("/dev/shm/x", "<shm>/x"),
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
        with patch.object(Path, "home", return_value=Path("/home/alice")), \
                patch.object(etl, "FLEET_ROOT", Path("/workspace")):
            for raw, expected in (("file:///home/alice/x", "file:///<home>/x"),
                                  ("file:///proc/123/status", "file:///<proc>/<process>/status"),
                                  ("file:///workspace/project/x", "file:///<fleet>/project/x"),
                                  ("file:///tmp/x", "file:///<tmp>/x"), ("file:///dev/shm/x", "file:///<shm>/x"),
                                  ("file:///run/user/123/state", "file:///<runtime>/state")):
                with self.subTest(raw=raw):
                    self.assertEqual(etl.redact_string(raw), expected)
                    self.assertEqual(etl.redact_string(expected), expected)
                    for label, data in (("fixture", raw.encode()), (raw, b"")):
                        with self.assertRaisesRegex(SystemExit, "host path"):
                            etl.scan_output_bytes([(label, data)])
                    etl.scan_output_bytes([(expected, expected.encode())])

    def test_nested_custody_and_per_capture_salt(self):
        payload = {"schemaVersion": "yeet-admission-reap-claim/v1", "_tag": "lease", "nonce": "owner",
                   "sourcePath": str(Path(tempfile.gettempdir()) / "owner-4242.lease.json"),
                   "lease": {"pid": 4242, "procStart": "start", "nested": {"pid": 4242, "procStart": "start"}},
                   "ticket": {"pid": 4242, "n": 5, "flag": False, "null": None}}
        counts = collections.Counter()
        actual = etl.redact(payload, b"a" * 32, counts)
        self.assertEqual(actual["lease"]["ownerRef"], actual["lease"]["nested"]["ownerRef"])
        self.assertEqual(actual["lease"]["ownerRef"], etl.sha256(f"4242:start:{(b'a' * 32).hex()}".encode())[:12])
        self.assertNotEqual(actual["lease"]["ownerRef"], actual["ticket"]["ownerRef"])
        self.assertEqual(counts["owner_refs"], 3)
        self.assertEqual(counts["owner_refs_without_start"], 1)
        self.assertIs(actual["ticket"]["flag"], False)
        self.assertIn("owner-<process>.lease.json", actual["sourcePath"])
        refreshed = etl.redact(payload, b"b" * 32, collections.Counter())
        self.assertNotEqual(actual["lease"]["ownerRef"], refreshed["lease"]["ownerRef"])
        encoded = etl.encode_json(actual)
        self.assertNotIn(b"4242", encoded)
        self.assertNotIn((b"a" * 32).hex().encode(), encoded)
        etl.scan_output_bytes([("fixture", encoded)])

    def test_residue_rejects_private_classes_without_echoing(self):
        host = socket.gethostname().encode()
        user = pwd.getpwuid(os.getuid()).pw_name.encode()
        identity = etl.capture_identity_tokens()
        x = b"x"
        shape = [str(etl.FLEET_ROOT / "private").encode(), str(Path.home() / "private").encode(),
                 str(Path(tempfile.gettempdir()) / "private").encode(), b"/home/another/private", b"/tmp/private",
                 b"/run/user/9876/state", b"/proc/123/status", b"/dev/shm/state", b"~/.beep/runtime/state",
                 b"uid-1234", b"user@1234.service", b"user-1234.slice", b"pid123", b"pid=123", b"pid:123",
                 b'{"pid":123}', b'{"pid":null}', b'{"procStart":"raw"}', b"nonce-123.lease.json", b"merged-preview-1234",
                 b"ghp_" + x * 25, b"github_pat_" + x * 25,
                 b"op://vault/item/field=Abcdef1234567890", b"sk-proj-" + x * 30, b"key sk-" + b"y" * 24,
                 b"xoxb-" + x * 20, b"AKIA" + b"X" * 16, b"-----BEGIN PRIVATE KEY-----",
                 b"authorization: bearer private", b"api_key=" + b"A" * 16, b"https://user:pass@example.invalid",
                 b"see ~/notes",
                 # Run-4 extensions (built at runtime; no literal credential shapes in this source).
                 b"gh" + b"o_" + x * 30, b"gh" + b"s_" + x * 30, b"gh" + b"u_" + x * 30, b"gh" + b"r_" + x * 30,
                 b"gl" + b"pat-" + x * 20, b"sk" + b"_live_" + x * 24, b"rk" + b"_test_" + x * 24,
                 b"AI" + b"za" + x * 35, b"np" + b"m_" + x * 36, b"ey" + b"J" + x * 10 + b".ey" + b"J" + x * 10,
                 b"https://hooks.slack" + b".com/services/T0/B0/" + x * 10, b"x_" + b"sk-proj-" + x * 30,
                 b"sk-" + b"ant-api03-" + x * 30, b"token=" + b"A1" * 10, b"credential: " + b"B2" * 10,
                 b"uid=1000", b'{"uid": 1000}', b'{"uid":"1000"}', b"gid=1000", b"x/run/user/1000/state"]
        for data in shape:
            with self.subTest(size=len(data)):
                with self.assertRaises(SystemExit) as exc:
                    etl.scan_output_bytes([("fixture", data)])
                self.assertNotIn(data.decode(), str(exc.exception))
        for data in (host, etl.sha256(host)[:12].encode(), host.lower(), host.upper(),
                     etl.sha256(host.lower())[:12].encode(), b"branch=" + user + b"-feature", b"branch=" + user.upper(),
                     b"runId=home_" + user + b"_x-0123456789ab"):
            with self.subTest(identity=len(data)):
                etl.scan_output_bytes([("fixture", data)])  # verify mode: identity tokens are capture-only
                with self.assertRaises(SystemExit) as exc:
                    etl.scan_output_bytes([("fixture", data)], [], identity)
                self.assertNotIn(data.decode(), str(exc.exception))
        etl.scan_output_bytes([("safe", b"branch=feat/tmpfs-reap\nownerRef=abcdef012345\nuid-<uid>\n<proc>/<process>/status\n")],
                              [], identity)
        etl.scan_output_bytes([("safe.properties", b'message={"pid":null,"proofTier":"full"}\n')], [], identity)
        # Run-4 fix: "task" inside a long name is not a provider key; "uuid" is not a uid assignment.
        etl.scan_output_bytes([("safe", b"laneId=quality:task-" + b"z" * 24 + b"\nuuid=1234\n")], [], identity)
        with self.assertRaises(SystemExit):
            etl.scan_output_bytes([("unsafe.properties", b'message={"pid":null}\nother={"pid":123}\n')])

    def test_encoded_home_marker_is_refused_only_where_it_starts_a_path_component(self):
        # P1 call (s), the run4-fleet rule: refused when no ASCII letter or digit precedes the marker, anywhere.
        marker = b"-" + b"home-"
        identity = etl.capture_identity_tokens()
        lane = b"beep-effect-worktrees/workspace" + marker + b"paths"
        component = etl.checkout_component(lane.decode()).encode()
        for label, data in (("ledgers/x/proof-ledger.ndjson", b'{"branch":"feat/take' + marker + b'exam"}\n'),
                            ("ledgers/x/proof-ledger.properties", b"branch=feat/take" + marker + b"exam\n"),
                            ("ledgers/x/proof-ledger.ndjson", b'{"originKey":"<fleet>/' + lane + b'"}\n'),
                            ("ledgers/x/proof-ledger.properties", b"originKey=<fleet>/" + lane + b"\n"),
                            (etl.MANIFEST_NAME, b"file: <fleet>/" + lane + b"/.beep/yeet/proof-ledger.ndjson\n"),
                            ("ledgers/" + component.decode() + "/proof-ledger.ndjson", b"{}\n")):
            with self.subTest(label=label, data=len(data)):
                etl.scan_output_bytes([(label, data)])
                etl.scan_output_bytes([(label, data)], [], identity)
        for label, data in (("ledgers/x/proof-ledger.ndjson", b'{"originKey":"<fleet>/beep-effect/' + marker + b'user-x/y"}\n'),
                            ("ledgers/x/proof-ledger.properties", b"branch=feat/" + marker + b"user-x/y\n"),
                            ("ledgers/x/proof-ledger.ndjson", b'{"branch":"' + marker + b'user-x"}\n'),
                            ("ledgers/x/proof-ledger.properties", b"runId=feat_" + marker + b"user-x-0123456789ab\n"),
                            (etl.MANIFEST_NAME, b"note: projects/" + marker + b"someone-cache\n"),
                            ("ledgers/" + marker.decode() + "user-x/proof-ledger.ndjson", b"{}\n")):
            with self.subTest(label=label, data=len(data)):
                with self.assertRaisesRegex(SystemExit, "encoded home marker starting a path component") as exc:
                    etl.scan_output_bytes([(label, data)])
                self.assertNotIn("user-x", str(exc.exception))

    def test_login_name_and_deny_list_classes_are_named_without_echo(self):
        user = pwd.getpwuid(os.getuid()).pw_name
        identity = etl.capture_identity_tokens()
        for variant in (user, user.upper(), user.capitalize()):
            with self.assertRaisesRegex(SystemExit, "login or home-owner name") as exc:
                etl.scan_output_bytes([("fixture", ("branch=feat/" + variant + "-x").encode())], [], identity)
            self.assertNotIn(user, str(exc.exception).lower())
        token = "raw-root-" + uuid.uuid4().hex
        for variant in (token, token.upper()):
            with self.assertRaisesRegex(SystemExit, "deny-list") as exc:
                etl.scan_output_bytes([("fixture", ("prefix" + variant + "/x").encode())], etl.deny_tokens([token]), [])
            self.assertNotIn(token, str(exc.exception).lower())
        etl.scan_output_bytes([("fixture", b"prefix/x")], [token.encode()], [])
        self.assertEqual(etl.deny_tokens(["/a/b", "/a", "/a/b/c", "/z", ""]), [b"/a", b"/z"])

    def test_identity_tokens_cover_case_fqdn_home_basename_and_fleet_owner(self):
        with patch.object(etl.socket, "gethostname", return_value="Fixture-Host7"), \
                patch.object(etl.socket, "getfqdn", return_value="Fixture-Host7.lan.example"), \
                patch.object(etl, "login_name", return_value="fixtureuser"), \
                patch.object(Path, "home", return_value=Path("/home/Fixtureuser")), \
                patch.object(etl, "FLEET_ROOT", Path("/home/fleetowner/projects")):
            tokens = etl.capture_identity_tokens()
        for expected in (b"fixture-host7", b"fixture-host7.lan.example", b"fixtureuser", b"fleetowner",
                         etl.sha256(b"fixture-host7")[:12].encode(), etl.sha256(b"Fixture-Host7")[:12].encode(),
                         etl.sha256(b"FIXTURE-HOST7")[:12].encode()):
            self.assertIn(expected, tokens)
        self.assertTrue(all(token == token.lower() for token in tokens))

    def test_reuse_key_width_stays_below_the_gitleaks_entropy_cut(self):
        # P1 Ruling 3 as amended: no value of this width can exceed generic-api-key's 3.5-bit entropy cut.
        self.assertLess(math.log2(etl.REUSE_KEY_HEX), etl.GITLEAKS_ENTROPY_CUT)
        worst = "0123456789abcdef"[:etl.REUSE_KEY_HEX]
        entropy = -sum((worst.count(c) / len(worst)) * math.log2(worst.count(c) / len(worst)) for c in set(worst))
        self.assertLess(entropy, 3.5)
        with patch.object(etl, "REUSE_KEY_HEX", 12):
            with self.assertRaisesRegex(SystemExit, "entropy cut"):
                etl.capture()

    def test_ignored_emitted_paths_are_refused(self):
        for path in ("ledgers/beep-effect.key/proof-ledger.ndjson", "ledgers/docs/proof-ledger.ndjson",
                     "ledgers/.env.local/proof-ledger.ndjson", "ledgers/build/proof-ledger.properties"):
            with self.subTest(path=path):
                with self.assertRaisesRegex(SystemExit, "git-ignored"):
                    etl.refuse_ignored_path(path)
        etl.refuse_ignored_path("ledgers/beep-effect%2F.claude%2Fworktrees%2Fx/proof-ledger.ndjson")

    def test_string_rewrites_and_checkout_component_injectivity(self):
        for value in ("/proc/123/status", "/dev/shm/state", "/run/user/9876/state", "~/.beep/runtime/state", "uid-9876"):
            etl.scan_output_bytes([("rewritten", etl.redact_string(value).encode())])
        labels = ["fixture/.claude/worktrees/name", "fixture/.beep/name", "fixture%2Fname", "fixture/name"]
        encoded = [etl.checkout_component(label) for label in labels]
        self.assertEqual(len(set(encoded)), len(labels))
        self.assertTrue(all("/" not in label for label in encoded))


class LedgerDecodeTests(unittest.TestCase):
    def setUp(self):
        self.fleet = Path("/fleet-fixture")
        self.patches = contextlib.ExitStack()
        self.addCleanup(self.patches.close)
        self.patches.enter_context(patch.object(etl, "FLEET_ROOT", self.fleet))
        self.rows = pair("/fleet-fixture/beep-effect", "2026-09-29T10:00:00.000Z")

    def decode(self, rows, extra=b""):
        return etl.decode_ledger(ledger_bytes(rows) + extra, "fixture")

    def test_valid_pair_decodes_and_pairs(self):
        rows, receipt = self.decode(self.rows)
        self.assertEqual(len(rows), 2)
        self.assertEqual(receipt, {"empty_lines": 0, "torn_rows": 0, "torn_line_ranges": [],
                                   "unterminated_tail_bytes": 0, "unpaired_adjacent_to_tear": 0,
                                   "source_line_ranges": [[1, 2]]})
        self.assertEqual(etl.ledger_pairing(rows, receipt, "fixture"), [True, True])

    def test_torn_empty_and_unterminated_rows_are_tallied_and_excluded(self):
        later = pair("/fleet-fixture/beep-effect", "2026-09-29T11:00:00.000Z")
        tail = b'{"kind":"shadow","partial'
        data = ledger_bytes(self.rows) + b"\n" + b'{"kind":"fact","sche\n' + b"\xff\xfe\n" + ledger_bytes(later) + tail
        rows, receipt = etl.decode_ledger(data, "fixture")
        self.assertEqual(len(rows), 4)
        self.assertEqual(receipt, {"empty_lines": 1, "torn_rows": 2, "torn_line_ranges": [[4, 5]],
                                   "unterminated_tail_bytes": len(tail), "unpaired_adjacent_to_tear": 0,
                                   "source_line_ranges": [[1, 2], [6, 7]]})

    def test_duplicate_members_and_non_standard_constants_are_drift_not_tears(self):
        for line in (b'{"a":1,"a":2}\n', b'{"kind":"shadow","durationMs":NaN}\n', b'{"x":Infinity}\n'):
            with self.subTest(line=line):
                with self.assertRaisesRegex(SystemExit, "schema drift") as exc:
                    etl.decode_ledger(ledger_bytes(self.rows) + line, "fixture")
                self.assertNotIn(line.decode().strip(), str(exc.exception))

    def test_realistic_tear_inside_an_append_keeps_its_orphan_pinned_without_failing(self):
        # appendAll writes [shadow, fact] in one write; a tear inside the fact plus the writer's later newline
        # recovery prefix leaves a valid shadow followed by a terminated torn line. W4-A6: the orphan is KEPT
        # (issuance history) and counted, never paired.
        first = pair("/fleet-fixture/beep-effect", "2026-09-29T10:00:00.000Z")
        second = pair("/fleet-fixture/beep-effect", "2026-09-29T11:00:00.000Z")
        third = pair("/fleet-fixture/beep-effect", "2026-09-29T12:00:00.000Z")
        fact = ledger_bytes(second[1:])
        data = ledger_bytes(first) + ledger_bytes(second[:1]) + fact[:60] + b"\n" + ledger_bytes(third)
        rows, receipt = etl.decode_ledger(data, "fixture")
        self.assertEqual([row["recordedAt"] if row["kind"] == "shadow" else row["fact"]["recordedAt"] for row in rows],
                         [first[0]["recordedAt"]] * 2 + [second[0]["recordedAt"]] + [third[0]["recordedAt"]] * 2)
        self.assertEqual((receipt["torn_rows"], receipt["torn_line_ranges"], receipt["unpaired_adjacent_to_tear"],
                          receipt["source_line_ranges"]), (1, [[4, 4]], 1, [[1, 3], [5, 6]]))
        self.assertEqual(etl.ledger_pairing(rows, receipt, "fixture"), [True, True, False, True, True])
        # A tear at the head of an append orphans the fact that follows it; the fact stays pinned.
        shadow = ledger_bytes(second[:1])
        rows, receipt = etl.decode_ledger(ledger_bytes(first) + shadow[:40] + b"\n" + fact + ledger_bytes(third), "fixture")
        self.assertEqual((len(rows), rows[2]["kind"], receipt["unpaired_adjacent_to_tear"]), (5, "fact", 1))
        self.assertEqual(etl.ledger_pairing(rows, receipt, "fixture"), [True, True, False, True, True])
        # A capture racing an in-flight append: complete shadow, partial fact as the unterminated tail.
        rows, receipt = etl.decode_ledger(ledger_bytes(first) + ledger_bytes(second[:1]) + fact[:60], "fixture")
        self.assertEqual((len(rows), receipt["unpaired_adjacent_to_tear"], receipt["unterminated_tail_bytes"]),
                         (3, 1, 60))
        self.assertEqual(etl.ledger_pairing(rows, receipt, "fixture"), [True, True, False])

    def test_intact_pair_split_by_a_torn_line_still_pairs(self):
        # Pairing runs over DECODED rows (W4-A6 (1)): pair1, shadow2, a torn line, shadow2's own agreeing fact.
        first = pair("/fleet-fixture/beep-effect", "2026-09-29T10:00:00.000Z")
        second = pair("/fleet-fixture/beep-effect", "2026-09-29T11:00:00.000Z")
        data = ledger_bytes(first + second[:1]) + b'{"kind":"fact","torn\n' + ledger_bytes(second[1:])
        rows, receipt = etl.decode_ledger(data, "fixture")
        self.assertEqual((len(rows), receipt["torn_rows"], receipt["unpaired_adjacent_to_tear"]), (4, 1, 0))
        self.assertEqual(etl.ledger_pairing(rows, receipt, "fixture"), [True] * 4)
        # Empty lines are skipped the same way, for pairs and for a tear beside an orphan.
        rows, receipt = etl.decode_ledger(ledger_bytes(second[:1]) + b"\n\n" + ledger_bytes(second[1:]), "fixture")
        self.assertEqual((receipt["empty_lines"], receipt["unpaired_adjacent_to_tear"]), (2, 0))
        rows, receipt = etl.decode_ledger(ledger_bytes(first + second[:1]) + b"\n" + b'{"torn\n', "fixture")
        self.assertEqual((len(rows), receipt["unpaired_adjacent_to_tear"]), (3, 1))

    def test_disagreeing_partners_across_a_tear_are_both_kept_unpaired(self):
        # A split append with another append landing inside it: shadowA, torn, factB (not A's fact), torn.
        first = pair("/fleet-fixture/beep-effect", "2026-09-29T10:00:00.000Z")
        second = pair("/fleet-fixture/beep-effect", "2026-09-29T11:00:00.000Z")
        data = ledger_bytes(first[:1]) + b'{"kind":"fact","torn\n' + ledger_bytes(second[1:]) + b'{"torn\n'
        rows, receipt = etl.decode_ledger(data, "fixture")
        self.assertEqual((len(rows), receipt["torn_line_ranges"], receipt["unpaired_adjacent_to_tear"]),
                         (2, [[2, 2], [4, 4]], 2))
        self.assertEqual(etl.ledger_pairing(rows, receipt, "fixture"), [False, False])

    def test_a_tear_on_the_far_side_never_excuses_an_orphan(self):
        # "Neighbouring" is read toward the missing partner: after a shadow, before a fact.
        first = pair("/fleet-fixture/beep-effect", "2026-09-29T10:00:00.000Z")
        second = pair("/fleet-fixture/beep-effect", "2026-09-29T11:00:00.000Z")
        third = pair("/fleet-fixture/beep-effect", "2026-09-29T12:00:00.000Z")
        torn = b'{"kind":"fact","torn\n'
        for data in (ledger_bytes(first) + torn + ledger_bytes(second[:1] + third),
                     ledger_bytes(first + second[1:]) + torn + ledger_bytes(third)):
            with self.subTest(data=len(data)):
                with self.assertRaisesRegex(SystemExit, "not adjacent to a torn line"):
                    etl.decode_ledger(data, "fixture")

    def test_verify_replays_pairing_from_the_recorded_layout(self):
        first = pair("/fleet-fixture/beep-effect", "2026-09-29T10:00:00.000Z")
        second = pair("/fleet-fixture/beep-effect", "2026-09-29T11:00:00.000Z")
        rows, receipt = etl.decode_ledger(ledger_bytes(first + second[:1]) + b'{"torn\n', "fixture")
        entry = {"rows": len(rows), **receipt}
        etl.verify_line_ranges(entry, "fixture")
        self.assertEqual(etl.ledger_pairing(rows, entry, "fixture"), [True, True, False])
        # Moving the tear away from the orphan (a coherent rewrite of both ranges) fails the replay.
        moved = {**entry, "source_line_ranges": [[2, 4]], "torn_line_ranges": [[1, 1]]}
        etl.verify_line_ranges(moved, "fixture")
        with self.assertRaisesRegex(SystemExit, "pairing violation"):
            etl.ledger_pairing(rows, moved, "fixture")
        for broken in ({**entry, "torn_line_ranges": [[3, 3]]}, {**entry, "torn_line_ranges": []},
                       {**entry, "torn_line_ranges": [[9, 9]]}, {**entry, "source_line_ranges": [[1, 2], [3, 3]]}):
            with self.subTest(broken=broken["source_line_ranges"] + broken["torn_line_ranges"]):
                with self.assertRaisesRegex(SystemExit, "source line ranges differ"):
                    etl.verify_line_ranges(broken, "fixture")

    def test_exact_key_sets_reject_what_the_typescript_reader_ignores(self):
        mutations = [lambda r: r[0].update(extra="x"), lambda r: r[1].update(extra="x"),
                     lambda r: r[1]["fact"].update(extra="x"), lambda r: r[1]["fact"]["key"].update(extra="x"),
                     lambda r: r[1]["fact"]["epoch"].update(extra="x"),
                     lambda r: r[1]["fact"]["provenance"].update(parentLaneId="lane"),
                     lambda r: r[0]["decision"].update(factRecordedAt="2026-09-29T10:00:00.000Z"),
                     lambda r: r[1]["fact"]["provenance"].pop("hostedRunId"), lambda r: r[0].pop("branch")]
        for index, mutate in enumerate(mutations):
            rows = json.loads(json.dumps(self.rows))
            mutate(rows)
            with self.subTest(index=index):
                with self.assertRaisesRegex(SystemExit, "schema drift"):
                    self.decode(rows)

    def test_unknown_literals_kinds_versions_and_types_fail_closed(self):
        mutations = [lambda r: r[0].update(stage="post-merge"), lambda r: r[0]["decision"].update(reason="other"),
                     lambda r: r[0].update(kind="rumour"), lambda r: r[1].update(schemaVersion="proof-fact/v2"),
                     lambda r: r[1]["fact"].update(schemaVersion="proof-fact/v2"),
                     lambda r: r[1]["fact"]["key"].update(laneClass="hosted-only"),
                     lambda r: r[1]["fact"]["provenance"].update(tier="partial"),
                     lambda r: r[1]["fact"].update(durationMs=True), lambda r: r[1]["fact"].update(durationMs=-1),
                     lambda r: r[0].update(durationMs="12"), lambda r: r[1]["fact"]["provenance"].update(hostedRunId=""),
                     lambda r: r[1]["fact"].update(recordedAt="2026-09-29T10:00:00"),
                     lambda r: r[0]["decision"].update(kind="maybe"), lambda r: r[0].update(laneId=""),
                     lambda r: r[1]["fact"]["key"].update(key="ABC"),
                     lambda r: r[1]["fact"]["provenance"].update(originKey="relative/path")]
        for index, mutate in enumerate(mutations):
            rows = json.loads(json.dumps(self.rows))
            mutate(rows)
            with self.subTest(index=index):
                with self.assertRaisesRegex(SystemExit, "schema drift"):
                    self.decode(rows)
        with self.assertRaisesRegex(SystemExit, "schema drift"):
            etl.decode_ledger(b"[1,2]\n", "fixture")

    def test_pairing_violations_fail_closed(self):
        later = pair("/fleet-fixture/beep-effect", "2026-09-29T11:00:00.000Z")
        cases = [self.rows[::-1], self.rows[:1], self.rows + later[1:]]
        for member, value in (("attemptId", "other"), ("laneId", "other"), ("recordedAt", "2026-09-29T10:00:01.000Z"),
                              ("stage", "repair-loop"), ("observed", "failed"), ("durationMs", 1)):
            rows = json.loads(json.dumps(self.rows))
            rows[0][member] = value
            cases.append(rows)
        rows = json.loads(json.dumps(self.rows))
        rows[0]["decision"]["key"] = hexkey("different")
        cases.append(rows)
        for index, rows in enumerate(cases):
            with self.subTest(index=index):
                # Decode pairs as it reads (disagreeing partners and orphans away from a tear fail there).
                with self.assertRaisesRegex(SystemExit, "pairing violation"):
                    self.decode(rows)
        # Disagreeing decoded partners fail even right after a tear.
        mismatched = json.loads(json.dumps(later))
        mismatched[1]["fact"]["outcome"] = "failed"
        with self.assertRaisesRegex(SystemExit, "paired members differ"):
            etl.decode_ledger(b'{"kind":"fact","torn\n' + ledger_bytes(mismatched), "fixture")
        for raw in (self.rows[:1], self.rows[1:], self.rows + later[:1]):
            with self.subTest(orphan=len(raw)):
                with self.assertRaisesRegex(SystemExit, "not adjacent to a torn line"):
                    self.decode(raw)
        pinned = json.loads(json.dumps(self.rows))
        pinned[0]["decision"]["key"] = pinned[1]["fact"]["key"]["key"] = pinned[1]["fact"]["key"]["key"][:etl.REUSE_KEY_HEX]
        pinned[1]["fact"]["provenance"]["originKey"] = "<fleet>/beep-effect"
        layout = {"source_line_ranges": [[1, 2]], "torn_line_ranges": [], "torn_rows": 0, "empty_lines": 0,
                  "unterminated_tail_bytes": 0}
        self.assertEqual(etl.ledger_pairing(pinned, layout, "fixture"), [True, True])
        with self.assertRaisesRegex(SystemExit, "pairing violation"):
            etl.ledger_pairing(pinned[::-1], layout, "fixture")

    def test_origin_labels_cover_every_layout_and_fail_closed_elsewhere(self):
        owner = self.fleet / "beep-effect"
        cases = {"/fleet-fixture/beep-effect": ("beep-effect", "clone-root"),
                 "/fleet-fixture/beep-effect8-s5": ("beep-effect8-s5", "fleet-root-checkout"),
                 "/fleet-fixture/beep-effect-worktrees/lane": ("beep-effect-worktrees/lane", "lane"),
                 "/fleet-fixture/beep-effect/.claude/worktrees/cw": ("beep-effect/.claude/worktrees/cw", "claude-worktree"),
                 "/fleet-fixture/beep-effect-worktrees/nested/.claude/worktrees/cw":
                     ("beep-effect-worktrees/nested/.claude/worktrees/cw", "claude-worktree"),
                 "/fleet-fixture/beep-effect/.beep/yeet/merged-preview-4242":
                     ("beep-effect/.beep/yeet/merged-preview-<process>", "merged-preview"),
                 "/fleet-fixture/beep-effect-worktrees/lane/.beep/yeet/merged-preview-17":
                     ("beep-effect-worktrees/lane/.beep/yeet/merged-preview-<process>", "merged-preview")}
        for origin, expected in cases.items():
            with self.subTest(origin=origin):
                self.assertEqual(etl.origin_label(origin, owner, "beep-effect"), expected)
                token = "<fleet>/" + expected[0]
                self.assertEqual(etl.projected_origin_kind(token, "beep-effect"), expected[1])
        for origin, message in (("/elsewhere/beep-effect", "outside the fleet root"),
                                ("/fleet-fixture/other-repo", "known fleet layouts"),
                                ("/fleet-fixture/a/b/c", "known fleet layouts"),
                                ("/fleet-fixture/a/b/.claude/worktrees/c", "known fleet layouts"),
                                ("/fleet-fixture/beep-effect/../x", "normalized"),
                                ("/fleet-fixture/beep-effect/", "normalized")):
            with self.subTest(origin=origin):
                with self.assertRaisesRegex(SystemExit, message):
                    etl.origin_label(origin, owner, "beep-effect")

    def test_canonical_origin_forms(self):
        for url in ("git@github.com:beep-effect/beep-effect.git", "https://github.com/beep-effect/beep-effect",
                    "https://GitHub.com/beep-effect/beep-effect.git/", "ssh://git@github.com/beep-effect/beep-effect.git"):
            self.assertEqual(etl.canonical_origin(url), etl.PUBLIC_ORIGIN, url)
        for url in ("git@github.com:beep-effect/beep-effect-private.git", "https://example.com/beep-effect/beep-effect",
                    "not a url", ""):
            self.assertNotEqual(etl.canonical_origin(url), etl.PUBLIC_ORIGIN, url)
        config = '[core]\n\tbare = false\n[remote "upstream"]\n\turl = x\n[remote  "origin"]\n  url=git@github.com:beep-effect/beep-effect.git\n'
        self.assertEqual(etl.origin_url(config), "git@github.com:beep-effect/beep-effect.git")
        self.assertIsNone(etl.origin_url('[remote "upstream"]\n\turl = x\n'))


class OwnerResolutionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=test_root())
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)

    def test_owning_clone_mirrors_the_ruling_71_resolver(self):
        clone = self.base / "clone"
        git_dir(clone, PUBLIC)
        lane = self.base / "lanes" / "lane"
        linked(lane, clone / ".git", "lane")
        bare = self.base / "repo.git"
        (bare / "objects").mkdir(parents=True)
        (bare / "HEAD").write_text("ref: refs/heads/main\n")
        bare_lane = self.base / "lanes" / "bare-lane"
        linked(bare_lane, bare, "bare-lane")
        separated = self.base / "separated-gitdir"
        separated.mkdir()
        sep_lane = self.base / "lanes" / "sep-lane"
        sep_lane.mkdir(parents=True)
        (sep_lane / ".git").write_text("gitdir: ../../separated-gitdir\n")
        plain = self.base / "plain"
        plain.mkdir()
        self.assertEqual(etl.owning_clone(clone), clone)
        self.assertEqual(etl.owning_clone(lane), clone)
        self.assertEqual(etl.owning_clone(bare_lane), bare)
        self.assertEqual(etl.owning_clone(sep_lane), separated)
        self.assertEqual(etl.owning_clone(plain), plain)
        self.assertEqual(etl.owner_kind(clone), "clone")
        self.assertEqual(etl.owner_kind(bare), "bare-or-separated")
        with self.assertRaisesRegex(SystemExit, "neither a clone"):
            etl.owner_kind(plain)
        with self.assertRaisesRegex(SystemExit, "linked worktree"):
            etl.owner_kind(lane)
        broken = self.base / "broken"
        broken.mkdir()
        (broken / ".git").write_text("nonsense\n")
        with self.assertRaisesRegex(SystemExit, "no gitdir line"):
            etl.owning_clone(broken)

    def test_read_ledger_refuses_symlinks_and_reads_once(self):
        owner = self.base / "clone"
        git_dir(owner, PUBLIC)
        self.assertIsNone(etl.read_ledger(owner))
        path = write_ledger(owner, pair(str(owner), "2026-09-29T10:00:00.000Z"))
        self.assertEqual(etl.read_ledger(owner), path.read_bytes())
        real = self.base / "elsewhere.ndjson"
        path.rename(real)
        path.symlink_to(real)
        with self.assertRaisesRegex(SystemExit, "symlink"):
            etl.read_ledger(owner)
        path.unlink()
        path.mkdir()
        with self.assertRaisesRegex(SystemExit, "not a regular file"):
            etl.read_ledger(owner)


class PinContractTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=test_root())
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.repo = build_repo(self.base / "repo")
        self.fleet = self.base / "fleet"
        self.paths = build_fleet(self.fleet)
        self.output = self.base / "out" / "run4-ledger"
        self.output.parent.mkdir()
        self.patches = contextlib.ExitStack()
        self.addCleanup(self.patches.close)
        self.patches.enter_context(patch.object(etl, "REPO_ROOT", self.repo))
        self.patches.enter_context(patch.object(etl, "FLEET_ROOT", self.fleet))
        self.patches.enter_context(patch.object(etl, "OUTPUT_ROOTS", {"ledger": self.output}))

    def run_main(self, *args):
        output = io.StringIO()
        with patch.object(sys, "argv", [str(etl.SCRIPT), *map(str, args)]), contextlib.redirect_stdout(output):
            etl.main()
        return json.loads(output.getvalue())

    def run_gate(self):
        output = io.StringIO()
        with patch.object(sys, "argv", [str(etl.SCRIPT)]), contextlib.redirect_stdout(output):
            with self.assertRaises(SystemExit) as exc:
                etl.main()
        self.assertEqual(exc.exception.code, 3)
        return json.loads(output.getvalue())

    def verify_cli(self, root=None):
        runner = ("import importlib.util,sys; from pathlib import Path; "
                  "s=importlib.util.spec_from_file_location('g',sys.argv[1]); m=importlib.util.module_from_spec(s); "
                  "sys.modules['g']=m; s.loader.exec_module(m); m.REPO_ROOT=Path(sys.argv[3]); "
                  "m.FLEET_ROOT=Path(sys.argv[4]); m.verify_output_tree(Path(sys.argv[2]),'ledger')")
        return subprocess.run([sys.executable, "-B", "-c", runner, str(etl.SCRIPT), str(root or self.output),
                               str(self.repo), str(self.fleet)], capture_output=True, text=True, timeout=120)

    def manifest(self):
        return yaml.safe_load((self.output / etl.MANIFEST_NAME).read_bytes())

    def leftovers(self):
        return sorted(p.name for p in self.output.parent.iterdir() if p.name.startswith(".run4-ledger"))

    def test_first_pin_census_projection_and_privacy(self):
        result = self.run_main()
        self.assertEqual(result["ledger"]["status"], "pinned")
        self.assertEqual(result["advisories"]["current_tree_citation_failures"], 0)
        manifest = self.manifest()
        self.assertEqual(manifest["schema_version"], "beep-ci-ops-run4-ledger-corpus/v1")
        self.assertEqual(manifest["stage"], "C")
        self.assertEqual(list(manifest)[:10], ["schema_version", "generated_by", "generator_sha256", "generator_lineage",
                                               "corpus_commit", "corpus_tree", "corpus_base", "corpus_ref", "capture_head",
                                               "citation_replay"])
        self.assertEqual(manifest["corpus_commit"], run_git(self.repo, "rev-parse", "refs/remotes/origin/main"))
        self.assertTrue(manifest["gate"]["holds"])
        self.assertTrue(manifest["gate"]["c4_1_checked"])
        self.assertEqual(manifest["gate"]["post_cut_pre_push_facts"], 3)
        self.assertEqual(manifest["cut"]["capture_check"], "advisory: commit absent at capture")
        discovery = manifest["discovery"]
        self.assertEqual(discovery["excluded"]["non_public_origin"], 1)
        self.assertEqual(discovery["owners_resolved"], 3)
        self.assertEqual(discovery["owners_bare_or_separated"], 1)
        self.assertEqual(discovery["owners_with_ledger"], 2)
        self.assertEqual(discovery["lane_ledgers_present_not_read"], 1)
        self.assertEqual(discovery["by_layout"], {"claude-worktrees": 1, "fleet-root": 2, "worktrees-dir": 2})
        ledgers = {entry["checkout"]: entry for entry in manifest["ledgers"]}
        self.assertEqual(ledgers["beep-effect2"]["ledger"], "absent")
        self.assertEqual(ledgers["beep-effect"]["facts"], 10)
        self.assertEqual(ledgers["beep-effect"]["source_line_ranges"], [[1, 20]])
        self.assertEqual(ledgers["beep-effect2"], {**{key: ledgers["beep-effect2"][key] for key in etl.ABSENT_LEDGER_KEYS},
                                                   **etl.ABSENT_COUNTS})
        self.assertEqual(list(ledgers["beep-effect2"]), etl.ABSENT_LEDGER_KEYS)
        bare = ledgers["beep-effect-bare.git"]
        self.assertEqual(bare["owner_kind"], "bare-or-separated")
        self.assertEqual(list(manifest), etl.MANIFEST_KEYS)
        self.assertEqual(manifest["merged_preview_followup"],
                         "a later sibling pin captures merged-preview facts recorded after this pin; post-cut "
                         "merged-preview facts recorded before it are pinned and counted here (P1 Rulings 1 and 8)")
        self.assertEqual(manifest["generator_lineage"][0]["sha256"], etl.sha256(RUN3B.read_bytes()))
        self.assertEqual(manifest["capture_only_members"], etl.CAPTURE_ONLY_MEMBERS)
        census = manifest["census"]
        self.assertEqual(census["stage_census"]["repair-loop"]["facts"], {"pre": 5, "post": 0})
        self.assertEqual(census["stage_census"]["merged-preview"],
                         {"facts": {"pre": 1, "post": 0}, "shadows": {"pre": 1, "post": 0},
                          "reading": "dormant in capture window (P1 Ruling 1)"})
        self.assertEqual(census["hits"]["reading"], "hypothetical would-reuse, never realized (graduation Ruling 1)")
        self.assertIn("time-to-certainty C4.2", census["hits"]["flagged_legs"])
        self.assertIn("time-to-certainty ruling 63", census["observation_basis"])
        distinct = census["distinct"]
        self.assertEqual((distinct["lanes"], distinct["lanes_bare"], distinct["lanes_qualified"]), (9, 1, 8))
        self.assertEqual(distinct["lanes"], distinct["lanes_bare"] + distinct["lanes_qualified"])
        self.assertEqual(census["stage_census"]["hosted"], {"facts": {"pre": 0, "post": 0}, "shadows": {"pre": 0, "post": 0}})
        self.assertEqual({e["kind"] for e in census["origin"]}, {"clone-root", "lane", "claude-worktree", "merged-preview"})
        self.assertEqual(census["hits"]["total"], 2)
        self.assertEqual(census["hits"]["resolved_prior"], 1)
        self.assertEqual(census["hits"]["unresolved"], 1)
        self.assertEqual(census["hits"]["cross_origin"], 1)
        self.assertEqual(census["hits"]["disagreements"], 1)
        self.assertEqual(census["vocabularies"]["shadow.decision.reason"]["expired"], 0)
        self.assertEqual(census["join_coverage"]["origin_unprobed"], 1)
        self.assertEqual(census["residue"]["keys_projected"], 22)
        self.assertEqual(census["run_id_branch_derivation"]["differs"], 0)
        payload = (self.output / "ledgers/beep-effect/proof-ledger.ndjson").read_bytes()
        rows = etl.decode_ndjson(payload, "pin")
        self.assertTrue(all(len(r["fact"]["key"]["key"] if r["kind"] == "fact" else r["decision"]["key"]) == etl.REUSE_KEY_HEX for r in rows))
        origins = {r["fact"]["provenance"]["originKey"] for r in rows if r["kind"] == "fact"}
        self.assertEqual(origins, {"<fleet>/beep-effect", "<fleet>/beep-effect-worktrees/lane-a",
                                   "<fleet>/beep-effect/.claude/worktrees/cw1",
                                   "<fleet>/beep-effect/.beep/yeet/merged-preview-<process>"})
        everything = all_bytes(self.output)
        for forbidden in (b"beep-effect-private", b"private-marker-branch", str(self.fleet).encode(),
                          str(self.base).encode(), b"MUST-NOT-BE-READ", b"987654321",
                          pwd.getpwuid(os.getuid()).pw_name.encode()):
            self.assertNotIn(forbidden, everything)
        for path in self.output.rglob("*"):
            self.assertNotIn(".beep", path.relative_to(self.output).parts)
        self.assertEqual(self.leftovers(), [])

    def test_verify_only_rerun_reads_no_fleet_salt_or_capture(self):
        self.run_main()
        before = tree_bytes(self.output)
        with patch.object(etl, "capture", side_effect=AssertionError("capture")), \
                patch.object(etl, "discover_checkouts", side_effect=AssertionError("discover")), \
                patch.object(etl, "read_ledger", side_effect=AssertionError("ledger")), \
                patch.object(etl.os, "urandom", side_effect=AssertionError("salt")):
            result = self.run_main()
        self.assertEqual(result["ledger"]["status"], "verified")
        self.assertEqual(before, tree_bytes(self.output))

    def test_verify_spawns_only_recorded_object_plumbing(self):
        self.run_main()
        real_run = subprocess.run
        seen = []

        def guarded(argv, *args, **kwargs):
            self.assertEqual(argv[:5], ["git", "--no-optional-locks", "--no-replace-objects", "--no-lazy-fetch", "-C"])
            command = argv[6:]
            seen.append(command[0])
            self.assertIn(command[0], ("cat-file", "rev-parse", "merge-base"))
            if command[0] == "merge-base":
                self.assertEqual(command[1], "--is-ancestor")
            if command[0] == "rev-parse":
                self.assertNotIn("HEAD", " ".join(command))
            return real_run(argv, *args, **kwargs)
        with patch.object(etl.subprocess, "run", side_effect=guarded):
            self.run_main()
        self.assertIn("cat-file", seen)

    def test_refresh_replaces_only_its_root_and_leaves_no_stage(self):
        self.run_main()
        decoy = self.output.parent / "run4-fleet" / "MANIFEST.yaml"
        decoy.parent.mkdir()
        decoy.write_text("decoy\n")
        before = tree_bytes(self.output)
        result = self.run_main("--refresh", "ledger")
        self.assertEqual(result["ledger"]["status"], "pinned")
        self.assertEqual(decoy.read_text(), "decoy\n")
        after = tree_bytes(self.output)
        self.assertNotEqual(before["MANIFEST.yaml"], after["MANIFEST.yaml"])
        self.assertEqual({k: v for k, v in before.items() if k != "MANIFEST.yaml"},
                         {k: v for k, v in after.items() if k != "MANIFEST.yaml"})
        self.assertEqual(self.leftovers(), [])

    def test_lane_beep_trees_are_never_listed_or_opened(self):
        lane = str(self.paths["lane"])
        real_open, real_os_open = builtins.open, os.open
        real_scandir, real_listdir, real_walk = os.scandir, os.listdir, os.walk
        real_iterdir, real_glob, real_rglob = Path.iterdir, Path.glob, Path.rglob

        def refuse(path):
            text = os.fspath(path) if not isinstance(path, int) else ""
            if "/.beep" in text and (text.startswith(lane) or not text.endswith("/.beep/yeet/proof-ledger.ndjson")):
                raise AssertionError(".beep access outside an owning-clone ledger")

        def guard_open(file, *args, **kwargs):
            refuse(file)
            return real_open(file, *args, **kwargs)

        def guard_os_open(path, *args, **kwargs):
            refuse(path)
            return real_os_open(path, *args, **kwargs)

        def guard_list(real):
            def guarded(path=".", *args, **kwargs):
                if "/.beep" in os.fspath(path):
                    raise AssertionError(".beep listing")
                return real(path, *args, **kwargs)
            return guarded

        def guard_path(real):
            def guarded(self, *args, **kwargs):
                if "/.beep" in str(self) or any(".beep" in str(arg) for arg in args):
                    raise AssertionError(".beep listing")
                return real(self, *args, **kwargs)
            return guarded
        with patch.object(builtins, "open", guard_open), patch.object(io, "open", guard_open), \
                patch.object(etl.os, "open", guard_os_open), \
                patch.object(etl.os, "scandir", guard_list(real_scandir)), \
                patch.object(etl.os, "listdir", guard_list(real_listdir)), \
                patch.object(etl.os, "walk", guard_list(real_walk)), \
                patch.object(Path, "iterdir", guard_path(real_iterdir)), \
                patch.object(Path, "glob", guard_path(real_glob)), \
                patch.object(Path, "rglob", guard_path(real_rglob)):
            captured = etl.capture()
        self.assertEqual(captured.metadata["discovery"]["lane_ledgers_present_not_read"], 1)
        self.assertNotIn(b"MUST-NOT-BE-READ", b"".join(entry.data for entry in captured.emitted))

    def test_gate_without_post_cut_pre_push_facts_exits_3_and_writes_nothing(self):
        a = self.paths["a"]
        rows = [row for row in self.paths["rows_a"]
                if (row["fact"]["provenance"]["stage"] if row["kind"] == "fact" else row["stage"]) != "pre-push"
                or (row["fact"]["recordedAt"] if row["kind"] == "fact" else row["recordedAt"]) < etl.CUT_INSTANT]
        write_ledger(a, rows)
        census = self.run_gate()
        self.assertEqual(census["verification"], "GATE")
        self.assertEqual(census["ledger"]["status"], "census recorded; pin lane stopped")
        self.assertEqual(census["ledger"]["post_cut_pre_push_facts"], 0)
        self.assertEqual(census["ledger"]["stage_census"]["merged-preview"]["facts"], {"pre": 1, "post": 0})
        self.assertFalse(self.output.exists())
        self.assertEqual(self.leftovers(), [])

    def test_gate_with_c4_1_unchecked_exits_3(self):
        plan = self.repo / etl.TTC_PLAN
        plan.write_text(plan.read_text().replace("  - [x] " + etl.C4_1_NEEDLE, "  - [ ] " + etl.C4_1_NEEDLE))
        run_git(self.repo, "commit", "-qam", "fixture: uncheck C4.1")
        run_git(self.repo, "update-ref", "refs/remotes/origin/main", "HEAD")
        census = self.run_gate()
        self.assertFalse(census["ledger"]["c4_1_checked"])
        self.assertFalse(self.output.exists())

    def test_torn_rows_and_unterminated_tail_are_receipted(self):
        a = self.paths["a"]
        path = a / ".beep/yeet/proof-ledger.ndjson"
        data = path.read_bytes()
        cut = data.index(b"\n") + 1
        path.write_bytes(data[:cut] + data[cut:cut + 40].replace(b"\n", b"") + b"\n" + data[cut:] + b'{"kind":"sha')
        self.run_main()
        entry = next(e for e in self.manifest()["ledgers"] if e["checkout"] == "beep-effect")
        # The torn line sits between the first shadow and its own agreeing fact: pairing runs over decoded rows,
        # so the pair survives (W4-A6 (1)) and no row is orphaned.
        self.assertEqual((entry["torn_rows"], entry["torn_line_ranges"], entry["unterminated_tail_bytes"], entry["rows"],
                          entry["unpaired_adjacent_to_tear"], entry["source_line_ranges"]),
                         (1, [[2, 2]], 12, 20, 0, [[1, 1], [3, 21]]))
        self.assertEqual(self.manifest()["census"]["pairing"]["pairs"], 11)
        self.assertEqual(self.run_main()["ledger"]["status"], "verified")

    def test_orphan_beside_a_tear_is_pinned_and_left_out_of_pairs_hits_and_census(self):
        # Tear the shadow of the pair whose fact the resolvable hit points to: that fact becomes an orphan.
        path = self.paths["a"] / ".beep/yeet/proof-ledger.ndjson"
        lines = path.read_bytes().split(b"\n")
        lines[12] = lines[12][:40]
        path.write_bytes(b"\n".join(lines))
        result = self.run_main()
        self.assertEqual(result["ledger"]["status"], "pinned")
        manifest = self.manifest()
        entry = next(e for e in manifest["ledgers"] if e["checkout"] == "beep-effect")
        self.assertEqual((entry["rows"], entry["facts"], entry["shadows"], entry["torn_rows"], entry["torn_line_ranges"],
                          entry["unpaired_adjacent_to_tear"], entry["source_line_ranges"]),
                         (19, 10, 9, 1, [[13, 13]], 1, [[1, 12], [14, 20]]))
        rows = etl.decode_ndjson((self.output / "ledgers/beep-effect/proof-ledger.ndjson").read_bytes(), "pin")
        self.assertEqual((rows[12]["kind"], rows[12]["fact"]["recordedAt"]), ("fact", "2026-09-29T10:00:00.000Z"))
        census = manifest["census"]
        self.assertEqual(census["pairing"]["pairs"], 10)
        self.assertEqual(census["pairing"]["unpaired_adjacent_to_tear"], 1)
        self.assertEqual((census["hits"]["total"], census["hits"]["resolved_prior"], census["hits"]["unresolved"]),
                         (2, 0, 2))
        self.assertEqual(manifest["gate"]["post_cut_pre_push_facts"], 2)
        self.assertEqual(census["stage_census"]["pre-push"]["facts"]["post"], 2)
        self.assertEqual((census["residue"]["keys_projected"], census["residue"]["origin_keys_replaced"]), (21, 11))
        self.assertEqual(sum(e["facts"] for e in census["origin"]), 10)
        self.assertEqual(self.run_main()["ledger"]["status"], "verified")
        present = lambda m: next(e for e in m["ledgers"] if e["checkout"] == "beep-effect")  # noqa: E731
        self.assert_census_fails(lambda m: present(m).update(unpaired_adjacent_to_tear=0), "unpaired_adjacent_to_tear")
        self.assert_census_fails(lambda m: m["census"]["pairing"].update(unpaired_adjacent_to_tear=0),
                                 "ledger census differs: pairing")
        self.assert_census_fails(lambda m: present(m).update(source_line_ranges=[[1, 13], [15, 20]],
                                                             torn_line_ranges=[[14, 14]]), "pairing violation")
        self.assert_census_fails(lambda m: present(m).update(torn_line_ranges=[[12, 12]]), "source line ranges differ")

    def test_drift_collision_outside_fleet_and_bad_gitfile_fail_closed_without_writing(self):
        a = self.paths["a"]
        rows = json.loads(json.dumps(self.paths["rows_a"]))
        drifted = json.loads(json.dumps(rows))
        drifted[1]["fact"]["provenance"]["checkoutRoot"] = str(a)
        collide = json.loads(json.dumps(rows))
        other = collide[-1]["fact"]["key"]["key"][:etl.REUSE_KEY_HEX] + hexkey("collision")[etl.REUSE_KEY_HEX:]
        collide[-2]["decision"]["key"] = collide[-1]["fact"]["key"]["key"] = other
        collide[-4]["decision"]["key"] = collide[-3]["fact"]["key"]["key"] = other[:etl.REUSE_KEY_HEX] + hexkey("x")[etl.REUSE_KEY_HEX:]
        outside = json.loads(json.dumps(rows))
        outside[1]["fact"]["provenance"]["originKey"] = str(self.base / "elsewhere")
        for name, variant, message in (("drift", drifted, "schema drift"), ("collision", collide, "not injective"),
                                       ("outside", outside, "outside the fleet root")):
            with self.subTest(name=name):
                write_ledger(a, variant)
                with self.assertRaisesRegex(SystemExit, message):
                    self.run_main()
                self.assertFalse(self.output.exists())
        write_ledger(a, rows)
        broken = self.fleet / "beep-effect3"
        broken.mkdir()
        (broken / ".git").write_text("nonsense\n")
        with self.assertRaisesRegex(SystemExit, "no gitdir line"):
            self.run_main()
        self.assertFalse(self.output.exists())

    def test_missing_and_unreadable_origins_are_excluded_by_reason(self):
        git_dir(self.fleet / "beep-effect4", None)
        (self.fleet / "beep-effect4" / ".git" / "config").write_text("[core]\n\tbare = false\n")
        locked = self.fleet / "beep-effect5"
        git_dir(locked, PUBLIC)
        (locked / ".git" / "config").chmod(0)
        self.addCleanup((locked / ".git" / "config").chmod, 0o644)
        _, excluded, _ = etl.discover_checkouts()
        self.assertEqual(excluded["missing_origin"], 1)
        if os.geteuid() != 0:
            self.assertEqual(excluded["unreadable_git_metadata"], 1)
        self.assertEqual(excluded["non_public_origin"], 1)

    def test_raw_path_smuggled_into_branch_is_refused(self):
        a = self.paths["a"]
        rows = json.loads(json.dumps(self.paths["rows_a"]))
        rows[-2]["branch"] = "feat" + str(self.paths["lane"])
        write_ledger(a, rows)
        with self.assertRaisesRegex(SystemExit, "deny-list"):
            self.run_main()
        rows[-2]["branch"] = "feat " + str(self.paths["lane"])
        write_ledger(a, rows)
        with self.assertRaisesRegex(SystemExit, "changed under redaction"):
            self.run_main()
        self.assertFalse(self.output.exists())

    def test_corruption_and_same_length_census_mutation_fail_cli(self):
        self.run_main()
        self.assertEqual(self.verify_cli().returncode, 0)
        payload = next(self.output.rglob("*.properties"))
        original = payload.read_bytes()
        try:
            payload.write_bytes(original + b"corrupt=fixture\n")
            self.assertNotEqual(self.verify_cli().returncode, 0)
        finally:
            payload.write_bytes(original)
        target = self.output / etl.MANIFEST_NAME
        manifest = target.read_bytes()
        for pattern in (rb"pairs: (\d+)", rb"resolved_prior: (\d+)", rb"post_cut_pre_push_facts: (\d+)",
                        rb"origin_keys_replaced: (\d+)", rb"keys_projected: (\d+)", rb"lanes_bare: (\d+)",
                        rb"lanes_qualified: (\d+)",
                        rb"origin_gone_at_capture: (\d+)", rb"first_post_cut: '([^']+)'"):
            match = re.search(pattern, manifest)
            self.assertIsNotNone(match, pattern)
            start, end = match.span(1)
            last = manifest[end - 2:end - 1] if pattern.endswith(b"'") else manifest[end - 1:end]
            index = end - 2 if pattern.endswith(b"'") else end - 1
            mutated = manifest[:index] + (b"1" if last != b"1" else b"2") + manifest[index + 1:]
            self.assertEqual(len(mutated), len(manifest))
            try:
                target.write_bytes(mutated)
                self.assertNotEqual(self.verify_cli().returncode, 0, pattern)
            finally:
                target.write_bytes(manifest)
        self.assertEqual(self.verify_cli().returncode, 0)

    def test_unlisted_file_fails_inventory(self):
        self.run_main()
        extra = self.output / "unlisted" / etl.MANIFEST_NAME
        extra.parent.mkdir()
        extra.write_text("unlisted fixture")
        with self.assertRaisesRegex(SystemExit, "inventory"):
            etl.verify_output_tree(self.output, "ledger")

    def test_coherent_variant_receipt_and_aggregate_rewrite_is_rejected(self):
        captured = etl.capture()
        entry = next(e for e in captured.metadata["ledgers"] if e["ledger"] == "present")
        for census in (entry["owner_refs_by_variant"], captured.metadata["custody"]["owner_refs_by_variant"],
                       captured.metadata["census"]["residue"]["owner_refs_by_variant"]):
            census["pid_pair"] += 1
        entry["redaction_counts"]["owner_refs"] = 1
        manifest = etl.finish_manifest(captured.metadata, captured.emitted, "ledger")
        with self.assertRaisesRegex(SystemExit, "owner reference"):
            etl.write_staged_capture(captured.emitted, manifest, self.output, "ledger")
        self.assertFalse(self.output.exists())

    def test_tree_pinned_replay_survives_cited_file_edits_with_advisory(self):
        self.run_main()
        plan = self.repo / etl.TTC_PLAN
        plan.write_text("moved\n" * 3 + plan.read_text().replace(etl.C4_1_NEEDLE, "C4.1 renamed later"))
        run_git(self.repo, "commit", "-qam", "fixture: edit cited file")
        run_git(self.repo, "update-ref", "refs/remotes/origin/main", "HEAD")
        result = self.run_main()
        self.assertEqual(result["ledger"]["status"], "verified")
        self.assertEqual(result["advisories"]["current_tree_citation_failures"], 1)
        self.assertEqual(result["advisories"]["corpus_base_not_ancestor"], 0)
        self.assertEqual(self.verify_cli().returncode, 0)

    def test_tampered_citation_missing_tree_and_root_mismatch_fail(self):
        self.run_main()
        target = self.output / etl.MANIFEST_NAME
        manifest = target.read_bytes()
        loaded = yaml.safe_load(manifest)
        cite = loaded["gate"]["c4_1"]
        line = str(cite["line"]).encode()
        other_line = str(cite["line"] + 1).encode()
        self.assertEqual(len(line), len(other_line))
        sha = cite["sha256"].encode()
        tree = loaded["corpus_tree"].encode()
        commit = loaded["corpus_commit"].encode()
        plan = self.repo / etl.TTC_PLAN
        plan.write_text(plan.read_text() + "later\n")
        run_git(self.repo, "commit", "-qam", "fixture: second commit")
        second = run_git(self.repo, "rev-parse", "HEAD").encode()
        needle_at = manifest.index(b"needle: C4.1 shadow")
        line_at = manifest.rindex(b"line: " + line, 0, needle_at)
        moved = manifest[:line_at] + b"line: " + other_line + manifest[line_at + len(b"line: " + line):]
        cases = [(manifest, moved, "source citation differs"),
                 (b"needle: C4.1 shadow", b"needle: C4.2 shadow", "source citation differs"),
                 (sha, sha[:-1] + (b"0" if sha[-1:] != b"0" else b"1"), "source citation differs"),
                 (b"corpus_tree: " + tree, b"corpus_tree: " + hexkey("absent")[:40].encode(), "git fetch origin " + commit.decode()),
                 (b"corpus_commit: " + commit, b"corpus_commit: " + second, "root tree differs")]
        for old, new, message in cases:
            with self.subTest(message=message, old=old[:20]):
                self.assertIn(old, manifest)
                mutated = manifest.replace(old, new, 1)
                self.assertEqual(len(mutated), len(manifest))
                try:
                    target.write_bytes(mutated)
                    with self.assertRaisesRegex(SystemExit, re.escape(message)):
                        etl.verify_output_tree(self.output, "ledger")
                finally:
                    target.write_bytes(manifest)
        absent = manifest.replace(b"corpus_commit: " + commit, b"corpus_commit: " + hexkey("gone")[:40].encode(), 1)
        try:
            target.write_bytes(absent)
            etl.verify_output_tree(self.output, "ledger")
            self.assertEqual(etl.LAST_ADVISORIES["corpus_commit_absent"], 1)
        finally:
            target.write_bytes(manifest)

    def test_capture_refuses_dirty_cited_file_missing_origin_main_and_ambiguous_needles(self):
        plan = self.repo / etl.TTC_PLAN
        original = plan.read_bytes()
        plan.write_bytes(original + b"dirty\n")
        with self.assertRaisesRegex(SystemExit, "merge origin/main"):
            self.run_main()
        plan.write_bytes(original)
        reader = etl.TreeReader(run_git(self.repo, "rev-parse", "HEAD^{tree}"))
        file = etl.YEET + "ProofShadow.ts"
        with self.assertRaisesRegex(SystemExit, "ambiguous"):
            etl.cite(reader, file, 'laneClass: "cli-runnable",')
        cited = etl.cite(reader, file, 'laneClass: "cli-runnable",', 2)
        self.assertEqual(cited["occurrence"], 2)
        with self.assertRaisesRegex(SystemExit, "anchor missing"):
            etl.cite(reader, file, "pipe(branch, repoRunSafeArtifactName")
        run_git(self.repo, "update-ref", "-d", "refs/remotes/origin/main")
        with self.assertRaisesRegex(SystemExit, "origin/main is absent"):
            self.run_main()
        self.assertFalse(self.output.exists())

    def test_dry_run_root_is_isolated_and_reverifies(self):
        dry = self.base / "dry"
        result = self.run_main("--dry-run-root", dry)
        self.assertTrue(result["ledger"]["dry_run"])
        self.assertFalse(self.output.exists())
        root = dry / "run4-ledger"
        manifest = (root / etl.MANIFEST_NAME).read_bytes()
        self.assertNotIn(b"dry", manifest.lower().replace(b"dry_run", b""))
        self.assertEqual(self.run_main("--dry-run-root", dry)["ledger"]["status"], "verified")
        self.assertEqual(self.verify_cli(root).returncode, 0)
        for bad in ("relative/dir", str(self.repo / "inside"), str(self.fleet / "inside")):
            with self.assertRaisesRegex(SystemExit, "dry-run-root"):
                self.run_main("--dry-run-root", bad)


    # --- Regressions for the run-4 review findings ---------------------------------------------------------

    def census_inputs(self):
        manifest = self.manifest()
        raw = {r["path"]: etl.decode_ndjson((self.output / r["path"]).read_bytes(), r["path"])
               for r in manifest["files"] if r["kind"] != etl.PROJECTION_KIND}
        return manifest, raw, etl.TreeReader(manifest["corpus_tree"])

    def assert_census_fails(self, mutate, message):
        manifest, raw, reader = self.census_inputs()
        etl.verify_census(manifest, raw, reader)
        mutate(manifest)
        with self.assertRaisesRegex(SystemExit, message):
            etl.verify_census(manifest, raw, reader)

    def test_manifest_carries_no_raw_ledger_digest_or_length(self):
        # W4-A1 and P1 note (i): no member equals the digest or length of raw (or fleet-neutral) ledger bytes,
        # including a ledger with a torn row and an unterminated tail that hold a truncated host path.
        a = self.paths["a"]
        path = a / ".beep/yeet/proof-ledger.ndjson"
        data = path.read_bytes()
        fragment = str(self.base)[:-3].encode()
        torn = b'{"kind":"fact","fact":{"provenance":{"originKey":"' + fragment + b"\n"
        cut = data.index(b"\n", data.index(b"\n") + 1) + 1  # after the first complete pair
        path.write_bytes(data[:cut] + torn + data[cut:] + b'{"kind":"shadow","branch":"' + fragment)
        self.run_main()
        manifest = self.manifest()
        scalars = []

        def walk(value):
            if isinstance(value, dict):
                for key, child in value.items():
                    scalars.append(key)
                    walk(child)
            elif isinstance(value, list):
                for child in value:
                    walk(child)
            else:
                scalars.append(value)
        walk(manifest)
        for owner in (a, self.paths["bare"]):
            raw = (owner / ".beep/yeet/proof-ledger.ndjson").read_bytes()
            tokenized = raw.replace(str(self.fleet).encode(), b"<fleet>")
            for forbidden in (etl.sha256(raw), len(raw), etl.sha256(tokenized), len(tokenized)):
                with self.subTest(owner=owner.name, forbidden=forbidden):
                    self.assertNotIn(forbidden, scalars)
        self.assertNotIn(b"fleet_neutral", (self.output / etl.MANIFEST_NAME).read_bytes())
        self.assertNotIn(fragment, all_bytes(self.output))
        entry = next(e for e in manifest["ledgers"] if e["checkout"] == "beep-effect")
        self.assertEqual((entry["torn_rows"], entry["unpaired_adjacent_to_tear"], entry["rows"]), (1, 0, 20))

    def test_post_cut_merged_preview_facts_are_pinned_and_read_as_observed(self):
        # P1 Ruling 8: a post-cut merged-preview fact never refuses the pin; it is pinned, counted, and the
        # reading is recomputed from pinned bytes at verify.
        rows = json.loads(json.dumps(self.paths["rows_a"]))
        rows += pair(self.paths["merged"], "2026-10-01T12:00:00.000Z", stage="merged-preview", lane="merged:late")
        rows += pair(self.paths["merged"], "2026-10-02T12:00:00.000Z", stage="merged-preview", lane="merged:later")
        write_ledger(self.paths["a"], rows)
        result = self.run_main()
        self.assertEqual(result["ledger"]["status"], "pinned")
        manifest = self.manifest()
        self.assertTrue(manifest["gate"]["holds"])
        self.assertEqual(manifest["census"]["stage_census"]["merged-preview"],
                         {"facts": {"pre": 1, "post": 2}, "shadows": {"pre": 1, "post": 2},
                          "reading": "observed after the cut: 2 merged-preview fact(s) (P1 Ruling 8)"})
        self.assertEqual(manifest["census"]["join_coverage"]["merged_preview_origin_facts"], 3)
        payload = etl.decode_ndjson((self.output / "ledgers/beep-effect/proof-ledger.ndjson").read_bytes(), "pin")
        self.assertEqual(sum(r["kind"] == "fact" and r["fact"]["provenance"]["stage"] == "merged-preview"
                             and r["fact"]["recordedAt"] >= etl.CUT_INSTANT for r in payload), 2)
        self.assertEqual(self.verify_cli().returncode, 0)
        self.assertEqual(self.run_main()["ledger"]["status"], "verified")
        self.assertEqual(self.leftovers(), [])
        dormant = "dormant in capture window (P1 Ruling 1)"
        self.assert_census_fails(lambda m: m["census"]["stage_census"]["merged-preview"].update(reading=dormant),
                                 "ledger census differs: stage_census")
        self.assert_census_fails(
            lambda m: m["census"]["stage_census"]["merged-preview"].update(
                reading="observed after the cut: 1 merged-preview fact(s) (P1 Ruling 8)"),
            "ledger census differs: stage_census")

    def test_dormant_merged_preview_reading_is_recomputed_at_verify(self):
        self.run_main()
        self.assert_census_fails(
            lambda m: m["census"]["stage_census"]["merged-preview"].update(
                reading="observed after the cut: 0 merged-preview fact(s) (P1 Ruling 8)"),
            "ledger census differs: stage_census")
        self.assert_census_fails(lambda m: m["census"]["stage_census"]["merged-preview"].pop("reading"),
                                 "ledger census differs: stage_census")

    def test_lone_post_cut_merged_preview_shadow_whose_fact_tore_reads_dormant(self):
        # P1 call (t): Ruling 8's post-cut count is a count of merged-preview FACTS. A post-cut merged-preview
        # shadow whose fact tore is an orphan kept beside the tear: it is pinned and counted under the tear
        # receipts, and the reading stays dormant because no post-cut merged-preview fact exists.
        shadow, fact = pair(self.paths["merged"], "2026-10-01T12:00:00.000Z", stage="merged-preview", lane="merged:torn")
        write_ledger(self.paths["a"], self.paths["rows_a"] + [shadow], ledger_bytes([fact])[:60] + b"\n")
        self.assertEqual(self.run_main()["ledger"]["status"], "pinned")
        manifest = self.manifest()
        entry = next(e for e in manifest["ledgers"] if e["checkout"] == "beep-effect")
        self.assertEqual((entry["rows"], entry["shadows"], entry["torn_rows"], entry["unpaired_adjacent_to_tear"]),
                         (21, 11, 1, 1))
        self.assertEqual(manifest["census"]["pairing"]["unpaired_adjacent_to_tear"], 1)
        self.assertEqual(manifest["census"]["stage_census"]["merged-preview"],
                         {"facts": {"pre": 1, "post": 0}, "shadows": {"pre": 1, "post": 0},
                          "reading": "dormant in capture window (P1 Ruling 1)"})
        payload = etl.decode_ndjson((self.output / "ledgers/beep-effect/proof-ledger.ndjson").read_bytes(), "pin")
        self.assertEqual((payload[-1]["kind"], payload[-1]["stage"], payload[-1]["recordedAt"]),
                         ("shadow", "merged-preview", "2026-10-01T12:00:00.000Z"))
        self.assertEqual(self.run_main()["ledger"]["status"], "verified")
        self.assert_census_fails(
            lambda m: m["census"]["stage_census"]["merged-preview"].update(
                reading="observed after the cut: 0 merged-preview fact(s) (P1 Ruling 8)"),
            "ledger census differs: stage_census")

    def test_post_cut_merged_preview_orphan_fact_beside_a_tear_is_counted_as_observed(self):
        # The reading's fact count includes orphan facts kept beside a tear (P1 call t, brief W4-A6), while the
        # paired stage census leaves them out; verify recomputes both from pinned bytes.
        self.assertEqual(etl.MERGED_PREVIEW_OBSERVED,
                         "observed after the cut: {facts} merged-preview fact(s) (P1 Ruling 8)")
        shadow, fact = pair(self.paths["merged"], "2026-10-01T12:00:00.000Z", stage="merged-preview", lane="merged:orphan")
        write_ledger(self.paths["a"], self.paths["rows_a"], ledger_bytes([shadow])[:40] + b"\n" + ledger_bytes([fact]))
        self.assertEqual(self.run_main()["ledger"]["status"], "pinned")
        manifest = self.manifest()
        entry = next(e for e in manifest["ledgers"] if e["checkout"] == "beep-effect")
        self.assertEqual((entry["rows"], entry["facts"], entry["torn_rows"], entry["unpaired_adjacent_to_tear"]),
                         (21, 11, 1, 1))
        self.assertEqual(manifest["census"]["stage_census"]["merged-preview"],
                         {"facts": {"pre": 1, "post": 0}, "shadows": {"pre": 1, "post": 0},
                          "reading": "observed after the cut: 1 merged-preview fact(s) (P1 Ruling 8)"})
        self.assertEqual(manifest["census"]["join_coverage"]["merged_preview_origin_facts"], 1)
        self.assertEqual(manifest["census"]["residue"]["origin_keys_replaced"], 12)  # 11 here + 1 in the bare ledger
        self.assertEqual(self.verify_cli().returncode, 0)
        self.assertEqual(self.run_main()["ledger"]["status"], "verified")
        dormant = "dormant in capture window (P1 Ruling 1)"
        self.assert_census_fails(lambda m: m["census"]["stage_census"]["merged-preview"].update(reading=dormant),
                                 "ledger census differs: stage_census")

    def test_home_marker_mid_token_lane_label_pins_and_component_leading_marker_fails(self):
        # P1 call (s), end to end: an originKey naming a lane whose branch-derived name carries the marker
        # mid-token pins and verifies; one whose lane component starts with the marker fails closed.
        marker = "-" + "home-"
        lanes = self.fleet / "beep-effect-worktrees"
        rows = json.loads(json.dumps(self.paths["rows_a"]))
        rows += pair(str(lanes / ("workspace" + marker + "paths")), "2026-09-26T10:00:00.000Z", lane="home:mid")
        write_ledger(self.paths["a"], rows)
        self.assertEqual(self.run_main()["ledger"]["status"], "pinned")
        payload = (self.output / "ledgers/beep-effect/proof-ledger.ndjson").read_bytes()
        self.assertIn(("<fleet>/beep-effect-worktrees/workspace" + marker + "paths").encode(), payload)
        self.assertEqual(self.run_main()["ledger"]["status"], "verified")
        self.assertEqual(self.verify_cli().returncode, 0)
        rows[-1]["fact"]["provenance"]["originKey"] = str(lanes / (marker + "user-x"))
        write_ledger(self.paths["a"], rows)
        dry = self.base / "dry-home"
        with self.assertRaisesRegex(SystemExit, "encoded home marker starting a path component") as exc:
            self.run_main("--dry-run-root", dry)
        self.assertNotIn("user-x", str(exc.exception))
        self.assertFalse((dry / "run4-ledger").exists())

    def test_merged_preview_followup_and_static_prose_are_bound_at_verify(self):
        self.run_main()
        target = self.output / etl.MANIFEST_NAME
        manifest = target.read_bytes()
        width = f"{etl.REUSE_KEY_HEX}-hex prefixes".encode()
        for old, new in ((width, width.replace(str(etl.REUSE_KEY_HEX).encode(), b"13")),
                         (b"later sibling pin", b"later sibling pun"),
                         (b"lock files and symlinks", b"lock files and symlinkz"),
                         (b"committer instant of 9d52d8f587", b"committer instant of 9d52d8f588")):
            with self.subTest(old=old):
                mutated = manifest.replace(old, new, 1)
                self.assertNotEqual(mutated, manifest)
                self.assertEqual(len(mutated), len(manifest))
                try:
                    target.write_bytes(mutated)
                    with self.assertRaisesRegex(SystemExit, "prose differs|cut differs"):
                        etl.verify_output_tree(self.output, "ledger")
                finally:
                    target.write_bytes(manifest)
        self.assert_census_fails(lambda m: m.update(merged_preview_followup="later"), "prose differs: merged_preview_followup")
        self.assert_census_fails(lambda m: m["capture_only_members"].pop(), "prose differs: capture_only_members")
        self.assert_census_fails(lambda m: m["census"]["hits"].update(flagged_legs="realized"), "ledger census differs: hits")
        self.assert_census_fails(lambda m: m["custody"].update(salt_policy="recorded"), "custody block differs")

    def test_exact_member_sets_and_discovery_consistency_are_bound_at_verify(self):
        self.run_main()
        self.assert_census_fails(lambda m: m["discovery"]["by_kind"].update(clone=m["discovery"]["by_kind"]["clone"] + 1),
                                 "kinds and layouts")
        self.assert_census_fails(lambda m: m["discovery"].update(lane_ledgers_present_not_read=99), "lane ledgers exceed")
        self.assert_census_fails(lambda m: m["discovery"]["excluded"].update(extra=0), "exclusions members differ")
        self.assert_census_fails(lambda m: m["census"].update(extra=1), "census members differ")
        self.assert_census_fails(lambda m: m["cut"].update(capture_check="verified by hand"), "cut differs")
        self.assert_census_fails(lambda m: m["gate"].update(rule="anything"), "gate census differs: rule")
        self.assert_census_fails(lambda m: m["source_facts"]["fact_ttl"].update(value="expires never"),
                                 "source fact differs from the generator's table: fact_ttl")

    def test_absent_receipts_carry_zero_counts_bound_at_verify(self):
        self.run_main()
        absent = lambda m: next(e for e in m["ledgers"] if e["ledger"] == "absent")  # noqa: E731
        self.assert_census_fails(lambda m: absent(m).update(rows=1), "absent ledger census differs: rows")
        self.assert_census_fails(lambda m: absent(m).update(first_recorded_at="2026-09-29T10:00:00.000Z"),
                                 "absent ledger census differs: first_recorded_at")
        self.assert_census_fails(lambda m: absent(m).update(path="ledgers/x/proof-ledger.ndjson"),
                                 "ledger receipt members differ")
        present = lambda m: next(e for e in m["ledgers"] if e["checkout"] == "beep-effect")  # noqa: E731
        self.assert_census_fails(lambda m: present(m).update(source_line_ranges=[[1, 19]]), "source line ranges differ")
        self.assert_census_fails(lambda m: present(m).update(unpaired_adjacent_to_tear=1),
                                 "pairing census differs: unpaired_adjacent_to_tear")
        self.assert_census_fails(lambda m: present(m).update(torn_line_ranges=[[21, 21]]), "source line ranges differ")

    def test_origin_probe_counters_are_counted_and_bounded(self):
        rows = json.loads(json.dumps(self.paths["rows_a"]))
        plain = self.fleet / "beep-effect-worktrees" / "plain"
        plain.mkdir()
        rows += pair(str(self.paths["lane_b"]), "2026-09-26T09:00:00.000Z", lane="probe:differs")
        rows += pair(str(plain), "2026-09-26T09:30:00.000Z", lane="probe:nogit")
        rows += pair(str(self.fleet / "beep-effect-worktrees" / "gone"), "2026-09-26T09:45:00.000Z", lane="probe:gone")
        write_ledger(self.paths["a"], rows)
        self.run_main()
        coverage = self.manifest()["census"]["join_coverage"]
        self.assertEqual((coverage["origin_owner_differs_at_capture"], coverage["origin_present_without_git_at_capture"],
                          coverage["origin_owner_unresolvable_at_capture"], coverage["origin_gone_at_capture"]), (1, 1, 0, 1))
        self.assert_census_fails(lambda m: m["census"]["join_coverage"].update(
            origin_owner_differs_at_capture=m["census"]["join_coverage"]["origin_present_at_capture"] + 1),
            "origin existence census differs")
        self.assert_census_fails(lambda m: m["census"]["join_coverage"].update(origin_owner_unresolvable_at_capture=-1),
                                 "non-negative integer")
        self.assert_census_fails(lambda m: m["census"]["join_coverage"].update(origin_unprobed=0),
                                 "origin existence census differs")

    def test_origin_naming_an_excluded_checkout_is_refused_without_echo(self):
        private = self.paths["private"]
        for origin in (private, private / ".claude" / "worktrees" / "z",
                       self.fleet / "beep-effect-private-worktrees" / "lane",
                       private / ".beep" / "yeet" / "merged-preview-42"):
            rows = json.loads(json.dumps(self.paths["rows_a"]))
            rows[1]["fact"]["provenance"]["originKey"] = str(origin)
            write_ledger(self.paths["a"], rows)
            with self.subTest(origin=origin.name):
                with self.assertRaisesRegex(SystemExit, "excluded by the public-origin filter") as exc:
                    self.run_main()
                self.assertNotIn("private", str(exc.exception))
                self.assertFalse(self.output.exists())

    def test_git_ignored_checkout_name_is_refused(self):
        clone = self.fleet / "beep-effect.key"
        git_dir(clone, PUBLIC)
        write_ledger(clone, pair(str(clone), "2026-09-26T08:00:00.000Z", lane="key:lint"))
        with self.assertRaisesRegex(SystemExit, "git-ignored"):
            self.run_main()
        self.assertFalse(self.output.exists())

    def test_verify_is_portable_across_hosts_and_logins(self):
        self.run_main()
        for login, host in (("root", "beep"), ("node", "ci"), ("build", "build")):
            with self.subTest(login=login), patch.object(etl, "login_name", return_value=login), \
                    patch.object(etl.socket, "gethostname", return_value=host), \
                    patch.object(etl.socket, "getfqdn", return_value=host), \
                    patch.object(Path, "home", return_value=Path("/" + login)):
                etl.verify_output_tree(self.output, "ledger")
        self.assertEqual(self.verify_cli().returncode, 0)

    def test_capture_identity_scan_catches_case_variants(self):
        host = "Fixture-Host7"
        cases = {"branch": "feat/" + host.lower() + "-x", "laneId": "quality:" + host.upper(),
                 "attemptId": "a-" + etl.sha256(host.lower().encode())[:12], "login": "feat/FIXTUREUSER"}
        for name, value in cases.items():
            rows = json.loads(json.dumps(self.paths["rows_a"]))
            shadow, fact = rows[-2], rows[-1]
            if name in ("branch", "login"):
                shadow["branch"] = value
            elif name == "laneId":
                shadow["laneId"] = fact["fact"]["key"]["laneId"] = value
            else:
                shadow["attemptId"] = fact["fact"]["provenance"]["attemptId"] = value
            write_ledger(self.paths["a"], rows)
            with self.subTest(name=name), patch.object(etl.socket, "gethostname", return_value=host), \
                    patch.object(etl.socket, "getfqdn", return_value=host), \
                    patch.object(etl, "login_name", return_value="fixtureuser"):
                with self.assertRaisesRegex(SystemExit, "hostname, hostname digest, login or home-owner name") as exc:
                    self.run_main()
                self.assertNotIn(value.lower(), str(exc.exception).lower())
                self.assertFalse(self.output.exists())

    def test_cut_commit_instant_is_verified_or_fails_closed(self):
        def commit(date):
            env = {**os.environ, "GIT_COMMITTER_DATE": date, "GIT_AUTHOR_DATE": date}
            subprocess.run([*GIT, "commit", "-q", "--allow-empty", "-m", "fixture: cut"], cwd=self.repo, check=True,
                           capture_output=True, env=env)
            return run_git(self.repo, "rev-parse", "HEAD")
        matching = commit("2026-09-28T10:09:38-05:00")
        other = commit("2026-09-28T10:09:39-05:00")
        with patch.object(etl, "CUT_COMMIT", matching[:10]):
            self.assertEqual(etl.cut_check(), "committer instant verified at capture")
            self.run_main()
        self.assertEqual(self.manifest()["cut"]["capture_check"], "committer instant verified at capture")
        with patch.object(etl, "CUT_COMMIT", other[:10]):
            with self.assertRaisesRegex(SystemExit, "cut commit instant differs"):
                etl.cut_check()

    def test_verify_refuses_a_non_holding_gate(self):
        self.run_main()
        manifest, raw, reader = self.census_inputs()
        manifest["gate"].update(post_cut_pre_push_facts=0, holds=False)
        with patch.object(etl, "CUT", dt.datetime(2099, 1, 1, tzinfo=dt.timezone.utc)):
            with self.assertRaisesRegex(SystemExit, "requires a holding gate"):
                etl.verify_census(manifest, raw, reader)

    def test_vocabulary_fact_failure_branches(self):
        self.run_main()
        manifest, _, reader = self.census_inputs()
        facts = json.loads(json.dumps(manifest["source_facts"]))
        etl.verify_vocabulary_facts(facts, reader)
        facts["vocabulary_outcome"]["value"] = ["passed", "failed", "flaky"]
        with self.assertRaisesRegex(SystemExit, "decode contract: vocabulary_outcome"):
            etl.verify_vocabulary_facts(facts, reader)
        with patch.object(etl, "PROOF_OUTCOMES", ("passed", "failed", "flaky")):
            with self.assertRaisesRegex(SystemExit, "no longer carries a decoded member or literal: vocabulary_outcome"):
                etl.verify_vocabulary_facts(facts, reader)

    def test_generator_lineage_is_bound_to_the_frozen_digest(self):
        self.run_main()
        target = self.output / etl.MANIFEST_NAME
        manifest = target.read_bytes()
        digest = etl.sha256(RUN3B.read_bytes()).encode()
        self.assertIn(digest, manifest)
        mutated = manifest.replace(digest, digest[:-1] + (b"0" if digest[-1:] != b"0" else b"1"), 1)
        try:
            target.write_bytes(mutated)
            with self.assertRaisesRegex(SystemExit, "generator lineage digest differs"):
                etl.verify_output_tree(self.output, "ledger")
        finally:
            target.write_bytes(manifest)

    def test_capture_refuses_a_claude_app_worktree_checkout_and_label_collisions(self):
        with patch.object(etl, "REPO_ROOT", self.base / "clone" / ".claude" / "worktrees" / "x"):
            with self.assertRaisesRegex(SystemExit, "refusing to capture from a .claude/worktrees checkout"):
                etl.capture()
        with patch.object(etl, "fleet_label", return_value="same"):
            with self.assertRaisesRegex(SystemExit, "owning-clone labels collide"):
                etl.capture()

    def test_symlinked_unreadable_and_nested_candidates(self):
        (self.fleet / "beep-effect9").symlink_to(self.paths["a"])
        nested = self.fleet / "beep-effect-worktrees" / "nested"
        git_dir(nested, PUBLIC)
        ncw = nested / ".claude" / "worktrees" / "ncw"
        linked(ncw, nested / ".git", "ncw")
        write_ledger(nested, pair(str(ncw), "2026-09-26T08:00:00.000Z", lane="nested:lint"))
        admitted, excluded, excluded_paths = etl.discover_checkouts()
        labels = {label: layout for label, _, _, layout in admitted}
        self.assertEqual(labels["beep-effect-worktrees/nested/.claude/worktrees/ncw"], "claude-worktrees")
        self.assertEqual(excluded["symlinked_candidate"], 1)
        self.assertIn(self.fleet / "beep-effect9", excluded_paths)
        self.run_main()
        payload = (self.output / "ledgers/beep-effect-worktrees%2Fnested/proof-ledger.ndjson").read_bytes()
        self.assertIn(b'"<fleet>/beep-effect-worktrees/nested/.claude/worktrees/ncw"', payload)
        lanes = self.fleet / "beep-effect-bare-worktrees"
        if os.geteuid() != 0:
            lanes.chmod(0)
            try:
                _, excluded, _ = etl.discover_checkouts()
            finally:
                lanes.chmod(0o755)
            self.assertEqual(excluded["unreadable_candidate_directory"], 1)

    def test_old_git_is_named_instead_of_a_missing_object(self):
        self.run_main()
        real_run = subprocess.run

        def old_git(argv, *args, **kwargs):
            if argv[:1] == ["git"] and "--no-lazy-fetch" in argv:
                return subprocess.CompletedProcess(argv, 129, b"", b"unknown option")
            return real_run(argv, *args, **kwargs)
        with patch.object(etl.subprocess, "run", side_effect=old_git):
            with self.assertRaisesRegex(SystemExit, "git 2.45 or newer"):
                etl.verify_output_tree(self.output, "ledger")

if __name__ == "__main__":
    unittest.main()
