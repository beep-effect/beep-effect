/**
 * GENERATED FILE — do not edit by hand. Run `bun run generate`.
 *
 * Per-element metadata for the HTML AST: DOM interface, conformance tier, void /
 * raw-text classification, and (advisory) content categories.
 *
 * @packageDocumentation \@beep/html/Html.meta
 * @since 0.0.0
 */
import { $HtmlId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

// WHATWG's tokenizer-lowercased attribute and event names are normative.
// cspell:words numoctaves onpagereveal onpageswap pointsatx pointsaty pointsatz refx refy
// cspell:words targetx targety xchannelselector ychannelselector

const $I = $HtmlId.create("Html.meta");

/**
 * Exact generated HTML element-tag domain.
 *
 * @example
 * ```ts
 * import { HtmlTag } from "@beep/html/Html.meta"
 *
 * console.log(HtmlTag.is.div("div")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlTag = LiteralKit([
  "a",
  "abbr",
  "acronym",
  "address",
  "applet",
  "area",
  "article",
  "aside",
  "audio",
  "b",
  "base",
  "basefont",
  "bdi",
  "bdo",
  "bgsound",
  "big",
  "blink",
  "blockquote",
  "body",
  "br",
  "button",
  "canvas",
  "caption",
  "center",
  "cite",
  "code",
  "col",
  "colgroup",
  "data",
  "datalist",
  "dd",
  "del",
  "details",
  "dfn",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "em",
  "embed",
  "fieldset",
  "figcaption",
  "figure",
  "font",
  "footer",
  "form",
  "frame",
  "frameset",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hgroup",
  "hr",
  "html",
  "i",
  "iframe",
  "img",
  "input",
  "ins",
  "isindex",
  "kbd",
  "keygen",
  "label",
  "legend",
  "li",
  "link",
  "listing",
  "main",
  "map",
  "mark",
  "marquee",
  "menu",
  "menuitem",
  "meta",
  "meter",
  "multicol",
  "nav",
  "nextid",
  "nobr",
  "noembed",
  "noframes",
  "noscript",
  "object",
  "ol",
  "optgroup",
  "option",
  "output",
  "p",
  "param",
  "picture",
  "plaintext",
  "pre",
  "progress",
  "q",
  "rb",
  "rp",
  "rt",
  "rtc",
  "ruby",
  "s",
  "samp",
  "script",
  "search",
  "section",
  "select",
  "selectedcontent",
  "slot",
  "small",
  "source",
  "spacer",
  "span",
  "strike",
  "strong",
  "style",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "template",
  "textarea",
  "tfoot",
  "th",
  "thead",
  "time",
  "title",
  "tr",
  "track",
  "tt",
  "u",
  "ul",
  "var",
  "video",
  "wbr",
  "xmp",
]).pipe($I.annoteSchema("HtmlTag", { description: "Exact generated HTML element-tag domain." }));

/**
 * Decoded HTML element tag.
 *
 * @example
 * ```ts
 * import type { HtmlTag } from "@beep/html/Html.meta"
 *
 * const tag: HtmlTag = "div"
 * console.log(tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlTag = typeof HtmlTag.Type;

/**
 * Advisory content-category values emitted by the WHATWG element index.
 *
 * @example
 * ```ts
 * import { HtmlCategory } from "@beep/html/Html.meta"
 *
 * console.log(HtmlCategory.is.flow("flow")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlCategory = LiteralKit([
  "embedded",
  "flow",
  "form-associated",
  "heading",
  "interactive",
  "labelable",
  "listed",
  "metadata",
  "palpable",
  "phrasing",
  "resettable",
  "script-supporting",
  "sectioning",
  "submittable",
]).pipe($I.annoteSchema("HtmlCategory", { description: "Advisory WHATWG content-category value." }));

/**
 * Decoded advisory content category.
 *
 * @example
 * ```ts
 * import type { HtmlCategory } from "@beep/html/Html.meta"
 *
 * const category: HtmlCategory = "flow"
 * console.log(category)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlCategory = typeof HtmlCategory.Type;

/**
 * Content-model tokens emitted by the pinned WHATWG element index.
 *
 * @example
 * ```ts
 * import { HtmlContentToken } from "@beep/html/Html.meta"
 *
 * console.log(HtmlContentToken.is.flow("flow")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlContentToken = LiteralKit([
  "area",
  "body",
  "button",
  "caption",
  "col",
  "colgroup",
  "data",
  "dd",
  "div",
  "dt",
  "empty",
  "figcaption",
  "flow",
  "flow select element inner content elements",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "heading content",
  "legend",
  "li",
  "metadata content",
  "one img",
  "optgroup element inner content elements",
  "option",
  "option element inner content elements",
  "or script documentation",
  "p",
  "phrasing",
  "rp",
  "rt",
  "script",
  "script-supporting elements",
  "select element inner content elements",
  "source",
  "summary",
  "tbody",
  "td",
  "template",
  "text",
  "tfoot",
  "th",
  "thead",
  "tr",
  "track",
  "transparent",
  "varies",
]).pipe($I.annoteSchema("HtmlContentToken", { description: "Pinned HTML content-model token." }));

/**
 * Decoded HTML content-model token.
 *
 * @example
 * ```ts
 * import type { HtmlContentToken } from "@beep/html/Html.meta"
 *
 * const token: HtmlContentToken = "flow"
 * console.log(token)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlContentToken = typeof HtmlContentToken.Type;

/**
 * Reviewed grammar profiles for HTML elements whose child rules include
 * ordering, cardinality, alternatives, or attribute-dependent branches.
 *
 * @example
 * ```ts
 * import { HtmlChildGrammar } from "@beep/html/Html.meta"
 *
 * console.log(HtmlChildGrammar.is.table("table")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlChildGrammar = LiteralKit([
  "colgroup",
  "contextual-div",
  "datalist",
  "description-list",
  "details",
  "document-element",
  "fieldset",
  "figure",
  "head",
  "hgroup",
  "media",
  "optgroup",
  "phrasing-or-heading",
  "picture",
  "ruby",
  "select",
  "table",
]).pipe($I.annoteSchema("HtmlChildGrammar", { description: "Reviewed HTML special-child grammar profile." }));

/**
 * Decoded HTML special-child grammar profile.
 *
 * @example
 * ```ts
 * import type { HtmlChildGrammar } from "@beep/html/Html.meta"
 *
 * const grammar: HtmlChildGrammar = "table"
 * console.log(grammar)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlChildGrammar = typeof HtmlChildGrammar.Type;

/**
 * One attribute-dependent content-category membership rule.
 *
 * @example
 * ```ts
 * import { HtmlConditionalCategoryRule } from "@beep/html/Html.meta"
 *
 * const rule = HtmlConditionalCategoryRule.make({
 *   attribute: "href",
 *   category: "interactive",
 *   condition: "present"
 * })
 * console.log(rule.category) // "interactive"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HtmlConditionalCategoryRule extends S.Class<HtmlConditionalCategoryRule>($I`HtmlConditionalCategoryRule`)(
  {
    attribute: S.String,
    category: HtmlCategory,
    condition: S.Literals(["present", "not-equals", "tokens-subset"]),
    value: S.String.pipe(S.optionalKey),
  },
  $I.annote("HtmlConditionalCategoryRule", {
    description: "Attribute predicate controlling one element content-category membership.",
  })
) {}

/**
 * WHATWG SVG element-name adjustments keyed by tokenizer-lowercased input.
 *
 * @example
 * ```ts
 * import { SVG_ELEMENT_NAME_ADJUSTMENTS } from "@beep/html/Html.meta"
 *
 * console.log(SVG_ELEMENT_NAME_ADJUSTMENTS.lineargradient) // "linearGradient"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SVG_ELEMENT_NAME_ADJUSTMENTS: Readonly<Record<string, string>> = Object.freeze({
  altglyph: "altGlyph",
  altglyphdef: "altGlyphDef",
  altglyphitem: "altGlyphItem",
  animatecolor: "animateColor",
  animatemotion: "animateMotion",
  animatetransform: "animateTransform",
  clippath: "clipPath",
  feblend: "feBlend",
  fecolormatrix: "feColorMatrix",
  fecomponenttransfer: "feComponentTransfer",
  fecomposite: "feComposite",
  feconvolvematrix: "feConvolveMatrix",
  fediffuselighting: "feDiffuseLighting",
  fedisplacementmap: "feDisplacementMap",
  fedistantlight: "feDistantLight",
  feflood: "feFlood",
  fefunca: "feFuncA",
  fefuncb: "feFuncB",
  fefuncg: "feFuncG",
  fefuncr: "feFuncR",
  fegaussianblur: "feGaussianBlur",
  feimage: "feImage",
  femerge: "feMerge",
  femergenode: "feMergeNode",
  femorphology: "feMorphology",
  feoffset: "feOffset",
  fepointlight: "fePointLight",
  fespecularlighting: "feSpecularLighting",
  fespotlight: "feSpotLight",
  fetile: "feTile",
  feturbulence: "feTurbulence",
  foreignobject: "foreignObject",
  glyphref: "glyphRef",
  lineargradient: "linearGradient",
  radialgradient: "radialGradient",
  textpath: "textPath",
});

/**
 * WHATWG SVG attribute-name adjustments keyed by tokenizer-lowercased input.
 *
 * @example
 * ```ts
 * import { SVG_ATTRIBUTE_NAME_ADJUSTMENTS } from "@beep/html/Html.meta"
 *
 * console.log(SVG_ATTRIBUTE_NAME_ADJUSTMENTS.viewbox) // "viewBox"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SVG_ATTRIBUTE_NAME_ADJUSTMENTS: Readonly<Record<string, string>> = Object.freeze({
  attributename: "attributeName",
  attributetype: "attributeType",
  basefrequency: "baseFrequency",
  baseprofile: "baseProfile",
  calcmode: "calcMode",
  clippathunits: "clipPathUnits",
  diffuseconstant: "diffuseConstant",
  edgemode: "edgeMode",
  filterunits: "filterUnits",
  glyphref: "glyphRef",
  gradienttransform: "gradientTransform",
  gradientunits: "gradientUnits",
  kernelmatrix: "kernelMatrix",
  kernelunitlength: "kernelUnitLength",
  keypoints: "keyPoints",
  keysplines: "keySplines",
  keytimes: "keyTimes",
  lengthadjust: "lengthAdjust",
  limitingconeangle: "limitingConeAngle",
  markerheight: "markerHeight",
  markerunits: "markerUnits",
  markerwidth: "markerWidth",
  maskcontentunits: "maskContentUnits",
  maskunits: "maskUnits",
  numoctaves: "numOctaves",
  pathlength: "pathLength",
  patterncontentunits: "patternContentUnits",
  patterntransform: "patternTransform",
  patternunits: "patternUnits",
  pointsatx: "pointsAtX",
  pointsaty: "pointsAtY",
  pointsatz: "pointsAtZ",
  preservealpha: "preserveAlpha",
  preserveaspectratio: "preserveAspectRatio",
  primitiveunits: "primitiveUnits",
  refx: "refX",
  refy: "refY",
  repeatcount: "repeatCount",
  repeatdur: "repeatDur",
  requiredextensions: "requiredExtensions",
  requiredfeatures: "requiredFeatures",
  specularconstant: "specularConstant",
  specularexponent: "specularExponent",
  spreadmethod: "spreadMethod",
  startoffset: "startOffset",
  stddeviation: "stdDeviation",
  stitchtiles: "stitchTiles",
  surfacescale: "surfaceScale",
  systemlanguage: "systemLanguage",
  tablevalues: "tableValues",
  targetx: "targetX",
  targety: "targetY",
  textlength: "textLength",
  viewbox: "viewBox",
  viewtarget: "viewTarget",
  xchannelselector: "xChannelSelector",
  ychannelselector: "yChannelSelector",
  zoomandpan: "zoomAndPan",
});

/**
 * WHATWG MathML attribute-name adjustments keyed by tokenizer-lowercased input.
 *
 * @example
 * ```ts
 * import { MATHML_ATTRIBUTE_NAME_ADJUSTMENTS } from "@beep/html/Html.meta"
 *
 * console.log(MATHML_ATTRIBUTE_NAME_ADJUSTMENTS.definitionurl) // "definitionURL"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MATHML_ATTRIBUTE_NAME_ADJUSTMENTS: Readonly<Record<string, string>> = Object.freeze({
  definitionurl: "definitionURL",
});

/**
 * Foreign qualified attributes whose HTML parser adjustment assigns an XML,
 * XMLNS, or XLink namespace while preserving this serialized name.
 *
 * @example
 * ```ts
 * import { XML_FOREIGN_ATTRIBUTE_NAMES } from "@beep/html/Html.meta"
 *
 * console.log(XML_FOREIGN_ATTRIBUTE_NAMES.includes("xlink:href")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const XML_FOREIGN_ATTRIBUTE_NAMES: ReadonlyArray<string> = Object.freeze([
  "xlink:actuate",
  "xlink:arcrole",
  "xlink:href",
  "xlink:role",
  "xlink:show",
  "xlink:title",
  "xlink:type",
  "xml:lang",
  "xml:space",
  "xmlns",
  "xmlns:xlink",
]);

/**
 * Shared current attributes permitted on every generated HTML element.
 *
 * Per-element metadata reuses this frozen inventory and appends only its
 * element-specific current attributes.
 *
 * @example
 * ```ts
 * import { HTML_GLOBAL_ATTRIBUTE_NAMES } from "@beep/html/Html.meta"
 *
 * console.log(HTML_GLOBAL_ATTRIBUTE_NAMES.includes("inert")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_GLOBAL_ATTRIBUTE_NAMES: ReadonlyArray<string> = Object.freeze([
  "accesskey",
  "aria-activedescendant",
  "aria-atomic",
  "aria-autocomplete",
  "aria-braillelabel",
  "aria-brailleroledescription",
  "aria-busy",
  "aria-checked",
  "aria-colcount",
  "aria-colindex",
  "aria-colindextext",
  "aria-colspan",
  "aria-controls",
  "aria-current",
  "aria-describedby",
  "aria-description",
  "aria-details",
  "aria-disabled",
  "aria-dropeffect",
  "aria-errormessage",
  "aria-expanded",
  "aria-flowto",
  "aria-grabbed",
  "aria-haspopup",
  "aria-hidden",
  "aria-invalid",
  "aria-keyshortcuts",
  "aria-label",
  "aria-labelledby",
  "aria-level",
  "aria-live",
  "aria-modal",
  "aria-multiline",
  "aria-multiselectable",
  "aria-orientation",
  "aria-owns",
  "aria-placeholder",
  "aria-posinset",
  "aria-pressed",
  "aria-readonly",
  "aria-relevant",
  "aria-required",
  "aria-roledescription",
  "aria-rowcount",
  "aria-rowindex",
  "aria-rowindextext",
  "aria-rowspan",
  "aria-selected",
  "aria-setsize",
  "aria-sort",
  "aria-valuemax",
  "aria-valuemin",
  "aria-valuenow",
  "aria-valuetext",
  "autocapitalize",
  "autocorrect",
  "autofocus",
  "class",
  "contenteditable",
  "dataset",
  "dir",
  "draggable",
  "enterkeyhint",
  "exportparts",
  "headingoffset",
  "headingreset",
  "hidden",
  "id",
  "inert",
  "inputmode",
  "is",
  "itemid",
  "itemprop",
  "itemref",
  "itemscope",
  "itemtype",
  "lang",
  "nonce",
  "onabort",
  "onauxclick",
  "onbeforeinput",
  "onbeforematch",
  "onbeforetoggle",
  "onblur",
  "oncancel",
  "oncanplay",
  "oncanplaythrough",
  "onchange",
  "onclick",
  "onclose",
  "oncommand",
  "oncontextlost",
  "oncontextmenu",
  "oncontextrestored",
  "oncopy",
  "oncuechange",
  "oncut",
  "ondblclick",
  "ondrag",
  "ondragend",
  "ondragenter",
  "ondragleave",
  "ondragover",
  "ondragstart",
  "ondrop",
  "ondurationchange",
  "onemptied",
  "onended",
  "onerror",
  "onfocus",
  "onformdata",
  "oninput",
  "oninvalid",
  "onkeydown",
  "onkeypress",
  "onkeyup",
  "onload",
  "onloadeddata",
  "onloadedmetadata",
  "onloadstart",
  "onmousedown",
  "onmouseenter",
  "onmouseleave",
  "onmousemove",
  "onmouseout",
  "onmouseover",
  "onmouseup",
  "onpaste",
  "onpause",
  "onplay",
  "onplaying",
  "onprogress",
  "onratechange",
  "onreset",
  "onresize",
  "onscroll",
  "onscrollend",
  "onsecuritypolicyviolation",
  "onseeked",
  "onseeking",
  "onselect",
  "onslotchange",
  "onstalled",
  "onsubmit",
  "onsuspend",
  "ontimeupdate",
  "ontoggle",
  "onvolumechange",
  "onwaiting",
  "onwheel",
  "part",
  "popover",
  "role",
  "slot",
  "spellcheck",
  "style",
  "tabindex",
  "title",
  "translate",
  "writingsuggestions",
]);

/**
 * Reviewed expansions for context-sensitive content-model tokens emitted by
 * the non-normative WHATWG element index.
 *
 * @example
 * ```ts
 * import { HTML_CONTENT_TOKEN_EXPANSIONS } from "@beep/html/Html.meta"
 *
 * console.log(HTML_CONTENT_TOKEN_EXPANSIONS["option element inner content elements"]) // ["phrasing"]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_CONTENT_TOKEN_EXPANSIONS: Readonly<Record<string, ReadonlyArray<string>>> = Object.freeze({
  "flow select element inner content elements": Object.freeze([
    "div",
    "hr",
    "optgroup",
    "option",
    "script-supporting elements",
  ]),
  "optgroup element inner content elements": Object.freeze(["div", "optgroup", "option", "script-supporting elements"]),
  "option element inner content elements": Object.freeze(["phrasing"]),
  "select element inner content elements": Object.freeze([
    "div",
    "hr",
    "optgroup",
    "option",
    "script-supporting elements",
  ]),
});

/**
 * Generator-owned autocomplete field groups from the WHATWG control table.
 *
 * @example
 * ```ts
 * import { HTML_AUTOCOMPLETE_FIELD_GROUPS } from "@beep/html/Html.meta"
 *
 * console.log(HTML_AUTOCOMPLETE_FIELD_GROUPS.password.includes("new-password")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_AUTOCOMPLETE_FIELD_GROUPS: Readonly<Record<string, ReadonlyArray<string>>> = Object.freeze({
  date: Object.freeze(["bday"]),
  month: Object.freeze(["cc-exp"]),
  multiline: Object.freeze(["street-address"]),
  numeric: Object.freeze(["bday-day", "bday-month", "bday-year", "cc-exp-month", "cc-exp-year", "transaction-amount"]),
  password: Object.freeze(["current-password", "new-password", "one-time-code"]),
  tel: Object.freeze([
    "tel",
    "tel-area-code",
    "tel-country-code",
    "tel-extension",
    "tel-local",
    "tel-local-prefix",
    "tel-local-suffix",
    "tel-national",
  ]),
  text: Object.freeze([
    "additional-name",
    "address-level1",
    "address-level2",
    "address-level3",
    "address-level4",
    "address-line1",
    "address-line2",
    "address-line3",
    "cc-additional-name",
    "cc-csc",
    "cc-family-name",
    "cc-given-name",
    "cc-name",
    "cc-number",
    "cc-type",
    "country",
    "country-name",
    "family-name",
    "given-name",
    "honorific-prefix",
    "honorific-suffix",
    "language",
    "name",
    "nickname",
    "organization",
    "organization-title",
    "postal-code",
    "sex",
    "transaction-currency",
  ]),
  url: Object.freeze(["impp", "photo", "url"]),
  username: Object.freeze(["email", "username"]),
});

/**
 * Generator-owned input-state compatibility for autocomplete field groups.
 *
 * @example
 * ```ts
 * import { HTML_AUTOCOMPLETE_INPUT_STATE_GROUPS } from "@beep/html/Html.meta"
 *
 * console.log(HTML_AUTOCOMPLETE_INPUT_STATE_GROUPS.email.includes("username")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_AUTOCOMPLETE_INPUT_STATE_GROUPS: Readonly<Record<string, ReadonlyArray<string>>> = Object.freeze({
  button: Object.freeze([]),
  checkbox: Object.freeze([]),
  color: Object.freeze([]),
  date: Object.freeze(["date"]),
  "datetime-local": Object.freeze([]),
  email: Object.freeze(["username"]),
  file: Object.freeze([]),
  hidden: Object.freeze(["date", "month", "multiline", "numeric", "password", "tel", "text", "url", "username"]),
  image: Object.freeze([]),
  month: Object.freeze(["month"]),
  number: Object.freeze(["numeric"]),
  password: Object.freeze(["password"]),
  radio: Object.freeze([]),
  range: Object.freeze([]),
  reset: Object.freeze([]),
  search: Object.freeze(["date", "month", "multiline", "numeric", "password", "tel", "text", "url", "username"]),
  submit: Object.freeze([]),
  tel: Object.freeze(["tel"]),
  text: Object.freeze(["date", "month", "multiline", "numeric", "password", "tel", "text", "url", "username"]),
  time: Object.freeze([]),
  url: Object.freeze(["url"]),
  week: Object.freeze([]),
});

/**
 * Autocomplete fields that may carry a contact-recipient hint.
 *
 * @example
 * ```ts
 * import { HTML_AUTOCOMPLETE_CONTACT_FIELDS } from "@beep/html/Html.meta"
 *
 * console.log(HTML_AUTOCOMPLETE_CONTACT_FIELDS.includes("email")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_AUTOCOMPLETE_CONTACT_FIELDS: ReadonlyArray<string> = Object.freeze([
  "email",
  "impp",
  "tel",
  "tel-area-code",
  "tel-country-code",
  "tel-extension",
  "tel-local",
  "tel-local-prefix",
  "tel-local-suffix",
  "tel-national",
]);

/**
 * Exact conditional attribute applicability for every input type state.
 *
 * @example
 * ```ts
 * import { HTML_INPUT_ATTRIBUTE_APPLICABILITY } from "@beep/html/Html.meta"
 *
 * console.log(HTML_INPUT_ATTRIBUTE_APPLICABILITY.file.includes("accept")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_INPUT_ATTRIBUTE_APPLICABILITY: Readonly<Record<string, ReadonlyArray<string>>> = Object.freeze({
  button: Object.freeze(["popovertarget", "popovertargetaction"]),
  checkbox: Object.freeze(["checked", "required"]),
  color: Object.freeze(["alpha", "autocomplete", "colorspace", "list"]),
  date: Object.freeze(["autocomplete", "list", "max", "min", "readonly", "required", "step"]),
  "datetime-local": Object.freeze(["autocomplete", "list", "max", "min", "readonly", "required", "step"]),
  email: Object.freeze([
    "autocomplete",
    "dirname",
    "list",
    "maxlength",
    "minlength",
    "multiple",
    "pattern",
    "placeholder",
    "readonly",
    "required",
    "size",
  ]),
  file: Object.freeze(["accept", "multiple", "required"]),
  hidden: Object.freeze(["autocomplete", "dirname"]),
  image: Object.freeze([
    "alt",
    "formaction",
    "formenctype",
    "formmethod",
    "formnovalidate",
    "formtarget",
    "height",
    "popovertarget",
    "popovertargetaction",
    "src",
    "width",
  ]),
  month: Object.freeze(["autocomplete", "list", "max", "min", "readonly", "required", "step"]),
  number: Object.freeze(["autocomplete", "list", "max", "min", "placeholder", "readonly", "required", "step"]),
  password: Object.freeze([
    "autocomplete",
    "dirname",
    "maxlength",
    "minlength",
    "pattern",
    "placeholder",
    "readonly",
    "required",
    "size",
  ]),
  radio: Object.freeze(["checked", "required"]),
  range: Object.freeze(["autocomplete", "list", "max", "min", "step"]),
  reset: Object.freeze(["popovertarget", "popovertargetaction"]),
  search: Object.freeze([
    "autocomplete",
    "dirname",
    "list",
    "maxlength",
    "minlength",
    "pattern",
    "placeholder",
    "readonly",
    "required",
    "size",
  ]),
  submit: Object.freeze([
    "dirname",
    "formaction",
    "formenctype",
    "formmethod",
    "formnovalidate",
    "formtarget",
    "popovertarget",
    "popovertargetaction",
  ]),
  tel: Object.freeze([
    "autocomplete",
    "dirname",
    "list",
    "maxlength",
    "minlength",
    "pattern",
    "placeholder",
    "readonly",
    "required",
    "size",
  ]),
  text: Object.freeze([
    "autocomplete",
    "dirname",
    "list",
    "maxlength",
    "minlength",
    "pattern",
    "placeholder",
    "readonly",
    "required",
    "size",
  ]),
  time: Object.freeze(["autocomplete", "list", "max", "min", "readonly", "required", "step"]),
  url: Object.freeze([
    "autocomplete",
    "dirname",
    "list",
    "maxlength",
    "minlength",
    "pattern",
    "placeholder",
    "readonly",
    "required",
    "size",
  ]),
  week: Object.freeze(["autocomplete", "list", "max", "min", "readonly", "required", "step"]),
});

/**
 * Conditional input attributes covered by the applicability table.
 *
 * @example
 * ```ts
 * import { HTML_CONDITIONAL_INPUT_ATTRIBUTE_NAMES } from "@beep/html/Html.meta"
 *
 * console.log(HTML_CONDITIONAL_INPUT_ATTRIBUTE_NAMES.includes("autocomplete")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_CONDITIONAL_INPUT_ATTRIBUTE_NAMES: ReadonlyArray<string> = Object.freeze([
  "accept",
  "alpha",
  "alt",
  "autocomplete",
  "checked",
  "colorspace",
  "dirname",
  "formaction",
  "formenctype",
  "formmethod",
  "formnovalidate",
  "formtarget",
  "height",
  "list",
  "max",
  "maxlength",
  "min",
  "minlength",
  "multiple",
  "pattern",
  "placeholder",
  "popovertarget",
  "popovertargetaction",
  "readonly",
  "required",
  "size",
  "src",
  "step",
  "width",
]);

/**
 * Button attributes permitted only for effective submit buttons.
 *
 * @example
 * ```ts
 * import { HTML_BUTTON_SUBMIT_ONLY_ATTRIBUTES } from "@beep/html/Html.meta"
 *
 * console.log(HTML_BUTTON_SUBMIT_ONLY_ATTRIBUTES.includes("formaction")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_BUTTON_SUBMIT_ONLY_ATTRIBUTES: ReadonlyArray<string> = Object.freeze([
  "formaction",
  "formenctype",
  "formmethod",
  "formnovalidate",
  "formtarget",
]);

/**
 * Reviewed icon relation tokens used by link-specific attributes.
 *
 * @example
 * ```ts
 * import { HTML_ICON_LINK_RELATIONS } from "@beep/html/Html.meta"
 *
 * console.log(HTML_ICON_LINK_RELATIONS.includes("apple-touch-icon")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_ICON_LINK_RELATIONS: ReadonlyArray<string> = Object.freeze(["icon", "apple-touch-icon"]);

/**
 * Element/attribute keys using the HTML ID-reference-list microsyntax.
 *
 * @example
 * ```ts
 * import { HTML_ID_REFERENCE_LIST_ATTRIBUTES } from "@beep/html/Html.meta"
 *
 * console.log(HTML_ID_REFERENCE_LIST_ATTRIBUTES.includes("output/for")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_ID_REFERENCE_LIST_ATTRIBUTES: ReadonlyArray<string> = Object.freeze([
  "output/for",
  "td/headers",
  "th/headers",
]);

/**
 * Element/attribute keys containing one case-sensitive HTML ID reference.
 *
 * @example
 * ```ts
 * import { HTML_ID_REFERENCE_ATTRIBUTES } from "@beep/html/Html.meta"
 *
 * console.log(HTML_ID_REFERENCE_ATTRIBUTES.includes("button/commandfor")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_ID_REFERENCE_ATTRIBUTES: ReadonlyArray<string> = Object.freeze(["button/commandfor"]);

/**
 * Text parsing and serialization mode of an HTML element.
 *
 * @example
 * ```ts
 * import { HtmlTextMode } from "@beep/html/Html.meta"
 *
 * console.log(HtmlTextMode.is.rcdata("rcdata")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlTextMode = LiteralKit(["normal", "raw-text", "rcdata", "plaintext"]).pipe(
  $I.annoteSchema("HtmlTextMode", { description: "HTML text parsing and serialization mode." })
);

/**
 * Decoded HTML text mode.
 *
 * @example
 * ```ts
 * import type { HtmlTextMode } from "@beep/html/Html.meta"
 *
 * const mode: HtmlTextMode = "normal"
 * console.log(mode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlTextMode = typeof HtmlTextMode.Type;

/**
 * Authoritative generated domain of HTML boolean attribute names.
 *
 * @example
 * ```ts
 * import { HtmlBooleanAttributeName } from "@beep/html/Html.meta"
 *
 * console.log(HtmlBooleanAttributeName.is.disabled("disabled")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlBooleanAttributeName = LiteralKit([
  "allowfullscreen",
  "alpha",
  "async",
  "autofocus",
  "autoplay",
  "checked",
  "compact",
  "controls",
  "declare",
  "default",
  "defer",
  "disabled",
  "formnovalidate",
  "headingreset",
  "inert",
  "ismap",
  "itemscope",
  "loop",
  "multiple",
  "muted",
  "nomodule",
  "noresize",
  "noshade",
  "novalidate",
  "nowrap",
  "open",
  "playsinline",
  "pubdate",
  "readonly",
  "required",
  "reversed",
  "scoped",
  "seamless",
  "selected",
  "shadowrootclonable",
  "shadowrootcustomelementregistry",
  "shadowrootdelegatesfocus",
  "shadowrootserializable",
  "truespeed",
]).pipe(
  $I.annoteSchema("HtmlBooleanAttributeName", {
    description: "Authoritative HTML boolean attribute-name domain used by generation and serialization.",
  })
);

/**
 * Decoded HTML boolean attribute name.
 *
 * @example
 * ```ts
 * import { HtmlBooleanAttributeName } from "@beep/html/Html.meta"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(HtmlBooleanAttributeName)("disabled")
 * if (Result.isSuccess(decoded)) {
 *   const name: HtmlBooleanAttributeName = decoded.success
 *   console.log(name) // "disabled"
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlBooleanAttributeName = typeof HtmlBooleanAttributeName.Type;

/**
 * Reviewed HTML attribute microsyntaxes that require conformance inspection
 * beyond their lossless wire schemas.
 *
 * @example
 * ```ts
 * import { HtmlAttributeSyntax } from "@beep/html/Html.meta"
 *
 * console.log(HtmlAttributeSyntax.is.srcset("srcset")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlAttributeSyntax = LiteralKit(["icon-sizes", "source-size-list", "srcset"]).pipe(
  $I.annoteSchema("HtmlAttributeSyntax", {
    description: "Reviewed HTML attribute microsyntax requiring specialized conformance inspection.",
  })
);

/**
 * Decoded reviewed HTML attribute microsyntax.
 *
 * @example
 * ```ts
 * import type { HtmlAttributeSyntax } from "@beep/html/Html.meta"
 *
 * const syntax: HtmlAttributeSyntax = "srcset"
 * console.log(syntax)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlAttributeSyntax = typeof HtmlAttributeSyntax.Type;

/**
 * Exact generator-owned mapping from element/attribute pairs to specialized
 * conformance microsyntaxes.
 *
 * @example
 * ```ts
 * import { HTML_ATTRIBUTE_SYNTAXES } from "@beep/html/Html.meta"
 *
 * console.log(HTML_ATTRIBUTE_SYNTAXES["link/sizes"]) // "icon-sizes"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_ATTRIBUTE_SYNTAXES: Readonly<Record<string, HtmlAttributeSyntax>> = Object.freeze({
  "img/sizes": "source-size-list",
  "img/srcset": "srcset",
  "link/imagesizes": "source-size-list",
  "link/imagesrcset": "srcset",
  "link/sizes": "icon-sizes",
  "source/sizes": "source-size-list",
  "source/srcset": "srcset",
});

/**
 * Generated same-value relationship between two HTML attributes.
 *
 * @example
 * ```ts
 * import { HtmlAttributeEquality } from "@beep/html/Html.meta"
 *
 * const equality = HtmlAttributeEquality.make({
 *   left: "id",
 *   message: "id must equal name",
 *   right: "name"
 * })
 * console.log(equality.right) // "name"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HtmlAttributeEquality extends S.Class<HtmlAttributeEquality>($I`HtmlAttributeEquality`)(
  {
    left: S.String,
    message: S.String,
    right: S.String,
  },
  $I.annote("HtmlAttributeEquality", {
    description: "Generated same-value relationship between two HTML attributes.",
  })
) {}

const HtmlAttributeValueConstraint = S.Union([
  S.TaggedStruct("allowedValues", {
    attribute: S.String,
    values: S.String.pipe(S.NonEmptyArray),
  }),
  S.TaggedStruct("containsAllTokens", {
    attribute: S.String,
    values: S.String.pipe(S.NonEmptyArray),
  }),
  S.TaggedStruct("containsAnyToken", {
    attribute: S.String,
    values: S.String.pipe(S.NonEmptyArray),
  }),
  S.TaggedStruct("equals", {
    asciiCaseInsensitive: S.Boolean.pipe(S.optionalKey),
    attribute: S.String,
    value: S.String,
  }),
]).pipe(
  $I.annoteSchema("HtmlAttributeValueConstraint", {
    description: "Generated relationship constraint over an HTML attribute value.",
  })
);

const HtmlAttributeRequirementPredicate = S.Union([
  S.TaggedStruct("attributeContainsToken", { attribute: S.String, value: S.String }),
  S.TaggedStruct("attributeEquals", { attribute: S.String, value: S.String }),
  S.TaggedStruct("attributePresent", { attribute: S.String }),
]).pipe(
  $I.annoteSchema("HtmlAttributeRequirementPredicate", {
    description: "Generated predicate controlling when an HTML attribute requirement applies.",
  })
);

/**
 * Generated conditional requirement or exclusion for HTML attributes.
 *
 * @example
 * ```ts
 * import { HtmlAttributeRequirement } from "@beep/html/Html.meta"
 *
 * const requirement = HtmlAttributeRequirement.make({
 *   message: "target requires href",
 *   required: [["href"]],
 *   when: { _tag: "attributePresent", attribute: "target" }
 * })
 * console.log(requirement.required[0])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HtmlAttributeRequirement extends S.Class<HtmlAttributeRequirement>($I`HtmlAttributeRequirement`)(
  {
    constraints: HtmlAttributeValueConstraint.pipe(S.NonEmptyArray, S.optionalKey),
    forbidden: S.String.pipe(S.NonEmptyArray, S.optionalKey),
    message: S.String,
    nonBlank: S.String.pipe(S.NonEmptyArray, S.optionalKey),
    required: S.String.pipe(S.NonEmptyArray, S.NonEmptyArray),
    validNonEmptyUrl: S.String.pipe(S.NonEmptyArray, S.optionalKey),
    when: HtmlAttributeRequirementPredicate.pipe(S.optionalKey),
    whenParents: HtmlTag.pipe(S.NonEmptyArray, S.optionalKey),
  },
  $I.annote("HtmlAttributeRequirement", {
    description: "Generated conditional requirement or exclusion for HTML attributes.",
  })
) {}

/**
 * Generated less-than-or-equal relationship between numeric attributes.
 *
 * @example
 * ```ts
 * import { HtmlNumericAttributeRelationship } from "@beep/html/Html.meta"
 *
 * const relationship = HtmlNumericAttributeRelationship.make({
 *   left: "value",
 *   message: "value must not exceed max",
 *   right: "max",
 *   rightDefault: 1
 * })
 * console.log(relationship.right)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HtmlNumericAttributeRelationship extends S.Class<HtmlNumericAttributeRelationship>(
  $I`HtmlNumericAttributeRelationship`
)(
  {
    left: S.String,
    leftDefault: S.Finite.pipe(S.optionalKey),
    message: S.String,
    right: S.String,
    rightDefault: S.Finite.pipe(S.optionalKey),
  },
  $I.annote("HtmlNumericAttributeRelationship", {
    description: "Generated less-than-or-equal relationship between two HTML numeric attributes.",
  })
) {}

/**
 * Generated exclusions that apply to every descendant of one HTML element.
 *
 * @example
 * ```ts
 * import { HtmlForbiddenDescendants } from "@beep/html/Html.meta"
 *
 * const rule = HtmlForbiddenDescendants.make({
 *   attributes: [],
 *   categories: [],
 *   tags: ["dfn"]
 * })
 * console.log(rule.tags[0]) // "dfn"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HtmlForbiddenDescendants extends S.Class<HtmlForbiddenDescendants>($I`HtmlForbiddenDescendants`)(
  {
    attributes: S.Array(S.String),
    categories: S.Array(HtmlCategory),
    tags: S.Array(HtmlTag),
  },
  $I.annote("HtmlForbiddenDescendants", {
    description: "Generated exclusions applying to every descendant of one HTML element.",
  })
) {}

/**
 * Generated exclusion for an ancestor with an author-provided accessible name.
 *
 * @example
 * ```ts
 * import { HtmlForbiddenNamedAncestor } from "@beep/html/Html.meta"
 *
 * const rule = HtmlForbiddenNamedAncestor.make({
 *   attributes: ["aria-label", "aria-labelledby", "title"],
 *   tag: "form"
 * })
 * console.log(rule.tag) // "form"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HtmlForbiddenNamedAncestor extends S.Class<HtmlForbiddenNamedAncestor>($I`HtmlForbiddenNamedAncestor`)(
  {
    attributes: S.String.pipe(S.NonEmptyArray),
    tag: HtmlTag,
  },
  $I.annote("HtmlForbiddenNamedAncestor", {
    description: "Generated ancestor exclusion activated by a nonblank accessible-name source attribute.",
  })
) {}

/**
 * Generated document-wide visibility-aware element limit.
 *
 * @example
 * ```ts
 * import { HtmlDocumentVisibilityLimit } from "@beep/html/Html.meta"
 *
 * const rule = HtmlDocumentVisibilityLimit.make({ maximum: 1, unlessAttribute: "hidden" })
 * console.log(rule.maximum) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HtmlDocumentVisibilityLimit extends S.Class<HtmlDocumentVisibilityLimit>($I`HtmlDocumentVisibilityLimit`)(
  {
    maximum: S.Int.check(S.isGreaterThan(0)),
    unlessAttribute: S.String,
  },
  $I.annote("HtmlDocumentVisibilityLimit", {
    description: "Generated document-wide visible-element cardinality limit.",
  })
) {}

/**
 * Generated element-specific conformance rules absent from the tabular WHATWG index.
 *
 * @example
 * ```ts
 * import { HtmlElementConformanceRules } from "@beep/html/Html.meta"
 *
 * const rules = HtmlElementConformanceRules.make({ permittedAncestors: ["body", "html"] })
 * console.log(rules.permittedAncestors)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HtmlElementConformanceRules extends S.Class<HtmlElementConformanceRules>($I`HtmlElementConformanceRules`)(
  {
    documentVisibilityLimit: HtmlDocumentVisibilityLimit.pipe(S.optionalKey),
    forbiddenDescendants: HtmlForbiddenDescendants.pipe(S.optionalKey),
    forbiddenNamedAncestors: HtmlForbiddenNamedAncestor.pipe(S.NonEmptyArray, S.optionalKey),
    permittedAncestors: HtmlTag.pipe(S.NonEmptyArray, S.optionalKey),
    requiredAncestor: HtmlTag.pipe(S.optionalKey),
  },
  $I.annote("HtmlElementConformanceRules", {
    description: "Generated element-specific rules absent from the tabular WHATWG element index.",
  })
) {}

/**
 * Schema describing one HTML element kind's metadata.
 *
 * @example
 * ```ts
 * import { ELEMENT_META, HtmlElementMeta } from "@beep/html/Html.meta"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HtmlElementMeta)(ELEMENT_META.div)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HtmlElementMeta extends S.Class<HtmlElementMeta>($I`HtmlElementMeta`)(
  {
    tag: HtmlTag,
    interface: S.NonEmptyString,
    conformance: S.Literals(["conforming", "non-conforming"]),
    void: S.Boolean,
    rawText: S.Boolean,
    textMode: HtmlTextMode,
    categories: S.Array(HtmlCategory),
    children: S.Array(HtmlContentToken),
    currentAttributes: S.Array(S.String),
    obsoleteAttributes: S.Array(S.String),
    conditionalCategories: S.Array(HtmlConditionalCategoryRule),
    attributeEqualities: S.Array(HtmlAttributeEquality),
    attributeRequirements: S.Array(HtmlAttributeRequirement),
    numericAttributeRelationships: S.Array(HtmlNumericAttributeRelationship),
    rules: HtmlElementConformanceRules,
    uniqueAttributes: S.Array(S.String),
    childSequencePattern: S.String.pipe(S.optionalKey),
    childGrammar: HtmlChildGrammar.pipe(S.optionalKey),
  },
  $I.annote("HtmlElementMeta", { description: "Metadata describing one HTML element kind." })
) {}

const freezeElementConformanceRules = (value: HtmlElementConformanceRules): HtmlElementConformanceRules => {
  if (value.documentVisibilityLimit !== undefined) {
    Object.freeze(value.documentVisibilityLimit);
  }
  if (value.forbiddenDescendants !== undefined) {
    Object.freeze(value.forbiddenDescendants.attributes);
    Object.freeze(value.forbiddenDescendants.categories);
    Object.freeze(value.forbiddenDescendants.tags);
    Object.freeze(value.forbiddenDescendants);
  }
  if (value.forbiddenNamedAncestors !== undefined) {
    for (const condition of value.forbiddenNamedAncestors) {
      Object.freeze(condition.attributes);
      Object.freeze(condition);
    }
    Object.freeze(value.forbiddenNamedAncestors);
  }
  if (value.permittedAncestors !== undefined) {
    Object.freeze(value.permittedAncestors);
  }
  return Object.freeze(value);
};

const freezeElementMeta = (value: HtmlElementMeta): HtmlElementMeta => {
  Object.freeze(value.categories);
  Object.freeze(value.children);
  for (const rule of value.conditionalCategories) Object.freeze(rule);
  Object.freeze(value.conditionalCategories);
  for (const equality of value.attributeEqualities) Object.freeze(equality);
  Object.freeze(value.attributeEqualities);
  for (const requirement of value.attributeRequirements) {
    if (requirement.constraints !== undefined) {
      for (const constraint of requirement.constraints) {
        if ("values" in constraint) Object.freeze(constraint.values);
        Object.freeze(constraint);
      }
      Object.freeze(requirement.constraints);
    }
    if (requirement.forbidden !== undefined) Object.freeze(requirement.forbidden);
    if (requirement.when !== undefined) Object.freeze(requirement.when);
    if (requirement.whenParents !== undefined) Object.freeze(requirement.whenParents);
    if (requirement.nonBlank !== undefined) Object.freeze(requirement.nonBlank);
    if (requirement.validNonEmptyUrl !== undefined) Object.freeze(requirement.validNonEmptyUrl);
    for (const alternatives of requirement.required) Object.freeze(alternatives);
    Object.freeze(requirement.required);
    Object.freeze(requirement);
  }
  Object.freeze(value.attributeRequirements);
  Object.freeze(value.currentAttributes);
  for (const relationship of value.numericAttributeRelationships) Object.freeze(relationship);
  Object.freeze(value.numericAttributeRelationships);
  Object.freeze(value.obsoleteAttributes);
  freezeElementConformanceRules(value.rules);
  Object.freeze(value.uniqueAttributes);
  return Object.freeze(value);
};

const elementMetaSource: Readonly<Record<HtmlTag, S.Codec.Encoded<typeof HtmlElementMeta>>> = {
  a: {
    tag: "a",
    interface: "HTMLAnchorElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "interactive", "palpable"],
    children: ["transparent"],
    currentAttributes: [
      ...HTML_GLOBAL_ATTRIBUTE_NAMES,
      ...["download", "href", "hreflang", "ping", "referrerpolicy", "rel", "target", "type"],
    ],
    obsoleteAttributes: ["charset", "coords", "methods", "name", "rev", "shape", "urn"],
    conditionalCategories: [{ attribute: "href", category: "interactive", condition: "present" }],
    attributeEqualities: [],
    attributeRequirements: [
      {
        message: "<a target> requires href",
        required: [["href"]],
        when: { _tag: "attributePresent", attribute: "target" },
      },
    ],
    numericAttributeRelationships: [],
    rules: { forbiddenDescendants: { attributes: ["tabindex"], categories: ["interactive"], tags: ["a"] } },
    uniqueAttributes: [],
  },
  abbr: {
    tag: "abbr",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  acronym: {
    tag: "acronym",
    interface: "HTMLElement",
    conformance: "non-conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  address: {
    tag: "address",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "palpable"],
    children: ["flow"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {
      forbiddenDescendants: {
        attributes: [],
        categories: ["heading", "sectioning"],
        tags: ["address", "footer", "header"],
      },
    },
    uniqueAttributes: [],
  },
  applet: {
    tag: "applet",
    interface: "HTMLUnknownElement",
    conformance: "non-conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  area: {
    tag: "area",
    interface: "HTMLAreaElement",
    conformance: "conforming",
    void: true,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing"],
    children: ["empty"],
    currentAttributes: [
      ...HTML_GLOBAL_ATTRIBUTE_NAMES,
      ...["alt", "coords", "download", "href", "ping", "referrerpolicy", "rel", "shape", "target"],
    ],
    obsoleteAttributes: ["hreflang", "nohref", "type"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [
      {
        message: "<area href> requires alt text",
        required: [["alt"]],
        when: { _tag: "attributePresent", attribute: "href" },
      },
    ],
    numericAttributeRelationships: [],
    rules: { requiredAncestor: "map" },
    uniqueAttributes: [],
  },
  article: {
    tag: "article",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "sectioning", "palpable"],
    children: ["flow"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  aside: {
    tag: "aside",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "sectioning", "palpable"],
    children: ["flow"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  audio: {
    tag: "audio",
    interface: "HTMLAudioElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "embedded", "interactive", "palpable"],
    children: ["source", "track", "transparent"],
    currentAttributes: [
      ...HTML_GLOBAL_ATTRIBUTE_NAMES,
      ...["autoplay", "controls", "crossorigin", "loading", "loop", "muted", "preload", "src"],
    ],
    obsoleteAttributes: [],
    conditionalCategories: [{ attribute: "controls", category: "interactive", condition: "present" }],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: { forbiddenDescendants: { attributes: [], categories: [], tags: ["audio", "video"] } },
    uniqueAttributes: [],
    childGrammar: "media",
  },
  b: {
    tag: "b",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  base: {
    tag: "base",
    interface: "HTMLBaseElement",
    conformance: "conforming",
    void: true,
    rawText: false,
    textMode: "normal",
    categories: ["metadata"],
    children: ["empty"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["href", "target"]],
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [{ message: "<base> requires href or target", required: [["href", "target"]] }],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  basefont: {
    tag: "basefont",
    interface: "HTMLElement",
    conformance: "non-conforming",
    void: true,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  bdi: {
    tag: "bdi",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  bdo: {
    tag: "bdo",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  bgsound: {
    tag: "bgsound",
    interface: "HTMLUnknownElement",
    conformance: "non-conforming",
    void: true,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  big: {
    tag: "big",
    interface: "HTMLElement",
    conformance: "non-conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  blink: {
    tag: "blink",
    interface: "HTMLUnknownElement",
    conformance: "non-conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  blockquote: {
    tag: "blockquote",
    interface: "HTMLQuoteElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "palpable"],
    children: ["flow"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["cite"]],
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  body: {
    tag: "body",
    interface: "HTMLBodyElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: ["flow"],
    currentAttributes: [
      ...HTML_GLOBAL_ATTRIBUTE_NAMES,
      ...[
        "onafterprint",
        "onbeforeprint",
        "onbeforeunload",
        "onhashchange",
        "onlanguagechange",
        "onmessage",
        "onmessageerror",
        "onoffline",
        "ononline",
        "onpagehide",
        "onpagereveal",
        "onpageshow",
        "onpageswap",
        "onpopstate",
        "onrejectionhandled",
        "onstorage",
        "onunhandledrejection",
        "onunload",
      ],
    ],
    obsoleteAttributes: [
      "alink",
      "bgcolor",
      "bottommargin",
      "leftmargin",
      "link",
      "marginheight",
      "marginwidth",
      "rightmargin",
      "text",
      "topmargin",
      "vlink",
    ],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  br: {
    tag: "br",
    interface: "HTMLBRElement",
    conformance: "conforming",
    void: true,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing"],
    children: ["empty"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: ["clear"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  button: {
    tag: "button",
    interface: "HTMLButtonElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [
      "flow",
      "phrasing",
      "interactive",
      "listed",
      "labelable",
      "submittable",
      "form-associated",
      "palpable",
    ],
    children: ["phrasing"],
    currentAttributes: [
      ...HTML_GLOBAL_ATTRIBUTE_NAMES,
      ...[
        "command",
        "commandfor",
        "disabled",
        "form",
        "formaction",
        "formenctype",
        "formmethod",
        "formnovalidate",
        "formtarget",
        "name",
        "popovertarget",
        "popovertargetaction",
        "type",
        "value",
      ],
    ],
    obsoleteAttributes: ["action", "autocomplete", "enctype", "method", "novalidate", "target"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: { forbiddenDescendants: { attributes: ["tabindex"], categories: ["interactive"], tags: [] } },
    uniqueAttributes: [],
  },
  canvas: {
    tag: "canvas",
    interface: "HTMLCanvasElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "embedded", "palpable"],
    children: ["transparent"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["height", "width"]],
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  caption: {
    tag: "caption",
    interface: "HTMLTableCaptionElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: ["flow"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: ["align"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  center: {
    tag: "center",
    interface: "HTMLElement",
    conformance: "non-conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  cite: {
    tag: "cite",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  code: {
    tag: "code",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  col: {
    tag: "col",
    interface: "HTMLTableColElement",
    conformance: "conforming",
    void: true,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: ["empty"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["span"]],
    obsoleteAttributes: ["align", "char", "charoff", "valign", "width"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  colgroup: {
    tag: "colgroup",
    interface: "HTMLTableColElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: ["col", "template"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["span"]],
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
    childGrammar: "colgroup",
  },
  data: {
    tag: "data",
    interface: "HTMLDataElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["phrasing"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["value"]],
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  datalist: {
    tag: "datalist",
    interface: "HTMLDataListElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing"],
    children: ["phrasing", "option", "script-supporting elements"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
    childGrammar: "datalist",
  },
  dd: {
    tag: "dd",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: ["flow"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  del: {
    tag: "del",
    interface: "HTMLModElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["transparent"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["cite", "datetime"]],
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  details: {
    tag: "details",
    interface: "HTMLDetailsElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "interactive", "palpable"],
    children: ["summary", "flow"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["name", "open"]],
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
    childGrammar: "details",
  },
  dfn: {
    tag: "dfn",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: { forbiddenDescendants: { attributes: [], categories: [], tags: ["dfn"] } },
    uniqueAttributes: [],
  },
  dialog: {
    tag: "dialog",
    interface: "HTMLDialogElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow"],
    children: ["flow"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["open"]],
    obsoleteAttributes: ["closedby"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  dir: {
    tag: "dir",
    interface: "HTMLDirectoryElement",
    conformance: "non-conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  div: {
    tag: "div",
    interface: "HTMLDivElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "palpable"],
    children: [
      "flow select element inner content elements",
      "optgroup element inner content elements",
      "option element inner content elements",
    ],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: ["align"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
    childGrammar: "contextual-div",
  },
  dl: {
    tag: "dl",
    interface: "HTMLDListElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "palpable"],
    children: ["dt", "dd", "div", "script-supporting elements"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: ["compact"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
    childGrammar: "description-list",
  },
  dt: {
    tag: "dt",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: ["flow"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {
      forbiddenDescendants: { attributes: [], categories: ["heading", "sectioning"], tags: ["footer", "header"] },
    },
    uniqueAttributes: [],
  },
  em: {
    tag: "em",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  embed: {
    tag: "embed",
    interface: "HTMLEmbedElement",
    conformance: "conforming",
    void: true,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "embedded", "interactive", "palpable"],
    children: ["empty"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["height", "src", "type", "width"]],
    obsoleteAttributes: ["align", "hspace", "name", "vspace"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  fieldset: {
    tag: "fieldset",
    interface: "HTMLFieldSetElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "listed", "form-associated", "palpable"],
    children: ["legend", "flow"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["disabled", "form", "name"]],
    obsoleteAttributes: ["autocomplete"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
    childGrammar: "fieldset",
  },
  figcaption: {
    tag: "figcaption",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: ["flow"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  figure: {
    tag: "figure",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "palpable"],
    children: ["figcaption", "flow"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
    childGrammar: "figure",
  },
  font: {
    tag: "font",
    interface: "HTMLFontElement",
    conformance: "non-conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  footer: {
    tag: "footer",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "palpable"],
    children: ["flow"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: { forbiddenDescendants: { attributes: [], categories: [], tags: ["footer", "header"] } },
    uniqueAttributes: [],
  },
  form: {
    tag: "form",
    interface: "HTMLFormElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "palpable"],
    children: ["flow"],
    currentAttributes: [
      ...HTML_GLOBAL_ATTRIBUTE_NAMES,
      ...["accept-charset", "action", "autocomplete", "enctype", "method", "name", "novalidate", "rel", "target"],
    ],
    obsoleteAttributes: ["accept", "formaction", "formenctype", "formmethod", "formnovalidate", "formtarget"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: { forbiddenDescendants: { attributes: [], categories: [], tags: ["form"] } },
    uniqueAttributes: [],
  },
  frame: {
    tag: "frame",
    interface: "HTMLFrameElement",
    conformance: "non-conforming",
    void: true,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  frameset: {
    tag: "frameset",
    interface: "HTMLFrameSetElement",
    conformance: "non-conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  h1: {
    tag: "h1",
    interface: "HTMLHeadingElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "heading", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: ["align"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  h2: {
    tag: "h2",
    interface: "HTMLHeadingElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "heading", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: ["align"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  h3: {
    tag: "h3",
    interface: "HTMLHeadingElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "heading", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: ["align"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  h4: {
    tag: "h4",
    interface: "HTMLHeadingElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "heading", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: ["align"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  h5: {
    tag: "h5",
    interface: "HTMLHeadingElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "heading", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: ["align"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  h6: {
    tag: "h6",
    interface: "HTMLHeadingElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "heading", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: ["align"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  head: {
    tag: "head",
    interface: "HTMLHeadElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: ["metadata content"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: ["profile"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
    childGrammar: "head",
  },
  header: {
    tag: "header",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "palpable"],
    children: ["flow"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: { forbiddenDescendants: { attributes: [], categories: [], tags: ["footer", "header"] } },
    uniqueAttributes: [],
  },
  hgroup: {
    tag: "hgroup",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "palpable"],
    children: ["h1", "h2", "h3", "h4", "h5", "h6", "p", "script-supporting elements"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
    childGrammar: "hgroup",
  },
  hr: {
    tag: "hr",
    interface: "HTMLHRElement",
    conformance: "conforming",
    void: true,
    rawText: false,
    textMode: "normal",
    categories: ["flow"],
    children: ["empty"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: ["align", "color", "noshade", "size", "width"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  html: {
    tag: "html",
    interface: "HTMLHtmlElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: ["head", "body"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: ["manifest", "version"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
    childGrammar: "document-element",
  },
  i: {
    tag: "i",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  iframe: {
    tag: "iframe",
    interface: "HTMLIFrameElement",
    conformance: "conforming",
    void: false,
    rawText: true,
    textMode: "raw-text",
    categories: ["flow", "phrasing", "embedded", "interactive", "palpable"],
    children: ["empty"],
    currentAttributes: [
      ...HTML_GLOBAL_ATTRIBUTE_NAMES,
      ...[
        "allow",
        "allowfullscreen",
        "height",
        "loading",
        "name",
        "referrerpolicy",
        "sandbox",
        "src",
        "srcdoc",
        "width",
      ],
    ],
    obsoleteAttributes: [
      "align",
      "allowtransparency",
      "frameborder",
      "framespacing",
      "hspace",
      "longdesc",
      "marginheight",
      "marginwidth",
      "scrolling",
      "vspace",
    ],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  img: {
    tag: "img",
    interface: "HTMLImageElement",
    conformance: "conforming",
    void: true,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "embedded", "interactive", "form-associated", "palpable"],
    children: ["empty"],
    currentAttributes: [
      ...HTML_GLOBAL_ATTRIBUTE_NAMES,
      ...[
        "alt",
        "controls",
        "crossorigin",
        "decoding",
        "fetchpriority",
        "height",
        "ismap",
        "loading",
        "referrerpolicy",
        "sizes",
        "src",
        "srcset",
        "usemap",
        "width",
      ],
    ],
    obsoleteAttributes: ["align", "border", "hspace", "longdesc", "lowsrc", "name", "vspace"],
    conditionalCategories: [{ attribute: "usemap", category: "interactive", condition: "present" }],
    attributeEqualities: [],
    attributeRequirements: [
      { message: "<img> requires alt and at least one of src or srcset", required: [["alt"], ["src", "srcset"]] },
    ],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  input: {
    tag: "input",
    interface: "HTMLInputElement",
    conformance: "conforming",
    void: true,
    rawText: false,
    textMode: "normal",
    categories: [
      "flow",
      "phrasing",
      "interactive",
      "listed",
      "labelable",
      "submittable",
      "resettable",
      "form-associated",
      "palpable",
    ],
    children: ["empty"],
    currentAttributes: [
      ...HTML_GLOBAL_ATTRIBUTE_NAMES,
      ...[
        "accept",
        "alpha",
        "alt",
        "autocomplete",
        "checked",
        "colorspace",
        "dirname",
        "disabled",
        "form",
        "formaction",
        "formenctype",
        "formmethod",
        "formnovalidate",
        "formtarget",
        "height",
        "list",
        "max",
        "maxlength",
        "min",
        "minlength",
        "multiple",
        "name",
        "pattern",
        "placeholder",
        "popovertarget",
        "popovertargetaction",
        "readonly",
        "required",
        "size",
        "src",
        "step",
        "type",
        "value",
        "width",
      ],
    ],
    obsoleteAttributes: ["align", "border", "hspace", "ismap", "usemap", "vspace"],
    conditionalCategories: [
      { attribute: "type", category: "interactive", condition: "not-equals", value: "hidden" },
      { attribute: "type", category: "labelable", condition: "not-equals", value: "hidden" },
    ],
    attributeEqualities: [],
    attributeRequirements: [
      {
        message: '<input type="image"> requires alt and src',
        required: [["alt"], ["src"]],
        when: { _tag: "attributeEquals", attribute: "type", value: "image" },
      },
    ],
    numericAttributeRelationships: [
      { left: "minlength", message: "<input minlength> must be less than or equal to maxlength", right: "maxlength" },
    ],
    rules: {},
    uniqueAttributes: [],
  },
  ins: {
    tag: "ins",
    interface: "HTMLModElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["transparent"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["cite", "datetime"]],
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  isindex: {
    tag: "isindex",
    interface: "HTMLUnknownElement",
    conformance: "non-conforming",
    void: true,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  kbd: {
    tag: "kbd",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  keygen: {
    tag: "keygen",
    interface: "HTMLUnknownElement",
    conformance: "non-conforming",
    void: true,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  label: {
    tag: "label",
    interface: "HTMLLabelElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "interactive", "palpable"],
    children: ["phrasing"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["for"]],
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: { forbiddenDescendants: { attributes: [], categories: [], tags: ["label"] } },
    uniqueAttributes: [],
  },
  legend: {
    tag: "legend",
    interface: "HTMLLegendElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: ["phrasing", "heading content"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: ["align"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
    childGrammar: "phrasing-or-heading",
  },
  li: {
    tag: "li",
    interface: "HTMLLIElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: ["flow"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["value"]],
    obsoleteAttributes: ["type"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  link: {
    tag: "link",
    interface: "HTMLLinkElement",
    conformance: "conforming",
    void: true,
    rawText: false,
    textMode: "normal",
    categories: ["metadata", "flow", "phrasing"],
    children: ["empty"],
    currentAttributes: [
      ...HTML_GLOBAL_ATTRIBUTE_NAMES,
      ...[
        "as",
        "blocking",
        "color",
        "crossorigin",
        "disabled",
        "fetchpriority",
        "href",
        "hreflang",
        "imagesizes",
        "imagesrcset",
        "integrity",
        "media",
        "referrerpolicy",
        "rel",
        "sizes",
        "type",
      ],
    ],
    obsoleteAttributes: ["charset", "methods", "rev", "target", "urn"],
    conditionalCategories: [
      { attribute: "itemprop", category: "flow", condition: "present" },
      {
        attribute: "rel",
        category: "flow",
        condition: "tokens-subset",
        value: "dns-prefetch modulepreload pingback preconnect prefetch preload stylesheet",
      },
      { attribute: "itemprop", category: "phrasing", condition: "present" },
      {
        attribute: "rel",
        category: "phrasing",
        condition: "tokens-subset",
        value: "dns-prefetch modulepreload pingback preconnect prefetch preload stylesheet",
      },
    ],
    attributeEqualities: [],
    attributeRequirements: [
      {
        message: "<link> requires href or imagesrcset, and href must be a valid non-empty URL",
        nonBlank: ["imagesrcset"],
        required: [["href", "imagesrcset"]],
        validNonEmptyUrl: ["href"],
      },
      { message: "<link> requires exactly one of rel or itemprop", required: [["rel", "itemprop"]] },
      {
        forbidden: ["itemprop"],
        message: "<link rel> forbids itemprop",
        required: [["rel"]],
        when: { _tag: "attributePresent", attribute: "rel" },
      },
      {
        constraints: [
          { _tag: "allowedValues", attribute: "as", values: ["image"] },
          { _tag: "containsAllTokens", attribute: "rel", values: ["preload"] },
        ],
        message: "<link imagesrcset> requires rel=preload and as=image",
        required: [["rel"], ["as"]],
        when: { _tag: "attributePresent", attribute: "imagesrcset" },
      },
      {
        constraints: [
          { _tag: "allowedValues", attribute: "as", values: ["image"] },
          { _tag: "containsAllTokens", attribute: "rel", values: ["preload"] },
        ],
        message: "<link imagesizes> requires rel=preload and as=image",
        required: [["rel"], ["as"]],
        when: { _tag: "attributePresent", attribute: "imagesizes" },
      },
      {
        constraints: [
          { _tag: "allowedValues", attribute: "as", values: ["fetch", "font", "image", "script", "style", "track"] },
        ],
        message: "<link rel=preload> requires as with a valid preload destination",
        required: [["as"]],
        when: { _tag: "attributeContainsToken", attribute: "rel", value: "preload" },
      },
      {
        constraints: [
          {
            _tag: "allowedValues",
            attribute: "as",
            values: [
              "audioworklet",
              "json",
              "paintworklet",
              "script",
              "serviceworker",
              "sharedworker",
              "style",
              "text",
              "worker",
            ],
          },
        ],
        message: "<link rel=modulepreload> as must be a valid module preload destination",
        required: [["rel"]],
        when: { _tag: "attributeContainsToken", attribute: "rel", value: "modulepreload" },
      },
      {
        constraints: [{ _tag: "containsAnyToken", attribute: "rel", values: ["preload", "modulepreload"] }],
        message: "<link as> requires rel=preload or rel=modulepreload",
        required: [["rel"]],
        when: { _tag: "attributePresent", attribute: "as" },
      },
    ],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  listing: {
    tag: "listing",
    interface: "HTMLPreElement",
    conformance: "non-conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  main: {
    tag: "main",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "palpable"],
    children: ["flow"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {
      documentVisibilityLimit: { maximum: 1, unlessAttribute: "hidden" },
      forbiddenNamedAncestors: [{ attributes: ["aria-label", "aria-labelledby", "title"], tag: "form" }],
      permittedAncestors: ["body", "div", "form", "html"],
    },
    uniqueAttributes: [],
  },
  map: {
    tag: "map",
    interface: "HTMLMapElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["transparent", "area"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["name"]],
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [{ left: "id", message: "<map id> must equal name", right: "name" }],
    attributeRequirements: [{ message: "<map> requires name", required: [["name"]] }],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: ["name"],
  },
  mark: {
    tag: "mark",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  marquee: {
    tag: "marquee",
    interface: "HTMLMarqueeElement",
    conformance: "non-conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: ["behavior", "direction", "loop", "truespeed"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  menu: {
    tag: "menu",
    interface: "HTMLMenuElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "palpable"],
    children: ["li", "script-supporting elements"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: ["compact", "label", "type"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  menuitem: {
    tag: "menuitem",
    interface: "HTMLUnknownElement",
    conformance: "non-conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  meta: {
    tag: "meta",
    interface: "HTMLMetaElement",
    conformance: "conforming",
    void: true,
    rawText: false,
    textMode: "normal",
    categories: ["metadata", "flow", "phrasing"],
    children: ["empty"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["charset", "content", "http-equiv", "media", "name"]],
    obsoleteAttributes: ["scheme"],
    conditionalCategories: [
      { attribute: "itemprop", category: "flow", condition: "present" },
      { attribute: "itemprop", category: "phrasing", condition: "present" },
    ],
    attributeEqualities: [],
    attributeRequirements: [
      {
        message: "<meta> requires exactly one of name, http-equiv, charset, or itemprop",
        required: [["name", "http-equiv", "charset", "itemprop"]],
      },
      {
        forbidden: ["http-equiv", "charset", "itemprop"],
        message: "<meta name> requires content and forbids http-equiv, charset, and itemprop",
        required: [["name"], ["content"]],
        when: { _tag: "attributePresent", attribute: "name" },
      },
      {
        forbidden: ["name", "charset", "itemprop"],
        message: "<meta http-equiv> requires content and forbids name, charset, and itemprop",
        required: [["http-equiv"], ["content"]],
        when: { _tag: "attributePresent", attribute: "http-equiv" },
      },
      {
        constraints: [{ _tag: "equals", asciiCaseInsensitive: true, attribute: "charset", value: "utf-8" }],
        forbidden: ["name", "http-equiv", "itemprop", "content"],
        message: "<meta charset> must be utf-8 and forbids name, http-equiv, itemprop, and content",
        required: [["charset"]],
        when: { _tag: "attributePresent", attribute: "charset" },
      },
      {
        forbidden: ["name", "http-equiv", "charset"],
        message: "<meta itemprop> requires content and forbids name, http-equiv, and charset",
        required: [["itemprop"], ["content"]],
        when: { _tag: "attributePresent", attribute: "itemprop" },
      },
    ],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  meter: {
    tag: "meter",
    interface: "HTMLMeterElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "labelable", "palpable"],
    children: ["phrasing"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["high", "low", "max", "min", "optimum", "value"]],
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [{ message: "<meter> requires value", required: [["value"]] }],
    numericAttributeRelationships: [
      {
        left: "min",
        leftDefault: 0,
        message: "<meter min> must be less than or equal to max",
        right: "max",
        rightDefault: 1,
      },
      { left: "min", leftDefault: 0, message: "<meter value> must be greater than or equal to min", right: "value" },
      { left: "value", message: "<meter value> must be less than or equal to max", right: "max", rightDefault: 1 },
      { left: "min", leftDefault: 0, message: "<meter low> must be greater than or equal to min", right: "low" },
      { left: "low", message: "<meter low> must be less than or equal to max", right: "max", rightDefault: 1 },
      { left: "min", leftDefault: 0, message: "<meter high> must be greater than or equal to min", right: "high" },
      { left: "high", message: "<meter high> must be less than or equal to max", right: "max", rightDefault: 1 },
      { left: "low", message: "<meter low> must be less than or equal to high", right: "high" },
      {
        left: "min",
        leftDefault: 0,
        message: "<meter optimum> must be greater than or equal to min",
        right: "optimum",
      },
      { left: "optimum", message: "<meter optimum> must be less than or equal to max", right: "max", rightDefault: 1 },
    ],
    rules: { forbiddenDescendants: { attributes: [], categories: [], tags: ["meter"] } },
    uniqueAttributes: [],
  },
  multicol: {
    tag: "multicol",
    interface: "HTMLUnknownElement",
    conformance: "non-conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  nav: {
    tag: "nav",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "sectioning", "palpable"],
    children: ["flow"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  nextid: {
    tag: "nextid",
    interface: "HTMLUnknownElement",
    conformance: "non-conforming",
    void: true,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  nobr: {
    tag: "nobr",
    interface: "HTMLElement",
    conformance: "non-conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  noembed: {
    tag: "noembed",
    interface: "HTMLElement",
    conformance: "non-conforming",
    void: false,
    rawText: true,
    textMode: "raw-text",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  noframes: {
    tag: "noframes",
    interface: "HTMLElement",
    conformance: "non-conforming",
    void: false,
    rawText: true,
    textMode: "raw-text",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  noscript: {
    tag: "noscript",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["metadata", "flow", "phrasing"],
    children: ["varies"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  object: {
    tag: "object",
    interface: "HTMLObjectElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "embedded", "interactive", "listed", "form-associated", "palpable"],
    children: ["transparent"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["data", "form", "height", "name", "type", "width"]],
    obsoleteAttributes: [
      "align",
      "archive",
      "autocomplete",
      "border",
      "classid",
      "code",
      "codebase",
      "codetype",
      "declare",
      "disabled",
      "hspace",
      "standby",
      "typemustmatch",
      "usemap",
      "vspace",
    ],
    conditionalCategories: [{ attribute: "usemap", category: "interactive", condition: "present" }],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  ol: {
    tag: "ol",
    interface: "HTMLOListElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "palpable"],
    children: ["li", "script-supporting elements"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["reversed", "start", "type"]],
    obsoleteAttributes: ["compact"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  optgroup: {
    tag: "optgroup",
    interface: "HTMLOptGroupElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: ["optgroup element inner content elements", "legend"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["disabled", "label"]],
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
    childGrammar: "optgroup",
  },
  option: {
    tag: "option",
    interface: "HTMLOptionElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: ["text", "option element inner content elements"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["disabled", "label", "selected", "value"]],
    obsoleteAttributes: ["name"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  output: {
    tag: "output",
    interface: "HTMLOutputElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "listed", "labelable", "resettable", "form-associated", "palpable"],
    children: ["phrasing"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["for", "form", "name"]],
    obsoleteAttributes: ["autocomplete", "disabled"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  p: {
    tag: "p",
    interface: "HTMLParagraphElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: ["align"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  param: {
    tag: "param",
    interface: "HTMLParamElement",
    conformance: "non-conforming",
    void: true,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  picture: {
    tag: "picture",
    interface: "HTMLPictureElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "embedded", "palpable"],
    children: ["source", "one img", "script-supporting elements"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
    childGrammar: "picture",
  },
  plaintext: {
    tag: "plaintext",
    interface: "HTMLElement",
    conformance: "non-conforming",
    void: false,
    rawText: false,
    textMode: "plaintext",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  pre: {
    tag: "pre",
    interface: "HTMLPreElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: ["width"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  progress: {
    tag: "progress",
    interface: "HTMLProgressElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "labelable", "palpable"],
    children: ["phrasing"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["max", "value"]],
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [
      { left: "value", message: "<progress value> must be less than or equal to max", right: "max", rightDefault: 1 },
    ],
    rules: { forbiddenDescendants: { attributes: [], categories: [], tags: ["progress"] } },
    uniqueAttributes: [],
  },
  q: {
    tag: "q",
    interface: "HTMLQuoteElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["phrasing"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["cite"]],
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  rb: {
    tag: "rb",
    interface: "HTMLElement",
    conformance: "non-conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  rp: {
    tag: "rp",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: ["text"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  rt: {
    tag: "rt",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  rtc: {
    tag: "rtc",
    interface: "HTMLElement",
    conformance: "non-conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  ruby: {
    tag: "ruby",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["phrasing", "rt", "rp"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
    childGrammar: "ruby",
  },
  s: {
    tag: "s",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  samp: {
    tag: "samp",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  script: {
    tag: "script",
    interface: "HTMLScriptElement",
    conformance: "conforming",
    void: false,
    rawText: true,
    textMode: "raw-text",
    categories: ["metadata", "flow", "phrasing", "script-supporting"],
    children: ["script", "data", "or script documentation"],
    currentAttributes: [
      ...HTML_GLOBAL_ATTRIBUTE_NAMES,
      ...[
        "async",
        "blocking",
        "crossorigin",
        "defer",
        "fetchpriority",
        "integrity",
        "nomodule",
        "referrerpolicy",
        "src",
        "type",
      ],
    ],
    obsoleteAttributes: ["charset", "event", "for", "language"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  search: {
    tag: "search",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "palpable"],
    children: ["flow"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  section: {
    tag: "section",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "sectioning", "palpable"],
    children: ["flow"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  select: {
    tag: "select",
    interface: "HTMLSelectElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [
      "flow",
      "phrasing",
      "interactive",
      "listed",
      "labelable",
      "submittable",
      "resettable",
      "form-associated",
      "palpable",
    ],
    children: ["select element inner content elements", "button"],
    currentAttributes: [
      ...HTML_GLOBAL_ATTRIBUTE_NAMES,
      ...["autocomplete", "disabled", "form", "multiple", "name", "required", "size"],
    ],
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
    childGrammar: "select",
  },
  selectedcontent: {
    tag: "selectedcontent",
    interface: "HTMLSelectedContentElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: ["empty"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  slot: {
    tag: "slot",
    interface: "HTMLSlotElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing"],
    children: ["transparent"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["name"]],
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  small: {
    tag: "small",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  source: {
    tag: "source",
    interface: "HTMLSourceElement",
    conformance: "conforming",
    void: true,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: ["empty"],
    currentAttributes: [
      ...HTML_GLOBAL_ATTRIBUTE_NAMES,
      ...["height", "media", "sizes", "src", "srcset", "type", "width"],
    ],
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [
      {
        forbidden: ["height", "sizes", "srcset", "width"],
        message: "<source> under <audio> or <video> requires src and forbids height, sizes, srcset, and width",
        required: [["src"]],
        whenParents: ["audio", "video"],
      },
      {
        forbidden: ["src"],
        message: "<source> under <picture> requires srcset and forbids src",
        required: [["srcset"]],
        whenParents: ["picture"],
      },
    ],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  spacer: {
    tag: "spacer",
    interface: "HTMLUnknownElement",
    conformance: "non-conforming",
    void: true,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  span: {
    tag: "span",
    interface: "HTMLSpanElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  strike: {
    tag: "strike",
    interface: "HTMLElement",
    conformance: "non-conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  strong: {
    tag: "strong",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  style: {
    tag: "style",
    interface: "HTMLStyleElement",
    conformance: "conforming",
    void: false,
    rawText: true,
    textMode: "raw-text",
    categories: ["metadata"],
    children: ["text"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["blocking", "media"]],
    obsoleteAttributes: ["type"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  sub: {
    tag: "sub",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  summary: {
    tag: "summary",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: ["phrasing", "heading content"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
    childGrammar: "phrasing-or-heading",
  },
  sup: {
    tag: "sup",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  table: {
    tag: "table",
    interface: "HTMLTableElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "palpable"],
    children: ["caption", "colgroup", "thead", "tbody", "tfoot", "tr", "script-supporting elements"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [
      "align",
      "bgcolor",
      "border",
      "bordercolor",
      "cellpadding",
      "cellspacing",
      "datapagesize",
      "frame",
      "height",
      "rules",
      "summary",
      "width",
    ],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
    childSequencePattern: "^(?:caption,)?(?:colgroup,)*(?:thead,)?(?:(?:tbody,)*|(?:tr,)+)(?:tfoot,)?$",
    childGrammar: "table",
  },
  tbody: {
    tag: "tbody",
    interface: "HTMLTableSectionElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: ["tr", "script-supporting elements"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: ["align", "char", "charoff", "height", "valign"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  td: {
    tag: "td",
    interface: "HTMLTableCellElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: ["flow"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["colspan", "headers", "rowspan"]],
    obsoleteAttributes: [
      "abbr",
      "align",
      "axis",
      "bgcolor",
      "char",
      "charoff",
      "height",
      "nowrap",
      "scope",
      "valign",
      "width",
    ],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  template: {
    tag: "template",
    interface: "HTMLTemplateElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["metadata", "flow", "phrasing", "script-supporting"],
    children: ["empty"],
    currentAttributes: [
      ...HTML_GLOBAL_ATTRIBUTE_NAMES,
      ...[
        "shadowrootclonable",
        "shadowrootcustomelementregistry",
        "shadowrootdelegatesfocus",
        "shadowrootmode",
        "shadowrootserializable",
        "shadowrootslotassignment",
      ],
    ],
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  textarea: {
    tag: "textarea",
    interface: "HTMLTextAreaElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "rcdata",
    categories: [
      "flow",
      "phrasing",
      "interactive",
      "listed",
      "labelable",
      "submittable",
      "resettable",
      "form-associated",
      "palpable",
    ],
    children: ["text"],
    currentAttributes: [
      ...HTML_GLOBAL_ATTRIBUTE_NAMES,
      ...[
        "autocomplete",
        "cols",
        "dirname",
        "disabled",
        "form",
        "maxlength",
        "minlength",
        "name",
        "placeholder",
        "readonly",
        "required",
        "rows",
        "wrap",
      ],
    ],
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [
      {
        left: "minlength",
        message: "<textarea minlength> must be less than or equal to maxlength",
        right: "maxlength",
      },
    ],
    rules: {},
    uniqueAttributes: [],
  },
  tfoot: {
    tag: "tfoot",
    interface: "HTMLTableSectionElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: ["tr", "script-supporting elements"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  th: {
    tag: "th",
    interface: "HTMLTableCellElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["interactive"],
    children: ["flow"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["abbr", "colspan", "headers", "rowspan", "scope"]],
    obsoleteAttributes: ["align", "axis", "bgcolor", "char", "charoff", "height", "nowrap", "valign", "width"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {
      forbiddenDescendants: { attributes: [], categories: ["heading", "sectioning"], tags: ["footer", "header"] },
    },
    uniqueAttributes: [],
  },
  thead: {
    tag: "thead",
    interface: "HTMLTableSectionElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: ["tr", "script-supporting elements"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  time: {
    tag: "time",
    interface: "HTMLTimeElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["phrasing"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["datetime"]],
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  title: {
    tag: "title",
    interface: "HTMLTitleElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "rcdata",
    categories: ["metadata"],
    children: ["text"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  tr: {
    tag: "tr",
    interface: "HTMLTableRowElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: ["th", "td", "script-supporting elements"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: ["align", "bgcolor", "char", "charoff", "height", "valign"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  track: {
    tag: "track",
    interface: "HTMLTrackElement",
    conformance: "conforming",
    void: true,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: ["empty"],
    currentAttributes: [...HTML_GLOBAL_ATTRIBUTE_NAMES, ...["default", "kind", "label", "src", "srclang"]],
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [
      { message: "<track> requires src", required: [["src"]] },
      {
        message: '<track kind="subtitles"> requires srclang',
        required: [["srclang"]],
        when: { _tag: "attributeEquals", attribute: "kind", value: "subtitles" },
      },
    ],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  tt: {
    tag: "tt",
    interface: "HTMLElement",
    conformance: "non-conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  u: {
    tag: "u",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  ul: {
    tag: "ul",
    interface: "HTMLUListElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "palpable"],
    children: ["li", "script-supporting elements"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: ["compact", "type"],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  var: {
    tag: "var",
    interface: "HTMLElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "palpable"],
    children: ["phrasing"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  video: {
    tag: "video",
    interface: "HTMLVideoElement",
    conformance: "conforming",
    void: false,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing", "embedded", "interactive", "palpable"],
    children: ["source", "track", "transparent"],
    currentAttributes: [
      ...HTML_GLOBAL_ATTRIBUTE_NAMES,
      ...[
        "autoplay",
        "controls",
        "crossorigin",
        "height",
        "loading",
        "loop",
        "muted",
        "playsinline",
        "poster",
        "preload",
        "src",
        "width",
      ],
    ],
    obsoleteAttributes: [],
    conditionalCategories: [{ attribute: "controls", category: "interactive", condition: "present" }],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: { forbiddenDescendants: { attributes: [], categories: [], tags: ["audio", "video"] } },
    uniqueAttributes: [],
    childGrammar: "media",
  },
  wbr: {
    tag: "wbr",
    interface: "HTMLElement",
    conformance: "conforming",
    void: true,
    rawText: false,
    textMode: "normal",
    categories: ["flow", "phrasing"],
    children: ["empty"],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
  xmp: {
    tag: "xmp",
    interface: "HTMLPreElement",
    conformance: "non-conforming",
    void: false,
    rawText: true,
    textMode: "raw-text",
    categories: [],
    children: [],
    currentAttributes: HTML_GLOBAL_ATTRIBUTE_NAMES,
    obsoleteAttributes: [],
    conditionalCategories: [],
    attributeEqualities: [],
    attributeRequirements: [],
    numericAttributeRelationships: [],
    rules: {},
    uniqueAttributes: [],
  },
};

const decodeElementMeta = (value: S.Codec.Encoded<typeof HtmlElementMeta>): HtmlElementMeta =>
  Result.getOrThrow(S.decodeUnknownResult(HtmlElementMeta)(value));

/**
 * Metadata for every generated HTML element, keyed by tag name.
 *
 * @example
 * ```ts
 * import { ELEMENT_META } from "@beep/html/Html.meta"
 *
 * console.log(ELEMENT_META.div.interface) // "HTMLDivElement"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ELEMENT_META: Readonly<Record<HtmlTag, HtmlElementMeta>> = Object.freeze(
  R.map(elementMetaSource, (value) => freezeElementMeta(decodeElementMeta(value)))
);
