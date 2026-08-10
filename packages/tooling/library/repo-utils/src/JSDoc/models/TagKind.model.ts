/**
 * JSDoc metadata models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $RepoUtilsId.create("JSDoc/models/TagKind.model");

/**
 * Classifies a tag by its syntactic placement in documentation text.
 *
 * **Example** (Check block TagKind)
 *
 * ```ts
 * import { TagKind } from "@beep/repo-utils/JSDoc/models/TagKind.model"
 *
 * const kind = TagKind.Enum.block
 * console.log(TagKind.is.block(kind))
 * ```
 *
 * @description The syntactic form of the tag
 * @category models
 * @since 0.0.0
 */
export const TagKind = LiteralKit([
  // @tag content... (top-level, content until next block/modifier tag)
  "block",
  // {@tag content} (embedded within other content)
  "inline",
  // @tag (no content, indicates a quality/flag)
  "modifier",
]).pipe(
  $I.annoteSchema("TagKind", {
    description: "The kind of tag",
  })
);

/**
 * Union of supported documentation tag placement kinds.
 *
 * **Example** (Use TagKind as type)
 *
 * ```ts
 * import type { TagKind } from "@beep/repo-utils/JSDoc/models/TagKind.model"
 * type Example = TagKind
 * const accept = <A extends Example>(value: A): A => value
 * console.log(accept)
 * ```
 *
 * @description The syntactic form of the tag
 * @category models
 * @since 0.0.0
 */
export type TagKind = typeof TagKind.Type;
