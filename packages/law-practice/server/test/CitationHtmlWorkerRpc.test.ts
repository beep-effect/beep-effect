import {
  CitationHtmlWorkerJob,
  CitationHtmlWorkerReady,
  CitationHtmlWorkerStarted,
  CitationHtmlWorkerSuccess,
  encodeCitationHtmlReply,
} from "@beep/law-practice-server/internal/Citation/HtmlWorkerProtocol";
import { prepareCitationHtmlRpc } from "@beep/law-practice-server/internal/Citation/HtmlWorkerRpc";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as PlatformError from "effect/PlatformError";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";

const request = CitationHtmlWorkerJob.make({
  encoding: "UTF-8",
  bytes: new Uint8Array(0),
  fullHtml: false,
  outputUtf16: 99,
});
const replies = Effect.forEach(
  [
    CitationHtmlWorkerReady.make({}),
    CitationHtmlWorkerStarted.make({}),
    CitationHtmlWorkerSuccess.make({ text: "a\ud800b" }),
  ],
  (reply) => encodeCitationHtmlReply(reply, 4096)
);

it.effect("an immediate complete reply waits for request registration and a stalled write", () =>
  Effect.gen(function* () {
    const call = yield* prepareCitationHtmlRpc(request, 4096);
    const writing = yield* Deferred.make<void>();
    const read = yield* Deferred.make<void>();
    const finish = yield* Deferred.make<void>();
    let sends = 0;
    const citationResult1 = yield* replies;
    const child = {
      stdout: Stream.fromIterable(citationResult1).pipe(Stream.ensuring(Deferred.succeed(read, undefined))),
      stdin: Sink.forEach<Uint8Array, void, never, never>(() =>
        Effect.gen(function* () {
          sends++;
          yield* Deferred.succeed(writing, undefined);
          yield* Deferred.await(finish);
        })
      ),
    };
    const running = yield* Effect.forkChild(call(child));
    yield* Deferred.await(writing);
    yield* Deferred.await(read);
    yield* Effect.yieldNow;
    expect(running.pollUnsafe()).toBeUndefined();
    yield* Deferred.succeed(finish, undefined);
    const citationResult2 = yield* Fiber.join(running);
    expect(citationResult2).toBe("a\ud800b");
    expect(sends).toBe(1);
  })
);

it.effect("a failed request write is redacted and never retried", () =>
  Effect.gen(function* () {
    const call = yield* prepareCitationHtmlRpc(request, 4096);
    let sends = 0;
    const failed = yield* call({
      stdout: Stream.never,
      stdin: Sink.forEach(() =>
        Effect.gen(function* () {
          sends++;
          return yield* PlatformError.badArgument({ module: "test", method: "stdin", description: "private source" });
        })
      ),
    }).pipe(Effect.flip);
    expect(failed).toMatchObject({ _tag: "CitationHtmlWorkerFailure", reason: "channel-failed" });
    expect(failed.message).not.toContain("private source");
    expect(sends).toBe(1);
  })
);

it.effect("rejects a valid control message sent in the wrong protocol stage", () =>
  Effect.gen(function* () {
    const call = yield* prepareCitationHtmlRpc(request, 4096);
    const started = yield* encodeCitationHtmlReply(CitationHtmlWorkerStarted.make({}), 4096);
    const error = yield* call({ stdin: Sink.drain, stdout: Stream.make(started) }).pipe(Effect.flip);
    expect(error).toMatchObject({ _tag: "CitationHtmlWorkerFailure", reason: "invalid-frame" });
  })
);
