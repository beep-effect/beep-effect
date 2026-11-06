/** Native text to original get_citations outcomes through the complete catalog.
 * @internal @packageDocumentation @since 0.0.0
 */

import { CitationTokenDispatchBindings } from "@beep/law-practice-server/internal/Citation/TokenDispatch";
import {
  CitationTokenizedExtractionConfiguration,
  makeCitationTokenizedExtraction,
} from "@beep/law-practice-server/internal/Citation/TokenizedExtraction";
import { makeCitationCanonicalTokenizerCatalog } from "@beep/law-practice-server/internal/Citation/TokenizerCatalog";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { loadCitationCanonicalTokenizerControls } from "./CitationCanonicalTokenizer.fixtures.ts";
import {
  assertCitationExtractionLoopModel,
  assertCitationExtractionLoopSelection,
  installCitationExtractionLoopFixture,
} from "./CitationExtractionLoop.fixtures.ts";
import { prepareCitationOptionalHtmlGeometry } from "./CitationHtmlGeometryPreparation.fixtures.ts";
import { assertCitationWorkerCompositionObserved } from "./CitationRegexWorker.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

/** Shared complete catalog, source observations and actual runtime installation. */
export const installCitationTokenizedExtractionFixture = Effect.fn("TokenizedExtractionTest.install")(function* (
  kind: CitationNativeRuntimeKind
) {
  const { corpus, setup, configuration, geometry } = yield* installCitationExtractionLoopFixture(kind);
  const controls = yield* loadCitationCanonicalTokenizerControls();
  const tokenizer = yield* makeCitationCanonicalTokenizerCatalog(
    setup.limits,
    controls.payload,
    controls.metadata
  ).pipe(Effect.provideContext(setup.provided));
  const editions = yield* S.decodeEffect(CitationTokenDispatchBindings)(
    A.map(tokenizer.editions, (row) => ({ id: row.id, ref: row.ref }))
  );
  const byRef = HashMap.fromIterable(A.map(editions, (row) => Tuple.make(row.ref, row.id)));
  const translated = yield* Effect.forEach(corpus.bindings, (row) => Effect.fromOption(HashMap.get(byRef, row.ref)), {
    concurrency: 1,
  });
  const nativeConfiguration = CitationTokenizedExtractionConfiguration.make({
    tokenizer,
    loop: {
      ...configuration,
      full: { ...configuration.full, editions },
      reference: { ...configuration.reference, editions },
    },
  });
  const stage = yield* makeCitationTokenizedExtraction(setup.limits, setup.runtime, nativeConfiguration).pipe(
    Effect.provideContext(setup.provided),
    DateTime.withCurrentZoneOffset(0)
  );
  return { corpus, setup, configuration: nativeConfiguration, geometry, stage, translated };
});
type Installed = Effect.Success<ReturnType<typeof installCitationTokenizedExtractionFixture>>;
/** Compare native-text output to the original complete model and identity observations. */
export const assertCitationTokenizedExtractionRow = Effect.fn("TokenizedExtractionTest.row")(function* (
  result: Effect.Success<ReturnType<Installed["stage"]["extract"]>>,
  row: Installed["corpus"]["cases"][number],
  translated: ReadonlyArray<number>
) {
  const translate = (ids: ReadonlyArray<number>) => A.map(ids, (id) => A.getUnsafe(translated, id));
  expect(result.tokenizer.source).toEqual(row.plain);
  expect(result.extraction.models).toHaveLength(row.before.length);
  yield* Effect.forEach(
    result.extraction.models,
    (entry, id) => {
      const original = A.getUnsafe(row.before, id);
      return assertCitationExtractionLoopModel(
        entry,
        {
          ...original,
          token: {
            ...original.token,
            exact: translate(original.token.exact),
            variation: translate(original.token.variation),
          },
        },
        id
      );
    },
    { concurrency: 1, discard: true }
  );
  yield* assertCitationExtractionLoopSelection(result.extraction, row);
});
/** All catalogs remain installed in smoke mode; only replay documents differ. */
export const replayCitationTokenizedExtraction = Effect.fn("TokenizedExtractionTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const { corpus, setup, stage, geometry, translated } = yield* installCitationTokenizedExtractionFixture(kind);
  const rows = A.filter(corpus.cases, (row) => full || A.contains([0, 4, 8, 14, 18, 20, 22, 32], row.id));
  for (const row of rows) {
    const maps = yield* prepareCitationOptionalHtmlGeometry(geometry, row, row.markup.bytes.length > 0);
    const invocation = stage.extract({
      plain: row.plain,
      markup: row.markup,
      geometry: maps,
      removeAmbiguous: row.removeAmbiguous,
    });
    const closed: Effect.Effect<Effect.Success<typeof invocation>, Effect.Error<typeof invocation>> = invocation;
    const result = yield* closed;
    yield* assertCitationTokenizedExtractionRow(result, row, translated);
  }
  expect(rows).toHaveLength(full ? 36 : 8);
  yield* assertCitationWorkerCompositionObserved(setup.operation, setup.admission, setup.observed.snapshot);
});
