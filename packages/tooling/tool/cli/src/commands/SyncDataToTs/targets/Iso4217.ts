/**
 * Official ISO 4217 target definition.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import { Effect, flow, MutableHashMap, Order, pipe } from "effect";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { SyncDataTargetProjection, SyncDataToTsError } from "../internal/Models.js";
import {
  fetchSource,
  formatJson,
  formatTsLiteral,
  outputFile,
  parseXmlSource,
  sourceMetadata,
} from "../internal/Source.js";
import type { SyncDataTarget } from "../internal/Models.js";

const $I = $RepoCliId.create("commands/SyncDataToTs/targets/Iso4217");
const targetId = "iso4217" as const;
const outputPath = "packages/foundation/primitive/data/src/generated/iso4217.ts" as const;
const canonicalPath = "packages/foundation/primitive/data/src/generated/iso4217.data.json" as const;

/**
 * Official SIX XML source for ISO 4217 List One.
 *
 * @example
 * ```ts
 * import { ISO4217_SOURCE_URL } from "@beep/repo-cli/commands/SyncDataToTs"
 * console.log(ISO4217_SOURCE_URL)
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const ISO4217_SOURCE_URL =
  "https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml" as const;

class Iso4217CurrencyNameWithMetadata extends S.Class<Iso4217CurrencyNameWithMetadata>(
  $I`Iso4217CurrencyNameWithMetadata`
)(
  {
    text: S.String,
    IsFund: S.optionalKey(S.String),
  },
  $I.annote("Iso4217CurrencyNameWithMetadata", {
    description: "Currency name node emitted when the ISO 4217 XML uses inline attributes.",
  })
) {}

const Iso4217CurrencyName = S.Union([S.String, Iso4217CurrencyNameWithMetadata]).pipe(
  $I.annoteSchema("Iso4217CurrencyName", {
    description: "Currency name node emitted by the ISO 4217 XML parser.",
  })
);

class Iso4217CurrencyCountry extends S.Class<Iso4217CurrencyCountry>($I`Iso4217CurrencyCountry`)(
  {
    CtryNm: S.String,
    CcyNm: Iso4217CurrencyName,
    Ccy: S.optionalKey(S.String),
    CcyNbr: S.optionalKey(S.String),
    CcyMnrUnts: S.optionalKey(S.String),
  },
  $I.annote("Iso4217CurrencyCountry", {
    description: "Single country or fund row from the official ISO 4217 List One XML document.",
  })
) {}

class Iso4217CurrencyTable extends S.Class<Iso4217CurrencyTable>($I`Iso4217CurrencyTable`)(
  {
    CcyNtry: Iso4217CurrencyCountry.pipe(S.Array),
  },
  $I.annote("Iso4217CurrencyTable", {
    description: "Currency table section from the official ISO 4217 XML document.",
  })
) {}

class Iso4217Root extends S.Class<Iso4217Root>($I`Iso4217Root`)(
  {
    Pblshd: S.String,
    CcyTbl: Iso4217CurrencyTable,
  },
  $I.annote("Iso4217Root", {
    description: "Top-level ISO 4217 XML document payload.",
  })
) {}

class Iso4217Document extends S.Class<Iso4217Document>($I`Iso4217Document`)(
  {
    ISO_4217: Iso4217Root,
  },
  $I.annote("Iso4217Document", {
    description: "Decoded XML document for the official SIX ISO 4217 List One feed.",
  })
) {}

class Iso4217CurrencyEntry extends S.Class<Iso4217CurrencyEntry>($I`Iso4217CurrencyEntry`)(
  {
    code: S.String,
    number: S.String,
    digits: S.Finite,
    currency: S.String,
    countries: S.Array(S.String),
  },
  $I.annote("Iso4217CurrencyEntry", {
    description: "Normalized ISO 4217 currency entry rendered into @beep/data.",
  })
) {}

type Iso4217CurrencyEntryType = Iso4217CurrencyEntry;
const isIso4217CurrencyNameWithMetadata = S.is(Iso4217CurrencyNameWithMetadata);

const normalizeWhitespace = flow(Str.replaceAll(/\s+/gu, " "), Str.trim);

const normalizeCountryName = flow(normalizeWhitespace, Str.toLocaleLowerCase("en-US"), (str) =>
  Str.replaceAllWith(/(^|[\s()/_',.-])([\p{L}\p{N}])/gu, (_wholeMatch, ...args) => {
    const prefix = args[0];
    const segment = args[1];
    return `${P.isString(prefix) ? prefix : ""}${P.isString(segment) ? Str.toLocaleUpperCase("en-US")(segment) : ""}`;
  })(str)
);

const extractCurrencyName = (value: typeof Iso4217CurrencyName.Type): string =>
  isIso4217CurrencyNameWithMetadata(value) ? value.text : value;

const parseMinorUnits = (value: string, code: string): Effect.Effect<number, SyncDataToTsError> =>
  value === "N.A."
    ? Effect.succeed(0)
    : (() => {
        const parsed = Number.parseInt(value, 10);
        return Number.isNaN(parsed)
          ? Effect.fail(
              SyncDataToTsError.make({
                message: `Failed to normalize ISO 4217 minor units for ${code}: invalid minor unit "${value}".`,
                targetId,
              })
            )
          : Effect.succeed(parsed);
      })();

const byCode = (values: ReadonlyArray<Iso4217CurrencyEntryType>) =>
  R.fromEntries(A.map(values, (entry) => [entry.code, entry] as const));

const nameByCode = (values: ReadonlyArray<Iso4217CurrencyEntryType>) =>
  R.fromEntries(A.map(values, (entry) => [entry.code, entry.currency] as const));

const codeNamePairs = (values: ReadonlyArray<Iso4217CurrencyEntryType>) =>
  A.map(values, (entry) => [entry.code, entry.currency] as const);

const renderIso4217Module = (
  published: string,
  sha256: string,
  values: ReadonlyArray<Iso4217CurrencyEntryType>
): string => {
  const sample: Iso4217CurrencyEntryType = O.getOrElse(
    A.findFirst(values, (entry) => entry.code === "USD"),
    () =>
      values[0] ??
      Iso4217CurrencyEntry.make({ code: "USD", number: "840", digits: 2, currency: "US Dollar", countries: [] })
  );

  return `/**
 * Generated ISO 4217 currency data.
 *
 * Generated by \`bun run beep sync-data-to-ts --target iso4217\`.
 * Source: ${ISO4217_SOURCE_URL}
 * Published: ${published}
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Stable source metadata for the official ISO 4217 List One feed.
 *
 * @example
 * \`\`\`typescript
 * import { CurrencyCodeDataMetadata } from "@beep/data/generated/iso4217"
 *
 * console.assert(CurrencyCodeDataMetadata.published === ${formatTsLiteral(published)})
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const CurrencyCodeDataMetadata = ${formatTsLiteral({
    sourceUrl: ISO4217_SOURCE_URL,
    published,
    sha256,
  })} as const;

/**
 * Published date reported by the official ISO 4217 List One feed.
 *
 * @example
 * \`\`\`typescript
 * import { CurrencyCodeDataPublished } from "@beep/data/generated/iso4217"
 *
 * console.assert(CurrencyCodeDataPublished === ${formatTsLiteral(published)})
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const CurrencyCodeDataPublished = ${formatTsLiteral(published)} as const;

/**
 * Official source URL for the ISO 4217 List One feed.
 *
 * @example
 * \`\`\`typescript
 * import { CurrencyCodeDataSourceUrl } from "@beep/data/generated/iso4217"
 *
 * console.assert(CurrencyCodeDataSourceUrl.includes("list-one.xml"))
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const CurrencyCodeDataSourceUrl = ${formatTsLiteral(ISO4217_SOURCE_URL)} as const;

/**
 * SHA-256 digest of the official source payload used for this generated module.
 *
 * @example
 * \`\`\`typescript
 * import { CurrencyCodeDataSourceSha256 } from "@beep/data/generated/iso4217"
 *
 * console.assert(CurrencyCodeDataSourceSha256.length === 64)
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const CurrencyCodeDataSourceSha256 = ${formatTsLiteral(sha256)} as const;

/**
 * Normalized ISO 4217 currency entries emitted from the official feed.
 *
 * @example
 * \`\`\`typescript
 * import { CurrencyCodeDataValues } from "@beep/data/generated/iso4217"
 *
 * const sample = CurrencyCodeDataValues.find((entry) => entry.code === ${formatTsLiteral(sample.code)})
 * console.assert(sample?.currency === ${formatTsLiteral(sample.currency)})
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const CurrencyCodeDataValues = ${formatTsLiteral(values)} as const;

/**
 * ISO 4217 currency entries keyed by alphabetic code.
 *
 * @example
 * \`\`\`typescript
 * import { CurrencyCodeDataByCode } from "@beep/data/generated/iso4217"
 *
 * console.assert(CurrencyCodeDataByCode.${sample.code}.digits === ${formatTsLiteral(sample.digits)})
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const CurrencyCodeDataByCode = ${formatTsLiteral(byCode(values))} as const;

/**
 * ISO 4217 alphabetic code literals.
 *
 * @example
 * \`\`\`typescript
 * import { CurrencyCodeDataCodeValues } from "@beep/data/generated/iso4217"
 *
 * console.assert(CurrencyCodeDataCodeValues.includes(${formatTsLiteral(sample.code)}))
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const CurrencyCodeDataCodeValues = ${formatTsLiteral(A.map(values, (entry) => entry.code))} as const;

/**
 * ISO 4217 currency names keyed by alphabetic code.
 *
 * @example
 * \`\`\`typescript
 * import { CurrencyCodeDataNameByCode } from "@beep/data/generated/iso4217"
 *
 * console.assert(CurrencyCodeDataNameByCode.${sample.code} === ${formatTsLiteral(sample.currency)})
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const CurrencyCodeDataNameByCode = ${formatTsLiteral(nameByCode(values))} as const;

/**
 * ISO 4217 alphabetic code to currency-name literal pairs.
 *
 * @example
 * \`\`\`typescript
 * import { CurrencyCodeDataCodeNamePairs } from "@beep/data/generated/iso4217"
 *
 * const sample = CurrencyCodeDataCodeNamePairs.find(([code]) => code === ${formatTsLiteral(sample.code)})
 * console.assert(sample?.[1] === ${formatTsLiteral(sample.currency)})
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const CurrencyCodeDataCodeNamePairs = ${formatTsLiteral(codeNamePairs(values))} as const;
`;
};

const normalizeIso4217Document = Effect.fn("SyncDataToTs.Iso4217.normalizeIso4217Document")(function* (
  document: unknown
) {
  const decoded = yield* S.decodeUnknownEffect(Iso4217Document)(document).pipe(
    SyncDataToTsError.mapError("Failed to decode the official ISO 4217 XML payload", targetId)
  );

  const published = decoded.ISO_4217.Pblshd;
  const grouped = MutableHashMap.empty<string, Iso4217CurrencyEntryType>();

  for (const row of decoded.ISO_4217.CcyTbl.CcyNtry) {
    if (P.isUndefined(row.Ccy) || P.isUndefined(row.CcyNbr) || P.isUndefined(row.CcyMnrUnts)) {
      if (extractCurrencyName(row.CcyNm) === "No universal currency") {
        continue;
      }

      return yield* SyncDataToTsError.make({
        message: `Encountered an unexpected ISO 4217 row without complete currency fields for ${row.CtryNm}.`,
        targetId,
      });
    }

    const country = normalizeCountryName(row.CtryNm);
    const currency = extractCurrencyName(row.CcyNm);
    const digits = yield* parseMinorUnits(row.CcyMnrUnts, row.Ccy);
    const existing = MutableHashMap.get(grouped, row.Ccy);

    if (O.isNone(existing)) {
      MutableHashMap.set(
        grouped,
        row.Ccy,
        Iso4217CurrencyEntry.make({
          code: row.Ccy,
          number: row.CcyNbr,
          digits,
          currency,
          countries: [country],
        })
      );
      continue;
    }

    if (
      existing.value.number !== row.CcyNbr ||
      existing.value.digits !== digits ||
      existing.value.currency !== currency
    ) {
      return yield* SyncDataToTsError.make({
        message: `Encountered inconsistent ISO 4217 currency data for ${row.Ccy}.`,
        targetId,
      });
    }

    const countries = A.some(existing.value.countries, Eq.equals(country))
      ? existing.value.countries
      : A.append(existing.value.countries, country);

    MutableHashMap.set(
      grouped,
      row.Ccy,
      Iso4217CurrencyEntry.make({
        ...existing.value,
        countries,
      })
    );
  }

  const values = pipe(
    A.fromIterable(MutableHashMap.values(grouped)),
    A.map((entry) =>
      Iso4217CurrencyEntry.make({
        ...entry,
        countries: A.sort(entry.countries, Order.String),
      })
    ),
    A.sort(Order.mapInput(Order.String, ({ code }: Iso4217CurrencyEntryType) => code))
  );

  return { published, values } as const;
});

const acquireIso4217Projection = Effect.fn("SyncDataToTs.Iso4217.acquire")(function* () {
  const source = yield* fetchSource(targetId, "six-list-one", ISO4217_SOURCE_URL);
  const document = yield* parseXmlSource(targetId, source);
  const { published, values } = yield* normalizeIso4217Document(document);
  const metadata = sourceMetadata(source, { published });
  const canonical = {
    schemaVersion: "beep-data/iso4217/v1",
    metadata,
    currenciesByCode: byCode(values),
  } as const;

  return SyncDataTargetProjection.make({
    files: [
      outputFile(outputPath, renderIso4217Module(published, source.sha256, values)),
      outputFile(canonicalPath, formatJson(canonical)),
    ],
    canonicalPath,
    canonical,
    recordCount: A.length(values),
    summary: `${A.length(values)} currency entries published ${published}`,
    sources: [metadata],
  });
});

/**
 * Checked-in sync target for the official SIX ISO 4217 List One XML feed.
 *
 * @example
 * ```ts
 * import { iso4217Target } from "@beep/repo-cli/commands/SyncDataToTs"
 * console.log(iso4217Target)
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const iso4217Target: SyncDataTarget = {
  id: targetId,
  access: "public",
  description: "Sync official ISO 4217 currency codes from SIX List One (XML).",
  sourceUrls: [ISO4217_SOURCE_URL],
  acquire: acquireIso4217Projection(),
};
