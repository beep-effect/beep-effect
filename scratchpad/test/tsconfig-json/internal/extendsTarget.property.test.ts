import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { MemoryFileSystem } from "../../../effected/memfs/index.ts";
import { resolveExports, resolveExtendsTarget } from "../../../effected/tsconfig-json/internal/extendsTarget.ts";

const runs = { arbitrary: fcRuns(100) };
const Segment = S.Int.check(S.isBetween({ minimum: 0, maximum: 100000 }));
const Exports = S.Struct({ ".": S.String, "./base": S.Struct({ types: S.String, default: S.String }) });

describe("extends target resolution properties", () => {
  it.effect.prop("exports selection is stable under JSON encoding and selected targets resolve idempotently", [Arbitrary.schema(Segment)], ([segment]) => Effect.gen(function* () {
    const target = `./base-${segment}.json`;
    const manifest = { ".": target, "./base": { types: target, default: "./ignored.json" } };
    const codec = S.fromJsonString(Exports);
    const parsed = yield* S.decodeEffect(codec)(yield* S.encodeEffect(codec)(manifest));
    const reparsed = yield* S.decodeEffect(codec)(yield* S.encodeEffect(codec)(parsed));
    assert.deepStrictEqual(resolveExports(reparsed, "./base"), resolveExports(parsed, "./base"));
    assertSome(resolveExports(parsed, "./base"), target);
    assertSome(resolveExports(target, "."), target);
    assertSome(resolveExports({ "./*": { types: [false, "./base-*.json"] } }, `./${segment}`), target);
    assertNone(resolveExports(parsed, "./absent"));
  }), runs);

  it.layer(Path.layer, { timeout: "10 seconds" })("filesystem target fidelity", (it) => {
    it.effect.prop("relative and slash-normalized specifiers select the same file and resolving the absolute result is idempotent", [Arbitrary.schema(Segment)], ([segment]) => Effect.gen(function* () {
      const absolute = `/project/base-${segment}.json`;
      const memory = yield* MemoryFileSystem.makeHandle({ [absolute]: "{}" });
      const lookup = (spec: string) => resolveExtendsTarget(spec, "/project/config.json").pipe(Effect.provideService(FileSystem.FileSystem, memory.fileSystem));
      assertSome(yield* lookup(`./base-${segment}`), absolute);
      assertSome(yield* lookup(`.\\base-${segment}.json`), absolute);
      assertSome(yield* lookup(absolute), absolute);
      assertNone(yield* lookup(`./missing-${segment}.json`));
    }), runs);
  });
});
