/** Actual owned Document initialization through the complete native extraction path.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationCleanerProtocols } from "@beep/law-practice-server/internal/Citation/CleanerRegistry";
import { makeCitationCleanerValues } from "@beep/law-practice-server/internal/Citation/CleanerValues";
import {
  CitationDocumentExtractionConfiguration,
  makeCitationDocumentExtraction,
  makeCitationRetainedDocumentExtraction,
} from "@beep/law-practice-server/internal/Citation/DocumentExtraction";
import { makeCitationDocumentServices } from "@beep/law-practice-server/internal/Citation/DocumentServices";
import { CitationDocumentInputProtocols } from "@beep/law-practice-server/internal/Citation/InputDocument";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { makeCitationDiffTestRuntime } from "./CitationDiffWorker.fixtures.ts";
import { citationPrimitiveCleanerProtocols } from "./CitationDocumentServices.fixtures.ts";
import { makeCitationTestInvocationBinding } from "./CitationInvocation.fixtures.ts";
import { makeCitationHtmlTestRuntime } from "./CitationNativeSpawner.fixtures.ts";
import { assertCitationWorkerCompositionObserved } from "./CitationRegexWorker.fixtures.ts";
import {
  assertCitationTokenizedExtractionRow,
  installCitationTokenizedExtractionFixture,
} from "./CitationTokenizedExtraction.fixtures.ts";
import type { CitationInvocation } from "@beep/law-practice-server/internal/Citation/Invocation";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import type { setupCitationMetadataRuntime } from "./CitationRegexWorker.fixtures.ts";

type Installed = Effect.Success<ReturnType<typeof installCitationTokenizedExtractionFixture>>;
const documentRequest = Effect.fn("DocumentExtractionTest.request")(function* (
  values: Effect.Success<ReturnType<typeof makeCitationDocumentServices>>["values"],
  adapter: Effect.Success<ReturnType<typeof makeCitationDocumentServices>>["adapter"],
  row: Installed["corpus"]["cases"][number]
) {
  const hasMarkup = row.markup.bytes.length > 0;
  const plain = hasMarkup ? yield* values.sourceText("") : yield* values.sourceUnicode(row.plain);
  const markup = hasMarkup ? yield* values.sourceUnicode(row.markup) : yield* values.retainHost(null);
  const steps = yield* adapter.create({ kind: "list", names: hasMarkup ? ["html"] : [] });
  return { plain, markup, steps, source: hasMarkup ? markup : plain, removeAmbiguous: row.removeAmbiguous };
});
/** Prepare caller-scoped document runtimes and services without constructing replay stages.
 *
 * **Example** (Preparing services for an existing runtime)
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { installCitationDocumentRuntimeFixture } from "./CitationDocumentExtraction.fixtures.ts";
 * import { setupCitationMetadataRuntime } from "./CitationRegexWorker.fixtures.ts";
 *
 * const prepared = Effect.gen(function* () {
 *   const setup = yield* setupCitationMetadataRuntime("bun");
 *   return yield* installCitationDocumentRuntimeFixture("bun", setup);
 * });
 * ```
 * @internal @category testing @since 0.0.0
 */
export const installCitationDocumentRuntimeFixture = Effect.fn("DocumentExtractionTest.runtime")(function* <Services>(
  kind: CitationNativeRuntimeKind,
  setup: Pick<Effect.Success<ReturnType<typeof setupCitationMetadataRuntime>>, "limits"> & {
    readonly provided: Context.Context<Services>;
  }
) {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "citation-extract-document-" });
  const diffRuntime = yield* makeCitationDiffTestRuntime(kind, directory);
  const htmlDirectory = yield* fs.makeTempDirectoryScoped({ prefix: "citation-extract-document-html-" });
  const htmlRuntime = yield* makeCitationHtmlTestRuntime(kind, htmlDirectory);
  const services = yield* makeCitationDocumentServices(setup.limits, htmlRuntime).pipe(
    Effect.provideContext(setup.provided),
    Effect.provideService(CitationCleanerProtocols, citationPrimitiveCleanerProtocols)
  );
  const provided = Context.merge(setup.provided, services.context);
  return { diffRuntime, provided, adapter: services.adapter, values: services.values };
});
/** Install original live input services with the complete authenticated catalog. */
export const installCitationDocumentExtractionFixture = Effect.fn("DocumentExtractionTest.install")(function* (
  kind: CitationNativeRuntimeKind
) {
  const { corpus, setup, configuration, translated, discovery } =
    yield* installCitationTokenizedExtractionFixture(kind);
  const { diffRuntime, provided, adapter, values } = yield* installCitationDocumentRuntimeFixture(kind, setup);
  const documentConfiguration = CitationDocumentExtractionConfiguration.make({
    document: { discovery, diffRuntime },
    extraction: configuration,
  });
  const stage = yield* makeCitationDocumentExtraction(setup.limits, setup.runtime, documentConfiguration).pipe(
    Effect.flatMap((stage) =>
      makeCitationTestInvocationBinding(setup.limits).pipe(
        Effect.map((bind) => ({ ...stage, extract: bind(stage.extract) }))
      )
    ),
    Effect.provideContext(provided),
    DateTime.withCurrentZoneOffset(0)
  );
  return {
    corpus,
    setup,
    configuration: documentConfiguration,
    translated,
    provided,
    adapter,
    values,
    stage,
  };
});
const unexpectedInitialization = () => Effect.die("retained document must not initialize again");
const retainedProtocols = CitationDocumentInputProtocols.of({
  truth: unexpectedInitialization,
  containsHtml: unexpectedInitialization,
  insertSourceHtml: unexpectedInitialization,
  plan: unexpectedInitialization,
  warnHtmlAdded: unexpectedInitialization(),
});
const replayRetained = Effect.fnUntraced(function* (
  installed: Effect.Success<ReturnType<typeof installCitationDocumentExtractionFixture>>,
  document: Effect.Success<ReturnType<typeof installed.stage.extract>>["document"],
  row: Installed["corpus"]["cases"][number]
) {
  const { setup, provided, configuration, translated } = installed;
  const retained = yield* makeCitationRetainedDocumentExtraction(setup.limits, setup.runtime, configuration).pipe(
    Effect.flatMap((stage) =>
      makeCitationTestInvocationBinding(setup.limits).pipe(
        Effect.map((bind) => ({ ...stage, extract: bind(stage.extract) }))
      )
    ),
    Effect.provideContext(provided),
    Effect.provideService(CitationDocumentInputProtocols, retainedProtocols),
    DateTime.withCurrentZoneOffset(0)
  );
  const invocation = retained.extract({ document, removeAmbiguous: row.removeAmbiguous });
  const closed: Effect.Effect<
    Effect.Success<typeof invocation>,
    Effect.Error<typeof invocation>,
    CitationInvocation
  > = invocation;
  const result = yield* closed;
  expect(result.document).toBe(document);
  expect(result.document.plain).toBe(document.plain);
  expect(result.document.markup).toBe(document.markup);
  expect(result.document.geometry).toBe(document.geometry);
  yield* assertCitationTokenizedExtractionRow(result.extraction, row, translated);
  const foreign = yield* makeCitationCleanerValues(setup.limits);
  const otherPlain = yield* foreign.sourceText("other owner");
  const before = yield* setup.observed.snapshot;
  const refused = yield* retained
    .extract({
      document: { ...document, plain: otherPlain },
      removeAmbiguous: row.removeAmbiguous,
    })
    .pipe(Effect.flip);
  expect(refused).toMatchObject({ _tag: "CitationCleanerFailure", reason: "unissued-value" });
  const after = yield* setup.observed.snapshot;
  expect(after).toEqual(before);
});
/** Builtin protocols, actual cleaner registry and complete default extractor catalog. */
export const replayCitationDocumentExtraction = Effect.fn("DocumentExtractionTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const installed = yield* installCitationDocumentExtractionFixture(kind);
  const { corpus, setup, adapter, values, stage, translated } = installed;
  const rows = A.filter(corpus.cases, (row) => full || A.contains([0, 4, 18, 20, 22, 32], row.id));
  for (const row of rows) {
    const request = yield* documentRequest(values, adapter, row);
    const invocation = stage.extract(request);
    const closed: Effect.Effect<
      Effect.Success<typeof invocation>,
      Effect.Error<typeof invocation>,
      CitationInvocation
    > = invocation;
    const result = yield* closed;
    yield* assertCitationTokenizedExtractionRow(result.extraction, row, translated);
    const sourceIdentity = yield* values.same(result.document.source, request.source);
    expect(sourceIdentity).toBe(true);
    const stepIdentity = yield* values.same(result.document.steps, request.steps);
    expect(stepIdentity).toBe(true);
    expect(result.reservedUnits).toBe(result.extraction.reservedUnits);
    if (!full && A.contains([4, 32], row.id)) yield* replayRetained(installed, result.document, row);
  }
  expect(rows).toHaveLength(full ? 36 : 6);
  const malformed = yield* stage.extract(null).pipe(Effect.flip);
  expect(malformed).toMatchObject({ _tag: "CitationDocumentExtractionFailure", reason: "invalid-input" });
  yield* assertCitationWorkerCompositionObserved(setup.operation, setup.admission, setup.observed.snapshot);
});
