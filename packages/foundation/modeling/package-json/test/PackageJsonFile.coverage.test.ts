import { MemoryFileSystem } from "@beep/memfs";
import { Package } from "@beep/package-json/Package";
import {
  PackageJsonFile,
  PackageJsonNotFoundError,
  PackageJsonParseError,
  PackageJsonReadError,
  PackageJsonWriteError,
} from "@beep/package-json/PackageJsonFile";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

it.effect("file errors report their operation and target", () =>
  Effect.sync(() => {
    assert.strictEqual(
      PackageJsonReadError.make({ path: "/p", cause: new Error("read") }).message,
      'Failed to read package.json from "/p"'
    );
    assert.strictEqual(PackageJsonNotFoundError.make({ path: "/p" }).message, 'package.json not found at "/p"');
    assert.strictEqual(
      PackageJsonParseError.make({ path: "/p", cause: new Error("parse") }).message,
      'Failed to parse package.json at "/p"'
    );
    assert.strictEqual(
      PackageJsonWriteError.make({ path: "/p", cause: new Error("write") }).message,
      'Failed to write package.json to "/p"'
    );
  })
);
const TestLayer = PackageJsonFile.layer.pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      MemoryFileSystem.layerWith({ "/file": "{}", "/p/package.json": '{"name":"p","version":"1.0.0"}' }),
      Path.layer
    )
  )
);
it.layer(TestLayer, { timeout: "30 seconds" })((it) => {
  it.effect("directory reads map to read errors, blocked writes map to write errors, empty edits retain bytes", () =>
    Effect.gen(function* () {
      const service = yield* PackageJsonFile;
      const fs = yield* FileSystem.FileSystem;
      const readError = yield* Effect.flip(service.read("/p"));
      assert.strictEqual(readError._tag, "PackageJsonReadError");
      const pkg = yield* Package.decode({ name: "p", version: "1.0.0" });
      const writeError = yield* Effect.flip(service.write("/file/package.json", pkg));
      assert.strictEqual(writeError._tag, "PackageJsonWriteError");
      const modify1 = yield* service.modify("/p/package.json", []);
      assert.strictEqual(modify1, '{"name":"p","version":"1.0.0"}');
      const readFileString2 = yield* fs.readFileString("/p/package.json");
      assert.strictEqual(readFileString2, '{"name":"p","version":"1.0.0"}');
    })
  );
});
