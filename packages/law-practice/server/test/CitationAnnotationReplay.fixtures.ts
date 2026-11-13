/** Shared real annotation assembly and observation helpers; assertions retained.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { makeCitationAnnotationAssembly } from "@beep/law-practice-server/internal/Citation/AnnotationAssembly";
import { prepareCitationAnnotations } from "@beep/law-practice-server/internal/Citation/AnnotationPreparation";
import { CitationAnnotationSpanProcessor } from "@beep/law-practice-server/internal/Citation/AnnotationSpan";
import { CitationAnnotationTemplateFailure } from "@beep/law-practice-server/internal/Citation/AnnotationTemplate";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { CitationXmlBalance } from "@beep/law-practice-server/internal/Citation/XmlWorker";
import {
  CitationAnnotationReplacement,
  CitationPythonUnicodeStorage,
  CitationTextBudget,
} from "@beep/law-practice-use-cases/server";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";

const $I = $LawPracticeServerId.create("test/CitationAnnotationReplay");
/** @internal @category testing @since 0.0.0 */
export const CitationAnnotationReplayReplacement = S.Struct({
  ...CitationAnnotationReplacement.fields,
  before: CitationNativeUnicodeHex,
  after: CitationNativeUnicodeHex,
}).pipe(
  $I.annoteSchema("CitationAnnotationReplayReplacement", {
    description: "Original primitive replacement with decoded native source words.",
  })
);
/** @internal @category testing @since 0.0.0 */
export type CitationAnnotationReplayReplacement = typeof CitationAnnotationReplayReplacement.Type;
const Check = S.Struct({ text: CitationNativeUnicodeHex, fast: S.Boolean, value: S.Boolean }).pipe(
  $I.annoteSchema("Check", { description: "Original native balance call and its boolean result." })
);
/** @internal @category testing @since 0.0.0 */
export const makeCitationAnnotationXmlTrace = Effect.fn("AnnotationReplayTest.traceXml")(function* (
  worker: CitationXmlBalance["Service"]
) {
  const trace = yield* Ref.make<ReadonlyArray<typeof Check.Type>>([]);
  const xml = CitationXmlBalance.of({
    balance: Effect.fn("AnnotationReplayTest.observeXml")(function* (source) {
      const value = yield* worker.balance(source);
      yield* Ref.update(trace, A.append(Check.make({ text: source, fast: false, value })));
      return value;
    }),
  });
  return { xml, reset: Ref.set(trace, []), snapshot: Ref.get(trace) };
});
/** @internal @category testing @since 0.0.0 */
export const makeCitationAnnotationReplay = Effect.fn("AnnotationReplayTest.assembly")(function* (
  limits: CitationEngineLimits,
  budget: CitationTextBudget["Service"],
  processor?: CitationAnnotationSpanProcessor["Service"]
) {
  const unicode = yield* makeCitationPythonUnicode(limits, "annotate");
  const configured =
    processor === undefined
      ? makeCitationAnnotationAssembly(limits)
      : makeCitationAnnotationAssembly(limits).pipe(Effect.provideService(CitationAnnotationSpanProcessor, processor));
  const assembly = yield* configured.pipe(Effect.provideService(CitationTextBudget, budget));
  const assemble = Effect.fn("AnnotationReplayTest.assemble")(function* (
    raw: CitationNativeUnicodeHex,
    input: ReadonlyArray<CitationAnnotationReplayReplacement>
  ) {
    const source = yield* unicode.fromStorage(raw);
    const replacements = A.map(input, (value) =>
      CitationAnnotationReplacement.make({
        ...value,
        before: CitationPythonUnicodeStorage.make(value.before),
        after: CitationPythonUnicodeStorage.make(value.after),
      })
    );
    const ordered = yield* prepareCitationAnnotations(limits, replacements);
    return yield* assembly.assemble(source, ordered);
  });
  return { assemble };
});
const Outcome = S.TaggedUnion({
  Success: { text: CitationNativeUnicodeHex },
  Failure: { kind: S.Literals(["error", "IndexError"]) },
}).pipe(
  $I.annoteSchema("Outcome", { description: "Original successful native output or invalid-template exception family." })
);
/** @internal @category testing @since 0.0.0 */
export const assertCitationAnnotationOutcome = Effect.fn("AnnotationReplayTest.assertOutcome")(function* <E, R>(
  output: Effect.Effect<CitationPythonUnicodeStorage, E, R>,
  expected: typeof Outcome.Type,
  id: string
) {
  if (expected._tag === "Failure") {
    const error = yield* Effect.flip(output);
    expect(error, id).toEqual(CitationAnnotationTemplateFailure.make({}));
  } else {
    const value = yield* output;
    expect(value, id).toEqual(expected.text);
  }
});
