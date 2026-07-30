/**
 * Pure conformance checks for the generated HTML AST.
 *
 * The package validates already-constructed AST values. It deliberately does
 * not tokenize HTML source or repair trees like a WHATWG parser.
 *
 * @packageDocumentation \@beep/html/Html.conformance
 * @since 0.0.0
 */
import { $HtmlId } from "@beep/identity";
import { LiteralKit, TaggedErrorClass } from "@beep/schema";
import { A, Struct } from "@beep/utils";
import { Effect, Match, pipe, Result } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { isForeignAttributeNameFixedPoint, isForeignElementNameFixedPoint } from "./Html.foreign.ts";
import { ELEMENT_META, HTML_CONTENT_TOKEN_EXPANSIONS, HtmlTag } from "./Html.meta.ts";
import { HtmlRoot } from "./Html.model.ts";
import type { Doctype } from "./Html.nodes.ts";

const $I = $HtmlId.create("Html.conformance");
const isHtmlTag = S.is(HtmlTag);
const isString = S.is(S.String);

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
  "contentModel",
  "elementOrder",
  "foreignIntegration",
  "forbiddenDescendant",
  "attributeRelationship",
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

type ForbiddenDescendantConstraint = {
  readonly ancestor: HtmlTag;
  readonly attributes: ReadonlyArray<keyof HtmlChildView>;
  readonly categories: ReadonlyArray<string>;
  readonly tags: ReadonlyArray<HtmlTag>;
};

const forbiddenDescendantConstraints: ReadonlyArray<ForbiddenDescendantConstraint> = [
  { ancestor: "a", attributes: ["tabindex"], categories: ["interactive"], tags: ["a"] },
  {
    ancestor: "address",
    attributes: [],
    categories: ["heading", "sectioning"],
    tags: ["address", "header", "footer"],
  },
  { ancestor: "button", attributes: ["tabindex"], categories: ["interactive"], tags: [] },
  { ancestor: "dt", attributes: [], categories: ["heading", "sectioning"], tags: ["header", "footer"] },
  { ancestor: "form", attributes: [], categories: [], tags: ["form"] },
  { ancestor: "label", attributes: [], categories: [], tags: ["label"] },
  { ancestor: "meter", attributes: [], categories: [], tags: ["meter"] },
  { ancestor: "progress", attributes: [], categories: [], tags: ["progress"] },
  { ancestor: "th", attributes: [], categories: ["heading", "sectioning"], tags: ["header", "footer"] },
];

type AttributeRelationship = {
  readonly tag: HtmlTag;
  readonly when: (node: HtmlChildView) => boolean;
  readonly required: ReadonlyArray<ReadonlyArray<keyof HtmlChildView>>;
  readonly message: string;
};

const attributeRelationships: ReadonlyArray<AttributeRelationship> = [
  {
    tag: "a",
    when: (node) => hasAttribute(node.target),
    required: [["href"]],
    message: "<a target> requires href",
  },
  {
    tag: "area",
    when: (node) => hasAttribute(node.href),
    required: [["alt"]],
    message: "<area href> requires alt text",
  },
  {
    tag: "img",
    when: () => true,
    required: [["alt"], ["src", "srcset"]],
    message: "<img> requires alt and at least one of src or srcset",
  },
  {
    tag: "input",
    when: (node) => attributeEquals(node.type, "image"),
    required: [["alt"], ["src"]],
    message: '<input type="image"> requires alt and src',
  },
];

const effectiveCategories = (node: HtmlChildView, tag: HtmlTag): ReadonlyArray<string> => {
  const meta = ELEMENT_META[tag];
  return A.filter(meta.categories, (category) => {
    const rules = A.filter(meta.conditionalCategories, (rule) => rule.category === category);
    return (
      rules.length === 0 ||
      A.some(rules, (rule) =>
        rule.condition === "present"
          ? hasAttribute((node as unknown as Record<string, unknown>)[rule.attribute])
          : !attributeEquals(
              (node as unknown as Record<string, unknown>)[rule.attribute],
              /* istanbul ignore next -- the generator supplies value for every not-equals conditional category */
              rule.value ?? ""
            )
      )
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
  return A.flatMap(forbiddenDescendantConstraints, (constraint) =>
    A.contains(ancestors, constraint.ancestor)
      ? pipe(
          constraint.attributes,
          A.findFirst((attribute) => hasAttribute(node[attribute])),
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

const inspectAttributeRelationships = (
  node: HtmlChildView,
  tag: HtmlTag,
  path: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> =>
  pipe(
    attributeRelationships,
    A.filter((relationship: AttributeRelationship) => relationship.tag === tag && relationship.when(node)),
    A.flatMap((relationship: AttributeRelationship) =>
      A.every(relationship.required, (alternatives) =>
        A.some(alternatives, (attribute) => hasAttribute(node[attribute]))
      )
        ? A.emptyReadonly()
        : [makeIssue(A.append(path, "attributes"), "attributeRelationship", relationship.message)]
    )
  );

const childrenOf = (node: HtmlChildView): ReadonlyArray<HtmlChildView> =>
  pipe(node.children, O.fromUndefinedOr, O.getOrElse(A.empty));

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
  Str.isEmpty(Str.trim(value)) ||
  A.some(
    tokens,
    (token) =>
      token === "text" || token === "flow" || token === "phrasing" || token === "transparent" || token === "varies"
  );

const allowedElementTokens = (tag: HtmlTag): ReadonlyArray<string> => {
  const categories = ELEMENT_META[tag].categories;
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

const allowsElement = (tokens: ReadonlyArray<string>, tag: HtmlTag): boolean => {
  const allowedTokens = allowedElementTokens(tag);
  return A.some(tokens, (token) => A.contains(allowedTokens, token));
};

const inspectChildModel = (
  parent: HtmlChildView,
  children: ReadonlyArray<HtmlChildView>,
  path: ReadonlyArray<string>,
  ancestorContentTokens: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> =>
  pipe(
    parent._tag,
    O.liftPredicate(isHtmlTag),
    O.match({
      onNone: A.emptyReadonly,
      onSome: (tag): ReadonlyArray<HtmlConformanceIssue> => {
        const ownTokens = effectiveContentTokens(ELEMENT_META[tag].children);
        const tokens = A.contains(ownTokens, "transparent")
          ? A.appendAll(
              A.filter(ownTokens, (token) => token !== "transparent"),
              ancestorContentTokens
            )
          : ownTokens;
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
                isHtmlTag(childTag) && allowsElement(tokens, childTag)
                  ? A.empty<HtmlConformanceIssue>()
                  : [makeIssue(childPath(path, index), "contentModel", `<${tag}> does not permit <${childTag}>`)]
            )
          )
        );
      },
    })
  );

const descriptionGroupSequence = /^(?:(?:dt,)+(?:dd,)+)+$/u;

const inspectElementOrder = (
  parent: HtmlChildView,
  children: ReadonlyArray<HtmlChildView>,
  path: ReadonlyArray<string>
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
      !(child._tag === "#text" && isString(child.value) && Str.isEmpty(Str.trim(child.value)))
  );
  const significantText = A.some(
    children,
    (child) => child._tag === "#text" && isString(child.value) && Str.isNonEmpty(Str.trim(child.value))
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
  const isDescriptionGroups = (tags: ReadonlyArray<HtmlTag>): boolean =>
    descriptionGroupSequence.test(`${A.join(tags, ",")},`);

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
              (nested._tag === "#text" && isString(nested.value) && Str.isNonEmpty(Str.trim(nested.value))) ||
              (isHtmlTag(nested._tag) &&
                !isScriptSupporting(nested._tag) &&
                nested._tag !== "dt" &&
                nested._tag !== "dd")
          );
          return !invalidNested && isDescriptionGroups(nestedTags);
        });
      return (sequenceTags.length === 0 || direct || wrapped) && !significantText
        ? A.emptyReadonly()
        : issue("<dl> children must be complete dt+ / dd+ groups, directly or in <div> wrappers");
    }),
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
          !(child._tag === "#text" && isString(child.value) && Str.isEmpty(Str.trim(child.value)))
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
            (child._tag === "#text" && isString(child.value) && Str.isNonEmpty(Str.trim(child.value))) ||
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
            !(child._tag === "#text" && isString(child.value) && Str.isEmpty(Str.trim(child.value)))
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
): ReadonlyArray<HtmlConformanceIssue> =>
  Match.value(child._tag).pipe(
    Match.when("#text", (): ReadonlyArray<HtmlConformanceIssue> => A.emptyReadonly()),
    Match.when("#comment", (): ReadonlyArray<HtmlConformanceIssue> => A.emptyReadonly()),
    Match.when(
      "#foreign",
      (): ReadonlyArray<HtmlConformanceIssue> =>
        child.namespace === parent.namespace
          ? A.emptyReadonly()
          : [
              makeIssue(
                path,
                "foreignIntegration",
                "Opaque foreign content cannot switch namespaces without a modeled integration point"
              ),
            ]
    ),
    Match.orElse(
      (): ReadonlyArray<HtmlConformanceIssue> => [
        makeIssue(
          path,
          "foreignIntegration",
          "HTML elements cannot occur directly inside opaque foreign content without a modeled integration point"
        ),
      ]
    )
  );

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
      const childContentTokens = A.contains(ownTokens, "transparent") ? ancestorContentTokens : ownTokens;
      const local = [
        ...own,
        ...inspectForbiddenDescendants(node, tag, path, ancestors),
        ...inspectLabelableDescendants(node, tag, path),
        ...inspectElementAttributes(node, tag, path),
        ...inspectAttributeRelationships(node, tag, path),
        ...inspectChildModel(node, children, path, ancestorContentTokens),
        ...inspectElementOrder(node, children, path),
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
  return Match.value(view._tag).pipe(
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
      ];
    }),
    Match.when("#fragment", (): ReadonlyArray<HtmlConformanceIssue> => {
      const children = childrenOf(view);
      return A.flatMap(children, (child, index) => inspectChild(child, childPath([], index), [], ["flow"]));
    }),
    Match.orElse((): ReadonlyArray<HtmlConformanceIssue> => inspectChild(view, [], [], ["flow"]))
  );
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
