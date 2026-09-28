import { SessionChangeRejected, SessionId } from "@beep/ontology-domain/aggregates/Session";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { pipe } from "effect";
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

    pipe(same(first, second), assertTrue);
    pipe(same(first, different), assertFalse);
  });
});
