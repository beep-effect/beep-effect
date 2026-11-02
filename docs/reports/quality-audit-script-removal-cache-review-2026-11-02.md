# Cache baseline review: package `audit` script removal and root deprecated-imports lint (2026-11-02)

Branch `@slop/11-1-26`. The re-record covers every subject `bun run beep cache audit`
reported as drifted: `//` plus all 188 workspace packages (1,664 `configuration-drift`
findings and one `unreviewed-expansion`).

## What changed

- **Every workspace manifest** drops the generated `audit` and `beep:audit` scripts. The
  package-scripts policy (`PackageScripts.schemas.ts`) no longer requires them, so
  `bun run beep lint package-scripts` stays green. The manifest bytes change, so every task
  of every package whose review basis includes its own manifest drifts (`build`, `check`,
  `test`, `test:property`, `doctest`, `lint`, `lint:jsdoc`, `lint:laws`,
  `lint:deprecated-apis`, `docgen`). No task command, input pattern, output pattern, cache
  flag or environment key of those tasks changed.
- **`turbo.json`** deletes the uncached `audit` task definition, and
  `packages/tooling/library/ai-sync/turbo.json` deletes its `audit` input override. Root
  task definitions other than the new task below are unchanged; the root (`//`) subject
  drifts through the root manifest scripts digest.
- **Root `package.json`** adds `lint:deprecated-imports`
  (`biome lint apps packages infra --only=suspicious/noDeprecatedImports`), and
  `biome.jsonc` turns the project-domain rule `suspicious/noDeprecatedImports` off for
  per-package `biome check .`. Running that rule in every package made each package's lint
  scan the whole repository (about 1.8 s and 75 CPU-seconds per package, 188 packages per
  Turbo lint run). The rule now runs once at the root inside `beep lint policy`.
- **`//#lint:deprecated-imports`** is a new cached root task. Its inputs are every
  source file under `apps`, `packages` and `infra`, their manifests, `biome.jsonc` and
  `bun.lock`; it declares no outputs. The audit records it as `unreviewed-expansion`.
  This review records its legacy posture only. It grants no qualification, widens no
  qualification scope and adds no exception row.

## Unchanged

`scope`, `profile` and `epoch` are copied from the current baseline. No remote-cache
authority, qualification tuple or exception inventory changes.

## Reversal

Restore the `audit`/`beep:audit` scripts with `bun run beep lint package-scripts --write`
after reverting `PackageScripts.schemas.ts`, revert `turbo.json`, `biome.jsonc` and the
root script, then re-record the same subjects.
