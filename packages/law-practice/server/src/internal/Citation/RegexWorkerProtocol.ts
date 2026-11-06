/** Closed native-pattern/source messages for owned regex workers.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { makeCitationNativeFrameReader } from "./ByteFrames.ts";
import { citationNativeBase64Length, citationNativeBytes, makeCitationNativeJsonDecoder } from "./NativeJson.ts";
import { CitationNativeProcessFailureReason } from "./NativeProcess.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { CitationRegexSourceFlags } from "./RegexEngine.ts";
import { CitationRegexInputLayout, makeCitationRegexInput } from "./RegexInput.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
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
const encoder = new TextEncoder();
const emptyJobHeader = Effect.fnUntraced(function* (
  patternWidth: CitationRegexWorkerJob["patternWidth"],
  sourceWidth: CitationRegexWorkerJob["sourceWidth"],
  flags: CitationRegexWorkerJob["flags"],
  maxMatches: CitationRegexWorkerJob["maxMatches"],
  mode: CitationRegexWorkerJob["mode"]
) {
  return yield* S.encodeEffect(JobJson)(
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
  const mode = yield* S.decodeUnknownEffect(CitationRegexMatchMode)(modeInput).pipe(Effect.mapError(invalid));
  const pattern = yield* S.decodeEffect(Layout)(patternInput).pipe(Effect.mapError(invalid));
  const source = yield* S.decodeEffect(Layout)(sourceInput).pipe(Effect.mapError(invalid));
  if (pattern.utf16Units > CitationEngineAbsoluteMaxima.patternUtf16)
    return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "patternUtf16" });
  const flags = yield* S.decodeUnknownEffect(Flags)(flagsInput).pipe(Effect.mapError(invalid));
  const maxMatches = yield* S.decodeUnknownEffect(Matches)(maxMatchesInput).pipe(Effect.mapError(invalid));
  const limit = yield* S.decodeEffect(Limit)(maximum).pipe(Effect.mapError(invalid));
  const header = yield* emptyJobHeader(pattern.width, source.width, flags, maxMatches, mode);
  const bytes =
    encoder.encode(header).byteLength +
    1 +
    citationNativeBase64Length(pattern.byteLength) +
    citationNativeBase64Length(source.byteLength);
  if (bytes > limit) return yield* exceeded();
  return bytes;
});
/** Encode only after exact size preflight. The caller already owns immutable
 * prepared carriers; the receiver repeats native-layout and policy validation.
 * @internal @category operations @since 0.0.0
 */
export const encodeCitationRegexJob = Effect.fn("Citation.encodeRegexJob")(function* (
  input: CitationRegexWorkerJob,
  maximum: number
) {
  const job = yield* S.decodeEffect(JobType)(input).pipe(Effect.mapError(invalid));
  const limit = yield* S.decodeEffect(Limit)(maximum).pipe(Effect.mapError(invalid));
  const header = yield* emptyJobHeader(job.patternWidth, job.sourceWidth, job.flags, job.maxMatches, job.mode);
  const count =
    encoder.encode(header).byteLength +
    1 +
    citationNativeBase64Length(job.patternBytes.byteLength) +
    citationNativeBase64Length(job.sourceBytes.byteLength);
  if (count > limit) return yield* exceeded();
  const text = yield* S.encodeEffect(JobJson)(job).pipe(Effect.mapError(invalid));
  const frame = encoder.encode(`${text}\n`);
  if (frame.byteLength !== count) return yield* invalid();
  return frame;
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

/** Join native pattern/source preparation with exact full-frame preflight.
 * Both layouts exist before either payload/map is allocated. The captured
 * server hook can reserve shared process/work capacity at that boundary.
 * No callable is included in the resulting job. Methods have R = never.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationRegexJobPreparation = Effect.fn("Citation.makeRegexJobPreparation")(function* (
  policy: unknown
) {
  const limits = yield* decodeCitationRegexPolicy(policy, () =>
    CitationRegexWorkerFailure.make({ reason: "invalid-runtime" })
  );
  const { timed } = yield* makeCitationRegexTiming(limits, true);
  const badRuntime = () => CitationRegexWorkerFailure.make({ reason: "invalid-runtime" });
  const patternInput = yield* makeCitationRegexInput(limits, "pattern").pipe(Effect.mapError(badRuntime));
  const sourceInput = yield* makeCitationRegexInput(limits).pipe(Effect.mapError(badRuntime));
  const prepare = Effect.fn("Citation.prepareRegexJob")(function* (
    pattern: unknown,
    source: unknown,
    flagsInput: unknown,
    maxMatchesInput: unknown,
    beforeAllocate: (
      completeBytes: number
    ) => Effect.Effect<void, CitationRegexWorkerFailure | CitationSafetyLimitExceeded>,
    modeInput: unknown = "finditer"
  ) {
    const mode = yield* S.decodeUnknownEffect(CitationRegexMatchMode)(modeInput).pipe(Effect.mapError(invalid));
    const flags = yield* S.decodeUnknownEffect(Flags)(flagsInput).pipe(Effect.mapError(invalid));
    const maxMatches = yield* S.decodeUnknownEffect(Matches)(maxMatchesInput).pipe(Effect.mapError(invalid));
    let preparedSource = O.none<CitationPreparedRegexInput>();
    let measuredBytes = O.none<number>();
    const preparedPattern = yield* patternInput
      .prepareUnicode(pattern, (patternLayout) =>
        sourceInput
          .prepareUnicode(
            source,
            (sourceLayout) =>
              preflightCitationRegexJob(
                patternLayout,
                sourceLayout,
                flags,
                maxMatches,
                limits.processMessageBytes,
                mode
              ).pipe(
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
    const job = CitationRegexWorkerJob.make({
      patternWidth: preparedPattern.value.storage.width,
      patternBytes: preparedPattern.value.storage.bytes,
      sourceWidth: sourceValue.value.storage.width,
      sourceBytes: sourceValue.value.storage.bytes,
      flags,
      maxMatches,
      mode,
    });
    const frame = yield* encodeCitationRegexJob(job, limits.processMessageBytes);
    return { job, frame, pattern: preparedPattern, source: sourceValue };
  }, timed);
  return { prepare };
});
