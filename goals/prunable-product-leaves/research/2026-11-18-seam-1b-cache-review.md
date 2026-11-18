# Cache review for the seam 1b kit dependencies (2026-11-18)

Reviewed on branch `feat/prunable-seam-1b`, on top of `71b9dd3518c`.
Reviewer: Claude Opus 5.5 (seam 1b of `goals/prunable-product-leaves`).

Seam 1b adds two workspace dependencies to `@beep/repo-cli-kit`
(`packages/tooling/library/repo-cli-kit/package.json`), which the new
`CheckoutPrune` module imports:

- `@beep/glob`, for git `:(glob)` matching of checkout prune pathspecs;
- `@beep/walker`, for expanding prune entries against the working tree.

`bun run beep tsconfig-sync` then added the matching project references to
the kit's three tsconfig files. On that head `bun run beep quality
cache-policy` reports four blocking findings and nothing else blocking:

- `configuration-drift` on `@beep/repo-cli-kit#build`, `#check`,
  `#lint:deprecated-apis` and `#test`.

## What changed

One input changed for all four tasks: the kit's own `package.json` gained two
`dependencies` lines, which put `@beep/glob` and `@beep/walker` in its
dependency closure. Turbo derives a task's upstream edges from that closure,
so each drifted task gains exactly two upstream tasks.
`bunx turbo run build check lint:deprecated-apis test
--filter=@beep/repo-cli-kit --dry-run=json` on this head:

| Task | Command | New upstream | Upstream tasks |
| --- | --- | --- | --- |
| `@beep/repo-cli-kit#build` | `bun run beep:build` | `@beep/glob#build`, `@beep/walker#build` | 18 |
| `@beep/repo-cli-kit#check` | `bun run beep:check` | `@beep/glob#build`, `@beep/walker#build` | 19 |
| `@beep/repo-cli-kit#lint:deprecated-apis` | `beep-cli lint deprecated-apis --package .` | `@beep/glob#transit`, `@beep/walker#transit` | 19 |
| `@beep/repo-cli-kit#test` | `bun run beep:test` | `@beep/glob#transit`, `@beep/walker#transit` | 19 |

## Why the drift is correct

The new edges are the invalidation the kit needs: its source now imports
`@beep/glob/GlobPattern` and `@beep/walker/Expand`, so a change to either
package must re-key the kit's build, check and test, or a cache hit could
replay a passing check over a changed dependency. `lint:deprecated-apis`
follows the same dependency closure by the root task definition.

Nothing else about these tasks moved: commands, cache flags, outputs,
environment keys and declared input globs are the ones already reviewed.
Inputs only grow, by two upstream tasks per drifted task. The
`configuration-source-drift` review row on `turbo.json` is the policy
fingerprint reseal for the new module (`bun run beep lint policy-fingerprint
--write`), which changes only the generated seal tasks' inputs. The scope,
profile and epoch of the baseline are unchanged, and no qualification or
exception row is added.

## The root subject

The baseline also records the root subject (`//`), whose configuration
sources include the root `turbo.json`. That file changed only in six
generated seal tasks, which `bun run beep lint policy-fingerprint --write`
rewrites from the modules each policy command reaches:
`@beep/repo-cli#lint:policy-fingerprint:goals-doctor`, `:knowledge`, `:laws`,
`:lint-identity-registry`, `:lint-roadmap-refs` and `:quality`. Their inputs
grow by the new `CheckoutPrune` module and the `@beep/glob` and
`@beep/walker` sources those commands now reach through the inventory read.
No root task's command, outputs, environment keys or cache flag changed, and
no other task definition in `turbo.json` moved.
