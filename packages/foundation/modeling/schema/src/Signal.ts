/**
 * Reasoned absence and typed observations shared by knowledge-layer owners.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { $SchemaId } from "./internal/SchemaId.ts";
import { LiteralKit } from "./LiteralKit/index.ts";

const $I = $SchemaId.create("Signal");

/**
 * Why an observation is absent; no reason denotes a numeric value.
 *
 * **Example** (Check an absence reason)
 *
 * ```ts
 * import { AbsenceReason } from "@beep/schema/Signal"
 * console.log(AbsenceReason.is["legacy-unknown"]("legacy-unknown"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AbsenceReason = LiteralKit(["not-assessed", "unavailable", "not-applicable", "legacy-unknown"]).pipe(
  $I.annoteSchema("AbsenceReason", { description: "The stated reason an observation has no value." })
);

/**
 * Decoded reason for an absent observation.
 *
 * @category models
 * @since 0.0.0
 */
export type AbsenceReason = typeof AbsenceReason.Type;

/**
 * Preserve a supplied value codec inside a present-or-reasoned-absent carrier.
 *
 * **Example** (Construct an absent numeric observation)
 *
 * ```ts
 * import { makeSignal } from "@beep/schema/Signal"
 * import * as S from "effect/Schema"
 *
 * const Reading = makeSignal(S.Finite)
 * console.log(Reading.cases.Absent.make({ reason: "not-assessed" }).reason)
 * ```
 *
 * @param value - The owner's observation codec, including its encoded side.
 * @category factories
 * @since 0.0.0
 */
export const makeSignal = <Value extends S.Top>(value: Value) =>
  S.TaggedUnion({ Present: { value }, Absent: { reason: AbsenceReason } }).pipe(
    $I.annoteSchema("Signal", { description: "An observed value or an explicit reason it is absent." })
  );

const OrdinalLevel = LiteralKit(["low", "moderate", "high"]).pipe(
  $I.annoteSchema("OrdinalLevel", { description: "The ordered labels reported by an ordinal judgment." })
);

/**
 * The Similarity measurement case and its distinct payload.
 *
 * **Example** (Construct a measurement)
 *
 * ```ts
 * import { Similarity } from "@beep/schema/Signal"
 *
 * console.log(Similarity.make({ value: 0.5, metric: "cosine", model: "synthetic/1" }))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class Similarity extends S.Opaque<Similarity, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Similarity", { value: S.Finite, metric: S.NonEmptyString, model: S.NonEmptyString }).pipe(
    $I.annoteSchema("Similarity", { description: "A model's similarity reading under a named metric." })
  )
) {}

/**
 * The ClassifierProbability measurement case and its distinct payload.
 *
 * **Example** (Construct a measurement)
 *
 * ```ts
 * import { ClassifierProbability } from "@beep/schema/Signal"
 *
 * console.log(ClassifierProbability.make({ value: 0.5, model: "synthetic/1", calibrated: false }))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ClassifierProbability extends S.Opaque<ClassifierProbability, { readonly brand: unique symbol }>()(
  S.TaggedStruct("ClassifierProbability", {
    value: S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 })),
    model: S.NonEmptyString,
    calibrated: S.Boolean,
  }).pipe(
    $I.annoteSchema("ClassifierProbability", {
      description: "A classifier probability with its model and explicit calibration claim.",
    })
  )
) {}

/**
 * The OrdinalJudgment measurement case and its distinct payload.
 *
 * **Example** (Construct a measurement)
 *
 * ```ts
 * import { OrdinalJudgment } from "@beep/schema/Signal"
 *
 * console.log(OrdinalJudgment.make({ level: "moderate" }))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class OrdinalJudgment extends S.Opaque<OrdinalJudgment, { readonly brand: unique symbol }>()(
  S.TaggedStruct("OrdinalJudgment", { level: OrdinalLevel }).pipe(
    $I.annoteSchema("OrdinalJudgment", { description: "A reported ordinal level without a numeric coercion." })
  )
) {}

const MeasurementKind = LiteralKit(["Similarity", "ClassifierProbability", "OrdinalJudgment"]).pipe(
  $I.annoteSchema("MeasurementKind", { description: "The distinct contracts for a typed measurement." })
);

/**
 * Keep similarity, classifier probabilities and ordinal judgments distinct.
 *
 * **Example** (Read an ordinal measurement)
 *
 * ```ts
 * import { Measurement } from "@beep/schema/Signal"
 *
 * const reading = Measurement.cases.OrdinalJudgment.make({ level: "moderate" })
 * console.log(reading.level)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Measurement = MeasurementKind.mapMembers(
  Tuple.evolve([() => Similarity, () => ClassifierProbability, () => OrdinalJudgment])
).pipe(
  $I.annoteSchema("Measurement", { description: "A typed measurement whose cases never imply a blended score." }),
  S.toTaggedUnion("_tag")
);

/**
 * Decoded measurement retaining its case-specific attribution.
 *
 * @category models
 * @since 0.0.0
 */
export type Measurement = typeof Measurement.Type;
