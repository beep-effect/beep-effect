/** Original built-in rendering corpus, bounded native carriers and replay.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEditionRef } from "@beep/law-practice-domain/values";
import {
  CitationFrozenEditions,
  makeCitationFrozenEditions,
} from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import { makeCitationRendering } from "@beep/law-practice-server/internal/Citation/Rendering";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256HexFromBytes } from "@beep/schema";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { loadCitationFrozenEditionFixtures } from "./CitationFrozenEditions.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationRendering");
const Native = CitationNativeUnicodeHex;
const Value = S.NullOr(Native);
const Base = S.Struct({
  matchedText: Native,
  reporter: Value,
  page: Value,
  editionGuess: S.NullOr(CitationEditionRef),
});
const Mode = S.Literals(["matched", "law", "journal", "case", "short", "supra", "id"]);
const Index = S.Natural.check(S.isLessThan(774));
const Row = S.NullOr(Index).pipe(S.Array).check(S.isBetweenLength(5, 5));
const ModeRow = S.Struct({
  mode: Mode,
  sourceClass: S.String,
  sourceMethod: S.String,
  fields: S.Array(S.String).check(S.isMaxLength(7)),
  presentValues: S.Array(Native).check(S.isMaxLength(7)),
  observations: S.Array(Row).check(S.isMaxLength(2187)),
});
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-rendering/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    producerSha256: S.tag("252d72b85f6166b95e32563c071c494601b2eeb6afa470a38b0cfb66d1c6f335"),
    bases: S.Array(Base).check(S.isBetweenLength(5, 5)),
    modes: S.Array(ModeRow).check(S.isBetweenLength(7, 7)),
    inherited: S.Array(S.Struct({ sourceClass: S.String, observations: Row })).check(S.isBetweenLength(8, 8)),
    nativeControls: S.Array(
      S.Struct({
        request: S.Struct({ ...Base.fields, mode: Mode, metadata: S.Record(S.String, Value) }),
        result: Index,
      })
    ).check(S.isBetweenLength(9, 9)),
    outputs: S.Array(Native).check(S.isBetweenLength(774, 774)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description:
      "Actual source rendering methods with ternary metadata states and authenticated native output references.",
  })
);
/** @internal @category testing @since 0.0.0 */
export const loadCitationRendering = Effect.fn("RenderingTest.load")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/rendering.json", import.meta.url))
  );
  const digest = yield* S.decodeEffect(Sha256HexFromBytes)(bytes);
  expect(digest).toBe("1618224896d9db90bd057093169ebb18afa49c64627b445c580e2b7a7661dd20");
  const corpus = yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
  const { bundle } = yield* loadCitationFrozenEditionFixtures();
  const owner = yield* makeCitationFrozenEditions(bundle);
  const limits = (yield* defaultCitationEnginePolicy).limits;
  return { corpus, owner, limits };
});
const at = <V>(values: ReadonlyArray<V>, index: number) => Effect.fromOption(A.get(values, index));
const assertResult = Effect.fn("RenderingTest.result")(function* (
  rendering: Effect.Success<ReturnType<typeof makeCitationRendering>>,
  outputs: ReadonlyArray<CitationNativeUnicodeHex>,
  request: unknown,
  expected: number | null
) {
  if (expected === null) {
    const failed = yield* rendering.render(request).pipe(Effect.flip);
    expect(failed).toMatchObject({ reason: "invalid-reporter-replacement" });
    return;
  }
  const actual = yield* rendering.render(request);
  const value = yield* at(outputs, expected);
  expect(actual).toEqual(value);
});
const metadata = (mode: typeof ModeRow.Type, ordinal: number) =>
  R.fromEntries(
    A.map(mode.fields, (field, index) => {
      const state = Math.floor(ordinal / 3 ** (mode.fields.length - index - 1)) % 3;
      return [
        field,
        state === 0 ? null : state === 1 ? { width: 1, bytes: new Uint8Array() } : mode.presentValues[index],
      ];
    })
  );
const replayMode = Effect.fn("RenderingTest.mode")(function* (
  corpus: typeof Corpus.Type,
  rendering: Effect.Success<ReturnType<typeof makeCitationRendering>>,
  mode: typeof ModeRow.Type
) {
  let count = 0;
  expect(mode.presentValues).toHaveLength(mode.fields.length);
  expect(mode.observations).toHaveLength(3 ** mode.fields.length);
  for (let ordinal = 0; ordinal < mode.observations.length; ordinal++) {
    const row = yield* at(mode.observations, ordinal);
    const fields = metadata(mode, ordinal);
    for (let base = 0; base < corpus.bases.length; base++) {
      const source = yield* at(corpus.bases, base);
      const expected = yield* at(row, base);
      yield* assertResult(rendering, corpus.outputs, { ...source, mode: mode.mode, metadata: fields }, expected);
      count++;
    }
  }
  return count;
});
/** @internal @category testing @since 0.0.0 */
export const replayCitationRendering = Effect.fn("RenderingTest.replay")(function* () {
  const { corpus, owner, limits } = yield* loadCitationRendering();
  const rendering = yield* makeCitationRendering(limits).pipe(Effect.provideService(CitationFrozenEditions, owner));
  expect(A.map(corpus.modes, (m) => m.mode)).toEqual(Mode.literals);
  let count = 0;
  for (const mode of corpus.modes) count += yield* replayMode(corpus, rendering, mode);
  expect(count).toBe(14885);
  for (const row of corpus.inherited) {
    for (let base = 0; base < corpus.bases.length; base++) {
      const source = yield* at(corpus.bases, base);
      const expected = yield* at(row.observations, base);
      yield* assertResult(
        rendering,
        corpus.outputs,
        { ...source, mode: "matched", metadata: "deliberately unread" },
        expected
      );
    }
  }
  for (const row of corpus.nativeControls) yield* assertResult(rendering, corpus.outputs, row.request, row.result);
});
