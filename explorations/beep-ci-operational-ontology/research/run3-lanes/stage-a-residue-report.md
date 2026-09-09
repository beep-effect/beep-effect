# Run-3 Stage A residue remediation report

## Residue remediation (Ruling 22, 2026-09-09)

The lane amends `etl_run3_fleet_corpus.py` and refreshes `run3-fleet/` under
Ruling 22, on `ontology-run3-stage-b-fixes`, starting at
`9aed9e8b36ac467259b7d1dbcdb96c02d06cf936`. The Stage B review-fix commits remain its ancestors.
The final pin uses a fresh capture instant and 32 fresh random salt bytes. Salt is
hex-encoded only in the custody hash input, never persisted, printed, or returned.

## Changes and regression coverage

F1 copies Stage B's normalized process-member predicate, per-object custody,
property eligibility, and JSON/property member scan. Removing `_` and `-`, then
lowercasing, identifies keys ending in `pid` or containing `procstart` or
`processstart`; legacy `processId` protection remains. Each object mints from its
own identity before removal. Pair precedence is `pid`/`procStart`,
`ownerPid`/`ownerProcStart`, then `attachedPid`/`<absent>`. Start-only and other
variants use the same sorted normalized identity-object fallback as Stage B.
Null, empty, and missing starts count as weak keys. Drop counters normalize names.

F3 copies Stage B's complete string redactor and residue scanner. Every host root
requires the shared left boundary outside `[A-Za-z0-9_.~/-]` and a right boundary.
Relative `packages/workspace/`, `packages/home/`, and similar paths survive;
absolute roots and roots in command arguments rewrite and fail verification if
left raw. Generic UID text and process-bearing state/preview filenames receive
Stage B's existing protections. Synthetic aliases are absent from Stage A's API.

The non-identity allowlist contains `failedstepid` and `stepid`. This is a required
correction to an assumption in the Stage B report: both normalize to names ending
in `pid`, but they identify execution steps. Deployed source citations are
`packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:592`
(`failedStepId: S.optionalKey(S.String)`) and `ProofState.ts:51` (`stepId: S.String`).
`Handler.ts:1475` derives the failed identifier from an execution's `step.id`.
The first interim refresh dropped 1,862 `failedStepId` members, reduced the rider
to 36 occurrences, and still passed built-in verification. The final allowlist
preserves these execution joins and their property projections.

The fleet-root helper also mirrors Stage B: a sibling `*-worktrees/<lane>`
checkout discovers from the common fleet parent, as a direct clone does. No
cross-generator import or shared ETL library was introduced. Capture families,
retention rules, envelope handling, rider logic, source facts, and source ordering
remain the Stage A implementation.

**25 generator tests pass.** Added coverage includes the six mirrored Stage B
variant/boundary cases, deployed process-schema coverage, benign string values,
escaped JSON keys, precedence, nested attached identities, weak and unpaired
identities, step-ID preservation through the failure rider, generic UID/state
filenames, lineage forgery rejection, and per-source/aggregate variant tampering.
The old corruption test now operates on disposable copies for both Stage A
modules, so the checkout-identity pin stays read-only during testing.

## Final pin and custody evidence

The final capture starts `2026-09-09T06:09:24.473Z` and finishes
`2026-09-09T06:09:32.388Z` (UTC). It covers 22 clones and
73 linked worktrees, 95 checkouts total.
The pin has **1,914 payloads / 1,915 files**, including
one deterministic `.properties` projection per raw payload, **7,863 source
records**, 15,953,615 payload bytes, and 18,738,757 bytes including the manifest.
Excluded undecodable rows/files: 0. Observed proof ledgers: 0.

| Raw family | Files | Source records |
| --- | ---: | ---: |
| admission | 2 | 287 |
| attempts | 360 | 6981 |
| live | 4 | 4 |
| verdict | 591 | 591 |

| pid pair | owner pair | attached identity | Other identities | Weak start keys |
| ---: | ---: | ---: | ---: | ---: |
| 291 | 235 | 2 | 0 | 123 |

Total minted owner references: 528. The per-source variant counts
sum to the manifest custody census and to retained `ownerRef` occurrences. Variant
identity and weak-key counts are capture observations; raw members and salt cannot
be recovered at replay. The verifier checks variant keys, nonnegative integer
counts, per-source sums, aggregate sums, and weak-key bounds.

Frozen generator SHA-256:
`7d711673d80791ce2aa1c9a1d1d8da6e1ff1867a55962806355fdf44ffd378e3`.

Amended generator SHA-256:
`a428cf71b8c385d5cba7430aa755b0d7fe579b131976587ee83475cba6e6785e`.

Whole-tree SHA-256, including the manifest:
`798be15c800daf3a163bf011ddcdbd61c2e5baf4d826b1705b38b64a9ad1794f`.

Previous committed fleet whole-tree SHA-256:
`c9b8a20bf095bf1e47a5629ae8b02c34ef6c6138650fdda63120c9e17438385b`.

Tree hashes sort relative POSIX file names. For each file, hash its UTF-8 name and
contents, each preceded by its length as an 8-byte big-endian unsigned integer.
The generator lineage records both generator digests, Ruling 22, and the exact
required reason after YAML decoding.

Final serial verify → corrupted byte → restore exits: **0 → 1 → 0**.
Restoration reproduced the complete pre-corruption tree hash. The corruption
appended `corrupted=fixture` to one fleet `.properties` payload and restored its
original bytes in `finally`; the failure was a SHA-256/byte-count mismatch.

The full built-in scan passed names and contents. Both independent scans below
returned exit 1 with **empty output**. A separate scan found **zero hostname or
SHA-12 hostname matches**, without printing those values.

```sh
packet=explorations/beep-ci-operational-ontology
corpus="$packet/ontology/extraction/s4/beep-ci-ops/corpus"
grep -rlE 'attachedPid|ownerProcStart|ownerPid|"pid"' "$corpus/run3-fleet"
rg -l --pcre2 '(?<![A-Za-z0-9_.~/-])(?:/home/|/tmp/|/run/user/|/proc/|/dev/shm/|~/.beep/runtime)|\buid-[0-9]+|\bpid[ =:]?[0-9]+' \
  "$corpus/run3-fleet"
```

The required lineage reason names the removed fields as prose. Its YAML scalar
uses `\u0050` for their capital P so the exact decoded value and the literal grep
requirement both hold. No payload member is hidden this way: the process-member
scanner decodes escaped JSON keys, with a rejecting regression.

## Admission census and riders

| Root | Schema | Tag | Rows |
| --- | --- | --- | ---: |
| canonical | yeet-admission-journal/v1 | admission-admitted | 121 |
| canonical | yeet-admission-journal/v1 | admission-released | 103 |
| canonical | yeet-admission-journal/v2 | admission-lease-evicted | 1 |
| canonical | yeet-admission-journal/v3 | admission-enqueued | 28 |
| canonical | yeet-admission-journal/v3 | admission-lease-evicted | 4 |
| canonical | yeet-admission-journal/v3 | admission-released | 10 |
| canonical | yeet-admission-journal/v3 | admission-ticket-evicted | 2 |
| canonical | yeet-admission-journal/v3 | admission-withdrawn | 16 |
| system-tmp | none | none | 0 |
| session-tmp | yeet-admission-journal/v1 | admission-admitted | 1 |
| session-tmp | yeet-admission-journal/v1 | admission-released | 1 |

Failure-signature rider: **1898 structured occurrences**, retaining
`failureKind` with `failedStepId`; the previous committed pin had
1869. The cache-plan execution rider remains absent, with zero structured
occurrences. Proof-ledger issuance remains re-parked to run 4 under Ruling 17.

Original Stage A source-fact prose, including prospective v3 wording and Stage B
ledger ownership, is retained per the brief's scope. It describes that stage's
design assumptions; the census above records the v3 rows actually captured now.
The original Stage A report and earlier refresh appendix remain historical.
This refresh does not synchronize the frozen checkout-identity capture instant.

## Validation and protected bytes

- Packet validator: **0 blockers, 0 warnings**; 26 CQs and 25 SPARQL files parsed.
- CQ suite: **0 failures across 25 seed tests and 20 fixtures**. Existing golden
  coverage remains limited; this does not claim run-3 ontology ratification.
- No workspace package was edited; package verification is not applicable.
- Eight copied redaction/discovery functions were compared against Stage B's AST,
  accounting for its synthetic-alias arguments. Their implementations match.
- Baseline byte hashes and Git status confirm all protected paths are unchanged.

| Protected generator | SHA-256 |
| --- | --- |
| `etl_fleet_corpus.py` | `2b6fb03d818986fffcbc8951ec43b6b63dfb0d302c3a3c5a7ba45ecb7777e424` |
| `etl_run3_checkout_identity.py` | `bc3dbfb84ab802f8a25b8e3b7532856b00729ec76671c001934f4265c1705d39` |
| `etl_run3b_fleet_corpus.py` | `901e1e9399879bd29564f4dea79c9903bafeb67656ec8cd269fe265d8b03728f` |

Protected trees: `run2-fleet/`, `run3-checkout-identity/`, `run3b-fleet/`, and
`run3b-synthetic/`. `DECISIONS.md` is unchanged. No S5/S6/S7/S8 work occurred.

Commands use the trusted lane's existing offline dependencies:

```sh
packet=explorations/beep-ci-operational-ontology
corpus="$packet/ontology/extraction/s4/beep-ci-ops/corpus"
export UV_CACHE_DIR=~/.cache/beep/uv-cache
uv run --offline --with pyyaml python -m unittest discover -s "$corpus" -p test_run3_generators.py
uv run --offline --with pyyaml python "$corpus/etl_run3_fleet_corpus.py" --refresh
uv run --offline --with pyyaml python "$corpus/etl_run3_fleet_corpus.py"
uv run --offline --with pyyaml,rdflib python "$packet/research/scripts/validate_packet.py"
uv run --offline --with pyoxigraph python "$packet/research/scripts/run_cq_suite.py"
```

The final execution order was refresh, the complete generator suite, then serial
ordinary/corrupt/restored verification and independent residue scans.

## Deviations and handoff

1. The explicit non-identity allowlist is populated with two deployed execution
   fields; Stage B's empty list could not preserve Stage A's required rider.
   The protected Stage B generator still has the empty list. Fable should assess
   the same collision there separately; no Stage B byte was changed here.
2. The complete Stage B string redactor also removes generic UID text. The second
   interim pin passed built-in verification but failed the independent UID scan
   in 30 files, covering 315 JSON message leaves. Two interim pins were discarded;
   only the final refreshed pin is committed.
3. YAML escapes reconcile the mandated lineage reason with the literal grep,
   with decoded-value and escaped-member regressions. The new friction receipts
   record this conflict, the step-ID collision, and the narrower legacy UID scan.
   The existing Stage B allowlist-drift receipt was not duplicated.
4. The sibling-worktree fleet-root fix preserves the intended fleet scope. The
   ordinary verifier still makes no Git probes, live-source reads, or salt calls.
5. Post-commit proof used a detached checkout under this lane's ignored
   `.beep/stage-a-residue/`, with the trusted lane's Python interpreter. No full
   checkout goes under `/tmp`; no mise trust state changes.

The implementation and this report are committed by explicit path with the
brief's requested commit message. A documentation follow-up records the actual
implementation SHA, detached committed-head verification, tracked payload/path
counts, and post-commit `bun run beep knowledge refs --check` result. Fable owns
review and publication. This lane never pushes or opens a PR.

## Committed-head verification

Implementation commit: `7fd350b4796222ae1bd7d4d6699238cb6fc384ff`.

```text
fix(explorations): refresh the Stage A fleet pin under the amended generator
```

Explicit-path staging committed 142 files. The index contained every manifest
payload and exactly one manifest. Biome, gitleaks, typos, and commitlint hooks
passed; Biome made no changes. The commit body records Ruling 22 and both full
generator digests, with every body line shorter than 100 characters.

A detached worktree at that exact commit under this lane's ignored `.beep/`
verified the generator with the trusted lane's Python interpreter. Ordinary
verification exited **0**, without a refresh flag, live capture, or mise trust
change. The detached checkout was clean and was removed after the check.

| Tracked payloads | Manifest payloads | All tracked files | Missing | Extra |
| ---: | ---: | ---: | ---: | ---: |
| 1914 | 1914 | 1915 | 0 | 0 |

The detached path set and whole-tree SHA-256 exactly match the final capture
above. `bun run beep knowledge refs --check` passed at the implementation commit
with **zero live gated observations**.

This documentation follow-up records the completed committed-head proof.
Final HEAD receives the same detached verification and post-commit knowledge
reference check before handoff. It changes no generator or pin bytes. The final
handoff identifies this documentation commit separately. No push or PR creation
occurred.

## Reconciliation with #1032 (2026-09-09)

Merged main at `6b4720f1fb` with merge commit `5e02f8c04b2448fe4ff49bab4e898841b481c0e5`.
Both quoted/escaped PID redaction and the prior member/custody/path rules survive.
The combined suite passes 58 tests; all five pins verify with their own generators.
The three refreshed pins pass exact corruption/restore proof and empty residue scans.
Stage B now preserves source-cited step identifiers and both termination joins.
The manifest census uses `pid_pair` so a numeric count cannot resemble PID text.

| Pin | Payloads | All files | Events | Payload bytes | All bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| `run3-fleet` | 1914 | 1915 | 7869 | 15954039 | 18743097 |

| Pin | Whole-tree SHA-256, including manifest |
| --- | --- |
| `run3-fleet` | `9a5a9fbfc0d926334523f065ba0c9a28f5565bf22d08597e33c908e40a5da1c7` |

`run3-fleet` generator SHA-256: `55caab8d26e55e00854737b476388bbb189d393a8855da3d86fa1a7eb82b0228`.
Capture: `2026-09-09T06:27:59.082Z` through `2026-09-09T06:28:10.478Z`.

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

The failure rider now has **1899 structured occurrences**: 1863 same-object
`failedStepId`/`failureKind` pairs plus 36 other classified occurrences. The
prior 1898 was 1862 plus 36; the new capture adds one pair. All 1863 property
projections retain the key. The cache-plan rider remains absent.

All final counts supersede the historical capture counts above. Both organic
captures cover 94 checkouts. The full digest lineage, manifest decision, source
citations, inherited run-2 diagnostic limit, and committed-head proof are in
[the reconciliation report](./reconcile-1032-report.md). DECISIONS.md was not edited.

The refresh is committed as `c61b4aed9ce89738b0d43d29c5554d38681fa955`. At that exact commit,
all five ordinary generator checks passed in a clean detached worktree; tracked
inventories and whole-tree hashes match, and every generator digest has committed
provenance. Post-commit `bun run beep knowledge refs --check` passed with zero
live gated observations. The documentation follow-up receives the same final-HEAD
proof before handoff. No generator or pin bytes change in this follow-up.
