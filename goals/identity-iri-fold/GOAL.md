# GOAL: ship the identity-backed ontology fold

Repo root is the current `beep-effect` checkout. Use repo-relative paths.

Outcome: the shipped identity composer gains nominal `$I.key`/`$I.class`
writers; `@beep/ontology` exposes `Ontology.fold($I, ...)` assembling
schema-validated triples-as-tuples into typed, deterministic, predicate-open
ontology values with JSON-LD/context/Turtle/Markdown projections; the ratified
FOLIO annotation migrations land idempotently; shared vocab term inventories
generate from the identity registry.

Read first:

- `goals/identity-iri-fold/README.md`
- `goals/identity-iri-fold/SPEC.md`
- `goals/identity-iri-fold/PLAN.md`
- `goals/identity-iri-fold/ops/manifest.json`
- `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md`
- `AGENTS.md`, `CLAUDE.md`, and standards/skills named by the spec

Scope:

- In: composer `$I.key`/`$I.class` (identity, `ontologyTerm` channel);
  `Ontology.fold` tuple validation and predicate-open assembly with errors,
  SKOS classification marker + integrity gate; pure JSON-LD, context, Turtle,
  and Markdown projections; SemanticSchemaMetadata address layering; §8 FOLIO
  migrations; vocab term-inventory codegen; golden/rebase/negative fixtures,
  docs, tests, and evidence.
- Out: Fibered, IdentityRegistry, graph stores, SHACL, version fibers, dead
  `Ontology.create` APIs, synonym methods, inline `is:` sugar (not planned),
  enumerated SKOS profiles, runtime-computed IRIs/CURIEs, dependencies,
  unrelated packages, and `goals/INDEX.md`.

Workflow:

1. Confirm the completed-retained identity-core surface; recover the fold
   prototype from commit `61160e1baf` and merge with the assets donor;
   preserve exact composer compatibility.
2. Freeze one schema-validated tuple grammar and one diagnostics ledger.
3. Implement fold-only authoring (`Ontology.fold($I, ...)`) with propose →
   gate → record assembly; no inline `is:` channel.
4. Keep projections pure after assembly; prove inverse JSON-LD, safe Turtle
   locals/full-IRI fallback, deterministic contexts, and Markdown anchors,
   plus the rebase and negative fixtures.
5. Run the four FOLIO migrations as an idempotent sweep: borrowed identifier
   channel, inverse parent relation, dcterms, and MADS country correction.
   Add the vocab term-inventory codegen target with its `--check` gate.
6. Preserve unrelated changes; update packet evidence only from proof.
7. At P3, write a reflection and drive the PR to mergeable through Yeet.

Acceptance:

- [ ] Every `SPEC.md` criterion passes.
- [ ] Fold/projection fixtures are deterministic and typed failures are stable.
- [ ] A second FOLIO migration sweep has no diff.
- [ ] Identity shape-stability and focused package/repo proof are green.
- [ ] No Fibered/store/SHACL or unrelated churn.

Verification:

```sh
test "$(wc -m < goals/identity-iri-fold/GOAL.md)" -le 4000
jq . goals/identity-iri-fold/ops/manifest.json
git diff --check -- goals/identity-iri-fold
bun run beep yeet verify
```

Stop before changing the shipped identity-core contract, splitting authoring
into divergent validation paths, guessing an unresolved vocabulary mapping, or
expanding into the fibered packet. Done only when the PR is mergeable through
Yeet or a blocker is reported with file/command evidence.
