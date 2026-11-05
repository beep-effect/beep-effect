import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { MemoryFileSystem } from "@beep/memfs";
import { resolveExports, resolveExtendsTarget } from "@beep/repo-tsconfig/internal/extendsTarget";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const Segment = S.Int.check(S.isBetween({ minimum: 0, maximum: 100000 }));
const Exports = S.Struct({ ".": S.String, "./base": S.Struct({ types: S.String, default: S.String }) });

describe("extends target resolution properties", () => {
  it.effect.prop(
    "exports selection is stable under JSON encoding and selected targets resolve idempotently",
    [Arbitrary.schema(Segment)],
    ([segment]) =>
      Effect.gen(function* () {
        const target = `./base-${segment}.json`;
        const manifest = { ".": target, "./base": { types: target, default: "./ignored.json" } };
        const codec = S.fromJsonString(Exports);
        const argument = S.decodeEffect(codec);
        const value = yield* S.encodeEffect(codec)(manifest);
        const parsed = yield* argument(value);
        const argument1 = S.decodeEffect(codec);
        const value1 = yield* S.encodeEffect(codec)(parsed);
        const reparsed = yield* argument1(value1);
        assert.deepStrictEqual(resolveExports(reparsed, "./base"), resolveExports(parsed, "./base"));
        assert.deepStrictEqual(resolveExports(parsed, "./base"), {
          targets: [target, "./ignored.json"],
          blocked: false,
        });
        assert.deepStrictEqual(resolveExports(target, "."), { targets: [target], blocked: false });
        assert.deepStrictEqual(resolveExports({ "./*": { types: [false, "./base-*.json"] } }, `./${segment}`), {
          targets: [target],
          blocked: false,
        });
        assert.deepStrictEqual(resolveExports(parsed, "./absent"), { targets: [], blocked: false });
      }),
    runs
  );

  it.layer(Path.layer, { timeout: "10 seconds" })("filesystem target fidelity", (it) => {
    it.effect.prop(
      "relative and slash-normalized specifiers select the same file and resolving the absolute result is idempotent",
      [Arbitrary.schema(Segment)],
      ([segment]) =>
        Effect.gen(function* () {
          const absolute = `/project/base-${segment}.json`;
          const memory = yield* MemoryFileSystem.makeHandle({ [absolute]: "{}" });
          const lookup = (spec: string) =>
            resolveExtendsTarget(spec, "/project/config.json").pipe(
              Effect.provideService(FileSystem.FileSystem, memory.fileSystem)
            );
          const lookup1 = yield* lookup(`./base-${segment}`);
          assertSome(lookup1, absolute);
          const lookup2 = yield* lookup(`.\\base-${segment}.json`);
          assertSome(lookup2, absolute);
          const lookup3 = yield* lookup(absolute);
          assertSome(lookup3, absolute);
          const lookup4 = yield* lookup(`./missing-${segment}.json`);
          assertNone(lookup4);
        }),
      runs
    );
  });
});
