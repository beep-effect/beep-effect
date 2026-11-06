import { CitationBuiltinCleaners } from "@beep/law-practice-server/internal/Citation/BuiltinCleaners";
import {
  CitationCleanerFailure,
  CitationCleanerObject,
  CitationCleanerProduced,
} from "@beep/law-practice-server/internal/Citation/CleanerPipeline";
import {
  CitationCleanerProtocols,
  makeCitationCleanerRegistry,
} from "@beep/law-practice-server/internal/Citation/CleanerRegistry";
import { CitationCleanerValues } from "@beep/law-practice-server/internal/Citation/CleanerValues";
import { CitationPythonUnicodeStorage } from "@beep/law-practice-server/internal/Citation/PythonHash";
import { CitationEngineAbsoluteMaxima } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertFailure, assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import { constant } from "effect/Function";
import * as O from "effect/Option";
import * as TestClock from "effect/testing/TestClock";
import { makeCitationCleanerRegistryHarness as setup } from "./CitationCleanerRegistry.fixtures.ts";

describe("live cleaner registry", () => {
  it.effect("rejects out-of-range host hashes and bounds stalled callbacks", () =>
    Effect.gen(function* () {
      const h = yield* setup();
      const key = yield* h.values.retainHost("host-key");
      const value = yield* h.values.retainHost("host-value");
      h.hooks({ hash: () => Effect.succeed(BigInt(2) ** BigInt(100)) });
      const malformed = yield* h.registry.set(key, value).pipe(Effect.flip);
      expect(malformed).toMatchObject({ reason: "callback-failed" });
      const entered = yield* Deferred.make<void>();
      h.hooks({ hash: () => Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never)) });
      const pending = yield* h.registry.set(key, value).pipe(Effect.forkChild);
      yield* Deferred.await(entered);
      const limits = (yield* defaultCitationEnginePolicy).limits;
      yield* TestClock.adjust(limits.cleanDeadline);
      const timedOut = yield* Fiber.join(pending).pipe(Effect.flip);
      expect(timedOut).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "cleanDeadline" });
      h.hooks({ hash: () => Effect.succeed(BigInt(17)) });
      yield* h.registry.set(key, value);
      const entries = yield* h.registry.read;
      expect(entries).toHaveLength(6);
    })
  );
  it.effect("dispatches native hashed names through real builtins without host hooks", () =>
    Effect.gen(function* () {
      const h = yield* setup();
      const citationResult1 = yield* Effect.forEach(["underscores", "all_whitespace"], h.values.text);
      h.select(citationResult1);
      const result = yield* h.pipeline.run({ text: "  a__   b  ", plan: "registered" });
      const citationResult2 = yield* h.values.getText(result.value);
      expect(O.getOrThrow(citationResult2).text).toBe(" a b ");
      const citationResult3 = yield* h.calls;
      expect(citationResult3).toEqual([]);
      const citationResult4 = yield* h.work;
      const citationResult5 = yield* citationResult4.snapshot;
      expect(citationResult5.closed).toBe(true);
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
      const citationResult6 = yield* h.values.getText(result.value);
      expect(O.getOrThrow(citationResult6).text).toBe("__a b__");
      const citationResult7 = yield* h.calls;
      expect(citationResult7).toEqual(["hash", "equal", "hash", "equal"]);
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
      const citationResult8 = yield* Effect.flip(h.pipeline.run({ text: "__a__", plan: "deleted-on-get" }));
      expect(citationResult8).toMatchObject({
        reason: "lookup-key-missing",
      });
      const citationResult9 = yield* h.calls;
      expect(citationResult9).toEqual(["hash", "equal", "hash"]);
      const citationResult10 = yield* h.work;
      const citationResult11 = yield* citationResult10.snapshot;
      expect(citationResult11.closed).toBe(true);
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
          const citationResult12 = yield* h.values.same(value, host);
          expect(citationResult12).toBe(true);
          const text = "restored";
          const charge = yield* work.reserveText(text.length);
          const citationResult13 = yield* h.values.text(text);
          return CitationCleanerProduced.make({ value: citationResult13, charges: [charge] });
        }),
      });
      yield* h.registry.set(key, callback);
      h.select([key]);
      const result = yield* h.pipeline.run({ text: "input", plan: "lazy-mutation" });
      const citationResult14 = yield* h.values.getText(result.value);
      expect(O.getOrThrow(citationResult14).text).toBe("restored");
      expect(invokes).toBe(2);
      const citationResult15 = yield* h.calls;
      expect(citationResult15).toEqual(["invoke", "invoke"]);
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
      const citationResult16 = yield* Effect.flip(h.pipeline.run({ text: "input", plan: "scalar-is-absent" }));
      expect(citationResult16).toMatchObject({
        reason: "unknown-step",
      });
      h.hooks({
        invoke: (_fn, _value, _work) => Effect.succeed(CitationCleanerProduced.make({ value: callback, charges: [] })),
      });
      const citationResult17 = yield* h.values.unicode(
        CitationPythonUnicodeStorage.make({ width: 2, bytes: new Uint8Array([0x3d, 0xd8, 0, 0xde]) })
      );
      h.select([citationResult17]);
      const citationResult18 = yield* h.pipeline.run({ text: "input", plan: "same-native-content" });
      expect(citationResult18.value).toBe(callback);
      const citationResult19 = yield* Effect.flip(
        h.registry.set(CitationCleanerObject.make({ slot: pair.slot }), callback)
      );
      expect(citationResult19).toMatchObject({ reason: "unissued-value" });
    })
  );
  it.effect("bounds retained registry work and invalidates the closed owner", () =>
    Effect.gen(function* () {
      const citationResult20 = yield* Effect.flip(setup(undefined, 4));
      expect(citationResult20).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        limit: "authorities",
      });
      const h = yield* setup(200);
      const absent = yield* h.values.text("absent");
      const exhaust = Effect.gen(function* () {
        for (let index = 0; index < 200; index++) yield* h.registry.remove(absent);
        return yield* Effect.die("Registry lifetime work ceiling did not reject within 200 probes");
      });
      const citationResult21 = yield* Effect.flip(exhaust);
      expect(citationResult21).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        limit: "resolutionIterations",
      });
      const closed = yield* Effect.scoped(setup());
      const citationResult22 = yield* Effect.flip(closed.pipeline.run({ text: "input", plan: "closed" }));
      expect(citationResult22).toMatchObject({
        reason: "closed-owner",
      });
    })
  );
  it.effect("keeps byte/string hash collisions separate through Unicode table conversion", () =>
    Effect.gen(function* () {
      const h = yield* setup();
      const bytes = new TextEncoder().encode("underscores");
      const citationResult23 = yield* h.hashes.bytes(bytes);
      const citationResult24 = yield* h.hashes.text("underscores");
      expect(citationResult23).toBe(citationResult24);
      const key = yield* h.values.bytes(bytes);
      h.select([key]);
      const citationResult25 = yield* Effect.flip(h.pipeline.run({ text: "__a__", plan: "byte-name-absent" }));
      expect(citationResult25).toMatchObject({
        reason: "unknown-step",
      });
      const citationResult26 = yield* h.calls;
      expect(citationResult26).toEqual([]);
      const callback = yield* h.values.retainHost("byte callback");
      yield* h.registry.set(key, callback);
      const citationResult27 = yield* h.values.text("underscores");
      h.select([citationResult27]);
      const citationResult28 = yield* h.pipeline.run({ text: "__a__", plan: "string-name-retained" });
      const citationResult29 = yield* h.values.getText(citationResult28.value);
      expect(O.getOrThrow(citationResult29).text).toBe("a");
      h.hooks({ invoke: () => Effect.succeed(CitationCleanerProduced.make({ value: callback, charges: [] })) });
      const citationResult30 = yield* h.values.bytes(new Uint8Array(bytes));
      h.select([citationResult30]);
      const citationResult31 = yield* h.pipeline.run({ text: "input", plan: "byte-key-retained" });
      expect(citationResult31.value).toBe(callback);
      const citationResult32 = yield* h.calls;
      expect(citationResult32).toEqual(["invoke"]);
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
          const citationResult33 = yield* h.values.same(fn, replacement);
          expect(citationResult33).toBe(true);
          invokes++;
          return CitationCleanerProduced.make({ value: output, charges: [] });
        }),
      });
      yield* h.registry.set(original, replacement);
      h.select([original]);
      const citationResult34 = yield* h.pipeline.run({ text: "first", plan: "retained-state" });
      expect(citationResult34.value).toBe(output);
      const citationResult35 = yield* h.pipeline.run({ text: "second", plan: "retained-state" });
      expect(citationResult35.value).toBe(output);
      expect(invokes).toBe(2);
    })
  );
  it.effect(
    "reads original insertion identities without calling hash/equality and returns detached binding lists",
    () =>
      Effect.gen(function* () {
        const h = yield* setup();
        const key = yield* h.values.retainHost("original key");
        const equivalent = yield* h.values.retainHost("equivalent key");
        const first = yield* h.values.retainHost("first value");
        const replacement = yield* h.values.retainHost("replacement value");
        h.hooks({ hash: () => Effect.succeed(BigInt(42)), equal: () => Effect.succeed(true) });
        yield* h.registry.set(key, first);
        yield* h.registry.set(equivalent, replacement);
        const before = yield* h.calls;
        const bindings = yield* h.registry.read;
        const citationResult36 = yield* h.calls;
        expect(citationResult36).toEqual(before);
        expect(bindings).toHaveLength(6);
        const binding = A.getUnsafe(bindings, 5);
        expect(binding[0]).toBe(key);
        expect(binding[1]).toBe(replacement);
        binding[2].pipe(assertNone);
        assertSome(A.getUnsafe(bindings, 0)[2], "html");
        yield* h.values.assertOwned(binding[0]);
        yield* h.values.assertOwned(binding[1]);
        yield* h.registry.remove(equivalent);
        const citationResult37 = yield* h.registry.read;
        expect(citationResult37).toHaveLength(5);
        expect(bindings).toHaveLength(6);
      })
  );
  it.effect("bounds registry inspection by captured lifetime work and rejects closed ownership", () =>
    Effect.gen(function* () {
      const h = yield* setup(200);
      const exhaust = Effect.gen(function* () {
        for (let index = 0; index < 200; index++) yield* h.registry.read;
        return yield* Effect.die("Registry inspection did not consume its lifetime work ceiling");
      });
      const citationResult38 = yield* Effect.flip(exhaust);
      expect(citationResult38).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        limit: "resolutionIterations",
      });
      const closed = yield* Effect.scoped(setup());
      const citationResult39 = yield* Effect.flip(closed.registry.read);
      expect(citationResult39).toMatchObject({ reason: "closed-owner" });
    })
  );
});

it.effect("rejects malformed registry policy before invoking captured capabilities", () =>
  Effect.gen(function* () {
    const h = yield* setup();
    const unavailable = constant(Effect.die("invalid registry policy reached a capability"));
    const protocols = CitationCleanerProtocols.of({
      hash: unavailable,
      equal: unavailable,
      callable: unavailable,
      invoke: unavailable,
      open: unavailable,
    });
    for (const policy of [null, {}, { sourceUtf16: 0 }]) {
      const failure = yield* makeCitationCleanerRegistry(policy).pipe(
        Effect.provideService(CitationCleanerValues, h.values),
        Effect.provideService(CitationBuiltinCleaners, { invoke: unavailable }),
        Effect.provideService(CitationCleanerProtocols, protocols),
        Effect.flip
      );
      expect(failure).toMatchObject({ _tag: "CitationCleanerFailure", reason: "invalid-input" });
      expect("cause" in failure).toBe(false);
    }
  })
);

it.effect("closes malformed native snapshots and oversized owned-byte hashing without altering registry entries", () =>
  Effect.gen(function* () {
    const h = yield* setup();
    const before = yield* h.registry.read;
    const value = yield* h.values.retainHost("registered value");
    const bytes = yield* h.values.bytes(new Uint8Array(CitationEngineAbsoluteMaxima.producedTextUtf16 * 4 + 1));
    const byteFailure = yield* h.registry.set(bytes, value).pipe(Effect.flip);
    expect(byteFailure).toMatchObject({ _tag: "CitationCleanerFailure", reason: "runtime-failed" });
    const key = yield* h.values.text("private key");
    const original = h.values.getUnicode;
    const malformed = yield* original(key).pipe(Effect.flatMap(Effect.fromOption));
    Reflect.set(malformed.storage, "width", 3);
    Reflect.set(
      h.values,
      "getUnicode",
      Effect.fn("CleanerRegistryTest.invalidNativeSnapshot")((ref: CitationCleanerObject) =>
        ref === key ? Effect.succeedSome(malformed) : original(ref)
      )
    );
    const nativeFailure = yield* h.registry.set(key, value).pipe(Effect.flip);
    expect(nativeFailure).toMatchObject({ _tag: "CitationCleanerFailure", reason: "runtime-failed" });
    Reflect.set(
      h.values,
      "getUnicode",
      Effect.fn("CleanerRegistryTest.missingNativeSnapshot")((ref: CitationCleanerObject) =>
        ref === key ? Effect.succeedNone : original(ref)
      )
    );
    const missingFailure = yield* h.registry.set(key, value).pipe(Effect.flip);
    expect(missingFailure).toMatchObject({ _tag: "CitationCleanerFailure", reason: "unissued-value" });
    Reflect.set(h.values, "getUnicode", original);
    const after = yield* h.registry.read;
    expect(after).toEqual(before);
  })
);

it.effect("distinguishes issued builtin functions from owned text while the pipeline work is live", () =>
  Effect.gen(function* () {
    const h = yield* setup();
    const bindings = yield* h.registry.read;
    const builtin = A.getUnsafe(bindings, 0)[1];
    let checked = false;
    h.hooks({
      open: Effect.fn("CleanerRegistryTest.checkLiveCallability")(function* (_plan, value, work) {
        const callable = yield* h.registry.runtime.callable(builtin, work);
        expect(callable).toBe(true);
        const failure = yield* h.registry.runtime.invoke(value, value, work).pipe(Effect.result);
        assertFailure(failure, CitationCleanerFailure.make({ reason: "not-callable" }));
        checked = true;
        return { next: Effect.succeedNone };
      }),
    });
    const completed = yield* h.pipeline.run({ text: "owned plain text", plan: "callability" });
    expect(checked).toBe(true);
    const text = yield* h.values.getText(completed.value);
    expect(O.getOrThrow(text).text).toBe("owned plain text");
  })
);
