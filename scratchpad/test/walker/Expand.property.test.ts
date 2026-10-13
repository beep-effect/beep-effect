import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Order from "effect/Order";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CompileAndExpandOptions, GlobExpansionError, compileAndExpand } from "../../effected/walker/Expand.ts";

import { GlobPattern, GlobPatternOptions } from "../../effected/glob/index.ts";
import { platform } from "./fixtures.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop("CompileAndExpandOptions: decode(encode(x)) equals x and decoding never fails", [Arbitrary.schema(CompileAndExpandOptions)], ([value]) => Effect.gen(function* () {
  const encoded = yield* S.encodeEffect(CompileAndExpandOptions)(value);
  const decoded = yield* S.decodeEffect(CompileAndExpandOptions)(encoded);
  assertTrue(S.toEquivalence(CompileAndExpandOptions)(decoded, value));
  assert.deepStrictEqual(yield* S.encodeEffect(CompileAndExpandOptions)(decoded), encoded);
}), runs);

it.effect.prop("GlobExpansionError: decode(encode(x)) preserves the cause, stage and message", [Arbitrary.schema(GlobExpansionError)], ([value]) => Effect.gen(function* () {
  const encoded = yield* S.encodeEffect(GlobExpansionError)(value);
  const decoded = yield* S.decodeEffect(GlobExpansionError)(encoded);
  assertTrue(S.toEquivalence(GlobExpansionError)(decoded, value));
  assert.strictEqual(decoded.stage, value.stage);
  assert.strictEqual(decoded.message, value.message);
  assert.deepStrictEqual(yield* S.encodeEffect(GlobExpansionError)(decoded), encoded);
}), runs);

it.layer(platform({
  "/repo/z.ts": "",
  "/repo/a.txt": "",
  "/repo/src/b.ts": "",
  "/repo/src/a.ts": "",
  "/repo/src/.hidden.ts": "",
  "/repo/empty/placeholder.txt": "",
}), { timeout: "10 seconds" })("compiled expansion fidelity", (it) => {
  it.effect.prop("expansion returns exactly the compiled pattern's file membership in sorted cwd-relative order", [Arbitrary.schema(S.Literals(["**/*.ts", "*.ts", "src/*.ts", "!**/*.ts", "src/**", "missing/*.ts"])), Arbitrary.schema(S.Boolean)], ([source, dot]) => Effect.gen(function* () {
    const glob = GlobPatternOptions.make({ dot });
    const pattern = yield* GlobPattern.compile(source, glob);
    const files = ["z.ts", "a.txt", "src/b.ts", "src/a.ts", "src/.hidden.ts", "empty/placeholder.txt"];
    const expected = A.sort(A.filter(files, (file) => pattern.matches(file)), Order.String);
    const actual = yield* compileAndExpand(source, { cwd: "/repo", glob });
    assert.deepStrictEqual(actual, expected);
    assert.deepStrictEqual(yield* compileAndExpand({ cwd: "/repo", glob })(source), actual);
  }), runs);
});
