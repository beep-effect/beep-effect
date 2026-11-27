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

const CHILD_PATH = "/usr/local/bin:/usr/bin:/bin";

const scratch = () => mkdtempSync(join(hostOs.tmpdir(), "effected-detached-"));

const eventually = (predicate: () => boolean, attempts = 100): Effect.Effect<boolean> =>
  Effect.repeat(Effect.sync(predicate), {
    schedule: Schedule.spaced("20 millis"),
    until: identity<boolean>,
    times: attempts,
  }).pipe(TestClock.withLive);

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

class KillSpy extends Context.Service<KillSpy, ReturnType<typeof killSpy>>()(
  "@beep/github-actions/test/DetachedProcess.test/KillSpy"
) {}
const killSpy = () => vi.spyOn(process, "kill");

describe("DetachedProcess", () => {
  describe("the bare-pid guard", () => {
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
          assert.instanceOf(
            error,
            InvalidPidError,
            "pid 0 signals the whole process group, so reaping a decoded 0 would take down the runner's job"
          );
          assert.lengthOf(
            calls,
            0,
            "the spy is what matters: checking the failure alone passes code that killed the group and THEN failed"
          );
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
          assert.lengthOf(
            calls,
            0,
            "process.kill must not be called; it is a native global seam with no Effect service, so a vi spy watches it"
          );
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
      it.effect("the control: a positive pid DOES reach process.kill", () =>
        Effect.gen(function* () {
          const calls = (yield* KillSpy).mock.calls;
          const reap1 = yield* DetachedProcess.reap(4242, "SIGTERM");
          assert.isTrue(reap1);
          assert.deepStrictEqual(
            calls,
            [[4242, "SIGTERM"]],
            "the control keeps an implementation that never signals anything from passing"
          );
        })
      );
    });
  });

  describe("reap", () => {
    it.effect("reports a real exited child as false", () =>
      Effect.gen(function* () {
        const { pid } = spawnSync(process.execPath, ["-e", ""]);
        assertTrue(Number.isSafeInteger(pid) && pid > 0, "a failed spawn must never reach a pid-0 group signal");
        const reap2 = yield* DetachedProcess.reap(pid, "SIGCONT");
        assertFalse(
          reap2,
          "no spy: the waited-on child makes the real kill throw ESRCH; SIGCONT is harmless if the pid was reused"
        );
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
          const reap3 = yield* DetachedProcess.reap(4242);
          assert.isFalse(reap3, "a post phase finding its child already gone is the normal ending");
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
      assert.strictEqual(
        S.decodeExit(ProcessId)(0)._tag,
        "Failure",
        "the first of both defenses: the bad value never leaves ActionState, so it never reaches reap"
      );
      assert.strictEqual(S.decodeExit(ProcessId)(-1)._tag, "Failure");
      assert.strictEqual(S.decodeExit(ProcessId)(1.5)._tag, "Failure");
    });

    it.effect("accepts a real pid", () =>
      Effect.gen(function* () {
        const value4 = yield* S.decodeEffect(ProcessId)(4242);
        assert.strictEqual(value4, 4242);
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
        yield* TestClock.adjust("100 millis");
        yield* TestClock.adjust("100 millis");
        yield* Fiber.join(fiber);
        assert.strictEqual(
          calls,
          3,
          "it.effect's virtual clock ticks the polls; a real sleep would hang to the vitest timeout"
        );
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
        const error = yield* Effect.flip(DetachedProcess.awaitReady(probe, { attempts: 5 }));
        assert.strictEqual(error, "probe is misconfigured");
        assert.strictEqual(
          calls,
          1,
          "a probe that cannot run is not a child not up yet; retrying turns a config error into a bare timeout"
        );
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
          const httpProbe5 = yield* DetachedProcess.httpProbe(url);
          assert.isTrue(httpProbe5);
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
          const httpProbe6 = yield* DetachedProcess.httpProbe(url);
          assert.isFalse(httpProbe6);
        })
      );
    });

    it.layer(FetchHttpClient.layer, { timeout: "30 seconds" })((it) => {
      it.effect("collapses a refused connection to false rather than failing", () =>
        Effect.gen(function* () {
          const closedEphemeralPort = yield* Effect.callback<number>((resume) => {
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
          const httpProbe7 = yield* DetachedProcess.httpProbe(`http://127.0.0.1:${closedEphemeralPort}/status`);
          assert.isFalse(
            httpProbe7,
            "reaching this line is the point: a probe letting the transport error through fails the effect instead"
          );
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
            interval: "10 millis",
            attempts: 2,
          });
        })
      );
    });
  });

  describe("the ops seam", () => {
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
          const exit8 = yield* Effect.exit(ops.reap(4242));
          const message = defectMessage(exit8);
          assert.include(message, "reap");
          assert.include(message, "not stubbed");
        })
      );

      it.effect("each member names ITSELF — spawn does not die blaming reap", () =>
        Effect.gen(function* () {
          const ops = DetachedProcess.makeTestOps();
          const exit9 = yield* Effect.exit(ops.spawn({ command: "node", logFile: "/tmp/never.log" }));
          assert.include(defectMessage(exit9), "spawn");
          const exit10 = yield* Effect.exit(ops.awaitReady(Effect.succeed(true)));
          assert.include(defectMessage(exit10), "awaitReady");
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
          const reap11 = yield* ops.reap(4242);
          assert.isTrue(reap11);
          assert.deepStrictEqual(reaped, [4242]);
          const exit12 = yield* Effect.exit(ops.spawn({ command: "node", logFile: "/tmp/never.log" }));
          assert.include(defectMessage(exit12), "spawn", "the overrides must not soften the rest of the double");
        })
      );

      it.effect("dying is lazy — building the double runs nothing", () =>
        Effect.gen(function* () {
          const ops = DetachedProcess.makeTestOps();
          const described = ops.reap(4242);
          assert.isDefined(
            described,
            "an eagerly throwing double could not be built by a test that only calls its stubbed members"
          );
          const exit13 = yield* Effect.exit(described);
          const message = defectMessage(exit13);
          assert.include(message, "reap");
        })
      );
    });
  });

  describe("spawn", () => {
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

        const wrote = yield* eventually(() => {
          try {
            return Str.includes("hello from the child")(readFileSync(logFile, "utf8"));
          } catch {
            return false;
          }
        });
        assert.isTrue(
          wrote,
          "the real child's stdout reaches the real log via its duplicate descriptor, polled on the live clock"
        );

        const reap14 = yield* DetachedProcess.reap(pid);
        assert.isTrue(reap14);
        const gone = yield* eventually(() => !alive(pid));
        assert.isTrue(gone, "the reaped child must actually exit");
      }).pipe(Effect.ensuring(Effect.sync(() => rmSync(directory, { recursive: true, force: true }))));
    });

    it.effect("a supplied base replaces the parent's environment wholesale, with env merged over it", () => {
      const directory = scratch();
      const logFile = join(directory, "env.log");
      const PARENT_ONLY = "EFFECTED_DETACHED_PARENT_ONLY";
      vi.stubEnv(PARENT_ONLY, "parent-only");
      return Effect.gen(function* () {
        assert.strictEqual(
          import.meta.env[PARENT_ONLY],
          "parent-only",
          "the control: the parent holds a test-owned variable the child must lack, since no runner guarantees HOME"
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
        assert.isTrue(wrote, "the real child must have printed its environment, polled on the live clock");
        const seen = Result.getOrThrowWith(S.decodeResult(Json)(readFileSync(logFile, "utf8")), (error) => error);
        if (!S.is(EnvironmentRecord)(seen)) {
          assert.fail("expected a string environment record");
        }
        assert.strictEqual(seen.ONLY, "1");
        assert.strictEqual(seen.X, "y");
        assert.strictEqual(seen.PATH, CHILD_PATH);
        assert.notProperty(
          seen,
          PARENT_ONLY,
          "the base is the whole inherited block, so the parent's own variables must not leak past it"
        );
        assert.notProperty(seen, "DROPPED", "an undefined base value is dropped, never stringified");
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
        assert.isTrue(wrote, "the real child must have printed its environment, polled on the live clock");
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
      const value15 = yield* S.decodeEffect(DetachedSpawnOptions)(minimal);
      assert.deepStrictEqual(value15, minimal);
      for (const key of ["args", "cwd", "base", "env"]) {
        assert.isFalse(
          S.is(DetachedSpawnOptions)({ ...minimal, [key]: undefined }),
          "exact optional keys: an absent option is omitted, never undefined"
        );
      }
      const configured: DetachedSpawnOptions.Encoded = {
        ...minimal,
        args: ["worker.js"],
        cwd: "/work",
        base: { PATH: undefined, HOME: "/home/ci" },
        env: { MODE: "worker" },
      };
      const value16 = yield* S.decodeEffect(DetachedSpawnOptions)(configured);
      assert.deepStrictEqual(value16, configured);
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
        const argument = S.decodeEffect(ProcessId);
        const value1 = yield* S.encodeEffect(ProcessId)(value);
        const value17 = yield* argument(value1);
        assert.deepStrictEqual(value17, value);
      }),
    { arbitrary: fcRuns(100) }
  );
});
