# Instance

- id: `goals-migrate-conventions-mode`
- source: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus source: `52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `packages/tooling/tool/cli/src/commands/Goals/Migration/Migration.command.ts:619`
- symbol: `MigrateConventionsCommandInput`
- members: `preview`, `apply`
- evidence: E2 at `Migration.command.ts:54-61,640-666` — Effect CLI
  constructs the named command configuration object, exact-one validation
  resolves one mode, and planning, report validation, writes, and output all
  consume that resolved value.

# Current shape

`Command.make` parses `preview`, `apply`, optional `at`, and defaulted `report`
into `MigrateConventionsCommandInput` at lines 640-643. The named type is the
actual decoded CLI configuration carrier. Its two flags have independent false
defaults at lines 102-103, but the application accepts only an exact-one pair.
Timestamp and report path are separate payload axes.

# Cardinality gap

Four raw pairs are representable. Only `preview=true,apply=false` and
`preview=false,apply=true` are legal. Neither-selected and both-selected share
the exact command usage error.

# Target schema

Reuse `GoalsMigrationMode`, the named form of the existing
`LiteralKit(["preview", "apply"])` in `Migration.schemas.ts`. Preserve both
shipped CLI flags and resolve them once at the command boundary. Pass the named
mode through planning and into `TranslationReport.mode`; application planning
must never receive sibling mode booleans.

Keep a named raw CLI carrier while it describes the object emitted by
`Command.make`. It is a qualifying structured CLI configuration surface, even
though the framework constructs it and one callback consumes it.

# Migration inventory

- `Migration.schemas.ts:344-358` — promote the inline report mode to the one
  annotated `GoalsMigrationMode` owner and reuse it in `TranslationReport`
  without changing any encoded field.
- `Migration.command.ts:21,54-61,190-219` — import the named mode, return it
  from the raw-flag resolver, and replace the ad-hoc union on
  `planConventionMigration`.
- `Migration.command.ts:610-666` — retain both flags, optional timestamp, and
  report default; validate exact-one first; then resolve/validate timestamp;
  validate report coordinates only for apply; plan/render both modes; return
  before every mutation in preview.
- `Migration.command.ts:268-314,556-608` — preserve report rendering, apply
  rollback, post-apply preview, contained report write, and output text.
- `goals-packet-convention-migration.test.ts:564-595,1811-1877,2290-2330,
  2597-2617` — retain report rendering and registered-command coverage and add
  exact raw-pair/error-precedence assertions.

# Guard-deletion accounting

Delete duplicate ad-hoc `"preview" | "apply"` unions and prevent the pair from
escaping the CLI adapter. Retain one boundary exact-one guard for legacy flag
compatibility. Branching on the single mode remains where it controls distinct
side effects; derived schema match helpers may replace those branches only
when they preserve order and errors.

# Encoded-side impact

`TranslationReport.mode` is persisted into the committed Markdown migration
report and rendered at `Migration.command.ts:283`. Preserve the exact `mode`
field name, `"preview"`/`"apply"` values, schema property order, and rendered
text. Compare old and new canonical `encode(decode(report))` output for both
legitimate values and compare rendered report bytes. CLI spellings, false
defaults, default report path, timestamp formatting, and all messages remain
unchanged.

# Test impact

Exercise all four raw flag pairs through the command. Assert both invalid pairs
produce the exact usage error before clock access, timestamp validation, fleet
inventory, or report-path checks. Preserve invalid timestamp behavior; prove
apply-only report-coordinate validation; retain preview no-write, apply,
rollback, post-apply preview, no-op fleet, and registered Goals command tests.
Add old/new report codec and rendered-byte comparisons for both modes.

# Risk and sequencing

Land atomically with `goals-repair-fork-mode` so the two commands and report
share one schema owner. Preserve the source precedence at lines 645-652:
exact-one mode, timestamp acquisition/validation, apply-only report path, then
fleet planning. Preview must still render the plan and return at lines 653-657
without validating the unused report destination or writing.
