# P2 first bounded wave — active-family handoff

Run-10 go follows merged PR6 #1611 at 6eb3d03677. The lane starts from
main on the corrected first-wave branch, retaining the previous handoff.
Nine ordered occurrences match the sealed archive's object, source digest
and input-byte metadata. Range: 61,727,744 to 456,877,056 bytes.

Retained ceilings: ratio 4; attempt 7,200,000 ms; family 43,200,000 ms;
output 2,147,483,648 bytes per family; free-space floor 100,000,000,000 bytes.
All nine freeze records exist before the first launch. They pin code,
source, engine, membership, script and expected policy identities.
Membership digest:
00c2bf191c03874664b6167b614b6dfeb1dddac27fadc0407d673eb35b8bd3b2.
Launch-script digest:
5b1d87cb5c420a53e56340bbc092c21826666c9e25ef210a421b8e20955e65e6.

Both real sandbox smokes pass. Four focused restoration tests pass,
78 skipped, 14.93 seconds. Free bytes before launch: 236,375,658,496.
Both sealed P1 families and their ledger digests remain unchanged.
No P2 ledger existed before launch. No source or engine code changed.

Family 1: unit beep-heavy-corpus-restore-p2-2026-10-13-1.service.
Launch: 2026-10-13T19:07:52Z. Started: 2026-10-13T19:07:52.818Z.
Family start after verification: 2026-10-13T19:15:50.706Z.
Queue wait approximately 0.8 seconds; re-verification 477,888 ms.
Persisted policy matches the pre-launch freeze record:
fa0ce962b1da841d3000f7fa96419d285fe84c509e4553db86845db418803a4c.
Attempt: mail:223d8b5d95c014978c5ac714:r0.

| Surface | Location |
| --- | --- |
| Family 1 ledger, relative to corpus home | staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-01/ledgers/mail/slice.jsonl |
| Launch script | ~/.cache/beep/corpus-restore/p2-first-wave-2026-10-13.sh |
| Result stamp | ~/.cache/beep/corpus-restore/p2-first-wave-2026-10-13-1.result |
| Freeze records | history/evidence/p2-first-wave-2026-10-13-family-01-run-manifest.json through family-09-run-manifest.json |

At first transformation observation: 88 attachment dispositions, including
17 repaired and 71 unsupported. Zero warnings, exceptions or interruptions.
These are progress counts only: no store/child acceptance, ledger digest,
output amplification or terminal family outcome is claimed.

Zero of nine families sealed; only family 1 launched. The orchestrator may
re-arm the watcher under the explicit Run-10 mid-wave handoff ruling.
Read private logs only as counts; read the ledger through path/message-free
jq projections. Compare persisted policy to its manifest. After a successful
seal, reconcile every child, repair-copy/Tika pair and all ceilings, record
ledger digest and capacity, then wait 60 seconds before the next family.
Launch the same frozen script with the next ordinal; never launch a second
family while this unit runs. Stop at the first failure and diagnose; never
retry a sealed family. Before each next launch re-measure engine identity,
capacity and the main-code condition. No launcher or engine changes inside
the wave. PR7 follows the wave's terminal record; never merge.

P2 is in-progress and incomplete. Larger and stub-sized mail occurrences,
non-PST dispositions, recycle and legacy-Word gates remain open.
Reversal: revert packet decisions while retaining every run, ledger, output
and freeze record. The active family is handed over without cancellation.


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


### Run-12 continuation blocked before ordinal 3

Two families are accepted and reconciled; seven remain unstarted. Renewed
engine smokes and focused proof remained unadmitted for approximately twenty
minutes. Worker-owned queued commands were terminated without execution proof;
no outside job or admission policy changed. No family unit is active, and
ordinal 3 has no run directory or stamps. Resume renewed preflight through
beep-heavy, a full sixty-second interval and the same frozen script at ordinal 3.
P2 remains incomplete; retain all families and freeze records. This is an
admission blocker, not a failed or retried family.


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


## Standing continuation — family 4 accepted

Family 4 unit beep-heavy-corpus-restore-p2-2026-10-13-4.service ended with
result zero. Seal 2026-10-14T00:09:57.518Z: expected/terminal one,
unapproved zero. One store pass, zero warnings, exceptions or interruptions.
All 836 children reconcile: 796 engine, 20 repair-copy and 20 Tika children.
Both derived digest sets match the 20 distinct repaired digests. Dispositions:
23 repaired occurrences, 62 unsupported, zero unchanged; no other derivations.
Input 119,120,896 bytes; output/family disk usage 337,512,124 bytes;
amplification 2.833357835x. Attempt 4,789,718 ms; family 4,797,300 ms;
archive verification 311,220 ms; queue approximately 60,987 ms.
Ledger SHA-256:
c04d8248fe3b5d6ac17a3c7c43c06237d8ef1a5e4ec32ca6fe3f54f35fdf9870.
All ceilings and frozen identities hold; earlier ledger hashes unchanged.
Ledger relative to corpus home:
`staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-04/ledgers/mail/slice.jsonl`.
Renewed admitted direct Tika/pffexport sandbox smokes passed; four focused
tests passed, 78 skipped, 3.85 seconds. Four of nine accepted; ordinals 5-9
unstarted. Continue only after the full sixty-second interval and fresh
capacity/state checks. Retain all ledgers, outputs and immutable manifests.


### Ordinal 5 submitted after renewed preflight

Full sixty-second interval completed. Free bytes before submission:
422,327,496,704. Unit beep-heavy-corpus-restore-p2-2026-10-13-5.service
submitted 2026-10-14T00:14:38Z; started 2026-10-14T00:14:38.133Z.
Sole wave family unit active/running, result absent; frozen script unchanged.
Ledger relative to corpus home:
`staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-05/ledgers/mail/slice.jsonl`.
Frozen policy fd9019c7caf2b434c8a09d12196ca841b4802b7702181fb571d57c4f878ebbc6;
compare runtime value after family-run-start. Four of nine accepted; ordinals
6-9 unstarted. Watcher resumes after unit 5 ends; no worker wait on the family.
P2 remains incomplete. No source/engine/launcher change or PR publication.


## Terminal update 2026-10-14

The wave stopped at family 5's sealed unapproved engine-failure.
Four accepted, one failed and four unstarted. Earlier active-unit statements
above are historical. No wave unit remains active; do not launch ordinal 6
or retry family 5. P2 stays in-progress. The terminal record is
history/p2/2026-10-14-first-wave-stop.md, with aggregate diagnosis and retained
identities. All output, ledgers, claims and immutable manifests remain intact.


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
