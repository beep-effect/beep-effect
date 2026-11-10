/**
 * Pure view logic for the lanes board: ordering, filtering, ages, row text
 * and the visible window. The components only arrange what this module
 * computes, so every rule here is testable without a renderer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LaneCockpitId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import { pipe } from "effect/Function";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { LaneState } from "./Lanes.ts";
import type { LaneRepository, LaneRow } from "./Lanes.ts";

const $I = $LaneCockpitId.create("Board");

const blockedFirst: Order.Order<LaneRow> = Order.mapInput(Order.Number, (lane: LaneRow) =>
  LaneState.is.blocked(lane.state) ? 0 : 1
);

// Newest note first inside each state group, so the freshest work leads.
const newestFirst: Order.Order<LaneRow> = Order.mapInput(
  Order.Number,
  (lane: LaneRow) => -DateTime.toEpochMillis(lane.recordedAt)
);

/**
 * Order lanes blocked first, then by the age of their last note, newest first.
 *
 * **Example** (Order an empty board)
 *
 * ```ts
 * import { orderLanes } from "@/Board"
 *
 * console.log(orderLanes([]).length) // 0
 * ```
 *
 * @param lanes - Decoded lanes in any order.
 * @returns The lanes in board order.
 * @category ordering
 * @since 0.0.0
 */
export const orderLanes = (lanes: ReadonlyArray<LaneRow>): ReadonlyArray<LaneRow> =>
  A.sort(lanes, Order.combine(blockedFirst, newestFirst));

/**
 * Keep the lanes whose lane, branch, state, PR, next step or summary contains
 * the filter text, ignoring case. An empty filter keeps every lane.
 *
 * **Example** (An empty filter keeps everything)
 *
 * ```ts
 * import { filterLanes } from "@/Board"
 *
 * console.log(filterLanes("")([]).length) // 0
 * ```
 *
 * @param filter - The text typed after `/`.
 * @returns A filter over lanes.
 * @category filtering
 * @since 0.0.0
 */
export const filterLanes =
  (filter: string) =>
  (lanes: ReadonlyArray<LaneRow>): ReadonlyArray<LaneRow> => {
    const needle = Str.toLowerCase(Str.trim(filter));
    return Str.isEmpty(needle)
      ? lanes
      : A.filter(lanes, (lane) =>
          A.some(
            [
              lane.lane,
              lane.branch,
              lane.state,
              lane.next,
              O.getOrElse(lane.summary, () => ""),
              O.match(lane.pr, { onNone: () => "", onSome: (pr) => `#${pr}` }),
            ],
            (field) => Str.includes(needle)(Str.toLowerCase(field))
          )
        );
  };

/**
 * Age of a note as the board prints it: `45s`, `12m`, `8h`, `2d`.
 *
 * **Example** (Twelve minutes)
 *
 * ```ts
 * import { formatAge } from "@/Board"
 * import * as DateTime from "effect/DateTime"
 *
 * console.log(formatAge(DateTime.makeUnsafe(720_000))(DateTime.makeUnsafe(0))) // "12m"
 * ```
 *
 * @param now - The time the board is drawn for.
 * @returns A formatter from a note's time to a compact age; a note from the future reads `0s`.
 * @category formatting
 * @since 0.0.0
 */
export const formatAge =
  (now: DateTime.Utc) =>
  (at: DateTime.Utc): string => {
    const seconds = Math.max(0, Math.floor(Duration.toSeconds(DateTime.distance(at, now))));
    return seconds < 60
      ? `${seconds}s`
      : seconds < 3_600
        ? `${Math.floor(seconds / 60)}m`
        : seconds < 86_400
          ? `${Math.floor(seconds / 3_600)}h`
          : `${Math.floor(seconds / 86_400)}d`;
  };

/**
 * Fit text to exactly `width` cells: pad short text, cut long text with `…`.
 *
 * **Example** (Cut a long step)
 *
 * ```ts
 * import { fit } from "@/Board"
 *
 * console.log(fit(6)("final-check running")) // "final…"
 * ```
 *
 * @param width - Cells available.
 * @returns A fitter.
 * @category formatting
 * @since 0.0.0
 */
export const fit =
  (width: number) =>
  (text: string): string => {
    const single = Str.replaceAll(/\s+/g, " ")(text);
    return width <= 0
      ? ""
      : Str.length(single) <= width
        ? Str.padEnd(width, " ")(single)
        : `${Str.takeLeft(single, width - 1)}…`;
  };

/**
 * The pull-request URL for a lane, if it has a PR.
 *
 * **Example** (A lane without a PR)
 *
 * ```ts
 * import { prLink } from "@/Board"
 * import { LaneRepository } from "@/Lanes"
 * import * as O from "effect/Option"
 *
 * const repository = LaneRepository.make({ host: "github.com", owner: "o", name: "r" })
 * console.log(O.isNone(prLink(repository)(O.none()))) // true
 * ```
 *
 * @param repository - The report's repository.
 * @returns A function from a lane's PR number to its URL.
 * @category formatting
 * @since 0.0.0
 */
export const prLink =
  (repository: LaneRepository) =>
  (pr: O.Option<number>): O.Option<string> =>
    O.map(pr, (number) => `https://${repository.host}/${repository.owner}/${repository.name}/pull/${number}`);

/**
 * Column widths of one board row, given the inner width of the frame.
 *
 * **Example** (Make column widths)
 *
 * ```ts
 * import { RowColumns } from "@/Board"
 *
 * console.log(RowColumns.make({ lane: 20, state: 8, pr: 6, age: 4, next: 30 }).next) // 30
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RowColumns extends S.Class<RowColumns, { readonly brand: unique symbol }>($I`RowColumns`)(
  {
    lane: S.Int,
    state: S.Int,
    pr: S.Int,
    age: S.Int,
    next: S.Int,
  },
  $I.annote("RowColumns", { description: "Cell widths of the columns of one board row." })
) {}

/**
 * What the operator is looking at: the selected lane, the filter and whether
 * the detail pane is expanded. Selection is held by checkout, so a refresh
 * that reorders the board keeps the same lane selected.
 *
 * **Example** (The initial view)
 *
 * ```ts
 * import { BoardView } from "@/Board"
 *
 * console.log(BoardView.initial.filtering) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoardView extends S.Class<BoardView, { readonly brand: unique symbol }>($I`BoardView`)(
  {
    selected: S.Option(S.String),
    filter: S.String,
    filtering: S.Boolean,
    expanded: S.Boolean,
    notice: S.Option(S.String),
  },
  $I.annote("BoardView", { description: "Operator-side view state of the lanes board." })
) {
  static readonly initial = BoardView.make({
    selected: O.none(),
    filter: "",
    filtering: false,
    expanded: false,
    notice: O.none(),
  });
}

/**
 * Split the inner width into row columns; the next step takes what is left.
 *
 * **Example** (An 80-cell frame)
 *
 * ```ts
 * import { rowColumns } from "@/Board"
 *
 * console.log(rowColumns(76).lane) // 26
 * ```
 *
 * @param inner - Cells inside the frame border and padding.
 * @returns The column widths.
 * @category layout
 * @since 0.0.0
 */
export const rowColumns = (inner: number): RowColumns => {
  const lane = Num.clamp(Math.floor(inner * 0.34), { minimum: 12, maximum: 34 });
  const fixed = 2 + lane + 1 + 8 + 1 + 6 + 1 + 4 + 1;
  return RowColumns.make({ lane, state: 8, pr: 6, age: 4, next: Math.max(0, inner - fixed) });
};

/**
 * The text of one board row: marker, lane, state, PR, age and next step.
 *
 * **Example** (Columns are fixed width)
 *
 * ```ts
 * import { rowColumns, rowText } from "@/Board"
 *
 * console.log(rowText(rowColumns(40))({ marker: "> ", lane: "l", state: "open", pr: "—", age: "3m", next: "n" }).length) // 40
 * ```
 *
 * @param columns - Widths from {@link rowColumns}.
 * @returns A function from formatted cell values to a row exactly as wide as the columns.
 * @category formatting
 * @since 0.0.0
 */
export const rowText =
  (columns: RowColumns) =>
  (cells: {
    readonly marker: string;
    readonly lane: string;
    readonly state: string;
    readonly pr: string;
    readonly age: string;
    readonly next: string;
  }): string =>
    pipe(
      [
        fit(2)(cells.marker),
        fit(columns.lane)(cells.lane),
        " ",
        fit(columns.state)(cells.state),
        " ",
        fit(columns.pr)(cells.pr),
        " ",
        Str.padStart(columns.age, " ")(cells.age),
        " ",
        fit(columns.next)(cells.next),
      ],
      A.join("")
    );

/**
 * First visible index so the selection stays inside a window of `height` rows.
 *
 * **Example** (Selection near the end)
 *
 * ```ts
 * import { windowStart } from "@/Board"
 *
 * console.log(windowStart({ selected: 9, count: 10, height: 4 })) // 6
 * ```
 *
 * @param window - Selected index, number of rows and visible rows.
 * @returns The first visible row index.
 * @category layout
 * @since 0.0.0
 */
export const windowStart = ({
  selected,
  count,
  height,
}: {
  readonly selected: number;
  readonly count: number;
  readonly height: number;
}): number => Num.clamp(selected - Math.floor(height / 2), { minimum: 0, maximum: Math.max(0, count - height) });
