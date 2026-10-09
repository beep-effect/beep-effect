/**
 * Owned Codex launch and policy negotiation.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ManagedSessionIdentity } from "./AiProviderCliSession.models.ts";
import { failure } from "./AiProviderCliSession.profile.service.ts";
import { CodexStart } from "./AiProviderCliSession.wire.models.ts";
import type { ManagedSessionError } from "./AiProviderCliSession.errors.ts";
import type { ManagedLaunchProfile } from "./AiProviderCliSession.models.ts";
/**
 * Pins the Codex model and reasoning effort for the owned app-server process.
 *
 * **Example** (Inspect the model pin)
 * ```ts
 * import { codexArguments } from "../../src/AiProviderCliSession.codex.service.ts"
 * import * as A from "effect/Array"
 * console.log(A.contains(codexArguments, "gpt-6.1-sol")) // true
 * ```
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export const codexArguments = [
  "--model",
  "gpt-6.1-sol",
  "-c",
  'model_reasoning_effort="medium"',
  "app-server",
  "--listen",
  "stdio://",
];
/**
 * Initializes an owned Codex thread and verifies the returned model and permission policy.
 *
 * **Example** (Verify a synthetic policy readback)
 * ```ts
 * import { negotiateCodex } from "../../src/AiProviderCliSession.codex.service.ts"
 * import * as Effect from "effect/Effect"
 * import { ManagedLaunchProfile } from "@beep/ai-provider-cli"
 * const profile = ManagedLaunchProfile.make({
 *   provider: "codex", executable: "codex", prefixArgs: [],
 *   workspace: "/owned/workspace", profileRoot: "/owned/profile",
 *   env: { HOME: "/owned/profile" }, authLane: "existing-subscription", tools: []
 * })
 * const readback = {
 *   thread: { id: "owned-thread" }, model: "gpt-6.1-sol", reasoningEffort: "medium",
 *   approvalPolicy: "never", sandbox: { type: "readOnly", networkAccess: false }
 * }
 * const identity = Effect.runSync(negotiateCodex(profile, () => Effect.succeed(readback), Effect.void))
 * console.log(identity.policyEvidence) // runtime-reported
 * ```
 * @internal
 * @category protocols
 * @since 0.0.0
 */
export const negotiateCodex = Effect.fn("ManagedCodex.negotiate")(function* (
  profile: ManagedLaunchProfile,
  request: (method: string, payload: unknown) => Effect.Effect<unknown, ManagedSessionError>,
  initialized: Effect.Effect<void, ManagedSessionError>
) {
  yield* request("initialize", {
    clientInfo: { name: "beep-managed-session", version: "1" },
    capabilities: { experimentalApi: true },
  });
  yield* initialized;
  const start = yield* request("thread/start", {
    model: "gpt-6.1-sol",
    allowProviderModelFallback: false,
    cwd: profile.workspace,
    sandbox: "read-only",
    approvalPolicy: "never",
    ephemeral: false,
    environments: [],
    dynamicTools: [],
    config: { model_reasoning_effort: "medium" },
  });
  const verified = yield* S.decodeUnknownEffect(CodexStart)(start).pipe(
    Effect.mapError(() =>
      failure.make("open", "policy-mismatch", "Codex effective model, effort or permissions failed verification")
    )
  );
  return ManagedSessionIdentity.make({
    provider: "codex",
    sessionId: verified.thread.id,
    model: verified.model,
    effort: "medium",
    policy: "never/read-only/network-disabled",
    policyEvidence: "runtime-reported",
  });
});
