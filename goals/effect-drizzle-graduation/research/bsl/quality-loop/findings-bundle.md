### bundle-size-1: Root entrypoint statically retains both dialect implementations

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `sourceRefs`: `publishing-standards.md` §Import & bundle law; `rg -n '^import' scratchpad/bsl/src/kit.ts`; runtime import-graph traversal of the three public entrypoints
- `affectedFiles`: `scratchpad/bsl/src/index.ts:10`, `scratchpad/bsl/src/kit.ts:14`, `scratchpad/bsl/src/kit.ts:24`, `scratchpad/bsl/src/kit.ts:37`
- `evidence`: The root exports `make` from `kit.ts`. That module statically imports the PostgreSQL model, combinators, schema, extras, and projector at lines 15–28 and the corresponding SQLite modules at lines 29–40. It also imports the repository implementation. The resulting root runtime closure contains 28 local modules and 22 external runtime module paths, including both `drizzle-orm/pg-core` and `drizzle-orm/sqlite-core`, plus `effect/Effect` and three `effect/unstable/sql/*` modules. By contrast, the `@beep/effect-drizzle/pg` closure contains no SQLite module and the `@beep/effect-drizzle/sqlite` closure contains no PostgreSQL module. Returning the complete `Pg` or `Sqlite` namespace from `make` means the root offers no statically dialect-isolated kit path.
- `impact`: A SQLite-only or PostgreSQL-only consumer following the README’s root `make` API exposes both dialect implementations to its bundler and evaluates the full graph in unbundled ESM. The planned `sideEffects: false` metadata cannot create a dialect-local import path when both branches are statically referenced by the exported dispatcher.
- `suggestedFix`: Add dialect-local kit implementations and exports to the existing `@beep/effect-drizzle/pg` and `@beep/effect-drizzle/sqlite` entrypoints, while retaining the root dispatcher as an explicitly documented convenience API. Bundle-sensitive consumers must be able to import a kit constructor whose source graph never reaches the sibling dialect.
- `acceptanceCommands`: `bun test scratchpad/bsl/test/import-boundary.test.ts && ./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false && rg -n '^import' scratchpad/bsl/src/pg scratchpad/bsl/src/sqlite`
- `status`: open

### bundle-size-2: Eager descriptor construction is not marked or structured for fine-grained DCE

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `sourceRefs`: `publishing-standards.md` §Import & bundle law; `rg -n '(= taggedEnum<|= VariantSchema\\.make\\(|= assignStatics\\()' scratchpad/bsl/src`; `rg -n '@__PURE__|#__PURE__' scratchpad/bsl/src`
- `affectedFiles`: `scratchpad/bsl/src/core/Meta.ts:70`, `scratchpad/bsl/src/core/variant.ts:59`, `scratchpad/bsl/src/pg/Column.ts:313`, `scratchpad/bsl/src/pg/Column.ts:326`, `scratchpad/bsl/src/pg/Column.ts:466`, `scratchpad/bsl/src/pg/extras.ts:251`, `scratchpad/bsl/src/sqlite/Column.ts:151`, `scratchpad/bsl/src/sqlite/Column.ts:160`, `scratchpad/bsl/src/sqlite/Column.ts:214`, `scratchpad/bsl/src/sqlite/extras.ts:212`
- `evidence`: Reachable modules contain 27 module-scope `assignStatics(...)` calls, six `taggedEnum(...)` factory calls, and one `VariantSchema.make(...)` call, with zero pure annotations. PostgreSQL additionally constructs ten fixed descriptor instances together in one `fixed` object at lines 466–485; SQLite eagerly constructs `fixedReal` at line 214. These operations are necessary when their corresponding APIs are used, but imported factory calls and `Object.assign` wrappers are conservatively side-effectful to bundlers unless their purity is made explicit. The aggregate PostgreSQL `fixed` object also couples ten otherwise independent column families.
- `impact`: A selective `@beep/effect-drizzle/pg` or `@beep/effect-drizzle/sqlite` import can retain unrelated descriptor constructors and their closures even after unused exports are removed. This weakens the intended benefit of named imports and the future `sideEffects: false` declaration.
- `suggestedFix`: Mark verified-pure module-scope factory and `assignStatics` initializers with standard pure annotations, and split the PostgreSQL `fixed` aggregate into independently removable initializers. Preserve eager singletons where identity is intentional; do not introduce lazy-cache machinery without a measured need. Add a small bundle probe demonstrating that importing one combinator excludes unrelated column families and the sibling dialect.
- `acceptanceCommands`: `rg -n '@__PURE__|#__PURE__' scratchpad/bsl/src && bun build <focused-pg-consumer> --target=node --format=esm --minify --outdir=/tmp/bsl-bundle-proof && ./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false && bun test scratchpad/bsl/`
- `status`: open

2 findings, 2 blocking.
