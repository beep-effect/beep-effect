/**
 * Inline tag occurrence shapes.
 *
 * @packageDocumentation
 * @category models
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { optionalDesc, optionalName } from "./_fields.ts";

const $I = $RepoUtilsId.create("JSDoc/models/tag-values/InlineTagValues");

/**
 * Schema-backed value for a parsed `link` tag occurrence: an inline link to another symbol.
 *
 * **Example** (Create LinkValue instance)
 *
 * ```ts
 * import { LinkValue } from "@beep/repo-utils/JSDoc/models/tag-values/InlineTagValues"
 *
 * const tag = LinkValue.make({
 *   name: "TagValue",
 *   description: "Parsed tag text."
 * })
 * const tagName: "link" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LinkValue extends S.TaggedClass<LinkValue>($I`LinkValue`)(
  "link",
  { ...optionalName, ...optionalDesc },
  $I.annote("LinkValue", {
    description: "Occurrence shape for @link — an inline link to another symbol.",
  })
) {}

/**
 * Schema-backed value for a parsed `inheritDoc` tag occurrence: inherits documentation from a parent.
 *
 * **Example** (Create InheritDocValue instance)
 *
 * ```ts
 * import { InheritDocValue } from "@beep/repo-utils/JSDoc/models/tag-values/InlineTagValues"
 *
 * const tag = InheritDocValue.make({ name: "BaseTag" })
 * const tagName: "inheritDoc" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InheritDocValue extends S.TaggedClass<InheritDocValue>($I`InheritDocValue`)(
  "inheritDoc",
  { ...optionalName },
  $I.annote("InheritDocValue", {
    description: "Occurrence shape for @inheritDoc — inherits documentation from a parent.",
  })
) {}
