import * as Root from "@beep/law-practice-use-cases";
import * as Public from "@beep/law-practice-use-cases/public";
import {
  CitationAnnotationError,
  CitationEngineFailure,
  CitationEngineOperation,
  CitationInputError,
  CitationOperationUnsupported,
  CitationPrerequisiteError,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const Json = S.fromJsonString(CitationEngineFailure);
it.effect("publishes exactly the closed server failure families and roundtrips their declared data", () =>
  Effect.gen(function* () {
    const failures = [
      CitationInputError.make({ operation: "extract" }),
      CitationPrerequisiteError.make({ operation: "extract", dependency: "source-evidence" }),
      CitationSafetyLimitExceeded.make({ operation: "clean", limit: "nativeHtmlParserResource" }),
      CitationAnnotationError.make({}),
      CitationOperationUnsupported.make({ operation: "annotate" }),
    ];
    for (const failure of failures) {
      const encoded = yield* S.encodeEffect(Json)(failure);
      const decoded = yield* S.decodeEffect(Json)(encoded);
      expect(decoded).toEqual(failure);
    }
    expect(CitationEngineOperation.literals).toEqual(["clean", "extract", "resolve", "annotate"]);
    expect(S.is(CitationEngineFailure)({ _tag: "NativeFailure", operation: "extract" })).toBe(false);
    expect(S.is(CitationEngineFailure)({ _tag: "CitationInputError", operation: "arbitrary" })).toBe(false);
    expect(S.is(CitationEngineFailure)({ status: "Unresolved" })).toBe(false);
  })
);
it.effect("keeps the failure and operation contracts out of root and client surfaces", () =>
  Effect.sync(() => {
    for (const name of [
      "CitationEngineFailure",
      "CitationInputError",
      "CitationPrerequisiteError",
      "CitationAnnotationError",
      "CitationOperationUnsupported",
      "CitationSafetyLimitExceeded",
      "CitationEngineOperation",
    ]) {
      expect(name in Root).toBe(false);
      expect(name in Public).toBe(false);
    }
  })
);
