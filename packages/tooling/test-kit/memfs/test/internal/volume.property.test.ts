import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { EngineOptions, makeInspectableWith } from "@beep/memfs/internal/volume";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };
const Name = S.String.check(S.isPattern(/^[a-z]{1,12}$/));

describe("volume path and byte fidelity", () => {
  it.effect.prop(
    "realPath normalization is idempotent and canonical paths retain file bytes",
    [Arbitrary.schema(Name), Arbitrary.schema(S.Uint8Array)],
    ([name, bytes]) =>
      Effect.gen(function* () {
        const engine = yield* makeInspectableWith(EngineOptions.make({ caseSensitive: true }));
        const fs = engine.fileSystem;
        yield* fs.makeDirectory("/tree/navigation-dir", { recursive: true });
        yield* fs.writeFile(`/tree/${name}`, bytes);
        const parsed = yield* fs.realPath(`/tree/navigation-dir/.././${name}`);
        const realPath1 = yield* fs.realPath(parsed);
        assert.strictEqual(realPath1, parsed);
        const realPath2 = yield* fs.realPath(`/${parsed}`);
        assert.strictEqual(realPath2, parsed);
        const readFile3 = yield* fs.readFile(parsed);
        assert.deepStrictEqual(readFile3, bytes);
        yield* fs.symlink(`/tree/navigation-dir`, "/link");
        const realPath4 = yield* fs.realPath(`/link/../${name}`);
        assert.strictEqual(realPath4, parsed);
        assert.strictEqual(engine.lookup(`/link/${name}`), undefined);
      }),
    runs
  );

  it.effect.prop(
    "glob parser alternatives preserve matches and folded results retain stored spellings",
    [Arbitrary.schema(Name), Arbitrary.schema(S.String).pipe(Arbitrary.filter((value) => value.isWellFormed()))],
    ([name, text]) =>
      Effect.gen(function* () {
        const engine = yield* makeInspectableWith(EngineOptions.make({ caseSensitive: false }));
        const fs = engine.fileSystem;
        const filename = `file-${name}`;
        const stored = Str.toUpperCase(filename);
        yield* fs.writeFileString(`/${stored}`, text);
        const parsed = yield* fs.glob(filename);
        assert.deepStrictEqual(parsed, [stored]);
        const glob5 = yield* fs.glob(`{${filename},${filename}}`);
        assert.deepStrictEqual(glob5, parsed);
        for (const path of parsed) {
          const glob6 = yield* fs.glob(path);
          assert.deepStrictEqual(glob6, parsed);
          const readFileString7 = yield* fs.readFileString(path);
          assert.strictEqual(readFileString7, text);
          const copy = `/copy-${filename}`;
          yield* fs.copyFile(path, copy);
          const readFileString8 = yield* fs.readFileString(copy);
          assert.strictEqual(readFileString8, text);
          yield* fs.link(path, `/alias-${filename}`);
          yield* fs.writeFileString(`/alias-${filename}`, "changed");
          const readFileString9 = yield* fs.readFileString(path);
          assert.strictEqual(readFileString9, "changed");
          const readFileString10 = yield* fs.readFileString(copy);
          assert.strictEqual(readFileString10, text);
        }
      }),
    runs
  );
});
