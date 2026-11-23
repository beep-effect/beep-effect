/**
 * Extraction target and few-shot example schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LangExtractId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $LangExtractId.create("Target");

/**
 * V1 target kinds understood by the provider-neutral extraction contract.
 *
 * **Example** (Check entity kind)
 *
 * ```ts
 * import { ExtractionTargetKind } from "@beep/langextract/Target"
 *
 * console.log(ExtractionTargetKind.is.entity("entity"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExtractionTargetKind = LiteralKit(["entity", "relation", "attribute", "event", "custom"]).pipe(
  $I.annoteSchema("ExtractionTargetKind", {
    description: "Provider-neutral target kinds accepted by LangExtract prompts.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type ExtractionTargetKind = typeof ExtractionTargetKind.Type;

const extractionTargetAttributesDefault = A.empty<string>();
/**
 * A single extraction target requested from a language model.
 *
 * **Example** (Make entity extraction target)
 *
 * ```ts
 * import { ExtractionTarget } from "@beep/langextract/Target"
 *
 * console.log(ExtractionTarget.make({ kind: "entity", name: "person" }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractionTarget extends S.Opaque<ExtractionTarget, { readonly brand: unique symbol }>()(
  S.Struct({
    attributes: S.Array(S.NonEmptyString).pipe(
      S.withConstructorDefault(Effect.succeed(extractionTargetAttributesDefault)),
      S.withDecodingDefaultType(Effect.succeed(extractionTargetAttributesDefault))
    ),
    description: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    kind: ExtractionTargetKind,
    name: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("ExtractionTarget", {
      description: "Provider-neutral extraction target used to construct a LangExtract prompt.",
    })
  )
) {}

/**
 * Example extraction included in a few-shot prompt.
 *
 * **Example** (Make labeled extraction item)
 *
 * ```ts
 * import { ExtractionExampleItem } from "@beep/langextract/Target"
 *
 * console.log(ExtractionExampleItem.make({ label: "person", text: "Ada Lovelace" }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractionExampleItem extends S.Opaque<ExtractionExampleItem, { readonly brand: unique symbol }>()(
  S.Struct({
    attributes: S.Record(S.String, S.String).pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    ),
    label: S.NonEmptyString,
    text: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("ExtractionExampleItem", {
      description: "Expected extraction item in a LangExtract prompt example.",
    })
  )
) {}

/**
 * Few-shot example for a source text and expected extractions.
 *
 * **Example** (Make few-shot example)
 *
 * ```ts
 * import { ExtractionExample, ExtractionExampleItem } from "@beep/langextract/Target"
 *
 * console.log(ExtractionExample.make({
 *   extractions: [ExtractionExampleItem.make({ label: "person", text: "Ada Lovelace" })],
 *   text: "Ada Lovelace wrote notes."
 * }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractionExample extends S.Opaque<ExtractionExample, { readonly brand: unique symbol }>()(
  S.Struct({
    extractions: S.Array(ExtractionExampleItem),
    text: S.String,
  }).pipe(
    $I.annoteSchema("ExtractionExample", {
      description: "Few-shot extraction example used by the provider-neutral prompt builder.",
    })
  )
) {}
