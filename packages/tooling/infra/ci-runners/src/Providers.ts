/**
 * The provider layer of the `CiRunners` stack: exactly the resource
 * providers it declares, pinned to `us-east-1`, plus the fleet services the
 * `RunnerSweep` provider needs when it deletes.
 *
 * @packageDocumentation
 * @category providers
 * @since 0.0.0
 */

import * as AWS from "@alchemy.run/aws";
import { AwsAuth } from "@alchemy.run/aws/AuthProvider";
import * as AwsCredentials from "@alchemy.run/aws/Credentials";
import * as AwsEndpoint from "@alchemy.run/aws/Endpoint";
import { providedOrDefault } from "@alchemy.run/aws/Environment";
import * as AwsRegion from "@alchemy.run/aws/Region";
import { DockerLive } from "@alchemy.run/docker/Docker";
import * as AwsExtras from "@beep/alchemy-aws-extras";
import { ec2FleetLive, ssmStoreLive } from "@beep/alchemy-github-runners/Aws.layer";
import { GitHubLiveOptions, gitHubAppAuthLive, gitHubRunnersLive } from "@beep/alchemy-github-runners/GitHubApp.layer";
import { RunnerSweepProvider } from "@beep/alchemy-github-runners/RunnerSweep";
import { appParameterNames } from "@beep/alchemy-github-runners/SsmParameters.models";
import { CredentialsStoreLive } from "alchemy/Auth/Credentials";
import * as Provider from "alchemy/Provider";
import { Stage } from "alchemy/Stage";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { FleetRegion } from "./Config.ts";
import { physicalNames } from "./Names.ts";

/**
 * Every Alchemy-shipped resource type the stack declares, directly or
 * through `RunnerFleet`.
 *
 * **Example** (Count the shipped types)
 *
 * ```ts
 * import { shippedResources } from "@beep/infra-ci-runners/Providers"
 *
 * console.log(shippedResources.length) // 22
 * ```
 *
 * @category providers
 * @since 0.0.0
 */
export const shippedResources = [
  AWS.EC2.Vpc,
  AWS.EC2.Subnet,
  AWS.EC2.InternetGateway,
  AWS.EC2.RouteTable,
  AWS.EC2.Route,
  AWS.EC2.RouteTableAssociation,
  AWS.EC2.SecurityGroup,
  AWS.EC2.DefaultSecurityGroup,
  AWS.EC2.FlowLog,
  AWS.Logs.LogGroup,
  AWS.IAM.Role,
  AWS.IAM.Policy,
  AWS.IAM.InstanceProfile,
  AWS.KMS.Key,
  AWS.KMS.Alias,
  AWS.SSM.Parameter,
  AWS.S3.Bucket,
  AWS.SQS.Queue,
  AWS.Lambda.Function,
  AWS.Lambda.EventSourceMapping,
  AWS.Lambda.Permission,
  AWS.EventBridge.Rule,
];

const awsCollection = Layer.effect(AWS.Providers, Provider.collection(shippedResources)).pipe(
  Layer.provide(
    Layer.mergeAll(
      AWS.EC2.VpcProvider(),
      AWS.EC2.SubnetProvider(),
      AWS.EC2.InternetGatewayProvider(),
      AWS.EC2.RouteTableProvider(),
      AWS.EC2.RouteProvider(),
      AWS.EC2.RouteTableAssociationProvider(),
      AWS.EC2.SecurityGroupProvider(),
      AWS.EC2.DefaultSecurityGroupProvider(),
      AWS.EC2.FlowLogProvider(),
      AWS.Logs.LogGroupProvider(),
      AWS.IAM.RoleProvider(),
      AWS.IAM.PolicyProvider(),
      AWS.IAM.InstanceProfileProvider(),
      AWS.KMS.KeyProvider(),
      AWS.KMS.AliasProvider(),
      AWS.SSM.ParameterProvider(),
      AWS.S3.BucketProvider(),
      AWS.SQS.QueueProvider(),
      AWS.Lambda.FunctionProvider(),
      AWS.Lambda.EventSourceMappingProvider(),
      AWS.Lambda.PermissionProvider(),
      AWS.EventBridge.RuleProvider()
    )
  )
);

const extrasCollection = Layer.effect(
  AwsExtras.Providers,
  Provider.collection([AwsExtras.RunnerLaunchTemplate.RunnerLaunchTemplate])
).pipe(Layer.provide(AwsExtras.RunnerLaunchTemplate.RunnerLaunchTemplateProvider));

/**
 * The `RunnerSweep` provider over live fleet services for the stage's App
 * parameters. Building it makes no call; the sweep reads the App key from
 * the fleet's SSM parameters only when it deletes.
 *
 * **Example** (Reference the layer)
 *
 * ```ts
 * import { sweepProvider } from "@beep/infra-ci-runners/Providers"
 *
 * console.log(typeof sweepProvider) // "object"
 * ```
 *
 * @category providers
 * @since 0.0.0
 */
export const sweepProvider = Layer.unwrap(
  Effect.gen(function* () {
    const stage = yield* Stage;
    const options = GitHubLiveOptions.make({
      app: appParameterNames(physicalNames(stage).ssmRoot),
      apiBaseUrl: "https://api.github.com",
      userAgent: "beep-infra-ci-runners",
    });
    const services = Layer.mergeAll(gitHubAppAuthLive(options), gitHubRunnersLive(options)).pipe(
      Layer.provideMerge(Layer.mergeAll(ec2FleetLive, ssmStoreLive))
    );
    return RunnerSweepProvider.pipe(Layer.provide(services));
  })
);

/**
 * Providers for every resource the stack declares, and nothing else.
 *
 * **Details**
 *
 * Registering only these keeps the deploy role's policy honest. The region
 * is pinned with `AWS.Region.of("us-east-1")`; credentials and the account
 * resolve as `AWS.providers()` resolves them. No Lambda assets bucket is
 * provided, so each function's bundle is uploaded inline with its create or
 * update call.
 *
 * **Example** (Use as a stack's providers)
 *
 * ```ts
 * import { providers } from "@beep/infra-ci-runners/Providers"
 *
 * console.log(typeof providers) // "object"
 * ```
 *
 * @category providers
 * @since 0.0.0
 */
export const providers = Layer.mergeAll(awsCollection, extrasCollection, sweepProvider).pipe(
  Layer.provideMerge(DockerLive),
  Layer.provideMerge(AwsRegion.of(FleetRegion.Enum["us-east-1"])),
  Layer.provideMerge(Layer.fresh(AwsCredentials.fromEnvironment)),
  Layer.provideMerge(Layer.fresh(AwsEndpoint.fromEnvironment)),
  Layer.provideMerge(providedOrDefault()),
  Layer.provideMerge(AwsAuth),
  Layer.provideMerge(CredentialsStoreLive),
  Layer.orDie
);
