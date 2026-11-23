/**
 * The `InfraGithubSecrets` stack: GitHub Actions environment secrets whose
 * values live in 1Password. It deploys from a workstation only, under
 * `op run`, so no credential that can read 1Password ever enters CI
 * (packet-gate ruling 2026-11-13).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as GitHub from "@alchemy.run/github";
import { $InfraGithubId } from "@beep/identity/packages";
import { adopt } from "alchemy/AdoptPolicy";
import { retain } from "alchemy/RemovalPolicy";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { idFragment } from "./Stack.ts";
import type * as Redacted from "effect/Redacted";
import type { SecretSpec, SecretsConfig } from "./Config.ts";

const $I = $InfraGithubId.create("Secrets");

/**
 * The logical id a secret declares under: its environment and its name.
 *
 * **Example** (Derive the fleet-watch key's id)
 *
 * ```ts
 * import { productionSecretsConfig } from "@beep/infra-github/Production"
 * import { secretLogicalId } from "@beep/infra-github/Secrets"
 *
 * console.log(secretLogicalId(productionSecretsConfig.secrets[0]!)) // "Secret-fleet-watch-FLEET_WATCH_APP_PRIVATE_KEY"
 * ```
 *
 * @param spec - The secret whose environment and name form the id.
 * @returns `Secret-<environment, non-alphanumerics as "-">-<name>`.
 * @category utilities
 * @since 0.0.0
 */
export const secretLogicalId = (spec: SecretSpec): string => `Secret-${idFragment(spec.environment)}-${spec.name}`;

/**
 * The `op run --env-file` text for the configuration: one
 * `NAME="op://..."` line per secret. `op run` resolves each reference into
 * the deploy's environment and masks the values in its output; the file
 * holds references only, never a value.
 *
 * **Example** (Render the env file)
 *
 * ```ts
 * import { productionSecretsConfig } from "@beep/infra-github/Production"
 * import { secretsEnvFile } from "@beep/infra-github/Secrets"
 *
 * console.log(secretsEnvFile(productionSecretsConfig).startsWith("FLEET_WATCH_APP_PRIVATE_KEY=")) // true
 * ```
 *
 * @param config - The secrets whose references the file carries.
 * @returns One `NAME="op://..."` line per secret, each newline-terminated.
 * @category utilities
 * @since 0.0.0
 */
export const secretsEnvFile = (config: SecretsConfig): string =>
  A.join(
    A.map(config.secrets, ({ name, reference }) => `${name}="${reference}"\n`),
    ""
  );

/**
 * **Example** (Inspect a name collision)
 *
 * ```ts
 * import { DuplicateSecretName } from "@beep/infra-github/Secrets"
 *
 * const error = DuplicateSecretName.make({ secretName: "KEY" })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DuplicateSecretName extends S.TaggedError<DuplicateSecretName, { readonly brand: unique symbol }>(
  $I`DuplicateSecretName`
)(
  "DuplicateSecretName",
  { secretName: S.String },
  $I.annote("DuplicateSecretName", {
    description: "Two secrets share a name, so one env-file entry would feed both; nothing is declared.",
  })
) {
  /**
   * The collision as one line.
   *
   * @returns The rendered collision.
   * @since 0.0.0
   */
  override get message(): string {
    return `two secrets are named ${this.secretName}; the op run env file can carry only one value per name.`;
  }
}

/**
 * The first secret name declared twice, compared case-insensitively, if any.
 *
 * **Example** (Find no collision in production)
 *
 * ```ts
 * import { productionSecretsConfig } from "@beep/infra-github/Production"
 * import { findDuplicateSecretName } from "@beep/infra-github/Secrets"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(findDuplicateSecretName(productionSecretsConfig))) // true
 * ```
 *
 * @param config - The secrets whose names are compared.
 * @returns The first name seen twice, or `None` when every name is unique.
 * @category validation
 * @since 0.0.0
 */
export const findDuplicateSecretName = (config: SecretsConfig): O.Option<DuplicateSecretName> => {
  const names = A.map(config.secrets, ({ name }) => Str.toUpperCase(name));
  return O.map(
    A.findFirst(names, (name, index) => A.contains(A.take(names, index), name)),
    (secretName) => DuplicateSecretName.make({ secretName })
  );
};

/**
 * Declares one `GitHub.Secret` per configured secret, adopted by name and
 * retained on removal, with the value `valueOf` returns for it. Dies with
 * {@link DuplicateSecretName}, declaring nothing, when two secrets share a
 * name.
 *
 * **Example** (Declare the production secrets inside a stack)
 *
 * ```ts
 * import { productionSecretsConfig } from "@beep/infra-github/Production"
 * import { declareSecrets } from "@beep/infra-github/Secrets"
 * import * as Redacted from "effect/Redacted"
 *
 * const program = declareSecrets(productionSecretsConfig, () => Redacted.make("placeholder"))
 * console.log(typeof program) // "object"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const declareSecrets = Effect.fn("InfraGithubSecrets.declareSecrets")(function* (
  config: SecretsConfig,
  valueOf: (spec: SecretSpec) => Redacted.Redacted<string>
) {
  const duplicate = findDuplicateSecretName(config);
  if (O.isSome(duplicate)) return yield* Effect.die(duplicate.value);
  yield* Effect.forEach(
    config.secrets,
    (spec) =>
      GitHub.Secret(secretLogicalId(spec), {
        owner: config.owner,
        repository: config.repository,
        environment: spec.environment,
        name: spec.name,
        value: valueOf(spec),
      }).pipe(adopt(true)),
    { concurrency: 1 }
  );
  return { secrets: A.map(config.secrets, secretLogicalId) };
}, retain());
