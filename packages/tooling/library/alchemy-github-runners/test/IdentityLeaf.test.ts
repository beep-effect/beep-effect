import { Ec2Fleet } from "@beep/alchemy-github-runners/Ec2Fleet.service";
import { $AlchemyGithubRunnersId as leaf } from "@beep/alchemy-github-runners/internal/AlchemyGithubRunnersId";
import { GitHubApiError } from "@beep/alchemy-github-runners/RunnerFleet.errors";
import { $AlchemyGithubRunnersId as registry } from "@beep/identity/packages";
import { describe, expect, it } from "@effect/vitest";

describe("AlchemyGithubRunnersId leaf", () => {
  it("equals the registry composer for the same slug", () => {
    expect({
      identifier: leaf.identifier,
      iri: leaf.iri,
      curie: leaf.curie,
      made: leaf.make("Probe"),
      child: leaf.create("RunnerFleet.errors").make("Probe"),
    }).toStrictEqual({
      identifier: registry.identifier,
      iri: registry.iri,
      curie: registry.curie,
      made: registry.make("Probe"),
      child: registry.create("RunnerFleet.errors").make("Probe"),
    });
  });

  it("keeps the error tags and service keys the package mints", () => {
    expect({ error: GitHubApiError.identifier, service: Ec2Fleet.key }).toStrictEqual({
      error: registry.create("RunnerFleet.errors").make("GitHubApiError"),
      service: registry.create("Ec2Fleet.service").make("Ec2Fleet"),
    });
  });
});
