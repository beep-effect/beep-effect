import { fileURLToPath } from "node:url";
import { CitationHtmlKernelFailure } from "@beep/law-practice-server/internal/Citation/HtmlKernel";
import {
  CitationHtmlWorkerError,
  CitationHtmlWorkerJob,
  CitationHtmlWorkerReady,
  CitationHtmlWorkerStarted,
  CitationHtmlWorkerSuccess,
  citationHtmlJsonBodyBytes,
  decodeCitationHtmlJob,
  decodeCitationHtmlReply,
  encodeCitationHtmlJob,
  encodeCitationHtmlReply,
  preflightCitationHtmlControlFrames,
  readCitationHtmlFrames,
} from "@beep/law-practice-server/internal/Citation/HtmlWorkerProtocol";
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import type { CitationHtmlWorkerReply } from "@beep/law-practice-server/internal/Citation/HtmlWorkerProtocol";

const CorpusJson = S.fromJsonString(S.Struct({ artifacts: S.Array(S.Struct({ value: S.String })) }));
const StringJson = S.fromJsonString(S.String);

const utf8 = new TextEncoder();
it.layer(BunFileSystem.layer)("HTML worker protocol", (it) => {
  it.effect("round-trips closed parser and safety errors through the complete reply frame", () =>
    Effect.gen(function* () {
      for (const failure of [
        CitationHtmlKernelFailure.make({ reason: "parse-error" }),
        CitationSafetyLimitExceeded.make({ operation: "clean", limit: "nativeHtmlParserResource" }),
      ]) {
        const reply = CitationHtmlWorkerError.make({ failure });
        const frame = yield* encodeCitationHtmlReply(reply, 4096);
        const decoded = yield* decodeCitationHtmlReply(frame.slice(0, -1));
        expect(decoded).toMatchObject({ _tag: "Failure", failure: { _tag: failure._tag } });
      }
    })
  );
  it.effect(
    "charges exact JSON bytes and round-trips every frozen input string",
    () =>
      Effect.gen(function* () {
        const raw = yield* (yield* FileSystem.FileSystem).readFileString(
          fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/html-input.json", import.meta.url))
        );
        const corpus = yield* S.decodeEffect(CorpusJson)(raw);
        expect(corpus.artifacts).toHaveLength(1071);
        for (const row of corpus.artifacts) {
          const reply = CitationHtmlWorkerSuccess.make({ text: row.value });
          const bytes = yield* encodeCitationHtmlReply(reply, 32_000_000);
          const restored = yield* decodeCitationHtmlReply(bytes.slice(0, -1));
          expect(restored._tag).toBe("Success");
          if (restored._tag === "Success") expect(restored.text).toBe(row.value);
          const exact = yield* encodeCitationHtmlReply(reply, bytes.byteLength);
          expect(exact).toEqual(bytes);
          const failed = yield* Effect.flip(encodeCitationHtmlReply(reply, bytes.byteLength - 1));
          expect(failed._tag).toBe("CitationSafetyLimitExceeded");
          const body = yield* S.encodeEffect(StringJson)(row.value);
          const bodyBytes = utf8.encode(body).byteLength - 2;
          expect(yield* citationHtmlJsonBodyBytes(row.value, bodyBytes)).toBe(bodyBytes);
        }
      }),
    { timeout: 30_000 }
  );
  it.effect("charges base64 plus envelope before encoding and preserves all byte residues", () =>
    Effect.gen(function* () {
      for (let length = 0; length < 80; length++) {
        const bytes = Uint8Array.from(A.makeBy(length || 1, (i) => i)).slice(0, length);
        const job = CitationHtmlWorkerJob.make({ encoding: "UTF-8", bytes, fullHtml: false, outputUtf16: 99 });
        const frame = yield* encodeCitationHtmlJob(job, 1024);
        expect(yield* encodeCitationHtmlJob(job, frame.byteLength)).toEqual(frame);
        expect((yield* Effect.flip(encodeCitationHtmlJob(job, frame.byteLength - 1)))._tag).toBe(
          "CitationSafetyLimitExceeded"
        );
        const restored = yield* decodeCitationHtmlJob(frame.slice(0, -1));
        expect(restored.bytes).toEqual(bytes);
        expect(restored.outputUtf16).toBe(99);
      }
      expect((yield* Effect.flip(preflightCitationHtmlControlFrames(1)))._tag).toBe("CitationSafetyLimitExceeded");
      yield* preflightCitationHtmlControlFrames(1024);
    })
  );
  it.effect("handles every split and single-byte fragments without retaining incomplete frames", () =>
    Effect.gen(function* () {
      const messages = [
        CitationHtmlWorkerReady.make({}),
        CitationHtmlWorkerStarted.make({}),
        CitationHtmlWorkerSuccess.make({ text: 'A\n😀\ud800"\\B' }),
      ];
      const frames = yield* Effect.forEach(messages, (m) => encodeCitationHtmlReply(m, 4096), { concurrency: 1 });
      const joined = new Uint8Array(A.reduce(frames, 0, (size, frame) => size + frame.byteLength));
      let offset = 0;
      for (const frame of frames) {
        joined.set(frame, offset);
        offset += frame.byteLength;
      }
      const collect = Effect.fn("ProtocolTest.collect")(function* (chunks: ReadonlyArray<Uint8Array>) {
        let replies: ReadonlyArray<CitationHtmlWorkerReply> = [];
        yield* readCitationHtmlFrames(Stream.fromIterable(chunks), 4096, 3, (frame) =>
          Effect.gen(function* () {
            replies = A.append(replies, yield* decodeCitationHtmlReply(frame));
          })
        );
        return replies;
      });
      for (let index = 0; index <= joined.byteLength; index++)
        expect(yield* collect([joined.slice(0, index), joined.slice(index)])).toEqual(messages);
      expect(yield* collect(A.map(A.fromIterable(joined), (byte) => new Uint8Array([byte])))).toEqual(messages);
      expect((yield* Effect.flip(collect([joined.slice(0, -1)])))._tag).toBe("CitationHtmlWorkerFailure");
      expect((yield* Effect.flip(collect([joined, utf8.encode("extra")])))._tag).toBe("CitationHtmlWorkerFailure");
      const big = new Uint8Array(10_000).fill(65);
      expect((yield* Effect.flip(readCitationHtmlFrames(Stream.make(big), 99, 1, () => Effect.void)))._tag).toBe(
        "CitationSafetyLimitExceeded"
      );
    })
  );
  it.effect("rejects excess fields, arrays, nesting and malformed UTF-8 without source-bearing errors", () =>
    Effect.gen(function* () {
      const valid = yield* encodeCitationHtmlReply(CitationHtmlWorkerSuccess.make({ text: "private source" }), 1024);
      const malformed = [
        utf8.encode(Str.repeat(20_000)("[") + Str.repeat(20_000)("]")),
        utf8.encode('{"_tag":"Ready","version":"citation-html-worker/v1","extra":"private source"}'),
        utf8.encode('{"_tag":"Failure","version":"citation-html-worker/v1","failure":{"a":{"b":0}}}'),
        utf8.encode('{"_tag":"Ready","version":"citation-html-worker/v1","a":0,"b":0,"c":0,"d":0,"e":0}'),
        new Uint8Array([255]),
        valid.slice(0, -2),
      ];
      for (const bytes of malformed) {
        const failed = yield* Effect.flip(decodeCitationHtmlReply(bytes));
        expect(failed._tag).toBe("CitationHtmlWorkerFailure");
        expect(failed.reason).toBe("invalid-frame");
      }
      const failure = CitationHtmlWorkerError.make({
        failure: CitationSafetyLimitExceeded.make({ operation: "clean", limit: "nativeHtmlParserResource" }),
      });
      const restored = yield* decodeCitationHtmlReply((yield* encodeCitationHtmlReply(failure, 4096)).slice(0, -1));
      expect(restored._tag).toBe("Failure");
    })
  );
});
