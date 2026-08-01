/**
 * Mermaid diagram renderer shared by persisted editor and streaming chat
 * surfaces.
 *
 * @packageDocumentation \@beep/editor/mermaid-view
 * @since 0.0.0
 */
"use client";

import { $EditorId } from "@beep/identity";
import { TaggedErrorClass } from "@beep/schema";
import { A, O, Str } from "@beep/utils";
import { useAtomValue } from "@effect/atom-react";
import DOMPurify from "dompurify";
import { Cause, Effect, HashSet, Layer, Match, MutableHashMap } from "effect";
import * as S from "effect/Schema";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { useId } from "react";
import type { MermaidConfig } from "mermaid";
import type { JSX } from "react";

const $I = $EditorId.create("mermaid-view");

const fallbackErrorMessage = "Unable to render diagram.";
const fallbackDiagramName = "Mermaid diagram";
const fallbackDiagramDescription = (source: string): string => `Mermaid diagram source:\n${source}`;
const invalidDiagramMessage = "Diagram could not be parsed.";
const unsafeDiagramMessage = "Diagram output did not satisfy the desktop safety policy.";

/**
 * Typed Mermaid load, parse, or render failure. The optional defect is retained
 * for runtime diagnostics; only the user-safe message is rendered.
 *
 * @example
 * ```ts
 * import { MermaidRenderError } from "@beep/editor/mermaid-view"
 *
 * const error = MermaidRenderError.make({ message: "Unable to render diagram." })
 * console.log(error._tag) // "MermaidRenderError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MermaidRenderError extends TaggedErrorClass<MermaidRenderError>($I`MermaidRenderError`)(
  "MermaidRenderError",
  {
    message: S.String.annotateKey({ description: "User-safe diagram failure message." }),
    cause: S.optionalKey(S.Defect({ includeStack: true })).annotateKey({
      description: "Optional underlying Mermaid defect retained for diagnostics.",
    }),
  },
  $I.annote("MermaidRenderError", {
    description: "A typed Mermaid load, parse, or render failure.",
  })
) {}

/**
 * Upper bound on the diagram source Mermaid is asked to lay out.
 *
 * `mermaid.render` parses and lays the graph out synchronously on the main
 * thread. An assistant can emit arbitrarily large content, so oversized source
 * falls back to inert text before Mermaid is imported.
 */
const maxSourceLength = 20_000;

const oversizedMessage = (length: number): string =>
  `Diagram source is too large to render (${length.toLocaleString()} characters; limit ${maxSourceLength.toLocaleString()}).`;

const mermaidConfig = {
  securityLevel: "strict",
  startOnLoad: false,
  suppressErrorRendering: true,
  htmlLabels: false,
  secure: [
    "secure",
    "securityLevel",
    "startOnLoad",
    "maxTextSize",
    "suppressErrorRendering",
    "maxEdges",
    "htmlLabels",
    "themeCSS",
    "themeVariables",
    "fontFamily",
    "altFontFamily",
    "fontSize",
  ],
} satisfies MermaidConfig;

const mermaidSanitizerConfig = {
  ADD_ATTR: ["role"],
  USE_PROFILES: {
    svg: true,
    svgFilters: true,
  },
};

const svgNamespace = "http://www.w3.org/2000/svg";
const mermaidRootRole = "graphics-document document";
const forbiddenSvgElements = HashSet.make(
  "a",
  "animate",
  "animatemotion",
  "animatetransform",
  "audio",
  "base",
  "button",
  "canvas",
  "discard",
  "embed",
  "feimage",
  "foreignobject",
  "form",
  "iframe",
  "image",
  "img",
  "input",
  "link",
  "meta",
  "object",
  "option",
  "script",
  "select",
  "set",
  "source",
  "textarea",
  "track",
  "video"
);
const urlAttributes = HashSet.make("href", "poster", "src", "xlink:href");
const unsafeCss =
  /@import|expression\s*\(|(?:data|javascript|vbscript)\s*:|(?:-webkit-)?image-set\s*\(|image\s*\(|src\s*\(|url\s*\(\s*(?!#|["']#)/iu;

const cssComment = /\/\*[\s\S]*?\*\//gu;
const cssEscape = /\\(?:([0-9a-f]{1,6})(?:\r\n|[\t\n\f\r ])?|([^\n\f\r0-9a-f]))/giu;
const cssUrl = /url\s*\(/iu;
const localFragmentUrl = /url\s*\(\s*(?:#([^"'()\s]+)|(["'])#([^"'()\s]+)\2)\s*\)/giu;
const unsafeStylesheetToken =
  /@|expression\s*\(|(?:data|javascript|vbscript)\s*:|(?:-webkit-)?image-set\s*\(|image\s*\(|src\s*\(|url\s*\(/iu;
const layoutOffsetProperties = HashSet.make(
  "bottom",
  "inset",
  "inset-block",
  "inset-block-end",
  "inset-block-start",
  "inset-inline",
  "inset-inline-end",
  "inset-inline-start",
  "left",
  "right",
  "top"
);
const safePositionValues = HashSet.make("", "absolute", "relative", "static");
const safePointerEventValues = HashSet.make("", "none");
const safeZIndexValues = HashSet.make("", "0", "100", "auto");
const safeMermaidRootStyleProperties = HashSet.make("fill", "font-family", "font-size", "max-width");
const safeMermaidRootMaxWidth = /^(?:0|[1-9]\d*(?:\.\d+)?)px$/u;
const mermaidBuiltInKeyframes = [
  "@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}",
  "@keyframes dash{to{stroke-dashoffset:0;}}",
];

const normalizeCssTokens = (value: string): string =>
  value
    .replace(cssComment, "")
    .replace(cssEscape, (_match, hexadecimal: string | undefined, escaped: string | undefined) => {
      if (hexadecimal === undefined) return escaped ?? "";
      const codePoint = Number.parseInt(hexadecimal, 16);
      return String.fromCodePoint(codePoint === 0 || codePoint > 0x10ffff ? 0xfffd : codePoint);
    });

const normalizedCssValue = (value: string): string => Str.toLowerCase(Str.trim(value));

const hasUnsafeLayoutStyle = (style: CSSStyleDeclaration): boolean => {
  if (
    !HashSet.has(safePositionValues, normalizedCssValue(style.getPropertyValue("position"))) ||
    !HashSet.has(safePointerEventValues, normalizedCssValue(style.getPropertyValue("pointer-events"))) ||
    !HashSet.has(safeZIndexValues, normalizedCssValue(style.getPropertyValue("z-index")))
  ) {
    return true;
  }

  for (let index = 0; index < style.length; index += 1) {
    if (HashSet.has(layoutOffsetProperties, normalizedCssValue(style.item(index)))) return true;
  }
  return false;
};

const isSafeMermaidRootStyle = (style: CSSStyleDeclaration): boolean => {
  for (let index = 0; index < style.length; index += 1) {
    if (!HashSet.has(safeMermaidRootStyleProperties, normalizedCssValue(style.item(index)))) return false;
  }

  const maxWidth = normalizedCssValue(style.getPropertyValue("max-width"));
  return maxWidth.length === 0 || safeMermaidRootMaxWidth.test(maxWidth);
};

type CssSelectorScanState = {
  bracketDepth: number;
  escaped: boolean;
  parenthesisDepth: number;
  quote: "'" | '"' | undefined;
};

const makeCssSelectorScanState = (): CssSelectorScanState => ({
  bracketDepth: 0,
  escaped: false,
  parenthesisDepth: 0,
  quote: undefined,
});

const isCompleteCssSelectorScan = (state: CssSelectorScanState): boolean =>
  state.bracketDepth === 0 && state.parenthesisDepth === 0 && state.quote === undefined && !state.escaped;

const scanCssSelectorGroup = (state: CssSelectorScanState, character: string | undefined): boolean | undefined =>
  Match.value(character).pipe(
    Match.when("[", () => {
      state.bracketDepth += 1;
      return false;
    }),
    Match.when("]", () => {
      if (state.bracketDepth === 0) return undefined;
      state.bracketDepth -= 1;
      return false;
    }),
    Match.when("(", () => {
      state.parenthesisDepth += 1;
      return false;
    }),
    Match.when(")", () => {
      if (state.parenthesisDepth === 0) return undefined;
      state.parenthesisDepth -= 1;
      return false;
    }),
    Match.orElse(() => state.bracketDepth === 0 && state.parenthesisDepth === 0)
  );

const scanCssSelectorCharacter = (state: CssSelectorScanState, character: string | undefined): boolean | undefined => {
  if (state.escaped) {
    state.escaped = false;
    return false;
  }
  if (character === "\\") {
    state.escaped = true;
    return false;
  }
  if (state.quote !== undefined) {
    if (character === state.quote) state.quote = undefined;
    return false;
  }
  if (character === "'" || character === '"') {
    state.quote = character;
    return false;
  }
  return scanCssSelectorGroup(state, character);
};

const selectorSlice = (value: string, start: number, end?: number): string | undefined => {
  const selector = value.slice(start, end).trim();
  return selector.length === 0 ? undefined : selector;
};

const scanSelectorSeparators = (value: string, state: CssSelectorScanState): undefined | ReadonlyArray<number> => {
  const separators: Array<number> = [];
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const isTopLevel = scanCssSelectorCharacter(state, character);
    if (isTopLevel === undefined) return undefined;
    if (isTopLevel && character === ",") separators.push(index);
  }
  return separators;
};

const selectorsFromSeparators = (
  value: string,
  separators: ReadonlyArray<number>
): undefined | ReadonlyArray<string> => {
  const selectors: Array<string> = [];
  let start = 0;
  for (const end of A.append(separators, value.length)) {
    const selector = selectorSlice(value, start, end);
    if (selector === undefined) return undefined;
    selectors.push(selector);
    start = end + 1;
  }
  return selectors;
};

const splitSelectorList = (value: string): undefined | ReadonlyArray<string> => {
  const state = makeCssSelectorScanState();
  const separators = scanSelectorSeparators(value, state);
  return separators === undefined || !isCompleteCssSelectorScan(state)
    ? undefined
    : selectorsFromSeparators(value, separators);
};

const cssWhitespace = /\s/u;
const rootSelectorBoundary = HashSet.make(".", "#", "[", ":", ">", "+", "~");

const isRootSelectorBoundary = (character: string | undefined): boolean =>
  character === undefined || cssWhitespace.test(character) || HashSet.has(rootSelectorBoundary, character);

const isSiblingCombinator = (character: string | undefined): boolean => character === "+" || character === "~";

const nextNonWhitespaceCharacter = (value: string, start: number): string | undefined => {
  let index = start;
  while (index < value.length && cssWhitespace.test(value[index] ?? "")) index += 1;
  return value[index];
};

const rootScopeAfterCharacter = (
  selector: string,
  index: number,
  character: string | undefined
): boolean | undefined => {
  if (isSiblingCombinator(character)) return undefined;
  if (character === ">") return false;
  if (!cssWhitespace.test(character ?? "")) return true;
  return isSiblingCombinator(nextNonWhitespaceCharacter(selector, index + 1)) ? undefined : false;
};

const scanRootSelectorScope = (selector: string, start: number): boolean | undefined => {
  const state = makeCssSelectorScanState();
  for (let index = start; index < selector.length; index += 1) {
    const character = selector[index];
    const isTopLevel = scanCssSelectorCharacter(state, character);
    if (isTopLevel === undefined) return undefined;
    if (!isTopLevel) continue;
    const scope = rootScopeAfterCharacter(selector, index, character);
    if (scope !== true) return scope;
  }

  return isCompleteCssSelectorScan(state) ? true : undefined;
};

const selectorTargetsRoot = (selector: string, rootSelector: string): boolean | undefined =>
  selector.startsWith(rootSelector) && isRootSelectorBoundary(selector[rootSelector.length])
    ? scanRootSelectorScope(selector, rootSelector.length)
    : undefined;

const selectorsTargetRoot = (selectors: ReadonlyArray<string>, rootSelector: string): boolean | undefined => {
  let targetsRoot = false;
  for (const selector of selectors) {
    const selectorScope = selectorTargetsRoot(selector, rootSelector);
    if (selectorScope === undefined) return undefined;
    targetsRoot ||= selectorScope;
  }
  return targetsRoot;
};

const hasUnsafeStyleRule = (rule: CSSStyleRule): boolean =>
  (rule.cssRules?.length ?? 0) !== 0 ||
  unsafeStylesheetToken.test(normalizeCssTokens(rule.style.cssText)) ||
  hasUnsafeLayoutStyle(rule.style);

const isSafeStyleRule = (rule: CSSStyleRule, rootSelector: string): boolean => {
  if (hasUnsafeStyleRule(rule)) return false;
  const selectors = splitSelectorList(rule.selectorText);
  if (selectors === undefined) return false;
  if (A.some(selectors, (selector) => Str.includes("#")(Str.slice(Str.length(rootSelector))(selector)))) return false;
  const targetsRoot = selectorsTargetRoot(selectors, rootSelector);
  if (targetsRoot === undefined) return false;
  return !targetsRoot || isSafeMermaidRootStyle(rule.style);
};

const isSafeMermaidStyles = (styles: string, renderId: string): boolean => {
  if (unsafeStylesheetToken.test(normalizeCssTokens(styles))) return false;

  let style: HTMLStyleElement | undefined;
  try {
    style = globalThis.document.createElement("style");
    // The live document supplies a CSSOM sheet in browsers and jsdom. `not all`
    // keeps untrusted selectors inactive while their parsed rules are inspected.
    style.media = "not all";
    style.textContent = styles;
    globalThis.document.head.append(style);
    const rules = style.sheet?.cssRules;
    if (rules === undefined) return false;

    for (const rule of rules) {
      if (!(rule instanceof CSSStyleRule) || !isSafeStyleRule(rule, `#${renderId}`)) return false;
    }
    return true;
  } catch {
    return false;
  } finally {
    style?.remove();
  }
};

const elementHasText = (element: Element): boolean => (element.textContent?.trim().length ?? 0) > 0;

const findElementById = (root: Element, id: string): Element | undefined => {
  for (const element of root.querySelectorAll("[id]")) {
    if (element.getAttribute("id") === id) return element;
  }
  return undefined;
};

const hasUniqueInternalFragmentTarget = (root: Element, id: string): boolean => {
  let internalMatches = root.getAttribute("id") === id ? 1 : 0;
  for (const element of root.querySelectorAll("[id]")) {
    if (element.getAttribute("id") !== id) continue;
    internalMatches += 1;
    if (internalMatches > 1) return false;
  }
  return internalMatches === 1;
};

const hasSafeLocalFragmentUrls = (root: Element, value: string): boolean => {
  let targetsAreSafe = true;
  const withoutLocalFragments = value.replace(
    localFragmentUrl,
    (
      _match: string,
      unquotedId: string | undefined,
      _quote: string | undefined,
      quotedId: string | undefined
    ): string => {
      const id = unquotedId ?? quotedId;
      targetsAreSafe = targetsAreSafe && id !== undefined && hasUniqueInternalFragmentTarget(root, id);
      return "";
    }
  );
  return targetsAreSafe && !cssUrl.test(withoutLocalFragments);
};

const scopedMermaidId = (ids: MutableHashMap.MutableHashMap<string, string>, id: string): string =>
  O.getOrElse(MutableHashMap.get(ids, id), () => id);

const rewriteLocalFragmentUrls = (ids: MutableHashMap.MutableHashMap<string, string>, value: string): string =>
  value.replace(
    localFragmentUrl,
    (
      _match: string,
      unquotedId: string | undefined,
      _quote: string | undefined,
      quotedId: string | undefined
    ): string => `url(#${scopedMermaidId(ids, unquotedId ?? quotedId ?? "")})`
  );

const idReferenceAttributes = HashSet.make(
  "aria-activedescendant",
  "aria-controls",
  "aria-describedby",
  "aria-details",
  "aria-errormessage",
  "aria-flowto",
  "aria-labelledby",
  "aria-owns"
);

const rewriteMermaidAttributeReferences = (
  attribute: Attr,
  ids: MutableHashMap.MutableHashMap<string, string>
): void => {
  const name = Str.toLowerCase(attribute.name);
  const value = Str.trim(attribute.value);
  if (HashSet.has(urlAttributes, name) && Str.startsWith("#")(value)) {
    attribute.value = `#${scopedMermaidId(ids, Str.slice(1)(value))}`;
    return;
  }
  if (HashSet.has(idReferenceAttributes, name)) {
    attribute.value = A.join(
      A.map(Str.split(value, /\s+/u), (id) => scopedMermaidId(ids, id)),
      " "
    );
    return;
  }

  const normalizedValue = normalizeCssTokens(value);
  if (cssUrl.test(normalizedValue)) attribute.value = rewriteLocalFragmentUrls(ids, normalizedValue);
};

const namespaceMermaidElementIds = (
  root: Element,
  renderId: string
): MutableHashMap.MutableHashMap<string, string> | undefined => {
  const ids = MutableHashMap.empty<string, string>();
  let index = 0;
  for (const element of root.querySelectorAll("[id]")) {
    const id = Str.trim(element.getAttribute("id") ?? "");
    if (Str.isEmpty(id) || id === renderId || MutableHashMap.has(ids, id)) return undefined;

    const scopedId = `${renderId}-fragment-${index}`;
    if (globalThis.document.getElementById(scopedId) !== null) return undefined;
    MutableHashMap.set(ids, id, scopedId);
    element.setAttribute("id", scopedId);
    index += 1;
  }

  return ids;
};

const rewriteMermaidTreeAttributeReferences = (
  root: Element,
  ids: MutableHashMap.MutableHashMap<string, string>
): void => {
  for (const attribute of root.attributes) rewriteMermaidAttributeReferences(attribute, ids);
  for (const element of root.querySelectorAll("*")) {
    for (const attribute of element.attributes) rewriteMermaidAttributeReferences(attribute, ids);
  }
};

const namespaceMermaidIds = (root: Element, renderId: string): boolean => {
  if (globalThis.document.getElementById(renderId) !== null) return false;

  const ids = namespaceMermaidElementIds(root, renderId);
  if (ids === undefined) return false;

  rewriteMermaidTreeAttributeReferences(root, ids);
  return true;
};

const hasAssociatedText = (root: Element, attribute: "aria-describedby" | "aria-labelledby"): boolean => {
  const references = root.getAttribute(attribute)?.trim().split(/\s+/u) ?? [];
  return A.some(references, (id) => {
    const element = findElementById(root, id);
    return element !== undefined && elementHasText(element);
  });
};

const hasAccessibleName = (root: Element): boolean =>
  (root.getAttribute("aria-label")?.trim().length ?? 0) > 0 || hasAssociatedText(root, "aria-labelledby");

const directTextChild = (root: Element, name: "desc" | "title"): Element | undefined => {
  for (const child of root.children) {
    if (child.localName === name && elementHasText(child)) return child;
  }
  return undefined;
};

const uniqueElementId = (root: Element, preferred: string): string => {
  let candidate = preferred;
  let suffix = 1;
  while (findElementById(root, candidate) !== undefined || globalThis.document.getElementById(candidate) !== null) {
    candidate = `${preferred}-${suffix}`;
    suffix += 1;
  }
  return candidate;
};

const ensureElementId = (root: Element, element: Element, preferred: string): string => {
  const existing = element.getAttribute("id")?.trim();
  if (existing !== undefined && existing.length > 0) return existing;
  const id = uniqueElementId(root, preferred);
  element.setAttribute("id", id);
  return id;
};

const ensureMermaidAccessibility = (root: Element, renderId: string, source: string): void => {
  if (!hasAccessibleName(root)) {
    const title = directTextChild(root, "title");
    if (title === undefined) {
      root.removeAttribute("aria-labelledby");
      root.setAttribute("aria-label", fallbackDiagramName);
    } else {
      root.setAttribute("aria-labelledby", ensureElementId(root, title, `${renderId}-title`));
    }
  }

  if (hasAssociatedText(root, "aria-describedby")) return;
  const authoredDescription = directTextChild(root, "desc");
  if (authoredDescription !== undefined) {
    root.setAttribute("aria-describedby", ensureElementId(root, authoredDescription, `${renderId}-description`));
    return;
  }

  const description = root.ownerDocument.createElementNS(svgNamespace, "desc");
  const descriptionId = uniqueElementId(root, `${renderId}-description`);
  description.setAttribute("id", descriptionId);
  description.textContent = fallbackDiagramDescription(source);
  root.prepend(description);
  root.setAttribute("aria-describedby", descriptionId);
};

const prepareMermaidSvg = (svg: string, renderId: string, source: string): undefined | string => {
  const template = globalThis.document.createElement("template");
  template.innerHTML = svg;
  if (template.content.childElementCount !== 1) return undefined;

  const root = template.content.firstElementChild;
  if (root === null || root.localName !== "svg" || root.namespaceURI !== svgNamespace) return undefined;

  for (const style of root.querySelectorAll("style")) {
    style.textContent = mermaidBuiltInKeyframes.reduce(
      (styles, keyframes) => Str.replaceAll(keyframes, "")(styles),
      style.textContent ?? ""
    );
  }
  if (!namespaceMermaidIds(root, renderId)) return undefined;
  ensureMermaidAccessibility(root, renderId, source);
  return root.outerHTML;
};

const isSafeMermaidRoot = (parsedDocument: Document, root: Element, renderId: string): boolean =>
  !(
    root.localName !== "svg" ||
    root.namespaceURI !== svgNamespace ||
    root.getAttribute("id") !== renderId ||
    root.getAttribute("role") !== mermaidRootRole ||
    !hasAccessibleName(root) ||
    !hasAssociatedText(root, "aria-describedby") ||
    parsedDocument.querySelector("parsererror") !== null
  );

const isSafeMermaidInlineStyle = (element: Element, isRoot: boolean, normalizedValue: string): boolean => {
  if (!(element instanceof SVGElement)) return false;
  if (unsafeCss.test(normalizedValue) || hasUnsafeLayoutStyle(element.style)) return false;
  return !isRoot || isSafeMermaidRootStyle(element.style);
};

const isSafeMermaidAttribute = (element: Element, root: Element, attribute: Attr, isRoot: boolean): boolean => {
  const name = attribute.name.toLowerCase();
  const value = attribute.value.trim();
  if (name.startsWith("on")) return false;
  if (name === "role") return isRoot && value === mermaidRootRole;
  if (HashSet.has(idReferenceAttributes, name)) {
    return A.every(Str.split(value, /\s+/u), (id) => hasUniqueInternalFragmentTarget(root, id));
  }
  if (HashSet.has(urlAttributes, name)) {
    return Str.startsWith("#")(value) && hasUniqueInternalFragmentTarget(root, Str.slice(1)(value));
  }
  const normalizedValue = normalizeCssTokens(value);
  const safeValue =
    name === "style" ? isSafeMermaidInlineStyle(element, isRoot, normalizedValue) : !unsafeCss.test(normalizedValue);
  return safeValue && hasSafeLocalFragmentUrls(root, normalizedValue);
};

const isSafeMermaidElement = (element: Element, root: Element, renderId: string): boolean => {
  if (element.namespaceURI !== svgNamespace || HashSet.has(forbiddenSvgElements, element.localName.toLowerCase()))
    return false;
  if (element.localName === "style" && !isSafeMermaidStyles(element.textContent ?? "", renderId)) return false;

  for (const attribute of element.attributes) {
    if (!isSafeMermaidAttribute(element, root, attribute, element === root)) return false;
  }
  return true;
};

const isSafeMermaidSvg = (svg: string, renderId: string): boolean => {
  const parsedDocument = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = parsedDocument.documentElement;
  if (!isSafeMermaidRoot(parsedDocument, root, renderId)) return false;
  for (const element of parsedDocument.querySelectorAll("*")) {
    if (!isSafeMermaidElement(element, root, renderId)) return false;
  }
  return true;
};

const hashString = (value: string): string => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

const maxIdPartLength = 64;

const sanitizeIdPart = (value: string): string => {
  const sanitized = value.replace(/[^a-zA-Z0-9_-]/gu, "-");
  if (sanitized.length === 0) return "diagram";
  return sanitized.length > maxIdPartLength ? hashString(sanitized) : sanitized;
};

const boundedSourceIdentity = (source: string): string => {
  const length = Str.length(source);
  return length > maxSourceLength
    ? `${Str.takeLeft(source, maxIdPartLength)}:${Str.takeRight(source, maxIdPartLength)}:${length}`
    : source;
};

const renderMermaid = Effect.fnUntraced(function* (renderId: string, source: string) {
  if (Str.length(source) > maxSourceLength) {
    return yield* MermaidRenderError.make({ message: oversizedMessage(Str.length(source)) });
  }

  const { default: mermaid } = yield* Effect.tryPromise({
    try: () => import("mermaid"),
    catch: (cause) => MermaidRenderError.make({ message: fallbackErrorMessage, cause }),
  });

  mermaid.initialize(mermaidConfig);

  const parsed = yield* Effect.tryPromise({
    try: () => mermaid.parse(source, { suppressErrors: true }),
    catch: (cause) => MermaidRenderError.make({ message: invalidDiagramMessage, cause }),
  });
  if (parsed === false) {
    return yield* MermaidRenderError.make({ message: invalidDiagramMessage });
  }

  const rendered = yield* Effect.tryPromise({
    try: () => mermaid.render(renderId, source),
    catch: (cause) => MermaidRenderError.make({ message: fallbackErrorMessage, cause }),
  });
  const sanitizedSvg = DOMPurify.sanitize(rendered.svg, mermaidSanitizerConfig);
  const removedUnsafeContent = A.some(
    DOMPurify.removed,
    (removal) => !("element" in removal && removal.element instanceof Element && removal.element.localName === "body")
  );
  const inertSvg = prepareMermaidSvg(sanitizedSvg, renderId, source);
  if (removedUnsafeContent || inertSvg === undefined || !isSafeMermaidSvg(inertSvg, renderId)) {
    return yield* MermaidRenderError.make({ message: unsafeDiagramMessage });
  }
  return inertSvg;
});

const mermaidRuntime = Atom.runtime(Layer.empty);

// Nested families keep both identities primitive and stable without a React
// memo: render id isolates concurrent diagrams, source changes select a fresh
// async atom, and unmounting interrupts obsolete work through the registry.
const mermaidRenderAtom = Atom.family((renderId: string) =>
  Atom.family((source: string) =>
    mermaidRuntime.atom(
      renderMermaid(renderId, source).pipe(
        Effect.tapError((failure) => Effect.logError("Unable to render Mermaid diagram", failure.cause ?? failure))
      )
    )
  )
);

const safeFailureMessage = (cause: Cause.Cause<MermaidRenderError>): string =>
  O.match(Cause.findErrorOption(cause), {
    onNone: () => fallbackErrorMessage,
    onSome: (failure) => failure.message,
  });

const renderFailure = (source: string, message: string): JSX.Element => (
  <div className="my-3 rounded border border-destructive/40 bg-muted p-3" data-testid="mermaid-diagram">
    <div className="mb-2 text-xs text-muted-foreground">{message}</div>
    <pre className="overflow-x-auto rounded bg-background p-3 text-sm">
      <code>{source}</code>
    </pre>
  </div>
);

// cspell:ignore nosemgrep
const renderSuccess = (svg: string): JSX.Element => (
  <div
    className="my-3 overflow-x-auto rounded border bg-background p-3"
    data-testid="mermaid-diagram"
    // Paint containment makes this trusted wrapper the fixed-position containing
    // block and clipping boundary even if a future renderer emits a class-based
    // layout rule that the SVG policy does not recognize.
    style={{ contain: "paint" }}
    // biome-ignore lint/security/noDangerouslySetInnerHtml: DOMPurify sanitizes at the browser parser boundary and the inert SVG policy revalidates the exact bytes injected here.
    dangerouslySetInnerHTML={{ __html: svg }} // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- DOMPurify and the inert SVG policy validate the exact bytes before this sink.
  />
);

const renderPending = (): JSX.Element => (
  <div className="my-3 rounded border bg-muted p-3 text-sm text-muted-foreground" data-testid="mermaid-diagram">
    Rendering diagram...
  </div>
);

/**
 * Renders Mermaid source to SVG and falls back to source text on render
 * failure. Async lifecycle is owned by an interruptible Atom runtime rather
 * than app-authored React state/effect hooks.
 *
 * @example
 * ```tsx
 * import { MermaidView } from "@beep/editor/mermaid-view"
 *
 * const props = { renderKey: "checkout-flow", source: "graph TD; A-->B" }
 * const diagram = <MermaidView {...props} />
 *
 * console.log(props.renderKey) // "checkout-flow"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function MermaidView({
  source,
  renderKey,
}: {
  readonly source: string;
  readonly renderKey: string;
}): JSX.Element {
  const reactId = useId();
  const renderId = `mermaid-${sanitizeIdPart(reactId)}-${sanitizeIdPart(renderKey)}-${hashString(
    boundedSourceIdentity(source)
  )}`;
  const state = useAtomValue(mermaidRenderAtom(renderId)(source));

  return AsyncResult.match(state, {
    onInitial: renderPending,
    onSuccess: ({ value }) => renderSuccess(value),
    onFailure: ({ cause }) => renderFailure(source, safeFailureMessage(cause)),
  });
}
