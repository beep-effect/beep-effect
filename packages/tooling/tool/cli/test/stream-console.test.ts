import {
  drainProcessStreams,
  noteProcessStreamWriteFailure,
  ProcessStreamName,
  resetProcessStreamStateForTesting,
  StreamWriteFailure,
  streamConsole,
  writeBestEffortLine,
} from "@beep/repo-cli/test/Cli";
import { StepExec } from "@beep/repo-cli/test/PackageScripts";
import { provideScopedLayer } from "@beep/test-utils";
import { P } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { Console, Effect } from "effect";
import * as A from "effect/Array";
import * as MutableRef from "effect/MutableRef";
import * as O from "effect/Option";
import * as Str from "effect/String";

type WriteFn = typeof process.stdout.write;
type WriteCallback = (error?: Error | null) => void;

const captureStreams = <A>(
  run: () => A,
  options: {
    readonly stdoutWrite?: (chunk: string | Uint8Array, callback: WriteCallback) => boolean;
    readonly stderrWrite?: (chunk: string | Uint8Array, callback: WriteCallback) => boolean;
  } = {}
): { readonly result: A; readonly stdout: ReadonlyArray<string>; readonly stderr: ReadonlyArray<string> } => {
  const stdout: Array<string> = [];
  const stderr: Array<string> = [];
  // One streaming decoder per stream: a multi-byte sequence may straddle the writer's 8 KiB chunk
  // boundary, so each chunk is decoded with `stream: true` and the tail is flushed at the end.
  const decodeOut = new TextDecoder();
  const decodeErr = new TextDecoder();
  const originalOut = process.stdout.write;
  const originalErr = process.stderr.write;
  // Settle every write at once so the module's in-flight counter returns to zero.
  process.stdout.write = ((chunk: string | Uint8Array, callback?: WriteCallback) => {
    stdout.push(P.isString(chunk) ? chunk : decodeOut.decode(chunk, { stream: true }));
    if (options.stdoutWrite !== undefined && callback !== undefined) {
      return options.stdoutWrite(chunk, callback);
    }
    callback?.();
    return true;
  }) as WriteFn;
  process.stderr.write = ((chunk: string | Uint8Array, callback?: WriteCallback) => {
    stderr.push(P.isString(chunk) ? chunk : decodeErr.decode(chunk, { stream: true }));
    if (options.stderrWrite !== undefined && callback !== undefined) {
      return options.stderrWrite(chunk, callback);
    }
    callback?.();
    return true;
  }) as WriteFn;
  try {
    return { result: run(), stdout, stderr };
  } finally {
    process.stdout.write = originalOut;
    process.stderr.write = originalErr;
    const outTail = decodeOut.decode();
    if (Str.isNonEmpty(outTail)) {
      stdout.push(outTail);
    }
    const errTail = decodeErr.decode();
    if (Str.isNonEmpty(errTail)) {
      stderr.push(errTail);
    }
  }
};

describe("stream console", () => {
  beforeEach(resetProcessStreamStateForTesting);

  it("accepts a teardown notice on the preferred stream, including backpressure", () => {
    const originalOut = process.stdout.write;
    const originalErr = process.stderr.write;
    const preferred = A.empty<string>();
    const fallback = A.empty<string>();
    process.stderr.write = (line: string | Uint8Array) => {
      preferred.push(String(line));
      return false;
    };
    process.stdout.write = (line: string | Uint8Array) => {
      fallback.push(String(line));
      return true;
    };
    try {
      expect(writeBestEffortLine(process.stderr, process.stdout, "notice\n")).toBe(true);
      expect(preferred).toEqual(["notice\n"]);
      expect(fallback).toEqual([]);
    } finally {
      process.stdout.write = originalOut;
      process.stderr.write = originalErr;
    }
  });

  it("falls back for teardown notices when the preferred stream throws", () => {
    const originalOut = process.stdout.write;
    const originalErr = process.stderr.write;
    const fallback = A.empty<string>();
    process.stderr.write = () => {
      throw new Error("dead stderr");
    };
    process.stdout.write = (line: string | Uint8Array) => {
      fallback.push(String(line));
      return true;
    };
    try {
      expect(writeBestEffortLine(process.stderr, process.stdout, "notice\n")).toBe(true);
      expect(fallback).toEqual(["notice\n"]);
    } finally {
      process.stdout.write = originalOut;
      process.stderr.write = originalErr;
    }
  });

  it("returns false when both teardown streams throw", () => {
    const originalOut = process.stdout.write;
    const originalErr = process.stderr.write;
    process.stderr.write = () => {
      throw new Error("dead stderr");
    };
    process.stdout.write = () => {
      throw new Error("dead stdout");
    };
    try {
      expect(writeBestEffortLine(process.stderr, process.stdout, "notice\n")).toBe(false);
    } finally {
      process.stdout.write = originalOut;
      process.stderr.write = originalErr;
    }
  });

  for (const stream of ProcessStreamName.Options) {
    it(`records only the first external ${stream} failure and drains its sibling marker`, () => {
      const failure = MutableRef.make<O.Option<StreamWriteFailure>>(O.none());
      const drained = MutableRef.make(false);
      const callback = MutableRef.make<O.Option<WriteCallback>>(O.none());
      const holdMarker = (_chunk: string | Uint8Array, onWritten: WriteCallback): boolean => {
        MutableRef.set(callback, O.some(onWritten));
        return true;
      };
      const { stdout, stderr } = captureStreams(
        () => {
          noteProcessStreamWriteFailure(stream, "first");
          noteProcessStreamWriteFailure(stream, "second");
          drainProcessStreams((value) => {
            MutableRef.set(failure, value);
            MutableRef.set(drained, true);
          });
          expect(MutableRef.get(drained)).toBe(false);
          callback.pipe(MutableRef.get, O.getOrThrow)();
          expect(MutableRef.get(drained)).toBe(true);
        },
        stream === "stdout" ? { stderrWrite: holdMarker } : { stdoutWrite: holdMarker }
      );
      expect(stream === "stdout" ? stdout : stderr).toEqual([]);
      expect(stream === "stdout" ? stderr : stdout).toEqual([
        `[beep-cli] ${stream} write failed: first; later ${stream} lines are dropped\n`,
      ]);
      assertSome(MutableRef.get(failure), StreamWriteFailure.make({ stream, message: "first", droppedLines: 1 }));
    });
  }

  it("keeps the first failure when an in-flight stdout chunk errors after another writer latched the stream", () => {
    const failure = MutableRef.make<O.Option<StreamWriteFailure>>(O.none());
    const held = MutableRef.make<O.Option<WriteCallback>>(O.none());
    const { stderr } = captureStreams(
      () => {
        streamConsole.log("in flight");
        // A JSON payload notes EPIPE while the console line's chunk is still pending.
        noteProcessStreamWriteFailure("stdout", "first");
        held.pipe(MutableRef.get, O.getOrThrow)(new Error("second"));
        drainProcessStreams((value) => MutableRef.set(failure, value));
      },
      {
        stdoutWrite: (_chunk, onWritten) => {
          MutableRef.set(held, O.some(onWritten));
          return true;
        },
      }
    );
    // One marker, the first message, and the in-flight line counted as dropped.
    expect(stderr).toEqual(["[beep-cli] stdout write failed: first; later stdout lines are dropped\n"]);
    assertSome(
      MutableRef.get(failure),
      StreamWriteFailure.make({ stream: "stdout", message: "first", droppedLines: 2 })
    );
  });

  it("aborts a line and drops later stdout lines after a write error", () => {
    const drained = MutableRef.make(false);
    const failure = MutableRef.make<O.Option<StreamWriteFailure>>(O.none());
    const { stdout, stderr } = captureStreams(
      () => {
        streamConsole.log(Str.repeat(100 * 1024)("a"));
        streamConsole.log("later one");
        streamConsole.log("later two");
        streamConsole.error("stderr survives");
        drainProcessStreams((value) => {
          MutableRef.set(drained, true);
          MutableRef.set(failure, value);
        });
        expect(MutableRef.get(drained)).toBe(true);
      },
      {
        stdoutWrite: (_chunk, callback) => {
          callback(new Error("EPIPE"));
          return false;
        },
      }
    );
    expect(stdout).toHaveLength(1);
    expect(new TextEncoder().encode(O.getOrThrow(A.head(stdout))).byteLength).toBeLessThanOrEqual(8192);
    expect(stderr).toEqual([
      "[beep-cli] stdout write failed: EPIPE; later stdout lines are dropped\n",
      "stderr survives\n",
    ]);
    assertSome(
      MutableRef.get(failure),
      StreamWriteFailure.make({
        stream: "stdout",
        message: "EPIPE",
        droppedLines: 3,
      })
    );
  });

  it("signals a stderr write error on stdout and drops later stderr lines", () => {
    const failure = MutableRef.make<O.Option<StreamWriteFailure>>(O.none());
    const { stdout, stderr } = captureStreams(
      () => {
        streamConsole.error("a");
        streamConsole.error("b");
        streamConsole.log("stdout survives");
        drainProcessStreams((value) => MutableRef.set(failure, value));
      },
      {
        stderrWrite: (_chunk, callback) => {
          callback(new Error("EPIPE"));
          return false;
        },
      }
    );
    expect(stdout).toEqual([
      "[beep-cli] stderr write failed: EPIPE; later stderr lines are dropped\n",
      "stdout survives\n",
    ]);
    expect(stderr).toEqual(["a\n"]);
    assertSome(
      MutableRef.get(failure),
      StreamWriteFailure.make({ stream: "stderr", message: "EPIPE", droppedLines: 2 })
    );
  });

  it("stays silent when both streams have failed", () => {
    const failure = MutableRef.make<O.Option<StreamWriteFailure>>(O.none());
    const failWrite = (_chunk: string | Uint8Array, callback: WriteCallback): boolean => {
      callback(new Error("EPIPE"));
      return false;
    };
    const { stdout, stderr } = captureStreams(
      () => {
        streamConsole.log("a");
        streamConsole.error("b");
        drainProcessStreams((value) => MutableRef.set(failure, value));
      },
      { stdoutWrite: failWrite, stderrWrite: failWrite }
    );
    expect(stdout).toEqual(["a\n"]);
    expect(stderr).toEqual(["[beep-cli] stdout write failed: EPIPE; later stdout lines are dropped\n"]);
    assertSome(
      MutableRef.get(failure),
      StreamWriteFailure.make({ stream: "stdout", message: "EPIPE", droppedLines: 1 })
    );
  });

  it("drops a line queued behind the failing line", () => {
    const callback = MutableRef.make<O.Option<WriteCallback>>(O.none());
    const failure = MutableRef.make<O.Option<StreamWriteFailure>>(O.none());
    const { stdout, stderr } = captureStreams(
      () => {
        streamConsole.log(Str.repeat(100 * 1024)("a"));
        streamConsole.log("queued");
        O.getOrThrow(MutableRef.get(callback))(new Error("EPIPE"));
        drainProcessStreams((value) => MutableRef.set(failure, value));
      },
      {
        stdoutWrite: (_chunk, onWritten) => {
          MutableRef.set(callback, O.some(onWritten));
          return false;
        },
      }
    );
    expect(stdout).toEqual([Str.repeat(8192)("a")]);
    expect(stderr).toEqual(["[beep-cli] stdout write failed: EPIPE; later stdout lines are dropped\n"]);
    assertSome(
      MutableRef.get(failure),
      StreamWriteFailure.make({ stream: "stdout", message: "EPIPE", droppedLines: 2 })
    );
  });

  it("treats a synchronous write throw as a write error", () => {
    const drained = MutableRef.make(false);
    const failure = MutableRef.make<O.Option<StreamWriteFailure>>(O.none());
    const { stdout, stderr } = captureStreams(
      () => {
        streamConsole.log(Str.repeat(100 * 1024)("a"));
        streamConsole.log("later one");
        streamConsole.log("later two");
        streamConsole.error("stderr survives");
        drainProcessStreams((value) => {
          MutableRef.set(drained, true);
          MutableRef.set(failure, value);
        });
        expect(MutableRef.get(drained)).toBe(true);
      },
      {
        stdoutWrite: () => {
          throw new Error("boom");
        },
      }
    );
    expect(stdout).toHaveLength(1);
    expect(new TextEncoder().encode(O.getOrThrow(A.head(stdout))).byteLength).toBeLessThanOrEqual(8192);
    expect(stderr).toEqual([
      "[beep-cli] stdout write failed: boom; later stdout lines are dropped\n",
      "stderr survives\n",
    ]);
    assertSome(
      MutableRef.get(failure),
      StreamWriteFailure.make({
        stream: "stdout",
        message: "boom",
        droppedLines: 3,
      })
    );
  });

  it("does not enqueue a marker onto stderr when stderr failed first", () => {
    const failure = MutableRef.make<O.Option<StreamWriteFailure>>(O.none());
    const failWrite = (_chunk: string | Uint8Array, callback: WriteCallback): boolean => {
      callback(new Error("EPIPE"));
      return false;
    };
    const { stdout, stderr } = captureStreams(
      () => {
        streamConsole.error("a");
        streamConsole.log("b");
        drainProcessStreams((value) => MutableRef.set(failure, value));
      },
      { stdoutWrite: failWrite, stderrWrite: failWrite }
    );
    expect(stderr).toEqual(["a\n"]);
    expect(stdout).toEqual(["[beep-cli] stderr write failed: EPIPE; later stderr lines are dropped\n"]);
    assertSome(
      MutableRef.get(failure),
      StreamWriteFailure.make({ stream: "stdout", message: "EPIPE", droppedLines: 2 })
    );
  });

  it("ignores a late callback after a non-Error synchronous throw", () => {
    const callback = MutableRef.make<O.Option<WriteCallback>>(O.none());
    const failure = MutableRef.make<O.Option<StreamWriteFailure>>(O.none());
    const continuations = MutableRef.make(0);
    const { stdout, stderr } = captureStreams(
      () => {
        streamConsole.log("aborted");
        drainProcessStreams((value) => {
          MutableRef.incrementAndGet(continuations);
          MutableRef.set(failure, value);
        });
        O.getOrThrow(MutableRef.get(callback))(new Error("late error"));
      },
      {
        stdoutWrite: (_chunk, onWritten) => {
          MutableRef.set(callback, O.some(onWritten));
          throw "boom";
        },
      }
    );
    expect(stdout).toEqual(["aborted\n"]);
    expect(stderr).toEqual(["[beep-cli] stdout write failed: boom; later stdout lines are dropped\n"]);
    expect(MutableRef.get(continuations)).toBe(1);
    assertSome(
      MutableRef.get(failure),
      StreamWriteFailure.make({ stream: "stdout", message: "boom", droppedLines: 1 })
    );
  });

  it("settles only once when a write completes then throws", () => {
    const continuations = MutableRef.make(0);
    const failure = MutableRef.make<O.Option<StreamWriteFailure>>(O.none());
    const { stdout, stderr } = captureStreams(
      () => {
        streamConsole.log("completed");
        streamConsole.log("after");
        drainProcessStreams((value) => {
          MutableRef.incrementAndGet(continuations);
          MutableRef.set(failure, value);
        });
      },
      {
        stdoutWrite: (_chunk, callback) => {
          callback();
          throw new Error("after completion");
        },
      }
    );
    expect(stdout).toEqual(["completed\n", "after\n"]);
    expect(stderr).toEqual([]);
    expect(MutableRef.get(continuations)).toBe(1);
    failure.pipe(MutableRef.get, assertNone);
  });

  it("keeps the first failure when the callback errors and the write then throws", () => {
    const failure = MutableRef.make<O.Option<StreamWriteFailure>>(O.none());
    const { stdout, stderr } = captureStreams(
      () => {
        streamConsole.log("aborted");
        streamConsole.log("after");
        drainProcessStreams((value) => MutableRef.set(failure, value));
      },
      {
        stdoutWrite: (_chunk, callback) => {
          callback(new Error("first"));
          throw new Error("second");
        },
      }
    );
    expect(stdout).toEqual(["aborted\n"]);
    expect(stderr).toEqual(["[beep-cli] stdout write failed: first; later stdout lines are dropped\n"]);
    assertSome(
      MutableRef.get(failure),
      StreamWriteFailure.make({ stream: "stdout", message: "first", droppedLines: 2 })
    );
  });

  it("settles each synchronous write behaviour according to its first result", () => {
    const cases: ReadonlyArray<{
      readonly tag: string;
      readonly write: (chunk: string | Uint8Array, callback: WriteCallback) => boolean;
      readonly failure: O.Option<StreamWriteFailure>;
    }> = [
      {
        tag: "ok",
        write: (_chunk, callback) => {
          callback();
          return true;
        },
        failure: O.none(),
      },
      {
        tag: "err",
        write: (_chunk, callback) => {
          callback(new Error("first"));
          return false;
        },
        failure: O.some(StreamWriteFailure.make({ stream: "stdout", message: "first", droppedLines: 1 })),
      },
      {
        tag: "throw",
        write: () => {
          throw new Error("first");
        },
        failure: O.some(StreamWriteFailure.make({ stream: "stdout", message: "first", droppedLines: 1 })),
      },
      {
        tag: "ok-then-throw",
        write: (_chunk, callback) => {
          callback();
          throw new Error("second");
        },
        failure: O.none(),
      },
      {
        tag: "err-then-throw",
        write: (_chunk, callback) => {
          callback(new Error("first"));
          throw new Error("second");
        },
        failure: O.some(StreamWriteFailure.make({ stream: "stdout", message: "first", droppedLines: 1 })),
      },
    ];
    for (const testCase of cases) {
      resetProcessStreamStateForTesting();
      const continuations = MutableRef.make(0);
      const { stdout, stderr } = captureStreams(
        () => {
          streamConsole.log(testCase.tag);
          drainProcessStreams((failure) => {
            MutableRef.incrementAndGet(continuations);
            O.match(testCase.failure, {
              onNone: () => assertNone(failure),
              onSome: (expected) => assertSome(failure, expected),
            });
          });
        },
        { stdoutWrite: testCase.write }
      );
      expect(stdout).toEqual([`${testCase.tag}\n`]);
      expect(stderr).toEqual(
        O.match(testCase.failure, {
          onNone: () => [],
          onSome: ({ message }) => [`[beep-cli] stdout write failed: ${message}; later stdout lines are dropped\n`],
        })
      );
      expect(MutableRef.get(continuations)).toBe(1);
    }
  });

  it("ignores a double completion callback", () => {
    const continuations = MutableRef.make(0);
    const { stdout, stderr } = captureStreams(
      () => {
        streamConsole.log("first");
        streamConsole.log("second");
        streamConsole.log("third");
        drainProcessStreams((failure) => {
          MutableRef.incrementAndGet(continuations);
          assertNone(failure);
        });
      },
      {
        stdoutWrite: (_chunk, callback) => {
          callback();
          callback();
          return true;
        },
      }
    );
    expect(stdout).toEqual(["first\n", "second\n", "third\n"]);
    expect(stderr).toEqual([]);
    expect(MutableRef.get(continuations)).toBe(1);
  });

  it("waits for a pending callback instead of timing out", () => {
    const callback = MutableRef.make<O.Option<WriteCallback>>(O.none());
    const drained = MutableRef.make(false);
    const { stdout, stderr } = captureStreams(
      () => {
        streamConsole.log("pending");
        drainProcessStreams((failure) => {
          MutableRef.set(drained, true);
          assertNone(failure);
        });
        expect(MutableRef.get(drained)).toBe(false);
        O.getOrThrow(MutableRef.get(callback))();
        expect(MutableRef.get(drained)).toBe(true);
      },
      {
        stdoutWrite: (_chunk, onWritten) => {
          MutableRef.set(callback, O.some(onWritten));
          return false;
        },
      }
    );
    expect(stdout).toEqual(["pending\n"]);
    expect(stderr).toEqual([]);
  });

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

  it("keeps multi-byte characters intact across the 8 KiB chunk boundary", () => {
    // 6,000 two-byte characters span two chunks; an odd boundary would split a code point.
    const line = Str.repeat(6_000)("\u00e9");
    const { stdout, stderr } = captureStreams(() => {
      streamConsole.log(line);
      streamConsole.error(line);
    });
    expect(A.length(stdout)).toBeGreaterThan(1);
    expect(A.join(stdout, "")).toBe(`${line}\n`);
    expect(A.join(stderr, "")).toBe(`${line}\n`);
    expect(Str.includes("\uFFFD")(A.join(stdout, ""))).toBe(false);
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
    process.stdout.write = ((_chunk: string | Uint8Array, callback?: WriteCallback) => {
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
    const queueWrite = ((_chunk: string | Uint8Array, callback?: WriteCallback) => {
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
    process.stdout.write = ((chunk: string | Uint8Array, callback?: WriteCallback) => {
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
