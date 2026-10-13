import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ReferenceScanner } from "../../../effected/markdown/internal/references.ts";
it.effect("escaped final punctuation advances past both source characters", () => Effect.sync(() => {
  assert.strictEqual(new ReferenceScanner("(unfinished").parseLinkDestination(), undefined);
  const scanner = new ReferenceScanner("path\\)");
  assert.strictEqual(scanner.parseLinkDestination(), "path)");
  assert.strictEqual(scanner.pos, 6);
  assert.strictEqual(scanner.peek(), -1);
}));
