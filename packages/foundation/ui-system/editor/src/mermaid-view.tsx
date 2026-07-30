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
import { Cause, Effect, HashSet, Layer } from "effect";
import * as S from "effect/Schema";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { useId } from "react";
import type { JSX } from "react";

const $I = $EditorId.create("mermaid-view");

const fallbackErrorMessage = "Unable to render diagram.";
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
  securityLevel: "strict" as const,
  startOnLoad: false,
  suppressErrorRendering: true,
  htmlLabels: false,
  secure: ["secure", "securityLevel", "startOnLoad", "maxTextSize", "suppressErrorRendering", "maxEdges", "htmlLabels"],
};

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
const unsafeCss = /@import|expression\s*\(|(?:data|javascript|vbscript)\s*:|url\s*\(\s*(?!#|["']#)/iu;

const cssComment = /\/\*[\s\S]*?\*\//gu;
const cssEscape = /\\(?:([0-9a-f]{1,6})(?:\r\n|[\t\n\f\r ])?|([^\n\f\r0-9a-f]))/giu;
const unsafeStylesheetToken = /@|expression\s*\(|(?:data|javascript|vbscript)\s*:|url\s*\(/iu;
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

const splitSelectorList = (value: string): undefined | ReadonlyArray<string> => {
  const selectors: Array<string> = [];
  let bracketDepth = 0;
  let parenthesisDepth = 0;
  let quote: "'" | '"' | undefined;
  let escaped = false;
  let start = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote !== undefined) {
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === "[") {
      bracketDepth += 1;
      continue;
    }
    if (character === "]") {
      if (bracketDepth === 0) return undefined;
      bracketDepth -= 1;
      continue;
    }
    if (character === "(") {
      parenthesisDepth += 1;
      continue;
    }
    if (character === ")") {
      if (parenthesisDepth === 0) return undefined;
      parenthesisDepth -= 1;
      continue;
    }
    if (character !== "," || bracketDepth !== 0 || parenthesisDepth !== 0) continue;

    const selector = value.slice(start, index).trim();
    if (selector.length === 0) return undefined;
    selectors.push(selector);
    start = index + 1;
  }

  const selector = value.slice(start).trim();
  if (selector.length === 0 || bracketDepth !== 0 || parenthesisDepth !== 0 || quote !== undefined || escaped) {
    return undefined;
  }
  selectors.push(selector);
  return selectors;
};

const cssWhitespace = /\s/u;

const isRootedSelector = (selector: string, rootSelector: string): boolean => {
  if (!selector.startsWith(rootSelector)) return false;

  const boundary = selector[rootSelector.length];
  if (
    boundary !== undefined &&
    boundary !== "." &&
    boundary !== "#" &&
    boundary !== "[" &&
    boundary !== ":" &&
    boundary !== ">" &&
    boundary !== "+" &&
    boundary !== "~" &&
    !cssWhitespace.test(boundary)
  ) {
    return false;
  }

  let bracketDepth = 0;
  let parenthesisDepth = 0;
  let quote: "'" | '"' | undefined;
  let escaped = false;
  for (let index = rootSelector.length; index < selector.length; index += 1) {
    const character = selector[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote !== undefined) {
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === "[") {
      bracketDepth += 1;
      continue;
    }
    if (character === "]") {
      bracketDepth -= 1;
      continue;
    }
    if (character === "(") {
      parenthesisDepth += 1;
      continue;
    }
    if (character === ")") {
      parenthesisDepth -= 1;
      continue;
    }
    if (bracketDepth !== 0 || parenthesisDepth !== 0) continue;
    if (character === "+" || character === "~") return false;
    if (character === ">") return true;
    if (!cssWhitespace.test(character)) continue;

    let nextIndex = index + 1;
    while (nextIndex < selector.length && cssWhitespace.test(selector[nextIndex] ?? "")) nextIndex += 1;
    const nextCharacter = selector[nextIndex];
    return nextCharacter !== "+" && nextCharacter !== "~";
  }

  return bracketDepth === 0 && parenthesisDepth === 0 && quote === undefined && !escaped;
};

const isSafeStyleRule = (rule: CSSStyleRule, rootSelector: string): boolean => {
  if ((rule.cssRules?.length ?? 0) !== 0 || unsafeStylesheetToken.test(normalizeCssTokens(rule.style.cssText))) {
    return false;
  }
  const selectors = splitSelectorList(rule.selectorText);
  return selectors !== undefined && A.every(selectors, (selector) => isRootedSelector(selector, rootSelector));
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

const removeBuiltInMermaidKeyframes = (svg: string): undefined | string => {
  const template = globalThis.document.createElement("template");
  template.innerHTML = svg;
  if (template.content.childElementCount !== 1) return undefined;

  const root = template.content.firstElementChild;
  if (root === null || root.localName !== "svg" || root.namespaceURI !== svgNamespace) return undefined;

  for (const style of root.querySelectorAll("style")) {
    style.textContent = mermaidBuiltInKeyframes.reduce(
      (styles, keyframes) => styles.replaceAll(keyframes, ""),
      style.textContent ?? ""
    );
  }
  return root.outerHTML;
};

const isSafeMermaidSvg = (svg: string, renderId: string): boolean => {
  const parsedDocument = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = parsedDocument.documentElement;
  if (
    root.localName !== "svg" ||
    root.namespaceURI !== svgNamespace ||
    root.getAttribute("id") !== renderId ||
    root.getAttribute("role") !== mermaidRootRole ||
    parsedDocument.querySelector("parsererror") !== null
  ) {
    return false;
  }

  for (const element of parsedDocument.querySelectorAll("*")) {
    if (element.namespaceURI !== svgNamespace || HashSet.has(forbiddenSvgElements, element.localName.toLowerCase()))
      return false;

    if (element.localName === "style" && !isSafeMermaidStyles(element.textContent ?? "", renderId)) return false;

    for (const attribute of element.attributes) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on")) return false;
      if (name === "role" && (element !== root || value !== mermaidRootRole)) return false;
      if (HashSet.has(urlAttributes, name) && !value.startsWith("#")) return false;
      if (unsafeCss.test(value)) return false;
    }
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
  const inertSvg = removeBuiltInMermaidKeyframes(sanitizedSvg);
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

const renderSuccess = (svg: string): JSX.Element => (
  <div
    className="my-3 overflow-x-auto rounded border bg-background p-3"
    data-testid="mermaid-diagram"
    // biome-ignore lint/security/noDangerouslySetInnerHtml: DOMPurify sanitizes at the browser parser boundary and the inert SVG policy revalidates the exact bytes injected here.
    dangerouslySetInnerHTML={{ __html: svg }}
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
