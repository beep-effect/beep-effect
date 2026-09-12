import { drainProcessStreams, streamConsole } from "@beep/repo-cli/test/Cli";
import { describe, expect, it } from "@effect/vitest";
import { Console, Effect } from "effect";
import * as A from "effect/Array";

type WriteFn = typeof process.stdout.write;

const captureStreams = <A>(
  run: () => A
): { readonly result: A; readonly stdout: ReadonlyArray<string>; readonly stderr: ReadonlyArray<string> } => {
  const stdout: Array<string> = [];
  const stderr: Array<string> = [];
  const originalOut = process.stdout.write;
  const originalErr = process.stderr.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout.push(String(chunk));
    return true;
  }) as WriteFn;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr.push(String(chunk));
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

  it.effect("drains both streams before continuing", () =>
    Effect.callback<boolean>((resume) => {
      drainProcessStreams(() => resume(Effect.succeed(true)));
    }).pipe(Effect.map((drained) => expect(drained).toBe(true)))
  );
});
