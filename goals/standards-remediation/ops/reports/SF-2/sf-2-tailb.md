# SF-2 tail-b — capability/drivers/apps family (P4-wave2)

Lane: seven packages, strictly sequential — `@beep/acp`,
`@beep/test-utils`, `@beep/mcp-kit`, `@beep/box`, `@beep/api-transport`,
`@beep/langextract`, `@beep/ui` (+ AL-1a chart.tsx allowlist entry).
Slices: `goals/standards-remediation/ops/slices/P4-wave2/beep__{acp,
test-utils,mcp-kit,box,api-transport,langextract,ui}.json`. No
`standards/*.jsonc` touched. No commits made.

## Summary of code changes (4 packages touched, 4 read-only)

| Package | Files changed |
|---|---|
| `@beep/mcp-kit` | `src/FieldTier.ts`, `test/FieldTier.test.ts`, `AGENTS.md` |
| `@beep/box` | `src/Box.config.ts` |
| `@beep/langextract` | `src/Extraction/index.ts` |
| `@beep/ui` | `src/components/chart.tsx` |
| `@beep/acp`, `@beep/test-utils`, `@beep/api-transport` | none — all entries verified unconvertible in place |

## 1. `packages/drivers/acp` (4 entries) — no code changes

| Symbol | Disposition | Evidence |
|---|---|---|
| `AcpPatchedProtocol` | unconvertible | Runtime protocol handle: `clientProtocol: RpcClient.Protocol["Service"]`, `serverProtocol: RpcServer.Protocol["Service"]`, `incoming: Stream.Stream<...>`, `notify`/`request` dual-overload function members. Read in full (`AcpProtocol.service.ts:388-400`). Matches driver-verified `p2-s2-signals.md` "service-contracts"/"runtime-handles" sub-class (explicitly named). |
| `AcpPatchedProtocolOptions` | unconvertible | Extends `AcpProtocolLoggingOptions` (already `S.Class`) + 4 Effect-returning callback fields (`logger?`, `onExtRequest?`, `onNotification?`, `onTermination?`) + `stdio: Stdio.Stdio` (live handle) + `terminationError?: Effect.Effect<...>`. Matches driver-verified `p2-s3-extends.md` Attempt 3: `S.extend` does not exist in v4 (TS2551); manual field-spread only re-arrives at an `S.declare`-wrapped-function dead end. Only genuinely-data field is `serverRequestMethods: HashSet<string>`, not enough to justify a split (no consumer benefit; same conclusion as `p2-s3-extends.md`'s "hybrid schema-base+fn-field" class). |
| `AcpTerminal` | unconvertible | All fields are bound `Effect.Effect<...>` operations over a live remote-terminal-process handle (`kill`/`output`/`release`/`waitForExit`) plus `sessionId`/`terminalId` strings. Matches `p2-s2-signals.md`'s explicit citation (`AcpTerminal.models.ts:26-45`) — "the 'processes' example from the SPEC, verbatim." |
| `MakeTerminalOptions` | unconvertible | Identical shape to `AcpTerminal` (constructor options 1:1 mirroring the handle); same reasoning. |

Baseline check: `npx tsgo -b` in `packages/drivers/acp` — 0 errors (no edit made).

## 2. `packages/tooling/test-kit/test-utils` (4 entries) — no code changes

| Symbol | Disposition | Evidence |
|---|---|---|
| `PgliteSqlTestLayerOptions<MigrateError, SeedError>` | unconvertible + **detector-bug? flag** | Fields: `external?`, `mode?`, `testcontainers?` (genuinely schema-representable) + `hooks?: SqlTestHooks<MigrateError, SeedError>` (independently unconvertible, see below). `makePgliteSqlTestLayer(options = {})` (`SqlTest.ts:1503-1521`) and its internal caller `makePgliteIntegrationGate` (`:1444-1481`) construct this bag with 1-4 of its 4 optional fields across 6+ real call shapes with a genuine `= {}` default — a legitimate options-bag pattern (RC-DUAL's own guidance prefers options-objects over positional explosion), unlike `ProjectWithinBudgetOptions` below. Un-bundling would be a pure ergonomic regression for zero schema gain, since `hooks`' `Effect.Effect<void, MigrateError, SqlClient.SqlClient>` members can't become data regardless of position. Generic interface, so falls through `classifyGenericInterface`'s exception bucket the same way `FieldOption` does — same detector-gap class (no service/mixed-signal carve-out reaches the generic path). |
| `PgliteTestcontainerResource` | unconvertible | Live Testcontainer/Docker resource handle (`container: StartedTestContainer`), matches `NON_SCHEMA_SIGNAL_PATTERN`'s curated `StartedTestContainer` signal. Cited and driver-verified in `p2-s2-signals.md` (`SqlTest.ts:643`). |
| `SqlTestDriver<Config, Services, SqlService>` | unconvertible + **detector-bug? flag** | Strategy/driver-port object: `makeLayer: (config) => Layer.Layer<Services, SqlTestHarnessError>` (Layer isn't data), `sqlClient: Context.Key<SqlService, SqlClient.SqlClient>` (live service-tag handle), `name` (the one schema-typed field). Same "driver/strategy port" class as `GatedLayer`/`FileProcessingEngineShape`/`ScopedVectorizer` (R11-1 service-contract sub-class), but generic — so `classifyGenericInterface` never runs the service-contract check that the non-generic composed-members path has. Concrete implementers: `BunSqliteTestDriver`, `NodeSqliteTestDriver`, `PgliteTestcontainersTestDriver`, `PgliteInProcessTestDriver`, `PgExternalTestDriver` (`SqlTest.ts:1177-1402`). |
| `SqlTestHooks<MigrateError, SeedError>` | unconvertible | Generic test-lifecycle callback bag (`migrate?`/`seed?: Effect.Effect<void, E, SqlClient.SqlClient>`), no data fields. Cited and driver-verified in `p2-s2-signals.md` (`SqlTest.ts:515`). |

Baseline check: `npx tsgo -b` in `packages/tooling/test-kit/test-utils` — 0 errors (no edit made).

## 3. `packages/foundation/capability/mcp-kit` (3 entries) — FIXED 1/3

| Symbol | Disposition | Evidence |
|---|---|---|
| `FieldTierSet<Minimal, Balanced, Complete>` | unconvertible | Container of `S.Struct` *instances* (schema builders, not data) as fields. Driver-verified real compile attempt in `p2-s1-generic.md` Attempt 2: `S.declare`-wrapped version compiles (0 tsgo errors) but `S.toArbitrary` throws `Unsupported AST Declaration` and `encodeSync` leaks the internal `~effect/Schema` AST representation instead of data. Re-confirmed by reading current source (`FieldTier.ts:90-98`, unchanged since that audit). |
| `ProjectWithinBudgetOptions` | **FIXED** | Un-bundled `{ budgetBytes, mintFetchableHandle }` into two positional params on `projectWithinBudget` (now `dual(4, ...)`); deleted the interface entirely. This is the exact recipe independently verified compiling+tested in `p2-s2-signals.md`'s audit ("2. `ProjectWithinBudgetOptions` — fixed, un-bundled, interface eliminated") — applied here for real (that audit reverted its edit; this lane keeps it). Updated 2 call sites in `test/FieldTier.test.ts`, doc-comment examples, and the `AGENTS.md`/`CLAUDE.md` surface-map row (no other consumers — only build artifacts under `dist/`/`docs/` reference the old name, regenerated by docgen). |
| `GatedLayer<ROut, E, RIn>` (`ToolkitComposition.ts`) | unconvertible | `{ layer: Layer.Layer<ROut, E, RIn>; registration: SourceAuthRegistration }`. `registration` is already schema-first (`@beep/mcp-kit`'s own `SourceAuth.ts`); the sole remaining blocker is `layer: Layer.Layer<...>` — a live Effect program-construction handle, same non-serializable class as `Effect.Effect` itself. No further descriptor/handle split is possible (there is no second data field to extract; this is already the minimal decomposition — same "nothing left to convert" conclusion as the `ExportedTool` precedent in `p2-s2-signals.md`). |

Verification: `npx tsgo -b` (0 errors) · `npx vitest run` (6 files, 23/23 passed) · `turbo run docgen --filter=@beep/mcp-kit` (succeeded, 45 examples) · `bunx biome check` (clean).

## 4. `packages/drivers/box` (2 entries) — FIXED 1/2

| Symbol | Disposition | Evidence |
|---|---|---|
| `BoxCcgConfigShape` | **FIXED** | Was a private (non-exported) `S.Struct({...}).check(...)` const feeding `BoxCcgConfig extends S.Class(...)`. Traced `isStructFieldsInputForSchemaClass` (`SchemaFirst.ts:1454-1468`) directly: it only fires when the `S.Struct(...)` call has a `VariableDeclaration` ancestor later referenced as an `S.Class`/`S.TaggedError`-family fields argument. Inlined the struct+check directly as `S.Class`'s first argument (no named intermediate) — same runtime schema, same `.check()` refinement, one fewer symbol; not a detector dodge (no `VariableDeclaration` node exists post-edit, so the check structurally cannot match — the code shape itself changed, matching the `S.Class(id)({...fields...}, annotations)` idiom used by every other class in this file). Only reference to the old name was its own definition + the one `S.Class` call. |
| `BoxStreamingOperations` (`Box.streaming.ts`) | unconvertible | Read the full type in source (`:625-656`): nested groups of `Effect`/`Stream`-returning SDK operation methods (`avatars.createUserAvatar`, `chunkedUploads.reducer`, `downloads.downloadFile`, etc. — 11 methods total, 100% function-typed, zero data fields). Matches `p2-s2-signals.md`'s explicit citation: `BoxShape = BoxGeneratedOperations & BoxStreamingOperations`, then `Box extends Context.Service<Box, BoxShape>()` (`Box.service.ts:37,115`) — service-contract sub-class, "detector-ruling" disposition (pending the same service-contract carve-out extending to type aliases). |

Verification: `npx tsgo -b` (0 errors) · `npx vitest run` (2 files, 19/19 passed) · `turbo run docgen --filter=@beep/box` (succeeded, 4495 examples) · `bunx biome check` (clean).

## 5. `packages/foundation/capability/api-transport` (2 entries) — no code changes

| Symbol | Disposition | Evidence |
|---|---|---|
| `ApiTransport` | unconvertible | `{ rateLimit: Effect.Effect<O.Option<RateLimitSnapshot>>; transformClient: (client) => HttpClient }` — 100% behavioral, zero data fields. Already classified in `p2-s2-signals.md`'s service-contracts sub-class by name ("`ApiTransport` — 100% behavioral ... no data fields at all"). |
| `ApiTransportOptions` | unconvertible | Investigated fresh (not previously audited). Fields: `auth: ApiAuth` (a `Data.TaggedEnum`, not a schema — redesigning `ApiAuth` itself as `S.TaggedUnion` is a different, unassigned symbol with its own blast radius across `applyAuth`'s `$match`), `key: string`, `rateLimit: { limit: number; window: Duration.Input }`, `retryBaseDelay?/retryTimes?`. Found that `@beep/schema` already ships a `DurationInput` schema (`packages/foundation/modeling/schema/src/Duration/Duration.input.ts:173`), so `rateLimit.window`/`retryBaseDelay` are *individually* schema-representable — but `auth: ApiAuth` remains the structural blocker, and it is out of this entry's scope to redesign `ApiAuth`'s own type (not an assigned symbol; only 2 consumers exist, `govinfo`/`ecfr`, both always constructing the full 3-field bag together in one call — same "genuine options-bag, un-bundling doesn't help" reasoning as `PgliteSqlTestLayerOptions`). Not a decode-from-wire boundary (constructor-call-only, 2 known call sites). |

Baseline check: `npx tsgo -b` in `packages/foundation/capability/api-transport` — 0 errors (no edit made).

## 6. `packages/foundation/capability/langextract` (2 entries) — FIXED 2/2

| Symbol | Disposition | Evidence |
|---|---|---|
| `stripJsonFence.trim` (line 421) | **FIXED** | Native `.trim()` method call. |
| `stripJsonFence.trim` (line 423) | **FIXED** | Native `.trim()` method call. |

Both findings are the same helper (`Extraction/index.ts:420-424`), flagged by `normalizationEntryFromCallExpression` (`SchemaFirst.ts:1907-1946`) for zero-arg `.trim()` `PropertyAccessExpression` calls. Replaced both `text.trim()`/`fenced[1].trim()` native method calls with `Str.trim(...)` from `effect/String` (added the import) — matches CLAUDE.md's Code Law ("Prefer effect helper modules (String, Equal, ...) over native helpers") and the exact idiom already used in `@beep/schema/CommonTextSchemas.ts`'s `TrimmedNonEmptyText`/`normalizeBooleanString`. Behavior-preserving (verified by trace: original `fenced?.[1]?.trim() ?? trimmed` ⟺ new `fenced?.[1] === undefined ? trimmed : Str.trim(fenced[1])`, since the capture group `([\s\S]*?)` is always defined, never `undefined`, when the regex matches). Did not go further to a full `S.decodeTo`/`SchemaTransformation` pipeline chain (also suggested by the rule text) — the function-argument-count change (`Str.trim(x)` takes 1 arg vs. `x.trim()` taking 0) is what actually clears the detector's `callExpression.getArguments().length > 0` guard, and a chained schema pipeline would add compile risk (double `S.decodeTo` composition through `S.UnknownFromJsonString`) for no additional behavioral or documentation benefit over the simpler helper-module substitution.

Verification: `npx tsgo -b` (0 errors) · `npx vitest run` (3 files, 19/19 passed) · `turbo run docgen --filter=@beep/langextract` (succeeded, 25 examples) · `bunx biome check` (clean).

## 7. `packages/foundation/ui-system/ui` (2 schema-first + 1 allowlist) — FIXED 1/3

| Symbol | Disposition | Evidence |
|---|---|---|
| `Step` (`components/tour.tsx:187-200`) | unconvertible + **detector-bug? flag** | `content`/`title`/`nextLabel`/`previousLabel`: `React.ReactNode`; `align`/`alignOffset`/`side`/`sideOffset`: `React.ComponentProps<typeof PopoverContent>[...]` slices. Same non-serializable-render-boundary class as `FieldOption` above (R10's already-established `FieldShellProps` precedent). Same detector gap: this is a `.tsx` file, but the symbol name is `Step`, not `*Props`/`*RenderProps`, so R11 signal (5) doesn't match even though the shape is identical in kind. |
| `Tour` (`tour.tsx:216-219`) | unconvertible + **detector-bug? flag** | `{ id: string; steps: Step[] }` — pure container of `Step`, inherits the same ReactNode blocker transitively; same naming-signal gap. |
| `chart.tsx` native-error (AL-1a, `beep-laws/no-native-runtime`) | **FIXED** | `useChart()` threw a bare `throw new Error("useChart must be used within a <ChartContainer />")` on missing context (`chart.tsx:48-56`, old). The *same package* already has the canonical fix: `packages/foundation/ui-system/ui/src/lib/react-invariant.ts` exports `requireReactContext(context, options)`, which throws `ReactContextInvariantError` (a real `TaggedErrorClass`/`Data.TaggedError`, not a native `Error`) — and `tour.tsx`'s own `useTour()` (same package, line 168-171) already uses exactly this helper for the identical "hook used outside its provider" pattern. Replaced `useChart`'s native throw with `requireReactContext(context, { message: "..." })`, matching `tour.tsx` verbatim. Converts the allowlist entry's native-runtime usage per RC-ALLOWLIST as instructed. |

Verification: `npx tsgo -b` (0 errors) · `npx vitest run` (7 files, 32/32 passed) · `turbo run docgen --filter=@beep/ui` (succeeded, 531 examples) · `bunx biome check` (clean).

## Detector-bug? queue for driver verdict-challenge (D-C)

1. **`classifyGenericInterface` (`SchemaFirst.ts:1238-1259`) has no mixed-signal carve-out.** This blocks `PgliteSqlTestLayerOptions`/`SqlTestDriver` (`@beep/test-utils`) from reaching their otherwise-applicable service-contract exemptions — those checks only run in `classifyComposedMembers`/`classifyExtendsInterface`, never in the generic branch. Recommend threading the R11 service-contract and curated-runtime-handle signals into `classifyGenericInterface` alongside the existing R6-1/R6-2 checks.

Both are reported, not applied — fence 11 (detector changes never mix with code fixes) and fence 10 (lanes don't touch `packages/tooling/tool/cli/**`).

## Commands run (all outcomes green)

- `npx tsgo -b` — clean in all 7 packages (4 with real edits, 3 baseline-only).
- `npx vitest run` — `@beep/mcp-kit` 23/23, `@beep/box` 19/19, `@beep/langextract` 19/19, `@beep/ui` 32/32 (only the 4 edited packages; no test changes needed in the other 4).
- `turbo run docgen --filter=<pkg>` — succeeded for `@beep/mcp-kit`, `@beep/box`, `@beep/langextract`, `@beep/ui`.
- `bunx biome check <touched files>` — clean, no fixes needed, in all 4 edited packages.

No `standards/*.jsonc` file was read for writing, only for context. No commits made. No files outside the 7 assigned packages were edited (confirmed via `git status --porcelain` against the pre-existing dirty tree from concurrent lanes on this branch).
