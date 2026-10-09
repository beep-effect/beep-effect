/**
 * Bounded contracts for the local durable agent message router.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { EffortLevel, ModelId } from "../Models/Models.catalog.schemas.ts";

const $I = $RepoCliId.create("commands/AgentMessage/AgentMessage.models");
const Identity = S.NonEmptyString.check(S.isMaxLength(128)).pipe(
  $I.annoteSchema("Identity", {
    description: "Opaque local participant, endpoint, message or grant identifier bounded to 128 characters.",
  })
);
const Fingerprint = S.NonEmptyString.check(S.isMaxLength(256)).pipe(
  $I.annoteSchema("Fingerprint", {
    description: "Opaque policy or capability comparison token; this value does not authorize a sender.",
  })
);
const RepositoryScope = S.NonEmptyString.check(S.isMaxLength(512)).pipe(
  $I.annoteSchema("RepositoryScope", {
    description: "Host-issued canonical repository scope shared by enrollment and message acceptance.",
  })
);
const PolicyValue = S.NonEmptyString.check(S.isMaxLength(128)).pipe(
  $I.annoteSchema("PolicyValue", {
    description: "Explicit bounded sandbox or approval-policy value reported or enforced at launch.",
  })
);
const Detail = S.NonEmptyString.check(S.isMaxLength(1024)).pipe(
  $I.annoteSchema("Detail", { description: "Sanitized diagnostic context bounded to 1024 characters." })
);
const Body = S.NonEmptyString.check(S.isMaxLength(16384)).pipe(
  $I.annoteSchema("Body", {
    description: "Plain message payload bounded to 16384 characters before durable acceptance.",
  })
);
const OptionalIdentity = Identity.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone));
const OptionalDetail = Detail.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone));

/**
 * Provider that owns a registered endpoint; injected is reserved for deterministic tests.
 *
 * **Example** (Validate a router value)
 *
 * ```ts
 * import { Provider } from "@beep/repo-cli/test/AgentMessage"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(Provider)("codex")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Provider = LiteralKit(["codex", "claude", "grok", "cursor", "injected"]).pipe(
  $I.annoteSchema("Provider", {
    description: "Provider that owns a registered endpoint; injected is reserved for deterministic tests.",
  })
);

/** Provider that owns a registered endpoint; injected is reserved for deterministic tests.
 * @category type-level
 * @since 0.0.0
 */
export type Provider = typeof Provider.Type;

/**
 * Operation whose behavior was checked on an endpoint transport.
 *
 * **Example** (Validate a router value)
 *
 * ```ts
 * import { Capability } from "@beep/repo-cli/test/AgentMessage"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(Capability)("reply")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Capability = LiteralKit(["send", "reply", "busyFollowup", "interrupt", "reconnect"]).pipe(
  $I.annoteSchema("Capability", { description: "Operation whose behavior was checked on an endpoint transport." })
);

/** Operation whose behavior was checked on an endpoint transport.
 * @category type-level
 * @since 0.0.0
 */
export type Capability = typeof Capability.Type;

/**
 * Capability evidence: advertised means handshake support without context-consumption proof; verified requires observed operation evidence.
 *
 * **Example** (Validate a router value)
 *
 * ```ts
 * import { EvidenceDisposition } from "@beep/repo-cli/test/AgentMessage"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(EvidenceDisposition)("verified")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EvidenceDisposition = LiteralKit(["advertised", "verified", "unverified", "unavailable"]).pipe(
  $I.annoteSchema("EvidenceDisposition", {
    description:
      "Capability evidence: advertised means handshake support without context-consumption proof; verified requires observed operation evidence.",
  })
);

/** Capability evidence: advertised means handshake support without context-consumption proof; verified requires observed operation evidence.
 * @category type-level
 * @since 0.0.0
 */
export type EvidenceDisposition = typeof EvidenceDisposition.Type;

/**
 * Durable lifecycle fact; delivered requires adapter confirmation and ambiguous forbids blind retry.
 *
 * **Example** (Validate a router value)
 *
 * ```ts
 * import { ReceiptStatus } from "@beep/repo-cli/test/AgentMessage"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ReceiptStatus)("ambiguous")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ReceiptStatus = LiteralKit([
  "accepted",
  "claimed",
  "delivered",
  "acknowledged",
  "failed",
  "expired",
  "ambiguous",
]).pipe(
  $I.annoteSchema("ReceiptStatus", {
    description: "Durable lifecycle fact; delivered requires adapter confirmation and ambiguous forbids blind retry.",
  })
);

/** Durable lifecycle fact; delivered requires adapter confirmation and ambiguous forbids blind retry.
 * @category type-level
 * @since 0.0.0
 */
export type ReceiptStatus = typeof ReceiptStatus.Type;

/**
 * Failure classification for transactional routing and enrollment checks.
 *
 * **Example** (Validate a router value)
 *
 * ```ts
 * import { RouterErrorCode } from "@beep/repo-cli/test/AgentMessage"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(RouterErrorCode)("policyMismatch")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RouterErrorCode = LiteralKit([
  "conflict",
  "queueFull",
  "unknownEndpoint",
  "unsupported",
  "policyMismatch",
  "staleClaim",
  "storage",
  "invalidGrant",
  "expired",
]).pipe(
  $I.annoteSchema("RouterErrorCode", {
    description: "Failure classification for transactional routing and enrollment checks.",
  })
);

/** Failure classification for transactional routing and enrollment checks.
 * @category type-level
 * @since 0.0.0
 */
export type RouterErrorCode = typeof RouterErrorCode.Type;

/**
 * Bounded receipt provenance for one capability; source references sanitized evidence rather than secrets.
 *
 * **Example** (Validate a router value)
 *
 * ```ts
 * import { CapabilityEvidence } from "@beep/repo-cli/test/AgentMessage"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CapabilityEvidence)({ capability: "reply", disposition: "verified", source: "research/spike/reply.json", observedAt: 100 })) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CapabilityEvidence extends S.Class<CapabilityEvidence>($I`CapabilityEvidence`)(
  {
    capability: Capability,
    disposition: EvidenceDisposition,
    source: S.NonEmptyString.check(S.isMaxLength(512)),
    observedAt: S.Natural,
  },
  $I.annote("CapabilityEvidence", {
    description:
      "Bounded receipt provenance for one capability; source references sanitized evidence rather than secrets.",
  })
) {}

/**
 * Explicit launch policy with evidence distinguishing runtime reports from enforced arguments.
 *
 * **Example** (Validate a router value)
 *
 * ```ts
 * import { PolicySnapshot } from "@beep/repo-cli/test/AgentMessage"
 * import { ModelId } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PolicySnapshot)(PolicySnapshot.make({ provider: "codex", modelId: ModelId.make("gpt-6.1-sol"), effort: "medium", sandbox: "read-only", approvalPolicy: "never", fingerprint: "policy-v1", policyEvidence: "effective-reported" }))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PolicySnapshot extends S.Class<PolicySnapshot>($I`PolicySnapshot`)(
  {
    provider: Provider,
    modelId: ModelId.check(S.isMaxLength(128)),
    effort: EffortLevel,
    sandbox: PolicyValue,
    approvalPolicy: PolicyValue,
    fingerprint: Fingerprint,
    policyEvidence: S.Literals(["effective-reported", "launch-enforced", "unverified"]),
  },
  $I.annote("PolicySnapshot", {
    description: "Explicit launch policy with evidence distinguishing runtime reports from enforced arguments.",
  })
) {}

/**
 * Host-resolved execution location with independently observed lane, run and turn references.
 *
 * **Details**
 *
 * The host supplies its canonical workspace. Optional references remain absent until observed;
 * a session identifier is not used as a substitute for a run or turn identifier.
 *
 * **Example** (Record an observed workspace and run)
 *
 * ```ts
 * import { EndpointExecutionRef } from "@beep/repo-cli/test/AgentMessage"
 * import * as O from "effect/Option"
 *
 * const execution = EndpointExecutionRef.make({ workspace: "/workspace/repository", runId: O.some("owned-run") })
 * console.log(O.isNone(execution.turnId)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EndpointExecutionRef extends S.Class<EndpointExecutionRef>($I`EndpointExecutionRef`)(
  {
    workspace: RepositoryScope,
    lane: OptionalIdentity,
    runId: OptionalIdentity,
    turnId: OptionalIdentity,
  },
  $I.annote("EndpointExecutionRef", {
    description: "Host-resolved canonical workspace and optional independently observed lane, run and turn references.",
  })
) {}

/**
 * Surface that owns an enrolled session.
 *
 * **Example** (Describe a managed CLI session)
 *
 * ```ts
 * import { EndpointHostMode } from "@beep/repo-cli/test/AgentMessage"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(EndpointHostMode)("managed-process")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EndpointHostMode = LiteralKit(["managed-process", "native-app", "browser", "cloud", "injected"]).pipe(
  $I.annoteSchema("EndpointHostMode", {
    description: "Explicit session-owning surface, distinct from the provider and backend transport.",
  })
);

/** Surface derived from its runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type EndpointHostMode = typeof EndpointHostMode.Type;

/**
 * Provider and backend ownership with optional observed host and application references.
 *
 * **Details**
 *
 * A backend name records the enrolled transport. It does not prove native application control.
 * Host and application identifiers are supplied only when the owner observes them.
 *
 * **Example** (Identify an owned app-server process)
 *
 * ```ts
 * import { EndpointHostRef } from "@beep/repo-cli/test/AgentMessage"
 * import * as O from "effect/Option"
 *
 * const host = EndpointHostRef.make({ mode: "managed-process", provider: "codex", backend: "codex-app-server-stdio" })
 * console.log(O.isNone(host.appId)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EndpointHostRef extends S.Class<EndpointHostRef>($I`EndpointHostRef`)(
  {
    mode: EndpointHostMode,
    provider: Provider,
    backend: PolicyValue,
    hostId: OptionalIdentity,
    appId: OptionalIdentity,
  },
  $I.annote("EndpointHostRef", {
    description: "Session-owning surface, provider and backend with optional observed host and application references.",
  })
) {}

/**
 * Owned endpoint enrollment scoped to a repository and fenced by the current lifecycle generation.
 *
 * **Example** (Validate a router value)
 *
 * ```ts
 * import { EndpointBinding, PolicySnapshot } from "@beep/repo-cli/test/AgentMessage"
 * import { ModelId } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(EndpointBinding)(EndpointBinding.make({ endpointId: "reviewer", participantId: "agent", sessionId: "session", ownerId: "owner", generation: 1, repositoryScope: "repo", capabilityFingerprint: "cap-v1", policyFingerprint: "policy-v1", supported: true, capabilityEvidence: [], policy: PolicySnapshot.make({ provider: "codex", modelId: ModelId.make("gpt-6.1-sol"), effort: "medium", sandbox: "read-only", approvalPolicy: "never", fingerprint: "policy-v1", policyEvidence: "effective-reported" }) }))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EndpointBinding extends S.Class<EndpointBinding>($I`EndpointBinding`)(
  {
    endpointId: Identity,
    participantId: Identity,
    sessionId: Identity,
    ownerId: Identity,
    generation: S.Natural,
    repositoryScope: RepositoryScope,
    capabilityFingerprint: Fingerprint,
    policyFingerprint: Fingerprint,
    supported: S.Boolean,
    capabilityEvidence: S.Array(CapabilityEvidence).check(S.isMaxLength(16)),
    policy: PolicySnapshot,
    execution: EndpointExecutionRef.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    host: EndpointHostRef.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  },
  $I.annote("EndpointBinding", {
    description: "Owned endpoint enrollment scoped to a repository and fenced by the current lifecycle generation.",
  })
) {}

/**
 * Direct endpoint destination or explicitly unsupported role selector in the first production slice.
 *
 * **Example** (Validate a router value)
 *
 * ```ts
 * import { MessageTarget } from "@beep/repo-cli/test/AgentMessage"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MessageTarget)({ kind: "direct", endpointId: "reviewer" })) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MessageTarget = LiteralKit(["direct", "role"])
  .toTaggedUnion("kind")({
    direct: { endpointId: Identity },
    role: { roleId: Identity },
  })
  .pipe(
    $I.annoteSchema("MessageTarget", {
      description: "Direct endpoint destination or role selector requiring an explicit election policy.",
    })
  );

/** Destination derived from its runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type MessageTarget = typeof MessageTarget.Type;

/**
 * Immutable send or reply payload; transactional acceptance additionally validates expiry and enrollment policy.
 *
 * **Example** (Validate a router value)
 *
 * ```ts
 * import { Envelope } from "@beep/repo-cli/test/AgentMessage"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(Envelope)(Envelope.make({ conversationId: "conversation-1", messageId: "m1", idempotencyKey: "request-1", from: "sender", to: { kind: "direct", endpointId: "reviewer" }, repositoryScope: "repo", body: "Please review", createdAt: 100, expiresAt: 200, capabilityFingerprint: "cap-v1", policyFingerprint: "policy-v1" }))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Envelope extends S.Class<Envelope>($I`Envelope`)(
  {
    schemaVersion: S.Literal("agent-message/v1").pipe(
      S.withDecodingDefaultKey(Effect.succeed<"agent-message/v1">("agent-message/v1")),
      S.withConstructorDefault(Effect.succeed<"agent-message/v1">("agent-message/v1"))
    ),
    conversationId: Identity,
    requestedMode: S.Literal("queued").pipe(
      S.withDecodingDefaultKey(Effect.succeed<"queued">("queued")),
      S.withConstructorDefault(Effect.succeed<"queued">("queued"))
    ),
    messageId: Identity,
    idempotencyKey: Identity,
    from: Identity,
    to: MessageTarget,
    repositoryScope: RepositoryScope,
    body: Body,
    createdAt: S.Natural,
    expiresAt: S.Natural,
    replyTo: OptionalIdentity,
    capabilityFingerprint: Fingerprint,
    policyFingerprint: Fingerprint,
  },
  $I.annote("Envelope", {
    description:
      "Immutable send or reply payload; transactional acceptance additionally validates expiry and enrollment policy.",
  })
) {}

/**
 * Ordered append-only delivery evidence with attempt fencing and bounded optional diagnostic context.
 *
 * **Example** (Validate a router value)
 *
 * ```ts
 * import { Receipt } from "@beep/repo-cli/test/AgentMessage"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(Receipt)(Receipt.make({ sequence: 1, messageId: "m1", status: "ambiguous", at: 100, attemptGeneration: 1 }))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Receipt extends S.Class<Receipt>($I`Receipt`)(
  {
    sequence: S.Natural,
    messageId: Identity,
    status: ReceiptStatus,
    at: S.Natural,
    attemptGeneration: S.Natural,
    owner: OptionalIdentity,
    detail: OptionalDetail,
  },
  $I.annote("Receipt", {
    description: "Ordered append-only delivery evidence with attempt fencing and bounded optional diagnostic context.",
  })
) {}

/**
 * Exclusive bounded delivery lease; completion compares owner and generation atomically.
 *
 * **Example** (Validate a router value)
 *
 * ```ts
 * import { Claim, Envelope } from "@beep/repo-cli/test/AgentMessage"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(Claim)(Claim.make({ envelope: Envelope.make({ conversationId: "conversation-1", messageId: "m1", idempotencyKey: "request-1", from: "sender", to: { kind: "direct", endpointId: "reviewer" }, repositoryScope: "repo", body: "Please review", createdAt: 100, expiresAt: 200, capabilityFingerprint: "cap-v1", policyFingerprint: "policy-v1" }), ownerId: "owner", generation: 1, leaseUntil: 150 }))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Claim extends S.Class<Claim>($I`Claim`)(
  {
    envelope: Envelope,
    ownerId: Identity,
    generation: S.Natural,
    leaseUntil: S.Natural,
  },
  $I.annote("Claim", {
    description: "Exclusive bounded delivery lease; completion compares owner and generation atomically.",
  })
) {}

/**
 * Trusted host enrollment authority with optional conversation scope and persisted recipient scope, expiry and atomic message budget; never a payload secret.
 *
 * **Example** (Validate a router value)
 *
 * ```ts
 * import { LaunchGrant } from "@beep/repo-cli/test/AgentMessage"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(LaunchGrant)({ grantId: "g1", endpointId: "sender", generation: 1, ownerId: "owner", repositoryScope: "repo", allowedRecipients: ["reviewer"], expiresAt: 200, maxMessages: 5 })) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LaunchGrant extends S.Class<LaunchGrant>($I`LaunchGrant`)(
  {
    grantId: Identity,
    endpointId: Identity,
    generation: S.Natural,
    ownerId: Identity,
    repositoryScope: RepositoryScope,
    conversationScope: OptionalIdentity,
    allowedRecipients: S.Array(Identity).check(S.isMinLength(1), S.isMaxLength(64)),
    expiresAt: S.Natural,
    maxMessages: S.Int.check(S.isGreaterThan(0), S.isLessThanOrEqualTo(1000)),
  },
  $I.annote("LaunchGrant", {
    description:
      "Trusted host enrollment authority with optional conversation scope and persisted recipient scope, expiry and atomic message budget; never a payload secret.",
  })
) {}

/**
 * Typed router failure preserving a bounded diagnostic message.
 *
 * **Example** (Validate a router value)
 *
 * ```ts
 * import { RouterError } from "@beep/repo-cli/test/AgentMessage"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(RouterError)(RouterError.make({ code: "policyMismatch", message: "effective policy changed" }))) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RouterError extends S.TaggedError<RouterError>($I`RouterError`)(
  "RouterError",
  { code: RouterErrorCode, message: Detail },
  $I.annoteError<RouterError>("RouterError", {
    description: "A durable router operation failed its policy or transaction boundary.",
  })
) {}
