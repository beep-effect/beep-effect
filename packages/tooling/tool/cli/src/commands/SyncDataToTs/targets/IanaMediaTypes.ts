/**
 * Official IANA media type registry target definition.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { A, Str } from "@beep/utils";
import { Effect, FileSystem, flow, HashSet, Order, Path, pipe } from "effect";
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
  parseXmlSource,
  sourceMetadata,
} from "../internal/Source.ts";
import { SyncDataSourceMetadata, SyncDataTargetProjection, SyncDataToTsError } from "../SyncDataToTs.schemas.ts";
import type { SyncDataFetchedSource } from "../internal/Source.ts";
import type { SyncDataTarget } from "../SyncDataToTs.schemas.ts";

const $I = $RepoCliId.create("commands/SyncDataToTs/targets/IanaMediaTypes");
const targetId = "iana-media-types" as const;
const outputPath = "packages/foundation/primitive/data/src/generated/iana-media-types.ts" as const;
const canonicalPath = "packages/foundation/primitive/data/src/generated/iana-media-types.data.json" as const;

/**
 * Official IANA media type registry XML source.
 *
 * @category configuration
 * @since 0.0.0
 */
export const IANA_MEDIA_TYPES_SOURCE_URL = "https://www.iana.org/assignments/media-types/media-types.xml" as const;

class IanaMediaTypeTextNode extends S.Class<IanaMediaTypeTextNode>($I`IanaMediaTypeTextNode`)(
  {
    text: S.String,
  },
  $I.annote("IanaMediaTypeTextNode", {
    description: "XML text node emitted by the registry parser for selected fields.",
  })
) {}

const IanaMediaTypeName = S.Union([S.String, IanaMediaTypeTextNode]);

class IanaMediaTypeRecord extends S.Class<IanaMediaTypeRecord>($I`IanaMediaTypeRecord`)(
  {
    name: IanaMediaTypeName,
    date: S.optionalKey(S.String),
  },
  $I.annote("IanaMediaTypeRecord", {
    description: "Single IANA media type registry record.",
  })
) {}

class IanaMediaTypeRegistry extends S.Class<IanaMediaTypeRegistry>($I`IanaMediaTypeRegistry`)(
  {
    title: S.String,
    record: S.optionalKey(S.Union([IanaMediaTypeRecord, S.Array(IanaMediaTypeRecord)])),
  },
  $I.annote("IanaMediaTypeRegistry", {
    description: "Nested top-level IANA media type registry.",
  })
) {}

class IanaMediaTypesRoot extends S.Class<IanaMediaTypesRoot>($I`IanaMediaTypesRoot`)(
  {
    updated: S.String,
    registry: S.Array(IanaMediaTypeRegistry),
  },
  $I.annote("IanaMediaTypesRoot", {
    description: "Top-level IANA media type registry XML payload.",
  })
) {}

class IanaMediaTypesDocument extends S.Class<IanaMediaTypesDocument>($I`IanaMediaTypesDocument`)(
  {
    registry: IanaMediaTypesRoot,
  },
  $I.annote("IanaMediaTypesDocument", {
    description: "Decoded XML document for the official IANA media type registry.",
  })
) {}

class IanaMediaTypeEntry extends S.Class<IanaMediaTypeEntry>($I`IanaMediaTypeEntry`)(
  {
    type: S.String,
    topLevel: S.String,
    name: S.String,
    registryName: S.String,
    date: S.optionalKey(S.String),
  },
  $I.annote("IanaMediaTypeEntry", {
    description: "Normalized IANA media type entry rendered into @beep/data.",
  })
) {}

class IanaMediaTypesCanonicalMetadata extends S.Class<IanaMediaTypesCanonicalMetadata>(
  $I`IanaMediaTypesCanonicalMetadata`
)(
  {
    id: S.String,
    url: S.String,
    sha256: S.String,
    published: S.String,
  },
  $I.annote("IanaMediaTypesCanonicalMetadata", {
    description: "Checked-in source metadata for the IANA media type registry.",
  })
) {}

class IanaMediaTypesCanonical extends S.Class<IanaMediaTypesCanonical>($I`IanaMediaTypesCanonical`)(
  {
    schemaVersion: S.Literal("beep-data/iana-media-types/v1"),
    metadata: IanaMediaTypesCanonicalMetadata,
    mediaTypesByType: S.Record(S.String, IanaMediaTypeEntry),
  },
  $I.annote("IanaMediaTypesCanonical", {
    description: "Checked-in canonical IANA media type registry data.",
  })
) {}

type IanaMediaTypeEntryType = IanaMediaTypeEntry;
const isTextNode = S.is(IanaMediaTypeTextNode);
const primaryTopLevels = HashSet.make("application", "audio", "image", "text", "video");

const extractName = (name: string | IanaMediaTypeTextNode): string => (isTextNode(name) ? name.text : name);

const recordsArray = (record: IanaMediaTypeRegistry["record"]): ReadonlyArray<IanaMediaTypeRecord> => {
  if (record === undefined) {
    return [];
  }
  return A.isArray(record) ? (record as ReadonlyArray<IanaMediaTypeRecord>) : [record as IanaMediaTypeRecord];
};

const byType = (values: ReadonlyArray<IanaMediaTypeEntryType>) =>
  R.fromEntries(A.map(values, (entry) => [entry.type, entry] as const));

const byTopLevel = (values: ReadonlyArray<IanaMediaTypeEntryType>) => {
  const grouped: Record<string, Record<string, IanaMediaTypeEntryType>> = {
    application: {},
    audio: {},
    image: {},
    misc: {},
    text: {},
    video: {},
  };

  for (const entry of values) {
    const bucket = HashSet.has(primaryTopLevels, entry.topLevel) ? entry.topLevel : "misc";
    grouped[bucket] = {
      ...grouped[bucket],
      [entry.type]: entry,
    };
  }

  return grouped;
};

const valuesForTopLevel = (values: ReadonlyArray<IanaMediaTypeEntryType>, topLevel: string) =>
  pipe(
    values,
    A.filter((entry) => entry.topLevel === topLevel),
    A.map((entry) => entry.type)
  );

const miscValues: (values: ReadonlyArray<IanaMediaTypeEntryType>) => ReadonlyArray<string> = flow(
  A.filter((entry: IanaMediaTypeEntryType) => !HashSet.has(primaryTopLevels, entry.topLevel)),
  A.map((entry) => entry.type)
);

const renderIanaMediaTypesModule = (
  updated: string,
  sha256: string,
  values: ReadonlyArray<IanaMediaTypeEntryType>
): string => {
  const sample: IanaMediaTypeEntryType =
    values[0] ??
    IanaMediaTypeEntry.make({
      type: "application/json",
      topLevel: "application",
      name: "json",
      registryName: "json",
    });

  return `/**
 * Generated IANA media type registry data.
 *
 * Generated by \`bun run beep sync-data-to-ts --target iana-media-types\`.
 * Source: ${formatTsDocCommentValue(IANA_MEDIA_TYPES_SOURCE_URL)}
 * Updated: ${formatTsDocCommentValue(updated)}
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Stable source metadata for the official IANA media type registry.
 *
 * **Example** (Inspect generated IANA media types)
 *
 * \`\`\`ts
 * import { OfficialMimeTypeDataMetadata } from "@beep/data/generated/iana-media-types"
 *
 * console.assert(OfficialMimeTypeDataMetadata.updated === ${formatTsLiteral(updated)})
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const OfficialMimeTypeDataMetadata = ${formatTsLiteral({
    sourceUrl: IANA_MEDIA_TYPES_SOURCE_URL,
    updated,
    sha256,
  })} as const;

/**
 * Last updated date reported by the official IANA media type registry.
 *
 * **Example** (Inspect generated IANA media types)
 *
 * \`\`\`ts
 * import { OfficialMimeTypeDataUpdated } from "@beep/data/generated/iana-media-types"
 *
 * console.assert(OfficialMimeTypeDataUpdated === ${formatTsLiteral(updated)})
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const OfficialMimeTypeDataUpdated = ${formatTsLiteral(updated)} as const;

/**
 * Official IANA media type registry source URL.
 *
 * **Example** (Inspect generated IANA media types)
 *
 * \`\`\`ts
 * import { OfficialMimeTypeDataSourceUrl } from "@beep/data/generated/iana-media-types"
 *
 * console.assert(OfficialMimeTypeDataSourceUrl.endsWith("media-types.xml"))
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const OfficialMimeTypeDataSourceUrl = ${formatTsLiteral(IANA_MEDIA_TYPES_SOURCE_URL)} as const;

/**
 * SHA-256 digest of the official source payload used for this generated module.
 *
 * **Example** (Inspect generated IANA media types)
 *
 * \`\`\`ts
 * import { OfficialMimeTypeDataSourceSha256 } from "@beep/data/generated/iana-media-types"
 *
 * console.assert(OfficialMimeTypeDataSourceSha256.length === 64)
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const OfficialMimeTypeDataSourceSha256 = ${formatTsLiteral(sha256)} as const;

/**
 * Normalized IANA media type entries.
 *
 * **Example** (Inspect generated IANA media types)
 *
 * \`\`\`ts
 * import { OfficialMimeTypeDataValues } from "@beep/data/generated/iana-media-types"
 *
 * const sample = OfficialMimeTypeDataValues.find((entry) => entry.type === ${formatTsLiteral(sample.type)})
 * console.assert(sample?.topLevel === ${formatTsLiteral(sample.topLevel)})
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const OfficialMimeTypeDataValues = ${formatTsLiteral(values)} as const;

/**
 * Normalized IANA media type entries keyed by full media type.
 *
 * **Example** (Inspect generated IANA media types)
 *
 * \`\`\`ts
 * import { OfficialMimeTypeDataByType } from "@beep/data/generated/iana-media-types"
 *
 * console.assert(OfficialMimeTypeDataByType[${formatTsLiteral(sample.type)}].name === ${formatTsLiteral(sample.name)})
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const OfficialMimeTypeDataByType = ${formatRegistryLiteral(byType(values))} as const;

/**
 * IANA media type literal values.
 *
 * **Example** (Inspect generated IANA media types)
 *
 * \`\`\`ts
 * import { OfficialMimeTypeDataTypeValues } from "@beep/data/generated/iana-media-types"
 *
 * console.assert(OfficialMimeTypeDataTypeValues.includes(${formatTsLiteral(sample.type)}))
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const OfficialMimeTypeDataTypeValues = ${formatRegistryLiteral(A.map(values, (entry) => entry.type))} as const;

/**
 * Official IANA \`application/*\` media type literal values.
 *
 * **Example** (Inspect generated IANA media types)
 *
 * \`\`\`ts
 * import { ApplicationMimeTypeValues } from "@beep/data/generated/iana-media-types"
 *
 * console.assert(ApplicationMimeTypeValues.includes("application/json"))
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const ApplicationMimeTypeValues = ${formatRegistryLiteral(valuesForTopLevel(values, "application"))} as const;

/**
 * Official IANA \`audio/*\` media type literal values.
 *
 * **Example** (Inspect generated IANA media types)
 *
 * \`\`\`ts
 * import { AudioMimeTypeValues } from "@beep/data/generated/iana-media-types"
 *
 * console.assert(AudioMimeTypeValues.includes("audio/mpeg"))
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const AudioMimeTypeValues = ${formatRegistryLiteral(valuesForTopLevel(values, "audio"))} as const;

/**
 * Official IANA \`image/*\` media type literal values.
 *
 * **Example** (Inspect generated IANA media types)
 *
 * \`\`\`ts
 * import { ImageMimeTypeValues } from "@beep/data/generated/iana-media-types"
 *
 * console.assert(ImageMimeTypeValues.includes("image/png"))
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const ImageMimeTypeValues = ${formatRegistryLiteral(valuesForTopLevel(values, "image"))} as const;

/**
 * Official IANA \`text/*\` media type literal values.
 *
 * **Example** (Inspect generated IANA media types)
 *
 * \`\`\`ts
 * import { TextMimeTypeValues } from "@beep/data/generated/iana-media-types"
 *
 * console.assert(TextMimeTypeValues.includes("text/plain"))
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const TextMimeTypeValues = ${formatRegistryLiteral(valuesForTopLevel(values, "text"))} as const;

/**
 * Official IANA \`video/*\` media type literal values.
 *
 * **Example** (Inspect generated IANA media types)
 *
 * \`\`\`ts
 * import { VideoMimeTypeValues } from "@beep/data/generated/iana-media-types"
 *
 * console.assert(VideoMimeTypeValues.includes("video/mp4"))
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const VideoMimeTypeValues = ${formatRegistryLiteral(valuesForTopLevel(values, "video"))} as const;

/**
 * Official IANA media type literal values outside the primary top-level categories.
 *
 * **Example** (Inspect generated IANA media types)
 *
 * \`\`\`ts
 * import { MiscMimeTypeValues } from "@beep/data/generated/iana-media-types"
 *
 * console.assert(MiscMimeTypeValues.includes("font/woff2"))
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const MiscMimeTypeValues = ${formatRegistryLiteral(miscValues(values))} as const;

/**
 * IANA media type entries grouped for schema category helpers.
 *
 * **Example** (Inspect generated IANA media types)
 *
 * \`\`\`ts
 * import { OfficialMimeTypeDataByTopLevel } from "@beep/data/generated/iana-media-types"
 *
 * console.assert(OfficialMimeTypeDataByTopLevel.${sample.topLevel}[${formatTsLiteral(sample.type)}].name === ${formatTsLiteral(sample.name)})
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const OfficialMimeTypeDataByTopLevel = ${formatTsLiteral(byTopLevel(values))} as const;
`;
};

const normalizeIanaMediaTypes = Effect.fn("SyncDataToTs.IanaMediaTypes.normalize")(function* (document: unknown) {
  const decoded = yield* S.decodeUnknownEffect(IanaMediaTypesDocument)(document).pipe(
    SyncDataToTsError.mapError("Failed to decode the official IANA media types XML payload", targetId)
  );

  const updated = decoded.registry.updated;
  const values = pipe(
    decoded.registry.registry,
    A.flatMap((registry) => {
      const topLevel = Str.toLowerCase(registry.title);
      return pipe(
        recordsArray(registry.record),
        A.map((record) => {
          const registryName = extractName(record.name);
          const normalizedName = Str.toLowerCase(registryName);
          return IanaMediaTypeEntry.make({
            type: `${topLevel}/${normalizedName}`,
            topLevel,
            name: normalizedName,
            registryName,
            ...(P.isString(record.date) ? { date: record.date } : {}),
          });
        })
      );
    }),
    A.sort(Order.mapInput(Order.String, ({ type }: IanaMediaTypeEntryType) => type))
  );

  return { updated, values } as const;
});

const projectIanaMediaTypes = Effect.fn("SyncDataToTs.IanaMediaTypes.project")(function* (
  updated: string,
  metadata: SyncDataSourceMetadata,
  values: ReadonlyArray<IanaMediaTypeEntryType>
) {
  const canonical = yield* normalizeJson(targetId, {
    schemaVersion: "beep-data/iana-media-types/v1",
    metadata,
    mediaTypesByType: byType(values),
  });

  return SyncDataTargetProjection.make({
    files: [
      outputFile(outputPath, renderIanaMediaTypesModule(updated, metadata.sha256, values)),
      outputFile(canonicalPath, formatJson(canonical)),
    ],
    canonicalPath,
    canonical,
    recordCount: A.length(values),
    summary: `${A.length(values)} media type entries updated ${updated}`,
    sources: [metadata],
  });
});

const acquireIanaMediaTypesFromSource = Effect.fn("SyncDataToTs.IanaMediaTypes.acquireFromSource")(function* (
  source: SyncDataFetchedSource
) {
  const document = yield* parseXmlSource(targetId, source);
  const { updated, values } = yield* normalizeIanaMediaTypes(document);
  const metadata = sourceMetadata(source, { published: updated });
  return yield* projectIanaMediaTypes(updated, metadata, values);
});

const acquireIanaMediaTypesFromCanonical = Effect.fn("SyncDataToTs.IanaMediaTypes.acquireFromCanonical")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(
    SyncDataToTsError.mapError(
      "Failed to locate the repo root for checked-in IANA media types data",
      targetId,
      canonicalPath
    )
  );
  const content = yield* fs
    .readFileString(path.resolve(repoRoot, canonicalPath))
    .pipe(SyncDataToTsError.mapError("Failed to read checked-in IANA media types data", targetId, canonicalPath));
  const canonical = yield* S.decodeUnknownEffect(S.fromJsonString(IanaMediaTypesCanonical))(content).pipe(
    SyncDataToTsError.mapError("Failed to decode checked-in IANA media types data", targetId, canonicalPath)
  );
  return yield* projectIanaMediaTypes(
    canonical.metadata.published,
    SyncDataSourceMetadata.make(canonical.metadata),
    R.values(canonical.mediaTypesByType)
  );
});

const SECRET_HEURISTIC_PATTERN = /key|token|secret|credential|password/i;

// The hosted secret-scanning gate pins gitleaks v8.24.3, which predates the repo config's
// [[allowlists]] syntax, so the path allowlist for generated registry data is inert there.
// Public registry literals that trip its generic-api-key heuristic (e.g.
// "application/sslkeylogfile") therefore carry inline allow markers in the generated output.
const withGitleaksAllowMarkers = (rendered: string): string =>
  pipe(
    rendered,
    Str.split("\n"),
    A.map((line) =>
      SECRET_HEURISTIC_PATTERN.test(line) && /^\s*"/.test(line)
        ? `${line} // gitleaks:allow -- public IANA registry literal`
        : line
    ),
    A.join("\n")
  );

const formatRegistryLiteral: (value: unknown) => string = flow(formatTsLiteral, withGitleaksAllowMarkers);

const markProjectionAsOfflineFallback = (projection: SyncDataTargetProjection): SyncDataTargetProjection =>
  SyncDataTargetProjection.make({
    ...projection,
    summary: `${projection.summary} (offline fallback: official source unavailable; derived from the checked-in canonical snapshot)`,
  });

// Fetch failures must not read as fresh success: the fallback exists so offline/sandboxed
// generator runs stay byte-stable against the checked-in snapshot, but the failure is
// surfaced in the log and stamped into the projection summary so check/write output shows
// the registry was NOT re-validated against the official source.
const acquireIanaMediaTypesProjection = fetchSource(targetId, "iana-media-types-xml", IANA_MEDIA_TYPES_SOURCE_URL).pipe(
  Effect.matchEffect({
    onFailure: (fetchError) =>
      Effect.logWarning(
        `[sync-data-to-ts] ${targetId}: fetching the official IANA registry failed; falling back to the checked-in canonical snapshot (data may be stale): ${String(fetchError)}`
      ).pipe(Effect.andThen(acquireIanaMediaTypesFromCanonical()), Effect.map(markProjectionAsOfflineFallback)),
    onSuccess: acquireIanaMediaTypesFromSource,
  })
);

/**
 * Checked-in sync target for the official IANA media type registry.
 *
 * @category configuration
 * @since 0.0.0
 */
export const ianaMediaTypesTarget: SyncDataTarget = {
  id: targetId,
  access: "public",
  description: "Sync official MIME/media type literals from the IANA registry XML.",
  sourceUrls: [IANA_MEDIA_TYPES_SOURCE_URL],
  acquire: acquireIanaMediaTypesProjection,
};
