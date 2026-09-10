# SweepGitState full-owner adjudication boundary

Source `06c381b61abee8356b78c52b72eb8a5562015bfd`, main `5fc065daff16300b8435eca3f32d55564664f57c`. This native P2 note accompanies the proposed status-only design. It preserves findings outside that selected cluster without inventing replacement inventory ids, unsupported D1 verdicts, a complete legal cardinality, or P3 approval.

The source files and fixtures cited below remain byte-identical at merged HEAD
`1c07c15495aaa42f521b887b01e943e68804606c` over main
`3657f8f97f7135c53c3c0b9fa99aa19093c3e5ee`. The following is the original
adjudication boundary; separate follow-up evidence must resolve its open candidates.

## Exact disposition

The existing canonical row `yeet-sweep-git-state` is D1 with seven Boolean members and the assertion that any combination can hold. The R29 raw report proposes the same id as qualified128/60, with a declaration locator at182 (the first member rather than the class at177). Both broad assertions require correction.

The proposed replacement retains the stable id and actual class locator177, selects only `worktreeDirty` and `statusProbeUnreliable`, and carries E4 /4/3, derived/internal/LiteralKit/Tier1. The complete private P2 design changes only that axis. It preserves all supported constructors and behavior of the rest of the class. Parent must archive the exact prior canonical row before replacement; the private `original-row.jsonl` contains its current bytes. There is no current canonical design for this D record to archive. Preserve the R29 raw report and R28 native receipt unchanged as historical evidence.

No leftover field is silently classified D1. The parent may record this note as unresolved owner evidence and independently adjudicate other clusters later without duplicating the selected status pair.

## Complete declared domain

At `packages/tooling/tool/cli/src/commands/Yeet/internal/Sweep.ts:177–200`, the class has these fields:

- Three required `NonEmptyString` payloads: branch, mainBranch, headBranch.
- Seven actual Boolean fields: worktreeDirty, mainCheckedOutElsewhere, branchCheckedOutElsewhere, branchMergedIntoBase, lockfileMovedOnMainUpdate, statusProbeUnreliable, worktreeProbeUnreliable.
- Seven actual `Option<NonEmptyString>` fields, each with optional-key encoding and `SchemaUtils.withNoneDefault`: mainWorktreePath, mainTip, localTip, remoteTip, pullRequestState, pullRequestHeadBranch, pullRequestHeadOid.

The full Boolean/presence projection has `2^7 * 2^7 = 16,384` representable tuples. The concrete payload domain remains unbounded. This projection counts only real Option absence/presence; it does not manufacture bits from required payload equality, nonempty string content, arbitrary status values or path comparison. `pullRequestState` is not a three-value literal schema; every nonempty String is admitted by the current type. The seven Option defaults preserve None when omitted; a caller-supplied whitespace-only nonempty string is not rejected by a new trim/brand in this design. The live observer separately trims raw command strings using GitExec.ts:183–184.

## Proven writer relations and explicit contrary constructor evidence

| Relation                                                     | Source evidence                                                      | Why it does or does not define the whole exported carrier                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| statusProbeUnreliable implies worktreeDirty                  | Sweep.ts:141–146,749,755                                             | It is an explicit observation contract and every concrete status constructor respects it. Tests199–231 and533–541 corroborate; no unreliable/clean fixture exists. This is the selected4/3 cluster.                                                                                                                                                                                       |
| worktreeProbeUnreliable implies both occupancy Booleans      | Production writer750–756                                             | Test814–821 explicitly passes `stateWith({mainCheckedOutElsewhere:true, worktreeProbeUnreliable:true})` to refreshNotCompletedHandoff. `mergedFacts` leaves branchCheckedOutElsewhere=false. The helper still has a supported no-path outcome. This is a counterexample to the broad public-class implication, not a malformed record that may be erased on the strength of the observer. |
| Reliable main-held is equivalent to Some(mainWorktreePath)   | Writer750–762 derives both from worktreeHolding; helper581–588       | Tests279/285 intentionally construct mainCheckedOutElsewhere=true while mainWorktreePath remains None. The schema's None constructor default and the documented fixture seam make this supported partial information. Tests775/789/798/807 also construct true/Some with complete exact paths. A strict five-case observer occupancy union would lose supported input.                    |
| Unknown worktree observation has no main path                | Writer757–762; tests814–821                                          | The live source prevents an invented handoff path on a failed probe. No opposite supported fixture was found. However the exported refresh helper reads the Option itself at1033–1047, not the reliability flag. This fact needs its own constructor-domain adjudication before any field removal.                                                                                        |
| branchMergedIntoBase implies localTip Some                   | Writer753 explicitly ANDs successful ancestry with localTip presence | This is a real E4/E3 candidate relation. Tests115–121 construct true with Some;151–155 construct None with false; all known constructors respect it. It is not expanded into the selected status row because a complete grouped constructor-domain proof has not been finalized, and it has different deletion consumers. The field and guard stay unchanged.                             |
| mainTip / localTip / remoteTip presence correlations         | Probes723–725, ancestry726–731, lockfile732–738                      | These are sequential observations, not an atomic Git snapshot. A ref can disappear, appear or become unreadable between probes. Main-tip absence cannot be ruled out by later lockfile success, and local/remote tips need not agree. Do not erase temporal independence or invent branch-name equality axes.                                                                             |
| PR Options must all be present or all absent                 | observePullRequest600–610 and projections766–770                     | Refuted as a blanket constructor claim by missing-head-oid fixture158–161 and missing-head-branch fixture186–191 while the other PR values remain Some. GhPrView:124–136 declares unrestricted String head/state and optional String oid; per-field trim-to-Option may also produce different presence results. No replacement all-or-nothing PR model is justified.                      |
| lockfile forecast implies an earlier main-tip read succeeded | Forecast754 versus probe723                                          | There is no such source-level implication. The forecast and stored mainTip come from different commands and times; the actual execution-time install behavior is deliberately rederived at1052–1101.                                                                                                                                                                                      |

## Counts that must not be admitted

The raw7-Boolean128/60 number comes from the live writer's status3 × occupancy5 × ancestry2 × forecast2 projection. It omits all seven real Option domains and already fails to cover the explicit unknown-worktree/branch-false helper input.

A tempting full projection calculation is status3 × occupancy-with-path5 × local-tip/ancestry3 × main-tip2 × remote-tip2 × forecast2 × PR-presence8 =2,880. **This is not a proven complete legal-state count**, even for supported observer contracts. It composes a subset of source relations and grants all PR-presence combinations without a supported witness for every one; class fixtures also exceed its occupancy image. The earlier informal chat shorthand “observer-only full16384/2880” was too strong and is withdrawn by this final source note. The calculation is retained only to identify the unsupported assumption, not to support admission.

Adding one or two fixture exceptions to such a product is also insufficient. A partial helper fixture does not prove arbitrary Cartesian independence of all its untouched flags and payloads. A full-domain proposal needs a contract-level classification of valid constructed snapshots, per-helper diagnostic inputs, source-reachable observations and legitimate temporal changes. It must preserve every cited fixture and full payload domain, not extrapolate all tuples from generic schema permissiveness.

## Safety/output invariants retained by the status design

- Keep mainFreePrecondition and branchFreePrecondition's current reliability precedence at267–278.
- Keep mainWorktreePath Option/default and both handoff branches at1033–1047, including exact paths and quoting.
- Keep local existence, PR merge/identity and tip equality preconditions at319–365; fresh local/remote checks at891–975; compare-and-swap lease at371–381 and840–862.
- Keep plan order, step outcome routing, operator commands and pre/post-refresh distinction at383–410,485–505,1052–1101,1186–1335.
- Keep the external plan/report codecs and CLI rendering unchanged; the raw class has no found encoded consumer.

The untouched sibling relations stay visible for future independent adjudication. Their uncertainty does not erase the documented status implication, and the selected status design does not grant broader permission to tighten the carrier.
