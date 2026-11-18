/**
 * SSM Parameter Store contract of the runner fleet.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyGithubRunnersId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as S from "effect/Schema";
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
 * Parameter Store operations the fleet Lambdas need.
 *
 * **Details**
 *
 * `get` decrypts and returns `None` for a missing parameter; `delete` treats
 * a missing parameter as done. `put` writes a `SecureString` when `secure` is
 * true and overwrites an existing value.
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
    readonly put: (input: {
      readonly name: string;
      readonly value: Redacted.Redacted<string>;
      readonly secure: boolean;
      readonly tags: Readonly<Record<string, string>>;
    }) => Effect.Effect<void, AwsApiError>;
    readonly delete: (name: string) => Effect.Effect<void, AwsApiError>;
    readonly listByPath: (path: string) => Effect.Effect<ReadonlyArray<ParameterEntry>, AwsApiError>;
  }
>()($I`SsmStore`) {}
