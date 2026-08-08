/**
 * Local SHACL validation adapter backing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import { Effect, Layer, pipe } from "effect";
import * as O from "effect/Option";
import { serializeTerm } from "../rdf.ts";
import {
  ShaclValidationResult,
  ShaclValidationService,
  ShaclValidationViolation,
} from "../services/shacl-validation.ts";
import { RDF_TYPE } from "../vocab/rdf.ts";
import type { Subject, Term } from "../rdf.ts";
import type { ShaclValidationServiceShape } from "../services/shacl-validation.ts";

const emptySubjectKeys: Array<string> = [];
const emptyViolations: Array<ShaclValidationViolation> = [];

const makeViolation = (
  focusNode: string,
  path: ShaclValidationViolation["path"],
  message: string,
  sourceShape: ShaclValidationViolation["sourceShape"]
): ShaclValidationViolation =>
  ShaclValidationViolation.make({
    focusNode,
    path,
    severity: "violation",
    message,
    sourceShape,
  });

const sameTerm = (left: Term, right: Term): boolean => serializeTerm(left) === serializeTerm(right);

const focusNodeValue = (subject: Subject): string =>
  subject.termType === "NamedNode" ? subject.value : serializeTerm(subject);

/**
 * Bounded SHACL-inspired validation service live layer.
 *
 * **Example** (Validate empty dataset)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { BoundedShaclValidationServiceLive } from "@beep/semantic-web/adapters/shacl-engine"
 * import {
 *   ShaclValidationRequest,
 *   ShaclValidationService
 * } from "@beep/semantic-web/services/shacl-validation"
 *
 * const request = S.decodeUnknownSync(ShaclValidationRequest)({
 *   dataset: { quads: [] },
 *   shapes: []
 * })
 * const result = Effect.runSync(
 *   Effect.gen(function* () {
 *     const service = yield* ShaclValidationService
 *     return yield* service.validate(request)
 *   }).pipe(Effect.provide(BoundedShaclValidationServiceLive))
 * )
 * strictEqual(result.conforms, true)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const BoundedShaclValidationServiceLive = Layer.succeed(
  ShaclValidationService,
  ShaclValidationService.of({
    validate: Effect.fn((request) => {
      let violations: Array<ShaclValidationViolation> = emptyViolations;
      const subjectKeys = pipe(
        request.dataset.quads,
        A.reduce(emptySubjectKeys, (keys, quad) => {
          const subjectKey = serializeTerm(quad.subject);
          return pipe(keys, A.contains(subjectKey)) ? keys : pipe(keys, A.append(subjectKey));
        })
      );

      for (const shape of request.shapes) {
        const focusSubjectKeys = O.isSome(shape.targetNode) ? [serializeTerm(shape.targetNode.value)] : subjectKeys;
        for (const subjectKey of focusSubjectKeys) {
          const subjectQuads = pipe(
            request.dataset.quads,
            A.filter((quad) => serializeTerm(quad.subject) === subjectKey)
          );
          const focusNode = pipe(
            A.head(subjectQuads),
            O.map((quad) => focusNodeValue(quad.subject)),
            O.getOrElse(() => (O.isSome(shape.targetNode) ? shape.targetNode.value.value : subjectKey))
          );
          const targetClassMatches = pipe(
            shape.targetClass,
            O.map((targetClass) =>
              pipe(
                subjectQuads,
                A.some(
                  (quad) =>
                    quad.predicate.value === RDF_TYPE.value &&
                    quad.object.termType === "NamedNode" &&
                    quad.object.value === targetClass.value
                )
              )
            ),
            O.getOrElse(() => true)
          );

          if (!targetClassMatches) {
            continue;
          }

          for (const propertyShape of shape.properties) {
            const propertyQuads = pipe(
              subjectQuads,
              A.filter((quad) => quad.predicate.value === propertyShape.path.value)
            );
            const countedPropertyQuads = pipe(
              propertyShape.hasValue,
              O.map((hasValue) =>
                pipe(
                  propertyQuads,
                  A.filter((quad) => sameTerm(quad.object, hasValue))
                )
              ),
              O.getOrElse(() => propertyQuads)
            );

            if (O.isSome(propertyShape.minCount) && countedPropertyQuads.length < propertyShape.minCount.value) {
              violations = pipe(
                violations,
                A.append(
                  makeViolation(
                    focusNode,
                    propertyShape.path,
                    O.isSome(propertyShape.hasValue)
                      ? `Expected value ${serializeTerm(propertyShape.hasValue.value)} for ${propertyShape.path.value}.`
                      : `Expected at least ${propertyShape.minCount.value} value(s) for ${propertyShape.path.value}.`,
                    shape.id
                  )
                )
              );
            }

            if (O.isSome(propertyShape.maxCount) && countedPropertyQuads.length > propertyShape.maxCount.value) {
              violations = pipe(
                violations,
                A.append(
                  makeViolation(
                    focusNode,
                    propertyShape.path,
                    `Expected at most ${propertyShape.maxCount.value} value(s) for ${propertyShape.path.value}.`,
                    shape.id
                  )
                )
              );
            }

            if (O.isSome(propertyShape.datatype)) {
              for (const quad of propertyQuads) {
                if (
                  quad.object.termType !== "Literal" ||
                  quad.object.datatype.value !== propertyShape.datatype.value.value
                ) {
                  violations = pipe(
                    violations,
                    A.append(
                      makeViolation(
                        focusNode,
                        propertyShape.path,
                        `Expected datatype ${propertyShape.datatype.value.value} for ${propertyShape.path.value}.`,
                        shape.id
                      )
                    )
                  );
                }
              }
            }

            if (O.isSome(request.maxResults) && violations.length >= request.maxResults.value) {
              return Effect.succeed(
                ShaclValidationResult.make({
                  conforms: false,
                  violations: pipe(violations, A.take(request.maxResults.value)),
                  truncated: true,
                })
              );
            }
          }
        }
      }

      return Effect.succeed(
        ShaclValidationResult.make({
          conforms: violations.length === 0,
          violations,
          truncated: false,
        })
      );
    }),
  } satisfies ShaclValidationServiceShape)
);

/**
 * Backward-compatible alias for the bounded v1 SHACL adapter.
 *
 * **Example** (Validate with alias layer)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { ShaclValidationServiceLive } from "@beep/semantic-web/adapters/shacl-engine"
 * import {
 *   ShaclValidationRequest,
 *   ShaclValidationService
 * } from "@beep/semantic-web/services/shacl-validation"
 *
 * const request = S.decodeUnknownSync(ShaclValidationRequest)({
 *   dataset: { quads: [] },
 *   shapes: []
 * })
 * const result = Effect.runSync(
 *   Effect.gen(function* () {
 *     const service = yield* ShaclValidationService
 *     return yield* service.validate(request)
 *   }).pipe(Effect.provide(ShaclValidationServiceLive))
 * )
 * strictEqual(result.truncated, false)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ShaclValidationServiceLive = BoundedShaclValidationServiceLive;
