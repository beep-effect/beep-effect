# Hosted CI policy checks

`bun run beep ci workflow-lint` checks parsed workflows for writer-environment isolation, trusted caller guards, explicit artifact retention and non-cancelling main-push concurrency. `bun run beep ci held-group` reports an old waiting main Check run with a pending successor, includes its pending-deployment count and exits nonzero. API errors and truncated results report unknown, never clean. Neither command changes GitHub settings or cancels runs.

`bun run beep ci ruleset --capture` reads ruleset 10240248, compares required contexts with `CI_LANE_DESCRIPTORS` and regenerates the dated context snapshot. `--check` performs the read-only comparison. Knip's context, job and descriptor must be removed in the orchestrator's coordinated merge window; recapture immediately afterward.

`bun run beep ci settings --check` fails when the desktop environment is missing or lacks a nonempty required-reviewer rule. The enabled desktop release path also requires its signing key; a successful environment check alone does not establish release readiness.

## Heavy workflow merge proof

`check.yml` and `heavy-admit.yml` call `heavy.yml@main`, under the runner group's trusted-workflow restriction. A PR changing `heavy.yml` proves the previous main version. Every such PR requires a post-merge Heavy probe before its workflow change is accepted:

1. Record the exact merge SHA and the Check main-push run for that SHA.
2. Read its jobs and require all seven `Heavy / *` matrix lanes to execute successfully. A docs-only skip does not qualify.
3. Record writer environment attachment only on Turbo lanes and the trusted-push cache mode from their logs. Save the short-lived Turbo summary artifacts as evidence.
4. If the run is stuck, use `ci held-group` and route remediation to the orchestrator. If it fails, attribute the failure and repair it once on main. The lane remains unqualified until a successful probe.

## Trust posture

Most required contexts use PR-ref workflows. A same-repository author can modify those workflows. This repository deliberately accepts that single-operator posture; the trusted reusable Heavy workflow and environment-only writer secret are independent boundaries. Reconsider this posture when independent contributors or maintainers become regular users.

Cache-writer expressions stay in trusted caller workflows. The composite setup action and its environment exporter execute PR code and may only receive the already-guarded tuple. Fork Heavy execution requires both admission labels; fork documentation changes stay held rather than marking required contexts satisfied without proof.

## Generated catalog gates

Hosted `Check / Repo Sanity` runs `lint:schema-catalog`
(`bun run beep lint schema-catalog`) through `bun run beep ci lane repo-sanity`,
before the other sanity steps. The command defaults to check mode and fails
when any per-package shard under `standards/schema-catalog/` differs from
current source, is missing, or has no owning package (including the retired
single-file catalog, `schema-catalog.generated.jsonc` at the root of
`standards/`); refresh intentional
changes with `bun run beep lint schema-catalog --write` and review the diff.
Both generated catalogs (schema and instrumentation) are sharded per owning
package so pull requests that touch different packages do not conflict; see
`standards/generated-artifacts.policy.md`. The `schema-catalog` and
`instrumentation-catalog` pre-commit hooks in `lefthook.yml` regenerate the
shards of the packages owning the staged sources and stage them
(`bun run beep lint schema-catalog --write --stage <paths...>`,
`bun run beep observability catalog --write --stage <paths...>`), so a commit
carries its own shard refresh before any gate runs; the hosted gate stays the
proof for orphan shards and the standard's generated section, which only the
full scan covers.

Local `beep quality github-checks cheap-gates` also runs the schema catalog.
It runs alone in the `heavy` scheduling wave **within the cheap-gates tier**,
after the parallel preflight lanes. The check has no package scope: its
whole-repository ownership and orphan-shard checks require the full scan
(the path-scoped writer regenerates shards; it does not replace the check).
The 2026-10-22 profile measured about 24 seconds and 12.6 GiB peak RSS, so keep
it isolated and allow at least the existing 16 GiB runner envelope. This wave
still gates publication before the head-install preflight. Root `lint:oxlint`
and `quality:jsdoc-ratchet:regenerated` run in the parallel preflight wave;
the latter writes only `.beep/ci/` artifacts before comparing totals.
`observability:catalog-check` remains a local cheap gate.
