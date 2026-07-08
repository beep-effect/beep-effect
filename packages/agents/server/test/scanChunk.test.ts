/**
 * Property test: the incremental block extractor must produce exactly the
 * envelope's elements regardless of how the structured-output text is chunked,
 * including strings containing braces, brackets, quotes, and escapes.
 */

import { initialScanState, scanChunk } from "@beep/agents-server/AssistantTurn";
import { fcRuns } from "@beep/test-utils";
import { FastCheck as fc } from "effect/testing";
import { describe, expect, test } from "vitest";
import type { ScanState } from "@beep/agents-server/AssistantTurn";

const scanAll = (text: string, cuts: ReadonlyArray<number>): Array<string> => {
  const out: Array<string> = [];
  let state: ScanState = initialScanState;
  let position = 0;
  for (const cut of [...cuts, text.length]) {
    const end = Math.min(Math.max(cut, position), text.length);
    const [next, completed] = scanChunk(state, text.slice(position, end));
    state = next;
    out.push(...completed);
    position = end;
  }
  return out;
};

const nastyString = fc.string({
  unit: fc.constantFrom("a", "{", "}", "[", "]", '"', "\\", "\n", "🙂", ":"),
});

const block = fc.record({
  type: fc.constantFrom("paragraph", "code", "mermaid", "table", "youtube"),
  text: nastyString,
  nested: fc.array(fc.record({ text: nastyString }), { maxLength: 2 }),
});

describe("scanChunk", () => {
  test("any envelope x any chunking yields exactly the elements", () => {
    fc.assert(
      fc.property(fc.array(block, { maxLength: 5 }), fc.array(fc.nat(2000), { maxLength: 30 }), (blocks, rawCuts) => {
        const envelope = JSON.stringify({ blocks });
        const cuts = [...rawCuts].sort((a, b) => a - b);
        const slices = scanAll(envelope, cuts);
        expect(slices.length).toBe(blocks.length);
        slices.forEach((slice, index) => {
          expect(JSON.parse(slice)).toEqual(blocks[index]);
        });
      }),
      fcRuns(200)
    );
  });

  test("single-character chunking", () => {
    const blocks = [{ type: "code", code: 'if (a["}{"]) { return "\\"]}" }' }];
    const envelope = JSON.stringify({ blocks });
    const slices = scanAll(
      envelope,
      Array.from({ length: envelope.length }, (_, i) => i)
    );
    expect(slices.map((s) => JSON.parse(s))).toEqual(blocks);
  });
});
