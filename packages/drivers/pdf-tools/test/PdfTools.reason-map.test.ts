/**
 * Reason map for the PDF tools process boundary: every failure the driver
 * could report before it moved onto `@beep/commands` `Run.collect` still maps
 * to the same reason, message and cause.
 */
import { DEFAULT_MAX_OUTPUT_BYTES } from "@beep/commands/Run";
import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { PageTextRequest, PdfTools, PdfToolsConfig, PdfToolsError } from "@beep/pdf-tools";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";

const PAGE_TEXT = "extracting the text of page 1";

const readFailure = PlatformError.systemError({
  _tag: "Unknown",
  module: "ChildProcess",
  method: "fromReadable(stdout)",
  description: "stdout pipe broke",
});

const handleWith = (stdout: Stream.Stream<Uint8Array, PlatformError.PlatformError>) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.empty,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    stderr: Stream.empty,
    stdin: Sink.drain,
    stdout,
    unref: Effect.succeed(Effect.void),
  });

const readFailingHandle = readFailure.pipe(Stream.fail, handleWith);

// One byte past the kit's default per-stream capture budget.
const oversizedStdout = Stream.succeed(new Uint8Array(DEFAULT_MAX_OUTPUT_BYTES + 1).fill(0x61));
const oversizedHandle = handleWith(oversizedStdout);

const spawnerOf = (spawn: () => Effect.Effect<ChildProcessSpawner.ChildProcessHandle, PlatformError.PlatformError>) =>
  Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, ChildProcessSpawner.make(spawn));

const toolsOver = (spawner: Layer.Layer<ChildProcessSpawner.ChildProcessSpawner>) =>
  PdfTools.makeLayer(PdfToolsConfig.make({ timeoutMillis: 50 })).pipe(
    Layer.provide(spawner),
    // pageText touches no file, so a no-op file system proves it never does.
    Layer.provide(Layer.merge(FileSystem.layerNoop({}), Path.layer))
  );

const pageText = Effect.gen(function* () {
  const tools = yield* PdfTools;
  return yield* tools.pageText(PageTextRequest.make({ pdfPath: "sheets.pdf", page: 1 }));
});

describe("@beep/pdf-tools process reason map", () => {
  const spawnFailure = ScriptedSpawner.notFound("pdftotext");
  it.layer(toolsOver(spawnerOf(() => Effect.fail(spawnFailure))), { timeout: "30 seconds" })(
    "when the executable cannot start",
    (it) => {
      it.effect(
        "maps to tool-unavailable with the platform message as its cause",
        Effect.fnUntraced(function* () {
          const error = yield* Effect.flip(pageText);
          assertInstanceOf(error, PdfToolsError);
          expect(error.reason).toBe("tool-unavailable");
          expect(error.message).toBe("Failed to run pdftotext; is it installed?");
          assertSome(error.cause, spawnFailure.message);
        })
      );
    }
  );

  it.layer(toolsOver(spawnerOf(() => Effect.succeed(readFailingHandle))), { timeout: "30 seconds" })(
    "when reading the output fails",
    (it) => {
      it.effect(
        "maps to tool-unavailable with the read failure message as its cause",
        Effect.fnUntraced(function* () {
          const error = yield* Effect.flip(pageText);
          assertInstanceOf(error, PdfToolsError);
          expect(error.reason).toBe("tool-unavailable");
          expect(error.message).toBe("Failed to run pdftotext; is it installed?");
          assertSome(error.cause, readFailure.message);
        })
      );
    }
  );

  it.layer(toolsOver(ScriptedSpawner.make(() => ({ exit: 4, stderr: "  Syntax Error  \n" })).layer), {
    timeout: "30 seconds",
  })("when the process exits non-zero", (it) => {
    it.effect(
      "maps to tool-failed with the trimmed stderr as its cause",
      Effect.fnUntraced(function* () {
        const error = yield* Effect.flip(pageText);
        assertInstanceOf(error, PdfToolsError);
        expect(error.reason).toBe("tool-failed");
        expect(error.message).toBe(`pdftotext exited 4 while ${PAGE_TEXT}.`);
        assertSome(error.cause, "Syntax Error");
      })
    );
  });

  it.layer(toolsOver(ScriptedSpawner.make(() => ({ hang: true })).layer), { timeout: "30 seconds" })(
    "when the process outlives the timeout",
    (it) => {
      it.effect(
        "maps to tool-failed with the timeout message and no cause",
        Effect.fnUntraced(function* () {
          const fiber = yield* Effect.flip(pageText).pipe(Effect.forkChild);
          yield* TestClock.adjust("50 millis");
          const error = yield* Fiber.join(fiber);
          assertInstanceOf(error, PdfToolsError);
          expect(error.reason).toBe("tool-failed");
          expect(error.message).toBe(`pdftotext timed out after 50 ms while ${PAGE_TEXT}.`);
          assertNone(error.cause);
        })
      );
    }
  );

  // New with the kit: captured output is bounded. The hand-rolled fold had no
  // ceiling, so this row has no predecessor; it reports as a failing tool run.
  it.layer(toolsOver(spawnerOf(() => Effect.succeed(oversizedHandle))), { timeout: "30 seconds" })(
    "when the output exceeds the capture bound",
    (it) => {
      it.effect(
        "maps to tool-failed",
        Effect.fnUntraced(function* () {
          const error = yield* Effect.flip(pageText);
          assertInstanceOf(error, PdfToolsError);
          expect(error.reason).toBe("tool-failed");
          expect(error.message).toBe(`pdftotext produced more output than the capture limit while ${PAGE_TEXT}.`);
        })
      );
    }
  );
});
