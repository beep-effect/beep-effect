/**
 * Runtime identity input checks for ordinary task execution.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { isPlannedTurboCommand } from "../../internal/cli/EnvConfig.ts";
import { hashFileSha256 } from "../../internal/cli/FsGuards.ts";
import { QualityTaskStep } from "../../internal/process/index.ts";
import { runToExit } from "../../internal/process/StepExec.ts";
import { collectCacheTaskSelection, isCacheTaskInspectionArg, resolveCacheTurboBinary } from "./Cache.census.ts";
import { collectCacheToolchain, hashCacheToolchain } from "./Cache.fingerprint.ts";
import { CacheCommandError } from "./Cache.schemas.ts";

/**
 * Reject caller-provided cache identity before ordinary Turbo task execution.
 *
 * **Example** (Accept an environment without an identity override)
 *
 * ```ts
 * import { assertCacheRuntimeKeyUnspecified } from "@beep/repo-cli/commands/Cache"
 * import { Effect } from "effect"
 *
 * Effect.runSync(assertCacheRuntimeKeyUnspecified("bunx", ["turbo", "run", "lint"], {}, {}))
 * ```
 *
 * **Details**
 * Checks ambient and step environments separately so one cannot hide the other.
 * Empty values are supplied values. Successful validation does not calculate an
 * identity or authorize cache reuse; the runtime must compute its own identity.
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
 * Run native Turbo with a calculated key for enabled governed task caching.
 *
 * **Example** (Prepare a types-only execution)
 *
 * ```ts
 * import { runCacheRuntimeTasks } from "@beep/repo-cli/commands/Cache"
 * import { Effect } from "effect"
 *
 * console.assert(Effect.isEffect(runCacheRuntimeTasks(".", ["run", "lint", "--filter=@beep/types"])))
 * ```
 *
 * **Details**
 * Invoke inside the final resolved child environment. Selection includes task
 * dependencies. Disabled caching does not require a supported toolchain profile.
 * The calculated key is applied only at the native spawn and cannot be replaced
 * by caller input. This does not promote a qualification or authorize activation.
 *
 * @category execution
 * @since 0.0.0
 */
export const runCacheRuntimeTasks = Effect.fn("Cache.runRuntimeTasks")(function* (
  root: string,
  args: ReadonlyArray<string>
) {
  const ambient = Bun.env;
  yield* assertCacheRuntimeKeyUnspecified("bunx", ["turbo", ...args], ambient, {});
  if (ambient.TURBO_BINARY_PATH !== undefined && ambient.TURBO_BINARY_PATH !== "") {
    return yield* CacheCommandError.new(
      "Runtime execution requires the installed native Turbo client, without overrides."
    );
  }
  const nodes = yield* collectCacheTaskSelection(root, args);
  const turbo = yield* resolveCacheTurboBinary(root);
  const needsKey = A.some(
    nodes,
    (node) =>
      O.isSome(node.command) &&
      node.configuration.cache &&
      A.contains(node.configuration.env, "BEEP_CACHE_TOOLCHAIN_DIGEST")
  );
  let environment: Record<string, string> = {};
  if (needsKey) {
    const toolchain = yield* collectCacheToolchain(root);
    const actualClient = yield* hashFileSha256(turbo, (cause) =>
      CacheCommandError.new("Cannot verify the execution client.", cause)
    );
    if (actualClient !== toolchain.turbo.sha256) {
      return yield* CacheCommandError.new("The native execution client changed during runtime observation.");
    }
    environment = { BEEP_CACHE_TOOLCHAIN_DIGEST: yield* hashCacheToolchain(toolchain) };
  }
  return yield* runToExit({
    command: turbo,
    args,
    cwd: root,
    env: environment,
    extendEnv: true,
    stdin: "inherit",
    stdio: "inherit",
  });
}, CacheCommandError.mapError("Cache runtime execution failed."));

/**
 * Route a planned Turbo execution through Cache inside its existing wrapper.
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
 * **Details**
 * Derive environment overrides and ambient-extension policy from the original
 * step before applying this rewrite. The child invokes this checkout's CLI
 * directly without reloading environment files. Inspection commands are unchanged.
 *
 * @category execution
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
  const args = A.drop(step.args, prefix.length + (step.command === "op" ? 2 : 1));
  if (
    !O.exists(A.head(args), (arg) => arg === "run") ||
    A.some(
      A.takeWhile(args, (arg) => arg !== "--"),
      isCacheTaskInspectionArg
    )
  )
    return step;
  const entrypoint = fileURLToPath(
    new URL(Str.endsWith(".ts")(import.meta.url) ? "../../bin.ts" : "../../bin.js", import.meta.url)
  );
  const child = ["--no-env-file", entrypoint, "cache", "execute", "--", ...args];
  return QualityTaskStep.make({
    ...step,
    command: step.command === "op" ? "op" : "bun",
    args: step.command === "op" ? [...prefix, "bun", ...child] : child,
  });
};
