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
