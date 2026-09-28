/**
 * Module-load proof for the compiled-host smoke. The module guards its side
 * effects behind `import.meta.main`, so importing it from a test executes
 * every declaration (schemas, decoders, the stdio conversation builder)
 * without spawning a host or compiling a binary — the same shape as the uspto
 * host's "imports the bin module without launching" proof. `bin.ts` is left
 * out: its module graph loads the PGlite wasm at import time.
 */
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect } from "effect";
import * as P from "effect/Predicate";

describe("@beep/practice-kg-mcp entrypoints", () => {
  it.effect(
    "imports the compiled-host smoke module without running it",
    Effect.fnUntraced(function* () {
      const smoke = yield* Effect.promise(() => import("../src/smoke.ts"));
      assertTrue(P.isObject(smoke));
    })
  );
});
