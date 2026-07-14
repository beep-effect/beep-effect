# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

## Candidate Goal Packets

**Lifecycle annotation (2026-07-14):** `identity-iri-core` is
**COMPLETED-RETAINED (5/5)**, satisfying the fold dependency;
[`identity-iri-fold`](../../goals/identity-iri-fold/README.md) is
**GRADUATED**; `identity-iri-fibered` is **HOLD** until the fold lands.

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `identity-iri-core` | Rewrite `@beep/identity` in place: vocab registry data + `Curie`/`Predicate`/`Expand` literal types + expand/contract + PN_LOCAL codecs + composer binding (`make({authority, prefix, vocab})`, literal `.iri`/`.curie`, projection-only `rebase`) — surface shape-stable, zero call-site changes | none | Port donors: [`scratchpad/identity/{Vocab,Curie,PnLocal,Composer}.ts`](../../scratchpad/identity/) (proven, 27/27). Preserve-exactly surface: [`research/11-audit-identity-coupling.md`](./research/11-audit-identity-coupling.md). Existing composer: `packages/foundation/modeling/identity/src/Id.ts`. Vocab source constants: `packages/foundation/modeling/rdf/src/Vocab/*`. NET-NEW: literal-type registry, codecs, IRI/CURIE getters, rebase |
| `identity-iri-fold` | Repopulate `@beep/ontology`: `$I.key`/`$I.class`/`$I.ontology` fold, `AssembledOntology` + `OntologyAssemblyError` taxonomy, JSON-LD/@context/Turtle/Markdown projections, SKOS profiles, §8 FOLIO `Ontology.models.ts` migrations (idempotent sweeps; also fixes the pre-existing cspell junk words there) | `identity-iri-core` | Port donors: [`scratchpad/identity/{Ontology,Projections}.ts`](../../scratchpad/identity/). Salvage: [`assets/ontology-prototype/`](./assets/ontology-prototype/) (projections, assembly walker, error taxonomy, test fixtures — our own dead code). Migration target: `packages/foundation/modeling/ontology/src/Ontology.models.ts`. NET-NEW: nominal entrypoints, AST datatype/object inference, Markdown projection port |
| `identity-iri-fibered` | `Fibered` kit (discrete case) + `JSDocTagDefinition.make` migration (byte-identical) + `IdentityRegistry` interface in `@beep/identity` with local layer; store layers (Oxigraph stub) + SHACL projection in `@beep/semantic-web` | `identity-iri-core`, `identity-iri-fold` | Fibration prior art: `JSDocTagDefinition.make` (`@beep/schema`). SHACL gate: `@beep/semantic-web` shacl services. Retrieval patterns (clean-room only): dxos/skygest reports in [`research/repos/`](./research/repos/). NET-NEW: `Fibered`, policy projections, `pullback`, registry service |

## Sequencing

`identity-iri-core` → `identity-iri-fold` → `identity-iri-fibered`, strictly.
Core is the dependency root (both others consume its types and composer
surface) and carries the repo-wide blast radius (every file imports
`@beep/identity`), so it merges alone with the shape-stable proof harness.
Fold unlocks the product-visible payoff (FOLIO models migrate, projections
ship). Fibered is the agent-retrieval capstone and can trail without blocking
product work. `identity-iri-core` is completed-retained;
`identity-iri-fold` graduated 2026-07-14; `identity-iri-fibered` remains held
until the fold lands.

## First Vertical Slice

`identity-iri-core` landed with every existing `$I = $PkgId.create(...)` call
site compiling unchanged, and schema authors can write
`$BeepId.create("x").iri` / `.curie` and get exact literal-typed
`https://ns.beep.sh/x` / `beep:x` under the confirmed authority, with
`"skos:prefLabl"`-style typos as compile errors. Verified by: the audit-B
shape-stable harness (existing surface pinned by tests), type-level literal
assertions, CURIE codec property tests ported from
`scratchpad/test/identity-curie-codec.test.ts`, interning-immutability tests
under `rebase`, and repo gates (`docgen`, lint, test) green for the touched
packages.

## Open Risks Inherited From The Brief

- Compile blast radius: `Curie<V>` unions × identity's import graph —
  measure `tsc --extendedDiagnostics` before/after; module-boundary the vocab
  machinery if hot (named acceptance item in core).
- Authority host resolved by the completed core: `https://ns.beep.sh/`.
- Fibered 2-cells temptation — discrete case only; versions/migrations out of
  scope (fibered packet constraint).
- General PN_LOCAL escaped-emission — acceptance-model codec + full-IRI
  fallback only (fold packet constraint).
- Inline `is:` sugar (D7) — only as strict desugaring into the fold's tuple
  grammar + diagnostics ledger (fold packet constraint).
- JSON-LD import stays bounded to our own projection dialect (fold packet
  constraint).
