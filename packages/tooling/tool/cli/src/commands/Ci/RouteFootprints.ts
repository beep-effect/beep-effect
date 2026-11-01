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

const unrefined = (
  lane: CiLaneId,
  propagation: FootprintPropagation,
  basis: string,
  external = false
): CheckFootprint =>
  CheckFootprint.make({
    lane,
    kinds: CHANGE_ATOM_KIND_VALUES,
    propagation,
    transformer: false,
    external,
    fixtures: [],
    basis,
  });

const BUILD_CLASS = "unrefined; propagation by lane class: the lane reads its package's dependency closure";
const LOCAL_CLASS = "unrefined; propagation by lane class: the lane reads only the owning package or the root";
const COVERAGE_CLASS = "unrefined; propagation by lane class: the coverage ratchet moves only on covered packages";
// Replay evidence (2026-10-31): PR #1399 head 9a2e1b9644 has a tree identical to its merge base,
// yet Security went red there while green on the base, because osv-scanner reads the live advisory
// database (check.yml). The same feed reded #2332 with a six-comment-line diff.
const EXTERNAL_ADVISORY =
  "unrefined; external: osv-scanner reads the live OSV advisory database, so the verdict can change with no change to the head";

/**
 * The footprint record, total over every lane id.
 *
 * **Example** (Every lane has a row that includes unknown)
 *
 * ```ts import.meta.vitest name="Every lane has a row that includes unknown"
 * import { CI_LANE_ID_VALUES, ROUTE_FOOTPRINTS } from "@beep/repo-cli/commands/Ci"
 * import * as A from "effect/Array"
 *
 * const total = A.every(CI_LANE_ID_VALUES, (lane) => A.contains(ROUTE_FOOTPRINTS[lane].kinds, "unknown"))
 * total // => true
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
  security: unrefined("security", "none", EXTERNAL_ADVISORY, true),
  "shadcn-lint": unrefined("shadcn-lint", "none", LOCAL_CLASS),
  storybook: unrefined("storybook", "reverse-deps", BUILD_CLASS),
  "test-integration": unrefined("test-integration", "reverse-deps", BUILD_CLASS),
  "test-unit": unrefined("test-unit", "reverse-deps", BUILD_CLASS),
} as const satisfies Record<CiLaneId, CheckFootprint>;

/**
 * The footprints in lane-id declaration order.
 *
 * **Example** (One footprint per lane)
 *
 * ```ts import.meta.vitest name="One footprint per lane"
 * import { CI_LANE_ID_VALUES, routeFootprintList } from "@beep/repo-cli/commands/Ci"
 *
 * routeFootprintList().length === CI_LANE_ID_VALUES.length // => true
 * ```
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
 * ```ts import.meta.vitest name="The canonical text is deterministic"
 * import { routeFootprintCanonicalJson } from "@beep/repo-cli/commands/Ci"
 *
 * routeFootprintCanonicalJson() === routeFootprintCanonicalJson() // => true
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
      external: footprint.external,
      fixtures: footprint.fixtures,
    }))
  );

// The external lanes, each seeded with an empty kind set: required before any atom is read.
const externalLanes = (): HashMap.HashMap<CiLaneId, HashSet.HashSet<ChangeAtomKind>> =>
  pipe(
    routeFootprintList(),
    A.filter((footprint) => footprint.external),
    A.map((footprint) => [footprint.lane, HashSet.empty<ChangeAtomKind>()] as const),
    HashMap.fromIterable
  );

/**
 * The lanes one atom kind can affect (the transpose of the footprint record).
 *
 * **Example** (Unknown reaches every lane)
 *
 * ```ts import.meta.vitest name="Unknown reaches every lane"
 * import { CI_LANE_ID_VALUES, lanesAffectedBy } from "@beep/repo-cli/commands/Ci"
 * import * as HashSet from "effect/HashSet"
 *
 * HashSet.size(lanesAffectedBy("unknown")) === CI_LANE_ID_VALUES.length // => true
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
 * **Details**
 *
 * Every `external` lane is required whatever the atoms, with an empty kind
 * set when no atom selected it: its verdict reads inputs outside the head.
 *
 * **Example** (No atoms require only the external lanes)
 *
 * ```ts import.meta.vitest name="No atoms require only the external lanes"
 * import { requiredLanes } from "@beep/repo-cli/commands/Ci"
 * import * as HashMap from "effect/HashMap"
 *
 * HashMap.has(requiredLanes([]), "security") // => true
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
  A.reduce(atoms, externalLanes(), (acc, atom) =>
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
 * **Example** (An empty change skips every non-external lane)
 *
 * ```ts import.meta.vitest name="An empty change skips every non-external lane"
 * import { CI_LANE_ID_VALUES, requiredLanes, skippedLanes } from "@beep/repo-cli/commands/Ci"
 *
 * skippedLanes(requiredLanes([])).length === CI_LANE_ID_VALUES.length - 1 // => true
 * ```
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
 * **Example** (Security is the external lane)
 *
 * ```ts import.meta.vitest name="Security is the external lane"
 * import { routeFootprintRecord } from "@beep/repo-cli/commands/Ci"
 *
 * routeFootprintRecord().security.external // => true
 * ```
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
