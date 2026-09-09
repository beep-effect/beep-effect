# Run-3 Stage B review-fix report

## Review fixes (2026-09-09)

This follow-up starts at merged PR #1034, `86990e28f9ac4960ded80172b388eac58989ca7b`,
on `ontology-run3-stage-b-fixes`. The updated Stage B generator and both refreshed
pins implement F1, F3, and F4. F2 remains a non-defect under Ruling 21.

### Findings, changes, and regressions

- **F1, held P1:** one normalized key rule now governs recursive redaction,
  `.properties` eligibility, and JSON/property residue checks. Removing `_` and
  `-`, then lowercasing, identifies keys ending in `pid` or containing `procstart`
  or `processstart`. The previous explicit `processId` protection is retained.
  The non-identity allowlist is empty; no captured non-identity exception was found.
  The scanner distinguishes JSON member names from strings and scans only the
  assignment key in `.properties` payloads. Benign value words survive.
- Custody is minted before dropping members, independently for each nested
  object. Precedence is `pid`/`procStart`, `ownerPid`/`ownerProcStart`, then
  `attachedPid`/`<absent>`. Missing, null, and empty starts count as weak keys.
  Other identities, including start-only objects, use the manifest's documented
  deterministic fallback and a separate `other` tally. Salt is fresh, random,
  capture-local, and unrecorded. Drop-counter keys use normalized spelling.
- F1 regressions cover a lease's nested `runScope.attachedPid`, an attempt row
  with `ownerPid` and numeric `ownerProcStart`, local precedence, normalization,
  unpaired identities, weak starts, both residue formats, escaped JSON member
  names, and benign value strings. A source regression extracts schema members
  from the deployed writers and asserts every `Pid`/`ProcStart` name is covered.
- **F3, held portability:** all host-root replacements and scans, including
  generic home/tmp, runtime/proc/shm, and synthetic aliases, require the same
  left boundary: start or a character outside `[A-Za-z0-9_.~/-]`. Tests patch the
  fleet root to `/workspace`: `packages/workspace/use-cases/x.test.ts` survives,
  `/workspace/beep-effect/x` rewrites to `<fleet>/beep-effect/x`, and raw absolute
  paths fail the scan. The same checks cover relative `packages/home/`, tmp,
  runtime, proc, shared memory, bare roots, and command delimiters.
- **F4, held evidence completeness:** both dead labels require exactly one
  `attempts.ndjson`. Each must have exactly one `attempt-terminated` row with
  the correct reason and the same nonempty `attemptId` as its checkout's matching
  eviction row. The manifest records `termination_join`, recomputed at replay
  from pinned bytes. Tests reject absent/duplicate journals, missing/duplicate
  termination rows, mismatched IDs, wrong reasons, forged join receipts, and a
  coherently removed pinned journal. Contender A allows an absent or empty
  journal and rejects a nonempty one.
- **F2, not a defect:** the producer remains in PR #1033, open at head
  `717c37bf57ba43dbf402183a659de708172941b2` when checked through the GitHub API.
  The consumer imports that head's READY export; the spec is not vendored.
  Fable must refresh synthetic again if the producer changes before merge.

Deployed source citations use stable needles, as required by the brief:

| Source under `packages/tooling/tool/cli/src/` | Needle | Evidence |
| --- | --- | --- |
| `internal/repo-run/RunScope.schemas.ts` | `attachedPid: S.Int` | Nested lease scope attachment identity |
| `commands/Yeet/internal/AttemptJournal.ts` | `ownerPid: S.Finite` and `ownerProcStart: S.String` | Attempt-start identity pair |
| `internal/repo-run/AttemptTerminationJournal.ts` | `ownerPid: S.Finite` and `ownerProcStart: S.String` | Retained attempt-start identity pair |
| `internal/repo-run/QualityScheduler.schemas.ts` | `const admissionOwnerFields =` with `pid: S.Finite` and `procStart: S.String` | Shared ticket/lease ownership, nested in claims |

### Refreshed pins

Counts describe the final captures below. Historical counts earlier in the Stage B
report still describe the merged pin, not this replacement. Payload counts include
projections; all-file counts add the manifest; events count raw records once.

| Population | Capture start UTC | Capture finish UTC | Payloads | All files | Events | Bytes |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| fleet | 2026-09-09T05:41:49.476Z | 2026-09-09T05:41:57.005Z | 732 | 733 | 7251 | 15690519 |
| synthetic | 2026-09-09T05:40:20.643Z | 2026-09-09T05:40:20.736Z | 8 | 9 | 10 | 42222 |

| Population | Raw family | Files | Events |
| --- | --- | ---: | ---: |
| fleet | admission | 2 | 275 |
| fleet | attempts | 359 | 6971 |
| fleet | live | 4 | 4 |
| fleet | protocol | 1 | 1 |
| synthetic | admission | 1 | 7 |
| synthetic | attempts | 2 | 2 |
| synthetic | protocol | 1 | 1 |

Fleet inventory: 22 clones and 72 linked worktrees. Observed fleet ledgers: 0; Ruling 17 remains re-parked to run 4.

Whole-tree SHA-256 includes every file, including the manifest, in sorted relative
POSIX-name order. Each name and content is prefixed by its length as an 8-byte
big-endian integer.

- `run3b-fleet`: `ab8ddcb66b726d39f6be387a14e41d27beff69c7e64fa9a7850a0b3491af2750`.
- `run3b-synthetic`: `6007045d3604c9d4a5a197bea888e72127a9034005a99cc9bb889459d301ca10`.

Generator SHA-256: `901e1e9399879bd29564f4dea79c9903bafeb67656ec8cd269fe265d8b03728f`.
Source/citation commit: `86990e28f9ac4960ded80172b388eac58989ca7b`.

| Population | pid pair | owner pair | attached identity | Other identities | Weak start keys |
| --- | ---: | ---: | ---: | ---: | ---: |
| fleet | 279 | 231 | 2 | 1750 | 1870 |
| synthetic | 7 | 0 | 0 | 0 | 3 |

Variant tallies are capture observations because dropped source members and salt
cannot be recovered. Replay checks each tally's integer bounds, its sum against
retained `ownerRef` occurrences, and the aggregate against source receipts.

### Refreshed loss-population census

| Population | Root | Schema | Tag | Rows |
| --- | --- | --- | --- | ---: |
| fleet | canonical | yeet-admission-journal/v1 | admission-admitted | 118 |
| fleet | canonical | yeet-admission-journal/v1 | admission-released | 101 |
| fleet | canonical | yeet-admission-journal/v2 | admission-lease-evicted | 1 |
| fleet | canonical | yeet-admission-journal/v3 | admission-enqueued | 25 |
| fleet | canonical | yeet-admission-journal/v3 | admission-lease-evicted | 4 |
| fleet | canonical | yeet-admission-journal/v3 | admission-released | 9 |
| fleet | canonical | yeet-admission-journal/v3 | admission-ticket-evicted | 2 |
| fleet | canonical | yeet-admission-journal/v3 | admission-withdrawn | 13 |
| fleet | system-tmp | none | none | 0 |
| fleet | session-tmp | yeet-admission-journal/v1 | admission-admitted | 1 |
| fleet | session-tmp | yeet-admission-journal/v1 | admission-released | 1 |
| synthetic | synthetic | yeet-admission-journal/v1 | admission-admitted | 1 |
| synthetic | synthetic | yeet-admission-journal/v3 | admission-enqueued | 2 |
| synthetic | synthetic | yeet-admission-journal/v3 | admission-lease-evicted | 1 |
| synthetic | synthetic | yeet-admission-journal/v3 | admission-released | 1 |
| synthetic | synthetic | yeet-admission-journal/v3 | admission-ticket-evicted | 1 |
| synthetic | synthetic | yeet-admission-journal/v3 | admission-withdrawn | 1 |

| Population | win | withdrawn | lease-evicted | ticket-evicted | in-flight | pre-v3 | unclassified |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fleet | 9 | 13 | 5 | 2 | 3 | 103 | 0 |
| synthetic | 1 | 1 | 1 | 1 | 0 | 0 | 0 |

fleet heartbeat check: `{"checked_rows": 4, "legacy_rows_without_heartbeat": 1, "rule": "lastHeartbeatAtMillis <= evictedAtMillis", "violations": 0}`.

synthetic heartbeat check: `{"checked_rows": 1, "legacy_rows_without_heartbeat": 0, "rule": "lastHeartbeatAtMillis <= evictedAtMillis", "violations": 0}`.

Replay recomputes full per-root/per-nonce chains and the census. Wait and hold
arithmetic remain outside the pin. Below-cap windows do not prove complete history.

### Synthetic producer and termination joins

Producer path: `packages/tooling/tool/cli/test/quality-scheduler-synthetic-scenario.test.ts`.
Producer SHA-256: `0ee8d157ffce4a113ab1b2acc4e1c598a098f491c67850fd6071009dd9c5f983`.
Original `scenario.json` SHA-256: `e6d73f1aba551198a31d29a69cb87e6bf91f14e03cce7eeaff70cb2d16b531c3`.
READY was present. The export was read without mutation.

```json
{
  "dead-lease": {
    "journal_path": "attempts/dead-lease/feat_synthetic-dead-lease-f004a5320ab9/attempts.ndjson",
    "attemptId": "b4e72342-45a5-4a1b-95db-5ab4ef30a93f",
    "attemptId_match": true,
    "reason": "lease-eviction"
  },
  "dead-ticket": {
    "journal_path": "attempts/dead-ticket/feat_synthetic-dead-ticket-7e2dab5a5a8b/attempts.ndjson",
    "attemptId": "a2fdba81-945f-4f44-8d93-6f71f706d5cd",
    "attemptId_match": true,
    "reason": "queued-submitter-death"
  }
}
```

### Verification and residue proof

- Generator regression suite: **26 tests pass**, all 14 existing tests plus
  12 additional tests. This includes the direct-clone/sibling-worktree fleet-root
  regression discovered during capture.
- Packet validator: **0 blockers, 0 warnings**, 26 CQs and 25 SPARQL files parsed.
- CQ suite: **0 failures across 25 seed tests and 20 fixtures**. Existing golden
  coverage remains 1/25 status-covered with no populated golden antecedent.
- No workspace package was edited; package verification is not applicable.
- Final `--refresh fleet` and `--refresh synthetic --synthetic-root` both exit 0.
  The first attempt to migrate the fleet correctly rejected the old sibling's
  generator digest. Both final pins now share the updated self-pin.

| Pin | Ordinary verify | Corrupted byte | Restored verify | Whole-tree restoration |
| --- | ---: | ---: | ---: | --- |
| fleet | 0 | 1 | 0 | exact |
| synthetic | 0 | 1 | 0 | exact |

Each corruption appended a fixture assignment to one `.properties` payload and
restored the original bytes in `finally`. Ordinary CLI verification runs both pins.
The serial final exercise passed with equal before/after whole-tree hashes.
The full built-in scanner passed names and contents across both pins.

Commands run from the trusted lane:

```sh
packet=explorations/beep-ci-operational-ontology
corpus="$packet/ontology/extraction/s4/beep-ci-ops/corpus"
export UV_CACHE_DIR=~/.cache/beep/uv-cache
uv run --offline --with pyyaml python -m unittest discover -s "$corpus" -p test_run3b_generator.py
uv run --offline --with pyyaml python "$corpus/etl_run3b_fleet_corpus.py" --refresh fleet
uv run --offline --with pyyaml python "$corpus/etl_run3b_fleet_corpus.py" \
  --refresh synthetic --synthetic-root ~/.cache/beep/ciops-synthetic-root
uv run --offline --with pyyaml python "$corpus/etl_run3b_fleet_corpus.py"
uv run --offline --with pyyaml,rdflib python "$packet/research/scripts/validate_packet.py"
uv run --offline --with pyoxigraph python "$packet/research/scripts/run_cq_suite.py"
grep -rlE 'attachedPid|ownerProcStart|ownerPid|"pid"' "$corpus/run3b-fleet" "$corpus/run3b-synthetic"
rg -l --pcre2 '(?<![A-Za-z0-9_.~/-])(?:/home/|/tmp/|/run/user/|/proc/|/dev/shm/|~/.beep/runtime)|\buid-[0-9]+|\bpid[ =:]?[0-9]+' \
  "$corpus/run3b-fleet" "$corpus/run3b-synthetic"
```

Both independent residue commands produced **empty output** (exit 1, no matches).
A separate Python names/content scan found zero hostname or SHA-12 hostname
matches without printing those values. JSON/property member variants also pass
the rule-based built-in scan, which covers normalized future names.

### Frozen bytes

| Generator | SHA-256 |
| --- | --- |
| `etl_fleet_corpus.py` | `2b6fb03d818986fffcbc8951ec43b6b63dfb0d302c3a3c5a7ba45ecb7777e424` |
| `etl_run3_fleet_corpus.py` | `7d711673d80791ce2aa1c9a1d1d8da6e1ff1867a55962806355fdf44ffd378e3` |
| `etl_run3_checkout_identity.py` | `bc3dbfb84ab802f8a25b8e3b7532856b00729ec76671c001934f4265c1705d39` |

All three match the brief. `git status` is empty under the three frozen generators,
`run2-fleet/`, `run3-fleet/`, and `run3-checkout-identity/`. `DECISIONS.md`, `ATLAS.md`,
and extraction S5/S6/S7 remain unchanged. The Stage A `run3-fleet/` pin still has
**52 files containing `ownerProcStart`**, confirmed by a filename-only scan.
Remediation belongs to a separate steward ruling; this lane does not change it.

### Deviations and remaining work

1. The relocated lane exposed a pre-existing fleet-root assumption. Its initial
   temporary capture found zero checkouts and had 16 payloads. A pure path rule
   now recognizes sibling `*-worktrees/<lane>` placement, with a regression for
   both layouts. That capture was discarded and replaced from the full fleet.
2. A final fleet refresh overlapped the first corruption proof because the check
   process had not exited. Its mixed-generation digest failure was discarded.
   The reported proof was rerun serially after the final refresh completed.
3. The complete `every object` custody requirement includes start-only and future
   identity variants. The manifest documents the `other` fallback; the three
   required pairs retain their specified precedence. Normalized drop-counter
   names avoid retaining the reviewed camel-case field spellings in manifests.
4. Graft wiring had no graph; a scoped deterministic build restored it. SSH
   remote inspection failed on system proxy-config permissions. The read-only
   GitHub API confirmed main and the producer head without configuration changes.
5. Detached verification uses this checkout's ignored `.beep/` area, matching
   the previous lane's proof layout and the instruction to work only here.
   It uses the trusted lane's Python interpreter and changes no mise trust state.
6. The implementation report is committed with the fix. A documentation follow-up
   records its actual commit SHA and post-commit proof. Fable owns publication;
   this lane does not push, open a PR, or edit the producer spec.

PR #1033 remains the producer dependency. The frozen Stage A residue needs its own
ruling. Proof-ledger issuance remains re-parked to run 4; run 3 proper stays with
Fable and the steward.

### Committed-head verification

Implementation commit: `e014152c4b62a6547b86f43127d753b696c25291`.

```text
fix(explorations): redact process-identity variants and harden the Stage B pins
```

The brief, generator, tests, both pins, report, and packet bookkeeping are in that
commit. Biome, gitleaks, typos, and commitlint hooks passed; Biome changed no files.

A detached worktree was created from that exact commit under the lane's ignored
`.beep/stage-b-review-fixes/` directory. The trusted lane's offline PyYAML process
remained alive while `sys.executable` ran the committed generator in the detached
checkout. No refresh flag, synthetic-root path, live capture, or mise trust change
was used. Ordinary verification exited **0** for both pins.

| Pin | Tracked payloads | Manifest payloads | All tracked files | Missing | Extra |
| --- | ---: | ---: | ---: | ---: | ---: |
| fleet | 732 | 732 | 733 | 0 | 0 |
| synthetic | 8 | 8 | 9 | 0 | 0 |

Exact path sets and whole-tree digests match the final capture hashes above.
The detached worktree was clean and was removed after verification.

- `bun run beep knowledge refs --check`: exit 0; zero live gated observations.
- `bun run beep knowledge semantic-delta`: exit 0; zero introduced findings,
  zero resolved findings, 491 unchanged inherited findings.
- `bun run beep laws effect-imports --mode markdown --check`: exit 0, dry-run;
  925 files and 310 fences scanned. The 13 suggested files and two parser warnings
  are inherited and outside this lane's changed paths. No rewrites were applied.

This documentation follow-up records the implementation SHA and its post-commit
proof. It changes no generator or pin bytes. Ordinary detached verification and
knowledge references are rerun at final HEAD before handoff; the final handoff
identifies the documentation commit separately. No push or PR creation occurred.
The three pre-existing Graft wiring edits remain outside both commits.

## Reconciliation with #1032 (2026-09-09)

Merged main at `6b4720f1fb` with merge commit `5e02f8c04b2448fe4ff49bab4e898841b481c0e5`.
Both quoted/escaped PID redaction and the prior member/custody/path rules survive.
The combined suite passes 58 tests; all five pins verify with their own generators.
The three refreshed pins pass exact corruption/restore proof and empty residue scans.
Stage B now preserves source-cited step identifiers and both termination joins.
The manifest census uses `pid_pair` so a numeric count cannot resemble PID text.

| Pin | Payloads | All files | Events | Payload bytes | All bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| `run3b-fleet` | 734 | 735 | 7279 | 14434276 | 15750040 |
| `run3b-synthetic` | 8 | 9 | 10 | 6575 | 42272 |

| Pin | Whole-tree SHA-256, including manifest |
| --- | --- |
| `run3b-fleet` | `61b7876a421beee0a8a8b5b666e3639e9376b55bed1886ddce53c098e1b5598e` |
| `run3b-synthetic` | `de37d475e20490a03ed6f59f9ad549562992fb65c569c8a1987e171d4e3a8ef5` |

`run3b-fleet` generator SHA-256: `fceff631402bd828f12c199543c29d90ae1c1cec78be824982d684a0579b9bcb`.
Capture: `2026-09-09T06:27:03.151Z` through `2026-09-09T06:27:12.950Z`.

`run3b-synthetic` generator SHA-256: `fceff631402bd828f12c199543c29d90ae1c1cec78be824982d684a0579b9bcb`.
Capture: `2026-09-09T06:28:00.131Z` through `2026-09-09T06:28:00.282Z`.

Fresh capture calls `finish_manifest` in `etl_run3_fleet_corpus.py:600`
and `etl_run3b_fleet_corpus.py:613`. It emits SHA-256 receipts, the payload-only
`integrity` scope, three PASS entries in `verification`, and fixed-point byte
`totals`. It does **not** emit `security_resanitization`: that block describes
an in-place, non-recapture repair, and is added by
`goals/codex-security-findings-2026-09-08/research/scripts/resanitize-corpora.py:138`.
Copying it into a fresh capture would misstate provenance. Run-2 and identity
retain main's repair blocks unchanged. Stage A retains its validated Ruling 22
`generator_lineage`; both Stage B populations share the new generator self-pin.
The prior and current generator/manifest digests below retain the refresh history.

The refreshed fleet restores **1753 same-object `failedStepId`/`failureKind`
pairs**, with 1753 property pairs. The pre-reconciliation branch pin had zero;
main had 1746 before this live refresh. Synthetic has zero such verdict pairs.

All final counts supersede the historical capture counts above. Both organic
captures cover 94 checkouts. The full digest lineage, manifest decision, source
citations, inherited run-2 diagnostic limit, and committed-head proof are in
[the reconciliation report](./reconcile-1032-report.md). DECISIONS.md was not edited.
