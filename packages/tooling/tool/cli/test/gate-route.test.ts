import {
  GateRouteId,
  gateHostedContextFor,
  gateRouteFor,
  gateRouteTable,
  WorkerForcedRoute,
  workerForcedRefusal,
  workerForcedRouteTable,
} from "@beep/repo-cli/test/RepoRun";
import { FinalCheckGate } from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const isGateRouteId = S.is(GateRouteId);

const workerLocal = ["expectation-rewrite", "lint", "repo-sanity", "effect-vitest-files"] as const;
const workerHostedOnly = [
  "cheap-gates",
  "lint-policy",
  "check",
  "docgen",
  "fallow",
  "coverage",
  "hook:schema-catalog",
  "hook:instrumentation-catalog",
] as const;

describe("gate route table (D6)", () => {
  it("has one row per gate route id", () => {
    expect(HashMap.size(gateRouteTable)).toBe(A.length(GateRouteId.literals));
  });

  it("keeps package-scoped lint, expectation-rewrite, repo-sanity and the scoped effect-vitest check local on worker", () => {
    expect(A.map(workerLocal, gateRouteFor("worker"))).toStrictEqual(A.map(workerLocal, () => "local"));
  });

  it("defers the compute-heavy gates and both catalog hooks to hosted CI on worker", () => {
    expect(A.map(workerHostedOnly, gateRouteFor("worker"))).toStrictEqual(A.map(workerHostedOnly, () => "hosted-only"));
  });

  it("runs every gate locally on workstation", () => {
    expect(A.map(GateRouteId.literals, gateRouteFor("workstation"))).toStrictEqual(
      A.map(GateRouteId.literals, () => "local")
    );
  });

  it("covers every final-check gate", () => {
    expect(A.filter(FinalCheckGate.literals, (gate) => !isGateRouteId(gate))).toStrictEqual([]);
  });

  it("maps every gate that is hosted-only on worker to a hosted check-run name", () => {
    const hostedOnly = A.filter(GateRouteId.literals, (gate) => gateRouteFor(gate, "worker") === "hosted-only");
    expect(A.filter(hostedOnly, (gate) => O.isNone(gateHostedContextFor(gate)))).toStrictEqual([]);
  });
});

// goals/compute-profile-gate-routing P3: what --force-local does on a worker, from the dankserver
// measurements of 2026-11-13 (research/2026-11-13-worker-host-acceptance.md).
describe("worker --force-local routes", () => {
  it("runs fallow and coverage one task at a time and refuses the gates whose one process outgrows a worker", () => {
    const tags = A.map(
      ["fallow", "coverage", "cheap-gates", "lint-policy", "repo-sanity", "check", "docgen"] as const,
      (gate) => O.map(HashMap.get(workerForcedRouteTable, gate), (route) => route._tag)
    );
    deepStrictEqual(tags, [
      O.some("Serial"),
      O.some("Serial"),
      O.some("Refused"),
      O.some("Refused"),
      O.some("Refused"),
      O.some("Refused"),
      O.some("Refused"),
    ]);
    assertNone(workerForcedRefusal("fallow"));
    assertNone(workerForcedRefusal("lint"));
    expect(O.getOrUndefined(workerForcedRefusal("check"))).toContain("4.07 GB");
  });

  it("names a route for every gate a worker leaves to hosted CI", () => {
    const hostedOnlyGates = A.filter(FinalCheckGate.literals, (gate) => gateRouteFor(gate, "worker") === "hosted-only");
    expect(A.filter(hostedOnlyGates, (gate) => !HashMap.has(workerForcedRouteTable, gate))).toStrictEqual([]);
    expect(WorkerForcedRoute.cases.Refused.make({ reason: "measured" })._tag).toBe("Refused");
  });
});
