/**
 * Shared type helpers for the JSDoc tag metadata catalog modules.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import type { JSDocTagDefinition } from "./models/index.ts";

/**
 * Instance shape shared by every catalog tag schema: the tag definition
 * fields without the brand, narrowed to a literal `_tag`.
 *
 * **Example** (Describe a param tag member)
 *
 * ```ts
 * import type { JSDocTagMember } from "@beep/repo-utils/JSDoc/JSDoc.shared"
 *
 * const tagOf = (member: JSDocTagMember<"param">): "param" => member._tag
 * console.log(typeof tagOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type JSDocTagMember<Tag extends string> = Omit<JSDocTagDefinition.JSDocTagDefinition, "brand"> & {
  readonly _tag: Tag;
};
