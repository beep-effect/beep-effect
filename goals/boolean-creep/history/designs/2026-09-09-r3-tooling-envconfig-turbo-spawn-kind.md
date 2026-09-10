# Instance

- id: `r3-tooling-envconfig-turbo-spawn-kind`
- file:line: `packages/tooling/tool/cli/src/internal/cli/EnvConfig.ts:264`
- symbol: `turboEnvOverrides.spawnKind`
- members: `isBunxTurbo`, `isOpRunTurbo`
- evidence: E2 at `EnvConfig.ts:571-580` — a spawn is dispatched as direct
  `bunx turbo`, wrapped `op run -- bunx turbo`, or neither. The command cannot
  be both `bunx` and `op`, and the ordered reader has no combined-true arm.

# Current shape

Two private predicates classify the same `(command, args)` input. The override
writer stores the direct predicate, rejects the neither pair, and interprets
`!directTurbo` as the wrapped case. The ambient-environment policy independently
re-runs the wrapped predicate. This is one spawn kind represented by two bits.

# Cardinality gap

Four boolean pairs are representable and three spawn kinds are legal:
`none`, `direct-bunx-turbo`, and `op-run-turbo`. Combined true is impossible
because one process command string cannot equal both `bunx` and `op`.

# Target schema

Define a private named `TurboSpawnKind` LiteralKit with `none`,
`direct-bunx-turbo`, and `op-run-turbo`, imported from the narrow
`@beep/schema/LiteralKit` subpath. Add one `turboSpawnKind(command, args)`
classifier. It recognizes direct `bunx turbo` first, then for an `op` command
finds the first `--` separator and recognizes exactly the current child shape
`bunx turbo ...`; every malformed or different command is `none`.

Keep the existing dual data-first/data-last `turboEnvExtendsAmbient` API. It
returns false only for `op-run-turbo`. Match the same kind in
`turboEnvOverrides`: `none` returns `{}`, `op-run-turbo` returns the complete
sanitized non-extending environment, and `direct-bunx-turbo` performs the
existing lazy Config reads and unresolved-reference handling.

# Migration inventory

- `EnvConfig.ts:21-38,262-285` — add the narrow LiteralKit import and private
  owner/classifier; delete `isBunxTurbo` and `isOpRunTurbo` without changing the
  `OP_RUN_ARGUMENT_SEPARATOR` parsing rule or capturing environment at module
  load.
- `EnvConfig.ts:519-522` — retain both call signatures of
  `turboEnvExtendsAmbient` and derive the answer from the literal.
- `EnvConfig.ts:566-600` — classify once per call and exhaustively select the
  existing none, wrapped, and direct effects. Preserve lazy `TURBO_*` reads,
  secret-reference scrubbing, local-only fallback, and exact object values.
- `Ci/CiLane.ts:1498-1504,1961-1967` and
  `Quality/Tasks.ts:1107-1117,1187-1198,1805-1815` — existing consumers keep
  calling the same two exported APIs and require no compatibility alias.
- `src/test/SharedInternals.test-kit.ts:8` continues exporting the existing
  public test surface; the private LiteralKit/classifier is not exported.
- `test/shared-internals.test.ts:356-441` — migrate the complete behavior table
  through `turboEnvOverrides` and `turboEnvExtendsAmbient`.

# Guard-deletion accounting

Delete both boolean predicates, local `directTurbo`, the
`!directTurbo && !isOpRunTurbo(...)` NOR guard, and the later `!directTurbo`
reinterpretation. One literal classifier and exhaustive match become the sole
spawn-kind coherence boundary.

# Encoded-side impact

None. The literal is private ephemeral state. Exported function names,
overloads, Effect requirements, returned environment keys and values, child
command arguments, `extendEnv` behavior, and 1Password/Turbo cache policy remain
unchanged.

# Test impact

Table-test `none`, direct, and wrapped kinds through both exported behaviors.
Include direct resolved and unresolved credentials, wrapped complete
sanitization, a wrapped Turbo command with its own later separator, missing
separator, separator with no child, wrong child command, `bunx` with a non-Turbo
tool, and ordinary commands. Exercise both `turboEnvExtendsAmbient` call forms
and prove only the wrapped kind disables ambient extension. Run the focused
shared-internals tests and full `@beep/repo-cli` package verification with the
required patch changeset.

# Risk and sequencing

Land in Tier 1E. The classifier must preserve first-separator behavior and the
direct arm must remain lazy so tests and callers that change the ambient Config
provider between invocations continue to observe current values.
