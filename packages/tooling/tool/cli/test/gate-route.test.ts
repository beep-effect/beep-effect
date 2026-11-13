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
import { assertNone } from "@effect/vitest/utils";
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

// goals/compute-profile-gate-routing: what --force-local does on a worker, from the dankserver
// measurements of 2026-11-13 (research/2026-11-13-worker-host-acceptance.md and its -repeat.md) and
// the 2026-11-13 decision "A forced gate on a worker completes serially inside its measured budget
// or refuses with the reason".
describe("worker --force-local routes", () => {
  const reason = (gate: GateRouteId) => O.getOrElse(workerForcedRefusal(gate), () => "");

  it("keeps only coverage forceable and refuses every other gate a worker does not run in full", () => {
    const tags = A.map(GateRouteId.literals, (gate) => [
      gate,
      O.getOrUndefined(O.map(HashMap.get(workerForcedRouteTable, gate), (route) => route._tag)),
    ]);
    expect(tags).toStrictEqual([
      ["expectation-rewrite", undefined],
      ["cheap-gates", "Refused"],
      ["lint-policy", "Refused"],
      ["lint", undefined],
      ["repo-sanity", "Refused"],
      ["check", "Refused"],
      ["docgen", "Refused"],
      ["fallow", "Refused"],
      ["coverage", "Serial"],
      ["effect-vitest-files", undefined],
      ["hook:schema-catalog", undefined],
      ["hook:instrumentation-catalog", undefined],
    ]);
    assertNone(workerForcedRefusal("coverage"));
    assertNone(workerForcedRefusal("lint"));
  });

  it("names the measured figure and where it is recorded in each refusal", () => {
    const cheapGates = reason("cheap-gates");
    const fallow = reason("fallow");
    expect(cheapGates).toContain("5.2 GB");
    expect(cheapGates).toContain("worker-final-check-runs-only-changeset-status-for-repo-sanity");
    expect(reason("lint-policy")).toContain("2.59 GB");
    expect(reason("check")).toContain("2.59 GB for one process");
    expect(reason("check")).toContain("(2026-11-13-worker-host-acceptance.md)");
    expect(reason("repo-sanity")).toMatch(/^only its changeset status check runs here; .*5\.2 GB/);
    expect(reason("docgen")).toBe("no measured worker budget on dankserver");
    expect(fallow).toContain("2.15 GB aggregate");
    expect(fallow).toContain("523 s (2026-11-13-worker-host-acceptance-repeat.md)");
    expect(fallow).toContain("3.06 GB");
  });

  it("names a route for every gate a worker leaves to hosted CI", () => {
    const hostedOnlyGates = A.filter(FinalCheckGate.literals, (gate) => gateRouteFor(gate, "worker") === "hosted-only");
    expect(A.filter(hostedOnlyGates, (gate) => !HashMap.has(workerForcedRouteTable, gate))).toStrictEqual([]);
    expect(WorkerForcedRoute.cases.Refused.make({ reason: "measured" })._tag).toBe("Refused");
  });
});
