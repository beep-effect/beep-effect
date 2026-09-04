# Instance

- id: `effect-import-rules-summary-operation`
- file:line: `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:245`
- symbol: `EffectImportRulesSummary`
- members: `write`, `candidate`
- evidence: E1 at `EffectImports.ts:1629-1643,1794-1811` — both summary
  writers project the already validated runtime operation and never emit
  write-plus-candidate.

# Current shape

The exported summary stores two booleans copied from runtime options. The Laws
command serializes this schema-shaped value through `printCommandJson` for
public `effect-imports --json` output, so changing decoded state directly
would change an encoded CLI contract.

# Cardinality gap

Four pairs are encodable; the runtime writes three legal operations:
`dry-run`, `write`, and `candidate`.

# Target schema

Expose `operation: EffectImportOperation` on the decoded
`EffectImportRulesSummary` while preserving the exact encoded `write` and
`candidate` boolean keys. Implement a schema transform between a named legacy
encoded struct and the honest decoded class. Decode the three legal pairs and
encode the literal back to the exact old keys and values. Reject combined true
as an impossible, unsupported runtime state; retain every other field, key,
default, array, and count unchanged.

# Migration inventory

- `EffectImports.ts:212-272` — split the summary into a named legacy encoded
  shape and decoded class/transform; update the example to `operation`.
- `EffectImports.ts:1629-1643,1794-1811` — write one operation rather than
  projecting two booleans.
- `Laws.command.ts:298-299` — before `printCommandJson`, schema-encode the
  decoded summary through `EffectImportRulesSummary` so the generic
  `UnknownFromJsonString` printer receives the legacy-key object; the printer
  does not apply class codecs.
- `Laws.command.ts:297-323` text output remains owned by
  `laws-effect-imports-command-options`: preserve `operation=dry-run` for a
  candidate run and the separate `candidate=true|false` line. This Tier 2
  design must not reinterpret candidate mode as the displayed operation.
- The test barrel for `@beep/repo-cli/test/Laws` — export any codec helper
  needed for focused compatibility tests through the existing supported test
  surface, not a new production barrel.
- `packages/tooling/tool/cli/test/effect-imports.test.ts` — migrate decoded
  assertions and add exact encoded snapshots/round trips.

# Guard-deletion accounting

Delete both decoded summary booleans and every reader that reconstructs the
operation from them. The compatibility transform is the only place where the
legacy pair may exist.

# Encoded-side impact

Byte-compatible Tier 2. Preserve property names `write` and `candidate`,
their boolean values, field ordering as emitted by the current schema JSON
path, and all other keys exactly. No decoded `operation` key may appear in
CLI JSON. The three legal legacy payloads round-trip exactly; combined true is
rejected.

# Test impact

Table-test all four encoded pairs: three exact decode/encode round trips and
combined-true rejection. Snapshot complete JSON for dry-run, write, and
candidate summaries and prove decoded values expose only `operation`.
Exercise the live `Laws.command.ts:299` encode-then-print path and prove the
output contains `write`/`candidate` but never `operation` or a decoded tag.
Retain CLI text, JSON, strict failure, candidate scope, write persistence, and
early-return tests. Run full `@beep/repo-cli` package verification.

# Risk and sequencing

New Tier 2 singleton after the Tier 1 Effect Imports operation migration. The
main risks are leaking the decoded key into JSON, changing key order/defaults,
or accidentally accepting the impossible pair. Publish separately with exact
before/after CLI JSON evidence.
