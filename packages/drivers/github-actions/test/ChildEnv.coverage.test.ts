import { ChildEnv } from "@beep/github-actions/ChildEnv";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

it.effect("Windows requests a shell while POSIX platforms use direct execution", () =>
  Effect.sync(() => {
    assert.isTrue(ChildEnv.needsShell("win32"));
    assert.isFalse(ChildEnv.needsShell("linux"));
    assert.isFalse(ChildEnv.needsShell("darwin"));
  })
);
