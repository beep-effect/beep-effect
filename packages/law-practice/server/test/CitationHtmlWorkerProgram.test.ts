import { citationHtmlWorkerProgram } from "@beep/law-practice-server/internal/Citation/HtmlWorkerProgram";
import {
  CitationHtmlWorkerJob,
  decodeCitationHtmlReply,
  encodeCitationHtmlJob,
} from "@beep/law-practice-server/internal/Citation/HtmlWorkerProtocol";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PlatformError from "effect/PlatformError";
import * as Predicate from "effect/Predicate";
import * as Sink from "effect/Sink";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import type { CitationHtmlWorkerReply } from "@beep/law-practice-server/internal/Citation/HtmlWorkerProtocol";

it.layer(Layer.merge(BunServices.layer, BunCrypto.layer))("HTML worker program boundary", (it) => {
  it.effect("emits ready, started and exactly one complete result for a bounded request", () =>
    Effect.gen(function* () {
      const stdio = yield* Stdio.Stdio;
      for (const outputUtf16 of [100, 1]) {
        const job = CitationHtmlWorkerJob.make({
          encoding: "UTF-8",
          bytes: new TextEncoder().encode("<p>Example</p>"),
          fullHtml: false,
          outputUtf16,
        });
        const frame = yield* encodeCitationHtmlJob(job, 4096);
        const replies = A.empty<CitationHtmlWorkerReply>();
        yield* citationHtmlWorkerProgram.pipe(
          Effect.provideService(Stdio.Stdio, {
            ...stdio,
            args: Effect.succeed(["4096"]),
            stdin: Stream.make(frame),
            stdout: () =>
              Sink.forEach((chunk: string | Uint8Array) =>
                decodeCitationHtmlReply(
                  (Predicate.isString(chunk) ? new TextEncoder().encode(chunk) : chunk).subarray(0, -1)
                ).pipe(
                  Effect.orDie,
                  Effect.tap((reply) => Effect.sync(() => replies.push(reply)))
                )
              ),
          })
        );
        expect(A.map(replies, (reply) => reply._tag)).toEqual([
          "Ready",
          "Started",
          outputUtf16 === 100 ? "Success" : "Failure",
        ]);
        expect(A.last(replies)).toMatchObject({
          value: outputUtf16 === 100 ? { text: "Example" } : { failure: { _tag: "CitationSafetyLimitExceeded" } },
        });
      }
    })
  );

  it.effect("rejects missing startup arguments before loading the native kernel", () =>
    Effect.gen(function* () {
      const stdio = yield* Stdio.Stdio;
      const error = yield* citationHtmlWorkerProgram.pipe(
        Effect.provideService(Stdio.Stdio, { ...stdio, args: Effect.succeed([]) }),
        Effect.flip
      );
      expect(error).toMatchObject({ _tag: "CitationHtmlWorkerFailure", reason: "invalid-runtime" });
    })
  );

  it.effect("rejects an empty request stream after startup without emitting a result", () =>
    Effect.gen(function* () {
      const stdio = yield* Stdio.Stdio;
      const error = yield* citationHtmlWorkerProgram.pipe(
        Effect.provideService(Stdio.Stdio, {
          ...stdio,
          args: Effect.succeed(["4096"]),
          stdin: Stream.empty,
          stdout: () => Sink.drain,
        }),
        Effect.flip
      );
      expect(error).toMatchObject({ _tag: "CitationHtmlWorkerFailure", reason: "invalid-frame" });
    })
  );

  it.effect("sanitizes a broken reply channel", () =>
    Effect.gen(function* () {
      const stdio = yield* Stdio.Stdio;
      const error = yield* citationHtmlWorkerProgram.pipe(
        Effect.provideService(Stdio.Stdio, {
          ...stdio,
          args: Effect.succeed(["4096"]),
          stdout: () => Sink.fail(PlatformError.systemError({ module: "Stdio", method: "stdout", _tag: "Unknown" })),
        }),
        Effect.flip
      );
      expect(error).toMatchObject({ _tag: "CitationHtmlWorkerFailure", reason: "channel-failed" });
    })
  );
});
