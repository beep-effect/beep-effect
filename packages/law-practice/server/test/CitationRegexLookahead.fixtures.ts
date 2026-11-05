import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationRegexEngine } from "@beep/law-practice-server/internal/Citation/RegexEngine";
import { Sha256HexFromBytes } from "@beep/schema";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import {
  assertCitationRegexProgramProfiles,
  CitationRegexProbePattern,
  replayCitationRegexProgramRow,
} from "./CitationRegexVerbose.fixtures.ts";
import { setupCitationRegexWorker } from "./CitationRegexWorker.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationRegexLookahead");
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-regex-lookahead/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    regex: S.tag("2023.12.25"),
    producerSha256: S.tag("5c8c3cac2824fce2c5e6945ab3f9a57ebd2e42e3c0e319e9c18cff234d8ac6d9"),
    patterns: S.Array(CitationRegexProbePattern).check(S.isBetweenLength(17, 17)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Original lookahead profiles and native captures, including raw/anchored journal patterns.",
  })
);
const load = Effect.fn("LookaheadTest.load")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/regex-lookahead.json", import.meta.url))
  );
  const hash = yield* S.decodeEffect(Sha256HexFromBytes)(bytes);
  expect(hash).toBe("7fd24d7ff71257d1a563cb02aca1275337b08a52e327ce138cbe35c72908a971");
  return yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
});
/** Actual source parse success/error, capture identities and width/repetition facts. */
export const assertCitationLookaheadProfiles = Effect.fn("LookaheadTest.profiles")(function* () {
  const corpus = yield* load();
  yield* assertCitationRegexProgramProfiles(corpus.patterns);
});
/** Reuse existing source capture assertions and both isolated runtime paths. */
export const replayCitationRegexLookahead = Effect.fn("LookaheadTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const corpus = yield* load();
  for (const engine of CitationRegexEngine.literals) {
    const rows = A.filter(corpus.patterns, (row) => row.engines[engine].kind === "single-match" && (full || row.smoke));
    const bindings = A.map(rows, (row) => ({
      patternSha256: row.patternSha256,
      flags: row.flags,
      profile: row.engines[engine].profile,
    }));
    const setup = yield* setupCitationRegexWorker(bindings, kind, engine);
    let calls = 0;
    for (const row of rows) calls += yield* replayCitationRegexProgramRow(setup, row, row.engines[engine], full);
    const observed = yield* setup.observed.snapshot;
    expect(observed).toEqual({ spawned: calls, confirmed: calls });
    expect(calls).toBe(full ? 151 : 17);
    const admission = yield* setup.admission.snapshot;
    expect(admission).toMatchObject({ active: 0, regexActive: 0, quarantined: 0 });
  }
});
