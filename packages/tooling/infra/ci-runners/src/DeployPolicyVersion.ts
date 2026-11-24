/**
 * Which CiRunners deploy role policy version a generator run writes, stated
 * explicitly so a run can never silently write the step-0 document.
 *
 * @since 0.0.0
 */
import { Fn, LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { $InfraCiRunnersId } from "./internal/InfraCiRunnersId.ts";

const $I = $InfraCiRunnersId.create("DeployPolicyVersion");

/**
 * Which deploy role policy a generator run writes: `v1`, the step-0 document
 * from before the fleet VPC existed, or `v2`, the document with the
 * VPC-scoped default-group grant that the live role holds once step 1b ran.
 *
 * **Example** (List the versions)
 *
 * ```ts
 * import { DeployPolicyVersion } from "@beep/infra-ci-runners/DeployPolicyVersion"
 *
 * console.log(DeployPolicyVersion.literals) // ["v1", "v2"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DeployPolicyVersion = LiteralKit(["v1", "v2"]).pipe(
  $I.annoteSchema("DeployPolicyVersion", { description: "The deploy role policy version a generator run writes." })
);

/**
 * @category models
 * @since 0.0.0
 */
export type DeployPolicyVersion = typeof DeployPolicyVersion.Type;

/**
 * What a generator run states: the fleet VPC ARN, if given, and whether it
 * explicitly targets the pre-VPC document.
 *
 * **Example** (A run with the VPC ARN)
 *
 * ```ts
 * import { DeployPolicyVersionRequest } from "@beep/infra-ci-runners/DeployPolicyVersion"
 * import * as O from "effect/Option"
 *
 * const request = DeployPolicyVersionRequest.make({ vpcArn: O.some("arn:aws:ec2:us-east-1:123456789012:vpc/vpc-1"), beforeVpc: false })
 * console.log(request.beforeVpc) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeployPolicyVersionRequest extends S.Opaque<
  DeployPolicyVersionRequest,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    vpcArn: S.Option(S.String),
    beforeVpc: S.Boolean,
  }).pipe(
    $I.annoteSchema("DeployPolicyVersionRequest", {
      description:
        "The fleet VPC ARN a deploy role policy generator run names, and whether it targets the pre-VPC document.",
    })
  )
) {}

/**
 * A generator run named neither or both of the fleet VPC ARN and the
 * pre-VPC opt-out, so it cannot say which version it writes; nothing was
 * written.
 *
 * **Example** (Construct the refusal)
 *
 * ```ts
 * import { DeployPolicyVersionUnstated } from "@beep/infra-ci-runners/DeployPolicyVersion"
 *
 * console.log(DeployPolicyVersionUnstated.make({ reason: "no --vpc-arn" })._tag) // "DeployPolicyVersionUnstated"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DeployPolicyVersionUnstated extends S.TaggedError<
  DeployPolicyVersionUnstated,
  { readonly brand: unique symbol }
>($I`DeployPolicyVersionUnstated`)(
  "DeployPolicyVersionUnstated",
  { reason: S.String },
  $I.annoteError<DeployPolicyVersionUnstated>("DeployPolicyVersionUnstated", {
    title: "Deploy policy version unstated",
    description:
      "A deploy role policy generator run named neither or both of the fleet VPC ARN and the pre-VPC opt-out.",
  })
) {}

/**
 * The schema of {@link deployPolicyVersion}: a run's request in, its version
 * out, {@link DeployPolicyVersionUnstated} when the request states neither or
 * both.
 *
 * **Example** (Read the output schema)
 *
 * ```ts
 * import { DeployPolicyVersionSelection } from "@beep/infra-ci-runners/DeployPolicyVersion"
 *
 * console.log(typeof DeployPolicyVersionSelection.implementEffect) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DeployPolicyVersionSelection = Fn({
  input: DeployPolicyVersionRequest,
  output: DeployPolicyVersion,
  error: DeployPolicyVersionUnstated,
}).pipe(
  $I.annoteSchema("DeployPolicyVersionSelection", {
    description:
      "Selects the deploy role policy version a generator run writes, refusing an unstated or contradictory run.",
  })
);

/**
 * The version a generator run writes, stated explicitly. A run with the fleet
 * VPC ARN writes `v2`; only an explicit `beforeVpc` run, for a stage whose VPC
 * does not exist yet, writes `v1`. Leaving both out fails instead of silently
 * writing `v1`, whose managed-policy chunks differ from the live role's once
 * the VPC exists.
 *
 * **Example** (A run with the VPC ARN)
 *
 * ```ts
 * import { DeployPolicyVersionRequest, deployPolicyVersion } from "@beep/infra-ci-runners/DeployPolicyVersion"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const version = Effect.runSync(
 *   deployPolicyVersion(
 *     DeployPolicyVersionRequest.make({ vpcArn: O.some("arn:aws:ec2:us-east-1:123456789012:vpc/vpc-1"), beforeVpc: false })
 *   )
 * )
 * console.log(version) // "v2"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const deployPolicyVersion = DeployPolicyVersionSelection.implementEffect((request) =>
  O.match(request.vpcArn, {
    onNone: () =>
      request.beforeVpc
        ? Effect.succeed(DeployPolicyVersion.Enum.v1)
        : Effect.fail(
            DeployPolicyVersionUnstated.make({
              reason: "no --vpc-arn: pass the fleet VPC ARN for v2, or --before-vpc for the step-0 v1 document",
            })
          ),
    onSome: () =>
      request.beforeVpc
        ? Effect.fail(DeployPolicyVersionUnstated.make({ reason: "--vpc-arn and --before-vpc together" }))
        : Effect.succeed(DeployPolicyVersion.Enum.v2),
  })
);
