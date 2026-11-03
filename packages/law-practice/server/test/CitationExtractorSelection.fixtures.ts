/** Shared pinned source-selector controls; no test registration.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationExtractorOrderingBinding } from "@beep/law-practice-server/internal/Citation/ExtractorOrdering";
import { CitationExtractorSelectionBinding } from "@beep/law-practice-server/internal/Citation/ExtractorSelection";
import { CitationPythonUnicodeStorage } from "@beep/law-practice-server/internal/Citation/PythonHash";
import { expect } from "@effect/vitest";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";

const $I = $LawPracticeServerId.create("test/CitationExtractorSelection");
const Native = S.Struct({ width: CitationPythonUnicodeStorage.fields.width, bytes: S.Uint8ArrayFromHex });
const SelectionCase = S.Struct({
  id: S.Natural,
  source: Native,
  selected: S.Array(S.Natural),
  ordered: S.Array(S.Natural),
  insertions: S.Array(S.Natural),
}).pipe(
  $I.annoteSchema("SelectionCase", {
    description: "Independent source membership, insertion and iteration observation.",
  })
);
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-extractor-selection-controls/v2"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    producerSha256: S.tag("67e9136c263dc7e7307a698b11bcd932d31ad7f5d0fa29f0835d98a411e6b7f0"),
    python: S.tag("3.11.15"),
    unicode: S.tag("14.0.0"),
    hashSeed: S.tag("0"),
    hashWidth: S.tag(64),
    hashAlgorithm: S.tag("siphash13"),
    dependencies: S.Struct({ pyahocorasick: S.tag("2.0.0"), "reporters-db": S.tag("3.2.53") }),
    bindings: S.Array(S.Struct({ ...CitationExtractorSelectionBinding.fields, strings: S.Array(Native) })).check(
      S.isBetweenLength(16, 16)
    ),
    ordering: S.Struct({
      bindings: S.Array(
        S.Struct({ ...CitationExtractorOrderingBinding.fields, strings: S.Array(Native), representation: Native })
      ).check(S.isBetweenLength(22, 22)),
      cases: S.Array(SelectionCase).check(S.isBetweenLength(25, 25)),
    }),
    canonical: S.Struct({
      extractorsSha256: S.tag("8603461486e165c4cb98f238b58910c269e8d6b59f4a16323c075276e94eec3c"),
      extractorCount: S.tag(6805),
      uniqueExtractorCount: S.tag(6805),
      hashes: S.Array(S.Tuple([S.BigIntFromString, S.Natural])).check(S.isBetweenLength(6805, 6805)),
      representationVectorSha256: S.NonEmptyString.check(S.isBetweenLength(64, 64)),
      cases: S.Array(SelectionCase).check(S.isBetweenLength(12, 12)),
    }),
    cases: S.Array(SelectionCase).check(S.isBetweenLength(23, 23)),
  })
).pipe($I.annoteSchema("Corpus", { description: "Pinned source Ahocorasick selection membership observations." }));
/** @internal @category testing @since 0.0.0 */
export const loadCitationExtractorSelectionControls = Effect.fn("SelectionTest.loadControls")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const digest = yield* Digest.Digest;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/extractor-selection.json", import.meta.url))
  );
  const citationResult1 = yield* digest.digestHex(Digest.sha256, bytes);
  expect(citationResult1).toBe("92e8c85c63b1efca7bdfc99f12cc5e343fb4ff88a534188e98ffaff545723950");
  return yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
});
