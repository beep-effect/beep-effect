# Cache review for the `lint:no-tracked-python` root task

Reviewed on `chore/python-free-repo-law` based on `main` @ 8d936cfb9b6. Reviewer:
Claude Opus 5.5 (python-free-repo law lane).

`bun run beep cache audit` reports 37 blocking `configuration-drift`
findings, all in the root subject `//`: `config-sync:check`, `fallow:boundaries:advisory`, `fallow:boundaries:config-check`, `fallow:dead-code:check`, `fallow:fix-preview:advisory`, `fallow:flags:advisory`, `fallow:health:advisory`, `fallow:health:check`, `fallow:security:advisory`, `goals:index-check`, `jsdoc:inventory:check`, `jsdoc:ratchet:check`, `lint:allowlist`, `lint:circular`, `lint:deprecated-imports`, `lint:ecosystem-polarity`, `lint:effect-imports`, `lint:effect-vitest`, `lint:holds`, `lint:identity-registry`, `lint:jsdoc:root`, `lint:judge-rubric`, `lint:native-runtime:roots`, `lint:package-scripts`, `lint:package-test-typecheck`, `lint:policy-fingerprint`, `lint:reflection-artifacts`, `lint:roadmap-refs`, `lint:schema-catalog`, `lint:schema-first`, `lint:tsconfig-overlay`, `lint:tsgo-rules`, `repo-sanity:changeset-graph`, `repo-sanity:sherif`, `repo-sanity:syncpack`, `repo-sanity:versions`, `topo-sort`.

## Cause

The lane adds the root script
`"lint:no-tracked-python": "bun run beep laws no-tracked-python --check"` to
the root `package.json` (goal `python-free-repo`, the tracked-Python ban).
The root manifest's bytes are part of the reviewed configuration of every
cached root computation, so each one drifts. With the root `package.json`
restored to `main` and every other change kept, the audit reports 0 blocking
findings.

## Judgement

The change is one new uncached root task. `//#lint:no-tracked-python` is
`cache: false` and sits in `policyTrackedDiscoveryTasks` beside
`lint:tracked-shell-allowlist`, because it lists candidates with
`git ls-files`. No existing task command, cache flag, input glob, output glob
or environment variable changed. Recording the new configuration grants no
qualification.

## `@beep/repo-cli` test inputs (final PR)

The final PR also deletes the last two tracked Python files,
`goals/turborepo-cache-trust-observability/research/native-dependency-diagnostics{,.test}.py`.
Their only consumer is now the `beep cache producer-diagnose` command, which #3296 merged.
`packages/tooling/tool/cli/turbo.json` listed both files as inputs of the `test` and
`test:property` tasks (and a third task), and those entries are removed. The
`CiOperational` goal-data consumer row that cited them is removed with them. Removing two
inputs that no longer exist leaves fewer tracked bytes in the hashes and nothing that could
change a cached result, so `@beep/repo-cli#test` and `#test:property` are re-recorded as
configuration drift. No command, cache flag, output glob or environment variable changed,
and no qualification is granted.
