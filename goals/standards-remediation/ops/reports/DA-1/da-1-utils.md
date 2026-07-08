# DA-1 — @beep/utils dual-arity fixer report

Wave: DA-1 · Package: `@beep/utils` (`packages/foundation/modeling/utils`)
Entry slice: `goals/standards-remediation/ops/slices/P3/packages_foundation_modeling_utils.json`
Locked ruling applied: R12 (`research/decisions.md`) — native-parity
justification for `UTILS-ARRAY-NATIVE-PARITY` is OVERRIDDEN per the
aggressive-conversion posture; `slice`/`indexOf`/`lastIndexOf` convert,
`spliceInPlace` is attempt-and-flag.

## Disposition table

| qualifiedName | diagnostic | disposition | reason / evidence |
|---|---|---|---|
| `indexOf` | third-param-not-object-like | **fixed** | Collapsed optional `fromIndex` into `options?: { readonly fromIndex?: number }`; `value` stays positional (it's the required search subject, not a trailing option). Same dual-predicate kept (arity varies 2/3). `tsgo -b` clean in `@beep/utils`; only real cross-package call site (`packages/tooling/library/repo-utils/test/Graph.test.ts:21`) passes no `fromIndex` — unaffected, verified with a scoped `@beep/repo-utils` `tsgo -b` + `vitest run test/Graph.test.ts` (20/20 pass). |
| `lastIndexOf` | third-param-not-object-like | **fixed** | Same shape as `indexOf`. Zero real call sites outside this package's own test/dtslint. `tsgo -b` + `vitest run` clean. |
| `slice` | third-param-not-object-like | **fixed** | Collapsed `start`/`end` into `options?: { readonly start?: number; readonly end?: number }` (both were optional trailing "range" params, unlike `indexOf`'s required `value`) — matches the audit-verified diff shape in `ops/reports/P2-audits/p2-d5d8.md`. All 5 real call sites (2 in `@beep/utils` test/dtslint, 3 cross-package: `bin-main.ts`, `quality-tasks.test.ts`, `files-command.test.ts` incl. the negative-`end` usage) swept. 2 zero-arg call sites in `scratchpad/dockview/TabGroupAccent.model.ts` (`A.slice(entries)`) and 1 in `EffectImports.ts:190` need no change (options object is optional). |
| `spliceInPlace` | too-many-positional-params | **needs-driver-review** | Attempted and it compiles/tests clean, but the options-object form measurably sacrifices the rest-param `...items` call ergonomics — see comparison below. Not forcing this as a plain "fixed"; driver should review the diff in `packages/foundation/modeling/utils/src/Array.ts` (currently applied, not reverted) and decide keep-vs-exception. |

## `spliceInPlace` — diff + ergonomics comparison

Diff (applied in the working tree, not reverted — driver's call to keep or revert):

```diff
 export const spliceInPlace: {
-  <T>(start: number, deleteCount?: number, ...items: Array<T>): (self: Array<T>) => Array<T>;
-  <T>(self: Array<T>, start: number, deleteCount?: number, ...items: Array<T>): Array<T>;
+  <T>(options: {
+    readonly start: number;
+    readonly deleteCount?: number;
+    readonly items?: ReadonlyArray<T>;
+  }): (self: Array<T>) => Array<T>;
+  <T>(
+    self: Array<T>,
+    options: { readonly start: number; readonly deleteCount?: number; readonly items?: ReadonlyArray<T> }
+  ): Array<T>;
 } = dual(
-  (args) => args.length >= 2 && A.isArray(args[0]),
-  <T>(self: Array<T>, start: number, deleteCount?: number, ...items: Array<T>): Array<T> => {
+  2,
+  <T>(self: Array<T>, options: { ... }): Array<T> => {
+    const { start, deleteCount, items = [] } = options;
     if (deleteCount === undefined) {
       return self.splice(start);
     }
     return self.splice(start, deleteCount, ...items);
   }
 );
```

Ergonomics comparison:

| | before (rest param) | after (options object) |
|---|---|---|
| drain from index | `spliceInPlace(arr, 0, arr.length)` | `spliceInPlace(arr, { start: 0, deleteCount: arr.length })` |
| remove 1 | `spliceInPlace(arr, i, 1)` | `spliceInPlace(arr, { start: i, deleteCount: 1 })` |
| insert 1 | `spliceInPlace(arr, 1, 0, "x")` | `spliceInPlace(arr, { start: 1, deleteCount: 0, items: ["x"] })` |
| insert many | `spliceInPlace(arr, 1, 0, "a", "b", "c")` | `spliceInPlace(arr, { start: 1, deleteCount: 0, items: ["a", "b", "c"] })` — loses the variadic "just append more args" shape, now requires an array literal |

The remove-only cases (both real cross-package call sites — see below — are
remove-only, zero `items`) read about the same either way. The multi-item
insert case is where the rest-param form is genuinely more ergonomic; no real
call site in this repo currently exercises multi-item insert, so the cost is
theoretical today but real for future callers.

## Call-site sweep (repo-wide `rg` for `A.(indexOf|lastIndexOf|slice|spliceInPlace)`)

All real call sites found and swept (5 for `slice` as the audit counted, plus
the previously-uncounted 2 zero-arg `scratchpad` sites which needed no
change):

| symbol | file | change |
|---|---|---|
| `slice` | `packages/tooling/tool/cli/src/bin-main.ts:118` | `A.slice(process.argv, 2)` → `A.slice(process.argv, { start: 2 })` |
| `slice` | `packages/tooling/tool/cli/test/quality-tasks.test.ts:668` | `A.slice(steps, 1)` → `A.slice(steps, { start: 1 })` |
| `slice` | `packages/tooling/tool/cli/test/files-command.test.ts:2138` | `A.slice(args, 0, -2)` → `A.slice(args, { start: 0, end: -2 })` (negative `end` preserved) |
| `slice` | `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:190` | zero-arg call, no change needed |
| `slice` | `scratchpad/dockview/TabGroupAccent.model.ts:123,148` | zero-arg calls, no change needed |
| `spliceInPlace` | `packages/tooling/tool/cli/test/sync-data-to-ts.test.ts:239` | `A.spliceInPlace(targets, index, 1)` → `A.spliceInPlace(targets, { start: index, deleteCount: 1 })` |
| `spliceInPlace` | `packages/drivers/acp/src/AcpClient.service.ts:425` | `A.spliceInPlace(registration.pending, 0, A.length(registration.pending))` → `A.spliceInPlace(registration.pending, { start: 0, deleteCount: A.length(registration.pending) })` |
| `indexOf` | `packages/tooling/library/repo-utils/test/Graph.test.ts:21` | 2-arg call, no `fromIndex`, no change needed |
| `lastIndexOf` | (none outside this package) | — |

In-package (`@beep/utils`) test/dtslint updates: `test/Array.test.ts` (4
call sites: `indexOf` fromIndex usage, `lastIndexOf` fromIndex usage, `slice`
range usage, `spliceInPlace` usage) and `dtslint/Array.tst.ts` (4 call sites:
`slice` ×2, `spliceInPlace` ×2). Module doc updated for `slice` and
`spliceInPlace` (dropped the "mirrors/preserves native X semantics" framing
now that the positional shape no longer matches native `Array.prototype`
methods); `indexOf`/`lastIndexOf` docs gained a `fromIndex`-options example.

## Files touched

In-package:
- `packages/foundation/modeling/utils/src/Array.ts`
- `packages/foundation/modeling/utils/test/Array.test.ts`
- `packages/foundation/modeling/utils/dtslint/Array.tst.ts`

Out-of-package (pre-authorized per the driver's ruling for these 4 symbols):
- `packages/tooling/tool/cli/src/bin-main.ts`
- `packages/tooling/tool/cli/test/quality-tasks.test.ts`
- `packages/tooling/tool/cli/test/files-command.test.ts`
- `packages/tooling/tool/cli/test/sync-data-to-ts.test.ts`
- `packages/drivers/acp/src/AcpClient.service.ts`

Not touched (call sites verified unaffected, no edit needed):
- `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts`
- `scratchpad/dockview/TabGroupAccent.model.ts`
- `packages/tooling/library/repo-utils/test/Graph.test.ts`

## Commands run + outcomes

- `npx tsgo -b tsconfig.json` in `packages/foundation/modeling/utils` — 0 errors.
- `npx vitest run` in `packages/foundation/modeling/utils` — 13 files, **157/157 pass**.
- `bun run docgen` in `packages/foundation/modeling/utils` — succeeded; 26 modules, 201 examples typechecked (covers the updated `@example` blocks for all 4 converted helpers).
- `npx tsgo -b tsconfig.json` in `packages/tooling/tool/cli` — 0 errors.
- `npx vitest run test/quality-tasks.test.ts test/files-command.test.ts test/sync-data-to-ts.test.ts` in `packages/tooling/tool/cli` — **120/120 pass**.
- `npx tsgo -b tsconfig.json`, `npx tsgo -p tsconfig.scripts.json --noEmit`, `npx tsgo -p tsconfig.test.json --noEmit` in `packages/drivers/acp` — 0 errors each.
- `npx vitest run --passWithNoTests --exclude='test/integration/**'` in `packages/drivers/acp` — **15/15 pass**.
- `npx tsgo -b tsconfig.json` in `packages/tooling/library/repo-utils` — 0 errors.
- `npx vitest run test/Graph.test.ts` in `packages/tooling/library/repo-utils` — **20/20 pass**.
- `npx tsgo -b tsconfig.json` in `scratchpad` — pre-existing unrelated failures in `explore/**` and `identity/Ontology.ts` (confirmed via `rg -i TabGroupAccent` on the error output — zero hits); not caused by this lane, zero-arg `A.slice` calls there are unaffected regardless.
- Repo-wide `rg -n "\bA\.(slice|indexOf|lastIndexOf|spliceInPlace)\("` re-run after all edits — confirms no unconverted argful call site remains.

Did not touch `standards/*.jsonc`, run repo-wide `turbo`, `yeet`, or regenerate
any inventory. No commits made.
