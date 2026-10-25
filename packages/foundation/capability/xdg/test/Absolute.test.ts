import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import {
  AbsolutePath,
  AbsolutePosixPath,
  absolutePathPattern,
  isAbsolutePosix,
  isAbsoluteWin32,
} from "@beep/xdg/Absolute";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const samples = [
  "/home/ada",
  "/",
  " /padded",
  "relative",
  "./dir",
  "~/dir",
  "",
  "C:\\Users\\ada",
  "D:/data",
  "C:relative",
  "\\\\server\\share",
  "//server/share",
  "\\single",
];

describe("Absolute", () => {
  it.effect("the either-platform pattern is exactly the union of the two predicates", () =>
    Effect.sync(() => {
      for (const value of samples) {
        assert.strictEqual(absolutePathPattern.test(value), isAbsolutePosix(value) || isAbsoluteWin32(value), value);
      }
    })
  );

  it.effect.prop(
    "the either-platform pattern agrees with the predicates on any string",
    [Arbitrary.schema(S.String)],
    ([value]) =>
      Effect.sync(() => {
        assert.strictEqual(absolutePathPattern.test(value), isAbsolutePosix(value) || isAbsoluteWin32(value));
      }),
    { arbitrary: fcRuns(200) }
  );

  it.effect("AbsolutePath admits either platform, AbsolutePosixPath only POSIX", () =>
    Effect.sync(() => {
      assert.deepStrictEqual(A.filter(samples, S.is(AbsolutePath)), [
        "/home/ada",
        "/",
        "C:\\Users\\ada",
        "D:/data",
        "\\\\server\\share",
        "//server/share",
      ]);
      assert.deepStrictEqual(A.filter(samples, S.is(AbsolutePosixPath)), ["/home/ada", "/", "//server/share"]);
    })
  );
});
