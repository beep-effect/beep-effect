# One-Round Loop — Sources

## Provenance

This packet skipped the explorations/ round (locked decision D5): it was
born crystallized from the crispening closeout and grilled directly.

- Originating reflection:
  `goals/repo-crispening-orchestration/history/reflections/2026-07-07-claude.md`
  — the measured account of ten CI rounds, the failure classes, and the
  two highest-leverage fixes.
- Grill session: 2026-07-07, `grill-with-docs` (session
  "crispening-follow-up"); rulings recorded in
  [decisions-locked.md](./decisions-locked.md).

## Research briefs

Three read-only Explore sweeps (2026-07-07), distilled into
[research-facts.md](./research-facts.md):

1. **CI bucket** — check.yml lane inventory (9 matrix lanes + standalone
   jobs, exact commands, env), the yeet-verify-vs-CI delta (5 required
   lanes), the existing `ci` command group and reusable Quality step
   runners, ruleset 10240248's 17 frozen required-check contexts,
   absence of retry infra.
2. **Testing/coverage bucket** — the numRuns landscape (298 sites, ~157
   files, inline-overrides-configureGlobal gotcha), the
   `assertSchemaArbitraryDecodesToSelf` precedent, CoverageRegression.ts
   internals (counts decoded then discarded), turbo env-declaration
   gotcha, istanbul-hint/v8 confirmation.
3. **CLI/tooling bucket** — process.cwd() audit (38 sites), SchemaUtils
   module layout, fallow envelope schema/builder, yeet staged gate,
   `beep worktree new` already installing deps, generated standards
   file inventory, .gitattributes state.

## Key repo files (load-bearing for implementation)

- `.github/workflows/check.yml` — the workflow being thinned (P0)
- `packages/tooling/tool/cli/src/commands/Ci/Ci.command.ts` — home for
  `ci lane` / `ci local`
- `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` — step
  runners to reuse (`runStepGroup`, `runQualityTaskStreamingStepGroup`)
- `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts` —
  `GithubCheckLaneSpec` + lane helpers + `github-checks pre-push`
- `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts` — baseline v2 (P2a)
- `packages/tooling/test-kit/test-utils/src/Schema.ts` — property helper
  precedent (P1)
- `vitest.shared.ts`, `vitest.setup.ts`, `turbo.json` — lane wiring (P1)
- `packages/tooling/library/repo-utils/src/Root.ts` — `findRepoRoot` (P2b)
- `packages/foundation/modeling/schema/src/SchemaUtils/` — combinator
  home (P2d)
