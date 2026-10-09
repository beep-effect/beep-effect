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
 * Provider-specific launch and identity boundary.
 * @internal
 * @category internals
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
 * Provider-specific launch and identity boundary.
 * @internal
 * @category internals
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
