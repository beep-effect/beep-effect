/**
 * Projection from exact identity entries into bounded SHACL node shapes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SemanticWebId } from "@beep/identity/packages";
import { makeLiteral } from "@beep/rdf/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { NonNegativeInt } from "@beep/schema";
import { Effect, HashSet, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { ShaclNodeShape, ShaclPropertyShape } from "../services/shacl-validation.ts";
import { decodeEntrySubject, IdentityFiberPathError } from "./IdentityRdfBinding.ts";
import type { IdentityEntry } from "@beep/identity";
import type { NamedNode } from "@beep/rdf/Rdf";
import type { IdentityEntryIriError, IdentityRdfBinding } from "./IdentityRdfBinding.ts";

const $I = $SemanticWebId.create("identity/IdentityShaclProjection");

type IdentityShapeProjector = (
  entries: ReadonlyArray<IdentityEntry>
) => Effect.Effect<ReadonlyArray<ShaclNodeShape>, IdentityEntryIriError | IdentityFiberPathError>;

const duplicateRequiredFiber = (requiredFibers: ReadonlyArray<string>): O.Option<string> => {
  let seen = HashSet.empty<string>();

  for (const fiber of requiredFibers) {
    if (HashSet.has(seen, fiber)) {
      return O.some(fiber);
    }
    seen = HashSet.add(seen, fiber);
  }

  return O.none();
};

const IdentityRequiredFibersDistinct = S.makeFilter<ReadonlyArray<string>>(
  (requiredFibers) =>
    pipe(
      duplicateRequiredFiber(requiredFibers),
      O.match({
        onNone: () => true,
        onSome: (duplicate) => `Required identity fiber '${duplicate}' appears more than once.`,
      })
    ),
  {
    identifier: $I`IdentityRequiredFibersDistinct`,
    title: "Distinct Required Identity Fibers",
    description: "Requires every named identity fiber in a SHACL projection policy to be unique.",
    message: "Required identity fibers must be unique.",
  }
);

const RequiredIdentityFibers = S.Array(S.String).pipe(S.check(IdentityRequiredFibersDistinct));

const addressPropertyShapes = (path: NamedNode, value: string): ReadonlyArray<ShaclPropertyShape> => [
  ShaclPropertyShape.make({
    path,
    minCount: O.some(NonNegativeInt.make(1)),
    maxCount: O.some(NonNegativeInt.make(1)),
  }),
  ShaclPropertyShape.make({
    path,
    minCount: O.some(NonNegativeInt.make(1)),
    hasValue: O.some(makeLiteral(value, XSD_STRING.value)),
  }),
];

/**
 * Data policy selecting the identity fibers required by projected SHACL shapes.
 *
 * **Example** (Require a label fiber)
 *
 * ```ts import.meta.vitest name="Require a label fiber"
 * import { IdentityShapePolicy } from "@beep/semantic-web"
 *
 * const policy = IdentityShapePolicy.make({ requiredFibers: ["label"] })
 * policy.requiredFibers // => ["label"]
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export class IdentityShapePolicy extends S.Class<IdentityShapePolicy>($I`IdentityShapePolicy`)(
  { requiredFibers: RequiredIdentityFibers },
  $I.annote("IdentityShapePolicy", {
    description: "Named identity fibers that every projected node shape requires.",
  })
) {}

/**
 * Projects exact identity entries into target-node SHACL shapes.
 *
 * **Details**
 *
 * Identifier and CURIE properties each use one cardinality shape and one
 * expected-value shape. Each policy fiber contributes one `minCount: 1`
 * property using its explicit predicate binding.
 *
 * **Example** (Project no identity entries)
 *
 * ```ts import.meta.vitest name="Project no identity entries"
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
 * shapes.length // => 0
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
      return yield* Effect.forEach(
        entries,
        Effect.fnUntraced(function* (entry) {
          const targetNode = yield* decodeEntrySubject(entry);
          const fiberProperties = yield* Effect.forEach(policy.requiredFibers, (fiber) =>
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
          );

          return ShaclNodeShape.make({
            targetNode: O.some(targetNode),
            properties: pipe(
              addressPropertyShapes(binding.identifierPath, entry.identity),
              A.appendAll(addressPropertyShapes(binding.curiePath, entry.curie)),
              A.appendAll(fiberProperties)
            ),
          });
        })
      );
    })
);
