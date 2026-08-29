# Goal

Audit or extend the implemented ontology interop roadmap in
`goals/ontology-interop-roadmap`.

Read first:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `standards/ARCHITECTURE.md`
4. `goals/README.md`
5. `goals/ontology-interop-roadmap/SPEC.md`
6. `goals/ontology-interop-roadmap/PLAN.md`
7. `goals/ontology-interop-roadmap/research/roadmap-synthesis.md`

The packet extends `goals/ontology-modeling-foundation`; inspect that packet
and live source before editing package code:

- `packages/foundation/modeling/rdf`
- `packages/foundation/modeling/ontology`
- `packages/foundation/capability/semantic-web`

Do not create a new package for v1. Keep future implementation in existing
packages:

- `@beep/rdf`: generic RDF values, vocab constants, and pure syntax utilities.
- `@beep/ontology`: opt-in SKOS profile behavior, projections, Markdown docs,
  JSON Schema sidecars, and domain-agnostic provenance hooks.
- `@beep/semantic-web`: runtime validation, reasoners, and capability services.

Implemented v1 spine:

- Add `@beep/rdf/Vocab/Skos`.
- Add opt-in SKOS concept/scheme profile metadata in `@beep/ontology`.
- Preserve current class fields and allow `rdfs:Class` plus `skos:Concept`
  only when explicitly opted in.
- Enrich JSON-LD and Turtle projections for SKOS profile fields.
- Add deterministic Markdown projection with portable links by default and an
  explicit Obsidian wikilink mode for vault/RAG workflows.
- Derive Effect Draft 2020-12 JSON Schema documents with
  `S.toJsonSchemaDocument(...)` and attach them as non-RDF sidecars.
- Add optional, domain-agnostic provenance hooks.

Defer RDF/XML, OWL XML, OWL functional syntax, TriG/N-Quads, full SHACL
validator engines, OBO bridges, HTML route suffixes, visual browsers, and
legal-specific package content.

Before changing code, read every file under
`goals/ontology-interop-roadmap/research/`. Use public `@beep/*` aliases in
package tests. Keep edits focused and preserve unrelated worktree changes.

Validation for packet docs:

```sh
jq . goals/ontology-interop-roadmap/ops/manifest.json
test "$(wc -m < goals/ontology-interop-roadmap/GOAL.md)" -le 4000
rg -n "ontology-interop-roadmap|GOAL.md|agentLaunchers|packetAnchorDocument" goals/ontology-interop-roadmap
git diff --check -- goals/ontology-interop-roadmap
```
