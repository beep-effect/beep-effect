import { CI_LANE_ID_VALUES, ROUTE_FOOTPRINTS, ROUTE_REFINEMENTS, routeLaneDecision } from "@beep/repo-cli/commands/Ci";
import { ChangedPathEntry, ClassifyDiff, classifyChangedPaths } from "@beep/repo-cli/commands/Ci/RouteClassify";
import { NodeCrypto } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import type { CiLaneId } from "@beep/repo-cli/commands/Ci";
import type { ChangedPathStatus, RouteReadAt } from "@beep/repo-cli/commands/Ci/RouteClassify";

const ROOT_MANIFEST = '{ "name": "@fixture/root", "workspaces": ["packages/*"] }';
const PACKAGE_MANIFEST = '{ "name": "@fixture/x" }';
const MANIFESTS: Readonly<Record<string, string>> = {
  "base:package.json": ROOT_MANIFEST,
  "head:package.json": ROOT_MANIFEST,
  "base:packages/x/package.json": PACKAGE_MANIFEST,
  "head:packages/x/package.json": PACKAGE_MANIFEST,
};
const readAt: RouteReadAt = (ref, file) => Effect.succeed(R.get(MANIFESTS, `${ref}:${file}`));

const diffOf = (paths: ReadonlyArray<string>, status: ChangedPathStatus = "M"): ClassifyDiff =>
  ClassifyDiff.make({
    base: "base",
    head: "head",
    entries: A.map(paths, (path) => ChangedPathEntry.make({ path, status })),
    commits: 1,
  });

// The production path: classify the diff, then decide each lane from the atoms.
const decide = (paths: ReadonlyArray<string>, lane: CiLaneId, revoked: ReadonlyArray<string> = []) =>
  Effect.map(classifyChangedPaths(diffOf(paths), readAt), (changeSet) =>
    routeLaneDecision(changeSet.atoms, lane, revoked)
  );

const REFINEMENT = "packet-markdown-out-of-build-check";
const REFINED_LANES: ReadonlyArray<CiLaneId> = ["build", "check"];

it.layer(NodeCrypto.layer)("route refinements", (it) => {
  it("never remove unknown and name only existing fixtures", () => {
    for (const refinement of ROUTE_REFINEMENTS) {
      expect(A.contains(refinement.removedKinds, "unknown")).toBe(false);
      for (const lane of refinement.lanes) {
        for (const kind of refinement.removedKinds) {
          expect(A.contains(ROUTE_FOOTPRINTS[lane].kinds, kind)).toBe(false);
        }
      }
    }
    expect(A.map(ROUTE_REFINEMENTS, (refinement) => refinement.id)).toEqual([REFINEMENT]);
  });

  describe(REFINEMENT, () => {
    it.effect("packet markdown edit skips build and check", () =>
      Effect.gen(function* () {
        for (const lane of REFINED_LANES) {
          const decision = yield* decide(
            ["goals/verification-route/SPEC.md", "explorations/route/README.md", "research/2026-11-07/brief.md"],
            lane
          );
          expect([decision.decision, decision.refinements]).toEqual(["skipped", [REFINEMENT]]);
        }
      })
    );

    it.effect("packet markdown edit still selects every other non-commits lane", () =>
      Effect.gen(function* () {
        const others = A.filter(CI_LANE_ID_VALUES, (lane) => !A.contains(REFINED_LANES, lane));
        for (const lane of others) {
          expect((yield* decide(["goals/verification-route/SPEC.md"], lane)).decision).toBe("selected");
        }
      })
    );

    it.effect("commits-only head skips build and check", () =>
      Effect.gen(function* () {
        for (const lane of REFINED_LANES) {
          const decision = yield* decide([], lane);
          expect([decision.decision, decision.refinements]).toEqual(["skipped", [REFINEMENT]]);
        }
        expect((yield* decide([], "commitlint")).decision).toBe("selected");
      })
    );

    it.effect("packet data edit selects build and check", () =>
      Effect.gen(function* () {
        for (const lane of REFINED_LANES) {
          for (const path of [
            "goals/route/ops/manifest.json",
            "goals/route/ops/check.ts",
            "goals/route/test/items.json",
          ]) {
            expect((yield* decide([path], lane)).decision).toBe("selected");
          }
        }
      })
    );

    it.effect("docs markdown edit selects build and check", () =>
      Effect.gen(function* () {
        for (const lane of REFINED_LANES) {
          expect((yield* decide(["packages/x/README.md"], lane)).decision).toBe("selected");
          expect((yield* decide(["docs/runbooks/ci.md"], lane)).decision).toBe("selected");
        }
      })
    );

    it.effect("packet markdown with a source edit selects build and check", () =>
      Effect.gen(function* () {
        for (const lane of REFINED_LANES) {
          const decision = yield* decide(["goals/verification-route/SPEC.md", "packages/x/src/index.ts"], lane);
          expect(decision.decision).toBe("selected");
        }
      })
    );

    it.effect("a revoked refinement shadow-skips instead of skipping", () =>
      Effect.gen(function* () {
        const decision = yield* decide(["goals/verification-route/SPEC.md"], "check", [REFINEMENT]);
        expect([decision.decision, decision.refinements]).toEqual(["shadow-skipped", [REFINEMENT]]);
      })
    );

    it.effect("an unknown path among packet markdown selects build and check", () =>
      Effect.gen(function* () {
        for (const lane of REFINED_LANES) {
          const decision = yield* decide(["goals/verification-route/SPEC.md", "LICENSE"], lane);
          expect(decision.decision).toBe("selected");
          expect(decision.refinements).toEqual([]);
        }
      })
    );
  });
});
