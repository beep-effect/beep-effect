import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { makeInspectableWith } from "../../../effected/memfs/internal/volume.ts";

const runs = { arbitrary: fcRuns(100) };
const Name = S.String.check(S.isPattern(/^[a-z]{1,12}$/));

describe("volume path and byte fidelity", () => {
  it.effect.prop("realPath normalization is idempotent and canonical paths retain file bytes", [Arbitrary.schema(Name), Arbitrary.schema(S.Uint8Array)], ([name, bytes]) => Effect.gen(function* () {
    const engine = yield* makeInspectableWith({ caseSensitive: true });
    const fs = engine.fileSystem;
    yield* fs.makeDirectory("/tree/dir", { recursive: true });
    yield* fs.writeFile(`/tree/${name}`, bytes);
    const parsed = yield* fs.realPath(`/tree/dir/.././${name}`);
    assert.strictEqual(yield* fs.realPath(parsed), parsed);
    assert.strictEqual(yield* fs.realPath(`/${parsed}`), parsed);
    assert.deepStrictEqual(yield* fs.readFile(parsed), bytes);
    yield* fs.symlink(`/tree/dir`, "/link");
    assert.strictEqual(yield* fs.realPath(`/link/../${name}`), parsed);
    assert.strictEqual(engine.lookup(`/link/${name}`), undefined);
  }), runs);

  it.effect.prop("glob parser alternatives preserve matches and folded results retain stored spellings", [Arbitrary.schema(Name), Arbitrary.schema(S.String).pipe(Arbitrary.filter((value) => value.isWellFormed()))], ([name, text]) => Effect.gen(function* () {
    const engine = yield* makeInspectableWith({ caseSensitive: false });
    const fs = engine.fileSystem;
    const stored = name.toUpperCase();
    yield* fs.writeFileString(`/${stored}`, text);
    const parsed = yield* fs.glob(name);
    assert.deepStrictEqual(parsed, [stored]);
    assert.deepStrictEqual(yield* fs.glob(`{${name},${name}}`), parsed);
    for (const path of parsed) {
      assert.deepStrictEqual(yield* fs.glob(path), parsed);
      assert.strictEqual(yield* fs.readFileString(path), text);
      const copy = `/copy-${name}`;
      yield* fs.copyFile(path, copy);
      assert.strictEqual(yield* fs.readFileString(copy), text);
      yield* fs.link(path, `/alias-${name}`);
      yield* fs.writeFileString(`/alias-${name}`, "changed");
      assert.strictEqual(yield* fs.readFileString(path), "changed");
      assert.strictEqual(yield* fs.readFileString(copy), text);
    }
  }), runs);
});
