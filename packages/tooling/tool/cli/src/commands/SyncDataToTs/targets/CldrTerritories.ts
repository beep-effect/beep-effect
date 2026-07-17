/**
 * Unicode CLDR territory and continent target definition.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A } from "@beep/utils";
import { Effect, MutableHashMap, Order, pipe } from "effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  fetchSource,
  formatJson,
  formatTsDocCommentValue,
  formatTsLiteral,
  normalizeJson,
  outputFile,
  parseJsonSource,
  sourceMetadata,
} from "../internal/Source.ts";
import { SyncDataTargetProjection, SyncDataToTsError } from "../SyncDataToTs.schemas.ts";
import type { SyncDataSourceMetadata, SyncDataTarget } from "../SyncDataToTs.schemas.ts";

const $I = $RepoCliId.create("commands/SyncDataToTs/targets/CldrTerritories");
const targetId = "cldr-territories" as const;
const outputPath = "packages/foundation/primitive/data/src/generated/cldr-territories.ts" as const;
const canonicalPath = "packages/foundation/primitive/data/src/generated/cldr-territories.data.json" as const;

/**
 * GitHub release endpoint for the latest CLDR JSON release.
 *
 * @category configuration
 * @since 0.0.0
 */
export const CLDR_JSON_LATEST_RELEASE_URL =
  "https://api.github.com/repos/unicode-org/cldr-json/releases/latest" as const;

class CldrGithubRelease extends S.Class<CldrGithubRelease>($I`CldrGithubRelease`)(
  {
    tag_name: S.String,
    published_at: S.String,
  },
  $I.annote("CldrGithubRelease", {
    description: "Latest GitHub release metadata for unicode-org/cldr-json.",
  })
) {}

class CldrVersion extends S.Class<CldrVersion>($I`CldrVersion`)(
  {
    _unicodeVersion: S.String,
    _cldrVersion: S.String,
  },
  $I.annote("CldrVersion", {
    description: "CLDR supplemental version metadata.",
  })
) {}

class CldrContainmentEntry extends S.Class<CldrContainmentEntry>($I`CldrContainmentEntry`)(
  {
    _contains: S.Array(S.String),
    _grouping: S.optionalKey(S.String),
  },
  $I.annote("CldrContainmentEntry", {
    description: "CLDR territory containment row.",
  })
) {}

class CldrTerritoryContainmentSupplemental extends S.Class<CldrTerritoryContainmentSupplemental>(
  $I`CldrTerritoryContainmentSupplemental`
)(
  {
    version: CldrVersion,
    territoryContainment: S.Record(S.String, CldrContainmentEntry),
  },
  $I.annote("CldrTerritoryContainmentSupplemental", {
    description: "CLDR territory containment supplemental payload.",
  })
) {}

class CldrTerritoryContainmentDocument extends S.Class<CldrTerritoryContainmentDocument>(
  $I`CldrTerritoryContainmentDocument`
)(
  {
    supplemental: CldrTerritoryContainmentSupplemental,
  },
  $I.annote("CldrTerritoryContainmentDocument", {
    description: "Decoded CLDR territory containment JSON document.",
  })
) {}

class CldrTerritoryInfoSupplemental extends S.Class<CldrTerritoryInfoSupplemental>($I`CldrTerritoryInfoSupplemental`)(
  {
    version: CldrVersion,
    territoryInfo: S.Record(S.String, S.Unknown),
  },
  $I.annote("CldrTerritoryInfoSupplemental", {
    description: "CLDR territory info supplemental payload.",
  })
) {}

class CldrTerritoryInfoDocument extends S.Class<CldrTerritoryInfoDocument>($I`CldrTerritoryInfoDocument`)(
  {
    supplemental: CldrTerritoryInfoSupplemental,
  },
  $I.annote("CldrTerritoryInfoDocument", {
    description: "Decoded CLDR territory info JSON document.",
  })
) {}

class CldrLocaleTerritoryNames extends S.Class<CldrLocaleTerritoryNames>($I`CldrLocaleTerritoryNames`)(
  {
    territories: S.Record(S.String, S.String),
  },
  $I.annote("CldrLocaleTerritoryNames", {
    description: "English CLDR territory display names.",
  })
) {}

class CldrLocaleDisplayNames extends S.Class<CldrLocaleDisplayNames>($I`CldrLocaleDisplayNames`)(
  {
    localeDisplayNames: CldrLocaleTerritoryNames,
  },
  $I.annote("CldrLocaleDisplayNames", {
    description: "CLDR locale display name payload.",
  })
) {}

class CldrTerritoryNamesMain extends S.Class<CldrTerritoryNamesMain>($I`CldrTerritoryNamesMain`)(
  {
    en: CldrLocaleDisplayNames,
  },
  $I.annote("CldrTerritoryNamesMain", {
    description: "CLDR territory names document's locale-keyed main payload.",
  })
) {}

class CldrTerritoryNamesDocument extends S.Class<CldrTerritoryNamesDocument>($I`CldrTerritoryNamesDocument`)(
  {
    main: CldrTerritoryNamesMain,
  },
  $I.annote("CldrTerritoryNamesDocument", {
    description: "Decoded CLDR English territory names JSON document.",
  })
) {}

class CldrTerritoryEntry extends S.Class<CldrTerritoryEntry>($I`CldrTerritoryEntry`)(
  {
    code: S.String,
    name: S.String,
    continentCode: S.String,
    continentName: S.String,
  },
  $I.annote("CldrTerritoryEntry", {
    description: "Normalized CLDR territory entry rendered into @beep/data.",
  })
) {}

class CldrContinentEntry extends S.Class<CldrContinentEntry>($I`CldrContinentEntry`)(
  {
    code: S.String,
    name: S.String,
  },
  $I.annote("CldrContinentEntry", {
    description: "Normalized CLDR top-level territory containment entry rendered as a continent.",
  })
) {}

type CldrTerritoryEntryType = CldrTerritoryEntry;
type CldrContinentEntryType = CldrContinentEntry;
type CldrContainmentMap = CldrTerritoryContainmentDocument["supplemental"]["territoryContainment"];

const CLDR_RELEASE_RAW_FILES = {
  containment: "cldr-json/cldr-core/supplemental/territoryContainment.json",
  info: "cldr-json/cldr-core/supplemental/territoryInfo.json",
  names: "cldr-json/cldr-localenames-full/main/en/territories.json",
} as const;

const isAlpha2TerritoryCode = (code: string): boolean => /^[A-Z]{2}$/u.test(code);

const cldrRawUrl = (tag: string, path: string): string =>
  `https://raw.githubusercontent.com/unicode-org/cldr-json/${tag}/${path}`;

const decodeCldrRelease = (value: unknown) =>
  S.decodeUnknownEffect(CldrGithubRelease)(value).pipe(
    SyncDataToTsError.mapError("Failed to decode latest CLDR JSON GitHub release metadata", targetId)
  );

const decodeContainment = (value: unknown) =>
  S.decodeUnknownEffect(CldrTerritoryContainmentDocument)(value).pipe(
    SyncDataToTsError.mapError("Failed to decode CLDR territory containment JSON", targetId)
  );

const decodeInfo = (value: unknown) =>
  S.decodeUnknownEffect(CldrTerritoryInfoDocument)(value).pipe(
    SyncDataToTsError.mapError("Failed to decode CLDR territory info JSON", targetId)
  );

const decodeNames = (value: unknown) =>
  S.decodeUnknownEffect(CldrTerritoryNamesDocument)(value).pipe(
    SyncDataToTsError.mapError("Failed to decode CLDR English territory names JSON", targetId)
  );

const childrenOf = (containment: CldrContainmentMap, code: string): ReadonlyArray<string> =>
  pipe(
    R.get(containment, code),
    O.map((entry) => entry._contains),
    O.getOrElse((): ReadonlyArray<string> => [])
  );

const assignContinentDescendants = (
  containment: CldrContainmentMap,
  continentCode: string,
  code: string,
  out: MutableHashMap.MutableHashMap<string, string>
): void => {
  for (const child of childrenOf(containment, code)) {
    if (isAlpha2TerritoryCode(child)) {
      MutableHashMap.set(out, child, continentCode);
    }
    assignContinentDescendants(containment, continentCode, child, out);
  }
};

const continentByTerritoryCode = (containment: CldrContainmentMap): MutableHashMap.MutableHashMap<string, string> => {
  const out = MutableHashMap.empty<string, string>();
  for (const continentCode of childrenOf(containment, "001")) {
    assignContinentDescendants(containment, continentCode, continentCode, out);
  }
  return out;
};

const byCode = <Entry extends { readonly code: string }>(values: ReadonlyArray<Entry>) =>
  R.fromEntries(A.map(values, (entry) => [entry.code, entry] as const));

const nameByCode = <Entry extends { readonly code: string; readonly name: string }>(values: ReadonlyArray<Entry>) =>
  R.fromEntries(A.map(values, (entry) => [entry.code, entry.name] as const));

const codeNamePairs = <Entry extends { readonly code: string; readonly name: string }>(values: ReadonlyArray<Entry>) =>
  A.map(values, (entry) => [entry.code, entry.name] as const);

const renderCldrTerritoriesModule = (
  releaseTag: string,
  cldrVersion: string,
  unicodeVersion: string,
  sources: ReadonlyArray<SyncDataSourceMetadata>,
  territories: ReadonlyArray<CldrTerritoryEntryType>,
  continents: ReadonlyArray<CldrContinentEntryType>
): string => {
  const sampleTerritory: CldrTerritoryEntryType =
    territories[0] ??
    CldrTerritoryEntry.make({ code: "US", name: "United States", continentCode: "019", continentName: "Americas" });
  const sampleContinent: CldrContinentEntryType =
    continents[0] ?? CldrContinentEntry.make({ code: "002", name: "Africa" });

  return `/**
 * Generated Unicode CLDR territory and continent data.
 *
 * Generated by \`bun run beep sync-data-to-ts --target cldr-territories\`.
 * Source release: ${formatTsDocCommentValue(releaseTag)}
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Stable source metadata for the Unicode CLDR territory data release.
 *
 * @example
 * \`\`\`typescript
 * import { TerritoryDataMetadata } from "@beep/data/generated/cldr-territories"
 *
 * console.assert(TerritoryDataMetadata.releaseTag === ${formatTsLiteral(releaseTag)})
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const TerritoryDataMetadata = ${formatTsLiteral({
    releaseTag,
    cldrVersion,
    unicodeVersion,
    sources,
  })} as const;

/**
 * CLDR JSON release tag used for this generated module.
 *
 * @example
 * \`\`\`typescript
 * import { TerritoryDataReleaseTag } from "@beep/data/generated/cldr-territories"
 *
 * console.assert(TerritoryDataReleaseTag === ${formatTsLiteral(releaseTag)})
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const TerritoryDataReleaseTag = ${formatTsLiteral(releaseTag)} as const;

/**
 * Normalized CLDR territory entries.
 *
 * @example
 * \`\`\`typescript
 * import { TerritoryDataValues } from "@beep/data/generated/cldr-territories"
 *
 * const sample = TerritoryDataValues.find((entry) => entry.code === ${formatTsLiteral(sampleTerritory.code)})
 * console.assert(sample?.name === ${formatTsLiteral(sampleTerritory.name)})
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const TerritoryDataValues = ${formatTsLiteral(territories)} as const;

/**
 * Normalized CLDR territory entries keyed by territory code.
 *
 * @example
 * \`\`\`typescript
 * import { TerritoryDataByCode } from "@beep/data/generated/cldr-territories"
 *
 * console.assert(TerritoryDataByCode.${sampleTerritory.code}.name === ${formatTsLiteral(sampleTerritory.name)})
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const TerritoryDataByCode = ${formatTsLiteral(byCode(territories))} as const;

/**
 * CLDR territory code literals.
 *
 * @example
 * \`\`\`typescript
 * import { TerritoryCodeValues } from "@beep/data/generated/cldr-territories"
 *
 * console.assert(TerritoryCodeValues.includes(${formatTsLiteral(sampleTerritory.code)}))
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const TerritoryCodeValues = ${formatTsLiteral(A.map(territories, (entry) => entry.code))} as const;

/**
 * CLDR territory names keyed by territory code.
 *
 * @example
 * \`\`\`typescript
 * import { TerritoryDataNameByCode } from "@beep/data/generated/cldr-territories"
 *
 * console.assert(TerritoryDataNameByCode.${sampleTerritory.code} === ${formatTsLiteral(sampleTerritory.name)})
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const TerritoryDataNameByCode = ${formatTsLiteral(nameByCode(territories))} as const;

/**
 * CLDR territory code to English display-name literal pairs.
 *
 * @example
 * \`\`\`typescript
 * import { TerritoryDataCodeNamePairs } from "@beep/data/generated/cldr-territories"
 *
 * const sample = TerritoryDataCodeNamePairs.find(([code]) => code === ${formatTsLiteral(sampleTerritory.code)})
 * console.assert(sample?.[1] === ${formatTsLiteral(sampleTerritory.name)})
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const TerritoryDataCodeNamePairs = ${formatTsLiteral(codeNamePairs(territories))} as const;

/**
 * Normalized CLDR continent entries.
 *
 * @example
 * \`\`\`typescript
 * import { ContinentDataValues } from "@beep/data/generated/cldr-territories"
 *
 * const sample = ContinentDataValues.find((entry) => entry.code === ${formatTsLiteral(sampleContinent.code)})
 * console.assert(sample?.name === ${formatTsLiteral(sampleContinent.name)})
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const ContinentDataValues = ${formatTsLiteral(continents)} as const;

/**
 * Normalized CLDR continent entries keyed by CLDR region code.
 *
 * @example
 * \`\`\`typescript
 * import { ContinentDataByCode } from "@beep/data/generated/cldr-territories"
 *
 * console.assert(ContinentDataByCode[${formatTsLiteral(sampleContinent.code)}].name === ${formatTsLiteral(sampleContinent.name)})
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const ContinentDataByCode = ${formatTsLiteral(byCode(continents))} as const;

/**
 * CLDR continent code literals.
 *
 * @example
 * \`\`\`typescript
 * import { ContinentCodeValues } from "@beep/data/generated/cldr-territories"
 *
 * console.assert(ContinentCodeValues.includes(${formatTsLiteral(sampleContinent.code)}))
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const ContinentCodeValues = ${formatTsLiteral(A.map(continents, (entry) => entry.code))} as const;

/**
 * CLDR continent names keyed by CLDR region code.
 *
 * @example
 * \`\`\`typescript
 * import { ContinentDataNameByCode } from "@beep/data/generated/cldr-territories"
 *
 * console.assert(ContinentDataNameByCode[${formatTsLiteral(sampleContinent.code)}] === ${formatTsLiteral(sampleContinent.name)})
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const ContinentDataNameByCode = ${formatTsLiteral(nameByCode(continents))} as const;

/**
 * CLDR continent code to English display-name literal pairs.
 *
 * @example
 * \`\`\`typescript
 * import { ContinentDataCodeNamePairs } from "@beep/data/generated/cldr-territories"
 *
 * const sample = ContinentDataCodeNamePairs.find(([code]) => code === ${formatTsLiteral(sampleContinent.code)})
 * console.assert(sample?.[1] === ${formatTsLiteral(sampleContinent.name)})
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const ContinentDataCodeNamePairs = ${formatTsLiteral(codeNamePairs(continents))} as const;
`;
};

const fetchJson = Effect.fn("SyncDataToTs.CldrTerritories.fetchJson")(function* (id: string, url: string) {
  const source = yield* fetchSource(targetId, id, url);
  const json = yield* parseJsonSource(targetId, source);
  return { source, json } as const;
});

const releasePinnedSource = (
  releaseTag: string,
  id: keyof typeof CLDR_RELEASE_RAW_FILES
): {
  readonly id: string;
  readonly url: string;
} => ({
  id: `cldr-${id}`,
  url: cldrRawUrl(releaseTag, CLDR_RELEASE_RAW_FILES[id]),
});

const normalizeCldrTerritories = (
  releaseTag: string,
  containmentDocument: CldrTerritoryContainmentDocument,
  infoDocument: CldrTerritoryInfoDocument,
  namesDocument: CldrTerritoryNamesDocument
) => {
  const containment = containmentDocument.supplemental.territoryContainment;
  const version = containmentDocument.supplemental.version;
  const names = namesDocument.main.en.localeDisplayNames.territories;
  const territoryContinent = continentByTerritoryCode(containment);
  const topLevelContinentCodes = childrenOf(containment, "001");
  const continents = pipe(
    topLevelContinentCodes,
    A.map((code) =>
      CldrContinentEntry.make({
        code,
        name: pipe(
          R.get(names, code),
          O.getOrElse(() => code)
        ),
      })
    ),
    A.sort(Order.mapInput(Order.String, ({ code }: CldrContinentEntryType) => code))
  );
  const continentNames = nameByCode(continents);
  const territories = pipe(
    R.keys(infoDocument.supplemental.territoryInfo),
    A.filter(isAlpha2TerritoryCode),
    A.filter((code) => R.has(code)(names)),
    A.map((code) => {
      const continentCode = pipe(
        MutableHashMap.get(territoryContinent, code),
        O.getOrElse(() => "001")
      );
      return CldrTerritoryEntry.make({
        code,
        name: pipe(
          R.get(names, code),
          O.getOrElse(() => code)
        ),
        continentCode,
        continentName: pipe(
          R.get(continentNames, continentCode),
          O.getOrElse(() => "world")
        ),
      });
    }),
    A.sort(Order.mapInput(Order.String, ({ code }: CldrTerritoryEntryType) => code))
  );

  return {
    releaseTag,
    cldrVersion: version._cldrVersion,
    unicodeVersion: version._unicodeVersion,
    territories,
    continents,
  } as const;
};

const acquireCldrTerritoriesProjection = Effect.fn("SyncDataToTs.CldrTerritories.acquire")(function* () {
  const releaseSource = yield* fetchJson("cldr-latest-release", CLDR_JSON_LATEST_RELEASE_URL);
  const release = yield* decodeCldrRelease(releaseSource.json);
  const containmentLocator = releasePinnedSource(release.tag_name, "containment");
  const infoLocator = releasePinnedSource(release.tag_name, "info");
  const namesLocator = releasePinnedSource(release.tag_name, "names");
  const containmentSource = yield* fetchJson(containmentLocator.id, containmentLocator.url);
  const infoSource = yield* fetchJson(infoLocator.id, infoLocator.url);
  const namesSource = yield* fetchJson(namesLocator.id, namesLocator.url);
  const containmentDocument = yield* decodeContainment(containmentSource.json);
  const infoDocument = yield* decodeInfo(infoSource.json);
  const namesDocument = yield* decodeNames(namesSource.json);
  const normalized = normalizeCldrTerritories(release.tag_name, containmentDocument, infoDocument, namesDocument);
  const sources = [
    sourceMetadata(releaseSource.source, { version: release.tag_name, published: release.published_at }),
    sourceMetadata(containmentSource.source, { version: release.tag_name }),
    sourceMetadata(infoSource.source, { version: release.tag_name }),
    sourceMetadata(namesSource.source, { version: release.tag_name }),
  ];
  const canonical = yield* normalizeJson(targetId, {
    schemaVersion: "beep-data/cldr-territories/v1",
    metadata: {
      releaseTag: normalized.releaseTag,
      cldrVersion: normalized.cldrVersion,
      unicodeVersion: normalized.unicodeVersion,
      sources,
    },
    territoriesByCode: byCode(normalized.territories),
    continentsByCode: byCode(normalized.continents),
  });

  return SyncDataTargetProjection.make({
    files: [
      outputFile(
        outputPath,
        renderCldrTerritoriesModule(
          normalized.releaseTag,
          normalized.cldrVersion,
          normalized.unicodeVersion,
          sources,
          normalized.territories,
          normalized.continents
        )
      ),
      outputFile(canonicalPath, formatJson(canonical)),
    ],
    canonicalPath,
    canonical,
    recordCount: A.length(normalized.territories),
    summary: `${A.length(normalized.territories)} territories from CLDR ${normalized.releaseTag}`,
    sources,
  });
});

/**
 * Checked-in sync target for CLDR territory and continent data.
 *
 * @category configuration
 * @since 0.0.0
 */
export const cldrTerritoriesTarget: SyncDataTarget = {
  id: targetId,
  access: "public",
  description: "Sync CLDR territory and top-level containment data from the latest CLDR JSON release.",
  sourceUrls: [
    CLDR_JSON_LATEST_RELEASE_URL,
    "https://raw.githubusercontent.com/unicode-org/cldr-json/<release>/cldr-json/cldr-core/supplemental/territoryContainment.json",
    "https://raw.githubusercontent.com/unicode-org/cldr-json/<release>/cldr-json/cldr-core/supplemental/territoryInfo.json",
    "https://raw.githubusercontent.com/unicode-org/cldr-json/<release>/cldr-json/cldr-localenames-full/main/en/territories.json",
  ],
  acquire: acquireCldrTerritoriesProjection(),
};
