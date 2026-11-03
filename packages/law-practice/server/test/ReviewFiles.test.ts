/**
 * The review hub's JSONL stores over a real temporary directory: append and
 * read back, a corrupt line, and idempotent item upserts. Every row and item
 * here is synthetic.
 */

import { AnswerRow, ReviewItem, VerdictRow } from "@beep/law-practice-domain";
import { makeReviewFilesLayer, ReviewFilesConfig } from "@beep/law-practice-server/ReviewFiles";
import { AnswerLog, AnswerLogError } from "@beep/law-practice-use-cases/QuestionQueue";
import { ReviewItemStore, ReviewItemStoreError } from "@beep/law-practice-use-cases/ReviewItemStore";
import { VerdictLog, VerdictLogError } from "@beep/law-practice-use-cases/ReviewQueue";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { oneRun, Platform, temporaryDirectory } from "./MailTagging.adapters.fixture.ts";

const recordedAt = DateTime.makeUnsafe(1_760_400_000_000);

const verdict = VerdictRow.make({
  itemId: "kg-answer:1",
  batchId: "sitting-1",
  verdict: "right",
  revision: 1,
  recordedAt,
});
const answer = AnswerRow.cases.decided.make({ itemId: "question:1", optionId: "keep-date", revision: 1, recordedAt });
const item = (itemId: string, text: string) => ReviewItem.cases["kg-answer"].make({ itemId, text, sourceRefs: [] });

// The three stores over a data directory inside a fresh temporary directory.
const storesIn = Effect.fnUntraced(function* (subdirectory: string) {
  const path = yield* Path.Path;
  const temporaryDirectory1 = yield* temporaryDirectory;
  const dataDirectory = path.join(temporaryDirectory1, subdirectory);
  const stores = yield* Layer.build(makeReviewFilesLayer(ReviewFilesConfig.make({ dataDirectory })));
  return { dataDirectory, stores };
});

const lineCount = Effect.fnUntraced(function* (file: string) {
  const text = yield* (yield* FileSystem.FileSystem).readFileString(file);
  return A.length(A.filter(Str.split(text, "\n"), Str.isNonEmpty));
});

describe("@beep/law-practice-server ReviewFiles", () => {
  it.layer(Platform, { timeout: "10 seconds" })("over a temporary data directory", (it) => {
    it.effect("appends rows and reads them back, creating the directory", () =>
      oneRun(
        Effect.gen(function* () {
          const { dataDirectory, stores } = yield* storesIn("hub");
          const verdicts = Context.get(stores, VerdictLog);
          const answers = Context.get(stores, AnswerLog);

          const rows2 = yield* verdicts.rows;
          expect(rows2).toStrictEqual([]);
          yield* verdicts.append(verdict);
          yield* verdicts.append(verdict);
          yield* answers.append(answer);

          const rows3 = yield* verdicts.rows;
          expect(rows3).toStrictEqual([verdict, verdict]);
          const rows4 = yield* answers.rows;
          expect(rows4).toStrictEqual([answer]);
          const path = yield* Path.Path;
          const lineCount5 = yield* lineCount(path.join(dataDirectory, "verdicts.jsonl"));
          expect(lineCount5).toBe(2);
          const mode = (yield* (yield* FileSystem.FileSystem).stat(path.join(dataDirectory, "answers.jsonl"))).mode;
          expect(mode & 0o077).toBe(0);
        })
      )
    );

    it.effect("reads every complete row while the last line is still being written", () =>
      oneRun(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { dataDirectory, stores } = yield* storesIn("in-progress");
          const verdicts = Context.get(stores, VerdictLog);
          const file = path.join(dataDirectory, "verdicts.jsonl");
          yield* verdicts.append(verdict);
          yield* verdicts.append(verdict);
          // Half of a third row, with no line break yet: another process is still appending it.
          const argument = Str.slice(0, 30);
          const readFileString1 = yield* fs.readFileString(file);
          const halfRow = argument(readFileString1);
          yield* fs.writeFileString(file, halfRow, { flag: "a" });

          const rows6 = yield* verdicts.rows;
          expect(rows6).toStrictEqual([verdict, verdict]);
        })
      )
    );

    it.effect("fails the read on a line that does not decode, naming only the file and line", () =>
      oneRun(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { dataDirectory, stores } = yield* storesIn("corrupt");
          yield* Context.get(stores, VerdictLog).append(verdict);
          yield* fs.writeFileString(path.join(dataDirectory, "verdicts.jsonl"), '{"itemId":"kg-answer:1"}\n', {
            flag: "a",
          });
          yield* fs.writeFileString(path.join(dataDirectory, "items.jsonl"), "not json\n");
          yield* fs.writeFileString(path.join(dataDirectory, "answers.jsonl"), "{}\n");

          const verdictFailure = yield* Effect.flip(Context.get(stores, VerdictLog).rows);
          const itemFailure = yield* Effect.flip(Context.get(stores, ReviewItemStore).list);
          const answerFailure = yield* Effect.flip(Context.get(stores, AnswerLog).rows);

          expect(S.is(VerdictLogError)(verdictFailure) && verdictFailure.reason).toBe(
            "verdicts.jsonl line 2 does not decode"
          );
          expect(S.is(ReviewItemStoreError)(itemFailure) && itemFailure.reason).toBe(
            "items.jsonl line 1 does not decode"
          );
          expect(S.is(AnswerLogError)(answerFailure) && answerFailure.operation).toBe("read");
        })
      )
    );

    it.effect("upserts items by id: the latest version wins and unchanged items are not written again", () =>
      oneRun(
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const { dataDirectory, stores } = yield* storesIn("items");
          const store = Context.get(stores, ReviewItemStore);
          const file = path.join(dataDirectory, "items.jsonl");

          yield* store.upsert([item("kg-answer:1", "First answer."), item("kg-answer:2", "Second answer.")]);
          yield* store.upsert([item("kg-answer:1", "First answer."), item("kg-answer:2", "Second answer.")]);
          const once = yield* lineCount(file);
          yield* store.upsert([item("kg-answer:1", "First answer, revised.")]);
          yield* store.upsert([item("kg-answer:1", "First answer, revised.")]);

          expect(once).toBe(2);
          const lineCount7 = yield* lineCount(file);
          expect(lineCount7).toBe(3);
          const list8 = yield* store.list;
          expect(A.map(list8, ({ itemId, text }) => `${itemId} ${text}`)).toStrictEqual([
            "kg-answer:1 First answer, revised.",
            "kg-answer:2 Second answer.",
          ]);
        })
      )
    );
  });
});
