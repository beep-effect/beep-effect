/** XML query codecs over the shared bounded native conversation.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationEngineAbsoluteMaxima,
  CitationPythonUnicodeStorage,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { makeCitationNativeFrameReader } from "./ByteFrames.ts";
import { citationNativeBase64Length, citationNativeBytes, makeCitationNativeJsonDecoder } from "./NativeJson.ts";
import { CitationNativeProcessFailureReason } from "./NativeProcess.ts";
import { CitationXmlKernelFailure } from "./XmlBalanceKernel.ts";

const $I = $LawPracticeServerId.create("internal/Citation/XmlWorkerProtocol");
/** @internal @category errors @since 0.0.0 */
export class CitationXmlWorkerFailure extends S.TaggedError<
  CitationXmlWorkerFailure,
  { readonly brand: unique symbol }
>($I`CitationXmlWorkerFailure`)(
  "CitationXmlWorkerFailure",
  { reason: CitationNativeProcessFailureReason },
  $I.annoteError<CitationXmlWorkerFailure>("CitationXmlWorkerFailure", {
    description: "Closed XML process/transport failure without source or frame details.",
  })
) {}
const invalid = () => CitationXmlWorkerFailure.make({ reason: "invalid-frame" });
const exceeded = () => CitationSafetyLimitExceeded.make({ operation: "annotate", limit: "processMessageBytes" });
/** @internal @category models @since 0.0.0 */
export class CitationXmlWorkerJob extends S.Opaque<CitationXmlWorkerJob, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Balance", {
    version: S.tag("citation-xml-worker/v1"),
    width: CitationPythonUnicodeStorage.fields.width,
    bytes: citationNativeBytes("XmlBytes", 4 * CitationEngineAbsoluteMaxima.sourceUtf16),
  }).pipe(
    $I.annoteSchema("CitationXmlWorkerJob", {
      description: "One owned native string query with no executable request data.",
    })
  )
) {}
const Version = { version: S.tag("citation-xml-worker/v1") };
/** @internal @category models @since 0.0.0 */
export const CitationXmlWorkerReply = S.TaggedUnion({
  Ready: Version,
  Started: Version,
  Success: { ...Version, balanced: S.Boolean },
  Failure: { ...Version, failure: S.Union([CitationXmlKernelFailure, CitationSafetyLimitExceeded]) },
}).pipe(
  $I.annoteSchema("CitationXmlWorkerReply", {
    description: "Exactly Ready, Started and one complete boolean/refusal before EOF.",
  })
);
/** @internal @category models @since 0.0.0 */
export type CitationXmlWorkerReply = typeof CitationXmlWorkerReply.Type;
const JobJson = S.fromJsonString(CitationXmlWorkerJob);
const ReplyJson = S.fromJsonString(CitationXmlWorkerReply);
const Limit = S.Int.check(S.isBetween({ minimum: 1, maximum: CitationEngineAbsoluteMaxima.processMessageBytes }));
const encoder = new TextEncoder();
/** Preflight before native copy, base64 or frame allocation.
 * @internal @category operations @since 0.0.0
 */
export const preflightCitationXmlJob = Effect.fn("Citation.preflightXmlJob")(function* (
  width: CitationPythonUnicodeStorage["width"],
  byteLength: number,
  maximum: number
) {
  const limit = yield* S.decodeEffect(Limit)(maximum).pipe(Effect.mapError(invalid));
  const header = yield* S.encodeEffect(JobJson)(CitationXmlWorkerJob.make({ width, bytes: new Uint8Array() })).pipe(
    Effect.mapError(invalid)
  );
  const count = encoder.encode(header).byteLength + 1 + citationNativeBase64Length(byteLength);
  if (count > limit) return yield* exceeded();
  return count;
});
/** @internal @category operations @since 0.0.0 */
export const encodeCitationXmlJob = Effect.fn("Citation.encodeXmlJob")(function* (
  job: CitationXmlWorkerJob,
  maximum: number
) {
  const count = yield* preflightCitationXmlJob(job.width, job.bytes.byteLength, maximum);
  const text = yield* S.encodeEffect(JobJson)(job).pipe(Effect.mapError(invalid));
  const bytes = encoder.encode(`${text}\n`);
  if (bytes.byteLength !== count) return yield* invalid();
  return bytes;
});
/** All replies have fixed bounded metadata; there is no variable source output.
 * @internal @category operations @since 0.0.0
 */
export const encodeCitationXmlReply = Effect.fn("Citation.encodeXmlReply")(function* (
  reply: CitationXmlWorkerReply,
  maximum: number
) {
  const limit = yield* S.decodeEffect(Limit)(maximum).pipe(Effect.mapError(invalid));
  const text = yield* S.encodeEffect(ReplyJson)(reply).pipe(Effect.mapError(invalid));
  const bytes = encoder.encode(`${text}\n`);
  if (bytes.byteLength > limit) return yield* exceeded();
  return bytes;
});
/** @internal @category operations @since 0.0.0 */
export const decodeCitationXmlJob = makeCitationNativeJsonDecoder({
  codec: JobJson,
  propertyCeiling: R.keys(CitationXmlWorkerJob.fields).length,
  maximumDepth: 1,
  invalid,
});
/** @internal @category operations @since 0.0.0 */
export const decodeCitationXmlReply = makeCitationNativeJsonDecoder({
  codec: ReplyJson,
  propertyCeiling: R.keys(CitationXmlWorkerJob.fields).length + R.keys(CitationSafetyLimitExceeded.fields).length,
  maximumDepth: 2,
  invalid,
});
/** @internal @category operations @since 0.0.0 */
export const readCitationXmlFrames = makeCitationNativeFrameReader({
  invalid,
  exceeded,
  failed: () => CitationXmlWorkerFailure.make({ reason: "channel-failed" }),
});
