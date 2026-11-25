/**
 * Total owner-defined assessment coordinates and codec-checked, no-op refusals.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicsId } from "@beep/identity/packages";
import { AbsenceReason } from "@beep/schema/Signal";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";
import type * as Order from "effect/Order";
import type { FieldSchema, SchemaIdentity } from "./Factory/index.ts";

const $I = $EpistemicsId.create("Assessments");

const assessment = <V extends S.Top>(value: V) => {
  const field: S.Codec<V["Type"], V["Encoded"], V["DecodingServices"], V["EncodingServices"]> = value;
  return S.TaggedUnion({ Assessed: { value: field }, Unassessed: { reason: AbsenceReason } }).pipe(
    $I.annoteSchema("Assessment", { description: "A decoded coordinate observation, or its explicit absence reason." })
  );
};

interface AssessmentLambda extends Struct.Lambda {
  readonly "~lambda.out": this["~lambda.in"] extends S.Top ? ReturnType<typeof assessment<this["~lambda.in"]>> : never;
  <V extends S.Top>(value: V): ReturnType<typeof assessment<V>>;
}

const assessmentLambda = Struct.lambda<AssessmentLambda>(assessment);
const AssessedView = S.TaggedStruct("Assessed", { value: S.Unknown });
const isAssessed = S.is(AssessedView);

/**
 * A total struct of owner-declared observation codecs.
 *
 * **Example** (Reject a missing coordinate)
 *
 * ```ts
 * import { makeAssessments } from "@beep/epistemics/Assessments"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 * const Coordinates = makeAssessments({ $I: $ScratchpadId.create("Checks"), coordinates: { score: S.Int } })
 * console.log(S.is(Coordinates)({}))
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const makeAssessments = <const Coords extends R.ReadonlyRecord<string, S.Top>>(options: {
  readonly $I: SchemaIdentity;
  readonly coordinates: Coords;
}) =>
  S.Struct(Struct.map(options.coordinates, assessmentLambda)).pipe(
    options.$I.annoteSchema("Assessments", {
      description: "Every declared coordinate is present; unknown is never a passing observation.",
    })
  );

/**
 * The decoded total coordinate record, derived from the owner's schemas.
 *
 * @category models
 * @since 0.0.0
 */
export type AssessmentsOf<Coords extends R.ReadonlyRecord<string, S.Top>> = ReturnType<
  typeof makeAssessments<Coords>
>["Type"];

/**
 * An owner policy with an explicit version, required coordinates and per-coordinate orders.
 *
 * **Example** (Describe a gate contract)
 *
 * ```ts
 * import type { Gate } from "@beep/epistemics/Assessments"
 * import * as S from "effect/Schema"
 * const nameOf = (gate: Gate<{ readonly score: typeof S.Int }>) => gate.name
 * console.log(typeof nameOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface Gate<Coords extends R.ReadonlyRecord<string, S.Top>> {
  readonly name: string;
  readonly order: { readonly [K in keyof Coords]: Order.Order<Coords[K]["Type"]> };
  readonly passes: (record: AssessmentsOf<Coords>) => boolean;
  readonly requiredCoordinates: HashSet.HashSet<keyof Coords & string>;
  readonly version: string;
}

/**
 * A sanitized malformed-coordinate refusal, without carrying sensitive input.
 *
 * **Example** (Describe a failed coordinate decode)
 *
 * ```ts
 * import { InvalidAssessment } from "@beep/epistemics/Assessments"
 * console.log(InvalidAssessment.make({ coordinate: "score", issue: "Value does not match the declared codec." }).coordinate)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class InvalidAssessment extends S.Opaque<InvalidAssessment, { readonly brand: unique symbol }>()(
  S.TaggedStruct("InvalidAssessment", { coordinate: S.NonEmptyString, issue: S.NonEmptyString }).pipe(
    $I.annoteSchema("InvalidAssessment", {
      description: "A sanitized coordinate decode failure; no record was replaced.",
    })
  )
) {}

/**
 * Decode each encoded update through its owner's coordinate codec before evaluating a gate.
 *
 * **Details**
 * Malformed values and refused gates return the original record. Required coordinates
 * must be declared, and every coordinate must be assessed before the predicate runs.
 * Decoding service requirements of each coordinate remain on its update arrow.
 *
 * **Example** (Bind a coordinate updater)
 *
 * ```ts
 * import { makeAssessmentArrows } from "@beep/epistemics/Assessments"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 * const arrows = makeAssessmentArrows({ $I: $ScratchpadId.create("Checks"), coordinates: { score: S.Int } })
 * console.log(typeof arrows.updateAssessment)
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const makeAssessmentArrows = <const Coords extends R.ReadonlyRecord<string, S.Top>>(options: {
  readonly $I: SchemaIdentity;
  readonly coordinates: Coords;
}) => {
  const Assessments = makeAssessments(options);
  const State: FieldSchema<typeof Assessments.Type, typeof Assessments.Type, (typeof Assessments)["~type.make.in"]> =
    S.toType(Assessments);
  const UpdateResult = S.TaggedUnion({
    Updated: { record: State },
    Invalid: { record: State, refusal: InvalidAssessment },
    Refused: { record: State },
  }).pipe(
    options.$I.annoteSchema("AssessmentUpdate", {
      description: "A coordinate replacement or refusal preserving the original record.",
    })
  );
  const decodeState = S.decodeUnknownEffect(S.toType(Assessments));
  const updateAssessment = Effect.fn("Assessments.update")(function* <K extends keyof Coords & string>(update: {
    readonly record: typeof Assessments.Type;
    readonly coordinate: K;
    readonly input: unknown;
    readonly gate: Gate<Coords>;
  }): Effect.fn.Return<typeof UpdateResult.Type, never, Coords[K]["DecodingServices"]> {
    const { record, coordinate, input, gate } = update;
    const decoded = yield* S.decodeUnknownEffect(Struct.get(options.coordinates, coordinate))(input).pipe(
      Effect.result
    );
    if (Result.isFailure(decoded)) {
      return {
        _tag: "Invalid",
        record,
        refusal: InvalidAssessment.make({
          coordinate,
          issue: "Value does not match the declared codec.",
        }),
      };
    }
    const candidate: unknown = { ...record, [coordinate]: { _tag: "Assessed", value: decoded.success } };
    const next = yield* decodeState(candidate).pipe(Effect.orDie);
    if (
      !HashSet.every(gate.requiredCoordinates, (required) => R.has(options.coordinates, required)) ||
      !A.every(R.values(next), isAssessed) ||
      !gate.passes(next)
    ) {
      return { _tag: "Refused", record };
    }
    return { _tag: "Updated", record: next };
  });
  return { Assessments, UpdateResult, updateAssessment };
};
