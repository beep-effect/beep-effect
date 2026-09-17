# Lane 23-r4-snapshot-blast-radius — Non-MCP changes on upstream main (runtime risk)

**Question:** Which unreleased non-MCP changes on upstream Effect main (`effect@4.0.0-rc.115`..`a7a71921de`) change runtime behavior that beep-effect relies on, where, and how would tests catch (or miss) each?

**Scope:** non-MCP runtime blast radius. MCP protocol changesets are listed in §1 for completeness and then deferred to lanes 20–22 / 10–12.

**Method:** Effect `.changeset/*.md` (not `pre/`) at `a7a71921de`; `git log effect@4.0.0-rc.115..a7a71921de` (32 non-merge commits); beep-effect `graft grep` + `rg` over `packages/**`, `apps/**`, `package.json`. Type-level census is taken as given (orchestrator spike, 2026-09-16: two `check` failures, then 251/251). This lane did not run installs, builds, or tests.

**Range:** 29 top-level changesets; 32 non-merge commits. Five commits have no top-level changeset (`#8244` mailbox starvation, `#8242` MCP migration docs, plus three CI-only commits).

---

## 1. Changeset table

MCP rows are included so the census is complete; they are **not** owned here.

| changeset | package | kind | upstream evidence |
| --- | --- | --- | --- |
| `sql-pg-timestamp-date` | `@effect/sql-pg` | **runtime behavior (breaking)** | commit `8ef3fcbbe7` (#8241); `effect:packages/sql/pg/src/PgTypes.ts:1049-1061` (`new Date(...)`; sentinels → invalid `Date`). rc.115 returned epoch ms / `±Infinity` (`effect@4.0.0-rc.115:packages/sql/pg/src/PgTypes.ts:1044-1050`). |
| `sql-pg-unknown-oid-text` | `@effect/sql-pg` | **runtime behavior (breaking for unregistered OIDs)** | commit `fd910d1cc6` (#8240); `effect:packages/sql/pg/src/PgTypes.ts:1641-1644` (unregistered → UTF-8 text). rc.115 returned `Uint8Array` (`effect@4.0.0-rc.115:packages/sql/pg/src/PgTypes.ts:1627`). |
| `strict-byte-size-input` | `effect` | **type change** (runtime parse path renamed, regex unchanged) | commit `755e863a79` (#8212); `effect:packages/effect/src/ByteSize.ts:46` (`Input` no longer `string`); `fromInputUnsafe` still calls the same parser now exported as `fromStringUnsafe` (`effect:packages/effect/src/ByteSize.ts:224-267`). |
| `effect-stream-api-alignment` | `effect` | **type change + runtime** | commit `ccae354231` (#8256). Runtime: `Effect.orElseSucceed` now passes the error (`effect:packages/effect/src/internal/effect.ts:3416-3429`; rc.115 used `LazyArg` / `sync(f)`). `Stream.scan` initial is `LazyArg` (`effect:packages/effect/src/Stream.ts:7901-7914`; rc.115 took value `S` and wrapped `constant(initial)`). `Stream.partition` **swaps tuple order** and renames `bufferSize` → `capacity` (`effect:packages/effect/src/Stream.ts:4443-4483` vs rc.115 `[excluded, satisfying]` with `[fromQueue(fails), fromQueue(passes)]`). `Stream.mapBoth` option keys `onSuccess`/`onFailure` → `onElement`/`onError`. `Effect.isEffect` narrows to `Effect<unknown, unknown, unknown>` (`effect:packages/effect/src/Effect.ts:230`). `Stream.catchTags` rejects unknown tags **at the type level**. |
| `fix-file-response-content-type` | `effect`, `@effect/platform-node`, `@effect/platform-deno` | **runtime behavior (fix)** | commit `77a5612035` (#8254); `effect:packages/effect/src/unstable/http/HttpPlatform.ts:145-148` (`optionHeaders` honors `contentType`); default layer infers MIME from extension. Removed unused `contentLength` option on `HttpServerResponse.file`. |
| `httpapi-client-literal-actions` | `effect` | **runtime behavior (fix)** | commit `84fe64a5fb` (#8255); `effect:packages/effect/src/unstable/httpapi/internal/path.ts:16-56` (`toRouterPath`); applied at `effect:packages/effect/src/unstable/httpapi/HttpApiBuilder.ts:896`. |
| `fix-rcref-idle-ttl-zero` | `effect` | **runtime behavior (fix)** | commit `51d4a2f08a` (#8202); `effect:packages/effect/src/internal/rcRef.ts:82-84` (`!== undefined` so `0` is kept). rc.115 used truthiness (`options.idleTimeToLive ? ...`). |
| `arbitrary-array-shrinking` | `effect` | **runtime behavior** (shrinking / replay tokens) | commit `8f420bb3dc` (#8221); `.changeset/arbitrary-array-shrinking.md`. Additive `Arbitrary.array`; existing Schema-array shrinking explores prefixes/interior blocks. Replay tokens may change. |
| `cleanup-successful-process-groups` | `@effect/platform-node-shared` | **runtime behavior (fix)** | commit `05a6405d3d` (#8245); `effect:packages/platform/node-shared/src/NodeChildProcessSpawner.ts` (POSIX group cleanup after successful leader exit). Caveat in the same file: group-id reuse may signal an unrelated group. |
| `clickhouse-compiler-dialect` | `@effect/sql-clickhouse` | fix | commit `f193ac50d1` (#8211). **NOT FOUND** in beep-effect (no `@effect/sql-clickhouse` catalog/dep). |
| `clickhouse-ping-check` | `@effect/sql-clickhouse` | fix | commit `73e6f4bb94` (#8210). **NOT FOUND** in beep-effect. |
| `crypto-ulid` | `effect` | additive | commit `1393080f1c` (#8233). **NOT FOUND** (`Crypto.randomULID` unused). |
| `fix-deferred-handover-rpc-interruption` | `effect` | fix (cluster/RPC) | commit `553c403f1d` (#8235). **NOT FOUND** (`ClusterWorkflowEngine` / `DurableDeferred` unused). |
| `fix-discarded-workflow-deferred-wake` | `effect` | fix (cluster) | commit `45b510352d` (#8243). **NOT FOUND**. |
| *(no changeset)* mailbox starvation `#8244` | `effect` | fix (cluster) | commit `1b084cc9a2`. **NOT FOUND**. |
| `fix-memory-workflow-self-completion` | `effect` | fix (cluster) | commit `10761707b5` (#8229). **NOT FOUND**. |
| `fix-runner-stream-disconnect` | `effect` | fix (cluster `RunnerServer`) | commit `ccfe152d11` (#8227). **NOT FOUND**. |
| `fix-multipart-active-file-failure` | `effect` | fix (HTTP multipart server) | commit `f110af1ac5` (#8206). beep-effect multipart usage is **client** encoding in xAI/Venice drivers, not Effect's multipart file-stream server. Low coupling. |
| `httpapi` / OpenAPI generator binary multipart | `@effect/openapi-generator` | **type change** (generated clients) | commit `abb93c221b` (#8208). Affects **regeneration**, not already-committed clients. Spike `check` passed without regen. |
| `latest-dependencies` | `@effect/doctest`, `@effect/platform-deno`, `@effect/sql-d1`, `@effect/sql-mysql2` | additive / dep bump | commit `8abae870f9` (#8225). Lockstep impact: `@effect/doctest` is in the 16-package catalog (`repo:package.json:25`). Deno/d1/mysql2 **NOT FOUND** as beep-effect deps. |
| `openai-web-search-api-sources` | `@effect/ai-openai` | additive / type-narrowing | commit `90695b0d5b` (#8236). beep-effect web-search call sites are Venice (`repo:packages/drivers/venice-ai/src/VeniceAI.service.ts:1344-1421`), not `@effect/ai-openai` web-search source objects. |
| `pg-listen-connection-errors` | `@effect/sql-pg` | **runtime + type** (`SqlError` on listen queues) | commit `9367dcbeda` (#8215). **NOT FOUND** (`PgClient.listen` unused in packages/apps). |
| `pg-sslmode-compatibility` | `@effect/sql-pg` | additive runtime | commit `8feeb3c4cd` (#8200). **NOT FOUND** (`sslmode=prefer/allow` unused). |
| `pg-startup-parameters` | `@effect/sql-pg` | additive | commit `4e4a3a6055` (#8234). **NOT FOUND** (`startupParameters` / `startupOptions` unused). |
| `quiet-pandas-connect` | `@effect/sql-pg` | additive | commit `205066a76f` (#8224). **NOT FOUND** (Effect password providers unused). |
| `sqlite-do-native-completion` | `@effect/sql-sqlite-do` | fix | commit `a7a71921de` (#8257). **NOT FOUND** (no Durable Object sqlite package). |
| `mcp-prompt-titles` | `effect` | MCP additive | commit `49e4b37b83` (#8228). Other lanes. |
| `mcp-server-instructions` | `effect` | MCP additive | same commit. Other lanes. |
| `strict-mcp-tool-inputs` | `effect` | MCP runtime | same commit. Other lanes. |
| `modern-mice-discover` | `effect` | MCP additive (`v2026_07_28`) | commit `a2c4154cf8` (#7265). Other lanes. |

CI-only (no product runtime): `c22bc43355` Types CI Go soft limit; `302de10d99` OpenApiGenerator test timeouts; `efec8a6d1d` snapshot compiler memory. `#8242` (`769f6046a2`) is MCP migration **docs**.

---

## 2. Runtime-impact rows

Typecheck cannot catch these unless a value's TypeScript type also changed. Spike result (cited, not re-run): after wrapping `Effect.isEffect` and `Stream.scan(() => "")`, 251/251 `check` tasks pass (`explorations/effect-mcp-2026-07-28/research/25-r4-spike-census.md`). Unit tests of MCP + sql-pg-adjacent packages passed; the 8 professional-desktop integration failures are MCP HTTP/`RpcClientDefect` (lane 21), not these rows.

### 2.1 `@effect/sql-pg` timestamp / timestamptz decode as `Date`

| | |
| --- | --- |
| **Change** | Binary `timestamp` / `timestamptz` (and arrays) decode to `Date` instead of epoch milliseconds. `infinity` / `-infinity` / out-of-range → invalid `Date` (was `±Infinity`). Encoders still accept `Date \| number`. Date parameters bind as `timestamptz`; inserting a `Date` into a `timestamp` column applies session `TimeZone`. |
| **Upstream** | `effect:.changeset/sql-pg-timestamp-date.md`; `effect:packages/sql/pg/src/PgTypes.ts:13-26`, `:1049-1061`, `:1983-1997`. |
| **Repo call sites** | Native client: `repo:packages/drivers/postgres/src/PostgresClient.service.ts:9-52` wraps `@effect/sql-pg/PgClient`. Harness native wire path: `repo:packages/tooling/test-kit/test-utils/src/SqlTest.ts:1126-1135` (`PgClient.make` against pglite-testcontainers) and `:1179-1188` (`PgClient.makeClient` against `pg-external`). In-process PGlite aliases the **tag** `PgClient` but does not share this binary codec (`repo:packages/drivers/pglite/src/PgliteClient.service.ts:1-16`; Effect `packages/sql/pglite/src` has **no** timestamp codec — NOT FOUND). Drizzle default timestamp mode is **string** (`repo:packages/ecosystem/effect-drizzle/src/pg/combinators.ts:997-1016`). Consumers: `PostgresDrizzle` in workspace/documents/professional-desktop (`repo:packages/workspace/server/src/aggregates/Thread/ThreadStore.repo.ts:10` and siblings). Diagnostics already special-case `Date` (`repo:packages/drivers/postgres/src/PostgresDiagnostics.service.ts:142-185`). |
| **Would tests catch it?** | **Miss, unless a native-wire integration test asserts JS type of a timestamp column.** `@beep/postgres` integration is PGlite (`repo:packages/drivers/postgres/test/integration/Postgres.pglite.test.ts`). effect-drizzle tests assert SQL type strings / column kind, not driver JS values (`repo:packages/ecosystem/effect-drizzle/test/unit.test.ts:269,368-369`). Spike wave 3 unit tests of `@beep/postgres` / `@beep/pglite` / `@beep/effect-drizzle` passed — consistent with not exercising sql-pg binary timestamp decode. `pg-external` / `pglite-testcontainers` live paths exist in SqlTest but are not part of default `beep:test`. |
| **Migration effort** | Small **if** production stays on in-process PGlite (professional-desktop). **Medium** if any native `PgClient` + drizzle `mode: "string"` (ISO) column sees a `Date`: drizzle may coerce or fail at runtime with no type error. Numeric readers must `date.getTime()` or re-register numeric codecs. Restore numeric codecs with `PgTypes.register` if needed. |
| **G7 challenge** | A pin-only first PR ships this decode change on every native `@effect/sql-pg` connection. Typecheck will not stop it. |

### 2.2 `@effect/sql-pg` unknown OIDs as UTF-8 text

| | |
| --- | --- |
| **Change** | Unregistered scalar OIDs decode as UTF-8 text (enum **labels**). rc.115 returned raw `Uint8Array`. Invalid UTF-8 → `CodecError` **and closes the connection** (pending queries, transactions, `LISTEN` dropped; pool replaces the connection). Enum **arrays** may garble. |
| **Upstream** | `effect:.changeset/sql-pg-unknown-oid-text.md`; `effect:packages/sql/pg/src/PgTypes.ts:1641-1644`, `:1673-1674`. rc.115: `return bytes.slice(offset, offset + size)`. |
| **Repo call sites** | effect-drizzle models PostgreSQL enums (`repo:packages/ecosystem/effect-drizzle/src/pg/combinators.ts:348-401`; fixtures e.g. `repo:packages/ecosystem/effect-drizzle/test/fixtures.ts:71-72` and an enum **array** at `:227`). Same native-vs-PGlite split as 2.1. **No** `PgTypes.register` call sites in packages/apps (NOT FOUND). |
| **Would tests catch it?** | **Miss on default PGlite unit tests.** A native-wire test that selected an unregistered enum and asserted `Uint8Array` would fail (now a string). A test that expected labels would start passing. Connection-killing UTF-8 failures on enum **arrays** would show as pool errors, not type errors. Spike did not run `pg-external` live SQL. |
| **Migration effort** | Likely a **fix** for scalar enums on native sql-pg. Register array codecs if enum arrays are read over native wire (`PgTypes.makeRegistry().register(elementOid, codec, { arrayOid })`). |

### 2.3 Strict `ByteSize.Input`

| | |
| --- | --- |
| **Change** | `ByteSize.Input` is no longer `string`; it is a template-literal of canonical integer + unit. Malformed **literals** fail at compile time. Runtime `fromInput` still parses via `fromStringUnsafe` (fractions and names still accepted **as `string` values** that are not in the `Input` type — you must go through `fromString` / `fromStringUnsafe` first). |
| **Upstream** | `effect:packages/effect/src/ByteSize.ts:32-46`, `:224-267`. |
| **Repo call sites** | ~30 `ByteSize` hits, all `ByteSize.bytes(...)` / `ByteSize.sum` / `S.ByteSize` (`repo:packages/foundation/modeling/schema/src/FileInfo.ts:32`; `repo:packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.ts:43`; tests under `repo:packages/foundation/modeling/schema/test/FileInfo.test.ts`). `fs.stream({ chunkSize: 64 * 1024 })` uses **numbers** (`repo:packages/tooling/library/ai-metrics/src/source-discovery.ts:336`). **No** `"1 kb"`-style `ByteSize.Input` string literals found. |
| **Would tests catch it?** | Typecheck would catch illegal literals (spike did not report any). Runtime of existing `ByteSize.bytes(n)` is unchanged. FileInfo tests construct via `ByteSize.bytes`. |
| **Migration effort** | None observed. Keep using constructors; parse untrusted strings with `ByteSize.fromString`. |

### 2.4 Effect / Stream API alignment (#8256) beyond the two known type errors

**Known type errors (spike, not re-run):**

1. `Effect.isEffect` is `(u: unknown) => u is Effect<unknown, unknown, unknown>` (`effect:packages/effect/src/Effect.ts:230`). `S.declare<Effect<Success, Failure, Dependencies>>(isEffect, ...)` at `repo:packages/foundation/modeling/schema/src/EffectSchema.ts:60,85-88` no longer type-checks. **Runtime of the guard is unchanged** (`hasProperty(u, EffectTypeId)` at `effect:packages/effect/src/internal/core.ts:116`). Tests at `repo:packages/foundation/modeling/schema/test/EffectSchema.test.ts:7-32` assert runtime true/false and would **not** catch the type error; they would still pass after a typed wrapper. JSDoc `console.log(Effect.isEffect(...))` hits are comments only.

2. `Stream.scan` initial is `LazyArg<S>` (`effect:packages/effect/src/Stream.ts:7901-7914`). Sole call site: `repo:packages/tooling/library/ai-metrics/src/source-discovery.ts:336-342` `Stream.scan("", ...)`. **If shipped without the thunk wrap, runtime would call a string as a function.** Tests at `repo:packages/tooling/library/ai-metrics/test/source-discovery.test.ts` only exercise the **input schema**, not `readAttributionContent` / `Stream.scan` — they would **miss** a runtime throw.

**Other alignment items (no additional spike `check` failures, so either unused or still well-typed):**

| Item | Runtime? | Repo | Tests |
| --- | --- | --- | --- |
| `Effect.orElseSucceed` now `(error: E) => B` instead of `LazyArg<B>` | **Yes, on the failure path.** rc.115: `catch_(self, (_) => sync(f))` (thunk, no args). Now: `catch_(self, (error) => sync(() => f(error)))`. Zero-arity thunks ignore the extra argument in JS. | **369 hits in 157 files.** Typical: `() => false`, `thunkFalse`, `constant(...)`, `O.none<...>`, `A.empty<string>`. Examples: `repo:apps/professional-desktop/src/runtime/Pglite.ts:143`; `repo:packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts:767`. **No** `identity` / error-consuming callbacks found. | Existing failure-path tests keep passing for 0-arity thunks. They would **miss** a latent bug if a callback interpreted its first argument (none found). Typecheck already passed in the spike, so the new `(error) => B` still accepts 0-arity thunks. |
| `Stream.partition` tuple **swap** + `bufferSize` → `capacity` | **Yes.** rc.115 returned `[Fail, Pass]` by swapping queue order. Snapshot returns `[Pass, Fail]` and reads `options.capacity` (old `bufferSize` silently ignored → default 16). | **NOT FOUND** (`Stream.partition` / `Stream.partitionQueue`). | n/a |
| `Stream.mapBoth` `{onSuccess,onFailure}` → `{onElement,onError}` | **Yes** if anyone passed the old keys (callbacks undefined). | **NOT FOUND** for `Stream.mapBoth`. Repo `mapBoth` is `Effect.mapBoth` / `Exit.mapBoth` (`repo:packages/drivers/acp/src/AcpProtocol.service.ts:781`). | n/a |
| `Stream.catchTags` unknown tag keys | **Type-only** (same pattern as `Effect.catchTags`). | One `Stream.catchTags` at `repo:packages/drivers/openai-compat/src/OpenAiCompatClient.service.ts:327-331` (`HttpClientError`, `Retry`, `SseError`). Spike `check` passed ⇒ tags are in the error union. | Existing SSE tests would not detect a type-level unknown-tag rejection. |
| `Stream.bind` / `bindEffect` / `let` re-bind; `Stream.Success` unconstrained; `Stream.scanEffect` lazy init; new `Stream.as` / `tapDefect` / `tapErrorTag` / `unwrapReason` | Mostly types / additive. `scanEffect` same lazy-init trap as `scan`. | `Stream.scanEffect` **NOT FOUND**. | n/a |

**Migration effort:** two one-line type fixes already proven in the spike. Optionally audit `orElseSucceed(O.none)` for the new extra argument (no behavior change expected). Do not assume `Stream.partition` order if anyone adds it later.

### 2.5 HTTP file response content types

| | |
| --- | --- |
| **Change** | `contentType` option and explicit headers are preserved on file / file-web responses; default `HttpPlatform.layer` infers MIME from extension; Node/Deno platforms prefer explicit type, then nonempty `File.type`, then extension. `contentLength` option removed from `HttpServerResponse.file`. |
| **Upstream** | `effect:packages/effect/src/unstable/http/HttpPlatform.ts:145-148`, `:195+` (layer MIME). |
| **Repo call sites** | `HttpServerResponse.file` / `HttpStaticServer` **NOT FOUND**. Closest: `HttpServerResponse.uint8Array(..., { contentType })` at `repo:apps/labs/api-docs/src/Docs.routes.ts:120,128` (already explicit). Driver `contentType` fields are HTTP **client** bodies, not this server helper. |
| **Would tests catch it?** | No beep-effect test asserts Effect file-response MIME. Upstream tests added in the same commit. |
| **Migration effort** | None unless someone starts using `HttpServerResponse.file` without `contentType`. |

### 2.6 HttpApi literal action suffixes (`:wait`)

| | |
| --- | --- |
| **Change** | Paths like `/operations/:id:wait` keep `:wait` as a literal. `toRouterPath` only treats `:name` as a param when `name` is in the params schema; otherwise it emits `::` (FindMyWay escaped colon). Schemas whose keys cannot be enumerated keep the old fallback. |
| **Upstream** | `effect:packages/effect/src/unstable/httpapi/internal/path.ts:16-56`; `HttpApiBuilder.handlerToRoute` at `:896`. |
| **Repo call sites** | HttpApi endpoints: oip-web `/api/contact`, ciops/api-docs `/health`, pacer `/.../:reportId`, govinfo `/packages/:packageId/summary`, qa-capture `/events`, etc. **No** `:param:literalSuffix` HttpApi paths found. xAI `{batch_id}:cancel` (`repo:packages/drivers/xai/src/XAiEndpoints.models.ts:950`) is OpenAPI **brace** syntax, not HttpApi `:param`. |
| **Would tests catch it?** | HttpApi client tests would only catch this if a path actually used a literal suffix. Current routes would not change. |
| **Migration effort** | None now. If a Google-AIP-style `:wait` route is added, this is a fix rather than a break. |

### 2.7 `RcRef` idle TTL `0`

| | |
| --- | --- |
| **Change** | `idleTimeToLive: 0` (and `"0 millis"`) is honored; rc.115 treated `0` as omitted (immediate release, awaited). With `0`, release is scheduled on a forked fiber the last-reference scope does **not** await. |
| **Upstream** | `effect:packages/effect/src/internal/rcRef.ts:82-84`; docs at `effect:packages/effect/src/RcRef.ts:157-172`. |
| **Repo call sites** | `RcRef` **NOT FOUND** in packages/apps. `idleTimeToLive` on `Stream` / `LayerMap` is a different API. |
| **Would tests catch it?** | n/a |
| **Migration effort** | None. |

### 2.8 Other runtime rows with beep-effect coupling

| Change | Repo | Tests | Effort |
| --- | --- | --- | --- |
| POSIX process-group cleanup after **successful** leader exit (`#8245`) | `ChildProcessSpawner` in vault picker (`repo:apps/professional-desktop/src/intake/VaultDirectoryPickerOrchestrator.ts:19-72`) and semantica reasoner (`repo:apps/labs/semantica/src/layers/CanaryC2Live.ts:7,189`). Tests mock the spawner (`repo:apps/professional-desktop/test/vault-directory-picker.test.ts:8-40`) and **would miss** real group cleanup / PID-reuse signalling. | Live kdialog/zenity only. | Low (bugfix). Residual risk: group-id reuse (upstream documents it). |
| `Arbitrary.array` shrinking / replay tokens (`#8221`) | Widespread `fcRuns(...)` property tests (e.g. `repo:packages/workspace/server/test/ThreadStore.test.ts:350`). | Shrinking-order tests or stored replay tokens could flake; most `fcRuns` are run-count, not replay. | Re-run properties if a seed/replay fails; keep failing inputs as regressions. |
| Multipart hang fix (`#8206`) | Server-side Effect multipart. Repo multipart is client-side xAI/Venice. | Existing client multipart tests do not exercise the server hang. | None. |
| OpenAPI generator `File \| Blob` for binary multipart (`#8208`) | `@effect/openapi-generator` via codegen-kit / runpod (`repo:packages/tooling/library/codegen-kit/src/CodegenKit.service.ts:10-12`). | Current generated clients typecheck on the snapshot (spike). Regen may change field types. | Only at next `openapi-generator` regen. |

---

## 3. Snapshot mechanics

### 3.1 `@effect/platform-node-shared` patch

- Key: `repo:package.json:328-331` → `"@effect/platform-node-shared@4.0.0-rc.115": "patches/@effect%2Fplatform-node-shared@4.0.0-rc.115.patch"`.
- Patch rewrites `nodeWrite` / `nodeWriteAll` from `(fd, buffer, undefined, undefined, pos)` to `(fd, buffer, 0, buffer.length, pos)` in **both** `src/NodeFileSystem.ts` and `dist/NodeFileSystem.js`.
- On Effect `a7a71921de`, `NodeFileSystem.ts` **still has** `undefined, undefined` at the same call (`effect:packages/platform/node-shared/src/NodeFileSystem.ts:374` — identical to `effect@4.0.0-rc.115`). The only node-shared product change in the range is `NodeChildProcessSpawner.ts` (`#8245`); `package.json` only bumps `@types/node` / `tinybench`.
- **Source hunks should still apply.** Dist hunks: **UNVERIFIED** without applying the patch to a pkg.pr.new tarball (index hashes in the patch file are from rc.115 dist). If dist of `NodeFileSystem.js` is byte-identical, bun applies; if the snapshot rebuild changed surrounding lines, bun will fail the patch and install the unpatched write (the original bug).
- Spike census: installed snapshot packages still **report version `4.0.0-rc.115`** (`research/25-r4-spike-census.md`). If that holds for `@effect/platform-node-shared`, the **patchedDependencies key still matches**. If a later RC number is baked into the tarball, the key silently stops applying.
- Precedent (#1060): they **re-rolled the patch against the snapshot dist** and renamed the key (`6b1ebc8d33` message: "Re-roll the platform-node-shared NodeFileSystem write patch against the snapshot dist"; later in the same squash, "restore the platform-node-shared write patch keyed to rc.113").

**Options (operator decides):** (a) keep the rc.115-keyed patch if spike versions stay `4.0.0-rc.115` and `bun install` applies it; (b) re-roll + rename as in #1060; (c) drop the patch if upstream ever lands the write-offset fix (it has **not** as of `a7a71921de`).

### 3.2 `@effect/vitest` graph pin

`@effect/vitest` is one of the **16 lockstep** catalog entries (`repo:package.json:46`, consumed via `"catalog:"` across test-kit, cli, docgen, qa-capture, ai-metrics, …). Version-sync treats it as lockstep (`repo:packages/tooling/tool/cli/src/commands/VersionSync/internal/resolvers/EffectResolver.ts:30-32,90-91,118+`). It **must move with `effect`**. There is no vitest changeset in this range; pin it to the same `a7a71921de` URL.

### 3.3 `@effect/tsgo` compatibility

`@effect/tsgo` and platform binaries are **not** lockstep: catalog `0.39.1` (`repo:package.json:37-44`), `NON_LOCKSTEP_EFFECT_PACKAGES = ["@effect/markdown-toc", "@effect/tsgo"]` (`repo:packages/tooling/tool/cli/src/commands/VersionSync/internal/resolvers/EffectResolver.ts:32`). #1060 explicitly excluded tsgo from snapshot lockstep (squash body). Spike `check` passed on **existing** 0.39.1 after two type fixes ⇒ **no tsgo bump required** for this snapshot's types. `c22bc43355` is Effect's own Types-CI Go memory limit, not a tsgo release.

### 3.4 Docgen

- Catalog `@effect/doctest` is lockstep (`repo:package.json:25`) — move it with the 16.
- Repo docgen is `@beep/repo-docgen` (`packages/tooling/tool/docgen`), not `@effect/docgen`.
- `#1060` had to exclude the vendored effect-ontology tree from root scratchpad docgen because snapshot schema types pushed `S.Class` declarations over TS7056. That tree may still need the same exclusion; **UNVERIFIED** on `a7a71921de` (this lane did not run docgen). `latest-dependencies` updates Rolldown inside `@effect/doctest`.

### 3.5 Sibling `@effect/*` packages that must move in lockstep

The 16 effect-family catalog entries at `4.0.0-rc.115` (`repo:package.json:22-36,46,161`):

`effect`, `@effect/ai-anthropic`, `@effect/ai-openai`, `@effect/atom-react`, `@effect/doctest`, `@effect/openapi-generator`, `@effect/opentelemetry`, `@effect/platform-browser`, `@effect/platform-bun`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-pglite`, `@effect/sql-sqlite-bun`, `@effect/sql-sqlite-node`, `@effect/vitest`.

**Stay independently versioned:** `@effect/markdown-toc` `0.1.0`; `@effect/tsgo` + 7 platform packages `0.39.1`.

URL form (version-sync + spike): `https://pkg.pr.new/Effect-TS/effect/<package>@a7a71921de` (`repo:packages/tooling/tool/cli/src/commands/VersionSync/internal/resolvers/EffectResolver.ts:90-91`; test fixture uses `c8349ed` at `repo:packages/tooling/tool/cli/test/version-sync-effect.test.ts:131-145`). Pattern accepts historical `effect-smol` host names too (`EFFECT_SMOL_SNAPSHOT_PATTERN`).

Overrides already force `@effect/platform-node-shared` and tsgo platforms through `catalog:` (`repo:package.json:297-304`).

---

## 4. Precedent: `c8349ed` snapshot campaign (beep-effect #1060)

**Merge:** `6b1ebc8d33` — `feat(repo): pin effect packages to the c8349ed snapshot and migrate to the v4 RC breaking changes (#1060)` (parent `43a625dacd`). Squash contains **both** the snapshot pin **and** the later move back to registry `4.0.0-rc.113`, so `package.json` in that commit's tree shows `rc.112` → `rc.113`, not live pkg.pr.new URLs.

**What the squash body records (cited by commit `6b1ebc8d33`):**

1. **Pin:** all 16 effect-monorepo packages in the root catalog to pkg.pr.new main snapshot commit `c8349ede1a`. URL shape used in tests/resolver today: `https://pkg.pr.new/Effect-TS/effect/<name>@c8349ed` (`repo:packages/tooling/tool/cli/test/version-sync-effect.test.ts:131`; `repo:packages/tooling/tool/cli/src/commands/VersionSync/internal/resolvers/EffectResolver.ts:91`).
2. **Patch:** re-roll `@effect/platform-node-shared` NodeFileSystem write patch **against the snapshot dist**; later in the same squash, restore the patch keyed to `rc.113` (`patches/@effect%2Fplatform-node-shared@4.0.0-rc.112.patch` → `@4.0.0-rc.113.patch` in the commit stat).
3. **Migrate the surface** (306 changesets past rc.112, 90 distilled breaking items): `transformOrFail` → `transformEffect`; Config/Flag/Argument PascalCase; native `effect/unstable/arbitrary/Arbitrary` replacing fast-check; FileSystem sizes → `ByteSize`; `@effect/sql-pg` as the native client; HTTP schemas into `Schema.*`; AI tools `failureMode`; govinfo client regenerated.
4. **Docgen:** name 120 changed workspaces in the changeset; exclude vendored effect-ontology from root scratchpad docgen (TS7056).
5. **Quality:** schema-first arbitrary-coverage detector updated for `it.prop` / `it.effect.prop`; tsgo platforms excluded from snapshot lockstep drift.
6. **Un-pin:** still inside the squash, "move the effect catalog from the c8349ed snapshot to 4.0.0-rc.113" once that RC existed.

**Fixes this snapshot will not have to repeat:** the v4 RC mechanical renames and Arbitrary migration already landed. **Fixes this snapshot will have to repeat:** re-key/re-roll the node-shared patch; lockstep-pin the same 16 URLs; leave tsgo/markdown-toc alone; watch docgen TS7056 on fat `S.Class` trees.

**Difference vs #1060:** `rc.115` → `a7a71921de` is 32 commits / 29 changesets, not 306. Spike typecheck delta is two files. The open risk is **runtime** (especially native sql-pg decode), not a second mechanical migration.

---

## Working-assumption challenges

- **G7 (pin snapshot in its own first PR, no protocol flip):** still implementable (spike install + `check`). It **does** ship silent native sql-pg decode changes (Date vs ms; OID bytes vs text) that typecheck and default PGlite tests will not catch. That is a process risk, not an unimplementable pin.
- **G1:** same pin. No evidence it is unimplementable.
- No evidence against G4/G6/G9 in this lane (MCP-owned).

---

## Gaps / UNVERIFIED

- Dist-level apply of the node-shared patch to the pkg.pr.new tarball (source applies; dist hashes UNVERIFIED).
- Live `pg-external` / `pglite-testcontainers` timestamp and enum decode under the snapshot (not run; default tests use in-process PGlite).
- Full `docgen` on the snapshot (TS7056 risk from #1060).
- Whether drizzle-orm `timestamp({ mode: "string" })` accepts driver-level `Date` values if native sql-pg is used (would be a drizzle interaction, not an Effect type error).

## Gate B verdicts (2026-09-17)

Three grok refuters voted on 15 claims from this lane (14 survive, 1 killed; per-vote detail in `verification/23-r4-snapshot-blast-radius.verdicts.jsonl`).

Struck claims (2 of 3 refuted):

- ~~`23-r4-snapshot-blast-radius-25` (risk): POSIX process-group cleanup after successful leader exit can affect ChildProcessSpawner users (vault picker, semantica); tests mock the spawner and would miss live group cleanup or PID-reuse signalling.~~
  - Refuters: POSIX group cleanup after successful leader exit is real, and vault-picker tests mock the spawner, but semantica Reasoning.test.ts live-spawns via BunServices and would not miss group cleanup the way the claim says.
