/**
 * Local Turbo cache posture: the decision that says whether a workstation may
 * read the shared remote cache.
 *
 * **Details**
 *
 * Root quality commands used to inject `--cache=local:rw` on every non-CI Turbo
 * invocation, so a checkout configured for remote reads could never use them.
 * This module owns that decision instead. A checkout is honored only when the
 * whole remote-read quad is present and unambiguous (`TURBO_API`,
 * `TURBO_TOKEN`, `TURBO_TEAM`, and `TURBO_CACHE` pinned to the sanctioned
 * `local:rw,remote:r` posture); every other configuration fails closed to
 * local-only.
 *
 * The domain is deliberately pure: the environment is modeled as value
 * *sources* (a literal value versus an unresolved `op://` secret reference),
 * never as secret values, so the whole matrix is unit-testable and no secret
 * can reach a log line through this module.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A, O, Str } from "@beep/utils";
import { Match, pipe, Tuple } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/cli/TurboCache");

/**
 * Cache postures this CLI is willing to hand to Turbo.
 *
 * **Details**
 *
 * `local:rw` is the fail-closed default. `local:rw,remote:r` is the only
 * sanctioned remote posture for a workstation: agents read the shared cache and
 * never hold a write credential (writes stay with the trusted main-push jobs).
 *
 * **Example** (Read the sanctioned remote-read posture)
 *
 * ```ts
 * import { TurboCacheMode } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(TurboCacheMode.Enum.LocalWriteRemoteRead)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TurboCacheMode = LiteralKit({
  literals: ["local:rw", "local:rw,remote:r"],
  enumMapping: [
    ["local:rw", "LocalOnly"],
    ["local:rw,remote:r", "LocalWriteRemoteRead"],
  ],
}).pipe(
  $I.annoteSchema("TurboCacheMode", {
    description: "Cache postures the repo CLI is willing to hand to Turbo.",
  })
);

/**
 * Cache postures this CLI is willing to hand to Turbo.
 *
 * @category models
 * @since 0.0.0
 */
export type TurboCacheMode = typeof TurboCacheMode.Type;

/**
 * The environment variable names that together enable remote cache reads.
 *
 * **Example** (List the remote-read quad)
 *
 * ```ts
 * import { TurboCacheEnvName } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(TurboCacheEnvName.Options.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TurboCacheEnvName = LiteralKit(["TURBO_API", "TURBO_TOKEN", "TURBO_TEAM", "TURBO_CACHE"]).pipe(
  $I.annoteSchema("TurboCacheEnvName", {
    description: "Environment variable names that together enable Turbo remote cache reads.",
  })
);

/**
 * The environment variable names that together enable remote cache reads.
 *
 * @category models
 * @since 0.0.0
 */
export type TurboCacheEnvName = typeof TurboCacheEnvName.Type;

const TurboEnvironmentVariableName = S.String.check(
  S.isPattern(/^[A-Za-z_][A-Za-z0-9_]*$/u, {
    identifier: $I`TurboEnvironmentVariableNamePatternCheck`,
    title: "Environment Variable Name Pattern",
    description: "Environment variable names use a portable shell identifier form.",
    message: "Expected an environment variable name matching ^[A-Za-z_][A-Za-z0-9_]*$",
  })
).pipe(
  $I.annoteSchema("TurboEnvironmentVariableName", {
    description: "A portable shell environment variable name.",
  })
);

/**
 * A checkout `.env` variable whose 1Password reference failed the separate
 * environment-health check.
 *
 * **Details**
 *
 * The warning deliberately carries only the variable name. The unresolved
 * reference and any resolved value stay inside the value-suppressed probe and
 * can never reach plan output through this model.
 *
 * **Example** (Name an unhealthy environment variable)
 *
 * ```ts
 * import { TurboEnvironmentHealthWarning } from "@beep/repo-cli/test/SharedInternals"
 *
 * const warning = TurboEnvironmentHealthWarning.make({ variableName: "STALE_SERVICE_TOKEN" })
 * console.log(warning.variableName)
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class TurboEnvironmentHealthWarning extends S.Class<TurboEnvironmentHealthWarning>(
  $I`TurboEnvironmentHealthWarning`
)(
  {
    variableName: TurboEnvironmentVariableName,
  },
  $I.annote("TurboEnvironmentHealthWarning", {
    description: "A checkout .env variable whose 1Password reference failed a value-suppressed health check.",
  })
) {}

/**
 * Environment overrides that reduce any checkout to the hosted pull-request
 * cache posture: every credential scrubbed, cache pinned local-only.
 *
 * **Details**
 *
 * `check.yml` hands pull-request jobs a blank credential triple and
 * `TURBO_CACHE=local:rw`; main pushes receive a literal token and a
 * workstation carries a 1Password reference. Code that classifies those
 * values (`EnvConfig.readTurboCacheEnvironment`) executes different arms under
 * each, so any measurement that must agree across all three — the coverage
 * ratchet — spreads this record over its child environment. `satisfies`
 * against {@link TurboCacheEnvName} keeps the posture complete when a new
 * name joins the quad.
 *
 * **Example** (Scrub a coverage child environment)
 *
 * ```ts
 * import { turboCachePullRequestPosture } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(turboCachePullRequestPosture.TURBO_CACHE)
 * console.log(turboCachePullRequestPosture.TURBO_TOKEN)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const turboCachePullRequestPosture = {
  TURBO_API: undefined,
  TURBO_TOKEN: undefined,
  TURBO_TEAM: undefined,
  TURBO_CACHE: TurboCacheMode.Enum.LocalOnly,
} satisfies Readonly<Record<TurboCacheEnvName, string | undefined>>;

/**
 * Turbo credential environment variables whose `op://` references a secret session may resolve.
 *
 * **Details**
 *
 * `TURBO_CACHE` is deliberately absent because it is a non-secret posture, not
 * a remote-cache credential.
 *
 * **Example** (List the secret-session allowlist)
 *
 * ```ts
 * import { TurboCacheSecretEnvName } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(TurboCacheSecretEnvName.Options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TurboCacheSecretEnvName = LiteralKit(TurboCacheEnvName.omitOptions(["TURBO_CACHE"])).pipe(
  $I.annoteSchema("TurboCacheSecretEnvName", {
    description: "Turbo credential environment variables whose references a secret session may resolve.",
  })
);

/**
 * Turbo credential environment variables whose `op://` references a secret session may resolve.
 *
 * @category models
 * @since 0.0.0
 */
export type TurboCacheSecretEnvName = typeof TurboCacheSecretEnvName.Type;

/**
 * Whether a configured value is already usable or is still a 1Password
 * reference that only `op run` can resolve.
 *
 * **Example** (Check a secret-reference source)
 *
 * ```ts
 * import { TurboCacheValueSource } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(TurboCacheValueSource.is["secret-reference"]("secret-reference"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TurboCacheValueSource = LiteralKit(["literal", "secret-reference"]).pipe(
  $I.annoteSchema("TurboCacheValueSource", {
    description: "Whether a configured Turbo cache value is literal or an unresolved op:// reference.",
  })
);

/**
 * Whether a configured value is already usable or is still a 1Password
 * reference that only `op run` can resolve.
 *
 * @category models
 * @since 0.0.0
 */
export type TurboCacheValueSource = typeof TurboCacheValueSource.Type;

/**
 * Why the caller, not this CLI, owns the cache flags for an invocation.
 *
 * **Example** (Check the CI reason)
 *
 * ```ts
 * import { TurboCacheCallerReason } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(TurboCacheCallerReason.is.ci("ci"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TurboCacheCallerReason = LiteralKit(["ci", "explicit-cache-arg"]).pipe(
  $I.annoteSchema("TurboCacheCallerReason", {
    description: "Why the caller, not the repo CLI, owns the Turbo cache flags for an invocation.",
  })
);

/**
 * Why the caller, not this CLI, owns the cache flags for an invocation.
 *
 * @category models
 * @since 0.0.0
 */
export type TurboCacheCallerReason = typeof TurboCacheCallerReason.Type;

/**
 * Why a checkout fell back to the local-only cache posture.
 *
 * **Example** (Check the incomplete-config reason)
 *
 * ```ts
 * import { TurboCacheFallbackReason } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(TurboCacheFallbackReason.is["incomplete-remote-config"]("incomplete-remote-config"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TurboCacheFallbackReason = LiteralKit(["incomplete-remote-config", "unsupported-cache-mode"]).pipe(
  $I.annoteSchema("TurboCacheFallbackReason", {
    description: "Why a checkout fell back to the local-only Turbo cache posture.",
  })
);

/**
 * Why a checkout fell back to the local-only cache posture.
 *
 * @category models
 * @since 0.0.0
 */
export type TurboCacheFallbackReason = typeof TurboCacheFallbackReason.Type;

/**
 * The remote-read configuration a checkout actually carries.
 *
 * **Details**
 *
 * `api`, `token`, and `team` are modeled as value *sources* rather than values:
 * this domain never needs a secret, only whether one still has to be resolved
 * by `op run`. `cache` keeps its literal text because the posture itself is the
 * thing being validated; an unresolved reference there simply fails the mode
 * check. Absent keys mean absent or blank environment entries.
 *
 * **Example** (Describe a fully configured checkout)
 *
 * ```ts
 * import { TurboCacheEnvironment } from "@beep/repo-cli/test/SharedInternals"
 *
 * const environment = TurboCacheEnvironment.make({
 *   api: "literal",
 *   token: "secret-reference",
 *   team: "literal",
 *   cache: "local:rw,remote:r"
 * })
 * console.log(environment.cache)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TurboCacheEnvironment extends S.Class<TurboCacheEnvironment>($I`TurboCacheEnvironment`)(
  {
    api: S.optionalKey(TurboCacheValueSource),
    token: S.optionalKey(TurboCacheValueSource),
    team: S.optionalKey(TurboCacheValueSource),
    cache: S.optionalKey(S.String),
  },
  $I.annote("TurboCacheEnvironment", {
    description: "The Turbo remote-read configuration a checkout actually carries.",
  })
) {}

/**
 * Tags of the resolved cache plan.
 *
 * **Example** (List the plan tags)
 *
 * ```ts
 * import { TurboCachePlanTag } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(TurboCachePlanTag.Options.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TurboCachePlanTag = LiteralKit(["caller-controlled", "local-only", "remote-read"]).pipe(
  $I.annoteSchema("TurboCachePlanTag", {
    description: "Tags of the resolved local Turbo cache plan.",
  })
);

/**
 * Tags of the resolved cache plan.
 *
 * @category models
 * @since 0.0.0
 */
export type TurboCachePlanTag = typeof TurboCachePlanTag.Type;

/**
 * The caller already controls caching, so the CLI injects nothing.
 *
 * **Example** (Describe a caller-controlled plan)
 *
 * ```ts
 * import { CallerControlledTurboCache } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(CallerControlledTurboCache.make({ reason: "ci" })._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CallerControlledTurboCache extends S.Class<CallerControlledTurboCache>($I`CallerControlledTurboCache`)(
  {
    _tag: S.tag("caller-controlled"),
    reason: TurboCacheCallerReason,
  },
  $I.annote("CallerControlledTurboCache", {
    description: "The caller already controls Turbo caching, so the CLI injects no cache flag.",
  })
) {}

/**
 * The checkout is not provably configured for remote reads, so it stays local.
 *
 * **Example** (Describe an incomplete configuration)
 *
 * ```ts
 * import { LocalOnlyTurboCache } from "@beep/repo-cli/test/SharedInternals"
 *
 * const plan = LocalOnlyTurboCache.make({ reason: "incomplete-remote-config", missing: ["TURBO_API"] })
 * console.log(plan.missing)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LocalOnlyTurboCache extends S.Class<LocalOnlyTurboCache>($I`LocalOnlyTurboCache`)(
  {
    _tag: S.tag("local-only"),
    reason: TurboCacheFallbackReason,
    missing: S.Array(TurboCacheEnvName),
  },
  $I.annote("LocalOnlyTurboCache", {
    description: "The checkout is not provably configured for remote reads, so Turbo stays local-only.",
  })
) {}

/**
 * The checkout carries a complete, sanctioned remote-read configuration.
 *
 * **Details**
 *
 * `requiresSecretSession` is true when at least one member of the quad is still
 * an `op://` reference; those invocations must run under `op run` or degrade to
 * local-only, because Turbo would otherwise receive an unresolved reference.
 *
 * **Example** (Describe an honored remote-read plan)
 *
 * ```ts
 * import { RemoteReadTurboCache, TurboCacheMode } from "@beep/repo-cli/test/SharedInternals"
 *
 * const plan = RemoteReadTurboCache.make({
 *   mode: TurboCacheMode.Enum.LocalWriteRemoteRead,
 *   requiresSecretSession: true
 * })
 * console.log(plan.mode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RemoteReadTurboCache extends S.Class<RemoteReadTurboCache>($I`RemoteReadTurboCache`)(
  {
    _tag: S.tag("remote-read"),
    mode: TurboCacheMode,
    requiresSecretSession: S.Boolean,
  },
  $I.annote("RemoteReadTurboCache", {
    description: "The checkout carries a complete, sanctioned Turbo remote-read configuration.",
  })
) {}

/**
 * The resolved cache decision for one Turbo invocation.
 *
 * **Example** (Decode a local-only plan)
 *
 * ```ts
 * import { TurboCachePlan } from "@beep/repo-cli/test/SharedInternals"
 * import * as S from "effect/Schema"
 *
 * const plan = S.decodeUnknownSync(TurboCachePlan)({
 *   _tag: "local-only",
 *   reason: "unsupported-cache-mode",
 *   missing: []
 * })
 * console.log(plan._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TurboCachePlan = TurboCachePlanTag.mapMembers(
  Tuple.evolve([() => CallerControlledTurboCache, () => LocalOnlyTurboCache, () => RemoteReadTurboCache])
).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("TurboCachePlan", {
    description: "The resolved local Turbo cache decision for one invocation.",
  })
);

/**
 * The resolved cache decision for one Turbo invocation.
 *
 * @category models
 * @since 0.0.0
 */
export type TurboCachePlan = typeof TurboCachePlan.Type;

type TurboCacheResolutionOptions = { readonly args: ReadonlyArray<string>; readonly ci: boolean };

const CACHE_ARG_PREFIX = "--cache=";
const REMOTE_CACHE_MODE_SEGMENT = "remote:";

/**
 * Whether an argument already controls Turbo caching.
 *
 * **Details**
 *
 * Any of these means the caller has taken the decision out of the CLI's hands,
 * so no cache flag is injected: injecting a second one would reach Turbo twice.
 *
 * **Example** (Recognize explicit cache control)
 *
 * ```ts
 * import { isTurboCacheControlArg } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(isTurboCacheControlArg("--force"))
 * console.log(isTurboCacheControlArg("--filter=@beep/schema"))
 * ```
 *
 * @param arg - One Turbo argument.
 * @returns Whether the argument already controls caching.
 * @category predicates
 * @since 0.0.0
 */
export const isTurboCacheControlArg = (arg: string): boolean =>
  arg === "--no-cache" ||
  arg === "--force" ||
  Str.startsWith("--force=")(arg) ||
  arg === "--remote-only" ||
  Str.startsWith("--remote-only=")(arg) ||
  arg === "--remote-cache-read-only" ||
  Str.startsWith("--remote-cache-read-only=")(arg) ||
  Str.startsWith(CACHE_ARG_PREFIX)(arg);

const isRemoteTurboCacheArg = (arg: string): boolean =>
  Str.startsWith(CACHE_ARG_PREFIX)(arg) && Str.includes(REMOTE_CACHE_MODE_SEGMENT)(arg);

const isConfigured = (value: string | undefined): boolean =>
  pipe(O.fromUndefinedOr(value), O.map(Str.trim), O.exists(Str.isNonEmpty));

const isSecretReference = (source: TurboCacheValueSource | undefined): boolean => source === "secret-reference";

/**
 * Classify a configured value by whether it still needs resolving.
 *
 * **Details**
 *
 * Takes the verdict rather than the value, so the secret itself never crosses
 * into this module. It lives here rather than beside the `op://` predicate at
 * the reading edge because both arms then sit in a pure module where a test
 * can reach them without mutating the ambient environment — the reader's
 * secret-reference arm would otherwise be unexecutable on any checkout whose
 * credentials happen to be literal.
 *
 * **Example** (Classify both arms)
 *
 * ```ts
 * import { turboCacheValueSourceFor } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(turboCacheValueSourceFor(true), turboCacheValueSourceFor(false))
 * ```
 *
 * @param unresolvedSecretReference - Whether the value is still an `op://` reference.
 * @returns The matching value source.
 * @category constructors
 * @since 0.0.0
 */
export const turboCacheValueSourceFor = (unresolvedSecretReference: boolean): TurboCacheValueSource =>
  unresolvedSecretReference ? "secret-reference" : "literal";

/**
 * Whether this checkout's cache credentials still need `op run` to resolve.
 *
 * **Details**
 *
 * Asked at run time, independent of any invocation's arguments: a Turbo spawn
 * that is not wrapped in `op run` receives unresolved `op://` references, so it
 * must not be handed a remote posture. Callers pair this with
 * {@link localOnlyTurboCacheArgs}.
 *
 * **Example** (Literal values need no session)
 *
 * ```ts
 * import { TurboCacheEnvironment, turboCacheEnvironmentNeedsSecretSession } from "@beep/repo-cli/test/SharedInternals"
 *
 * const environment = TurboCacheEnvironment.make({ api: "literal", token: "literal", team: "literal" })
 * console.log(turboCacheEnvironmentNeedsSecretSession(environment))
 * ```
 *
 * @param environment - The remote-read configuration the checkout carries.
 * @returns Whether any configured cache value is an unresolved `op://` reference.
 * @category predicates
 * @since 0.0.0
 */
export const turboCacheEnvironmentNeedsSecretSession = (environment: TurboCacheEnvironment): boolean =>
  isSecretReference(environment.api) || isSecretReference(environment.token) || isSecretReference(environment.team);

const missingTurboCacheEnvNames = (environment: TurboCacheEnvironment): ReadonlyArray<TurboCacheEnvName> => {
  const configured = {
    TURBO_API: environment.api !== undefined,
    TURBO_TOKEN: environment.token !== undefined,
    TURBO_TEAM: environment.team !== undefined,
    TURBO_CACHE: isConfigured(environment.cache),
  } satisfies Record<TurboCacheEnvName, boolean>;

  return A.filter(TurboCacheEnvName.Options, (name) => !configured[name]);
};

const requestedTurboCacheMode = (environment: TurboCacheEnvironment): O.Option<TurboCacheMode> =>
  pipe(O.fromUndefinedOr(environment.cache), O.map(Str.trim), O.filter(TurboCacheMode.is.LocalWriteRemoteRead));

/**
 * Resolve the cache plan for one Turbo invocation.
 *
 * **Details**
 *
 * The decision is total and fails closed. CI and any caller-supplied cache flag
 * are left untouched; a complete quad pinned to `local:rw,remote:r` is honored;
 * anything else — a missing quad member, a blank value, or any other posture
 * including a remote *write* posture, which no workstation is credentialed for
 * — resolves to local-only.
 *
 * Only the four {@link TurboCacheEnvName} entries participate in this decision.
 * Unrelated reference failures belong to the separate environment-health check:
 * they are rendered as named warnings and never downgrade a healthy cache quad.
 *
 * **Gotchas**
 *
 * A remote-read plan whose quad still holds `op://` references is only usable
 * under `op run`. Callers must either wrap the invocation or downgrade its
 * arguments with {@link localOnlyTurboCacheArgs}.
 *
 * **Example** (Honor a complete configuration)
 *
 * ```ts
 * import { resolveTurboCachePlan, TurboCacheEnvironment } from "@beep/repo-cli/test/SharedInternals"
 *
 * const plan = resolveTurboCachePlan(
 *   TurboCacheEnvironment.make({
 *     api: "literal",
 *     token: "secret-reference",
 *     team: "literal",
 *     cache: "local:rw,remote:r"
 *   }),
 *   { args: [], ci: false }
 * )
 * console.log(plan._tag)
 * ```
 *
 * @param environment - The remote-read configuration the checkout carries.
 * @param options - The invocation's arguments and whether it runs under CI.
 * @returns The resolved cache plan.
 * @category configuration
 * @since 0.0.0
 */
export const resolveTurboCachePlan: {
  (options: TurboCacheResolutionOptions): (environment: TurboCacheEnvironment) => TurboCachePlan;
  (environment: TurboCacheEnvironment, options: TurboCacheResolutionOptions): TurboCachePlan;
} = dual(2, (environment: TurboCacheEnvironment, options: TurboCacheResolutionOptions): TurboCachePlan => {
  if (options.ci) {
    return CallerControlledTurboCache.make({ reason: "ci" });
  }

  if (A.some(options.args, isTurboCacheControlArg)) {
    return CallerControlledTurboCache.make({ reason: "explicit-cache-arg" });
  }

  const missing = missingTurboCacheEnvNames(environment);
  if (!A.isReadonlyArrayEmpty(missing)) {
    return LocalOnlyTurboCache.make({ reason: "incomplete-remote-config", missing });
  }

  return pipe(
    requestedTurboCacheMode(environment),
    O.match({
      onNone: () => LocalOnlyTurboCache.make({ reason: "unsupported-cache-mode", missing: A.empty() }),
      onSome: (mode) =>
        RemoteReadTurboCache.make({
          mode,
          requiresSecretSession: turboCacheEnvironmentNeedsSecretSession(environment),
        }),
    })
  );
});

/**
 * The cache arguments a plan contributes to a Turbo invocation.
 *
 * **Example** (Inject the local-only flag)
 *
 * ```ts
 * import { LocalOnlyTurboCache, turboCachePlanArgs } from "@beep/repo-cli/test/SharedInternals"
 *
 * const args = turboCachePlanArgs(
 *   LocalOnlyTurboCache.make({ reason: "unsupported-cache-mode", missing: [] })
 * )
 * console.log(args)
 * ```
 *
 * @param plan - The resolved cache plan.
 * @returns The cache arguments to prepend, empty when the caller owns them.
 * @category formatting
 * @since 0.0.0
 */
export const turboCachePlanArgs = (plan: TurboCachePlan): ReadonlyArray<string> =>
  Match.value(plan).pipe(
    Match.discriminatorsExhaustive("_tag")({
      "caller-controlled": A.empty<string>,
      "local-only": () => [`${CACHE_ARG_PREFIX}${TurboCacheMode.Enum.LocalOnly}`],
      "remote-read": ({ mode }) => [`${CACHE_ARG_PREFIX}${mode}`],
    })
  );

/**
 * Whether a plan's Turbo invocation must run under `op run` to be usable.
 *
 * **Example** (Local-only plans need no session)
 *
 * ```ts
 * import { LocalOnlyTurboCache, turboCachePlanNeedsSecretSession } from "@beep/repo-cli/test/SharedInternals"
 *
 * const plan = LocalOnlyTurboCache.make({ reason: "unsupported-cache-mode", missing: [] })
 * console.log(turboCachePlanNeedsSecretSession(plan))
 * ```
 *
 * @param plan - The resolved cache plan.
 * @returns Whether the invocation needs 1Password env injection.
 * @category predicates
 * @since 0.0.0
 */
export const turboCachePlanNeedsSecretSession = (plan: TurboCachePlan): boolean =>
  plan._tag === "remote-read" && plan.requiresSecretSession;

/**
 * Downgrade already-built Turbo arguments to the local-only cache posture.
 *
 * **Details**
 *
 * The run-time half of failing closed. Arguments are built before the CLI knows
 * whether a 1Password session exists; when the session turns out to be missing
 * or denied, the lane must still run rather than hand Turbo a remote posture it
 * has no usable token for. Arguments that carry no remote posture are returned
 * unchanged, so this is safe to apply unconditionally.
 *
 * **Example** (Degrade a remote-read invocation)
 *
 * ```ts
 * import { localOnlyTurboCacheArgs } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(localOnlyTurboCacheArgs(["turbo", "run", "check", "--cache=local:rw,remote:r"]))
 * ```
 *
 * @param args - The already-built command arguments.
 * @returns The arguments with any remote cache posture replaced by local-only.
 * @category mapping
 * @since 0.0.0
 */
export const localOnlyTurboCacheArgs = (args: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.map(args, (arg) => (isRemoteTurboCacheArg(arg) ? `${CACHE_ARG_PREFIX}${TurboCacheMode.Enum.LocalOnly}` : arg));

/**
 * Whether arguments already carry a remote cache posture.
 *
 * **Details**
 *
 * Lets a caller skip {@link localOnlyTurboCacheArgs} — and the step rebuild it
 * implies — for the overwhelmingly common case of arguments that never asked
 * for a remote cache.
 *
 * **Example** (Detect a remote posture)
 *
 * ```ts
 * import { hasRemoteTurboCacheArgs } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(hasRemoteTurboCacheArgs(["turbo", "run", "check", "--cache=local:rw"]))
 * ```
 *
 * @param args - The already-built command arguments.
 * @returns Whether any argument requests remote cache access.
 * @category predicates
 * @since 0.0.0
 */
export const hasRemoteTurboCacheArgs = (args: ReadonlyArray<string>): boolean => A.some(args, isRemoteTurboCacheArg);
