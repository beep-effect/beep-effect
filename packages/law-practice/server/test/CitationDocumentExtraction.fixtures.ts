/** Actual owned Document initialization through the complete native extraction path.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationBuiltinCleaners } from "@beep/law-practice-server/internal/Citation/BuiltinCleaners";
import { CitationCleanerRuntime } from "@beep/law-practice-server/internal/Citation/CleanerPipeline";
import {
  CitationCleanerProtocols,
  makeCitationCleanerRegistry,
} from "@beep/law-practice-server/internal/Citation/CleanerRegistry";
import { CitationCleanerValues } from "@beep/law-practice-server/internal/Citation/CleanerValues";
import { makeCitationDocumentCleanerProtocols } from "@beep/law-practice-server/internal/Citation/DocumentCleanerProtocols";
import {
  CitationDocumentExtractionConfiguration,
  makeCitationDocumentExtraction,
} from "@beep/law-practice-server/internal/Citation/DocumentExtraction";
import { CitationDocumentInputProtocols } from "@beep/law-practice-server/internal/Citation/InputDocument";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { makeCitationCleanerRegistryHarness } from "./CitationCleanerRegistry.fixtures.ts";
import { makeCitationDiffTestRuntime } from "./CitationDiffWorker.fixtures.ts";
import { makeCitationHtmlTestRuntime } from "./CitationNativeSpawner.fixtures.ts";
import { assertCitationWorkerCompositionObserved } from "./CitationRegexWorker.fixtures.ts";
import {
  assertCitationTokenizedExtractionRow,
  installCitationTokenizedExtractionFixture,
} from "./CitationTokenizedExtraction.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

type Installed = Effect.Success<ReturnType<typeof installCitationTokenizedExtractionFixture>>;
const documentRequest = Effect.fn("DocumentExtractionTest.request")(function* (
  values: CitationCleanerValues["Service"],
  adapter: Effect.Success<ReturnType<typeof makeCitationDocumentCleanerProtocols>>,
  row: Installed["corpus"]["cases"][number]
) {
  const hasMarkup = row.markup.bytes.length > 0;
  const plain = hasMarkup ? yield* values.sourceText("") : yield* values.sourceUnicode(row.plain);
  const markup = hasMarkup ? yield* values.sourceUnicode(row.markup) : yield* values.retainHost(null);
  const steps = yield* adapter.create({ kind: "list", names: hasMarkup ? ["html"] : [] });
  return { plain, markup, steps, source: hasMarkup ? markup : plain, removeAmbiguous: row.removeAmbiguous };
});
/** Install original live input services with the complete authenticated catalog. */
export const installCitationDocumentExtractionFixture = Effect.fn("DocumentExtractionTest.install")(function* (
  kind: CitationNativeRuntimeKind
) {
  const { corpus, setup, configuration, translated, discovery } =
    yield* installCitationTokenizedExtractionFixture(kind);
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "citation-extract-document-" });
  const diffRuntime = yield* makeCitationDiffTestRuntime(kind, directory);
  const htmlDirectory = yield* fs.makeTempDirectoryScoped({ prefix: "citation-extract-document-html-" });
  const htmlRuntime = yield* makeCitationHtmlTestRuntime(kind, htmlDirectory);
  const h = yield* makeCitationCleanerRegistryHarness(
    undefined,
    undefined,
    setup.observed.spawner,
    undefined,
    htmlRuntime
  ).pipe(Effect.provideContext(setup.provided));
  const adapter = yield* makeCitationDocumentCleanerProtocols(setup.limits).pipe(
    Effect.provideService(CitationCleanerValues, h.values),
    Effect.provideService(CitationCleanerProtocols, h.protocols)
  );
  const registry = yield* makeCitationCleanerRegistry(setup.limits).pipe(
    Effect.provideService(CitationCleanerValues, h.values),
    Effect.provideService(CitationCleanerProtocols, adapter.cleaner),
    Effect.provideService(CitationBuiltinCleaners, h.builtins)
  );
  const provided = setup.provided.pipe(
    Context.add(CitationCleanerValues, h.values),
    Context.add(CitationDocumentInputProtocols, adapter.document),
    Context.add(CitationCleanerRuntime, registry.runtime)
  );
  const documentConfiguration = CitationDocumentExtractionConfiguration.make({
    document: { discovery, diffRuntime },
    extraction: configuration,
  });
  const stage = yield* makeCitationDocumentExtraction(setup.limits, setup.runtime, documentConfiguration).pipe(
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
    values: h.values,
    stage,
  };
});
/** Builtin protocols, actual cleaner registry and complete default extractor catalog. */
export const replayCitationDocumentExtraction = Effect.fn("DocumentExtractionTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const { corpus, setup, adapter, values, stage, translated } = yield* installCitationDocumentExtractionFixture(kind);
  const rows = A.filter(corpus.cases, (row) => full || A.contains([0, 4, 18, 20, 22, 32], row.id));
  for (const row of rows) {
    const request = yield* documentRequest(values, adapter, row);
    const invocation = stage.extract(request);
    const closed: Effect.Effect<Effect.Success<typeof invocation>, Effect.Error<typeof invocation>> = invocation;
    const result = yield* closed;
    yield* assertCitationTokenizedExtractionRow(result.extraction, row, translated);
    const sourceIdentity = yield* values.same(result.document.source, request.source);
    expect(sourceIdentity).toBe(true);
    const stepIdentity = yield* values.same(result.document.steps, request.steps);
    expect(stepIdentity).toBe(true);
    expect(result.reservedUnits).toBe(result.extraction.reservedUnits);
  }
  expect(rows).toHaveLength(full ? 36 : 6);
  const malformed = yield* stage.extract(null).pipe(Effect.flip);
  expect(malformed).toMatchObject({ _tag: "CitationDocumentExtractionFailure", reason: "invalid-input" });
  yield* assertCitationWorkerCompositionObserved(setup.operation, setup.admission, setup.observed.snapshot);
});
