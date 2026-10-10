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


### Post-push receipts reserved for PR4 (run-5 authority)

- Single run-5 addressed-wave push confirmed on PR3 #1606:
  `b9544eaca267af17e10b12cd416e80285636a372`. PR stays OPEN and ready. Full
  thread read is complete with zero threads. Body updated for the final code.
- Bounded monitor submitted as
  `beep-proof-dbfe4297-6417-4c04-a9eb-1ee913238281.service` (40-minute maximum);
  waiting on the same job after the inherited Repo Sanity wave.
- Completed Repo Sanity job 114122237833 was read immediately: Syncpack fails
  on two inherited minimatch/smol-toml version mismatches. All manifests, lockfile
  and Syncpack inputs match main. Acknowledged under S11 for the orchestrator;
  no source or dependency edit. Vercel rate-limit receipt also acknowledged.
- The source and tests are byte-identical to the fresh manifest's code snapshot
  after publication. Full stable coverage is still running; no fresh family,
  launch stamp or result exists. Post-push aggregates, the filled policy digest
  and this report append will be PR4 material, preserving run 5's one code push.

### Run 5 fresh launch and hosted attribution

- Fresh launch n=2 submitted detached as `beep-heavy-corpus-restore-p1-2.service`.
  Source matches frozen code snapshot `005d103faf8ab7c529cae8acece27bf93bc0ab95`;
  published PR3 head is `b9544eaca267af17e10b12cd416e80285636a372`.
- Fresh output label: `t7-salvage-2026-08-10-p1-2026-10-10-engine-fix`;
  preservation selector: `t7-salvage-2026-08-10`.
- Ledger: `~/data-home/oppold-corpus/staging/restoration/runs/`
  `t7-salvage-2026-08-10-p1-2026-10-10-engine-fix/ledgers/mail/slice.jsonl`.
- Pre-launch free bytes: 432775737344; engine values and launch script match the
  committed fresh manifest. Original sealed run remains untouched.
- Hosted Heavy / Lint Policy job 114122483280 failed inherited tsgo profile/directive
  checks, 30 hoist-schema oxlint errors, three schema test advisories, JSDoc inventory
  generation, and two deprecated-API fixture project-service checks. Identified failing
  files and configs match origin/main; no Corpus finding. Inbox row
  `Heavy_Lint_Policy-50eaf9593865` acknowledged wontfix under S11.
- Hosted JSDoc Ratchet job 114122237783 failed inventory generation, matching the
  prior head failure class. Local inventory and committed JSDoc/package docgen pass.
  Inbox row `JSDoc_Ratchet-031f7615f63d` acknowledged wontfix under S11.
- These post-push receipts and the eventual aggregate slice outcome are reserved for
  PR4; run 5 authorizes one code push on PR3, already completed. No further push.

### Run 5 stable coverage and launch timestamp

- Scoped repo-cli coverage passed at the published code tree: 295 files, 5894 tests,
  1425.60 seconds. Statements 86.05%, branches 78.62%, functions 82.95%, lines
  86.38%; all exceed the package regression baseline (84.91%, 76.56%, 81.10%,
  85.11%, respectively). RestorationTransformations has 100% in all four metrics.
- Launch n=2 started at 2026-10-10T03:54:04.229Z. The detached unit is active;
  archive verification precedes the new family-run-start. No completion claim yet.
- Final pre-report fetch and merge origin/main: already up to date, no source change.

### Run 5 continuation boundary

- Latest ruling explicitly permits the detached live slice to outlive this worker.
  Unit `beep-heavy-corpus-restore-p1-2.service` remains active. Latest private log
  count: one line; verification-summary count: zero. No tool log lines were read.
- On continuation, poll `~/.cache/beep/corpus-restore/p1-fresh-slice-2.result`
  and the unit every 60 seconds. Read the fresh ledger only through projections
  that omit paths and messages. Fill `policySha256` in the committed fresh manifest
  exactly once from its first family-run-start; its current null is pending,
  not a changed policy. Freeze source and engines until the family seals.
- Retain the original ledger SHA-256
  `efb4b558c2d1680f87a684a69d6aa021653234d12928aa9f27a6943de8970e9f`.
  A nonzero live result, exception, warning, or sealed failure stops the lane;
  never mutate or retry a sealed run. Original and fresh output trees stay intact.
- The local readiness monitor was cancelled and observed terminal (exit 130,
  cancelled, no verdict); its unit is inactive. All inbox rows are acknowledged.
  Orchestrator owns the next monitor and S11 merge gate. Never merge from this lane.
- PR3 received exactly one run-5 code push. These post-push continuation receipts
  remain uncommitted for later PR4 with the aggregate outcome; no fourth PR opened.
- Graft lookup reported about 172483 tokens saved.

### Run 5 final report

```text
lane: corpus-restore
head: b9544eaca267af17e10b12cd416e80285636a372 (exact published PR3 head)
PR(s): #1596 MERGED; #1600 MERGED; #1606 OPEN, content-final and ready, not merged
package-verify: @beep/repo-cli: pass (full audit and docgen, plus fresh lint/check after main integration); @beep/libpff: not edited in run 5, merged PR1 proof retained
hosted-parity: test-tsgo: pass (335 files); docgen local: pass; jsdoc-ratchet: fail, inherited scratchpad totals, while committed JSDoc and package docgen pass; knowledge refs: pass (45552 observations, zero live gated findings); fallow audit+health: pass, zero introduced findings; scoped coverage: pass (295 files, 5894 tests; lines 86.38%, statements 86.05%, branches 78.62%, functions 82.95%, all above baseline; RestorationTransformations 100% in all four metrics)
handoff: goals/oppold-corpus-salvage-restoration/history/handoffs/corpus-restore-2026-10-10.md
open items: Fresh slice n=2 started at 2026-10-10T03:54:04.229Z under the run-5 detached-handoff authority and remains active during archive verification; no fresh ledger or acceptance result yet. Optional preservationLabel now selects the original archive while runLabel names fresh transformation output. Original sealed ledger SHA-256 is unchanged. Freeze source and engines until seal; fill the fresh manifest policy hash once from its first family-run-start, then collect sanitized aggregates for later PR4. Post-push SPEC, handoff, and OPPORTUNITIES receipts remain uncommitted for that PR4; the one authorized PR3 code push is complete. Hosted Repo Sanity, JSDoc Ratchet, and Lint Policy reds are attributed to unchanged main files and acknowledged for the orchestrator's S11 burn-down. Zero review threads and zero unacknowledged inbox rows. Local readiness monitor cancelled and observed terminal; no merge-ready verdict claimed. Reversal: close/revert PR3 and retain both run directories. Never retry or mutate a sealed family. Graft reported about 172483 tokens saved.
final b9544eaca267af17e10b12cd416e80285636a372 #1606
beep-heavy-corpus-restore-p1-2.service
```

## Run 6 — accepted fresh slice, PR4 evidence

- Read the complete updated brief; latest run-6 ruling governs this relaunch.
  Fresh unit is inactive and result is 0. No new slice, source edit, or run-tree
  write was made. The original sealed failure ledger digest remains unchanged.
- Fetched main and cut the prescribed slice-evidence branch at
  `9e0711e4591b74825b56fab5c0ad13c3246c66d3`; API confirms PR3 #1606 MERGED.
  Preserved the three owned post-push dirty receipts for this PR.
- Read-only packet adoption: zero conflicts. Doctor baseline: 211 packets,
  zero new/inherited blocking findings, three unrelated advisories.
- Graft lookup reported approximately 62,624 tokens saved in one call.

### Prerequisites remeasured on run 6

| Check | State | Measured value |
| --- | --- | --- |
| 3a preservation | met | Original run and archive-manifest-seal match; directory-pass 755, file-pass 10,696, loss 4, preflight 1, seal 1 |
| 3b selection | met | PST 53, eligible 23; input 56,140,800 bytes; source object and digest match frozen manifest |
| 3c state | met | Fresh final acceptance-pass, expected/terminal 1, unapproved 0; original failure unchanged |
| 3d engines | met | pffexport 20260917, bubblewrap 0.13.0, OpenJDK 27 (2026-09-15); real Java and Tika digest match manifest; both nested sandbox smokes exit 0 |
| 3e capacity | met | Pre-launch 432,775,737,344 bytes; post-run 432,579,956,736, above 100 GB floor |
| 3f synthetic lanes | met | Four required tests pass freshly, 73 skipped, 2.53 seconds |
| 3g main code | met | Corpus/libpff source diff against main empty; PR1 and PR3 fixes merged |
| 3h capture | met | Budget capture retained; 59 probe runs, 43 formerly truncated, zero nonzero/empty |
| 3i names | met | Escape retained; one probe backslash file, zero collisions and existing escape names |

### Fresh aggregate result

- Unit `beep-heavy-corpus-restore-p1-2.service`, n=2; attempt
  `mail:011b25c2d38deca005ce17dd:r0`, retry ordinal zero.
- Record counts: start 1, attempt-start 1, store-pass 1, child-pass 3,339,
  repair 206, summary 1, acceptance-pass 1; exception/warning/interruption 0.
- Input 56,140,800 bytes; store output and family du 132,668,272 bytes;
  attempt/family disk amplification 2.363134690x, below 4x.
- Attempt 809,685 ms, 15,122.981 ms/MiB; family 822,686 ms.
  Archive re-verification 254,472 ms; separate queue duration unavailable
  because the prior receipt omitted submission time. No inferred timing claim.
- Engine children 3,237; accounted children 3,339; derived copy 51 and Tika 51,
  other 0; 59 repaired occurrences / 51 distinct digests, unsupported 147,
  unchanged 0. Zero unaccounted children; every step-7 acceptance predicate true.
- Private log counts: two lines, one verification summary; no lines copied.
- Fresh ledger SHA-256:
  `33ad3245d090f519b573769503ebb39162a8806864f664ab0817b705a72fccf5`.
- Fresh policy hash filled once from first start:
  `2bc3fc673c343ef6008b9b3bb1c85e000ac59239d345f3e50d4d08aaf6a5a2c8`.
  All other frozen fields and the launch-script hash remain unchanged.
- All five SPEC P1 boxes and GOAL P1 box supported; P1 phase flipped complete.
  P0/P4 complete, P2/P3 pending, lifecycle active. No reflection or later phase
  work is started. Reversal: revert PR4 packet flips, retain both immutable
  families; R7 whole-run removal remains the orchestrator's authority.
- Full aggregate record and frozen manifest accompany this PR; the receipts
  reserved after PR3's one addressed push are retained together.
- Package-verify: no edited package in this docs-only PR; PR3's full CLI audit,
  docgen and fresh quick checks passed. All six hosted-parity source lanes
  not run for this PR (docs-only); PR3 results remain above. Packet knowledge
  references are checked separately as the step-8 matrix requires.

- Run-6 pre-publication matrix: GOAL budget, manifest JSON, required packet
  references, goals doctor, goals index, and whitespace checks pass.
  Knowledge refs at main snapshot: 45,552 observations, zero live gated.
  Final fetch/merge before publication is current; no package or lockfile diff.
- Content-final scope is packet-only. PR4 publishes acceptance evidence,
  the one-time policy fill and phase flips together with all retained receipts.
  P2/P3 and unrelated inherited main findings remain outside this lane.

### Run-6 publication refusal and authorized fallback

- Yeet committed evidence at
  `11f593b957c0c21a7a2386efc6cc10a4db95e2d7` and refused before push:
  `github-checks:cheap-gates: failed 1 step(s)`; `lint:schema-first: exit 1`;
  `yeet publish cheap-gates failed after creating the local commit; nothing
  was pushed.`
- Fifteen gates pass, including committed JSDoc, Effect-Vitest, Knip, Fallow
  audit/dead-code/health, packet doctor/index, and changeset-status.
- The only findings are the same three inherited schema-codec test advisories.
  All affected test files and their inventory match origin/main byte-for-byte.
  No source or inventory edit is made; the standing inherited fence authorizes
  named-path receipt commit, direct push, labelled PR, ready and bounded monitor.
- Exact committed knowledge check: 45,555 observations, zero live gated.
  Lifecycle and all untouched phases stay correct. Reverse this disposition by
  closing PR4, retaining both sealed families, or the orchestrator's main repair.

### Run-6 ready PR and monitor closeout

- PR4 #1609 OPEN and ready, heavy label present; API head matches published
  `4f24989ecd35f24b947ef29ea8a3d002aea46944`. Branch and source are current.
- Full paginated review read returns zero threads; no unanswered thread exists.
  Yeet reply was invoked and returned no drafts; no reply is needed for zero threads.
- Bounded monitor submitted, polled with a ten-second wait (timeout did not end
  the job), then deliberately cancelled for the worker handoff. Terminal status
  observed and acknowledged; unit inactive. SPEC records reason and reversal.
  No readiness verdict is claimed; the orchestrator owns the next S11 gate.
- Three Vercel deployment build-rate-limit rows acknowledged environment-only.
  No completed required hosted red exists at this observation. Hosted checks
  and the twenty-minute review window remain pending.
- Zero unacknowledged inbox rows. All owned heavy wrappers, live slice unit,
  and bounded readiness monitor are now terminal. This lane never merged.
- Final required fetch/merge current. All source and frozen fields remain fixed;
  only terminal publication receipts and this report are added next.

### Run-6 final report — verified packet snapshot

This report describes the published packet snapshot below. A final receipt-only
commit records the report and monitor handoff; the terminal report names that
receipt commit's exact pushed head. No package, live ledger or acceptance data
changes in that receipt wave.

```text
lane: corpus-restore
head: 4f24989ecd35f24b947ef29ea8a3d002aea46944 (verified published packet snapshot)
PR(s): #1596 MERGED; #1600 MERGED; #1606 MERGED; #1609 OPEN, content-final and ready for review
package-verify: not run (PR4 is docs-only; no edited package); @beep/repo-cli full pass from PR3 retained; @beep/libpff PR1 pass retained
hosted-parity: test-tsgo: not run (docs-only; PR3 pass retained) | docgen local: not run (docs-only; PR3 pass retained) | jsdoc-ratchet: not run (docs-only; PR3 inherited failure retained; PR4 committed cheap gate pass) | knowledge refs: pass as packet matrix (45555 observations, zero live gated); source parity not run (docs-only) | fallow audit+health: pass in collected cheap gates, zero introduced findings; full parity not run (docs-only; PR3 pass retained) | scoped coverage: not run (docs-only; PR3 5894 tests and above-baseline coverage retained)
handoff: goals/oppold-corpus-salvage-restoration/history/handoffs/corpus-restore-2026-10-10.md
open items: P1 complete: fresh family accepted one store, 3339 accounted children, zero unapproved rows/warnings/exceptions; 59 repaired occurrences with 51 copy/Tika digest pairs, 147 unsupported dispositions; output 132668272 bytes / input 56140800 bytes = 2.363134690x, attempt 809685 ms, family 822686 ms, re-verification 254472 ms, all ceilings hold. Queue duration unavailable because prior receipt omitted submission timestamp. Policy hash filled exactly once; original failure ledger unchanged. P0/P4 complete, P2/P3 pending and lifecycle active; orchestrator owns P2 ceilings and expansion. PR4 required CI and review window pending; inherited schema test advisories assigned under S11, no source/inventory/CI waiver. Bounded monitor cancelled and observed terminal; resume with the same bounded command if needed. Reverse packet flips by reverting PR4 and retain both immutable families. Zero review threads and unacknowledged inbox rows; no worker-owned job running; never merged. Graft reported approximately 62624 tokens saved in one call.
final 4f24989ecd35f24b947ef29ea8a3d002aea46944 #1609
```


## Run 7 amendment: policy-identity review, no P2 launch

Latest scope is the 05:45:31Z ruling: answer PR4 #1609 first, one push on the
existing slice branch, no P2 and no merge. Main was fetched and merged once.
Worktree started clean; package source equals main. Packet doctor baseline:
zero new/inherited blockers; three unrelated advisories, none for this packet.

| Relaunch prerequisite | State | Measured evidence |
| --- | --- | --- |
| P0 seal | met | 755 directory passes, 10696 file passes, four inherited losses, one preflight, one seal; expected run identity unchanged |
| Metadata candidate | met | 23 eligible; input 56140800 bytes; object and source digest match both manifests |
| Transformation state | met | Original sealed failure and fresh sealed pass; ledger SHA-256 values unchanged |
| Engine identity | met | pffexport 20260917, bubblewrap 0.13.0, OpenJDK 27 dated 2026-09-15; Java real path and Tika digest unchanged |
| Capacity | met | 195356336128 free bytes, above 100000000000 floor; no new run planned |
| Main code | met | No diff in owned Corpus or libpff source; no package edited |
| Capture and portable-name fixes | retained | PR1 merged; probe and synthetic proof retained; no new probe or code changes |
| Live unit and result | met | n=2 unit inactive, result 0; private log two lines; no private log or journal text read |

Freeze provenance is independently established by commit
`d8b0e6f15516e38d2d0fe64f4fdf4c651447dea9`, timestamp 03:24:20Z,
preceding script start 03:54:04.229Z and family start 03:58:18.701Z.
All source, engine, ceiling, code and script fields are already there;
structural comparison proves only the authorized null-to-policy fill changed.
Retained launch script SHA-256 matches
`f49f831f309f4b625167b25c8c415cca7705e2364a934e6a2012daaa14dd5ca2`.
Both ledgers and both manifests contain policy SHA-256
`2bc3fc673c343ef6008b9b3bb1c85e000ac59239d345f3e50d4d08aaf6a5a2c8`.
The review's alternate
`1fcde5680cb42357e784ae4309cd05ce633999bc79b582479219ed07915d090e`
is reproduced exactly by hashing a literal home alias. Runtime expansion
reproduces the persisted hash. #1606 changed code identity, not these hash
inputs. The acceptance and SPEC append preserve both digests, associate each
execution with its own freeze record, and document this verified distinction.

Decision: P1 remains complete because its separate fresh freeze record was
complete before execution, except the policy fill authorized by runs 5/6.
Reversal: revert PR4 phase flips and reopen P1; retain both immutable families
and manifests. P2 remains pending and no expansion is launched in this run.
Original ledger SHA-256 remains
`efb4b558c2d1680f87a684a69d6aa021653234d12928aa9f27a6943de8970e9f`;
fresh ledger SHA-256 remains
`33ad3245d090f519b573769503ebb39162a8806864f664ab0817b705a72fccf5`.
Graft reported approximately 52649 tokens saved in one call.

Run-7 verification: four required synthetic restoration tests pass, 73 skipped,
4.37 seconds. Both real sandbox engine smokes pass. The first combined smoke
wrapper lost its command arguments and failed before any corpus invocation;
the exact direct commands from the brief then passed. No live run was launched.
Packet doctor/index, manifest parse, GOAL budget, required reference search,
knowledge refs (zero live gated observations), and diff whitespace checks pass.
Both immutable manifests are byte-identical to the pre-correction head.
Added prose contains no absolute home paths or ledger path/message fields.
Package-verify and source hosted-parity are not run for this packet-only wave;
PR1/PR3 package proof and hosted attribution remain the retained source evidence.

### Run-7 publication fence and single-push fallback

Yeet committed the correction at
`f335de0b83f88a8a8b8e5c84481b054f20551f95`; collected cheap gates
passed 15 of 16 lanes. Exact refusal:
`github-checks:cheap-gates: failed 1 step(s)`;
`lint:schema-first: exit 1`;
`yeet publish cheap-gates failed after creating the local commit; nothing was
pushed. Fix the gate, then amend or reset the unpushed commit before retrying.`
Three schema-codec test advisories are inherited: their files match origin/main
byte for byte. No Corpus finding, no introduced parity finding, no source edit.
Committed JSDoc, Effect-Vitest, Knip and Fallow audit/dead-code/health pass.
The standing inherited-fence ruling authorizes a named receipt commit and
one direct push of the fully addressed wave to existing PR4 #1609.
The PR is already ready; Yeet ready is repeated after the push. Thread reply
will cite pre-launch commit evidence and exact runtime hash reconstruction.
Orchestrator owns S11 merge and inherited main repair. No new monitor is
started for this review-only amendment; no worker-owned job remains running.
Reversal: close/revert PR4's documentation changes and retain both families.
