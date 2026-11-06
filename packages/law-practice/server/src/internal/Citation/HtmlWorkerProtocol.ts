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
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { makeCitationNativeFrameReader } from "./ByteFrames.ts";
import { CitationHtmlCompletionFailure } from "./HtmlCompletion.ts";
import { CitationHtmlInput, CitationHtmlInputLayout } from "./HtmlInput.ts";
import { CitationHtmlKernelFailure } from "./HtmlKernel.ts";
import { citationNativeBase64Length, citationNativeBytes, makeCitationNativeJsonDecoder } from "./NativeJson.ts";
import { CitationNativeProcessFailureReason } from "./NativeProcess.ts";
import { visitCitationTextPoints } from "./TextPoints.ts";

const $I = $LawPracticeServerId.create("internal/Citation/HtmlWorkerProtocol");
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
  { reason: CitationNativeProcessFailureReason },
  $I.annoteError<CitationHtmlWorkerFailure>("CitationHtmlWorkerFailure", {
    description: "Closed HTML worker boundary failure; no source, frame content, command or native cause is retained.",
  })
) {}
const invalid = () => CitationHtmlWorkerFailure.make({ reason: "invalid-frame" });
const exceeded = () => CitationSafetyLimitExceeded.make({ operation: "clean", limit: "processMessageBytes" });
const inputMax = 4 * CitationEngineAbsoluteMaxima.producedTextUtf16;
const Bytes = citationNativeBytes("Bytes", inputMax);
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
const shortJsonEscape = (point: number) =>
  point === 34 || point === 92 || point === 8 || point === 9 || point === 10 || point === 12 || point === 13;
const utf8PointBytes = (point: number) => (point < 128 ? 1 : point < 0x800 ? 2 : point <= 0xffff ? 3 : 4);
const jsonPointBytes = (point: number) => {
  if (shortJsonEscape(point)) return 2;
  if (point < 32 || (point >= 0xd800 && point <= 0xdfff)) return 6;
  return utf8PointBytes(point);
};
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
  const complete = yield* visitCitationTextPoints(text, (point) => {
    const size = jsonPointBytes(point);
    if (size > available - bytes) return false;
    bytes += size;
    return true;
  });
  if (!complete) return yield* exceeded();
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
  const count = encoder.encode(header).byteLength + 1 + citationNativeBase64Length(layout.byteLength);
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
  const citationResult1 = yield* S.encodeEffect(JobCodec)(job).pipe(Effect.mapError(invalid));
  const encoded = line(citationResult1);
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
  const citationResult2 = yield* encodeReply(reply);
  const encoded = line(citationResult2);
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
export const decodeCitationHtmlJob = makeCitationNativeJsonDecoder({
  codec: JobCodec,
  propertyCeiling: R.keys(CitationHtmlWorkerJob.fields).length,
  maximumDepth: 2,
  invalid,
});
/** @internal @category operations @since 0.0.0 */
export const decodeCitationHtmlReply = makeCitationNativeJsonDecoder({
  codec: ReplyCodec,
  propertyCeiling: R.keys(CitationHtmlWorkerJob.fields).length,
  maximumDepth: 2,
  invalid,
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
export const readCitationHtmlFrames = makeCitationNativeFrameReader({
  invalid,
  exceeded,
  failed: () => CitationHtmlWorkerFailure.make({ reason: "channel-failed" }),
});
