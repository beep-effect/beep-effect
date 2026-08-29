import {
  CaptureCommandTimedOutError,
  collectText,
  ensureZeroExit,
  runCaptured,
  withAdmissionWorkloadBinding,
} from "@beep/repo-cli/test/Process";
import { collectStepOutput, QualityTaskStep } from "@beep/repo-cli/test/Quality";
import { PosInt } from "@beep/schema/Int";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber, FileSystem, Layer, Ref, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import { ChildProcessSpawner } from "effect/unstable/process";
import type { ChildProcess } from "effect/unstable/process";

const encoder = new TextEncoder();

const ActiveAdmissionWorkload = S.fromJsonString(
  S.Struct({
    schemaVersion: S.Literal("yeet-admission-workload/v1"),
    leaseId: S.String,
    status: S.Literal("active"),
    processGroupId: PosInt,
    procStart: S.String,
  })
);

const processGroupFromStat = (text: string): number | undefined => {
  const commandEnd = text.lastIndexOf(") ");
  if (commandEnd < 0) return undefined;
  const processGroup = Number(
    text
      .slice(commandEnd + 2)
      .trim()
      .split(/\s+/u)[2]
  );
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
}) {
  const closed = yield* Deferred.make<void>();
  const killCount = yield* Ref.make(0);
  const pipe = Stream.make(encoder.encode(options.output)).pipe(
    Stream.concat(Stream.fromEffect(Deferred.await(closed)).pipe(Stream.drain))
  );
  const handle = ChildProcessSpawner.makeHandle({
    all: pipe,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
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
    Stream.concat(Stream.fromEffect(Deferred.await(closed)).pipe(Stream.drain))
  );
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
  it.effect("collects decoded text and distinguishes zero from nonzero exits", () =>
    Effect.gen(function* () {
      expect(yield* collectText(Stream.make(encoder.encode("a"), encoder.encode("b")))).toBe("ab");
      expect(yield* ensureZeroExit({ exitCode: 0, value: "ok" }, (exitCode) => `exit ${exitCode}`)).toEqual({
        exitCode: 0,
        value: "ok",
      });
      expect(yield* ensureZeroExit({ exitCode: 7 }, (exitCode) => `exit ${exitCode}`).pipe(Effect.flip)).toBe("exit 7");
    })
  );

  it.live("fails closed for partial explicit and inherited admission bindings", () =>
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

  it.live("reports workload write and process-generation registration failures", () =>
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
      const root = yield* fs.makeTempDirectory({ prefix: "step-exec-missing-proc-" });
      const missing = yield* makeStuckSpawner({ output: "", killEndsStream: false, pid: 2_000_000_000 });
      yield* Deferred.succeed(missing.closed, void 0);
      const registrationFailure = yield* runCaptured({ command: "fake-step", args: [] }).pipe(
        withAdmissionWorkloadBinding(`${root}/workload`, "lease-proc"),
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, missing.spawner),
        Effect.flip,
        Effect.ensuring(fs.remove(root, { recursive: true }).pipe(Effect.ignore))
      );
      expect(registrationFailure.message).toContain("Failed to read process generation");
    }).pipe(provideScopedLayer(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)))
  );

  it.live("inherits a scoped admission workload and lets an explicit nested binding override it", () =>
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
            expect(yield* fs.readFileString(outerPath)).toBe(outer);
          }),
        (root) => fs.remove(root, { recursive: true }).pipe(Effect.ignore)
      );
    }).pipe(provideScopedLayer(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)))
  );

  it.live("distinguishes inherited, matching explicit, and owned explicit admission generations", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectory({ prefix: "step-exec-inherited-" });
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

            expect(yield* fs.exists(inheritedPath)).toBe(false);
            expect(yield* fs.readFileString(ownedPath)).toContain('"status":"active"');
          }),
        () =>
          Effect.sync(() => {
            if (previousPath === undefined) delete Bun.env.BEEP_YEET_ADMISSION_WORKLOAD_PATH;
            else Bun.env.BEEP_YEET_ADMISSION_WORKLOAD_PATH = previousPath;
            if (previousLease === undefined) delete Bun.env.BEEP_YEET_ADMISSION_LEASE_ID;
            else Bun.env.BEEP_YEET_ADMISSION_LEASE_ID = previousLease;
          })
      ).pipe(Effect.ensuring(fs.remove(root, { recursive: true }).pipe(Effect.ignore)));
    }).pipe(provideScopedLayer(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)))
  );

  it.live(
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
import { runCaptured } from "@beep/repo-cli/test/Process";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect } from "effect";

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

              let ready = false;
              for (let attempt = 0; attempt < 300 && !ready; attempt += 1) {
                ready = yield* fs.exists(readyPath);
                if (!ready) yield* Effect.sleep("10 millis");
              }
              expect(ready).toBe(true);

              const workload = yield* S.decodeEffect(ActiveAdmissionWorkload)(yield* fs.readFileString(workloadPath));
              const nestedPid = Number(yield* fs.readFileString(readyPath));
              const nestedGroup = processGroupFromStat(yield* fs.readFileString(`/proc/${nestedPid}/stat`));
              expect(nestedGroup).toBe(workload.processGroupId);

              yield* Fiber.interrupt(outer);
              let nestedAlive = true;
              for (let attempt = 0; attempt < 300 && nestedAlive; attempt += 1) {
                nestedAlive = yield* fs.exists(`/proc/${nestedPid}`);
                if (nestedAlive) yield* Effect.sleep("10 millis");
              }
              expect(nestedAlive).toBe(false);
            }),
          (root) => fs.remove(root, { recursive: true }).pipe(Effect.ignore)
        );
      }).pipe(provideScopedLayer(NodeServices.layer)),
    15_000
  );

  it.effect(
    "maps a bounded quality-step timeout to exit code 124",
    Effect.fnUntraced(function* () {
      const { spawner } = yield* makeNeverExitSpawner();
      const fiber = yield* Effect.forkChild(
        collectStepOutput(
          QualityTaskStep.make({
            label: "fake-step",
            command: "fake-step",
            args: ["--flag"],
            cwd: process.cwd(),
            captureTimeoutMillis: PosInt.make(60_000),
          })
        ).pipe(
          provideScopedLayer(
            Layer.mergeAll(
              NodeFileSystem.layer,
              NodePath.layer,
              Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner)
            )
          )
        )
      );

      yield* TestClock.adjust("1 minute");

      const result = yield* Fiber.join(fiber);
      expect(result.exitCode).toBe(124);
      expect(result.output).toContain("fake-step --flag");
    })
  );

  it.effect(
    "reaps the child's group when a straggler holds the pipe open after exit, keeping captured text",
    Effect.fnUntraced(function* () {
      const { killCount, spawner } = yield* makeStuckSpawner({ output: "partial output", killEndsStream: true });
      const fiber = yield* Effect.forkChild(
        runCaptured({ command: "fake-step", args: ["--flag"] }).pipe(
          provideScopedLayer(Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner))
        )
      );

      yield* TestClock.adjust("2 seconds");

      const result = yield* Fiber.join(fiber);
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain("partial output");
      expect(yield* Ref.get(killCount)).toBe(1);
    })
  );

  it.effect(
    "dies loudly naming the command when even the group reap cannot close the pipe",
    Effect.fnUntraced(function* () {
      const { killCount, spawner } = yield* makeStuckSpawner({ output: "partial", killEndsStream: false });
      const fiber = yield* Effect.forkChild(
        runCaptured({ command: "fake-step", args: ["--flag"] }).pipe(
          provideScopedLayer(Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner))
        )
      );

      yield* TestClock.adjust("2 seconds");
      yield* TestClock.adjust("3 seconds");

      const exit = yield* Fiber.await(fiber);
      expect(Exit.isFailure(exit)).toBe(true);
      const rendered = Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "";
      expect(rendered).toContain("CapturePipeWedgedError");
      expect(rendered).toContain("fake-step --flag");
      expect(yield* Ref.get(killCount)).toBe(1);
    })
  );

  it.effect(
    "never kills a child whose stream closes on its own",
    Effect.fnUntraced(function* () {
      const { closed, killCount, spawner } = yield* makeStuckSpawner({ output: "clean", killEndsStream: false });
      yield* Deferred.succeed(closed, void 0);

      const result = yield* runCaptured({ command: "fake-step", args: [] }).pipe(
        provideScopedLayer(Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner))
      );

      expect(result.exitCode).toBe(0);
      expect(result.output).toBe("clean");
      expect(yield* Ref.get(killCount)).toBe(0);
    })
  );

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
        }).pipe(provideScopedLayer(Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner)))
      );

      yield* TestClock.adjust("1 minute");

      const exit = yield* Fiber.await(fiber);
      expect(Exit.isFailure(exit)).toBe(true);
      const rendered = Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "";
      expect(rendered).toContain("CaptureCommandTimedOutError");
      expect(rendered).toContain("fake-step --flag");
      expect(yield* Ref.get(killCount)).toBe(1);
      expect(yield* Ref.get(killOptions)).toEqual([{ forceKillAfter: "1 second" }]);
      expect(yield* Ref.get(unrefCount)).toBe(1);
    })
  );

  it.effect(
    "returns a typed timeout after bounded cleanup when the child never reports exit",
    Effect.fnUntraced(function* () {
      const { killCount, spawner, unrefCount } = yield* makeNeverExitSpawner(false);
      const fiber = yield* Effect.forkChild(
        Effect.flip(
          runCaptured({
            command: "fake-step",
            args: ["--flag"],
            timeout: "1 minute",
            forceKillAfter: "1 second",
          }).pipe(provideScopedLayer(Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner)))
        )
      );

      yield* TestClock.adjust("1 minute");
      yield* TestClock.adjust("2 seconds");

      const error = yield* Fiber.join(fiber);
      expect(error).toBeInstanceOf(CaptureCommandTimedOutError);
      if (S.is(CaptureCommandTimedOutError)(error)) {
        expect(error.commandLine).toBe("fake-step --flag");
      }
      expect(yield* Ref.get(killCount)).toBe(1);
      expect(yield* Ref.get(unrefCount)).toBe(1);
    })
  );

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
        }).pipe(provideScopedLayer(Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner)))
      );

      yield* TestClock.adjust("1 minute");
      yield* Fiber.interrupt(fiber);

      expect(yield* Ref.get(killCount)).toBe(1);
      expect(yield* Ref.get(unrefCount)).toBe(1);
    })
  );
});
