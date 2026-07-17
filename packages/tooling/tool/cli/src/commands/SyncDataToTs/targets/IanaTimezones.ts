/**
 * Official IANA tzdb target definition.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, dual, O, P, Str } from "@beep/utils";
import { Effect, flow, HashSet, Order, pipe } from "effect";
import * as R from "effect/Record";
import { Parser } from "tar";
import {
  fetchSource,
  formatJson,
  formatTsDocCommentValue,
  formatTsLiteral,
  normalizeJson,
  outputFile,
  sourceMetadata,
} from "../internal/Source.js";
import { SyncDataTargetProjection, SyncDataToTsError } from "../SyncDataToTs.schemas.js";
import type { ReadEntry } from "tar";
import type { SyncDataTarget } from "../SyncDataToTs.schemas.js";

const targetId = "iana-timezones" as const;
const outputPath = "packages/foundation/primitive/data/src/generated/iana-timezones.ts" as const;
const canonicalPath = "packages/foundation/primitive/data/src/generated/iana-timezones.data.json" as const;

/**
 * Stable IANA endpoint for the latest tzdata release tarball.
 *
 * @category configuration
 * @since 0.0.0
 */
export const IANA_TZDATA_SOURCE_URL = "https://data.iana.org/time-zones/tzdata-latest.tar.gz" as const;

class IanaTimezoneEntry {
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }
}

type TzdbTextEntries = Readonly<Record<string, string>>;

const TZDB_TEXT_FILES = HashSet.make(
  "africa",
  "antarctica",
  "asia",
  "australasia",
  "backward",
  "etcetera",
  "europe",
  "factory",
  "northamerica",
  "southamerica",
  "version",
  "zone1970.tab"
);

const extractTzdbTextEntries = (bytes: Uint8Array): Effect.Effect<TzdbTextEntries, SyncDataToTsError> =>
  Effect.callback<TzdbTextEntries, SyncDataToTsError>((resume) => {
    const entries = R.empty<string, string>();
    let openEntries = 0;
    let parserEnded = false;
    let completed = false;
    const parser = new Parser({
      strict: true,
      filter: (path) => HashSet.has(TZDB_TEXT_FILES, path),
    });
    const fail = (cause: unknown) => {
      if (completed) {
        return;
      }
      completed = true;
      resume(
        Effect.fail(
          SyncDataToTsError.make({
            message: "Failed to parse IANA tzdata archive.",
            targetId,
            cause,
          })
        )
      );
    };
    const finish = () => {
      if (completed || !parserEnded || openEntries > 0) {
        return;
      }
      completed = true;
      resume(Effect.succeed(entries));
    };
    const collectEntry = (entry: ReadEntry) => {
      openEntries += 1;
      const chunks = A.empty<Buffer>();

      entry.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      entry.on("error", fail);
      entry.on("end", () => {
        entries[entry.path] = Buffer.concat(chunks).toString("utf8");
        openEntries -= 1;
        finish();
      });
    };

    parser.on("entry", collectEntry);
    parser.on("error", fail);
    parser.on("end", () => {
      parserEnded = true;
      finish();
    });
    parser.end(Buffer.from(bytes));
  });

const extractPatternMatches: {
  (content: string, pattern: RegExp): ReadonlyArray<string>;
  (pattern: RegExp): (content: string) => ReadonlyArray<string>;
} = dual(2, (content: string, pattern: RegExp): ReadonlyArray<string> => {
  const matches = A.empty<string>();

  for (const match of Str.matchAll(pattern)(content)) {
    const valueOpt = A.get(match, 1);

    if (O.isSome(valueOpt)) {
      matches.push(valueOpt.value);
    }
  }

  return matches;
});

const parseZone1970Tab = (content: string): ReadonlyArray<string> =>
  pipe(
    Str.split(/\r?\n/u)(content),
    A.filter(P.and(Str.isNonEmpty, P.not(Str.startsWith("#")))),
    A.map(flow(Str.split("\t"), A.get(2), O.getOrUndefined)),
    A.filter(P.isString)
  );

const isTimezoneName = (name: string): boolean => name !== "posixrules" && !name.startsWith("posix/");

const extractTimezoneNames = (entries: TzdbTextEntries): ReadonlyArray<string> => {
  const sourceTexts = pipe(
    R.toEntries(entries),
    A.filter(([name]) => name !== "version" && name !== "zone1970.tab"),
    A.map(([, content]) => content)
  );
  const zoneNames = pipe(
    sourceTexts,
    A.flatMap((content) => extractPatternMatches(content, /^Zone\s+(\S+)/gmu))
  );
  const linkNames = pipe(
    sourceTexts,
    A.flatMap((content) => extractPatternMatches(content, /^Link\s+\S+\s+(\S+)/gmu))
  );
  const zone1970Names = entries["zone1970.tab"] === undefined ? [] : parseZone1970Tab(entries["zone1970.tab"]);

  return pipe(
    [...zoneNames, ...linkNames, ...zone1970Names, "UTC"],
    A.filter(isTimezoneName),
    A.dedupe,
    A.sort(Order.String)
  );
};

const byName = (values: ReadonlyArray<IanaTimezoneEntry>) =>
  R.fromEntries(A.map(values, (entry) => [entry.name, entry] as const));

const renderIanaTimezonesModule = (
  version: string,
  sha256: string,
  values: ReadonlyArray<IanaTimezoneEntry>
): string => {
  const sample: IanaTimezoneEntry = values.find((entry) => entry.name === "UTC") ?? new IanaTimezoneEntry("UTC");

  return `/**
 * Generated IANA tzdb timezone data.
 *
 * Generated by \`bun run beep sync-data-to-ts --target iana-timezones\`.
 * Source: ${formatTsDocCommentValue(IANA_TZDATA_SOURCE_URL)}
 * Version: ${formatTsDocCommentValue(version)}
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Stable source metadata for the official IANA tzdb data-only distribution.
 *
 * @example
 * \`\`\`typescript
 * import { TimezoneDataMetadata } from "@beep/data/generated/iana-timezones"
 *
 * console.assert(TimezoneDataMetadata.version === ${formatTsLiteral(version)})
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const TimezoneDataMetadata = ${formatTsLiteral({
    sourceUrl: IANA_TZDATA_SOURCE_URL,
    version,
    sha256,
  })} as const;

/**
 * IANA tzdb version.
 *
 * @example
 * \`\`\`typescript
 * import { TimezoneDataVersion } from "@beep/data/generated/iana-timezones"
 *
 * console.assert(TimezoneDataVersion === ${formatTsLiteral(version)})
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const TimezoneDataVersion = ${formatTsLiteral(version)} as const;

/**
 * IANA tzdb data-only source URL.
 *
 * @example
 * \`\`\`typescript
 * import { TimezoneDataSourceUrl } from "@beep/data/generated/iana-timezones"
 *
 * console.assert(TimezoneDataSourceUrl.endsWith("tzdata-latest.tar.gz"))
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const TimezoneDataSourceUrl = ${formatTsLiteral(IANA_TZDATA_SOURCE_URL)} as const;

/**
 * SHA-256 digest of the official source payload used for this generated module.
 *
 * @example
 * \`\`\`typescript
 * import { TimezoneDataSourceSha256 } from "@beep/data/generated/iana-timezones"
 *
 * console.assert(TimezoneDataSourceSha256.length === 64)
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const TimezoneDataSourceSha256 = ${formatTsLiteral(sha256)} as const;

/**
 * Normalized IANA timezone entries.
 *
 * @example
 * \`\`\`typescript
 * import { TimezoneDataValues } from "@beep/data/generated/iana-timezones"
 *
 * const sample = TimezoneDataValues.find((entry) => entry.name === ${formatTsLiteral(sample.name)})
 * console.assert(sample?.name === ${formatTsLiteral(sample.name)})
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const TimezoneDataValues = ${formatTsLiteral(values)} as const;

/**
 * Normalized IANA timezone entries keyed by timezone identifier.
 *
 * @example
 * \`\`\`typescript
 * import { TimezoneDataByName } from "@beep/data/generated/iana-timezones"
 *
 * console.assert(TimezoneDataByName[${formatTsLiteral(sample.name)}].name === ${formatTsLiteral(sample.name)})
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const TimezoneDataByName = ${formatTsLiteral(byName(values))} as const;

/**
 * IANA timezone identifier literals.
 *
 * @example
 * \`\`\`typescript
 * import { TimezoneNameValues } from "@beep/data/generated/iana-timezones"
 *
 * console.assert(TimezoneNameValues.includes(${formatTsLiteral(sample.name)}))
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const TimezoneNameValues = ${formatTsLiteral(A.map(values, (entry) => entry.name))} as const;
`;
};

const acquireIanaTimezonesProjection = Effect.fn("SyncDataToTs.IanaTimezones.acquire")(function* () {
  const source = yield* fetchSource(targetId, "iana-tzdata-tarball", IANA_TZDATA_SOURCE_URL);
  const entries = yield* extractTzdbTextEntries(source.bytes);
  const version = entries.version?.trim() ?? "unknown";
  const values = pipe(
    extractTimezoneNames(entries),
    A.map((name) => new IanaTimezoneEntry(name))
  );
  const metadata = sourceMetadata(source, { version });
  const canonical = yield* normalizeJson(targetId, {
    schemaVersion: "beep-data/iana-timezones/v1",
    metadata,
    timezonesByName: byName(values),
  });

  return SyncDataTargetProjection.make({
    files: [
      outputFile(outputPath, renderIanaTimezonesModule(version, source.sha256, values)),
      outputFile(canonicalPath, formatJson(canonical)),
    ],
    canonicalPath,
    canonical,
    recordCount: A.length(values),
    summary: `${A.length(values)} timezone identifiers from tzdb ${version}`,
    sources: [metadata],
  });
});

/**
 * Checked-in sync target for the official IANA tzdb data distribution.
 *
 * @category configuration
 * @since 0.0.0
 */
export const ianaTimezonesTarget: SyncDataTarget = {
  id: targetId,
  access: "public",
  description: "Sync IANA timezone identifiers from the latest tzdb data release.",
  sourceUrls: [IANA_TZDATA_SOURCE_URL],
  acquire: acquireIanaTimezonesProjection(),
};
