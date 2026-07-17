/**
 * Organize schema models for corpus curation commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import * as S from "effect/Schema";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";

const $I = $RepoCliId.create("commands/Corpus/internal/Organize.schemas");

/**
 * Validated options used by `corpus organize`.
 *
 * @example
 * ```ts
 * import { CorpusOrganizeOptions } from "@beep/repo-cli/commands/Corpus"
 *
 * const options = CorpusOrganizeOptions.make({ corpusRoot: "/data/corpus", overwrite: false })
 * console.log(options.corpusRoot)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusOrganizeOptions extends S.Class<CorpusOrganizeOptions>($I`CorpusOrganizeOptions`)(
  {
    clientMapPath: S.optionalKey(S.String),
    corpusRoot: S.String,
    overwrite: S.Boolean,
  },
  $I.annote("CorpusOrganizeOptions", {
    description: "Validated options used by corpus organize.",
  })
) {}

/**
 * Organization category assigned to one canonical corpus artifact.
 *
 * @example
 * ```ts
 * import { CorpusOrganizeCategory } from "@beep/repo-cli/commands/Corpus"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CorpusOrganizeCategory)("docket")) // true
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const CorpusOrganizeCategory = LiteralKit([
  "client",
  "docket",
  "email-archive",
  "email-export",
  "recycle-metadata",
  "unsorted",
]).pipe(
  $I.annoteSchema("CorpusOrganizeCategory", {
    description:
      "Taxonomy category: client-mapped, docket-grouped, PST email archive, per-message email export, recycle-bin metadata, or unsorted.",
  })
);

/**
 * Type for {@link CorpusOrganizeCategory}.
 *
 * @category models
 * @since 0.0.0
 */
export type CorpusOrganizeCategory = typeof CorpusOrganizeCategory.Type;

/**
 * One row of the organize manifest mapping a canonical artifact into the taxonomy.
 *
 * @example
 * ```ts
 * import { CorpusOrganizeRecord } from "@beep/repo-cli/commands/Corpus"
 *
 * const record = CorpusOrganizeRecord.make({
 *   category: "docket",
 *   digest: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   docket: "10109WO02-US1",
 *   docketFamily: "10109",
 *   effectiveName: "response.docx",
 *   materialized: true,
 *   organizedRelativePath: "dockets/10109/10109WO02-US1/response.docx",
 *   restoredFromRecycleBin: false,
 *   sourceLabel: "source-a",
 *   sourceRelativePath: "response.docx"
 * })
 * console.log(record.category) // "docket"
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusOrganizeRecord extends S.Class<CorpusOrganizeRecord>($I`CorpusOrganizeRecord`)(
  {
    category: CorpusOrganizeCategory,
    client: S.optionalKey(S.String),
    digest: S.NonEmptyString,
    docket: S.optionalKey(S.String),
    docketFamily: S.optionalKey(S.String),
    effectiveName: S.NonEmptyString,
    materialized: S.Boolean,
    organizedRelativePath: S.optionalKey(S.String),
    restoredFromRecycleBin: S.Boolean,
    sourceLabel: S.NonEmptyString,
    sourceRelativePath: S.NonEmptyString,
    versionIndex: S.optionalKey(NonNegativeInt),
  },
  $I.annote("CorpusOrganizeRecord", {
    description: "JSONL-safe organize manifest row for one canonical corpus artifact.",
  })
) {}

/**
 * JSONL encoder for {@link CorpusOrganizeRecord}.
 *
 * @example
 * ```ts
 * import { CorpusOrganizeRecord, encodeCorpusOrganizeRecordJson } from "@beep/repo-cli/commands/Corpus"
 * import { Effect } from "effect"
 *
 * const record = CorpusOrganizeRecord.make({
 *   category: "unsorted",
 *   digest: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   effectiveName: "a.txt",
 *   materialized: true,
 *   restoredFromRecycleBin: false,
 *   sourceLabel: "source-a",
 *   sourceRelativePath: "a.txt"
 * })
 *
 * Effect.runPromise(encodeCorpusOrganizeRecordJson(record)).then((json) => console.log(json.includes("unsorted"))) // true
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const encodeCorpusOrganizeRecordJson = JsonStringCodec(CorpusOrganizeRecord).encode;

/**
 * Summary counts returned by `corpus organize`.
 *
 * @example
 * ```ts
 * import { CorpusOrganizeSummary } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const summary = CorpusOrganizeSummary.make({
 *   canonicalArtifacts: NonNegativeInt.make(4),
 *   clientFiles: NonNegativeInt.make(1),
 *   docketFamilies: NonNegativeInt.make(1),
 *   docketFiles: NonNegativeInt.make(2),
 *   duplicatesSkipped: NonNegativeInt.make(0),
 *   emailArchives: NonNegativeInt.make(1),
 *   emailExportFiles: NonNegativeInt.make(0),
 *   restoredNames: NonNegativeInt.make(1),
 *   unsortedFiles: NonNegativeInt.make(0),
 *   versionGroups: NonNegativeInt.make(1)
 * })
 * console.log(summary.docketFiles) // 2
 * ```
 * @category models
 * @since 0.0.0
 */
export class CorpusOrganizeSummary extends S.Class<CorpusOrganizeSummary>($I`CorpusOrganizeSummary`)(
  {
    canonicalArtifacts: NonNegativeInt,
    clientFiles: NonNegativeInt,
    docketFamilies: NonNegativeInt,
    docketFiles: NonNegativeInt,
    duplicatesSkipped: NonNegativeInt,
    emailArchives: NonNegativeInt,
    emailExportFiles: NonNegativeInt,
    restoredNames: NonNegativeInt,
    unsortedFiles: NonNegativeInt,
    versionGroups: NonNegativeInt,
  },
  $I.annote("CorpusOrganizeSummary", {
    description: "Summary counts returned by corpus organize.",
  })
) {}

/**
 * JSON encoder for {@link CorpusOrganizeSummary}.
 *
 * @example
 * ```ts
 * import { CorpusOrganizeSummary, encodeCorpusOrganizeSummaryJson } from "@beep/repo-cli/commands/Corpus"
 * import { NonNegativeInt } from "@beep/schema"
 * import { Effect } from "effect"
 *
 * const summary = CorpusOrganizeSummary.make({
 *   canonicalArtifacts: NonNegativeInt.make(0),
 *   clientFiles: NonNegativeInt.make(0),
 *   docketFamilies: NonNegativeInt.make(0),
 *   docketFiles: NonNegativeInt.make(0),
 *   duplicatesSkipped: NonNegativeInt.make(0),
 *   emailArchives: NonNegativeInt.make(0),
 *   emailExportFiles: NonNegativeInt.make(0),
 *   restoredNames: NonNegativeInt.make(0),
 *   unsortedFiles: NonNegativeInt.make(0),
 *   versionGroups: NonNegativeInt.make(0)
 * })
 *
 * Effect.runPromise(encodeCorpusOrganizeSummaryJson(summary)).then((json) => console.log(json.includes("canonicalArtifacts"))) // true
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const encodeCorpusOrganizeSummaryJson = JsonStringCodec(CorpusOrganizeSummary).encode;
