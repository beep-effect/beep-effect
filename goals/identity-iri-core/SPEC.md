# Identity IRI Core Spec

## Objective

Rewrite `@beep/identity` in place so the identity path and the IRI become two
literal-typed encodings of the same value: the root composer binds
`{ authority, prefix, vocab }`, every composer derives exact-literal `.iri` /
`.curie` projections mechanically from its path, borrowed RDF vocabulary is a
CURIE literal type baked into the package (zero imports at usage sites), and
CURIE expand/contract + PN_LOCAL codecs ship alongside — with the existing
public surface shape-stable and **zero call-site changes repo-wide**.

## Non-Goals

- No `$I.key` / `$I.class` / `$I.ontology` fold, projections, or SKOS profiles
  (queued packet `identity-iri-fold`).
- No `Fibered` kit, `IdentityRegistry` service, SHACL, or store layers
  (queued packet `identity-iri-fibered`).
- No resurrection of `Ontology.create` / `createOntologyIdentity` / synonym
  methods / runtime draft sniffing (superseded
  `goals/ontology-modeling-foundation`).
- No runtime-computed IRIs or CURIEs anywhere — the interpolation ban is
  load-bearing.
- No writer-side PN_LOCAL escaped-emission (acceptance-model codec +
  full-IRI fallback only).
- No `SemanticSchemaMetadata` semantic changes in this packet; its
  `canonicalIri`/`preferredPrefix` deprecation lands with the fold packet
  unless it proves zero-risk here.
- No new dependencies for `@beep/identity` beyond its current audited set.

## Source Hierarchy

1. User objective (exploration `identity-as-iri`, graduated 2026-07-02).
2. `AGENTS.md`, `CLAUDE.md`, and required skills
   (`jsdoc-annotation-specialist`, `effect-first-development`,
   `schema-first-development`).
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Design authority (back-links, not copies):
[`identity-iri-fibration-handoff.md`](../../explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md)
(§0–§3, decisions D1–D9),
[`BRIEF.md`](../../explorations/identity-as-iri/BRIEF.md),
[`DECISIONS.md`](../../explorations/identity-as-iri/DECISIONS.md) (packaging
seam 2026-07-02: pure core in identity, runtime downstream),
[`MAP.md`](../../explorations/identity-as-iri/MAP.md).

## Target Surfaces

- `packages/foundation/modeling/identity` — the rewrite: `Id.ts` plus new
  modules (vocab registry data, `Curie`/`Predicate`/`Expand` types +
  expand/contract codec, PN_LOCAL codec, IRI/CURIE derivation).
- `packages/foundation/modeling/identity/test` — shape-stable harness,
  type-level literal tests, property tests.
- Read-only reference: `packages/foundation/modeling/rdf/src/Vocab/*`
  (registry reconciled via a drift TEST — identity must not import
  `@beep/rdf`; tests may import both).
- Port donors: `scratchpad/identity/{Vocab,Curie,PnLocal,Composer}.ts`
  (proven prototype, 27/27; adapt with house JSDoc + annotation conventions).

## Constraints

- **Shape-stable surface**: the preserve-exactly inventory in
  [`research/11-audit-identity-coupling.md`](../../explorations/identity-as-iri/research/11-audit-identity-coupling.md)
  (named imports, `make()` signature compatibility, generated-composer
  conventions, create-package codegen templates) is pinned by tests BEFORE
  the rewrite lands.
- **Zero call-site changes**: no file outside the package needs edits
  (`git diff --stat` verifiable).
- **AUTHORITY HOST is the first blocking input**: `https://ns.beep.sh/` is a
  placeholder; confirm with elpresidank before merge (`rebase`-able later,
  but the default must be right). Record the ruling in the exploration
  `DECISIONS.md`.
- **Interning immutability**: `rebase` changes only IRI/CURIE projections;
  `identifier` and interned symbols untouched (test-pinned).
- **Compile blast radius**: measure type-check cost
  (`tsc --extendedDiagnostics` or tsgo equivalent) before/after on a
  representative dependent package; if instantiation cost regresses
  materially, move the vocab machinery behind a separate module/subpath
  boundary before merge. Record the measurement in `history/`.
- Effect v4 idioms (`effect/Schema` as `S`). House JSDoc conventions on every
  export (`@example`, lowercase `@category`, `@since 0.0.0`);
  `bun run docgen:local` for loops, `bun run docgen` for the proof.
- Static-literal discipline: every identity and CURIE stays grep-harvestable.

## Acceptance Criteria

- [ ] Shape-stable harness green: audit-B named imports/signatures pinned and
      passing; create-package codegen output byte-identical.
- [ ] Zero call-site changes outside `packages/foundation/modeling/identity`.
- [ ] `make("beep", { authority, prefix }).create("x").iri/.curie` are exact
      literal types (type-level tests); `"skos:prefLabl"` is a compile error;
      `Expand<"skos:prefLabel">` is the exact IRI literal.
- [ ] CURIE expand↔contract round-trips over the ENTIRE registry (enumerated,
      plus property-based); unknown prefixes are schema errors, never silent.
- [ ] PN_LOCAL codec: parser-side acceptance model + `prefixedNameOrIri`
      full-IRI fallback; dotted/trailing-dot/slash cases from the prototype
      suite pass.
- [ ] `rebase` literal propagation + interning immutability test-pinned.
- [ ] Vocab registry drift test against `@beep/rdf/Vocab/*` constants passes.
- [ ] `annote`/`annoteSchema` records carry `iri`/`curie` fields (owned
      channel only — D9).
- [ ] Compile blast-radius measurement recorded; regression addressed or
      explicitly waived by elpresidank.
- [ ] Repo gates green for touched packages: build, check, lint, docgen, test.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/identity-iri-core/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/identity-iri-core/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/identity-iri-core` | Passes |
| Identity tests | `bunx turbo run test --filter @beep/identity` | Green |
| Docgen | `bun run docgen:local` loop → `bun run docgen` proof | Green |
| Call-site stability | `git diff --stat` limited to identity package + packet files | Passes |
| Yeet closeout | `bun run beep yeet publish --pr --message ...` → monitor | Mergeable; inherited main-red lanes documented, none introduced |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope (fold/fibered features creep).
- Authority host remains unconfirmed at merge time.
- Verification requires unnamed credentials, cost, destructive side effects,
  or policy approval.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Inherited main-red lanes (repo-configs TS2375, agents-domain test, FOLIO cspell, dead-code inventory) | repo-wide gates | elpresidank | Pre-existing on main at graduation (attribution recorded in checkpoint `61160e1baf`) | Main goes green or owning packages are fixed upstream |
