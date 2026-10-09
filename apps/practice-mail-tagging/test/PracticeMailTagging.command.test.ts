/**
 * The command line end to end over a one-message mailbox: the real job and
 * undo, the real file ledgers in an in-memory filesystem, and a test clock.
 */

import { TaggingRunReport, TaggingUndoReport } from "@beep/law-practice-domain/values/MailTagging";
import { MailTaggingPortError } from "@beep/law-practice-use-cases/MailTagging";
import { it } from "@beep/test-runner";
import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { TestClock } from "effect/testing";
import { PracticeMailTaggingError } from "@/PracticeMailTagging.errors";
import { MailTaggingPassOutput, MailTaggingPassSchedule, makeRunId, RunIdPrefix } from "@/PracticeMailTagging.passes";
import { MailTaggingStateSummary } from "@/PracticeMailTagging.report";
import {
  failNextListings,
  foreignCategory,
  matterCategory,
  outlookNow,
  outputLines,
  pollInterval,
  run,
  stateDirectory,
  World,
} from "./PracticeMailTagging.fixture.ts";

const decodeRunReport = S.decodeUnknownEffect(S.fromJsonString(TaggingRunReport));
const decodeUndoReport = S.decodeUnknownEffect(S.fromJsonString(TaggingUndoReport));
const decodeStateSummary = S.decodeUnknownEffect(S.fromJsonString(MailTaggingStateSummary));

const isPassOutput = S.is(MailTaggingPassOutput<number>());

// The JSON line of the most recent command; the table follows it.
const lastJsonLine = Effect.map(outputLines, (lines) => O.getOrElse(A.findLast(lines, Str.startsWith("{")), () => ""));

const lastRunReport = Effect.flatMap(lastJsonLine, decodeRunReport);
const lastUndoReport = Effect.flatMap(lastJsonLine, decodeUndoReport);
const lastStateSummary = Effect.flatMap(lastJsonLine, decodeStateSummary);

const tagLedgerExists = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.exists(path.join(stateDirectory, "tag-ledger.jsonl"));
});

const refusal = <A, E, R>(command: Effect.Effect<A, E, R>) => Effect.flip(command);

describe("practice-mail-tagging dry-run", () => {
  it.layer(World, { timeout: "30 seconds" })((it) => {
    it.effect("reports the match and writes neither a category nor a ledger line", () =>
      Effect.gen(function* () {
        yield* run(["dry-run", "--since", "2026-06-01T00:00:00Z", "--max-pages", "1"]);

        const report = yield* lastRunReport;
        const outlook = yield* outlookNow;
        const lines = yield* outputLines;
        expect(report.mode).toBe("dry-run");
        expect(report.matched).toBe(1);
        expect(report.wrote).toBe(false);
        expect(Str.startsWith("tag-")(report.runId)).toBe(true);
        expect(outlook.categories).toEqual([foreignCategory]);
        expect(outlook.categoryWrites).toBe(0);
        expect(yield* tagLedgerExists).toBe(false);
        expect(lines).toContain("matched                                  1");
        expect(lines).toContain(`added ${matterCategory}                      1`);
      })
    );
  });

  it.layer(World, { timeout: "30 seconds" })((it) => {
    it.effect("rejects a page bound that is not positive", () =>
      Effect.gen(function* () {
        yield* refusal(run(["dry-run", "--max-pages", "0"]));

        expect((yield* outlookNow).serviceBuilds).toBe(0);
      })
    );
  });
});

describe("practice-mail-tagging apply", () => {
  it.layer(World, { timeout: "30 seconds" })((it) => {
    it.effect("refuses to write without --yes and never builds the service", () =>
      Effect.gen(function* () {
        const error = yield* refusal(run(["apply"]));

        assertInstanceOf(error, PracticeMailTaggingError);
        expect(error.kind).toBe("refused");
        expect(error[Runtime.errorExitCode]).toBe(2);
        expect((yield* outlookNow).serviceBuilds).toBe(0);
      })
    );
  });

  it.layer(World, { timeout: "30 seconds" })((it) => {
    it.effect("tags the message, keeps the foreign category, and the report command counts it", () =>
      Effect.gen(function* () {
        yield* run(["apply", "--yes"]);
        const report = yield* lastRunReport;
        yield* run(["report"]);
        const summary = yield* lastStateSummary;

        expect(report.wrote).toBe(true);
        const categories = (yield* outlookNow).categories;
        assertSome(A.head(categories), foreignCategory);
        expect(categories).toContain(matterCategory);
        expect(yield* tagLedgerExists).toBe(true);
        expect(summary.tagged).toBe(1);
        expect(summary.undone).toBe(0);
        expect(summary.processed).toBe(1);
        assertSome(O.map(summary.lastCheckpointAt, DateTime.formatIso), "2026-07-01T00:01:00.000Z");
      })
    );
  });
});

describe("practice-mail-tagging undo", () => {
  it.layer(World, { timeout: "30 seconds" })((it) => {
    it.effect("needs --yes, counts on --dry-run, and then removes only what the run added", () =>
      Effect.gen(function* () {
        yield* run(["apply", "--yes"]);
        const applied = yield* lastRunReport;
        const tagged = (yield* outlookNow).categories;

        const error = yield* refusal(run(["undo", "--run", applied.runId]));
        yield* run(["undo", "--run", applied.runId, "--dry-run"]);
        const preview = yield* lastUndoReport;
        const afterPreview = (yield* outlookNow).categories;
        yield* run(["undo", "--run", applied.runId, "--yes"]);
        const undone = yield* lastUndoReport;
        yield* run(["report"]);
        const summary = yield* lastStateSummary;

        assertInstanceOf(error, PracticeMailTaggingError);
        expect(error.kind).toBe("refused");
        expect(preview.wrote).toBe(false);
        expect(preview.messagesRestored).toBe(1);
        expect(afterPreview).toEqual(tagged);
        expect(undone.wrote).toBe(true);
        expect(undone.originalRunId).toBe(applied.runId);
        expect(Str.startsWith("undo-")(undone.runId)).toBe(true);
        expect((yield* outlookNow).categories).toEqual([foreignCategory]);
        expect(summary.tagged).toBe(0);
        expect(summary.undone).toBe(1);
      })
    );
  });
});

describe("practice-mail-tagging report", () => {
  it.layer(World, { timeout: "30 seconds" })((it) => {
    it.effect("counts an empty state directory without building the service", () =>
      Effect.gen(function* () {
        yield* run(["report"]);

        const summary = yield* lastStateSummary;
        expect(summary.tagged).toBe(0);
        expect(summary.filed).toBe(0);
        expect(summary.pendingIntents).toBe(0);
        expect(summary.abandoned).toBe(0);
        assertNone(summary.lastCheckpointAt);
        expect(yield* outputLines).toContain("last checkpoint  none");
        expect((yield* outlookNow).serviceBuilds).toBe(0);
      })
    );
  });
});

describe("practice-mail-tagging watch", () => {
  it.layer(World, { timeout: "30 seconds" })((it) => {
    it.effect("refuses to start without --yes", () =>
      Effect.gen(function* () {
        const error = yield* refusal(run(["watch"]));

        assertInstanceOf(error, PracticeMailTaggingError);
        expect(error.kind).toBe("refused");
        expect((yield* outlookNow).listCalls).toBe(0);
      })
    );
  });

  it.layer(World, { timeout: "30 seconds" })((it) => {
    it.effect("runs one pass per poll interval and builds the service anew for each", () =>
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(run(["watch", "--yes", "--max-passes", "3"]));
        yield* TestClock.adjust(0);
        const afterFirst = (yield* outlookNow).serviceBuilds;
        yield* TestClock.adjust(pollInterval);
        const afterSecond = (yield* outlookNow).serviceBuilds;
        yield* TestClock.adjust(pollInterval);
        yield* Fiber.join(fiber);

        const outlook = yield* outlookNow;
        expect(afterFirst).toBe(1);
        expect(afterSecond).toBe(2);
        expect(outlook.serviceBuilds).toBe(3);
        expect(outlook.listCalls).toBe(3);
        expect(outlook.categoryWrites).toBe(1);
      })
    );
  });

  it.layer(World, { timeout: "30 seconds" })((it) => {
    it.effect("retries a failed pass after the poll interval instead of stopping", () =>
      Effect.gen(function* () {
        yield* failNextListings([MailTaggingPortError.during("Mailbox", "listMessagesSince", "HTTP 503")]);
        const fiber = yield* Effect.forkChild(run(["watch", "--yes", "--max-passes", "1"]));
        yield* TestClock.adjust(0);
        const afterFailure = yield* outlookNow;
        yield* TestClock.adjust(pollInterval);
        yield* Fiber.join(fiber);

        const outlook = yield* outlookNow;
        expect(afterFailure.serviceBuilds).toBe(1);
        expect(afterFailure.categoryWrites).toBe(0);
        expect(outlook.serviceBuilds).toBe(2);
        expect(outlook.categoryWrites).toBe(1);
      })
    );
  });

  it.layer(World, { timeout: "30 seconds" })((it) => {
    it.effect("stops with exit code 3 on throttling and never calls the provider again", () =>
      Effect.gen(function* () {
        yield* failNextListings([MailTaggingPortError.throttled("Mailbox", "listMessagesSince", "HTTP 429")]);
        const fiber = yield* Effect.forkChild(refusal(run(["watch", "--yes"])));
        yield* TestClock.adjust(pollInterval);
        const error = yield* Fiber.join(fiber);
        yield* TestClock.adjust(pollInterval);

        assertInstanceOf(error, PracticeMailTaggingError);
        expect(error.kind).toBe("throttled");
        expect(error.message).toBe("Mailbox.listMessagesSince: HTTP 429");
        expect(error[Runtime.errorExitCode]).toBe(3);
        expect((yield* outlookNow).listCalls).toBe(1);
      })
    );
  });
});

describe("practice-mail-tagging run ids and schemas", () => {
  it.effect("derives a run id from the clock that the run id schema accepts", () =>
    Effect.gen(function* () {
      expect(yield* makeRunId("tag")).toBe("tag-19700101T000000000Z");
      expect(yield* makeRunId("undo")).toBe("undo-19700101T000000000Z");
    })
  );

  it("accepts an Effect, and nothing else, as a pass runner result", () => {
    expect(isPassOutput(Effect.succeed(1))).toBe(true);
    expect(isPassOutput(1)).toBe(false);
  });

  it("decodes every generated value of the app's own schemas to itself", () => {
    assertSchemaArbitraryDecodesToSelf(RunIdPrefix, { runs: 10 });
    assertSchemaArbitraryDecodesToSelf(S.toType(MailTaggingStateSummary), { runs: 10 });
    assertSchemaArbitraryDecodesToSelf(S.toType(MailTaggingPassSchedule), { runs: 10 });
  });
});
