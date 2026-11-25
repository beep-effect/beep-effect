/**
 * Bounded SHACL validation layer backing the epistemic claim gate.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $EpistemicServerId } from "@beep/identity/packages";
import { Literal, serializeTerm } from "@beep/rdf/Rdf";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import {
  ShaclValidationResult,
  ShaclValidationService,
  ShaclValidationViolation,
} from "@beep/semantic-web/services/shacl-validation";
import { A } from "@beep/utils";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as I from "effect/Iterable";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import type { Quad, Subject, Term } from "@beep/rdf/Rdf";
import type {
  ShaclNodeShape,
  ShaclPropertyShape,
  ShaclValidationRequest,
  ShaclValidationServiceShape,
} from "@beep/semantic-web/services/shacl-validation";

const $I = $EpistemicServerId.create("ShaclValidation/BoundedShaclValidator.layer");

const emptySubjectKeys: Array<string> = [];
const emptyViolations: Array<ShaclValidationViolation> = [];

/**
 * Builds one `violation`-severity result for the bounded SHACL validator.
 *
 * **Example** (Build a violation)
 *
 * ```ts
 * import { BoundedShaclViolationFactoryLive, BoundedShaclViolationFactory } from "@beep/epistemic-server/ShaclValidation"
 * import type { MakeBoundedShaclViolation } from "@beep/epistemic-server/ShaclValidation"
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * import { makeNamedNode } from "@beep/rdf/Rdf"
 * const program = Effect.gen(function* () {
 *   const make: MakeBoundedShaclViolation = (yield* BoundedShaclViolationFactory).makeViolation
 *   return make("https://example.com/a", makeNamedNode("https://schema.org/name"), "Expected a name.", O.none())
 * }).pipe(Effect.provide(BoundedShaclViolationFactoryLive))
 *
 * console.log(Effect.runSync(program).severity) // "violation"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MakeBoundedShaclViolation = (
  focusNode: string,
  path: ShaclValidationViolation["path"],
  message: string,
  sourceShape: ShaclValidationViolation["sourceShape"]
) => ShaclValidationViolation;

/**
 * Violation constructor seam for the bounded SHACL validator.
 *
 * **Details**
 *
 * The validator builds every violation through this service, so a test layer
 * can observe how many violations a capped request constructs. The live layer
 * builds each one with `ShaclValidationViolation.make`.
 *
 * **Example** (Count constructed violations)
 *
 * ```ts
 * import {
 *   BoundedShaclViolationFactory,
 *   BoundedShaclViolationFactoryLive
 * } from "@beep/epistemic-server/ShaclValidation"
 * import * as Effect from "effect/Effect";
 * import * as Layer from "effect/Layer";
 * import * as MutableRef from "effect/MutableRef";
 * const made = MutableRef.make(0)
 * const Counting = Layer.effect(BoundedShaclViolationFactory)(
 *   Effect.map(BoundedShaclViolationFactory, (live) =>
 *     BoundedShaclViolationFactory.of({
 *       makeViolation: (...args) => {
 *         MutableRef.increment(made)
 *         return live.makeViolation(...args)
 *       },
 *     })
 *   )
 * ).pipe(Layer.provide(BoundedShaclViolationFactoryLive))
 *
 * console.log(Layer.isLayer(Counting)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class BoundedShaclViolationFactory extends Context.Service<
  BoundedShaclViolationFactory,
  { readonly makeViolation: MakeBoundedShaclViolation }
>()($I`BoundedShaclViolationFactory`) {}

/**
 * Live {@link BoundedShaclViolationFactory} built on `ShaclValidationViolation.make`.
 *
 * **Example** (Provide the live factory)
 *
 * ```ts
 * import { BoundedShaclViolationFactoryLive } from "@beep/epistemic-server/ShaclValidation"
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(BoundedShaclViolationFactoryLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const BoundedShaclViolationFactoryLive: Layer.Layer<BoundedShaclViolationFactory> = Layer.succeed(
  BoundedShaclViolationFactory
)({
  makeViolation: (focusNode, path, message, sourceShape) =>
    ShaclValidationViolation.make({
      focusNode,
      path,
      severity: "violation",
      message,
      sourceShape,
    }),
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
  makeViolation: MakeBoundedShaclViolation,
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
  makeViolation: MakeBoundedShaclViolation,
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
  makeViolation: MakeBoundedShaclViolation,
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
        A.filter(
          (quad) => quad.object.termType !== "Literal" || Literal.datatypeOf(quad.object).value !== datatype.value
        ),
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
  makeViolation: MakeBoundedShaclViolation,
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
      minimumCountViolation(makeViolation, shape, propertyShape, focusNode, countedQuads.length),
      maximumCountViolation(makeViolation, shape, propertyShape, focusNode, countedQuads.length),
    ]),
    A.appendAll(datatypeViolations(makeViolation, shape, propertyShape, focusNode, propertyQuads))
  );
};

const subjectViolations = (
  makeViolation: MakeBoundedShaclViolation,
  request: ShaclValidationRequest,
  shape: ShaclNodeShape,
  subjectKey: string
): Iterable<ReadonlyArray<ShaclValidationViolation>> => {
  const subjectQuads = pipe(
    request.dataset.quads,
    A.filter((quad) => serializeTerm(quad.subject) === subjectKey)
  );
  if (!matchesTargetClass(shape, subjectQuads)) return I.empty();
  const focusNode = focusNodeFor(shape, subjectKey, subjectQuads);
  return pipe(
    shape.properties,
    I.map((propertyShape) => propertyViolations(makeViolation, shape, propertyShape, focusNode, subjectQuads))
  );
};

const shapeViolations = (
  makeViolation: MakeBoundedShaclViolation,
  request: ShaclValidationRequest,
  shape: ShaclNodeShape,
  subjectKeys: ReadonlyArray<string>
): Iterable<ReadonlyArray<ShaclValidationViolation>> => {
  const focusSubjectKeys = O.isSome(shape.targetNode) ? [serializeTerm(shape.targetNode.value)] : subjectKeys;
  return pipe(
    focusSubjectKeys,
    I.flatMap((subjectKey) => subjectViolations(makeViolation, request, shape, subjectKey))
  );
};

const validationResult = (
  violationBatches: Iterable<ReadonlyArray<ShaclValidationViolation>>,
  maxResults: ShaclValidationRequest["maxResults"]
): ShaclValidationResult => {
  let violations: Array<ShaclValidationViolation> = emptyViolations;
  for (const batch of violationBatches) {
    violations = pipe(violations, A.appendAll(batch));
    if (violations.length > 0 && O.isSome(maxResults) && violations.length >= maxResults.value) {
      return ShaclValidationResult.make({
        conforms: false,
        violations: pipe(violations, A.take(maxResults.value)),
        truncated: true,
      });
    }
  }
  return ShaclValidationResult.make({
    conforms: violations.length === 0,
    violations,
    truncated: false,
  });
};

/**
 * Bounded SHACL-inspired validation service layer that builds violations
 * through {@link BoundedShaclViolationFactory}.
 *
 * **Details**
 *
 * {@link BoundedShaclValidationServiceLive} is this layer with
 * {@link BoundedShaclViolationFactoryLive} provided.
 *
 * **Example** (Compose over the live factory)
 *
 * ```ts
 * import {
 *   BoundedShaclValidationServiceFromFactory,
 *   BoundedShaclViolationFactoryLive
 * } from "@beep/epistemic-server/ShaclValidation"
 * import * as Layer from "effect/Layer";
 * const layer = BoundedShaclValidationServiceFromFactory.pipe(Layer.provide(BoundedShaclViolationFactoryLive))
 *
 * console.log(Layer.isLayer(layer)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const BoundedShaclValidationServiceFromFactory: Layer.Layer<
  ShaclValidationService,
  never,
  BoundedShaclViolationFactory
> = Layer.effect(ShaclValidationService)(
  Effect.map(BoundedShaclViolationFactory, ({ makeViolation }) =>
    ShaclValidationService.of({
      validate: Effect.fn((request) => {
        const subjectKeys = uniqueSubjectKeys(request.dataset.quads);
        const violations = pipe(
          request.shapes,
          I.flatMap((shape) => shapeViolations(makeViolation, request, shape, subjectKeys))
        );
        return Effect.succeed(validationResult(violations, request.maxResults));
      }),
    } satisfies ShaclValidationServiceShape)
  )
);

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
 * import * as Effect from "effect/Effect";
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
export const BoundedShaclValidationServiceLive: Layer.Layer<ShaclValidationService> =
  BoundedShaclValidationServiceFromFactory.pipe(Layer.provide(BoundedShaclViolationFactoryLive));
