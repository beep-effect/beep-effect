import { Envelope, Journal, JsonlEvent, Line } from "@beep/jsonl";
import { NodeServices } from "@effect/platform-node";
import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as SubscriptionRef from "effect/SubscriptionRef";
import * as TestClock from "effect/testing/TestClock";

const Started = JsonlEvent.make("started", {
  data: S.Struct({ round: S.Finite, phase: S.String }),
});
const events = [Started] as const;

class TmpJournal extends Journal.Service<TmpJournal>()("test/TmpJournal", { events }) {}

const provideLayerThroughScope =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(self: Effect.Effect<A, E, R>) =>
    Effect.scopedWith((scope) =>
      Layer.buildWithScope(layer, scope).pipe(Effect.flatMap((context) => Effect.provideContext(self, context)))
    );

const ForeignWriterJson = S.fromJsonString(S.Unknown);

const makeCanonicalTempDirectory = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const scopedTempDirectory = yield* fs.makeTempDirectoryScoped();
  return yield* fs.realPath(scopedTempDirectory);
});

const liveObservationBound = Duration.seconds(20);
const testTimeoutAboveLiveObservationBound = 30_000;

const withJournal = Effect.fn("withJournal")(function* <A, E>(
  canonicalDir: string,
  body: (journal: TmpJournal["Service"], path: string) => Effect.Effect<A, E>
) {
  const path = yield* Path.Path;
  const file = path.join(canonicalDir, "journal.jsonl");
  const layer = TmpJournal.layer({ path: file });
  return yield* Effect.gen(function* () {
    const journal = yield* TmpJournal;
    yield* journal.create;
    return yield* body(journal, file);
  }).pipe(provideLayerThroughScope(layer));
});

it.layer(NodeServices.layer, { timeout: "10 seconds" })(
  "Journal integration on a real filesystem: O_APPEND under concurrency, which a double cannot model",
  (it) => {
    it.effect("appends land on a real file and read back", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const dir = yield* makeCanonicalTempDirectory;
        yield* withJournal(dir, (journal, path) =>
          Effect.gen(function* () {
            yield* journal.append("started", { round: 1, phase: "a" });
            yield* journal.append("started", { round: 2, phase: "b" });
            const text = yield* fs.readFileString(path);
            const decoded = Envelope.decodeAllResult(text, events);
            assert.deepStrictEqual(A.map(decoded, Result.isSuccess), [true, true]);
          })
        );
      })
    );

    it.effect("concurrent appends through one journal interleave no bytes", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const dir = yield* makeCanonicalTempDirectory;
        yield* withJournal(dir, (journal, path) =>
          Effect.gen(function* () {
            const rounds = Array.from({ length: 40 }, (_, index) => index);
            const interleaveRevealingPhase = Str.repeat(200)("x");
            yield* Effect.forEach(
              rounds,
              (round) => journal.append("started", { round, phase: interleaveRevealingPhase }),
              {
                concurrency: "unbounded",
              }
            );

            const text = yield* fs.readFileString(path);
            const lines = Line.split(text);
            assert.strictEqual(lines.length, rounds.length, "one line per append, none merged or split");
            assert.isTrue(
              A.every(lines, (line) => line.terminated),
              "every line is terminated"
            );

            const decoded = Envelope.decodeAllResult(text, events);
            assert.deepStrictEqual(A.filter(decoded, Result.isFailure), [], "no line was torn by interleaving");
            const seen = pipe(
              decoded,
              A.filter(Result.isSuccess),
              A.map((result) => result.success.data.round)
            ).sort((a, b) => a - b);
            assert.deepStrictEqual(seen, rounds, "the set of rounds is exactly what was written");
          })
        );
      })
    );

    it.effect(
      "a cooperating FOREIGN writer's single O_APPEND line between two appends leaves offsets that tile the file, whatever our watcher had ingested",
      () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const dir = yield* makeCanonicalTempDirectory;
          const file = path.join(dir, "two-writers.jsonl");
          const layer = TmpJournal.layer({ path: file });
          const scope = yield* Scope.make();
          const context = yield* Layer.build(layer).pipe(Effect.provideService(Scope.Scope, scope));
          const journal = Context.get(context, TmpJournal);
          yield* journal.create;

          const first = yield* journal.append("started", { round: 1, phase: "ours" });

          const foreign = `${yield* S.encodeEffect(ForeignWriterJson)({
            at: "2026-01-01T00:00:00.000Z",
            event: "started",
            data: { round: 2, phase: "theirs" },
          })}\n`;
          yield* fs.writeFile(file, new TextEncoder().encode(foreign), { flag: "a" });

          const third = yield* journal.append("started", { round: 3, phase: "ours" });

          const text = yield* fs.readFileString(file);
          const lines = Line.split(text);
          assert.strictEqual(lines.length, 3, "three lines, one per writer's write");
          assert.strictEqual(first.line.offset, lines[0]?.offset, "our first append is where the file says");
          assert.strictEqual(first.line.end, lines[0]?.end);
          assert.strictEqual(third.line.offset, lines[2]?.offset, "and so is the one that followed the foreign line");
          assert.strictEqual(third.line.end, lines[2]?.end);

          const all = yield* Stream.runCollect(journal.query());
          assert.deepStrictEqual(
            A.map(all, (envelope) => envelope.data.round),
            [1, 2, 3],
            "every line reads back, in file order"
          );
          for (let index = 0; index < all.length - 1; index++) {
            assert.strictEqual(all[index]?.line.end, all[index + 1]?.line.offset, "no gap and no overlap");
          }
          yield* Scope.close(scope, Exit.void);
        })
    );

    it.effect("latest survives a process-style reopen — a second layer reads the first's writes", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const dir = yield* makeCanonicalTempDirectory;
        const file = path.join(dir, "journal.jsonl");

        const first = TmpJournal.layer({ path: file });
        yield* Effect.gen(function* () {
          const journal = yield* TmpJournal;
          yield* journal.create;
          yield* journal.append("started", { round: 11, phase: "written-by-first" });
        }).pipe(provideLayerThroughScope(first));

        const secondProcessLayer = TmpJournal.layer({ path: file });
        const seen = yield* Effect.gen(function* () {
          const journal = yield* TmpJournal;
          return yield* SubscriptionRef.get(journal.latest);
        }).pipe(provideLayerThroughScope(secondProcessLayer));

        const envelope = O.getOrThrow(seen);
        assert.strictEqual(envelope.event, "started");
        assert.deepStrictEqual(envelope.data, { round: 11, phase: "written-by-first" });
      })
    );

    it.effect("a real BOM'd journal reads cleanly with post-BOM offsets", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const dir = yield* makeCanonicalTempDirectory;
        const file = path.join(dir, "bom.jsonl");
        const line = `${yield* S.encodeEffect(ForeignWriterJson)({
          at: "2026-01-01T00:00:00.000Z",
          event: "started",
          data: { round: 1, phase: "p" },
        })}\n`;
        yield* fs.writeFile(file, new TextEncoder().encode(`﻿${line}`));

        const layer = TmpJournal.layer({ path: file });
        const seen = yield* Effect.gen(function* () {
          const journal = yield* TmpJournal;
          return yield* SubscriptionRef.get(journal.latest);
        }).pipe(provideLayerThroughScope(layer));

        const envelope = O.getOrThrow(seen);
        assert.strictEqual(envelope.line.offset, 0, "offsets are post-BOM relative");
        assert.deepStrictEqual(envelope.data, { round: 1, phase: "p" });
      })
    );

    it.effect(
      "acceptance criterion 3: TWO journal layers over ONE file observe each other's appends on a real filesystem event, bounded on the live clock",
      () =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const dir = yield* makeCanonicalTempDirectory;
          const file = path.join(dir, "shared.jsonl");

          const writerLayer = TmpJournal.layer({ path: file });
          const readerLayer = TmpJournal.layer({ path: file });

          const writerScope = yield* Scope.make();
          const readerScope = yield* Scope.make();
          const writerContext = yield* Layer.build(writerLayer).pipe(Effect.provideService(Scope.Scope, writerScope));
          const writer = Context.get(writerContext, TmpJournal);
          yield* writer.create;

          const readerContext = yield* Layer.build(readerLayer).pipe(Effect.provideService(Scope.Scope, readerScope));
          const reader = Context.get(readerContext, TmpJournal);

          const blockedUntilWatcherPublishes = yield* reader
            .changes()
            .pipe(Stream.take(1), Stream.runCollect, Effect.forkChild);

          yield* writer.append("started", { round: 1, phase: "from-the-writer" });

          const seen = yield* Fiber.join(blockedUntilWatcherPublishes);
          assert.strictEqual(seen.length, 1, "the reader observed the writer's append");
          assert.deepStrictEqual(seen[0]?.data, { round: 1, phase: "from-the-writer" });

          yield* Scope.close(readerScope, Exit.void);
          yield* Scope.close(writerScope, Exit.void);
        }).pipe(Effect.timeout(liveObservationBound), TestClock.withLive),
      testTimeoutAboveLiveObservationBound
    );
  }
);
