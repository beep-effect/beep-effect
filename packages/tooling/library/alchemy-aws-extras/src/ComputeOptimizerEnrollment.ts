/**
 * AWS Compute Optimizer account enrollment as an Alchemy resource.
 *
 * @packageDocumentation
 * @category resources
 * @since 0.0.0
 */

import { $AlchemyAwsExtrasId } from "@beep/identity/packages";
import * as co from "@distilled.cloud/aws/compute-optimizer";
import * as Provider from "alchemy/Provider";
import { Resource } from "alchemy/Resource";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import { EnrollmentStatus } from "./EnrollmentStatus.ts";
import { EnrollmentNotSettled } from "./Errors.ts";
import { decodeProps } from "./internal/decodeProps.ts";
import type { ExtrasResource } from "./internal/ExtrasResource.ts";
import type { Providers } from "./Providers.ts";

const $I = $AlchemyAwsExtrasId.create("ComputeOptimizerEnrollment");

/**
 * Resource type string registered by {@link ComputeOptimizerEnrollment}.
 *
 * **Example** (Read the registered type)
 *
 * ```ts
 * import { ComputeOptimizerEnrollmentType } from "@beep/alchemy-aws-extras/ComputeOptimizerEnrollment"
 *
 * console.log(ComputeOptimizerEnrollmentType) // "BeepAWS.ComputeOptimizer.Enrollment"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ComputeOptimizerEnrollmentType = "BeepAWS.ComputeOptimizer.Enrollment" as const;

/**
 * Props of a {@link ComputeOptimizerEnrollment}.
 *
 * **Details**
 *
 * `status` defaults to `"Active"`; `includeMemberAccounts` defaults to
 * `false` (only an organization management account may set it).
 *
 * **Example** (Decode enrollment props)
 *
 * ```ts
 * import { ComputeOptimizerEnrollmentProps } from "@beep/alchemy-aws-extras/ComputeOptimizerEnrollment"
 * import * as S from "effect/Schema"
 *
 * const props = S.decodeUnknownSync(ComputeOptimizerEnrollmentProps)({ status: "Active" })
 * console.log(props.status) // "Active"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ComputeOptimizerEnrollmentProps extends S.Opaque<
  ComputeOptimizerEnrollmentProps,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    status: S.optionalKey(EnrollmentStatus),
    includeMemberAccounts: S.optionalKey(S.Boolean),
  }).pipe(
    $I.annoteSchema("ComputeOptimizerEnrollmentProps", {
      description: "Desired Compute Optimizer enrollment of the deploying account.",
    })
  )
) {}

/**
 * Companion types for {@link ComputeOptimizerEnrollmentProps}.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ComputeOptimizerEnrollmentProps {
  /**
   * The plain, unbranded shape callers pass and attributes report.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof ComputeOptimizerEnrollmentProps.Encoded;
}

/**
 * Attributes Compute Optimizer reports for the account enrollment.
 *
 * **Example** (Decode observed attributes)
 *
 * ```ts
 * import { ComputeOptimizerEnrollmentAttributes } from "@beep/alchemy-aws-extras/ComputeOptimizerEnrollment"
 * import * as S from "effect/Schema"
 *
 * const attrs = S.decodeUnknownSync(ComputeOptimizerEnrollmentAttributes)({
 *   status: "Active",
 *   memberAccountsEnrolled: false
 * })
 * console.log(attrs.memberAccountsEnrolled) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ComputeOptimizerEnrollmentAttributes extends S.Opaque<
  ComputeOptimizerEnrollmentAttributes,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    status: S.String,
    memberAccountsEnrolled: S.Boolean,
  }).pipe(
    $I.annoteSchema("ComputeOptimizerEnrollmentAttributes", {
      description: "Observed Compute Optimizer enrollment of the deploying account.",
    })
  )
) {}

/**
 * Companion types for {@link ComputeOptimizerEnrollmentAttributes}.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ComputeOptimizerEnrollmentAttributes {
  /**
   * The plain, unbranded shape callers pass and attributes report.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof ComputeOptimizerEnrollmentAttributes.Encoded;
}

/**
 * Alchemy resource contract for {@link ComputeOptimizerEnrollment}.
 *
 * @category resources
 * @since 0.0.0
 */
export type ComputeOptimizerEnrollment = Resource<
  typeof ComputeOptimizerEnrollmentType,
  ComputeOptimizerEnrollmentProps.Encoded,
  ComputeOptimizerEnrollmentAttributes.Encoded,
  never,
  Providers
>;

const ComputeOptimizerEnrollmentResource = Resource<ComputeOptimizerEnrollment>(ComputeOptimizerEnrollmentType, {
  defaultRemovalPolicy: "retain",
});

/**
 * Enrolls the deploying account in AWS Compute Optimizer.
 *
 * **Details**
 *
 * An account singleton: `read` always reports the live enrollment as plain
 * attributes, so it adopts silently. `reconcile` updates only on a status or
 * member-account difference and waits until the status leaves `Pending`. The
 * default removal policy is `retain`; under an explicit `destroy` policy,
 * delete sets the enrollment `Inactive`.
 *
 * **Example** (Enroll the account)
 *
 * ```ts
 * import { ComputeOptimizerEnrollment } from "@beep/alchemy-aws-extras/ComputeOptimizerEnrollment"
 *
 * const enrollment = ComputeOptimizerEnrollment("ComputeOptimizer", { status: "Active" })
 * console.log(typeof enrollment) // "object"
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export const ComputeOptimizerEnrollment: ExtrasResource<ComputeOptimizerEnrollment> =
  ComputeOptimizerEnrollmentResource;

const observe = Effect.fn("ComputeOptimizerEnrollment.observe")(function* () {
  const response = yield* co.getEnrollmentStatus({});
  return {
    status: response.status ?? "Inactive",
    memberAccountsEnrolled: response.memberAccountsEnrolled ?? false,
  } satisfies ComputeOptimizerEnrollmentAttributes.Encoded;
});

const settle = Effect.fn("ComputeOptimizerEnrollment.settle")(function* (desired: EnrollmentStatus) {
  const settled = yield* observe().pipe(
    Effect.repeat({
      schedule: Schedule.spaced(Duration.seconds(5)),
      times: 24,
      until: (attrs) => attrs.status !== "Pending",
    })
  );
  if (settled.status !== desired) {
    return yield* EnrollmentNotSettled.make({ service: "compute-optimizer", desired, observed: settled.status });
  }
  return settled;
});

const apply = Effect.fn("ComputeOptimizerEnrollment.apply")(function* (
  desired: EnrollmentStatus,
  includeMemberAccounts: boolean
) {
  const observed = yield* observe();
  if (observed.status !== desired || observed.memberAccountsEnrolled !== includeMemberAccounts) {
    yield* co.updateEnrollmentStatus({ status: desired, includeMemberAccounts });
  }
  return yield* settle(desired);
});

/**
 * Provider layer for {@link ComputeOptimizerEnrollment}.
 *
 * **Example** (Register the provider)
 *
 * ```ts
 * import { ComputeOptimizerEnrollmentProvider } from "@beep/alchemy-aws-extras/ComputeOptimizerEnrollment"
 *
 * const layer = ComputeOptimizerEnrollmentProvider
 * console.log(typeof layer) // "object"
 * ```
 *
 * @category providers
 * @since 0.0.0
 */
export const ComputeOptimizerEnrollmentProvider = Provider.succeed(ComputeOptimizerEnrollmentResource, {
  list: () => Effect.map(observe(), (attrs) => [attrs]),
  read: () => observe(),
  reconcile: Effect.fn("ComputeOptimizerEnrollment.reconcile")(function* ({ news, session }) {
    const props = yield* decodeProps({
      resourceType: ComputeOptimizerEnrollmentType,
      schema: ComputeOptimizerEnrollmentProps,
    })(news ?? {});
    const desired = props.status ?? "Active";
    const attrs = yield* apply(desired, props.includeMemberAccounts ?? false);
    yield* session.note(`compute-optimizer=${attrs.status}`);
    return attrs;
  }),
  delete: Effect.fn("ComputeOptimizerEnrollment.delete")(function* () {
    yield* apply("Inactive", false);
  }),
});
