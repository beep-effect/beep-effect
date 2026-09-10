import { CachePilotLogInput } from "@beep/repo-cli/commands/Cache";
import { extractCachePilotLog } from "@beep/repo-cli/test/Cache";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Result from "effect/Result";
import * as Str from "effect/String";

const prefix = "@beep/identity:lint: ";
const progress = "cache bypass, force executing 0123456789abcdef\n";
const input = CachePilotLogInput.make({
  computation: "@beep/identity#lint",
  taskHash: "0123456789abcdef",
  origin: "fresh",
  cacheEnabled: false,
  truncated: false,
  stdout: `${prefix}${progress}${prefix}task output\n`,
  stderr: "",
});

describe("real pilot capture boundary", () => {
  it.effect("preserves later progress-looking task text and ignores dependency groups", () =>
    Effect.gen(function* () {
      const taskText = "cache miss, executing 0123456789abcdef\n";
      const captured = yield* extractCachePilotLog(
        CachePilotLogInput.make({
          ...input,
          stdout: `@beep/types:lint: ${prefix}spoofed\n${prefix}${progress}${prefix}${taskText}${prefix}tail`,
        })
      );
      expect(captured).toBe(`${taskText}tail`);
    })
  );

  it.effect("requires the progress boundary to match both the task hash and cache origin", () =>
    Effect.gen(function* () {
      for (const changed of [
        CachePilotLogInput.make({ ...input, taskHash: "fedcba9876543210" }),
        CachePilotLogInput.make({ ...input, origin: "local-hit" }),
        CachePilotLogInput.make({ ...input, cacheEnabled: true }),
        CachePilotLogInput.make({ ...input, stdout: `${prefix}task output\n` }),
        CachePilotLogInput.make({ ...input, stderr: `${prefix}unexpected\n` }),
      ])
        expect(Result.isFailure(yield* extractCachePilotLog(changed).pipe(Effect.result))).toBe(true);
    })
  );

  it.effect("rejects truncated streams, ambiguous terminal controls and oversized task logs", () =>
    Effect.gen(function* () {
      for (const changed of [
        CachePilotLogInput.make({ ...input, truncated: true }),
        CachePilotLogInput.make({ ...input, stdout: `${input.stdout}\r` }),
        CachePilotLogInput.make({ ...input, stderr: "\u001b[0m" }),
        CachePilotLogInput.make({ ...input, stdout: `${prefix}${progress}${prefix}${Str.repeat(65537)("x")}` }),
      ])
        expect(Result.isFailure(yield* extractCachePilotLog(changed).pipe(Effect.result))).toBe(true);
    })
  );

  it.effect("extracts enabled fresh output and local replay without changing task text", () =>
    Effect.gen(function* () {
      const fresh = yield* extractCachePilotLog(
        CachePilotLogInput.make({
          ...input,
          cacheEnabled: true,
          stdout: `${prefix}cache miss, executing 0123456789abcdef\n${prefix}task output\n`,
        })
      );
      const replay = yield* extractCachePilotLog(
        CachePilotLogInput.make({
          ...input,
          cacheEnabled: true,
          origin: "local-hit",
          stdout: `${prefix}cache hit, replaying logs 0123456789abcdef\n${prefix}task output\n`,
        })
      );
      expect(fresh).toBe("task output\n");
      expect(replay).toBe(fresh);
    })
  );
});
