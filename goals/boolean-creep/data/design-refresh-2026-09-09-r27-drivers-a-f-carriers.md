# Round 27 driver A–F carrier eligibility adjudication

Source HEAD: `8f266b878445ca8a7f751f9248da428a4dde39a1`.
Corpus main: `663904610cce2a38c06b0619a8c414646b69361c`.
Scope: the 42 canonical inventory rows whose source file is under one of the
16 `r27-drivers-a-f` areas in
`data/sweeps/refresh-2026-09-09-r27-main-663904/lane-map.json`.

This is a source eligibility handoff, not another census or a P3 review.
The successful empty Grok report and its original execution receipt remain
unchanged. Its seed-drift footnote correctly identifies callable seeds, but
mixing a Boolean with a real optional, nullable, or finite-literal member is
not itself a defect. No product source, test, design, canonical inventory,
dependency, lockfile, status, or git state was changed by this audit.

## Proposed disposition

Of the 42 rows, retain all three qualified rows and 25 disqualified rows;
withdraw 14 rows from the live projection, preserving their prior JSON records
in the parent's withdrawal archive. The 14 are nine callable-only rows, four
rows inventing an axis from a required string, and one anonymous constructor
parameter carrier. No new qualified record is established here.

Among the retained census rows, reclassify `drivers-cosmos-graph-config` from
D1 to D2 because its named schema directly supplies an external SDK config.
That produces seven retained D1 rows and 18 retained D2 rows. Correct the two
ACP protocol objects' `kind` from `type-literal` to `object-literal`.

Eligibility precedes D1/D2. A D2 label does not rescue an anonymous function
parameter or manufacture a second axis from a required string. Conversely,
`Option<number>` is not a required number, `Option<boolean>` is not a two-value
Boolean, and `NullOr(String)` is not a required non-null string. No zero/nonzero,
empty/nonempty, string-equality, or other invented projection is counted here.

## Qualified records: retain, with no new design finding

### `cosmos-backend-selection-webgl2`

Retain `members: [webGl2, backend]`, E1, `4 -> 2`, `derived`, internal, Tier 1,
and the existing design. The declared carrier is the class at
`packages/drivers/cosmos/src/Cosmos.backend.ts:105`; the actual fields are
`backend: CosmosBackend` at `:107` and `webGl2: S.Boolean` at `:108`.
`CosmosBackend` has exactly `cosmos | sigma`, declared with LiteralKit at
`packages/drivers/cosmos/src/Cosmos.backend.ts:32`.

The explicit selector at `packages/drivers/cosmos/src/Cosmos.backend.ts:170`
constructs `(true, cosmos)` or `(false, sigma)` at `:172-174`. These are the
two legal combinations; the two mismatches are redundant representational
states. `packages/drivers/cosmos/test/CosmosProjection.test.ts:73-77` exercises
both selectors. The renderer consumes the literal at
`packages/drivers/cosmos/src/Cosmos.renderer.ts:692-698`. The required `reason`
string is independently copied and is not an additional presence axis.

The qualified row is not a callable record merely because its writer is a
function. It describes an actual named data carrier. No withdrawal, status
advance, cardinality change, or redesign is proposed.

### `r3-drivers-arch-folder-resolution-blocked-provider`

Retain `members: [blocked, providerId]`, E1/E2, `4 -> 3`, stored, internal,
Tier 1, and the existing design. The private named type is declared at
`packages/drivers/box-provisioning/src/BoxProvisioningPlanner.ts:58`; `blocked`
is a Boolean at `:60`, and `providerId` is an actual `O.Option<BoxProviderId>`
at `:61`. This is not an anonymous function-parameter bag.

The root constructor at
`packages/drivers/box-provisioning/src/BoxProvisioningPlanner.ts:475-479`
writes `(false, Some(root))`. The unresolved constructor at `:481-485` writes
`(true, None)`. A folder without an observed match produces a Create at
`:199-213`; resolution at `:520-529` writes `(false, None)` for that case.
Only a Noop retains a provider at `:520`; a parent blocked at `:498` produces
a Blocked action, so the resolution write cannot produce `(true, Some(id))`.

Consumers are consistent with these three cases. `dependentAction` checks the
blocked state at
`packages/drivers/box-provisioning/src/BoxProvisioningPlanner.ts:132-148`;
parent matching uses the provider Option at `:487-495`; capability planning
uses `folder.blocked` at `:380-402`. The Option payload remains in the
qualified cluster; reducing it to “only one Boolean” would discard E3/E4-style
payload eligibility. No new design finding is established.

### `duckdb-transaction-began-closed`

Retain `members: [began, closed]`, E4, `4 -> 3`, stored, internal, Tier 1, and
its existing record/design status. These are actual sibling mutable Boolean
values at `packages/drivers/duckdb/src/DuckDb.service.ts:374-375`, inside a
per-execution `Effect.suspend`, not parameters or callable guards.

Both begin false. BEGIN succeeds before `began = true` at
`packages/drivers/duckdb/src/DuckDb.service.ts:383-384`. COMMIT writes `closed`
at `:387-388`; the failure rollback path writes it at `:392-394`. Thus
`closed => began`; `(false, true)` is unreachable under these writers. The
cleanup conjunction at `:376-379` directly consumes the flattened open phase.
Preserve the existing `Effect.ignore` rollback semantics and interruption
boundaries. This handoff does not claim a new independent review or authorize
an implementation change.

## Withdraw the nine callable-only D1 rows

For every row below, remove the row from the live inventory after archiving
its exact prior record. Do not relabel the row D1, invent a Boolean value
carrier around an inline call, or redesign the underlying predicate.

| Canonical id | Declaration and consumer proof |
| --- | --- |
| `r3-drivers-arch-codex-home-entry-classifiers` | `packages/drivers/ai-provider-cli/src/AiProviderCliHome.service.ts:79-80` assigns two `S.is(...)` functions. The filter invokes them at `:377`; there are no sibling Boolean observations named by the row. |
| `r3-drivers-arch-codex-home-symlink-heuristics` | `packages/drivers/ai-provider-cli/src/AiProviderCliHome.service.ts:82-88` declares two predicate functions. `isNotSymlinkFailure` invokes `isEinvalCause`, and the former is passed to `Match.when` at `:204`. |
| `r3-drivers-arch-cosmos-label-geometry` | `packages/drivers/cosmos/src/Cosmos.renderer.ts:130-141` declares `labelRectsOverlap` and `labelFits` functions; the latter invokes the former negatively. Placement invokes `labelFits` at `:239`. The old note's “combined-true is the healthy placement case” is also inaccurate for overlap with an occupied rectangle, but the primary defect is callable eligibility. |
| `r3-drivers-arch-anthropic-repair-stream-part-kind` | `packages/drivers/anthropic/src/Anthropic.repair.ts:230-236` declares two type-guard functions. `A.filter` receives one at `:276`, and `A.findLast` receives the other at `:280`. `collectToolParamsJsonWithUsage.partKind` is an invented inventory carrier name. |
| `r3-drivers-arch-cosmos-module-probes` | `packages/drivers/cosmos/src/Cosmos.renderer.ts:329-336` declares three type guards. Separate `Effect.filterOrFail` calls use them at `:342`, `:349`, and `:355`; no stored Boolean cluster exists. |
| `r3-drivers-arch-box-applier-blocker-predicates` | `packages/drivers/box-provisioning/src/BoxProvisioningApplier.ts:530-531` declares two tagged-union predicates. `isEntitlementReason` is invoked at `:557`; `isBlockedAction` is passed to `A.filter` at `:600`. |
| `r3-drivers-arch-drizzle-error-context-probes` | `packages/drivers/drizzle/src/Drizzle.errors.ts:176-179` declares two functions with different inputs. `hasQueryContext` is composed into `A.findFirst` at `:229`; `hasSeenReference` is invoked at `:249`. |
| `r3-drivers-arch-box-error-shape-probes` | `packages/drivers/box/src/Box.errors.ts:484` declares `isFiniteNumber`, passed to `O.filter` at `:489`. `isBoxSdkShapeError` is the predicate returned by `P.isTagged` at `:527`, invoked at `:529`. |
| `r25-drivers-a-f-box-applier-destructive-blocked` | `packages/drivers/box-provisioning/src/BoxProvisioningApplier.ts:527-530` declares a plan-array predicate and an action type guard. The former is invoked at `:738`, the latter passed to filters at `:600` and `:647-648`. Neither named member is a Boolean value. |

## Withdraw four required-string axes and one parameter carrier

| Canonical id | Exact disposition and source proof |
| --- | --- |
| `cosmos-capability-probe-webgl2` | Withdraw out of net. `packages/drivers/cosmos/src/Cosmos.backend.ts:77-78` declares one Boolean plus required `S.String`. Both success and failure constructors supply a reason at `:202-218`. Required-string presence is constant and no named Boolean reason classifier exists. Preserve the raw capability probe and the separate qualified selection row. |
| `r25-drivers-a-f-cosmos-backend-selection-reason` | Withdraw out of net. `packages/drivers/cosmos/src/Cosmos.backend.ts:108-109` declares Boolean plus required String; the selector always copies reason at `:174`. Do not merge this spurious pair into the surviving `[webGl2, backend]` member set. |
| `r25-drivers-a-f-firecrawl-api-failure` | Withdraw out of net. `packages/drivers/firecrawl/src/Firecrawl.errors.ts:232-234` declares required `error: S.String` and `success: S.Literal(false)`. There is neither a free success bit nor an optional error-presence member. The SDK origin does not supply the missing carrier axis. Preserve the failure schema and other optional diagnostics. |
| `r25-drivers-a-f-firecrawl-failure-fields` | Withdraw out of net. `packages/drivers/firecrawl/src/Firecrawl.models.ts:2056-2062` declares the same required error and fixed false success. Operation failures reuse this bag, for example at `:2120`; reuse does not create a second axis in the recorded `[success, error]` pair. |
| `cosmos-gl-graph-constructor-config` | Withdraw under the anonymous function-parameter exclusion. `packages/drivers/cosmos/src/vendor.d.ts:9-22` declares an anonymous object type for the constructor's `config` parameter. The class `Graph` is real, but the row's members are not class fields or a separately named config type. The actual named `CosmosGraphConfig` at `packages/drivers/cosmos/src/Cosmos.renderer.ts:20` remains eligible. |

These removals are metadata withdrawals, not claims that the source values
should be removed, narrowed, or redesigned.

## Retain the real Option, nullable, and literal domains

`r26-drivers-a-f-queue-status-shape` remains D2. The footnote's description of
`mostRecentSuccess` as simply “string” is incomplete:
`packages/drivers/firecrawl/src/internal/Firecrawl.responses.ts:412` declares
`S.NullOr(S.String)`. With `success: S.Boolean` at `:413`, that is a real
Boolean/nullable-payload pair. The envelope is tied to the imported external
`QueueStatusResponse` at `:30` and `:542-546`; the driver calls
`client.getQueueStatus()` at
`packages/drivers/firecrawl/src/Firecrawl.service.ts:630-633`. Retain the
existing member list. The required queue counters at response `:409-411` and
`:414` do not create additional empty/nonempty or zero/nonzero members.

The three retry rows also remain in net and D1. The declarations are
`packages/drivers/firecrawl/src/Firecrawl.errors.ts:266-294` and `:311-321`.
The Option helpers at `:26-27` give decoded retryability the full domain
`None | Some(false) | Some(true)`; delay is `None | Some(nonnegative integer)`.
The input uses optional Boolean and optional finite number at `:286-287`.
Thus each recorded pair has six structural combinations, not four, before
counting payload values. `FirecrawlError.fromReason` is a supported explicit
constructor at `:342-357`: it independently normalizes retryability and delay
at `:353-354`, retaining a valid delay for false, true, or absent retryability.
The numeric filter removes invalid delay values; it never conditions the
delay on retryability. This is executable constructor evidence of independence,
not an inference solely from an unconstrained schema.

`r25-drivers-a-f-box-entitlements-paid-seats` remains an eligible D1 row.
`packages/drivers/box-provisioning/src/BoxProvisioningIntent.ts:396-397`
declares a Boolean and an actual Option quota. The documented Business input
at `:378-384` includes `(true, Some(100))`; the documented desired state at
`:737-745`, also in
`packages/drivers/box-provisioning/src/BoxProvisioningReceipt.ts:222-230`,
uses `(true, None)`. The paid-seat fact therefore does not duplicate allowance
presence. These are operator-asserted commercial facts (`Intent.ts:399-401`),
and the canonical desired-state constructor preserves them together through
the spread at
`packages/drivers/box-provisioning/src/internal/canonical.ts:73-85`. No
current source read derives either member from the other. The examples do
not themselves prove a catalog of every false-seat subscription; do not
claim such a catalog or manufacture a phase implication from its absence.

`r25-drivers-a-f-box-action-base-destructive-provider` also stays in net:
`ActionBaseInput` is a real named type at
`packages/drivers/box-provisioning/src/BoxProvisioningPlanner.ts:64-75`, even
though a function later consumes it. Its Boolean/Option pair is declared at
`:69` and `:72`. Current writers demonstrate `(false, None)` for Create at
`:201-211`, and `(false, Some(id))` for Noop at `:243-253`; update/noop
webhooks also carry an id at `:362-366`. `actionBase` forwards destructive
and provider independently at `:98` and `:101-104`. No E1–E4 correlation
between these two fields is established. Retain D1 with the bounded note
below: the present private writer set is non-destructive, so it would be
incorrect to cite these writers as proof that all four Boolean/presence
combinations currently occur or to invent a destructive lifecycle design.

`r2-drivers-arch-box-post-apply-verdict` remains the existing fixed-proof D1
census row. Both recorded members are real Boolean literals at
`packages/drivers/box-provisioning/src/BoxProvisioningReceipt.ts:463-464`.
Their domains are `{true} x {true}`, so the carrier already has one legal and
one representable combination. Runtime checks at
`packages/drivers/box-provisioning/src/BoxProvisioningApplier.ts:660-664`
precede the explicit all-true verdict constructor at `:666-670`. Do not
inflate this to four representable states or confuse it with the one-member
fixed-success/required-error pairs withdrawn above.

## Complete retained census disposition

Every id below remains `status: disqualified`. D2 means the cited carrier
mirrors the external contract; it does not assert that all cross-product
states are legal externally. In particular, the current SDK guards alone
do not prove “combined-true is a legal SDK payload.”

| Canonical id | Class and source/consumer rationale |
| --- | --- |
| `drivers-acp-protocol-logging-options` | Retain D1. Named schema at `packages/drivers/acp/src/AcpProtocol.service.ts:280-292`; the two optional Booleans retain absent/false/true separately. Incoming and outgoing logging are independently selected at `:499-505`, so enabling either does not disable or require the other. |
| `drivers-cosmos-graph-config` | Change D1 to D2. Named schema at `packages/drivers/cosmos/src/Cosmos.renderer.ts:20-43`; dynamically imported graph SDK at `:338-343`; the full config is passed directly to `new module.Graph` at `:441-446`. These are external SDK option names with local defaults, not one internal phase. Do not infer all 64 legal configurations from the single default construction. |
| `firecrawl-monitor-email-notification` | Retain D2. `packages/drivers/firecrawl/src/internal/Firecrawl.responses.ts:177-184` declares the two optional Booleans; the nested Monitor wire schema is exported against external `Monitor` at `:452-456`. |
| `firecrawl-monitor-search-target-result` | Retain D2. The optional Boolean facts are declared at `packages/drivers/firecrawl/src/internal/Firecrawl.responses.ts:253` and `:257`, used in the target-result union at `:263-267`, then external MonitorCheck exports at `:462-475`. |
| `firecrawl-browser-execute-shape` | Retain D2. `packages/drivers/firecrawl/src/internal/Firecrawl.responses.ts:342` declares optional Boolean killed, and `:348` declares required Boolean success. The response is exported against external BrowserExecuteResponse at `:502-506`, and external ScrapeExecuteResponse at `:547-551`. |
| `ai-provider-cli-claude-auth-status-payload` | Retain D2. `packages/drivers/ai-provider-cli/src/AiProviderCli.models.ts:456-476` explicitly models Claude CLI stdout JSON: one Boolean and three Option strings. The actual stdout decode and projection are at `packages/drivers/ai-provider-cli/src/AiProviderCli.service.ts:174` and `:193-202`. |
| `firecrawl-agent-response-shape` | Retain D2. `packages/drivers/firecrawl/src/internal/Firecrawl.responses.ts:313-317` declares required success plus optional error; the external AgentResponse export is at `:487-491`. |
| `firecrawl-agent-status-shape` | Retain D2. `packages/drivers/firecrawl/src/internal/Firecrawl.responses.ts:318-326` declares optional data/error, required success, and the complete `processing | completed | failed` status literal. The external AgentStatusResponse export is at `:492-496`. Do not erase optional payloads or invent a local independence proof from the schema. |
| `firecrawl-browser-create-shape` | Retain D2. Actual optional error and required success at `packages/drivers/firecrawl/src/internal/Firecrawl.responses.ts:330` and `:335`; external BrowserCreateResponse export at `:497-501`. |
| `firecrawl-browser-delete-shape` | Retain D2. Actual optional error and required success at `packages/drivers/firecrawl/src/internal/Firecrawl.responses.ts:352` and `:354`; external BrowserDeleteResponse export at `:507-511`. |
| `firecrawl-browser-list-shape` | Retain D2. Actual optional error and required success at `packages/drivers/firecrawl/src/internal/Firecrawl.responses.ts:367-369`; external BrowserListResponse export at `:512-516`. |
| `r2-drivers-arch-box-post-apply-verdict` | Retain D1 with the existing literal-proof rationale; the exact declaration and guarded constructor are detailed above. |
| `acp-client-protocol-capabilities` | Retain D2; correct `kind` to `object-literal`. Actual named object passed to external `RpcClient.Protocol.of` at `packages/drivers/acp/src/AcpProtocol.service.ts:845-858`; capability values are at `:855-856`. Its service type is explicitly external at `:414`. |
| `acp-server-protocol-capabilities` | Retain D2; correct `kind` to `object-literal`. Actual named object passed to external `RpcServer.Protocol.of` at `packages/drivers/acp/src/AcpProtocol.service.ts:860-877`; capability values are at `:872-875`. Its service type is explicitly external at `:424`. |
| `r24-drivers-a-f-firecrawl-browser-execute-success-error` | Retain D2. Actual optional error and required success at `packages/drivers/firecrawl/src/internal/Firecrawl.responses.ts:339` and `:348`; external BrowserExecuteResponse wrapper at `:502-506`. |
| `r24-drivers-a-f-firecrawl-monitor-search-judge-degraded-reason` | Retain D2. `packages/drivers/firecrawl/src/internal/Firecrawl.responses.ts:251` is optional nullable string, not required string; `:253` is optional Boolean. Both remain nested external MonitorCheck facts via `:263-267` and `:462-475`. |
| `r25-drivers-a-f-firecrawl-error-options-retryable` | Retain D1. Named Option model at `packages/drivers/firecrawl/src/Firecrawl.errors.ts:266-279`; six structural states as detailed above. Its decoded fields align with the supported `fromReason` constructor's independent projections at `:353-354`. |
| `r25-drivers-a-f-firecrawl-error-options-input-retryable` | Retain D1. Named input model at `packages/drivers/firecrawl/src/Firecrawl.errors.ts:281-294`; the actual supported constructor consumes it at `:342-357` without retryability/delay coupling. |
| `r25-drivers-a-f-firecrawl-error-retryable` | Retain D1. Actual tagged error data at `packages/drivers/firecrawl/src/Firecrawl.errors.ts:311-326`, constructed independently at `:348-357`. A method on the error does not make its data fields callable-only. |
| `r25-drivers-a-f-box-action-base-destructive-provider` | Retain D1 with bounded current-writer note; named type and explicit false/None and false/Some writers are detailed above. |
| `r25-drivers-a-f-box-entitlements-paid-seats` | Retain D1 with corrected note; actual Option quota and supported present/absent examples are detailed above. |
| `r25-drivers-a-f-firecrawl-browser-execute-killed-error` | Retain D2. Actual optional killed and optional error at `packages/drivers/firecrawl/src/internal/Firecrawl.responses.ts:339-342`; external BrowserExecuteResponse wrapper at `:502-506`. |
| `r26-drivers-a-f-firecrawl-sdk-agent-request` | Retain D2. Actual named type at `packages/drivers/firecrawl/src/Firecrawl.models.ts:59-69`, with optional Boolean and optional URLs at `:66-67`. Named external request codec at `:958-961`; forwarded directly to SDK `startAgent` at `packages/drivers/firecrawl/src/Firecrawl.service.ts:686-689`. Optional URLs are a real payload axis; empty/nonempty would be an additional invented axis. |
| `r26-drivers-a-f-browser-session-shape` | Retain D2. Actual optional interactive URL at `packages/drivers/firecrawl/src/internal/Firecrawl.responses.ts:360`, and Boolean at `:364`. Required liveViewUrl at `:362` is not an alternative presence axis. BrowserSessionShape is nested in BrowserListShape at `:368` and external BrowserListResponse at `:512-516`. |
| `r26-drivers-a-f-queue-status-shape` | Retain D2. Required nullable timestamp at `packages/drivers/firecrawl/src/internal/Firecrawl.responses.ts:412`, Boolean at `:413`, external QueueStatusResponse wrapper at `:542-546`, and actual SDK call at `packages/drivers/firecrawl/src/Firecrawl.service.ts:630-633`. |

The Firecrawl external-response relationship in this table is explicit:
`packages/drivers/firecrawl/src/internal/Firecrawl.responses.ts:9-36` imports
the SDK response types; `sdkResponse` at `:46-52` uses a structural encoded
guard and returns the external type. It does not normalize, coordinate, or
redefine these success/error/phase fields as a local state machine.

## Exact parent metadata actions

1. Archive and withdraw exactly the 14 ids in the two withdrawal tables.
   Do not edit their historical source receipts or rewrite the original Grok
   execution receipt. No associated qualified design is being withdrawn.
2. Preserve all three qualified records' members, evidence, cardinality,
   storage, exposure, target shape, tier, and current statuses. This audit
   adds no review-status evidence.
3. For `drivers-cosmos-graph-config`, set `disqualifier.class` to `D2` and
   replace `disqualifier.note` with:

   > Named local schema for external cosmos.gl graph constructor options, passed directly to new module.Graph at Cosmos.renderer.ts:441-446. These SDK config fields have local defaults; this is an external API config mirror, not an internal phase. The single default construction does not establish all 64 cross-product configurations as legal.

4. For `acp-client-protocol-capabilities` and
   `acp-server-protocol-capabilities`, change only `kind` to
   `object-literal`; their existing field-line anchors `855` and `872` are
   current and may remain.
5. For `r25-drivers-a-f-box-entitlements-paid-seats`, retain D1 and replace
   the note's “Only one boolean” and unsupported universal combination claim
   with:

   > Real Boolean/Option commercial-fact pair. The supported Business examples use paid-seats true with both Some(100) and None for the independent Sign allowance (BoxProvisioningIntent.ts:378-384,737-745); canonicalBoxDesiredState preserves the operator-asserted fields unchanged (internal/canonical.ts:73-85). No writer or reader couples paid-seat status to allowance presence. Do not collapse Option presence or infer a phase from unenumerated subscription combinations.

6. For `r25-drivers-a-f-box-action-base-destructive-provider`, retain D1 and
   replace its note with:

   > Actual named ActionBaseInput data carrier. Current private writers pair destructive false with None for Create and Some(providerId) for Noop/Update (BoxProvisioningPlanner.ts:201-211,243-253,362-366); actionBase independently forwards destructive and providerId at :98,101-104. The flag does not restate provider presence. Current writers do not establish destructive-true states, and this row supplies no E1-E4 coupled-state proof.

7. For all three retryability D1 rows, keep their ids and member lists and
   use this shared replacement note:

   > Independent optional diagnostics. Retryability retains absent/None, false, and true; delay retains absent/None or a nonnegative integer. FirecrawlError.fromReason independently normalizes both at Firecrawl.errors.ts:342-357, preserving valid delay presence across all three retryability cases. These are six structural cases, not a two-bit phase or a required-number zero/nonzero projection.

8. For `firecrawl-agent-status-shape`, retain D2 and replace the unsupported
   external combined-true assertion with:

   > External Firecrawl AgentStatusResponse mirror (Firecrawl.responses.ts:318-326,492-496). Keep optional data/error, required success, and the processing/completed/failed status domain intact. sdkResponse structurally guards the SDK value; this driver has no local writer proving a replacement state machine or every external cross-product combination legal.

9. Other retained D2 rows may keep their member lists, anchors, and classes.
   Where their note says “independently reported,” read that as separate
   externally supplied members, not as proof of every legal combination;
   the external-contract citation is the actual D2 ground.
10. Attach this handoff to the parent round adjudication and use the following
    summary without changing the raw lane execution metadata:

    > The 0-record Grok report completed successfully across 16 roots. Source adjudication of 42 seeded canonical rows retains all 3 qualified rows and 25 disqualified rows; 14 seeds are withdrawn out of net (9 callable-only, 4 required-string pseudo-axes, 1 anonymous constructor parameter). QueueStatusShape.mostRecentSuccess is nullable, all cited real Option payloads stay eligible, and CosmosBackendSelection.backend is the real two-value literal domain. CosmosGraphConfig is retained as an external SDK config D2 record. No new qualified case or P3 review result is claimed.

Validation performed: all 42 lane-owned ids are explicitly disposed above;
the live HEAD was rechecked; the 16 driver source roots have no diff from
HEAD. Tests were read only as supporting evidence for already-declared
carriers. No runtime or package tests were needed for this documentation-only
handoff. Parent integration must validate the resulting inventory and counts
after applying its own metadata changes.
