import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import {
  DetachedLogUnavailableError,
  DetachedNotReadyError,
  DetachedProcess,
  DetachedSignalFailedError,
  DetachedSpawnFailedError,
  InvalidPidError,
  ProcessId,
} from "@beep/github-actions";
import { DetachedSpawnOptions } from "@beep/github-actions/DetachedProcess";
import { assert, describe, it, vi } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import { dual, identity, pipe } from "effect/Function";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { hostChildProcess, hostFs, hostHttp, hostOs, hostPath } from "./support/host.ts";
import type { HttpServer, HttpServerResponse } from "./support/host.ts";

const Json = S.fromJsonString(S.Unknown);
const EnvironmentRecord = S.Record(S.String, S.String);

const { spawnSync } = hostChildProcess;
const { createServer } = hostHttp;
const { mkdtempSync, readFileSync, rmSync } = hostFs;
const { join } = hostPath;

/** The child's PATH: a fixed value the env tests pass through and read back. */
const CHILD_PATH = "/usr/local/bin:/usr/bin:/bin";

/** A fresh scratch directory per use, removed by the test that made it. */
const scratch = () => mkdtempSync(join(hostOs.tmpdir(), "effected-detached-"));

/**
 * Wait for a real condition: the predicate is polled every 20ms on the live
 * clock (a real child is filling a real file), up to `attempts` more times.
 */
const eventually = (predicate: () => boolean, attempts = 100): Effect.Effect<boolean> =>
  Effect.repeat(Effect.sync(predicate), {
    schedule: Schedule.spaced("20 millis"),
    until: identity<boolean>,
    times: attempts,
  }).pipe(TestClock.withLive);

/** Whether a pid is still alive, asked without signalling it. */
const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

// process.kill is a native global seam; no Effect service is exposed for spying.
class KillSpy extends Context.Service<KillSpy, ReturnType<typeof killSpy>>()(
  "@beep/github-actions/test/DetachedProcess.test/KillSpy"
) {}
const killSpy = () => vi.spyOn(process, "kill");

describe("DetachedProcess", () => {
  describe("the bare-pid guard", () => {
    // The assertion that matters is the spy, not the failure. pid 0 signals
    // the caller's entire process group, so on a runner an unguarded reap of a
    // state value that decoded to 0 takes down the job running it. A test that
    // only checked the effect failed would pass against an implementation that
    // killed the group and THEN reported an error.
    it.layer(
      Layer.effect(
        KillSpy,
        Effect.acquireRelease(
          Effect.sync(() => vi.spyOn(process, "kill").mockImplementation(() => true)),
          (spy) => Effect.sync(() => spy.mockRestore())
        )
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("refuses pid 0 WITHOUT signalling anything", () =>
        Effect.gen(function* () {
          const calls = (yield* KillSpy).mock.calls;
          const error = yield* Effect.flip(DetachedProcess.reap(0));
          assert.instanceOf(error, InvalidPidError);
          assert.lengthOf(calls, 0, "process.kill must not have been called at all");
        })
      );
    });

    it.layer(
      Layer.effect(
        KillSpy,
        Effect.acquireRelease(
          Effect.sync(() => vi.spyOn(process, "kill").mockImplementation(() => true)),
          (spy) => Effect.sync(() => spy.mockRestore())
        )
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("refuses pid -1 WITHOUT signalling anything", () =>
        Effect.gen(function* () {
          const calls = (yield* KillSpy).mock.calls;
          const error = yield* Effect.flip(DetachedProcess.reap(-1));
          assert.instanceOf(error, InvalidPidError);
          assert.lengthOf(calls, 0, "process.kill must not have been called at all");
        })
      );
    });

    it.layer(
      Layer.effect(
        KillSpy,
        Effect.acquireRelease(
          Effect.sync(() => vi.spyOn(process, "kill").mockImplementation(() => true)),
          (spy) => Effect.sync(() => spy.mockRestore())
        )
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("refuses a non-integer pid", () =>
        Effect.gen(function* () {
          const calls = (yield* KillSpy).mock.calls;
          const error = yield* Effect.flip(DetachedProcess.reap(Number.NaN));
          assert.instanceOf(error, InvalidPidError);
          assert.lengthOf(calls, 0);
        })
      );
    });

    it.layer(
      Layer.effect(
        KillSpy,
        Effect.acquireRelease(
          Effect.sync(() => vi.spyOn(process, "kill").mockImplementation(() => true)),
          (spy) => Effect.sync(() => spy.mockRestore())
        )
      ),
      { timeout: "30 seconds" }
    )((it) => {
      // The control prevents an implementation that never signals anything from passing.
      it.effect("the control: a positive pid DOES reach process.kill", () =>
        Effect.gen(function* () {
          const calls = (yield* KillSpy).mock.calls;
          assert.isTrue(yield* DetachedProcess.reap(4242, "SIGTERM"));
          assert.deepStrictEqual(calls, [[4242, "SIGTERM"]]);
        })
      );
    });
  });

  describe("reap", () => {
    // No kill spy: a child that already exited and was waited on makes the real
    // process.kill throw ESRCH, which must classify through the wrapped cause.
    it.effect("reports a real exited child as false", () =>
      Effect.gen(function* () {
        const { pid } = spawnSync(process.execPath, ["-e", ""]);
        // A failed spawn must never reach a pid-0 group signal.
        assertTrue(Number.isSafeInteger(pid) && pid > 0);
        // SIGCONT is harmless if the OS has already reused the pid.
        assertFalse(yield* DetachedProcess.reap(pid, "SIGCONT"));
      })
    );

    it.layer(
      Layer.effect(
        KillSpy,
        Effect.acquireRelease(
          Effect.sync(() =>
            vi.spyOn(process, "kill").mockImplementation(() => {
              throw Object.assign(new Error("kill ESRCH"), { code: "ESRCH" });
            })
          ),
          (spy) => Effect.sync(() => spy.mockRestore())
        )
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("reports an already-dead process as false rather than failing", () =>
        Effect.gen(function* () {
          // A post phase finding its child already gone is the normal ending.
          assert.isFalse(yield* DetachedProcess.reap(4242));
        })
      );
    });

    it.layer(
      Layer.effect(
        KillSpy,
        Effect.acquireRelease(
          Effect.sync(() =>
            vi.spyOn(process, "kill").mockImplementation(() => {
              throw Object.assign(new Error("kill EPERM"), { code: "EPERM" });
            })
          ),
          (spy) => Effect.sync(() => spy.mockRestore())
        )
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("fails typed when the signal is refused", () =>
        Effect.gen(function* () {
          const error = yield* Effect.flip(DetachedProcess.reap(4242));
          assert.instanceOf(error, DetachedSignalFailedError);
          assert.strictEqual(error.pid, 4242);
        })
      );
    });
  });

  describe("ProcessId", () => {
    it("refuses the zero a truncated state file decodes to", () => {
      // Both defenses matter and this is the first: the bad value never reaches
      // reap, because it never leaves ActionState.
      assert.strictEqual(S.decodeExit(ProcessId)(0)._tag, "Failure");
      assert.strictEqual(S.decodeExit(ProcessId)(-1)._tag, "Failure");
      assert.strictEqual(S.decodeExit(ProcessId)(1.5)._tag, "Failure");
    });

    it.effect("accepts a real pid", () =>
      Effect.gen(function* () {
        assert.strictEqual(yield* S.decodeEffect(ProcessId)(4242), 4242);
      })
    );
  });

  describe("awaitReady", () => {
    it.effect("returns as soon as the probe holds, without waiting", () =>
      Effect.gen(function* () {
        let calls = 0;
        yield* DetachedProcess.awaitReady(
          Effect.sync(() => {
            calls += 1;
            return true;
          })
        );
        assert.strictEqual(calls, 1, "a probe that already holds must not be retried");
      })
    );

    it.effect("polls until the probe holds", () =>
      Effect.gen(function* () {
        let calls = 0;
        const probe = Effect.sync(() => {
          calls += 1;
          return calls >= 3;
        });
        const fiber = yield* Effect.forkChild(DetachedProcess.awaitReady(probe, { interval: "100 millis" }));
        // Latch-free but clock-driven: it.effect installs a virtual clock, so a
        // real sleep here would hang to the vitest timeout instead of ticking.
        yield* TestClock.adjust("100 millis");
        yield* TestClock.adjust("100 millis");
        yield* Fiber.join(fiber);
        assert.strictEqual(calls, 3);
      })
    );

    it.effect("fails typed once the attempts are exhausted", () =>
      Effect.gen(function* () {
        const fiber = yield* DetachedProcess.awaitReady(Effect.succeed(false), {
          interval: "10 millis",
          attempts: 2,
        }).pipe(Effect.flip, Effect.forkChild);
        yield* TestClock.adjust("10 millis");
        yield* TestClock.adjust("10 millis");
        const error = yield* Fiber.join(fiber);
        assert.instanceOf(error, DetachedNotReadyError);
      })
    );

    it.effect("propagates a probe failure rather than retrying it", () =>
      Effect.gen(function* () {
        let calls = 0;
        const probe = Effect.suspend(() => {
          calls += 1;
          return Effect.fail("probe is misconfigured" as const);
        });
        // A probe that cannot run is a different situation from a child that is
        // not up yet; retrying the first turns a config error into a timeout
        // with nothing to show for it.
        const error = yield* Effect.flip(DetachedProcess.awaitReady(probe, { attempts: 5 }));
        assert.strictEqual(error, "probe is misconfigured");
        assert.strictEqual(calls, 1);
      })
    );
  });

  describe("httpProbe", () => {
    class ServerUrl extends Context.Service<ServerUrl, string>()(
      "@beep/github-actions/test/DetachedProcess.test/ServerUrl"
    ) {}
    const serverLayer = (respond: (response: HttpServerResponse) => void) =>
      Layer.effect(
        ServerUrl,
        Effect.gen(function* () {
          const server = yield* Effect.acquireRelease(
            Effect.callback<HttpServer>((resume) => {
              const server = createServer((_request, response) => respond(response));
              server.listen(0, "127.0.0.1", () => resume(Effect.succeed(server)));
            }),
            (server) =>
              Effect.callback<void>((resume) => {
                server.close(() => resume(Effect.void));
              })
          );
          const address = server.address();
          if (address === null || typeof address === "string") {
            assert.fail("expected a bound TCP address");
          }
          return `http://127.0.0.1:${address.port}/status`;
        })
      );

    it.layer(
      Layer.mergeAll(
        serverLayer((response) => response.writeHead(200).end("ok")),
        FetchHttpClient.layer
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("answers true for a 2xx response", () =>
        Effect.gen(function* () {
          const url = yield* ServerUrl;
          assert.isTrue(yield* DetachedProcess.httpProbe(url));
        })
      );
    });

    it.layer(
      Layer.mergeAll(
        serverLayer((response) => response.writeHead(503).end("warming up")),
        FetchHttpClient.layer
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("answers false for a non-2xx response — answering is not ready", () =>
        Effect.gen(function* () {
          const url = yield* ServerUrl;
          assert.isFalse(yield* DetachedProcess.httpProbe(url));
        })
      );
    });

    it.layer(FetchHttpClient.layer, { timeout: "30 seconds" })((it) => {
      it.effect("collapses a refused connection to false rather than failing", () =>
        Effect.gen(function* () {
          // Bind an ephemeral port and close it completely first: the port is
          // then known-refusing without racing another process for a fixed one.
          const port = yield* Effect.callback<number>((resume) => {
            const server = createServer();
            server.listen(0, "127.0.0.1", () => {
              const address = server.address();
              if (address === null || typeof address === "string") {
                assert.fail("expected a bound TCP address");
              }
              const bound = address.port;
              server.close(() => resume(Effect.succeed(bound)));
            });
          });
          // The assertion that matters is that this line is reached at all: a
          // probe that let the transport error through would fail the effect
          // here instead of answering false.
          assert.isFalse(yield* DetachedProcess.httpProbe(`http://127.0.0.1:${port}/status`));
        })
      );
    });

    it.layer(
      Layer.mergeAll(
        serverLayer((response) => response.writeHead(200).end()),
        FetchHttpClient.layer
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("composes with awaitReady: an answering child reports ready", () =>
        Effect.gen(function* () {
          const url = yield* ServerUrl;
          yield* DetachedProcess.awaitReady(DetachedProcess.httpProbe(url), {
            // Small budget so a wrong `false` fails fast instead of in 6s.
            interval: "10 millis",
            attempts: 2,
          });
        })
      );
    });
  });

  describe("the ops seam", () => {
    /** The die a makeTestOps member exits through, asserted to BE a die. */
    const defectMessage = (exit: Exit.Exit<unknown, unknown>): string => {
      assert.isTrue(Exit.isFailure(exit));
      if (!Exit.isFailure(exit)) {
        return "";
      }
      assert.isTrue(Cause.hasDies(exit.cause), "an unstubbed member must die, never fail typed");
      const defect = pipe(
        exit.cause.reasons,
        A.filter(Cause.isDieReason),
        A.map((reason) => reason.defect)
      )[0];
      assert.instanceOf(defect, Error);
      assert.isTrue(defect instanceof Error);
      return defect.message;
    };

    it("ops IS the real statics — same references, not wrappers", () => {
      assert.strictEqual(DetachedProcess.ops.spawn, DetachedProcess.spawn);
      assert.strictEqual(DetachedProcess.ops.awaitReady, DetachedProcess.awaitReady);
      assert.strictEqual(DetachedProcess.ops.reap, DetachedProcess.reap);
    });

    describe("makeTestOps", () => {
      it.effect("an unstubbed member dies loudly, naming the member and the fix", () =>
        Effect.gen(function* () {
          const ops = DetachedProcess.makeTestOps();
          const message = defectMessage(yield* Effect.exit(ops.reap(4242)));
          assert.include(message, "reap");
          assert.include(message, "not stubbed");
        })
      );

      it.effect("each member names ITSELF — spawn does not die blaming reap", () =>
        Effect.gen(function* () {
          const ops = DetachedProcess.makeTestOps();
          assert.include(
            defectMessage(yield* Effect.exit(ops.spawn({ command: "node", logFile: "/tmp/never.log" }))),
            "spawn"
          );
          assert.include(defectMessage(yield* Effect.exit(ops.awaitReady(Effect.succeed(true)))), "awaitReady");
        })
      );

      it.effect("a stubbed member serves while the rest still die", () =>
        Effect.gen(function* () {
          const reaped: Array<number> = [];
          const ops = DetachedProcess.makeTestOps({
            reap: dual(
              (args) => P.isNumber(args[0]),
              (pid: number, _signal?: NodeJS.Signals) =>
                Effect.sync(() => {
                  reaped.push(pid);
                  return true;
                })
            ),
          });
          assert.isTrue(yield* ops.reap(4242));
          assert.deepStrictEqual(reaped, [4242]);
          // The overrides must not soften the rest of the double.
          assert.include(
            defectMessage(yield* Effect.exit(ops.spawn({ command: "node", logFile: "/tmp/never.log" }))),
            "spawn"
          );
        })
      );

      it.effect("dying is lazy — building the double runs nothing", () =>
        Effect.gen(function* () {
          // An eagerly-throwing double would make it impossible to build the
          // ops value in a test that only ever calls its stubbed members.
          const ops = DetachedProcess.makeTestOps();
          const described = ops.reap(4242);
          assert.isDefined(described);
          const message = defectMessage(yield* Effect.exit(described));
          assert.include(message, "reap");
        })
      );
    });
  });

  describe("spawn", () => {
    // The child and its log are real; the polling runs on the live clock (TestClock.withLive).
    it.effect("starts a detached child, routes its output to the log file, and survives to be reaped", () => {
      const directory = scratch();
      const logFile = join(directory, "child.log");
      return Effect.gen(function* () {
        const pid = yield* DetachedProcess.spawn({
          command: process.execPath,
          args: ["-e", "process.stdout.write('hello from the child\\n'); setTimeout(() => {}, 30000);"],
          logFile,
        });
        assert.isAbove(pid, 0);

        // The parent closed its own descriptor immediately; the child holds a
        // duplicate, which is what keeps the log filling after this process
        // would have exited.
        const wrote = yield* eventually(() => {
          try {
            return Str.includes("hello from the child")(readFileSync(logFile, "utf8"));
          } catch {
            return false;
          }
        });
        assert.isTrue(wrote, "the child's stdout must reach the log file");

        assert.isTrue(yield* DetachedProcess.reap(pid));
        const gone = yield* eventually(() => !alive(pid));
        assert.isTrue(gone, "the reaped child must actually exit");
      }).pipe(Effect.ensuring(Effect.sync(() => rmSync(directory, { recursive: true, force: true }))));
    });

    // The child and its log are real; the polling runs on the live clock (TestClock.withLive).
    it.effect("a supplied base replaces the parent's environment wholesale, with env merged over it", () => {
      const directory = scratch();
      const logFile = join(directory, "env.log");
      // A test-owned variable, not `HOME`: nothing guarantees a runner's
      // environment carries any particular name. Set on the parent for the
      // test's duration only, and restored on every path.
      const PARENT_ONLY = "EFFECTED_DETACHED_PARENT_ONLY";
      vi.stubEnv(PARENT_ONLY, "parent-only");
      return Effect.gen(function* () {
        // The parent holds it; the child must NOT see it — the base is the
        // whole inherited block, not additions to the parent's environment.
        assert.strictEqual(
          import.meta.env[PARENT_ONLY],
          "parent-only",
          "the control: the parent must hold the variable the child must lack"
        );
        const pid = yield* DetachedProcess.spawn({
          command: process.execPath,
          args: ["-e", "process.stdout.write(JSON.stringify(process.env));"],
          logFile,
          base: { ONLY: "1", PATH: CHILD_PATH, DROPPED: undefined },
          env: { X: "y" },
        });
        assert.isAbove(pid, 0);
        const wrote = yield* eventually(() => {
          try {
            return Str.endsWith("}")(readFileSync(logFile, "utf8"));
          } catch {
            return false;
          }
        });
        assert.isTrue(wrote, "the child must have printed its environment");
        const seen = Result.getOrThrowWith(S.decodeResult(Json)(readFileSync(logFile, "utf8")), (error) => error);
        if (!S.is(EnvironmentRecord)(seen)) {
          assert.fail("expected a string environment record");
        }
        assert.strictEqual(seen.ONLY, "1");
        assert.strictEqual(seen.X, "y");
        assert.strictEqual(seen.PATH, CHILD_PATH);
        assert.notProperty(seen, PARENT_ONLY, "the parent's own variables must not leak past an explicit base");
        // An `undefined` base value is dropped, never stringified.
        assert.notProperty(seen, "DROPPED");
        assert.notInclude(R.values(seen), "undefined");
      }).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            vi.unstubAllEnvs();
            rmSync(directory, { recursive: true, force: true });
          })
        )
      );
    });

    // The child and its log are real; the polling runs on the live clock (TestClock.withLive).
    it.effect("env overrides a key the base also carries", () => {
      const directory = scratch();
      const logFile = join(directory, "env.log");
      return Effect.gen(function* () {
        yield* DetachedProcess.spawn({
          command: process.execPath,
          args: ["-e", "process.stdout.write(JSON.stringify(process.env));"],
          logFile,
          base: { PATH: CHILD_PATH, KEY: "from-base" },
          env: { KEY: "from-env" },
        });
        const wrote = yield* eventually(() => {
          try {
            return Str.endsWith("}")(readFileSync(logFile, "utf8"));
          } catch {
            return false;
          }
        });
        assert.isTrue(wrote, "the child must have printed its environment");
        const seen = Result.getOrThrowWith(S.decodeResult(Json)(readFileSync(logFile, "utf8")), (error) => error);
        if (!S.is(EnvironmentRecord)(seen)) {
          assert.fail("expected a string environment record");
        }
        assert.strictEqual(seen.KEY, "from-env");
      }).pipe(Effect.ensuring(Effect.sync(() => rmSync(directory, { recursive: true, force: true }))));
    });

    it.effect("fails typed when the command does not exist", () => {
      const directory = scratch();
      return Effect.gen(function* () {
        const error = yield* Effect.flip(
          DetachedProcess.spawn({
            command: join(directory, "no-such-binary"),
            logFile: join(directory, "child.log"),
          })
        );
        assert.instanceOf(error, DetachedSpawnFailedError);
      }).pipe(Effect.ensuring(Effect.sync(() => rmSync(directory, { recursive: true, force: true }))));
    });

    it.effect("fails typed when the log file cannot be opened", () => {
      const directory = scratch();
      return Effect.gen(function* () {
        const error = yield* Effect.flip(
          DetachedProcess.spawn({
            command: process.execPath,
            args: ["-e", ""],
            logFile: join(directory, "missing", "child.log"),
          })
        );
        assert.instanceOf(error, DetachedLogUnavailableError);
        assert.include(String(error.path), "child.log");
      }).pipe(Effect.ensuring(Effect.sync(() => rmSync(directory, { recursive: true, force: true }))));
    });
  });
});

describe("DetachedSpawnOptions schema contract", () => {
  it.effect("keeps absent options absent and rejects explicit undefined", () =>
    Effect.gen(function* () {
      const minimal: DetachedSpawnOptions.Encoded = { command: "node", logFile: "/tmp/child.log" };
      assert.deepStrictEqual(yield* S.decodeEffect(DetachedSpawnOptions)(minimal), minimal);
      // Exact optional keys (EF-40): an optional key is omitted, never undefined.
      for (const key of ["args", "cwd", "base", "env"]) {
        assert.isFalse(S.is(DetachedSpawnOptions)({ ...minimal, [key]: undefined }));
      }
      const configured: DetachedSpawnOptions.Encoded = {
        ...minimal,
        args: ["worker.js"],
        cwd: "/work",
        base: { PATH: undefined, HOME: "/home/ci" },
        env: { MODE: "worker" },
      };
      assert.deepStrictEqual(yield* S.decodeEffect(DetachedSpawnOptions)(configured), configured);
    })
  );

  it.effect("requires command and logFile and distinguishes base from additions", () =>
    Effect.gen(function* () {
      assert.isFalse(S.is(DetachedSpawnOptions)({ command: "node" }));
      assert.isFalse(S.is(DetachedSpawnOptions)({ logFile: "/tmp/child.log" }));
      assert.isFalse(S.is(DetachedSpawnOptions)({ command: "node", logFile: "/tmp/child.log", args: [42] }));
      assert.isFalse(
        S.is(DetachedSpawnOptions)({ command: "node", logFile: "/tmp/child.log", env: { PATH: undefined } })
      );
      assert.isFalse(S.is(DetachedSpawnOptions)({ command: "node", logFile: "/tmp/child.log", base: { PATH: 42 } }));
    })
  );
});

describe("ProcessId codec property", () => {
  it.effect.prop(
    "ProcessId round-trips through its codec",
    [Arbitrary.schema(ProcessId)],
    ([value]) =>
      Effect.gen(function* () {
        assert.deepStrictEqual(yield* S.decodeEffect(ProcessId)(yield* S.encodeEffect(ProcessId)(value)), value);
      }),
    { arbitrary: fcRuns(100) }
  );
});
