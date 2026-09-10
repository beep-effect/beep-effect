# Instance

- id: `effect-import-rules-summary-operation`
- source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:245`
- symbol: `EffectImportRulesSummary`
- members: `write`, `candidate`
- evidence: E1 at `EffectImports.ts:1623-1643,1794-1811` — the exported
  runner rejects write-plus-candidate before either summary writer, so writers
  project only dry-run, write, or candidate.

# Current shape

The exported summary stores `write` and `candidate` beside the scan counts.
`Laws.command.ts:284-303` receives that decoded class and passes it directly to
`printCommandJson`, making the class's current encoded keys, order, and defaults
part of public `effect-imports --json` output. The command's human renderer does
not read these summary flags: at `Laws.command.ts:297,306-308` it derives
`operation=write|dry-run` from command options and prints candidate separately.

The current schema accepts all four boolean pairs, but acceptance is broader
than the supported domain. Both the CLI adapter (`Laws.command.ts:276-278`) and
the independently exported runner (`EffectImports.ts:1623-1627`) reject
`write: true, candidate: true` before a summary exists. A repository-wide
search found no summary decoder, producer, fixture, or documented input
contract that assigns meaning to the combined-true pair.

# Cardinality gap

Four pairs are structurally accepted; three operations are legitimate:
`dry-run`, `write`, and `candidate`. The combined-true pair is tolerated only
by the permissive old summary schema and is not a supported runtime state.

# Target schema

Reuse the `EffectImportOperation` owner introduced by the Tier 1
`laws-effect-import-rules-options` migration. Do not declare another literal
domain. Keep a private named encoded summary class with every current field in
the current order, including `write`, `candidate`, `strictFailure`, and the
three trailing arrays with their existing constructor and decoding defaults.
Expose an annotated decoded `EffectImportRulesSummary` whose only operation
field is `operation: EffectImportOperation`.

Connect the two with `S.decodeTo` and a named `SchemaTransformation.transform`:

| Encoded `write` | Encoded `candidate` | Decoded `operation` |
| --- | --- | --- |
| `false` | `false` | `dry-run` |
| `true` | `false` | `write` |
| `false` | `true` | `candidate` |
| `true` | `true` | reject as incoherent |

Encoding applies the inverse mapping. Copy all neighboring values without
normalization. Keep the public schema and type name
`EffectImportRulesSummary`; keep the encoded helper private unless a supported
test-only export is required by the existing test barrel.

# Migration inventory

- `EffectImports.ts:8-24` — extend the existing narrow `@beep/schema` import
  with `SchemaTransformation`; retain `LiteralKit` while Tier 1's option model
  still owns the shared `EffectImportOperation` declaration in this module.
- `EffectImports.ts:212-272` — update the exported example and replace the
  current class with the private legacy encoded class, decoded class, and
  annotated transform. Preserve the exact current property order:
  `mappingTableVersion`, `mode`, `write`, `candidate`, the seven counters,
  `rootSpecifierCounts`, `strictFailure`, `changedFiles`, `manualReviews`, and
  `parserWarnings`.
- `EffectImports.ts:1623-1627` — retain the exported runner's independent
  configuration error. The codec rejection is a boundary invariant, not a
  substitute for the current early domain error.
- `EffectImports.ts:1629-1643,1794-1811` — construct one exact operation in
  each writer and remove the two summary constructor flags.
- `Laws.command.ts:276-282` — retain both CLI configuration guards.
- `Laws.command.ts:297-323` — preserve human output exactly. Candidate remains
  `operation=dry-run` plus `candidate=true` because this presentation is based
  on command options and is owned by `laws-effect-imports-command-options`.
- `Laws.command.ts:298-303` — encode the decoded summary through
  `EffectImportRulesSummary` before `printCommandJson`; that generic printer
  receives plain encoded data and does not run the class codec.
- `packages/tooling/tool/cli/test/effect-imports.test.ts` and the existing
  `@beep/repo-cli/test/Laws` test barrel — migrate decoded assertions and add
  compatibility coverage through the supported test surface. Do not add a new
  production barrel solely for tests.

Whole-repository searches at the stated source SHA found no other production
writer or reader of the summary operation flags.

# Guard-deletion accounting

Delete `write` and `candidate` from decoded summary state and delete their two
assignments in each summary constructor. No production reader currently
reconstructs an operation from the summary pair. The private encoded class and
its transform are the only remaining places where both legacy keys coexist.
Retain the two pre-summary configuration guards because they provide the
runner and CLI's existing user-facing failure behavior.

# Encoded-side impact

Tier 2 compatibility codec. For each legitimate pair, compare the new
`encode(decode(payload))` result with the old schema's canonical
`encode(decode(payload))` result. They must be equal as complete objects and as
CLI JSON, including property order, all counter values, omitted optional
properties, and the defaulted empty arrays. No `operation` key may appear on
the wire.

The combined-true object was accepted and round-tripped by the old permissive
schema, but it has no supported producer or input contract. The new decoder
deliberately rejects it. Record that case separately as incoherent-input
policy; do not count it as a legitimate compatibility row.

# Test impact

- Table-test the three legitimate pairs with old-canonical versus
  new-canonical full-object equality and exact JSON equality.
- Prove omitted `changedFiles`, `manualReviews`, and `parserWarnings` still
  canonicalize to `[]` in the same positions.
- Test combined true as an intentional decode failure, and retain the existing
  CLI and exported-runner configuration-error tests.
- Exercise the live encode-then-`printCommandJson` path for dry-run, write, and
  candidate. Assert JSON has `write` and `candidate`, never `operation` or a
  transform tag.
- Preserve the current candidate human rendering, strict-failure exits,
  candidate scope checks, persistence behavior, and inert-return coverage.

# Risk and sequencing

Land after the Tier 1 Effect Imports operation migration. The main risks are
leaking the decoded key into public JSON, moving/defaulting neighboring keys,
or mistaking a permissively accepted incoherent pair for supported behavior.
Publish this singleton with exact before/after JSON evidence and run full
`@beep/repo-cli` package verification.
