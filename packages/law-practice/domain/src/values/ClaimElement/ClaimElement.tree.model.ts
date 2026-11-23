/**
 * Claim-element tree: one claim's span-anchored elements and their typed edges.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PosInt } from "../../internal/PosInt.ts";
import { ClaimElementEdge, ClaimFunctionalPart } from "./ClaimElement.edge.model.ts";
import { ClaimElement, ClaimElementKind, claimNumberOfPath } from "./ClaimElement.model.ts";
import type { ClaimElementPath, ClaimTermRef } from "./ClaimElement.model.ts";

const $I = $LawPracticeDomainId.create("values/ClaimElement/ClaimElement.tree.model");

/**
 * **Example** (Inspect producers)
 *
 * ```ts
 * import { ClaimElementProducer } from "@beep/law-practice-domain/values/ClaimElement"
 *
 * console.log(ClaimElementProducer.is.rule("rule")) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ClaimElementProducer = LiteralKit(["rule", "llm", "human"]).pipe(
  $I.annoteSchema("ClaimElementProducer", {
    description: "Deterministic rule decomposer, LLM proposal, or human labeller.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type ClaimElementProducer = typeof ClaimElementProducer.Type;

const ClaimElementTreeFields = S.Struct({
  claimNumber: PosInt.annotateKey({
    description: "Number of the PatentClaim this tree decomposes; every element path is rooted at it.",
  }),
  producer: ClaimElementProducer.annotateKey({
    description: "Producer of the decomposition.",
  }),
  elements: S.NonEmptyArray(ClaimElement).annotateKey({
    description: "Elements of the claim in text order, each with a unique path.",
  }),
  edges: S.Array(ClaimElementEdge).annotateKey({
    description: "Typed edges whose claim-local endpoints name elements of this tree.",
  }),
});

type ClaimElementTreeFields = typeof ClaimElementTreeFields.Type;

const anchorEquivalence = S.toEquivalence(TextAnchor);

const anchorWithin =
  (outer: TextAnchor) =>
  (inner: TextAnchor): boolean =>
    outer.startChar <= inner.startChar && inner.endChar <= outer.endChar;

const termRefsOf = (edge: ClaimElementEdge): ReadonlyArray<Pick<ClaimTermRef, "path" | "anchor">> =>
  ClaimElementEdge.match(edge, {
    "part-of": () => A.empty(),
    "depends-on-element": () => A.empty(),
    antecedent: ({ referring, introducing }) => [referring, introducing],
    functional: ({ parts }) =>
      A.flatMap(parts, (part) =>
        ClaimFunctionalPart.match(part, {
          term: ({ term }) => [term],
          text: () => A.empty(),
        })
      ),
  });

const endpointsOf = (edge: ClaimElementEdge): ReadonlyArray<ClaimElementPath> =>
  A.appendAll(
    ClaimElementEdge.match(edge, {
      "part-of": ({ child, parent }) => [child, parent],
      "depends-on-element": ({ dependent, ancestor }) => [dependent, ancestor],
      antecedent: () => A.empty(),
      functional: ({ element }) => [element],
    }),
    A.map(termRefsOf(edge), ({ path }) => path)
  );

const connectingTextOf = (parts: ReadonlyArray<ClaimFunctionalPart>): ReadonlyArray<TextAnchor> =>
  A.flatMap(parts, (part) =>
    ClaimFunctionalPart.match(part, {
      term: () => A.empty(),
      text: ({ anchor }) => [anchor],
    })
  );

const termStartOrder = Order.mapInput(Num.Order, (term: { readonly anchor: TextAnchor }) => term.anchor.startChar);

const firstViolation = (rules: ReadonlyArray<readonly [holds: boolean, message: string]>): O.Option<string> =>
  pipe(
    A.findFirst(rules, ([holds]) => !holds),
    O.map(([, message]) => message)
  );

const ClaimElementTreeCoherenceCheck = S.makeFilter(
  (tree: ClaimElementTreeFields): S.FilterOutput => {
    const claim = tree.claimNumber;
    const isLocal = (path: ClaimElementPath): boolean => claimNumberOfPath(path) === claim;
    const elementAt = (path: ClaimElementPath): O.Option<ClaimElement> =>
      A.findFirst(tree.elements, (element) => element.path === path);
    const paths = A.map(tree.elements, ({ path }) => path);
    const foreignElements = A.filter(paths, (path) => !isLocal(path));
    const duplicatePaths = A.dedupe(A.filter(paths, (path, index) => A.contains(A.take(paths, index), path)));
    const danglingEndpoints = A.dedupe(
      A.filter(A.flatMap(tree.edges, endpointsOf), (path) => isLocal(path) && !A.contains(paths, path))
    );
    const edgeShapeViolations = A.getSomes(
      A.map(tree.edges, (edge) =>
        ClaimElementEdge.match(edge, {
          "part-of": ({ child, parent }) =>
            firstViolation([
              [isLocal(child), `Part-of child ${child} is not an element of claim ${claim}.`],
              [Str.startsWith(`${parent}.`)(child), `Part-of child ${child} is not nested under parent ${parent}.`],
            ]),
          "depends-on-element": ({ dependent, ancestor }) =>
            firstViolation([
              [isLocal(dependent), `Depends-on-element dependent ${dependent} is not an element of claim ${claim}.`],
              [
                claimNumberOfPath(ancestor) < claim,
                `Depends-on-element ancestor ${ancestor} is not in a claim earlier than claim ${claim}.`,
              ],
            ]),
          antecedent: ({ referring, introducing }) =>
            firstViolation([
              [isLocal(referring.path), `Antecedent referring term ${referring.path} is not in claim ${claim}.`],
              [
                claimNumberOfPath(introducing.path) <= claim,
                `Antecedent introducing term ${introducing.path} is in a claim later than claim ${claim}.`,
              ],
            ]),
          functional: (functional) =>
            firstViolation([
              [
                O.exists(elementAt(functional.element), ({ kind }) => ClaimElementKind.is["functional-relation"](kind)),
                `Functional edge element ${functional.element} is not a functional-relation element of claim ${claim}.`,
              ],
              [
                O.exists(elementAt(functional.element), (owner) =>
                  A.every(connectingTextOf(functional.parts), anchorWithin(owner.anchor))
                ),
                `Functional edge connecting text lies outside element ${functional.element}.`,
              ],
              [
                A.every(termRefsOf(functional), ({ path }) => path === functional.element),
                `Functional edge term parts must be terms of element ${functional.element}.`,
              ],
            ]),
        })
      )
    );
    const unknownTermRefs = A.filter(
      A.filter(A.flatMap(tree.edges, termRefsOf), ({ path }) => isLocal(path)),
      ({ path, anchor }) =>
        O.exists(elementAt(path), ({ terms }) => !A.some(terms, (term) => anchorEquivalence(term.anchor, anchor)))
    );
    const strayTerms = A.flatMap(tree.elements, (element) =>
      A.map(
        A.filter(element.terms, ({ anchor }) => !anchorWithin(element.anchor)(anchor)),
        ({ anchor }) => [element.path, anchor] as const
      )
    );
    const overlappingTerms = A.flatMap(tree.elements, (element) => {
      const sorted = A.sort(element.terms, termStartOrder);
      return A.map(
        A.filter(A.zip(sorted, A.drop(sorted, 1)), ([before, after]) => after.anchor.startChar < before.anchor.endChar),
        ([, after]) => [element.path, after.anchor] as const
      );
    });
    return A.getSomes([
      pipe(
        A.head(foreignElements),
        O.map((path) => `Element ${path} is not rooted at claim ${claim}.`)
      ),
      pipe(
        A.head(duplicatePaths),
        O.map((path) => `Element path ${path} is declared more than once.`)
      ),
      pipe(
        A.head(danglingEndpoints),
        O.map((path) => `Edge endpoint ${path} names no element of claim ${claim}.`)
      ),
      A.head(edgeShapeViolations),
      pipe(
        A.head(unknownTermRefs),
        O.map(
          ({ path, anchor }) =>
            `Term reference ${path} [${anchor.startChar}, ${anchor.endChar}) names no term of that element.`
        )
      ),
      pipe(
        A.head(strayTerms),
        O.map(
          ([path, anchor]) =>
            `Term [${anchor.startChar}, ${anchor.endChar}) of element ${path} lies outside the element's span.`
        )
      ),
      pipe(
        A.head(overlappingTerms),
        O.map(
          ([path, anchor]) =>
            `Term [${anchor.startChar}, ${anchor.endChar}) of element ${path} overlaps the term before it.`
        )
      ),
    ]);
  },
  $I.annote("ClaimElementTreeCoherenceCheck", {
    title: "Coherent claim-element tree",
    description:
      "Element paths are unique and rooted at the tree's claim number; every claim-local edge endpoint and term reference names an element and term of the tree; terms lie inside their element's span and do not overlap; part-of nests within the claim; dependencies and introductions point to earlier claims; functional edges read from functional-relation elements whose span holds their connecting text and whose terms are their term parts.",
  })
);

/**
 * **Details**
 *
 * The tree sits beside `PatentClaim` rather than inside it. Element and term
 * anchors index that claim's `claimText`, and every term lies inside its
 * element's span. Decoding enforces coherence:
 *
 * - every endpoint rooted at this claim (edge paths, term-reference paths)
 *   names an element of the tree, and every such term reference names a term
 *   of that element by its exact anchor;
 * - `part-of` children are elements of this claim nested under their parent's
 *   path;
 * - a `depends-on-element` dependent is in this claim and its ancestor in an
 *   earlier claim;
 * - an `antecedent` referring term is in this claim and its introduction in
 *   this claim or an earlier one;
 * - a `functional` edge reads from a `functional-relation` element.
 *
 * Endpoints rooted at an earlier claim point into that claim's own tree and
 * are checked when the trees are read together.
 *
 * **Example** (Decode a one-element tree)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ClaimElementTree } from "@beep/law-practice-domain/values/ClaimElement"
 *
 * const tree = Effect.runSync(
 *   S.decodeUnknownEffect(ClaimElementTree)({
 *     claimNumber: 1,
 *     producer: "rule",
 *     elements: [
 *       {
 *         path: "1",
 *         anchor: { startChar: 0, endChar: 8, quote: "A system" },
 *         kind: "preamble-subject",
 *         terms: [{ anchor: { startChar: 0, endChar: 8, quote: "A system" }, determiner: "a", head: "system" }]
 *       }
 *     ],
 *     edges: []
 *   })
 * )
 * console.log(tree.elements.length) // 1
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ClaimElementTree extends S.Opaque<ClaimElementTree, { readonly brand: unique symbol }>()(
  ClaimElementTreeFields.check(ClaimElementTreeCoherenceCheck).pipe(
    $I.annoteSchema("ClaimElementTree", {
      description: "Span-anchored claim elements and typed edges for one patent claim, keyed by claim number.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ClaimElementTree {
  /**
   * Wire-encoded representation of a decoded {@link ClaimElementTree}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ClaimElementTree.Encoded;
}
