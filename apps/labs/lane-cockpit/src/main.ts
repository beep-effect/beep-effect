/**
 * Entry point: draw the live lanes board full-screen in this terminal.
 *
 * **Details**
 *
 * Effect owns everything but the renderer: one fiber reads
 * `bun run beep session open --json` every `LANE_COCKPIT_INTERVAL` (default
 * 15 seconds) and re-renders the board with the decoded snapshot; another
 * drains copy requests from the board. `q` or Ctrl+C unmounts the board,
 * which restores the terminal and ends the program. Nothing is written to
 * the ledger or to any lane.
 *
 * Run from the repository root: `bun run --cwd apps/labs/lane-cockpit start`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import { renderToTerminal } from "@textjs/react/terminal";
import * as Config from "effect/Config";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Queue from "effect/Queue";
import * as Schedule from "effect/Schedule";
import { createElement } from "react";
import { copyText } from "./Clipboard.ts";
import { LaneSource, layerSessionOpen } from "./LaneSource.ts";
import { LanesPending } from "./Lanes.ts";
import { Cockpit } from "./LanesBoard.tsx";
import type { LanesSnapshot } from "./Lanes.ts";

const repositoryRoot = Effect.gen(function* () {
  const path = yield* Path.Path;
  // apps/labs/lane-cockpit/src/main.ts -> the checkout root.
  return yield* path.fromFileUrl(new URL("../../../../", import.meta.url));
});

const main = Effect.fnUntraced(function* () {
  const interval = yield* Config.Duration("LANE_COCKPIT_INTERVAL").pipe(Config.withDefault(Duration.seconds(15)));
  const source = yield* LaneSource;
  const copies = yield* Queue.unbounded<string>();

  let terminal: Awaited<ReturnType<typeof renderToTerminal>> | undefined;
  const draw = (snapshot: LanesSnapshot, now: DateTime.Utc) =>
    createElement(Cockpit, {
      snapshot,
      now,
      onCopy: (text) => {
        Queue.offerUnsafe(copies, text);
      },
      onQuit: () => terminal?.unmount(),
    });

  const startedAt = yield* DateTime.now;
  terminal = yield* Effect.promise(() => renderToTerminal(draw(LanesPending.make({}), startedAt)));
  const root = terminal;

  yield* Queue.take(copies).pipe(Effect.flatMap(copyText), Effect.forever, Effect.forkScoped);
  yield* source.read.pipe(
    Effect.flatMap((snapshot) =>
      Effect.map(DateTime.now, (now) => {
        root.rerender(draw(snapshot, now));
      })
    ),
    Effect.repeat(Schedule.spaced(interval)),
    Effect.forkScoped
  );

  // The board's own quit path (q, Ctrl+C) unmounts it and resolves this.
  return yield* Effect.promise(() => root.waitUntilExit());
});

const MainLive = Layer.unwrap(Effect.map(repositoryRoot, layerSessionOpen)).pipe(Layer.provideMerge(BunServices.layer));

BunRuntime.runMain(main().pipe(Effect.scoped, Effect.provide(MainLive)));
