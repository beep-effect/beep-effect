# Fresh P1 mail slice acceptance — 2026-10-10

The run-4/5 authorized fresh family sealed successfully; this records its outcome
under run-6 authority. No corpus content, names, paths from ledger rows, or engine
messages are reproduced. The original sealed failure remains evidence.

## Frozen identity

- Source objectId:
  `da19981ddcd62e532156584b7d8ef06762122f1cffc3f032ac36436d5492fdae`.
- Source SHA-256:
  `d547453d9d9680d28c898892982e8b3798452fa9e608a40f860ef88cd152907d`.
- Code snapshot:
  `005d103faf8ab7c529cae8acece27bf93bc0ab95`; PR3 #1606 subsequently merged
  at `9e0711e4591b74825b56fab5c0ad13c3246c66d3`.
- Launch script SHA-256:
  `f49f831f309f4b625167b25c8c415cca7705e2364a934e6a2012daaa14dd5ca2`.
- Policy SHA-256:
  `2bc3fc673c343ef6008b9b3bb1c85e000ac59239d345f3e50d4d08aaf6a5a2c8`.
- Freeze record: `../evidence/p1-fresh-slice-run-manifest.json`.
  Its pending null policy hash was filled once from the first start row;
  no other frozen field changed.
- Unit `beep-heavy-corpus-restore-p1-2.service`, launch n=2, attempt
  `mail:011b25c2d38deca005ce17dd:r0`, retry ordinal zero. The earlier n=1
  belongs to the retained failed family, not an interruption of this family.
- Script result 0; unit inactive. Private log: two lines, one verification
  summary. No private log or journal lines were read into evidence.

## Terminal record inventory

| Record type | Count |
| --- | ---: |
| family-run-start | 1 |
| family-attempt-start | 1 |
| mail-store-pass | 1 |
| mail-child-pass | 3,339 |
| attachment-type-repair | 206 |
| family-run-summary | 1 |
| family-acceptance-pass | 1 |
| mail-store-exception | 0 |
| mail-warning | 0 |
| family-attempt-interrupted | 0 |
| family-acceptance-failure | 0 |

The final record is acceptance-pass, expectedCount = terminalCount = 1,
unapprovedCount = 0. Summary passCount = 1, exceptionCount = 0.
The store has warningCount = 0. No exception class was recorded.

## Child and repair reconciliation

| Measure | Count |
| --- | ---: |
| Engine-reported children / store childCount | 3,237 |
| All child rows / store accountedChildCount | 3,339 |
| Derived copy children | 51 |
| Derived Tika children | 51 |
| Other derived children | 0 |
| Repaired attachment occurrences | 59 |
| Distinct repaired SHA-256 values | 51 |
| Unsupported dispositions | 147 |
| Unchanged dispositions | 0 |
| Unaccounted children | 0 |

Duplicate attachment occurrences reuse first retained text for each digest.
All 59 repairs therefore have second-pass evidence represented by 51 unique
copy/text pairs. Unsupported and unchanged dispositions do not count as repairs.
A path-dropping jq predicate independently checked all step-7 exit equalities,
the final acceptance record, and every disk/time inequality; result true.

## Disk and time

| Measure | Observed | Frozen ceiling |
| --- | ---: | ---: |
| Input bytes | 56,140,800 | Selected source |
| Store output bytes | 132,668,272 | 224,563,200 |
| Family output disk usage, du bytes | 132,668,272 | 2,147,483,648 |
| Store and family disk amplification | 2.363134690x | 4x for the attempt |
| Attempt elapsed milliseconds | 809,685 | 7,200,000 |
| Family elapsed milliseconds | 822,686 | 43,200,000 |
| Attempt milliseconds per MiB | 15,122.981 | Informational |
| Archive re-verification milliseconds | 254,472 | Before family clock |
| Pre-launch free bytes | 432,775,737,344 | At least 100,000,000,000 |
| Post-run free bytes | 432,579,956,736 | Informational |

Script started 2026-10-10T03:54:04.229Z; first family row
2026-10-10T03:58:18.701Z; store pass 2026-10-10T04:12:00.846Z;
final acceptance 2026-10-10T04:12:01.390Z. A separate queue submission
timestamp was not retained, so no numeric queue duration is claimed.
Free-space change also includes concurrent machine activity.

Fresh ledger SHA-256:
`33ad3245d090f519b573769503ebb39162a8806864f664ab0817b705a72fccf5`.
Original sealed failure ledger SHA-256, remeasured unchanged:
`efb4b558c2d1680f87a684a69d6aa021653234d12928aa9f27a6943de8970e9f`.

## Proof and phase disposition

The four required restoration exception/accounting/resume tests pass freshly:
4 passed, 73 skipped, 2.53 seconds. The synthetic corrupt/password/codepage
classification evidence is named in SPEC's decision log. Both real sandbox
engine smokes pass; pffexport, bubblewrap, real Java and Tika jar values match
the fresh freeze record. Candidate and P0 seal remeasure unchanged.

P1 is complete. P0/P4 remain complete, P2/P3 remain pending, lifecycle active.
This PR changes packet documentation only; PR3's full package and hosted-parity
proof is retained in the handoff. P2 ceilings and expansion remain with the
orchestrator. Reverse the packet flips by reverting PR4; retain both immutable
families and freeze records. Whole-run removal remains the orchestrator's R7
authority, never a lane cleanup.
