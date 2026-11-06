/** Production composition of existing owned document/cleaner services.
 * Source behavior adapts eyecite 2.7.6, Free Law Project, BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { CitationBuiltinCleaners, makeCitationBuiltinCleaners } from "./BuiltinCleaners.ts";
import { CitationCleanerFailure, CitationCleanerRuntime, makeCitationCleanerPipeline } from "./CleanerPipeline.ts";
import { CitationCleanerProtocols, makeCitationCleanerRegistry } from "./CleanerRegistry.ts";
import { CitationCleanerValues, makeCitationCleanerValues } from "./CleanerValues.ts";
import { CitationDocumentStepContainers, makeCitationDocumentCleanerProtocols } from "./DocumentCleanerProtocols.ts";
import { CitationDocumentInputProtocols } from "./InputDocument.ts";
import { prepareCitationNativeRuntime } from "./NativeProcess.ts";

/** Compose one caller-scoped owner cohort. Host cleaner protocols are required
 * injected services, and optional host Document protocols retain their existing
 * delegation behavior. All returned methods capture their dependencies.
 * Closing the caller's Scope invalidates values/containers and retires workers.
 * Final engine wiring decides the lifetime of retained document/registry state.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationDocumentServices = Effect.fn("Citation.makeDocumentServices")(function* (
  policy: unknown,
  htmlRuntime: unknown
) {
  const host = yield* CitationCleanerProtocols;
  const { limits, runtime } = yield* prepareCitationNativeRuntime(policy, htmlRuntime, () =>
    CitationCleanerFailure.make({ reason: "invalid-input" })
  );
  const values = yield* makeCitationCleanerValues(limits);
  const builtins = yield* makeCitationBuiltinCleaners(limits, runtime).pipe(
    Effect.provideService(CitationCleanerValues, values)
  );
  const adapter = yield* makeCitationDocumentCleanerProtocols(limits).pipe(
    Effect.provideService(CitationCleanerValues, values),
    Effect.provideService(CitationCleanerProtocols, host)
  );
  const registry = yield* makeCitationCleanerRegistry(limits).pipe(
    Effect.provideService(CitationCleanerValues, values),
    Effect.provideService(CitationBuiltinCleaners, builtins),
    Effect.provideService(CitationCleanerProtocols, adapter.cleaner)
  );
  const pipeline = yield* makeCitationCleanerPipeline(limits).pipe(
    Effect.provideService(CitationCleanerRuntime, registry.runtime)
  );
  const context = Context.make(CitationCleanerValues, values).pipe(
    Context.add(CitationDocumentInputProtocols, adapter.document),
    Context.add(CitationCleanerRuntime, registry.runtime),
    Context.add(CitationDocumentStepContainers, CitationDocumentStepContainers.of({ create: adapter.create }))
  );
  return { values, builtins, adapter, registry, pipeline, context };
});
