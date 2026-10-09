/**
 * Explicit host enrollment for an existing T3-owned thread.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { T3CodeConfiguration } from "@beep/t3-code";
import * as S from "effect/Schema";
import { EndpointBinding, LaunchGrant } from "./AgentMessage.models.ts";

const $I = $RepoCliId.create("commands/AgentMessage/AgentMessage.attached.schemas");
const Text = S.NonEmptyString.check(S.isMaxLength(512));

/**
 * Dated independent observation, distinct from live MCP host configuration.
 * **Example** (Recognize a baseline)
 * ```ts
 * import { AttachedT3NativeBaseline } from "@beep/repo-cli/test/AgentMessage"
 * import * as S from "effect/Schema"
 * console.log(S.is(AttachedT3NativeBaseline)({ sessionId: "owned-native", policy: "never/full-access", observedAt: 1, source: "owned native record" }))
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class AttachedT3NativeBaseline extends S.Class<AttachedT3NativeBaseline>($I`AttachedT3NativeBaseline`)(
  { sessionId: Text, policy: Text, observedAt: S.Int.check(S.isGreaterThan(0)), source: Text },
  $I.annote("AttachedT3NativeBaseline", {
    description: "Host-supplied independent native observation; MCP does not verify it live.",
  })
) {}

/**
 * Private attachment declaration for one explicitly owned visible host thread.
 * **Details**
 * ownershipConfirmed is the trusted host declaration, not a discoverable app
 * ownership fact. The configuration is checked live; nativeBaseline remains a
 * dated independent attestation. peerExecutable is a host-issued fixed grant
 * wrapper, not an administrative beep entry point. This attached mode uses the
 * persisted grant allowedRecipients as an explicit symmetric peer allowlist: both
 * outbound destinations and inbound senders must be declared there.
 * **Example** (Inspect attachment fields)
 * ```ts
 * import { AttachedT3Profile } from "@beep/repo-cli/test/AgentMessage"
 * console.log(AttachedT3Profile.fields.ownershipConfirmed !== undefined) // true
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class AttachedT3Profile extends S.Class<AttachedT3Profile>($I`AttachedT3Profile`)(
  {
    ownershipConfirmed: S.Literal(true),
    threadId: Text,
    projectId: Text,
    workspace: Text,
    endpointId: EndpointBinding.fields.endpointId,
    participantId: EndpointBinding.fields.participantId,
    ownerId: EndpointBinding.fields.ownerId,
    generation: EndpointBinding.fields.generation,
    repositoryScope: EndpointBinding.fields.repositoryScope,
    provider: S.Literals(["codex", "claude"]),
    expectedConfiguration: T3CodeConfiguration,
    nativeBaseline: AttachedT3NativeBaseline,
    serverVersion: Text,
    sourceCommit: Text,
    artifactDigest: Text,
    url: Text,
    oauthCredentialFile: Text,
    grantFile: Text,
    peerExecutable: Text,
    waitTimeoutMs: S.Int.check(S.isBetween({ minimum: 1000, maximum: 120000 })),
    conversationId: LaunchGrant.fields.conversationScope,
  },
  $I.annote("AttachedT3Profile", {
    description: "Private explicit enrollment with exact live T3 configuration and separate native baseline.",
  })
) {}
