import { makeCitationRetainedDocumentExtraction } from "@beep/law-practice-server/internal/Citation/DocumentExtraction";
import { it } from "@beep/test-runner";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { installCitationDocumentExtractionFixture } from "./CitationDocumentExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const refusal = (failure: { readonly _tag: string }) => ({
  _tag: failure._tag,
  detail: "limit" in failure ? failure.limit : "reason" in failure ? failure.reason : undefined,
});

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("retained Document extraction refusals", (it) => {
  it.effect(
    "refuses malformed retained requests and owned non-Unicode plain or markup handles before tokenization",
    () =>
      Effect.gen(function* () {
        const installed = yield* installCitationDocumentExtractionFixture("bun");
        const { setup, provided, configuration, values, adapter } = installed;
        const retained = yield* makeCitationRetainedDocumentExtraction(setup.limits, setup.runtime, configuration).pipe(
          Effect.provideContext(provided),
          DateTime.withCurrentZoneOffset(0)
        );
        const malformed = yield* retained.extract({ document: null, removeAmbiguous: false }).pipe(Effect.flip);
        deepStrictEqual(refusal(malformed), { _tag: "CitationDocumentExtractionFailure", detail: "invalid-input" });
        const text = yield* values.sourceText("1 U.S. 1");
        const host = yield* values.retainHost(42);
        const steps = yield* adapter.create({ kind: "list", names: [] });
        const document = (plain: typeof text, markup: typeof text) => ({
          document: { plain, markup, source: plain, steps, geometry: O.none(), cleanerTextUtf16: 0, reservedUnits: 0 },
          removeAmbiguous: false,
        });
        for (const request of [document(host, text), document(text, host)]) {
          const failure = yield* retained.extract(request).pipe(Effect.flip);
          deepStrictEqual(refusal(failure), {
            _tag: "CitationDocumentExtractionFailure",
            detail: "non-unicode-document",
          });
        }
      }),
    { timeout: 60_000 }
  );
});
