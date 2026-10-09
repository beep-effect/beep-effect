/**
 * Explicit span-preserving office-action structure ports.
 * @packageDocumentation
 * @since 0.0.0
 */
import { PageOcrResult } from "@beep/file-processing/PageOcr";
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { GroundedExtraction } from "@beep/langextract/Extraction";
import {
  DocStructureAbstention,
  DocStructureDocument,
  DocStructureRuleFamily,
  OfficeActionFinality,
  officeActionRuleV1,
} from "@beep/law-practice-domain";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import {
  TextAnchorVerificationReceipt,
  VerifiedSourceText,
  VerifiedTextAnchorErrorReason,
  VerifySourceTextIdentityInput,
} from "@beep/provenance/VerifiedTextAnchor";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type { DocStructureOutcome, OfficeActionRecognizedPair } from "@beep/law-practice-domain";
import type { VerifiedTextAnchorError } from "@beep/provenance/VerifiedTextAnchor";
import type * as Crypto from "effect/Crypto";
import type { OfficeActionStructureStorageError } from "./OfficeActionStructure.errors.ts";

const $I = $LawPracticeUseCasesId.create("OfficeActionStructure/OfficeActionStructure.ports");
const VerifiedSourceSchema: S.Codec<VerifiedSourceText> = VerifiedSourceText;
const OfficeActionStructureInputStruct = S.Struct({
  document: DocStructureDocument,
  verifiedSource: VerifiedSourceSchema,
  rule: DocStructureRuleFamily.pipe(S.withConstructorDefault(Effect.succeed(officeActionRuleV1))),
  ocrPages: S.Array(PageOcrResult).pipe(S.withConstructorDefault(Effect.succeed([]))),
});
const OfficeActionStructureInputBase: S.Class<OfficeActionStructureInput, typeof OfficeActionStructureInputStruct, {}> =
  S.Class<OfficeActionStructureInput>($I`OfficeActionStructureInput`)(
    OfficeActionStructureInputStruct,
    $I.annote("OfficeActionStructureInput", {
      description:
        "Verified raw source and declared qualification; any typed OCR page closes v1 regardless of declared modality or confidence.",
    })
  );
/**
 * Requires opaque source verification and retains typed OCR diagnostics at the extraction boundary.
 *
 * **Example** (Inspect OfficeActionStructureInput)
 *
 * ```ts
 * import { OfficeActionStructureInput } from "@beep/law-practice-use-cases/OfficeActionStructure"
 * import * as S from "effect/Schema"
 * console.log(S.is(OfficeActionStructureInput)({})) // false
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class OfficeActionStructureInput extends OfficeActionStructureInputBase {}
/**
 * Defines span-preserving extraction and adapter operations with typed anchor failures.
 * @category type-level
 * @since 0.0.0
 */
export interface OfficeActionStructureShape {
  readonly extract: (input: OfficeActionStructureInput) => Effect.Effect<DocStructureOutcome, VerifiedTextAnchorError>;
  readonly fromExtractions: (
    input: OfficeActionStructureInput,
    extractions: ReadonlyArray<GroundedExtraction>
  ) => Effect.Effect<DocStructureOutcome, VerifiedTextAnchorError>;
}
/**
 * Provides deterministic extraction and exact-source candidate construction.
 *
 * **Example** (Inspect OfficeActionStructure)
 *
 * ```ts
 * import { OfficeActionStructure } from "@beep/law-practice-use-cases/OfficeActionStructure"
 * import * as Effect from "effect/Effect"
 * const program = OfficeActionStructure.use(() => Effect.succeed("acquired"))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class OfficeActionStructure extends Context.Service<OfficeActionStructure, OfficeActionStructureShape>()(
  $I`OfficeActionStructure`
) {}
/**
 * Receives an atomic candidate pair as evidence inputs with no admission or approval state.
 * @category type-level
 * @since 0.0.0
 */
export interface OfficeActionEvidenceConsumerShape {
  readonly receive: (pair: OfficeActionRecognizedPair) => Effect.Effect<void>;
}
/**
 * Names the product evidence consumer used by the docketing adapter.
 *
 * **Example** (Inspect OfficeActionEvidenceConsumer)
 *
 * ```ts
 * import { OfficeActionEvidenceConsumer } from "@beep/law-practice-use-cases/OfficeActionStructure"
 * import * as Effect from "effect/Effect"
 * const program = OfficeActionEvidenceConsumer.use(() => Effect.succeed("acquired"))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class OfficeActionEvidenceConsumer extends Context.Service<
  OfficeActionEvidenceConsumer,
  OfficeActionEvidenceConsumerShape
>()($I`OfficeActionEvidenceConsumer`) {}

class RecognizedReceipt extends S.Class<RecognizedReceipt>($I`RecognizedReceipt`)(
  {
    status: S.tag("recognized"),
    finality: OfficeActionFinality,
    anchors: S.Tuple([TextAnchorVerificationReceipt, TextAnchorVerificationReceipt]),
  },
  $I.annote("RecognizedReceipt", {
    description: "Ordered pair receipts to reverify against the exact source before returning candidates.",
  })
) {}
class FailedReceipt extends S.Class<FailedReceipt>($I`FailedReceipt`)(
  { status: S.tag("failed"), reason: VerifiedTextAnchorErrorReason },
  $I.annote("FailedReceipt", { description: "Retained exact-source failure with zero candidates." })
) {}
/**
 * Retains structural receipts or closed failures; decoding it never restores runtime authority.
 *
 * **Example** (Inspect OfficeActionStoredOutcome)
 *
 * ```ts
 * import { OfficeActionStoredOutcome } from "@beep/law-practice-use-cases/OfficeActionStructure"
 * import * as S from "effect/Schema"
 * console.log(S.is(OfficeActionStoredOutcome)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OfficeActionStoredOutcome = S.Union([RecognizedReceipt, DocStructureAbstention, FailedReceipt]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("OfficeActionStoredOutcome", {
    description: "Structural attempt outcome; decoded receipts cannot confer runtime authority.",
  })
);
/**
 * Retains structural receipts or closed failures; decoding it never restores runtime authority.
 * @category type-level
 * @since 0.0.0
 */
export type OfficeActionStoredOutcome = typeof OfficeActionStoredOutcome.Type;
/**
 * Retains an immutable source- and rule-versioned attempt with its linked predecessor.
 *
 * **Example** (Inspect OfficeActionStructureAttempt)
 *
 * ```ts
 * import { OfficeActionStructureAttempt } from "@beep/law-practice-use-cases/OfficeActionStructure"
 * import * as S from "effect/Schema"
 * console.log(S.is(OfficeActionStructureAttempt)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OfficeActionStructureAttempt extends S.Class<OfficeActionStructureAttempt>(
  $I`OfficeActionStructureAttempt`
)(
  {
    schemaVersion: S.Literal("1"),
    attemptId: S.NonEmptyString,
    previousAttemptId: S.NonEmptyString.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    document: DocStructureDocument,
    expectedSource: SourceTextIdentity,
    source: SourceTextIdentity,
    rule: DocStructureRuleFamily,
    extractions: S.Array(GroundedExtraction),
    ocrPages: OfficeActionStructureInput.fields.ocrPages,
    outcome: OfficeActionStoredOutcome,
  },
  $I.annote("OfficeActionStructureAttempt", {
    description:
      "Immutable attempt retaining identity, raw extractions, rule version and linked predecessor without storing approval state.",
  })
) {}

/**
 * Defines read and append operations for immutable attempt history.
 * @category type-level
 * @since 0.0.0
 */
export interface OfficeActionStructureStoreShape {
  readonly append: (attempt: OfficeActionStructureAttempt) => Effect.Effect<void, OfficeActionStructureStorageError>;
  readonly find: (
    source: SourceTextIdentity,
    rule: DocStructureRuleFamily
  ) => Effect.Effect<ReadonlyArray<OfficeActionStructureAttempt>, OfficeActionStructureStorageError>;
  readonly read: Effect.Effect<ReadonlyArray<OfficeActionStructureAttempt>, OfficeActionStructureStorageError>;
}
/**
 * Names the append-only persistence boundary consumed by docketing.
 *
 * **Example** (Inspect OfficeActionStructureStore)
 *
 * ```ts
 * import { OfficeActionStructureStore } from "@beep/law-practice-use-cases/OfficeActionStructure"
 * import * as Effect from "effect/Effect"
 * const program = OfficeActionStructureStore.use(() => Effect.succeed("acquired"))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class OfficeActionStructureStore extends Context.Service<
  OfficeActionStructureStore,
  OfficeActionStructureStoreShape
>()($I`OfficeActionStructureStore`) {}

/**
 * Pins explicit source authorization and the predecessor for a new immutable attempt.
 *
 * **Example** (Inspect OfficeActionAttemptRequest)
 *
 * ```ts
 * import { OfficeActionAttemptRequest } from "@beep/law-practice-use-cases/OfficeActionStructure"
 * import * as S from "effect/Schema"
 * console.log(S.is(OfficeActionAttemptRequest)({})) // false
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
export class OfficeActionAttemptRequest extends S.Class<OfficeActionAttemptRequest>($I`OfficeActionAttemptRequest`)(
  {
    attemptId: S.NonEmptyString,
    document: DocStructureDocument,
    verification: VerifySourceTextIdentityInput,
    ocrPages: OfficeActionStructureInput.fields.ocrPages,
    rule: DocStructureRuleFamily.pipe(S.withConstructorDefault(Effect.succeed(officeActionRuleV1))),
    previousAttemptId: OfficeActionStructureAttempt.fields.previousAttemptId,
  },
  $I.annote("OfficeActionAttemptRequest", {
    description: "Explicit source authorization and predecessor for a new immutable attempt.",
  })
) {}
/**
 * Defines retained extraction, exact-source replay and delivery to an evidence consumer.
 * @category type-level
 * @since 0.0.0
 */
export interface OfficeActionDocketIntakeShape {
  readonly deliver: (outcome: DocStructureOutcome) => Effect.Effect<void>;
  readonly record: (
    request: OfficeActionAttemptRequest
  ) => Effect.Effect<DocStructureOutcome, VerifiedTextAnchorError | OfficeActionStructureStorageError, Crypto.Crypto>;
  readonly replay: (
    attempt: OfficeActionStructureAttempt,
    verification: VerifySourceTextIdentityInput
  ) => Effect.Effect<DocStructureOutcome, VerifiedTextAnchorError | OfficeActionStructureStorageError, Crypto.Crypto>;
}
/**
 * Names the docketing evidence adapter with no epistemic admission behavior.
 *
 * **Example** (Inspect OfficeActionDocketIntake)
 *
 * ```ts
 * import { OfficeActionDocketIntake } from "@beep/law-practice-use-cases/OfficeActionStructure"
 * import * as Effect from "effect/Effect"
 * const program = OfficeActionDocketIntake.use(() => Effect.succeed("acquired"))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
export class OfficeActionDocketIntake extends Context.Service<
  OfficeActionDocketIntake,
  OfficeActionDocketIntakeShape
>()($I`OfficeActionDocketIntake`) {}
