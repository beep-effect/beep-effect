import { drainProcessStreams, streamConsole } from "@beep/repo-cli/test/Cli";
import { StepExec } from "@beep/repo-cli/test/PackageScripts";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Console, Effect } from "effect";
import * as A from "effect/Array";
import * as Str from "effect/String";

type WriteFn = typeof process.stdout.write;

const captureStreams = <A>(
  run: () => A
): { readonly result: A; readonly stdout: ReadonlyArray<string>; readonly stderr: ReadonlyArray<string> } => {
  const stdout: Array<string> = [];
  const stderr: Array<string> = [];
  const originalOut = process.stdout.write;
  const originalErr = process.stderr.write;
  // Settle every write at once so the module's in-flight counter returns to zero.
  process.stdout.write = ((chunk: string | Uint8Array, callback?: () => void) => {
    stdout.push(String(chunk));
    callback?.();
    return true;
  }) as WriteFn;
  process.stderr.write = ((chunk: string | Uint8Array, callback?: () => void) => {
    stderr.push(String(chunk));
    callback?.();
    return true;
  }) as WriteFn;
  try {
    return { result: run(), stdout, stderr };
  } finally {
    process.stdout.write = originalOut;
    process.stderr.write = originalErr;
  }
};

describe("stream console", () => {
  it("routes log-like calls to stdout and error-like calls to stderr as single lines", () => {
    const { stdout, stderr } = captureStreams(() => {
      streamConsole.log("hello", 1, { a: [1, 2] });
      streamConsole.info("info");
      streamConsole.debug("debug");
      streamConsole.dir({ b: 2 });
      streamConsole.dirxml("dirxml");
      streamConsole.group("group");
      streamConsole.groupCollapsed("collapsed");
      streamConsole.table([{ c: 3 }]);
      streamConsole.timeLog("timer", "detail");
      streamConsole.error("boom", new Error("cause").message);
      streamConsole.warn("careful");
      streamConsole.trace("where");
      streamConsole.assert(true, "silent");
      streamConsole.assert(false, "loud");
    });
    expect(stdout).toEqual([
      'hello 1 {\n  "a": [\n    1,\n    2\n  ]\n}\n',
      "info\n",
      "debug\n",
      '{\n  "b": 2\n}\n',
      "dirxml\n",
      "group\n",
      "collapsed\n",
      '[\n  {\n    "c": 3\n  }\n]\n',
      "timer detail\n",
    ]);
    expect(stderr).toEqual(["boom cause\n", "careful\n", "where\n", "Assertion failed: loud\n"]);
  });

  it("treats grouping, counting, and timing bookkeeping as silent", () => {
    const { stdout, stderr } = captureStreams(() => {
      streamConsole.clear();
      streamConsole.count("c");
      streamConsole.countReset("c");
      streamConsole.groupEnd();
      streamConsole.time("t");
      streamConsole.timeEnd("t");
    });
    expect(A.isReadonlyArrayEmpty(stdout)).toBe(true);
    expect(A.isReadonlyArrayEmpty(stderr)).toBe(true);
  });

  it("serves Effect Console.log once provided to a program", () => {
    const { stdout } = captureStreams(() =>
      Effect.runSync(Console.log("through effect").pipe(Effect.provideService(Console.Console, streamConsole)))
    );
    expect(stdout).toEqual(["through effect\n"]);
  });

  it("waits for the tracked writes to complete before continuing", () => {
    const callbacks: Array<() => void> = [];
    const originalOut = process.stdout.write;
    process.stdout.write = ((_chunk: string | Uint8Array, callback?: () => void) => {
      if (callback !== undefined) {
        callbacks.push(callback);
      }
      return true;
    }) as WriteFn;
    try {
      streamConsole.log("queued");
      let drained = false;
      drainProcessStreams(() => {
        drained = true;
      });
      expect(drained).toBe(false);
      for (const callback of callbacks) {
        callback();
      }
      expect(drained).toBe(true);
      // Nothing in flight: the continuation runs synchronously.
      let immediate = false;
      drainProcessStreams(() => {
        immediate = true;
      });
      expect(immediate).toBe(true);
    } finally {
      process.stdout.write = originalOut;
    }
  });

  it.effect(
    "delivers a large block through a pipe before a forced exit under Bun",
    Effect.fnUntraced(function* () {
      const modulePath = new URL("../src/internal/cli/Stdout.ts", import.meta.url).pathname;
      const script = [
        "const { streamConsole, drainProcessStreams } = await import(process.argv[1]);",
        'streamConsole.log("x".repeat(1024 * 1024) + "FOOTER");',
        "drainProcessStreams(() => process.exit(0));",
      ].join("\n");
      const child = yield* StepExec.runCaptured({
        command: "bun",
        args: ["--eval", script, modulePath],
        cwd: new URL("..", import.meta.url).pathname,
        source: "stdout",
        bound: StepExec.OutputBound.make({ maxChars: 4 * 1024 * 1024, truncatedNotice: "\n[test] truncated" }),
        timeout: "60 seconds",
        extendEnv: true,
      });
      expect(child.exitCode).toBe(0);
      expect(child.truncated).toBe(false);
      expect(Str.length(child.output)).toBe(1024 * 1024 + Str.length("FOOTER\n"));
      expect(Str.endsWith("FOOTER\n")(child.output)).toBe(true);
    }, provideScopedLayer(NodeServices.layer)),
    { timeout: 90_000 }
  );
});
