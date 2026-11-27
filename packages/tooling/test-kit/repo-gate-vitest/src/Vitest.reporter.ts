/**
 * The Vitest reporter the shared Vitest config registers by specifier,
 * `@beep/repo-gate-vitest/Vitest.reporter`. It turns a test run into gate
 * events and writes the package's `test` record and raw log under
 * `<package>/.beep/gates/test/`.
 *
 * **Details**
 *
 * This module imports no workspace package at the top level: the
 * implementation loads when Vitest starts. If it cannot load, or a record
 * cannot be written, the reporter prints one line on stderr, turns itself
 * off and leaves the run's exit code alone. It prints nothing on success,
 * strips no reporter, patches no stream and changes no Vitest setting.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Inspectable from "effect/Inspectable";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import type { Reporter } from "vitest/node";
import type { GateVitestRun } from "./internal/GateVitestRun.ts";
import type { VitestConsoleLog, VitestError, VitestModule } from "./internal/VitestShapes.ts";

type VitestInstance = { readonly config: { readonly root: string }; readonly logger: unknown };

const PREFIX = "[@beep/repo-gate-vitest]";

const firstLine = (error: unknown): string =>
  A.headNonEmpty(Str.split(P.isError(error) ? error.message : Inspectable.toStringUnknown(error, 0), "\n"));

const switchedOff = (error: unknown): undefined => {
  Effect.runSync(Console.error(`${PREFIX} off for this run: ${firstLine(error)}`));
  return undefined;
};

type Started = { readonly run: GateVitestRun; readonly logger: unknown };

const startRun =
  (vitest: VitestInstance, argv: ReadonlyArray<string>) =>
  (module: typeof import("./internal/GateVitestRun.ts")): Started => ({
    logger: vitest.logger,
    run: module.makeGateVitestRun({ root: vitest.config.root, argv }),
  });

/**
 * The gate reporter: one per Vitest instance.
 *
 * **Example** (Register the reporter in a Vitest config)
 *
 * ```ts
 * import { configDefaults, defineConfig } from "vitest/config"
 *
 * export default defineConfig({
 *   test: { reporters: [...configDefaults.reporters, "@beep/repo-gate-vitest/Vitest.reporter"] },
 * })
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
export default class GateVitestReporter implements Reporter {
  #started: Promise<Started | undefined> = Promise.resolve(undefined);

  /**
   * Load the implementation for this Vitest instance.
   *
   * **Details**
   *
   * The reporter reads the instance's root and its logger, where a stray-output capture may be
   * published. It reads them only once the implementation has loaded, so a getter that throws
   * switches the reporter off like a failed import.
   *
   * **Example** (Construct the reporter)
   *
   * ```ts
   * import GateVitestReporter from "@beep/repo-gate-vitest/Vitest.reporter"
   *
   * console.log(typeof new GateVitestReporter().onInit) // function
   * ```
   *
   * @param vitest - The Vitest instance whose root is the package directory.
   * @returns Nothing: the implementation loads in the background, and the later hooks wait for it.
   * @category adapters
   * @since 0.0.0
   */
  onInit(vitest: VitestInstance): void {
    this.#started = import("./internal/GateVitestRun.ts").then(startRun(vitest, process.argv)).catch(switchedOff);
  }

  /**
   * Start a run: reset the start time and the console lines.
   *
   * **Example** (Start before init)
   *
   * ```ts
   * import GateVitestReporter from "@beep/repo-gate-vitest/Vitest.reporter"
   *
   * const started = new GateVitestReporter().onTestRunStart()
   * console.log(started instanceof Promise) // true
   * ```
   *
   * @returns Settles once the run is reset.
   * @category adapters
   * @since 0.0.0
   */
  onTestRunStart(): Promise<void> {
    return this.#started.then((started) => started?.run.start());
  }

  /**
   * Keep a line a test printed through `console` for the raw log.
   *
   * **Example** (Keep a console line)
   *
   * ```ts
   * import GateVitestReporter from "@beep/repo-gate-vitest/Vitest.reporter"
   *
   * const kept = new GateVitestReporter().onUserConsoleLog({ content: "hello", type: "stdout" })
   * console.log(kept instanceof Promise) // true
   * ```
   *
   * @param log - The console line and its stream.
   * @returns Settles once the line is kept.
   * @category adapters
   * @since 0.0.0
   */
  onUserConsoleLog(log: VitestConsoleLog): Promise<void> {
    return this.#started.then((started) => started?.run.console(log));
  }

  /**
   * Write the run's record and raw log.
   *
   * **Example** (Finish before init)
   *
   * ```ts
   * import GateVitestReporter from "@beep/repo-gate-vitest/Vitest.reporter"
   *
   * const finished = new GateVitestReporter().onTestRunEnd([], [], "passed")
   * console.log(finished instanceof Promise) // true
   * ```
   *
   * @param modules - Every test module of the run.
   * @param unhandledErrors - Errors thrown outside any test.
   * @param reason - Vitest's own end reason.
   * @returns Settles once the record is written or reported as not written; never rejects.
   * @category adapters
   * @since 0.0.0
   */
  onTestRunEnd(
    modules: ReadonlyArray<VitestModule>,
    unhandledErrors: ReadonlyArray<VitestError>,
    reason: string
  ): Promise<void> {
    return this.#started
      .then((started) => started?.run.finish({ modules, unhandledErrors, reason, logger: started.logger }))
      .catch(switchedOff);
  }
}
