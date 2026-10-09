import { assert, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { hooksError, ioOrNone, messageOf, manifestVersion } from "../../../effected/workspaces/internal/configDependencyShared.ts";

const fs = process.getBuiltinModule("node:fs/promises");
const path = process.getBuiltinModule("node:path");
it.effect("IO absence and non-filesystem failures retain the correct typed boundary", () => Effect.gen(function* () {
  assertNone(yield* ioOrNone("p", () => Promise.reject({ code: "ENOTDIR" })));
  assertSome(yield* ioOrNone(() => Promise.resolve("value"))("p"), "value");
  const failure = yield* Effect.flip(ioOrNone("p", () => Promise.reject("plain rejection")));
  assert.strictEqual(failure.cause, "plain rejection");
  assert.strictEqual(messageOf(failure.cause), "plain rejection");
  assert.strictEqual(hooksError("failure", undefined)("p").source, "hooks");
}));
it.effect("invalid JSON is a hooks failure instead of an absent or unversioned manifest", () => Effect.gen(function* () {
  const dir = yield* Effect.acquireRelease(Effect.promise(() => fs.mkdtemp("/tmp/workspaces-v6-shared-")), (dir) => Effect.promise(() => fs.rm(dir, { recursive: true, force: true })));
  yield* Effect.promise(() => fs.writeFile(path.join(dir, "package.json"), "{"));
  const failure = yield* Effect.flip(manifestVersion(dir)("pkg"));
  assert.strictEqual(failure.path, "pkg");
  assert.strictEqual(failure.source, "hooks");
  assert.instanceOf(failure.cause, Error);
}));
