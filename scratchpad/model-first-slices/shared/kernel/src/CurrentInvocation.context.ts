import * as Domain from "@alchemy.run/domain";
import * as A from "@beep/utils/Array";
import type * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { allows, type Capability, type ResourceScope } from "./Capability.ts";
import { Invocation } from "./Invocation.ts";
import { MissingGrant } from "./MissingGrant.rejection.ts";

/**
 * The invocation the current request or reaction runs under. The `Session`
 * middleware provides it at the boundary; a policy or saga provides the
 * one the authority context re-admitted. Because it is a `RequestContext`, its value is encoded
 * with each command and restored wherever the aggregate runs.
 *
 * **Example** (Read it in decide)
 * ```ts
 * import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
 * import * as Effect from "effect/Effect";
 *
 * const onBehalfOf = Effect.map(Effect.service(CurrentInvocation), (invocation) => invocation.onBehalfOf);
 * ```
 *
 * @category context
 * @since 0.0.0
 */
export class CurrentInvocation extends Domain.RequestContext<CurrentInvocation>()(
  "Kernel/CurrentInvocation",
  Invocation,
) {}

/**
 * The current invocation, when one of its grants allows the operation on
 * the resource at `at`; `MissingGrant` otherwise. `decide` passes its `now`,
 * a read's `validate` and a query handler pass the clock's time.
 *
 * **Example** (Guard a decision)
 * ```ts
 * import { Capability, ResourceScope } from "@proto/kernel/Capability";
 * import { requireGrant } from "@proto/kernel/CurrentInvocation.context";
 * import { CapabilityId, OrgId } from "@proto/kernel/Ids";
 * import * as DateTime from "effect/DateTime";
 *
 * const Review = Capability.make({ id: CapabilityId.make("party.review"), operations: ["AcceptClaim"], description: "Decide claims." });
 * const guard = requireGrant(Review, "AcceptClaim", ResourceScope.cases.Org.make({ org: OrgId.make("org_acme") }), DateTime.makeUnsafe(0));
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const requireGrant = Effect.fnUntraced(function* (
  capability: Capability,
  operation: string,
  resource: ResourceScope,
  at: DateTime.Utc,
) {
  const invocation = yield* CurrentInvocation;
  return yield* A.some(invocation.grants, allows({ capability, operation, resource, at }))
    ? Effect.succeed(invocation)
    : Effect.fail(MissingGrant.make({ capability: capability.id, operation }));
});
