import { assert, describe, it, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import * as S from "effect/Schema";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { TsconfigJson } from "../../effected/tsconfig-json/TsconfigJson.ts";
import { TsconfigLoader } from "../../effected/tsconfig-json/TsconfigLoader.ts";
import { TsconfigLoaderSync } from "../../effected/tsconfig-json/TsconfigLoaderSync.ts";

const path = Path.layer.pipe(Layer.build, Effect.map(Context.get(Path.Path)), Effect.scoped, Effect.runSync);
const options = { fileSystem: MemoryFileSystem.makeSync({ "/project/tsconfig.json": "{}" }).sync, path };
const Unsupported = S.TaggedStruct("UnsupportedPathOperationError", { message: S.String });

const capture = (run: () => unknown): unknown => {
  try {
    run();
    assert.fail("expected a thrown failure");
  } catch (error) {
    return error;
  }
};

const unsupportedOperations: ReadonlyArray<readonly [string, (service: Path.Path) => unknown]> = [
  ["sep", (service) => service.sep],
  ["extname", (service) => service.extname("a.json")],
  ["format", (service) => service.format({ name: "a" })],
  ["fromFileUrl", (service) => service.fromFileUrl(new URL("file:///a"))],
  ["normalize", (service) => service.normalize("/a/../b")],
  ["parse", (service) => service.parse("/a.json")],
  ["relative", (service) => service.relative("/a", "/b")],
  ["toFileUrl", (service) => service.toFileUrl("/a")],
  ["toNamespacedPath", (service) => service.toNamespacedPath("/a")],
];

describe("TsconfigLoaderSync adapter coverage", () => {
  for (const [member, invoke] of unsupportedOperations) {
    it.effect(`throws its named defect for unsupported Path.${member}`, () => Effect.gen(function* () {
      const spy = vi.spyOn(TsconfigLoader, "load").mockImplementation(() => Effect.gen(function* () {
        invoke(yield* Path.Path);
        return TsconfigJson.make({});
      }));
      try {
        const error = yield* S.decodeUnknownEffect(Unsupported)(capture(() => TsconfigLoaderSync.load("/project/tsconfig.json", options)));
        assert.strictEqual(error.message, `Path.${member} is not supported by TsconfigLoaderSync — its SyncPath adapter only carries resolve/dirname/join/isAbsolute/basename`);
      } finally {
        spy.mockRestore();
      }
    }));
  }

  it.effect("forwards every supported path operation to the supplied implementation", () => Effect.sync(() => {
    const spy = vi.spyOn(TsconfigLoader, "load").mockImplementation(() => Effect.gen(function* () {
      const service = yield* Path.Path;
      assert.strictEqual(service.basename("/a/config.json"), "config.json");
      assert.strictEqual(service.dirname("/a/config.json"), "/a");
      assert.strictEqual(service.join("/a", "b"), "/a/b");
      assert.strictEqual(service.resolve("/a", "../b"), "/b");
      assert.isTrue(service.isAbsolute("/a"));
      return TsconfigJson.make({ compilerOptions: { strict: true } });
    }));
    try {
      assert.deepStrictEqual(TsconfigLoaderSync.load("/project/tsconfig.json", options), TsconfigJson.make({ compilerOptions: { strict: true } }));
    } finally {
      spy.mockRestore();
    }
  }));

  it.effect("rethrows a consumer path defect by identity", () => Effect.sync(() => {
    const defect = { reason: "path unavailable" };
    const broken = { ...path, resolve: () => { throw defect; } };
    assert.strictEqual(capture(() => TsconfigLoaderSync.load("/project/tsconfig.json", { ...options, path: broken })), defect);
  }));

  it.effect("squashes interruption when a loader effect has neither typed failure nor defect", () => Effect.sync(() => {
    const spy = vi.spyOn(TsconfigLoader, "load").mockImplementation(() => Effect.interrupt);
    try {
      const error = capture(() => TsconfigLoaderSync.load("/project/tsconfig.json", options));
      assert.instanceOf(error, Error);
      if (error instanceof Error) assert.include(error.message, "interrupt");
    } finally {
      spy.mockRestore();
    }
  }));

  it.effect("the runtime facade has no instance-level state", () => Effect.sync(() => {
    assert.strictEqual(Object.getPrototypeOf(Reflect.construct(TsconfigLoaderSync, [])), TsconfigLoaderSync.prototype);
  }));
});
