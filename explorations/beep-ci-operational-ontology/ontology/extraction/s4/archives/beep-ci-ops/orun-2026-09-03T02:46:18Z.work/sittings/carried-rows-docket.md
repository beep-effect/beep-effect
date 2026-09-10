# Carried-row sitting docket

Prepared for ontology-foundational-auditor run 2 (`beep-ci-ops`) over the 149 `carried_from_prior: true` rows in `work/dispositions.index.yaml`.

Status: **provisional analyst recommendations only**. The steward decides every retirement or continued deferral. This docket does not edit the dispositions index, proposal files, foundational records, or any ratification surface.

Census: **149/149 unique carried IDs resolved from the archived run-1 records** (117 SourceObservations, 32 ProseObservations), assigned exactly once across **15 clusters**. Recommended index actions: **146 retire-irrelevant**, **3 keep-unresolved**.

Coverage was assessed against the current run-2 `work/observations/` and `work/prose-observations/` records plus proposal **slugs and preferred labels only**. Because proposals are mid-revision, no recommendation relies on proposal bytes, definitions, reviews, or status fields.

Interpret `retire-irrelevant` narrowly: it retires the obsolete, parser-version-bound run-1 observation ID. For a covered cluster it does **not** say the vocabulary itself is false or out of domain; the current run-2 surface now carries the evidentiary work.

## Cluster table

| Cluster | Rows | What run 1 observed | Run-2 coverage | Recommended disposition |
| --- | ---: | --- | --- | --- |
| Elapsed and duration measurements (`elapsed-duration-measurements`) | 2 | The whole-attempt elapsedMs field and the per-lane durationMs field, including the unresolved carrier distinction for CQ-025 actual wall cost. | `covered-by-proposal` — `jv-actual-wall-duration-001` (recorded wall-duration measurement); `jv-actual-wall-duration-002` (wall-duration measurement record) | `retire-irrelevant` — The run-1 measurement evidence identities cannot be emitted at the run-2 pin and are superseded by current journal/verdict observations plus the named wall-duration proposals. Retiring these rows does not reject duration vocabulary. |
| Verification attempt structure (`verification-attempt-structure`) | 7 | Attempt-started and attempt-finished records, their shared attemptId UUID, the start marker, and the journal-event union that brackets one verification attempt. | `covered-by-proposal` — `jv-verification-attempt-001` (verification attempt) | `retire-irrelevant` — Run 2 re-grounds attempt identity and lifecycle from fleet journal records and carries a verification-attempt proposal. The old parser-bound rows are superseded evidence. |
| Verification execution structure and state (`verification-execution-structure-and-state`) | 11 | Verdict lanes and executed steps, lane status, the bridge from a planned identifier to an execution, quality-task invocations/results, GitHub lane runs, and repository-step run results. | `covered-by-proposal` — `jv-verification-step-execution-001` (work unit execution); `pa-turbo-task-specification-001` (work unit specification); `pa-turbo-task-specification-002` (verification lane); `pb-planned-lane-status-001` (verification result artifact) | `retire-irrelevant` — The run-2 surface now carries the specification/execution/state split these old declaration rows could not establish. Retire the obsolete run-1 evidence identities rather than duplicate the live vocabulary. |
| Failure verdicts and diagnostic outcomes (`failure-verdict-and-diagnostics`) | 20 | Yeet failureKind and failedStepId, terminal verdict failure, classified failed jobs, boundary-violation diagnostics, the ts2589 quarantine designation, and repository graph-health result codes. | `covered-by-proposal` — `jv-failure-signature-001` (failure signature); `jv-lane-diagnostic-comparison-001` (lane diagnostic comparison); `pa-fallow-audit-evidence-001` (verification evidence); `pa-fallow-audit-evidence-003` (verification result artifact) | `retire-irrelevant` — The domain-bearing failure and diagnostic vocabulary is re-grounded in run 2. Residual enum wrappers and report codes are implementation representations, so the non-emittable run-1 rows add no separate commitment. |
| Merge readiness and closeout outcomes (`merge-readiness-and-closeout-outcomes`) | 12 | Hosted-check and Greptile closeout gates, closeout gate/report states, mergeability changes, and merged-or-closed terminal pull-request classifications. | `covered-by-proposal` — `jv-merge-readiness-assessment-001` (verification evidence) | `retire-irrelevant` — Current fleet verdict evidence and the merge-readiness proposal supersede these run-1 gate/report declarations. Transport-specific closeout wrappers need no second ontology commitment. |
| Admission origin-key field (`admission-origin-key-field`) | 1 | The proof-lock basename used as originKey for origin exclusion, formerly seen only while the handler constructed an admission request. | `covered-by-observation-only` — `so:c627961a8fcd…a7bb`, `po:4a30b60df83c…9021` | `retire-irrelevant` — The old handler-construction observation is superseded by current carrier-level originKey evidence. Retire only the old ID; steward judgment over the current observation remains separate. |
| Grant-resource contention and contested paths (`grant-resource-contention-and-paths`) | 2 | A proof-lock acquisition callback tentatively read as SeatGrant contention and a FleetContestedPath declaration tentatively read as a path-based contended resource. | `still-uncovered` — Run-2 overlappingPaths fields describe worktree overlap, not a grant-to-resource contention relation, and no current proposal slug or label names that relation. | `keep-unresolved` — Run 3 needs a joinable admission/lock event corpus that records grant or lease identity, resource identity or path, acquisition and release instants, and the contention outcome in the same provenance chain. |
| Fleet checkout identity (`fleet-checkout-identity`) | 1 | The FleetCheckout declaration as a possible machine-local checkout bearer for CQ-015 evidence-transfer decisions. | `still-uncovered` — Run-2 path partitioning and checkoutRoot fields do not establish a stable checkout identity or its cache-mount relations, and no current proposal slug or label names Checkout. | `keep-unresolved` — Run 3 needs a timestamped fleet-inventory corpus binding a stable checkout identity to checkout root, remote origin, branch or worktree identity, and shared-cache mounts so CQ-015 transferability can discriminate the bearer. |
| Affected-package and dependency topology (`affected-package-and-dependency-topology`) | 22 | Turbo affected-query records and reasons, workspace package catalogs/metadata, package identity, direct workspace dependency, and the transitive dependency closure used by CQ-004/CQ-019. | `covered-by-proposal` — `pa-package-dependency-closure-001` (depends on transitively); `pb-package-dependency-001` (depends on); `pa-workspace-package-001` (package reference); `pb-docgen-affected-scope-001` (docgen affected scope); `pb-docgen-affected-scope-002` (docgen affected scope specification) | `retire-irrelevant` — Run 2 now names the package, direct-edge, closure, and affected-scope vocabulary. The old parser-bound catalog and declaration rows are superseded or merely DTO representations. |
| Work-unit and lane specifications (`work-unit-and-lane-specifications`) | 5 | PackageVerify step specs, GitHub-check lane and wave specs, and the storybook/test:property Turbo task keys as possible reusable verification procedures. | `covered-by-proposal` — `pa-turbo-task-specification-001` (work unit specification); `pa-turbo-task-specification-002` (verification lane); `pa-docgen-work-unit-001` (docgen affected work unit) | `retire-irrelevant` — The reusable procedure vocabulary is represented by current run-2 proposals. Old class declarations and bare Turbo keys are redundant evidence, not additional specifications. |
| Repository-plan control and ordering (`repository-plan-control-and-ordering`) | 14 | Plan-step mutability, phase order, step scope, waves, GitHub-check modes, and the compound Turbo planning snapshot used by repository orchestration. | `covered-by-proposal` — `pa-yeet-verification-workflow-001` (verification plan specification); `ov-has-scope-001` (has scope); `ov-has-step-001` (has step); `ov-schedule-step-001` (schedule step); `ov-step-index-001` (step index); `pb-yeet-proof-tier-001` (Yeet proof-planning tier) | `retire-irrelevant` — Run-2 plan/specification and ordering proposals cover the CQ-bearing semantics. The archived phase/mutability/mode shells are controller encodings and should not remain independent ontology candidates. |
| Gate-staleness result artifacts (`gate-staleness-result-artifacts`) | 7 | GateStalenessVerdict plus GateFresh, GateStale, GateUnproven, GateArtifactDescriptor, and GateFileWitness schema declarations. | `still-uncovered` — No current run-2 proposal slug or preferred label names these exact result variants, and current observations do not establish their lifecycle as exchanged domain artifacts. | `retire-irrelevant` — These are unwarranted implementation result/DTO variants. The CQ suite asks about verification-evidence validity, not the internal GateStaleness union or its file-witness wrappers. |
| Watch-stream event artifacts (`watch-stream-event-artifacts`) | 20 | Poll snapshots, diff inputs, normalized check signals/transitions, thread/comment/head events, watch termination reasons, and the versioned JSON event envelope. | `still-uncovered` — No current proposal slug or preferred label names the watch transport/event-record vocabulary; the run-2 fleet corpus captures verdict/attempt facts rather than serialized watch streams. | `retire-irrelevant` — The rows describe polling, diffing, rendering, and transport records with no Must/Should CQ warrant. The underlying verification and merge outcomes are represented elsewhere, so these wrappers are ontology-irrelevant for v1. |
| Monitor rerun-decision artifacts (`monitor-rerun-decision-artifacts`) | 11 | Planner/controller records for rerun-job, rerun-spent, needs-code-fix, awaiting-log, and awaiting-run actions, including command rendering and application helpers. | `still-uncovered` — Current run-2 observations include flake labels but not persisted monitor-decision records, and no proposal slug or preferred label names this controller decision union. | `retire-irrelevant` — These are orchestration branch/command artifacts without a CQ warrant. Failure signatures and diagnostic evidence are modeled separately; the monitor controller choices need no independent ontology commitment. |
| Quality report and configuration artifacts (`quality-report-and-config-artifacts`) | 14 | Quality profile config/detection DTOs, PackageVerify reports/documents/workspaces, GitHub-check Fallow matrices/run reports, and TurboConfigProof options/summaries/reports. | `still-uncovered` — No current proposal slug or preferred label covers each of these schema-specific containers, and run-2 observations do not show independent persistence/exchange lifecycles for them. | `retire-irrelevant` — Run 1 never rejected the implementation-only null for these unwarranted DTO/config/report declarations. They are software representations, not additional v1 domain referents. |

## Appendix: carried observation IDs by cluster

### 1. Elapsed and duration measurements (2)

Recommendation: `retire-irrelevant`.

- `po:sha256:3d30eb80b619e2b7cf5c9261718d56c4a20637d162845611a655b025482e6325` — ProseObservation quoting “elapsedMs: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),” at packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:479-509.
- `po:sha256:7b9e1b59cb9fc7b104034c01453654a7477c36f848673ec924f1c4039fbdb554` — ProseObservation quoting “durationMs: S.optionalKey(S.Finite),” at packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:143-152.

### 2. Verification attempt structure (7)

Recommendation: `retire-irrelevant`.

- `po:sha256:6e6961e95ee4bef3649372773b103fb170b76da19c610a817da19676417eebad` — ProseObservation quoting “export const YeetAttemptJournalEvent = S.Union([YeetAttemptStarted, YeetAttemptFinished]).pipe(” at packages/tooling/tool/cli/src/commands/Yeet/internal/AttemptJournal.ts:100-105.
- `po:sha256:906d0d377522942bb9220bd290bcb71907aa56c1ce497dc2cca550419419d2f8` — ProseObservation quoting “attemptId: UUID,” at packages/tooling/tool/cli/src/commands/Yeet/internal/AttemptJournal.ts:42-53.
- `po:sha256:9a531bd73c66cc707e1fd26fe320212022ca346d0bdcf26d549a103cd3fea88c` — ProseObservation quoting “A durable marker written immediately before a Yeet attempt executes.” at packages/tooling/tool/cli/src/commands/Yeet/internal/AttemptJournal.ts:29-29.
- `po:sha256:de71f16e82547bcd1c61213b48a0db513d48052cf55563ebb1634d1680d59f53` — ProseObservation quoting “attemptId: UUID,” at packages/tooling/tool/cli/src/commands/Yeet/internal/AttemptJournal.ts:73-80.
- `so:sha256:7143eaf354ebb320ca07a95f3274f3aae0cb0323f9e3d1117b88128e4ed6e826` — SourceObservation of YeetAttemptJournalEvent (variable_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/AttemptJournal.ts:100-105.
- `so:sha256:7796f616a217b54e8df2f48fbb0f01d5db11232605b3d1b24cb97268fc2a0113` — SourceObservation of YeetAttemptStarted (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/AttemptJournal.ts:42-57.
- `so:sha256:8de7e1574f6bb139c82c1a54e58cc377cb9b2425574eb104ef6e6d47a051f173` — SourceObservation of YeetAttemptJournalEvent (type_alias_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/AttemptJournal.ts:122-122.

### 3. Verification execution structure and state (11)

Recommendation: `retire-irrelevant`.

- `po:sha256:88e8e724ffb0967198fa555ab886c8a9ea3e14cf26614dd018b57b409b1c79ef` — ProseObservation quoting “description: "Execution status of one planned yeet lane."” at packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:48-53.
- `po:sha256:96adb15e475d44e88cd7f1edd0a0beb3af5c5dac0aea1a42f03a59bd4b84b3d3` — ProseObservation quoting “id: S.String,” at packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:143-152.
- `po:sha256:a8757840abf082cf2d3622dc431f79e8a9c66aa38728cafd325c609c3856a27d` — ProseObservation quoting “One planned lane with its execution status and repair command.” at packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:123-156.
- `po:sha256:fba9735d9ec0b7c541bbfc2ff30b0a3dd19d8e4b8e37874547ce6a0768b5e4d5` — ProseObservation quoting “status: YeetLaneStatus,” at packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:143-152.
- `so:sha256:0fd0abf7cb302f4f763b3a58aa6af6407d41aed5e9405aeb5ac6b97970e90ff4` — SourceObservation of YeetVerdictLane (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:143-156.
- `so:sha256:53dfa3562ca91f94710212bf848b73ec946419464d1ed9ce22b9fed4f819bc38` — SourceObservation of RepoStepRunResult (class_declaration) at packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts:405-420.
- `so:sha256:762d3dd11bc844d2df9f208f0ccba2170033d9af6c1a1c9e04e7e8b0f7c764b0` — SourceObservation of YeetLaneStatus (variable_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:48-53.
- `so:sha256:91279c1adf88d29ca0968f9abc4ff9c2ddbeb57de25df9f432b1a272bb20c983` — SourceObservation of QualityTaskInvocation (class_declaration) at packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts:243-252.
- `so:sha256:cd7765aadf2af4d0764d33623bd15e44f0052b381e6e235565dab25c0e4c8958` — SourceObservation of YeetExecutedStep (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:572-581.
- `so:sha256:daa315312a71c12c1825a31e0d63f47f647cee075cb885e1c4a244d626f3e9a3` — SourceObservation of PackageVerifyStepResult (class_declaration) at packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:148-161.
- `so:sha256:fe44538eca0527dd216b0f0bf5ef18b5b18f14cfd430fc50540bacb847afe8fe` — SourceObservation of GithubCheckLaneRun (class_declaration) at packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts:930-940.

### 4. Failure verdicts and diagnostic outcomes (20)

Recommendation: `retire-irrelevant`.

- `po:sha256:2b64e2142eac08b9cd7f1d655caa43c80b1393910f15ac892f734e341dad3f7f` — ProseObservation quoting “"boundaryViolations": 0” at standards/fallow.pilot.inventory.jsonc:37-47.
- `po:sha256:6a0fc8a8c0fdc7f387b6300ff3899f9c604c1fbf27a9ece7c5559cfa2fd4cef5` — ProseObservation quoting “LiteralKit(["ts2589-no-location"])” at packages/tooling/tool/cli/src/internal/process/StepExec.ts:191-194.
- `po:sha256:855501fcce91a1abd40a2ac7a2efc3fabe445e244e19e5f7f670097ea07cb9f0` — ProseObservation quoting “failedStepId: S.optionalKey(S.String),” at packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:479-509.
- `po:sha256:86e624235b616a7cec93d1021d31f6e3b7de441af825fd16034e8e7cde6621b0` — ProseObservation quoting “verdict: YeetVerdict,” at packages/tooling/tool/cli/src/commands/Yeet/internal/AttemptJournal.ts:73-80.
- `po:sha256:91dddfd936452b90225013e406a88d962edb7d60f7218fd17b6f3a2a01268981` — ProseObservation quoting “failedStepId: S.optionalKey(S.String),” at packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:491-506.
- `po:sha256:a4f64e891a25a6cc469a3659587b1addf85901093769fbbb58ce0529735417c8` — ProseObservation quoting “"boundary-violation": "error"” at .fallowrc.jsonc:426-436.
- `po:sha256:bde32fa6682e1b0c1117452303772e61fe6b20fc29764c45ffae977106fd9eaf` — ProseObservation quoting “export const YeetFailureKind = LiteralKit(["step-exit", "handler-error"]).pipe(” at packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:170-179.
- `po:sha256:cb47b23eada8f8e95a7da272596862e4095ac0255417231c54f95e8f7305baa2` — ProseObservation quoting “failureKind: YeetFailureKind.pipe(S.optionalKey),” at packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:479-509.
- `so:sha256:0016cfe3905b09c22b38a93799cf35fa443f35c6a3f89b192d172679f8c57629` — SourceObservation of YeetFailureKind (variable_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:176-180.
- `so:sha256:0a2c5f86ed363ec9af7d18b61cde9a0bd8f3332c6e23b7d14371b102026aa2b0` — SourceObservation of YeetMonitorFailedJob (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:299-310.
- `so:sha256:1481dce51159e820cdd129b4d588a263707a188896aefe6aa3120e1e6c734b59` — SourceObservation of QualityTaskStep (class_declaration) at packages/tooling/tool/cli/src/internal/process/StepExec.ts:232-246.
- `so:sha256:559894ea743432ee2425956d8fab59a94f1c385317f35dcbb9aa224dbcfc64fb` — SourceObservation of YeetVerdict (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:479-513.
- `so:sha256:55c95d54d18f2b82756fa2bd7f23cc3fd7d294e693d77cea47f15b2d0196abfa` — SourceObservation of TurboPlanSnapshot (class_declaration) at packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts:239-250.
- `so:sha256:5ba757a4aac98e0d3609a7d6642729c8acc1805c69aa7768f425fba4c793a2bf` — SourceObservation of StepFlakeQuarantinePolicy (type_alias_declaration) at packages/tooling/tool/cli/src/internal/process/StepExec.ts:203-203.
- `so:sha256:5ff32d0655a8cc9fbddace495da9b640c2633351caa4759c92235f53782b68e3` — SourceObservation of RepoGraphHealthStatus (variable_declaration) at packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts:154-158.
- `so:sha256:b859fe7dc5c52ac10800e3b365fc4da4e1b6fcad4a91bed38c5c97daec171815` — SourceObservation of GhMonitorRunJobs (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:750-753.
- `so:sha256:b96ad0207aebf7cdd3bf8767dd9d9e076a79928a1d0bad52c86b25a161260e9f` — SourceObservation of YeetAttemptFinished (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/AttemptJournal.ts:73-84.
- `so:sha256:c1a4b7a8cbcf4d7a688243597fc3b28d6db614cb6d358c6ca0587fbf06420f48` — SourceObservation of StepFlakeQuarantinePolicy (variable_declaration) at packages/tooling/tool/cli/src/internal/process/StepExec.ts:191-195.
- `so:sha256:c5638e3942dc3becc40f695c02528ee5b1344a8b002a1091cc84e8de9acc0032` — SourceObservation of collectYeetMonitorFailedJobs (variable_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:857-883.
- `so:sha256:ccb76a5f3fd90747552276360f6623e87a823ed693b6cf9caacb9e15d51b2b6b` — SourceObservation of RepoGraphHealthStatus (type_alias_declaration) at packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts:166-166.

### 5. Merge readiness and closeout outcomes (12)

Recommendation: `retire-irrelevant`.

- `po:sha256:e0d1f36f373003dc34f8128df7d04a4631493aba04f2675ce52ec57792cbf782` — ProseObservation quoting “LiteralKit(["hosted-checks", "review-threads", "greptile", "coderabbit", "chatgpt"])” at packages/tooling/tool/cli/src/commands/Yeet/internal/closeout/Closeout.schemas.ts:60-63.
- `so:sha256:01e37039cebeb141034280ea9064d32ad90e9c6042b222c941260520dc67e9aa` — SourceObservation of YeetMergeabilityChanged (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts:334-348.
- `so:sha256:177fb3af96fac344cee73f33ab05cddcce1c695f27838693cca1d14538e26c40` — SourceObservation of YeetMonitorTerminalState (type_alias_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:184-184.
- `so:sha256:2780de54843e2c073117897235567afa904e090a4ded2c414df0b7b22bd7338f` — SourceObservation of runYeetMonitorUntilMerged (variable_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:1041-1066.
- `so:sha256:6305419fa96099617bb98162ac43d2718d51c1b66bcee82bc34027b762df7e60` — SourceObservation of PrCloseoutReportJson (variable_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/closeout/Closeout.schemas.ts:203-203.
- `so:sha256:85a0c2546f8dc5cdc9a2d646a896bf5eadb4d39c08240549747c6e281006bf37` — SourceObservation of PrCloseoutGateStatus (variable_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/closeout/Closeout.schemas.ts:66-70.
- `so:sha256:8ee7607038f5041474aaef3747945ec491da23aadf1609c9999cc27d142d093b` — SourceObservation of yeetMonitorTerminalState (variable_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:739-748.
- `so:sha256:a48630328a1a6c95febb3aecad4e2c6f9dbe75dbcdf2698acc17f0aa024c407a` — SourceObservation of GreptileSummary (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/closeout/Closeout.schemas.ts:49-58.
- `so:sha256:b614803893bb8f68eb1c45fc4d01e226ece696364727c688bd7320b9f6da0266` — SourceObservation of PrCloseoutGateName (variable_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/closeout/Closeout.schemas.ts:60-64.
- `so:sha256:dac0c567ff454baf98279c698442d3effa8c8ce8da4a9e26251a1234e99e11b8` — SourceObservation of PrCloseoutReport (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/closeout/Closeout.schemas.ts:156-180.
- `so:sha256:e49d7857a2f1d0c247b2bf32b8005aff0f0790bcba3b74dbf5cc27023140a054` — SourceObservation of PrCloseoutGateState (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/closeout/Closeout.schemas.ts:92-103.
- `so:sha256:f8963ec48e961a04e383747bb395792880b08befbcd942fe659fe7fad0da33cb` — SourceObservation of YeetMonitorTerminalState (variable_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:171-176.

### 6. Admission origin-key field (1)

Recommendation: `retire-irrelevant`.

- `po:sha256:9c89bf17f35f4e9ac5dd3791656461492478cbd1e99258fd1e95b5babec7f0e6` — ProseObservation quoting “originKey: path.basename(lockPath, ".lock")” at packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:313-320.

### 7. Grant-resource contention and contested paths (2)

Recommendation: `keep-unresolved`.

- `po:sha256:5fa0d40013f2f1bace37c166a14058909069e91de0f63b823bd0921c40f68278` — ProseObservation quoting “tryAcquire: acquireFullProofLockOrObserveAtPath(lockPath, context, proofSteps)” at packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:322-330.
- `so:sha256:b42503da37767cc741db6196fbf13e019bdc59f71166ad4d95318966ca7ae123` — SourceObservation of FleetContestedPath (class_declaration) at packages/tooling/tool/cli/src/commands/Worktree/Worktree.schemas.ts:715-723.

### 8. Fleet checkout identity (1)

Recommendation: `keep-unresolved`.

- `so:sha256:0d096342f5ba116307ca177adcbc3fc775b860ae0e5fd62dfd4d090d86c660a3` — SourceObservation of FleetCheckout (class_declaration) at packages/tooling/tool/cli/src/commands/Worktree/Worktree.schemas.ts:671-694.

### 9. Affected-package and dependency topology (22)

Recommendation: `retire-irrelevant`.

- `po:sha256:3842a52c7caada940ed89a9dd852f272f282f21620fd632dc4e92770ec7c49c1` — ProseObservation quoting “PackageRef,class,CQ-004,"@beep/* workspace package identity"” at explorations/beep-ci-operational-ontology/ontology/docs/pre-glossary.csv:12-12.
- `po:sha256:47c1ecee6c68dd2abf05cf58cdbdc3944bbad2d1375eccbaa2bd1abea13d3ec9` — ProseObservation quoting “"@beep/identity": "workspace:^",” at packages/drivers/hubspot/package.json:62-62.
- `po:sha256:648149e8ec61b86770c1c8511b659226c3e8605ab43ac3a0c03439f40b6002fa` — ProseObservation quoting “"@beep/test-utils": "workspace:^",” at packages/drivers/hubspot/package.json:68-68.
- `po:sha256:7f1b0cc144cf9d58f851e9c6a1857dfd6ffdea2db7c0c4c083d7779b6a5048fd` — ProseObservation quoting “?pkg ciops:dependsOnTransitive ?touched .” at explorations/beep-ci-operational-ontology/ontology/docs/competency-questions.yaml:116-116.
- `po:sha256:95043bdded97559199ecb0db22c74fb5278abc7814d2c685019f9d1134a81547` — ProseObservation quoting “Arrows point from the importing package to the imported package.” at standards/ARCHITECTURE.md:189-194.
- `po:sha256:a790b3398403b1be2e7ced74bd8a5ef6b741760df1667416c0fa1410f18fbde9` — ProseObservation quoting “dependsOnTransitive,property,CQ-004,"Datalog fixpoint over dependsOn (rule-compiled)"” at explorations/beep-ci-operational-ontology/ontology/docs/pre-glossary.csv:54-54.
- `po:sha256:c9742edfc85a5c11f0217252b9961631a94a3b86c634c01f2cff9c08508d0533` — ProseObservation quoting “turbo query affected” at packages/tooling/tool/cli/src/commands/Yeet/internal/TurboQuery.ts:254-262.
- `po:sha256:e1b16485ec1f3285d03674eb6bb8d3da10dad7235a569391e48bbd00697a9e16` — ProseObservation quoting “dependsOn,property,CQ-004,"direct workspace dependency edge; semantic-support (two-kind law): supports=dependsOnTransitive — the fixpoint's base relation (round-3 I-03/H-09 licensing fix)"” at explorations/beep-ci-operational-ontology/ontology/docs/pre-glossary.csv:55-55.
- `so:sha256:0ce3a84de808ba01f895a7dcba0ff39a6d37daae78abd3eef57fa9e37a554808` — SourceObservation of TurboQueryPackage (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/TurboQuery.ts:91-99.
- `so:sha256:19f1e38081aee7b60aecde18430abd809861b1cf6eb9ebf7065e34305b7275be` — SourceObservation of name (config_document) at packages/drivers/hubspot/package.json:1-72.
- `so:sha256:21fd15adfc632d3c13e0b52ed7a7b241aa285daf9e695b7a4f91880efd71422e` — SourceObservation of TurboQueryAffectedReason (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/TurboQuery.ts:31-38.
- `so:sha256:29b24028f0dfacf53ea6e68e56831a4a30aedbe593714f54fc38a7ff1ffcf755` — SourceObservation of TurboQueryAffectedTaskConnection (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/TurboQuery.ts:61-71.
- `so:sha256:308d8cf8a291855a224ef1088b124e39afc4b15550f72bb003ec4966b40acce8` — SourceObservation of TurboQueryAffectedData (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/TurboQuery.ts:73-80.
- `so:sha256:324517ded376b6dfcf6932e4ac2f2ddefd53a76bfb56b19e6fe9de926ea19990` — SourceObservation of TurboWorkspacePackage (class_declaration) at packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts:214-222.
- `so:sha256:34992167c59b76a419b1c6851c319edceb48b1c97ca392c2dbedc5ae0b01303f` — SourceObservation of PackageJsonWorkspacesDocument (class_declaration) at packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts:269-278.
- `so:sha256:39221ec0124c17dffbcbed38afe8367929660e07f7f5decf79df8cb8bfb4dc7d` — SourceObservation of TurboQueryAffectedTask (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/TurboQuery.ts:49-59.
- `so:sha256:4a64226d4f4e79c645be3905c847727726f5d1d1488e204b446f2d31bf100854` — SourceObservation of PackageVerifyWorkspace (class_declaration) at packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:85-94.
- `so:sha256:61c1bf9440b68549825b36c8f21f161d4eb7214e2703a59c3b8bf34020a06e86` — SourceObservation of TurboQueryLsDocument (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/TurboQuery.ts:111-119.
- `so:sha256:6bc0f2e3af7672616e5fe40dacbc6a0a54ae24399ddd632e6448319c30bf7510` — SourceObservation of TurboQueryAffectedDocument (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/TurboQuery.ts:82-89.
- `so:sha256:d80b78a8b525a1d9d3429688e5907aaa7a926b965d94a29efb3fb9dd1080795f` — SourceObservation of decodeTurboPlanTasksFromQueryJsonForTesting (variable_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/TurboQuery.ts:284-284.
- `so:sha256:e132249931623c34727a29cb5696b1e031836c6c5106e4e46cd145d2c2650593` — SourceObservation of TurboQueryPackageConnection (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/TurboQuery.ts:101-109.
- `so:sha256:fe1dbd4ba4f52a6957d7a51e6e130fa5ce90e9eb74deab72b30589aaf6973759` — SourceObservation of TurboQueryAffectedPackageRef (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/TurboQuery.ts:40-47.

### 10. Work-unit and lane specifications (5)

Recommendation: `retire-irrelevant`.

- `po:sha256:aac8ce7affe0bdd25e59ca5492726e91fb9a3b936009ebef512981bcfdc1c9b4` — ProseObservation quoting “"storybook": {” at turbo.json:241-241.
- `po:sha256:cd039ccfee27376edd08a5ec9157acfddc84b5004ffa125174bfc5ff2f7fbf6a` — ProseObservation quoting “"test:property": {” at turbo.json:111-111.
- `so:sha256:1cb8d4e2b4635df071ce9f58a6465718c1536825bf45fc3927bce758959976a1` — SourceObservation of PackageVerifyStepSpec (class_declaration) at packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:114-122.
- `so:sha256:67507f3d087ad2239cc47ee9f7622df86e6f79e03730f63cb0ee6ebd0e4c7320` — SourceObservation of GithubCheckLaneWaveSpec (class_declaration) at packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts:871-879.
- `so:sha256:acf8fc7875146dbe623d9a6d11a4eeeea04d59adf74dc7ecf2fb4a868c7b27c7` — SourceObservation of GithubCheckLaneSpec (class_declaration) at packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts:843-854.

### 11. Repository-plan control and ordering (14)

Recommendation: `retire-irrelevant`.

- `po:sha256:64d90805ebfbc6afee58171bc8f40cc34294e5a165e1e68ee59c3941f5878eea` — ProseObservation quoting “LiteralKit(["readonly", "write", "publish"])” at packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts:70-73.
- `so:sha256:193bdccb773affb34025f7d4b136568a01d2a47582a8f3f44e1381a3038fa092` — SourceObservation of RepoPlanStepMutability (type_alias_declaration) at packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts:82-82.
- `so:sha256:704700c3569c97c04ce6698d167bf38c6ee95850d1a68bd3c0d8a3732107994f` — SourceObservation of GithubCheckMode (variable_declaration) at packages/tooling/tool/cli/src/internal/repo-run/RepoRun.proofs.ts:46-50.
- `so:sha256:8e80633e942a2d17018c25156dff9f4303f22db8437f15e2c754abb1a9e6bcfe` — SourceObservation of RepoPlanPhase (type_alias_declaration) at packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts:54-54.
- `so:sha256:906f9d719b7531f4c878c535e72c3cdae60b54bd8ef3ea349d1887b118f54cc9` — SourceObservation of enforceConservativeResume (variable_declaration) at packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts:530-536.
- `so:sha256:a64dc174173ded5009d4e8d1b7c7f0e8aa1ab75aa53e55eddbf0ab021e440325` — SourceObservation of RepoPlanStepScope (type_alias_declaration) at packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts:110-110.
- `so:sha256:a6ad40a935472aecb313008c29de7fd676155defa4706d1d7f8b1808a84ac3eb` — SourceObservation of isConservativeResumeCandidate (variable_declaration) at packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts:519-520.
- `so:sha256:b78c10638ffab60de01ad1bc57cc639ce379fb6e46a3e589c8b9e38329d10828` — SourceObservation of RepoPlanWave (class_declaration) at packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts:307-315.
- `so:sha256:cffc9352dab29999a8fea11c29898375fb9f5d0140582e5b325a5e361eafdf5a` — SourceObservation of GithubCheckMode (type_alias_declaration) at packages/tooling/tool/cli/src/internal/repo-run/RepoRun.proofs.ts:58-58.
- `so:sha256:dd4ce73b5f90b6a2cc48a40c200e4ab2a0f7353fbfbd20f5e53251a0d390ee71` — SourceObservation of GITHUB_CHECK_MODE_VALUES (variable_declaration) at packages/tooling/tool/cli/src/internal/repo-run/RepoRun.proofs.ts:28-38.
- `so:sha256:f71b168a6c2ae3db3894064c6c52de3f29b7464bb4e6d6d6194a7b6ad5e99155` — SourceObservation of RepoPlanPhase (variable_declaration) at packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts:34-46.
- `so:sha256:f9ff896ab85e892800a541b68651b2f1827025998e2acf58e3c18b7bd73d9c5d` — SourceObservation of RepoRunContext (class_declaration) at packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts:276-290.
- `so:sha256:fc13da4a27d636493bf0caed7e01a55c91e31a45fe97c80ad34f40e7d9948b43` — SourceObservation of RepoPlanStepMutability (variable_declaration) at packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts:70-74.
- `so:sha256:fd30915e1d17659297436b33480b65b1417ff9b0274b7beafa8b70cd814d4596` — SourceObservation of RepoPlanStepScope (variable_declaration) at packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts:98-102.

### 12. Gate-staleness result artifacts (7)

Recommendation: `retire-irrelevant`.

- `so:sha256:1b632257febcbb643a3ab96bf64a1196964c1bf6edc0376b50cabea2bac2098d` — SourceObservation of GateUnproven (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/GateStaleness.ts:235-244.
- `so:sha256:2c69da902821ace2904ede4845d9193e0358eb571e5d563d0aaaf080dcfe161a` — SourceObservation of GateStalenessVerdict (variable_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/GateStaleness.ts:266-271.
- `so:sha256:505c45f1b6b21cea941e3727724c4453c62fc6afc248ae88a8f3a817372b9afb` — SourceObservation of GateStalenessVerdict (type_alias_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/GateStaleness.ts:279-279.
- `so:sha256:9425d788587d694dee636b406feb6512298532c3795a7dc770bdfc7f4dd7487c` — SourceObservation of GateFileWitness (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/GateStaleness.ts:139-147.
- `so:sha256:a4a2bc6f88d7c94e877af69ce8c4e42f68cf4125076460fb0b59cabf1abf866a` — SourceObservation of GateFresh (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/GateStaleness.ts:190-198.
- `so:sha256:ab9b40285e051d72072bcdf5cbda763df48c9df2f6d8bf3f0d1660078dc956a9` — SourceObservation of GateStale (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/GateStaleness.ts:206-220.
- `so:sha256:d5e1b188a11d80b9489f3616a3b705634c3b4fdecee69ef7180d463c7f2dee85` — SourceObservation of GateArtifactDescriptor (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/GateStaleness.ts:170-181.

### 13. Watch-stream event artifacts (20)

Recommendation: `retire-irrelevant`.

- `so:sha256:01ebe52998854e6382ed57cfc9052b2f4fbb29e735679f51e8911afd85469ded` — SourceObservation of YeetWatchEndReason (type_alias_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts:529-529.
- `so:sha256:0850d3a983d8a8f44ce9a2adb228ff9120ae1c83d5543c1dacfd24223bf46350` — SourceObservation of renderYeetWatchEventLine (variable_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts:617-618.
- `so:sha256:0bc0f3a4d5971c2427a262b3149ba5e6246f47d5bf319c9230e8f6f7c0f6468c` — SourceObservation of diffYeetWatchSnapshots (variable_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts:694-740.
- `so:sha256:1d6e22c81b4f8811f19b0ae4080b38b605c459c696d3715f7bc238441092f17f` — SourceObservation of YeetWatchEvent (variable_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts:565-578.
- `so:sha256:1e993a781d8287c7d8eaef6ac56a139bd3849cf1fc650a91d7db9ac29c4f5fef` — SourceObservation of YeetWatchEvent (type_alias_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts:586-586.
- `so:sha256:357936bd5c10475bb683a73ef496a31521cdf91e52e444875205b73303f7ab1b` — SourceObservation of YEET_WATCH_SCHEMA_VERSION (variable_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts:60-60.
- `so:sha256:475cea15f30764a8045bd4d652dbc2c3c65b2cbde1b708f31800facdf6a2fbb1` — SourceObservation of YeetWatchDiffInput (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts:632-641.
- `so:sha256:47b1a59826ab332b9eb041001164f4b492dccb445629cf6fa858330701f649ff` — SourceObservation of YeetCheckTransition (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts:289-304.
- `so:sha256:53871c1d8d3f62889042f3a5d4388e6e993dc3ef0478c837fbe383b75b912edd` — SourceObservation of yeetWatchEndReason (variable_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts:777-788.
- `so:sha256:72751a9073713f96a4c3bf12a592db87e3b0b3364ab929e8d5fca792681f5ac4` — SourceObservation of YeetWatchSnapshot (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts:242-254.
- `so:sha256:985f8eabadd1ff4531d7bdf639ae2da797f9b2ef8124751b0452456d3551bea6` — SourceObservation of YeetWatchEnded (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts:537-551.
- `so:sha256:98cbdf1184f9cba51246aa80f650640311ce755674f478e3faac85f89074ecda` — SourceObservation of yeetWatchCommentEvent (variable_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts:459-494.
- `so:sha256:9a050882c859fbe6a493e1313f31f1062c204cb96663c81dfcac83bef8f5d917` — SourceObservation of YeetWatchThread (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts:201-209.
- `so:sha256:a7c6ae0d10535713f109acc2252a5ec84ab4500696ac752d7782c3625caa5747` — SourceObservation of YeetWatchCheck (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts:180-193.
- `so:sha256:b870d15f88a575353b6b0228cd405f21da494b88735fc82c49042a272e0095ab` — SourceObservation of YeetCheckSignal (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts:114-122.
- `so:sha256:be1853aae0f018d491da8f4e61a6144f1a4e2667aee6d3772e8a68897842cc5f` — SourceObservation of YeetThreadTransition (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts:312-326.
- `so:sha256:c30acf2ce6e721bb586765a46dc7f4aa0760f5c25dea64f91deac21f76228ed3` — SourceObservation of countYeetWatchFailures (variable_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts:815-816.
- `so:sha256:e931fc8b69e9c72f2f382ba6835ae50ed773594333b915a075f1510603035efc` — SourceObservation of YeetCommentPosted (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts:403-423.
- `so:sha256:f44344e14a671f9e5f86859eef0dccb723949c53750e0b7e5ec4c33dd473bf7b` — SourceObservation of YeetWatchEndReason (variable_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts:516-521.
- `so:sha256:f45109a7f280b3b010b8766d51c4c09c8e315cb04beb5d1ff38b45ad70c7ab86` — SourceObservation of YeetHeadChanged (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts:356-369.

### 14. Monitor rerun-decision artifacts (11)

Recommendation: `retire-irrelevant`.

- `so:sha256:0e23613c08bd8703273959a5bf2dc75dd4fdea088a0aed2f5cd6a7684c30a06c` — SourceObservation of YeetMonitorJobDecision (type_alias_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:479-479.
- `so:sha256:2be3b248a3b888f63aa21e0598782e2efec976842e70e3d18420d1051487f9ef` — SourceObservation of planYeetMonitorReruns (variable_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:614-673.
- `so:sha256:3c67cece44cdfc67ae4bbc448bf87d837a9d92f55e59ff82135d00f2baec589e` — SourceObservation of yeetMonitorRerunCommand (variable_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:567-567.
- `so:sha256:538ac118dd5cd92616c9fe8d60133d6795e073e9433a44f749cce9951f291f2e` — SourceObservation of renderYeetMonitorJobDecision (variable_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:707-720.
- `so:sha256:7d81fca784579f2d5bf1d2bed62d836c001fedda5a774dbed3b94280174af3f0` — SourceObservation of YeetMonitorRerunJob (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:318-329.
- `so:sha256:a1c22fb0769c94f71dfe06a5f79cc81acad12d7b6ef289ddec66ee71291a695e` — SourceObservation of YeetMonitorJobDecision (variable_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:460-471.
- `so:sha256:a2352db33ca14ce4c1da0bf89decf6bc399e46f050d701ba267129ce31cda2e2` — SourceObservation of applyYeetMonitorJobDecision (variable_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:924-933.
- `so:sha256:ade05d26b085f9b2d69b9583ce1f0b4dcb97e42de7725390b49801e6f2b9c533` — SourceObservation of YeetMonitorAwaitingLog (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:397-406.
- `so:sha256:b05fb409eaff217c8757f9310dedb0581462cc68b81bcc55feaa2e41312a75f9` — SourceObservation of YeetMonitorRerunSpent (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:345-355.
- `so:sha256:ee1ece20418d730e54254ad7e2e33c3fe0193b1ee493d97e4cacb3717b4a0a4d` — SourceObservation of YeetMonitorAwaitingRun (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:429-438.
- `so:sha256:fc1a7afac87552a779a76bd632d960cf8a72272ed79d6187cfb88fd040cec99b` — SourceObservation of YeetMonitorNeedsCodeFix (class_declaration) at packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:363-372.

### 15. Quality report and configuration artifacts (14)

Recommendation: `retire-irrelevant`.

- `so:sha256:174bc1e94d345376660ef5fa87113a49198ca33bcb34da61b934af64724b4ace` — SourceObservation of QualityProfileConfig (class_declaration) at packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts:386-398.
- `so:sha256:3e296553a20a27503388bc986394099c7c5581a8666a9fdd199ce051bdf89b3f` — SourceObservation of PackageVerifyReport (class_declaration) at packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:183-193.
- `so:sha256:50b72ba5de1b4f4faa716b9b6d2b8ed6d678cb4950580f0ae8f85dad06eadddd` — SourceObservation of QualityProfileDetectionInput (class_declaration) at packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts:454-465.
- `so:sha256:61cc360f5e99072fd1fd7b63748a43f8d39a921c4fce5c655e4937f1bfec4169` — SourceObservation of PackageTaskProfile (class_declaration) at packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts:213-222.
- `so:sha256:814e752549f0f43ad157a175616e3eb5549db881fc1fd9216c46b0faa12575c0` — SourceObservation of TurboConfigProofReport (class_declaration) at packages/tooling/tool/cli/src/commands/Quality/internal/TurboConfigProof.ts:194-207.
- `so:sha256:8bbc8fc68d7ff8865048928f754aea654b620b9ffbaae0064f8f4f1e9253f8b1` — SourceObservation of TurboConfigProofCountSummary (class_declaration) at packages/tooling/tool/cli/src/commands/Quality/internal/TurboConfigProof.ts:153-166.
- `so:sha256:957c9ffbcf7ab4c0dd90e7566dfc5080ffcbab33a8a2981a57facc8c571aecdb` — SourceObservation of GithubChecksFallowFeatureMatrixRow (class_declaration) at packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts:666-677.
- `so:sha256:a86ebcb3d399835d6fe9c78128b16394d23254111ea17aa6e6e6b42ccca24ddc` — SourceObservation of TurboConfigProofOptions (class_declaration) at packages/tooling/tool/cli/src/commands/Quality/internal/TurboConfigProof.ts:215-225.
- `so:sha256:a99d68de5fb72eb7f8c94c29b881cf9799c47fd386471042b810a019bb4493a1` — SourceObservation of GithubChecksFallowFeatureMatrix (class_declaration) at packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts:694-703.
- `so:sha256:dcc8e45291ae54f9a3c4762ead3efdc29081b62bda5af6761c676a84f148ba60` — SourceObservation of GithubCheckRunReport (class_declaration) at packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts:961-970.
- `so:sha256:e34825fda95ce3050968b41d1d89037c85ab81e7f0cbab58d9ea1a2d907163fa` — SourceObservation of QualityProfileDetection (class_declaration) at packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts:427-437.
- `so:sha256:e78b1a951729f59c449331ce1b39c87d1775a6c55e16f9c27cfcf70d97544f90` — SourceObservation of PackageJsonDocument (class_declaration) at packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts:295-304.
- `so:sha256:f484833e6327058feb6e879ca5f7ac16995b5cc267ae52ce7cbd7f48c8258285` — SourceObservation of TurboConfigProofDryRunSummary (class_declaration) at packages/tooling/tool/cli/src/commands/Quality/internal/TurboConfigProof.ts:174-186.
- `so:sha256:f8da674d8c16b9380e097c523f483e16748d4eb10287d3fe570ea4b9bb2986c1` — SourceObservation of PackageVerifyPackageJson (class_declaration) at packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:195-203.

