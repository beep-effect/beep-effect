/**
 * Runtime identity input checks for ordinary task execution.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { isUnresolvedSecretReference } from "../../internal/cli/EnvConfig.ts";
import { hashFileSha256 } from "../../internal/cli/FsGuards.ts";
import { forceLocalTurboCacheArgs } from "../../internal/cli/TurboCache.ts";
import { runToExit } from "../../internal/process/StepExec.ts";
import { collectCacheTaskSelection, resolveCacheTurboBinary } from "./Cache.census.ts";
import { CacheCommandError } from "./Cache.errors.ts";
import { collectCacheToolchain, hashCacheToolchain, readCacheSignatureRequired } from "./Cache.fingerprint.ts";
import { verifyCacheIdentityLintProfile } from "./Cache.profile.ts";
import { assertCacheRuntimeKeyUnspecified } from "./Cache.runtime.step.ts";
import { CacheSigningPosture, CacheSigningRequest } from "./Cache.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.runtime");
const CacheAccessMode = LiteralKit(["remote:w", "remote:rw", "remote:r", "local:r", "local:w", "local:rw"]).pipe(
  $I.annoteSchema("CacheAccessMode", {
    description: "Individual native cache access directives used for signing posture.",
  })
);
const isRemoteWriteMode = S.is(CacheAccessMode.pick(["remote:w", "remote:rw"]));
const isReadOrLocalMode = S.is(CacheAccessMode.pick(["remote:r", "local:r", "local:w", "local:rw"]));

/**
 * Enforce artifact-key availability separately from read/write bearer capability.
 *
 * **Details**
 * A reader without a resolved required key receives an attributable local-only
 * decision. Writers and signing canaries fail before remote execution. This
 * function handles metadata only and grants no producer or qualification authority.
 *
 * **Example** (Fail closed for a reader without its signing key)
 * ```ts
 * import { CacheSigningRequest, resolveCacheSigningPosture } from "@beep/repo-cli/commands/Cache"
 * import * as Effect from "effect/Effect"
 * const decision = resolveCacheSigningPosture(CacheSigningRequest.make({ required: true, role: "reader", key: "missing" }))
 * console.assert(Effect.isEffect(decision))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const resolveCacheSigningPosture = Effect.fn("Cache.resolveSigningPosture")(function* (
  request: CacheSigningRequest
) {
  if (request.role === "canary" && !request.required)
    return yield* CacheCommandError.new("Signing canary requires native artifact verification to be enabled.");
  if (!request.required) return CacheSigningPosture.cases.Disabled.make({});
  return yield* Match.value(request.key).pipe(
    Match.when("resolved", () => Effect.succeed(CacheSigningPosture.cases.Ready.make({}))),
    Match.orElse((reason) =>
      request.role === "reader"
        ? Effect.succeed(CacheSigningPosture.cases.LocalOnly.make({ reason }))
        : CacheCommandError.new(`Signed cache ${request.role} requires a resolved artifact signing key (${reason}).`)
    )
  );
});

const runtimeToolchainDigest = Effect.fn("Cache.runtimeToolchainDigest")(function* (root: string, turbo: string) {
  const toolchain = yield* collectCacheToolchain(root);
  const actualClient = yield* hashFileSha256(turbo, (cause) =>
    CacheCommandError.new("Cannot verify the execution client.", cause)
  );
  if (actualClient !== toolchain.turbo.sha256) {
    return yield* CacheCommandError.new("The native execution client changed during runtime observation.");
  }
  return yield* hashCacheToolchain(toolchain);
});

const runtimeSigningRole = (args: ReadonlyArray<string>, ambient: Readonly<Record<string, string | undefined>>) => {
  const selection = A.takeWhile(args, (arg) => arg !== "--");
  const directives = A.getSomes(
    A.map(selection, (value, index) =>
      value === "--cache"
        ? A.get(selection, index + 1)
        : Str.startsWith("--cache=")(value)
          ? O.some(Str.slice("--cache=".length)(value))
          : O.none()
    )
  );
  const modes = A.flatMap(
    A.isReadonlyArrayNonEmpty(directives) ? directives : O.toArray(O.fromUndefinedOr(ambient.TURBO_CACHE)),
    Str.split(",")
  );
  const writeRequested = A.some(modes, isRemoteWriteMode);
  const readRequested = A.some(modes, isReadOrLocalMode);
  return ambient.BEEP_TURBO_SIGNING_CANARY === "true"
    ? "canary"
    : ambient.BEEP_TURBO_TRUSTED_WRITER === "true" || writeRequested || !readRequested
      ? "writer"
      : "reader";
};

const runtimeSigningPlan = Effect.fn("Cache.runtimeSigningPlan")(function* (
  root: string,
  args: ReadonlyArray<string>,
  ambient: Readonly<Record<string, string | undefined>>
) {
  const selection = A.takeWhile(args, (arg) => arg !== "--");
  if (
    ambient.TURBO_ROOT_TURBO_JSON !== undefined ||
    A.some(selection, (arg) =>
      A.some(["--root-turbo-json", "--cwd"], (option) => arg === option || Str.startsWith(`${option}=`)(arg))
    )
  )
    return yield* CacheCommandError.new(
      "Runtime signing posture requires the checkout root Turbo configuration; overrides are not accepted."
    );
  const role = runtimeSigningRole(args, ambient);
  const key = O.fromUndefinedOr(ambient.TURBO_REMOTE_CACHE_SIGNATURE_KEY).pipe(
    O.filter(flow(Str.trim, Str.isNonEmpty)),
    O.map(Redacted.make)
  );
  const posture = yield* resolveCacheSigningPosture(
    CacheSigningRequest.make({
      required: yield* readCacheSignatureRequired(root),
      role,
      key: O.match(key, {
        onNone: () => "missing",
        onSome: (value) => (pipe(value, Redacted.value, isUnresolvedSecretReference) ? "unresolved" : "resolved"),
      }),
    })
  );
  if (CacheSigningPosture.guards.LocalOnly(posture)) {
    yield* Effect.logWarning("Signed remote cache disabled: artifact signing key is unavailable.", {
      reason: posture.reason,
    });
    return Tuple.make(forceLocalTurboCacheArgs(args), {
      TURBO_CACHE: "local:rw",
      TURBO_REMOTE_ONLY: undefined,
      TURBO_REMOTE_CACHE_READ_ONLY: undefined,
      TURBO_REMOTE_CACHE_SIGNATURE_KEY: undefined,
    });
  }
  return Tuple.make(args, {});
});

/**
 * Run native Turbo with a calculated key for enabled governed task caching.
 *
 * **Details**
 * Invoke inside the final resolved child environment. Selection includes task
 * dependencies. Disabled caching does not require a supported toolchain profile.
 * Identity lint that passes through `BIOME_CONFIG_PATH` requires a fresh generated
 * profile even with caching disabled. Its fixed selection rejects caller input;
 * native task selection checks strict mode and prevents cross-task forwarding.
 * The calculated key is applied only at the native spawn and cannot be replaced
 * by caller input. This does not promote a qualification or authorize activation.
 *
 * **Example** (Prepare a types-only execution)
 *
 * ```ts
 * import { runCacheRuntimeTasks } from "@beep/repo-cli/commands/Cache"
 * import * as Effect from "effect/Effect"
 *
 * console.assert(Effect.isEffect(runCacheRuntimeTasks(".", ["run", "lint", "--filter=@beep/types"])))
 * ```
 *
 * @category commands
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
  const [nativeArgs, signingEnvironment] = yield* runtimeSigningPlan(root, args, ambient);
  const nodes = yield* collectCacheTaskSelection(root, nativeArgs);
  const needsProfile = A.some(
    nodes,
    (node) =>
      node.id === "@beep/identity#lint" &&
      O.isSome(node.command) &&
      A.contains(node.configuration.passThroughEnv, "BIOME_CONFIG_PATH")
  );
  if (needsProfile) {
    if (ambient.BIOME_CONFIG_PATH !== undefined)
      return yield* CacheCommandError.new(
        "Identity lint profile selection is governed; caller overrides are not accepted."
      );
    yield* verifyCacheIdentityLintProfile(root);
  }
  const turbo = yield* resolveCacheTurboBinary(root);
  const needsKey = A.some(
    nodes,
    (node) =>
      O.isSome(node.command) &&
      node.configuration.cache &&
      A.contains(node.configuration.env, "BEEP_CACHE_TOOLCHAIN_DIGEST")
  );
  const path = yield* Path.Path;
  let environment: Record<string, string | undefined> = needsProfile
    ? { BIOME_CONFIG_PATH: path.resolve(root, "biome.identity.jsonc") }
    : {};
  if (needsKey) {
    environment = { ...environment, BEEP_CACHE_TOOLCHAIN_DIGEST: yield* runtimeToolchainDigest(root, turbo) };
  }
  return yield* runToExit({
    command: turbo,
    args: nativeArgs,
    cwd: root,
    env: { ...environment, ...signingEnvironment },
    extendEnv: true,
    stdin: "inherit",
    stdio: "inherit",
  });
}, CacheCommandError.mapError("Cache runtime execution failed."));
