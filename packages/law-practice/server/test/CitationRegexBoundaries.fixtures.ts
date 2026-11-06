/** Independent source word-boundary grammar/captures through existing workers.
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

const $I = $LawPracticeServerId.create("test/CitationRegexBoundaries");
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-regex-boundaries/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    regex: S.tag("2023.12.25"),
    producerSha256: S.tag("07ddb05961d379a1d1915014191161b03d1016d2d0d0a401ad7c7879d7a0f51a"),
    patterns: S.Array(CitationRegexProbePattern).check(S.isBetweenLength(17, 17)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description:
      "Both original engines' complete boundary profiles and matching modes, with errors and repeat refusals explicit.",
  })
);
const load = Effect.fn("RegexBoundariesTest.load")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/regex-boundaries.json", import.meta.url))
  );
  const hash = yield* S.decodeEffect(Sha256HexFromBytes)(bytes);
  expect(hash).toBe("5bf0097c3d3b36afa4e5137e2acaa9ccd2366ec966a3b084b9133add15a7e5ae");
  return yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
});
/** Every parse/profile is checked locally; source CPython and V0 remain distinct. */
export const assertCitationBoundaryProfiles = Effect.fn("RegexBoundariesTest.profiles")(function* () {
  const corpus = yield* load();
  yield* assertCitationRegexProgramProfiles(corpus.patterns, 8192);
});
const expectedCounts = {
  "python-re": { smoke: 33, full: 837, refused: 1 },
  "python-regex-v0": { smoke: 35, full: 887, refused: 3 },
};
/** Compare reviewed boundary contexts while retaining repeated-profile refusals. */
export const replayCitationRegexBoundaries = Effect.fn("RegexBoundariesTest.replay")(function* (
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
