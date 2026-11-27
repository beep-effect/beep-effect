/**
 * Identification collaborator contracts.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { Fn } from "@beep/schema";
import * as Context from "effect/Context";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { EffectOutput } from "../internal/effectOutput.ts";
import type * as O from "effect/Option";
import type { ConfirmedExtraction, RawContactCard, UsptoRecordFacts } from "./Identification.schemas.ts";

const $I = $LawPracticeUseCasesId.create("DocumentIdentification/Identification.ports");
/**
 * Log-safe adapter or private file failure.
 *
 * **Example** (Inspect IdentificationError)
 *
 * ```ts
 * import { IdentificationError } from "@beep/law-practice-use-cases/DocumentIdentification"
 * console.log(IdentificationError.make({ operation: "read", reason: "invalid-input" }).reason) // "invalid-input"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class IdentificationError extends S.TaggedError<IdentificationError, { readonly brand: unique symbol }>(
  $I`IdentificationError`
)(
  "IdentificationError",
  {
    operation: S.NonEmptyString,
    reason: S.Literals(["invalid-input", "unavailable", "conflicting-records", "unsafe-output"]),
  },
  $I.annote("IdentificationError", { description: "Sanitised failure without provider responses or input text." })
) {
  // fallow-ignore-next-line unused-class-member -- IdentificationError.message: Error.toString / Effect Cause.pretty reads this Error override.
  override get message(): string {
    return `${this.operation}: ${this.reason}`;
  }
}
/**
 * **Example** (Inspect ContactCardSourceShape)
 *
 * ```ts
 * import { ContactCardSourceShape } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as Effect from "effect/Effect";
 * import * as Stream from "effect/Stream";
 * const service = ContactCardSourceShape.make({ cards: Stream.empty })
 * console.log(typeof service.cards) // "function"
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class ContactCardSourceShape extends S.Opaque<ContactCardSourceShape, { readonly brand: unique symbol }>()(
  S.Struct({
    cards: S.declare((u): u is Stream.Stream<RawContactCard, IdentificationError> => Stream.isStream(u)),
  }).pipe($I.annoteSchema("ContactCardSourceShape", { description: "ContactCardSource operations." }))
) {}
/**
 * Service tag for ContactCardSource.
 *
 * **Details**
 *
 * `cards` is a lazy Stream: every run of it starts an independent read of the
 * contact source.
 *
 * **Example** (Inspect ContactCardSource)
 *
 * ```ts
 * import { ContactCardSource, ContactCardSourceShape } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as Effect from "effect/Effect";
 * import * as Stream from "effect/Stream";
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(Layer.succeed(ContactCardSource, ContactCardSourceShape.make({ cards: Stream.empty })))) // true
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class ContactCardSource extends Context.Service<ContactCardSource, ContactCardSourceShape>()(
  $I`ContactCardSource`
) {}
/**
 * **Example** (Inspect UsptoRecordLookupShape)
 *
 * ```ts
 * import { UsptoRecordLookupShape } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as Effect from "effect/Effect";
 * import * as Stream from "effect/Stream";
 * const service = UsptoRecordLookupShape.make({ byApplication: () => Effect.succeedNone, byPatent: () => Effect.succeedNone })
 * console.log(typeof service.byApplication) // "function"
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class UsptoRecordLookupShape extends S.Opaque<UsptoRecordLookupShape, { readonly brand: unique symbol }>()(
  S.Struct({
    byApplication: Fn({ input: S.String, output: EffectOutput<O.Option<UsptoRecordFacts>, IdentificationError>() }),
    byPatent: Fn({ input: S.String, output: EffectOutput<O.Option<UsptoRecordFacts>, IdentificationError>() }),
  }).pipe($I.annoteSchema("UsptoRecordLookupShape", { description: "UsptoRecordLookup operations." }))
) {}
/**
 * Service tag for UsptoRecordLookup.
 *
 * **Example** (Inspect UsptoRecordLookup)
 *
 * ```ts
 * import { UsptoRecordLookup, UsptoRecordLookupShape } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as Effect from "effect/Effect";
 * import * as Stream from "effect/Stream";
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(Layer.succeed(UsptoRecordLookup, UsptoRecordLookupShape.make({ byApplication: () => Effect.succeedNone, byPatent: () => Effect.succeedNone })))) // true
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class UsptoRecordLookup extends Context.Service<UsptoRecordLookup, UsptoRecordLookupShape>()(
  $I`UsptoRecordLookup`
) {}
/**
 * **Example** (Inspect DomainRegistrantLookupShape)
 *
 * ```ts
 * import { DomainRegistrantLookupShape } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as Effect from "effect/Effect";
 * import * as Stream from "effect/Stream";
 * const service = DomainRegistrantLookupShape.make({ registrant: () => Effect.succeedNone })
 * console.log(typeof service.registrant) // "function"
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class DomainRegistrantLookupShape extends S.Opaque<
  DomainRegistrantLookupShape,
  { readonly brand: unique symbol }
>()(
  S.Struct({ registrant: Fn({ input: S.String, output: EffectOutput<O.Option<string>, IdentificationError>() }) }).pipe(
    $I.annoteSchema("DomainRegistrantLookupShape", { description: "DomainRegistrantLookup operations." })
  )
) {}
/**
 * Service tag for DomainRegistrantLookup.
 *
 * **Example** (Inspect DomainRegistrantLookup)
 *
 * ```ts
 * import { DomainRegistrantLookup, DomainRegistrantLookupShape } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as Effect from "effect/Effect";
 * import * as Stream from "effect/Stream";
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(Layer.succeed(DomainRegistrantLookup, DomainRegistrantLookupShape.make({ registrant: () => Effect.succeedNone })))) // true
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class DomainRegistrantLookup extends Context.Service<DomainRegistrantLookup, DomainRegistrantLookupShape>()(
  $I`DomainRegistrantLookup`
) {}
/**
 * **Example** (Inspect DocumentExtractionSourceShape)
 *
 * ```ts
 * import { DocumentExtractionSourceShape } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as Effect from "effect/Effect";
 * import * as Stream from "effect/Stream";
 * const service = DocumentExtractionSourceShape.make({ extraction: () => Effect.succeedNone })
 * console.log(typeof service.extraction) // "function"
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class DocumentExtractionSourceShape extends S.Opaque<
  DocumentExtractionSourceShape,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    extraction: Fn({ input: S.String, output: EffectOutput<O.Option<ConfirmedExtraction>, IdentificationError>() }),
  }).pipe($I.annoteSchema("DocumentExtractionSourceShape", { description: "DocumentExtractionSource operations." }))
) {}
/**
 * Service tag for DocumentExtractionSource.
 *
 * **Example** (Inspect DocumentExtractionSource)
 *
 * ```ts
 * import { DocumentExtractionSource, DocumentExtractionSourceShape } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as Effect from "effect/Effect";
 * import * as Stream from "effect/Stream";
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(Layer.succeed(DocumentExtractionSource, DocumentExtractionSourceShape.make({ extraction: () => Effect.succeedNone })))) // true
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class DocumentExtractionSource extends Context.Service<
  DocumentExtractionSource,
  DocumentExtractionSourceShape
>()($I`DocumentExtractionSource`) {}
