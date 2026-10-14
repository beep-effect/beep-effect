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
