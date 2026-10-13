import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Runtime from "effect/Runtime";
import { ExitRequested } from "../../../effected/cli/internal/ExitRequested.ts";

it.effect("exit requests expose their message and runtime code without claiming to be reported", () => Effect.sync(() => {
  const error = ExitRequested.make({ code: 23 });
  assert.strictEqual(error.message, "exit 23");
  assert.strictEqual(error.name, "ExitRequested");
  assert.strictEqual(error[Runtime.errorExitCode], 23);
  assert.strictEqual(error[Runtime.errorReported], false);
}));
