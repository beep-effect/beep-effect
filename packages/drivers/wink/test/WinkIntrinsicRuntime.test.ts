import { it } from "@beep/test-runner";
import { WinkIntrinsicNounRequest } from "@beep/wink";
import { constructWinkWithIntrinsicOwner } from "@beep/wink/test";
import { assert, describe } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import model from "wink-eng-lite-web-model";
import winkNLP from "wink-nlp";

const request = WinkIntrinsicNounRequest.make({ rawForm: "joint", remainingWork: 262_144 });

// Replaces the owner's private activated cache with a synthetic vendor handle,
// so the decode and failure paths behind the pinned SDK can be driven directly.
const injectCache = (owner: object, cache: { readonly hasSamePOS: unknown; readonly isOOV: unknown }) =>
  Reflect.set(owner, "cache", O.some(cache));

const failureReason = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.result(effect).pipe(
    Effect.map((result) =>
      Result.isFailure(result) && P.hasProperty(result.failure, "reason") && P.isString(result.failure.reason)
        ? O.some(result.failure.reason)
        : O.none<string>()
    )
  );

describe("WinkIntrinsicOwner guards every path before and after activation", () => {
  it.effect("reports a released membership owner when queried before activation", () =>
    Effect.gen(function* () {
      const { owner } = yield* constructWinkWithIntrinsicOwner(winkNLP, model);
      owner.setCurrent(Effect.succeed(true));
      const reason = yield* failureReason(owner.query(request));
      assert.deepStrictEqual(reason, O.some("released"));
    })
  );

  it.effect("treats a missing current-engine check as a replaced engine", () =>
    Effect.gen(function* () {
      const { owner } = yield* constructWinkWithIntrinsicOwner(winkNLP, model);
      yield* owner.activate;
      const reason = yield* failureReason(owner.query(request));
      assert.deepStrictEqual(reason, O.some("engine-replaced"));
    })
  );

  it.effect("refuses an unchecked invalid request", () =>
    Effect.gen(function* () {
      const { owner } = yield* constructWinkWithIntrinsicOwner(winkNLP, model);
      const invalid = WinkIntrinsicNounRequest.make({ rawForm: "", remainingWork: 1 }, { disableChecks: true });
      const reason = yield* failureReason(owner.query(invalid));
      assert.deepStrictEqual(reason, O.some("invalid-request"));
    })
  );

  it.effect("maps a throwing vendor membership call to query-failed", () =>
    Effect.gen(function* () {
      const { owner } = yield* constructWinkWithIntrinsicOwner(winkNLP, model);
      yield* owner.activate;
      owner.setCurrent(Effect.succeed(true));
      injectCache(owner, {
        hasSamePOS: () => {
          throw new Error("synthetic vendor failure");
        },
        isOOV: () => false,
      });
      const reason = yield* failureReason(owner.query(request));
      assert.deepStrictEqual(reason, O.some("query-failed"));
    })
  );

  it.effect("maps an undecodable vendor membership result to query-failed", () =>
    Effect.gen(function* () {
      const { owner } = yield* constructWinkWithIntrinsicOwner(winkNLP, model);
      yield* owner.activate;
      owner.setCurrent(Effect.succeed(true));
      injectCache(owner, { hasSamePOS: () => "yes", isOOV: () => false });
      const reason = yield* failureReason(owner.query(request));
      assert.deepStrictEqual(reason, O.some("query-failed"));
    })
  );

  it.effect("refuses activation after the owning scope released", () =>
    Effect.gen(function* () {
      const { owner } = yield* constructWinkWithIntrinsicOwner(winkNLP, model);
      yield* owner.release;
      const reason = yield* failureReason(owner.activate);
      assert.deepStrictEqual(reason, O.some("core-owner"));
    })
  );

  it.effect("refuses activation when the owning scope releases while the cache is built", () =>
    Effect.gen(function* () {
      const baseCore = model.core;
      assert.strictEqual(P.isFunction(baseCore), true);
      if (!P.isFunction(baseCore)) return;
      let owner = O.none<object>();
      let released = false;
      // The pinned cache factory reads the captured core synchronously; marking the
      // owner inactive on that read lands between the pre-check and the post-build check.
      const releasingModel = {
        ...model,
        core: () =>
          new Proxy(baseCore(), {
            get: (target, key, receiver) => {
              if (key === "features" && !released && O.isSome(owner)) {
                released = true;
                Reflect.set(owner.value, "active", false);
              }
              return Reflect.get(target, key, receiver);
            },
          }),
      };
      const constructed = yield* constructWinkWithIntrinsicOwner(winkNLP, releasingModel);
      owner = O.some(constructed.owner);
      const reason = yield* failureReason(constructed.owner.activate);
      assert.strictEqual(released, true);
      assert.deepStrictEqual(reason, O.some("core-owner"));
    })
  );

  it.effect("returns the captured core when the engine asks for it twice, then refuses the owner", () =>
    Effect.gen(function* () {
      let cores: ReadonlyArray<unknown> = [];
      const twiceEngine: typeof winkNLP = (adapter, ...rest) => {
        const core = adapter.core;
        if (P.isFunction(core)) cores = [core(), core()];
        return winkNLP(model, ...rest);
      };
      const reason = yield* failureReason(constructWinkWithIntrinsicOwner(twiceEngine, model));
      assert.strictEqual(cores.length, 2);
      assert.strictEqual(cores[0], cores[1]);
      assert.deepStrictEqual(reason, O.some("core-owner"));
    })
  );
});
