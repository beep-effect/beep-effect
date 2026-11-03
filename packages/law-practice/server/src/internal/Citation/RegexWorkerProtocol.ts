/** Closed native-pattern/source messages for owned regex workers.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { readCitationByteFrames } from "./ByteFrames.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { CitationRegexInputLayout, makeCitationRegexInput } from "./RegexInput.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import type * as PlatformError from "effect/PlatformError";
import type * as Stream from "effect/Stream";
import type { CitationPreparedRegexInput } from "./RegexInput.ts";

const $I = $LawPracticeServerId.create("internal/Citation/RegexWorkerProtocol");
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
    description: "Closed native regex transport/ownership failures without source or native causes.",
  })
);
/** @internal @category errors @since 0.0.0 */
export class CitationRegexWorkerFailure extends S.TaggedError<
  CitationRegexWorkerFailure,
  { readonly brand: unique symbol }
>($I`CitationRegexWorkerFailure`)(
  "CitationRegexWorkerFailure",
  { reason: Reason },
  $I.annoteError<CitationRegexWorkerFailure>("CitationRegexWorkerFailure", {
    description: "Native regex boundary failed without retaining a pattern, text, frame or process error.",
  })
) {}
const invalid = () => CitationRegexWorkerFailure.make({ reason: "invalid-frame" });
const exceeded = () => CitationSafetyLimitExceeded.make({ operation: "extract", limit: "processMessageBytes" });
const paddedLength = (bytes: number) => 4 * ((bytes + 2 - ((bytes + 2) % 3)) / 3);
const bytesCodec = (name: string, maximum: number) =>
  S.String.check(
    S.isMaxLength(paddedLength(maximum)),
    S.makeFilter(
      (text) => {
        const length = Str.length(text);
        const padding = Str.endsWith("==")(text) ? 2 : Str.endsWith("=")(text) ? 1 : 0;
        return length % 4 === 0 && (length / 4) * 3 - padding <= maximum;
      },
      $I.annote(`${name}EncodedBound`, { description: "Bound the decoded count before base64 allocation." })
    )
  )
    .pipe(S.decodeTo(S.Uint8ArrayFromBase64))
    .check(S.isMaxLength(maximum))
    .pipe($I.annoteSchema(name, { description: "Bounded padded base64/native bytes with a post-decode byte check." }));
const PatternBytes = bytesCodec("PatternBytes", 4 * CitationEngineAbsoluteMaxima.patternUtf16);
const SourceBytes = bytesCodec("SourceBytes", 4 * CitationEngineAbsoluteMaxima.producedTextUtf16);
const Flags = LiteralKit([0, 2]).pipe(
  $I.annoteSchema("Flags", { description: "Captured tokenizer Python re flags; Unicode is implicit." })
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
    version: S.tag("citation-regex-worker/v1"),
    patternWidth: CitationPythonUnicodeStorage.fields.width,
    patternBytes: PatternBytes,
    sourceWidth: CitationPythonUnicodeStorage.fields.width,
    sourceBytes: SourceBytes,
    flags: Flags,
    maxMatches: Matches,
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
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const emptyJobHeader = Effect.fnUntraced(function* (
  patternWidth: CitationRegexWorkerJob["patternWidth"],
  sourceWidth: CitationRegexWorkerJob["sourceWidth"],
  flags: CitationRegexWorkerJob["flags"],
  maxMatches: CitationRegexWorkerJob["maxMatches"]
) {
  return yield* S.encodeEffect(JobJson)(
    CitationRegexWorkerJob.make({
      patternWidth,
      sourceWidth,
      flags,
      maxMatches,
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
  maximum: number
) {
  const pattern = yield* S.decodeEffect(Layout)(patternInput).pipe(Effect.mapError(invalid));
  const source = yield* S.decodeEffect(Layout)(sourceInput).pipe(Effect.mapError(invalid));
  if (pattern.utf16Units > CitationEngineAbsoluteMaxima.patternUtf16)
    return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "patternUtf16" });
  const flags = yield* S.decodeUnknownEffect(Flags)(flagsInput).pipe(Effect.mapError(invalid));
  const maxMatches = yield* S.decodeUnknownEffect(Matches)(maxMatchesInput).pipe(Effect.mapError(invalid));
  const limit = yield* S.decodeEffect(Limit)(maximum).pipe(Effect.mapError(invalid));
  const header = yield* emptyJobHeader(pattern.width, source.width, flags, maxMatches);
  const bytes =
    encoder.encode(header).byteLength + 1 + paddedLength(pattern.byteLength) + paddedLength(source.byteLength);
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
  const header = yield* emptyJobHeader(job.patternWidth, job.sourceWidth, job.flags, job.maxMatches);
  const count =
    encoder.encode(header).byteLength +
    1 +
    paddedLength(job.patternBytes.byteLength) +
    paddedLength(job.sourceBytes.byteLength);
  if (count > limit) return yield* exceeded();
  const text = yield* S.encodeEffect(JobJson)(job).pipe(Effect.mapError(invalid));
  const frame = encoder.encode(`${text}\n`);
  if (frame.byteLength !== count) return yield* invalid();
  return frame;
});
// The request is flat. Reject structural amplification before JSON.parse or
// base64 decoding; punctuation inside quoted strings is not structure.
/** Flat JSON structure guard shared by closed regex messages.
 * @internal @category operations @since 0.0.0
 */
export const preflightCitationRegexJson = Effect.fn("Citation.preflightRegexJson")(function* (
  bytes: Uint8Array,
  propertyCeiling: number
) {
  let quoted = false;
  let escaped = false;
  let depth = 0;
  let properties = 0;
  const quotedByte = (byte: number) => {
    if (escaped) escaped = false;
    else if (byte === 92) escaped = true;
    else if (byte === 34) quoted = false;
  };
  const openObject = Effect.fnUntraced(function* () {
    depth++;
    if (depth > 1) return yield* invalid();
  });
  const closeObject = Effect.fnUntraced(function* () {
    depth--;
    if (depth < 0) return yield* invalid();
  });
  const property = Effect.fnUntraced(function* () {
    properties++;
    if (properties > propertyCeiling) return yield* invalid();
  });
  const structuralByte = (byte: number | undefined) =>
    Match.value(byte).pipe(
      Match.when(34, () =>
        Effect.sync(() => {
          quoted = true;
        })
      ),
      Match.whenOr(91, 93, () => Effect.fail(invalid())),
      Match.when(123, openObject),
      Match.when(125, closeObject),
      Match.when(58, property),
      Match.orElse(() => Effect.void)
    );
  for (let index = 0; index < bytes.byteLength; index++) {
    if (index % 4096 === 0) yield* Effect.yieldNow;
    const byte = bytes[index];
    if (quoted) quotedByte(byte ?? -1);
    else yield* structuralByte(byte);
  }
  const complete = () => !quoted && !escaped && depth === 0;
  if (!complete()) return yield* invalid();
});
/** Decode a complete bounded frame body. Structural and encoded-byte ceilings
 * precede variable decoding allocations; unknown properties are rejected.
 * @internal @category operations @since 0.0.0
 */
export const decodeCitationRegexJob = Effect.fn("Citation.decodeRegexJob")(function* (bytes: Uint8Array) {
  yield* preflightCitationRegexJson(bytes, propertyCeiling);
  const text = yield* Effect.try({ try: () => decoder.decode(bytes), catch: invalid });
  return yield* S.decodeEffect(JobJson, { onExcessProperty: "error" })(text).pipe(Effect.mapError(invalid));
});
/** @internal @category operations @since 0.0.0 */
export const readCitationRegexFrames = Effect.fn("Citation.readRegexFrames")(function* (
  source: Stream.Stream<Uint8Array, PlatformError.PlatformError>,
  maximum: number,
  expected: 1 | 3,
  onFrame: (bytes: Uint8Array) => Effect.Effect<void, CitationRegexWorkerFailure | CitationSafetyLimitExceeded>
) {
  yield* readCitationByteFrames(source, maximum, expected, onFrame, invalid, exceeded, () =>
    CitationRegexWorkerFailure.make({ reason: "channel-failed" })
  );
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
    ) => Effect.Effect<void, CitationRegexWorkerFailure | CitationSafetyLimitExceeded>
  ) {
    const flags = yield* S.decodeUnknownEffect(Flags)(flagsInput).pipe(Effect.mapError(invalid));
    const maxMatches = yield* S.decodeUnknownEffect(Matches)(maxMatchesInput).pipe(Effect.mapError(invalid));
    let preparedSource = O.none<CitationPreparedRegexInput>();
    const preparedPattern = yield* patternInput
      .prepareUnicode(pattern, (patternLayout) =>
        sourceInput
          .prepareUnicode(source, (sourceLayout) =>
            preflightCitationRegexJob(patternLayout, sourceLayout, flags, maxMatches, limits.processMessageBytes).pipe(
              Effect.flatMap(beforeAllocate)
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
    });
    const frame = yield* encodeCitationRegexJob(job, limits.processMessageBytes);
    return { job, frame, pattern: preparedPattern, source: sourceValue };
  }, timed);
  return { prepare };
});
