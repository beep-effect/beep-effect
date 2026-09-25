import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";
import {
  ChatFirstE2EAdvanceRequest,
  ChatFirstE2EControlEndpointMode,
  ChatFirstE2EExpectedShell,
  ChatFirstE2EFixtureCase,
  ChatFirstE2EFixtureSnapshot,
  ChatFirstE2EPrepareRequest,
} from "../../beep/ChatFirstE2e.ts";

const decodeChatFirstE2EPrepareRequest = S.decodeUnknownEffect(ChatFirstE2EPrepareRequest);

const decode = <A>(schema: S.ConstraintDecoder<A>, input: unknown): A =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.ConstraintDecoder<unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

describe("ChatFirstE2e", () => {
  it("decodes fixture cases and rejects an out-of-range advance", () => {
    expect(decode(ChatFirstE2EPrepareRequest, { fixtureCase: "question" }).fixtureCase).toBe("question");
    expect(decode(ChatFirstE2EAdvanceRequest, { seconds: 1 }).seconds).toBe(1);
    expect(decodeFails(ChatFirstE2EAdvanceRequest, { seconds: 0 })).toBe(true);
    const snapshot = decode(ChatFirstE2EFixtureSnapshot, {
      fixtureCase: "cold_start",
      fixtureRevision: 1,
      expectedShell: "chat_first",
      controlEndpointMode: "reachable",
      advancedSeconds: 0,
      materializedIntentCount: 0,
      readyIntentCount: 0,
      proactiveIntentCount: 0,
      pendingDeferralCount: 0,
    });
    expect(snapshot.expectedShell).toBe("chat_first");
    const excess: unknown = { fixtureCase: "question", extra: true };
    expect(
      Effect.runSyncExit(decodeChatFirstE2EPrepareRequest(excess, { onExcessProperty: "error" }))._tag,
    ).toBe("Failure");
  });

  it("derives arbitraries", () => {
    for (const schema of [
      ChatFirstE2EFixtureCase,
      ChatFirstE2EControlEndpointMode,
      ChatFirstE2EExpectedShell,
      ChatFirstE2EPrepareRequest,
      ChatFirstE2EAdvanceRequest,
      ChatFirstE2EFixtureSnapshot,
    ]) {
      expect(Arbitrary.schema(schema)).toBeTruthy();
    }
  });
});
