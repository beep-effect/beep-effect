import { WebAnnotationSelector, WebAnnotationTarget } from "@beep/rdf/Adapters/WebAnnotation";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as S from "effect/Schema";

const decodeWebAnnotationSelector = S.decodeEffect(WebAnnotationSelector);
const decodeWebAnnotationTarget = S.decodeUnknownEffect(WebAnnotationTarget);
const encodeWebAnnotationTarget = S.encodeEffect(WebAnnotationTarget);

const SOURCE = "https://example.org/document";

describe("@beep/rdf Web Annotation DTOs", () => {
  it.effect("rejects an encoded Web Annotation selector that violates the DTO schema", () =>
    Effect.gen(function* () {
      const invalid: ReadonlyArray<typeof WebAnnotationSelector.Encoded> = [
        { type: "TextQuoteSelector", exact: "" },
        { type: "TextPositionSelector", start: -1, end: 2 },
      ];
      const failures = yield* Effect.forEach(invalid, (input) => Effect.flip(decodeWebAnnotationSelector(input)), {
        concurrency: 1,
      });
      expect(A.map(failures, (failure) => failure._tag)).toEqual(["SchemaError", "SchemaError"]);
    })
  );

  it.effect("reads one selector or several and writes several back as an array", () =>
    Effect.gen(function* () {
      const selectors = [
        { type: "TextPositionSelector", start: 0, end: 5 },
        { type: "TextQuoteSelector", exact: "quote" },
      ];
      const target = yield* decodeWebAnnotationTarget({ source: SOURCE, selector: selectors });
      expect(A.map(target.selector, (selector) => selector.type)).toEqual([
        "TextPositionSelector",
        "TextQuoteSelector",
      ]);
      const encoded = yield* encodeWebAnnotationTarget(target);
      expect(encoded).toEqual({ source: SOURCE, selector: selectors });
    })
  );

  it.effect.prop(
    "returns every target unchanged after an encode and decode",
    [Arbitrary.schema(WebAnnotationTarget)],
    ([target]) =>
      Effect.gen(function* () {
        const encoded = yield* encodeWebAnnotationTarget(target);
        const decoded = yield* decodeWebAnnotationTarget(encoded);
        expect(decoded.selector.length).toBeGreaterThan(0);
        expect(Equal.equals(decoded, target)).toBe(true);
      }),
    { arbitrary: fcRuns(25) }
  );

  it.effect("refuses a target with no selector", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(decodeWebAnnotationTarget({ source: SOURCE, selector: [] }));
      expect(failure._tag).toBe("SchemaError");
    })
  );
});
