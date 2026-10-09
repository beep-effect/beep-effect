/**
 * Private managed session implementation.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ManagedSessionIdentity } from "./AiProviderCliSession.models.ts";
import { failure } from "./AiProviderCliSession.profile.service.ts";
import { GrokIdentity } from "./AiProviderCliSession.wire.models.ts";

/**
 * Verifies Grok model and effort readback and binds the declared sandbox policy hash.
 *
 * **Example** (Verify a synthetic Grok identity)
 * ```ts
 * import { verifyGrok } from "../../src/AiProviderCliSession.grok.service.ts"
 * import * as Effect from "effect/Effect"
 * const identity = Effect.runSync(verifyGrok({ sessionId: "owned-grok", models: { currentModelId: "grok-4.7" }, configOptions: [{ id: "reasoning_effort", currentValue: "medium" }] }, "synthetic-policy-hash"))
 * console.log(identity.effort) // medium
 * ```
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const verifyGrok = Effect.fn("ManagedGrok.verifyIdentity")(function* (started: unknown, sandboxHash: string) {
  const verified = yield* S.decodeUnknownEffect(GrokIdentity)(started).pipe(
    Effect.mapError(() =>
      failure.make("open", "policy-mismatch", "Grok effective model configuration failed verification")
    )
  );
  if (!A.some(verified.configOptions, (option) => option.id === "reasoning_effort" && option.currentValue === "medium"))
    return yield* failure.make("open", "policy-mismatch", "Grok effective reasoning effort failed verification");
  return ManagedSessionIdentity.make({
    provider: "grok",
    sessionId: verified.sessionId,
    model: verified.models.currentModelId,
    effort: "medium",
    policy: `plan/ro;tools=search,use;mcp=allow_once;rw-sha256:${sandboxHash}`,
    policyEvidence: "launch-enforced",
  });
});

/**
 * Pins Grok ACP launch policy to the named sandbox and the two MCP mediator tools.
 *
 * **Example** (Inspect the mediator whitelist)
 * ```ts
 * import { grokArguments } from "../../src/AiProviderCliSession.grok.service.ts"
 * import * as A from "effect/Array"
 * console.log(A.contains(grokArguments, "search_tool,use_tool")) // true
 * ```
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export const grokArguments = [
  "--tools",
  "search_tool,use_tool",
  "--no-subagents",
  "--disable-web-search",
  "--permission-mode",
  "plan",
  "--sandbox",
  "beep-messaging",
  "agent",
  "--no-leader",
  "-m",
  "grok-4.7",
  "--effort",
  "medium",
  "stdio",
];
