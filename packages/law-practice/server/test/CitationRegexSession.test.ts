import * as NodeURL from "node:url";
import { CitationInvocation, CitationInvocationPolicy } from "@beep/law-practice-server/internal/Citation/Invocation";
import {
  CitationNativeProcessAdmission,
  makeCitationNativeProcessAdmission,
} from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import { makeCitationNativeLane } from "@beep/law-practice-server/internal/Citation/NativeLane";
import { CitationNativeProcessRuntime } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { CitationRegexPatternDescriptor } from "@beep/law-practice-server/internal/Citation/RegexDescriptors";
import { citationUnaccountedText } from "@beep/law-practice-server/internal/Citation/RegexInput";
import { makeCitationRegexProgram } from "@beep/law-practice-server/internal/Citation/RegexProgram";
import { makeCitationRegexSession } from "@beep/law-practice-server/internal/Citation/RegexSession";
import { makeCitationRegexSessionPreparation } from "@beep/law-practice-server/internal/Citation/RegexSessionProtocol";
import { installCitationRegexEvaluator } from "@beep/law-practice-server/internal/Citation/RegexWorker";
import { decodeCitationRegexReply } from "@beep/law-practice-server/internal/Citation/RegexWorkerRpc";
import { makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Digest from "effect/crypto/Digest";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { identity } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcess from "effect/process/ChildProcess";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import {
  citationBunTestExecutable,
  citationNativeNodeTestPlatform,
  citationNodeTestExecutable,
  makeCitationNativeManualClock,
  makeCitationObservedSpawner,
  makeCitationRegexTestRuntime,
  waitForCitationNativeTest,
} from "./CitationNativeSpawner.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import type { CitationRegexEngine } from "@beep/law-practice-server/internal/Citation/RegexEngine";
import type { ChildProcessHandle } from "effect/process/ChildProcessSpawner";

const decodeDescriptor = S.decodeEffect(CitationRegexPatternDescriptor);
const descriptor = decodeDescriptor({
  patternSha256: "b07d89ba5ecfc4ef7c8c6208e879a81454b1cc89203805eceef7e16b55117bb7",
  flags: 0,
  profile: {
    groups: 2,
    names: { maybe: 1 },
    minimumWidthFloor: 1,
    repeatedCaptures: false,
    nullableMultiRepeat: false,
  },
});
const native = (text: string) => ({ width: 1, bytes: new TextEncoder().encode(text) });
const fixtureMessageBytes = (mode: string) =>
  Match.value(mode).pipe(
    Match.whenOr("closed-stdin", "blocked-stdin", () => 2097152),
    Match.whenOr("oversize", "preflight", () => 1024),
    Match.orElse(() => 8192)
  );
const setup = Effect.fn("RegexSessionTest.setup")(function* (
  kind: CitationNativeRuntimeKind,
  mode: string,
  barrier?: {
    readonly stage: string;
    readonly entered: Deferred.Deferred<void>;
    readonly release: Deferred.Deferred<void>;
    readonly consumed?: Deferred.Deferred<void>;
  }
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "citation-regex-session-" });
  const executable = yield* kind === "bun" ? citationBunTestExecutable : citationNodeTestExecutable;
  const workerFile = path.join(cwd, `${mode}.mjs`);
  const runtime =
    mode === "real"
      ? yield* makeCitationRegexTestRuntime(kind, cwd)
      : CitationNativeProcessRuntime.make({ kind, executable, cwd, workerFile });
  if (mode !== "real")
    yield* fs.copyFile(NodeURL.fileURLToPath(new URL("./CitationRegexSession.child.mjs", import.meta.url)), workerFile);
  const timer = yield* makeCitationNativeManualClock(Duration.millis(800));
  const limits = {
    ...(yield* defaultCitationEnginePolicy).limits,
    regexDeadline: Duration.millis(800),
    cleanupDeadline: Duration.seconds(2),
    sourceUtf16: 1000000,
    processMessageBytes: fixtureMessageBytes(mode),
  };
  const owner = yield* makeCitationNativeProcessAdmission(limits);
  let returns = 0;
  const admission = CitationNativeProcessAdmission.of({
    ...owner,
    acquire: Effect.fn("RegexSessionTest.observeLease")(function* (operation) {
      const lease = yield* owner.acquire(operation);
      return {
        ...lease,
        release: Effect.sync(() => {
          returns++;
        }).pipe(Effect.andThen(lease.release)),
      };
    }),
  });
  const observed = yield* makeCitationObservedSpawner();
  let liveSigkills = 0;
  let writeBytes = 0;
  let pids = A.empty<number>();
  const wait =
    barrier === undefined
      ? Effect.void
      : Deferred.succeed(barrier.entered, undefined).pipe(Effect.andThen(Deferred.await(barrier.release)));
  const observeInput = (input: ChildProcessHandle["stdin"]) => {
    const control = barrier;
    if (control === undefined) return input;
    return Match.value(control.stage).pipe(
      Match.when("blocked-write", () =>
        input.pipe(
          Sink.mapInputEffect((bytes: Uint8Array) =>
            Effect.sync(() => {
              writeBytes = bytes.byteLength;
            }).pipe(Effect.andThen(Deferred.succeed(control.entered, undefined)), Effect.as(bytes))
          ),
          Sink.mapEffect(() => Deferred.succeed(control.release, undefined).pipe(Effect.asVoid))
        )
      ),
      Match.when("write", () => input.pipe(Sink.mapInputEffect((bytes: Uint8Array) => wait.pipe(Effect.as(bytes))))),
      Match.when("write-error", () =>
        input.pipe(
          Sink.mapInputEffect(() =>
            Effect.fail(PlatformError.systemError({ module: "ChildProcessSpawner", method: "stdin", _tag: "Unknown" }))
          )
        )
      ),
      Match.orElse(() => input)
    );
  };
  const consumed = barrier?.consumed;
  const spawner = ChildProcessSpawner.of({
    ...observed.spawner,
    spawn: Effect.fn("RegexSessionTest.observeLiveKill")(function* (command) {
      const handle = yield* observed.spawner.spawn(command);
      pids = A.append(pids, handle.pid);
      if (barrier?.stage === "spawn") yield* wait;
      return {
        ...handle,
        isRunning:
          barrier?.stage === "uncertain"
            ? Deferred.isDone(barrier.release).pipe(
                Effect.flatMap((released) => (released ? handle.isRunning : Effect.succeed(true)))
              )
            : handle.isRunning,
        stdin: observeInput(handle.stdin),
        stdout: handle.stdout.pipe(
          Stream.tap((bytes) =>
            barrier?.stage === "startup" ||
            (barrier?.stage === "read" && Str.includes('"Complete"')(new TextDecoder().decode(bytes)))
              ? wait
              : Effect.void
          ),
          Stream.flatMap((bytes) =>
            Stream.make(bytes).pipe(
              Stream.concat(
                Stream.fromEffectDrain(
                  consumed === undefined ||
                    barrier === undefined ||
                    !Str.includes('"Ready"')(new TextDecoder().decode(bytes))
                    ? Effect.void
                    : Deferred.isDone(barrier.entered).pipe(
                        Effect.flatMap((entered) => (entered ? Deferred.succeed(consumed, undefined) : Effect.void))
                      )
                )
              )
            )
          )
        ),
        kill: Effect.fn("RegexSessionTest.kill")(function* (options: Parameters<typeof handle.kill>[0]) {
          if (options?.killSignal === "SIGKILL" && (yield* handle.isRunning)) liveSigkills++;
          if (barrier?.stage === "retire") yield* wait;
          return yield* handle.kill(options);
        }),
      };
    }),
  });
  const scope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
  const lane = yield* makeCitationNativeLane(limits, "extract").pipe(
    Effect.provideService(Scope.Scope, scope),
    Effect.provideService(Clock.Clock, timer.clock),
    Effect.provideService(CitationNativeProcessAdmission, admission),
    Effect.provideService(ChildProcessSpawner, spawner)
  );
  const session = yield* makeCitationRegexSession(limits, "extract", lane).pipe(
    Effect.provideService(Scope.Scope, scope)
  );
  const prepare = yield* makeCitationRegexSessionPreparation(limits, citationUnaccountedText);
  const bound = yield* descriptor;
  const evaluateJob = Effect.fn("RegexSessionTest.evaluateJob")(
    (
      engine: typeof CitationRegexEngine.Type,
      selected: CitationRegexPatternDescriptor,
      pattern: unknown,
      source: unknown,
      transformFrame: (frame: Uint8Array) => Uint8Array = identity
    ) =>
      session.evaluate(
        runtime,
        Effect.fnUntraced(function* (sequence, run, reserve) {
          const job = yield* prepare.prepare(engine, selected, sequence, pattern, source, 0, 2, () => reserve);
          return yield* run(job.job, transformFrame(job.frame));
        })
      )
  );
  const evaluate = evaluateJob("python-re", bound, native("(?P<maybe>a)?(b)"), native("ab b"));
  return {
    fs,
    spawner,
    pids: Effect.sync(() => pids),
    runtime,
    workerFile,
    evaluate,
    evaluateJob,
    bound,
    limits,
    session,
    lane,
    scope,
    admission,
    returns: Effect.sync(() => returns),
    observed,
    timer,
    liveSigkills: Effect.sync(() => liveSigkills),
    writeBytes: Effect.sync(() => writeBytes),
  };
});

const assertRetired = Effect.fn("RegexSessionTest.assertRetired")(function* (
  fixture: Effect.Success<ReturnType<typeof setup>>
) {
  const counts = yield* fixture.observed.snapshot;
  expect(counts).toEqual({ spawned: 1, confirmed: 1 });
  const lane = yield* fixture.lane.snapshot;
  expect(lane).toMatchObject({ started: 1, confirmed: 1, occupied: false });
});

const assertClosed = Effect.fn("RegexSessionTest.assertClosed")(function* (
  fixture: Effect.Success<ReturnType<typeof setup>>,
  count: number,
  reason = "closed"
) {
  const kills = yield* fixture.liveSigkills;
  expect(kills).toBe(count);
  const before = yield* fixture.observed.snapshot;
  expect(before).toEqual({ spawned: count, confirmed: count });
  const lane = yield* fixture.lane.snapshot;
  expect(lane).toMatchObject({ started: count, confirmed: count, acquired: false, occupied: false, unitsAcquired: 1 });
  const returned = yield* fixture.returns;
  expect(returned).toBe(1);
  const capacity = yield* fixture.admission.snapshot;
  expect(capacity).toMatchObject({ active: 0, queued: 0, quarantined: 0 });
  for (const pid of yield* fixture.pids) {
    const alive = yield* fixture.fs.exists(`/proc/${pid}`);
    expect(alive).toBe(false);
  }
  const next = yield* fixture.evaluate.pipe(Effect.flip);
  expect(next).toMatchObject({ reason });
  yield* Scope.close(fixture.scope, Exit.void);
  const after = yield* fixture.observed.snapshot;
  expect(after).toEqual(before);
  const finalReturns = yield* fixture.returns;
  expect(finalReturns).toBe(1);
  const closedLane = yield* fixture.lane.snapshot;
  expect(closedLane).toMatchObject({ acquired: false, unitsAcquired: 1 });
});

const interruptAwait = Effect.fn("RegexSessionTest.interruptAwait")(function* (
  kind: CitationNativeRuntimeKind,
  stage: string
) {
  const entered = yield* Deferred.make<void>();
  const release = yield* Deferred.make<void>();
  const fixture = yield* setup(kind, stage === "retire" ? "wrong-sequence" : stage === "read" ? "result" : "real", {
    stage,
    entered,
    release,
  });
  const pending = yield* fixture.evaluate.pipe(Effect.forkChild);
  if (stage === "read") {
    yield* waitForCitationNativeTest(fixture.session.snapshot.pipe(Effect.map((value) => value.state === "running")));
    yield* fixture.fs.writeFileString(`${fixture.workerFile}.result-release`, "release");
  }
  yield* Deferred.await(entered);
  const acknowledged = yield* Deferred.make<void>();
  const interrupted = yield* Fiber.interrupt(pending).pipe(
    Effect.andThen(Deferred.succeed(acknowledged, undefined)),
    Effect.forkChild
  );
  if (stage === "retire" || stage === "spawn") {
    yield* Effect.yieldNow;
    const done = yield* Deferred.isDone(acknowledged);
    expect(done).toBe(false);
    const held = yield* fixture.admission.snapshot;
    expect(held.active).toBe(1);
    yield* Deferred.succeed(release, undefined);
  }
  yield* Fiber.join(interrupted);
  const outcome = yield* Fiber.await(pending);
  expect(Exit.hasInterrupts(outcome)).toBe(true);
  yield* assertClosed(fixture, 1, stage === "retire" ? "invalid-frame" : "closed");
});

it.layer(citationNativeNodeTestPlatform, { excludeTestServices: true, timeout: "30 seconds", concurrent: false })(
  "regex sessions with real child runtimes",
  (it) => {
    A.forEach(["bun", "node"] as const, (kind) => {
      it.effect(`ignores a late ${kind} frame during an expected lane retirement`, () =>
        Effect.gen(function* () {
          const entered = yield* Deferred.make<void>();
          const release = yield* Deferred.make<void>();
          const consumed = yield* Deferred.make<void>();
          const fixture = yield* setup(kind, "idle", { stage: "retire", entered, release, consumed });
          yield* fixture.evaluate;
          const yielding = yield* fixture.lane.yieldTo(Effect.void).pipe(Effect.forkChild);
          yield* Deferred.await(entered);
          yield* fixture.fs.writeFileString(`${fixture.workerFile}.release`, "release");
          yield* Deferred.await(consumed);
          yield* Deferred.succeed(release, undefined);
          yield* Fiber.join(yielding);
          const state = yield* fixture.session.snapshot;
          expect(state.state).toBe("absent");
          yield* assertRetired(fixture);
        })
      );
      it.effect(`quarantines an unconfirmed ${kind} idle-protocol retirement and confirms it on Scope retry`, () =>
        Effect.gen(function* () {
          const entered = yield* Deferred.make<void>();
          const release = yield* Deferred.make<void>();
          const fixture = yield* setup(kind, "idle", { stage: "uncertain", entered, release });
          yield* Effect.gen(function* () {
            yield* fixture.evaluate;
            yield* fixture.fs.writeFileString(`${fixture.workerFile}.release`, "release");
            yield* waitForCitationNativeTest(
              fixture.admission.snapshot.pipe(Effect.map((value) => value.quarantined === 1))
            );
            yield* Deferred.succeed(release, undefined);
            yield* Scope.close(fixture.scope, Exit.void);
            yield* assertRetired(fixture);
            const capacity = yield* fixture.admission.snapshot;
            expect(capacity).toMatchObject({ active: 0, quarantined: 0 });
          }).pipe(Effect.ensuring(Deferred.succeed(release, undefined)));
        })
      );
      it.effect(`confirms ${kind} death after a real large stdin write receives EPIPE`, () =>
        Effect.gen(function* () {
          const entered = yield* Deferred.make<void>();
          const release = yield* Deferred.make<void>();
          const fixture = yield* setup(kind, "closed-stdin", { stage: "blocked-write", entered, release });
          const pending = yield* fixture
            .evaluateJob("python-re", fixture.bound, native("(?P<maybe>a)?(b)"), native(Str.repeat(1000000)("a")))
            .pipe(Effect.flip, Effect.forkChild);
          yield* Deferred.await(entered);
          const bytes = yield* fixture.writeBytes;
          expect(bytes).toBeGreaterThan(1048576);
          yield* Effect.sleep(Duration.millis(10));
          const acknowledged = yield* Deferred.isDone(release);
          expect(acknowledged).toBe(false);
          yield* fixture.fs.writeFileString(`${fixture.workerFile}.close-input`, "close");
          yield* waitForCitationNativeTest(fixture.fs.exists(`${fixture.workerFile}.entered`));
          const early = yield* Fiber.join(pending).pipe(Effect.timeoutOption(Duration.millis(500)));
          const failure = yield* O.match(early, {
            onSome: (failure) => Effect.succeed(failure),
            onNone: () => fixture.timer.triggerSleep(1).pipe(Effect.andThen(Fiber.join(pending))),
          });
          expect(failure).toMatchObject({ reason: "channel-failed" });
          yield* assertRetired(fixture);
          const kills = yield* fixture.liveSigkills;
          expect(kills).toBe(1);
          const returned = yield* fixture.returns;
          expect(returned).toBe(1);
          for (const pid of yield* fixture.pids) {
            const alive = yield* fixture.fs.exists(`/proc/${pid}`);
            expect(alive).toBe(false);
          }
          const next = yield* fixture.evaluate.pipe(Effect.flip);
          expect(next).toEqual(failure);
          yield* assertRetired(fixture);
          yield* Scope.close(fixture.scope, Exit.void);
          const after = yield* fixture.returns;
          expect(after).toBe(1);
        })
      );
      it.effect(`expires the job deadline while a large write to a real ${kind} child is blocked`, () =>
        Effect.gen(function* () {
          const entered = yield* Deferred.make<void>();
          const release = yield* Deferred.make<void>();
          const fixture = yield* setup(kind, "blocked-stdin", { stage: "blocked-write", entered, release });
          const pending = yield* fixture
            .evaluateJob("python-re", fixture.bound, native("(?P<maybe>a)?(b)"), native(Str.repeat(1000000)("a")))
            .pipe(Effect.flip, Effect.forkChild);
          yield* Deferred.await(entered);
          const bytes = yield* fixture.writeBytes;
          expect(bytes).toBeGreaterThan(1048576);
          yield* Effect.sleep(Duration.millis(10));
          const acknowledged = yield* Deferred.isDone(release);
          expect(acknowledged).toBe(false);
          expect(pending.pollUnsafe()).toBeUndefined();
          yield* fixture.timer.triggerSleep(1);
          const failure = yield* Fiber.join(pending);
          expect(failure).toMatchObject({ limit: "regexDeadline" });
          yield* assertRetired(fixture);
          const kills = yield* fixture.liveSigkills;
          expect(kills).toBe(1);
          const returned = yield* fixture.returns;
          expect(returned).toBe(1);
          for (const pid of yield* fixture.pids) {
            const alive = yield* fixture.fs.exists(`/proc/${pid}`);
            expect(alive).toBe(false);
          }
          const next = yield* fixture.evaluate.pipe(Effect.flip);
          expect(next).toEqual(failure);
          yield* assertRetired(fixture);
          yield* Scope.close(fixture.scope, Exit.void);
          const after = yield* fixture.returns;
          expect(after).toBe(1);
        })
      );
      it.effect(`fails closed after ${kind} reports a typed job failure`, () =>
        Effect.gen(function* () {
          const fixture = yield* setup(kind, "failure");
          const failure = yield* fixture.evaluate.pipe(Effect.flip);
          expect(failure).toMatchObject({ limit: "patternMatches" });
          yield* assertRetired(fixture);
          const later = yield* fixture.evaluate.pipe(Effect.flip);
          expect(later).toEqual(failure);
          yield* assertRetired(fixture);
        })
      );
      it.effect(`confirms ${kind} retirement after the input adapter reports a pipe failure`, () =>
        Effect.gen(function* () {
          const entered = yield* Deferred.make<void>();
          const release = yield* Deferred.make<void>();
          const fixture = yield* setup(kind, "real", { stage: "write-error", entered, release });
          const failure = yield* fixture.evaluate.pipe(Effect.flip);
          expect(failure).toMatchObject({ reason: "channel-failed" });
          yield* assertClosed(fixture, 1, "channel-failed");
        })
      );
      it.effect(`refuses ${kind} dispatch with a stale prepared sequence`, () =>
        Effect.gen(function* () {
          const fixture = yield* setup(kind, "real");
          const prepare = yield* makeCitationRegexSessionPreparation(fixture.limits, citationUnaccountedText);
          const failure = yield* fixture.session
            .evaluate(
              fixture.runtime,
              Effect.fnUntraced(function* (sequence, run, reserve) {
                const prepared = yield* prepare.prepare(
                  "python-re",
                  fixture.bound,
                  sequence + 1,
                  native("(?P<maybe>a)?(b)"),
                  native("ab"),
                  0,
                  1,
                  () => reserve
                );
                return yield* run(prepared.job, prepared.frame);
              })
            )
            .pipe(Effect.flip);
          expect(failure).toMatchObject({ reason: "invalid-frame" });
          yield* assertClosed(fixture, 1, "invalid-frame");
        })
      );
      it.effect(`translates a closed ${kind} lane before direct session preparation`, () =>
        Effect.gen(function* () {
          const fixture = yield* setup(kind, "real");
          yield* Scope.close(fixture.scope, Exit.void);
          const failure = yield* fixture.evaluate.pipe(Effect.flip);
          expect(failure).toMatchObject({ reason: "closed" });
          const counts = yield* fixture.observed.snapshot;
          expect(counts).toEqual({ spawned: 0, confirmed: 0 });
        })
      );
      it.effect(`preflights the installed ${kind} evaluator before pattern maps or compilation`, () =>
        Effect.gen(function* () {
          const fixture = yield* setup(kind, "preflight");
          const evaluator = yield* installCitationRegexEvaluator(fixture.limits, fixture.runtime, [fixture.bound]).pipe(
            Effect.provideService(Clock.Clock, fixture.lane.clock),
            Effect.provideService(ChildProcessSpawner, fixture.spawner)
          );
          const budget = yield* makeCitationTextBudget(fixture.limits);
          const invocation = CitationInvocation.of({
            scope: fixture.scope,
            budget,
            lane: fixture.lane,
            regex: fixture.session,
            policy: CitationInvocationPolicy.make({
              limits: fixture.limits,
              operation: "extract",
              deadlineStarts: "before-admission",
            }),
          });
          const original = globalThis.Uint32Array;
          const originalBytes = globalThis.Uint8Array;
          const pattern = native("(?P<maybe>a)?(b)");
          const source = native(Str.repeat(700)("a"));
          let copies = 0;
          let allocations = 0;
          const outcome = yield* Effect.gen(function* () {
            globalThis.Uint32Array = new Proxy(original, {
              construct(target, args) {
                if (args[0] === pattern.bytes.byteLength + 1 || args[0] === source.bytes.byteLength + 1) allocations++;
                return Reflect.construct(target, args);
              },
            });
            globalThis.Uint8Array = new Proxy(originalBytes, {
              construct(target, args) {
                if (
                  args[0] === pattern.bytes ||
                  args[0] === pattern.bytes.byteLength ||
                  args[0] === pattern.bytes.byteLength + 1 ||
                  args[0] === source.bytes.byteLength
                )
                  copies++;
                return Reflect.construct(target, args);
              },
            });
            return yield* evaluator
              .evaluate(pattern, source, 0, 2)
              .pipe(Effect.provideService(CitationInvocation, invocation), Effect.flip);
          }).pipe(
            Effect.ensuring(
              Effect.sync(() => {
                globalThis.Uint32Array = original;
                globalThis.Uint8Array = originalBytes;
              })
            )
          );
          expect(outcome).toMatchObject({ limit: "processMessageBytes" });
          expect(allocations).toBe(0);
          expect(copies).toBe(0);
          const receipt = yield* fixture.lane.snapshot;
          expect(receipt).toMatchObject({ started: 0, unitsAcquired: 0, acquired: false });
        })
      );
      it.effect(`owns the ${kind} prepared pattern through authoritative fingerprint awaits`, () =>
        Effect.gen(function* () {
          const fixture = yield* setup(kind, "real");
          const entered = yield* Deferred.make<void>();
          const release = yield* Deferred.make<void>();
          const crypto = yield* Digest.Digest;
          let first = true;
          const digest = Digest.Digest.of({
            ...crypto,
            digestHex: Effect.fn("RegexSessionTest.gatedFingerprint")(function* (algorithm, bytes) {
              if (first) {
                first = false;
                yield* Deferred.succeed(entered, undefined);
                yield* Deferred.await(release);
              }
              return yield* crypto.digestHex(algorithm, bytes);
            }),
          });
          const evaluator = yield* installCitationRegexEvaluator(fixture.limits, fixture.runtime, [fixture.bound]).pipe(
            Effect.provideService(Clock.Clock, fixture.lane.clock),
            Effect.provideService(ChildProcessSpawner, fixture.spawner),
            Effect.provideService(Digest.Digest, digest)
          );
          const budget = yield* makeCitationTextBudget(fixture.limits);
          const invocation = CitationInvocation.of({
            scope: fixture.scope,
            budget,
            lane: fixture.lane,
            regex: fixture.session,
            policy: CitationInvocationPolicy.make({
              limits: fixture.limits,
              operation: "extract",
              deadlineStarts: "before-admission",
            }),
          });
          const pattern = native("(?P<maybe>a)?(b)");
          const pending = yield* evaluator
            .evaluate(pattern, native("ab"), 0, 2)
            .pipe(Effect.provideService(CitationInvocation, invocation), Effect.forkChild);
          yield* Deferred.await(entered);
          pattern.bytes.fill(97);
          yield* Deferred.succeed(release, undefined);
          const completed = yield* Fiber.join(pending);
          expect(completed.result.matches).toBe(1);
          yield* Scope.close(fixture.scope, Exit.void);
          const counts = yield* fixture.observed.snapshot;
          expect(counts).toEqual({ spawned: 1, confirmed: 1 });
          const capacity = yield* fixture.admission.snapshot;
          expect(capacity).toMatchObject({ active: 0, quarantined: 0 });
        })
      );
      for (const warm of [false, true]) {
        it.effect(`poisons ${kind} on preparation interruption with ${warm ? "an idle child" : "no child"}`, () =>
          Effect.gen(function* () {
            const fixture = yield* setup(kind, "real");
            if (warm) yield* fixture.evaluate;
            const entered = yield* Deferred.make<void>();
            const pending = yield* fixture.session
              .evaluate(fixture.runtime, (_sequence, _run, reserve) =>
                reserve.pipe(Effect.andThen(Deferred.succeed(entered, undefined)), Effect.andThen(Effect.never))
              )
              .pipe(Effect.forkChild);
            yield* Deferred.await(entered);
            yield* Fiber.interrupt(pending);
            yield* assertClosed(fixture, warm ? 1 : 0);
          })
        );
      }
      it.effect(`leaves ${kind} preparation and its idle child untouched when a queued evaluation is interrupted`, () =>
        Effect.gen(function* () {
          const fixture = yield* setup(kind, "real");
          yield* fixture.evaluate;
          const entered = yield* Deferred.make<void>();
          const release = yield* Deferred.make<void>();
          const first = yield* fixture.session
            .evaluate(fixture.runtime, () =>
              Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(release)))
            )
            .pipe(Effect.forkChild);
          yield* Deferred.await(entered);
          const before = yield* fixture.admission.snapshot;
          const queued = yield* fixture.evaluate.pipe(Effect.forkChild);
          yield* Effect.yieldNow;
          yield* Fiber.interrupt(queued);
          const state = yield* fixture.session.snapshot;
          expect(state).toMatchObject({ state: "idle", jobs: 1, sequence: 1 });
          const counts = yield* fixture.observed.snapshot;
          expect(counts).toEqual({ spawned: 1, confirmed: 0 });
          const after = yield* fixture.admission.snapshot;
          expect(after).toEqual(before);
          yield* Deferred.succeed(release, undefined);
          yield* Fiber.join(first);
          yield* fixture.evaluate;
          yield* Scope.close(fixture.scope, Exit.void);
          yield* assertRetired(fixture);
          const returns = yield* fixture.returns;
          expect(returns).toBe(1);
        })
      );
      it.effect(`keeps the active ${kind} job healthy and reuses its child after cancelling a queued evaluation`, () =>
        Effect.gen(function* () {
          const entered = yield* Deferred.make<void>();
          const release = yield* Deferred.make<void>();
          const fixture = yield* setup(kind, "real", { stage: "read", entered, release });
          const first = yield* fixture.evaluate.pipe(Effect.forkChild);
          yield* Deferred.await(entered);
          const before = yield* fixture.admission.snapshot;
          const queued = yield* fixture.evaluate.pipe(Effect.forkChild);
          yield* Effect.yieldNow;
          yield* Fiber.interrupt(queued);
          const counts = yield* fixture.observed.snapshot;
          expect(counts).toEqual({ spawned: 1, confirmed: 0 });
          const after = yield* fixture.admission.snapshot;
          expect(after).toEqual(before);
          const kills = yield* fixture.liveSigkills;
          expect(kills).toBe(0);
          yield* Deferred.succeed(release, undefined);
          const firstResult = yield* Fiber.join(first);
          const idle = yield* fixture.session.snapshot;
          expect(idle).toMatchObject({ state: "idle", jobs: 1, sequence: 1 });
          const thirdResult = yield* fixture.evaluate;
          expect(thirdResult).toEqual(firstResult);
          const reused = yield* fixture.observed.snapshot;
          expect(reused).toEqual({ spawned: 1, confirmed: 0 });
          yield* Scope.close(fixture.scope, Exit.void);
          yield* assertRetired(fixture);
          const returns = yield* fixture.returns;
          expect(returns).toBe(1);
        })
      );
      for (const handover of ["diff", "cleaner"]) {
        it.effect(`serializes ${kind} preparation against ${handover} handover`, () =>
          Effect.gen(function* () {
            const fixture = yield* setup(kind, "real");
            yield* fixture.evaluate;
            const entered = yield* Deferred.make<void>();
            const release = yield* Deferred.make<void>();
            const pending = yield* fixture.session
              .evaluate(
                fixture.runtime,
                Effect.fnUntraced(function* (sequence, run) {
                  yield* Deferred.succeed(entered, undefined);
                  yield* Deferred.await(release);
                  const preparation = yield* makeCitationRegexSessionPreparation(
                    fixture.limits,
                    citationUnaccountedText
                  );
                  const prepared = yield* preparation.prepare(
                    "python-re",
                    fixture.bound,
                    sequence,
                    native("(?P<maybe>a)?(b)"),
                    native("ab"),
                    0,
                    2,
                    () => Effect.void
                  );
                  return yield* run(prepared.job, prepared.frame);
                })
              )
              .pipe(Effect.forkChild);
            yield* Deferred.await(entered);
            const attempting = yield* Deferred.make<void>();
            const switched = yield* Deferred.succeed(attempting, undefined).pipe(
              Effect.andThen(
                handover === "cleaner"
                  ? fixture.lane.yieldTo(Effect.void)
                  : fixture.lane
                      .start("diff", ChildProcess.make(fixture.runtime.executable, ["-e", "process.stdin.resume()"]))
                      .pipe(Effect.asVoid)
              ),
              Effect.forkChild
            );
            yield* Deferred.await(attempting);
            yield* Effect.yieldNow;
            const waiting = yield* fixture.session.snapshot;
            expect(waiting.state).toBe("idle");
            const before = yield* fixture.observed.snapshot;
            expect(before).toEqual({ spawned: 1, confirmed: 0 });
            yield* Deferred.succeed(release, undefined);
            const result = yield* Fiber.join(pending);
            expect((yield* decodeCitationRegexReply(result))._tag).toBe("Complete");
            yield* Fiber.join(switched);
            expect((yield* fixture.session.snapshot).state).toBe("absent");
            yield* fixture.evaluate;
            yield* Scope.close(fixture.scope, Exit.void);
            const count = handover === "diff" ? 3 : 2;
            const counts = yield* fixture.observed.snapshot;
            expect(counts).toEqual({ spawned: count, confirmed: count });
            const receipt = yield* fixture.lane.snapshot;
            expect(receipt).toMatchObject({ acquired: false, unitsAcquired: handover === "cleaner" ? 2 : 1 });
          })
        );
      }
      for (const stage of ["spawn", "startup", "write", "read", "retire"]) {
        it.effect(`confirms ${kind} retirement on interruption during ${stage} await`, () =>
          interruptAwait(kind, stage)
        );
      }
      it.effect(`reuses one real ${kind} worker and restarts only after a lane handover`, () =>
        Effect.gen(function* () {
          const fixture = yield* setup(kind, "real");
          const first = yield* fixture.evaluate;
          const reply = yield* decodeCitationRegexReply(first);
          expect(reply).toMatchObject({ _tag: "Complete", matches: 2 });
          yield* fixture.evaluate;
          const reused = yield* fixture.observed.snapshot;
          expect(reused).toEqual({ spawned: 1, confirmed: 0 });
          const other = yield* fixture.lane.start(
            "diff",
            ChildProcess.make(fixture.runtime.executable, ["-e", "process.stdin.resume()"])
          );
          yield* other.child;
          yield* fixture.evaluate;
          yield* Scope.close(fixture.scope, Exit.void);
          const counts = yield* fixture.observed.snapshot;
          expect(counts).toEqual({ spawned: 3, confirmed: 3 });
          const lane = yield* fixture.lane.snapshot;
          expect(lane).toMatchObject({ started: 3, confirmed: 3, occupied: false });
        })
      );

      it.effect(`runs python-re then python-regex-v0 in one ${kind} process`, () =>
        Effect.gen(function* () {
          const fixture = yield* setup(kind, "real");
          yield* fixture.evaluate;
          const pattern = native("a(?i)b");
          const compiler = yield* makeCitationRegexProgram(fixture.limits, "python-re");
          const refusal = yield* compiler.compile(pattern, 0).pipe(Effect.flip);
          expect(refusal).toMatchObject({ reason: "unsupported-syntax" });
          const selected = yield* decodeDescriptor({
            patternSha256: "b4a51cc851097ac7f4e51ea7bccb09a459faaa5aad15ee88aed0241d0e364048",
            flags: 0,
            profile: {
              groups: 0,
              names: {},
              minimumWidthFloor: 2,
              repeatedCaptures: false,
              nullableMultiRepeat: false,
            },
          });
          const body = yield* fixture.evaluateJob("python-regex-v0", selected, pattern, native("aB"));
          const reply = yield* decodeCitationRegexReply(body);
          expect(reply).toMatchObject({ _tag: "Complete", matches: 1 });
          const active = yield* fixture.observed.snapshot;
          expect(active).toEqual({ spawned: 1, confirmed: 0 });
          const session = yield* fixture.session.snapshot;
          expect(session).toMatchObject({ jobs: 2, sequence: 2, state: "idle" });
          yield* Scope.close(fixture.scope, Exit.void);
          yield* assertRetired(fixture);
        })
      );

      it.effect(`kills a real ${kind} worker on a schema-invalid job engine`, () =>
        Effect.gen(function* () {
          const fixture = yield* setup(kind, "real");
          const failed = yield* fixture
            .evaluateJob("python-re", fixture.bound, native("(?P<maybe>a)?(b)"), native("ab b"), (frame) =>
              new TextEncoder().encode(
                Str.replace('"engine":"python-re"', '"engine":"invalid"')(new TextDecoder().decode(frame))
              )
            )
            .pipe(Effect.flip);
          expect(failed).toMatchObject({ reason: "invalid-frame" });
          yield* assertRetired(fixture);
          const again = yield* fixture.evaluate.pipe(Effect.flip);
          expect(again).toEqual(failed);
          yield* assertRetired(fixture);
        })
      );

      it.effect(`SIGKILLs a live ${kind} child after stdout EOF and confirms death before return`, () =>
        Effect.gen(function* () {
          const fixture = yield* setup(kind, "eof-live");
          const failed = yield* fixture.evaluate.pipe(Effect.flip);
          expect(failed).toMatchObject({ reason: "invalid-frame" });
          const entered = yield* fixture.fs.exists(`${fixture.workerFile}.entered`);
          expect(entered).toBe(true);
          const kills = yield* fixture.liveSigkills;
          expect(kills).toBe(1);
          yield* assertRetired(fixture);
        })
      );

      it.effect(`expires only the ${kind} job timer during a catastrophic regex and confirms death before return`, () =>
        Effect.gen(function* () {
          const fixture = yield* setup(kind, "running");
          const pending = yield* Effect.forkChild(fixture.evaluate);
          yield* waitForCitationNativeTest(fixture.fs.exists(`${fixture.workerFile}.entered`));
          yield* waitForCitationNativeTest(
            fixture.session.snapshot.pipe(Effect.map((snapshot) => snapshot.state === "running"))
          );
          const running = yield* fixture.session.snapshot;
          expect(running.state).toBe("running");
          let responsive = false;
          yield* Effect.sync(() => {
            responsive = true;
          }).pipe(Effect.forkChild, Effect.flatMap(Fiber.join));
          expect(responsive).toBe(true);
          const sleeps = yield* fixture.timer.sleeps;
          expect(sleeps).toBe(2);
          yield* fixture.timer.triggerSleep(1);
          const failure = yield* Fiber.join(pending).pipe(Effect.flip);
          expect(failure).toMatchObject({
            _tag: "CitationSafetyLimitExceeded",
            operation: "extract",
            limit: "regexDeadline",
          });
          yield* assertRetired(fixture);
        })
      );

      it.effect(`fails closed without a ${kind} respawn after a killed job`, () =>
        Effect.gen(function* () {
          const fixture = yield* setup(kind, "running");
          const pending = yield* Effect.forkChild(fixture.evaluate);
          yield* waitForCitationNativeTest(fixture.fs.exists(`${fixture.workerFile}.entered`));
          yield* fixture.timer.triggerSleep(1);
          const first = yield* Fiber.join(pending).pipe(Effect.flip);
          const second = yield* fixture.evaluate.pipe(Effect.flip);
          expect(second).toEqual(first);
          yield* assertRetired(fixture);
        })
      );

      for (const mode of ["wrong-sequence", "eof", "oversize"] as const) {
        it.effect(`kills and confirms ${kind} on ${mode}`, () =>
          Effect.gen(function* () {
            const fixture = yield* setup(kind, mode);
            const failure = yield* fixture.evaluate.pipe(Effect.flip);
            expect(failure._tag).toBe(
              mode === "oversize" ? "CitationSafetyLimitExceeded" : "CitationRegexWorkerFailure"
            );
            yield* assertRetired(fixture);
            const again = yield* fixture.evaluate.pipe(Effect.flip);
            expect(again).toEqual(failure);
            yield* assertRetired(fixture);
          })
        );
      }

      it.effect(`kills and confirms ${kind} on a frame while idle`, () =>
        Effect.gen(function* () {
          const fixture = yield* setup(kind, "idle");
          yield* fixture.evaluate;
          const before = yield* fixture.session.snapshot;
          expect(before.state).toBe("idle");
          yield* fixture.fs.writeFileString(`${fixture.workerFile}.release`, "release");
          yield* waitForCitationNativeTest(
            fixture.session.snapshot.pipe(Effect.map((snapshot) => snapshot.state === "killed"))
          );
          const failed = yield* fixture.evaluate.pipe(Effect.flip);
          expect(failed).toMatchObject({ reason: "invalid-frame" });
          yield* assertRetired(fixture);
        })
      );

      for (const mode of ["sent", "running"] as const) {
        it.effect(`confirms ${kind} death before acknowledging interruption during ${mode}`, () =>
          Effect.gen(function* () {
            const fixture = yield* setup(kind, mode);
            const pending = yield* Effect.forkChild(fixture.evaluate);
            yield* waitForCitationNativeTest(
              fixture.session.snapshot.pipe(Effect.map((snapshot) => snapshot.state === mode))
            );
            yield* Fiber.interrupt(pending);
            const outcome = yield* Fiber.await(pending);
            expect(Exit.hasInterrupts(outcome)).toBe(true);
            yield* assertRetired(fixture);
            const refused = yield* fixture.evaluate.pipe(Effect.flip);
            expect(refused).toMatchObject({ reason: "closed" });
            yield* assertRetired(fixture);
          })
        );
      }
    });
  }
);
