/** Shared canonical source resolution and proof, without extraction shortcuts.
 * @internal @packageDocumentation @since 0.0.0
 */
import { ResolvedSourceText, ResolveSourceTextRequest, SourceTextResolver } from "@beep/file-processing/SourceText";
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationEngineLimits,
  CitationInputError,
  CitationPrerequisiteError,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { VerifySourceTextIdentityInput, verifySourceTextIdentity } from "@beep/provenance/VerifiedTextAnchor";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CitationRegexOperation, decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { snapshotCitationValue } from "./Snapshot.ts";
import type { CitationEngineFailure } from "@beep/law-practice-use-cases/server";
import type { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor";

const $I = $LawPracticeServerId.create("internal/Citation/SourceEvidence");
const SourceJson = SourceTextIdentity.pipe(S.toCodecJson, S.fromJsonString);
const LimitsJson = CitationEngineLimits.pipe(S.toCodecJson, S.fromJsonString);
const Input = S.Struct({ source: SourceTextIdentity, sourceText: S.String }).pipe(
  $I.annoteSchema("Input", {
    description: "Canonical source identity and primitive text before effective-size admission; no extraction options.",
  })
);
/** Capture the canonical resolver, verifier dependencies and selected operation.
 * Inputs are snapshotted before asynchronous resolution; canonical prerequisite
 * constructors/verifier retain their own identity-copy and proof ownership.
 * No shortcut, cleaner selection, source-map choice or annotation policy is
 * implemented here. Every call returns a genuine proof with R=never.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationSourceEvidence = Effect.fn("Citation.makeSourceEvidence")(function* (policy: unknown) {
  const operation = yield* CitationRegexOperation;
  const invalid = () => CitationInputError.make({ operation });
  const prerequisite = () => CitationPrerequisiteError.make({ operation, dependency: "source-evidence" });
  const safety = () => CitationSafetyLimitExceeded.make({ operation, limit: "sourceUtf16" });
  const decoded = yield* decodeCitationRegexPolicy(policy, invalid);
  const limits = yield* snapshotCitationValue(LimitsJson, decoded, invalid);
  const resolver = yield* SourceTextResolver;
  const digest = yield* Digest.Digest;
  const timing = yield* makeCitationRegexTiming(limits, true);
  const refused = (stage: "resolve" | "verify") =>
    Effect.logDebug("Citation canonical source evidence refused").pipe(
      Effect.annotateLogs({ operation, dependency: "source-evidence", stage })
    );
  const resolve: (raw: unknown) => Effect.Effect<VerifiedSourceText, CitationEngineFailure> = Effect.fn(
    "Citation.resolveSourceEvidence"
  )(
    function* (raw: unknown) {
      const input = yield* S.decodeUnknownEffect(Input)(raw).pipe(Effect.mapError(invalid));
      const text = input.sourceText;
      if (Str.length(text) > limits.sourceUtf16) return yield* safety();
      const expected = yield* snapshotCitationValue(SourceJson, input.source, invalid);
      const resolved = yield* resolver.resolve(ResolveSourceTextRequest.make({ identity: expected })).pipe(
        Effect.tapError(() => refused("resolve")),
        Effect.mapError(prerequisite),
        Effect.flatMap(S.decodeUnknownEffect(ResolvedSourceText)),
        Effect.mapError(prerequisite)
      );
      if (Str.length(resolved.text) > limits.sourceUtf16) return yield* safety();
      const proof = yield* verifySourceTextIdentity(
        VerifySourceTextIdentityInput.make({
          expectedSource: expected,
          source: resolved.identity,
          sourceText: resolved.text,
        })
      ).pipe(
        Effect.tapError(() => refused("verify")),
        Effect.mapError(prerequisite)
      );
      if (proof.sourceText !== text) return yield* invalid();
      return proof;
    },
    Effect.provideService(Digest.Digest, digest),
    timing.timed
  );
  return { resolve };
});
