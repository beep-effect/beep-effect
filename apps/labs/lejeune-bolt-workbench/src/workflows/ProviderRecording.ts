/**
 * Integrity verification for sanitized provider recordings used by offline replay.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LejeuneBoltWorkbenchId } from "@beep/identity/packages";
import { LiteralKit, Sha256HexFromBytes } from "@beep/schema";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { strToU8 } from "fflate";
import {
  FrozenProviderRecording,
  PROVIDER_RECORDING_SOURCE_TEXT,
  ProviderCandidate,
  ProviderCandidateListFromJsonString,
} from "@/domain/Bundle";
import type { ProviderRecording } from "@/domain/Bundle";

const $I = $LejeuneBoltWorkbenchId.create("workflows/ProviderRecording");

const ProviderRecordingIntegrityIssue = LiteralKit([
  "candidate-encoding",
  "candidate-digest",
  "candidate-labels",
  "candidate-contract",
  "frozen-contract",
  "source-grounding",
]);

/** Typed failure raised when a persisted provider recording cannot be trusted for offline replay. @category errors @since 0.0.0 */
export class ProviderRecordingIntegrityError extends S.TaggedError<ProviderRecordingIntegrityError>(
  $I`ProviderRecordingIntegrityError`
)(
  "ProviderRecordingIntegrityError",
  {
    cause: S.optionalKey(S.Defect({ includeStack: true })),
    issue: ProviderRecordingIntegrityIssue,
    message: S.NonEmptyString,
  },
  $I.annoteError<ProviderRecordingIntegrityError>("ProviderRecordingIntegrityError", {
    title: "LeJeune provider recording integrity error",
    description: "A candidate encoding, digest, label-set, or source-grounding failure at the recording boundary.",
  })
) {}

const providerIntegrityError = (
  issue: typeof ProviderRecordingIntegrityIssue.Type,
  message: string,
  cause?: unknown
): ProviderRecordingIntegrityError => ProviderRecordingIntegrityError.make({ cause, issue, message });

const expectedProviderCandidateText = ProviderCandidate.fields.label.$match({
  project: () => "North Loop Canopy",
  delivery_date: () => "2026-09-12",
  finish: () => "MG B695 Class 55",
});

const providerCandidateMatchesContract = (candidate: ProviderCandidate): boolean =>
  Str.Equivalence(candidate.text, expectedProviderCandidateText(candidate.label));

/**
 * Verify the canonical candidate digest and source grounding of a committed provider recording.
 *
 * @category validation
 * @since 0.0.0
 */
export const verifyProviderRecording = Effect.fn("lejeune.provider.verify_recording")(function* (
  recording: ProviderRecording,
  sourceText: string
) {
  const candidateJson = yield* ProviderCandidateListFromJsonString.encodeEffect(recording.candidates).pipe(
    Effect.mapError((cause) =>
      providerIntegrityError(
        "candidate-encoding",
        "The provider candidate list could not be canonically encoded.",
        cause
      )
    )
  );
  const digest = yield* Sha256HexFromBytes.decodeEffect(strToU8(candidateJson)).pipe(
    Effect.mapError((cause) =>
      providerIntegrityError("candidate-digest", "The provider candidate digest could not be computed.", cause)
    )
  );
  if (!Str.Equivalence(digest, recording.responseSha256)) {
    return yield* providerIntegrityError(
      "candidate-digest",
      "The provider candidate digest does not match the committed recording."
    );
  }
  const labels = A.map(recording.candidates, (candidate) => candidate.label);
  const hasExactLabels =
    A.length(A.dedupe(labels)) === 3 &&
    A.every(["project", "delivery_date", "finish"] as const, (label) => A.contains(labels, label));
  if (!hasExactLabels) {
    return yield* providerIntegrityError(
      "candidate-labels",
      "The provider recording must contain project, delivery_date, and finish exactly once."
    );
  }
  if (!A.every(recording.candidates, providerCandidateMatchesContract)) {
    return yield* providerIntegrityError(
      "candidate-contract",
      "Every provider candidate label must retain the exact value authorized by extraction contract v1."
    );
  }
  if (!A.every(recording.candidates, (candidate) => Str.includes(candidate.text)(sourceText))) {
    return yield* providerIntegrityError(
      "source-grounding",
      "Every provider candidate must occur verbatim in the authorized source text."
    );
  }
  return recording;
});

/**
 * Verify and refine a generic sanitized result to the exact committed offline replay artifact.
 *
 * **Example** (Inspect the verifier)
 *
 * ```ts
 * import { verifyFrozenProviderRecording } from "@/workflows/ProviderRecording"
 *
 * console.log(typeof verifyFrozenProviderRecording === "function") // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const verifyFrozenProviderRecording = Effect.fn("lejeune.provider.verify_frozen_recording")(function* (
  recording: ProviderRecording,
  sourceText: string
) {
  const verified = yield* verifyProviderRecording(recording, sourceText);
  if (!Str.Equivalence(sourceText, PROVIDER_RECORDING_SOURCE_TEXT)) {
    return yield* providerIntegrityError(
      "source-grounding",
      "The frozen provider recording must be grounded in the exact canonical RFQ A source document."
    );
  }
  return yield* FrozenProviderRecording.decodeEffect(verified).pipe(
    Effect.mapError((cause) =>
      providerIntegrityError(
        "frozen-contract",
        "Provider metadata and ordered candidates must match the committed replay artifact exactly.",
        cause
      )
    )
  );
});
