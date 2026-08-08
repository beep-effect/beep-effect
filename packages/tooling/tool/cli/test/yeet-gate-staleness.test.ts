import {
  assessGateStaleness,
  GateArtifactDescriptor,
  GateFileWitness,
  GateFresh,
  GateStale,
  GateUnproven,
  renderYeetGateStalenessBlock,
  staleGateVerdicts,
  unprovenGateVerdicts,
  YEET_GATE_ARTIFACT_DESCRIPTORS,
} from "@beep/repo-cli/test/Yeet";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";

const descriptor = GateArtifactDescriptor.make({
  artifactPath: "standards/coverage.regression-baseline.jsonc",
  gateId: "coverage-regression",
  kind: "baseline",
  regenerateCommand: "bun run beep quality coverage",
});

const artifactAt = (modifiedAtMs: number) =>
  O.some(GateFileWitness.make({ modifiedAtMs, path: descriptor.artifactPath }));

const inputAt = (modifiedAtMs: number) =>
  O.some(GateFileWitness.make({ modifiedAtMs, path: "packages/tooling/tool/cli/test/new-suite.test.ts" }));

describe("gate staleness assessment", () => {
  it("reports an artifact older than the newest change as stale", () => {
    // The lived failure: `quality test-tsgo` exited 0, then the new tests were
    // written, then the gate was never re-run. The green described a tree that
    // did not contain the code it was taken to prove.
    const verdict = assessGateStaleness(descriptor, artifactAt(1_000), inputAt(2_000));

    expect(verdict.status).toBe("stale");
    expect(verdict.status === "stale" ? verdict.skewMs : 0).toBe(1_000);
    expect(verdict.status === "stale" ? verdict.regenerateCommand : "").toBe(descriptor.regenerateCommand);
  });

  it("treats an equal timestamp as fresh", () => {
    // A gate writing its artifact in the same clock tick as the edit it
    // consumed is the ordinary regenerate-after-edit case, and filesystem
    // timestamp granularity is coarse enough that punishing ties would report
    // constant false staleness.
    expect(assessGateStaleness(descriptor, artifactAt(2_000), inputAt(2_000)).status).toBe("fresh");
  });

  it("reports a newer artifact as fresh", () => {
    expect(assessGateStaleness(descriptor, artifactAt(3_000), inputAt(2_000)).status).toBe("fresh");
  });

  it("refuses to judge a gate whose artifact does not exist", () => {
    // Nothing has been proven, so nothing is stale. Reporting stale here would
    // fire on every fresh clone.
    const verdict = assessGateStaleness(descriptor, O.none(), inputAt(2_000));

    expect(verdict.status).toBe("unproven");
    expect(verdict.status === "unproven" ? verdict.detail : "").toContain(descriptor.artifactPath);
  });

  it("refuses to judge when the branch changed nothing", () => {
    expect(assessGateStaleness(descriptor, artifactAt(1_000), O.none()).status).toBe("unproven");
  });
});

describe("gate staleness reporting", () => {
  it("keeps only the verdicts that name a real problem", () => {
    const verdicts = [
      GateFresh.make({ gateId: "knip-ratchet" }),
      GateStale.make({
        artifactPath: descriptor.artifactPath,
        gateId: descriptor.gateId,
        kind: "baseline",
        newestInputPath: "packages/x/src/X.ts",
        regenerateCommand: descriptor.regenerateCommand,
        skewMs: 5_000,
      }),
    ];

    expect(A.map(staleGateVerdicts(verdicts), (verdict) => verdict.gateId)).toStrictEqual([descriptor.gateId]);
  });

  it("renders a clean pass as a line rather than as nothing", () => {
    // "The check ran and found nothing" and "the check never ran" must not look
    // identical — that is the same missing-provenance failure this catches.
    expect(renderYeetGateStalenessBlock([])).toBe("gate staleness: none");
  });

  it("preserves an absent artifact as unproven in operator output", () => {
    const verdict = GateUnproven.make({
      gateId: "jsdoc-documentation-inventory",
      detail: ".beep/ci/jsdoc-documentation.inventory.jsonc does not exist",
    });

    expect(unprovenGateVerdicts([verdict])).toStrictEqual([verdict]);
    expect(renderYeetGateStalenessBlock([], [verdict])).toContain("jsdoc-documentation-inventory (unproven)");
  });

  it("names the artifact, the newer input, and the regenerate command", () => {
    const rendered = renderYeetGateStalenessBlock([
      GateStale.make({
        artifactPath: descriptor.artifactPath,
        gateId: descriptor.gateId,
        kind: "baseline",
        newestInputPath: "packages/x/src/X.ts",
        regenerateCommand: descriptor.regenerateCommand,
        skewMs: 5_000,
      }),
    ]);

    expect(rendered).toContain(descriptor.artifactPath);
    expect(rendered).toContain("packages/x/src/X.ts");
    expect(rendered).toContain(descriptor.regenerateCommand);
  });

  it("catalogues gate artifacts with unique ids and a regenerate command each", () => {
    // A stale verdict is only actionable if it names the command that fixes it.
    const gateIds = A.map(YEET_GATE_ARTIFACT_DESCRIPTORS, (entry) => entry.gateId);

    expect(A.length(YEET_GATE_ARTIFACT_DESCRIPTORS)).toBeGreaterThan(0);
    expect(A.length(A.dedupe(gateIds))).toBe(A.length(gateIds));
    expect(A.every(YEET_GATE_ARTIFACT_DESCRIPTORS, (entry) => entry.regenerateCommand.length > 0)).toBe(true);
    expect(A.map(YEET_GATE_ARTIFACT_DESCRIPTORS, (entry) => entry.regenerateCommand)).toStrictEqual([
      "bun run coverage:baseline:write",
      "bun run beep quality jsdoc-ratchet --write-baseline",
      "bun run beep quality knip --write-baseline",
      "bun run beep lint package-test-typecheck --write-baseline",
      "bun run beep goals doctor --write-baseline",
      "bun run beep ci lane jsdoc-inventory",
    ]);
  });
});
