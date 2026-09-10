# Instance

- id: `r26-cli-commands-l-q-allowlist-check-ok`
- source: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus: `origin/main@52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `packages/tooling/tool/cli/src/commands/Laws/AllowlistCheck.ts:146`
- symbol: `AllowlistCheckSummary`
- members: `ok`, `diagnostics`
- evidence: E3 at `AllowlistCheck.ts:302-349` — every successful check returns
  `ok: true` with an empty diagnostics array, while every detected failure
  returns `ok: false` and its diagnostics payload. The schema's explicit
  constructor and decoding defaults also support `ok: false` with an empty
  diagnostics array.

# Current shape

`AllowlistCheckSummary` is an exported `S.Class` containing an `ok` boolean and
a diagnostics array. Both fields have explicit constructor and decoding
defaults: false and empty respectively (`AllowlistCheck.ts:146-157`). The check
runner constructs nonempty failures for missing, unparsable, or schema-invalid
allowlists, then derives `ok` from the combined diagnostic count for a decoded
allowlist (`AllowlistCheck.ts:294-349`). The reporter and command branch on
`ok`, print diagnostics on failure, and fail the CLI command after reporting
(`AllowlistCheck.ts:364-374`; `Laws.command.ts:607-623`).

Tests prove success-plus-empty and failure-plus-nonempty. No repository writer,
fixture, example, or consumer gives success-plus-nonempty a meaning. The
false-plus-empty state is supported by the deliberate defaults rather than by
generic field permissiveness; it means a failing/unready summary with no
diagnostic detail and currently reports zero issues before exiting nonzero.

# Cardinality gap

Treating diagnostics as empty versus nonempty, the two fields represent four
combinations. Three are supported:

| Outcome | `ok` | diagnostics |
| --- | --- | --- |
| success | true | empty |
| failure with detail | false | nonempty |
| failure without detail | false | empty |

Success with nonempty diagnostics has no supported constructor or read
semantics. The failure payload itself may be empty because the schema explicitly
defaults both constructor and decoder to that state.

# Target schema

Replace the class with an annotated `AllowlistCheckOutcome` tagged union made
from LiteralKit: `ok {}` and `failed { diagnostics: Array<string> }`.
Diagnostics remain an array rather than a nonempty array so the supported
false-plus-empty default maps to `failed { diagnostics: [] }`. All production
failures retain their exact diagnostic strings and ordering.

The successful case carries no diagnostics field. Do not add `ok` getters,
parallel result booleans, or an artificial third tag for empty failure; empty
versus nonempty is variation within the failed payload, not another control
state.

# Migration inventory

- `packages/tooling/tool/cli/src/commands/Laws/AllowlistCheck.ts:8-18` — reuse
  the existing `LiteralKit` import and `$I` composer for the named union.
- `AllowlistCheck.ts:135-157` — replace `AllowlistCheckSummary` with the tagged
  outcome. Preserve the old default's decoded meaning through the explicit
  `failed` case with an empty diagnostics array; do not retain a legacy class
  or boolean alias without a real boundary consumer.
- `AllowlistCheck.ts:294-349` — construct `failed` for missing-file,
  parse-failure, decode-failure, and nonempty validation results; construct
  `ok` only when the combined diagnostics array is empty. Preserve validation
  order and every diagnostic payload.
- `AllowlistCheck.ts:364-374` — match the union. Keep the exact success line,
  failure count line, per-diagnostic lines, and console channel choices.
- `packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts:607-623` — match
  the outcome after reporting and preserve the reported-exit message and
  ordering.
- `packages/tooling/tool/cli/src/test/Laws.test-kit.ts:8` exposes the source
  module to repository tests; migrate test imports and assertions atomically.
- `packages/tooling/tool/cli/test/allowlist-check.test.ts:91-347` — migrate all
  success and diagnostic-failure assertions and add explicit empty-failure
  construction/reporting coverage.

# Guard-deletion accounting

Delete the `ok` schema field and its two defaults, all four `ok: false` writes,
the `A.length(diagnostics) === 0` boolean write, `if (summary.ok)` in the
reporter, and `if (!summary.ok)` in the command. Tagged constructors and
exhaustive matches replace those checks. Do not leave a computed `ok` alias.

# Encoded-side impact

There is no persistence, JSON writer, RPC, or CLI-output encoding of
`AllowlistCheckSummary`; the package is private and all live repository
consumers are enumerated above. Its exported decoded TypeScript shape may
migrate atomically under the campaign rider. Preserve the behavior represented
by constructor/decoding defaults by testing that legacy false-plus-empty maps
to the `failed` case with `[]`. Do not treat unsupported
success-plus-nonempty field permissiveness as a legitimate state.

Console output and exit behavior are encoded CLI contracts and remain exact:
success prints `[laws-allowlist] OK`; empty failure prints a zero-issue header
then exits with the existing reported error; detailed failures print the same
count and ordered lines.

# Test impact

Retain all existing filesystem fixtures and exact diagnostic assertions. Add a
pure legacy-state table for success-empty, failure-nonempty, and the explicitly
defaulted failure-empty case, plus rejection or normalization of unsupported
success-nonempty input if a migration helper is retained. Capture Console
output for both union cases, including empty failure, and assert the command's
report-before-exit precedence. Run the focused allowlist tests and full
`@beep/repo-cli` package verification during implementation.

# Risk and sequencing

Land in the Tier 1 tooling batch. The main risk is accidentally requiring a
nonempty failure payload and erasing the explicit default behavior, or changing
diagnostic order/output while moving branches. Keep all validation work and
error precedence unchanged; migrate the runner, reporter, command, and tests in
one change.
