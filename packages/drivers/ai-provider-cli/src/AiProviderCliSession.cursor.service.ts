/**
 * Private managed session implementation.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ManagedSessionIdentity } from "./AiProviderCliSession.models.ts";
import { failure } from "./AiProviderCliSession.profile.service.ts";
import { CursorIdentity } from "./AiProviderCliSession.wire.models.ts";

/**
 * Private implementation boundary used by the managed session facade.
 * @internal
 * @category internals
 * @since 0.0.0
 */
export const verifyCursor = Effect.fn("ManagedCursor.verifyIdentity")(function* (started: unknown) {
  const verified = yield* S.decodeUnknownEffect(CursorIdentity)(started).pipe(
    Effect.mapError(() =>
      failure.make("open", "policy-mismatch", "Cursor effective model configuration failed verification")
    )
  );
  const sessionId = verified.sessionId;
  return ManagedSessionIdentity.make({
    provider: "cursor",
    sessionId,
    model: "claude-opus-5-5",
    effort: "medium",
    policy: "ask/sandbox-enabled/host-callback-denials",
    policyEvidence: "launch-enforced",
  });
});

/**
 * Provider-specific launch and identity boundary.
 * @internal
 * @category internals
 * @since 0.0.0
 */
export const cursorArguments = (workspace: string) => [
  "--model",
  "claude-opus-5-5",
  "--mode",
  "ask",
  "--sandbox",
  "enabled",
  "--workspace",
  workspace,
  "acp",
];
