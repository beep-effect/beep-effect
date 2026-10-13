import { assertExitFailure } from "@effect/vitest/utils";
import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { PackageManagerDetector } from "../../effected/workspaces/PackageManagerName.ts";

describe("PackageManagerDetector coverage", () => {
  it.effect("the unstubbed layer defects with a diagnostic naming detect", () => Effect.gen(function* () {
    const detector = PackageManagerDetector.makeTest();
    const exit = yield* Effect.exit(detector.detect("/repo"));
    if (Exit.isFailure(exit)) assertExitFailure(exit, exit.cause);
    else assert.fail("expected a defect");
    if (Exit.isFailure(exit)) assert.include(Cause.pretty(exit.cause), "detect() was called but not stubbed");
  }));
});

import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { PackageManagerDetectionError } from "../../effected/workspaces/PackageManagerName.ts";

it.effect("detection errors render the checked markers", () => Effect.sync(() => {
  assert.strictEqual(PackageManagerDetectionError.make({ root: "/repo", checked: ["bun.lock", "yarn.lock"] }).message,
    "No package manager detected at /repo (checked bun.lock, yarn.lock)");
}));
it.layer(PackageManagerDetector.layer.pipe(Layer.provideMerge(Layer.mergeAll(Path.layer, MemoryFileSystem.layerWith({
  "/repo/package.json": "{}",
}, { faults: { readFileString: () => Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", module: "FileSystem", method: "readFileString" })) } })))), { timeout: "30 seconds" })((it) => {
  it.effect("an unreadable manifest is a read failure, not missing evidence", () => Effect.gen(function* () {
    const detector = yield* PackageManagerDetector;
    const error = yield* Effect.flip(detector.detect("/repo"));
    assert.strictEqual(error._tag, "WorkspaceManifestError");
    if (error._tag === "WorkspaceManifestError") assert.strictEqual(error.kind, "read");
  }));
});

const appearingLock = MemoryFileSystem.layerWith({ "/repo/package.json": '{"packageManager":"yarn@4.0.0"}' }, {
  faults: () => {
    let probes = 0;
    return { exists: (file) => {
      if (file !== "/repo/yarn.lock") return undefined;
      probes += 1;
      return Effect.succeed(probes > 1);
    } };
  },
});
it.layer(PackageManagerDetector.layer.pipe(Layer.provideMerge(Layer.mergeAll(Path.layer, appearingLock))), { timeout: "30 seconds" })((it) => {
  it.effect("a yarn lock appearing during detection is recognized at the second probe", () => Effect.gen(function* () {
    const detector = yield* PackageManagerDetector;
    const detected = yield* detector.detect("/repo");
    assert.strictEqual(detected.evidence, "yarn.lock");
    assert.strictEqual(detected.name, "yarn");
  }));
});
