import {
  closeOutlineGaps,
  OUTLINE_COINCIDENCE_MM,
  outlineSpacingFindings,
  Segment2,
  separateCloseOutlines,
  ValidationOptions,
} from "@beep/technical-drawing";
import { O } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";

const defaultMinSpacingSheetMm = 0.7;
const defaultMinOverlapSheetMm = 1;

const separate = (
  segments: ReadonlyArray<Segment2>,
  emphasis: ReadonlyArray<Segment2> = [],
  broken: ReadonlyArray<Segment2> = []
) =>
  separateCloseOutlines({
    segments,
    broken,
    emphasis,
    minSpacing: defaultMinSpacingSheetMm,
    minOverlap: defaultMinOverlapSheetMm,
    coincidence: OUTLINE_COINCIDENCE_MM,
  });

const gaps = (segments: ReadonlyArray<Segment2>, minSpacing = defaultMinSpacingSheetMm) =>
  closeOutlineGaps({ segments, minSpacing, minOverlap: defaultMinOverlapSheetMm, coincidence: OUTLINE_COINCIDENCE_MM });

const distanceToLineThrough = ([x, y]: readonly [number, number], [x1, y1, x2, y2]: Segment2): number =>
  Math.abs((x - x1) * (y2 - y1) - (y - y1) * (x2 - x1)) / Math.hypot(x2 - x1, y2 - y1);

const round = (segment: Segment2): ReadonlyArray<number> => A.map(segment, (v) => Math.round(v * 1e9) / 1e9 + 0);

describe("separateCloseOutlines", () => {
  it("leaves degenerate points intact while separating the surrounding drawn outlines", () => {
    const point: Segment2 = [10, 0.34, 10, 0.34];
    const result = separate([[0, 0, 100, 0], [0, 0.34, 90, 0.34], point]);
    expect(result.segments[2]).toEqual(point);
    expect(gaps(result.segments)).toEqual([]);
    expect(result.moves).toHaveLength(1);
  });

  it("returns an unchanged drawing when transitive coincidence leaves no distinct line to move", () => {
    const input: ReadonlyArray<Segment2> = [
      [0, 0, 10, 0],
      [0, 0.12, 10, 0.12],
      [0, 0.24, 10, 0.24],
    ];
    const result = separate(input);
    expect(result.segments).toBe(input);
    expect(result.moves).toEqual([]);
    expect(gaps(result.segments)).toEqual(gaps(input));
  });

  it("separates near-vertical outlines across the angle ordering boundary", () => {
    const input: ReadonlyArray<Segment2> = [
      [0, 0, 0.01, 10],
      [0.34, 0, 0.33, 10],
    ];
    expect(gaps(input)).toHaveLength(1);
    const result = separate(input);
    expect(gaps(result.segments)).toEqual([]);
    expect(result.moves).toHaveLength(1);
    expect(A.length(result.segments)).toBe(2);
    A.forEach(result.segments, (segment, index) => {
      const original = A.getUnsafe(input, index);
      expect(segment[2] - segment[0]).toBeCloseTo(original[2] - original[0], 9);
      expect(segment[3] - segment[1]).toBeCloseTo(original[3] - original[1], 9);
    });
  });

  it("opens a board edge drawn 0.34 apart to 0.7, keeping both lines, its break, its T-end and its connector", () => {
    const longOutline: Segment2 = [0, 0, 100, 0];
    const slottedLeft: Segment2 = [5, 0.34, 40, 0.34];
    const slottedRight: Segment2 = [43, 0.34, 95, 0.34];
    const partialDuplicate: Segment2 = [20, 0.34, 30, 0.34];
    const tee: Segment2 = [50, 0.34, 50, 20];
    const connectorFromBreak: Segment2 = [40, 0.34, 41.7, 0];
    const input = [longOutline, slottedLeft, slottedRight, partialDuplicate, tee, connectorFromBreak];
    const result = separate(input);
    const [outA, outB1, outB2, outDuplicate, outTee, outConnector] = A.map(result.segments, round);
    expect(result.segments[0], "the longer line stays put").toBe(longOutline);
    expect(outA).toEqual([0, 0, 100, 0]);
    expect(outB1, "the slotted line, its duplicate and every end on it move to 0.7").toEqual([5, 0.7, 40, 0.7]);
    expect(outB2).toEqual([43, 0.7, 95, 0.7]);
    expect(outDuplicate).toEqual([20, 0.7, 30, 0.7]);
    expect(outTee).toEqual([50, 0.7, 50, 20]);
    expect(outConnector).toEqual([40, 0.7, 41.7, 0]);
    expect((outB2?.[0] ?? 0) - (outB1?.[2] ?? 0), "the crossing gap keeps its width").toBeCloseTo(3, 9);
    expect(
      A.map(result.moves, (move) => Math.round(move * 1e9) / 1e9),
      "one line moved, by the shortfall"
    ).toEqual([0.36]);
    expect(gaps(result.segments)).toEqual([]);
    expect(
      Math.min(...A.map(A.drop(result.segments, 1), (s) => distanceToLineThrough([s[0], s[1]], longOutline))),
      "nothing runs closer than 0.7 to the long outline"
    ).toBeGreaterThanOrEqual(0.7 - 1e-9);
    expect(
      A.dedupe(A.map(gaps(input), (gap) => Math.round(gap * 1e9) / 1e9)),
      "before, the pairs were 0.34 apart"
    ).toEqual([0.34]);
  });

  it("shifts a converging pair uniformly until its closer end stands 0.7 apart", () => {
    const input: ReadonlyArray<Segment2> = [
      [0, 0, 100, 0],
      [0, 0.5, 100, 0.62],
    ];
    const result = separate(input);
    expect(
      A.length(result.moves),
      "the converging line is a hair longer, so the level one moves, once, by the shortfall at the closer end"
    ).toBe(1);
    expect(result.segments[1]).toBe(input[1]);
    const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = result.segments[0] ?? [];
    expect(x1 - 0, "a shift, not a turn: both ends moved alike").toBeCloseTo(x2 - 100, 12);
    expect(y1 - 0).toBeCloseTo(y2 - 0, 12);
    expect(gaps(result.segments)).toEqual([]);
    const [closest = 0] = gaps(result.segments, 0.71);
    expect(
      closest,
      "measured as the validator measures, the pair stands 0.7 apart at its closer end and nowhere closer"
    ).toBeCloseTo(0.7, 9);
    expect(Math.min(...gaps(input))).toBeCloseTo(0.5, 6);
  });

  it("opens a run of three lines 0.6 apart outward from the longest", () => {
    const result = separate([
      [0, 0, 100, 0],
      [0, 0.6, 90, 0.6],
      [0, 1.2, 80, 1.2],
    ]);
    expect(A.map(result.segments, round)).toEqual([
      [0, 0, 100, 0],
      [0, 0.7, 90, 0.7],
      [0, 1.4, 80, 1.4],
    ]);
    expect(A.map(result.moves, (move) => Math.round(move * 1e9) / 1e9)).toEqual([0.1, 0.2]);
  });

  it("slides a vertex along the steep line it meets, and keeps an emphasised outline in place", () => {
    const corner = separate([
      [0, 0, 100, 0],
      [10, 0.4, 90, 0.4],
      [10, 0.4, 60, 30],
    ]);
    const slope = 29.6 / 50;
    expect(
      A.map(corner.segments, round),
      "the short line's left end is a corner on an unmoved line rising at about 31°: the corner slides up that line"
    ).toEqual([[0, 0, 100, 0], round([10 + 0.3 / slope, 0.7, 90, 0.7]), round([10 + 0.3 / slope, 0.7, 60, 30])]);
    const pinned = separate(
      [
        [0, 0, 60, 0],
        [0, 0.34, 100, 0.34],
      ],
      [[0, 0.002, 60, 0.002]]
    );
    expect(
      A.map(pinned.segments, round),
      "an emphasis line drawn over the shorter outline pins it: the longer one moves instead"
    ).toEqual([
      [0, 0, 60, 0],
      [0, 0.702, 100, 0.702],
    ]);
  });

  it("keeps an unmoved line on its own line where its ends meet moved lines, so it closes no pair again", () => {
    // decision: outline-separation-keeps-unmoved-lines-in-place
    const obliqueAngle = (22 * Math.PI) / 180;
    const [c, s] = [Math.cos(obliqueAngle), Math.sin(obliqueAngle)];
    const leftOblique: Segment2 = [33 - 40 * c, -40 * s, 33, 0];
    const leftPartner: Segment2 = [33 - 50 * c + 0.5 * s, -50 * s - 0.5 * c, 33 - 2 * c + 0.5 * s, -2 * s - 0.5 * c];
    const rightOblique: Segment2 = [67, 0, 67 + 40 * c, -40 * s];
    const rightPartner: Segment2 = [67 + 2 * c - 0.5 * s, -2 * s - 0.5 * c, 67 + 50 * c - 0.5 * s, -50 * s - 0.5 * c];
    const anchorPieces: ReadonlyArray<Segment2> = [
      [0, 0, 30, 0],
      [33, 0, 67, 0],
      [70, 0, 100, 0],
    ];
    const input: ReadonlyArray<Segment2> = [
      ...anchorPieces,
      [5, 0.34, 95, 0.34],
      leftOblique,
      leftPartner,
      rightOblique,
      rightPartner,
    ];
    const result = separate(input);
    const at = (i: number) => A.getUnsafe(result.segments, i);
    A.forEach([0, 1, 2], (i) => {
      expect(
        Math.abs(at(i)[1]),
        "every piece of the anchor stays on y = 0, so the anchor stays one straight line"
      ).toBeLessThan(1e-9);
      expect(Math.abs(at(i)[3])).toBeLessThan(1e-9);
    });
    expect(
      Math.abs(at(1)[0] - at(4)[2]) + Math.abs(at(1)[1] - at(4)[3]),
      "the centre piece's ends slid along it to where the moved obliques now meet it, and the obliques end there"
    ).toBeLessThan(1e-9);
    expect(Math.abs(at(1)[2] - at(6)[0]) + Math.abs(at(1)[3] - at(6)[1])).toBeLessThan(1e-9);
    expect(gaps(result.segments), "nothing runs closer than 0.7 any more").toEqual([]);
    expect(
      A.length(result.moves),
      "the line 0.34 above the anchor and both 22° obliques, each 0.5 from a longer partner, move"
    ).toBe(3);
  });

  it("keeps a vertical vertical and a break its width where a moved line and a moved oblique meet on it", () => {
    // decision: outline-separation-keeps-unmoved-lines-in-place
    const obliqueAngle = (20 * Math.PI) / 180;
    const [c, s] = [Math.cos(obliqueAngle), Math.sin(obliqueAngle)];
    const input: ReadonlyArray<Segment2> = [
      [0, 0, 100, 0],
      [5, 0.34, 40, 0.34],
      [43, 0.34, 95, 0.34],
      [40, 0.34, 40, 20],
      [43, 0.34, 43, 20],
      [40 - 30 * c, 0.34 + 30 * s, 40, 0.34],
      [40 - 45 * c - 0.4 * s, 0.34 + 45 * s - 0.4 * c, 40 - 3 * c - 0.4 * s, 0.34 + 3 * s - 0.4 * c],
    ];
    const result = separate(input);
    const at = (i: number) => A.getUnsafe(result.segments, i);
    expect(
      [at(3)[0], at(3)[2], at(4)[0], at(4)[2]],
      "both unmoved verticals at the crossing gap's edges keep their x at both ends"
    ).toEqual([40, 40, 43, 43]);
    expect([at(3)[1], at(4)[1]], "both verticals stand on the moved slotted line").toEqual([at(1)[3], at(2)[1]]);
    expect(at(1)[1], "the slotted line moved whole, so its pieces stay collinear").toBeCloseTo(0.7, 12);
    expect(at(2)[1]).toBeCloseTo(0.7, 12);
    expect(at(2)[0] - at(1)[2], "the break keeps its 3 units").toBeGreaterThanOrEqual(3 - 1e-9);
    const direction = ([x1, y1, x2, y2]: Segment2) => Math.atan2(y2 - y1, x2 - x1);
    expect(direction(at(5)), "the oblique keeps its direction, re-ended on the vertical it ran to").toBeCloseTo(
      direction(A.getUnsafe(input, 5)),
      12
    );
    expect(at(5)[2]).toBeCloseTo(40, 12);
    expect(
      gaps(result.segments),
      "the slotted line and the 20° oblique, 0.4 from its longer partner, both open to 0.7"
    ).toEqual([]);
  });

  it("moves a line away from a settled neighbour it would crowd, even when it is the longer line", () => {
    const result = separate([
      [0, 0, 100, 0],
      [5, 0.4, 95, 0.4],
      [-10, 1.3, 110, 1.3],
      [8, 1.7, 93, 1.7],
    ]);
    expect(
      A.map(result.segments, round),
      "two edge pairs 0.9 apart: the upper pair opens first with its 120 line staying, and the lower pair's shorter " +
        "line moving up would sit 0.6 under it, so the lower pair's longer line moves down"
    ).toEqual([
      [0, -0.3, 100, -0.3],
      [5, 0.4, 95, 0.4],
      [-10, 1.3, 110, 1.3],
      [8, 2, 93, 2],
    ]);
    expect(gaps(result.segments)).toEqual([]);
  });

  it("re-ends an emphasis line with the outline it is drawn over", () => {
    const stem: Segment2 = [50, 0.34, 50, 20];
    const result = separate([[0, 0, 100, 0], [5, 0.34, 95, 0.34], stem], [stem]);
    expect(A.map(result.segments, round)).toEqual([
      [0, 0, 100, 0],
      [5, 0.7, 95, 0.7],
      [50, 0.7, 50, 20],
    ]);
    expect(
      A.map(result.emphasis, round),
      "the T-end's emphasis is re-ended on the moved line, never running past it into the gap between the pair"
    ).toEqual([[50, 0.7, 50, 20]]);
  });

  it("opens pairs of broken lines and of emphasised outlines, which no other line can make room for", () => {
    const brokenPair: ReadonlyArray<Segment2> = [
      [0, 0, 100, 0],
      [0, 0.4, 90, 0.4],
    ];
    const broken = separate([], [], brokenPair);
    expect(A.map(broken.broken, round), "two broken (unclaimed) board edges 0.4 apart move like outlines").toEqual([
      [0, 0, 100, 0],
      [0, 0.7, 90, 0.7],
    ]);
    expect(gaps(broken.broken)).toEqual([]);
    const outlines: ReadonlyArray<Segment2> = [
      [0, 0, 100, 0],
      [0, 0.4, 90, 0.4],
    ];
    const emphasised = separate(outlines, outlines);
    expect(
      A.map(emphasised.segments, round),
      "two emphasised outlines 0.4 apart: with nothing else to move, the shorter moves, its emphasis with it"
    ).toEqual([
      [0, 0, 100, 0],
      [0, 0.7, 90, 0.7],
    ]);
    expect(A.map(emphasised.emphasis, round)).toEqual(A.map(emphasised.segments, round));
    expect(gaps([...emphasised.segments, ...emphasised.emphasis])).toEqual([]);
  });

  it("moves only the collinear edge a close line runs beside, never a distant edge level with it", () => {
    // decision: outline-separation-groups-lines-by-connection
    const firstTop: Segment2 = [0, 0, 30, 0];
    const secondTop: Segment2 = [60, 0, 90, 0];
    const result = separate([firstTop, secondTop, [-50, 0.34, 35, 0.34]]);
    expect(
      A.map(result.segments, round),
      "the long line 0.34 above the first top only stays, so the first top moves down"
    ).toEqual([
      [0, -0.36, 30, -0.36],
      [60, 0, 90, 0],
      [-50, 0.34, 35, 0.34],
    ]);
    expect(result.segments[1], "the second top, 30 along, has no close neighbour and stays").toBe(secondTop);
    expect(A.map(result.moves, (move) => Math.round(move * 1e9) / 1e9)).toEqual([0.36]);
    expect(gaps(result.segments)).toEqual([]);
    const boxes = separate([
      firstTop,
      [0, 0, 0, -10],
      [30, 0, 30, -10],
      secondTop,
      [60, 0, 60, -10],
      [90, 0, 90, -10],
      [-50, 0.34, 35, 0.34],
    ]);
    expect(
      A.map(boxes.segments, round)[0],
      "the same tops meeting their own sides at their corners are still two lines"
    ).toEqual([0, -0.36, 30, -0.36]);
    expect(boxes.segments[3]).toBe(secondTop);
  });

  it("moves the pieces of an edge seen either side of a wide part in front together", () => {
    // decision: outline-separation-groups-lines-by-connection
    const result = separate([
      [0, 0, 40, 0],
      [52, 0, 100, 0],
      [2, 0.34, 40, 0.34],
      [52, 0.34, 102, 0.34],
      [0, 0, 2, 0.34],
      [100, 0, 102, 0.34],
      [40, -8, 40, 8],
      [52, -8, 52, 8],
    ]);
    const [nearLeft, nearRight, farLeft, farRight] = A.map(A.take(result.segments, 4), round);
    expect(
      [nearLeft?.[1], nearLeft?.[3]],
      "edges 0.34 apart sheared 2 along behind a post 12 wide: the shear makes the shorter piece the far edge on the " +
        "left and the near edge on the right, yet each edge's two pieces move together"
    ).toEqual([nearRight?.[1], nearRight?.[3]]);
    expect([farLeft?.[1], farLeft?.[3]]).toEqual([farRight?.[1], farRight?.[3]]);
    expect(A.map(result.moves, (move) => Math.round(move * 1e9) / 1e9)).toEqual([0.36]);
    expect(gaps(result.segments)).toEqual([]);
  });

  it("re-ends a T-end the kernel rounded off its oblique line on a drawing enlarged ten times", () => {
    const a: Segment2 = [0, 0, 8.66, 5];
    const b: Segment2 = [0.416, 0.279, 8.21, 4.779];
    const stem: Segment2 = [1.757, 1.054, 1.41, 3.024];
    const tenSheetMmPerUnitTolerances = {
      minSpacing: 0.07,
      minOverlap: 0.1,
      coincidence: OUTLINE_COINCIDENCE_MM / 10,
    };
    const kernelQuantum = 0.001;
    expect(
      distanceToLineThrough([stem[0], stem[1]], b),
      "the stem's foot, rounded to three decimals as the kernel rounds, sits 0.00065 off the shorter line: beyond " +
        "the bare join tolerance (0.15 mm x 0.02 = 0.0003 units)"
    ).toBeGreaterThan(tenSheetMmPerUnitTolerances.coincidence * 0.02);
    const result = separateCloseOutlines({
      segments: [a, b, stem],
      quantum: kernelQuantum,
      ...tenSheetMmPerUnitTolerances,
    });
    const [, movedB = b, movedStem = stem] = result.segments;
    expect(
      A.map(result.moves, (move) => Math.round(move * 1e4) / 1e4),
      "the shorter line of the pair 0.034 apart moved 0.0364 off its partner"
    ).toEqual([0.0364]);
    expect(
      distanceToLineThrough([movedStem[0], movedStem[1]], movedB),
      "the stem's foot followed the moved line"
    ).toBeLessThan(1e-9);
    expect(distanceToLineThrough([movedStem[0], movedStem[1]], stem), "along the stem").toBeLessThan(1e-9);
    expect([movedStem[2], movedStem[3]]).toEqual([stem[2], stem[3]]);
    expect(closeOutlineGaps({ segments: result.segments, ...tenSheetMmPerUnitTolerances })).toEqual([]);
  });

  it("keeps collinear pieces apart where only a degenerate point stands at their facing ends", () => {
    // decision: outline-separation-groups-lines-by-connection
    const lower: Segment2 = [0, 0, 0, 30];
    const upperDrawnDownward: Segment2 = [0, 90, 0, 60];
    const besideLowerOnly: Segment2 = [0.34, -50, 0.34, 35];
    const pointsAtFacingEnds: ReadonlyArray<Segment2> = [
      [0, 30, 0, 30],
      [0, 60, 0, 60],
    ];
    const pointed = separate([lower, upperDrawnDownward, besideLowerOnly, ...pointsAtFacingEnds]);
    expect(A.map(pointed.segments, round)).toEqual([
      [-0.36, 0, -0.36, 30],
      [0, 90, 0, 60],
      [0.34, -50, 0.34, 35],
      [0, 30, 0, 30],
      [0, 60, 0, 60],
    ]);
    expect(
      pointed.segments[1],
      "a degenerate point crosses nothing, so the edges stay two lines and only the lower one moves"
    ).toBe(upperDrawnDownward);
    expect(gaps(pointed.segments)).toEqual([]);
    const crossed = separate([lower, upperDrawnDownward, besideLowerOnly, [-8, 30, 8, 30], [-8, 60, 8, 60]]);
    expect(
      A.map(A.take(crossed.segments, 2), round),
      "a line truly crossing at each facing end makes them one line, moved whole"
    ).toEqual([
      [-0.36, 0, -0.36, 30],
      [-0.36, 90, -0.36, 60],
    ]);
  });

  it("moves a shallow line seen either side of a post by its larger shortfall, then again until its far piece clears", () => {
    const rise = (x: number) => (x - 48) * 0.04;
    const input: ReadonlyArray<Segment2> = [
      [0, 0, 44, 0],
      [56, 0, 100, 0],
      [10, rise(10), 44, rise(44)],
      [56, rise(56), 57.25, rise(57.25)],
      [44, -8, 44, 8],
      [56, -8, 56, 8],
    ];
    expect(
      A.map(gaps(input), (gap) => Math.round(gap * 1e9) / 1e9),
      "behind the post (x 44 to 56) the line rising 0.04 a unit runs 0.16 under the level edge on the left, and a " +
        "short piece 0.32 to 0.37 over it on the right"
    ).toEqual([0.16, 0.32]);
    const result = separate(input);
    expect(A.map(result.segments, round)).toEqual([
      [0, 0, 44, 0],
      [56, 0, 100, 0],
      [10, -2.59, 44, -1.23],
      [56, -0.75, 57.25, -0.7],
      [44, -8, 44, 8],
      [56, -8, 56, 8],
    ]);
    expect(
      A.map(result.moves, (move) => Math.round(move * 1e9) / 1e9),
      "the larger shortfall (0.54 down) brings the short piece 0.17 under the edge, so it moves again until that " +
        "piece's far end stands 0.7 under"
    ).toEqual([1.07]);
    expect(gaps(result.segments)).toEqual([]);
  });

  it("returns its input untouched when a line between two emphasised outlines has no room to open", () => {
    const below: Segment2 = [0, -0.5, 100, -0.5];
    const above: Segment2 = [0, 0.6, 100, 0.6];
    const input: ReadonlyArray<Segment2> = [below, [0, 0, 100, 0], above];
    const result = separate(input, [below, above]);
    expect(
      result.segments,
      "opening the line from either emphasised outline closes it on the other, so no pass falls less short than " +
        "the input"
    ).toBe(input);
    expect(result.moves).toEqual([]);
    expect(gaps(result.segments)).toEqual([0.5, 0.6]);
  });

  it("returns its input untouched when no pair runs too close", () => {
    const clearPair: ReadonlyArray<Segment2> = [
      [0, 0, 100, 0],
      [0, 0.75, 100, 0.75],
    ];
    const emphasisOverItsOutline: ReadonlyArray<Segment2> = [
      [0, 0, 100, 0],
      [0, 0.003, 100, 0.003],
    ];
    const shortCornerReturn: ReadonlyArray<Segment2> = [
      [0, 0, 10, 0],
      [9.27, 0.42, 20, 0.42],
    ];
    const cases: ReadonlyArray<ReadonlyArray<Segment2>> = [clearPair, emphasisOverItsOutline, shortCornerReturn, []];
    A.forEach(cases, (segments) => {
      const result = separate(segments, [], segments);
      expect(result.segments).toBe(segments);
      expect(result.broken).toBe(segments);
      expect(result.moves).toEqual([]);
    });
  });
});

describe("outlineSpacingFindings", () => {
  const options = ValidationOptions.make({ expectedPages: O.none() });
  const findings = (pair: ReadonlyArray<Segment2>) =>
    outlineSpacingFindings({ page: 3, segmentsMm: A.map(pair, (s) => Segment2.make(s)), options });

  it("flags drawn lines that run side by side closer than 0.7 mm, once per sheet", () => {
    const flagged = findings([
      [0, 0, 100, 0],
      [0, 0.34, 100, 0.34],
    ]);
    expect(A.map(flagged, (f) => [f.code, f.page])).toEqual([["outline-spacing", O.some(3)]]);
    expect(flagged[0]?.message).toContain("closest are 0.34 mm apart");
    expect(
      [options.minOutlineSpacingMm, options.minOutlineOverlapMm],
      "the separateCloseOutlines cases use the validator's default spacing and overlap"
    ).toEqual([defaultMinSpacingSheetMm, defaultMinOverlapSheetMm]);
  });

  it("never prints a spacing a hair under the least spacing as the spacing itself", () => {
    const [flagged] = findings([
      [0, 0, 100, 0],
      [0, 0.6997, 100, 0.6997],
    ]);
    expect(
      flagged?.message,
      "0.6997 apart, rounded to two decimals, would read 0.70 mm apart under a 0.7 mm rule"
    ).toContain("closest are 0.699 mm apart");
  });

  it("passes a clear pair, an emphasis line over its outline, and a short corner return", () => {
    expect(
      findings([
        [0, 0, 100, 0],
        [0, 0.75, 100, 0.75],
      ])
    ).toEqual([]);
    expect(
      findings([
        [0, 0, 100, 0],
        [0, 0.003, 100, 0.003],
      ])
    ).toEqual([]);
    expect(
      findings([
        [0, 0, 10, 0],
        [9.27, 0.42, 20, 0.42],
      ])
    ).toEqual([]);
  });
});
