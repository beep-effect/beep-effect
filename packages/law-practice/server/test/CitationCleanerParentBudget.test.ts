import {
  CitationCleanerProduced,
  CitationCleanerRuntime,
  makeCitationCleanerPipeline,
} from "@beep/law-practice-server/internal/Citation/CleanerPipeline";
import { CitationTextBudget, makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { makeCitationCleanerRegistryHarness } from "./CitationCleanerRegistry.fixtures.ts";
import { makeCitationObservedSpawner } from "./CitationNativeSpawner.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const install = Effect.fn("CleanerParentBudgetTest.install")(function* (maximum: number, native = false) {
  const policy = (yield* defaultCitationEnginePolicy).limits;
  const budget = yield* makeCitationTextBudget({ ...policy, producedTextUtf16: maximum });
  const observed = yield* makeCitationObservedSpawner();
  const h =
    native === true
      ? yield* makeCitationCleanerRegistryHarness(undefined, undefined, observed.spawner)
      : yield* makeCitationCleanerRegistryHarness();
  const pipeline = yield* makeCitationCleanerPipeline({ ...policy, producedTextUtf16: 8 }).pipe(
    Effect.provideService(CitationCleanerRuntime, h.registry.runtime),
    Effect.provideService(CitationTextBudget, budget)
  );
  return { h, pipeline, budget, observed };
});
it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("cleaner parent text authority", (it) => {
  it.effect("refuses direct callback allocation against captured remaining authority", () =>
    Effect.gen(function* () {
      const { h, pipeline, budget } = yield* install(4);
      yield* budget.reserve(2);
      const value = yield* h.values.sourceText("x");
      const callback = yield* h.values.retainHost("parent-budget-callback");
      let materialized = false;
      h.hooks({
        hash: () => Effect.succeed(123456789n),
        equal: () => Effect.succeed(false),
        callable: () => Effect.succeed(true),
        invoke: Effect.fnUntraced(function* (_fn, _value, work) {
          const charge = yield* work.reserveText(3);
          materialized = true;
          const text = yield* h.values.text("abc");
          return CitationCleanerProduced.make({ value: text, charges: [charge] });
        }),
      });
      h.select([callback]);
      const callerPolicy = yield* defaultCitationEnginePolicy;
      const caller = yield* makeCitationTextBudget({
        ...callerPolicy.limits,
        producedTextUtf16: 4,
      });
      const failure = yield* pipeline
        .runOwned({ value, plan: "direct" })
        .pipe(Effect.provideService(CitationTextBudget, caller), Effect.flip);
      expect(failure).toMatchObject({ limit: "producedTextUtf16" });
      expect(materialized).toBe(false);
      const used = yield* budget.snapshot;
      const replacement = yield* caller.snapshot;
      expect(used).toBe(2);
      expect(replacement).toBe(0);
      const work = yield* h.work;
      const snapshot = yield* work.snapshot;
      expect(snapshot).toEqual({ producedTextUtf16: 0, closed: true });
    })
  );
  it.effect("settles bounded real builtin output in both ledgers exactly once", () =>
    Effect.gen(function* () {
      const { h, pipeline, budget } = yield* install(5);
      yield* budget.reserve(2);
      const value = yield* h.values.sourceText("__A__");
      const step = yield* h.values.text("underscores");
      h.select([step]);
      const result = yield* pipeline.runOwned({ value, plan: "bounded" });
      expect(result.producedTextUtf16).toBe(1);
      const native = yield* h.values.getUnicode(result.value);
      expect(O.getOrThrow(native).text).toBe("A");
      const used = yield* budget.snapshot;
      expect(used).toBe(3);
    })
  );
  it.effect(
    "passes parent allowance to real HTML and retires before refusing complete output",
    () =>
      Effect.gen(function* () {
        const { h, pipeline, budget, observed } = yield* install(2, true);
        yield* budget.reserve(1);
        const value = yield* h.values.sourceText("<i>ABC</i>");
        const html = yield* h.values.text("html");
        h.select([html]);
        const before = yield* h.values.snapshot;
        const failure = yield* pipeline.runOwned({ value, plan: "native-refusal" }).pipe(Effect.flip);
        expect(failure).toMatchObject({ limit: "producedTextUtf16" });
        const after = yield* h.values.snapshot;
        expect(after.issued).toBe(before.issued);
        const used = yield* budget.snapshot;
        expect(used).toBe(1);
        const counts = yield* observed.snapshot;
        expect(counts).toEqual({ spawned: 1, confirmed: 1 });
      }),
    { timeout: 60000 }
  );
});
