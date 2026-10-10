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
