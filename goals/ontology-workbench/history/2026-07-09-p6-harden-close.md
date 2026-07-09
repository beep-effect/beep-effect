# P6 Harden + Close Evidence

Date: 2026-07-09
Branch: `feat/ontology-workbench-p6-harden-close`
Status: `host-verification-required`

## Summary

P6 structural hardening is implemented locally. The work adds a real-world
PROV-O subset fixture with attribution, expands the server interop test to
cover prefix-preserving open/serialize/reparse plus rdfc-1.0 fingerprint
stability, adds an ontoauthor-mat t1-t6 executable competency status suite,
adds a repeatable node-side projection benchmark, writes the SPEC acceptance
checklist, and updates packet/docs/disambiguation status.

The packet is not closeable yet. ROBOT and Protégé are not available in this
sandbox, `/reflect` is intentionally left to the orchestrator, Yeet
publish/monitor were explicitly out of scope, and two ontoauthor-mat tasks
remain real capability gaps because they require OWL class-expression
reasoning beyond the bounded structural reasoner.

## Interop Validation

Design:

- Fixture suite:
  - all ontoauthor-mat `reference.ttl` and `shapes.ttl` files;
  - `foaf-social-network/graph.ttl`;
  - `real-world/prov-o-starting-point.ttl`, a small W3C PROV-O starting point
    ontology subset.
- Test path: `packages/ontology/server/test/SessionServer.test.ts`.
- Structural proof:
  - read through sidecar `OntologyFileStore`;
  - parse through the server `TurtleCodec` backed by `@beep/n3`;
  - serialize with the parsed prefix map;
  - fresh-parse the serialized Turtle;
  - compare `@beep/rdf-canonize` `rdfc-1.0` fingerprints;
  - assert serialized output preserves parsed prefix declarations;
  - assert primary Turtle serialization excludes `inferred` and `provenance`
    partition sentinels.

Local result:

```sh
cd packages/ontology/server
node ../../../node_modules/vitest/vitest.mjs run --config vitest.config.ts \
  test/SessionServer.test.ts test/OntoauthorMatCompetency.test.ts
```

Result: 2 test files passed, 3 tests passed.

Host-gated ROBOT commands:

```sh
robot validate --input packages/ontology/server/test/fixtures/real-world/prov-o-starting-point.ttl
robot validate --input packages/ontology/server/test/fixtures/foaf-social-network/graph.ttl
find packages/ontology/server/test/fixtures/ontoauthor-mat -name '*.ttl' -print0 \
  | xargs -0 -I{} robot validate --input {}
```

Host-gated Protégé check:

```sh
protege packages/ontology/server/test/fixtures/real-world/prov-o-starting-point.ttl
```

Sandbox reality:

- `command -v robot` returned no path.
- `command -v protege || command -v Protege || command -v protege-desktop`
  returned no path.
- Protégé GUI proof cannot run in this sandbox.

## OntoAuthor-Mat Competency

Test path: `packages/ontology/server/test/OntoauthorMatCompetency.test.ts`.

The suite executes every task through:

- Turtle parse of `reference.ttl` and `shapes.ttl`;
- session construction with shapes in the `shapes` partition;
- bounded structural inference;
- Oxigraph-backed SPARQL `ASK` execution for each `cq.sparql` block;
- shacl-engine-backed validation through `OntologyValidationRunner`.

Result table:

| Task | SHACL | CQ values | Disjointness | Verdict | Reason |
| --- | --- | --- | ---: | --- | --- |
| t1-subsumption | pass | true, true | 0 | pass | RDFS subclass/type closure is covered by the bounded structural reasoner. |
| t2-existential | pass | false, true | 0 | fail | `owl:equivalentClass` plus `owl:someValuesFrom` classification is outside the bounded structural reasoner. |
| t3-universal | pass | false, true | 0 | fail | `owl:equivalentClass` plus `owl:allValuesFrom` classification is outside the bounded structural reasoner. |
| t4-disjointness | pass | true, true | 0 | pass | The ontology is structurally consistent and the disjoint classes have separate individuals. |
| t5-sameas | pass | true, true | 0 | pass | The `owl:sameAs` assertion and duplicate datatype facts are structurally present. Full sameAs property propagation remains DL-reasoner scope. |
| t6-unsatisfiability | pass | true, true | 1 | pass | The bounded disjointness detector flags the deliberately contradictory individual. |

SPEC acceptance item "the six ported ontoauthor-mat competency tasks pass" is
resolved as a formal scoped deferral for T2/T3. Four of six pass under the
current stack. T2 and T3 require `owl:equivalentClass` +
`owl:someValuesFrom`/`owl:allValuesFrom` classification — full OWL 2 DL
reasoning, which GOAL.md explicitly lists as out of scope for this packet
("Out: ... full OWL 2 DL reasoning"). The competency suite remains executable
and asserts the current expected outcomes (T2/T3 marked as DL-gated), so the
deferral is regression-guarded: adding a DL reasoner in a follow-up packet
flips the two assertions to full-pass expectations.

## Performance Pass

Repeatable command:

```sh
bun goals/ontology-workbench/ops/benchmark-projection.ts
```

Sandbox result:

| Elements | Projection ms | Projected nodes | Projected edges | Folded resources | Clusters |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1,000 | 45.95 | 1,000 | 999 | 0 | 0 |
| 10,000 | 259.89 | 40 | 9,247 | 10,000 | 40 |
| 100,000 | 39,587.82 | 400 | 99,336 | 100,000 | 400 |

This is node-side projection timing only. The GPU/render proof remains the P3
webkitgtk spike:

- pre-folds cosmos path: 100,000 elements, setup 240.0 ms, 60.0 FPS;
- folds-active worker projection in Tauri webkitgtk: 100,000 source elements,
  L3 folded to 300 community buckets and 49,610 edges, worker setup 8,185 ms,
  60.0 FPS, UI responsive while projection ran off the main thread.

## Docs And Disambiguation

Files touched:

- `packages/foundation/modeling/ontology/README.md` - clarifies
  `@beep/ontology` as the foundation modeling package for repo-internal
  ontology/FOLIO/identity-as-IRI surfaces.
- `packages/ontology/domain/README.md` - clarifies `@beep/ontology-domain` as
  the product slice domain for user Turtle documents.
- `docs/product/ontology-workbench.md` - authored product/proof note.
- `packages/ontology/server/test/fixtures/README.md` - attribution for the
  PROV-O subset fixture.

No files under `docs/_internal/` or `docs/generated/` were touched.

## SPEC Acceptance Checklist

| SPEC acceptance item | Verdict | Evidence |
| --- | --- | --- |
| Real BFO-aligned knowledge-graph ontology can be authored end-to-end in-app: classes, object/data properties, individuals, annotations, subclass axioms. | partial / host-gated | P2 evidence proves app open/edit/save, typed operations, change log, ABox/TBox, and pizza authoring flow. No P6 host GUI run authored a real BFO-aligned ontology end-to-end. |
| Save produces deterministic Turtle that Protégé and ROBOT parse; load-save round-trips losslessly by canonicalization fingerprint. | structural pass / ROBOT+Protégé host-gated | P6 `SessionServer.test.ts` proves parse/serialize/reparse, prefix preservation, no derived leakage, and rdfc-1.0 fingerprint stability across packet fixtures plus PROV-O subset. ROBOT/Protégé commands are recorded above but not run here. |
| Undo/redo works across all edit kinds; human-readable change log renders from typed change operations. | partial / host-gated | P2 app proof covers add triple, undo, redo, dirty state, save, and change-log panel. P5 validation proof covers repair undo at use-case level. Full all-edit-kinds browser sweep remains host-gated. |
| Hierarchy explorer, search, and graph viewport stay interactive with synthetic 100k-element ontology on webkitgtk. | pass with P3 evidence / host re-run recommended | P3 webkitgtk spike records 100k cosmos 60 FPS and folds-active worker projection with responsive UI. P6 adds repeatable node projection benchmark. |
| SPARQL panel executes SELECT and CONSTRUCT over the loaded ontology. | pass / host re-run recommended | P4 evidence records SELECT and CONSTRUCT working in host browser proof; Oxigraph driver remains covered by package tests. |
| Inferred-view toggle shows derived hierarchy/types and flags disjointness violations. | structural pass / UI host-gated | P4 inference regressions prove subclass/type propagation; P6 t6 proves disjointness detection. UI toggle proof remains host-gated. |
| ABox/TBox view modes stay consistent across explorer, search, and viewport. | pass | P2/P3 use-case tests and P2 app proof cover one shared classification rule across snapshot/search/viewport. |
| SHACL loop: loading shapes renders violations with focus-node navigation; applying a verified repair resolves the violation; undo restores prior state. | structural pass / browser host-gated | P5 node-backed validation test covers violation -> verified repair -> clean revalidation -> undo. P5 host browser focus/navigation remains host-gated. |
| Six ported ontoauthor-mat competency tasks pass in slice tests. | deferred (T2/T3, out-of-scope DL reasoning) | P6 executable suite runs all six. T1, T4, T5, and T6 pass. T2 and T3 need `owl:someValuesFrom`/`allValuesFrom` equivalent-class classification — full OWL 2 DL reasoning, out of scope per GOAL.md; deferral is regression-guarded in the suite for a follow-up reasoner packet. |
| PROV-O journal export derives from typed change log; VoID/DCAT dataset description is produced at export. | pass | P5 validation/provenance test and evidence cover `.prov.ttl` plus `.dataset.ttl` exports through the file-store port. |
| Metrics panel renders worker-computed counts and quality heuristics. | structural pass / browser host-gated | P2/P5 evidence records metrics wiring; P3/P6 projection stats prove worker/projection counts. Browser render re-proof remains host-gated. |
| Slice tests run with only own Layers + shared test-kit + driver test Layers; no app runtime boot. | pass | P6 server tests run with ontology server test layer, NodeServices, Oxigraph, SHACL, N3, and rdf-canonize; no professional-desktop runtime boot. |
| No unrelated refactors or formatting churn. | pass pending final diff review | P6 edits are limited to ontology fixture/tests, docs, packet status/evidence, and the projection benchmark script. Pre-existing `.claude/launch.json` remains unrelated and untracked. |

## Packet Status Updates

- `PLAN.md`: status line updated; P6 row set to
  `host-verification-required`.
- `README.md`: current phase and latest evidence updated for P6.
- `ops/manifest.json`: P6 phase set to `host-verification-required`;
  `initiative.status` remains `active` because closure gates are not met.

The packet was not marked `completed-retained` / `complete` because the
orchestrator still needs to run `/reflect`, reflection lint, host validation,
Yeet closeout, and a decision on the T2/T3 DL competency gap.

## Host Commands Remaining

```sh
robot validate --input packages/ontology/server/test/fixtures/real-world/prov-o-starting-point.ttl
find packages/ontology/server/test/fixtures/ontoauthor-mat -name '*.ttl' -print0 \
  | xargs -0 -I{} robot validate --input {}
bun run --cwd apps/professional-desktop dev:sidecar
bun run --cwd apps/professional-desktop dev
bun run beep lint reflection-artifacts
bun run beep yeet verify
```

Then run `/reflect` to create
`goals/ontology-workbench/history/reflections/<YYYY-MM-DD>-<agent>.md`, rerun
reflection lint, and continue with Yeet publish/monitor only from the
orchestrator-approved lane.

## Local Gate Results

Passed:

```sh
node ../../../node_modules/vitest/vitest.mjs run --config vitest.config.ts \
  test/SessionServer.test.ts test/OntoauthorMatCompetency.test.ts
bun run --cwd packages/ontology/server check
bun run --cwd packages/ontology/server lint
bun run --cwd packages/ontology/domain lint
bun run --cwd packages/foundation/modeling/ontology lint
bunx biome check packages/ontology/server/test/SessionServer.test.ts \
  packages/ontology/server/test/OntoauthorMatCompetency.test.ts \
  goals/ontology-workbench/ops/benchmark-projection.ts
bun goals/ontology-workbench/ops/benchmark-projection.ts
test "$(wc -m < goals/ontology-workbench/GOAL.md)" -le 4000
jq . goals/ontology-workbench/ops/manifest.json
rg -n "ontology-workbench|GOAL.md|agentLaunchers|packetAnchorDocument" goals/ontology-workbench
git diff --check
git diff --check -- goals/ontology-workbench
```

Blocked by sandbox runner:

```sh
BUN_TMPDIR=/tmp bun run --cwd packages/ontology/server test
```

Result: failed before importing test modules with Vitest fork-worker startup
timeouts for both P6 test files:
`[vitest-pool]: Failed to start forks worker` and
`Timeout waiting for worker to respond`. The node-backed Vitest command above
ran the same files and passed.

## Reflection Notes For Orchestrator

- The packet successfully proved a Turtle-first path, but the acceptance list
  now exposes a mismatch between "bounded structural inference" and
  ontoauthor-mat tasks that require OWL DL class-expression reasoning.
- P6 structural interop can stand in for ROBOT/Protégé only as sandbox proof;
  host-side binary validation is still required before closeout.
- Prefix preservation and derived-graph exclusion are now explicit regression
  tests and should stay as closeout gates for future Turtle persistence work.
- Worker projection is viable but 100k node-side projection is still expensive;
  the interactive claim depends on worker offloading plus webkitgtk render
  proof, not raw projection latency.
- Keep `@beep/ontology` and `@beep/ontology-domain` naming boundaries visible;
  future ontology-agent tooling should route through ports, not foundation
  package leakage.
