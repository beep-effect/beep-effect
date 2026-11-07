/** Domain mapping between schema edit steps and the fixed-endian native ABI.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as S from "effect/Schema";
import { CitationDiffWorkerFailure, citationDiffOutputByteCapacity } from "./DiffWorkerProtocol.ts";
import { CitationSpanDiffStep, measureCitationSpanDiffSteps } from "./SpanOffsets.ts";

const $I = $LawPracticeServerId.create("internal/Citation/DiffSteps");
const Operations = LiteralKit(["-", "+", "="]).pipe(
  $I.annoteSchema("Operations", { description: "Unchanged native DMP DELETE, INSERT and EQUAL code order." })
);
const code = Match.type<CitationSpanDiffStep["operation"]>().pipe(
  Match.when("-", () => 0),
  Match.when("+", () => 1),
  Match.when("=", () => 2),
  Match.exhaustive
);
const invalid = () => CitationDiffWorkerFailure.make({ reason: "invalid-frame" });
/** Complete response preflight precedes the packed byte-buffer allocation.
 * @internal @category operations @since 0.0.0
 */
export const packCitationDiffSteps = Effect.fn("Citation.packDiffSteps")(function* (
  steps: ReadonlyArray<CitationSpanDiffStep>,
  maximum: number
) {
  const capacity = yield* citationDiffOutputByteCapacity(maximum);
  if (8 * steps.length > capacity)
    return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "processMessageBytes" });
  const bytes = new Uint8Array(8 * steps.length);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < steps.length; index++) {
    if (index % 256 === 0) yield* Effect.yieldNow;
    const step = A.getUnsafe(steps, index);
    view.setUint32(index * 8, code(step.operation), true);
    view.setUint32(index * 8 + 4, step.amount, true);
  }
  return bytes;
});
/** Decode only a complete bounded result; check native code/count values and
 * original consumed/emitted lengths before returning any steps.
 * @internal @category operations @since 0.0.0
 */
export const unpackCitationDiffSteps = Effect.fn("Citation.unpackDiffSteps")(function* (
  bytes: Uint8Array,
  maximumSteps: number,
  beforeLength: number,
  afterLength: number
) {
  if (bytes.byteLength % 8 !== 0) return yield* invalid();
  const count = bytes.byteLength / 8;
  if (count > maximumSteps)
    return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "diffSteps" });
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const steps = A.empty<CitationSpanDiffStep>();
  for (let index = 0; index < count; index++) {
    if (index % 256 === 0) yield* Effect.yieldNow;
    const operation = yield* A.get(Operations.literals, view.getUint32(index * 8, true)).pipe(
      Effect.fromOption,
      Effect.mapError(invalid)
    );
    const step = yield* S.decodeEffect(CitationSpanDiffStep)({
      operation,
      amount: view.getUint32(index * 8 + 4, true),
    }).pipe(Effect.mapError(invalid));
    steps.push(step);
  }
  const measured = yield* measureCitationSpanDiffSteps(steps);
  if (measured.consumed !== beforeLength || measured.emitted !== afterLength) return yield* invalid();
  return steps;
});
