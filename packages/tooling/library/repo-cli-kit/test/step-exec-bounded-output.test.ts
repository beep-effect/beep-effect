import {
  BoundedOutput,
  boundedChunkReducer,
  collectBoundedText,
  emptyBoundedOutput,
  formatCommandLine,
  OutputBound,
  qualityStepOutputBound,
  repoRunOutputBound,
  runCaptured,
  runCapturedStreams,
  runFoldedStdout,
} from "@beep/repo-cli-kit/process/StepExec";
import { Str } from "@beep/utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Order from "effect/Order";
import * as Stream from "effect/Stream";

const encode = (value: string): Uint8Array => new TextEncoder().encode(value);

describe("StepExec bounded output fold", () => {
  const bound = OutputBound.make({ maxChars: 4, truncatedNotice: "!" });
  const reduce = boundedChunkReducer(bound);

  it("appends a chunk that fits within the bound", () => {
    expect(reduce(emptyBoundedOutput, "ab")).toEqual(BoundedOutput.make({ text: "ab", truncated: false }));
  });

  it("truncates a chunk that overflows the bound, slicing to the remaining budget", () => {
    expect(reduce(emptyBoundedOutput, "abcdef")).toEqual(BoundedOutput.make({ text: "abcd!", truncated: true }));
  });

  it("appends only the truncation notice when the text is already at the cap", () => {
    expect(reduce(BoundedOutput.make({ text: "abcd", truncated: false }), "e")).toEqual(
      BoundedOutput.make({ text: "abcd!", truncated: true })
    );
  });

  it("is idempotent once truncated", () => {
    const truncated = reduce(emptyBoundedOutput, "abcdef");
    expect(reduce(truncated, "ghi")).toBe(truncated);
  });

  it.effect(
    "folds a byte stream into bounded text with the truncation notice",
    Effect.fnUntraced(function* () {
      const result = yield* collectBoundedText(bound)(Stream.fromIterable([encode("ab"), encode("cdef")]));
      expect(result).toEqual(BoundedOutput.make({ text: "abcd!", truncated: true }));
    })
  );

  it.effect(
    "folds a short byte stream without truncating",
    Effect.fnUntraced(function* () {
      const result = yield* collectBoundedText(bound)(Stream.fromIterable([encode("hi")]));
      expect(result).toEqual(BoundedOutput.make({ text: "hi", truncated: false }));
    })
  );

  it("exposes the divergent repo-run and quality bounds", () => {
    expect(repoRunOutputBound.maxChars).toBe(512 * 1024);
    expect(qualityStepOutputBound.maxChars).toBe(8 * 1024 * 1024);
    expect(repoRunOutputBound.truncatedNotice).toContain("[repo-run]");
    expect(qualityStepOutputBound.truncatedNotice).toContain("[beep-cli]");
  });

  it("formats a command line", () => {
    expect(formatCommandLine("git", ["status", "--short"])).toBe("git status --short");
  });
});

layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "5 seconds" })(
  "StepExec process integration",
  (it) => {
    it.effect(
      "drains large stdout and stderr streams concurrently",
      Effect.fnUntraced(function* () {
        const charsPerStream = 1024 * 1024;
        const result = yield* runCapturedStreams({
          command: process.execPath,
          args: [
            "-e",
            `process.stdout.write("o".repeat(${charsPerStream}));process.stderr.write("e".repeat(${charsPerStream}));`,
          ],
        });

        expect(result.exitCode).toBe(0);
        expect(Str.length(result.stdout)).toBe(charsPerStream);
        expect(Str.length(result.stderr)).toBe(charsPerStream);
      })
    );
  }
);

layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "10 seconds" })(
  "StepExec split-stream capture",
  (it) => {
    it.effect(
      "trims both streams and bounds each one separately when asked",
      Effect.fnUntraced(function* () {
        const result = yield* runCapturedStreams({
          command: process.execPath,
          args: ["-e", 'process.stdout.write("  out  \\n");process.stderr.write("e".repeat(10));process.exit(3);'],
          stderrBound: OutputBound.make({ maxChars: 4, truncatedNotice: "!" }),
          trim: true,
        });

        expect(result.exitCode).toBe(3);
        expect(result.stdout).toBe("out");
        expect(result.stderr).toBe("eeee!");
        expect(result.truncated).toBe(true);
      })
    );

    it.effect(
      "folds stdout through the caller's collector and bounds stderr with the repo-run default",
      Effect.fnUntraced(function* () {
        const result = yield* runFoldedStdout({
          command: process.execPath,
          args: ["-e", 'process.stdout.write("abcdef");process.stderr.write("diagnostic");'],
          fold: (stdout) =>
            stdout.pipe(
              Stream.runFold(
                () => 0,
                (total: number, chunk: Uint8Array) => total + chunk.byteLength
              ),
              Effect.map(String)
            ),
        });

        expect(result.exitCode).toBe(0);
        expect(result.value).toBe("6");
        expect(result.stderr).toBe("diagnostic");
        expect(result.truncated).toBe(false);
      })
    );

    it.effect(
      "reports a clipped stderr under an explicit stderr bound",
      Effect.fnUntraced(function* () {
        const result = yield* runFoldedStdout({
          command: process.execPath,
          args: ["-e", 'process.stdout.write("x");process.stderr.write("diagnostic");'],
          fold: flow(Stream.decodeText(), Stream.mkString),
          stderrBound: OutputBound.make({ maxChars: 3, truncatedNotice: "~" }),
        });

        expect(result.value).toBe("x");
        expect(result.stderr).toBe("dia~");
        expect(result.truncated).toBe(true);
      })
    );

    it.effect(
      "merges stdout and stderr into one capture when the source is merge",
      Effect.fnUntraced(function* () {
        const captured = yield* runCaptured({
          command: process.execPath,
          args: [
            "-e",
            'process.stdout.write("from-stdout\\n");process.stderr.write("from-stderr\\n");process.exit(2);',
          ],
          source: "merge",
        });

        expect(captured.exitCode).toBe(2);
        expect(A.sort(A.filter(Str.split(captured.output, "\n"), Str.isNonEmpty), Order.String)).toEqual([
          "from-stderr",
          "from-stdout",
        ]);
      })
    );
  }
);
