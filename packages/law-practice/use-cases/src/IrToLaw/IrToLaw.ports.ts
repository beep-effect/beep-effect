/**
 * IR-to-law port: the typed contract through which span-bearing extraction
 * output is mapped into concrete law-practice domain entities. This is the
 * boundary at which generic NLP annotations acquire IP-law meaning.
 *
 * **Details**
 *
 * The input is a checked annotation handoff. Mentions carry verified capture receipts,
 * and readings retain the model text used to build the law entities.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { Claim, Distinction, OfficeAction, PriorArtReference, Rejection } from "@beep/law-practice-domain";
import * as Context from "effect/Context";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { ExtractionHandoff } from "@beep/langextract/Handoff";
import type * as Effect from "effect/Effect";
import type { IrToLawExtractionError } from "./IrToLaw.errors.ts";

const $I = $LawPracticeUseCasesId.create("IrToLaw/IrToLaw.ports");

/**
 * Structural field contract for {@link LawEntities}.
 *
 * **Example** (Pick LawEntities key)
 *
 * ```ts
 * import type { LawEntities } from "@beep/law-practice-use-cases/IrToLaw"
 *
 * const key: keyof LawEntities = "claim"
 * console.log(key)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface LawEntities {
  readonly claim: Claim;
  readonly distinction: Distinction;
  readonly officeAction: OfficeAction;
  readonly priorArtReference: PriorArtReference;
  readonly rejection: Rejection;
}

type IrToLawHandler = (input: ExtractionHandoff) => Effect.Effect<LawEntities, IrToLawExtractionError>;

const isIrToLawHandler = (input: unknown): input is IrToLawHandler => P.isFunction(input);

const IrToLawToLaw = S.declare<IrToLawHandler>(isIrToLawHandler).annotateKey({
  description: "Map grounded office-action extractions into law-practice entities.",
});

type AnnotatedField<Schema extends S.Top> = S.Schema<Schema["Type"]>;

type LawEntitiesFields = {
  readonly claim: AnnotatedField<typeof Claim>;
  readonly distinction: AnnotatedField<typeof Distinction>;
  readonly officeAction: AnnotatedField<typeof OfficeAction>;
  readonly priorArtReference: AnnotatedField<typeof PriorArtReference>;
  readonly rejection: AnnotatedField<typeof Rejection>;
};

const LawEntitiesBase: S.Class<LawEntities, S.Struct<LawEntitiesFields>, {}> = S.Class<LawEntities>(
  $I`LawEntities`
)<LawEntitiesFields>(
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
);

/**
 * The bundle of law-practice domain entities produced by mapping one office
 * action's grounded extractions. Each field is the concrete entity the generic
 * extraction output resolves into.
 *
 * **Example** (List LawEntities keys)
 *
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
export class LawEntities extends LawEntitiesBase {}

/**
 * Map one checked extraction handoff into the law-practice {@link LawEntities}.
 * Mentions supply the class and verified receipt; the first reading supplies
 * the model text. The distinction takes its `TextAnchor` from that receipt.
 *
 * **Example** (Map a checked handoff)
 *
 * ```ts
 * import { makeIrToLaw } from "@beep/law-practice-use-cases/IrToLaw"
 * import type { ExtractionHandoff } from "@beep/langextract/Handoff"
 *
 * const mapChecked = (handoff: ExtractionHandoff) => makeIrToLaw().toLaw(handoff)
 * console.log(typeof mapChecked)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class IrToLawShape extends S.Opaque<IrToLawShape, { readonly brand: unique symbol }>()(
  S.Struct({
    toLaw: IrToLawToLaw,
  }).pipe(
    $I.annoteSchema("IrToLawShape", {
      description: "Service shape for mapping grounded extraction output into law-practice entities.",
    })
  )
) {}

/**
 * IR-to-law mapping service tag.
 *
 * **Example** (Provide fake IrToLaw service)
 *
 * ```ts
 * import { makeIrToLaw } from "@beep/law-practice-use-cases/IrToLaw"
 * import type { ExtractionHandoff } from "@beep/langextract/Handoff"
 *
 * const mapChecked = (handoff: ExtractionHandoff) => makeIrToLaw().toLaw(handoff)
 * console.log(typeof mapChecked)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class IrToLaw extends Context.Service<IrToLaw, IrToLawShape>()($I`IrToLaw`) {}
