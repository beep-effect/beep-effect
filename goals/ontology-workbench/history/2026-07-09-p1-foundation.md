# P1 Foundation Evidence

Date: 2026-07-09

Branch: `feat/ontology-workbench-p1-foundation`

## Summary

P1 implementation is in place and ready for host verification. The `ontology`
vertical slice was generated via architecture codegen and reduced to the
minimum legal P1 roles: domain, use-cases, and server. A product-neutral
`@beep/n3` driver package wraps N3.js as a Turtle codec over `@beep/rdf`
datasets. The ontology session model is schema-first and keeps N3 IO at the
server/driver boundary.

## Scaffold And Packages

- Codegen command used:
  `bun run beep architecture create slice ontology Session --domain-kind aggregates --stage core`
- Slice packages:
  - `packages/ontology/domain`
  - `packages/ontology/use-cases`
  - `packages/ontology/server`
- Driver package:
  - `packages/drivers/n3`
- Root workspace registration updated in `package.json`.

## Key Modules

- Domain:
  - `packages/ontology/domain/src/aggregates/Session/Session.values.ts`
  - `packages/ontology/domain/src/aggregates/Session/Session.model.ts`
  - `packages/ontology/domain/src/aggregates/Session/Session.errors.ts`
- Use-cases:
  - `packages/ontology/use-cases/src/aggregates/Session/Session.commands.ts`
  - `packages/ontology/use-cases/src/aggregates/Session/Session.ports.ts`
  - `packages/ontology/use-cases/src/aggregates/Session/Session.worker-protocol.ts`
  - `packages/ontology/use-cases/src/aggregates/Session/Session.service.ts`
- Server:
  - `packages/ontology/server/src/aggregates/Session/Session.file-store.ts`
  - `packages/ontology/server/src/aggregates/Session/Session.layer.ts`
- Driver:
  - `packages/drivers/n3/src/N3.errors.ts`
  - `packages/drivers/n3/src/N3.service.ts`

## Domain Shape

- Session = `baseDataset` + ordered `changeLog`.
- Change operations are tagged unions over `addQuad` and `removeQuad`.
- Derived graph partitions:
  - `asserted`
  - `ontologies`
  - `inferred`
  - `shapes`
  - `provenance`
- Shared SPEC 13 exclusion rule:
  - `asserted`, `ontologies`: included in reasoning
  - `inferred`, `shapes`, `provenance`: excluded from reasoning

## Ports And Worker Protocol

- `OntologyFileStore` uses Effect `FileSystem` at the server boundary.
- `TurtleCodec` is the use-case port adapted by server to `@beep/n3`.
- Worker protocol is Effect-Schema typed:
  - `WorkerCommand`: `parseTurtle`, `diffDatasets`
  - `WorkerResult`: `parseTurtleSucceeded`, `diffDatasetsSucceeded`

## Fixtures

Vendored fixtures live under
`packages/ontology/server/test/fixtures/` with Apache-2.0 attribution in
`packages/ontology/server/test/fixtures/README.md`.

- `ontoauthor-mat/**`: benchmark tasks, SPARQL CQs, reference Turtle, shapes
  Turtle, and task prose.
- `foaf-social-network/graph.ttl`: committed Turtle graph.
- `pizza-tutorial/README.md` and `pizza-tutorial/seed.md`: upstream pizza
  tutorial prose/seed. Upstream does not provide a standalone Pizza Turtle
  graph, so P1 round-trip proof exercises committed Turtle fixtures only.

## Dependencies Added

- `packages/drivers/n3/package.json`
  - runtime: `n3: catalog:`
  - runtime workspace deps: `@beep/rdf`, `@beep/schema`, `@beep/identity`,
    `@beep/utils`, `effect`
  - dev: `@types/n3: catalog:`, `@effect/vitest: catalog:`,
    `@types/node: catalog:`, `vitest: catalog:`, `@beep/test-utils`
- `packages/ontology/server/package.json`
  - runtime: `@beep/n3`, `@beep/ontology-use-cases`, `effect`
  - dev proof deps: `@beep/rdf-canonize`, `@beep/semantic-web`,
    `@effect/platform-node`
- Root catalog already contained `n3` (`^2.1.1`) and `@types/n3`
  (`^1.26.1`); no new root catalog version was added.

## Verification

Passed:

```sh
bun run --cwd packages/drivers/n3 check
bun run --cwd packages/ontology/domain check
bun run --cwd packages/ontology/use-cases check
bun run --cwd packages/ontology/server check
bun run --cwd packages/drivers/n3 lint
bun run --cwd packages/ontology/domain lint
bun run --cwd packages/ontology/use-cases lint
bun run --cwd packages/ontology/server lint
```

Direct N3 smoke:

```json
{"before":1,"after":1,"containsAlice":true}
```

Direct fixture round-trip proof used `@beep/rdf-canonize` via
`@beep/semantic-web/services/canonicalization` with `algorithm: "rdfc-1.0"`.
All parsed datasets serialized to Turtle, reparsed, and produced matching
fingerprints:

| Fixture | Quads | Fingerprint prefix | Match |
| --- | ---: | --- | --- |
| `foaf-social-network/graph.ttl` | 100 | `3dfb10effd480aba` | true |
| `ontoauthor-mat/t1-subsumption/reference.ttl` | 10 | `48d4d164c9078197` | true |
| `ontoauthor-mat/t1-subsumption/shapes.ttl` | 36 | `9ad6dc9863a3f605` | true |
| `ontoauthor-mat/t2-existential/reference.ttl` | 20 | `68e20ee29fb553da` | true |
| `ontoauthor-mat/t2-existential/shapes.ttl` | 34 | `45085c69d7adea31` | true |
| `ontoauthor-mat/t3-universal/reference.ttl` | 23 | `2ddbaa7d271aaa2a` | true |
| `ontoauthor-mat/t3-universal/shapes.ttl` | 33 | `445a1e70421953d8` | true |
| `ontoauthor-mat/t4-disjointness/reference.ttl` | 12 | `c882ca896b0eed0d` | true |
| `ontoauthor-mat/t4-disjointness/shapes.ttl` | 34 | `5dbdaff97e4f0ad7` | true |
| `ontoauthor-mat/t5-sameas/reference.ttl` | 11 | `bf136f268010bce8` | true |
| `ontoauthor-mat/t5-sameas/shapes.ttl` | 32 | `154f35c222066dfb` | true |
| `ontoauthor-mat/t6-unsatisfiability/reference.ttl` | 8 | `ede00ebed84753f1` | true |
| `ontoauthor-mat/t6-unsatisfiability/shapes.ttl` | 22 | `dabeba5d8e4c20a1` | true |

Blocked in sandbox:

- `bun install --offline`
  - first failed with `Unexpected accessing temporary directory`
  - with `BUN_INSTALL=/tmp/bun-install BUN_TMPDIR=/tmp/bun-install`, it
    attempted registry manifest resolution and failed under restricted network
    (`ConnectionRefused` / `FailedToOpenSocket`).
- Package-local Vitest:
  - `bun run --cwd packages/drivers/n3 test`
  - `bun run --cwd packages/ontology/domain test`
  - both failed before importing tests with
    `[vitest-pool]: Failed to start forks worker`
    and `Timeout waiting for worker to respond`.
  - Thread/vm pool experiments also failed before import; vm pool caused a Bun
    segmentation fault. Treat this as a sandbox runner issue, not a code
    assertion failure.

## Host Commands Required

Run on the host orchestrator:

```sh
bun install
bun run --cwd packages/drivers/n3 test
bun run --cwd packages/ontology/domain test
bun run --cwd packages/ontology/use-cases test
bun run --cwd packages/ontology/server test
git diff --check
```

If those pass, P1 can be marked complete and P2 can start.

## P2 Risks

- Host must refresh workspace metadata with `bun install`; sandbox verification
  used ignored local `node_modules/@beep/*` symlinks for the four new packages.
- The Turtle codec intentionally rejects non-default graph quads during Turtle
  serialization. Derived named graph partitions remain domain/session views;
  P2 should avoid treating Turtle as a named-graph persistence format.
- Pizza upstream fixture is prose/seed, not Turtle. P2 pizza authoring E2E will
  need to generate typed change operations from the tutorial rather than load a
  prebuilt Pizza graph.
- P2 should consume the P1 worker protocol as the boundary for parse/diff work
  and keep N3 IO out of client/domain code.
