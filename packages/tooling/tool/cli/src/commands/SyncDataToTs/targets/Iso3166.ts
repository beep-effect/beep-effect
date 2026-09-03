/**
 * Official ISO 3166 country and subdivision target definition.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Config, Effect, flow, MutableHashMap, Order, pipe, Redacted } from "effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  fetchSource,
  formatJson,
  formatTsDocCommentValue,
  formatTsLiteral,
  normalizeJson,
  outputFile,
  parseCsvSource,
  sourceMetadata,
} from "../internal/Source.ts";
import { SyncDataTargetProjection, SyncDataToTsError } from "../SyncDataToTs.schemas.ts";
import type { ParsedCsvRecords } from "../internal/Source.ts";
import type { SyncDataSourceMetadata, SyncDataTarget } from "../SyncDataToTs.schemas.ts";

const $I = $RepoCliId.create("commands/SyncDataToTs/targets/Iso3166");
const targetId = "iso3166" as const;
const outputPath = "packages/foundation/primitive/data/src/generated/iso3166.ts" as const;
const canonicalPath = "packages/foundation/primitive/data/src/generated/iso3166.data.json" as const;

/**
 * Public ISO product page for the official Country Codes Collection.
 *
 * @category configuration
 * @since 0.0.0
 */
export const ISO3166_SOURCE_URL = "https://www.iso.org/publication/PUB500001.html" as const;

/**
 * Environment variable containing the authenticated ISO 3166-1 CSV URL.
 *
 * @category configuration
 * @since 0.0.0
 */
export const ISO3166_PART1_CSV_URL_ENV = "BEEP_ISO3166_PART1_CSV_URL" as const;

/**
 * Environment variable containing the authenticated ISO 3166-2 CSV URL.
 *
 * @category configuration
 * @since 0.0.0
 */
export const ISO3166_PART2_CSV_URL_ENV = "BEEP_ISO3166_PART2_CSV_URL" as const;

/**
 * Optional environment variable containing a single HTTP auth header.
 *
 * @category configuration
 * @since 0.0.0
 */
export const ISO3166_AUTH_HEADER_ENV = "BEEP_ISO3166_AUTH_HEADER" as const;

class Iso3166CountryEntry extends S.Class<Iso3166CountryEntry>($I`Iso3166CountryEntry`)(
  {
    alpha2: S.String,
    alpha3: S.String,
    numeric: S.String,
    name: S.String,
    flagEmoji: S.String,
  },
  $I.annote("Iso3166CountryEntry", {
    description: "Normalized ISO 3166-1 country entry rendered into @beep/data.",
  })
) {}

class Iso3166SubdivisionEntry extends S.Class<Iso3166SubdivisionEntry>($I`Iso3166SubdivisionEntry`)(
  {
    code: S.String,
    countryAlpha2: S.String,
    localCode: S.String,
    name: S.String,
    type: S.String,
    parentCode: S.optionalKey(S.String),
  },
  $I.annote("Iso3166SubdivisionEntry", {
    description: "Normalized ISO 3166-2 subdivision entry rendered into @beep/data.",
  })
) {}

type Iso3166CountryEntryType = Iso3166CountryEntry;
type Iso3166SubdivisionEntryType = Iso3166SubdivisionEntry;
type CsvRow = ParsedCsvRecords[number];

const alpha2Pattern = /^[A-Z]{2}$/u;
const alpha3Pattern = /^[A-Z]{3}$/u;
const numericPattern = /^\d{3}$/u;
const subdivisionCodePattern = /^([A-Z]{2})-(.+)$/u;
const authHeaderPattern = /^([^:]+):\s*(.+)$/u;
const regionalIndicatorSymbolLetterA = 0x1f1e6;
const latinCapitalLetterA = 0x41;
const regionalIndicatorOffset = regionalIndicatorSymbolLetterA - latinCapitalLetterA;

const countryAlpha2Aliases = [
  "alpha-2 code",
  "alpha 2 code",
  "alpha_2",
  "alpha2",
  "iso 3166-1 alpha-2",
  "iso 3166-1 alpha 2",
];
const countryAlpha3Aliases = [
  "alpha-3 code",
  "alpha 3 code",
  "alpha_3",
  "alpha3",
  "iso 3166-1 alpha-3",
  "iso 3166-1 alpha 3",
];
const countryNumericAliases = ["numeric code", "numeric", "number", "iso 3166-1 numeric", "iso 3166-1 numeric code"];
const countryNameAliases = ["name", "short name", "english short name", "country name", "official short name"];
const subdivisionCodeAliases = ["code", "subdivision code", "iso 3166-2 code", "iso3166-2 code"];
const subdivisionNameAliases = ["name", "subdivision name", "english name"];
const subdivisionTypeAliases = ["type", "subdivision type", "category"];
const subdivisionParentAliases = ["parent", "parent code", "parent subdivision", "parent subdivision code"];

const normalizeWhitespace = flow(Str.replaceAll(/\s+/gu, " "), Str.trim);
const normalizeHeader = flow(Str.toLocaleLowerCase("en-US"), Str.replaceAll(/[^a-z0-9]+/gu, ""));
const normalizeUpperAscii = flow(normalizeWhitespace, Str.toLocaleUpperCase("en-US"));
const normalizeOptionalCell = flow(normalizeWhitespace, O.liftPredicate(Str.isNonEmpty));
const codePointToString = (codePoint: number): string => globalThis.String.fromCodePoint(codePoint);
const regionalIndicatorFromLetter = (letter: string): string =>
  codePointToString(regionalIndicatorOffset + letter.charCodeAt(0));
const countryFlagEmoji: (alpha2: string) => string = flow(
  Str.split(""),
  A.map(regionalIndicatorFromLetter),
  A.join("")
);

const normalizedRow = (row: CsvRow): Record<string, string> =>
  pipe(
    R.toEntries(row),
    A.map(([key, value]) => [normalizeHeader(key), normalizeWhitespace(value)] as const),
    R.fromEntries
  );

const findCell = (
  row: Record<string, string>,
  aliases: ReadonlyArray<string>,
  label: string
): Effect.Effect<string, SyncDataToTsError> =>
  pipe(
    aliases,
    A.findFirst((alias) => pipe(R.get(row, normalizeHeader(alias)), O.filter(Str.isNonEmpty), O.isSome)),
    O.flatMap((alias) => R.get(row, normalizeHeader(alias))),
    O.filter(Str.isNonEmpty),
    Effect.fromOption,
    Effect.mapError(() =>
      SyncDataToTsError.make({
        message: `Missing required ISO 3166 CSV column for ${label}.`,
        targetId,
      })
    )
  );

const findOptionalCell = (row: Record<string, string>, aliases: ReadonlyArray<string>): O.Option<string> =>
  pipe(
    aliases,
    A.findFirst((alias) => pipe(R.get(row, normalizeHeader(alias)), O.flatMap(normalizeOptionalCell), O.isSome)),
    O.flatMap((alias) => R.get(row, normalizeHeader(alias))),
    O.flatMap(normalizeOptionalCell)
  );

const normalizePatternedCell = (
  value: string,
  pattern: RegExp,
  label: string,
  rowLabel: string
): Effect.Effect<string, SyncDataToTsError> => {
  const normalized = normalizeUpperAscii(value);
  return pattern.test(normalized)
    ? Effect.succeed(normalized)
    : Effect.fail(
        SyncDataToTsError.make({
          message: `Invalid ISO 3166 ${label} "${value}" in ${rowLabel}.`,
          targetId,
        })
      );
};

const normalizeCountryNumeric = (value: string, rowLabel: string): Effect.Effect<string, SyncDataToTsError> => {
  const normalized = normalizeWhitespace(value).padStart(3, "0");
  return numericPattern.test(normalized)
    ? Effect.succeed(normalized)
    : Effect.fail(
        SyncDataToTsError.make({
          message: `Invalid ISO 3166 numeric code "${value}" in ${rowLabel}.`,
          targetId,
        })
      );
};

const normalizeCountryRow = Effect.fn("SyncDataToTs.Iso3166.normalizeCountryRow")(function* (row: CsvRow) {
  const normalized = normalizedRow(row);
  const name = yield* findCell(normalized, countryNameAliases, "country name").pipe(Effect.map(normalizeWhitespace));
  const alpha2 = yield* findCell(normalized, countryAlpha2Aliases, "alpha-2").pipe(
    Effect.flatMap((value) => normalizePatternedCell(value, alpha2Pattern, "alpha-2 code", name))
  );
  const alpha3 = yield* findCell(normalized, countryAlpha3Aliases, "alpha-3").pipe(
    Effect.flatMap((value) => normalizePatternedCell(value, alpha3Pattern, "alpha-3 code", name))
  );
  const numeric = yield* findCell(normalized, countryNumericAliases, "numeric code").pipe(
    Effect.flatMap((value) => normalizeCountryNumeric(value, name))
  );

  return Iso3166CountryEntry.make({
    alpha2,
    alpha3,
    numeric,
    name,
    flagEmoji: countryFlagEmoji(alpha2),
  });
});

const normalizeSubdivisionCodeParts = (
  code: string,
  rowLabel: string
): Effect.Effect<readonly [countryAlpha2: string, localCode: string], SyncDataToTsError> => {
  const normalized = normalizeUpperAscii(code);
  const match = subdivisionCodePattern.exec(normalized);
  return match !== null && P.isString(match[1]) && P.isString(match[2])
    ? Effect.succeed([match[1], match[2]] as const)
    : Effect.fail(
        SyncDataToTsError.make({
          message: `Invalid ISO 3166-2 subdivision code "${code}" in ${rowLabel}.`,
          targetId,
        })
      );
};

const normalizeSubdivisionRow = Effect.fn("SyncDataToTs.Iso3166.normalizeSubdivisionRow")(function* (row: CsvRow) {
  const normalized = normalizedRow(row);
  const name = yield* findCell(normalized, subdivisionNameAliases, "subdivision name").pipe(
    Effect.map(normalizeWhitespace)
  );
  const code = yield* findCell(normalized, subdivisionCodeAliases, "subdivision code").pipe(
    Effect.map(normalizeUpperAscii)
  );
  const [countryAlpha2, localCode] = yield* normalizeSubdivisionCodeParts(code, name);
  const type = yield* findCell(normalized, subdivisionTypeAliases, "subdivision type").pipe(
    Effect.map(normalizeWhitespace)
  );
  const parentCode = pipe(
    findOptionalCell(normalized, subdivisionParentAliases),
    O.map(normalizeUpperAscii),
    O.filter((value) => value !== code)
  );

  return Iso3166SubdivisionEntry.make({
    code,
    countryAlpha2,
    localCode,
    name,
    type,
    ...O.getSomesStruct({ parentCode }),
  });
});

const assertUnique = Effect.fn("SyncDataToTs.Iso3166.assertUnique")(function* <Entry>(
  values: ReadonlyArray<Entry>,
  label: string,
  valueOf: (entry: Entry) => string
) {
  const seen = MutableHashMap.empty<string, string>();

  for (const entry of values) {
    const value = valueOf(entry);
    const existing = MutableHashMap.get(seen, value);

    if (O.isSome(existing)) {
      return yield* SyncDataToTsError.make({
        message: `Duplicate ISO 3166 ${label} value "${value}".`,
        targetId,
      });
    }

    MutableHashMap.set(seen, value, value);
  }
});

const byAlpha2 = (values: ReadonlyArray<Iso3166CountryEntryType>) =>
  R.fromEntries(A.map(values, (entry) => [entry.alpha2, entry] as const));

const byAlpha3 = (values: ReadonlyArray<Iso3166CountryEntryType>) =>
  R.fromEntries(A.map(values, (entry) => [entry.alpha3, entry] as const));

const byNumeric = (values: ReadonlyArray<Iso3166CountryEntryType>) =>
  R.fromEntries(A.map(values, (entry) => [entry.numeric, entry] as const));

const countryNameByAlpha2 = (values: ReadonlyArray<Iso3166CountryEntryType>) =>
  R.fromEntries(A.map(values, (entry) => [entry.alpha2, entry.name] as const));

const countryAlpha2NamePairs = (values: ReadonlyArray<Iso3166CountryEntryType>) =>
  A.map(values, (entry) => [entry.alpha2, entry.name] as const);

const countryFlagEmojiByAlpha2 = (values: ReadonlyArray<Iso3166CountryEntryType>) =>
  R.fromEntries(A.map(values, (entry) => [entry.alpha2, entry.flagEmoji] as const));

const countryAlpha2FlagEmojiPairs = (values: ReadonlyArray<Iso3166CountryEntryType>) =>
  A.map(values, (entry) => [entry.alpha2, entry.flagEmoji] as const);

const bySubdivisionCode = (values: ReadonlyArray<Iso3166SubdivisionEntryType>) =>
  R.fromEntries(A.map(values, (entry) => [entry.code, entry] as const));

const subdivisionNameByCode = (values: ReadonlyArray<Iso3166SubdivisionEntryType>) =>
  R.fromEntries(A.map(values, (entry) => [entry.code, entry.name] as const));

const subdivisionsByCountryAlpha2: (
  values: ReadonlyArray<Iso3166SubdivisionEntryType>
) => Record<string, ReadonlyArray<Iso3166SubdivisionEntryType>> = A.reduce(
  {} as Record<string, ReadonlyArray<Iso3166SubdivisionEntryType>>,
  (acc, entry) => ({
    ...acc,
    [entry.countryAlpha2]: pipe(
      R.get(acc, entry.countryAlpha2),
      O.map((entries) => A.append(entries, entry)),
      O.getOrElse((): ReadonlyArray<Iso3166SubdivisionEntryType> => [entry])
    ),
  })
);

const renderIso3166Module = (
  sources: ReadonlyArray<SyncDataSourceMetadata>,
  countries: ReadonlyArray<Iso3166CountryEntryType>,
  subdivisions: ReadonlyArray<Iso3166SubdivisionEntryType>
): string => `/**
 * Generated ISO 3166 country and subdivision data.
 *
 * Generated by \`bun run beep sync-data-to-ts --target iso3166\`.
 * Source: ${formatTsDocCommentValue(ISO3166_SOURCE_URL)}
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Stable source metadata for the official ISO 3166 Country Codes Collection exports.
 *
 * @category constants
 * @since 0.0.0
 */
export const Iso3166DataMetadata = ${formatTsLiteral({
  sourceUrl: ISO3166_SOURCE_URL,
  sources,
})} as const;

/**
 * Official public source URL for the ISO Country Codes Collection.
 *
 * @category constants
 * @since 0.0.0
 */
export const Iso3166DataSourceUrl = ${formatTsLiteral(ISO3166_SOURCE_URL)} as const;

/**
 * Normalized ISO 3166-1 country entries.
 *
 * @category constants
 * @since 0.0.0
 */
export const Iso3166CountryDataValues = ${formatTsLiteral(countries)} as const;

/**
 * ISO 3166-1 country entries keyed by alpha-2 code.
 *
 * @category constants
 * @since 0.0.0
 */
export const Iso3166CountryDataByAlpha2 = ${formatTsLiteral(byAlpha2(countries))} as const;

/**
 * ISO 3166-1 country entries keyed by alpha-3 code.
 *
 * @category constants
 * @since 0.0.0
 */
export const Iso3166CountryDataByAlpha3 = ${formatTsLiteral(byAlpha3(countries))} as const;

/**
 * ISO 3166-1 country entries keyed by numeric code.
 *
 * @category constants
 * @since 0.0.0
 */
export const Iso3166CountryDataByNumeric = ${formatTsLiteral(byNumeric(countries))} as const;

/**
 * ISO 3166-1 alpha-2 code literals.
 *
 * @category constants
 * @since 0.0.0
 */
export const Iso3166CountryAlpha2Values = ${formatTsLiteral(A.map(countries, (entry) => entry.alpha2))} as const;

/**
 * ISO 3166-1 alpha-3 code literals.
 *
 * @category constants
 * @since 0.0.0
 */
export const Iso3166CountryAlpha3Values = ${formatTsLiteral(A.map(countries, (entry) => entry.alpha3))} as const;

/**
 * ISO 3166-1 numeric code literals.
 *
 * @category constants
 * @since 0.0.0
 */
export const Iso3166CountryNumericValues = ${formatTsLiteral(A.map(countries, (entry) => entry.numeric))} as const;

/**
 * ISO 3166-1 country names keyed by alpha-2 code.
 *
 * @category constants
 * @since 0.0.0
 */
export const Iso3166CountryNameByAlpha2 = ${formatTsLiteral(countryNameByAlpha2(countries))} as const;

/**
 * ISO 3166-1 alpha-2 code to country-name literal pairs.
 *
 * @category constants
 * @since 0.0.0
 */
export const Iso3166CountryAlpha2NamePairs = ${formatTsLiteral(countryAlpha2NamePairs(countries))} as const;

/**
 * Unicode flag emoji keyed by ISO 3166-1 alpha-2 code.
 *
 * @category constants
 * @since 0.0.0
 */
export const Iso3166CountryFlagEmojiByAlpha2 = ${formatTsLiteral(countryFlagEmojiByAlpha2(countries))} as const;

/**
 * ISO 3166-1 alpha-2 code to Unicode flag emoji literal pairs.
 *
 * @category constants
 * @since 0.0.0
 */
export const Iso3166CountryAlpha2FlagEmojiPairs = ${formatTsLiteral(countryAlpha2FlagEmojiPairs(countries))} as const;

/**
 * Normalized ISO 3166-2 subdivision entries.
 *
 * @category constants
 * @since 0.0.0
 */
export const Iso3166SubdivisionDataValues = ${formatTsLiteral(subdivisions)} as const;

/**
 * ISO 3166-2 subdivision entries keyed by full subdivision code.
 *
 * @category constants
 * @since 0.0.0
 */
export const Iso3166SubdivisionDataByCode = ${formatTsLiteral(bySubdivisionCode(subdivisions))} as const;

/**
 * ISO 3166-2 subdivision code literals.
 *
 * @category constants
 * @since 0.0.0
 */
export const Iso3166SubdivisionCodeValues = ${formatTsLiteral(A.map(subdivisions, (entry) => entry.code))} as const;

/**
 * ISO 3166-2 subdivision names keyed by full subdivision code.
 *
 * @category constants
 * @since 0.0.0
 */
export const Iso3166SubdivisionNameByCode = ${formatTsLiteral(subdivisionNameByCode(subdivisions))} as const;

/**
 * ISO 3166-2 subdivision entries grouped by ISO 3166-1 alpha-2 country code.
 *
 * @category constants
 * @since 0.0.0
 */
export const Iso3166SubdivisionDataByCountryAlpha2 = ${formatTsLiteral(subdivisionsByCountryAlpha2(subdivisions))} as const;
`;

const normalizeCountries = Effect.fn("SyncDataToTs.Iso3166.normalizeCountries")(function* (rows: ParsedCsvRecords) {
  const values = yield* Effect.forEach(rows, normalizeCountryRow, { concurrency: 1 }).pipe(
    Effect.map(A.sort(Order.mapInput(Order.String, ({ alpha2 }: Iso3166CountryEntryType) => alpha2)))
  );
  yield* assertUnique(values, "alpha-2", (entry) => entry.alpha2);
  yield* assertUnique(values, "alpha-3", (entry) => entry.alpha3);
  yield* assertUnique(values, "numeric", (entry) => entry.numeric);
  yield* assertUnique(values, "country name", (entry) => entry.name);
  yield* assertUnique(values, "flag emoji", (entry) => entry.flagEmoji);
  return values;
});

const normalizeSubdivisions = Effect.fn("SyncDataToTs.Iso3166.normalizeSubdivisions")(function* (
  rows: ParsedCsvRecords,
  countriesByCode: Readonly<Record<string, Iso3166CountryEntryType>>
) {
  const values = yield* Effect.forEach(rows, normalizeSubdivisionRow, { concurrency: 1 }).pipe(
    Effect.map(A.sort(Order.mapInput(Order.String, ({ code }: Iso3166SubdivisionEntryType) => code)))
  );
  yield* assertUnique(values, "subdivision code", (entry) => entry.code);

  for (const entry of values) {
    if (!R.has(entry.countryAlpha2)(countriesByCode)) {
      return yield* SyncDataToTsError.make({
        message: `ISO 3166-2 subdivision ${entry.code} references unknown country ${entry.countryAlpha2}.`,
        targetId,
      });
    }
  }

  return values;
});

const readRequiredRedactedConfig = (key: string): Effect.Effect<Redacted.Redacted<string>, SyncDataToTsError> =>
  Config.redacted(key).pipe(
    Effect.mapError((cause) =>
      SyncDataToTsError.make({
        message: `${key} is required for the authenticated ISO 3166 sync target.`,
        targetId,
        cause,
      })
    ),
    Effect.filterOrFail(
      (value) => Str.isNonEmpty(normalizeWhitespace(Redacted.value(value))),
      () =>
        SyncDataToTsError.make({
          message: `${key} is required for the authenticated ISO 3166 sync target.`,
          targetId,
        })
    )
  );

const parseAuthHeader = (value: string): O.Option<readonly [string, string]> => {
  const header = normalizeWhitespace(value);
  const match = authHeaderPattern.exec(header);

  return Str.isNonEmpty(header)
    ? O.some(
        match !== null && P.isString(match[1]) && P.isString(match[2])
          ? ([normalizeWhitespace(match[1]), normalizeWhitespace(match[2])] as const)
          : (["Authorization", header] as const)
      )
    : O.none();
};

const authHeadersFromConfig = Effect.fn("SyncDataToTs.Iso3166.authHeadersFromConfig")(function* () {
  const authHeader = yield* Config.redacted(ISO3166_AUTH_HEADER_ENV).pipe(
    Config.option,
    Effect.mapError((cause) =>
      SyncDataToTsError.make({
        message: `Failed to read optional ${ISO3166_AUTH_HEADER_ENV} for the authenticated ISO 3166 sync target.`,
        targetId,
        cause,
      })
    )
  );

  return pipe(
    authHeader,
    O.flatMap((value) => parseAuthHeader(Redacted.value(value))),
    O.map(([name, value]) => ({ [name]: value })),
    O.getOrElse((): Readonly<Record<string, string>> => ({}))
  );
});

const fetchIso3166Csv = Effect.fn("SyncDataToTs.Iso3166.fetchCsv")(function* (
  id: string,
  requestUrl: Redacted.Redacted<string>,
  headers: Readonly<Record<string, string>>
) {
  const source = yield* fetchSource(targetId, id, Redacted.value(requestUrl), {
    headers,
    publicUrl: ISO3166_SOURCE_URL,
  });
  const rows = yield* parseCsvSource(targetId, source);
  return { source, rows } as const;
});

const acquireIso3166Projection = Effect.fn("SyncDataToTs.Iso3166.acquire")(function* () {
  const part1Url = yield* readRequiredRedactedConfig(ISO3166_PART1_CSV_URL_ENV);
  const part2Url = yield* readRequiredRedactedConfig(ISO3166_PART2_CSV_URL_ENV);
  const headers = yield* authHeadersFromConfig();
  const part1 = yield* fetchIso3166Csv("iso3166-1-csv", part1Url, headers);
  const part2 = yield* fetchIso3166Csv("iso3166-2-csv", part2Url, headers);
  const countries = yield* normalizeCountries(part1.rows);
  const subdivisions = yield* normalizeSubdivisions(part2.rows, byAlpha2(countries));
  const sources = [
    sourceMetadata(part1.source, { version: "ISO 3166-1" }),
    sourceMetadata(part2.source, { version: "ISO 3166-2" }),
  ];
  const canonical = yield* normalizeJson(targetId, {
    schemaVersion: "beep-data/iso3166/v1",
    metadata: {
      sourceUrl: ISO3166_SOURCE_URL,
      sources,
    },
    countriesByAlpha2: byAlpha2(countries),
    countriesByAlpha3: byAlpha3(countries),
    countriesByNumeric: byNumeric(countries),
    subdivisionsByCode: bySubdivisionCode(subdivisions),
    subdivisionsByCountryAlpha2: subdivisionsByCountryAlpha2(subdivisions),
  });

  return SyncDataTargetProjection.make({
    files: [
      outputFile(outputPath, renderIso3166Module(sources, countries, subdivisions)),
      outputFile(canonicalPath, formatJson(canonical)),
    ],
    canonicalPath,
    canonical,
    recordCount: A.length(countries) + A.length(subdivisions),
    summary: `${A.length(countries)} country entries and ${A.length(subdivisions)} subdivision entries`,
    sources,
  });
});

/**
 * Checked-in sync target for the official ISO 3166 Country Codes Collection CSV exports.
 *
 * @category configuration
 * @since 0.0.0
 */
export const iso3166Target: SyncDataTarget = {
  id: targetId,
  access: "authenticated",
  description: "Sync official ISO 3166-1 country and ISO 3166-2 subdivision codes from the Country Codes Collection.",
  sourceUrls: [ISO3166_SOURCE_URL],
  acquire: acquireIso3166Projection(),
};
