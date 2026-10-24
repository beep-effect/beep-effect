import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import {
  UnstubbedAccess,
  UnstubbedMember,
  UnstubbedMemberError,
  UnstubbedTarget,
  unstubbed,
  unstubbedFor,
  unstubbedShapeFor,
} from "@beep/utils/TestDouble";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

describe("TestDouble", () => {
  it.effect.prop(
    "UnstubbedMemberError decodes its encoded tag and message",
    [Arbitrary.schema(UnstubbedMemberError)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(UnstubbedMemberError)(value);
        const decoded = yield* S.decodeEffect(UnstubbedMemberError)(encoded);
        assert.strictEqual(decoded._tag, value._tag);
        assert.strictEqual(decoded.message, value.message);
      }),
    { arbitrary: fcRuns(100) }
  );

  it.effect("an unstubbed member dies naming the double, the member and its override", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(unstubbed("Cache")("save"));
      const expected = Cause.die(
        UnstubbedMemberError.make({
          message: "Cache: save() was called but not stubbed — pass a `save` override.",
        })
      );
      assertExitFailure(exit, expected);
    })
  );

  it("an unstubbed thrower names the service, the member and the default hint", () => {
    assert.throws(
      () => unstubbedFor({ service: "CheckRun" })("create"),
      "CheckRun.makeTest: create() was called but not stubbed — pass an override."
    );
  });

  it("a read-access thrower with a hint reports the member as read", () => {
    const thrower = unstubbedFor({ service: "Repository", access: "read", hint: "pass `settings`" });
    try {
      thrower("settings");
      assert.fail("expected the thrower to throw");
    } catch (error) {
      assert.instanceOf(error, UnstubbedMemberError);
      assert.strictEqual(error.message, "Repository.makeTest: settings was read but not stubbed — pass `settings`.");
    }
  });

  it.effect("an unstubbed shape throws for call members and dies for effect members", () =>
    Effect.gen(function* () {
      interface CacheShape {
        readonly save: (key: string) => Effect.Effect<void>;
        readonly size: Effect.Effect<number>;
      }
      const cache = unstubbedShapeFor({ service: "Cache" })<CacheShape>({ save: "call", size: "effect" });
      assert.throws(() => cache.save("k"), "Cache.makeTest: save() was called but not stubbed — pass an override.");
      const exit = yield* Effect.exit(cache.size);
      assertExitFailure(
        exit,
        Cause.die(
          UnstubbedMemberError.make({
            message: "Cache.makeTest: size() was called but not stubbed — pass an override.",
          })
        )
      );
    })
  );

  it("the access and member kinds and the target decode their literal domains", () => {
    assert.isTrue(S.is(UnstubbedAccess)("called"));
    assert.isFalse(S.is(UnstubbedAccess)("written"));
    assert.isTrue(S.is(UnstubbedMember)("call"));
    assert.isFalse(S.is(UnstubbedMember)("value"));
    const target = UnstubbedTarget.make({ service: "Cache", access: "read" });
    assert.strictEqual(target.access, "read");
  });
});
