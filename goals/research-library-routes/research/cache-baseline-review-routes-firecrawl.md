# Cache baseline review: @beep/firecrawl follow-up

Reviewed 2026-11-07 for `feat/research-library-routes`, after
`cache-baseline-review-routes.md`. No qualification is granted.

| Subject | Tasks named by `beep cache audit` | Input change |
| --- | --- | --- |
| `@beep/firecrawl` | `build`, `check`, `lint:deprecated-apis`, `test` (configuration-drift) | Fallow flagged the `@beep/test-runner` devDependency as unused; removing it changed `packages/drivers/firecrawl/package.json` and the package's `tsconfig*.json` references (`tsconfig-sync`). |
