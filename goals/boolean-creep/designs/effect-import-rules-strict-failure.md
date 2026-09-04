# Instance

- id: `effect-import-rules-strict-failure`
- file:line: `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:141`
- symbol: `EffectImportRulesOptions` / `EffectImportRulesSummary`
- members: `strictCheck`, `strictFailure`
- evidence class: E4 at `EffectImports.ts:1789-1793` — strict failure is
  derived only from strict mode plus touched files under an enforcing mode.

# Current shape

`EffectImportRulesOptions.strictCheck` carries command intent. Both summary
writers store `strictFailure`; the Laws command reads it for exit behavior and
serializes the whole summary for public `effect-imports --json` output. The
encoded JSON does not include `strictCheck`, so a legacy `strictFailure: false`
payload cannot reveal whether the run was advisory or strict-clean.

# Cardinality gap

At runtime the two bits imply three legal outcomes: advisory, strict-clean, and
strict-failure. Strict failure without strict mode is never produced. The old
wire format collapses the first two outcomes to the same `false` value.

# Target schema

Build on the compatibility codec introduced by
`effect-import-rules-summary-operation`. Keep the encoded field
`strictFailure: boolean` exactly. On the decoded side expose
`disposition: Option<LawScanDisposition>` using the shared literal domain:
runtime writers always construct `Some(advisory | strict-clean |
strict-failure)`; decoding legacy `true` produces `Some(strict-failure)`, while
legacy `false` produces `None` because the encoded document lacks enough
information to choose honestly between advisory and strict-clean. Encoding
maps only `Some(strict-failure)` to `true`; every non-failure or legacy-unknown
decoded state maps to `false`.

The CLI JSON path must schema-encode the decoded summary before handing the
plain encoded object to `printCommandJson`; the generic printer does not apply
class codecs itself.

# Migration inventory

- `EffectImports.ts:241-272` — extend the named legacy encoded summary and its
  decoded compatibility model from the preceding operation PR.
- `Laws/internal/LawScan.ts` — reuse the `LawScanDisposition` owner introduced
  by the Tier 1E `r2-tooling-law-scan-strict-failure` migration; this Tier 2 PR
  must not declare a second disposition domain.
- `EffectImports.ts:1629-1643` — emit exact advisory or strict-clean disposition
  on the inert early return instead of a boolean.
- `EffectImports.ts:1789-1811` — derive and write the exact runtime disposition
  once.
- `Laws.command.ts:297-303` — schema-encode before the generic JSON printer so
  `strictFailure` remains the emitted key and decoded fields never leak.
- `Laws.command.ts:340-342` — preserve the exact failure text by selecting only
  `Some(strict-failure)`.
- `test/effect-imports.test.ts` — migrate every decoded assertion and add
  legacy false/true decode plus exact full-JSON encode evidence.

# Guard-deletion accounting

Delete both runtime `strictFailure` writers and every decoded boolean failure
guard. One disposition derivation owns the implication. The compatibility
codec retains the old boolean solely at the encoded boundary; it is not domain
state.

# Encoded-side impact

Byte-compatible Tier 2. Preserve the exact `strictFailure` key, boolean values,
position in emitted objects, and every neighboring field. Preserve exact JSON
for advisory, strict-clean, and strict-failure runs; neither `disposition` nor
an Option encoding may appear in output. Legacy `false` decodes to an explicit
unknown Option instead of guessing lost intent, and re-encodes to `false`.

# Test impact

Prove all three exact runtime dispositions, both legacy boolean decodes, exact
encoded round trips, and absence of decoded keys/tags in complete CLI JSON.
Retain candidate scope, documentation enforcement, write persistence, inert
ratchet, manual-review, parser-warning, counter, and exact failure-text tests.

# Risk and sequencing

Tier 2 singleton immediately after `effect-import-rules-summary-operation` and
after the Tier 1E batch has landed `r2-tooling-law-scan-strict-failure`. The
Tier 1 prerequisite establishes the shared `LawScanDisposition` owner; the
first Tier 2 prerequisite establishes the summary compatibility codec. This PR
extends that codec without changing the operation mapping. Main risks are
mistaking legacy false for an exact strict state or passing the decoded class
directly to the generic JSON printer. Run full `@beep/repo-cli` package
verification.
