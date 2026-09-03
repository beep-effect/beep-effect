/**
 * `@beep/html` — generated HTML AST, validation proofs, policy, and canonical
 * serialization.
 *
 * **Details**
 *
 * The root exports the stable boundary contract and namespace views. The full
 * generated element catalog remains available from `@beep/html/Html.model`;
 * specialist schemas are available from their matching explicit subpaths.
 *
 * **Example** (Conform enforce serialize pipeline)
 *
 * ```ts import.meta.vitest name="Conform enforce serialize pipeline"
 * import {
 *   conform,
 *   enforceSafeHtml,
 *   HtmlFragment,
 *   serializeSafe
 * } from "@beep/html"
 * import { Effect } from "effect"
 *
 * const program = conform(HtmlFragment.make({ children: [] })).pipe(
 *   Effect.flatMap(enforceSafeHtml),
 *   Effect.flatMap(serializeSafe)
 * )
 * ```
 *
 * @packageDocumentation \@beep/html
 * @since 0.0.0
 */

/**
 * HTML microsyntax and attribute schemas.
 *
 * @category schemas
 * @since 0.0.0
 */
export * as HtmlAttributes from "./Html.attributes.ts";
/**
 * Stable HTML microsyntax and attribute contracts.
 *
 * @category schemas
 * @since 0.0.0
 */
export {
  AutocompleteAttribute,
  BooleanAttribute,
  DatasetKey,
  ForeignAttributeName,
  ForeignElementName,
  GlobalAttributesStruct,
  HeadingOffset,
  HtmlFiniteNumber,
  HtmlIdValue,
  HtmlNonNegativeInteger,
  HtmlNonNegativeNumber,
  HtmlPositiveInteger,
  HtmlPositiveNumber,
  makeAsciiCaseInsensitiveEnumerated,
  makeSpaceSeparatedTokenList,
  Popover,
} from "./Html.attributes.ts";
/**
 * HTML document-conformance validation.
 *
 * @category validation
 * @since 0.0.0
 */
export * as HtmlConformance from "./Html.conformance.ts";
/**
 * Stable HTML conformance contracts.
 *
 * @category validation
 * @since 0.0.0
 */
export {
  ConformantHtml,
  ConformantHtmlNode,
  computeHeadingOutline,
  conform,
  conformantRoot,
  HtmlBestPracticeIssue,
  HtmlBestPracticeRule,
  HtmlComputedHeadingLevel,
  HtmlConformanceError,
  HtmlConformanceIssue,
  HtmlConformanceRule,
  HtmlHeadingOutlineEntry,
  inspectBestPractices,
  inspectConformance,
} from "./Html.conformance.ts";
/**
 * Canonical names for the package boundary contract.
 *
 * @category models
 * @since 0.0.0
 */
export * as HtmlContract from "./Html.contract.ts";
/**
 * Canonical names for HTML node roles.
 *
 * @category models
 * @since 0.0.0
 */
export {
  HtmlChildNode,
  HtmlDocument,
  HtmlDocumentChild,
  HtmlFragment,
} from "./Html.contract.ts";
/**
 * Effective semantic states for context-sensitive HTML form controls.
 *
 * @category models
 * @since 0.0.0
 */
export * as HtmlFormControl from "./Html.form-control.ts";
/**
 * Stable form-control semantic-state contracts.
 *
 * @category models
 * @since 0.0.0
 */
export {
  ButtonState,
  InputState,
  inputStateAllowedAttributes,
  resolveButtonState,
  resolveInputState,
} from "./Html.form-control.ts";
/**
 * Generated HTML element metadata.
 *
 * @category schemas
 * @since 0.0.0
 */
export * as HtmlMeta from "./Html.meta.ts";
/**
 * Stable HTML metadata contracts.
 *
 * @category models
 * @since 0.0.0
 */
export {
  ELEMENT_META,
  HTML_ATTRIBUTE_SYNTAXES,
  HtmlAttributeSyntax,
  HtmlBooleanAttributeName,
  HtmlCategory,
  HtmlChildGrammar,
  HtmlConditionalCategoryRule,
  HtmlContentToken,
  HtmlElementMeta,
  HtmlTag,
  HtmlTextMode,
} from "./Html.meta.ts";
/**
 * Generated HTML AST model.
 *
 * @category models
 * @since 0.0.0
 */
export * as HtmlModel from "./Html.model.ts";
/**
 * Stable HTML root and node schemas.
 *
 * @category models
 * @since 0.0.0
 */
export {
  Document,
  ForeignElement,
  ForeignNamespace,
  Fragment,
  HtmlChild,
  HtmlChildren,
  HtmlNode,
  HtmlRoot,
} from "./Html.model.ts";
/**
 * Non-element HTML node schemas.
 *
 * @category models
 * @since 0.0.0
 */
export * as HtmlNodes from "./Html.nodes.ts";
/**
 * Stable non-element HTML node contracts.
 *
 * @category models
 * @since 0.0.0
 */
export {
  Comment,
  Doctype,
  HtmlCommentData,
  Text,
} from "./Html.nodes.ts";
/**
 * Safe-HTML policy and proof boundary.
 *
 * @category policies
 * @since 0.0.0
 */
export * as HtmlPolicy from "./Html.policy.ts";
/**
 * Stable safe-HTML policy contracts.
 *
 * @category validation
 * @since 0.0.0
 */
export {
  enforceSafeHtml,
  HtmlPolicyError,
  HtmlPolicyIssue,
  HtmlPolicyRule,
  inspectSafeHtml,
  SafeHtmlAst,
  SafeHtmlAttributes,
  SafeHtmlAttributesStruct,
  SafeHtmlElement,
  SafeHtmlNode,
  SafeImageUrlAttribute,
  SafeUrlAttribute,
  safeHtmlAstConformant,
  safeHtmlAstRoot,
} from "./Html.policy.ts";
/**
 * Semantic states and author-conformance schemas for HTML scripts.
 *
 * @category models
 * @since 0.0.0
 */
export * as HtmlScript from "./Html.script.ts";
/**
 * Stable HTML script semantic-state contracts.
 *
 * @category models
 * @since 0.0.0
 */
export {
  HtmlMimeType,
  InvalidScriptType,
  JavaScriptMimeTypeEssence,
  resolveScriptState,
  ScriptDataBlockMimeType,
  ScriptState,
} from "./Html.script.ts";
/**
 * Deterministic HTML serialization.
 *
 * @category serialization
 * @since 0.0.0
 */
export * as HtmlSerialization from "./Html.serialize.ts";
/**
 * Stable HTML serialization contracts.
 *
 * @category serialization
 * @since 0.0.0
 */
export {
  HtmlSerializeError,
  HtmlSerializeRule,
  SafeHtml,
  safeHtmlValue,
  serialize,
  serializeConformant,
  serializeSafe,
  UntrustedHtml,
  untrustedHtmlValue,
} from "./Html.serialize.ts";
/**
 * Staged HTML validation facade (conformance, then safety policy).
 *
 * @category validation
 * @since 0.0.0
 */
export { Html } from "./Html.ts";
/**
 * Current `@beep/html` package version.
 *
 * @category configuration
 * @since 0.0.0
 */
export { VERSION } from "./Version.ts";
