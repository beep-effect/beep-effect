/**
 * Packet control-plane event schemas (`packet-event/v1`).
 *
 * **Details**
 *
 * Canonical schema surface for the single colocated packet-core
 * (goals/packet-control-plane-core, D8): versioned per-event CAS records with
 * parent digests and expected revisions, the derived tip/revision pair, the
 * first-class fork verdict, the fold's derived state, and the trace
 * projection that binds a `sourceTip` to a projector version. The event chain
 * plus the authored Markdown packet are the sole system of record; everything
 * else in this family is read-only and derived.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type { Effect } from "effect";
import type * as AST from "effect/SchemaAST";

const $I = $RepoCliId.create("commands/Goals/PacketCore/PacketCore.schemas");

/**
 * Known packet-event schema versions (`packet-event/v1` is current).
 *
 * **Details**
 *
 * Event evolution is versioned: a future `packet-event/v2` joins this kit and
 * ships with an upcaster so committed v1 files keep replaying byte-stably.
 *
 * **Example** (Recognize the current event version)
 *
 * ```ts
 * import { PacketEventSchemaVersion } from "@beep/repo-cli/test/Goals"
 *
 * console.log(PacketEventSchemaVersion.is["packet-event/v1"]("packet-event/v1")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PacketEventSchemaVersion = LiteralKit(["packet-event/v1"]).pipe(
  $I.annoteSchema("PacketEventSchemaVersion", {
    description: "Known packet-event schema versions (v1 current; upcasters bridge older versions).",
  })
);

/**
 * Known packet-event schema version.
 *
 * **Example** (Annotate an event version)
 *
 * ```ts
 * import type { PacketEventSchemaVersion } from "@beep/repo-cli/test/Goals"
 *
 * const version: PacketEventSchemaVersion = "packet-event/v1"
 * console.log(version)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PacketEventSchemaVersion = typeof PacketEventSchemaVersion.Type;

/**
 * Packet roots that may carry an event stream.
 *
 * **Example** (Enumerate packet roots)
 *
 * ```ts
 * import { PacketRoot } from "@beep/repo-cli/test/Goals"
 *
 * console.log(PacketRoot.Options) // ["goals", "explorations"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PacketRoot = LiteralKit(["goals", "explorations"]).pipe(
  $I.annoteSchema("PacketRoot", {
    description: "Repo-relative packet roots that may carry ops/events streams.",
  })
);

/**
 * Packet root that may carry an event stream.
 *
 * **Example** (Annotate a packet root)
 *
 * ```ts
 * import type { PacketRoot } from "@beep/repo-cli/test/Goals"
 *
 * const root: PacketRoot = "goals"
 * console.log(root)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PacketRoot = typeof PacketRoot.Type;

/**
 * Packet-event types in the v1 vocabulary.
 *
 * **Details**
 *
 * `packet-created` is the genesis event a stream starts with (recording where
 * the packet already stood when it opted in), `stage-entered` records a stage
 * transition with its ordinal, `status-set` records a lifecycle-status
 * transition through the guarded writer, and `risk-tier-overridden` records
 * an operator override of the packet's risk tier.
 *
 * **Example** (Check event-type membership)
 *
 * ```ts
 * import { PacketEventType } from "@beep/repo-cli/test/Goals"
 *
 * console.log(PacketEventType.is["status-set"]("status-set")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PacketEventType = LiteralKit([
  "packet-created",
  "stage-entered",
  "status-set",
  "risk-tier-overridden",
]).pipe(
  $I.annoteSchema("PacketEventType", {
    description: "Packet-event v1 vocabulary: genesis, stage transition, status transition, risk-tier override.",
  })
);

/**
 * Packet-event type in the v1 vocabulary.
 *
 * **Example** (Annotate an event type)
 *
 * ```ts
 * import type { PacketEventType } from "@beep/repo-cli/test/Goals"
 *
 * const type: PacketEventType = "stage-entered"
 * console.log(type)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PacketEventType = typeof PacketEventType.Type;

/**
 * Content-addressed packet-event identity: the lowercase sha-256 hex digest
 * of the event's canonical JSON encoding.
 *
 * **Example** (Validate an event digest)
 *
 * ```ts
 * import { PacketEventId } from "@beep/repo-cli/test/Goals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PacketEventId)("a".repeat(64))) // true
 * console.log(S.is(PacketEventId)("not-a-digest")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PacketEventId = S.String.check(
  S.isPattern(/^[0-9a-f]{64}$/, {
    identifier: $I`PacketEventIdPatternCheck`,
    title: "Packet Event Id Pattern",
    description: "Lowercase sha-256 hex digest of the event's canonical JSON encoding.",
    message: "Expected a lowercase 64-character sha-256 hex digest",
  })
).pipe(
  $I.annoteSchema("PacketEventId", {
    description: "Content-addressed packet-event identity (sha-256 of the canonical encoding).",
  })
);

/**
 * Content-addressed packet-event identity.
 *
 * **Example** (Annotate an event id)
 *
 * ```ts
 * import type { PacketEventId } from "@beep/repo-cli/test/Goals"
 *
 * const id: PacketEventId = "0".repeat(64)
 * console.log(id.length) // 64
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PacketEventId = typeof PacketEventId.Type;

/**
 * Packet slug token shared by goals and explorations directories.
 *
 * **Example** (Validate a packet slug)
 *
 * ```ts
 * import { PacketSlug } from "@beep/repo-cli/test/Goals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PacketSlug)("packet-control-plane-core")) // true
 * console.log(S.is(PacketSlug)("Not A Slug")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PacketSlug = S.String.check(
  S.isPattern(/^[a-z0-9][a-z0-9-]*$/, {
    identifier: $I`PacketSlugPatternCheck`,
    title: "Packet Slug Pattern",
    description: "Lowercase packet directory slug with internal hyphens only.",
    message: "Expected a lowercase packet slug with internal hyphens only",
  }),
  S.isMaxLength(64, {
    identifier: $I`PacketSlugLengthCheck`,
    title: "Packet Slug Length",
    description: "Packet slugs are at most 64 characters.",
    message: "Expected a packet slug with at most 64 characters",
  })
).pipe(
  $I.annoteSchema("PacketSlug", {
    description: "Lowercase packet directory slug under a packet root.",
  })
);

/**
 * Packet slug token.
 *
 * **Example** (Annotate a packet slug)
 *
 * ```ts
 * import type { PacketSlug } from "@beep/repo-cli/test/Goals"
 *
 * const slug: PacketSlug = "packet-control-plane-core"
 * console.log(slug)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PacketSlug = typeof PacketSlug.Type;

/**
 * Derived guard for {@link PacketSlug}.
 *
 * **Example** (Reject a non-slug directory name)
 *
 * ```ts
 * import { isPacketSlug } from "@beep/repo-cli/test/Goals"
 *
 * console.log(isPacketSlug("packet-control-plane-core")) // true
 * console.log(isPacketSlug("_template")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isPacketSlug = S.is(PacketSlug);

/**
 * One stage token inside a packet's own stage vocabulary.
 *
 * **Details**
 *
 * The fold does not own any stage vocabulary: goals declare phases (`P0`,
 * `P1`, ...) and explorations declare the six-stage machine (`capture`,
 * `align`, ...). Writers supply the token plus its ordinal; the fold only
 * needs the pair to derive `furthestStage` and `resumeStage`.
 *
 * **Example** (Validate stage tokens from both vocabularies)
 *
 * ```ts
 * import { PacketStage } from "@beep/repo-cli/test/Goals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PacketStage)("P1")) // true
 * console.log(S.is(PacketStage)("capture")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PacketStage = S.String.check(
  S.isPattern(/^[A-Za-z0-9]+(?:[-_.][A-Za-z0-9]+)*$/, {
    identifier: $I`PacketStagePatternCheck`,
    title: "Packet Stage Pattern",
    description: "Stage token from the packet's own vocabulary (goal phase id or exploration stage).",
    message: "Expected an alphanumeric stage token with internal -_. separators only",
  }),
  S.isMaxLength(40, {
    identifier: $I`PacketStageLengthCheck`,
    title: "Packet Stage Length",
    description: "Stage tokens are at most 40 characters.",
    message: "Expected a stage token with at most 40 characters",
  })
).pipe(
  $I.annoteSchema("PacketStage", {
    description: "One stage token inside a packet's own stage vocabulary.",
  })
);

/**
 * Stage token inside a packet's own vocabulary.
 *
 * **Example** (Annotate a stage token)
 *
 * ```ts
 * import type { PacketStage } from "@beep/repo-cli/test/Goals"
 *
 * const stage: PacketStage = "P1"
 * console.log(stage)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PacketStage = typeof PacketStage.Type;

/**
 * Derived guard for {@link PacketStage}.
 *
 * **Example** (Accept a goal phase id and reject prose)
 *
 * ```ts
 * import { isPacketStage } from "@beep/repo-cli/test/Goals"
 *
 * console.log(isPacketStage("P1")) // true
 * console.log(isPacketStage("Research (inherited)")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isPacketStage = S.is(PacketStage);

/**
 * Lifecycle-status token recorded by packet events.
 *
 * **Details**
 *
 * The event store is packet-kind-generic, so the event schema constrains the
 * token shape only; domain legality (the goal 5-state lifecycle, the
 * exploration status vocabulary) is enforced by the guarded writer that
 * appends the event, not by the stream.
 *
 * **Example** (Validate status tokens)
 *
 * ```ts
 * import { PacketStatusToken } from "@beep/repo-cli/test/Goals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PacketStatusToken)("completed-retained")) // true
 * console.log(S.is(PacketStatusToken)("DONE")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PacketStatusToken = S.String.check(
  S.isPattern(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, {
    identifier: $I`PacketStatusTokenPatternCheck`,
    title: "Packet Status Token Pattern",
    description: "Lowercase lifecycle-status token with internal single hyphens only.",
    message: "Expected a lowercase status token with internal single hyphens only",
  }),
  S.isMaxLength(40, {
    identifier: $I`PacketStatusTokenLengthCheck`,
    title: "Packet Status Token Length",
    description: "Status tokens are at most 40 characters.",
    message: "Expected a status token with at most 40 characters",
  })
).pipe(
  $I.annoteSchema("PacketStatusToken", {
    description: "Lifecycle-status token recorded by packet events (writer enforces the domain).",
  })
);

/**
 * Lifecycle-status token recorded by packet events.
 *
 * **Example** (Annotate a status token)
 *
 * ```ts
 * import type { PacketStatusToken } from "@beep/repo-cli/test/Goals"
 *
 * const status: PacketStatusToken = "active"
 * console.log(status)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PacketStatusToken = typeof PacketStatusToken.Type;

/**
 * Stream revision: the number of events on the linear chain (0 = empty).
 *
 * **Example** (Validate a revision)
 *
 * ```ts
 * import { PacketRevision } from "@beep/repo-cli/test/Goals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PacketRevision)(0)) // true
 * console.log(S.is(PacketRevision)(-1)) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PacketRevision = S.Int.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`PacketRevisionRangeCheck`,
    title: "Packet Revision Range",
    description: "Stream revisions are non-negative integers (0 = empty stream).",
    message: "Expected a non-negative integer revision",
  })
).pipe(
  $I.annoteSchema("PacketRevision", {
    description: "Number of events on the linear chain (0 = empty stream).",
  })
);

/**
 * Stream revision value.
 *
 * **Example** (Annotate a revision)
 *
 * ```ts
 * import type { PacketRevision } from "@beep/repo-cli/test/Goals"
 *
 * const revision: PacketRevision = 3
 * console.log(revision)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PacketRevision = typeof PacketRevision.Type;

/**
 * Stage ordinal inside a packet's declared stage order.
 *
 * **Example** (Validate a stage ordinal)
 *
 * ```ts
 * import { PacketStageOrdinal } from "@beep/repo-cli/test/Goals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PacketStageOrdinal)(1)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PacketStageOrdinal = S.Int.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`PacketStageOrdinalRangeCheck`,
    title: "Packet Stage Ordinal Range",
    description: "Stage ordinals are non-negative integers in the packet's declared order.",
    message: "Expected a non-negative integer stage ordinal",
  })
).pipe(
  $I.annoteSchema("PacketStageOrdinal", {
    description: "Position of a stage inside the packet's declared stage order.",
  })
);

/**
 * Stage ordinal value.
 *
 * **Example** (Annotate a stage ordinal)
 *
 * ```ts
 * import type { PacketStageOrdinal } from "@beep/repo-cli/test/Goals"
 *
 * const ordinal: PacketStageOrdinal = 1
 * console.log(ordinal)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PacketStageOrdinal = typeof PacketStageOrdinal.Type;

/**
 * Packet risk tiers in the ratified Light/Standard/Full routing vocabulary.
 *
 * **Details**
 *
 * The tier decides how much design/approval ceremony a packet's changes
 * deserve. Tier *computation* from change trees is gated design-gate scope
 * (parent MAP candidate 2); this core ships only the tier vocabulary and the
 * operator-only override record.
 *
 * **Example** (Enumerate risk tiers)
 *
 * ```ts
 * import { PacketRiskTier } from "@beep/repo-cli/test/Goals"
 *
 * console.log(PacketRiskTier.Options) // ["light", "standard", "full"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PacketRiskTier = LiteralKit(["light", "standard", "full"]).pipe(
  $I.annoteSchema("PacketRiskTier", {
    description: "Packet risk tier in the Light/Standard/Full routing vocabulary.",
  })
);

/**
 * Packet risk tier value.
 *
 * **Example** (Annotate a risk tier)
 *
 * ```ts
 * import type { PacketRiskTier } from "@beep/repo-cli/test/Goals"
 *
 * const tier: PacketRiskTier = "standard"
 * console.log(tier)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PacketRiskTier = typeof PacketRiskTier.Type;

/**
 * Guard for {@link PacketRiskTier} membership.
 *
 * **Example** (Validate CLI input)
 *
 * ```ts
 * import { isPacketRiskTier } from "@beep/repo-cli/test/Goals"
 *
 * console.log(isPacketRiskTier("standard")) // true
 * console.log(isPacketRiskTier("extreme")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isPacketRiskTier = S.is(PacketRiskTier);

const PacketCreatedBodyStagePairCheck = S.makeFilter(
  (body: { readonly stage?: PacketStage; readonly ordinal?: PacketStageOrdinal }) =>
    (body.stage === undefined) === (body.ordinal === undefined),
  {
    identifier: $I`PacketCreatedBodyStagePairCheck`,
    title: "Packet Created Body Stage Pair",
    description: "Genesis stage and ordinal are recorded together or not at all.",
    message: "Expected stage and ordinal to be present together or absent together",
  }
);

/**
 * Genesis event body: where the packet already stood when its stream opened.
 *
 * **Details**
 *
 * Streams are adopted mid-life (D9 self-hosting starts on a packet that
 * already exists), so genesis records the current status and, when the packet
 * declares stages, the current stage/ordinal pair.
 *
 * **Example** (Construct a genesis body)
 *
 * ```ts
 * import { PacketCreatedBody } from "@beep/repo-cli/test/Goals"
 *
 * const body = PacketCreatedBody.make({ type: "packet-created", status: "active", stage: "P1", ordinal: 1 })
 * console.log(body.type) // "packet-created"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PacketCreatedBody extends S.Class<PacketCreatedBody>($I`PacketCreatedBody`)(
  S.Struct({
    type: S.Literal("packet-created"),
    status: PacketStatusToken,
    stage: S.optionalKey(PacketStage),
    ordinal: S.optionalKey(PacketStageOrdinal),
  }).check(PacketCreatedBodyStagePairCheck),
  $I.annote("PacketCreatedBody", {
    description: "Genesis event body: status plus optional stage/ordinal at stream adoption.",
  })
) {}

/**
 * Stage-transition event body.
 *
 * **Example** (Construct a stage-entered body)
 *
 * ```ts
 * import { StageEnteredBody } from "@beep/repo-cli/test/Goals"
 *
 * const body = StageEnteredBody.make({ type: "stage-entered", stage: "align", ordinal: 2 })
 * console.log(body.stage) // "align"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StageEnteredBody extends S.Class<StageEnteredBody>($I`StageEnteredBody`)(
  {
    type: S.Literal("stage-entered"),
    stage: PacketStage,
    ordinal: PacketStageOrdinal,
  },
  $I.annote("StageEnteredBody", {
    description: "Stage-transition event body: entered stage plus its declared ordinal.",
  })
) {}

/**
 * Status-transition event body.
 *
 * **Example** (Construct a status-set body)
 *
 * ```ts
 * import { StatusSetBody } from "@beep/repo-cli/test/Goals"
 *
 * const body = StatusSetBody.make({ type: "status-set", status: "paused", previous: "active" })
 * console.log(body.status) // "paused"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StatusSetBody extends S.Class<StatusSetBody>($I`StatusSetBody`)(
  {
    type: S.Literal("status-set"),
    status: PacketStatusToken,
    previous: PacketStatusToken,
  },
  $I.annote("StatusSetBody", {
    description: "Status-transition event body: new status plus the status it replaced.",
  })
) {}

/**
 * Recorded, challengeable reason attached to every risk-tier override.
 *
 * **Details**
 *
 * Non-empty by construction so the challenge surface can never be blank —
 * enforced on the event body that is recorded and on the writer request that
 * drafts it.
 *
 * **Example** (Validate an override reason)
 *
 * ```ts
 * import { RiskTierOverrideReason } from "@beep/repo-cli/test/Goals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(RiskTierOverrideReason)("touches the release pipeline")) // true
 * console.log(S.is(RiskTierOverrideReason)("")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RiskTierOverrideReason = S.String.check(
  S.isMinLength(1, {
    identifier: $I`RiskTierOverrideReasonLengthCheck`,
    title: "Risk Tier Override Reason Length",
    description: "Every risk-tier override records a non-empty operator reason.",
    message: "Expected a non-empty override reason",
  })
).pipe(
  $I.annoteSchema("RiskTierOverrideReason", {
    description: "Non-empty recorded reason for an operator risk-tier override.",
  })
);

/**
 * Operator risk-tier override event body.
 *
 * **Details**
 *
 * Overrides are operator-only, recorded, and challengeable: the body carries
 * the operator's non-empty `reason` so a later reader can dispute it, and
 * `previous` names the override it replaces (absent on the first override).
 * A later override event supersedes an earlier one; the event chain itself
 * is the challenge surface.
 *
 * **Example** (Construct a risk-tier override body)
 *
 * ```ts
 * import { RiskTierOverriddenBody } from "@beep/repo-cli/test/Goals"
 *
 * const body = RiskTierOverriddenBody.make({
 *   type: "risk-tier-overridden",
 *   tier: "full",
 *   reason: "touches the release pipeline",
 * })
 * console.log(body.tier) // "full"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RiskTierOverriddenBody extends S.Class<RiskTierOverriddenBody>($I`RiskTierOverriddenBody`)(
  {
    type: S.Literal("risk-tier-overridden"),
    tier: PacketRiskTier,
    previous: S.optionalKey(PacketRiskTier),
    reason: RiskTierOverrideReason,
  },
  $I.annote("RiskTierOverriddenBody", {
    description: "Operator risk-tier override body: new tier, replaced override, recorded reason.",
  })
) {}

/**
 * Typed union of packet-event v1 bodies, discriminated by `type`.
 *
 * **Example** (Decode a body from its wire shape)
 *
 * ```ts
 * import { PacketEventBody } from "@beep/repo-cli/test/Goals"
 * import * as S from "effect/Schema"
 *
 * const body = S.decodeUnknownSync(PacketEventBody)({ type: "stage-entered", stage: "P1", ordinal: 1 })
 * console.log(body.type) // "stage-entered"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PacketEventBody = S.Union([
  PacketCreatedBody,
  StageEnteredBody,
  StatusSetBody,
  RiskTierOverriddenBody,
]).pipe(
  $I.annoteSchema("PacketEventBody", {
    description: "Packet-event v1 body union discriminated by the type field.",
  })
);

/**
 * Typed packet-event v1 body.
 *
 * **Example** (Annotate a body value)
 *
 * ```ts
 * import { StageEnteredBody } from "@beep/repo-cli/test/Goals"
 * import type { PacketEventBody } from "@beep/repo-cli/test/Goals"
 *
 * const body: PacketEventBody = StageEnteredBody.make({ type: "stage-entered", stage: "P2", ordinal: 2 })
 * console.log(body.type)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PacketEventBody = typeof PacketEventBody.Type;

const PacketEventTimestamp = S.String.check(
  S.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/, {
    identifier: $I`PacketEventAtPatternCheck`,
    title: "Packet Event Timestamp Pattern",
    description: "Event timestamps are ISO-8601 date-time strings.",
    message: "Expected an ISO-8601 date-time string",
  })
);

const PacketEventActor = S.String.check(
  S.isMinLength(1, {
    identifier: $I`PacketEventActorLengthCheck`,
    title: "Packet Event Actor Length",
    description: "The recording actor is a non-empty string.",
    message: "Expected a non-empty actor",
  })
);

const PacketEventGenesisParentCheck = S.makeFilter(
  (event: { readonly seq: number; readonly parent?: PacketEventId }) =>
    (event.seq === 1) === (event.parent === undefined),
  {
    identifier: $I`PacketEventGenesisParentCheck`,
    title: "Packet Event Genesis Parent",
    description: "Only the genesis event (seq 1) omits the parent digest.",
    message: "Expected parent to be absent exactly when seq is 1",
  }
);

const PacketEventCasRevisionCheck = S.makeFilter(
  (event: { readonly seq: number; readonly expectedRevision: number }) => event.expectedRevision === event.seq - 1,
  {
    identifier: $I`PacketEventCasRevisionCheck`,
    title: "Packet Event CAS Revision",
    description: "The declared expected revision is always the sequence number minus one.",
    message: "Expected expectedRevision to equal seq - 1",
  }
);

/**
 * One versioned CAS packet event.
 *
 * **Details**
 *
 * The stored file content is exactly this encoded shape; the event's identity
 * is the sha-256 digest of its canonical encoding and is never stored inside
 * the file. `parent` chains the digest of the previous event (absent only at
 * genesis), and `expectedRevision` declares the writer's compare-and-set
 * expectation, so two concurrent appends produce two children of one parent —
 * a detectable fork, never a silent overwrite (D1).
 *
 * **Example** (Construct a status-set event)
 *
 * ```ts
 * import { PacketEvent } from "@beep/repo-cli/test/Goals"
 *
 * const event = PacketEvent.make({
 *   schemaVersion: "packet-event/v1",
 *   packet: "demo",
 *   root: "goals",
 *   seq: 2,
 *   parent: "0".repeat(64),
 *   expectedRevision: 1,
 *   at: "2026-08-17T00:00:00.000Z",
 *   actor: "operator",
 *   body: { type: "status-set", status: "paused", previous: "active" },
 * })
 * console.log(event.seq) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PacketEvent extends S.Class<PacketEvent>($I`PacketEvent`)(
  S.Struct({
    schemaVersion: PacketEventSchemaVersion,
    packet: PacketSlug,
    root: PacketRoot,
    seq: S.Int.check(
      S.isGreaterThanOrEqualTo(1, {
        identifier: $I`PacketEventSeqRangeCheck`,
        title: "Packet Event Seq Range",
        description: "Event sequence numbers start at 1.",
        message: "Expected a positive integer sequence number",
      })
    ),
    parent: S.optionalKey(PacketEventId),
    expectedRevision: PacketRevision,
    at: PacketEventTimestamp,
    actor: PacketEventActor,
    body: PacketEventBody,
  }).check(PacketEventGenesisParentCheck, PacketEventCasRevisionCheck),
  $I.annote("PacketEvent", {
    description: "One versioned CAS packet event with parent digest and expected revision.",
  })
) {}

/**
 * Decode an unknown parsed JSON value as a {@link PacketEvent}.
 *
 * **Example** (Build the decode effect for a parsed value)
 *
 * ```ts
 * import { decodePacketEvent } from "@beep/repo-cli/test/Goals"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(decodePacketEvent({})))
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodePacketEvent: {
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<PacketEvent, S.SchemaError>;
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<PacketEvent, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(PacketEvent));

/**
 * One packet event as stored on disk: the decoded event plus its verified
 * content digest and file name.
 *
 * **Example** (Construct a stored event record)
 *
 * ```ts
 * import { PacketEvent, StoredPacketEvent } from "@beep/repo-cli/test/Goals"
 *
 * const stored = StoredPacketEvent.make({
 *   id: "0".repeat(64),
 *   fileName: `00001-packet-created-${"0".repeat(64)}.json`,
 *   event: PacketEvent.make({
 *     schemaVersion: "packet-event/v1",
 *     packet: "demo",
 *     root: "goals",
 *     seq: 1,
 *     expectedRevision: 0,
 *     at: "2026-08-17T00:00:00.000Z",
 *     actor: "operator",
 *     body: { type: "packet-created", status: "active" },
 *   }),
 * })
 * console.log(stored.event.seq) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StoredPacketEvent extends S.Class<StoredPacketEvent>($I`StoredPacketEvent`)(
  {
    id: PacketEventId,
    fileName: S.String,
    event: PacketEvent,
  },
  $I.annote("StoredPacketEvent", {
    description: "One packet event as stored on disk: decoded event plus verified digest and file name.",
  })
) {}

/**
 * Current head of a packet stream's linear chain.
 *
 * **Example** (Construct a tip)
 *
 * ```ts
 * import { PacketTip } from "@beep/repo-cli/test/Goals"
 *
 * const tip = PacketTip.make({ seq: 3, id: "0".repeat(64) })
 * console.log(tip.seq) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PacketTip extends S.Class<PacketTip>($I`PacketTip`)(
  {
    seq: S.Int.check(
      S.isGreaterThanOrEqualTo(1, {
        identifier: $I`PacketTipSeqRangeCheck`,
        title: "Packet Tip Seq Range",
        description: "A tip's sequence number is at least 1.",
        message: "Expected a positive integer tip sequence number",
      })
    ),
    id: PacketEventId,
  },
  $I.annote("PacketTip", {
    description: "Current head of a packet stream's linear chain (seq plus event digest).",
  })
) {}

/**
 * First-class fork verdict: one parent with two or more children.
 *
 * **Details**
 *
 * `parent` is absent for a genesis fork (two seq-1 events). Fork repair is a
 * later core rung (P3); in the first slice a fork is surfaced by the check
 * and refused by the writer, never silently resolved.
 *
 * **Example** (Construct a fork verdict)
 *
 * ```ts
 * import { PacketForkVerdict } from "@beep/repo-cli/test/Goals"
 *
 * const verdict = PacketForkVerdict.make({
 *   parent: "0".repeat(64),
 *   parentSeq: 2,
 *   children: ["1".repeat(64), "2".repeat(64)],
 * })
 * console.log(verdict.children.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PacketForkVerdict extends S.Class<PacketForkVerdict>($I`PacketForkVerdict`)(
  {
    parent: S.optionalKey(PacketEventId),
    parentSeq: PacketRevision,
    children: S.Array(PacketEventId),
  },
  $I.annote("PacketForkVerdict", {
    description: "One parent event with two or more children (parent absent for a genesis fork).",
  })
) {}

/**
 * Chain-integrity issue kinds a stream read or fold can report.
 *
 * **Example** (Check issue-kind membership)
 *
 * ```ts
 * import { PacketChainIssueKind } from "@beep/repo-cli/test/Goals"
 *
 * console.log(PacketChainIssueKind.is["digest-mismatch"]("digest-mismatch")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PacketChainIssueKind = LiteralKit([
  "event-unreadable",
  "event-invalid",
  "digest-mismatch",
  "file-name-mismatch",
  "missing-parent",
  "parent-seq-mismatch",
]).pipe(
  $I.annoteSchema("PacketChainIssueKind", {
    description: "Chain-integrity issue kinds reported by the store read and the fold.",
  })
);

/**
 * Chain-integrity issue kind.
 *
 * **Example** (Annotate an issue kind)
 *
 * ```ts
 * import type { PacketChainIssueKind } from "@beep/repo-cli/test/Goals"
 *
 * const kind: PacketChainIssueKind = "missing-parent"
 * console.log(kind)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PacketChainIssueKind = typeof PacketChainIssueKind.Type;

/**
 * One chain-integrity issue with the file it anchors to.
 *
 * **Example** (Construct a chain issue)
 *
 * ```ts
 * import { PacketChainIssue } from "@beep/repo-cli/test/Goals"
 *
 * const issue = PacketChainIssue.make({
 *   kind: "missing-parent",
 *   fileName: "00002-status-set-abc.json",
 *   detail: "parent digest not found in the stream",
 * })
 * console.log(issue.kind) // "missing-parent"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PacketChainIssue extends S.Class<PacketChainIssue>($I`PacketChainIssue`)(
  {
    kind: PacketChainIssueKind,
    fileName: S.String,
    detail: S.String,
  },
  $I.annote("PacketChainIssue", {
    description: "One chain-integrity issue anchored to an event file.",
  })
) {}

/**
 * Currently effective operator risk-tier override of one packet stream.
 *
 * **Details**
 *
 * Derived from the last `risk-tier-overridden` event on the unambiguous
 * linear prefix. The challenge surface travels with it: the recorded reason,
 * actor, and timestamp of the override that is in effect.
 *
 * **Example** (Construct an override state)
 *
 * ```ts
 * import { PacketRiskTierOverrideState } from "@beep/repo-cli/test/Goals"
 *
 * const override = PacketRiskTierOverrideState.make({
 *   tier: "full",
 *   reason: "touches the release pipeline",
 *   actor: "operator",
 *   at: "2026-08-17T00:00:00.000Z",
 * })
 * console.log(override.tier) // "full"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PacketRiskTierOverrideState extends S.Class<PacketRiskTierOverrideState>($I`PacketRiskTierOverrideState`)(
  {
    tier: PacketRiskTier,
    reason: S.String,
    actor: PacketEventActor,
    at: PacketEventTimestamp,
  },
  $I.annote("PacketRiskTierOverrideState", {
    description: "Effective operator risk-tier override: tier plus its recorded reason, actor, and timestamp.",
  })
) {}

/**
 * Deterministic derived state of one packet stream.
 *
 * **Details**
 *
 * Derivations follow D3: `furthestStage` is the monotonic high-water mark by
 * ordinal over stage-carrying events, and `resumeStage` is the cursor from
 * the last stage-carrying event, so a loop-back leaves `resumeStage` behind
 * `furthestStage`. When the stream is forked, derivations cover only the
 * unambiguous linear prefix up to the fork point, and the fork itself is
 * reported as a first-class verdict.
 *
 * **Example** (Construct an empty derived state)
 *
 * ```ts
 * import { PacketDerivedState } from "@beep/repo-cli/test/Goals"
 *
 * const derived = PacketDerivedState.make({
 *   packet: "demo",
 *   root: "goals",
 *   revision: 0,
 *   forks: [],
 *   issues: [],
 * })
 * console.log(derived.revision) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PacketDerivedState extends S.Class<PacketDerivedState>($I`PacketDerivedState`)(
  {
    packet: PacketSlug,
    root: PacketRoot,
    revision: PacketRevision,
    tip: S.optionalKey(PacketTip),
    status: S.optionalKey(PacketStatusToken),
    furthestStage: S.optionalKey(PacketStage),
    furthestOrdinal: S.optionalKey(PacketStageOrdinal),
    resumeStage: S.optionalKey(PacketStage),
    riskTierOverride: S.optionalKey(PacketRiskTierOverrideState),
    forks: S.Array(PacketForkVerdict),
    issues: S.Array(PacketChainIssue),
  },
  $I.annote("PacketDerivedState", {
    description:
      "Deterministic derived state of one packet stream (D3 stage derivations, tip, risk-tier override, forks, issues).",
  })
) {}

/**
 * Current packet-trace projector version.
 *
 * **Details**
 *
 * The version bumps only when the projector renders different bytes for a
 * previously valid stream. Additive derivations that stay absent on old
 * streams (for example the risk-tier override) keep the version: streams
 * containing the new event types do not decode under older projectors at
 * all, so no two projector versions ever disagree about the same stream.
 *
 * **Example** (Read the projector version)
 *
 * ```ts
 * import { PACKET_PROJECTOR_VERSION } from "@beep/repo-cli/test/Goals"
 *
 * console.log(PACKET_PROJECTOR_VERSION) // 1
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const PACKET_PROJECTOR_VERSION = 1;

/**
 * Read-only trace projection of one packet stream.
 *
 * **Details**
 *
 * The projection binds its `sourceTip` and `projectorVersion` so staleness is
 * always derivable: a committed trace whose source tip no longer matches the
 * folded stream (or whose projector version is outdated) is stale, never
 * silently trusted. The rendered file embeds no timestamps, so identical
 * streams project byte-identical traces.
 *
 * **Example** (Construct a projection for an empty stream)
 *
 * ```ts
 * import { PacketDerivedState, PacketTraceProjection } from "@beep/repo-cli/test/Goals"
 *
 * const trace = PacketTraceProjection.make({
 *   schemaVersion: "packet-trace/v1",
 *   projectorVersion: 1,
 *   derived: PacketDerivedState.make({ packet: "demo", root: "goals", revision: 0, forks: [], issues: [] }),
 * })
 * console.log(trace.projectorVersion) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PacketTraceProjection extends S.Class<PacketTraceProjection>($I`PacketTraceProjection`)(
  {
    schemaVersion: S.Literal("packet-trace/v1"),
    projectorVersion: S.Int.check(
      S.isGreaterThanOrEqualTo(1, {
        identifier: $I`PacketTraceProjectorVersionCheck`,
        title: "Packet Trace Projector Version",
        description: "Projector versions start at 1.",
        message: "Expected a positive integer projector version",
      })
    ),
    sourceTip: S.optionalKey(PacketTip),
    derived: PacketDerivedState,
  },
  $I.annote("PacketTraceProjection", {
    description: "Read-only trace projection binding sourceTip and projector version for staleness detection.",
  })
) {}

/**
 * Decode an unknown parsed JSON value as a {@link PacketTraceProjection}.
 *
 * **Example** (Build the decode effect for a parsed value)
 *
 * ```ts
 * import { decodePacketTraceProjection } from "@beep/repo-cli/test/Goals"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(decodePacketTraceProjection({})))
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodePacketTraceProjection: {
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<PacketTraceProjection, S.SchemaError>;
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<PacketTraceProjection, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(PacketTraceProjection));
