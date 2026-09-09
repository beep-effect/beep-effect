# Design: effect-import-rules-summary-operation

Current P2 design at source `93217d998f851e2e93d9864e2b5315552eaa58a7`,
main `d1b4d769fbaffddd55717f3b1ba461897dd545c5`. Actual owner `EffectImportRulesSummary`;
4 representable / 3 legal, Tier 2.
The source audit, bounded correction and native adjudication are bound by
`data/r28-cli-l-q-integration.json`. This design supplies no independent P3
approval; replacement review and merged packet ratification remain required.

## Current shape

In `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:241-272`,
the exported summary carries write/candidate after the runner's configuration
gate. Both summary writers at1629 and1794 run only after1623-1627 rejects a
candidate write. That is a different owner from the raw options constructed
before the gate.

`EffectImportRulesOptions` at135-174 intentionally accepts both flags true;
`test/effect-imports.test.ts:255-274` constructs that input and verifies the
exported runner's typed error and unchanged source. The command likewise
constructs `EffectImportsCommandOptions` at Laws.command.ts265-275 before its
exact conflict diagnostic at276-278. Retain both raw schemas, every input
Boolean, all constructor/decoding defaults and both error paths. Do not replace
their fields with a successful-operation domain or a generic schema error.

The summary's full encoded order is mappingTableVersion,mode,write,candidate,
scannedFiles,scannedFences,touchedFiles,rootImportsRewritten,
rootExportsRewritten,emittedImports,emittedExports,rootSpecifierCounts,
strictFailure,changedFiles,manualReviews,parserWarnings. The mapping literal is
`root-export-graph/v1`; counts are Natural, mode is the complete existing
EffectImportCorpusMode, rootSpecifierCounts is a string/Natural record,
strictFailure is an independent Boolean, mode retains all three values
`code`, `jsdoc`, `markdown` from EffectImports.ts58, and all three trailing arrays retain
their full element schemas and constructor/decoding empty defaults.

## Cardinality gap

The summary operation pair is4/3: dry-run false/false, write true/false and
candidate false/true. No successful summary writer emits true/true. Raw option
objects support all four request pairs, including the intentionally rejected
request; their diagnostic contract is not evidence of an impossible stored
summary state. Required counts/maps/arrays are not additional Boolean axes.

## Target schema

Introduce the single named `EffectImportOperation` LiteralKit with dry-run,
write and candidate in the existing EffectImports module as part of this
summary migration. It no longer depends on an option-model PR. A private
decoded summary class carries operation and every unchanged sibling. Keep
the public `EffectImportRulesSummary` schema/type name as the compatibility
codec. Migrate internal constructors to the decoded class and update the
exported example; do not retain a misleading old `.make` alias.

Use a named private encoded union of the three exact legitimate Boolean
combinations, preserving the full ordered field set and defaults. Connect it
to the decoded class through `S.decodeTo` and a named pure
`SchemaTransformation.transform` that copies all siblings and maps only the
operation. The encoded schema rejects true/true before the pure transformation,
which must not silently map it to a valid case. Inverse encoding reconstructs
the two legacy keys; no operation key is emitted. Annotate both schemas and
field collections. Import SchemaTransformation from
`effect/SchemaTransformation`, not an unverified @beep/schema re-export.

Exact local Effect v4 references checked: `.repos/effect/packages/effect/src/Schema.ts:5366-5393`
defines the curried decodeTo and getter directions; `SchemaTransformation.ts:382-389`
defines transform's decode/encode functions; `Schema.ts:2223-2227` defines
the typed encoder. Follow the existing Effectful encode API at the CLI
boundary so encoding failures use its established error handling. No legacy
v3 transform signature is assumed.

## Migration inventory

- `EffectImports.ts:135-174`: retain raw EffectImportRulesOptions unchanged,
  including optional includePaths, scope arrays and complete defaults. Its
  strictCheck/enforceDocumentation pair remains an independent D1 concern.
- `EffectImports.ts:212-272`: update summary example, add the operation and
  decoded/encoded schemas, retain public schema/type identity. Review direct
  `.make` callers and replace them explicitly; do not invent extra exports.
- `EffectImports.ts:1623-1627`: retain the configuration error and its order
  before the inert branch and all filesystem work. Derive the operation once
  after this gate from the still-present request flags. Supply it to both
  summary writers at1629-1643 and1794-1811.
- Keep runner uses of options.write/options.candidate for source scanning,
  persistence, candidate behavior and strict-failure policy unchanged. Those
  request Booleans are not this record's decoded summary state.
- `Laws.command.ts:265-295`: retain raw construction, conflict guard,
  candidate explicit-scope guard and runtime request construction exactly.
- `Laws.command.ts:297-308,322-324`: retain current human rendering from raw
  options. The human output for candidate retains the text
  `operation=dry-run` and `candidate=true`; the decoded summary operation is
  `candidate`. The persist hint still depends on options.write. This no longer assumes a separate raw
  option migration.
- `Laws.command.ts:298-303`: encode through EffectImportRulesSummary before
  passing plain encoded data to printCommandJson. Preserve strictFailure exit.
- `src/internal/cli/Json.ts:296-303`: generic printer accepts unknown, calls
  encodeCommandJson, and writes complete JSON plus newline. It does not discover
  the summary codec. Preserve its generic behavior and large-output handling.
- `src/test/Laws.test-kit.ts`: its export-star of the EffectImports module
  exposes the public summary and raw options. The commands/Laws facade exports
  command/errors; package.json's source subpath map and source-only test-kit
  surface remain unchanged. Migrate `test/effect-imports.test.ts` assertions
  and documented constructions through those existing supported paths.

No source-transform phase or callable FlakeQuarantine migration is required.
Coordinate shared-file changes serially, with one record per PR.

## Guard-deletion accounting

Delete only the decoded summary's write and candidate fields and four
assignments across its two constructors. The two legacy keys coexist only in
the private encoded schema/codec. No production reader currently reconstructs
operation from this summary pair. Both raw option pairs and both request
conflict guards remain. Their retention is required behavior, not incomplete
guard deletion. Do not claim credit for request or source-transform cleanup.

## Encoded-side impact

Compare old-canonical and new-canonical complete objects and exact CLI JSON for
each of the three legitimate operations, including all keys in order, array
defaults, nonempty findings and counters, mode, strictFailure, and final
newline. Generic printCommandJson must receive the result of this codec;
passing the decoded class would expose operation and lose write/candidate.
No version, JSON key, source mutation behavior or command diagnostic changes.

The old summary schema's unsupported combined-true acceptance may be retired
with an explicit decode failure. That does not authorize changing the same
combined-true request accepted by the raw options schemas and handled by their
typed domain diagnostics. No whole-request compatibility codec is needed.

## Test impact

Keep exported-runner combined-true rejection at effect-imports.test.ts255-274
and CLI conflict/unscoped-candidate cases at146-162. Preserve source bytes after
rejection and all candidate/write/dry-run behavior. Add three operation codec
rows, omitted-array default rows, nonempty full-payload rows, exact JSON and
human-output assertions, and the summary-only incoherent decode rejection.
Exercise the inert return and strictFailure outcomes. Update decoded summary
assertions without changing raw Options.make fixtures. Run focused laws tests
and repo-CLI package verification in implementation, not during P2.

## Risk

Land this summary as its own Tier 2 PR after the ordered Tier 1 batches.
Coordinate shared-file edits serially. Its operation domain does not depend
on either raw option schema changing; those two request owners are now D1,
with their exact previous designs archived by this integration. Preserve both
typed diagnostics and explicitly encode the summary before generic printing.
Independent P3 must verify complete encoded objects, field order, defaults,
CLI newline and human candidate text before packet ratification.
