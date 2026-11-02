import {
  ChangeAtom,
  CI_LANE_ID_VALUES,
  lanesAffectedBy,
  ROUTE_FOOTPRINTS,
  requiredLanes,
  routeFootprintCanonicalJson,
} from "@beep/repo-cli/commands/Ci";
import { describe, expect, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type { ChangeAtomKind, CheckFootprint, CiLaneId } from "@beep/repo-cli/commands/Ci";

const atomOf = (kind: ChangeAtomKind): ChangeAtom => ChangeAtom.make({ kind, path: "changed.file", digest: "00" });
const unknownAtom = ChangeAtom.make({ kind: "unknown", path: "mystery.bin", digest: "00" });
const CanonicalRows = S.Struct({ lane: S.String, external: S.Boolean }).pipe(S.Array, S.fromJsonString);

describe("route footprint record", () => {
  it("has a row for every lane, keyed by its own lane, and every row contains unknown", () => {
    expect(R.keys(ROUTE_FOOTPRINTS)).toHaveLength(CI_LANE_ID_VALUES.length);
    for (const lane of CI_LANE_ID_VALUES) {
      const row: CheckFootprint = ROUTE_FOOTPRINTS[lane];
      expect(row.lane).toBe(lane);
      expect(A.contains(row.kinds, "unknown")).toBe(true);
    }
  });

  it("is total over CiLaneId at compile time", () => {
    const total = ROUTE_FOOTPRINTS satisfies Record<CiLaneId, CheckFootprint>;
    const withoutLint = R.remove(ROUTE_FOOTPRINTS, "lint");
    // @ts-expect-error -- a record missing the lint row does not satisfy Record<CiLaneId, CheckFootprint>
    const partial = withoutLint satisfies Record<CiLaneId, CheckFootprint>;
    expect(R.has(total, "lint")).toBe(true);
    expect(R.size(partial)).toBe(CI_LANE_ID_VALUES.length - 1);
  });

  it("marks only security external and requires it for every atom set", () => {
    expect(A.filter(CI_LANE_ID_VALUES, (lane) => ROUTE_FOOTPRINTS[lane].external)).toEqual(["security"]);
    const atomSets: ReadonlyArray<ReadonlyArray<ChangeAtom>> = [
      [],
      [atomOf("docs:markdown")],
      [atomOf("commits")],
      [atomOf("packet"), atomOf("pkg:catalog")],
      [unknownAtom],
    ];
    expect(A.every(atomSets, (atoms) => HashMap.has(requiredLanes(atoms), "security"))).toBe(true);
  });

  it.effect("carries the external flag in the canonical JSON", () =>
    Effect.gen(function* () {
      const rows = yield* S.decodeEffect(CanonicalRows)(routeFootprintCanonicalJson());
      expect(rows).toHaveLength(CI_LANE_ID_VALUES.length);
      expect(
        A.map(
          A.filter(rows, (row) => row.external),
          (row) => row.lane
        )
      ).toEqual(["security"]);
    })
  );

  it("renders byte-stable canonical JSON", () => {
    const first = routeFootprintCanonicalJson();
    expect(routeFootprintCanonicalJson()).toBe(first);
    expect(new TextEncoder().encode(routeFootprintCanonicalJson())).toEqual(new TextEncoder().encode(first));
  });

  it("maps unknown to every lane", () => {
    const lanes = lanesAffectedBy("unknown");
    expect(HashSet.size(lanes)).toBe(CI_LANE_ID_VALUES.length);
    expect(A.every(CI_LANE_ID_VALUES, (lane) => HashSet.has(lanes, lane))).toBe(true);
  });

  it("requires only the external lanes for no atoms and every lane for one unknown atom", () => {
    const none = requiredLanes([]);
    expect(A.filter(CI_LANE_ID_VALUES, (lane) => HashMap.has(none, lane))).toEqual(["security"]);
    assertSome(O.map(HashMap.get(none, "security"), HashSet.size), 0);

    const required = requiredLanes([unknownAtom]);
    expect(HashMap.size(required)).toBe(CI_LANE_ID_VALUES.length);
    for (const lane of CI_LANE_ID_VALUES) {
      const kinds = O.getOrElse(HashMap.get(required, lane), () => HashSet.empty());
      expect(HashSet.size(kinds)).toBe(1);
      expect(HashSet.has(kinds, "unknown")).toBe(true);
    }
  });
});
