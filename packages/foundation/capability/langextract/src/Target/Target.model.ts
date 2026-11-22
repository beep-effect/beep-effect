/**
 * Extraction target and few-shot example schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LangExtractId } from "@beep/identity";
import { TermIri } from "@beep/identity/Term";
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
 * {@inheritDoc ExtractionTargetKind}
 * @category models
 * @since 0.0.0
 */
export type ExtractionTargetKind = typeof ExtractionTargetKind.Type;

/**
 * What a target's label annotates in the handoff document.
 *
 * **Details**
 *
 * - `Mention` reads the label as a registry class. Its `coreference` names the
 *   attribute whose shared value clusters Mentions of that class.
 * - `Relation` reads the label as a relation. `subject`, `predicate` and
 *   `object` name the attributes that carry the two endpoint surfaces and the
 *   predicate surface; `predicates` maps a predicate surface to its registry
 *   term; `endpoint` is the class of the endpoint Mentions.
 *
 * The prompt does not render it, so prompts and provider-cache keys do not
 * depend on it.
 *
 * **Example** (Read a label as a class)
 *
 * ```ts import.meta.vitest name="Read a label as a class"
 * import { TargetAnnotation } from "@beep/langextract/Target"
 * import { TermIri } from "@beep/identity/Term"
 *
 * const annotates = TargetAnnotation.cases.Mention.make({
 *   class: TermIri.make("https://beep-effect.com/ns/office-action/claim"),
 * })
 * annotates._tag // => "Mention"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TargetAnnotation = S.TaggedUnion({
  Mention: {
    class: TermIri.annotateKey({ description: "The registry class the target's label is read as." }),
    coreference: S.NonEmptyString.pipe(
      S.annotateKey({ description: "The attribute whose shared value clusters Mentions of the class." }),
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    ),
  },
  Relation: {
    subject: S.NonEmptyString.annotateKey({ description: "The attribute carrying the subject surface." }),
    predicate: S.NonEmptyString.annotateKey({ description: "The attribute carrying the predicate surface." }),
    object: S.NonEmptyString.annotateKey({ description: "The attribute carrying the object surface." }),
    predicates: S.Record(S.NonEmptyString, TermIri).annotateKey({
      description: "The registry predicate each accepted predicate surface reads as.",
    }),
    endpoint: TermIri.annotateKey({ description: "The registry class of the endpoint Mentions." }),
  },
}).pipe(
  $I.annoteSchema("TargetAnnotation", {
    description: "What an extraction target's label annotates: a Mention class or a typed relation.",
  })
);

/**
 * {@inheritDoc TargetAnnotation}
 * @category models
 * @since 0.0.0
 */
export type TargetAnnotation = typeof TargetAnnotation.Type;

const extractionTargetAttributesDefault = A.empty<string>();
/**
 * A single extraction target requested from a language model.
 *
 * **Example** (Make entity extraction target)
 *
 * ```ts
 * import { ExtractionTarget, TargetAnnotation } from "@beep/langextract/Target"
 * import { TermIri } from "@beep/identity/Term"
 *
 * console.log(
 *   ExtractionTarget.make({
 *     annotates: TargetAnnotation.cases.Mention.make({
 *       class: TermIri.make("https://beep-effect.com/ns/semantica/person"),
 *     }),
 *     kind: "entity",
 *     name: "person",
 *   })
 * )
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractionTarget extends S.Opaque<ExtractionTarget, { readonly brand: unique symbol }>()(
  S.Struct({
    annotates: TargetAnnotation,
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
