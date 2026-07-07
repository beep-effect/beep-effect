/**
 * IR-to-law port: the typed contract through which span-bearing extraction
 * output is mapped into concrete law-practice domain entities. This is the
 * boundary at which generic NLP annotations acquire IP-law meaning.
 *
 * The input is `ReadonlyArray<GroundedExtraction>` (from `@beep/langextract`),
 * NOT the `@beep/nlp` `AnnotatedDocument` envelope. The envelope does not carry
 * per-entity character spans: its `Entity.mentions` are bare `MentionId[]` and
 * the span-bearing `Mention` objects are not included in the envelope, so a
 * required `Distinction.anchor` (`TextAnchor`) cannot be recovered from it. A
 * `GroundedExtraction` instead carries its own aligned `span` plus the original
 * `matchedText`, which is exactly what grounding a distinction's anchor needs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { GroundedExtraction } from "@beep/langextract/Extraction";
import { Claim, Distinction, OfficeAction, PriorArtReference, Rejection } from "@beep/law-practice-domain";
import { EffectSchema, Fn } from "@beep/schema";
import { Context } from "effect";
import * as S from "effect/Schema";
import type { IrToLawExtractionError } from "./IrToLaw.errors.ts";

const $I = $LawPracticeUseCasesId.create("IrToLaw/IrToLaw.ports");

/**
 * The bundle of law-practice domain entities produced by mapping one office
 * action's grounded extractions. Each field is the concrete entity the generic
 * extraction output resolves into.
 *
 * @example
 * ```ts
 * import type { LawEntities } from "@beep/law-practice-use-cases/IrToLaw"
 *
 * const entityKeys: ReadonlyArray<keyof LawEntities> = [
 *   "claim",
 *   "distinction",
 *   "officeAction",
 *   "priorArtReference",
 *   "rejection"
 * ]
 *
 * console.log(entityKeys.includes("distinction")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LawEntities extends S.Class<LawEntities>($I`LawEntities`)(
  {
    claim: Claim.annotateKey({
      description: "Patent claim resolved from the grounded claim extraction.",
    }),
    distinction: Distinction.annotateKey({
      description: "Applicant distinction resolved from the grounded distinction extraction.",
    }),
    officeAction: OfficeAction.annotateKey({
      description: "Office-action entity resolved from the source document extraction.",
    }),
    priorArtReference: PriorArtReference.annotateKey({
      description: "Prior-art reference cited by the rejection extraction.",
    }),
    rejection: Rejection.annotateKey({
      description: "Section 102 rejection linking the claim and prior-art reference.",
    }),
  },
  $I.annote("LawEntities", {
    description:
      "The bundle of law-practice domain entities produced by mapping one office\naction's grounded extractions. Each field is the concrete entity the generic\nextraction output resolves into.",
  })
) {}

/**
 * Service shape for the IR-to-law mapping: take the span-bearing grounded
 * extractions for one office action and produce the law-practice
 * {@link LawEntities} they encode. The `span`/`matchedText` an extraction
 * carries is what grounds the distinction's `TextAnchor`.
 *
 * @example
 * ```ts
 * import { IrToLawExtractionError, IrToLawShape } from "@beep/law-practice-use-cases/IrToLaw"
 * import { Effect, Exit } from "effect"
 *
 * const shape = IrToLawShape.make({
 *   toLaw: () =>
 *     Effect.fail(
 *       IrToLawExtractionError.fromReason("required-extraction-missing", {
 *         label: "claim",
 *         message: "Missing claim extraction."
 *       })
 *     )
 * })
 *
 * const program = Effect.exit(shape.toLaw([]))
 *
 * Effect.runPromise(program).then((exit) => console.log(Exit.isFailure(exit))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class IrToLawShape extends S.Class<IrToLawShape>($I`IrToLawShape`)(
  {
    toLaw: Fn({
      input: S.Array(GroundedExtraction),
      output: EffectSchema<LawEntities, IrToLawExtractionError, never>(),
    }).annotateKey({
      description: "Map grounded office-action extractions into law-practice entities.",
    }),
  },
  $I.annote("IrToLawShape", {
    description: "Service shape for mapping grounded extraction output into law-practice entities.",
  })
) {}

/**
 * IR-to-law mapping service tag.
 *
 * @example
 * ```ts
 * import { IrToLaw, IrToLawExtractionError, IrToLawShape } from "@beep/law-practice-use-cases/IrToLaw"
 * import { Effect, Exit } from "effect"
 *
 * const fakeMapper = IrToLawShape.make({
 *   toLaw: () =>
 *     Effect.fail(
 *       IrToLawExtractionError.fromReason("required-extraction-missing", {
 *         label: "office_action",
 *         message: "Missing office-action extraction."
 *       })
 *     )
 * })
 *
 * const program = Effect.gen(function* () {
 *   const mapper = yield* IrToLaw
 *   const exit = yield* Effect.exit(mapper.toLaw([]))
 *   return Exit.isFailure(exit)
 * }).pipe(Effect.provideService(IrToLaw, fakeMapper))
 *
 * Effect.runPromise(program).then(console.log) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class IrToLaw extends Context.Service<IrToLaw, IrToLawShape>()($I`IrToLaw`) {}
