/**
 * Module-load proof for the compiled-host smoke. The module guards its side
 * effects behind `import.meta.main`, so importing it from a test executes
 * every declaration (schemas, decoders, the stdio conversation builder)
 * without spawning a host or compiling a binary — the same shape as the uspto
 * host's "imports the bin module without launching" proof. `bin.ts` is left
 * out: its module graph loads the PGlite wasm at import time.
 */
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { verifyCompiledClaimInspection } from "../src/smoke.ts";

describe("@beep/practice-kg-mcp entrypoints", () => {
  it.effect(
    "imports the compiled-host smoke module without running it",
    Effect.fnUntraced(function* () {
      const smoke = yield* Effect.promise(() => import("../src/smoke.ts"));
      assertTrue(P.isObject(smoke));
    })
  );
});

const encodeWire = S.encodeEffect(S.fromJsonString(S.Unknown));
const inspectionPage = (status: string, heads: ReadonlyArray<string>) =>
  encodeWire({
    records: [
      { status, findings: [], decomposition: { tree: { elements: [{ terms: A.map(heads, (head) => ({ head })) }] } } },
    ],
  });
const wireResponse = (text: string) => encodeWire({ result: { content: [{ type: "text", text }] } });

describe("compiled inspection response contract", () => {
  it.effect(
    "accepts the refined complete source page",
    Effect.fnUntraced(function* () {
      const page = yield* inspectionPage("complete", ["system", "sensor", "signal", "controller", "signals"]);
      const wire = yield* wireResponse(page);
      yield* verifyCompiledClaimInspection(wire);
    })
  );
  it.effect(
    "rejects partial availability fallback even when the terms are refined",
    Effect.fnUntraced(function* () {
      const page = yield* inspectionPage("partial", ["system", "sensor", "signal", "controller", "signals"]);
      const wire = yield* wireResponse(page);
      const failure = yield* Effect.flip(verifyCompiledClaimInspection(wire));
      assert.include(failure.message, "coverage is partial");
    })
  );
  it.effect(
    "rejects legacy predicate-bearing terms and malformed wire pages",
    Effect.fnUntraced(function* () {
      const page = yield* inspectionPage("complete", ["system", "sensor", "signal", "controller", "process signals"]);
      const wire = yield* wireResponse(page);
      const failure = yield* Effect.flip(verifyCompiledClaimInspection(wire));
      assert.include(failure.message, "did not apply source-aligned");
      const envelope = yield* Effect.flip(verifyCompiledClaimInspection("{}"));
      assert.include(envelope.message, "tool response was invalid");
      const badPage = yield* wireResponse("{}");
      const invalid = yield* Effect.flip(verifyCompiledClaimInspection(badPage));
      assert.include(invalid.message, "encoded source page");
      const empty = yield* encodeWire({ result: { content: [] } });
      const absent = yield* Effect.flip(verifyCompiledClaimInspection(empty));
      assert.include(absent.message, "encoded source page");
    })
  );
});
