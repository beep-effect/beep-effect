# Cache baseline review: research-library-routes

Reviewed 2026-11-07 for `feat/research-library-routes`. No qualification is
granted, widened, or excepted; only manifest-identity drift is recorded.

| Subject | Tasks named by `beep cache audit` | Input change |
| --- | --- | --- |
| `@beep/repo-cli` | `build`, `check`, `doctest`, `lint:deprecated-apis`, `test`, `test:property` (configuration-drift) | `packages/tooling/tool/cli/package.json` gains the `@beep/box`, `@beep/firecrawl` and `@beep/onepassword-cli` dependencies for the Box and web routes; its `tsconfig*.json` references gain the same three projects (`tsconfig-sync`). |
| `@beep/firecrawl` | `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test` (unreviewed-expansion) | New drivers package created by `bun run beep create-package firecrawl --family drivers --reuse-retired-name`; its generated scripts block and tsconfig overlays are unmodified apart from the `@beep/identity`, `@beep/schema` and `@beep/test-runner` dependencies. |
| `//` | root tasks and seals | `create-package` registration of `packages/drivers/firecrawl`: root `package.json` workspaces, `tsconfig.json` aliases, `tsconfig.packages.json` reference, `vitest.aliases.generated.json`, `syncpack.config.ts`, `bun.lock`, `standards/fallow.boundaries.generated.jsonc`, and removal of the `@beep/firecrawl` entry from `standards/changesets.retired-packages.json`. |
| `@beep/identity` | `lint` (qualified scope) | `src/packages.ts` gains the generated `$FirecrawlId` composer registered by `create-package`. |
| `@beep/types` | `lint` (qualified scope) | No package change; its task inputs include the root configuration above (`tsconfig.json` aliases). |

The audit's REVIEW rows (`turbo.json`, identity and types `turbo.json`) are
configuration-source notices, not blocks, and are not part of this request.
