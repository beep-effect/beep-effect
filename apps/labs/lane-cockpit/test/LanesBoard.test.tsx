import { afterEach, describe, expect, it } from "@effect/vitest";
import { cleanup, render } from "@textjs/react/testing";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { decodeReport } from "@/Lanes";
import { Cockpit } from "@/LanesBoard";
import { NOW, ROWS, snapshotOf } from "./fixtures.ts";
import type { RenderResult } from "@textjs/react/testing";
import type { LanesSnapshot } from "@/Lanes";

afterEach(() => cleanup());

interface Calls {
  readonly copies: Array<string>;
  quits: number;
}

const mount = Effect.fn("mount")(function* (snapshot: LanesSnapshot, rows = 16) {
  const calls: Calls = { copies: [], quits: 0 };
  const app = yield* Effect.promise(() =>
    render(
      <Cockpit
        snapshot={snapshot}
        now={NOW}
        cols={90}
        rows={rows}
        onCopy={(text) => {
          calls.copies.push(text);
        }}
        onQuit={() => {
          calls.quits += 1;
        }}
      />,
      { cols: 90, rows }
    )
  );
  return { app, calls };
});

const press = (app: RenderResult, keys: string) => Effect.promise(() => app.press(keys));
const type = (app: RenderResult, text: string) => Effect.promise(() => app.type(text));

// Lane names in the order the list draws them: rows with a marker column, a lane and a state.
const LIST_ROW = /^│ [>! ] (\S+)\s+(?:open|blocked)\s/;
const listedLanes = (app: RenderResult): ReadonlyArray<string> =>
  pipe(
    app.lines(),
    A.map((line) => O.fromNullishOr(LIST_ROW.exec(line)?.[1])),
    A.getSomes
  );

// Text.js renders through process-wide state (the active root, the input engine), so
// frames from concurrent tests would interleave; this suite runs one test at a time.
describe("LanesBoard frames", { concurrent: false }, () => {
  it.effect("orders blocked lanes first, then by age of the last note", () =>
    Effect.gen(function* () {
      const snapshot = yield* snapshotOf(ROWS);
      const { app } = yield* mount(snapshot);
      expect(listedLanes(app)).toStrictEqual([
        "stood-down",
        "reboot-successor",
        "async-merge",
        "residue-closeout",
        "budget-ledger",
      ]);
      const frame = app.lastFrame();
      expect(frame).toContain("Lanes  5 live · 2 blocked · oldest 1d");
      expect(frame).toContain("8h");
      expect(frame).toContain("#3068");
      expect(frame).toContain("↑↓ move · / filter · enter expand · y copy path · p copy PR · q quit");
    })
  );

  it.effect("moves the selection and shows the selected lane in the detail pane", () =>
    Effect.gen(function* () {
      const snapshot = yield* snapshotOf(ROWS);
      const { app } = yield* mount(snapshot);
      expect(app.lastFrame()).toContain("> stood-down");
      yield* press(app, "down down down");
      const frame = app.lastFrame();
      expect(frame).toContain("> residue-closeout");
      expect(frame).toContain("residue-closeout · feat/residue-closeout · claude-code · open · 16m ago");
      expect(frame).toContain("checkout: /work/beep-effect-worktrees/residue-closeout");
      expect(frame).not.toContain("summary:");

      yield* press(app, "return");
      const expanded = app.lastFrame();
      expect(expanded).toContain("summary: re-final after the hand merge");
      expect(expanded).toContain("pr: https://github.com/beep-effect/beep-effect/pull/3073");

      yield* press(app, "up up up up up");
      expect(app.lastFrame()).toContain("> stood-down");
    })
  );

  it.effect("filters by text after slash and clears on escape", () =>
    Effect.gen(function* () {
      const snapshot = yield* snapshotOf(ROWS);
      const { app } = yield* mount(snapshot);
      yield* press(app, "/");
      yield* type(app, "final");
      expect(listedLanes(app)).toStrictEqual(["residue-closeout", "budget-ledger"]);
      expect(app.lastFrame()).toContain("/final▏");

      yield* press(app, "return");
      expect(app.lastFrame()).toContain("/final");
      expect(listedLanes(app)).toStrictEqual(["residue-closeout", "budget-ledger"]);

      yield* press(app, "/");
      yield* type(app, "zzz");
      expect(app.lastFrame()).toContain("no lanes match /finalzzz");

      yield* press(app, "escape");
      expect(A.length(listedLanes(app))).toBe(5);
    })
  );

  it.effect("copies the checkout path and the PR link, and quits on q", () =>
    Effect.gen(function* () {
      const snapshot = yield* snapshotOf(ROWS);
      const { app, calls } = yield* mount(snapshot);
      yield* press(app, "p");
      expect(app.lastFrame()).toContain("nothing to copy: no PR link");
      yield* press(app, "y");
      expect(app.lastFrame()).toContain("copied checkout path: /work/beep-effect-worktrees/stood-down");
      yield* press(app, "down down down down p");
      expect(calls.copies).toStrictEqual([
        "/work/beep-effect-worktrees/stood-down",
        "https://github.com/beep-effect/beep-effect/pull/3068",
      ]);
      expect(calls.quits).toBe(0);
      yield* press(app, "q");
      expect(calls.quits).toBe(1);
    })
  );

  it.effect("keeps the selection visible when the list is taller than the frame", () =>
    Effect.gen(function* () {
      const snapshot = yield* snapshotOf(ROWS);
      const { app } = yield* mount(snapshot, 10);
      yield* press(app, "down down down down");
      expect(app.lastFrame()).toContain("> budget-ledger");
      expect(listedLanes(app)).not.toContain("stood-down");
    })
  );

  it.effect("draws an empty ledger", () =>
    Effect.gen(function* () {
      const snapshot = yield* snapshotOf([]);
      const { app } = yield* mount(snapshot);
      const frame = app.lastFrame();
      expect(frame).toContain("Lanes  0 live · 0 blocked");
      expect(frame).toContain("no live sessions recorded for this repository");
    })
  );

  it.effect("drops corrupt rows, counts them and still draws the rest", () =>
    Effect.gen(function* () {
      const snapshot = yield* snapshotOf([...ROWS, { lane: 42 }, { ...ROWS[0], state: "lost" }, "garbage"]);
      const { app } = yield* mount(snapshot);
      const frame = app.lastFrame();
      expect(frame).toContain("5 live · 2 blocked · oldest 1d · 3 unreadable");
      expect(frame).toContain("! 3 ledger row(s) could not be read and are not shown");
      expect(A.length(listedLanes(app))).toBe(5);
    })
  );

  it.effect("renders an error state for a malformed report instead of crashing", () =>
    Effect.gen(function* () {
      const { app } = yield* mount(decodeReport(NOW)('{"schemaVersion":"other"}'));
      const frame = app.lastFrame();
      expect(frame).toContain("Lanes  report unreadable");
      expect(frame).toContain("! The session report is not a session-open/v1 document.");
      expect(pipe(frame, Str.includes("last attempt 0s ago"))).toBe(true);
    })
  );
});
