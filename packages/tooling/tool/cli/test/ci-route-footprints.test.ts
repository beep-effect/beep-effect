import {
  ChangeAtom,
  CI_LANE_ID_VALUES,
  lanesAffectedBy,
  ROUTE_FOOTPRINTS,
  requiredLanes,
  routeFootprintCanonicalJson,
} from "@beep/repo-cli/commands/Ci";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import type { CheckFootprint, CiLaneId } from "@beep/repo-cli/commands/Ci";

const unknownAtom = ChangeAtom.make({ kind: "unknown", path: "mystery.bin", digest: "00" });

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

  it("requires no lane for no atoms and every lane for one unknown atom", () => {
    expect(HashMap.size(requiredLanes([]))).toBe(0);

    const required = requiredLanes([unknownAtom]);
    expect(HashMap.size(required)).toBe(CI_LANE_ID_VALUES.length);
    for (const lane of CI_LANE_ID_VALUES) {
      const kinds = O.getOrElse(HashMap.get(required, lane), () => HashSet.empty());
      expect(HashSet.size(kinds)).toBe(1);
      expect(HashSet.has(kinds, "unknown")).toBe(true);
    }
  });
});
