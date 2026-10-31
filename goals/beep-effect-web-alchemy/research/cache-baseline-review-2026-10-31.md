# Cache baseline record: `@beep/beep-effect-web` (new app)

Reviewed 2026-10-31. `@beep/beep-effect-web` is a new app, created by
`bun run beep create-package beep-effect-web --type app --app-kind vite` for the
beep-effect-web-alchemy goal (P1). Its tasks are `#build`, `#check`, `#lint`,
`#lint:deprecated-apis`, `#lint:jsdoc`, `#lint:laws` and `#test`. The scaffold generated
both its `package.json` scripts block and its `turbo.json`, and neither was edited by hand
(`bun run beep lint package-scripts` reports 0 drifting manifests). They are recorded as
first entries with the standard commands, outputs, env and cache flags.

What changed after scaffolding is app source and dependencies, not task definitions:
TanStack Start routes, `alchemy.run.ts`, tests, catalog dependencies, and a project
reference to `@beep/public-site` added by `config-sync`. `bun run beep cache audit`
names only these seven subjects as `unreviewed-expansion`. No other subject drifted.

No qualification is granted. Scope, profile and epoch are copied unchanged, and no
exception rows or standards debt are added.
