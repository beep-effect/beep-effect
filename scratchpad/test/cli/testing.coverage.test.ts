import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { CliTest, TestTerminal } from "../../effected/cli/testing.ts";
import { CliTest as DirectCliTest } from "../../effected/cli/CliTest.ts";
import { TestTerminal as DirectTerminal } from "../../effected/cli/TestTerminal.ts";
it.effect("testing entrypoint reexports the hermetic runner and terminal implementations", () => Effect.sync(() => {
  assert.strictEqual(CliTest, DirectCliTest);
  assert.strictEqual(TestTerminal, DirectTerminal);
}));
