# corpus-restore handoff — 2026-10-10, run 4

The latest orchestrator ruling authorizes engine diagnosis, PR3, and one separate
fresh family after content-final. PR2 #1600 remains untouched. The original
sealed ledger and output remain immutable; the previous handoff carries run-1
through run-3 evidence.

- Synced origin/main once; cut engine-fix branch from main
  `3994845679c5af743fbd29411df9c0c45139bd90`. Dependencies installed; lockfile unchanged.
- Packet adoption: zero conflicts. Doctor baseline: zero new/inherited blocking,
  three unrelated advisories. P0/P4 complete; P1 in-progress; P2/P3 pending.
- Read-only diagnosis: next duplicate digest
  `b2787c050ad43d05ded4f72d8ce4c7bf49ace11b8b766baccf6cd5c82899cf52`,
  246,088 bytes; already has copy and text. Two real Tika calls exit 0; one
  volatile parser-duration field differs; extracted content unchanged.
- Regression: varying parser output on duplicate attachments fails before fix;
  passes after first-evidence reuse. Existing duplicate-reuse test also passes.
- Private original live log remains 4 lines; no log lines or messages published.
- Original ledger SHA-256:
  `efb4b558c2d1680f87a684a69d6aa021653234d12928aa9f27a6943de8970e9f`.
- Decision: first successful Tika evidence is reused per digest within an attempt;
  canonical containment and nonempty checks remain. Reverse by reverting PR3.
- Fresh label: `t7-salvage-2026-08-10-p1-engine-fix`; same source and ceilings;
  reversal is closing PR3 and retaining both directories, as run-4 authorizes.

## Release notes without changesets

| Package | Change | Release impact | Reversal |
| --- | --- | --- | --- |
| @beep/repo-cli | Reuse first retained Tika evidence for duplicate attachment digests | Correctness fix, no major API or schema change; private workspace, no changeset under #1566 | Revert PR3 implementation and decision |

## Prerequisites remeasured

| Check | State | Value |
| --- | --- | --- |
| 3a preservation | met | Expected seal and run identity match; directory-pass 755, file-pass 10,696, inherited-loss 4, preflight 1, seal 1 |
| 3b selection | met | PST 53, eligible 23, input 56,140,800 bytes; selected object and digest unchanged |
| 3c state | met for diagnosis | Original sealed failure unchanged; fresh ledger absent; new-family authority is run 4 |
| 3d engines | met for versions | pffexport 20260917, bubblewrap 0.13.0, OpenJDK 27 (2026-09-15); real Java resolution and jar digest match original freeze; smokes pending |
| 3e capacity | met | 436,850,044,928 free bytes; above 100 GB floor |
| 3f synthetic exceptions | pending | Full package proof running; focused remeasurement follows |
| 3g main code | met for original fixes | Engine-fix branch starts at main; only new duplicate-evidence fix differs; run 4 allows fresh launch before merge |
| 3h capture | met | PR1 budget-bound capture retained; probe evidence remains 59 runs, 43 formerly truncated, zero nonzero/empty |
| 3i names | met | PR1 escape retained; probe evidence remains one backslash file, zero collisions and existing escape names |

Full package proof and hosted parity run through two own beep-heavy wrappers.
The diagnostic wrapper ended. No fresh live slice has started.

- Fresh-launch precondition not met: one public run label selects both the raw
  archive and the transformation output. A new label cannot use the retained
  sealed archive; the old label cannot reopen its sealed family. No fresh
  invocation, flag, alias, or manual run-tree write was made. Orchestrator owns
  the missing schema/command contract ruling. Reserved label is not launched.

- Hosted parity so far: test-tsgo pass, docgen-local pass, knowledge refs pass
  (45,539 observations, zero live gated). JSDoc Ratchet fails on eight totals:
  empty-section +9, leading-blank +7, missing categories +7, missing examples +6,
  missing since +7, schema annotations +16, trailing-blank +46, unsafe examples +2.
  Finding categories are inherited scratchpad source; this lane changes no export
  documentation and the scratchpad tree has no lane diff. No baseline is altered.
  Full package proof and Fallow remain active.

- Full @beep/repo-cli package-verify passed: audit 821.1 seconds, docgen 26.4
  seconds. Both real nested engine smokes exit 0. Scoped coverage remains active.
- Fallow complete lane passed, including audit, dead-code and health: zero
  introduced findings. Parity batch exit 1 belongs only to inherited JSDoc totals.
- All 593 scratchpad export files were compared byte-for-byte with main and match.
  No JSDoc finding file or baseline was edited.
- PR2 #1600 merged; incorporated main at `34c8928d779a4e59f42c747455f507d532727edf`.
  Packet conflicts were resolved by retaining all sealed-failure evidence, then
  adding run-4 diagnosis and contract blocker. Owned Corpus/libpff surfaces and
  lockfile did not change; package and parity evidence still cover the same code.
- No fresh freeze record, launch script, started stamp, result or run-tree write
  exists. Fresh launch is withheld on the independent-label contract precondition.

## Publication attribution and fallback

- Initial Yeet refusal: `yeet publish requires reviewed staged changes or a clean
  local commit ahead of the publish remote/base.` The receipt was unstaged;
  explicitly staging that one owned handoff corrected the intent precondition.
- Canonical publish then committed `63055473d6ee9825b53cbde66681fc13b3f6b783`
  and refused before push: `github-checks:cheap-gates: failed 2 step(s)`;
  `lint:schema-first: exit 1`; `lint:effect-vitest: exit 1`;
  `yeet publish cheap-gates failed after creating the local commit; nothing was
  pushed. Fix the gate, then amend or reset the unpushed commit before retrying.`
- Fourteen of sixteen gates pass, including committed JSDoc, Knip, private
  changeset-status, packet doctor/index, and all Fallow blocking lanes.
- Schema findings: two Accounts candidates and three unrelated test advisories.
  Effect-Vitest: one PracticeKg projections test finding. All finding surfaces
  match origin/main. Root P0 inbox receipt acknowledged with this attribution.
- The inherited-fence ruling and run 4 authorize direct push plus labelled PR
  creation after the full addressed wave. No finding inventory, CI rule, or
  baseline is changed. Reversal: close the unmerged PR and retain evidence.

- Prerequisite 3f freshly met: focused four exception/accounting/resume cases
  pass, 72 skipped, 3.27 seconds. Prerequisite 3d smokes freshly met: both exit 0.
- Freeze values match the original manifest. Selected objectId and SHA-256 remain
  `da19981ddcd62e532156584b7d8ef06762122f1cffc3f032ac36436d5492fdae` and
  `d547453d9d9680d28c898892982e8b3798452fa9e608a40f860ef88cd152907d`.
- Tika jar SHA-256 remains
  `0e8ee9795ac4244feab466f4a5a9c3b94675af392848243842cb6e1e69d27103`.
- Frozen prior ceilings remain ratio 4, attempt 7,200,000 ms, family 43,200,000 ms,
  output 2,147,483,648 bytes, floor 100,000,000,000 bytes; probe derivation is
  retained in the previous handoff. No fresh policy or launch-script digest exists.
- Graft retrieval saved approximately 52,465 tokens in one reported call.

## Completed run-4 proof

- Scoped coverage exit 0: 295 files, 5,892 tests, 1,484.75 seconds. Package
  percentages exceed the committed baseline: lines 86.38/85.11, statements
  86.05/84.91, branches 78.62/76.56, functions 82.96/81.10. The touched
  RestorationTransformations file is 100% in all four metrics. No baseline changed.
- Coverage wrapper unit `run-p1400125-i93542044.service` ended; both nested
  engine smokes exit 0. All own heavy verification wrappers are now terminal.
- Final required fetch/merge incorporated unrelated main work only; owned
  Corpus/libpff source, tests, and lockfile did not change. Full package and
  parity proofs remain applicable to the reviewed implementation.
- Post-diagnostic capacity: 433,952,366,592 free bytes. This measurement includes
  other machine activity and is not a fresh-run amplification result.


## Ready PR and blocked fresh launch

- PR3 #1606 is OPEN and ready, labelled ready-for-heavy. The published snapshot
  head is `d672b360744123fb7d9e92d6a5319e850e131a49`; API head matches.
- Full review-thread read: zero threads, complete pagination. Hosted checks still
  pending. Three Vercel build-rate-limit receipts were acknowledged as environment
  only; no purchase, source workaround, or quota change.
- Bounded monitor unit
  `beep-proof-d40a4917-428b-405b-ae11-f16551a88ebc.service` was submitted with a
  40-minute maximum, polled, deliberately cancelled for the blocked handoff,
  confirmed terminated, and its terminal receipt observed. The SPEC records the
  decision and reversal. No owned monitor, gate, or heavy wrapper remains active.
- Final snapshot knowledge refs: 45,551 observations (16,825 live, 28,726 archival),
  zero live gated. No source/test/lockfile changes after the completed proof.
- Final fetch and merge: already up to date. PR1 #1596 and PR2 #1600 are MERGED;
  this lane never merged a PR. PR3 remains the orchestrator's S11 responsibility.
- Fresh label contract remains unresolved; no fresh family was launched and no
  freeze manifest, launch script, stamp, result, or run directory was created.
  P1 remains in-progress, P0/P4 complete, P2/P3 pending, lifecycle active.
- Reversal: close PR3 and revert its engine fix; retain the original immutable
  ledger and output. Resume monitoring with the bounded command in SPEC. The
  orchestrator must rule on independent archive/output identities before launch.

## Final report for the verified implementation snapshot

This report names the published, fully verified implementation snapshot. The
following receipt-only commit records this report and the monitor handoff; the
terminal report names that commit's exact pushed head.

```text
lane: corpus-restore
head: d672b360744123fb7d9e92d6a5319e850e131a49 (verified implementation snapshot)
PR(s): #1596 MERGED; #1600 MERGED; #1606 OPEN, ready for review
package-verify: @beep/repo-cli: pass; @beep/libpff: not edited in run 4
hosted-parity: test-tsgo pass | docgen local pass | jsdoc-ratchet fail (inherited scratchpad totals; committed cheap gate pass) | knowledge refs pass (45,551 observations, zero live gated) | fallow audit+health pass | scoped coverage pass (295 files, 5,892 tests; touched file 100% in all four metrics)
handoff: goals/oppold-corpus-salvage-restoration/history/handoffs/corpus-restore-2026-10-10.md
open items: fresh slice blocked by coupled archive/output runLabel; independent identity contract requires orchestrator scope ruling. P1 stays in-progress. Engine fix reuses first retained Tika evidence, with regression and empty-evidence coverage; reverse by reverting PR3. Inherited publication/JSDoc reds assigned to orchestrator under S11. Monitor deliberately terminated and observed; reverse by resubmitting bounded monitor. Original sealed ledger retained unchanged; no fresh launch or acceptance claim.
blocked: fresh slice needs independent preservation and transformation labels; PR #1606 engine fix is ready.
```


- Receipt-only verification: knowledge refs pass again, 45,551 observations and
  zero live gated; goals doctor has 211 packets, zero new/inherited blocking,
  three unrelated advisories; goals index and whitespace check pass.
- First completed hosted red was read immediately: Repo Sanity job 114115190524,
  changeset-graph preflight, private-workspace release notes in
  `.changeset/effected-allowlist-drop.md` and `.changeset/jsonl-effect-first.md`.
  Both files match origin/main and have no lane diff. This is inherited and
  belongs to the orchestrator's S11 burn-down; no changeset or rule was edited.


## Run 5 — independent archive selector

- Started on PR3 #1606, OPEN and ready, at
  `d237794cdaf3fb46907469bf86bd937f0dcba9f4`; fetch/merge was already current.
  No unrelated dirty paths; dependencies present and lockfile unchanged.
- Applied run-5 authority: optional preservation selector defaults to the output
  label; a new output label selects the original sealed archive without aliases.
  Schema first, existing service contract retained, then runner/command wiring.
- Focused regression plus the four required exception/accounting/resume tests:
  five pass, 72 skipped, 3.57 seconds. Original family bytes unchanged by the test.
- Adoption: zero conflicts. Doctor: 211 packets, zero blocking, three unrelated
  advisories; this is the run-5 baseline. P0/P4 complete, P1 in-progress, P2/P3 pending.
- Environment receipt: initial beep-heavy wrappers refused before spawning
  (`DBUS_SESSION_BUS_ADDRESS` and `XDG_RUNTIME_DIR` absent). Supplying the
  established user-bus environment restores admission. No home configuration
  or unit files changed; Memory cap stays 32G, Turbo concurrency 2.
- Initial test-tsgo found three introduced diagnostics in the new test: prefer
  typed schema decoder and two pipeable opportunities. All three corrected;
  parity recheck follows. No compiler or lint suppression added.

### Run-5 prerequisite measurements

| Check | State | Measured value |
| --- | --- | --- |
| 3a preservation | met | archive-manifest-seal; directory 755, file 10,696, inherited-loss 4, preflight 1, seal 1 |
| 3b selection | met | PST 53, eligible 23; input 56,140,800 bytes; object and digest unchanged |
| 3c state | met | Original sealed failure SHA-256 unchanged; fresh family absent before launch |
| 3d engines | versions met; smokes pending | pffexport 20260917; bubblewrap 0.13.0; OpenJDK 27 dated 2026-09-15; Java resolution and jar digest match original freeze |
| 3e capacity | met | 435,364,773,888 bytes free; exceeds 100 GB floor |
| 3f synthetic lanes | met | Five focused tests pass including new selector regression |
| 3g code | authorized exception | PR1 fixes on main; run-4/5 permit PR3 content-final code before merge |
| 3h capture | met | Original probe retained: 59 runs, 43 formerly truncated; zero nonzero/empty |
| 3i names | met | Original probe retained: one backslash file, zero collisions and escape-name ambiguity |

| Package | Change | Release impact | Reversal |
| --- | --- | --- | --- |
| @beep/repo-cli | Optional preservation selector separate from output label | Backward-compatible optional API; no major release; private workspace, no changeset under #1566 | Close/revert PR3; retain both run directories |

- New date-stamped family reserved by run 5, same source, ceilings and engines.
  Existing failure ledger SHA-256 still
  `efb4b558c2d1680f87a684a69d6aa021653234d12928aa9f27a6943de8970e9f`.
  No new family has started at this receipt.

- Main's inherited-red burn-down #1605 arrived during proof. Merged main
  `3aa125a5d6b632f53a4bff0a99f49513e66bb459` once before publication. No owned
  Corpus/libpff surface, packet file or lockfile moved. The merge removes the
  inherited private-workspace changesets and updates inventories; no lane-owned
  repair or baseline change was made. A fresh quick package check and the one
  changed main test supplement the current full package proof.
- Local JSDoc Ratchet repeats all eight prior scratchpad total increases;
  scratchpad has zero diff against main. Hosted old-head Repo Sanity failed on
  the two private changesets now removed by #1605. Hosted JSDoc inventory gives
  only "Failed to generate JSDoc documentation inventory." Local inventory
  succeeds. Those old-head checks are superseded by the pending amended push.
- Fresh script SHA-256 reserved before launch:
  `f49f831f309f4b625167b25c8c415cca7705e2364a934e6a2012daaa14dd5ca2`.
  Original probe stderr remains one line. Both original identities match;
  the fresh ledger is absent. No corpus content or tool log lines were read out.

- Full @beep/repo-cli package verification passes: audit 766.7 seconds, docgen
  21.8 seconds. Main's changed Effect-imports test passes: 31 tests, 1.92 seconds.
  All five focused mail tests pass after diagnostics and formatting corrections
  (3.78 seconds). Package source has no subsequent lane edits.
- Full local docgen passes (two packages, 24.3 seconds); Fallow audit, health,
  dead-code and advisory lanes pass with zero introduced findings. Knowledge
  references pass: 45,552 observations, zero live gated. Scoped coverage is
  still running. A second heavy wrapper performs the fresh quick package check,
  test-tsgo recheck, and both nested real-engine smokes.

- Fresh quick package check passes: lint 3.7 seconds, check 6.7 seconds.
  Corrected test-tsgo passes; both nested real-engine smokes exit 0 (Tika 3.3.1
  and pffexport 20260917). No raised caps or engine changes.
- Publication will carry one addressed code wave on PR3 #1606. Fresh launch
  waits for coverage, then uses the code snapshot and separate freeze record.
  Live acceptance/outcome and the post-launch handoff append are PR4 material
  under run 5, without a second implementation push or a fourth PR now.

- Verified code snapshot committed at
  `005d103faf8ab7c529cae8acece27bf93bc0ab95`. The separate fresh run manifest
  names this snapshot, both labels, unchanged engines, source and ceilings,
  script digest, and an initially null policy digest (filled only from start).
- Post-#1605 schema scan now has zero enforced candidates, zero introduced
  ratchet findings, but still exits 1 on three inherited test advisories; all
  three files match origin/main. The standing inherited-fence ruling applies.
- 🌱 graft saved approximately 172,483 tokens in this run.


### Run-5 inherited publish fence

- Yeet committed the fresh freeze record as
  `d8b0e6f15516e38d2d0fe64f4fdf4c651447dea9` and refused before push:
  `github-checks:cheap-gates: failed 1 step(s)`; `lint:schema-first: exit 1`;
  `yeet publish cheap-gates failed after creating the local commit; nothing was
  pushed. Fix the gate, then amend or reset the unpushed commit before retrying.`
- Fifteen cheap gates pass, including Effect-Vitest, committed JSDoc, Knip,
  private changeset-status, packet doctor/index and Fallow audit/dead-code/health.
- Only three pre-existing schema-codec test advisories remain. Their files
  match origin/main. The inherited-fence ruling authorizes committing this
  receipt by name, then one direct push to the existing PR. No unrelated test,
  baseline, inventory or CI rule is edited. Reversal: close PR3, retain evidence.
- Fresh code snapshot and launch script remain unchanged; coverage continues.

- Root P0 publication row acknowledged as inherited/wontfix, assigned to the
  orchestrator under S11 and the standing fence. The initial acknowledgement
  used a lane label rather than the stable row id; listing the inbox and
  acknowledging the stable row completed the receipt.
- Coverage began before #1605's merge, then its new directory-removal regression
  encountered an older loaded module without the new NotFound recovery. Both
  files have zero diff against main; the old definition location differs from
  current source. Fresh standalone proof and the same V8 coverage script both
  pass all 31 tests (11.01 seconds for coverage). This is a mixed-revision proof
  environment, not a Corpus implementation failure.
- Stopped and observed the contaminated wrapper
  `run-p2241367-i94322145.service`, then restarted full scoped coverage against
  the stable committed source. The isolated V8 run uses a separate ignored
  report directory, preserving the full report. No source changed for this
  correction. Reverse by rerunning either proof; no corpus state exists yet.
