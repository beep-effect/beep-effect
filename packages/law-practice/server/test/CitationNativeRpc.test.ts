import {
  citationNativeRpcExit,
  citationNativeRpcFailure,
  citationNativeRpcRequest,
  makeCitationNativeRpcTransport,
  receiveCitationNativeConversation,
  runCitationNativeRpcJob,
} from "@beep/law-practice-server/internal/Citation/NativeRpc";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { assertExitSuccess, assertNone, assertSome, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import type * as RpcMessage from "effect/rpc/RpcMessage";

class Invalid extends S.TaggedError<Invalid, { readonly brand: unique symbol }>()("Invalid", {}) {}
type Message = "ready" | "started" | "done" | "failed";
const decoded: ReadonlyArray<Message> = ["ready", "started", "done", "failed"];
const conversation = (frames: ReadonlyArray<number>) =>
  receiveCitationNativeConversation({
    decode: (body: Uint8Array) => Effect.succeed(A.getUnsafe(decoded, body[0] ?? 0)),
    invalid: () => Invalid.make({}),
    isReady: (message) => message === "ready",
    isStarted: (message) => message === "started",
    isTerminal: (message) => message === "done" || message === "failed",
    read: (onFrame) => Effect.forEach(frames, (frame) => onFrame(new Uint8Array([frame])), { discard: true }),
    terminal: (message) => Effect.succeed(message === "done" ? Exit.succeed(1) : Exit.fail("native")),
  });

it.effect("accepts only Ready, Started then one terminal frame before EOF", () =>
  Effect.gen(function* () {
    const done = yield* conversation([0, 1, 2]);
    assertExitSuccess(done, 1);
    const failed = yield* conversation([0, 1, 3]);
    deepStrictEqual(failed, Exit.fail("native"));
    for (const frames of [[1], [0, 0], [0, 1, 1], [0, 1], []]) {
      const refused = yield* conversation(frames).pipe(Effect.flip);
      expect(refused._tag).toBe("Invalid");
    }
  })
);

it.effect("selects success, then typed failure, and refuses nonterminal data", () =>
  Effect.gen(function* () {
    const invalid = () => Invalid.make({});
    const succeeded = yield* citationNativeRpcExit(O.some(1), O.some("ignored"), invalid);
    assertExitSuccess(succeeded, 1);
    const failed = yield* citationNativeRpcExit(O.none(), O.some("native"), invalid);
    deepStrictEqual(failed, Exit.fail("native"));
    const refused = yield* citationNativeRpcExit(O.none(), O.none(), invalid).pipe(Effect.flip);
    expect(refused._tag).toBe("Invalid");
    type Wire = { readonly _tag: "Ok" } | { readonly _tag: "Failure"; readonly failure: string };
    const failure = citationNativeRpcFailure(
      (message: Wire): message is Extract<Wire, { readonly _tag: "Failure" }> => message._tag === "Failure"
    );
    assertSome(failure({ _tag: "Failure", failure: "x" }), "x");
    assertNone(failure({ _tag: "Ok" }));
  })
);

it.effect("builds the single request envelope in both call forms", () =>
  Effect.sync(() => {
    const direct = citationNativeRpcRequest<never>("Run" as never, { value: 1 } as never);
    const curried = citationNativeRpcRequest<never>({ value: 1 } as never)("Run" as never);
    expect(direct).toStrictEqual(curried);
    expect(direct).toMatchObject({ _tag: "Request", tag: "Run", payload: { value: 1 } });
  })
);

it.effect("writes the encoded frame only for the request and maps write failure", () =>
  Effect.gen(function* () {
    const written: Array<Uint8Array> = [];
    const stdin = Sink.forEach((chunk: Uint8Array) => Effect.sync(() => written.push(chunk)));
    const frame = new Uint8Array([7]);
    const ok = yield* makeCitationNativeRpcTransport({ stdin }, frame, () => Invalid.make({}));
    yield* ok.options.onFromClient({ message: { _tag: "Ack" } });
    expect(written).toStrictEqual([]);
    yield* ok.options.onFromClient({ message: { _tag: "Request" } });
    yield* ok.sent;
    expect(written).toStrictEqual([frame]);
    expect(ok.options.generateRequestId()).toBe(ok.requestId);
    const broken = yield* makeCitationNativeRpcTransport({ stdin: Sink.fail("closed" as never) }, frame, () =>
      Invalid.make({})
    );
    const refused = yield* broken.options.onFromClient({ message: { _tag: "Request" } }).pipe(Effect.flip);
    expect(refused._tag).toBe("Invalid");
  })
);

const JobRpcs = RpcGroup.make(
  Rpc.make("Double", { payload: { value: S.Finite }, success: S.Finite, error: S.String }),
  Rpc.make("Count", { success: S.Finite, stream: true })
);
type JobRpc = RpcGroup.Rpcs<typeof JobRpcs>;
const failureOf = <A, E>(exit: Exit.Exit<A, E>) =>
  Exit.isFailure(exit) ? Cause.findErrorOption(exit.cause) : O.none<E>();
const jobHandlers = JobRpcs.toLayer({
  Double: ({ value }) => (value > 0 ? Effect.succeed(value * 2) : Effect.fail("negative")),
  Count: () => Stream.make(1, 2),
});
const runJob = Effect.fn("NativeRpcTest.runJob")(function* (
  request: RpcMessage.Request<JobRpc>,
  reply: (exit: Rpc.Exit<JobRpc>) => Effect.Effect<void, Invalid> = () => Effect.void
) {
  const exits: Array<Rpc.Exit<JobRpc>> = [];
  const outcome = yield* runCitationNativeRpcJob(JobRpcs, request, (exit) =>
    Effect.sync(() => exits.push(exit)).pipe(Effect.andThen(reply(exit)))
  ).pipe(Effect.exit);
  return { exits, outcome };
});

it.layer(jobHandlers, { timeout: 10_000 })("in-process native RPC jobs", (it) => {
  it.effect("completes one in-process job only with its terminal handler Exit", () =>
    Effect.gen(function* () {
      const succeeded = yield* runJob(citationNativeRpcRequest<JobRpc>("Double", { value: 21 }));
      assertExitSuccess(succeeded.outcome, undefined);
      deepStrictEqual(succeeded.exits, [Exit.succeed(42)]);
      const failed = yield* runJob(citationNativeRpcRequest<JobRpc>({ value: -1 })("Double"));
      assertExitSuccess(failed.outcome, undefined);
      expect(failed.exits).toHaveLength(1);
      assertSome(failureOf(A.getUnsafe(failed.exits, 0)), "negative");
      // Streamed chunks precede the terminal Exit and never complete the job.
      const streamed = yield* runJob(citationNativeRpcRequest<JobRpc>("Count", undefined));
      assertExitSuccess(streamed.outcome, undefined);
      expect(streamed.exits).toHaveLength(1);
      assertTrue(A.getUnsafe(streamed.exits, 0).pipe(Exit.isSuccess));
    })
  );

  it.effect("propagates the terminal reply writer's failure as the job outcome", () =>
    Effect.gen(function* () {
      const refused = yield* runJob(citationNativeRpcRequest<JobRpc>("Double", { value: 1 }), () =>
        Effect.fail(Invalid.make({}))
      );
      deepStrictEqual(refused.exits, [Exit.succeed(2)]);
      assertSome(failureOf(refused.outcome), Invalid.make({}));
    })
  );
});
