# @beep/ontology-server — P1 source audit

Root-reviewed and accepted P1 source inventory. P2 remains gated.

All 4 assigned files were read completely in the original audit and reused only after current hash equality. 16 rows: 4 minor review proposals and 12 info coverage rows. All are open judgments.

| Lens | Review | Coverage | Total |
| --- | ---: | ---: | ---: |
| resource | 1 | 3 | 4 |
| flake | 0 | 4 | 4 |
| property | 2 | 2 | 4 |
| observability | 1 | 3 | 4 |

Review proposals:

- `packages/ontology/server/test/OntologyPublishTools.test.ts:47` — L-PROP-04: The success client accepts any request and the success test only checks returned status/length/path. Capture the request and assert exact POST destination, Turtle content type and full sidecar body. A wrong/empty outgoing payload could still receive the stubbed 202. Preserve denial/outage separation and no-egress controls; do not invent remote execution proof.
- `packages/ontology/server/test/OntologyTools.test.ts:229` — L-PROP-04: The test named returns plain literals asserts only displayedResultCount 200 and profile select; it never inspects a returned literal term. Retain those assertions and add an exact known fixture literal value/type check using a deterministic query or binding lookup. Dropping/corrupting literal values while retaining count/profile must fail; keep real Oxigraph execution.
- `packages/ontology/server/test/SessionServer.test.ts:397` — L-RES-04: Preserve native filesystem security subjects during EV010/wrapper migration: outside/in-root symlinks, literal POSIX backslash targets, startup-root swap, atomic rename failure and unchanged victims/link targets. A memory volume or unconditional shared root cannot substitute for these native canonicalization/rename behaviors. Keep layer-construction failure scopes as the tested boundary, not blanket-redundant scopes.
- `packages/ontology/server/test/SessionServer.test.ts:546` — L-OBS-01: The local codec property helper projects the full native result to _tag. Preserve encode/decode equivalence for all three schemas and fcRuns(10) while exposing schema identity, formatted counterexample and replay in separate named properties. Do not substitute a weaker decode-to-self law or remove native security assertions.

Top files by human-row count (ties sorted by path; these are review coverage counts, not defect counts):

- `packages/ontology/server/test/OntoauthorMatCompetency.test.ts`: 4 rows; 0 review proposals.
- `packages/ontology/server/test/OntologyPublishTools.test.ts`: 4 rows; 1 review proposals.
- `packages/ontology/server/test/OntologyTools.test.ts`: 4 rows; 1 review proposals.
- `packages/ontology/server/test/SessionServer.test.ts`: 4 rows; 2 review proposals.

withToolkit/session wrappers construct scoped temp roots and actual Turtle/Oxigraph/reasoner/SHACL services. Preserve root lifetime and fresh state; avoid successful engine stubs. Publish direct tests use pure Layer.succeed FileStore/HttpClient stubs and perform no remote publication. Their wrapper provenance differs from allocating native fixtures. Session symlink, root-swap and atomic-rename denial controls require real filesystem behavior; blanket MemoryFileSystem conversion is unsound. Exact seeded files may be considered for incidental fixture loading only. Tools is the slowest retained file at 0.946 seconds; no isolated rebuild measurement exists.

Retained first-attempt Node baseline: 26 passed registrations; whole command 5.666298 seconds, exit 0. All assigned files are represented according to the context receipt. Reporter SHA256 `460e439be834100dc6599bd6f69a18d4fa19bbffaba3c88905d0d50552fa2afe`. Node 22.22.3, Bun 1.4.2, Vitest 4.1.11; rc113 pin d3b837aee836f35d625d55205f7d6e61305fc198. This is one recorded run, not absence of races, package compiler/coverage proof, supported-peer proof or external-provider execution. No timing was rerun.

No package-mapped observation was present in the retained completed hosted dataset. That is not proof of no historical failures or rare races.

Campaign limits: 139 first attempts, 132 accepted full-file-representation baselines, four configured subsets and three failed cohorts (CIops, Effect Drizzle, QA Capture). Hosted history covers 527 failed runs with 21 unavailable logs and one unresolved cause. Observations are not unique flakes; production coverage locations are not test failures. Graph-3d browser execution is outside its configured Node cohort.

Proposed P2 order remains scope, assertions, property, flake, observability. First preserve the native boundaries and fixture lifetimes above, then review existing detector candidates without dropping operands or inventing tagged payloads. Apply the specific property controls/floors before ordering and diagnostic improvements. P2 is unauthorized; native-provider runtime behavior, rare failures, coverage completeness and measured optimization benefit remain outside this source audit.

Root verified the sealed artifacts, current inputs and full source receipts, then passed combined strict inventory validation. Full P1 completeness, Grok review and Benjamin’s acknowledgement remain required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
