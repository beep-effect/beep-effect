import { GateRouteId, gateHostedContextFor, gateRouteFor, gateRouteTable } from "@beep/repo-cli/test/RepoRun";
import { FinalCheckGate } from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const isGateRouteId = S.is(GateRouteId);

const workerLocal = ["expectation-rewrite", "lint", "repo-sanity"] as const;
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

  it("keeps package-scoped lint, expectation-rewrite and repo-sanity local on worker", () => {
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
