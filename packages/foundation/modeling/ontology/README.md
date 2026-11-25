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
import { ClassificationRegistry } from "@beep/ontology"
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

## Concept schemes and the asset pack

`TaxonomyLoader` reads a manifest of digest-pinned rows into a `LoadedPack`:
`ConceptScheme` values, vetted alignments, the broader-profile exceptions of
vendor schemes and verified payload bytes. `LoadedPack.schemeFor` takes an
exact `ConceptSchemePin`; there is no latest version. The legal vocabularies
(docketing, party kinds, legal roles and legal intake) live in the
`@beep/law-practice-domain` asset pack, not in this package.

## gUFO typing and mapping sets

`Gufo.ts` types a term with its gUFO class type, the category of its instances
and, for a relator, the role terms it mediates with their cardinalities.
`audit(hierarchy)(term)` reports a role with no kind above it, a rigid type
under an anti-rigid one and an undermediated relator; an untyped term yields
no finding.

`Mapping.ts` holds SSSOM mapping sets: one row per `(subject, predicate,
object)` triple, each with a semapv justification and a confidence that may be
absent with a reason. `checkMappingCoherence(hierarchy)(set)` reports
predicates that contradict over the set's SKOS closure and exact or close
matches that join terms with disjoint upper types. `Mapping.annotation.ts`
ships the repository's mapping set from the annotation structure kinds to
DoCO and NIF.
