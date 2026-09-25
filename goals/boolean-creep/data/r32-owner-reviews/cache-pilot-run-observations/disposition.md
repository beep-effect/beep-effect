# CachePilotRun observation audit — R32 disposition

Disposition: **disqualified / D1**, no P2 design warranted for the proposed three-field cluster. Frozen source HEAD: `f97a89bdfdc5bc71b69aab09b8d425591698d42a`. This is a bounded source audit, not independent P3 or implementation credit.

## Why the raw proposal fails

`Cache.pilot.schemas.ts:162-177` exports a class with three independent Boolean fields: native runtime-key observation, requested cache enablement, and source-tree equality observation. The schema has no cross-field filter, transformation, default, or literal restriction for these fields. `index.ts:108-119` publicly re-exports it. The complete exported schema permits all eight Boolean projections with otherwise valid payloads. This is a static source conclusion, not a claim that all eight are produced by today's runner.

The raw row cites `Cache.pilot.ts:765-767`: changed before/after source snapshots fail the effect before construction. This proves only that this producer returns no run when its tree integrity check fails. A fixed-true field in returned values is not an ordered flag relationship such as finished implies started. Neither cacheEnabled nor nativeRuntimeKeyObserved is the predecessor or successor of sourceTreeUnchanged. There is no E4 state machine flattened into these three bits.

No E1 exclusive write occurs: `Cache.pilot.ts:805-817` records independently obtained values. No E2 exclusive read chooses one flag instead of the others. No E3 flag/payload presence duplication is established for this cluster. A proposal to model four successful-producer combinations as a literal would add no demonstrated domain compression and could erase legitimate observation input values at the exported receipt boundary.

## Complete owner and boundary audit

- Declaration and payload: `Cache.pilot.schemas.ts:162-177`. Preserve id, root, graphExitCode, outcome, dependencies and summarySha256. Outcome is already a distinct Executed/Blocked tagged schema (`:131-148`); it is not evidence that the three proposed Boolean fields form one phase variable.
- Sole corpus construction: `Cache.pilot.ts:805-817`, inside execute (`:720-818`). `cacheEnabled` comes from the enabled input. `nativeRuntimeKeyObserved` is computed from selected native task metadata. `sourceTreeUnchanged` compares before/after snapshots and is rejected if false at `:765-767`.
- Preparation and metadata checks: `:699-719` configures cache mode and verifies the requested runtime key unless the deliberate missing-child control applies. `:768-803` handles selected-task absence or execution. These explain producer subsets, not a general prohibition across the three exported Boolean fields. The separate log-input validator (`Cache.pilot.capture.ts:35-36`) checks disabled cache against local-hit origin, not a phase implication among this cluster.
- Execute call sites: `Cache.pilot.ts:838,849,850,869,879,975,983,992,1022,1023,1084,1198,1199`. These cover initial fresh runs, activation/replay, concurrent and alternate-root runs, shadow comparisons, source-failure repetitions, and mutation controls. The missing-child fixture is selected at `:1092`; no independent audit of another owner is claimed.
- Direct read: `Cache.pilot.ts:824-832` compare requires both runs' sourceTreeUnchanged observations alongside executed outcomes, successful graph exits, and equal logs/hashes. Both source-tree flags are ANDed; this is not E2 exclusivity. Deleting this observation check after an unsupported type narrowing would hide the contract change.
- Typed downstream uses: `Cache.pilot.ts:914-918` equivalentShadowReplay and `:1047-1061` validMutationReplay delegate comparisons and inspect outcome/task metadata. `PilotRoot` borrows only the root field schema (`:104`). No corpus reader of nativeRuntimeKeyObserved or cacheEnabled establishes an implication to a sibling flag.
- Collection and receipt: runs are accumulated at `:819` and returned in CachePilotReceipt.make (`:1347-1381`, runs at `:1365`). The exported receipt nests `S.Array(CachePilotRun)` at `Cache.pilot.schemas.ts:314` and keeps schemaVersion cache-pilot-local/v5. No receipt-level cross-field check narrows this cluster.
- CLI persistence: `Cache.command.ts:795-809` obtains the run receipt and writes `JsonStringCodec(CachePilotReceipt)` at `:802`, then checks aggregate assertions. Constructor domain and encoded observation field names/values are material compatibility surfaces.
- Known test codec consumers: `test/cache-pilot-orchestration.test.ts:62-66` defines direct and JSON receipt codecs; `:543-545` JSON-round-trips a receipt; `:561-565` encodes/decodes and accepts historical absence of unrelated runtimeLinker. Tests are read as boundary evidence only, not census sources or new tests run.
- Historical documentation: `goals/turborepo-task-qualification/research/runtime-key-verification.md:43-55` explains the intentional missing-child runtime-key observation. This supports independent observed metadata; it does not impose a new sourceTreeUnchanged contract on public construction or decoding.

## Finite proof and compatibility

`finite-table.json` enumerates all eight combinations, distinguishes exported-schema admissibility from producer-guard exclusions, and deliberately does not claim the four unchanged-tree rows are all reachable. The raw 8/4 cardinality confuses these two domains. No authoritatively supported strict legal subset has been established for the public three-field cluster.

Keep all three encoded property names and values and all eight currently admitted projections. No codec or source modification is proposed. A future rule excluding changed-tree observation inputs must be ratified as an owner-contract change and separately assessed; it would not retroactively turn the current fixed-success check into E4 evidence.

Guard-deletion accounting: **none justified**. The source-tree snapshot integrity check must remain even if the stored field were narrowed in some other task: a type cannot prove filesystem immutability. The compare checks continue to serve the exported observation shape. The campaign rider says a design deleting nothing is suspect; here that is another reason not to invent P2 work.

## Scope and evidence limits

Graft queries preceded source investigation; supplementary live-source and barrel searches covered packages/apps and known test/boundary references. Source file hashes and frozen-head equality are in `audit.json`. The local Effect reference SCHEMA.md primitive and Class/filter sections were checked; no advanced Schema API or new design was needed. No runtime pilot, repository tests, implementation, canonical inventory/design edit, git mutation, or independent P3 was performed. The raw R32 row remains untouched. R32 completion/dryness must be adjudicated by its controller.
