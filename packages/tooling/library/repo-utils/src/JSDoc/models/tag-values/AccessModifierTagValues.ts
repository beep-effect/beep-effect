/**
 * Access modifier tag occurrence shapes.
 *
 * @packageDocumentation
 * @category models
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { empty, nameField, optionalDesc, optionalName, optionalType } from "./_fields.ts";

const $I = $RepoUtilsId.create("JSDoc/models/tag-values/AccessModifierTagValues");

/**
 * Schema-backed value for a parsed `access` tag occurrence: specifies the access level.
 *
 * **Example** (Make access tag with level)
 *
 * ```ts
 * import { AccessValue } from "@beep/repo-utils/JSDoc/models/tag-values/AccessModifierTagValues"
 *
 * const tag = AccessValue.make({ level: "public" })
 * const tagName: "access" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AccessValue extends S.TaggedClass<AccessValue>($I`AccessValue`)(
  "access",
  {
    level: S.Literals(["public", "private", "protected", "package"]),
  },
  $I.annote("AccessValue", {
    description: "Occurrence shape for @access — specifies the access level.",
  })
) {}

/**
 * Schema-backed value for a parsed `public` tag occurrence: marks a symbol as public.
 *
 * **Example** (Make empty public tag)
 *
 * ```ts
 * import { PublicValue } from "@beep/repo-utils/JSDoc/models/tag-values/AccessModifierTagValues"
 *
 * const tag = PublicValue.make({})
 * const tagName: "public" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PublicValue extends S.TaggedClass<PublicValue>($I`PublicValue`)(
  "public",
  empty,
  $I.annote("PublicValue", {
    description: "Occurrence shape for @public — marks a symbol as public.",
  })
) {}

/**
 * Schema-backed value for a parsed `private` tag occurrence: marks a symbol as private.
 *
 * **Example** (Make empty private tag)
 *
 * ```ts
 * import { PrivateValue } from "@beep/repo-utils/JSDoc/models/tag-values/AccessModifierTagValues"
 *
 * const tag = PrivateValue.make({})
 * const tagName: "private" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PrivateValue extends S.TaggedClass<PrivateValue>($I`PrivateValue`)(
  "private",
  empty,
  $I.annote("PrivateValue", {
    description: "Occurrence shape for @private — marks a symbol as private.",
  })
) {}

/**
 * Schema-backed value for a parsed `protected` tag occurrence: marks a symbol as protected.
 *
 * **Example** (Make empty protected tag)
 *
 * ```ts
 * import { ProtectedValue } from "@beep/repo-utils/JSDoc/models/tag-values/AccessModifierTagValues"
 *
 * const tag = ProtectedValue.make({})
 * const tagName: "protected" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProtectedValue extends S.TaggedClass<ProtectedValue>($I`ProtectedValue`)(
  "protected",
  empty,
  $I.annote("ProtectedValue", {
    description: "Occurrence shape for @protected — marks a symbol as protected.",
  })
) {}

/**
 * Schema-backed value for a parsed `package` tag occurrence: marks a symbol as package-private.
 *
 * **Example** (Make empty package tag)
 *
 * ```ts
 * import { PackageValue } from "@beep/repo-utils/JSDoc/models/tag-values/AccessModifierTagValues"
 *
 * const tag = PackageValue.make({})
 * const tagName: "package" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PackageValue extends S.TaggedClass<PackageValue>($I`PackageValue`)(
  "package",
  empty,
  $I.annote("PackageValue", {
    description: "Occurrence shape for @package — marks a symbol as package-private.",
  })
) {}

/**
 * Schema-backed value for a parsed `readonly` tag occurrence: marks a symbol as read-only.
 *
 * **Example** (Make empty readonly tag)
 *
 * ```ts
 * import { ReadonlyValue } from "@beep/repo-utils/JSDoc/models/tag-values/AccessModifierTagValues"
 *
 * const tag = ReadonlyValue.make({})
 * const tagName: "readonly" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReadonlyValue extends S.TaggedClass<ReadonlyValue>($I`ReadonlyValue`)(
  "readonly",
  empty,
  $I.annote("ReadonlyValue", {
    description: "Occurrence shape for @readonly — marks a symbol as read-only.",
  })
) {}

/**
 * Schema-backed value for a parsed `abstract` tag occurrence: marks a symbol as abstract.
 *
 * **Example** (Make empty abstract tag)
 *
 * ```ts
 * import { AbstractValue } from "@beep/repo-utils/JSDoc/models/tag-values/AccessModifierTagValues"
 *
 * const tag = AbstractValue.make({})
 * const tagName: "abstract" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AbstractValue extends S.TaggedClass<AbstractValue>($I`AbstractValue`)(
  "abstract",
  empty,
  $I.annote("AbstractValue", {
    description: "Occurrence shape for @abstract — marks a symbol as abstract.",
  })
) {}

/**
 * Schema-backed value for a parsed `final` tag occurrence: marks a symbol as final.
 *
 * **Example** (Make empty final tag)
 *
 * ```ts
 * import { FinalValue } from "@beep/repo-utils/JSDoc/models/tag-values/AccessModifierTagValues"
 *
 * const tag = FinalValue.make({})
 * const tagName: "final" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FinalValue extends S.TaggedClass<FinalValue>($I`FinalValue`)(
  "final",
  empty,
  $I.annote("FinalValue", {
    description: "Occurrence shape for @final — marks a symbol as final.",
  })
) {}

/**
 * Schema-backed value for a parsed `override` tag occurrence: marks a method as overriding a parent.
 *
 * **Example** (Make empty override tag)
 *
 * ```ts
 * import { OverrideValue } from "@beep/repo-utils/JSDoc/models/tag-values/AccessModifierTagValues"
 *
 * const tag = OverrideValue.make({})
 * const tagName: "override" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OverrideValue extends S.TaggedClass<OverrideValue>($I`OverrideValue`)(
  "override",
  empty,
  $I.annote("OverrideValue", {
    description: "Occurrence shape for @override — marks a method as overriding a parent.",
  })
) {}

/**
 * Schema-backed value for a parsed `static` tag occurrence: marks a symbol as static.
 *
 * **Example** (Make empty static tag)
 *
 * ```ts
 * import { StaticValue } from "@beep/repo-utils/JSDoc/models/tag-values/AccessModifierTagValues"
 *
 * const tag = StaticValue.make({})
 * const tagName: "static" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StaticValue extends S.TaggedClass<StaticValue>($I`StaticValue`)(
  "static",
  empty,
  $I.annote("StaticValue", {
    description: "Occurrence shape for @static — marks a symbol as static.",
  })
) {}

/**
 * Schema-backed value for a parsed `constant` tag occurrence: marks a symbol as a constant.
 *
 * **Example** (Make constant with type name)
 *
 * ```ts
 * import { ConstantValue } from "@beep/repo-utils/JSDoc/models/tag-values/AccessModifierTagValues"
 *
 * const tag = ConstantValue.make({
 *   type: "number",
 *   name: "Example"
 * })
 * const tagName: "constant" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConstantValue extends S.TaggedClass<ConstantValue>($I`ConstantValue`)(
  "constant",
  { ...optionalType, ...optionalName },
  $I.annote("ConstantValue", {
    description: "Occurrence shape for @constant — marks a symbol as a constant.",
  })
) {}

/**
 * Schema-backed value for a parsed `default` tag occurrence: documents the default value.
 *
 * **Example** (Make default with description)
 *
 * ```ts
 * import { DefaultValue } from "@beep/repo-utils/JSDoc/models/tag-values/AccessModifierTagValues"
 *
 * const tag = DefaultValue.make({ description: "Defaults to false." })
 * const tagName: "default" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DefaultValue extends S.TaggedClass<DefaultValue>($I`DefaultValue`)(
  "default",
  { ...optionalDesc },
  $I.annote("DefaultValue", {
    description: "Occurrence shape for @default — documents the default value.",
  })
) {}

/**
 * Schema-backed value for a parsed `defaultValue` tag occurrence: TSDoc default value annotation.
 *
 * **Example** (Make defaultValue with description)
 *
 * ```ts
 * import { DefaultValueValue } from "@beep/repo-utils/JSDoc/models/tag-values/AccessModifierTagValues"
 *
 * const tag = DefaultValueValue.make({ description: "Defaults to false." })
 * const tagName: "defaultValue" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DefaultValueValue extends S.TaggedClass<DefaultValueValue>($I`DefaultValueValue`)(
  "defaultValue",
  { ...optionalDesc },
  $I.annote("DefaultValueValue", {
    description: "Occurrence shape for @defaultValue — TSDoc default value annotation.",
  })
) {}

/**
 * Schema-backed value for a parsed `exports` tag occurrence: documents the exported module name.
 *
 * **Example** (Make exports with module name)
 *
 * ```ts
 * import { ExportsValue } from "@beep/repo-utils/JSDoc/models/tag-values/AccessModifierTagValues"
 *
 * const tag = ExportsValue.make({ name: "@beep/repo-utils" })
 * const tagName: "exports" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExportsValue extends S.TaggedClass<ExportsValue>($I`ExportsValue`)(
  "exports",
  { ...nameField },
  $I.annote("ExportsValue", {
    description: "Occurrence shape for @exports — documents the exported module name.",
  })
) {}

/**
 * Schema-backed value for a parsed `export` tag occurrence: marks a symbol for export.
 *
 * **Example** (Make export with type)
 *
 * ```ts
 * import { ExportValue } from "@beep/repo-utils/JSDoc/models/tag-values/AccessModifierTagValues"
 *
 * const tag = ExportValue.make({ type: "typeof Parser" })
 * const tagName: "export" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExportValue extends S.TaggedClass<ExportValue>($I`ExportValue`)(
  "export",
  { ...optionalType },
  $I.annote("ExportValue", {
    description: "Occurrence shape for @export — marks a symbol for export.",
  })
) {}

/**
 * Schema-backed value for a parsed `satisfies` tag occurrence: specifies a satisfies constraint.
 *
 * **Example** (Make satisfies with type)
 *
 * ```ts
 * import { SatisfiesValue } from "@beep/repo-utils/JSDoc/models/tag-values/AccessModifierTagValues"
 *
 * const tag = SatisfiesValue.make({ type: "ParserConfig" })
 * const tagName: "satisfies" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SatisfiesValue extends S.TaggedClass<SatisfiesValue>($I`SatisfiesValue`)(
  "satisfies",
  { ...optionalType },
  $I.annote("SatisfiesValue", {
    description: "Occurrence shape for @satisfies — specifies a satisfies constraint.",
  })
) {}

/**
 * Schema-backed value for a parsed `import` tag occurrence: declares a type import.
 *
 * **Example** (Make import with type)
 *
 * ```ts
 * import { ImportValue } from "@beep/repo-utils/JSDoc/models/tag-values/AccessModifierTagValues"
 *
 * const tag = ImportValue.make({ type: "ParserConfig" })
 * const tagName: "import" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ImportValue extends S.TaggedClass<ImportValue>($I`ImportValue`)(
  "import",
  { ...optionalType },
  $I.annote("ImportValue", {
    description: "Occurrence shape for @import — declares a type import.",
  })
) {}

/**
 * Schema-backed value for a parsed `this` tag occurrence: documents the this context type.
 *
 * **Example** (Make this with type)
 *
 * ```ts
 * import { ThisValue } from "@beep/repo-utils/JSDoc/models/tag-values/AccessModifierTagValues"
 *
 * const tag = ThisValue.make({ type: "Parser" })
 * const tagName: "this" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ThisValue extends S.TaggedClass<ThisValue>($I`ThisValue`)(
  "this",
  { ...optionalType },
  $I.annote("ThisValue", {
    description: "Occurrence shape for @this — documents the this context type.",
  })
) {}
