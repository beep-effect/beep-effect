/**
 * Google Closure-specific tag occurrence shapes.
 *
 * @packageDocumentation
 * @category models
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { empty, optionalDesc, optionalType } from "./_fields.ts";

const $I = $RepoUtilsId.create("JSDoc/models/tag-values/ClosureTagValues");

/**
 * Schema-backed value for a parsed `define` tag occurrence: defines a compile-time constant.
 *
 * @example
 * ```ts
 * import { DefineValue } from "@beep/repo-utils/JSDoc/models/tag-values/ClosureTagValues"
 *
 * const tag = DefineValue.make({
 *   type: "boolean",
 *   description: "Build-time flag."
 * })
 * const tagName: "define" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DefineValue extends S.TaggedClass<DefineValue>($I`DefineValue`)(
  "define",
  { ...optionalType, ...optionalDesc },
  $I.annote("DefineValue", {
    description: "Occurrence shape for @define — defines a compile-time constant.",
  })
) {}

/**
 * Schema-backed value for a parsed `dict` tag occurrence: marks an object as a dictionary.
 *
 * @example
 * ```ts
 * import { DictValue } from "@beep/repo-utils/JSDoc/models/tag-values/ClosureTagValues"
 *
 * const tag = DictValue.make({})
 * const tagName: "dict" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DictValue extends S.TaggedClass<DictValue>($I`DictValue`)(
  "dict",
  empty,
  $I.annote("DictValue", {
    description: "Occurrence shape for @dict — marks an object as a dictionary.",
  })
) {}

/**
 * Schema-backed value for a parsed `implicitCast` tag occurrence: allows implicit type casts.
 *
 * @example
 * ```ts
 * import { ImplicitCastValue } from "@beep/repo-utils/JSDoc/models/tag-values/ClosureTagValues"
 *
 * const tag = ImplicitCastValue.make({})
 * const tagName: "implicitCast" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ImplicitCastValue extends S.TaggedClass<ImplicitCastValue>($I`ImplicitCastValue`)(
  "implicitCast",
  empty,
  $I.annote("ImplicitCastValue", {
    description: "Occurrence shape for @implicitCast — allows implicit type casts.",
  })
) {}

/**
 * Schema-backed value for a parsed `struct` tag occurrence: marks an object as a struct.
 *
 * @example
 * ```ts
 * import { StructValue } from "@beep/repo-utils/JSDoc/models/tag-values/ClosureTagValues"
 *
 * const tag = StructValue.make({})
 * const tagName: "struct" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class StructValue extends S.TaggedClass<StructValue>($I`StructValue`)(
  "struct",
  empty,
  $I.annote("StructValue", {
    description: "Occurrence shape for @struct — marks an object as a struct.",
  })
) {}

/**
 * Schema-backed value for a parsed `unrestricted` tag occurrence: marks an object as unrestricted.
 *
 * @example
 * ```ts
 * import { UnrestrictedValue } from "@beep/repo-utils/JSDoc/models/tag-values/ClosureTagValues"
 *
 * const tag = UnrestrictedValue.make({})
 * const tagName: "unrestricted" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class UnrestrictedValue extends S.TaggedClass<UnrestrictedValue>($I`UnrestrictedValue`)(
  "unrestricted",
  empty,
  $I.annote("UnrestrictedValue", {
    description: "Occurrence shape for @unrestricted — marks an object as unrestricted.",
  })
) {}

/**
 * Schema-backed value for a parsed `suppress` tag occurrence: suppresses compiler warnings.
 *
 * @example
 * ```ts
 * import { SuppressValue } from "@beep/repo-utils/JSDoc/models/tag-values/ClosureTagValues"
 *
 * const tag = SuppressValue.make({ description: "checkTypes" })
 * const tagName: "suppress" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SuppressValue extends S.TaggedClass<SuppressValue>($I`SuppressValue`)(
  "suppress",
  { ...optionalDesc },
  $I.annote("SuppressValue", {
    description: "Occurrence shape for @suppress — suppresses compiler warnings.",
  })
) {}

/**
 * Schema-backed value for a parsed `externs` tag occurrence: declares external definitions.
 *
 * @example
 * ```ts
 * import { ExternsValue } from "@beep/repo-utils/JSDoc/models/tag-values/ClosureTagValues"
 *
 * const tag = ExternsValue.make({})
 * const tagName: "externs" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ExternsValue extends S.TaggedClass<ExternsValue>($I`ExternsValue`)(
  "externs",
  empty,
  $I.annote("ExternsValue", {
    description: "Occurrence shape for @externs — declares external definitions.",
  })
) {}

/**
 * Schema-backed value for a parsed `noalias` tag occurrence: prevents aliasing.
 *
 * @example
 * ```ts
 * import { NoaliasValue } from "@beep/repo-utils/JSDoc/models/tag-values/ClosureTagValues"
 *
 * const tag = NoaliasValue.make({})
 * const tagName: "noalias" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NoaliasValue extends S.TaggedClass<NoaliasValue>($I`NoaliasValue`)(
  "noalias",
  empty,
  $I.annote("NoaliasValue", {
    description: "Occurrence shape for @noalias — prevents aliasing.",
  })
) {}

/**
 * Schema-backed value for a parsed `nocompile` tag occurrence: excludes from compilation.
 *
 * @example
 * ```ts
 * import { NocompileValue } from "@beep/repo-utils/JSDoc/models/tag-values/ClosureTagValues"
 *
 * const tag = NocompileValue.make({})
 * const tagName: "nocompile" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NocompileValue extends S.TaggedClass<NocompileValue>($I`NocompileValue`)(
  "nocompile",
  empty,
  $I.annote("NocompileValue", {
    description: "Occurrence shape for @nocompile — excludes from compilation.",
  })
) {}

/**
 * Schema-backed value for a parsed `nosideeffects` tag occurrence: marks a function as pure.
 *
 * @example
 * ```ts
 * import { NosideeffectsValue } from "@beep/repo-utils/JSDoc/models/tag-values/ClosureTagValues"
 *
 * const tag = NosideeffectsValue.make({})
 * const tagName: "nosideeffects" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NosideeffectsValue extends S.TaggedClass<NosideeffectsValue>($I`NosideeffectsValue`)(
  "nosideeffects",
  empty,
  $I.annote("NosideeffectsValue", {
    description: "Occurrence shape for @nosideeffects — marks a function as pure.",
  })
) {}

/**
 * Schema-backed value for a parsed `polymer` tag occurrence: Polymer element marker.
 *
 * @example
 * ```ts
 * import { PolymerValue } from "@beep/repo-utils/JSDoc/models/tag-values/ClosureTagValues"
 *
 * const tag = PolymerValue.make({})
 * const tagName: "polymer" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class PolymerValue extends S.TaggedClass<PolymerValue>($I`PolymerValue`)(
  "polymer",
  empty,
  $I.annote("PolymerValue", {
    description: "Occurrence shape for @polymer — Polymer element marker.",
  })
) {}

/**
 * Schema-backed value for a parsed `polymerBehavior` tag occurrence: Polymer behavior marker.
 *
 * @example
 * ```ts
 * import { PolymerBehaviorValue } from "@beep/repo-utils/JSDoc/models/tag-values/ClosureTagValues"
 *
 * const tag = PolymerBehaviorValue.make({})
 * const tagName: "polymerBehavior" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class PolymerBehaviorValue extends S.TaggedClass<PolymerBehaviorValue>($I`PolymerBehaviorValue`)(
  "polymerBehavior",
  empty,
  $I.annote("PolymerBehaviorValue", {
    description: "Occurrence shape for @polymerBehavior — Polymer behavior marker.",
  })
) {}

/**
 * Schema-backed value for a parsed `record` tag occurrence: marks a type as a record.
 *
 * @example
 * ```ts
 * import { RecordValue } from "@beep/repo-utils/JSDoc/models/tag-values/ClosureTagValues"
 *
 * const tag = RecordValue.make({})
 * const tagName: "record" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class RecordValue extends S.TaggedClass<RecordValue>($I`RecordValue`)(
  "record",
  empty,
  $I.annote("RecordValue", {
    description: "Occurrence shape for @record — marks a type as a record.",
  })
) {}

/**
 * Schema-backed value for a parsed `nocollapse` tag occurrence: prevents property collapsing.
 *
 * @example
 * ```ts
 * import { NocollapseValue } from "@beep/repo-utils/JSDoc/models/tag-values/ClosureTagValues"
 *
 * const tag = NocollapseValue.make({})
 * const tagName: "nocollapse" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NocollapseValue extends S.TaggedClass<NocollapseValue>($I`NocollapseValue`)(
  "nocollapse",
  empty,
  $I.annote("NocollapseValue", {
    description: "Occurrence shape for @nocollapse — prevents property collapsing.",
  })
) {}

/**
 * Schema-backed value for a parsed `noinline` tag occurrence: prevents inlining.
 *
 * @example
 * ```ts
 * import { NoinlineValue } from "@beep/repo-utils/JSDoc/models/tag-values/ClosureTagValues"
 *
 * const tag = NoinlineValue.make({})
 * const tagName: "noinline" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NoinlineValue extends S.TaggedClass<NoinlineValue>($I`NoinlineValue`)(
  "noinline",
  empty,
  $I.annote("NoinlineValue", {
    description: "Occurrence shape for @noinline — prevents inlining.",
  })
) {}
