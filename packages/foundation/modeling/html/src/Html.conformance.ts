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
import { SchemaUtils } from "@beep/schema";
import * as Conformance from "@beep/schema/Conformance";
import { A, Eq, Struct } from "@beep/utils";
import { color as parseCssColor } from "@csstools/css-color-parser";
import { isWhiteSpaceOrCommentNode, parseListOfComponentValues } from "@csstools/css-parser-algorithms";
import { tokenize as tokenizeCss } from "@csstools/css-tokenizer";
import { isMediaQueryInvalid, parse as parseMediaQueryList } from "@csstools/media-query-list-parser";
import { Effect, flow, Match, Number as N, pipe, Result } from "effect";
import { dual } from "effect/Function";
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
  ButtonState,
  inputStateAllowedAttributes,
  resolveButtonState,
  resolveInputState,
} from "./Html.form-control.ts";
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
  HtmlTag,
} from "./Html.meta.ts";
import { Button, HtmlRoot, Input } from "./Html.model.ts";
import { HtmlMimeType } from "./Html.script.ts";
import { inspectSourceSizeList } from "./Html.source-size.ts";
import { inspectSrcset } from "./Html.srcset.ts";
import {
  htmlAttributeValue as attributeValue,
  htmlChildPath as childPath,
  htmlChildrenOf as childrenOf,
  HtmlChildView,
  HtmlConformanceIssue,
  hasHtmlAttribute as hasAttribute,
  makeHtmlConformanceIssue as makeIssue,
} from "./internal/conformance/Html.conformance-contracts.ts";
import { HtmlWhatwgConformanceAnnotation } from "./internal/conformance/Html.conformance-registry.ts";
import { inspectHeadingOutline } from "./internal/conformance/Html.heading-conformance.ts";
import { inspectScriptConformance } from "./internal/conformance/Html.script-conformance.ts";
import { isValidBcp47LanguageTag } from "./internal/Html.language-tag.ts";
import type { HtmlAttributeRequirement } from "./Html.meta.ts";
import type { HtmlRootView } from "./internal/conformance/Html.conformance-contracts.ts";

const $I = $HtmlId.create("Html.conformance");

/**
 * Conformance contracts re-exported from the internal registry.
 *
 * @category validation
 * @since 0.0.0
 */
export {
  HtmlConformanceIssue,
  HtmlConformanceRule,
} from "./internal/conformance/Html.conformance-contracts.ts";
/**
 * Heading-level conformance rules re-exported from the internal registry.
 *
 * @category validation
 * @since 0.0.0
 */
export {
  computeHeadingOutline,
  HtmlBestPracticeIssue,
  HtmlBestPracticeRule,
  HtmlComputedHeadingLevel,
  HtmlHeadingOutlineEntry,
  inspectBestPractices,
} from "./internal/conformance/Html.heading-conformance.ts";

/**
 * Failure returned when an AST cannot be proven conformant.
 *
 * **Example** (Construct `HtmlConformanceError`)
 *
 * ```ts import.meta.vitest name="Construct HtmlConformanceError"
 * import { HtmlConformanceError } from "@beep/html/Html.conformance"
 *
 * const handle = (error: HtmlConformanceError) => error.issues.length
 * typeof handle // => "function"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HtmlConformanceError extends S.TaggedError<HtmlConformanceError>($I`HtmlConformanceError`)(
  "HtmlConformanceError",
  {
    issues: S.NonEmptyArray(HtmlConformanceIssue),
  },
  $I.annoteError<HtmlConformanceError>("HtmlConformanceError", {
    description: "The HTML AST failed one or more conformance rules.",
  })
) {}

const conformantRoots = new WeakMap<object, HtmlRoot.Type>();

declare const conformantHtmlProof: unique symbol;

class ConformantHtmlValue {
  private declare readonly [conformantHtmlProof]: true;

  static readonly is = (value: unknown): value is ConformantHtmlValue =>
    P.isObject(value) && conformantRoots.has(value);

  constructor() {
    Reflect.setPrototypeOf(this, null);
  }
}

const issueConformantHtml = (root: HtmlRoot.Type): ConformantHtmlValue => {
  const value = new ConformantHtmlValue();
  conformantRoots.set(value, root);
  Object.freeze(value);
  return value;
};

/**
 * Runtime-issued proof that an HTML root passed {@link inspectConformance}.
 *
 * **Example** (Check a conformance proof)
 *
 * ```ts import.meta.vitest name="Check a conformance proof"
 * import { conform, ConformantHtml, conformantRoot } from "@beep/html/Html.conformance"
 * import { Fragment } from "@beep/html/Html.model"
 * import { Effect } from "effect"
 *
 * const proof = Effect.runSync(conform(Fragment.make({ children: [] })))
 * ConformantHtml.is(proof) // => true
 * conformantRoot(proof)._tag // => "#fragment"
 * ```
 *
 * @invariant Values are opaque proofs issued only after the modeled WHATWG author-conformance checks succeed.
 * @see {@link https://html.spec.whatwg.org/multipage/introduction.html#conformance-requirements-for-authors | WHATWG HTML conformance requirements for authors} for the normative authoring requirements.
 * @category schemas
 * @since 0.0.0
 */
export const ConformantHtml = S.declare(ConformantHtmlValue.is).pipe(
  Conformance.annotateConformance(HtmlWhatwgConformanceAnnotation),
  SchemaUtils.withStatics(() => ({ is: ConformantHtmlValue.is })),
  $I.annoteSchema("ConformantHtml", {
    description: "Runtime-issued proof of HTML AST conformance.",
  })
);

/**
 * Decoded type of {@link ConformantHtml}.
 *
 * **Example** (Annotate a `ConformantHtml` value)
 *
 * ```ts import.meta.vitest name="Annotate a ConformantHtml value"
 * import { conformantRoot } from "@beep/html/Html.conformance"
 * import type { ConformantHtml } from "@beep/html/Html.conformance"
 *
 * const rootTag = (value: ConformantHtml) => conformantRoot(value)._tag
 * typeof rootTag // => "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ConformantHtml = typeof ConformantHtml.Type;

/**
 * Canonical schema alias for a conformance-proven HTML node or root.
 *
 * **Example** (Check a conformance-proven node)
 *
 * ```ts import.meta.vitest name="Check a conformance-proven node"
 * import { conform, ConformantHtmlNode, Fragment } from "@beep/html"
 * import { Effect } from "effect"
 *
 * const proof = Effect.runSync(conform(Fragment.make({ children: [] })))
 * ConformantHtmlNode.is(proof) // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ConformantHtmlNode = ConformantHtml;

/**
 * Decoded type of {@link ConformantHtmlNode}.
 *
 * **Example** (Annotate a `ConformantHtmlNode` value)
 *
 * ```ts import.meta.vitest name="Annotate a ConformantHtmlNode value"
 * import { conformantRoot } from "@beep/html/Html.conformance"
 * import type { ConformantHtmlNode } from "@beep/html/Html.conformance"
 *
 * const rootTag = (value: ConformantHtmlNode) => conformantRoot(value)._tag
 * typeof rootTag // => "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ConformantHtmlNode = ConformantHtml;

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
      Result.match(S.decodeResult(HtmlRoot)(encoded), {
        onFailure: () => Effect.fail(snapshotFailure()),
        onSuccess: flow(freezeTree, Effect.succeed),
      }),
  });

const isHtmlTag = S.is(HtmlTag);
const isButton = S.is(Button);
const isInput = S.is(Input);
const isHtmlChildView = S.is(HtmlChildView);
const isFiniteNumber = S.is(S.Finite);
const isString = S.is(S.String);
const readProperty = (value: unknown, key: PropertyKey): unknown => Reflect.get(Object(value), key);
const HTML_URL_VALIDATION_BASE = pipe(parseURL("https://html.invalid/"), O.fromNullOr);
const ICON_SIZE_TOKEN_PATTERN = /^[1-9][0-9]*[xX][1-9][0-9]*$/u;
const INTEGER_LIST_PATTERN = /^[\t\n\f\r ]*[+-]?[0-9]+(?:[\t\n\f\r ]*,[\t\n\f\r ]*[+-]?[0-9]+)*[\t\n\f\r ]*$/u;

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

const hasNonBlankStringAttribute: (value: unknown) => boolean = flow(
  attributeValue,
  O.filter(isString),
  O.exists(flow(stripHtmlAsciiWhitespace, Str.isNonEmpty))
);

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

const isValidNonEmptyHtmlUrl: (value: unknown) => boolean = flow(
  attributeValue,
  O.filter(isString),
  O.exists(isValidHtmlUrlString)
);

const stringAttributeValue: (value: unknown) => O.Option<string> = flow(attributeValue, O.filter(isString));

const srcsetProfile = flow(stringAttributeValue, O.flatMap(inspectSrcset(isValidHtmlUrlString)));

const sourceSizeAnalysis = (value: unknown) =>
  pipe(
    stringAttributeValue(value),
    O.flatMap(
      flow(
        inspectSourceSizeList,
        Result.match({
          onFailure: O.none,
          onSuccess: O.some,
        })
      )
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

const isValidMimeType = S.is(HtmlMimeType);

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
  return !hasParseError && nodes.length === 1 && P.isNotUndefined(node) && parseCssColor(node) !== false;
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

const parseIntegerList: (value: string) => O.Option<ReadonlyArray<ExactInteger>> = flow(
  O.liftPredicate((value: string) => INTEGER_LIST_PATTERN.test(value)),
  O.map(flow(Str.split(","), A.map(normalizeExactInteger)))
);

const compareIntegerMagnitude = (left: ExactInteger, right: ExactInteger): number =>
  left.magnitude.length === right.magnitude.length
    ? Str.Order(left.magnitude, right.magnitude)
    : N.Order(left.magnitude.length, right.magnitude.length);

const exactIntegerIsLessThan = (left: ExactInteger, right: ExactInteger): boolean => {
  if (left.negative !== right.negative) return left.negative;
  const comparison = compareIntegerMagnitude(left, right);
  return left.negative ? N.isGreaterThan(comparison, 0) : N.isLessThan(comparison, 0);
};

type ElementOccurrence = {
  readonly node: HtmlChildView;
  readonly path: ReadonlyArray<string>;
  readonly tablePath: O.Option<ReadonlyArray<string>>;
  readonly tag: HtmlTag;
};

const elementOccurrences = (
  node: HtmlChildView,
  path: ReadonlyArray<string>,
  enclosingTable: O.Option<ReadonlyArray<string>> = O.none()
): ReadonlyArray<ElementOccurrence> => {
  const tablePath = node._tag === "table" ? O.some(path) : enclosingTable;
  const own = isHtmlTag(node._tag)
    ? [
        {
          node,
          path,
          tablePath,
          tag: node._tag,
        },
      ]
    : A.emptyReadonly<ElementOccurrence>();
  return [
    ...own,
    ...A.flatMap(childrenOf(node), (child, index) => elementOccurrences(child, childPath(path, index), tablePath)),
  ];
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
        const value = readProperty(node, rule.attribute);
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
          A.findFirst((attribute) => hasAttribute(readProperty(node, attribute))),
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
    A.some(constraint.attributes, (attribute) => hasNonBlankStringAttribute(readProperty(node, attribute)))
      ? pipe(
          elementOccurrences(node, path),
          A.filter(
            P.Struct({
              tag: Eq.equals(constraint.descendant),
            })
          ),
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
    Struct.entries(node),
    A.filter(
      ([name, value]) =>
        name !== "_tag" &&
        name !== "children" &&
        (name !== "content" || meta.textMode === "normal") &&
        hasAttribute(value)
    ),
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
): ReadonlyArray<HtmlConformanceIssue> =>
  A.flatMap(Struct.entries(node), ([attribute, value]) =>
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

const inputTypeState = (node: HtmlChildView): string =>
  isInput(node)
    ? resolveInputState(node).state
    : /* istanbul ignore next -- called only after the input tag has passed the root schema */ "text";

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
  if (tag !== "input" || !isInput(node)) return A.emptyReadonly();
  const state = resolveInputState(node);
  const allowed = inputStateAllowedAttributes(state);
  return A.flatMap(HTML_CONDITIONAL_INPUT_ATTRIBUTE_NAMES, (attribute) =>
    hasAttribute(readProperty(node, attribute)) && !A.contains(allowed, attribute)
      ? [
          makeIssue(
            A.append(path, `attributes.${attribute}`),
            "attributeRelationship",
            `<input type="${state.state}"> does not permit ${attribute}`
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
): number =>
  pipe(
    A.get(tokens, index),
    O.filter(matches),
    O.match({
      onNone: () => index,
      onSome: () => index + 1,
    })
  );

const autocompleteFieldStart = (tokens: ReadonlyArray<string>): number => {
  const afterSection = advanceAutocompleteIndex(tokens, 0, Str.startsWith("section-"));
  return advanceAutocompleteIndex(tokens, afterSection, (token) => A.contains(["shipping", "billing"], token));
};

const autocompleteContactHint = (tokens: ReadonlyArray<string>, index: number): O.Option<string> =>
  pipe(
    A.get(tokens, index),
    O.filter((token) => A.contains(["home", "work", "mobile", "fax", "pager"], token))
  );

const autocompleteDetail: (value: string) => O.Option<AutocompleteDetail> = flow(
  tokenizeHtmlSpaceSeparated,
  O.liftPredicate(P.not(isAutocompleteToggle)),
  O.flatMap((tokens) => {
    const detailStart = autocompleteFieldStart(tokens);
    const contactHint = autocompleteContactHint(tokens, detailStart);
    const fieldIndex = detailStart + (O.isSome(contactHint) ? 1 : 0);
    return pipe(
      A.get(tokens, fieldIndex),
      O.map((field) => ({
        contactHint,
        field,
        webauthn: tokens[fieldIndex + 1] === "webauthn",
      }))
    );
  })
);

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

const autocompleteDetailIssues: {
  (
    tag: HtmlTag,
    state: string,
    path: ReadonlyArray<string>
  ): (detail: AutocompleteDetail) => ReadonlyArray<HtmlConformanceIssue>;
  (
    detail: AutocompleteDetail,
    tag: HtmlTag,
    state: string,
    path: ReadonlyArray<string>
  ): ReadonlyArray<HtmlConformanceIssue>;
} = dual(
  4,
  (
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
        ]
);

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
      onSome: autocompleteDetailIssues(tag, state, path),
    })
  );
};

const inspectAutocompleteCompatibility = (
  node: HtmlChildView,
  tag: HtmlTag,
  path: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> => {
  if (tag !== "input" && tag !== "textarea" && tag !== "select") return A.emptyReadonly();
  const value = stringAttributeValue(readProperty(node, "autocomplete"));
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
  if (tag !== "button" || !isButton(node)) return A.emptyReadonly();
  const state = resolveButtonState(node, pipe(A.last(ancestors), O.filter(isHtmlTag)));
  return ButtonState.match(state, {
    submit: (): ReadonlyArray<HtmlConformanceIssue> => A.emptyReadonly(),
    nonSubmit: (): ReadonlyArray<HtmlConformanceIssue> =>
      A.flatMap(HTML_BUTTON_SUBMIT_ONLY_ATTRIBUTES, (attribute) =>
        hasAttribute(readProperty(node, attribute))
          ? [
              makeIssue(
                A.append(path, `attributes.${attribute}`),
                "attributeRelationship",
                `<button ${attribute}> is permitted only on an effective submit button`
              ),
            ]
          : A.emptyReadonly()
      ),
  });
};

const inspectAreaCoordinates = (
  node: HtmlChildView,
  tag: HtmlTag,
  path: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> => {
  if (tag !== "area") return A.emptyReadonly();
  const shape = pipe(
    stringAttributeValue(readProperty(node, "shape")),
    O.getOrElse(() => "rect")
  );
  const coordsValue = readProperty(node, "coords");
  const coords = pipe(stringAttributeValue(coordsValue), O.flatMap(parseIntegerList));
  const valid = Match.value(shape).pipe(
    Match.when("default", () => !hasAttribute(coordsValue)),
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
  const mediaIssues = pipe(
    stringAttributeValue(readProperty(node, "media")),
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
    stringAttributeValue(node.type),
    O.filter((value) => !isValidMimeType(value)),
    O.map(() =>
      makeIssue(A.append(path, "attributes.type"), "attributeRelationship", `<${tag} type> must be a valid MIME type`)
    ),
    O.toArray
  );
  const validColor = pipe(
    stringAttributeValue(readProperty(node, "color")),
    O.exists((value) => attributeTokensContainAny(readProperty(node, "rel"), ["mask-icon"]) && isValidCssColor(value))
  );
  const colorIssues =
    tag === "link" && hasAttribute(readProperty(node, "color")) && !validColor
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

const imgAllowsAutoSizes = (node: HtmlChildView): boolean =>
  attributeHasRequiredValue(readProperty(node, "loading"), "lazy", true) &&
  pipe(
    sourceSizeAnalysis(readProperty(node, "sizes")),
    O.exists((analysis) => analysis.usesAuto)
  );

const inspectImgResponsiveRelationships = (
  node: HtmlChildView,
  path: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> => {
  const srcset = readProperty(node, "srcset");
  const sizesValue = readProperty(node, "sizes");
  const profile = srcsetProfile(srcset);
  const sizes = sourceSizeAnalysis(sizesValue);
  const hasSrcset = hasAttribute(srcset);
  const hasSizes = hasAttribute(sizesValue);
  const loadingIsLazy = attributeHasRequiredValue(readProperty(node, "loading"), "lazy", true);
  const sizesIsExactlyAuto = pipe(
    stringAttributeValue(sizesValue),
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
  const imageSrcset = readProperty(node, "imagesrcset");
  const imageSizesValue = readProperty(node, "imagesizes");
  const profile = srcsetProfile(imageSrcset);
  const imageSizes = sourceSizeAnalysis(imageSizesValue);
  const hasImageSrcset = hasAttribute(imageSrcset);
  const hasImageSizes = hasAttribute(imageSizesValue);
  const imageSizesIncompatible = pipe(
    imageSizes,
    O.exists(() => !hasImageSrcset || O.contains(profile, "density"))
  );
  const iconSizesMisplaced =
    hasAttribute(readProperty(node, "sizes")) &&
    !attributeTokensContainAny(readProperty(node, "rel"), HTML_ICON_LINK_RELATIONS);
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
  const srcset = readProperty(source, "srcset");
  const sizesValue = readProperty(source, "sizes");
  const profile = srcsetProfile(srcset);
  const sizes = sourceSizeAnalysis(sizesValue);
  const hasSizes = hasAttribute(sizesValue);
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
  (candidate._tag === "source" || candidate._tag === "img") && hasAttribute(candidate.srcset);

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
  const laterChildren = A.drop(children, index + 1);
  const followingImage = A.findFirst(laterChildren, (candidate) => candidate._tag === "img");
  const childIssuePath = childPath(path, index);
  return [
    ...inspectPictureSourceResponsiveRelationships(child, childIssuePath, followingImage),
    ...pictureSourceDifferentiationIssues(
      childIssuePath,
      A.some(laterChildren, isResponsivePictureCandidate),
      stringAttributeValue(readProperty(child, "media")),
      stringAttributeValue(child.type)
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

const attributeRequirementAppliesToAttributes = (requirement: HtmlAttributeRequirement, attributes: object): boolean =>
  pipe(
    requirement.when,
    O.fromUndefinedOr,
    O.match({
      onNone: () => true,
      onSome: (predicate) =>
        Match.value(predicate).pipe(
          Match.tags({
            attributeContainsToken: ({ attribute, value }) =>
              attributeTokensContainAll(readProperty(attributes, attribute), [value]),
            attributeEquals: ({ attribute, value }) => attributeEquals(readProperty(attributes, attribute), value),
            attributeEqualsOrMissing: ({ attribute, value }) =>
              !hasAttribute(readProperty(attributes, attribute)) ||
              attributeEquals(readProperty(attributes, attribute), value),
            attributePresent: ({ attribute }) => hasAttribute(readProperty(attributes, attribute)),
          }),
          Match.exhaustive
        ),
    })
  );

const missingRequiredAttributeGroups = (
  requirement: HtmlAttributeRequirement,
  attributes: object
): ReadonlyArray<ReadonlyArray<string>> =>
  A.filter(
    requirement.required,
    (alternatives) => !A.some(alternatives, (attribute) => hasAttribute(readProperty(attributes, attribute)))
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
  attributes: object
): boolean =>
  pipe(
    requirement.forbidden,
    O.fromUndefinedOr,
    O.exists((forbidden) => A.some(forbidden, (attribute) => hasAttribute(readProperty(attributes, attribute))))
  );

const attributeRequirementHasBlankAttribute = (requirement: HtmlAttributeRequirement, attributes: object): boolean =>
  pipe(
    requirement.nonBlank,
    O.fromUndefinedOr,
    O.exists((nonBlank) =>
      A.some(
        nonBlank,
        (attribute) =>
          hasAttribute(readProperty(attributes, attribute)) &&
          !hasNonBlankStringAttribute(readProperty(attributes, attribute))
      )
    )
  );

const attributeValueConstraintIsSatisfied = (constraint: AttributeValueConstraint, attributes: object): boolean =>
  Match.value(constraint).pipe(
    Match.tags({
      allowedValues: ({ attribute, values }) => attributeHasAllowedValue(readProperty(attributes, attribute), values),
      containsAllTokens: ({ attribute, values }) =>
        attributeTokensContainAll(readProperty(attributes, attribute), values),
      containsAnyToken: ({ attribute, values }) =>
        attributeTokensContainAny(readProperty(attributes, attribute), values),
      equals: ({ asciiCaseInsensitive, attribute, value }) =>
        attributeHasRequiredValue(readProperty(attributes, attribute), value, asciiCaseInsensitive === true),
    }),
    Match.exhaustive
  );

const attributeRequirementHasConstraintViolation = (
  requirement: HtmlAttributeRequirement,
  attributes: object
): boolean =>
  pipe(
    requirement.constraints,
    O.fromUndefinedOr,
    O.exists((constraints) =>
      A.some(constraints, (constraint) => !attributeValueConstraintIsSatisfied(constraint, attributes))
    )
  );

const attributeRequirementHasInvalidUrl = (requirement: HtmlAttributeRequirement, attributes: object): boolean =>
  pipe(
    requirement.validNonEmptyUrl,
    O.fromUndefinedOr,
    O.exists((attributesToValidate) =>
      A.some(
        attributesToValidate,
        (attribute) =>
          hasAttribute(readProperty(attributes, attribute)) &&
          !isValidNonEmptyHtmlUrl(readProperty(attributes, attribute))
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
  attributes: object,
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
  const meta = ELEMENT_META[tag];
  const requiredIssues = A.flatMap(meta.attributeRequirements, (requirement) =>
    inspectAttributeRequirement(requirement, node, path, ancestors)
  );
  const equalityIssues = A.flatMap(meta.attributeEqualities, (equality) =>
    pipe(
      O.all([attributeValue(readProperty(node, equality.left)), attributeValue(readProperty(node, equality.right))]),
      O.exists(([left, right]) => left !== right)
    )
      ? [makeIssue(A.append(path, `attributes.${equality.left}`), "attributeRelationship", equality.message)]
      : A.emptyReadonly()
  );
  const numericIssues = A.flatMap(meta.numericAttributeRelationships, (relationship) => {
    const numberValue = (attribute: string, fallback: number | undefined): O.Option<number> =>
      pipe(
        attributeValue(readProperty(node, attribute)),
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

const inspectDocumentVisibilityLimits = (root: HtmlChildView): ReadonlyArray<HtmlConformanceIssue> => {
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
            (occurrence) => occurrence.tag === tag && !hasAttribute(readProperty(occurrence.node, unlessAttribute))
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
          O.flatMap((attributes) => O.fromUndefinedOr(readProperty(attributes, "id")))
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

const inspectDuplicateIds = (root: HtmlChildView): ReadonlyArray<HtmlConformanceIssue> =>
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

const samePath = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  left.length === right.length && A.every(left, (segment, index) => right[index] === segment);

const inspectIdReferences = (root: HtmlChildView): ReadonlyArray<HtmlConformanceIssue> => {
  const ids = idOccurrences(root, []);
  const elements = elementOccurrences(root, []);
  const headingCells = A.flatMap(elements, (occurrence) =>
    occurrence.tag === "th"
      ? pipe(
          stringAttributeValue(occurrence.node.id),
          O.map((id) => ({ id, table: occurrence.tablePath })),
          O.toArray
        )
      : A.emptyReadonly()
  );
  return A.flatMap(elements, (occurrence) => {
    if (occurrence.tag === "button") {
      return pipe(
        stringAttributeValue(readProperty(occurrence.node, "commandfor")),
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
        stringAttributeValue(readProperty(occurrence.node, "for")),
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
    const table = occurrence.tablePath;
    return pipe(
      stringAttributeValue(readProperty(occurrence.node, "headers")),
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
          attributeValue(readProperty(node, attribute)),
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

const inspectDuplicateUniqueAttributes = (root: HtmlChildView): ReadonlyArray<HtmlConformanceIssue> =>
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
  A.some(tokens, (token) => token === "text" || token === "flow" || token === "phrasing");

const allowedElementTokens = (node: HtmlChildView, tag: HtmlTag): ReadonlyArray<string> => {
  const categories = effectiveCategories(node, tag);
  return [
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
    A.filter(
      (
        child
      ): child is HtmlChildView & {
        readonly _tag: HtmlTag;
      } => isHtmlTag(child._tag)
    )
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
            A.filter(
              (nested): nested is HtmlChildView & { readonly _tag: HtmlTag } =>
                isHtmlTag(nested._tag) && !isScriptSupporting(nested._tag)
            ),
            A.map((nested) => nested._tag)
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
      hasAttribute(readProperty(parent, "span")) && A.some(elementTags, (tag) => tag === "col" || tag === "template")
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
          return !(hasSrc || phase !== "source");
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
          {
            attributes: parentAttributes,
            name: parentName,
            namespace: parentNamespace,
          },
          {
            attributes: childAttributes,
            name: childName,
            namespace: childNamespace,
          }
        )
        ? A.emptyReadonly()
        : issue("The foreign child would change namespace or escape its opaque parent during HTML parsing");
    }),
    Match.orElse(
      (tag): ReadonlyArray<HtmlConformanceIssue> =>
        isHtmlTag(tag) &&
        (parentNamespace === "svg" || parentNamespace === "mathml") &&
        isString(parentName) &&
        isHtmlChildAtForeignBoundary({
          attributes: parentAttributes,
          name: parentName,
          namespace: parentNamespace,
        })
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
        ...inspectScriptConformance(node, tag, path),
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
 * **Example** (Call `inspectConformance`)
 *
 * ```ts import.meta.vitest name="Call inspectConformance"
 * import { inspectConformance } from "@beep/html/Html.conformance"
 * import { Fragment } from "@beep/html/Html.model"
 *
 * inspectConformance(Fragment.make({ children: [] })) // => []
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const inspectConformance = (root: HtmlRoot.Type): ReadonlyArray<HtmlConformanceIssue> => {
  if (!isHtmlChildView(root)) {
    return [makeIssue([], "encodingFailure", "The HTML root did not satisfy the recursive conformance-view schema")];
  }

  const view: HtmlChildView = root;
  const doctype: HtmlRootView["doctype"] = root._tag === "#document" ? root.doctype : O.none();
  const structuralIssues = Match.value(view._tag).pipe(
    Match.when("#document", (): ReadonlyArray<HtmlConformanceIssue> => {
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
    ...inspectHeadingOutline(root),
    ...inspectDuplicateIds(view),
    ...inspectIdReferences(view),
    ...inspectDuplicateUniqueAttributes(view),
  ];
};

/**
 * Validates an HTML root and issues an opaque conformance proof.
 *
 * **Example** (Call `conform`)
 *
 * ```ts import.meta.vitest name="Call conform"
 * import { conform, conformantRoot } from "@beep/html/Html.conformance"
 * import { Fragment } from "@beep/html/Html.model"
 * import { Effect } from "effect"
 *
 * const program = conform(Fragment.make({ children: [] })).pipe(
 *   Effect.map((value) => conformantRoot(value)._tag)
 * )
 * Effect.runSync(program) // => "#fragment"
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
 * **Example** (Call `conformantRoot`)
 *
 * ```ts import.meta.vitest name="Call conformantRoot"
 * import { conform, conformantRoot } from "@beep/html/Html.conformance"
 * import { Fragment } from "@beep/html/Html.model"
 * import { Effect } from "effect"
 *
 * const program = conform(Fragment.make({ children: [] })).pipe(
 *   Effect.map(conformantRoot)
 * )
 * Effect.runSync(program)._tag // => "#fragment"
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
