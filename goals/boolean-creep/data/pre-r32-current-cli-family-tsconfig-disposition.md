# TsconfigSyncModeFlags — exact-ID D1 disposition

Native P2 finding: reclassify the surviving `tsconfig-sync-mode-flags` row as **D1**, preserving the existing ID, file, line, symbol, kind, and members. The actual exported named tuple has **8 representable and 8 legal raw requests**, mapped by deliberate precedence to three already existing mode literals. It has no cardinality gap. Archive the current qualified design; do not replace it with a design against a disqualified owner.

Binding: root HEAD `4509872869eb87071250c67717769260f850bcf5`, root main `d68f1a11dd41579660a6c72f3d3e060d6b61352d`, inventory SHA-256 `1739679baffd27a2416adb0853b411992fbfd3a1dc19623d5bf1bb0e67f243d4`. Every frozen Tsconfig source file and the RunMode source match both those heads and future main `a2030c8bd9124d1f0de8ae03a1eebbf5f1fa621f`. The isolated checkout stays at `04cc73e733758e39a4e15ec294f86ef74ecc66c5`; it was read only. Actual model provenance is native `gpt-6-astra` / `xhigh`. This disposition is source-bound P2 work and grants no independent P3 credit.

For citations below, **S** is `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.schemas.ts`, **C** is `TsconfigSync.command.ts` in that directory, and **V** is its `TsconfigSync.service.ts`. Full files, tests, dependency inputs, prior decisions, and Effect APIs are preserved in the private bundle.

## 1. Complete current owner and public contract

The exact owner is `export type TsconfigSyncModeFlags = readonly [check: boolean, dryRun: boolean, write: boolean]` at S:425, with its documentation at S:412–424. It contains exactly three Boolean slots and no payload slots, optional slots, extra object fields, or derived flag accessors. This is a real named tuple used by an instantiated value at C:19, so this disposition does not rely on the function-parameter exclusion. Preserve the inventory's existing `kind: type-literal`; no alternative tuple kind or replacement ID is invented.

All three associated predicates are exported and documented as precedence tuples (S:427–477). The command facade reexports schemas at `TsconfigSync/index.ts:26`. CLI package.json exposes `./commands/TsconfigSync` at 58 and the `./commands/*` source wildcard at 68; the built export map also retains command access. Both the facade and documented schema subpath support these public tuple/predicate APIs.

The command parser independently declares `check`, `dryRun`, and `write`, each defaulting false (C:52–63). It does not apply an exclusive-flags combinator or conflict guard. The private resolver receives all three parsed values, constructs the named tuple, then selects a mode (C:18–30). The upstream anonymous callback and resolver parameters are not the inventory owner; they explain how every raw combination reaches the named carrier.

The downstream application shape is already different: `TsconfigSyncMode` is a LiteralKit domain `sync | check | dry-run` (S:334–391), and `TsconfigSyncRunOptions` is a tagged class union carrying one mode, `verbose`, and `filter` (S:479–556). Do not move the mode's three-state count back onto the raw tuple.

## 2. Whole-owner cardinality and qualification failure

| check | dryRun | write | Public precedence branch | Result |
| --- | --- | --- | --- | --- |
| false | false | false | No predicate selected; default at C:29 | sync |
| false | false | true | Write predicate S:477 | sync |
| false | true | false | Dry-run predicate S:460 | dry-run |
| false | true | true | Dry-run predicate accepts either Boolean write value | dry-run |
| true | false | false | Check predicate S:443 | check |
| true | false | true | Check predicate accepts either Boolean write value | check |
| true | true | false | Check predicate accepts either Boolean dryRun value | check |
| true | true | true | Check predicate accepts both lower-priority true values | check |

This is a static exhaustive enumeration of the actual three-Boolean carrier, not an executed product test. `isCheckModeFlags` checks truthiness in slot 0 and `P.isBoolean` in slots 1 and 2. `isDryRunModeFlags` checks false in slot 0, truthiness in slot 1, and either Boolean in slot 2. `isWriteModeFlags` checks false/false/true. The `O.firstSomeOf` selection and sync fallback at C:21–29 handle every tuple. Combined-true requests are explicitly processed by these branches; no combined tuple is outside the contract.

The source documentation names this behavior precedence, the existing per-instance design's section 3 expressly says all eight CLI tuples are accepted, and `data/design-refresh-2026-09-08-tooling-baseline.md:40–54` already records the same supported-input contract. This is positive input-contract evidence, not a deduction that all schema-representable values must be legal. The four multi-true combinations and the no-flag combination remain supported; the old design's reference to five combined tuples conflates extra preimages with actual combined flags.

The current row's E2 claim is invalid for the named owner: the resolver does handle combined-true cases, by documented priority. Three result modes describe the image of a total function over eight legal requests, not five illegal owner states. No E1 exclusive write, E3 duplicated payload, or E4 phase implication was found for this tuple. Under DECISIONS.md's gap-plus-evidence gate and D1 definition, same-ID disqualification is the appropriate disposition.

## 3. Target and implementation disposition

No new target schema or source refactor is proposed. Keep the tuple, public predicates and examples, parser flags/defaults, existing mode schema, tagged run options, and result schemas. The new row uses the disqualified schema branch, removing qualified-only evidence/cardinality/storage/exposure/target/tier metadata while retaining all identity fields.

A generic resolver might shorten the precedence implementation, but that cleanup does not establish a Boolean-creep cardinality gap. The currently shared RunMode accepts `check | write | dry-run`, while this command uses `sync`, so the old proposal also required broadening that helper. With no qualifying owner here, no generic widening, alias, literal renaming, export deletion, or shared-helper change is justified by this record.

The complete existing design and row are preserved byte for byte under `before/`. Parent integration should archive the old active design and install this disposition in `data/pre-r32-current-cli-family-tsconfig-disposition.md` with the D1 row. Do not leave a design that tells implementers to delete public APIs for a D1 record.

## 4. Complete known writes, reads, exports, and payload path

Exact-symbol searches across packages/apps/docs found only the declaration/examples and command uses for this tuple and its three predicates. Graft navigation came first; exhaustive search output and commands are retained. No other named tuple producer or direct tuple-predicate test was found in that searched corpus. Absence of additional callers is not used to revoke documented APIs.

| Site | Role and preserved behavior |
| --- | --- |
| S:412–425 | Public raw tuple type and documented import. Exactly three required Boolean slots. |
| S:427–443 | Public check predicate; accepts arbitrary Boolean lower-priority slots. Documentation and examples remain. |
| S:444–460 | Public dry-run predicate; accepts either write value after check=false. |
| S:461–477 | Public write predicate; accepts false/false/true. |
| C:52–63 | Three independent CLI Boolean flags with false defaults and unchanged help descriptions. |
| C:64–72 | Orthogonal optional string filter and verbose flag with `-v` alias and false default. They are not tuple members. |
| C:75–76 | Repository-root discovery occurs before mode resolution. No new conflict diagnostic moves ahead of root discovery. |
| C:18–30,76 | Sole located runtime tuple construction and precedence resolver. It returns a literal for every tuple. |
| C:77–83 | Actual application options object contains mode, verbose, and Option-compacted filter, then invokes the service. It does not contain the original three Boolean slots. |
| S:479–556 | Existing class-union application schema: each class has one mode tag, required Boolean verbose, and filter allowing omitted or explicit undefined/string. No new defaults or filter normalization. |
| V:79–99 | Public service supports both data-first and curried forms via `dual(2, ...)`. It receives the already resolved mode shape. |
| V:100–133 | Builds workspace/dependency state, checks cycles, plans root/package/docgen changes, applies filter/verbose, and sorts changes. No raw tuple is reconstructed. |
| V:135–140 | Only sync mode writes files. Check and dry-run remain non-writing even when their raw request also included write. |
| V:142–149 | Renders changes before returning a drift error for check mode. Preserve this output/error order and exact diagnostic. |
| V:151–173; S:822–896 | Existing mode-specific result construction preserves changedFiles and complete changes payload. No raw tuple is encoded into results. |
| `TsconfigSync.render.ts:21–55` | Mode controls existing no-change and planned/applied/drift output. It consumes a literal, not raw flags. |
| C:84–102 | Reports drift, filter, and cycle errors, including per-cycle lines, before the existing reported-exit path. |
| `TsconfigSync/index.ts:12–33`, CLI package.json | Public command, error, schema, and service barrels retain current exports. |
| `test/tsconfig-sync.test.ts:18,192–220` | CLI test runs explicit write with filter and verifies produced references. Direct service tests use literal mode values and full option payloads. |

No extra carrier is admitted from this inventory. The already resolved application object and mode/result schemas cannot supply a missing cardinality gap for the raw request tuple.

## 5. Guard-deletion accounting

Proposed source deletions: **zero**. This is a census correction, not an implementation design requiring guard-removal credit.

The three tuple predicates (S:443,460,477) express public precedence, not coherence validation. The selection chain and fallback (C:21–29) implement the total request-to-mode function. The old design's phrase Boolean coherence chain is misleading: it raises no incompatibility error and intentionally consumes combined inputs. Deleting these exported predicates or replacing the chain could be a behavior-preserving cleanup, but it would not eliminate an impossible-state guard.

Retain root discovery before resolution, sync-only write selection, check-mode drift handling, typed error reporting, cycle checks, and all filter behavior. Those checks protect actual service behavior and are not made redundant by a new raw-input type. Preserve the tuple documentation as public contract evidence rather than deleting it as an unwanted invariant comment.

## 6. Encoded and external behavior

The tuple itself has no located JSON/DB codec. Nevertheless, the CLI is an external request contract: do not reject combined flags, change defaults, introduce a new mode spelling, erase supported exports, or change how lower-priority flags are ignored. In particular, `--check --write` must continue to select check, and `--dry-run --write` must continue to preview; explicit/default sync remain aliases at the mode projection.

Preserve filter strings exactly, including omission versus the application schema's explicit undefined alternative; preserve verbose and its CLI default/alias. Keep all generated root/package tsconfig, aliases, syncpack and docgen content unchanged. Preserve the service's dual API, result mode tags, changedFiles and changes payload, write gating, renderer messages, and all typed error/output ordering. No string defaults, field renames, new normalizers, or narrowed payload schema are proposed.

Effect APIs are grounded in frozen installed `effect@4.0.0-rc.112` and advisory `.repos/effect` bytes. Installed `Predicate.Tuple` applies each slot predicate without imposing mutual exclusion (`Predicate.ts:1871–1889`); `Option.firstSomeOf` returns the first Some (`Option.ts:1028–1039`); `Flag.boolean` produces a Boolean and independent `withDefault(false)` supplies omission defaults. Command.make config descriptors are not actual Boolean data fields. `@beep/utils/Option` and Predicate reexport these Effect helpers. The advisory reference currently spells the flag constructor `Flag.Boolean`, while the installed dependency uses `Flag.boolean`; that reference drift is recorded, not imported into this proposal. Full API spans/hashes are frozen separately.

## 7. Test evidence and private validation

No product/package tests or source implementation were run. The full Tsconfig test, shared CLI-kit test, current/future Atlas test, Runners test and all bound sources are preserved. The Tsconfig test's only located command invocation is explicit `--write --filter` at line 212; its service tests cover sync, check/drift, filtering, generated references/aliases/docgen, and preserved payloads through the literal API. No claim is made that the existing tests already execute all eight CLI requests or directly test the three public tuple predicates.

`cli-kits.test.ts:65–118` verifies the shared RunMode's literals, precedence, compound VersionSync conditions, and both resolver/conflict helper call forms. That supports preserving existing APIs, but does not supply Tsconfig-specific eight-cell qualification or command coverage. The static matrix derives the complete raw contract from the actual documented predicate expressions, resolver fallback, and independent parser configuration.

The only executed validation for this bundle is packet JSONL/schema and private artifact validation. A Tsconfig-only inventory projection changes exactly this row, and a separately labelled combined projection includes the previously sealed Runners row to verify the proposed zero-member family. Their counts and syntax-validation receipts are not product behavior proof or independent P3 review.

## 8. Family reconciliation, risks, and integration

The canonical family says seven live records but links six; four linked designs are absent. Complete inventory parsing and inbound-reference search show only the Runners and Tsconfig active files refer back to it. Existing withdrawals and Docgen's D1 status already invalidate the broader cohort. The earlier bounded Runners family patch left these unrelated stale clauses intact; the new complete replacement supersedes that partial family proposal while preserving the sealed Runners evidence and row.

The replacement family has zero active migrations only after parent applies both D1 rows and retires both active per-instance designs. It removes the generic shared extension, dead per-instance links, instructions to refactor excluded anonymous parameter owners, universal parser-only Boolean rule, and false never-shipped Runners export claim. Existing RunMode/consumer semantics remain intact. Main a203's Atlas evidence-before-exit change adds no eligible named paired owner, so it does not revive its withdrawn record.

Parent action: integrate the same-ID Tsconfig D1 row, archive the original Tsconfig design, install this disposition, and apply the complete family replacement in coordination with the sealed Runners correction. Preserve every other inventory row and campaign owner. This proposal changes one owner classification; it does not implement a feature, claim an independent zero-finding review, alter source/dependencies/refs, or certify an R32 census.
