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
 * Private implementation boundary used by the managed session facade.
 * @internal
 * @category internals
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
 * Provider-specific launch and identity boundary.
 * @internal
 * @category internals
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
