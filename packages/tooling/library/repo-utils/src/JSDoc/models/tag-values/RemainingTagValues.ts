/**
 * Remaining JSDoc tag occurrence shapes.
 *
 * @packageDocumentation
 * @category models
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { empty, nameField, optionalDesc, optionalName } from "./_fields.ts";

const $I = $RepoUtilsId.create("JSDoc/models/tag-values/RemainingTagValues");

/**
 * Schema-backed value for a parsed `alias` tag occurrence: an alias name for the symbol.
 *
 * @example
 * ```ts
 * import { AliasValue } from "@beep/repo-utils/JSDoc/models/tag-values/RemainingTagValues"
 *
 * const tag = AliasValue.make({ name: "parse" })
 * const tagName: "alias" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AliasValue extends S.TaggedClass<AliasValue>($I`AliasValue`)(
  "alias",
  { ...nameField },
  $I.annote("AliasValue", {
    description: "Occurrence shape for @alias — an alias name for the symbol.",
  })
) {}

/**
 * Schema-backed value for a parsed `borrows` tag occurrence: copies documentation from another symbol.
 *
 * @example
 * ```ts
 * import { BorrowsValue } from "@beep/repo-utils/JSDoc/models/tag-values/RemainingTagValues"
 *
 * const tag = BorrowsValue.make({ name: "Base#parse" })
 * const tagName: "borrows" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class BorrowsValue extends S.TaggedClass<BorrowsValue>($I`BorrowsValue`)(
  "borrows",
  { ...nameField },
  $I.annote("BorrowsValue", {
    description: "Occurrence shape for @borrows — copies documentation from another symbol.",
  })
) {}

/**
 * Schema-backed value for a parsed `classdesc` tag occurrence: class-level description.
 *
 * @example
 * ```ts
 * import { ClassdescValue } from "@beep/repo-utils/JSDoc/models/tag-values/RemainingTagValues"
 *
 * const tag = ClassdescValue.make({ description: "Coordinates parsed tag metadata." })
 * const tagName: "classdesc" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ClassdescValue extends S.TaggedClass<ClassdescValue>($I`ClassdescValue`)(
  "classdesc",
  { ...optionalDesc },
  $I.annote("ClassdescValue", {
    description: "Occurrence shape for @classdesc — class-level description.",
  })
) {}

/**
 * Schema-backed value for a parsed `constructs` tag occurrence: marks a function as a constructor.
 *
 * @example
 * ```ts
 * import { ConstructsValue } from "@beep/repo-utils/JSDoc/models/tag-values/RemainingTagValues"
 *
 * const tag = ConstructsValue.make({ name: "Parser" })
 * const tagName: "constructs" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ConstructsValue extends S.TaggedClass<ConstructsValue>($I`ConstructsValue`)(
  "constructs",
  { ...optionalName },
  $I.annote("ConstructsValue", {
    description: "Occurrence shape for @constructs — marks a function as a constructor.",
  })
) {}

/**
 * Schema-backed value for a parsed `copyright` tag occurrence: copyright information.
 *
 * @example
 * ```ts
 * import { CopyrightValue } from "@beep/repo-utils/JSDoc/models/tag-values/RemainingTagValues"
 *
 * const tag = CopyrightValue.make({ description: "Copyright 2026 Beep" })
 * const tagName: "copyright" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CopyrightValue extends S.TaggedClass<CopyrightValue>($I`CopyrightValue`)(
  "copyright",
  { ...optionalDesc },
  $I.annote("CopyrightValue", {
    description: "Occurrence shape for @copyright — copyright information.",
  })
) {}

/**
 * Schema-backed value for a parsed `license` tag occurrence: license information.
 *
 * @example
 * ```ts
 * import { LicenseValue } from "@beep/repo-utils/JSDoc/models/tag-values/RemainingTagValues"
 *
 * const tag = LicenseValue.make({ description: "Apache-2.0" })
 * const tagName: "license" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class LicenseValue extends S.TaggedClass<LicenseValue>($I`LicenseValue`)(
  "license",
  { ...optionalDesc },
  $I.annote("LicenseValue", {
    description: "Occurrence shape for @license — license information.",
  })
) {}

/**
 * Schema-backed value for a parsed `external` tag occurrence: documents an external symbol.
 *
 * @example
 * ```ts
 * import { ExternalValue } from "@beep/repo-utils/JSDoc/models/tag-values/RemainingTagValues"
 *
 * const tag = ExternalValue.make({
 *   name: "external:Package",
 *   description: "Parsed tag text."
 * })
 * const tagName: "external" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ExternalValue extends S.TaggedClass<ExternalValue>($I`ExternalValue`)(
  "external",
  { ...optionalName, ...optionalDesc },
  $I.annote("ExternalValue", {
    description: "Occurrence shape for @external — documents an external symbol.",
  })
) {}

/**
 * Schema-backed value for a parsed `file` tag occurrence: file-level documentation.
 *
 * @example
 * ```ts
 * import { FileValue } from "@beep/repo-utils/JSDoc/models/tag-values/RemainingTagValues"
 *
 * const tag = FileValue.make({ description: "Package entry point." })
 * const tagName: "file" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class FileValue extends S.TaggedClass<FileValue>($I`FileValue`)(
  "file",
  { ...optionalDesc },
  $I.annote("FileValue", {
    description: "Occurrence shape for @file — file-level documentation.",
  })
) {}

/**
 * Schema-backed value for a parsed `global` tag occurrence: marks a symbol as global.
 *
 * @example
 * ```ts
 * import { GlobalValue } from "@beep/repo-utils/JSDoc/models/tag-values/RemainingTagValues"
 *
 * const tag = GlobalValue.make({})
 * const tagName: "global" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class GlobalValue extends S.TaggedClass<GlobalValue>($I`GlobalValue`)(
  "global",
  empty,
  $I.annote("GlobalValue", {
    description: "Occurrence shape for @global — marks a symbol as global.",
  })
) {}

/**
 * Schema-backed value for a parsed `hideconstructor` tag occurrence: hides the constructor from docs.
 *
 * @example
 * ```ts
 * import { HideconstructorValue } from "@beep/repo-utils/JSDoc/models/tag-values/RemainingTagValues"
 *
 * const tag = HideconstructorValue.make({})
 * const tagName: "hideconstructor" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class HideconstructorValue extends S.TaggedClass<HideconstructorValue>($I`HideconstructorValue`)(
  "hideconstructor",
  empty,
  $I.annote("HideconstructorValue", {
    description: "Occurrence shape for @hideconstructor — hides the constructor from docs.",
  })
) {}

/**
 * Schema-backed value for a parsed `ignore` tag occurrence: excludes the symbol from documentation.
 *
 * @example
 * ```ts
 * import { IgnoreValue } from "@beep/repo-utils/JSDoc/models/tag-values/RemainingTagValues"
 *
 * const tag = IgnoreValue.make({})
 * const tagName: "ignore" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class IgnoreValue extends S.TaggedClass<IgnoreValue>($I`IgnoreValue`)(
  "ignore",
  empty,
  $I.annote("IgnoreValue", {
    description: "Occurrence shape for @ignore — excludes the symbol from documentation.",
  })
) {}

/**
 * Schema-backed value for a parsed `inner` tag occurrence: marks a symbol as an inner member.
 *
 * @example
 * ```ts
 * import { InnerValue } from "@beep/repo-utils/JSDoc/models/tag-values/RemainingTagValues"
 *
 * const tag = InnerValue.make({})
 * const tagName: "inner" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class InnerValue extends S.TaggedClass<InnerValue>($I`InnerValue`)(
  "inner",
  empty,
  $I.annote("InnerValue", {
    description: "Occurrence shape for @inner — marks a symbol as an inner member.",
  })
) {}

/**
 * Schema-backed value for a parsed `instance` tag occurrence: marks a symbol as an instance member.
 *
 * @example
 * ```ts
 * import { InstanceValue } from "@beep/repo-utils/JSDoc/models/tag-values/RemainingTagValues"
 *
 * const tag = InstanceValue.make({})
 * const tagName: "instance" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class InstanceValue extends S.TaggedClass<InstanceValue>($I`InstanceValue`)(
  "instance",
  empty,
  $I.annote("InstanceValue", {
    description: "Occurrence shape for @instance — marks a symbol as an instance member.",
  })
) {}

/**
 * Schema-backed value for a parsed `kind` tag occurrence: specifies the kind of symbol.
 *
 * @example
 * ```ts
 * import { KindValue } from "@beep/repo-utils/JSDoc/models/tag-values/RemainingTagValues"
 *
 * const tag = KindValue.make({ kindValue: "function" })
 * const tagName: "kind" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class KindValue extends S.TaggedClass<KindValue>($I`KindValue`)(
  "kind",
  {
    kindValue: S.Literals([
      "class",
      "constant",
      "event",
      "external",
      "file",
      "function",
      "member",
      "mixin",
      "module",
      "namespace",
      "typedef",
    ]),
  },
  $I.annote("KindValue", {
    description: "Occurrence shape for @kind — specifies the kind of symbol.",
  })
) {}

/**
 * Schema-backed value for a parsed `lends` tag occurrence: documents lending to another symbol.
 *
 * @example
 * ```ts
 * import { LendsValue } from "@beep/repo-utils/JSDoc/models/tag-values/RemainingTagValues"
 *
 * const tag = LendsValue.make({ name: "Parser.prototype" })
 * const tagName: "lends" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class LendsValue extends S.TaggedClass<LendsValue>($I`LendsValue`)(
  "lends",
  { ...nameField },
  $I.annote("LendsValue", {
    description: "Occurrence shape for @lends — documents lending to another symbol.",
  })
) {}

/**
 * Schema-backed value for a parsed `mixin` tag occurrence: marks a symbol as a mixin.
 *
 * @example
 * ```ts
 * import { MixinValue } from "@beep/repo-utils/JSDoc/models/tag-values/RemainingTagValues"
 *
 * const tag = MixinValue.make({ name: "Disposable" })
 * const tagName: "mixin" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class MixinValue extends S.TaggedClass<MixinValue>($I`MixinValue`)(
  "mixin",
  { ...optionalName },
  $I.annote("MixinValue", {
    description: "Occurrence shape for @mixin — marks a symbol as a mixin.",
  })
) {}

/**
 * Schema-backed value for a parsed `mixes` tag occurrence: documents mixin inclusion.
 *
 * @example
 * ```ts
 * import { MixesValue } from "@beep/repo-utils/JSDoc/models/tag-values/RemainingTagValues"
 *
 * const tag = MixesValue.make({ name: "Disposable" })
 * const tagName: "mixes" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class MixesValue extends S.TaggedClass<MixesValue>($I`MixesValue`)(
  "mixes",
  { ...nameField },
  $I.annote("MixesValue", {
    description: "Occurrence shape for @mixes — documents mixin inclusion.",
  })
) {}

/**
 * Schema-backed value for a parsed `name` tag occurrence: overrides the documented name.
 *
 * @example
 * ```ts
 * import { NameValue } from "@beep/repo-utils/JSDoc/models/tag-values/RemainingTagValues"
 *
 * const tag = NameValue.make({ name: "parseTag" })
 * const tagName: "name" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NameValue extends S.TaggedClass<NameValue>($I`NameValue`)(
  "name",
  { ...nameField },
  $I.annote("NameValue", {
    description: "Occurrence shape for @name — overrides the documented name.",
  })
) {}

/**
 * Schema-backed value for a parsed `variation` tag occurrence: distinguishes overloaded symbols.
 *
 * @example
 * ```ts
 * import { VariationValue } from "@beep/repo-utils/JSDoc/models/tag-values/RemainingTagValues"
 *
 * const tag = VariationValue.make({})
 * const tagName: "variation" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class VariationValue extends S.TaggedClass<VariationValue>($I`VariationValue`)(
  "variation",
  empty,
  $I.annote("VariationValue", {
    description: "Occurrence shape for @variation — distinguishes overloaded symbols.",
  })
) {}

/**
 * Schema-backed value for a parsed `tutorial` tag occurrence: links to a tutorial.
 *
 * @example
 * ```ts
 * import { TutorialValue } from "@beep/repo-utils/JSDoc/models/tag-values/RemainingTagValues"
 *
 * const tag = TutorialValue.make({ name: "getting-started" })
 * const tagName: "tutorial" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class TutorialValue extends S.TaggedClass<TutorialValue>($I`TutorialValue`)(
  "tutorial",
  { ...nameField },
  $I.annote("TutorialValue", {
    description: "Occurrence shape for @tutorial — links to a tutorial.",
  })
) {}
