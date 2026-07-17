/**
 * TypeDoc-specific tag occurrence shapes.
 *
 * @packageDocumentation
 * @category models
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { TSCategoryTag } from "../TSCategory.model.ts";
import { empty, nameField } from "./_fields.ts";

const $I = $RepoUtilsId.create("JSDoc/models/tag-values/TypeDocTagValues");

/**
 * Schema-backed value for a parsed `category` tag occurrence: assigns a documentation category.
 *
 * @example
 * ```ts
 * import { CategoryValue } from "@beep/repo-utils/JSDoc/models/tag-values/TypeDocTagValues"
 *
 * const tag = CategoryValue.make({ name: "Utility" })
 * const tagName: "category" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CategoryValue extends S.TaggedClass<CategoryValue>($I`CategoryValue`)(
  "category",
  { name: TSCategoryTag },
  $I.annote("CategoryValue", {
    description: "Occurrence shape for @category — assigns a documentation category.",
  })
) {}

/**
 * Schema-backed value for a parsed `document` tag occurrence: marks for documentation generation.
 *
 * @example
 * ```ts
 * import { DocumentValue } from "@beep/repo-utils/JSDoc/models/tag-values/TypeDocTagValues"
 *
 * const tag = DocumentValue.make({})
 * const tagName: "document" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DocumentValue extends S.TaggedClass<DocumentValue>($I`DocumentValue`)(
  "document",
  empty,
  $I.annote("DocumentValue", {
    description: "Occurrence shape for @document — marks for documentation generation.",
  })
) {}

/**
 * Schema-backed value for a parsed `group` tag occurrence: assigns a documentation group.
 *
 * @example
 * ```ts
 * import { GroupValue } from "@beep/repo-utils/JSDoc/models/tag-values/TypeDocTagValues"
 *
 * const tag = GroupValue.make({ name: "Parsing" })
 * const tagName: "group" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class GroupValue extends S.TaggedClass<GroupValue>($I`GroupValue`)(
  "group",
  { ...nameField },
  $I.annote("GroupValue", {
    description: "Occurrence shape for @group — assigns a documentation group.",
  })
) {}

/**
 * Schema-backed value for a parsed `hidden` tag occurrence: hides the symbol from documentation.
 *
 * @example
 * ```ts
 * import { HiddenValue } from "@beep/repo-utils/JSDoc/models/tag-values/TypeDocTagValues"
 *
 * const tag = HiddenValue.make({})
 * const tagName: "hidden" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class HiddenValue extends S.TaggedClass<HiddenValue>($I`HiddenValue`)(
  "hidden",
  empty,
  $I.annote("HiddenValue", {
    description: "Occurrence shape for @hidden — hides the symbol from documentation.",
  })
) {}

/**
 * Schema-backed value for a parsed `expand` tag occurrence: expands type aliases in documentation.
 *
 * @example
 * ```ts
 * import { ExpandValue } from "@beep/repo-utils/JSDoc/models/tag-values/TypeDocTagValues"
 *
 * const tag = ExpandValue.make({})
 * const tagName: "expand" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ExpandValue extends S.TaggedClass<ExpandValue>($I`ExpandValue`)(
  "expand",
  empty,
  $I.annote("ExpandValue", {
    description: "Occurrence shape for @expand — expands type aliases in documentation.",
  })
) {}

/**
 * Schema-backed value for a parsed `inline` tag occurrence: inlines a type in documentation.
 *
 * @example
 * ```ts
 * import { InlineValue } from "@beep/repo-utils/JSDoc/models/tag-values/TypeDocTagValues"
 *
 * const tag = InlineValue.make({})
 * const tagName: "inline" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class InlineValue extends S.TaggedClass<InlineValue>($I`InlineValue`)(
  "inline",
  empty,
  $I.annote("InlineValue", {
    description: "Occurrence shape for @inline — inlines a type in documentation.",
  })
) {}

/**
 * Schema-backed value for a parsed `mergeModuleWith` tag occurrence: merges module documentation.
 *
 * @example
 * ```ts
 * import { MergeModuleWithValue } from "@beep/repo-utils/JSDoc/models/tag-values/TypeDocTagValues"
 *
 * const tag = MergeModuleWithValue.make({ name: "@beep/repo-utils" })
 * const tagName: "mergeModuleWith" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class MergeModuleWithValue extends S.TaggedClass<MergeModuleWithValue>($I`MergeModuleWithValue`)(
  "mergeModuleWith",
  { ...nameField },
  $I.annote("MergeModuleWithValue", {
    description: "Occurrence shape for @mergeModuleWith — merges module documentation.",
  })
) {}

/**
 * Schema-backed value for a parsed `primaryExport` tag occurrence: marks the primary export.
 *
 * @example
 * ```ts
 * import { PrimaryExportValue } from "@beep/repo-utils/JSDoc/models/tag-values/TypeDocTagValues"
 *
 * const tag = PrimaryExportValue.make({})
 * const tagName: "primaryExport" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class PrimaryExportValue extends S.TaggedClass<PrimaryExportValue>($I`PrimaryExportValue`)(
  "primaryExport",
  empty,
  $I.annote("PrimaryExportValue", {
    description: "Occurrence shape for @primaryExport — marks the primary export.",
  })
) {}

/**
 * Schema-backed value for a parsed `sortStrategy` tag occurrence: specifies documentation sort order.
 *
 * @example
 * ```ts
 * import { SortStrategyValue } from "@beep/repo-utils/JSDoc/models/tag-values/TypeDocTagValues"
 *
 * const tag = SortStrategyValue.make({ name: "source-order" })
 * const tagName: "sortStrategy" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SortStrategyValue extends S.TaggedClass<SortStrategyValue>($I`SortStrategyValue`)(
  "sortStrategy",
  { ...nameField },
  $I.annote("SortStrategyValue", {
    description: "Occurrence shape for @sortStrategy — specifies documentation sort order.",
  })
) {}

/**
 * Schema-backed value for a parsed `useDeclaredType` tag occurrence: uses declared type in docs.
 *
 * @example
 * ```ts
 * import { UseDeclaredTypeValue } from "@beep/repo-utils/JSDoc/models/tag-values/TypeDocTagValues"
 *
 * const tag = UseDeclaredTypeValue.make({})
 * const tagName: "useDeclaredType" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class UseDeclaredTypeValue extends S.TaggedClass<UseDeclaredTypeValue>($I`UseDeclaredTypeValue`)(
  "useDeclaredType",
  empty,
  $I.annote("UseDeclaredTypeValue", {
    description: "Occurrence shape for @useDeclaredType — uses declared type in docs.",
  })
) {}
