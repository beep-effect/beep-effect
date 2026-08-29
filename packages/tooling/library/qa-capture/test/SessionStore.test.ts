import { CaptureSession, CollectorHandle, SessionManifest, SessionStore, Viewport } from "@beep/qa-capture";
import { O } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Equal, FileSystem, Layer } from "effect";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const TestLayer = Layer.mergeAll(SessionStore.layer.pipe(Layer.provide(NodeServices.layer)), NodeServices.layer);

const sampleManifest = (round: number): SessionManifest =>
  SessionManifest.make({
    artifacts: [],
    clockSync: O.none(),
    eventsPath: "events.ndjson",
    legacyManifestPath: O.none(),
    schemaVersion: "beep.qa.capture-session.v1",
    session: CaptureSession.make({
      commitDirty: false,
      commitSha: "f9b8aaac15",
      id: "qa-session-store-test",
      lane: "playwright",
      round,
      scenario: O.some("sash-drag"),
      startedAtEpochMs: 1753838000000,
      toolVersions: { ffmpeg: "8.0" },
      url: "http://storybook.beep.localhost:1355",
      viewport: Viewport.make({ height: 800, width: 1280 }),
    }),
    videoPath: O.some("video/capture.webm"),
  });

describe("@beep/qa-capture session store", () => {
  it.effect("discovers the next round from existing round directories", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const store = yield* SessionStore;
      const tmpDir = yield* fs.makeTempDirectory();
      const qaRoot = `${tmpDir}/qa`;

      expect(yield* store.discoverNextRound(qaRoot)).toBe(1);

      yield* fs.makeDirectory(`${qaRoot}/round-1`, { recursive: true });
      yield* fs.makeDirectory(`${qaRoot}/round-3`, { recursive: true });
      yield* fs.makeDirectory(`${qaRoot}/not-a-round`, { recursive: true });
      expect(yield* store.discoverNextRound(qaRoot)).toBe(4);

      yield* fs.remove(tmpDir, { force: true, recursive: true });
    }).pipe(provideScopedLayer(TestLayer))
  );

  it.effect("prepares the documented round layout", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const store = yield* SessionStore;
      const tmpDir = yield* fs.makeTempDirectory();
      const qaRoot = `${tmpDir}/qa`;

      const layout = yield* store.prepareRound(qaRoot, 2);
      expect(layout.root).toBe(`${qaRoot}/round-2`);
      expect(yield* fs.exists(layout.clipsDir)).toBe(true);
      expect(yield* fs.exists(layout.framesDir)).toBe(true);
      expect(yield* fs.exists(layout.sheetsDir)).toBe(true);
      expect(yield* fs.exists(layout.videoDir)).toBe(true);

      yield* fs.remove(tmpDir, { force: true, recursive: true });
    }).pipe(provideScopedLayer(TestLayer))
  );

  it.effect("clears recorder-owned outputs when reusing an occupied round", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const store = yield* SessionStore;
      const tmpDir = yield* fs.makeTempDirectory();
      const qaRoot = `${tmpDir}/qa`;

      const first = yield* store.prepareRound(qaRoot, 1);
      yield* fs.writeFileString(`${first.clipsDir}/gesture-01.gif`, "stale-clip");
      yield* fs.writeFileString(`${first.framesDir}/gesture-01-f01.png`, "stale-frame");
      yield* fs.writeFileString(`${first.sheetsDir}/gesture-01-sheet.png`, "stale-sheet");
      yield* fs.writeFileString(`${first.videoDir}/capture.webm`, "stale-video");
      yield* fs.writeFileString(first.reportPath, "stale report");
      yield* fs.writeFileString(first.sessionPath, "{}");
      yield* fs.writeFileString(first.eventsPath, "stale-events\n");
      const legacyManifestPath = `${first.root}/screenshots.json`;
      yield* fs.writeFileString(legacyManifestPath, "[]");

      const layout = yield* store.prepareRound(qaRoot, 1);
      expect(yield* fs.readDirectory(layout.clipsDir)).toEqual([]);
      expect(yield* fs.readDirectory(layout.framesDir)).toEqual([]);
      expect(yield* fs.readDirectory(layout.sheetsDir)).toEqual([]);
      expect(yield* fs.readDirectory(layout.videoDir)).toEqual([]);
      expect(yield* fs.exists(layout.reportPath)).toBe(false);
      expect(yield* fs.exists(layout.sessionPath)).toBe(false);
      // Legacy screenshot manifests stay untouched per the round-layout
      // contract, and events.ndjson is the collector's to truncate at serve.
      expect(yield* fs.exists(legacyManifestPath)).toBe(true);
      expect(yield* fs.readFileString(layout.eventsPath)).toBe("stale-events\n");

      yield* fs.remove(tmpDir, { force: true, recursive: true });
    }).pipe(provideScopedLayer(TestLayer))
  );

  it.effect("round-trips session.json through the store", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const store = yield* SessionStore;
      const tmpDir = yield* fs.makeTempDirectory();
      const layout = yield* store.prepareRound(`${tmpDir}/qa`, 1);

      const manifest = sampleManifest(1);
      yield* store.writeSessionManifest(layout, manifest);
      const read = yield* store.readSessionManifest(layout);
      expect(Equal.equals(read, manifest)).toBe(true);

      yield* fs.remove(tmpDir, { force: true, recursive: true });
    }).pipe(provideScopedLayer(TestLayer))
  );

  it.effect("writes, reads, and clears the collector handle", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const store = yield* SessionStore;
      const tmpDir = yield* fs.makeTempDirectory();
      const qaRoot = `${tmpDir}/qa`;

      expect(O.isNone(yield* store.readCollectorHandle(qaRoot))).toBe(true);

      const handle = CollectorHandle.make({
        eventsPath: `${qaRoot}/round-1/events.ndjson`,
        pid: 4242,
        port: 43117,
        round: 1,
        sessionDir: `${qaRoot}/round-1`,
        sessionId: "qa-session-store-test",
        startedAtEpochMs: 1753838000000,
      });
      const handlePath = yield* store.writeCollectorHandle(qaRoot, handle);
      expect(handlePath).toBe(store.collectorHandlePath(qaRoot));

      const read = yield* store.readCollectorHandle(qaRoot);
      expect(O.isSome(read)).toBe(true);
      O.match(read, {
        onNone: () => undefined,
        onSome: (found) => {
          expect(Equal.equals(found, handle)).toBe(true);
          return undefined;
        },
      });

      yield* store.clearCollectorHandle(qaRoot);
      expect(O.isNone(yield* store.readCollectorHandle(qaRoot))).toBe(true);

      yield* fs.remove(tmpDir, { force: true, recursive: true });
    }).pipe(provideScopedLayer(TestLayer))
  );
});
