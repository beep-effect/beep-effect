/**
 * Bounded contracts for the local durable agent message router.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { ManagedTerminalEvidence } from "@beep/ai-provider-cli";
import { EffortLevel, ModelId } from "@beep/ai-sync/ModelCatalog.schemas";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

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

/**
 * Provider that owns a registered endpoint; injected is reserved for deterministic tests.
 *
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

/**
 * Operation whose behavior was checked on an endpoint transport.
 *
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

/**
 * Capability evidence: advertised means handshake support without context-consumption proof; verified requires observed operation evidence.
 *
 * @category type-level
 * @since 0.0.0
 */
export type EvidenceDisposition = typeof EvidenceDisposition.Type;

/**
 * Durable lifecycle fact; terminal delivery is adapter-confirmed or operator-asserted in an audit, and ambiguity forbids blind retry.
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
    description:
      "Durable lifecycle fact; terminal delivery is adapter-confirmed or operator-asserted in an audit, and ambiguity forbids blind retry.",
  })
);

/**
 * Durable lifecycle fact; terminal delivery is adapter-confirmed or operator-asserted in an audit, and ambiguity forbids blind retry.
 *
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

/**
 * Failure classification for transactional routing and enrollment checks.
 *
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
export class CapabilityEvidence extends S.Opaque<CapabilityEvidence, { readonly brand: unique symbol }>()(
  S.Struct({
    capability: Capability,
    disposition: EvidenceDisposition,
    source: S.NonEmptyString.check(S.isMaxLength(512)),
    observedAt: S.Natural,
  }).pipe(
    $I.annoteSchema("CapabilityEvidence", {
      description:
        "Bounded receipt provenance for one capability; source references sanitized evidence rather than secrets.",
    })
  )
) {}

/**
 * Explicit launch policy with evidence distinguishing runtime reports from enforced arguments.
 *
 * **Example** (Validate a router value)
 *
 * ```ts
 * import { PolicySnapshot } from "@beep/repo-cli/test/AgentMessage"
 * import { ModelId } from "@beep/ai-sync/ModelCatalog.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PolicySnapshot)(PolicySnapshot.make({ provider: "codex", modelId: ModelId.make("gpt-6.1-sol"), effort: "medium", sandbox: "read-only", approvalPolicy: "never", fingerprint: "policy-v1", policyEvidence: "effective-reported" }))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PolicySnapshot extends S.Opaque<PolicySnapshot, { readonly brand: unique symbol }>()(
  S.Struct({
    provider: Provider,
    modelId: ModelId.check(S.isMaxLength(128)),
    effort: EffortLevel,
    sandbox: PolicyValue,
    approvalPolicy: PolicyValue,
    fingerprint: Fingerprint,
    policyEvidence: S.Literals(["effective-reported", "launch-enforced", "unverified"]),
  }).pipe(
    $I.annoteSchema("PolicySnapshot", {
      description: "Explicit launch policy with evidence distinguishing runtime reports from enforced arguments.",
    })
  )
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
export class EndpointExecutionRef extends S.Opaque<EndpointExecutionRef, { readonly brand: unique symbol }>()(
  S.Struct({
    workspace: RepositoryScope,
    lane: OptionalIdentity,
    runId: OptionalIdentity,
    turnId: OptionalIdentity,
  }).pipe(
    $I.annoteSchema("EndpointExecutionRef", {
      description:
        "Host-resolved canonical workspace and optional independently observed lane, run and turn references.",
    })
  )
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

/**
 * Surface derived from its runtime schema.
 *
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
export class EndpointHostRef extends S.Opaque<EndpointHostRef, { readonly brand: unique symbol }>()(
  S.Struct({
    mode: EndpointHostMode,
    provider: Provider,
    backend: PolicyValue,
    hostId: OptionalIdentity,
    appId: OptionalIdentity,
  }).pipe(
    $I.annoteSchema("EndpointHostRef", {
      description:
        "Session-owning surface, provider and backend with optional observed host and application references.",
    })
  )
) {}

/**
 * Owned endpoint enrollment scoped to a repository and fenced by the current lifecycle generation.
 *
 * **Example** (Validate a router value)
 *
 * ```ts
 * import { EndpointBinding, PolicySnapshot } from "@beep/repo-cli/test/AgentMessage"
 * import { ModelId } from "@beep/ai-sync/ModelCatalog.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(EndpointBinding)(EndpointBinding.make({ endpointId: "reviewer", participantId: "agent", sessionId: "session", ownerId: "owner", generation: 1, repositoryScope: "repo", capabilityFingerprint: "cap-v1", policyFingerprint: "policy-v1", supported: true, capabilityEvidence: [], policy: PolicySnapshot.make({ provider: "codex", modelId: ModelId.make("gpt-6.1-sol"), effort: "medium", sandbox: "read-only", approvalPolicy: "never", fingerprint: "policy-v1", policyEvidence: "effective-reported" }) }))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EndpointBinding extends S.Opaque<EndpointBinding, { readonly brand: unique symbol }>()(
  S.Struct({
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
  }).pipe(
    $I.annoteSchema("EndpointBinding", {
      description: "Owned endpoint enrollment scoped to a repository and fenced by the current lifecycle generation.",
    })
  )
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

/**
 * Destination derived from its runtime schema.
 *
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
export class Envelope extends S.Opaque<Envelope, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("agent-message/v1").pipe(
      S.withDecodingDefaultKey(Effect.succeed<"agent-message/v1">("agent-message/v1"))
    ),
    conversationId: Identity,
    requestedMode: S.tag("queued").pipe(S.withDecodingDefaultKey(Effect.succeed<"queued">("queued"))),
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
  }).pipe(
    $I.annoteSchema("Envelope", {
      description:
        "Immutable send or reply payload; transactional acceptance additionally validates expiry and enrollment policy.",
    })
  )
) {}

/**
 * Ordered append-only delivery evidence with attempt fencing and bounded context for adapter-confirmed or audited operator-asserted terminal results.
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
export class Receipt extends S.Opaque<Receipt, { readonly brand: unique symbol }>()(
  S.Struct({
    sequence: S.Natural,
    messageId: Identity,
    status: ReceiptStatus,
    at: S.Natural,
    attemptGeneration: S.Natural,
    owner: OptionalIdentity,
    detail: OptionalDetail,
  }).pipe(
    $I.annoteSchema("Receipt", {
      description:
        "Ordered append-only delivery evidence with attempt fencing and bounded context for adapter-confirmed or audited operator-asserted terminal results.",
    })
  )
) {}

/**
 * Known native terminal outcome asserted by a trusted local operator.
 *
 * **Example** (Validate a terminal disposition)
 *
 * ```ts
 * import { AmbiguityDisposition } from "@beep/repo-cli/test/AgentMessage"
 * import * as S from "effect/Schema"
 * console.log(S.is(AmbiguityDisposition)("delivered")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AmbiguityDisposition = LiteralKit(["delivered", "failed"]).pipe(
  $I.annoteSchema("AmbiguityDisposition", {
    description: "Explicit evidence-backed known native terminal outcome; abandonment is not a disposition.",
  })
);

/**
 * Terminal disposition derived from its runtime schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export type AmbiguityDisposition = typeof AmbiguityDisposition.Type;

const InjectedRuntimeEvidence = LiteralKit(["injected"])
  .toTaggedUnion("adapter")({
    injected: { sessionId: Identity, terminalId: Identity, outcome: AmbiguityDisposition, source: Detail },
  })
  .pipe(
    $I.annoteSchema("InjectedRuntimeEvidence", {
      description:
        "Original terminal evidence from a deterministic injected adapter, reserved for synthetic qualification.",
    })
  );

/**
 * Original terminal evidence accepted only when the runtime already persisted it.
 *
 * **Example** (Inspect a synthetic terminal record)
 * ```ts
 * import { OriginalRuntimeEvidence } from "@beep/repo-cli/commands/AgentMessage"
 * import * as S from "effect/Schema"
 * console.log(S.is(OriginalRuntimeEvidence)({ adapter: "injected", sessionId: "session", terminalId: "terminal", outcome: "failed", source: "Synthetic original settlement" }))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const OriginalRuntimeEvidence = S.Union([ManagedTerminalEvidence, InjectedRuntimeEvidence]).pipe(
  $I.annoteSchema("OriginalRuntimeEvidence", {
    description:
      "Adapter-correlated original settlement or explicit deterministic fixture evidence; neither model text nor an operator assertion can create native proof.",
  })
);

/**
 * Original evidence derived from its runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type OriginalRuntimeEvidence = typeof OriginalRuntimeEvidence.Type;

/**
 * Immutable operator assertion identifying the original ambiguous attempt and its known terminal evidence.
 *
 * **Details**
 *
 * The trusted local operator supplies evidence of a known native terminal result. This request
 * releases a dispatch hold without retrying the provider or discarding participant acknowledgement.
 * Its adapter and original session must match enrollment; its outcome must match disposition.
 * Its complete evidence must equal the immutable original settlement previously
 * recorded by the trusted adapter. Missing original proof cannot be supplied by
 * an operator assertion. The host authenticates through private state and input-file
 * ownership; operatorId is an audit label. The full payload remains in the durable audit.
 *
 * **Example** (Record a known terminal result)
 *
 * ```ts
 * import { AmbiguityResolution } from "@beep/repo-cli/test/AgentMessage"
 * const request = AmbiguityResolution.make({ resolutionId: "resolve-1", messageId: "m1", endpointId: "peer", endpointGeneration: 1, attemptGeneration: 1, attemptOwnerId: "owner", operatorId: "operator", disposition: "delivered", evidence: "Owned session terminal receipt", runtimeEvidence: { adapter: "codex", sessionId: "original-session", messageId: "m1", turnId: "original-turn", outcome: "delivered", stopReason: "completed" }, reason: "Confirmed original attempt completed" })
 * console.log(request.disposition) // delivered
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AmbiguityResolution extends S.Opaque<AmbiguityResolution, { readonly brand: unique symbol }>()(
  S.Struct({
    resolutionId: Identity,
    messageId: Identity,
    endpointId: Identity,
    endpointGeneration: S.Natural,
    attemptGeneration: S.Natural,
    attemptOwnerId: Identity,
    operatorId: Identity,
    disposition: AmbiguityDisposition,
    evidence: Detail,
    runtimeEvidence: OriginalRuntimeEvidence,
    reason: Detail,
  }).pipe(
    $I.annoteSchema("AmbiguityResolution", {
      description: "Trusted operator assertion of a known terminal outcome, fenced to the original ambiguous attempt.",
    })
  )
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
export class Claim extends S.Opaque<Claim, { readonly brand: unique symbol }>()(
  S.Struct({
    envelope: Envelope,
    ownerId: Identity,
    generation: S.Natural,
    leaseUntil: S.Natural,
  }).pipe(
    $I.annoteSchema("Claim", {
      description: "Exclusive bounded delivery lease; completion compares owner and generation atomically.",
    })
  )
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
export class LaunchGrant extends S.Opaque<LaunchGrant, { readonly brand: unique symbol }>()(
  S.Struct({
    grantId: Identity,
    endpointId: Identity,
    generation: S.Natural,
    ownerId: Identity,
    repositoryScope: RepositoryScope,
    conversationScope: OptionalIdentity,
    allowedRecipients: S.Array(Identity).check(S.isMinLength(1), S.isMaxLength(64)),
    expiresAt: S.Natural,
    maxMessages: S.Int.check(S.isGreaterThan(0), S.isLessThanOrEqualTo(1000)),
  }).pipe(
    $I.annoteSchema("LaunchGrant", {
      description:
        "Trusted host enrollment authority with optional conversation scope and persisted recipient scope, expiry and atomic message budget; never a payload secret.",
    })
  )
) {}

/**
 * Check the direct destination, repository and conversation shared by both receiving modes.
 *
 * **Details**
 * Managed receivers use this scope without an inbound peer allowlist. Attached
 * receivers additionally require the sender in `allowedRecipients`.
 *
 * **Example** (Recognize the receive scope predicate)
 * ```ts
 * import { Envelope, LaunchGrant, receivingGrantAllowsEnvelopeScope } from "@beep/repo-cli/commands/AgentMessage"
 * const grant = LaunchGrant.make({ grantId: "grant", endpointId: "receiver", ownerId: "owner", generation: 1,
 *   repositoryScope: "repo", allowedRecipients: ["peer"], expiresAt: 200, maxMessages: 1 })
 * const envelope = Envelope.make({ conversationId: "conversation", messageId: "message", idempotencyKey: "request",
 *   from: "sender", to: { kind: "direct", endpointId: "receiver" }, repositoryScope: "repo", body: "Hello",
 *   createdAt: 100, expiresAt: 200, capabilityFingerprint: "cap", policyFingerprint: "policy" })
 * console.log(receivingGrantAllowsEnvelopeScope(grant, envelope)) // true; managed receive does not check allowedRecipients
 * ```
 *
 * @internal
 * @param grant - The persisted authority of the receiving endpoint.
 * @param envelope - The queued message awaiting delivery.
 * @returns Whether the message matches the common receiving scope.
 * @category policies
 * @since 0.0.0
 */
export const receivingGrantAllowsEnvelopeScope: {
  (grant: LaunchGrant, envelope: Envelope): boolean;
  (envelope: Envelope): (grant: LaunchGrant) => boolean;
} = dual(
  2,
  (grant: LaunchGrant, envelope: Envelope): boolean =>
    envelope.to.kind === "direct" &&
    envelope.to.endpointId === grant.endpointId &&
    envelope.repositoryScope === grant.repositoryScope &&
    (O.isNone(grant.conversationScope) || envelope.conversationId === grant.conversationScope.value)
);

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
export class RouterError extends S.TaggedError<RouterError, { readonly brand: unique symbol }>($I`RouterError`)(
  "RouterError",
  { code: RouterErrorCode, message: Detail },
  $I.annoteError<RouterError>("RouterError", {
    description: "A durable router operation failed its policy or transaction boundary.",
  })
) {}
