import { RunnerLaunchTemplate, resolveSsmImageId } from "@beep/alchemy-aws-extras/RunnerLaunchTemplate";
import { describe, expect } from "@effect/vitest";
import { adopt } from "alchemy/AdoptPolicy";
import * as Effect from "effect/Effect";
import * as FakeAws from "./support/FakeAws.ts";

const fleetProps = {
  launchTemplateName: "beep-ci-runners",
  imageId: resolveSsmImageId("/beep-ci/runner-ami-id"),
  instanceProfileName: "beep-ci-runner",
  securityGroupIds: ["sg-0123456789abcdef0"],
  associatePublicIpAddress: true,
  userData: "#!/bin/bash\necho ready\n",
  ebsOptimized: true,
  instanceInitiatedShutdownBehavior: "terminate",
  blockDeviceMappings: [
    {
      deviceName: "/dev/xvda",
      ebs: {
        volumeSize: 100,
        volumeType: "gp3",
        iops: 3000,
        throughput: 250,
        encrypted: true,
        deleteOnTermination: true,
      },
    },
  ],
  instanceMarketOptions: {
    marketType: "spot",
    spotOptions: { spotInstanceType: "one-time", instanceInterruptionBehavior: "terminate" },
  },
  metadataOptions: {
    httpEndpoint: "enabled",
    httpTokens: "required",
    httpPutResponseHopLimit: 1,
    instanceMetadataTags: "enabled",
  },
  tagSpecifications: [{ resourceType: "instance", tags: { "beep-ci": "runner" } }],
  tags: { App: "ci-runners", Project: "beep-ci" },
} as const;

const defaultVersion = (harness: ReturnType<typeof FakeAws.harness>, name: string) => {
  const template = harness.findLaunchTemplate(name);
  return template === undefined ? undefined : template.versions[template.defaultVersion - 1];
};

describe("RunnerLaunchTemplate", () => {
  const lifecycle = FakeAws.harness();
  lifecycle.provider("creates, updates, reads and deletes the runner template", (stack) =>
    Effect.gen(function* () {
      const { account } = lifecycle;

      const created = yield* stack.deploy(RunnerLaunchTemplate("Runners", fleetProps));
      expect(created).toMatchObject({
        launchTemplateName: "beep-ci-runners",
        launchTemplateArn: `arn:aws:ec2:${FakeAws.region}:${FakeAws.accountId}:launch-template/${created.launchTemplateId}`,
        defaultVersionNumber: 1,
        latestVersionNumber: 1,
        tags: { App: "ci-runners", Project: "beep-ci", "alchemy::id": "Runners" },
      });
      expect(defaultVersion(lifecycle, "beep-ci-runners")).toEqual({
        "BlockDeviceMapping.1.DeviceName": "/dev/xvda",
        "BlockDeviceMapping.1.Ebs.DeleteOnTermination": "true",
        "BlockDeviceMapping.1.Ebs.Encrypted": "true",
        "BlockDeviceMapping.1.Ebs.Iops": "3000",
        "BlockDeviceMapping.1.Ebs.Throughput": "250",
        "BlockDeviceMapping.1.Ebs.VolumeSize": "100",
        "BlockDeviceMapping.1.Ebs.VolumeType": "gp3",
        EbsOptimized: "true",
        "IamInstanceProfile.Name": "beep-ci-runner",
        ImageId: "resolve:ssm:/beep-ci/runner-ami-id",
        InstanceInitiatedShutdownBehavior: "terminate",
        "InstanceMarketOptions.MarketType": "spot",
        "InstanceMarketOptions.SpotOptions.InstanceInterruptionBehavior": "terminate",
        "InstanceMarketOptions.SpotOptions.SpotInstanceType": "one-time",
        "MetadataOptions.HttpEndpoint": "enabled",
        "MetadataOptions.HttpPutResponseHopLimit": "1",
        "MetadataOptions.HttpTokens": "required",
        "MetadataOptions.InstanceMetadataTags": "enabled",
        "NetworkInterface.1.AssociatePublicIpAddress": "true",
        "NetworkInterface.1.DeleteOnTermination": "true",
        "NetworkInterface.1.DeviceIndex": "0",
        "NetworkInterface.1.SecurityGroupId.1": "sg-0123456789abcdef0",
        "TagSpecification.1.ResourceType": "instance",
        "TagSpecification.1.Tag.1.Key": "beep-ci",
        "TagSpecification.1.Tag.1.Value": "runner",
        UserData: "IyEvYmluL2Jhc2gKZWNobyByZWFkeQo=",
      });

      account.calls.length = 0;
      const unchanged = yield* stack.deploy(RunnerLaunchTemplate("Runners", fleetProps));
      expect(unchanged.launchTemplateId).toBe(created.launchTemplateId);
      expect(FakeAws.operations(account)).not.toContain("CreateLaunchTemplateVersion");

      account.calls.length = 0;
      const retagged = yield* stack.deploy(
        RunnerLaunchTemplate("Runners", { ...fleetProps, tags: { ...fleetProps.tags, Owner: "ci" } })
      );
      expect(FakeAws.operations(account)).not.toContain("CreateLaunchTemplateVersion");
      expect(FakeAws.operations(account)).toContain("CreateTags");
      expect(retagged.defaultVersionNumber).toBe(1);
      expect(retagged.tags).toMatchObject({ Owner: "ci" });

      const updated = yield* stack.deploy(
        RunnerLaunchTemplate("Runners", {
          ...fleetProps,
          blockDeviceMappings: [
            { deviceName: "/dev/xvda", ebs: { volumeSize: 200, volumeType: "gp3", encrypted: true } },
          ],
          tags: { App: "ci-runners" },
        })
      );
      expect(updated.launchTemplateId).toBe(created.launchTemplateId);
      expect(updated.defaultVersionNumber).toBe(2);
      expect(updated.latestVersionNumber).toBe(2);
      expect(updated.tags).not.toHaveProperty("Project");
      expect(defaultVersion(lifecycle, "beep-ci-runners")).toMatchObject({
        "BlockDeviceMapping.1.Ebs.VolumeSize": "200",
        InstanceInitiatedShutdownBehavior: "terminate",
      });

      yield* stack.destroy();
      expect(lifecycle.findLaunchTemplate("beep-ci-runners")).toBeUndefined();
    })
  );

  const replace = FakeAws.harness();
  replace.provider("replaces the template when its name changes", (stack) =>
    Effect.gen(function* () {
      const first = yield* stack.deploy(RunnerLaunchTemplate("Runners", fleetProps));
      const second = yield* stack.deploy(
        RunnerLaunchTemplate("Runners", { ...fleetProps, launchTemplateName: "beep-ci-runners-v2" })
      );
      expect(second.launchTemplateId).not.toBe(first.launchTemplateId);
      expect(replace.findLaunchTemplate("beep-ci-runners")).toBeUndefined();
      expect(replace.findLaunchTemplate("beep-ci-runners-v2")).toBeDefined();
    })
  );

  const generated = FakeAws.harness();
  generated.provider("generates a physical name when none is given", (stack) =>
    Effect.gen(function* () {
      const { launchTemplateName: _name, ...rest } = fleetProps;
      const created = yield* stack.deploy(RunnerLaunchTemplate("Runners", rest));
      expect(created.launchTemplateName).toMatch(/runners/);
    })
  );

  const foreign = FakeAws.harness();
  foreign.provider("refuses an unowned same-name template unless adopted", (stack) =>
    Effect.gen(function* () {
      const { account } = foreign;
      const existingId = foreign.seedLaunchTemplate("beep-ci-runners", { Owner: "pulumi" });

      const refused = yield* FakeAws.deployFailure(stack)(RunnerLaunchTemplate("Runners", fleetProps));
      expect(FakeAws.failureTags(refused)).toContain("OwnedBySomeoneElse");
      expect(FakeAws.operations(account)).not.toContain("CreateLaunchTemplateVersion");

      const adopted = yield* stack.deploy(RunnerLaunchTemplate("Runners", fleetProps).pipe(adopt(true)));
      expect(adopted.launchTemplateId).toBe(existingId);
      expect(adopted.defaultVersionNumber).toBe(2);
      expect(adopted.tags).toMatchObject({ "alchemy::id": "Runners", App: "ci-runners" });
      expect(adopted.tags).not.toHaveProperty("Owner");
    })
  );

  const invalid = FakeAws.harness();
  invalid.provider("rejects an out-of-range IMDS hop limit before calling AWS", (stack) =>
    Effect.gen(function* () {
      const error = yield* FakeAws.deployFailure(stack)(
        RunnerLaunchTemplate("Runners", { ...fleetProps, metadataOptions: { httpPutResponseHopLimit: 0 } })
      );
      expect(FakeAws.failureTags(error)).toContain("InvalidResourceProps");
      expect(FakeAws.operations(invalid.account)).not.toContain("CreateLaunchTemplate");
    })
  );
});
