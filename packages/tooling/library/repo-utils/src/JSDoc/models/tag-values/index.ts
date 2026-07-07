/**
 * Tag value occurrence shapes — individual `S.TaggedClass` members composed
 * into `TagValue` (tagged union) and `TagName` (LiteralKit).
 *
 * @packageDocumentation
 * @category models
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoUtilsId.create("JSDoc/models/tag-values");

/**
 * @category models
 * @since 0.0.0
 */
export * from "./AccessModifierTagValues.js";
/**
 * @category models
 * @since 0.0.0
 */
export * from "./ClosureTagValues.js";
/**
 * @category models
 * @since 0.0.0
 */
export * from "./DocumentationTagValues.js";
/**
 * @category models
 * @since 0.0.0
 */
export * from "./EventDependencyTagValues.js";
/**
 * @category models
 * @since 0.0.0
 */
export * from "./InlineTagValues.js";
/**
 * @category models
 * @since 0.0.0
 */
export * from "./OrganizationalTagValues.js";
/**
 * @category models
 * @since 0.0.0
 */
export * from "./RemainingTagValues.js";
// ── Re-export all member classes ─────────────────────────────────────
/**
 * @category models
 * @since 0.0.0
 */
export * from "./StructuralTagValues.js";
/**
 * @category models
 * @since 0.0.0
 */
export * from "./TSDocTagValues.js";
/**
 * @category models
 * @since 0.0.0
 */
export * from "./TypeDocTagValues.js";
/**
 * @category models
 * @since 0.0.0
 */
export * from "./TypeScriptTagValues.js";

import {
  AbstractValue,
  AccessValue,
  ConstantValue,
  DefaultValue,
  DefaultValueValue,
  ExportsValue,
  ExportValue,
  FinalValue,
  ImportValue,
  OverrideValue,
  PackageValue,
  PrivateValue,
  ProtectedValue,
  PublicValue,
  ReadonlyValue,
  SatisfiesValue,
  StaticValue,
  ThisValue,
} from "./AccessModifierTagValues.js";
import {
  DefineValue,
  DictValue,
  ExternsValue,
  ImplicitCastValue,
  NoaliasValue,
  NocollapseValue,
  NocompileValue,
  NoinlineValue,
  NosideeffectsValue,
  PolymerBehaviorValue,
  PolymerValue,
  RecordValue,
  StructValue,
  SuppressValue,
  UnrestrictedValue,
} from "./ClosureTagValues.js";
import {
  AuthorValue,
  DeprecatedValue,
  DescriptionValue,
  ExampleValue,
  RemarksValue,
  SeeValue,
  SinceValue,
  SummaryValue,
  TodoValue,
  VersionValue,
} from "./DocumentationTagValues.js";
import { EventValue, FiresValue, ListensValue, RequiresValue } from "./EventDependencyTagValues.js";
import { InheritDocValue, LinkValue } from "./InlineTagValues.js";
import {
  FunctionValue,
  InterfaceValue,
  MemberofValue,
  MemberValue,
  ModuleValue,
  NamespaceValue,
  PropertyValue,
} from "./OrganizationalTagValues.js";
import {
  AliasValue,
  BorrowsValue,
  ClassdescValue,
  ConstructsValue,
  CopyrightValue,
  ExternalValue,
  FileValue,
  GlobalValue,
  HideconstructorValue,
  IgnoreValue,
  InnerValue,
  InstanceValue,
  KindValue,
  LendsValue,
  LicenseValue,
  MixesValue,
  MixinValue,
  NameValue,
  TutorialValue,
  VariationValue,
} from "./RemainingTagValues.js";
// ── Import all members for composition ───────────────────────────────
import {
  AsyncValue,
  AugmentsValue,
  CallbackValue,
  ClassValue,
  EnumValue,
  GeneratorValue,
  ImplementsValue,
  ParamValue,
  ReturnsValue,
  TemplateValue,
  ThrowsValue,
  TypedefValue,
  TypeParamValue,
  TypeValue,
  YieldsValue,
} from "./StructuralTagValues.js";
import {
  AlphaValue,
  BetaValue,
  DecoratorValue,
  EventPropertyValue,
  ExperimentalValue,
  InternalValue,
  LabelValue,
  PackageDocumentationValue,
  PrivateRemarksValue,
  SealedValue,
  VirtualValue,
} from "./TSDocTagValues.js";
import {
  CategoryValue,
  DocumentValue,
  ExpandValue,
  GroupValue,
  HiddenValue,
  InlineValue,
  MergeModuleWithValue,
  PrimaryExportValue,
  SortStrategyValue,
  UseDeclaredTypeValue,
} from "./TypeDocTagValues.js";
import { OverloadValue } from "./TypeScriptTagValues.js";

// ── Encoded sub-unions by category ───────────────────────────────────
// S.toTaggedUnion requires Objects ASTs (not Declaration). S.toEncoded()
// unwraps each TaggedClass from its Declaration wrapper so the _tag
// literal is visible. Sub-unions keep the total Flatten depth within
// TypeScript's recursion limit.
const StructuralEnc = S.Union([
  S.toEncoded(ParamValue),
  S.toEncoded(ReturnsValue),
  S.toEncoded(ThrowsValue),
  S.toEncoded(TemplateValue),
  S.toEncoded(TypeParamValue),
  S.toEncoded(TypeValue),
  S.toEncoded(TypedefValue),
  S.toEncoded(CallbackValue),
  S.toEncoded(AugmentsValue),
  S.toEncoded(ImplementsValue),
  S.toEncoded(ClassValue),
  S.toEncoded(EnumValue),
  S.toEncoded(AsyncValue),
  S.toEncoded(GeneratorValue),
  S.toEncoded(YieldsValue),
]);

const AccessModifierEnc = S.Union([
  S.toEncoded(AccessValue),
  S.toEncoded(PublicValue),
  S.toEncoded(PrivateValue),
  S.toEncoded(ProtectedValue),
  S.toEncoded(PackageValue),
  S.toEncoded(ReadonlyValue),
  S.toEncoded(AbstractValue),
  S.toEncoded(FinalValue),
  S.toEncoded(OverrideValue),
  S.toEncoded(StaticValue),
  S.toEncoded(ConstantValue),
  S.toEncoded(DefaultValue),
  S.toEncoded(DefaultValueValue),
  S.toEncoded(ExportsValue),
  S.toEncoded(ExportValue),
  S.toEncoded(SatisfiesValue),
  S.toEncoded(ImportValue),
  S.toEncoded(ThisValue),
]);

const DocumentationEnc = S.Union([
  S.toEncoded(DescriptionValue),
  S.toEncoded(SummaryValue),
  S.toEncoded(RemarksValue),
  S.toEncoded(ExampleValue),
  S.toEncoded(DeprecatedValue),
  S.toEncoded(SeeValue),
  S.toEncoded(SinceValue),
  S.toEncoded(VersionValue),
  S.toEncoded(AuthorValue),
  S.toEncoded(TodoValue),
]);

const TSDocEnc = S.Union([
  S.toEncoded(AlphaValue),
  S.toEncoded(BetaValue),
  S.toEncoded(ExperimentalValue),
  S.toEncoded(InternalValue),
  S.toEncoded(SealedValue),
  S.toEncoded(VirtualValue),
  S.toEncoded(PrivateRemarksValue),
  S.toEncoded(PackageDocumentationValue),
  S.toEncoded(LabelValue),
  S.toEncoded(DecoratorValue),
  S.toEncoded(EventPropertyValue),
]);

const InlineEnc = S.Union([S.toEncoded(LinkValue), S.toEncoded(InheritDocValue)]);

const OrganizationalEnc = S.Union([
  S.toEncoded(ModuleValue),
  S.toEncoded(NamespaceValue),
  S.toEncoded(MemberofValue),
  S.toEncoded(MemberValue),
  S.toEncoded(PropertyValue),
  S.toEncoded(InterfaceValue),
  S.toEncoded(FunctionValue),
]);

const EventDependencyEnc = S.Union([
  S.toEncoded(FiresValue),
  S.toEncoded(ListensValue),
  S.toEncoded(EventValue),
  S.toEncoded(RequiresValue),
]);

const RemainingEnc = S.Union([
  S.toEncoded(AliasValue),
  S.toEncoded(BorrowsValue),
  S.toEncoded(ClassdescValue),
  S.toEncoded(ConstructsValue),
  S.toEncoded(CopyrightValue),
  S.toEncoded(LicenseValue),
  S.toEncoded(ExternalValue),
  S.toEncoded(FileValue),
  S.toEncoded(GlobalValue),
  S.toEncoded(HideconstructorValue),
  S.toEncoded(IgnoreValue),
  S.toEncoded(InnerValue),
  S.toEncoded(InstanceValue),
  S.toEncoded(KindValue),
  S.toEncoded(LendsValue),
  S.toEncoded(MixinValue),
  S.toEncoded(MixesValue),
  S.toEncoded(NameValue),
  S.toEncoded(VariationValue),
  S.toEncoded(TutorialValue),
]);

const ClosureEnc = S.Union([
  S.toEncoded(DefineValue),
  S.toEncoded(DictValue),
  S.toEncoded(ImplicitCastValue),
  S.toEncoded(StructValue),
  S.toEncoded(UnrestrictedValue),
  S.toEncoded(SuppressValue),
  S.toEncoded(ExternsValue),
  S.toEncoded(NoaliasValue),
  S.toEncoded(NocompileValue),
  S.toEncoded(NosideeffectsValue),
  S.toEncoded(PolymerValue),
  S.toEncoded(PolymerBehaviorValue),
  S.toEncoded(RecordValue),
  S.toEncoded(NocollapseValue),
  S.toEncoded(NoinlineValue),
]);

const TypeDocEnc = S.Union([
  S.toEncoded(CategoryValue),
  S.toEncoded(DocumentValue),
  S.toEncoded(GroupValue),
  S.toEncoded(HiddenValue),
  S.toEncoded(ExpandValue),
  S.toEncoded(InlineValue),
  S.toEncoded(MergeModuleWithValue),
  S.toEncoded(PrimaryExportValue),
  S.toEncoded(SortStrategyValue),
  S.toEncoded(UseDeclaredTypeValue),
]);

const TypeScriptEnc = S.Union([S.toEncoded(OverloadValue)]);

/**
 * Tagged union over all 113 JSDoc tag occurrence shapes, discriminated by `_tag`.
 *
 * Provides `.cases`, `.match`, `.guards`, and `.isAnyOf` for dispatching on
 * the parsed `_tag` discriminant.
 *
 * @example
 * ```ts
 * import { ParamValue, TagValue } from "@beep/repo-utils/JSDoc/models/tag-values"
 *
 * const tag = ParamValue.make({ name: "input", description: "Raw input value." })
 * const parameterName = TagValue.guards.param(tag) ? tag.name : "unknown"
 * console.log(parameterName)
 * ```
 * @category models
 * @since 0.0.0
 */
export const TagValue = S.Union([
  StructuralEnc,
  AccessModifierEnc,
  DocumentationEnc,
  TSDocEnc,
  InlineEnc,
  OrganizationalEnc,
  EventDependencyEnc,
  RemainingEnc,
  ClosureEnc,
  TypeDocEnc,
  TypeScriptEnc,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("TagValue", {
    description: "Tagged union over all canonical JSDoc tag occurrence shapes.",
  })
);

/**
 * Static type represented by the `TagValue` tagged union schema.
 *
 * @example
 * ```ts
 * import { ParamValue } from "@beep/repo-utils/JSDoc/models/tag-values"
 * import type { TagValue } from "@beep/repo-utils/JSDoc/models/tag-values"
 *
 * const tag: TagValue = ParamValue.make({ name: "input" })
 * const tagName: "param" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export type TagValue = typeof TagValue.Type;

/**
 * All 113 canonical JSDoc tag names as a const tuple.
 *
 * @internal
 */
const tagNames = [
  // Structural
  "param",
  "returns",
  "throws",
  "template",
  "typeParam",
  "type",
  "typedef",
  "callback",
  "augments",
  "implements",
  "class",
  "enum",
  "async",
  "generator",
  "yields",
  // Access modifiers
  "access",
  "public",
  "private",
  "protected",
  "package",
  "readonly",
  "abstract",
  "final",
  "override",
  "static",
  "constant",
  "default",
  "defaultValue",
  "exports",
  "export",
  "satisfies",
  "import",
  "this",
  // Documentation content
  "description",
  "summary",
  "remarks",
  "example",
  "deprecated",
  "see",
  "since",
  "version",
  "author",
  "todo",
  // TSDoc-specific
  "alpha",
  "beta",
  "experimental",
  "internal",
  "sealed",
  "virtual",
  "privateRemarks",
  "packageDocumentation",
  "label",
  "decorator",
  "eventProperty",
  // Inline
  "link",
  "inheritDoc",
  // Organizational
  "module",
  "namespace",
  "memberof",
  "member",
  "property",
  "interface",
  "function",
  // Event & dependency
  "fires",
  "listens",
  "event",
  "requires",
  // Remaining JSDoc
  "alias",
  "borrows",
  "classdesc",
  "constructs",
  "copyright",
  "license",
  "external",
  "file",
  "global",
  "hideconstructor",
  "ignore",
  "inner",
  "instance",
  "kind",
  "lends",
  "mixin",
  "mixes",
  "name",
  "variation",
  "tutorial",
  // Google Closure-specific
  "define",
  "dict",
  "implicitCast",
  "struct",
  "unrestricted",
  "suppress",
  "externs",
  "noalias",
  "nocompile",
  "nosideeffects",
  "polymer",
  "polymerBehavior",
  "record",
  "nocollapse",
  "noinline",
  // TypeDoc-specific
  "category",
  "document",
  "group",
  "hidden",
  "expand",
  "inline",
  "mergeModuleWith",
  "primaryExport",
  "sortStrategy",
  "useDeclaredType",
  // TypeScript-specific
  "overload",
] as const;

/**
 * LiteralKit over all 113 canonical JSDoc tag names.
 *
 * Provides `.Enum`, the `.is.<literal>` guard map, `.$match`,
 * `S.decodeUnknownResult(TagName)`, and `TagName.Type`
 * (`"param" | "returns" | ... | "overload"`).
 *
 * @example
 * ```ts
 * import { TagName } from "@beep/repo-utils/JSDoc/models/tag-values"
 *
 * const tagName = TagName.Enum.param
 * const isParam = TagName.is.param(tagName)
 * console.log(isParam)
 * ```
 * @category models
 * @since 0.0.0
 */
export const TagName = LiteralKit(tagNames).pipe(
  $I.annoteSchema("TagName", {
    description: "Literal domain of all canonical JSDoc tag names.",
  })
);

/**
 * Static literal union represented by the `TagName` LiteralKit.
 *
 * @example
 * ```ts
 * import type { TagName } from "@beep/repo-utils/JSDoc/models/tag-values"
 *
 * const tagName: TagName = "param"
 * const acceptsTagName = (value: TagName): TagName => value
 * const sameTagName = acceptsTagName(tagName)
 * console.log(sameTagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export type TagName = typeof TagName.Type;
