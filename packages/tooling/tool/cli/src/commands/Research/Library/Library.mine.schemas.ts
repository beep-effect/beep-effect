/**
 * Mining tier models: runner outputs, persisted job records and receipts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import {
  LibraryAccessClass,
  LibraryArtifact,
  LibraryCitoRelation,
  LibraryDocument,
  LibraryFinding,
  LibraryModelRun,
} from "./Library.schemas.ts";

const $I = $RepoCliId.create("commands/Research/Library/Library.mine.schemas");

const emptyStrings = S.Array(S.String).pipe(
  S.withConstructorDefault(Effect.succeed([])),
  S.withDecodingDefaultKey(Effect.succeed([]))
);

/**
 * Mining tier: T1 triage, T2 deep read, T3 session synthesis.
 *
 * **Example** (Inspect LibraryMineTier)
 * ```ts
 * import { LibraryMineTier } from "@beep/repo-cli/commands/Research"
 * console.log(LibraryMineTier.literals) // ["t1", "t2", "t3"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LibraryMineTier = LiteralKit(["t1", "t2", "t3"]).pipe(
  $I.annoteSchema("LibraryMineTier", { description: "Mining tier: T1 triage, T2 deep read, T3 session synthesis." })
);
/**
 * Runtime values of LibraryMineTier.
 * @category models
 * @since 0.0.0
 */
export type LibraryMineTier = typeof LibraryMineTier.Type;

/**
 * T1 triage decision for one readable artifact.
 *
 * **Example** (Inspect LibraryTriageDecision)
 * ```ts
 * import { LibraryTriageDecision } from "@beep/repo-cli/commands/Research"
 * console.log(LibraryTriageDecision.literals) // ["select", "skip", "defer"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LibraryTriageDecision = LiteralKit(["select", "skip", "defer"]).pipe(
  $I.annoteSchema("LibraryTriageDecision", { description: "T1 triage decision for one readable artifact." })
);
/**
 * Runtime values of LibraryTriageDecision.
 * @category models
 * @since 0.0.0
 */
export type LibraryTriageDecision = typeof LibraryTriageDecision.Type;

/**
 * How much of the bound capture text a T2 reader actually read.
 *
 * **Details**
 *
 * Only `complete` readings may carry affirmative CiTO relations; truncated prompts are
 * never `complete`.
 *
 * **Example** (Inspect LibraryReadingCoverage)
 * ```ts
 * import { LibraryReadingCoverage } from "@beep/repo-cli/commands/Research"
 * console.log(LibraryReadingCoverage.literals) // ["complete", "partial", "unread"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LibraryReadingCoverage = LiteralKit(["complete", "partial", "unread"]).pipe(
  $I.annoteSchema("LibraryReadingCoverage", { description: "How much of the bound capture text a reader read." })
);
/**
 * Runtime values of LibraryReadingCoverage.
 * @category models
 * @since 0.0.0
 */
export type LibraryReadingCoverage = typeof LibraryReadingCoverage.Type;

/**
 * CiTO relations that assert the source backs a claim; barred on incomplete readings.
 *
 * **Example** (Check an affirmative relation)
 * ```ts
 * import { LibraryAffirmativeCitoRelation } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 * console.log(S.is(LibraryAffirmativeCitoRelation)("supports")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LibraryAffirmativeCitoRelation = LiteralKit([
  "citesAsEvidence",
  "supports",
  "extends",
  "usesMethodIn",
  "usesDataFrom",
]).pipe(
  $I.annoteSchema("LibraryAffirmativeCitoRelation", {
    description: "CiTO relations asserting that the source backs a claim.",
  })
);

/**
 * Runner profile that launches a tier job.
 *
 * **Details**
 *
 * `codex-luna` is the T1 default. `junie`, `claude` and `cursor` run T2; `junie` and
 * `cursor` are external lanes that never receive private-partition artifacts.
 *
 * **Example** (Inspect LibraryMineProfileId)
 * ```ts
 * import { LibraryMineProfileId } from "@beep/repo-cli/commands/Research"
 * console.log(LibraryMineProfileId.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LibraryMineProfileId = LiteralKit(["codex-luna", "codex-sol", "junie", "claude", "cursor"]).pipe(
  $I.annoteSchema("LibraryMineProfileId", { description: "Runner profile that launches a tier job." })
);
/**
 * Runtime values of LibraryMineProfileId.
 * @category models
 * @since 0.0.0
 */
export type LibraryMineProfileId = typeof LibraryMineProfileId.Type;

/**
 * Outcome recorded on a mining receipt.
 *
 * **Example** (Inspect LibraryMineOutcome)
 * ```ts
 * import { LibraryMineOutcome } from "@beep/repo-cli/commands/Research"
 * console.log(LibraryMineOutcome.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LibraryMineOutcome = LiteralKit(["completed", "rejected", "failed", "paused"]).pipe(
  $I.annoteSchema("LibraryMineOutcome", { description: "Outcome recorded on a mining receipt." })
);
/**
 * Runtime values of LibraryMineOutcome.
 * @category models
 * @since 0.0.0
 */
export type LibraryMineOutcome = typeof LibraryMineOutcome.Type;

/**
 * JSON a T1 runner returns for one artifact; also the runner's output schema.
 *
 * **Example** (Decode a triage answer)
 * ```ts
 * import { LibraryTriageOutput } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 * console.log(S.decodeUnknownSync(LibraryTriageOutput)({ decision: "skip", reason: "off-topic", topicIds: [] }).decision)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryTriageOutput extends S.Opaque<LibraryTriageOutput, { readonly brand: unique symbol }>()(
  S.Struct({
    decision: LibraryTriageDecision,
    reason: S.String,
    topicIds: S.Array(S.String),
  }).pipe($I.annoteSchema("LibraryTriageOutput", { description: "T1 runner answer for one artifact." }))
) {}

/**
 * One finding a T2 runner proposes; `span` must be verbatim capture text.
 *
 * **Example** (Decode a proposed finding)
 * ```ts
 * import { LibraryReadingFindingOutput } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 * const finding = S.decodeUnknownSync(LibraryReadingFindingOutput)({ citoRelation: "discusses", span: "x", summary: "y", topicIds: [] })
 * console.log(finding.citoRelation)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryReadingFindingOutput extends S.Opaque<
  LibraryReadingFindingOutput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    citoRelation: LibraryCitoRelation,
    span: S.NonEmptyString,
    summary: S.String,
    topicIds: S.Array(S.String),
  }).pipe($I.annoteSchema("LibraryReadingFindingOutput", { description: "A finding proposed by a T2 runner." }))
) {}

/**
 * JSON a T2 runner returns for one artifact; also the runner's output schema.
 *
 * **Example** (Decode an unread answer)
 * ```ts
 * import { LibraryReadingOutput } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 * console.log(S.decodeUnknownSync(LibraryReadingOutput)({ coverage: "unread", summary: "", findings: [] }).coverage)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryReadingOutput extends S.Opaque<LibraryReadingOutput, { readonly brand: unique symbol }>()(
  S.Struct({
    coverage: LibraryReadingCoverage,
    summary: S.String,
    findings: S.Array(LibraryReadingFindingOutput),
  }).pipe($I.annoteSchema("LibraryReadingOutput", { description: "T2 runner answer for one artifact." }))
) {}

/**
 * What a mining job reads: a source capture's text or a hop-0 intake document snapshot.
 *
 * **Example** (Inspect LibraryMineJobKind)
 * ```ts
 * import { LibraryMineJobKind } from "@beep/repo-cli/commands/Research"
 * console.log(LibraryMineJobKind.literals) // ["source", "document"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LibraryMineJobKind = LiteralKit(["source", "document"]).pipe(
  $I.annoteSchema("LibraryMineJobKind", {
    description: "What a mining job reads: a source capture's text or a hop-0 intake document snapshot.",
  })
);
/**
 * Runtime values of LibraryMineJobKind.
 * @category models
 * @since 0.0.0
 */
export type LibraryMineJobKind = typeof LibraryMineJobKind.Type;

const emptyString = S.String.pipe(
  S.withConstructorDefault(Effect.succeed("")),
  S.withDecodingDefaultKey(Effect.succeed(""))
);

/**
 * Where a mining job's bound text comes from: a stored text artifact, or text derived from a PDF.
 *
 * **Example** (Inspect LibraryMineTextSource)
 * ```ts
 * import { LibraryMineTextSource } from "@beep/repo-cli/commands/Research"
 * console.log(LibraryMineTextSource.literals) // ["text", "pdf"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LibraryMineTextSource = LiteralKit(["text", "pdf"]).pipe(
  $I.annoteSchema("LibraryMineTextSource", {
    description: "Where a mining job's bound text comes from: a stored text artifact or text derived from a PDF.",
  })
);
/**
 * Runtime values of LibraryMineTextSource.
 * @category models
 * @since 0.0.0
 */
export type LibraryMineTextSource = typeof LibraryMineTextSource.Type;

/**
 * Outcome of deriving text from one PDF: readable text, or none (extraction failed or the PDF is scanned).
 *
 * **Example** (Inspect LibraryMineTextOutcome)
 * ```ts
 * import { LibraryMineTextOutcome } from "@beep/repo-cli/commands/Research"
 * console.log(LibraryMineTextOutcome.literals) // ["text", "no-text"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LibraryMineTextOutcome = LiteralKit(["text", "no-text"]).pipe(
  $I.annoteSchema("LibraryMineTextOutcome", {
    description: "Outcome of deriving text from one PDF: readable text, or none.",
  })
);
/**
 * Runtime values of LibraryMineTextOutcome.
 * @category models
 * @since 0.0.0
 */
export type LibraryMineTextOutcome = typeof LibraryMineTextOutcome.Type;

/**
 * Receipt for the text derived once from one PDF, stored beside the text under `ops/mine/text/`.
 *
 * **Details**
 *
 * The receipt is immutable and keyed by the PDF's sha256, so every job over the same bytes
 * reuses it. A `no-text` receipt carries no text path; its job is skipped as unreadable.
 *
 * **Example** (Decode a no-text receipt)
 * ```ts
 * import { LibraryMineDerivedText } from "@beep/repo-cli/commands/Research"
 * const receipt = LibraryMineDerivedText.make({
 *   pdfSha256: "a".repeat(64), outcome: "no-text", pageCount: 2, extractor: "@beep/pdf-tools/PdfTools.pageText",
 *   extractorVersion: "0.0.0", textPath: "", textSha256: "", textBytes: 0, message: "no extractable text", recordedAt: ""
 * })
 * console.log(receipt.outcome) // "no-text"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryMineDerivedText extends S.Opaque<LibraryMineDerivedText, { readonly brand: unique symbol }>()(
  S.Struct({
    pdfSha256: LibraryArtifact.fields.sha256,
    outcome: LibraryMineTextOutcome,
    pageCount: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)),
    extractor: S.String,
    extractorVersion: S.String,
    textPath: S.String,
    textSha256: S.String,
    textBytes: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)),
    message: S.String,
    recordedAt: S.String,
  }).pipe(
    $I.annoteSchema("LibraryMineDerivedText", {
      description: "Receipt for the text derived once from one PDF: source digest, pages, extractor and text digest.",
    })
  )
) {}

/**
 * A planned mining unit: one text artifact of one effective readable capture, or one
 * parseable hop-0 document of the intake.
 *
 * **Details**
 *
 * A `source` job binds `sourceId` and `captureId`; its artifact is content-addressed under
 * `objects/sha256`. A `document` job binds `documentId` with empty source and capture ids;
 * its artifact path is the intake snapshot under `intakes/<date>/raw/`.
 *
 * A `pdf` job's artifact is the PDF itself; its bound text is derived once under
 * `ops/mine/text/<pdf-sha256>.txt`. A PDF intake file carries the `pdfDocument` it
 * registers as a hop-0 report the first time its text is readable.
 *
 * **Example** (Inspect job fields)
 * ```ts
 * import { LibraryMineJob } from "@beep/repo-cli/commands/Research"
 * console.log(Object.keys(LibraryMineJob.fields))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryMineJob extends S.Opaque<LibraryMineJob, { readonly brand: unique symbol }>()(
  S.Struct({
    key: S.String,
    kind: LibraryMineJobKind,
    artifactId: S.String,
    sourceId: S.String,
    captureId: S.String,
    documentId: S.String,
    accessClass: LibraryAccessClass,
    artifact: LibraryArtifact,
    textSource: LibraryMineTextSource.pipe(
      S.withConstructorDefault(Effect.succeed("text" as const)),
      S.withDecodingDefaultKey(Effect.succeed("text" as const))
    ),
    pdfDocument: S.Option(LibraryDocument).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("LibraryMineJob", {
      description: "One text or PDF artifact of one readable capture, or one parseable or PDF hop-0 intake document.",
    })
  )
) {}

/**
 * Persisted T1 triage record, written once per artifact.
 *
 * **Example** (Inspect record fields)
 * ```ts
 * import { LibraryTriageRecord } from "@beep/repo-cli/commands/Research"
 * console.log(LibraryTriageRecord.fields.decision.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryTriageRecord extends S.Opaque<LibraryTriageRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    artifactId: S.String,
    sourceId: S.String,
    captureId: S.String,
    documentId: emptyString,
    artifactSha256: LibraryArtifact.fields.sha256,
    derivedTextSha256: emptyString,
    decision: LibraryTriageDecision,
    reason: S.String,
    topicIds: S.Array(S.String),
    modelRunId: S.String,
    modelRun: LibraryModelRun,
    recordedAt: S.String,
  }).pipe($I.annoteSchema("LibraryTriageRecord", { description: "Persisted T1 triage record." }))
) {}

/**
 * Persisted T2 reading with its span-checked findings, written once per artifact.
 *
 * **Example** (Inspect reading fields)
 * ```ts
 * import { LibraryReadingRecord } from "@beep/repo-cli/commands/Research"
 * console.log(LibraryReadingRecord.fields.coverage.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryReadingRecord extends S.Opaque<LibraryReadingRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    artifactId: S.String,
    sourceId: S.String,
    captureId: S.String,
    documentId: emptyString,
    artifactSha256: LibraryArtifact.fields.sha256,
    derivedTextSha256: emptyString,
    coverage: LibraryReadingCoverage,
    summary: S.String,
    findings: S.Array(LibraryFinding),
    modelRunId: S.String,
    modelRun: LibraryModelRun,
    recordedAt: S.String,
  }).pipe($I.annoteSchema("LibraryReadingRecord", { description: "Persisted T2 reading and findings." }))
) {}

/**
 * The orchestrator that authored a T3 synthesis.
 *
 * **Example** (Decode an orchestrator)
 * ```ts
 * import { LibrarySynthesisAuthor } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 * console.log(S.decodeUnknownSync(LibrarySynthesisAuthor)({ model: "claude-fable-5-1", effort: "medium", route: "claude-code" }).argv)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibrarySynthesisAuthor extends S.Opaque<LibrarySynthesisAuthor, { readonly brand: unique symbol }>()(
  S.Struct({
    model: S.NonEmptyString,
    effort: S.NonEmptyString,
    route: S.NonEmptyString,
    argv: emptyStrings,
  }).pipe($I.annoteSchema("LibrarySynthesisAuthor", { description: "Orchestrator that authored a synthesis." }))
) {}

/**
 * One T3 finding bound to a readable capture of a source.
 *
 * **Example** (Inspect synthesis finding fields)
 * ```ts
 * import { LibrarySynthesisFinding } from "@beep/repo-cli/commands/Research"
 * console.log(Object.keys(LibrarySynthesisFinding.fields))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibrarySynthesisFinding extends S.Opaque<LibrarySynthesisFinding, { readonly brand: unique symbol }>()(
  S.Struct({
    sourceId: S.String,
    captureId: S.String,
    citoRelation: LibraryCitoRelation,
    span: S.NonEmptyString,
    summary: S.String,
    topicIds: emptyStrings,
  }).pipe($I.annoteSchema("LibrarySynthesisFinding", { description: "A T3 finding bound to a readable capture." }))
) {}

/**
 * Session-authored T3 synthesis file imported by `mine synthesize`.
 *
 * **Example** (Decode an empty synthesis)
 * ```ts
 * import { LibrarySynthesisImport } from "@beep/repo-cli/commands/Research"
 * import * as S from "effect/Schema"
 * const input = { id: "t3-memory", author: { model: "claude-fable-5-1", effort: "medium", route: "claude-code" }, findings: [] }
 * console.log(S.decodeUnknownSync(LibrarySynthesisImport)(input).id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibrarySynthesisImport extends S.Opaque<LibrarySynthesisImport, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.NonEmptyString.check(S.isPattern(/^[A-Za-z0-9._-]+$/)),
    author: LibrarySynthesisAuthor,
    findings: S.Array(LibrarySynthesisFinding),
  }).pipe($I.annoteSchema("LibrarySynthesisImport", { description: "Session-authored T3 synthesis." }))
) {}

/**
 * Hash-bound receipt for one mining job attempt.
 *
 * **Example** (Inspect receipt fields)
 * ```ts
 * import { LibraryMineReceipt } from "@beep/repo-cli/commands/Research"
 * console.log(LibraryMineReceipt.fields.outcome.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryMineReceipt extends S.Opaque<LibraryMineReceipt, { readonly brand: unique symbol }>()(
  S.Struct({
    tier: LibraryMineTier,
    jobKey: S.String,
    artifactId: S.String,
    profile: S.String,
    modelRun: LibraryModelRun,
    outcome: LibraryMineOutcome,
    errorTag: S.String,
    message: S.String,
    promptSha256: S.String,
    outputSha256: S.String,
    findingIds: S.Array(S.String),
    droppedTopicIds: S.Array(S.String),
    recordedAt: S.String,
  }).pipe($I.annoteSchema("LibraryMineReceipt", { description: "Receipt for one mining job attempt." }))
) {}

/**
 * Options shared by `mine triage` and `mine read`.
 *
 * **Example** (Make options)
 * ```ts
 * import { LibraryMineOptions } from "@beep/repo-cli/commands/Research"
 * import * as O from "effect/Option"
 * const options = LibraryMineOptions.make({ intake: "2026-11-06", profile: "codex-luna", limit: O.none(), concurrency: 2, dryRun: true, excludePrivate: false, repoRoot: O.none() })
 * console.log(options.dryRun)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryMineOptions extends S.Opaque<LibraryMineOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    intake: S.String,
    profile: LibraryMineProfileId,
    limit: S.Option(S.Int.check(S.isGreaterThanOrEqualTo(1))),
    concurrency: S.Int.check(S.isGreaterThanOrEqualTo(1), S.isLessThanOrEqualTo(8)),
    dryRun: S.Boolean,
    excludePrivate: S.Boolean,
    repoRoot: S.Option(S.String),
  }).pipe($I.annoteSchema("LibraryMineOptions", { description: "Options shared by mine triage and read." }))
) {}
