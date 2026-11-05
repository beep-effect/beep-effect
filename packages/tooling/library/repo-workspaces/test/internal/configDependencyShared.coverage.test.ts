import { MemoryFileSystem } from "@beep/memfs";
import {
  hooksError,
  ioOrNone,
  manifestVersion,
  messageOf,
} from "@beep/repo-workspaces/internal/configDependencyShared";
import { assert, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";

const failure = (tag: "NotFound" | "BadResource" | "PermissionDenied", cause?: unknown) =>
  Effect.fail(
    PlatformError.systemError({
      _tag: tag,
      module: "FileSystem",
      method: "readFileString",
      pathOrDescriptor: "p",
      cause,
    })
  );

it.effect("IO absence and non-filesystem failures retain the correct typed boundary", () =>
  Effect.gen(function* () {
    const ioOrNone1 = yield* ioOrNone("p", failure("NotFound"));
    assertNone(ioOrNone1);
    const ioOrNone2 = yield* ioOrNone("p", failure("BadResource", { code: "ENOTDIR" }));
    assertNone(ioOrNone2);
    const value3 = yield* ioOrNone(Effect.succeed("value"))("p");
    assertSome(value3, "value");
    const denied = yield* Effect.flip(ioOrNone("p", failure("PermissionDenied", "plain rejection")));
    assert.instanceOf(denied.cause, PlatformError.PlatformError);
    assert.include(messageOf(denied.cause), "PermissionDenied");
    assert.strictEqual(messageOf("plain rejection"), "plain rejection");
    assert.strictEqual(hooksError("failure", undefined)("p").source, "hooks");
  })
);

it.layer(Layer.merge(MemoryFileSystem.layerWith({ "/pkg/package.json": "{" }), Path.layer), {
  timeout: "30 seconds",
})((it) => {
  it.effect("invalid JSON is a hooks failure instead of an absent or unversioned manifest", () =>
    Effect.gen(function* () {
      const failed = yield* Effect.flip(manifestVersion("/pkg")("pkg"));
      assert.strictEqual(failed.path, "pkg");
      assert.strictEqual(failed.source, "hooks");
      assert.instanceOf(failed.cause, Error);
    })
  );
});
