/**
 * AWS Cost Optimization Hub account enrollment as an Alchemy resource.
 *
 * @packageDocumentation
 * @category resources
 * @since 0.0.0
 */

import { $AlchemyAwsExtrasId } from "@beep/identity/packages";
import * as coh from "@distilled.cloud/aws/cost-optimization-hub";
import * as Provider from "alchemy/Provider";
import { Resource } from "alchemy/Resource";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { EnrollmentStatus } from "./EnrollmentStatus.ts";
import { EnrollmentNotSettled } from "./Errors.ts";
import { decodeProps } from "./internal/decodeProps.ts";
import type { ExtrasResource } from "./internal/ExtrasResource.ts";
import type { Providers } from "./Providers.ts";

const $I = $AlchemyAwsExtrasId.create("CostOptimizationHubEnrollment");

/**
 * Resource type string registered by {@link CostOptimizationHubEnrollment}.
 *
 * **Example** (Read the registered type)
 *
 * ```ts
 * import { CostOptimizationHubEnrollmentType } from "@beep/alchemy-aws-extras/CostOptimizationHubEnrollment"
 *
 * console.log(CostOptimizationHubEnrollmentType) // "BeepAWS.CostOptimizationHub.Enrollment"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CostOptimizationHubEnrollmentType = "BeepAWS.CostOptimizationHub.Enrollment" as const;

/**
 * Props of a {@link CostOptimizationHubEnrollment}.
 *
 * **Details**
 *
 * `status` defaults to `"Active"`; `includeMemberAccounts` defaults to
 * `false`.
 *
 * **Example** (Decode enrollment props)
 *
 * ```ts
 * import { CostOptimizationHubEnrollmentProps } from "@beep/alchemy-aws-extras/CostOptimizationHubEnrollment"
 * import * as S from "effect/Schema"
 *
 * const props = S.decodeUnknownSync(CostOptimizationHubEnrollmentProps)({ includeMemberAccounts: false })
 * console.log(props.includeMemberAccounts) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CostOptimizationHubEnrollmentProps extends S.Opaque<
  CostOptimizationHubEnrollmentProps,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    status: S.optionalKey(EnrollmentStatus),
    includeMemberAccounts: S.optionalKey(S.Boolean),
  }).pipe(
    $I.annoteSchema("CostOptimizationHubEnrollmentProps", {
      description: "Desired Cost Optimization Hub enrollment of the deploying account.",
    })
  )
) {}

/**
 * Companion types for {@link CostOptimizationHubEnrollmentProps}.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace CostOptimizationHubEnrollmentProps {
  /**
   * The plain, unbranded shape callers pass and attributes report.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof CostOptimizationHubEnrollmentProps.Encoded;
}

/**
 * Attributes Cost Optimization Hub reports for the account enrollment.
 *
 * **Example** (Decode observed attributes)
 *
 * ```ts
 * import { CostOptimizationHubEnrollmentAttributes } from "@beep/alchemy-aws-extras/CostOptimizationHubEnrollment"
 * import * as S from "effect/Schema"
 *
 * const attrs = S.decodeUnknownSync(CostOptimizationHubEnrollmentAttributes)({
 *   status: "Active",
 *   includeMemberAccounts: false
 * })
 * console.log(attrs.status) // "Active"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CostOptimizationHubEnrollmentAttributes extends S.Opaque<
  CostOptimizationHubEnrollmentAttributes,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    status: S.String,
    includeMemberAccounts: S.Boolean,
  }).pipe(
    $I.annoteSchema("CostOptimizationHubEnrollmentAttributes", {
      description: "Observed Cost Optimization Hub enrollment of the deploying account.",
    })
  )
) {}

/**
 * Companion types for {@link CostOptimizationHubEnrollmentAttributes}.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace CostOptimizationHubEnrollmentAttributes {
  /**
   * The plain, unbranded shape callers pass and attributes report.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof CostOptimizationHubEnrollmentAttributes.Encoded;
}

/**
 * Alchemy resource contract for {@link CostOptimizationHubEnrollment}.
 *
 * @category resources
 * @since 0.0.0
 */
export type CostOptimizationHubEnrollment = Resource<
  typeof CostOptimizationHubEnrollmentType,
  CostOptimizationHubEnrollmentProps.Encoded,
  CostOptimizationHubEnrollmentAttributes.Encoded,
  never,
  Providers
>;

const CostOptimizationHubEnrollmentResource = Resource<CostOptimizationHubEnrollment>(
  CostOptimizationHubEnrollmentType,
  { defaultRemovalPolicy: "retain" }
);

/**
 * Enrolls the deploying account in AWS Cost Optimization Hub.
 *
 * **Details**
 *
 * An account singleton: `read` always reports the live enrollment as plain
 * attributes, so it adopts silently. `reconcile` updates only on a
 * difference and confirms the new status by reading it back. The default
 * removal policy is `retain`; under an explicit `destroy` policy, delete sets
 * the enrollment `Inactive`.
 *
 * **Gotchas**
 *
 * Cost Optimization Hub is served from `us-east-1` only; deploy this resource
 * from a stack whose AWS environment uses that region.
 *
 * **Example** (Enroll the account)
 *
 * ```ts
 * import { CostOptimizationHubEnrollment } from "@beep/alchemy-aws-extras/CostOptimizationHubEnrollment"
 *
 * const enrollment = CostOptimizationHubEnrollment("OptimizationHub", { includeMemberAccounts: false })
 * console.log(typeof enrollment) // "object"
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export const CostOptimizationHubEnrollment: ExtrasResource<CostOptimizationHubEnrollment> =
  CostOptimizationHubEnrollmentResource;

const observe = Effect.fn("CostOptimizationHubEnrollment.observe")(function* () {
  const response = yield* coh.listEnrollmentStatuses({});
  const status = pipe(
    response.items ?? [],
    A.head,
    O.flatMap((item) => O.fromUndefinedOr(item.status)),
    O.getOrElse(() => "Inactive")
  );
  return {
    status,
    includeMemberAccounts: response.includeMemberAccounts ?? false,
  } satisfies CostOptimizationHubEnrollmentAttributes.Encoded;
});

const apply = Effect.fn("CostOptimizationHubEnrollment.apply")(function* (
  desired: EnrollmentStatus,
  includeMemberAccounts: boolean
) {
  const observed = yield* observe();
  if (observed.status !== desired || observed.includeMemberAccounts !== includeMemberAccounts) {
    yield* coh.updateEnrollmentStatus({ status: desired, includeMemberAccounts });
  }
  const settled = yield* observe();
  if (settled.status !== desired) {
    return yield* EnrollmentNotSettled.make({ service: "cost-optimization-hub", desired, observed: settled.status });
  }
  return settled;
});

/**
 * Provider layer for {@link CostOptimizationHubEnrollment}.
 *
 * **Example** (Register the provider)
 *
 * ```ts
 * import { CostOptimizationHubEnrollmentProvider } from "@beep/alchemy-aws-extras/CostOptimizationHubEnrollment"
 *
 * const layer = CostOptimizationHubEnrollmentProvider
 * console.log(typeof layer) // "object"
 * ```
 *
 * @category providers
 * @since 0.0.0
 */
export const CostOptimizationHubEnrollmentProvider = Provider.succeed(CostOptimizationHubEnrollmentResource, {
  list: () => Effect.map(observe(), (attrs) => [attrs]),
  read: () => observe(),
  reconcile: Effect.fn("CostOptimizationHubEnrollment.reconcile")(function* ({ news, session }) {
    const props = yield* decodeProps({
      resourceType: CostOptimizationHubEnrollmentType,
      schema: CostOptimizationHubEnrollmentProps,
    })(news ?? {});
    const attrs = yield* apply(props.status ?? "Active", props.includeMemberAccounts ?? false);
    yield* session.note(`cost-optimization-hub=${attrs.status}`);
    return attrs;
  }),
  delete: Effect.fn("CostOptimizationHubEnrollment.delete")(function* () {
    yield* apply("Inactive", false);
  }),
});
