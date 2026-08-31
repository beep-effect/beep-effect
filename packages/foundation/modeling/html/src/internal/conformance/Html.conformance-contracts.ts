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
import type { Doctype } from "../../Html.nodes.ts";

const $I = $HtmlId.create("Html.conformance");

/**
 * Recursive structural view shared by private HTML conformance inspectors.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export interface HtmlChildView {
  readonly _tag: string;
  readonly alt?: unknown;
  readonly attributes?: unknown;
  readonly children?: ReadonlyArray<HtmlChildView>;
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

/**
 * Root structural view shared by private HTML conformance inspectors.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export interface HtmlRootView extends HtmlChildView {
  readonly doctype?: O.Option<Doctype>;
}

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
