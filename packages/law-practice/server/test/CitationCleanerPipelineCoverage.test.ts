import { makeCitationCleanerPipeline } from "@beep/law-practice-server/internal/Citation/CleanerPipeline";
import { CitationInvocation } from "@beep/law-practice-server/internal/Citation/Invocation";
import {
  CitationCleaner,
  CitationCleanerFailure,
  CitationCleanerProduced,
  CitationCleanerTextCharge,
  CitationSafetyLimitExceeded,
  CitationTextBudget,
} from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { assertSome, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as O from "effect/Option";
import { makeCitationCleanerRegistryHarness as setup } from "./CitationCleanerRegistry.fixtures.ts";
import { makeCitationTestScaffoldBinding, withCitationTestTextBudget } from "./CitationInvocation.fixtures.ts";

const failure = (reason: CitationCleanerFailure["reason"]) => CitationCleanerFailure.make({ reason });

it.effect("rejects a malformed owned request before touching the runtime", () =>
  Effect.gen(function* () {
    const h = yield* setup();
    const refused = yield* h.pipeline.runOwned({ plan: "owned-malformed" }).pipe(Effect.flip);
    deepStrictEqual(refused, failure("invalid-input"));
    const calls = yield* h.calls;
    deepStrictEqual(calls, []);
  })
);

it.effect("charges an unchanged owned value against the local ceiling and closes the work", () =>
  withCitationTestTextBudget(
    3,
    Effect.gen(function* () {
      const h = yield* setup();
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const value = yield* h.values.sourceText("ABCD");
      h.select([]);
      const tight = yield* makeCitationCleanerPipeline({ ...limits, producedTextUtf16: 3 }).pipe(
        Effect.flatMap((stage) =>
          makeCitationTestScaffoldBinding({ ...limits, producedTextUtf16: 3 }, "clean").pipe(
            Effect.map((bind) => ({ ...stage, run: bind(stage.run), runOwned: bind(stage.runOwned) }))
          )
        ),
        Effect.provideService(CitationCleaner, h.registry.runtime)
      );
      const refused = yield* tight.runOwned({ value, plan: "owned-unchanged" }).pipe(Effect.flip);
      deepStrictEqual(refused, CitationSafetyLimitExceeded.make({ operation: "clean", limit: "producedTextUtf16" }));
      const work = yield* h.work;
      const snapshot = yield* work.snapshot;
      deepStrictEqual(snapshot.producedTextUtf16, 0);
      deepStrictEqual(snapshot.closed, true);
    })
  )
);

it.effect("rejects callback output carrying a charge the work never issued", () =>
  Effect.gen(function* () {
    const h = yield* setup();
    const callback = yield* h.values.retainHost("forged-charge-callback");
    h.hooks({
      hash: () => Effect.succeed(123456789n),
      equal: () => Effect.succeed(false),
      callable: () => Effect.succeed(true),
      invoke: Effect.fnUntraced(function* () {
        const text = yield* h.values.text("abc");
        return CitationCleanerProduced.make({ value: text, charges: [CitationCleanerTextCharge.make({ units: 3 })] });
      }),
    });
    h.select([callback]);
    const refused = yield* h.pipeline.run({ text: "x", plan: "forged-charge" }).pipe(Effect.flip);
    deepStrictEqual(refused, failure("invalid-reservation"));
    const work = yield* h.work;
    const snapshot = yield* work.snapshot;
    deepStrictEqual(snapshot.producedTextUtf16, 0);
    deepStrictEqual(snapshot.closed, true);
  })
);
type Failure = CitationCleanerFailure | CitationSafetyLimitExceeded;
const callableHooks = {
  hash: () => Effect.succeed(123456789n),
  equal: () => Effect.succeed(false),
  callable: () => Effect.succeed(true),
};
const parentedPipeline = Effect.fn("CleanerCoverageTest.parented")(function* (
  h: Effect.Success<ReturnType<typeof setup>>
) {
  const limits = (yield* defaultCitationEnginePolicy).limits;
  const parent = (yield* CitationInvocation).budget;
  const pipeline = yield* makeCitationCleanerPipeline({ ...limits, producedTextUtf16: 8 }).pipe(
    Effect.flatMap((stage) =>
      makeCitationTestScaffoldBinding({ ...limits, producedTextUtf16: 8 }, "clean").pipe(
        Effect.map((bind) => ({ ...stage, run: bind(stage.run), runOwned: bind(stage.runOwned) }))
      )
    ),
    Effect.provideService(CitationCleaner, h.registry.runtime),
    Effect.provideService(CitationTextBudget, parent)
  );
  return { parent, pipeline };
});
// An unrelated producer holds the parent ledger until `release` completes.
const holdParent = Effect.fn("CleanerCoverageTest.holdParent")(function* (parent: CitationTextBudget["Service"]) {
  const holding = yield* Deferred.make<void>();
  const release = yield* Deferred.make<void>();
  const holder = yield* parent
    .withCapacity(() =>
      Deferred.succeed(holding, undefined).pipe(
        Effect.andThen(Deferred.await(release)),
        Effect.as({ value: "held", units: 0 })
      )
    )
    .pipe(Effect.forkChild);
  yield* Deferred.await(holding);
  return { release: Deferred.succeed(release, undefined).pipe(Effect.andThen(Fiber.join(holder))) };
});

it.effect("keeps a reservation that waited on the parent charged in both ledgers and refuses after close", () =>
  withCitationTestTextBudget(
    8,
    Effect.gen(function* () {
      const h = yield* setup();
      const { parent, pipeline } = yield* parentedPipeline(h);
      const { release: releaseParent } = yield* holdParent(parent);
      const queued = yield* Deferred.make<void>();
      let late = O.none<Fiber.Fiber<CitationCleanerTextCharge, Failure>>();
      const callback = yield* h.values.retainHost("leaked-work-callback");
      h.hooks({
        ...callableHooks,
        invoke: Effect.fnUntraced(function* (_fn, current, work) {
          const fiber = yield* Deferred.succeed(queued, undefined).pipe(
            Effect.andThen(work.reserveText(2)),
            Effect.forkDetach
          );
          late = O.some(fiber);
          yield* Deferred.await(queued);
          return CitationCleanerProduced.make({ value: current, charges: [] });
        }),
      });
      h.select([callback]);
      const result = yield* pipeline.run({ text: "", plan: "leaked-work" });
      strictEqual(result.producedTextUtf16, 2);
      yield* releaseParent;
      const pending = yield* Effect.fromOption(late);
      const ticket = yield* Fiber.join(pending);
      strictEqual(ticket.units, 2);
      const charged = yield* parent.snapshot;
      strictEqual(charged, 2);
      const work = yield* h.work;
      const refused = yield* work.reserveText(2).pipe(Effect.flip);
      deepStrictEqual(refused, failure("closed-work"));
      const parentAfter = yield* parent.snapshot;
      strictEqual(parentAfter, 2);
      const after = yield* work.snapshot;
      strictEqual(after.producedTextUtf16, 2);
      strictEqual(after.closed, true);
    })
  )
);

it.effect("rolls the cleaner reservation back when the parent refuses or the wait is interrupted", () =>
  withCitationTestTextBudget(
    8,
    Effect.gen(function* () {
      const h = yield* setup();
      const { parent, pipeline } = yield* parentedPipeline(h);
      yield* parent.reserve(5);
      const callback = yield* h.values.retainHost("rollback-callback");
      let refusal = O.none<Failure>();
      let afterRefusal = -1;
      let afterInterrupt = -1;
      h.hooks({
        ...callableHooks,
        invoke: Effect.fnUntraced(function* (_fn, _current, work) {
          refusal = yield* work.reserveText(4).pipe(Effect.match({ onFailure: O.some, onSuccess: () => O.none() }));
          afterRefusal = (yield* work.snapshot).producedTextUtf16;
          const { release: releaseParent } = yield* holdParent(parent);
          const queued = yield* Deferred.make<void>();
          const waiting = yield* Deferred.succeed(queued, undefined).pipe(
            Effect.andThen(work.reserveText(1)),
            Effect.forkDetach
          );
          yield* Deferred.await(queued);
          yield* Fiber.interrupt(waiting);
          afterInterrupt = (yield* work.snapshot).producedTextUtf16;
          yield* releaseParent;
          const charge = yield* work.reserveText(3);
          const text = yield* h.values.text("abc");
          return CitationCleanerProduced.make({ value: text, charges: [charge] });
        }),
      });
      h.select([callback]);
      const result = yield* pipeline.run({ text: "", plan: "rollback" });
      assertSome(refusal, CitationSafetyLimitExceeded.make({ operation: "extract", limit: "producedTextUtf16" }));
      strictEqual(afterRefusal, 0);
      strictEqual(afterInterrupt, 0);
      strictEqual(result.producedTextUtf16, 3);
      const used = yield* parent.snapshot;
      strictEqual(used, 8);
    })
  )
);
