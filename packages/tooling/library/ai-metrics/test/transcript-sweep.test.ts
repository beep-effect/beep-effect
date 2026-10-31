import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { makeTranscriptIntakeJournal, TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import {
  runTranscriptSweep,
  TranscriptSweepInput,
  TranscriptSweepOutcome,
  TranscriptSweepReport,
} from "@beep/repo-ai-metrics/transcript-sweep";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { makeSqlTestLayer, NodeSqliteTestDriver } from "@beep/test-utils/SqlTest";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";

const sqlLayer = makeSqlTestLayer({ config: undefined, driver: NodeSqliteTestDriver });
const line = '{"type":"response_item","payload":{"type":"message","content":"synthetic-private-sweep-content"}}\n';
const fixture = Effect.fn("TranscriptSweepTest.fixture")(function* (maxPages = 16) {
  const fs = yield* FileSystem.FileSystem;
  const dir = yield* fs.makeTempDirectoryScoped();
  const salt = "synthetic-sweep-salt";
  const config = TranscriptIntakeConfig.make({
    hostId: Sha256Hex.make(Str.repeat(64)("a")),
    namespaceId: yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt)),
    maxPages,
    maxPayloadBytes: 1_048_576,
    maxDatabasePages: 256,
  });
  const input = (paths: ReadonlyArray<string>, maxSources = 1) =>
    TranscriptSweepInput.make({
      sources: A.map(paths, (path) => ({ path, source: "codex", retired: false })),
      hashSalt: Redacted.make(salt),
      maxSources,
      maxBytes: 512,
      maxLineBytes: 256,
      maxFrames: 1,
    });
  return { fs, dir, salt, config, input };
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("wraps N+1 declared sources fairly despite an unreadable source and skips retired roots", () =>
    Effect.gen(function* () {
      const { fs, dir, config, input } = yield* fixture();
      const paths = [`${dir}/a`, `${dir}/b`, `${dir}/missing`];
      yield* fs.writeFileString(paths[0] ?? "", line);
      yield* fs.writeFileString(paths[1] ?? "", line);
      const declaration = TranscriptSweepInput.make({
        ...input(paths),
        sources: [...input(paths).sources, { path: `${dir}/retired`, source: "claude", retired: true }],
      });
      const reports = yield* Effect.forEach(A.range(1, 6), () => runTranscriptSweep(config, declaration));
      const identities = A.map(reports, (report) => report.outcomes[0]?.sourceId);
      expect(A.dedupe(identities).length).toBe(3);
      expect(A.take(identities, 3)).toEqual(A.drop(identities, 3));
      const outcomes = A.flatMap(reports, (report) => report.outcomes);
      expect(A.filter(outcomes, TranscriptSweepOutcome.isAnyOf(["Accepted"])).length).toBe(2);
      expect(A.filter(outcomes, TranscriptSweepOutcome.isAnyOf(["Idle"])).length).toBe(2);
      expect(A.filter(outcomes, TranscriptSweepOutcome.isAnyOf(["Failed"])).length).toBe(2);
      for (const report of reports) expect(report).toMatchObject({ declared: 4, eligible: 3, retired: 1 });
      const encoded = yield* TranscriptSweepReport.pipe(S.Array, S.fromJsonString, S.encodeEffect)(reports);
      expect(encoded).not.toContain(dir);
      expect(encoded).not.toContain("synthetic-private");
      expect(encoded).not.toContain("synthetic-sweep-salt");
      expect((yield* (yield* makeTranscriptIntakeJournal(config)).stats).pages).toBe(2);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("retains the unaccepted source cursor when intake fills and keeps scheduling it", () =>
    Effect.gen(function* () {
      const { fs, dir, salt, config, input } = yield* fixture(1);
      const paths = [`${dir}/a`, `${dir}/b`];
      yield* Effect.forEach(paths, (path) => fs.writeFileString(path, line), { discard: true });
      const first = yield* runTranscriptSweep(config, input(paths, 2));
      expect(first.outcomes[0]?._tag).toBe("Accepted");
      expect(first.outcomes[1]).toMatchObject({ _tag: "Failed", error: { reason: "capacity" } });
      const journal = yield* makeTranscriptIntakeJournal(config);
      const cursors = yield* Effect.forEach(paths, (path) =>
        hashPrivateIdentifier(path, O.some(salt)).pipe(Effect.flatMap((hash) => journal.readCursor("codex", hash)))
      );
      expect(A.filter(cursors, O.isSome).length).toBe(1);
      expect((yield* journal.stats).pages).toBe(1);
      const again = yield* runTranscriptSweep(config, input(paths, 2));
      expect(A.map(again.outcomes, (outcome) => outcome.sourceId)).toEqual(
        A.map(first.outcomes, (outcome) => outcome.sourceId)
      );
      expect(A.map(again.outcomes, (outcome) => outcome._tag)).toEqual(["Idle", "Failed"]);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("waits for partial lines without filling the journal and commits truncation checkpoints", () =>
    Effect.gen(function* () {
      const { fs, dir, config, input } = yield* fixture();
      const path = `${dir}/partial`;
      yield* fs.writeFileString(path, Str.slice(0, -1)(line));
      const declaration = input([path]);
      for (const _ of A.range(1, 3)) {
        const report = yield* runTranscriptSweep(config, declaration);
        expect(report.outcomes[0]).toMatchObject({ _tag: "Idle", waitingForPartialLine: true });
      }
      const journal = yield* makeTranscriptIntakeJournal(config);
      expect((yield* journal.stats).pages).toBe(0);
      yield* fs.writeFileString(path, "\n", { flag: "a" });
      expect((yield* runTranscriptSweep(config, declaration)).outcomes[0]).toMatchObject({
        _tag: "Accepted",
        receipt: { sequence: 1, frames: 1 },
      });
      yield* fs.writeFileString(path, "");
      expect((yield* runTranscriptSweep(config, declaration)).outcomes[0]).toMatchObject({
        _tag: "Accepted",
        reset: "truncated",
        receipt: { sequence: 2, frames: 0 },
      });
      expect((yield* runTranscriptSweep(config, declaration)).outcomes[0]?._tag).toBe("Idle");
      expect((yield* journal.stats).pages).toBe(2);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("rejects duplicate path aliases and wrong namespaces before initializing a journal", () =>
    Effect.gen(function* () {
      const { dir, config, input } = yield* fixture();
      expect(yield* runTranscriptSweep(config, input([`${dir}/a`, `${dir}/./a`])).pipe(Effect.flip)).toMatchObject({
        reason: "configuration",
      });
      expect(
        yield* runTranscriptSweep(
          config,
          TranscriptSweepInput.make({ ...input([]), hashSalt: Redacted.make("different") })
        ).pipe(Effect.flip)
      ).toMatchObject({ reason: "namespace" });
      const sql = yield* SqlClient.SqlClient;
      expect(yield* sql`SELECT name FROM sqlite_master WHERE type='table'`).toEqual([]);
    })
  )
);
