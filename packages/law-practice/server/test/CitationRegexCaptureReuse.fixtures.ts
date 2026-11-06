/** Independent source capture-reuse profiles, plans and matching observations.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationRegexEngine } from "@beep/law-practice-server/internal/Citation/RegexEngine";
import {
  CitationRegexCapturePlan,
  makeCitationRegexProgram,
} from "@beep/law-practice-server/internal/Citation/RegexProgram";
import { CitationEngineAbsoluteMaxima } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256HexFromBytes } from "@beep/schema";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  assertCitationRegexProgramProfiles,
  CitationRegexProbePattern,
  replayCitationRegexProgramEngine,
} from "./CitationRegexVerbose.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationRegexCaptureReuse");
const Pattern = S.Struct({
  ...CitationRegexProbePattern.fields,
  capturePlans: S.Record(S.String, CitationRegexCapturePlan),
});
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-regex-capture-reuse/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    regex: S.tag("2023.12.25"),
    producerSha256: S.tag("9748d537c73906e8447b81af54c31995580bbdb052bb0d9c6bd490b46f6695ec"),
    patterns: S.Array(Pattern).check(S.isBetweenLength(27, 27)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description:
      "Actual V0 parse trees, logical capture outcomes and original full-case/supra patterns, distinct from CPython errors.",
  })
);
const load = Effect.fn("CaptureReuseTest.load")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/regex-capture-reuse.json", import.meta.url))
  );
  const digest = yield* S.decodeEffect(Sha256HexFromBytes)(bytes);
  expect(digest).toBe("b16b30ea812b82e4a1b7b6d2ab832014546cec43189f4cad4d829df77eedbe0c");
  return yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
});
/** Existing explicit absolute policy permits source-pattern qualification; defaults remain unchanged. */
export const assertCitationCaptureReuseProfiles = Effect.fn("CaptureReuseTest.profiles")(function* () {
  const corpus = yield* load();
  yield* assertCitationRegexProgramProfiles(corpus.patterns, CitationEngineAbsoluteMaxima.patternUtf16);
  const defaults = (yield* defaultCitationEnginePolicy).limits;
  const full = yield* Effect.fromOption(A.get(corpus.patterns, 22));
  const bounded = yield* makeCitationRegexProgram(defaults, "python-regex-v0");
  const refused = yield* bounded.compile(full.pattern, full.flags).pipe(Effect.flip);
  expect(refused).toMatchObject({ limit: "patternUtf16" });
  for (const engine of CitationRegexEngine.literals) {
    const compiler = yield* makeCitationRegexProgram(
      { ...defaults, patternUtf16: CitationEngineAbsoluteMaxima.patternUtf16 },
      engine
    );
    for (const row of corpus.patterns) {
      if (row.engines[engine].profile === null) continue;
      const expected = yield* Effect.fromOption(R.get(row.capturePlans, engine));
      const program = yield* compiler.compile(row.pattern, row.flags);
      const plan = yield* compiler.capturePlan(program);
      expect(plan, `${engine}:${row.id}`).toEqual(expected);
    }
  }
});
const replayEngine = Effect.fn("CaptureReuseTest.engine")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean,
  corpus: typeof Corpus.Type,
  engine: typeof CitationRegexEngine.Type
) {
  const counts = yield* replayCitationRegexProgramEngine(
    kind,
    full,
    corpus.patterns,
    engine,
    CitationEngineAbsoluteMaxima.patternUtf16
  );
  expect(counts.admitted).toBe(engine === "python-re" ? (full ? 90 : 6) : full ? 1020 : 65);
  expect(counts.refused).toBe(engine === "python-re" ? 0 : 2);
});
/** Compare all logical captures through existing independently retired workers. */
export const replayCitationCaptureReuse = Effect.fn("CaptureReuseTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const corpus = yield* load();
  for (const engine of CitationRegexEngine.literals) yield* replayEngine(kind, full, corpus, engine);
});
