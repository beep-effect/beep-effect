import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Base64Url from "effect/encoding/Base64Url";
import * as S from "effect/Schema";
import { MemoryFileSystem } from "../../../effected/memfs/index.ts";
import { isErrno, typeAt } from "../../../effected/github-actions/internal/fsProbe.ts";
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
        assert.strictEqual(yield* typeAt(fs, directory), "Directory");
        assert.strictEqual(yield* typeAt(file)(fs), "File");
        assert.strictEqual(yield* typeAt(fs, `${directory}/missing`), undefined);
        assert.deepStrictEqual(yield* fs.readFile(file), new TextEncoder().encode(text));
      }),
    runs,
  );
});
it.effect.prop(
  "errno recognition depends on the exact code and survives structural re-encoding",
  [Arbitrary.schema(S.String)],
  ([code]) =>
    Effect.gen(function* () {
      const codec = S.fromJsonString(S.Struct({ code: S.String }));
      const original = { code };
      const decoded = yield* S.decodeEffect(codec)(yield* S.encodeEffect(codec)(original));
      assert.strictEqual(isErrno(decoded, code), true);
      assert.strictEqual(isErrno(`${code}x`)(decoded), false);
      assert.strictEqual(isErrno(code)(original), true);
      assert.strictEqual(isErrno(null, code), false);
    }),
  runs,
);
