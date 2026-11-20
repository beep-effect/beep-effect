import { $InfraCiRunnersId as registry } from "@beep/identity/packages";
import { $InfraCiRunnersId as leaf } from "@beep/infra-ci-runners/internal/InfraCiRunnersId";
import { PlanRefused } from "@beep/infra-ci-runners/PlanCheck";
import { describe, expect, it } from "@effect/vitest";

describe("InfraCiRunnersId leaf", () => {
  it("equals the registry composer for the same slug", () => {
    expect({
      identifier: leaf.identifier,
      iri: leaf.iri,
      curie: leaf.curie,
      made: leaf.make("Probe"),
      child: leaf.create("Reaper").make("Probe"),
    }).toStrictEqual({
      identifier: registry.identifier,
      iri: registry.iri,
      curie: registry.curie,
      made: registry.make("Probe"),
      child: registry.create("Reaper").make("Probe"),
    });
  });

  it("keeps the error tags the package mints", () => {
    expect(PlanRefused.identifier).toBe(registry.create("PlanCheck").make("PlanRefused"));
  });
});
