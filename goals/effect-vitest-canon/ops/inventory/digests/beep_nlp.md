# @beep/nlp — P1 source audit digest

P1 source inventory reviewed by Root; P2 remains gated.

Reviewed 10 assigned census files in full, producing 40 rows: 13 review rows and 27 file-specific coverage rows. Lens counts: {'resource': 10, 'flake': 10, 'property': 10, 'observability': 10}. Severity counts: {'info': 27, 'minor': 13}. Every row remains open judgment; coverage is not an action.

Highest-count files (all tie at four rows; source order, maximum ten):

- `packages/foundation/modeling/nlp/test/Algebra/Monoid.test.ts`: 4 rows, 2 review rows; full lines 1–150.
- `packages/foundation/modeling/nlp/test/Algebra/NLPMonoid.test.ts`: 4 rows, 2 review rows; full lines 1–241.
- `packages/foundation/modeling/nlp/test/CoreModels.test.ts`: 4 rows, 1 review rows; full lines 1–254.
- `packages/foundation/modeling/nlp/test/Graph/GraphOps.test.ts`: 4 rows, 1 review rows; full lines 1–193.
- `packages/foundation/modeling/nlp/test/Graph/Schema.test.ts`: 4 rows, 1 review rows; full lines 1–210.
- `packages/foundation/modeling/nlp/test/Handoff/Contract.test.ts`: 4 rows, 2 review rows; full lines 1–241.
- `packages/foundation/modeling/nlp/test/Ontology/Kind.test.ts`: 4 rows, 2 review rows; full lines 1–129.
- `packages/foundation/modeling/nlp/test/Operations/Composable.test.ts`: 4 rows, 1 review rows; full lines 1–167.
- `packages/foundation/modeling/nlp/test/PatternCore.test.ts`: 4 rows, 1 review rows; full lines 1–232.
- `packages/foundation/modeling/nlp/test/TextVariants.test.ts`: 4 rows, 0 review rows; full lines 1–67.

Layer topology: all assigned NLP subjects are in-memory algebra, graph, schema or string operations. Graph sample() creates a fresh graph per case; traversal streams are awaited. Mutable map combine helpers copy before mutation. There is no external resource rebuild or measured layer-sharing speedup to claim, and path strings do not make TextVariants a filesystem test. No MemoryFS substitution is needed.

The review rows identify missing explicit native floors in Monoid, NLPMonoid, Kind and the standalone Span law; mapEdges/bimap oracles that do not inspect transformed edge values; fixed-only Composable laws; and lost native property failure context in seven files. Preserve SentenceConcat identity-only coverage and all original comparators, integer/vector bounds, explicit fcRuns(25/50), optional wire keys and generation-link assertions. Native omitted options mean 100 trials and a random seed; explicit fcRuns(100) preserves that floor while carrying CI controls.

Completed Root baseline: `accepted-node-command-baseline`, 168 registered/passed cases, zero failed in that attempt, command 7.927654781 seconds; reporter span 7469.202393 ms. These are different measurements. Runtime Node v22.22.3, Bun 1.4.2, Vitest 4.1.11; command from package cwd: `bunx vitest run --reporter=json --outputFile=<absolute private report>`. No timing was rerun. The package baseline represents every assigned test file; support fixtures are not counted as registered cases. Campaign collection is complete: 139 first attempts, 132 accepted full-file-representation baselines, four configured subsets and three failures. A single pass is neither coverage/package proof nor evidence that rare races are absent.

Hosted history: 3 coverage-ratchet observations in 1 job, retained in the hosted history summary. NLP observations concern Handoff/Contract.ts production function/line/statement coverage (83.33/92.85/92.85 below 100). These are not named failing tests or unique flakes, and no introduced/inherited source attribution is inferred. The completed campaign covers 527 failed runs but 21 relevant logs are unavailable and one cause remains unresolved. No absence-of-failures claim follows.

Proposed P2 order remains scope → assertions → property → flake → observability. Preserve exact assertion payloads and floors; first settle ownership/native boundaries, then mechanical assertion guidance, the concrete property gaps, falsifiable scheduling/deadline evidence and opt-in diagnostics. P2 is not authorized. The 90 inherited-main ratchet additions are untouched.

All source/read/row and strict decoder evidence is private beside this digest. Effect/adapter rc113 pin d3b837aee836f35d625d55205f7d6e61305fc198; Vitest 4.1.11 remains the explicitly accepted runtime, not a claim of satisfying the adapter Vitest 5 peer declaration. Root alone judges acceptance and future proof.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
