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
import { assertFalse, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as pulumi from "@pulumi/pulumi";
import { Deferred, Effect, MutableHashMap, pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { expectSchemaRoundTrip } from "./schemaParity.ts";

const decodeCiRunnersPulumiConfigValues = S.decodeEffect(CiRunnersPulumiConfigValues);
const isCiRunnersPulumiConfigValues = S.is(CiRunnersPulumiConfigValues);
const CiRunnersPulumiConfigValuesEquivalent = S.toEquivalence(CiRunnersPulumiConfigValues);

const subnetSlots = ["a", "b", "c", "d", "e"];

type StackProbe = {
  readonly associationGate: Deferred.Deferred<void>;
  readonly routedSubnetId: (slot: string) => Deferred.Deferred<string>;
};

// Builds the stack under Pulumi mocks. The association of `heldSlot` stays
// unregistered until `associationGate` opens, so `observe` can watch which
// exported subnet ids resolve before that slot is routed.
const provisionCiRunnersStack = Effect.fnUntraced(function* (
  heldSlot: string,
  observe: (probe: StackProbe) => Effect.Effect<void>
) {
  const subnets = MutableHashMap.empty<string, unknown>();
  const routeTableSubnets = MutableHashMap.empty<string, unknown>();
  const routedSubnetIds = MutableHashMap.fromIterable(
    A.map(subnetSlots, (slot) => [slot, Deferred.makeUnsafe<string>()] as const)
  );
  const associationGate = Deferred.makeUnsafe<void>();
  const heldAssociationName = `ci-runners-public-${heldSlot}-rta`;
  const runPromise = Effect.runPromiseWith(yield* Effect.context());
  const probe: StackProbe = {
    associationGate,
    routedSubnetId: (slot) => O.getOrThrow(MutableHashMap.get(routedSubnetIds, slot)),
  };

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
            const result = { id: `${args.name}-id`, state: args.inputs };
            return args.name === heldAssociationName
              ? runPromise(Deferred.await(associationGate).pipe(Effect.as(result)))
              : result;
          },
        },
        "beep-ci-runners",
        "test"
      )
    ),
    () =>
      Effect.suspend(() => {
        const stack = new CiRunnersStack(
          "ci-runners",
          makeCiRunnersStackArgsFromConfigValues({ amiId: "ami-0123456789abcdef0" })
        );
        A.forEach(
          A.zip(subnetSlots, [
            stack.publicSubnetAId,
            stack.publicSubnetBId,
            stack.publicSubnetCId,
            stack.publicSubnetDId,
            stack.publicSubnetEId,
          ]),
          ([slot, subnetId]) =>
            subnetId.apply((id) => Deferred.doneUnsafe(probe.routedSubnetId(slot), Effect.succeed(id)))
        );
        return observe(probe);
      }),
    // Open the gate before disconnecting: an assertion that fails while the
    // held association is still pending must not leave teardown waiting on it.
    () =>
      Deferred.succeed(associationGate, undefined).pipe(
        Effect.andThen(Effect.tryPromise(() => pulumi.runtime.disconnect()))
      )
  );

  return { routeTableSubnets, subnets };
});

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

  // One stack build covers both properties: Pulumi mocks are process-global,
  // so two concurrently running mock tests would steal each other's resources.
  it.effect(
    "provisions one routed public subnet per slot and withholds each id until its association exists",
    Effect.fnUntraced(function* () {
      const { routeTableSubnets, subnets } = yield* provisionCiRunnersStack(
        "c",
        Effect.fnUntraced(function* (probe) {
          for (const slot of ["a", "b", "d", "e"]) {
            // The exported id is the subnet id itself, not the association id.
            expect(yield* Deferred.await(probe.routedSubnetId(slot))).toBe(`ci-runners-public-${slot}-id`);
          }
          // Slot C's subnet exists, but its association is still unregistered.
          pipe(yield* Deferred.isDone(probe.routedSubnetId("c")), assertFalse);

          yield* Deferred.succeed(probe.associationGate, undefined);
          expect(yield* Deferred.await(probe.routedSubnetId("c"))).toBe("ci-runners-public-c-id");
        })
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
