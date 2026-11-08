import { optionalDefect } from "@beep/schema/SchemaUtils/optionalDefect";
import { assert, describe, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const Failure = S.Struct({ code: S.String, cause: optionalDefect("Underlying transport failure.") });

describe("optional defect diagnostic identity", () => {
  it("defaults to absence and retains supplied causes without making them part of identity", () => {
    const absent = Failure.make({ code: "unavailable" });
    assert.isTrue(O.isNone(absent.cause));
    const original = new Error("first transport");
    const first = Failure.make({ code: "unavailable", cause: O.some(original) });
    const second = Failure.make({ code: "unavailable", cause: O.some(new Error("another transport")) });
    assert.strictEqual(O.getOrThrow(first.cause), original);
    const equivalent = S.toEquivalence(Failure);
    assert.isTrue(equivalent(first, second));
    assert.isFalse(equivalent(first, Failure.make({ code: "invalid", cause: first.cause })));
  });
});
