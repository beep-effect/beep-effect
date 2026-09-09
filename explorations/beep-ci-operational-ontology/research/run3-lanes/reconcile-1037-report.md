# Run-3 reconciliation with #1037 and the file-URI boundary

## Status and scope

Step 0 and the merge are committed. All three required captures are refreshed
in this worktree, all five ordinary pin verifiers pass, and the three corruption
cycles pass with exact restoration. Final handoff is pending the decisions
below; the re-pin commit and its detached verification are not yet complete.

The lane is `ontology-run3-stage-b-fixes` in the requested
`stage-b-review-fixes` worktree. No push or PR mutation occurred. The lane did
not edit `DECISIONS.md` or run ontology ratification.

| Commit | Purpose |
| --- | --- |
| `bbfe7c50fa42e570490e6baeac6e5716978202d2` | Step 0, file-URI code and tests only |
| `515dfc41e6938f5340b053b545cee5bf8beb536b` | Merge main after #1037 |

The merge's parents are the Step 0 commit and main
`22063e7b6dbb6e63adcf0b080b397fcb350712b7`. It is a merge commit, not a rebase.
Source/citation commit for all three new captures is `515dfc41e6`.

## Decisions still required

1. The requested Ruling 23 is absent. The starting worktree ends at Ruling 22;
   fetched main ends at Ruling 21. The lane read Ruling 22, asked for the missing
   text, and has not authored a replacement ruling.
2. The brief assigns `goals/codex-security-findings-2026-09-08/**` to main.
   Its exact repair script loses this branch's Stage A lineage preservation.
   The retained regression fails with `generator lineage differs`. A 15-line
   additive patch preserves main's required finding attribution and repair
   history, validates the source lineage, and emits one updated lineage block.
   It passes the repair-history regression in an isolated module substitution.
   The proposed patch is in the lane's ignored
   `.beep/reconcile-1037/lineage-compat.patch`; it has not been applied to the
   main-owned script. The operator was asked to permit this narrow exception.
3. Live captures changed the historical failure-pair totals by one in each
   organic population. The operator was asked to accept the source deltas
   documented below. The literal unchanged-total requirement is not met.

## Step 0 and merge resolution

Both generators use `PATH_LEFT_BOUNDARY` to accept a root following a slash
whose preceding character is slash or colon. Redaction and residue scanning
share that rule, including the literal home, temp, proc, and shared-memory
roots. `file:///home/alice/x` becomes `file://<home>/x`;
`file:///proc/123/status` becomes `file://<proc>/<process>/status`.
Relative continuations such as `packages/workspace/x` remain unchanged.
The tests also cover fleet-root URIs, runtime roots, path-name scanning,
idempotence, and synthetic aliases. All 60 pre-merge tests passed.

Step 0's generator SHA-256 values were
`8ac270d5ea0703636070e2f29ac28109a4753ef538e9d91bfd57022f9612bc8c`
for Stage A and
`afd1d1f2ed363f8906d85e21ef04d0c4cd2ec573b66a6508f69828d00afcfa27`
for Stage B.

The initial dirty Stage A manifest was an incomplete URI-only generator replay
attributed to CSF-012. Its patch was preserved under the ignored lane receipt
directory and the committed manifest restored before Step 0. Step 0 did not
repair or recapture a pin.

The merge retained the normalized process-member rules, custody precedence,
URI-aware boundaries, termination joins, lineage, and every parent test. It
added #1037's process-metadata text scan, legacy escaped-member/property tests,
and explicit `--finding` requirement before source replay. The test-name union
contains 34 Stage A/shared tests and 29 Stage B tests, with none missing.

Two combined-contract adjustments belong to the merged generators. The count
bucket `attachedpid` is now `attached_identity`, because the former YAML label
matches #1037's text scanner. The process-member spelling, custody hash inputs,
precedence, totals, and scanner are unchanged. Ambiguous normalized members
still fail salted captures. Unsalted security replay drops every such member
without trying to choose an owner identity.

The complete run-2 and checkout-identity trees and their generators match main
byte-for-byte. The security goal subtree also matches main exactly. The other
three pins matched our first parent when the merge was committed and were then
refreshed. Main's report changes and this branch's packet text survive the merge.

## Fresh captures and security history

`finish_manifest` in `etl_run3_fleet_corpus.py:608` and
`etl_run3b_fleet_corpus.py:620` constructs a fresh manifest, including the
generator self-pin, capture/source metadata, payload digests, verification
entries, and fixed-point byte totals. It does not copy an earlier manifest's
`security_resanitization` block.

By contrast, `repair` in
`goals/codex-security-findings-2026-09-08/research/scripts/resanitize-corpora.py:70`
reads a saved or committed pin. Its record at line 142 has explicit finding
attribution, a source-manifest digest, changed raw payload count, and
`live_recapture: false`. Lines 146-151 retain the first receipt, append later
updates, and record a superseded digest for source replay. The CLI requires
`--finding` at line 188. URI-only maintenance has no matching finding choice.

These pins used the brief's required `--refresh` route. Copying old repair
receipts onto new captures would assert the wrong operation. Run-2 and identity
retain their CSF-012 originals and separate CSF-013 updates in their manifests.
For the refreshed populations, those original receipts remain in the merged
main commit and its security packet. The historical digests and full receipt
blocks below preserve the boundary between repaired old captures and new ones.

| Pin | Main manifest SHA-256 | Main generator SHA-256 |
| --- | --- | --- |
| run2-fleet | `15776b69b2af00fe34cc9a6d06ad7523861736dc209802a9e106ac39b891b77f` | `d1f1d0dad1561e167bd169ce75c51928848262515f5124f0c95dcee9a6c882af` |
| run3-checkout-identity | `0cf5e1066e0dcf3e4690ea222a77dec2f3103ac73e65afcdcae891dc32c75eac` | `322bddb51a8e923157eacec946f3bc430542f4687fc7851750922e07f581772e` |
| run3-fleet | `516c86e6d5b1fd86bb067d614fc24d6fb91f7f7ad41e0221e418e6346b980fbe` | `1764671686951ef9001f0788399be557d35cc5da6a2542099ce5a72bf605b782` |
| run3b-fleet | `6852c72a89959385028e50e9e0f2fa9b4165961a1af1c73e4c5d9c5cc77a1d30` | `3a2c28b5fa064e19ee5c9cde687b5e48995b8a89cfa3ca589e6825cee88a6b9c` |
| run3b-synthetic | `92612a2225256c56dd7451d9fa61cd47ee14cf1d38ed62dd037331f7621b9062` | `3a2c28b5fa064e19ee5c9cde687b5e48995b8a89cfa3ca589e6825cee88a6b9c` |

The following is historical main evidence at `22063e7b6d`, not metadata of
the new captures.

```json
{
  "run2-fleet": {
    "finding": "CSF-012",
    "source_manifest_sha256": "be2144da427e7f9671d386713fb4a34e52246bb8702b586e9de4eb3b74880dc3",
    "changed_raw_payloads": 12,
    "live_recapture": false,
    "superseded_manifest_sha256": "3683a1657a44e0c2e018a68daef57d18fdd2c73d2b86b09bdf57d4b510c5b3b3",
    "updates": [
      {
        "finding": "CSF-013",
        "source_manifest_sha256": "ad14e0ee438e4863be14809185be474e59f478d072c42e2bf5b3b1730de20433",
        "changed_raw_payloads": 0,
        "live_recapture": false
      },
      {
        "finding": "CSF-013",
        "source_manifest_sha256": "a4fe8370fdd6972cfdcf5c6c4959346be4fca002da6c1a3ac34cbf8a4452a66b",
        "changed_raw_payloads": 0,
        "live_recapture": false
      }
    ]
  },
  "run3-checkout-identity": {
    "finding": "CSF-012",
    "source_manifest_sha256": "2792b7e4d3d7e9763a1a8c6e93040dd2d2e2b4951bba94025099f2a196c39a29",
    "changed_raw_payloads": 0,
    "live_recapture": false,
    "superseded_manifest_sha256": "ba83ff7128d8bc499908e18f1095ee55d0b0f3e47e7ab23f2482092091a5ae83",
    "updates": [
      {
        "finding": "CSF-013",
        "source_manifest_sha256": "38cb05dcfecc99bee6c378b5ab3d0f3699bd1be410c6e55296fe526aa9f3c479",
        "changed_raw_payloads": 0,
        "live_recapture": false
      }
    ]
  },
  "run3-fleet": {
    "finding": "CSF-012",
    "source_manifest_sha256": "91d9cdcc717f440ed3a442688b7f1a0915ccb009dc090e9b0b2a6b444e44f3f9",
    "changed_raw_payloads": 12,
    "live_recapture": false,
    "superseded_manifest_sha256": "391ce13f0bea8b81ec2f6257d0c5a0d291b18718cdc0862e5f75e118418cfaf2",
    "updates": [
      {
        "finding": "CSF-013",
        "source_manifest_sha256": "d1c29cb0807fc22e5a2445f6b326f4d7d6e269da4cc098803d7c9671c5614365",
        "changed_raw_payloads": 26,
        "live_recapture": false
      }
    ]
  },
  "run3b-fleet": {
    "finding": "CSF-012",
    "source_manifest_sha256": "740dddef3a0d93f3132cf2ad8fb7ac871781e7e42df6fb3c1d6ccab162c4f7ac",
    "changed_raw_payloads": 11,
    "live_recapture": false,
    "updates": [
      {
        "finding": "CSF-012",
        "source_manifest_sha256": "57dc5593a79927da996171de64f5222175cdedff2d210eac787718c1dff440e4",
        "changed_raw_payloads": 0,
        "live_recapture": false
      },
      {
        "finding": "CSF-013",
        "source_manifest_sha256": "75f71cafd47ec5069cd8a3dfe8186951e6729ce025c219a58c60b67361d8a3e6",
        "changed_raw_payloads": 32,
        "live_recapture": false
      }
    ]
  },
  "run3b-synthetic": {
    "finding": "CSF-012",
    "source_manifest_sha256": "f2848655daf251fa77f1d32046ec15f0684977531d5dd69593b1cc55571d99b3",
    "changed_raw_payloads": 0,
    "live_recapture": false,
    "updates": [
      {
        "finding": "CSF-012",
        "source_manifest_sha256": "c2568ec5be2bb4545cc7803de4838ed920c175a3b9cdc5b85377f2d8dca73bcb",
        "changed_raw_payloads": 0,
        "live_recapture": false
      },
      {
        "finding": "CSF-013",
        "source_manifest_sha256": "070003b1b4f07cf7249174f1315f91bd3569072ef6750d9cfa8c80eea71f1813",
        "changed_raw_payloads": 0,
        "live_recapture": false
      }
    ]
  }
}
```

## Capture receipts and digests

Both organic captures observed 22 clones and 73 linked worktrees, 95 checkouts
in total. They are interval observations, not atomic fleet snapshots.

| Pin | Capture start UTC | Capture finish UTC |
| --- | --- | --- |
| run3-fleet | 2026-09-09T07:02:37.836Z | 2026-09-09T07:02:49.615Z |
| run3b-fleet | 2026-09-09T07:04:00.500Z | 2026-09-09T07:04:09.042Z |
| run3b-synthetic | 2026-09-09T07:05:05.987Z | 2026-09-09T07:05:06.068Z |

| Pin | Payload files | All files | Events | Payload bytes | All bytes |
| --- | --- | --- | --- | --- | --- |
| run2-fleet | 1588 | 1589 | 6213 | 12679246 | 13317275 |
| run3-checkout-identity | 216 | 217 | 108 | 694899 | 894958 |
| run3-fleet | 1924 | 1925 | 7913 | 16022296 | 18829797 |
| run3b-fleet | 742 | 743 | 7323 | 14501112 | 15831343 |
| run3b-synthetic | 8 | 9 | 10 | 6575 | 42347 |

| Pin | Generator SHA-256 | Manifest SHA-256 |
| --- | --- | --- |
| run2-fleet | `d1f1d0dad1561e167bd169ce75c51928848262515f5124f0c95dcee9a6c882af` | `15776b69b2af00fe34cc9a6d06ad7523861736dc209802a9e106ac39b891b77f` |
| run3-checkout-identity | `322bddb51a8e923157eacec946f3bc430542f4687fc7851750922e07f581772e` | `0cf5e1066e0dcf3e4690ea222a77dec2f3103ac73e65afcdcae891dc32c75eac` |
| run3-fleet | `f7742383faef22e342cf758de3978bcdad51e2f0be14acdbaa26da5ed173fada` | `228874960cb97eef11e32f7f45c6325e095296ca7f7a98aedc2e3a3553a555dd` |
| run3b-fleet | `1d0646bd2203fff7d54357abae95cfd3896c5ad10a68af86c1fa770c775f8972` | `f9c8d41f60dedde87687191f0d9fd54715e7f2d04eb2954320f0b22ecf5629b8` |
| run3b-synthetic | `1d0646bd2203fff7d54357abae95cfd3896c5ad10a68af86c1fa770c775f8972` | `5b5046241e2ced76bb93b01d1fbcd1e7693a73796a375cee993e3f40e2dbf83d` |

| Pin | Whole-tree SHA-256 including manifest |
| --- | --- |
| run2-fleet | `d6290ad5311f411ac8b77b4ad93a90bd359b239e444e784b9b47c61fe1aecd3b` |
| run3-checkout-identity | `88bec9ddde3f4984bf2be774b62dc6edd7214b4700f98087ab8229048b268387` |
| run3-fleet | `f6ebd62047b14dc45b39181d8d7abe6ae6ef67aa8bc0eece7237d444544dadb4` |
| run3b-fleet | `3d2991bdb7616585e39b0e9912ef42f9f5d8ffd0a65625c7b5354d4081bf7e7e` |
| run3b-synthetic | `085597f36b0245e69be492cc32508d7995c239dc860fd8a27ad010b7b9363095` |

Tree hashing uses sorted relative POSIX names. Each UTF-8 name and its file
bytes are prefixed with an unsigned 8-byte big-endian length before SHA-256
accumulation. The manifest is included.

The synthetic root was read without mutation. READY was present and producer
SHA-256 `0ee8d157ffce4a113ab1b2acc4e1c598a098f491c67850fd6071009dd9c5f983`
matches the tree-resident spec. Both termination joins pass generator replay.
Synthetic payload bytes remain 6575; capture metadata and custody salts changed.

## Failure-pair preservation and live deltas

| Population | Previous raw pairs | Fresh raw pairs | Fresh property pairs |
| --- | --- | --- | --- |
| run3-fleet | 1863 | 1864 | 1864 |
| run3b-fleet | 1753 | 1754 | 1754 |
| run3b-synthetic | 0 | 0 | 0 |

Every fresh raw `failedStepId` has a nonempty `failureKind` in the same object.
Raw and projected pair counts agree. Stage A's complete rider census is 1900:
1864 failure pairs and 36 other classified occurrences. The cache-plan rider
is absent, and proof-ledger issuance remains re-parked to run 4.

The changed raw paths, relative to each pin, are:

| Pin | Raw path | Previous pairs | Fresh pairs |
| --- | --- | --- | --- |
| run3-fleet | `attempts/beep-effect13/codex_inline-schema-final-evidence-c4b83ff69b1e/attempts.ndjson` | 0 | 1 |
| run3-fleet | `verdicts/beep-effect12/codex_security-corpus-process-metadata-44c5e00b442f/verdict.json` | 1 | 0 |
| run3-fleet | `verdicts/beep-effect13/codex_inline-schema-final-evidence-c4b83ff69b1e/verdict.json` | 0 | 1 |
| run3b-fleet | `attempts/beep-effect13/codex_inline-schema-final-evidence-c4b83ff69b1e/attempts.ndjson` | 0 | 1 |

The new attempt appears in both populations. Stage A also observes that
branch's latest failed verdict and a replacement latest verdict for the
security-corpus branch. These deltas come from live source changes. The lane
has not deleted rows to reproduce the old totals.

## Verification completed before the re-pin commit

- All four ordinary generator CLIs exited 0, covering all five pins.
- All three refreshed pins passed corruption cycles 0 -> 1 -> 0. The selected
  property bytes were restored in `finally`, and each final whole-tree digest
  equals its pre-corruption digest. Capture and corruption work were serial.
- All five pins have zero quoted/escaped numeric PID matches, zero process-
  metadata assignment matches, zero `file://` matches, and zero literal variant
  matches in payloads. All three refreshed pins also have zero literal variant
  matches in manifests, zero normalized process-member residue, and zero host,
  UID, hostname, or hostname-digest residue in names and contents.
- Main's run-2 manifest has two literal process-name mentions in its rule
  descriptions. Its broader host/UID and hostname diagnostics retain the same
  612 and 313 inherited matches recorded in the previous report. Run-2 passes
  its own main-owned scanner unchanged. These broader run-2 diagnostics are not
  claimed empty. Checkout identity also passes the broader diagnostics.
- Packet validator: 0 blockers, 0 warnings; 26 CQs and 25 SPARQL files parsed.
- CQ suite: 0 failures across 25 seed tests and 20 fixtures. This does not
  expand the previously recorded golden antecedent coverage or ratify run 3.
- The final real generator-suite result and the proposed-patch comparison are
  recorded in the follow-up below. The main-owned repair regression remains
  a required gate until the scope exception is settled.

The fleet-only Stage B refresh promoted its verified fleet output, then
rejected the old synthetic manifest's census label. The subsequent synthetic
refresh verified fleet and pinned synthetic. Final ordinary verification and
corruption proofs ran only after all captures completed.

Commands used from the trusted lane:

```sh
packet=explorations/beep-ci-operational-ontology
corpus="$packet/ontology/extraction/s4/beep-ci-ops/corpus"
export UV_CACHE_DIR=~/.cache/beep/uv-cache
uv run --offline --with pyyaml python "$corpus/etl_run3_fleet_corpus.py" --refresh
uv run --offline --with pyyaml python "$corpus/etl_run3b_fleet_corpus.py" --refresh fleet
uv run --offline --with pyyaml python "$corpus/etl_run3b_fleet_corpus.py" \
  --refresh synthetic --synthetic-root ~/.cache/beep/ciops-synthetic-root
uv run --offline --with pyyaml python "$corpus/etl_fleet_corpus.py"
uv run --offline --with pyyaml python "$corpus/etl_run3_checkout_identity.py"
uv run --offline --with pyyaml python "$corpus/etl_run3_fleet_corpus.py"
uv run --offline --with pyyaml python "$corpus/etl_run3b_fleet_corpus.py"
uv run --offline --with pyyaml python -m unittest discover -s "$corpus" -p 'test_run3*.py'
uv run --offline --with pyyaml,rdflib python "$packet/research/scripts/validate_packet.py"
uv run --offline --with pyoxigraph python "$packet/research/scripts/run_cq_suite.py"
```

The remaining committed-head proof is the re-pin commit, a detached worktree
at that commit with all five ordinary verifiers and exact tracked inventories,
reachable generator provenance, and `bun run beep knowledge refs --check`
after commit. These are pending; no merge-ready or hosted acceptance claim is
made. Fable retains review and publication ownership.

## Test comparison and post-merge reference check

After all refresh and corruption work completed, the actual merged tree ran
63 tests in 51.323 seconds: 62 passed and the Stage A committed-repair lineage
regression errored. Its failure is `generator lineage differs: generator_lineage`.
No test was skipped, removed, or weakened to clear that failure.

A separate run substituted only the proposed repair-script module at import
time, leaving the main-owned file unchanged. All 63 tests passed in 51.532
seconds. This proves the proposed patch against the complete suites; it is
not evidence that the actual tree is green.

`bun run beep knowledge refs --check` exited 0 after merge commit `515dfc41e6`.
That check precedes the pending re-pin commit; the final committed-head check
will still need to run after that commit.

## Staged handoff inventory

The reviewed re-pin and bookkeeping changes are staged by explicit path, with
226 changed paths. No `git add -A` was used. The staged inventories exactly
match each manifest: Stage A 1924 payloads plus its manifest, Stage B fleet
742 plus its manifest, and synthetic 8 plus its manifest. There are no missing
or extra staged payloads. The main-owned security subtree remains identical
to `22063e7b6d`; DECISIONS.md remains identical to the starting worktree.

The requested final commit message remains
`fix(explorations): re-pin the refreshed corpora after the CSF-013 merge`.
It has not been created because the actual tree still has the lineage test
error and the brief's missing-ruling/count requirements need clarification.
The proposed patch and complete verification receipts remain under the ignored
`.beep/reconcile-1037/` directory for continuation in this same worktree.

## Review fixes, round 2 (2026-09-09)

All seven findings are addressed under the round-2 brief and its clarifications.
The earlier pending questions in this report are superseded: Ruling 22 applies,
live capture deltas are accepted, and the lineage patch is already committed.
This lane commits locally on `ontology-run3-stage-b-fixes`; Fable retains PR
review and publication. No push, PR operation, or ratification is part of this work.

| Finding | Verdict, change, and regression evidence |
| --- | --- |
| C1 | Confirmed fixed. Both suites retain `test_file_uri_host_roots_preserve_scheme_and_reject_raw_residue`, covering URI redaction, scanning, and idempotence. |
| C2 | Fixed. Historical security replay explicitly records `custody.census_migration.legacy: true` and the same migration in its security receipt. Such captures predate payload-bound variants, so their historical variant tallies are not asserted as byte-derived. Total surrogate counts still verify. Both committed-history tests replay a source receipt missing `owner_refs_by_variant` and payloads missing `ownerRefVariant`, including the `--source-ref` path. |
| C3 | Fixed. Each refreshed manifest records capture HEAD (`corpus_commit`), its tree (`corpus_tree`), and merge-base with `origin/main` (`corpus_base`). Replay resolves repository file/line citations in the current checkout and validates recorded anchors without reading the capture commit. Both suites exercise an unavailable capture SHA and reject missing files, wrong lines, and wrong anchors. |
| C4 | Fixed. The inherited numeric rule only handled `pid`; the metadata rule rejected some variants without rewriting serialized values. Both generators now share `PROCESS_MEMBER_PATTERN` between structural detection and `PID_IN_TEXT`, with `redact_pid_match` preserving punctuation and escaping. Both suites cover numeric and quoted variant values through four escaping depths, single quotes, bare assignments, parseability, residue rejection, and idempotence. |
| C5 | Fixed. Identifier tokens replace normalized suffix matching: exact pid/ppid, camel Pid boundaries, separated pid tokens, corresponding start tokens, and the existing processId protection. `rapid`, `cupid`, `lipid`, `stepId`, and `failedStepId` survive redaction/projection. Both suites retain source-derived schema oracles and cover owner, attached, legacy-lock, and Claude identities. |
| C6 | Fixed. Every synthetic input must retain every observed row with zero undecodable exclusions. Capture and replay enforce the rule. The malformed contender journal regression uses `{bad json` and proves no synthetic pin is emitted. |
| C7 | Fixed. Every minted surrogate carries object-local `ownerRefVariant` with pid_pair, ownerpid, attachedpid, or weak. Replay recomputes per-source variant counts and the aggregate from raw payloads and compares the receipts. Both suites test payload binding; Stage B additionally rejects a coordinated per-source/aggregate reassignment with valid byte totals. |

The shared matcher, replacement callback, custody census/migration helpers, and
citation functions have identical syntax trees in Stage A and Stage B. The
custody salt, precedence, and ownerRef hash inputs remain the existing capture
contract. `weak` names the fallback identity variant; missing start values also
retain their separate weaker-reference count. Count labels now end in `_count`
or use `owner_refs_without_start`, avoiding process-token syntax. Historical
replay migrates those old count labels explicitly.

The source-derived oracle covers RunScope.schemas.ts:126, AttemptJournal.ts:57-58,
AttemptTerminationJournal.ts:125-126, AdmissionJournal.ts, and
QualityScheduler.schemas.ts. It also checks Provenance.ts:1134 (`claudePid`) and
AdmissionJournal.ts:777 (`legacyLockOwnerPid`, a parser symbol rather than a schema field).

### Capture provenance convention

All three refreshed pins record:

```text
corpus_commit: 34aa58b96bf06b7d7681165dd6cf84cd6b668365
corpus_tree:   da556e0526c1f412c85ef6e91462db5a5a98a47e
corpus_base:   22063e7b6dbb6e63adcf0b080b397fcb350712b7
```

The tree above belongs to capture HEAD, as required by `HEAD^{tree}`; the final
generator is identified separately by its self-pinned digest below. This is not
a claim that the final pin bytes were already present in capture HEAD. The
captured source-file SHA remains historical provenance; replay checks the
current file, line, and recorded anchor, allowing unrelated later file edits.
Stage A now records anchors as Stage B already did. Historical Stage A citations
without an anchor still require an existing current file and in-range line.
Angle-bracket fleet/export descriptors identify observed inputs rather than
repository code. The S6 POLICY adoption opportunity is recorded in
`research/OPPORTUNITIES.md`; no ruling or policy ratification was authored.

### Final captures and hashes

Each population was captured once under the final generators. Stage B used
`--refresh all --synthetic-root ~/.cache/beep/ciops-synthetic-root`, avoiding
a temporary check against an old sibling pin. The producer export was read
without mutation; READY, producer digest, and both termination joins pass.

| Pin | Capture start UTC | Capture finish UTC |
| --- | --- | --- |
| run3-fleet | 2026-09-09T07:29:26.731Z | 2026-09-09T07:29:35.472Z |
| run3b-fleet | 2026-09-09T07:30:06.129Z | 2026-09-09T07:30:14.138Z |
| run3b-synthetic | 2026-09-09T07:30:38.422Z | 2026-09-09T07:30:38.510Z |

| Pin | Payloads | All files | Events | Payload bytes | All bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| run2-fleet | 1588 | 1589 | 6213 | 12679246 | 13317275 |
| run3-checkout-identity | 216 | 217 | 108 | 694899 | 894958 |
| run3-fleet | 1918 | 1919 | 7931 | 16133003 | 18932716 |
| run3b-fleet | 734 | 735 | 7339 | 14573775 | 15897847 |
| run3b-synthetic | 8 | 9 | 10 | 6953 | 42793 |

| Pin | Generator SHA-256 | Manifest SHA-256 |
| --- | --- | --- |
| run2-fleet | `d1f1d0dad1561e167bd169ce75c51928848262515f5124f0c95dcee9a6c882af` | `15776b69b2af00fe34cc9a6d06ad7523861736dc209802a9e106ac39b891b77f` |
| run3-checkout-identity | `322bddb51a8e923157eacec946f3bc430542f4687fc7851750922e07f581772e` | `0cf5e1066e0dcf3e4690ea222a77dec2f3103ac73e65afcdcae891dc32c75eac` |
| run3-fleet | `08027618ad32e3ac23c26d147a097325b962751b767f706e86560724e92e9394` | `ab546771916784845f07e486756cc21eeb90fdee2b229dad36da922f5eb98209` |
| run3b-fleet | `980d50e290a211e0238dded4aa85e4e99405cf8bbcc7f44509ef7d775bd3edc9` | `51528694b8c301b0df4d756ca2ef027f923d0718473ff0984a444ae4544dda1b` |
| run3b-synthetic | `980d50e290a211e0238dded4aa85e4e99405cf8bbcc7f44509ef7d775bd3edc9` | `ec3e7627bd9fbe8553958a94ce3968b676a67e2e33f9fc942fb8455371aaf726` |

Whole-tree hashes include the manifest, using the length-prefixed, sorted
POSIX-name/file-byte algorithm documented earlier in this report.

| Pin | Whole-tree SHA-256 |
| --- | --- |
| run2-fleet | `d6290ad5311f411ac8b77b4ad93a90bd359b239e444e784b9b47c61fe1aecd3b` |
| run3-checkout-identity | `88bec9ddde3f4984bf2be774b62dc6edd7214b4700f98087ab8229048b268387` |
| run3-fleet | `df7b95a9fbf0f514300f34e6481f368cf9221bc11e7bdf6094d8b44cb9831dc2` |
| run3b-fleet | `85b0830b403db48c826c907340f3ef3e4117750ba118577601b10322d084a536` |
| run3b-synthetic | `c307338c165142d36036e8703233f860b953064d49cb5bd2d9559ab4ebf5944d` |

Both organic captures observed 22 clones and 73 linked worktrees (95 checkouts).
These are interval observations. Compared with the preceding captures, Stage A
has six fewer payloads and 18 more events; Stage B fleet has eight fewer payloads
and 16 more events. The synthetic ten-event scenario is unchanged; its payload
bytes increase from 6575 to 6953 because the custody variant is now persisted.

| Population | Previous failure pairs | Fresh raw pairs | Fresh projected pairs |
| --- | ---: | ---: | ---: |
| run3-fleet | 1864 | 1865 | 1865 |
| run3b-fleet | 1754 | 1755 | 1755 |
| run3b-synthetic | 0 | 0 | 0 |

Every raw `failedStepId` has `failureKind` in the same object. The organic
increases are accepted live traffic; rows were not removed to manufacture old
counts. Proof-ledger issuance remains re-parked to run 4.

| Population | pid_pair | ownerpid | attachedpid | weak | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| run3-fleet | 319 | 247 | 2 | 0 | 568 |
| run3b-fleet | 319 | 247 | 2 | 0 | 568 |
| run3b-synthetic | 7 | 0 | 0 | 0 | 7 |

### Verification and handoff

- All five pins pass ordinary verification through their four generator CLIs.
- All three refreshed pins pass corruption cycles 0 -> 1 -> 0 with exact
  whole-tree restoration. Captures and corruption cycles ran serially.
- The three refreshed pins have zero structural process-member residue,
  unredacted serialized process values, literal variant matches, quoted/escaped
  numeric PID matches, file-URI residue, host paths, UID residue, hostnames, or
  hostname digests in names and contents.
- Run-2 and checkout identity pass their unchanged scanners. Run-2 retains its
  two manifest rule mentions and inherited broader diagnostics (612 host/UID
  and 313 hostname/hash matches); those older diagnostics are not claimed empty.
- Packet validator: 0 blockers, 0 warnings; 26 CQs and 25 SPARQL files parsed.
- CQ suite: 0 failures across 25 seed tests and 20 fixtures. This does not
  expand golden antecedent coverage or ratify run 3.
- DECISIONS.md, run2-fleet, run3-checkout-identity, and their generators remain
  byte-identical to the starting HEAD. No workspace package was edited.
  Package verification is not applicable; this is the specified corpus/packet
  proof, not full Yeet or hosted PR acceptance.

The complete generator suites pass: **73 tests in 52.964 seconds**, with all
34 Stage A/shared and 29 Stage B parent tests retained, plus 10 new tests.
The detached committed-head proof and post-commit knowledge-reference check run
after this commit; their exact-HEAD receipts are retained in the local directory
below and reported in the lane handoff.
Local command logs and machine-readable checks are in the ignored
`.beep/review-fixes-2/` receipt directory.

```sh
packet=explorations/beep-ci-operational-ontology
corpus="$packet/ontology/extraction/s4/beep-ci-ops/corpus"
export UV_CACHE_DIR=~/.cache/beep/uv-cache
uv run --offline --with pyyaml python "$corpus/etl_run3_fleet_corpus.py" --refresh
uv run --offline --with pyyaml python "$corpus/etl_run3b_fleet_corpus.py" \
  --refresh all --synthetic-root ~/.cache/beep/ciops-synthetic-root
uv run --offline --with pyyaml python "$corpus/etl_fleet_corpus.py"
uv run --offline --with pyyaml python "$corpus/etl_run3_checkout_identity.py"
uv run --offline --with pyyaml python "$corpus/etl_run3_fleet_corpus.py"
uv run --offline --with pyyaml python "$corpus/etl_run3b_fleet_corpus.py"
uv run --offline --with pyyaml python -m unittest discover -s "$corpus" -p 'test_run3*.py'
uv run --offline --with pyyaml,rdflib python "$packet/research/scripts/validate_packet.py"
uv run --offline --with pyoxigraph python "$packet/research/scripts/run_cq_suite.py"
bun run beep knowledge refs --check
```
