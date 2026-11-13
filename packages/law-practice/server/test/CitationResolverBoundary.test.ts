import { ResolvedSourceText, SourceTextResolver } from "@beep/file-processing/SourceText";
import {
  CitationOperationAdmission,
  makeCitationOperationAdmission,
} from "@beep/law-practice-server/internal/Citation/Admission";
import { restoreCitationDocument } from "@beep/law-practice-server/internal/Citation/Document";
import {
  CitationFrozenEditions,
  makeCitationFrozenEditions,
} from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import { captureCitationMentionReceiptData } from "@beep/law-practice-server/internal/Citation/Mention";
import { CitationRegexOperation } from "@beep/law-practice-server/internal/Citation/RegexPolicy";
import { makeCitationResolverBoundary } from "@beep/law-practice-server/internal/Citation/RegisteredResolver";
import { makeCitationResolverOperation } from "@beep/law-practice-server/internal/Citation/ResolverOperation";
import { makeCitationSourceResolution } from "@beep/law-practice-server/internal/Citation/SourceResolution";
import { CitationEngineResolutionResult } from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import { CitationCallbackObservation, prepareCallbackObservation } from "./CitationCallbackSession.fixtures.ts";
import { loadCitationFrozenEditionFixtures } from "./CitationFrozenEditions.fixtures.ts";
import { makeCitationTestScaffoldBinding } from "./CitationInvocation.fixtures.ts";
import type { CitationAdmissionFailure } from "@beep/law-practice-server/internal/Citation/Admission";
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
  it.effect("reverifies raw source and snapshotted receipts before producing a public resolution", () =>
    Effect.gen(function* () {
      const fixtures = yield* loadCitationFrozenEditionFixtures();
      const frozen = yield* makeCitationFrozenEditions(fixtures.bundle);
      const input = yield* context("raw-source-resolution");
      const admission = yield* makeCitationOperationAdmission(input.limits);
      const receipts = A.map(input.mentions, captureCitationMentionReceiptData);
      const request = {
        source: input.verifiedSource.source,
        sourceText: input.verifiedSource.sourceText,
        mentions: receipts,
        limits: null,
        engineArtifact: "ignored",
        get editions() {
          throw new Error("caller edition spellings are ignored");
        },
      };
      let calls = 0;
      const sourceResolver = SourceTextResolver.of({
        resolve: Effect.fn("RawResolutionTest.source")(function* () {
          const state = yield* admission.snapshot;
          expect(state).toMatchObject({ active: 1, queued: 0 });
          calls++;
          request.sourceText = "changed during asynchronous source work";
          Reflect.set(A.getUnsafe(receipts, 0), "id", null);
          receipts.length = 0;
          return ResolvedSourceText.make({
            identity: input.verifiedSource.source,
            text: input.verifiedSource.sourceText,
          });
        }),
      });
      const stage = yield* makeCitationSourceResolution(input.limits, input.engineArtifact).pipe(
        Effect.flatMap((stage) =>
          makeCitationTestScaffoldBinding(input.limits, "resolve").pipe(
            Effect.map((bind) => ({ ...stage, resolve: bind(stage.resolve) }))
          )
        ),
        Effect.provideService(CitationOperationAdmission, admission),
        Effect.provideService(CitationFrozenEditions, frozen),
        Effect.provideService(SourceTextResolver, sourceResolver)
      );
      const invocation = stage.resolve(request);
      const closed: Effect.Effect<
        Effect.Success<typeof invocation>,
        CitationEngineFailure | CitationAdmissionFailure
      > = invocation;
      const result = yield* closed;
      expect(S.is(CitationEngineResolutionResult)(result.output)).toBe(true);
      expect(result.output.document.mentions).toHaveLength(2);
      expect(result.output.document.authorities).toHaveLength(1);
      expect(result.output.source.source).toEqual(input.verifiedSource.source);
      expect(result.output.report).toMatchObject({
        operation: "resolve",
        engineArtifact: input.engineArtifact,
        extraction: null,
      });
      expect(calls).toBe(1);
      const restored = yield* restoreCitationDocument({
        receipt: result.receipt,
        editions: result.editions,
        resourceBindings: result.resourceBindings,
        expectedSource: input.verifiedSource.source,
        expectedEngineArtifact: input.engineArtifact,
        sourceText: input.verifiedSource.sourceText,
      });
      expect(restored).toEqual(result.output.document);
      const state = yield* admission.snapshot;
      expect(state).toMatchObject({ active: 0, queued: 0 });
      const malformed = yield* stage.resolve(null).pipe(Effect.flip);
      expect(malformed).toMatchObject({ _tag: "CitationInputError", operation: "resolve" });
      expect(calls).toBe(1);
    })
  );
  it.effect("rejects forged receipt identity and captured work exhaustion without losing admission", () =>
    Effect.gen(function* () {
      const fixtures = yield* loadCitationFrozenEditionFixtures();
      const frozen = yield* makeCitationFrozenEditions(fixtures.bundle);
      const input = yield* context("raw-resolution-refusals");
      const admission = yield* makeCitationOperationAdmission(input.limits);
      const sourceResolver = SourceTextResolver.of({
        resolve: Effect.fn("RawResolutionTest.valid")(() =>
          Effect.succeed(
            ResolvedSourceText.make({ identity: input.verifiedSource.source, text: input.verifiedSource.sourceText })
          )
        ),
      });
      const install = (limits = input.limits) =>
        makeCitationSourceResolution(limits, input.engineArtifact).pipe(
          Effect.flatMap((stage) =>
            makeCitationTestScaffoldBinding(limits, "resolve").pipe(
              Effect.map((bind) => ({ ...stage, resolve: bind(stage.resolve) }))
            )
          ),
          Effect.provideService(CitationOperationAdmission, admission),
          Effect.provideService(CitationFrozenEditions, frozen),
          Effect.provideService(SourceTextResolver, sourceResolver)
        );
      const stage = yield* install();
      const receipts = A.map(input.mentions, captureCitationMentionReceiptData);
      const request = {
        source: input.verifiedSource.source,
        sourceText: input.verifiedSource.sourceText,
        mentions: receipts,
      };
      const forged = A.copy(receipts);
      const first = A.getUnsafe(forged, 0);
      forged[0] = { ...first, id: A.getUnsafe(receipts, 1).id };
      const refusal = yield* stage.resolve({ ...request, mentions: forged }).pipe(Effect.flip);
      expect(refusal).toMatchObject({
        _tag: "CitationPrerequisiteError",
        operation: "resolve",
        dependency: "source-evidence",
      });
      const limited = yield* install({ ...input.limits, resolutionIterations: 1 });
      const exhausted = yield* limited.resolve(request).pipe(Effect.flip);
      expect(exhausted).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        operation: "resolve",
        limit: "resolutionIterations",
      });
      const sourceLimited = yield* install({ ...input.limits, sourceUtf16: 1 });
      const sourceRefusal = yield* sourceLimited.resolve(request).pipe(Effect.flip);
      expect(sourceRefusal).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        operation: "resolve",
        limit: "sourceUtf16",
      });
      const mentionLimited = yield* install({ ...input.limits, mentions: 1 });
      const mentionRefusal = yield* mentionLimited.resolve(request).pipe(Effect.flip);
      expect(mentionRefusal).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        operation: "resolve",
        limit: "mentions",
      });
      const recovered = yield* stage.resolve(request);
      expect(recovered.output.document.mentions).toHaveLength(2);
      expect(Reflect.set(recovered.output.report.limits, "resolutionIterations", 1)).toBe(true);
      expect(Reflect.set(recovered.output.report.limits.resolveDeadline.value, "millis", 1)).toBe(true);
      const afterReportMutation = yield* stage.resolve(request);
      expect(afterReportMutation.output.document.mentions).toHaveLength(2);
      expect(Duration.toMillis(afterReportMutation.output.report.limits.resolveDeadline)).toBe(
        Duration.toMillis(input.limits.resolveDeadline)
      );
      const state = yield* admission.snapshot;
      expect(state).toMatchObject({ active: 0, queued: 0 });
    })
  );
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
      const closed: Effect.Effect<
        Effect.Success<typeof invocation>,
        CitationEngineFailure | CitationAdmissionFailure
      > = invocation;
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
  it.layer(TestClock.layer())("isolated clock: 244", (it) => {
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
  });
  it.effect("retains complete resolution/receipt results and closes actual work/evidence refusals", () =>
    Effect.gen(function* () {
      const fixtures = yield* loadCitationFrozenEditionFixtures();
      const frozen = yield* makeCitationFrozenEditions(fixtures.bundle);
      const resolver = yield* makeCitationResolverBoundary().pipe(
        Effect.provideService(CitationFrozenEditions, frozen)
      );
      const input = yield* context("resolver-boundary");
      const invocation = resolver.resolve(input);
      const closed: Effect.Effect<
        Effect.Success<typeof invocation>,
        CitationEngineFailure | CitationAdmissionFailure
      > = invocation;
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
