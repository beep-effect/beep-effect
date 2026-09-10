# Instance

- id: `effect-import-rules-strict-failure`
- source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:141`
- symbol: `EffectImportRulesOptions` / `EffectImportRulesSummary`
- members: `strictCheck`, `strictFailure`
- evidence: E4 at `EffectImports.ts:1788-1792` — failure is the conjunction of
  strict intent, a nonzero touched-file count, and an enforcing scan mode.

# Current shape

`EffectImportRulesOptions.strictCheck` is command intent. The full writer
derives `strictFailure`; the inert writer fixes it to false. The command reads
the summary boolean for both JSON and text exits at
`Laws.command.ts:298-303,340-342`, and public JSON includes the exact
`strictFailure` key.

The wire value loses information: `false` can mean an advisory run or a strict
run that passed. Therefore a legacy summary cannot always reconstruct one of
the three exact runtime dispositions. No repository decoder or other input
contract adds the missing strict intent.

# Cardinality gap

The runtime has three legitimate outcomes: `advisory`, `strict-clean`, and
`strict-failure`. The wire boolean has two values and collapses the first two
to `false`. Failure outside strict mode is excluded by the sole full-writer
derivation.

# Target schema

Build on the compatibility codec from
`effect-import-rules-summary-operation`. Reuse the shared
`LawScanDisposition` owner introduced by
`r2-tooling-law-scan-strict-failure`; do not define a local copy. Preserve
`strictFailure: boolean` in the private encoded summary at its current
position. Replace it in decoded state with
`disposition: Option<LawScanDisposition>`.

The transform has an intentionally asymmetric information boundary:

| Encoded `strictFailure` | Decoded `disposition` |
| --- | --- |
| `false` | `None` (legacy intent unknown) |
| `true` | `Some(strict-failure)` |

Encoding maps `Some(strict-failure)` to true. It maps `None`,
`Some(advisory)`, and `Some(strict-clean)` to false. Runtime writers never use
`None`: they construct the exact disposition from the live options and
result. This prevents the decoder from inventing whether an old false payload
was advisory or strict-clean while keeping the existing wire contract.

# Migration inventory

- `EffectImports.ts:8-24` — reuse the `SchemaTransformation` import added by
  the preceding summary-operation migration and the module's existing
  `effect/Option` namespace import.
- `EffectImports.ts:241-272` — extend the private encoded summary and decoded
  transform established by the preceding operation migration. Keep
  `strictFailure` in the encoded class between `rootSpecifierCounts` and
  `changedFiles`; keep `disposition` only in decoded state.
- `Laws/internal/LawScan.ts` — import and reuse the Tier 1E
  `LawScanDisposition` owner.
- `EffectImports.ts:1629-1643` — for the inert return, construct
  `Some(strict-clean)` when `options.strictCheck` is true and
  `Some(advisory)` otherwise. Zero touched files can never be strict failure.
- `EffectImports.ts:1788-1811` — replace the boolean with one exact
  disposition: advisory when strict checking is off, strict failure when the
  existing conjunction holds, and strict clean otherwise.
- `Laws.command.ts:298-303` — encode through `EffectImportRulesSummary` before
  `printCommandJson`, then fail only for `Some(strict-failure)`.
- `Laws.command.ts:340-342` — make the text path use the same exact-disposition
  check and preserve the current failure text.
- `packages/tooling/tool/cli/test/effect-imports.test.ts` — migrate decoded
  assertions and add legacy and live-writer compatibility cases.

Whole-repository searches at the stated source SHA found no additional
production summary writer, decoder, or strict-failure reader.

# Guard-deletion accounting

Delete both decoded `strictFailure` constructor fields, the local stored
boolean at `EffectImports.ts:1789-1792`, and both command reads of the decoded
boolean. One disposition derivation owns the runtime implication, and one
exact-disposition predicate owns exit behavior. The encoded compatibility
class retains `strictFailure` solely at the wire boundary.

# Encoded-side impact

Tier 2 compatibility codec. For both legacy boolean values, old canonical
`encode(decode(payload))` and new canonical `encode(decode(payload))` must be
identical as complete objects and CLI JSON, including the `strictFailure`
position and the trailing-array defaults. `false` decodes to `None` and
re-encodes to false; `true` decodes to `Some(strict-failure)` and re-encodes to
true. Neither `disposition` nor an Option representation may appear in JSON.

For newly produced summaries, `Some(advisory)` and `Some(strict-clean)` both
encode to the existing false value and `Some(strict-failure)` encodes to true.
This preserves all three legitimate runtime outcomes as decoded state despite
the intentionally lossy legacy wire format.

# Test impact

- Cross the three legitimate operation rows from the preceding design with
  both encoded strict-failure values and prove old/new full-object and exact
  JSON canonical equality.
- Prove legacy false yields `None` and does not guess advisory or strict-clean;
  prove legacy true yields only `Some(strict-failure)`.
- Exercise both writers for advisory, strict-clean, and strict-failure and
  prove their exact decoded dispositions and old boolean JSON values.
- Assert complete JSON contains `strictFailure`, never `disposition` or Option
  tags, and retains all neighboring keys/defaults in order.
- Preserve candidate scope, documentation enforcement, persistence, inert
  ratchet, manual-review, parser-warning, counters, and exact failure text.

# Risk and sequencing

Land after `effect-import-rules-summary-operation` and after the Tier 1E batch
provides `LawScanDisposition`. The risks are guessing lost intent from a
legacy false payload, leaking Option encoding into JSON, or duplicating the
shared domain. Extend the existing summary codec in one change and run full
`@beep/repo-cli` package verification.
