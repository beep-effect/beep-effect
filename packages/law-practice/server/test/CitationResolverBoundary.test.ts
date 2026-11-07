import {
  CitationOperationAdmission,
  makeCitationOperationAdmission,
} from "@beep/law-practice-server/internal/Citation/Admission";
import {
  CitationFrozenEditions,
  makeCitationFrozenEditions,
} from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import { CitationRegexOperation } from "@beep/law-practice-server/internal/Citation/RegexPolicy";
import { makeCitationResolverBoundary } from "@beep/law-practice-server/internal/Citation/RegisteredResolver";
import { makeCitationResolverOperation } from "@beep/law-practice-server/internal/Citation/ResolverOperation";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as TestClock from "effect/testing/TestClock";
import { CitationCallbackObservation, prepareCallbackObservation } from "./CitationCallbackSession.fixtures.ts";
import { loadCitationFrozenEditionFixtures } from "./CitationFrozenEditions.fixtures.ts";
import type { CitationEngineFailure } from "@beep/law-practice-use-cases/server";

const context = Effect.fn("ResolverBoundaryTest.context")((name: string) =>
  prepareCallbackObservation(
    CitationCallbackObservation.make({
      name,
      kinds: ["case", "id"],
      pages: {},
      bindings: {},
      events: [],
      outcome: { status: "value", groups: [] },
    })
  )
);
it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("registered resolver method boundary", (it) => {
  it.effect("captures resolver policy/artifact and admission rather than caller replacements", () =>
    Effect.gen(function* () {
      const fixtures = yield* loadCitationFrozenEditionFixtures();
      const frozen = yield* makeCitationFrozenEditions(fixtures.bundle);
      const input = yield* context("admitted-resolver-capture");
      const limits = { ...input.limits };
      const admission = yield* makeCitationOperationAdmission(limits);
      const resolver = yield* makeCitationResolverOperation(limits, input.engineArtifact).pipe(
        Effect.provideService(CitationOperationAdmission, admission),
        Effect.provideService(CitationFrozenEditions, frozen),
        Effect.provideService(CitationRegexOperation, "annotate")
      );
      expect(Reflect.set(limits, "resolutionIterations", 1)).toBe(true);
      const before = yield* resolver.resolve(input);
      let replaced = false;
      const replacement = CitationOperationAdmission.of({
        snapshot: admission.snapshot,
        run: Effect.fn("ResolverTest.replacement")((_, body) => {
          replaced = true;
          return body;
        }),
      });
      const invocation = resolver
        .resolve({ ...input, limits: null, engineArtifact: "invalid" })
        .pipe(
          Effect.provideService(CitationOperationAdmission, replacement),
          Effect.provideService(CitationRegexOperation, "clean")
        );
      const closed: Effect.Effect<Effect.Success<typeof invocation>, CitationEngineFailure> = invocation;
      const after = yield* closed;
      expect(after.receipt).toEqual(before.receipt);
      expect(after.document.authorities).toHaveLength(1);
      expect(replaced).toBe(false);
      const snapshot = yield* admission.snapshot;
      expect(snapshot).toMatchObject({ active: 0, queued: 0 });
      const refused = yield* resolver.resolve(null).pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "CitationInputError", operation: "resolve" });
    })
  );
  it.effect("enforces captured work ceilings despite a larger request policy", () =>
    Effect.gen(function* () {
      const fixtures = yield* loadCitationFrozenEditionFixtures();
      const frozen = yield* makeCitationFrozenEditions(fixtures.bundle);
      const input = yield* context("admitted-resolver-budget");
      const limits = { ...input.limits, resolutionIterations: 1 };
      const admission = yield* makeCitationOperationAdmission(limits);
      const resolver = yield* makeCitationResolverOperation(limits, input.engineArtifact).pipe(
        Effect.provideService(CitationOperationAdmission, admission),
        Effect.provideService(CitationFrozenEditions, frozen)
      );
      const failed = yield* resolver.resolve(input).pipe(Effect.flip);
      expect(failed).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        operation: "resolve",
        limit: "resolutionIterations",
      });
      const recovered = yield* resolver.resolve({ ...input, mentions: [] });
      expect(recovered.document.mentions).toEqual([]);
      const snapshot = yield* admission.snapshot;
      expect(snapshot).toMatchObject({ active: 0, queued: 0 });
    })
  );
  it.effect("includes admission waiting in resolve timing and returns cancelled queue capacity", () =>
    Effect.gen(function* () {
      const fixtures = yield* loadCitationFrozenEditionFixtures();
      const frozen = yield* makeCitationFrozenEditions(fixtures.bundle);
      const input = yield* context("admitted-resolver-timing");
      const limits = {
        ...input.limits,
        concurrentOperations: 1,
        queuedOperations: 1,
        resolveDeadline: Duration.millis(20),
        queueDeadline: Duration.millis(500),
        operationDeadline: Duration.seconds(1),
      };
      const admission = yield* makeCitationOperationAdmission(limits);
      const resolver = yield* makeCitationResolverOperation(limits, input.engineArtifact).pipe(
        Effect.provideService(CitationOperationAdmission, admission),
        Effect.provideService(CitationFrozenEditions, frozen)
      );
      const entered = yield* Deferred.make<void>();
      const release = yield* Deferred.make<void>();
      const holder = yield* admission
        .run("extract", Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(release))))
        .pipe(Effect.forkChild);
      yield* Deferred.await(entered);
      const queued = yield* resolver.resolve(input).pipe(Effect.flip, Effect.forkChild);
      yield* TestClock.adjust(Duration.millis(20));
      const failed = yield* Fiber.join(queued);
      expect(failed).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        operation: "resolve",
        limit: "resolveDeadline",
      });
      const first = yield* admission.snapshot;
      expect(first).toMatchObject({ active: 1, queued: 0 });
      const cancelled = yield* resolver.resolve(input).pipe(Effect.forkChild);
      yield* TestClock.adjust(Duration.zero);
      yield* Fiber.interrupt(cancelled);
      const exit = yield* Fiber.await(cancelled);
      expect(Exit.hasInterrupts(exit)).toBe(true);
      const second = yield* admission.snapshot;
      expect(second).toMatchObject({ active: 1, queued: 0 });
      yield* Deferred.succeed(release, undefined);
      yield* Fiber.join(holder);
      const recovered = yield* resolver.resolve(input);
      expect(recovered.document.mentions).toHaveLength(2);
    })
  );
  it.effect("retains complete resolution/receipt results and closes actual work/evidence refusals", () =>
    Effect.gen(function* () {
      const fixtures = yield* loadCitationFrozenEditionFixtures();
      const frozen = yield* makeCitationFrozenEditions(fixtures.bundle);
      const resolver = yield* makeCitationResolverBoundary().pipe(
        Effect.provideService(CitationFrozenEditions, frozen)
      );
      const input = yield* context("resolver-boundary");
      const invocation = resolver.resolve(input);
      const closed: Effect.Effect<Effect.Success<typeof invocation>, CitationEngineFailure> = invocation;
      const before = yield* closed;
      expect(before.document.mentions).toHaveLength(2);
      expect(before.document.authorities).toHaveLength(1);
      const limited = yield* resolver
        .resolve({ ...input, limits: { ...input.limits, resolutionIterations: 1 } })
        .pipe(Effect.flip);
      expect(limited).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        operation: "resolve",
        limit: "resolutionIterations",
      });
      const other = yield* context("other-resolver-source");
      const mismatch = yield* resolver.resolve({ ...input, verifiedSource: other.verifiedSource }).pipe(Effect.flip);
      expect(mismatch).toMatchObject({
        _tag: "CitationPrerequisiteError",
        operation: "resolve",
        dependency: "source-evidence",
      });
      const after = yield* resolver.resolve(input);
      expect(after.receipt).toEqual(before.receipt);
      expect(after.resourceBindings).toEqual(before.resourceBindings);
    })
  );
});
