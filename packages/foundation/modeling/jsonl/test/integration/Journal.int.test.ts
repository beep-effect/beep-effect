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

/**
 * The only tests that provide a platform layer — the boundary discipline made
 * visible. Everything provable against a double lives in `Journal.test.ts`;
 * what is here needs a real filesystem, principally `O_APPEND` behavior under
 * concurrency, which a double would only pretend to model.
 *
 * Every case canonicalizes its scoped temp directory with `realPath` before
 * deriving a journal path: the cases compare file offsets and reopen one path
 * from two layers, so every layer must see the same spelling of that path.
 */

// Port note (schemaNumber): `S.Finite` replaces `Schema.Number`; no case needs NaN or Infinity.
const Started = JsonlEvent.make("started", {
  data: S.Struct({ round: S.Finite, phase: S.String }),
});
const events = [Started] as const;

class TmpJournal extends Journal.Service<TmpJournal>()("test/TmpJournal", { events }) {}

// Port note (strictEffectProvide): providing a Layer through `Effect.provide`
// is a tsgo error here, so this builds the layer into a scope that closes with
// `self` and provides the resulting context: the same lifetime the Layer form
// gives, spelled without a Layer argument.
const provideLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(self: Effect.Effect<A, E, R>) =>
    Effect.scopedWith((scope) =>
      Layer.buildWithScope(layer, scope).pipe(Effect.flatMap((context) => Effect.provideContext(self, context)))
    );

// Port note (preferSchemaOverJson): foreign lines are serialized through a
// JSON-string schema instead of `JSON.stringify`, still independent of the
// journal's own envelope encoder.
const ForeignJson = S.fromJsonString(S.Unknown);

/** Run `body` against a real journal file in `dir`, the canonical temp directory the calling case owns. */
const withJournal = Effect.fn("withJournal")(function* <A, E>(
  dir: string,
  body: (journal: TmpJournal["Service"], path: string) => Effect.Effect<A, E>
) {
  const path = yield* Path.Path;
  const file = path.join(dir, "journal.jsonl");
  // Bound ONCE, as the const-binding rule requires.
  const layer = TmpJournal.layer({ path: file });
  return yield* Effect.gen(function* () {
    const journal = yield* TmpJournal;
    yield* journal.create;
    return yield* body(journal, file);
  }).pipe(provideLayer(layer));
});

it.layer(NodeServices.layer, { timeout: "10 seconds" })("Journal integration", (it) => {
  it.effect("appends land on a real file and read back", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const madeTempDirectoryScoped = yield* fs.makeTempDirectoryScoped();
      const dir = yield* fs.realPath(madeTempDirectoryScoped);
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
      const madeTempDirectoryScoped1 = yield* fs.makeTempDirectoryScoped();
      const dir = yield* fs.realPath(madeTempDirectoryScoped1);
      yield* withJournal(dir, (journal, path) =>
        Effect.gen(function* () {
          // Payloads large enough that an unserialized writer would visibly
          // interleave, and distinct enough that a torn line is unmistakable.
          const rounds = Array.from({ length: 40 }, (_, index) => index);
          yield* Effect.forEach(rounds, (round) => journal.append("started", { round, phase: Str.repeat(200)("x") }), {
            concurrency: "unbounded",
          });

          const text = yield* fs.readFileString(path);
          const lines = Line.split(text);
          assert.strictEqual(lines.length, rounds.length, "one line per append, none merged or split");
          assert.isTrue(
            A.every(lines, (line) => line.terminated),
            "every line is terminated"
          );

          // The real assertion: every line decodes as a complete envelope, and
          // the set of rounds is exactly what was written. A torn interleave
          // would corrupt at least one line's JSON.
          const decoded = Envelope.decodeAllResult(text, events);
          assert.deepStrictEqual(A.filter(decoded, Result.isFailure), [], "no line was torn by interleaving");
          const seen = pipe(
            decoded,
            A.filter(Result.isSuccess),
            // Port note (D15): the registry already types `data`, so upstream's cast is dropped.
            A.map((result) => result.success.data.round)
          ).sort((a, b) => a - b);
          assert.deepStrictEqual(seen, rounds);
        })
      );
    })
  );

  it.effect("a FOREIGN writer's line between two appends leaves offsets that tile the file", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const madeTempDirectoryScoped2 = yield* fs.makeTempDirectoryScoped();
      const dir = yield* fs.realPath(madeTempDirectoryScoped2);
      const file = path.join(dir, "two-writers.jsonl");
      const layer = TmpJournal.layer({ path: file });
      const scope = yield* Scope.make();
      const context = yield* Layer.build(layer).pipe(Effect.provideService(Scope.Scope, scope));
      const journal = Context.get(context, TmpJournal);
      yield* journal.create;

      const first = yield* journal.append("started", { round: 1, phase: "ours" });

      // A cooperating foreign writer, honouring the contract exactly: ONE
      // `writeAll` of a complete line to a handle opened `O_APPEND`. Whether
      // our watcher has ingested it yet is a race we must not depend on — and
      // the point of the case: our next append lands after these bytes on
      // disk, wherever our own cursor happened to be.
      const foreign = `${yield* S.encodeEffect(ForeignJson)({
        at: "2026-01-01T00:00:00.000Z",
        event: "started",
        data: { round: 2, phase: "theirs" },
      })}\n`;
      // Port note (EV004): `writeFile` with flag "a" is that one O_APPEND open,
      // complete write and close, with no hand-held handle scope.
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
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const madeTempDirectoryScoped3 = yield* fs.makeTempDirectoryScoped();
      const dir = yield* fs.realPath(madeTempDirectoryScoped3);
      const file = path.join(dir, "journal.jsonl");

      const first = TmpJournal.layer({ path: file });
      yield* Effect.gen(function* () {
        const journal = yield* TmpJournal;
        yield* journal.create;
        yield* journal.append("started", { round: 11, phase: "written-by-first" });
      }).pipe(provideLayer(first));

      // A separate layer — a stand-in for a second process — seeds `latest`
      // from disk at construction and sees the first's append.
      const second = TmpJournal.layer({ path: file });
      const seen = yield* Effect.gen(function* () {
        const journal = yield* TmpJournal;
        return yield* SubscriptionRef.get(journal.latest);
      }).pipe(provideLayer(second));

      const envelope = O.getOrThrow(seen);
      assert.strictEqual(envelope.event, "started");
      assert.deepStrictEqual(envelope.data, { round: 11, phase: "written-by-first" });
    })
  );

  it.effect("a real BOM'd journal reads cleanly with post-BOM offsets", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const madeTempDirectoryScoped4 = yield* fs.makeTempDirectoryScoped();
      const dir = yield* fs.realPath(madeTempDirectoryScoped4);
      const file = path.join(dir, "bom.jsonl");
      const line = `${yield* S.encodeEffect(ForeignJson)({
        at: "2026-01-01T00:00:00.000Z",
        event: "started",
        data: { round: 1, phase: "p" },
      })}\n`;
      yield* fs.writeFile(file, new TextEncoder().encode(`﻿${line}`));

      const layer = TmpJournal.layer({ path: file });
      const seen = yield* Effect.gen(function* () {
        const journal = yield* TmpJournal;
        return yield* SubscriptionRef.get(journal.latest);
      }).pipe(provideLayer(layer));

      const envelope = O.getOrThrow(seen);
      assert.strictEqual(envelope.line.offset, 0, "offsets are post-BOM relative");
      assert.deepStrictEqual(envelope.data, { round: 1, phase: "p" });
    })
  );

  // THE FLAGSHIP — acceptance criterion 3.
  //
  // This one waits on a REAL filesystem event, and under the TestClock a
  // timeout could never fire, so a failure would present as a hang instead of a
  // failure. `TestClock.withLive` runs the body and its 20s bound on the live
  // clock.
  //
  // The per-test timeout is raised ABOVE the effect's own 20s bound on purpose.
  // At vitest's 5s default the guard below is unreachable — the runner kills
  // the test first, and the careful "fails rather than hangs" wiring never
  // runs.
  it.effect(
    "TWO journal layers over ONE file observe each other's appends",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const madeTempDirectoryScoped5 = yield* fs.makeTempDirectoryScoped();
        const dir = yield* fs.realPath(madeTempDirectoryScoped5);
        const file = path.join(dir, "shared.jsonl");

        // Two independently-built layers over the same path — the stand-in for
        // two processes, or two MCP servers in sibling repos.
        const writerLayer = TmpJournal.layer({ path: file });
        const readerLayer = TmpJournal.layer({ path: file });

        const writerScope = yield* Scope.make();
        const readerScope = yield* Scope.make();
        const writerContext = yield* Layer.build(writerLayer).pipe(Effect.provideService(Scope.Scope, writerScope));
        const writer = Context.get(writerContext, TmpJournal);
        yield* writer.create;

        const readerContext = yield* Layer.build(readerLayer).pipe(Effect.provideService(Scope.Scope, readerScope));
        const reader = Context.get(readerContext, TmpJournal);

        // The reader waits on its own subscription. No polling loop, no sleep —
        // the fiber simply blocks until the watcher publishes.
        const observing = yield* reader.changes().pipe(Stream.take(1), Stream.runCollect, Effect.forkChild);

        yield* writer.append("started", { round: 1, phase: "from-the-writer" });

        const seen = yield* Fiber.join(observing);
        assert.strictEqual(seen.length, 1, "the reader observed the writer's append");
        assert.deepStrictEqual(seen[0]?.data, { round: 1, phase: "from-the-writer" });

        yield* Scope.close(readerScope, Exit.void);
        yield* Scope.close(writerScope, Exit.void);
      }).pipe(Effect.timeout(Duration.seconds(20)), TestClock.withLive),
    30_000
  );
});
