import {
  acquireCitationNativeLease,
  makeCitationNativeProcessAdmission,
} from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import {
  CitationRegexWorkerFailure,
  makeCitationRegexJobPreparation,
} from "@beep/law-practice-server/internal/Citation/RegexWorkerProtocol";
import { CitationTextBudget, makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as O from "effect/Option";
import type { CitationNativeProcessLease } from "@beep/law-practice-server/internal/Citation/NativeAdmission";

it.effect("does not retain a native slot while regex input waits for borrowed text capacity", () =>
  Effect.gen(function* () {
    const policy = (yield* defaultCitationEnginePolicy).limits;
    const limits = { ...policy, concurrentOperations: 1, concurrentRegexProcesses: 1, producedTextUtf16: 8 };
    const admission = yield* makeCitationNativeProcessAdmission(limits);
    const budget = yield* makeCitationTextBudget(limits);
    const entered = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    const waiting = yield* Deferred.make<void>();
    const watched = CitationTextBudget.of({
      ...budget,
      reserve: Effect.fn("TextNativeOrderTest.reserve")((units) =>
        Deferred.succeed(waiting, undefined).pipe(Effect.andThen(budget.reserve(units)))
      ),
    });
    const preparer = yield* makeCitationRegexJobPreparation(limits).pipe(
      Effect.provideService(CitationTextBudget, watched)
    );
    const producer = yield* budget
      .withCapacity(() =>
        Deferred.succeed(entered, undefined).pipe(
          Effect.andThen(Deferred.await(release)),
          Effect.andThen(
            Effect.acquireUseRelease(
              admission.acquire("clean"),
              () => Effect.succeed({ value: "", units: 0 }),
              (lease) => lease.release
            )
          )
        )
      )
      .pipe(Effect.forkChild);
    yield* Deferred.await(entered);
    let claimed = O.none<CitationNativeProcessLease>();
    const text = { width: 1, bytes: new Uint8Array([97]) };
    const preparing = yield* preparer
      .prepare(text, text, 0, 1, () =>
        acquireCitationNativeLease(admission, "extract", true, () =>
          CitationRegexWorkerFailure.make({ reason: "closed" })
        ).pipe(
          Effect.tap((lease) =>
            Effect.sync(() => {
              claimed = O.some(lease);
            })
          ),
          Effect.asVoid
        )
      )
      .pipe(
        Effect.ensuring(Effect.suspend(() => (O.isSome(claimed) ? claimed.value.release : Effect.void))),
        Effect.forkChild
      );
    yield* Deferred.await(waiting);
    const blocked = yield* admission.snapshot;
    yield* Fiber.interrupt(preparing);
    yield* Deferred.succeed(release, undefined);
    yield* Fiber.join(producer);
    expect(blocked).toMatchObject({ active: 0, regexActive: 0, queued: 0 });
    const final = yield* admission.snapshot;
    expect(final).toMatchObject({ active: 0, regexActive: 0, queued: 0 });
    const used = yield* budget.snapshot;
    expect(used).toBe(0);
  })
);
