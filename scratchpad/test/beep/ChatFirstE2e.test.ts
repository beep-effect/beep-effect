import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
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

describe("ChatFirstE2e", () => {
  it("decodes fixture cases and rejects an out-of-range advance", () => {
    expect(Effect.runSync(S.decodeUnknownEffect(ChatFirstE2EPrepareRequest)({ fixtureCase: "question" })).fixtureCase).toBe(
      "question",
    );
    expect(Effect.runSync(S.decodeUnknownEffect(ChatFirstE2EAdvanceRequest)({ seconds: 1 })).seconds).toBe(1);
    expect(Effect.runSyncExit(S.decodeUnknownEffect(ChatFirstE2EAdvanceRequest)({ seconds: 0 }))._tag).toBe("Failure");
    const snapshot = Effect.runSync(
      S.decodeUnknownEffect(ChatFirstE2EFixtureSnapshot)({
        fixtureCase: "cold_start",
        fixtureRevision: 1,
        expectedShell: "chat_first",
        controlEndpointMode: "reachable",
        advancedSeconds: 0,
        materializedIntentCount: 0,
        readyIntentCount: 0,
        proactiveIntentCount: 0,
        pendingDeferralCount: 0,
      }),
    );
    expect(snapshot.expectedShell).toBe("chat_first");
    expect(Effect.runSyncExit(S.decodeUnknownEffect(ChatFirstE2EPrepareRequest)({ fixtureCase: "question", extra: true }, { onExcessProperty: "error" }))._tag).toBe(
      "Failure",
    );
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
