/**
 * Measurements of a rendered sheet set for read-only critics: the stroke
 * table (`render/RENDER.md`) and the measured facts (`render/MEASUREMENTS.md`
 * beside `render/measurements.json`) the critic pack carries.
 *
 * **Details**
 *
 * Every function here is pure: it reads the figure SVG text, or the text
 * `pdfinfo -box` and `pdffonts` print, and returns numbers in sheet
 * millimetres measured from the page's top-left corner. The critic service
 * gathers the inputs and writes the files.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { MARGINS_CM } from "@beep/technical-drawing";
import { A, O, Str } from "@beep/utils";
import { identity, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import {
  CriticEdgeClearance,
  CriticFigureMeasurements,
  CriticInkBox,
  CriticPathLayer,
  CriticPdfBox,
  CriticPdfFont,
  CriticPdfPage,
  CriticShadingStats,
  CriticTextLabel,
} from "./Drawings.measurements.schemas.ts";
import type { CriticMeasurements } from "./Drawings.measurements.schemas.ts";

const PT_PER_MM = 72 / 25.4;
const SHADING_STROKE_PT = "0.567";
// Path layers that carry the sheet's labels rather than the view.
const LABEL_LAYERS = HashSet.fromIterable(["labels", "label-outlines"]);
// Straight pieces a curve is flattened into before it is measured.
const CURVE_STEPS = 16;
// Facing strokes closer than this are one line drawn twice, not parallel neighbours.
const SAME_LINE_MM = 0.005;
// Strokes whose directions differ by at most this many degrees are parallel neighbours: on a face of a
// converging pictorial the hatch strokes run toward a vanishing point, so each turns from the next by a
// fraction of a degree, and a whole band can span several.
const PARALLEL_DEG = 2.5;
const NUMBER = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;

type Point = readonly [number, number];

interface StrokeRow {
  readonly angle: number;
  // The unrounded direction in degrees, [0, 180), and endpoints in mm, for the gap measure.
  readonly direction: number;
  readonly from: Point;
  readonly length: number;
  readonly offset: number;
  readonly to: Point;
  readonly x1: number;
  readonly x2: number;
  readonly y1: number;
  readonly y2: number;
}

const round = (value: number, digits: number) => Number(value.toFixed(digits));

const sumOf = (values: ReadonlyArray<number>): number => A.reduce(values, 0, (total, value) => total + value);

const numbersIn = (text: string): ReadonlyArray<number> =>
  A.map(A.fromIterable(Str.matchAll(NUMBER)(text)), (m) => Number(m[0]));

// ---------------------------------------------------------------------------
// SVG reading
// ---------------------------------------------------------------------------

const attr = (tag: string, name: string): O.Option<string> =>
  pipe(
    O.fromNullishOr(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(tag)),
    O.flatMap((m) => O.fromUndefinedOr(m[1] ?? m[2]))
  );

const UNIT_PT: Readonly<Record<string, number>> = { pt: 1, mm: PT_PER_MM, cm: PT_PER_MM * 10, in: 72, px: 0.75 };

// A length attribute (`612pt`, `215.9mm`, `816`) in points; a bare number is CSS pixels.
const lengthPt = (value: string): O.Option<number> =>
  pipe(
    O.fromNullishOr(/^\s*([-+]?(?:\d+\.?\d*|\.\d+))\s*(pt|mm|cm|in|px)?\s*$/.exec(value)),
    O.map((m) => Number(m[1]) * (UNIT_PT[m[2] ?? "px"] ?? 0.75))
  );

interface SheetScale {
  readonly heightMm: number;
  readonly unitsPerMm: number;
  readonly widthMm: number;
}

// User units per millimetre and the sheet size. With a viewBox the scale is its width over the
// root width; without one the sheets' own convention holds, one user unit per point.
const sheetScale = (svg: string): SheetScale => {
  const root = pipe(
    O.fromNullishOr(/<svg\b[^>]*>/.exec(svg)),
    O.map((m) => m[0]),
    O.getOrElse(() => "")
  );
  const widthPt = pipe(attr(root, "width"), O.flatMap(lengthPt));
  const heightPt = pipe(attr(root, "height"), O.flatMap(lengthPt));
  const viewBox = pipe(
    attr(root, "viewBox"),
    O.map(numbersIn),
    O.filter((ns) => A.length(ns) === 4)
  );
  const unitsPerPt = pipe(
    O.zipWith(viewBox, widthPt, (box, width) => ((box[2] ?? 0) > 0 && width > 0 ? (box[2] ?? 0) / width : 1)),
    O.getOrElse(() => 1)
  );
  const unitsPerMm = unitsPerPt * PT_PER_MM;
  const sizeMm = (pt: O.Option<number>, index: number) =>
    pipe(
      pt,
      O.map((value) => value / PT_PER_MM),
      O.orElse(() => O.map(viewBox, (box) => (box[index] ?? 0) / unitsPerMm)),
      O.getOrElse(() => 0)
    );
  return { unitsPerMm, widthMm: sizeMm(widthPt, 2), heightMm: sizeMm(heightPt, 3) };
};

const unescapeXml = (text: string): string =>
  pipe(
    text,
    Str.replaceAll("&lt;", "<"),
    Str.replaceAll("&gt;", ">"),
    Str.replaceAll("&quot;", '"'),
    Str.replaceAll("&#39;", "'"),
    Str.replaceAll("&apos;", "'"),
    Str.replaceAll("&amp;", "&")
  );

const pathTags = (svg: string): ReadonlyArray<string> =>
  A.map(A.fromIterable(Str.matchAll(/<path\b[^>]*>/g)(svg)), (m) => m[0]);

// ---------------------------------------------------------------------------
// Shading strokes (the stroke table and the shading statistics)
// ---------------------------------------------------------------------------

// The stroke row of one drawn segment, in sheet millimetres; none for a zero-length segment.
const rowOf = (from: Point, to: Point): O.Option<StrokeRow> => {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) {
    return O.none();
  }
  const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 180) % 180;
  const normal = angle >= 90 ? ([dy / length, -dx / length] as const) : ([-dy / length, dx / length] as const);
  return O.some({
    angle: round(angle, 1),
    direction: angle,
    from,
    to,
    offset: round(x1 * normal[0] + y1 * normal[1], 2),
    length: round(length, 2),
    x1: round(x1, 1),
    y1: round(y1, 1),
    x2: round(x2, 1),
    y2: round(y2, 1),
  });
};

// The stroke rows of a shading path's move/line data: each line command draws from the current point.
const rowsOfPath = (data: string, unitsPerMm: number): ReadonlyArray<StrokeRow> =>
  pipe(
    A.mapAccum(
      A.fromIterable(Str.matchAll(/([ML])\s*([-\d.]+)[ ,]([-\d.]+)/g)(data)),
      O.none<Point>(),
      (current, m): readonly [O.Option<Point>, O.Option<StrokeRow>] => {
        const point: Point = [Number(m[2]) / unitsPerMm, Number(m[3]) / unitsPerMm];
        return m[1] === "M"
          ? [O.some(point), O.none()]
          : [O.some(point), O.flatMap(current, (from) => rowOf(from, point))];
      }
    ),
    ([, rows]) => A.getSomes(rows)
  );

// The shading layer of a figure SVG: the path with id `shading`, or else the first path drawn at the
// shading stroke weight (0.567 pt).
const shadingPathData = (svg: string): O.Option<string> => {
  const paths = pathTags(svg);
  return pipe(
    A.findFirst(paths, (tag) => O.contains(attr(tag, "id"), "shading")),
    O.orElse(() => A.findFirst(paths, Str.includes(SHADING_STROKE_PT))),
    O.flatMap((tag) => attr(tag, "d"))
  );
};

const shadingRows = (svg: string): ReadonlyArray<StrokeRow> =>
  pipe(
    shadingPathData(svg),
    O.match({
      onNone: A.empty<StrokeRow>,
      onSome: (d) => rowsOfPath(d, sheetScale(svg).unitsPerMm),
    })
  );

const byAngleThenOffset = Order.combine(
  Order.mapInput(Order.Number, (row: StrokeRow) => row.angle),
  Order.mapInput(Order.Number, (row: StrokeRow) => row.offset)
);

/**
 * The stroke table a text-only reviewer measures from: every shading stroke
 * of every figure with its direction, perpendicular offset (same family =
 * parallel lines; consecutive offsets give the gaps), length, and endpoints,
 * all in mm from the page's top-left corner.
 *
 * **Example** (A figure with no shading path)
 *
 * ```ts
 * import { strokeTableMarkdown } from "@beep/repo-cli/commands/Drawings"
 *
 * const table = strokeTableMarkdown({ title: "Crate", sheetSetSha256: "0".repeat(64), specSha256: "1".repeat(64), figures: [{ figure: 1, view: "front", svg: "<svg></svg>", coverage: "{}" }] })
 * console.log(table.includes("FIG 1 (front) — 0 shading strokes")) // true
 * ```
 *
 * @param input - Drawing title, provenance hashes, and figure SVGs with coverage descriptions.
 * @returns Markdown for `render/RENDER.md` listing shading strokes in millimetres, grouped by figure.
 * @category formatting
 * @since 0.0.0
 */
export const strokeTableMarkdown = (input: {
  readonly title: string;
  readonly sheetSetSha256: string;
  readonly specSha256: string;
  readonly figures: ReadonlyArray<{
    readonly figure: number;
    readonly view: string;
    readonly svg: string;
    readonly coverage: string;
  }>;
}): string => {
  const sections = A.map(input.figures, (figure) => {
    const rows = pipe(shadingRows(figure.svg), A.sort(byAngleThenOffset));
    const lengths = pipe(
      rows,
      A.map((row) => row.length),
      A.sort(Order.Number)
    );
    const extremes =
      A.length(lengths) === 0
        ? ""
        : `\nShortest strokes: ${Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(A.take(lengths, 5)), identity)}; longest: ${Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(A.takeRight(lengths, 3)), identity)}.\n`;
    return A.join(
      [
        `\n## FIG ${figure.figure} (${figure.view}) — ${A.length(rows)} shading strokes; coverage ${figure.coverage}\n`,
        "Strokes grouped by direction (angle from the page x axis), with the perpendicular offset of each line (mm, same family = parallel lines; consecutive offsets give the gaps), length (mm), and endpoints (mm from the page's top-left):\n",
        "| angle | offset | length | x1 | y1 | x2 | y2 |",
        "| --- | --- | --- | --- | --- | --- | --- |",
        ...A.map(rows, (r) => `| ${r.angle} | ${r.offset} | ${r.length} | ${r.x1} | ${r.y1} | ${r.x2} | ${r.y2} |`),
        extremes,
      ],
      "\n"
    );
  });
  return A.join(
    [
      `# RENDER.md — measurements of "${input.title}"\n`,
      `sheet-set sha256 ${input.sheetSetSha256}; spec sha256 ${input.specSha256}. Shading strokes are drawn 0.2 mm wide (0.567 pt); visible outlines 0.35 mm (0.992 pt); 72 pt = 25.4 mm. render/MEASUREMENTS.md carries the PDF facts, margins, layers, shading statistics, and labels.\n`,
      ...sections,
    ],
    "\n"
  );
};

// Distance from a point to the infinite line through a stroke.
const distanceToLine = (point: Point, row: StrokeRow): number => {
  const [px, py] = point;
  const [ax, ay] = row.from;
  const [bx, by] = row.to;
  return Math.abs((bx - ax) * (py - ay) - (by - ay) * (px - ax)) / Math.hypot(bx - ax, by - ay);
};

const unitOf = (row: StrokeRow): Point => {
  const dx = row.to[0] - row.from[0];
  const dy = row.to[1] - row.from[1];
  const length = Math.hypot(dx, dy);
  return [dx / length, dy / length];
};

// The gap between two near-parallel strokes where they face each other. Both are projected onto their
// bisector; where their extents overlap, the point of each stroke at the overlap's midpoint is measured to
// the other stroke's line, and the two distances averaged. None when the strokes do not overlap, as two
// pieces of one broken line do not.
const facingGap = (one: StrokeRow, other: StrokeRow): O.Option<number> => {
  const u = unitOf(one);
  const raw = unitOf(other);
  const sign = u[0] * raw[0] + u[1] * raw[1] < 0 ? -1 : 1;
  const sum: Point = [u[0] + sign * raw[0], u[1] + sign * raw[1]];
  const norm = Math.hypot(sum[0], sum[1]);
  const along = (point: Point) => (point[0] * sum[0] + point[1] * sum[1]) / norm;
  const extent = (row: StrokeRow): Point => [
    Math.min(along(row.from), along(row.to)),
    Math.max(along(row.from), along(row.to)),
  ];
  const [lo1, hi1] = extent(one);
  const [lo2, hi2] = extent(other);
  const lo = Math.max(lo1, lo2);
  const hi = Math.min(hi1, hi2);
  if (!(hi - lo > 0)) {
    return O.none();
  }
  const middle = (lo + hi) / 2;
  const pointAt = (row: StrokeRow): Point => {
    const a = along(row.from);
    const s = (middle - a) / (along(row.to) - a);
    return [row.from[0] + s * (row.to[0] - row.from[0]), row.from[1] + s * (row.to[1] - row.from[1])];
  };
  return O.some((distanceToLine(pointAt(one), other) + distanceToLine(pointAt(other), one)) / 2);
};

const byDirection = Order.mapInput(Order.Number, (row: StrokeRow) => row.direction);

// The candidate neighbours of each stroke: the strokes after it in direction order whose directions are
// within PARALLEL_DEG of its own, the strokes near 0° also reached from near 180° (a direction wraps there).
const parallelCandidates = (rows: ReadonlyArray<StrokeRow>): ReadonlyArray<readonly [StrokeRow, StrokeRow]> => {
  const sorted = A.sort(rows, byDirection);
  const wrapped = A.appendAll(
    sorted,
    A.map(
      A.takeWhile(sorted, (row) => row.direction < PARALLEL_DEG),
      (row): StrokeRow => ({ ...row, direction: row.direction + 180 })
    )
  );
  return A.flatMap(sorted, (row, i) =>
    pipe(
      A.drop(wrapped, i + 1),
      A.takeWhile((other) => !(other.direction - row.direction > PARALLEL_DEG)),
      A.map((other): readonly [StrokeRow, StrokeRow] => [row, other])
    )
  );
};

// The smallest perpendicular gap between a stroke and a facing stroke within PARALLEL_DEG of its direction.
const minParallelGap = (rows: ReadonlyArray<StrokeRow>): O.Option<number> =>
  pipe(
    parallelCandidates(rows),
    A.flatMap(([row, other]) =>
      pipe(
        facingGap(row, other),
        O.filter((gap) => gap > SAME_LINE_MM),
        A.fromOption
      )
    ),
    (gaps) => (A.isReadonlyArrayNonEmpty(gaps) ? O.some(round(A.min(gaps, Order.Number), 2)) : O.none())
  );

const median = (sorted: ReadonlyArray<number>): O.Option<number> => {
  const n = A.length(sorted);
  const middle = Math.floor(n / 2);
  return n === 0
    ? O.none()
    : n % 2 === 1
      ? A.get(sorted, middle)
      : O.zipWith(A.get(sorted, middle - 1), A.get(sorted, middle), (a, b) => round((a + b) / 2, 2));
};

const shadingStats = (svg: string): CriticShadingStats => {
  const rows = shadingRows(svg);
  const lengths = pipe(
    rows,
    A.map((row) => row.length),
    A.sort(Order.Number)
  );
  return CriticShadingStats.make({
    count: A.length(rows),
    minLengthMm: A.head(lengths),
    medianLengthMm: median(lengths),
    maxLengthMm: A.last(lengths),
    minParallelGapMm: minParallelGap(rows),
  });
};

// ---------------------------------------------------------------------------
// Path layers
// ---------------------------------------------------------------------------

interface PathChunk {
  readonly letter: string;
  readonly params: ReadonlyArray<number>;
}

interface WalkState {
  // The last curve's second control point, reflected by a following S or T.
  readonly control: O.Option<Point>;
  readonly current: Point;
  readonly previous: string;
  readonly start: Point;
}

interface Drawn {
  readonly length: number;
  readonly points: ReadonlyArray<Point>;
  readonly segments: number;
}

const NOTHING: Drawn = { segments: 0, length: 0, points: [] };

const ARITY: Readonly<Record<string, number>> = { M: 2, L: 2, T: 2, H: 1, V: 1, S: 4, Q: 4, C: 6, A: 7, Z: 0 };

// Every command of path data split into one chunk per coordinate group; the extra pairs after a move are
// lines, as SVG reads them.
const pathChunks = (d: string): ReadonlyArray<PathChunk> =>
  A.flatMap(A.fromIterable(Str.matchAll(/([MLHVCSQTAZmlhvcsqtaz])([^MLHVCSQTAZmlhvcsqtaz]*)/g)(d)), (m) => {
    const letter = m[1] ?? "";
    const arity = ARITY[Str.toUpperCase(letter)] ?? 0;
    const params = numbersIn(m[2] ?? "");
    if (arity === 0) {
      return [{ letter, params: A.empty<number>() }];
    }
    const lineLetter = letter === "m" ? "l" : "L";
    return A.makeBy(Math.floor(A.length(params) / arity), (i) => ({
      letter: i > 0 && Str.toUpperCase(letter) === "M" ? lineLetter : letter,
      params: A.take(A.drop(params, i * arity), arity),
    }));
  });

const distance = ([x1, y1]: Point, [x2, y2]: Point) => Math.hypot(x2 - x1, y2 - y1);

const polylineLength = (points: ReadonlyArray<Point>): number =>
  sumOf(A.map(A.zip(points, A.drop(points, 1)), ([from, to]) => distance(from, to)));

const drawnCurve = (points: ReadonlyArray<Point>): Drawn => ({ segments: 1, length: polylineLength(points), points });

const quadraticPoints = (from: Point, control: Point, to: Point): ReadonlyArray<Point> =>
  A.makeBy(CURVE_STEPS + 1, (i) => {
    const t = i / CURVE_STEPS;
    const u = 1 - t;
    return [
      u * u * from[0] + 2 * u * t * control[0] + t * t * to[0],
      u * u * from[1] + 2 * u * t * control[1] + t * t * to[1],
    ];
  });

const cubicPoints = (from: Point, c1: Point, c2: Point, to: Point): ReadonlyArray<Point> =>
  A.makeBy(CURVE_STEPS + 1, (i) => {
    const t = i / CURVE_STEPS;
    const u = 1 - t;
    return [
      u * u * u * from[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * to[0],
      u * u * u * from[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * to[1],
    ];
  });

// One chunk of path data drawn from the walk's state: the next state and what it inked.
const walkChunk = (state: WalkState, chunk: PathChunk): readonly [WalkState, Drawn] => {
  const upper = Str.toUpperCase(chunk.letter);
  const relative = chunk.letter !== upper;
  const n = (i: number) => chunk.params[i] ?? 0;
  const at = (x: number, y: number): Point => (relative ? [state.current[0] + x, state.current[1] + y] : [x, y]);
  const reflected = (after: ReadonlyArray<string>): Point =>
    A.contains(after, state.previous)
      ? O.match(state.control, {
          onNone: () => state.current,
          onSome: ([cx, cy]) => [2 * state.current[0] - cx, 2 * state.current[1] - cy],
        })
      : state.current;
  const moveTo = (to: Point, control: O.Option<Point>, drawn: Drawn): readonly [WalkState, Drawn] => [
    { current: to, start: state.start, control, previous: upper },
    drawn,
  ];
  const lineTo = (to: Point) => moveTo(to, O.none(), drawnCurve([state.current, to]));
  return Match.value(upper).pipe(
    Match.when("M", (): readonly [WalkState, Drawn] => {
      const to = at(n(0), n(1));
      return [{ current: to, start: to, control: O.none(), previous: upper }, NOTHING];
    }),
    Match.when("L", () => lineTo(at(n(0), n(1)))),
    Match.when("H", () => lineTo([relative ? state.current[0] + n(0) : n(0), state.current[1]])),
    Match.when("V", () => lineTo([state.current[0], relative ? state.current[1] + n(0) : n(0)])),
    Match.when("Q", () => {
      const control = at(n(0), n(1));
      const to = at(n(2), n(3));
      return moveTo(to, O.some(control), drawnCurve(quadraticPoints(state.current, control, to)));
    }),
    Match.when("T", () => {
      const control = reflected(["Q", "T"]);
      const to = at(n(0), n(1));
      return moveTo(to, O.some(control), drawnCurve(quadraticPoints(state.current, control, to)));
    }),
    Match.when("C", () => {
      const c2 = at(n(2), n(3));
      const to = at(n(4), n(5));
      return moveTo(to, O.some(c2), drawnCurve(cubicPoints(state.current, at(n(0), n(1)), c2, to)));
    }),
    Match.when("S", () => {
      const c2 = at(n(0), n(1));
      const to = at(n(2), n(3));
      return moveTo(to, O.some(c2), drawnCurve(cubicPoints(state.current, reflected(["C", "S"]), c2, to)));
    }),
    // An arc is measured along its chord.
    Match.when("A", () => lineTo(at(n(5), n(6)))),
    Match.when("Z", (): readonly [WalkState, Drawn] => [
      { current: state.start, start: state.start, control: O.none(), previous: upper },
      distance(state.current, state.start) > 0 ? drawnCurve([state.current, state.start]) : NOTHING,
    ]),
    Match.orElse((): readonly [WalkState, Drawn] => [state, NOTHING])
  );
};

const walkPath = (d: string): Drawn => {
  const origin: Point = [0, 0];
  const [, drawn] = A.mapAccum(
    pathChunks(d),
    { current: origin, start: origin, control: O.none<Point>(), previous: "" } satisfies WalkState,
    (state, chunk) => walkChunk(state, chunk)
  );
  return {
    segments: sumOf(A.map(drawn, (piece) => piece.segments)),
    length: sumOf(A.map(drawn, (piece) => piece.length)),
    points: A.flatMap(drawn, (piece) => piece.points),
  };
};

interface Extent {
  readonly maxX: number;
  readonly maxY: number;
  readonly minX: number;
  readonly minY: number;
}

// The smallest extent holding both; folded rather than spread so a long path cannot overflow the call stack.
const widen = (extent: Extent, other: Extent): Extent => ({
  minX: Math.min(extent.minX, other.minX),
  minY: Math.min(extent.minY, other.minY),
  maxX: Math.max(extent.maxX, other.maxX),
  maxY: Math.max(extent.maxY, other.maxY),
});

const unionOf = (extents: ReadonlyArray<Extent>): O.Option<Extent> =>
  A.isReadonlyArrayNonEmpty(extents)
    ? O.some(A.reduce(A.tailNonEmpty(extents), A.headNonEmpty(extents), (union, extent) => widen(union, extent)))
    : O.none();

// The ink extent of a path in user units: its drawn points widened by half the stroke width.
const extentOf = (points: ReadonlyArray<Point>, halfWidth: number): O.Option<Extent> =>
  O.map(unionOf(A.map(points, ([x, y]) => ({ minX: x, minY: y, maxX: x, maxY: y }))), (extent) => ({
    minX: extent.minX - halfWidth,
    minY: extent.minY - halfWidth,
    maxX: extent.maxX + halfWidth,
    maxY: extent.maxY + halfWidth,
  }));

interface MeasuredLayer {
  readonly extent: O.Option<Extent>;
  readonly layer: CriticPathLayer;
}

const measureLayer = (tag: string, index: number, unitsPerMm: number): MeasuredLayer => {
  const id = O.getOrElse(O.filter(attr(tag, "id"), Str.isNonEmpty), () => `path-${index + 1}`);
  const stroked = !O.contains(attr(tag, "stroke"), "none") && O.isSome(attr(tag, "stroke"));
  const widthUnits = stroked
    ? O.some(
        pipe(
          attr(tag, "stroke-width"),
          O.map((value) => Number.parseFloat(value)),
          O.filter(Number.isFinite),
          O.getOrElse(() => 1)
        )
      )
    : O.none<number>();
  const dash = pipe(
    attr(tag, "stroke-dasharray"),
    O.filter((value) => Str.trim(value) !== "none"),
    O.map((value) => A.map(numbersIn(value), (units) => round(units / unitsPerMm, 3))),
    O.getOrElse(A.empty<number>)
  );
  const drawn = walkPath(O.getOrElse(attr(tag, "d"), () => ""));
  return {
    layer: CriticPathLayer.make({
      id,
      strokeWidthMm: O.map(widthUnits, (units) => round(units / unitsPerMm, 3)),
      dashArrayMm: dash,
      segments: drawn.segments,
      lengthMm: round(drawn.length / unitsPerMm, 3),
    }),
    extent: extentOf(drawn.points, O.getOrElse(widthUnits, () => 0) / 2),
  };
};

const clearance = (distanceMm: number, minimumMm: number) =>
  CriticEdgeClearance.make({
    distanceMm: round(distanceMm, 3),
    minimumMm,
    meets: distanceMm + 1e-9 >= minimumMm,
  });

const inkBox = (extent: Extent, scale: SheetScale): CriticInkBox => {
  const minX = extent.minX / scale.unitsPerMm;
  const minY = extent.minY / scale.unitsPerMm;
  const maxX = extent.maxX / scale.unitsPerMm;
  const maxY = extent.maxY / scale.unitsPerMm;
  return CriticInkBox.make({
    minXMm: round(minX, 3),
    minYMm: round(minY, 3),
    maxXMm: round(maxX, 3),
    maxYMm: round(maxY, 3),
    widthMm: round(maxX - minX, 3),
    heightMm: round(maxY - minY, 3),
    top: clearance(minY, MARGINS_CM.top * 10),
    left: clearance(minX, MARGINS_CM.left * 10),
    right: clearance(scale.widthMm - maxX, MARGINS_CM.right * 10),
    bottom: clearance(scale.heightMm - maxY, MARGINS_CM.bottom * 10),
  });
};

const textLabels = (svg: string, unitsPerMm: number): ReadonlyArray<CriticTextLabel> =>
  A.map(A.fromIterable(Str.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)(svg)), (m) => {
    const tag = ` ${m[1] ?? ""}`;
    const first = (name: string) =>
      pipe(
        attr(tag, name),
        O.flatMap((value) => A.head(numbersIn(value))),
        O.getOrElse(() => 0)
      );
    const sizePt = pipe(
      attr(tag, "font-size"),
      O.flatMap((value) =>
        Str.endsWith(value, "pt") || Str.endsWith(value, "mm") || Str.endsWith(value, "in")
          ? lengthPt(value)
          : O.map(A.head(numbersIn(value)), (units) => (units / unitsPerMm) * PT_PER_MM)
      ),
      O.getOrElse(() => 0)
    );
    return CriticTextLabel.make({
      text: unescapeXml(Str.replaceAll(/<[^>]*>/g, "")(m[2] ?? "")),
      fontFamily: unescapeXml(O.getOrElse(attr(tag, "font-family"), () => "")),
      sizePt: round(sizePt, 3),
      xMm: round(first("x") / unitsPerMm, 3),
      yMm: round(first("y") / unitsPerMm, 3),
      anchor: O.getOrElse(attr(tag, "text-anchor"), () => "start"),
    });
  });

/**
 * Measure one figure SVG: the sheet size, the ink box of the view and of
 * every path against the 37 CFR 1.84(g) margins, each path layer, the
 * shading strokes, and the text labels.
 *
 * **Details**
 *
 * The `drawing` box covers every path but `labels` and `label-outlines`; the
 * `ink` box covers every path. Stroked paths are widened by half their
 * stroke width. The shading layer is the path with id `shading` (or, in an
 * older sheet, the first path drawn at 0.567 pt).
 *
 * **Gotchas**
 *
 * An SVG without a `viewBox` is read in the sheets' own convention, one user
 * unit per point. `<text>` glyph extents depend on the font, so text labels
 * are listed by anchor and size but are not in either box.
 *
 * **Example** (One 100 mm line on a Letter sheet)
 *
 * ```ts
 * import { figureMeasurements } from "@beep/repo-cli/commands/Drawings"
 *
 * const svg = '<svg width="612pt" height="792pt" viewBox="0 0 612 792"><path id="figure" d="M85.039 85.039L368.504 85.039" stroke="#000000" stroke-width="0.992"/></svg>'
 * const figure = figureMeasurements({ figure: 1, view: "front", svgFile: "render/fig-1.svg", svg })
 * console.log(figure.layers[0]?.lengthMm) // 100
 * ```
 *
 * @param input - The figure number, its view, the SVG's pack path, and the SVG text.
 * @returns The figure's sheet size, ink and drawing boxes, path layers, shading statistics, and labels.
 * @category utilities
 * @since 0.0.0
 */
export const figureMeasurements = (input: {
  readonly figure: number;
  readonly view: string;
  readonly svgFile: string;
  readonly svg: string;
}): CriticFigureMeasurements => {
  const scale = sheetScale(input.svg);
  const measured = A.map(pathTags(input.svg), (tag, index) => measureLayer(tag, index, scale.unitsPerMm));
  const boxOf = (layers: ReadonlyArray<MeasuredLayer>) =>
    O.map(unionOf(A.getSomes(A.map(layers, (layer) => layer.extent))), (extent) => inkBox(extent, scale));
  return CriticFigureMeasurements.make({
    figure: input.figure,
    view: input.view,
    svg: input.svgFile,
    sheetWidthMm: round(scale.widthMm, 3),
    sheetHeightMm: round(scale.heightMm, 3),
    drawing: boxOf(A.filter(measured, (layer) => !HashSet.has(LABEL_LAYERS, layer.layer.id))),
    ink: boxOf(measured),
    layers: A.map(measured, (layer) => layer.layer),
    shading: shadingStats(input.svg),
    labels: textLabels(input.svg, scale.unitsPerMm),
  });
};

// ---------------------------------------------------------------------------
// PDF tool output
// ---------------------------------------------------------------------------

const pdfBox = ([left, bottom, right, top]: readonly [number, number, number, number]): CriticPdfBox =>
  CriticPdfBox.make({
    leftPt: left,
    bottomPt: bottom,
    rightPt: right,
    topPt: top,
    widthPt: round(Math.abs(right - left), 3),
    heightPt: round(Math.abs(top - bottom), 3),
    widthMm: round(Math.abs(right - left) / PT_PER_MM, 3),
    heightMm: round(Math.abs(top - bottom) / PT_PER_MM, 3),
  });

/**
 * Read the MediaBox and CropBox of every page from what
 * `pdfinfo -box -f 1 -l <pages>` prints.
 *
 * **Details**
 *
 * A page that lists no CropBox gets its MediaBox, as the PDF format defines;
 * a page that lists no MediaBox is left out. Pages come back in page order.
 *
 * **Example** (One Letter page)
 *
 * ```ts
 * import { parsePdfInfoBoxes } from "@beep/repo-cli/commands/Drawings"
 *
 * const text = "Page    1 MediaBox:      0.00     0.00   612.00   792.00\nPage    1 CropBox:       0.00     0.00   612.00   792.00\n"
 * console.log(parsePdfInfoBoxes(text)[0]?.cropBox.heightMm) // 279.4
 * ```
 *
 * @param text - What `pdfinfo -box` printed.
 * @returns Every page's MediaBox and CropBox, in page order.
 * @category parsing
 * @since 0.0.0
 */
export const parsePdfInfoBoxes = (text: string): ReadonlyArray<CriticPdfPage> => {
  const lines = A.fromIterable(
    Str.matchAll(/^Page\s+(\d+)\s+(MediaBox|CropBox):\s+([-+\d.]+)\s+([-+\d.]+)\s+([-+\d.]+)\s+([-+\d.]+)\s*$/gm)(text)
  );
  const boxOf = (page: string, kind: string) =>
    pipe(
      A.findFirst(lines, (m) => m[1] === page && m[2] === kind),
      O.map((m) => pdfBox([Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])]))
    );
  return pipe(
    A.dedupe(A.map(lines, (m) => m[1] ?? "")),
    A.map((page) => Number(page)),
    A.sort(Order.Number),
    A.map((page) =>
      O.map(boxOf(`${page}`, "MediaBox"), (mediaBox) =>
        CriticPdfPage.make({ page, mediaBox, cropBox: O.getOrElse(boxOf(`${page}`, "CropBox"), () => mediaBox) })
      )
    ),
    A.getSomes
  );
};

/**
 * Read the fonts from what `pdffonts` prints: name, type, and the embedded
 * and subset flags of every row under the dashed header rule.
 *
 * **Details**
 *
 * Rows are read from the right (`emb sub uni object generation`), so a name
 * wider than its column or a type with a space in it (`CID TrueType`,
 * `Type 1C`) still parses.
 *
 * **Example** (One embedded subset font)
 *
 * ```ts
 * import { parsePdfFonts } from "@beep/repo-cli/commands/Drawings"
 *
 * const text = [
 *   "name                                 type              encoding         emb sub uni object ID",
 *   "------------------------------------ ----------------- ---------------- --- --- --- ---------",
 *   "KKISDR+DejaVuSans                    CID TrueType      Identity-H       yes yes yes      7  0",
 * ].join("\n")
 * console.log(parsePdfFonts(text)[0]?.type) // "CID TrueType"
 * ```
 *
 * @param text - What `pdffonts` printed.
 * @returns One row per font, in the order listed.
 * @category parsing
 * @since 0.0.0
 */
export const parsePdfFonts = (text: string): ReadonlyArray<CriticPdfFont> =>
  pipe(
    Str.split(text, "\n"),
    A.dropWhile((line) => !Str.startsWith(Str.trim(line), "---")),
    A.drop(1),
    A.map((line) => {
      const tokens = A.filter(Str.split(Str.trim(line), /\s+/), Str.isNonEmpty);
      const count = A.length(tokens);
      const flag = (index: number) => O.contains(A.get(tokens, index), "yes");
      return count < 8
        ? O.none()
        : O.map(O.filter(A.head(tokens), Str.isNonEmpty), (name) =>
            CriticPdfFont.make({
              name,
              type: A.join(A.take(A.drop(tokens, 1), count - 7), " "),
              embedded: flag(count - 5),
              subset: flag(count - 4),
            })
          );
    }),
    A.getSomes
  );

// ---------------------------------------------------------------------------
// MEASUREMENTS.md
// ---------------------------------------------------------------------------

const yesNo = (value: boolean) => (value ? "yes" : "no");
const orDash = (value: O.Option<number>) => O.getOrElse(O.map(value, String), () => "—");
const boxCorners = (box: CriticPdfPage["mediaBox"]) => `${box.leftPt} ${box.bottomPt} ${box.rightPt} ${box.topPt}`;
const boxSize = (box: CriticPdfPage["mediaBox"]) => `${box.widthMm} × ${box.heightMm}`;

const boxLines = (name: string, box: O.Option<CriticInkBox>): ReadonlyArray<string> =>
  O.match(box, {
    onNone: () => [`${name}: nothing drawn.`, ""],
    onSome: (b) => [
      `${name}: x ${b.minXMm}–${b.maxXMm} mm, y ${b.minYMm}–${b.maxYMm} mm (${b.widthMm} × ${b.heightMm} mm).`,
      "",
      "| edge | distance (mm) | 37 CFR 1.84(g) minimum (mm) | meets |",
      "| --- | --- | --- | --- |",
      ...A.map(
        [
          ["top", b.top],
          ["left", b.left],
          ["right", b.right],
          ["bottom", b.bottom],
        ] as const,
        ([edge, c]) => `| ${edge} | ${c.distanceMm} | ${c.minimumMm} | ${yesNo(c.meets)} |`
      ),
      "",
    ],
  });

const figureSection = (figure: CriticFigureMeasurements): ReadonlyArray<string> => [
  `## FIG ${figure.figure} (${figure.view}) — ${figure.svg}`,
  "",
  `Sheet ${figure.sheetWidthMm} × ${figure.sheetHeightMm} mm.`,
  "",
  ...boxLines("Drawing box (the view; label layers excluded)", figure.drawing),
  ...boxLines("Ink box (every path, labels included)", figure.ink),
  "Path layers, in drawing order:",
  "",
  "| id | stroke width (mm) | dash array (mm) | segments | length (mm) |",
  "| --- | --- | --- | --- | --- |",
  ...A.map(
    figure.layers,
    (layer) =>
      `| ${layer.id} | ${orDash(layer.strokeWidthMm)} | ${A.isReadonlyArrayEmpty(layer.dashArrayMm) ? "solid" : A.join(A.map(layer.dashArrayMm, String), " ")} | ${layer.segments} | ${layer.lengthMm} |`
  ),
  "",
  figure.shading.count === 0
    ? "Shading strokes: none."
    : `Shading strokes: ${figure.shading.count}; length min ${orDash(figure.shading.minLengthMm)} / median ${orDash(figure.shading.medianLengthMm)} / max ${orDash(figure.shading.maxLengthMm)} mm; smallest gap between parallel neighbours (directions within 2.5°) ${orDash(figure.shading.minParallelGapMm)} mm.`,
  "",
  ...(A.isReadonlyArrayEmpty(figure.labels)
    ? ["Text labels: none (labels drawn as strokes or outlines are the labels / label-outlines layers)."]
    : [
        "Text labels (anchor position; glyph extents are not measured):",
        "",
        "| text | font family | size (pt) | x (mm) | y (mm) | anchor |",
        "| --- | --- | --- | --- | --- | --- |",
        ...A.map(
          figure.labels,
          (label) =>
            `| ${label.text} | ${label.fontFamily} | ${label.sizePt} | ${label.xMm} | ${label.yMm} | ${label.anchor} |`
        ),
      ]),
  "",
];

/**
 * Render measurements as `render/MEASUREMENTS.md`, the file a read-only
 * reviewer reads instead of running `pdfinfo`, `pdffonts`, or a ruler.
 *
 * **Example** (A set with no figures)
 *
 * ```ts
 * import { CriticMeasurements, CriticPdfMeasurements, measurementsMarkdown } from "@beep/repo-cli/commands/Drawings"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const markdown = measurementsMarkdown(
 *   CriticMeasurements.make({
 *     schemaVersion: "drawing-critic-measurements/v1",
 *     title: "Bracket",
 *     sheetSetSha256: Sha256Hex.make("a".repeat(64)),
 *     specSha256: Sha256Hex.make("b".repeat(64)),
 *     pdf: CriticPdfMeasurements.make({ file: "render/sheets.pdf", version: "1.6", pageCount: 0, pages: [], fonts: [], undecodableStreams: [], streamCheck: "complete" }),
 *     figures: [],
 *   })
 * )
 * console.log(markdown.includes("PDF version: 1.6")) // true
 * ```
 *
 * @param measurements - The PDF facts and per-figure measurements of a pack.
 * @returns The markdown of `render/MEASUREMENTS.md`.
 * @category formatting
 * @since 0.0.0
 */
export const measurementsMarkdown = (measurements: CriticMeasurements): string => {
  const { pdf } = measurements;
  const streams = A.isReadonlyArrayEmpty(pdf.undecodableStreams)
    ? [
        pdf.containerDiscovery === "complete" && pdf.streamCheck === "complete"
          ? "Undecodable streams: none."
          : "Undecodable streams: none among inspected streams; global stream inspection is incomplete.",
      ]
    : [
        "Undecodable streams (a strict reader refuses these; a PDF-structure defect):",
        "",
        ...A.map(pdf.undecodableStreams, (s) => `- object ${s.objectNumber} ${s.generation} R: ${s.reason}`),
      ];
  const fonts = A.isReadonlyArrayEmpty(pdf.fonts)
    ? ["Fonts: none."]
    : [
        "Fonts:",
        "",
        "| name | type | embedded | subset |",
        "| --- | --- | --- | --- |",
        ...A.map(pdf.fonts, (f) => `| ${f.name} | ${f.type} | ${yesNo(f.embedded)} | ${yesNo(f.subset)} |`),
      ];
  return A.join(
    [
      `# MEASUREMENTS.md — measured facts of "${measurements.title}"`,
      "",
      `sheet-set sha256 ${measurements.sheetSetSha256}; spec sha256 ${measurements.specSha256}.`,
      "",
      "The harness measured these from render/sheets.pdf and render/fig-N.svg (the same numbers are in render/measurements.json). Cite them instead of running pdfinfo, pdffonts, or a ruler. Lengths are in mm (72 pt = 25.4 mm); sheet positions are measured from the page's top-left corner. Stroked paths are widened by half their stroke width in the ink boxes.",
      "",
      `## PDF (${pdf.file})`,
      "",
      `PDF version: ${pdf.version}; pages: ${pdf.pageCount}; FlateDecode stream check: ${pdf.streamCheck}.`,
      `PDF container discovery: ${pdf.containerDiscovery}.`,
      "",
      ...streams,
      "",
      "| page | MediaBox (pt) | MediaBox (mm) | CropBox (pt) | CropBox (mm) |",
      "| --- | --- | --- | --- | --- |",
      ...A.map(
        pdf.pages,
        (p) =>
          `| ${p.page} | ${boxCorners(p.mediaBox)} | ${boxSize(p.mediaBox)} | ${boxCorners(p.cropBox)} | ${boxSize(p.cropBox)} |`
      ),
      "",
      ...fonts,
      "",
      ...A.flatMap(measurements.figures, figureSection),
    ],
    "\n"
  );
};
