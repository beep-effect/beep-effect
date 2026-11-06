/** Replay original reference-name validity with existing frozen Python primitives.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationCaseMetadataFields } from "@beep/law-practice-server/internal/Citation/CaseMetadata";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { makeCitationReferenceNames } from "@beep/law-practice-server/internal/Citation/ReferenceNames";
import { CitationTextBudget, makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";
import type { CitationReferenceName } from "@beep/law-practice-server/internal/Citation/ReferenceNames";

const $I = $LawPracticeServerId.create("test/CitationReferenceNames");
const Corpus = S.fromJsonString(
  S.Struct({
    disallowedNames: S.Array(S.String).check(S.isBetweenLength(93, 93)),
    validity: S.Array(S.Struct({ name: S.NullOr(CitationNativeUnicodeHex), valid: S.Boolean })).check(
      S.isBetweenLength(117, 117)
    ),
  })
).pipe(
  $I.annoteSchema("Corpus", { description: "Sealed original name-validity calls and unmodified disallowed list." })
);
/** Construct the shared builtin metadata context for reference-name and pattern replay.
 * @internal @category testing @since 0.0.0
 */
export const makeCitationReferenceNameMetadata = (
  names: Pick<CitationCaseMetadataFields, "plaintiff" | "defendant" | "resolvedCaseNameShort" | "resolvedCaseName">
) =>
  CitationCaseMetadataFields.make({
    ...names,
    antecedentGuess: null,
    court: null,
    pinCite: null,
    pinCiteSpanStart: null,
    pinCiteSpanEnd: null,
    extra: null,
    parenthetical: null,
    year: null,
    month: null,
    day: null,
  });
/** Complete captured validity replay, source-data authentication and original field ordering.
 * @internal @category testing @since 0.0.0
 */
export const replayCitationReferenceNames = Effect.fn("ReferenceNamesTest.replay")(function* () {
  const corpus = yield* readCitationOracleFixture(
    "generated-references",
    "a741045d3c71ca4437c54e3af1781063c5ec66c091bfdfc4a4dbb2abce5d4006"
  ).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
  const limits = (yield* defaultCitationEnginePolicy).limits;
  const budget = yield* makeCitationTextBudget(limits);
  const names = yield* makeCitationReferenceNames(limits, corpus.disallowedNames).pipe(
    Effect.provideService(CitationTextBudget, budget)
  );
  const unicode = yield* makeCitationPythonUnicode(limits);
  for (const row of corpus.validity) {
    const source = row.name === null ? null : yield* unicode.fromStorage(row.name);
    const actual = yield* names.isValid(source);
    expect(actual).toBe(row.valid);
  }
  const roe = yield* unicode.fromText("Roe");
  const wade = yield* unicode.fromText("Wade");
  const metadata = makeCitationReferenceNameMetadata({
    plaintiff: roe.storage,
    defendant: wade.storage,
    resolvedCaseNameShort: roe.storage,
    resolvedCaseName: wade.storage,
  });
  const collected: ReadonlyArray<CitationReferenceName> = yield* names.collect(metadata);
  expect(A.map(collected, (item) => item.field)).toEqual([
    "plaintiff",
    "defendant",
    "resolved_case_name_short",
    "resolved_case_name",
  ]);
  expect(A.map(collected, (item) => item.value)).toEqual([roe.storage, wade.storage, roe.storage, wade.storage]);
  const altered = A.modify(corpus.disallowedNames, 0, () => "different");
  const refusal = yield* makeCitationReferenceNames(limits, altered).pipe(
    Effect.provideService(CitationTextBudget, budget),
    Effect.flip
  );
  expect(refusal).toMatchObject({ _tag: "CitationReferenceNamesFailure", reason: "invalid-configuration" });
  const smallBudget = yield* makeCitationTextBudget({ ...limits, producedTextUtf16: 1 });
  const tight = yield* makeCitationReferenceNames(limits, corpus.disallowedNames).pipe(
    Effect.provideService(CitationTextBudget, smallBudget)
  );
  const textRefusal = yield* tight.isValid(roe).pipe(Effect.flip);
  expect(textRefusal).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "producedTextUtf16" });
  const oversized = yield* makeCitationReferenceNames({ ...limits, producedTextUtf16: 1 }, corpus.disallowedNames).pipe(
    Effect.provideService(CitationTextBudget, budget),
    Effect.flip
  );
  expect(oversized).toMatchObject({ _tag: "CitationReferenceNamesFailure", reason: "invalid-policy" });
  const used = yield* budget.snapshot;
  expect(used).toBeGreaterThan(0);
});
