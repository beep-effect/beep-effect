import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { GlobPattern, GlobPatternOptions } from "@beep/glob";
import { CompileAndExpandOptions, compileAndExpand, GlobExpansionError } from "@beep/walker/Expand";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { platform } from "./support/fixtures.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "CompileAndExpandOptions: decode(encode(x)) equals x and decoding never fails",
  [Arbitrary.schema(CompileAndExpandOptions)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(CompileAndExpandOptions)(value);
      const decoded = yield* S.decodeEffect(CompileAndExpandOptions)(encoded);
      assertTrue(S.toEquivalence(CompileAndExpandOptions)(decoded, value));
      const value1 = yield* S.encodeEffect(CompileAndExpandOptions)(decoded);
      assert.deepStrictEqual(value1, encoded);
    }),
  runs
);

it.effect.prop(
  "GlobExpansionError: decode(encode(x)) preserves the cause, stage and message",
  [Arbitrary.schema(GlobExpansionError)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(GlobExpansionError)(value);
      const decoded = yield* S.decodeEffect(GlobExpansionError)(encoded);
      assertTrue(S.toEquivalence(GlobExpansionError)(decoded, value));
      assert.strictEqual(decoded.stage, value.stage);
      assert.strictEqual(decoded.message, value.message);
      const value2 = yield* S.encodeEffect(GlobExpansionError)(decoded);
      assert.deepStrictEqual(value2, encoded);
    }),
  runs
);

it.layer(
  platform({
    "/repo/z.ts": "",
    "/repo/a.txt": "",
    "/repo/src/b.ts": "",
    "/repo/src/a.ts": "",
    "/repo/src/.hidden.ts": "",
    "/repo/empty/placeholder.txt": "",
  }),
  { timeout: "10 seconds" }
)("compiled expansion fidelity", (it) => {
  it.effect.prop(
    "expansion returns exactly the compiled pattern's file membership in sorted cwd-relative order",
    [
      Arbitrary.schema(S.Literals(["**/*.ts", "*.ts", "src/*.ts", "!**/*.ts", "src/**", "missing/*.ts"])),
      Arbitrary.schema(S.Boolean),
    ],
    ([source, dot]) =>
      Effect.gen(function* () {
        const glob = GlobPatternOptions.make({ dot });
        const pattern = yield* GlobPattern.compile(source, glob);
        const files = ["z.ts", "a.txt", "src/b.ts", "src/a.ts", "src/.hidden.ts", "empty/placeholder.txt"];
        const expected = A.sort(
          A.filter(files, (file) => pattern.matches(file)),
          Order.String
        );
        const actual = yield* compileAndExpand(source, { cwd: "/repo", glob });
        assert.deepStrictEqual(actual, expected);
        const value3 = yield* compileAndExpand({ cwd: "/repo", glob })(source);
        assert.deepStrictEqual(value3, actual);
      }),
    runs
  );
});
