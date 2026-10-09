/**
 * Office-action persistence, explicit-version replay and evidence intake.
 * @packageDocumentation
 * @since 0.0.0
 */
import { GroundedExtraction } from "@beep/langextract/Extraction";
import {
  makeOfficeActionStructure,
  OfficeActionDocketIntake,
  OfficeActionEvidenceConsumer,
  OfficeActionStoredOutcome,
  OfficeActionStructure,
  OfficeActionStructureAttempt,
  OfficeActionStructureInput,
  OfficeActionStructureStorageError,
  OfficeActionStructureStore,
} from "@beep/law-practice-use-cases/OfficeActionStructure";
import {
  toTextAnchorVerificationReceipt,
  VerifiedTextAnchorError,
  VerifySourceTextIdentityInput,
  verifySourceTextIdentity,
} from "@beep/provenance/VerifiedTextAnchor";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import type { DocStructureOutcome } from "@beep/law-practice-domain";
import type { OfficeActionAttemptRequest } from "@beep/law-practice-use-cases/OfficeActionStructure";

const storedOutcome = (outcome: DocStructureOutcome): OfficeActionStoredOutcome =>
  outcome.status === "abstained"
    ? outcome
    : OfficeActionStoredOutcome.cases.recognized.make({
        finality: outcome.candidates[0].finality,
        anchors: [
          toTextAnchorVerificationReceipt(outcome.candidates[0].anchor),
          toTextAnchorVerificationReceipt(outcome.candidates[1].anchor),
        ],
      });
const retainedExtractions = (outcome: DocStructureOutcome): ReadonlyArray<GroundedExtraction> =>
  outcome.status === "abstained"
    ? []
    : A.map(outcome.candidates, (candidate) =>
        GroundedExtraction.cases.match_exact.make({
          label: candidate._tag === "OfficeActionFinalityCandidate" ? "action-finality" : "shortened-statutory-period",
          text: candidate.anchor.anchor.quote,
          matchedText: candidate.anchor.anchor.quote,
          span: { start: candidate.anchor.anchor.startChar, end: candidate.anchor.anchor.endChar },
        })
      );
/**
 * Provides the deterministic office-action extraction workflow.
 *
 * **Example** (Inspect OfficeActionStructureLive)
 *
 * ```ts
 * import { OfficeActionStructureLive } from "@beep/law-practice-server/OfficeActionStructure"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(OfficeActionStructureLive)) // true
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
export const OfficeActionStructureLive = Layer.succeed(OfficeActionStructure, makeOfficeActionStructure());
/**
 * Composes deterministic extraction, attempt persistence and a caller-supplied evidence consumer.
 *
 * **Example** (Inspect OfficeActionDocketIntakeLive)
 *
 * ```ts
 * import { OfficeActionDocketIntakeLive } from "@beep/law-practice-server/OfficeActionStructure"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(OfficeActionDocketIntakeLive)) // true
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
export const OfficeActionDocketIntakeLive = Layer.effect(
  OfficeActionDocketIntake,
  Effect.gen(function* () {
    const store = yield* OfficeActionStructureStore;
    const structure = yield* OfficeActionStructure;
    const consumer = yield* OfficeActionEvidenceConsumer;
    const record = Effect.fn("OfficeActionDocketIntake.record")(function* (request: OfficeActionAttemptRequest) {
      const result = yield* Effect.result(
        Effect.gen(function* () {
          const verifiedSource = yield* verifySourceTextIdentity(request.verification);
          return yield* structure.extract(
            OfficeActionStructureInput.make({
              document: request.document,
              verifiedSource,
              rule: request.rule,
              ocrPages: request.ocrPages,
            })
          );
        })
      );
      if (result._tag === "Failure") {
        yield* store.append(
          OfficeActionStructureAttempt.make({
            schemaVersion: "1",
            attemptId: request.attemptId,
            previousAttemptId: request.previousAttemptId,
            document: request.document,
            expectedSource: request.verification.expectedSource,
            source: request.verification.source,
            rule: request.rule,
            extractions: [],
            ocrPages: request.ocrPages,
            outcome: OfficeActionStoredOutcome.cases.failed.make({ reason: result.failure.reason }),
          })
        );
        return yield* result.failure;
      }
      yield* store.append(
        OfficeActionStructureAttempt.make({
          schemaVersion: "1",
          attemptId: request.attemptId,
          previousAttemptId: request.previousAttemptId,
          document: request.document,
          expectedSource: request.verification.expectedSource,
          source: request.verification.source,
          rule: request.rule,
          extractions: retainedExtractions(result.success),
          ocrPages: request.ocrPages,
          outcome: storedOutcome(result.success),
        })
      );
      return result.success;
    });
    const replay = Effect.fn("OfficeActionDocketIntake.replay")(function* (
      attempt: OfficeActionStructureAttempt,
      verification: VerifySourceTextIdentityInput
    ) {
      const equivalentSource = S.toEquivalence(VerifySourceTextIdentityInput.fields.source);
      if (
        !equivalentSource(verification.expectedSource, attempt.expectedSource) ||
        !equivalentSource(verification.source, attempt.source)
      )
        return yield* VerifiedTextAnchorError.fromReason("stale-source");
      const verifiedSource = yield* verifySourceTextIdentity(verification);
      if (attempt.outcome.status === "failed") return yield* VerifiedTextAnchorError.fromReason(attempt.outcome.reason);
      const input = OfficeActionStructureInput.make({
        document: attempt.document,
        verifiedSource,
        rule: attempt.rule,
        ocrPages: attempt.ocrPages,
      });
      const outcome =
        attempt.outcome.status === "recognized"
          ? yield* structure.fromExtractions(input, attempt.extractions)
          : yield* structure.extract(input);
      if (!S.toEquivalence(OfficeActionStoredOutcome)(storedOutcome(outcome), attempt.outcome))
        return yield* OfficeActionStructureStorageError.make({
          message: "Stored outcome contradicts exact-source replay.",
        });
      return outcome;
    });
    return OfficeActionDocketIntake.of({
      record,
      replay,
      deliver: Effect.fn("OfficeActionDocketIntake.deliver")(function* (outcome: DocStructureOutcome) {
        if (outcome.status === "recognized") yield* consumer.receive(outcome);
      }),
    });
  })
).pipe(Layer.provide(OfficeActionStructureLive));
