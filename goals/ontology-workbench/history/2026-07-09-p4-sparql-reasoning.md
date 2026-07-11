# P4 SPARQL + Reasoning Evidence

Date: 2026-07-09
Branch: `feat/ontology-workbench-p4-sparql-reasoning`
Status: `host-reverification-required`

## Summary

P4 is locally integrated. The previous task had already placed the Oxigraph
driver, SPARQL runner, reasoner, query panel, client atoms, and desktop RPC
wiring on disk. This closeout finished the quality sweep, removed the dead
Effect catch around inference, repaired terse-effect findings, fixed docgen
examples, refreshed generated boundary config, and added P4 changeset/packet
coverage.

`packages/drivers/oxigraph` exists as `@beep/oxigraph` with source, tests,
docgen config, package metadata, tsconfig, and generated docs. It is registered
in root workspaces, root tsconfig paths, `tsconfig.packages.json`, ontology
server dependencies, ontology server tsconfig references, and the refreshed
`bun.lock` workspace link. The Oxigraph catalog pin is `^0.5.9`.

Follow-up host browser proof found the SPARQL panel working for SELECT and
CONSTRUCT, including inferred-source query routing, but the reasoner produced
zero inferred quads after opening the pizza tutorial fixture. The defect was in
the reasoner keyspace, not the open lifecycle: opening a document already
requests an inference run when the inferred view is enabled. `subjectKey`
serialized NamedNodes as `<iri>` while object/type lookup keys used raw IRI
values, so subclass ancestor walks missed every class edge and no closure/type
propagation quads were emitted. The fix normalizes NamedNode graph keys to raw
IRI values while keeping BlankNodes serialized.

The regression proof opens a session with:

```ttl
@prefix : <https://example.org/pizza#> .
:Pizza a owl:Class .
:Margherita a owl:Class ; rdfs:subClassOf :Pizza .
:NeapolitanMargherita a owl:Class ; rdfs:subClassOf :Margherita .
:m1 a :NeapolitanMargherita .
```

Initial inference now emits three inferred quads:

- `:NeapolitanMargherita rdfs:subClassOf :Pizza`
- `:m1 rdf:type :Margherita`
- `:m1 rdf:type :Pizza`

Adding `:Pizza rdfs:subClassOf :Food` incrementally expands the inferred set to
six quads and propagates `:m1 rdf:type :Food`; removing that edge invalidates
the derived `:Food` quads and returns the inferred set to three.

Follow-up runtime hang proof found a separate client-side render failure after
the reasoner key repair. The reasoner and RPC path terminated; the inferred
closure made the hierarchy a DAG, and the workbench's tree builder rendered
the same resource under each visible parent with the resource IRI as the MUI
tree item id. For the pizza fixture,
`:NeapolitanMargherita rdfs:subClassOf :Margherita` plus inferred
`:NeapolitanMargherita rdfs:subClassOf :Pizza` caused
`NeapolitanMargherita` to be emitted twice:
`Pizza -> Margherita -> NeapolitanMargherita` and
`Pizza -> NeapolitanMargherita`. That duplicate id surfaced only after
inference started emitting the three expected quads.

The repair extracted a pure tree view-model helper that treats inferred
hierarchies as DAGs: each resource id is emitted at most once, path cycles are
skipped, and no inferred quads are written back into session state. The client
atom path now caches successful inference by an input signature built from the
open session id, change-log count, and sorted asserted plus ontology quads.
Repeated enablement and enable-disable-enable cycles reuse the settled result
until those inputs actually change. Open/edit/undo/redo paths reset or refresh
the cache only when the asserted session input changes.

Placement was rechecked: `RunOntologyInference` is served by the professional
desktop sidecar RPC handler and delegates to the server-provided
`OntologyReasonerLive` layer. The renderer only sends the RPC and applies the
result to atoms; graph projection remains posted to
`Session.visualizer.worker.ts`.

## Implementation Surface

- `packages/drivers/oxigraph`
  - Oxigraph-backed `SparqlQueryService` layer.
  - Browser-safe lazy import boundary and typed driver errors.
- `packages/ontology/use-cases`
  - `Session.reasoner.ts`: closure, domain/range propagation,
    disjointness detection, changed-signature invalidation, drift cap, reasoner
    service.
  - `Session.reasoner.ts`: normalized subject/object graph-node keys so opened
    base datasets seed subclass closure and type propagation immediately.
  - `Session.sparql.ts`: prefix-aware defaults, SELECT/CONSTRUCT runner,
    LIMIT injection, truncation, SPARQL error mapping.
  - `Session.projections.ts`: inferred graph snapshot projection.
  - `Session.rpc.ts`, `index.ts`, `server.ts`: inference/SPARQL RPC exports.
- `packages/ontology/client`
  - Atoms for inference/SPARQL execution state and result/error surfaces.
  - Inference result cache keyed by asserted/ontology input signature so
    applying an inferred snapshot does not feed back into another inference
    request.
- `packages/ontology/ui`
  - Inferred-view toggle, query editor, example selection, run shortcut, and
    result/error panels.
  - Tree view-model that emits unique hierarchy item ids for inferred DAGs.
- `apps/professional-desktop`
  - Ontology orchestrator wiring for reasoner and SPARQL runner.

## Law Fixes

- `apps/professional-desktop/src/ontology/OntologyOrchestrator.ts`
  - Removed the dead `catch` branch from inference execution because
    `OntologyReasoner.infer` cannot fail.
  - Preserved SPARQL engine error mapping through the SPARQL execution path.
- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts`
  - Applied terse-effect auto rewrite.
  - Replaced passthrough `pipe(...)` callbacks with `flow(...)`.
  - Added typed `noneString` helper for match branches.
  - Added dual overload for `inferredSessionGraphPartitions`.
  - Normalized reasoner graph-node keys by using raw NamedNode IRIs for
    subjects and objects.
- `packages/ontology/use-cases/src/aggregates/Session/Session.projections.ts`
  - Added dual overload for `buildOntologySnapshotWithInference`.
- `packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx`
  - Flattened nested `Option` matches into match/helper rendering functions.
- `packages/ontology/ui/src/aggregates/Session/Session.tree.ts`
  - Extracted the hierarchy view-model and made inferred DAG rendering
    duplicate-id safe.
- `packages/ontology/client/src/aggregates/Session/Session.atoms.ts`
  - Added changed-signature inference caching over asserted plus ontology
    partitions and preserved settled results across view-only toggles.
- `packages/drivers/oxigraph/src/Oxigraph.sparql.ts`
  - Replaced native `Object.fromEntries` with repo helper usage.

## Local Proof

Passed:

```sh
bunx vitest run test/Session.test.ts --exclude='test/integration/**'
BUN_TMPDIR=/tmp bunx vitest run test/Session.atoms.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism
BUN_TMPDIR=/tmp bunx vitest run test/Session.workbench.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism
bun run --cwd packages/ontology/use-cases check
bun run --cwd packages/ontology/use-cases lint
bun run --cwd packages/ontology/client check
bun run --cwd packages/ontology/client lint
bun run --cwd packages/ontology/ui check
bun run --cwd packages/ontology/ui lint
bun run --cwd packages/ontology/client docgen
bun run --cwd packages/ontology/ui docgen
bun run beep laws terse-effect --write
bun run beep laws terse-effect --check
bun run check
bun run lint
bun run docgen
bun run beep quality jsdoc-inventory
bun run beep quality jsdoc-ratchet
bun run beep quality knip
bun run beep quality fallow dead-code --check --base origin/main --out .beep/fallow/dead-code.json --quiet
bun run beep quality fallow boundaries config-check --check
BUN_TMPDIR=/tmp bunx sherif@1.10.0 -r non-existent-packages
bunx syncpack lint
bun run changeset:status:since-main
bun run beep quality changeset-graph
git diff --check
```

Notable command output:

- `bun run docgen`: 103/103 Turbo docgen tasks passed; docs aggregate included
  `packages/drivers/oxigraph`, ontology use-cases, ontology server, ontology
  client, and ontology UI.
- `bun run beep quality jsdoc-inventory`:
  `packages=109 openPackages=0 openExports=0 openModules=0 rootPolicyOpen=0`.
- `bun run beep quality jsdoc-ratchet`:
  `tracked=6 increased=0 current_totals=17`.
- `bun run beep quality knip`:
  `current=4 baseline=6 introduced=0`.
- `bun run beep quality fallow dead-code ...`:
  `status=ok`, `findingCount=0`.
- `bun run beep quality fallow boundaries config-check --check`:
  generated boundary config is up to date and doctrine-pinned layer-legality
  checks passed.
- `BUN_TMPDIR=/tmp bunx sherif@1.10.0 -r non-existent-packages`:
  no issues found after sorting `packages/ontology/server/package.json`
  dependencies.
- `bunx syncpack lint`: no issues found; existing root local version advisory
  was printed as non-blocking.
- `bun run changeset:status:since-main`: changeset graph remains valid for the
  P4 workspace changes reported by the since-main status command.
- `git diff --check`: no whitespace errors.

Node-backed Vitest proof:

- `packages/ontology/use-cases/test/Session.test.ts`: 1 file, 9 tests passed
  for the focused fixture regression. The new test asserts open-seeded
  subclass closure and type propagation, incremental add behavior, and
  invalidation after remove. Snapshot quad metrics are 9 on open, 13 after the
  added superclass edge, and 9 after removal.
- `packages/ontology/client/test/Session.atoms.test.ts`: 1 file, 1 test passed.
  The atom/protocol regression opens the pizza session, enables inferred view,
  repeats enablement, disables, and re-enables; the fake RPC client counts one
  `RunOntologyInference` call and the settled inferred snapshot reaches nine
  total quads.
- `packages/ontology/ui/test/Session.workbench.test.ts`: 1 file, 1 test passed.
  The inferred pizza snapshot has `NeapolitanMargherita` under both
  `Margherita` and `Pizza`, and `ontologyTreeItemsFor` emits unique item ids
  with `NeapolitanMargherita` present exactly once.
- `packages/drivers/oxigraph`: 1 file, 1 test passed.
- `packages/ontology/use-cases`: 4 files, 13 tests passed.
- `packages/ontology/server`: 1 file, 1 test passed.
- `apps/professional-desktop`: 4 files, 26 tests passed.

Command-shape caveats:

- First `fallow boundaries config-check` invocation incorrectly included
  envelope flags (`--base`, `--out`, `--quiet`); rerun with only `--check`
  passed after refreshing generated config.
- First use-cases/server Node Vitest invocations did not quote the zsh
  `--exclude` glob; reruns with `--exclude='test/integration/**'` passed.
- `changeset status --since=origin/main` ignores untracked changeset files, so
  it did not print the new P4 changeset until staging/commit. Plain
  `changeset status --verbose` sees the file and lists `@beep/oxigraph`.
- `bun run test` failed in this sandbox before the affected regression could
  run through the normal Bun-backed package scripts. Failures were worker-pool
  timeouts in unrelated packages plus a shared PGLite Testcontainers image
  provisioning failure. The branch-local node-backed Vitest command above
  passed for the changed `Session.test.ts` regression.
- `bun run --cwd packages/ontology/use-cases test` also hit the same
  Bun/Vitest fork-worker startup timeout in this sandbox. The direct
  node-backed package-cwd Vitest command passed.
- `BUN_TMPDIR=/tmp bun run --cwd packages/ontology/client test` and
  `BUN_TMPDIR=/tmp bun run --cwd packages/ontology/ui test` hit the same
  Bun/Vitest fork-worker startup timeout before loading the new regression
  files. Direct node-backed Vitest commands for both new files passed.

## Host Commands Required

Run on the host with normal network/package-manager access:

```sh
bun install
bun run check
bun run lint
bun run docgen
bun run --cwd packages/drivers/oxigraph test
bun run --cwd packages/ontology/use-cases test
bun run --cwd packages/ontology/server test
bun run --cwd packages/ontology/client test
bun run --cwd packages/ontology/ui test
bun run --cwd apps/professional-desktop test
bun run --cwd apps/professional-desktop dev:sidecar
bun run --cwd apps/professional-desktop dev
```

Then verify in the running desktop/web shell:

- Open an ontology document.
- Open `tmp/ontology-workbench/pizza-tutorial.ttl` and enable inferred view.
- Confirm Worker Metrics reports inferred quads after open instead of
  `quads 0`.
- Run `SELECT ?t WHERE { :m1 rdf:type ?t }` against inferred source and confirm
  asserted `:NeapolitanMargherita` plus inferred `:Margherita` and `:Pizza`
  are queryable.
- Run the default SELECT query with and without inferred graph enabled.
- Run a CONSTRUCT query and confirm construct rows/dataset display.
- Trigger Ctrl/Cmd+Enter from the query editor.
- Confirm LIMIT injection/truncation copy and result counts.
- Confirm inferred-view metrics/resource changes after adding a subclass or
  domain/range statement.
- Confirm SPARQL engine errors map to workbench error UI without masking
  inference execution.

## P5 Risks

- SHACL validation must consume the same asserted plus inferred partition
  discipline as P4 SPARQL; do not fork another dataset assembler.
- Verified repair suggestions should remain undoable typed change operations,
  not direct graph mutation.
- PROV-O export should derive from the existing change log and include P4
  inference/SPARQL actions as evidence, not persistence state.
- The `bun.lock`/workspace link refresh for `@beep/oxigraph` must happen on a
  host before relying on hosted Turbo transitive-closure precision.
