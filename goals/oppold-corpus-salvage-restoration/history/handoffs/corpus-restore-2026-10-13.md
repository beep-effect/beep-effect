# Corpus restore handoff — 2026-10-13

## Run-9c scope and provenance

The latest ruling authorizes three PR6 round-two fixes, one push, thread
replies/resolution, and then stop. No wave or merge in this run. Initial
head 782196bf326a44d26d23ce4fcc7a88a18a25a877 on the existing selector branch;
clean, installed, origin/main merge already up to date. Existing selector,
orchestrator receipts and merge commit retained. PR6 #1611 open and ready.
Goal adoption is read-only and conflict-free. Goals doctor baseline: zero
new or inherited blockers, three unrelated advisories, none for this packet.

## Review correction and proof

Explicit selected denominators must equal one; mismatches return a typed
CorpusCommandError before family state. Flag help identifies objectId.
Membership schema enforces globally unique objectIds. New regression uses
a duplicate unselected identity with a differing digest, proves schema
refusal and command refusal before family state. Existing malformed-plan
fixture encodes invalid boundary data without bypassing schema construction.
Nine focused cases pass: five selector cases and four required restoration
cases. Initial new-fixture failure was corrected by enabling the required
larger synthetic PST. Quick package-verify passes lint and check; final
repeat follows the corrected test fixture. No engine behavior changes.

Initial heavy wrapper failed before work because user bus variables were
absent; the approved wrapper succeeds with existing per-user bus variables.
No configuration or unit files changed. Reversal of the three contract
changes is reverting this commit, with both sealed families retained.

## Re-measured prerequisites

| Check | State | Measured value |
| --- | --- | --- |
| P0 sealed | met | 755 directory passes, 10,696 file passes, four inherited losses, one preflight, one seal |
| Slice candidate | met | 53 PST passes, 23 eligible recycle occurrences, 56,140,800 bytes |
| Sealed transformation state | met | Original failure: expected/terminal one, unapproved one; fresh pass: expected/terminal one, unapproved zero |
| Engines | met | pffexport 20260917; bubblewrap 0.13.0; OpenJDK 27, 2026-09-15; Tika 3.3.1 |
| Engine smokes | met | Both approved beep-heavy/bwrap smokes exit zero |
| Capacity | met | 242,532,237,312 free bytes, above 100 GB floor |
| Synthetic exception/accounting/resume cases | met | Four required focused cases pass |
| Main code at live launch | deferred | This run changes PR6 source; run 10 requires merged PR6; no live launch |
| Tika capture and portable paths | retained | Previously merged P1 fixes and freeze records remain unchanged |
| Active transformation units | met | Zero matching corpus-restore heavy units |

Selected objectId:
`da19981ddcd62e532156584b7d8ef06762122f1cffc3f032ac36436d5492fdae`.
Source digest:
`d547453d9d9680d28c898892982e8b3798452fa9e608a40f860ef88cd152907d`.
Tika jar digest matches the freeze record:
`0e8ee9795ac4244feab466f4a5a9c3b94675af392848243842cb6e1e69d27103`.
Original sealed ledger digest:
`efb4b558c2d1680f87a684a69d6aa021653234d12928aa9f27a6943de8970e9f`.
Fresh accepted ledger digest:
`33ad3245d090f519b573769503ebb39162a8806864f664ab0817b705a72fccf5`.
No probe or live launch in this review-only run; no private tool log read.

Final quick package proof passes: lint 4.1 seconds, check 7.5 seconds.
Goals doctor remains zero blockers with the same three unrelated advisories;
goals index matches. Source diff and whitespace review pass. Additional
docgen-local verification is running. Run-9c explicitly prescribes quick
package proof plus focused tests; full test-tsgo, JSDoc ratchet, Fallow and
coverage are not repeated for this narrow correction. Prior run-9B results
remain historical evidence, not proof of this new head. Reference links absent.
Graft estimated 85,365 tokens saved in one retrieval.

## Content-final proof

Scoped docgen-local passes: two successful tasks, 25.397 seconds; CLI docs
aggregate successfully. Final quick package lint/check and all nine focused
tests pass. No new tracked generated files or reference links. Final fetch
and merge are already up to date; PR6 remains open and ready on its previous
head before the single authorized correction push.

Publication uses the run-9c one-push instruction on the existing PR, with
no new PR and no detached monitor or gate started by this worker. The
orchestrator retains hosted readiness and merge ownership. Full parity
producers outside the named quick/test checks are not repeated under the
narrow ruling; docgen-local is current, historical full producer evidence
remains in the earlier handoff. Knowledge refs checks committed HEAD next.

## Run-9c final report

lane: corpus-restore
head: 3c20058677a15ab706b0fd057986b118b99ea3f4 (exact pushed PR6 head)
PR(s): #1611 OPEN, ready, ready-for-heavy; all three run-9c threads answered and resolved; zero unresolved threads, complete pagination
package-verify: @beep/repo-cli: pass (quick; lint 4.1 s, check 7.5 s); nine focused tests pass; both engine smokes pass
hosted-parity: test-tsgo not run (run-9c prescribes quick package check and focused tests) | docgen local pass (two tasks, 25.397 s) | jsdoc-ratchet not run (narrow run-9c proof; commit-hook JSDoc pass) | knowledge refs pass (committed head; zero live gated observations) | fallow audit+health not run (narrow run-9c proof) | scoped coverage not run (narrow run-9c proof; prior full evidence is historical)
handoff: goals/oppold-corpus-salvage-restoration/history/handoffs/corpus-restore-2026-10-13.md
open items: Orchestrator owns hosted CI and the restarted review window; observed checks: four success, twenty-one in progress, three pending. No merge-ready claim or merge. Run 10 remains gated on PR6 merge; zero P2 families launched. P1 remains complete; both sealed ledgers and manifests retained. All three authorized fixes are published in one push; reversal is reverting the review-fix commit while retaining sealed evidence. No worker-owned job or gate remains running. Final fetch/merge already up to date, reference links absent. The committed handoff contains scope, decisions, receipts and proof; this exact-head post-push report is appended locally for the next packet evidence commit, avoiding a second push. Graft saved approximately 85,365 tokens in one call.
final 3c20058677a15ab706b0fd057986b118b99ea3f4 #1611


## Run-10 launch provenance and re-measured prerequisites

Latest go ruling and branch correction authorize the nine-family first wave
on feat/oppold-corpus-salvage-restoration-p2-first-wave, from merged PR6
6eb3d036771e868768846b3c56a5aafac69c3b2b. The prior report append is retained.
No source changes or merge of main at setup; the lane already equals main.

| Check | State | Measured value |
| --- | --- | --- |
| P0 seal | met | Expected sealed run; 755 directory passes, 10,696 file passes, four inherited losses, one preflight, one seal |
| Slice candidate | met | 53 PST passes; 23 eligible recycle occurrences; retained P1 identity unchanged |
| Existing state | met | Both immutable P1 ledger digests unchanged; zero P2 ledgers |
| Membership | met | Nine ordered occurrences, all object/digest/size/PST metadata matches the sealed archive |
| Engines | met | pffexport 20260917; bubblewrap 0.13.0; OpenJDK 27, 2026-09-15; Java real path unchanged; Tika digest unchanged |
| Engine smokes | pending | Both approved real sandbox smokes queued through beep-heavy |
| Capacity | met | 236,375,658,496 free bytes; floor 100,000,000,000 |
| Synthetic exception/accounting/resume cases | pending | Re-run before family launch |
| Main code | met | No difference from origin/main in Corpus or libpff |
| Tika and portable-path fixes | retained | Merged fixes and both immutable freeze records retained |
| Active transformation units | met | Zero matching corpus family units before smoke admission |

Membership digest:
00c2bf191c03874664b6167b614b6dfeb1dddac27fadc0407d673eb35b8bd3b2.
Heavy wrapper reports five occupied machine slots; two worker-owned engine
smokes wait without bypassing admission. User-manager variables were absent
and are supplied from the existing runtime socket; no configuration changed.

Nine pre-launch manifests created before any family unit: history/evidence/p2-first-wave-2026-10-13-family-01-run-manifest.json through family-09-run-manifest.json. Policy digests are precomputed from the exact twelve input fields, including selected objectId and membership digest.
Launch-script SHA-256: 5b1d87cb5c420a53e56340bbc092c21826666c9e25ef210a421b8e20955e65e6.
Goal adoption: read-only, zero conflicts; doctor baseline: zero blockers, three unrelated advisories. Both sandbox smokes exit zero. Focused proof is queued through the approved heavy wrapper.

Focused restoration proof: four pass, 78 skipped, 14.93 seconds.
Family 1 launched 2026-10-13T19:07:53.388194+00:00:
unit beep-heavy-corpus-restore-p2-2026-10-13-1.service; ledger relative
to corpus home: staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-01/ledgers/mail/slice.jsonl.
No later family launched. No source change inside this wave.

Packet checks at launch: launcher within 4,000 characters, manifest parses,
goals index passes after refreshing its git-ignored projection, knowledge
refs at merged code head passes with zero live gated observations. No package
source changed; hosted-parity package producers are not run for this docs-only
wave. Graft estimated 36,982 tokens saved in one retrieval.

Family 1 archive verification completed; persisted family start
2026-10-13T19:15:50.706Z. Slot wait approximately 0.8 seconds; re-verification
477,888 ms from the started stamp. Runtime policy matches the pre-launch
manifest: fa0ce962b1da841d3000f7fa96419d285fe84c509e4553db86845db418803a4c.
At the first transformation check: 88 attachment dispositions (17 repaired,
71 unsupported), zero warning/exception/interruption rows, no terminal seal.
These are progress counts, not accepted repair or child evidence.

First evidence commit refused by commitlint: literal newline escapes
created an overlong body. No commit or push occurred; corrected with a
message file containing actual newlines. Pre-commit secret/typo/Biome checks
passed. Final packet doctor retains zero blockers and the three unrelated
advisories.


## Run-10 mid-wave final report

lane: corpus-restore
head: 89d1f6b07fbbff31435d9d9431628b65c24d83ca (local committed launch-evidence head)
PR(s): #1611 MERGED at 6eb3d03677 | PR7 none (wave still running; no push or merge)
package-verify: not run (docs-only; no package edited). Both real sandbox smokes pass; four required restoration tests pass, 78 skipped, 14.93 s.
hosted-parity: test-tsgo not run (docs-only: no package source changed) | docgen local not run (docs-only) | jsdoc-ratchet not run (docs-only) | knowledge refs pass at exact committed head, zero live gated observations | fallow audit+health not run (docs-only) | scoped coverage not run (docs-only)
handoff: goals/oppold-corpus-salvage-restoration/history/handoffs/corpus-restore-2026-10-13.md
open items: Run-10 authorized mid-wave handoff: family 1 remains active, zero of nine sealed, no result stamp, zero warning/exception rows at last check. Unit beep-heavy-corpus-restore-p2-2026-10-13-1.service; ledger relative to corpus home: staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-01/ledgers/mail/slice.jsonl. Runtime policy matches its pre-launch freeze record. Archive re-verification took 477,888 ms. Nine immutable pre-launch manifests, the frozen script digest, bounds, aggregate progress and continuation instructions are committed. The other eight families are not launched. Re-arm the watcher; reconcile accepted seal and all children/repair pairs/ceilings, wait 60 s, then use the same script with the next ordinal. Stop and diagnose the first failure; never retry a sealed family or change engine/launcher code inside the wave. P2 remains incomplete; larger/stub/non-PST mail and recycle/DOC obligations remain open. Reversal is reverting packet decisions while retaining all families, outputs and freeze records. Packet doctor has zero blockers and the same three unrelated advisories; launcher/manifest/index and pre-commit checks pass. No worker-owned proof or gate remains running; the family unit is handed over under the latest ruling. This exact-head post-commit report is appended locally for the terminal wave evidence commit. Graft saved approximately 36,982 tokens in one retrieval.
blocked: wave running — 0 of 9 sealed, unit beep-heavy-corpus-restore-p2-2026-10-13-1.service


## Run-11 family 1 accepted and reconciled

Resume follows the Run-11 ruling on the unchanged first-wave branch. The
carried-over Run-10 final report is preserved. Family 1 unit ended; result
stamp is zero. Last row is family-acceptance-pass, expected/terminal one,
unapproved zero. No exception, warning, interruption or failure rows.
All source, policy, membership and launch-script identities match the
immutable pre-launch manifest. No package or engine source changed.

| Check | State | Measured value |
| --- | --- | --- |
| P0 seal | met | Same sealed run; 755 directory passes, 10,696 file passes, four inherited losses, one preflight, one seal |
| Wave membership/source identities | met | All nine immutable manifest identities match the sealed archive; eighteen larger occurrences remain excluded |
| Transformation state | met | Family 1 accepted; no other family launched; unit inactive |
| Frozen engines | met | pffexport 20260917; bubblewrap 0.13.0; OpenJDK 27, 2026-09-15; real Java path unchanged; Tika digest unchanged |
| Real engine smokes | met | Both approved beep-heavy/bwrap smokes exit zero |
| Capacity after family 1 | met | 234,247,569,408 free bytes, above 100,000,000,000 floor |
| Main engine code | met | Corpus/libpff source diff from origin/main empty; frozen code head unchanged |
| Probe-proven fixes | retained | Merged Tika and portable-path fixes unchanged; no new probe or code fix |
| Packet health | met | Zero new/inherited blockers; same three unrelated advisories |

Family 1 unit: beep-heavy-corpus-restore-p2-2026-10-13-1.service.
Ledger relative to corpus home:
`staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-01/ledgers/mail/slice.jsonl`.
Seal recorded 2026-10-13T19:29:58.274Z.
Attempt: mail:223d8b5d95c014978c5ac714:r0.
Object identity: 2a117127f49f4e806b2a2461afe973a637ab956bbb4d88060fb438623dcdf71e.
Source digest: 1d97dfd772f8cd629d8efcc047b71fb0f3eb8a4753e6e0b204cc0bb775b90d1a.
Ledger digest: 6c9c70a6047bc894f2688a851ef8bbc5cd2cba99a1cdc984dff43bafec66ff67.

Record counts: 315 attachment-type-repair, 3,785 mail-child-pass, one each
family-run-start, family-attempt-start, mail-store-pass, family-run-summary,
and family-acceptance-pass. All 3,623 engine children and 162 derived
children reconcile. There are 82 repaired occurrences / 81 distinct digests,
81 repair-copy and 81 Tika children, 233 unsupported, zero unchanged, zero
other derived children. Unsupported dispositions are not counted as repairs.
Input 61,727,744 bytes; output and family disk usage 147,490,617 bytes;
disk amplification 2.389373197x. Attempt 769,470 ms, 13,071.072 ms per MiB;
family 847,540 ms. Prior queue wait approximately 0.8 s and archive verification
477,888 ms remain recorded. Attempt and family output/time ceilings hold.
Private log read only as counts: two lines, 807 bytes. No content emitted.

Decision: accept family 1 aggregate reconciliation and proceed to family 2
only after the required sixty-second interval and refreshed preflight.
Retain every sealed family and freeze record. Reversal: revert the packet
continuation decision; never reopen or remove a sealed family. P2 remains
in-progress and incomplete. PR7 follows the terminal wave outcome; never merge.


## Run-11 — family 1 accepted, family 2 launched

Family 1 sealed acceptance at 2026-10-13T19:29:58.274Z and reconciled before
continuation. One store pass, expected/terminal one, unapproved zero; zero
warnings, exceptions or interruptions. All 3,785 child rows reconcile:
3,623 engine children, 81 repair-copy and 81 Tika children. Dispositions:
82 repaired occurrences / 81 distinct digests, 233 unsupported, zero unchanged.
Input 61,727,744 bytes; output and family disk usage 147,490,617 bytes;
amplification 2.389373197x. Attempt 769,470 ms, family 847,540 ms; both
output/time ceilings hold. Private log: two lines / 807 bytes, counts only.
Ledger digest:
6c9c70a6047bc894f2688a851ef8bbc5cd2cba99a1cdc984dff43bafec66ff67.
The runtime policy equals its immutable pre-launch record.

After successful reconciliation, renewed engine/source/script/membership
checks, both real sandbox smokes, four focused passing tests and a full
sixty-second wait, family 2 launched with the same frozen script and ordinal 2.
Unit: beep-heavy-corpus-restore-p2-2026-10-13-2.service.
Started: 2026-10-13T19:35:45.651Z. Free bytes immediately before launch:
232,788,058,112, above the 100,000,000,000 floor.
Ledger relative to corpus home:
`staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-02/ledgers/mail/slice.jsonl`.
One of nine families sealed; family 2 active, seven not launched. There is
no second concurrent family and no source/engine/launcher change in the wave.
Continue only after accepted seal, complete child/repair-pair reconciliation,
ceiling and frozen-contract checks, then sixty seconds before the next ordinal.
Stop and diagnose the first failure; never retry a sealed family.
P2 remains incomplete; eighteen larger occurrences and the other estate,
recycle and legacy-Word gates remain open. Reversal: revert packet decisions
while retaining all immutable families, outputs and freeze records.

Focused restoration proof on this resume: four pass, 78 skipped, 4.81 seconds.
Graft estimated 90,899 tokens saved across two retrievals.


Additional integrity checks: the distinct digest sets in repair-copy and
Tika child paths both equal all 81 repaired digests, beyond equal counts.
Both previous immutable P1 ledger SHA-256 values remain unchanged.
The preserved inventory still has 53 PST occurrences / 23 eligible recycle
occurrences and the same 56,140,800-byte P1 object. Frozen wave membership
and all nine source identities match. No additional probe is needed because
the pre-run fixes are already merged and their immutable evidence is retained.


Packet verification before the continuation-evidence commit: launcher within
4,000 characters, manifest parses, goals doctor zero blockers / same three
unrelated advisories, goals index matches, diff whitespace and public-hygiene
scans pass. Knowledge refs passes at the prior committed head with zero live
gated observations; repeat on this evidence commit before final report.
No package source changed, so full package audit and other package parity
producers are not run for this documentation-only continuation. Engine smokes
and focused restoration tests are current proof, not historical assumptions.


## Run-11 mid-wave final report

lane: corpus-restore
head: f2bd945b8e1b1f397d498c7f952ebe8d01a01e3c (local committed continuation-evidence head)
PR(s): #1611 MERGED at 6eb3d03677 | PR7 none (wave active; no push or merge)
package-verify: not run (docs-only; no package edited). Both real sandbox smokes pass; four required restoration tests pass, 78 skipped, 4.81 seconds.
hosted-parity: test-tsgo not run (docs-only: no package source changed) | docgen local not run (docs-only) | jsdoc-ratchet not run (docs-only) | knowledge refs pass at exact committed head, zero live gated observations | fallow audit+health not run (docs-only) | scoped coverage not run (docs-only)
handoff: goals/oppold-corpus-salvage-restoration/history/handoffs/corpus-restore-2026-10-13.md
open items: Family 1 exited zero and sealed acceptance; all 3,785 children reconcile (3,623 engine, 81 repair-copy, 81 Tika), including identical repair digest sets. Dispositions: 82 repaired occurrences / 81 distinct digests, 233 unsupported, zero unchanged. Zero warnings, exceptions or interruptions. Input 61,727,744 bytes; output/family disk usage 147,490,617 bytes, 2.389373197x amplification; attempt 769,470 ms, family 847,540 ms. Ledger SHA-256: 6c9c70a6047bc894f2688a851ef8bbc5cd2cba99a1cdc984dff43bafec66ff67. All frozen identities and ceilings hold; both previous P1 ledger digests remain unchanged. After renewed preflight and a full sixty-second interval, family 2 launched with the same frozen script, started 2026-10-13T19:35:45.651Z. Unit beep-heavy-corpus-restore-p2-2026-10-13-2.service; ledger relative to corpus home: staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-02/ledgers/mail/slice.jsonl. Last check: unit active in archive verification, no result stamp or ledger yet; runtime policy comparison remains pending its family-run-start. One of nine sealed, seven unstarted. Free bytes before family 2: 232,788,058,112, above the retained 100 GB floor. Re-arm the orchestrator watcher under Run 11; reconcile family 2's seal, children, repair pairs, identities and ceilings before sixty seconds and ordinal 3. Stop and diagnose the first failure; never retry a sealed family or change engines/launcher inside the wave. P2 stays incomplete; eighteen larger occurrences and remaining estate/recycle/DOC obligations remain open. Decision: continue after accepted reconciliation; reversal is reverting packet decisions while retaining every immutable family, output and manifest. Packet launcher/manifest/index, public-hygiene scan and commit hooks pass; doctor retains zero blockers and the same three unrelated advisories. No worker-owned proof or gate remains running; family 2 is handed over under the explicit mid-wave ruling. The aggregate record, packet updates and carried-over handoff are committed; this exact-head report is appended locally for the next evidence commit. Graft saved approximately 90,899 tokens across two retrievals.
blocked: wave running — 1 of 9 sealed, unit beep-heavy-corpus-restore-p2-2026-10-13-2.service


## Run-12 — family 2 accepted and reconciled

Standing Runs 12+ ruling applies. Preserve the prior locally appended report.
Family 2 unit beep-heavy-corpus-restore-p2-2026-10-13-2.service ended;
result stamp is zero. Seal recorded 2026-10-13T20:25:49.846Z. Last row is
family-acceptance-pass, expected/terminal one, unapproved zero. Exactly one
store pass and zero warnings, exceptions, interruptions or failure rows.

Ledger relative to corpus home:
`staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-02/ledgers/mail/slice.jsonl`.
Attempt: mail:973a3612438a25029652c75f:r0.
Object identity: 886bd60cee359bcca9ee313bdeb4c08a4c7c3de3e676c021d50425741bfbac14.
Source digest: 4501c21643be4ec9bb146983cd3760c73a8ddb41604c68126198f734dba0f95d.
Policy digest: bd8566190e0a528375ec8489c87d59309db09e4eca72125a5f2fd8680134f899.
Ledger digest: c885172e73301fd762903ef17ed5fd08dfd890604871df89f10fc316de46f1b8.

Record counts: 343 attachment-type-repair, 4,310 mail-child-pass, one each
family-run-start, family-attempt-start, mail-store-pass, family-run-summary
and family-acceptance-pass. All 4,064 engine children and 246 derived children
reconcile for the store attempt. Both distinct digest sets in 123 repair-copy
and 123 Tika children equal the 123 distinct repaired digests. Dispositions:
125 repaired occurrences, 218 unsupported, zero unchanged; zero other derived
children. Unsupported dispositions are not repairs.
Input 98,804,736 bytes; output and family disk usage 265,766,621 bytes;
amplification 2.689816620x. Attempt 2,588,015 ms, 27,465.590 ms per MiB;
family 2,611,137 ms. Archive verification 393,030 ms from the started stamp
2026-10-13T19:35:45.651Z to family-run-start 2026-10-13T19:42:18.681Z.
Queue duration was not captured precisely; the prior handoff records only the
started stamp. All attempt/family output and elapsed ceilings hold.
Private log read as counts only: two lines, 807 bytes.

| Check | State | Measured value |
| --- | --- | --- |
| P0 seal | met | Same sealed run; current-run counts remeasured before continuation |
| Membership/source identities | met | Nine frozen records match source metadata and recomputed twelve-field policy digests |
| Family 2 reconciliation | met | Zero result, accepted seal, 4,310 children and matching 123 repair digest pairs |
| Engines | met | pffexport 20260917; bubblewrap 0.13.0; OpenJDK 27, 2026-09-15; Java real path and Tika digest unchanged |
| Frozen launcher/membership | met | SHA-256 values unchanged from pre-launch records |
| Main engine code | met | Corpus/libpff diff from origin/main and frozen code head empty |
| Capacity after family 2 | met | 239,569,948,672 free bytes, above 100,000,000,000 floor |
| Packet health | met | Zero blockers, same three unrelated advisories; adoption has zero conflicts |

Decision: accept family 2 and continue to ordinal 3 only after renewed
preflight and a full sixty-second interval. Retain the frozen launcher,
engines and all nine pre-launch manifests. No package source changed.
Reversal: revert the packet continuation decision while retaining every
sealed family, output and freeze record. P2 remains in-progress and incomplete.


Renewed engine smokes and focused proof are queued through beep-heavy:
both report all five shared slots occupied. No admission bypass or cap
change. Full sixty-second continuation interval completed while queued.
P0 current sealed-run counts: 755 directory passes, 10,696 file passes,
four inherited losses, one preflight and one seal. All nine member source
identities and precomputed policy digests revalidate; next family run root
and stamps absent. Preserve the existing source head during the wave.


## Run-12 — shared admission blocker before ordinal 3

Family 2 accepted reconciliation was committed locally at 9b30ad1ade.
Both renewed preflight commands remained queued for approximately twenty
minutes, reporting all five shared slots busy. Admission owners were live;
no outside process, slot limit, unit or configuration was changed. Terminated
only the two worker-owned queued command trees before handoff. One wrapper
exited 143 and the other 0 without test output; neither status is claimed as
execution proof. Renewed smokes and focused proof remain unperformed on this
resume. Prior passing run-11 evidence is retained, with unchanged source and
engine identities, but does not replace the renewed check.

Two of nine families sealed and accepted. No family unit is active. Ordinal 3
has no run directory or started/result stamp; ordinals 3-9 remain unstarted.
The required full sixty-second interval was completed. Stop here on shared
admission, without starting or retrying any family. P2 stays incomplete.
Resume by re-running preflight through beep-heavy, retaining all frozen
identities and the 100 GB floor, then a full sixty-second interval and the
same launcher with ordinal 3. Reversal: resume that unchanged continuation;
retain every sealed family, output and pre-launch manifest.

Packet verification: launcher within 4,000 characters, manifest parses,
goals index matches, adoption zero conflicts, doctor zero blockers and the
same three unrelated advisories. Knowledge refs passed at 9b30ad1ade with
zero live gated observations. No package source edited; all package parity
producers except knowledge refs are not run for this docs-only continuation.
Graft estimated 71,228 tokens saved across two retrievals.


## Run-12 final report

lane: corpus-restore
head: 47eee56376c421d8a82636e3870984e8a9160802 (local committed continuation-evidence head)
PR(s): #1611 MERGED at 6eb3d03677 | PR7 none (bounded wave incomplete; no push or merge)
package-verify: not run (docs-only; no package edited). Renewed real sandbox smokes and four focused restoration tests remain pending shared admission; queued worker commands were terminated without execution proof. Prior run-11 passing evidence is retained.
hosted-parity: test-tsgo not run (docs-only: no package source changed) | docgen local not run (docs-only: no package source changed) | jsdoc-ratchet not run (docs-only: no package source changed) | knowledge refs pass at exact committed head, zero live gated observations | fallow audit+health not run (docs-only: no package source changed) | scoped coverage not run (docs-only: no package source changed)
handoff: goals/oppold-corpus-salvage-restoration/history/handoffs/corpus-restore-2026-10-13.md
open items: Family 2 unit beep-heavy-corpus-restore-p2-2026-10-13-2.service ended with result zero and sealed acceptance. All 4,310 children reconcile: 4,064 engine children, 123 repair-copy children and 123 Tika children; both derived digest sets equal all 123 distinct repaired digests. Dispositions: 125 repaired occurrences, 218 unsupported, zero unchanged. Zero warnings, exceptions or interruptions. Input 98,804,736 bytes; output/family disk usage 265,766,621 bytes; amplification 2.689816620x; attempt 2,588,015 ms; family 2,611,137 ms; archive verification 393,030 ms. Ledger SHA-256 c885172e73301fd762903ef17ed5fd08dfd890604871df89f10fc316de46f1b8. Ledger relative to corpus home: staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-02/ledgers/mail/slice.jsonl. Source, engine, launcher, membership, policy identities and all ceilings hold. Two of nine sealed; ordinals 3-9 unstarted. Required renewed smokes and focused proof waited approximately twenty minutes without admission; terminated only those two queued worker command trees. No outside job, admission limit or configuration changed. No worker-owned command, gate or family unit remains running. Ordinal 3 has no run directory or started/result stamp. Free bytes at handoff 237,821,120,512, above the retained 100 GB floor. Decision: bounded handoff on shared admission; reversal is renewed admitted preflight, a full sixty-second interval and the SAME frozen launcher with ordinal 3. Retain every ledger, output and pre-launch manifest; never retry a sealed family or change engines/launcher inside the wave. P2 remains incomplete; eighteen larger occurrences and remaining estate/recycle/DOC obligations stay open. Accepted evidence, carried-over report, blocker and decision are committed locally; this exact-head report is appended for the next evidence commit. Packet launcher/manifest/index, public-hygiene scan and commit hooks pass; doctor retains zero blockers and the same three unrelated advisories. Graft estimated 71,228 tokens saved across two retrievals.
blocked: shared heavy admission — 2 of 9 sealed; ordinal 3 unstarted, renewed preflight pending, no family unit active


## Runs 13+ — renewed preflight before ordinal 3

The standing shared-admission ruling applies. Prior Run-12 final report
append is preserved. Current branch remains the bounded first-wave branch;
starting head 47eee56376c421d8a82636e3870984e8a9160802. No merge or package
source change occurs inside the frozen wave.

| Prerequisite | State | Current evidence |
| --- | --- | --- |
| P0 seal | met | Expected sealed run; 755 directory passes, 10,696 file passes, four inherited losses, one preflight and one seal |
| Original slice candidate | met | 53 PST occurrences, 23 eligible; original object and digest unchanged, input 56,140,800 bytes |
| Existing transformation state | met | Families 1 and 2 result zero and accepted; ordinals 3-9 stamps and run roots absent |
| Membership/source identity | met | All nine immutable manifests match source metadata and bounded membership |
| Frozen engines | met | pffexport 20260917, bubblewrap 0.13.0, OpenJDK 27 dated 2026-09-15; real Java path and Tika digest unchanged |
| Frozen script/membership/policies | met | All nine manifest values and recomputed policy digests match |
| Source parity | met | Corpus/libpff diff from both origin/main and frozen code head empty |
| Free space | met | 303,869,689,856 bytes, above 100,000,000,000-byte floor |
| Real sandbox smokes | pending | Initial wrappers lacked user-bus variables; corrected wrappers queued through beep-heavy |
| Four focused restoration tests | pending | Corrected wrapper queued through beep-heavy |
| Packet health | met | Adoption zero conflicts; doctor zero blockers, same three unrelated advisories; index matches |

Family 1 ledger digest remains
6c9c70a6047bc894f2688a851ef8bbc5cd2cba99a1cdc984dff43bafec66ff67.
Family 2 ledger digest remains
c885172e73301fd762903ef17ed5fd08dfd890604871df89f10fc316de46f1b8.
Family 2 re-reconciles 4,310 child rows: 4,064 engine children, 123 repair-copy
and 123 Tika children; both derived digest sets match all 123 distinct
repaired digests. Dispositions 125 repaired occurrences / 218 unsupported;
zero unchanged, exceptions, warnings, interruptions or failure rows.
Expected/terminal one, unapproved zero. Input 98,804,736 bytes, output
265,766,621 bytes; attempt 2,588,015 ms and family 2,611,137 ms within ceilings.

Frozen launcher SHA-256:
5b1d87cb5c420a53e56340bbc092c21826666c9e25ef210a421b8e20955e65e6.
Membership SHA-256:
00c2bf191c03874664b6167b614b6dfeb1dddac27fadc0407d673eb35b8bd3b2.
Next freeze record: history/evidence/p2-first-wave-2026-10-13-family-03-run-manifest.json.
Next policy SHA-256:
b3851eea94aafd0d0a08ae4201c82a4ad020ec6aeb916a330ba25872c007b761.

Knowledge refs at starting committed head passes with zero live gated
observations. No package edited; package-verify and package-source parity
producers are not required for this documentation-only continuation.
No probe rerun or pre-run fix: the existing probe evidence and merged fixes
remain immutable. User-bus environment correction is recorded in SPEC with
its reversal and in the friction ledger. Two worker-owned preflight commands
are queued; no family unit is active.


Renewed focused restoration proof obtained shared admission and passed:
four tests, 78 skipped, 3.63 seconds. Real sandbox smokes remain queued;
no family unit is active and ordinal 3 remains unstarted.


Renewed real sandbox smokes obtained shared admission and both exited zero:
Apache Tika 3.3.1 and pffexport 20260917, through the approved bwrap scope.
The smoke wrapper was confirmed complete at 2026-10-13T21:32:56Z after
approximately fifteen minutes of queueing. No queued worker proof remains.
A fresh full sixty-second continuation interval starts after confirmed proof;
ordinal 3 launch follows only after renewed capacity and state checks.


## Runs 13+ — admitted preflight passed; ordinal 3 submitted

Both real sandbox smokes passed through beep-heavy after approximately
fifteen minutes of shared queueing. Four focused restoration tests passed,
78 skipped, 3.63 seconds. All frozen identities match; the source is unchanged.
A full sixty-second interval elapsed after confirmed preflight completion.
Free bytes immediately before submission: 332,194,398,208.

Submitted at 2026-10-13T21:34:16Z with the SAME frozen launcher and ordinal 3.
Unit: beep-heavy-corpus-restore-p2-2026-10-13-3.service.
Ledger relative to corpus home:
`staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-03/ledgers/mail/slice.jsonl`.
At initial observation the detached unit is active/running, waiting for
shared admission; started/result stamps are absent. It is the only wave
family unit. MemoryMax 34,359,738,368 bytes, MemorySwapMax zero, agent-runs.slice.
Runtime policy comparison remains pending the first family-run-start.

Two of nine sealed; ordinal 3 submitted, ordinals 4-9 unstarted. The
orchestrator watcher owns the explicit mid-wave handoff under Runs 12+/13+.
When the unit ends, read its result and reconcile seal, source/policy identity,
all children and repair digest pairs, output/time ceilings and capacity.
Stop and diagnose any failure; never retry a sealed family. Continue to
ordinal 4 only after accepted reconciliation, renewed preflight and sixty seconds.
No source/engine/launcher changes inside the wave. P2 remains incomplete;
eighteen larger occurrences and estate/recycle/legacy-Word gates remain open.
Reversal: revert packet continuation decisions while retaining every sealed
family, output and freeze record. No merge or PR publication during this
mid-wave handoff; PR7 follows the terminal wave record.


Continuation packet checks: launcher within 4,000 characters, manifest
parses, goals doctor zero blockers / same three unrelated advisories,
goals index matches, diff whitespace and added-line public hygiene pass.
Both preflight commands ended successfully. Ordinal 3 is the sole active
wave unit and is intentionally transferred to the watcher, not cancelled.
Graft estimated 128,799 tokens saved across two source retrievals.


## Runs 13+ mid-wave final report

lane: corpus-restore
head: ce137232a071bc1504768e69ad912852eb65f4e6 (local committed continuation-evidence head)
PR(s): #1611 MERGED at 6eb3d03677 | PR7 none (bounded wave incomplete; no push or merge)
package-verify: not run (docs-only; no package edited). Renewed real Tika/pffexport sandbox smokes pass through beep-heavy; four focused restoration tests pass, 78 skipped, 3.63 seconds.
hosted-parity: test-tsgo not run (docs-only: no package source changed) | docgen local not run (docs-only: no package source changed) | jsdoc-ratchet not run (docs-only: no package source changed) | knowledge refs pass at exact committed head, zero live gated observations | fallow audit+health not run (docs-only: no package source changed) | scoped coverage not run (docs-only: no package source changed)
handoff: goals/oppold-corpus-salvage-restoration/history/handoffs/corpus-restore-2026-10-13.md
open items: Two of nine families remain sealed and accepted; both ledger hashes unchanged. Family 2 re-reconciles all 4,310 children (4,064 engine, 123 repair-copy, 123 Tika), with identical derived/repaired digest sets, 125 repaired occurrences and 218 unsupported dispositions, zero warnings/exceptions/interruptions. All nine source, engine, launcher, membership and policy identities match their immutable pre-launch manifests. Renewed smokes and focused tests obtained shared admission; a full sixty-second interval followed confirmed proof. Ordinal 3 submitted at 2026-10-13T21:34:16Z with the SAME frozen script, unit beep-heavy-corpus-restore-p2-2026-10-13-3.service. Free bytes before submission: 332,194,398,208, above the 100 GB floor. Last check: sole wave unit active/running and queued; no started/result stamp, so archive verification and runtime policy comparison remain pending. Ledger relative to corpus home: staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-03/ledgers/mail/slice.jsonl. Ordinals 4-9 unstarted. The orchestrator watcher resumes after this unit ends: reconcile result, accepted seal, source/policy identity, all children and repair pairs, ceilings and capacity before renewed preflight, sixty seconds and ordinal 4. Stop and diagnose the first failure; never retry sealed families or change engine/launcher code inside the wave. P2 remains incomplete; eighteen larger occurrences and remaining estate/recycle/DOC gates remain open. Decision: restore omitted user-bus environment for admitted preflight and continue the unchanged frozen wave; reversal is stopping only worker-owned queued preflight and reverting packet decisions while retaining every ledger, output and manifest. No outside job, slot limit, configuration or source changed. Packet launcher/manifest/index, public-hygiene scans and commit hooks pass; doctor retains zero blockers and the same three unrelated advisories. Session ledger records watcher handoff. No worker-owned proof or gate remains active; the sole family unit transfers under the standing mid-wave ruling. Evidence and carried-over report are committed; this exact-head final report is appended locally for the next evidence commit. Graft saved approximately 128,799 tokens across two retrievals.
blocked: wave running — 2 of 9 sealed, unit beep-heavy-corpus-restore-p2-2026-10-13-3.service


## Standing wave continuation — family 3 accepted and reconciled

Family 3 unit beep-heavy-corpus-restore-p2-2026-10-13-3.service ended;
result stamp is zero. Sealed acceptance at 2026-10-13T22:32:05.820Z:
expected/terminal one, unapproved zero; one store pass, zero warnings,
exceptions, interruptions or failure rows. Prior mid-wave report is preserved.

Ledger relative to corpus home:
`staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-03/ledgers/mail/slice.jsonl`.
Attempt: mail:9e98e7217a932e00092e313d:r0.
Object identity: 888eeb36b076ff20ad7048e2bebe55ba7bd929b94698676fdc23e7601aecb96d.
Source digest: 4120aa082ab2640bc072520d95bd974b84962eeb63ed948fb989fe8ebe2db069.
Policy digest: b3851eea94aafd0d0a08ae4201c82a4ad020ec6aeb916a330ba25872c007b761.
Ledger digest: 53f84aa4f03c1368b18cf3da03d6a50321d6300c22224abf6d419cae9cd2b99e.

Record counts: 357 attachment-type-repair, 4,416 mail-child-pass, one each
family-run-start, family-attempt-start, mail-store-pass, family-run-summary
and family-acceptance-pass. All 4,108 engine children and 308 derived children
reconcile for the sole store attempt. Both repair-copy and Tika identity sets
equal all 154 distinct repaired digests, with 154 children in each set.
Dispositions: 176 repaired occurrences, 181 unsupported, zero unchanged;
zero other derived children. Unsupported dispositions are not repairs.
Input 98,804,736 bytes; output and family disk usage 246,434,736 bytes;
amplification 2.494159146x. Attempt 2,409,929 ms, 25,575.633 ms per MiB;
family 2,430,372 ms. Queue approximately 526,184 ms from prior submission
to started stamp 2026-10-13T21:43:02.184Z; archive verification 513,256 ms
to family-run-start 2026-10-13T21:51:35.440Z.
All output/time ceilings hold. Private log read as counts: two lines / 807 bytes.

| Prerequisite | State | Current evidence |
| --- | --- | --- |
| P0 seal | met | Expected sealed run; 755 directory passes, 10,696 file passes, four inherited losses, one preflight and one seal |
| Original slice candidate | met | 53 PST occurrences, 23 eligible; original object/digest unchanged, input 56,140,800 bytes |
| Transformation state | met | Families 1-3 accepted with zero result; ordinals 4-9 run roots and stamps absent |
| Membership/source identities | met | All nine pre-launch records match archive metadata and source identities |
| Frozen engines | met | pffexport 20260917; bubblewrap 0.13.0; OpenJDK 27 dated 2026-09-15; Java real path and Tika digest unchanged |
| Frozen launcher/membership/policies | met | All nine manifests match current digests and recomputed policy hashes |
| Main/frozen source parity | met | Corpus/libpff diff from origin/main and frozen code head empty |
| Capacity after family 3 | met | 421,738,582,016 free bytes, above 100,000,000,000-byte floor |
| Real sandbox smokes | pending | Renewed wrapper queued through beep-heavy; all five shared slots initially occupied |
| Four focused restoration tests | pending | Renewed wrapper queued through beep-heavy |
| Packet health | met | Adoption zero conflicts; doctor zero blockers and same three unrelated advisories; index matches |

Family 1 and 2 ledger hashes remain unchanged. Launcher digest remains
5b1d87cb5c420a53e56340bbc092c21826666c9e25ef210a421b8e20955e65e6;
membership digest remains
00c2bf191c03874664b6167b614b6dfeb1dddac27fadc0407d673eb35b8bd3b2.
No probe rerun or pre-run fix; prior probe and merged fixes remain evidence.
Three of nine accepted; P2 remains incomplete. Continue ordinal 4 only after
renewed admitted preflight, the full sixty-second interval and capacity check.
Never retry a sealed family, bypass admission or alter engines/launcher.
Decision reversal: revert packet continuation decisions while retaining all
families, ledgers, outputs and immutable freeze records.


Renewed admitted preflight completed successfully at 2026-10-13T22:42:36Z:
both real sandbox smokes exited zero (Apache Tika 3.3.1, pffexport 20260917).
Focused restoration proof: four passed, 78 skipped, 5.69 seconds.
The focused wrapper waited approximately nine minutes for shared admission;
no bypass, outside job termination or cap change. Both wrappers ended.
A full sixty-second interval begins after confirmed completion, before
renewed capacity/state checks and ordinal 4 submission.


## Standing wave continuation — ordinal 4 submitted

Renewed Tika/pffexport real sandbox smokes passed through beep-heavy.
Four focused restoration tests passed, 78 skipped, 5.69 seconds.
Full sixty-second interval elapsed after confirmed preflight completion.
Free bytes immediately before submission: 421,384,577,024.

Submitted at 2026-10-13T22:43:48Z with the SAME frozen launcher and ordinal 4.
Unit: beep-heavy-corpus-restore-p2-2026-10-13-4.service.
Ledger relative to corpus home:
`staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-04/ledgers/mail/slice.jsonl`.
Freeze record: history/evidence/p2-first-wave-2026-10-13-family-04-run-manifest.json.
At submission the sole detached family unit is active/running.
MemoryMax 34,359,738,368 bytes, MemorySwapMax zero, agent-runs.slice.
Frozen expected policy:
4b83984ac749b78681c8285ce5bb9f0ccbc95b8e70c0a041dfc6c1949a1d0000.

Three of nine families accepted; ordinal 4 submitted, ordinals 5-9 unstarted.
Runtime policy comparison awaits its first family-run-start after verification.
The orchestrator watcher owns the active-unit handoff under Runs 12+/13+.
After this unit ends, reconcile result, accepted seal, source/policy identity,
all children and repair pairs, ceilings and capacity before renewed preflight,
a full sixty-second interval and ordinal 5. Stop and diagnose the first failure;
never retry a sealed family. No source/engine/launcher changes inside the wave.
P2 remains incomplete; eighteen larger occurrences and remaining estate,
recycle and legacy-Word obligations stay open. PR7 follows the terminal record.
Reversal: revert packet continuation decisions while retaining every family,
ledger, output and immutable freeze record. No PR publication or merge here.

Packet verification: launcher within 4,000 characters, manifest parses,
adoption zero conflicts, doctor zero blockers / same three unrelated
advisories, goals index matches, whitespace and added-line public hygiene pass.
No package source edited; package-verify and package-source hosted parity
producers are not run for this docs-only continuation.
Graft estimated 64,688 tokens saved across two retrievals.


## Standing continuation mid-wave final report

lane: corpus-restore
head: 4691ef99a11135a5139cd362d82530a24e11cde2 (local committed continuation-evidence head)
PR(s): #1611 MERGED at 6eb3d03677 | PR7 none (bounded wave incomplete; no push or merge)
package-verify: not run (docs-only; no package edited). Renewed real Tika/pffexport sandbox smokes pass through beep-heavy; four focused restoration tests pass, 78 skipped, 5.69 seconds.
hosted-parity: test-tsgo not run (docs-only: no package source changed) | docgen local not run (docs-only: no package source changed) | jsdoc-ratchet not run (docs-only: no package source changed) | knowledge refs pass at exact committed head, zero live gated observations | fallow audit+health not run (docs-only: no package source changed) | scoped coverage not run (docs-only: no package source changed)
handoff: goals/oppold-corpus-salvage-restoration/history/handoffs/corpus-restore-2026-10-13.md
open items: Family 3 exited zero and sealed acceptance; three of nine accepted. All 4,416 children reconcile: 4,108 engine children, 154 repair copies and 154 Tika outputs; both derived identity sets match all 154 distinct repaired digests. Dispositions: 176 repaired occurrences, 181 unsupported, zero unchanged. Zero warnings, exceptions, interruptions or unaccounted children. Input 98,804,736 bytes; output/family disk usage 246,434,736 bytes; amplification 2.494159146x; attempt 2,409,929 ms; family 2,430,372 ms; archive verification 513,256 ms. Ledger SHA-256 53f84aa4f03c1368b18cf3da03d6a50321d6300c22224abf6d419cae9cd2b99e. Source, engine, launcher, membership and policy identities match all nine immutable pre-launch records; all ceilings hold; earlier ledger hashes unchanged. Renewed admitted preflight passed after approximately nine minutes of test queueing, followed by the full sixty-second interval. Ordinal 4 submitted at 2026-10-13T22:43:48Z with the SAME frozen launcher; unit beep-heavy-corpus-restore-p2-2026-10-13-4.service is the sole active wave unit. Started stamp 2026-10-13T22:44:48.987Z; archive verification active, result absent and family ledger not yet present at handoff. Ledger relative to corpus home: staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-04/ledgers/mail/slice.jsonl. Runtime policy comparison awaits family-run-start. Free bytes immediately before submission 421,384,577,024, above the 100 GB floor. Ordinals 5-9 unstarted. Watcher resumes only after unit 4 ends; reconcile result, accepted seal, source/policy, children/repair pairs and ceilings before renewed preflight, sixty seconds and ordinal 5. Stop and diagnose the first failure; never retry a sealed family or change engine/launcher code inside the wave. P2 remains incomplete; eighteen larger occurrences and estate/recycle/legacy-Word obligations remain open. Decision: accept family 3 and continue the unchanged frozen wave; reversal is reverting packet decisions while retaining every family, ledger, output and freeze record. No outside job, admission limit, configuration or source changed. Packet launcher/manifest/index, public-hygiene checks and commit hooks pass; doctor retains zero blockers and the same three unrelated advisories. Session ledger records watcher handoff. Both proof wrappers ended; the sole family unit intentionally transfers under the standing mid-wave ruling. Family reconciliation and launch evidence are committed locally at 2424d56ced and 4691ef99a1; this exact-head report is appended for the next evidence commit. Graft saved approximately 64,688 tokens across two retrievals.
blocked: wave running — 3 of 9 sealed, unit beep-heavy-corpus-restore-p2-2026-10-13-4.service


## Standing continuation — family 4 accepted and reconciled

The Runs 12+/13+ ruling applies. Prior final report append is preserved.
Family 4 unit beep-heavy-corpus-restore-p2-2026-10-13-4.service ended;
result zero, accepted seal at 2026-10-14T00:09:57.518Z. Expected/terminal one,
unapproved zero. One store pass; zero warnings, exceptions, interruptions,
failure rows or unaccounted children. Four of nine families are accepted.

Ledger relative to corpus home:
`staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-04/ledgers/mail/slice.jsonl`.
Attempt: mail:97f96daeec114daca7972af5:r0.
Object identity: 2ddb92385b12e303bcb4b7d3e1710eaea50557c93ec066378bcbf243103d4f75.
Source digest: 52c2e1331b4f09ada7a741e221afebdfab79d2d4f54a30518350b91c6c08f342.
Policy digest: 4b83984ac749b78681c8285ce5bb9f0ccbc95b8e70c0a041dfc6c1949a1d0000.
Ledger digest: c04d8248fe3b5d6ac17a3c7c43c06237d8ef1a5e4ec32ca6fe3f54f35fdf9870.

Record counts: 85 attachment-type-repair, 836 mail-child-pass, one each
family-run-start, family-attempt-start, mail-store-pass, family-run-summary
and family-acceptance-pass. All 796 engine children and 40 derived children
reconcile for the sole attempt. Both digest sets of 20 repair-copy children
and 20 Tika children equal all 20 distinct repaired digests. Dispositions:
23 repaired occurrences, 62 unsupported, zero unchanged; zero other derived
children. Unsupported dispositions are not repairs.
Input 119,120,896 bytes; output and family disk usage 337,512,124 bytes;
amplification 2.833357835x. Attempt 4,789,718 ms, 42,162.068 ms per MiB;
family 4,797,300 ms. Queue approximately 60,987 ms from submission to
started stamp 2026-10-13T22:44:48.987Z; archive verification 311,220 ms to
family-run-start 2026-10-13T22:50:00.207Z. All retained ceilings hold.
Private log read as counts only: two lines / 807 bytes.

| Prerequisite | State | Current evidence |
| --- | --- | --- |
| P0 sealed | met | Expected sealed run; 755 directory passes, 10,696 file passes, four inherited losses, one preflight and one seal |
| Original slice candidate | met | 53 PST occurrences, 23 eligible recycle occurrences; original identity unchanged |
| Transformation state | met | Families 1-4 accepted with zero results; previous ledger digests unchanged; ordinals 5-9 roots and stamps absent |
| Membership/source identities | met | All nine immutable manifests match archive object, source digest and input bytes |
| Frozen engines | met | pffexport 20260917; bubblewrap 0.13.0; OpenJDK 27 dated 2026-09-15; real Java path and Tika digest unchanged |
| Frozen launcher/membership/policies | met | All nine immutable records match current digests and recomputed twelve-field policy hashes |
| Main/frozen code parity | met | Corpus/libpff diff from origin/main and frozen code head empty; no main integration inside wave |
| Capacity after family 4 | met | 422,859,579,392 bytes, above 100,000,000,000-byte floor |
| Admitted real sandbox smokes | met | Direct approved Tika and pffexport invocations exited zero |
| Four focused restoration tests | met | Four passed, 78 skipped, 3.85 seconds through beep-heavy |
| Packet health | met | Adoption zero conflicts; doctor zero blockers, same three unrelated advisories; index matches |

Renewed smoke wrapper first failed before engine execution; direct approved
invocations passed. No frozen launcher, engine or source changed. No probe
rerun or new bounded fix; prior evidence retained. Both proofs have ended.
A new full sixty-second continuation interval follows confirmed preflight
before capacity/state recheck and ordinal 5. P2 remains incomplete; eighteen
larger occurrences and remaining estate/recycle/legacy-Word gates stay open.
Decision: accept family 4 and continue the unchanged frozen wave. Reversal:
revert packet decisions while retaining every ledger, output and freeze record.
No push, merge, or PR7 publication until the terminal wave record.


## Standing continuation — ordinal 5 submitted

A full sixty-second interval elapsed after renewed admitted preflight and
family 4 reconciliation. Capacity immediately before submission:
422,327,496,704 free bytes, above the 100,000,000,000-byte floor.
Submitted at 2026-10-14T00:14:38Z with the SAME frozen script and ordinal 5.
Unit: beep-heavy-corpus-restore-p2-2026-10-13-5.service.
Started stamp: 2026-10-14T00:14:38.133Z. Active/running at initial observation;
it is the sole wave family unit. MemoryMax 34,359,738,368 bytes,
MemorySwapMax zero, agent-runs.slice. Result absent; re-verification begins.

Ledger relative to corpus home:
`staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-05/ledgers/mail/slice.jsonl`.
Freeze record: history/evidence/p2-first-wave-2026-10-13-family-05-run-manifest.json.
Frozen expected policy:
fd9019c7caf2b434c8a09d12196ca841b4802b7702181fb571d57c4f878ebbc6.
Runtime policy comparison awaits family-run-start after verification.

Four of nine accepted; ordinal 5 active, ordinals 6-9 unstarted. The watcher
owns this explicit mid-wave handoff. After unit 5 ends, reconcile result,
accepted seal, source/policy identities, all child and repair digest pairs,
ceilings and capacity before renewed admitted preflight, a full sixty-second
interval and ordinal 6. Stop and diagnose the first failure; never retry a
sealed family. No source, engine, launcher, admission policy or outside job
changed. P2 remains incomplete; eighteen larger occurrences and remaining
estate/recycle/legacy-Word gates stay open. PR7 follows the terminal record.
Reversal: revert packet continuation decisions while retaining every ledger,
output and immutable manifest. No push, merge or worker-owned gate started.
Graft estimated 79,542 tokens saved across two source retrievals.


## Standing continuation mid-wave final report — ordinal 5

lane: corpus-restore
head: ed8cd2dc3c10efca6d2347ae19722f84b5f9cc49 (local committed continuation-evidence head)
PR(s): #1611 MERGED at 6eb3d03677 | PR7 none (bounded wave incomplete; no push or merge)
package-verify: not run (docs-only; no package edited). Renewed real Tika/pffexport sandbox smokes pass through beep-heavy; four focused restoration tests pass, 78 skipped, 3.85 seconds.
hosted-parity: test-tsgo not run (docs-only: no package source changed) | docgen local not run (docs-only: no package source changed) | jsdoc-ratchet not run (docs-only: no package source changed) | knowledge refs pass at exact committed head, zero live gated observations | fallow audit+health not run (docs-only: no package source changed) | scoped coverage not run (docs-only: no package source changed)
handoff: goals/oppold-corpus-salvage-restoration/history/handoffs/corpus-restore-2026-10-13.md
open items: Family 4 exited zero and sealed acceptance; four of nine accepted. All 836 children reconcile: 796 engine children, 20 repair copies and 20 Tika outputs; both derived digest sets match all 20 distinct repaired digests. Dispositions: 23 repaired occurrences, 62 unsupported, zero unchanged. Zero warnings, exceptions, interruptions or unaccounted children. Input 119,120,896 bytes; output/family disk usage 337,512,124 bytes; amplification 2.833357835x; attempt 4,789,718 ms; family 4,797,300 ms; archive verification 311,220 ms. Ledger SHA-256 c04d8248fe3b5d6ac17a3c7c43c06237d8ef1a5e4ec32ca6fe3f54f35fdf9870. All nine frozen source, engine, script, membership and policy identities match; all ceilings hold; prior ledger hashes unchanged. Renewed admitted direct smokes and focused tests passed, followed by a full sixty-second interval. Ordinal 5 submitted at 2026-10-14T00:14:38Z with the SAME frozen script, started 00:14:38.133Z; unit beep-heavy-corpus-restore-p2-2026-10-13-5.service is the sole active wave family. Result and runtime policy comparison remain pending during archive verification. Ledger relative to corpus home: staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-05/ledgers/mail/slice.jsonl. Free bytes immediately before submission: 422,327,496,704, above the 100 GB floor. Ordinals 6-9 unstarted. Watcher resumes after unit 5 ends; reconcile result, seal, identities, children/repair pairs and ceilings before renewed admitted preflight, sixty seconds and ordinal 6. Stop and diagnose the first failure; never retry a sealed family or change source/engines/launcher inside the wave. P2 remains incomplete; eighteen larger occurrences and estate/recycle/legacy-Word obligations remain open. Decision: accept family 4 and continue the unchanged frozen wave; reversal is reverting packet decisions while retaining every ledger, output and immutable manifest. Packet checks, public hygiene and commit hooks pass; doctor retains zero blockers and three unrelated advisories; index matches. Session ledger records watcher handoff. No worker-owned proof or gate remains active; the sole family unit transfers under the standing ruling. Evidence committed locally at 9c4d332691 and ed8cd2dc3c; this exact-head report is appended for the next evidence commit. Graft saved approximately 79,542 tokens across two retrievals.
blocked: wave running — 4 of 9 sealed, unit beep-heavy-corpus-restore-p2-2026-10-13-5.service


## Standing continuation stop: family 5 sealed failure

The prior ordinal-5 final report append is preserved. Read result stamp 1
and reconciled the terminal family-acceptance-failure. Four families remain
accepted; family 5 failed; ordinals 6-9 have no run roots or started stamps.
No family unit is active. No ordinal 6 launch, retry or frozen code change.

Unit: beep-heavy-corpus-restore-p2-2026-10-13-5.service.
Ledger relative to corpus home:
`staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-05/ledgers/mail/slice.jsonl`.
Freeze record: history/evidence/p2-first-wave-2026-10-13-family-05-run-manifest.json.
Attempt: mail:37a7c097ad537810a0a4dc25:r0.
Object: 492971fd43294de2fc1f47e58ad0ec78fa0438af9004fcb1166ad42ffd09437d.
Source: 722872e1f639f3cf9d771708dd0f817111a024880292aeaaf9964b664d9f9c81.
Runtime/frozen policy: fd9019c7caf2b434c8a09d12196ca841b4802b7702181fb571d57c4f878ebbc6.
Ledger: dda98f8c7088589dffdc463935455b7474fad7ab4738cf8feaab749dd1d3031c.

325 attachment-type-repair rows, one each family-run-start, family-attempt-start,
mail-store-exception, family-run-summary and family-acceptance-failure.
Expected/terminal one, unapproved one; engine-failure approved false.
Zero store passes, child passes, warnings or interruptions. Partial dispositions
108 repaired occurrences / 98 distinct digests, 217 unsupported, zero unchanged.
The 6,368 retained files include 99 repair copies and 98 Tika outputs. One
unmatched GIF copy, zero unmatched Tika files; attempt remains partial.
Input 157,975,552 bytes; retained output/family disk usage 354,621,626 bytes;
amplification 2.244788016x. Family elapsed 1,491,085 ms. No terminal attempt
duration or accepted child reconciliation exists. Retained ceilings hold.
Started 2026-10-14T00:14:38.133Z, family start 00:21:38.814Z,
sealed 00:46:29.904Z; verification 420,681 ms, approximate queue 133 ms.
Free bytes before launch 422,327,496,704; after failure 418,243,366,912.

Journal counts: killed 0, oom-kill/signal failure 0, code=exited 1, lines 4.
Private live log counts: lines 4, bytes 990. No lines printed.
Read-only second-pass reproduction of the unmatched 3,020-byte GIF copy:
exit 1, stdout chars/bytes/nonspace 0; repeat gives the same result and one
TikaException count. Tika version smoke passes. Precise parser cause is
unavailable from the generic ledger catch; input corruption is not claimed.
The failing digest is 21a22af48d47077e731ed4806a6a470191c3c85924f7c8c2d8f4aee55dc9dd7a.
Both diagnostic wrappers ended and altered no retained artifact.
Four focused restoration tests pass, 78 skipped, 4.41 seconds, through beep-heavy.
Real pffexport sandbox smoke passes. No new probe or pre-run fix.

| Prerequisite | State | Current measured evidence |
| --- | --- | --- |
| P0 seal | met | Expected sealed run, 755 directory passes, 10,696 file passes, four losses, one preflight and one seal |
| Original slice candidate | met | 53 PST occurrences, 23 eligible, original object/digest unchanged, input 56,140,800 bytes |
| Transformation state | not met for continuation | Four accepted, family 5 sealed unapproved failure; ordinals 6-9 unstarted |
| Membership/source identities | met | All nine immutable manifests match archive object/digest/input-byte metadata |
| Frozen engines | met | pffexport 20260917, bubblewrap 0.13.0, OpenJDK 27 dated 2026-09-15, Java real path and Tika digest unchanged |
| Frozen script/membership/policy | met | All nine hashes and recomputed twelve-field policy digests match; all five runtime policies match |
| Main/frozen code parity | met | Corpus/libpff diff from both origin/main and frozen code head empty before integration |
| Capacity | met | 418,243,366,912 bytes free, above 100,000,000,000 floor |
| Real version smokes | met | Frozen Tika and pffexport sandbox version checks exit zero |
| Focused synthetic proof | met | Four tests passed, 78 skipped, 4.41 seconds through beep-heavy |
| Packet health baseline | met | Adoption zero conflicts, doctor zero blockers and same three unrelated advisories, index matches |

Previous four ledger digests match the recorded accepted evidence. Frozen
script digest 5b1d87cb5c420a53e56340bbc092c21826666c9e25ef210a421b8e20955e65e6.
Membership digest 00c2bf191c03874664b6167b614b6dfeb1dddac27fadc0407d673eb35b8bd3b2.
Terminal record: history/p2/2026-10-14-first-wave-stop.md.
Decision: stop and publish aggregate failure evidence with P2 in-progress.
Reversal: revert packet decisions while retaining every family, output,
ledger, claim and freeze record. No future execution or exception approval
is authorized here. The orchestrator decides any separately frozen recovery.
Follow-ups: sanitized stage/exception-class preservation and a failing-GIF
synthetic fixture. Eighteen larger occurrences and estate/recycle/DOC gates
stay open; P0/P1/P4 complete, P3 pending. No package source edited.
Graft saved approximately 124,561 tokens across three retrievals.

## Terminal evidence publication checks

Wave failure evidence committed at aaa63f2bd0. After the stopped wave,
merged origin/main at b77ac5e82f without conflict into local head
3b852097704bbdd3a4da617b94ac1d33e1490e1c. No Corpus/libpff engine source
changed; the complete PR diff against main is confined to this packet.
The merge moved bun.lock, so bun install --frozen-lockfile ran once and passed
without tracked changes. No main integration occurred during live execution.

Post-merge doctor has zero blockers and the same three unrelated advisories.
Goals index refreshed its git-ignored projection successfully; launcher,
manifest, whitespace and added-line public-hygiene checks pass.
Knowledge refs passed through beep-heavy at merge head
3b852097704bbdd3a4da617b94ac1d33e1490e1c with zero live gated observations.
Earlier pre-commit gitleaks, typos, Biome and commitlint hooks passed.
This is a docs-only evidence PR. Package-verify, test-tsgo, docgen local,
jsdoc-ratchet, fallow audit+health and scoped coverage are not run because
no package source changed. Prior merged engine/selector proofs remain
historical evidence, not a claim that family 5 accepted.

Publication uses Yeet through beep-heavy. P2 remains in-progress and the
wave remains stopped irrespective of publication state. No merge is authorized.


## Terminal wave failure final report

lane: corpus-restore

head: 6412bf26c0f7a63e1eb9888a739e427dfe17ef14 (exact published PR head)

PR(s): #1646 OPEN, ready for review, content-final failure evidence | #1611 MERGED at 6eb3d03677

package-verify: not run (docs-only; no package edited). Four focused restoration tests passed, 78 skipped, 4.41 seconds through beep-heavy; real frozen Tika/pffexport sandbox version smokes passed.

hosted-parity: test-tsgo not run (docs-only: no package source changed) | docgen local not run (docs-only: no package source changed) | jsdoc-ratchet pass through Yeet's committed cheap gate | knowledge refs pass through beep-heavy at merged head 3b852097704bbdd3a4da617b94ac1d33e1490e1c, zero live gated observations | fallow audit+health pass through Yeet cheap gates | scoped coverage not run (docs-only: no package source changed)

handoff: goals/oppold-corpus-salvage-restoration/history/handoffs/corpus-restore-2026-10-13.md

open items: The bounded wave is stopped: four accepted families, family 5 sealed failure, ordinals 6-9 unstarted. Family 5 result is 1; one unapproved engine-failure, expected/terminal one, unapproved one, zero store passes or terminal child rows, zero warnings or interruptions. Input 157,975,552 bytes; retained output/family disk usage 354,621,626 bytes, amplification 2.244788016x; family elapsed 1,491,085 ms and archive verification 420,681 ms. Partial dispositions are 108 repaired occurrences / 98 distinct digests, 217 unsupported, zero unchanged. Retained copies/Tika files are 99/98. The sole unmatched 3,020-byte GIF repair copy reproduces Tika exit 1, empty stdout and TikaException in the frozen read-only sandbox. Attribution is an input-sensitive Tika/parser failure; the precise parser cause and whether the input is corrupt remain unresolved. Ledger SHA-256 dda98f8c7088589dffdc463935455b7474fad7ab4738cf8feaab749dd1d3031c. All nine frozen identities and ceilings hold; earlier accepted ledger hashes are unchanged. Capacity after failure was 418,243,366,912 free bytes. No ordinal 6 launch, sealed-family retry, engine/launcher change, artifact mutation or merge occurred. P2 remains in-progress; P0/P1/P4 complete, P3 pending. Decision: retain every family, ledger, output, claim and freeze record, publish aggregate failure evidence, and stop under the standing ruling. Reversal: revert packet decisions while retaining all evidence. Any recovery execution or exception approval needs an orchestrator ruling and a new freeze record. Follow-ups are sanitized failure-stage/exception-class preservation, a failing-GIF synthetic fixture, eighteen larger occurrences and remaining estate/recycle/DOC gates. Terminal record: history/p2/2026-10-14-first-wave-stop.md. Yeet passed all 16 cheap gates and the exact-head install preflight; one push, ready flip, zero unresolved review threads at the final read. Hosted CI and the review window are pending; merge readiness is not claimed. The two Vercel deployment failures are verified build-rate limits and acknowledged environment-only. The worker-owned readiness monitor was cancelled and its proof inbox row acknowledged; no worker-owned unit or gate remains active. The orchestrator owns subsequent PR handling. Packet checks and commit hooks passed with zero new doctor blockers. This exact-head report is appended locally to the handoff for the next evidence commit, preserving the prior report append. Graft saved approximately 124,561 tokens across three retrievals.

blocked: family 5 sealed failure — frozen Tika second pass exits 1 with empty output on the unmatched GIF repair copy; wave stopped, PR #1646 ready


## Run 17: authorized continuation after family 5 sealed-failure

The preceding final-report append is retained. Run 17 supersedes the stop
on further ordinals while preserving family 5 sealed-failure. PR #1646 is
OPEN at 6412bf26c0f7a63e1eb9888a739e427dfe17ef14, orchestrator-owned.
No push to it in this continuation. Four accepted, one failed, four unstarted.

| Prerequisite | State | Measured evidence |
| --- | --- | --- |
| P0 sealed | met | 755 directory passes, 10,696 file passes, four losses, one preflight, one seal |
| Existing transformation state | met | Results 0/0/0/0/1; accepted seals 1-4, failure seal 5; all five ledger hashes unchanged |
| Source identities | met | All nine object/digest/input-byte records match archive and membership |
| Frozen identities | met | All nine engine, launcher, membership and twelve-field policy digests match |
| Code parity | met | Corpus/libpff source identical to all nine frozen code heads |
| Capacity | met | 417,086,545,920 bytes free, above 100,000,000,000 floor |
| Admitted engine smokes | met | Real frozen Tika and pffexport sandbox invocations exit zero |
| Focused synthetic proof | met | Four passed, 78 skipped, 4.93 seconds through beep-heavy |
| Packet health | met | Adoption passes, doctor zero blockers and same three unrelated advisories; index matches |
| Next ordinal | met | 6-9 run roots and stamps absent; no active wave family unit |

User-manager variables were absent in this API shell. Restored the standard
user-bus environment for commands; manager and admitted smokes work. No
configuration or systemd unit changed. No probe or code fix runs again.
Frozen script digest 5b1d87cb5c420a53e56340bbc092c21826666c9e25ef210a421b8e20955e65e6.
Membership digest 00c2bf191c03874664b6167b614b6dfeb1dddac27fadc0407d673eb35b8bd3b2.
Ordinal 6 freeze record: history/evidence/p2-first-wave-2026-10-13-family-06-run-manifest.json.
Expected policy: 0c5decece1493a3948b13315444251763a15a7552366c0a364f20602052965b9.
A full sixty-second interval follows renewed preflight. Retained ceilings:
ratio 4, attempt 7,200,000 ms, family 43,200,000 ms, total 2,147,483,648 bytes.
Decision and reversal are recorded in SPEC. Separate family-5 recovery waits
until after this wave; eighteen larger occurrences and other family gates stay open.
Graft saved approximately 99,936 tokens across two retrievals.


## Run 17: ordinal 6 submitted

Full interval: 2026-10-14T01:06:25Z to 01:07:25Z.
Final capacity recheck: 417,793,134,592 free bytes.
Submitted 2026-10-14T01:07:39Z with the SAME frozen script, ordinal 6.
Started stamp: 2026-10-14T01:07:39.216Z.
Unit: beep-heavy-corpus-restore-p2-2026-10-13-6.service.
Active/running at initial observation, sole wave family unit. MemoryMax
34,359,738,368 bytes, MemorySwapMax zero, agent-runs.slice. Result absent;
private log one line, no content read. Runtime policy comparison awaits
family-run-start after archive re-verification.

Ledger relative to corpus home:
`staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-06/ledgers/mail/slice.jsonl`.
Five of nine sealed: four accepted, family 5 sealed-failure. Ordinal 6 active;
7-9 unstarted. The orchestrator driver owns the explicit mid-wave handoff.
After unit 6 ends, reconcile result, acceptance, source/policy identity,
children and repair pairs, ceilings and capacity. If accepted, renew admitted
preflight and full sixty-second interval before ordinal 7; stop and diagnose
any further failure. Never retry family 5 or change frozen engines/launcher.

Knowledge refs passes through beep-heavy with zero live gated observations.
Packet doctor zero new blockers, same three unrelated advisories; index matches.
Launcher size and JSON checks, whitespace, gitleaks, typos, Biome and commitlint
pass. Original candidate remains 53 PST occurrences, 23 eligible, input
56,140,800 bytes and original object/digest unchanged. No package source
edited; package-verify and source hosted-parity lanes are not run (docs-only).
No push, main integration, retry, engine fix or worker-owned gate started.
PR #1646 remains orchestrator-owned; terminal wave PR follows all remaining
seals. Run-17 decision reversal retains all immutable evidence.


## Run 17 mid-wave final report — ordinal 6

lane: corpus-restore
head: e471c677116b0f8dfb121635013cbf32b14b8ba3 (local committed continuation-evidence head)
PR(s): #1646 OPEN, orchestrator-owned failure-evidence PR | PR7 none (bounded wave running; no push or merge)
package-verify: not run (docs-only; no package edited). Renewed admitted real Tika/pffexport sandbox smokes pass; four focused restoration tests pass, 78 skipped, 4.93 seconds.
hosted-parity: test-tsgo not run (docs-only: no package source changed) | docgen local not run (docs-only: no package source changed) | jsdoc-ratchet not run (docs-only: no package source changed) | knowledge refs pass through beep-heavy, zero live gated observations | fallow audit+health not run (docs-only: no package source changed) | scoped coverage not run (docs-only: no package source changed)
handoff: goals/oppold-corpus-salvage-restoration/history/handoffs/corpus-restore-2026-10-13.md
open items: Run 17 authorizes continuing ordinals 6-9 with the SAME frozen launcher. Five of nine sealed: four accepted, family 5 sealed-failure; no retry or acceptance of family 5. All five ledger hashes unchanged. All nine source, engine, launcher, membership, twelve-field policy and frozen-code identities match. P0 seal and counts unchanged; original candidate remains 53 PST occurrences, 23 eligible, 56,140,800 input bytes and original object/digest unchanged. Both renewed admitted sandbox smokes and four focused tests passed; full sixty-second interval elapsed from 01:06:25Z to 01:07:25Z. Capacity immediately before submission 417,793,134,592 free bytes, above 100 GB floor. Ordinal 6 submitted 2026-10-14T01:07:39Z, started 01:07:39.216Z; sole active wave unit beep-heavy-corpus-restore-p2-2026-10-13-6.service, MemoryMax 34,359,738,368 bytes, MemorySwapMax zero. Result and runtime policy comparison await archive verification and seal. Ledger relative to corpus home: staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-06/ledgers/mail/slice.jsonl. Frozen family-6 manifest: history/evidence/p2-first-wave-2026-10-13-family-06-run-manifest.json; policy 0c5decece1493a3948b13315444251763a15a7552366c0a364f20602052965b9. Ordinals 7-9 unstarted. Driver resumes after unit 6 ends, reconciles result, accepted seal, source/policy identities, child and repair digest pairs, ceilings and capacity before renewed admitted preflight, full sixty seconds and ordinal 7. Stop and diagnose any further sealed failure. Retained ceilings: ratio 4, attempt 7,200,000 ms, family 43,200,000 ms, total output 2,147,483,648 bytes. P2 incomplete; eighteen larger occurrences and estate/recycle/DOC obligations remain open. Separate family-5 parser-exception engine PR and freshly frozen recovery follow the wave under Run 17; no recovery code changed here. Decision: continue remaining authorized ordinals while retaining family 5 failed; reversal is reverting packet decisions while retaining every ledger, output, claim and immutable manifest. Prior final-report append preserved. Public packet checks and commit hooks pass; doctor zero new blockers and same three unrelated advisories; index matches. User-bus shell precondition repaired by standard command environment, no configuration change. Continuation and launch evidence committed locally at 15ac37a5fc and e471c67711; this exact-head report is appended for the next evidence commit. No push, merge, engine/launcher change, source mutation or worker-owned gate. The sole family unit transfers to the orchestrator driver under the standing mid-wave ruling. Graft saved approximately 99,936 tokens across two retrievals.
blocked: wave running — 5 of 9 sealed, unit beep-heavy-corpus-restore-p2-2026-10-13-6.service


## Standing continuation: family 6 accepted

Previous final-report append retained. Family 6 result 0, accepted seal,
expected/terminal one and unapproved zero. Unit:
beep-heavy-corpus-restore-p2-2026-10-13-6.service.
Ledger relative to corpus home:
`staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-06/ledgers/mail/slice.jsonl`.
Freeze record: history/evidence/p2-first-wave-2026-10-13-family-06-run-manifest.json.
Attempt: mail:ecf3145ddfc6be0fe2f82ec5:r0.
Object: fa64112f2a788933cc33f970f51bebe2135ab410bc43089164a3e78869a870a4.
Source: 2b8108bc1db6feef777023648cd55c200ff838ad43e0e8ea5afe508bb93f5264.
Policy: 0c5decece1493a3948b13315444251763a15a7552366c0a364f20602052965b9.
Ledger: e96d312026220df728ebbb6d242b360ce1521015805e1fdd33888066c4e5c14e.

Record counts: 437 attachment-type-repair, 6,091 mail-child-pass, one each
family-run-start, family-attempt-start, mail-store-pass, family-run-summary,
family-acceptance-pass. Zero warnings, exceptions or interruptions.
All 6,091 children reconcile: 5,735 engine children, 178 repair copies,
178 Tika children, zero other derived children. Both digest sets equal all
178 distinct repaired digests. Dispositions: 217 repaired occurrences,
220 unsupported, zero unchanged. Zero unaccounted children.
Input 190,989,312 bytes; output and family disk usage 496,830,967 bytes;
amplification 2.601354818x. Attempt 5,724,191 ms, family 5,756,397 ms;
31,427.148 ms per MiB. Started 2026-10-14T01:07:39.216Z, family start
01:12:34.998Z, seal 02:48:31.401Z; verification 295,782 ms.
Before submission free bytes 417,793,134,592; current 407,672,446,976.
All attempt and cumulative ceilings hold. Six of nine sealed: five accepted,
family 5 sealed-failure retained. Ordinals 7-9 unstarted; no active family unit.

| Prerequisite | State | Current evidence |
| --- | --- | --- |
| P0 seal | met | 755 directory passes, 10,696 file passes, four losses, one preflight and one seal |
| Original candidate | met | 53 PST occurrences, 23 eligible; original identity and 56,140,800 bytes unchanged |
| Existing ledgers | met | Six seals, five accepted and one failed; earlier ledger digests unchanged |
| Frozen identities | met | All nine source, engine, script, membership, policy and frozen-code identities match |
| Capacity | met | 407,672,446,976 free bytes, above 100,000,000,000 floor |
| Real engine smokes | met | Admitted frozen Tika and pffexport sandbox version checks exited zero |
| Focused proof | pending | Shared beep-heavy admission; no slot bypass |
| Packet health | met | Adoption passed; doctor zero blockers, same three unrelated advisories; index matches |
| Next ordinal | met | 7-9 run roots and stamps absent; no active family unit |

Frozen script digest:
5b1d87cb5c420a53e56340bbc092c21826666c9e25ef210a421b8e20955e65e6.
Membership digest:
00c2bf191c03874664b6167b614b6dfeb1dddac27fadc0407d673eb35b8bd3b2.
All nine twelve-field policy digests recomputed and matched.
The lane source matches the immutable code head; newer main source differs,
so no main integration occurs while this frozen wave is executing. Main is
merged before terminal PR7 as ruled. No code, engine or launcher change.
Decision: accept family 6 and continue ordinal 7 only after renewed admitted
proof, the full sixty-second interval, and final capacity/state recheck.
Reversal: revert packet decisions while retaining all immutable evidence.
Family 5 recovery remains a separate run after this wave. Eighteen larger
occurrences and estate/recycle/DOC gates remain open; P2 stays in-progress.


Renewed focused restoration proof: four passed, 78 skipped, 3.04 seconds
through beep-heavy. The admitted wrapper ended; brief shared queue wait
resolved without bypass or outside-job changes. Both real engine smokes pass.
Full sixty-second interval begins after this proof. No new probe or fix.


## Standing continuation: ordinal 7 submitted

Full interval: 2026-10-14T02:52:32Z to 02:53:32Z.
Final capacity recheck: 407,244,369,920 free bytes, above the 100 GB floor.
Submitted 2026-10-14T02:53:40Z with the SAME frozen script and ordinal 7.
Started stamp: 2026-10-14T02:53:40.233Z.
Unit: beep-heavy-corpus-restore-p2-2026-10-13-7.service.
Active/running, sole wave family unit. MemoryMax 34,359,738,368 bytes,
MemorySwapMax zero, agent-runs.slice. Result absent, private log one line.
Runtime policy comparison awaits family-run-start after archive verification.
Ledger relative to corpus home:
`staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-07/ledgers/mail/slice.jsonl`.
Freeze record: history/evidence/p2-first-wave-2026-10-13-family-07-run-manifest.json.
Expected policy:
d83ec6f1f2dfc1db153b9b0c36bab3274e9aca6a57449e29060c34825b29fc8e.

Six of nine sealed, five accepted and family 5 failed; ordinals 8-9 unstarted.
The driver resumes only after unit 7 ends. Reconcile result, seal, source and
policy identities, children/repair digest pairs and ceilings before renewed
admitted preflight, the full sixty-second interval and ordinal 8. Stop and
diagnose any further failure; never retry a sealed family. Family 5 recovery
remains separate after the wave. P2 stays incomplete; eighteen larger inputs
and estate/recycle/DOC obligations remain open.

Knowledge refs passed through beep-heavy at pre-commit head e471c67711,
zero live gated observations. Packet adoption and doctor pass; zero blockers,
same three unrelated advisories; index matches. Launcher size, manifest JSON,
whitespace, added-line public hygiene, gitleaks, typos and commitlint pass.
No package source edited; package-verify and other source hosted-parity lanes
not run (docs-only). No push, main integration, engine/launcher change,
sealed-family retry or worker-owned gate. The sole live family unit transfers
to the driver under standing Runs 12+/13+ and Run 17. Reversal retains every
ledger, output, claim and immutable freeze record. PR #1646 merged per the
orchestrator note; terminal PR7 follows the remaining seals and one main merge.
Graft saved approximately 93,246 tokens across two retrievals.


## Standing continuation mid-wave final report — ordinal 7

lane: corpus-restore
head: 9b7460a4c0d5dae11a5fdf50b3330d08c5c42a6c (local committed continuation-evidence head)
PR(s): #1646 MERGED at 06eef79feb per orchestrator ruling | PR7 none (bounded wave running; no push or merge)
package-verify: not run (docs-only; no package edited). Renewed admitted Tika/pffexport sandbox smokes passed; four focused restoration tests passed, 78 skipped, 3.04 seconds.
hosted-parity: test-tsgo not run (docs-only: no package source changed) | docgen local not run (docs-only: no package source changed) | jsdoc-ratchet not run (docs-only: no package source changed) | knowledge refs pass through beep-heavy at pre-commit head e471c67711, zero live gated observations | fallow audit+health not run (docs-only: no package source changed) | scoped coverage not run (docs-only: no package source changed)
handoff: goals/oppold-corpus-salvage-restoration/history/handoffs/corpus-restore-2026-10-13.md
open items: Family 6 result zero and accepted seal fully reconcile 6,091 children: 5,735 engine, 178 repair copies, 178 Tika outputs; both digest sets match 178 distinct repaired digests. Dispositions: 217 repaired occurrences, 220 unsupported, zero unchanged. Zero warnings, exceptions, interruptions or unaccounted children. Input 190,989,312 bytes; output/family disk usage 496,830,967 bytes; amplification 2.601354818x; attempt 5,724,191 ms, family 5,756,397 ms, archive verification 295,782 ms. Ledger SHA-256 e96d312026220df728ebbb6d242b360ce1521015805e1fdd33888066c4e5c14e. All nine source, engine, launcher, membership, recomputed twelve-field policy and frozen-code identities match; previous ledger digests unchanged. Six of nine sealed: five accepted, family 5 retained sealed-failure. Renewed admitted preflight passed; full sixty-second interval elapsed from 02:52:32Z to 02:53:32Z. Free bytes immediately before submission 407,244,369,920, above the 100 GB floor. Ordinal 7 submitted at 2026-10-14T02:53:40Z with the SAME frozen launcher, started 02:53:40.233Z; sole active family unit beep-heavy-corpus-restore-p2-2026-10-13-7.service, MemoryMax 34,359,738,368 bytes, MemorySwapMax zero. Result and runtime policy comparison await archive verification and seal. Ledger relative to corpus home: staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-07/ledgers/mail/slice.jsonl. Frozen family-7 policy d83ec6f1f2dfc1db153b9b0c36bab3274e9aca6a57449e29060c34825b29fc8e. Ordinals 8-9 unstarted. Driver resumes after unit 7 ends; reconcile result, seal, identities, children/repair pairs and ceilings before renewed admitted preflight, sixty seconds and ordinal 8. Stop and diagnose any further sealed failure; never retry a sealed family. Decision: accept family 6 and continue the unchanged authorized wave; reversal is reverting packet decisions while retaining every ledger, output, claim and immutable manifest. Family-5 parser-exception engine PR and separately frozen recovery follow the wave. P2 remains incomplete; eighteen larger occurrences and estate/recycle/DOC obligations remain open. Newer main source differs from the frozen code; no integration during execution, one main merge before terminal PR7 as ruled. No source, engine, launcher, artifact mutation, push, merge or worker-owned gate. Packet checks and commit hooks passed; doctor zero new blockers and the same three unrelated advisories; index matches. Evidence committed at 2087bdf25a and 9b7460a4c0; this exact-head report is appended for the next evidence commit. Session ledger records the explicit driver handoff. Graft saved approximately 93,246 tokens across two retrievals.
blocked: wave running — 6 of 9 sealed, unit beep-heavy-corpus-restore-p2-2026-10-13-7.service


## Standing continuation stop: family 7 sealed failure

Seven of nine families are sealed: five accepted (1-4 and 6), two failed
(5 and 7). Ordinals 8-9 are unstarted; no family unit is active. The prior
ordinal-7 final-report append is preserved. No retry or next launch occurred.

Unit: beep-heavy-corpus-restore-p2-2026-10-13-7.service.
Ledger relative to corpus home:
`staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-07/ledgers/mail/slice.jsonl`.
Freeze record: history/evidence/p2-first-wave-2026-10-13-family-07-run-manifest.json.
Attempt: mail:6b3d96d77df85b9358314c88:r0.
Object: 9a7fab20677805c46b25d8953cecbafb4eacf082e02d7f603fd720add1f76df3.
Source: 77b95a03291e7fd49496b88c7d7b052f723abc3d6176a2c1492033c4d776d2a5.
Runtime/frozen policy: d83ec6f1f2dfc1db153b9b0c36bab3274e9aca6a57449e29060c34825b29fc8e.
Ledger: fca75d67a121ef972f807acd099ad56e4cb9d3f4bc706959c1de187f5c572e35.
Retained-output digest: 12e0992fea8cc572f7f104fdb7f68c1badb7ff87c12859547370d1ec4cad343c.

Result 1. One each family-run-start, family-attempt-start, mail-store-exception,
family-run-summary and family-acceptance-failure; 505 attachment-type-repair
rows. Expected/terminal one, unapproved one, engine-failure approved false.
Zero store passes, terminal child rows, warnings or interruptions. Partial
dispositions: 288 repaired occurrences / 245 distinct digests, 217 unsupported,
zero unchanged. The 15,003 retained files total 910,603,343 bytes, including
246 repair copies and 245 Tika files. One unmatched PDF copy, zero unmatched
Tika files. No accepted child reconciliation or atomic promotion is claimed.

Input 354,026,496 bytes; retained output 910,603,343 bytes, amplification
2.572133310x. Output fits the 1,416,105,984-byte attempt cap and
2,147,483,648-byte family cap. Family elapsed 7,211,513 ms fits the
43,200,000-ms family cap but exceeds the 7,200,000-ms attempt cap.
No terminal attempt-duration field exists, so the family duration alone
does not establish exact attempt timing.

Started 2026-10-14T02:53:40.233Z, family start 02:58:07.256Z,
attempt-start row 02:58:07.279Z, failure seal 04:58:18.773Z.
Archive re-verification: 267,023 ms. Queue delay approximately 233 ms
from the second-resolution submission recorded in the previous handoff.
The unmatched 2,280,873-byte PDF copy was modified at 04:58:11.685Z,
7,204,429 ms after family start. Its digest:
af2d876b6c29e9c96f00a7d085ad0ad5e40f87a0b842fa13350e469739317440.
The code checks remaining attempt/family time before the Tika second pass
and bounds that subprocess by the remaining time. Timing and the missing
second-pass output strongly support elapsed-budget exhaustion during
attachment repair. Exact underlying exception and parser status are
unresolved: the terminal catch discards the original cause and writes a
generic engine-failure. No parser-failure approval is inferred from this
timing, and no expensive reproduction or sealed-family retry was performed.

Private log counts: four lines, 990 bytes. Journal counts: killed zero,
oom-kill/signal failure zero, code=exited one, four lines. No private lines
were printed. The collected transient unit's default Result=success is
not execution evidence; the result stamp and sealed ledger are authoritative.

| Prerequisite | State | Measured evidence |
| --- | --- | --- |
| P0 seal | met | 755 directory passes, 10,696 file passes, four losses, one preflight and one seal |
| Original candidate | met | 53 PST occurrences, 23 eligible, original object/digest and 56,140,800 bytes unchanged |
| Existing transformation state | not met for continuation | Seven seals, five accepted and two failed; ordinals 8-9 absent |
| Source metadata | met | All nine manifest object/digest/input-byte identities match archive metadata |
| Frozen engines | met | pffexport 20260917, bubblewrap 0.13.0, OpenJDK 27 dated 2026-09-15; Java real path and Tika digest unchanged |
| Frozen script/membership | met | All nine script and membership digests match |
| Runtime policy | met | All seven started-family policies match their immutable manifests |
| Frozen code | met | Corpus/libpff source diff from frozen code head empty at diagnosis |
| Capacity | met | 407,601,733,632 free bytes, above 100,000,000,000 floor |
| Renewed smokes/focused proof | not run | No next launch after sealed failure; prior ordinal-7 preflight retained as historical proof |
| Packet baseline | met | Adoption zero conflicts; doctor zero blockers and same three unrelated advisories |

All six earlier ledger hashes match the previous handoffs. Script:
5b1d87cb5c420a53e56340bbc092c21826666c9e25ef210a421b8e20955e65e6.
Membership:
00c2bf191c03874664b6167b614b6dfeb1dddac27fadc0407d673eb35b8bd3b2.
Before ordinal 7 submission: 407,244,369,920 free bytes.
Decision: stop under Run 17 at the further sealed failure, retain every
artifact, and publish aggregate evidence. Reversal: revert packet decisions
while retaining every ledger, output, claim and immutable freeze record.
P2 remains in-progress; P0/P1/P4 complete, P3 pending. Family-5 recovery,
family-7 diagnosis/recovery, two unstarted bounded members, eighteen larger
occurrences and estate/recycle/DOC obligations remain open. The orchestrator
decides continuation; no new execution is authorized by this failure report.
Graft saved approximately 65,334 tokens across two retrievals.

Post-stop publication integration: merged origin/main 9b21df9738 after
every wave family unit ended. Four packet conflicts were resolved to this
branch's newer records as the orchestrator note permits; upstream's earlier
family-5 stop evidence remains present. Manifest status now records family 7.
This is publication integration only, not a change to any completed execution.
The newer main may change engine source; any later execution must prove its
code identity against its governing freeze record before launch.

Publication checks: default frozen-lockfile install passed after main integration,
with no tracked lockfile change. Complete diff against main is seven packet
files only. Launcher size, manifest JSON, required reference-pattern search,
whitespace, doctor and index checks pass. Doctor has zero new blockers and
the same three unrelated advisories. Merge hooks pass with inherited
large-file Biome warnings and JSDoc warnings from main; no package edited.
Knowledge refs is awaiting shared beep-heavy admission; no bypass.

Shared admission cleared without bypass. Knowledge refs passed through
beep-heavy at head 2502411929 with zero live gated observations. No package
source changed in the PR; package-verify and source hosted-parity lanes are
not run (docs-only). Publication uses the Yeet skill under admitted heavy
execution. The sealed family failure remains the blocker regardless of PR
readiness; the orchestrator owns any next execution decision.


## Family 7 stop final report

lane: corpus-restore
head: 258042e16e61139c504801b4f3e087f2d534ebeb (exact published PR head)
PR(s): #1683 OPEN, draft, aggregate failure evidence published | #1646 MERGED
package-verify: not run (docs-only: no package source edited; no new family launch or engine fix).
hosted-parity: test-tsgo not run (docs-only: no package source changed) | docgen local not run (docs-only: no package source changed) | jsdoc-ratchet pass through Yeet's committed cheap gate | knowledge refs pass through beep-heavy at 2502411929, zero live gated observations | fallow audit+health pass through Yeet cheap gates | scoped coverage not run (docs-only: no package source changed)
handoff: goals/oppold-corpus-salvage-restoration/history/handoffs/corpus-restore-2026-10-13.md
open items: Family 7 result 1 and immutable family-acceptance-failure; one unapproved engine-failure, expected/terminal one, unapproved one. Seven of nine sealed: five accepted (1-4 and 6), families 5 and 7 failed, ordinals 8-9 unstarted. No next launch, retry, artifact mutation or merge of a PR. Family 7 input 354,026,496 bytes; retained output 910,603,343 bytes, amplification 2.572133310x; family elapsed 7,211,513 ms. Zero accepted store or terminal child rows, warnings or interruptions. Partial dispositions: 288 repaired occurrences / 245 distinct digests, 217 unsupported, zero unchanged. Retained 15,003 files include 246 repair copies and 245 Tika files. One unmatched 2,280,873-byte PDF copy near the attempt cap strongly supports attachment-repair elapsed-budget exhaustion, but exact cause is unresolved because the generic terminal catch discarded it. No parser-exception approval or accepted child reconciliation is claimed. Ledger SHA-256 fca75d67a121ef972f807acd099ad56e4cb9d3f4bc706959c1de187f5c572e35. Frozen engines, nine source metadata identities, script/membership digests and seven runtime policies match; earlier ledger hashes unchanged. Capacity after failure 407,601,733,632 bytes. Decision: stop under Run 17 and publish aggregate evidence; reversal is reverting packet decisions while retaining every ledger, output, claim and immutable manifest. P2 remains in-progress; family-5 separate recovery, family-7 diagnosis/recovery, two unstarted members, eighteen larger occurrences and estate/recycle/DOC obligations remain open. Main was integrated only after the wave stopped; newer restoration source differs from the frozen execution code, so continuation must re-establish governing code identity before launch. All sixteen cheap gates and exact-head install preflight passed; one push, seven packet files only. Packet doctor zero new blockers, same three unrelated advisories. Yeet ready refused its branch lookup despite REST confirming #1683 open; the explicit guarded ready command exited 75 with GraphQL remaining zero, reset 2026-10-14T05:34:35Z. Ready flip and review-thread state remain pending/unknown; merge readiness is not claimed. Worker-owned monitor terminated and proof inbox acknowledged; no worker-owned unit or gate active. Session ledger records blocked handoff. The committed handoff contains the diagnosis, decisions and aggregate evidence; this exact-head final report is appended locally for the next evidence commit. Graft saved approximately 65,334 tokens across two retrievals.
blocked: family 7 sealed failure — likely attachment-repair elapsed-budget exhaustion; exact cause unresolved, wave stopped, PR #1683 draft pending GraphQL quota


## 2026-10-14 continuation preflight: ordinal 8 held on frozen code

Read the complete brief and its latest 05:55Z ruling. Continuation of
ordinals 8 and 9 is authorized; families 5 and 7 remain sealed failures,
not accepted stores. Preserve the prior exact-head stop-report append.
No running wave family unit exists, and ordinals 8 and 9 have no run root,
started stamp or result. All seven previous result stamps and ledger hashes
match the prior handoffs: five accepted, two failed. Family 7 result 1,
expected/terminal one, unapproved one; ledger SHA-256
fca75d67a121ef972f807acd099ad56e4cb9d3f4bc706959c1de187f5c572e35.
No retry, engine change, manifest edit or next launch occurred.

| Prerequisite | State | Measured evidence |
| --- | --- | --- |
| P0 seal | met | 755 directory passes, 10,696 file passes, four losses, one preflight, one seal in the sealed run |
| Original candidate | met | 53 PSTs, 23 eligible; original object/digest and 56,140,800 bytes unchanged |
| Nine source identities | met | Object, source digest and input bytes match archive metadata for all nine manifests |
| Existing transformation state | met | Seven immutable seals; five accepted, families 5 and 7 failed; ordinal 8/9 absent |
| Frozen engines | met | pffexport 20260917, bubblewrap 0.13.0, OpenJDK 27 dated 2026-09-15; Java real path and Tika digest unchanged |
| Frozen script/membership | met | Digests unchanged, recorded below |
| Runtime policy | met | All seven started policies match their prior handoffs; no new runtime policy |
| Code identity | not met | Current restoration source differs from all nine manifests' code head after the earlier publication integration |
| Capacity | met | 407,414,800,384 free bytes, above 100,000,000,000 floor at inspection |
| Renewed smokes/focused proof | not run | Held before admitted execution on the code-freeze mismatch |
| Packet baseline | met | Adoption zero conflicts; doctor zero blockers, same three unrelated advisories; index matches |

Launcher SHA-256:
5b1d87cb5c420a53e56340bbc092c21826666c9e25ef210a421b8e20955e65e6.
Membership SHA-256:
00c2bf191c03874664b6167b614b6dfeb1dddac27fadc0407d673eb35b8bd3b2.
Tika SHA-256:
0e8ee9795ac4244feab466f4a5a9c3b94675af392848243842cb6e1e69d27103.
Governing code head for all nine manifests:
6eb3d036771e868768846b3c56a5aafac69c3b2b.

The source delta is #1636's inherited Array.every substitutions in signature
detection, imported by the previous stop-publication main merge. Libpff
source matches the frozen head; restoration source does not. No behavioral
defect is claimed, but the frozen script executes this checkout, so a new
launch cannot be described as executing the recorded source identity.
Decision: hold ordinal 8 pending orchestrator reconciliation of continuation
and code freeze. Reversal: revert documentation while retaining every corpus
artifact and immutable manifest. Never rewrite the old freeze records.

PR #1683 remains open at published head
258042e16e61139c504801b4f3e087f2d534ebeb at inspection; the orchestrator
owns its gate. Do not move that head during gate handling. Existing sealed
failure evidence is published there; this continuation blocker is committed
locally for handoff. No new PR, push, main merge or worker-owned gate.
Source/package proof is not applicable to this docs-only stop.
Graft saved approximately 53,475 tokens in one retrieval.


## Continuation code-freeze hold final report

lane: corpus-restore
head: 17f42f572f4563289e07dc9d0affd9f6aa875e76 (local committed continuation-blocker evidence; not pushed)
PR(s): #1683 OPEN, ready, published head 258042e16e61139c504801b4f3e087f2d534ebeb; orchestrator owns its gate | PR7 none (wave incomplete)
package-verify: not run (docs-only: no package source edited; no engine or launcher change)
hosted-parity: test-tsgo not run (docs-only: no package source changed) | docgen local not run (docs-only: no package source changed) | jsdoc-ratchet not run (docs-only: no package source changed) | knowledge refs pass through beep-heavy at pre-commit head 258042e16e61139c504801b4f3e087f2d534ebeb, zero live gated observations | fallow audit+health not run (docs-only: no package source changed) | scoped coverage not run (docs-only: no package source changed)
handoff: goals/oppold-corpus-salvage-restoration/history/handoffs/corpus-restore-2026-10-13.md
open items: The 05:55Z ruling authorizes continuation at ordinal 8, with families 5 and 7 retained as sealed failures. Renewed inspection found a separate code-freeze blocker: the previous stop-publication merge imported #1636's Array.every substitutions in RestorationTransformations signature detection. All nine immutable manifests name codeHead 6eb3d036771e868768846b3c56a5aafac69c3b2b, while the unchanged frozen launcher executes the current checkout. Restoration source differs from that recorded head; libpff source matches. No behavioral defect is claimed, but matching source identity cannot be asserted. Decision: hold ordinal 8 pending orchestrator reconciliation of continuation and code freeze; reversal is reverting the documentation decision while retaining every ledger, output, claim and immutable manifest. No source restoration, manifest rewrite, launcher change, new family launch or sealed-family retry.
Seven families remain sealed: five accepted (1-4 and 6), families 5 and 7 failed. All seven result stamps, ledger hashes and runtime policies match the prior handoffs. Family 7 result 1, expected/terminal one, unapproved one; ledger SHA-256 fca75d67a121ef972f807acd099ad56e4cb9d3f4bc706959c1de187f5c572e35. Ordinals 8 and 9 have no run root, started stamp or result; no family unit is active. P0 seal counts, original candidate, all nine source metadata identities, engine versions, Tika digest, launcher digest and membership digest match. Free bytes at inspection: 407,414,800,384, above the 100 GB floor. Renewed admitted smokes, focused proof and sixty-second launch interval were not run because the code-freeze check failed first. Packet adoption has zero conflicts; doctor has zero blockers and the same three unrelated advisories; index, launcher size, manifest JSON, whitespace, added-line hygiene, gitleaks, typos and commitlint pass. Knowledge refs passed under beep-heavy. SPEC decision, friction receipt, prerequisite table and preserved prior final-report append are committed locally. Existing failure evidence is already published in #1683; its gate-owned head was not moved. No push, main merge, new PR or worker-owned unit/gate. Session ledger records blocked handoff. This exact-head final report is appended locally for the next evidence commit. Separate post-wave recovery of families 5 and 7, eighteen larger occurrences and estate/recycle/DOC obligations remain open; P2 stays in-progress. Graft saved approximately 53,475 tokens in one retrieval.
blocked: frozen execution-code identity differs after publication integration; ordinal 8 unstarted, orchestrator reconciliation required


### 2026-10-14: ordinals 8–9 freeze amendment under the 06:25Z fallback

The orchestrator explicitly permits a freeze amendment when the unchanged
launcher cannot execute from another worktree. Inspection proves that it
unconditionally changes directory to the corpus-restore lane before invoking
bun. Starting that launcher from an execution-only worktree would therefore
still execute this lane. Altering the launcher or shadowing command resolution
would change its frozen identity. No execution-only worktree was created.

Decision: use the ruling's fallback for unstarted ordinals 8 and 9 in this
lane, before either family-run-start. Original code head remains
6eb3d036771e868768846b3c56a5aafac69c3b2b in every immutable manifest.
Amended execution source is the restoration source at 17f42f572f4563289e07dc9d0affd9f6aa875e76.
Attached identity delta: history/evidence/p2-first-wave-2026-10-14-freeze-amendment.patch
(SHA-256 dfc0f6c519ad5c2f2dfb477032fdedee77e8e42aecc83878d76b8b0ef4a26bf2). It contains two inherited
#1636 native-array-to-Effect-Array.every substitutions, in signatureExtension
and isCompoundFileBinary. Restoration command, schemas and base writer source
are unchanged; libpff source is unchanged. No behavior equivalence is claimed.
This amendment governs only the two unstarted families; all earlier seals
retain their actual execution identities. The execution commit will be recorded
in the handoff immediately before launch, with this source delta unchanged.

The launcher, nine manifests, engine versions, membership, policy identities
and ceilings remain unchanged: ratio 4, attempt 7,200,000 ms, family
43,200,000 ms, output 2,147,483,648 bytes, 100,000,000,000-byte floor.
Five families are accepted; families 5 and 7 remain sealed failures.
Separate post-wave recovery covers their parser and elapsed-budget classes;
no sealed family is retried. Reversal: revert this documentation amendment
before launch; after launch retain all ledgers, claims, output and manifests
and revert only the documentation decision. No source or launcher edit.


## 2026-10-14 ordinal 8 renewed admitted preflight

| Prerequisite | State | Measured evidence |
| --- | --- | --- |
| P0 seal | met | 755 directory passes, 10,696 file passes, four inherited losses, one preflight and one seal; original sealed run unchanged |
| Original candidate | met | 53 PSTs, 23 eligible; 56,140,800 bytes, original object/digest unchanged |
| Nine source identities | met | All nine object, digest and size values match archive metadata |
| Existing state | met | Seven seals and result stamps unchanged: five accepted, two failed; 8/9 unstarted; no active family unit |
| Frozen engines | met | pffexport 20260917; bubblewrap 0.13.0; OpenJDK 27 dated 2026-09-15, Java real path unchanged; Tika 3.3.1 digest unchanged |
| Script/membership | met | All nine manifests match script and membership digests |
| Policies/ledger hashes | met | All seven runtime policies match; all seven ledger digests occur unchanged in previous handoffs |
| Code identity | amended | Two inherited predicate substitutions; 06:25Z explicit fallback recorded before launch, immutable manifests retained |
| Capacity | met | 407,776,911,360 free bytes measured before admitted preflight, above 100 GB floor |
| Admitted smokes/focused proof | met | Both real sandbox smokes pass; four tests pass, 81 skipped, 5.53 seconds through beep-heavy |
| Packet baseline | met | Adoption zero conflicts; doctor zero blocking findings and same three unrelated advisories |

PR #1683 confirmed MERGED, published head
258042e16e61139c504801b4f3e087f2d534ebeb. No main integration
is needed before this launch; merge main once before terminal PR7 publication
and preserve actual execution identity. Prior uncommitted final report kept.
No package source edited; no new package verification required. Graft saved
approximately 24,520 tokens in one retrieval. All previous sealed families
and the immutable launcher remain untouched. The full sixty-second interval
starts after this admitted preflight before renewed capacity/state check.


## 2026-10-14 ordinal 8 launch under the authorized freeze amendment

Unit beep-heavy-corpus-restore-p2-2026-10-13-8.service is active.
Started stamp: 2026-10-14T06:26:25.702Z; observed active at 06:26:37Z.
Execution head: ce71e3cb88971dc0d2cfe9f7b0fd829164d859ac.
Final capacity before submission: 407,447,691,264 free bytes.
Renewed code delta equals the committed amendment patch; launcher digest
is unchanged. Full sixty-second interval completed before final state checks.
One wave unit only; ordinal 8 was absent before submission, ordinal 9 unstarted.
Result stamp is absent at observation; private log has one line. Archive
re-verification is underway; no family-run-start policy or outcome is claimed.

Ledger relative to corpus home:
`staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-08/ledgers/mail/slice.jsonl`.
Freeze record: history/evidence/p2-first-wave-2026-10-13-family-08-run-manifest.json,
with the separate 2026-10-14 pre-launch amendment governing execution code.
Object: 306991c7dc9caabb34f1e1c6149caf9964f2d9fe046682e753f65ea7efccc932.
Source: ae4087e97704630b08c37eaa19e6d524bf2b60f8deca36eab78c336784ca4002.
Input: 436,306,944 bytes. Policy expected:
4bf79324137791479436f68ff24c00d495887fbb308ae671cc9e3b0988c97763.
No policy hash or immutable manifest was edited. No source, engine or launcher
change. No sealed-family retry, output mutation, PR push or main merge.

The standing Runs 12+/13+ driver handoff supersedes the original mechanics'
wait-until-inactive instruction: hand off after this one detached launch;
the driver relaunches after this exact unit ends. Next worker reads ordinal
8's result and aggregate ledger, reconciles seal/children/repair pairs,
identities and ceilings, and records its digest. Stop and diagnose another
sealed failure; never retry it. On PASS, renew admitted preflight, preserve
the same amendment/code identity, wait sixty seconds, and launch ordinal 9
once. Before terminal PR7 publication integrate main as ruled, recording
actual execution identities. No PR merge by this worker.

Knowledge refs passed through beep-heavy at pre-amendment head 17f42f572f
with zero live gated observations. Index, launcher size, manifest JSON,
whitespace and added-line hygiene passed. Commit hooks: gitleaks, typos and
commitlint pass. No package edited; package-verify and source hosted-parity
lanes are not run (docs-only). Seven of nine sealed: five accepted, families
5 and 7 failed. Their separate post-wave recovery, eighteen larger inputs
and estate/recycle/DOC obligations remain open. P2 stays in-progress.


## Ordinal 8 amended-freeze launch final report

lane: corpus-restore
head: 89c7374764e204f3d83c74356bb146c73c3493db (local committed amendment and ordinal-8 launch evidence; not pushed)
PR(s): #1683 MERGED | #1646 MERGED | PR7 none (wave incomplete)
package-verify: not run (docs-only: no package source edited). Renewed admitted proof: both real sandbox engine smokes pass; four focused restoration tests pass, 81 skipped, 5.53 seconds.
hosted-parity: test-tsgo not run (docs-only: no package source changed) | docgen local not run (docs-only: no package source changed) | jsdoc-ratchet not run (docs-only: no package source changed) | knowledge refs pass through beep-heavy at 17f42f572f4563289e07dc9d0affd9f6aa875e76, zero live gated observations | fallow audit+health not run (docs-only: no package source changed) | scoped coverage not run (docs-only: no package source changed)
handoff: goals/oppold-corpus-salvage-restoration/history/handoffs/corpus-restore-2026-10-13.md
open items: Ordinal 8 is active in beep-heavy-corpus-restore-p2-2026-10-13-8.service; started 2026-10-14T06:26:25.702Z, result stamp absent at observation. Ledger relative to corpus home: staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-08/ledgers/mail/slice.jsonl. No acceptance or new runtime-policy identity is claimed. Seven of nine families are sealed: five accepted (1-4 and 6), families 5 and 7 failed; ordinal 9 unstarted. All seven result stamps, ledger hashes and runtime policies match prior handoffs. All nine source identities, engine versions, launcher and membership digests match their immutable manifests. P0 seal and original candidate metadata unchanged. Final capacity before submission: 407,447,691,264 bytes; full sixty-second interval completed, no other wave family unit running.
The 06:25Z ruling's explicit fallback applies: the unchanged launcher hardcodes its working directory to this lane, so starting it from a separate frozen worktree would still execute this lane. No execution-only worktree was created. A pre-launch freeze amendment, source-delta patch, SPEC decision and friction receipt were committed at ce71e3cb88971dc0d2cfe9f7b0fd829164d859ac before ordinal 8 started; that is its execution head. Original manifest codeHead remains 6eb3d036771e868768846b3c56a5aafac69c3b2b. The attached patch SHA-256 is dfc0f6c519ad5c2f2dfb477032fdedee77e8e42aecc83878d76b8b0ef4a26bf2 and records the two inherited #1636 Array.every substitutions in RestorationTransformations; libpff source, restoration command, schemas and base writer source are unchanged. No behavior equivalence is claimed. Launcher and all nine manifests were preserved; no source/engine edit, sealed-family retry or corpus artifact mutation. Reversal: revert the documentation decision while retaining every ledger, output, claim and immutable manifest after launch.
The standing one-family-per-run ruling governs this mid-wave handoff: driver waits for this exact unit to end, then relaunches the lane to reconcile ordinal 8's result, seal, children, repair pairs, identities, ceilings and ledger digest. On PASS, renew admitted preflight, retain amended source identity and the same launcher, wait sixty seconds and submit ordinal 9 once. On another sealed failure, diagnose and stop without retry. Family-5 parser failure and family-7 elapsed-budget recovery remain separate post-wave engine work with fixtures and new freeze records; eighteen larger occurrences and estate/recycle/DOC obligations remain open. P2 stays in-progress. Merge origin/main once before terminal PR7 publication as ruled, preserving actual execution identities; never merge a PR from this worker. No push, new PR or worker-owned gate this run. Adoption zero conflicts; doctor zero blockers and same three unrelated advisories; index, launcher size, manifest JSON, whitespace, added-line hygiene, gitleaks, typos and commitlint pass. Session ledger records blocked driver handoff. Exact-head final report appended locally for the next evidence commit. Graft saved approximately 24,520 tokens in one retrieval.
blocked: wave running — 7 of 9 sealed, unit beep-heavy-corpus-restore-p2-2026-10-13-8.service


## 2026-10-14 ordinal 8 sealed-failure reconciliation


Eight of nine families are sealed: five accepted (1-4 and 6), three failed
(5, 7 and 8). Ordinal 9 is unstarted. No wave family unit is active.
The standing continuation ruling requires diagnosis and a stop at this
further sealed failure. No retry, next launch or engine change occurred.

Unit: beep-heavy-corpus-restore-p2-2026-10-13-8.service.
Ledger relative to corpus home:
`staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-08/ledgers/mail/slice.jsonl`.
Freeze record: history/evidence/p2-first-wave-2026-10-13-family-08-run-manifest.json,
with the pre-launch 2026-10-14 freeze amendment governing execution source.
Execution head: ce71e3cb88971dc0d2cfe9f7b0fd829164d859ac.
Original manifest codeHead: 6eb3d036771e868768846b3c56a5aafac69c3b2b.
The unchanged launcher hardcodes this lane; the 06:25Z ruling's explicit
fallback was recorded before family start. No execution-only worktree was
created; no behavior equivalence between the two source identities is claimed.

Attempt: mail:f552929b9351c5fa39de3f83:r0.
Object: 306991c7dc9caabb34f1e1c6149caf9964f2d9fe046682e753f65ea7efccc932.
Source: ae4087e97704630b08c37eaa19e6d524bf2b60f8deca36eab78c336784ca4002.
Runtime/frozen policy: 4bf79324137791479436f68ff24c00d495887fbb308ae671cc9e3b0988c97763.
Ledger: 93e49e56ba8c4941ebaf4e33fd227340d5a31e3a8baa31b95cb2a7b8d9b1d60d.
Retained-attempt digest: 9cbc280c20f2f44df7e324bf238c3de1f7d43580f40344d830a4e4aa105c5eee.
Family-output digest: 7f0daad567fe8d6f1989f24b2cd02b506dc2043f07ccccccc205ed7aa795fc02.
Both output digests and retained bytes were independently rehashed under
beep-heavy and match their ledger rows. All seven earlier ledger hashes,
result stamps and policies remain unchanged.

Result 1. One each family-run-start, family-attempt-start, mail-store-exception,
family-run-summary and family-acceptance-failure; 204 attachment-type-repair
rows. Expected/terminal one, unapproved one, engine-failure approved false.
Zero store passes, child passes, warnings or interruptions. Partial
processing recorded 109 repaired occurrences / 95 distinct digests,
95 unsupported and zero unchanged. Retained output has 10,460 files,
96 repair copies and 95 Tika files. One unmatched PDF copy, zero unmatched
Tika files. No accepted child reconciliation, repair-pair acceptance or
atomic promotion is claimed.

Input 436,306,944 bytes; retained output 1,037,230,305 bytes,
amplification 2.377294974x. Output fits the 1,745,227,776-byte attempt cap
and 2,147,483,648-byte family cap. Family elapsed 2,996,198 ms is below
both 7,200,000-ms attempt and 43,200,000-ms family ceilings. There is no
terminal attempt-duration field because no store pass was written.
Started 2026-10-14T06:26:25.702Z; family start 06:31:22.819Z;
attempt-start row 06:31:22.853Z; failure seal 07:21:19.021Z.
Archive re-verification: 297,117 ms. The previous handoff records the
submission and observed start but no precise queue duration; it is unknown.
Pre-launch capacity 407,447,691,264 bytes; diagnosis capacity
407,991,721,984 bytes. Both exceed the 100,000,000,000-byte floor.

## Read-only diagnosis

The unmatched repair copy is a 196,192-byte PDF-signature object,
SHA-256 1721461f4c8438d79a3e5afad902fa7b58cd72d558dbfb2ac7469b095b982a6c.
It was modified at 2026-10-14T07:21:10.246504Z, shortly before the seal.
An admitted read-only bwrap reproduction of the exact extension-less frozen
Java/Tika second pass gives exit 1, zero stdout characters, zero stdout bytes
and zero non-whitespace bytes. Stderr held only in disposable RAM has
25 lines, one TikaException and two IOException matches; EOFException,
IllegalArgumentException, UnsupportedFormatException and NoClassDefFoundError
matches are zero. The sandbox itself exits zero. No private lines or corpus
content were printed. No corpus artifact was modified.

Attribution: input-sensitive failure at the frozen Tika/parser boundary.
This localizes the stop to second-pass attachment extraction. It does not
prove input corruption or distinguish a malformed input from a parser defect.
The original cause was replaced by pstFailureTerminal's generic terminal
reason; the reproduction supports the diagnosis without recovering that cause.
This is not an observed elapsed/output ceiling breach, interruption or
policy drift. The recorded engines, launcher and membership still match.

Private live log: four lines, 992 bytes. Journal: killed zero,
oom-kill/signal failure zero, code=exited one, four lines. Unit inactive.
Only counts were read from private logs and journal. No family was retried.

## Stop decision and reversal

Stop before ordinal 9 and publish this evidence with P2 in-progress.
P0/P1/P4 remain complete, P3 pending and lifecycle active. The previously
ruled separate recovery of families 5 and 7 remains open; family 8 adds a
PDF second-pass failure requiring its own recovery scope and freeze record.
The eighteen larger occurrences and estate/recycle/DOC gates remain open.
The orchestrator decides further continuation or recovery. No exception
class is approved by this report. Reversal: revert packet decisions while
retaining every ledger, output, claim and immutable freeze record.

| Prerequisite | State | Measured evidence |
| --- | --- | --- |
| P0 seal | met | 755 directory passes, 10,696 file passes, four losses, one preflight and one seal; P0 complete |
| Original candidate | met | 53 PSTs, 23 eligible; original object/digest and 56,140,800 bytes unchanged |
| Nine source identities | met | All nine object/digest/input-byte values match archive metadata |
| Existing state | not met for continuation | Eight seals, five accepted and three failed; ordinal 9 absent |
| Frozen engines | met | pffexport 20260917, bubblewrap 0.13.0, OpenJDK 27 dated 2026-09-15; Java real path and Tika digest unchanged |
| Script/membership | met | All nine manifests match script and membership digests |
| Policies/ledger hashes | met | All eight policies match; seven prior ledger digests unchanged; ordinal 8 digest recorded above |
| Execution code | amended | Ordinal 8 ran at the recorded pre-launch amendment head; source diff from that head remains empty before publication integration |
| Capacity | met | 407,991,721,984 free bytes at diagnosis, above 100 GB floor |
| Renewed launch smokes/proof | not run | No next launch after sealed failure; prior admitted ordinal-8 proof retained as historical evidence |
| Packet baseline | met | Adoption zero conflicts; doctor zero blockers and same three unrelated advisories; index matches |

Launcher SHA-256:
5b1d87cb5c420a53e56340bbc092c21826666c9e25ef210a421b8e20955e65e6.
Membership SHA-256:
00c2bf191c03874664b6167b614b6dfeb1dddac27fadc0407d673eb35b8bd3b2.
Tika SHA-256:
0e8ee9795ac4244feab466f4a5a9c3b94675af392848243842cb6e1e69d27103.
No package source changed. Source hosted-parity lanes and package-verify
are not run for this docs-only evidence. The reproduction and independent
tree rehash completed under beep-heavy. Graft saved approximately 101,934
tokens across two retrievals. Preserve the previous uncommitted launch-report
append. PR #1683 is confirmed merged; main integration and evidence
publication follow while all corpus artifacts remain immutable.


### Family-8 stop publication integration and local proof

Merged main at 96f1f5087beb2b937c640843d502ada843b82958 after all family
units ended. Four packet conflicts resolved to this branch's newer PLAN,
README, handoff and manifest as the 05:55Z continuation ruling directs.
All dated prior decisions, launch reports and failure evidence retained.
Execution identity remains the pre-launch ce71e3cb88 amendment; publication
integration does not alter that historical claim. No further family launch.
Knowledge refs passed under beep-heavy at 89c7374764e204f3d83c74356bb146c73c3493db,
zero live gated observations. Launcher 3,484 characters; manifest JSON,
index, reflection-artifacts, whitespace and added-line hygiene pass.
Doctor unchanged: zero blockers, three unrelated advisories. Gitleaks,
typos, Biome and commitlint passed the stop-evidence commit a124c9d420.
No package edited; package-verify and source hosted-parity not run (docs-only).


## Family-8 sealed-failure publication final report

lane: corpus-restore
head: 62c3d311bde9be5097b53438064e25be15a40146 (exact published stop-evidence head)
PR(s): #1696 OPEN, ready for review | #1683 MERGED | #1646 MERGED
package-verify: not run (docs-only: no package source edited)
hosted-parity: test-tsgo not run (docs-only: no package source changed) | docgen local not run (docs-only: no package source changed) | jsdoc-ratchet dedicated lane not run (docs-only); committed publication gate pass | knowledge refs pass at 89c7374764e204f3d83c74356bb146c73c3493db, zero live gated observations | fallow audit+health pass in exact-head publication gates | scoped coverage not run (docs-only: no package source changed)
handoff: goals/oppold-corpus-salvage-restoration/history/handoffs/corpus-restore-2026-10-13.md
open items: Family 8 sealed failure, result 1, one unapproved engine-failure; ordinal 9 remains unstarted. Eight of nine sealed: five accepted (1-4 and 6), three failed (5/7/8). Unit beep-heavy-corpus-restore-p2-2026-10-13-8.service is inactive. Input 436,306,944 bytes; retained output 1,037,230,305 bytes (2.377294974x); family elapsed 2,996,198 ms, within retained ceilings. Zero store passes, child passes, warnings or interruptions. Partial dispositions: 109 repaired occurrences / 95 distinct digests, 95 unsupported, zero unchanged; 96 copies and 95 Tika files, one unmatched PDF copy. Child reconciliation and repair-pair acceptance are unproven.
The unmatched 196,192-byte PDF repair copy reproduces the frozen extension-less Tika second pass at exit 1 with empty stdout, one TikaException and two IOException matches. Attribution is input-sensitive parser failure; input corruption and precise original cause remain unproven. Diagnosis ran read-only under beep-heavy with counts only. Ledger SHA-256 93e49e56ba8c4941ebaf4e33fd227340d5a31e3a8baa31b95cb2a7b8d9b1d60d; retained-attempt and family-output digests independently rehash to their ledger values. All seven earlier ledgers, all eight runtime policies, all nine source metadata identities, engine versions, launcher and membership digests match their recorded evidence. Capacity at diagnosis 407,991,721,984 bytes; pre-launch 407,447,691,264 bytes. No corpus artifact, manifest, engine or launcher was changed, and no sealed family was retried.
Ordinal 8 executed at ce71e3cb88971dc0d2cfe9f7b0fd829164d859ac under the separately committed pre-launch 06:25Z fallback amendment. The immutable manifests retain original codeHead 6eb3d036771e868768846b3c56a5aafac69c3b2b. The launcher hardcodes this lane, so no execution-only worktree was created. No source equivalence is claimed. Main 96f1f5087beb2b937c640843d502ada843b82958 was integrated after the unit ended; four packet conflicts kept this branch's newer records as ruled. Publication does not change the execution identity.
Decision: stop, retain all evidence and publish the family-8 record; reversal is reverting packet decisions while retaining every ledger, output, claim and immutable manifest. P2 stays in-progress, P0/P1/P4 complete, P3 pending. The orchestrator owns ordinal-9 continuation and family-8 recovery scope; separately ruled family-5/7 recovery, eighteen larger occurrences and estate/recycle/DOC gates remain open.
All sixteen exact-head publication gates and the frozen head-install preflight passed; one push created #1696. Lane install passed after the merged lockfile changed. Packet doctor has zero blockers and the same three unrelated advisories; index, reflection-artifacts, launcher size, manifest JSON, whitespace and public-evidence hygiene pass. Explicit PR-ready operation succeeded after GraphQL budget reset; complete thread read has zero threads and REST confirms ready at the exact head. Hosted CI/review window and merge readiness are not claimed; no PR merge. The worker-owned readiness monitor was cancelled, confirmed terminated and its proof-job inbox row acknowledged. No worker-owned unit or gate remains running. Final report and the resolved GraphQL-discovery receipt are appended locally for the next evidence commit. Graft saved approximately 101,934 tokens across two retrievals.
blocked: family 8 sealed failure — input-sensitive PDF second-pass parser failure; ordinal 9 unstarted


## 2026-10-14 ordinal 9 authorized continuation preflight

The 08:35:38Z orchestrator ruling supersedes the family-8 stop: launch
ordinal 9 once, under the same committed 06:25Z fallback amendment.
PR #1696 is confirmed MERGED at its reported head. Keep its published head
unchanged; launch evidence is local and the ninth seal gets a separate PR.
No wave unit is active. Eight prior result stamps, seals, policies and
ledger hashes match this handoff: five accepted, families 5/7/8 failed.
Ordinal 9 has no run directory, started stamp or result stamp.

| Prerequisite | State | Measured evidence |
| --- | --- | --- |
| P0 | met | Seal unchanged; 755 directories, 10,696 files, four losses, one preflight, one seal; P0 complete |
| Original candidate | met | 53 PSTs, 23 eligible, original 56,140,800-byte identity unchanged |
| Nine source identities | met | All nine object/digest/size values match sealed archive metadata |
| Prior seals | met | Eight ledger hashes and runtime policies match prior records; no retry |
| Ordinal 9 | met | Unstarted; input 456,877,056 bytes, expected stores one |
| Frozen engines | met | pffexport 20260917; bubblewrap 0.13.0; OpenJDK 27 dated 2026-09-15; Java real path and Tika digest unchanged |
| Script/membership | met | All nine manifests match the unchanged script and membership digests |
| Execution source | amended | Empty restoration/libpff source diff from ce71e3cb88 at preflight head 62c3d311bd |
| Capacity | met | 404,017,901,568 free bytes at initial renewed preflight; 100 GB floor |
| Admitted smokes | met | Tika 3.3.1 and pffexport sandbox smokes pass under beep-heavy |
| Focused proof | met | Four restoration tests pass, 81 skipped, 5.13 seconds under beep-heavy |
| Packet baseline | met | Adoption zero conflicts; doctor zero blockers and same three unrelated advisories |

Ordinal-9 objectId:
90fe1bba1664bb79ffe5b6bdca9b720f27ec1e001314cf8788cef57282a2f3f1.
Source SHA-256:
efa55f979cbcd6ca4f7e58880abce689645daba36a9058e2d36ba71f077a12bb.
Frozen policy SHA-256:
8e31b6b8b054267e41cbe4db098e5a201308accd882bdea2e8f3b91ba580f2ec.
Launcher SHA-256:
5b1d87cb5c420a53e56340bbc092c21826666c9e25ef210a421b8e20955e65e6.
Membership SHA-256:
00c2bf191c03874664b6167b614b6dfeb1dddac27fadc0407d673eb35b8bd3b2.
Freeze record: history/evidence/p2-first-wave-2026-10-13-family-09-run-manifest.json.
Retained ceilings: ratio four; attempt 7,200,000 ms; family 43,200,000 ms;
output 2,147,483,648 bytes; attempt output 1,827,508,224 bytes.
Original codeHead remains 6eb3d036771e868768846b3c56a5aafac69c3b2b.
No source equivalence is claimed. No execution-only worktree exists because
the unchanged launcher hardcodes this lane, as the committed amendment records.

After ordinal 9 seals, publish its aggregate wave record separately and
write one bounded recovery amendment covering 5/7/8, with explicit next
fallback engine identity and new freeze records. Recovery needs the
orchestrator's approved reply before launch. A repeated input-sensitive PDF
failure is dispositioned unsupported; no third attempt. Eighteen larger
occurrences and estate/recycle/DOC gates stay open for P3. Reversal: revert
packet decisions while retaining all corpus artifacts and immutable manifests.
No package source edited; package-verify and source hosted-parity not run
(docs-only). Preserve the prior uncommitted report and friction receipt.


Knowledge refs at e8c520d65ace9a554685c87e5f3840bef127826b exits one:
one live gated external-mirror-reference in the untouched shadcn skill's
Design System document (line 31, home-relative Desktop reference). Its file
matches origin/main; inherited, not an execution precondition failure.
No unrelated repair. Index, reflection-artifacts, launcher size, manifest
JSON and whitespace pass. No reference links recreated. The current
source still matches the pre-launch amendment; the documentation red does
not change engines, selection, policy or ceilings. Retain this proof result.


Attribution correction: the cached origin/main ref predates the integrated
#1685 skill commit. The affected file differs from that stale ref; it matches
integrated main commit 96f1f5087beb2b937c640843d502ada843b82958 exactly,
with no lane edit. The earlier statement that it matches origin/main is
withdrawn. Inherited provenance is #1685, verified by the empty diff from
that integrated main commit. No fix or base merge inside the frozen launch.


## Ordinal 9 launched under the standing continuation ruling

Submission 2026-10-14T08:42:20Z; started 08:42:20.121Z, approximately
121 ms after the recorded whole-second submission time. Exact queue
latency is not known at millisecond precision. Unit:
beep-heavy-corpus-restore-p2-2026-10-13-9.service, active/running with
MemoryMax 34,359,738,368 bytes. Result stamp absent; one private-log line
at observation. No private log or journal lines read. No other wave unit
active. Full sixty-second interval completed; capacity before submission
403,566,137,344 bytes. Execution head:
91256cfd1bf4fa7c428b9d568f7a5192c210dd9e. Its restoration/libpff source
matches the committed 06:25Z fallback amendment exactly. No engine,
launcher, membership, policy or immutable manifest changed. Original
manifest codeHead and amendment source identity remain distinct.

Ledger relative to corpus home:
`staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-09/ledgers/mail/slice.jsonl`.
Eight of nine sealed: five accepted, three failed. The ninth family is
running; no acceptance, child reconciliation or runtime-policy match is
claimed until its ledger is available. The standing one-family-per-run
ruling supersedes the original wait-until-inactive mechanics: driver waits
for this exact unit and relaunches this lane; no worker-owned gate started.

Next run: read ordinal 9's result stamp and ledger through aggregate-only
projections; reconcile identity, policy, seal, child and repair digest pairs,
ceilings, byte/time amplification and ledger digest. Diagnose any further
failure before other work; never retry a sealed family. Publish its own
record PR after integrating main while no family is active; do not re-push
merged #1696. Then write one bounded recovery amendment for 5/7/8 naming
the recorded next fallback engine and new freeze records; commit it and
wait for the orchestrator's approved reply before recovery launch. If an
occurrence still fails on the input-sensitive PDF second pass, disposition
unsupported with retained evidence and no third attempt. Eighteen larger
occurrences and estate/recycle/DOC gates remain open for P3.

No package edited. Package-verify and source hosted-parity lanes not run
(docs-only). Both admitted smokes and four focused tests passed. Doctor
has zero blockers and same three unrelated advisories; index, manifest,
launcher size, reflection-artifacts, whitespace and commit hooks pass.
Knowledge refs failed with one inherited live gated observation from #1685,
attributed against integrated main with the cached-ref correction above.
Graft saved approximately 77,830 tokens across two retrievals.


## Ordinal-9 continuation final report

lane: corpus-restore
head: c597939c6e0e81dd144a57b094c2e351e96b383a (committed ordinal-9 launch evidence; local, not pushed)
PR(s): #1696 MERGED | #1683 MERGED | #1646 MERGED | ordinal-9 record PR none (family running)
package-verify: not run (docs-only: no package source edited). Renewed admitted proof: both real sandbox engine smokes pass; four focused restoration tests pass, 81 skipped, 5.13 seconds.
hosted-parity: test-tsgo not run (docs-only: no package source changed) | docgen local not run (docs-only: no package source changed) | jsdoc-ratchet not run (docs-only: no package source changed) | knowledge refs fail at e8c520d65ace9a554685c87e5f3840bef127826b, one inherited external-mirror-reference from #1685, attributed against integrated main 96f1f5087b | fallow audit+health not run (docs-only: no package source changed) | scoped coverage not run (docs-only: no package source changed)
handoff: goals/oppold-corpus-salvage-restoration/history/handoffs/corpus-restore-2026-10-13.md
open items: Ordinal 9 is active in beep-heavy-corpus-restore-p2-2026-10-13-9.service, started 2026-10-14T08:42:20.121Z; result stamp absent at observation. Eight of nine are sealed: five accepted (1-4 and 6), three sealed failures (5/7/8). All eight prior ledger hashes and policies, all nine archive metadata identities, engine versions, launcher and membership digests match their records. The full sixty-second interval completed; capacity before submission 403,566,137,344 bytes exceeds the 100 GB floor. No sealed family retried, corpus artifact mutated, engine/launcher/source changed, PR pushed or worker-owned gate started.
Ordinal 9 executed from 91256cfd1bf4fa7c428b9d568f7a5192c210dd9e with restoration/libpff source identical to the committed 06:25Z fallback amendment. Original manifest codeHead remains 6eb3d036771e868768846b3c56a5aafac69c3b2b; no behavior equivalence is claimed. The unchanged launcher hardcodes this lane, so no execution-only worktree was created. Runtime policy and acceptance are not claimed before the ninth ledger is available. Retained ceilings and the immutable manifest remain unchanged.
The driver waits for this exact unit to end and relaunches the lane to reconcile the ninth result, seal, identities, children/repair digest pairs, ceilings and ledger digest. Publish ordinal 9's own record PR after integrating main with no family active; do not re-push merged #1696. After the ninth seal, commit one bounded recovery amendment for failed engine occurrences 5/7/8 naming the next fallback engine in the recorded chain and new freeze records; the orchestrator must reply approved before recovery launch. A repeated input-sensitive PDF second-pass failure receives unsupported disposition with retained evidence and no third attempt. Eighteen larger occurrences and estate/recycle/DOC gates remain open for P3. P2 stays in-progress; P0/P1/P4 complete, P3 pending. Reversal: revert documentation decisions while retaining every ledger, output, claim and immutable manifest.
Packet doctor has zero blockers and the same three unrelated advisories; index, reflection-artifacts, launcher size, manifest JSON, whitespace and commit hooks pass. The inherited knowledge-reference red is documented with a correction distinguishing the stale cached origin/main ref from integrated main. The final report is appended locally for the next evidence commit. Session ledger records the driver handoff. Graft saved approximately 77,830 tokens across two retrievals.
blocked: wave running — 8 of 9 sealed, unit beep-heavy-corpus-restore-p2-2026-10-13-9.service


## Ordinal 9 sealed failure and terminal wave reconciliation


All nine bounded members have sealed. Accepted ordinals: 1, 2, 3, 4, 6.
Sealed failures: 5, 7, 8, 9. All family units are inactive. No sealed
family was retried, original mutated, or engine/launcher changed.
P2 stays in-progress; P0/P1/P4 complete, P3 pending, lifecycle active.

## Family 9 evidence and diagnosis

Unit: beep-heavy-corpus-restore-p2-2026-10-13-9.service. Result stamp: 1.
Ledger relative to corpus home:
`staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-09/ledgers/mail/slice.jsonl`.
Attempt: mail:cdbf9fe5be4cec603a24b02e:r0.
Object: 90fe1bba1664bb79ffe5b6bdca9b720f27ec1e001314cf8788cef57282a2f3f1.
Source: efa55f979cbcd6ca4f7e58880abce689645daba36a9058e2d36ba71f077a12bb.
Runtime/frozen policy: 8e31b6b8b054267e41cbe4db098e5a201308accd882bdea2e8f3b91ba580f2ec.
Ledger SHA-256: 87943da8d7c8b10283008000c1d99ca4a17e411a7824bec520f1f10adae5bc90.
Retained-attempt digest: 7eede173895745bd4cd82921fcf4bce4216570edcef0e3b4b7335a717e3f6cf6.
Family-output digest: fa478ee95807e14641d67da6d86ab3887ce601e75a60c14c2c928b5fddc7e59d.

One each family-run-start, family-attempt-start, mail-store-exception,
family-run-summary and family-acceptance-failure; 634 attachment-type-repair
rows. Expected/terminal one; unapproved one; engine-failure approved false.
Zero store passes, child rows, warnings or interruptions. Partial dispositions:
359 repaired occurrences / 320 distinct digests, 275 unsupported, zero unchanged.
Retained files: 14,767; repair copies: 321; Tika files: 320; one unmatched
PDF copy, zero unmatched Tika files. No accepted child reconciliation,
repair-pair acceptance or atomic promotion is claimed.

Input 456,877,056 bytes; output 1,177,728,174 bytes (2.577779205x).
Output fits attempt cap 1,827,508,224 and family cap 2,147,483,648 bytes.
Family elapsed 7,222,485 ms fits 43,200,000-ms family cap; it exceeds the
7,200,000-ms attempt ceiling. No store-pass attempt-duration field exists.
Started 2026-10-14T08:42:20.121Z; family start 08:46:59.320Z;
attempt-start row 08:46:59.338Z; failure seal 10:47:21.815Z.
Archive re-verification: 279,199 ms. Queue latency is only approximate,
121 ms from the whole-second submission record, not a precise measurement.
Pre-launch free bytes 403,566,137,344; diagnosis free bytes 392,097,185,792.

The unmatched PDF copy is 28,712 bytes with SHA-256
55cb9b03e5af4ebab39985b4d3217fa78fc8e659b267aecc1c55e3b480c5edf2.
Its modification time is 2026-10-14T10:47:10.161441Z, 7,210,823 ms after
the attempt-start row. extractAttachmentText checks remaining elapsed time
before starting Tika; a copy written after the attempt ceiling strongly
supports attachment-repair elapsed-budget exhaustion. The terminal catch
replaces the original cause with a generic engine-failure. Exact cause,
precise attempt clock and parser status remain unresolved. No parser
reproduction or exception approval is inferred from this timing.
Private log: four lines, 992 bytes. Journal killed/oom/signal matches zero;
code=exited one. Only counts were read. No retry or recovery was launched.

## Wave reconciliation

All nine runtime policies match immutable manifests; all nine source
object/digest/input-size values match sealed archive metadata. Current engine
versions, Java real path, Tika digest, launcher digest and membership digest
match all nine records. Eight prior ledger hashes match earlier handoffs.
Accepted-family child counts and engine counts reconcile, and repair-copy,
Tika and repaired-digest sets are identical for each accepted family. All
accepted store output/time ceilings hold. Accepted children total 19,438.
Wave input total 1,974,633,472 bytes; retained output total 4,974,218,513 bytes.
Failed-family partial repairs are not accepted children or successful repairs.

Family 5: input-sensitive GIF Tika parser failure, exact cause unresolved.
Family 7: attachment-repair elapsed-budget exhaustion, exact cause unresolved.
Family 8: input-sensitive PDF Tika parser failure, exact cause unresolved.
Family 9: timing supports attachment-repair elapsed-budget exhaustion,
exact cause unresolved. Each sealed failure remains unapproved and retained.

Execution identity: families 8–9 used the separately committed 06:25Z
fallback amendment because the unchanged launcher hardcodes this lane.
Ordinal 9 execution head was 91256cfd1bf4fa7c428b9d568f7a5192c210dd9e;
its restoration/libpff source diff from amendment head ce71e3cb88 is empty.
Original immutable codeHead remains 6eb3d036771e868768846b3c56a5aafac69c3b2b.
No equivalence to original source is claimed; no execution-only worktree exists.

## Decision and remaining scope

Stop on family 9's sealed failure and publish this separate terminal record.
Do not push to merged #1696. The 08:35:38Z ruling scopes one recovery
amendment to 5/7/8; it does not authorize family 9 recovery. Record that
additional failed occurrence for an explicit orchestrator scope decision.
The amendment must name the next fallback engine before approval and launch.
No such ordered restoration-engine chain is present in the packet, brief
or public restore-mail implementation. A model-provider fallback chain is
not an extraction-engine contract. Preserve this missing dependency rather
than invent an engine. Eighteen larger occurrences and estate/recycle/DOC
gates remain open for P3. Reversal: revert packet decisions while retaining
every ledger, output, claim and immutable manifest.


# Bounded recovery amendment for families 5, 7 and 8

Status: blocked on engine binding and orchestrator approval; no execution.
Scope: exactly failed engine occurrences of first-wave families 5, 7 and 8,
one fresh recovery family per occurrence, concurrency one. This amendment
follows the 2026-10-14T08:35:38Z ruling. All sealed first-wave families,
ledgers, outputs, claims and immutable manifests remain untouched.
Family 9 is outside this amendment and needs its own scope ruling.

## Execution contract required before approval

Retain ratio four, attempt 7,200,000 ms, family 43,200,000 ms, total output
2,147,483,648 bytes and 100 GB free-space floor. Renew admitted engine smokes
and focused tests; verify source metadata and actual engine identities;
commit complete new freeze records and the launcher digest before launch.
Use fresh run labels and append-only tool-owned ledgers. Never alter an
existing sealed family or count a partial derivation as accepted output.

The next extraction-engine identity is UNBOUND: the brief names a
"next fallback engine in the recorded chain" but the packet and public
restore-mail code contain no ordered second-pass extraction-engine chain.
The current second pass invokes Java/Tika only. The existing doc-text
package has PDF/DOCX extraction capability; its existence does not prove
it is the approved successor, supports the GIF case, or is wired into this
restoration ledger contract. No model-provider fallback is an extraction
engine. The orchestrator must identify the recorded chain or bind the
specific next engine and the implementation scope before this amendment
can be executable and receive the required approved reply.

An occurrence still failing on the input-sensitive PDF second pass after
its single recovery attempt is dispositioned unsupported with retained
evidence, never retried a third time. That disposition must be explicit
and supported by a schema/runner contract; no current sealed failure is
retroactively approved. Synthetic parser/elapsed-budget fixtures and all
existing real-engine acceptance laws remain required for any engine PR.
Package-verify and restoration proof precede a new frozen execution.

Reversal before launch: revert this amendment and close its unmerged PR.
After launch: revert documentation decisions while retaining every corpus
artifact and new freeze record. No engine change, new launcher, recovery
run or corpus mutation is authorized by this draft. Eighteen larger
occurrences and estate/recycle/DOC gates remain open for P3.


### Terminal-record integration and prerequisites

| Check | State | Measured evidence |
| --- | --- | --- |
| P0 seal | met | Expected current run; 755 directory passes, 10,696 file passes, four losses, one preflight, one seal |
| Nine source identities | met | All object/digest/input-size values match archive metadata |
| Ledger state | sealed failure | Nine sealed: accepted 1/2/3/4/6, failed 5/7/8/9; no active family |
| Frozen policies | met | Nine runtime hashes match immutable manifests |
| Frozen engine versions | met | pffexport 20260917, bubblewrap 0.13.0, Java 27 dated 2026-09-15; real path and Tika digest unchanged |
| Launcher/membership | met | Nine immutable manifests match current digests |
| Accepted children/repair pairs | met | 19,438 child rows; each accepted family's engine and derived identities reconcile |
| Code identity | amended | Ordinal 9 source matches pre-launch amendment; original codeHead retained, no equivalence claimed |
| Capacity | met | 392,097,185,792 bytes at diagnosis; above 100 GB floor |
| Renewed launch smokes/proof | not run | Wave ended; prior ordinal-9 admitted smokes/four tests retained as historical proof |
| Packet health | met | Pre-merge zero blockers/three unrelated advisories; merged main zero blockers/seven unrelated advisories |
| Independent retained-output rehash | pending | Submitted through beep-heavy; all five shared slots busy |
| Recovery engine binding | not met | No ordered extraction-engine chain found in packet or restore-mail |

Fresh branch feat/oppold-corpus-salvage-restoration-p2-terminal-followup
preserves the local launch/report commits after #1696 merged. Integrated
main aeb2a85cc5a2c37f3d1f87f43de0d027041062a1; four packet conflicts
kept this branch's newer state/history, with no prior decision removed.
Lane frozen-lockfile install passed after main's lockfile moved. Index,
reflection-artifacts, launcher size, manifest JSON and whitespace pass.
Commit hooks pass, with inherited main large-file/JSDoc warnings advisory.
No package edited; source hosted-parity lanes not run (docs-only).
The first merge subject used an unsupported commit type; commitlint refused
it before commit. Corrected to chore and committed without bypassing hooks.
Graft saved approximately 150,197 tokens across four retrievals.
Publication and independent rehash are queued under beep-heavy; admission
is never bypassed and no other lane's work is terminated.
