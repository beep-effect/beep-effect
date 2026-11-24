# @beep/epistemics

Tenant-free epistemic vocabulary: evidence positions, claim records, claim gates, edge identity, contradictions and intervals.

## Installation

```bash
bun add @beep/epistemics
```

## Usage

```ts
import * as Package from "@beep/epistemics"
```

The nanopublication adapter is its own subpath, so the base package never loads `@beep/rdf`:

```ts
import { makeNanopubCodec } from "@beep/epistemics/rdf/NanopubCodec"
```

`makeNanopubCodec({ binding })` writes a checked claim record and explicit publication metadata as a four-graph
nanopublication: the head links the assertion, provenance and publication-info graphs, the assertion carries the
canonical encoded core as one `rdf:JSON` literal, and all five names derive from the `nanopub/v1` publication id.
`decode` re-mints the claim id, recomputes the publication id and compares every derived name; a foreign name is
rejected import metadata and a failed check is a refusal, both with the original input, and quads outside the
profile stay residual. `normalize` runs the same checks and then sorts and deduplicates the profile quads, so
`encode(decode(s).accepted)` and `normalize(s)` are one quad set (`test/NanopubAdapter.test.ts`).
`test/Epistemics.import-boundary.test.ts` keeps `@beep/rdf` out of every module outside `src/rdf/`.

## Development

```bash
# Build
bun run build

# Type check
bun run check

# Test
bun run test

# Integration test
bun run test:integration

# Lint
bun run lint:fix
```

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/epistemics` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
