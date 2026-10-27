/**
 * Pure 37 CFR 1.84(m) surface-shading rules: classify a planar face, band its
 * exposure, find its shadow edge, and decide the section planes that cut it
 * into shading lines.
 *
 * **Details**
 *
 * The default plan (`uniform` style, `longest-edge` axis, no minimum face
 * span) reproduces the original procedural hatch exactly: faces above the lit
 * threshold stay blank, lines run along the longest straight edge, and the
 * pitch grows with exposure. The opt-in `graded` style shades every visible
 * planar face: the first line sits one minimum pitch from the shadow edge
 * (behind a wider gutter where drawn lines run close beyond that edge) and
 * the gaps grow geometrically toward the lit side, as in the USPTO Guide's
 * spaced-line examples. The opt-in `surface-class` axis hatches walls along
 * +Z and inclined and level faces along the major edge turned away from the
 * light, so a wall reads the same way in every view and a flap or lid bunches
 * its band on its darkest edge.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O } from "@beep/utils";
import { flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Order from "effect/Order";
import { HatchAxis, ShadingCoverage, ShadingSkip, ShadingSkipReason } from "./Geometry.schemas.ts";
import {
  BandTaper,
  FaceAnchor,
  FaceTreatment,
  ShadingCut,
  ShadingLines,
  ShadingSkipped,
  ShadingTone,
  SurfaceClass,
  ViewFacts,
} from "./Shading.schemas.ts";
import type { Camera, Segment2, ShadingBand, ShadingPlan, Vec3 } from "./Geometry.schemas.ts";
import type {
  BandInk,
  BandRun,
  FaceAspect,
  FaceEdge,
  FaceFacts,
  ShadingRoom,
  ShadingWindow,
} from "./Shading.schemas.ts";

type V3 = Vec3;

const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crossOf = ([ax, ay, az]: V3, [bx, by, bz]: V3): V3 => [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
const plus = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const times = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const unitOf = (a: V3): V3 => times(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
const minus = (a: V3, b: V3): V3 => plus(a, times(b, -1));

const MODEL_UP: V3 = [0, 0, 1];
const MODEL_X: V3 = [1, 0, 0];
// One degree either side decides level, upright, and square-on.
const ANGLE_TOLERANCE = Math.sin(Math.PI / 180);
const COS_TOLERANCE = Math.cos(Math.PI / 180);
// Below this fraction of a step surviving on the sheet, a face is nearly
// edge-on to its hatch step and lines would merge however far apart they are
// on the model.
const MIN_SPREAD = 0.2;
const BACK_FACING = 1e-9;
// Below this share of the light along a face's step the face is lit edge-on
// to its lines and the shadow side is read from the sheet instead (the lower
// right): a wall the sheet light runs straight across in an isometric would
// otherwise flip sides on rounding. The switch stays a hard edge: through the
// default camera sets no two views that light an upright face within 0.01 of
// each other put its band on different sides (the camera sweep in the tests,
// review loop 3, K-07), so it has no ramp. Within one view a face whose share
// sits near 0.2 can still change sides with a turn of under a degree.
const EDGE_ON_LIGHT = 0.2;
// Graded gaps grow by this factor from the shadow edge toward the lit side.
const GROWTH = 1.4;
// Graded strokes: this many full-length lines at the shadow edge, then a taper.
const FULL_LINES = 2;
const TAPER_FROM = 0.6;
const TAPER_TO = 0.4;
// A graded band turns from the light recipe into the faint one over this ramp of exposure rather than at one
// exposure. At a single edge, a face a degree or two off square, or a face two views light almost alike, lost 43% of
// its band's ink to a 0.006 change of exposure (review loop 3, K-07). No face an orthographic view shows square-on or
// turned 30° or 60° about the sheet vertical has its exposure inside the ramp (the nearest are 1/√3 = 0.577 and 0.789),
// so those faces keep the recipe they had.
const FAINT_FROM = 0.6;
const FAINT_TO = 0.7;

// A parallel view's frame looking back along `eye`, with sheet-up toward `upHint`.
const frameOf = (eye: V3, upHint: V3): { readonly eye: V3; readonly right: V3; readonly up: V3 } => {
  const right = unitOf(crossOf(unitOf(upHint), eye));
  return { eye, right, up: crossOf(eye, right) };
};

// The 1.84(m) light of a frame: from the upper left of its sheet, toward the viewer, at 45°.
const lightOf = (frame: { readonly eye: V3; readonly right: V3; readonly up: V3 }): V3 =>
  unitOf(plus(plus(times(frame.right, -1), frame.up), frame.eye));

/**
 * Sheet frame and 1.84(m) light of a camera, in model coordinates.
 *
 * **Details**
 *
 * The frame is that of a parallel view along the camera's `sight` when it
 * carries one, else along its `eye`: a two-point camera looks level, and
 * every face turned toward its raised eye must still read as seen. Back-facing,
 * visibility and seen-area measures read this frame's `eye`.
 *
 * A two-point camera's sheet is a vertical picture plane, not one square to
 * its sight. Near the article it maps a model vector `v` to
 * `(v·right, v_z − tan(β)·(v·ê))` for a raised eye (`+` for a lowered one),
 * where `ê` is the level eye direction and `β` the angle between the sight
 * and `ê`; that is this frame's
 * `(v·right, v·up / cos β)`, the same frame stretched vertically by
 * `1 / cos β`. The stretch keeps every sign, so lit and shaded sides and the
 * band's side are the frame's; it scales vertical measures. Every on-sheet
 * measure read from the frame (the projected span of a face, the
 * stroke-length floor, the area a band's ink is spread over) reads vertical
 * lengths `cos β` short. `β` is steeper than the camera's field, since the
 * sight runs from the box centre rather than from the box's near top corner.
 *
 * The light belongs to the picture plane, not to the sight: a two-point
 * camera's light is the one a level camera along `ê` with the same up has,
 * `(−right + Ẑ + ê) / √3`, and the view carries `ê` as its `picture` normal.
 * A face parallel to the sheet then takes exposure `1/√3` and the same tone
 * and recipe in a two-point top view, a two-point bottom view and the
 * orthographic elevation along `ê`; a light that leaned with the sight lit
 * one wall `0.32` from above and `0.76` from below (review loop 4, O-03).
 * The light's sheet-plane part, read with its `ê` component dropped, falls
 * at 45° from the upper left of the picture plane. A camera without a
 * `sight` keeps its light exactly as before.
 *
 * **Example** (The front elevation's light)
 *
 * ```ts
 * import { Camera } from "@beep/technical-drawing/Geometry.schemas"
 * import { viewFactsOf } from "@beep/technical-drawing/Shading.rules"
 *
 * console.log(viewFactsOf(Camera.make({ eye: [0, -1, 0], up: [0, 0, 1] })).light)
 * ```
 *
 * @param camera - The camera whose view is framed.
 * @returns The view's sheet frame, light and, for a two-point camera, its picture-plane normal.
 * @category utilities
 * @since 0.0.0
 */
export const viewFactsOf = (camera: Camera): ViewFacts => {
  const picture = frameOf(unitOf(camera.eye), camera.up);
  const light = lightOf(picture);
  return O.match(camera.sight, {
    onNone: () => ViewFacts.make({ ...picture, light }),
    onSome: (sight) => ViewFacts.make({ ...frameOf(unitOf(sight), camera.up), light, picture: O.some(picture.eye) }),
  });
};

// The sheet-plane part of the 1.84(m) light: its component along the picture-plane normal (the eye, unless the view
// has a separate picture plane) dropped, so it falls at 45° from the sheet's upper left.
const sheetLightOf = (view: ViewFacts): V3 => {
  const normal = O.getOrElse(view.picture, () => view.eye);
  return minus(view.light, times(normal, dot(view.light, normal)));
};

/**
 * Orientation class of a face normal against model +Z, within one degree.
 *
 * **Example** (A 45° flap is inclined)
 *
 * ```ts
 * import { surfaceClassOf } from "@beep/technical-drawing/Shading.rules"
 *
 * console.log(surfaceClassOf([0, -Math.SQRT1_2, Math.SQRT1_2])) // "inclined"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const surfaceClassOf = (normal: Vec3): SurfaceClass => {
  const vertical = Math.abs(dot(unitOf(normal), MODEL_UP));
  if (vertical >= COS_TOLERANCE) {
    return "level";
  }
  return vertical <= ANGLE_TOLERANCE ? "upright" : "inclined";
};

const onSheet =
  (view: ViewFacts) =>
  (point: V3): readonly [number, number] => [dot(point, view.right), dot(point, view.up)];

// Narrowest width of the face's projected outline: the extent across each
// projected straight edge (where a convex outline's width is smallest) and
// across every 5° direction, whichever is least.
const projectedSpan = (face: FaceFacts, view: ViewFacts): number => {
  const points = A.map(face.outline, onSheet(view));
  const edgeDirections = pipe(
    face.edges,
    A.map((edge) => {
      const [x, y] = onSheet(view)(minus(edge.end, edge.start));
      return Math.atan2(x, -y);
    })
  );
  const directions = [...A.makeBy(36, (i) => (i * Math.PI) / 36), ...edgeDirections];
  return pipe(
    directions,
    A.map((angle) => {
      const across = A.map(points, ([x, y]) => x * Math.cos(angle) + y * Math.sin(angle));
      return A.isReadonlyArrayNonEmpty(across) ? Math.max(...across) - Math.min(...across) : 0;
    }),
    A.reduce(Number.POSITIVE_INFINITY, (least, width) => Math.min(least, width))
  );
};

/**
 * Presentation of a face in a view: `sliver` when its projected width is
 * under `minFaceSpan` (model units), `square-on` within one degree of the
 * sight line, `oblique` otherwise.
 *
 * **Example** (A 2-wide band under a 3-wide minimum)
 *
 * ```ts
 * import { BoundingBox } from "@beep/technical-drawing/Geometry.schemas"
 * import { aspectOf, viewFactsOf } from "@beep/technical-drawing/Shading.rules"
 * import { FaceFacts } from "@beep/technical-drawing/Shading.schemas"
 * import { Camera } from "@beep/technical-drawing/Geometry.schemas"
 *
 * const face = FaceFacts.make({
 *   normal: [0, -1, 0], center: [0, 0, 1], edges: [],
 *   outline: [[-20, 0, 0], [20, 0, 0], [20, 0, 2], [-20, 0, 2]],
 *   bounds: BoundingBox.make({ min: [-20, 0, 0], max: [20, 0, 2] })
 * })
 * const view = viewFactsOf(Camera.make({ eye: [0, -1, 0], up: [0, 0, 1] }))
 * console.log(aspectOf({ face, view, minFaceSpan: 3 })) // "sliver"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const aspectOf = (input: {
  readonly face: FaceFacts;
  readonly view: ViewFacts;
  readonly minFaceSpan: number;
}): FaceAspect => {
  const { face, view, minFaceSpan } = input;
  if (minFaceSpan > 0 && projectedSpan(face, view) < minFaceSpan) {
    return "sliver";
  }
  return dot(unitOf(face.normal), view.eye) >= COS_TOLERANCE ? "square-on" : "oblique";
};

/**
 * Exposure band: the cosine between a face normal and the 1.84(m) light,
 * banded at 0.6, 0.2, and -0.2. A face seen square-on (exposure 1/√3) is
 * `light`; there is no unshaded band.
 *
 * **Details**
 *
 * The tone is read per view, since 37 CFR 1.84(m) puts the light at the
 * upper left of each view. A graded band does not jump at the `faint` edge:
 * its recipe turns from the light one into the faint one over exposures 0.6
 * to 0.7 ({@link faintShareOf}), so a face lit just either side of 0.6 draws
 * nearly the same band.
 *
 * **Example** (Band a square-on face)
 *
 * ```ts
 * import { toneOf } from "@beep/technical-drawing/Shading.rules"
 *
 * console.log(toneOf(1 / Math.sqrt(3))) // "light"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const toneOf = (exposure: number): ShadingTone => {
  if (exposure >= 0.6) {
    return "faint";
  }
  if (exposure >= 0.2) {
    return "light";
  }
  return exposure >= -0.2 ? "medium" : "dark";
};

const clampShare = (share: number): number => Math.max(0, Math.min(1, share));

/**
 * How far a graded band lit at `exposure` has turned from the light recipe
 * to the faint one: 0 up to exposure 0.6, 1 from 0.7, and linear between.
 *
 * **Details**
 *
 * Over the ramp a band's coverage, its line count, and the length of its
 * full-length lines move from the light recipe's to the faint one's (see
 * {@link gradedOffsets} and {@link gradedExtents}), so no small change of
 * exposure strips a band of its full-length lines at once (review loop 3,
 * K-07). No face an orthographic view shows square-on or turned 30° or 60°
 * about the sheet vertical has its exposure inside the ramp: a square-on
 * face (1/√3) keeps the light recipe, and a face turned 30° toward the light
 * (0.789) the faint one.
 *
 * **Example** (A square-on face, a face halfway up the ramp, and a face facing the light)
 *
 * ```ts
 * import { faintShareOf } from "@beep/technical-drawing/Shading.rules"
 *
 * console.log(faintShareOf(1 / Math.sqrt(3))) // 0
 * console.log(faintShareOf(0.65)) // about 0.5
 * console.log(faintShareOf(0.95)) // 1
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const faintShareOf = (exposure: number): number => clampShare((exposure - FAINT_FROM) / (FAINT_TO - FAINT_FROM));

// How much of a face a tone covers from its shadow edge, and how many lines:
// the 1993 Guide's flat-face examples (Appendix 4, Examples 32 and 36) put a
// few strokes at the shadow edge, the last within about a third of the span,
// and leave a face square to the light nearly bare. The light and faint
// recipes are the ends of the faint ramp: `faintShare` (0 light, 1 faint)
// sets where between them a light or faint band sits, each tone defaulting
// to its own end.
const LIGHT_SPACING = { coverage: 0.3, maxLines: 5 };
const FAINT_SPACING = { coverage: 0.15, maxLines: 4 };
const faintRamp = (share: number) => {
  const s = clampShare(share);
  return {
    coverage: (1 - s) * LIGHT_SPACING.coverage + s * FAINT_SPACING.coverage,
    maxLines: Math.round((1 - s) * LIGHT_SPACING.maxLines + s * FAINT_SPACING.maxLines),
  };
};
const toneSpacing = (tone: ShadingTone, faintShare: O.Option<number>) =>
  ShadingTone.match(tone, {
    faint: () => faintRamp(O.getOrElse(faintShare, () => 1)),
    light: () => faintRamp(O.getOrElse(faintShare, () => 0)),
    medium: () => ({ coverage: 0.35, maxLines: 7 }),
    dark: () => ({ coverage: 0.35, maxLines: 8 }),
  });

// A band is at least two lines (one reads as a doubled outline); past the second
// line the tone's share of the span always wins, so a narrow dark face keeps its
// band within the Guide's third of the span instead of reaching across half of it
// (review loop 2, O-03).
const BAND_FLOOR = 2;

/**
 * Line offsets of graded shading across a face `span` wide on the sheet,
 * measured from its shadow edge.
 *
 * **Details**
 *
 * The first line sits `minPitch` from the shadow edge; each gap is `1.4`
 * times the one before, capped at `maxPitch`. Lines stop when they pass the
 * tone's share of the span (once two are drawn) or its maximum count, and
 * never come within `minPitch` of the far edge. A face too narrow
 * for one line gets none. An optional `keep`, given a position and the index
 * the line would take, rejects positions where the face is too narrow for a
 * stroke (a tab, a lip, a pointed tip): the line is not counted and the next
 * position is tried one gap further in, so the strokes move inward instead
 * of vanishing. An optional `lead` (see {@link bandLead}) puts the first line
 * that far from the shadow edge instead, never nearer than `minPitch`; the
 * gaps after it keep their rhythm, the first being `1.4` times `minPitch`.
 * For a `light` or `faint` band an optional `faintShare` (see
 * {@link faintShareOf}) sets the share and count between the light recipe
 * (0) and the faint one (1); each of the two tones defaults to its own end,
 * and `medium` and `dark` ignore it.
 *
 * **Example** (A light 30-wide face)
 *
 * ```ts
 * import { gradedOffsets } from "@beep/technical-drawing/Shading.rules"
 *
 * console.log(gradedOffsets({ span: 30, minPitch: 1, maxPitch: 2.5, tone: "light" }))
 * ```
 *
 * **Example** (A faint band halfway up the faint ramp)
 *
 * ```ts
 * import { gradedOffsets } from "@beep/technical-drawing/Shading.rules"
 *
 * const at = (faintShare: number) => gradedOffsets({ span: 40, minPitch: 1, maxPitch: 2.5, tone: "faint", faintShare })
 * console.log(at(0).length, at(0.5).length, at(1).length) // 5 4 3
 * ```
 *
 * **Example** (A dark band behind a gutter)
 *
 * ```ts
 * import { gradedOffsets } from "@beep/technical-drawing/Shading.rules"
 *
 * console.log(gradedOffsets({ span: 30, minPitch: 1.5, maxPitch: 6, tone: "dark", lead: 3.15 })[0]) // 3.15
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const gradedOffsets = (input: {
  readonly span: number;
  readonly minPitch: number;
  readonly maxPitch: number;
  readonly tone: ShadingTone;
  readonly keep?: (offset: number, index: number) => boolean;
  readonly lead?: number;
  readonly faintShare?: number;
}): ReadonlyArray<number> => {
  const { span, minPitch } = input;
  const maxPitch = Math.max(input.maxPitch, minPitch);
  const keep = input.keep ?? (() => true);
  const lead = Math.max(minPitch, input.lead ?? minPitch);
  const { coverage, maxLines } = toneSpacing(input.tone, O.fromUndefinedOr(input.faintShare));
  const limit = span - minPitch;
  // `gap` is the step that reached `offset`: a kept line grows the next step, a rejected position repeats it
  const next = (offsets: ReadonlyArray<number>, offset: number, gap: number): ReadonlyArray<number> => {
    const drawn = A.length(offsets);
    if (offset > limit || drawn >= maxLines || (drawn >= BAND_FLOOR && offset > coverage * span)) {
      return offsets;
    }
    const grown = Math.min(maxPitch, gap * GROWTH);
    return keep(offset, drawn) ? next([...offsets, offset], offset + grown, grown) : next(offsets, offset + gap, gap);
  };
  return next([], lead, minPitch);
};

// A band whose edge has drawn lines close beyond it starts behind a gutter this many times the larger of its own first
// gap and the spacing from its edge to those lines (review loop 3, O-04).
const GUTTER_RATIO = 1.5;

/**
 * Distance of a graded band's first line from its shadow edge, given the
 * spacing from that edge to the drawn lines just beyond it (`groupPitch`).
 *
 * **Details**
 *
 * With nothing close beyond the edge the first line sits one `minPitch` in,
 * nearer its edge than its companion, as the Guide's bands bunch at the
 * shadow edge. When drawn lines run alongside the edge just beyond it (a
 * wall's two lines past a flap's free edge), band, edge, and lines would read
 * as one evenly spaced ladder. The band then starts behind a gutter 1.5 times
 * the larger of its own first gap (`1.4` times `minPitch`) and `groupPitch`,
 * never less than `minPitch`; the rest of the band keeps its rhythm (review
 * loop 3, O-04). {@link ladderPitch} measures `groupPitch`.
 *
 * **Example** (A band whose edge has a wall 1.8 beyond it)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { bandLead } from "@beep/technical-drawing/Shading.rules"
 *
 * console.log(bandLead({ minPitch: 1.5, groupPitch: O.some(1.8) })) // about 3.15
 * console.log(bandLead({ minPitch: 1.5, groupPitch: O.none() })) // 1.5
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const bandLead = (input: { readonly minPitch: number; readonly groupPitch: O.Option<number> }): number =>
  O.match(input.groupPitch, {
    onNone: () => input.minPitch,
    onSome: (pitch) => Math.max(input.minPitch, GUTTER_RATIO * Math.max(input.minPitch * GROWTH, pitch)),
  });

// Length of the chord a cut at `offset` along the anchor's step makes across
// the face, from its straight edges (a curved face answers infinity and keeps
// every position); the hull across a notch, which is what a stroke spans.
const chordAt =
  (face: FaceFacts, anchor: FaceAnchor, direction: V3) =>
  (offset: number): number => {
    const u = (p: V3) => dot(minus(p, anchor.point), direction);
    const v = (p: V3) => dot(minus(p, anchor.point), anchor.step);
    const hits = pipe(
      face.edges,
      A.map((e): O.Option<number> => {
        const v0 = v(e.start);
        const v1 = v(e.end);
        if (v0 === v1 || (v0 - offset) * (v1 - offset) > 0) {
          return O.none();
        }
        const t = (offset - v0) / (v1 - v0);
        return O.some(u(e.start) + t * (u(e.end) - u(e.start)));
      }),
      A.getSomes
    );
    return A.isReadonlyArrayNonEmpty(hits) ? Math.max(...hits) - Math.min(...hits) : Number.POSITIVE_INFINITY;
  };

/**
 * Drawn fraction of each graded line's chord, by line count: the first
 * `fullLines` lines (two by default) run full length and the rest shorten
 * evenly from 60% to 40%.
 *
 * **Details**
 *
 * The taper is the 1993 Guide's (Appendix 4, Examples 32 and 34): strokes
 * are longest at the shadow edge and shorten toward the light, each centred
 * on the chord it would have filled. A face turned toward the light gets no
 * full-length line at all (`fullLines` 0): its one or two strokes are short.
 * Between the two, an optional `faintShare` (see {@link faintShareOf};
 * default 0) blends each line's extent from the `fullLines` taper (0) to the
 * taper without full-length lines (1), so the full-length lines shorten
 * over the faint ramp instead of vanishing at one exposure.
 *
 * **Example** (Five lines, and two short strokes on a lit face)
 *
 * ```ts
 * import { gradedExtents } from "@beep/technical-drawing/Shading.rules"
 *
 * console.log(gradedExtents({ count: 5 })) // [1, 1, 0.6, 0.5, 0.4]
 * console.log(gradedExtents({ count: 2, fullLines: 0 })) // [0.6, 0.4]
 * ```
 *
 * **Example** (Four lines halfway up the faint ramp)
 *
 * ```ts
 * import { gradedExtents } from "@beep/technical-drawing/Shading.rules"
 *
 * console.log(gradedExtents({ count: 4, faintShare: 0.5 })) // about [0.8, 0.77, 0.53, 0.4]
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const gradedExtents = (input: {
  readonly count: number;
  readonly fullLines?: number;
  readonly faintShare?: number;
}): ReadonlyArray<number> => {
  const { count } = input;
  const fullLines = input.fullLines ?? FULL_LINES;
  const share = clampShare(input.faintShare ?? 0);
  const tapered = (full: number, index: number): number =>
    index < full ? 1 : TAPER_FROM - (TAPER_FROM - TAPER_TO) * ((index - full) / Math.max(1, count - full - 1));
  // at either end of the ramp the blend is exactly that end's taper
  return count <= 0
    ? A.empty()
    : A.makeBy(count, (index) => (1 - share) * tapered(fullLines, index) + share * tapered(0, index));
};

/**
 * Shortest graded stroke that stays legible on the view plane: the plan's
 * minimum stroke plus one minimum pitch at each end, since the legibility
 * pass draws both ends of a stroke back from the outline.
 *
 * **Details**
 *
 * One length for every test of a stroke's room. A band position is kept only
 * where its stroke can reach this length, and the kernel treats a planned
 * stretch with fewer than two strokes this long as a sliver. The
 * stroke-drawing pass uses the same length to decide when a taper would empty
 * a band.
 *
 * **Example** (A plan with a 1.5 minimum stroke)
 *
 * ```ts
 * import { ShadingPlan } from "@beep/technical-drawing/Geometry.schemas"
 * import { legibleStrokeLength } from "@beep/technical-drawing/Shading.rules"
 *
 * const plan = ShadingPlan.make({ minPitch: 1, maxPitch: 3, style: "graded", minStroke: 1.5 })
 * console.log(legibleStrokeLength(plan)) // 3.5
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const legibleStrokeLength = (plan: ShadingPlan): number => plan.minStroke + 2 * plan.minPitch;

// Two shading segments sit side by side when they run within two degrees of
// each other and overlap along their length by more than the minimum spacing;
// collinear pieces (one line split by a hidden part) are 0.01 apart or less
// and do not count.
const PARALLEL_SINE = Math.sin((2 * Math.PI) / 180);
const COLLINEAR = 0.01;

/**
 * Distance between two segments that sit side by side: within two degrees
 * of parallel, overlapping along their length by more than `minOverlap`
 * (default `minSpacing`), and closer than `maxGap` (default `minSpacing`,
 * measured from the second segment's midpoint to the first one's line).
 * Collinear pieces, one line split by a hidden part, are none.
 *
 * **Example** (Two lines 0.3 apart)
 *
 * ```ts
 * import { sideBySideGap } from "@beep/technical-drawing/Shading.rules"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(sideBySideGap({ first: [0, 0, 10, 0], second: [0, 0.3, 10, 0.3], minSpacing: 0.5 }))) // 0.3
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const sideBySideGap = (input: {
  readonly first: Segment2;
  readonly second: Segment2;
  readonly minSpacing: number;
  readonly maxGap?: number;
  readonly minOverlap?: number;
}): O.Option<number> => {
  const { first: a, second: b, minSpacing } = input;
  const maxGap = input.maxGap ?? minSpacing;
  const minOverlap = input.minOverlap ?? minSpacing;
  const [ax, ay, bx, by] = a;
  const length = Math.hypot(bx - ax, by - ay);
  const otherLength = Math.hypot(b[2] - b[0], b[3] - b[1]);
  if (length < COLLINEAR || otherLength < COLLINEAR) {
    return O.none();
  }
  const ux = (bx - ax) / length;
  const uy = (by - ay) / length;
  const sine = Math.abs(ux * (b[3] - b[1]) - uy * (b[2] - b[0])) / otherLength;
  const along = (x: number, y: number) => (x - ax) * ux + (y - ay) * uy;
  const start = along(b[0], b[1]);
  const end = along(b[2], b[3]);
  const overlap = Math.min(length, Math.max(start, end)) - Math.max(0, Math.min(start, end));
  const distance = Math.abs(((b[1] + b[3]) / 2 - ay) * ux - ((b[0] + b[2]) / 2 - ax) * uy);
  return sine <= PARALLEL_SINE && overlap > minOverlap && distance > COLLINEAR && distance < maxGap
    ? O.some(distance)
    : O.none();
};

const segmentLength = (s: Segment2): number => Math.hypot(s[2] - s[0], s[3] - s[1]);

/**
 * Distance from a point to a segment, in the segment's units.
 *
 * **Example** (A point beside a segment)
 *
 * ```ts
 * import { pointToSegmentDistance } from "@beep/technical-drawing/Shading.rules"
 *
 * console.log(pointToSegmentDistance({ x: 5, y: 3, segment: [0, 0, 10, 0] })) // 3
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const pointToSegmentDistance = (input: {
  readonly x: number;
  readonly y: number;
  readonly segment: Segment2;
}): number => {
  const { x, y, segment: s } = input;
  const dx = s[2] - s[0];
  const dy = s[3] - s[1];
  const length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - s[0]) * dx + (y - s[1]) * dy) / length2));
  return Math.hypot(x - (s[0] + t * dx), y - (s[1] + t * dy));
};

/**
 * Distance from a point to the nearest of a set of outline segments;
 * infinity when there are none.
 *
 * **Example** (The nearest of two outlines)
 *
 * ```ts
 * import { nearestOutlineDistance } from "@beep/technical-drawing/Shading.rules"
 *
 * console.log(nearestOutlineDistance({ x: 5, y: 3, outlines: [[0, 0, 10, 0], [0, 10, 10, 10]] })) // 3
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const nearestOutlineDistance = (input: {
  readonly x: number;
  readonly y: number;
  readonly outlines: ReadonlyArray<Segment2>;
}): number =>
  pipe(
    input.outlines,
    A.map((segment) => pointToSegmentDistance({ x: input.x, y: input.y, segment })),
    A.reduce(Number.POSITIVE_INFINITY, (least, d) => Math.min(least, d))
  );

// A drawn line runs beside a stroke, for the ladder test, within five degrees of parallel on the sheet: a perspective
// view tilts an outline a little against the strokes beside it.
const LADDER_SINE = Math.sin((5 * Math.PI) / 180);

// A stretch along a stroke, from its first point.
type Span = readonly [number, number];

// One drawn line beside a stroke: its distance from the stroke's line, signed (positive on the stroke's left, seen
// from its first point), and the stretch of the stroke it runs beside.
type Beside = { readonly distance: number; readonly from: number; readonly to: number };

// A line beside a stroke, measured from a reference line on one side of it (the stroke itself, or a band's edge).
type Beyond = { readonly beyond: number; readonly from: number; readonly to: number };

// The drawn lines that run beside a stroke: within five degrees of parallel and overlapping it along its length, each
// with its signed distance at the middle of the stretch it runs beside.
const besideOf = (stroke: Segment2, lines: ReadonlyArray<Segment2>): ReadonlyArray<Beside> => {
  const [px, py, qx, qy] = stroke;
  const length = Math.hypot(qx - px, qy - py);
  if (length < COLLINEAR) {
    return A.empty();
  }
  const ux = (qx - px) / length;
  const uy = (qy - py) / length;
  return pipe(
    lines,
    A.map(([x1, y1, x2, y2]): O.Option<Beside> => {
      const own = Math.hypot(x2 - x1, y2 - y1);
      if (own < COLLINEAR || Math.abs(ux * (y2 - y1) - uy * (x2 - x1)) / own > LADDER_SINE) {
        return O.none();
      }
      const ta = (x1 - px) * ux + (y1 - py) * uy;
      const tb = (x2 - px) * ux + (y2 - py) * uy;
      const from = Math.max(0, Math.min(ta, tb));
      const to = Math.min(length, Math.max(ta, tb));
      if (!(to > from)) {
        return O.none();
      }
      // the line overlaps the stroke (to > from), so its ends differ along it
      const f = ((from + to) / 2 - ta) / (tb - ta);
      const x = x1 + f * (x2 - x1);
      const y = y1 + f * (y2 - y1);
      return O.some({ distance: ux * (y - py) - uy * (x - px), from, to });
    }),
    A.getSomes
  );
};

// The stretches a set of runs covers along a stroke, in order, with runs that overlap or touch merged.
type Run = { readonly from: number; readonly to: number };
const spansOf: (runs: ReadonlyArray<Run>) => ReadonlyArray<Span> = flow(
  A.sort(Order.mapInput(Order.Number, (run: Run) => run.from)),
  A.reduce(
    A.empty<Span>(),
    (spans: ReadonlyArray<Span>, run: Run): ReadonlyArray<Span> =>
      O.match(A.last(spans), {
        onNone: (): ReadonlyArray<Span> => [[run.from, run.to]],
        onSome: ([lo, hi]): ReadonlyArray<Span> =>
          run.from <= hi ? [...A.dropRight(spans, 1), [lo, Math.max(hi, run.to)]] : [...spans, [run.from, run.to]],
      })
  )
);

const spannedLength = (spans: ReadonlyArray<Span>): number => A.reduce(spans, 0, (sum, [lo, hi]) => sum + (hi - lo));

// How long two sets of stretches along one stroke run side by side.
const sharedLength = (a: ReadonlyArray<Span>, b: ReadonlyArray<Span>): number =>
  A.reduce(a, 0, (sum, [lo1, hi1]) =>
    A.reduce(b, sum, (acc, [lo2, hi2]) => acc + Math.max(0, Math.min(hi1, hi2) - Math.max(lo1, lo2)))
  );

// Lines beside a stroke, nearest first, with the runs that lie within `tolerance` of the one before them taken as one
// line (an outline drawn in pieces, or drawn twice): each at its nearest run's distance, with the stretches it covers.
const linesBeyond = (
  runs: ReadonlyArray<Beyond>,
  tolerance: number
): ReadonlyArray<{ readonly beyond: number; readonly spans: ReadonlyArray<Span> }> =>
  pipe(
    runs,
    A.sort(Order.mapInput(Order.Number, (run: Beyond) => run.beyond)),
    A.reduce(A.empty<A.NonEmptyReadonlyArray<Beyond>>(), (lines, run) =>
      O.match(A.last(lines), {
        onNone: () => [A.of(run)],
        onSome: (line) =>
          run.beyond - A.lastNonEmpty(line).beyond <= tolerance
            ? [...A.dropRight(lines, 1), A.append(line, run)]
            : [...lines, A.of(run)],
      })
    ),
    A.map((line) => ({ beyond: A.headNonEmpty(line).beyond, spans: spansOf(line) }))
  );

/**
 * Spacing from a band's edge to the nearest drawn line that runs alongside
 * that edge beyond the band, or none.
 *
 * **Details**
 *
 * Measured on the sheet beside the band's first `stroke`, with `edge` a
 * segment along the band's edge (the side of the stroke away from the rest
 * of the band). The edge's own drawn lines are the `outlines` within
 * `tolerance` of it. A line counts when it lies more than `tolerance` and at
 * most `reach` beyond the edge, within five degrees of parallel, and runs
 * beside the edge's own lines for at least half the stroke's length; pieces
 * within `tolerance` of each other are one line. An outline that steps out
 * around a tab fills the gap in the edge instead of running beside it, so it
 * is not a ladder (review loop 3, O-04). The answer is the `groupPitch` of
 * {@link bandLead}.
 *
 * **Example** (A wall's two lines 1.8 and 3 beyond a band's edge)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ladderPitch } from "@beep/technical-drawing/Shading.rules"
 *
 * const pitch = ladderPitch({
 *   stroke: [0, 0, 0, 30],
 *   edge: [1.5, 0, 1.5, 30],
 *   outlines: [[1.5, 0, 1.5, 30], [3.3, 0, 3.3, 30], [4.5, 0, 4.5, 30]],
 *   reach: 2.5,
 *   tolerance: 0.15
 * })
 * console.log(O.getOrNull(pitch)) // about 1.8
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const ladderPitch = (input: {
  readonly stroke: Segment2;
  readonly edge: Segment2;
  readonly outlines: ReadonlyArray<Segment2>;
  readonly reach: number;
  readonly tolerance: number;
}): O.Option<number> => {
  const { stroke, edge, tolerance } = input;
  const length = segmentLength(stroke);
  if (length < COLLINEAR) {
    return O.none();
  }
  // the edge's signed distance from the stroke's line, read at the edge's middle
  const toEdge =
    ((stroke[2] - stroke[0]) * ((edge[1] + edge[3]) / 2 - stroke[1]) -
      (stroke[3] - stroke[1]) * ((edge[0] + edge[2]) / 2 - stroke[0])) /
    length;
  const side = toEdge < 0 ? -1 : 1;
  const runs = A.map(
    besideOf(stroke, input.outlines),
    (run): Beyond => ({ beyond: run.distance * side - Math.abs(toEdge), from: run.from, to: run.to })
  );
  const edgeSpans = spansOf(A.filter(runs, (run) => Math.abs(run.beyond) <= tolerance));
  return pipe(
    linesBeyond(
      A.filter(runs, (run) => run.beyond > tolerance && run.beyond <= input.reach),
      tolerance
    ),
    A.findFirst((line) => sharedLength(line.spans, edgeSpans) >= length / 2),
    O.map((line) => line.beyond)
  );
};

/**
 * Distance from a stroke to the nearest drawn line on one side of it, within
 * `within`, that runs beside at least half the stroke's length; none when
 * there is no such line.
 *
 * **Details**
 *
 * `side` picks the side: positive for the stroke's left, seen from its first
 * point, negative for its right. Lines count within five degrees of
 * parallel, and pieces within `tolerance` of each other are one line, so an
 * edge drawn in pieces or drawn twice still covers the stroke. The validator
 * reads a band's edge this way, beside the band's first stroke.
 *
 * **Example** (The edge 1.5 to the right of an upward stroke)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { coveringOutlineDistance } from "@beep/technical-drawing/Shading.rules"
 *
 * const distance = coveringOutlineDistance({
 *   stroke: [0, 0, 0, 30],
 *   side: -1,
 *   outlines: [[1.5, 0, 1.5, 12], [1.5, 12, 1.5, 30], [-4, 0, -4, 30]],
 *   within: 3.5,
 *   tolerance: 0.15
 * })
 * console.log(O.getOrNull(distance)) // 1.5
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const coveringOutlineDistance = (input: {
  readonly stroke: Segment2;
  readonly side: number;
  readonly outlines: ReadonlyArray<Segment2>;
  readonly within: number;
  readonly tolerance: number;
}): O.Option<number> => {
  const length = segmentLength(input.stroke);
  const side = input.side < 0 ? -1 : 1;
  return pipe(
    besideOf(input.stroke, input.outlines),
    A.map((run): Beyond => ({ beyond: run.distance * side, from: run.from, to: run.to })),
    A.filter((run) => run.beyond > COLLINEAR && run.beyond <= input.within),
    (runs) => linesBeyond(runs, input.tolerance),
    A.findFirst((line) => spannedLength(line.spans) >= length / 2),
    O.map((line) => line.beyond)
  );
};

/**
 * Shading segments kept legible after hidden-line removal: every piece is
 * drawn back `inset` from both of its ends (so a stroke stops short of the
 * outline it would otherwise touch, whether that is the face's own edge or a
 * part in front of it), a piece then shorter than `minStroke` is dropped (a
 * chord cut to a fragment by a hidden part), and of two segments side by side
 * closer than `minSpacing` the shorter is dropped (two coplanar parts, a flap
 * and its tab, shading one area from their own anchors). With `outlines` and
 * a `clearance`, an end that still stands closer than the clearance to an
 * outline (one it met at a shallow angle) is drawn back further, half a
 * clearance at a time and at most two clearances, and a piece running beside
 * an outline closer than the clearance is dropped.
 *
 * **Example** (A fragment and a doubled line)
 *
 * ```ts
 * import { Segment2 } from "@beep/technical-drawing/Geometry.schemas"
 * import { legibleShading } from "@beep/technical-drawing/Shading.rules"
 *
 * const segments = [Segment2.make([0, 0, 10, 0]), Segment2.make([0, 0.3, 4, 0.3]), Segment2.make([0, 0, 0.5, 0])]
 * console.log(legibleShading({ segments, minStroke: 1, minSpacing: 0.5, inset: 1 })) // [[1, 0, 9, 0]]
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const legibleShading = (input: {
  readonly segments: ReadonlyArray<Segment2>;
  readonly minStroke: number;
  readonly minSpacing: number;
  readonly inset?: number;
  readonly outlines?: ReadonlyArray<Segment2>;
  readonly clearance?: number;
}): ReadonlyArray<Segment2> => {
  const inset = Math.max(0, input.inset ?? 0);
  const clearance = Math.max(0, input.clearance ?? 0);
  const outlines = input.outlines ?? [];
  const drawnBack = (s: Segment2): Segment2 => {
    const length = segmentLength(s);
    if (inset <= 0 || length <= 2 * inset) {
      return inset <= 0 ? s : [s[0], s[1], s[0], s[1]];
    }
    const ux = (s[2] - s[0]) / length;
    const uy = (s[3] - s[1]) / length;
    return [s[0] + ux * inset, s[1] + uy * inset, s[2] - ux * inset, s[3] - uy * inset];
  };
  // an end that met an outline at a shallow angle sits almost on it after the
  // inset along the stroke: each end is drawn back further, half a clearance
  // at a time and at most two clearances, until it stands clear of every outline
  const nearest = (x: number, y: number): number => nearestOutlineDistance({ x, y, outlines });
  const cleared = (s: Segment2): Segment2 => {
    const length = segmentLength(s);
    if (clearance <= 0 || A.length(outlines) === 0 || length <= 0) {
      return s;
    }
    const ux = (s[2] - s[0]) / length;
    const uy = (s[3] - s[1]) / length;
    const step = clearance / 2;
    const most = 2 * clearance;
    const back = (x: number, y: number, dx: number, dy: number, soFar: number): number =>
      soFar >= most || nearest(x + dx * soFar, y + dy * soFar) >= clearance ? soFar : back(x, y, dx, dy, soFar + step);
    const a = back(s[0], s[1], ux, uy, 0);
    const b = back(s[2], s[3], -ux, -uy, 0);
    return a + b >= length ? [s[0], s[1], s[0], s[1]] : [s[0] + ux * a, s[1] + uy * a, s[2] - ux * b, s[3] - uy * b];
  };
  // a stroke running beside a drawn outline closer than the clearance (a
  // board's edge seen on edge next to the face it bounds) reads as a doubled
  // line and goes
  const besideOutline = (s: Segment2): boolean =>
    clearance > 0 && A.some(outlines, (o) => O.isSome(sideBySideGap({ first: s, second: o, minSpacing: clearance })));
  const long = pipe(
    input.segments,
    A.map(drawnBack),
    A.map(cleared),
    A.filter((s) => segmentLength(s) >= Math.max(input.minStroke, COLLINEAR) && !besideOutline(s))
  );
  const yieldsTo = (s: Segment2, i: number) => (other: Segment2, j: number) =>
    j !== i &&
    O.isSome(sideBySideGap({ first: s, second: other, minSpacing: input.minSpacing })) &&
    (segmentLength(other) > segmentLength(s) || (segmentLength(other) === segmentLength(s) && j < i));
  return A.filter(long, (s, i) => !A.some(long, yieldsTo(s, i)));
};

// A point on the sheet, and a stretch of a stroke by distance from its first point.
type Planar = readonly [number, number];
type Stretch = readonly [number, number];

// A trimmed end lands this share past the clearance, so a unit conversion never measures it a hair under.
const REACH_MARGIN = 1e-9;

const byStart = Order.mapInput(Order.Number, (stretch: Stretch) => stretch[0]);

const overlapOf = (x: Stretch, y: Stretch): O.Option<Stretch> => {
  const [lo, hi] = [Math.max(x[0], y[0]), Math.min(x[1], y[1])];
  return lo < hi ? O.some([lo, hi]) : O.none();
};

// Where along the line from `from` in unit direction `u` it runs closer than `reach` to `centre`.
const nearPoint = (from: Planar, u: Planar, centre: Planar, reach: number): O.Option<Stretch> => {
  const [dx, dy] = [from[0] - centre[0], from[1] - centre[1]];
  const b = u[0] * dx + u[1] * dy;
  const discriminant = b * b - (dx * dx + dy * dy - reach * reach);
  return discriminant > 0 ? O.some([-b - Math.sqrt(discriminant), -b + Math.sqrt(discriminant)]) : O.none();
};

// Where `offset + t * rate` lies strictly inside `bounds`.
const insideFor = (offset: number, rate: number, bounds: Stretch): O.Option<Stretch> => {
  if (rate === 0) {
    return offset > bounds[0] && offset < bounds[1]
      ? O.some([Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY])
      : O.none();
  }
  const [t1, t2] = [(bounds[0] - offset) / rate, (bounds[1] - offset) / rate];
  return O.some([Math.min(t1, t2), Math.max(t1, t2)]);
};

// Where the line from `from` in direction `u` runs closer than `reach` to a segment's straight run, between the
// perpendiculars at its ends.
const nearRun = (from: Planar, u: Planar, line: Segment2, reach: number): O.Option<Stretch> => {
  const length = segmentLength(line);
  const v: Planar = length > 0 ? [(line[2] - line[0]) / length, (line[3] - line[1]) / length] : [1, 0];
  const [dx, dy] = [from[0] - line[0], from[1] - line[1]];
  const across = insideFor(v[0] * dy - v[1] * dx, v[0] * u[1] - v[1] * u[0], [-reach, reach]);
  const along = insideFor(v[0] * dx + v[1] * dy, v[0] * u[0] + v[1] * u[1], [0, length]);
  return O.flatMap(across, (a) => O.flatMap(along, (b) => overlapOf(a, b)));
};

// Where the line from `from` in direction `u` runs closer than `reach` to a segment: one stretch, since the points
// within reach of a segment form a convex region (the run between its ends, and a disc at each end).
const nearSegment = (from: Planar, u: Planar, line: Segment2, reach: number): O.Option<Stretch> =>
  pipe(
    [
      nearPoint(from, u, [line[0], line[1]], reach),
      nearPoint(from, u, [line[2], line[3]], reach),
      nearRun(from, u, line, reach),
    ],
    A.getSomes,
    A.match({
      onEmpty: O.none,
      onNonEmpty: (stretches) =>
        O.some([Math.min(...A.map(stretches, ([lo]) => lo)), Math.max(...A.map(stretches, ([, hi]) => hi))] as const),
    })
  );

// The stretches of `[0, length]` outside every blocked stretch, in order.
const stretchesOutside = (length: number, blocked: ReadonlyArray<Stretch>): ReadonlyArray<Stretch> => {
  const swept = A.reduce(A.sort(blocked, byStart), { kept: A.empty<Stretch>(), from: 0 }, (acc, [lo, hi]) => ({
    kept: lo > acc.from ? A.append(acc.kept, [acc.from, lo] as const) : acc.kept,
    from: Math.max(acc.from, hi),
  }));
  return swept.from < length ? A.append(swept.kept, [swept.from, length] as const) : swept.kept;
};

// The pieces of a stroke that keep `reach` from every line and are at least `minStroke` long; none when no line
// comes within reach of the stroke.
const clearPieces = (
  stroke: Segment2,
  lines: ReadonlyArray<Segment2>,
  reach: number,
  minStroke: number
): O.Option<ReadonlyArray<Segment2>> => {
  const length = segmentLength(stroke);
  const from: Planar = [stroke[0], stroke[1]];
  const u: Planar = length > 0 ? [(stroke[2] - stroke[0]) / length, (stroke[3] - stroke[1]) / length] : [1, 0];
  const at = (t: number): Planar => [from[0] + u[0] * t, from[1] + u[1] * t];
  const blocked = pipe(
    lines,
    A.map((line) => O.flatMap(nearSegment(from, u, line, reach), (near) => overlapOf(near, [0, length]))),
    A.getSomes
  );
  return A.isReadonlyArrayNonEmpty(blocked)
    ? O.some(
        pipe(
          stretchesOutside(length, blocked),
          A.filter(([lo, hi]) => hi - lo >= minStroke),
          A.map(([lo, hi]): Segment2 => [...at(lo), ...at(hi)])
        )
      )
    : O.none();
};

// The strokes of every band the clip leaves with fewer than two pieces where it had more: a graded band below two
// strokes draws none, as the engine's legibility pass rules, so a lone stroke is never left to read as a stray line.
const thinnedStrokes = (
  bands: ReadonlyArray<ShadingBand>,
  clipped: ReadonlyArray<O.Option<ReadonlyArray<Segment2>>>
): HashSet.HashSet<number> => {
  // a stroke no moved line came near keeps its one piece
  const piecesAt = (at: number): number =>
    O.match(O.flatten(A.get(clipped, at)), { onNone: () => 1, onSome: A.length });
  return pipe(
    bands,
    A.filter((band) => {
      const kept = A.reduce(band.strokes, 0, (sum, at) => sum + piecesAt(at));
      return kept < 2 && kept < A.length(band.strokes);
    }),
    A.flatMap((band) => band.strokes),
    HashSet.fromIterable
  );
};

/**
 * Shading strokes clipped again against drawn lines that moved after the
 * strokes were planned: every stretch of a stroke closer than `clearance` to
 * one of `lines` is cut away, and a piece then shorter than `minStroke` is
 * dropped.
 *
 * **Details**
 *
 * Graded strokes are planned and drawn back against the outlines as the
 * engine projects them. Opening close outlines to the least spacing then
 * moves some outlines, by up to about one spacing and further in a stacked
 * run, toward the stroke ends of the face beside them. Clipped against the
 * moved lines, a stroke keeps the clearance at its ends and along its sides;
 * a stroke no moved line comes near is returned as it was. A stroke cut in
 * two (a moved line's end beside its middle) keeps both pieces that are long
 * enough. A band (`bands`, the engine's `EdgeSet.shadingBands`) the clip
 * leaves with fewer than two pieces, where it had more, loses them all: a
 * graded band below two strokes draws none, as the engine's legibility pass
 * rules. Lengths are in the segments' units.
 *
 * **Gotchas**
 *
 * The returned `segments` is the input array itself when no stroke changed.
 * `trimmed` counts strokes cut back that kept a piece, `dropped` strokes that
 * kept none (a thinned band's included), and `droppedAt` lists those strokes'
 * indices in `segments`, in order, for {@link reclippedCoverage}. Without
 * `bands` every stroke is clipped on its own.
 *
 * **Example** (A line moved up under a band of two strokes)
 *
 * ```ts
 * import { Segment2, ShadingBand } from "@beep/technical-drawing/Geometry.schemas"
 * import { reclippedShading } from "@beep/technical-drawing/Shading.rules"
 *
 * const segments = [Segment2.make([2, 0.6, 2, 10]), Segment2.make([4, 0.6, 4, 1.2])]
 * const lines = [Segment2.make([0, 0.3, 10, 0.3])]
 * const alone = reclippedShading({ segments, bands: [], lines, clearance: 0.6, minStroke: 1 })
 * console.log(alone.segments.length, alone.trimmed, alone.dropped, alone.droppedAt) // 1 1 1 [1]
 * // as one band, the stroke left alone goes too
 * const bands = [ShadingBand.make({ face: 0, strokes: [0, 1] })]
 * const banded = reclippedShading({ segments, bands, lines, clearance: 0.6, minStroke: 1 })
 * console.log(banded.segments.length, banded.dropped, banded.droppedAt) // 0 2 [0, 1]
 * ```
 *
 * @param input - The strokes and their bands, the drawn lines that moved, the clearance strokes keep from them, and
 * the shortest stroke kept, in the strokes' units.
 * @returns The clipped strokes, how many were cut back, how many were dropped, and the dropped strokes' indices.
 * @category utilities
 * @since 0.0.0
 */
export const reclippedShading = (input: {
  readonly segments: ReadonlyArray<Segment2>;
  readonly bands: ReadonlyArray<ShadingBand>;
  readonly lines: ReadonlyArray<Segment2>;
  readonly clearance: number;
  readonly minStroke: number;
}): {
  readonly segments: ReadonlyArray<Segment2>;
  readonly trimmed: number;
  readonly dropped: number;
  readonly droppedAt: ReadonlyArray<number>;
} => {
  const reach = input.clearance * (1 + REACH_MARGIN);
  const clipped = A.map(input.segments, (stroke) => clearPieces(stroke, input.lines, reach, input.minStroke));
  const thinned = thinnedStrokes(input.bands, clipped);
  const pieces = A.map(clipped, (kept, at) => (HashSet.has(thinned, at) ? O.some(A.empty<Segment2>()) : kept));
  const cut = A.getSomes(pieces);
  const droppedAt = A.flatMap(pieces, (kept, at) => (O.exists(kept, A.isReadonlyArrayEmpty) ? [at] : []));
  return A.isReadonlyArrayNonEmpty(cut)
    ? {
        segments: A.flatten(A.zipWith(input.segments, pieces, (stroke, kept) => O.getOrElse(kept, () => [stroke]))),
        trimmed: A.length(A.filter(cut, A.isReadonlyArrayNonEmpty)),
        dropped: A.length(droppedAt),
        droppedAt,
      }
    : { segments: input.segments, trimmed: 0, dropped: 0, droppedAt };
};

/**
 * Shading coverage of a view counted again on the strokes the sheet draws: a
 * band whose every stroke the re-clip beside separated outlines dropped is a
 * lost stretch, and a face whose every band it emptied is a lost face.
 *
 * **Details**
 *
 * The engine counts lost faces and stretches on the strokes it projects,
 * before the sheet opens close outlines and clips the strokes again
 * ({@link reclippedShading}). A band the re-clip empties drew nothing on the
 * sheet, and a face left with no drawing band drew nothing at all, though the
 * engine counted it shaded; both are added to the engine's counts. A band that
 * keeps any stroke still draws (`reclippedShading` already empties one it
 * leaves below two strokes). `bands` index the strokes as the
 * engine returned them (`EdgeSet.shadingBands`), and `dropped` must index the
 * same list, as `reclippedShading`'s `droppedAt` does.
 *
 * **Gotchas**
 *
 * The coverage is returned as it was when the re-clip emptied no band. An
 * engine that reports no bands lets no drop be attributed.
 *
 * **Example** (The re-clip drops every stroke of one face)
 *
 * ```ts
 * import { ShadingBand, ShadingCoverage } from "@beep/technical-drawing/Geometry.schemas"
 * import { reclippedCoverage } from "@beep/technical-drawing/Shading.rules"
 *
 * const coverage = reclippedCoverage({
 *   coverage: ShadingCoverage.make({ shadedFaces: 2, skippedFaces: [] }),
 *   bands: [ShadingBand.make({ face: 0, strokes: [0, 1] }), ShadingBand.make({ face: 1, strokes: [2, 3] })],
 *   dropped: [0, 1, 3]
 * })
 * console.log(coverage.lostFaces, coverage.lostStretches) // 1 1
 * ```
 *
 * @param input - The engine's coverage of the view, its shading bands, and the indices of the strokes the re-clip
 * dropped.
 * @returns The coverage with the bands and faces the re-clip emptied counted lost.
 * @category utilities
 * @since 0.0.0
 */
export const reclippedCoverage = (input: {
  readonly coverage: ShadingCoverage;
  readonly bands: ReadonlyArray<ShadingBand>;
  readonly dropped: ReadonlyArray<number>;
}): ShadingCoverage => {
  const dropped = HashSet.fromIterable(input.dropped);
  const emptied = (band: ShadingBand): boolean => A.every(band.strokes, (stroke) => HashSet.has(dropped, stroke));
  const facesOf = (bands: ReadonlyArray<ShadingBand>): HashSet.HashSet<number> =>
    HashSet.fromIterable(A.map(bands, (band) => band.face));
  const bare = A.filter(input.bands, emptied);
  const drawing = facesOf(A.filter(input.bands, (band) => !emptied(band)));
  return A.isReadonlyArrayNonEmpty(bare)
    ? ShadingCoverage.make({
        ...input.coverage,
        lostFaces: input.coverage.lostFaces + HashSet.size(HashSet.difference(facesOf(bare), drawing)),
        lostStretches: input.coverage.lostStretches + A.length(bare),
      })
    : input.coverage;
};

// Lengths are compared to the micrometre so the equal edges of a regular face
// tie instead of ordering by floating-point noise.
const lineLength = (edge: FaceEdge): number => Math.round(edge.length * 1e3) / 1e3;

const rise = (edge: FaceEdge): number => Math.abs(edge.end[2] - edge.start[2]);

// Longest first; among equals the most level edge, so a regular face (an
// equilateral lid flap) is hatched along its horizontal edge in every view.
const hatchEdgeOrder = Order.combine(
  Order.flip(Order.mapInput(Order.Number, lineLength)),
  Order.mapInput(Order.Number, rise)
);

const longestEdgeDirection = (face: FaceFacts): O.Option<V3> =>
  pipe(
    face.edges,
    A.sort(hatchEdgeOrder),
    A.head,
    O.map((edge) => unitOf(plus(edge.end, times(edge.start, -1))))
  );

// The straight edge of a level or inclined face whose outward side faces most
// away from the light: strokes along it bunch on the face's darkest edge.
// Only edges at least a quarter as long as the face's longest count, so a tab
// notch or chamfer cannot turn a flap's strokes into a row of ticks; among
// equals the longer edge wins, so a regular lid keeps one direction per set.
const MAJOR_EDGE_SHARE = 0.25;

// Within 15 degrees of the sheet's vertical, where upright faces hatch.
const WALL_HATCH_COS = Math.cos((15 * Math.PI) / 180);

const majorEdgesOf = (face: FaceFacts): ReadonlyArray<FaceEdge> => {
  const longest = pipe(
    face.edges,
    A.map((edge) => edge.length),
    A.reduce(0, (most, length) => Math.max(most, length))
  );
  return A.filter(face.edges, (edge) => edge.length > 0 && edge.length >= MAJOR_EDGE_SHARE * longest);
};

// The edge of a face whose outward side faces most away from the 1.84(m)
// light, read on the sheet: the edge's outward normal drops its component
// along the sight line and the light its component along the picture-plane
// normal, because the light is a sheet convention (from the upper left of the
// page) and an inclined face seen obliquely can turn a sheet-dark edge into a
// model-lit one. Ties go to the
// edge least aligned with the sheet's vertical (upright faces hatch
// vertically, and a level face's band must not run on from a wall's), then
// to the longer edge.
const darkestEdge = (face: FaceFacts, view: ViewFacts): O.Option<FaceEdge> => {
  const normal = unitOf(face.normal);
  const onSheet = (v: V3): V3 => minus(v, times(view.eye, dot(v, view.eye)));
  const sheetLight = sheetLightOf(view);
  const darkness = (edge: FaceEdge): number => {
    const along = unitOf(minus(edge.end, edge.start));
    const side = unitOf(crossOf(normal, along));
    const mid = times(plus(edge.start, edge.end), 0.5);
    const outward = dot(side, minus(mid, face.center)) < 0 ? times(side, -1) : side;
    const seen = onSheet(outward);
    const length = Math.hypot(seen[0], seen[1], seen[2]);
    return length < 1e-9 ? 0 : -dot(times(seen, 1 / length), sheetLight);
  };
  const verticality = (edge: FaceEdge): number => {
    const seen = onSheet(minus(edge.end, edge.start));
    const length = Math.hypot(seen[0], seen[1], seen[2]);
    return length < 1e-9 ? 1 : Math.abs(dot(times(seen, 1 / length), view.up));
  };
  const order = Order.combine(
    Order.flip(Order.mapInput(Order.Number, (edge: FaceEdge) => Math.round(darkness(edge) * 1e6) / 1e6)),
    Order.combine(
      Order.mapInput(Order.Number, (edge: FaceEdge) => Math.round(verticality(edge) * 1e6) / 1e6),
      Order.flip(Order.mapInput(Order.Number, lineLength))
    )
  );
  const majors = majorEdgesOf(face);
  // An inclined face never hatches within 15 degrees of the sheet's vertical in a view where upright faces hatch (any
  // view not looking straight down or up): its strokes would run on from the band of a wall below it and read the
  // flap as part of the wall (review loop 2, O-01; round 2, R2-02). It takes its darkest other major edge that still
  // faces away from the light, when it has one.
  const wallsHatch = Math.abs(dot(view.eye, MODEL_UP)) < COS_TOLERANCE;
  const offWall =
    wallsHatch && surfaceClassOf(face.normal) === "inclined"
      ? A.filter(majors, (edge) => verticality(edge) < WALL_HATCH_COS && darkness(edge) > 0)
      : A.empty<FaceEdge>();
  return pipe(A.isReadonlyArrayNonEmpty(offWall) ? offWall : majors, A.sort(order), A.head);
};

const darkestEdgeDirection = (face: FaceFacts, view: ViewFacts): O.Option<V3> =>
  O.map(darkestEdge(face, view), (edge) => unitOf(minus(edge.end, edge.start)));

/**
 * Direction the shading lines run along a face, by hatch axis.
 *
 * **Details**
 *
 * `longest-edge`: the face's longest straight edge. `surface-class`: +Z on
 * upright faces; on inclined and level faces the edge whose outward side
 * faces most away from the light, read on the sheet, when a `view` is given (so a lid's strokes
 * bunch on its darkest edge and a hanging flap's run along its lower-right
 * edge instead of shrinking to ticks at its tip), else the level line
 * (`normal × Z`) on an inclined face and the longest edge on a level one (+X
 * on a level face without straight edges, such as a peg's top). None for a
 * `longest-edge` face without straight edges.
 *
 * **Example** (A wall hatches vertically)
 *
 * ```ts
 * import { BoundingBox } from "@beep/technical-drawing/Geometry.schemas"
 * import { hatchDirectionOf } from "@beep/technical-drawing/Shading.rules"
 * import { FaceFacts } from "@beep/technical-drawing/Shading.schemas"
 *
 * const wall = FaceFacts.make({
 *   normal: [0, -1, 0], center: [0, 0, 10], edges: [], outline: [],
 *   bounds: BoundingBox.make({ min: [0, 0, 0], max: [40, 0, 20] })
 * })
 * console.log(hatchDirectionOf({ face: wall, axis: "surface-class" }))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const hatchDirectionOf = (input: {
  readonly face: FaceFacts;
  readonly axis: HatchAxis;
  readonly view?: ViewFacts;
}): O.Option<Vec3> => {
  const { face } = input;
  const darkest = pipe(
    O.fromNullishOr(input.view),
    O.flatMap((view) => darkestEdgeDirection(face, view))
  );
  return HatchAxis.match(input.axis, {
    "longest-edge": () => longestEdgeDirection(face),
    "surface-class": () =>
      SurfaceClass.match(surfaceClassOf(face.normal), {
        upright: () => O.some(MODEL_UP),
        inclined: () => O.orElse(darkest, () => O.some(unitOf(crossOf(unitOf(face.normal), MODEL_UP)))),
        level: () =>
          pipe(
            darkest,
            O.orElse(() => longestEdgeDirection(face)),
            O.orElse(() => O.some(MODEL_X))
          ),
      }),
  });
};

// Fraction of a step along `step` that survives projection toward `eye`: 1
// when the step lies in the picture plane, 0 when it runs along the sight line.
const spread = (step: V3, eye: V3): number => Math.sqrt(Math.max(0, 1 - dot(step, eye) ** 2));

// Distance on the sheet between two lines running along `direction` one unit
// apart along `step`: the projected step's component across the projected lines.
const sheetSpacing = (direction: V3, step: V3, view: ViewFacts): number => {
  const [dx, dy] = onSheet(view)(direction);
  const [sx, sy] = onSheet(view)(step);
  const length = Math.hypot(dx, dy);
  return length < 1e-9 ? 0 : Math.abs(dx * sy - dy * sx) / length;
};

const sign = (value: number): number => (value < 0 ? -1 : 1);

/**
 * Shadow-side anchor of graded lines on a face.
 *
 * **Details**
 *
 * The sheet-plane part of the 1.84(m) light (its component along the
 * picture-plane normal dropped, since the shadow side is read on the sheet),
 * projected into the face plane, points to the lit side; the anchor is the outline point
 * farthest the other way along `step`, and
 * the returned step points from it into the face. When the light has no
 * component along `step` (a face lit edge-on to its lines), the shadow side
 * is the sheet's lower right. With a `shadowEdge` (the darkest edge the
 * lines follow), the shadow side is that edge's side of the face, so the band
 * bunches on the edge its lines run along. The anchor is taken from the face's major
 * straight edges (at least a quarter as long as its longest), so a tab or
 * chamfer sticking out past a side does not move the band; a face without
 * straight edges anchors on its outline. The anchor edge is the first
 * straight edge, in the kernel's order, that runs along `direction` through
 * the anchor's line.
 *
 * **Example** (A square-on wall anchors on its right edge)
 *
 * ```ts
 * import { BoundingBox, Camera } from "@beep/technical-drawing/Geometry.schemas"
 * import { anchorOf, viewFactsOf } from "@beep/technical-drawing/Shading.rules"
 * import { FaceFacts } from "@beep/technical-drawing/Shading.schemas"
 *
 * const wall = FaceFacts.make({
 *   normal: [0, -1, 0], center: [0, 0, 10], edges: [],
 *   outline: [[-20, 0, 0], [20, 0, 0], [20, 0, 20], [-20, 0, 20]],
 *   bounds: BoundingBox.make({ min: [-20, 0, 0], max: [20, 0, 20] })
 * })
 * const view = viewFactsOf(Camera.make({ eye: [0, -1, 0], up: [0, 0, 1] }))
 * console.log(anchorOf({ face: wall, view, direction: [0, 0, 1] }).point) // [20, 0, 0]
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const anchorOf = (input: {
  readonly face: FaceFacts;
  readonly view: ViewFacts;
  readonly direction: Vec3;
  readonly shadowEdge?: FaceEdge;
}): FaceAnchor => {
  const { face, view, direction } = input;
  const normal = unitOf(face.normal);
  const across = unitOf(crossOf(normal, direction));
  // The shadow side is read on the sheet: the light's component toward the
  // viewer makes faces lit but must not pick the near end of a receding wall.
  const sheetLight = sheetLightOf(view);
  const inPlaneLight = minus(sheetLight, times(normal, dot(sheetLight, normal)));
  const toLight = dot(across, inPlaneLight);
  // lit edge-on to its lines, a face shades its sheet-right side, or its
  // bottom when its step runs straight up the sheet
  const sheetRight = dot(across, view.right);
  const sheetShadow = Math.abs(sheetRight) > 1e-6 ? sheetRight : -dot(across, view.up);
  // lines that follow the face's darkest edge bunch on that edge's side
  const edgeSide = O.map(O.fromNullishOr(input.shadowEdge), (edge) =>
    sign(dot(across, minus(times(plus(edge.start, edge.end), 0.5), face.center)))
  );
  const toShadow = O.getOrElse(edgeSide, () =>
    Math.abs(toLight) > EDGE_ON_LIGHT ? -sign(toLight) : sign(sheetShadow)
  );
  const shadow = times(across, toShadow);
  // the anchor is read from the face's major edges, so a tab or chamfer that
  // sticks out past the face's side cannot pull the band outside it
  const majors = majorEdgesOf(face);
  const candidates = A.isReadonlyArrayNonEmpty(majors) ? A.flatMap(majors, (e) => [e.start, e.end]) : face.outline;
  const point = pipe(
    candidates,
    A.reduce(O.none<V3>(), (best, candidate) =>
      O.match(best, {
        onNone: () => O.some(candidate),
        onSome: (current) => (dot(candidate, shadow) > dot(current, shadow) + 1e-9 ? O.some(candidate) : best),
      })
    ),
    O.getOrElse(() => face.center)
  );
  const reach = dot(point, shadow);
  const tolerance = 1e-6 * Math.max(1, Math.abs(reach));
  const edge = A.findFirst(
    face.edges,
    (e) =>
      Math.abs(dot(e.start, shadow) - reach) <= tolerance &&
      Math.abs(dot(e.end, shadow) - reach) <= tolerance &&
      e.length > 0
  );
  return FaceAnchor.make({ point, step: times(shadow, -1), edge });
};

const skipped = (reason: ShadingSkipReason): FaceTreatment => ShadingSkipped.make({ reason });

// Under the surface-class axis a level or inclined face follows its darkest edge, and its band bunches there.
const shadowEdgeOf = (face: FaceFacts, view: ViewFacts, plan: ShadingPlan): O.Option<FaceEdge> =>
  plan.axis === "surface-class" && surfaceClassOf(face.normal) !== "upright" ? darkestEdge(face, view) : O.none();

// Exposure → pitch of the uniform style: `minPitch` at -1, `maxPitch` at the
// lit threshold, none above it.
const uniformPitch = (exposure: number, plan: ShadingPlan): O.Option<number> => {
  if (exposure > plan.litThreshold) {
    return O.none();
  }
  const t = (exposure + 1) / (plan.litThreshold + 1);
  return O.some(plan.minPitch + (plan.maxPitch - plan.minPitch) * Math.max(0, Math.min(1, t)));
};

// Lines centred on the face with a half-pitch phase so none lands on the
// face's own boundary, reaching the kernel bounding box's diagonal each way.
const centredLines = (face: FaceFacts, step: V3, pitch: number): FaceTreatment => {
  const { min, max } = face.bounds;
  const reach = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  const count = Math.floor((2 * reach) / pitch);
  return ShadingLines.make({
    origin: face.center,
    step,
    cuts: A.makeBy(count + 1, (i) => ShadingCut.make({ offset: -reach + pitch * (i + 0.5) })),
  });
};

// The original hatch: lines along the longest edge, stepped across it unless
// that step is too foreshortened, in which case along it.
const legacyTreatment = (face: FaceFacts, view: ViewFacts, pitch: number): FaceTreatment =>
  pipe(
    longestEdgeDirection(face),
    O.match({
      onNone: () => skipped("no-straight-edge"),
      onSome: (direction) => {
        const across = unitOf(crossOf(face.normal, direction));
        const step =
          spread(across, view.eye) >= MIN_SPREAD || spread(across, view.eye) >= spread(direction, view.eye)
            ? across
            : direction;
        const visibleSpread = spread(step, view.eye);
        return visibleSpread < MIN_SPREAD ? skipped("edge-on") : centredLines(face, step, pitch / visibleSpread);
      },
    })
  );

const byRoomOffset = Order.mapInput(Order.Number, (sample: ShadingRoom) => sample.offset);

// The room a window measured for its stretch, in offset order; none when it measured none.
const measuredRoomOf = (window: O.Option<ShadingWindow>): O.Option<A.NonEmptyReadonlyArray<ShadingRoom>> =>
  pipe(
    window,
    O.flatMap((w) => w.room),
    O.map(A.sort(byRoomOffset)),
    O.flatMap(A.match({ onEmpty: O.none, onNonEmpty: O.some }))
  );

const roomBetween = (before: ShadingRoom, after: ShadingRoom, offset: number): number =>
  after.offset - before.offset < 1e-12
    ? after.length
    : before.length + ((after.length - before.length) * (offset - before.offset)) / (after.offset - before.offset);

// The measured room at an offset: read linearly between the samples either side, held flat past the first and last.
const measuredRoomAt =
  (samples: A.NonEmptyReadonlyArray<ShadingRoom>) =>
  (offset: number): number =>
    pipe(
      A.findFirstIndex(samples, (sample) => sample.offset >= offset),
      O.flatMap((index) => O.all([A.get(samples, index - 1), A.get(samples, index)])),
      O.map(([before, after]) => roomBetween(before, after, offset)),
      O.getOrElse(() =>
        offset <= A.headNonEmpty(samples).offset ? A.headNonEmpty(samples).length : A.lastNonEmpty(samples).length
      )
    );

// A stroke's room at an offset along the anchor's step, in model units along the lines: the face's chord there, or,
// where the window measured what the view shows of its stretch, the lesser of the two (review loop 4, G-01). A part in
// front can leave a stretch a pointed glimpse of the face whose chord runs the face's whole height.
const roomOf = (
  face: FaceFacts,
  anchor: FaceAnchor,
  direction: V3,
  measured: O.Option<A.NonEmptyReadonlyArray<ShadingRoom>>
): ((offset: number) => number) => {
  const chord = chordAt(face, anchor, direction);
  return O.match(measured, {
    onNone: () => chord,
    onSome: (samples) => {
      const visible = measuredRoomAt(samples);
      return (offset) => Math.min(chord(offset), visible(offset));
    },
  });
};

// A band of one line reads as a doubled outline, never as shading, so a stretch with room for exactly one is a planned
// skip rather than a face that later loses its line; a stretch with room for none is a sliver.
const bandTreatment = (
  anchor: FaceAnchor,
  cuts: ReadonlyArray<{ readonly offset: number; readonly extent: number }>
): FaceTreatment => {
  if (A.length(cuts) === 1) {
    return skipped("narrow");
  }
  return A.isReadonlyArrayNonEmpty(cuts)
    ? ShadingLines.make({ origin: anchor.point, step: anchor.step, cuts: A.map(cuts, (cut) => ShadingCut.make(cut)) })
    : skipped("sliver");
};

const gradedTreatment = (input: {
  readonly face: FaceFacts;
  readonly view: ViewFacts;
  readonly plan: ShadingPlan;
  readonly direction: V3;
  readonly factor: number;
  readonly window: O.Option<ShadingWindow>;
  readonly shadowEdge: O.Option<FaceEdge>;
  readonly taper: BandTaper;
}): FaceTreatment => {
  const { face, view, plan, direction, factor, window, taper } = input;
  const anchor = anchorOf({
    face,
    view,
    direction,
    ...O.getOrUndefined(O.map(input.shadowEdge, (shadowEdge) => ({ shadowEdge }))),
  });
  const reach = pipe(
    face.outline,
    A.map((point) => dot(minus(point, anchor.point), anchor.step)),
    A.reduce(0, (most, r) => Math.max(most, r))
  );
  // a visible stretch of the face is shaded as a face of its own, from the side nearest the shadow
  // anchor; a stretch cannot start before the anchor, which the major edges set: a probe through a
  // tab or chamfer that sticks out past the face's shadow side sees the face begin inside the
  // appendage, and a band measured from there would put its first stroke in the tab
  const start = O.match(window, { onNone: () => 0, onSome: (w) => Math.max(0, w.start) });
  const span =
    O.match(window, { onNone: () => reach, onSome: (w) => w.span - (Math.max(0, w.start) - w.start) }) * factor;
  const exposure = dot(face.normal, view.light);
  const tone = toneOf(exposure);
  // a face turned toward the light carries short strokes only (Example 32: lit faces are nearly bare); its band
  // turns from the light recipe into the faint one over the faint ramp, so the full-length lines shorten to the taper
  // and the band thins as the exposure rises instead of all at once at one exposure (review loop 3, K-07)
  const faintShare = faintShareOf(exposure);
  // a stroke needs the face wide enough where it is cut to keep the minimum
  // stroke, at the fraction of the chord its line would draw, after the kernel
  // draws both its ends back one pitch from the outline
  const measured = measuredRoomOf(window);
  const room = roomOf(face, anchor, direction, measured);
  const seen = spread(direction, view.eye);
  const needed = legibleStrokeLength(plan);
  // a band cut back because it out-inks a darker neighbour has no full-length line at all (review loop 3, O-02); the
  // room each position needs follows the taper, a full-length line's shortened by the faint ramp. Where the window
  // measured what the view shows of its stretch, a position needs room for a whole chord only: the engine draws a
  // tapered band its strokes cannot show on whole chords cut back to the taper and never below the minimum stroke, so
  // the taper may shorten a band there but never decide where it goes or empty it (review loop 3, J-01; review loop 4,
  // G-01, K-08). A lit band whose shadow side is a glimpsed pointed tip then moves inward to where the glimpse is tall
  // enough for a stroke.
  const fullLines = taper === "full" ? FULL_LINES : 0;
  const fullExtent = 1 - faintShare + faintShare * TAPER_TO;
  const taperedExtent = (index: number): number => (index < fullLines ? fullExtent : TAPER_TO);
  const extentOf = O.isSome(measured) ? (): number => 1 : taperedExtent;
  // the band's positions where each line, drawn at its extent of the room there, keeps the legible length; a stretch
  // whose edge has drawn lines close beyond it starts behind the gutter the engine measured (review loop 3, O-04), and
  // offsets are on the sheet, like the lead (no lead is a lead of one pitch)
  const offsets = gradedOffsets({
    span,
    minPitch: plan.minPitch,
    maxPitch: plan.maxPitch,
    tone,
    keep: (offset, index) => plan.minStroke <= 0 || room(start + offset / factor) * seen * extentOf(index) >= needed,
    lead: O.getOrElse(
      O.flatMap(window, (w) => w.lead),
      () => plan.minPitch
    ),
    faintShare,
  });
  // at the floor a band keeps only the lines a band needs, the ones nearest its shadow edge
  const band = taper === "lit-floor" ? A.take(offsets, BAND_FLOOR) : offsets;
  const extents = gradedExtents({ count: A.length(band), fullLines, faintShare });
  return bandTreatment(
    anchor,
    A.zipWith(band, extents, (offset, extent) => ({ offset: start + offset / factor, extent }))
  );
};

/**
 * Shading decided for one planar face in one view.
 *
 * **Details**
 *
 * Faces turned away from the viewer are `back-facing` and faces narrower than
 * `minFaceSpan` are `sliver`s. The default plan then reproduces the original
 * hatch (`lit` above the threshold, `no-straight-edge`, `edge-on`). Any other
 * axis or style hatches along {@link hatchDirectionOf} with the true sheet
 * spacing; `graded` lines start at the shadow edge and never skip a face as
 * lit, while `uniform` lines keep the lit threshold and the centred pitch.
 * With a `window`, graded lines are planned for that visible stretch of the
 * face alone, measured along the step from the shadow anchor, so a stretch
 * another part uncovers gets its band at the side nearest the shadow, its
 * first line the window's `lead` in from the stretch's edge when it has
 * one (see {@link bandLead}). A window that carries its stretch's measured
 * room (`ShadingRoom`) has each band position judged by what the view shows
 * there, on whole chords, rather than by the face's chord, so a band moves
 * off a glimpsed tip that shows too little of the face for a stroke (review
 * loop 4, G-01). A graded band is cut back by its `taper` (default `full`, the band its tone
 * gives; see {@link BandTaper}), which {@link settleBandTapers} sets when the
 * face out-inks a darker neighbour. A face lit between exposures 0.6 and 0.7
 * gets a band between the light and faint recipes ({@link faintShareOf}).
 *
 * **Example** (A square-on wall under graded shading)
 *
 * ```ts
 * import { BoundingBox, Camera, ShadingPlan } from "@beep/technical-drawing/Geometry.schemas"
 * import { treatmentFor, viewFactsOf } from "@beep/technical-drawing/Shading.rules"
 * import { FaceFacts } from "@beep/technical-drawing/Shading.schemas"
 *
 * const wall = FaceFacts.make({
 *   normal: [0, -1, 0], center: [0, 0, 10], edges: [],
 *   outline: [[-20, 0, 0], [20, 0, 0], [20, 0, 20], [-20, 0, 20]],
 *   bounds: BoundingBox.make({ min: [-20, 0, 0], max: [20, 0, 20] })
 * })
 * const view = viewFactsOf(Camera.make({ eye: [0, -1, 0], up: [0, 0, 1] }))
 * const plan = ShadingPlan.make({ minPitch: 1, maxPitch: 3, style: "graded", axis: "surface-class" })
 * console.log(treatmentFor({ face: wall, view, plan }).kind) // "lines"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const treatmentFor = (input: {
  readonly face: FaceFacts;
  readonly view: ViewFacts;
  readonly plan: ShadingPlan;
  readonly window?: ShadingWindow;
  readonly taper?: BandTaper;
}): FaceTreatment => {
  const { face, view, plan } = input;
  if (!(dot(face.normal, view.eye) > BACK_FACING)) {
    return skipped("back-facing");
  }
  if (aspectOf({ face, view, minFaceSpan: plan.minFaceSpan }) === "sliver") {
    return skipped("sliver");
  }
  const exposure = dot(face.normal, view.light);
  const pitch = uniformPitch(exposure, plan);
  if (plan.style === "uniform" && O.isNone(pitch)) {
    return skipped("lit");
  }
  if (plan.style === "uniform" && plan.axis === "longest-edge") {
    return legacyTreatment(
      face,
      view,
      O.getOrElse(pitch, () => plan.maxPitch)
    );
  }
  return pipe(
    hatchDirectionOf({ face, axis: plan.axis, view }),
    O.match({
      onNone: () => skipped("no-straight-edge"),
      onSome: (direction) => {
        const step = unitOf(crossOf(unitOf(face.normal), direction));
        const factor = sheetSpacing(direction, step, view);
        if (factor < MIN_SPREAD) {
          return skipped("edge-on");
        }
        return plan.style === "graded"
          ? gradedTreatment({
              face,
              view,
              plan,
              direction,
              factor,
              window: input.window === undefined ? O.none() : O.some(input.window),
              shadowEdge: shadowEdgeOf(face, view, plan),
              taper: input.taper ?? "full",
            })
          : centredLines(face, step, O.getOrElse(pitch, () => plan.maxPitch) / factor);
      },
    })
  );
};

// A band needs this many minimum pitches across on the sheet: its first line a pitch in, the second 1.4 pitches past
// it, and a pitch to spare before the stretch's far side (review loop 4, A-01).
const BAND_ROOM_PITCHES = 1 + GROWTH + 1;

// Where the room of a stretch is read across it, in quarter pitches on the sheet.
const ROOM_READINGS_PER_PITCH = 4;

// Width on the sheet of the part of a window whose room, as the window measured it (or the chord cut to the window's
// range along the lines), reaches the legible stroke length, read at quarter pitches across it.
const legibleWidthOf = (input: {
  readonly face: FaceFacts;
  readonly anchor: FaceAnchor;
  readonly direction: V3;
  readonly factor: number;
  readonly view: ViewFacts;
  readonly plan: ShadingPlan;
  readonly window: ShadingWindow;
}): number => {
  const { face, anchor, direction, factor, view, plan, window } = input;
  const start = Math.max(0, window.start);
  const span = window.span - (start - window.start);
  const measured = measuredRoomOf(O.some(window));
  const tall = O.match(O.all([window.low, window.high]), {
    onNone: () => Number.POSITIVE_INFINITY,
    onSome: ([low, high]) => high - low,
  });
  const room = roomOf(face, anchor, direction, measured);
  const roomAt = (offset: number): number => (O.isSome(measured) ? room(offset) : Math.min(room(offset), tall));
  const readings = Math.max(1, Math.ceil((span * factor * ROOM_READINGS_PER_PITCH) / plan.minPitch));
  const seen = spread(direction, view.eye);
  const legible = A.filter(
    A.makeBy(readings, (k) => start + (span * (k + 0.5)) / readings),
    (offset) => roomAt(offset) * seen >= legibleStrokeLength(plan)
  );
  return span > 0 ? (A.length(legible) * span * factor) / readings : 0;
};

/**
 * Whether a visible stretch of a face, as a geometry engine measured it,
 * has room for a graded band: the part of it where a whole chord reaches the
 * legible stroke length on the sheet (see {@link legibleStrokeLength}) is at
 * least 3.4 minimum pitches across, room for a first line a pitch in, a
 * second 1.4 pitches past it, and a pitch to spare.
 *
 * **Details**
 *
 * The room at each position across the stretch is the window's measured
 * room there (see `ShadingRoom`), or, where it measured none, the face's
 * chord cut to the window's range along the lines. A geometry engine asks it
 * of a stretch that drew no band: one with this room is a band the planner
 * failed to draw, and the validator reports it (review loop 4, A-01). A face
 * the rules would not hatch, or would hatch edge-on, has no room for a band.
 *
 * **Example** (A 40 × 20 wall seen whole has room; a 2-wide stretch of it does not)
 *
 * ```ts
 * import { BoundingBox, Camera, ShadingPlan } from "@beep/technical-drawing/Geometry.schemas"
 * import { stretchFitsBand, viewFactsOf } from "@beep/technical-drawing/Shading.rules"
 * import { FaceFacts, ShadingWindow } from "@beep/technical-drawing/Shading.schemas"
 *
 * const face = FaceFacts.make({
 *   normal: [0, -1, 0], center: [0, 0, 10], edges: [],
 *   outline: [[-20, 0, 0], [20, 0, 0], [20, 0, 20], [-20, 0, 20]],
 *   bounds: BoundingBox.make({ min: [-20, 0, 0], max: [20, 0, 20] })
 * })
 * const view = viewFactsOf(Camera.make({ eye: [0, -1, 0], up: [0, 0, 1] }))
 * const plan = ShadingPlan.make({ minPitch: 1, maxPitch: 3, style: "graded", axis: "surface-class", minStroke: 1.5 })
 * console.log(stretchFitsBand({ face, view, plan, window: ShadingWindow.make({ start: 0, span: 40 }) })) // true
 * console.log(stretchFitsBand({ face, view, plan, window: ShadingWindow.make({ start: 0, span: 2 }) })) // false
 * ```
 *
 * @param input - The face, its view, the plan, and the stretch's window with its measured room.
 * @returns Whether the stretch has room for a band of two legible lines.
 * @category utilities
 * @since 0.0.0
 */
export const stretchFitsBand = (input: {
  readonly face: FaceFacts;
  readonly view: ViewFacts;
  readonly plan: ShadingPlan;
  readonly window: ShadingWindow;
}): boolean => {
  const { face, view, plan, window } = input;
  return pipe(
    hatchDirectionOf({ face, axis: plan.axis, view }),
    O.map((direction) => ({
      direction,
      factor: sheetSpacing(direction, unitOf(crossOf(unitOf(face.normal), direction)), view),
    })),
    O.filter(({ factor }) => factor >= MIN_SPREAD && dot(face.normal, view.eye) > BACK_FACING),
    O.exists(({ direction, factor }) => {
      const anchor = anchorOf({
        face,
        view,
        direction,
        ...O.match(shadowEdgeOf(face, view, plan), { onNone: () => ({}), onSome: (shadowEdge) => ({ shadowEdge }) }),
      });
      return (
        legibleWidthOf({ face, anchor, direction, factor, view, plan, window }) >= BAND_ROOM_PITCHES * plan.minPitch
      );
    })
  );
};

// Two faces whose exposures differ by no more than this are equally lit, and neither has to carry less ink.
const EXPOSURE_TIE = 1e-3;

/**
 * The lighter faces whose band out-inks a darker face beside them: for every
 * pair of banded faces that share a visible edge, the lighter one when it is
 * lit more than an exposure tie (0.001) above the other and its ink density
 * is higher.
 *
 * **Details**
 *
 * The rule compares neighbours, never a face against a fixed budget: a
 * band's density rises as its face narrows, so the tones' densities overlap
 * and only the order across a shared edge is meaningful (review loop 3,
 * O-02). Pairs with a face not in `bands` (a sliver, a narrow face, a broken
 * part, any face bare by design) are not compared.
 *
 * **Example** (A lit face out-inks the dark face across its ridge)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { inkOrderSteps } from "@beep/technical-drawing/Shading.rules"
 * import { BandInk } from "@beep/technical-drawing/Shading.schemas"
 *
 * const bands = [
 *   BandInk.make({ face: 0, exposure: 0.5, density: 0.3 }),
 *   BandInk.make({ face: 1, exposure: -0.4, density: 0.2 })
 * ]
 * console.log(HashSet.has(inkOrderSteps({ bands, shared: [[0, 1]] }), 0)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const inkOrderSteps = (input: {
  readonly bands: ReadonlyArray<BandInk>;
  readonly shared: ReadonlyArray<readonly [number, number]>;
}): HashSet.HashSet<number> => {
  const byFace = HashMap.fromIterable(A.map(input.bands, (band) => [band.face, band] as const));
  return pipe(
    input.shared,
    A.map(([a, b]) =>
      pipe(
        O.all([HashMap.get(byFace, a), HashMap.get(byFace, b)]),
        O.map(([p, q]) => (p.exposure >= q.exposure ? ([p, q] as const) : ([q, p] as const))),
        O.filter(([lit, dark]) => lit.exposure - dark.exposure > EXPOSURE_TIE && lit.density > dark.density),
        O.map(([lit]) => lit.face)
      )
    ),
    A.getSomes,
    HashSet.fromIterable
  );
};

// Two banded faces whose seen areas agree within this share compare by density as neighbours do: a band's density
// rises as its face narrows, so only faces of one size compare off a shared edge (review loop 4, F11-04).
const TWIN_AREA_SHARE = 0.1;
// Twins are compared only when their exposures differ by more than one tone step.
const TWIN_EXPOSURE_STEP = 0.2;

/**
 * Pairs of banded faces whose ink order matters without a shared edge: their
 * seen areas agree within 10% and their exposures differ by more than one
 * tone step (0.2).
 *
 * **Details**
 *
 * {@link inkOrderSteps} compares neighbours only, since a band's density
 * rises as its face narrows. Two faces of one seen area on opposite sides of
 * an article (a lit flap and its mirror in medium tone) are not neighbours,
 * yet the lighter one carrying more ink reads as an inverted tone (review
 * loop 4, F11-04). Their density order is meaningful, so they are passed to
 * the same settling as neighbours. Faces with no seen area are never twins.
 *
 * **Example** (Two flaps of one size, one lit and one in medium tone)
 *
 * ```ts
 * import { inkTwins } from "@beep/technical-drawing/Shading.rules"
 * import { BandInk } from "@beep/technical-drawing/Shading.schemas"
 *
 * const bands = [
 *   BandInk.make({ face: 3, exposure: 0.6, density: 0.063 }),
 *   BandInk.make({ face: 7, exposure: 0.05, density: 0.06 })
 * ]
 * console.log(inkTwins({ bands, seen: (face) => (face === 3 ? 100 : 104) })) // [[3, 7]]
 * ```
 *
 * @param input - The banded faces' ink, and each face's seen area on the view plane.
 * @returns The twin pairs, lower face index first.
 * @category utilities
 * @since 0.0.0
 */
export const inkTwins = (input: {
  readonly bands: ReadonlyArray<BandInk>;
  readonly seen: (face: number) => number;
}): ReadonlyArray<readonly [number, number]> => {
  const isTwin = (first: BandInk, second: BandInk): boolean => {
    const [a, b] = [input.seen(first.face), input.seen(second.face)];
    return (
      a > 0 &&
      b > 0 &&
      Math.abs(a - b) <= TWIN_AREA_SHARE * Math.max(a, b) &&
      Math.abs(first.exposure - second.exposure) > TWIN_EXPOSURE_STEP
    );
  };
  return A.flatMap(input.bands, (first, i) =>
    pipe(
      A.drop(input.bands, i + 1),
      A.filter((second) => isTwin(first, second)),
      A.map((second) => [Math.min(first.face, second.face), Math.max(first.face, second.face)] as const)
    )
  );
};

// The longest length each rank of a band may keep: its own longest cut, never longer than a rank nearer the shadow edge.
const rankCeilings = (cuts: ReadonlyArray<{ readonly rank: number; readonly length: number }>) =>
  pipe(
    A.dedupe(A.map(cuts, (cut) => cut.rank)),
    A.sort(Order.Number),
    A.reduce({ ceiling: Number.POSITIVE_INFINITY, ceilings: HashMap.empty<number, number>() }, (acc, rank) => {
      const longest = A.reduce(cuts, 0, (most, cut) => (cut.rank === rank ? Math.max(most, cut.length) : most));
      const ceiling = Math.min(acc.ceiling, longest);
      return { ceiling, ceilings: HashMap.set(acc.ceilings, rank, ceiling) };
    }),
    (acc) => acc.ceilings
  );

/**
 * The lengths the visible runs of one band drawn on its whole chords are cut
 * back to, so the band keeps its taper (review loop 4, K-08).
 *
 * **Details**
 *
 * Every run is measured against one length, the band's longest run: a run
 * takes its extent of that length, the cuts scaled up together so the least
 * extent still draws `minStroke`, never longer than its own run, and never
 * longer than a run nearer the band's shadow edge (a lower `rank`). Cut run
 * by run against each run's own length, a short run at a glimpse's acute
 * tip came out shorter than the lit-side run beside it, and a minimum stroke
 * above both cuts raised them to one length, flattening the taper (review
 * loop 4, R4-07, F11-05).
 *
 * **Example** (A shadow-side run shorter than the lit-side run)
 *
 * ```ts
 * import { bandRunLengths } from "@beep/technical-drawing/Shading.rules"
 * import { BandRun } from "@beep/technical-drawing/Shading.schemas"
 *
 * const runs = [BandRun.make({ length: 5, extent: 0.6, rank: 0 }), BandRun.make({ length: 8, extent: 0.4, rank: 1 })]
 * console.log(bandRunLengths({ runs, minStroke: 4 })) // [5, 4]
 * ```
 *
 * @param input - The band's visible runs and the plan's minimum stroke, in view-plane units.
 * @returns Each run's drawn length, in the runs' order.
 * @category utilities
 * @since 0.0.0
 */
export const bandRunLengths = (input: {
  readonly runs: ReadonlyArray<BandRun>;
  readonly minStroke: number;
}): ReadonlyArray<number> => {
  const longest = A.reduce(input.runs, 0, (most, run) => Math.max(most, run.length));
  const least = A.reduce(input.runs, Number.POSITIVE_INFINITY, (most, run) => Math.min(most, run.extent));
  const planned = (extent: number): number => Math.max(extent * longest, (input.minStroke * extent) / least);
  const cuts = A.map(input.runs, (run) => ({ rank: run.rank, length: Math.min(run.length, planned(run.extent)) }));
  const ceilings = rankCeilings(cuts);
  return A.map(cuts, (cut) =>
    Math.min(
      cut.length,
      O.getOrElse(HashMap.get(ceilings, cut.rank), () => cut.length)
    )
  );
};

/**
 * The next cut a band takes against a darker neighbour: `full` steps to
 * `lit`, `lit` to `lit-floor`, and `lit-floor` has no further step.
 *
 * **Example** (Step a full band)
 *
 * ```ts
 * import { nextBandTaper } from "@beep/technical-drawing/Shading.rules"
 *
 * console.log(nextBandTaper("full")) // Option.some("lit")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const nextBandTaper = (taper: BandTaper): O.Option<BandTaper> =>
  BandTaper.match(taper, {
    full: () => O.some<BandTaper>("lit"),
    lit: () => O.some<BandTaper>("lit-floor"),
    "lit-floor": O.none<BandTaper>,
  });

/**
 * Settle the band tapers of one view so no face turned toward the light
 * carries more ink than a darker face it shares a visible edge with.
 *
 * **Details**
 *
 * `inkOf` plans the view's bands under the given tapers (a face absent from
 * the map is `full`) and returns the banded faces' ink. Each round, every
 * face {@link inkOrderSteps} names takes its {@link nextBandTaper}, so a face
 * steps at most twice. A step only ever removes ink: one that would leave the
 * face without a band, or not thin it, is refused. A face refused a step
 * tries the step after it in the same round (a `lit` taper the untapered
 * fallback thickens may still thin at `lit-floor`), and a face refused every
 * step it has left holds its taper from then on. Rounds repeat to a fixed
 * point, which they reach because every round steps or holds at least one
 * face. With no shared edges nothing steps and every band stays the band its
 * own tone gives.
 *
 * **Example** (A lit face steps once to fall below its dark neighbour)
 *
 * ```ts
 * import * as HashMap from "effect/HashMap"
 * import * as O from "effect/Option"
 * import { settleBandTapers } from "@beep/technical-drawing/Shading.rules"
 * import { BandInk } from "@beep/technical-drawing/Shading.schemas"
 *
 * const tapers = settleBandTapers({
 *   shared: [[0, 1]],
 *   inkOf: (tapers) => [
 *     BandInk.make({ face: 0, exposure: 0.5, density: HashMap.has(tapers, 0) ? 0.15 : 0.3 }),
 *     BandInk.make({ face: 1, exposure: -0.4, density: 0.2 })
 *   ]
 * })
 * console.log(O.getOrNull(HashMap.get(tapers, 0))) // "lit"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const settleBandTapers = (input: {
  readonly shared: ReadonlyArray<readonly [number, number]>;
  readonly inkOf: (tapers: HashMap.HashMap<number, BandTaper>) => ReadonlyArray<BandInk>;
}): HashMap.HashMap<number, BandTaper> => {
  const taperOf = (tapers: HashMap.HashMap<number, BandTaper>, face: number): BandTaper =>
    O.getOrElse(HashMap.get(tapers, face), (): BandTaper => "full");
  const densities = (bands: ReadonlyArray<BandInk>): HashMap.HashMap<number, number> =>
    HashMap.fromIterable(A.map(bands, (band) => [band.face, band.density] as const));
  // the tapers left for a face to step to, nearest first
  const laterTapers = (taper: BandTaper): ReadonlyArray<BandTaper> =>
    O.match(nextBandTaper(taper), { onNone: A.empty, onSome: (next) => [next, ...laterTapers(next)] });
  type Trying = { readonly face: number; readonly later: ReadonlyArray<BandTaper> };
  const settle = (
    tapers: HashMap.HashMap<number, BandTaper>,
    held: HashSet.HashSet<number>,
    bands: ReadonlyArray<BandInk>
  ): HashMap.HashMap<number, BandTaper> => {
    const named = pipe(
      A.fromIterable(inkOrderSteps({ bands, shared: input.shared })),
      A.filter((face) => !HashSet.has(held, face))
    );
    if (!A.isReadonlyArrayNonEmpty(named)) {
      return tapers;
    }
    const before = densities(bands);
    // every named face tries its next taper at once; a step that leaves the face banded and thinner than at the
    // round's start is taken, and a refused face tries the taper after it, until it has none left and holds
    const attempt = (
      taken: HashMap.HashMap<number, BandTaper>,
      trying: ReadonlyArray<Trying>,
      refused: HashSet.HashSet<number>
    ): readonly [HashMap.HashMap<number, BandTaper>, HashSet.HashSet<number>] => {
      const steps = pipe(
        trying,
        A.map((t) => O.map(A.head(t.later), (taper) => ({ face: t.face, taper, later: A.drop(t.later, 1) }))),
        A.getSomes
      );
      const spent = HashSet.union(
        refused,
        HashSet.fromIterable(
          pipe(
            A.filter(trying, (t) => !A.isReadonlyArrayNonEmpty(t.later)),
            A.map((t) => t.face)
          )
        )
      );
      if (!A.isReadonlyArrayNonEmpty(steps)) {
        return [taken, spent];
      }
      const after = densities(
        input.inkOf(A.reduce(steps, taken, (acc, step) => HashMap.set(acc, step.face, step.taper)))
      );
      const thinned = (step: { readonly face: number }): boolean =>
        O.exists(HashMap.get(after, step.face), (density) =>
          O.exists(HashMap.get(before, step.face), (was) => density < was)
        );
      return attempt(
        A.reduce(A.filter(steps, thinned), taken, (acc, step) => HashMap.set(acc, step.face, step.taper)),
        A.filter(steps, (step) => !thinned(step)),
        spent
      );
    };
    const [taken, refused] = attempt(
      tapers,
      A.map(named, (face) => ({ face, later: laterTapers(taperOf(tapers, face)) })),
      HashSet.empty()
    );
    return settle(taken, HashSet.union(held, refused), input.inkOf(taken));
  };
  const none = HashMap.empty<number, BandTaper>();
  return settle(none, HashSet.empty(), input.inkOf(none));
};

/**
 * Coverage counts of a view: faces given lines, and skipped faces per reason
 * in {@link ShadingSkipReason} order, zero counts left out.
 *
 * **Example** (Two shaded faces and one sliver)
 *
 * ```ts
 * import { coverageOf } from "@beep/technical-drawing/Shading.rules"
 * import { ShadingCut, ShadingLines, ShadingSkipped } from "@beep/technical-drawing/Shading.schemas"
 *
 * const lines = ShadingLines.make({ origin: [0, 0, 0], step: [1, 0, 0], cuts: [ShadingCut.make({ offset: 1 })] })
 * console.log(coverageOf([lines, lines, ShadingSkipped.make({ reason: "sliver" })]))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const coverageOf = (treatments: ReadonlyArray<FaceTreatment>): ShadingCoverage => {
  const reasons = pipe(
    treatments,
    A.filter(FaceTreatment.guards.skipped),
    A.map((t) => t.reason)
  );
  return ShadingCoverage.make({
    shadedFaces: A.length(treatments) - A.length(reasons),
    skippedFaces: pipe(
      ShadingSkipReason.literals,
      A.map((reason) => ShadingSkip.make({ reason, faces: A.length(A.filter(reasons, (r) => r === reason)) })),
      A.filter((skip) => skip.faces > 0)
    ),
  });
};
