import { Git } from "@beep/git/Git";
import {
  BoundedOutput,
  boundedChunkReducer,
  CaptureCommandTimedOutError,
  collectBoundedText,
  collectText,
  emptyBoundedOutput,
  ensureZeroExit,
  formatCommandLine,
  OutputBound,
  qualityStepOutputBound,
  repoRunOutputBound,
  runCaptured,
  runCapturedStreams,
  runFoldedStdout,
  settleCapturedStepForTesting,
  withAdmissionWorkloadBinding,
} from "@beep/repo-cli-kit/process/StepExec";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, layer, vi, it as vitestIt } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { constant, flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import type * as ChildProcess from "effect/process/ChildProcess";

// `Git` rides beside the platform services: repo-cli's typed git readers take it from the context (W1a).
const gitLayer = Git.layer.pipe(Layer.provide(NodeServices.layer));
const gitPlatform = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, gitLayer);

const PosInt = S.Int.check(S.isGreaterThan(0, { message: "Expected a positive integer" }));

const isCaptureCommandTimedOutError = S.is(CaptureCommandTimedOutError);

const encoder = new TextEncoder();
const decodeStdoutChunk = S.decodeUnknownEffect(S.String);

const ActiveAdmissionWorkload = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("yeet-admission-workload/v1"),
    leaseId: S.String,
    status: S.tag("active"),
    processGroupId: PosInt,
    procStart: S.String,
  })
);
const decodeActiveAdmissionWorkload = S.decodeEffect(ActiveAdmissionWorkload);

const processGroupFromStat = (text: string): number | undefined => {
  const commandEnd = O.getOrElse(constant(-1))(Str.lastIndexOf(") ")(text));
  if (commandEnd < 0) return undefined;
  const processGroup = Number(Str.split(/\s+/u)(Str.trim(Str.slice(commandEnd + 2)(text)))[2]);
  return Number.isInteger(processGroup) && processGroup > 0 ? processGroup : undefined;
};

// A spawner whose child "exits" immediately but whose output pipe stays open until kill is called
// (killEndsStream: true — the straggler dies with the group reap and the kernel delivers EOF), or
// forever (killEndsStream: false — a descendant escaped the process group too). This is the shape
// of the Lint Policy success-exit hang: jobs 94646234791 and 95354812245 logged every policy step
// done, then sat silent for 29-40 minutes because an orphaned grandchild held the inherited pipe
// write end and nothing reaped it after a successful exit.
const makeStuckSpawner = Effect.fnUntraced(function* (options: {
  readonly output: string;
  readonly killEndsStream: boolean;
  readonly pid?: number;
  readonly isRunning?: boolean;
  readonly isRunningFails?: boolean;
}) {
  const closed = yield* Deferred.make<void>();
  const killCount = yield* Ref.make(0);
  const pipe = Stream.make(encoder.encode(options.output)).pipe(
    Stream.concat(closed.pipe(Deferred.await, Stream.fromEffect, Stream.drain))
  );
  // Own double: kill() is counted and ends the stream, and isRunning can fail; ScriptedSpawner's kill is a no-op.
  const handle = ChildProcessSpawner.makeHandle({
    all: pipe,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning:
      options.isRunningFails === true
        ? Effect.fail(
            PlatformError.badArgument({
              module: "ChildProcess",
              method: "isRunning",
              description: "liveness probe refusal",
            })
          )
        : Effect.succeed(options.isRunning ?? false),
    kill: () =>
      Ref.update(killCount, (count) => count + 1).pipe(
        Effect.andThen(options.killEndsStream ? Deferred.succeed(closed, void 0) : Effect.void),
        Effect.asVoid
      ),
    pid: ChildProcessSpawner.ProcessId(options.pid ?? 1),
    stderr: Stream.empty,
    stdin: Sink.drain,
    stdout: pipe,
    unref: Effect.succeed(Effect.void),
  });
  const spawner = ChildProcessSpawner.make(() => Effect.succeed(handle));
  return { spawner, killCount, closed } as const;
});

const makeNeverExitSpawner = Effect.fnUntraced(function* (killCompletes?: boolean) {
  const shouldCompleteKill = killCompletes ?? true;
  const closed = yield* Deferred.make<void>();
  const exited = yield* Deferred.make<ChildProcessSpawner.ExitCode>();
  const killCount = yield* Ref.make(0);
  const unrefCount = yield* Ref.make(0);
  const killOptions = yield* Ref.make<ReadonlyArray<ChildProcess.KillOptions>>([]);
  const killBlocked = yield* Deferred.make<void>();
  const pipe = Stream.make(encoder.encode("started")).pipe(
    Stream.concat(closed.pipe(Deferred.await, Stream.fromEffect, Stream.drain))
  );
  // Own double: kill() is counted and settles a Deferred-gated exitCode, and unref is counted.
  const handle = ChildProcessSpawner.makeHandle({
    all: pipe,
    exitCode: Deferred.await(exited),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(true),
    kill: (options) =>
      Ref.update(killOptions, (values) => A.append(values, options ?? {})).pipe(
        Effect.andThen(Ref.update(killCount, (count) => count + 1)),
        Effect.andThen(
          shouldCompleteKill
            ? Deferred.succeed(closed, void 0).pipe(
                Effect.andThen(Deferred.succeed(exited, ChildProcessSpawner.ExitCode(143)))
              )
            : Deferred.await(killBlocked)
        ),
        Effect.asVoid
      ),
    pid: ChildProcessSpawner.ProcessId(2),
    stderr: Stream.empty,
    stdin: Sink.drain,
    stdout: pipe,
    unref: Ref.update(unrefCount, (count) => count + 1).pipe(Effect.as(Effect.void)),
  });
  const spawner = ChildProcessSpawner.make(() => Effect.succeed(handle));
  return { spawner, killCount, killOptions, unrefCount } as const;
});

describe("StepExec capture pipe lifecycle", () => {
  it.effect("classifies a capture that only ended after its deadline as timed out", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        settleCapturedStepForTesting({
          captured: BoundedOutput.make({ text: "late output", truncated: false }),
          commandLine: "echo late",
          elapsed: Duration.millis(500),
          exitCode: 0,
          timeout: "400 millis",
          trim: undefined,
        })
      );
      expect(error).toBeInstanceOf(CaptureCommandTimedOutError);
      expect(error.message).toContain("only after the 400ms deadline");
    })
  );

  it.effect("settles an under-deadline capture with the trimmed output contract", () =>
    Effect.gen(function* () {
      const settled = yield* settleCapturedStepForTesting({
        captured: BoundedOutput.make({ text: "  ok  ", truncated: false }),
        commandLine: "echo ok",
        elapsed: Duration.millis(10),
        exitCode: 0,
        timeout: "1 second",
        trim: true,
      });
      expect(settled.output).toBe("ok");

      const unbounded = yield* settleCapturedStepForTesting({
        captured: BoundedOutput.make({ text: "raw", truncated: false }),
        commandLine: "echo raw",
        elapsed: Duration.millis(10),
        exitCode: 0,
        timeout: undefined,
        trim: undefined,
      });
      expect(unbounded.output).toBe("raw");
    })
  );

  it.layer(gitPlatform, { timeout: "30 seconds", excludeTestServices: true })((it) => {
    it.effect("tees captured chunks to the parent stdout while still capturing them", () =>
      Effect.gen(function* () {
        const stdout = yield* Effect.acquireRelease(
          Effect.sync(() => vi.spyOn(process.stdout, "write")),
          (spy) => Effect.sync(() => spy.mockRestore())
        );
        const captured = yield* runCaptured({
          command: "echo",
          args: ["teed-line"],
          tee: true,
        });
        expect(captured.output).toContain("teed-line");
        const chunks = yield* Effect.forEach(stdout.mock.calls, ([chunk]) => decodeStdoutChunk(chunk));
        expect(A.join(chunks, "")).toContain("teed-line\n");
      })
    );
  });

  // Teeing and bounding are independent: a bounded capture still echoes every
  // chunk to the parent stdout while the fold enforces the cap.
  it.layer(gitPlatform, { timeout: "30 seconds", excludeTestServices: true })((it) => {
    it.effect("tees a bounded capture while the bound still clips the output", () =>
      Effect.gen(function* () {
        const stdout = yield* Effect.acquireRelease(
          Effect.sync(() => vi.spyOn(process.stdout, "write")),
          (spy) => Effect.sync(() => spy.mockRestore())
        );
        const captured = yield* runCaptured({
          command: "echo",
          args: ["bounded-teed-line"],
          bound: OutputBound.make({ maxChars: 6, truncatedNotice: "[clipped]" }),
          tee: true,
          trim: true,
        });
        expect(captured.truncated).toBe(true);
        expect(captured.output).toContain("[clipped]");
        const chunks = yield* Effect.forEach(stdout.mock.calls, ([chunk]) => decodeStdoutChunk(chunk));
        expect(A.join(chunks, "")).toContain("bounded-teed-line\n");
      })
    );
  });

  it.layer(gitPlatform, { timeout: "30 seconds", excludeTestServices: true })((it) => {
    it.effect("fails a deadline-hit capture even when the child traps the signal, flushes, and exits zero", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          runCaptured({
            command: "sh",
            args: ["-c", 'trap "echo summary; exit 0" TERM INT; while :; do sleep 0.05; done'],
            timeout: "400 millis",
            forceKillAfter: "2 seconds",
          })
        );
        expect(error).toBeInstanceOf(CaptureCommandTimedOutError);
        if (isCaptureCommandTimedOutError(error)) {
          expect(error.commandLine).toContain("trap");
        }
      })
    );
  });

  it.effect("collects decoded text and distinguishes zero from nonzero exits", () =>
    Effect.gen(function* () {
      const collectText1 = yield* collectText(Stream.make(encoder.encode("a"), encoder.encode("b")));
      expect(collectText1).toBe("ab");
      const ensureZeroExit2 = yield* ensureZeroExit({ exitCode: 0, value: "ok" }, (exitCode) => `exit ${exitCode}`);
      expect(ensureZeroExit2).toEqual({
        exitCode: 0,
        value: "ok",
      });
      const pipe3 = yield* ensureZeroExit({ exitCode: 7 }, (exitCode) => `exit ${exitCode}`).pipe(Effect.flip);
      expect(pipe3).toBe("exit 7");
    })
  );

  it.layer(BunCrypto.layer, { excludeTestServices: true })((it) => {
    it.effect("fails closed for partial explicit and inherited admission bindings", () =>
      Effect.gen(function* () {
        const { closed, spawner } = yield* makeStuckSpawner({ output: "", killEndsStream: false });
        yield* Deferred.succeed(closed, void 0);
        const explicit = yield* runCaptured({
          command: "fake-step",
          args: [],
          env: { BEEP_YEET_ADMISSION_WORKLOAD_PATH: "/tmp/workload" },
        }).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner), Effect.flip);
        expect(explicit.message).toContain("must be provided together");

        const previousPath = Bun.env.BEEP_YEET_ADMISSION_WORKLOAD_PATH;
        const previousLease = Bun.env.BEEP_YEET_ADMISSION_LEASE_ID;
        const inherited = yield* Effect.acquireUseRelease(
          Effect.sync(() => {
            Bun.env.BEEP_YEET_ADMISSION_WORKLOAD_PATH = "/tmp/inherited-workload";
            delete Bun.env.BEEP_YEET_ADMISSION_LEASE_ID;
          }),
          () =>
            runCaptured({ command: "fake-step", args: [] }).pipe(
              Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
              Effect.flip
            ),
          () =>
            Effect.sync(() => {
              if (previousPath === undefined) delete Bun.env.BEEP_YEET_ADMISSION_WORKLOAD_PATH;
              else Bun.env.BEEP_YEET_ADMISSION_WORKLOAD_PATH = previousPath;
              if (previousLease === undefined) delete Bun.env.BEEP_YEET_ADMISSION_LEASE_ID;
              else Bun.env.BEEP_YEET_ADMISSION_LEASE_ID = previousLease;
            })
        );
        expect(inherited.message).toContain("Inherited admission workload path and lease id");
      })
    );
  });

  it.layer(Layer.mergeAll(BunCrypto.layer, NodeFileSystem.layer, NodePath.layer), { excludeTestServices: true })(
    (it) => {
      it.effect("reports workload write and process-generation registration failures", () =>
        Effect.gen(function* () {
          const blocked = yield* makeStuckSpawner({ output: "", killEndsStream: false });
          yield* Deferred.succeed(blocked.closed, void 0);
          const writeFailure = yield* runCaptured({ command: "fake-step", args: [] }).pipe(
            withAdmissionWorkloadBinding("/definitely-missing-parent/workload", "lease-write"),
            Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, blocked.spawner),
            Effect.flip
          );
          expect(writeFailure.message).toContain("Failed to write admission workload");

          const fs = yield* FileSystem.FileSystem;
          const root = yield* fs.makeTempDirectoryScoped({ prefix: "step-exec-missing-proc-" });
          const missing = yield* makeStuckSpawner({
            output: "",
            killEndsStream: false,
            pid: 2_000_000_000,
            isRunning: true,
          });
          yield* Deferred.succeed(missing.closed, void 0);
          const registrationFailure = yield* runCaptured({ command: "fake-step", args: [] }).pipe(
            withAdmissionWorkloadBinding(`${root}/workload`, "lease-proc"),
            Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, missing.spawner),
            Effect.flip
          );
          expect(registrationFailure.message).toContain("Failed to read process generation");
        })
      );
    }
  );

  // Registration reads the child's start time to fence the generation. When
  // that read fails, the liveness probe decides between "already gone" and a
  // real failure; a probe that cannot answer is itself the reported cause.
  it.layer(Layer.mergeAll(BunCrypto.layer, NodeFileSystem.layer, NodePath.layer), { excludeTestServices: true })(
    (it) => {
      it.effect("names the liveness probe when process-generation recovery cannot confirm the exit", () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const root = yield* fs.makeTempDirectoryScoped({ prefix: "step-exec-unprobed-proc-" });
          const unprobed = yield* makeStuckSpawner({
            output: "",
            killEndsStream: false,
            pid: 2_000_000_000,
            isRunningFails: true,
          });
          yield* Deferred.succeed(unprobed.closed, void 0);

          const failure = yield* runCaptured({ command: "fake-step", args: [] }).pipe(
            withAdmissionWorkloadBinding(`${root}/workload`, "lease-unprobed"),
            Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, unprobed.spawner),
            Effect.flip
          );

          expect(failure.message).toContain("Failed to confirm process exit");
        })
      );
    }
  );

  it.layer(Layer.mergeAll(BunCrypto.layer, NodeFileSystem.layer, NodePath.layer), { excludeTestServices: true })(
    (it) => {
      it.effect("preserves the exit result when a short-lived child is reaped before generation registration", () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const root = yield* fs.makeTempDirectoryScoped({ prefix: "step-exec-reaped-proc-" });
          const reaped = yield* makeStuckSpawner({ output: "done", killEndsStream: false, pid: 2_000_000_000 });
          yield* Deferred.succeed(reaped.closed, void 0);

          const result = yield* runCaptured({ command: "fast-step", args: [] }).pipe(
            withAdmissionWorkloadBinding(`${root}/workload`, "lease-reaped"),
            Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, reaped.spawner)
          );

          expect(result).toMatchObject({ exitCode: 0, output: "done" });
        })
      );
    }
  );

  it.layer(Layer.mergeAll(BunCrypto.layer, NodeFileSystem.layer, NodePath.layer), { excludeTestServices: true })(
    (it) => {
      it.effect("inherits a scoped admission workload and lets an explicit nested binding override it", () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          return yield* Effect.acquireUseRelease(
            fs.makeTempDirectory({ prefix: "step-exec-admission-" }),
            (root) =>
              Effect.gen(function* () {
                const outerPath = `${root}/outer.workload`;
                const nestedPath = `${root}/nested.workload`;
                const { closed, spawner } = yield* makeStuckSpawner({ output: "", killEndsStream: false });
                yield* Deferred.succeed(closed, void 0);

                yield* runCaptured({ command: "fake-step", args: [] }).pipe(
                  withAdmissionWorkloadBinding(outerPath, "outer-lease"),
                  Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
                );
                const outer = yield* fs.readFileString(outerPath);
                expect(outer).toContain('"leaseId":"outer-lease"');
                expect(outer).toContain('"status":"active"');

                yield* runCaptured({
                  command: "fake-step",
                  args: [],
                  env: {
                    BEEP_YEET_ADMISSION_WORKLOAD_PATH: nestedPath,
                    BEEP_YEET_ADMISSION_LEASE_ID: "nested-lease",
                  },
                }).pipe(
                  withAdmissionWorkloadBinding(outerPath, "outer-lease"),
                  Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
                );
                const nested = yield* fs.readFileString(nestedPath);
                expect(nested).toContain('"leaseId":"nested-lease"');
                const readFileString4 = yield* fs.readFileString(outerPath);
                expect(readFileString4).toBe(outer);
              }),
            (root) => fs.remove(root, { recursive: true }).pipe(Effect.orDie)
          );
        })
      );
    }
  );

  it.layer(Layer.mergeAll(BunCrypto.layer, NodeFileSystem.layer, NodePath.layer), { excludeTestServices: true })(
    (it) => {
      it.effect("distinguishes inherited, matching explicit, and owned explicit admission generations", () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const root = yield* fs.makeTempDirectoryScoped({ prefix: "step-exec-inherited-" });
          const inheritedPath = `${root}/inherited.workload`;
          const ownedPath = `${root}/owned.workload`;
          const { closed, spawner } = yield* makeStuckSpawner({
            output: "",
            killEndsStream: false,
            pid: process.pid,
          });
          yield* Deferred.succeed(closed, void 0);
          const previousPath = Bun.env.BEEP_YEET_ADMISSION_WORKLOAD_PATH;
          const previousLease = Bun.env.BEEP_YEET_ADMISSION_LEASE_ID;

          yield* Effect.acquireUseRelease(
            Effect.sync(() => {
              Bun.env.BEEP_YEET_ADMISSION_WORKLOAD_PATH = inheritedPath;
              Bun.env.BEEP_YEET_ADMISSION_LEASE_ID = "inherited-lease";
            }),
            () =>
              Effect.gen(function* () {
                yield* runCaptured({ command: "fake-step", args: [] }).pipe(
                  Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
                );
                yield* runCaptured({
                  command: "fake-step",
                  args: [],
                  env: {
                    BEEP_YEET_ADMISSION_WORKLOAD_PATH: inheritedPath,
                    BEEP_YEET_ADMISSION_LEASE_ID: "inherited-lease",
                  },
                }).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner));
                yield* runCaptured({
                  command: "fake-step",
                  args: [],
                  env: {
                    BEEP_YEET_ADMISSION_WORKLOAD_PATH: ownedPath,
                    BEEP_YEET_ADMISSION_LEASE_ID: "owned-lease",
                  },
                }).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner));

                const exists5 = yield* fs.exists(inheritedPath);
                expect(exists5).toBe(false);
                const readFileString6 = yield* fs.readFileString(ownedPath);
                expect(readFileString6).toContain('"status":"active"');
              }),
            () =>
              Effect.sync(() => {
                if (previousPath === undefined) delete Bun.env.BEEP_YEET_ADMISSION_WORKLOAD_PATH;
                else Bun.env.BEEP_YEET_ADMISSION_WORKLOAD_PATH = previousPath;
                if (previousLease === undefined) delete Bun.env.BEEP_YEET_ADMISSION_LEASE_ID;
                else Bun.env.BEEP_YEET_ADMISSION_LEASE_ID = previousLease;
              })
          );
        })
      );
    }
  );

  it.layer(gitPlatform, { timeout: "30 seconds", excludeTestServices: true })((it) => {
    it.effect(
      "keeps a cross-process nested StepExec child in the registered outer process group",
      () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          return yield* Effect.acquireUseRelease(
            fs.makeTempDirectory({ prefix: "step-exec-admission-group-" }),
            (root) =>
              Effect.gen(function* () {
                const workloadPath = `${root}/outer.workload`;
                const readyPath = `${root}/nested-ready`;
                const nestedSource = `
import { runCaptured } from "@beep/repo-cli-kit/process/StepExec";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import * as Effect from "effect/Effect";

BunRuntime.runMain(
  runCaptured({
    command: "sh",
    args: ["-c", 'printf "%s" "$$" > "$ADMISSION_NESTED_READY"; exec sleep 30'],
    extendEnv: true,
    source: "all"
  }).pipe(Effect.provide(BunServices.layer))
);
`;
                const outer = yield* Effect.forkChild(
                  runCaptured({
                    command: "bun",
                    args: ["-e", nestedSource],
                    cwd: process.cwd(),
                    env: { ADMISSION_NESTED_READY: readyPath },
                    extendEnv: true,
                    forceKillAfter: "1 second",
                  }).pipe(withAdmissionWorkloadBinding(workloadPath, "outer-group-lease"))
                );

                const ready = yield* fs
                  .exists(readyPath)
                  .pipe(
                    Effect.repeat({ schedule: Schedule.spaced("10 millis"), until: (ready) => ready, times: 2_000 })
                  );
                expect(ready).toBe(true);

                const readFileString7 = yield* fs.readFileString(workloadPath);
                const workload = yield* decodeActiveAdmissionWorkload(readFileString7);
                const readFileString8 = yield* fs.readFileString(readyPath);
                const nestedPid = Number(readFileString8);
                const readFileString9 = yield* fs.readFileString(`/proc/${nestedPid}/stat`);
                const nestedGroup = processGroupFromStat(readFileString9);
                expect(nestedGroup).toBe(workload.processGroupId);

                yield* Fiber.interrupt(outer);
                const nestedAlive = yield* fs
                  .exists(`/proc/${nestedPid}`)
                  .pipe(Effect.repeat({ schedule: Schedule.spaced("10 millis"), while: (alive) => alive, times: 300 }));
                expect(nestedAlive).toBe(false);
              }),
            (root) => fs.remove(root, { recursive: true }).pipe(Effect.orDie)
          );
        }),
      15_000
    );
  });

  it.layer(BunCrypto.layer)((it) => {
    it.effect(
      "reaps the child's group when a straggler holds the pipe open after exit, keeping captured text",
      Effect.fnUntraced(function* () {
        const { killCount, spawner } = yield* makeStuckSpawner({ output: "partial output", killEndsStream: true });
        const fiber = yield* Effect.forkChild(
          runCaptured({ command: "fake-step", args: ["--flag"] }).pipe(
            Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
          )
        );

        yield* TestClock.adjust("2 seconds");

        const result = yield* Fiber.join(fiber);
        expect(result.exitCode).toBe(0);
        expect(result.output).toContain("partial output");
        const got = yield* Ref.get(killCount);
        expect(got).toBe(1);
      })
    );
  });

  it.layer(BunCrypto.layer)((it) => {
    it.effect(
      "dies loudly naming the command when even the group reap cannot close the pipe",
      Effect.fnUntraced(function* () {
        const { killCount, spawner } = yield* makeStuckSpawner({ output: "partial", killEndsStream: false });
        const fiber = yield* Effect.forkChild(
          runCaptured({ command: "fake-step", args: ["--flag"] }).pipe(
            Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
          )
        );

        yield* TestClock.adjust("2 seconds");
        yield* TestClock.adjust("3 seconds");

        const exit = yield* Fiber.await(fiber);
        exit.pipe(Exit.isFailure, assertTrue);
        const rendered = Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "";
        expect(rendered).toContain("CapturePipeWedgedError");
        expect(rendered).toContain("fake-step --flag");
        const got10 = yield* Ref.get(killCount);
        expect(got10).toBe(1);
      })
    );
  });

  it.layer(BunCrypto.layer)((it) => {
    it.effect(
      "never kills a child whose stream closes on its own",
      Effect.fnUntraced(function* () {
        const { closed, killCount, spawner } = yield* makeStuckSpawner({ output: "clean", killEndsStream: false });
        yield* Deferred.succeed(closed, void 0);

        const result = yield* runCaptured({ command: "fake-step", args: [] }).pipe(
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
        );

        expect(result.exitCode).toBe(0);
        expect(result.output).toBe("clean");
        const got11 = yield* Ref.get(killCount);
        expect(got11).toBe(0);
      })
    );
  });

  it.layer(BunCrypto.layer)((it) => {
    it.effect(
      "interrupts and reaps a captured command whose direct child never exits",
      Effect.fnUntraced(function* () {
        const { killCount, killOptions, spawner, unrefCount } = yield* makeNeverExitSpawner();
        const fiber = yield* Effect.forkChild(
          runCaptured({
            command: "fake-step",
            args: ["--flag"],
            timeout: "1 minute",
            forceKillAfter: "1 second",
          }).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner))
        );

        yield* TestClock.adjust("1 minute");

        const exit = yield* Fiber.await(fiber);
        exit.pipe(Exit.isFailure, assertTrue);
        const rendered = Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "";
        expect(rendered).toContain("CaptureCommandTimedOutError");
        expect(rendered).toContain("fake-step --flag");
        const got12 = yield* Ref.get(killCount);
        expect(got12).toBe(1);
        const got13 = yield* Ref.get(killOptions);
        expect(got13).toEqual([{ forceKillAfter: "1 second" }]);
        const got14 = yield* Ref.get(unrefCount);
        expect(got14).toBe(1);
      })
    );
  });

  it.layer(BunCrypto.layer)((it) => {
    it.effect(
      "interrupts and reaps a captured command when its external watchdog fails",
      Effect.fnUntraced(function* () {
        const { killCount, spawner } = yield* makeNeverExitSpawner();
        const fiber = yield* Effect.flip(
          runCaptured({
            command: "fake-step",
            args: ["--flag"],
            abortWhen: Effect.sleep("1 minute").pipe(Effect.andThen(Effect.fail("watchdog tripped"))),
          }).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner))
        ).pipe(Effect.forkChild);

        yield* TestClock.adjust("1 minute");

        const join15 = yield* Fiber.join(fiber);
        expect(join15).toBe("watchdog tripped");
        const got16 = yield* Ref.get(killCount);
        expect(got16).toBe(1);
      })
    );
  });

  it.layer(BunCrypto.layer)((it) => {
    it.effect(
      "returns a typed timeout after bounded cleanup when the child never reports exit",
      Effect.fnUntraced(function* () {
        const { killCount, spawner, unrefCount } = yield* makeNeverExitSpawner(false);
        const fiber = yield* Effect.flip(
          runCaptured({
            command: "fake-step",
            args: ["--flag"],
            timeout: "1 minute",
            forceKillAfter: "1 second",
          }).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner))
        ).pipe(Effect.forkChild);

        yield* TestClock.adjust("1 minute");
        yield* TestClock.adjust("2 seconds");

        const error = yield* Fiber.join(fiber);
        expect(error).toBeInstanceOf(CaptureCommandTimedOutError);
        if (isCaptureCommandTimedOutError(error)) {
          expect(error.commandLine).toBe("fake-step --flag");
        }
        const got17 = yield* Ref.get(killCount);
        expect(got17).toBe(1);
        const got18 = yield* Ref.get(unrefCount);
        expect(got18).toBe(1);
      })
    );
  });

  it.layer(BunCrypto.layer)((it) => {
    it.effect(
      "unrefs the child when its caller is interrupted during timeout cleanup",
      Effect.fnUntraced(function* () {
        const { killCount, spawner, unrefCount } = yield* makeNeverExitSpawner(false);
        const fiber = yield* Effect.forkChild(
          runCaptured({
            command: "fake-step",
            args: ["--flag"],
            timeout: "1 minute",
            forceKillAfter: "1 second",
          }).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner))
        );

        yield* TestClock.adjust("1 minute");
        yield* Fiber.interrupt(fiber);

        const got19 = yield* Ref.get(killCount);
        expect(got19).toBe(1);
        const got20 = yield* Ref.get(unrefCount);
        expect(got20).toBe(1);
      })
    );
  });
});

const encode = (value: string): Uint8Array => new TextEncoder().encode(value);

describe("StepExec bounded output fold", () => {
  const bound = OutputBound.make({ maxChars: 4, truncatedNotice: "!" });
  const reduce = boundedChunkReducer(bound);

  vitestIt("appends a chunk that fits within the bound", () => {
    expect(reduce(emptyBoundedOutput, "ab")).toEqual(BoundedOutput.make({ text: "ab", truncated: false }));
  });

  vitestIt("truncates a chunk that overflows the bound, slicing to the remaining budget", () => {
    expect(reduce(emptyBoundedOutput, "abcdef")).toEqual(BoundedOutput.make({ text: "abcd!", truncated: true }));
  });

  vitestIt("appends only the truncation notice when the text is already at the cap", () => {
    expect(reduce(BoundedOutput.make({ text: "abcd", truncated: false }), "e")).toEqual(
      BoundedOutput.make({ text: "abcd!", truncated: true })
    );
  });

  vitestIt("is idempotent once truncated", () => {
    const truncated = reduce(emptyBoundedOutput, "abcdef");
    expect(reduce(truncated, "ghi")).toBe(truncated);
  });

  vitestIt.effect(
    "folds a byte stream into bounded text with the truncation notice",
    Effect.fnUntraced(function* () {
      const result = yield* collectBoundedText(bound)(Stream.fromIterable([encode("ab"), encode("cdef")]));
      expect(result).toEqual(BoundedOutput.make({ text: "abcd!", truncated: true }));
    })
  );

  vitestIt.effect(
    "folds a short byte stream without truncating",
    Effect.fnUntraced(function* () {
      const result = yield* collectBoundedText(bound)(Stream.fromIterable([encode("hi")]));
      expect(result).toEqual(BoundedOutput.make({ text: "hi", truncated: false }));
    })
  );

  vitestIt("exposes the divergent repo-run and quality bounds", () => {
    expect(repoRunOutputBound.maxChars).toBe(512 * 1024);
    expect(qualityStepOutputBound.maxChars).toBe(8 * 1024 * 1024);
    expect(repoRunOutputBound.truncatedNotice).toContain("[repo-run]");
    expect(qualityStepOutputBound.truncatedNotice).toContain("[beep-cli]");
  });

  vitestIt("formats a command line", () => {
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
