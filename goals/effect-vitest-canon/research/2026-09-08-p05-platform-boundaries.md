# P0.5 platform boundaries — Bun `fs.write` overload and `@effect/tsgo` provide/pipeable diagnostics

**Lane file:** `goals/effect-vitest-canon/research/2026-09-08-p05-platform-boundaries.md`
**Phase:** bounded research follow-up (not P0f, not implementation)
**Pin:** `@effect/vitest@4.0.0-rc.112` = `2600f62f4532026928454dcea8d1c48557b3f942`
**Started:** 2026-09-08 (session-local clock; not a git timestamp)
**Status:** complete

Root-reproduced runtime facts are accepted as given and were not re-run. No patch was applied. Goal decisions and the pending copy error-path choice are untouched.

## Evidence labels

- **Verified (snapshot):** `~/.cache/beep/effect-vitest-canon/effect-rc112/` at the pin SHA.
- **Verified (worktree, read-only):** sibling `effect-vitest-filesystem` sources named below. The source writer is active there; this lane did not edit them.
- **Verified (runtime evidence files):** `~/.cache/beep/effect-vitest-canon/p05-raw-write-runtime.json` and `p05-pinned-write-cursor-runtime.json` (results only; command arrays in the latter contain host paths and are not copied here).
- **Verified (web, 2026-09-08 / 2026-09-09):** HTTP fetch of a primary URL. Live `main` may post-date `@effect/tsgo@0.39.1`; rule source was also fetched at tsgo commit `9f2e8e2b00e1b48033c941dc07e475006b15ce75` (`@effect/tsgo-win32-x64@0.39.1` tag).
- **Inference:** interpretation of verified facts.
- **Dated estimate:** moving-target status (open PR, live docs) as of the fetch date.
- **Given (root, not re-run):** Node v24.20.0 / Bun 1.4.1 / Bun 1.4.2 cursor-write and raw `fs.write` results.

## Progress log

- 2026-09-08: created this owned report.
- 2026-09-08: read pin `NodeFileSystem.ts` write sites, FileSystem conformance helper, tsconfig/Quality directive policy, Dual, Layer.isLayer.
- 2026-09-08/09: primary web: Node v24.20.0 `lib/fs.js` `write`/`writeSync`; Node fs docs; Bun PR `#37647` (open, unmerged); `@effect/tsgo` rule Go source + directive parser.
- 2026-09-08: observed sibling worktree `node_modules/@effect/platform-node-shared` already contains the two-call numeric form (version string still `4.0.0-rc.112`). Tag snapshot still has `undefined`. Reported as observation, not as an applied patch from this lane.
- 2026-09-08: wrote findings.

---

## A. Bun/Node `fs.write` overload incompatibility

### A.1 What rc.112 actually calls

Tag snapshot `packages/platform/node-shared/src/NodeFileSystem.ts`:

- `nodeWriteFactory` 244–251: `effectify(NFS.write, …)` — the **callback** `fs.write`, not `writeSync`.
- `FileImpl.write` 340–354, line **344**:
  `nodeWrite(this.fd, buffer, undefined, undefined, this.append ? undefined : Number(position))`
- `FileImpl.writeAllChunk` 356–380, line **360**:
  `nodeWriteAll(this.fd, buffer, undefined, undefined, this.append ? undefined : Number(position))`
- After a short write, `writeAllChunk` retries `buffer.subarray(bytesWritten)` (378) — a new view whose `.length` is the remainder, offset 0 into that view.
- Append mode passes `position = undefined` so the kernel uses the current fd offset (344, 360). Linux positional writes are ignored in append mode; Effect already avoids sending a number in that case.
- Path `writeFile` (613–632) uses `NFS.writeFile(path, data, { flag, mode })`, **not** this five-argument form. The `r+` overwrite-without-truncate case in the conformance helper is that path, not `File.write`.

The cursor-write conformance case (tag `packages/effect/test/FileSystem.test-utils.ts` 284–311; ported helper keeps the same sequence) does `fs.open(..., { flag: "w+" })` then `file.write` / `file.seek` / `file.write("hello world")` after seeking back four bytes. That is **exactly** `FileImpl.write` → `fs.write(fd, buffer, undefined, undefined, position)`.

**Given (root):** Node v24.20.0 passes that test under both public Node and Bun FileSystem aliases. Bun 1.4.1 and 1.4.2 fail: after the seek, `hello world` is appended instead of overwriting. Both public layers re-export this shared implementation.

### A.2 Node semantics (primary, v24.20.0)

Node docs: https://nodejs.org/docs/latest-v24.x/api/fs.html#fswritefd-buffer-offset-length-position-callback
Source: https://github.com/nodejs/node/blob/v24.20.0/lib/fs.js (`write` and `writeSync`).

Callback `write` for an `ArrayBufferView` (the Effect path):

1. `offset == null || typeof offset === 'function'` → `offset = 0`; else `validateInteger(offset, 'offset', 0)`.
2. `typeof length !== 'number'` → `length = buffer.byteLength - offset`.
3. `typeof position !== 'number'` → `position = null` (current file position; not a positional `pwrite`).
4. `validateOffsetLengthWrite(offset, length, buffer.byteLength)` always runs.
5. `binding.writeBuffer(fd, buffer, offset, length, position, req)`.

`writeSync` is the same per-slot defaulting (`offset == null` → 0; non-number length → `byteLength - offset`). Bun PR `#37647` cites Node v26.3.0 `writeSync` L893–L900 for the same rules. v24.20.0 matches that structure.

So `fs.write(fd, buf, undefined, undefined, position)` on Node **means** `fs.write(fd, buf, 0, buf.byteLength, position)`. Root’s isolated probe agrees: writing `abcde` at 0 then `XY` at 2 with undefined offset/length yields `abXYe` on Node.

`offset` is an index **into the view**, not `ArrayBuffer.byteOffset`. Node then writes `length` bytes from that view index. Passing `buffer.byteOffset` as `offset` would be wrong for a `subarray` / sliced `Buffer`.

### A.3 Bun cause, known fix, versions

Primary source: https://github.com/oven-sh/bun/pull/37647
Fetched 2026-09-08/09 via HTML + GitHub API.

| Field | Value |
| --- | --- |
| Title | `fs: honor length and position in write/writeSync when offset is undefined` |
| State | **open**, `merged: false`, `closed_at: null` |
| Head | `15c9099634772d07a46ea37afbe6c87e24545216` |
| Created | 2026-08-11; last PR `updated_at` 2026-08-12 |
| Assignee | Jarred-Sumner |

Cause (PR body, **verified web**): Bun’s native `args::Write::from_js` (`src/runtime/node/node_fs.rs`) **stops parsing at the first unusable slot**. `undefined`/`null`/function `offset`, or a non-numeric `length`, drops every later slot. `length` and `position` are ignored. A lost `position` becomes “write at the current fd offset”, which looks like append. That is the cursor-test failure mode.

PR table (Bun 1.4.0 “before” vs Node v26.3.0):

| call | Node | Bun before |
| --- | --- | --- |
| `writeSync(fd, buf, undefined, 8, 0)` | 8 bytes at 0 | whole buffer appended |
| `writeSync(fd, buf, 4, undefined, 0)` | rest of buffer at 0 | position ignored (appended) |

`filehandle.write` was already correct (JS normalizes first). The Effect path uses callback `fs.write`, which the PR says has the same parser defect.

**Dated estimate:** this fix is **not** in Bun 1.4.1 or 1.4.2 (root’s failures). It is **not merged** as of the 2026-09-09 API read. Waiting for a Bun release is not a pin-preserving path.

Related but distinct: PR `#36135` (NaN `position` coerced to 0 / `createWriteStream` head overwrite) and `#37632` (offset bounds when length is omitted). Those are not this slot-bail bug.

### A.4 Assessed two-call patch (not applied by this lane)

Replace only the two `undefined, undefined` slots, keep the append ternary:

```ts
nodeWrite(this.fd, buffer, 0, buffer.length, this.append ? undefined : Number(position))
nodeWriteAll(this.fd, buffer, 0, buffer.length, this.append ? undefined : Number(position))
```

Prefer `buffer.byteLength` over `buffer.length` if a one-token choice is needed: Node’s default is `buffer.byteLength - offset`. For `Uint8Array` (the `File.write` parameter type) they are equal. Do **not** pass `buffer.byteOffset`.

This is Node’s own defaulting, made explicit so Bun’s parser does not bail before `position`.

Root’s isolated probe (**given**): explicit `offset 0` + `buffer.length` yields `abXYe` on Node, Bun 1.4.1, and Bun 1.4.2. That is the behavioral proof that this exact argument shape closes the incompatibility without waiting for `#37647`.

### A.5 Uint8Array views, partial writes, append, regressions

| Concern | Assessment |
| --- | --- |
| Full `Uint8Array` / `Buffer` | `0` + `.length` / `.byteLength` writes the whole view. Matches Node defaults. |
| `subarray` remainder in `writeAllChunk` | Retry buffer is a view starting at 0 of the remainder. `0, buffer.length` writes that remainder. Using the parent’s `byteOffset` would double-count. **Verified** tag 378. |
| Partial / short writes | Unchanged: `bytesWritten < buffer.length` recurses. Cursor advances by `bytesWritten` only when not appending (347–349, 374–376). |
| Empty buffer | `length === 0`. Node `validateOffsetLengthWrite(0, 0, 0)` then writes 0 bytes. `writeAllChunk` already treats `bytesWritten === 0` as `WriteZero` (362–371). Not introduced by the patch. |
| Append (`this.append`) | Fifth argument stays `undefined`. Bun and Node then use current fd position. Linux ignores numeric position in append mode (Node docs; also restated in older Bun `node_fs.zig` comments). |
| `writeFile` / `r+` | Different API (`fs.writeFile`). Not these two calls. Do not widen the patch. |
| String `fs.write` overload | Not used (`effectify(NFS.write)` with a `Uint8Array`). |
| Cursor test | Seeks back four bytes, writes `hello world` at a numeric position. Explicit offset/length is what makes Bun honor that position. **Given.** |

**Risks that need a regression (still no skip):**

1. Re-run the **pinned** cursor-write case on Node v24.20.0 **and** Bun 1.4.1/1.4.2 after the two-call change. Node must stay green (root already showed Node accepts both shapes).
2. Keep the append-mode cursor tests (`should maintain a read cursor in append mode` / restore-after-append in the tag helper). Those depend on `position` remaining `undefined` when `this.append` is true.
3. Do not upgrade `@effect/platform-node-shared` or Bun. Keep rc.112 pins. A local overlay of the two calls (or equivalent) is the smallest behavior-preserving path; merging Bun `#37647` is a future runtime fix, not a pin strategy.

### A.6 Sibling worktree observation (not this lane’s patch)

Read-only: `effect-vitest-filesystem/node_modules/@effect/platform-node-shared` is still `"version": "4.0.0-rc.112"`, but **src 344/360 and dist ~210/222 already use `0, buffer.length`**. The tag snapshot still has `undefined, undefined`. **Inference:** an in-place edit of that install, or a patched copy, by the active source writer. This lane did not apply it. Treat the tag snapshot as the pin; treat the sibling tree as a live experiment of the assessed patch.

**Smallest path (recommendation, not applied):** change those two argument lists only; keep append `undefined`; keep rc.112; keep every conformance assertion, including the cursor-write test.

---

## B. `@effect/tsgo` `TS377032` / `TS377101` on the public helper

### B.1 What the helper is required to do

`effect-vitest-filesystem/packages/tooling/test-kit/test-utils/src/FileSystemConformance.ts`:

- Public registration API 132: `export const testLayer = <E>(layer: Layer.Layer<Fs.FileSystem, E>, options: TestLayerOptions = {}): void`
- JSDoc 100–108: D14 exception — per-test `Effect.provide(layer)` because the layer is the subject.
- **21** `.pipe(..., Effect.provide(layer))` call sites (grep of that file). Matches the reported `TS377032` count.

### B.2 Rule implementations (primary)

Installed `@effect/tsgo` **0.39.1** (`node_modules/@effect/tsgo/package.json`). Diagnostic catalog in `dist/effect-tsgo.cjs` 49578–50368: `strictEffectProvide` = `TS377032`; `missingPipeableSignature` = `TS377101`. Default severity of both is **off**; this repo sets them to **error** in `tsconfig.base.json` 120 and 155.

Go source at tsgo commit `9f2e8e2b00e1b48033c941dc07e475006b15ce75` (tag `@effect/tsgo-win32-x64@0.39.1`) and current `main` for `strict_effect_provide.go` are the same algorithm. `main` `LayerType` call has an extra location argument; that does not add entry-point detection.

#### `strictEffectProvide` — **no test/entry-point recognizer**

https://raw.githubusercontent.com/Effect-TS/tsgo/9f2e8e2b00e1b48033c941dc07e475006b15ce75/internal/rules/strict_effect_provide.go

The rule:

1. Walks **every** `CallExpression` in the file.
2. If the callee is Effect module API `provide`.
3. If **any argument’s type** is a Layer.
4. Emit `TS377032` on the call.

There is **no** check for:

- file name (`*.test.ts`, `FileSystemConformance.ts`)
- `it.effect` / Vitest callbacks
- exported vs local
- function names (`main`, `testLayer`, `run`)
- “entry point” in any structural sense

The diagnostic **text** says “If this is an entry point, you can safely disable this diagnostic.” That is the **only** documented exemption, and it means a **severity disable**, not a silent allow-list. Docs: https://github.com/Effect-TS/tsgo/blob/main/docs/rules/strict-effect-provide.md (generated; same message).

So: genuine test-registration callbacks **cannot** be recognized by 0.39.1 without disabling the diagnostic. Hiding `Effect.provide` behind an alias in another module would move the call (and might silence *this* file) — that is the “aliases/reflection” path the user forbids, and the helper would still be providing a Layer.

`Effect.provideService` is a different API name; the rule matches `"provide"` only. Switching to `provideService` cannot inject a Layer and would change the required public contract. Not a feasible substitute.

#### `missingPipeableSignature`

https://raw.githubusercontent.com/Effect-TS/tsgo/main/internal/rules/missing_pipeable_signature.go

- Only **exported** module members.
- A call signature is “data-first eligible” iff it has **no rest parameter** and **≥ 2 parameters** (`isEligibleDataFirstSignature`).
- For each such signature, it looks for **another** call signature on the same export that `MatchesPipeableSignature` with subject index `0` **or** last parameter.
- Preview: `export const getAt = (self, index) => …` with a single 2-arg signature.

`testLayer<E>(layer, options = {})` is one 2-parameter signature (optional second param still counts). It is eligible and has no pipeable sibling → `TS377101`. **Verified** against the reported diagnostic at line 132.

### B.3 Dual / pipeable overload — does **not** change the two-option data-first contract if done with a predicate

Effect Dual at the pin (`packages/effect/src/Function.ts` 40–157):

- `Function.dual(2, body)` is data-first **only when `arguments.length >= 2`**. One argument is treated as data-last: `(options) => (layer) => body(layer, options)`.
- **`testLayer(layer)` is currently the one-argument public form.** Arity-2 Dual would make that return a function instead of registering tests. That **would** change the required API. Do not use `dual(2, …)` here.
- `Function.dual(isDataFirst, body)` exists specifically “when optional arguments make arity ambiguous” (50–52, 84–96).

Feasible Dual that **keeps** `testLayer(layer)` and `testLayer(layer, options)`:

```ts
export const testLayer: {
  <E>(options?: TestLayerOptions): (layer: Layer.Layer<Fs.FileSystem, E>) => void
  <E>(layer: Layer.Layer<Fs.FileSystem, E>, options?: TestLayerOptions): void
} = Function.dual(
  (args) => Layer.isLayer(args[0]),
  <E>(layer: Layer.Layer<Fs.FileSystem, E>, options: TestLayerOptions = {}): void => { /* existing body */ }
)
```

`Layer.isLayer` is on the pin (`packages/effect/src/Layer.ts` 276).

Effects of that shape:

- `testLayer(layer)` and `testLayer(layer, options)` stay data-first (first arg is a Layer). **Required contract preserved.**
- `testLayer(options)(layer)` and `pipe(layer, testLayer(options))` become legal. New, optional, pipeable form.
- `testLayer()` with zero args: `isLayer(undefined)` is false → returns `(layer) => body(layer, undefined)` which hits the default `{}`. New zero-arg pipeable form; currently a type error. Does not remove the two-option data-first form.
- Repo Dual/pipeable law: this is the documented Dual predicate case. `missingPipeableSignature` should see two call signatures, one eligible data-first, one pipeable. **Inference** until tsgo is re-run (this lane did not run it).
- `void` return is unusual for pipe, but the rule does not require a useful pipe result; it requires a matching overload.

This addresses **TS377101 only**. It does **not** touch `Effect.provide` and does **not** clear TS377032.

### B.4 Exemption mechanics vs repo policy

| Mechanism | What it does | Allowed here? |
| --- | --- | --- |
| `@effect-diagnostics` / `-next-line` / `:off` / `:skip-file` | Official tsgo suppression (`internal/directives/parser.go`; message “safely disable”). | **Forbidden** by `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts`: scans `apps|packages|tooling|infra` `*.ts(x)` for `//` or `/*` lines matching `@effect-diagnostics`; `runTsgoRulesCheck` fails on any hit (`assembleTsgoRuleDiagnostics` “disabled Effect diagnostic directives”; test `quality-tsgo-directives.test.ts`). |
| `diagnosticSeverity.strictEffectProvide: "off"` (or missingPipeable) in any scanned tsconfig | Official plugin config. | **Forbidden** as a global/workspace profile: `tsconfig.base.json` sets both to `"error"`; Quality also fails on `diagnosticSeverity` entries set to `"off"` except the sanctioned Effect-Drizzle `missedPipeableOpportunity` carve-out. |
| Named helper / `it.effect` callback / “this is a test entrypoint” | — | **Not implemented** in 0.39.1. The rule cannot see it. |
| Move `Effect.provide(layer)` to another module / alias / `Function.identity` wrapper | Might silence *this* file if the Layer-typed call is gone. | User-forbidden hiding. The provide still has to exist for D14. |
| `Function.dual` predicate + extra call signature | Satisfies `missingPipeableSignature` without changing data-first `testLayer(layer[, options])`. | **Feasible for TS377101.** Does not help TS377032. |
| Local file suppression despite Quality | Only if Quality’s directive scan and severity-off scan are waived for this file. | **Explicit policy question. Not permission.** Official tsgo text invites disable-if-entrypoint; repo Quality currently treats that as a hard fail. |

### B.5 Concrete choices (no implementation)

1. **TS377101 — do Dual-with-`Layer.isLayer`, keep data-first.** Smallest type-law fix. Does not alter the two-option registration contract. Re-run tsgo to confirm `MatchesPipeableSignature` accepts optional `options`. If the optional second parameter confuses the matcher, make the pipeable overload take a **required** `TestLayerOptions` (`testLayer(options)(layer)`) while data-first keeps `options?`. That still preserves `testLayer(layer)`.

2. **TS377032 — no mechanical green path under current repo policy + required `Effect.provide(layer)`.** The 21 calls are exactly what the rule flags. 0.39.1 will keep flagging them until either:
   - policy allows a **local** disable (file directive or package `diagnosticSeverity` exception recorded in Quality), which the official message describes as the entry-point hatch; or
   - tsgo grows a real test/entrypoint recognizer (not present now; would be an upstream change, not this packet).

3. **Do not** skip tests, rename `provide`, wrap the Layer in `Layer.succeed` theatre, or turn `testLayer` into `it.layer` (that would share the subject volume and violate D14).

**Policy conflict (real):** D14 + user instruction require 21 visible `Effect.provide(layer)` registrations. `strictEffectProvide` at error plus Quality’s ban on the only official exemption means the helper **cannot** be tsgo-clean for TS377032 without a recorded policy exception. Dual can clear TS377101 without that exception.

---

## Sources

### Local

- `~/.cache/beep/effect-vitest-canon/effect-rc112/packages/platform/node-shared/src/NodeFileSystem.ts` 244–251, 340–380, 613–632
- `~/.cache/beep/effect-vitest-canon/effect-rc112/packages/effect/test/FileSystem.test-utils.ts` 284–311
- `~/.cache/beep/effect-vitest-canon/effect-rc112/packages/effect/src/Function.ts` 40–157 (`dual`)
- `~/.cache/beep/effect-vitest-canon/effect-rc112/packages/effect/src/Layer.ts` 276 (`isLayer`)
- `~/.cache/beep/effect-vitest-canon/p05-raw-write-runtime.json` — Node `abXYe` both shapes; Bun 1.4.1/1.4.2 `abcdeXY` when offset/length undefined, `abXYe` when explicit
- `~/.cache/beep/effect-vitest-canon/p05-pinned-write-cursor-runtime.json` — Node 2/2 pass; Bun 1.4.1 and 1.4.2 0/2 fail (command arrays not quoted)
- `effect-vitest-filesystem/packages/tooling/test-kit/test-utils/src/FileSystemConformance.ts` 100–132 and 21 `Effect.provide(layer)` sites
- `effect-vitest-filesystem/node_modules/@effect/platform-node-shared/{package.json,src/NodeFileSystem.ts,dist/NodeFileSystem.js}` — version rc.112; write sites already numeric (sibling-tree observation)
- `tsconfig.base.json` 120, 155
- `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts` 331–373, 2272–2340
- `packages/tooling/tool/cli/test/quality-tsgo-directives.test.ts`
- `node_modules/@effect/tsgo/package.json` version `0.39.1`
- `node_modules/@effect/tsgo/README.md` rule table (TS377032 / TS377101)
- `node_modules/@effect/tsgo/dist/effect-tsgo.cjs` 49578–50368 catalog
- `packages/foundation/ui-system/ui/src/lib/react-invariant.ts` 74–78 — existing Dual/`missingPipeableSignature` comment (not authority for this helper)

### Web (2026-09-08 / 2026-09-09)

- https://nodejs.org/docs/latest-v24.x/api/fs.html#fswritefd-buffer-offset-length-position-callback — Node v24.20.0 docs; source link `lib/fs.js` at v24.20.0
- https://github.com/nodejs/node/blob/v24.20.0/lib/fs.js — `write` / `writeSync` per-slot defaults
- https://github.com/oven-sh/bun/pull/37647 — open, unmerged; parser bails on undefined offset
- https://api.github.com/repos/oven-sh/bun/pulls/37647 — `state: open`, `merged: false`, `closed_at: null`, head `15c9099…`
- https://github.com/oven-sh/bun/pull/36135 — related NaN position (not this bug)
- https://github.com/oven-sh/bun/pull/37632 — related offset bounds (not this bug)
- https://github.com/Effect-TS/tsgo/blob/main/docs/rules/strict-effect-provide.md
- https://github.com/Effect-TS/tsgo/blob/main/docs/rules/missing-pipeable-signature.md
- https://raw.githubusercontent.com/Effect-TS/tsgo/9f2e8e2b00e1b48033c941dc07e475006b15ce75/internal/rules/strict_effect_provide.go — 0.39.1-era implementation
- https://raw.githubusercontent.com/Effect-TS/tsgo/main/internal/rules/strict_effect_provide.go — live `main` (same walk; extra `LayerType` arg)
- https://raw.githubusercontent.com/Effect-TS/tsgo/main/internal/rules/missing_pipeable_signature.go
- https://raw.githubusercontent.com/Effect-TS/tsgo/main/internal/directives/parser.go
- https://api.github.com/repos/Effect-TS/tsgo/tags — `@effect/tsgo-win32-x64@0.39.1` → `9f2e8e2b00e1b48033c941dc07e475006b15ce75`
- https://github.com/Effect-TS/tsgo — project landing / rule index
