/** Closed native-pattern/source messages for owned regex workers.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { makeCitationNativeJsonDecoder } from "./NativeJson.ts";
import { CitationRegexPatternDescriptor, CitationRegexPatternProfile } from "./RegexDescriptors.ts";
import { CitationRegexEngine } from "./RegexEngine.ts";
import {
  CitationRegexPayload,
  CitationRegexWorkerFailure,
  decodeCitationRegexFrameInputs,
  makeCitationRegexJobEncoder,
  makeCitationRegexJobPreparationWith,
  preflightCitationRegexFrameBytes,
} from "./RegexWorkerProtocol.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";

const $I = $LawPracticeServerId.create("internal/Citation/RegexSessionProtocol");
const invalid = () => CitationRegexWorkerFailure.make({ reason: "invalid-frame" });
const exceeded = () => CitationSafetyLimitExceeded.make({ operation: "extract", limit: "processMessageBytes" });
/** Native source and pattern carriers are both preserved. The receiving worker
 * must validate canonical words/width, effective limits and matching semantics
 * before execution. This data is not a reviewed-pattern execution capability.
 * @internal @category models @since 0.0.0
 */
export class CitationRegexSessionJob extends S.Opaque<CitationRegexSessionJob, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Evaluate", {
    ...CitationRegexPayload.fields,
    version: S.tag("citation-regex-worker/v3"),
    sequence: S.Natural,
    engine: CitationRegexEngine,
    descriptor: CitationRegexPatternDescriptor,
  }).pipe(
    $I.annoteSchema("CitationRegexSessionJob", {
      description:
        "One closed data-only regex invocation; projected JavaScript strings cannot replace either native carrier.",
    })
  )
) {}
const JobJson = S.fromJsonString(CitationRegexSessionJob);

const propertyCeiling =
  R.keys(CitationRegexSessionJob.fields).length +
  R.keys(CitationRegexPatternDescriptor.fields).length +
  R.keys(CitationRegexPatternProfile.fields).length +
  CitationEngineAbsoluteMaxima.patternUtf16;
const decodeJob = S.decodeEffect(S.toType(CitationRegexSessionJob));
const encodeJob = S.encodeEffect(JobJson);

const emptyJobHeader = Effect.fnUntraced(function* (
  maximum: number,
  engine: typeof CitationRegexEngine.Type,
  descriptor: CitationRegexPatternDescriptor,
  sequence: number,
  patternWidth: CitationRegexSessionJob["patternWidth"],
  sourceWidth: CitationRegexSessionJob["sourceWidth"],
  flags: CitationRegexSessionJob["flags"],
  maxMatches: CitationRegexSessionJob["maxMatches"],
  mode: CitationRegexSessionJob["mode"]
) {
  let nameUnits = 0;
  for (const name of R.keys(descriptor.profile.names)) {
    nameUnits += name.length + 8;
    if (nameUnits > maximum) return yield* exceeded();
  }
  return yield* encodeJob(
    CitationRegexSessionJob.make({
      engine,
      descriptor,
      sequence,
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
export const preflightCitationRegexSessionJob = Effect.fn("Citation.preflightRegexJob")(function* (
  engine: typeof CitationRegexEngine.Type,
  descriptor: CitationRegexPatternDescriptor,
  sequence: number,
  ...inputs: Parameters<typeof decodeCitationRegexFrameInputs>
) {
  const decoded = yield* decodeCitationRegexFrameInputs(...inputs);
  const { mode, pattern, source, flags, maxMatches, limit } = decoded;
  if (R.keys(descriptor.profile.names).length > CitationEngineAbsoluteMaxima.patternUtf16) return yield* exceeded();
  const header = yield* emptyJobHeader(
    limit,
    engine,
    descriptor,
    sequence,
    pattern.width,
    source.width,
    flags,
    maxMatches,
    mode
  );
  return yield* preflightCitationRegexFrameBytes(header, pattern.byteLength, source.byteLength, limit);
});
/** Encode only after exact size preflight. The caller already owns immutable
 * prepared carriers; the receiver repeats native-layout and policy validation.
 * @internal @category operations @since 0.0.0
 */
export const encodeCitationRegexSessionJob = makeCitationRegexJobEncoder({
  decode: (input: CitationRegexSessionJob) => decodeJob(input).pipe(Effect.mapError(invalid)),
  encode: (job) => encodeJob(job).pipe(Effect.mapError(invalid)),
  header: (job, maximum) =>
    emptyJobHeader(
      maximum,
      job.engine,
      job.descriptor,
      job.sequence,
      job.patternWidth,
      job.sourceWidth,
      job.flags,
      job.maxMatches,
      job.mode
    ),
});
// Reject structural amplification before JSON parsing or
// base64 decoding; punctuation inside quoted strings is not structure.
/** Decode a complete bounded frame body. Structural and encoded-byte ceilings
 * precede variable decoding allocations; unknown properties are rejected.
 * @internal @category operations @since 0.0.0
 */
export const decodeCitationRegexSessionJob = makeCitationNativeJsonDecoder({
  codec: JobJson,
  propertyCeiling: propertyCeiling,
  maximumDepth: 4,
  invalid,
});
/** Join native pattern/source preparation with exact full-frame preflight.
 * Both layouts exist before either payload/map is allocated. The captured
 * server hook can reserve shared process/work capacity at that boundary.
 * No callable is included in the resulting job. Methods retain their explicit
 * reservation requirements.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationRegexSessionPreparation = Effect.fn("Citation.makeRegexSessionPreparation")(function* <R>(
  limits: CitationEngineLimits,
  reserve: (units: number) => Effect.Effect<void, CitationSafetyLimitExceeded, R>
) {
  const payload = yield* makeCitationRegexJobPreparationWith(limits, reserve);
  const prepare = Effect.fn("Citation.prepareRegexSessionJob")(
    (
      engine: typeof CitationRegexEngine.Type,
      descriptor: CitationRegexPatternDescriptor,
      sequence: number,
      ...args: Parameters<typeof payload.prepare<CitationRegexSessionJob>> extends [unknown, ...infer Args]
        ? Args
        : never
    ) =>
      payload.prepare(
        {
          make: (job) => CitationRegexSessionJob.make({ ...job, engine, descriptor, sequence }),
          encode: encodeCitationRegexSessionJob,
          preflight: (...inputs) => preflightCitationRegexSessionJob(engine, descriptor, sequence, ...inputs),
        },
        ...args
      )
  );
  return { prepare };
});
