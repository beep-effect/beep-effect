/** Request-owned citation policy, text accounting and resource lifetime.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineLimits, CitationEngineOperation } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import { CitationOperationAdmission } from "./Admission.ts";
import { makeCitationNativeLane } from "./NativeLane.ts";
import { CitationRegexOperation, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { makeCitationRegexSession } from "./RegexSession.ts";
import { makeCitationTextBudget } from "./TextBudget.ts";
import type { CitationTextBudget } from "@beep/law-practice-use-cases/server";
import type { CitationNativeLane } from "./NativeLane.ts";
import type { CitationRegexSession } from "./RegexSession.ts";

const $I = $LawPracticeServerId.create("internal/Citation/Invocation");
/** Stage deadline placement preserves the distinct engine and extractor boundaries.
 * @internal @category models @since 0.0.0
 */
export const CitationInvocationDeadlineStarts = LiteralKit(["before-admission", "after-admission"]).pipe(
  $I.annoteSchema("CitationInvocationDeadlineStarts", {
    description: "Whether queue wait consumes the stage deadline.",
  })
);
/** Validated policy for one admitted operation.
 * @internal @category models @since 0.0.0
 */
export class CitationInvocationPolicy extends S.Opaque<CitationInvocationPolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    limits: CitationEngineLimits,
    operation: CitationEngineOperation,
    deadlineStarts: CitationInvocationDeadlineStarts,
  }).pipe(
    $I.annoteSchema("CitationInvocationPolicy", { description: "Engine policy and operation label for one request." })
  )
) {}
/** Holding this service proves that the outer boundary admitted the request.
 *
 * **Details**
 *
 * The lane owns native capacity and physical children. The lazy regex session
 * shares that lane and its Clock/spawner for all jobs in this request. Diff and
 * Xml retain their per-request preparation objects.
 * @internal @category services @since 0.0.0
 */
export class CitationInvocation extends Context.Service<
  CitationInvocation,
  {
    readonly policy: CitationInvocationPolicy;
    readonly budget: CitationTextBudget["Service"];
    readonly scope: Scope.Scope;
    readonly lane: CitationNativeLane["Service"];
    readonly regex: CitationRegexSession["Service"];
  }
>()($I`CitationInvocation`) {}
/** Admit once, close the request Scope before releasing its permit, and bind its budget.
 * @internal @category operations @since 0.0.0
 */
export const openCitationInvocation = Effect.fn("Citation.openInvocation")(function* <A, E, R>(
  policy: CitationInvocationPolicy,
  body: Effect.Effect<A, E, R | CitationInvocation>
) {
  const admission = yield* CitationOperationAdmission;
  const timing = yield* makeCitationRegexTiming(policy.limits, true).pipe(
    Effect.provideService(CitationRegexOperation, policy.operation)
  );
  const request = Effect.scoped(
    Effect.gen(function* () {
      const scope = yield* Scope.Scope;
      const budget = yield* makeCitationTextBudget(policy.limits);
      const lane = yield* makeCitationNativeLane(policy.limits, policy.operation);
      const regex = yield* makeCitationRegexSession(policy.limits, policy.operation, lane);
      return yield* body.pipe(Effect.provideService(CitationInvocation, { policy, budget, scope, lane, regex }));
    })
  );
  return yield* policy.deadlineStarts === "before-admission"
    ? admission.run(policy.operation, request).pipe(timing.timed)
    : admission.run(policy.operation, request.pipe(timing.timed));
});

/** Reserve parent-owned text at call time, before the guarded allocation.
 * @internal @category operations @since 0.0.0
 */
export const reserveCitationInvocationText = Effect.fn("Citation.reserveInvocationTextAtCall")((units: number) =>
  Effect.flatMap(CitationInvocation, ({ budget }) => budget.reserve(units))
);
