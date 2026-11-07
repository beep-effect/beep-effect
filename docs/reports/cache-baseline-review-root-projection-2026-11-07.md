# Cache-policy baseline re-record for the root-package projection (2026-11-07)

Reviewer: Claude Opus 5.5 (`fix/cache-baseline-root-projection`, inherited-red unblocker).

## What changed on main

`45c0f9fbc4b` (#2856, verification route slice 2, layer 1) swapped Turbo's global inputs in
`turbo.json`: `package.json` became `!package.json` and
`standards/root-package.projection.generated.json` was added, so root dependency resolution no
longer re-keys every task when only the root catalog moves. The PR did not re-record
`standards/cache-qualification-baseline.json`. On every later `main` commit,
`bun run beep quality cache-policy` therefore reports one `global-configuration-drift`
(`turbo-global-configuration`), 1682 `configuration-drift` rows across 195 subjects, and
the `turbo.json` `configuration-source-drift` review row. Measured at `9ed136596bb` (0 blocking)
and `45c0f9fbc4b` (1675 blocking); `e8c9ef095b5` reports 1683.

The committed projection was also one workspace behind (`packages/drivers/firecrawl`, added by
#2868), so `bun run beep tsconfig-sync --check` failed on `main`. This change regenerates it.

No command, task input glob, output, environment key or cache flag changes beyond the reviewed
global-input swap, and no qualification is granted; the qualification scope is unchanged.

## Evidence

- `bun run beep quality cache-policy` at `e8c9ef095b5`: 1683 blocking findings, all of the kinds
  above.
- After this record: 0 blocking findings.
