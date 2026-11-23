/**
 * Workstation stores of the review hub: the verdict log, the answer log and
 * the review items, each a JSONL file in one data directory.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { AnswerRow, VerdictRow } from "@beep/law-practice-domain";
import { AnswerLog, AnswerLogError } from "@beep/law-practice-use-cases/QuestionQueue";
import {
  latestItems,
  planReviewItemWrite,
  ReviewItemStore,
  ReviewItemStoreError,
  ReviewItemWriteRequest,
} from "@beep/law-practice-use-cases/ReviewItemStore";
import { VerdictLog, VerdictLogError } from "@beep/law-practice-use-cases/ReviewQueue";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { makeJsonlLog } from "../internal/JsonlLog.ts";
import { ReviewItemLine } from "../internal/ReviewItemLine.ts";
import type { ReviewItem } from "@beep/law-practice-domain";
import type * as FileSystem from "effect/FileSystem";

const $I = $LawPracticeServerId.create("ReviewFiles/ReviewFiles.layer");

/**
 * The directory that holds the review hub's store files.
 *
 * **Example** (Decode a store config)
 *
 * ```ts
 * import { ReviewFilesConfig } from "@beep/law-practice-server/ReviewFiles"
 * import * as S from "effect/Schema"
 *
 * const config = S.decodeUnknownSync(ReviewFilesConfig)({ dataDirectory: "/var/lib/practice-review-hub" })
 * console.log(config.dataDirectory) // "/var/lib/practice-review-hub"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewFilesConfig extends S.Opaque<ReviewFilesConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    dataDirectory: S.NonEmptyString.annotateKey({
      description: "Directory of verdicts.jsonl, answers.jsonl and items.jsonl; created on the first write.",
    }),
  }).pipe(
    $I.annoteSchema("ReviewFilesConfig", {
      description: "The directory that holds the review hub's store files.",
    })
  )
) {}

const verdictLog = (file: string) =>
  Effect.map(
    makeJsonlLog({
      file,
      schema: VerdictRow,
      readFailure: (reason, cause) => VerdictLogError.make({ cause: O.some(cause), operation: "read", reason }),
      appendFailure: (reason, cause) => VerdictLogError.make({ cause: O.some(cause), operation: "append", reason }),
    }),
    (log) =>
      VerdictLog.of({
        append: Effect.fn("ReviewFiles.appendVerdict")((row: VerdictRow) => log.serialized(log.append([row]))),
        rows: log.rows.pipe(Effect.withSpan("ReviewFiles.readVerdicts")),
      })
  );

const answerLog = (file: string) =>
  Effect.map(
    makeJsonlLog({
      file,
      schema: AnswerRow,
      readFailure: (_reason, cause) => AnswerLogError.make({ cause: O.some(cause), operation: "read" }),
      appendFailure: (_reason, cause) => AnswerLogError.make({ cause: O.some(cause), operation: "append" }),
    }),
    (log) =>
      AnswerLog.of({
        append: Effect.fn("ReviewFiles.appendAnswer")((row: AnswerRow) => log.serialized(log.append([row]))),
        rows: log.rows.pipe(Effect.withSpan("ReviewFiles.readAnswers")),
      })
  );

const reviewItemStore = (file: string) =>
  Effect.map(
    makeJsonlLog({
      file,
      schema: ReviewItemLine,
      readFailure: (reason, cause) => ReviewItemStoreError.make({ cause: O.some(cause), operation: "read", reason }),
      appendFailure: (reason, cause) =>
        ReviewItemStoreError.make({ cause: O.some(cause), operation: "upsert", reason }),
    }),
    (log) => {
      const list = Effect.map(log.rows, latestItems);
      const write = Effect.fnUntraced(function* (items: ReadonlyArray<ReviewItem>, repair: boolean) {
        const stored = yield* list;
        const plan = planReviewItemWrite(ReviewItemWriteRequest.make({ items, repair, stored }));
        yield* log.append(plan.write);
        return plan.held;
      });
      return ReviewItemStore.of({
        list: list.pipe(Effect.withSpan("ReviewFiles.listItems")),
        upsert: Effect.fn("ReviewFiles.upsertItems")(function* (items: ReadonlyArray<ReviewItem>) {
          return yield* write(items, false);
        }, log.serialized),
        repair: Effect.fn("ReviewFiles.repairItems")(function* (items: ReadonlyArray<ReviewItem>) {
          yield* write(items, true);
        }, log.serialized),
      });
    }
  );

/**
 * Build the review hub's three stores over JSONL files in one directory.
 *
 * **Details**
 *
 * `verdicts.jsonl` backs `VerdictLog`, `answers.jsonl` backs `AnswerLog`, and
 * `items.jsonl` backs `ReviewItemStore`. A missing file reads as empty; a
 * complete line that does not decode fails the read with the store's typed
 * error, naming the file and line only. A last line without a line break is
 * an append still in progress, by this process or another, and is left for
 * the next read. Appends to each file are serialized by one permit and synced
 * to disk, and the files are created owner-only.
 * `items.jsonl` lines are written as `review-item/v2` envelopes; older
 * untagged v1 lines are read through a frozen reader and never rewritten, a
 * v1 item with an empty quote reading as a `LegacyReviewItemImported`.
 * `ReviewItemStore.upsert` appends only items that differ from their stored
 * current version and holds ids whose latest version is such an import;
 * `repair` appends an explicit revision over one. `list` keeps the latest
 * version of each id in first-stored order.
 *
 * **Example** (Make the store layer)
 *
 * ```ts
 * import { makeReviewFilesLayer, ReviewFilesConfig } from "@beep/law-practice-server/ReviewFiles"
 * import * as Layer from "effect/Layer"
 *
 * const stores = makeReviewFilesLayer(ReviewFilesConfig.make({ dataDirectory: "/var/lib/practice-review-hub" }))
 * console.log(Layer.isLayer(stores)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeReviewFilesLayer = (
  config: ReviewFilesConfig
): Layer.Layer<AnswerLog | ReviewItemStore | VerdictLog, never, FileSystem.FileSystem | Path.Path> =>
  Layer.effectContext(
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const file = (name: string) => path.join(config.dataDirectory, name);
      const verdictLog1 = yield* verdictLog(file("verdicts.jsonl"));
      const argument = Context.make(VerdictLog, verdictLog1);
      const answerLog1 = yield* answerLog(file("answers.jsonl"));
      const argument1 = Context.add(AnswerLog, answerLog1);
      const reviewItemStore2 = yield* reviewItemStore(file("items.jsonl"));
      return argument.pipe(argument1, Context.add(ReviewItemStore, reviewItemStore2));
    })
  );
