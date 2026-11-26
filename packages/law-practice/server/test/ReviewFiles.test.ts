/**
 * The review hub's JSONL stores over a real temporary directory: append and
 * read back, a corrupt line, idempotent item upserts, and the frozen v1 item
 * lines read beside v2 envelopes, held for repair and never rewritten. Every
 * row and item here is synthetic.
 */

import {
  AnswerRow,
  isCurrentReviewItem,
  isLegacyReviewItemImported,
  ReviewItem,
  VerdictRow,
} from "@beep/law-practice-domain";
import { ReviewItemLine } from "@beep/law-practice-server/internal/ReviewItemLine";
import { makeReviewFilesLayer, ReviewFilesConfig } from "@beep/law-practice-server/ReviewFiles";
import { AnswerLog, AnswerLogError } from "@beep/law-practice-use-cases/QuestionQueue";
import { ReviewItemStore, ReviewItemStoreError } from "@beep/law-practice-use-cases/ReviewItemStore";
import { VerdictLog, VerdictLogError } from "@beep/law-practice-use-cases/ReviewQueue";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as P4NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as P4Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as P4FileSystem from "effect/FileSystem";
import * as FileSystem from "effect/FileSystem";
import * as P4Layer from "effect/Layer";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
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
    it.effect("reports filesystem failures through each store and permits recovery", () =>
      oneRun(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          let denyRead = false;
          let denyWrite = true;
          const denied = PlatformError.systemError({ module: "FileSystem", method: "open", _tag: "PermissionDenied" });
          const faulty = FileSystem.FileSystem.of({
            ...fs,
            exists: Effect.fn("ReviewFilesTest.exists")((path) =>
              Effect.suspend(() => (denyRead ? Effect.fail(denied) : fs.exists(path)))
            ),
            open: Effect.fn("ReviewFilesTest.open")((path, options) =>
              Effect.suspend(() => (denyWrite ? Effect.fail(denied) : fs.open(path, options)))
            ),
          });
          const { stores } = yield* storesIn("faults").pipe(Effect.provideService(FileSystem.FileSystem, faulty));
          const verdicts = Context.get(stores, VerdictLog);
          const answers = Context.get(stores, AnswerLog);
          const items = Context.get(stores, ReviewItemStore);
          const verdictWrite = yield* verdicts.append(verdict).pipe(Effect.flip);
          expect(verdictWrite).toMatchObject({ _tag: "VerdictLogError", operation: "append" });
          const answerWrite = yield* answers.append(answer).pipe(Effect.flip);
          expect(answerWrite).toMatchObject({ _tag: "AnswerLogError", operation: "append" });
          const itemWrite = yield* items.upsert([item("kg-answer:1", "Synthetic")]).pipe(Effect.flip);
          expect(itemWrite).toMatchObject({ _tag: "ReviewItemStoreError", operation: "upsert" });
          denyRead = true;
          const verdictRead = yield* verdicts.rows.pipe(Effect.flip);
          expect(verdictRead).toMatchObject({ operation: "read", reason: "verdicts.jsonl cannot be read" });
          const answerRead = yield* answers.rows.pipe(Effect.flip);
          expect(answerRead).toMatchObject({ operation: "read" });
          const itemRead = yield* items.list.pipe(Effect.flip);
          expect(itemRead).toMatchObject({ operation: "read", reason: "items.jsonl cannot be read" });
          denyRead = false;
          denyWrite = false;
          yield* verdicts.append(verdict);
          yield* answers.append(answer);
          yield* items.upsert([item("kg-answer:1", "Synthetic")]);
          const recoveredVerdicts = yield* verdicts.rows;
          const recoveredAnswers = yield* answers.rows;
          const recoveredItems = yield* items.list;
          expect(recoveredVerdicts).toEqual([verdict]);
          expect(recoveredAnswers).toEqual([answer]);
          expect(recoveredItems).toEqual([item("kg-answer:1", "Synthetic")]);
        })
      )
    );
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
          const argument = Str.slice(0, 30);
          const readFileString1 = yield* fs.readFileString(file);
          const halfRow = argument(readFileString1);
          yield* fs.writeFileString(file, halfRow, { flag: "a" });

          const rows6 = yield* verdicts.rows;
          expect(
            rows6,
            "half a third row with no line break is still being appended, so it is not read yet"
          ).toStrictEqual([verdict, verdict]);
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

const itemLine = S.fromJsonString(ReviewItemLine);
const jsonValue = S.fromJsonString(S.Unknown);
const V1_DIGEST = "efb61f17d3037fba9accf6e03980808b377afcce4e625b4fb2596c229c3939bc";
const V2_DIGEST = "193deff2bee77d565e7636e45713b3b2ed86c3ac13feceebe9cb5801f400ac6e";

const readFixture = Effect.fnUntraced(function* (name: string) {
  const fs = yield* P4FileSystem.FileSystem;
  const fixtureRoot = yield* fs.realPath(".");
  const fixturePath = yield* fs.realPath(`test/fixtures/${name}`);
  expect(fixturePath).toBe(`${fixtureRoot}/test/fixtures/${name}`);
  return yield* fs.readFileString(fixturePath);
});

const sha256Of = Effect.fnUntraced(function* (text: string) {
  const digest = yield* P4Digest.Digest;
  return yield* digest.digestHex(P4Digest.sha256, new TextEncoder().encode(text));
});

const nonEmptyLines = (text: string) => A.filter(Str.split(text, "\n"), Str.isNonEmpty);

const summaryOf = (items: ReadonlyArray<typeof ReviewItemLine.Type>) =>
  A.map(items, (stored) =>
    isLegacyReviewItemImported(stored)
      ? `${stored.itemId} import ${A.join(
          A.map(stored.unresolved, ({ fieldPath }) => fieldPath),
          ","
        )}`
      : `${stored.itemId} current ${stored.text}`
  );

const repaired = ReviewItem.cases["kg-answer"].make({
  itemId: "kg-answer:freeze:1",
  text: "Synthetic answer",
  sourceRefs: [],
});

const resolvableV1 =
  '{"kind":"question","itemId":"question:v1:resolvable","text":"Keep the synthetic date?","sourceRefs":[{"boxFileId":"1234567890","quote":{"exact":"synthetic passage","suffix":"after"}}],"facts":[{"text":"Synthetic fact","sourceRefs":[{"boxFileId":"1234567890","quote":{"exact":"synthetic"}}]}],"options":[{"optionId":"keep","label":"Keep"},{"optionId":"move","label":"Move"}]}';
const resolvableV2 =
  '{"format":"review-item/v2","item":{"kind":"question","itemId":"question:v1:resolvable","text":"Keep the synthetic date?","sourceRefs":[{"boxFileId":"1234567890","quote":{"_tag":"Quote","exact":"synthetic passage","suffix":"after"}}],"facts":[{"text":"Synthetic fact","sourceRefs":[{"boxFileId":"1234567890","quote":{"_tag":"Quote","exact":"synthetic"}}]}],"options":[{"optionId":"keep","label":"Keep"},{"optionId":"move","label":"Move"}]}}';

it.layer(P4Layer.merge(P4NodeFileSystem.layer, P4Digest.layerWebCrypto), {
  timeout: "10 seconds",
  excludeTestServices: true,
})("P4 frozen formats", (it) => {
  it.effect("P4 format freeze: review-items-v1.jsonl keeps its raw digest and reads through the frozen v1 reader", () =>
    Effect.gen(function* () {
      const text = yield* readFixture("review-items-v1.jsonl");
      const rawDigest = yield* sha256Of(text);
      expect(rawDigest).toBe(V1_DIGEST);
      const lines = nonEmptyLines(text);
      const rows = yield* Effect.forEach(lines, (line) => S.decodeEffect(itemLine)(line), { concurrency: 1 });
      expect(summaryOf(rows)).toStrictEqual([
        "kg-answer:freeze:1 import sourceRefs[1].quote",
        "kg-answer:freeze:2 current Synthetic answer without sources",
        "question:freeze:1 import sourceRefs[1].quote,facts[0].sourceRefs[1].quote",
      ]);
      const imports = A.filter(rows, isLegacyReviewItemImported);
      expect(A.map(imports, ({ unresolved }) => unresolved[0])).toStrictEqual(
        A.map(["kg-answer:freeze:1", "question:freeze:1"], (itemId) =>
          expect.objectContaining({
            exact: "",
            itemId,
            prefix: O.some(""),
            reason: "empty-legacy-quote",
            suffix: O.some(""),
            locator: { boxFileId: "1234567890", page: O.some(1), crop: O.none() },
          })
        )
      );
      const raws = yield* Effect.forEach(
        A.filter(lines, (line) => !Str.includes("freeze:2")(line)),
        (line) => S.decodeEffect(jsonValue)(line),
        { concurrency: 1 }
      );
      expect(A.map(imports, ({ raw }) => raw)).toStrictEqual(raws);
      const refused = yield* Effect.forEach(imports, (row) => Effect.flip(S.encodeEffect(itemLine)(row)), {
        concurrency: 1,
      });
      expect(A.map(refused, ({ _tag }) => _tag)).toStrictEqual(["SchemaError", "SchemaError"]);
      const rewritten = yield* Effect.forEach(
        A.filter(rows, isCurrentReviewItem),
        (row) => S.encodeEffect(itemLine)(row),
        {
          concurrency: 1,
        }
      );
      expect(rewritten).toStrictEqual([
        '{"format":"review-item/v2","item":{"kind":"kg-answer","itemId":"kg-answer:freeze:2","text":"Synthetic answer without sources","sourceRefs":[]}}',
      ]);
    })
  );

  it.effect("P4 format freeze: review-items-v2.jsonl keeps its raw digest and round-trips exactly", () =>
    Effect.gen(function* () {
      const text = yield* readFixture("review-items-v2.jsonl");
      const rawDigest = yield* sha256Of(text);
      expect(rawDigest).toBe(V2_DIGEST);
      const lines = nonEmptyLines(text);
      const rows = yield* Effect.forEach(lines, (line) => S.decodeEffect(itemLine)(line), { concurrency: 1 });
      expect(summaryOf(rows)).toStrictEqual([
        "kg-answer:freeze:3 current Synthetic answer written as v2",
        "question:freeze:2 current Keep the second synthetic date?",
      ]);
      const encoded = yield* Effect.forEach(rows, (row) => S.encodeEffect(itemLine)(row), { concurrency: 1 });
      expect(encoded).toStrictEqual(lines);
    })
  );

  it.effect(
    "tags a resolvable v1 quote, keeping its prefix and suffix keys exactly, and refuses a malformed v1 row",
    () =>
      Effect.gen(function* () {
        const current = yield* S.decodeEffect(itemLine)(resolvableV1);
        assertTrue(isCurrentReviewItem(current));
        const encoded = yield* S.encodeEffect(itemLine)(current);
        expect(encoded).toBe(resolvableV2);
        const malformed = yield* Effect.flip(S.decodeEffect(itemLine)('{"kind":"kg-answer"}'));
        expect(malformed._tag).toBe("SchemaError");
      })
  );
});

it.layer(P4Layer.merge(Platform, P4Digest.layerWebCrypto), { timeout: "10 seconds" })(
  "ReviewFiles over mixed v1 and v2 item lines",
  (it) => {
    it.effect(
      "reopens a store after reading mixed lines and after appends, holding imports and keeping old bytes",
      () =>
        oneRun(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const v1 = yield* readFixture("review-items-v1.jsonl");
            const v2 = yield* readFixture("review-items-v2.jsonl");
            const root = yield* temporaryDirectory;
            const dataDirectory = path.join(root, "mixed");
            const file = path.join(dataDirectory, "items.jsonl");
            yield* fs.makeDirectory(dataDirectory, { recursive: true });
            yield* fs.writeFileString(file, `${v1}${v2}`);
            const open = Effect.map(
              Layer.build(makeReviewFilesLayer(ReviewFilesConfig.make({ dataDirectory }))),
              (stores) => Context.get(stores, ReviewItemStore)
            );
            const imported = [
              "kg-answer:freeze:1 import sourceRefs[1].quote",
              "kg-answer:freeze:2 current Synthetic answer without sources",
              "question:freeze:1 import sourceRefs[1].quote,facts[0].sourceRefs[1].quote",
              "kg-answer:freeze:3 current Synthetic answer written as v2",
              "question:freeze:2 current Keep the second synthetic date?",
            ];

            const first = yield* open;
            const listed = yield* first.list;
            expect(summaryOf(listed)).toStrictEqual(imported);
            const reopened = yield* open;
            const relisted = yield* reopened.list;
            expect(summaryOf(relisted)).toStrictEqual(imported);
            const afterRead = yield* fs.readFileString(file);
            expect(afterRead).toBe(`${v1}${v2}`);

            const replay = yield* reopened.upsert(A.filter(listed, isCurrentReviewItem));
            expect(replay).toStrictEqual([]);
            const held = yield* reopened.upsert([repaired]);
            expect(held).toStrictEqual(["kg-answer:freeze:1"]);
            const heldLines = yield* lineCount(file);
            expect(heldLines).toBe(5);

            yield* reopened.repair([repaired]);
            yield* reopened.repair([repaired]);
            yield* reopened.upsert([item("kg-answer:freeze:4", "Synthetic answer after the import.")]);
            const appendedLines = yield* lineCount(file);
            expect(appendedLines).toBe(7);

            const afterAppend = yield* open;
            const appended = yield* afterAppend.list;
            expect(summaryOf(appended)).toStrictEqual([
              "kg-answer:freeze:1 current Synthetic answer",
              ...A.drop(imported, 1),
              "kg-answer:freeze:4 current Synthetic answer after the import.",
            ]);
            const text = yield* fs.readFileString(file);
            const v1Digest = yield* sha256Of(Str.slice(0, v1.length)(text));
            const v2Digest = yield* sha256Of(Str.slice(v1.length, v1.length + v2.length)(text));
            expect([v1Digest, v2Digest]).toStrictEqual([V1_DIGEST, V2_DIGEST]);
            expect(A.every(A.drop(nonEmptyLines(text), 5), Str.startsWith('{"format":"review-item/v2","item":'))).toBe(
              true
            );
          })
        )
    );
  }
);

describe("review-item/v2 line properties", () => {
  const equivalent = S.toEquivalence(ReviewItem);
  it.effect.prop(
    "every generated current item is written as a v2 line and reads back as the same current item",
    [Arbitrary.schema(ReviewItem)],
    ([value]) =>
      Effect.gen(function* () {
        const line = yield* S.encodeEffect(itemLine)(value);
        const decoded = yield* S.decodeEffect(itemLine)(line);
        assertTrue(isCurrentReviewItem(decoded) && equivalent(decoded, value));
      }),
    { arbitrary: fcRuns(50) }
  );
});
