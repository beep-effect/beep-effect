/**
 * Session directory store for QA capture rounds.
 *
 * Owns the `.beep/qa` layout: `round-N/` directories (with `session.json`,
 * `events.ndjson`, `video/`, `frames/`, `clips/`, `sheets/`, `report.md`),
 * round auto-increment discovery, and the `current.json` collector handle.
 * Legacy screenshot manifests inside a round are left untouched.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $QaCaptureId } from "@beep/identity/packages";
import { A, O, Str } from "@beep/utils";
import { Context, Effect, FileSystem, flow, Layer, Number as N, Path, pipe } from "effect";
import * as S from "effect/Schema";
import { QaCaptureError } from "./QaCapture.errors.ts";
import {
  decodeCollectorHandleJson,
  decodeSessionManifestJson,
  encodeCollectorHandleJson,
  encodeSessionManifestJson,
  RoundNumber,
} from "./QaCapture.models.ts";
import type { CollectorHandle, SessionManifest } from "./QaCapture.models.ts";

const $I = $QaCaptureId.create("SessionStore.service");

/**
 * Directory name of one QA round (`round-N`).
 *
 * **Example** (Make round directory name)
 *
 * ```ts
 * import { RoundDirName } from "@beep/qa-capture"
 * const name = RoundDirName.make("round-3")
 * console.log(name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RoundDirName = S.String.check(
  S.isPattern(/^round-[0-9]+$/, {
    identifier: $I`RoundDirNamePatternCheck`,
    title: "Round Directory Name Pattern",
    description: "Round directories are named round-N with a positive integer N.",
    message: "Expected a round-N directory name",
  })
).pipe(
  $I.annoteSchema("RoundDirName", {
    description: "Directory name of one QA round (round-N).",
  })
);

/**
 * Directory name of one QA round (`round-N`).
 *
 * **Example** (Type a RoundDirName value)
 *
 * ```ts
 * import { RoundDirName } from "@beep/qa-capture"
 * import type { RoundDirName as RoundDirNameValue } from "@beep/qa-capture"
 * const name: RoundDirNameValue = RoundDirName.make("round-3")
 * console.log(name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type RoundDirName = typeof RoundDirName.Type;

const isRoundDirName = S.is(RoundDirName);

/**
 * Resolved file-system layout of one QA round directory.
 *
 * **Example** (Construct full round layout)
 *
 * ```ts
 * import { RoundLayout } from "@beep/qa-capture"
 * const layout = RoundLayout.make({
 *   clipsDir: "/repo/.beep/qa/round-1/clips",
 *   eventsPath: "/repo/.beep/qa/round-1/events.ndjson",
 *   framesDir: "/repo/.beep/qa/round-1/frames",
 *   reportPath: "/repo/.beep/qa/round-1/report.md",
 *   root: "/repo/.beep/qa/round-1",
 *   round: 1,
 *   sessionPath: "/repo/.beep/qa/round-1/session.json",
 *   sheetsDir: "/repo/.beep/qa/round-1/sheets",
 *   videoDir: "/repo/.beep/qa/round-1/video"
 * })
 * console.log(layout.root)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RoundLayout extends S.Class<RoundLayout>($I`RoundLayout`)(
  {
    clipsDir: S.String.pipe(
      $I.annoteKey("RoundLayout.clipsDir", {
        description: "Directory for GIFs and probe clips.",
      })
    ),
    eventsPath: S.String.pipe(
      $I.annoteKey("RoundLayout.eventsPath", {
        description: "Witness events NDJSON log path.",
      })
    ),
    framesDir: S.String.pipe(
      $I.annoteKey("RoundLayout.framesDir", {
        description: "Directory for extracted strip frames.",
      })
    ),
    reportPath: S.String.pipe(
      $I.annoteKey("RoundLayout.reportPath", {
        description: "Round summary report path.",
      })
    ),
    root: S.String.pipe(
      $I.annoteKey("RoundLayout.root", {
        description: "Round directory root.",
      })
    ),
    round: RoundNumber.pipe(
      $I.annoteKey("RoundLayout.round", {
        description: "Round number the layout belongs to.",
      })
    ),
    sessionPath: S.String.pipe(
      $I.annoteKey("RoundLayout.sessionPath", {
        description: "Canonical session.json path.",
      })
    ),
    sheetsDir: S.String.pipe(
      $I.annoteKey("RoundLayout.sheetsDir", {
        description: "Directory for contact sheets.",
      })
    ),
    videoDir: S.String.pipe(
      $I.annoteKey("RoundLayout.videoDir", {
        description: "Directory for recorded videos.",
      })
    ),
  },
  $I.annote("RoundLayout", {
    description: "Resolved file-system layout of one QA round directory.",
  })
) {}

/**
 * Runtime shape exposed by the {@link SessionStore} service.
 *
 * **Example** (Use SessionStoreShape methods)
 *
 * ```ts
 * import type { SessionStoreShape } from "@beep/qa-capture"
 * const use = (store: SessionStoreShape) => store.collectorHandlePath("/repo/.beep/qa")
 * console.log(use)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface SessionStoreShape {
  readonly clearCollectorHandle: (qaRoot: string) => Effect.Effect<void, QaCaptureError>;
  readonly collectorHandlePath: (qaRoot: string) => string;
  readonly discoverNextRound: (qaRoot: string) => Effect.Effect<RoundNumber, QaCaptureError>;
  readonly prepareRound: (qaRoot: string, round: RoundNumber) => Effect.Effect<RoundLayout, QaCaptureError>;
  readonly readCollectorHandle: (qaRoot: string) => Effect.Effect<O.Option<CollectorHandle>, QaCaptureError>;
  readonly readSessionManifest: (layout: RoundLayout) => Effect.Effect<SessionManifest, QaCaptureError>;
  readonly roundLayout: (qaRoot: string, round: RoundNumber) => RoundLayout;
  readonly writeCollectorHandle: (qaRoot: string, handle: CollectorHandle) => Effect.Effect<string, QaCaptureError>;
  readonly writeSessionManifest: (
    layout: RoundLayout,
    manifest: SessionManifest
  ) => Effect.Effect<void, QaCaptureError>;
}

const roundNumberOf: (name: string) => O.Option<number> = flow(Str.split("-"), A.last, O.flatMap(N.parse));

const makeService = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const roundLayout = (qaRoot: string, round: RoundNumber): RoundLayout => {
    const root = path.join(qaRoot, `round-${round}`);
    return RoundLayout.make({
      clipsDir: path.join(root, "clips"),
      eventsPath: path.join(root, "events.ndjson"),
      framesDir: path.join(root, "frames"),
      reportPath: path.join(root, "report.md"),
      root,
      round,
      sessionPath: path.join(root, "session.json"),
      sheetsDir: path.join(root, "sheets"),
      videoDir: path.join(root, "video"),
    });
  };

  const collectorHandlePath = (qaRoot: string): string => path.join(qaRoot, "current.json");

  const discoverNextRound = Effect.fn("SessionStore.discoverNextRound")(function* (qaRoot: string) {
    const exists = yield* fs.exists(qaRoot).pipe(
      Effect.mapError((cause) =>
        QaCaptureError.fromUnknown("sessionStore", "could not inspect the qa root directory", {
          cause,
          path: qaRoot,
        })
      )
    );
    if (!exists) {
      return RoundNumber.make(1);
    }
    const entries = yield* fs.readDirectory(qaRoot).pipe(
      Effect.mapError((cause) =>
        QaCaptureError.fromUnknown("sessionStore", "could not list the qa root directory", {
          cause,
          path: qaRoot,
        })
      )
    );
    const highest = pipe(
      entries,
      A.filter(isRoundDirName),
      A.reduce(0, (max, name) =>
        O.match(roundNumberOf(name), {
          onNone: () => max,
          onSome: (value) => Math.max(max, value),
        })
      )
    );
    return RoundNumber.make(highest + 1);
  });

  const prepareRound = Effect.fn("SessionStore.prepareRound")(function* (qaRoot: string, round: RoundNumber) {
    const layout = roundLayout(qaRoot, round);
    // A retried `qa record --round N` must not mix sessions: judge-pack lists
    // the frames/sheets directories wholesale, so recorder-owned outputs from
    // a prior occupant are cleared before reuse. Only the enumerated outputs
    // are removed — legacy screenshot manifests inside the round root stay
    // untouched per the package contract, and events.ndjson is truncated by
    // the collector at serve.
    yield* Effect.forEach(
      [layout.clipsDir, layout.framesDir, layout.sheetsDir, layout.videoDir, layout.reportPath, layout.sessionPath],
      (target) =>
        fs.remove(target, { force: true, recursive: true }).pipe(
          Effect.mapError((cause) =>
            QaCaptureError.fromUnknown("sessionStore", "could not clear a stale round artifact", {
              cause,
              path: target,
            })
          )
        ),
      { discard: true }
    );
    yield* Effect.forEach(
      [layout.root, layout.clipsDir, layout.framesDir, layout.sheetsDir, layout.videoDir],
      (dir) =>
        fs.makeDirectory(dir, { recursive: true }).pipe(
          Effect.mapError((cause) =>
            QaCaptureError.fromUnknown("sessionStore", "could not create a round directory", {
              cause,
              path: dir,
            })
          )
        ),
      { discard: true }
    );
    return layout;
  });

  const readSessionManifest = Effect.fn("SessionStore.readSessionManifest")(function* (layout: RoundLayout) {
    const raw = yield* fs.readFileString(layout.sessionPath).pipe(
      Effect.mapError((cause) =>
        QaCaptureError.fromUnknown("sessionStore", "could not read session.json", {
          cause,
          path: layout.sessionPath,
        })
      )
    );
    return yield* decodeSessionManifestJson(raw).pipe(
      Effect.mapError((cause) =>
        QaCaptureError.fromUnknown("sessionStore", "session.json failed schema decoding", {
          cause,
          path: layout.sessionPath,
        })
      )
    );
  });

  const writeSessionManifest = Effect.fn("SessionStore.writeSessionManifest")(function* (
    layout: RoundLayout,
    manifest: SessionManifest
  ) {
    const json = yield* encodeSessionManifestJson(manifest).pipe(
      Effect.mapError((cause) =>
        QaCaptureError.fromUnknown("sessionStore", "session manifest failed schema encoding", {
          cause,
          path: layout.sessionPath,
        })
      )
    );
    yield* fs.writeFileString(layout.sessionPath, json).pipe(
      Effect.mapError((cause) =>
        QaCaptureError.fromUnknown("sessionStore", "could not write session.json", {
          cause,
          path: layout.sessionPath,
        })
      )
    );
  });

  const readCollectorHandle = Effect.fn("SessionStore.readCollectorHandle")(function* (qaRoot: string) {
    const handlePath = collectorHandlePath(qaRoot);
    const exists = yield* fs.exists(handlePath).pipe(
      Effect.mapError((cause) =>
        QaCaptureError.fromUnknown("sessionStore", "could not inspect the collector handle file", {
          cause,
          path: handlePath,
        })
      )
    );
    if (!exists) {
      return O.none<CollectorHandle>();
    }
    const raw = yield* fs.readFileString(handlePath).pipe(
      Effect.mapError((cause) =>
        QaCaptureError.fromUnknown("sessionStore", "could not read the collector handle file", {
          cause,
          path: handlePath,
        })
      )
    );
    return yield* decodeCollectorHandleJson(raw).pipe(
      Effect.asSome,
      Effect.mapError((cause) =>
        QaCaptureError.fromUnknown("sessionStore", "collector handle failed schema decoding", {
          cause,
          path: handlePath,
        })
      )
    );
  });

  const writeCollectorHandle = Effect.fn("SessionStore.writeCollectorHandle")(function* (
    qaRoot: string,
    handle: CollectorHandle
  ) {
    const handlePath = collectorHandlePath(qaRoot);
    const json = yield* encodeCollectorHandleJson(handle).pipe(
      Effect.mapError((cause) =>
        QaCaptureError.fromUnknown("sessionStore", "collector handle failed schema encoding", {
          cause,
          path: handlePath,
        })
      )
    );
    yield* fs.makeDirectory(qaRoot, { recursive: true }).pipe(
      Effect.mapError((cause) =>
        QaCaptureError.fromUnknown("sessionStore", "could not create the qa root directory", {
          cause,
          path: qaRoot,
        })
      )
    );
    yield* fs.writeFileString(handlePath, json).pipe(
      Effect.mapError((cause) =>
        QaCaptureError.fromUnknown("sessionStore", "could not write the collector handle file", {
          cause,
          path: handlePath,
        })
      )
    );
    return handlePath;
  });

  const clearCollectorHandle = Effect.fn("SessionStore.clearCollectorHandle")(function* (qaRoot: string) {
    const handlePath = collectorHandlePath(qaRoot);
    yield* fs.remove(handlePath, { force: true }).pipe(
      Effect.mapError((cause) =>
        QaCaptureError.fromUnknown("sessionStore", "could not remove the collector handle file", {
          cause,
          path: handlePath,
        })
      )
    );
  });

  const service: SessionStoreShape = {
    clearCollectorHandle,
    collectorHandlePath,
    discoverNextRound,
    prepareRound,
    readCollectorHandle,
    readSessionManifest,
    roundLayout,
    writeCollectorHandle,
    writeSessionManifest,
  };
  return service;
});

/**
 * Effect service owning the `.beep/qa` session directory layout.
 *
 * **Example** (Get SessionStore layer)
 *
 * ```ts
 * import { SessionStore } from "@beep/qa-capture"
 * const layer = SessionStore.layer
 * console.log(layer)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class SessionStore extends Context.Service<SessionStore, SessionStoreShape>()($I`SessionStore`) {
  /**
   * Live session store layer over file-system and path services.
   *
   * **Example** (Reference live session layer)
   *
   * ```ts
   * import { SessionStore } from "@beep/qa-capture"
   * const layer = SessionStore.layer
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<SessionStore, never, FileSystem.FileSystem | Path.Path> = Layer.effect(
    SessionStore,
    Effect.map(makeService(), SessionStore.of)
  );
}
