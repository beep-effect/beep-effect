# Cache review for the ci-runners generate scripts (2026-11-23)

Branch `feat/ci-missed-event-check` (infra-alchemy-rebuild P5, standing missed-event
check). Reviewer: Claude Opus 5.5 (missed-event check implementation lane).

`bun run beep cache audit` reports 8 blocking findings, all `configuration-drift`, for one
subject, `@beep/infra-ci-runners`: `#build`, `#check`, `#docgen`, `#lint`,
`#lint:deprecated-apis`, `#lint:jsdoc`, `#lint:laws` and `#test`.

## Cause

`packages/tooling/infra/ci-runners/package.json` gains two scripts:

- `generate`: `bun ./fleet-pool-caps.ts --write`
- `generate:check`: `bun ./fleet-pool-caps.ts`

They run the renderer that writes repo-cli's
`packages/tooling/tool/cli/src/commands/Ci/FleetPoolCaps.generated.ts` from the production
configuration, and make that renderer a package entry point. The manifest's scripts digest
changes, which drifts every task of the subject. No existing script, command, dependency
edge, task input, output, environment entry or cache flag changes, and no new script is a
Turbo task.

## Inherited root drift

The root subject `//` also drifts, in one field only: the recorded `turbo.json` source digest
(`1565194a…` to `111b3a76…`). This branch does not change `turbo.json`; it is byte-identical to
`origin/main`, whose last `turbo.json` change (#3483, `0e305a468a0`) landed after the root was
last recorded. No root task, input, output, environment entry or cache flag changes.

## Judgement

Record `//` (the inherited `turbo.json` digest) and `@beep/infra-ci-runners` (the scripts
digest). Recording grants no qualification.

## Reversal

Remove the two scripts from the manifest and re-record `@beep/infra-ci-runners`. The root
digest follows `turbo.json` and needs no reversal.
