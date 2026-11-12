# Cache review for the slice A dev edges (2026-11-12)

Reviewed on branch `test/canonical-digest-census`, on top of `be6f6cb3a0c`.
Reviewer: Claude Fable 5.2 (slice A of `goals/canonical-digest-owner`).

Slice A adds `@beep/jsonc` to the `devDependencies` of two workspaces so their
tests can compare a hand-rolled encoder, or a stored seal, with
`JsoncFingerprint` (decision `2026-11-12-differential-test-placement`):

- `packages/execution-authority/domain` (`@beep/execution-authority-domain`)
- `apps/labs/semantica` (`@beep/semantica`)

`bun run beep tsconfig-sync` then added the matching project reference to each
workspace's tsconfig files. On that head `bun run beep quality cache-policy`
reports eight blocking findings and nothing else:

- `configuration-drift` on `@beep/execution-authority-domain#build`, `#check`,
  `#lint:deprecated-apis` and `#test`;
- `configuration-drift` on `@beep/semantica#build`, `#check`,
  `#lint:deprecated-apis` and `#test`.

## What changed

One input changed for all eight tasks: the workspace's own `package.json`
gained one `devDependencies` line, which puts `@beep/jsonc` in the workspace's
dependency closure. Turbo derives a task's upstream edges from that closure,
so each drifted task gains exactly one upstream task.
`bunx turbo run build check lint lint:deprecated-apis lint:laws test
--filter=@beep/execution-authority-domain --filter=@beep/semantica
--dry-run=json` on this head:

| Task | Command | New upstream | Upstream tasks |
| --- | --- | --- | --- |
| `@beep/execution-authority-domain#build` | `bun run beep:build` | `@beep/jsonc#build` | 8 |
| `@beep/execution-authority-domain#check` | `bun run beep:check` | `@beep/jsonc#build` | 8 |
| `@beep/execution-authority-domain#lint:deprecated-apis` | `beep-cli lint deprecated-apis --package .` | `@beep/jsonc#transit` | 9 |
| `@beep/execution-authority-domain#test` | `bun run beep:test` | `@beep/jsonc#transit` | 9 |
| `@beep/semantica#build` | `bun run beep:build` | `@beep/jsonc#build` | 20 |
| `@beep/semantica#check` | `bun run beep:check` | `@beep/jsonc#build` | 20 |
| `@beep/semantica#lint:deprecated-apis` | `beep-cli lint deprecated-apis --package .` | `@beep/jsonc#transit` | 21 |
| `@beep/semantica#test` | `bun run beep:test` | `@beep/jsonc#transit` | 21 |

`#lint` and `#lint:laws` in both workspaces have no upstream edge on
dependencies and did not drift.

## Why the drift is correct

The new edge is the invalidation the tests need. Both workspaces' `check`
compiles their test files, and their `test` runs them; those files now import
`@beep/jsonc/JsoncFingerprint`. A change to `@beep/jsonc` must re-key those
tasks, or a cache hit could replay a passing check or test over a changed
owner. `build` and `lint:deprecated-apis` follow the same dependency closure
by the root task definitions.

Nothing else moved. No `turbo.json` changed, so commands, cache flags,
outputs, environment keys and declared input globs are the ones already
reviewed. Inputs only grow: one upstream task per drifted task. The scope,
profile and epoch of the baseline are unchanged, and no qualification or
exception row is added.

## Subjects

`@beep/execution-authority-domain` and `@beep/semantica`. No other subject
drifted, and the root subject `//` is not touched.
