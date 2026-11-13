import {
  CitationAdmissionFailure,
  CitationAdmissionSnapshot,
  CitationOperationAdmission,
} from "@beep/law-practice-server/internal/Citation/Admission";
import { makeCitationExtractorOrdering } from "@beep/law-practice-server/internal/Citation/ExtractorOrdering";
import { makeCitationTokenizer } from "@beep/law-practice-server/internal/Citation/Tokenizer";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import { loadCitationFrozenEditionFixtures } from "./CitationFrozenEditions.fixtures.ts";
import {
  makeCitationTestScaffoldBinding,
  withCitationTestInvocation,
  withCitationTestTextBudget,
} from "./CitationInvocation.fixtures.ts";
import { setupCitationMetadataRuntime } from "./CitationRegexWorker.fixtures.ts";
import {
  assertCitationTokenizerCase,
  citationTokenizerTestLayer,
  loadCitationTokenizerControls,
  setupCitationTokenizer,
} from "./CitationTokenizer.fixtures.ts";
import { loadCitationTokenObjectsControls } from "./CitationTokenObjects.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("owned tokenizer composition", (it) => {
  it.effect("uses invocation admission instead of a closed install-time view", () =>
    Effect.gen(function* () {
      const controls = yield* loadCitationTokenizerControls();
      const setup = yield* setupCitationMetadataRuntime("bun");
      const closed = CitationOperationAdmission.of({
        run: Effect.fn("TokenizerPortTest.closedAdmission")(() =>
          Effect.fail(CitationAdmissionFailure.make({ reason: "closed" }))
        ),
        snapshot: Effect.succeed(CitationAdmissionSnapshot.make({ active: 0, queued: 0, closed: true })),
      });
      const tokenizer = yield* makeCitationTokenizer(setup.limits, setup.runtime, controls.configuration).pipe(
        Effect.provideContext(Context.add(setup.provided, CitationOperationAdmission, closed))
      );
      const result = yield* withCitationTestInvocation(
        tokenizer.port.tokenize({ width: 1, bytes: new Uint8Array() }),
        setup.limits
      );
      expect(result.tokens).toEqual([]);
      const native = yield* setup.observed.snapshot;
      expect(native).toEqual({ spawned: 0, confirmed: 0 });
    })
  );
  it.effect("rejects extractor count ceilings and contradictory profiles before native work", () =>
    Effect.gen(function* () {
      const controls = yield* loadCitationTokenizerControls();
      const runtime = yield* setupCitationMetadataRuntime("bun");
      const overPatterns = yield* makeCitationTokenizer(
        { ...runtime.limits, patterns: 1 },
        runtime.runtime,
        controls.configuration
      ).pipe(
        Effect.flatMap((stage) =>
          makeCitationTestScaffoldBinding({ ...runtime.limits, patterns: 1 }).pipe(
            Effect.map((bind) => ({ ...stage, port: { ...stage.port, tokenize: bind(stage.port.tokenize) } }))
          )
        ),
        Effect.provideContext(runtime.provided),
        Effect.flip
      );
      expect(overPatterns).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "patterns" });
      const first = A.getUnsafe(controls.configuration.extractors, 0);
      const contradictory = {
        ...first,
        ordering: { ...first.ordering, id: 100 },
        recipe: { ...first.recipe, id: 100 },
        descriptor: {
          ...first.descriptor,
          profile: { ...first.descriptor.profile, minimumWidthFloor: first.descriptor.profile.minimumWidthFloor + 1 },
        },
      };
      const profileConflict = yield* makeCitationTokenizer(runtime.limits, runtime.runtime, {
        ...controls.configuration,
        extractors: [first, contradictory],
      }).pipe(
        Effect.flatMap((stage) =>
          makeCitationTestScaffoldBinding(runtime.limits).pipe(
            Effect.map((bind) => ({ ...stage, port: { ...stage.port, tokenize: bind(stage.port.tokenize) } }))
          )
        ),
        Effect.provideContext(runtime.provided),
        Effect.flip
      );
      expect(profileConflict).toMatchObject({ _tag: "CitationTokenizerFailure", reason: "invalid-configuration" });
      const observed = yield* runtime.observed.snapshot;
      expect(observed).toEqual({ spawned: 0, confirmed: 0 });
    })
  );
  it.effect("rejects malformed policy, bindings and source without native work", () =>
    Effect.gen(function* () {
      const controls = yield* loadCitationTokenizerControls();
      const runtime = yield* setupCitationMetadataRuntime("bun");
      const invalidPolicy = yield* makeCitationTokenizer({}, runtime.runtime, controls.configuration).pipe(
        Effect.flatMap((stage) =>
          makeCitationTestScaffoldBinding({}).pipe(
            Effect.map((bind) => ({ ...stage, port: { ...stage.port, tokenize: bind(stage.port.tokenize) } }))
          )
        ),
        Effect.provideContext(runtime.provided),
        Effect.flip
      );
      expect(invalidPolicy).toMatchObject({ reason: "invalid-configuration" });
      const invalidBindings = yield* setupCitationTokenizer("bun", {}).pipe(Effect.flip);
      expect(invalidBindings).toMatchObject({ reason: "invalid-configuration" });
      const setup = yield* setupCitationTokenizer("bun", controls.configuration);
      for (const source of [{}, { width: 2, bytes: new Uint8Array([1]) }, { width: 3, bytes: new Uint8Array() }]) {
        const failed = yield* setup.tokenizer.port.tokenize(source).pipe(Effect.flip);
        expect(failed).toMatchObject({ reason: "invalid-source" });
      }
      const observed = yield* setup.observed.snapshot;
      expect(observed).toEqual({ spawned: 0, confirmed: 0 });
      yield* assertCitationTokenizerCase(setup, A.getUnsafe(controls.cases, 0));
    })
  );
  it.effect("preserves source and ordering refusals before worker execution", () =>
    Effect.gen(function* () {
      const controls = yield* loadCitationTokenizerControls();
      const source = A.getUnsafe(controls.cases, 2).source;
      for (const [overrides, limit] of [
        [{ sourceUtf16: 1 }, "sourceUtf16"],
        [{ patternEvaluations: 1 }, "patternEvaluations"],
      ] as const) {
        const setup = yield* setupCitationTokenizer("bun", controls.configuration, overrides);
        const refused = yield* setup.tokenizer.port.tokenize(source).pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", operation: "extract", limit });
        const observed = yield* setup.observed.snapshot;
        expect(observed).toEqual({ spawned: 0, confirmed: 0 });
      }
    })
  );
  it.effect("refuses inherited plus selected extractor work before spawning a worker", () =>
    Effect.gen(function* () {
      const controls = yield* loadCitationTokenizerControls();
      const extractors = A.map(A.take(controls.configuration.extractors, 4), (row, index) => ({
        ...row,
        ordering: { ...row.ordering, hash: BigInt(index + 1), strings: index < 2 ? [] : row.ordering.strings },
      }));
      const configuration = { ...controls.configuration, extractors };
      const source = { width: 1, bytes: new Uint8Array([182, 32, 167]) };
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const ordering = yield* makeCitationExtractorOrdering(
        limits,
        A.map(extractors, (row) => row.ordering)
      );
      const selected = yield* ordering.ordered(source);
      expect(A.sort(selected.indices, Order.Number)).toEqual([0, 1, 2, 3]);
      // Two inherited members fit at install, but copying and selecting must still be bounded.
      const boundedOrdering = yield* makeCitationExtractorOrdering(
        { ...limits, patternEvaluations: 3 },
        A.map(extractors, (row) => row.ordering)
      );
      const orderingRefusal = yield* boundedOrdering.ordered(source).pipe(Effect.flip);
      expect(orderingRefusal).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        operation: "extract",
        limit: "patternEvaluations",
      });
      const setup = yield* setupCitationTokenizer("bun", configuration, { patternEvaluations: 3 });
      const refused = yield* setup.tokenizer.port.tokenize(source).pipe(Effect.flip);
      expect(refused).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        operation: "extract",
        limit: "patternEvaluations",
      });
      const observed = yield* setup.observed.snapshot;
      expect(observed).toEqual({ spawned: 0, confirmed: 0 });
    })
  );
  it.effect("enforces its own produced-text ceiling under a larger invocation without partial output", () =>
    Effect.gen(function* () {
      const controls = yield* loadCitationTokenizerControls();
      const setup = yield* setupCitationTokenizer("bun", controls.configuration, { producedTextUtf16: 13 });
      const maximum = (yield* defaultCitationEnginePolicy).limits.producedTextUtf16;
      const refused = yield* withCitationTestTextBudget(
        maximum,
        setup.tokenizer.port.tokenize({ width: 1, bytes: new TextEncoder().encode("Id. x") })
      ).pipe(Effect.flip);
      expect(refused).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        operation: "extract",
        limit: "producedTextUtf16",
      });
      const observed = yield* setup.observed.snapshot;
      expect(observed.spawned).toBeGreaterThan(0);
      expect(observed.confirmed).toBe(observed.spawned);
      const admission = yield* setup.admission.snapshot;
      expect(admission).toMatchObject({ active: 0, queued: 0 });
    })
  );
  it.effect("owns edition binding rows and rejects duplicate source edition identities", () =>
    Effect.gen(function* () {
      const controls = yield* loadCitationTokenizerControls();
      const objects = yield* loadCitationTokenObjectsControls();
      const { bundle } = yield* loadCitationFrozenEditionFixtures();
      const edition = { ...A.getUnsafe(objects.editionBindings, 0), ref: A.getUnsafe(bundle.editions, 0).ref };
      const configuration = { ...controls.configuration, editions: [edition] };
      const setup = yield* setupCitationTokenizer("bun", configuration);
      yield* assertCitationTokenizerCase(setup, A.getUnsafe(controls.cases, 0));
      const duplicate = yield* setupCitationTokenizer("bun", { ...configuration, editions: [edition, edition] }).pipe(
        Effect.flip
      );
      expect(duplicate).toMatchObject({ reason: "stage-failed" });
    })
  );
  for (const kind of ["bun"] as const) {
    it.effect(
      `composes real isolated captures, class recipes and native text assembly under ${kind}`,
      () =>
        Effect.gen(function* () {
          const controls = yield* loadCitationTokenizerControls();
          const setup = yield* setupCitationTokenizer(kind, controls.configuration);
          for (const index of [0, 2, 12]) yield* assertCitationTokenizerCase(setup, A.getUnsafe(controls.cases, index));
          const original = A.getUnsafe(controls.configuration.extractors, 0);
          original.pattern.bytes.fill(0);
          for (const key of original.ordering.strings) key.bytes.fill(0);
          yield* assertCitationTokenizerCase(setup, A.getUnsafe(controls.cases, 2));
          const snapshot = yield* setup.observed.snapshot;
          expect(snapshot).toEqual({ spawned: 7, confirmed: 7 });
        }),
      { timeout: 30000 }
    );
  }
  it.effect("rejects incoherent or duplicate extractor configuration before execution", () =>
    Effect.gen(function* () {
      const controls = yield* loadCitationTokenizerControls();
      const first = A.getUnsafe(controls.configuration.extractors, 0);
      const incoherent = { ...first, recipe: { ...first.recipe, id: 999 } };
      for (const configuration of [
        { ...controls.configuration, extractors: [incoherent] },
        { ...controls.configuration, extractors: [first, first] },
      ]) {
        const failure = yield* setupCitationTokenizer("bun", configuration).pipe(Effect.flip);
        expect(failure).toMatchObject({ reason: "invalid-configuration" });
      }
    })
  );
  it.effect(
    "shares raw matches, candidates and produced text across extractors and gaps without partial results",
    () =>
      Effect.gen(function* () {
        const controls = yield* loadCitationTokenizerControls();
        for (const [overrides, limit] of [
          [{ patternMatches: 1 }, "patternMatches"],
          [{ candidates: 1 }, "candidates"],
          [{ producedTextUtf16: 13 }, "producedTextUtf16"],
        ]) {
          const setup = yield* setupCitationTokenizer("bun", controls.configuration, overrides);
          const source = { width: 1, bytes: new TextEncoder().encode("Id. x") };
          const failure = yield* setup.tokenizer.port.tokenize(source).pipe(Effect.flip);
          expect(failure).toMatchObject({ limit });
          const snapshot = yield* setup.observed.snapshot;
          expect(snapshot.spawned).toBe(snapshot.confirmed);
          const admission = yield* setup.admission.snapshot;
          expect(admission).toMatchObject({ active: 0, queued: 0 });
          yield* assertCitationTokenizerCase(setup, A.getUnsafe(controls.cases, 0));
        }
        const setup = yield* setupCitationTokenizer("bun", controls.configuration, { tokens: 1 });
        const failure = yield* setup.tokenizer.port
          .tokenize({ width: 1, bytes: new TextEncoder().encode("a b") })
          .pipe(Effect.flip);
        expect(failure).toMatchObject({ limit: "tokens" });
        const snapshot = yield* setup.observed.snapshot;
        expect(snapshot).toEqual({ spawned: 0, confirmed: 0 });
      }),
    { timeout: 60000 }
  );
});
