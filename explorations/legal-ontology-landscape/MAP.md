# Legal Ontology Landscape Map

## Candidate Goal Packets

| Goal | Mission | Dependency / sequencing | Status |
| --- | --- | --- | --- |
| [`goals/semantic-foundation`](../../goals/semantic-foundation/README.md) | Shared legal semantic substrate: repo-owned SKOS seed, FOLIO alignments, taxonomy registry/loader, gated classification/docketing/SHACL vocabulary work. | First slice. M1 starts now; M2-M4 gated by product metrics and research verdicts. | Graduated 2026-07-08. |
| [`goals/trademark-docketing-domain`](../../goals/trademark-docketing-domain/README.md) | TrademarkAsset plus docketing entities and workflows. | Deferred. Blocks on semantic-foundation M3 because it needs docketing/deadline vocabulary and enduring-party-vs-role semantics. | Deferred stub created 2026-07-08; non-executable until semantic-foundation M3. |

## Routed Work

| Work item | Route | Reason |
| --- | --- | --- |
| Taxonomy-derived vault paths and local/Box filing implementation | [`goals/legal-document-intake`](../../goals/legal-document-intake/README.md) | Existing packet owns document intake, vault onboarding, Box mirror, and taxonomy-backed placement. Semantic-foundation supplies vocabulary/registry only. |
| Concrete taxonomy-backed ClaimGate use in intake | [`goals/legal-document-intake`](../../goals/legal-document-intake/README.md) | Existing packet owns the librarian/critic/ClaimGate loop. Semantic-foundation may later author reusable shapes, but not consumer workflow code. |
| Ontology-survey scope and CPC/IPC grounding | Absorbed by [`goals/semantic-foundation`](../../goals/semantic-foundation/README.md); later annotate [`goals/ip-law-knowledge-graph`](../../goals/ip-law-knowledge-graph/README.md) in a separate task. | The older packet contains useful ontology-survey and CPC/IPC research, but its graph-store posture is no longer the foundation doctrine. Do not edit it in this graduation. |
| IP-law graph storage/runtime topology | Existing `goals/legal-document-intake` D6 projection doctrine; no new graph-store goal here. | Graph state projects into Postgres/PGlite. Dedicated graph DB or SPARQL topology needs a later explicit packet. |

## First Vertical Slice

M1 in `goals/semantic-foundation`:

1. Commit repo-owned SKOS taxonomy seed with `https://ns.beep.sh/` concept
   IRIs.
2. Add document-class vocabulary for `draft`, `redline`, `filed`, `received`,
   `privileged`, and `extracted-child`.
3. Record FOLIO `exactMatch` / `closeMatch` where vetted.
4. Add `@beep/ontology` concept-scheme/taxonomy registry models and loader.
5. Load committed seed data plus vetted gitignored vendor slices from the
   exploration asset-pack manifest.
6. Prove sample document classification to concept, document class, and filing
   path without implementing document-intake placement.

## Capability Check

- Existing repo capability: `@beep/rdf`
  (`packages/foundation/modeling/rdf/src/Vocab/Skos.ts`) already provides SKOS
  constants for `Concept`, `ConceptScheme`, hierarchy, and match predicates.
  M1 should reuse these; new constants are research-verdict-only.
- Existing repo capability: `@beep/identity`
  (`packages/foundation/modeling/identity/src/packages.ts`,
  `packages/foundation/modeling/identity/src/Vocab.ts`) already binds
  `https://ns.beep.sh/`, exposes `IdentityComposer`, and supports `mergeVocab`.
  M1 composes this instead of minting ad-hoc namespaces.
- Existing repo capability: `@beep/semantic-web`
  (`packages/foundation/capability/semantic-web/src/services/shacl-validation.ts`,
  `src/adapters/shacl-engine.ts`, `src/services/sparql-query.ts`) already has
  bounded SHACL and an unsupported SPARQL live layer. M4 authors shapes against
  the existing contract; SPARQL stays unsupported.
- Existing repo capability: `goals/legal-document-intake` already owns the
  document-intake workflow, vault, Box mirror, Postgres/PGlite projection, and
  taxonomy-backed ClaimGate consumer path.
- Existing repo capability: `goals/ip-law-knowledge-graph/research/` contains
  ontology and IPC/CPC grounding to mine as reference, but not to edit in this
  graduation.
- NET-NEW: `@beep/ontology` taxonomy registry models and loader service. The
  current package surface is FOLIO OpenAPI models only.
- NET-NEW later: `goals/trademark-docketing-domain`, gated behind M3.

## Inherited Risks

- The requested P0 exploration files were absent at graduation drafting time;
  reconcile this map when they land.
- Vendor ontology licenses and freshness must be manifest-driven before loader
  code can read any third-party slice.
- M2 classification data can become large quickly; edition tracking and
  hierarchy lookup need bounded seed decisions before implementation.
- Docketing roles are easy to confuse with durable party identity; M3 must keep
  that separation explicit.
