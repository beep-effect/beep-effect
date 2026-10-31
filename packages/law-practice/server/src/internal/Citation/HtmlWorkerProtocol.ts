/**
 * Closed HTML worker messages and bounded byte framing. No callbacks cross the
 * protocol; all byte counts include the terminal LF. Variable payloads are
 * charged before base64/JSON encoding or byte-buffer collection.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { CitationHtmlCompletionFailure } from "./HtmlCompletion.ts";
import { CitationHtmlInput, CitationHtmlInputLayout } from "./HtmlInput.ts";
import { CitationHtmlKernelFailure } from "./HtmlKernel.ts";
import type * as PlatformError from "effect/PlatformError";

const $I = $LawPracticeServerId.create("internal/Citation/HtmlWorkerProtocol");
const Reason = LiteralKit([
  "invalid-runtime",
  "invalid-frame",
  "channel-failed",
  "spawn-failed",
  "cleanup-unconfirmed",
  "quarantined",
  "closed",
]).pipe(
  $I.annoteSchema("Reason", {
    description: "Closed HTML process/transport/ownership failures without source-bearing causes.",
  })
);
/**
 * Private process-boundary failure; full engine translation remains separate.
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class CitationHtmlWorkerFailure extends S.TaggedError<
  CitationHtmlWorkerFailure,
  { readonly brand: unique symbol }
>($I`CitationHtmlWorkerFailure`)(
  "CitationHtmlWorkerFailure",
  { reason: Reason },
  $I.annoteError<CitationHtmlWorkerFailure>("CitationHtmlWorkerFailure", {
    description: "Closed HTML worker boundary failure; no source, frame content, command or native cause is retained.",
  })
) {}
const invalid = () => CitationHtmlWorkerFailure.make({ reason: "invalid-frame" });
const exceeded = () => CitationSafetyLimitExceeded.make({ operation: "clean", limit: "processMessageBytes" });
const inputMax = 4 * CitationEngineAbsoluteMaxima.producedTextUtf16;
const base64Max = 4 * ((inputMax + 2 - ((inputMax + 2) % 3)) / 3);
const Bytes = S.String.check(
  S.isMaxLength(base64Max),
  S.makeFilter(
    (value) => {
      const size = Str.length(value);
      const padding = Str.endsWith("==")(value) ? 2 : Str.endsWith("=")(value) ? 1 : 0;
      return size % 4 === 0 && (size / 4) * 3 - padding <= inputMax;
    },
    $I.annote("EncodedInputByteBound", {
      title: "Encoded input byte bound",
      description:
        "Require padded base64 with a decoded byte count within the native input ceiling before decoding allocation.",
    })
  )
)
  .pipe(S.decodeTo(S.Uint8ArrayFromBase64))
  .check(S.isMaxLength(inputMax))
  .pipe(
    $I.annoteSchema("Bytes", {
      description: "Bound the encoded payload before base64 decoding, then enforce the exact native byte ceiling.",
    })
  );
/**
 * One immutable-data native invocation; the process itself supplies correlation.
 * @internal
 * @category models
 * @since 0.0.0
 */
export class CitationHtmlWorkerJob extends S.Opaque<CitationHtmlWorkerJob, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Clean", {
    version: S.tag("citation-html-worker/v1"),
    encoding: CitationHtmlInput.fields.encoding,
    bytes: Bytes,
    fullHtml: S.Boolean,
    outputUtf16: S.Natural.check(S.isLessThanOrEqualTo(CitationEngineAbsoluteMaxima.producedTextUtf16)),
  }).pipe(
    $I.annoteSchema("CitationHtmlWorkerJob", {
      description: "Single-call process request, carrying no functions, source maps or caller identities.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationHtmlWorkerReady extends S.Opaque<CitationHtmlWorkerReady, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Ready", { version: S.tag("citation-html-worker/v1") }).pipe(
    $I.annoteSchema("CitationHtmlWorkerReady", { description: "Authenticated kernel startup completed." })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationHtmlWorkerStarted extends S.Opaque<CitationHtmlWorkerStarted, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Started", { version: S.tag("citation-html-worker/v1") }).pipe(
    $I.annoteSchema("CitationHtmlWorkerStarted", {
      description: "A complete closed request was decoded before native evaluation.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationHtmlWorkerSuccess extends S.Opaque<CitationHtmlWorkerSuccess, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Success", {
    version: S.tag("citation-html-worker/v1"),
    text: S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.producedTextUtf16)),
  }).pipe(
    $I.annoteSchema("CitationHtmlWorkerSuccess", {
      description: "Complete cleaned text; not published until process cleanup is acknowledged.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationHtmlWorkerError extends S.Opaque<CitationHtmlWorkerError, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Failure", {
    version: S.tag("citation-html-worker/v1"),
    failure: S.Union([CitationHtmlKernelFailure, CitationHtmlCompletionFailure, CitationSafetyLimitExceeded]).pipe(
      S.toTaggedUnion("_tag")
    ),
  }).pipe(
    $I.annoteSchema("CitationHtmlWorkerError", {
      description: "Only closed redacted native/completion/resource failures cross the child boundary.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export const CitationHtmlWorkerReply = S.Union([
  CitationHtmlWorkerReady,
  CitationHtmlWorkerStarted,
  CitationHtmlWorkerSuccess,
  CitationHtmlWorkerError,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("CitationHtmlWorkerReply", {
    description: "The only three-step worker conversation: Ready, Started, then Success or Failure.",
  })
);
/** @internal @category models @since 0.0.0 */
export type CitationHtmlWorkerReply = typeof CitationHtmlWorkerReply.Type;
const JobCodec = S.fromJsonString(CitationHtmlWorkerJob);
const ReplyCodec = S.fromJsonString(CitationHtmlWorkerReply);
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const Limit = S.Int.check(
  S.isGreaterThanOrEqualTo(1),
  S.isLessThanOrEqualTo(CitationEngineAbsoluteMaxima.processMessageBytes)
).pipe(
  $I.annoteSchema("Limit", { description: "Effective complete-frame byte ceiling, never above the frozen maximum." })
);
const line = (text: string) => encoder.encode(`${text}\n`);
const encodeReply = Effect.fn("Citation.encodeHtmlReplyJson")((reply: CitationHtmlWorkerReply) =>
  S.encodeEffect(ReplyCodec)(reply).pipe(Effect.mapError(invalid))
);
/**
 * Exact JSON string-body byte charge, including isolated-surrogate escaping.
 * A bounded metadata header is encoded separately before variable allocation.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const citationHtmlJsonBodyBytes = Effect.fn("Citation.htmlJsonBodyBytes")(function* (
  text: string,
  available: number
) {
  let bytes = 0;
  let nextYield = 0;
  for (let index = 0; index < Str.length(text); ) {
    if (index >= nextYield) {
      yield* Effect.yieldNow;
      nextYield = index + 4096;
    }
    const point = O.getOrElse(Str.codePointAt(text, index), () => 0);
    const size =
      point === 34 || point === 92 || point === 8 || point === 9 || point === 10 || point === 12 || point === 13
        ? 2
        : point < 32 || (point >= 0xd800 && point <= 0xdfff)
          ? 6
          : point < 128
            ? 1
            : point < 0x800
              ? 2
              : point <= 0xffff
                ? 3
                : 4;
    if (size > available - bytes) return yield* exceeded();
    bytes += size;
    index += point > 0xffff ? 2 : 1;
  }
  return bytes;
});
/**
 * Check the exact complete job size using metadata before input buffer or base64
 * allocation. The small encoded header uses the same codec as the final frame.
 * @internal @category operations @since 0.0.0
 */
export const preflightCitationHtmlJob = Effect.fn("Citation.preflightHtmlJob")(function* (
  layout: CitationHtmlInputLayout,
  outputUtf16: number,
  maximum: number
) {
  const limit = yield* S.decodeEffect(Limit)(maximum).pipe(Effect.mapError(invalid));
  const header = yield* S.encodeEffect(JobCodec)(
    CitationHtmlWorkerJob.make({
      encoding: layout.encoding,
      fullHtml: layout.fullHtml,
      outputUtf16,
      bytes: new Uint8Array(0),
    })
  ).pipe(Effect.mapError(invalid));
  const count =
    encoder.encode(header).byteLength + 1 + 4 * ((layout.byteLength + 2 - ((layout.byteLength + 2) % 3)) / 3);
  if (count > limit) return yield* exceeded();
  return count;
});
/** @internal @category operations @since 0.0.0 */
export const encodeCitationHtmlJob = Effect.fn("Citation.encodeHtmlJob")(function* (
  job: CitationHtmlWorkerJob,
  maximum: number
) {
  const count = yield* preflightCitationHtmlJob(
    CitationHtmlInputLayout.make({ encoding: job.encoding, fullHtml: job.fullHtml, byteLength: job.bytes.byteLength }),
    job.outputUtf16,
    maximum
  );
  const encoded = line(yield* S.encodeEffect(JobCodec)(job).pipe(Effect.mapError(invalid)));
  if (encoded.byteLength !== count) return yield* invalid();
  return encoded;
});
/** @internal @category operations @since 0.0.0 */
export const encodeCitationHtmlReply = Effect.fn("Citation.encodeHtmlReply")(function* (
  reply: CitationHtmlWorkerReply,
  maximum: number
) {
  const limit = yield* S.decodeEffect(Limit)(maximum).pipe(Effect.mapError(invalid));
  const header = yield* encodeReply(
    CitationHtmlWorkerReply.guards.Success(reply) ? CitationHtmlWorkerSuccess.make({ text: "" }) : reply
  );
  const fixed = encoder.encode(header).byteLength + 1;
  if (fixed > limit) return yield* exceeded();
  const extra = CitationHtmlWorkerReply.guards.Success(reply)
    ? yield* citationHtmlJsonBodyBytes(reply.text, limit - fixed)
    : 0;
  const encoded = line(yield* encodeReply(reply));
  if (encoded.byteLength !== fixed + extra || encoded.byteLength > limit) return yield* invalid();
  return encoded;
});
/**
 * Reject a policy unable to transport the bounded startup and failure records.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const preflightCitationHtmlControlFrames = Effect.fn("Citation.preflightHtmlControlFrames")(function* (
  maximum: number
) {
  yield* encodeCitationHtmlReply(CitationHtmlWorkerReady.make({}), maximum);
  yield* encodeCitationHtmlReply(CitationHtmlWorkerStarted.make({}), maximum);
  yield* encodeCitationHtmlReply(
    CitationHtmlWorkerError.make({
      failure: CitationSafetyLimitExceeded.make({ operation: "clean", limit: "nativeHtmlParserResource" }),
    }),
    maximum
  );
});
/** @internal @category operations @since 0.0.0 */
const preflightJson = Effect.fn("Citation.preflightHtmlJson")(function* (bytes: Uint8Array) {
  let quoted = false;
  let escaped = false;
  let depth = 0;
  let properties = 0;
  const propertyCeiling = R.keys(CitationHtmlWorkerJob.fields).length;
  for (let index = 0; index < bytes.byteLength; index++) {
    if (index % 4096 === 0) yield* Effect.yieldNow;
    const byte = bytes[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (byte === 92) escaped = true;
      else if (byte === 34) quoted = false;
    } else if (byte === 34) quoted = true;
    else if (byte === 91 || byte === 93) return yield* invalid();
    else if (byte === 123) {
      depth++;
      if (depth > 2) return yield* invalid();
    } else if (byte === 125) {
      depth--;
      if (depth < 0) return yield* invalid();
    } else if (byte === 58) {
      properties++;
      if (properties > propertyCeiling) return yield* invalid();
    }
  }
  if (quoted || escaped || depth !== 0) return yield* invalid();
});
/** @internal @category operations @since 0.0.0 */
export const decodeCitationHtmlJob = Effect.fn("Citation.decodeHtmlJob")(function* (bytes: Uint8Array) {
  yield* preflightJson(bytes);
  const text = yield* Effect.try({ try: () => decoder.decode(bytes), catch: invalid });
  return yield* S.decodeEffect(JobCodec, { onExcessProperty: "error" })(text).pipe(Effect.mapError(invalid));
});
/** @internal @category operations @since 0.0.0 */
export const decodeCitationHtmlReply = Effect.fn("Citation.decodeHtmlReply")(function* (bytes: Uint8Array) {
  yield* preflightJson(bytes);
  const text = yield* Effect.try({ try: () => decoder.decode(bytes), catch: invalid });
  return yield* S.decodeEffect(ReplyCodec, { onExcessProperty: "error" })(text).pipe(Effect.mapError(invalid));
});
/**
 * Consume only complete, bounded LF frames. Reject extra, missing or partial
 * frames. Byte ceilings are checked before growing the amortized byte buffer;
 * fragmented one-byte input cannot create an unbounded list of small objects.
 * The callback is injected server code; it is never part of a wire request.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const readCitationHtmlFrames = Effect.fn("Citation.readHtmlFrames")(function* (
  source: Stream.Stream<Uint8Array, PlatformError.PlatformError>,
  maximum: number,
  expected: 1 | 3,
  onFrame: (bytes: Uint8Array) => Effect.Effect<void, CitationHtmlWorkerFailure | CitationSafetyLimitExceeded>
) {
  const limit = yield* S.decodeEffect(Limit)(maximum).pipe(Effect.mapError(invalid));
  let buffer = new Uint8Array(0);
  let used = 0;
  let frames = 0;
  yield* Stream.runForEach(
    source.pipe(Stream.mapError(() => CitationHtmlWorkerFailure.make({ reason: "channel-failed" }))),
    (chunk) =>
      Effect.gen(function* () {
        for (let index = 0; index < chunk.byteLength; index++) {
          if (index % 4096 === 0) yield* Effect.yieldNow;
          if (frames >= expected) return yield* invalid();
          if (chunk[index] !== 10) {
            if (used + 1 >= limit) return yield* exceeded();
            if (used === buffer.byteLength) {
              const next = new Uint8Array(Num.min(limit - 1, Num.max(1, buffer.byteLength * 2)));
              next.set(buffer);
              buffer = next;
            }
            buffer[used] = chunk[index] ?? 0;
            used++;
            continue;
          }
          const complete = buffer.slice(0, used);
          yield* onFrame(complete);
          frames++;
          used = 0;
          buffer = new Uint8Array(0);
        }
      })
  );
  if (frames !== expected || used !== 0) return yield* invalid();
});
