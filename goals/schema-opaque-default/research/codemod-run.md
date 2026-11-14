# Codemod run: branded S.Opaque default (2026-10-14)

Worktree `beep-effect3-worktrees/schema-opaque-default`, branch
`feat/schema-opaque-default` on `origin/main` c32831f287, `@effect/tsgo` 0.51.1,
effect 4.0.2. Contract: `SPEC.md` D1-D8. Tool: `ops/codemod/` (README there).
Nothing is committed.

## Tooling delivered

| File | Role |
| --- | --- |
| `ops/codemod/run.ts` | Phase A CLI: discovery, IO, Biome `check --write` (format + organize imports), `--check`, `--reverse`, `--paths`, `--report`. |
| `ops/codemod/codemod.ts` | Pure core: AST index, cross-file keep-class analysis, transforms, identity normalization, JSDoc `new X(` rewrite, class index. |
| `ops/codemod/fixup.ts` | Phase B: diagnostics-driven consumer fix-up (`X.make(...)` wraps, imports, exports, `make({})`, `typeof` annotations, TS2527 hidden-class exports). |
| `ops/codemod/codemod.test.ts` | 23 fixture tests (`bun test goals/schema-opaque-default/ops/codemod`): 23 pass. |
| `ops/codemod/keep-class.jsonc` | 123 durable entries: 26 keep-as-class, 97 structural-brand overrides (see below). |

Idempotence: `bun run goals/schema-opaque-default/ops/codemod/run.ts --check`
reports `changedFiles: 0` on the final tree.

## Counts (codemod over the `HEAD` sources with the final keep-class list)

7,737 files scanned (nested fixture projects excluded), 8,048 schema-class
declarations, 1,776 files rewritten by the codemod.

| Kind | Outcome | Count |
| --- | --- | ---: |
| `S.Class` | converted to `S.Opaque` over `S.Struct` | 5,385 |
| `S.TaggedClass` | converted to `S.Opaque` over `S.TaggedStruct` | 370 |
| `S.Class` | kept, brand added | 457 |
| `S.TaggedClass` | kept, brand added | 51 |
| `S.TaggedError` | brand added | 1,052 |
| `S.Opaque` (pre-existing) | brand added | 116 |
| `S.Error` | none in the tree | 0 |
| `S.Class` / `S.TaggedClass` in generated files | branded by their generators (below) | 472 / 145 |

Per top-level family (Class to Opaque / TaggedClass to Opaque / brand added / generated):

| Family | Class to Opaque | TaggedClass to Opaque | Brand added | Generated |
| --- | ---: | ---: | ---: | ---: |
| packages/tooling | 2,319 | 150 | 352 | 7 |
| scratchpad | 263 | 39 | 823 | 0 |
| packages/foundation | 701 | 109 | 183 | 154 |
| packages/drivers | 819 | 48 | 113 | 456 |
| apps | 393 | 1 | 71 | 0 |
| packages/law-practice | 407 | 21 | 23 | 0 |
| packages/ontology | 86 | 0 | 17 | 0 |
| packages/epistemic | 73 | 0 | 22 | 0 |
| packages/agents | 69 | 2 | 10 | 0 |
| packages/documents | 53 | 0 | 21 | 0 |
| explorations | 64 | 0 | 3 | 0 |
| goals | 57 | 0 | 4 | 0 |
| packages/architecture-lab | 21 | 0 | 16 | 0 |
| infra | 27 | 0 | 2 | 0 |
| packages/workspace | 19 | 0 | 10 | 0 |
| packages/shared | 13 | 0 | 3 | 0 |
| packages/_internal | 1 | 0 | 2 | 0 |
| packages/ecosystem | 0 | 0 | 1 | 0 |

### Keep-class reasons histogram (a declaration can carry several)

| Reason | Count |
| --- | ---: |
| effected-port (D6: `scratchpad/effected/` plus the upstream tests copied to `scratchpad/test/<module>`) | 337 |
| instance-member | 172 |
| extend-root | 33 |
| keep-class-allowlist | 26 |
| fields-expression-unknown | 18 |
| instanceof (`instanceof` or `S.instanceOf`) | 14 |
| tag-field (non-literal `_tag` field) | 11 |
| declaration-hooks (`to*` Declaration hooks in the annotation) | 9 |
| new-site | 3 |
| subclassed | 2 |
| static-super (a static member reads `super`, below) | 1 |

### `new X(` sites (classes kept as class because of them)

- `explorations/beep-ci-operational-ontology/.../golden/typescript/input.ts:27` `GoldenTicket` (also has instance members)
- `scratchpad/test/jsonl/merge.test.ts:124,134` `Payload`
- `apps/labs/api-docs/src/Catalog.ts:32,40,48,56,64,76,88,100,112` `CatalogEntry` (declared in `scratchpad/effected`, brand-only by D6)

`static-super`: infra/src/OipWeb.ts (removed in #3341) `OipPulumiStateBackendConfig` overrides
`static make` and calls `super.make`. Schema objects memoize `make`,
`makeEffect` and `makeOption` through prototype getters that
`defineProperty` onto `this`, so on an `S.Opaque` the first `super.make` call
replaces the override with the base parser and every later call skips it (the
derived `lockTableName` default vanished; `@beep/infra` test). The codemod now
keeps such classes as branded classes and reverses an existing Opaque that has
one.

No converted class is `new`-ed in code. JSDoc examples that did so were
rewritten to `X.make(` by the codemod (13 files) and by the docgen lanes.

### Generated code (D4 for generated files)

Brand-only, no Opaque conversion: the generators now emit
`S.Class<X, { readonly brand: unique symbol }>` / `S.TaggedClass<...>`, which
keeps every generated consumer shape (`.extend` chains in Box, recursive HTML
nodes) unchanged.

| Generator | Output | Branded declarations | How the output was refreshed |
| --- | --- | ---: | --- |
| `packages/drivers/box/scripts/generate.ts` | `src/_generated/Box.models.gen.ts` | 418 | regenerated offline from the installed Box SDK (`bun run --cwd packages/drivers/box generate`); `Box.operations.gen.ts` only differed by two blank lines (pre-existing drift) and was left at HEAD |
| `packages/drivers/runpod/scripts/operations.renderer.ts` | `src/_generated/Runpod.operations.gen.ts` | 39 | regenerated offline from the committed `openapi.json`; `generate:check` passes |
| `packages/foundation/modeling/html/scripts/generate.ts` | `src/Html.model.ts`, `src/Html.meta.ts` | 145 + 9 | regenerated offline from the vendored `data/` |
| `packages/tooling/library/ai-sync/src/generator.ts` | `src/_generated/schemas.gen.ts` | 7 | generator fetches its sources over the network, so the output was patched exactly as the new template emits it (brand + `.make` in the nested JSDoc examples) |
| `packages/tooling/library/codegen-kit/src/internal/postProcess.ts` | class-style outputs of codegen-kit users | template only | no committed output uses the class style; `CodegenKit.test.ts` expectation updated |

`apps/professional-desktop/scripts/sync-migration-bundle.ts` now emits
`MigrationBundleEntry.make({...})`; its regenerated `Migrations.gen.ts` is
byte-identical to the tree.

### Brand overrides (documented D4 exceptions)

All recorded with a measured reason in `keep-class.jsonc`. 168 schema-class
declarations carry the structural `{}` brand (`brand: "structural"`, counted
over the tree's ASTs, none in tests); none was chosen by the codemod on its own.

| Group | Declarations | Why `{}` |
| --- | ---: | --- |
| Recursive Markdown / Pandoc / Lexical ASTs, law-practice `Citation` and `PinciteInfo` (`"class": "*"` entries) | 76 | children decode through `S.suspend((): S.Codec<Inline.Type, ...>)` with hand-written namespace `Type`s; a unique-symbol brand makes every consumer passing `node.children` to a class-union function fail (38 sites in `Lexical.codec.ts` alone), and pointing the namespace unions at the classes makes the base types circular (TS2506 `Li`, TS7022 `ListItemChild`, TS2310 `PinciteInfo`). `Md.model.ts` `Heading` is one of these. |
| nlp `SpanFields` (private, kept class) | 1 | built from plain `{ start, end }` literals across langextract, file-processing, law-practice and semantica, and not nameable outside nlp. |
| `apps/professional-desktop/src/intake/DocumentIntake.models.ts` | 31 | @xstate/effect maps and intersects every data schema reachable from the exported `documentIntakeMachine` / `intakeBatchMachine`, exposing the anonymous `brand: unique symbol` property, which declaration emit cannot name (docgen TS2527). Structural brands on the 16 context/input/output schemas alone did not clear it; all 31 data schemas do. The two TaggedErrors stay branded. |
| `scratchpad/effected` mdast (`MarkdownNode.ts`, 36), TOML AST (`TomlNode.ts`, 13; `TomlDateTime.ts`, 4) | 53 | verbatim port (D6) whose recursive codecs are typed `S.Codec<Node, Node>`; a unique-symbol brand breaks that encoded-side spelling (docgen TS2322 on every recursive union). |
| `scratchpad/effected/tsconfig-json` `PortableTsconfig`, `ResolvedTsconfig` (already `S.Opaque<X>()` at HEAD) | 2 | verbatim port (D6). `PortableTsconfig`'s `static make` override builds the projection as an object literal; a unique-symbol brand forced the fix-up to route it through `PortableTsconfig.make`, the override itself (infinite recursion, 28 tsconfig-json tests). The extends resolver and loader return `ResolvedTsconfig` literals carrying unknown passthrough keys, which `make` drops. |
| chalk `Chalk*ColorState` x4, `BuilderMeta` (kept classes) | 5 | the builder state is one mutable plain object shared by reference; branded `make()` construction yields instances that do not propagate `level` (chalk test). Restores the HEAD plain-object state. |

`{ readonly nominal: unique symbol }` (automatic, not an exception): the 4
schemas whose fields include a `brand` key (`EntityId` x2, `Brand.schema`,
chalk `SupportsColor.browser`), where `brand: unique symbol` would intersect
the field to `never`.

No other `{}` brand argument exists on a schema-class declaration; the two
remaining `, {}>` matches are source strings in the D8 lint tests.

### Keep-as-class allowlist (26)

`TSConfig` (instanceof + excess-property message in tests); ontology
`IpcEntry` / `CpcEntry` and runpod `JsonSchema` (self-recursive
`S.Codec<Self, ...>`); chalk's 4 states + `BuilderMeta` (shared mutable state);
the 15 `TransformationLedgerRecord` members in `Restoration.schemas.ts`
(corpus clone-boundary tests model `S.is` rejecting `structuredClone` copies;
follow-up: rewrite that verdict model); Box `BoxApiFailureContext` /
`BoxApiFailureConflict` (as Opaque their struct types expand inside `BoxError`
and push `box#build` past tsgo 0.51.1's declaration-mode instantiation depth:
location-less TS2589 plus 8 `unknown` field errors in `Box.errors.ts`; 0 errors
as classes across 4 runs).

## Fix-up summary

- `fixup.ts` over rounds of `turbo run check --continue` + `quality test-tsgo`
  (and package-scoped logs): about 1,300 automated fixes. `X.make(...)` wraps
  with property-path, array and arrow-body navigation; value imports added or
  promoted from type-only imports (export maps honoured, `"./x/*": null`
  exclusions respected, package tests use `@beep/*` / test-kit barrels);
  `X.make()` to `X.make({})`; `export const A: typeof B = B` and hidden-class
  exports for TS2527 (about 300 previously private classes exported with a JSDoc
  built from their annotation description).
- Guards added after early-round defects (each fixed in the tree too):
  duplicate `export` on classes already in an `export { }` list; overlapping
  type-import promotions; names shadowed by external imports (`P` from
  `effect/Predicate`); non-schema targets (`SyncDataTarget`); one union member's
  `make` used for a dynamic discriminant (chalk `level`, `VersionSyncOptions`,
  `TsconfigSyncRunOptions`, `OperationCost`, pacer `environment`); nested
  `X.make(X.make(...))`; relative `src/` imports in package tests; `| undefined`
  targets; brand-literal targets resolved to the enclosing class.
- Manual consumer edits (five check lanes, four docgen lanes, this session,
  about 900 diagnostics in all): union-schema `.make` or spreads for dynamic
  discriminants; parameters widened to `typeof X.Encoded` /
  `S.Struct.Type<typeof X.fields>` where a function only reads the plain shape
  (for example `resolveBrowserHttpUrl`, epistemic `BrowserHttpRuntime`, so no
  `make(globalThis.window)` runs at import time); xstate state contexts built
  with `make`; `instanceof` test assertions replaced by `S.is(X)`; round-trip
  tests compare against `X.make(original)` (Arbitrary values have a null
  prototype); identity assertions moved to value equality where `make` copies;
  JSDoc examples construct with `X.make(...)`.
- Codemod refinements from the waves: `_tag: S.tag/S.Literal` fields promote to
  `S.TaggedStruct`; Struct sources followed through `.check`/`.annotate`
  chains, local consts and relative imports; comments in rewritten spans kept;
  a module identity composer turns string identifiers into
  `.pipe($I.annoteSchema("ClassName", ...))` (and normalizes existing
  forward-shaped `.annotate({ identifier })` Opaques), as the D8 lint requires;
  nested fixture projects are out of scope; brand overrides via
  `keep-class.jsonc`.
- After the D8 lint pass: `SyncDataToTs.command.ts` gained its module composer
  (`$RepoCliId.create("commands/SyncDataToTs/SyncDataToTs.command")`) and
  `SyncDataTargetSelection` now uses `$I.annoteSchema`; Biome import organizing
  ran over every touched file (148 files reordered; a follow-up
  `biome check --linter-enabled=false --formatter-enabled=false` over the touched
  set reports no fixes).

## Verification (final tree)

- `run.ts --check`: 0 files would change. Codemod tests: 23 pass.
- `beep-heavy bun run check`: **exit 0, 0 TS errors** (`--filter=!./apps/labs/**`,
  as the repo script runs it). A `turbo run check --continue` round reported 0
  errors across the graph (plus `quality test-tsgo`: 0).
- `beep-heavy bun run lint:package-test-typecheck`: **exit 0**
  (`current=1 baseline=1 introduced=0`).
- Docgen: `bun run docgen:local` refuses the bounded run because docgen tooling
  changed (`full docgen proof required; re-run with "--full"`), so the full
  graph was run instead: `turbo run docgen --continue`: **140/140 tasks
  successful, exit 0**.
- Package tests (all green): @beep/schema 484, @beep/identity 116,
  @beep/repo-utils 238, @beep/effect-drizzle 98, @beep/box 53,
  @beep/box-provisioning 250, @beep/runpod 10, @beep/html 196, @beep/ai-sync 29,
  @beep/codegen-kit 16, @beep/chalk 28, @beep/agents-client 23,
  @beep/repo-cli 5,973 (`sync-data-to-ts` 31 re-run after the composer change).
- Repo-wide unit sweep (`beep-heavy bunx turbo run test --continue
  --filter=!./apps/labs/**`, 146 tasks): 130 green on the first pass, 16
  packages red, all attributed to the conversion and fixed:
  - `toBeInstanceOf(X)` / `assertInstanceOf` on converted classes became
    `S.is(X)` assertions (36 sites in 15 files, plus `ApprovalRecord`);
  - identity `toBe` on values `make` now copies became `toStrictEqual` (md
    conformance, skill-contract `EvidenceLadder`, agents-use-cases
    `ProviderInstance`); Arbitrary round trips compare against `X.make(value)`
    (practice-kg-mcp self-check lines);
  - JSON Schema `$defs` names lose the class `Encoded` suffix
    (`.../AssistantContent` instead of `...AssistantContentEncoded`):
    agents-domain regex updated;
  - ontology-client: a `structuredClone`d projection now passes `S.is`; the
    worker-wire test asserts that and keeps decoding as the contract;
  - infra: the `static-super` hazard above;
  - epistemic-tables: the fix-up had wrapped `hasValidSeals`' content, pair and
    match basis in `make`, which throws on the tampered candidates the function
    exists to reject. `contradictionCandidateDigest`, `contradictionCandidateKey`
    and `canonicalizeContradiction` now take the plain struct shapes
    (`S.Struct.Type<typeof X.fields>`), and `hasValidSeals` passes the HEAD
    literals again (a failed seal is a `Result` again, not a throw);
  - professional-desktop: `MentionSource` returns `typeof MentionOption.Encoded`
    (the composer decodes it, as its docs say), so the late-getter mention test
    passes plain candidates as at HEAD.
  Re-run of the 18 affected packages: **18/18 green**.
- Scratchpad suites (outside turbo `test`): every effected module through the
  runner's own command (`EFFECTED_MODULE=<m> bunx --no-install vitest run
  --config scratchpad/vitest.effected.config.ts`), 30 modules, all green after
  two fixes: the port's copied tests had been converted (config-file `AppShape`,
  jsonl `Boxed` "inherits from a Schema.Class payload"; 17 classes in all), so the
  codemod's `effected-port` scope now covers `scratchpad/test/<module>` and
  those files are brand-only again; and the two `tsconfig-json` structural
  brands above. `scratchpad/vitest.config.ts` (beep + identity tests): 590 pass.
  `test:effect-ontology`: 3 failures (`PublicSchemas` arbitrary `Exhausted`,
  `BatchStateEventBus` SQL `column "completed" does not exist`,
  `GroundingProvenance`), identical on a `HEAD` copy of `effect-ontology`:
  inherited.
- Final re-runs after these fixes: `bun run check` exit 0 (265/265),
  `lint:package-test-typecheck` exit 0, `turbo run docgen` for the packages whose
  exports changed (editor, epistemic-domain, scratchpad, infra,
  professional-desktop, ontology-client) 6/6.

## Residuals

- 168 structural `{}` brands (table above) need the D8 schema-first inventory
  kind; the two `tsconfig-json` entries are new since the D8 inventory pass.
- The D8 `plain-data-schema-class` kind skips `scratchpad/effected/**` only; the
  port's copied tests under `scratchpad/test/<module>` now keep 17 plain-data
  branded `S.Class` declarations (D6), which that kind will flag unless its scope
  matches the codemod's.
- `box#build` sits close to tsgo 0.51.1's declaration-mode instantiation
  limit: at HEAD this workstation already reports one location-less TS2589 for
  it under the default checker partition (`--checkers 1` and the JS `tsc` 6.0.3
  report none). The two Box keep-class entries keep it at 0 here; a heavier
  Box type or a different CPU/partition on CI can tip it again.
- `apps/labs/**` is outside `bun run check` and was not typechecked.
- Not run: `bun run lint` (the D8 lane owns the schema-first and `$I.annote`
  changes). Other converted modules that use `.annotate({ identifier })`
  without a module composer (mostly tests, plus lint-rules `utils.ts` /
  `index.ts`, `ContradictionQaSeed.ts`, `sync-migration-bundle.ts`) keep that
  spelling; adding a composer there turns them into `$I.annoteSchema` on the next
  codemod run.
- Fix-up `make` wraps validate: where a function takes possibly invalid input
  and is meant to report it (seal checks, projections), a wrap turns a `Result`
  failure or a passthrough into a throw or a dropped key. The sweep found two
  (epistemic seals, tsconfig-json); untested paths may hide more.
- Behaviour changes to review: values that used to be unvalidated object
  literals now pass through `make` (it validates and throws on invalid input;
  for example exiftool/ffmpeg `ProcessResult` with a negative exit code becomes
  a defect); `S.Opaque` `make` copies nested struct fields, so object identity is
  not preserved; `.annotate` / `.annotateKey` on an Opaque returns the plain
  struct type (brand dropped); Opaque values are plain objects, so
  `structuredClone`d values pass `S.is` and instances lose `toString()`;
  identifiers changed where the identity composer replaced a string identifier
  (`SyncDataTargetSelection`, agents-client `SendTurnRequest` /
  `EditTurnRequest`, and every class converted with a composer but a string ID:
  `$I/<ClassName>` instead of the bare string); JSON Schema `$defs` keys for
  converted classes drop the `Encoded` suffix.

## Post-merge integration pass (HEAD fb660d9a11: 93091da833 + origin/main 9b433fe738, `-X theirs`)

Logs live in the session scratchpad (not committed); each step is appended here as it finishes.

1. **Install + re-run.** `bun install --frozen-lockfile` (5 packages added). `run.ts` on the
   merged tree converted 74 `S.Class` and 2 `S.TaggedClass` to Opaque and branded 11 more
   (24 files), but its Biome step reported a parse error in
   `pdf-tools/src/PdfTools.models.ts`: the `-X theirs` merge had already spliced main's old
   `S.Class` tail (`}, $I.annote(...)) {}`) onto the lane's Opaque head of
   `SvgToPdfRequest`, and the rewrite landed on that broken span. A three-way `git merge-file`
   over the 156 TS files both sides touched found 17 with conflicting hunks (Atlas.ts 4,
   technical-drawing Geometry/Validation/Sheet/Manifest/FigureSet, ProcessTable,
   Worktree/Ocr/Sweep/Skills schemas, Drawings.judge, ai-sync schemas, MailTagging
   correspondents, effected GitBranch and packedInstallPlan, PdfTools). Those 17 were reset to
   main's version and the codemod re-run (D7): 113 more `S.Class` converted, 5 branded.
   `run.ts --check`: 0 changes.
2. **Fix-up.** `turbo run check --continue`: 24 errors (technical-drawing `ModelSpec` x3,
   repo-cli Drawings intake/review, md `MarkdownConformanceError` TS2527). `fixup.ts`: 8
   fixed, 10 Md conformance issue classes exported for TS2527, 3 manual. Manual:
   `Drawings.review.ts` `decodeJson`/`readJson`/`checked` take `S.ConstraintCodec<A, I>`
   (inferring `A` from `S.Codec<A, I>` picks an Opaque's struct type through `Rebuild`), and
   the guard builds `ReviewRound.make(status.round)` (`ReviewStatus.round` is an
   `annotateKey`-ed field, so its brand is dropped). Test fix-up: 7 `ReviewRound.make` wraps in
   `drawings-review.test.ts`.
   `beep-heavy bun run check`: **exit 0** (266/266). `lint:package-test-typecheck`: **exit 0**
   (current=1 baseline=1 introduced=0).
3. **Lints.** `lint schema-first`: the merge took main's side of the inventory and dropped 7
   rows (6 openclaw tag-field classes, runpod `JsonSchema`), and 2 `ProcessTable` advisory rows
   went stale by a line shift. Re-synced with the inventory flow (reasons from
   `keep-class.jsonc` and the codemod's tag-field/fields-unknown classes; advisory reasons
   carried by file+symbol+ruleId from the lane, merged and main inventories): **exit 0**, 0
   candidate rows, missing=0, stale=0. `lint effect-vitest`: **exit 0** (introduced=0).
4. **Cheap gates.** `yeet verify --tier cheap-gates --detach` (job c860ecd6): red on
   `quality:knip` and `fallow:audit`.
   - knip: md switched to `tsc-rs` on main, whose declaration emit raised TS2527 on
     `MarkdownConformanceError`. The fix-up exported the 10 private issue classes in
     `internal/conformance/Md.semantic-inspector.ts`, which knip then flagged as unused
     exports. Fixed by re-exporting them from the public `Md.conformance.ts` export block
     (they are the members of the already-public `MarkdownConformanceIssue` union):
     `quality knip` ok, current=42 baseline=42.
   - fallow audit: 1 "introduced" complexity finding,
     `Goals/Doctor.ts printNonFatalFindings`. origin/main moved 3 commits past the merged
     9b433fe738 (now 514a850903), and #1688/#1699 rewrote that function on main; the branch
     still carries the 9b433fe738 version, so a diff against the moved `origin/main` reads
     main's old code as introduced. Attribution: stale base, not this change.
     `quality fallow audit --check --base 9b433fe738`: **ok, 0 introduced** (140 inherited).
   Re-run (job da754c28, `--base 9b433fe738`, which the fallow lane does not honour): every
   lane green except the same `fallow:audit` stale-base finding. Clears once `origin/main` is
   merged again.
5. **Final re-check after the knip fix.** `run.ts --check`: 0. `beep-heavy bun run check`:
   **exit 0** (266/266). `lint:package-test-typecheck`: **exit 0**. `docgen:local` refuses the
   bounded run (docgen tooling changed on main: `Doctest.errors.ts`), so the full proof ran:
   `bun run docgen` **140/140**.

## Second merge (S25 wrap-up): origin/main a92a648c86 into 2b4dd6575a

6. **Merge + re-run.** `git merge -X theirs origin/main` (11 commits, including #1700's Effect
   module-path rewrite) → 0766364f1b. Three-way `git merge-file` over the 33 files both sides
   touched since 9b433fe738: 10 TS files with conflicting hunks (Yeet `MergeGate.ts` 5,
   `yeet-merge-gate.test.ts` 6, `SkillsLock.schemas.ts` 3, `Yeet.schemas.ts`, `ReadyGate.ts`,
   `Graduate.schemas.ts`, technical-drawing `Sheet`/`Manifest`/`Geometry` schemas and
   `FigureSet.service.ts`), reset to main's version. `bun install --frozen-lockfile`, then
   `run.ts`: 95 `S.Class` + 10 `S.TaggedClass` converted to Opaque, 5 branded, 16 files, no
   Biome parse errors. `run.ts --check`: 0. `laws retired-effect-paths`: 0 findings over
   39,579 files (the codemod, fix-up and lint code use no retired path).
7. **Fix-up after the second merge.** `bun run check`: technical-drawing `ModelSpec` x3 (its
   reset file lost the earlier wraps), Yeet `MergeGate.ts` options/run-options, and 83 test
   errors in `yeet-merge-gate.test.ts`. `fixup.ts` (one run per fresh log): 46 fixed. Manual:
   the test's helpers typed overrides as `ConstructorParameters<typeof X>[0]` (an Opaque has
   no constructor input, so it became `undefined`); they now use `Parameters<typeof X.make>[0]`
   and build `MergeGateOptions.make(...)`; a fix-up relative `../src` import was folded into
   the `@beep/repo-cli/test/Yeet` barrel import; `runMergeGate` builds
   `MergeGateInput.make({ read, options })`. Results: `beep-heavy bun run check` **exit 0**
   (266/266, includes `quality test-tsgo`); `run.ts --check` 0; `lint:package-test-typecheck`
   **exit 0** (current=1 baseline=1 introduced=0); `lint schema-first` **exit 0** (missing 0,
   stale 0, candidates 0); `lint effect-vitest` **exit 0**.
8. **D7 proof.** Temporary: the 8 `@effect/tsgo*` pins at 0.52.0 (`bun install`), and in
   `tsconfig.base.json` plus the 4 mirrored profiles `effectSleepZeroToYieldNow`,
   `flatMapToTap`, `preferEffectArray`, `preferEffectRecord`, `preferSchemaTaggedError` and
   `schemaClassMissingBrand` at `"error"`, `debug` removed. `lint:tsgo-rules`: ok (125 rules
   error, 3 declared off, 28 options). Since #1636 the package `check`/`build` scripts run
   **tsc-rs**, which ports 0.51.1 only: under 0.52 every package task fails on
   `TS377134 Unknown Effect diagnostic rule` for the 6 new names, so `bun run check` cannot
   carry the proof any more. The proof ran the installed (patched) `tsgo -p <config> --noEmit`
   over all 279 `tsconfig.check.json` / `tsconfig.test.json` files outside `apps/labs`, plus
   `quality test-tsgo` for the repo-cli tests.
   - First sweep: **25 `schemaClassMissingBrand`** hits, all in `@beep/effect-drizzle`, whose
     11 source files and 3 tests import the constructor by name
     (`import { TaggedError } from "effect/Schema"`), which the codemod did not recognise. The
     codemod now resolves named Schema imports (brand added; a named-import class stays a
     class, keep reason `named-import`; fixture test added, 24 pass) and branded the 14
     `TaggedError`s.
   - Final sweep: **`schemaClassMissingBrand` 0**. Other new-rule hits:
     `preferEffectArray` at 28 sites (9 in the package sweep: pdf-tools tests 5,
     technical-drawing tests 3, `Drawings.review.rules.ts:720`; 19 more in repo-cli tests via
     `test-tsgo`: `drawings-review.test.ts` 18, `knowledge-doctor-evaluators.test.ts` 1). Every
     one is a line that exists verbatim on origin/main, added after #1636 cleared the sites
     (#1682, #1690 and the drawings/pdf-tools lanes): inherited, for the 0.52 bump lane.
     `effectSleepZeroToYieldNow`, `flatMapToTap`, `preferEffectRecord`,
     `preferSchemaTaggedError`: 0.
   - Reverted: the 7 files restored from the backup, `bun install --frozen-lockfile`,
     installed tsgo 0.51.1; `git diff origin/main -- package.json bun.lock tsconfig.base.json`
     and the 4 profiles: empty.
