/** Invocation-owned sequenced regex process session.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as Queue from "effect/Queue";
import * as RpcClient from "effect/rpc/RpcClient";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import { citationNativeProcessCommand } from "./NativeProcess.ts";
import { makeCitationNativeRpcDelivery, makeCitationNativeRpcTransport } from "./NativeRpc.ts";
import {
  CitationRegexSessionReply,
  CitationRegexSessionRpcs,
  CitationRegexSessionStartup,
  citationRegexSessionResult,
  decodeCitationRegexSessionReply,
  encodeCitationRegexSessionStartup,
} from "./RegexSessionRpc.ts";
import { CitationRegexWorkerFailure, readCitationRegexFrames } from "./RegexWorkerProtocol.ts";
import { CitationRegexExecutionFailure } from "./RegexWorkerRpc.ts";
import type { CitationEngineLimits, CitationEngineOperation } from "@beep/law-practice-use-cases/server";
import type { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import type { CitationNativeLane, CitationNativeStart } from "./NativeLane.ts";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";
import type { CitationRegexEngine } from "./RegexEngine.ts";
import type { CitationRegexSessionJob } from "./RegexSessionProtocol.ts";

const $I = $LawPracticeServerId.create("internal/Citation/RegexSession");
const Phase = LiteralKit(["absent", "spawned", "idle", "sent", "running", "killed"]).pipe(
  $I.annoteSchema("Phase", { description: "Parent-owned process conversation phase." })
);
/** @internal @category models @since 0.0.0 */
export class CitationRegexSessionSnapshot extends S.Opaque<
  CitationRegexSessionSnapshot,
  { readonly brand: unique symbol }
>()(
  S.Struct({ jobs: S.Natural, sequence: S.Natural, state: Phase }).pipe(
    $I.annoteSchema("CitationRegexSessionSnapshot", { description: "Source-free invocation session diagnostics." })
  )
) {}
/** One invocation's serialized regex jobs, using the lane's Clock and spawner.
 * Preparation runs under serialization but outside the startup and job timers.
 * @internal @category services @since 0.0.0
 */
export class CitationRegexSession extends Context.Service<
  CitationRegexSession,
  {
    readonly checkRuntime: (
      clock: Clock.Clock,
      spawner: ChildProcessSpawner["Service"]
    ) => Effect.Effect<void, CitationRegexWorkerFailure>;
    readonly evaluate: <A, E, R>(
      runtime: CitationNativeProcessRuntime,
      engine: typeof CitationRegexEngine.Type,
      prepare: (
        sequence: number,
        evaluate: (
          job: CitationRegexSessionJob,
          frame: Uint8Array
        ) => Effect.Effect<Uint8Array, CitationRegexExecutionFailure>
      ) => Effect.Effect<A, E, R>
    ) => Effect.Effect<A, E | CitationRegexExecutionFailure, R>;
    readonly snapshot: Effect.Effect<CitationRegexSessionSnapshot>;
  }
>()($I`CitationRegexSession`) {}

const isExecutionFailure = S.is(CitationRegexExecutionFailure);
const invalid = () => CitationRegexWorkerFailure.make({ reason: "invalid-frame" });
const closed = () => CitationRegexWorkerFailure.make({ reason: "closed" });
const mapLaneFailure = (error: Effect.Error<ReturnType<CitationNativeStart>>) =>
  error._tag === "CitationNativeLaneFailure" ? CitationRegexWorkerFailure.make({ reason: error.reason }) : error;

/** Bind one lazy session to the invocation's lane and Scope.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationRegexSession = Effect.fn("Citation.makeRegexSession")(function* (
  limits: CitationEngineLimits,
  operation: CitationEngineOperation,
  lane: CitationNativeLane["Service"]
) {
  const scope = yield* Scope.Scope;
  const lock = yield* Semaphore.make(1);
  let state: typeof Phase.Type = "absent";
  let sequence = 0;
  let jobs = 0;
  let failure = O.none<CitationRegexExecutionFailure>();
  let current = O.none<Effect.Success<ReturnType<CitationNativeStart>>>();
  const ensureOpen = Effect.suspend(() =>
    O.isSome(failure) ? Effect.fail(failure.value) : lane.ensureOpen.pipe(Effect.mapError(mapLaneFailure))
  );
  const poison = (error: CitationRegexExecutionFailure) =>
    Effect.sync(() => {
      if (O.isNone(failure)) failure = O.some(error);
      state = "killed";
    });
  const retire = Effect.suspend(() =>
    O.isSome(current) ? current.value.process.retire(false).pipe(Effect.mapError(mapLaneFailure)) : Effect.void
  );
  const terminate = Effect.fnUntraced(function* (error: CitationRegexExecutionFailure) {
    yield* poison(error);
    yield* retire;
  });
  const timeout = <A, E, R>(body: Effect.Effect<A, E, R>) =>
    body.pipe(
      Effect.timeoutOrElse({
        duration: limits.regexDeadline,
        orElse: () => Effect.fail(CitationSafetyLimitExceeded.make({ operation, limit: "regexDeadline" })),
      }),
      Effect.provideService(Clock.Clock, lane.clock)
    );
  const start = Effect.fn("Citation.startRegexSession")(function* (
    runtime: CitationNativeProcessRuntime,
    engine: typeof CitationRegexEngine.Type
  ) {
    const argument = yield* encodeCitationRegexSessionStartup(CitationRegexSessionStartup.make({ limits, engine }));
    const replies = yield* Queue.make<CitationRegexSessionReply, CitationRegexExecutionFailure>({ capacity: 1 });
    const failed = yield* Deferred.make<O.Option<CitationRegexExecutionFailure>>();
    let expectedRetirement = false;
    const retiring = Effect.gen(function* () {
      expectedRetirement = true;
      yield* Deferred.succeed(failed, O.none());
      if (state === "idle") {
        state = "absent";
        sequence = 0;
        current = O.none();
      }
    });
    state = "spawned";
    const command = citationNativeProcessCommand(runtime, argument);
    const record = yield* lane
      .start(
        "regex",
        { ...command, options: { ...command.options, stdin: { stream: "pipe", endOnDone: false } } },
        retiring
      )
      .pipe(Effect.mapError(mapLaneFailure));
    current = O.some(record);
    const child = yield* record.child.pipe(Effect.mapError(mapLaneFailure));
    const transition = Effect.fnUntraced(function* (from: typeof Phase.Type, to: typeof Phase.Type, incoming: number) {
      if (state !== from || incoming !== sequence) return yield* invalid();
      state = to;
    });
    const receive = readCitationRegexFrames(
      child.stdout,
      limits.processMessageBytes,
      "continuous",
      Effect.fnUntraced(function* (bytes) {
        const reply = yield* decodeCitationRegexSessionReply(bytes);
        if (expectedRetirement) return;
        yield* CitationRegexSessionReply.match(reply, {
          Ready: () => transition("spawned", "idle", sequence),
          Started: (message) => transition("sent", "running", message.sequence),
          Complete: (message) => transition("running", "idle", message.sequence),
          Failure: (message) => transition("running", "idle", message.sequence),
        });
        yield* Queue.offer(replies, reply);
      })
    ).pipe(
      Effect.andThen(Effect.fail(invalid())),
      Effect.catchCause((cause) => {
        if (expectedRetirement) return Effect.void;
        const error = O.getOrElse(Cause.findErrorOption(cause), invalid);
        return poison(error).pipe(
          Effect.andThen(Queue.fail(replies, error)),
          Effect.andThen(Deferred.succeed(failed, O.some(error))),
          Effect.asVoid
        );
      })
    );
    yield* Effect.forkIn(receive, record.scope);
    // Retirement runs outside the reader's process Scope, so closing that Scope
    // can interrupt and join its reader without a circular retirement wait.
    yield* Deferred.await(failed).pipe(
      Effect.flatMap(O.match({ onNone: () => Effect.void, onSome: terminate })),
      Effect.catchCause(() => Effect.logError("Citation regex session retirement remains quarantined")),
      Effect.forkIn(scope)
    );
    const take = Queue.take(replies).pipe(Effect.tap(() => ensureOpen));
    const ready = yield* take.pipe(Effect.interruptible);
    if (!CitationRegexSessionReply.guards.Ready(ready)) return yield* invalid();
    return { child, take };
  }, Effect.uninterruptible);
  let transport = O.none<Effect.Success<ReturnType<typeof start>>>();
  const evaluate: CitationRegexSession["Service"]["evaluate"] = Effect.fn("Citation.evaluateRegexSession")(
    function* (runtime, engine, prepare) {
      return yield* lock.withPermit(
        Effect.gen(function* () {
          yield* ensureOpen;
          if (state === "absent") transport = O.none();
          const run = Effect.fnUntraced(function* (job: CitationRegexSessionJob, frame: Uint8Array) {
            return yield* Effect.uninterruptibleMask(
              Effect.fnUntraced(function* (restore) {
                const work = Effect.gen(function* () {
                  if (O.isNone(transport)) {
                    const started = yield* timeout(start(runtime, engine));
                    transport = O.some(started);
                  }
                  const connection = yield* Effect.fromOption(transport).pipe(Effect.mapError(invalid));
                  if (state !== "idle" || job.sequence !== sequence) return yield* invalid();
                  return yield* Effect.gen(function* () {
                    state = "sent";
                    jobs++;
                    const native = yield* makeCitationNativeRpcTransport(
                      connection.child,
                      frame,
                      () => CitationRegexWorkerFailure.make({ reason: "channel-failed" }),
                      sequence
                    );
                    const rpc = yield* RpcClient.makeNoSerialization(CitationRegexSessionRpcs, native.options);
                    const deliver = makeCitationNativeRpcDelivery({
                      sent: native.sent,
                      write: rpc.write,
                      requestId: native.requestId,
                    });
                    const receive = Effect.gen(function* () {
                      const started = yield* connection.take;
                      if (!CitationRegexSessionReply.guards.Started(started)) return yield* invalid();
                      const reply = yield* connection.take;
                      if (CitationRegexSessionReply.guards.Failure(reply))
                        return yield* reply.failure.pipe(Exit.fail, deliver);
                      if (!CitationRegexSessionReply.guards.Complete(reply)) return yield* invalid();
                      const body = yield* citationRegexSessionResult(reply);
                      yield* deliver(Exit.succeed(body));
                    });
                    const body = yield* Effect.zipWith(receive, rpc.client.Evaluate(job), (_received, value) => value, {
                      concurrent: true,
                    });
                    yield* ensureOpen;
                    sequence++;
                    return body;
                  }).pipe(Effect.scoped, timeout);
                });
                const outcome = yield* Effect.exit(restore(work));
                if (Exit.isFailure(outcome)) {
                  const error = outcome.cause.pipe(
                    Cause.findErrorOption,
                    O.filter(isExecutionFailure),
                    O.getOrElse(closed)
                  );
                  yield* terminate(error);
                }
                return yield* outcome;
              })
            );
          });
          const before = jobs;
          return yield* prepare(sequence, run).pipe(
            Effect.onExit((outcome) =>
              Exit.isFailure(outcome) && jobs > before
                ? outcome.cause.pipe(
                    Cause.findErrorOption,
                    O.filter(isExecutionFailure),
                    O.getOrElse(closed),
                    terminate
                  )
                : Effect.void
            )
          );
        })
      );
    }
  );
  return CitationRegexSession.of({
    evaluate,
    checkRuntime: Effect.fn("Citation.checkRegexSessionRuntime")(function* (clock, spawner) {
      if (clock !== lane.clock || spawner !== lane.spawner)
        return yield* CitationRegexWorkerFailure.make({ reason: "invalid-runtime" });
    }),
    snapshot: Effect.sync(() => CitationRegexSessionSnapshot.make({ jobs, sequence, state })),
  });
});
