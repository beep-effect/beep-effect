/**
 * Pure conformance checks for the generated HTML AST.
 *
 * The package validates already-constructed AST values. It deliberately does
 * not tokenize HTML source or repair trees like a WHATWG parser.
 *
 * @packageDocumentation \@beep/html/Html.conformance
 * @since 0.0.0
 */
/// <reference path="./whatwg-url.d.ts" />

import { $HtmlId } from "@beep/identity";
import { LiteralKit, TaggedErrorClass } from "@beep/schema";
import { A, Struct } from "@beep/utils";
import { color as parseCssColor } from "@csstools/css-color-parser";
import { isWhiteSpaceOrCommentNode, parseListOfComponentValues } from "@csstools/css-parser-algorithms";
import { tokenize as tokenizeCss } from "@csstools/css-tokenizer";
import { isMediaQueryInvalid, parse as parseMediaQueryList } from "@csstools/media-query-list-parser";
import { Effect, flow, Match, Number as N, pipe, Result } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
// The package root initializes Node WebIDL wrappers. These pure subpaths keep
// the author-validity algorithm exact without pulling that layer into browsers.
import { parseURL } from "whatwg-url/lib/url-state-machine.js";
import { isValidURLString } from "whatwg-url/lib/url-string-validator.js";
import { stripHtmlAsciiWhitespace, tokenizeHtmlSpaceSeparated } from "./Html.attributes.ts";
import {
  isForeignAttributeNameFixedPoint,
  isForeignChildAtForeignBoundary,
  isForeignElementNameFixedPoint,
  isHtmlChildAtForeignBoundary,
  toAsciiLowerCase,
} from "./Html.foreign.ts";
import {
  ELEMENT_META,
  HTML_ATTRIBUTE_SYNTAXES,
  HTML_AUTOCOMPLETE_CONTACT_FIELDS,
  HTML_AUTOCOMPLETE_FIELD_GROUPS,
  HTML_AUTOCOMPLETE_INPUT_STATE_GROUPS,
  HTML_BUTTON_SUBMIT_ONLY_ATTRIBUTES,
  HTML_CONDITIONAL_INPUT_ATTRIBUTE_NAMES,
  HTML_CONTENT_TOKEN_EXPANSIONS,
  HTML_ICON_LINK_RELATIONS,
  HTML_INPUT_ATTRIBUTE_APPLICABILITY,
  HtmlTag,
} from "./Html.meta.ts";
import { HtmlRoot } from "./Html.model.ts";
import { inspectSourceSizeList } from "./Html.source-size.ts";
import { inspectSrcset } from "./Html.srcset.ts";
import { isValidBcp47LanguageTag } from "./internal/Html.language-tag.ts";
import type { HtmlAttributeRequirement } from "./Html.meta.ts";
import type { Doctype } from "./Html.nodes.ts";

const $I = $HtmlId.create("Html.conformance");
const isHtmlTag = S.is(HtmlTag);
const isFiniteNumber = S.is(S.Finite);
const isString = S.is(S.String);
const HTML_URL_VALIDATION_BASE = pipe(parseURL("https://html.invalid/"), O.fromNullOr);
const ICON_SIZE_TOKEN_PATTERN = /^[1-9][0-9]*[xX][1-9][0-9]*$/u;
const INTEGER_LIST_PATTERN = /^[\t\n\f\r ]*[+-]?[0-9]+(?:[\t\n\f\r ]*,[\t\n\f\r ]*[+-]?[0-9]+)*[\t\n\f\r ]*$/u;
const MIME_TYPE_PATTERN =
  /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+\/[!#$%&'*+\-.^_`|~0-9A-Za-z]+(?:[\t ]*;[\t ]*[!#$%&'*+\-.^_`|~0-9A-Za-z]+=(?:[!#$%&'*+\-.^_`|~0-9A-Za-z]+|"(?:[\t\u0020-\u0021\u0023-\u005b\u005d-\u007e\u0080-\u00ff]|\\[\t\u0020-\u007e\u0080-\u00ff])*"))*$/u;

class HtmlChildView extends S.Class<HtmlChildView>($I`HtmlChildView`)(
  {
    _tag: S.String,
    attributes: S.Unknown.pipe(S.optionalKey),
    children: S.Array(S.suspend((): S.Codec<HtmlChildView> => HtmlChildView)).pipe(S.optionalKey),
    name: S.Unknown.pipe(S.optionalKey),
    namespace: S.String.pipe(S.optionalKey),
    value: S.Unknown.pipe(S.optionalKey),
    alt: S.Unknown.pipe(S.optionalKey),
    href: S.Unknown.pipe(S.optionalKey),
    id: S.Unknown.pipe(S.optionalKey),
    src: S.Unknown.pipe(S.optionalKey),
    srcset: S.Unknown.pipe(S.optionalKey),
    tabindex: S.Unknown.pipe(S.optionalKey),
    target: S.Unknown.pipe(S.optionalKey),
    type: S.Unknown.pipe(S.optionalKey),
  },
  $I.annote("HtmlChildView", {
    description: "Internal recursive structural view used by HTML conformance inspection.",
  })
) {}

type HtmlRootView = HtmlChildView & {
  readonly doctype?: O.Option<Doctype.Type>;
};

/**
 * Rules reported by the HTML conformance validator.
 *
 * @example
 * ```ts
 * import { HtmlConformanceRule } from "@beep/html/Html.conformance"
 *
 * console.log(HtmlConformanceRule.is.obsoleteElement("obsoleteElement")) // true
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
]).pipe(
  $I.annoteSchema("HtmlConformanceRule", {
    description: "Rule identifier emitted by HTML AST conformance validation.",
  })
);

/**
 * Decoded type of {@link HtmlConformanceRule}.
 *
 * @example
 * ```ts
 * import type { HtmlConformanceRule } from "@beep/html/Html.conformance"
 *
 * const rule: HtmlConformanceRule = "contentModel"
 * console.log(rule)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlConformanceRule = typeof HtmlConformanceRule.Type;

/**
 * One path-addressed HTML conformance violation.
 *
 * @example
 * ```ts
 * import { HtmlConformanceIssue } from "@beep/html/Html.conformance"
 *
 * const issue = HtmlConformanceIssue.make({
 *   path: ["children", "0"],
 *   rule: "contentModel",
 *   message: "Invalid child"
 * })
 * console.log(issue.rule) // "contentModel"
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
 * Failure returned when an AST cannot be proven conformant.
 *
 * @example
 * ```ts
 * import { HtmlConformanceError } from "@beep/html/Html.conformance"
 *
 * const handle = (error: HtmlConformanceError) => error.issues.length
 * console.log(typeof handle) // "function"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HtmlConformanceError extends TaggedErrorClass<HtmlConformanceError>($I`HtmlConformanceError`)(
  "HtmlConformanceError",
  {
    issues: S.NonEmptyArray(HtmlConformanceIssue),
  },
  $I.annote("HtmlConformanceError", {
    description: "The HTML AST failed one or more conformance rules.",
  })
) {}

const conformantIssuer = new WeakSet<ConformantHtmlValue>();
const conformantRoots = new WeakMap<ConformantHtmlValue, HtmlRoot.Type>();

declare const conformantHtmlProof: unique symbol;

declare class ConformantHtmlValue {
  private readonly [conformantHtmlProof]: true;
}

const isConformantHtmlValue = (value: unknown): value is ConformantHtmlValue =>
  P.isObject(value) && conformantIssuer.has(value as unknown as ConformantHtmlValue);

const issueConformantHtml = (root: HtmlRoot.Type): ConformantHtmlValue => {
  const value = Object.create(null) as ConformantHtmlValue;
  conformantRoots.set(value, root);
  conformantIssuer.add(value);
  Object.freeze(value);
  return value;
};

/**
 * Runtime-issued proof that an HTML root passed {@link inspectConformance}.
 *
 * @example
 * ```ts
 * import { conform, conformantRoot } from "@beep/html/Html.conformance"
 * import { Fragment } from "@beep/html/Html.model"
 * import { Effect } from "effect"
 *
 * const proof = Effect.runSync(conform(Fragment.make({ children: [] })))
 * console.log(conformantRoot(proof)._tag) // "#fragment"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ConformantHtml = S.declare(isConformantHtmlValue).pipe(
  $I.annoteSchema("ConformantHtml", {
    description: "Runtime-issued proof of HTML AST conformance.",
  })
);

/**
 * Decoded type of {@link ConformantHtml}.
 *
 * @example
 * ```ts
 * import { conformantRoot } from "@beep/html/Html.conformance"
 * import type { ConformantHtml } from "@beep/html/Html.conformance"
 *
 * const rootTag = (value: ConformantHtml) => conformantRoot(value)._tag
 * console.log(typeof rootTag) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ConformantHtml = typeof ConformantHtml.Type;

/**
 * Canonical schema alias for a conformance-proven HTML node or root.
 *
 * @example
 * ```ts
 * import { conform, ConformantHtmlNode, Fragment } from "@beep/html"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const proof = Effect.runSync(conform(Fragment.make({ children: [] })))
 * console.log(S.is(ConformantHtmlNode)(proof)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ConformantHtmlNode = ConformantHtml;

/**
 * Decoded type of {@link ConformantHtmlNode}.
 *
 * @example
 * ```ts
 * import { conformantRoot } from "@beep/html/Html.conformance"
 * import type { ConformantHtmlNode } from "@beep/html/Html.conformance"
 *
 * const rootTag = (value: ConformantHtmlNode) => conformantRoot(value)._tag
 * console.log(typeof rootTag) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ConformantHtmlNode = ConformantHtml;

const makeIssue = (path: ReadonlyArray<string>, rule: HtmlConformanceRule, message: string): HtmlConformanceIssue =>
  HtmlConformanceIssue.make({ path, rule, message });

const makeConformanceError = (message: string): HtmlConformanceError =>
  HtmlConformanceError.make({
    issues: [makeIssue([], "encodingFailure", message)],
  });

const freezeTree = <A>(value: A): A => {
  const visited = new WeakSet<object>();
  const visit = (current: unknown): void => {
    if ((!P.isObject(current) && !A.isArray(current)) || visited.has(current)) return;
    visited.add(current);
    for (const [, nested] of Struct.entries(current)) {
      visit(nested);
    }
    Object.freeze(current);
  };
  visit(value);
  return value;
};

const snapshotFailure = (): HtmlConformanceError =>
  makeConformanceError("The HTML root could not be copied into a detached schema-valid conformance snapshot");

const snapshotRoot = (root: HtmlRoot.Type): Effect.Effect<HtmlRoot.Type, HtmlConformanceError> =>
  Result.match(S.encodeResult(HtmlRoot)(root), {
    onFailure: () => Effect.fail(snapshotFailure()),
    onSuccess: (encoded) =>
      Result.match(S.decodeUnknownResult(HtmlRoot)(encoded), {
        onFailure: () => Effect.fail(snapshotFailure()),
        onSuccess: (decoded) => Effect.succeed(freezeTree(decoded)),
      }),
  });

const childPath = (path: ReadonlyArray<string>, index: number): ReadonlyArray<string> =>
  A.append(path, `children.${index}`);

const attributeValue = (value: unknown): O.Option<unknown> => (O.isOption(value) ? value : O.fromUndefinedOr(value));

const hasAttribute = (value: unknown): boolean => O.isSome(attributeValue(value));

const attributeEquals = (value: unknown, expected: string): boolean =>
  pipe(
    attributeValue(value),
    O.exists((candidate) => candidate === expected)
  );

const normalizedAttributeTokens = (value: unknown): O.Option<ReadonlyArray<string>> =>
  pipe(attributeValue(value), O.filter(isString), O.map(flow(tokenizeHtmlSpaceSeparated, A.map(toAsciiLowerCase))));

const attributeTokensAreSubset = (value: unknown, allowed: string): boolean => {
  const allowedTokens = tokenizeHtmlSpaceSeparated(allowed);
  return pipe(
    normalizedAttributeTokens(value),
    O.exists(
      (tokens) => A.isReadonlyArrayNonEmpty(tokens) && A.every(tokens, (token) => A.contains(allowedTokens, token))
    )
  );
};

const attributeTokensContainAll = (value: unknown, required: ReadonlyArray<string>): boolean =>
  pipe(
    normalizedAttributeTokens(value),
    O.exists((tokens) => A.every(required, (token) => A.contains(tokens, token)))
  );

const attributeTokensContainAny = (value: unknown, required: ReadonlyArray<string>): boolean =>
  pipe(
    normalizedAttributeTokens(value),
    O.exists((tokens) => A.some(required, (token) => A.contains(tokens, token)))
  );

const hasNonBlankStringAttribute = (value: unknown): boolean =>
  pipe(attributeValue(value), O.filter(isString), O.exists(flow(stripHtmlAsciiWhitespace, Str.isNonEmpty)));

const isValidHtmlUrlString = (value: string): boolean => {
  const candidate = stripHtmlAsciiWhitespace(value);
  return (
    Str.isNonEmpty(candidate) &&
    pipe(
      HTML_URL_VALIDATION_BASE,
      O.exists((baseURL) => isValidURLString(candidate, { baseURL }))
    )
  );
};

const isValidNonEmptyHtmlUrl = (value: unknown): boolean =>
  pipe(attributeValue(value), O.filter(isString), O.exists(isValidHtmlUrlString));

const stringAttributeValue = (value: unknown): O.Option<string> => pipe(attributeValue(value), O.filter(isString));

const srcsetProfile = (value: unknown) =>
  pipe(
    stringAttributeValue(value),
    O.flatMap((input) => inspectSrcset(input, isValidHtmlUrlString))
  );

const sourceSizeAnalysis = (value: unknown) =>
  pipe(
    stringAttributeValue(value),
    O.flatMap((input) =>
      Result.match(inspectSourceSizeList(input), {
        onFailure: O.none,
        onSuccess: O.some,
      })
    )
  );

const isValidIconSizes = (value: string): boolean => {
  const tokens = tokenizeHtmlSpaceSeparated(value);
  const normalized = A.map(tokens, toAsciiLowerCase);
  return (
    A.isReadonlyArrayNonEmpty(tokens) &&
    A.every(normalized, (token) => token === "any" || pipe(Str.match(ICON_SIZE_TOKEN_PATTERN)(token), O.isSome)) &&
    A.dedupe(normalized).length === normalized.length
  );
};

const attributeHasRequiredValue = (value: unknown, expected: string, asciiCaseInsensitive: boolean): boolean =>
  pipe(
    attributeValue(value),
    O.filter(isString),
    O.exists((candidate) => {
      /* istanbul ignore else -- every generated equality and HTML keyword comparison is ASCII-case-insensitive */
      if (asciiCaseInsensitive) return toAsciiLowerCase(candidate) === toAsciiLowerCase(expected);
      return candidate === expected;
    })
  );

const attributeHasAllowedValue = (value: unknown, allowed: ReadonlyArray<string>): boolean =>
  pipe(
    attributeValue(value),
    O.match({
      onNone: () => true,
      onSome: (candidate) => isString(candidate) && A.contains(allowed, candidate),
    })
  );

const isValidMediaQueryList = (value: string): boolean => {
  const input = stripHtmlAsciiWhitespace(value);
  if (Str.isEmpty(input)) return true;
  let hasParseError = false;
  const queries = parseMediaQueryList(input, {
    onParseError: () => {
      hasParseError = true;
    },
    preserveInvalidMediaQueries: true,
  });
  return (
    !hasParseError && A.isReadonlyArrayNonEmpty(queries) && A.every(queries, (query) => !isMediaQueryInvalid(query))
  );
};

const isDifferentiatingMediaQueryList = (value: string): boolean => {
  const input = toAsciiLowerCase(stripHtmlAsciiWhitespace(value));
  return Str.isNonEmpty(input) && input !== "all" && isValidMediaQueryList(input);
};

const isValidMimeType = (value: string): boolean => MIME_TYPE_PATTERN.test(value);

const isValidCssColor = (value: string): boolean => {
  let hasParseError = false;
  const nodes = pipe(
    parseListOfComponentValues(tokenizeCss({ css: value }), {
      onParseError: () => {
        hasParseError = true;
      },
    }),
    A.filter((node) => !isWhiteSpaceOrCommentNode(node))
  );
  const node = nodes[0];
  return !hasParseError && nodes.length === 1 && node !== undefined && parseCssColor(node) !== false;
};

type ExactInteger = {
  readonly magnitude: string;
  readonly negative: boolean;
};

const normalizeExactInteger = (value: string): ExactInteger => {
  const token = stripHtmlAsciiWhitespace(value);
  const unsigned = Str.replace(/^[-+]?0*/u, "")(token);
  const magnitude = Str.isEmpty(unsigned) ? "0" : unsigned;
  return { magnitude, negative: magnitude !== "0" && Str.startsWith("-")(token) };
};

const parseIntegerList = (value: string): O.Option<ReadonlyArray<ExactInteger>> =>
  INTEGER_LIST_PATTERN.test(value) ? O.some(pipe(Str.split(",")(value), A.map(normalizeExactInteger))) : O.none();

const compareIntegerMagnitude = (left: ExactInteger, right: ExactInteger): number =>
  left.magnitude.length === right.magnitude.length
    ? Str.Order(left.magnitude, right.magnitude)
    : N.Order(left.magnitude.length, right.magnitude.length);

const exactIntegerIsLessThan = (left: ExactInteger, right: ExactInteger): boolean => {
  if (left.negative !== right.negative) return left.negative;
  const comparison = compareIntegerMagnitude(left, right);
  return left.negative ? N.isGreaterThan(comparison, 0) : N.isLessThan(comparison, 0);
};

const childrenOf = (node: HtmlChildView): ReadonlyArray<HtmlChildView> =>
  pipe(node.children, O.fromUndefinedOr, O.getOrElse(A.empty));

type ElementOccurrence = {
  readonly node: HtmlChildView;
  readonly path: ReadonlyArray<string>;
  readonly tag: HtmlTag;
};

const elementOccurrences = (node: HtmlChildView, path: ReadonlyArray<string>): ReadonlyArray<ElementOccurrence> => {
  const own = isHtmlTag(node._tag) ? [{ node, path, tag: node._tag }] : A.emptyReadonly<ElementOccurrence>();
  return [...own, ...A.flatMap(childrenOf(node), (child, index) => elementOccurrences(child, childPath(path, index)))];
};

const forbiddenDescendantConstraints = pipe(
  R.toEntries(ELEMENT_META),
  A.flatMap(([ancestor, meta]) =>
    pipe(
      meta.rules.forbiddenDescendants,
      O.fromUndefinedOr,
      O.map((rule) => ({ ancestor, ...rule })),
      O.toArray
    )
  )
);

const forbiddenNamedAncestorConstraints = pipe(
  R.toEntries(ELEMENT_META),
  A.flatMap(([descendant, meta]) =>
    pipe(
      meta.rules.forbiddenNamedAncestors,
      O.fromUndefinedOr,
      O.match({
        onNone: A.emptyReadonly,
        onSome: A.map((condition) => ({ descendant, ...condition })),
      })
    )
  )
);

const effectiveCategories = (node: HtmlChildView, tag: HtmlTag): ReadonlyArray<string> => {
  const meta = ELEMENT_META[tag];
  return A.filter(meta.categories, (category) => {
    const rules = A.filter(meta.conditionalCategories, (rule) => rule.category === category);
    return (
      rules.length === 0 ||
      A.some(rules, (rule) => {
        const value = (node as unknown as Record<string, unknown>)[rule.attribute];
        return Match.value(rule.condition).pipe(
          Match.when("present", () => hasAttribute(value)),
          Match.when("not-equals", () => {
            /* istanbul ignore if -- generation rejects a missing value for every non-present predicate */
            if (rule.value === undefined) return false;
            return !attributeEquals(value, rule.value);
          }),
          Match.when("tokens-subset", () => {
            /* istanbul ignore if -- generation rejects a missing value for every non-present predicate */
            if (rule.value === undefined) return false;
            return attributeTokensAreSubset(value, rule.value);
          }),
          Match.exhaustive
        );
      })
    );
  });
};

const inspectForbiddenDescendants = (
  node: HtmlChildView,
  tag: HtmlTag,
  path: ReadonlyArray<string>,
  ancestors: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> => {
  const categories = effectiveCategories(node, tag);
  const descendantIssues = A.flatMap(forbiddenDescendantConstraints, (constraint) =>
    A.contains(ancestors, constraint.ancestor)
      ? pipe(
          constraint.attributes,
          A.findFirst((attribute) => hasAttribute(Reflect.get(node, attribute))),
          O.match({
            onNone: () =>
              A.contains(constraint.tags, tag) ||
              A.some(constraint.categories, (category) => A.contains(categories, category))
                ? [makeIssue(path, "forbiddenDescendant", `<${tag}> is forbidden beneath <${constraint.ancestor}>`)]
                : A.emptyReadonly(),
            onSome: (attribute) => [
              makeIssue(
                A.append(path, `attributes.${attribute}`),
                "forbiddenDescendant",
                `<${tag} ${attribute}> is forbidden beneath <${constraint.ancestor}>`
              ),
            ],
          })
        )
      : A.emptyReadonly()
  );
  const ancestorIssues = pipe(
    ELEMENT_META[tag].rules.permittedAncestors,
    O.fromUndefinedOr,
    O.flatMap((permitted) =>
      A.findFirst(ancestors, (ancestor) => !isHtmlTag(ancestor) || !A.contains(permitted, ancestor))
    ),
    O.map((ancestor) => makeIssue(path, "forbiddenDescendant", `<${tag}> is forbidden beneath <${ancestor}>`)),
    O.toArray
  );
  const requiredAncestorIssues = pipe(
    ELEMENT_META[tag].rules.requiredAncestor,
    O.fromUndefinedOr,
    O.filter((required) => !A.contains(ancestors, required)),
    O.map((required) => makeIssue(path, "contentModel", `<${tag}> requires a <${required}> ancestor`)),
    O.toArray
  );
  const namedAncestorIssues = A.flatMap(forbiddenNamedAncestorConstraints, (constraint) =>
    constraint.tag === tag &&
    A.some(constraint.attributes, (attribute) => hasNonBlankStringAttribute(Reflect.get(node, attribute)))
      ? pipe(
          elementOccurrences(node, path),
          A.filter((occurrence) => occurrence.tag === constraint.descendant),
          A.map((occurrence) =>
            makeIssue(
              occurrence.path,
              "forbiddenDescendant",
              `<${constraint.descendant}> is forbidden beneath named <${constraint.tag}>`
            )
          )
        )
      : A.emptyReadonly()
  );
  return [...descendantIssues, ...ancestorIssues, ...requiredAncestorIssues, ...namedAncestorIssues];
};

const inspectElementAttributes = (
  node: HtmlChildView,
  tag: HtmlTag,
  path: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> => {
  const meta = ELEMENT_META[tag];
  return pipe(
    Struct.entries(node as unknown as Record<string, unknown>),
    A.filter(([name, value]) => name !== "_tag" && name !== "children" && name !== "content" && hasAttribute(value)),
    A.flatMap(([name]) =>
      A.contains(meta.obsoleteAttributes, name)
        ? [makeIssue(A.append(path, `attributes.${name}`), "obsoleteAttribute", `<${tag} ${name}> is obsolete`)]
        : A.contains(meta.currentAttributes, name)
          ? A.emptyReadonly()
          : [
              makeIssue(
                A.append(path, `attributes.${name}`),
                "misplacedAttribute",
                `Attribute ${name} is not permitted on <${tag}>`
              ),
            ]
    )
  );
};

const inspectSpecialAttributeSyntaxes = (
  node: HtmlChildView,
  tag: HtmlTag,
  path: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> => {
  const attributes = node as unknown as Record<string, unknown>;
  return A.flatMap(Struct.entries(attributes), ([attribute, value]) =>
    hasAttribute(value)
      ? pipe(
          R.get(HTML_ATTRIBUTE_SYNTAXES, `${tag}/${attribute}`),
          O.match({
            onNone: A.emptyReadonly,
            onSome: (syntax): ReadonlyArray<HtmlConformanceIssue> => {
              const valid = pipe(
                stringAttributeValue(value),
                O.exists((input) =>
                  Match.value(syntax).pipe(
                    Match.when("icon-sizes", () => isValidIconSizes(input)),
                    Match.when("language-tag", () => isValidBcp47LanguageTag(input)),
                    Match.when("source-size-list", () => Result.isSuccess(inspectSourceSizeList(input))),
                    Match.when("srcset", () => O.isSome(inspectSrcset(input, isValidHtmlUrlString))),
                    Match.exhaustive
                  )
                )
              );
              return valid
                ? A.emptyReadonly()
                : [
                    makeIssue(
                      A.append(path, `attributes.${attribute}`),
                      "attributeRelationship",
                      `<${tag} ${attribute}> is not a valid ${syntax}`
                    ),
                  ];
            },
          })
        )
      : A.emptyReadonly()
  );
};

const inputTypeState = (node: HtmlChildView): string =>
  pipe(
    attributeValue((node as unknown as Record<string, unknown>).type),
    O.filter(isString),
    O.getOrElse(() => "text")
  );

const generatedInputStateEntry = (
  registry: Readonly<Record<string, ReadonlyArray<string>>>,
  state: string
): ReadonlyArray<string> => {
  const entry = registry[state];
  /* istanbul ignore next -- Input.type is closed and both generated state registries are total */
  return entry ?? A.emptyReadonly();
};

const inspectInputAttributeApplicability = (
  node: HtmlChildView,
  tag: HtmlTag,
  path: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> => {
  if (tag !== "input") return A.emptyReadonly();
  const attributes = node as unknown as Record<string, unknown>;
  const state = inputTypeState(node);
  const allowed = generatedInputStateEntry(HTML_INPUT_ATTRIBUTE_APPLICABILITY, state);
  return A.flatMap(HTML_CONDITIONAL_INPUT_ATTRIBUTE_NAMES, (attribute) =>
    hasAttribute(attributes[attribute]) && !A.contains(allowed, attribute)
      ? [
          makeIssue(
            A.append(path, `attributes.${attribute}`),
            "attributeRelationship",
            `<input type="${state}"> does not permit ${attribute}`
          ),
        ]
      : A.emptyReadonly()
  );
};

type AutocompleteDetail = {
  readonly contactHint: O.Option<string>;
  readonly field: string;
  readonly webauthn: boolean;
};

const isAutocompleteToggle = (tokens: ReadonlyArray<string>): boolean =>
  pipe(
    A.head(tokens),
    O.filter(() => tokens.length === 1),
    O.exists((token) => A.contains(["on", "off"], token))
  );

const advanceAutocompleteIndex = (
  tokens: ReadonlyArray<string>,
  index: number,
  matches: (token: string) => boolean
): number => pipe(A.get(tokens, index), O.filter(matches), O.match({ onNone: () => index, onSome: () => index + 1 }));

const autocompleteFieldStart = (tokens: ReadonlyArray<string>): number => {
  const afterSection = advanceAutocompleteIndex(tokens, 0, Str.startsWith("section-"));
  return advanceAutocompleteIndex(tokens, afterSection, (token) => A.contains(["shipping", "billing"], token));
};

const autocompleteContactHint = (tokens: ReadonlyArray<string>, index: number): O.Option<string> =>
  pipe(
    A.get(tokens, index),
    O.filter((token) => A.contains(["home", "work", "mobile", "fax", "pager"], token))
  );

const autocompleteDetail = (value: string): O.Option<AutocompleteDetail> => {
  const tokens = tokenizeHtmlSpaceSeparated(value);
  if (isAutocompleteToggle(tokens)) return O.none();
  const detailStart = autocompleteFieldStart(tokens);
  const contactHint = autocompleteContactHint(tokens, detailStart);
  const fieldIndex = detailStart + (O.isSome(contactHint) ? 1 : 0);
  return pipe(
    A.get(tokens, fieldIndex),
    O.map((field) => ({ contactHint, field, webauthn: tokens[fieldIndex + 1] === "webauthn" }))
  );
};

const autocompleteFieldGroup = (field: string): O.Option<string> =>
  pipe(
    R.toEntries(HTML_AUTOCOMPLETE_FIELD_GROUPS),
    A.findFirst(([, fields]) => A.contains(fields, field)),
    O.map(([group]) => group)
  );

const autocompleteFieldGroupIsCompatible = (detail: AutocompleteDetail, tag: HtmlTag, state: string): boolean => {
  const fieldGroup = autocompleteFieldGroup(detail.field);
  const allowedGroups =
    tag === "input" ? generatedInputStateEntry(HTML_AUTOCOMPLETE_INPUT_STATE_GROUPS, state) : undefined;
  return O.isSome(fieldGroup) && (allowedGroups === undefined || A.contains(allowedGroups, fieldGroup.value));
};

const autocompleteDetailIsCompatible = (detail: AutocompleteDetail, tag: HtmlTag, state: string): boolean =>
  A.every(
    [
      autocompleteFieldGroupIsCompatible(detail, tag, state),
      !detail.webauthn || tag !== "select",
      O.isNone(detail.contactHint) || A.contains(HTML_AUTOCOMPLETE_CONTACT_FIELDS, detail.field),
    ],
    P.isTruthy
  );

const autocompleteToggleIssues = (
  tag: HtmlTag,
  state: string,
  path: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> =>
  tag === "input" && state === "hidden"
    ? [
        makeIssue(
          A.append(path, "attributes.autocomplete"),
          "attributeRelationship",
          "<input type=hidden autocomplete> requires autofill detail tokens rather than on or off"
        ),
      ]
    : A.emptyReadonly();

const autocompleteDetailIssues = (
  detail: AutocompleteDetail,
  tag: HtmlTag,
  state: string,
  path: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> =>
  autocompleteDetailIsCompatible(detail, tag, state)
    ? A.emptyReadonly()
    : [
        makeIssue(
          A.append(path, "attributes.autocomplete"),
          "attributeRelationship",
          `<${tag} autocomplete> field tokens are not compatible with the ${state} control`
        ),
      ];

const inspectAutocompleteValue = (
  node: HtmlChildView,
  tag: HtmlTag,
  path: ReadonlyArray<string>,
  autocomplete: string
): ReadonlyArray<HtmlConformanceIssue> => {
  const state = tag === "input" ? inputTypeState(node) : tag;
  return pipe(
    autocompleteDetail(autocomplete),
    O.match({
      onNone: () => autocompleteToggleIssues(tag, state, path),
      onSome: (detail) => autocompleteDetailIssues(detail, tag, state, path),
    })
  );
};

const inspectAutocompleteCompatibility = (
  node: HtmlChildView,
  tag: HtmlTag,
  path: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> => {
  if (tag !== "input" && tag !== "textarea" && tag !== "select") return A.emptyReadonly();
  const attributes = node as unknown as Record<string, unknown>;
  const value = stringAttributeValue(attributes.autocomplete);
  return pipe(
    value,
    O.match({
      onNone: A.emptyReadonly,
      onSome: (autocomplete) => inspectAutocompleteValue(node, tag, path, autocomplete),
    })
  );
};

const inspectButtonSubmitAttributes = (
  node: HtmlChildView,
  tag: HtmlTag,
  path: ReadonlyArray<string>,
  ancestors: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> => {
  if (tag !== "button") return A.emptyReadonly();
  const attributes = node as unknown as Record<string, unknown>;
  const explicitType = stringAttributeValue(attributes.type);
  const effectiveSubmit = pipe(
    explicitType,
    O.match({
      onNone: () =>
        !hasAttribute(attributes.command) &&
        !hasAttribute(attributes.commandfor) &&
        !O.contains(A.last(ancestors), "select"),
      onSome: (type) => type === "submit",
    })
  );
  return effectiveSubmit
    ? A.emptyReadonly()
    : A.flatMap(HTML_BUTTON_SUBMIT_ONLY_ATTRIBUTES, (attribute) =>
        hasAttribute(attributes[attribute])
          ? [
              makeIssue(
                A.append(path, `attributes.${attribute}`),
                "attributeRelationship",
                `<button ${attribute}> is permitted only on an effective submit button`
              ),
            ]
          : A.emptyReadonly()
      );
};

const inspectAreaCoordinates = (
  node: HtmlChildView,
  tag: HtmlTag,
  path: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> => {
  if (tag !== "area") return A.emptyReadonly();
  const attributes = node as unknown as Record<string, unknown>;
  const shape = pipe(
    stringAttributeValue(attributes.shape),
    O.getOrElse(() => "rect")
  );
  const coords = pipe(stringAttributeValue(attributes.coords), O.flatMap(parseIntegerList));
  const valid = Match.value(shape).pipe(
    Match.when("default", () => !hasAttribute(attributes.coords)),
    Match.when("circle", () =>
      O.exists(coords, (values) => values.length === 3 && values[2] !== undefined && !values[2].negative)
    ),
    Match.when("poly", () =>
      O.exists(coords, (values) => values.length >= 6 && N.Equivalence(N.remainder(values.length, 2), 0))
    ),
    Match.orElse(() =>
      O.exists(
        coords,
        (values) =>
          values.length === 4 &&
          values[0] !== undefined &&
          values[1] !== undefined &&
          values[2] !== undefined &&
          values[3] !== undefined &&
          exactIntegerIsLessThan(values[0], values[2]) &&
          exactIntegerIsLessThan(values[1], values[3])
      )
    )
  );
  return valid
    ? A.emptyReadonly()
    : [
        makeIssue(
          A.append(path, "attributes.coords"),
          "attributeRelationship",
          `<area coords> is not valid for shape=${shape}`
        ),
      ];
};

const inspectMediaTypeAndColor = (
  node: HtmlChildView,
  tag: HtmlTag,
  path: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> => {
  if (tag !== "link" && tag !== "source") return A.emptyReadonly();
  const attributes = node as unknown as Record<string, unknown>;
  const mediaIssues = pipe(
    stringAttributeValue(attributes.media),
    O.filter((value) => !isValidMediaQueryList(value)),
    O.map(() =>
      makeIssue(
        A.append(path, "attributes.media"),
        "attributeRelationship",
        `<${tag} media> must be a valid media-query list`
      )
    ),
    O.toArray
  );
  const typeIssues = pipe(
    stringAttributeValue(attributes.type),
    O.filter((value) => !isValidMimeType(value)),
    O.map(() =>
      makeIssue(A.append(path, "attributes.type"), "attributeRelationship", `<${tag} type> must be a valid MIME type`)
    ),
    O.toArray
  );
  const validColor = pipe(
    stringAttributeValue(attributes.color),
    O.exists((value) => attributeTokensContainAny(attributes.rel, ["mask-icon"]) && isValidCssColor(value))
  );
  const colorIssues =
    tag === "link" && hasAttribute(attributes.color) && !validColor
      ? [
          makeIssue(
            A.append(path, "attributes.color"),
            "attributeRelationship",
            "<link color> requires a valid CSS color and rel=mask-icon"
          ),
        ]
      : A.emptyReadonly();
  return [...mediaIssues, ...typeIssues, ...colorIssues];
};

const imgAllowsAutoSizes = (node: HtmlChildView): boolean => {
  const attributes = node as unknown as Record<string, unknown>;
  return (
    attributeHasRequiredValue(attributes.loading, "lazy", true) &&
    pipe(
      sourceSizeAnalysis(attributes.sizes),
      O.exists((analysis) => analysis.usesAuto)
    )
  );
};

const inspectImgResponsiveRelationships = (
  node: HtmlChildView,
  path: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> => {
  const attributes = node as unknown as Record<string, unknown>;
  const profile = srcsetProfile(attributes.srcset);
  const sizes = sourceSizeAnalysis(attributes.sizes);
  const hasSrcset = hasAttribute(attributes.srcset);
  const hasSizes = hasAttribute(attributes.sizes);
  const loadingIsLazy = attributeHasRequiredValue(attributes.loading, "lazy", true);
  const sizesIsExactlyAuto = pipe(
    stringAttributeValue(attributes.sizes),
    O.exists((value) => toAsciiLowerCase(value) === "auto")
  );
  const missingSizes = O.contains(profile, "width") && !hasSizes;
  const incompatibleSizes = pipe(
    sizes,
    O.exists((analysis) => {
      if (!hasSrcset) return !loadingIsLazy || !sizesIsExactlyAuto;
      if (O.contains(profile, "density")) return true;
      return O.contains(profile, "width") && analysis.usesAuto && !loadingIsLazy;
    })
  );
  return [
    ...(missingSizes
      ? [
          makeIssue(
            A.append(path, "attributes.srcset"),
            "attributeRelationship",
            "<img srcset> using width descriptors requires sizes"
          ),
        ]
      : A.emptyReadonly<HtmlConformanceIssue>()),
    ...(incompatibleSizes
      ? [
          makeIssue(
            A.append(path, "attributes.sizes"),
            "attributeRelationship",
            "<img sizes> requires a width-descriptor srcset, except for loading=lazy with sizes=auto"
          ),
        ]
      : A.emptyReadonly<HtmlConformanceIssue>()),
  ];
};

const inspectLinkResponsiveRelationships = (
  node: HtmlChildView,
  path: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> => {
  const attributes = node as unknown as Record<string, unknown>;
  const profile = srcsetProfile(attributes.imagesrcset);
  const imageSizes = sourceSizeAnalysis(attributes.imagesizes);
  const hasImageSrcset = hasAttribute(attributes.imagesrcset);
  const hasImageSizes = hasAttribute(attributes.imagesizes);
  const imageSizesIncompatible = pipe(
    imageSizes,
    O.exists(() => !hasImageSrcset || O.contains(profile, "density"))
  );
  const iconSizesMisplaced =
    hasAttribute(attributes.sizes) && !attributeTokensContainAny(attributes.rel, HTML_ICON_LINK_RELATIONS);
  return [
    ...(O.contains(profile, "width") && !hasImageSizes
      ? [
          makeIssue(
            A.append(path, "attributes.imagesrcset"),
            "attributeRelationship",
            "<link imagesrcset> using width descriptors requires imagesizes"
          ),
        ]
      : A.emptyReadonly<HtmlConformanceIssue>()),
    ...(imageSizesIncompatible
      ? [
          makeIssue(
            A.append(path, "attributes.imagesizes"),
            "attributeRelationship",
            "<link imagesizes> requires a width-descriptor imagesrcset"
          ),
        ]
      : A.emptyReadonly<HtmlConformanceIssue>()),
    ...(iconSizesMisplaced
      ? [
          makeIssue(
            A.append(path, "attributes.sizes"),
            "attributeRelationship",
            "<link sizes> requires an icon link relation"
          ),
        ]
      : A.emptyReadonly<HtmlConformanceIssue>()),
  ];
};

const inspectPictureSourceResponsiveRelationships = (
  source: HtmlChildView,
  path: ReadonlyArray<string>,
  followingImage: O.Option<HtmlChildView>
): ReadonlyArray<HtmlConformanceIssue> => {
  const attributes = source as unknown as Record<string, unknown>;
  const profile = srcsetProfile(attributes.srcset);
  const sizes = sourceSizeAnalysis(attributes.sizes);
  const hasSizes = hasAttribute(attributes.sizes);
  const followingImageAllowsAuto = pipe(followingImage, O.exists(imgAllowsAutoSizes));
  return [
    ...(O.contains(profile, "width") && !hasSizes && !followingImageAllowsAuto
      ? [
          makeIssue(
            A.append(path, "attributes.srcset"),
            "attributeRelationship",
            "<source srcset> using width descriptors requires sizes unless the following img allows auto-sizes"
          ),
        ]
      : A.emptyReadonly<HtmlConformanceIssue>()),
    ...(pipe(
      sizes,
      O.exists(() => O.contains(profile, "density"))
    )
      ? [
          makeIssue(
            A.append(path, "attributes.sizes"),
            "attributeRelationship",
            "<source sizes> requires a width-descriptor srcset"
          ),
        ]
      : A.emptyReadonly<HtmlConformanceIssue>()),
    ...(pipe(
      sizes,
      O.exists((analysis) => analysis.usesAuto && !followingImageAllowsAuto)
    )
      ? [
          makeIssue(
            A.append(path, "attributes.sizes"),
            "attributeRelationship",
            "<source sizes> may use auto only when a following img allows auto-sizes"
          ),
        ]
      : A.emptyReadonly<HtmlConformanceIssue>()),
  ];
};

const isResponsivePictureCandidate = (candidate: HtmlChildView): boolean =>
  (candidate._tag === "source" || candidate._tag === "img") &&
  hasAttribute((candidate as unknown as Record<string, unknown>).srcset);

const isMissingPictureSourceDifferentiator = (media: O.Option<string>, type: O.Option<string>): boolean =>
  O.isNone(media) && O.isNone(type);

const isNonDifferentiatingPictureSourceMedia = (media: O.Option<string>, type: O.Option<string>): boolean =>
  O.isSome(media) &&
  isValidMediaQueryList(media.value) &&
  !isDifferentiatingMediaQueryList(media.value) &&
  O.isNone(type);

const pictureSourceDifferentiationIssues = (
  path: ReadonlyArray<string>,
  laterResponsiveCandidate: boolean,
  media: O.Option<string>,
  type: O.Option<string>
): ReadonlyArray<HtmlConformanceIssue> => {
  if (!laterResponsiveCandidate) return A.emptyReadonly();
  if (isMissingPictureSourceDifferentiator(media, type)) {
    return [
      makeIssue(
        A.append(path, "attributes"),
        "attributeRelationship",
        "A <picture> source before a later responsive candidate requires differentiating media or type"
      ),
    ];
  }
  return isNonDifferentiatingPictureSourceMedia(media, type)
    ? [
        makeIssue(
          A.append(path, "attributes.media"),
          "attributeRelationship",
          "A <picture> source media differentiator must be nonempty and not all"
        ),
      ]
    : A.emptyReadonly();
};

const inspectPictureResponsiveChild = (
  children: ReadonlyArray<HtmlChildView>,
  path: ReadonlyArray<string>,
  child: HtmlChildView,
  index: number
): ReadonlyArray<HtmlConformanceIssue> => {
  if (child._tag !== "source") return A.emptyReadonly();
  const attributes = child as unknown as Record<string, unknown>;
  const laterChildren = A.drop(children, index + 1);
  const followingImage = A.findFirst(laterChildren, (candidate) => candidate._tag === "img");
  const childIssuePath = childPath(path, index);
  return [
    ...inspectPictureSourceResponsiveRelationships(child, childIssuePath, followingImage),
    ...pictureSourceDifferentiationIssues(
      childIssuePath,
      A.some(laterChildren, isResponsivePictureCandidate),
      stringAttributeValue(attributes.media),
      stringAttributeValue(attributes.type)
    ),
  ];
};

const inspectPictureResponsiveRelationships = (
  children: ReadonlyArray<HtmlChildView>,
  path: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> =>
  A.flatMap(children, (child, index) => inspectPictureResponsiveChild(children, path, child, index));

const inspectResponsiveImageRelationships = (
  node: HtmlChildView,
  tag: HtmlTag,
  path: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> =>
  Match.value(tag).pipe(
    Match.when("img", () => inspectImgResponsiveRelationships(node, path)),
    Match.when("link", () => inspectLinkResponsiveRelationships(node, path)),
    Match.when("picture", () => inspectPictureResponsiveRelationships(childrenOf(node), path)),
    Match.orElse((): ReadonlyArray<HtmlConformanceIssue> => A.emptyReadonly())
  );

type AttributeValueConstraint = NonNullable<HtmlAttributeRequirement["constraints"]>[number];

const attributeRequirementAppliesToParent = (
  requirement: HtmlAttributeRequirement,
  ancestors: ReadonlyArray<string>
): boolean =>
  pipe(
    requirement.whenParents,
    O.fromUndefinedOr,
    O.match({
      onNone: () => true,
      onSome: (whenParents) =>
        pipe(
          A.last(ancestors),
          O.filter(isHtmlTag),
          O.exists((parent) => A.contains(whenParents, parent))
        ),
    })
  );

const attributeRequirementAppliesToAttributes = (
  requirement: HtmlAttributeRequirement,
  attributes: Record<string, unknown>
): boolean =>
  pipe(
    requirement.when,
    O.fromUndefinedOr,
    O.match({
      onNone: () => true,
      onSome: (predicate) =>
        Match.value(predicate).pipe(
          Match.tags({
            attributeContainsToken: ({ attribute, value }) => attributeTokensContainAll(attributes[attribute], [value]),
            attributeEquals: ({ attribute, value }) => attributeEquals(attributes[attribute], value),
            attributeEqualsOrMissing: ({ attribute, value }) =>
              !hasAttribute(attributes[attribute]) || attributeEquals(attributes[attribute], value),
            attributePresent: ({ attribute }) => hasAttribute(attributes[attribute]),
          }),
          Match.exhaustive
        ),
    })
  );

const missingRequiredAttributeGroups = (
  requirement: HtmlAttributeRequirement,
  attributes: Record<string, unknown>
): ReadonlyArray<ReadonlyArray<string>> =>
  A.filter(
    requirement.required,
    (alternatives) => !A.some(alternatives, (attribute) => hasAttribute(attributes[attribute]))
  );

const singleMissingRequiredAttribute = (missingRequired: ReadonlyArray<ReadonlyArray<string>>): O.Option<string> =>
  pipe(
    missingRequired,
    A.get(0),
    O.filter((alternatives) => A.length(missingRequired) === 1 && A.length(alternatives) === 1),
    O.flatMap(A.get(0))
  );

const attributeRequirementHasForbiddenAttribute = (
  requirement: HtmlAttributeRequirement,
  attributes: Record<string, unknown>
): boolean =>
  pipe(
    requirement.forbidden,
    O.fromUndefinedOr,
    O.exists((forbidden) => A.some(forbidden, (attribute) => hasAttribute(attributes[attribute])))
  );

const attributeRequirementHasBlankAttribute = (
  requirement: HtmlAttributeRequirement,
  attributes: Record<string, unknown>
): boolean =>
  pipe(
    requirement.nonBlank,
    O.fromUndefinedOr,
    O.exists((nonBlank) =>
      A.some(
        nonBlank,
        (attribute) => hasAttribute(attributes[attribute]) && !hasNonBlankStringAttribute(attributes[attribute])
      )
    )
  );

const attributeValueConstraintIsSatisfied = (
  constraint: AttributeValueConstraint,
  attributes: Record<string, unknown>
): boolean =>
  Match.value(constraint).pipe(
    Match.tags({
      allowedValues: ({ attribute, values }) => attributeHasAllowedValue(attributes[attribute], values),
      containsAllTokens: ({ attribute, values }) => attributeTokensContainAll(attributes[attribute], values),
      containsAnyToken: ({ attribute, values }) => attributeTokensContainAny(attributes[attribute], values),
      equals: ({ asciiCaseInsensitive, attribute, value }) =>
        attributeHasRequiredValue(attributes[attribute], value, asciiCaseInsensitive === true),
    }),
    Match.exhaustive
  );

const attributeRequirementHasConstraintViolation = (
  requirement: HtmlAttributeRequirement,
  attributes: Record<string, unknown>
): boolean =>
  pipe(
    requirement.constraints,
    O.fromUndefinedOr,
    O.exists((constraints) =>
      A.some(constraints, (constraint) => !attributeValueConstraintIsSatisfied(constraint, attributes))
    )
  );

const attributeRequirementHasInvalidUrl = (
  requirement: HtmlAttributeRequirement,
  attributes: Record<string, unknown>
): boolean =>
  pipe(
    requirement.validNonEmptyUrl,
    O.fromUndefinedOr,
    O.exists((attributesToValidate) =>
      A.some(
        attributesToValidate,
        (attribute) => hasAttribute(attributes[attribute]) && !isValidNonEmptyHtmlUrl(attributes[attribute])
      )
    )
  );

const attributeRequirementIssuePath = (
  path: ReadonlyArray<string>,
  missingAttribute: O.Option<string>
): ReadonlyArray<string> =>
  pipe(
    missingAttribute,
    O.match({
      onNone: () => A.append(path, "attributes"),
      onSome: (attribute) => A.append(path, `attributes.${attribute}`),
    })
  );

const inspectAttributeRequirement = (
  requirement: HtmlAttributeRequirement,
  attributes: Record<string, unknown>,
  path: ReadonlyArray<string>,
  ancestors: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> => {
  const missingRequired = missingRequiredAttributeGroups(requirement, attributes);
  const applies = A.every(
    [
      attributeRequirementAppliesToParent(requirement, ancestors),
      attributeRequirementAppliesToAttributes(requirement, attributes),
    ],
    P.isTruthy
  );
  const hasViolation = A.some(
    [
      A.isReadonlyArrayNonEmpty(missingRequired),
      attributeRequirementHasForbiddenAttribute(requirement, attributes),
      attributeRequirementHasBlankAttribute(requirement, attributes),
      attributeRequirementHasConstraintViolation(requirement, attributes),
      attributeRequirementHasInvalidUrl(requirement, attributes),
    ],
    P.isTruthy
  );
  return applies && hasViolation
    ? [
        makeIssue(
          attributeRequirementIssuePath(path, singleMissingRequiredAttribute(missingRequired)),
          "attributeRelationship",
          requirement.message
        ),
      ]
    : A.emptyReadonly();
};

const inspectAttributeRelationships = (
  node: HtmlChildView,
  tag: HtmlTag,
  path: ReadonlyArray<string>,
  ancestors: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> => {
  const attributes = node as unknown as Record<string, unknown>;
  const meta = ELEMENT_META[tag];
  const requiredIssues = A.flatMap(meta.attributeRequirements, (requirement) =>
    inspectAttributeRequirement(requirement, attributes, path, ancestors)
  );
  const equalityIssues = A.flatMap(meta.attributeEqualities, (equality) =>
    pipe(
      O.all([attributeValue(attributes[equality.left]), attributeValue(attributes[equality.right])]),
      O.exists(([left, right]) => left !== right)
    )
      ? [makeIssue(A.append(path, `attributes.${equality.left}`), "attributeRelationship", equality.message)]
      : A.emptyReadonly()
  );
  const numericIssues = A.flatMap(meta.numericAttributeRelationships, (relationship) => {
    const numberValue = (attribute: string, fallback: number | undefined): O.Option<number> =>
      pipe(
        attributeValue(attributes[attribute]),
        O.filter(isFiniteNumber),
        O.orElse(() => O.fromUndefinedOr(fallback))
      );
    const left = numberValue(relationship.left, relationship.leftDefault);
    const right = numberValue(relationship.right, relationship.rightDefault);
    return pipe(
      O.all([left, right]),
      O.exists(([leftValue, rightValue]) => N.isGreaterThan(leftValue, rightValue))
    )
      ? [makeIssue(A.append(path, `attributes.${relationship.left}`), "attributeRelationship", relationship.message)]
      : A.emptyReadonly();
  });
  return [...requiredIssues, ...equalityIssues, ...numericIssues];
};

const inspectDocumentVisibilityLimits = (root: HtmlRootView): ReadonlyArray<HtmlConformanceIssue> => {
  const occurrences = elementOccurrences(root, []);
  return A.flatMap(R.toEntries(ELEMENT_META), ([tag, meta]) =>
    pipe(
      meta.rules.documentVisibilityLimit,
      O.fromUndefinedOr,
      O.match({
        onNone: A.emptyReadonly,
        onSome: ({ maximum, unlessAttribute }): ReadonlyArray<HtmlConformanceIssue> => {
          const visible = A.filter(
            occurrences,
            (occurrence) => occurrence.tag === tag && !hasAttribute(Reflect.get(occurrence.node, unlessAttribute))
          );
          return visible.length > maximum
            ? A.map(visible, (occurrence) =>
                makeIssue(
                  occurrence.path,
                  "documentCardinality",
                  `<${tag}> may appear visibly at most ${maximum} time per document`
                )
              )
            : A.emptyReadonly();
        },
      })
    )
  );
};

type IdOccurrence = {
  readonly path: ReadonlyArray<string>;
  readonly value: string;
};

const idOccurrences = (node: HtmlChildView, path: ReadonlyArray<string>): ReadonlyArray<IdOccurrence> => {
  const id = isHtmlTag(node._tag)
    ? attributeValue(node.id)
    : node._tag === "#foreign"
      ? pipe(
          attributeValue(node.attributes),
          O.filter(P.isObject),
          O.flatMap((attributes) => O.fromUndefinedOr((attributes as Record<string, unknown>).id))
        )
      : O.none();
  const own = pipe(
    id,
    O.filter(isString),
    O.map((value) => ({ path: A.append(path, "attributes.id"), value })),
    O.toArray
  );
  return [...own, ...A.flatMap(childrenOf(node), (child, index) => idOccurrences(child, childPath(path, index)))];
};

const inspectDuplicateIds = (root: HtmlRootView): ReadonlyArray<HtmlConformanceIssue> =>
  pipe(
    idOccurrences(root, []),
    A.groupBy((occurrence) => occurrence.value),
    R.values,
    A.filter((occurrences) => occurrences.length > 1),
    A.flatMap((occurrences) =>
      A.map(occurrences, (occurrence) =>
        makeIssue(occurrence.path, "duplicateId", `The id "${occurrence.value}" must be unique within the HTML root`)
      )
    )
  );

const pathStartsWith = (path: ReadonlyArray<string>, prefix: ReadonlyArray<string>): boolean =>
  prefix.length <= path.length && A.every(prefix, (segment, index) => path[index] === segment);

const nearestTablePath = (
  path: ReadonlyArray<string>,
  tables: ReadonlyArray<ElementOccurrence>
): O.Option<ReadonlyArray<string>> =>
  A.reduce(tables, O.none<ReadonlyArray<string>>(), (nearest, table) =>
    pathStartsWith(path, table.path) && (O.isNone(nearest) || table.path.length > nearest.value.length)
      ? O.some(table.path)
      : nearest
  );

const samePath = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  left.length === right.length && A.every(left, (segment, index) => right[index] === segment);

const inspectIdReferences = (root: HtmlRootView): ReadonlyArray<HtmlConformanceIssue> => {
  const ids = idOccurrences(root, []);
  const elements = elementOccurrences(root, []);
  const tables = A.filter(elements, (occurrence) => occurrence.tag === "table");
  const headingCells = A.flatMap(elements, (occurrence) =>
    occurrence.tag === "th"
      ? pipe(
          stringAttributeValue((occurrence.node as unknown as Record<string, unknown>).id),
          O.map((id) => ({ id, table: nearestTablePath(occurrence.path, tables) })),
          O.toArray
        )
      : A.emptyReadonly()
  );
  return A.flatMap(elements, (occurrence) => {
    const attributes = occurrence.node as unknown as Record<string, unknown>;
    if (occurrence.tag === "button") {
      return pipe(
        stringAttributeValue(attributes.commandfor),
        O.filter((value) => !A.some(ids, (candidate) => candidate.value === value)),
        O.map(() =>
          makeIssue(
            A.append(occurrence.path, "attributes.commandfor"),
            "attributeRelationship",
            "<button commandfor> must reference an element id in the same HTML root"
          )
        ),
        O.toArray
      );
    }
    if (occurrence.tag === "output") {
      return pipe(
        stringAttributeValue(attributes.for),
        O.filter((value) =>
          A.some(tokenizeHtmlSpaceSeparated(value), (token) => !A.some(ids, (candidate) => candidate.value === token))
        ),
        O.map(() =>
          makeIssue(
            A.append(occurrence.path, "attributes.for"),
            "attributeRelationship",
            "<output for> must reference element ids in the same HTML root"
          )
        ),
        O.toArray
      );
    }
    if (occurrence.tag !== "td" && occurrence.tag !== "th") return A.emptyReadonly();
    const table = nearestTablePath(occurrence.path, tables);
    return pipe(
      stringAttributeValue(attributes.headers),
      O.filter((value) =>
        A.some(
          tokenizeHtmlSpaceSeparated(value),
          (token) =>
            !A.some(
              headingCells,
              (candidate) =>
                candidate.id === token &&
                O.isSome(table) &&
                O.isSome(candidate.table) &&
                samePath(table.value, candidate.table.value)
            )
        )
      ),
      O.map(() =>
        makeIssue(
          A.append(occurrence.path, "attributes.headers"),
          "attributeRelationship",
          `<${occurrence.tag} headers> must reference th ids in the same table`
        )
      ),
      O.toArray
    );
  });
};

type UniqueAttributeOccurrence = {
  readonly attribute: string;
  readonly path: ReadonlyArray<string>;
  readonly tag: HtmlTag;
  readonly value: string;
};

const uniqueAttributeOccurrences = (
  node: HtmlChildView,
  path: ReadonlyArray<string>
): ReadonlyArray<UniqueAttributeOccurrence> => {
  const tag = node._tag;
  const own = isHtmlTag(tag)
    ? A.flatMap(ELEMENT_META[tag].uniqueAttributes, (attribute) =>
        pipe(
          attributeValue((node as unknown as Record<string, unknown>)[attribute]),
          O.filter(isString),
          O.map((value) => ({
            attribute,
            path: A.append(path, `attributes.${attribute}`),
            tag,
            value,
          })),
          O.toArray
        )
      )
    : A.emptyReadonly();
  return [
    ...own,
    ...A.flatMap(childrenOf(node), (child, index) => uniqueAttributeOccurrences(child, childPath(path, index))),
  ];
};

const inspectDuplicateUniqueAttributes = (root: HtmlRootView): ReadonlyArray<HtmlConformanceIssue> =>
  pipe(
    uniqueAttributeOccurrences(root, []),
    A.groupBy((occurrence) => `${occurrence.tag}/${occurrence.attribute}`),
    R.values,
    A.flatMap(
      flow(
        A.groupBy((occurrence) => occurrence.value),
        R.values,
        A.filter((occurrences) => occurrences.length > 1),
        A.flatMap((occurrences) =>
          A.map(occurrences, (occurrence) =>
            makeIssue(
              occurrence.path,
              "duplicateAttribute",
              `<${occurrence.tag} ${occurrence.attribute}> value "${occurrence.value}" must be unique within the HTML root`
            )
          )
        )
      )
    )
  );

const countLabelableDescendants = (node: HtmlChildView): number =>
  A.reduce(childrenOf(node), 0, (count, child) => {
    const own = isHtmlTag(child._tag) && A.contains(effectiveCategories(child, child._tag), "labelable") ? 1 : 0;
    return count + own + countLabelableDescendants(child);
  });

const inspectLabelableDescendants = (
  node: HtmlChildView,
  tag: HtmlTag,
  path: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> =>
  tag === "label" && countLabelableDescendants(node) > 1
    ? [makeIssue(path, "forbiddenDescendant", "<label> may contain at most one labelable descendant")]
    : A.emptyReadonly();

const effectiveContentTokens = (tokens: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.flatMap(tokens, (token) => HTML_CONTENT_TOKEN_EXPANSIONS[token] ?? [token]);

const contentTokensFor = (
  tag: HtmlTag,
  ancestors: ReadonlyArray<string>,
  ancestorContentTokens: ReadonlyArray<string>
): ReadonlyArray<string> =>
  Match.value(ELEMENT_META[tag].childGrammar).pipe(
    Match.when("contextual-div", () => {
      if (O.contains(A.last(ancestors), "dl")) return ["dt", "dd", "script-supporting elements"];
      return A.some(ancestors, (ancestor) => ancestor === "option" || ancestor === "optgroup" || ancestor === "select")
        ? ancestorContentTokens
        : ["flow"];
    }),
    Match.orElse(() => {
      const ownTokens = effectiveContentTokens(ELEMENT_META[tag].children);
      return A.contains(ownTokens, "transparent")
        ? A.appendAll(
            A.filter(ownTokens, (token) => token !== "transparent"),
            ancestorContentTokens
          )
        : ownTokens;
    })
  );

const isScriptSupporting = (tag: string): boolean => tag === "script" || tag === "template";
const tableChildSequencePattern = new RegExp(
  pipe(
    ELEMENT_META.table.childSequencePattern,
    O.fromUndefinedOr,
    O.getOrThrowWith(() => makeConformanceError("Generated <table> metadata requires a child-sequence pattern"))
  ),
  "u"
);

const allowsText = (tokens: ReadonlyArray<string>, value: string): boolean =>
  Str.isEmpty(stripHtmlAsciiWhitespace(value)) ||
  A.some(
    tokens,
    (token) =>
      token === "text" || token === "flow" || token === "phrasing" || token === "transparent" || token === "varies"
  );

const allowedElementTokens = (node: HtmlChildView, tag: HtmlTag): ReadonlyArray<string> => {
  const categories = effectiveCategories(node, tag);
  return [
    "transparent",
    "varies",
    tag,
    ...categories,
    ...(tag === "img" ? ["one img"] : []),
    ...(isScriptSupporting(tag) ? ["script-supporting elements"] : []),
    ...(A.contains(categories, "metadata") ? ["metadata content"] : []),
    ...(A.contains(categories, "heading") ? ["heading content"] : []),
  ];
};

const allowsElement = (tokens: ReadonlyArray<string>, node: HtmlChildView, tag: HtmlTag): boolean => {
  const allowedTokens = allowedElementTokens(node, tag);
  return A.some(tokens, (token) => A.contains(allowedTokens, token));
};

const inspectChildModel = (
  parent: HtmlChildView,
  children: ReadonlyArray<HtmlChildView>,
  path: ReadonlyArray<string>,
  tokens: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> =>
  pipe(
    parent._tag,
    O.liftPredicate(isHtmlTag),
    O.match({
      onNone: A.emptyReadonly,
      onSome: (tag): ReadonlyArray<HtmlConformanceIssue> => {
        if (tag === "noscript") {
          return [
            makeIssue(
              path,
              "contentModel",
              "<noscript> requires an explicit document scripting context and cannot receive a generic conformance proof"
            ),
          ];
        }
        return A.flatMap(children, (child, index) =>
          Match.value(child._tag).pipe(
            Match.when("#comment", (): ReadonlyArray<HtmlConformanceIssue> => A.emptyReadonly()),
            Match.when(
              "#text",
              (): ReadonlyArray<HtmlConformanceIssue> =>
                allowsText(tokens, isString(child.value) ? child.value : "")
                  ? A.empty<HtmlConformanceIssue>()
                  : [makeIssue(childPath(path, index), "contentModel", `<${tag}> does not permit text children`)]
            ),
            Match.when(
              "#foreign",
              (): ReadonlyArray<HtmlConformanceIssue> =>
                A.some(tokens, (token) => token === "flow" || token === "phrasing" || token === "embedded")
                  ? A.empty<HtmlConformanceIssue>()
                  : [makeIssue(childPath(path, index), "contentModel", `<${tag}> does not permit foreign content`)]
            ),
            Match.orElse(
              (childTag): ReadonlyArray<HtmlConformanceIssue> =>
                isHtmlTag(childTag) && allowsElement(tokens, child, childTag)
                  ? A.empty<HtmlConformanceIssue>()
                  : [makeIssue(childPath(path, index), "contentModel", `<${tag}> does not permit <${childTag}>`)]
            )
          )
        );
      },
    })
  );

const descriptionGroupSequence = /^(?:dt,)+(?:dd,)+$/u;
const descriptionGroupsSequence = /^(?:(?:dt,)+(?:dd,)+)+$/u;

const inspectElementOrder = (
  parent: HtmlChildView,
  children: ReadonlyArray<HtmlChildView>,
  path: ReadonlyArray<string>,
  ancestors: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> => {
  /* istanbul ignore next -- inspectChild invokes order inspection only after deriving an HtmlTag */
  if (!isHtmlTag(parent._tag)) return A.emptyReadonly();
  const elementChildren = pipe(
    children,
    A.filter((child): child is HtmlChildView & { readonly _tag: HtmlTag } => isHtmlTag(child._tag))
  );
  const elementTags = A.map(elementChildren, (child) => child._tag);
  const sequenceTags = A.filter(elementTags, (tag) => !isScriptSupporting(tag));
  const significantChildren = A.filter(
    children,
    (child) =>
      child._tag !== "#comment" &&
      !(child._tag === "#text" && isString(child.value) && Str.isEmpty(stripHtmlAsciiWhitespace(child.value)))
  );
  const significantText = A.some(
    children,
    (child) => child._tag === "#text" && isString(child.value) && Str.isNonEmpty(stripHtmlAsciiWhitespace(child.value))
  );
  // Content-model order ignores comments and inter-element whitespace; every
  // other direct child is significant.
  const firstSignificantChild = A.head(significantChildren);
  const issue = (message: string): ReadonlyArray<HtmlConformanceIssue> => [makeIssue(path, "elementOrder", message)];
  const oneAtEdge = (tag: HtmlTag, edge: "first" | "either"): boolean => {
    const first = A.findFirstIndex(significantChildren, (candidate) => candidate._tag === tag);
    const last = A.findLastIndex(significantChildren, (candidate) => candidate._tag === tag);
    return (
      (O.isNone(first) && O.isNone(last)) ||
      (O.isSome(first) &&
        O.contains(last, first.value) &&
        (first.value === 0 || (edge === "either" && first.value === significantChildren.length - 1)))
    );
  };
  const isDescriptionGroup = (tags: ReadonlyArray<HtmlTag>): boolean =>
    descriptionGroupSequence.test(`${A.join(tags, ",")},`);
  const isDescriptionGroups = (tags: ReadonlyArray<HtmlTag>): boolean =>
    descriptionGroupsSequence.test(`${A.join(tags, ",")},`);

  return Match.value(ELEMENT_META[parent._tag].childGrammar).pipe(
    Match.when("document-element", () =>
      elementTags.length === 2 && elementTags[0] === "head" && elementTags[1] === "body"
        ? A.emptyReadonly()
        : issue("<html> must contain one <head> followed by one <body>")
    ),
    Match.when("head", () => {
      const titles = A.filter(elementTags, (tag) => tag === "title").length;
      const bases = A.filter(elementTags, (tag) => tag === "base").length;
      return titles === 1 && bases <= 1
        ? A.emptyReadonly()
        : issue("<head> must contain exactly one <title> and no more than one <base>");
    }),
    Match.when("description-list", () => {
      const direct = isDescriptionGroups(sequenceTags);
      const wrapped =
        sequenceTags.length > 0 &&
        A.every(elementChildren, (child) => {
          if (child._tag !== "div") return isScriptSupporting(child._tag);
          const nestedChildren = childrenOf(child);
          const nestedTags = pipe(
            nestedChildren,
            A.filter((nested) => isHtmlTag(nested._tag) && !isScriptSupporting(nested._tag)),
            A.map((nested) => nested._tag as HtmlTag)
          );
          const invalidNested = A.some(
            nestedChildren,
            (nested) =>
              nested._tag === "#foreign" ||
              (nested._tag === "#text" &&
                isString(nested.value) &&
                Str.isNonEmpty(stripHtmlAsciiWhitespace(nested.value))) ||
              (isHtmlTag(nested._tag) &&
                !isScriptSupporting(nested._tag) &&
                nested._tag !== "dt" &&
                nested._tag !== "dd")
          );
          return !invalidNested && isDescriptionGroup(nestedTags);
        });
      return (sequenceTags.length === 0 || direct || wrapped) && !significantText
        ? A.emptyReadonly()
        : issue("<dl> children must be complete dt+ / dd+ groups, directly or in <div> wrappers");
    }),
    Match.when("contextual-div", () =>
      O.contains(A.last(ancestors), "dl") && (!isDescriptionGroup(sequenceTags) || significantText)
        ? issue("A <div> child of <dl> must contain one complete dt+ / dd+ group")
        : A.emptyReadonly()
    ),
    Match.when("details", () =>
      A.filter(elementTags, (tag) => tag === "summary").length === 1 &&
      O.exists(firstSignificantChild, (child) => child._tag === "summary")
        ? A.emptyReadonly()
        : issue("<details> must contain exactly one <summary> as its first significant child")
    ),
    Match.when("fieldset", () =>
      oneAtEdge("legend", "first")
        ? A.emptyReadonly()
        : issue("<legend> must be the first significant child of <fieldset> and occur at most once")
    ),
    Match.when("figure", () =>
      oneAtEdge("figcaption", "either")
        ? A.emptyReadonly()
        : issue("<figcaption> must be the first or last significant child of <figure> and occur at most once")
    ),
    Match.when("colgroup", () =>
      hasAttribute((parent as unknown as Record<string, unknown>).span) &&
      A.some(elementTags, (tag) => tag === "col" || tag === "template")
        ? issue("<colgroup span> cannot contain <col> or <template> children")
        : A.emptyReadonly()
    ),
    Match.when("media", () => {
      let phase: "source" | "track" | "content" = "source";
      const hasSrc = hasAttribute(parent.src);
      const orderedChildren = A.filter(
        children,
        (child) =>
          child._tag !== "#comment" &&
          !(isHtmlTag(child._tag) && isScriptSupporting(child._tag)) &&
          !(child._tag === "#text" && isString(child.value) && Str.isEmpty(stripHtmlAsciiWhitespace(child.value)))
      );
      const valid = A.every(orderedChildren, (child) => {
        if (child._tag === "source") {
          if (hasSrc || phase !== "source") return false;
          return true;
        }
        if (child._tag === "track") {
          if (phase === "content") return false;
          phase = "track";
          return true;
        }
        phase = "content";
        return true;
      });
      return valid
        ? A.emptyReadonly()
        : issue(
            "Media children must order source* before track* before fallback content, with no source when src is set"
          );
    }),
    Match.when("picture", () =>
      /^(?:source,)*img,$/u.test(`${A.join(sequenceTags, ",")}${sequenceTags.length === 0 ? "" : ","}`)
        ? A.emptyReadonly()
        : issue("<picture> must contain source* followed by exactly one <img>")
    ),
    Match.when("hgroup", () =>
      A.filter(sequenceTags, (tag) => A.contains(ELEMENT_META[tag].categories, "heading")).length === 1
        ? A.emptyReadonly()
        : issue("<hgroup> must contain exactly one heading element")
    ),
    Match.when("datalist", () => {
      const optionMode = A.contains(sequenceTags, "option");
      const mixed =
        optionMode &&
        A.some(
          children,
          (child) =>
            child._tag === "#foreign" ||
            (child._tag === "#text" &&
              isString(child.value) &&
              Str.isNonEmpty(stripHtmlAsciiWhitespace(child.value))) ||
            (isHtmlTag(child._tag) && child._tag !== "option" && !isScriptSupporting(child._tag))
        );
      return mixed
        ? issue("<datalist> must use either phrasing content or option children, not both")
        : A.emptyReadonly();
    }),
    Match.when("phrasing-or-heading", () => {
      const headings = A.filter(sequenceTags, (tag) => A.contains(ELEMENT_META[tag].categories, "heading"));
      return headings.length === 0 || (headings.length === 1 && significantChildren.length === 1)
        ? A.emptyReadonly()
        : issue("Heading-content and phrasing-content alternatives cannot be mixed");
    }),
    Match.when("optgroup", () =>
      oneAtEdge("legend", "first")
        ? A.emptyReadonly()
        : issue("<optgroup> may contain at most one <legend>, as its first significant child")
    ),
    Match.when("select", () => {
      const traditional = A.every(sequenceTags, (tag) => tag === "option" || tag === "optgroup" || tag === "hr");
      const customizable =
        sequenceTags[0] === "button" &&
        A.every(
          A.drop(sequenceTags, 1),
          (tag) => tag === "option" || tag === "optgroup" || tag === "hr" || tag === "div"
        );
      return traditional || customizable
        ? A.emptyReadonly()
        : issue("<select> must use either the traditional or customizable-select child grammar");
    }),
    Match.when("ruby", () => {
      const symbols = pipe(
        children,
        A.filter(
          (child) =>
            child._tag !== "#comment" &&
            !(isHtmlTag(child._tag) && isScriptSupporting(child._tag)) &&
            !(child._tag === "#text" && isString(child.value) && Str.isEmpty(stripHtmlAsciiWhitespace(child.value)))
        ),
        A.map((child) =>
          child._tag === "rt" ? "t" : child._tag === "rp" ? "r" : child._tag === "#foreign" ? "x" : "b"
        ),
        A.join("")
      );
      return /^(?:b+(?:r?tr?)+)+$/u.test(symbols)
        ? A.emptyReadonly()
        : issue("<ruby> must contain base phrasing followed by complete rt/rp annotation groups");
    }),
    Match.when("table", () =>
      tableChildSequencePattern.test(`${A.join(sequenceTags, ",")}${sequenceTags.length === 0 ? "" : ","}`)
        ? A.emptyReadonly()
        : issue("<table> children must follow caption?, colgroup*, thead?, (tbody* | tr+), tfoot?")
    ),
    Match.orElse((): ReadonlyArray<HtmlConformanceIssue> => A.emptyReadonly())
  );
};

const inspectForeignChildBoundary = (
  parent: HtmlChildView,
  child: HtmlChildView,
  path: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> => {
  const parentNamespace = parent.namespace;
  const parentName = parent.name;
  const parentAttributes = pipe(
    attributeValue(parent.attributes),
    O.filter(P.isObject),
    O.map(Struct.entries),
    O.getOrElse(A.empty)
  );
  const issue = (message: string): ReadonlyArray<HtmlConformanceIssue> => [
    makeIssue(path, "foreignIntegration", message),
  ];
  return Match.value(child._tag).pipe(
    Match.when("#text", (): ReadonlyArray<HtmlConformanceIssue> => A.emptyReadonly()),
    Match.when("#comment", (): ReadonlyArray<HtmlConformanceIssue> => A.emptyReadonly()),
    Match.when("#foreign", (): ReadonlyArray<HtmlConformanceIssue> => {
      const childNamespace = child.namespace;
      const childName = child.name;
      const childAttributes = pipe(
        attributeValue(child.attributes),
        O.filter(P.isObject),
        O.map(Struct.entries),
        O.getOrElse(A.empty)
      );
      return (parentNamespace === "svg" || parentNamespace === "mathml") &&
        isString(parentName) &&
        (childNamespace === "svg" || childNamespace === "mathml") &&
        isString(childName) &&
        isForeignChildAtForeignBoundary(
          { attributes: parentAttributes, name: parentName, namespace: parentNamespace },
          { attributes: childAttributes, name: childName, namespace: childNamespace }
        )
        ? A.emptyReadonly()
        : issue("The foreign child would change namespace or escape its opaque parent during HTML parsing");
    }),
    Match.orElse(
      (tag): ReadonlyArray<HtmlConformanceIssue> =>
        isHtmlTag(tag) &&
        (parentNamespace === "svg" || parentNamespace === "mathml") &&
        isString(parentName) &&
        isHtmlChildAtForeignBoundary({ attributes: parentAttributes, name: parentName, namespace: parentNamespace })
          ? A.emptyReadonly()
          : issue("HTML elements can occur inside opaque foreign content only at a modeled integration point")
    )
  );
};

const inspectForeignEntryPoint = (
  node: HtmlChildView,
  path: ReadonlyArray<string>,
  ancestors: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> => {
  const parent = A.last(ancestors);
  const entersFromHtml = O.isNone(parent) || (O.isSome(parent) && isHtmlTag(parent.value));
  const usesIntegrationElement =
    (node.namespace === "svg" && node.name === "svg") || (node.namespace === "mathml" && node.name === "math");
  return entersFromHtml && !usesIntegrationElement
    ? [
        makeIssue(
          path,
          "foreignIntegration",
          "Foreign content must enter HTML through an <svg> or <math> integration element"
        ),
      ]
    : A.emptyReadonly();
};

const inspectForeignFixedPoints = (
  node: HtmlChildView,
  path: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> => {
  const namespace = node.namespace;
  const name = node.name;
  if ((namespace !== "svg" && namespace !== "mathml") || !isString(name)) return A.emptyReadonly();

  const nameIssues = isForeignElementNameFixedPoint(namespace, name)
    ? A.emptyReadonly()
    : [
        makeIssue(
          A.append(path, "name"),
          "foreignIntegration",
          `Foreign element name ${name} is not a browser parse fixed point`
        ),
      ];
  const attributeIssues = pipe(
    attributeValue(node.attributes),
    O.filter(P.isObject),
    O.match({
      onNone: A.emptyReadonly,
      onSome: (attributes) =>
        A.flatMap(Struct.keys(attributes), (attributeName) =>
          isForeignAttributeNameFixedPoint(namespace, attributeName)
            ? A.emptyReadonly()
            : [
                makeIssue(
                  A.append(path, `attributes.${attributeName}`),
                  "foreignIntegration",
                  `Foreign attribute name ${attributeName} is not a browser parse fixed point`
                ),
              ]
        ),
    })
  );
  return A.appendAll(nameIssues, attributeIssues);
};

const inspectForbiddenForeignDescendantAttributes = (
  node: HtmlChildView,
  path: ReadonlyArray<string>,
  ancestors: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> => {
  const attributeNames = pipe(
    attributeValue(node.attributes),
    O.filter(P.isObject),
    O.map(Struct.keys),
    O.getOrElse(A.empty)
  );
  return A.flatMap(forbiddenDescendantConstraints, (constraint) =>
    A.contains(ancestors, constraint.ancestor)
      ? A.flatMap(constraint.attributes, (attribute) =>
          A.some(attributeNames, (name) => name === attribute)
            ? [
                makeIssue(
                  A.append(path, `attributes.${attribute}`),
                  "forbiddenDescendant",
                  `Foreign attribute ${attribute} is forbidden beneath <${constraint.ancestor}>`
                ),
              ]
            : A.emptyReadonly()
        )
      : A.emptyReadonly()
  );
};

const inspectForeignChild = (
  node: HtmlChildView,
  path: ReadonlyArray<string>,
  ancestors: ReadonlyArray<string>,
  ancestorContentTokens: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> => {
  const local = [
    ...inspectForeignEntryPoint(node, path, ancestors),
    ...inspectForeignFixedPoints(node, path),
    ...inspectForbiddenForeignDescendantAttributes(node, path, ancestors),
  ];
  return A.appendAll(
    local,
    A.flatMap(childrenOf(node), (child, index) => {
      const pathToChild = childPath(path, index);
      return A.appendAll(
        inspectForeignChildBoundary(node, child, pathToChild),
        inspectChild(child, pathToChild, A.append(ancestors, "#foreign"), ancestorContentTokens)
      );
    })
  );
};

const inspectChild = (
  node: HtmlChildView,
  path: ReadonlyArray<string>,
  ancestors: ReadonlyArray<string>,
  ancestorContentTokens: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> =>
  Match.value(node._tag).pipe(
    Match.when("#text", (): ReadonlyArray<HtmlConformanceIssue> => A.emptyReadonly()),
    Match.when("#comment", (): ReadonlyArray<HtmlConformanceIssue> => A.emptyReadonly()),
    Match.when("#foreign", () => inspectForeignChild(node, path, ancestors, ancestorContentTokens)),
    Match.orElse((tag): ReadonlyArray<HtmlConformanceIssue> => {
      if (!isHtmlTag(tag)) return A.emptyReadonly();
      const meta = ELEMENT_META[tag];
      const children = childrenOf(node);
      const own =
        meta.conformance === "non-conforming"
          ? [makeIssue(path, "obsoleteElement", `<${tag}> is obsolete and non-conforming`)]
          : A.empty<HtmlConformanceIssue>();
      const ownTokens = effectiveContentTokens(meta.children);
      const contentTokens = contentTokensFor(tag, ancestors, ancestorContentTokens);
      const childContentTokens =
        meta.childGrammar === "contextual-div"
          ? contentTokens
          : A.contains(ownTokens, "transparent")
            ? ancestorContentTokens
            : ownTokens;
      const local = [
        ...own,
        ...inspectForbiddenDescendants(node, tag, path, ancestors),
        ...inspectLabelableDescendants(node, tag, path),
        ...inspectElementAttributes(node, tag, path),
        ...inspectSpecialAttributeSyntaxes(node, tag, path),
        ...inspectInputAttributeApplicability(node, tag, path),
        ...inspectAutocompleteCompatibility(node, tag, path),
        ...inspectButtonSubmitAttributes(node, tag, path, ancestors),
        ...inspectAreaCoordinates(node, tag, path),
        ...inspectMediaTypeAndColor(node, tag, path),
        ...inspectAttributeRelationships(node, tag, path, ancestors),
        ...inspectResponsiveImageRelationships(node, tag, path),
        ...inspectChildModel(node, children, path, contentTokens),
        ...inspectElementOrder(node, children, path, ancestors),
      ];
      return A.appendAll(
        local,
        A.flatMap(children, (child, index) =>
          inspectChild(child, childPath(path, index), A.append(ancestors, tag), childContentTokens)
        )
      );
    })
  );

/**
 * Returns every conformance issue in an HTML root.
 *
 * @example
 * ```ts
 * import { inspectConformance } from "@beep/html/Html.conformance"
 * import { Fragment } from "@beep/html/Html.model"
 *
 * console.log(inspectConformance(Fragment.make({ children: [] }))) // []
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const inspectConformance = (root: HtmlRoot.Type): ReadonlyArray<HtmlConformanceIssue> => {
  const view: HtmlRootView = root;
  const structuralIssues = Match.value(view._tag).pipe(
    Match.when("#document", (): ReadonlyArray<HtmlConformanceIssue> => {
      const doctype = pipe(view.doctype, O.fromUndefinedOr, O.getOrElse(O.none));
      const children = childrenOf(view);
      const doctypeIssues = O.match(doctype, {
        onNone: () => [makeIssue(["doctype"], "documentDoctype", "A conformant document requires <!doctype html>")],
        onSome: (value) =>
          O.contains(value.name, "html") && O.isNone(value.publicId) && O.isNone(value.systemId)
            ? A.empty()
            : [makeIssue(["doctype"], "documentDoctype", "A conformant document requires the canonical HTML doctype")],
      });
      const htmlRoots = A.filter(children, (child) => child._tag === "html");
      const rootIssues =
        htmlRoots.length === 1 && A.every(children, (child) => child._tag === "html" || child._tag === "#comment")
          ? A.empty<HtmlConformanceIssue>()
          : [makeIssue(["children"], "documentRoot", "A document must contain exactly one <html> root")];
      return [
        ...doctypeIssues,
        ...rootIssues,
        ...A.flatMap(children, (child, index) => inspectChild(child, childPath([], index), [], ["html"])),
        ...inspectDocumentVisibilityLimits(view),
      ];
    }),
    Match.when("#fragment", (): ReadonlyArray<HtmlConformanceIssue> => {
      const children = childrenOf(view);
      return A.flatMap(children, (child, index) => inspectChild(child, childPath([], index), [], ["flow"]));
    }),
    Match.orElse((): ReadonlyArray<HtmlConformanceIssue> => inspectChild(view, [], [], ["flow"]))
  );
  return [
    ...structuralIssues,
    ...inspectDuplicateIds(view),
    ...inspectIdReferences(view),
    ...inspectDuplicateUniqueAttributes(view),
  ];
};

/**
 * Validates an HTML root and issues an opaque conformance proof.
 *
 * @example
 * ```ts
 * import { conform, conformantRoot } from "@beep/html/Html.conformance"
 * import { Fragment } from "@beep/html/Html.model"
 * import { Effect } from "effect"
 *
 * const program = conform(Fragment.make({ children: [] })).pipe(
 *   Effect.map((value) => conformantRoot(value)._tag)
 * )
 * ```
 *
 * @effects Detaches and freezes the supplied tree, then fails with
 * {@link HtmlConformanceError} when its structure violates the generated HTML
 * content model.
 * @category validation
 * @since 0.0.0
 */
export const conform = Effect.fn("Html.conform")(function* (root: HtmlRoot.Type) {
  const suppliedIssues = inspectConformance(root);
  yield* A.match(suppliedIssues, {
    onEmpty: () => Effect.void,
    onNonEmpty: (issues) => Effect.fail(HtmlConformanceError.make({ issues })),
  });
  const snapshot = yield* snapshotRoot(root);
  return yield* A.match(inspectConformance(snapshot), {
    onEmpty: () => Effect.succeed(issueConformantHtml(snapshot)),
    onNonEmpty: (issues) => Effect.fail(HtmlConformanceError.make({ issues })),
  });
});

/**
 * Extracts the validated AST root from a conformance proof.
 *
 * @example
 * ```ts
 * import { conform, conformantRoot } from "@beep/html/Html.conformance"
 * import { Fragment } from "@beep/html/Html.model"
 * import { Effect } from "effect"
 *
 * const program = conform(Fragment.make({ children: [] })).pipe(
 *   Effect.map(conformantRoot)
 * )
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const conformantRoot = (value: ConformantHtml): HtmlRoot.Type =>
  pipe(
    conformantRoots.get(value),
    O.fromUndefinedOr,
    O.getOrThrowWith(() => makeConformanceError("Invalid ConformantHtml issuer proof"))
  );
