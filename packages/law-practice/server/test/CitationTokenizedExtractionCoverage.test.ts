import {
  CitationCleanerValues,
  makeCitationCleanerValues,
} from "@beep/law-practice-server/internal/Citation/CleanerValues";
import { makeCitationDocumentExtraction } from "@beep/law-practice-server/internal/Citation/DocumentExtraction";
import { CitationFrozenEditions } from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import {
  CitationDocumentInputProtocols,
  makeCitationInputDocument,
} from "@beep/law-practice-server/internal/Citation/InputDocument";
import { makeCitationTokenizedExtraction } from "@beep/law-practice-server/internal/Citation/TokenizedExtraction";
import { CitationCleaner } from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { makeCitationTestScaffoldBinding } from "./CitationInvocation.fixtures.ts";
import { setupCitationMetadataRuntime } from "./CitationRegexWorker.fixtures.ts";
import { installCitationTokenizedExtractionFixture } from "./CitationTokenizedExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const refusal = (failure: { readonly _tag: string }) => ({
  _tag: failure._tag,
  detail: "limit" in failure ? failure.limit : "reason" in failure ? failure.reason : undefined,
});
// Installation refuses configuration before capturing any live service, so
// these doubles prove the refusal never reaches them.
const unused = () => Effect.die("installation must refuse before capturing services");
const editions = CitationFrozenEditions.of({ source: unused, lookup: unused, lookupMany: unused });
const protocols = CitationDocumentInputProtocols.of({
  truth: unused,
  containsHtml: unused,
  insertSourceHtml: unused,
  plan: unused,
  warnHtmlAdded: unused(),
});
const cleaner = CitationCleaner.of({
  fromText: unused,
  assertOwned: unused,
  textUnits: unused,
  open: unused,
  contains: unused,
  get: unused,
  callable: unused,
  invoke: unused,
});
const installation = Effect.fnUntraced(function* () {
  const setup = yield* setupCitationMetadataRuntime("bun");
  const values = yield* makeCitationCleanerValues(setup.limits);
  const provided = setup.provided.pipe(
    Context.add(CitationFrozenEditions, editions),
    Context.add(CitationDocumentInputProtocols, protocols),
    Context.add(CitationCleaner, cleaner),
    Context.add(CitationCleanerValues, values)
  );
  return { setup, provided };
});

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("extraction stage installation", (it) => {
  it.effect("refuses tokenizer extraction configuration outside its schema", () =>
    Effect.gen(function* () {
      const { setup, provided } = yield* installation();
      const failure = yield* makeCitationTokenizedExtraction(setup.limits, setup.runtime, {}).pipe(
        Effect.flatMap((stage) =>
          makeCitationTestScaffoldBinding(setup.limits).pipe(
            Effect.map((bind) => ({ ...stage, extract: bind(stage.extract) }))
          )
        ),
        Effect.provideContext(provided),
        DateTime.withCurrentZoneOffset(0),
        Effect.flip
      );
      deepStrictEqual(refusal(failure), {
        _tag: "CitationTokenizedExtractionFailure",
        detail: "invalid-configuration",
      });
    })
  );
  it.effect("refuses live Document extraction configuration outside its schema", () =>
    Effect.gen(function* () {
      const { setup, provided } = yield* installation();
      const failure = yield* makeCitationDocumentExtraction(setup.limits, setup.runtime, { document: {} }).pipe(
        Effect.flatMap((stage) =>
          makeCitationTestScaffoldBinding(setup.limits).pipe(
            Effect.map((bind) => ({ ...stage, extract: bind(stage.extract) }))
          )
        ),
        Effect.provideContext(provided),
        DateTime.withCurrentZoneOffset(0),
        Effect.flip
      );
      deepStrictEqual(refusal(failure), {
        _tag: "CitationDocumentExtractionFailure",
        detail: "invalid-configuration",
      });
    })
  );
  it.effect("refuses input Document geometry configuration outside its schema", () =>
    Effect.gen(function* () {
      const { setup, provided } = yield* installation();
      const failure = yield* makeCitationInputDocument(setup.limits, setup.runtime, { discovery: null }).pipe(
        Effect.flatMap((stage) =>
          makeCitationTestScaffoldBinding(setup.limits).pipe(
            Effect.map((bind) => ({ ...stage, initialize: bind(stage.initialize) }))
          )
        ),
        Effect.provideContext(provided),
        Effect.flip
      );
      deepStrictEqual(refusal(failure), {
        _tag: "CitationDocumentInputFailure",
        detail: "invalid-input",
      });
    })
  );
  it.effect(
    "refuses an extraction request outside the owned Document input schema",
    () =>
      Effect.gen(function* () {
        const { stage } = yield* installCitationTokenizedExtractionFixture("bun");
        const failure = yield* stage.extract({ plain: "not native storage" }).pipe(Effect.flip);
        deepStrictEqual(refusal(failure), { _tag: "CitationTokenizedExtractionFailure", detail: "invalid-input" });
      }),
    { timeout: 60_000 }
  );
});
