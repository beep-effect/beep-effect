/** Closed default-diff worker codecs over the existing bounded LF transport.
 * Exact complete-frame preflight precedes variable base64/frame allocation.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { makeCitationNativeFrameReader } from "./ByteFrames.ts";
import { CitationDiffKernelFailure, CitationDiffKernelRequest } from "./DiffKernel.ts";
import { citationNativeBase64Length, citationNativeBytes, makeCitationNativeJsonDecoder } from "./NativeJson.ts";
import { CitationNativeProcessFailureReason } from "./NativeProcess.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { CitationPythonSliceLayout } from "./PythonUnicode.ts";

const $I = $LawPracticeServerId.create("internal/Citation/DiffWorkerProtocol");
const max = CitationEngineAbsoluteMaxima;
/** @internal @category errors @since 0.0.0 */
export class CitationDiffWorkerFailure extends S.TaggedError<
  CitationDiffWorkerFailure,
  { readonly brand: unique symbol }
>($I`CitationDiffWorkerFailure`)(
  "CitationDiffWorkerFailure",
  { reason: CitationNativeProcessFailureReason },
  $I.annoteError<CitationDiffWorkerFailure>("CitationDiffWorkerFailure", {
    description: "Closed diff transport failure without source, frame, command or native diagnostics.",
  })
) {}
const invalid = () => CitationDiffWorkerFailure.make({ reason: "invalid-frame" });
const exceeded = () => CitationSafetyLimitExceeded.make({ operation: "extract", limit: "processMessageBytes" });
const NativeBytes = citationNativeBytes("NativeBytes", 4 * max.diffInputUtf16);
const StepBytes = citationNativeBytes("StepBytes", 8 * max.diffSteps).check(
  S.makeFilter(
    (bytes) => bytes.byteLength % 8 === 0,
    $I.annote("PackedStepAlignment", {
      description: "Each complete little-endian operation/count pair occupies eight bytes.",
    })
  )
);
/** @internal @category models @since 0.0.0 */
export class CitationDiffWorkerJob extends S.Opaque<CitationDiffWorkerJob, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Diff", {
    version: S.tag("citation-diff-worker/v1"),
    beforeWidth: CitationPythonUnicodeStorage.fields.width,
    afterWidth: CitationPythonUnicodeStorage.fields.width,
    beforeBytes: NativeBytes,
    afterBytes: NativeBytes,
    maximumSteps: CitationDiffKernelRequest.fields.maximumSteps,
    maximumInputUtf16: CitationDiffKernelRequest.fields.maximumInputUtf16,
  }).pipe(
    $I.annoteSchema("CitationDiffWorkerJob", {
      description: "Single immutable native diff request with no callable or ownership authority.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationDiffWorkerReady extends S.Opaque<CitationDiffWorkerReady, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Ready", { version: S.tag("citation-diff-worker/v1") }).pipe(
    $I.annoteSchema("CitationDiffWorkerReady", {
      description: "Pinned kernel authentication and compilation completed.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationDiffWorkerStarted extends S.Opaque<CitationDiffWorkerStarted, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Started", { version: S.tag("citation-diff-worker/v1") }).pipe(
    $I.annoteSchema("CitationDiffWorkerStarted", { description: "One complete closed request was decoded." })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationDiffWorkerSuccess extends S.Opaque<CitationDiffWorkerSuccess, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Success", { version: S.tag("citation-diff-worker/v1"), steps: StepBytes }).pipe(
    $I.annoteSchema("CitationDiffWorkerSuccess", {
      description: "Complete packed edit steps, pending independent physical retirement.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationDiffWorkerError extends S.Opaque<CitationDiffWorkerError, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Failure", {
    version: S.tag("citation-diff-worker/v1"),
    failure: S.Union([CitationDiffKernelFailure, CitationSafetyLimitExceeded]).pipe(S.toTaggedUnion("_tag")),
  }).pipe(
    $I.annoteSchema("CitationDiffWorkerError", {
      description: "Only closed native/resource failures cross the child boundary.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export const CitationDiffWorkerReply = S.Union([
  CitationDiffWorkerReady,
  CitationDiffWorkerStarted,
  CitationDiffWorkerSuccess,
  CitationDiffWorkerError,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("CitationDiffWorkerReply", {
    description: "Exactly Ready, Started, then complete Success or Failure.",
  })
);
/** @internal @category models @since 0.0.0 */
export type CitationDiffWorkerReply = typeof CitationDiffWorkerReply.Type;
/** @internal @category models @since 0.0.0 */
export class CitationDiffJobLayout extends S.Opaque<CitationDiffJobLayout, { readonly brand: unique symbol }>()(
  S.Struct({
    before: CitationPythonSliceLayout,
    after: CitationPythonSliceLayout,
    maximumSteps: CitationDiffWorkerJob.fields.maximumSteps,
    maximumInputUtf16: CitationDiffWorkerJob.fields.maximumInputUtf16,
  }).pipe(
    $I.annoteSchema("CitationDiffJobLayout", {
      description: "Measured native layouts before receiving payload or wire allocation.",
    })
  )
) {}
const JobJson = S.fromJsonString(CitationDiffWorkerJob);
const ReplyJson = S.fromJsonString(CitationDiffWorkerReply);
const Limit = S.Int.check(S.isBetween({ minimum: 1, maximum: max.processMessageBytes }));
const encoder = new TextEncoder();
const line = (text: string) => encoder.encode(`${text}\n`);
const JobLayoutValue = S.toType(CitationDiffJobLayout).pipe(
  $I.annoteSchema("JobLayoutValue", { description: "Captured static boundary codec for bounded citation processing." })
);
/** Metadata-only exact job preflight. No native/base64/frame payload is allocated.
 * @internal @category operations @since 0.0.0
 */
export const preflightCitationDiffJob = Effect.fn("Citation.preflightDiffJob")(function* (
  raw: unknown,
  maximum: number
) {
  const layout = yield* S.decodeUnknownEffect(JobLayoutValue)(raw).pipe(Effect.mapError(invalid));
  const limit = yield* S.decodeEffect(Limit)(maximum).pipe(Effect.mapError(invalid));
  if (layout.before.utf16Units + layout.after.utf16Units > layout.maximumInputUtf16)
    return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "diffInputUtf16" });
  const header = yield* S.encodeEffect(JobJson)(
    CitationDiffWorkerJob.make({
      beforeWidth: layout.before.width,
      afterWidth: layout.after.width,
      beforeBytes: new Uint8Array(),
      afterBytes: new Uint8Array(),
      maximumSteps: layout.maximumSteps,
      maximumInputUtf16: layout.maximumInputUtf16,
    })
  ).pipe(Effect.mapError(invalid));
  const count =
    encoder.encode(header).byteLength +
    1 +
    citationNativeBase64Length(layout.before.byteLength) +
    citationNativeBase64Length(layout.after.byteLength);
  if (count > limit) return yield* exceeded();
  return count;
});
/** Maximum raw step bytes whose exact base64 success frame fits. The kernel
 * clamps vector emission to this bound before allocating a packed result.
 * @internal @category operations @since 0.0.0
 */
export const citationDiffOutputByteCapacity = Effect.fn("Citation.diffOutputByteCapacity")(function* (maximum: number) {
  const limit = yield* S.decodeEffect(Limit)(maximum).pipe(Effect.mapError(invalid));
  const header = yield* S.encodeEffect(ReplyJson)(CitationDiffWorkerSuccess.make({ steps: new Uint8Array() })).pipe(
    Effect.mapError(invalid)
  );
  const available = limit - encoder.encode(header).byteLength - 1;
  if (available < 0) return yield* exceeded();
  return Math.min(8 * max.diffSteps, 3 * Math.floor(available / 4));
});
/** @internal @category operations @since 0.0.0 */
export const encodeCitationDiffJob = Effect.fn("Citation.encodeDiffJob")(function* (
  job: CitationDiffWorkerJob,
  layout: CitationDiffJobLayout,
  maximum: number
) {
  const count = yield* preflightCitationDiffJob(layout, maximum);
  if (
    layout.before.byteLength !== job.beforeBytes.byteLength ||
    layout.after.byteLength !== job.afterBytes.byteLength ||
    layout.before.width !== job.beforeWidth ||
    layout.after.width !== job.afterWidth ||
    layout.maximumSteps !== job.maximumSteps ||
    layout.maximumInputUtf16 !== job.maximumInputUtf16
  )
    return yield* invalid();
  const text = yield* S.encodeEffect(JobJson)(job).pipe(Effect.mapError(invalid));
  const encoded = line(text);
  if (encoded.byteLength !== count) return yield* invalid();
  return encoded;
});
/** @internal @category operations @since 0.0.0 */
export const encodeCitationDiffReply = Effect.fn("Citation.encodeDiffReply")(function* (
  reply: CitationDiffWorkerReply,
  maximum: number
) {
  const limit = yield* S.decodeEffect(Limit)(maximum).pipe(Effect.mapError(invalid));
  if (CitationDiffWorkerReply.guards.Success(reply)) {
    const capacity = yield* citationDiffOutputByteCapacity(limit);
    if (reply.steps.byteLength > capacity) return yield* exceeded();
  }
  const text = yield* S.encodeEffect(ReplyJson)(reply).pipe(Effect.mapError(invalid));
  const encoded = line(text);
  if (encoded.byteLength > limit) return yield* exceeded();
  return encoded;
});
/** @internal @category operations @since 0.0.0 */
export const preflightCitationDiffControlFrames = Effect.fn("Citation.preflightDiffControlFrames")(function* (
  maximum: number
) {
  yield* encodeCitationDiffReply(CitationDiffWorkerReady.make({}), maximum);
  yield* encodeCitationDiffReply(CitationDiffWorkerStarted.make({}), maximum);
  yield* encodeCitationDiffReply(CitationDiffWorkerError.make({ failure: exceeded() }), maximum);
});
/** @internal @category operations @since 0.0.0 */
export const decodeCitationDiffJob = makeCitationNativeJsonDecoder({
  codec: JobJson,
  propertyCeiling: R.keys(CitationDiffWorkerJob.fields).length,
  maximumDepth: 1,
  invalid,
});
/** @internal @category operations @since 0.0.0 */
export const decodeCitationDiffReply = makeCitationNativeJsonDecoder({
  codec: ReplyJson,
  propertyCeiling: R.keys(CitationDiffWorkerJob.fields).length,
  maximumDepth: 2,
  invalid,
});
/** @internal @category operations @since 0.0.0 */
export const readCitationDiffFrames = makeCitationNativeFrameReader({
  invalid,
  exceeded,
  failed: () => CitationDiffWorkerFailure.make({ reason: "channel-failed" }),
});
