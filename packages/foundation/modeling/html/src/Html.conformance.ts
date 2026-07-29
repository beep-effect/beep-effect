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
import { ELEMENT_META, HtmlTag } from "./Html.meta.ts";
import { HtmlRoot } from "./Html.model.ts";
import type { Doctype } from "./Html.nodes.ts";

const $I = $HtmlId.create("Html.conformance");
const isHtmlTag = S.is(HtmlTag);
const isString = S.is(S.String);

type HtmlChildView = {
  readonly _tag: string;
  readonly children?: ReadonlyArray<HtmlChildView>;
  readonly name?: unknown;
  readonly namespace?: string;
  readonly value?: unknown;
  readonly alt?: unknown;
  readonly href?: unknown;
  readonly src?: unknown;
  readonly srcset?: unknown;
  readonly target?: unknown;
  readonly type?: unknown;
};

const HtmlChildView: S.Codec<HtmlChildView> = S.Struct({
  _tag: S.String,
  children: S.Array(S.suspend((): S.Codec<HtmlChildView> => HtmlChildView)).pipe(S.optionalKey),
  name: S.Unknown.pipe(S.optionalKey),
  namespace: S.String.pipe(S.optionalKey),
  value: S.Unknown.pipe(S.optionalKey),
  alt: S.Unknown.pipe(S.optionalKey),
  href: S.Unknown.pipe(S.optionalKey),
  src: S.Unknown.pipe(S.optionalKey),
  srcset: S.Unknown.pipe(S.optionalKey),
  target: S.Unknown.pipe(S.optionalKey),
  type: S.Unknown.pipe(S.optionalKey),
});

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

type ConformantHtmlValue = object;

const isConformantHtmlValue = (value: unknown): value is ConformantHtmlValue =>
  P.isObject(value) && conformantIssuer.has(value);

const issueConformantHtml = (root: HtmlRoot.Type): ConformantHtmlValue => {
  const value = Object.create(null) as ConformantHtmlValue;
  conformantRoots.set(value, root);
  conformantIssuer.add(value);
  return Object.freeze(value);
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
  HtmlConformanceError.make({
    issues: [
      makeIssue(
        [],
        "encodingFailure",
        "The HTML root could not be copied into a detached schema-valid conformance snapshot"
      ),
    ],
  });

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
  readonly categories: ReadonlyArray<string>;
  readonly tags: ReadonlyArray<HtmlTag>;
};

const forbiddenDescendantConstraints: ReadonlyArray<ForbiddenDescendantConstraint> = [
  { ancestor: "a", categories: ["interactive"], tags: ["a"] },
  { ancestor: "address", categories: ["heading", "sectioning"], tags: ["address", "header", "footer"] },
  { ancestor: "button", categories: ["interactive"], tags: [] },
  { ancestor: "dt", categories: ["heading", "sectioning"], tags: ["header", "footer"] },
  { ancestor: "form", categories: [], tags: ["form"] },
  { ancestor: "label", categories: [], tags: ["label"] },
  { ancestor: "meter", categories: [], tags: ["meter"] },
  { ancestor: "progress", categories: [], tags: ["progress"] },
  { ancestor: "th", categories: ["heading", "sectioning"], tags: ["header", "footer"] },
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

const inspectForbiddenDescendants = (
  tag: HtmlTag,
  path: ReadonlyArray<string>,
  ancestors: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> => {
  const categories = ELEMENT_META[tag].categories;
  return A.flatMap(forbiddenDescendantConstraints, (constraint) =>
    A.contains(ancestors, constraint.ancestor) &&
    (A.contains(constraint.tags, tag) || A.some(constraint.categories, (category) => A.contains(categories, category)))
      ? [makeIssue(path, "forbiddenDescendant", `<${tag}> is forbidden beneath <${constraint.ancestor}>`)]
      : A.emptyReadonly()
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

const effectiveContentTokens = (tag: HtmlTag, tokens: ReadonlyArray<string>): ReadonlyArray<string> =>
  Match.value(tag).pipe(
    Match.when("div", () => ["flow"]),
    Match.when("option", () => ["text"]),
    Match.when("optgroup", () => ["option", "optgroup", "legend", "script-supporting elements"]),
    Match.when("select", () => ["button", "option", "optgroup", "hr", "script-supporting elements"]),
    Match.orElse(() => tokens)
  );

const isScriptSupporting = (tag: string): boolean => tag === "script" || tag === "template";
const tableChildSequencePattern = new RegExp(
  pipe(
    ELEMENT_META.table.childSequencePattern,
    O.fromUndefinedOr,
    O.getOrThrowWith(() => new Error("Generated <table> metadata requires a child-sequence pattern"))
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

const allowsElement = (tokens: ReadonlyArray<string>, tag: HtmlTag): boolean => {
  const meta = ELEMENT_META[tag];
  return A.some(
    tokens,
    (token) =>
      token === "transparent" ||
      token === "varies" ||
      token === tag ||
      (token === "one img" && tag === "img") ||
      (token === "script-supporting elements" && isScriptSupporting(tag)) ||
      (token === "metadata content" && A.contains(meta.categories, "metadata")) ||
      (token === "heading content" && A.contains(meta.categories, "heading")) ||
      A.contains(meta.categories, token)
  );
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
        const ownTokens = effectiveContentTokens(tag, ELEMENT_META[tag].children);
        const tokens = A.contains(ownTokens, "transparent") ? ancestorContentTokens : ownTokens;
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

const inspectElementOrder = (
  parent: HtmlChildView,
  children: ReadonlyArray<HtmlChildView>,
  path: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> => {
  const elementTags = pipe(
    children,
    A.filter((child) => isHtmlTag(child._tag)),
    A.map((child) => child._tag)
  );
  const sequenceTags = A.filter(elementTags, (tag) => !isScriptSupporting(tag));

  return Match.value(parent._tag).pipe(
    Match.when(
      "html",
      (): ReadonlyArray<HtmlConformanceIssue> =>
        elementTags.length === 2 && elementTags[0] === "head" && elementTags[1] === "body"
          ? A.emptyReadonly()
          : [makeIssue(path, "elementOrder", "<html> must contain one <head> followed by one <body>")]
    ),
    Match.when("picture", (): ReadonlyArray<HtmlConformanceIssue> => {
      const firstImage = A.findFirstIndex(elementTags, (tag) => tag === "img");
      const lastImage = A.findLastIndex(elementTags, (tag) => tag === "img");
      const oneImage = O.isSome(firstImage) && O.contains(lastImage, firstImage.value);
      return oneImage &&
        A.every(A.take(elementTags, firstImage.value), (tag) => tag === "source" || isScriptSupporting(tag))
        ? A.emptyReadonly()
        : [makeIssue(path, "elementOrder", "<picture> must contain one <img> after its <source> elements")];
    }),
    Match.when("details", (): ReadonlyArray<HtmlConformanceIssue> => {
      const firstSummary = A.findFirstIndex(elementTags, (tag) => tag === "summary");
      const lastSummary = A.findLastIndex(elementTags, (tag) => tag === "summary");
      return (O.isNone(firstSummary) && O.isNone(lastSummary)) ||
        (O.contains(firstSummary, 0) && O.contains(lastSummary, 0))
        ? A.emptyReadonly()
        : [makeIssue(path, "elementOrder", "<summary> must be the first element child of <details>")];
    }),
    Match.when("figure", (): ReadonlyArray<HtmlConformanceIssue> => {
      const firstCaption = A.findFirstIndex(elementTags, (tag) => tag === "figcaption");
      const lastCaption = A.findLastIndex(elementTags, (tag) => tag === "figcaption");
      return (O.isNone(firstCaption) && O.isNone(lastCaption)) ||
        (O.isSome(firstCaption) &&
          O.contains(lastCaption, firstCaption.value) &&
          (firstCaption.value === 0 || firstCaption.value === elementTags.length - 1))
        ? A.emptyReadonly()
        : [makeIssue(path, "elementOrder", "<figcaption> must be the first or last element child of <figure>")];
    }),
    Match.when(
      "table",
      (): ReadonlyArray<HtmlConformanceIssue> =>
        tableChildSequencePattern.test(`${A.join(sequenceTags, ",")}${sequenceTags.length === 0 ? "" : ","}`)
          ? A.emptyReadonly()
          : [
              makeIssue(
                path,
                "elementOrder",
                "<table> children must follow caption?, colgroup*, thead?, (tbody* | tr+), tfoot?"
              ),
            ]
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

const inspectChild = (
  node: HtmlChildView,
  path: ReadonlyArray<string>,
  ancestors: ReadonlyArray<string>,
  ancestorContentTokens: ReadonlyArray<string>
): ReadonlyArray<HtmlConformanceIssue> =>
  Match.value(node._tag).pipe(
    Match.when("#text", (): ReadonlyArray<HtmlConformanceIssue> => A.emptyReadonly()),
    Match.when("#comment", (): ReadonlyArray<HtmlConformanceIssue> => A.emptyReadonly()),
    Match.when("#foreign", (): ReadonlyArray<HtmlConformanceIssue> => {
      const parent = A.last(ancestors);
      const entersFromHtml = O.isNone(parent) || (O.isSome(parent) && isHtmlTag(parent.value));
      const integrationIssue =
        entersFromHtml &&
        !((node.namespace === "svg" && node.name === "svg") || (node.namespace === "mathml" && node.name === "math"))
          ? [
              makeIssue(
                path,
                "foreignIntegration",
                "Foreign content must enter HTML through an <svg> or <math> integration element"
              ),
            ]
          : A.empty<HtmlConformanceIssue>();
      return A.appendAll(
        integrationIssue,
        A.flatMap(childrenOf(node), (child, index) => {
          const pathToChild = childPath(path, index);
          return A.appendAll(
            inspectForeignChildBoundary(node, child, pathToChild),
            inspectChild(child, pathToChild, A.append(ancestors, "#foreign"), ancestorContentTokens)
          );
        })
      );
    }),
    Match.orElse((tag): ReadonlyArray<HtmlConformanceIssue> => {
      if (!isHtmlTag(tag)) return A.emptyReadonly();
      const meta = ELEMENT_META[tag];
      const children = childrenOf(node);
      const own =
        meta.conformance === "non-conforming"
          ? [makeIssue(path, "obsoleteElement", `<${tag}> is obsolete and non-conforming`)]
          : A.empty<HtmlConformanceIssue>();
      const ownTokens = effectiveContentTokens(tag, meta.children);
      const childContentTokens = A.contains(ownTokens, "transparent") ? ancestorContentTokens : ownTokens;
      const local = [
        ...own,
        ...inspectForbiddenDescendants(tag, path, ancestors),
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
      const doctype = pipe(
        view.doctype,
        O.fromUndefinedOr,
        O.getOrElse(() => O.none<Doctype.Type>())
      );
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
 * @category validation
 * @since 0.0.0
 */
export const conform = Effect.fn("Html.conform")(function* (root: HtmlRoot.Type) {
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
    O.getOrThrowWith(() => new Error("Invalid ConformantHtml issuer proof"))
  );
