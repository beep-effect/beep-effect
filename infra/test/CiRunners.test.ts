import {
  CiRunnersImageConfig,
  CiRunnersNetworkConfig,
  CiRunnersPulumiConfigValues,
  CiRunnersReaperConfig,
  CiRunnersStack,
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
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as O from "@beep/utils/Option";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as pulumi from "@pulumi/pulumi";
import { Effect, MutableHashMap, pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";
import { expectSchemaRoundTrip } from "./schemaParity.ts";

const decodeCiRunnersPulumiConfigValues = S.decodeEffect(CiRunnersPulumiConfigValues);
const isCiRunnersPulumiConfigValues = S.is(CiRunnersPulumiConfigValues);
const CiRunnersPulumiConfigValuesEquivalent = S.toEquivalence(CiRunnersPulumiConfigValues);

const decodeCiRunnersNetworkConfig = S.decodeEffect(CiRunnersNetworkConfig);
const encodeUnknownCiRunnersNetworkConfig = S.encodeUnknownEffect(CiRunnersNetworkConfig);

describe("@beep/infra CiRunners", () => {
  it("applies groundwork defaults", () => {
    const args = makeCiRunnersStackArgsFromConfigValues();

    expect(args.network.region).toBe("us-east-1");
    expect(args.network.vpcCidr).toBe("10.88.0.0/16");
    expect(args.network.publicSubnetACidr).toBe("10.88.0.0/20");
    expect(args.network.publicSubnetBCidr).toBe("10.88.16.0/20");
    expect(args.network.publicSubnetCCidr).toBe("10.88.32.0/20");
    expect(args.network.publicSubnetDCidr).toBe("10.88.48.0/20");
    expect(args.network.publicSubnetECidr).toBe("10.88.64.0/20");
    expect(args.network.availabilityZoneA).toBe("us-east-1a");
    expect(args.network.availabilityZoneB).toBe("us-east-1b");
    expect(args.network.availabilityZoneC).toBe("us-east-1c");
    expect(args.network.availabilityZoneD).toBe("us-east-1d");
    // us-east-1e offers none of the fleet's instance types.
    expect(args.network.availabilityZoneE).toBe("us-east-1f");
    expect(args.worker.instanceType).toBe("m7i.2xlarge");
    expect(args.worker.rootVolumeSizeGb).toBe(100);
    expect(args.worker.maxRunMinutes).toBe(60);
    expect(args.reaper.ttlMinutes).toBe(90);
    assertNone(args.image.amiId);
    expect(args.image.ssmParameterName).toBe(
      "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id"
    );
  });

  it("maps Pulumi config overrides into groundwork args", () => {
    const args = makeCiRunnersStackArgsFromConfigValues({
      amiId: "ami-0123456789abcdef0",
      availabilityZoneA: "us-east-2a",
      availabilityZoneB: "us-east-2b",
      availabilityZoneC: "us-east-2c",
      availabilityZoneD: "us-east-2d",
      availabilityZoneE: "us-east-2e",
      awsRegion: "us-east-2",
      instanceType: "m6a.2xlarge",
      maxRunMinutes: 90,
      publicSubnetACidr: "10.99.0.0/20",
      publicSubnetBCidr: "10.99.16.0/20",
      publicSubnetCCidr: "10.99.32.0/20",
      publicSubnetDCidr: "10.99.48.0/20",
      publicSubnetECidr: "10.99.64.0/20",
      reaperTtlMinutes: 120,
      rootVolumeSizeGb: 200,
      vpcCidr: "10.99.0.0/16",
    });

    expect(O.getOrUndefined(args.image.amiId)).toBe("ami-0123456789abcdef0");
    expect(args.network.region).toBe("us-east-2");
    expect(args.network.availabilityZoneA).toBe("us-east-2a");
    expect(args.network.availabilityZoneB).toBe("us-east-2b");
    expect(args.network.availabilityZoneE).toBe("us-east-2e");
    expect(args.network.publicSubnetECidr).toBe("10.99.64.0/20");
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
    // A partial region move that leaves any later slot behind is rejected too.
    expect(() =>
      makeCiRunnersStackArgsFromConfigValues({
        availabilityZoneA: "us-east-2a",
        availabilityZoneB: "us-east-2b",
        awsRegion: "us-east-2",
      })
    ).toThrow();
  });

  it("rejects two subnet slots in one availability zone", () => {
    expect(() => makeCiRunnersStackArgsFromConfigValues({ availabilityZoneE: "us-east-1a" })).toThrow();
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
    // Overlap between any two slots counts, not only A and B.
    expect(() => makeCiRunnersStackArgsFromConfigValues({ publicSubnetECidr: "10.88.0.0/24" })).toThrow();
    // Adjacent, non-overlapping subnets inside the VPC remain valid.
    expect(
      makeCiRunnersStackArgsFromConfigValues({
        publicSubnetACidr: "10.88.80.0/20",
        publicSubnetBCidr: "10.88.96.0/20",
      }).network.publicSubnetACidr
    ).toBe("10.88.80.0/20");
  });

  it.effect(
    "provisions one public subnet per slot on the shared public route table",
    Effect.fnUntraced(function* () {
      const subnets = MutableHashMap.empty<string, unknown>();
      const routeTableSubnets = MutableHashMap.empty<string, unknown>();

      yield* Effect.acquireUseRelease(
        Effect.tryPromise(() =>
          pulumi.runtime.setMocks(
            {
              call: () => ({ accountId: "123456789012", partition: "aws", value: "ami-0123456789abcdef0" }),
              newResource: (args) => {
                if (args.type === "aws:ec2/subnet:Subnet") {
                  MutableHashMap.set(subnets, args.name, {
                    availabilityZone: args.inputs.availabilityZone,
                    cidrBlock: args.inputs.cidrBlock,
                    mapPublicIpOnLaunch: args.inputs.mapPublicIpOnLaunch,
                  });
                }
                if (args.type === "aws:ec2/routeTableAssociation:RouteTableAssociation") {
                  MutableHashMap.set(routeTableSubnets, args.name, args.inputs.subnetId);
                }
                return { id: `${args.name}-id`, state: args.inputs };
              },
            },
            "beep-ci-runners",
            "test"
          )
        ),
        () =>
          Effect.sync(() => {
            new CiRunnersStack(
              "ci-runners",
              makeCiRunnersStackArgsFromConfigValues({ amiId: "ami-0123456789abcdef0" })
            );
          }),
        () => Effect.tryPromise(() => pulumi.runtime.disconnect())
      );

      expect(MutableHashMap.size(subnets)).toBe(5);
      for (const [slot, availabilityZone, cidrBlock] of [
        ["a", "us-east-1a", "10.88.0.0/20"],
        ["b", "us-east-1b", "10.88.16.0/20"],
        ["c", "us-east-1c", "10.88.32.0/20"],
        ["d", "us-east-1d", "10.88.48.0/20"],
        ["e", "us-east-1f", "10.88.64.0/20"],
      ] as const) {
        assertSome(MutableHashMap.get(subnets, `ci-runners-public-${slot}`), {
          availabilityZone,
          cidrBlock,
          mapPublicIpOnLaunch: false,
        });
        assertSome(
          MutableHashMap.get(routeTableSubnets, `ci-runners-public-${slot}-rta`),
          `ci-runners-public-${slot}-id`
        );
      }
    })
  );

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

  it.effect(
    "decodes optional Pulumi config shape",
    Effect.fnUntraced(function* () {
      const decoded = yield* CiRunnersPulumiConfigValues.decodeEffect({
        instanceType: "m7i.2xlarge",
        rootVolumeSizeGb: 150,
      });

      expect(decoded.instanceType).toBe("m7i.2xlarge");
      expect(decoded.rootVolumeSizeGb).toBe(150);
    })
  );

  it.effect(
    "round-trips the network config through its encoded wire value",
    Effect.fnUntraced(function* () {
      // The class-level zones-within-region check makes independently generated
      // arbitraries near-impossible to satisfy, so this round-trip is deterministic.
      const network = CiRunnersNetworkConfig.make({
        availabilityZoneA: "us-east-2a",
        availabilityZoneB: "us-east-2b",
        availabilityZoneC: "us-east-2c",
        availabilityZoneD: "us-east-2d",
        availabilityZoneE: "us-east-2e",
        publicSubnetACidr: "10.99.0.0/20",
        publicSubnetBCidr: "10.99.16.0/20",
        publicSubnetCCidr: "10.99.32.0/20",
        publicSubnetDCidr: "10.99.48.0/20",
        publicSubnetECidr: "10.99.64.0/20",
        region: "us-east-2",
        vpcCidr: "10.99.0.0/16",
      });
      const equivalent = S.toEquivalence(CiRunnersNetworkConfig);

      const encoded = yield* encodeUnknownCiRunnersNetworkConfig(network);
      const decoded = yield* decodeCiRunnersNetworkConfig(encoded);

      pipe(equivalent(decoded, network), assertTrue);
    })
  );

  it.effect.prop(
    "round-trips CI runner config schemas through encoded wire values",
    [Arbitrary.schema(CiRunnersPulumiConfigValues)],
    ([value]) =>
      Effect.gen(function* () {
        const decoded = yield* decodeCiRunnersPulumiConfigValues(value);
        assertTrue(isCiRunnersPulumiConfigValues(value) && CiRunnersPulumiConfigValuesEquivalent(decoded, value));
      }),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips CiRunnersPulumiConfigValues through its encoded wire codec",
    [Arbitrary.schema(CiRunnersPulumiConfigValues)],
    ([value]) => expectSchemaRoundTrip(CiRunnersPulumiConfigValues, value),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips CiRunnersImageConfig through its encoded wire codec",
    [Arbitrary.schema(CiRunnersImageConfig)],
    ([value]) => expectSchemaRoundTrip(CiRunnersImageConfig, value),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips CiRunnersWorkerConfig through its encoded wire codec",
    [Arbitrary.schema(CiRunnersWorkerConfig)],
    ([value]) => expectSchemaRoundTrip(CiRunnersWorkerConfig, value),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips CiRunnersReaperConfig through its encoded wire codec",
    [Arbitrary.schema(CiRunnersReaperConfig)],
    ([value]) => expectSchemaRoundTrip(CiRunnersReaperConfig, value),
    { arbitrary: fcRuns(25) }
  );
});
