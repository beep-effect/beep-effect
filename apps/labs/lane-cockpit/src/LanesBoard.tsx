/**
 * The lanes board: a props-in Text.js component tree, plus the cockpit shell
 * that owns keyboard handling and view state.
 *
 * **Details**
 *
 * No timer, subprocess or decode runs here. `LanesBoard` draws exactly what
 * it is given; `Cockpit` adds the operator's view state (selection, filter,
 * expansion) and hands copy and quit requests back to its caller.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Box, Text, useInput, useViewport } from "@textjs/react";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import { pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { useState } from "react";
import {
  BoardView,
  filterLanes,
  fit,
  formatAge,
  orderLanes,
  prLink,
  rowColumns,
  rowText,
  windowStart,
} from "./Board.ts";
import { LaneState, LanesSnapshot } from "./Lanes.ts";
import type { KeyEvent } from "@textjs/react";
import type { ReactNode } from "react";
import type { LaneRepository, LaneRow, LanesLoaded } from "./Lanes.ts";

const KEYS_HELP = " ↑↓ move · / filter · enter expand · y copy path · p copy PR · q quit ";

/**
 * Props of {@link LanesBoard}.
 *
 * @category models
 * @since 0.0.0
 */
export interface LanesBoardProps {
  readonly cols: number;
  readonly now: DateTime.Utc;
  readonly rows: number;
  readonly snapshot: LanesSnapshot;
  readonly view: BoardView;
}

/**
 * The lanes a view shows, in board order, after the filter.
 *
 * **Example** (A pending snapshot shows nothing)
 *
 * ```ts
 * import { BoardView } from "@/Board"
 * import { visibleLanes } from "@/LanesBoard"
 * import { LanesPending } from "@/Lanes"
 *
 * console.log(visibleLanes(BoardView.initial)(LanesPending.make({})).length) // 0
 * ```
 *
 * @param view - The operator's view state.
 * @returns A function from the source's last snapshot to the rows the board lists.
 * @category view
 * @since 0.0.0
 */
export const visibleLanes =
  (view: BoardView) =>
  (snapshot: LanesSnapshot): ReadonlyArray<LaneRow> =>
    LanesSnapshot.guards.LanesLoaded(snapshot) ? pipe(snapshot.lanes, orderLanes, filterLanes(view.filter)) : [];

const selectedIndex = (lanes: ReadonlyArray<LaneRow>, view: BoardView): number =>
  pipe(
    view.selected,
    O.flatMap((checkout) => A.findFirstIndex(lanes, (lane) => lane.checkout === checkout)),
    O.getOrElse(() => 0)
  );

const prCell = (lane: LaneRow): string => O.match(lane.pr, { onNone: () => "—", onSome: (pr) => `#${pr}` });

const headerTitle = (snapshot: LanesSnapshot, now: DateTime.Utc): string =>
  LanesSnapshot.match(snapshot, {
    LanesPending: () => " Lanes  reading session open… ",
    LanesFailed: () => " Lanes  report unreadable ",
    LanesLoaded: (loaded) => {
      const blocked = A.length(A.filter(loaded.lanes, (lane) => LaneState.is.blocked(lane.state)));
      const oldest = A.isReadonlyArrayNonEmpty(loaded.lanes)
        ? ` · oldest ${formatAge(now)(
            A.min(
              A.map(loaded.lanes, (lane) => lane.recordedAt),
              DateTime.Order
            )
          )}`
        : "";
      const corrupt = loaded.corrupt > 0 ? ` · ${loaded.corrupt} unreadable` : "";
      return ` Lanes  ${A.length(loaded.lanes)} live · ${blocked} blocked${oldest}${corrupt} `;
    },
  });

const LaneLine = ({ text, lane, selected }: { text: string; lane: LaneRow; selected: boolean }): ReactNode => (
  <Text inverse={selected} bold={selected} color={LaneState.is.blocked(lane.state) ? "red" : undefined}>
    {text}
  </Text>
);

const detailLines = (
  repository: LaneRepository,
  lane: LaneRow,
  now: DateTime.Utc,
  expanded: boolean,
  inner: number
): ReadonlyArray<string> => {
  const head = `${lane.lane} · ${lane.branch} · ${lane.harness} · ${lane.state} · ${formatAge(now)(lane.recordedAt)} ago`;
  const link = O.getOrElse(prLink(repository)(lane.pr), () => "—");
  return expanded
    ? A.map(
        [
          head,
          `next: ${lane.next}`,
          `summary: ${O.getOrElse(lane.summary, () => "—")}`,
          `checkout: ${lane.checkout}`,
          `clone: ${lane.clone}`,
          `pr: ${link}`,
          `session: ${O.getOrElse(lane.sessionId, () => "—")}`,
          `recorded: ${DateTime.formatIso(lane.recordedAt)}`,
        ],
        fit(inner)
      )
    : A.map([head, `next: ${lane.next}`, `checkout: ${lane.checkout}`], fit(inner));
};

const LoadedBody = ({
  loaded,
  now,
  view,
  inner,
  height,
}: {
  loaded: LanesLoaded;
  now: DateTime.Utc;
  view: BoardView;
  inner: number;
  height: number;
}): ReactNode => {
  const lanes = visibleLanes(view)(loaded);
  const columns = rowColumns(inner);
  const selected = selectedIndex(lanes, view);
  const filterLine =
    view.filtering || Str.isNonEmpty(view.filter) ? O.some(`/${view.filter}${view.filtering ? "▏" : ""}`) : O.none();
  const corruptLine =
    loaded.corrupt > 0 ? O.some(`! ${loaded.corrupt} ledger row(s) could not be read and are not shown`) : O.none();
  const detail = pipe(
    A.get(lanes, selected),
    O.map((lane) => detailLines(loaded.repository, lane, now, view.expanded, inner))
  );
  const detailHeight = O.match(detail, { onNone: () => 0, onSome: (lines) => A.length(lines) + 1 });
  const listHeight = Math.max(
    1,
    height -
      detailHeight -
      (O.isSome(filterLine) ? 1 : 0) -
      (O.isSome(corruptLine) ? 1 : 0) -
      (O.isSome(view.notice) ? 1 : 0)
  );
  const start = windowStart({ selected, count: A.length(lanes), height: listHeight });
  const window = A.take(A.drop(lanes, start), listHeight);
  const empty = A.isReadonlyArrayEmpty(lanes);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {O.match(corruptLine, { onNone: () => null, onSome: (line) => <Text color="yellow">{fit(inner)(line)}</Text> })}
      {O.match(filterLine, { onNone: () => null, onSome: (line) => <Text color="cyan">{fit(inner)(line)}</Text> })}
      <Box flexDirection="column" height={listHeight}>
        {empty ? (
          <Text dim>
            {fit(inner)(
              A.isReadonlyArrayEmpty(loaded.lanes)
                ? "no live sessions recorded for this repository"
                : `no lanes match /${view.filter}`
            )}
          </Text>
        ) : (
          A.map(window, (lane, offset) => (
            <LaneLine
              key={lane.checkout}
              lane={lane}
              selected={start + offset === selected}
              text={rowText(columns)({
                marker: start + offset === selected ? ">" : LaneState.is.blocked(lane.state) ? "!" : " ",
                lane: lane.lane,
                state: lane.state,
                pr: prCell(lane),
                age: formatAge(now)(lane.recordedAt),
                next: lane.next,
              })}
            />
          ))
        )}
      </Box>
      {O.match(detail, {
        onNone: () => null,
        onSome: (lines) => (
          <Box flexDirection="column">
            <Text dim>{Str.repeat(inner)("─")}</Text>
            {A.map(lines, (line, index) => (
              <Text key={`detail-${index}`} bold={index === 0}>
                {line}
              </Text>
            ))}
          </Box>
        ),
      })}
      {O.match(view.notice, {
        onNone: () => null,
        onSome: (notice) => <Text color="green">{fit(inner)(notice)}</Text>,
      })}
    </Box>
  );
};

/**
 * Draw the board for a snapshot and a view. Pure: same props, same frame.
 *
 * **Example** (Render offscreen)
 *
 * ```ts
 * import { BoardView } from "@/Board"
 * import { LanesBoard } from "@/LanesBoard"
 * import { LanesPending } from "@/Lanes"
 * import * as DateTime from "effect/DateTime"
 *
 * const element = LanesBoard({ snapshot: LanesPending.make({}), now: DateTime.makeUnsafe(0), view: BoardView.initial, cols: 80, rows: 10 })
 * console.log(element !== null) // true
 * ```
 *
 * @param props - Snapshot, clock reading, view state and frame size.
 * @returns The board element.
 * @category components
 * @since 0.0.0
 */
export const LanesBoard = ({ snapshot, now, view, cols, rows }: LanesBoardProps): ReactNode => {
  // Border (2) and horizontal padding (2).
  const inner = Math.max(10, cols - 4);
  const height = Math.max(1, rows - 2);
  return (
    <Box
      border="rounded"
      paddingX={1}
      width={cols}
      height={rows}
      flexDirection="column"
      title={headerTitle(snapshot, now)}
      bottomTitle={KEYS_HELP}
    >
      {LanesSnapshot.match(snapshot, {
        LanesPending: () => <Text dim>{fit(inner)("reading bun run beep session open --json…")}</Text>,
        LanesFailed: (failed) => (
          <Box flexDirection="column">
            <Text color="red">{fit(inner)(`! ${failed.message}`)}</Text>
            <Text dim>
              {fit(inner)(`last attempt ${formatAge(now)(failed.fetchedAt)} ago; the board retries on its interval`)}
            </Text>
          </Box>
        ),
        LanesLoaded: (loaded) => <LoadedBody loaded={loaded} now={now} view={view} inner={inner} height={height} />,
      })}
    </Box>
  );
};

/**
 * Props of {@link Cockpit}.
 *
 * @category models
 * @since 0.0.0
 */
export interface CockpitProps {
  /** Fixed size; defaults to the renderer's viewport. */
  readonly cols?: number;
  readonly now: DateTime.Utc;
  /** Copy text to the operator's clipboard; `label` names what was copied. */
  readonly onCopy: (text: string, label: string) => void;
  readonly onQuit: () => void;
  readonly rows?: number;
  readonly snapshot: LanesSnapshot;
}

const moveSelection = (lanes: ReadonlyArray<LaneRow>, view: BoardView, delta: number): BoardView =>
  pipe(
    A.get(lanes, Math.min(Math.max(selectedIndex(lanes, view) + delta, 0), Math.max(0, A.length(lanes) - 1))),
    O.match({
      onNone: () => view,
      onSome: (lane) => BoardView.make({ ...view, selected: O.some(lane.checkout), notice: O.none() }),
    })
  );

const filterKey = (view: BoardView, event: KeyEvent): BoardView =>
  Match.value(event.key).pipe(
    Match.when("escape", () => BoardView.make({ ...view, filtering: false, filter: "" })),
    Match.when("return", () => BoardView.make({ ...view, filtering: false })),
    Match.when("backspace", () => BoardView.make({ ...view, filter: Str.slice(0, -1)(view.filter) })),
    Match.orElse(() =>
      Str.isNonEmpty(event.input) && !event.ctrl && !event.meta
        ? BoardView.make({ ...view, filter: `${view.filter}${event.input}` })
        : view
    )
  );

/**
 * The interactive cockpit: the board plus keys, selection, filter and expansion.
 *
 * **Example** (Build the element)
 *
 * ```ts
 * import { Cockpit } from "@/LanesBoard"
 *
 * console.log(typeof Cockpit) // "function"
 * ```
 *
 * @param props - Snapshot, clock reading and the copy / quit callbacks.
 * @returns The cockpit element.
 * @category components
 * @since 0.0.0
 */
export const Cockpit = ({ snapshot, now, onCopy, onQuit, cols, rows }: CockpitProps): ReactNode => {
  const viewport = useViewport();
  const [view, setView] = useState(BoardView.initial);
  const lanes = visibleLanes(view)(snapshot);
  const current = A.get(lanes, selectedIndex(lanes, view));
  const repository = LanesSnapshot.guards.LanesLoaded(snapshot) ? O.some(snapshot.repository) : O.none();

  const copy = (label: string, text: O.Option<string>): BoardView =>
    O.match(text, {
      onNone: () => BoardView.make({ ...view, notice: O.some(`nothing to copy: no ${label}`) }),
      onSome: (value) => {
        onCopy(value, label);
        return BoardView.make({ ...view, notice: O.some(`copied ${label}: ${value}`) });
      },
    });

  useInput((event) => {
    setView(
      view.filtering
        ? filterKey(view, event)
        : Match.value(event.key).pipe(
            Match.whenOr("up", "k", () => moveSelection(lanes, view, -1)),
            Match.whenOr("down", "j", () => moveSelection(lanes, view, 1)),
            Match.when("pageup", () => moveSelection(lanes, view, -10)),
            Match.when("pagedown", () => moveSelection(lanes, view, 10)),
            Match.when("/", () => BoardView.make({ ...view, filtering: true, notice: O.none() })),
            Match.when("return", () => BoardView.make({ ...view, expanded: !view.expanded })),
            Match.when("escape", () => BoardView.make({ ...view, expanded: false, filter: "", notice: O.none() })),
            Match.when("y", () =>
              copy(
                "checkout path",
                O.map(current, (lane) => lane.checkout)
              )
            ),
            Match.when("p", () =>
              copy(
                "PR link",
                O.flatMap(repository, (repo) => O.flatMap(current, (lane) => prLink(repo)(lane.pr)))
              )
            ),
            Match.when("q", () => {
              onQuit();
              return view;
            }),
            Match.orElse(() => view)
          )
    );
  });

  return (
    <LanesBoard snapshot={snapshot} now={now} view={view} cols={cols ?? viewport.cols} rows={rows ?? viewport.rows} />
  );
};
