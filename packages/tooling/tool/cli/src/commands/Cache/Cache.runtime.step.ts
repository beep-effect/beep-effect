/**
 * Cache runtime step routing: the identity-override guard and the rewrite
 * that sends an ordinary Turbo task through `beep cache execute`.
 *
 * **Details**
 *
 * Split from `Cache.runtime.ts` so the quality task runner and CI lanes route
 * their steps without importing the cache runtime's census, fingerprint and
 * signing engines (beep-cli-composition W1b).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as NodeURL from "node:url";
import { isPlannedTurboCommand } from "@beep/repo-cli-kit/cli/EnvConfig";
import { QualityTaskStep } from "@beep/repo-cli-kit/process/index";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { CacheCommandError } from "./Cache.errors.ts";

/**
 * Identify explicit Turbo inspection modes before the task argument separator.
 *
 * **Example** (Recognize a dry plan option)
 *
 * ```ts
 * import { isCacheTaskInspectionArg } from "@beep/repo-cli/commands/Cache"
 * console.log(isCacheTaskInspectionArg("--dry=json")) // true
 * ```
 *
 * @param arg - A Turbo option before the task argument separator.
 * @returns Whether the option requests inspection instead of task execution.
 * @category predicates
 * @since 0.0.0
 */
export const isCacheTaskInspectionArg = (arg: string): boolean =>
  A.some(
    ["--dry", "--dry-run", "--graph", "--help", "--version", "-h", "-V"],
    (option) => arg === option || Str.startsWith(`${option}=`)(arg)
  );

/**
 * Reject caller-provided cache identity before ordinary Turbo task execution.
 *
 * **Details**
 * Checks ambient and step environments separately so one cannot hide the other.
 * Empty values are supplied values. Successful validation does not calculate an
 * identity or authorize cache reuse; the runtime must compute its own identity.
 *
 * **Example** (Accept an environment without an identity override)
 *
 * ```ts
 * import { assertCacheRuntimeKeyUnspecified } from "@beep/repo-cli/commands/Cache"
 * import * as Effect from "effect/Effect"
 *
 * Effect.runSync(assertCacheRuntimeKeyUnspecified("bunx", ["turbo", "run", "lint"], {}, {}))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const assertCacheRuntimeKeyUnspecified = Effect.fn("Cache.assertCacheRuntimeKeyUnspecified")(function* (
  command: string,
  args: ReadonlyArray<string>,
  ambient: Readonly<Record<string, string | undefined>>,
  step: Readonly<Record<string, string | undefined>>
) {
  if (
    isPlannedTurboCommand(command, args) &&
    (ambient.BEEP_CACHE_TOOLCHAIN_DIGEST !== undefined || step.BEEP_CACHE_TOOLCHAIN_DIGEST !== undefined)
  ) {
    return yield* CacheCommandError.new(
      "BEEP_CACHE_TOOLCHAIN_DIGEST must be computed by the cache runtime; caller overrides are not accepted."
    );
  }
});

/**
 * Route a planned Turbo execution through Cache inside its existing wrapper.
 *
 * **Details**
 * Derive environment overrides and ambient-extension policy from the original
 * step before applying this rewrite. The child invokes this checkout's CLI
 * directly without reloading environment files. Inspection commands are unchanged.
 *
 * **Example** (Rewrite an ordinary repository task)
 *
 * ```ts
 * import { cacheRuntimeStep } from "@beep/repo-cli/commands/Cache"
 * import { QualityTaskStep } from "@beep/repo-cli/test/Quality"
 *
 * const step = QualityTaskStep.make({ label: "lint", command: "bunx", args: ["turbo", "run", "lint"], cwd: "." })
 * console.log(cacheRuntimeStep(step).command) // bun
 * ```
 *
 * @param step - The original planned invocation whose environment policy is retained.
 * @returns The routed execution step, or the original inspection or non-Turbo step.
 * @category commands
 * @since 0.0.0
 */
export const cacheRuntimeStep = (step: QualityTaskStep): QualityTaskStep => {
  if (!isPlannedTurboCommand(step.command, step.args)) return step;
  const prefix =
    step.command === "op"
      ? O.match(
          A.findFirstIndex(step.args, (arg) => arg === "--"),
          {
            onNone: A.empty<string>,
            onSome: (index) => A.take(step.args, index + 1),
          }
        )
      : A.empty<string>();
  const unwrapped = prefix.length > 0 ? A.drop(step.args, prefix.length) : [step.command, ...step.args];
  const args = A.drop(unwrapped, unwrapped[0] === "bunx" ? 2 : 1);
  if (
    !O.exists(A.head(args), (arg) => arg === "run") ||
    A.some(
      A.takeWhile(args, (arg) => arg !== "--"),
      isCacheTaskInspectionArg
    )
  )
    return step;
  const entrypoint = NodeURL.fileURLToPath(
    new URL(Str.endsWith(".ts")(import.meta.url) ? "../../bin.ts" : "../../bin.js", import.meta.url)
  );
  const child = ["--no-env-file", entrypoint, "cache", "execute", "--", ...args];
  const [command, routedArgs] =
    prefix.length > 0 ? Tuple.make("op", [...prefix, "bun", ...child]) : Tuple.make("bun", child);
  return QualityTaskStep.make({ ...step, command, args: routedArgs });
};
