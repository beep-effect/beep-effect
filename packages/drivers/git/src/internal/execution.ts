/**
 * Bound local and network Git execution with explicit environment lifetimes.
 *
 * **Details**
 *
 * Construction captures the spawner and ambient SSH settings once. Network
 * runs resolve repository config per call; local runs never probe SSH config.
 * Classification, timeout and collection stay in their existing owners.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GitId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GitOptions } from "../Git.models.ts";
import { GitCommand } from "../GitCommand.ts";
import { runClassified } from "./classification.ts";
import { BASE_ENV, OPENSSH_VARIANTS, sshEnv } from "./sshEnvironment.ts";
import type { GitInvocation } from "../GitCommand.ts";
import type { ClassifiedFor, ClassifyKind, RunFor } from "./classification.ts";

const $I = $GitId.create("Git");

const SshFromEnv = S.Struct({
  command: S.Option(S.String).pipe(
    $I.annoteKey("SshFromEnv.command", { description: "GIT_SSH_COMMAND, a full command line with highest precedence." })
  ),
  program: S.Option(S.String).pipe(
    $I.annoteKey("SshFromEnv.program", {
      description: "GIT_SSH, a program name with no argument support; the third precedence rung.",
    })
  ),
  variant: S.Option(S.String).pipe(
    $I.annoteKey("SshFromEnv.variant", {
      description: "GIT_SSH_VARIANT, overriding basename inference of the SSH grammar.",
    })
  ),
}).pipe(
  $I.annoteSchema("SshFromEnv", {
    description: "The optional SSH environment settings captured at layer construction.",
  })
);
type SshFromEnv = typeof SshFromEnv.Type;

const isNonBlank = (value: string): boolean => Str.isNonEmpty(Str.trim(value));

/**
 * Execution capabilities used by repository operations after construction.
 *
 * **Example** (Select a bound local runner)
 *
 * ```ts import.meta.vitest name="Select a bound local runner"
 * import { make } from "@beep/git/internal/execution";
 * import * as Effect from "effect/Effect";
 *
 * const local = Effect.map(make, (execution) => execution.runFor);
 * Effect.isEffect(local) // => true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface Execution {
  /** Local commands use fixed non-interactive pins without SSH config reads. */
  readonly runFor: RunFor;
  /** Network commands resolve repository SSH configuration before spawning. */
  readonly runForNetwork: RunFor;
}

/**
 * Captures the process spawner and ambient SSH settings for one service
 * instance, binding `options` (the per-stream output ceiling and the per-run
 * timeout) into every run it performs.
 *
 * **Details**
 *
 * A failing config provider is treated as absent, preserving the service's
 * infallible construction contract. Repository settings are resolved later,
 * per network call, because one instance can serve multiple repositories.
 *
 * **Example** (Bind a tighter output ceiling)
 *
 * ```ts import.meta.vitest name="Bind a tighter output ceiling"
 * import { GitOptions } from "@beep/git/Git";
 * import { makeWith } from "@beep/git/internal/execution";
 * import * as Effect from "effect/Effect";
 *
 * Effect.isEffect(makeWith(GitOptions.make({ maxOutputBytes: 64 * 1024 }))) // => true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeWith = Effect.fnUntraced(function* (options: GitOptions) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const readAmbient = (name: string) =>
    Config.String(name).pipe(Config.option, Effect.orElseSucceed(O.none<string>), Effect.map(O.filter(isNonBlank)));
  const [command, program, variant] = yield* Effect.all(
    [readAmbient("GIT_SSH_COMMAND"), readAmbient("GIT_SSH"), readAmbient("GIT_SSH_VARIANT")],
    { concurrency: "unbounded" }
  );

  const ssh: SshFromEnv = { command, program, variant };
  const runFor: RunFor = dual(
    3,
    <K extends ClassifyKind>(invocation: GitInvocation, cwd: string, kind: K): Effect.Effect<ClassifiedFor<K>> =>
      runClassified(invocation, cwd, kind, BASE_ENV, options).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
      )
  );

  const readConfig: {
    (cwd: string, key: string): Effect.Effect<string>;
    (key: string): (cwd: string) => Effect.Effect<string>;
  } = dual(
    2,
    (cwd: string, key: string): Effect.Effect<string> =>
      Effect.map(runFor(GitCommand.configGet(key), cwd, "quiet"), (classified) =>
        classified._tag === "success" ? Str.trim(classified.output) : ""
      )
  );

  const resolveSshEnv = Effect.fnUntraced(function* (cwd: string) {
    const [fromConfig, variantFromConfig] = yield* Effect.all(
      [
        O.isSome(ssh.command) ? Effect.succeed("") : readConfig(cwd, "core.sshCommand"),
        O.isSome(ssh.variant) ? Effect.succeed("") : readConfig(cwd, "ssh.variant"),
      ],
      { concurrency: "unbounded" }
    );

    const grammarVariant = pipe(
      ssh.variant,
      O.getOrElse(() => variantFromConfig),
      Str.trim,
      Str.toLowerCase
    );
    if (!HashSet.has(OPENSSH_VARIANTS, grammarVariant)) {
      return { ...BASE_ENV };
    }

    const command = Str.trim(O.getOrElse(ssh.command, () => fromConfig));
    if (command !== "") {
      return sshEnv(command);
    }
    if (O.isSome(ssh.program)) {
      return { ...BASE_ENV };
    }
    return sshEnv("ssh");
  });

  const runForNetwork: RunFor = dual(
    3,
    Effect.fnUntraced(function* <K extends ClassifyKind>(invocation: GitInvocation, cwd: string, kind: K) {
      const env = yield* resolveSshEnv(cwd);
      return yield* runClassified(invocation, cwd, kind, env, options).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
      );
    })
  );

  const execution: Execution = { runFor, runForNetwork };
  return execution;
});

/**
 * {@link makeWith} under the default {@link GitOptions}: a 16 MiB per-stream
 * output ceiling and a 30 s per-run timeout.
 *
 * **Example** (Describe execution construction)
 *
 * ```ts import.meta.vitest name="Describe execution construction"
 * import { make } from "@beep/git/internal/execution";
 * import * as Effect from "effect/Effect";
 *
 * Effect.isEffect(make) // => true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const make: Effect.Effect<Execution, never, ChildProcessSpawner.ChildProcessSpawner> = makeWith(
  GitOptions.make({})
);
