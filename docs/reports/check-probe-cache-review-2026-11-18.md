# Cache review for the package check probe

Goal `gate-output-switch-on`, fix 6, reviewed on top of `2837e8944cc`.
Reviewer: Claude Opus 5.5 (fix 6 implementer).

Against the baseline on `2837e8944cc`, `bun run beep cache audit` reports
1,743 blocking `configuration-drift` findings across 206 subjects and nothing
else. No root (`//`) task drifts and the global configuration is unchanged. By
task: 206 each of `#check`, `#test`, `#lint:laws` and `#lint:deprecated-apis`,
205 `#build`, 202 `#lint`, 200 `#lint:jsdoc`, 189 `#docgen`, 86
`#test:property`, 36 `#doctest` and 1 `#storybook:build`. One change explains
every finding.

## Regenerated `check` (206 subjects, every cached task)

The generated `check` binding of the library, tool, ecosystem, app and lab
kinds gained a guard, and `bun run beep lint package-scripts --write` rewrote
207 workspace manifests: each `check` changed from `bun run beep:check` to
`beep-cli quality check-probe && bun run beep:check`. The guard is a
filesystem-only probe: it fails with one line, before any compiler, when a
project the package references has no `<outDir>/index.d.ts`, and otherwise
exits 0 and prints nothing. A package's scripts digest is part of every one of
its cached task configurations, so every cached task of a written package
drifts. Of the 207, `@beep/eyecite` has only uncached tasks (its `turbo.json`
sets `cache: false`), which the audit does not assess.

The writer also moved the `beep:*` implementation keys of 16 manifests that
listed them before the task keys into its canonical order: the six practice
apps, `@beep/beep-effect-web`, `@beep/docket-intake`, `@beep/lane-cockpit`,
four `@beep/infra-*` packages and three `@beep/alchemy-*` packages. Apart from
`check`, every manifest decodes to the same value as before (`jq -S`
comparison against `2837e8944cc`); key order changes no script value.

`@beep/infra` keeps `bun run beep:check`: its check runs `tsrs -b`, which
builds the referenced projects itself, so its manifest and baseline are
unchanged.

Under Turbo, `check` depends on `^build` and `build`, so the probe always finds
the declarations and passes; it adds one short process per uncached package
check. The check task's `outputs`, inputs, environment keys and cache flags are
unchanged.

## Uncached computations

Recording the baseline also re-records what the audit does not assess: the
uncached tasks of the written packages, whose command digest moves with the
scripts block, and every task of `@beep/eyecite`. All of them stay uncached.

No epoch or qualification scope changes, and no qualification is granted.
