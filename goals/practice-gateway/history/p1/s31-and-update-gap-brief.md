# Brief — S31 inventory zero + bootstrapper update gap (2026-10-15)

Operator ruling S31 (2026-10-15): no new entries in standards debt/exception
inventories; a PR that grows one is not final. This lane currently adds three
`standards/effect-vitest.inventory.jsonc` exceptions. Remove all three by
fixing the code, then delete the rows (introduced = 0).

1. **EV010 `packages/law-practice/server/test/PracticeKgHost.test.ts`** —
   imports `@effect/platform-bun/BunFileSystem` to rerun bundle-loading cases
   on the native file system. Keep the in-memory file system arm only; real
   bundle reads stay proven by `apps/practice-kg-mcp/test/Host.test.ts`
   (its own pre-existing row on main is not this lane's). Delete the row.
2. **EV011 + EV012 `apps/practice-gateway/test/LazyPracticeKg.test.ts`** —
   `vi.mock` of the DuckDB module through a direct `vitest` import. Make the
   lazy practice-kg loading an injectable `Context.Service` (e.g.
   `PracticeKgModuleLoader` with `load: Effect<loaded module surface,
   ProviderUnavailable>`); the live layer does the dynamic import with the
   rejection mapped to a typed error; tests provide a failing loader layer
   with `@effect/vitest` only. Keep the behavior proof: the gateway starts,
   `setup_status` answers, practice-kg reports "engine could not be loaded".
   Delete both rows.

3. **Bootstrapper update gap (proof run 3).** The VM had gateway 0.1.0
   installed; `practice-setup.exe` embedding 0.1.1 printed "Click Update",
   then reached the hand-off while
   `%APPDATA%\Claude\extensions-installations.json` still listed 0.1.0.
   Read `apps/practice-setup/src/Setup.program.ts` installGateway: find why
   it continued (watch timeout fallback? Enter override? version compare?)
   and make the step finish `done` only when the registry shows the bundled
   version, or `failed` with a plain instruction (drag the file onto Settings
   → Extensions) after the watch times out — never silently continue to the
   hand-off on a stale version. Test it with fakes.

Gates: `bun run beep lint effect-vitest` reports 0 lane-introduced rows and
the inventory diff vs origin/main adds no rows; package-verify for every
touched package; cheap gates green. Commit; do not push.
