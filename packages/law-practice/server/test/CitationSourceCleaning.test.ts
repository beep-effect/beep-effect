import { ResolvedSourceText, SourceTextResolver } from "@beep/file-processing/SourceText";
import {
  CitationOperationAdmission,
  makeCitationOperationAdmission,
} from "@beep/law-practice-server/internal/Citation/Admission";
import { CitationCleanerValues } from "@beep/law-practice-server/internal/Citation/CleanerValues";
import { makeCitationSourceCleaning } from "@beep/law-practice-server/internal/Citation/SourceCleaning";
import {
  CitationCleaner,
  CitationCleanerProduced,
  CitationEngineCleanResult,
  CitationEngineLimits,
} from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeCitationCleanerRegistryHarness } from "./CitationCleanerRegistry.fixtures.ts";
import { ownCitationTestConfiguration } from "./CitationConfigurationOwnership.fixtures.ts";
import { makeCitationTestScaffoldBinding } from "./CitationInvocation.fixtures.ts";
import { citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import type { CitationAdmissionFailure } from "@beep/law-practice-server/internal/Citation/Admission";
import type { CitationEngineFailure } from "@beep/law-practice-use-cases/server";

const setup = Effect.fn("SourceCleaningTest.setup")(function* () {
  const limits = (yield* defaultCitationEnginePolicy).limits;
  const h = yield* makeCitationCleanerRegistryHarness();
  const admission = yield* makeCitationOperationAdmission(limits);
  const proof = yield* citationFixtureSourceProof("a__b");
  const artifact = Sha256Hex.make(Str.repeat(64)("a"));
  const sourceResolver = SourceTextResolver.of({
    resolve: Effect.fn("SourceCleaningTest.resolve")(() =>
      Effect.succeed(ResolvedSourceText.make({ identity: proof.source, text: proof.sourceText }))
    ),
  });
  const install = (policy = limits, resolver = sourceResolver, reader = h.values) =>
    ownCitationTestConfiguration(CitationEngineLimits, policy).pipe(
      Effect.flatMap((owned) => makeCitationSourceCleaning(owned, artifact)),
      Effect.flatMap((stage) =>
        makeCitationTestScaffoldBinding(policy, "clean").pipe(
          Effect.map((bind) => ({ ...stage, clean: bind(stage.clean) }))
        )
      ),
      Effect.provideService(CitationOperationAdmission, admission),
      Effect.provideService(CitationCleaner, h.registry.runtime),
      Effect.provideService(CitationCleanerValues, reader),
      Effect.provideService(SourceTextResolver, resolver)
    );
  return { limits, h, admission, proof, artifact, sourceResolver, install };
});
it.layer(BunCrypto.layer)("verified source cleaner", (it) => {
  it.effect("snapshots the source/plan and returns an owned value with a detached text view/report", () =>
    Effect.gen(function* () {
      const { limits, h, admission, proof, artifact, install } = yield* setup();
      const step = yield* h.values.text("underscores");
      const request = {
        source: proof.source,
        sourceText: proof.sourceText,
        plan: "captured",
        engineArtifact: "ignored",
        limits: null,
      };
      h.hooks({
        open: Effect.fn("SourceCleaningTest.plan")(function* (plan) {
          expect(plan).toBe("captured");
          let index = 0;
          return { next: Effect.sync(() => A.get([step], index++)) };
        }),
      });
      const resolver = SourceTextResolver.of({
        resolve: Effect.fn("SourceCleaningTest.mutate")(function* () {
          const state = yield* admission.snapshot;
          expect(state).toMatchObject({ active: 1, queued: 0 });
          request.sourceText = "mutated";
          request.plan = "changed";
          return ResolvedSourceText.make({ identity: proof.source, text: proof.sourceText });
        }),
      });
      const stage = yield* install(limits, resolver);
      const invocation = stage.clean(request);
      const closed: Effect.Effect<CitationEngineCleanResult, CitationEngineFailure | CitationAdmissionFailure> =
        invocation;
      const result = yield* closed;
      expect(S.is(CitationEngineCleanResult)(result)).toBe(true);
      const text = yield* Effect.fromOption(result.text);
      expect(text).toEqual({ width: 1, bytes: new TextEncoder().encode("ab") });
      yield* h.values.assertOwned(result.value);
      expect(result.source.source).toEqual(proof.source);
      expect(result.report).toMatchObject({
        operation: "clean",
        engineArtifact: artifact,
        producedTextUtf16: 8,
        extraction: null,
      });
      const deadline = Duration.toMillis(result.report.limits.cleanDeadline);
      expect(Reflect.set(result.report.limits.cleanDeadline.value, "millis", 1)).toBe(true);
      text.bytes[0] = 120;
      const second = yield* stage.clean({ source: proof.source, sourceText: proof.sourceText, plan: "captured" });
      expect(O.getOrThrow(second.text).bytes).toEqual(new TextEncoder().encode("ab"));
      expect(Duration.toMillis(second.report.limits.cleanDeadline)).toBe(deadline);
      const stored = yield* h.values.getUnicode(result.value);
      expect(O.getOrThrow(stored).storage.bytes).toEqual(new TextEncoder().encode("ab"));
    })
  );
  it.effect("preserves non-text callback identity without coercion or text projection", () =>
    Effect.gen(function* () {
      const { h, proof, install } = yield* setup();
      const key = yield* h.values.text("custom");
      const callback = yield* h.values.retainHost("callback");
      const host = {
        get toString() {
          throw new Error("host result must not be coerced");
        },
      };
      const output = yield* h.values.retainHost(host);
      yield* h.registry.set(key, callback);
      h.select([key]);
      h.hooks({
        callable: Effect.fn("SourceCleaningTest.callable")(() => Effect.succeed(true)),
        invoke: Effect.fn("SourceCleaningTest.host")(() =>
          Effect.succeed(CitationCleanerProduced.make({ value: output, charges: [] }))
        ),
      });
      const stage = yield* install();
      const result = yield* stage.clean({ source: proof.source, sourceText: proof.sourceText, plan: "custom" });
      expect(result.value).toBe(output);
      assertNone(result.text);
      const retained = yield* h.values.getHost(result.value);
      expect(O.getOrThrow(retained)).toBe(host);
      expect(result.report.producedTextUtf16).toBe(4);
    })
  );
  it.effect("refuses a projection before allocation when its shared budget is exhausted and recovers", () =>
    Effect.gen(function* () {
      const { limits, h, proof, admission, sourceResolver, install } = yield* setup();
      const step = yield* h.values.text("underscores");
      h.select([step]);
      let projections = 0;
      const reader = CitationCleanerValues.of({
        ...h.values,
        getUnicode: Effect.fn("SourceCleaningTest.observeProjection")((value) => {
          projections++;
          return h.values.getUnicode(value);
        }),
      });
      const limited = yield* install({ ...limits, producedTextUtf16: 7 }, sourceResolver, reader);
      const request = { source: proof.source, sourceText: proof.sourceText, plan: "underscores" };
      const failed = yield* limited.clean(request).pipe(Effect.flip);
      expect(failed).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        operation: "clean",
        limit: "producedTextUtf16",
      });
      expect(projections).toBe(0);
      const state = yield* admission.snapshot;
      expect(state).toMatchObject({ active: 0, queued: 0 });
      const stage = yield* install();
      const recovered = yield* stage.clean(request);
      expect(O.getOrThrow(recovered.text).bytes).toEqual(new TextEncoder().encode("ab"));
      const malformed = yield* stage.clean(null).pipe(Effect.flip);
      expect(malformed).toMatchObject({ _tag: "CitationInputError", operation: "clean" });
    })
  );
});
