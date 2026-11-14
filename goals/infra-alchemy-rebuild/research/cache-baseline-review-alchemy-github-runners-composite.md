# Cache baseline review: `@beep/alchemy-github-runners` composite (2026-11-14)

Reviewer: Claude Opus 5.5 (the runners composite lane, #3314).

## What changed

The second PR of the package adds the `RunnerFleet` composite, `RunnerSweep` and the runner user data. The package
gains dependencies on `@beep/alchemy-aws-extras` (workspace), `@alchemy.run/aws` and `alchemy` (catalog), plus the
dev dependency `@alchemy.run/test` (catalog). `config-sync` added the matching tsconfig references, and the fallow
boundaries gained the new edge.

## Effect on cached computations

Only `@beep/alchemy-github-runners` computations change their inputs: the package manifest, the tsconfig
references and the new upstream workspace edge. Commands, outputs and environment are unchanged, and no
qualification is granted.
