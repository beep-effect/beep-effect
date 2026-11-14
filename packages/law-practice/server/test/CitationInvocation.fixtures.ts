import { $LawPracticeServerId } from "@beep/identity/packages";
/** Direct private-stage tests use the production invocation constructor. */
import {
  CitationAdmissionFailure,
  CitationOperationAdmission,
  makeCitationOperationAdmission,
  prepareCitationAdmissionPolicy,
} from "@beep/law-practice-server/internal/Citation/Admission";
import {
  CitationInvocation,
  CitationInvocationPolicy,
  openCitationInvocation,
} from "@beep/law-practice-server/internal/Citation/Invocation";
import {
  CitationNativeProcessAdmission,
  captureCitationNativeAdmission,
} from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import { CitationRegexOperation } from "@beep/law-practice-server/internal/Citation/RegexPolicy";
import { captureCitationSnapshot } from "@beep/law-practice-server/internal/Citation/Snapshot";
import { makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { CitationEngineLimits, CitationTextBudget } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import { citationInvocationScaffoldClock } from "./CitationNativeSpawner.fixtures.ts";
import type { CitationEngineOperation } from "@beep/law-practice-use-cases/server";

const $I = $LawPracticeServerId.create("test/CitationInvocation.fixtures");

interface InvocationTestEnvironment {
  readonly admission: O.Option<CitationOperationAdmission["Service"]>;
  readonly clock: Clock.Clock;
  readonly native: O.Option<CitationNativeProcessAdmission["Service"]>;
  readonly operation: CitationEngineOperation;
  readonly spawner: O.Option<ChildProcessSpawner["Service"]>;
}
const CitationTestExplicitInvocation = Context.Reference<boolean>($I`CitationTestExplicitInvocation`, {
  defaultValue: () => false,
});

const CitationTestScaffoldAdmission = Context.Reference<O.Option<CitationOperationAdmission["Service"]>>(
  $I`CitationTestScaffoldAdmission`,
  { defaultValue: O.none }
);

const captureTestNativeEnvironment = Effect.fn("CitationInvocationTest.nativeEnvironment")(function* (
  limits: CitationEngineLimits,
  environment?: InvocationTestEnvironment
) {
  const native =
    environment !== undefined && O.isSome(environment.native)
      ? environment.native.value
      : yield* captureCitationNativeAdmission(limits, () =>
          CitationAdmissionFailure.make({ reason: "invalid-policy" })
        ).pipe(Effect.orDie);
  const supplied = environment === undefined ? yield* Effect.serviceOption(ChildProcessSpawner) : environment.spawner;
  if (O.isSome(supplied)) return { native, spawner: supplied.value };
  const platform = yield* Layer.build(NodeServices.layer);
  return { native, spawner: Context.get(platform, ChildProcessSpawner) };
});

/** Open a request for a direct stage, or an untimed test scaffold around several independently bound calls. */
export const withCitationTestInvocation = Effect.fn("CitationInvocationTest.run")(function* <A, E, R>(
  body: Effect.Effect<A, E, R | CitationInvocation>,
  policy?: CitationEngineLimits,
  environment?: InvocationTestEnvironment
) {
  const defaults = yield* defaultCitationEnginePolicy.pipe(Effect.orDie);
  const { limits } = yield* prepareCitationAdmissionPolicy(policy ?? defaults.limits).pipe(Effect.orDie);
  const callerClock = environment === undefined ? yield* Clock.Clock : environment.clock;
  const clock = policy === undefined ? yield* citationInvocationScaffoldClock : callerClock;
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const supplied =
        environment === undefined ? O.none<CitationOperationAdmission["Service"]>() : environment.admission;
      const admission = O.isSome(supplied)
        ? supplied.value
        : yield* makeCitationOperationAdmission(limits).pipe(Effect.provideService(Clock.Clock, clock), Effect.orDie);
      const { native, spawner } = yield* captureTestNativeEnvironment(limits, environment);
      return yield* openCitationInvocation(
        CitationInvocationPolicy.make({
          limits,
          operation: environment?.operation ?? "extract",
          deadlineStarts: "before-admission",
        }),
        body.pipe(
          Effect.provideService(Clock.Clock, callerClock),
          Effect.provideService(CitationTestExplicitInvocation, policy !== undefined),
          Effect.provideService(CitationTestScaffoldAdmission, policy === undefined ? O.some(admission) : O.none())
        )
      ).pipe(
        Effect.provideService(CitationOperationAdmission, admission),
        Effect.provideService(Clock.Clock, clock),
        Effect.provideService(CitationNativeProcessAdmission, native),
        Effect.provideService(ChildProcessSpawner, spawner)
      );
    })
  );
});
/** Capture installation constants for standalone fixture methods, retaining each method's own request policy. */
export const makeCitationTestInvocationBinding = Effect.fn("CitationInvocationTest.bind")(function* (
  policy: unknown,
  selectedOperation?: CitationEngineOperation,
  replaceScaffoldAdmission?: boolean
) {
  const ownedPolicy = yield* captureCitationSnapshot(
    S.toType(CitationEngineLimits),
    CitationEngineLimits.pipe(S.toCodecJson, S.fromJsonString),
    policy,
    () => CitationAdmissionFailure.make({ reason: "invalid-policy" })
  ).pipe(Effect.orDie);
  const clock = yield* Clock.Clock;
  const operation = selectedOperation ?? (yield* CitationRegexOperation);
  const observation = yield* Effect.serviceOption(CitationTestBudgetObservation);
  const supplied = yield* Effect.serviceOption(CitationOperationAdmission);
  const scaffold = yield* CitationTestScaffoldAdmission;
  const admission =
    replaceScaffoldAdmission === true && O.isSome(supplied) && O.isSome(scaffold) && supplied.value === scaffold.value
      ? O.none<CitationOperationAdmission["Service"]>()
      : supplied;
  const spawner = yield* Effect.serviceOption(ChildProcessSpawner);
  const native = yield* Effect.serviceOption(CitationNativeProcessAdmission);
  const environment = { clock, operation, admission, spawner, native };
  return <Args extends ReadonlyArray<unknown>, A, E, R>(
    run: (...args: Args) => Effect.Effect<A, E, R | CitationInvocation>
  ) =>
    Effect.fnUntraced(function* (...args: Args) {
      // Test adapters support both standalone calls and explicit shared-ledger requests.
      // This optional test-only read reuses the latter instead of admitting a second request.
      const current = yield* Effect.serviceOption(CitationInvocation);
      const explicit = yield* CitationTestExplicitInvocation;
      if (explicit && O.isSome(current)) {
        if (O.isSome(observation)) yield* Ref.set(observation.value.current, current.value.budget);
        return yield* run(...args).pipe(Effect.provideService(CitationInvocation, current.value));
      }
      return yield* withCitationTestInvocation(
        Effect.gen(function* () {
          const invocation = yield* CitationInvocation;
          if (O.isSome(observation)) yield* Ref.set(observation.value.current, invocation.budget);
          return yield* run(...args);
        }),
        ownedPolicy,
        environment
      );
    });
});

/** Observe the actual invocation ledger in legacy fixture assertions and callbacks. */
export class CitationTestBudgetObservation extends Context.Service<
  CitationTestBudgetObservation,
  {
    readonly current: Ref.Ref<CitationTextBudget["Service"]>;
  }
>()($I`CitationTestBudgetObservation`) {}

/** Keep fixture receipts pointed at the budget created by openCitationInvocation. */
export const makeCitationTestBudgetObservation = Effect.fn("CitationInvocationTest.observeBudget")(function* (
  policy: CitationEngineLimits
) {
  const initial = yield* makeCitationTextBudget(policy);
  const current = yield* Ref.make(initial);
  const budget = CitationTextBudget.of({
    maximum: initial.maximum,
    reserve: Effect.fn("CitationInvocationTest.reserve")((units) =>
      Ref.get(current).pipe(Effect.flatMap((budget) => budget.reserve(units)))
    ),
    snapshot: Ref.get(current).pipe(Effect.flatMap((budget) => budget.snapshot)),
    withCapacity: Effect.fn("CitationInvocationTest.withCapacity")((produce) =>
      Ref.get(current).pipe(Effect.flatMap((budget) => budget.withCapacity(produce)))
    ),
  });
  return { budget, observation: CitationTestBudgetObservation.of({ current }) };
});

/** Exercise shared call-time budget authority under a specific receiving ceiling. */
export const withCitationTestTextBudget = Effect.fn("CitationInvocationTest.textBudget")(function* <A, E, R>(
  maximum: number,
  body: Effect.Effect<A, E, R | CitationInvocation>
) {
  const { limits } = yield* defaultCitationEnginePolicy;
  return yield* withCitationTestInvocation(body, { ...limits, producedTextUtf16: maximum });
});

/** A direct-call adapter retains typed admission refusal in addition to the stage errors. */
export type CitationTestInvocationBound<T> = {
  readonly [K in keyof T]: T[K] extends (...args: infer Args) => Effect.Effect<infer A, infer E, infer R>
    ? (...args: Args) => Effect.Effect<A, E | CitationAdmissionFailure, Exclude<R, CitationInvocation>>
    : T[K];
};

/** Explicitly bind independent calls installed inside the untimed test scaffold. Real supplied owners are retained. */
export const makeCitationTestScaffoldBinding = Effect.fn("CitationInvocationTest.bindScaffold")(function* (
  policy: unknown,
  operation?: CitationEngineOperation
) {
  return yield* makeCitationTestInvocationBinding(policy, operation, true);
});
