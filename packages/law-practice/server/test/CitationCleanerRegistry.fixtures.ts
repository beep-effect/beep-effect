/** Scoped registry protocol test harness. @internal @packageDocumentation @since 0.0.0 */
import * as NodeURL from "node:url";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import { CitationBuiltinCleaners, makeCitationBuiltinCleaners } from "../src/internal/Citation/BuiltinCleaners.ts";
import {
  CitationCleanerFailure,
  CitationCleanerRuntime,
  makeCitationCleanerPipeline,
} from "../src/internal/Citation/CleanerPipeline.ts";
import { CitationCleanerProtocols, makeCitationCleanerRegistry } from "../src/internal/Citation/CleanerRegistry.ts";
import { CitationCleanerValues, makeCitationCleanerValues } from "../src/internal/Citation/CleanerValues.ts";
import { makeCitationPythonHash } from "../src/internal/Citation/PythonHash.ts";
import type { CitationCleanerObject, CitationCleanerWork } from "../src/internal/Citation/CleanerPipeline.ts";

const fail = () => CitationCleanerFailure.make({ reason: "callback-failed" });
/** Capture real registry/value/builtin ownership for one scoped test.
 * @internal @category testing @since 0.0.0
 */
export const makeCitationCleanerRegistryHarness = Effect.fn("CleanerRegistryTest.setup")(function* (
  iterations?: number,
  authorities?: number
) {
  const base = (yield* defaultCitationEnginePolicy).limits;
  const limits = {
    ...base,
    authorities: O.getOrElse(O.fromUndefinedOr(authorities), () => base.authorities),
    resolutionIterations: O.getOrElse(O.fromUndefinedOr(iterations), () => base.resolutionIterations),
  };
  const values = yield* makeCitationCleanerValues(limits);
  const builtin = yield* makeCitationBuiltinCleaners(limits, {
    executable: process.execPath,
    cwd: process.cwd(),
    workerFile: NodeURL.fileURLToPath(new URL("../src/internal/Citation/HtmlWorker.entry.ts", import.meta.url)),
  }).pipe(
    Effect.provideService(CitationCleanerValues, values),
    Effect.provideService(
      ChildProcessSpawner.ChildProcessSpawner,
      ChildProcessSpawner.make(() => Effect.die("Registry unit tests must not start native workers"))
    )
  );
  let steps = A.empty<CitationCleanerObject>();
  let work = O.none<CitationCleanerWork>();
  let calls = A.empty<string>();
  const defaults = CitationCleanerProtocols.of({
    hash: Effect.fn("CleanerRegistryTest.defaultHash")(() => Effect.fail(fail())),
    equal: Effect.fn("CleanerRegistryTest.defaultEqual")(() => Effect.fail(fail())),
    callable: Effect.fn("CleanerRegistryTest.defaultCallable")(() => Effect.succeed(false)),
    invoke: Effect.fn("CleanerRegistryTest.defaultInvoke")(() => Effect.fail(fail())),
    open: Effect.fn("CleanerRegistryTest.open")(function* (_plan, _value, current) {
      work = O.some(current);
      let cursor = 0;
      return { next: Effect.sync(() => A.get(steps, cursor++)) };
    }),
  });
  let hooks = defaults;
  const protocols = CitationCleanerProtocols.of({
    hash: Effect.fn("CleanerRegistryTest.hash")((value) =>
      Effect.suspend(() => {
        calls = A.append(calls, "hash");
        return hooks.hash(value);
      })
    ),
    equal: Effect.fn("CleanerRegistryTest.equal")((left, right) =>
      Effect.suspend(() => {
        calls = A.append(calls, "equal");
        return hooks.equal(left, right);
      })
    ),
    callable: Effect.fn("CleanerRegistryTest.callable")((value, current) =>
      Effect.suspend(() => {
        calls = A.append(calls, "callable");
        return hooks.callable(value, current);
      })
    ),
    invoke: Effect.fn("CleanerRegistryTest.invoke")((fn, value, current) =>
      Effect.suspend(() => {
        calls = A.append(calls, "invoke");
        return hooks.invoke(fn, value, current);
      })
    ),
    open: Effect.fn("CleanerRegistryTest.captureOpen")((plan, value, current) => hooks.open(plan, value, current)),
  });
  const registry = yield* makeCitationCleanerRegistry(limits).pipe(
    Effect.provideService(CitationCleanerValues, values),
    Effect.provideService(CitationBuiltinCleaners, builtin),
    Effect.provideService(CitationCleanerProtocols, protocols)
  );
  const pipeline = yield* makeCitationCleanerPipeline(limits).pipe(
    Effect.provideService(CitationCleanerRuntime, registry.runtime)
  );
  return {
    values,
    registry,
    pipeline,
    hashes: yield* makeCitationPythonHash(limits),
    select: (next: ReadonlyArray<CitationCleanerObject>) => {
      steps = A.fromIterable(next);
    },
    hooks: (next: Partial<typeof hooks>) => {
      hooks = { ...defaults, ...next };
      calls = [];
    },
    calls: Effect.sync(() => calls),
    work: Effect.flatMap(
      Effect.sync(() => work),
      Effect.fromOption
    ),
  };
});
