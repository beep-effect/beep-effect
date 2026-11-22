/**
 * Annotation kinds: the registry a caller-owned document is closed over.
 *
 * **Details**
 *
 * A kind names its registry term, its body schema, the kinds its body may
 * reference, the annotation ids a body references and, for structure and
 * segmentation kinds, a containment level. Its content case is the tagged
 * struct `{ _tag: name, targets, body }`. {@link mintAnnotationId} hashes an
 * annotation under `annotation/v1` with its kind's IRI and its body encoded by
 * the kind's JSON codec.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { AnnotationId, AnnotationPreimage, AnnotationTargets } from "./AnnotationId.ts";
import type { TermIri } from "@beep/identity/Term";
import type { PreimageMintError } from "@beep/jsonc/Mint";
import type { OccurrenceId } from "@beep/text/Occurrence";
import type * as Digest from "effect/crypto/Digest";
import type * as HashSet from "effect/HashSet";

/**
 * A body schema: service-free, so its JSON encoding is a pure function of the
 * value.
 *
 * **Example** (Accept a struct body)
 *
 * ```ts
 * import type { KindBody } from "@beep/annotation/Kind"
 * import * as S from "effect/Schema"
 *
 * const body: KindBody = S.Struct({ ordinal: S.Natural })
 * console.log(body.ast._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KindBody = S.Top & { readonly DecodingServices: never; readonly EncodingServices: never };

/**
 * One annotation kind as {@link defineKind} declares it.
 *
 * **Details**
 *
 * `references` names the kinds a body may point at and `referencedIds` reads
 * the annotation ids a body points at; the document checks that each id is an
 * annotation of a referenced kind. `level` is `Some` only for structure and
 * segmentation kinds, the ones that take part in containment.
 *
 * **Example** (Read a kind's tag and level)
 *
 * ```ts
 * import type { AnnotationKind } from "@beep/annotation/Kind"
 * import { DocumentKinds } from "@beep/annotation/Kinds"
 *
 * const word: AnnotationKind<"Word", typeof DocumentKinds.Word.body, never> = DocumentKinds.Word
 * console.log(word.name, word.level)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface AnnotationKind<Name extends string, Body extends KindBody, Refs extends string> {
  /** The body schema. */
  readonly body: Body;
  /** The content case: `{ _tag: name, targets, body }`. */
  readonly case: S.TaggedStruct<Name, { readonly targets: typeof AnnotationTargets; readonly body: Body }>;
  /** The registry term of the kind, hashed into every annotation id of the kind. */
  readonly iri: TermIri;
  /** The containment level, for structure and segmentation kinds only. */
  readonly level: O.Option<number>;
  /** The kind name, the case's `_tag`. */
  readonly name: Name;
  /** The annotation ids a body references. */
  readonly referencedIds: (body: Body["Type"]) => Iterable<AnnotationId>;
  /** The kinds a body may reference. */
  readonly references: ReadonlyArray<Refs>;
}

/**
 * Any annotation kind: the element type of a {@link KindRegistry}.
 *
 * **Example** (Widen a kind)
 *
 * ```ts
 * import type { AnyAnnotationKind } from "@beep/annotation/Kind"
 * import { DocumentKinds } from "@beep/annotation/Kinds"
 *
 * const kind: AnyAnnotationKind = DocumentKinds.Mention
 * console.log(kind.iri)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface AnyAnnotationKind {
  /** The body schema. */
  readonly body: KindBody;
  /** The content case. */
  readonly case: S.Top;
  /** The registry term of the kind. */
  readonly iri: TermIri;
  /** The containment level, for structure and segmentation kinds only. */
  readonly level: O.Option<number>;
  /** The kind name. */
  readonly name: string;
  /** The annotation ids a body references. */
  referencedIds(body: unknown): Iterable<AnnotationId>;
  /** The kinds a body may reference. */
  readonly references: ReadonlyArray<string>;
}

/**
 * A caller-supplied kind registry keyed by kind name.
 *
 * **Example** (Type a registry)
 *
 * ```ts
 * import type { KindRegistry } from "@beep/annotation/Kind"
 * import { OaKinds } from "@beep/annotation/Kinds"
 *
 * const kinds: KindRegistry = OaKinds
 * console.log(Object.keys(kinds).length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KindRegistry = { readonly [name: string]: AnyAnnotationKind };

/**
 * Registry well-formedness: each entry's name is its key, and every reference
 * names a registered kind.
 *
 * **Example** (Check a registry closed)
 *
 * ```ts
 * import type { ClosedKindRegistry } from "@beep/annotation/Kind"
 * import { ExtractionKinds } from "@beep/annotation/Kinds"
 *
 * const closed: ClosedKindRegistry<typeof ExtractionKinds> = ExtractionKinds
 * console.log(closed.RelationCandidate.references)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ClosedKindRegistry<Kinds extends KindRegistry> = {
  readonly [K in keyof Kinds]: { readonly name: K; readonly references: ReadonlyArray<keyof Kinds> };
};

/**
 * The kind names of a registry.
 *
 * **Example** (Name a kind)
 *
 * ```ts
 * import type { KindName } from "@beep/annotation/Kind"
 * import type { OaKinds } from "@beep/annotation/Kinds"
 *
 * const name: KindName<typeof OaKinds> = "Sentence"
 * console.log(name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KindName<Kinds extends KindRegistry> = keyof Kinds & string;

/**
 * The content of an annotation of kind `K` of a registry, every kind by
 * default.
 *
 * **Example** (Type a Mention)
 *
 * ```ts
 * import type { Annotation } from "@beep/annotation/Kind"
 * import type { DocumentKinds } from "@beep/annotation/Kinds"
 *
 * const classOf = (mention: Annotation<typeof DocumentKinds, "Mention">) => mention.body.class
 * console.log(typeof classOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Annotation<
  Kinds extends KindRegistry,
  K extends KindName<Kinds> = KindName<Kinds>,
> = Kinds[K]["case"]["Type"];

/**
 * Declare one annotation kind. The content case's `_tag` is the kind name, and
 * the annotation id hashes the kind IRI.
 *
 * **Example** (Declare a chunk kind)
 *
 * ```ts import.meta.vitest name="Declare a chunk kind"
 * import { AnnotationTargets } from "@beep/annotation/AnnotationId"
 * import { defineKind } from "@beep/annotation/Kind"
 * import { TermIri } from "@beep/identity/Term"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const Chunk = defineKind({
 *   name: "Chunk",
 *   iri: TermIri.make("https://example.org/kinds/Chunk"),
 *   body: S.Struct({ ordinal: S.Natural }),
 *   references: [],
 *   referencedIds: () => A.empty(),
 * })
 * Chunk.case.make({ targets: S.decodeUnknownSync(AnnotationTargets)([
 *   "sha256:68270708e021dadff3752f9e0d36a435565fdb6015bf7c1cc16e4e9024c54a48",
 * ]), body: { ordinal: 0 } })._tag // => "Chunk"
 * O.isNone(Chunk.level) // => true
 * ```
 *
 * @param spec - The kind's name, term, body schema, references and optional containment level.
 * @returns The kind with its content case.
 * @category constructors
 * @since 0.0.0
 */
export const defineKind = <const Name extends string, Body extends KindBody, const Refs extends string = never>(spec: {
  readonly name: Name;
  readonly iri: TermIri;
  readonly body: Body;
  readonly references: ReadonlyArray<Refs>;
  readonly referencedIds: (body: Body["Type"]) => Iterable<AnnotationId>;
  readonly level?: number;
}): AnnotationKind<Name, Body, Refs> => ({
  name: spec.name,
  iri: spec.iri,
  body: spec.body,
  references: spec.references,
  referencedIds: spec.referencedIds,
  level: O.fromUndefinedOr(spec.level),
  case: S.TaggedStruct(spec.name, { targets: AnnotationTargets, body: spec.body }),
});

// The kind-independent shape every content case of every registry has.
type AnnotationShape = {
  readonly _tag: string;
  readonly targets: HashSet.HashSet<OccurrenceId>;
  readonly body: unknown;
};

/**
 * Mint the content id of an annotation of a registry: its body through its
 * kind's JSON codec, then the `annotation/v1` preimage of its target set, its
 * kind IRI and that body.
 *
 * **Details**
 *
 * Requires core's `Digest.Digest` service. A body that its kind cannot encode
 * fails with the preimage's schema error.
 *
 * **Gotchas**
 *
 * A tag outside the registry dies: a document's annotation union is closed
 * over its registry, so such an annotation is a construction defect, not an
 * input to refuse.
 *
 * **Example** (Mint the annotation golden)
 *
 * ```ts
 * import { mintAnnotationId } from "@beep/annotation/Kind"
 * import { DocumentKinds, Mention } from "@beep/annotation/Kinds"
 * import { TermIri } from "@beep/identity/Term"
 * import { OccurrenceId } from "@beep/text/Occurrence"
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 * import * as HashSet from "effect/HashSet"
 *
 * const id = mintAnnotationId(DocumentKinds)(
 *   DocumentKinds.Mention.case.make({
 *     targets: HashSet.make(
 *       OccurrenceId.make("sha256:68270708e021dadff3752f9e0d36a435565fdb6015bf7c1cc16e4e9024c54a48")
 *     ),
 *     body: Mention.make({ class: TermIri.make("https://beep-effect.com/ns/office-action/distinction") }),
 *   })
 * ).pipe(Effect.provide(Digest.layerWebCrypto))
 * console.log(typeof id)
 * ```
 *
 * @param kinds - The registry the annotation's kind belongs to.
 * @returns A minting function over that registry.
 * @category constructors
 * @since 0.0.0
 */
export const mintAnnotationId = (kinds: KindRegistry) => {
  // One JSON body encoder per kind, compiled once per registry.
  const encoders = R.map(kinds, (kind) => ({
    iri: kind.iri,
    encode: S.encodeUnknownEffect(S.toCodecJson(kind.body)),
  }));
  return Effect.fn("Annotation.mint")(function* (
    annotation: AnnotationShape
  ): Effect.fn.Return<AnnotationId, PreimageMintError, Digest.Digest> {
    const kind = yield* R.get(encoders, annotation._tag).pipe(Effect.fromOption, Effect.orDie);
    const body = yield* kind.encode(annotation.body);
    const hash = yield* AnnotationPreimage.mint([annotation.targets, kind.iri, body]);
    return AnnotationId.make(hash);
  });
};
