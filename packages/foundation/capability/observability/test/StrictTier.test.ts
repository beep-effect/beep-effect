import { TelemetryTier } from "@beep/observability/catalog";
import { FailClosedEmitterContext, resolveStrictTier } from "@beep/observability/strict";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as N from "effect/Number";
import * as O from "effect/Option";

const tagSources: ReadonlyArray<readonly [string, O.Option<unknown>, TelemetryTier]> = [
  ["untagged", O.none(), "shape-only"],
  ["unresolvable string", O.some("Workstation"), "shape-only"],
  ["unknown tag", O.some({ _tag: "Mainframe", identitySource: "vouched" }), "shape-only"],
  ["variant missing a field", O.some({ _tag: "Workstation", identitySource: "vouched" }), "shape-only"],
  ["Workstation", O.some({ _tag: "Workstation", identitySource: "vouched", hostName: "dankstation" }), "dev-verbose"],
  ["Server", O.some({ _tag: "Server", identitySource: "vouched", hostName: "api-01" }), "standard"],
  ["StrictDesktop", O.some({ _tag: "StrictDesktop", identitySource: "vouched" }), "shape-only"],
  [
    "CiRunner",
    O.some({ _tag: "CiRunner", identitySource: "vouched", pipelineRunId: "1234567890", vcsRevision: "4e66575c64" }),
    "standard",
  ],
  ["CloudVm", O.some({ _tag: "CloudVm", identitySource: "self-claimed", cloudProvider: "aws" }), "standard"],
  [
    "Serverless",
    O.some({
      _tag: "Serverless",
      identitySource: "vouched",
      cloudProvider: "aws",
      faasName: "docket-intake",
      deploymentEnvironment: "production",
    }),
    "standard",
  ],
  ["Browser", O.some({ _tag: "Browser", identitySource: "self-claimed" }), "shape-only"],
];

const requestValues: ReadonlyArray<O.Option<string>> = [
  O.none(),
  O.some("shape-only"),
  O.some("standard"),
  O.some("dev-verbose"),
  O.some("verbose-please"),
];

const requestSets: ReadonlyArray<ReadonlyArray<O.Option<string>>> = [
  [],
  ...A.map(requestValues, (request) => [request]),
  ...A.flatMap(requestValues, (first) => A.map(requestValues, (second) => [first, second])),
];

const strictnessRank = (tier: string): number =>
  O.getOrElse(
    A.findFirstIndex(TelemetryTier.literals, (name) => name === tier),
    () => 0
  );

const expectedTier = (ceiling: TelemetryTier, requests: ReadonlyArray<O.Option<string>>): TelemetryTier =>
  TelemetryTier.literals[
    A.reduce(A.getSomes(requests), strictnessRank(ceiling), (lowest, request) => N.min(lowest, strictnessRank(request)))
  ] ?? "shape-only";

describe("resolveStrictTier", () => {
  it("resolves every tag source against every request set, never above the ceiling or a request", () => {
    for (const [, tagSource, ceiling] of tagSources) {
      for (const requests of requestSets) {
        const resolution = resolveStrictTier(tagSource, requests);
        expect(resolution.tier).toBe(expectedTier(ceiling, requests));
        expect(strictnessRank(resolution.tier)).toBeLessThanOrEqual(strictnessRank(ceiling));
      }
    }
    expect(A.length(tagSources) * A.length(requestSets)).toBe(341);
  });

  it("falls back to a self-claimed StrictDesktop for untagged and unresolvable tags", () => {
    for (const [name, tagSource, ceiling] of A.take(tagSources, 4)) {
      const resolution = resolveStrictTier(tagSource, [O.some("dev-verbose")]);
      expect([name, resolution.contextSource, resolution.context, resolution.tier, ceiling]).toEqual([
        name,
        "fail-closed",
        FailClosedEmitterContext,
        "shape-only",
        "shape-only",
      ]);
    }
  });

  it("marks a decoded tag as tagged and lets a request lower it", () => {
    const workstation = A.findFirst(tagSources, ([name]) => name === "Workstation").pipe(
      O.flatMap(([, tagSource]) => tagSource)
    );
    expect(resolveStrictTier(workstation, []).contextSource).toBe("tagged");
    expect(resolveStrictTier(workstation, []).tier).toBe("dev-verbose");
    expect(resolveStrictTier([O.some("standard")])(workstation).tier).toBe("standard");
    expect(resolveStrictTier(workstation, [O.some("standard"), O.some("verbose-please")]).tier).toBe("shape-only");
  });
});
