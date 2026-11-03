/**
 * Runtime receipt emitted by the same Vitest process that executes a coverage invocation.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { createContainedFileString } from "@beep/repo-cli-kit/cli/FsGuards";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { CoverageRuntimeReceipt } from "../Quality/internal/CoverageArtifacts.schemas.ts";
import { QualityTaskConfigurationError } from "../Quality/Quality.errors.ts";
import type { Reporter, Vitest } from "vitest/node";

const encodeReceipt = S.encodeEffect(S.fromJsonString(CoverageRuntimeReceipt));

const decodeProvider = S.decodeUnknownEffect(CoverageRuntimeReceipt.fields.provider);

const emitReceipt = Effect.fn("CiCoverageReporter.emitReceipt")(function* (
  success: boolean,
  initializedProvider: O.Option<unknown>
) {
  const provider = yield* O.match(initializedProvider, {
    onSome: decodeProvider,
    onNone: () => QualityTaskConfigurationError.new("Coverage runtime reporter was not initialized by Vitest."),
  });
  const invocationId = yield* Config.schema(S.NonEmptyString, "BEEP_COVERAGE_INVOCATION_ID");
  const destination = yield* Config.schema(S.NonEmptyString, "BEEP_COVERAGE_RUNTIME_RECEIPT");
  const path = yield* Path.Path;
  if (path.isAbsolute(destination)) {
    return yield* QualityTaskConfigurationError.new("Coverage runtime receipt must be relative to the test cwd.");
  }
  const bun = O.fromUndefinedOr(process.versions.bun);
  const receipt = CoverageRuntimeReceipt.make({
    schemaVersion: "coverage-runtime/v1",
    invocationId,
    testRuntime: O.isSome(bun) ? "bun" : "node",
    runtimeVersion: O.getOrElse(bun, () => process.versions.node),
    provider,
    success,
  });
  const text = yield* encodeReceipt(receipt);
  yield* createContainedFileString(process.cwd(), destination, text);
});

/**
 * Attest the actual launcher runtime and resolved coverage provider when a Vitest invocation settles.
 *
 * **Details**
 *
 * Add this reporter only for instrumented CI invocations. Required invocation ID
 * and package-relative receipt path come from the coverage planner. The provider
 * is captured from Vitest's resolved configuration during initialization. Missing
 * configuration, an existing receipt, or an unsafe path rejects the reporter hook;
 * failed or interrupted tests produce a receipt with `success: false`.
 *
 * **Example** (Construct the reporter)
 * ```ts
 * import CoverageRuntimeReporter from "@beep/repo-cli/commands/Ci/CiCoverage.reporter"
 * const reporter = new CoverageRuntimeReporter()
 * console.log(typeof reporter.onTestRunEnd) // "function"
 * ```
 * @internal
 * @category adapters
 * @since 0.0.0
 */
export default class CoverageRuntimeReporter implements Reporter {
  #provider: O.Option<unknown> = O.none();

  /**
   * Capture the provider from Vitest's resolved invocation configuration.
   *
   * **Example** (Initialize against a resolved configuration)
   * ```ts
   * import CoverageRuntimeReporter from "@beep/repo-cli/commands/Ci/CiCoverage.reporter"
   * import { createVitest } from "vitest/node"
   * const initialize = async () => {
   *   const context = await createVitest({ config: false, coverage: { provider: "v8" } })
   *   new CoverageRuntimeReporter().onInit(context)
   *   await context.close()
   * }
   * ```
   * @param context - Vitest context with the resolved coverage configuration.
   * @category adapters
   * @since 0.0.0
   */
  onInit(context: Vitest): void {
    this.#provider = O.some(context.config.coverage.provider);
  }

  /**
   * Write the invocation receipt after Vitest supplies its terminal outcome.
   *
   * **Example** (Represent an unsuccessful invocation)
   * ```ts
   * import CoverageRuntimeReporter from "@beep/repo-cli/commands/Ci/CiCoverage.reporter"
   * const reporter = new CoverageRuntimeReporter()
   * // Vitest calls this after onInit and supplies the configured receipt environment.
   * const finishFailedInvocation = () => reporter.onTestRunEnd([], [], "failed")
   * ```
   * @param args - Vitest's completed modules, unhandled errors, and completion reason.
   * @returns Receipt persistence and scoped runtime disposal, rejecting unsafe or missing configuration.
   * @category adapters
   * @since 0.0.0
   */
  onTestRunEnd(...[, errors, reason]: Parameters<NonNullable<Reporter["onTestRunEnd"]>>): Promise<void> {
    const runtime = ManagedRuntime.make(NodeServices.layer);
    return runtime
      .runPromise(
        emitReceipt(reason === "passed" && A.isReadonlyArrayEmpty(errors), this.#provider).pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv())
        )
      )
      .finally(runtime.dispose);
  }
}
