# Carried-row sitting docket

Prepared for run 3 (orun-2026-09-10T02:10:52Z) of beep-ci-ops at frozen HEAD 1c7cd98289150f481fd40721efa6b7fe6109e711.

Status: provisional analyst recommendations for the steward. The recommendation retires an obsolete
observation identity or records the evidence still needed. A proposal remains subject to its current
analysis, review and ratification obligations.

**Census: 68/68 prior unresolved IDs, exactly once, across 15 clusters and 33 distinct prior evidence
requests. Recommended outcomes: 14 irrelevant retirements and 54 unresolved parks; 0 mapped and
0 proposed.** Every recommended row carries carried_from_prior: true. Every park uses new
needed_evidence and since: 2026-09-10.

The prior index was read through git show HEAD:explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/runs/orun-2026-09-03T02:46:18Z.index.yaml.
Its full SHA-256 is a207a106de68750929b99dea0e8f2b4c74f934508737362510ff3cac21a524b3. The 387 prior rows comprise
268 irrelevant, 44 mapped, 7 proposed and the 68 unresolved rows covered here.

Current evidence comprises 152 SourceObservations, 64 ProseObservations, 66 hypotheses, 90
foundational records and 26 proposals. Reviews were excluded. The machine-readable companion
[carried-clusters.yaml](carried-clusters.yaml) contains full row IDs, exact index recommendations,
per-duty prior/new wording, evidence references and the input-file digest census.

## Cluster table

| Cluster | Rows | Recommended outcome | One-line reason |
| --- | ---: | --- | --- |
| 1. Checkout and cache binding | 1 | irrelevant | The timestamped binding corpus and named run-3 proposal supersede C1's declaration. |
| 2. Grant/resource contention and proof-lock paths | 2 | unresolved | Admission histories are present; the actual resource/lock ownership join remains absent. |
| 3. Request and lease lifecycles, including the memory rider | 5 | unresolved | New boundaries and heartbeat snapshots leave causal/carrier continuity, separate CQs and the memory rider open. |
| 4. Failure-signature occurrence evidence | 3 | irrelevant | Re-identify the old field rows against a captured failure tuple; preserve the current signature-analysis gaps. |
| 5. Resolved cache plan applied to an execution | 1 | unresolved | The promoted rider has zero serialized resolver/execution occurrences. |
| 6. CQ-020 ordering and governing specification | 10 | irrelevant | Current proposals and emission-v2 observations replace the 10 amendment-gated rows; the cluster still rules together. |
| 7. Freshness, review score, attribution and proof-tier governance | 9 | unresolved | Recorded assessment values do not supply the four governing contracts and decision uses. |
| 8. Passed-step execution boundaries and elapsed scope | 2 | unresolved | Attempt bounds and component statuses are present; per-execution boundaries and measured-extent authority remain missing. |
| 9. Memory measurement semantics | 1 | unresolved | A release-attached peak still lacks process, sampling and measurement-family provenance. |
| 10. Duration individuals, carrier issuance and diagnostic comparison | 2 | unresolved | Duration assertions and recovery timings leave separate-individual CQs and issuance/custody unresolved. |
| 11. QA workflow and projection conformance evidence | 4 | unresolved | S7 replay evidence supplies neither a QA stage chain nor independently issued conformance artifacts. |
| 12. Workspace package continuity | 7 | unresolved | Checkout bindings do not establish identity across package rename, move, version, fork or recreation. |
| 13. Package topology and affected/docgen selection | 9 | unresolved | Admission ordering and stored applicability fields do not supply package-report or selection contracts. |
| 14. Admission capacity computation and pre-grant snapshot | 7 | unresolved | Token charges and later state do not supply the omitted capacity computation/stamp joins or snapshot CQ. |
| 15. Origin blocking and heartbeat suspicion | 5 | unresolved | Zero origin markers and eviction reports leave deployed threshold, authority and policy-use joins open. |

## Evidence limits governing the sitting

- Run-2 sitting 2 retired superseded observation IDs and wrappers while keeping C1/C2/C3 open.
  This docket applies that precedent without promoting evidence replacement into ratification.
- The checkout manifest has 107 bindings. The two organic manifests each describe 96 captured
  checkouts. Their capture populations and instants differ; they are not interchangeable censuses.
- Stage A records 1,902 structured failure tuples and zero cache-plan resolver occurrences.
  Stage B records 21 wins, 23 withdrawals, 5 lease evictions, 2 ticket evictions, 3 in-flight and
  112 pre-v3 chains. The canonical/session-tmp/system-tmp roots retain 347/2/0 admission rows.
  These are reported root/nonce histories, not unique failures, a closed fleet census or current state.
- Synthetic admission and attempt-termination records stay labeled synthetic. Join each event
  and time to its own nonce/attempt; do not combine the dead-lease start with another contender.
  Last heartbeat bounds an observation. Eviction and reconciliation times do not establish death time.
- Proof-lock files are excluded. Proof-ledger existence is zero in both fleet captures. Ruling 17
  therefore keeps the issuance/custody duties open to run 4.
- The original 13 scope-surprise families cover 26 unique prior rows before the two promotions.
  The promoted riders account for 4 rows: 3 failure rows retire by re-identification and the cache
  row stays open. Eleven remaining families account for 22 parked rows. A further memory duty
  remains on the mixed lifecycle row, counted only in cluster 3. The other 24 Ruling-6 rows retain
  their contract, identity, governance and new-CQ duties.
- Two historical ordering-contract quotations were superseded by emission v2. The unchanged
  target-correction quotation reappears as po:add8e23aa967.
  The ordering cluster still ratifies or parks together; the current specification identity and
  step representation choices remain explicit. The deferred-tail hypothesis also remains unresolved.

## Per-cluster detail

### 1. Checkout and cache binding (1)

Recommendation: irrelevant. The timestamped binding corpus and named run-3 proposal supersede C1's declaration.

Primary trace: `otp:bind-checkout-cache-binding:001`.

fleet-checkout-identity (1 row).

- `so:sha256:0d096342f5ba116307ca177adcbc3fc775b860ae0e5fd62dfd4d090d86c660a3`

Retirement reason: Retire the historical FleetCheckout declaration by supersession through otp:bind-checkout-cache-binding:001. Run 3 supplies the timestamped checkout/cache binding required by run-2 sitting 2 and narrowed by run-3 Ruling 5: 107 inventory bindings, with observed clone and linked-worktree examples that share Git administration but differ in local cache availability. Enduring identity across rename and CQ-015 proof-transfer authorization remain open in the current proposal; this retirement accepts neither.

Evidence:

- [so:a90c39610e4a](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-a90c39610e4a.yaml): Clone binding at scannedAt 2026-09-09T03:13:49.440Z, with later binding_probe_at 03:13:52.201Z: origin, branch/head and Git-directory context; local cache present at <fleet>/beep-effect/.turbo/cache with 36399 immediate entries.
- [so:f4532e29f3f1](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-f4532e29f3f1.yaml): Linked-worktree binding shares <fleet>/beep-effect/.git as git_common_dir but reports its distinct local cache path absent and zero entries. Its supplementary probe is at 03:13:52.406Z. This demonstrates why Git linkage alone cannot establish shared cache access.
- [MANIFEST.yaml](../../corpus/run3-checkout-identity/MANIFEST.yaml) (bindings, checkout_counts, cache_mounts, temporal_limit, n_instant_change_evidence): 107 bindings: 22 clones and 85 linked worktrees. Ruling 5 fixes capture-local binding identity; the capture is not an atomic machine freeze. Cache topology is necessary but insufficient for CQ-015 transfer; task hash, epoch and actual access remain separate requirements.
- `otp:bind-checkout-cache-binding:001`: otp:bind-checkout-cache-binding:001 proposes a temporally qualified binding-content record and explicitly preserves accessible-cache relator and situation alternatives, enduring path/checkout identity gaps, and the remaining CQ-015 prerequisites.

### 2. Grant/resource contention and proof-lock paths (2)

Recommendation: unresolved. Admission histories are present; the actual resource/lock ownership join remains absent.

grant-resource-contention-and-paths (2 rows).

- `so:sha256:b42503da37767cc741db6196fbf13e019bdc59f71166ad4d95318966ca7ae123`
- `po:sha256:5fa0d40013f2f1bace37c166a14058909069e91de0f63b823bd0921c40f68278`

New needed_evidence: Run 3 now captures root/nonce-scoped enqueue, admission, withdrawal, release and eviction reports, including synthetic attempt-termination joins. The run3-fleet and run3b-fleet manifests exclude lock files and proof-locks directories, and dh:att-overlap-diagnostic:001 still establishes only a logged overlapping path. To decide C2/C3, obtain the run-2 sitting-2 Ruling-3 join for the actual contended resource or proof-lock path: grant/lease and lock ownership identifiers, acquisition and release boundaries, and a waiting/winning/losing outcome in one provenance chain. Identify the rule linking FleetContestedPath to that contention and distinguish admission authorization from proof-lock ownership. Admission counts, a common origin key and worktree overlap cannot supply that missing relation.

Since: 2026-09-10.

Evidence:

- [so:0415a4f15905](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-0415a4f15905.yaml): Organic Stage A canonical-root history for nonce 411b3ba7-f32a-4d07-8a0c-c764dc5b8088: enqueue 1788926595182, admit 1788926595216, release 1788927008574, weightTokens=5, shared attemptId e7a8f546-8ae1-4754-b67b-76184b411fcc. The release carries memoryPeakBytes=9904820224. Only records for that nonce are joined; unrelated intervening records in source_excerpt are excluded.
- [so:27fc89410ea6](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-27fc89410ea6.yaml): Explicit provenance=synthetic. One nonce has enqueue/admit/release at 1788931586665, 1788931586674 and 1788931586743; another has enqueue/withdrawal at 1788931586705 and 1788931586715. synthetic-dead-lease is evicted at 1788931586728 with lastHeartbeatAtMillis=1788931586718; synthetic-dead-ticket is evicted at 1788931586729. The latter two have no retained starts in this journal. Event-specific timestamps stay with their own nonce.
- [so:650d8047f7ef](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-650d8047f7ef.yaml): Synthetic attempt-terminated notice for attemptId b4e72342-45a5-4a1b-95db-5ab4ef30a93f matches the dead-lease eviction; reason=lease-eviction and recordedAt=2026-09-09T05:26:26.737Z. recordedAt is notice/reconciliation time, not observed execution cessation.
- [so:68c2cc4f0ebf](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-68c2cc4f0ebf.yaml): Synthetic attempt-terminated notice for attemptId a2fdba81-945f-4f44-8d93-6f71f706d5cd matches the dead-ticket eviction; reason=queued-submitter-death and recordedAt=2026-09-09T05:26:26.731Z.
- [MANIFEST.yaml](../../corpus/run3b-fleet/MANIFEST.yaml) (loss_population.chain_counts, loss_population.roots, loss_population.heartbeat_check, loss_population.classification_basis): Organic retained chains: 21 wins, 23 withdrawals, 5 lease evictions, 2 ticket evictions, 3 in-flight and 112 pre-v3; 0 unclassified. Canonical root has 347 rows; session-tmp has 2; system-tmp has 0. Heartbeat check covers 4 rows, records 1 legacy row without heartbeat and 0 violations. These are root/nonce histories within retained windows, not a complete fleet or liveness census.
- [MANIFEST.yaml](../../corpus/run3-fleet/MANIFEST.yaml) (excluded_sources): The explicit exclusions include lock files and proof-locks directories. run3b-fleet/MANIFEST.yaml retains the same exclusions; lock ownership cannot be reconstructed from this capture by equating it with admission authorization.
- [so:34a817e0c13c](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-34a817e0c13c.yaml): The selected observed fact is overlappingPaths=explorations/ATLAS.md. Its attempt-journal context is not a grant-to-resource ownership or causal contention relation.
- [dh:att-overlap-diagnostic:001](../hypotheses/dh-att-overlap-diagnostic-001.yaml): The implementation-only null remains. The hypothesis requires an observed overlap-to-scope, invalidation or blocking rule; co-located behind-count and terminal failure do not establish causation.

### 3. Request and lease lifecycles, including the memory rider (5)

Recommendation: unresolved. New boundaries and heartbeat snapshots leave causal/carrier continuity, separate CQs and the memory rider open.

jv-admission-lifecycle with memory rider (1 row).

- `so:sha256:c627961a8fcde9dca01027cbf052494763b5e6895805c1c0c50d8bf51ba3a7bb`

New needed_evidence: Run 3 supplies an organic same-root/nonce enqueue-admit-release history, plus synthetic withdrawal and eviction reports with two attempt-termination joins. The pure lifecycle duty still needs authoritative causal continuity from one request's submission through grant and release/cancellation, and a Must/Should CQ requiring a lifecycle distinct from its request, grant and boundary reports. The memory rider remains independently parked under Ruling 6: the release now carries memoryPeakBytes, but the resource-using occurrence/process boundary, sampling method and interval, metric/unit, measurement provenance and its relationship to peakRssKb are still missing. Different capture-scoped ownerRef values and an administrative termination notice cannot decide either missing identity.

Since: 2026-09-10.

jv-admission-lifecycle (1 row).

- `so:sha256:d94bf0420d3457158959e6188c50d5949dc4fae4a48d07e7077f8c81df36fcb6`

New needed_evidence: Run 3 now provides a same-root/nonce organic enqueue-admit-release chain and explicit synthetic withdrawal, grant-eviction and ticket-eviction boundaries. Synthetic attempt-terminated records match the two eviction attemptIds. What remains is authoritative causal-continuity evidence connecting one submitted request to its grant and release/cancellation, together with a Must/Should decision CQ requiring that composite lifecycle separately from SeatRequest, SeatGrant and their boundary reports. The terminal-only synthetic eviction chains lack their own retained starts, and recordedAt is a reconciliation time rather than proof of actual execution cessation.

Since: 2026-09-10.

pa-admission-lease-lifecycle (3 rows).

- `po:sha256:3aadb9c8ae061d71b2e8386d9b8af518d49df5a66abaa0bb0391783833a6eef4`
- `po:sha256:51fa8a9b8fcef0856134c3599ef68eabe588532203230c5b0ac8c892da47c95a`
- `po:sha256:56d67898f9daaa0ff3c1fb34ff05745d9a1f94cf2703726f7721d1f586f89e5f`

New needed_evidence: Run 3 adds two live lease snapshots with the same nonce, grant instant and charge but different heartbeat instants, organic release/eviction reports, and explicitly synthetic eviction-to-attempt-termination joins. It still lacks one provenance chain that binds a grant's creation, complete heartbeat-rewrite history, release/eviction, actual ledger decrement and carrier lineage. Capture-scoped ownerRef values cannot prove cross-capture owner continuity; a terminal lastHeartbeatAtMillis is not a rewrite history, and the synthetic evicted lease has no retained admission start. A Must/Should CQ must also require this lifecycle separately from SeatGrant. Keep both the provenance and separate-warrant duties open.

Since: 2026-09-10.

Evidence:

- [so:0415a4f15905](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-0415a4f15905.yaml): Organic Stage A canonical-root history for nonce 411b3ba7-f32a-4d07-8a0c-c764dc5b8088: enqueue 1788926595182, admit 1788926595216, release 1788927008574, weightTokens=5, shared attemptId e7a8f546-8ae1-4754-b67b-76184b411fcc. The release carries memoryPeakBytes=9904820224. Only records for that nonce are joined; unrelated intervening records in source_excerpt are excluded.
- [so:27fc89410ea6](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-27fc89410ea6.yaml): Explicit provenance=synthetic. One nonce has enqueue/admit/release at 1788931586665, 1788931586674 and 1788931586743; another has enqueue/withdrawal at 1788931586705 and 1788931586715. synthetic-dead-lease is evicted at 1788931586728 with lastHeartbeatAtMillis=1788931586718; synthetic-dead-ticket is evicted at 1788931586729. The latter two have no retained starts in this journal. Event-specific timestamps stay with their own nonce.
- [so:650d8047f7ef](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-650d8047f7ef.yaml): Synthetic attempt-terminated notice for attemptId b4e72342-45a5-4a1b-95db-5ab4ef30a93f matches the dead-lease eviction; reason=lease-eviction and recordedAt=2026-09-09T05:26:26.737Z. recordedAt is notice/reconciliation time, not observed execution cessation.
- [so:68c2cc4f0ebf](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-68c2cc4f0ebf.yaml): Synthetic attempt-terminated notice for attemptId a2fdba81-945f-4f44-8d93-6f71f706d5cd matches the dead-ticket eviction; reason=queued-submitter-death and recordedAt=2026-09-09T05:26:26.731Z.
- [MANIFEST.yaml](../../corpus/run3b-synthetic/MANIFEST.yaml) (provenance, termination_join, loss_population.chain_counts): Synthetic provenance is explicit. Both termination_join entries have attemptId_match=true. Retained chains are one win, one withdrawal, one lease eviction and one ticket eviction; they are not organic fleet outcomes.
- [so:afd98d3ec307](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-afd98d3ec307.yaml): Stage A live canonical lease: nonce 012163b8-ef66-4fb4-aba5-0d4af4072512, admittedAtMillis=1788941816511, weightTokens=5, heartbeatAtMillis=1788941946764. This is one capture of a lease carrier, not its complete rewrite or decrement history.
- [so:430e175a6bdb](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-430e175a6bdb.yaml): Stage B live canonical lease preserves the same nonce, grant instant and charge but reports heartbeatAtMillis=1788942001857. The capture-scoped ownerRef differs; comparing the snapshots does not establish uninterrupted owner/carrier continuity.
- [fa:adm-admission:001](../foundational/fa-adm-admission-001.yaml): The foundational analysis separates conferral, grant holding and journal assertion, and retains information-only and grant-boundary rivals. Its evidence reading identifies a joined enqueue/admit/release history and a second history lacking a terminal report. This does not supply a separately warranted composite lifecycle.

### 4. Failure-signature occurrence evidence (3)

Recommendation: irrelevant. Re-identify the old field rows against a captured failure tuple; preserve the current signature-analysis gaps.

Primary trace: [so:sha256:05bdfd88fe028976d02147ad0bfa51ad66828d2ceae653806a6a947e8374aeda](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-05bdfd88fe02.yaml).

pa-failure-signature (3 rows).

- `po:sha256:2d69bdb38dd2c7618a64b60834a6993abe999b6776d721aef8b6eb947c9b2e91`
- `po:sha256:4ce41ce65957b0594e01c672972fb68722ee30c3df62444b2d323fe6d70e07cf`
- `po:sha256:4ec767a335e920a2a80204127a6c3146cded1e5eb3d748b11a87dfc4579fc735`

Retirement reason: Retire the three prior literal/field rows by re-identification as the run-3 observation so:sha256:05bdfd88fe028976d02147ad0bfa51ad66828d2ceae653806a6a947e8374aeda. It binds an attemptId to failureKind=step-exit, failedStepId=publish:01-git-push and that component's failed result under yeet-verdict/v2. The manifest records 1902 structured tuple occurrences and pins the component vocabulary/serialization sources. Rat-032 already accepted FailureSignature at recorded-classification grain; this is an occurrence-evidence replacement, not another signature ratification. Cross-attempt semantic compatibility, normalization, delay attribution and full execution joins remain explicit in dh:ver-failure-signature:001. Do not infer those from tuple equality or treat every tuple as a completed execution.

Evidence:

- [so:05bdfd88fe02](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-05bdfd88fe02.yaml): One yeet-verdict/v2 record has attemptId=12f8afbd-2a3e-493a-becc-8f1cdb58cd47, failedStepId=publish:01-git-push, failureKind=step-exit and the matching component id with status=failed, exitCode=1, durationMs=935.026968. Parent attempt startedAt=2026-08-06T09:13:49.279Z, endedAt=2026-08-06T09:27:58.609Z and elapsedMs=849330. Passed components have durations but no per-component start/end instants.
- [so:18fe73166f5b](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-18fe73166f5b.yaml): A separate identified yeet-verdict/v2 attempt records failureKind=handler-error and failedStepId=publish:00-head-install-preflight while planned components are status=not-run. The parent attempt has 11ms elapsed time. A tuple or planned component therefore cannot be assumed to identify a completed component execution.
- [MANIFEST.yaml](../../corpus/run3-fleet/MANIFEST.yaml) (rider_evidence.pa-failure-signature): rider_evidence=present; structured_occurrences=1902. These are retained tuple occurrences across verdict and embedded-verdict sources, not a count of unique failures or signatures. The optional attemptId must be checked per record.
- [MANIFEST.yaml](../../corpus/run3-fleet/MANIFEST.yaml) (source_facts.verdict_schema, source_facts.failure_signature_domain, source_facts.failure_signature_serialization, source_facts.failed_step_serialization): The manifest cites yeet-verdict/v2 and the step-exit/handler-error domain, plus failureKind and failedStepId serialization, to Verdict.ts source bytes c05da661e2bb3c60bfbdc071b6e1eac0b25406a5b3ff693c158ffdd0569388d7. These bound source meanings do not establish vocabulary compatibility for all historical tuples.
- [rat-032.yaml](../../../archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-032.yaml): rat:32 accepts otp:jv-failure-signature:001 at failedStepId/failureKind recorded-classification grain, explicitly separating signature from occurrence. The archived proposal retains the governed-coordinate meaning/version caveat.
- [dh:ver-failure-signature:001](../hypotheses/dh-ver-failure-signature-001.yaml): The current candidate remains unresolved with the null unrejected: different failed steps share failureKind, and the same failedStepId occurs under different failure kinds. Normalization/identity, same-versus-different examples and attributed-delay/consumer joins remain required. Retiring the old field observations does not discharge this current chain.

### 5. Resolved cache plan applied to an execution (1)

Recommendation: unresolved. The promoted rider has zero serialized resolver/execution occurrences.

pa-cache-plan-resolution (1 row).

- `po:sha256:30be9d42308395a759ea42b1706c47b14bf2d995ff5d90eb85161cef24e27b61`

New needed_evidence: Run 3's verdict-corpus search is now complete within its captured fields: run3-fleet/MANIFEST.yaml reports pa-cache-plan-resolution rider_evidence=absent with zero structured occurrences. Its source_facts name the resolver domain and the resolver-to-command-arguments site, but the verdict schema has no cache-plan field. Obtain an observed governed resolver result with its applicable domain/version, joined to a particular Turbo execution and the cache posture actually applied. Checkout cache topology, cacheStatus and enablement flags do not supply that execution join. This promoted Ruling-6 rider remains open; the docket authorizes no new capture or runtime change.

Since: 2026-09-10.

Evidence:

- [MANIFEST.yaml](../../corpus/run3-fleet/MANIFEST.yaml) (rider_evidence.pa-cache-plan-resolution): rider_evidence=absent; structured_occurrences=0; occurrences is empty. The bounded search explicitly distinguishes a resolver/execution join from cacheStatus or cache flags.
- [MANIFEST.yaml](../../corpus/run3-fleet/MANIFEST.yaml) (source_facts.cache_plan_domain, source_facts.cache_plan_execution): Source receipts identify caller-controlled/local-only/remote-read and the resolver result feeding command arguments. They explicitly record that the verdict schema has no cache-plan field; source routing does not create a captured execution result.
- [so:f4532e29f3f1](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-f4532e29f3f1.yaml): Linked-worktree binding shares <fleet>/beep-effect/.git as git_common_dir but reports its distinct local cache path absent and zero entries. Its supplementary probe is at 03:13:52.406Z. This demonstrates why Git linkage alone cannot establish shared cache access.

### 6. CQ-020 ordering and governing specification (10)

Recommendation: irrelevant. Current proposals and emission-v2 observations replace the 10 amendment-gated rows; the cluster still rules together.

Primary trace: [otp:ov-schedule-proposal:001](../proposals/otp-ov-schedule-proposal-001.yaml).

sitting-3 hasStep (2 rows).

- `po:sha256:736ad92a1de7991caa17d905c310e2dac02d5a4d9b7cd3b709adfcabd690e4cc`
- `po:sha256:35a69c5bcbf7493cc0aa7f248d138d65f2d5c8beff49e80308ef85b43a0f559d`

Retirement reason: Retire the two historical hasStep rows by supersession through otp:ov-proposal-step-membership:001. The current emitter and fixture identify two steps belonging to one proposal, while the contract limits steps to admitted actions and amended CQ-020 requires that membership. The two original contract quotations were superseded by emission v2, so their old observation IDs are preserved only as carried retirements. ScheduleStep identity and the complete cluster's joint ratify-or-park obligation remain with the current proposals.

Row trace: [otp:ov-proposal-step-membership:001](../proposals/otp-ov-proposal-step-membership-001.yaml).

sitting-3 stepIndex (2 rows).

- `po:sha256:14e01baa9a4fa23873722680039d098e43c3e0f315d5f6805159154577794e06`
- `po:sha256:959a603a7bc88415101c1c6e9073034271081d03a55dd625f763898feb579ea2`

Retirement reason: Retire the two historical stepIndex rows by supersession through otp:ov-step-position:001. Current fixture observations assert integer ordinals 0 and 1, the current contract fixes the zero-based admitted-step convention, and amended CQ-020 orders SeatRequests through those steps. The proposal carries the prior category/representation choice; fixture integers do not adjudicate it. No endpoint or ordering member ratifies independently of the complete cluster.

Row trace: [otp:ov-step-position:001](../proposals/otp-ov-step-position-001.yaml).

pa-projection-contract (1 row).

- `po:sha256:0121af7b661484de9197ede12df6eaa5c69240214339b7ea6844a4f09901fea8`

Retirement reason: Retire the prior pa-projection-contract observation by supersession through otp:ov-projection-specification:001. CQ-020 now requires the governing specification and emitted SeatRequest ordering; the current typed-specification, proposal-binding and ordering observations replace the run-2 wording obstacle. The rule-specification versus application-context identity choice stays explicit in fa:ov-projection-specification:001 and the current proposal. The full ordering dependency cluster still ratifies or parks together.

Row trace: [otp:ov-projection-specification:001](../proposals/otp-ov-projection-specification-001.yaml).

pb-schedule-projection-specification (2 rows).

- `po:sha256:6fa9ae087c8d411c0218a0491a20989f722773cb08d8b57d733514a58cc86742`
- `po:sha256:88f09e0224cf8cc48710903fe1e017b9369bc5dada8def6024d42f2841f9a654`

Retirement reason: Retire the two pb-schedule-projection-specification rows by supersession through otp:ov-projection-specification:001. The amended CQ-020 and current emission-v2 specification type, governing edge and SeatRequest-order facts discharge the former wording obstacle. The current foundational record explicitly defers repeatable-rule versus application-context identity, and the proposal carries that choice for the same ordering sitting. Retirement does not accept either model or split the cluster.

Row trace: [otp:ov-projection-specification:001](../proposals/otp-ov-projection-specification-001.yaml).

pc-projection-contract (2 rows).

- `po:sha256:d9e1c6941fe61eb8e8a4f7e40853d6090190ec18523931c3af4551bb2b880c76`
- `po:sha256:ed86c2d18b12ff797604eac97a917b36527e390ce417fce35ac583fd829b2709`

Retirement reason: Retire the two pc-projection-contract rows by supersession through otp:ov-projection-specification:001. Amended CQ-020 now requires the governing specification and the emitted SeatRequest ordering represented in the current contract and fixture observations. The repeatable-specification versus application-context issue survives in the run-3 foundational chain and proposal; the ordering cluster remains one ratify-or-park unit.

Row trace: [otp:ov-projection-specification:001](../proposals/otp-ov-projection-specification-001.yaml).

ov-schedules-seat-request (1 row).

- `po:sha256:d1f555913267743bc009bfd030c3bafd841e6f7baa081d7a1ecc0704fc2b2d2d`

Retirement reason: Retire the historical target-relation row by supersession through otp:ov-step-request-assignment:001 and re-identification of its unchanged implementation-report quotation as po:sha256:add8e23aa967029a87b088fab73de1335b0aa8348c184b34bcd7a821e783a8e4. Current fixture/emitter observations bind steps to SeatRequests, and amended CQ-020 explicitly consumes that relation. The current chain preserves the absence of WorkUnitSpecification identity; the full ordering cluster still ratifies or parks together.

Row trace: [otp:ov-step-request-assignment:001](../proposals/otp-ov-step-request-assignment-001.yaml).

Evidence:

- [CQ-020](../../../../../docs/competency-questions.yaml): The Must CQ now joins an episode's current proposal to its governing typed specification, member steps, zero-based order values, SeatRequest targets and literal scope tags, with ORDER BY ?idx. Its amendment removes the run-2 WorkUnit-target wording obstacle; reading this query is not an execution or ratification claim.
- [po:4b06f5efe076](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/prose-observations/po-4b06f5efe076.yaml): Emission-v2 fixture asserts proposal hasStep step-0.
- [po:a1e5e0d0916d](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/prose-observations/po-a1e5e0d0916d.yaml): The same fixture proposal asserts hasStep step-1.
- [po:25344c6969c1](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/prose-observations/po-25344c6969c1.yaml): Fixture step-0 has stepIndex 0 typed as xsd:integer.
- [po:56dab857ecc5](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/prose-observations/po-56dab857ecc5.yaml): Fixture step-1 has stepIndex 1 typed as xsd:integer.
- [po:0a705ee8990d](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/prose-observations/po-0a705ee8990d.yaml): Current S7 determinism rule fixes canonical order, zero-based stepIndex and steps only for admitted actions; the deferred tail neither extends nor renumbers the sequence. Its Graph.topo statement concerns the projection seam, not a package-report contract.
- [po:d7595abca114](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/prose-observations/po-d7595abca114.yaml): The emission-v2 fixture types its governing target as ciops-prov:AdmissionProjectionSpecification.
- [po:95a467e6ebaa](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/prose-observations/po-95a467e6ebaa.yaml): The emission-v2 fixture connects the proposal to that target with hasProjectionSpecification.
- [po:7f9eb7c183ed](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/prose-observations/po-7f9eb7c183ed.yaml): Fixture step-0 schedulesSeatRequest request-0; the emitter and matching second-step observation preserve request targeting.
- [po:add8e23aa967](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/prose-observations/po-add8e23aa967.yaml): The unchanged S7 implementation-report quotation is re-emitted at the run-3 pin. It records the SeatRequest/WorkUnitSpecification split and the absence of work-unit-specification identity in journal evidence.
- [fa:ov-projection-specification:001](../foundational/fa-ov-projection-specification-001.yaml): explicitly_deferred: compare emissions with fixed rules/different journal prefixes and revised rules/fixed input to distinguish repeatable specification identity from application-context identity. otp:ov-projection-specification:001 carries that choice.
- [otp:ov-step-position:001](../proposals/otp-ov-step-position-001.yaml): The current proposal treats stepIndex as a contextual ordinal-value property, preserving its alternative representation models and ScheduleStep/ScheduleProposal dependencies. Zero-based fixture values do not settle the prior category issue.

### 7. Freshness, review score, attribution and proof-tier governance (9)

Recommendation: unresolved. Recorded assessment values do not supply the four governing contracts and decision uses.

jv-base-freshness (3 rows).

- `so:sha256:0a7f99ebe45f22164f484b539becf4d1d57384861db25b0c065fc67cca2574a7`
- `so:sha256:a4fa5b4f6b8142d813d5867e01c92a245a9a7ee7d64b8841a3e27a068c88e764`
- `so:sha256:c1e2fd7731b1efe855f70c75df8e7dd0bd99853668c551eca8fb80593a621d06`

New needed_evidence: Run 3 adds verdict comparison values and timestamped checkout branch/head bindings; dh:ver-git-comparison-context:001 still has no observed validity decision consuming those comparisons. Under Ruling 6, obtain a versioned branch-freshness contract binding each assessment to its branch and base operands, defining merge-base, behind-count and overlap meanings, and showing assessment provenance, recomputation and the decision that changes with the result. A recorded zero or a matching path is insufficient to establish equal trees or evidence validity.

Since: 2026-09-10.

jv-greptile-score (2 rows).

- `so:sha256:12f0a017acb17063246f77ebb5c128271f9df67ea7bc1666268052f2d58873d1`
- `so:sha256:258d88bf5d120ca46af4e7964a5c3a5674c5c4984b67c0f84fe8f706e979c3f6`

New needed_evidence: Run 3 now records greptileScore=5/5 in a verdict with proofTier=full, but a score spelling does not supply its governed meaning. Under Ruling 6, obtain the scale authority and version, the exact reviewed subject, score-production and revision provenance, and an observed assurance or closeout decision governed by that score. Retain the distinction between a stored readiness assertion and a current eligibility decision.

Since: 2026-09-10.

pb-failure-attribution-category (1 row).

- `po:sha256:a0460c0e2b60f310cb30b9c03ea0aa2e487e02aadaa0450c56bb04cff6b5c8c9`

New needed_evidence: Run 3 adds classified failure tuples and component results, which supply concrete reports but not introduced/inherited/unrelated/environment attribution rules. Under Ruling 6, obtain necessary conditions for every attribution member, overlap or precedence rules, and an assessment record binding the change, baseline, environment, assessment provenance and revision history. failureKind and failedStepId classify a report; they cannot by themselves assign responsibility or baseline causation.

Since: 2026-09-10.

pb-yeet-proof-tier (3 rows).

- `po:sha256:8b0e7ebacbadd3d0a21df787d0070763c9151c438e5ad68ef69454c6bea0aca1`
- `po:sha256:8d123d2b803018949aa079849fafabb4d38fbde7e7f77a5515d448cdc0a9f195`
- `po:sha256:922212cafdb03daef5fb111352d661cfda30e1e9f3d3e8c3e6f45a19c6a82a50`

New needed_evidence: Run 3 adds proofTier=full in verdict and lease/request contexts, while result status and attained assurance remain separate. Under Ruling 6, obtain planner authority and version/revision lineage deciding a shared selector scheme versus copied domains or plan-borne classifications, together with a Must/Should CQ whose decision consumes that selector. Repeated strings and the captured priority domain cannot establish the proof-tier governance or its mapping to assurance tiers.

Since: 2026-09-10.

Evidence:

- [so:05bdfd88fe02](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-05bdfd88fe02.yaml): One yeet-verdict/v2 record has attemptId=12f8afbd-2a3e-493a-becc-8f1cdb58cd47, failedStepId=publish:01-git-push, failureKind=step-exit and the matching component id with status=failed, exitCode=1, durationMs=935.026968. Parent attempt startedAt=2026-08-06T09:13:49.279Z, endedAt=2026-08-06T09:27:58.609Z and elapsedMs=849330. Passed components have durations but no per-component start/end instants.
- [so:ebe4cdcf6e9e](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-ebe4cdcf6e9e.yaml): The verdict projection includes greptileScore=5/5, proofTier=full and durationMs=435.282685. These are stored report values; they do not provide scale-governance or selector-lineage contracts.
- [dh:ver-git-comparison-context:001](../hypotheses/dh-ver-git-comparison-context-001.yaml): The current null analysis still lacks explicit comparison-operand binding and an observed validity decision dependent on the recorded behind-count, merge-base or overlap result.
- [dh:ver-head-diff-tier-context:001](../hypotheses/dh-ver-head-diff-tier-context-001.yaml): resolvedHeadSha, diffFingerprint and proofTier remain descriptive context without an observed accept/reject consumer or task-hash/epoch applicability rule.
- [DECISIONS.md](../../../../../../DECISIONS.md) (2026-09-03 run-3 corpora design grill, Rulings 6-7): Thirteen scope-surprise families were parked, with failure-signature and cache-plan riders promoted. Other new-CQ/contract duties remain parked; passed-step instrumentation and new TS observations are outside run-3 scope.

### 8. Passed-step execution boundaries and elapsed scope (2)

Recommendation: unresolved. Attempt bounds and component statuses are present; per-execution boundaries and measured-extent authority remain missing.

jv-verification-step-execution (1 row).

- `so:sha256:3a8b51a1acc8602b1a583147d6d5e7e253481237fbf5806c9b13833698bc9090`

New needed_evidence: Run 3 now has verdicts with a parent attemptId, passed component statuses and component durations, and a separate failed attempt whose planned components are explicitly not-run. Under Ruling 6, obtain a passed-step execution record preserving the authoritative parent-attempt join, each repeated execution's identity and its own actual start/end boundaries. Whole-attempt bounds and a repeated lane label do not supply the missing component occurrence boundaries; the passed-step instrumentation was excluded from the v3 scope.

Since: 2026-09-10.

pa-elapsed-ms-field (1 row).

- `po:sha256:2092736911a0c68e96ae8d9638b00ec4b6992b4da0677f325e4fd420fb41b2a7`

New needed_evidence: Run 3 now supplies an identified attempt with startedAt, endedAt and elapsedMs, so the missing-record part of the run-2 request has changed. Under Ruling 6, retain the measured-extent question: establish authoritatively whether each value covers the entire attempt/command or a particular WorkUnit occurrence, preserving target, interval and provenance. fa:ver-wall-time-evidence:001 still asks for nested occurrence bindings, clock/precision conventions and the explanation of a one-millisecond discrepancy. Parent-attempt timestamps cannot be copied to each nested execution, and an assertion-content proposal does not settle what was measured.

Since: 2026-09-10.

Evidence:

- [so:05bdfd88fe02](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-05bdfd88fe02.yaml): One yeet-verdict/v2 record has attemptId=12f8afbd-2a3e-493a-becc-8f1cdb58cd47, failedStepId=publish:01-git-push, failureKind=step-exit and the matching component id with status=failed, exitCode=1, durationMs=935.026968. Parent attempt startedAt=2026-08-06T09:13:49.279Z, endedAt=2026-08-06T09:27:58.609Z and elapsedMs=849330. Passed components have durations but no per-component start/end instants.
- [so:18fe73166f5b](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-18fe73166f5b.yaml): A separate identified yeet-verdict/v2 attempt records failureKind=handler-error and failedStepId=publish:00-head-install-preflight while planned components are status=not-run. The parent attempt has 11ms elapsed time. A tuple or planned component therefore cannot be assumed to identify a completed component execution.
- [fa:ver-wall-time-evidence:001](../foundational/fa-ver-wall-time-evidence-001.yaml): The analysis still requires nested attempt/lane/interval associations, clock and precision rules, and repeated measurement/correction evidence. Its proposal otp:ver-wall-time-evidence:001 preserves assertion-content, quality, measurement-token and scoped-literal alternatives, plus estimate and episode-join gaps.
- [DECISIONS.md](../../../../../../DECISIONS.md) (2026-09-03 run-3 corpora design grill, Rulings 6-7): Thirteen scope-surprise families were parked, with failure-signature and cache-plan riders promoted. Other new-CQ/contract duties remain parked; passed-step instrumentation and new TS observations are outside run-3 scope.

### 9. Memory measurement semantics (1)

Recommendation: unresolved. A release-attached peak still lacks process, sampling and measurement-family provenance.

jv-memory-peak-measurement (1 row).

- `so:sha256:78cf821b0771a1c60ef1f80746484a8da1df72bcf2b1eaa9ebed337144e5a245`

New needed_evidence: Run 3 now joins memoryPeakBytes=9904820224 to a particular admission release report through its root and nonce. Under Ruling 6, obtain the measurement's resource-using occurrence and process boundary, sampling method and interval, metric, unit and measurement provenance. Supply an authoritative comparison with peakRssKb that decides whether the two fields measure one family. A release-attached quantity, token charge or owner surrogate does not establish the measured process or sampling semantics.

Since: 2026-09-10.

Evidence:

- [so:0415a4f15905](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-0415a4f15905.yaml): Organic Stage A canonical-root history for nonce 411b3ba7-f32a-4d07-8a0c-c764dc5b8088: enqueue 1788926595182, admit 1788926595216, release 1788927008574, weightTokens=5, shared attemptId e7a8f546-8ae1-4754-b67b-76184b411fcc. The release carries memoryPeakBytes=9904820224. Only records for that nonce are joined; unrelated intervening records in source_excerpt are excluded.
- [DECISIONS.md](../../../../../../DECISIONS.md) (2026-09-03 run-3 corpora design grill, Rulings 6-7): Thirteen scope-surprise families were parked, with failure-signature and cache-plan riders promoted. Other new-CQ/contract duties remain parked; passed-step instrumentation and new TS observations are outside run-3 scope.

### 10. Duration individuals, carrier issuance and diagnostic comparison (2)

Recommendation: unresolved. Duration assertions and recovery timings leave separate-individual CQs and issuance/custody unresolved.

jv-actual-wall-duration (1 row).

- `so:sha256:2a207d4986630e8590f790457dabe07ffeecdb9b2bfa79cf254c6bce508a2998`

New needed_evidence: Run 3 adds attempt-scoped elapsedMs, nested durationMs and otp:ver-wall-time-evidence:001, whose assertion-content, quality, token and scoped-literal models remain alternatives. Under Ruling 6, the separate RecordedWallDurationMeasurement still needs a Must/Should executable CQ that must traverse that individual instead of qualified values on an episode or execution. The carrier alternative also needs authoritative issuance, custody, copy and correction lineage and a decision CQ that distinguishes equal-content carrier tokens. Ruling 17 keeps the issuance duty open to run 4: the fleet manifests observe zero proof ledgers, so captured verdicts cannot replace the missing writer-issued provenance.

Since: 2026-09-10.

jv-actual-wall-duration and jv-lane-diagnostic-comparison (1 row).

- `so:sha256:91988c625516a3fa1516b592a7dc4c6b197b56249390fde1fc1e116867ae1af3`

New needed_evidence: Run 3 adds bounded attempt durations and a recovery diagnostic with distinct standaloneDurationMs and laneRerunDurationMs inside a successful attempt. Under Ruling 6, retain both duration concessions: a Must/Should CQ requiring a RecordedWallDurationMeasurement individual rather than qualified episode/execution values, and an authoritative issuance/custody/copy/correction chain plus a CQ distinguishing carrier tokens from equal content. The comparison concession additionally needs identities for both compared executions, their measurement assertions, the comparison's issuance, and a Must/Should decision CQ consuming a distinct comparison record. Ruling 17 keeps issuance open to run 4 because zero proof ledgers were captured. Diagnostic timing alone supplies neither the paired execution identities nor a separately warranted comparison.

Since: 2026-09-10.

Evidence:

- [so:05bdfd88fe02](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-05bdfd88fe02.yaml): One yeet-verdict/v2 record has attemptId=12f8afbd-2a3e-493a-becc-8f1cdb58cd47, failedStepId=publish:01-git-push, failureKind=step-exit and the matching component id with status=failed, exitCode=1, durationMs=935.026968. Parent attempt startedAt=2026-08-06T09:13:49.279Z, endedAt=2026-08-06T09:27:58.609Z and elapsedMs=849330. Passed components have durations but no per-component start/end instants.
- [so:37968f126c46](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-37968f126c46.yaml): The recovery diagnostic records detectedAt=2026-08-08T11:43:52.465Z, standaloneDurationMs=1902.713545 and laneRerunDurationMs=29802.864398. dh:att-recovery-diagnostic:001 identifies a successful enclosing publish verdict and leaves attribution and compound-account necessity open.
- [fa:ver-wall-time-evidence:001](../foundational/fa-ver-wall-time-evidence-001.yaml): The analysis still requires nested attempt/lane/interval associations, clock and precision rules, and repeated measurement/correction evidence. Its proposal otp:ver-wall-time-evidence:001 preserves assertion-content, quality, measurement-token and scoped-literal alternatives, plus estimate and episode-join gaps.
- [MANIFEST.yaml](../../corpus/run3b-fleet/MANIFEST.yaml) (proof_ledger): status=re-parked to run 4; ruling=17; checkouts_with_ledger=0. The cited time-to-certainty PLAN C2 says the service is not wired into a lane. This is a file-existence census; no proof-ledger contents were read or emitted. Stage A also records zero ledgers.
- [DECISIONS.md](../../../../../../DECISIONS.md) (2026-09-08 Stage B capture grill, Ruling 17): Proof-ledger issuance duties re-park to run 4 until the time-to-certainty writer materializes provenance. Synthetic ledger seeding was rejected; narrower attempt/embedded-verdict joins may proceed.

### 11. QA workflow and projection conformance evidence (4)

Recommendation: unresolved. S7 replay evidence supplies neither a QA stage chain nor independently issued conformance artifacts.

pa-qa-evidence-workflow (1 row).

- `po:sha256:3bf3cf7f37f4e3e046efb12751c4b9650dd3a2a16a0c99a1ec17563fa551048a`

New needed_evidence: Run 3 adds an admission projection fixture, property-suite contract and S7 replay result. Those are not a record/extract/judge QA run. Under Ruling 6, obtain one provenance-bearing chain joining all three QA stages to the in-scope Yeet or CI lane, its frozen tree and cache epoch, and the assurance obligation that consumes the evidence. The captured replay's input digest and pass assertion do not supply those QA-stage or assurance joins.

Since: 2026-09-10.

pa-projection-conformance-evidence (3 rows).

- `po:sha256:059c20e6b0972ff269acf52884fea9e75f4fc5144fac7728dbac333221866181`
- `po:sha256:06dd8aab73f74fd680b9cf55a760da82d4a3420f91fc8ea9d8bdb27c4c000d57`
- `po:sha256:2338c92205c5fc08e5e18d149e7aabca98b83589cf5984e6b83fa81b2401a98c`

New needed_evidence: Run 3 adds emission-v2 contract and property-suite quotations and the bounded S7 differential replay report of 41 matched admissions, but no independently issued conformance package. Under Ruling 6, obtain all three remaining chains: a package manifest with independent authority/version joining suite, implementation build, frozen inputs, replay execution, complete results, limitations, issuance and custody; a separately governed/versioned suite specification, distinct from its test-file carrier, and its Must/Should CQ; and identified replay execution/environment plus result issuance, custody, retention/correction lineage and a Must/Should CQ for a separate replay-result artifact. Ruling 17's zero-ledger census leaves issuance open to run 4; the passing replay assertion is not that missing lineage.

Since: 2026-09-10.

Evidence:

- [po:a8408e04e6bb](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/prose-observations/po-a8408e04e6bb.yaml): The S7 property-suite quotation states determinism, admissibility, totality, priority/aging and differential replay obligations; it does not assert independent package/suite/result issuance or custody.
- [po:a3b740b147b8](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/prose-observations/po-a3b740b147b8.yaml): The S7 report asserts that all 41 admitted events matched the projection's first prescribed admission. This is a bounded replay assertion, not proof of production correctness or an independently issued conformance package.
- [po:f41f8934b51e](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/prose-observations/po-f41f8934b51e.yaml): The S7 replay report pins a journal digest and 79 events, comprising 41 admitted and 38 released. It does not establish all lifecycle boundaries or a QA record/extract/judge chain.
- [dh:ov-replay-comparison-result:001](../hypotheses/dh-ov-replay-comparison-result-001.yaml): The null remains unrejected pending a concrete decision consuming the comparison record or a demonstrated necessary dependency under an existing CQ.
- [MANIFEST.yaml](../../corpus/run3b-fleet/MANIFEST.yaml) (proof_ledger): status=re-parked to run 4; ruling=17; checkouts_with_ledger=0. The cited time-to-certainty PLAN C2 says the service is not wired into a lane. This is a file-existence census; no proof-ledger contents were read or emitted. Stage A also records zero ledgers.
- [DECISIONS.md](../../../../../../DECISIONS.md) (2026-09-03 run-3 corpora design grill, Rulings 6-7): Thirteen scope-surprise families were parked, with failure-signature and cache-plan riders promoted. Other new-CQ/contract duties remain parked; passed-step instrumentation and new TS observations are outside run-3 scope.
- [DECISIONS.md](../../../../../../DECISIONS.md) (2026-09-08 Stage B capture grill, Ruling 17): Proof-ledger issuance duties re-park to run 4 until the time-to-certainty writer materializes provenance. Synthetic ledger seeding was rejected; narrower attempt/embedded-verdict joins may proceed.

### 12. Workspace package continuity (7)

Recommendation: unresolved. Checkout bindings do not establish identity across package rename, move, version, fork or recreation.

pa-workspace-package (7 rows).

- `po:sha256:08a398bab03363136254e3e9c3ed49ebb16ffd18fb94b434111d4446cdf50d69`
- `po:sha256:1189ec1eca4fb79695201186157334124e71372bbe906bb6119996f42b9fe842`
- `po:sha256:13b29fc0bebcac4b0914db214f136add0fa739ac50af65649c800b7013ccb67a`
- `po:sha256:1c941c2e1e41a932dfd00e48631a9dd6217c6e51fe9c681369139a8c0402ea84`
- `po:sha256:28e700021c9b4ba707087650a4e39ceed6540863e4d99b02af241b2b0fdbcaf8`
- `po:sha256:2f816bb5f468d1cc4a06de84c4a9bb8e4c9393a070c41e364f53d951cbf172e1`
- `po:sha256:51a827390306ccb0cf37e23d646c653fd4291f3ed346ae04e097e678a5097781`

New needed_evidence: Run 3 now has 107 checkout bindings with origin, branch/head, Git-directory and cache facts, plus fleet attempt context. These identify checkout observations, not package continuity. Under Ruling 6, obtain an authoritative package-identity policy and observed lineage deciding rename, move, version change, fork and delete/recreate cases, including whether the candidate is a role or immutable-content object. No new package identity policy was admitted with the binding corpus, and a checkout token or package spelling cannot settle those cases.

Since: 2026-09-10.

Evidence:

- [MANIFEST.yaml](../../corpus/run3-checkout-identity/MANIFEST.yaml) (bindings, checkout_counts, cache_mounts, temporal_limit, n_instant_change_evidence): 107 bindings: 22 clones and 85 linked worktrees. Ruling 5 fixes capture-local binding identity; the capture is not an atomic machine freeze. Cache topology is necessary but insufficient for CQ-015 transfer; task hash, epoch and actual access remain separate requirements.
- [so:a90c39610e4a](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-a90c39610e4a.yaml): Clone binding at scannedAt 2026-09-09T03:13:49.440Z, with later binding_probe_at 03:13:52.201Z: origin, branch/head and Git-directory context; local cache present at <fleet>/beep-effect/.turbo/cache with 36399 immediate entries.
- [DECISIONS.md](../../../../../../DECISIONS.md) (2026-09-03 run-3 corpora design grill, Rulings 6-7): Thirteen scope-surprise families were parked, with failure-signature and cache-plan riders promoted. Other new-CQ/contract duties remain parked; passed-step instrumentation and new TS observations are outside run-3 scope.

### 13. Package topology and affected/docgen selection (9)

Recommendation: unresolved. Admission ordering and stored applicability fields do not supply package-report or selection contracts.

pb-topological-package-report (6 rows).

- `po:sha256:5a59d414027abf00522737e1d86c7976c6837e7dcf88eb47112cc39709b2be1d`
- `po:sha256:62ae30cfc28b391c7bf4a87534abeba849a8ca2ebd5f8ebe72cb5af81dcc50eb`
- `po:sha256:64463ef1e1f2b77cb50713f8194bb055d35d02288f465e6902e337f9fc5f5edf`
- `po:sha256:6e598d379ffd2f0565176b337833e4eedf0293941fa87936078ee572e63748a9`
- `po:sha256:89165acdfec28c3a8692c411aead416ca1fd5f13333c0ea5c748e92aeab0cb98`
- `po:sha256:90fa083c4887641658c0239762b509fd6c9bacc6f14cf29ee392ce08714572ff`

New needed_evidence: Run 3 adds checkout bindings and an admission-order fixture whose step positions are 0 and 1; those positions do not describe a package graph. Under Ruling 6, obtain the package-report contract defining its numeric positions, ordering algorithm and dependency-edge semantics, identify the producing graph/version, and show the operational verification decision consuming that report. No new TS or package-graph observation was admitted with the journal/inventory capture.

Since: 2026-09-10.

pb-docgen-affected-scope (1 row).

- `po:sha256:795d76d79fdc3ad235d204aee98c96f70dcdb10704c927558f31012749553995`

New needed_evidence: Run 3 adds checkout branch/head snapshots and verdict applicability fields; it supplies no docgen selection result with a dirty-tree pin. Under Ruling 6, retain both concessions: an observed selection artifact binding base, head, dirty snapshot and selected members, a contract choosing selected extension versus selection rule and a Must/Should specialization CQ; and an independently versioned selection-rule authority, an observed pinned extension showing its application, a rule-versus-result contract and a CQ requiring the specification. Checkout paths and stored diff fingerprints do not supply those selected members or governance.

Since: 2026-09-10.

pb-affected-task-input-mode (2 rows).

- `po:sha256:9cbd50f3655b7ae7102a1be9bfcfe939528b3eaebd0dc33257408365f9402062`
- `po:sha256:a1f8202d5ff295e75dd7ad3f50f9454dad4bc2d53677e5936a6a0812250c5e43`

New needed_evidence: Run 3 adds stored diff/head/tier context and a deterministic admission-order contract, but neither is a governed affected-task selection run. Under Ruling 6, obtain the normative selection contract explaining how task inputs alter membership and whether failures open or close the selection, an observed selected set under that contract, and the operational verification decision that trusts it. The current applicability hypotheses still lack an observed accept/reject consumer.

Since: 2026-09-10.

Evidence:

- [po:0a705ee8990d](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/prose-observations/po-0a705ee8990d.yaml): Current S7 determinism rule fixes canonical order, zero-based stepIndex and steps only for admitted actions; the deferred tail neither extends nor renumbers the sequence. Its Graph.topo statement concerns the projection seam, not a package-report contract.
- [MANIFEST.yaml](../../corpus/run3-checkout-identity/MANIFEST.yaml) (bindings, checkout_counts, cache_mounts, temporal_limit, n_instant_change_evidence): 107 bindings: 22 clones and 85 linked worktrees. Ruling 5 fixes capture-local binding identity; the capture is not an atomic machine freeze. Cache topology is necessary but insufficient for CQ-015 transfer; task hash, epoch and actual access remain separate requirements.
- [dh:ver-head-diff-tier-context:001](../hypotheses/dh-ver-head-diff-tier-context-001.yaml): resolvedHeadSha, diffFingerprint and proofTier remain descriptive context without an observed accept/reject consumer or task-hash/epoch applicability rule.
- [DECISIONS.md](../../../../../../DECISIONS.md) (2026-09-03 run-3 corpora design grill, Rulings 6-7): Thirteen scope-surprise families were parked, with failure-signature and cache-plan riders promoted. Other new-CQ/contract duties remain parked; passed-step instrumentation and new TS observations are outside run-3 scope.

### 14. Admission capacity computation and pre-grant snapshot (7)

Recommendation: unresolved. Token charges and later state do not supply the omitted capacity computation/stamp joins or snapshot CQ.

pa-admission-capacity-expression (2 rows).

- `po:sha256:3c757a7975b27b8597ccf8c6d886eb72ad2b8b51aaba8eb59cf21cc9a1a7a3c6`
- `po:sha256:518aee86882c8b9092469203add3bc23c72acfed1d7139f136a96e8763f0c8c7`

New needed_evidence: Run 3 now records requested/granted weightTokens and quotes the projection inequality activeTokenTotal + weightTokens <= capacityMaxTokens. Ruling 9 deliberately omitted capacity stamps. Under Ruling 6, obtain the authoritative capacity computation defining unit conversion, reserve subtraction and hard-floor treatment, and a provenance-preserving join from its computed value to capacityAtAdmissionTokens on an observed admission decision. A policy token charge and reconstructed ledger total cannot stand for measured remaining capacity.

Since: 2026-09-10.

pb-admission-capacity-state (5 rows).

- `po:sha256:6b31f817391e66aab8fc9796fed0c0bbdbd8285c9e86438e9172d1ce6bbaef61`
- `po:sha256:8a555d65d66a8d7f44336fdb4ce8816f5a033a6ce448e311dc29615bfd8f41f2`
- `po:sha256:8af3333c97798f24aeecfa40f40faefcf152f96fffb6717f647eabf0f5250a92`
- `po:sha256:95037a7104c1dbd21fc02aeeeb45733f744c10ba07ea4c5db2a94db62d88e95a`
- `po:sha256:95b57e4f4029739dacb78d5caa9b43939b1820fc17d3785a9ff32181d7d0e0b6`

New needed_evidence: Run 3 now includes timestamped inventory and queue/lease reports, but Ruling 9 supplied no pre-grant capacity stamps. Under Ruling 6, obtain a Must/Should executable CQ that traverses an AdmissionSnapshot, its capture act and instant, machine and policy scope, and an authoritative correlation to the immediately pre-grant decision that materializes capacityAtAdmissionTokens. A later lease snapshot, a checkout inventory instant and the projection's capacity inequality do not establish that missing pre-grant state.

Since: 2026-09-10.

Evidence:

- [so:afd98d3ec307](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-afd98d3ec307.yaml): Stage A live canonical lease: nonce 012163b8-ef66-4fb4-aba5-0d4af4072512, admittedAtMillis=1788941816511, weightTokens=5, heartbeatAtMillis=1788941946764. This is one capture of a lease carrier, not its complete rewrite or decrement history.
- [so:430e175a6bdb](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-430e175a6bdb.yaml): Stage B live canonical lease preserves the same nonce, grant instant and charge but reports heartbeatAtMillis=1788942001857. The capture-scoped ownerRef differs; comparing the snapshots does not establish uninterrupted owner/carrier continuity.
- [po:a8c7221f4f29](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/prose-observations/po-a8c7221f4f29.yaml): The S7 contract quotes activeTokenTotal + weightTokens <= capacityMaxTokens and priority/aging constraints. This governs the projection; it does not supply a machine capacity computation, pre-grant stamp or operational starvation observation.
- [DECISIONS.md](../../../../../../DECISIONS.md) (2026-09-03 run-3 corpora design grill, Ruling 9): The additive v3 event set omits capacity stamps because that family remains parked under Ruling 6.
- [DECISIONS.md](../../../../../../DECISIONS.md) (2026-09-03 run-3 corpora design grill, Rulings 6-7): Thirteen scope-surprise families were parked, with failure-signature and cache-plan riders promoted. Other new-CQ/contract duties remain parked; passed-step instrumentation and new TS observations are outside run-3 scope.

### 15. Origin blocking and heartbeat suspicion (5)

Recommendation: unresolved. Zero origin markers and eviction reports leave deployed threshold, authority and policy-use joins open.

pb-origin-block-grace-window (1 row).

- `po:sha256:79df3741e52f870a9c5d7ac0f3c76fc333a1341bf8f15c7a7720f2b6982e88b3`

New needed_evidence: Run 3 now captures a ticket's blockedOnOriginAtMillis=0 and separately records queue, withdrawal and eviction boundaries. dh:att-origin-block-marker:001 leaves the zero's meaning unresolved. Under Ruling 6, obtain the deployed threshold rule, its unit and both true/false consequences, decide grace versus staleness versus retry semantics, and observe a specifically origin-blocked case governed by that rule. A terminal eviction or zero marker does not establish a grace-window application.

Since: 2026-09-10.

pc-heartbeat-suspicion-policy (2 rows).

- `po:sha256:cb78d031658bfe80535beb490352c2086b2b8f629e3819df4fba336fbeb37598`
- `po:sha256:cb9064130b643be08d25e627bcfc5264739ac1397a236d353835b473c2df5734`

New needed_evidence: Run 3 adds live heartbeat observations and explicit lease eviction reports with lastHeartbeatAtMillis, plus a synthetic termination join. The Stage B heartbeat census checks four organic rows, reports one legacy row without heartbeat and finds no ordering violations; this bounds observations, not owner death. Under Ruling 6, obtain the deployed suspicion threshold and unit, the identified suspected holder, an observed stale-heartbeat case, its operational consequence, and the authority rule separating suspicion from permission to terminate. An eviction reason or last-seen heartbeat is not proof that suspicion alone authorized termination.

Since: 2026-09-10.

pc-origin-blocked-timestamp (2 rows).

- `po:sha256:e362227f9f3d78e8fcb933ddf9f5523b1ef97776a2546ad12c7f702c33fc1cdd`
- `po:sha256:edf38d10efe0552b7de770a0cc24a9596cc4b5141b693889e987465f4174b4bb`

New needed_evidence: Run 3 now supplies a persisted ticket observation containing blockedOnOriginAtMillis=0 with enqueue and heartbeat context, and the current null analysis refuses to read zero as either an epoch instant or evidence of no contention. Under Ruling 6, obtain a semantically interpreted origin-block onset/time and unit, the same ticket's observed originBusy wait, the starvation-policy decision using it, and issuance/revision provenance across the relevant ticket transitions. The observed zero and unrelated terminal chains do not establish those joins.

Since: 2026-09-10.

Evidence:

- [so:3579a1da6705](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-3579a1da6705.yaml): The selected observed fact is blockedOnOriginAtMillis=0; source_excerpt preserves its ticket, enqueue and heartbeat context. The zero does not decide onset, duration or absence of origin contention.
- [dh:att-origin-block-marker:001](../hypotheses/dh-att-origin-block-marker-001.yaml): The implementation-only null remains because the observed zero lacks an interpreting rule or a nonzero boundary transition.
- [so:27fc89410ea6](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-27fc89410ea6.yaml): Explicit provenance=synthetic. One nonce has enqueue/admit/release at 1788931586665, 1788931586674 and 1788931586743; another has enqueue/withdrawal at 1788931586705 and 1788931586715. synthetic-dead-lease is evicted at 1788931586728 with lastHeartbeatAtMillis=1788931586718; synthetic-dead-ticket is evicted at 1788931586729. The latter two have no retained starts in this journal. Event-specific timestamps stay with their own nonce.
- [MANIFEST.yaml](../../corpus/run3b-fleet/MANIFEST.yaml) (loss_population.chain_counts, loss_population.roots, loss_population.heartbeat_check, loss_population.classification_basis): Organic retained chains: 21 wins, 23 withdrawals, 5 lease evictions, 2 ticket evictions, 3 in-flight and 112 pre-v3; 0 unclassified. Canonical root has 347 rows; session-tmp has 2; system-tmp has 0. Heartbeat check covers 4 rows, records 1 legacy row without heartbeat and 0 violations. These are root/nonce histories within retained windows, not a complete fleet or liveness census.
- [so:afd98d3ec307](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-afd98d3ec307.yaml): Stage A live canonical lease: nonce 012163b8-ef66-4fb4-aba5-0d4af4072512, admittedAtMillis=1788941816511, weightTokens=5, heartbeatAtMillis=1788941946764. This is one capture of a lease carrier, not its complete rewrite or decrement history.
- [so:430e175a6bdb](../../../archives/beep-ci-ops/orun-2026-09-10T02:10:52Z.observations/observations/so-430e175a6bdb.yaml): Stage B live canonical lease preserves the same nonce, grant instant and charge but reports heartbeatAtMillis=1788942001857. The capture-scoped ownerRef differs; comparing the snapshots does not establish uninterrupted owner/carrier continuity.
- [DECISIONS.md](../../../../../../DECISIONS.md) (2026-09-03 run-3 corpora design grill, Rulings 6-7): Thirteen scope-surprise families were parked, with failure-signature and cache-plan riders promoted. Other new-CQ/contract duties remain parked; passed-step instrumentation and new TS observations are outside run-3 scope.

## Totals by recommended outcome

| Recommended outcome | Rows |
| --- | ---: |
| irrelevant | 14 |
| mapped | 0 |
| proposed | 0 |
| unresolved | 54 |
| Total | 68 |

Queue cross-check: C(i) contributes 4 retirements and 8 parks; C(ii) contributes 10 retirements;
C(iii) contributes 46 parks; C(iv) is empty. All 68 IDs agree exactly with Queue C and the
committed prior index. Every one of the 33 prior needed_evidence variants has a run-3 fact,
a specific remaining evidence requirement, or both. Unmatched prior rows: none.

The two remaining run-2 sitting-2 contention rows stay open, with explicit lock/resource joins.
C1 retires through the timestamped binding proposal. The three failure retirements preserve
current signature-analysis gaps, and all 10 ordering retirements preserve the joint sitting.

This is a docket consistency result. The orchestration lane must project the steward-approved
recommendations into work/dispositions.index.yaml; this lane has not changed that index.
A full run gate and its unresolved-fraction calculation belong to the completed run artifacts.
