# Tooling callable census corrections during Round 28

Current source: `93217d998f851e2e93d9864e2b5315552eaa58a7`; main:
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`. This native P2R source audit
withdraws twelve invalid D1 rows. It does not add qualifications or claim a
complete independent census or P3 review.

Eleven rows name Boolean-returning functions or schema-derived guards under
invented state-group names. Those callable values do not form a Boolean state
carrier. The remaining row refers to a local pair removed by the latest main
extraction. These rows should be archived and removed, rather than kept as D1
without an eligible declaration.

## Exact declarations

Source paths are relative to the repository. Table references use the common
`packages/tooling/` prefix, omitted for readability.

| Withdrawn inventory id | Actual source declaration and use |
| --- | --- |
| `r3-tooling-aisync-claude-permission-gates` | `library/ai-sync/src/validation.ts:151,178` binds `S.is` guard functions. `unapprovedClaudePermission` at180 calls the first; the deny policy at263 calls the second. There is no `permissionGates` state record. |
| `r3-tooling-tsmorph-path-error-gates` | `library/repo-utils/src/TSMorph/TSMorph.service.ts:427-438` declares `isOutsideAncestor` and `isMissingDirectoryError` functions over different arguments. Their uses at939/980/1267/1283 do not construct a Boolean pair. |
| `r3-tooling-terse-effect-object-thunk-gates` | `tool/cli/src/commands/Laws/TerseEffect.ts:433-443` declares two functions. The call at454 applies them to separate `onNone` and `onSome` nodes; it does not store the functions as Boolean members. |
| `r3-tooling-terse-effect-matcher-receiver-gates` | `tool/cli/src/commands/Laws/TerseEffect.ts:357-361` declares two predicate functions, passed as callbacks at379/382. `receiverGates` is not a declaration. |
| `r3-tooling-terse-effect-optional-spread-gates` | `tool/cli/src/commands/Laws/TerseEffect.ts:463-474` declares three predicates. Calls at498/506 inspect syntax nodes directly; no three-member Boolean aggregate is formed. |
| `r3-tooling-terse-effect-nested-matcher-gates` | `tool/cli/src/commands/Laws/TerseEffect.ts:532-536` declares two predicate functions. The scanner invokes them at632/635. Different classifications of a call expression do not turn those functions into sibling state. |
| `r3-tooling-schema-topology-export-key-gates` | `tool/cli/src/commands/Lint/SchemaTopology.ts:98-123` declares four string predicates. Rules at169/173/177/181 retain callable `matches` properties, not Boolean results. |
| `r3-tooling-schema-topology-export-target-gates` | `tool/cli/src/commands/Lint/SchemaTopology.ts:125-155` declares four target predicates. Rules at189/194/199/204 retain callable `matches` properties. The synthetic `targetGates` owner is absent. |
| `r3-tooling-no-native-runtime-typeof-gates` | `tool/cli/src/commands/Laws/NoNativeRuntime.ts:314-326` declares one predicate that calls another. The detector invokes it at440-441; this is a function dependency, not a pair of stored flags. |
| `r3-tooling-tsconfig-sync-plan-export-gates` | `tool/cli/src/commands/TsconfigSync/TsconfigSync.plan.ts:492-496` declares two predicates. The first guards the exports object at512; the second filters package subpaths at541. They are not sibling Boolean values. |
| `r3-tooling-ci-lane-docgen-input-kind` | `tool/cli/src/commands/Ci/CiLane.ts:1572-1586` declares two path predicates. `docgenLaneModeForChangedPaths` at1604-1609 applies them through `A.some` and returns an existing mode literal. There is no stored `inputKind` Boolean pair. |
| `r3-tooling-schema-first-file-gates` | The old `Lint.command.ts:254-255` pair is deleted by the main extraction. Current `tool/cli/src/commands/Lint/Lint.command.ts:441-452` has only one named Boolean `isToolingFile`; the focus test is an inline `HashSet.has` expression. It does not preserve an `isRuntimeFocusFile` member. |

## Deliberately separate value audits

Actual computed Boolean values remain in scope. In particular,
`SchemaFirstScan.ts:218-219` has a real normalization/somes signal pair,
`SchemaFirstScan.ts:239-242` has a real function-inspection pair, and
`Lint.command.ts:466-471` has a real pattern/fallback pair. These are being
adjudicated separately against their producers and supported inputs. This
callable withdrawal does not exempt their files or presume their independence.

The function-inspection pair has preliminary implication evidence because
both underlying file-eligibility predicates reject `.tsx`; its complete
source reachability and proposed design belong to the separate value audit.
No provisional qualification is added by this receipt.

## Preservation and proof scope

Graft exhaustively located all named declarations and their indexed uses;
exact source reads and the old/current Lint diff established the removed local
pair. The decision relies on declaration types and actual writes, not on a
missing graph edge. The parent integration archives the exact twelve prior
JSONL lines and records before/after inventory hashes. There are no current
design files attached to these disqualified rows.

Product code, tests, the R27 verdict and evidence, and the immutable R28 seed
remain unchanged. The independent Round 28 owners still scan every affected
file. Native metadata correction alone does not make that round dry or complete.
