/**
 * Annotation and run-entity identity: the two content hashes of an annotation
 * document and the preimages they are minted from.
 *
 * **Details**
 *
 * An {@link AnnotationId} is minted under `annotation/v1` over the
 * annotation's target set, its kind IRI and its body encoded by the kind's
 * JSON codec. The target set encodes as its ascending member array, so the id
 * ignores target order and duplication. A {@link RunEntityId} is minted under
 * `generation/v1` over one (content, activity) pair: the run-specific entity
 * one activity generated, a `prov:specializationOf` the content.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AnnotationId } from "@beep/identity/packages";
import { iri } from "@beep/identity/Registry";
import { TermIri } from "@beep/identity/Term";
import { definePreimage } from "@beep/jsonc/Mint";
import { CanonicalHashSet } from "@beep/schema/CanonicalHashSet";
import { ActivityId, ContentHash, DomainTag } from "@beep/schema/ContentHash";
import { OccurrenceId } from "@beep/text/Occurrence";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";

const $I = $AnnotationId.create("AnnotationId");

/**
 * Content id of one annotation, encoded `sha256:<64 hex>`. Attribution is
 * outside it: two activities that read the same content mint the same id.
 *
 * **Example** (Check an annotation id)
 *
 * ```ts import.meta.vitest name="Check an annotation id"
 * import { AnnotationId } from "@beep/annotation/AnnotationId"
 * import * as S from "effect/Schema"
 *
 * S.is(AnnotationId)("sha256:8a816f6d07f571cb31aba23d9650d0cb67c72ce6832c12b6c89f388b6fd9ddb9") // => true
 * S.is(AnnotationId)("8a816f6d") // => false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const AnnotationId = ContentHash.pipe(
  S.brand("AnnotationId"),
  $I.annoteSchema("AnnotationId", {
    description: "Content hash of one annotation: its target set, kind IRI and encoded body.",
  })
);

/**
 * Type for {@link AnnotationId}.
 *
 * **Example** (Annotate an annotation id)
 *
 * ```ts
 * import { AnnotationId } from "@beep/annotation/AnnotationId"
 *
 * const id: AnnotationId = AnnotationId.make(
 *   "sha256:8a816f6d07f571cb31aba23d9650d0cb67c72ce6832c12b6c89f388b6fd9ddb9"
 * )
 * console.log(id)
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export type AnnotationId = typeof AnnotationId.Type;

/**
 * Id of the run-specific entity one activity generated for one annotation
 * content, encoded `sha256:<64 hex>`. It carries its own brand, so it never
 * stands in for the content id.
 *
 * **Example** (Check a run-entity id)
 *
 * ```ts import.meta.vitest name="Check a run-entity id"
 * import { RunEntityId } from "@beep/annotation/AnnotationId"
 * import * as S from "effect/Schema"
 *
 * S.is(RunEntityId)("sha256:e1303854ed5d9fddcba55d0d0ae4e4dd5d9ca20c4e4738e0ba643f5696575acd") // => true
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const RunEntityId = ContentHash.pipe(
  S.brand("RunEntityId"),
  $I.annoteSchema("RunEntityId", {
    description: "Content hash of one (annotation content, activity) pair: the generated run entity.",
  })
);

/**
 * Type for {@link RunEntityId}.
 *
 * **Example** (Annotate a run-entity id)
 *
 * ```ts
 * import { RunEntityId } from "@beep/annotation/AnnotationId"
 *
 * const run: RunEntityId = RunEntityId.make(
 *   "sha256:e1303854ed5d9fddcba55d0d0ae4e4dd5d9ca20c4e4738e0ba643f5696575acd"
 * )
 * console.log(run)
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export type RunEntityId = typeof RunEntityId.Type;

/**
 * The target set of an annotation: a non-empty `HashSet` of occurrence ids,
 * encoded as the ascending array of its members.
 *
 * **Details**
 *
 * Decoding takes an array in any order with repeats; encoding sorts and
 * deduplicates it, so the `annotation/v1` preimage sees one array per set.
 *
 * **Example** (Decode targets in any order)
 *
 * ```ts import.meta.vitest name="Decode targets in any order"
 * import { AnnotationTargets } from "@beep/annotation/AnnotationId"
 * import * as S from "effect/Schema"
 *
 * const b = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
 * const a = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
 * const targets = S.decodeUnknownSync(AnnotationTargets)([b, a, b])
 * S.encodeSync(AnnotationTargets)(targets).join(" ") === `${a} ${b}` // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AnnotationTargets = CanonicalHashSet(OccurrenceId)
  .check(
    S.makeFilter(
      (targets: HashSet.HashSet<OccurrenceId>) => !HashSet.isEmpty(targets),
      $I.annote("AnnotationTargetsNonEmpty", {
        title: "Annotation Targets Non-Empty",
        description: "A standoff annotation targets at least one occurrence.",
        message: "Expected at least one target.",
      })
    )
  )
  .pipe(
    $I.annoteSchema("AnnotationTargets", {
      description: "The non-empty occurrence set an annotation targets, encoded ascending.",
    })
  );

/**
 * The `annotation/v1` preimage: the target set, the kind IRI and the body as
 * the kind's JSON codec encodes it, with its committed golden vector.
 *
 * **Details**
 *
 * One preimage serves every kind, because the kind IRI separates the body
 * schemas. The golden's target is the `occurrence/v1` golden of `@beep/text`,
 * so the vectors chain. `AnnotationPreimage.mintResult(digest)` is the
 * synchronous twin the property generators use.
 *
 * **Example** (Read the domain tag)
 *
 * ```ts import.meta.vitest name="Read the annotation domain tag"
 * import { AnnotationPreimage } from "@beep/annotation/AnnotationId"
 *
 * AnnotationPreimage.domainTag // => "annotation/v1"
 * AnnotationPreimage.golden.preimage.length // => 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AnnotationPreimage = definePreimage({
  domainTag: DomainTag.make("annotation/v1"),
  schema: S.Tuple([AnnotationTargets, TermIri, S.Unknown]),
  golden: {
    preimage: [
      ["sha256:68270708e021dadff3752f9e0d36a435565fdb6015bf7c1cc16e4e9024c54a48"],
      iri("annotation:Mention"),
      { class: iri("office-action:distinction") },
    ],
    hash: ContentHash.make("sha256:8a816f6d07f571cb31aba23d9650d0cb67c72ce6832c12b6c89f388b6fd9ddb9"),
  },
});

/**
 * The `generation/v1` preimage over one (annotation content, activity) pair,
 * with its committed golden vector.
 *
 * **Details**
 *
 * The golden pairs the `annotation/v1` golden with the `activity/v1` golden of
 * `@beep/jsonc`. `GenerationPreimage.mintResult(digest)` is the synchronous
 * twin the property generators use.
 *
 * **Example** (Read the domain tag)
 *
 * ```ts import.meta.vitest name="Read the generation domain tag"
 * import { GenerationPreimage } from "@beep/annotation/AnnotationId"
 *
 * GenerationPreimage.domainTag // => "generation/v1"
 * GenerationPreimage.golden.preimage.length // => 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GenerationPreimage = definePreimage({
  domainTag: DomainTag.make("generation/v1"),
  schema: S.Tuple([AnnotationId, ActivityId]),
  golden: {
    preimage: [
      "sha256:8a816f6d07f571cb31aba23d9650d0cb67c72ce6832c12b6c89f388b6fd9ddb9",
      "sha256:2a2b259a63e6402ee336c2e1d4f1023b98bee9880bfa586fface844bca277388",
    ],
    hash: ContentHash.make("sha256:e1303854ed5d9fddcba55d0d0ae4e4dd5d9ca20c4e4738e0ba643f5696575acd"),
  },
});
