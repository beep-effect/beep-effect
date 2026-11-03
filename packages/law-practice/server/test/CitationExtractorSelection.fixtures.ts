/** Shared pinned source-selector controls; no test registration.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationExtractorSelectionBinding } from "@beep/law-practice-server/internal/Citation/ExtractorSelection";
import { CitationPythonUnicodeStorage } from "@beep/law-practice-server/internal/Citation/PythonHash";
import { expect } from "@effect/vitest";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";

const $I = $LawPracticeServerId.create("test/CitationExtractorSelection");
const Native = S.Struct({ width: CitationPythonUnicodeStorage.fields.width, bytes: S.Uint8ArrayFromHex });
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-extractor-selection-controls/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    producerSha256: S.tag("96bd675f5f6f5bf9c7593b7b843157b104102e7cee416afdaff7b19545bbaf8b"),
    python: S.tag("3.11.15"),
    unicode: S.tag("14.0.0"),
    hashSeed: S.tag("0"),
    dependencies: S.Struct({ pyahocorasick: S.tag("2.0.0"), "reporters-db": S.tag("3.2.53") }),
    bindings: S.Array(S.Struct({ ...CitationExtractorSelectionBinding.fields, strings: S.Array(Native) })).check(
      S.isBetweenLength(16, 16)
    ),
    canonical: S.Struct({
      extractorsSha256: S.tag("8603461486e165c4cb98f238b58910c269e8d6b59f4a16323c075276e94eec3c"),
      extractorCount: S.tag(6805),
      uniqueExtractorCount: S.tag(6805),
      cases: S.Array(S.Struct({ id: S.Natural, source: Native, selected: S.Array(S.Natural) })).check(
        S.isBetweenLength(12, 12)
      ),
    }),
    cases: S.Array(S.Struct({ id: S.Natural, source: Native, selected: S.Array(S.Natural) })).check(
      S.isBetweenLength(23, 23)
    ),
  })
).pipe($I.annoteSchema("Corpus", { description: "Pinned source Ahocorasick selection membership observations." }));
/** @internal @category testing @since 0.0.0 */
export const loadCitationExtractorSelectionControls = Effect.fn("SelectionTest.loadControls")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const digest = yield* Digest.Digest;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/extractor-selection.json", import.meta.url))
  );
  expect(yield* digest.digestHex(Digest.sha256, bytes)).toBe(
    "5ce66c09303e4629f63f75baae41b992913d584b0e95fcd7c8f15b5162b697fc"
  );
  return yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
});
