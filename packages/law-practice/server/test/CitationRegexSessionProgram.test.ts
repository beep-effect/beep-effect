import { CitationRegexPatternDescriptor } from "@beep/law-practice-server/internal/Citation/RegexDescriptors";
import { CitationRegexResultEnvelope } from "@beep/law-practice-server/internal/Citation/RegexResult";
import { citationRegexSessionProgram } from "@beep/law-practice-server/internal/Citation/RegexSessionProgram";
import {
  CitationRegexSessionJob,
  encodeCitationRegexSessionJob,
} from "@beep/law-practice-server/internal/Citation/RegexSessionProtocol";
import {
  CitationRegexSessionStartup,
  decodeCitationRegexSessionReply,
  encodeCitationRegexSessionStartup,
} from "@beep/law-practice-server/internal/Citation/RegexSessionRpc";
import { readCitationRegexFrames } from "@beep/law-practice-server/internal/Citation/RegexWorkerProtocol";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as PlatformError from "effect/PlatformError";
import * as Predicate from "effect/Predicate";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { citationNativeNodeTestPlatform, makeCitationNativeSleepClock } from "./CitationNativeSpawner.fixtures.ts";

const encodeResult = S.encodeEffect(S.fromJsonString(CitationRegexResultEnvelope));
const decodeDescriptor = S.decodeUnknownEffect(CitationRegexPatternDescriptor);
const bound = decodeDescriptor({
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
const frame = Effect.fnUntraced(function* (sequence: number, maxMatches = 2) {
  return yield* encodeCitationRegexSessionJob(
    CitationRegexSessionJob.make({
      engine: "python-re",
      descriptor: yield* bound,
      sequence,
      patternWidth: 1,
      patternBytes: new TextEncoder().encode("(?P<maybe>a)?(b)"),
      sourceWidth: 1,
      sourceBytes: new TextEncoder().encode("ab b"),
      flags: 0,
      mode: "finditer",
      maxMatches,
    }),
    8192
  );
});

it.layer(citationNativeNodeTestPlatform, { excludeTestServices: true, timeout: "30 seconds" })(
  "isolated session worker program",
  (it) => {
    it.effect("loops through two complete jobs and emits a closed policy failure for the next job", () =>
      Effect.gen(function* () {
        const stdio = yield* Stdio.Stdio;
        const limits = { ...(yield* defaultCitationEnginePolicy).limits, patternMatches: 2 };
        const argument = yield* encodeCitationRegexSessionStartup(CitationRegexSessionStartup.make({ limits }));
        const chunks = A.empty<Uint8Array>();
        const frames = yield* Effect.all([frame(0), frame(1), frame(2, 3)]);
        yield* citationRegexSessionProgram.pipe(
          Effect.provideService(Stdio.Stdio, {
            ...stdio,
            args: Effect.succeed([argument]),
            stdin: Stream.fromIterable(frames),
            stdout: () =>
              Sink.forEach((chunk: string | Uint8Array) =>
                Effect.sync(() => {
                  chunks.push(Predicate.isString(chunk) ? new TextEncoder().encode(chunk) : chunk);
                })
              ),
          })
        );
        const tags = A.empty<string>();
        yield* readCitationRegexFrames(Stream.fromIterable(chunks), 8192, "continuous", (bytes) =>
          decodeCitationRegexSessionReply(bytes).pipe(
            Effect.tap((reply) =>
              Effect.sync(() => {
                tags.push(reply._tag);
              })
            )
          )
        );
        expect(tags).toEqual(["Ready", "Started", "Complete", "Started", "Complete", "Started", "Failure"]);
      })
    );
    it.effect("rejects a wrong sequence and sanitizes actual stdout sink failures", () =>
      Effect.gen(function* () {
        const stdio = yield* Stdio.Stdio;
        const { limits } = yield* defaultCitationEnginePolicy;
        const argument = yield* encodeCitationRegexSessionStartup(CitationRegexSessionStartup.make({ limits }));
        const badFrame = yield* frame(1);
        const wrong = yield* citationRegexSessionProgram.pipe(
          Effect.provideService(Stdio.Stdio, {
            ...stdio,
            args: Effect.succeed([argument]),
            stdin: Stream.make(badFrame),
            stdout: () => Sink.drain,
          }),
          Effect.flip
        );
        expect(wrong).toMatchObject({ reason: "invalid-frame" });
        const validFrame = yield* frame(0);
        for (const brokenStage of [1, 2, 3]) {
          const tags = A.empty<string>();
          const broken = yield* citationRegexSessionProgram.pipe(
            Effect.provideService(Stdio.Stdio, {
              ...stdio,
              args: Effect.succeed([argument]),
              stdin: Stream.make(validFrame),
              stdout: () =>
                Sink.forEach((chunk: string | Uint8Array) =>
                  Effect.gen(function* () {
                    const bytes = Predicate.isString(chunk) ? new TextEncoder().encode(chunk) : chunk;
                    const reply = yield* decodeCitationRegexSessionReply(bytes.subarray(0, -1)).pipe(Effect.orDie);
                    tags.push(reply._tag);
                    if (tags.length === brokenStage)
                      return yield* PlatformError.systemError({ _tag: "Unknown", module: "Stdio", method: "stdout" });
                  })
                ),
            }),
            Effect.flip
          );
          expect(broken).toMatchObject({ _tag: "CitationRegexWorkerFailure", reason: "channel-failed" });
          expect(tags).toEqual(A.take(["Ready", "Started", "Complete"], brokenStage));
          expect(tags.length).toBe(brokenStage);
        }
      })
    );
    it.effect("bounds the additional sequenced result header and sanitizes unexpected evaluator defects", () =>
      Effect.gen(function* () {
        const stdio = yield* Stdio.Stdio;
        const { limits } = yield* defaultCitationEnginePolicy;
        const boundDescriptor = yield* bound;
        const result = yield* encodeResult(
          CitationRegexResultEnvelope.make({ groups: 2, matches: 40, spans: Str.repeat(1280)("A") })
        );
        const maximum = new TextEncoder().encode(result).byteLength + 1;
        const argument = yield* encodeCitationRegexSessionStartup(
          CitationRegexSessionStartup.make({ limits: { ...limits, processMessageBytes: maximum } })
        );
        const input = yield* encodeCitationRegexSessionJob(
          CitationRegexSessionJob.make({
            engine: "python-re",
            descriptor: boundDescriptor,
            sequence: 0,
            patternWidth: 1,
            patternBytes: new TextEncoder().encode("(?P<maybe>a)?(b)"),
            sourceWidth: 1,
            sourceBytes: new TextEncoder().encode(Str.repeat(20)("ab b")),
            flags: 0,
            mode: "finditer",
            maxMatches: 40,
          }),
          maximum
        );
        const tags = A.empty<string>();
        const chunks = A.empty<Uint8Array>();
        yield* citationRegexSessionProgram.pipe(
          Effect.provideService(Stdio.Stdio, {
            ...stdio,
            args: Effect.succeed([argument]),
            stdin: Stream.make(input),
            stdout: () =>
              Sink.forEach((chunk: string | Uint8Array) =>
                Effect.sync(() => {
                  chunks.push(Predicate.isString(chunk) ? new TextEncoder().encode(chunk) : chunk);
                })
              ),
          })
        );
        yield* readCitationRegexFrames(Stream.fromIterable(chunks), maximum, "continuous", (bytes) =>
          decodeCitationRegexSessionReply(bytes).pipe(
            Effect.tap((reply) =>
              Effect.sync(() => {
                tags.push(reply._tag);
              })
            )
          )
        );
        expect(tags).toEqual(["Ready", "Started", "Failure"]);
        const normalArgument = yield* encodeCitationRegexSessionStartup(CitationRegexSessionStartup.make({ limits }));
        const normalFrame = yield* encodeCitationRegexSessionJob(
          CitationRegexSessionJob.make({
            engine: "python-re",
            descriptor: boundDescriptor,
            sequence: 0,
            patternWidth: 1,
            patternBytes: new TextEncoder().encode("(?P<maybe>a)?(b)"),
            sourceWidth: 1,
            sourceBytes: new TextEncoder().encode(Str.repeat(1250)("ab b")),
            flags: 0,
            mode: "finditer",
            maxMatches: 2,
          }),
          8192
        );
        let defects = 0;
        const sanitized = A.empty<Uint8Array>();
        const controlled = yield* makeCitationNativeSleepClock(() => {
          defects++;
          return Effect.die("unexpected clock failure");
        });
        const defect = yield* citationRegexSessionProgram.pipe(
          Effect.provideService(Clock.Clock, controlled),
          Effect.provideService(Stdio.Stdio, {
            ...stdio,
            args: Effect.succeed([normalArgument]),
            stdin: Stream.make(normalFrame),
            stdout: () =>
              Sink.forEach((chunk: string | Uint8Array) =>
                Effect.sync(() => {
                  sanitized.push(Predicate.isString(chunk) ? new TextEncoder().encode(chunk) : chunk);
                })
              ),
          }),
          Effect.exit
        );
        expect(defects).toBe(1);
        expect(defect._tag).toBe("Failure");
        const replies = A.empty<string>();
        yield* readCitationRegexFrames(
          Stream.fromIterable(sanitized),
          limits.processMessageBytes,
          "continuous",
          (bytes) =>
            decodeCitationRegexSessionReply(bytes).pipe(
              Effect.tap((reply) =>
                Effect.sync(() => {
                  replies.push(reply._tag);
                })
              )
            )
        );
        expect(replies).toEqual(["Ready", "Started"]);
      })
    );
  }
);
