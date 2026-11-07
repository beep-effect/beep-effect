/** Original case IDs and normalized operands, without target-derived expectations.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationCanonicalAnnotation");
const Events = S.fromJsonString(
  S.Struct({
    commit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    events: S.Array(
      S.Struct({
        id: S.NonEmptyString,
        test: S.String,
        ordinal: S.Natural,
        normalizedSha256: Sha256Hex,
        payload: S.String,
      })
    ),
  })
);
const Payload = S.fromJsonString(
  S.Struct({
    context: S.Struct({
      values: S.Struct({
        document: S.Struct({ fields: S.Struct({ plain_text: S.String }) }),
        source_text: S.String,
        annotations: S.Array(S.Tuple([S.Tuple([S.Int, S.Int]), S.String, S.String])),
        annotate_kwargs: S.Struct({
          unbalanced_tags: S.optionalKey(S.Literals(["unchecked", "skip", "wrap"])),
          annotator: S.optionalKey(
            S.Struct({ callable: S.tag("tests.test_AnnotateTest.AnnotateTest.test_annotate.<locals>.lower_annotator") })
          ),
        }),
      }),
    }),
    operands: S.Tuple([
      S.Struct({ kind: S.tag("value"), value: S.String }),
      S.Struct({ kind: S.tag("value"), value: S.String }),
    ]),
    passed: S.tag(true),
  })
).pipe(
  $I.annoteSchema("Payload", {
    description:
      "Original annotation-stage input and independently asserted final string; upstream cleaning/extraction stay separately required.",
  })
);
/** Bind each replay input/output to the original assertion identity and bytes.
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const readCitationCanonicalAnnotations = Effect.fn("CanonicalAnnotationTest.read")(function* () {
  const raw = yield* readCitationOracleFixture(
    "assertion-cases",
    "c7ea12ec5ba0d66257affc4c6e54e8b2fa2ffdd0d79f41c1b701000e0edaf33f"
  );
  const all = yield* S.decodeEffect(Events)(raw);
  const rows = A.filter(all.events, (row) => row.test === "tests.test_AnnotateTest.AnnotateTest.test_annotate");
  return yield* Effect.forEach(
    rows,
    Effect.fnUntraced(function* (row) {
      const payload = yield* S.decodeEffect(Payload)(row.payload);
      return {
        id: row.id,
        observationSha256: row.normalizedSha256,
        ordinal: row.ordinal,
        input: payload.context.values,
        expected: payload.operands[1].value,
      };
    })
  );
});
