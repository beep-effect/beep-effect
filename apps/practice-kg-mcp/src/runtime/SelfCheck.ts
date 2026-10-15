/**
 * The `--self-check` command line: runs the shared practice KG self-check for
 * this extension's version and prints its one JSON line.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  makePracticeKgSelfCheckRefusal,
  PracticeKgSelfCheckRefusal,
  PracticeKgSelfCheckReport,
  runPracticeKgSelfCheck,
} from "@beep/law-practice-server/PracticeKgHost";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as S from "effect/Schema";
import { SelfCheckFailure } from "../PracticeKgMcp.errors.ts";
import { PRACTICE_KG_EXTENSION_VERSION } from "../Version.ts";
import type { PracticeKgHostError } from "@beep/law-practice-server/PracticeKgHost";

const encodeReport = S.encodeEffect(S.fromJsonString(PracticeKgSelfCheckReport));
const encodeRefusal = S.encodeEffect(S.fromJsonString(PracticeKgSelfCheckRefusal));

// Prints the refusal line, then fails with the error that tells the main
// runner the failure is already on stdout.
const refuse = (error: PracticeKgHostError) =>
  error.pipe(
    makePracticeKgSelfCheckRefusal,
    encodeRefusal,
    Effect.orDie,
    Effect.flatMap(Console.log),
    Effect.andThen(SelfCheckFailure.make({ cause: error, message: error.message }))
  );

/**
 * Run the shared bundle self-check, reporting this extension's version.
 *
 * **Details**
 *
 * The stdio entrypoint also runs this check before starting the MCP transport.
 *
 * **Example** (Check a bundle folder)
 *
 * ```ts
 * import { runPracticeKgMcpSelfCheck } from "../../src/runtime/SelfCheck.ts"
 * import * as Effect from "effect/Effect";
 * const check = runPracticeKgMcpSelfCheck("/bundle")
 * console.log(Effect.isEffect(check)) // true
 * ```
 *
 * @param bundleDir - Directory containing `bundle.manifest.json` and both stores.
 * @param corpusRoot - Optional pointer to the external corpus content tree.
 * @category use-cases
 * @since 0.0.0
 */
export const runPracticeKgMcpSelfCheck = Effect.fn("PracticeKgSelfCheck.runMcp")(function* (
  bundleDir: string,
  corpusRoot?: string | undefined
) {
  return yield* runPracticeKgSelfCheck({ extensionVersion: PRACTICE_KG_EXTENSION_VERSION, bundleDir, corpusRoot });
});

/**
 * Print a self-check outcome as exactly one JSON line on stdout.
 *
 * **Details**
 *
 * A failing check prints `{"ok":false,"message":…}`, with the underlying
 * error text under `cause` when there is one, and then fails with
 * `SelfCheckFailure`, which exits the process non-zero without a second
 * report: nothing but the one line reaches stdout.
 *
 * **Example** (Print a self-check line)
 *
 * ```ts
 * import { printPracticeKgSelfCheck, runPracticeKgMcpSelfCheck } from "../../src/runtime/SelfCheck.ts"
 * import * as Effect from "effect/Effect";
 * const printing = printPracticeKgSelfCheck(runPracticeKgMcpSelfCheck("/bundle"))
 * console.log(Effect.isEffect(printing)) // true
 * ```
 *
 * @param check - Self-check to run and report.
 * @category use-cases
 * @since 0.0.0
 */
export const printPracticeKgSelfCheck = <R>(
  check: Effect.Effect<PracticeKgSelfCheckReport, PracticeKgHostError, R>
): Effect.Effect<void, SelfCheckFailure, R> =>
  check.pipe(
    // Both lines encode values their schemas already validated, so an encode failure is a defect.
    Effect.flatMap(flow(encodeReport, Effect.orDie)),
    Effect.matchEffect({ onFailure: refuse, onSuccess: Console.log }),
    Effect.withSpan("PracticeKgSelfCheck.print")
  );
