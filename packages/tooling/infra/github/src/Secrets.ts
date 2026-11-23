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
import { Stack } from "alchemy/Stack";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { productionSecretsConfig, productionStage } from "./Production.ts";
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

/**
 * **Example** (Inspect a refused stage)
 *
 * ```ts
 * import { SecretsStageIsNotProd } from "@beep/infra-github/Secrets"
 *
 * const refused = SecretsStageIsNotProd.make({ stage: "preview_x" })
 * console.log(refused.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SecretsStageIsNotProd extends S.TaggedError<SecretsStageIsNotProd, { readonly brand: unique symbol }>(
  $I`SecretsStageIsNotProd`
)(
  "SecretsStageIsNotProd",
  { stage: S.String },
  $I.annote("SecretsStageIsNotProd", {
    description:
      "The secrets stack started on a stage other than prod. Every stage would write the live repository's secrets, so it refuses before reading any value or sending any request.",
  })
) {
  /**
   * The refusal as one line.
   *
   * @returns The rendered refusal.
   * @since 0.0.0
   */
  override get message(): string {
    return `InfraGithubSecrets runs only on stage ${productionStage}, not ${this.stage}: every stage writes the live repository's secrets, so there is no preview.`;
  }
}

/**
 * The `InfraGithubSecrets` stack program. A stage other than `prod` dies
 * with {@link SecretsStageIsNotProd} before any configuration read, so no
 * secret value is loaded and no request is sent. On `prod` it refuses CI,
 * requires `INFRA_GITHUB_SECRETS_PLANE=workstation`, then reads each value
 * as a non-empty `Redacted` string and declares the secrets. An empty value
 * dies before any declaration, so it never replaces a working secret.
 *
 * **Example** (Mount the program in a stack)
 *
 * ```ts
 * import { secretsProgram } from "@beep/infra-github/Secrets"
 *
 * console.log(typeof secretsProgram) // "object"
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const secretsProgram = Effect.gen(function* () {
  const stack = yield* Stack;
  if (stack.stage !== productionStage) {
    return yield* Effect.die(SecretsStageIsNotProd.make({ stage: stack.stage }));
  }
  const ci = yield* Config.option(Config.String("CI"));
  if (O.isSome(ci) && ci.value !== "") {
    return yield* Effect.die("InfraGithubSecrets deploys from a workstation under op run, never from CI.");
  }
  yield* Config.Literal("workstation", "INFRA_GITHUB_SECRETS_PLANE");
  const entries = yield* Effect.forEach(
    productionSecretsConfig.secrets,
    Effect.fnUntraced(function* (spec) {
      const value = yield* Config.schema(S.Redacted(S.NonEmptyString), spec.name);
      return [spec.name, value] as const;
    }),
    { concurrency: 1 }
  );
  const values = HashMap.fromIterable(entries);
  return yield* declareSecrets(productionSecretsConfig, (spec) => O.getOrThrow(HashMap.get(values, spec.name)));
}).pipe(Effect.orDie);
