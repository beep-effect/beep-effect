# Oppold Corpus Salvage Restoration — friction ledger

Receipts recorded while executing this packet, per `AGENTS.md`.

## 2026-08-27 — Yeet's Fallow packet hid the actionable locations

- **Doing:** running `bun run beep yeet repair` before the tooling baseline
  commit.
- **Evidence:** the cheap-gates envelope reported 18 introduced Fallow findings,
  but the generated Yeet packet categorized the failure as
  `effect-tsgo-policy` against `repo` and contained no Fallow file, symbol, or
  line. The locations were recoverable only by extracting the nested first-line
  JSON from `.beep/fallow/raw/audit.check.combined.txt`.
- **Prevented by:** preserve Fallow's structured path, symbol, line, metric, and
  attribution fields in the Yeet issue index and route the packet to a
  complexity/duplication fixer instead of the Effect tsgo fallback.

## 2026-08-27 — The wrong test runner disguised passing assertions as timeouts

- **Doing:** attributing focused libpff proof after the restoration boundary
  changes.
- **Evidence:** every process-backed case completed all of its assertions and
  then reported `test timed out ... before its done callback was called` while
  consuming CPU in teardown. The behavior reproduced from `origin/main`, but
  only under direct `bun test`; the package-authoritative
  `bunx --bun vitest run` completed the same focused suites with 30/30 and
  19/19 passing tests.
- **Prevented by:** route focused test suggestions through each package's
  `beep:test` script (or its exact Vitest runner) so Effect's scoped test
  adapter is never executed through Bun's incompatible native callback path.

## 2026-08-27 — The synthetic converter stub hid the real launcher contract

- **Doing:** proving the legacy-Word conversion sandbox against the pinned
  production toolchain before authorizing corpus writes.
- **Evidence:** the synthetic executable passed, but the real converter failed
  with `bwrap: execvp /tool/converter: No such file or directory`. The pinned
  executable is a shell launcher whose interpreter and sibling installation
  files must remain available at their original runtime paths; the sandbox had
  neither `/bin` nor that launcher layout.
- **Prevented by:** include one real-toolchain smoke in the pre-mutation proof
  and model launcher runtime roots separately from standalone test binaries.

## 2026-08-27 — Collector retry history was mistaken for unique inventory

- **Doing:** hardening P0's row-by-row collector reconciliation after the
  adversarial review requested a source-file bijection.
- **Evidence:** the immutable ledger has 22,510 successful historical rows but
  10,871 unique successful destinations; retry rows intentionally repeat a
  destination. The live aggregate has 21,489 present successful rows and
  1,021 missing rows, with no conflicting recorded sizes.
- **Prevented by:** document the collector's append-only retry semantics and
  frozen destination-prefix contract alongside its per-status denominators,
  so review asks for identity reconciliation rather than row uniqueness.

## 2026-08-27 — The tooling schema scan had no introduced-change attribution

- **Doing:** running the supplemental tooling schema convention scan after the
  authoritative schema-first baseline passed with all advisories at zero.
- **Evidence:** `bun run beep lint tooling-schema-first` exited on 201
  repository-wide findings, mostly the established dotted TypeScript filename
  convention, without identifying whether any finding was introduced.
- **Prevented by:** give the tooling scan a committed baseline or changed-file
  mode so feature work can distinguish regressions from inherited migration
  inventory.

## 2026-08-27 — A concurrent sync captured unrelated workspace configuration

- **Doing:** checking the feature branch and preservation inputs immediately
  before the approved P0 archive run.
- **Evidence:** `git show --stat HEAD` showed 12 `.codex` configuration, agent,
  and hook paths in a concurrent sync commit even though those paths were
  outside this packet's publish intent.
- **Prevented by:** make sync helpers preserve unrelated dirty paths and require
  a named-path index before committing; run the final proof and publication
  from an isolated clean checkout built only from the packet's reviewed paths.

## 2026-08-27 — Synthetic rows hid the collector's status-specific wire shape

- **Doing:** starting the approved P0 preservation run against the inherited
  collector ledger.
- **Evidence:** preflight rejected all 5,986 `error` rows and 12
  `excluded-secret` rows because the initial schema required `dst` and `size`
  for every status. The real ledger records those fields only for the 22,510
  successful `copied` and `resumed` rows.
- **Prevented by:** freeze one sanitized example for every external status and
  decode those exact shapes in the pre-mutation test suite; model the ledger as
  a status-tagged union so fields required only by successful rows cannot leak
  into inherited-loss variants.

## 2026-08-28 — Hosted coverage surfaced only after the first publish

- **Doing:** closing hosted CI on the first coherent restoration PR while
  keeping the local proof and coverage authority separate.
- **Evidence:** `Heavy / Coverage Regression` reported that the new restoration
  implementation paths lowered the CLI package's historical line, branch,
  function, and statement baselines. The local targeted suite was green, but
  the hosted report was the first gate to expose the package-level deficit and
  recommended rewriting the baseline rather than identifying the missing
  behavioral cases.
- **Prevented by:** add a scheduler-admitted, changed-file coverage preview to
  Yeet before publication, with uncovered source locations and an explicit
  operator-authorization gate for any baseline rewrite.

## 2026-08-28 — Yeet rejected the residue-safe repair flag

- **Doing:** running the canonical repair pass against an explicitly staged
  review-fix slice.
- **Evidence:** `bun run beep yeet repair --staged-only` exited before repair
  with `Unrecognized flag: --staged-only`, although the publish workflow uses
  staged-path isolation to protect unrelated workspace residue. The supported
  `--tier review-fix` fallback then crossed from 12/12 passing cheap gates into
  full docgen across 137 packages, so it had to be interrupted before running
  outside the scheduler lane.
- **Prevented by:** either support `--staged-only` consistently across repair
  and publish or have Yeet print the residue-safe replacement command and its
  proof expansion when a workflow flag is unavailable; heavyweight repair
  phases should acquire the same scheduler admission as publish.
## 2026-08-27 — `--start-pr-early` cannot push early under sibling proof contention

**What we were doing.** Publishing the P0 preservation branch with
`bun run beep yeet publish --start-pr-early --monitor --pr` while three
sibling checkouts ran full proofs back to back (patent-document-schema,
court-reporter-vocabulary, openai-driver lanes of the corpus campaign).

**Evidence.** Three consecutive publish attempts exited 1 before pushing with
`Another Yeet full proof for this repository is active.` — no remote branch
and no PR existed after each attempt, while the log had already printed
`start-pr-early: pushing before local proof`. Source: in the publish
handler's start-pr-early branch, one `runWithFullProofCoordinator(...)`
scope wraps the clean-HEAD install preflight, the early push, PR creation,
and the full proof together, and the lock acquisition fails closed instead
of queueing. The early push therefore inherits full-proof serialization,
defeating the flag's stated purpose (overlap hosted CI with the local
proof). Only the install preflight and the proof touch the Bun-cache/Turbo
resources the coordinator protects; the push and PR creation do not.

**What would have prevented it.** Coordinate the install preflight and the
full proof as separate lock acquisitions, with the early push and PR
creation between them (outside any hold). Contention pain then shrinks to
the preflight's install window, and the PR + hosted checks start even while
a sibling proof runs. Until then the workaround is camp-and-fire: poll the
lock path and invoke publish the instant it clears, retrying on lost races
because the coordinator has no queue.

## 2026-10-06 — A stalled preservation writer went unnoticed for six weeks

- **Doing:** resuming the P0 archive (lane E) from the 2026-08-27 run.
- **Evidence:** `payload/root-archive.zip.partial` stopped growing at 90.25 GB
  on 2026-08-27 12:15; the writer claim named a pid from a previous boot and
  nothing alarmed. In the meantime the source lost 1,818 files (operator
  cleanup), which voided the approved denominators and forced a re-measure.
- **Prevented by:** a liveness row or heartbeat on long archive runs surfaced
  by the session ledger / orchestrator gate, so a dead writer appears within
  hours instead of at the next audit.

## 2026-10-06 — A reconciliation denominator had no flag

- **Doing:** rerunning `restore-preserve` after the source changed.
- **Evidence:** `Collector present successful row denominator mismatch:
  expected 21489, observed 19370.` The expected value was a schema
  constructor default with no CLI flag, so the run could not be re-measured
  without a code change (`--expected-collector-present-rows` added). The
  verifier likewise hard-coded "exactly four inherited-loss rows".
- **Prevented by:** every frozen denominator the run checks gets a flag and
  the verifier checks the ratified class set, not a row count.

## 2026-10-06 — The archive hasher was pure JavaScript

- **Doing:** watching the resumed P0 run re-hash the promoted 147.7 GB root
  archive before its PASS row.
- **Evidence:** the process sat at 97% CPU on one core reading ~25 MB/s with
  no writes; `hashOpenedRestorationFile` used `@noble/hashes` `sha256.create()`.
  A 2 GB benchmark on the same file under Bun: noble 187 MB/s, `node:crypto`
  1,917 MB/s, identical digest. At the observed rate the remaining ~350 GB of
  hashing would have taken the rest of the day.
- **Prevented by:** a shared streaming hasher primitive on the platform hash
  (now `createStreamingSha256` in `Restoration.ts`), and a throughput line in
  the run log so a slow hasher is visible in minutes.

## 2026-10-06 — Yeet's packet named the wrong red gate

- **Doing:** reading the cheap-gates failure after the first `yeet publish` of
  the provenance index.
- **Evidence:** the quality packet reported one `repo-law` issue, "full:cheap-gates
  failed in tsconfig-sync", and suggested `bun run config-sync`; that command
  answered "all files already in sync". The real reds were lint:schema-first
  (two exported interfaces), lint:effect-vitest (six rows in a new test file)
  and fallow:audit (eleven complexity findings), visible only in the raw log.
- **Prevented by:** the packet should carry every failed lane's own findings
  (schema-first symbols, effect-vitest rows, fallow path:line:metric) instead of
  collapsing the wave to the first lane in its fallback table.

## 2026-10-06 — `typeof Bun` is not a runtime probe under Vitest

- **Doing:** running the corpus command suite after switching the streaming
  hasher to Bun's native `CryptoHasher` with a pure-JS fallback for Node.
- **Evidence:** 26 tests failed in 16 seconds with
  `TypeError: Bun.CryptoHasher is not a constructor`. `vitest.setup.ts`
  installs a partial Bun shim (spawn, file, serve, sleep) when Vitest runs on
  Node, so `typeof Bun !== "undefined"` was true while the hasher surface was
  absent. A Codex lane saw the same suite fail nine tests with a different
  message under its sandbox and attributed them to the baseline.
- **Prevented by:** probing the API you call (`typeof Bun.CryptoHasher ===
  "function"`), which the shim's own header comment prescribes, and a note in
  the shim's docs that `Bun` is defined under Node tests so feature probes
  must target members, never the global.

## 2026-10-06 — One backslash aborted the attachment repair apply

- **Doing:** the first `corpus provenance attachments --mode apply` over both
  mail trees (299,371 proposed renames).
- **Evidence:** the run stopped after 375 journaled renames with
  `Unsafe magic extension proposal.`; the row kept a Windows backslash that
  pffexport preserves inside attachment names, and the guard rejected
  `/`, `\` and NUL alike. The refresh tree alone holds 793 such proposals.
  The abort also left `proposals-extract.jsonl` truncated at 377 rows, while
  the orphaned journal stays valid undo input for the 375 renames it recorded.
- **Prevented by:** a guard scoped to what is unsafe on the target filesystem
  (the POSIX separator and NUL), an error that names the row, and a synthetic
  fixture with a backslash in the name so the rule is pinned by a test.

## 2026-10-07 — The hosted runner's `file(1)` is not the workstation's

- **Doing:** reading the first hosted coverage run of the provenance tests.
- **Evidence:** `plans, applies, journals ... undoes actual magic repairs`
  expected 4 proposals and got 2 on the runner; the same test passes locally
  (file 5.48). The synthetic fixtures are a minimal PDF, a 22-byte JPEG, a
  text file and random bytes, and the runner's libmagic build read two of
  them differently.
- **Prevented by:** driving workflow tests through the service contract (a
  deterministic `AttachmentMagicSniffer` layer) and keeping exactly one
  small live-sniffer test on the one fixture every libmagic recognises; the
  repair workflow is about journals and undo, not libmagic.

## 2026-10-07 — A per-root escape check rejected the corpus's own symlinks

- **Doing:** the first metadata census over `raw/`, `incoming/`,
  `organized/` and the attachment trees.
- **Evidence:** the run stopped on the first entry of `organized/` with
  `Walk path escapes root ... resolves to .../raw/... which escapes the
  allowed root`: `organized/` holds 28 symlinks into `raw/`, all inside the
  corpus home, and the walk resolved them against the sub-root it was
  started from.
- **Prevented by:** an explicit walk boundary (the corpus home for the
  census) separate from the directory being walked, and dedupe by canonical
  path so a symlinked file is censused once under its real location.

## 2026-10-09 — Worker environment omitted the user bus

- **Doing:** starting the P1 sandbox smoke and focused exception fixtures through `beep-heavy`.
- **Evidence:** both wrappers exited 1 before starting their commands because the user-bus environment was absent. The existing user bus was reachable after supplying its standard runtime environment; the same prerequisite commands then queued normally.
- **Prevented by:** verify the launcher's forwarded user-bus environment at worker admission, before any heavy command or immutable corpus operation.

## 2026-10-09 — Slot contention delays preflight

- **Doing:** running two bounded prerequisites through `beep-heavy` before the RAM-only sizing probe.
- **Evidence:** both jobs reported all three slots busy and remained queued for more than ten minutes; no prerequisite command had started and no slice ledger existed.
- **Prevented by:** reserve a short preflight admission window or expose queue position and expected holder completion to the worker. The existing cap and sibling jobs remain untouched.

### 2026-10-09: the synthetic Tika stub hid the real capture size

While sizing the first mail slice, all 59 second-pass extractions succeeded,
but 43 exceeded the fixed 4,096-character capture limit (maximum 1,578,537).
The synthetic stub produced a short line, so it could not expose the failure.
A fixture above the previous limit and a fixture above the remaining output
budget would have prevented this. Keep full text within the attempt budget;
retain fail-closed budget checks. This is the same launcher-versus-real-engine
proof gap recorded on 2026-08-27.

### 2026-10-09: canonical resolution precedes the name escape

The synthetic backslash fixture exposed `export entry resolution failed` under Bun.
The quota handoff also validates the raw tree before the portable-name escape,
so testing only the direct export would miss nested backslash components there.
Canonical resolution must check ancestors without rewriting literal name bytes;
a quota-handoff fixture, including a rejected symbolic link, now proves that
contract before child references are built. A fixture covering the live quota
path would have prevented this second validation gap.

### 2026-10-09: an unrelated reference gate blocks a scoped parity check

The required `CI=true bun run beep knowledge refs --check` exits 1 on one inherited
external-mirror reference in `goals/repository-simplification-confidence/SPEC.md`.
The file is unchanged and has the same blob on HEAD and origin/main. This lane's
reference changes introduce no gated finding. A consolidated main repair, owned
by the orchestrator, prevents repeated unrelated remediation across workers.

Attribution correction: HEAD matches the tested main base `36027982f2`; origin/main
advanced during the proof and now differs. The gate is inherited from that tested base,
not introduced by this lane. Inspect the newer main during the required publish merge.

### 2026-10-09: the name walk exceeded the complexity budget

Fallow audit and health identify the new `escapeExportDirectory` at cognitive
complexity 10 against a ceiling of 8. Attribute it as introduced, replace the
nested file-kind conditional with the existing Match dispatch, and keep the
collision refusal unchanged. No baseline or suppression is added. A focused
complexity check during the edit would have caught this before the full lane.

### 2026-10-09: aggregate coverage concealed a newly uncovered guard

The package percentages passed, but the touched restoration file fell from 100% to
99.93% lines, 99.94% statements, and 99.87% branches at the newly added zero-budget
Tika guard. An exhausted-retained-output fixture now proves refusal before Java launch
and preserves the original child bytes. Checking per-file rows alongside aggregate
percentages prevents an offsetting package improvement from hiding a new coverage gap.

### 2026-10-09: publication inherited inventory reds from newly merged main

PR1 publication committed locally, then stopped before push. Cheap gates failed on
Accounts schema inventory entries inherited byte-for-byte from main and thirteen
Effect-Vitest inventory findings outside the owned tests. Three additional findings
were introduced here: two resource-layer hook timeouts and an Option Boolean assertion.
Added explicit 30-second hook timeouts and used the existing assertion helper; no
inventory baseline changed. Running the membership scan before publication and landing
shared inventory repairs once on main would prevent this failed publication wave.

### 2026-10-09: the suggested assertion form conflicted with the compiler rule

The Effect-Vitest detector suggested an assertion helper for the new Option check.
Test-tsgo then rejected its nested-call form as a missed pipeable opportunity. Using
`textChild.pipe(O.isSome, assertTrue)` keeps the same check and satisfies the helper
style. A detector remediation sketch that uses the pipeable form would avoid this
second edit. No compiler diagnostic or lint rule was suppressed.

### 2026-10-09: authorized run locations were classified as mirror references

The required knowledge-reference check found five live external-mirror observations in
this packet's new corpus, Tika, and scratch location prose. The brief requires these
exact locations, while the census recognizes explicit inventory tables as path data.
Converted the location and invocation records into labeled inventories, preserving
all values and write authorities. No classifier, convention set, or gate was changed.
Use a location inventory for machine-bound run contracts before the first check.

### 2026-10-09: inherited inventory refusal required an explicit fallback ruling

The fully addressed P1 pre-run wave passed fifteen of sixteen cheap gates, but
publication stopped on five inventory entries in source surfaces identical to main.
The exact refusal was `github-checks:cheap-gates: failed 1 step(s)` and
`lint:schema-first: exit 1`, followed by `yeet publish cheap-gates failed after
creating the local commit; nothing was pushed. Fix the gate, then amend or reset
the unpushed commit before retrying.` The run-2 ruling authorizes direct push and
PR creation with the heavy label, Yeet ready, and a bounded readiness monitor.
No inventory baseline or unrelated source is changed. Attribution-aware publication
that accepts an explicit inherited-fence receipt would prevent repeated worker stops.


### 2026-10-09: a passing dry probe did not guarantee live second-pass acceptance

The RAM-only probe completed all 59 extraction candidates with no nonzero or empty
results, and both bounded fixes passed synthetic and package proof before #1596
merged. The frozen live slice nevertheless ended after 33 attachment dispositions
with one unapproved `engine-failure`, sealing the family. Counts-only evidence
shows 11 repairs, 22 unsupported dispositions, no warnings, and no terminal child
rows. The exception message and private log lines remain private and unread.
No precise underlying cause is claimed. A probe that reuses the driver's complete
quota handoff, synthesized-message and second-pass runtime contract would reduce
this gap. Do not rerun the sealed slice; a diagnostic or fresh-ledger route is an
orchestrator follow-up. No code or frozen policy changed during the run.

### 2026-10-09: the failure-evidence PR inherited publication reds

The docs-only P1 failure report passed fourteen of sixteen cheap gates. Yeet
refused with `github-checks:cheap-gates: failed 2 step(s)`,
`lint:schema-first: exit 1`, and `lint:effect-vitest: exit 1`, then reported
`yeet publish cheap-gates failed after creating the local commit; nothing was
pushed.` The five schema inventory entries and the PracticeKg projections test
finding are inherited; after merging newer main all package/app source and
inventory surfaces match main. The inherited-fence ruling authorizes direct
push plus PR creation, ready and bounded monitoring. Attribution-aware
publication would avoid requiring that fallback for aggregate failure evidence.
No unrelated source or inventory baseline was changed.

### 2026-10-10: duplicate attachments repeat volatile Tika metadata

- Work: diagnose the sealed P1 `engine-failure` without changing its ledger.
- Evidence: 33 dispositions, 11 copies and 11 text children; the next attachment
  repeats a repaired digest. Two exact-sandbox invocations exited 0, differed in
  one parser-duration field, and retained identical extracted content. A synthetic
  duplicate fixture with varying parser output fails before the fix and passes
  after first-evidence reuse.
- Prevention: content-addressed extraction should retain the first successful
  result per digest; a duplicate fixture must include volatile parser metadata
  rather than only fixed stub text. Preserve the first evidence, validate
  containment and nonempty bytes, and hash its final child normally.
- Attribution: engine defect; no source corruption or sandbox failure established.
- Reversal: revert the engine-fix PR and retain both run trees. The original
  sealed failure remains immutable; only the orchestrator authorizes a fresh family.

### 2026-10-10: fresh-family authority has no independent output label

- Work: prepare the run-4 authorized fresh ledger while retaining the sealed run.
- Evidence: `prepareTransformationRun` passes the same `runLabel` into archive
  verification and preservation selection, and joins it into the transformation
  run root. The public `restore-mail` command has no independent transformation
  label. A new label selects an absent preservation archive; the original label
  selects a terminal immutable ledger.
- Prevention: model preservation identity separately from transformation-family
  identity before offering a fresh-family recovery route. Test both families
  against one sealed archive while preserving the first terminal ledger.
- Disposition: publish the proven engine fix; stop the fresh launch without a new
  flag, archive alias, or hand-authored run state. The brief reserves expansion
  beyond the bounded fix for the orchestrator.
- Reversal: no live state was added. A scoped contract ruling can authorize the
  separate label and its schema/command/reconciliation tests.

### 2026-10-10: run-4 publication repeats inherited inventory fences

- Evidence: Yeet committed the reviewed update, then
  `github-checks:cheap-gates: failed 2 step(s)`:
  `lint:schema-first: exit 1`, `lint:effect-vitest: exit 1`. Nothing pushed.
  Fourteen other cheap gates pass. Five schema entries and one PracticeKg
  projections entry belong to source files matching main.
- Disposition: use the standing inherited-fence direct-push and labelled-PR
  fallback, authorized again by run 4. The orchestrator owns consolidated
  burn-down under S11; no lane baseline or CI setting is changed.
- Prevention: classify inherited inventory before publication admission so a
  scoped repair lane does not repeatedly stop on unrelated debt.
- Reversal: close the unmerged engine-fix PR and retain the immutable evidence.


### 2026-10-10: receipt proof lacked user-bus variables

Final receipt knowledge-reference verification failed before admission with
"Failed to connect to user scope bus" because the noninteractive shell lacked
`XDG_RUNTIME_DIR` and `DBUS_SESSION_BUS_ADDRESS`. No proof or corpus command ran.
Retried the same beep-heavy command with the documented user-bus environment.
Prevention: preserve those variables on every noninteractive heavy invocation.
No configuration or unit file was changed.


### 2026-10-10: inherited changeset graph stops hosted Repo Sanity

Read completed job 114115190524 immediately through the Actions jobs logs API.
Changeset-graph rejects private-workspace notes in
`.changeset/effected-allowlist-drop.md` and `.changeset/jsonl-effect-first.md`;
both match main and are untouched by this lane. Hosted Repo Sanity stops before
its remaining checks. Attribution: inherited, orchestrator S11 burn-down owns it.
Prevention: enforce private-workspace release-note policy before those notes land.
No baseline, CI policy, changeset, or source repair was made here.


### 2026-10-10: run-5 user-bus environment absent

- Doing: starting the prescribed heavy package and parity commands.
- Evidence: both wrappers refused before launching work because the user-bus
  address and runtime directory were undefined. The workstation user manager
  is available with the established explicit bus environment.
- Prevention: export the user-manager environment in every lane harness,
  including interactive resumption surfaces, before heavy admission.
- Disposition: supplied the existing runtime and bus values per command; kept
  the 32G cap and concurrency 2. No unit, home configuration or permissions changed.
- Reversal: omit these per-command environment values after a harness forwards them.


### 2026-10-10: three advisory rows survive the inherited-red burn-down

- Doing: publishing the independent preservation selector as the run-5 wave.
- Evidence: fifteen cheap gates pass; schema-first alone exits 1 on three
  pre-existing codec-test property-coverage advisories. All finding files match
  origin/main. Yeet reports "cheap-gates failed after creating the local commit;
  nothing was pushed." The run's parity ratchet has zero introduced findings.
- Prevention: inherited advisory attribution should permit scoped delivery
  without repeating a complete publication scanner wave.
- Disposition: follow the standing inherited-fence ruling: record the refusal,
  commit owned receipts by name, and push the full addressed wave once to PR3.
- Reversal: close PR3 and retain the packet and both immutable run directories.


### 2026-10-10: merging during coverage mixed test and module revisions

- Doing: incorporating #1605 while the full package coverage process was active.
- Evidence: the new directory-removal regression failed with NotFound against
  an older loaded module. Current source contains the recovery and both affected
  files match main. A fresh run of the same V8 script passes all 31 tests.
- Prevention: let an active proof finish or invalidate it before merging changes
  in a package under test; restart the proof against one stable source revision.
- Disposition: stopped and observed the contaminated wrapper, started fresh full
  scoped coverage, and held the live launch. No source workaround or suppression.
- Reversal: rerun the proof; no live corpus state was created.


### 2026-10-10: the amended head reaches another inherited Repo Sanity fence

- Doing: reading the completed hosted Repo Sanity red immediately from its job
  endpoint while the overall workflow continues.
- Evidence: job 114122237833 passes changeset-graph, config sync, boundaries
  configuration and versions, then Syncpack fails on the minimatch override
  (10.2.5 versus 10.2.6) and scratchpad smol-toml (1.9.0 versus ^1.9.0).
  Package manifests, lockfile and Syncpack configuration have zero lane diff.
- Prevention: run the same manifest-consistency check before calling the
  inherited-red burn-down final, so it does not expose a second dependency fence.
- Disposition: acknowledge as inherited under S11; the orchestrator owns repair.
  No dependency, lockfile, rule or scope expansion is made.
- Reversal: the acknowledgement can be superseded by the orchestrator's fix.

### 2026-10-10: inherited hosted policy failures obscure the Corpus proof

- Work: verify PR3 #1606 after the independent preservation label change.
- Evidence: Heavy / Lint Policy job 114122483280 failed tsgo profile/directive rules,
  30 hoist-schema oxlint errors, three schema test advisories, JSDoc inventory
  generation, and two deprecated-API fixture project-service checks. The identified
  failing files and configs match origin/main. JSDoc Ratchet job 114122237783 failed
  inventory generation with the prior head's same failure class.
- Attribution: inherited S11 orchestrator burn-down; rows acknowledged wontfix.
  Local package verification, test-tsgo, and package docgen passed.
- Prevention: burn down the inherited policy and hosted inventory defects once on
  main, then propagate that head to dependent lanes. No unrelated repair in this lane.

### 2026-10-10: accepted-slice documentation hits inherited schema advisories

- Work: publish PR4's aggregate acceptance evidence and P1 flips.
- Evidence: Yeet created the packet commit and refused before push with
  `github-checks:cheap-gates: failed 1 step(s)`, `lint:schema-first: exit 1`,
  and `yeet publish cheap-gates failed after creating the local commit; nothing
  was pushed.` Fifteen other gates pass, including committed JSDoc, Effect-Vitest,
  Knip and all Fallow blocking lanes.
- Attribution: three pre-existing schema-codec test advisories; all three
  affected files match origin/main. No source, inventory or CI changes here.
- Disposition: use the standing inherited-fence fallback: named-path receipt
  commit, direct push and labelled PR creation, then Yeet ready and bounded
  monitoring. The orchestrator owns repair and S11 merge; the live acceptance
  remains valid independent of inherited publication findings.
- Prevention: give advisory inventory admission explicit inherited attribution,
  then burn down those main findings once instead of duplicating lane repairs.
- Reversal: close PR4 or supersede the disposition with the orchestrator repair;
  retain both sealed families and aggregate evidence.
