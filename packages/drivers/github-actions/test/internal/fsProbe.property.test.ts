import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { isErrno, typeAt } from "@beep/github-actions/internal/fsProbe";
import { MemoryFileSystem } from "@beep/memfs";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Base64Url from "effect/encoding/Base64Url";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
it.layer(MemoryFileSystem.layer, { timeout: "30 seconds" })((it) => {
  it.effect.prop(
    "probing files and directories faithfully reports their type without changing their contents",
    [Arbitrary.schema(S.NonEmptyString), Arbitrary.schema(S.String)],
    ([name, text]) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const directory = `/probe-${Base64Url.encode(name)}`;
        const file = `${directory}/file`;
        yield* fs.makeDirectory(directory, { recursive: true });
        yield* fs.writeFileString(file, text);
        const typeAt1 = yield* typeAt(fs, directory);
        assert.strictEqual(typeAt1, "Directory");
        const value = yield* typeAt(file)(fs);
        assert.strictEqual(value, "File");
        const typeAt2 = yield* typeAt(fs, `${directory}/missing`);
        assert.strictEqual(typeAt2, undefined);
        const readFile3 = yield* fs.readFile(file);
        assert.deepStrictEqual(readFile3, new TextEncoder().encode(text));
      }),
    runs
  );
});
it.effect.prop(
  "errno recognition depends on the exact code and survives structural re-encoding",
  [Arbitrary.schema(S.String)],
  ([code]) =>
    Effect.gen(function* () {
      const codec = S.fromJsonString(S.Struct({ code: S.String }));
      const original = { code };
      const argument = S.decodeEffect(codec);
      const value1 = yield* S.encodeEffect(codec)(original);
      const decoded = yield* argument(value1);
      assert.strictEqual(isErrno(decoded, code), true);
      assert.strictEqual(isErrno(`${code}x`)(decoded), false);
      assert.strictEqual(isErrno(code)(original), true);
      assert.strictEqual(isErrno(null, code), false);
    }),
  runs
);
