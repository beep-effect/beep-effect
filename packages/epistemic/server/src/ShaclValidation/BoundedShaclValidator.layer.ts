/**
 * Bounded SHACL validation layer backing the epistemic claim gate.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { serializeTerm } from "@beep/rdf/Rdf";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import {
  ShaclValidationResult,
  ShaclValidationService,
  ShaclValidationViolation,
} from "@beep/semantic-web/services/shacl-validation";
import { A } from "@beep/utils";
import { Effect, flow, Layer, pipe } from "effect";
import * as O from "effect/Option";
import type { Quad, Subject, Term } from "@beep/rdf/Rdf";
import type {
  ShaclNodeShape,
  ShaclPropertyShape,
  ShaclValidationRequest,
  ShaclValidationServiceShape,
} from "@beep/semantic-web/services/shacl-validation";

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

const uniqueSubjectKeys = flow(
  A.reduce(emptySubjectKeys, (keys, quad: Quad) => {
    const subjectKey = serializeTerm(quad.subject);
    return pipe(keys, A.contains(subjectKey)) ? keys : pipe(keys, A.append(subjectKey));
  })
);

const focusNodeFor = (shape: ShaclNodeShape, subjectKey: string, subjectQuads: ReadonlyArray<Quad>): string =>
  pipe(
    A.head(subjectQuads),
    O.map((quad) => focusNodeValue(quad.subject)),
    O.getOrElse(() => (O.isSome(shape.targetNode) ? shape.targetNode.value.value : subjectKey))
  );

const matchesTargetClass = (shape: ShaclNodeShape, subjectQuads: ReadonlyArray<Quad>): boolean =>
  pipe(
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

const minimumCountViolation = (
  shape: ShaclNodeShape,
  propertyShape: ShaclPropertyShape,
  focusNode: string,
  count: number
): O.Option<ShaclValidationViolation> =>
  pipe(
    propertyShape.minCount,
    O.filter((minCount) => count < minCount),
    O.map((minCount) =>
      makeViolation(
        focusNode,
        propertyShape.path,
        O.isSome(propertyShape.hasValue)
          ? `Expected value ${serializeTerm(propertyShape.hasValue.value)} for ${propertyShape.path.value}.`
          : `Expected at least ${minCount} value(s) for ${propertyShape.path.value}.`,
        shape.id
      )
    )
  );

const maximumCountViolation = (
  shape: ShaclNodeShape,
  propertyShape: ShaclPropertyShape,
  focusNode: string,
  count: number
): O.Option<ShaclValidationViolation> =>
  pipe(
    propertyShape.maxCount,
    O.filter((maxCount) => count > maxCount),
    O.map((maxCount) =>
      makeViolation(
        focusNode,
        propertyShape.path,
        `Expected at most ${maxCount} value(s) for ${propertyShape.path.value}.`,
        shape.id
      )
    )
  );

const datatypeViolations = (
  shape: ShaclNodeShape,
  propertyShape: ShaclPropertyShape,
  focusNode: string,
  propertyQuads: ReadonlyArray<Quad>
): ReadonlyArray<ShaclValidationViolation> =>
  pipe(
    propertyShape.datatype,
    O.map((datatype) =>
      pipe(
        propertyQuads,
        A.filter((quad) => quad.object.termType !== "Literal" || quad.object.datatype.value !== datatype.value),
        A.map(() =>
          makeViolation(
            focusNode,
            propertyShape.path,
            `Expected datatype ${datatype.value} for ${propertyShape.path.value}.`,
            shape.id
          )
        )
      )
    ),
    O.getOrElse(() => emptyViolations)
  );

const propertyViolations = (
  shape: ShaclNodeShape,
  propertyShape: ShaclPropertyShape,
  focusNode: string,
  subjectQuads: ReadonlyArray<Quad>
): ReadonlyArray<ShaclValidationViolation> => {
  const propertyQuads = pipe(
    subjectQuads,
    A.filter((quad) => quad.predicate.value === propertyShape.path.value)
  );
  const countedQuads = pipe(
    propertyShape.hasValue,
    O.map((hasValue) =>
      pipe(
        propertyQuads,
        A.filter((quad) => sameTerm(quad.object, hasValue))
      )
    ),
    O.getOrElse(() => propertyQuads)
  );
  return pipe(
    A.getSomes([
      minimumCountViolation(shape, propertyShape, focusNode, countedQuads.length),
      maximumCountViolation(shape, propertyShape, focusNode, countedQuads.length),
    ]),
    A.appendAll(datatypeViolations(shape, propertyShape, focusNode, propertyQuads))
  );
};

const subjectViolations = (
  request: ShaclValidationRequest,
  shape: ShaclNodeShape,
  subjectKey: string
): ReadonlyArray<ShaclValidationViolation> => {
  const subjectQuads = pipe(
    request.dataset.quads,
    A.filter((quad) => serializeTerm(quad.subject) === subjectKey)
  );
  if (!matchesTargetClass(shape, subjectQuads)) return emptyViolations;
  const focusNode = focusNodeFor(shape, subjectKey, subjectQuads);
  return pipe(
    shape.properties,
    A.flatMap((propertyShape) => propertyViolations(shape, propertyShape, focusNode, subjectQuads))
  );
};

const shapeViolations = (
  request: ShaclValidationRequest,
  shape: ShaclNodeShape,
  subjectKeys: ReadonlyArray<string>
): ReadonlyArray<ShaclValidationViolation> => {
  const focusSubjectKeys = O.isSome(shape.targetNode) ? [serializeTerm(shape.targetNode.value)] : subjectKeys;
  return pipe(
    focusSubjectKeys,
    A.flatMap((subjectKey) => subjectViolations(request, shape, subjectKey))
  );
};

const validationResult = (
  violations: ReadonlyArray<ShaclValidationViolation>,
  maxResults: ShaclValidationRequest["maxResults"]
): ShaclValidationResult => {
  const truncated = O.isSome(maxResults) && violations.length >= maxResults.value;
  return ShaclValidationResult.make({
    conforms: violations.length === 0,
    violations: O.isSome(maxResults) ? pipe(violations, A.take(maxResults.value)) : violations,
    truncated,
  });
};

/**
 * Bounded SHACL-inspired validation service live layer.
 *
 * **Details**
 *
 * A deliberately minimal validator (target class, `minCount`, `maxCount`,
 * `datatype`, `hasValue`) that keeps the epistemic claim gate dependency-free.
 * It is not a full SHACL engine; the general-purpose `shacl-engine`-backed
 * implementation lives in the `@beep/shacl` driver.
 *
 * **Example** (Validate empty dataset)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { BoundedShaclValidationServiceLive } from "@beep/epistemic-server/ShaclValidation"
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
      const subjectKeys = uniqueSubjectKeys(request.dataset.quads);
      const violations = pipe(
        request.shapes,
        A.flatMap((shape) => shapeViolations(request, shape, subjectKeys))
      );
      return Effect.succeed(validationResult(violations, request.maxResults));
    }),
  } satisfies ShaclValidationServiceShape)
);
