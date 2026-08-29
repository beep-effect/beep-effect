# GOAL: Build the semantic foundation for legal intake

Repo root: the current working directory - the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: M1 ships a repo-owned SKOS taxonomy seed plus `@beep/ontology`
registry/loader so an intake librarian loop can classify a sample legal
document into a concept IRI, document class, and filing path, without adding a
graph store, SPARQL engine, or law-practice domain entities.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/semantic-foundation/README.md`
- `goals/semantic-foundation/SPEC.md`
- `goals/semantic-foundation/PLAN.md`
- `goals/semantic-foundation/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and the source exploration:
`explorations/legal-ontology-landscape/{DECISIONS.md,BRIEF.md,MAP.md}` plus
the exploration `research/` reports as they land. User-locked 2026-07-08
decisions in `SPEC.md` outrank later research until the spec is updated.

Scope:

- In: `@beep/ontology` SKOS concept-scheme/taxonomy registry models + loader;
  repo-owned M1 seed TTL/JSON-LD; concept IRIs under `https://ns.beep.sh/`
  via `@beep/identity`; FOLIO `skos:exactMatch`/`closeMatch` metadata where
  vetted; document-class vocabulary (`draft`, `redline`, `filed`, `received`,
  `privileged`, `extracted-child`); filing-path semantics for local vault +
  Box mirror; package-local tests/proof for touched target surfaces.
- Conditional: `@beep/rdf` `Vocab/*` constants only when exploration P1/P2
  research justifies them; otherwise reuse existing SKOS/RDF constants.
- Out: SPARQL engine wiring, graph store, FalkorDB, law-practice entities
  (`TrademarkAsset`, docketing entities), document-intake implementation,
  ontology-survey work beyond the scope absorbed here from
  `explorations/legal-ontology-landscape`, package source outside target
  surfaces, unmanifested third-party TTL/OWL. The old packet fence is moot;
  that packet was removed 2026-07-14.

Workflow:

1. Confirm current target surfaces with live source/barrel searches.
2. Implement M1 only; do not pull M2-M4 forward without their gates.
3. Keep vendor ontology material gitignored under the exploration asset pack;
   track only manifest/fetch metadata there and repo-owned seed data in code.
4. Add schema-first models, typed errors, and tests before broader consumers.
5. Prove the sample intake librarian loop as a fixture: document -> taxonomy
   concept -> document class -> filing path with aligned concept IRI.
6. Preserve unrelated user/worktree changes and concurrent exploration edits.
7. At P3 Close, write `history/reflections/<YYYY-MM-DD>-<agent>.md` via
   `/reflect`; `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied for M1.
- [ ] `bun run beep yeet verify` passes, or unrelated baseline failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/semantic-foundation/GOAL.md)" -le 4000
jq . goals/semantic-foundation/ops/manifest.json
git diff --check -- goals/semantic-foundation explorations/legal-ontology-landscape explorations/ATLAS.md
bun run beep yeet verify
```

Stop and report before changing public API outside target surfaces,
dependencies, lockfiles, generated files, SPARQL/graph-store topology, auth,
infra, package source outside this spec, or destructive state.
