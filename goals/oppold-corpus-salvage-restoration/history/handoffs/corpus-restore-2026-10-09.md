# corpus-restore handoff — 2026-10-09

## Launch baseline

- Expected branch confirmed clean. Synced main from `7febc0287bed98ae84659ee7278e3fe8f2e28b65` to `36027982f2`. Lockfile unchanged; installed dependencies retained.
- Packet adoption plan: no conflicts, authored files retained, manifest unmodeled keys preserved.
- Goals doctor baseline: 0 new blocking, 0 inherited blocking; 3 unrelated advisories; no finding for this packet.
- P0 and P4 complete; P1, P2 and P3 pending. Scope is P1 only.
- No launch, probe, fix, or ceiling decision yet.

## Prerequisites measured

| Check | State | Measurement |
| --- | --- | --- |
| 3a P0 | met | P0 complete; expected seal matched; directory-pass 755, file-pass 10,696, inherited-loss 4, preflight 1, seal 1 |
| 3b selection | met | PST 53; eligible recycle candidates 23; selected input 56,140,800 bytes |
| 3c transformation | met | No slice ledger exists |
| 3d versions | met | pffexport 20260917; bubblewrap 0.13.0; OpenJDK 27 (2026-09-15); sandbox smokes pending slot |
| 3e capacity | met | 471,790,534,656 free bytes; above 100 GB floor |
| 3f synthetic lanes | pending | Four focused cases queued through beep-heavy |
| 3g main code | met | Corpus and libpff source diff empty |
| 3h capture | pending | Existing 4,096-character bound; probe required |
| 3i names | pending | Escape/collision counts require probe |

- Selected objectId: `da19981ddcd62e532156584b7d8ef06762122f1cffc3f032ac36436d5492fdae`.
- Selected SHA-256: `d547453d9d9680d28c898892982e8b3798452fa9e608a40f860ef88cd152907d`.
- Tika jar SHA-256: `0e8ee9795ac4244feab466f4a5a9c3b94675af392848243842cb6e1e69d27103`.
- Environment-only launch failure occurred before either heavy command started: user-bus variables absent. Existing user bus verified; explicit environment supplied for the queued commands. No corpus writes.

- Prerequisite queue exceeds ten minutes; both admitted wrappers remain live and pending. No output from either underlying command yet. Probe script syntax validated; probe script SHA-256 `9e11ebbf9d38693673ef8f02f00dc475234148448af33cffca63fde8e1327fc2`.

- Prerequisite transient units: `run-p2001746-i35526352.service` and `run-p2003442-i35498965.service`. Both confirmed owned by this lane and still pending at 17 minutes. Heavy-job cap remains 32G; at most two own jobs.

- Tika nested sandbox smoke: exit 0, Apache Tika 3.3.1. The pffexport nested sandbox smoke is queued; focused synthetic suite remains queued. No live transformation started.

- Before any probe run, aligned dotfile extension classification and preserved trailing newline bytes during component escape/lowercase shell substitutions. Revised probe script SHA-256: `142e63874c0d66fe710c20fb8966a47a9256a8770b3d0e222a3a1a43202a2957`; syntax pass. This supersedes the unexecuted script digest above.

- Focused prerequisite suite admission wait reached one hour. It remains live in the shared-slot queue; pffexport smoke is also queued. Tika smoke passed. Probe and immutable live slice remain unlaunched.

- pffexport nested sandbox smoke: exit 0, pffexport 20260917. Both real engine smokes now pass. Focused synthetic prerequisite suite remains queued; no probe or live run yet.

- Focused synthetic prerequisite: exit 0; 1 file, 4 tests passed, 69 skipped, 5.72 seconds. Corrupt/password/codepage classification, approved corrupt handling, raw/repaired child accounting, and interrupted/pending-summary resume all pass. All step-3 runtime prerequisites now met.

- RAM-only probe submitted after all prerequisites passed; unit `run-p1833919-i39505742.service`. Pending admission; count rows 0 and private stderr line count 1. No corpus output has left RAM, and no live slice ledger exists.
- Lane caps verified: MemoryHigh 38,654,705,664 bytes, MemoryMax 42,949,672,960 bytes, MemorySwapMax 0. Current diff whitespace check passes.

## Probe partial measurement

- pffexport exit 0; 583 ms; export files 2,630; export bytes 46,317,339; orphans and recovered files/bytes 0; total entries 3,399.
- Backslash files 1, directories 0; escape collisions 0; existing percent-escape names 0. Items 607; existing synthesized EML collisions 0.
- Second-pass failure-mode counts are pending. No fix or live-run decision yet.

## Completed dry probe and pre-run decisions

```text
pffexport_rc=0
pffexport_ms=583
export_files=2630
export_bytes=46317339
orphans_files=0
orphans_bytes=0
recovered_files=0
recovered_bytes=0
entries_total=3399
backslash_files=1
backslash_dirs=0
backslash_escape_collisions=0
pct5c_names=0
items=607
message_eml_present=0
attachment_files=206
attachment_bytes=41580376
unsupported=147
unchanged=0
repair_candidates=59
repair_bytes=19659481
tika_nonzero_exit=0
tika_over_4096=43
tika_empty=0
tika_runs=59
tika_max_chars=1578537
tika_total_bytes=5252872
tika_ms=894687
tree_hash_ms=35
```

Probe exit 0; private stderr line count 1. No stop condition fired. Both bounded fixes are required.
Probe script SHA-256: `142e63874c0d66fe710c20fb8966a47a9256a8770b3d0e222a3a1a43202a2957`.
The two focused synthetic tests in each package passed. Fixes retain full budget-bounded Tika
text and escape engine names before references while preserving original MIME display names.
The libpff patch changeset is `.changeset/oppold-corpus-p1-libpff-backslash-names.md`.
Reversal: revert each edit, including the changeset; no live ledger exists.

Ceilings: O=137170718.43, 1.5O/I rounds up to 4, attempt=224563200 bytes;
elapsed expression=3298200 ms, chosen=7200000 ms; output expression=561408000 bytes,
chosen=2147483648 bytes; total elapsed=43200000 ms; free-space floor=100000000000 bytes.
SPEC records every term, the freeze-manifest decision, and the P1 output authority.

- Full single-file suites: libpff 38/38 pass (3.16 seconds); corpus-command 75/75 pass
  (33.03 seconds). Expanded budget fixture also passes with UTF-8 bytes exceeding budget
  even when character count fits. Schema-first lint passes with zero introduced violations.
- Both full package-verification jobs are queued through beep-heavy; no live ledger exists.

- Full verification units: `run-p264018-i42141827.service` (libpff) and
  `run-p265762-i42059206.service` (repo-cli). Both remain queued with two tasks each.
  Live wrapper reports four busy machine-wide slots; this lane keeps at most two own jobs.
- Packet doctor after decisions: baseline unchanged, zero new/inherited blocking findings,
  three unrelated advisories. No P1 acceptance checkbox or phase-completion state was flipped.

- Quota-path review found that raw handoff validation precedes the escape. Canonical resolution
  now checks each ancestor while retaining literal backslash components. This remains inside
  the bounded libpff fix. A quota-handoff fixture confirms five accounted children, no warnings,
  portable references, and original MIME display names. Full libpff suite: 39/39 pass.

- Full @beep/libpff package verification passed: audit 11.2 seconds, docgen 2.7 seconds.
  Its unit ended. Full @beep/repo-cli verification is now admitted. Hosted-parity batch A
  submitted through beep-heavy in the freed slot; at most two own jobs remain live.
- The quota fixture additionally rejects a symbolic link below a backslash-bearing directory.

- Hosted parity: test-tsgo pass; jsdoc-ratchet pass (zero increases; zero legacy findings).
  Knowledge refs exits 1 on one inherited gated reference in an unrelated packet's SPEC,
  classified external-mirror-reference. That file has no lane diff and its HEAD/origin-main
  blob matches. No corpus-restore gated reference was reported. Leave the unrelated repair
  to the orchestrator's consolidated red work under S11; no outside-scope edit made.
- Hosted-parity batch A ended. Batch B submitted in its freed slot; repo-cli verification
  remains active. The live slice remains unlaunched.

- Attribution correction: the unrelated SPEC has no lane diff and matches the original
  main base 36027982f2, but origin/main advanced during the proof and its blob now differs.
  The preceding HEAD/origin-main equality sentence was incorrect. The gate is inherited
  from the tested base; inspect the newer main at the required pre-publication merge.

- Full @beep/repo-cli package verification passed: audit 866.9 seconds, docgen 36.7 seconds.
  Both edited packages are green. Docgen-local also passed for both and selected dependents.
- Fallow blocking lane returned 1; attribution is being read from its generated reports before
  any remediation. Scoped coverage is now running in the same heavy batch.

- Fallow attribution: introduced cognitive complexity 10 (ceiling 8) in the new
  name walk; audit and health identify the same function. Flattened file-kind
  dispatch with Match, preserving collision and filesystem safety semantics.
  No baseline or suppression changed; reversal remains reverting the bounded fix.

- Fresh libpff package verification after Match dispatch: pass (audit 10.6 seconds,
  docgen 2.7 seconds). Fresh full Fallow lane: pass, including audit and health;
  introduced findings 0. Repair-check unit ended successfully. Scoped coverage remains active.

- Release-note correction: package metadata marks libpff private. Main #1566 and the
  brief's 2026-10-09T20:33Z standing ruling supersede R3. Removed the unpublished patch
  changeset; the earlier changeset receipt is historical and no longer describes the diff.

### Release notes without changesets

| Package | Change | Release impact | Reversal |
| --- | --- | --- | --- |
| @beep/libpff | Escape engine backslash names on disk and retain MIME display names | Correctness fix; no major API or schema change. Public path-schema widening would have changed the contract and was rejected. Private workspace: no changeset under #1566. | Revert the bounded implementation and release-note decision. |
| @beep/repo-cli | Capture complete Tika text within remaining byte and time budgets | Correctness fix; no major API or schema change. Private workspace: no changeset under #1566. | Revert the bounded implementation and release-note decision. |

- Pre-publication scoped coverage: repo-cli 290 files and 5,786 tests pass (1,866.04 seconds);
  libpff four files and 71 tests pass (5.91 seconds). All package coverage percentages exceed
  the committed baseline: CLI lines 86.62/85.11, statements 86.34/84.91, branches 78.90/76.56,
  functions 83.21/81.10; libpff lines 91.34/89.14, statements 90.97/89.20,
  branches 83.22/79.19, functions 82.08/76.87. No baseline changed.
- The parity-B batch's overall exit 1 belongs to its earlier Fallow result; the fresh
  repair-check Fallow run passes. Both coverage commands exited 0. All own units have ended.
- Required pre-publication merge fast-forwarded to 2d4a81216fb666df477341ed125dcb4ddd7b5838.
  No touched package surface or lockfile changed in the merge; no install was required.
  Published-head checks will remeasure the inherited knowledge-reference repair.

- Per-file coverage comparison identified one introduced uncovered statement/branch at
  Tika's zero-remaining-budget guard (99.93% lines / 99.94% statements / 99.87% branches
  against 100%). Added an exhausted-retained-output test that uses unavailable Java/Tika
  paths and proves the budget error happens before launch, retaining the original bytes
  and creating no child. Focused test passes; published-head full coverage will remeasure it.
  Both touched libpff files exceed all their percentage baselines.
- Initial publish wrapper exited before starting because that shell omitted the user-bus
  exports. No commit/push occurred. Restored the prescribed environment for publication.

- Full transformation-helper suite after the exhausted-budget test: 33/33 pass
  (4.01 seconds). Initial publication waited about 26 minutes, then refused unstaged
  changes before committing. Explicitly staged the reviewed owned files for the retry.
  The two newly available main commits were merged first; no touched code or lock changed.

- Merge attribution correction: the second merge to cb64e0484f changed bun.lock;
  touched Corpus/libpff sources and tests were unchanged. Frozen install passed,
  installing three packages and refreshing the existing compiler patch. No lane
  lockfile edit resulted; both forbidden reference links remain absent. The preceding
  no-lock-change sentence applies only to the earlier merge to 2d4a81216f.

- PR1 publication created local commit b4cb1915f8, then cheap gates failed before push.
  Fourteen of sixteen gates passed, including schema/import governance except schema-first,
  doctor, committed JSDoc, Knip, and Fallow audit/dead-code/health. No PR exists yet.
- Attribution: AccountsSecretField/AccountsSecretsItem and schema-first inventory blobs
  match origin/main exactly; neither has a lane diff. Effect-Vitest reports thirteen
  findings outside ownership and three here. Repaired the three scoped findings with
  explicit 30-second resource hook timeouts and the existing Effect assertion helper.
  No inventory baseline or unrelated file changed. The root-gate inbox row was acknowledged
  with the outside-scope ownership explanation; this does not bypass publication gates.

- Fresh libpff verification passed (audit 12.0 seconds, docgen 2.9 seconds).
  Test-tsgo found an introduced missed-pipeable-opportunity diagnostic in the assertion
  helper form. Changed only that test expression to its equivalent pipeable form;
  a fresh test-tsgo run will supersede this batch's earlier failed result.

- Fresh repo-cli package verification passed (audit 875.1 seconds, docgen 32.9 seconds).
  Fresh docgen-local, JSDoc ratchet, Fallow audit/health, and libpff scoped coverage pass.
  The CLI full coverage run is now active.
- Knowledge-reference attribution: five introduced external-mirror observations in this
  packet's required corpus/Tika/scratch location prose. Converted those records to explicit
  location and invocation inventories, preserving every value and authority. No census
  classifier or baseline changed; a fresh checked census is required after committing.
- The attribution-only JSON projection was invoked directly; the authoritative parity run
  was wrapped. Subsequent checked censuses use beep-heavy as required by Mechanics.

- Fresh CLI scoped coverage passed: 295 files, 5,890 tests, 1,737.14 seconds.
  Current/baseline percentages: lines 86.37/85.11, statements 86.05/84.91,
  branches 78.61/76.56, functions 82.95/81.10. RestorationTransformations is
  100% in all four metrics, including the new exhausted-budget guard. Libpff remains
  above all four package and touched-file percentage baselines; no baseline changed.
- Fresh test-tsgo passes after the pipeable assertion repair. Authoritative wrapped
  knowledge refs passes with 45,465 observations and zero gated references. Earlier
  batch failures are superseded by these fresh successful checks. Both full package
  verifications, docgen-local, JSDoc ratchet, Fallow audit/health, and scoped coverage pass.
- All verification units ended. Required main merge brought in 45f334e3c2 with no
  touched Corpus/libpff surface change. Its lockfile changed; frozen install passed.
  The final addressed wave is being submitted through Yeet; the live slice is unlaunched.

- Final publication attempt at e28c05e49762343be2e85903d35f59cd1a92804a failed before push.
  Fifteen of sixteen cheap gates passed; Effect-Vitest now reports zero introduced findings.
  Only schema-first failed: five untracked inherited entries (two Accounts candidates and
  three unrelated test advisories). All five source surfaces and the inventory have no diff
  against origin/main. The orchestrator owns that consolidated main repair; no outside-scope
  file or baseline was changed. Publication gates were not bypassed.
- Remote branch PR query returns none. Active own unit count is zero. Slice ledger remains
  absent; no launch script/run manifest/final file was created and no live run was started.
  Both forbidden reference links remain absent, and the worktree was clean before this receipt.
- Proof scope: package/parity measurements precede the final main-only dependency merge;
  touched Corpus/libpff source and tests were unchanged by that merge, and frozen install passed.
  The final cheap-gate verdict is for the exact publication-attempt head. After the shared main
  repair, repeat step 4d's published-head checks before R2's final file. No P1 box was flipped.

### Final report

lane: corpus-restore
head: e28c05e49762343be2e85903d35f59cd1a92804a (publication-attempt head; the following closeout commit changes packet receipts only)
PR(s): none (Yeet stopped before push on inherited schema-first inventory; remote PR query empty)
package-verify: @beep/repo-cli: pass; @beep/libpff: pass (full checks before final main-only dependency merge; owned source unchanged)
hosted-parity: test-tsgo: pass | docgen local: pass | jsdoc-ratchet: pass | knowledge refs: pass, zero gated | fallow audit+health: pass | scoped coverage: pass, CLI 5,890 tests and libpff 71 tests, all package percentages above baseline; restoration file 100% in every metric
handoff: goals/oppold-corpus-salvage-restoration/history/handoffs/corpus-restore-2026-10-09.md
open items: Orchestrator must repair five inherited schema-first inventory entries on main (two Accounts candidates, three unrelated test advisories). Then merge main, publish PR1, run published-head checks, ready and write the R2 final file; wait for orchestrator merge before the frozen live slice. Decisions: budget-bound Tika capture, libpff on-disk name escape, ratio 4, attempt 7,200,000 ms, total 43,200,000 ms, total output 2,147,483,648 bytes, 100 GB free floor, R6 manifest and R7 output authority; reverse by reverting local fixes/docs before launch. Private workspaces carry release notes without changesets under #1566. P1 remains pending; no live ledger or corpus output was written. All own units ended.
blocked: PR1 publication needs the inherited schema-first inventory repair on main; live slice unlaunched.

## Run 2 — authorized inherited-fence fallback

The 2026-10-09T23:42Z orchestrator ruling supersedes the preceding run-1 blocker.
Fetch and merge completed at `1d854a1e8ec46fd48b9e20d68477363f98250cc0`;
main was already incorporated. No owned file or lockfile changed, so full package
verification and hosted-parity results above are retained under that ruling.

| Prerequisite | State | Re-measurement |
| --- | --- | --- |
| 3a P0 | met | P0 complete; expected seal matched; directory-pass 755, file-pass 10,696, inherited-loss 4, preflight 1, seal 1 |
| 3b selection | met | PST 53; eligible 23; input 56,140,800 bytes; selected object and source digest unchanged |
| 3c state | met | Slice ledger absent; frozen manifest absent; no live invocation |
| 3d engines | met | pffexport 20260917; bubblewrap 0.13.0; OpenJDK 27 (2026-09-15); real Java resolution and Tika digest unchanged; both nested sandbox smokes exit 0 |
| 3e capacity | met | 443,510,554,624 free bytes; above 100 GB floor |
| 3f synthetic exceptions | met | Fresh focused suite: 4 passed, 71 skipped; 4.48 seconds |
| 3g main source | not met for live launch | Only bounded owned fixes differ from main; PR1 must land first |
| 3h capture | met for PR1 | Retained probe: 59 runs, 43 above former capture bound, 0 nonzero and 0 empty; budget-bound fix proven |
| 3i names | met for PR1 | Retained probe: 1 backslash file, 0 directories, 0 collisions, 0 existing escape names; escape fix proven |

Adoption plan has no conflicts. Goals doctor retains zero new/inherited blocking
findings and three unrelated advisories. Private probe stderr remains one line.
The probe is not rerun: its completed aggregate evidence is retained on relaunch.
Both forbidden reference links remain absent. P1 stays pending.

Exact previous publication refusal: `github-checks:cheap-gates: failed 1 step(s)`;
`lint:schema-first: exit 1`; `yeet publish cheap-gates failed after creating the local
commit; nothing was pushed. Fix the gate, then amend or reset the unpushed commit
before retrying.` Fifteen of sixteen gates passed. The five finding surfaces are
unchanged against main: two Accounts schema candidates and three test advisories.
Run 2 explicitly authorizes direct push plus PR creation with `ready-for-heavy`,
followed by Yeet ready and a bounded readiness monitor. No baseline is edited.
Reversal: close the unmerged PR and revert the bounded fixes and packet decisions;
no immutable live state exists. The frozen manifest and live slice remain deferred
until the orchestrator reports PR1 merged.

### PR1 publication and monitor handoff

- PR1 #1596 opened with `ready-for-heavy`; pushed head and API head both
  `041fc523031dd3ed57b4636cf339975feb8871ae`. Yeet ready passed; draft false.
- Fresh committed-head knowledge refs: pass, 45,497 observations, zero live gated.
  Packet goal budget, manifest parse, index check, and diff whitespace checks pass.
- Required forty-minute detached monitor submitted and observed hosted transitions.
  Three Vercel build-rate-limit rows were acknowledged as environment-only; no
  quota purchase, baseline edit, or code workaround. No unresolved review threads.
- Local monitor intentionally cancelled at the run-2 handoff boundary, terminal
  status confirmed and acknowledged. No merge-ready verdict claimed; hosted checks
  remain pending. Orchestrator final-file gate takes over under S11. Reversal:
  resubmit the same bounded monitor. All own verification and monitor units ended.
- Final pre-report fetch/merge: already up to date. PR open, ready, structurally
  mergeable. No live run, launch script, frozen manifest, or slice ledger exists.
- This receipt-only commit is the final publication wave. Its pushed exact head
  and final-file line are resolved after commit; the report below describes the
  verified publication snapshot, and the worker's terminal report names the
  subsequent receipt-only head. The final file uses that subsequent API-equal head.

### Run-2 final report — verified publication snapshot

lane: corpus-restore
head: 041fc523031dd3ed57b4636cf339975feb8871ae (exact verified publication snapshot; subsequent commit adds only this handoff and monitor-transfer decision)
PR(s): #1596 OPEN, ready for review, ready-for-heavy; PR1 pre-run fixes
package-verify: @beep/repo-cli: pass; @beep/libpff: pass (retained run-1 full proof; no owned source changed on relaunch)
hosted-parity: test-tsgo: pass | docgen local: pass | jsdoc-ratchet: pass | knowledge refs: pass, fresh committed-head zero gated | fallow audit+health: pass | scoped coverage: pass, CLI 5,890 tests and libpff 71 tests; all package percentages above baseline; restoration implementation 100% in all metrics
handoff: goals/oppold-corpus-salvage-restoration/history/handoffs/corpus-restore-2026-10-09.md
open items: Orchestrator owns PR1 gate/merge and inherited hosted reds; hosted readiness pending, no unresolved review threads at handoff. Required bounded monitor observed transitions then was cancelled and acknowledged for final-file monitoring transfer; reverse by resubmitting it. Do not write the frozen run manifest or launch the slice until the orchestrator reports PR1 MERGED. P1 remains pending. Decisions retain budget-bound Tika capture, portable engine-name escape preserving MIME names, ratio 4, attempt 7,200,000 ms, total 43,200,000 ms, total output 2,147,483,648 bytes, 100 GB free floor, R6 freeze record, R7 output authority, and private-workspace release notes under #1566; reverse fixes/docs before launch by reverting commits. Run-2 authorizes inherited-fence fallback; reverse by closing unmerged PR. All own units ended.
final 041fc523031dd3ed57b4636cf339975feb8871ae #1596

## Run 3 — PR1 merged; frozen live slice

PR1 #1596 is MERGED, merge commit `320cedc0518a187a214ca49defc98d540dc440d1`.
Both bounded implementation files last changed on main at that commit; the owned
Corpus/libpff trees have no diff against main. Lane merged main to
`a842f07837fdf6d52357a43e79ebeeed36f849f8` and switched to the evidence branch.
Dependencies remain installed; the merge changed no lockfile. Adoption has zero
conflicts; doctor remains zero new/inherited blocking and three unrelated advisories.
The completed probe and full PR1 package/parity proofs above are retained.

| Prerequisite | State | Re-measurement |
| --- | --- | --- |
| 3a P0 | met | P0 complete; expected seal matched; directory-pass 755, file-pass 10,696, inherited-loss 4, preflight 1, seal 1 |
| 3b selection | met | PST 53; eligible 23; input 56,140,800 bytes; selected object and source digest unchanged |
| 3c state | met | No slice ledger; no earlier start stamp or live invocation |
| 3d engines | met | pffexport 20260917; bubblewrap 0.13.0; OpenJDK 27 (2026-09-15); both nested sandbox smokes exit 0; Java resolution and Tika digest unchanged |
| 3e capacity | met | 440,530,395,136 free bytes; above 100 GB floor |
| 3f synthetic exceptions | met | Fresh focused suite: four passed, 71 skipped; 6.25 seconds |
| 3g main source | met | Both bounded fixes merged at PR1 merge SHA; zero owned source diff against main |
| 3h capture | met | Retained probe: 59 runs, 43 above old bound, zero nonzero/empty; merged budget-bound fix |
| 3i names | met | Retained probe: one backslash file, zero directories/collisions/existing escape names; merged name fix |

Frozen ceilings remain ratio 4, attempt 7,200,000 ms, family 43,200,000 ms,
output 2,147,483,648 bytes, free floor 100,000,000,000 bytes. Derivation above is unchanged.
Launch script syntax passes; SHA-256
`641fcd4ab9a2bc0857ff7f90a547575974150b929ea542015bf193ea18a04ea9`.
Run manifest: `history/evidence/p1-slice-run-manifest.json`; code head as above,
engine versions remeasured, policy digest pending the tool's first start row.
No code will change while the slice is running. Reversal authority remains R7:
the orchestrator may remove the complete additive run; this lane never removes it.

- Live launch n=1 submitted at `2026-10-10T00:06:17Z`; free bytes immediately before launch 440721391616. Unit `beep-heavy-corpus-restore-p1-1.service`.

- Archive re-verification finished; first family start at `2026-10-10T00:10:59.881Z`.
  Re-verification phase duration 282677 ms. Attempt n=1 is active.
  Frozen policy SHA-256 `2bc3fc673c343ef6008b9b3bb1c85e000ac59239d345f3e50d4d08aaf6a5a2c8` equals the exact invocation contract;
  recorded once in the run manifest. The manifest is now immutable.

### Run-3 sealed failure aggregates

- Unit `beep-heavy-corpus-restore-p1-1.service` ended; result 1. No interruption or retry.
- Queue phase approximately 204 ms (submission timestamp precision one second).
  Archive re-verification 282,677 ms; verification completion count one.
- Attempt `mail:011b25c2d38deca005ce17dd:r0`; retry ordinal zero.
  Attempt-start to exception interval 349607 ms; no PASS elapsedMillis exists.
  Family elapsed 350,398 ms; total from script start to seal 633,079 ms.
- Record counts: attachment-type-repair 33; family-run-start 1; family-attempt-start 1;
  mail-store-exception 1; family-run-summary 1; family-acceptance-failure 1.
  mail-store-pass 0; mail-warning 0; mail-child-pass 0; interruptions 0.
- Source objectId `da19981ddcd62e532156584b7d8ef06762122f1cffc3f032ac36436d5492fdae`;
  input 56,140,800 bytes; retained output 115,418,004 bytes; family du bytes 115,418,004.
  Retained disk amplification 2.055866749x; below ratio 4 and total output ceiling.
  There is no accepted disk/time amplification or completed child reconciliation.
- Exception class `engine-failure`, approved false; passCount 0, exceptionCount 1,
  terminalCount 1, expectedCount 1, unapprovedCount 1. Last row family-acceptance-failure.
- Repairs: repaired 11; unsupported 22; unchanged 0; distinct repaired digests 11.
  Final engine children 0; final derived copy/Tika children 0; other children 0.
  The repair acceptance box remains unticked because terminal child evidence is absent.
- Private live-log line count 4; verification-summary count 1. No log or exception
  message was read or copied. Free bytes immediately before launch 440,721,391,616;
  after run 442,226,008,064 (other machine writes/deletions can affect this measurement).
- Ledger SHA-256 `efb4b558c2d1680f87a684a69d6aa021653234d12928aa9f27a6943de8970e9f`.
  Output-tree SHA-256 `58b8190d63b6f77c2f33e903a036427289405faed382e6ff5bd274155304988b`.
- Stop: immutable sealed failure. Do not relaunch, change flags, pick another source,
  or mutate any run artifact. P1 becomes in-progress; only the synthetic exception
  checkbox is supported. P0/P4 complete, P2/P3 pending, lifecycle active.
  Reversal remains an orchestrator decision under R7; the lane retains all evidence.

- Failure packet verification: GOAL character budget, manifest parse, required packet
  reference scan, diff whitespace, and new-evidence hygiene pass. Doctor unchanged:
  zero new/inherited blocking, three unrelated advisories. Index check passes.
- PR2 changes packet material only. Package-verify and code hosted-parity lanes are
  not run for PR2 (docs-only: no package source changed); PR1 full package and parity
  proof is retained above. The required packet knowledge-reference check is running.
- Final pre-publication fetch/merge: already up to date. Live unit inactive; all
  run artifacts retained, launch script and manifest digests unchanged.
