# @beep/ontology

Ontology modeling package for repo-internal foundation models.

## Boundary

`@beep/ontology` is the foundation modeling package under
`packages/foundation/modeling/ontology`. It owns domain-agnostic ontology,
identity-as-IRI, and manifested external-alignment primitives used by
repo-internal knowledge surfaces. Vendor-specific identities and alignment
decisions stay in their owning asset packs or product slices; the foundation
loader admits them through the generic `concept-alignment` protocol.

The classification registry also admits `classification-scheme` rows. The
taxonomy loader validates those rows and skips them, preserving its original
seed and alignment behavior when both runtime kinds share a manifest.

The professional-desktop ontology workbench is a separate vertical slice under
`packages/ontology/*`, with its domain entrypoint published as
`@beep/ontology-domain`. That slice edits user-supplied Turtle ontology
documents through `@beep/rdf` and `@beep/semantic-web` ports. Do not route
workbench product state, sidecar file IO, or UI concerns through this
foundation package.

## Installation

```bash
bun add @beep/ontology
```

## Usage

```ts
import { VERSION } from "@beep/ontology"
```

## Pinned classification schemes

`ClassificationRegistry` loads an explicit `{ kind, edition }` pin from an
asset manifest and vendor root using the portable Effect `FileSystem` service.
The initial asset pack pins IPC `2026.01`, CPC `2026.08` and Nice `13-2026`.
The returned snapshot exposes the pin, scheme IRI and immutable concepts.
`resolve(snapshot, pin, notation)` finds a concept, `broader` returns its
ancestor chain nearest first, and `narrower` returns its immediate children.

Patent notations are canonical without spaces, such as `A01B1/02`. Nice class
notations are `1` through `45`; basic identifiers combine a two-digit class
and four-digit source number, such as `010001`. IPC and CPC use distinct
edition-scoped IRIs even when a notation is shared. There is no latest alias.
Unknown pins, unvetted assets, path escapes and invalid hierarchies fail with
`ClassificationError`.

CPC snapshots contain symbols, hierarchy and titles only. Definitions,
notes, references and warnings are discarded at the XML boundary. Full vendor
masters remain outside the package and tracked fixtures use synthetic labels.
External mappings require an explicitly vetted alignment row.

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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/ontology` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT

## Versioned docketing and party-role vocabulary

`VocabularyRegistry` loads the committed `docketing`, `party-kinds` and
`legal-roles` schemes at version `1.0.0`. The seeds contain 25, 6 and 11
concepts, respectively. TTL, JSON-LD and TS data share stable IRIs; party
holders and contextual roles share no concept or hierarchy edge.

```ts
import { VocabularyRegistry } from "@beep/ontology/VocabularyRegistry"
import * as Effect from "effect/Effect"

const lookup = VocabularyRegistry.use((registry) =>
  registry.resolve({ kind: "docketing", version: "1.0.0" }, "StatementOfUseDeadline")
).pipe(Effect.provide(VocabularyRegistry.layer))
```

Missing versions and unknown notations return `VocabularyError`. Definitions
are descriptive; consumers own jurisdiction, authority evidence, date
computation, entities and role assignments. See the goal's
`research/2026-10-09-m3-vocabulary-contract.md` for the frozen IRI table and
deprecation rule.
