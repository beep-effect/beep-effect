/**
 * The provider layer of the `CostControls` stack: exactly the five resource
 * providers it declares, pinned to `us-east-1`.
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
import * as AwsExtras from "@beep/alchemy-aws-extras";
import { CredentialsStoreLive } from "alchemy/Auth/Credentials";
import * as Provider from "alchemy/Provider";
import * as Layer from "effect/Layer";
import { CostControlsRegion } from "./Config.ts";

const awsCollection = Layer.effect(
  AWS.Providers,
  Provider.collection([AWS.Budgets.Budget, AWS.CostExplorer.AnomalyMonitor, AWS.CostExplorer.AnomalySubscription])
).pipe(
  Layer.provide(
    Layer.mergeAll(
      AWS.Budgets.BudgetProvider(),
      AWS.CostExplorer.AnomalyMonitorProvider(),
      AWS.CostExplorer.AnomalySubscriptionProvider()
    )
  )
);

const extrasCollection = Layer.effect(
  AwsExtras.Providers,
  Provider.collection([
    AwsExtras.CostAllocationTag.CostAllocationTag,
    AwsExtras.ComputeOptimizerEnrollment.ComputeOptimizerEnrollment,
    AwsExtras.CostOptimizationHubEnrollment.CostOptimizationHubEnrollment,
  ])
).pipe(
  Layer.provide(
    Layer.mergeAll(
      AwsExtras.CostAllocationTag.CostAllocationTagProvider,
      AwsExtras.ComputeOptimizerEnrollment.ComputeOptimizerEnrollmentProvider,
      AwsExtras.CostOptimizationHubEnrollment.CostOptimizationHubEnrollmentProvider
    )
  )
);

/**
 * Providers for every resource the stack declares, and nothing else.
 *
 * **Details**
 *
 * `AWS.providers()` registers several hundred providers plus Docker and the
 * Lambda assets bucket; this stack needs five. Registering only those keeps
 * the deploy role's policy honest: nothing outside Budgets, Cost Explorer,
 * Compute Optimizer and Cost Optimization Hub can be called. The region is
 * pinned with `AWS.Region.of("us-east-1")` instead of read from the
 * environment, because Budgets and Cost Explorer are global services served
 * from `us-east-1` and Cost Optimization Hub answers only there. Credentials
 * and the account resolve exactly as `AWS.providers()` resolves them: a
 * provided `AWSEnvironment` wins, otherwise CI credentials or the ambient
 * environment.
 *
 * **Example** (Use as a stack's providers)
 *
 * ```ts
 * import { providers } from "@beep/infra-cost-controls/Providers"
 *
 * console.log(typeof providers) // "object"
 * ```
 *
 * @category providers
 * @since 0.0.0
 */
export const providers = Layer.mergeAll(awsCollection, extrasCollection).pipe(
  Layer.provideMerge(AwsRegion.of(CostControlsRegion.Enum["us-east-1"])),
  Layer.provideMerge(Layer.fresh(AwsCredentials.fromEnvironment)),
  Layer.provideMerge(Layer.fresh(AwsEndpoint.fromEnvironment)),
  Layer.provideMerge(providedOrDefault()),
  Layer.provideMerge(AwsAuth),
  Layer.provideMerge(CredentialsStoreLive),
  Layer.orDie
);
