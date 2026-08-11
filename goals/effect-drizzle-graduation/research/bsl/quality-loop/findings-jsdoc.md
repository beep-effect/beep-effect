### jsdoc-1: 162 entrypoint-unreachable exports lack `@internal`

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `sourceRefs`: `review-context.md` §“NEW convention entering via this loop”; `publishing-standards.md` §“@internal marking”
- `affectedFiles`: `scratchpad/bsl/src/core/Field.ts:26`; `scratchpad/bsl/src/core/Meta.ts:17`; `scratchpad/bsl/src/core/assembly.ts:27`; `scratchpad/bsl/src/core/classification.ts:21`; `scratchpad/bsl/src/core/entity-id.ts:25`; `scratchpad/bsl/src/core/literals.ts:68`; `scratchpad/bsl/src/core/model.ts:50`; `scratchpad/bsl/src/core/variant.ts:16`; `scratchpad/bsl/src/kit.ts:65`; `scratchpad/bsl/src/pg/Column.ts:78`; `scratchpad/bsl/src/pg/derive.ts:87`; `scratchpad/bsl/src/pg/model.ts:106`; `scratchpad/bsl/src/pg/table.ts:286`; `scratchpad/bsl/src/sqlite/Column.ts:52`; `scratchpad/bsl/src/sqlite/derive.ts:35`; `scratchpad/bsl/src/sqlite/model.ts:84`
- `evidence`: An AST-based export/re-export audit found zero `@internal` tags and the following entrypoint-unreachable module exports, grouped exhaustively by owning file:
  - `core/Field.ts` (18): `TypeId`, `AnySchema`, `Field`, `Any`, `Input`, `make`, `isField`, `SchemaFrom`, `MetaFrom`, `from`, `Patched`, `patch`, `EncodedOf`, `SqlTypeError`, `ValidateEncoded`, `ValidateNonNullable`, `ValidateArrayElement`, `ValidateArrayEncoded`.
  - `core/Meta.ts` (22): `ColumnSpec`, `ArrayDimension`, `IdentityMode`, `FkAction`, `isFkAction`, `References`, `isReferences`, `Default`, `DefaultSqlExpr`, `DefaultValue`, `DefaultNow`, `UnsafeDefaultSql`, `Generated`, `GeneratedSqlExpr`, `UnsafeGeneratedSql`, `GeneratedIdentityAlways`, `Meta`, `Empty`, `empty`, `Patch`, `Merge`, `merge`.
  - `core/assembly.ts` (10): `Edge`, `Junction`, `relationName`, `relationAlias`, `plural`, `reverseRelationName`, `RelationModel`, `RelationModels`, `AssemblyFailure`, `makeRelationsConfig`.
  - `core/classification.ts` (4): `DeriveColumnError`, `Classifier`, `Classified`, `classify`.
  - `core/entity-id.ts` (2): `EntityIdLike`, `isEntityIdLike`.
  - `core/literals.ts` (1): `stringLiteralValues`.
  - `core/model.ts` (1): `AnyModel`.
  - `core/variant.ts` (3): `variants`, runtime `Variant`, `factory`.
  - `kit.ts` (1): runtime `Dialect`.
  - `pg/Column.ts` (48): `ColumnInvariantError`, `IdentityMode`, `ArrayDimension`, `ArrayDimensionString`, `DimensionOf`, `DrizzleBuilder`, `EntityIdIdent`, `DbIdent`, `Spec`, `Text`, `Varchar`, `Enum`, `Custom`, `Numeric`, `DateColumn`, `Char`, `Json`, `Real`, `Bigserial`, `Smallserial`, `Uuid`, `Integer`, `Smallint`, `Bigint`, `Serial`, `DoublePrecision`, `Bool`, `Jsonb`, `Timestamp`, `Bytea`, `EnumInstance`, `CustomBuilder`, `isSpec`, `ResolveName`, `resolveName`, `Kind`, `IdentOf`, `StorageIdent`, `storageIdent`, `ArrayCarrier`, `IdentEquals`, `IdentityKind`, `isIdentityKind`, `CarrierOf`, `CarrierTag`, `Carrier`, `carrierTag`, `carrier`.
  - `pg/derive.ts` (11): `EntityIdLike`, `SelectSchemaOf`, `Derived`, `ResolvedColumn`, `selectSchemaOf`, `classify`, `isNullable`, `arrayElementAST`, `encodedAST`, `stringLiteralValues`, `maxLengths`.
  - `pg/model.ts` (4): `ResolvedMetaOf`, `UnwrappedFields`, `MissingSelfGeneric`, `makeModelClass`.
  - `pg/table.ts` (1): `EnumRegistry`.
  - `sqlite/Column.ts` (24): `ColumnInvariantError`, `EntityIdIdent`, `ArrayDimension`, `TextMode`, `IntegerMode`, `BlobMode`, `NumericMode`, `Spec`, `Text`, `Enum`, `Integer`, `Real`, `Blob`, `Numeric`, `DrizzleBuilder`, `isSpec`, `CarrierOf`, `CarrierTag`, `carrierTag`, `StorageIdent`, `ArrayCarrier`, `storageIdent`, `Carrier`, `carrier`.
  - `sqlite/derive.ts` (8): `EntityIdLike`, `SelectSchemaOf`, `Derived`, `ResolvedColumn`, `selectSchemaOf`, `classify`, `isNullable`, `stringLiteralValues`.
  - `sqlite/model.ts` (4): `ResolvedMetaOf`, `UnwrappedFields`, `MissingSelfGeneric`, `makeModelClass`.
- `impact`: These declarations remain visible to declaration generation and documentation despite not belonging to any public entrypoint. The future `stripInternal` build cannot remove them, violating the newly locked publication boundary.
- `suggestedFix`: Add `@internal` to every owning declaration listed above, including the internal value facet of merged type/value names and emitted overload declarations. Alternatively, remove unnecessary `export` modifiers where no cross-file consumer exists.
- `acceptanceCommands`: `rg -n '@internal\\b' scratchpad/bsl/src --glob '*.ts'`; repeat the entrypoint reachability inventory against `src/index.ts`, `src/pg/index.ts`, and `src/sqlite/index.ts`; `./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit`
- `status`: open

### jsdoc-2: `Dialect` documents the wrong declaration and symbol kind

- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `sourceRefs`: `effect-jsdoc-conventions.md` §§7.1, 7.3, 8 item 10; `publishing-standards.md` §“@internal marking”
- `affectedFiles`: `scratchpad/bsl/src/kit.ts:42`
- `evidence`: The substantive block is attached to the runtime `Dialect` object at line 65, but its only example imports the public type and demonstrates `Extract<Dialect, "pg">`. The root entrypoint exports only `type Dialect`; the runtime object is unreachable, unused elsewhere, and lacks `@internal`. Conversely, the public type declaration at line 73 has only an empty `/** */` block. Categorizing the guard-bearing object as `schemas` also repeats the specific misclassification identified by the convention research.
- `impact`: Generated documentation associates public type guidance with an internal runtime value, leaves the actual public type undocumented, and falsely presents a plain guard object as a schema.
- `suggestedFix`: Move type-focused prose and the example onto `export type Dialect`, using an appropriate type/model category. Remove the unused runtime object, or give it accurate guard-focused documentation plus `@internal` if it must remain.
- `acceptanceCommands`: `./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit`; rerun the in-memory JSDoc example compilation and confirm the public `Dialect` type owns the block
- `status`: open

2 total findings, 2 blocking.
