import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Hex from "effect/encoding/Hex";
import * as S from "effect/Schema";
import { MemoryFileSystem } from "../../../effected/memfs/index.ts";
import { digestFile, digestFileHex, sha256, sha256Hex } from "../../../effected/github-actions/internal/digest.ts";
const runs = { arbitrary: fcRuns(100) };
it.layer(MemoryFileSystem.layer, { timeout: "30 seconds" })((it) => {
  it.effect.prop(
    "streamed SHA-256 preserves the bytes of the in-memory digest and its hex representation",
    [Arbitrary.schema(S.String)],
    ([text]) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const bytes = new TextEncoder().encode(text);
        yield* fs.writeFile("/digest-property", bytes);
        const digest = yield* digestFile(fs, "/digest-property", "sha256");
        assert.deepStrictEqual(digest, sha256(bytes));
        assert.deepStrictEqual(sha256(text), digest);
        assert.strictEqual(yield* digestFileHex("/digest-property", "sha256")(fs), sha256Hex(bytes));
        assert.strictEqual(Hex.encode(digest), sha256Hex(text));
      }),
    runs,
  );
});
