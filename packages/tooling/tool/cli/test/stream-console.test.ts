import { drainProcessStreams, streamConsole } from "@beep/repo-cli/test/Cli";
import { StepExec } from "@beep/repo-cli/test/PackageScripts";
import { provideScopedLayer } from "@beep/test-utils";
import { P } from "@beep/utils";
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
    stdout.push(P.isString(chunk) ? chunk : new TextDecoder().decode(chunk));
    callback?.();
    return true;
  }) as WriteFn;
  process.stderr.write = ((chunk: string | Uint8Array, callback?: () => void) => {
    stderr.push(P.isString(chunk) ? chunk : new TextDecoder().decode(chunk));
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

  it("holds the drain until the last of several in-flight writes completes", () => {
    const callbacks: Array<() => void> = [];
    const originalOut = process.stdout.write;
    const originalErr = process.stderr.write;
    const queueWrite = ((_chunk: string | Uint8Array, callback?: () => void) => {
      if (callback !== undefined) {
        callbacks.push(callback);
      }
      return true;
    }) as WriteFn;
    process.stdout.write = queueWrite;
    process.stderr.write = queueWrite;
    try {
      streamConsole.log("first");
      streamConsole.error("second");
      streamConsole.log("third");
      expect(callbacks).toHaveLength(2);
      let drained = false;
      drainProcessStreams(() => {
        drained = true;
      });
      // Stderr can finish independently; stdout preserves its FIFO order.
      callbacks[1]?.();
      expect(drained).toBe(false);
      callbacks[0]?.();
      expect(drained).toBe(false);
      expect(callbacks).toHaveLength(3);
      callbacks[2]?.();
      expect(drained).toBe(true);
    } finally {
      process.stdout.write = originalOut;
      process.stderr.write = originalErr;
    }
  });

  it("serializes a 100 KiB UTF-8 line and later logs through bounded callback-driven chunks", () => {
    const chunks: Array<Uint8Array> = [];
    const callbacks: Array<() => void> = [];
    const encoder = new TextEncoder();
    const line = Str.repeat(20 * 1024)("€ab");
    expect(encoder.encode(line).byteLength).toBe(100 * 1024);
    const expected = encoder.encode(`${line}\nFOOTER\n`);
    const originalOut = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array, callback?: () => void) => {
      chunks.push(P.isString(chunk) ? encoder.encode(chunk) : chunk);
      if (callback !== undefined) {
        callbacks.push(callback);
      }
      return false;
    }) as WriteFn;
    try {
      streamConsole.log(line);
      streamConsole.log("FOOTER");
      expect(chunks).toHaveLength(1);
      let drained = false;
      drainProcessStreams(() => {
        drained = true;
      });
      let offset = 0;
      for (const [index, callback] of callbacks.entries()) {
        expect(drained).toBe(false);
        const chunk = chunks[index];
        expect(chunk).toBeDefined();
        if (chunk !== undefined) {
          expect(chunk.byteLength).toBeLessThanOrEqual(8192);
          expect(chunk).toEqual(expected.subarray(offset, offset + chunk.byteLength));
          offset += chunk.byteLength;
        }
        expect(chunks).toHaveLength(index + 1);
        callback();
      }
      expect(offset).toBe(expected.byteLength);
      expect(drained).toBe(true);
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
        'streamConsole.log("x".repeat(4 * 1024 * 1024) + "FOOTER");',
        "drainProcessStreams(() => process.exit(0));",
      ].join("\n");
      const child = yield* StepExec.runCaptured({
        command: "bun",
        args: ["--eval", script, modulePath],
        cwd: new URL("..", import.meta.url).pathname,
        source: "stdout",
        bound: StepExec.OutputBound.make({ maxChars: 5 * 1024 * 1024, truncatedNotice: "\n[test] truncated" }),
        timeout: "60 seconds",
        extendEnv: true,
      });
      expect(child.exitCode).toBe(0);
      expect(child.truncated).toBe(false);
      expect(Str.length(child.output)).toBe(4 * 1024 * 1024 + Str.length("FOOTER\n"));
      expect(Str.endsWith("FOOTER\n")(child.output)).toBe(true);
    }, provideScopedLayer(NodeServices.layer)),
    { timeout: 90_000 }
  );
});
