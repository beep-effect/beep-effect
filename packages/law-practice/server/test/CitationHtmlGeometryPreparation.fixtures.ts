/** Original Document geometry through four owned children per preparation.
 * @internal @packageDocumentation @since 0.0.0
 */
import { makeCitationHtmlGeometryPreparation } from "@beep/law-practice-server/internal/Citation/HtmlGeometryPreparation";
import { makeCitationHtmlTagGeometry } from "@beep/law-practice-server/internal/Citation/HtmlTagGeometry";
import { CitationTextBudget, makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { makeCitationDiffTestRuntime } from "./CitationDiffWorker.fixtures.ts";
import { readCitationHtmlDiscoveryCorpus } from "./CitationHtmlDiscovery.fixtures.ts";
import {
  assertCitationWorkerCompositionReleased,
  setupCitationMetadataRuntime,
} from "./CitationRegexWorker.fixtures.ts";
import { readCitationSpanOffsetsCorpus } from "./CitationSpanOffsets.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

/** Install connected geometry using the existing runtime, timing and physical owners. */
export const installCitationHtmlGeometryFixture = Effect.fn("HtmlGeometryPreparationTest.installConnected")(function* (
  kind: CitationNativeRuntimeKind,
  setup: Effect.Success<ReturnType<typeof setupCitationMetadataRuntime>>,
  diffSteps?: number
) {
  const discovery = yield* readCitationHtmlDiscoveryCorpus();
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "citation-connected-geometry-diff-" });
  const diffRuntime = yield* makeCitationDiffTestRuntime(kind, directory);
  const limits = { ...setup.limits, diffSteps: diffSteps ?? setup.limits.diffSteps };
  return yield* makeCitationHtmlGeometryPreparation(limits, setup.runtime, {
    discovery: discovery.configuration,
    diffRuntime,
  }).pipe(Effect.provideContext(setup.provided));
});
const install = Effect.fn("HtmlGeometryPreparationTest.install")(function* (
  kind: CitationNativeRuntimeKind,
  diffSteps?: number
) {
  const original = yield* readCitationSpanOffsetsCorpus();
  const setup = yield* setupCitationMetadataRuntime(kind);
  const stage = yield* installCitationHtmlGeometryFixture(kind, setup, diffSteps);
  return { original, setup, stage };
});
/** Replay both original edit sequences and every downstream source query. */
export const replayCitationHtmlGeometryPreparation = Effect.fn("HtmlGeometryPreparationTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const { original, setup, stage } = yield* install(kind);
  const documents = A.filter(original.corpus.documents, (_, index) => full || index === 0 || index >= 14);
  for (const document of documents) {
    const invocation = stage.prepare({ plain: document.plain, markup: document.markup });
    const closed: Effect.Effect<Effect.Success<typeof invocation>, Effect.Error<typeof invocation>> = invocation;
    const prepared = yield* closed;
    expect(prepared.geometry.forward).toEqual(A.getUnsafe(original.plans, document.forwardMap));
    expect(prepared.geometry.backward).toEqual(A.getUnsafe(original.plans, document.backwardMap));
    expect(prepared.geometry.tags).toEqual(document.tags);
    const budget = yield* makeCitationTextBudget(setup.limits);
    const geometry = yield* makeCitationHtmlTagGeometry(setup.limits, prepared.geometry).pipe(
      Effect.provideService(CitationTextBudget, budget)
    );
    for (const query of document.queries) {
      const tags = yield* geometry.find(query.position);
      expect(tags).toEqual(query.tags);
    }
    for (const conversion of document.conversions) {
      const mapped = yield* geometry.convert([conversion.tag]);
      expect(mapped).toEqual({
        text: conversion.text,
        start: conversion.start,
        end: conversion.end,
      });
    }
  }
  expect(documents).toHaveLength(full ? 16 : 3);
  yield* assertCitationWorkerCompositionReleased(
    setup.operation,
    setup.admission,
    setup.observed.snapshot,
    documents.length * 4
  );
});
/** A failed forward diff retires both existing children and publishes no partial geometry. */
export const assertCitationHtmlGeometryPreparationRefusal = Effect.fn("HtmlGeometryPreparationTest.refusal")(
  function* () {
    const { original, setup, stage } = yield* install("bun", 1);
    const source = A.getUnsafe(original.corpus.documents, 0);
    const failure = yield* stage.prepare({ plain: source.plain, markup: source.markup }).pipe(Effect.flip);
    expect(failure).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "diffSteps" });
    yield* assertCitationWorkerCompositionReleased(setup.operation, setup.admission, setup.observed.snapshot, 2);
  }
);
