/**
 * The `Vercel.EnvVar` resource: one environment variable of a Vercel project,
 * for a set of targets and optionally one preview branch.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyVercelId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as O from "@beep/utils/Option";
import * as projects from "@distilled.cloud/vercel/projects";
import { Unowned } from "alchemy/AdoptPolicy";
import { isResolved } from "alchemy/Diff";
import * as Provider from "alchemy/Provider";
import { Resource } from "alchemy/Resource";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equivalence from "effect/Equivalence";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import { teamScope } from "./internal/scope.ts";
import type { DeclaredResource } from "./internal/resource.ts";
import type { Providers } from "./Providers.ts";

const $I = $AlchemyVercelId.create("EnvVar");

/**
 * Deployment environment an environment variable applies to.
 *
 * **Example** (Guard a target)
 *
 * ```ts
 * import { EnvTarget } from "@beep/alchemy-vercel/EnvVar"
 *
 * console.log(EnvTarget.is.production("production")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EnvTarget = LiteralKit(["production", "preview", "development"]).pipe(
  $I.annoteSchema("EnvTarget", {
    description: "Vercel deployment environment an environment variable applies to.",
  })
);

/**
 * Type-level member of {@link EnvTarget}.
 *
 * @category models
 * @since 0.0.0
 */
export type EnvTarget = typeof EnvTarget.Type;

/**
 * Storage type of an environment variable.
 *
 * **Details**
 *
 * `encrypted` values can be read back by team members; `sensitive` values
 * are write-only and never returned by the API. Vercel accepts `sensitive`
 * only for the `production` and `preview` targets.
 *
 * **Example** (Mark a value write-only)
 *
 * ```ts
 * import { EnvVarType } from "@beep/alchemy-vercel/EnvVar"
 *
 * console.log(EnvVarType.Enum.sensitive) // "sensitive"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EnvVarType = LiteralKit(["plain", "encrypted", "sensitive"]).pipe(
  $I.annoteSchema("EnvVarType", {
    description: "Vercel storage type of an environment variable value.",
  })
);

/**
 * Type-level member of {@link EnvVarType}.
 *
 * @category models
 * @since 0.0.0
 */
export type EnvVarType = typeof EnvVarType.Type;

/**
 * Environment variable name.
 *
 * **Example** (Validate a key)
 *
 * ```ts
 * import { EnvKey } from "@beep/alchemy-vercel/EnvVar"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(EnvKey)("NEXT_PUBLIC_SITE")) // true
 * console.log(S.is(EnvKey)("1BAD")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EnvKey = S.String.check(
  S.isPattern(/^[A-Za-z_][A-Za-z0-9_]*$/, {
    identifier: "EnvKeyPattern",
    title: "Environment variable name",
    description: "Letters, digits and underscores, not starting with a digit.",
  })
).pipe(
  $I.annoteSchema("EnvKey", {
    description: "Name of a Vercel environment variable.",
  })
);

/**
 * Type-level member of {@link EnvKey}.
 *
 * @category models
 * @since 0.0.0
 */
export type EnvKey = typeof EnvKey.Type;

/**
 * Props of {@link EnvVar}.
 *
 * **Details**
 *
 * `value` is `Redacted`: Alchemy keeps it wrapped in state and logs, and the
 * provider unwraps it only to build the request body. A `gitBranch` scopes
 * the variable to one preview branch and requires `targets` to be exactly
 * `["preview"]`. Changing `project`, `teamId` or `type` replaces the
 * variable; everything else updates it in place.
 *
 * **Example** (A sensitive production variable)
 *
 * ```ts
 * import { EnvVarProps } from "@beep/alchemy-vercel/EnvVar"
 * import * as Redacted from "effect/Redacted"
 * import * as S from "effect/Schema"
 *
 * const props = S.decodeUnknownOption(EnvVarProps)({
 *   project: "prj_1",
 *   key: "API_KEY",
 *   value: Redacted.make("secret"),
 *   targets: ["production"],
 *   type: "sensitive"
 * })
 * console.log(props._tag) // "Some"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EnvVarProps = S.Struct({
  project: S.NonEmptyString.annotateKey({ description: "Id or name of the project that holds the variable." }),
  teamId: S.optionalKey(S.NonEmptyString.annotateKey({ description: "Team that owns the project." })),
  key: EnvKey,
  value: S.Redacted(S.String).annotateKey({ description: "Variable value, redacted in state and logs." }),
  targets: S.NonEmptyArray(EnvTarget).annotateKey({ description: "Deployment environments that receive the value." }),
  type: S.optionalKey(EnvVarType.annotateKey({ description: "Storage type; defaults to `encrypted`." })),
  gitBranch: S.optionalKey(S.NonEmptyString.annotateKey({ description: "Preview branch the variable is scoped to." })),
  comment: S.optionalKey(S.String.annotateKey({ description: "Note shown next to the variable in Vercel." })),
}).pipe(
  $I.annoteSchema("EnvVarProps", {
    description: "Desired state of one Vercel project environment variable.",
  })
);

/**
 * Type-level member of {@link EnvVarProps}.
 *
 * @category models
 * @since 0.0.0
 */
export type EnvVarProps = typeof EnvVarProps.Type;

/**
 * Body of `POST /v10/projects/{idOrName}/env`, which the distilled SDK types
 * as `unknown`.
 *
 * **Example** (Encode a request body)
 *
 * ```ts
 * import { EnvVarRequestBody } from "@beep/alchemy-vercel/EnvVar"
 * import * as S from "effect/Schema"
 *
 * const body = S.decodeUnknownOption(EnvVarRequestBody)({
 *   key: "SITE",
 *   value: "https://example.com",
 *   type: "encrypted",
 *   target: ["production", "preview"]
 * })
 * console.log(body._tag) // "Some"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EnvVarRequestBody extends S.Opaque<EnvVarRequestBody, { readonly brand: unique symbol }>()(
  S.Struct({
    key: EnvKey,
    value: S.String,
    type: EnvVarType,
    target: S.NonEmptyArray(EnvTarget),
    gitBranch: S.optionalKey(S.NonEmptyString),
    comment: S.optionalKey(S.String),
  }).pipe(
    $I.annoteSchema("EnvVarRequestBody", {
      description: "Wire body that creates or upserts one Vercel environment variable.",
    })
  )
) {}

/**
 * Attributes of a deployed {@link EnvVar}. The value is never an attribute.
 *
 * **Example** (Decode attributes)
 *
 * ```ts
 * import { EnvVarAttributes } from "@beep/alchemy-vercel/EnvVar"
 * import * as S from "effect/Schema"
 *
 * const attrs = S.decodeUnknownOption(EnvVarAttributes)({
 *   envId: "env_1",
 *   projectId: "prj_1",
 *   key: "SITE",
 *   type: "encrypted",
 *   targets: ["production"]
 * })
 * console.log(attrs._tag) // "Some"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EnvVarAttributes extends S.Opaque<EnvVarAttributes, { readonly brand: unique symbol }>()(
  S.Struct({
    envId: S.String,
    projectId: S.String,
    key: S.String,
    type: S.String,
    targets: S.Array(S.String),
    gitBranch: S.optionalKey(S.String),
  }).pipe(
    $I.annoteSchema("EnvVarAttributes", {
      description: "Observed state of a Vercel environment variable, without its value.",
    })
  )
) {}

/**
 * Resource type of {@link EnvVar}.
 *
 * @category resources
 * @since 0.0.0
 */
export interface EnvVar extends Resource<"Vercel.EnvVar", EnvVarProps, EnvVarAttributes, never, Providers> {}

const EnvVarClass = Resource<EnvVar>("Vercel.EnvVar");

/**
 * An environment variable of a Vercel project.
 *
 * **Details**
 *
 * A variable is identified by its project, key, target set and git branch.
 * Variables carry no ownership marker, so one this stack did not create
 * reads as foreign and needs `adopt(true)`; adopting overwrites its value.
 * Sensitive values cannot be read back, so drift in a value made outside
 * the stack is not detected; every update writes the declared value.
 *
 * **Example** (Sensitive production variable from config)
 *
 * ```ts
 * import * as Vercel from "@beep/alchemy-vercel"
 * import * as Config from "effect/Config"
 * import * as Effect from "effect/Effect"
 *
 * export const program = Effect.gen(function* () {
 *   const project = yield* Vercel.Project("Web", { name: "web" })
 *   const token = yield* Config.Redacted("HUBSPOT_TOKEN")
 *   yield* Vercel.EnvVar("HubSpotToken", {
 *     project: project.projectId,
 *     key: "HUBSPOT_TOKEN",
 *     value: token,
 *     targets: ["production"],
 *     type: "sensitive"
 *   })
 * })
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export const EnvVar: DeclaredResource<EnvVar> = EnvVarClass;

const sortTargets = A.sort(Order.String);

/**
 * Vercel's upsert replaces any variable with the same key and branch that shares a target, so
 * existence and ownership are judged on overlapping targets, not only an identical set.
 *
 * @param left - The targets of one variable.
 * @param right - The targets of the other.
 * @returns Whether the two target sets share a target.
 */
const overlaps = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  A.some(left, (target) => A.contains(right, target));

const sameTargets = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  A.makeEquivalence(Equivalence.String)(sortTargets(left), sortTargets(right));

type ListedEnv = projects.FilterProjectEnvsResponseBodyCase2EnvsItem;

const listedTargets = (env: ListedEnv): ReadonlyArray<string> =>
  P.isString(env.target) ? [env.target] : (env.target ?? []);

const listEnvs = Effect.fn("Vercel.EnvVar.list")(function* (project: string, teamId: string | undefined) {
  const body = yield* projects.filterProjectEnvs({ idOrName: project, decrypt: false, ...teamScope(teamId) });
  return P.hasProperty(body, "envs") ? A.fromIterable<ListedEnv>(body.envs) : [];
});

const toAttributes =
  (projectId: string) =>
  (env: ListedEnv & { readonly id: string }): EnvVarAttributes =>
    EnvVarAttributes.make({
      envId: env.id,
      projectId,
      key: env.key,
      type: env.type,
      targets: listedTargets(env),
      ...O.getSomesStruct({ gitBranch: O.fromUndefinedOr(env.gitBranch) }),
    });

const hasId = (env: ListedEnv): env is ListedEnv & { readonly id: string } => P.isString(env.id);

/**
 * Find the variable by id, or by key, target set and branch when no id is known.
 */
const findEnv = Effect.fn("Vercel.EnvVar.find")(function* (
  project: string,
  teamId: string | undefined,
  match: {
    readonly envId?: string;
    readonly key: string;
    readonly targets: ReadonlyArray<string>;
    readonly gitBranch?: string;
    readonly overlap?: boolean;
  }
) {
  const envs = yield* listEnvs(project, teamId).pipe(Effect.catchTag("NotFound", () => Effect.succeed([])));
  return A.findFirst(A.filter(envs, hasId), (env) =>
    match.envId === undefined
      ? env.key === match.key &&
        env.gitBranch === match.gitBranch &&
        (match.overlap === true ? overlaps : sameTargets)(listedTargets(env), match.targets)
      : env.id === match.envId
  ).pipe(O.map(toAttributes(project)), O.getOrUndefined);
});

/**
 * Whether the stored variable's type differs from the declared one.
 *
 * @param news - The declared props.
 * @param output - The stored attributes, when the variable is deployed or adopted.
 * @returns `true` when reconcile must replace the variable to reach the declared type.
 */
const storedTypeDiffers = (news: EnvVarProps, output: EnvVarAttributes | undefined): boolean =>
  output !== undefined && output.type !== (news.type ?? EnvVarType.Enum.encrypted);

const requestBody = (news: EnvVarProps) =>
  S.encodeEffect(EnvVarRequestBody)(
    EnvVarRequestBody.make({
      key: news.key,
      value: Redacted.value(news.value),
      type: news.type ?? EnvVarType.Enum.encrypted,
      target: news.targets,
      ...O.getSomesStruct({
        gitBranch: O.fromUndefinedOr(news.gitBranch),
        comment: O.fromUndefinedOr(news.comment),
      }),
    })
  );

/**
 * Provider layer for {@link EnvVar}.
 *
 * **Example** (Register the provider)
 *
 * ```ts
 * import { EnvVarProvider } from "@beep/alchemy-vercel/EnvVar"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(EnvVarProvider)) // true
 * ```
 *
 * @category providers
 * @since 0.0.0
 */
export const EnvVarProvider = Provider.succeed(EnvVarClass, {
  stables: ["envId", "projectId"],
  read: Effect.fn("Vercel.EnvVar.provider.read")(function* ({ olds, output, previous }) {
    const state = yield* findEnv(output?.projectId ?? olds.project, olds.teamId, {
      key: olds.key,
      targets: olds.targets,
      overlap: true,
      ...O.getSomesStruct({
        envId: O.fromUndefinedOr(output?.envId),
        gitBranch: O.fromUndefinedOr(olds.gitBranch),
      }),
    });
    if (state === undefined) return undefined;
    // Variables carry no ownership marker: without prior state the variable is foreign,
    // unless it is this resource's own previous generation (a delete-first replacement).
    return output !== undefined || state.envId === previous?.envId ? state : Unowned(state);
  }),
  diff: Effect.fn("Vercel.EnvVar.provider.diff")(function* ({ news, olds, output }) {
    if (!isResolved(news)) return undefined;
    if (
      news.project !== olds.project ||
      news.teamId !== olds.teamId ||
      (news.type ?? EnvVarType.Enum.encrypted) !== (olds.type ?? EnvVarType.Enum.encrypted)
    ) {
      // A same-project replacement would collide with the old key and targets, so it deletes first.
      return { action: "replace", deleteFirst: news.project === olds.project } as const;
    }
    // A stored type that differs from the declared one (an adopted variable) needs reconcile,
    // which replaces it; anything else, the redacted value included, falls through to the
    // engine's prop comparison.
    return storedTypeDiffers(news, output) ? ({ action: "update" } as const) : undefined;
  }),
  reconcile: Effect.fn("Vercel.EnvVar.provider.reconcile")(function* ({ news, output, session }) {
    const scope = teamScope(news.teamId);
    const body = yield* requestBody(news);
    const existing =
      output === undefined
        ? yield* findEnv(news.project, news.teamId, {
            key: news.key,
            targets: news.targets,
            overlap: true,
            ...O.getSomesStruct({ gitBranch: O.fromUndefinedOr(news.gitBranch) }),
          })
        : yield* findEnv(output.projectId, news.teamId, { envId: output.envId, key: news.key, targets: news.targets });
    if (existing !== undefined && existing.type !== body.type) {
      // Vercel does not promise to change a stored type in place (a sensitive value can never
      // be read back), so a variable of another type is replaced delete-first rather than
      // left weaker than declared.
      yield* projects
        .removeProjectEnv({ idOrName: existing.projectId, id: existing.envId, ...scope })
        .pipe(Effect.catchTag("NotFound", () => Effect.void));
      yield* projects.createProjectEnv({ idOrName: news.project, upsert: "true", ...scope, body });
    } else if (existing === undefined) {
      yield* projects.createProjectEnv({ idOrName: news.project, upsert: "true", ...scope, body });
    } else {
      yield* projects.editProjectEnv({
        idOrName: existing.projectId,
        id: existing.envId,
        ...scope,
        key: body.key,
        value: body.value,
        type: body.type,
        target: A.copy(body.target),
        gitBranch: news.gitBranch ?? null,
        ...O.getSomesStruct({ comment: O.fromUndefinedOr(body.comment) }),
      });
    }
    const reconciled = yield* findEnv(news.project, news.teamId, {
      key: news.key,
      targets: news.targets,
      ...O.getSomesStruct({ gitBranch: O.fromUndefinedOr(news.gitBranch) }),
    });
    if (reconciled === undefined) {
      return yield* Effect.die(`Vercel env var ${news.key} is not listed after reconcile`);
    }
    yield* session.note(`Vercel env var ${news.key} (${A.join(reconciled.targets, ", ")})`);
    return reconciled;
  }),
  delete: Effect.fn("Vercel.EnvVar.provider.delete")(function* ({ olds, output, session }) {
    yield* projects
      .removeProjectEnv({ idOrName: output.projectId, id: output.envId, ...teamScope(olds?.teamId) })
      .pipe(Effect.catchTag("NotFound", () => Effect.void));
    yield* session.note(`Deleted Vercel env var ${output.key}`);
  }),
});
