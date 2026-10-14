import { assert, describe, it } from "@effect/vitest";
import { parentRealPath, walkFrames } from "../../effected/walker/internal/worklist.ts";

describe("head-index traversal worklist", () => {
  it("visits appended frames in queue order without consuming the array", () => {
    const frames = ["root"];
    const visited: Array<string> = [];
    for (const frame of walkFrames(frames)) {
      visited.push(frame);
      if (frame === "root") frames.push("first", "second");
    }
    assert.deepStrictEqual(visited, ["root", "first", "second"]);
    assert.deepStrictEqual(frames, visited);
  });

  it("stops at a missing frame instead of visiting subsequent entries", () => {
    const visited: Array<string> = [];
    for (const frame of walkFrames(["root", undefined, "unreachable"])) visited.push(frame);
    assert.deepStrictEqual(visited, ["root"]);
  });

  it("accepts an empty queue", () => {
    assert.deepStrictEqual([...walkFrames([])], []);
  });

  it("uses the last ancestor, falling back to the absolute path for an empty chain", () => {
    assert.strictEqual(parentRealPath(["/repo", "/target"], "/repo/link"), "/target");
    assert.strictEqual(parentRealPath([], "/repo/link"), "/repo/link");
    assert.strictEqual(parentRealPath("/repo/link")([]), "/repo/link");
  });
});
