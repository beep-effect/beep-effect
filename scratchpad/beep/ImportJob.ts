/**
 * Limitless import jobs and the smaller response projection.
 *
 * The stored job keeps a user id, a datetime clock, and file counters. The
 * response renames `id` to `jobId` and exposes `createdAt` as a string.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Model, optionalNull, optionalText, optionalTimestamp, pg, text, timestampDefaultNow, userId } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/ImportJob");

const count = (column: string, description: string) =>
  S.Int.annotateKey({ description }).pipe(
    S.withConstructorDefault(Effect.succeed(0)),
    pg.integer(),
    pg.columnName(column),
  );

const optionalInt = (column: string) => optionalNull(S.Int).pipe(pg.integer(), pg.columnName(column));

/**
 * Lifecycle of a Limitless import job.
 *
 * **Details**
 *
 * The cancelled member is spelled with two L characters. It is not the
 * post-processing `canceled` literal and it is not a conversation status.
 *
 * **Example** (Decode a completed job)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ImportJobStatus } from "@beep/scratchpad/beep/ImportJob"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ImportJobStatus)("completed"))
 * console.log(decoded) // "completed"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ImportJobStatus = LiteralKit(["pending", "processing", "completed", "failed", "cancelled"]).pipe(
  $I.annoteSchema("ImportJobStatus", {
    description: "Import job lifecycle: pending, processing, completed, failed, or cancelled.",
  }),
);

/**
 * Decoded import-job status.
 *
 * @see {@link ImportJobStatus} for the runtime literal set.
 * @category type-level
 * @since 0.0.0
 */
export type ImportJobStatus = typeof ImportJobStatus.Type;

/**
 * Source system that produced an import job.
 *
 * **Details**
 *
 * The only released member is `limitless`. The field stays a closed literal
 * so a later source cannot appear without a schema change.
 *
 * **Example** (Decode the limitless source)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ImportSourceType } from "@beep/scratchpad/beep/ImportJob"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ImportSourceType)("limitless"))
 * console.log(decoded) // "limitless"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ImportSourceType = LiteralKit(["limitless"]).pipe(
  $I.annoteSchema("ImportSourceType", {
    description: "Import source. The only released value is limitless.",
  }),
);

/**
 * Decoded import source.
 *
 * @see {@link ImportSourceType} for the runtime literal.
 * @category type-level
 * @since 0.0.0
 */
export type ImportSourceType = typeof ImportSourceType.Type;

const pendingStatus: ImportJobStatus = "pending";

/**
 * Stored Limitless import job.
 *
 * **Details**
 *
 * `createdAt` is an aware UTC instant. Construction fills "now" when the
 * caller omits it; decode still requires the instant so a missing wire value
 * is not replaced. Counters construct as 0. `startedAt`, `completedAt`, and
 * `error` are missing-or-null options.
 *
 * **Gotchas**
 *
 * Firestore `model_dump` used to call `isoformat` only when the dumped value
 * was still a datetime. JSON mode had already turned those values into
 * strings. {@link dumpImportJob} encodes through the schema, so the three
 * clock fields are strings or null and the isoformat guard is unnecessary.
 *
 * **Example** (Construct the pending defaults)
 *
 * ```ts
 * import { ImportJob } from "@beep/scratchpad/beep/ImportJob"
 *
 * const job = ImportJob.make({
 *   id: "job-1",
 *   uid: "user-1",
 *   sourceType: "limitless",
 * })
 * console.log(job.status) // "pending"
 * console.log(job.totalFiles) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ImportJob extends Model<ImportJob>("ImportJob")(
  {
    id: S.String.annotateKey({ description: "Unique identifier for the import job." }).pipe(
      pg.text(),
      pg.columnName("id"),
    ),
    uid: userId("uid"),
    status: ImportJobStatus.annotateKey({ description: "Lifecycle status of the import job." }).pipe(
      S.withConstructorDefault(Effect.succeed(pendingStatus)),
      pg.text(),
      pg.columnName("status"),
    ),
    sourceType: ImportSourceType.annotateKey({ description: "Type of import source." }).pipe(
      pg.text(),
      pg.columnName("source_type"),
    ),
    totalFiles: count("total_files", "Total number of files to process."),
    processedFiles: count("processed_files", "Number of files processed so far."),
    conversationsCreated: count("conversations_created", "Number of conversations created."),
    conversationsSkipped: count("conversations_skipped", "Number of lifelogs skipped as already imported."),
    createdAt: timestampDefaultNow("created_at"),
    startedAt: optionalTimestamp("started_at"),
    completedAt: optionalTimestamp("completed_at"),
    error: optionalText("error"),
  },
  $I.annote("ImportJob", {
    description: "Stored Limitless import job, including counters and the processing clock.",
  }),
) {}

/**
 * Encoded import job.
 *
 * @see {@link ImportJob} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ImportJob {
  export type Encoded = S.Codec.Encoded<typeof ImportJob>;
}

/**
 * API projection of an import job.
 *
 * **Details**
 *
 * This is not a subclass of {@link ImportJob}. It drops the user id, source,
 * start, and completion instants. `jobId` is the stored `id`. `createdAt` is
 * an optional string, not a datetime. Counters that are required on the job
 * are optional here.
 *
 * **Example** (Decode a response with null counters)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ImportJobResponse } from "@beep/scratchpad/beep/ImportJob"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(ImportJobResponse)({ jobId: "job-1", status: "pending" }),
 * )
 * console.log(O.isNone(decoded.totalFiles)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ImportJobResponse extends Model<ImportJobResponse>("ImportJobResponse")(
  {
    jobId: text("job_id"),
    status: ImportJobStatus.pipe(pg.text(), pg.columnName("status")),
    totalFiles: optionalInt("total_files"),
    processedFiles: optionalInt("processed_files"),
    conversationsCreated: optionalInt("conversations_created"),
    conversationsSkipped: optionalInt("conversations_skipped"),
    createdAt: optionalText("created_at"),
    error: optionalText("error"),
  },
  $I.annote("ImportJobResponse", {
    description: "Public import-job response. jobId renames the stored id, and createdAt is a string.",
  }),
) {}

/**
 * Encoded import-job response.
 *
 * @see {@link ImportJobResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ImportJobResponse {
  export type Encoded = S.Codec.Encoded<typeof ImportJobResponse>;
}

/**
 * Encodes an import job the way Firestore JSON mode did.
 *
 * **Details**
 *
 * `createdAt`, `startedAt`, and `completedAt` are already ISO strings or null.
 * The Python override called `isoformat` only when `model_dump` had left a
 * datetime object, and skipped strings produced by `mode='json'`.
 *
 * **Example** (Encode clocks as strings)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { ImportJob, dumpImportJob } from "@beep/scratchpad/beep/ImportJob"
 *
 * const job = ImportJob.make({
 *   id: "job-1",
 *   uid: "user-1",
 *   sourceType: "limitless",
 *   createdAt: ImportJob.make({ id: "job-1", uid: "user-1", sourceType: "limitless" }).createdAt,
 * })
 * const encoded = Effect.runSync(dumpImportJob(job))
 * console.log(typeof encoded.createdAt) // "string"
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const dumpImportJob = Effect.fn("ImportJob.dump")(function* (job: ImportJob) {
  return yield* S.encodeEffect(ImportJob)(job);
});
