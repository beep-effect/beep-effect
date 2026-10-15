# Gate repair wave 1 (2026-10-14)

`bun run beep yeet publish` refused the push at `22cff1d8b4` (lane merged with
origin/main). Every finding below is **introduced** by this lane. Fixed by the
orchestrator already: goals:doctor phase status (`done` → `complete`) and the
retired pre-top-level process module path (now `effect/process`) in `gateway-app-brief.md`.

Remaining, to fix in one wave:

1. **schema-first (error)**: `apps/practice-gateway/src/WindowsHost.ts ::
   WindowsHostShape [exported-interface]`. Model the service shape the way
   the repo's ports do (`S.Class` with `Fn({ input, output: EffectOutput… })`
   fields, e.g. `packages/law-practice/use-cases/src/PracticeSetup/PracticeSetup.ports.ts`),
   not an inventory exception. Two `SFV4-arbitrary-tests` warnings
   (`apps/practice-gateway/test/Approvals.test.ts`,
   `packages/law-practice/domain/test/PracticeSetup.test.ts`) are advisory:
   add one schema-derived property test each where cheap (`Arbitrary` from the
   schema + round-trip), otherwise leave.
2. **effect-vitest**: 27 new findings — `apps/practice-gateway/test/{Probes,ProfileStore,Requirements,WindowsHost}.test.ts`,
   `packages/drivers/windows-secrets/test/WindowsSecrets.service.test.ts`,
   `packages/law-practice/server/test/PracticeKgHost.test.ts`,
   `packages/law-practice/use-cases/test/PracticeSetup.test.ts`. Read the
   rule text (`bun run beep lint effect-vitest --rows` or the lint source
   under `packages/tooling/tool/cli/src/commands/Lint/`) and fix the tests to
   the canonical form; do not refresh the baseline to hide new findings.
3. **quality:cache-policy**: `BLOCK unreviewed-expansion` for
   `@beep/windows-secrets#{docgen,lint,lint:deprecated-apis,lint:jsdoc,lint:laws,test}`
   (and check `@beep/practice-gateway` once windows-secrets is clear). Find the
   reviewed-policy record mechanism in `bun run beep quality cache-policy --help`
   / its source and record the review for the new packages the same way other
   new packages did (look at git history for a recent package addition).
4. **fallow dead code (blocking, introduced)**:
   - `packages/drivers/windows-secrets/scripts/smoke.ts` unused file → make it
     a declared entry the way `packages/drivers/box` declares its scripts (or
     the fallow entry config), not a blanket ignore.
   - `apps/practice-gateway/test/fixtures.ts` export `folders` unused → remove
     or use.
5. **fallow duplication (blocking, introduced)**: 11 clone groups, almost all
   `apps/practice-gateway/src/package.ts` vs `apps/practice-kg-mcp/src/package.ts`
   (DuckDB sidecar pin + download, bun compile args, copyDirectory,
   assertArchive, archive allowlist, Windows bindings). Extract the shared
   `.mcpb` packaging pieces into one shared module both apps import (pick the
   right home per `standards/ARCHITECTURE.md` "How To Use This Standard";
   likely a tooling library created with `bun run beep create-package`), keep
   each app's manifest/user_config/tool list app-local, and prove both
   bundles still build (`package:mcpb:linux` for both apps; practice-kg-mcp
   `smoke:compiled`).

Gate commands to rerun until clean (from the lane root):
`bun run beep quality github-checks cheap-gates --collect-all` (via `beep-heavy`),
plus `bun run beep quality package-verify` for every package touched.
