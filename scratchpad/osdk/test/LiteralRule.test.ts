import { describe, it } from "@effect/vitest";
import { assertSome, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import { flow, pipe } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import * as Osdk from "../src/index.ts";

// -----------------------------------------------------------------------------
// The one literal rule (README section 4)
//
// The domain literal of a mapped enum is the lowerCamel form of the wire word, nothing else: no pluralising
// (`DAY` is `day`, `DAYS` is `days`), no synonym (`ROUND_CLOSEST` is `roundClosest`), no dropped prefix or suffix
// (`DATE_FORMAT_DATE` is `dateFormatDate`, `USER_OR_GROUP_ID` is `userOrGroupId`). This file holds every exported
// mapped enum of the package to it.
// -----------------------------------------------------------------------------

/** The lowerCamel form of an UPPER_SNAKE wire word: `ALL_V2_WITH_DELETIONS` is `allV2WithDeletions`. */
const lowerCamel: (wire: string) => string = flow(Str.toLowerCase, Str.snakeToCamel);

const isPairs = S.is(S.NonEmptyArray(S.Tuple([S.String, S.String])));

type NamedPair = readonly [kit: string, wire: string, domain: string];

/** The package as data: concept name to that concept's exports. */
const concepts: Readonly<Record<string, Readonly<Record<string, unknown>>>> = { ...Osdk };

/** Every `[kit, wire, domain]` triple of every mapped enum a concept barrel exports. */
const exportedPairs: ReadonlyArray<NamedPair> = pipe(
  R.toEntries(concepts),
  A.flatMap(([concept, exports]) =>
    pipe(
      R.toEntries(exports),
      A.flatMap(([name, exported]): ReadonlyArray<NamedPair> => {
        if (!((P.isObject(exported) || P.isFunction(exported)) && P.hasProperty(exported, "Pairs"))) {
          return A.empty();
        }
        const pairs = exported.Pairs;
        return isPairs(pairs)
          ? A.map(pairs, ([wire, domain]) => Tuple.make(`${concept}.${name}`, wire, domain))
          : A.empty();
      })
    )
  )
);

/**
 * Literals that still break the rule. All three live in `src/DataType/DataType.values.ts`, which another owner
 * holds; the list may only shrink.
 */
const knownDeviations: ReadonlyArray<NamedPair> = [
  ["DataType.VectorSimilarity", "COSINE_SIMILARITY", "cosine"],
  ["DataType.VectorSimilarity", "EUCLIDEAN_DISTANCE", "euclidean"],
  ["DataType.HostedEmbeddingModel", "OPENAI_TEXT_EMBEDDING_ADA_002", "openAiTextEmbeddingAda002"],
];

const samePair = (left: NamedPair, right: NamedPair): boolean =>
  left[0] === right[0] && left[1] === right[1] && left[2] === right[2];

describe("the literal rule of mapped enums", () => {
  it("lowerCamel keeps digits, joins every word and changes no word", () => {
    deepStrictEqual(
      A.map(
        ["DAY", "DAYS", "ROUND_CLOSEST", "ALL_V2_WITH_DELETIONS", "DATE_FORMAT_ISO_INSTANT", "USER_OR_GROUP_ID"],
        lowerCamel
      ),
      ["day", "days", "roundClosest", "allV2WithDeletions", "dateFormatIsoInstant", "userOrGroupId"]
    );
  });

  it("finds the mapped enums of the package, the renamed ones among them", () => {
    const kits = A.dedupe(A.map(exportedPairs, ([kit]) => kit));
    assertTrue(A.length(kits) >= 60);
    assertTrue(
      A.every(
        [
          "Action.ReturnEditsMode",
          "DerivedProperty.DatePart",
          "Filter.RelativeDateUnit",
          "Filter.TextAnalyzer",
          "ValueFormat.DatetimePreset",
          "ValueFormat.KnownType",
          "ValueFormat.NumberRoundingMode",
        ],
        (kit) => A.contains(kits, kit)
      )
    );
  });

  it("every wire word is UPPER_SNAKE, so lowerCamel is defined for it", () => {
    deepStrictEqual(
      A.filter(exportedPairs, ([, wire]) => wire !== Str.toUpperCase(wire) || Str.isEmpty(wire)),
      []
    );
  });

  it("every domain literal is the lowerCamel form of its wire word", () => {
    const deviations = A.filter(exportedPairs, ([, wire, domain]) => domain !== lowerCamel(wire));
    deepStrictEqual(
      A.filter(deviations, (deviation) => !A.some(knownDeviations, (known) => samePair(known, deviation))),
      []
    );
  });

  it("the same wire word has the same domain literal in every enum that uses it", () => {
    const byWire = A.groupBy(exportedPairs, ([, wire]) => wire);
    const spellings = R.map(byWire, (pairs) => A.dedupe(A.map(pairs, ([, , domain]) => domain)));
    deepStrictEqual(
      R.filter(spellings, (domains) => A.length(domains) > 1),
      {}
    );
    // The singular and the plural wire words are different words, each with its own literal wherever it appears.
    assertSome(R.get(spellings, "DAY"), ["day"]);
    assertSome(R.get(spellings, "DAYS"), ["days"]);
  });
});
