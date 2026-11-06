/** Source replay through existing owned runtime fixtures.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationHtmlDiscoveryConfiguration,
  makeCitationHtmlDiscovery,
} from "@beep/law-practice-server/internal/Citation/HtmlDiscovery";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import {
  assertCitationMetadataRefusal,
  assertCitationWorkerCompositionReleased,
  makeCitationMetadataFixture,
  readCitationOracleFixture,
} from "./CitationRegexWorker.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationHtmlDiscovery");
const PatternCorpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-html-discovery-patterns/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    exhaustiveSequences: S.tag(41371),
    configuration: S.Struct({
      ...CitationHtmlDiscoveryConfiguration.fields,
      patterns: S.Struct({ placeholder: CitationNativeUnicodeHex, emphasis: CitationNativeUnicodeHex }),
    }),
  })
).pipe(
  $I.annoteSchema("PatternCorpus", {
    description: "Sealed fixed-pattern configuration and finite source lowering proof.",
  })
);
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-html-discovery/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    cases: S.Array(
      S.Struct({
        id: S.Natural,
        markup: CitationNativeUnicodeHex,
        placeholder: CitationNativeUnicodeHex,
        tags: S.Array(S.Struct({ text: CitationNativeUnicodeHex, start: S.Natural, end: S.Natural })),
      })
    ).check(S.isBetweenLength(250, 250)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Original native placeholder/emphasis observations, independently byte sealed.",
  })
);
export const readCitationHtmlDiscoveryCorpus = Effect.fn("HtmlDiscoveryTest.load")(function* () {
  const configuration = yield* readCitationOracleFixture(
    "html-discovery-patterns",
    "95830f0e880b234b2b5ada632e94a1b88abc67c69d825148226dcdcea8b8a230"
  ).pipe(Effect.flatMap(S.decodeEffect(PatternCorpus)));
  const corpus = yield* readCitationOracleFixture(
    "html-discovery",
    "300ebdae40b70009428549807c2c6bf44692d7fef645c32ba8ad10223ad8ee2e"
  ).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
  return { configuration: configuration.configuration, corpus };
});
const install = makeCitationMetadataFixture({ load: readCitationHtmlDiscoveryCorpus, make: makeCitationHtmlDiscovery });
/** Replay complete original observations and independently confirm both exits per call. */
export const replayCitationHtmlDiscovery = Effect.fn("HtmlDiscoveryTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const setup = yield* install(kind);
  const smoke = [0, 1, 4, 6, 10, 12, 15, 28, 31, 36, 39, 140, 141, 142, 143, 249];
  const rows = A.filter(setup.corpus.cases, (row) => full || A.contains(smoke, row.id));
  for (const row of rows) {
    const run = setup.stage.discover(row.markup);
    const closed: Effect.Effect<Effect.Success<typeof run>, Effect.Error<typeof run>> = run;
    const result = yield* closed;
    expect(result.placeholder, `${kind}:${row.id}:placeholder`).toEqual(row.placeholder);
    expect(result.tags, `${kind}:${row.id}:tags`).toEqual(row.tags);
  }
  expect(rows).toHaveLength(full ? 250 : 16);
  yield* assertCitationWorkerCompositionReleased(
    setup.operation,
    setup.admission,
    setup.observed.snapshot,
    rows.length * 2
  );
});
/** Installed configuration is owned; effective input refusal spawns no child. */
export const assertCitationHtmlDiscoveryOwnership = Effect.fn("HtmlDiscoveryTest.ownership")(function* () {
  const setup = yield* install("bun");
  const row = A.getUnsafe(setup.corpus.cases, 10);
  setup.configuration.patterns.placeholder.bytes.fill(0);
  setup.configuration.patterns.emphasis.bytes.fill(0);
  const result = yield* setup.stage.discover(row.markup);
  expect(result.placeholder).toEqual(row.placeholder);
  expect(result.tags).toEqual(row.tags);
  yield* assertCitationWorkerCompositionReleased(setup.operation, setup.admission, setup.observed.snapshot, 2);
  const tight = yield* install("bun", 1);
  yield* assertCitationMetadataRefusal(
    tight.stage.discover(row.markup),
    tight.operation,
    tight.admission,
    tight.observed.snapshot,
    0
  );
});
