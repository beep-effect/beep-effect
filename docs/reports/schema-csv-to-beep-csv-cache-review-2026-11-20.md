# Cache review for moving CSV consumers onto @beep/csv (2026-11-20)

Branch `refactor/schema-csv-to-beep-csv`. Reviewer: Claude Opus 5.5 (schema CSV migration lane).

`bun run beep cache audit` reports 15 blocking findings, all `configuration-drift`, in three
package subjects, plus a `configuration-source-drift` review row on `turbo.json`:

- `@beep/law-practice-server`: `build`, `check`, `doctest`, `lint:deprecated-apis`, `test`.
- `@beep/practice-m365-contacts`: `build`, `check`, `lint:deprecated-apis`, `test`.
- `@beep/repo-cli`: `build`, `check`, `doctest`, `lint:deprecated-apis`, `test`, `test:property`.

## Cause

Each of the three packages now reads CSV through `@beep/csv` instead of `@beep/schema`'s removed
CSV modules, so each manifest gains a `"@beep/csv": "workspace:^"` dependency, and
`bun run beep tsconfig-sync` adds the matching project references to its tsconfig files. The
tasks that hash the manifest and the tsconfig files drift with them. `bun install` changed only
the three workspace-link lines in `bun.lock`.

`bun run beep lint policy-fingerprint --write` resealed the root inputs after the deleted
`@beep/schema` sources left its input list; that is the `turbo.json` review row.

## Decision

Record the three package subjects and the root (`//`), whose `turbo.json` input changed. No task command, output, environment entry or cache flag differs from
the generated defaults, and no qualification is granted.
