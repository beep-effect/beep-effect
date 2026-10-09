import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { normalizeAbsolute } from "../../../effected/memfs/internal/seed.ts";
import { MemoryFileSystem } from "../../../effected/memfs/MemoryFileSystem.ts";

const runs = { arbitrary: fcRuns(100) };
it.layer(Path.layer, { timeout: "5 seconds" })((it) => {
  it.effect.prop("lexical formatting is idempotent, agrees with POSIX normalization and preserves the resolved file", [Arbitrary.schema(S.Literals(["a", "b", "", ".", ".."]).pipe(S.Array))], ([value]) =>
    Effect.gen(function* () {
      const posix = yield* Path.Path;
      const input = `/root/${A.join(value, "/")}/leaf`;
      const path = normalizeAbsolute(input);
      assert.strictEqual(path, posix.normalize(input));
      assert.strictEqual(normalizeAbsolute(path), path);
      const handle = yield* MemoryFileSystem.makeHandle({ [path]: "payload" });
      assert.strictEqual(handle.volume.text(input), "payload");
      assert.strictEqual(handle.volume.text(normalizeAbsolute(path)), "payload");
    }), runs);
});
