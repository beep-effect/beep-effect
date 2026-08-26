# P1–P2 evidence (2026-08-25)

Branch `feat/identity-iri-fibered` off `main` `4764cdb4ba`. Implementation was
delegated to two sequential Codex lanes (GPT-5.6 Sol, reasoning effort xhigh,
`codex exec -s workspace-write`); design review, corrections, re-proofs, and
Yeet were run by the operator session.

## Lane A — `@beep/identity` + `@beep/repo-utils` (report: `p1-lane-a-report.md`)

- `Fibered.ts`: discrete kit — `S.Literals` base, per-point fibers, section
  decoded once at construction (`ConstraintDecoder` bound so the throw-on-invalid
  construction stays synchronous), thin default member
  `S.Struct({ _tag: S.tag(point), value })`, O(1) `effect/HashMap` case maps,
  `union`/`meta`/`fiberOf`/`project`/`pullback` (subset restriction reusing member
  references).
- `IdentityRegistry.ts`: `IdentityRef` (identity | iri | curie), `IdentityEntry`
  (+ `fromComposer` over a bound composer — literal projections, no
  interpolation), `IdentityNotFoundError`, `IdentityRegistryConflictError`,
  `IdentityRegistry` Context.Service, `layerLocal` over three HashMap indexes.
- `JSDocTagDefinition.make` → single-point `Fibered`; zero `JSDoc.ts` call-site
  edits; golden fingerprint harness (113 tags: AST string, encoded
  `jsDocTagMetadata`, field keys, decode→encode round trip) generated on the
  unmodified `make`, never regenerated, green after the migration. The `member`
  hook was not needed: the default thin member is byte-identical.

## Lane B — `@beep/semantic-web` + epistemic-server proof (report: `p1-lane-b-report.md`)

- `identity/IdentityRdfBinding.ts`: explicit predicate binding (identifier,
  curie, `fiberPaths`), defaults from `$SemanticWebId` literal projections, exact
  `entriesToDataset` / `datasetToEntries` codec, `IdentityFiberPathError`,
  `IdentityDatasetDecodeError`.
- `identity/IdentityRegistryDataset.ts`: `layerDataset` (dev/test store example)
  delegating to `IdentityRegistry.layerLocal`.
- `identity/IdentityShaclProjection.ts`: `IdentityShapePolicy` → `ShaclNodeShape[]`
  against the post-move contract (`services/shacl-validation.ts`).
- End-to-end: `packages/epistemic/server/test/IdentityShaclProjection.e2e.test.ts`
  with the live `BoundedShaclValidationServiceLive` — `conforms: true`, then a
  removed required-fiber quad yields `conforms: false` with a `violation` on that
  exact path.

## Operator corrections after review

- `Fibered.project`: replaced a `Reflect.set` accumulator with `Struct.pick`
  (pure; `Keys extends keyof Section["Type"]` kept as designed).
- Reverted the three `vitest.config.ts` `pool: "threads"` edits — the forks
  worker timeout is Codex-sandbox-only (receipt in `research/OPPORTUNITIES.md`).
- Rewrote the friction receipt to attribute the failure to the sandbox.
- First staged `yeet verify` failed only in `quality:lint-policy` → `lint:schema-first`:
  `IdentityRef` rebuilt as `IdentityEncoding.mapMembers(Tuple.evolve([...]))` over a
  non-exported member factory (the `ShaclValidationViolation` precedent), both
  registry errors annotated with `$I.annoteError` (fields-only equivalence), a
  schema-derived property test added to `Fibered.test.ts`
  (`S.toArbitrary(family.union)`), and the golden harness recorded as an
  intentional exception in `standards/schema-first.inventory.jsonc`.

## Re-proofs outside the sandbox (default fork pool)

| Command | Result |
| --- | --- |
| `packages/foundation/modeling/identity`: `bun run test` / `check` / `lint` | 103/103, exit 0, 25 files clean |
| `packages/tooling/library/repo-utils`: `bun run test` | 221/221 (golden included) |
| `packages/foundation/capability/semantic-web`: `bun run test` | 15/15 |
| `packages/epistemic/server`: `bun run test` | 32/32 (e2e included) |
| Lane reports: root `bun run check` | 234/234 tasks, 95 Effect rules, 874 test files |
| Lane reports: `bun run docgen:local --full` | 127/127 (identity 208 examples, repo-utils 614, semantic-web 47, epistemic-server 31) |

P2 gate: `bun run beep yeet repair` + `bun run beep yeet verify` on the staged
tree, then `yeet publish --reuse-verified` and `yeet monitor` to merge-ready
(P3). Hosted check results live on the PR.

## Acceptance criteria → evidence

- Fibered base/fibers/section + laws → `identity/test/Fibered.test.ts` (8 tests,
  property-based pullback composition, type-level totality/exclusion).
- Discrete pullback, no version/coherence machinery → `Fibered.pullback` is
  subset restriction only; no version types exist.
- Byte-identical migration → `repo-utils/test/JSDocTagDefinition.golden.test.ts`
  + `test/__golden__/jsdoc-tag-fingerprints.json` (113 entries).
- Exact `IdentityRegistry` via local Layer → `identity/test/IdentityRegistry.test.ts`.
- SHACL projection composes with the post-move contract → semantic-web tests
  (request decode + mock service) and the epistemic-server e2e.
- Store examples are test/dev Layers only → `layerDataset` over an in-memory
  `Dataset`; `SparqlQueryService` untouched.
- No P1 before blockers cleared → `p0-blocker-audit.md` (2026-08-25).

## P3 — review and hosted-gate follow-ups (PR #821)

- Greptile P1 (predicate collisions defeat the exact codec) → `IdentityRdfBinding`
  now carries the pairwise-distinct-predicates invariant as a schema check on its
  fields struct (`S.check(S.makeFilter(...))`, validated against rc.112
  `Schema.ts` Class-accepts-Struct overload); Greptile P2 → `FiberedInput.member`
  hook returns `FiberMember<Point, Fibers[Point]>`, cast removed. Report:
  `history/p3-review-fixes-report.md`.
- Hosted `Repo Sanity` → `@beep/epistemic-server` added to the changeset (test-only
  change still counts as a changed product workspace).
- Hosted `Heavy / Coverage Regression` → semantic-web's 100/100/100/100 floors
  restored with behavior-level tests (`test/IdentityRdfBindingCoverage.test.ts`,
  report `history/p3-coverage-report.md`) plus one crispening: `literalAt` now
  uses `A.match` (empty / exactly-one / duplicate arms), removing an unreachable
  `O.none` arm that no test could cover. Scoped ratchet:
  `bun run coverage -- --filter=@beep/identity --filter=@beep/semantic-web` → ok.
- Second Greptile round (P1 address cardinality vs `hasValue` under the bounded
  validator; P2 malformed `IdentityEntry.iri` defected via `makeNamedNode`; P2
  duplicate `requiredFibers`) → two property shapes per address (cardinality +
  value), `IdentityEntryIriError` from `S.decodeEffect(NamedNode)` at the codec
  and projection boundaries, uniqueness check on `requiredFibers`
  (`history/p3-review-fixes-2-report.md`).
- Hosted `Heavy / Check` (TS377112 in a test → `S.decodeResult`; a test reading
  `.fiber` on the widened error union → narrowed with `S.is`), `Heavy / Lint
  Policy` (`laws effect-imports --write`: `HashMap`/`HashSet` from the root
  `effect` import), and `Heavy / Docgen` — inherited from #820's
  `packages/tooling/tool/docgen/src/index.ts` `Version` export missing
  `@category`; fixed on touch with `@category configuration` and a
  `@beep/repo-docgen` changeset line. Local proofs after: `quality test-tsgo` 0,
  `docgen:local --full` 0, `laws effect-imports --check` 0, changeset gate ok.

