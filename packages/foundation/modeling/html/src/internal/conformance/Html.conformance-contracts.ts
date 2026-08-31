/**
 * Schema contracts and opaque proof state shared by HTML conformance inspectors.
 *
 * @packageDocumentation
 * @internal
 * @since 0.0.0
 */

import { $HtmlId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { A } from "@beep/utils";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Doctype } from "../../Html.nodes.ts";

const $I = $HtmlId.create("Html.conformance");

interface HtmlChildViewShape {
  readonly _tag: string;
  readonly alt?: unknown;
  readonly attributes?: unknown;
  readonly children?: ReadonlyArray<HtmlChildViewShape>;
  readonly content?: unknown;
  readonly headingoffset?: unknown;
  readonly headingreset?: unknown;
  readonly href?: unknown;
  readonly id?: unknown;
  readonly name?: unknown;
  readonly namespace?: string;
  readonly src?: unknown;
  readonly srcset?: unknown;
  readonly tabindex?: unknown;
  readonly target?: unknown;
  readonly type?: unknown;
  readonly value?: unknown;
}

const htmlChildViewFields = {
  _tag: S.String,
  alt: S.Unknown.pipe(S.optionalKey),
  attributes: S.Unknown.pipe(S.optionalKey),
  children: S.suspend((): S.Codec<HtmlChildViewShape> => HtmlChildView).pipe(S.Array, S.optionalKey),
  content: S.Unknown.pipe(S.optionalKey),
  headingoffset: S.Unknown.pipe(S.optionalKey),
  headingreset: S.Unknown.pipe(S.optionalKey),
  href: S.Unknown.pipe(S.optionalKey),
  id: S.Unknown.pipe(S.optionalKey),
  name: S.Unknown.pipe(S.optionalKey),
  namespace: S.String.pipe(S.optionalKey),
  src: S.Unknown.pipe(S.optionalKey),
  srcset: S.Unknown.pipe(S.optionalKey),
  tabindex: S.Unknown.pipe(S.optionalKey),
  target: S.Unknown.pipe(S.optionalKey),
  type: S.Unknown.pipe(S.optionalKey),
  value: S.Unknown.pipe(S.optionalKey),
};

/**
 * Recursive structural schema shared by private HTML conformance inspectors.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export const HtmlChildView = S.Struct(htmlChildViewFields).pipe(
  $I.annoteSchema("HtmlChildView", {
    description: "Recursive structural view consumed by private HTML conformance inspectors.",
  })
);

/**
 * Decoded recursive structural view consumed by private HTML inspectors.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type HtmlChildView = typeof HtmlChildView.Type;

/**
 * Root structural schema shared by private HTML conformance inspectors.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export const HtmlRootView = S.Struct({
  ...htmlChildViewFields,
  doctype: Doctype.pipe(S.Option, S.optionalKey),
}).pipe(
  $I.annoteSchema("HtmlRootView", {
    description: "HTML conformance root view with an optional document type declaration.",
  })
);

/**
 * Decoded structural root view consumed by private HTML inspectors.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type HtmlRootView = typeof HtmlRootView.Type;

/**
 * Rules reported by the HTML conformance validator.
 *
 * **Example** (Validate with `HtmlConformanceRule`)
 *
 * ```ts import.meta.vitest name="Validate with HtmlConformanceRule"
 * import { HtmlConformanceRule } from "@beep/html/Html.conformance"
 *
 * HtmlConformanceRule.is.obsoleteElement("obsoleteElement") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlConformanceRule = LiteralKit([
  "encodingFailure",
  "obsoleteElement",
  "documentDoctype",
  "documentRoot",
  "documentCardinality",
  "contentModel",
  "elementOrder",
  "foreignIntegration",
  "forbiddenDescendant",
  "attributeRelationship",
  "duplicateAttribute",
  "duplicateId",
  "obsoleteAttribute",
  "misplacedAttribute",
  "headingOutline",
]).pipe(
  $I.annoteSchema("HtmlConformanceRule", {
    description: "Rule identifier emitted by HTML AST conformance validation.",
  })
);

/**
 * Decoded type of {@link HtmlConformanceRule}.
 *
 * **Example** (Annotate a `HtmlConformanceRule` value)
 *
 * ```ts import.meta.vitest name="Annotate a HtmlConformanceRule value"
 * import type { HtmlConformanceRule } from "@beep/html/Html.conformance"
 *
 * const rule: HtmlConformanceRule = "contentModel"
 * rule // => "contentModel"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlConformanceRule = typeof HtmlConformanceRule.Type;

/**
 * One path-addressed HTML conformance violation.
 *
 * **Example** (Construct `HtmlConformanceIssue`)
 *
 * ```ts import.meta.vitest name="Construct HtmlConformanceIssue"
 * import { HtmlConformanceIssue } from "@beep/html/Html.conformance"
 *
 * const issue = HtmlConformanceIssue.make({
 *   path: ["children", "0"],
 *   rule: "contentModel",
 *   message: "Invalid child"
 * })
 * issue.rule // => "contentModel"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HtmlConformanceIssue extends S.Class<HtmlConformanceIssue>($I`HtmlConformanceIssue`)(
  {
    path: S.Array(S.String),
    rule: HtmlConformanceRule,
    message: S.String,
  },
  $I.annote("HtmlConformanceIssue", {
    description: "One path-addressed violation of the modeled HTML content rules.",
  })
) {}

/**
 * Constructs one path-addressed issue for private conformance inspectors.
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const makeHtmlConformanceIssue: {
  (path: ReadonlyArray<string>, rule: HtmlConformanceRule, message: string): HtmlConformanceIssue;
  (rule: HtmlConformanceRule, message: string): (path: ReadonlyArray<string>) => HtmlConformanceIssue;
} = dual(
  3,
  (path: ReadonlyArray<string>, rule: HtmlConformanceRule, message: string): HtmlConformanceIssue =>
    HtmlConformanceIssue.make({ path, rule, message })
);

/**
 * Appends one stable child segment to a diagnostic path.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const htmlChildPath: {
  (path: ReadonlyArray<string>, index: number): ReadonlyArray<string>;
  (index: number): (path: ReadonlyArray<string>) => ReadonlyArray<string>;
} = dual(2, (path: ReadonlyArray<string>, index: number): ReadonlyArray<string> => A.append(path, `children.${index}`));

/**
 * Normalizes generated optional attributes to an Effect Option.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const htmlAttributeValue = (value: unknown): O.Option<unknown> =>
  O.isOption(value) ? value : O.fromUndefinedOr(value);

/**
 * Reports whether a generated optional attribute is present.
 *
 * @internal
 * @category guards
 * @since 0.0.0
 */
export const hasHtmlAttribute = (value: unknown): boolean => O.isSome(htmlAttributeValue(value));

/**
 * Reads the recursive child sequence from an internal conformance view.
 *
 * @internal
 * @category getters
 * @since 0.0.0
 */
export const htmlChildrenOf = (node: HtmlChildView): ReadonlyArray<HtmlChildView> =>
  O.getOrElse(O.fromUndefinedOr(node.children), A.emptyReadonly);
