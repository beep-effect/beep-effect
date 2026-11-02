import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { CitationCleanerObject, CitationCleanerProduced } from "../src/internal/Citation/CleanerPipeline.ts";
import { CitationPythonUnicodeStorage } from "../src/internal/Citation/PythonHash.ts";
import { makeCitationCleanerRegistryHarness as setup } from "./CitationCleanerRegistry.fixtures.ts";

describe("live cleaner registry", () => {
  it.effect("dispatches native hashed names through real builtins without host hooks", () =>
    Effect.gen(function* () {
      const h = yield* setup();
      h.select(yield* Effect.forEach(["underscores", "all_whitespace"], h.values.text));
      const result = yield* h.pipeline.run({ text: "  a__   b  ", plan: "registered" });
      expect(O.getOrThrow(yield* h.values.getText(result.value)).text).toBe(" a b ");
      expect(yield* h.calls).toEqual([]);
      expect((yield* (yield* h.work).snapshot).closed).toBe(true);
    })
  );
  it.effect("hashes membership and lookup separately and preserves reentrant deletion", () =>
    Effect.gen(function* () {
      const h = yield* setup();
      const step = yield* h.values.retainHost("changing-key");
      const underscores = yield* h.hashes.text("underscores");
      const whitespace = yield* h.hashes.text("all_whitespace");
      let hashes = 0;
      h.hooks({
        hash: () => Effect.sync(() => (++hashes === 1 ? underscores : whitespace)),
        equal: () => Effect.succeed(true),
      });
      h.select([step]);
      const result = yield* h.pipeline.run({ text: "__a  b__", plan: "changing-hash" });
      expect(O.getOrThrow(yield* h.values.getText(result.value)).text).toBe("__a b__");
      expect(yield* h.calls).toEqual(["hash", "equal", "hash", "equal"]);
      const key = yield* h.values.text("underscores");
      hashes = 0;
      h.hooks({
        hash: Effect.fn("CleanerRegistryTest.removeDuringHash")(function* () {
          hashes++;
          if (hashes === 2) yield* h.registry.remove(key);
          return underscores;
        }),
        equal: () => Effect.succeed(true),
      });
      expect(yield* Effect.flip(h.pipeline.run({ text: "__a__", plan: "deleted-on-get" }))).toMatchObject({
        reason: "lookup-key-missing",
      });
      expect(yield* h.calls).toEqual(["hash", "equal", "hash"]);
      expect((yield* (yield* h.work).snapshot).closed).toBe(true);
    })
  );
  it.effect("retains lazy callback state and host output through live registry replacement", () =>
    Effect.gen(function* () {
      const h = yield* setup();
      const key = yield* h.values.text("underscores");
      const callback = yield* h.values.retainHost("callback");
      const host = yield* h.values.retainHost({ private: "payload" });
      let invokes = 0;
      h.hooks({
        invoke: Effect.fn("CleanerRegistryTest.mutate")(function* (_fn, value, work) {
          invokes++;
          if (invokes === 1) {
            yield* h.registry.set(key, callback);
            h.select([key, key]);
            return CitationCleanerProduced.make({ value: host, charges: [] });
          }
          expect(yield* h.values.same(value, host)).toBe(true);
          const text = "restored";
          const charge = yield* work.reserveText(text.length);
          return CitationCleanerProduced.make({ value: yield* h.values.text(text), charges: [charge] });
        }),
      });
      yield* h.registry.set(key, callback);
      h.select([key]);
      const result = yield* h.pipeline.run({ text: "input", plan: "lazy-mutation" });
      expect(O.getOrThrow(yield* h.values.getText(result.value)).text).toBe("restored");
      expect(invokes).toBe(2);
      expect(yield* h.calls).toEqual(["invoke", "invoke"]);
    })
  );
  it.effect("keeps native pair/scalar keys distinct and rejects structural handles", () =>
    Effect.gen(function* () {
      const h = yield* setup();
      const pair = yield* h.values.unicode(
        CitationPythonUnicodeStorage.make({ width: 2, bytes: new Uint8Array([0x3d, 0xd8, 0, 0xde]) })
      );
      const scalar = yield* h.values.text("😀");
      const callback = yield* h.values.retainHost("answer");
      yield* h.registry.set(pair, callback);
      h.select([scalar]);
      expect(yield* Effect.flip(h.pipeline.run({ text: "input", plan: "scalar-is-absent" }))).toMatchObject({
        reason: "unknown-step",
      });
      h.hooks({
        invoke: (_fn, _value, _work) => Effect.succeed(CitationCleanerProduced.make({ value: callback, charges: [] })),
      });
      h.select([
        yield* h.values.unicode(
          CitationPythonUnicodeStorage.make({ width: 2, bytes: new Uint8Array([0x3d, 0xd8, 0, 0xde]) })
        ),
      ]);
      expect((yield* h.pipeline.run({ text: "input", plan: "same-native-content" })).value).toBe(callback);
      expect(
        yield* Effect.flip(h.registry.set(CitationCleanerObject.make({ slot: pair.slot }), callback))
      ).toMatchObject({ reason: "unissued-value" });
    })
  );
  it.effect("bounds retained registry work and invalidates the closed owner", () =>
    Effect.gen(function* () {
      expect(yield* Effect.flip(setup(undefined, 4))).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        limit: "authorities",
      });
      const h = yield* setup(200);
      const absent = yield* h.values.text("absent");
      const exhaust = Effect.gen(function* () {
        for (let index = 0; index < 200; index++) yield* h.registry.remove(absent);
        return yield* Effect.die("Registry lifetime work ceiling did not reject within 200 probes");
      });
      expect(yield* Effect.flip(exhaust)).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        limit: "resolutionIterations",
      });
      const closed = yield* Effect.scoped(setup());
      expect(yield* Effect.flip(closed.pipeline.run({ text: "input", plan: "closed" }))).toMatchObject({
        reason: "closed-owner",
      });
    })
  );
  it.effect("keeps byte/string hash collisions separate through Unicode table conversion", () =>
    Effect.gen(function* () {
      const h = yield* setup();
      const bytes = new TextEncoder().encode("underscores");
      expect(yield* h.hashes.bytes(bytes)).toBe(yield* h.hashes.text("underscores"));
      const key = yield* h.values.bytes(bytes);
      h.select([key]);
      expect(yield* Effect.flip(h.pipeline.run({ text: "__a__", plan: "byte-name-absent" }))).toMatchObject({
        reason: "unknown-step",
      });
      expect(yield* h.calls).toEqual([]);
      const callback = yield* h.values.retainHost("byte callback");
      yield* h.registry.set(key, callback);
      h.select([yield* h.values.text("underscores")]);
      expect(
        O.getOrThrow(
          yield* h.values.getText((yield* h.pipeline.run({ text: "__a__", plan: "string-name-retained" })).value)
        ).text
      ).toBe("a");
      h.hooks({ invoke: () => Effect.succeed(CitationCleanerProduced.make({ value: callback, charges: [] })) });
      h.select([yield* h.values.bytes(new Uint8Array(bytes))]);
      expect((yield* h.pipeline.run({ text: "input", plan: "byte-key-retained" })).value).toBe(callback);
      expect(yield* h.calls).toEqual(["invoke"]);
    })
  );
  it.effect("prefers registered function keys and retains callback state across runs", () =>
    Effect.gen(function* () {
      const h = yield* setup();
      const original = yield* h.values.retainHost("original callable");
      const replacement = yield* h.values.retainHost("replacement callable");
      const output = yield* h.values.retainHost({ retained: "state" });
      let invokes = 0;
      h.hooks({
        hash: () => Effect.succeed(BigInt(17)),
        equal: () => Effect.succeed(false),
        callable: () => Effect.die("Membership must precede callable dispatch"),
        invoke: Effect.fn("CleanerRegistryTest.retainedState")(function* (fn) {
          expect(yield* h.values.same(fn, replacement)).toBe(true);
          invokes++;
          return CitationCleanerProduced.make({ value: output, charges: [] });
        }),
      });
      yield* h.registry.set(original, replacement);
      h.select([original]);
      expect((yield* h.pipeline.run({ text: "first", plan: "retained-state" })).value).toBe(output);
      expect((yield* h.pipeline.run({ text: "second", plan: "retained-state" })).value).toBe(output);
      expect(invokes).toBe(2);
    })
  );
});
