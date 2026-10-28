/**
 * Versioned document-local citation identities, separate from persisted entities.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/Citation/Citation.identity");

/**
 * Opaque identity of one citation occurrence within a source version.
 *
 * **Details**
 *
 * Validates the versioned token, not source evidence or the producer's digest
 * inputs. The engine producer must bind the source version, engine artifact,
 * verified anchor and semantic discriminant. Consumers compare tokens without
 * parsing them. Persisted citation entities use the shared LawPractice ID.
 *
 * **Example** (Construct a mention token)
 *
 * ```ts
 * import { CitationMentionId } from "@beep/law-practice-domain/values"
 *
 * const id = CitationMentionId.make("cm1:0000000000000000000000000000000000000000000000000000000000000000")
 * console.log(id.length) // 68
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CitationMentionId = S.TemplateLiteral(["cm1:", Sha256Hex]).pipe(
  S.brand("CitationMentionId"),
  $I.annoteSchema("CitationMentionId", {
    description:
      "Version-one document-local occurrence token; its digest producer must bind source, engine, verified anchor and semantic kind.",
  })
);

/**
 * Schema-derived citation occurrence identity.
 *
 * @category models
 * @since 0.0.0
 */
export type CitationMentionId = typeof CitationMentionId.Type;

/**
 * Opaque identity of an authority group within one citation document.
 *
 * **Details**
 *
 * The producer must hash the versioned semantic authority key, preserving
 * frozen authority distinctions even when vocabulary aliases share a current
 * public reporter identity. This schema validates the token only. It does not
 * identify a persisted citation entity or prove authority resolution.
 *
 * **Example** (Construct an authority token)
 *
 * ```ts
 * import { CitationAuthorityId } from "@beep/law-practice-domain/values"
 *
 * const id = CitationAuthorityId.make("ca1:0000000000000000000000000000000000000000000000000000000000000000")
 * console.log(id.length) // 68
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CitationAuthorityId = S.TemplateLiteral(["ca1:", Sha256Hex]).pipe(
  S.brand("CitationAuthorityId"),
  $I.annoteSchema("CitationAuthorityId", {
    description:
      "Version-one document-local authority token; separate from occurrence tokens and persisted citation entity identity.",
  })
);

/**
 * Schema-derived document-local authority identity.
 *
 * @category models
 * @since 0.0.0
 */
export type CitationAuthorityId = typeof CitationAuthorityId.Type;
