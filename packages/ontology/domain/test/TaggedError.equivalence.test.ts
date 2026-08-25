import { SessionChangeRejected, SessionId } from "@beep/ontology-domain/aggregates/Session";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

describe("ontology domain tagged-error declared equivalence", () => {
  it("compares SessionChangeRejected by declared fields", () => {
    const same = S.toEquivalence(SessionChangeRejected);
    const first = SessionChangeRejected.make({
      sessionId: SessionId.make("session-1"),
      reason: "invalidChange",
      message: "The change could not be applied.",
    });
    const second = SessionChangeRejected.make({
      sessionId: SessionId.make("session-1"),
      reason: "invalidChange",
      message: "The change could not be applied.",
    });
    const different = SessionChangeRejected.make({
      sessionId: SessionId.make("session-1"),
      reason: "invalidChange",
      message: "The change was rejected.",
    });

    expect(same(first, second)).toBe(true);
    expect(same(first, different)).toBe(false);
  });
});
