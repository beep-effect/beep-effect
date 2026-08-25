/**
 * Projection from exact identity entries into bounded SHACL node shapes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SemanticWebId } from "@beep/identity/packages";
import { makeLiteral, makeNamedNode } from "@beep/rdf/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { NonNegativeInt } from "@beep/schema";
import { Effect, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { ShaclNodeShape, ShaclPropertyShape } from "../services/shacl-validation.ts";
import { IdentityFiberPathError } from "./IdentityRdfBinding.ts";
import type { IdentityEntry } from "@beep/identity";
import type { IdentityRdfBinding } from "./IdentityRdfBinding.ts";

const $I = $SemanticWebId.create("identity/IdentityShaclProjection");

type IdentityShapeProjector = (
  entries: ReadonlyArray<IdentityEntry>
) => Effect.Effect<ReadonlyArray<ShaclNodeShape>, IdentityFiberPathError>;

/**
 * Data policy selecting the identity fibers required by projected SHACL shapes.
 *
 * **Example** (Require a label fiber)
 *
 * ```ts
 * import { IdentityShapePolicy } from "@beep/semantic-web"
 *
 * const policy = IdentityShapePolicy.make({ requiredFibers: ["label"] })
 * console.log(policy.requiredFibers) // ["label"]
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export class IdentityShapePolicy extends S.Class<IdentityShapePolicy>($I`IdentityShapePolicy`)(
  { requiredFibers: S.Array(S.String) },
  $I.annote("IdentityShapePolicy", {
    description: "Named identity fibers that every projected node shape requires.",
  })
) {}

/**
 * Projects exact identity entries into target-node SHACL shapes.
 *
 * **Details**
 *
 * Identifier and CURIE properties require exactly one matching literal. Each
 * policy fiber contributes one `minCount: 1` property using its explicit
 * predicate binding.
 *
 * **Example** (Project no identity entries)
 *
 * ```ts
 * import {
 *   DefaultIdentityRdfBinding,
 *   IdentityShapePolicy,
 *   projectShapes
 * } from "@beep/semantic-web"
 * import { Effect } from "effect"
 *
 * const shapes = await Effect.runPromise(
 *   projectShapes(
 *     DefaultIdentityRdfBinding,
 *     IdentityShapePolicy.make({ requiredFibers: [] })
 *   )([])
 * )
 * console.log(shapes.length) // 0
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const projectShapes: {
  (binding: IdentityRdfBinding, policy: IdentityShapePolicy): IdentityShapeProjector;
  (policy: IdentityShapePolicy): (binding: IdentityRdfBinding) => IdentityShapeProjector;
} = dual(
  2,
  (binding: IdentityRdfBinding, policy: IdentityShapePolicy): IdentityShapeProjector =>
    Effect.fn("IdentityShaclProjection.projectShapes")(function* (entries) {
      return yield* Effect.forEach(entries, (entry) =>
        Effect.forEach(policy.requiredFibers, (fiber) =>
          pipe(
            R.get(binding.fiberPaths, fiber),
            O.match({
              onNone: () => Effect.fail(IdentityFiberPathError.make({ fiber })),
              onSome: (path) =>
                Effect.succeed(
                  ShaclPropertyShape.make({
                    path,
                    minCount: O.some(NonNegativeInt.make(1)),
                  })
                ),
            })
          )
        ).pipe(
          Effect.map((fiberProperties) =>
            ShaclNodeShape.make({
              targetNode: O.some(makeNamedNode(entry.iri)),
              properties: pipe(
                fiberProperties,
                A.prepend(
                  ShaclPropertyShape.make({
                    path: binding.curiePath,
                    minCount: O.some(NonNegativeInt.make(1)),
                    maxCount: O.some(NonNegativeInt.make(1)),
                    hasValue: O.some(makeLiteral(entry.curie, XSD_STRING.value)),
                  })
                ),
                A.prepend(
                  ShaclPropertyShape.make({
                    path: binding.identifierPath,
                    minCount: O.some(NonNegativeInt.make(1)),
                    maxCount: O.some(NonNegativeInt.make(1)),
                    hasValue: O.some(makeLiteral(entry.identity, XSD_STRING.value)),
                  })
                )
              ),
            })
          )
        )
      );
    })
);
