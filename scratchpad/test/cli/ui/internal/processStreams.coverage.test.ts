import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { processStreams } from "../../../../effected/cli/ui/internal/processStreams.ts";
it.effect("returns the current process stream identities on every call", () => Effect.sync(() => {
  const first = processStreams();
  const second = processStreams();
  assert.strictEqual(first.stdin, process.stdin);
  assert.strictEqual(first.stdout, process.stdout);
  assert.strictEqual(first.stderr, process.stderr);
  assert.notStrictEqual(first, second);
  assert.deepStrictEqual(second, first);
}));
