/**
 * Resolve the coverage source census under the canonical invocation's actual runtime.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { messageWithCause } from "@beep/repo-cli-kit/cli/CommandErrorFields";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { IstanbulCoverageProvider } from "@vitest/coverage-istanbul/dist/provider.js";
import { V8CoverageProvider } from "@vitest/coverage-v8/dist/provider.js";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { createVitest, parseCLI } from "vitest/node";
import { QualityTaskConfigurationError } from "../Quality.errors.ts";
import type { Vitest } from "vitest/node";

const encodeFiles = S.encodeEffect(S.fromJsonString(S.Array(S.String)));
const boundaryError = (message: string) => (cause: unknown) =>
  QualityTaskConfigurationError.new(messageWithCause(message, cause));

/**
 * Discover configured sources without collecting or executing test bodies.
 *
 * **Example** (Inspect discovery construction)
 * ```ts
 * import { CoverageConfig } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(CoverageConfig.inspectCoverageRuntimeSources(["vitest", "run"])))
 * ```
 * @internal
 * @category discovery
 * @since 0.0.0
 */
export const inspectCoverageRuntimeSources = Effect.fn("CoverageConfig.inspectSources")(function* (
  argv: ReadonlyArray<string>
) {
  const zeroWitness = yield* Config.String("BEEP_COVERAGE_V8_ZERO_WITNESS").pipe(Config.option);
  const expectedRuntime = yield* Config.String("BEEP_COVERAGE_EXPECTED_RUNTIME");
  const expectedVersion = yield* Config.String("BEEP_COVERAGE_EXPECTED_RUNTIME_VERSION");
  const expectedProvider = yield* Config.Literals(["istanbul", "v8"], "BEEP_COVERAGE_EXPECTED_PROVIDER");
  const actualRuntime = process.versions.bun === undefined ? "node" : "bun";
  const actualVersion = process.versions.bun ?? process.versions.node;
  if (actualRuntime !== expectedRuntime || actualVersion !== expectedVersion) {
    return yield* QualityTaskConfigurationError.new(
      `Coverage discovery runtime differs from the canonical invocation: expected ${expectedRuntime} ${expectedVersion}; received ${actualRuntime} ${actualVersion}.`
    );
  }
  const parsed = yield* Effect.try({
    try: () => parseCLI(A.fromIterable(argv)),
    catch: boundaryError("Cannot parse canonical coverage discovery arguments."),
  });
  return yield* Effect.acquireUseRelease(
    Effect.tryPromise({
      try: () =>
        createVitest({
          root: process.cwd(),
          ...parsed.options,
          watch: false,
          coverage: { ...parsed.options.coverage, enabled: true, provider: expectedProvider, clean: false },
        }),
      catch: boundaryError("Cannot resolve invocation coverage configuration."),
    }),
    Effect.fnUntraced(function* (context: Vitest) {
      const provider = expectedProvider === "v8" ? new V8CoverageProvider() : new IstanbulCoverageProvider();
      yield* Effect.try({
        try: () => provider.initialize(context),
        catch: boundaryError("Cannot initialize invocation coverage discovery."),
      });
      if (O.isSome(zeroWitness)) {
        if (!(provider instanceof V8CoverageProvider))
          return yield* QualityTaskConfigurationError.new("Zero-unit discovery requires the V8 provider.");
        const map = yield* Effect.tryPromise({
          try: () => provider.generateCoverage({ allTestsRun: true }),
          catch: boundaryError("Cannot derive provider-backed V8 zero-unit witnesses."),
        });
        return A.filter(map.files(), (file) => {
          const data = map.fileCoverageFor(file).toJSON();
          return (
            R.keys(data.statementMap).length === 0 &&
            R.keys(data.fnMap).length === 0 &&
            R.keys(data.branchMap).length === 0
          );
        });
      }
      const files = yield* Effect.tryPromise({
        try: () => provider.getUntestedFiles([]),
        catch: boundaryError("Cannot discover invocation coverage sources."),
      });
      return A.sort(A.dedupe(files), Order.String);
    }),
    (context) => Effect.promise(() => context.close())
  );
});

/**
 * Run the isolated runtime's discovery entry point with its canonical argv.
 *
 * **Example** (Inspect the child bootstrap)
 * ```ts
 * import { CoverageConfig } from "@beep/repo-cli/test/Quality"
 * console.log(typeof CoverageConfig.runCoverageConfigRuntimeDiscovery) // "function"
 * ```
 * @param argv - Child process arguments followed by the canonical Vitest invocation.
 * @internal
 * @category runtime
 * @since 0.0.0
 */
export const runCoverageConfigRuntimeDiscovery = (argv: ReadonlyArray<string>): void => {
  NodeRuntime.runMain(
    inspectCoverageRuntimeSources(A.drop(argv, 1)).pipe(Effect.flatMap(encodeFiles), Effect.flatMap(Console.log))
  );
};
