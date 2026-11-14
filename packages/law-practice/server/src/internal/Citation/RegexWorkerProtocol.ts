/** Closed native-pattern/source messages for owned regex workers.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationEngineAbsoluteMaxima,
  CitationPythonUnicodeStorage,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import { dual, identity } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { makeCitationNativeFrameReader } from "./ByteFrames.ts";
import { citationNativeBase64Length, citationNativeBytes, makeCitationNativeJsonDecoder } from "./NativeJson.ts";
import { CitationNativeProcessFailureReason } from "./NativeProcess.ts";
import { CitationRegexSourceFlags } from "./RegexEngine.ts";
import { CitationRegexInputLayout, citationUnaccountedText, makeCitationRegexInput } from "./RegexInput.ts";
import { makeCitationRegexTiming } from "./RegexPolicy.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationPreparedRegexInput } from "./RegexInput.ts";

const $I = $LawPracticeServerId.create("internal/Citation/RegexWorkerProtocol");
/** @internal @category errors @since 0.0.0 */
export class CitationRegexWorkerFailure extends S.TaggedError<
  CitationRegexWorkerFailure,
  { readonly brand: unique symbol }
>($I`CitationRegexWorkerFailure`)(
  "CitationRegexWorkerFailure",
  { reason: CitationNativeProcessFailureReason },
  $I.annoteError<CitationRegexWorkerFailure>("CitationRegexWorkerFailure", {
    description: "Native regex boundary failed without retaining a pattern, text, frame or process error.",
  })
) {}
const encoder = new TextEncoder();
const invalid = () => CitationRegexWorkerFailure.make({ reason: "invalid-frame" });
const exceeded = () => CitationSafetyLimitExceeded.make({ operation: "extract", limit: "processMessageBytes" });
const PatternBytes = citationNativeBytes("PatternBytes", 4 * CitationEngineAbsoluteMaxima.patternUtf16);
const SourceBytes = citationNativeBytes("SourceBytes", 4 * CitationEngineAbsoluteMaxima.producedTextUtf16);
const Flags = CitationRegexSourceFlags;
/** Source operation selection is closed data, independent of regex flags.
 * @internal @category models @since 0.0.0
 */
export const CitationRegexMatchMode = LiteralKit(["finditer", "search", "match"]).pipe(
  $I.annoteSchema("CitationRegexMatchMode", {
    description: "All non-overlapping matches, first search result, or an anchored prefix match.",
  })
);
const Matches = S.Natural.check(S.isLessThanOrEqualTo(CitationEngineAbsoluteMaxima.patternMatches)).pipe(
  $I.annoteSchema("Matches", {
    description: "Remaining raw-match capacity; zero permits a complete no-match result only.",
  })
);
const Limit = S.Int.check(S.isBetween({ minimum: 1, maximum: CitationEngineAbsoluteMaxima.processMessageBytes })).pipe(
  $I.annoteSchema("Limit", { description: "Complete encoded-frame ceiling, including the terminal LF." })
);
/** Native source and pattern carriers are both preserved. The receiving worker
 * must validate canonical words/width, effective limits and matching semantics
 * before execution. This data is not a reviewed-pattern execution capability.
 * @internal @category models @since 0.0.0
 */
export class CitationRegexWorkerJob extends S.Opaque<CitationRegexWorkerJob, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Evaluate", {
    version: S.tag("citation-regex-worker/v2"),
    patternWidth: CitationPythonUnicodeStorage.fields.width,
    patternBytes: PatternBytes,
    sourceWidth: CitationPythonUnicodeStorage.fields.width,
    sourceBytes: SourceBytes,
    flags: Flags,
    maxMatches: Matches,
    mode: CitationRegexMatchMode,
  }).pipe(
    $I.annoteSchema("CitationRegexWorkerJob", {
      description:
        "One closed data-only regex invocation; projected JavaScript strings cannot replace either native carrier.",
    })
  )
) {}
const JobJson = S.fromJsonString(CitationRegexWorkerJob);
const JobType = S.toType(CitationRegexWorkerJob);
const propertyCeiling = R.keys(CitationRegexWorkerJob.fields).length;
const Layout = S.toType(CitationRegexInputLayout);
const decodeMode = S.decodeUnknownEffect(CitationRegexMatchMode);
const decodeFlags = S.decodeUnknownEffect(Flags);
const decodeMatches = S.decodeUnknownEffect(Matches);
const decodeLimit = S.decodeEffect(Limit);
const decodeLayout = S.decodeEffect(Layout);
const decodeJob = S.decodeEffect(JobType);
const encodeJob = S.encodeEffect(JobJson);
/** @internal @category operations @since 0.0.0 */
export const decodeCitationRegexJobOptions = Effect.fnUntraced(function* (
  flagsInput: unknown,
  maxMatchesInput: unknown,
  modeInput: unknown = "finditer"
) {
  const mode = yield* decodeMode(modeInput);
  const flags = yield* decodeFlags(flagsInput);
  const maxMatches = yield* decodeMatches(maxMatchesInput);
  return { mode, flags, maxMatches };
}, Effect.mapError(invalid));
/** @internal @category operations @since 0.0.0 */
export const decodeCitationRegexFrameInputs = Effect.fnUntraced(function* (
  patternInput: CitationRegexInputLayout,
  sourceInput: CitationRegexInputLayout,
  flagsInput: unknown,
  maxMatchesInput: unknown,
  maximum: number,
  modeInput: unknown
) {
  const options = yield* decodeCitationRegexJobOptions(flagsInput, maxMatchesInput, modeInput);
  const pattern = yield* decodeLayout(patternInput).pipe(Effect.mapError(invalid));
  const source = yield* decodeLayout(sourceInput).pipe(Effect.mapError(invalid));
  if (pattern.utf16Units > CitationEngineAbsoluteMaxima.patternUtf16)
    return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "patternUtf16" });
  const limit = yield* decodeLimit(maximum).pipe(Effect.mapError(invalid));
  return { ...options, pattern, source, limit };
});
const emptyJobHeader = Effect.fnUntraced(function* (
  patternWidth: CitationRegexWorkerJob["patternWidth"],
  sourceWidth: CitationRegexWorkerJob["sourceWidth"],
  flags: CitationRegexWorkerJob["flags"],
  maxMatches: CitationRegexWorkerJob["maxMatches"],
  mode: CitationRegexWorkerJob["mode"]
) {
  return yield* encodeJob(
    CitationRegexWorkerJob.make({
      patternWidth,
      sourceWidth,
      flags,
      maxMatches,
      mode,
      patternBytes: new Uint8Array(0),
      sourceBytes: new Uint8Array(0),
    })
  ).pipe(Effect.mapError(invalid));
});
/** Check the exact encoded job while both preparers still have only layouts.
 * No pattern/source payload, base64 or whole-message allocation is required.
 * @internal @category operations @since 0.0.0
 */
export const preflightCitationRegexJob = Effect.fn("Citation.preflightRegexJob")(function* (
  patternInput: CitationRegexInputLayout,
  sourceInput: CitationRegexInputLayout,
  flagsInput: unknown,
  maxMatchesInput: unknown,
  maximum: number,
  modeInput: unknown = "finditer"
) {
  const { mode, pattern, source, flags, maxMatches, limit } = yield* decodeCitationRegexFrameInputs(
    patternInput,
    sourceInput,
    flagsInput,
    maxMatchesInput,
    maximum,
    modeInput
  );
  const header = yield* emptyJobHeader(pattern.width, source.width, flags, maxMatches, mode);
  return yield* preflightCitationRegexFrameBytes(header, pattern.byteLength, source.byteLength, limit);
});
/** @internal @category services @since 0.0.0 */
export interface CitationRegexFrameCodec<Job> {
  readonly decode: (job: Job) => Effect.Effect<Job, CitationRegexWorkerFailure>;
  readonly encode: (job: Job) => Effect.Effect<string, CitationRegexWorkerFailure>;
  readonly header: (
    job: Job,
    maximum: number
  ) => Effect.Effect<string, CitationRegexWorkerFailure | CitationSafetyLimitExceeded>;
}
/** @internal @category constructors @since 0.0.0 */
export const makeCitationRegexJobEncoder = <
  Job extends { readonly patternBytes: Uint8Array; readonly sourceBytes: Uint8Array },
>(
  codec: CitationRegexFrameCodec<Job>
) =>
  Effect.fn("Citation.encodeRegexJob")(function* (input: Job, maximum: number) {
    const job = yield* codec.decode(input);
    const limit = yield* decodeLimit(maximum).pipe(Effect.mapError(invalid));
    const header = yield* codec.header(job, limit);
    return yield* encodeCitationRegexPayloadFrame(job, limit, header, codec.encode);
  });
/** Encode only after exact size preflight. The caller already owns immutable
 * prepared carriers; the receiver repeats native-layout and policy validation.
 * @internal @category operations @since 0.0.0
 */
export const encodeCitationRegexJob = makeCitationRegexJobEncoder({
  decode: (input: CitationRegexWorkerJob) => decodeJob(input).pipe(Effect.mapError(invalid)),
  header: (job) => emptyJobHeader(job.patternWidth, job.sourceWidth, job.flags, job.maxMatches, job.mode),
  encode: (job) => encodeJob(job).pipe(Effect.mapError(invalid)),
});
// The request is flat. Reject structural amplification before JSON.parse or
// base64 decoding; punctuation inside quoted strings is not structure.
/** Decode a complete bounded frame body. Structural and encoded-byte ceilings
 * precede variable decoding allocations; unknown properties are rejected.
 * @internal @category operations @since 0.0.0
 */
export const decodeCitationRegexJob = makeCitationNativeJsonDecoder({
  codec: JobJson,
  propertyCeiling: propertyCeiling,
  maximumDepth: 1,
  invalid,
});
/** @internal @category operations @since 0.0.0 */
export const readCitationRegexFrames = makeCitationNativeFrameReader({
  invalid,
  exceeded,
  failed: () => CitationRegexWorkerFailure.make({ reason: "channel-failed" }),
});

/** Measure two native payloads without allocating either base64 carrier.
 * @internal @category operations @since 0.0.0
 */
export const citationRegexFrameBytes: {
  (header: string, patternBytes: number, sourceBytes: number): number;
  (patternBytes: number, sourceBytes: number): (header: string) => number;
} = dual(
  3,
  (header: string, patternBytes: number, sourceBytes: number) =>
    encoder.encode(header).byteLength +
    1 +
    citationNativeBase64Length(patternBytes) +
    citationNativeBase64Length(sourceBytes)
);
/** Retain one exact encoded-byte guard for preflight and payload encoding.
 * @internal @category operations @since 0.0.0
 */
export const preflightCitationRegexFrameBytes = Effect.fn("Citation.preflightRegexFrameBytes")(function* (
  header: string,
  patternBytes: number,
  sourceBytes: number,
  maximum: number
) {
  const bytes = citationRegexFrameBytes(header, patternBytes, sourceBytes);
  if (bytes > maximum) return yield* exceeded();
  return bytes;
});
/** Encode a schema-owned job only after its exact header/payload size check.
 * @internal @category operations @since 0.0.0
 */
export const encodeCitationRegexPayloadFrame = Effect.fn("Citation.encodeRegexPayloadFrame")(function* <
  Job extends { readonly patternBytes: Uint8Array; readonly sourceBytes: Uint8Array },
>(job: Job, maximum: number, header: string, encode: (job: Job) => Effect.Effect<string, CitationRegexWorkerFailure>) {
  const count = yield* preflightCitationRegexFrameBytes(
    header,
    job.patternBytes.byteLength,
    job.sourceBytes.byteLength,
    maximum
  );
  const text = yield* encode(job);
  const frame = encoder.encode(`${text}\n`);
  if (frame.byteLength !== count) return yield* invalid();
  return frame;
});
/** Layouts and exact preflight precede source reservation and both payload copies.
 * The injected preflight is installation-owned code, never part of a wire job.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationRegexPayloadPreparation = Effect.fn("Citation.makeRegexPayloadPreparation")(function* <R>(
  limits: CitationEngineLimits,
  reserve: (units: number) => Effect.Effect<void, CitationSafetyLimitExceeded, R>
) {
  const badRuntime = () => CitationRegexWorkerFailure.make({ reason: "invalid-runtime" });
  const { timed } = yield* makeCitationRegexTiming(limits, true);
  const patternInput = yield* makeCitationRegexInput(limits, citationUnaccountedText, "pattern").pipe(
    Effect.mapError(badRuntime)
  );
  const sourceInput = yield* makeCitationRegexInput(limits, reserve).pipe(Effect.mapError(badRuntime));
  const prepare = Effect.fn("Citation.prepareRegexPayloads")(function* (
    pattern: unknown,
    source: unknown,
    preflight: (
      pattern: CitationRegexInputLayout,
      source: CitationRegexInputLayout
    ) => Effect.Effect<number, CitationRegexWorkerFailure | CitationSafetyLimitExceeded>,
    beforeAllocate: (bytes: number) => Effect.Effect<void, CitationRegexWorkerFailure | CitationSafetyLimitExceeded>
  ) {
    let preparedSource = O.none<CitationPreparedRegexInput<R>>();
    let measuredBytes = O.none<number>();
    const preparedPattern = yield* patternInput
      .prepareUnicode(pattern, (patternLayout) =>
        sourceInput
          .prepareUnicode(
            source,
            (sourceLayout) =>
              preflight(patternLayout, sourceLayout).pipe(
                Effect.tap((bytes) =>
                  Effect.sync(() => {
                    measuredBytes = O.some(bytes);
                  })
                ),
                Effect.asVoid
              ),
            Effect.suspend(() =>
              Effect.fromOption(measuredBytes).pipe(Effect.mapError(invalid), Effect.flatMap(beforeAllocate))
            )
          )
          .pipe(
            Effect.tap((value) =>
              Effect.sync(() => {
                preparedSource = O.some(value);
              })
            ),
            Effect.asVoid
          )
      )
      .pipe(Effect.catchTag("CitationRegexInputFailure", () => Effect.fail(invalid())));
    const sourceValue = yield* Effect.fromOption(preparedSource).pipe(Effect.mapError(invalid));
    return { pattern: preparedPattern, source: sourceValue };
  }, timed);
  return { prepare, timed };
});

/** Join native pattern/source preparation with exact full-frame preflight.
 * Both layouts exist before either payload/map is allocated. The captured
 * server hook can reserve shared process/work capacity at that boundary.
 * No callable is included in the resulting job. Methods retain their explicit
 * reservation requirements.
 * @internal @category operations @since 0.0.0
 */
/** @internal @category services @since 0.0.0 */
export interface CitationRegexPreparationCodec<Job> {
  readonly encode: (
    job: Job,
    maximum: number
  ) => Effect.Effect<Uint8Array, CitationRegexWorkerFailure | CitationSafetyLimitExceeded>;
  readonly make: (payload: CitationRegexWorkerJob) => Job;
  readonly preflight: typeof preflightCitationRegexJob;
}
export const makeCitationRegexJobPreparationWith = Effect.fn("Citation.makeRegexJobPreparation")(function* <R>(
  limits: CitationEngineLimits,
  reserveCitationInvocationText: (units: number) => Effect.Effect<void, CitationSafetyLimitExceeded, R>
) {
  const payload = yield* makeCitationRegexPayloadPreparation(limits, reserveCitationInvocationText);
  const prepare = Effect.fn("Citation.prepareRegexJob")(function* <Job>(
    codec: CitationRegexPreparationCodec<Job>,
    pattern: unknown,
    source: unknown,
    flagsInput: unknown,
    maxMatchesInput: unknown,
    beforeAllocate: (
      completeBytes: number
    ) => Effect.Effect<void, CitationRegexWorkerFailure | CitationSafetyLimitExceeded>,
    modeInput: unknown = "finditer"
  ) {
    const { mode, flags, maxMatches } = yield* decodeCitationRegexJobOptions(flagsInput, maxMatchesInput, modeInput);
    const prepared = yield* payload.prepare(
      pattern,
      source,
      (patternLayout, sourceLayout) =>
        codec.preflight(patternLayout, sourceLayout, flags, maxMatches, limits.processMessageBytes, mode),
      beforeAllocate
    );
    const preparedPattern = prepared.pattern;
    const sourceValue = prepared.source;
    const job = codec.make(
      CitationRegexWorkerJob.make({
        patternWidth: preparedPattern.value.storage.width,
        patternBytes: preparedPattern.value.storage.bytes,
        sourceWidth: sourceValue.value.storage.width,
        sourceBytes: sourceValue.value.storage.bytes,
        flags,
        maxMatches,
        mode,
      })
    );
    const frame = yield* codec.encode(job, limits.processMessageBytes);
    return { job, frame, pattern: preparedPattern, source: sourceValue };
  }, payload.timed);
  return { prepare };
});

const v2Codec: CitationRegexPreparationCodec<CitationRegexWorkerJob> = {
  make: identity,
  encode: encodeCitationRegexJob,
  preflight: preflightCitationRegexJob,
};
/** @internal @category constructors @since 0.0.0 */
export const makeCitationRegexJobPreparation = Effect.fn("Citation.makeRegexJobPreparation")(function* <R>(
  limits: CitationEngineLimits,
  reserve: (units: number) => Effect.Effect<void, CitationSafetyLimitExceeded, R>
) {
  const preparation = yield* makeCitationRegexJobPreparationWith(limits, reserve);
  return {
    prepare: (
      ...args: Parameters<typeof preparation.prepare<CitationRegexWorkerJob>> extends [unknown, ...infer Args]
        ? Args
        : never
    ) => preparation.prepare(v2Codec, ...args),
  };
});
