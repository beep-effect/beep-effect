/**
 * Provider collection for every `@beep/alchemy-aws-extras` resource.
 *
 * @packageDocumentation
 * @category providers
 * @since 0.0.0
 */

import { AwsAuth } from "@alchemy.run/aws/AuthProvider";
import * as AwsCredentials from "@alchemy.run/aws/Credentials";
import * as AwsEndpoint from "@alchemy.run/aws/Endpoint";
import { providedOrDefault } from "@alchemy.run/aws/Environment";
import * as AwsRegion from "@alchemy.run/aws/Region";
import { CredentialsStoreLive } from "alchemy/Auth/Credentials";
import * as Provider from "alchemy/Provider";
import * as Layer from "effect/Layer";
import { ComputeOptimizerEnrollment, ComputeOptimizerEnrollmentProvider } from "./ComputeOptimizerEnrollment.ts";
import { CostAllocationTag, CostAllocationTagProvider } from "./CostAllocationTag.ts";
import {
  CostOptimizationHubEnrollment,
  CostOptimizationHubEnrollmentProvider,
} from "./CostOptimizationHubEnrollment.ts";
import { RunnerLaunchTemplate, RunnerLaunchTemplateProvider } from "./RunnerLaunchTemplate.ts";

/**
 * Provider collection service for this package.
 *
 * @category providers
 * @since 0.0.0
 */
export class Providers extends Provider.ProviderCollection<Providers>()("BeepAWS") {}

/**
 * Register every resource provider in this package, pinned to one AWS
 * environment.
 *
 * **Details**
 *
 * The environment resolves exactly as `AWS.providers()` resolves it: a
 * provided `AWSEnvironment` wins, otherwise the configured profile, CI
 * credentials or the ambient AWS environment. Compose it beside
 * `AWS.providers()` in a stack's `providers`.
 *
 * **Example** (Compose beside the Alchemy AWS providers)
 *
 * ```ts
 * import * as AwsExtras from "@beep/alchemy-aws-extras/Providers"
 *
 * const layer = AwsExtras.providers
 * console.log(typeof layer) // "object"
 * ```
 *
 * @category providers
 * @since 0.0.0
 */
export const providers = Layer.effect(
  Providers,
  Provider.collection([
    CostAllocationTag,
    ComputeOptimizerEnrollment,
    CostOptimizationHubEnrollment,
    RunnerLaunchTemplate,
  ])
).pipe(
  Layer.provide(
    Layer.mergeAll(
      CostAllocationTagProvider,
      ComputeOptimizerEnrollmentProvider,
      CostOptimizationHubEnrollmentProvider,
      RunnerLaunchTemplateProvider
    )
  ),
  Layer.provideMerge(Layer.fresh(AwsRegion.fromEnvironment)),
  Layer.provideMerge(Layer.fresh(AwsCredentials.fromEnvironment)),
  Layer.provideMerge(Layer.fresh(AwsEndpoint.fromEnvironment)),
  Layer.provideMerge(providedOrDefault()),
  Layer.provideMerge(AwsAuth),
  Layer.provideMerge(CredentialsStoreLive),
  Layer.orDie
);
