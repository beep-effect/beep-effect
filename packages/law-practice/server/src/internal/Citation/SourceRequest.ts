/** Raw single-source component to a genuine prerequisite source capability.
 * Reuses the canonical SourceTextResolver and provenance verifier.
 * @internal @packageDocumentation @since 0.0.0
 */
import { ResolvedSourceText, ResolveSourceTextRequest, SourceTextResolver } from "@beep/file-processing/SourceText";
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationEngineExtractionOptions,
  CitationEngineLimits,
  CitationEngineSourceInput,
  CitationInputError,
  CitationPrerequisiteError,
  CitationSafetyLimitExceeded,
  CitationSourceRole,
} from "@beep/law-practice-use-cases/server";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import {
  VerifiedSourceText,
  VerifySourceTextIdentityInput,
  verifySourceTextIdentity,
} from "@beep/provenance/VerifiedTextAnchor";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { snapshotCitationValue } from "./Snapshot.ts";
import type { CitationEngineFailure } from "@beep/law-practice-use-cases/server";

const $I = $LawPracticeServerId.create("internal/Citation/SourceRequest");
type EvidenceFields = { readonly source: S.Codec<VerifiedSourceText> };
const EvidenceFields: EvidenceFields = { source: VerifiedSourceText };
/** Internal runtime proof plus snapshotted named modes; not a serializable wire
 * model. Shortcut deliberately has no options to read or reconstruct.
 * @internal @category models @since 0.0.0
 */
export const CitationPreparedSourceRequest = S.TaggedUnion({
  Shortcut: { ...EvidenceFields, role: S.tag("plain") },
  Extract: { ...EvidenceFields, role: CitationSourceRole, ...CitationEngineExtractionOptions.fields },
}).pipe(
  $I.annoteSchema("CitationPreparedSourceRequest", {
    description: "A genuine resolved source capability with the original shortcut's ignored-option behavior.",
  })
);
/** @internal @category models @since 0.0.0 */
export type CitationPreparedSourceRequest = typeof CitationPreparedSourceRequest.Type;
// Inspect text type/length without copying or hashing an over-limit source.
const Probe = S.Struct({
  source: SourceTextIdentity,
  sourceText: S.String,
  role: CitationEngineSourceInput.fields.role,
}).pipe($I.annoteSchema("Probe", { description: "Single raw component before effective source-size preflight." }));
const Shortcut = S.Struct({ role: S.tag("plain"), sourceText: S.tag("eyecite") }).pipe(
  $I.annoteSchema("Shortcut", { description: "Original shortcut condition over already captured source fields only." })
);
const isShortcut = S.is(Shortcut);
const SourceJson = SourceTextIdentity.pipe(S.toCodecJson, S.fromJsonString);
const LimitsJson = CitationEngineLimits.pipe(S.toCodecJson, S.fromJsonString);
const inputFailure = () => CitationInputError.make({ operation: "extract" });
const prerequisite = () => CitationPrerequisiteError.make({ operation: "extract", dependency: "source-evidence" });
const safety = (limit: CitationSafetyLimitExceeded["limit"]) =>
  CitationSafetyLimitExceeded.make({ operation: "extract", limit });
const prepareOptions = Effect.fn("Citation.prepareSourceRequestOptions")(function* (raw: unknown, maximum: number) {
  const decoded = yield* S.decodeUnknownEffect(CitationEngineExtractionOptions)(raw).pipe(
    Effect.mapError(inputFailure)
  );
  if (decoded.cleanSteps !== null && decoded.cleanSteps.length > maximum) return yield* safety("resolutionIterations");
  return CitationEngineExtractionOptions.make({
    ...decoded,
    cleanSteps: decoded.cleanSteps === null ? null : A.copy(decoded.cleanSteps),
  });
});
/** Capture resolver, digest, policy and Clock. Returned preparation has R=never.
 * This handles the existing single-source primitive profile; complete dual-source
 * and retained-Document request dispatch remain separate engine integration work.
 * The enclosing engine must admit the operation and share its total deadline
 * across source preparation and extraction; this stage has its own captured cap.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationSourceRequestAdapter = Effect.fn("Citation.makeSourceRequestAdapter")(function* (
  policy: unknown
) {
  const decoded = yield* decodeCitationRegexPolicy(policy, inputFailure);
  const limits = yield* snapshotCitationValue(LimitsJson, decoded, inputFailure);
  const resolver = yield* SourceTextResolver;
  const digest = yield* Digest.Digest;
  const timing = yield* makeCitationRegexTiming(limits, true);
  const resolve = Effect.fn("Citation.resolveRequestSource")(function* (source: SourceTextIdentity, text: string) {
    const resolved = yield* resolver.resolve(ResolveSourceTextRequest.make({ identity: source })).pipe(
      Effect.tapError(() =>
        Effect.logDebug("Citation canonical source resolution refused").pipe(
          Effect.annotateLogs({ operation: "extract", dependency: "source-evidence", stage: "resolve" })
        )
      ),
      Effect.mapError(prerequisite),
      Effect.flatMap(S.decodeUnknownEffect(ResolvedSourceText)),
      Effect.mapError(prerequisite)
    );
    if (Str.length(resolved.text) > limits.sourceUtf16) return yield* safety("sourceUtf16");
    const proof = yield* verifySourceTextIdentity(
      VerifySourceTextIdentityInput.make({
        expectedSource: source,
        source: resolved.identity,
        sourceText: resolved.text,
      })
    ).pipe(
      Effect.tapError(() =>
        Effect.logDebug("Citation canonical source verification refused").pipe(
          Effect.annotateLogs({ operation: "extract", dependency: "source-evidence", stage: "verify" })
        )
      ),
      Effect.mapError(prerequisite)
    );
    if (proof.sourceText !== text) return yield* inputFailure();
    return proof;
  });
  const prepare: (raw: unknown) => Effect.Effect<CitationPreparedSourceRequest, CitationEngineFailure> = Effect.fn(
    "Citation.prepareSourceRequest"
  )(
    function* (raw: unknown) {
      const input = yield* S.decodeUnknownEffect(Probe)(raw).pipe(Effect.mapError(inputFailure));
      if (Str.length(input.sourceText) > limits.sourceUtf16) return yield* safety("sourceUtf16");
      const source = yield* snapshotCitationValue(SourceJson, input.source, inputFailure);
      const shortcut = isShortcut(input);
      const options = shortcut ? O.none() : yield* prepareOptions(raw, limits.resolutionIterations).pipe(Effect.asSome);
      const proof = yield* resolve(source, input.sourceText);
      if (O.isNone(options)) return CitationPreparedSourceRequest.cases.Shortcut.make({ source: proof });
      return CitationPreparedSourceRequest.cases.Extract.make({ source: proof, role: input.role, ...options.value });
    },
    Effect.provideService(Digest.Digest, digest),
    timing.timed
  );
  return { prepare };
});
