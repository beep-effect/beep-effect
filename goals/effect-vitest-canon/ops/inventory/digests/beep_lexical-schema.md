# @beep/lexical-schema — four-lens source audit

7 census files, 29 rows, 3 review items and 26 file-specific no-findings rows. All rows are open P1 judgments; P2 remains gated.

## Topology, native boundaries and limitations

Seven executable files cover codec projection, strict/open model boundaries, annotation/ledger integrity, compatibility and error equivalence. Model properties exercise exact round trips and malformed JSON/tree inputs. The real headless Lexical editor cases retain a vendor-runtime oracle; they are not replaceable by schema self-consistency alone. URLs are input strings, not HTTP resources. The two ledger cases read actual package artifacts through conformanceLedgerEvidence.readText (Bun.file); inventing MemoryFileSystem contents would replace the subject. The retained Node cohort may rely on repository runtime compatibility; it is not independent proof of raw Node support for Bun.file.

There is no acquired network layer in these suites. Pure transformations dominate codec/model work; ledger file reads are independent concurrent artifact reads. No isolated layer-rebuild timing was collected, so no numerical saving is claimed. The two literal runs:50 options bypass fcRuns floor/seed semantics; other fcRuns(50/100) sites remain intact. Conditional branches preceded by a fail-fast tag assertion are not classified as vacuous. Intentional loss of frontmatter ownership, table alignment and nested-link structure remains explicit and must not be hardened into a false lossless contract.

History contains five production coverage metric observations across two jobs, not five failing tests. These do not establish a flake or current missing coverage; exact historical source/baseline comparison is outside this audit.

## Review items

- **L-PROP-03 — property-floor-bypass**, `packages/foundation/modeling/lexical/test/Lexical.codec.test.ts:648-667`. The totality property passes literal runs:50; neighboring properties use fcRuns. Keep the same schema-derived editor states, totality predicate, run minimum 50 and failure assertion. Route options through fcRuns(50), including its CI floor and replay seed, when adopting the public property registration. This is option semantics beyond the EV007 syntax candidate.
- **L-PROP-03 — property-floor-bypass**, `packages/foundation/modeling/lexical/test/Lexical.model.test.ts:359-373`. The editor-state encode/decode property passes literal runs:50. Preserve the exact editor-state arbitrary, equality oracle and minimum 50 runs. Use fcRuns(50) so configured higher CI runs and seed survive migration. Do not replace round-trip equivalence with mere decoding success.
- **L-PROP-04 — conditional-projection-oracle**, `packages/foundation/modeling/lexical/test/Lexical.codec.test.ts:574-600`. Image and raw-block checks enter payload assertions only if the projection is a paragraph; no preceding tag assertion requires that variant. Preserve each exact count/content assertion and require the expected paragraph variant before its payload checks. Also apply the same non-vacuity review to the unlabeled artifact check at 333-336 and valid-language code check at 414-417. A wrong variant can currently bypass these checks. Do not change deliberate lossy round-trip contracts or branches already preceded by a tag assertion.

## Retained timing and provenance

Node22.22.3 / Bun1.4.2 / Vitest4.1.11 context: 71 passed registrations; reporter interval 19792.755615ms; whole command 21.964580s. Source head 662823dd960367046ba7d73dd8fd25d15782865a. Full executable-file representation is recorded; support files have no independent test timing. This is not coverage, compiler or package acceptance. No rerun or workload adjustment was performed. Runtime and workload identities remain in the public package timing context.

- Historical coverage-ratchet: https://github.com/beep-effect/beep-effect/actions/runs/34438997453/job/102749878919, head `bb078d815af12a29f48ef76c83837c8719f59c25`, path `packages/foundation/modeling/lexical/src/Lexical.model.ts`. 2026-09-10T05:26:15.2121771Z   - @beep/lexical-schema (packages/foundation/modeling/lexical/src/Lexical.model.ts) functions: 97.22 < 100
- Historical coverage-ratchet: https://github.com/beep-effect/beep-effect/actions/runs/34438997453/job/102749878919, head `bb078d815af12a29f48ef76c83837c8719f59c25`, path `packages/foundation/modeling/lexical/src/Lexical.model.ts`. 2026-09-10T05:26:15.2122911Z   - @beep/lexical-schema (packages/foundation/modeling/lexical/src/Lexical.model.ts) lines: 98.95 < 100
- Historical coverage-ratchet: https://github.com/beep-effect/beep-effect/actions/runs/34438997453/job/102749878919, head `bb078d815af12a29f48ef76c83837c8719f59c25`, path `packages/foundation/modeling/lexical/src/Lexical.model.ts`. 2026-09-10T05:26:15.2124016Z   - @beep/lexical-schema (packages/foundation/modeling/lexical/src/Lexical.model.ts) statements: 99.01 < 100
- Historical coverage-ratchet: https://github.com/beep-effect/beep-effect/actions/runs/33353658076/job/99371613322, head `7236fb68d90d1f71c6d66e21771855b593ff666c`, path `packages/foundation/modeling/lexical/src/Lexical.codec.ts`. 2026-08-31T03:45:53.3829242Z   - @beep/lexical-schema (packages/foundation/modeling/lexical/src/Lexical.codec.ts) branches: 86.79 < 86.95
- Historical coverage-ratchet: https://github.com/beep-effect/beep-effect/actions/runs/33353658076/job/99371613322, head `7236fb68d90d1f71c6d66e21771855b593ff666c`, path `packages/foundation/modeling/lexical/src/Lexical.codec.ts`. 2026-08-31T03:45:53.3829857Z   - @beep/lexical-schema (packages/foundation/modeling/lexical/src/Lexical.codec.ts) functions: 75.47 < 75.48

## P2 ordering and uncertainty

After separate P2 authorization: strengthen the identified output-variant witnesses and route property options through the shared run-floor/seed helper. Preserve real ledger and Lexical runtime subjects, exact round-trip assertions, and documented lossy transformations. Retained passing timings do not eliminate source-derived oracle gaps.

## Top files and counts

- `packages/foundation/modeling/lexical/test/Lexical.codec.test.ts`: 5 rows, 2 review items.
- `packages/foundation/modeling/lexical/test/ConformanceLedger.test.ts`: 4 rows, 0 review items.
- `packages/foundation/modeling/lexical/test/Lexical.conformance-annotation.test.ts`: 4 rows, 0 review items.
- `packages/foundation/modeling/lexical/test/Lexical.conformance.test.ts`: 4 rows, 0 review items.
- `packages/foundation/modeling/lexical/test/Lexical.model.test.ts`: 4 rows, 1 review items.
- `packages/foundation/modeling/lexical/test/Lexical.strict-invariants.test.ts`: 4 rows, 0 review items.
- `packages/foundation/modeling/lexical/test/TaggedError.equivalence.test.ts`: 4 rows, 0 review items.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
