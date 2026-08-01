/**
 * Browser fixed-point checks for opaque SVG and MathML nodes.
 *
 * The HTML tokenizer lowercases ASCII characters in foreign tag and attribute
 * names before the tree builder applies the generated WHATWG adjustment
 * tables. Canonical serialization therefore accepts exactly the names that
 * survive that round-trip unchanged.
 *
 * @remarks
 * This internal implementation detail is shared by the conformance and
 * serialization modules. It is intentionally not a package entrypoint.
 *
 * @internal
 * @since 0.0.0
 */
import { LiteralKit } from "@beep/schema";
import { A } from "@beep/utils";
import { dual, flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ForeignElementName } from "./Html.attributes.ts";
import {
  MATHML_ATTRIBUTE_NAME_ADJUSTMENTS,
  SVG_ATTRIBUTE_NAME_ADJUSTMENTS,
  SVG_ELEMENT_NAME_ADJUSTMENTS,
  XML_FOREIGN_ATTRIBUTE_NAMES,
} from "./Html.meta.ts";
import type { ForeignNamespace } from "./Html.model.ts";

const asciiUppercaseCharacters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const isForeignElementName = S.is(ForeignElementName);
const isForeignBreakoutElementName = S.is(
  LiteralKit([
    "b",
    "big",
    "blockquote",
    "body",
    "br",
    "center",
    "code",
    "dd",
    "div",
    "dl",
    "dt",
    "em",
    "embed",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "head",
    "hr",
    "i",
    "img",
    "li",
    "listing",
    "menu",
    "meta",
    "nobr",
    "ol",
    "p",
    "pre",
    "ruby",
    "s",
    "small",
    "span",
    "strong",
    "strike",
    "sub",
    "sup",
    "table",
    "tt",
    "u",
    "ul",
    "var",
  ])
);
const isFontBreakoutAttributeName = S.is(LiteralKit(["color", "face", "size"]));
const isMathMlTextIntegrationPointName = S.is(LiteralKit(["mi", "mo", "mn", "ms", "mtext"]));
const isMathMlTextForeignChildName = S.is(LiteralKit(["malignmark", "mglyph"]));
const isSvgHtmlIntegrationPointName = S.is(LiteralKit(["desc", "foreignObject", "title"]));
const isHtmlIntegrationEncoding = S.is(LiteralKit(["application/xhtml+xml", "text/html"]));

type ForeignAttributeEntries = ReadonlyArray<readonly [string, unknown]>;

const hasForeignAttribute = (entries: ForeignAttributeEntries, predicate: (name: string) => boolean): boolean =>
  A.some(entries, ([name]) => predicate(name));

const hasHtmlIntegrationEncoding = (entries: ForeignAttributeEntries): boolean =>
  pipe(
    entries,
    A.findFirst(([name]) => name === "encoding"),
    O.map(([, value]) => value),
    O.filter(P.isString),
    O.map(toAsciiLowerCase),
    O.exists(isHtmlIntegrationEncoding)
  );

const isHtmlIntegrationPoint = (
  namespace: ForeignNamespace,
  name: string,
  attributes: ForeignAttributeEntries
): boolean =>
  namespace === "svg"
    ? isSvgHtmlIntegrationPointName(name)
    : name === "annotation-xml" && hasHtmlIntegrationEncoding(attributes);

const isMathMlTextIntegrationPoint = (namespace: ForeignNamespace, name: string): boolean =>
  namespace === "mathml" && isMathMlTextIntegrationPointName(name);

const entersForeignNamespaceFromHtml = (namespace: ForeignNamespace, name: string): boolean =>
  (namespace === "svg" && name === "svg") || (namespace === "mathml" && name === "math");

const isForeignBreakoutStartTag = (name: string, attributes: ForeignAttributeEntries): boolean =>
  isForeignBreakoutElementName(name) ||
  (name === "font" && hasForeignAttribute(attributes, isFontBreakoutAttributeName));

/**
 * Lowercases only the ASCII uppercase characters handled by the HTML tokenizer.
 *
 * @example Internal call site
 * ```ts
 * import { toAsciiLowerCase } from "./Html.foreign.ts"
 *
 * toAsciiLowerCase("customÉ") // "customÉ"
 * ```
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const toAsciiLowerCase: (value: string) => string = flow(
  Str.split(""),
  A.map((character) => (Str.includes(character)(asciiUppercaseCharacters) ? Str.toLowerCase(character) : character)),
  A.join("")
);

const browserAdjustedName = (name: string, adjustments: Readonly<Record<string, string>>): string => {
  const lowercase = toAsciiLowerCase(name);
  return adjustments[lowercase] ?? lowercase;
};

const hasMatchingNamespacePrefix = (namespace: ForeignNamespace, name: string): boolean => {
  const [prefix] = Str.split(":")(name);
  return !Str.includes(":")(name) || (namespace === "svg" ? prefix === "svg" : prefix === "mathml");
};

/**
 * Tests whether an opaque foreign element name is unchanged by HTML parsing.
 *
 * @example Internal call site
 * ```ts
 * import { isForeignElementNameFixedPoint } from "./Html.foreign.ts"
 *
 * isForeignElementNameFixedPoint("svg", "linearGradient") // true
 * isForeignElementNameFixedPoint("svg", "lineargradient") // false
 * ```
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const isForeignElementNameFixedPoint: {
  (name: string): (namespace: ForeignNamespace) => boolean;
  (namespace: ForeignNamespace, name: string): boolean;
} = dual(
  2,
  (namespace: ForeignNamespace, name: string): boolean =>
    isForeignElementName(name) &&
    hasMatchingNamespacePrefix(namespace, name) &&
    name === browserAdjustedName(name, namespace === "svg" ? SVG_ELEMENT_NAME_ADJUSTMENTS : {})
);

/**
 * Tests whether an opaque foreign attribute name is unchanged by HTML parsing.
 *
 * Qualified XML, XMLNS, and XLink names are restricted to the WHATWG
 * adjustment registry because the AST does not separately store namespace
 * metadata for arbitrary colon-prefixed attributes.
 *
 * @example Internal call site
 * ```ts
 * import { isForeignAttributeNameFixedPoint } from "./Html.foreign.ts"
 *
 * isForeignAttributeNameFixedPoint("svg", "viewBox") // true
 * isForeignAttributeNameFixedPoint("svg", "viewbox") // false
 * ```
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const isForeignAttributeNameFixedPoint: {
  (name: string): (namespace: ForeignNamespace) => boolean;
  (namespace: ForeignNamespace, name: string): boolean;
} = dual(2, (namespace: ForeignNamespace, name: string): boolean => {
  const lowercase = toAsciiLowerCase(name);
  if (Str.includes(":")(name) || lowercase === "xmlns") {
    return name === lowercase && A.contains(XML_FOREIGN_ATTRIBUTE_NAMES, lowercase);
  }
  const adjustments = namespace === "svg" ? SVG_ATTRIBUTE_NAME_ADJUSTMENTS : MATHML_ATTRIBUTE_NAME_ADJUSTMENTS;
  return name === browserAdjustedName(name, adjustments);
});

/**
 * Tests whether an HTML child remains in the HTML namespace beneath a foreign
 * parent under the WHATWG tree-construction dispatcher.
 *
 * @example Internal call site
 * ```ts
 * import { isHtmlChildAtForeignBoundary } from "./Html.foreign.ts"
 *
 * isHtmlChildAtForeignBoundary("svg", "foreignObject", []) // true
 * isHtmlChildAtForeignBoundary("svg", "g", []) // false
 * ```
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const isHtmlChildAtForeignBoundary = (
  parentNamespace: ForeignNamespace,
  parentName: string,
  parentAttributes: ForeignAttributeEntries
): boolean =>
  isHtmlIntegrationPoint(parentNamespace, parentName, parentAttributes) ||
  isMathMlTextIntegrationPoint(parentNamespace, parentName);

/**
 * Tests whether a modeled foreign child keeps its namespace and parent after
 * the WHATWG tree-construction dispatcher processes its start tag.
 *
 * @example Internal call site
 * ```ts
 * import { isForeignChildAtForeignBoundary } from "./Html.foreign.ts"
 *
 * isForeignChildAtForeignBoundary("svg", "g", [], "svg", "path", []) // true
 * isForeignChildAtForeignBoundary("svg", "g", [], "svg", "p", []) // false
 * ```
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const isForeignChildAtForeignBoundary = (
  parentNamespace: ForeignNamespace,
  parentName: string,
  parentAttributes: ForeignAttributeEntries,
  childNamespace: ForeignNamespace,
  childName: string,
  childAttributes: ForeignAttributeEntries
): boolean => {
  if (isMathMlTextIntegrationPoint(parentNamespace, parentName) && isMathMlTextForeignChildName(childName)) {
    return childNamespace === "mathml";
  }
  if (isHtmlIntegrationPoint(parentNamespace, parentName, parentAttributes)) {
    return entersForeignNamespaceFromHtml(childNamespace, childName);
  }
  if (isMathMlTextIntegrationPoint(parentNamespace, parentName)) {
    return entersForeignNamespaceFromHtml(childNamespace, childName);
  }
  if (parentNamespace === "mathml" && parentName === "annotation-xml" && childName === "svg") {
    return childNamespace === "svg";
  }
  return childNamespace === parentNamespace && !isForeignBreakoutStartTag(childName, childAttributes);
};
