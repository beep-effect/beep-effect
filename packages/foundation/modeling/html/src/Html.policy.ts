/**
 * Conservative policy checks for HTML intended for browser insertion.
 *
 * This module is a validator, not a sanitizer. It accepts only an explicit
 * element and attribute allowlist, rejects foreign content, and applies a
 * strict URL policy. Callers that need to clean arbitrary HTML source must use
 * a real HTML parser and sanitizer before constructing this package's AST.
 *
 * @packageDocumentation \@beep/html/Html.policy
 * @since 0.0.0
 */
import { $HtmlId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as Conformance from "@beep/schema/Conformance";
import { A, Struct } from "@beep/utils";
import { Effect, flow, pipe, Result } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { AriaAttributes, StandardGlobalAttributes, tokenizeHtmlSpaceSeparated } from "./Html.attributes.ts";
import { conformantRoot } from "./Html.conformance.ts";
import { toAsciiLowerCase } from "./Html.foreign.ts";
import { HtmlRoot } from "./Html.model.ts";
import { HtmlSafePolicyConformanceAnnotation } from "./internal/conformance/Html.policy-conformance-registry.ts";
import { readonlyStruct } from "./internal/Html.readonly.ts";
import type { ConformantHtml } from "./Html.conformance.ts";

const $I = $HtmlId.create("Html.policy");

const { class: classAttribute, dir, hidden, id, lang, title } = StandardGlobalAttributes;
const {
  "aria-current": ariaCurrent,
  "aria-describedby": ariaDescribedBy,
  "aria-description": ariaDescription,
  "aria-hidden": ariaHidden,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  role,
} = AriaAttributes;

/**
 * Pure schema field bundle for attributes accepted by the safe-HTML policy.
 *
 * **Details**
 *
 * Event handlers, `style`, `srcdoc`, and CSP nonce data are intentionally not
 * present. Element-specific attributes are checked by {@link inspectSafeHtml}.
 *
 * **Example** (Empty attributes schema check)
 *
 * ```ts
 * import { SafeHtmlAttributes } from "@beep/html/Html.policy"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(S.Struct(SafeHtmlAttributes))({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SafeHtmlAttributes = readonlyStruct({
  class: classAttribute,
  dir,
  hidden,
  id,
  lang,
  title,
  "aria-current": ariaCurrent,
  "aria-describedby": ariaDescribedBy,
  "aria-description": ariaDescription,
  "aria-hidden": ariaHidden,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  role,
});

/**
 * Safe global-attribute object schema.
 *
 * **Example** (Make empty attributes object)
 *
 * ```ts import.meta.vitest name="Make empty attributes object"
 * import { SafeHtmlAttributesStruct } from "@beep/html/Html.policy"
 *
 * const attributes = SafeHtmlAttributesStruct.make({})
 * attributes instanceof SafeHtmlAttributesStruct // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class SafeHtmlAttributesStruct extends S.Class<SafeHtmlAttributesStruct>($I`SafeHtmlAttributesStruct`)(
  SafeHtmlAttributes,
  $I.annote("SafeHtmlAttributesStruct", {
    description: "Global HTML attributes accepted by the conservative safe-output policy.",
  })
) {}

/**
 * Elements accepted by the conservative safe-HTML policy.
 *
 * **Details**
 *
 * Active-content, form, embedded-document, media, and foreign-content
 * integration elements are excluded.
 *
 * **Example** (Allowed versus denied tags)
 *
 * ```ts import.meta.vitest name="Allowed versus denied tags"
 * import { SafeHtmlElement } from "@beep/html/Html.policy"
 * import * as S from "effect/Schema"
 *
 * S.is(SafeHtmlElement)("p") // => true
 * S.is(SafeHtmlElement)("script") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SafeHtmlElement = LiteralKit([
  "a",
  "abbr",
  "address",
  "article",
  "aside",
  "b",
  "bdi",
  "bdo",
  "blockquote",
  "br",
  "caption",
  "cite",
  "code",
  "col",
  "colgroup",
  "data",
  "dd",
  "del",
  "details",
  "dfn",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hgroup",
  "hr",
  "i",
  "img",
  "ins",
  "kbd",
  "li",
  "main",
  "mark",
  "menu",
  "nav",
  "ol",
  "p",
  "pre",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "search",
  "section",
  "small",
  "span",
  "strong",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "time",
  "tr",
  "u",
  "ul",
  "var",
  "wbr",
]).pipe(
  $I.annoteSchema("SafeHtmlElement", {
    description: "Conservative allowlist of inert HTML output elements.",
  })
);

/**
 * Decoded type of {@link SafeHtmlElement}.
 *
 * **Example** (Typed safe element tag)
 *
 * ```ts import.meta.vitest name="Typed safe element tag"
 * import type { SafeHtmlElement } from "@beep/html/Html.policy"
 *
 * const tag: SafeHtmlElement = "p"
 * tag // => "p"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SafeHtmlElement = typeof SafeHtmlElement.Type;

const hasForbiddenUrlCodePoint = /[\u0000-\u0020\u007f]/u;
const hasScheme = /^[A-Za-z][A-Za-z0-9+.-]*:/u;
const hasAllowedLinkScheme = /^(?:https|mailto|tel):/iu;
const hasAllowedImageScheme = /^https:/iu;

const isSafeUrlAttributeWith =
  (allowedScheme: RegExp) =>
  (value: string): boolean =>
    Str.isNonEmpty(value) &&
    // The safe-output policy deliberately rejects surrounding Unicode
    // whitespace; HTML microsyntax tokenization elsewhere remains ASCII-only.
    value === Str.trim(value) &&
    !hasForbiddenUrlCodePoint.test(value) &&
    !Str.startsWith("//")(value) &&
    !Str.includes("\\")(value) &&
    (!hasScheme.test(value) || allowedScheme.test(value));

const isSafeUrlAttribute = isSafeUrlAttributeWith(hasAllowedLinkScheme);
const isSafeImageUrlAttribute = isSafeUrlAttributeWith(hasAllowedImageScheme);

/**
 * URL attribute accepted by the conservative browser-output policy.
 *
 * **Details**
 *
 * Relative references and `https`, `mailto`, and `tel` URLs are accepted.
 * Protocol-relative, backslash-prefixed, control-character, and all other
 * scheme-bearing values are rejected.
 *
 * **Example** (Safe versus javascript URLs)
 *
 * ```ts import.meta.vitest name="Safe versus javascript URLs"
 * import { SafeUrlAttribute } from "@beep/html/Html.policy"
 * import * as S from "effect/Schema"
 *
 * S.is(SafeUrlAttribute)("/docs") // => true
 * S.is(SafeUrlAttribute)("javascript:alert(1)") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SafeUrlAttribute = S.String.check(
  S.makeFilter(isSafeUrlAttribute, {
    identifier: $I`SafeUrlAttributeCheck`,
    title: "Safe HTML URL Attribute",
    description: "Checks the conservative browser-output URL policy.",
    message: "Expected a relative, https, mailto, or tel URL without control characters",
  })
).pipe(
  SchemaUtils.withStatics((schema) => ({
    is: S.is(schema),
  })),
  $I.annoteSchema("SafeUrlAttribute", {
    description: "URL permitted in a safe HTML href or src attribute.",
  })
);

/**
 * Decoded type of {@link SafeUrlAttribute}.
 *
 * **Example** (Typed relative URL value)
 *
 * ```ts import.meta.vitest name="Typed relative URL value"
 * import type { SafeUrlAttribute } from "@beep/html/Html.policy"
 *
 * const url: SafeUrlAttribute = "/docs"
 * url // => "/docs"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SafeUrlAttribute = typeof SafeUrlAttribute.Type;

/**
 * URL accepted for image `src`: a relative reference or `https` URL.
 *
 * **Example** (Image src URL validation)
 *
 * ```ts import.meta.vitest name="Image src URL validation"
 * import { SafeImageUrlAttribute } from "@beep/html/Html.policy"
 * import * as S from "effect/Schema"
 *
 * S.is(SafeImageUrlAttribute)("/logo.png") // => true
 * S.is(SafeImageUrlAttribute)("mailto:user@example.com") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SafeImageUrlAttribute = S.String.check(
  S.makeFilter(isSafeImageUrlAttribute, {
    identifier: $I`SafeImageUrlAttributeCheck`,
    title: "Safe HTML Image URL Attribute",
    description: "Checks the conservative image-source URL policy.",
    message: "Expected a relative or https image URL without control characters",
  })
).pipe(
  SchemaUtils.withStatics((schema) => ({
    is: S.is(schema),
  })),
  $I.annoteSchema("SafeImageUrlAttribute", {
    description: "URL permitted in a safe HTML img src attribute.",
  })
);

/**
 * Decoded type of {@link SafeImageUrlAttribute}.
 *
 * **Example** (Decode HTTPS image URL)
 *
 * ```ts
 * import { SafeImageUrlAttribute } from "@beep/html/Html.policy"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(SafeImageUrlAttribute)("https://example.com/logo.png")
 * if (Result.isSuccess(decoded)) {
 *   const src: SafeImageUrlAttribute = decoded.success
 *   console.log(src)
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SafeImageUrlAttribute = typeof SafeImageUrlAttribute.Type;

/**
 * Rules reported by safe-HTML policy validation.
 *
 * **Example** (Check deniedElement rule tag)
 *
 * ```ts import.meta.vitest name="Check deniedElement rule tag"
 * import { HtmlPolicyRule } from "@beep/html/Html.policy"
 *
 * HtmlPolicyRule.is.deniedElement("deniedElement") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlPolicyRule = LiteralKit([
  "encodingFailure",
  "deniedElement",
  "foreignContent",
  "deniedAttribute",
  "unsafeUrl",
  "unsafeTarget",
]).pipe(
  $I.annoteSchema("HtmlPolicyRule", {
    description: "Rule identifier emitted by conservative HTML policy validation.",
  })
);

/**
 * Decoded type of {@link HtmlPolicyRule}.
 *
 * **Example** (Decode unsafeUrl rule value)
 *
 * ```ts import.meta.vitest name="Decode unsafeUrl rule value"
 * import { HtmlPolicyRule } from "@beep/html/Html.policy"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(HtmlPolicyRule)("unsafeUrl")
 * if (Result.isSuccess(decoded)) {
 *   const rule: HtmlPolicyRule = decoded.success
 *   rule // => "unsafeUrl"
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlPolicyRule = typeof HtmlPolicyRule.Type;

/**
 * One path-addressed safe-HTML policy violation.
 *
 * **Example** (Make path-addressed issue)
 *
 * ```ts import.meta.vitest name="Make path-addressed issue"
 * import { HtmlPolicyIssue } from "@beep/html/Html.policy"
 *
 * const issue = HtmlPolicyIssue.make({
 *   path: ["children.0"],
 *   rule: "deniedElement",
 *   message: "Element is not allowed"
 * })
 * issue.rule // => "deniedElement"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HtmlPolicyIssue extends S.Class<HtmlPolicyIssue>($I`HtmlPolicyIssue`)(
  {
    path: S.Array(S.String),
    rule: HtmlPolicyRule,
    message: S.String,
  },
  $I.annote("HtmlPolicyIssue", {
    description: "One path-addressed conservative HTML policy violation.",
  })
) {}

/**
 * Failure returned when conformant HTML does not satisfy the safe policy.
 *
 * **Example** (Make error with issues)
 *
 * ```ts import.meta.vitest name="Make error with issues"
 * import { HtmlPolicyError, HtmlPolicyIssue } from "@beep/html/Html.policy"
 *
 * const error = HtmlPolicyError.make({
 *   issues: [
 *     HtmlPolicyIssue.make({
 *       message: "Element is not allowed",
 *       path: ["children.0"],
 *       rule: "deniedElement",
 *     }),
 *   ],
 * })
 * error._tag // => "HtmlPolicyError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HtmlPolicyError extends S.TaggedError<HtmlPolicyError>($I`HtmlPolicyError`)(
  "HtmlPolicyError",
  {
    issues: S.NonEmptyArray(HtmlPolicyIssue),
  },
  $I.annoteError<HtmlPolicyError>("HtmlPolicyError", {
    description: "Conformant HTML failed one or more safe-output policy rules.",
  })
) {}

const safeHtmlAstConformantValues = new WeakMap<object, ConformantHtml>();

declare const safeHtmlAstProof: unique symbol;

class SafeHtmlAstValue {
  private declare readonly [safeHtmlAstProof]: true;

  static readonly is = (value: unknown): value is SafeHtmlAstValue =>
    P.isObject(value) && safeHtmlAstConformantValues.has(value);

  constructor() {
    Reflect.setPrototypeOf(this, null);
  }
}

const issueSafeHtmlAst = (conformant: ConformantHtml): SafeHtmlAstValue => {
  const value = new SafeHtmlAstValue();
  safeHtmlAstConformantValues.set(value, conformant);
  Object.freeze(value);
  return value;
};

/**
 * Runtime-issued proof that conformant HTML passed the safe-output policy.
 *
 * **Example** (Issue and check safe proof)
 *
 * ```ts import.meta.vitest name="Issue and check safe proof"
 * import { conform, enforceSafeHtml, Fragment, SafeHtmlAst } from "@beep/html"
 * import { Effect } from "effect"
 *
 * const proof = Effect.runSync(
 *   conform(Fragment.make({ children: [] })).pipe(Effect.flatMap(enforceSafeHtml))
 * )
 * SafeHtmlAst.is(proof) // => true
 * SafeHtmlAst.is({ ...proof }) // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SafeHtmlAst = S.declare(SafeHtmlAstValue.is).pipe(
  Conformance.annotateConformance(HtmlSafePolicyConformanceAnnotation),
  SchemaUtils.withStatics(() => ({ is: SafeHtmlAstValue.is })),
  $I.annoteSchema("SafeHtmlAst", {
    description: "Runtime-issued proof of conservative HTML output safety.",
  })
);

/**
 * Decoded type of {@link SafeHtmlAst}.
 *
 * **Example** (Typed frozen safe proof)
 *
 * ```ts import.meta.vitest name="Typed frozen safe proof"
 * import { conform, enforceSafeHtml, Fragment } from "@beep/html"
 * import type { SafeHtmlAst } from "@beep/html/Html.policy"
 * import { Effect } from "effect"
 *
 * const proof: SafeHtmlAst = Effect.runSync(
 *   conform(Fragment.make({ children: [] })).pipe(Effect.flatMap(enforceSafeHtml))
 * )
 * Object.isFrozen(proof) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SafeHtmlAst = typeof SafeHtmlAst.Type;

/**
 * Canonical schema alias for a safe-policy-proven HTML node or root.
 *
 * **Example** (Check safe node provenance)
 *
 * ```ts import.meta.vitest name="Check safe node provenance"
 * import { conform, enforceSafeHtml, Fragment, SafeHtmlNode } from "@beep/html"
 * import { Effect } from "effect"
 *
 * const proof = Effect.runSync(
 *   conform(Fragment.make({ children: [] })).pipe(Effect.flatMap(enforceSafeHtml))
 * )
 * SafeHtmlNode.is(proof) // => true
 * SafeHtmlNode.is({ ...proof }) // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SafeHtmlNode = SafeHtmlAst;

/**
 * Decoded type of {@link SafeHtmlNode}.
 *
 * **Example** (Root tag from safe node)
 *
 * ```ts import.meta.vitest name="Root tag from safe node"
 * import { safeHtmlAstRoot } from "@beep/html/Html.policy"
 * import type { SafeHtmlNode } from "@beep/html/Html.policy"
 *
 * const rootTag = (value: SafeHtmlNode) => safeHtmlAstRoot(value)._tag
 * typeof rootTag // => "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SafeHtmlNode = SafeHtmlAst;

type RuntimeNode = {
  readonly [key: PropertyKey]: unknown;
  readonly _tag: string;
};

const isRuntimeNode = (value: unknown): value is RuntimeNode => P.isObject(value) && P.isString(value._tag);

const isSafeHtmlElement = S.is(SafeHtmlElement);

const runtimeChildren = (node: RuntimeNode): ReadonlyArray<RuntimeNode> =>
  A.isArray(node.children) ? A.filter(node.children, isRuntimeNode) : A.emptyReadonly();

const safeGlobalAttributeNames: ReadonlyArray<string> = ["class", "dir", "hidden", "id", "lang", "title"];

const safeAriaAttributeNames: ReadonlyArray<string> = [
  "aria-current",
  "aria-describedby",
  "aria-description",
  "aria-hidden",
  "aria-label",
  "aria-labelledby",
];

const labelledElementNames: ReadonlyArray<string> = [
  "a",
  "article",
  "aside",
  "details",
  "footer",
  "header",
  "img",
  "main",
  "nav",
  "section",
  "summary",
  "table",
  "td",
  "th",
];

const roleCompatibility: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
  ["article", ["article"]],
  ["banner", ["header"]],
  ["cell", ["td"]],
  ["columnheader", ["th"]],
  ["contentinfo", ["footer"]],
  ["heading", ["h1", "h2", "h3", "h4", "h5", "h6"]],
  ["img", ["img"]],
  ["link", ["a"]],
  ["list", ["menu", "ol", "ul"]],
  ["listitem", ["li"]],
  ["main", ["main"]],
  ["navigation", ["nav"]],
  ["note", ["aside"]],
  ["region", ["section"]],
  ["row", ["tr"]],
  ["rowgroup", ["tbody", "tfoot", "thead"]],
  ["rowheader", ["th"]],
  ["table", ["table"]],
];

const safeElementAttributeNames: ReadonlyArray<string> = [
  "alt",
  "cite",
  "colspan",
  "datetime",
  "height",
  "href",
  "open",
  "reversed",
  "rel",
  "rowspan",
  "scope",
  "src",
  "start",
  "target",
  "type",
  "value",
  "width",
];

const structuralElementNames: ReadonlyArray<string> = ["_tag", "children"];
const SafeAnchorRelation = LiteralKit(["nofollow", "noopener", "noreferrer"]);
const isSafeAnchorRelation = S.is(SafeAnchorRelation);

const isAllowedAttributeName = (name: string): boolean =>
  A.contains(safeGlobalAttributeNames, name) ||
  A.contains(safeElementAttributeNames, name) ||
  A.contains(safeAriaAttributeNames, name) ||
  name === "role";

const isCompatibleRole = (tag: string, roleValue: unknown): boolean =>
  P.isString(roleValue) &&
  A.some(roleCompatibility, ([candidate, tags]) => candidate === roleValue && A.contains(tags, tag));

const isCompatibleAriaAttribute = (tag: string, name: string): boolean =>
  name === "aria-current"
    ? tag === "a" || tag === "li"
    : name === "aria-hidden"
      ? tag !== "a" && tag !== "summary"
      : A.contains(labelledElementNames, tag);

const makeIssue = (path: ReadonlyArray<string>, rule: HtmlPolicyRule, message: string): HtmlPolicyIssue =>
  HtmlPolicyIssue.make({ path, rule, message });

const inspectAttributeCompatibility = (
  node: RuntimeNode,
  name: string,
  value: unknown,
  path: ReadonlyArray<string>
): ReadonlyArray<HtmlPolicyIssue> => {
  if (!isAllowedAttributeName(name)) {
    return [makeIssue(A.append(path, name), "deniedAttribute", `Attribute ${name} is not allowed`)];
  }
  if (name === "role" && !isCompatibleRole(node._tag, value)) {
    return [makeIssue(A.append(path, name), "deniedAttribute", `Role ${value} is not compatible with <${node._tag}>`)];
  }
  if (A.contains(safeAriaAttributeNames, name) && !isCompatibleAriaAttribute(node._tag, name)) {
    return [
      makeIssue(A.append(path, name), "deniedAttribute", `Attribute ${name} is not compatible with <${node._tag}>`),
    ];
  }
  return A.emptyReadonly();
};

const isSafeAttributeUrl = (node: RuntimeNode, name: string, value: unknown): boolean => {
  if (name === "href" || name === "cite") {
    /* istanbul ignore next -- HtmlRoot encoding emits string values for both generated URL attributes */
    if (!P.isString(value)) return false;
    return isSafeUrlAttribute(value);
  }
  if (name === "src") {
    /* istanbul ignore next -- img is the only safe-policy element with a generated src attribute */
    if (node._tag !== "img" || !P.isString(value)) return false;
    return isSafeImageUrlAttribute(value);
  }
  return true;
};

const inspectAttribute = (
  node: RuntimeNode,
  name: string,
  value: unknown,
  path: ReadonlyArray<string>
): ReadonlyArray<HtmlPolicyIssue> => {
  const compatibilityIssues = inspectAttributeCompatibility(node, name, value, path);
  if (compatibilityIssues.length > 0) return compatibilityIssues;
  if (!isSafeAttributeUrl(node, name, value)) {
    return [makeIssue(A.append(path, name), "unsafeUrl", `Attribute ${name} contains an unsafe URL`)];
  }
  return A.emptyReadonly();
};

const inspectTarget = (node: RuntimeNode, path: ReadonlyArray<string>): ReadonlyArray<HtmlPolicyIssue> => {
  if (!P.isString(node.target)) return A.emptyReadonly();
  const target = toAsciiLowerCase(node.target);
  if (target === "_self") return A.emptyReadonly();
  if (target !== "_blank") {
    return [
      makeIssue(
        A.append(path, "attributes.target"),
        "unsafeTarget",
        'target accepts only "_self" or "_blank" under the safe policy'
      ),
    ];
  }
  const relTokens = P.isString(node.rel)
    ? pipe(node.rel, tokenizeHtmlSpaceSeparated, A.map(toAsciiLowerCase))
    : A.emptyReadonly<string>();
  return A.contains(relTokens, "noopener") && A.contains(relTokens, "noreferrer")
    ? A.emptyReadonly()
    : [
        makeIssue(
          A.append(path, "attributes.target"),
          "unsafeTarget",
          'target="_blank" requires rel containing both noopener and noreferrer'
        ),
      ];
};

const inspectAnchorRelation = (node: RuntimeNode, path: ReadonlyArray<string>): ReadonlyArray<HtmlPolicyIssue> => {
  if (node._tag !== "a" || !P.isString(node.rel)) return A.emptyReadonly();
  return A.some(tokenizeHtmlSpaceSeparated(node.rel), (token) => !isSafeAnchorRelation(toAsciiLowerCase(token)))
    ? [
        makeIssue(
          A.append(path, "attributes.rel"),
          "deniedAttribute",
          "Anchor rel accepts only nofollow, noopener, and noreferrer under the safe policy"
        ),
      ]
    : A.emptyReadonly();
};

const inspectNode = (node: RuntimeNode, path: ReadonlyArray<string>): ReadonlyArray<HtmlPolicyIssue> => {
  if (node._tag === "#text" || node._tag === "#comment") return A.emptyReadonly();
  if (node._tag === "#foreign") {
    return [makeIssue(path, "foreignContent", "Foreign SVG and MathML content is not accepted by the safe policy")];
  }

  const own =
    node._tag === "#document" || node._tag === "#fragment"
      ? A.emptyReadonly<HtmlPolicyIssue>()
      : isSafeHtmlElement(node._tag)
        ? pipe(
            Struct.entries(node),
            A.filter(([name]) => !A.contains(structuralElementNames, name)),
            A.flatMap(([name, value]) => inspectAttribute(node, name, value, A.append(path, "attributes"))),
            A.appendAll(inspectTarget(node, path)),
            A.appendAll(inspectAnchorRelation(node, path))
          )
        : [makeIssue(path, "deniedElement", `<${node._tag}> is not accepted by the safe policy`)];

  return A.appendAll(
    own,
    A.flatMap(runtimeChildren(node), (child, index) => inspectNode(child, A.append(path, `children.${index}`)))
  );
};

/**
 * Returns every conservative-policy issue in a conformance proof.
 *
 * **Example** (Inspect empty fragment issues)
 *
 * ```ts import.meta.vitest name="Inspect empty fragment issues"
 * import { conform, inspectSafeHtml } from "@beep/html"
 * import { Fragment } from "@beep/html/Html.model"
 * import { Effect } from "effect"
 *
 * const program = conform(Fragment.make({ children: [] })).pipe(
 *   Effect.map(inspectSafeHtml)
 * )
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const inspectSafeHtml = (value: ConformantHtml): ReadonlyArray<HtmlPolicyIssue> =>
  Result.match(S.encodeResult(HtmlRoot)(conformantRoot(value)), {
    onFailure: () => [makeIssue([], "encodingFailure", "The conformance proof did not contain an encodable HTML root")],
    onSuccess: (root) => {
      /* istanbul ignore else -- a successful HtmlRoot encoding always yields an object with a string discriminator */
      if (isRuntimeNode(root)) return inspectNode(root, []);
      return [makeIssue([], "encodingFailure", "The encoded HTML root was not an object node")];
    },
  });

/**
 * Applies the conservative safe-output policy and issues an opaque proof.
 *
 * **Example** (Enforce policy on fragment)
 *
 * ```ts import.meta.vitest name="Enforce policy on fragment"
 * import { conform, enforceSafeHtml, Fragment } from "@beep/html"
 * import { Effect } from "effect"
 *
 * const program = conform(Fragment.make({ children: [] })).pipe(
 *   Effect.flatMap(enforceSafeHtml)
 * )
 * ```
 *
 * @effects Fails with {@link HtmlPolicyError} when the conformant tree
 * violates the deny-by-default safe-output policy; otherwise issues an opaque
 * module-provenance proof.
 * @category validation
 * @since 0.0.0
 */
export const enforceSafeHtml: (value: ConformantHtml) => Effect.Effect<SafeHtmlAst, HtmlPolicyError> = Effect.fn(
  "Html.enforceSafeHtml"
)(function* (value: ConformantHtml) {
  return yield* A.match(inspectSafeHtml(value), {
    onEmpty: () => Effect.succeed(issueSafeHtmlAst(value)),
    onNonEmpty: (issues) => Effect.fail(HtmlPolicyError.make({ issues })),
  });
});

/**
 * Extracts the conformance proof from a safe-HTML AST proof.
 *
 * **Example** (Extract conformance proof)
 *
 * ```ts
 * import { conform, enforceSafeHtml, Fragment, safeHtmlAstConformant } from "@beep/html"
 * import { Effect } from "effect"
 *
 * const proof = Effect.runSync(
 *   conform(Fragment.make({ children: [] })).pipe(Effect.flatMap(enforceSafeHtml))
 * )
 * console.log(safeHtmlAstConformant(proof))
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const safeHtmlAstConformant = (value: SafeHtmlAst): ConformantHtml =>
  pipe(
    safeHtmlAstConformantValues.get(value),
    O.fromUndefinedOr,
    O.getOrThrowWith(() =>
      HtmlPolicyError.make({
        issues: [makeIssue([], "encodingFailure", "Invalid SafeHtmlAst issuer proof")],
      })
    )
  );

/**
 * Extracts the validated AST root from a safe-HTML AST proof.
 *
 * **Example** (Extract validated AST root)
 *
 * ```ts import.meta.vitest name="Extract validated AST root"
 * import { conform, enforceSafeHtml, Fragment, safeHtmlAstRoot } from "@beep/html"
 * import { Effect } from "effect"
 *
 * const proof = Effect.runSync(
 *   conform(Fragment.make({ children: [] })).pipe(Effect.flatMap(enforceSafeHtml))
 * )
 * safeHtmlAstRoot(proof)._tag // => "#fragment"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const safeHtmlAstRoot: (value: SafeHtmlAst) => HtmlRoot.Type = flow(safeHtmlAstConformant, conformantRoot);
