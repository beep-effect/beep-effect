/**
 * Office-action candidate-claims batch extraction and epistemic persistence.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { CandidateClaim } from "@beep/epistemic-domain/entities/CandidateClaim";
import { Evidence } from "@beep/epistemic-domain/entities/Evidence";
import * as CandidateClaimTable from "@beep/epistemic-tables/entities/CandidateClaim";
import * as EvidenceTable from "@beep/epistemic-tables/entities/Evidence";
import {
  ArtifactId,
  ArtifactLocator,
  ContentDigest,
  OperationId,
  SourceArtifact,
} from "@beep/file-processing/Artifact";
import { resolvePathWithinCanonicalRoot } from "@beep/file-processing/PathSafety";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { LangExtractError } from "@beep/langextract/Extraction";
import { IrToLawExtractionError } from "@beep/law-practice-use-cases/IrToLaw";
import { OfficeActionReview, OfficeActionReviewInput } from "@beep/law-practice-use-cases/OfficeActionReview";
import { NonNegativeInt, PosInt, Sha256HexFromBytes } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { Unknown } from "@beep/schema/Unknown";
import { Effect, FileSystem, Order, Path, Result } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { SqlClient as SqlClientService } from "effect/unstable/sql/SqlClient";
import type * as SqlClient from "effect/unstable/sql/SqlClient";

const $I = $LawPracticeServerId.create("PracticeKg.claims");
const docketPattern = /(?<!\d)(\d{5}[A-Z]{2}\d{2})(?!\d)/iu;
const leadingDocketPattern = /^(\d{5})(?!\d)/u;
const maxClaimsInputBytes = 2 * 1024 * 1024;
const claimsInputExtensions = [".md", ".txt"] as const;
class ClaimsCountRow extends S.Class<ClaimsCountRow>($I`ClaimsCountRow`)({
  count: S.Finite,
}) {}

const decodeClaimsCountRows = S.decodeUnknownEffect(S.NonEmptyArray(ClaimsCountRow));
const decodeArtifactId = S.decodeUnknownEffect(ArtifactId);
const decodeContentDigest = S.decodeUnknownEffect(ContentDigest);
const decodeOperationId = S.decodeUnknownEffect(OperationId);
const decodePosixPath = S.decodeUnknownEffect(PosixPath);
const hashBytes = S.decodeUnknownEffect(Sha256HexFromBytes);
const encodeUnknownJson = Unknown.encodeUnknownEffectFromJsonString;

const createClaimsTables = [
  `CREATE TABLE IF NOT EXISTS epistemic_candidate_claim (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  public_id TEXT NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  fixture_key TEXT NOT NULL,
  lifecycle TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS epistemic_candidate_claim_public_id_unique_idx
  ON epistemic_candidate_claim (public_id)`,
  `CREATE TABLE IF NOT EXISTS epistemic_evidence (
  created_at BIGINT NOT NULL,
  created_by_principal JSONB NOT NULL,
  org_id INTEGER NOT NULL,
  public_id TEXT NOT NULL,
  row_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  source TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by_principal JSONB NOT NULL,
  artifact_fixture_key TEXT NOT NULL,
  span JSONB NOT NULL,
  span_fixture_key TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  id SERIAL PRIMARY KEY
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS epistemic_evidence_public_id_unique_idx
  ON epistemic_evidence (public_id)`,
];

const insertCandidate = `
INSERT INTO epistemic_candidate_claim (
  created_at, created_by_principal, org_id, public_id, row_version, schema_version,
  source, updated_at, updated_by_principal, fixture_key, lifecycle, snapshot, entity_type
) VALUES ($1, $2::JSONB, $3, $4, $5, $6, $7, $8, $9::JSONB, $10, $11, $12::JSONB, $13)
ON CONFLICT (public_id) DO NOTHING`;

const insertEvidence = `
INSERT INTO epistemic_evidence (
  created_at, created_by_principal, org_id, public_id, row_version, schema_version,
  source, updated_at, updated_by_principal, artifact_fixture_key, span, span_fixture_key, entity_type
) VALUES ($1, $2::JSONB, $3, $4, $5, $6, $7, $8, $9::JSONB, $10, $11::JSONB, $12, $13)
ON CONFLICT (public_id) DO NOTHING`;

/**
 * Inputs for one candidate-claims batch.
 *
 * **Example** (Usage)
 * ```ts
 * import { PracticeKgClaimsOptions } from "@beep/law-practice-server"
 *
 * const options = PracticeKgClaimsOptions.make({ bundleOut: "/bundle", inputs: "/oa-text" })
 * console.log(options.inputs)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgClaimsOptions extends S.Class<PracticeKgClaimsOptions>($I`PracticeKgClaimsOptions`)(
  {
    bundleOut: S.NonEmptyString,
    inputs: S.NonEmptyString,
  },
  $I.annote("PracticeKgClaimsOptions", {
    description: "Input directory and existing bundle destination for one candidate-claims batch.",
  })
) {}

/**
 * Deterministic claims-batch summary.
 *
 * **Example** (Usage)
 * ```ts
 * import { PracticeKgClaimsSummary } from "@beep/law-practice-server"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const summary = PracticeKgClaimsSummary.make({
 *   claims: NonNegativeInt.make(1),
 *   failedFiles: NonNegativeInt.make(0),
 *   files: NonNegativeInt.make(1)
 * })
 * console.log(summary.claims)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgClaimsSummary extends S.Class<PracticeKgClaimsSummary>($I`PracticeKgClaimsSummary`)(
  {
    claims: NonNegativeInt,
    failedFiles: NonNegativeInt,
    files: NonNegativeInt,
  },
  $I.annote("PracticeKgClaimsSummary", {
    description: "Extracted, extraction-failed, and persisted-claim counts for a batch.",
  })
) {}

/**
 * Typed batch failure with the provider or persistence cause retained locally.
 *
 * **Example** (Usage)
 * ```ts
 * import { PracticeKgClaimsError } from "@beep/law-practice-server"
 *
 * console.log(PracticeKgClaimsError.make({ message: "Docket missing." })._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PracticeKgClaimsError extends S.TaggedError<PracticeKgClaimsError>($I`PracticeKgClaimsError`)(
  "PracticeKgClaimsError",
  {
    cause: S.optionalKey(S.Defect({ includeStack: true })),
    message: S.NonEmptyString,
  },
  $I.annote("PracticeKgClaimsError", {
    description: "Failure while extracting or persisting the practice KG claims batch.",
  })
) {}

const docketFromFilename = (filename: string): O.Option<string> =>
  Str.match(docketPattern)(filename).pipe(
    O.orElse(() => Str.match(leadingDocketPattern)(filename)),
    O.flatMap(A.get(1)),
    O.map(Str.toUpperCase)
  );

const persistCandidate = Effect.fn("PracticeKgClaims.persistCandidate")(function* (
  sql: SqlClient.SqlClient,
  candidate: CandidateClaim,
  evidence: Evidence
) {
  const candidateRow = CandidateClaimTable.toCandidateClaimInsert(candidate);
  const evidenceRow = EvidenceTable.toEvidenceInsert(evidence);
  const candidateCreatedBy = yield* encodeUnknownJson(candidateRow.createdByPrincipal);
  const candidateUpdatedBy = yield* encodeUnknownJson(candidateRow.updatedByPrincipal);
  const snapshot = yield* encodeUnknownJson(candidateRow.snapshot);
  const evidenceCreatedBy = yield* encodeUnknownJson(evidenceRow.createdByPrincipal);
  const evidenceUpdatedBy = yield* encodeUnknownJson(evidenceRow.updatedByPrincipal);
  const span = yield* encodeUnknownJson(evidenceRow.span);
  yield* sql.unsafe(insertCandidate, [
    candidateRow.createdAt,
    candidateCreatedBy,
    candidateRow.orgId,
    candidateRow.publicId,
    candidateRow.rowVersion,
    candidateRow.schemaVersion,
    candidateRow.source,
    candidateRow.updatedAt,
    candidateUpdatedBy,
    candidateRow.fixtureKey,
    candidateRow.lifecycle,
    snapshot,
    candidateRow.entityType,
  ]);
  yield* sql.unsafe(insertEvidence, [
    evidenceRow.createdAt,
    evidenceCreatedBy,
    evidenceRow.orgId,
    evidenceRow.publicId,
    evidenceRow.rowVersion,
    evidenceRow.schemaVersion,
    evidenceRow.source,
    evidenceRow.updatedAt,
    evidenceUpdatedBy,
    evidenceRow.artifactFixtureKey,
    span,
    evidenceRow.spanFixtureKey,
    evidenceRow.entityType,
  ]);
});

/**
 * Extract and persist grounded OA candidates into an existing bundle PGlite.
 *
 * **Example** (Usage)
 * ```ts
 * import { PracticeKgClaimsOptions, runPracticeKgClaimsBatch } from "@beep/law-practice-server"
 * import { Effect } from "effect"
 *
 * const program = runPracticeKgClaimsBatch(
 *   PracticeKgClaimsOptions.make({ bundleOut: "/bundle", inputs: "/oa-text" })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @effects Reads input text, invokes the injected OfficeActionReview extraction
 * service, and inserts CandidateClaim and Evidence rows into the injected SQL store.
 * @category use-cases
 * @since 0.0.0
 */
export const runPracticeKgClaimsBatch = Effect.fn("PracticeKgClaims.run")(
  function* (options: PracticeKgClaimsOptions) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const review = yield* OfficeActionReview;
    const sql = (yield* SqlClientService).withoutTransforms();
    yield* Effect.forEach(createClaimsTables, (statement) => sql.unsafe(statement), { discard: true });
    const canonicalInputs = yield* fs.realPath(options.inputs);
    const entries = A.sort(yield* fs.readDirectory(canonicalInputs), Order.String);
    const [skippedFiles, docketedFiles] = A.partition(entries, (filename) =>
      O.match(docketFromFilename(filename), {
        onNone: () => Result.fail(filename),
        onSome: (docket) => Result.succeed({ docket, filename }),
      })
    );
    if (A.isReadonlyArrayNonEmpty(skippedFiles)) {
      yield* Effect.logInfo("PracticeKgClaims.skippedInputs", {
        count: A.length(skippedFiles),
        files: skippedFiles,
      });
    }
    const extractOne = Effect.fnUntraced(function* ({
      docket,
      filename,
    }: {
      readonly docket: string;
      readonly filename: string;
    }) {
      if (!A.contains(claimsInputExtensions, Str.toLowerCase(path.extname(filename)))) {
        return yield* PracticeKgClaimsError.make({ message: `Unsupported claims input extension: ${filename}` });
      }
      const sourcePath = path.resolve(canonicalInputs, filename);
      const canonicalSource = yield* resolvePathWithinCanonicalRoot({
        canonicalRoot: canonicalInputs,
        candidate: filename,
      });
      if (!Eq.equals(sourcePath, canonicalSource)) {
        return yield* PracticeKgClaimsError.make({
          message: `Claims input must not traverse a symbolic link: ${filename}`,
        });
      }
      const info = yield* fs.stat(canonicalSource);
      if (!Eq.equals(info.type, "File") || Number(info.size) > maxClaimsInputBytes) {
        return yield* PracticeKgClaimsError.make({
          message: `Claims input is not a bounded regular file: ${filename}`,
        });
      }
      const bytes = yield* fs.readFile(canonicalSource);
      if (bytes.byteLength > maxClaimsInputBytes) {
        return yield* PracticeKgClaimsError.make({
          message: `Claims input exceeds ${maxClaimsInputBytes} bytes: ${filename}`,
        });
      }
      const text = yield* Effect.try({
        try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
        catch: () => PracticeKgClaimsError.make({ message: `Claims input is not valid UTF-8: ${filename}` }),
      });
      const digestHex = yield* hashBytes(bytes);
      const artifactId = yield* decodeArtifactId(`artifact:${digestHex}`);
      const digest = yield* decodeContentDigest(`sha256:${digestHex}`);
      const operationId = yield* decodeOperationId(`operation:${digestHex}`);
      const relativePath = yield* decodePosixPath(filename);
      // Identity derives from content, not loop position, so re-runs are stable (B2).
      // Bounded so the shim's `seed * 10 + 1` stays inside the int32 serial range.
      const entitySeed = PosInt.make((Number.parseInt(Str.slice(0, 8)(digestHex), 16) % 214_748_363) + 1);
      const extracted = yield* review.extractCandidate(
        OfficeActionReviewInput.make({
          entitySeed,
          matterFixtureKey: `matter:${docket}`,
          officeActionFixtureKey: `office-action:${digest}`,
          operationId,
          sourceArtifact: SourceArtifact.make({
            digest,
            extension: Str.slice(1)(path.extname(filename)),
            id: artifactId,
            locator: ArtifactLocator.make({ kind: "synthetic", value: relativePath }),
            name: filename,
            relativePath,
            sizeBytes: NonNegativeInt.make(text.length),
            text,
          }),
        })
      );
      const evidenceFixtureKey = `evidence:${digest}`;
      const evidence = Evidence.make({
        ...extracted.evidence,
        artifactFixtureKey: digest,
        spanFixtureKey: evidenceFixtureKey,
      });
      const candidate = CandidateClaim.make({
        ...extracted.candidate,
        fixtureKey: `claim:${digest}`,
        snapshot: {
          ...extracted.candidate.snapshot,
          activityKind: "extract-operation",
          activityOperation: operationId,
          digest,
          docket,
          evidenceFixtureKey,
          family: Str.slice(0, 5)(docket),
          sourceFile: filename,
        },
      });
      yield* persistCandidate(sql, candidate, evidence);
      return filename;
    });
    const isExtractionQualityError = S.is(S.Union([IrToLawExtractionError, LangExtractError]));
    const outcomes = yield* Effect.forEach(
      docketedFiles,
      (entry) =>
        extractOne(entry).pipe(
          Effect.map((filename) => ({ extracted: true as const, filename })),
          Effect.catchIf(isExtractionQualityError, (error) =>
            Effect.logWarning("PracticeKgClaims.extractionFailed", {
              error: String(error),
              file: entry.filename,
            }).pipe(Effect.as({ extracted: false as const, filename: entry.filename }))
          )
        ),
      { concurrency: 1 }
    );
    const [failedExtractions, extractedFiles] = A.partition(outcomes, (outcome) =>
      outcome.extracted ? Result.succeed(outcome) : Result.fail(outcome)
    );
    if (A.isReadonlyArrayNonEmpty(failedExtractions)) {
      yield* Effect.logWarning("PracticeKgClaims.failedExtractions", {
        count: A.length(failedExtractions),
        files: A.map(failedExtractions, (outcome) => outcome.filename),
      });
    }
    const claimCountRows = yield* sql
      .unsafe("SELECT COUNT(*)::FLOAT8 AS count FROM epistemic_candidate_claim")
      .pipe(Effect.flatMap(decodeClaimsCountRows));
    if (A.isReadonlyArrayNonEmpty(docketedFiles) && A.isReadonlyArrayEmpty(extractedFiles)) {
      return yield* PracticeKgClaimsError.make({
        message: "Claims batch persisted zero claims across all extractable inputs.",
      });
    }
    return PracticeKgClaimsSummary.make({
      claims: NonNegativeInt.make(A.headNonEmpty(claimCountRows).count),
      failedFiles: NonNegativeInt.make(A.length(failedExtractions)),
      files: NonNegativeInt.make(A.length(extractedFiles)),
    });
  },
  Effect.mapError((cause) =>
    S.is(PracticeKgClaimsError)(cause)
      ? cause
      : PracticeKgClaimsError.make({ cause, message: "Practice KG claims batch failed." })
  )
);
