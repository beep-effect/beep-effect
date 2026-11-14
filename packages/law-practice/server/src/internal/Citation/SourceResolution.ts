/** Raw-source resolution through canonical evidence and original dispatch.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationDocument, CitationDocumentReceipt } from "@beep/law-practice-domain/values";
import {
  CitationEngineReport,
  CitationEngineResolutionInput,
  CitationEngineResolutionResult,
  CitationInputError,
  CitationPrerequisiteError,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CitationAuthorityEdition } from "./AuthorityIdentity.ts";
import { CitationInvocation } from "./Invocation.ts";
import { restoreCitationMentionAgainstVerifiedSource } from "./Mention.ts";
import { CitationRegexOperation, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { makeCitationResolverBoundary } from "./RegisteredResolver.ts";
import { makeCitationResolutionEditions } from "./ResolutionEditions.ts";
import { CitationResourceBinding } from "./ResourceIdentity.ts";
import { captureCitationOperationPolicy, snapshotCitationValue } from "./Snapshot.ts";
import { makeCitationSourceEvidence } from "./SourceEvidence.ts";
import { measureCitationTextWork } from "./TextBudget.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor";
import type { Sha256Hex } from "@beep/schema";
import type { CitationOwned } from "./ConfigurationOwnership.ts";

const $I = $LawPracticeServerId.create("internal/Citation/SourceResolution");
const SourceEvidenceField: { readonly source: S.Codec<VerifiedSourceText> } = {
  source: CitationEngineResolutionResult.fields.source,
};
/** Complete internal restoration evidence and public resolution projection.
 * @internal @category models @since 0.0.0
 */
export class CitationSourceResolutionResult extends S.Opaque<
  CitationSourceResolutionResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    ...SourceEvidenceField,
    document: CitationDocument,
    receipt: CitationDocumentReceipt,
    resourceBindings: S.Array(CitationResourceBinding),
    editions: S.Array(CitationAuthorityEdition),
    output: CitationEngineResolutionResult,
  }).pipe(
    $I.annoteSchema("CitationSourceResolutionResult", {
      description:
        "Completed raw-source resolution with genuine evidence, original restoration bindings and public result.",
    })
  )
) {}
const InputType = S.toType(CitationEngineResolutionInput);
const InputJson = CitationEngineResolutionInput.pipe(S.toCodecJson, S.fromJsonString);
/** Capture dependencies and admit before source resolution. Snapshot receipts
 * before asynchronous source work, then reverify anchors and engine-bound IDs.
 * Derive edition spellings from the captured frozen service, never the request.
 * Original resolver output/receipt/bindings remain available beside public
 * output for trusted restoration adapters. Returned resolve requires CitationInvocation.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationSourceResolution = Effect.fn("Citation.makeSourceResolution")(
  function* (limits: CitationOwned<CitationEngineLimits>, engineArtifact: Sha256Hex) {
    const invalid = () => CitationInputError.make({ operation: "resolve" });
    const evidenceFailure = () =>
      CitationPrerequisiteError.make({ operation: "resolve", dependency: "source-evidence" });
    const vocabularyFailure = () =>
      CitationPrerequisiteError.make({ operation: "resolve", dependency: "court-reporter-vocabulary" });
    const digest = yield* Digest.Digest;
    const evidence = yield* makeCitationSourceEvidence(limits);
    const editions = yield* makeCitationResolutionEditions();
    const resolver = yield* makeCitationResolverBoundary();
    const timing = yield* makeCitationRegexTiming(limits, true);
    const capture = Effect.fn("Citation.captureSourceResolutionInput")(function* (raw: unknown) {
      if (P.isObject(raw) && P.isString(raw.sourceText) && Str.length(raw.sourceText) > limits.sourceUtf16)
        return yield* CitationSafetyLimitExceeded.make({ operation: "resolve", limit: "sourceUtf16" });
      if (P.isObject(raw) && A.isArray(raw.mentions) && raw.mentions.length > limits.mentions)
        return yield* CitationSafetyLimitExceeded.make({ operation: "resolve", limit: "mentions" });
      const decoded = yield* S.decodeUnknownEffect(InputType)(raw).pipe(Effect.mapError(invalid));
      if (decoded.mentions.length > limits.mentions)
        return yield* CitationSafetyLimitExceeded.make({ operation: "resolve", limit: "mentions" });
      if (Str.length(decoded.sourceText) > limits.sourceUtf16)
        return yield* CitationSafetyLimitExceeded.make({ operation: "resolve", limit: "sourceUtf16" });
      return yield* snapshotCitationValue(InputJson, decoded, invalid);
    });
    const prepare = Effect.fn("Citation.resolveRawSource")(
      function* (raw: unknown) {
        const request = yield* capture(raw);
        const source = yield* evidence.resolve(request);
        const mentions = yield* Effect.forEach(
          request.mentions,
          (mention) =>
            restoreCitationMentionAgainstVerifiedSource(mention, source, engineArtifact).pipe(
              Effect.mapError(evidenceFailure)
            ),
          { concurrency: 1 }
        );
        const selected = yield* editions.forMentions(mentions).pipe(Effect.mapError(vocabularyFailure));
        const resolved = yield* resolver.resolve({
          verifiedSource: source,
          mentions,
          editions: selected,
          limits,
          engineArtifact,
        });
        return { ...resolved, source, editions: selected };
      },
      Effect.provideService(Digest.Digest, digest)
    );
    return {
      resolve: Effect.fn("Citation.resolveSourceBoundary")(
        function* (raw: unknown) {
          const { workDuration, result, producedTextUtf16 } = yield* measureCitationTextWork(
            (yield* CitationInvocation).budget,
            prepare(raw)
          );
          const reportPolicy = yield* captureCitationOperationPolicy(limits, engineArtifact, invalid);
          const report = CitationEngineReport.make({
            operation: "resolve",
            engineArtifact,
            limits: reportPolicy.limits,
            workDuration,
            producedTextUtf16,
            extraction: null,
          });
          return CitationSourceResolutionResult.make({
            ...result,
            output: CitationEngineResolutionResult.make({
              source: result.source,
              document: result.document,
              report,
            }),
          });
        },
        Effect.catchTags({
          CitationSafetyLimitExceeded: timing.failSafety,
        })
      ),
    };
  },
  Effect.provideService(CitationRegexOperation, "resolve")
);
