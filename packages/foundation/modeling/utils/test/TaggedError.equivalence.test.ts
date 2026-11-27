import { it } from "@beep/test-runner";
import * as FileSystem from "@beep/utils/FileSystem";
import * as NodeUrl from "@beep/utils/NodeUrl";
import * as Path from "@beep/utils/Path";
import { EmptyStructError } from "@beep/utils/Struct";
import { describe, expect } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { identity } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

class DifferentTagError extends S.TaggedError<DifferentTagError, { readonly brand: unique symbol }>()(
  "DifferentTagError",
  EmptyStructError.fields
) {}

const capture = (evaluate: () => unknown): unknown =>
  Result.match(Result.try(evaluate), {
    onFailure: identity,
    onSuccess: identity,
  });

const captureEffectDefect = (effect: Effect.Effect<unknown>) =>
  Effect.map(Effect.exit(effect), (exit) => (Exit.isFailure(exit) ? Cause.squash(exit.cause) : exit.value));

const expectPrivateEquivalence = (first: unknown, second: unknown, different: unknown): void => {
  const schema = P.isObject(first) ? Reflect.get(first, "constructor") : first;
  expect(
    S.isSchema(schema),
    "the Node handles resolve lazily after getBuiltinModule is disabled; an earlier test file sharing the module instance would already have populated them"
  ).toBe(true);

  if (S.isSchema(schema)) {
    const same = S.toEquivalence(schema);
    expect(same(first, second)).toBe(true);
    expect(same(first, different)).toBe(false);
  }
};

describe("@beep/utils tagged-error declared equivalence", () => {
  it("excludes every opaque EmptyStructError payload from diagnostic identity", () => {
    const same = S.toEquivalence(EmptyStructError);
    const first = EmptyStructError.make({ cause: O.some({ side: "left" }), input: { left: true } });
    const second = EmptyStructError.make({ cause: O.some({ side: "right" }), input: ["different"] });
    const differentTag = DifferentTagError.make({ cause: O.none(), input: { left: true } });

    expect(same(first, second)).toBe(true);
    expect(
      Reflect.apply(same, undefined, [first, differentTag]),
      "DifferentTagError has EmptyStructError's exact fields, so only the tag can break equivalence"
    ).toBe(false);
  });

  it.effect("compares private Node runtime errors by their declared singleton fields", () =>
    Effect.gen(function* () {
      const descriptor = Reflect.getOwnPropertyDescriptor(globalThis.process, "getBuiltinModule");
      Reflect.defineProperty(globalThis.process, "getBuiltinModule", {
        configurable: true,
        value: () => undefined,
      });

      try {
        const fileSystemFirst = yield* captureEffectDefect(FileSystem.existsSync("missing"));
        const fileSystemSecond = yield* captureEffectDefect(FileSystem.existsSync("missing"));
        const pathFirst = capture(() => Path.join("one", "two"));
        const pathSecond = capture(() => Path.join("one", "two"));
        const urlFirst = capture(() => NodeUrl.fileURLToPath("file:///tmp/one"));
        const urlSecond = capture(() => NodeUrl.fileURLToPath("file:///tmp/one"));

        expectPrivateEquivalence(fileSystemFirst, fileSystemSecond, pathFirst);
        expectPrivateEquivalence(pathFirst, pathSecond, urlFirst);
        expectPrivateEquivalence(urlFirst, urlSecond, fileSystemFirst);
      } finally {
        if (P.isNotUndefined(descriptor)) {
          Reflect.defineProperty(globalThis.process, "getBuiltinModule", descriptor);
        }
      }
    })
  );
});
