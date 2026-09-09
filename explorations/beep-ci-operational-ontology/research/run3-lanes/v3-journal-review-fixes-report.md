# PR #1025 — v3 journal review-fix report

Lane: Codex review-fix. Branch: `feat/ontology-v3-journal-events`.
Starting implementation commit: `dfeba80cbf7baa1864ddd4ab4e9e686496913312`.
All file anchors below refer to the implementation worktree at the final fix commit,
unless explicitly identified as starting-commit evidence.

All three findings **hold** and are fixed. Newly delivered hosted Lint Policy and Knip
failures were also fixed. The changes are committed locally. This lane performed no push,
PR reply/resolution, or change under `explorations/` in the implementation worktree.
The pre-existing untracked `graft/` directory remains untouched.

## Finding 1 — P1: fence v3 evictions from pre-v3 recovery workers

**Verdict: holds.** At the starting commit, `AdmissionProtocol` accepted only
`yeet-admission-protocol/v1` (`AdmissionJournal.ts:116`) and the protocol writer still
published that version (`:1480`). Meanwhile, `admissionEventForReapClaim` constructed v3
lease and ticket evictions (`QualityScheduler.ts:746`). The append-once scan only compares
successfully decoded rows; its identity is tag, nonce, PID, and optional attempt ID.
A pre-v3 decoder treats the v3 row as opaque, so it cannot recognize the prior eviction.
The sink writes the receipt before persisting `admissionJournal: "complete"`, leaving the
reported crash window (`QualityScheduler.ts:856`). Unknown-row preservation alone did
not establish mixed-fleet recovery safety.

**Fix.** `AdmissionProtocol` now requires `yeet-admission-protocol/v2`
(`packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts:119`).
`writeAdmissionProtocol` publishes that version (`:1481`); this is the actual writer
behind `setAdmissionEvictionProtocol`, rather than a function named
`publishAdmissionProtocol`. `readAdmissionProtocol` fails closed for old v1 markers,
including v1 with `eviction: "on"` (`:745`). The existing locked gate read at `:1759`
therefore requires the new marker before a v3 receipt can be written. A pre-v3 worker's
v1-only decoder rejects the new marker and leaves the claim pending; a v3-aware retry
can recognize the receipt and complete the claim. The identity scan is unchanged at
`:1573`. No claim schema or new production service was needed.

The marker is the smaller existing fence: the old sink already consults it and already
knows how to defer an unfinished claim. An additive claim property could be ignored by
old decoders, while a new claim version would complicate the existing claim reader and
quarantine behavior. The protocol marker and journal publication already share one
fenced lock, so a separate claim-version handshake adds no benefit here.

**Proof.** `packages/tooling/tool/cli/test/quality-scheduler.test.ts:2495` adds the
parameterized **“fences pre-v3 %s recovery after receipt append but before claim
acknowledgment”** test for both `lease` and `ticket`. It uses the real sink to append a
v3 row, simulates failure before acknowledging the claim, verifies the claim remains
pending, then supplies the historical v1 marker decoder and v1/v2 journal reader to a
modeled old sink. The old recovery performs zero writes, leaves the claim
`pending-protocol-off`, and preserves the exact journal bytes. The following current
reaper completes the claim with the same single receipt and identical bytes. This
models the historical decoder/sink behavior through the existing service seam; it does
not claim execution of every deployed fleet binary.

**“requires protocol v2 before emitting v3 evictions”** at `:2471` separately proves
that a v1/on marker does not authorize current emission and that the operator command
publishes v2/on before emission succeeds. Existing protocol-disabled and unknown-row
preservation tests still pass. The README rollout section is updated at `:589`.

**Reply Fable can post verbatim:**

> Confirmed and fixed in d98343f199. V3 eviction emission now requires the existing protocol marker at `yeet-admission-protocol/v2`; pre-v3 workers only decode protocol v1 and therefore fail closed, leaving the durable claim pending. The protocol writer publishes the new version under the same fenced journal lock. Added lease and ticket crash-window regressions that append the v3 receipt, interrupt claim acknowledgment, run a modeled pre-v3 recovery with its historical decoders, and verify zero extra writes before a v3-aware reaper completes the claim. The 140-test scheduler suite passes, including the existing opaque-row preservation and protocol-deferral tests.

## Finding 2 — P2: bound queue-only journal growth

**Verdict: holds.** The original `rewriteJournalLocked` retention boundary advanced only
when more than 200 admitted rows existed (`AdmissionJournal.ts:1592` at the starting
commit). Repeated enqueue/withdrawal pairs with no admissions could never advance that
boundary. Each best-effort append decoded and rewrote all retained known history.

**Fix.** `RETAINED_KNOWN_ROWS` is 2,400 at
`packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts:57`.
Its JSDoc gives the sizing arithmetic: 200 admissions × 3 normal lifecycle rows
(enqueue, admit, release) × 4. The existing admitted boundary remains unchanged
at `:1597`. The new cap reserves the newest admitted ring, then fills remaining slots
with the newest other known rows inside that boundary (`:1601`). This is slightly
stronger than simply taking the newest 2,400 known rows: arbitrarily heavy later queue
churn cannot erase the admitted ring. Opaque rows consume no slots, retain their bytes,
and stay in source order across both limits.

**Proof.** The new parameterized **“bounds queue-only churn while preserving %i admitted
rows and opaque bytes”** at `packages/tooling/tool/cli/test/quality-scheduler.test.ts:1221`
seeds 1,300 enqueue/withdrawal pairs, then performs six actual serialized appends.
For both zero admissions and a full 200-admission ring, each append retains exactly
2,400 known rows plus the opaque row. Assertions cover the complete retained source
order, byte-identical opaque content, all admitted rows, and the newest appended event.
The existing **“retains the newest bounded set of admitted transitions”** at `:1201`
and the older-reader ring-trimming test at `:1157` are unchanged and pass.

This cap is a known-row bound applied by current writers. Unknown rows and older
writers remain outside it. Additional trimming can still leave partial lifecycle
chains; receipt idempotence remains subject to the journal's finite retention horizon.
The README documents these limits at `:610`.

**Reply Fable can post verbatim:**

> Confirmed and fixed in d98343f199. The journal now caps retained known history at 2,400 rows, sized as 200 admissions × 3 lifecycle rows × 4. The existing 200-admission ring is preserved first; remaining capacity keeps the newest other known rows. Unknown rows retain their existing byte-preservation behavior and source order. New regressions exercise 1,300 enqueue/withdrawal pairs followed by repeated locked appends, with both zero admissions and a full admitted ring, and assert the bound and exact retained content. The existing 200-admission retention tests remain unchanged and pass.

## Finding 3 — P2: ciops live-journal replay rejects v3

**Verdict: holds.** The lab's original union contained only the four v1/v2 variants
(`apps/labs/ciops/src/projection/Schemas.ts:751` at the starting commit).
`decodeAdmissionJournal` decodes every nonempty source line through that union and
propagates a typed failure (`Replay.ts:214`). A single valid v3 line therefore rejected
the entire source before replay.

**Fix.** The lab now has private, annotated v3 identity and event classes at
`apps/labs/ciops/src/projection/Schemas.ts:687`, with all five new variants in the
union at `:782`. Legacy classes retain their S6-redaction behavior. The lab continues
to own its schemas; no `@beep/repo-cli` internals, dependency, or package exports were
introduced. The live v3 classes retain owner, attempt, checkout, branch, and heartbeat
attribution; the existing lab release/eviction timestamp constraints remain in place.

Versioned releases and evictions share `_tag`. The local Effect reference confirms
that `S.toTaggedUnion` rejects duplicate tag discriminants, including nested unions
(`.repos/effect/packages/effect/src/Schema.ts:6105`). Replay therefore uses exhaustive
Effect Match handling of the decoded union. Enqueue and withdrawal are neutral in
phantom detection (`Replay.ts:240`), admitted-event selection (`:354`), and the main
ledger fold (`:490`). V3 release and lease eviction release the same nonce charge as
the legacy variants. Queue events **do count** in `eventIndex`; `:500` documents its
meaning as the zero-based decoded source-event index.

**Proof.** `test/fixtures/admission-journal-v3-mixed.ndjson` contains all nine variant
shapes in a 13-row source. The regression at `test/projection.test.ts:317`,
**“replays every v3 variant with legacy rows and counts ledger-neutral queue events in
source indexes”**, asserts exact version/tag source order, four admissions and four
releases, zero inferred evictions or mismatches, admission indexes `[1, 4, 7, 10]`,
and pre-admission ledger totals `[0, 5, 0, 0]`. This catches queue charging, accidental
withdrawal release, failed v3 release/eviction folding, and dropped queue-event indexes.
All 14 ciops tests pass. The unchanged frozen test still proves 79 events, 41 matching
admissions, 38 releases, and the historical inferred eviction at source index 66.

**Evidence command and frozen-artifact boundary.** This checkout's evidence generator
ignored `--check` and unconditionally wrote into `explorations/`. That was detected
before invoking it. `scripts/generate-replay-evidence.ts:49` now implements `--check`
as a no-write recomputation followed by the existing `requireReplayMatch` validation.
`bun run evidence:s7 --check` passes. It validates the differential replay; it does not
assert that historical Markdown prose matches today's renderer byte-for-byte. Two prose
paragraphs already differ between the renderer and committed historical report at the
starting commit. Those paragraphs and the historical report were left untouched.
No implementation-worktree `explorations/` file was written or committed.

**PR #1024 overlap accounting.** The `Schemas.ts` changes are its import list and the
journal-event region, originally `:623–770`. The follow-up only makes two legacy
classes private and replaces their former export examples with private documentation. `Replay.ts` changes only
imports and event handling: original hunks `:248–271`, `:352–364`, and `:466–489`.
No episode schema, episode ID construction, proposal provenance, emission, Turtle, or
renderer logic changed. There is one seven-line supporting change to the evidence
script for the safe check mode. These facts should help Fable merge with #1024; no
cross-branch merge was attempted by this lane.

**Reply Fable can post verbatim:**

> Confirmed and fixed in d98343f199. The ciops-owned journal union now accepts all v3 enqueue, withdrawal, release, lease-eviction, and ticket-eviction variants alongside v1/v2, without importing CLI internals. Queue transitions are ledger-neutral and still count in the decoded source-event index. A mixed 13-row fixture covers every variant, verifies admission indexes `[1, 4, 7, 10]`, and checks token totals across v3 releases and evictions. All 14 ciops tests and the frozen S7 replay check pass. I also made `evidence:s7 --check` a no-write replay validation, because the old script ignored the flag; frozen artifacts and episode/provenance construction remain unchanged. Follow-up d9ea10f27d makes the two now-internal legacy schema classes private; the repository Knip gate and ciops package audit pass.

## Additional hosted failure — Heavy / Lint Policy

The inbox delivered `Heavy_Lint_Policy-d57dfe11689d` during this lane. The failed job was
`https://github.com/beep-effect/beep-effect/actions/runs/34302194860/job/102311276181`.
Its only failing policy step was Oxlint, with six errors on the starting commit's
`AdmissionJournal.ts:575–580`: **“Hoist Schema.is(...) to module scope”**.
This is introduced by the original v3 implementation, not an environment failure.
The guard map is now compiled at module scope (`AdmissionJournal.ts:546`), and the
statics callback only references that map. The hosted command's Oxlint settings pass
on all seven touched TypeScript files. Hosted CI was not rerun or otherwise mutated.

All four inbox rows were acknowledged with the exact `--fix-sha` form against the new
commit: `review-thread-0c35ece02b4e`, `review-thread-723a96fb9269`,
`review-thread-98aaa7ea1108`, and `Heavy_Lint_Policy-d57dfe11689d`.
The subsequent local `yeet inbox list --unacked --json` returned an empty entries array.
This acknowledges local fixes; it does not post replies or resolve GitHub threads.
The later local audit row `local-shard-c4cd77d0a9af` received an environment-only
acknowledgment identifying the remaining EROFS failures and the separate passing proof
for the corrected intermediate fixtures. This is not an aggregate-pass receipt.

## Additional hosted failure — Knip

After the first local commit, the inbox delivered `Knip-b325571904ce` for that exact
SHA. The hosted job was
`https://github.com/beep-effect/beep-effect/actions/runs/34304241492/job/102317492097`.
It reported unused exports `AdmissionJournalReleased` and
`AdmissionJournalLeaseEvicted` in the ciops schemas. This was introduced by replacing
Replay's legacy-only type imports with schema-derived mixed-version event types.

Follow-up `d9ea10f27d` makes those two legacy classes private at `Schemas.ts:627` and
`:656`. Their decoding behavior remains in the union. Their former exported examples
were replaced by concise private documentation rather than leaving invalid imports.
No export allowlist or Knip baseline was changed. `bun run beep quality knip` passes
with `current=2 baseline=2 introduced=0`, and the full ciops audit passes in 6.7 seconds.
The Knip inbox row was acknowledged with this follow-up's `--fix-sha`. A transient
ciops formatting failure during this follow-up was corrected before its final audit;
the successful audit cleared that local shard's poison.

## Verification notes and friction receipts

- Local logs are under `.beep/handoffs/v3-journal-review-fixes/` in the implementation
  worktree. The ignored test compiler config is `node_modules/.tmp/v3-journal-testcheck.json`,
  reused from the prior lane to include the changed scheduler test and its source
  dependencies. These are local diagnostics, not frozen packet artifacts.
- The fresh source checks caught and corrected introduced intermediate errors: a duplicate
  Number import, use of `Array.filterMap` with Option where this Effect version expects
  Result, missing exhaustive Match termination, and the typed error boundary in the
  historical-reader fixture. The zero-admission test was corrected for `Array.makeBy(0)`
  returning one element; it now explicitly verifies an empty admission set. The lease
  crash fixture uses the existing stubbed systemctl pattern before claiming a dead lease.
- A comparison-only draft of the new evidence check exposed the two inherited renderer
  prose differences. Final check mode verifies replay without regenerating historical
  prose. A supported no-write check mode in the original script would have avoided this
  scope hazard; source inspection prevented any forbidden packet write.
- `gh run view --job --log` withheld logs while sibling jobs were still running. The
  read-only job-log API provided the completed job's diagnostics. No run retry or PR
  mutation was needed.
- The prior lane's Node `spawnSync EPERM` does **not** reproduce in this session:
  a direct Node-hosted compiler-shim probe passes. It must not be used to attribute
  the current CLI aggregate outcome; the final failures and attribution are detailed below.
- Docgen's read-only cache warning did not affect its exit status or example compilation.

### Aggregate verification result and attribution

The final exact CLI package verification completed with **exit 1**: audit 348.2 seconds,
package docgen 19.0 seconds. Its full test run passed 3,139 tests and failed 27 across
162 files (160 passed, 2 failed); the test phase took 336.79 seconds. Build/check passed.
The scheduler suite has no failures in this final aggregate. Python and package lint
stages were not reached after the test failure. This is **not an aggregate pass**.

- **26 environment-only failures:** unchanged `test/yeet.test.ts` proof-coordinator
  fixture cleanup calls `FileSystem.remove` in `~/.beep/runtime/beep-yeet-proof-locks-*/`
  outside the sandbox's writable roots and receives `EROFS`. The fixture calls are at
  `test/yeet.test.ts:346` and `:359`. `git diff --exit-code` from the starting commit to
  final HEAD confirms the test, `commands/Yeet/internal/ProofState.ts`, and the runtime
  root modules are unchanged. These are fresh filesystem errors, not the prior lane's
  Node `spawnSync EPERM`.
- **One unrelated timing-sensitive test failure:** unchanged `test/tmpfs-reap.test.ts:853`,
  “distinguishes a live file descriptor from a live working-directory reference”, observed
  `refCount = 0` instead of a positive count. The child shell opens its descriptor without
  a readiness handshake before the parent starts scanning. The same test passed in the
  first full audit and again in a focused thread-pool rerun (1 passed, 29 filtered out,
  3.98 seconds). The test and both `TmpfsReap` implementation/schema files are unchanged
  from the starting commit. The evidence supports a pre-existing process-timing failure;
  no unrelated repair was made and the aggregate result remains red.

The first audit also saw the two intermediate scheduler fixtures loaded before their
final corrections; those errors are absent from the final audit. This is why the full
command was rerun after the source settled. The final log is
`.beep/handoffs/v3-journal-review-fixes/cli-package-verify-final.log`; the isolated process
check is `tmpfs-fd-probe.log`. The final CLI audit row `local-shard-4764fc868e14` was
acknowledged with `--environment-only`, naming both the sandbox failures and the
unchanged process-timing test, and explicitly stating that this is not an aggregate pass.
The CLI source stayed unchanged throughout the final run; the concurrent follow-up only
privatized two ciops schemas, and that app received its own fresh full passing audit.

The full CLI audit remains for Fable to rerun in an environment with the runtime fixture
paths writable. Neither hosted readiness nor a merge-ready PR is claimed by this lane.

## Commit SHA(s)

`d98343f199de3029b5be64bd8217154a6ecaaa04`

`fix(repo-cli): harden v3 journal recovery, retention, and replay`

Initial bundled commit: nine named files, 436 insertions and 80 deletions.

`d9ea10f27df8b3423dac9b61152a02349863111e`

`fix(ciops): keep legacy journal schemas private`

Follow-up commit: one named file, 4 insertions and 50 deletions. Combined change: nine
files, 440 insertions and 130 deletions. Pre-commit
Gitleaks, typos, Biome, JSDoc, and commitlint passed. No `git add -A`, push, PR write,
merge, rebase, or worktree switch was used.

## Verification table

| Command / check | Result |
| --- | --- |
| `bunx --bun --no-install vitest run --root packages/tooling/tool/cli --pool threads --maxWorkers 1 test/quality-scheduler.test.ts test/quality-scheduler-drift.test.ts test/quality-scheduler-degraded-inputs.test.ts test/process-identity.test.ts` | PASS: 4 files, 140 tests, 13.98 seconds. |
| `CI=true bun run test` in `apps/labs/ciops` | PASS: 2 files, 14 tests. |
| `bun run evidence:s7 --check` in `apps/labs/ciops` | PASS: frozen differential replay recomputed and validated; no evidence write. |
| `bun tools/tsgo-shim/tsgo.js -p packages/tooling/tool/cli/tsconfig.check.json` | PASS: no diagnostics. |
| `bun tools/tsgo-shim/tsgo.js -p node_modules/.tmp/v3-journal-testcheck.json` | PASS: changed scheduler test and source dependencies, no diagnostics. |
| `bun tools/tsgo-shim/tsgo.js -p apps/labs/ciops/tsconfig.check.json` and `-p apps/labs/ciops/tsconfig.json` | PASS: both configurations, no diagnostics. |
| `bun run docgen:local` | PASS: 228 modules, 1,509 examples; example typechecking and aggregation succeeded, 19.61 seconds. |
| `bunx --no-install biome check` on all seven touched TypeScript files | PASS: no fixes needed; repeated by the pre-commit hook. |
| `bunx --no-install oxlint --quiet --disable-nested-config` on all seven touched TypeScript files | PASS: the same settings as the failed hosted policy step, scoped to changed files. |
| `CI=true bun run beep quality package-verify @beep/ciops` | PASS after the final cleanup: full audit 6.7 seconds; docgen correctly skipped for this app. |
| `CI=true bun run beep quality package-verify @beep/repo-cli` | **FAIL, attributed:** audit 348.2 seconds; 3,139 tests pass, 26 unchanged runtime-root EROFS failures, 1 unchanged live-FD timing failure (focused rerun passes). Build/check and package docgen pass. No scheduler failure. Not an aggregate pass. |
| `git diff --check` and staged diff check | PASS. |
| `git diff --exit-code -- explorations/` | PASS; no changes in implementation-worktree packet artifacts. |
| `bun run beep quality knip` | PASS after the final cleanup: current=2, baseline=2, introduced=0. |
| Focused `tmpfs-reap.test.ts` live-FD test | PASS: 1 test, 29 filtered out, 3.98 seconds; diagnostic attribution only, not an aggregate replacement. |
| Commit hooks | PASS: Gitleaks, typos, Biome, JSDoc, commitlint. |
| Local unacknowledged Yeet inbox | Empty after fix-SHA acknowledgments, successful ciops audit, and the attributed local CLI audit acknowledgments. |
