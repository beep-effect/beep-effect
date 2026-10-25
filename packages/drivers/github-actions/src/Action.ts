/**
 * The entry point an action's `main`, `pre` and `post` scripts call.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { WorkflowCommand } from "@beep/github-commands";
import { $GithubActionsId } from "@beep/identity/packages";
import { NodeServices } from "@effect/platform-node";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as Bool from "effect/Boolean";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as LogLevel from "effect/LogLevel";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as References from "effect/References";
import * as Result from "effect/Result";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ActionEnvironment } from "./ActionEnvironment.ts";
import { ActionInput } from "./ActionInput.ts";
import { ActionLogger } from "./ActionLogger.ts";
import { ActionOutputs } from "./ActionOutputs.ts";
import { ActionState } from "./ActionState.ts";
import type * as HttpClient from "effect/http/HttpClient";

const $I = $GithubActionsId.create("Action");

/**
 * Everything {@link ActionRuntime.layer} provides.
 *
 * **Details**
 *
 * Spelled out rather than inferred so a caller can name it — a program written
 * against `ActionServices` is a program `Action.run` can run, and the compiler
 * says so before the runner does.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ActionServices =
  | ActionEnvironment
  | ActionLogger
  | ActionOutputs
  | ActionState
  | NodeServices.NodeServices
  | HttpClient.HttpClient;

/**
 * The default runtime an action executes inside.
 *
 * **Details**
 *
 * The one place in the kit where `@effect/platform-node` is composed rather
 * than left to the consumer, and the reason is that there is no second answer:
 * a GitHub Action is a Node process on a GitHub-provided runner.
 *
 * **The cache, artifact and blob services are deliberately NOT in here.** They
 * are the only modules that import `@azure/storage-blob`, and folding them into
 * the default runtime would put a blob-storage client in the bundle of every
 * action that merely sets an output. Their requirements are all satisfied by
 * this layer, so taking one costs a caller exactly one line:
 * `Action.run(program, { layer: ActionCache.layer })`.
 *
 * **Example** (Inspect the default action runtime)
 *
 * ```ts
 * import { ActionRuntime } from "@beep/github-actions/Action";
 * import * as Layer from "effect/Layer";
 *
 * console.log(Layer.isLayer(ActionRuntime.layer)) // true
 * ```
 *
 * @public
 * @category layers
 * @since 0.0.0
 */
export class ActionRuntime {
  private constructor() {}

  /**
   * The composed default: the runner services, the platform, an HTTP client
   * and the workflow-command `Logger`.
   *
   * **Details**
   *
   * A bound constant rather than a factory. A layer-returning function mints a
   * fresh layer per call, and layers memoize by reference — a factory here
   * would rebuild the environment snapshot for every composition site.
   *
   * **Example** (Compose the default runner services)
   *
   * ```ts
   * import { ActionRuntime } from "@beep/github-actions/Action";
   * import * as Layer from "effect/Layer";
   *
   * const runtime = ActionRuntime.layer;
   * console.log(Layer.isLayer(runtime)) // true
   * ```
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<ActionServices> = Layer.mergeAll(
    ActionLogger.layer,
    // The named constant, not a second spelling of it: two `Logger.layer([...])`
    // values with the same contents are different layers and memoize separately.
    ActionLogger.layerLogger,
    ActionState.layer,
    // The inputs-first config provider, NOT the record-backed test double
    // (`ActionInput.layer()`, which replaces the environment lookup wholesale
    // and stays exported for resolving inputs from an explicit record in a
    // test). This one changes bare `Config` reads only: a flat name tries the
    // runner's INPUT_ derivation first and then falls back to the ambient
    // lookup unchanged. It is needed because the runner publishes
    // INPUT_<MANGLED>, so a plain-named lookup finds nothing and every bare
    // read would silently fall back to its `withDefault`. A caller-supplied provider in the `layer` option still wins:
    // the extra layer's context merges last in `Action.run`'s composition.
    ActionInput.layerDefault
  ).pipe(
    // `provideMerge` rather than a flat `mergeAll`, and the difference is the
    // whole wiring: `ActionState` needs `ActionOutputs` (it masks before it
    // persists) and `ActionOutputs` needs `ActionEnvironment`. Merged as
    // siblings they would not see each other, and the layer would not build.
    Layer.provideMerge(ActionOutputs.layer),
    Layer.provideMerge(ActionEnvironment.layer),
    Layer.provideMerge(Layer.mergeAll(NodeServices.layer, FetchHttpClient.layer))
  );
}

/**
 * How to run an action.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface ActionRunOptions<R> {
  /**
   * Services the program needs beyond {@link ActionServices}.
   *
   * **Details**
   *
   * It may require anything {@link ActionRuntime.layer} provides — which is
   * what makes `{ layer: ActionCache.layer }` compile with no further wiring.
   * @since 0.0.0
   */
  readonly layer?: Layer.Layer<R, never, ActionServices> | undefined;
  /**
   * Whether step debugging lowers the minimum log level to `Debug`.
   *
   * **Details**
   *
   * Defaults to `true`. With step debugging on (`RUNNER_DEBUG=1`, read through
   * {@link ActionEnvironmentShape.isDebug}), `Action.run` lowers core's
   * `References.MinimumLogLevel` — `Info` by default — to `Debug` for the whole
   * program, so `Effect.logDebug` calls reach the runner as `::debug::` lines
   * instead of being filtered before any logger sees them. It only ever
   * **lowers**: a level already at `Debug` or below, from the `layer` option,
   * is left alone.
   *
   * Pass `false` to keep the ambient level regardless of step debugging — an
   * action whose debug output is too heavy to show even to someone who asked
   * for it. A program can still provide its own `MinimumLogLevel` either way;
   * the innermost provision wins.
   * @since 0.0.0
   */
  readonly stepDebugLogLevel?: boolean | undefined;
  /**
   * The teardown {@link Action.run} hands to `NodeRuntime.runMain`.
   *
   * **Details**
   *
   * Defaults to `Runtime.defaultTeardown`, which maps the `Exit` of
   * {@link Action.main} to `0`, `1`, or `130` for an interruption. Supply one
   * to map exit codes differently or to observe the verdict without exiting
   * the process. `Action.main` ignores it: whoever runs that effect owns the
   * teardown.
   * @since 0.0.0
   */
  readonly teardown?: Runtime.Teardown | undefined;
}

/**
 * Lower the minimum log level to `Debug` for the program when the runner has
 * step debugging on — and never raise it.
 */
const withStepDebugLogLevel = Effect.fn("withStepDebugLogLevel")(function* <A, E, R>(program: Effect.Effect<A, E, R>) {
  const env = yield* ActionEnvironment;
  const stepDebug = yield* env.isDebug;
  const minimum = yield* References.MinimumLogLevel;
  return yield* Bool.match(stepDebug && LogLevel.isGreaterThan(minimum, "Debug"), {
    onFalse: () => program,
    onTrue: () => Effect.provideService(program, References.MinimumLogLevel, "Debug"),
  });
});

/**
 * A readable one-line summary of why an action failed.
 *
 * **Details**
 *
 * `[Tag]: message` because a workflow log is read by a human scanning for the
 * first red line, and every error in this kit carries both. The `_tag` is what
 * makes two failures with the same wording distinguishable, and the `message`
 * getter is what makes the line worth reading.
 *
 * An interruption has neither, and `Cause.pretty` is the honest answer for it.
 *
 * **Example** (Render a tagged action failure)
 *
 * ```ts
 * import { describeCause } from "@beep/github-actions/Action";
 * import * as Cause from "effect/Cause";
 *
 * console.log(describeCause(Cause.fail({ _tag: "BuildError", message: "build failed" }))) // [BuildError]: build failed
 * ```
 *
 * @public
 * @category formatting
 * @since 0.0.0
 */
export const describeCause = (cause: Cause.Cause<unknown>): string => {
  const failure = Cause.findErrorOption(cause);
  if (O.isSome(failure)) {
    return describeError(failure.value);
  }
  const defect = Cause.findDefect(cause);
  if (Result.isSuccess(defect)) {
    return `[defect] ${describeError(defect.success)}`;
  }
  const pretty = Cause.pretty(cause);
  return Str.trim(pretty) === "" ? "the action failed with no diagnostic information" : pretty;
};

/**
 * The `[Tag]: message` half, over anything a failure or a defect can be.
 */
const describeError = (error: unknown): string => {
  if (P.isObjectOrArray(error) && "_tag" in error) {
    const tagged = error;
    const detail =
      P.hasProperty(tagged, "message") && P.isString(tagged.message) && tagged.message !== ""
        ? `: ${tagged.message}`
        : "";
    return `[${String(tagged._tag)}]${detail}`;
  }
  return error instanceof Error ? `[${error.name}]: ${error.message}` : `[unknown]: ${String(error)}`;
};

/**
/**
 * The verdict {@link Action.main} fails with once it has reported a failed
 * program.
 *
 * **Details**
 *
 * It carries the two `effect/Runtime` markers a `runMain` reads off the
 * squashed failure: `Runtime.errorExitCode` is `1`, so `Runtime.defaultTeardown`
 * maps it to a failed step, and `Runtime.errorReported` is `false`, because the
 * `::error::` annotation already went out and a second rendering of the same
 * cause would only bury it. `summary` is the `[Tag]: message` text of that
 * annotation.
 *
 * **Example** (Read the exit code a failed action maps to)
 *
 * ```ts
 * import { ActionFailedError } from "@beep/github-actions/Action";
 * import * as Runtime from "effect/Runtime";
 *
 * const error = ActionFailedError.make({ summary: "[BuildError]: build failed" });
 * console.log(Runtime.getErrorExitCode(error)) // 1
 * console.log(Runtime.getErrorReported(error)) // false
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class ActionFailedError extends S.TaggedError<ActionFailedError, { readonly brand: unique symbol }>(
  $I`ActionFailedError`
)(
  "ActionFailedError",
  {
    /** The `[Tag]: message` summary the `::error::` annotation carried. */
    summary: S.String.pipe(
      $I.annoteKey("ActionFailedError.summary", {
        description: "The `[Tag]: message` summary the `::error::` annotation carried.",
      })
    ),
  },
  $I.annoteError<ActionFailedError>("ActionFailedError", {
    description: "The verdict Action.main fails with once it has reported a failed program.",
  })
) {
  /**
   * The process exit code a `runMain` teardown maps this failure to.
   *
   * **Example** (Read the exit-code marker)
   *
   * ```ts
   * import { ActionFailedError } from "@beep/github-actions/Action";
   * import * as Runtime from "effect/Runtime";
   *
   * console.log(ActionFailedError.make({ summary: "x" })[Runtime.errorExitCode]) // 1
   * ```
   * @since 0.0.0
   */
  override get [Runtime.errorExitCode](): number {
    return 1;
  }

  /**
   * `false`: the failure was rendered before this error existed.
   *
   * **Example** (Read the already-reported marker)
   *
   * ```ts
   * import { ActionFailedError } from "@beep/github-actions/Action";
   * import * as Runtime from "effect/Runtime";
   *
   * console.log(ActionFailedError.make({ summary: "x" })[Runtime.errorReported]) // false
   * ```
   * @since 0.0.0
   */
  override get [Runtime.errorReported](): boolean {
    return false;
  }

  /**
   * The annotation line, without the workflow-command framing.
   *
   * **Example** (Read the failure message)
   *
   * ```ts
   * import { ActionFailedError } from "@beep/github-actions/Action";
   *
   * console.log(ActionFailedError.make({ summary: "[BuildError]: build failed" }).message)
   * // Action failed: [BuildError]: build failed
   * ```
   * @since 0.0.0
   */
  override get message(): string {
    return `Action failed: ${this.summary}`;
  }
}

/**
 * The summary {@link Action.main} falls back to when rendering the failure
 * itself broke. The verdict must not depend on the renderer.
 */
const UNRENDERED_FAILURE = "the failure could not be rendered";

/**
 * Write a failed program's cause as workflow commands and return the summary.
 *
 * **Details**
 *
 * Written with the workflow-command renderer rather than through the `Logger`,
 * because this runs after the program — and after whatever went wrong with it.
 */
const reportFailure = Effect.fn("Action.reportFailure")(function* (cause: Cause.Cause<unknown>) {
  const detail = Cause.pretty(cause);
  if (Str.trim(detail) !== "") {
    yield* Console.log(WorkflowCommand.render("debug", {}, detail));
  }
  const summary = describeCause(cause);
  yield* Console.log(WorkflowCommand.render("error", {}, `Action failed: ${summary}`));
  return summary;
});

/**
 * The entry point an action's `main`, `pre` and `post` scripts call.
 *
 * **Details**
 *
 * Everything an action entry point does that is not the action, split along
 * the process boundary:
 *
 * - {@link Action.main} is the effectful part: compose the runtime, run the
 *   program, render a failure as a `::error::` annotation, and fail with an
 *   {@link ActionFailedError} that carries exit code `1`.
 * - {@link Action.run} is the process boundary: it hands `Action.main` to
 *   `NodeRuntime.runMain`, whose teardown turns the `Exit` into the process
 *   exit code. Nothing in this module writes `process.exitCode`.
 *
 * Setting the exit code is the piece `ActionOutputs.setFailed` deliberately
 * leaves alone, so an action that reports a failure and then recovers is not
 * doomed by a side effect it cannot undo.
 *
 * It also honours **step debugging**: when the runner sets `RUNNER_DEBUG=1`, it
 * lowers core's `References.MinimumLogLevel` from its `Info` default to
 * `Debug`, so `Effect.logDebug` anywhere in the program — or in any
 * `@effected` library it calls — reaches the runner as a `::debug::` line
 * rather than being filtered before a logger sees it. It only ever lowers the
 * level, and `{ stepDebugLogLevel: false }` ({@link ActionRunOptions}) opts
 * out.
 *
 * Two things it deliberately does **not** do:
 *
 * - **It does not wrap the program in a log buffer.** A buffer that swallowed
 *   the transcript on an unhandled defect would leave a run that failed and
 *   printed nothing. `ActionLogger.withBuffer` is opt-in and flushes on every
 *   exit path including a defect, so the buffering is where the caller can
 *   see it.
 * - **It does not let the renderer decide the verdict.** The failure rendering
 *   runs uninterruptibly, and a renderer that breaks is caught, so the `Exit`
 *   is still a failure: a green step for a crashed action is the worst outcome
 *   available here.
 *
 * The rendering depth is deliberate too: one `::error::` line carrying
 * `[Tag]: message`, and the fiddly diagnostics — the full `Cause.pretty` render
 * with its span trace and stack — behind `::debug::`, which the runner shows
 * only when someone turns step debugging on. No JS stack is spliced into the
 * visible error, because in a bundled action it points at one line of
 * `dist/main.js`.
 *
 * **Example** (Run an action with the cache layer)
 *
 * ```ts
 * import { Action } from "@beep/github-actions/Action";
 * import { ActionCache } from "@beep/github-actions/ActionCache";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const cache = yield* ActionCache;
 *   yield* cache.save(["dist"], "build-v1");
 * });
 * const run = () => Action.run(program, { layer: ActionCache.layer });
 * console.log(Effect.isEffect(program) && typeof run === "function") // true
 * ```
 *
 * @public
 * @category workflows
 * @since 0.0.0
 */
export class Action {
  private constructor() {}

  /**
   * {@link describeCause}, so an action can render its own failures the same way.
   *
   * **Example** (Render a failure through the action entry point)
   *
   * ```ts
   * import { Action } from "@beep/github-actions/Action";
   * import * as Cause from "effect/Cause";
   *
   * console.log(Action.describeCause(Cause.fail(new Error("build failed")))) // [Error]: build failed
   * ```
   * @category formatting
   * @since 0.0.0
   */
  static readonly describeCause = describeCause;

  /**
   * Run an action program inside the composed runtime, as an Effect.
   *
   * **Details**
   *
   * Succeeds when the program does. When it fails — a typed failure, a defect,
   * a layer that would not build, an interruption from inside — the cause is
   * rendered as `::debug::` and `::error::` workflow commands and the effect
   * fails with an {@link ActionFailedError}, which `Runtime.defaultTeardown`
   * maps to exit code `1`. Requirements beyond {@link ActionServices} come from
   * `options.layer`; `options.teardown` is ignored here.
   *
   * Use it to run an action under a `runMain` of your own choosing, or to test
   * an action's verdict without exiting the process: {@link Action.run} is this
   * effect handed to `NodeRuntime.runMain`.
   *
   * **Example** (Read the exit code of a failed program)
   *
   * ```ts
   * import { Action } from "@beep/github-actions/Action";
   * import * as Effect from "effect/Effect";
   * import * as Runtime from "effect/Runtime";
   *
   * const exit = await Effect.runPromiseExit(Action.main(Effect.fail("boom")));
   * Runtime.defaultTeardown(exit, (code) => console.log(code)) // 1
   * ```
   * @category workflows
   * @since 0.0.0
   */
  static readonly main: {
    <E, R = never>(
      program: Effect.Effect<void, E, ActionServices | R>,
      options?: ActionRunOptions<R>
    ): Effect.Effect<void, ActionFailedError>;
    <R = never>(
      options?: ActionRunOptions<R>
    ): <E>(program: Effect.Effect<void, E, ActionServices | R>) => Effect.Effect<void, ActionFailedError>;
  } = dual(
    (args) => Effect.isEffect(args[0]),
    <E, R = never>(
      program: Effect.Effect<void, E, ActionServices | R>,
      options: ActionRunOptions<R> = {}
    ): Effect.Effect<void, ActionFailedError> => {
      const extra = options.layer;
      const composed =
        extra === undefined
          ? ActionRuntime.layer
          : Layer.mergeAll(ActionRuntime.layer, Layer.provide(extra, ActionRuntime.layer));

      // Inside the provide, so the level read is the one the composed runtime —
      // including a caller's `layer` — actually installed.
      const leveled = options.stepDebugLogLevel === false ? program : withStepDebugLogLevel(program);

      return Effect.scopedWith((scope) =>
        Effect.flatMap(Layer.buildWithScope(composed, scope), (context) =>
          // This entry point trusts the caller's layer for R; an omitted service still defects at use.
          Effect.provideContext(leveled, Context.makeUnsafe<ActionServices | R>(context.mapUnsafe))
        )
      ).pipe(
        Effect.catchCause((cause) =>
          reportFailure(cause).pipe(
            // A renderer that itself broke must not turn a failed run green.
            Effect.catchCause(() => Effect.succeed(UNRENDERED_FAILURE)),
            Effect.flatMap((summary) => Effect.fail(ActionFailedError.make({ summary }))),
            Effect.uninterruptible
          )
        )
      );
    }
  );

  /**
   * Run an action program as the process's main entry point.
   *
   * **Details**
   *
   * Hands {@link Action.main} to `NodeRuntime.runMain` with
   * `disableErrorReporting` on, because `Action.main` has already rendered the
   * failure. The runtime's teardown sets the verdict: a success lets the
   * process exit `0` on its own, a failure calls `process.exit(1)`, and a
   * `SIGINT`/`SIGTERM` from a cancelled job interrupts the program and exits
   * `130`. Returns as soon as the program is forked; there is no promise to
   * await or to reject. Requirements beyond {@link ActionServices} come from
   * `options.layer`, and `options.teardown` replaces the runtime's teardown.
   *
   * **Example** (Run an action program as a script's entry point)
   *
   * ```ts
   * import { Action } from "@beep/github-actions/Action";
   * import * as Effect from "effect/Effect";
   *
   * Action.run(Effect.log("hello from the runner"), {
   *   teardown: (_exit, onExit) => onExit(0),
   * });
   * console.log("action forked") // action forked
   * ```
   * @category workflows
   * @since 0.0.0
   */
  static readonly run: {
    <E, R = never>(program: Effect.Effect<void, E, ActionServices | R>, options?: ActionRunOptions<R>): void;
    <R = never>(options?: ActionRunOptions<R>): <E>(program: Effect.Effect<void, E, ActionServices | R>) => void;
  } = dual(
    (args) => Effect.isEffect(args[0]),
    <E, R = never>(program: Effect.Effect<void, E, ActionServices | R>, options: ActionRunOptions<R> = {}): void =>
      NodeRuntime.runMain(Action.main(program, options), {
        disableErrorReporting: true,
        teardown: options.teardown,
      })
  );
}
