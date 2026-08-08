/**
 * Structural tag occurrence shapes (AST-derivable).
 *
 * @packageDocumentation
 * @category models
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { empty, nameField, optionalDesc, optionalName, optionalType, typeField } from "./_fields.ts";

const $I = $RepoUtilsId.create("JSDoc/models/tag-values/StructuralTagValues");

/**
 * Schema-backed value for a parsed `param` tag occurrence: documents a function parameter.
 *
 * **Example** (Constructing a param tag)
 *
 * ```ts
 * import { ParamValue } from "@beep/repo-utils/JSDoc/models/tag-values/StructuralTagValues"
 *
 * const tag = ParamValue.make({
 *   type: "string",
 *   name: "input",
 *   description: "Parsed tag text."
 * })
 * const tagName: "param" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParamValue extends S.TaggedClass<ParamValue>($I`ParamValue`)(
  "param",
  { ...optionalType, ...nameField, ...optionalDesc },
  $I.annote("ParamValue", {
    description: "Occurrence shape for @param — documents a function parameter.",
  })
) {}

/**
 * Schema-backed value for a parsed `returns` tag occurrence: documents the return value.
 *
 * **Example** (Constructing a returns tag)
 *
 * ```ts
 * import { ReturnsValue } from "@beep/repo-utils/JSDoc/models/tag-values/StructuralTagValues"
 *
 * const tag = ReturnsValue.make({
 *   type: "boolean",
 *   description: "Parsed tag text."
 * })
 * const tagName: "returns" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReturnsValue extends S.TaggedClass<ReturnsValue>($I`ReturnsValue`)(
  "returns",
  { ...optionalType, ...optionalDesc },
  $I.annote("ReturnsValue", {
    description: "Occurrence shape for @returns — documents the return value.",
  })
) {}

/**
 * Schema-backed value for a parsed `throws` tag occurrence: documents an exception a function may throw.
 *
 * **Example** (Constructing a throws tag)
 *
 * ```ts
 * import { ThrowsValue } from "@beep/repo-utils/JSDoc/models/tag-values/StructuralTagValues"
 *
 * const tag = ThrowsValue.make({
 *   type: "Error",
 *   description: "Parsed tag text."
 * })
 * const tagName: "throws" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ThrowsValue extends S.TaggedClass<ThrowsValue>($I`ThrowsValue`)(
  "throws",
  { ...optionalType, ...optionalDesc },
  $I.annote("ThrowsValue", {
    description: "Occurrence shape for @throws — documents an exception a function may throw.",
  })
) {}

/**
 * Schema-backed value for a parsed `template` tag occurrence: documents a type parameter.
 *
 * **Example** (Constructing a template tag)
 *
 * ```ts
 * import { TemplateValue } from "@beep/repo-utils/JSDoc/models/tag-values/StructuralTagValues"
 *
 * const tag = TemplateValue.make({
 *   type: "T",
 *   name: "Example",
 *   description: "Parsed tag text."
 * })
 * const tagName: "template" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TemplateValue extends S.TaggedClass<TemplateValue>($I`TemplateValue`)(
  "template",
  { ...optionalType, ...nameField, ...optionalDesc },
  $I.annote("TemplateValue", {
    description: "Occurrence shape for @template — documents a type parameter.",
  })
) {}

/**
 * Schema-backed value for a parsed `typeParam` tag occurrence: TSDoc type parameter documentation.
 *
 * **Example** (Constructing a typeParam tag)
 *
 * ```ts
 * import { TypeParamValue } from "@beep/repo-utils/JSDoc/models/tag-values/StructuralTagValues"
 *
 * const tag = TypeParamValue.make({
 *   type: "T",
 *   name: "Example",
 *   description: "Parsed tag text."
 * })
 * const tagName: "typeParam" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TypeParamValue extends S.TaggedClass<TypeParamValue>($I`TypeParamValue`)(
  "typeParam",
  { ...optionalType, ...nameField, ...optionalDesc },
  $I.annote("TypeParamValue", {
    description: "Occurrence shape for @typeParam — TSDoc type parameter documentation.",
  })
) {}

/**
 * Schema-backed value for a parsed `type` tag occurrence: specifies a type annotation.
 *
 * **Example** (Constructing a type tag)
 *
 * ```ts
 * import { TypeValue } from "@beep/repo-utils/JSDoc/models/tag-values/StructuralTagValues"
 *
 * const tag = TypeValue.make({ type: "ReadonlyArray<string>" })
 * const tagName: "type" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TypeValue extends S.TaggedClass<TypeValue>($I`TypeValue`)(
  "type",
  { ...typeField },
  $I.annote("TypeValue", {
    description: "Occurrence shape for @type — specifies a type annotation.",
  })
) {}

/**
 * Schema-backed value for a parsed `typedef` tag occurrence: defines a custom type.
 *
 * **Example** (Constructing a typedef tag)
 *
 * ```ts
 * import { TypedefValue } from "@beep/repo-utils/JSDoc/models/tag-values/StructuralTagValues"
 *
 * const tag = TypedefValue.make({
 *   type: "Record<string, string>",
 *   name: "Example",
 *   description: "Parsed tag text."
 * })
 * const tagName: "typedef" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TypedefValue extends S.TaggedClass<TypedefValue>($I`TypedefValue`)(
  "typedef",
  { ...optionalType, ...optionalName, ...optionalDesc },
  $I.annote("TypedefValue", {
    description: "Occurrence shape for @typedef — defines a custom type.",
  })
) {}

/**
 * Schema-backed value for a parsed `callback` tag occurrence: documents a callback function type.
 *
 * **Example** (Constructing a callback tag)
 *
 * ```ts
 * import { CallbackValue } from "@beep/repo-utils/JSDoc/models/tag-values/StructuralTagValues"
 *
 * const tag = CallbackValue.make({
 *   name: "Example",
 *   description: "Parsed tag text."
 * })
 * const tagName: "callback" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CallbackValue extends S.TaggedClass<CallbackValue>($I`CallbackValue`)(
  "callback",
  { ...optionalName, ...optionalDesc },
  $I.annote("CallbackValue", {
    description: "Occurrence shape for @callback — documents a callback function type.",
  })
) {}

/**
 * Schema-backed value for a parsed `augments` tag occurrence: indicates a class extends another.
 *
 * **Example** (Constructing an augments tag)
 *
 * ```ts
 * import { AugmentsValue } from "@beep/repo-utils/JSDoc/models/tag-values/StructuralTagValues"
 *
 * const tag = AugmentsValue.make({ type: "BaseParser" })
 * const tagName: "augments" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AugmentsValue extends S.TaggedClass<AugmentsValue>($I`AugmentsValue`)(
  "augments",
  { ...optionalType },
  $I.annote("AugmentsValue", {
    description: "Occurrence shape for @augments — indicates a class extends another.",
  })
) {}

/**
 * Schema-backed value for a parsed `implements` tag occurrence: indicates interface implementation.
 *
 * **Example** (Constructing an implements tag)
 *
 * ```ts
 * import { ImplementsValue } from "@beep/repo-utils/JSDoc/models/tag-values/StructuralTagValues"
 *
 * const tag = ImplementsValue.make({ type: "Disposable" })
 * const tagName: "implements" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ImplementsValue extends S.TaggedClass<ImplementsValue>($I`ImplementsValue`)(
  "implements",
  { ...optionalType },
  $I.annote("ImplementsValue", {
    description: "Occurrence shape for @implements — indicates interface implementation.",
  })
) {}

/**
 * Schema-backed value for a parsed `class` tag occurrence: marks a function as a constructor.
 *
 * **Example** (Constructing a class tag)
 *
 * ```ts
 * import { ClassValue } from "@beep/repo-utils/JSDoc/models/tag-values/StructuralTagValues"
 *
 * const tag = ClassValue.make({
 *   name: "Example",
 *   description: "Parsed tag text."
 * })
 * const tagName: "class" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClassValue extends S.TaggedClass<ClassValue>($I`ClassValue`)(
  "class",
  { ...optionalName, ...optionalDesc },
  $I.annote("ClassValue", {
    description: "Occurrence shape for @class — marks a function as a constructor.",
  })
) {}

/**
 * Schema-backed value for a parsed `enum` tag occurrence: documents an enum-like object.
 *
 * **Example** (Constructing an enum tag)
 *
 * ```ts
 * import { EnumValue } from "@beep/repo-utils/JSDoc/models/tag-values/StructuralTagValues"
 *
 * const tag = EnumValue.make({ type: "string" })
 * const tagName: "enum" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EnumValue extends S.TaggedClass<EnumValue>($I`EnumValue`)(
  "enum",
  { ...optionalType },
  $I.annote("EnumValue", {
    description: "Occurrence shape for @enum — documents an enum-like object.",
  })
) {}

/**
 * Schema-backed value for a parsed `async` tag occurrence: marks a function as asynchronous.
 *
 * **Example** (Constructing an async tag)
 *
 * ```ts
 * import { AsyncValue } from "@beep/repo-utils/JSDoc/models/tag-values/StructuralTagValues"
 *
 * const tag = AsyncValue.make({})
 * const tagName: "async" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AsyncValue extends S.TaggedClass<AsyncValue>($I`AsyncValue`)(
  "async",
  empty,
  $I.annote("AsyncValue", {
    description: "Occurrence shape for @async — marks a function as asynchronous.",
  })
) {}

/**
 * Schema-backed value for a parsed `generator` tag occurrence: marks a function as a generator.
 *
 * **Example** (Constructing a generator tag)
 *
 * ```ts
 * import { GeneratorValue } from "@beep/repo-utils/JSDoc/models/tag-values/StructuralTagValues"
 *
 * const tag = GeneratorValue.make({})
 * const tagName: "generator" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GeneratorValue extends S.TaggedClass<GeneratorValue>($I`GeneratorValue`)(
  "generator",
  empty,
  $I.annote("GeneratorValue", {
    description: "Occurrence shape for @generator — marks a function as a generator.",
  })
) {}

/**
 * Schema-backed value for a parsed `yields` tag occurrence: documents a generator's yield value.
 *
 * **Example** (Constructing a yields tag)
 *
 * ```ts
 * import { YieldsValue } from "@beep/repo-utils/JSDoc/models/tag-values/StructuralTagValues"
 *
 * const tag = YieldsValue.make({
 *   type: "string",
 *   description: "Next chunk."
 * })
 * const tagName: "yields" = tag._tag
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YieldsValue extends S.TaggedClass<YieldsValue>($I`YieldsValue`)(
  "yields",
  { ...optionalType, ...optionalDesc },
  $I.annote("YieldsValue", {
    description: "Occurrence shape for @yields — documents a generator's yield value.",
  })
) {}
