import { CitationCleanerProtocols } from "@beep/law-practice-server/internal/Citation/CleanerRegistry";
import { makeCitationDocumentServices } from "@beep/law-practice-server/internal/Citation/DocumentServices";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as Scope from "effect/Scope";
import { citationPrimitiveCleanerProtocols } from "./CitationDocumentServices.fixtures.ts";
import { makeCitationHtmlTestRuntime } from "./CitationNativeSpawner.fixtures.ts";
import { setupCitationMetadataRuntime } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import type { CitationCleanerObject } from "@beep/law-practice-server/internal/Citation/CleanerPipeline";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("production document services", (it) => {
  it.effect(
    "captures the supplied policy, runs named cleaning with R=never and invalidates the cohort on close",
    () =>
      Effect.gen(function* () {
        const setup = yield* setupCitationMetadataRuntime("bun", undefined, false, true);
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "citation-document-services-" });
        const runtime = yield* makeCitationHtmlTestRuntime("bun", directory);
        const scope = yield* Scope.make();
        const selected = yield* Ref.make(O.none<CitationCleanerObject>());
        const opened = yield* Ref.make(0);
        const host = CitationCleanerProtocols.of({
          ...citationPrimitiveCleanerProtocols,
          open: Effect.fn("DocumentServicesTest.hostOpen")(function* () {
            yield* Ref.update(opened, (count) => count + 1);
            return { next: Ref.getAndSet(selected, O.none()) };
          }),
        });
        const services = yield* makeCitationDocumentServices({ ...setup.limits, sourceUtf16: 5 }, runtime).pipe(
          Effect.provideContext(setup.provided),
          Effect.provideService(CitationCleanerProtocols, host),
          Effect.provideService(Scope.Scope, scope)
        );
        const source = yield* services.values.sourceText("__A__");
        const overLimit = yield* services.values.sourceText("__AA__").pipe(Effect.flip);
        expect(overLimit).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "sourceUtf16" });
        const container = yield* services.adapter.create({ kind: "list", names: ["underscores"] });
        const plan = yield* services.adapter.document.plan(container);
        const run = services.pipeline.runOwned({ value: source, plan });
        const closed: Effect.Effect<Effect.Success<typeof run>, Effect.Error<typeof run>> = run;
        const result = yield* closed;
        const text = yield* services.values.getText(result.value);
        expect(O.getOrThrow(text).text).toBe("A");
        expect(result.producedTextUtf16).toBe(1);
        const step = yield* services.values.builtinName("underscores");
        yield* Ref.set(selected, O.some(step));
        const delegated = yield* services.pipeline.runOwned({ value: source, plan: "host-plan" });
        const delegatedText = yield* services.values.getText(delegated.value);
        expect(O.getOrThrow(delegatedText).text).toBe("A");
        const hostCalls = yield* Ref.get(opened);
        expect(hostCalls).toBe(1);
        yield* Scope.close(scope, Exit.void);
        const retiredValue = yield* services.values.getText(source).pipe(Effect.flip);
        const retiredContainer = yield* services.adapter.document.plan(container).pipe(Effect.flip);
        const retiredCreation = yield* services.adapter.create({ kind: "list", names: [] }).pipe(Effect.flip);
        expect(retiredValue).toMatchObject({ reason: "closed-owner" });
        expect(retiredContainer).toMatchObject({ reason: "closed-owner" });
        expect(retiredCreation).toMatchObject({ reason: "closed-owner" });
        const counts = yield* setup.observed.snapshot;
        expect(counts).toEqual({ spawned: 0, confirmed: 0 });
      }),
    { timeout: 60000 }
  );
});
