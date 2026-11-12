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
import { dual, identity, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { CI_LANE_ID_VALUES } from "./CiLane.ts";
import {
  CHANGE_ATOM_KIND_VALUES,
  CheckFootprint,
  RouteLaneDecision,
  RouteRefinement,
  RouteRefinementMode,
} from "./Route.schemas.ts";
import type { CiLaneId } from "./CiLane.ts";
import type { ChangeAtom, ChangeAtomKind, FootprintPropagation } from "./Route.schemas.ts";

const UnknownJson = S.fromJsonString(S.Unknown);

/**
 * The admitted footprint refinements, in admission order.
 *
 * **Details**
 *
 * Each refinement removes atom kinds from lanes; {@link ROUTE_FOOTPRINTS}
 * derives every row's kinds from this list, so a refinement and its footprint
 * effect cannot drift apart. `shadow` refinements are measured by the replay
 * and reported by the route, but only `enforced` ones that the revocation
 * sentinel has not revoked skip a lane ({@link routeLaneDecision}).
 *
 * **Example** (The first refinement takes packet markdown out of build and check)
 *
 * ```ts import.meta.vitest name="The first refinement takes packet markdown out of build and check"
 * import { ROUTE_REFINEMENTS } from "@beep/repo-cli/commands/Ci"
 *
 * ROUTE_REFINEMENTS[0]?.id // => "packet-markdown-out-of-build-check"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const ROUTE_REFINEMENTS: ReadonlyArray<RouteRefinement> = [
  // Packet markdown sits under goals/, explorations/, research/ and docs/_internal/, outside every
  // workspace glob, so it is root-owned; turbo registers no //#build or //#check, and no non-test
  // source imports a .md/.mdx file (?raw, import.meta.glob or a module import). Packet data
  // (goals/*/ops/**/*.ts, goals/tsconfig.ops.json) stays in both footprints. Both lanes read the
  // tree only, never commit messages, so the commits atom every head carries is removed too;
  // without it every packet-only head would still select them.
  RouteRefinement.make({
    id: "packet-markdown-out-of-build-check",
    lanes: ["build", "check"],
    removedKinds: ["packet", "commits"],
    mode: "enforced",
    fixtures: [
      "packet markdown edit skips build and check",
      "commits-only head skips build and check",
      "packet data edit selects build and check",
      "docs markdown edit selects build and check",
      "packet markdown with a source edit selects build and check",
    ],
    evidence: "goals/verification-route/research/slice-2-replay.md",
  }),
];

const refinementsOf = (lane: CiLaneId): ReadonlyArray<RouteRefinement> =>
  A.filter(ROUTE_REFINEMENTS, (refinement) => A.contains(refinement.lanes, lane));

const removedKindsOf = (lane: CiLaneId): ReadonlyArray<ChangeAtomKind> =>
  A.flatMap(refinementsOf(lane), (refinement) => refinement.removedKinds);

const unrefined = (
  lane: CiLaneId,
  propagation: FootprintPropagation,
  basis: string,
  external = false
): CheckFootprint =>
  CheckFootprint.make({
    lane,
    kinds: A.filter(CHANGE_ATOM_KIND_VALUES, (kind) => !A.contains(removedKindsOf(lane), kind)),
    propagation,
    transformer: false,
    external,
    fixtures: A.flatMap(refinementsOf(lane), (refinement) => refinement.fixtures),
    basis: A.match(refinementsOf(lane), {
      onEmpty: () => basis,
      onNonEmpty: (refinements) =>
        `${basis}; refined by ${A.join(
          A.map(refinements, (r) => r.id),
          ", "
        )}`,
    }),
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
  Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)(
      A.map(routeFootprintList(), (footprint) => ({
        lane: footprint.lane,
        kinds: A.filter(CHANGE_ATOM_KIND_VALUES, (kind) => A.contains(footprint.kinds, kind)),
        propagation: footprint.propagation,
        transformer: footprint.transformer,
        external: footprint.external,
        fixtures: footprint.fixtures,
      }))
    ),
    identity
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

/**
 * The route decision for one lane, given a change and the revoked refinement
 * ids from the sentinel.
 *
 * **Details**
 *
 * A lane the refined record requires is `selected`. A lane it does not
 * require is `skipped` only when every refinement whose removed kinds the
 * change contains is `enforced` and not revoked; otherwise it is
 * `shadow-skipped` and still runs. A lane no atom reaches even before any
 * refinement (an empty change) is `skipped` with no refinement ids.
 *
 * **Example** (A packet markdown edit skips check)
 *
 * ```ts import.meta.vitest name="A packet markdown edit skips check"
 * import { ChangeAtom, routeLaneDecision } from "@beep/repo-cli/commands/Ci"
 *
 * const atom = ChangeAtom.make({ kind: "packet", path: "goals/x/SPEC.md", digest: "00" })
 * routeLaneDecision([atom], "check", []).decision // => "skipped"
 * ```
 *
 * @param atoms - The classified change.
 * @param lane - The lane to decide.
 * @param revoked - Refinement ids the sentinel revoked.
 * @returns The decision with the responsible refinement ids.
 * @category queries
 * @since 0.0.0
 */
export const routeLaneDecision: {
  (lane: CiLaneId, revoked: ReadonlyArray<string>): (atoms: ReadonlyArray<ChangeAtom>) => RouteLaneDecision;
  (atoms: ReadonlyArray<ChangeAtom>, lane: CiLaneId, revoked: ReadonlyArray<string>): RouteLaneDecision;
} = dual(3, (atoms: ReadonlyArray<ChangeAtom>, lane: CiLaneId, revoked: ReadonlyArray<string>): RouteLaneDecision => {
  if (HashMap.has(requiredLanes(atoms), lane)) {
    return RouteLaneDecision.make({ lane, decision: "selected", refinements: [] });
  }
  const responsible = A.filter(refinementsOf(lane), (refinement) =>
    A.some(atoms, (atom) => A.contains(refinement.removedKinds, atom.kind))
  );
  const acting = A.every(
    responsible,
    (refinement) => RouteRefinementMode.is.enforced(refinement.mode) && !A.contains(revoked, refinement.id)
  );
  return RouteLaneDecision.make({
    lane,
    decision: acting ? "skipped" : "shadow-skipped",
    refinements: A.map(responsible, (refinement) => refinement.id),
  });
});

/**
 * The route decision for every lane, in lane-id declaration order.
 *
 * **Example** (Unknown selects every lane)
 *
 * ```ts import.meta.vitest name="Unknown selects every lane"
 * import { ChangeAtom, routeLaneDecisions } from "@beep/repo-cli/commands/Ci"
 * import * as A from "effect/Array"
 *
 * const atom = ChangeAtom.make({ kind: "unknown", path: "x", digest: "00" })
 * A.every(routeLaneDecisions([atom], []), (row) => row.decision === "selected") // => true
 * ```
 *
 * @param atoms - The classified change.
 * @param revoked - Refinement ids the sentinel revoked.
 * @returns One decision per lane.
 * @category queries
 * @since 0.0.0
 */
export const routeLaneDecisions: {
  (revoked: ReadonlyArray<string>): (atoms: ReadonlyArray<ChangeAtom>) => ReadonlyArray<RouteLaneDecision>;
  (atoms: ReadonlyArray<ChangeAtom>, revoked: ReadonlyArray<string>): ReadonlyArray<RouteLaneDecision>;
} = dual(
  2,
  (atoms: ReadonlyArray<ChangeAtom>, revoked: ReadonlyArray<string>): ReadonlyArray<RouteLaneDecision> =>
    A.map(CI_LANE_ID_VALUES, (lane) => routeLaneDecision(atoms, lane, revoked))
);
