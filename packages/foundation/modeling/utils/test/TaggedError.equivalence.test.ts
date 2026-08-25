import * as FileSystem from "@beep/utils/FileSystem";
import { GlobError } from "@beep/utils/Glob";
import * as NodeUrl from "@beep/utils/NodeUrl";
import * as Path from "@beep/utils/Path";
import { EmptyStructError } from "@beep/utils/Struct";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, identity } from "effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const capture = (evaluate: () => unknown): unknown =>
  Result.match(Result.try(evaluate), {
    onFailure: identity,
    onSuccess: identity,
  });

const captureEffectDefect = (effect: Effect.Effect<unknown>): unknown => {
  const exit = Effect.runSyncExit(effect);
  return Exit.isFailure(exit) ? Cause.squash(exit.cause) : exit.value;
};

const expectPrivateEquivalence = (first: unknown, second: unknown, different: unknown): void => {
  const schema = P.isObject(first) ? Reflect.get(first, "constructor") : first;
  expect(S.isSchema(schema)).toBe(true);

  if (S.isSchema(schema)) {
    const same = S.toEquivalence(schema);
    expect(same(first, second)).toBe(true);
    expect(same(first, different)).toBe(false);
  }
};

describe("@beep/utils tagged-error declared equivalence", () => {
  it("compares GlobError by pattern while ignoring its opaque cause", () => {
    const same = S.toEquivalence(GlobError);
    const first = GlobError.make({ cause: O.some({ side: "left" }), pattern: ["src/*.ts"] });
    const second = GlobError.make({ cause: O.some({ side: "right" }), pattern: ["src/*.ts"] });
    const different = GlobError.make({ cause: O.none(), pattern: ["test/*.ts"] });

    expect(same(first, second)).toBe(true);
    expect(same(first, different)).toBe(false);
  });

  it("excludes every opaque EmptyStructError payload from diagnostic identity", () => {
    const same = S.toEquivalence(EmptyStructError);
    const first = EmptyStructError.make({ cause: O.some({ side: "left" }), input: { left: true } });
    const second = EmptyStructError.make({ cause: O.some({ side: "right" }), input: ["different"] });
    const differentTag = GlobError.make({ cause: O.none(), pattern: ["src/*.ts"] });

    expect(same(first, second)).toBe(true);
    expect(Reflect.apply(same, undefined, [first, differentTag])).toBe(false);
  });

  it("compares private Node runtime errors by their declared singleton fields", () => {
    const descriptor = Reflect.getOwnPropertyDescriptor(globalThis.process, "getBuiltinModule");
    Reflect.defineProperty(globalThis.process, "getBuiltinModule", {
      configurable: true,
      value: () => undefined,
    });

    try {
      const fileSystemFirst = captureEffectDefect(FileSystem.existsSync("missing"));
      const fileSystemSecond = captureEffectDefect(FileSystem.existsSync("missing"));
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
  });
});
