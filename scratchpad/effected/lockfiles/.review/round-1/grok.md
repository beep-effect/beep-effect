I'll review the lockfiles port against the pinned upstream oracle and the binding decisions, and report findings only. First I'm loading the review rules, the ledger, and both trees.The ledger records no accepted deviations. Next I’ll diff the port against the pinned oracle and separate mechanical rewrites from real behavior changes.Identity annotations are already on the public schemas. I’ll compare the port to the pinned oracle and keep only diffs that change behavior.The public surface matches upstream. I’m reading the parsers next, where a HashSet or schema rewrite could change results without failing the gates.I'll confirm the cited lines against the commit surface, then report only the findings.The cited sites match the tree. I'll check the oracle and the two schema rules so each finding cites a real divergence.### grok-1-1
- file: scratchpad/effected/lockfiles/internal/npm.ts:72
- class: bug   severity: required
- standard: D9, section 14, section 11.1   evidence: The oracle `parseNpm` uses `Effect.try({ try: () => JSON.parse(content) as unknown, catch: syntaxFailure })` and its comment names V8 `RangeError` on pathological depth. The oracle test "the underlying cause is preserved structurally, not stringified" (`hostile.test.ts:511`) asserts `error.cause instanceof SyntaxError` for `"{ nope"`. The port decodes with `S.decodeEffect(S.fromJsonString(S.Unknown))` and `scratchpad/test/lockfiles/hostile.test.ts:515` asserts `S.SchemaError`. `SchemaGetter.parseJson` (`SchemaGetter.ts:1264-1271`) catches every `JSON.parse` throw and replaces it with `SchemaIssue.InvalidValue`; the thrown value is dropped. `preferSchemaOverJson` (error in `tsconfig.base.json`) flags `JSON.parse` only inside `Effect.try` and `Effect.gen`/`Effect.fn` (`prefer_schema_over_json.go`). A next-line `preferSchemaOverJson:off` satisfies that rule. D15 does not force `Schema.fromJsonString`: a `(): unknown` callback avoids `as` and `any`. The ledger `w3-lockfiles.deviations` is `[]` and the README Port notes say Deviations: None.
- failure: `Lockfile.parse` of malformed npm JSON fails `LockfileParseError` with cause `SchemaError`. A pathological-depth `RangeError` is also replaced. `stage` stays `"syntax"`, so the nesting-bomb tests stay green. The rewritten assertion hides the contract.
- fix: Restore `Effect.try` with `(): unknown => JSON.parse(content)` and `syntaxFailure` as `catch`, suppressed with `// @effect-diagnostics-next-line preferSchemaOverJson:off` citing the `SyntaxError`/`RangeError` contract. Restore `hostile.test.ts:515` to `assert.instanceOf(error.cause, SyntaxError)`.

### grok-1-2
- file: scratchpad/effected/lockfiles/internal/shared.ts:305
- class: bug   severity: required
- standard: D9; `schemaNumber` (`effect-tsgo/docs/rules/schema-number.md`)   evidence: The oracle `PnpmVersionProbe` is `Schema.Union([Schema.String, Schema.Number])` (`shared.ts:287`). The port is `S.Union([S.String, S.Finite])`. `requireLockfileVersion` (`shared.ts:278-290`) treats a non-finite number as `UnsupportedLockfileVersion`. The YAML composer returns `Infinity` for `.inf` and `NaN` for `.nan` (`scratchpad/effected/yaml/internal/composer/scalars.ts:69-73`). `schemaNumber` says to disable the diagnostic when non-finite values are intentional. The probe comment (`shared.ts:296-300`) says a too-old lockfile must stay distinct from a malformed one. Not recorded in the ledger or Port notes.
- failure: A numeric non-finite pnpm `lockfileVersion` never reaches the version gate. Upstream `isUnsupportedLockfileVersion(cause)` is true. The port fails the probe as a validation `SchemaError`, so the predicate is false.
- fix: Restore `S.Number` on `PnpmVersionProbe` and on `pnpm.ts:45`, each with `// @effect-diagnostics-next-line schemaNumber:off` stating that non-finite versions are the upstream contract.

### grok-1-3
- file: scratchpad/effected/lockfiles/internal/npm.ts:56
- class: bug   severity: required
- standard: D9; `schemaNumber`   evidence: The oracle `NpmVersionProbe` and `NpmLockfileRaw` use `Schema.Number` (`npm.ts:50` and `:56`). The port uses `S.Finite` at `npm.ts:56` and `:62`. `JSON.parse('1e999')` is `Infinity`, and `S.Unknown` accepts it, so `decodeJson` succeeds and the probe then rejects. `requireLockfileVersion` would emit `UnsupportedLockfileVersion`. The comment at `npm.ts:46-51` says that distinction must survive. Independent of grok-1-1 because the JSON is well-formed. Not recorded.
- failure: `{"lockfileVersion":1e999,"packages":{}}` is `UnsupportedLockfileVersion` upstream. The port fails the probe as a validation `SchemaError`, so `isUnsupportedLockfileVersion` is false.
- fix: Restore `S.Number` at `npm.ts:56` and `npm.ts:62`, each with `schemaNumber:off` for the same reason as grok-1-2.

### grok-1-4
- file: scratchpad/effected/lockfiles/internal/bun.ts:67
- class: bug   severity: required
- standard: D9; `schemaNumber`   evidence: The oracle `BunLockfileRaw.lockfileVersion` is `Schema.Number` (`bun.ts:59`). The port is `S.Finite`. Bun has no version gate. `toFields` reports `String(raw.lockfileVersion)` (`bun.ts:249`; oracle `bun.ts:242`). The JSONC parser uses `Number.parseFloat` (`scratchpad/effected/jsonc/internal/parser.ts:387`), so `1e999` is `Infinity` and `String(Infinity)` is `"Infinity"`. Not recorded.
- failure: Upstream accepts the document and sets `lockfileVersion` to `"Infinity"`. The port rejects it as a validation `SchemaError`.
- fix: Restore `S.Number` at `bun.ts:67` with `schemaNumber:off`.

### grok-1-5
- file: scratchpad/effected/lockfiles/internal/yarn.ts:41
- class: bug   severity: required
- standard: D9; `schemaNumber`   evidence: The oracle `YarnMetadata.version` is `Schema.optionalKey(Schema.Union([Schema.String, Schema.Number]))` (`yarn.ts:35`). The port uses `S.Finite`. Yarn has no version gate. `lockfileVersion` is `"unknown"` only when `metadata.version` is `undefined`; otherwise it is `String(metadata.version)` (`yarn.ts:64`). YAML `.inf`, `.nan`, and overflowing floats become non-finite numbers (`scalars.ts:69-73`). Not recorded.
- failure: Upstream accepts the file and stringifies the version to `"Infinity"` or `"NaN"`. The port fails the metadata decode and rejects the file.
- fix: Restore `S.Union([S.String, S.Number])` at `yarn.ts:41` with `schemaNumber:off`.

### grok-1-6
- file: scratchpad/effected/lockfiles/internal/pnpmEnv.ts:80
- class: docs   severity: backlog
- standard: section 14; effect-laws-v1 law 7; native-runtime `nativeError`   evidence: The oracle `unaccounted` is `validationFailure(new Error(\`pnpm-lock.yaml env preamble: ${message}\`))` (`pnpmEnv.ts:65`). The port constructs `PnpmEnvPreambleError` (`pnpmEnv.ts:16-20`, used at `:80`) with the same message prefix. `core.Error` calls `super(args?.message)` (`internal/core.ts:672`), so `.message` still matches and the substring assertions stay green. `w3-lockfiles.deviations` is `[]` and Port notes say Deviations: None. `new Error` is rejected by the native-runtime gate outside hotspot scope, so the replacement stays.
- failure: The cause `_tag` and constructor differ from upstream `Error`, and the law-forced deviation is unrecorded.
- fix: Record `law:effect-laws-v1#7` in the ledger `deviations` entry and in README Port notes. Keep `PnpmEnvPreambleError`.

REQUIRED: 5
BACKLOG: 1
