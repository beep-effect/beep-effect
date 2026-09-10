# Instance

- id: `goals-repair-fork-mode`
- source: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus source: `52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `packages/tooling/tool/cli/src/commands/Goals/Migration/Migration.command.ts:105`
- symbol: `RepairForkCommandInput`
- members: `preview`, `apply`
- evidence: E2 at `Migration.command.ts:54-61,126-139` — Effect CLI
  constructs the named command configuration object, the handler immediately
  rejects equal flag values, and exactly one `preview | apply` value controls
  every later repair operation.

# Current shape

`Command.make` parses `slug`, `root`, `preview`, and `apply` into the structured
`RepairForkCommandInput` consumed at lines 129-139. The two booleans are a real
CLI configuration result carrier. They are not merely an anonymous function
parameter signature: the parser owns both flags and supplies their false
defaults at lines 102-103.

# Cardinality gap

Four raw pairs are representable. Exactly `preview=true,apply=false` and
`preview=false,apply=true` are legal. Neither-selected and both-selected fail
with the same command-specific usage error.

# Target schema

Promote the existing `LiteralKit(["preview", "apply"])` at
`Migration.schemas.ts:347` to the named `GoalsMigrationMode` schema and reuse
its Type throughout this command module. Keep both legacy CLI flags and their
false defaults. Resolve them once at the handler boundary, preserving the exact
`GoalStatusInputError` message, then pass the named mode to `printForkPlan`.

Retain the named raw `RepairForkCommandInput` (or an equivalent local raw CLI
carrier) as long as it describes the `Command.make` handler input. Remove the
paired booleans only from application inputs after the adapter has constructed
`GoalsMigrationMode`; do not erase the parser-result carrier or classify it as
an excluded inline function-flag parameter.

# Migration inventory

- `Migration.schemas.ts:344-358` — name and annotate the existing literal kit,
  export its Type and only the derived guards/match helpers used by live code,
  and reuse it for `TranslationReport.mode` without changing the field order.
- `Migration.command.ts:21,54-66,190-219` — import the named mode; return it
  from `requireExclusiveMode`; type `printForkPlan` and
  `planConventionMigration` with it instead of duplicate unions.
- `Migration.command.ts:94-139` — retain the raw CLI fields and defaults,
  resolve once before slug validation, and pass only the resolved mode beyond
  the adapter.
- `Migration.command.ts:69-92` — preserve preview/apply dispatch, messages,
  no-fork behavior, and write boundaries exactly.
- `goals-packet-convention-migration.test.ts:1811-1826,2290-2301` — expand the
  existing command-boundary coverage to all four raw mode pairs and preserve
  invalid/missing-slug and missing-directory behavior.

# Guard-deletion accounting

Delete duplicate ad-hoc `"preview" | "apply"` type declarations and prevent
the paired flags from flowing past the CLI adapter. Retain one exact-one
validation at that boundary. The equality guard is required compatibility
validation for the two shipped flag spellings; it is not domain state.

# Encoded-side impact

`TranslationReport.mode` is an encoded field. Naming its existing LiteralKit
must preserve the exact key, the `"preview"` and `"apply"` encodings, schema
field order, and rendered `Mode: \`...\`` line. Compare old and new canonical
`encode(decode(report))` results for one report in each mode. CLI option names,
defaults, usage text, error text, and output lines also remain byte-stable.

# Test impact

Prove all four raw pairs through the public command seam: the two exact-one
pairs reach their respective behaviors, while neither and both produce the
exact usage suffix `choose exactly one of --preview or --apply.` before slug,
filesystem, or packet checks. Retain no-write preview, apply, no-fork, missing
target, and malformed-stream coverage. Add old/new report codec equality for
both legitimate modes and keep the report-rendering assertion at lines
575-595.

# Risk and sequencing

Land atomically with `goals-migrate-conventions-mode`, because both commands
and the persisted migration report share one mode owner. Preserve the current
validation order at lines 131-138: mode, slug, path/services, then packet
presence. Do not broaden this design into packet mutation behavior.
