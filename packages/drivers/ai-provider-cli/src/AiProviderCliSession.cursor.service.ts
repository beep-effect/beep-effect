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
 * Verifies the Cursor session model readback while recording permission policy as launch enforced.
 *
 * **Example** (Verify a synthetic Cursor identity)
 * ```ts
 * import { verifyCursor } from "../../src/AiProviderCliSession.cursor.service.ts"
 * import * as Effect from "effect/Effect"
 * const identity = Effect.runSync(verifyCursor({ sessionId: "owned-cursor", models: { currentModelId: "claude-opus-5-5[context=300k,effort=medium,fast=false]" } }))
 * console.log(identity.model) // claude-opus-5-5
 * ```
 * @internal
 * @category validation
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
 * Builds Cursor ACP arguments with an explicit workspace, model, ask mode and sandbox.
 *
 * **Example** (Inspect the owned workspace)
 * ```ts
 * import { cursorArguments } from "../../src/AiProviderCliSession.cursor.service.ts"
 * import * as A from "effect/Array"
 * console.log(A.contains(cursorArguments("/owned/workspace"), "/owned/workspace")) // true
 * ```
 * @internal
 * @category configuration
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
