/** Scoped six-form extraction composed from existing evidence and process owners.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationExtractor,
  CitationExtractorFailure,
  CitationExtractorReport,
  CitationExtractorResult,
  CitationInputError,
  CitationRecognitionError,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CitationOperationAdmission } from "../internal/Citation/Admission.ts";
import { makeCitationAdmissionOwners } from "../internal/Citation/NativeAdmission.ts";
import { CitationNativeProcessRuntime } from "../internal/Citation/NativeProcess.ts";
import { makeCitationRecognizerWorker } from "../internal/Citation/RecognizerWorker.ts";
import { CitationRegexOperation, makeCitationRegexTiming } from "../internal/Citation/RegexPolicy.ts";
import { resolveSixFormCitationMentions } from "../internal/Citation/Resolve.ts";
import {
  CitationSixFormArtifactDescriptor,
  makeCitationSixFormArtifact,
} from "../internal/Citation/SixFormArtifact.ts";
import { makeCitationSixFormProjection } from "../internal/Citation/SixFormProjection.ts";
import { captureCitationSnapshot } from "../internal/Citation/Snapshot.ts";
import { makeCitationSourceEvidence } from "../internal/Citation/SourceEvidence.ts";

const $I = $LawPracticeServerId.create("CitationExtractor/CitationExtractor.layer");
/** Trusted installation claims and explicit process launch capability. The
 * installer authenticates implementation/runtime bytes; hashing its claims does
 * not attest arbitrary executables. Request data cannot replace this policy.
 * **Example** (Inspect installation ownership)
 * ```ts
 * import { CitationExtractorConfiguration } from "@beep/law-practice-server/layer"
 * console.log(CitationExtractorConfiguration.fields.runtime !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationExtractorConfiguration extends S.Opaque<
  CitationExtractorConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({ installation: CitationSixFormArtifactDescriptor, runtime: CitationNativeProcessRuntime }).pipe(
    $I.annoteSchema("CitationExtractorConfiguration", {
      description: "Captured six-form installation identity, policy and explicit owned-worker runtime.",
    })
  )
) {}
const Configuration = S.toType(CitationExtractorConfiguration);
const ConfigurationJson = CitationExtractorConfiguration.pipe(S.toCodecJson, S.fromJsonString);
const isFailure = S.is(CitationExtractorFailure);
const normalize = Effect.fnUntraced(function* (cause: Cause.Cause<unknown>) {
  if (Cause.hasInterrupts(cause)) return yield* Effect.interrupt;
  const error = Cause.findErrorOption(cause);
  if (O.isSome(error) && isFailure(error.value)) return yield* error.value;
  return yield* CitationRecognitionError.make({ reason: "transport-failed" });
});
const make = Effect.fn("Citation.makeExtractor")(function* (raw: unknown) {
  const invalid = () => CitationInputError.make({ operation: "extract" });
  const configuration = yield* captureCitationSnapshot(Configuration, ConfigurationJson, raw, invalid);
  const { installation, runtime } = configuration;
  const { limits } = installation;
  if (runtime.kind !== installation.runtime.kind) return yield* invalid();
  const digest = yield* Digest.Digest;
  const admissions = yield* makeCitationAdmissionOwners(limits).pipe(Effect.mapError(invalid));
  const owners = Context.add(admissions, CitationRegexOperation, "extract");
  const operation = Context.get(owners, CitationOperationAdmission);
  const sourceEvidence = yield* makeCitationSourceEvidence(limits).pipe(Effect.provideContext(owners));
  const projection = yield* makeCitationSixFormProjection(limits).pipe(Effect.provideContext(owners));
  if (projection.vocabularyVersion !== installation.vocabularyVersion) return yield* invalid();
  const engineArtifact = yield* makeCitationSixFormArtifact(installation);
  const worker = yield* makeCitationRecognizerWorker(limits, runtime).pipe(Effect.provideContext(owners));
  const timing = yield* makeCitationRegexTiming(limits, true).pipe(Effect.provideContext(owners));
  const extract: typeof CitationExtractor.Service.extract = Effect.fn("Citation.Extractor.extract")((input) => {
    const body = Effect.gen(function* () {
      const source = yield* sourceEvidence.resolve(input);
      const output = yield* worker.recognize(source.sourceText).pipe(
        Effect.mapError((error) =>
          S.is(CitationSafetyLimitExceeded)(error)
            ? error
            : CitationRecognitionError.make({
                reason: error.reason === "parser-failed" ? "parser-failed" : "transport-failed",
              })
        )
      );
      const { mentions, excludedAnchors } = yield* projection
        .project(source, engineArtifact, output)
        .pipe(
          Effect.mapError((error) =>
            S.is(CitationSafetyLimitExceeded)(error)
              ? error
              : CitationRecognitionError.make({ reason: "invalid-observation" })
          )
        );
      const document = yield* resolveSixFormCitationMentions({
        verifiedSource: source,
        engineArtifact,
        mentions,
        excludedAnchors,
        editions: [],
        limits,
      }).pipe(
        Effect.provideService(Digest.Digest, digest),
        Effect.mapError((error) =>
          error.reason === "limit-exceeded" && error.limit !== undefined
            ? CitationSafetyLimitExceeded.make({ operation: "extract", limit: error.limit })
            : CitationRecognitionError.make({ reason: "invalid-observation" })
        )
      );
      const report = CitationExtractorReport.make({
        engineArtifact,
        vocabularyVersion: projection.vocabularyVersion,
        limits,
        recognizedMentions: A.length(mentions),
        outsideProfile: output.outsideProfile,
      });
      return yield* S.decodeUnknownEffect(S.toType(CitationExtractorResult))({ source, document, report }).pipe(
        Effect.mapError(() => CitationRecognitionError.make({ reason: "invalid-observation" }))
      );
    }).pipe(timing.timed);
    return operation.run("extract", body).pipe(Effect.catchCause(normalize));
  });
  return CitationExtractor.of({ extract });
});
/** Capture canonical source resolution, Digest, Clock and process services in
 * one scoped Layer. Returned extraction requires no caller services and exposes
 * only complete verified documents after independently acknowledged retirement.
 * **Example** (Inspect the six-form Layer)
 * ```ts
 * import { CitationExtractorLive } from "@beep/law-practice-server/layer"
 * console.log(typeof CitationExtractorLive) // "function"
 * ```
 * @category layers
 * @since 0.0.0
 */
export const CitationExtractorLive = (configuration: CitationExtractorConfiguration) =>
  Layer.effect(
    CitationExtractor,
    make(configuration).pipe(Effect.provideService(CitationRegexOperation, "extract"), Effect.catchCause(normalize))
  );
