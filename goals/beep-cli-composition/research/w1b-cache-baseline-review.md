# Cache baseline review: W1b library map (2026-11-02)

Reviewer: Claude Opus 5.5 (W1b lane, `refactor/beep-cli-w1b-verifier`).

W1b splits shared vocabulary out of `@beep/repo-cli` tool files into sibling
modules (SPEC D27, `w1-edge-census.md`) and moves `shellQuote` from
`@beep/repo-ai-metrics` to `@beep/repo-utils/Shell`. No task, cache flag,
output or `passThroughEnv` changes, and no qualification is granted.

## `//` (root)

`bun run beep lint policy-fingerprint --write` regenerated the seal inputs in
`turbo.json` and `standards/policy-tools.fingerprint.json`. The eleven drifted
seals (`shared`, `quality` and its six `quality-*` children, `goals-doctor`,
`knowledge`, `lint-deprecated-apis`) change only because their import closures
now name the new split modules (`Yeet/internal/{Planner,Settle,MonitorComments,Status}.schemas.ts`,
`Yeet/internal/GitErrorAdapter.ts`, `Cache/Cache.runtime.step.ts`,
`Cache/Cache.errors.ts`) and `@beep/repo-utils`'s `Shell.ts`.
`turbo.json` is the only configuration source that changed.

## `@beep/repo-ai-metrics`

`package.json` adds the `@beep/repo-utils` workspace dependency (for
`shellQuote`); `tsconfig-sync` added the matching project reference to
`tsconfig.json` and `tsconfig.check.json`, and `bun.lock` records the edge.
The `build`, `check`, `lint:deprecated-apis`, `test` and `test:property` tasks
gain the `@beep/repo-utils#build` upstream edge; nothing else changes.
