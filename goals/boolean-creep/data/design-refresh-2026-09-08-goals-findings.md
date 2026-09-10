# Goals and Codex findings design refresh — 2026-09-08

## Source

- checkout source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- packages/apps corpus source: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- scope: design preparation only; no product source, tests, inventory state, or
  status changed

## `codex-findings-ingest-modes`

The live source is the anonymous parameter type on
`packages/tooling/tool/cli/src/commands/Codex/Findings.refresh.ts:243-246`.
It exists only on `validateCodexFindingsIngestModes`; line 247 reads the two
flags together and lines 248-251 emit the typed `mode-conflict` failure. The
campaign scope rule in `goals/boolean-creep/ops/prompts/sweep-lane-round1.md:44`
says function flag parameters are skipped entirely. This is the narrow reason
the record is withdrawn; the behavior remains relevant compatibility evidence
for the two real structured carriers below.

The orchestrator archived the row in
`goals/boolean-creep/history/inventory/2026-09-08-codex-findings-ingest-withdrawal.jsonl`
and removed its live design. I removed its stale link from
`designs/family-cli-mode-flags.md` and corrected that family to seven live
consumers. No shared mode implementation is proposed for the excluded
validator itself.

## `codex-findings-ingest-force-refresh`

`packages/tooling/tool/cli/src/commands/Codex/Findings.schemas.ts:374-389`
defines the exported schema carrier. Its `refresh`, `force`, `dryRun`, and
`json` fields decode/construct with false defaults; `from`, `slug`, `date`,
`branch`, and `expectedCount` retain optional-key Option encoding. The exported
unknown-input decoder is at lines 411-414 and the public Codex barrel re-exports
the schema at `commands/Codex/index.ts:76`.

The design now owns one `CodexFindingsExistingPacketMode` and specifies a
legacy encoded shape behind an honest decoded literal. Legitimate rows are:

| refresh | force | decoded mode |
| --- | --- | --- |
| false | false | `none` |
| true | false | `refresh` |
| false | true | `force` |

The old schema accepts true/true, but the application rejects it before work at
`Findings.command.ts:406-410`; the exact failure is defined at
`Findings.refresh.ts:247-251`. Repository search found no producer, fixture,
documentation, or reader that assigns combined true a fourth meaning. The new
codec therefore preserves old/new canonical `encode(decode(payload))` bytes for
the three legitimate rows and explicitly rejects the incoherent fourth row.
It must preserve key names, false defaults, optional-key omission, and property
order. The exported decoded TypeScript `.make` shape may migrate atomically
under the execution rider; its JSDoc and all known repository consumers move in
the same change.

Classification issue for the orchestrator: live inventory says
`exposure=internal,tier=1`, but this public unknown-input decoder still needs an
encoded compatibility proof. Reconcile exposure/tier before P3; do not remove
the codec proof based on the current tier label.

## `codex-findings-ingest-command-force-refresh`

`packages/tooling/tool/cli/src/commands/Codex/Findings.command.ts:102-112`
defines the named options object accepted by exported
`runCodexFindingsIngest` at lines 406-413. `Command.make` parses and constructs
that same command configuration at lines 436-460, so it is a qualifying named
CLI/application carrier, distinct from the excluded inline validator
parameter.

All readers are accounted for: lines 195-214 load refresh provenance only for
refresh; lines 255-280 choose refresh replacement or ordinary write and derive
the distinct low-level `writePacket.force`; lines 366-398 consume dry-run/JSON
for index and output; lines 406-413 validate before prepare/read I/O, write,
and print. The target keeps raw `--refresh` and `--force` flags/defaults at the
Effect CLI boundary, preserves the exact typed conflict before repository or
CSV work, then passes one mode through the named application options. None and
force retain prior-ID planning; refresh retains ledger provenance and the
triage-preserving refresh path. Low-level `Findings.write.ts` force behavior
and its tests are outside this cluster and remain unchanged.

Existing direct application coverage at
`test/codex-findings-refresh.test.ts:360-397` proves the refresh fixed point;
lines 440-445 prove the typed conflict. The repaired plan adds all three modes
and all four raw CLI pairs through the public command seam, with exact error
precedence, while retaining dry-run, JSON, packet bytes, ledger identity, and
output behavior.

## `goals-repair-fork-mode`

`packages/tooling/tool/cli/src/commands/Goals/Migration/Migration.command.ts:
92-108` declares the argument/flag parsers and named `RepairForkCommandInput`.
`Command.make` supplies this decoded structured object at lines 124-127. This
is a real command configuration carrier and remains qualified. The absence of
a handwritten object producer does not make a framework-produced handler
object an excluded function-parameter signature.

`requireExclusiveMode` at lines 52-59 rejects both false and both true with the
exact suffix `choose exactly one of --preview or --apply.` and yields one
literal for the two exact-one rows. The command preserves the current order at
lines 129-137: validate mode, validate slug, acquire path/filesystem, check
packet presence, then preview/apply. `printForkPlan` at lines 62-90 preserves
preview no-write, apply, no-fork, and output behavior.

The design now promotes the already-live
`LiteralKit(["preview", "apply"])` from `Migration.schemas.ts:347` to one
annotated `GoalsMigrationMode`, while keeping raw booleans in the named CLI
carrier. It also accounts for the encoded `TranslationReport.mode` field:
old/new codec output and rendered report bytes must match for both modes.
Existing command tests are at
`test/goals-packet-convention-migration.test.ts:1811-1826,2290-2301`; the plan
adds the missing neither-selected repair case and exact error-order assertions.

## `goals-migrate-conventions-mode`

`Migration.command.ts:608-622` defines the shared raw flags plus optional
`at`, defaulted `report`, and named `MigrateConventionsCommandInput`.
`Command.make` constructs the handler object at lines 638-641, so this record
also remains qualified as a structured CLI carrier.

The design preserves the exact source order at lines 643-650: exact-one mode,
clock/default timestamp, timestamp schema validation, apply-only report
coordinate validation, then fleet planning. Both modes render at lines 650-652;
preview logs and returns without mutation at lines 653-655; apply validates the
plan and performs the rollback-protected mutation/report path at lines 657-666
and 554-597. Preview intentionally does not validate the unused report
location. Naming the existing report LiteralKit preserves the encoded `mode`
key/value/order and the rendered `Mode:` line at lines 266-312.

Existing tests cover preview/apply at lines 1811-1877, both-selected and
neither-selected migration failures at lines 2290-2294, invalid timestamp at
2304-2309, report containment after 2324, and registered command wiring at
2597-2617. The plan adds exact error-precedence checks and old/new codec plus
rendered-byte comparisons for both legitimate modes.

## `goals-set-status-input`

`packages/tooling/tool/cli/src/commands/Goals/SetStatus.ts:450-469` defines the
three default-false CLI flags and the named five-field carrier. The boolean
cardinality remains eight representable and six legal:

| migrate | preview | write | current result |
| --- | --- | --- | --- |
| true | false | false | migration dry-run |
| true | false | true | migration apply |
| true | true | false | migration/preview conflict |
| true | true | true | migration/preview conflict |
| false | false | false | transition |
| false | false | true | transition; `write` accepted and ignored |
| false | true | false | transition preview |
| false | true | true | transition preview; `write` accepted and ignored |

Payload coherence is separate. In migration, slug/status rejection at lines
472-474 precedes the preview conflict at 475-478. In transition, missing
slug/status at 487-490 precedes invalid status at 492-494. The repaired tagged
union preserves those boundary errors, gives migration only `write`, gives
transition required decoded slug/status plus `preview`, and deliberately drops
raw transition `write` without turning an accepted CLI tuple into an error.

Current tests in `test/goals-set-status-stream.test.ts:69-449` cover transition
writes, preview no-write, fork/CAS/idempotence, and skipped writes, but do not
cover the complete raw triple matrix or migration argument precedence. The
plan now requires all eight raw rows, migration payload/preview precedence,
transition missing/invalid precedence, and ignored transition `--write` while
retaining all stream and encoded manifest/event behavior.

## Verification

The five surviving refreshed designs contain every required design section;
the sixth assigned record is the properly archived parameter-only withdrawal.
Source and consumer discovery used repository `rg`, including public barrels
and all scoped tests.

`mise exec bun@1.4.2 -- bun goals/boolean-creep/ops/validate-designs.ts` reached
all 108 qualified live ids and failed only because five concurrently admitted
designs were absent: `composer-shell-edit-content`,
`contained-file-read-outcome`, `scheduler-admission-attempt-origin`,
`scheduler-promotion-tick-origin`, and `tmpfs-dangling-stub-disposition`.
None is owned by this lane. Scoped `git diff --check` passed for every owned
tracked file. No package verification was run because this lane changed packet
Markdown only.
