/** Authenticated original XML balance observations, shared by kernel and workers.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationXmlBalanceKernel");
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-annotation-xml/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    producerSha256: S.tag("23df3d5dc7445e1ac9f46616ce8919eb450846b034596cc2c4072ec9160ae97a"),
    lxml: S.tag("5.1.0"),
    libxml: S.tag("2.12.3"),
    cases: S.Array(
      S.Struct({ id: S.Natural, source: CitationNativeUnicodeHex, fast: S.Boolean, value: S.Boolean, error: S.Null })
    ).check(S.isBetweenLength(300, 300)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Original XML wrapper and no-angle fast-path outcomes under exact parser versions.",
  })
);
/** @internal @category testing @since 0.0.0 */
export const readCitationXmlCorpus = readCitationOracleFixture(
  "annotation-xml",
  "8ecdd67731000b801254535338eca46e3329baa901cd16d6c49e285cf4c5bc99"
).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
