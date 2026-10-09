import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import serializer from "../../effected/cli/ui-testing-serializer.ts";
it.effect("snapshot entrypoint claims styled frames and normalizes ANSI to markup", () => Effect.sync(() => {
  assert.strictEqual(serializer.test("plain"), false);
  assert.strictEqual(serializer.test("\u001b[1mready\u001b[22m"), true);
  assert.strictEqual(serializer.serialize("\u001b[1mready\u001b[22m  "), "[b]ready[/b]");
}));
