/**
 * Identification collaborator contracts.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { Fn } from "@beep/schema";
import { Context, Stream } from "effect";
import * as S from "effect/Schema";
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
export class IdentificationError extends S.TaggedError<IdentificationError>($I`IdentificationError`)(
  "IdentificationError",
  {
    operation: S.NonEmptyString,
    reason: S.Literals(["invalid-input", "unavailable", "conflicting-records", "unsafe-output"]),
  },
  $I.annote("IdentificationError", { description: "Sanitised failure without provider responses or input text." })
) {
  override get message(): string {
    return `${this.operation}: ${this.reason}`;
  }
}
/**
 * Typed operations of ContactCardSource.
 *
 * **Example** (Inspect ContactCardSourceShape)
 *
 * ```ts
 * import { ContactCardSourceShape } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import { Effect, Stream } from "effect"
 * const service = ContactCardSourceShape.make({ cards: Stream.empty })
 * console.log(typeof service.cards) // "function"
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class ContactCardSourceShape extends S.Class<ContactCardSourceShape>($I`ContactCardSourceShape`)(
  {
    cards: S.declare((u): u is Stream.Stream<RawContactCard, IdentificationError> => Stream.isStream(u)),
  },
  $I.annote("ContactCardSourceShape", { description: "ContactCardSource operations." })
) {}
/**
 * Service tag for ContactCardSource.
 *
 * **Example** (Inspect ContactCardSource)
 *
 * ```ts
 * import { ContactCardSource, ContactCardSourceShape } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import { Effect, Stream, Layer } from "effect"
 * console.log(Layer.isLayer(Layer.succeed(ContactCardSource, ContactCardSourceShape.make({ cards: Stream.empty })))) // true
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
// A Stream is lazy: every run of `cards` starts an independent read, as the SPEC requires.
export class ContactCardSource extends Context.Service<ContactCardSource, ContactCardSourceShape>()(
  $I`ContactCardSource`
) {}
/**
 * Typed operations of UsptoRecordLookup.
 *
 * **Example** (Inspect UsptoRecordLookupShape)
 *
 * ```ts
 * import { UsptoRecordLookupShape } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import { Effect, Stream } from "effect"
 * const service = UsptoRecordLookupShape.make({ byApplication: () => Effect.succeedNone, byPatent: () => Effect.succeedNone })
 * console.log(typeof service.byApplication) // "function"
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class UsptoRecordLookupShape extends S.Class<UsptoRecordLookupShape>($I`UsptoRecordLookupShape`)(
  {
    byApplication: Fn({ input: S.String, output: EffectOutput<O.Option<UsptoRecordFacts>, IdentificationError>() }),
    byPatent: Fn({ input: S.String, output: EffectOutput<O.Option<UsptoRecordFacts>, IdentificationError>() }),
  },
  $I.annote("UsptoRecordLookupShape", { description: "UsptoRecordLookup operations." })
) {}
/**
 * Service tag for UsptoRecordLookup.
 *
 * **Example** (Inspect UsptoRecordLookup)
 *
 * ```ts
 * import { UsptoRecordLookup, UsptoRecordLookupShape } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import { Effect, Stream, Layer } from "effect"
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
 * Typed operations of DomainRegistrantLookup.
 *
 * **Example** (Inspect DomainRegistrantLookupShape)
 *
 * ```ts
 * import { DomainRegistrantLookupShape } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import { Effect, Stream } from "effect"
 * const service = DomainRegistrantLookupShape.make({ registrant: () => Effect.succeedNone })
 * console.log(typeof service.registrant) // "function"
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class DomainRegistrantLookupShape extends S.Class<DomainRegistrantLookupShape>($I`DomainRegistrantLookupShape`)(
  { registrant: Fn({ input: S.String, output: EffectOutput<O.Option<string>, IdentificationError>() }) },
  $I.annote("DomainRegistrantLookupShape", { description: "DomainRegistrantLookup operations." })
) {}
/**
 * Service tag for DomainRegistrantLookup.
 *
 * **Example** (Inspect DomainRegistrantLookup)
 *
 * ```ts
 * import { DomainRegistrantLookup, DomainRegistrantLookupShape } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import { Effect, Stream, Layer } from "effect"
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
 * Typed operations of DocumentExtractionSource.
 *
 * **Example** (Inspect DocumentExtractionSourceShape)
 *
 * ```ts
 * import { DocumentExtractionSourceShape } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import { Effect, Stream } from "effect"
 * const service = DocumentExtractionSourceShape.make({ extraction: () => Effect.succeedNone })
 * console.log(typeof service.extraction) // "function"
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class DocumentExtractionSourceShape extends S.Class<DocumentExtractionSourceShape>(
  $I`DocumentExtractionSourceShape`
)(
  { extraction: Fn({ input: S.String, output: EffectOutput<O.Option<ConfirmedExtraction>, IdentificationError>() }) },
  $I.annote("DocumentExtractionSourceShape", { description: "DocumentExtractionSource operations." })
) {}
/**
 * Service tag for DocumentExtractionSource.
 *
 * **Example** (Inspect DocumentExtractionSource)
 *
 * ```ts
 * import { DocumentExtractionSource, DocumentExtractionSourceShape } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import { Effect, Stream, Layer } from "effect"
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
