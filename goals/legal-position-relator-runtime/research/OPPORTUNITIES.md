# Opportunities & friction ledger

Receipts recorded at the moment of friction, per the repo friction-capture law.

## 2026-08-06 — P0 research

### `SourceTextResolver` port consumption has no law-practice README coupling record

- **What happened:** while verifying the foundation-mediated port-inversion shape for the
  rung-2 handoff decision, the evidence walk found that `packages/law-practice/use-cases`
  already consumes the `SourceTextResolver` port (`CandorPolicy.ports.ts:14`) with **no
  README coupling record on the law-practice side**, which
  `standards/architecture/DECISIONS.md:1117-1120` requires in both packages. The ratified
  mechanism's own record-keeping requirement is unmet for the one precedent this slice
  consumes.
- **Evidence:** [`02-handoff-shape-evidence.md`](./02-handoff-shape-evidence.md) §C4;
  `rg -n "SourceTextResolver" packages/law-practice/use-cases/README.md` returns nothing.
- **Prevention:** a lint that pairs foundation-port imports in slice packages with a README
  coupling-record mention (same spirit as `lint:promotion-records`) would have caught this
  when the candor gate landed. Fixing the missing record is a named follow-up, not this
  goal's edit — this packet must not carry unrelated refactors.

## 2026-08-06 — P1 rung 1

### `standards/schema-catalog.generated.jsonc` is stale on `main`

- **What happened:** during rung-1 schema authoring, `bun run beep lint
  schema-catalog --write` produced +6049/−280 — 768 added symbol entries
  unrelated to this branch versus 16 belonging to the new work (tracked 3764
  entries, regenerated 4496). The implementing agent reverted the regeneration:
  landing 768 unrelated entries would violate the SPEC's always-binding "No
  unrelated refactors or formatting churn".
- **Evidence:** `PracticeKgHostError` is declared at
  `apps/practice-kg-mcp/src/runtime/Host.ts:41` in HEAD yet appears zero times
  in HEAD's catalog — the staleness pre-exists this branch. `beep lint
  schema-catalog` was already red on `main` and stays red here (inherited, not
  introduced).
- **Prevention:** a CI gate (or post-merge refresh job) keeping the generated
  catalog in lockstep with `main` would stop every feature branch from
  inheriting a red catalog lane and having to prove non-attribution. The
  repo-wide refresh needs its own commit/PR; decide before P3 yeet whether to
  land it separately.

### Opus subagent died on the account session limit after writing its report

- **What happened:** the P0 handoff-evidence agent (Opus 5, per SPEC decision 3 and the
  operator's session directive) hit "You've hit your session limit · resets 9:40pm
  (America/Chicago)" and failed its final return. Its full 791-line dossier survived only
  because the orchestration contract makes agents write deliverables to disk before
  returning; the orchestrator resumed from the file with zero loss.
- **Evidence:** teammate failure notification 2026-08-06T22:57:45Z; recovered report at
  [`02-handoff-shape-evidence.md`](./02-handoff-shape-evidence.md) (scratchpad original
  written 22:57, 42,963 bytes).
- **Prevention:** the durable on-disk handoff doctrine (AGENTS.md Context Economy) is the
  prevention and it worked — worth noting that Opus-only orchestration mandates inherit a
  hard stall window when the account session limit trips mid-phase; phase plans should keep
  a main-thread-recordable paperwork lane (evidence promotion, ledger, packet updates) to
  absorb the window.

## 2026-08-06 — P1 rung 1, stage 2 (policy contract)

### Adding one in-slice concept forces a full repo-wide docgen proof

- **What happened:** the new `LegalPositionRelatorPolicy` concept needs a
  `package.json` subpath export, and `bun run beep tsconfig-sync --check`
  reports drift until the matching root `tsconfig.json` alias is added
  (`tsconfig-sync: drift detected (1 file change(s)) — tsconfig.json
  [root-aliases] aliases: add 1`). Touching root `tsconfig.json` then makes
  `bun run docgen:local` refuse the bounded proof: `full proof required:
  tsconfig.json: Global docgen or Turbo input changed` — so proving a
  four-file, one-package change costs a 130+-package `bun run docgen`.
- **Evidence:** `bun run docgen:local` output above; the alias the tool wrote
  is byte-identical to the one-line hand edit it rejected as drift.
- **Prevention:** treat the root-alias block as a per-package input rather than
  a global docgen input — the aliases are append-only, package-scoped rows, so
  a change confined to one package's rows should invalidate only that package's
  docgen task. Alternatively let `docgen:local` diff the alias block and skip
  escalation when every changed row belongs to an already-selected package.
  Every new concept in every slice pays this today.

### `S.HashSet(...)` is a declared schema, not a codec over arrays

- **What happened:** building relator fixtures, `S.decodeUnknownEffect` on a
  relator whose `admittedPlayerKinds`/`scope` axes were encoded as JSON arrays
  failed. `S.HashSet(PartyKind)` decodes only an actual `HashSet` instance
  (`decode array FAIL: SchemaError(Expected HashSet)`), and its encoded form is
  the HashSet's own `toJSON` (`{"_id":"HashSet","values":[...]}`), not an array.
- **Evidence:** two probe cycles; worse, when a `.check(...)` filter sits on the
  HashSet the failure surfaces as the *filter's* identifier
  (`Expected .../LegalRoleAdmittedPlayerKindsCheck at ["bearer"]["admittedPlayerKinds"]`)
  rather than "Expected HashSet", which points the reader at a non-emptiness
  rule when the real problem is the input shape.
- **Prevention:** this is a rung-2 hazard, not a rung-1 one. Any durable store
  or wire boundary that round-trips `LegalRole`/`LegalScopeContext` will need an
  explicit `HashSet`-from-array codec, and the migration/repo lane should decide
  that shape deliberately rather than discovering it at the first failing
  insert. A shared `S.HashSetFromArray` in `@beep/schema` would also make the
  filter-shadowed error message land on the right cause.
- **RESOLVED (rung-2 durability lane).** The predicted shared schema is what
  shipped: `packages/foundation/modeling/schema/src/HashSet.ts`, the array-backed
  sibling of the `MutableHashSet` module that already existed. The eight
  persisted `S.HashSet(...)` uses now use it, so encoded fixtures are ordinary
  JSON arrays and no boundary codec is needed anywhere. The deeper finding was
  that a boundary codec could not have worked at all — see
  "`S.HashSet` cannot be persisted at all" below.

### `packages/law-practice/use-cases/README.md` contradicts its own shipped precedent

- **What happened:** the README states "This tier owns CONTRACTS ONLY: typed
  `Context.Service` ports with no implementation bodies and no live Layers"
  (`:12-17`), but `CandorPolicy.service.ts` has shipped `makeCandorPolicy` and
  `CandorPolicyLive` since PR #575, and the SPEC directs this goal to mirror
  that file-role split exactly. A contributor following the README would write
  the opposite of what the slice's live precedent and this SPEC require.
- **Evidence:** `packages/law-practice/use-cases/README.md:12-17` against
  `packages/law-practice/use-cases/src/CandorPolicy/CandorPolicy.service.ts:245`,
  `:286`.
- **Prevention:** the README was not corrected here — a docs-only fix in this
  packet would be exactly the unrelated churn the SPEC forbids. It belongs in
  the same follow-up that adds the missing `SourceTextResolver` coupling record
  recorded above, since both are README-accuracy debt on the same file.

### A `HashSet` field cannot sit directly on a persisted entity, and only a test run says so

- **What happened:** `ActFrame.derivationKind` was authored as
  `S.HashSet(PositionDerivationKind).check(...)` directly on the entity, per the
  rung-2 brief's "S.HashSet is fine at domain tier". `bun run check` passed
  clean. The first `bun run test` then failed every suite in the package at
  import time with
  `SelectedRowFieldShapeError: Persisted selected-row field 'derivationKind'
  must encode SQL absence as null, not undefined, a missing key, or an
  ambiguous declared schema` — thrown from
  `EntitySchema.shape.ts:336` while the class was being constructed, so three
  unrelated test files reported "0 test" and "Failed Suites 3".
- **Evidence:** `packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.shape.ts:334-338`;
  the shape guard rejects any `declare`d schema because its encoded form is
  ambiguous, and `S.HashSet` is a `declareConstructor`. Nesting the set one
  level inside an `S.Class` (the shape rung 1's `LegalScopeContext` already
  has) is what makes the field's encoded shape legible again.
- **Prevention:** two cheap fixes. The error text names the storage rule but
  not the cause a reader can act on — adding "a declared schema such as
  `S.HashSet`/`S.HashMap` must be nested inside an `S.Class` to be persisted"
  would convert a probe cycle into a read. Better still, the guard runs at
  class-construction time rather than typecheck time, so a rule that `check`
  can catch would have failed in seconds instead of after a full vitest boot.
- **RESOLVED (rung-2 durability lane), and the conclusion above is superseded.**
  The guard fires because a *declared* schema has an ambiguous encoded form, not
  because sets are unpersistable. `HashSet` from `@beep/schema` is a transform
  over `S.Array`, so its encoded form is unambiguous and a field using it is
  accepted **directly on a persisted entity** — verified by probe. Nesting inside
  an `S.Class` is therefore a modelling choice from here on, not a workaround, and
  a future agent should not nest a set purely to satisfy this guard. The
  prevention note still stands: the error text should name the declared-schema
  cause, and the guard should run at typecheck time.

### `assertSchemaArbitraryDecodesToSelf` silently excludes every transforming schema

- **What happened:** `bun run beep lint schema-first` raised
  `SFV4-arbitrary-tests` against the new test file and recommended
  `S.toArbitrary(sourceSchema)` coverage. The one exported helper,
  `assertSchemaArbitraryDecodesToSelf`, feeds a Type-side arbitrary back into
  `decodeUnknownSync`, so it only works where Type and Encoded coincide. Six of
  the seven new value schemas carry `S.OptionFromNullOr` fields and failed with
  a 300KB `_tag: 'Encoding'` dump that named the class, not the mismatch.
- **Evidence:** `packages/tooling/test-kit/test-utils/src/Schema.ts:30-44`
  against `packages/law-practice/domain/test/LawPracticeDomain.test.ts:60-71`,
  which already hand-rolls a local `assertSchemaEncodedRoundTrips`
  (arbitrary -> encode -> decode -> equivalence) for exactly this reason. This
  packet's new test file now hand-rolls the same helper a second time.
- **Prevention:** export `assertSchemaEncodedRoundTrips` from `@beep/test-utils`
  beside its sibling and say in both docstrings which one fits a transforming
  schema. Every package modelling optional fields hits this, and the lint rule
  that asks for the coverage points at the helper that cannot provide it.

### The schema catalog's inherited staleness cannot be paid down incrementally

- **What happened:** this rung added roughly thirty exported schemas, so
  `bun run beep lint schema-catalog` was expected to need a regen.
  `--write` does bring the file current (entries=4531), but the resulting diff
  is **6744 insertions and 695 deletions** — orders of magnitude beyond this
  rung's own entries. Recording thirty new schemas is not separable from
  landing thousands of lines of unrelated drift, so the catalog was left stale
  and the new schemas are absent from it.
- **Evidence:** `git diff --stat -- standards/schema-catalog.generated.jsonc`
  after `bun run beep lint schema-catalog --write`, reverted immediately.
- **Prevention:** the gate is currently all-or-nothing against a file that has
  been drifting on `main`, which trains every packet to skip it and widens the
  gap further. Either land one dedicated regen PR and keep the gate required
  from then on, or teach the linter to compare only the entries a branch's
  changed files own so a packet can record its own schemas without adopting the
  backlog.

### `S.HashSet` cannot be persisted at all, and only a runtime probe says so

Supersedes and explains the two earlier HashSet receipts above; this is the root
cause both of them were circling.

- **What happened:** the rung-2 durability lane found that a jsonb column
  holding an `effect/Schema` `HashSet` round-trips through **neither**
  direction. `S.HashSet(V)` has `Encoded = HashSet<V.Encoded>`, so
  `S.encodeResult(Entity)` leaves a live set in the column value and the driver
  serializes it as Effect's tagged `{"_id":"HashSet","values":[...]}` form;
  `S.decodeUnknownResult(Entity)` then rejects that wrapper (its declaration
  decoder requires `HashSet.isHashSet`) **and** rejects a plain array. Worse,
  `EntityTable.pgTableFrom` types the column from `Encoded`, so
  `$inferInsert["scope"]` is declared as a `HashSet` — the type system asserts a
  shape the database can never return. `bun run check` was green throughout;
  only encoding a real entity and reading the value back surfaced it.
- **Evidence:** `.repos/effect/packages/effect/src/Schema.ts:11341-11421`
  (`Encoded` is the set, the decoder is `isHashSet`-gated, the array form lives
  behind a `toCodec` link that plain encode/decode never takes);
  `packages/drivers/drizzle/src/EntityTable.models.ts:308`, `:322-327` (jsonb is
  a bare `jsonb(columnName)` typed by `S.Codec.Encoded<Field>`, with no driver
  codec). A boundary-only fix does not exist: `S.toCodecJson` produces the right
  values but its `Encoded` is `Json`, which is not assignable to the
  HashSet-typed insert row without a cast that would leave the column type
  lying.
- **Prevention:** `@beep/schema` already shipped `MutableHashSet.ts`, the
  array-backed set schema, but had no immutable sibling — so the schema agents
  reached for `effect/Schema`'s `HashSet`, which is the *from-self* validator.
  This packet added `packages/foundation/modeling/schema/src/HashSet.ts`
  mirroring it and swapped the eight persisted uses. The mirror is deliberately
  smaller than its sibling: `MutableHashSet.ts` hand-rolls an iso type, a
  from-self schema, and a guard because `effect/Schema` has no `MutableHashSet`
  support at all, whereas for `HashSet` upstream already ships `S.HashSet`,
  `S.HashSetIso`, and `HashSet.isHashSet` — only the array-backed transform was
  missing. The general fix is a lint
  rule: a field reachable from a `persist.jsonb` descriptor must have a
  JSON-representable encoded side, which would have failed at `check` time
  instead of at the first row read. The pairing is also worth a docstring on
  both modules — "`S.HashSet` to validate a value in hand, `@beep/schema`'s to
  store one" — because the two names differ by import path alone.

### `docgen:local` escalates to a full repo docgen whenever a package gains an exports subpath

- **What happened:** three new concept directories needed `exports` entries, so
  `bun run beep tsconfig-sync` rewrote the root `tsconfig.json` aliases (+7,
  then +1). `bun run docgen:local` then refused its bounded run —
  "full proof required: tsconfig.json: Global docgen or Turbo input changed" —
  and demanded the repo-wide `bun run docgen`, even though the six selected
  packages were exactly the ones the branch touched. The full run took **288s**
  wall and passed; the bounded run would have covered six packages.
- **Evidence:** `docgen:local plan` output naming `mode: full-required` with the
  correct six-package selection immediately above the refusal.
- **Prevention:** an alias addition is append-only and cannot invalidate the
  docs of a package whose alias set did not change. Treat a root-tsconfig diff
  that only **adds** `paths` entries as non-invalidating, or scope the
  invalidation to the packages whose own aliases moved. As it stands, every
  packet that adds a subpath — the normal way to ship a new concept — pays a
  full-repo docgen, which is the slowest gate in the loop.

### A db-admin migration silently breaks a gate in `apps/professional-desktop`

- **What happened:** generating the rung-2 delta migration left
  `apps/professional-desktop`'s `codegen:check` red —
  `StaleMigrationBundle: Professional Desktop migration bundle is stale` — because
  `src/runtime/Migrations.gen.ts` embeds every `drizzle/*/migration.sql` verbatim
  for the compiled sidecar. Nothing in the db-admin package signals this: its own
  `check` (tsgo + `migrations:check`) is green with the bundle stale, and the
  desktop app is outside the migration author's scope. The obligation is recorded
  only in prose, in `packages/_internal/db-admin/AGENTS.md`, so an agent scoped to
  db-admin who does not read that file ships a red required check.
- **Evidence:** `bun run --cwd apps/professional-desktop codegen:check` failing at
  `scripts/sync-migration-bundle.ts:121` immediately after
  `bun run --cwd packages/_internal/db-admin check` passed; the fix is a purely
  mechanical +169-line append to `Migrations.gen.ts`.
- **Prevention:** the sync is derivable, so it should not be a human step at all —
  either chain `codegen` into db-admin's own `generate` script, or add the
  bundle-drift assertion to db-admin's `migrations:check` so the failure surfaces
  in the package that caused it. Failing that, name the desktop re-sync in the
  migration scope line of any packet that generates SQL.

### drizzle-kit's generated `snapshot.json` does not satisfy `biome check`

- **What happened:** `bun run generate` emitted a snapshot that failed the
  package's own `lint` on formatting alone (single-element arrays expanded across
  three lines where biome wants `"columns": ["id"]`), roughly 50 hunks in a
  178KB generated file. `check` passes in that state because `migrations:check`
  reads the snapshot semantically, so the ordering `generate → check → lint`
  reports green then red on an artifact no human wrote.
- **Evidence:** `bun run lint` reporting `Found 1 error` with a diff of
  `"columns": [\n "id"\n ]` versus `"columns": ["id"]` in
  `drizzle/20260807061034_law_practice_legal_position/snapshot.json`; the shipped
  candor snapshot carries the biome-formatted shape, so the previous author paid
  the same tax.
- **Prevention:** either add `drizzle/**/snapshot.json` to biome's ignore list
  (nobody reviews a 178KB generated snapshot's whitespace) or run the formatter
  from the `generate` script so the artifact lands formatted. As it stands every
  migration author must know to run `lint:fix` on a file they did not write.
