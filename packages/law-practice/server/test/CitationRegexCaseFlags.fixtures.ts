/** Independent source case-flag grammar/captures through existing workers.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationRegexEngine } from "@beep/law-practice-server/internal/Citation/RegexEngine";
import { Sha256HexFromBytes } from "@beep/schema";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import {
  assertCitationRegexProgramProfiles,
  CitationRegexProbePattern,
  replayCitationRegexProgramEngine,
} from "./CitationRegexVerbose.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationRegexCaseFlags");
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-regex-case-flags/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    regex: S.tag("2023.12.25"),
    producerSha256: S.tag("f5d4d41a50a4fe89040687d726d153de0572bd758d7acb06bf09ea6e8c0118c1"),
    patterns: S.Array(CitationRegexProbePattern).check(S.isBetweenLength(35, 35)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description:
      "Original positional/scoped case-flag profiles and matching modes, including engine-specific syntax errors.",
  })
);
const load = Effect.fn("RegexCaseFlagsTest.load")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/regex-case-flags.json", import.meta.url))
  );
  const hash = yield* S.decodeEffect(Sha256HexFromBytes)(bytes);
  expect(hash).toBe("717cb46cac6ebef29949a59998fd873275b8c3dc9094843a58c9fdc4aa94fd6d");
  return yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
});
/** Every parse/profile is checked locally; source CPython and V0 remain distinct. */
export const assertCitationCaseFlagProfiles = Effect.fn("RegexCaseFlagsTest.profiles")(function* () {
  const corpus = yield* load();
  yield* assertCitationRegexProgramProfiles(corpus.patterns, 8192);
});
const expectedCounts = {
  "python-re": { smoke: 17, full: 1234, refused: 0 },
  "python-regex-v0": { smoke: 35, full: 2115, refused: 0 },
};
/** Compare reviewed case-flag contexts through independently acknowledged workers. */
export const replayCitationRegexCaseFlags = Effect.fn("RegexCaseFlagsTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const corpus = yield* load();
  for (const engine of CitationRegexEngine.literals) {
    const counts = yield* replayCitationRegexProgramEngine(kind, full, corpus.patterns, engine, 8192);
    const expected = expectedCounts[engine];
    expect(counts.admitted).toBe(full ? expected.full : expected.smoke);
    expect(counts.refused).toBe(expected.refused);
  }
});
