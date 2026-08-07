import {
  CiRunnersImageConfig,
  CiRunnersNetworkConfig,
  CiRunnersPulumiConfigValues,
  CiRunnersReaperConfig,
  CiRunnersStackArgs,
  CiRunnersWorkerConfig,
  ciRunnersInfraTagValue,
  ciRunnersLaunchTemplateName,
  ciRunnersReaperFunctionName,
  ciRunnersRunnerTagKey,
  ciRunnersRunnerTagValue,
  ciRunnersWorkerSecurityGroupName,
  makeCiRunnersStackArgsFromConfigValues,
} from "@beep/infra";
import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils";
import * as O from "@beep/utils/Option";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";
import { expectSchemaRoundTrip } from "./schemaParity.ts";

describe("@beep/infra CiRunners", () => {
  it("applies groundwork defaults", () => {
    const args = makeCiRunnersStackArgsFromConfigValues();

    expect(args.network.region).toBe("us-east-1");
    expect(args.network.vpcCidr).toBe("10.88.0.0/16");
    expect(args.network.publicSubnetACidr).toBe("10.88.0.0/20");
    expect(args.network.publicSubnetBCidr).toBe("10.88.16.0/20");
    expect(args.network.availabilityZoneA).toBe("us-east-1a");
    expect(args.network.availabilityZoneB).toBe("us-east-1b");
    expect(args.worker.instanceType).toBe("m7i.2xlarge");
    expect(args.worker.rootVolumeSizeGb).toBe(100);
    expect(args.worker.maxRunMinutes).toBe(60);
    expect(args.reaper.ttlMinutes).toBe(90);
    expect(O.isNone(args.image.amiId)).toBe(true);
    expect(args.image.ssmParameterName).toBe(
      "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id"
    );
  });

  it("maps Pulumi config overrides into groundwork args", () => {
    const args = makeCiRunnersStackArgsFromConfigValues({
      amiId: "ami-0123456789abcdef0",
      availabilityZoneA: "us-east-2a",
      availabilityZoneB: "us-east-2b",
      awsRegion: "us-east-2",
      instanceType: "m6a.2xlarge",
      maxRunMinutes: 90,
      publicSubnetACidr: "10.99.0.0/20",
      publicSubnetBCidr: "10.99.16.0/20",
      reaperTtlMinutes: 120,
      rootVolumeSizeGb: 200,
      vpcCidr: "10.99.0.0/16",
    });

    expect(O.getOrUndefined(args.image.amiId)).toBe("ami-0123456789abcdef0");
    expect(args.network.region).toBe("us-east-2");
    expect(args.network.availabilityZoneA).toBe("us-east-2a");
    expect(args.network.availabilityZoneB).toBe("us-east-2b");
    expect(args.network.vpcCidr).toBe("10.99.0.0/16");
    expect(args.worker.instanceType).toBe("m6a.2xlarge");
    expect(args.worker.rootVolumeSizeGb).toBe(200);
    expect(args.worker.maxRunMinutes).toBe(90);
    expect(args.reaper.ttlMinutes).toBe(120);
  });

  it("rejects malformed config values", () => {
    expect(() => makeCiRunnersStackArgsFromConfigValues({ amiId: "not-an-ami" })).toThrow();
    expect(() => makeCiRunnersStackArgsFromConfigValues({ vpcCidr: "10.88.0.0" })).toThrow();
    expect(() => makeCiRunnersStackArgsFromConfigValues({ instanceType: "metal" })).toThrow();
    expect(() => makeCiRunnersStackArgsFromConfigValues({ rootVolumeSizeGb: 4 })).toThrow();
    expect(() => makeCiRunnersStackArgsFromConfigValues({ maxRunMinutes: 0 })).toThrow();
    expect(() => makeCiRunnersStackArgsFromConfigValues({ reaperTtlMinutes: 5 })).toThrow();
  });

  it("rejects availability zones outside the configured region", () => {
    // Region override alone leaves the default us-east-1 zones stranded.
    expect(() => makeCiRunnersStackArgsFromConfigValues({ awsRegion: "us-east-2" })).toThrow();
    // Zone override outside the default region is equally rejected.
    expect(() => makeCiRunnersStackArgsFromConfigValues({ availabilityZoneA: "us-west-2a" })).toThrow();
  });

  it("rejects subnet geometry outside the VPC or overlapping", () => {
    // VPC override alone strands the default 10.88.x subnets outside it.
    expect(() => makeCiRunnersStackArgsFromConfigValues({ vpcCidr: "10.99.0.0/16" })).toThrow();
    // A subnet outside the default VPC CIDR is rejected.
    expect(() => makeCiRunnersStackArgsFromConfigValues({ publicSubnetACidr: "192.168.0.0/20" })).toThrow();
    // Overlapping subnets are rejected even when both sit inside the VPC.
    expect(() =>
      makeCiRunnersStackArgsFromConfigValues({
        publicSubnetACidr: "10.88.0.0/20",
        publicSubnetBCidr: "10.88.8.0/21",
      })
    ).toThrow();
    // Adjacent, non-overlapping subnets inside the VPC remain valid.
    expect(
      makeCiRunnersStackArgsFromConfigValues({
        publicSubnetACidr: "10.88.32.0/20",
        publicSubnetBCidr: "10.88.48.0/20",
      }).network.publicSubnetACidr
    ).toBe("10.88.32.0/20");
  });

  it("keeps stack args import-safe", () => {
    const args = CiRunnersStackArgs.make({});

    expect(args.worker.instanceType).toBe("m7i.2xlarge");
    expect(args.network.vpcCidr).toBe("10.88.0.0/16");
    expect(args.reaper.ttlMinutes).toBe(90);
  });

  it("exports the launcher kill-tag pair and stable AWS-side names", () => {
    expect(ciRunnersRunnerTagKey).toBe("beep-ci");
    expect(ciRunnersRunnerTagValue).toBe("runner");
    expect(ciRunnersInfraTagValue).toBe("runner-infra");
    expect(ciRunnersLaunchTemplateName).toBe("beep-ci-runner");
    expect(ciRunnersWorkerSecurityGroupName).toBe("beep-ci-runner-workers");
    expect(ciRunnersReaperFunctionName).toBe("beep-ci-runner-reaper");
  });

  it("decodes optional Pulumi config shape", () => {
    const decoded = Effect.runSync(
      CiRunnersPulumiConfigValues.decodeEffect({ instanceType: "m7i.2xlarge", rootVolumeSizeGb: 150 })
    );

    expect(decoded.instanceType).toBe("m7i.2xlarge");
    expect(decoded.rootVolumeSizeGb).toBe(150);
  });

  it("round-trips the network config through its encoded wire value", () => {
    // The class-level zones-within-region check makes independently generated
    // arbitraries near-impossible to satisfy, so this round-trip is deterministic.
    const network = CiRunnersNetworkConfig.make({
      availabilityZoneA: "us-east-2a",
      availabilityZoneB: "us-east-2b",
      publicSubnetACidr: "10.99.0.0/20",
      publicSubnetBCidr: "10.99.16.0/20",
      region: "us-east-2",
      vpcCidr: "10.99.0.0/16",
    });
    const equivalent = S.toEquivalence(CiRunnersNetworkConfig);

    const encoded = Effect.runSync(S.encodeUnknownEffect(CiRunnersNetworkConfig)(network));
    const decoded = Effect.runSync(S.decodeUnknownEffect(CiRunnersNetworkConfig)(encoded));

    expect(equivalent(decoded, network)).toBe(true);
  });

  it("round-trips CI runner config schemas through encoded wire values", () => {
    assertSchemaArbitraryDecodesToSelf(CiRunnersPulumiConfigValues, { numRuns: 25 });
    expectSchemaRoundTrip(CiRunnersPulumiConfigValues);
    expectSchemaRoundTrip(CiRunnersImageConfig);
    expectSchemaRoundTrip(CiRunnersWorkerConfig);
    expectSchemaRoundTrip(CiRunnersReaperConfig);
  });
});
