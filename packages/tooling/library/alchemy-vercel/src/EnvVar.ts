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
 * Type-level member of {@link EnvVarValueSource}.
 *
 * @category models
 * @since 0.0.0
 */
export type EnvVarValueSource = typeof EnvVarValueSource.Type;

/**
 * Props of {@link EnvVar}.
 *
 * **Details**
 *
 * Give exactly one of `value` and `valueFrom`. `value` is `Redacted` in logs,
 * but Alchemy persists a `Redacted` prop's plain text in state (inside a
 * `__redacted__` envelope), so use it only for values that are not secret.
 * `valueFrom` names a config key the provider reads at deploy time; state
 * holds the key name and, as the attribute `valueDigest`, the SHA-256 of the
 * value, which is how a rotated value plans an update. A `gitBranch` scopes
 * the variable to one preview branch and requires `targets` to be exactly
 * `["preview"]`. Changing `project`, `teamId` or `type` replaces the
 * variable; everything else updates it in place.
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
 * How strongly each storage type protects a value: `plain`, then `encrypted`, then `sensitive`, weakest first.
 * A type Vercel reports outside this set ranks weakest.
 */
const typeStrength: Record<string, number> = { plain: 1, encrypted: 2, sensitive: 3 };

const strengthOf = (type: string): number => O.getOrElse(R.get(typeStrength, type), () => 0);

/**
 * Whether a stored type is weaker than the declared one.
 *
 * **Details**
 *
 * A stored type that is equal or stronger satisfies the declaration: some teams store
 * Production and Preview variables as `sensitive` whatever type is requested, and such a
 * variable must not be replaced on every deploy.
 *
 * @param stored - The type Vercel reports for the variable.
 * @param declared - The declared type.
 * @returns `true` when the stored type protects the value less than declared.
 */
const isWeaker = (stored: string, declared: EnvVarType): boolean => strengthOf(stored) < strengthOf(declared);

/**
 * Whether the stored variable needs a type-driven replacement.
 *
 * @param news - The declared props.
 * @param output - The stored attributes, when the variable is deployed or adopted.
 * @returns `true` when the stored type is weaker than the declared one.
 */
const storedTypeWeaker = (news: EnvVarProps, output: EnvVarAttributes | undefined): boolean =>
  output !== undefined && isWeaker(output.type, news.type ?? EnvVarType.Enum.encrypted);

/**
 * The declared value: the literal `value`, or the config key `valueFrom` names, read now.
 *
 * @param news - The declared props.
 * @returns The value, still redacted.
 */
const resolveValue = Effect.fn("Vercel.EnvVar.resolveValue")(function* (news: EnvVarProps) {
  if (news.value !== undefined && news.valueFrom === undefined) return news.value;
  if (news.value === undefined && news.valueFrom !== undefined) {
    return yield* Config.Redacted(news.valueFrom.config);
  }
  return yield* EnvVarValueMissing.make({ key: news.key });
});

/**
 * SHA-256 (lowercase hex) of a `valueFrom` value; `None` for a literal `value`, whose
 * change the engine already sees as a prop change.
 *
 * @param news - The declared props.
 * @param value - The resolved value.
 * @returns The digest to keep as the `valueDigest` attribute.
 */
const valueDigestOf = Effect.fn("Vercel.EnvVar.valueDigest")(function* (
  news: EnvVarProps,
  value: Redacted.Redacted<string>
) {
  if (news.valueFrom === undefined) return O.none<string>();
  const digest = yield* Digest.Digest;
  const hex = yield* digest.digestHex(Digest.sha256, new TextEncoder().encode(Redacted.value(value)));
  return O.some(hex);
});

/**
 * The observed attributes, carrying the stored `valueDigest` forward: a read never sees the value.
 *
 * @param state - The variable as Vercel lists it.
 * @param digest - The digest to keep.
 * @returns The attributes with the digest.
 */
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

/**
 * Create, edit or type-replace the variable so Vercel holds the declared value.
 *
 * **Details**
 *
 * Vercel does not promise to change a stored type in place (a sensitive value can never be
 * read back), so a variable stored weaker than declared is removed and created again. An
 * existing variable of equal or stronger type is edited without a type, so it keeps it.
 *
 * @param news - The declared props.
 * @param body - The encoded request body.
 * @param existing - The variable already on Vercel, if any.
 * @returns An effect that completes once the write is accepted.
 */
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
    key: body.key,
    value: body.value,
    target: A.copy(body.target),
    gitBranch: news.gitBranch ?? null,
    ...O.getSomesStruct({ comment: O.fromUndefinedOr(body.comment) }),
  });
});

/**
 * The declared or default storage type.
 *
 * @param props - Props of the variable.
 * @returns Its storage type, `encrypted` when omitted.
 */
const storageTypeOf = (props: EnvVarProps): EnvVarType => props.type ?? EnvVarType.Enum.encrypted;

/**
 * Read the `valueFrom` config key of declared props whose other inputs may not be resolved yet.
 *
 * **Details**
 *
 * `valueFrom` is always a literal, so it is decoded from the raw props; the read fails with the
 * config error when the key is missing, and does nothing for a literal `value`.
 *
 * @param news - The declared props, possibly holding unresolved outputs.
 * @returns An effect that fails when the `valueFrom` key cannot be read.
 */
const readValueSourceWhilePlanning = Effect.fn("Vercel.EnvVar.readValueSourceWhilePlanning")(function* (news: unknown) {
  const source = pipe(
    O.liftPredicate(news, P.hasProperty("valueFrom")),
    O.flatMap((props) => S.decodeUnknownOption(EnvVarValueSource)(props.valueFrom))
  );
  if (O.isSome(source)) yield* Config.Redacted(source.value.config);
});

/**
 * Whether a change replaces the variable: another project, team or storage type.
 *
 * @param news - The declared props.
 * @param olds - The props of the deployed generation.
 * @returns `true` when the variable must be replaced.
 */
const replacesEnvVar = (news: EnvVarProps, olds: EnvVarProps): boolean =>
  news.project !== olds.project || news.teamId !== olds.teamId || storageTypeOf(news) !== storageTypeOf(olds);

/**
 * Whether a `valueFrom` value changed since the last write. The value never reaches props,
 * so a rotation shows only as a digest change; an adopted variable has no digest yet.
 *
 * @param news - The declared props.
 * @param output - The stored attributes, when the variable is deployed or adopted.
 * @param value - The value resolved for this plan.
 * @returns `true` when the value must be written again.
 */
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
    // Variables carry no ownership marker: without prior state the variable is foreign,
    // unless it is this resource's own previous generation (a delete-first replacement).
    return output !== undefined || state.envId === previous?.envId ? observed : Unowned(observed);
  }),
  diff: Effect.fn("Vercel.EnvVar.provider.diff")(function* ({ news, olds, output }) {
    // A `valueFrom` key is read while planning, before any other input resolves, so a missing key
    // fails the plan before anything (this variable or a sibling resource) is written.
    yield* readValueSourceWhilePlanning(news);
    if (!isResolved(news)) return undefined;
    // Resolve the declared value before any outcome: a replacement deletes the old variable first and
    // a weaker stored type is removed and recreated in reconcile, so a missing key or a value/valueFrom
    // mix-up must fail the plan here, before anything is deleted. The value is only validated and
    // digested, never kept.
    const value = yield* resolveValue(news);
    if (replacesEnvVar(news, olds)) {
      // A same-project replacement would collide with the old key and targets, so it deletes first.
      return { action: "replace", deleteFirst: news.project === olds.project } as const;
    }
    // A stored type weaker than declared (an adopted variable) needs reconcile, which replaces it;
    // a rotated `valueFrom` value needs a write. A literal value, like every other prop, falls
    // through to the engine's prop comparison.
    const rotated = yield* valueFromRotated(news, output, value);
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
