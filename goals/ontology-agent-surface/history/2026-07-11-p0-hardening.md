# P0 Bootstrap + Hardening Evidence

Date: 2026-07-11
Branch: `feat/ontology-agent-surface-p0-hardening`
Status: `host-verification-required`

## Summary

P0 is implemented locally. The live inventory still supports the packet's
transport, toolkit, safety, and provenance decisions. The repair generator is
now a per-constraint-component strategy registry with real `shacl-engine`
proof, and the empty Turtle prefix survives the complete session open/save
path with rdfc-1.0 fingerprint stability. ROBOT is not installed in the
sandbox, so the provided host script is the remaining P0 gate.

## Inventory Confirmation And Drift

### Nine wire-ready ontology RPCs — confirmed

`packages/ontology/use-cases/src/aggregates/Session/Session.rpc.ts` still
declares exactly nine `Rpc.make(...)` values:

1. `OpenOntologyDocument`
2. `SaveOntologyDocument`
3. `PreviewOntologyTurtle`
4. `ApplyOntologyBatch`
5. `GetOntologySnapshot`
6. `RunOntologyInference`
7. `RunOntologySparql`
8. `RunOntologyValidation`
9. `ExportOntologyProvenance`

`OntologyRpcs` remains their single group, consumed by
`packages/ontology/client/src/aggregates/Session/Session.atoms.ts`. No
additional ontology `Rpc.make(...)` declaration was found.

### MCP template and safety kit — confirmed

- `packages/drivers/m365-mcp/src/M365Tools.ts` still defines eleven
  schema-typed `Tool.make(...)` declarations and one `M365Toolkit`.
- `packages/drivers/m365-mcp/src/M365Handlers.ts` remains a thin
  `M365Toolkit.toLayer(...)` service adapter.
- `packages/drivers/m365-mcp/src/Server.ts` still composes
  `sanitizedToolkit(M365Toolkit)` with `McpServer.layerStdio(...)`.
- `packages/drivers/m365-mcp/test/Server.test.ts` still drives real MCP
  `initialize`, `tools/list`, and `tools/call` frames.
- `packages/foundation/capability/mcp-kit/src/TierGate.ts` still exports the
  fail-closed policy, verdict, audit record, dispatch result, and
  `dispatchWithTierGate` enforcement boundary.
- `packages/foundation/capability/mcp-kit/src/ToolAnnotations.ts` still exports
  the four-hint helpers, including `readOnlyToolHints` and
  `destructiveWriteToolHints`.
- No production package outside `@beep/mcp-kit` uses
  `dispatchWithTierGate` or `destructiveWriteToolHints`; P2 remains the first
  production mutation-gate precedent.

### Sidecar and authentication — confirmed with a security caveat

`apps/professional-desktop/server/main.ts` still serves Effect RPC at `/rpc`
on configurable loopback port 3939, merges the nine ontology RPCs into the
desktop group, and reserves stdin/stdout for the IPC transport.
`apps/professional-desktop/server/RpcSessionAuth.ts` still derives the redacted
`BEEP_DESKTOP_RPC_SESSION_TOKEN` and installs global bearer-token middleware.

The exploration's placement decision remains valid. The current RPC CORS
configuration uses `allowedOrigins: ["*"]`; P2 must not copy that behavior for
MCP. The new `/mcp` route must apply the SPEC's explicit Origin validation in
addition to `RpcSessionAuth`.

### PROV journal — confirmed

`packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts`
still derives a PROV-O dataset from `Session.changeLog`, creates one activity
per change, links each activity with `prov:used`,
`prov:wasGeneratedBy`, and `prov:wasAssociatedWith`, and writes separate PROV
and VoID/DCAT Turtle sidecars. Actor identity is still the fixed
`agent:workbench` IRI, so per-change authenticated actor attribution remains a
P2 entry condition rather than P0 drift.

### Main-movement reconciliation

- #365 changed older goal manifests and did not alter the inventoried runtime
  capabilities.
- #371 added the project-intelligence packet only.
- #373 changed goals-doctor/index/manifest surfaces; it did not alter ontology,
  MCP-kit, M365 MCP, or sidecar runtime code.
- #374 added legal-ontology exploration material only.
- Additional relevant drift: the workbench merge (#360) already fixed the
  low-level `@beep/n3` parser/writer path to capture the empty prefix label and
  added a codec-only default-prefix test. P0 therefore retained that live fix
  and added the missing session open/save proof instead of duplicating it.

No decision-invalidating drift was found.

## Repair Strategy Registry

Implementation:

- Shared SHACL contracts now retain `sourceConstraintComponent`, the violating
  result `value`, and property-shape `sh:class`.
- The real `@beep/shacl` adapter extracts those values from the
  `shacl-engine` report instead of discarding them.
- `Session.validation.ts` dispatches through a registry keyed by SHACL
  constraint-component IRI.
- Every candidate remains a typed `ChangeOperation` batch and passes the
  unchanged candidate-apply → revalidate → offer-only-if-cleared loop.

Implemented strategies:

| Component | Safety | Candidate |
| --- | --- | --- |
| `HasValueConstraintComponent` | additive | Add the shape-provided value. |
| `MinCountConstraintComponent` | additive, bounded | Add only a shape-provided `sh:hasValue`; never guess. Verification suppresses proposals that do not satisfy counts above one. |
| `DatatypeConstraintComponent` | corrective | For a language-free literal, remove the asserted literal and add the same lexical value with the required datatype. Invalid lexical forms are suppressed by revalidation. |
| `ClassConstraintComponent` | additive | Add `rdf:type sh:class` to the reported resource value. This is the SHACL class/range completion strategy. |

Destructive `maxCount` and value-guessing repairs remain intentionally
unsupported. Ambiguous target matching can reduce proposal recall, but the
real-engine verification gate prevents an incorrect proposal from being
offered.

Real-engine result:

```text
packages/ontology/use-cases/test/Session.validation.test.ts
3 tests passed
```

The strategy test uses `ShaclValidationServiceLive`; it exercises minCount,
datatype, and class violations through `shacl-engine`, applies each returned
proposal, and asserts the repaired graph conforms. The existing hasValue test
also remains green. The driver regression suite passed 2 tests.

## Empty/Base Prefix Fidelity

The live `@beep/n3` implementation already admits `""` as a `PrefixLabel`,
captures it from the N3 parser callback, and passes it to `Writer` alongside
named prefixes. P0 added
`packages/ontology/server/test/fixtures/base-prefix/round-trip.ttl` and a
server test that proves the complete path:

```text
fixture file -> SessionUseCases.openFile -> Session.prefixes
             -> SessionUseCases.saveFile -> persisted Turtle -> fresh parse
```

The assertion requires both the empty prefix and `schema` prefix after open
and reparse, requires both declarations in saved Turtle, and compares the
before/after rdfc-1.0 fingerprints. Result: `SessionServer.test.ts` passed all
13 tests. The lower-level `N3TurtleCodec.test.ts` passed all 4 tests.

## ROBOT Host Gate

Script:

`goals/ontology-agent-surface/ops/validate-robot-interop.sh`

It validates the base-prefix, FOAF, PROV-O, and all ontoauthor-mat Turtle
fixtures. Local `bash -n` passed. Execution returned exit 127 with
`ROBOT is required but was not found on PATH.` No install or network action was
attempted.

Host command:

```sh
goals/ontology-agent-surface/ops/validate-robot-interop.sh
```

Archive the successful transcript in this history directory before advancing
the ROBOT gate.

## P1 Toolkit And Host Placement

The architecture standard makes the canonical split explicit:

- Toolkit schemas, tool contracts, returned errors, budgets, and the
  driver-neutral stateless orchestration contract belong in
  `@beep/ontology-use-cases`, scaffolded under
  `packages/ontology/use-cases/src/tools/` and exported from a dedicated
  `@beep/ontology-use-cases/tools` subpath.
- Thin `Toolkit.toLayer(...)` handlers and MCP server/route Layer belong in the
  existing `@beep/ontology-server` adapter package, under
  `packages/ontology/server/src/tools/`. The desktop sidecar mounts that Layer
  from `apps/professional-desktop/server/main.ts`.
- Do not scaffold `packages/drivers/ontology-mcp`: `drivers/*` may not depend
  on a product slice, while `standards/ARCHITECTURE.md` explicitly assigns AI
  tool handlers and Layer composition to slice `server`.

This keeps the M365 schema-tools → thin-handlers → sanitized-server shape while
obeying the ontology slice dependency direction.

## Local Gates And Remaining Host Commands

Passed locally:

```text
node-backed Vitest:
  @beep/n3 N3TurtleCodec.test.ts                         4 passed
  @beep/shacl ShaclEngineValidation.test.ts              2 passed
  @beep/semantic-web ServicesAndSurface.test.ts           7 passed
  @beep/ontology-use-cases Session.validation.test.ts     3 passed
  @beep/ontology-server SessionServer.test.ts            13 passed

package checks/lints for semantic-web, shacl, ontology-use-cases, and
ontology-server
bun run check
bun run lint
bun run beep quality test-tsgo
bun run beep laws terse-effect --check: blocking_files=0
bun run beep quality jsdoc-inventory: openExports=0
bun run beep quality jsdoc-ratchet: increased=0
bunx syncpack lint: no issues
BUN_TMPDIR=/tmp bunx sherif@1.10.0 -r non-existent-packages: no issues
bun run beep goals index --check
bash -n goals/ontology-agent-surface/ops/validate-robot-interop.sh
```

Host-side commands remaining:

```sh
goals/ontology-agent-surface/ops/validate-robot-interop.sh
bun install
node node_modules/vitest/vitest.mjs run --config packages/drivers/n3/vitest.config.ts packages/drivers/n3/test/N3TurtleCodec.test.ts
node node_modules/vitest/vitest.mjs run --config packages/drivers/shacl/vitest.config.ts packages/drivers/shacl/test/ShaclEngineValidation.test.ts
node node_modules/vitest/vitest.mjs run --config packages/ontology/use-cases/vitest.config.ts packages/ontology/use-cases/test/Session.validation.test.ts
node node_modules/vitest/vitest.mjs run --config packages/ontology/server/vitest.config.ts packages/ontology/server/test/SessionServer.test.ts
bun run check
bun run lint
bun run beep yeet verify
```

Do not run Yeet publish or monitor from this P0 lane.

## P1 Risks

- Decide semantic-only versus semantic-plus-byte-hash CAS before freezing save
  contracts.
- Preserve the no-guess/no-destructive repair posture as the registry grows.
- Property-shape blank-node identity is not yet retained in the shared result
  contract; verification keeps this safe, but same-path ambiguous shapes may
  suppress otherwise valid proposals.
- `/mcp` streamable HTTP hosting is still net-new; Origin validation must be
  stricter than the existing RPC wildcard CORS configuration.
- TierGate has no production write consumer or persistent audit sink yet.
- Per-change actor attribution is still absent and blocks P2 mutation enablement.
- Stateless parse cost and semantic-vs-byte CAS remain later phase decisions;
  P0 added no cache or session repository.
