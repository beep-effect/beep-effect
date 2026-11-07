/** Admitted default resolution with installation-owned policy and artifact.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationMention } from "@beep/law-practice-domain/values";
import { CitationEngineLimits, CitationInputError } from "@beep/law-practice-use-cases/server";
import { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor";
import { Sha256Hex } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CitationOperationAdmission } from "./Admission.ts";
import { CitationAuthorityEdition } from "./AuthorityIdentity.ts";
import { CitationRegexOperation, decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { makeCitationResolverBoundary } from "./RegisteredResolver.ts";
import { snapshotCitationValue } from "./Snapshot.ts";

const $I = $LawPracticeServerId.create("internal/Citation/ResolverOperation");
const LimitsJson = CitationEngineLimits.pipe(S.toCodecJson, S.fromJsonString);
const SourceProof: S.Codec<VerifiedSourceText> = VerifiedSourceText;
const Request = S.Struct({
  verifiedSource: SourceProof,
  mentions: S.Array(CitationMention),
  editions: S.Array(CitationAuthorityEdition),
}).pipe(
  $I.annoteSchema("Request", {
    description: "Verified resolution operands; policy and implementation identity are captured at installation.",
  })
);
const RequestType = S.toType(Request);
/** Capture shared admission, resolver dependencies, limits, artifact and Clock.
 * Each invocation owns a fresh Scope and includes queue time in its captured
 * deadline. Caller policy/artifact properties and later service replacements
 * cannot change installed authority. The raw resolver remains available for
 * diagnostic and source-adapter use. Final raw-source public composition is
 * separate; this method accepts a genuine verified-source capability.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationResolverOperation = Effect.fn("Citation.makeResolverOperation")(
  function* (policy: unknown, artifact: unknown) {
    const invalid = () => CitationInputError.make({ operation: "resolve" });
    const decoded = yield* decodeCitationRegexPolicy(policy, invalid);
    const limits = yield* snapshotCitationValue(LimitsJson, decoded, invalid);
    const engineArtifact = yield* S.decodeUnknownEffect(Sha256Hex)(artifact).pipe(Effect.mapError(invalid));
    const admission = yield* CitationOperationAdmission;
    const resolver = yield* makeCitationResolverBoundary();
    const timing = yield* makeCitationRegexTiming(limits, true);
    return {
      resolve: Effect.fn("Citation.resolveAdmitted")(
        (raw: unknown) =>
          admission
            .run(
              "resolve",
              Effect.scoped(
                Effect.gen(function* () {
                  const request = yield* S.decodeUnknownEffect(RequestType)(raw).pipe(Effect.mapError(invalid));
                  return yield* resolver.resolve({ ...request, limits, engineArtifact });
                })
              )
            )
            .pipe(Effect.catchTag("CitationAdmissionFailure", () => Effect.fail(invalid()))),
        timing.timed
      ),
    };
  },
  Effect.provideService(CitationRegexOperation, "resolve")
);
