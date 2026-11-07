import {
  citationNativeRpcExit,
  citationNativeRpcFailure,
  citationNativeRpcRequest,
  makeCitationNativeRpcTransport,
  receiveCitationNativeConversation,
} from "@beep/law-practice-server/internal/Citation/NativeRpc";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { assertExitSuccess, assertNone, assertSome, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";

class Invalid extends S.TaggedError<Invalid>()("Invalid", {}) {}
type Message = "ready" | "started" | "done" | "failed";
const decoded: ReadonlyArray<Message> = ["ready", "started", "done", "failed"];
const conversation = (frames: ReadonlyArray<number>) =>
  receiveCitationNativeConversation({
    decode: (body: Uint8Array) => Effect.succeed(A.getUnsafe(decoded, body[0] ?? 0)),
    invalid: () => new Invalid(),
    isReady: (message) => message === "ready",
    isStarted: (message) => message === "started",
    isTerminal: (message) => message === "done" || message === "failed",
    read: (onFrame) => Effect.forEach(frames, (frame) => onFrame(new Uint8Array([frame])), { discard: true }),
    terminal: (message) => Effect.succeed(message === "done" ? Exit.succeed(1) : Exit.fail("native")),
  });

it.effect("accepts only Ready, Started then one terminal frame before EOF", () =>
  Effect.gen(function* () {
    assertExitSuccess(yield* conversation([0, 1, 2]), 1);
    deepStrictEqual(yield* conversation([0, 1, 3]), Exit.fail("native"));
    for (const frames of [[1], [0, 0], [0, 1, 1], [0, 1], []]) {
      const refused = yield* conversation(frames).pipe(Effect.flip);
      expect(refused._tag).toBe("Invalid");
    }
  })
);

it.effect("selects success, then typed failure, and refuses nonterminal data", () =>
  Effect.gen(function* () {
    const invalid = () => new Invalid();
    assertExitSuccess(yield* citationNativeRpcExit(O.some(1), O.some("ignored"), invalid), 1);
    deepStrictEqual(yield* citationNativeRpcExit(O.none(), O.some("native"), invalid), Exit.fail("native"));
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
    const ok = yield* makeCitationNativeRpcTransport({ stdin }, frame, () => new Invalid());
    yield* ok.options.onFromClient({ message: { _tag: "Ack" } });
    expect(written).toStrictEqual([]);
    yield* ok.options.onFromClient({ message: { _tag: "Request" } });
    yield* ok.sent;
    expect(written).toStrictEqual([frame]);
    expect(ok.options.generateRequestId()).toBe(ok.requestId);
    const broken = yield* makeCitationNativeRpcTransport(
      { stdin: Sink.fail("closed" as never) },
      frame,
      () => new Invalid()
    );
    const refused = yield* broken.options.onFromClient({ message: { _tag: "Request" } }).pipe(Effect.flip);
    expect(refused._tag).toBe("Invalid");
  })
);
