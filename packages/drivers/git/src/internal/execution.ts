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
import { GitCommand } from "../GitCommand.ts";
import { runClassified } from "./classification.ts";
import { BASE_ENV, OPENSSH_VARIANTS, sshEnv } from "./sshEnvironment.ts";
import type { GitInvocation } from "../GitCommand.ts";
import type { ClassifiedFor, ClassifyKind, RunFor } from "./classification.ts";

const $I = $GitId.create("Git");

/**
 * The ssh-related environment, read once at layer construction. None of these
 * can change under a running service, so none is re-read per call — unlike
 * their git-config counterparts, which are repository-local.
 */
const SshFromEnv = S.Struct({
  /** `GIT_SSH_COMMAND` — a full command line; the first rung. */
  command: S.Option(S.String).pipe(
    $I.annoteKey("SshFromEnv.command", { description: "GIT_SSH_COMMAND, a full command line with highest precedence." })
  ),
  /** `GIT_SSH` — a program name with no argument support; the third rung. */
  program: S.Option(S.String).pipe(
    $I.annoteKey("SshFromEnv.program", { description: "GIT_SSH, a program name with no argument support." })
  ),
  /** `GIT_SSH_VARIANT` — overrides git's basename inference of the grammar. */
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
 * Captures the process spawner and ambient SSH settings for one service instance.
 *
 * **Details**
 *
 * A failing config provider is treated as absent, preserving the service's
 * infallible construction contract. Repository settings are resolved later,
 * per network call, because one instance can serve multiple repositories.
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
export const make: Effect.Effect<Execution, never, ChildProcessSpawner.ChildProcessSpawner> = Effect.gen(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  // The AMBIENT ENVIRONMENT is read ONCE, here, and never again — it
  // cannot change under a running service. The read goes through
  // ConfigProvider (whose default is `fromEnv()`) rather than
  // `process.env`, so a test provides a provider instead of mutating the
  // environment and `src/` keeps its zero-`node:` boundary. A blank value
  // is treated as absent — an exported-but-empty GIT_SSH_COMMAND is not
  // an ssh configuration worth preserving.
  //
  // `core.sshCommand` is NOT read here: it is repository-local, so it
  // belongs to a cwd rather than to the service, and is resolved per
  // network-touching call instead.
  // A source-level ConfigError degrades to "absent" rather than escaping:
  // the layer's error channel is `never` by contract, and an unreadable
  // provider is answered with the pin that cannot hang.
  const read = (name: string) =>
    Config.String(name).pipe(
      Config.option,
      Effect.orElseSucceed(O.none<string>),
      // A blank value is treated as absent — an exported-but-empty
      // variable is not a configuration worth preserving.
      Effect.map(O.filter((value) => Str.trim(value) !== ""))
    );
  const [command, program, variant] = yield* Effect.all(
    [read("GIT_SSH_COMMAND"), read("GIT_SSH"), read("GIT_SSH_VARIANT")],
    { concurrency: "unbounded" }
  );

  const ssh: SshFromEnv = { command, program, variant };
  const runFor: RunFor = dual(
    3,
    <K extends ClassifyKind>(invocation: GitInvocation, cwd: string, kind: K): Effect.Effect<ClassifiedFor<K>> =>
      runClassified(invocation, cwd, kind, BASE_ENV).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
      )
  );

  /** One `git config --get <key>` at `cwd`; unset and failure both read as `""`. */
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

  /**
   * Resolves the spawn environment for a member that reaches a remote,
   * following git's OWN precedence order rather than a simplification of it:
   * `GIT_SSH_COMMAND` \> `core.sshCommand` \> `GIT_SSH` \> plain `ssh` (each
   * rung verified against git 2.55).
   *
   * **Details**
   *
   * The config reads are why this is per-call rather than per-service:
   * `core.sshCommand` and `ssh.variant` are both repository-local, while one
   * `Git` instance serves every `cwd` a caller hands it. Each is skipped when
   * its environment counterpart already decides the answer, and the two run
   * concurrently, so the common case costs one round trip on a member about
   * to touch the network anyway.
   *
   * They deliberately run through `runFor` (BASE_ENV, no ssh pin): a local
   * config read needs no ssh, and routing them through the network path would
   * recurse.
   */
  const resolveSshEnv = Effect.fnUntraced(function* (cwd: string) {
    const [fromConfig, variantFromConfig] = yield* Effect.all(
      [
        O.isSome(ssh.command) ? Effect.succeed("") : readConfig(cwd, "core.sshCommand"),
        O.isSome(ssh.variant) ? Effect.succeed("") : readConfig(cwd, "ssh.variant"),
      ],
      { concurrency: "unbounded" }
    );

    // The variant decides the argument GRAMMAR, so it is checked first: a
    // non-OpenSSH variant means `-o BatchMode=yes` is not a thing git's ssh
    // invocation understands, whatever the command happens to be named.
    const variant = pipe(
      ssh.variant,
      O.getOrElse(() => variantFromConfig),
      Str.trim,
      Str.toLowerCase
    );
    if (!HashSet.has(OPENSSH_VARIANTS, variant)) {
      return { ...BASE_ENV };
    }

    const command = Str.trim(O.getOrElse(ssh.command, () => fromConfig));
    if (command !== "") {
      return sshEnv(command);
    }
    // No COMMAND anywhere, so GIT_SSH is the deciding rung if it is set. It
    // names a program and takes no arguments, so pinning anything here would
    // displace it rather than extend it — decline instead.
    if (O.isSome(ssh.program)) {
      return { ...BASE_ENV };
    }
    return sshEnv("ssh");
  });

  /**
   * `runFor` for a member that reaches a remote. Everything else spawns with
   * `BASE_ENV` alone — a member that never invokes ssh has no business
   * pinning an ssh command, and would pay the config read for nothing.
   */
  const runForNetwork: RunFor = dual(
    3,
    Effect.fnUntraced(function* <K extends ClassifyKind>(invocation: GitInvocation, cwd: string, kind: K) {
      const env = yield* resolveSshEnv(cwd);
      return yield* runClassified(invocation, cwd, kind, env).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
      );
    })
  );

  return { runFor, runForNetwork };
});
