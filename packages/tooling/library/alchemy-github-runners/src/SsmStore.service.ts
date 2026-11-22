/**
 * SSM Parameter Store contract of the runner fleet.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { LiteralKit } from "@beep/schema";
import * as Context from "effect/Context";
import * as S from "effect/Schema";
import { $AlchemyGithubRunnersId } from "./internal/AlchemyGithubRunnersId.ts";
import type * as Effect from "effect/Effect";
import type * as O from "effect/Option";
import type * as Redacted from "effect/Redacted";
import type { AwsApiError } from "./RunnerFleet.errors.ts";

const $I = $AlchemyGithubRunnersId.create("SsmStore.service");

/**
 * A parameter listed under a path: its name and last-modified time.
 *
 * **Example** (A token parameter)
 *
 * ```ts
 * import { ParameterEntry } from "@beep/alchemy-github-runners/SsmStore.service"
 * import * as O from "effect/Option"
 *
 * const entry = ParameterEntry.make({ name: "/beep-ci/heavy/tokens/i-1", lastModified: O.some(0) })
 * console.log(entry.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParameterEntry extends S.Opaque<ParameterEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String,
    lastModified: S.Option(S.Finite).annotateKey({ description: "Epoch milliseconds." }),
  }).pipe(
    $I.annoteSchema("ParameterEntry", {
      description: "A parameter listed under a path: its name and last-modified time.",
    })
  )
) {}

/**
 * The Parameter Store tier a put writes.
 *
 * **Details**
 *
 * `Standard` values hold at most 4 KB, `Advanced` values 8 KB. A JIT runner
 * config exceeds 4 KB, so runner tokens are written `Advanced`, as upstream
 * does; small values such as the runner-group cache stay `Standard`.
 *
 * **Example** (The runner-token tier)
 *
 * ```ts
 * import { ParameterTier } from "@beep/alchemy-github-runners/SsmStore.service"
 *
 * console.log(ParameterTier.is.Advanced("Advanced")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ParameterTier = LiteralKit(["Standard", "Advanced", "Intelligent-Tiering"]).pipe(
  $I.annoteSchema("ParameterTier", { description: "The Parameter Store tier a put writes." })
);

/**
 * Runtime type for {@link ParameterTier}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ParameterTier = typeof ParameterTier.Type;

/**
 * One parameter write: name, redacted value, encryption, tier and tags.
 *
 * **Example** (A runner's JIT config)
 *
 * ```ts
 * import { ParameterWrite } from "@beep/alchemy-github-runners/SsmStore.service"
 * import * as Redacted from "effect/Redacted"
 *
 * const write = ParameterWrite.make({
 *   name: "/beep-ci/heavy/tokens/i-1",
 *   value: Redacted.make("jit"),
 *   secure: true,
 *   tier: "Advanced",
 *   tags: { InstanceId: "i-1" },
 * })
 * console.log(write.tier)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParameterWrite extends S.Opaque<ParameterWrite, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String,
    value: S.Redacted(S.String),
    secure: S.Boolean,
    tier: ParameterTier,
    tags: S.Record(S.String, S.String),
  }).pipe(
    $I.annoteSchema("ParameterWrite", {
      description: "One parameter write: name, redacted value, encryption, tier and tags.",
    })
  )
) {}

/**
 * Parameter Store operations the fleet Lambdas need.
 *
 * **Details**
 *
 * `get` decrypts and returns `None` for a missing parameter; `delete` treats
 * a missing parameter as done. `put` writes a `SecureString` when `secure` is
 * true, in the write's {@link ParameterTier}, and overwrites an existing value.
 *
 * **Example** (Read the webhook secret)
 *
 * ```ts
 * import { SsmStore } from "@beep/alchemy-github-runners/SsmStore.service"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const ssm = yield* SsmStore
 *   return yield* ssm.get("/beep-ci/app/github_app_webhook_secret")
 * })
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class SsmStore extends Context.Service<
  SsmStore,
  {
    readonly get: (name: string) => Effect.Effect<O.Option<Redacted.Redacted<string>>, AwsApiError>;
    readonly put: (input: ParameterWrite) => Effect.Effect<void, AwsApiError>;
    readonly delete: (name: string) => Effect.Effect<void, AwsApiError>;
    readonly listByPath: (path: string) => Effect.Effect<ReadonlyArray<ParameterEntry>, AwsApiError>;
  }
>()($I`SsmStore`) {}
