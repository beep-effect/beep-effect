import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { errnoTag, fallbackErrnoForTag } from "../../../effected/memfs/internal/errno.ts";

it.effect("busy errno and existence fallback preserve their Node classifications", () => Effect.sync(() => {
  assert.strictEqual(errnoTag("EBUSY"), "Busy");
  assert.strictEqual(errnoTag("EACCES"), "PermissionDenied");
  assert.strictEqual(fallbackErrnoForTag("AlreadyExists"), "EEXIST");
}));
