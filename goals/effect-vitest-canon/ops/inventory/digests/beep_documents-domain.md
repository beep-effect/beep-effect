# @beep/documents-domain four-lens digest

All seven files inspect local codecs, entity metadata, taxonomy values or pure path projections. Box IDs, 429/503 messages, relative file paths, outbox status and generation counts are fixture data; no Box request, filesystem acquisition, sync executor or SQL transaction is tested. MemoryFS substitution would add an irrelevant subject. Drizzle materialization checks index declarations only, not database enforcement.

SyncConflict/Cursor/Item/Operation retain exact encoded rows, null-to-None controls, enum rejection and schema-equivalence laws with fcRuns(10). Taxonomy retains exact projected paths, batch values and FilingOutcome round trip with the same shared floor/seed seam. Count equality is not claimed as complete JSON-LD semantic correspondence. No new human review item is asserted beyond the retained mechanical migration candidates. No timed layer rebuild was measured; source work consists of codec/arbitrary construction and pure metadata/projection. These coverage-only rows do not assert exhaustive semantic or mutation-test coverage.

| Lens | Rows |
| --- | ---: |
| resource | 7 |
| flake | 7 |
| property | 7 |
| observability | 7 |

Severity: 28 info. 0 review items and 28 coverage-only rows.

Retained accepted Node command baseline: 27 cases, reporter span 10777.954345703125 ms, whole command 11.574644780999733 seconds. Node22.22.3/Bun1.4.2/Vitest4.1.11; no load adjustment. Passing configured runs are not race absence, coverage or full package proof.

## Top ten files by retained reporter duration

- packages/documents/domain/test/SyncItem.test.ts: 18.262939453125 ms, 5 tests.
- packages/documents/domain/test/SyncOperation.test.ts: 17.954345703125 ms, 5 tests.
- packages/documents/domain/test/SyncConflict.test.ts: 17.717041015625 ms, 5 tests.
- packages/documents/domain/test/SyncCursor.test.ts: 15.237548828125 ms, 5 tests.
- packages/documents/domain/test/Taxonomy.test.ts: 12.66357421875 ms, 5 tests.
- packages/documents/domain/test/EntityMaterialization.test.ts: 6.085693359375 ms, 1 tests.
- packages/documents/domain/test/TaggedError.equivalence.test.ts: 1.44677734375 ms, 1 tests.

Hosted mapping: 20 coverage-ratchet observations in 1 job, not unique flakes or test failures. Exact job provenance, runtime/settings, file/test timings and host qualification are retained in the public timing context and hosted history summary. No current failure is reproduced here.

P2 remains gated. Proposed order: scope, assertions, property, flake, observability; retain pure local subjects, all assertions/operands/polarity and current native arbitrary floors. No timeout, dependency or provider change is proposed. Root-reviewed P1 inventory; P2 remains gated.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
