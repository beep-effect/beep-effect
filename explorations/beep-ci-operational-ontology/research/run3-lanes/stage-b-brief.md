# Run-3 lane brief — Stage B corpus generator (loss population + synthetic scenario)

Lane: Codex (`gpt-6-astra`, xhigh) implementing; Fable designed this brief, reviews, and
publishes. Steward: Benjamin. Rulings implemented: **8** (Stage B of the staged capture),
**9** (v3 event set), **10** (synthetic scenario, labeled), **11** (custody surrogate),
**17** (proof-ledger issuance rows RE-PARKED to run 4 — record it, do not capture a
ledger), **18** (new sibling generator, both run-3 generators frozen), **19** (ingest the
spec's export via `--synthetic-root`), **20** (capture live at the END of your work),
**21** (this is PR-2; the spec is PR-1 on another branch). Read `DECISIONS.md` sections
"run-3 corpora design grill" and "Stage B capture grill" in full first.

Work happens in THIS checkout (`~/YeeBois/projects/beep-effect8-s5`, branch
`ontology-run3-stage-b`, based on origin/main `d1b4d769fb`). Commit on the branch (stage by
path); **do not push, do not open a PR** — Fable publishes. `DECISIONS.md`, the two briefs,
the handoff file and the `OPPORTUNITIES.md` receipts are already committed by Fable: do not
edit `DECISIONS.md`; append your own receipts to `research/OPPORTUNITIES.md`.

## Read first

- `research/run3-lanes/stage-a-brief.md`, `stage-a-report.md`, and the
  `stage-a-review-fixes-{brief,report}.md` pair (the mechanics, the gotchas, the fixes that
  held: percent-encoded single-segment checkout labels, receipt-bound verify, runtime/proc/
  shm/uid redaction classes, whole-tree hashes, Biome pin exclusions).
- `ontology/extraction/s4/beep-ci-ops/corpus/etl_run3_fleet_corpus.py` — copy its patterns;
  it is byte-frozen (sha256 `7d711673d80791ce2aa1c9a1d1d8da6e1ff1867a55962806355fdf44ffd378e3`,
  pinned in `run3-fleet/MANIFEST.yaml`). Never import it, never edit it. Same for
  `etl_run3_checkout_identity.py` (`bc3dbfb84ab802f8a25b8e3b7532856b00729ec76671c001934f4265c1705d39`)
  and the run-2 `etl_fleet_corpus.py` (`2b6fb03d818986fffcbc8951ec43b6b63dfb0d302c3a3c5a7ba45ecb7777e424`).
- `test_run3_generators.py` (mirror its structure in a sibling test file).
- Deployed sources to cite (by needle, never by line number — lines are stale by design):
  `packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts` (v3 classes for
  `admission-enqueued`, `admission-withdrawn`, v3 `admission-released`,
  `admission-lease-evicted` with `lastHeartbeatAtMillis`, `admission-ticket-evicted`;
  `AdmissionProtocol` `yeet-admission-protocol/v2`; `PROTOCOL_FILE_NAME`; the retained
  admissions and known-history caps), `QualityScheduler.ts` (`AdmissionClaimSinkState`,
  `.reap.pending-protocol-off.json`, `admissionEventForReapClaim`, `processReapClaim`,
  `reapAdmissionState`), `QualityScheduler.schemas.ts` (claim/lease/ticket schemas),
  `RuntimeRoot.ts`, `AttemptTerminationJournal.ts` (`lease-eviction`,
  `queued-submitter-death`, `RETAINED_ATTEMPTS`).
- `goals/time-to-certainty/PLAN.md` — the C2 line "not yet wired into any lane" is the
  Ruling 17 evidence you cite.

## Live facts at brief time (2026-09-08 late, this workstation)

- Protocol marker published: `<canonical-admission>/protocol.json` =
  `yeet-admission-protocol/v2`, eviction `on`.
- Canonical journal: 222 rows — 199 v1, 1 v2, 22 v3 (10 `admission-enqueued`, 3
  `admission-withdrawn`, 3 v3 `admission-released`, 4 `admission-lease-evicted`, 2
  `admission-ticket-evicted`). Ring: 200 admitted transitions; known-history cap 2,400 rows.
  Session-tmp root: check; legacy system-tmp root: expected absent (receipt either way).
- Claims dir: no pending claims (one stale `.reap.json.lock.stage-*` sidecar may exist —
  lock sidecars are NEVER captured).
- Seven checkouts are v3 writers; most of the fleet is pre-v3. Attempts ring: 50 terminal
  attempts per branch.
- Proof ledger: absent everywhere and WILL stay absent (Ruling 17). No `ledger/` family.
- The synthetic export from the PR-1 lane lands at `~/.cache/beep/ciops-synthetic-root/`
  with a `READY` marker written last; its layout is `admission/`, `checkouts/<label>/.beep/
  yeet/runs/**`, `scenario.json` (producer path + sha256, steps, expected chains). Raw pids
  and absolute temp paths inside it are expected — YOU redact.

## Deliverables

One NEW generator, `ontology/extraction/s4/beep-ci-ops/corpus/etl_run3b_fleet_corpus.py`,
pinning TWO independent sibling output roots, plus `test_run3b_generator.py`.

Shared mechanics: exactly as Stage A (stdlib + PyYAML; `UV_CACHE_DIR=~/.cache/beep/uv-cache
uv run --offline --with pyyaml python <generator>`; atomic staged emission; `.properties`
projections per raw payload; `corpus_commit`; per-value `source: {file, needle-derived line}`
cites; closed-world `complete_within` receipts; generator sha256 self-pin in EACH manifest;
GENERATED headers). Verify mode never reads the live machine or the synthetic root. Output
roots are independent: each pins when absent and verifies when present; `--refresh {fleet|
synthetic|all}` replaces deliberately; `--synthetic-root <path>` is required to pin or refresh
the synthetic root and is ignored in verify mode. Residue verifier FAILS the run on any
surviving fleet-root / home / system-tmp / session-tmp / `~/.beep/runtime` / `/proc` /
`/dev/shm` prefix, `uid-<n>` tokens, `\b(pid)[ =:]?[0-9]+`, credential/token regexes,
`op://` material, and `sha12(hostname)` (computed at run time, never written). Manifest
absolute-path lint. Add BOTH new pin directories to `biome.jsonc` `files.includes`
negations in this PR (the Biome pre-commit hook rewrites JSON payloads otherwise).

### A. `run3b-fleet/` — organic loss population (schema `beep-ci-ops-run3b-fleet-corpus/v1`, `stage: B`)

Families and deltas versus Stage A:

1. **Admission roots** as Stage A (canonical, session-tmp, legacy system-tmp; absent = receipt),
   PLUS `admission/<root-label>/protocol.json` captured as a fact (cite `AdmissionProtocol`).
2. **Version-aware redaction** now cites v3 as DEPLOYED (replace Stage A's "accepted
   prospectively" fact with per-tag source cites). Unknown `schemaVersion` or unparsable rows are
   excluded and tallied, never emitted raw. Source order kept.
3. **Custody surrogate (Ruling 11)** unchanged: `ownerRef = sha12(pid:procStart:captureSalt)`,
   fresh unrecorded salt per capture, applied before the pid/procStart drop — including inside
   NESTED payloads (reap claims embed a `lease` or `ticket` object; tickets and leases embed
   pid/procStart). Weak-key tally when `procStart` is absent.
4. **Live state** — `live/<root-label>/{leases,queue,claims,quarantine}/…` with full redaction
   (`checkoutRoot`, `command`, `hotPaths[]`, `runScope.unitName`, claim `sourcePath`). Reap
   claims are IN scope (Ruling 18): they are the custody chain from dead state to eviction row.
   Lock files and `.lock` sidecars are never captured; empty directories are receipts.
5. **Attempts** — `attempts/<checkout>/<runId>/attempts.ndjson` fleet-wide including linked
   worktrees, same labels/encoding as the Stage A review fix, same ring receipts. This family
   exists as the `attemptId` join target for eviction rows (`attempt-terminated` with reasons
   `lease-eviction` / `queued-submitter-death`). NO verdict family, NO ledger family, NO
   checkout-identity re-capture (all remain on the Stage A pin; cross-reference by label).
6. **Loss-population census** in the MANIFEST: per root × `schemaVersion` × `_tag` counts, and
   per-nonce chain classification computed ONLY from the pinned rows — `win`
   (enqueued→admitted→released), `withdrawn` (enqueued→withdrawn), `lease-evicted`,
   `ticket-evicted`, `in-flight` (enqueued with no terminal row), `pre-v3` (admitted/released
   without an enqueued row). Verify mode recomputes the census from pinned bytes and compares.
   Do not compute wait/hold durations into the pin; record the derivation rule and leave the
   arithmetic to the auditor.
7. **Ruling 17 receipt**: `proof_ledger: {status: "re-parked to run 4", ruling: 17, evidence:
   <cite of the PLAN.md C2 line>, checkouts_with_ledger: <count observed, expected 0>}`.
8. **Known-loss classes** as Stage A, updated: the heartbeat class is now "carried on v3
   lease-evicted rows; still absent on v1/v2 rows"; add "eviction rows deferred while the
   protocol marker was off (claims replayed on the first enabled pass; `evictedAtMillis` is the
   original claim instant)". Cite each.
9. **Join-key notes** as Stage A plus: claim → eviction row by `nonce` and claim `sourcePath`
   basename; `lastHeartbeatAtMillis` ≤ `evictedAtMillis` invariant recorded as a check.

### B. `run3b-synthetic/` — Ruling 10 scenario (schema `beep-ci-ops-run3b-synthetic-corpus/v1`)

Ingest `--synthetic-root <path>` (the PR-1 export). Same families as A restricted to what the
export contains (`admission/`, `live/`, `attempts/<label>/…`), same redaction and custody
rules for uniformity. Every payload's `.properties` projection and the MANIFEST carry
`provenance: synthetic`; the MANIFEST top level records `provenance: synthetic`, `producer:
{path, sha256}` copied from `scenario.json` (and the sha256 of `scenario.json` itself), the
scenario steps and expected chains verbatim, and `synthetic_checkout_labels` mapping the
export's temp checkout roots to `<synthetic-checkout:contender-a|dead-lease|dead-ticket>`
tokens (temp paths never survive). Refuse to pin if `READY` is absent. The census (A.6) runs
over the synthetic rows too and must match `scenario.json` `expected` — mismatch fails the pin.

### C. `test_run3b_generator.py`

Sibling of `test_run3_generators.py`: redaction of nested claim payloads, salt policy, census
classification on a hand-built journal, synthetic-label mapping, `READY`-gate refusal,
independent output roots (`--refresh fleet` leaves the synthetic pin byte-identical and vice
versa), residue verifier positives and negatives.

## Sequencing

1. Write the generator and tests; run tests.
2. Pin `run3b-fleet/` (live capture) — do this LAST among code steps so traffic rides along.
3. Check `~/.cache/beep/ciops-synthetic-root/READY`. If present, pin `run3b-synthetic/`. If
   absent, poll every 60 s for up to 3 hours; if it never appears, pin fleet only, record
   `synthetic: {status: absent, reason}` in the report, and finish — Fable will run
   `--synthetic-root` later without refreshing the fleet pin.
4. Verify both pins from the working tree, then from a DETACHED worktree of the committed HEAD
   (use the trusted lane's Python interpreter — the fresh worktree's `mise.toml` is untrusted;
   compare `git ls-files` payload counts with each manifest).

## Packet bookkeeping in this PR

- `ops/manifest.json` run-3 open question: append "Stage B PINNED <date> (`run3b-fleet/`,
  `run3b-synthetic/`); proof-ledger issuance rows RE-PARKED to run 4 (Ruling 17); next = run 3
  proper". Do not touch the S8 question.
- `README.md` Trail: one dated entry (what was pinned, counts, what was re-parked).
- Do NOT edit `DECISIONS.md`, `ATLAS.md` (generated), anything under `extraction/s5|s6|s7`,
  `run2-fleet/`, `run3-fleet/`, `run3-checkout-identity/`, or the three frozen generators.
- `research/OPPORTUNITIES.md`: append receipts for any friction (redacted, `~` for home).

## Verification before handoff

1. Each output root: first run pins (exit 0), rerun verifies byte-identical (exit 0), a
   corrupted pinned byte makes verify fail (exit ≠ 0), restore.
2. Residue scans zero over both pin dirs; `grep -rn "$(hostname)"` empty; no `uid-<n>` tokens,
   no `/home/`, no raw pids.
3. `sha256sum` of the three frozen generators unchanged; `git status` shows nothing under the
   frozen directories.
4. `research/scripts/validate_packet.py` and `uv run --with pyoxigraph python
   research/scripts/run_cq_suite.py` green.
5. `git ls-files` payload counts equal each manifest's payload count (the nested-ignored-dir
   trap from Stage A).
6. No workspace package touched except `biome.jsonc` → no package-verify; run the markdown /
   knowledge lints that gate `explorations/` and attribute any red (they read HEAD — commit
   first, then rerun).

## Report

Write `research/run3-lanes/stage-b-report.md`: both MANIFEST heads (first ~40 lines), the
loss-population census and chain classification, the synthetic status (pinned with producer
sha, or absent with reason), residue-scan proof, frozen-bytes proof, detached-worktree verify
proof, deviations with reasons, open questions, commit SHA(s).

## Hard rules

- Never `git add -A`; stage pin directories by path. Never push / PR / merge / force.
- Public repo: the residue verifier is the law, the scans are the proof.
- Frozen artifacts stay byte-identical. New work = new sibling files.
- Commit message: `feat(explorations): pin the run-3 Stage B corpora (loss population + synthetic scenario)`,
  body lines wrapped under 100 characters.
