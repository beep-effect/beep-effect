# t3code's Alchemy patches (2026-11-06)

Operator pointer: `~/YeeBois/references/effect/t3code/patches/alchemy@2.0.0-beta.85.patch` and
`~/YeeBois/references/effect/t3code/patches/@alchemy.run__test@2.0.0-beta.85.patch`.

## `alchemy@2.0.0-beta.85` — `Artifacts.cached` settles waiters on failure

Patch body (`lib/Artifacts.js`, 15 lines):

```diff
-    const result = yield* eff;
-    yield* Deferred.succeed(deferred, result);
+    // Settle waiters on failure too, or every later caller hangs.
+    const result = yield* eff.pipe(Effect.onExit((exit) => Deferred.done(deferred, exit)));
```

Without it a failed cached artifact effect leaves the `Deferred` pending and every later caller
of the same artifact id hangs instead of failing. Upstream `main` already carries the fix
(`packages/alchemy/src/Artifacts.ts:141-143` at `17fb76f4f`, `Effect.onExit` +
`Deferred.done`), so it is release-lag, not a fork. **Action for P1:** carry the same patch as a
bun `patchedDependencies` entry on the catalog pin until the first release after beta.85 ships
`Artifacts.ts` with `onExit`; drop it in that bump PR (D13: npm pins, deliberate bumps; a patch
on a published version keeps the pin intact). Verify at bump time with
`grep -n onExit node_modules/alchemy/lib/Artifacts.js`.

## `@alchemy.run/test@2.0.0-beta.85` — vitest hooks from `vite-plus/test`

Patch body (`lib/Vitest.js`, 13 lines): swaps the `afterAll/afterEach/beforeAll/beforeEach`
import from `vitest` to `vite-plus/test`. t3code runs its tests under vite-plus; beep-effect
runs `vitest` with `@effect/vitest` and `@beep/test-runner`, and upstream `main` still imports
from `vitest` (`packages/alchemy-test/src/Vitest.ts:14`). **Not needed here.** Revisit only if
the repo adopts vite-plus.

## Sources

- `~/YeeBois/references/effect/t3code/patches/` (listing taken 2026-11-06).
- `~/YeeBois/references/effect/alchemy` at `17fb76f4f`.
