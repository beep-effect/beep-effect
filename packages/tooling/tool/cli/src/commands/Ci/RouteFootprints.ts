/**
 * The total footprint record: one {@link CheckFootprint} per {@link CiLaneId},
 * and the pure functions that turn atoms into the lanes they select.
 *
 * **Details**
 *
 * Totality is a compile-time property: {@link ROUTE_FOOTPRINTS} is declared
 * with `satisfies Record<CiLaneId, CheckFootprint>`, so removing a lane's row
 * is a type error and a new lane cannot land without one. Every row starts
 * unrefined (every atom kind, `unknown` included); refinements are admitted
 * one at a time by census rank, each with a mutation fixture and a clean
 * replay (exploration ruling "admission rule").
 *
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import { CI_LANE_ID_VALUES } from "./CiLane.ts";
import { CHANGE_ATOM_KIND_VALUES, CheckFootprint } from "./Route.schemas.ts";
import type { CiLaneId } from "./CiLane.ts";
import type { ChangeAtom, ChangeAtomKind, FootprintPropagation } from "./Route.schemas.ts";

const unrefined = (lane: CiLaneId, propagation: FootprintPropagation, basis: string): CheckFootprint =>
  CheckFootprint.make({
    lane,
    kinds: CHANGE_ATOM_KIND_VALUES,
    propagation,
    transformer: false,
    fixtures: [],
    basis,
  });

const BUILD_CLASS = "unrefined; propagation by lane class: the lane reads its package's dependency closure";
const LOCAL_CLASS = "unrefined; propagation by lane class: the lane reads only the owning package or the root";
const COVERAGE_CLASS = "unrefined; propagation by lane class: the coverage ratchet moves only on covered packages";

/**
 * The footprint record, total over every lane id.
 *
 * **Example** (Every lane has a row that includes unknown)
 *
 * ```ts
 * import { CI_LANE_ID_VALUES, ROUTE_FOOTPRINTS } from "@beep/repo-cli/commands/Ci"
 * import * as A from "effect/Array"
 *
 * const total = A.every(CI_LANE_ID_VALUES, (lane) => A.contains(ROUTE_FOOTPRINTS[lane].kinds, "unknown"))
 * console.log(total) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const ROUTE_FOOTPRINTS = {
  build: unrefined("build", "reverse-deps", BUILD_CLASS),
  check: unrefined("check", "reverse-deps", BUILD_CLASS),
  codegen: unrefined("codegen", "none", LOCAL_CLASS),
  commitlint: unrefined("commitlint", "none", LOCAL_CLASS),
  coverage: unrefined("coverage", "covered-pkgs", COVERAGE_CLASS),
  "desktop-ipc": unrefined("desktop-ipc", "reverse-deps", BUILD_CLASS),
  docgen: unrefined("docgen", "reverse-deps", BUILD_CLASS),
  doctest: unrefined("doctest", "reverse-deps", BUILD_CLASS),
  ecosystem: unrefined("ecosystem", "reverse-deps", BUILD_CLASS),
  fallow: unrefined("fallow", "none", LOCAL_CLASS),
  "jsdoc-ratchet": unrefined("jsdoc-ratchet", "none", LOCAL_CLASS),
  labs: unrefined("labs", "reverse-deps", BUILD_CLASS),
  lint: unrefined("lint", "none", LOCAL_CLASS),
  "lint-policy": unrefined("lint-policy", "none", LOCAL_CLASS),
  nix: unrefined("nix", "none", LOCAL_CLASS),
  property: unrefined("property", "reverse-deps", BUILD_CLASS),
  "repo-sanity": unrefined("repo-sanity", "none", LOCAL_CLASS),
  sast: unrefined("sast", "none", LOCAL_CLASS),
  secrets: unrefined("secrets", "none", LOCAL_CLASS),
  security: unrefined("security", "none", LOCAL_CLASS),
  "shadcn-lint": unrefined("shadcn-lint", "none", LOCAL_CLASS),
  storybook: unrefined("storybook", "reverse-deps", BUILD_CLASS),
  "test-integration": unrefined("test-integration", "reverse-deps", BUILD_CLASS),
  "test-unit": unrefined("test-unit", "reverse-deps", BUILD_CLASS),
} as const satisfies Record<CiLaneId, CheckFootprint>;

/**
 * The footprints in lane-id declaration order.
 *
 * @returns One {@link CheckFootprint} per lane, in `CI_LANE_ID_VALUES` order.
 * @category queries
 * @since 0.0.0
 */
export const routeFootprintList = (): ReadonlyArray<CheckFootprint> =>
  A.map(CI_LANE_ID_VALUES, (lane) => ROUTE_FOOTPRINTS[lane]);

/**
 * Canonical JSON of the footprint record, the text the footprint digest is
 * taken over: rows in lane-id order, kinds in domain order.
 *
 * **Example** (The canonical text is deterministic)
 *
 * ```ts
 * import { routeFootprintCanonicalJson } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(routeFootprintCanonicalJson() === routeFootprintCanonicalJson()) // true
 * ```
 *
 * @returns The minified JSON text the footprint digest is computed over.
 * @category queries
 * @since 0.0.0
 */
export const routeFootprintCanonicalJson = (): string =>
  JSON.stringify(
    A.map(routeFootprintList(), (footprint) => ({
      lane: footprint.lane,
      kinds: A.filter(CHANGE_ATOM_KIND_VALUES, (kind) => A.contains(footprint.kinds, kind)),
      propagation: footprint.propagation,
      transformer: footprint.transformer,
      fixtures: footprint.fixtures,
    }))
  );

/**
 * The lanes one atom kind can affect (the transpose of the footprint record).
 *
 * **Example** (Unknown reaches every lane)
 *
 * ```ts
 * import { CI_LANE_ID_VALUES, lanesAffectedBy } from "@beep/repo-cli/commands/Ci"
 * import * as HashSet from "effect/HashSet"
 *
 * console.log(HashSet.size(lanesAffectedBy("unknown")) === CI_LANE_ID_VALUES.length) // true
 * ```
 *
 * @param kind - The atom kind to look up.
 * @returns The lanes whose footprint names `kind`.
 * @category queries
 * @since 0.0.0
 */
export const lanesAffectedBy = (kind: ChangeAtomKind): HashSet.HashSet<CiLaneId> =>
  pipe(
    routeFootprintList(),
    A.filter((footprint) => A.contains(footprint.kinds, kind)),
    A.map((footprint) => footprint.lane),
    HashSet.fromIterable
  );

/**
 * The lanes a set of atoms requires, each with the kinds that selected it,
 * in lane-id declaration order. Ordering for execution is `WaveOrder`'s job.
 *
 * **Example** (No atoms require no lanes)
 *
 * ```ts
 * import { requiredLanes } from "@beep/repo-cli/commands/Ci"
 * import * as HashMap from "effect/HashMap"
 *
 * console.log(HashMap.size(requiredLanes([]))) // 0
 * ```
 *
 * @param atoms - The classified change.
 * @returns Each required lane with the atom kinds that selected it.
 * @category queries
 * @since 0.0.0
 */
export const requiredLanes = (
  atoms: ReadonlyArray<ChangeAtom>
): HashMap.HashMap<CiLaneId, HashSet.HashSet<ChangeAtomKind>> =>
  A.reduce(atoms, HashMap.empty<CiLaneId, HashSet.HashSet<ChangeAtomKind>>(), (acc, atom) =>
    HashSet.reduce(lanesAffectedBy(atom.kind), acc, (inner, lane) =>
      HashMap.set(
        inner,
        lane,
        pipe(
          HashMap.get(inner, lane),
          O.getOrElse(() => HashSet.empty<ChangeAtomKind>()),
          HashSet.add(atom.kind)
        )
      )
    )
  );

/**
 * The lanes a set of atoms does not require, in lane-id declaration order.
 *
 * @param required - The output of {@link requiredLanes}.
 * @returns Every lane id absent from `required`.
 * @category queries
 * @since 0.0.0
 */
export const skippedLanes = (
  required: HashMap.HashMap<CiLaneId, HashSet.HashSet<ChangeAtomKind>>
): ReadonlyArray<CiLaneId> => A.filter(CI_LANE_ID_VALUES, (lane) => !HashMap.has(required, lane));

/**
 * The footprint record as a plain record keyed by lane id, for JSON output.
 *
 * @returns The same rows as {@link ROUTE_FOOTPRINTS}, typed as a plain record.
 * @category queries
 * @since 0.0.0
 */
export const routeFootprintRecord = (): Record<CiLaneId, CheckFootprint> =>
  R.fromEntries(A.map(CI_LANE_ID_VALUES, (lane) => [lane, ROUTE_FOOTPRINTS[lane]] as const)) as Record<
    CiLaneId,
    CheckFootprint
  >;
