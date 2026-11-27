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
import * as Config from "effect/Config";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Equivalence from "effect/Equivalence";
import { pipe } from "effect/Function";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import { teamScope } from "./internal/scope.ts";
import type { DeclaredResource } from "./internal/resource.ts";
import type { Providers } from "./Providers.ts";

const $I = $AlchemyVercelId.create("EnvVar");

/**
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
 * @category models
 * @since 0.0.0
 */
export type EnvTarget = typeof EnvTarget.Type;

/**
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
 * @category models
 * @since 0.0.0
 */
export type EnvVarType = typeof EnvVarType.Type;

/**
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
 * @category models
 * @since 0.0.0
 */
export type EnvKey = typeof EnvKey.Type;

/**
 * Where a secret {@link EnvVar} value comes from at deploy time.
 *
 * **Details**
 *
 * `config` names an `effect/Config` key (an environment variable under the
 * default provider, for example one `op run` resolves from an `op://`
 * reference). The provider reads it inside `diff` and `reconcile`, so only the
 * key name sits in props and state, never the value.
 *
 * **Example** (Read the value from the environment)
 *
 * ```ts
 * import { EnvVarValueSource } from "@beep/alchemy-vercel/EnvVar"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(EnvVarValueSource)({ config: "HUBSPOT_TOKEN" })) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EnvVarValueSource = S.Struct({
  config: EnvKey.annotateKey({ description: "Config key read at deploy time; its value is never stored." }),
}).pipe(
  $I.annoteSchema("EnvVarValueSource", {
    description: "Deploy-time source of an environment variable value that is kept out of Alchemy state.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type EnvVarValueSource = typeof EnvVarValueSource.Type;

/**
 * **Details**
 *
 * Give exactly one of `value` and `valueFrom`. `value` is `Redacted` in logs,
 * but Alchemy persists a `Redacted` prop's plain text in state (inside a
 * `__redacted__` envelope), so use it only for values that are not secret.
 * `valueFrom` names a config key the provider reads at deploy time; state
 * holds the key name and, as the attribute `valueDigest`, the SHA-256 of the
 * value, which is how a rotated value plans an update. A `gitBranch` scopes
 * the variable to one preview branch and requires `targets` to be exactly
 * `["preview"]`. Changing `project`, `teamId`, `key` or `type` replaces the
 * variable; everything else updates it in place. A `type` change on the same
 * project and key deletes the old variable first (the two would collide on key
 * and targets); every other replacement creates the new variable first.
 *
 * **Gotchas**
 *
 * The digest is unsalted. It is safe for a high-entropy token and can be
 * brute-forced for a short or guessable value.
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
  value: S.optionalKey(
    S.Redacted(S.String).annotateKey({
      description: "Variable value; redacted in logs, persisted in state. Not for secrets.",
    })
  ),
  valueFrom: S.optionalKey(EnvVarValueSource),
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
    valueDigest: S.optionalKey(
      S.String.annotateKey({ description: "SHA-256 (hex) of a `valueFrom` value; absent for literal values." })
    ),
  }).pipe(
    $I.annoteSchema("EnvVarAttributes", {
      description: "Observed state of a Vercel environment variable, without its value.",
    })
  )
) {}

/**
 * Raised when Vercel stores a variable with a weaker type than declared even after the
 * variable was recreated with the declared type.
 *
 * **Details**
 *
 * The provider fails rather than recreating the variable on every deploy. Declare the type
 * the team can store, or change the team's environment variable policy.
 *
 * **Example** (Describe the failure)
 *
 * ```ts
 * import { EnvVarTypeNotApplied } from "@beep/alchemy-vercel/EnvVar"
 *
 * const error = EnvVarTypeNotApplied.make({ key: "API_KEY", declared: "sensitive", stored: "encrypted" })
 * console.log(error._tag) // "EnvVarTypeNotApplied"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EnvVarTypeNotApplied extends S.TaggedError<EnvVarTypeNotApplied, { readonly brand: unique symbol }>(
  $I`EnvVarTypeNotApplied`
)(
  "EnvVarTypeNotApplied",
  {
    key: S.String.annotateKey({ description: "The variable's key." }),
    declared: EnvVarType.annotateKey({ description: "The declared storage type." }),
    stored: S.String.annotateKey({ description: "The storage type Vercel kept." }),
  },
  $I.annoteError<EnvVarTypeNotApplied>("EnvVarTypeNotApplied", {
    description: "Vercel stored an environment variable with a weaker type than declared after a replacement.",
  })
) {}

/**
 * Raised when an {@link EnvVar} declares neither or both of `value` and `valueFrom`.
 *
 * **Example** (Describe the failure)
 *
 * ```ts
 * import { EnvVarValueMissing } from "@beep/alchemy-vercel/EnvVar"
 *
 * const error = EnvVarValueMissing.make({ key: "API_KEY" })
 * console.log(error._tag) // "EnvVarValueMissing"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EnvVarValueMissing extends S.TaggedError<EnvVarValueMissing, { readonly brand: unique symbol }>(
  $I`EnvVarValueMissing`
)(
  "EnvVarValueMissing",
  {
    key: S.String.annotateKey({ description: "The variable's key." }),
  },
  $I.annoteError<EnvVarValueMissing>("EnvVarValueMissing", {
    description: "An environment variable declared neither or both of value and valueFrom.",
  })
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
 * the stack is not detected; every update writes the declared value. A
 * secret belongs in `valueFrom`, which keeps the value out of state.
 *
 * **Gotchas**
 *
 * Vercel's upsert replaces any variable with the same key and branch that
 * shares a target, so existence and ownership are judged on overlapping
 * targets, not only an identical target set. A stored type equal to or
 * stronger than the declared one satisfies it (some teams store Production
 * and Preview variables as `sensitive` whatever is requested); only a weaker
 * one is removed and created again. A missing `valueFrom` config key, or a
 * `value`/`valueFrom` mix-up, fails the plan before this variable or any
 * sibling resource is written or deleted.
 *
 * **Example** (Sensitive production variable read at deploy time)
 *
 * ```ts
 * import * as Vercel from "@beep/alchemy-vercel"
 * import * as Effect from "effect/Effect"
 *
 * export const program = Effect.gen(function* () {
 *   const project = yield* Vercel.Project("Web", { name: "web" })
 *   yield* Vercel.EnvVar("HubSpotToken", {
 *     project: project.projectId,
 *     key: "HUBSPOT_TOKEN",
 *     valueFrom: { config: "HUBSPOT_TOKEN" },
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

const typeStrength: Record<string, number> = { plain: 1, encrypted: 2, sensitive: 3 };

const strengthOf = (type: string): number => O.getOrElse(R.get(typeStrength, type), () => 0);

const isWeaker = (stored: string, declared: EnvVarType): boolean => strengthOf(stored) < strengthOf(declared);

const storedTypeWeaker = (news: EnvVarProps, output: EnvVarAttributes | undefined): boolean =>
  output !== undefined && isWeaker(output.type, news.type ?? EnvVarType.Enum.encrypted);

const resolveValue = Effect.fn("Vercel.EnvVar.resolveValue")(function* (news: EnvVarProps) {
  if (news.value !== undefined && news.valueFrom === undefined) return news.value;
  if (news.value === undefined && news.valueFrom !== undefined) {
    return yield* Config.Redacted(news.valueFrom.config);
  }
  return yield* EnvVarValueMissing.make({ key: news.key });
});

const valueDigestOf = Effect.fn("Vercel.EnvVar.valueDigest")(function* (
  news: EnvVarProps,
  value: Redacted.Redacted<string>
) {
  if (news.valueFrom === undefined) return O.none<string>();
  const digest = yield* Digest.Digest;
  const hex = yield* digest.digestHex(Digest.sha256, new TextEncoder().encode(Redacted.value(value)));
  return O.some(hex);
});

const withDigest = (state: EnvVarAttributes, digest: O.Option<string>): EnvVarAttributes =>
  EnvVarAttributes.make({ ...state, ...O.getSomesStruct({ valueDigest: digest }) });

const requestBody = (news: EnvVarProps, value: Redacted.Redacted<string>) =>
  S.encodeEffect(EnvVarRequestBody)(
    EnvVarRequestBody.make({
      key: news.key,
      value: Redacted.value(value),
      type: news.type ?? EnvVarType.Enum.encrypted,
      target: news.targets,
      ...O.getSomesStruct({
        gitBranch: O.fromUndefinedOr(news.gitBranch),
        comment: O.fromUndefinedOr(news.comment),
      }),
    })
  );

// decision: edits-never-send-key-or-type
const editFields = (news: EnvVarProps, body: typeof EnvVarRequestBody.Encoded, existing: EnvVarAttributes) => ({
  value: body.value,
  ...O.getSomesStruct({
    target: sameTargets(existing.targets, body.target) ? O.none<Array<string>>() : O.some(A.copy(body.target)),
    gitBranch:
      (existing.gitBranch ?? null) === (news.gitBranch ?? null)
        ? O.none<string | null>()
        : O.some<string | null>(news.gitBranch ?? null),
    comment: O.fromUndefinedOr(body.comment),
  }),
});

// decision: edits-never-send-key-or-type
const writeEnv = Effect.fn("Vercel.EnvVar.write")(function* (
  news: EnvVarProps,
  body: typeof EnvVarRequestBody.Encoded,
  existing: EnvVarAttributes | undefined
) {
  const scope = teamScope(news.teamId);
  const create = projects.createProjectEnv({ idOrName: news.project, upsert: "true", ...scope, body });
  if (existing === undefined) return yield* create;
  if (isWeaker(existing.type, body.type)) {
    yield* projects
      .removeProjectEnv({ idOrName: existing.projectId, id: existing.envId, ...scope })
      .pipe(Effect.catchTag("NotFound", () => Effect.void));
    return yield* create;
  }
  return yield* projects.editProjectEnv({
    idOrName: existing.projectId,
    id: existing.envId,
    ...scope,
    ...editFields(news, body, existing),
  });
});

const storageTypeOf = (props: EnvVarProps): EnvVarType => props.type ?? EnvVarType.Enum.encrypted;

const readValueSourceWhilePlanning = Effect.fn("Vercel.EnvVar.readValueSourceWhilePlanning")(function* (news: unknown) {
  const source = pipe(
    O.liftPredicate(news, P.hasProperty("valueFrom")),
    O.flatMap((props) => S.decodeUnknownOption(EnvVarValueSource)(props.valueFrom))
  );
  if (O.isSome(source)) yield* Config.Redacted(source.value.config);
});

const replacesEnvVar = (news: EnvVarProps, olds: EnvVarProps): boolean =>
  news.project !== olds.project ||
  news.teamId !== olds.teamId ||
  news.key !== olds.key ||
  storageTypeOf(news) !== storageTypeOf(olds);

const valueFromRotated = Effect.fn("Vercel.EnvVar.valueFromRotated")(function* (
  news: EnvVarProps,
  output: EnvVarAttributes | undefined,
  value: Redacted.Redacted<string>
) {
  if (news.valueFrom === undefined || output === undefined) return false;
  const digest = yield* valueDigestOf(news, value);
  return !O.contains(digest, output.valueDigest ?? "");
});

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
    const observed = withDigest(state, O.fromUndefinedOr(output?.valueDigest));
    return output !== undefined || state.envId === previous?.envId ? observed : Unowned(observed);
  }),
  diff: Effect.fn("Vercel.EnvVar.provider.diff")(function* ({ news, olds, output }) {
    yield* readValueSourceWhilePlanning(news);
    if (!isResolved(news)) return undefined;
    const resolvedBeforeAnyDelete = yield* resolveValue(news);
    if (replacesEnvVar(news, olds)) {
      return { action: "replace", deleteFirst: news.project === olds.project && news.key === olds.key } as const;
    }
    const rotated = yield* valueFromRotated(news, output, resolvedBeforeAnyDelete);
    return storedTypeWeaker(news, output) || rotated ? ({ action: "update" } as const) : undefined;
  }),
  reconcile: Effect.fn("Vercel.EnvVar.provider.reconcile")(function* ({ news, output, session }) {
    const value = yield* resolveValue(news);
    const body = yield* requestBody(news, value);
    const existing =
      output === undefined
        ? yield* findEnv(news.project, news.teamId, {
            key: news.key,
            targets: news.targets,
            overlap: true,
            ...O.getSomesStruct({ gitBranch: O.fromUndefinedOr(news.gitBranch) }),
          })
        : yield* findEnv(output.projectId, news.teamId, { envId: output.envId, key: news.key, targets: news.targets });
    yield* writeEnv(news, body, existing);
    const reconciled = yield* findEnv(news.project, news.teamId, {
      key: news.key,
      targets: news.targets,
      ...O.getSomesStruct({ gitBranch: O.fromUndefinedOr(news.gitBranch) }),
    });
    if (reconciled === undefined) {
      return yield* Effect.die(`Vercel env var ${news.key} is not listed after reconcile`);
    }
    if (isWeaker(reconciled.type, body.type)) {
      return yield* EnvVarTypeNotApplied.make({ key: news.key, declared: body.type, stored: reconciled.type });
    }
    yield* session.note(`Vercel env var ${news.key} (${A.join(reconciled.targets, ", ")})`);
    const digest = yield* valueDigestOf(news, value);
    return withDigest(reconciled, digest);
  }),
  delete: Effect.fn("Vercel.EnvVar.provider.delete")(function* ({ olds, output, session }) {
    yield* projects
      .removeProjectEnv({ idOrName: output.projectId, id: output.envId, ...teamScope(olds?.teamId) })
      .pipe(Effect.catchTag("NotFound", () => Effect.void));
    yield* session.note(`Deleted Vercel env var ${output.key}`);
  }),
});
