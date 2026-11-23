/**
 * Typed edges between claim elements and between claim terms.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { TextAnchor } from "@beep/text/TextAnchor";
import * as S from "effect/Schema";
import { ClaimElementPath, ClaimTermRef } from "./ClaimElement.model.ts";

const $I = $LawPracticeDomainId.create("values/ClaimElement/ClaimElement.edge.model");

const ClaimFunctionalPartKind = LiteralKit(["term", "text"]).pipe(
  $I.annoteSchema("ClaimFunctionalPartKind", {
    description:
      "A functional-relation part is either a reference to a claim term or span-anchored connecting claim text.",
  })
);

/**
 * **Example** (Decode a connecting-text part)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ClaimFunctionalPart } from "@beep/law-practice-domain/values/ClaimElement"
 *
 * const part = Effect.runSync(
 *   S.decodeUnknownEffect(ClaimFunctionalPart)({
 *     kind: "text",
 *     anchor: { startChar: 54, endChar: 72, quote: "configured to read" }
 *   })
 * )
 * console.log(part.kind) // "text"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ClaimFunctionalPart = ClaimFunctionalPartKind.toTaggedUnion("kind")({
  term: {
    term: ClaimTermRef.annotateKey({
      description: "Claim term participating in the relation.",
    }),
  },
  text: {
    anchor: TextAnchor.annotateKey({
      description: "Char-exact span of the claim text connecting the participating terms, e.g. a verb phrase.",
    }),
  },
}).pipe(
  $I.annoteSchema("ClaimFunctionalPart", {
    description: "Ordered functional-relation part: a claim-term reference or span-anchored connecting claim text.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type ClaimFunctionalPart = typeof ClaimFunctionalPart.Type;

/**
 * **Example** (Inspect edge kinds)
 *
 * ```ts
 * import { ClaimElementEdgeKind } from "@beep/law-practice-domain/values/ClaimElement"
 *
 * console.log(ClaimElementEdgeKind.literals) // ["part-of", "depends-on-element", "antecedent", "functional"]
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ClaimElementEdgeKind = LiteralKit(["part-of", "depends-on-element", "antecedent", "functional"]).pipe(
  $I.annoteSchema("ClaimElementEdgeKind", {
    description: "Containment, cross-claim element dependency, antecedent basis, or functional relation.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type ClaimElementEdgeKind = typeof ClaimElementEdgeKind.Type;

/**
 * Typed edge of a claim-element tree, discriminated by `kind`.
 *
 * **Details**
 *
 * - `part-of` nests a child element under its parent in the same claim; the
 *   child path extends the parent path.
 * - `depends-on-element` attaches a dependent claim's element to the ancestor
 *   claim element it further limits; the paths' roots name both claims, and
 *   the ancestor's claim number is lower.
 * - `antecedent` links a referring term to the term that introduced it, in the
 *   same claim or in an earlier dependency ancestor.
 * - `functional` records a relation among terms as ordered parts, read from one
 *   functional-relation element; connecting text carries its own span.
 *
 * **Example** (Decode an antecedent edge across claims)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ClaimElementEdge } from "@beep/law-practice-domain/values/ClaimElement"
 *
 * const edge = Effect.runSync(
 *   S.decodeUnknownEffect(ClaimElementEdge)({
 *     kind: "antecedent",
 *     referring: { path: "2", anchor: { startChar: 31, endChar: 49, quote: "the optical sensor" } },
 *     introducing: { path: "1.a", anchor: { startChar: 20, endChar: 37, quote: "an optical sensor" } }
 *   })
 * )
 * console.log(ClaimElementEdge.guards.antecedent(edge)) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ClaimElementEdge = ClaimElementEdgeKind.toTaggedUnion("kind")({
  "part-of": {
    child: ClaimElementPath.annotateKey({
      description: "Nested element.",
    }),
    parent: ClaimElementPath.annotateKey({
      description: "Element that contains the child, in the same claim.",
    }),
  },
  "depends-on-element": {
    dependent: ClaimElementPath.annotateKey({
      description: "Element of the dependent claim; its path root names that claim.",
    }),
    ancestor: ClaimElementPath.annotateKey({
      description: "Element of an ancestor claim that the dependent element further limits.",
    }),
  },
  antecedent: {
    referring: ClaimTermRef.annotateKey({
      description: "Term that refers back, typically opened by the or said.",
    }),
    introducing: ClaimTermRef.annotateKey({
      description: "Term in the same claim or a dependency ancestor that introduced the referent.",
    }),
  },
  functional: {
    element: ClaimElementPath.annotateKey({
      description: "Functional-relation element the relation is read from.",
    }),
    parts: S.NonEmptyArray(ClaimFunctionalPart).annotateKey({
      description: "Ordered term references and span-anchored connecting text that make up the relation.",
    }),
  },
}).pipe(
  $I.annoteSchema("ClaimElementEdge", {
    description: "Part-of, depends-on-element, antecedent, or functional edge of a claim-element tree.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type ClaimElementEdge = typeof ClaimElementEdge.Type;
