"""Run-4 Stage C fleet corpus: privacy, census, discovery, Queue D and pin-contract regressions.

Run: UV_CACHE_DIR=$HOME/.cache/beep/uv-cache uv run --offline --with pyyaml python -B
     -m unittest discover -s <corpus-directory> -p test_run4_fleet_generator.py
Fixtures are built at runtime under BEEP_CIOPS_TEST_TMPDIR (default: $HOME/.cache/beep/ciops-run4-tests),
never under the system temp root or inside the repository. No test reads the live fleet, the live
admission roots, or a real pin root; fixture git repositories stand in for the corpus tree. The
RealTableTests class reads blobs from this clone's fetched origin/main tree (skipped when absent).
Credential-shaped fixture values are assembled at runtime so no literal one sits in this file.
"""
import collections
import contextlib
import dataclasses
import functools
import hashlib
import importlib.util
import io
import json
import math
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

import yaml

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("etl_run4_fleet_corpus", Path(__file__).with_name("etl_run4_fleet_corpus.py"))
etl = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = etl
spec.loader.exec_module(etl)

SYSTEM_TMP = Path(os.sep) / "tmp"


def fixture_root() -> Path:
    configured = os.environ.get("BEEP_CIOPS_TEST_TMPDIR")
    root = Path(configured) if configured else Path.home() / ".cache/beep/ciops-run4-tests"
    root = Path(os.path.realpath(root))
    if root == SYSTEM_TMP or SYSTEM_TMP in root.parents:
        raise SystemExit("refusing fixtures under the system temp root")
    if root == etl.REPO_ROOT or etl.REPO_ROOT in root.parents:
        raise SystemExit("refusing fixtures inside the repository")
    root.mkdir(parents=True, exist_ok=True)
    return root


FIXTURE_ROOT = fixture_root()
UID_LEAF = f"beep-admit-uid-{os.getuid()}"


def scratch(case: unittest.TestCase) -> Path:
    temp = tempfile.TemporaryDirectory(dir=FIXTURE_ROOT)
    case.addCleanup(temp.cleanup)
    return Path(temp.name)


def run_git(repo: Path, *args: str) -> str:
    env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
    env.update(GIT_CONFIG_GLOBAL=os.devnull, GIT_CONFIG_NOSYSTEM="1")
    return subprocess.run(["git", "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
                           "-c", "commit.gpgsign=false", "-c", "core.hooksPath=" + os.devnull,
                           "-c", "init.defaultBranch=main", *args],
                          cwd=repo, check=True, capture_output=True, text=True, env=env).stdout.strip()


def write_files(root: Path, files: dict[str, bytes | str]) -> None:
    for name, data in files.items():
        target = root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data.encode() if isinstance(data, str) else data)


def make_repo(repo: Path, files: dict[str, bytes | str]) -> None:
    repo.mkdir(parents=True)
    run_git(repo, "init", "-q")
    write_files(repo, files)
    commit_all(repo, "fixture: initial")


def commit_all(repo: Path, message: str) -> str:
    run_git(repo, "add", "-A")
    run_git(repo, "commit", "-qm", message)
    run_git(repo, "update-ref", "refs/remotes/origin/main", "HEAD")
    return run_git(repo, "rev-parse", "HEAD")


def tree_bytes(root: Path) -> dict[str, bytes]:
    return {p.relative_to(root).as_posix(): p.read_bytes() for p in root.rglob("*") if p.is_file()}


def event(tag, nonce, **fields):
    version = 1 if tag == "admission-admitted" else 3
    return {"schemaVersion": f"yeet-admission-journal/v{version}", "_tag": tag, "nonce": nonce,
            "pid": 4242, "procStart": "start-fixture", **fields}


def canonical_line(row) -> bytes:
    return (json.dumps(row, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n").encode()


ATTEMPT_A = "11111111-1111-4111-8111-111111111111"
ATTEMPT_B = "22222222-2222-4222-8222-222222222222"
ATTEMPT_C = "33333333-3333-4333-8333-333333333333"
ATTEMPT_D = "44444444-4444-4444-8444-444444444444"
# Built at runtime: a literal 12-hex value under a *Key name trips the secret scanner.
ORIGIN_KEY = "".join(("abcdef", "012345"))
# An older writer's 64-hex originKey; its first 11 hex characters differ from ORIGIN_KEY's.
LONG_ORIGIN_KEY = "".join(("0f1e2d3c4b5a", "69788796a5b4" * 4, "c3d2"))
# Host names that are ordinary words in pinned rows (branch main, label fixture, priority verify, lease ...).
WORD_HOSTNAMES = ("main", "Main", "MAIN", "FIXTURE", "verify", "lease", "full")
# Real quarantine files are <nonce>-<pid>.lease.json.<n>; the nonce is the file name's UUID part.
QUARANTINE_FILES = (("0a0a0a0a-aaaa-4aaa-8aaa-aaaaaaaaaaaa", 11, 1),
                    ("0b0b0b0b-bbbb-4bbb-8bbb-bbbbbbbbbbbb", 12, 2),
                    ("0c0c0c0c-cccc-4ccc-8ccc-cccccccccccc", 13, 3))
QUARANTINE_NAMES = tuple(f"{nonce}-{pid}.lease.json.{n}" for nonce, pid, n in QUARANTINE_FILES)
CHECK_SCRIPT = ("import os, sys\n"
                "sys.exit(1 if os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'FAIL')) else 0)\n")
JOIN_KEY_SOURCES = {
    etl.YEET + "Verdict.ts": "    id: S.String,\n    parentLaneId: S.optionalKey(S.String),\n    runId: S.String,\n    failedStepId: S.optionalKey(S.String),\n",
    etl.YEET + "AttemptJournal.ts": "    attemptId: UUID,\n    ownerPid: S.Finite,\n",
    etl.YEET + "ProofState.ts": "    pid: S.Finite,\n",
    etl.REPO_RUN + "AttemptTerminationJournal.ts": "    attemptId: UUIDSchema,\n",
    etl.REPO_RUN + "RepoRun.models.ts": "    taskId: S.String,\n    stepId: S.String,\n",
}
CITED_FIXTURE = ("export const anchor = 1;\nconst RETAINED_ADMISSIONS = 200;\n"
                 "const RETAINED_KNOWN_ROWS = RETAINED_ADMISSIONS * 3 * 4;\nconst RETAINED_ATTEMPTS = 50;\n")
# Fixture stand-ins for the citation tables. The verify subprocess installs the same source, so ordinary
# verify rebuilds exactly these tables against the fixture corpus_tree.
TABLE_STUBS = '''
def source_facts(cite):
    return {"admitted_retention": etl.fact(cite, 200, "fixture/cited.ts", "const RETAINED_ADMISSIONS = 200;"),
            "known_history_retention": etl.fact(cite, 2400, "fixture/cited.ts", "const RETAINED_KNOWN_ROWS ="),
            "terminal_attempt_retention": etl.fact(cite, 50, "fixture/cited.ts", "const RETAINED_ATTEMPTS = 50;"),
            "fixture": etl.fact(cite, 1, "fixture/cited.ts", "export const anchor")}
def known_losses(cite):
    return []
def join_keys(cite):
    return {}
def ruling_citations(cite):
    return {}
def admission_kind_note(cite):
    return {"text": "fixture kind note", "attempt_stage": cite("fixture/cited.ts", "export const anchor")}
'''
TABLE_NAMES = ("source_facts", "known_losses", "join_keys", "ruling_citations", "admission_kind_note")


def table_stubs(module) -> dict:
    namespace = {"etl": module}
    exec(TABLE_STUBS, namespace)
    return {name: namespace[name] for name in TABLE_NAMES}


def install_table_stubs(stack: contextlib.ExitStack) -> None:
    for name, stub in table_stubs(etl).items():
        stack.enter_context(patch.object(etl, name, stub))


def snapshot_fixture_rows():
    """Projection-shaped rows: surrogates instead of pid/procStart/checkoutRoot, canonical member order."""
    common = {"kind": "full-proof", "priority": "verify", "originKey": ORIGIN_KEY, "branch": "main",
              "weightTokens": 1, "ownerRef": "0123456789ab", "ownerRefVariant": "pid_pair", "checkoutRef": "ba9876543210"}
    return [
        {"schemaVersion": "yeet-admission-journal/v3", "_tag": "admission-enqueued", "nonce": "n-win",
         "attemptId": ATTEMPT_A, "enqueuedAtMillis": 1000, **common},
        {"schemaVersion": "yeet-admission-journal/v3", "_tag": "admission-enqueued", "nonce": "n-snap",
         "attemptId": ATTEMPT_B, "enqueuedAtMillis": 500, **common},
        {"schemaVersion": "yeet-admission-journal/v3", "_tag": "admission-withdrawn", "nonce": "n-snap",
         "attemptId": ATTEMPT_B, "enqueuedAtMillis": 500, "withdrawnAtMillis": 600, **common},
    ]


def snapshot_bytes(rows) -> bytes:
    return b"".join(canonical_line(row) for row in rows)


def snapshot_files(rows) -> dict[str, bytes | str]:
    data = snapshot_bytes(rows)
    projection, sums = etl.snapshot_paths()
    return {projection: data, sums: f"{'0' * 64}  canonical/journal.ndjson\n{hashlib.sha256(data).hexdigest()}  {etl.SNAPSHOT_PROJECTION}\n",
            etl.SNAPSHOT_CHECK: CHECK_SCRIPT}


def string_leaves(value):
    """Every string leaf of a yaml-loaded document (keys excluded), in traversal order."""
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for child in value.values():
            yield from string_leaves(child)
    elif isinstance(value, list):
        for child in value:
            yield from string_leaves(child)


RULING_3_TAIL = re.compile(r"^(?P<as_amended> as amended\))|^(?P<amendment> amendment \(11-hex ledger key width\))")


def ruling_3_branches(document) -> collections.Counter:
    """Census the Ruling 3 mentions over yaml-loaded string leaves; a mention outside both branches fails."""
    branches = collections.Counter()
    for leaf in string_leaves(document):
        for match in re.finditer(r"Ruling 3\b", leaf):
            tail = RULING_3_TAIL.match(leaf[match.end():])
            if tail is None:
                raise AssertionError("a Ruling 3 mention credits neither the amendment nor the amended width")
            branches[tail.lastgroup] += 1
    return branches


def bare_ruling_7_mentions(document) -> int:
    """Ruling 7 mentions not qualified as run-3 Ruling 7, P1 Ruling 7, or the build sitting's 64-hex originKey ruling."""
    return sum(1 for leaf in string_leaves(document) for match in re.finditer(r"Ruling 7\b", leaf)
               if not re.search(r"(?:run-3|P1) $", leaf[:match.start()])
               and not leaf[match.end():].startswith(" (64-hex originKey"))


def manifest_dump(document) -> str:
    """The manifest writer's own YAML settings (width 100 folds long prose scalars)."""
    return yaml.safe_dump(document, sort_keys=False, allow_unicode=True, width=100)


def login_patch(name: str):
    return patch.object(etl.pwd, "getpwuid", return_value=type("P", (), {"pw_name": name})())


class FixtureWorld(unittest.TestCase):
    """A fixture corpus repository, fleet, operator home and admission roots; every live read is redirected."""

    def setUp(self):
        self.base = scratch(self)
        self.repo = self.base / "repo"
        self.fleet = self.base / "fleet"
        self.home = self.base / "home"
        self.snapshot = snapshot_fixture_rows()
        make_repo(self.repo, {**snapshot_files(self.snapshot), **JOIN_KEY_SOURCES,
                              etl.CORPUS_PATH + etl.LINEAGE_GENERATOR: "# frozen run3b generator fixture\n",
                              "fixture/cited.ts": CITED_FIXTURE})
        self.admission = self.home / ".beep/runtime" / UID_LEAF
        self.absent_root = self.base / "system-tmp" / UID_LEAF
        self.clone = self.fleet / "beep-effect-fixture"
        self.lane = self.clone / ".claude/worktrees/name"
        self.build_admission()
        self.build_checkouts()
        self.outputs = {"fleet": self.base / "pins" / "run4-fleet"}
        (self.base / "pins").mkdir()
        self.patches = contextlib.ExitStack()
        self.addCleanup(self.patches.close)
        self.install_world(self.fleet, [("canonical", self.admission), ("system-tmp", self.absent_root)], [
            ("beep-effect-fixture", self.clone, "clone", "fleet-root"),
            ("beep-effect-fixture/.claude/worktrees/name", self.lane, "linked-worktree", "claude-worktrees")])

    def install_world(self, fleet, admission, discovered=None):
        for name, value in (("REPO_ROOT", self.repo), ("FLEET_ROOT", fleet), ("OUTPUT_ROOTS", self.outputs),
                            ("SNAPSHOT_SHA256", hashlib.sha256(snapshot_bytes(self.snapshot)).hexdigest()),
                            ("SNAPSHOT_ROWS", len(self.snapshot))):
            self.patches.enter_context(patch.object(etl, name, value))
        self.patches.enter_context(patch.object(Path, "home", return_value=self.home))
        self.patches.enter_context(patch.object(etl, "admission_sources", return_value=admission))
        if discovered is not None:
            self.patches.enter_context(patch.object(etl, "discover_checkouts", return_value=discovered))
        install_table_stubs(self.patches)

    def build_admission(self):
        root = str(self.clone)
        rows = [event("admission-released", "n-old", pid=4242421, checkoutRoot=root, branch="main", releasedAtMillis=900),
                event("admission-enqueued", "n-win", pid=4242421, kind="full-proof", priority="verify", originKey=ORIGIN_KEY,
                      checkoutRoot=root, branch="main", enqueuedAtMillis=1000, weightTokens=1, attemptId=ATTEMPT_A),
                event("admission-admitted", "n-win", pid=4242421, kind="full-proof", weightTokens=1, priority="verify",
                      originKey=ORIGIN_KEY, enqueuedAtMillis=1000, admittedAtMillis=2000, attemptId=ATTEMPT_A),
                event("admission-enqueued", "n-wd", pid=4242421, kind="review-fix", priority="publish", originKey="",
                      checkoutRoot=root, branch="", enqueuedAtMillis=2100, weightTokens=1),
                event("admission-withdrawn", "n-wd", pid=4242421, kind="review-fix", priority="publish", originKey="",
                      checkoutRoot=root, branch="", enqueuedAtMillis=2100, withdrawnAtMillis=2200),
                event("admission-lease-evicted", "n-lease", pid=4242421, lastHeartbeatAtMillis=2400, evictedAtMillis=2500,
                      checkoutRoot=root, branch="main", reason="owner-dead-or-reused"),
                event("admission-released", "n-win", pid=4242421, checkoutRoot=root, branch="main", releasedAtMillis=3000,
                      attemptId=ATTEMPT_A)]
        for row in rows:
            if row["_tag"] in {"admission-released", "admission-lease-evicted"}:
                del row["procStart"]
        lease = {"schemaVersion": "yeet-admission-lease/v1", "nonce": "n-live", "pid": 4242421, "procStart": "start-fixture",
                 "checkoutRoot": root, "branch": "main", "command": f"bun run beep yeet verify --cwd {root}",
                 "hotPaths": [f"{root}/packages/a"], "diffFingerprint": "f" * 12, "envProfile": "local",
                 "proofTier": "full", "resolvedHeadSha": "e" * 40, "stage": "pre-push",
                 "startedAt": "2026-10-05T12:00:00.000Z", "coordinationProtocol": "v3",
                 "blockedOnOriginAtMillis": 2600, "heartbeatAtMillis": 2700}
        self.lease = lease
        ticket = {"schemaVersion": "yeet-admission-ticket/v1", "nonce": "n-promo", "pid": 5151512, "procStart": "ticket-start",
                  "checkoutRoot": root, "branch": "main", "enqueuedAtMillis": 2800}
        promotion = {"schemaVersion": "yeet-admission-promotion/v1", "nonce": "n-promo",
                     "ticketPath": str(self.admission / "queue/n-promo-5151512.ticket.json"),
                     "leasePath": str(self.admission / "leases/n-promo-6161613.lease.json"),
                     "ticket": ticket, "lease": {**lease, "nonce": "n-promo", "pid": 6161613, "procStart": "lease-start"},
                     "phase": "lease-written", "createdAtMillis": 2900}
        write_files(self.admission, {
            "journal.ndjson": etl.encode_ndjson(rows),
            "protocol.json": etl.encode_json({"schemaVersion": etl.PROTOCOL_SCHEMA, "eviction": "on"}),
            "leases/n-live-4242421.lease.json": etl.encode_json(lease),
            "queue/ignored.lock": "must never be read",
            "promotions/n-promo.promotion.json": etl.encode_json(promotion),
            **{f"quarantine/{name}": etl.encode_json({**lease, "nonce": nonce, "pid": 7000071 + index})
               for index, (name, (nonce, _, _)) in enumerate(zip(QUARANTINE_NAMES, QUARANTINE_FILES))},
            "quarantine/journal.lock": "must never be read"})
        (self.admission / "claims").mkdir()
        (self.admission / "quarantine/linked.lease.json.9").symlink_to(self.admission / "quarantine" / QUARANTINE_NAMES[0])

    def build_checkouts(self):
        started = {"schemaVersion": etl.ATTEMPT_SCHEMA, "_tag": "attempt-started", "attemptId": ATTEMPT_A,
                   "runId": "main-0123456789ab", "branch": "main", "ownerPid": 4242421, "ownerProcStart": "start-fixture",
                   "startedAt": "2026-10-05T12:00:00.000Z", "stage": "pre-push"}
        # Before the #1321 cut: one merged-preview start and one start written before the stage field shipped.
        merged = {**started, "attemptId": ATTEMPT_C, "branch": "fix/runner-root-node", "stage": "merged-preview",
                  "startedAt": "2026-09-09T03:41:38.790Z"}
        legacy = {key: value for key, value in started.items() if key != "stage"}
        legacy.update(attemptId=ATTEMPT_D, startedAt="2026-09-01T00:00:00.000Z")
        finished = {"schemaVersion": etl.ATTEMPT_SCHEMA, "_tag": "attempt-finished", "attemptId": ATTEMPT_A,
                    "recordedAt": "2026-10-05T12:05:00.000Z", "verdict": {"runId": "main-0123456789ab", "failedStepId": "full:check"}}
        write_files(self.clone, {".git/config": '[remote "origin"]\n\turl = git@github.com:beep-effect/beep-effect.git\n',
                                 ".beep/yeet/runs/main-0123456789ab/attempts.ndjson": etl.encode_ndjson([legacy, merged, started, finished]),
                                 ".beep/yeet/proof-ledger.ndjson": "must never be read\n"})
        write_files(self.lane, {".git": f"gitdir: {self.clone}/.git/worktrees/name\n",
                                ".beep/yeet/runs/feat-x-0123456789ab/attempts.ndjson": etl.encode_ndjson([{**started, "attemptId": ATTEMPT_B}])})

    def run_main(self, *args):
        output = io.StringIO()
        with patch.object(sys, "argv", [str(etl.SCRIPT), *map(str, args)]), contextlib.redirect_stdout(output):
            etl.main()
        return json.loads(output.getvalue())

    def manifest(self, root=None):
        return yaml.safe_load(((root or self.outputs["fleet"]) / etl.MANIFEST_NAME).read_bytes())

    def verify_cli(self, root=None):
        runner = ("import importlib.util,sys; from pathlib import Path; sys.dont_write_bytecode=True; "
                  "s=importlib.util.spec_from_file_location('etl_run4_fleet_corpus', sys.argv[1]); "
                  "m=importlib.util.module_from_spec(s); sys.modules[s.name]=m; s.loader.exec_module(m); "
                  "m.REPO_ROOT=Path(sys.argv[3]); m.FLEET_ROOT=Path(sys.argv[4]); "
                  "m.SNAPSHOT_SHA256=sys.argv[5]; m.SNAPSHOT_ROWS=int(sys.argv[6]); "
                  "n={'etl': m}; exec(sys.argv[7], n); [setattr(m, k, n[k]) for k in sys.argv[8].split(',')]; "
                  "m.verify_output_tree(Path(sys.argv[2]), 'fleet')")
        return subprocess.run([sys.executable, "-B", "-c", runner, str(etl.SCRIPT), str(root or self.outputs["fleet"]),
                               str(self.repo), str(etl.FLEET_ROOT), etl.SNAPSHOT_SHA256, str(etl.SNAPSHOT_ROWS),
                               TABLE_STUBS, ",".join(TABLE_NAMES)],
                              capture_output=True, text=True, timeout=120)

    def all_emitted(self, root=None):
        return b"".join(tree_bytes(root or self.outputs["fleet"]).values())

    def assert_mutations_fail_cli(self, mutations, root=None):
        target = (root or self.outputs["fleet"]) / etl.MANIFEST_NAME
        manifest = target.read_bytes()
        for old, new in mutations:
            with self.subTest(old=old):
                self.assertIn(old, manifest)
                mutated = manifest.replace(old, new, 1)
                self.assertEqual(len(manifest), len(mutated))
                try:
                    target.write_bytes(mutated)
                    self.assertNotEqual(self.verify_cli(root).returncode, 0)
                finally:
                    target.write_bytes(manifest)
        self.assertEqual(self.verify_cli(root).returncode, 0)


class RedactionTests(unittest.TestCase):
    def test_identifier_tokens_preserve_ordinary_words_and_cover_process_names(self):
        safe = {key: 1234 for key in ("rapid", "cupid", "lipid", "RAPID", "Cupid", "stepId", "failedStepId", "STEPID", "parentLaneId")}
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
        values = ('a"secret', 'secret\\', 'secret\\\\', json.dumps({"detail": 'nested"secret', "tail": "secret\\"}), '')
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

    def test_fleet_root_layouts_and_claude_worktree_refusal(self):
        root = Path("/workspace/projects")
        self.assertEqual(etl.fleet_root(root / "beep-effect8"), root)
        self.assertEqual(etl.fleet_root(root / "beep-effect8-worktrees/stage-c"), root)
        etl.refuse_claude_worktree(root / "beep-effect8")
        etl.refuse_claude_worktree(root / "beep-effect8-worktrees/stage-c")
        with self.assertRaisesRegex(SystemExit, "claude/worktrees"):
            etl.refuse_claude_worktree(root / "beep-effect8/.claude/worktrees/name")

    def test_claude_worktree_refuses_capture_but_not_ordinary_verify(self):
        checkout = Path("/workspace/projects/beep-effect8/.claude/worktrees/name")
        with tempfile.TemporaryDirectory(dir=FIXTURE_ROOT) as name:
            pinned = {"fleet": Path(name) / "run4-fleet"}
            with patch.object(etl, "REPO_ROOT", checkout), patch.object(etl, "OUTPUT_ROOTS", pinned), \
                    patch.object(sys, "argv", [str(etl.SCRIPT)]), \
                    patch.object(etl, "capture", side_effect=AssertionError("capture")):
                with self.assertRaisesRegex(SystemExit, "claude/worktrees"):
                    etl.main()
                pinned["fleet"].mkdir()
                summary = {"payload_files": 0, "advisories": {}}
                with patch.object(etl, "verify_output_tree", return_value=summary) as verify, \
                        contextlib.redirect_stdout(io.StringIO()):
                    etl.main()
                verify.assert_called_once()

    def test_process_variants_mint_local_custody_before_removal(self):
        salt = b"a" * 32
        payload = {"schemaVersion": "yeet-admission-lease/v1", "pid": 4242, "procStart": "lease-start",
                   "ownerPid": 9, "ownerProcStart": "lower-precedence", "runScope": {"attachedPid": 1234},
                   "attempt": {"ownerPid": 4242, "ownerProcStart": "lease-start", "attachedPid": 9}}
        rows, receipt = etl.transform_source(etl.encode_json(payload), "live", salt, False)
        actual = rows[0]
        self.assertEqual(actual["ownerRef"], actual["attempt"]["ownerRef"])
        self.assertEqual(actual["runScope"]["ownerRef"], etl.sha256(f"1234:<absent>:{salt.hex()}".encode())[:12])
        self.assertEqual(receipt["owner_refs_by_variant"], {"pid_pair": 1, "ownerpid": 1, "attachedpid": 1, "weak": 0})
        self.assertEqual(receipt["redaction_counts"]["owner_refs_without_start"], 1)
        etl.scan_output_bytes([("lease.json", etl.encode_json(actual)),
                               ("lease.properties", etl.encode_properties_projection(rows))])

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

    def test_lease_and_ticket_fields_added_since_run3b_pass_redaction(self):
        root = str(etl.FLEET_ROOT / "beep-effect-fixture")
        lease = {"schemaVersion": "yeet-admission-lease/v1", "nonce": "n", "pid": 4242, "procStart": "s",
                 "command": f"bun run beep yeet verify --cwd {root}", "hotPaths": [f"{root}/packages/a", f"{root}/x"],
                 "diffFingerprint": "f" * 12, "envProfile": "local", "proofTier": "full", "resolvedHeadSha": "e" * 40,
                 "stage": "pre-push", "startedAt": "2026-10-05T12:00:00.000+02:00", "coordinationProtocol": "v3",
                 "blockedOnOriginAtMillis": 2600}
        rows, receipt = etl.transform_source(etl.encode_json(lease), "live", b"a" * 32, False)
        self.assertEqual(rows[0]["hotPaths"], ["<fleet>/beep-effect-fixture/packages/a", "<fleet>/beep-effect-fixture/x"])
        self.assertEqual(rows[0]["command"], "bun run beep yeet verify --cwd <fleet>/beep-effect-fixture")
        self.assertEqual(rows[0]["startedAt"], lease["startedAt"])
        pair = etl.payload_pair("live/x/leases/state-0000.json", rows, "live", "<x>", "2026-01-01T00:00:00.000Z", provenance="organic")
        self.assertEqual(pair[0].receipt["max_timestamp_observed"], "2026-10-05T10:00:00.000Z")
        etl.scan_output_bytes([(entry.path, entry.data) for entry in pair])
        naive = {**lease, "startedAt": "2026-10-05T12:00:00"}
        rows, _ = etl.transform_source(etl.encode_json(naive), "live", b"a" * 32, False)
        with self.assertRaisesRegex(SystemExit, "lacks an explicit timezone"):
            etl.payload_pair("live/x/leases/state-0000.json", rows, "live", "<x>", "2026-01-01T00:00:00.000Z", provenance="organic")

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
        benign = {"description": "rapid cupid lipid attachedPid ownerProcStart ownerPid word",
                  "words": ["pid", "ownerPid", "ownerProcStart"], "rapidly": "safe"}
        self.assertEqual(etl.redact(benign, b"a" * 32, collections.Counter()), benign)
        etl.scan_output_bytes([("safe.json", etl.encode_json(benign)),
                               ("safe.properties", etl.encode_properties_projection([benign]))])

    def test_host_paths_require_left_boundaries_in_rewrite_and_scan(self):
        with patch.object(etl, "FLEET_ROOT", Path("/workspace")):
            for root, token in (("/workspace", "<fleet>"), ("/home", "<home>"), ("/tmp", "<tmp>"),
                                ("/proc", "<proc>"), ("/dev/shm", "<shm>")):
                for prefix in ("packages", "packages/", "word_", "word.", "-", "A", "0", "/"):
                    relative = prefix + root + "/use-cases/x.test.ts"
                    self.assertEqual(etl.redact_string(relative), relative)
                    etl.scan_output_bytes([(relative, relative.encode())])
                # Run-4 deviation: a tilde-slash prefix is a home-relative path and is refused.
                tilde = "~" + root + "/use-cases/x.test.ts"
                self.assertEqual(etl.redact_string(tilde), tilde)
                with self.assertRaisesRegex(SystemExit, "home-relative"):
                    etl.scan_output_bytes([("fixture", tilde.encode())])
                for prefix in ("", " ", '"', "=", "(", ":", "//", ":/", "file://", "file:/"):
                    for suffix in ("", "/beep-effect/x"):
                        absolute = prefix + root + suffix
                        expected = prefix + ("/" if prefix == "file://" else "") + token + suffix
                        self.assertEqual(etl.redact_string(absolute), expected)
                        with self.assertRaisesRegex(SystemExit, "host path"):
                            etl.scan_output_bytes([("fixture", absolute.encode())])
                self.assertEqual(etl.redact_string(root + "-other/x"), root + "-other/x")
                etl.scan_output_bytes([("fixture", (root + "-other/x").encode())])
                # Run-4 deviation: the scan-side right boundary stops at a backslash (escaped forms).
                for escaped in (root.replace("/", "\\/") + "\\/x", root + "\\n"):
                    with self.assertRaisesRegex(SystemExit, "host path"):
                        etl.scan_output_bytes([("fixture.json", escaped.encode())])
            for relative in ("packages/run/user/123/state", "packages/proc/123/status"):
                self.assertEqual(etl.redact_string(relative), relative)
                etl.scan_output_bytes([("fixture", relative.encode())])

    def test_uri_authorities_bound_host_roots_in_rewrite_and_scan(self):
        with patch.object(Path, "home", return_value=Path("/home/alice")), patch.object(etl, "FLEET_ROOT", Path("/workspace")):
            for scheme in ("file", "sftp", "git+ssh", "x.y-z0", "FILE"):
                for authority in ("", "localhost", "host:2222", "[::1]:2222"):
                    for path, expected, refused in (
                            ("/home/alice/.x", "<home>/.x", None), ("/home/x", "<home>/x", "home subtree"),
                            ("/tmp/x", "<tmp>/x", None), ("/proc/123/s", "<proc>/<process>/s", None),
                            ("/run/user/123/state", "<runtime>/state", None), ("/dev/shm/x", "<shm>/x", None),
                            ("/workspace/beep-effect-project/x", "<fleet>/beep-effect-project/x", None),
                            ("/workspace/other-project/x", "<fleet>/other-project/x", "fleet path outside")):
                        raw = f"{scheme}://{authority}{path}"
                        redacted = f"{scheme}://{authority}/{expected}"
                        with self.subTest(raw=raw):
                            self.assertEqual(etl.redact_string(raw), redacted)
                            self.assertEqual(etl.redact_string(redacted), redacted)
                            for label, data in (("fixture", raw.encode()), (raw, b""), ("fixture.json", etl.encode_json({"uri": raw}))):
                                with self.assertRaisesRegex(SystemExit, "host path"):
                                    etl.scan_output_bytes([(label, data)])
                            if refused is None:
                                etl.scan_output_bytes([(redacted, redacted.encode())])
                            else:
                                with self.assertRaisesRegex(SystemExit, refused):
                                    etl.scan_output_bytes([("fixture", redacted.encode())])

    def test_uri_authorities_preserve_non_root_paths_and_stop_at_delimiters(self):
        for value in ("packages/home/x", "https://example.com/homepage/x", "file://host/packages/home/x",
                      "file://host/tmp-other/x", "file://host\npackages/home/x", "file://host packages/home/x",
                      "file://host'packages/home/x", 'file://host"packages/home/x'):
            with self.subTest(value=value):
                self.assertEqual(etl.redact_string(value), value)
                etl.scan_output_bytes([("fixture", value.encode())])
        raw = 'file://localhost/tmp/x "sftp://host/proc/123/s"'
        expected = 'file://localhost/<tmp>/x "sftp://host/<proc>/<process>/s"'
        self.assertEqual(etl.redact_string(raw), expected)
        etl.scan_output_bytes([("fixture", expected.encode())])

    def test_file_uri_host_roots_preserve_scheme_and_reject_raw_residue(self):
        with patch.object(Path, "home", return_value=Path("/home/alice")), patch.object(etl, "FLEET_ROOT", Path("/workspace")):
            for raw, expected in (("file:///home/alice/.x", "file:///<home>/.x"), ("file:///proc/123/status", "file:///<proc>/<process>/status"),
                                  ("file:///workspace/beep-effect9/x", "file:///<fleet>/beep-effect9/x"), ("file:///tmp/x", "file:///<tmp>/x"),
                                  ("file:///dev/shm/x", "file:///<shm>/x"), ("file:///run/user/123/state", "file:///<runtime>/state")):
                with self.subTest(raw=raw):
                    self.assertEqual(etl.redact_string(raw), expected)
                    self.assertEqual(etl.redact_string(expected), expected)
                    for label, data in (("fixture", raw.encode()), (raw, b"")):
                        with self.assertRaisesRegex(SystemExit, "host path"):
                            etl.scan_output_bytes([(label, data)])
                    etl.scan_output_bytes([(expected, expected.encode())])
            aliases = {"/workspace/fixture": "<synthetic-checkout:contender-a>"}
            self.assertEqual(etl.redact_string("file:///workspace/fixture/x", aliases), "file:///<synthetic-checkout:contender-a>/x")

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
        self.assertIn("owner-<process>.lease.json", actual["sourcePath"])
        refreshed, _ = etl.transform_source(etl.encode_json(payload), "live", b"b" * 32, False)
        self.assertNotEqual(actual["lease"]["ownerRef"], refreshed[0]["lease"]["ownerRef"])
        encoded = etl.encode_json(actual)
        self.assertNotIn(b"4242", encoded)
        self.assertNotIn((b"a" * 32).hex().encode(), encoded)
        etl.scan_output_bytes([("fixture", encoded)])

    def test_promotion_nests_ticket_and_lease_custody(self):
        promotion = {"schemaVersion": "yeet-admission-promotion/v1", "nonce": "p", "ticketPath": "queue/p-5151.ticket.json",
                     "leasePath": "leases/p-6161.lease.json", "phase": "lease-written", "createdAtMillis": 1,
                     "ticket": {"schemaVersion": "yeet-admission-ticket/v1", "nonce": "p", "pid": 5151, "procStart": "t"},
                     "lease": {"schemaVersion": "yeet-admission-lease/v1", "nonce": "p", "pid": 6161, "procStart": "l"}}
        rows, receipt = etl.transform_source(etl.encode_json(promotion), "live", b"a" * 32, False)
        actual = rows[0]
        self.assertNotIn("ownerRef", actual)
        self.assertNotEqual(actual["ticket"]["ownerRef"], actual["lease"]["ownerRef"])
        self.assertEqual(receipt["owner_refs_by_variant"]["pid_pair"], 2)
        self.assertEqual((actual["ticketPath"], actual["leasePath"]), ("queue/p-<process>.ticket.json", "leases/p-<process>.lease.json"))
        encoded = etl.encode_json(actual)
        for token in (b"5151", b"6161", b'"pid"', b"procStart"):
            self.assertNotIn(token, encoded)
        etl.scan_output_bytes([("promotion.json", encoded), ("promotion.properties", etl.encode_properties_projection(rows))])

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
        self.assertIn("yeet-admission-promotion/v1", etl.LIVE_SCHEMAS)

    def test_string_rewrites_and_synthetic_mapping(self):
        roots = {str(Path(tempfile.gettempdir()) / "fixture" / label): f"<synthetic-checkout:{label}>" for label in etl.SYNTHETIC_SOURCE_LABELS}
        records = [{"checkoutRoot": root, "command": root + "/run", "hotPaths": [root + "/hot"]} for root in roots]
        self.assertEqual(etl.synthetic_checkout_aliases(records), roots)
        result = etl.redact(records, b"a" * 32, collections.Counter(), aliases=roots)
        for row, token in zip(result, roots.values()):
            self.assertEqual(row["checkoutRoot"], token)
            self.assertEqual(row["command"], token + "/run")
        with self.assertRaisesRegex(SystemExit, "synthetic checkout label"):
            etl.assert_organic({"x": result})
        with self.assertRaisesRegex(SystemExit, "synthetic provenance"):
            etl.assert_organic({"x": [{"provenance": "synthetic"}]})
        etl.assert_organic({"x": [{"provenance": "organic", "checkoutRoot": "<fleet>/beep-effect9"}]})
        with self.assertRaises(SystemExit):
            etl.synthetic_checkout_aliases([{"checkoutRoot": str(Path(tempfile.gettempdir()) / "unknown")}])
        labels = ["fixture/.claude/worktrees/name", "fixture/.beep/name", "fixture%2Fname", "fixture/name"]
        encoded = [etl.checkout_component(label) for label in labels]
        self.assertEqual(len(set(encoded)), len(labels))
        self.assertTrue(all("/" not in label for label in encoded))

    def test_writer_staging_suffixes_lose_pid_and_start_identity(self):
        uuid = "123e4567-e89b-42d3-a456-426614174000"
        pid, start = "4242421", "6c696e7578206c"
        for raw in (f"queue/n-{pid}.ticket.json.tmp-{pid}-{start}-{uuid}", f"leases/n.lease.json.tmp-{pid}-{uuid}",
                    f"claims/c.reap.json.tombstone-{pid}-{uuid}", f"journal.lock.stage-{pid}-{uuid}",
                    f"runs/x/attempts.ndjson.staging-{pid}-{uuid}"):
            with self.subTest(raw=raw):
                with self.assertRaisesRegex(SystemExit, "staging"):
                    etl.scan_output_bytes([("fixture", raw.encode())])
                redacted = etl.redact_string(raw)
                self.assertNotIn(pid, redacted)
                self.assertNotIn(start, redacted)
                self.assertIn(uuid, redacted)
                self.assertIn("-<process>-", redacted)
                self.assertEqual(etl.redact_string(redacted), redacted)
                message = {"message": f"rename failed: {raw} exists"}
                rows = [etl.redact(message, b"a" * 32, collections.Counter())]
                etl.scan_output_bytes([("fixture.json", etl.encode_json(rows[0])),
                                       ("fixture.properties", etl.encode_properties_projection(rows))])
        # A suffix the redaction does not recognize still fails the scan closed.
        with self.assertRaisesRegex(SystemExit, "staging"):
            etl.scan_output_bytes([("fixture", etl.redact_string("x.json.tmp-4242421-not-a-uuid").encode())])

    def test_hostname_any_case_and_full_digest_are_redacted_and_refused(self):
        host = socket.gethostname()
        digest = etl.sha256(host.encode())
        lowered = etl.sha256(host.lower().encode())
        for value in (host.upper(), host.capitalize(), host.lower(), digest, lowered, digest[:12], lowered[:12]):
            with self.subTest(size=len(value)):
                data = f"on {value} now".encode()
                # Capture-host class: refused by the capture-only scan, never by the host-independent one.
                with self.assertRaisesRegex(SystemExit, "hostname") as exc:
                    etl.scan_capture_only([("fixture", data)])
                self.assertNotIn(value, str(exc.exception))
                etl.scan_output_bytes([("fixture", data)])
                redacted = etl.redact_string(f"on {value} now")
                self.assertEqual(redacted, "on <host> now")
                self.assertEqual(etl.redact_string(redacted), redacted)
                with etl.host_independent_redaction():
                    self.assertEqual(etl.redact_string(f"on {value} now"), f"on {value} now")
                self.assertEqual(etl.redact_string(f"on {value} now"), "on <host> now")

    def test_word_hostnames_are_redacted_at_capture_and_ignored_by_verify_replay(self):
        for name in WORD_HOSTNAMES:
            with self.subTest(name=name), patch.object(etl.socket, "gethostname", return_value=name):
                row = {"branch": "main", "label": "beep-effect-fixture", "priority": "verify", "kind": "full-proof",
                       "family": "leases"}
                captured = etl.redact(row, b"a" * 32, collections.Counter())
                self.assertNotEqual(captured, row)
                with self.assertRaisesRegex(SystemExit, "hostname"):
                    etl.scan_capture_only([("fixture.json", etl.encode_json(row))])
                etl.scan_output_bytes([("fixture.json", etl.encode_json(row))])
                with etl.host_independent_redaction():
                    self.assertEqual(etl.redact(row, None, collections.Counter(), True), row)
                    with etl.host_independent_redaction():
                        self.assertEqual(etl.hostname_patterns(), ())
                    self.assertEqual(etl.hostname_patterns(), ())
                self.assertTrue(etl.hostname_patterns())


class ResidueTests(unittest.TestCase):
    def test_run3b_residue_classes_are_rejected_without_echoing(self):
        host = socket.gethostname().encode()
        bad = [str(etl.FLEET_ROOT / "private").encode(), str(Path.home() / "private").encode(),
               str(Path(tempfile.gettempdir()) / "private").encode(), b"/home/another/private", b"/tmp/private",
               b"/run/user/9876/state", b"/proc/123/status", b"/dev/shm/state", b"~/.beep/runtime/state",
               b"uid-1234", b"user@1234.service", b"user-1234.slice", b"pid123", b"pid=123", b"pid:123",
               b'{"pid":123}', b'{"pid":null}', b'{"procStart":"raw"}', b"nonce-123.lease.json", b"merged-preview-1234",
               b"ghp_" + b"x" * 25, b"github_pat_" + b"x" * 25,
               b"op://vault/item/field=Abcdef1234567890", b"sk-proj-" + b"x" * 30,
               b"xoxb-" + b"x" * 20, b"AKIA" + b"X" * 16, b"-----BEGIN " + b"PRIVATE KEY-----",
               b"authorization: bearer private", b"api_key=" + b"A" * 16, b"https://user:pass@example.invalid"]
        for data in bad:
            with self.subTest(size=len(data)):
                with self.assertRaises(SystemExit) as exc:
                    etl.scan_output_bytes([("fixture", data)])
                self.assertNotIn(data.decode(), str(exc.exception))
        # The run-3b hostname class moved to the capture-only scan (host-independent ordinary verify).
        for data in (host, etl.sha256(host)[:12].encode()):
            with self.subTest(size=len(data)):
                with self.assertRaisesRegex(SystemExit, "hostname") as exc:
                    etl.scan_capture_only([("fixture", data)])
                self.assertNotIn(data.decode(), str(exc.exception))
        etl.scan_output_bytes([("safe", b"branch=feat/tmpfs-reap\nownerRef=abcdef012345\nuid-<uid>\n<proc>/<process>/status\n")])
        etl.scan_output_bytes([("safe.properties", b'message={"pid":null,"proofTier":"full"}\n')])
        with self.assertRaises(SystemExit):
            etl.scan_output_bytes([("unsafe.properties", b'message={"pid":null}\nother={"pid":123}\n')])

    def test_run4_residue_classes_are_rejected_without_echoing(self):
        tree = ("Yee" + "Bois").encode()
        cases = [(b"x/.claude/projects/-home-someone-repo/x", "encoded home marker"),
                 (b"see ~/notes", "home-relative"), (b"cd $HOME/x", "home-relative"), (b"cd ${HOME}/x", "home-relative"),
                 (b"repo " + tree + b"/projects", "machine tree name"), (b"repo " + tree.upper(), "machine tree name"),
                 (b"<home>/" + tree + b"/x", "machine tree name"), (b"<home>/bob/x", "home subtree"),
                 (b"hotPaths=<fleet>/oip-client/matter", "fleet path outside"),
                 (b'{"uid": 1000}', "numeric user identity"), (b"env UID=1000", "numeric user identity"),
                 (b"USER_ID:1000", "numeric user identity"), (b"merged_preview_4242421", "staging or preview"),
                 (b"mergedPreview4242422", "staging or preview"), (b'{"childPids":[1]}', "process identity member"),
                 (b'{"pid_list":[1]}', "process identity member"), (b"pids=1\n", "process identity member")]
        for data, cls in cases:
            with self.subTest(data=data):
                with self.assertRaisesRegex(SystemExit, cls) as exc:
                    etl.scan_output_bytes([("fixture", data)])
                self.assertNotIn(data.decode(), str(exc.exception))
        for safe in (b"fix_effect-reference-workspace-home-paths-494ccd14bef4", b"<home>/.beep/runtime/x",
                     b"<fleet>/beep-effect9-worktrees/x", b"uid-<uid>", b'{"rapids": 1, "weightTokens": 3}',
                     b"merged-preview-<process>", b"x.tmp-<process>-123e4567-e89b-42d3-a456-426614174000",
                     b"originKey=" + ORIGIN_KEY.encode()):
            etl.scan_output_bytes([("fixture", safe)])
        for data in (b"-home-someone-repo", b'"-home-someone"', b"projects/-home-x"):
            with self.assertRaisesRegex(SystemExit, "encoded home marker"):
                etl.scan_output_bytes([("fixture", data)])

    def test_home_marker_is_refused_only_when_it_starts_a_component(self):
        # P1 build sitting recorded call (s): a branch-derived lane label or runId carrying -home- mid-token is an
        # ordinary public label; the same marker starting a path component is the encoded home directory form.
        for safe in (b"label: beep-effect9-worktrees/fix-effect-reference-workspace-home-paths\n",
                     b"label: beep-effect9/.claude/worktrees/fix-home-paths\n",
                     b"path: attempts/beep-effect9-worktrees%2Ffix-home-paths/fix-home-paths-0123456789ab/attempts.ndjson\n",
                     b'{"runId":"fix_workspace-home-paths-494ccd14bef4","branch":"fix/workspace-home-paths"}'):
            with self.subTest(safe=safe):
                etl.scan_output_bytes([("fixture", safe)])
        for bad in (b"label: beep-effect9-worktrees/-home-paths\n", b"label: -home-paths\n",
                    b'{"branch":"fix/-home-paths"}', b"<fleet>/beep-effect9/-home-x/y", b'"-home-paths"'):
            with self.subTest(bad=bad):
                with self.assertRaisesRegex(SystemExit, "encoded home marker") as exc:
                    etl.scan_output_bytes([("fixture", bad)])
                self.assertNotIn(bad.decode(), str(exc.exception))

    def test_login_and_deny_classes_are_capture_only_and_case_insensitive(self):
        for token in etl.login_tokens():
            for form in (token, token.upper(), token.capitalize()):
                with self.subTest(form=len(form)):
                    with self.assertRaisesRegex(SystemExit, "login name") as exc:
                        etl.scan_capture_only([("fixture", b"branch=feat_" + form + b"_x")])
                    self.assertNotIn(form.decode(), str(exc.exception))
        with login_patch("runner"):
            self.assertEqual(etl.login_tokens(), (b"home_runner", b"runner", b"runner_"))
            etl.scan_output_bytes([("fixture", b"branch=fix/runner-root")])
            with self.assertRaisesRegex(SystemExit, "login name"):
                etl.scan_capture_only([("fixture", b"branch=fix/Runner-root")])
        with login_patch("zq"):
            self.assertEqual(etl.login_tokens(), (b"home_zq",))
            etl.scan_capture_only([("fixture", b"zq_ok")])
            with self.assertRaisesRegex(SystemExit, "login name"):
                etl.scan_capture_only([("fixture", b"branch=home_zq_x")])
        denied = b"/srv/fixture/checkout"
        etl.scan_output_bytes([("fixture", b"x=" + denied[1:])])
        with self.assertRaisesRegex(SystemExit, "capture-observed host path") as exc:
            etl.scan_capture_only([("fixture", b"x=" + denied[1:] + b";" + denied)], {denied})
        self.assertNotIn(denied.decode(), str(exc.exception))
        etl.scan_capture_only([("fixture", b"x=srv/fixture/checkoutless")], {b"/srv/fixture/checkout/"})

    def test_excluded_checkout_labels_fail_capture_by_redacted_form(self):
        patterns = etl.excluded_label_patterns([("beep-effect-private", Path("/x")),
                                                ("beep-effect-worktrees/odd", Path("/y"))])
        for data in (b'"<fleet>/beep-effect-private"', b"<fleet>/beep-effect-private/packages/a",
                     b"<fleet>/beep-effect-private-worktrees/lane/x", b"<fleet>/beep-effect-private\\n",
                     b"<fleet>/beep-effect-worktrees/odd/x"):
            with self.subTest(data=data):
                with self.assertRaisesRegex(SystemExit, "excluded checkout label"):
                    etl.scan_capture_only([("fixture", data)], (), patterns)
        etl.scan_capture_only([("fixture", b"<fleet>/beep-effect-privateer/x <fleet>/beep-effect-worktrees/oddity")], (), patterns)

    def test_provider_credential_shapes_are_refused(self):
        alnum = "Ab1" * 20
        shapes = ["gh" + "o_" + alnum[:36], "gh" + "s_" + alnum[:36], "op" + "s_eyJ" + alnum,
                  "sk" + "_live_" + alnum[:24], "rk" + "_test_" + alnum[:24], "AI" + "za" + alnum[:35],
                  "gl" + "pat-" + alnum[:20], "np" + "m_" + alnum[:36], "h" + "f_" + alnum[:34],
                  "xo" + "xe-" + alnum[:20], "ey" + "J" + alnum[:20] + ".ey" + "J" + alnum[:20] + "." + alnum[:20],
                  "ey" + "JhbGciOiJIUzI1NiJ9." + alnum[:40] + "." + alnum[:43],
                  "aws_secret_access" + "_key=" + alnum[:40], "GITHUB" + "_TOKEN=" + alnum[:40], "NPM" + "_TOKEN: " + alnum[:36]]
        for shape in shapes:
            with self.subTest(size=len(shape)):
                with self.assertRaisesRegex(SystemExit, "credential") as exc:
                    etl.scan_output_bytes([("fixture.json", etl.encode_json({"message": "x " + shape}))])
                self.assertNotIn(shape, str(exc.exception))
        for safe in ("attempts/task-" + "abcdefghij" * 3 + ".json", "risk-" + "x" * 30, "task_test_lane",
                     "weightTokens=3", "originKey=" + ORIGIN_KEY, "cacheKey=" + "a" * 20):
            etl.scan_output_bytes([("fixture", safe.encode())])

    def test_provider_prefix_needs_a_boundary(self):
        etl.scan_output_bytes([("fixture", b"attempts/task-" + b"abcdefghij" * 3 + b".json")])
        etl.scan_output_bytes([("fixture", b"risk-" + b"x" * 30)])
        for data in (b"sk-" + b"x" * 30, b"key: sk-proj-" + b"y" * 30, b'"sk-' + b"z" * 25 + b'"'):
            with self.subTest(size=len(data)):
                with self.assertRaisesRegex(SystemExit, "provider credential"):
                    etl.scan_output_bytes([("fixture", data)])

    def test_deny_list_harvests_host_path_members(self):
        deny = set()
        for value in ("/", "/tmp", "relative/x", "/srv/x", "/home/someone", 12):
            etl.add_denied(deny, value)
        self.assertEqual(deny, {b"/srv/x", b"/home/someone"})
        etl.observe_host_strings(b'{"checkoutRoot":"/srv/a\\/b","originKey":"' + ORIGIN_KEY.encode() + b'","other":"/srv/c"}', deny)
        self.assertIn(b"/srv/a/b", deny)
        self.assertNotIn(b"/srv/c", deny)
        document = etl.encode_json({"lease": {"command": "rsync /srv/oip/matter-1/x dest", "hotPaths": ["/mnt/data/a"],
                                              "cwd": "/opt/w/x", "repoRoot": "/var/r/y", "message": "/srv/free/text"}})
        etl.observe_host_strings(document, deny)
        for token in (b"/srv/oip/matter-1/x", b"/mnt/data/a", b"/opt/w/x", b"/var/r/y"):
            self.assertIn(token, deny)
        self.assertNotIn(b"/srv/free/text", deny)

    def test_gitignored_emitted_components_are_refused(self):
        for path in ("attempts/x/.beep/attempts.ndjson", "attempts/x/docs/attempts.ndjson", "attempts/x/tmp/a.ndjson",
                     "attempts/x/build/a.ndjson", "live/x/a.pem", "live/x/.env.local", "attempts/x/__pycache__/a.ndjson"):
            with self.subTest(path=path):
                with self.assertRaisesRegex(SystemExit, "git-ignored"):
                    etl.check_emitted_path(path)
        for path in ("attempts/beep-effect-fixture%2F.claude%2Fworktrees%2Fname/main-0123456789ab/attempts.ndjson",
                     "live/canonical/quarantine/state.ndjson", "admission/canonical/journal.properties"):
            etl.check_emitted_path(path)


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
        self.assertIsNone(etl.classify_chain(["admission-enqueued", "admission-released"]))
        self.assertIsNone(etl.classify_chain(["admission-enqueued", "admission-withdrawn", "admission-released"]))
        self.assertNotIn("waitMillis", json.dumps(census))
        window = etl.root_windows({"admission/fixture/journal.ndjson": rows}, census, "fixture")
        self.assertEqual((window["first_retained_row_instant"], window["last_retained_row_instant"],
                          window["released_only_chains"]), ("1970-01-01T00:00:00.010Z", "1970-01-01T00:00:00.020Z", 1))
        absent = etl.root_windows({}, census, "absent")
        self.assertEqual((absent["first_retained_row_instant"], absent["last_retained_row_instant"],
                          absent["released_only_chains"], absent["note"]), (None, None, 0, etl.WINDOW_NOTE))
        # released_only_chains is the pre-v3 count: an admitted->released pair without its enqueue counts too.
        self.assertEqual(etl.classify_chain(["admission-admitted", "admission-released"]), "pre-v3")
        self.assertIn("admitted->released pairs", etl.WINDOW_NOTE)
        self.assertNotIn("no admitted pair", etl.WINDOW_NOTE)

    def test_window_note_states_the_pre_v3_rule_exactly_as_classify_chain_computes_it(self):
        note = etl.WINDOW_NOTE
        for phrase in ("as classify_chain computes them", "no retained admission-enqueued row",
                       "at least one admission-admitted or admission-released row",
                       "at most one terminal row and no eviction row",
                       "an enqueue-less chain of withdrawn rows only is unclassified",
                       "an enqueue-less chain whose one terminal row is an eviction is lease-evicted or ticket-evicted",
                       "a chain with more than one terminal row is unclassified"):
            self.assertIn(phrase, note)
        classify = lambda *tags: etl.classify_chain(["admission-" + tag for tag in tags])
        # pre-v3: no enqueue, an admitted or released row, at most one terminal, no eviction.
        for tags in (("admitted",), ("released",), ("admitted", "released"), ("admitted", "withdrawn")):
            with self.subTest(tags=tags):
                self.assertEqual(classify(*tags), "pre-v3")
        # Enqueue-less withdrawn-only chains are unclassified; enqueue-less evicted chains are evicted.
        for tags, expected in ((("withdrawn",), None), (("withdrawn", "withdrawn"), None),
                               (("lease-evicted",), "lease-evicted"), (("ticket-evicted",), "ticket-evicted"),
                               (("admitted", "lease-evicted"), "lease-evicted"),
                               (("admitted", "released", "released"), None),
                               (("admitted", "released", "lease-evicted"), None)):
            with self.subTest(tags=tags):
                self.assertEqual(classify(*tags), expected)
        # released_only_chains counts exactly the pre-v3 chains of its root.
        rows = [event("admission-" + tag, nonce, lastHeartbeatAtMillis=10, evictedAtMillis=20)
                for nonce, chain in (("a", ("admitted",)), ("r", ("released",)), ("w", ("withdrawn",)),
                                     ("e", ("lease-evicted",)), ("t", ("ticket-evicted",)), ("x", ("admitted", "released", "released")))
                for tag in chain]
        census = etl.loss_population({"admission/fixture/journal.ndjson": rows}, ["fixture"])
        self.assertEqual(etl.root_windows({"admission/fixture/journal.ndjson": rows}, census, "fixture")["released_only_chains"], 2)
        self.assertEqual(census["chain_counts"]["unclassified"], 2)

    def test_ts_adapter_names_the_run_3_ruling(self):
        self.assertTrue(etl.TS_ADAPTER.startswith("run-3 Ruling 7 non-trigger"))
        self.assertEqual(etl.POLICY_MEMBERS["ts_adapter"], etl.TS_ADAPTER)
        self.assertEqual(bare_ruling_7_mentions({"ts_adapter": etl.TS_ADAPTER}), 0)
        self.assertEqual(bare_ruling_7_mentions({"ts_adapter": "Ruling 7 non-trigger; no TS observations generated"}), 1)

    def test_p1_build_sitting_prose_binds_the_amendment_and_recorded_calls_without_origin_main(self):
        rulings = etl.ruling_citations(lambda file, needle, occurrence=None: {"file": file, "needle": needle})
        self.assert_p1_build_sitting(self, rulings)

    @staticmethod
    def assert_p1_build_sitting(case, rulings):
        text = rulings["p1_build_sitting"]
        for phrase in ("2026-10-06 P1 build sitting", "the Ruling 3 amendment (11-hex ledger key width)",
                       "Ruling 7 (64-hex originKey written as its first 11 hex characters)",
                       "recorded call (r) (the attempt-start census by stage is a capture-time census over ring buffers",
                       "the pinned census governs", "recorded call (s)", "named in prose because it is not yet in the origin/main tree"):
            case.assertIn(phrase, text)
        # Through the manifest writer's own YAML settings: the folded scalar is rejoined on load, and the scan
        # over loaded leaves takes the amendment branch.
        dumped = manifest_dump({"rulings": rulings})
        loaded = yaml.safe_load(dumped)
        case.assertEqual(loaded["rulings"]["p1_build_sitting"], text)
        branches = ruling_3_branches(loaded)
        case.assertEqual(branches["amendment"], 1)
        case.assertEqual(bare_ruling_7_mentions(loaded), 0)
        etl.scan_output_bytes([("rulings.yaml", dumped.encode())])

    def test_heartbeat_invariant_is_a_hard_check(self):
        bad = event("admission-lease-evicted", "bad", lastHeartbeatAtMillis=21, evictedAtMillis=20)
        with self.assertRaises(SystemExit):
            etl.loss_population({"admission/fixture/journal.ndjson": [bad]}, ["fixture"])

    def test_stage_census_splits_at_the_cut(self):
        def start(stage, at):
            row = {"_tag": "attempt-started", "startedAt": at}
            if stage is not None:
                row["stage"] = stage
            return row
        raw = {"attempts/a/r/attempts.ndjson": [start("merged-preview", "2026-09-09T03:41:38.790Z"),
                                                start("merged-preview", "2026-09-01T00:00:00.000Z"),
                                                start("pre-push", "2026-09-28T15:09:38.000Z"),
                                                start("pre-push", "2026-10-01T00:00:00.000Z"),
                                                start("repair-loop", "2026-09-28T15:09:37.999Z"),
                                                start(None, "2026-09-02T00:00:00.000Z"),
                                                {"_tag": "attempt-started"},
                                                {"_tag": "attempt-finished", "stage": "merged-preview"}],
               "admission/canonical/journal.ndjson": [{"_tag": "attempt-started", "stage": "hosted"}]}
        census, last = etl.stage_census(raw)
        self.assertEqual(census["census_basis"], etl.STAGE_CENSUS_BASIS)
        self.assertIn("capture-time census over ring buffers", census["census_basis"])
        self.assertEqual(census["stages"], {"repair-loop": {"all": 1, "since_cut": 0}, "pre-push": {"all": 2, "since_cut": 2},
                                            "merged-preview": {"all": 2, "since_cut": 0}, "hosted": {"all": 0, "since_cut": 0},
                                            "<absent>": {"all": 2, "since_cut": 0}})
        self.assertEqual((census["starts_without_started_at"], last), (1, "2026-09-09T03:41:38.790Z"))
        self.assertEqual(etl.stage_census({})[1], None)
        for drift in ("staging", "<absent>", {"_tag": "Some"}):
            with self.subTest(drift=drift):
                with self.assertRaisesRegex(SystemExit, "ProofStage"):
                    etl.stage_census({"attempts/a/r/attempts.ndjson": [{"_tag": "attempt-started", "stage": drift}]})

    def test_origin_key_shapes_fail_closed_on_unknown_shapes(self):
        prefixed = {"members": 1, "distinct_values": 1, "rule": etl.ORIGIN_KEY_PREFIX_RULE}
        raw = {"admission/canonical/journal.ndjson": [{"originKey": ORIGIN_KEY}, {"originKey": ""}, {"nonce": "x"}],
               "live/canonical/leases/state-0000.json": [{"lease": {"originKey": LONG_ORIGIN_KEY[:11]}}]}
        shapes = etl.origin_key_shapes(raw, prefixed)
        self.assertEqual(etl.ORIGIN_KEY_SHAPES, ("hex12", "hex11_prefix", "hex64", "empty"))
        self.assertEqual({key: shapes[key] for key in (*etl.ORIGIN_KEY_SHAPES, "journal_rows_without_member")},
                         {"hex12": 1, "hex11_prefix": 1, "hex64": 0, "empty": 1, "journal_rows_without_member": 1})
        self.assertEqual(shapes["hex64_written_as_prefix"], prefixed)
        etl.verify_origin_key_shapes(shapes, raw)
        for bad in ("<fleet>/beep-effect", ORIGIN_KEY.upper(), ORIGIN_KEY[:10], LONG_ORIGIN_KEY[:13], 12, None):
            with self.subTest(bad=bad):
                with self.assertRaisesRegex(SystemExit, "originKey has a shape"):
                    etl.origin_key_shapes({"admission/canonical/journal.ndjson": [{"originKey": bad}]}, prefixed)
        # A 64-hex member in pinned rows is refused: the capture writes its 11-hex prefix.
        with self.assertRaisesRegex(SystemExit, "64-hex originKey reached the pinned rows"):
            etl.origin_key_shapes({"admission/canonical/journal.ndjson": [{"originKey": LONG_ORIGIN_KEY}]}, prefixed)
        for changed in ({**prefixed, "members": 3}, {**prefixed, "distinct_values": 2}, {**prefixed, "members": 0},
                        {**prefixed, "distinct_values": 0}, {**prefixed, "rule": "kept verbatim"},
                        {**prefixed, "members": -1}, {"members": 1}, None):
            with self.subTest(changed=changed):
                with self.assertRaisesRegex(SystemExit, "originKey shape census differs"):
                    etl.verify_origin_key_shapes({**shapes, "hex64_written_as_prefix": changed}, raw)
        # The receipt is bound by the hex11_prefix census, not the 12-hex one: a written prefix rewritten as a
        # native 12-hex value, or a second distinct prefix, is a named failure.
        for mutated in ({**raw, "live/canonical/leases/state-0000.json": [{"lease": {"originKey": LONG_ORIGIN_KEY[:12]}}]},
                        {**raw, "live/canonical/claims/state-0000.json": [{"originKey": "f" * 11}]}):
            with self.subTest(mutated=sorted(mutated)):
                with self.assertRaisesRegex(SystemExit, "originKey shape census differs"):
                    etl.verify_origin_key_shapes({**etl.origin_key_shapes(mutated, prefixed)}, mutated)

    def test_long_origin_keys_are_written_as_injective_eleven_hex_prefixes(self):
        tracker = etl.origin_key_tracker()
        rows = [{"originKey": LONG_ORIGIN_KEY, "nonce": "a"}, {"originKey": ORIGIN_KEY}, {"originKey": ""},
                {"lease": {"originKey": LONG_ORIGIN_KEY, "nested": [{"originKey": LONG_ORIGIN_KEY}]}},
                {"note": LONG_ORIGIN_KEY, "originKey": None}]
        written = etl.prefix_origin_keys(rows, tracker)
        self.assertEqual(etl.ORIGIN_KEY_PREFIX_WIDTH, 11)
        self.assertEqual(written[0], {"originKey": LONG_ORIGIN_KEY[:11], "nonce": "a"})
        self.assertEqual(written[1:3], rows[1:3])
        self.assertEqual(written[3], {"lease": {"originKey": LONG_ORIGIN_KEY[:11], "nested": [{"originKey": LONG_ORIGIN_KEY[:11]}]}})
        self.assertEqual(written[4], rows[4])
        self.assertEqual((tracker["members"], tracker["hex64"], tracker["hex12"], tracker["hex11"]),
                         (3, {LONG_ORIGIN_KEY}, {ORIGIN_KEY}, set()))
        self.assertEqual(etl.check_origin_key_prefixes(tracker, []),
                         {"members": 3, "distinct_values": 1, "rule": etl.ORIGIN_KEY_PREFIX_RULE})
        self.assertNotIn(LONG_ORIGIN_KEY.encode(), etl.encode_ndjson(written[:4]))
        self.assertNotIn(LONG_ORIGIN_KEY[:12].encode(), etl.encode_ndjson(written[:4]))
        self.assertEqual(etl.written_origin_key(LONG_ORIGIN_KEY.upper()), LONG_ORIGIN_KEY.upper())
        self.assertEqual(etl.written_origin_key(ORIGIN_KEY), ORIGIN_KEY)
        # Two 64-hex values sharing a prefix, or a prefix equal to a native 11-hex value or to the head of a
        # live or snapshot 12-hex value, fail closed; so does any native 11-hex value in live rows.
        twin = LONG_ORIGIN_KEY[:11] + "f" * 53
        head_twin = LONG_ORIGIN_KEY[:11] + "0"
        for hex64, hex12, hex11, snapshot in (({LONG_ORIGIN_KEY, twin}, set(), set(), []),
                                              ({LONG_ORIGIN_KEY}, {head_twin}, set(), []),
                                              ({LONG_ORIGIN_KEY}, set(), set(), [{"originKey": head_twin}]),
                                              ({LONG_ORIGIN_KEY}, set(), set(), [{"originKey": LONG_ORIGIN_KEY[:11]}])):
            with self.subTest(hex64=len(hex64), hex12=len(hex12), snapshot=len(snapshot)):
                with self.assertRaisesRegex(SystemExit, "not injective"):
                    etl.check_origin_key_prefixes({"hex64": hex64, "hex12": hex12, "hex11": hex11, "members": 1}, snapshot)
        with self.assertRaisesRegex(SystemExit, "native 11-hex originKey"):
            etl.check_origin_key_prefixes({"hex64": set(), "hex12": set(), "hex11": {"f" * 11}, "members": 0}, [])
        native = etl.origin_key_tracker()
        etl.prefix_origin_keys([{"originKey": "f" * 11}], native)
        self.assertEqual(native["hex11"], {"f" * 11})
        # Unrelated 12-hex and 11-hex snapshot values pass.
        etl.check_origin_key_prefixes({"hex64": {LONG_ORIGIN_KEY}, "hex12": {ORIGIN_KEY}, "hex11": set(), "members": 1},
                                      [{"originKey": ORIGIN_KEY}, {"originKey": "f" * 11}])

    def test_prefix_width_refuses_the_entropy_cut(self):
        self.assertLess(math.log2(etl.ORIGIN_KEY_PREFIX_WIDTH), etl.SECRET_SCAN_ENTROPY_CUT)
        for width in (12, 16):
            with self.subTest(width=width):
                with patch.object(etl, "ORIGIN_KEY_PREFIX_WIDTH", width):
                    with self.assertRaisesRegex(SystemExit, "entropy cut"):
                        etl.check_origin_key_prefixes(etl.origin_key_tracker(), [])

    def test_prefix_rule_cites_ruling_7_and_never_credits_ruling_3_with_the_origin_key_width(self):
        rule = etl.ORIGIN_KEY_PREFIX_RULE
        self.assertIn("P1 Ruling 7 (the width of P1 Ruling 3 as amended)", rule)
        self.assertIn("a checkout on an earlier lock-name derivation", rule)
        self.assertNotIn("the width P1 Ruling 3 gives", rule)
        self.assertNotIn("12 hex", rule)
        texts = [rule, etl.ORIGIN_KEY_BASIS, *etl.REDACTION_RULES, *etl.DISCOVERY_RECEIPTS_UNVERIFIABLE]
        self.assertFalse(any("first 12 hex" in text or "12-hex census" in text for text in texts))


class CitationTests(unittest.TestCase):
    def setUp(self):
        self.repo = scratch(self) / "repo"
        make_repo(self.repo, {"src/a.ts": "const one = 1;\nexport const anchor = 2;\nconst twin = 3;\nconst twin = 4;\n"})
        self.first_commit = run_git(self.repo, "rev-parse", "HEAD")
        self.first_tree = run_git(self.repo, "rev-parse", "HEAD^{tree}")
        stack = contextlib.ExitStack()
        self.addCleanup(stack.close)
        stack.enter_context(patch.object(etl, "REPO_ROOT", self.repo))

    def manifest(self, *citations, commit=None, tree=None):
        return {"corpus_commit": commit or self.first_commit, "corpus_tree": tree or self.first_tree,
                "corpus_base": self.first_commit, "facts": list(citations),
                "descriptor": {"file": "<fleet>/x/attempts.ndjson", "line": 1}}

    def test_cite_records_blob_line_and_digest_from_the_probe(self):
        probe = etl.probe_corpus()
        self.assertEqual((probe["corpus_commit"], probe["corpus_tree"], probe["corpus_base"], probe["capture_head"]),
                         (self.first_commit, self.first_tree, self.first_commit, self.first_commit))
        reader = etl.TreeReader(probe["corpus_tree"])
        citation = etl.tree_cite(reader, "src/a.ts", "export const anchor")
        self.assertEqual(citation, {"file": "src/a.ts", "line": 2, "needle": "export const anchor",
                                    "sha256": etl.sha256((self.repo / "src/a.ts").read_bytes())})
        with self.assertRaisesRegex(SystemExit, "anchor ambiguous"):
            etl.tree_cite(reader, "src/a.ts", "const twin")
        self.assertEqual(etl.tree_cite(reader, "src/a.ts", "const twin", 2)["line"], 4)
        self.assertEqual(etl.tree_cite(reader, "src/a.ts", "const twin", 2)["occurrence"], 2)
        with self.assertRaisesRegex(SystemExit, "occurrence out of range"):
            etl.tree_cite(reader, "src/a.ts", "const twin", 3)
        with self.assertRaisesRegex(SystemExit, "anchor missing"):
            etl.tree_cite(reader, "src/a.ts", "absent anchor")
        with self.assertRaisesRegex(SystemExit, "missing from corpus_tree"):
            etl.tree_cite(reader, "src/missing.ts", "x")
        (self.repo / "src/a.ts").write_text("// dirty\n" + (self.repo / "src/a.ts").read_text())
        with self.assertRaisesRegex(SystemExit, "merge origin/main"):
            etl.tree_cite(etl.TreeReader(self.first_tree), "src/a.ts", "export const anchor")
        # Verify rebuilds tables from tree bytes alone, so a dirty working copy does not matter there.
        self.assertEqual(etl.tree_cite(etl.TreeReader(self.first_tree), "src/a.ts", "export const anchor", working=False), citation)

    def test_probe_fails_closed_without_origin_main(self):
        run_git(self.repo, "update-ref", "-d", "refs/remotes/origin/main")
        with self.assertRaisesRegex(SystemExit, "origin/main is absent"):
            etl.probe_corpus()

    def test_replay_is_tree_pinned_and_current_tree_is_advisory(self):
        reader = etl.TreeReader(self.first_tree)
        citations = [etl.tree_cite(reader, "src/a.ts", "export const anchor"), etl.tree_cite(reader, "src/a.ts", "const twin", 2)]
        _, advisories = etl.verify_tree_citations(self.manifest(*citations))
        self.assertEqual(advisories, {"citations_checked": 2, "current_tree_citation_failures": 0, "corpus_commit_absent": 0,
                                      "origin_main_absent": 0, "corpus_base_not_ancestor_of_origin_main": 0})
        (self.repo / "src/a.ts").write_text("// moved\n" + (self.repo / "src/a.ts").read_text())
        second = commit_all(self.repo, "fixture: edit cited file")
        _, advisories = etl.verify_tree_citations(self.manifest(*citations))
        self.assertEqual(advisories["current_tree_citation_failures"], 2)
        self.assertEqual(advisories["corpus_base_not_ancestor_of_origin_main"], 0)
        with self.assertRaisesRegex(SystemExit, "root tree differs"):
            etl.verify_tree_citations(self.manifest(*citations, commit=second))
        _, advisories = etl.verify_tree_citations(self.manifest(*citations, commit="d" * 40))
        self.assertEqual(advisories["corpus_commit_absent"], 1)
        for changed, reason in (({"line": 3}, "needle differs"), ({"line": 99}, "line out of range"),
                                ({"needle": "absent anchor"}, "needle differs"), ({"sha256": "0" * 64}, "sha256 differs"),
                                ({"file": "src/missing.ts"}, "file missing"), ({"file": "../x"}, "unsafe path")):
            with self.subTest(changed=changed):
                with self.assertRaisesRegex(SystemExit, re.escape(reason)):
                    etl.verify_tree_citations(self.manifest({**citations[0], **changed}))
        with self.assertRaisesRegex(SystemExit, "occurrence differs"):
            etl.verify_tree_citations(self.manifest({**citations[1], "occurrence": 1}))
        missing = "c" * 40
        with self.assertRaisesRegex(SystemExit, re.escape(f"git fetch origin {self.first_commit}")):
            etl.verify_tree_citations(self.manifest(*citations, tree=missing))
        with self.assertRaisesRegex(SystemExit, "no repository citations"):
            etl.verify_tree_citations(self.manifest())

    def test_absent_origin_main_is_not_reported_as_a_non_ancestor(self):
        citation = etl.tree_cite(etl.TreeReader(self.first_tree), "src/a.ts", "export const anchor")
        run_git(self.repo, "update-ref", "-d", "refs/remotes/origin/main")
        _, advisories = etl.verify_tree_citations(self.manifest(citation))
        self.assertEqual((advisories["origin_main_absent"], advisories["corpus_base_not_ancestor_of_origin_main"]), (1, 0))
        run_git(self.repo, "checkout", "-q", "--orphan", "other")
        (self.repo / "src/a.ts").write_text("other\n")
        run_git(self.repo, "add", "-A")
        run_git(self.repo, "commit", "-qm", "fixture: unrelated history")
        run_git(self.repo, "update-ref", "refs/remotes/origin/main", "HEAD")
        _, advisories = etl.verify_tree_citations(self.manifest(citation))
        self.assertEqual((advisories["origin_main_absent"], advisories["corpus_base_not_ancestor_of_origin_main"]), (0, 1))

    def test_partial_clone_blob_absence_names_the_fetch(self):
        citation = etl.tree_cite(etl.TreeReader(self.first_tree), "src/a.ts", "export const anchor")
        blob = run_git(self.repo, "rev-parse", f"{self.first_tree}:src/a.ts")
        (self.repo / ".git/objects" / blob[:2] / blob[2:]).unlink()
        with self.assertRaisesRegex(SystemExit, re.escape(f"blob absent from this clone (partial clone?); run: git fetch origin {self.first_commit}")):
            etl.verify_tree_citations(self.manifest(citation))


class RealTableTests(unittest.TestCase):
    """The real citation tables resolved against this clone's fetched origin/main tree."""

    EXPECTED_CITATIONS = 70

    def setUp(self):
        completed = subprocess.run(["git", "-C", str(etl.REPO_ROOT), "rev-parse", "--verify", "--quiet", etl.CORPUS_REF + "^{tree}"],
                                   capture_output=True, text=True)
        if completed.returncode:
            self.skipTest("origin/main is not fetched in this clone")
        self.reader = etl.TreeReader(completed.stdout.strip())
        self.cite = functools.partial(etl.tree_cite, self.reader, working=False)

    def tables(self, cite=None):
        cite = cite or self.cite
        return {"source_facts": etl.source_facts(cite), "known_loss_classes": etl.known_losses(cite),
                "join_keys": etl.join_keys(cite), "rulings": etl.ruling_citations(cite),
                "admission_kind_note": etl.admission_kind_note(cite)}

    def test_needles_resolve_with_occurrence_exactly_where_ambiguous(self):
        tables = self.tables()
        citations = etl.repository_citations(tables)
        self.assertEqual(len(citations), self.EXPECTED_CITATIONS)
        for citation in citations:
            lines = self.reader.read(citation["file"]).decode().splitlines()
            matches = sum(citation["needle"] in line for line in lines)
            self.assertEqual("occurrence" in citation, matches > 1, (citation["file"], citation["needle"]))
        facts = tables["source_facts"]
        self.assertEqual([facts[key]["value"] for key in ("admitted_retention", "known_history_retention", "terminal_attempt_retention")],
                         [etl.ADMITTED_RING_CAP, etl.KNOWN_HISTORY_CAP, etl.TERMINAL_ATTEMPT_CAP])
        self.assertEqual((etl.ADMITTED_RING_CAP, etl.KNOWN_HISTORY_CAP, etl.TERMINAL_ATTEMPT_CAP), (200, 2400, 50))
        ring = next(receipt for receipt in tables["known_loss_classes"] if receipt["class"] == "ring windows")
        self.assertEqual(set(ring) - {"class", "source", "current_source_assessment"},
                         {"known_history_source", "attempt_source", "retention_algorithm_source"})
        # The tables are generator output: no residue class may fire on them.
        etl.scan_output_bytes([("tables.yaml", yaml.safe_dump(tables, sort_keys=False).encode())])

    def test_p1_build_sitting_prose_takes_the_ruling_3_amendment_branch(self):
        rulings = etl.ruling_citations(self.cite)
        CensusTests.assert_p1_build_sitting(self, rulings)
        # Every other ruling is a tree-pinned citation; only the two P1 sittings are prose.
        self.assertEqual(sorted(key for key, value in rulings.items() if isinstance(value, str)), ["p1_build_sitting", "p1_sitting"])

    def test_a_changed_retention_constant_fails_the_capture_by_name(self):
        journal = etl.REPO_RUN + "AdmissionJournal.ts"
        reader = self.reader

        class Edited:
            def read(self, file):
                data = reader.read(file)
                return data.replace(b"const RETAINED_ADMISSIONS = 200;", b"const RETAINED_ADMISSIONS = 201;") if file == journal else data
        with self.assertRaisesRegex(SystemExit, "anchor missing: " + re.escape(journal)):
            etl.source_facts(functools.partial(etl.tree_cite, Edited(), working=False))

    def test_staging_templates_match_the_redaction(self):
        facts = etl.source_facts(self.cite)
        for key, needle in (("staging_tmp_suffix", ".tmp-${process.pid}"), ("staging_tombstone_suffix", ".tombstone-${process.pid}-"),
                            ("staging_stage_suffix", ".stage-${process.pid}-"), ("staging_journal_suffix", ".staging-${process.pid}-")):
            source = facts[key]["source"]
            line = self.reader.read(source["file"]).decode().splitlines()[source["line"] - 1]
            self.assertIn(needle, line, key)


class KnownLossTests(unittest.TestCase):
    def test_ring_extras_attach_by_class_key_in_any_order(self):
        def fake(file, needle, occurrence=None):
            return {"file": file, "needle": needle}
        for order in (etl.KNOWN_LOSS_CLASSES, tuple(reversed(etl.KNOWN_LOSS_CLASSES))):
            with patch.object(etl, "KNOWN_LOSS_CLASSES", order):
                receipts = etl.known_losses(fake)
            for receipt in receipts:
                extras = set(receipt) - {"class", "source", "current_source_assessment"}
                self.assertEqual(extras, {"known_history_source", "attempt_source", "retention_algorithm_source"}
                                 if receipt["class"] == "ring windows" else set())


class JoinKeyTests(unittest.TestCase):
    def test_deployed_join_keys_at_the_corpus_tree_match_the_allowlist(self):
        completed = subprocess.run(["git", "-C", str(etl.REPO_ROOT), "rev-parse", "--verify", "--quiet", etl.CORPUS_REF + "^{tree}"],
                                   capture_output=True, text=True)
        if completed.returncode:
            self.skipTest("origin/main is not fetched in this clone")
        census = etl.deployed_join_keys(etl.TreeReader(completed.stdout.strip()).read)
        self.assertEqual(census["join_keys"], sorted(etl.JOIN_KEY_ALLOWLIST))
        self.assertIn("parentLaneId", census["join_keys"])
        self.assertEqual(census["process_identities_normalized"], ["ownerpid", "pid"])
        for key in census["join_keys"]:
            self.assertFalse(etl.process_member(key), key)

    def test_a_new_writer_id_field_is_a_named_failure(self):
        sources = {**JOIN_KEY_SOURCES, etl.YEET + "Verdict.ts": JOIN_KEY_SOURCES[etl.YEET + "Verdict.ts"] + "    reviewLaneId: S.String,\n"}
        with self.assertRaisesRegex(SystemExit, "new: reviewLaneId; gone: none"):
            etl.deployed_join_keys(lambda file: sources[file].encode())
        sources = {**JOIN_KEY_SOURCES, etl.REPO_RUN + "RepoRun.models.ts": "    stepId: S.String,\n"}
        with self.assertRaisesRegex(SystemExit, "new: none; gone: taskId"):
            etl.deployed_join_keys(lambda file: sources[file].encode())

    def test_join_keys_survive_redaction_and_projection(self):
        verdict = {"runId": "fixture-run", "attemptId": "fixture-attempt", "failedStepId": "full:check",
                   "failureKind": "step-exit", "lanes": [{"id": "quality:check", "parentLaneId": "quality"}]}
        payload = {"schemaVersion": etl.ATTEMPT_SCHEMA, "_tag": "attempt-finished", "attemptId": "fixture-attempt",
                   "stepId": "full:check", "taskId": "fixture#check", "id": "full:check", "verdict": verdict}
        rows, receipt = etl.transform_source(etl.encode_ndjson([payload]), "attempts", b"a" * 32)
        self.assertEqual(rows, [payload])
        self.assertEqual(sum(receipt["owner_refs_by_variant"].values()), 0)
        pairs = etl.eligible_property_pairs(rows[0])
        for pair in (("parentLaneId", "quality"), ("id", "quality:check"), ("taskId", "fixture#check"),
                     ("stepId", "full:check"), ("failedStepId", "full:check"), ("runId", "fixture-run")):
            self.assertIn(pair, pairs)
        etl.scan_output_bytes([("attempts.ndjson", etl.encode_ndjson(rows)), ("attempts.properties", etl.projected_bytes(rows, "organic"))])


class DiscoveryTests(FixtureWorld):
    def setUp(self):
        super().setUp()
        self.patches.close()
        self.patches = contextlib.ExitStack()
        self.addCleanup(self.patches.close)
        self.discovery = self.base / "discovery"
        fleet = self.discovery
        public = '[core]\n\tbare = false\n[remote "origin"]\n\turl = https://github.com/beep-effect/beep-effect.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n'
        clone = fleet / "beep-effect"
        write_files(clone, {".git/config": public, ".git/worktrees/lane/commondir": "../..\n",
                            ".git/worktrees/cw/commondir": "../..\n"})
        write_files(fleet / "beep-effect-worktrees/lane", {".git": "gitdir: ../../beep-effect/.git/worktrees/lane\n"})
        write_files(fleet / "beep-effect-worktrees/nested", {".git/config": '[remote  "origin" ]\n  url=git@GitHub.com:beep-effect/beep-effect\n'})
        write_files(clone / ".claude/worktrees/cw", {".git": f"gitdir: {clone}/.git/worktrees/cw\n"})
        self.private = private = fleet / "beep-effect-private"
        write_files(private, {".git/config": '[remote "origin"]\n\turl = git@github.com:beep-effect/beep-effect-private.git\n',
                              ".git/worktrees/p1/commondir": "../..\n",
                              ".beep/yeet/runs/main-0123456789ab/attempts.ndjson": etl.encode_ndjson([{
                                  "schemaVersion": etl.ATTEMPT_SCHEMA, "_tag": "attempt-started", "attemptId": ATTEMPT_B,
                                  "branch": "private-branch-marker", "startedAt": "2026-10-05T12:00:00.000Z"}])})
        write_files(private / ".claude/worktrees/pc", {".git": f"gitdir: {private}/.git/worktrees/p1\n"})
        write_files(fleet / "beep-effect-private-worktrees/p1", {".git": f"gitdir: {private}/.git/worktrees/p1\n",
                                                                ".beep/yeet/runs/x-0123456789ab/attempts.ndjson": "private\n"})
        write_files(fleet / "beep-effect-noorigin", {".git/config": '[remote "upstream"]\n\turl = https://github.com/beep-effect/beep-effect\n'})
        write_files(fleet / "beep-effect-gitfile", {".git": "not a gitfile\n"})
        locked = fleet / "beep-effect-locked"
        write_files(locked, {".git/config": public})
        (locked / ".git/config").chmod(0)
        self.addCleanup((locked / ".git/config").chmod, 0o600)
        write_files(fleet / "beep-effect-not-a-checkout", {"README.md": "x"})
        self.disc_admission = self.home / ".beep/disc-runtime" / UID_LEAF
        # Discovery-fleet lease: every host path in it sits under the discovery fleet root.
        self.disc_lease = {"schemaVersion": "yeet-admission-lease/v1", "nonce": "n-live", "pid": 4242421, "procStart": "s",
                           "checkoutRoot": str(fleet / "beep-effect"), "branch": "main", "command": "bun run beep yeet verify",
                           "hotPaths": [], "startedAt": "2026-10-05T12:00:00.000Z", "heartbeatAtMillis": 2700}
        write_files(fleet / "beep-effect/.beep/yeet/runs/main-0123456789ab", {"attempts.ndjson": etl.encode_ndjson([{
            "schemaVersion": etl.ATTEMPT_SCHEMA, "_tag": "attempt-started", "attemptId": ATTEMPT_A, "branch": "main",
            "startedAt": "2026-10-05T12:00:00.000Z"}])})

    def install_discovery(self):
        self.install_world(self.discovery, [("canonical", self.disc_admission)])

    def test_public_origin_filter_layouts_and_counts(self):
        excluded, seen, rejected = collections.Counter(), [], []
        with patch.object(etl, "FLEET_ROOT", self.discovery):
            found = etl.discover_checkouts(excluded, seen, rejected)
        self.assertEqual(found, [
            ("beep-effect", self.discovery / "beep-effect", "clone", "fleet-root"),
            ("beep-effect-worktrees/lane", self.discovery / "beep-effect-worktrees/lane", "linked-worktree", "worktrees-dir"),
            ("beep-effect-worktrees/nested", self.discovery / "beep-effect-worktrees/nested", "clone", "worktrees-dir"),
            ("beep-effect/.claude/worktrees/cw", self.discovery / "beep-effect/.claude/worktrees/cw", "linked-worktree", "claude-worktrees")])
        # The gitfile without a gitdir line is unreadable everywhere; the mode-000 config only for non-root.
        self.assertEqual(dict(excluded), {"non_public_origin": 3, "missing_origin": 1,
                                          "unreadable_git_metadata": 1 + int(os.geteuid() != 0)})
        self.assertEqual(len(seen), 4 + 3 + 1 + 2)
        self.assertIn(("beep-effect-private", self.private), rejected)
        self.assertEqual(len(rejected), sum(excluded.values()))

    def test_canonical_origin_forms(self):
        for url in ("https://github.com/beep-effect/beep-effect.git", "https://GITHUB.com/beep-effect/beep-effect/",
                    "git@github.com:beep-effect/beep-effect.git", "ssh://git@github.com:22/beep-effect/beep-effect",
                    "github.com:beep-effect/beep-effect.git/"):
            self.assertEqual(etl.canonical_origin(url), etl.PUBLIC_ORIGIN, url)
        for url in ("https://github.com/beep-effect/beep-effect-private.git", "https://example.com/beep-effect/beep-effect",
                    "/srv/mirror/beep-effect", "https://github.com/Beep-Effect/beep-effect"):
            self.assertNotEqual(etl.canonical_origin(url), etl.PUBLIC_ORIGIN, url)

    def test_capture_never_labels_or_reads_excluded_checkouts(self):
        self.install_discovery()
        result = self.run_main()
        self.assertEqual(result["fleet"]["status"], "pinned")
        manifest = self.manifest()
        self.assertEqual(manifest["checkout_counts"]["excluded"]["non_public_origin"], 3)
        self.assertEqual(manifest["checkout_counts"]["by_layout"], {"claude-worktrees": 1, "fleet-root": 1, "worktrees-dir": 2})
        self.assertEqual([c["layout"] for c in manifest["checkouts"]], ["fleet-root", "worktrees-dir", "worktrees-dir", "claude-worktrees"])
        emitted = self.all_emitted()
        names = "\n".join(tree_bytes(self.outputs["fleet"])).encode()
        for token in (b"beep-effect-private", b"private-branch-marker", b"beep-effect-noorigin", b"beep-effect-locked", b"gitfile"):
            self.assertNotIn(token, emitted + names)
        self.assertIn("beep-effect/.claude/worktrees/cw", [c["checkout"] for c in manifest["checkouts"]])
        self.assertIn(b"attempts/beep-effect/main-0123456789ab/attempts.ndjson", names)

    def test_admission_rows_from_an_excluded_checkout_fail_capture_closed(self):
        private_row = event("admission-enqueued", "n-priv", kind="full-proof", priority="verify", originKey="",
                            checkoutRoot=str(self.private), branch="private-branch-marker", enqueuedAtMillis=1, weightTokens=1)
        for files in ({"journal.ndjson": etl.encode_ndjson([private_row])},
                      {"quarantine/q-priv-77.lease.json.1": etl.encode_json({**self.disc_lease, "nonce": "q-priv",
                                                                              "checkoutRoot": str(self.private) + "/.claude/worktrees/pc"})}):
            with self.subTest(files=list(files)):
                write_files(self.disc_admission, files)
                with contextlib.ExitStack() as stack:
                    self.patches, saved = stack, self.patches
                    try:
                        self.install_discovery()
                        with self.assertRaisesRegex(SystemExit, "excluded checkout label"):
                            self.run_main()
                    finally:
                        self.patches = saved
                self.assertFalse(self.outputs["fleet"].exists())
                for name in files:
                    (self.disc_admission / name).unlink()

    def test_rows_naming_another_fleet_project_fail_capture_closed(self):
        lease = {**self.disc_lease, "hotPaths": [str(self.discovery / "oip-client-fixture/matter-1/file.docx")]}
        write_files(self.disc_admission, {"leases/n-live-4242421.lease.json": etl.encode_json(lease)})
        self.install_discovery()
        with self.assertRaisesRegex(SystemExit, "fleet path outside the beep-effect checkouts"):
            self.run_main()
        self.assertFalse(self.outputs["fleet"].exists())

    def test_a_gitignored_run_directory_fails_capture_closed(self):
        for name in (".beep", "docs", "build"):
            with self.subTest(name=name):
                run = self.discovery / "beep-effect/.beep/yeet/runs" / name
                write_files(run, {"attempts.ndjson": etl.encode_ndjson([{"schemaVersion": etl.ATTEMPT_SCHEMA,
                    "_tag": "attempt-started", "attemptId": ATTEMPT_A, "startedAt": "2026-10-05T12:00:00.000Z"}])})
                with contextlib.ExitStack() as stack:
                    self.patches, saved = stack, self.patches
                    try:
                        self.install_discovery()
                        with self.assertRaisesRegex(SystemExit, "git-ignored"):
                            self.run_main()
                    finally:
                        self.patches = saved
                self.assertFalse(self.outputs["fleet"].exists())
                (run / "attempts.ndjson").unlink()
                run.rmdir()


class LiveFamilyAndPinTests(FixtureWorld):
    def test_first_pin_then_verify_only_rerun(self):
        first = self.run_main()
        self.assertEqual(first["fleet"]["status"], "pinned")
        self.assertEqual(first["advisories"]["current_tree_citation_failures"], 0)
        manifest = self.manifest()
        self.assertEqual(tuple(manifest), etl.MANIFEST_KEYS)
        self.assertEqual(list(manifest)[:13], ["schema_version", "generated_by", "generator_sha256", "generator_lineage",
                                               "corpus_commit", "corpus_tree", "corpus_base", "corpus_ref", "capture_head",
                                               "citation_replay", "capture_instant", "capture_finished_at", "stage"])
        self.assertEqual(list(manifest)[-6:], ["projection_rules", "redaction_rules", "files", "integrity", "verification", "totals"])
        self.assertEqual((manifest["schema_version"], manifest["stage"], manifest["provenance"]),
                         ("beep-ci-ops-run4-fleet-corpus/v1", "C", "organic"))
        self.assertEqual(manifest["corpus_tree"], run_git(self.repo, "rev-parse", "refs/remotes/origin/main^{tree}"))
        self.assertEqual(manifest["generator_lineage"][0]["sha256"], etl.sha256(b"# frozen run3b generator fixture\n"))
        self.assertEqual(manifest["proof_ledger"], {**etl.PROOF_LEDGER_BLOCK, "checkouts_with_ledger": 1})
        self.assertEqual(manifest["proof_ledger"]["observation_basis"], "file existence only in this pin; contents are pinned by the sibling")
        self.assertEqual(manifest["synthetic_label_policy"]["source"],
                         "intake docket Stage C clause and PLAN W3 (named in prose; both are edited by the capture pull request)")
        manifest_bytes = (self.outputs["fleet"] / etl.MANIFEST_NAME).read_bytes()
        self.assertTrue(manifest_bytes.startswith(b"# GENERATED by etl_run4_fleet_corpus.py; do not hand-edit.\n"
                                                  b"# Public run-4 Stage C capture; source descriptors are portable.\n"))
        self.assertNotIn(b"dry-run", manifest_bytes)
        self.assertNotIn(b"must never be read", self.all_emitted())
        before = tree_bytes(self.outputs["fleet"])
        second = self.run_main()
        self.assertEqual(second["fleet"]["status"], "verified")
        self.assertEqual(before, tree_bytes(self.outputs["fleet"]))
        self.assertEqual(self.verify_cli().returncode, 0)

    def test_stage_census_kind_note_and_windows_reproduce_from_pinned_bytes(self):
        self.run_main()
        manifest = self.manifest()
        self.assertEqual(manifest["attempt_starts_by_stage"]["stages"],
                         {"repair-loop": {"all": 0, "since_cut": 0}, "pre-push": {"all": 2, "since_cut": 2},
                          "merged-preview": {"all": 1, "since_cut": 0}, "hosted": {"all": 0, "since_cut": 0},
                          "<absent>": {"all": 1, "since_cut": 0}})
        self.assertEqual(manifest["attempt_starts_by_stage"]["cut"], "2026-09-28T15:09:38.000Z")
        self.assertEqual(manifest["last_merged_preview_start"], "2026-09-09T03:41:38.790Z")
        self.assertEqual(manifest["admission_kind_note"]["text"], "fixture kind note")
        windows = {root["label"]: root["window"] for root in manifest["admission_roots"]}
        self.assertEqual((windows["canonical"]["first_retained_row_instant"], windows["canonical"]["last_retained_row_instant"],
                          windows["canonical"]["released_only_chains"]), ("1970-01-01T00:00:00.900Z", "1970-01-01T00:00:03.000Z", 1))
        self.assertEqual((windows["system-tmp"]["first_retained_row_instant"], windows["system-tmp"]["last_retained_row_instant"],
                          windows["system-tmp"]["released_only_chains"]), (None, None, 0))
        self.assertEqual(windows["canonical"]["note"], etl.WINDOW_NOTE)
        self.assertIn("pre-v3 chains", windows["canonical"]["note"])
        self.assertEqual(manifest["attempt_starts_by_stage"]["census_basis"], etl.STAGE_CENSUS_BASIS)
        shapes = manifest["origin_key_shapes"]
        self.assertEqual({key: shapes[key] for key in ("hex12", "hex11_prefix", "hex64", "empty", "journal_rows_without_member")},
                         {"hex12": 2, "hex11_prefix": 0, "hex64": 0, "empty": 2, "journal_rows_without_member": 3})
        # Manifest prose never credits Ruling 3 with the admission originKey width. The scan walks the loaded
        # string leaves: the writer folds prose at width 100, so a raw-text window can split a phrase.
        self.assertFalse(any("Ruling 3 gives" in leaf for leaf in string_leaves(manifest)))
        self.assertGreater(ruling_3_branches(manifest)["as_amended"], 0)
        # Every Ruling 7 mention is qualified, so run-3 Ruling 7 (TS adapter) never reads as P1 Ruling 7.
        self.assertEqual(manifest["ts_adapter"], etl.TS_ADAPTER)
        self.assertEqual(bare_ruling_7_mentions(manifest), 0)

    def test_lane_label_with_home_marker_mid_token_pins_and_component_leading_fails(self):
        base = [("beep-effect-fixture", self.clone, "clone", "fleet-root"),
                ("beep-effect-fixture/.claude/worktrees/name", self.lane, "linked-worktree", "claude-worktrees")]
        started = {"schemaVersion": etl.ATTEMPT_SCHEMA, "_tag": "attempt-started", "attemptId": ATTEMPT_B,
                   "branch": "main", "startedAt": "2026-10-05T12:00:00.000Z", "stage": "pre-push"}
        for name, pins in (("fix-workspace-home-paths", True), ("-home-paths", False)):
            with self.subTest(name=name):
                shutil.rmtree(self.outputs["fleet"], ignore_errors=True)
                lane = self.clone / ".claude/worktrees" / name
                write_files(lane, {".git": f"gitdir: {self.clone}/.git/worktrees/{name}\n",
                                   ".beep/yeet/runs/fix-0123456789ab/attempts.ndjson": etl.encode_ndjson([started])})
                label = f"beep-effect-fixture/.claude/worktrees/{name}"
                with patch.object(etl, "discover_checkouts", return_value=sorted([*base, (label, lane, "linked-worktree", "claude-worktrees")])):
                    if pins:
                        self.assertEqual(self.run_main()["fleet"]["status"], "pinned")
                        self.assertIn(label, [row["checkout"] for row in self.manifest()["checkouts"]])
                        self.assertEqual(self.verify_cli().returncode, 0)
                        shutil.rmtree(self.outputs["fleet"])
                    else:
                        with self.assertRaisesRegex(SystemExit, "encoded home marker") as exc:
                            self.run_main()
                        self.assertNotIn(name, str(exc.exception))
                        self.assertFalse(self.outputs["fleet"].exists())
                shutil.rmtree(lane)

    def test_quarantine_is_one_ndjson_payload_with_ordinals_only(self):
        self.run_main()
        manifest = self.manifest()
        live = {entry["family"]: entry for entry in manifest["admission_roots"][0]["live"]}
        self.assertEqual(list(live), list(etl.LIVE_FAMILIES))
        quarantine = live["quarantine"]
        self.assertEqual(quarantine["path"], "live/canonical/quarantine/state.ndjson")
        self.assertEqual((quarantine["files_observed"], quarantine["captured_files"], quarantine["excluded_lock_files"],
                          quarantine["excluded_symlinks"], quarantine["retained_source_lines"]), (3, 3, 1, 1, [1, 2, 3]))
        self.assertEqual(quarantine["source"], "<canonical-admission>/quarantine/<state-ndjson>")
        self.assertEqual(quarantine["owner_refs_by_variant"]["pid_pair"], 3)
        self.assertEqual(quarantine["family_semantics"],
                         "reaper-quarantined dead leases moved aside by the admission reaper; not live queue or lease state")
        self.assertEqual(sum(quarantine["mtime_days"].values()), 3)
        self.assertTrue(all(re.fullmatch(r"\d{4}-\d{2}-\d{2}", day) for day in quarantine["mtime_days"]))
        rows = etl.decode_ndjson((self.outputs["fleet"] / quarantine["path"]).read_bytes(), "q")
        self.assertEqual([row["nonce"] for row in rows], [nonce for nonce, _, _ in QUARANTINE_FILES])
        self.assertTrue((self.outputs["fleet"] / "live/canonical/quarantine/state.properties").is_file())
        self.assertFalse(any(p.name.startswith("state-") for p in (self.outputs["fleet"] / "live/canonical/quarantine").iterdir()))
        emitted = self.all_emitted() + "\n".join(tree_bytes(self.outputs["fleet"])).encode()
        for name, (nonce, pid, n) in zip(QUARANTINE_NAMES, QUARANTINE_FILES):
            # The nonce is a kept join key; the file name and its pid and ordinal tail are not persisted.
            self.assertIn(nonce.encode(), emitted)
            self.assertNotIn(name.encode(), emitted)
            self.assertNotIn(f"-{pid}.lease.json.{n}".encode(), emitted)
        self.assertIn("file names and their ordinal suffixes are not persisted; the nonce they embed is kept as a join key",
                      manifest["live_state_filename_policy"])
        absent = next(entry for entry in manifest["admission_roots"][1]["live"] if entry["family"] == "quarantine")
        self.assertEqual((absent["status"], absent["mtime_days"], absent["files_observed"]), ("absent", {}, 0))

    def test_promotions_lease_fields_and_attempts_are_captured_with_custody(self):
        self.run_main()
        manifest = self.manifest()
        promotions = next(entry for entry in manifest["admission_roots"][0]["live"] if entry["family"] == "promotions")
        self.assertEqual((promotions["files_observed"], promotions["captured_files"]), (1, 1))
        row = etl.decode_json((self.outputs["fleet"] / promotions["sources"][0]["path"]).read_bytes(), "p")
        self.assertNotEqual(row["ticket"]["ownerRef"], row["lease"]["ownerRef"])
        self.assertEqual(row["ticketPath"], "<home>/.beep/runtime/beep-admit-uid-<uid>/queue/n-promo-<process>.ticket.json")
        lease = next(entry for entry in manifest["admission_roots"][0]["live"] if entry["family"] == "leases")
        lease_row = etl.decode_json((self.outputs["fleet"] / lease["sources"][0]["path"]).read_bytes(), "l")
        self.assertEqual(lease_row["hotPaths"], ["<fleet>/beep-effect-fixture/packages/a"])
        self.assertEqual(lease_row["startedAt"], "2026-10-05T12:00:00.000Z")
        payloads = b"".join(data for name, data in tree_bytes(self.outputs["fleet"]).items() if name != etl.MANIFEST_NAME)
        for token in (b"4242421", b"5151512", b"6161613", b"700007", b'"pid"', b"procStart", b"ownerPid"):
            self.assertNotIn(token, payloads)
        labels = [c["checkout"] for c in manifest["checkouts"]]
        self.assertEqual(labels, ["beep-effect-fixture", "beep-effect-fixture/.claude/worktrees/name"])
        self.assertTrue((self.outputs["fleet"] / "attempts/beep-effect-fixture%2F.claude%2Fworktrees%2Fname/feat-x-0123456789ab/attempts.ndjson").is_file())
        self.assertEqual(manifest["checkouts"][0]["proof_ledger"]["status"], "present")
        census = manifest["loss_population"]
        self.assertEqual({k: v for k, v in census["chain_counts"].items() if v},
                         {"win": 1, "withdrawn": 1, "lease-evicted": 1, "pre-v3": 1})
        ring = manifest["admission_roots"][0]["journal"]["ring_window"]
        self.assertEqual((ring["writer_cap"], ring["known_history_cap"]), (200, 2400))
        self.assertEqual(manifest["sources"][0]["ring_window"]["writer_cap"], 50)

    def test_refresh_replaces_only_its_root_and_leaves_no_staging(self):
        sibling = self.base / "pins" / "run4-ledger"
        write_files(sibling, {"MANIFEST.yaml": "sibling\n"})
        self.run_main()
        fleet, other = tree_bytes(self.outputs["fleet"]), tree_bytes(sibling)
        self.assertEqual(self.run_main("--refresh", "fleet")["fleet"]["status"], "pinned")
        self.assertNotEqual(fleet, tree_bytes(self.outputs["fleet"]))
        self.assertEqual(other, tree_bytes(sibling))
        self.assertEqual(sorted(p.name for p in (self.base / "pins").iterdir()), ["run4-fleet", "run4-ledger"])

    def test_dry_run_root_writes_only_there_and_refuses_unsafe_roots(self):
        dry = self.base / "dry"
        dry.mkdir()
        self.assertEqual(self.run_main("--dry-run-root", dry)["fleet"]["status"], "pinned")
        self.assertFalse(self.outputs["fleet"].exists())
        self.assertTrue((dry / "run4-fleet" / etl.MANIFEST_NAME).is_file())
        self.assertEqual(self.run_main("--dry-run-root", dry)["fleet"]["status"], "verified")
        self.assertEqual(self.verify_cli(dry / "run4-fleet").returncode, 0)
        for bad, message in ((Path("relative/dry"), "absolute"), (self.repo / "inside", "outside the repository"),
                             (self.repo, "outside the repository"), (self.base / "absent", "existing directory")):
            with self.subTest(bad=bad):
                (self.repo / "inside").mkdir(exist_ok=True)
                with self.assertRaisesRegex(SystemExit, message):
                    self.run_main("--dry-run-root", bad)

    def test_verify_spawns_only_allowed_git_plumbing_on_recorded_ids(self):
        self.run_main()
        manifest = self.manifest()
        recorded = (manifest["corpus_commit"], manifest["corpus_tree"], manifest["corpus_base"])
        prefix = ["git", "--no-optional-locks", "--no-replace-objects", "--no-lazy-fetch", "-C", str(self.repo)]
        before = tree_bytes(self.outputs["fleet"])
        real = subprocess.run
        calls = []

        def guarded(argv, *args, **kwargs):
            calls.append(list(argv))
            if list(argv[:6]) != prefix:
                raise AssertionError("verify spawned something other than the git plumbing prefix")
            command = list(argv[6:])
            # The object arguments: never an option, and never the object type cat-file is asked for.
            objects = [arg for arg in command[1:] if not arg.startswith("-") and arg != "blob"]
            if command[0] == "merge-base":
                allowed = command[1] == "--is-ancestor" and len(objects) == 2 and objects[1] == etl.CORPUS_REF
                objects = objects[:1]
            else:
                allowed = command[0] in ("cat-file", "rev-parse")
            if objects == [etl.CORPUS_REF + "^{commit}"] and command[0] == "rev-parse":
                objects = []
            if not allowed or not all(any(arg.startswith(identity) for identity in recorded) for arg in objects):
                raise AssertionError("git command outside the verify allowlist")
            return real(argv, *args, **kwargs)
        with patch.object(etl, "capture", side_effect=AssertionError("capture")), \
                patch.object(etl, "discover_checkouts", side_effect=AssertionError("discovery")), \
                patch.object(etl, "admission_sources", side_effect=AssertionError("admission")), \
                patch.object(etl, "read_queue_d_snapshot", side_effect=AssertionError("snapshot capture")), \
                patch.object(etl, "scan_capture_only", side_effect=AssertionError("capture-only scan")), \
                patch.object(etl.os, "urandom", side_effect=AssertionError("salt")), \
                patch.object(etl.subprocess, "run", side_effect=guarded):
            result = self.run_main()
        self.assertEqual(result["fleet"]["status"], "verified")
        self.assertTrue(any(call[6:8] == ["cat-file", "blob"] for call in calls))
        self.assertTrue(any(call[6:8] == ["merge-base", "--is-ancestor"] for call in calls))
        self.assertEqual(before, tree_bytes(self.outputs["fleet"]))

    def test_ordinary_verify_ignores_the_verifier_login_name(self):
        self.run_main()
        self.assertIn(b"runner-root-node", self.all_emitted())
        for name in ("runner", "root", "node"):
            with self.subTest(name=name), login_patch(name):
                etl.verify_output_tree(self.outputs["fleet"], "fleet")
                with self.assertRaisesRegex(SystemExit, "login name"):
                    etl.scan_capture_only(list(tree_bytes(self.outputs["fleet"]).items()))

    def test_ordinary_verify_ignores_the_verifier_host_name(self):
        self.run_main()
        emitted = self.all_emitted().lower()
        for word in {name.lower() for name in WORD_HOSTNAMES}:
            self.assertIn(word.encode(), emitted)
        files = list(tree_bytes(self.outputs["fleet"]).items())
        for name in WORD_HOSTNAMES:
            with self.subTest(name=name), patch.object(etl.socket, "gethostname", return_value=name):
                self.assertEqual(self.run_main()["fleet"]["status"], "verified")
                with self.assertRaisesRegex(SystemExit, "hostname"):
                    etl.scan_capture_only(files)
        runner = self.verify_cli_with_hostname("main")
        self.assertEqual(runner.returncode, 0, runner.stderr[-400:])

    def verify_cli_with_hostname(self, name):
        """The verify CLI in a fresh interpreter whose socket.gethostname answers ``name``."""
        shim = self.base / "hostshim"
        shim.mkdir(exist_ok=True)
        (shim / "sitecustomize.py").write_text(f"import socket\nsocket.gethostname = lambda: {name!r}\n")
        with patch.dict(os.environ, {"PYTHONPATH": str(shim)}):
            return self.verify_cli()

    def test_long_origin_keys_are_pinned_as_prefixes_and_verified(self):
        journal = self.admission / "journal.ndjson"
        rows = etl.decode_ndjson(journal.read_bytes(), "journal")
        for row in rows:
            if row["nonce"] == "n-wd":
                row["originKey"] = LONG_ORIGIN_KEY
        journal.write_bytes(etl.encode_ndjson(rows))
        promotion_file = self.admission / "promotions/n-promo.promotion.json"
        promotion = etl.decode_json(promotion_file.read_bytes(), "promotion")
        promotion["lease"]["originKey"] = LONG_ORIGIN_KEY
        promotion_file.write_bytes(etl.encode_json(promotion))
        self.run_main()
        manifest = self.manifest()
        shapes = manifest["origin_key_shapes"]
        self.assertEqual({key: shapes[key] for key in ("hex12", "hex11_prefix", "hex64", "empty")},
                         {"hex12": 2, "hex11_prefix": 3, "hex64": 0, "empty": 0})
        self.assertEqual(shapes["hex64_written_as_prefix"],
                         {"members": 3, "distinct_values": 1, "rule": etl.ORIGIN_KEY_PREFIX_RULE})
        emitted = self.all_emitted()
        self.assertNotIn(LONG_ORIGIN_KEY.encode(), emitted)
        self.assertIn(b'"originKey":"' + LONG_ORIGIN_KEY[:11].encode() + b'"', emitted)
        self.assertIn(b"originKey=" + LONG_ORIGIN_KEY[:11].encode() + b"\n", emitted)
        self.assertNotIn(LONG_ORIGIN_KEY[:12].encode(), emitted)
        # No emitted byte carries a 64-hex value under any member whose name contains "key" (the Secret Scanning shape).
        self.assertIsNone(re.search(rb'(?i)key"?\s*[:=]\s*"?[0-9a-f]{64}', emitted))
        self.assertEqual(self.verify_cli().returncode, 0)
        # The receipt's members and distinct values must equal the pinned hex11_prefix census (3 members, one
        # distinct prefix); only injectivity over the unpersisted 64-hex values stays unverifiable.
        self.assertIn("origin_key_shapes.hex64_written_as_prefix", " ".join(manifest["discovery_receipts_unverifiable"]))
        self.assert_mutations_fail_cli([(b"members: 3", b"members: 2"), (b"members: 3", b"members: 6"),
                                        (b"distinct_values: 1", b"distinct_values: 0"),
                                        (b"distinct_values: 1", b"distinct_values: 2"),
                                        (b"hex11_prefix: 3", b"hex11_prefix: 4"), (b"hex12: 2", b"hex12: 5")])

    def test_unlisted_file_fails_inventory(self):
        self.run_main()
        extra = self.outputs["fleet"] / "unlisted" / etl.MANIFEST_NAME
        extra.parent.mkdir()
        extra.write_text("unlisted fixture")
        with self.assertRaisesRegex(SystemExit, "inventory"):
            etl.verify_output_tree(self.outputs["fleet"], "fleet")

    def test_corruption_and_same_length_census_mutation_fail_cli(self):
        self.run_main()
        root = self.outputs["fleet"]
        self.assertEqual(self.verify_cli().returncode, 0)
        payload = next(root.rglob("*.properties"))
        original = payload.read_bytes()
        try:
            payload.write_bytes(original + b"corrupt=fixture\n")
            self.assertNotEqual(self.verify_cli().returncode, 0)
        finally:
            payload.write_bytes(original)
        manifest = self.manifest()
        lineage = manifest["generator_lineage"][0]["sha256"]
        head = manifest["capture_head"]
        flip = {"0": "1"}.get(lineage[0], "0")
        self.assert_mutations_fail_cli([
            (b"win: 1", b"win: 2"), (b"files_observed: 3", b"files_observed: 4"),
            (b"nonces_in_both: 1", b"nonces_in_both: 2"), (b"withdrawn: 1", b"withdrawn: 0"),
            (b"captured_files: 3", b"captured_files: 4"), (b"exit: 0", b"exit: 1"),
            (b"since_cut: 2", b"since_cut: 3"), (b"released_only_chains: 1", b"released_only_chains: 2"),
            (b"last_merged_preview_start: '2026-09-09", b"last_merged_preview_start: '2026-09-08"),
            (b"hex12: 2", b"hex12: 3"), (b"file existence only in this pin", b"file existence only in that pin"),
            (lineage.encode(), (flip + lineage[1:]).encode()), (b"- parentLaneId", b"- parentLaneIx"),
            (b"capture_head: " + head.encode(), b"capture_head: z" + head[1:].encode()), (b"value: 200", b"value: 201"),
            (b"provider sk- prefix requires", b"provider sk- prefix demands "),
            (b"reaper-quarantined dead leases", b"reaper-quarantined deaf leases")])

    def test_coherent_variant_receipt_and_aggregate_rewrite_is_rejected(self):
        emitted, metadata, _, _ = etl.capture()
        for census in (metadata["admission_roots"][0]["journal"]["owner_refs_by_variant"],
                       metadata["custody"]["owner_refs_by_variant"]):
            census["pid_pair"] -= 1
            census["ownerpid"] += 1
        with self.assertRaisesRegex(SystemExit, "variant accounting differs from pinned bytes"):
            etl.write_staged_capture(emitted, etl.finish_manifest(metadata, emitted, "fleet"), self.outputs["fleet"], "fleet")
        self.assertFalse(self.outputs["fleet"].exists())

    def test_coherent_rewrites_of_bound_members_are_rejected(self):
        cases = (
            (lambda m: m["source_facts"].pop("admitted_retention"), "source_facts differs"),
            (lambda m: m["proof_ledger"].update(observation_basis="ledger contents read"), "ledger census differs"),
            (lambda m: m["join_key_census"]["join_keys"].append("reviewLaneId"), "join-key census differs"),
            (lambda m: m["generator_lineage"][0].update(sha256="0" * 64), "generator lineage differs"),
            (lambda m: m.update(residue_rules=m["residue_rules"][:-1]), "residue_rules differs"),
            (lambda m: m["admission_roots"][0]["window"].update(released_only_chains=0), "window differs"),
            (lambda m: m["attempt_starts_by_stage"]["stages"]["merged-preview"].update(since_cut=1), "stage census differs"),
            (lambda m: m.update(last_merged_preview_start=None), "stage census differs"),
            (lambda m: m["origin_key_shapes"].update(hex64=1), "originKey shape census differs"),
            (lambda m: m["origin_key_shapes"]["hex64_written_as_prefix"].update(members=3, distinct_values=1),
             "originKey shape census differs"),
            (lambda m: m["custody"].update(salt_policy="recorded"), "custody"),
            (lambda m: m.update(capture_head="not-an-object-id"), "capture_head"))
        for mutate, message in cases:
            with self.subTest(message=message):
                emitted, metadata, _, _ = etl.capture()
                mutate(metadata)
                with self.assertRaisesRegex(SystemExit, message):
                    etl.write_staged_capture(emitted, etl.finish_manifest(metadata, emitted, "fleet"), self.outputs["fleet"], "fleet")
                self.assertFalse(self.outputs["fleet"].exists())

    def test_malformed_manifests_fail_with_one_actionable_message(self):
        self.run_main()
        target = self.outputs["fleet"] / etl.MANIFEST_NAME
        original = target.read_bytes()
        manifest = yaml.safe_load(original)
        header = b"".join(line + b"\n" for line in original.splitlines()[:2])
        cases = ((lambda m: m.pop("loss_population"), "manifest shape differs: loss_population"),
                 (lambda m: m.update(extra_member=1), "manifest shape differs: extra_member"),
                 (lambda m: m["files"][0].pop("path"), "manifest shape differs: path"),
                 (lambda m: m["files"][0].pop("sha256"), "manifest shape differs: sha256"),
                 (lambda m: m.update(files=None), "manifest shape differs: TypeError"))
        for mutate, message in cases:
            with self.subTest(message=message):
                changed = yaml.safe_load(original)
                mutate(changed)
                try:
                    target.write_bytes(header + yaml.safe_dump(changed, sort_keys=False, allow_unicode=True, width=100).encode())
                    with self.assertRaisesRegex(SystemExit, "^" + re.escape(message) + "$"):
                        etl.verify_output_tree(self.outputs["fleet"], "fleet")
                finally:
                    target.write_bytes(original)
        self.assertEqual(manifest["schema_version"], "beep-ci-ops-run4-fleet-corpus/v1")

    def test_generator_digest_and_identity_are_checked(self):
        self.run_main()
        with patch.object(etl, "manifest_schema", return_value="beep-ci-ops-run3b-fleet-corpus/v1"):
            with self.assertRaisesRegex(SystemExit, "unsupported manifest schema"):
                etl.verify_output_tree(self.outputs["fleet"], "fleet")
        with patch.object(etl, "sha256", side_effect=lambda data: hashlib.sha256(data + b"x").hexdigest()):
            with self.assertRaisesRegex(SystemExit, "generator digest differs"):
                etl.verify_output_tree(self.outputs["fleet"], "fleet")


class QuarantineEdgeTests(FixtureWorld):
    def quarantine(self, root=None):
        live = self.manifest(root)["admission_roots"][0]["live"]
        return next(entry for entry in live if entry["family"] == "quarantine")

    def test_an_empty_quarantine_directory_emits_no_payload(self):
        directory = self.admission / "quarantine"
        for path in directory.iterdir():
            path.unlink()
        self.assertEqual(self.run_main()["fleet"]["status"], "pinned")
        receipt = self.quarantine()
        self.assertEqual((receipt["status"], receipt["files_observed"], receipt["captured_files"], receipt["mtime_days"]),
                         ("excluded", 0, 0, {}))
        self.assertNotIn("path", receipt)
        self.assertFalse((self.outputs["fleet"] / "live/canonical/quarantine").exists())
        self.assertEqual(self.verify_cli().returncode, 0)

    def test_blank_undecodable_and_vanished_files_are_accounted(self):
        directory = self.admission / "quarantine"
        write_files(directory, {"0d0d0d0d-dddd-4ddd-8ddd-dddddddddddd-14.lease.json.4": "\n",
                                "0e0e0e0e-eeee-4eee-8eee-eeeeeeeeeeee-15.lease.json.5": "{not json\n"})
        vanished = directory / QUARANTINE_NAMES[1]
        real_open = open

        def flaky_open(path, *args, **kwargs):
            if Path(path) == vanished:
                raise FileNotFoundError(path)
            return real_open(path, *args, **kwargs)
        with patch.object(etl, "open", flaky_open, create=True):
            self.assertEqual(self.run_main()["fleet"]["status"], "pinned")
        receipt = self.quarantine()
        self.assertEqual({key: receipt[key] for key in ("files_observed", "vanished_before_read", "blank_files", "captured_files",
                                                        "observed_rows", "excluded_undecodable", "retained_source_lines")},
                         {"files_observed": 5, "vanished_before_read": 1, "blank_files": 1, "captured_files": 2,
                          "observed_rows": 3, "excluded_undecodable": 1, "retained_source_lines": [1, 3]})
        self.assertEqual(receipt["excluded_by_reason"], {"invalid-json": 1})
        self.assertEqual(sum(receipt["mtime_days"].values()), 4)
        self.assert_mutations_fail_cli([(b"blank_files: 1", b"blank_files: 2"),
                                        (b"vanished_before_read: 1", b"vanished_before_read: 0")])


class QueueDTests(FixtureWorld):
    def capture_fails(self, reason):
        with self.assertRaisesRegex(SystemExit, re.escape(etl.QUEUE_D_CLOSED) + ".*" + reason):
            self.run_main()
        self.assertFalse(self.outputs["fleet"].exists())

    def test_missing_projection_fails_closed(self):
        (self.repo / etl.snapshot_paths()[0]).unlink()
        self.capture_fails("absent")

    def test_digest_mismatch_against_sums_fails_closed(self):
        sums = self.repo / etl.snapshot_paths()[1]
        sums.write_text(sums.read_text().replace(etl.SNAPSHOT_SHA256, "1" * 64))
        self.capture_fails("SHA256SUMS")

    def test_digest_mismatch_against_the_pinned_constant_fails_closed(self):
        with patch.object(etl, "SNAPSHOT_SHA256", "2" * 64):
            self.capture_fails("pinned constant")

    def test_failing_check_fails_closed(self):
        (self.repo / etl.PACKET / "research/scripts/FAIL").write_text("fixture")
        self.capture_fails("--check did not pass")

    def test_wrong_row_count_fails_closed(self):
        with patch.object(etl, "SNAPSHOT_ROWS", len(self.snapshot) + 1):
            self.capture_fails("row count")

    def test_unknown_schema_row_fails_closed(self):
        rows = [*self.snapshot[:-1], {**self.snapshot[-1], "schemaVersion": "yeet-admission-journal/v9"}]
        write_files(self.repo, snapshot_files(rows))
        commit_all(self.repo, "fixture: drifted projection")
        with patch.object(etl, "SNAPSHOT_SHA256", hashlib.sha256(snapshot_bytes(rows)).hexdigest()):
            self.capture_fails("unknown schema")

    def test_projection_must_equal_the_corpus_tree_blob(self):
        rows = [*self.snapshot]
        rows[0] = {**rows[0], "enqueuedAtMillis": 999}
        write_files(self.repo, snapshot_files(rows))
        with patch.object(etl, "SNAPSHOT_SHA256", hashlib.sha256(snapshot_bytes(rows)).hexdigest()):
            self.capture_fails("differs from corpus_tree")

    def test_no_fallback_path_exists(self):
        source = etl.SCRIPT.read_text()
        self.assertEqual(source.count("run3b-fleet"), 1)
        self.assertIn('QUEUE_D_CLOSED = "Queue D fails closed; no run3b-fleet fallback"', source)

    def test_snapshot_section_is_recomputed_at_replay(self):
        self.run_main()
        manifest = self.manifest()
        section = manifest["queue_d_inputs"]["journal_snapshot_2026_10_01"]
        self.assertEqual((section["rows"], section["chain_counts"]["withdrawn"], section["chain_counts"]["in-flight"]), (3, 1, 1))
        self.assertEqual(section["check"]["command"], "python research/scripts/redact_journal_snapshot.py --check")
        self.assertEqual(section["window"], {"min": "1970-01-01T00:00:00.500Z", "max": "1970-01-01T00:00:01.000Z"})
        emitted, metadata, _, _ = etl.capture()
        metadata["queue_d_inputs"]["journal_snapshot_2026_10_01"]["chains"][0]["classification"] = "win"
        with self.assertRaisesRegex(SystemExit, re.escape(etl.QUEUE_D_CLOSED)):
            etl.write_staged_capture(emitted, etl.finish_manifest(metadata, emitted, "fleet"), self.base / "other", "fleet")


class ReconciliationTests(FixtureWorld):
    def test_identical_overlap_is_reconciled_per_source(self):
        self.run_main()
        reconciliation = self.manifest()["loss_population"]["reconciliation"]
        self.assertEqual(reconciliation["sources"], ["canonical", "snapshot-2026-10-01"])
        self.assertEqual((reconciliation["nonces_in_both"], reconciliation["rows_identical_on_non_surrogate_members"],
                          reconciliation["conflicts"]), (1, 1, 0))
        self.assertEqual(reconciliation["class_transitions"], {"in-flight->win": 1})

    def test_conflicting_overlap_fails_capture_closed(self):
        rows = [{**self.snapshot[0], "branch": "other"}, *self.snapshot[1:]]
        write_files(self.repo, snapshot_files(rows))
        commit_all(self.repo, "fixture: conflicting projection")
        with patch.object(etl, "SNAPSHOT_SHA256", hashlib.sha256(snapshot_bytes(rows)).hexdigest()):
            with self.assertRaisesRegex(SystemExit, "conflicting rows"):
                self.run_main()
        self.assertFalse(self.outputs["fleet"].exists())

    def test_surrogates_and_checkout_members_are_not_compared(self):
        live = [{"nonce": "n", "_tag": "admission-enqueued", "ownerRef": "aaaaaaaaaaaa", "checkoutRoot": "<fleet>/x", "branch": "b"}]
        snapshot = [{"_tag": "admission-enqueued", "branch": "b", "checkoutRef": "cccccccccccc", "nonce": "n", "ownerRef": "bbbbbbbbbbbb"}]
        result = etl.reconcile_sources(live, snapshot, [{"root": "canonical", "nonce": "n", "classification": "in-flight"}])
        self.assertEqual((result["conflicts"], result["rows_identical_on_non_surrogate_members"]), (0, 1))
        result = etl.reconcile_sources([{**live[0], "branch": "c"}], snapshot, [])
        self.assertEqual(result["conflicts"], 1)

    def test_origin_key_is_compared_in_its_written_form(self):
        live = [{"nonce": "n", "_tag": "admission-enqueued", "originKey": LONG_ORIGIN_KEY[:11], "branch": "b"}]
        snapshot = [{"_tag": "admission-enqueued", "branch": "b", "nonce": "n", "originKey": LONG_ORIGIN_KEY}]
        result = etl.reconcile_sources(live, snapshot, [])
        self.assertEqual((result["conflicts"], result["rows_identical_on_non_surrogate_members"]), (0, 1))
        result = etl.reconcile_sources([{**live[0], "originKey": ORIGIN_KEY}], snapshot, [])
        self.assertEqual(result["conflicts"], 1)
        result = etl.reconcile_sources([{**live[0], "originKey": LONG_ORIGIN_KEY[:12]}], snapshot, [])
        self.assertEqual(result["conflicts"], 1)


if __name__ == "__main__":
    unittest.main()
