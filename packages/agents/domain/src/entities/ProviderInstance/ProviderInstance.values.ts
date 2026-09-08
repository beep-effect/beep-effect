/**
 * Value schemas for LLM provider CLI instances: provider vocabulary,
 * token-safe env-var names, and the tagged auth-snapshot union.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentsDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { pipe, SchemaTransformation } from "effect";
import * as A from "effect/Array";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $AgentsDomainId.create("entities/ProviderInstance/ProviderInstance.values");

const envVarNamePattern = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const tokenBearingEnvVarNamePattern =
  /^(?:ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN|OPENAI_API_KEY|OPENAI_ACCESS_TOKEN|AI_.+_API_KEY|.*_TOKEN|.*_SECRET|.*_KEY)$/iu;

const isTokenSafeEnvVarName = (name: string): boolean => !tokenBearingEnvVarNamePattern.test(name);
const isValidEnvVarName = (name: string): boolean => envVarNamePattern.test(name) && isTokenSafeEnvVarName(name);
const hasOnlyValidEnvVarNames = (envVars: Readonly<Record<string, string>>): boolean =>
  A.every(R.keys(envVars), isValidEnvVarName);

/**
 * Closed vocabulary of provider CLI kinds a provider instance can delegate to.
 *
 * **Details**
 *
 * This deliberately duplicates the driver vocabulary: the domain must not
 * import drivers, so the server translates between the two literal families.
 *
 * **Example** (Check provider kind membership)
 *
 * ```ts
 * import { ProviderKind } from "@beep/agents-domain/entities/ProviderInstance"
 *
 * console.log(ProviderKind.is.claude("claude"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ProviderKind = LiteralKit(["claude", "codex"]).pipe(
  $I.annoteSchema("ProviderKind", {
    description: "Closed vocabulary of provider CLI kinds a provider instance can delegate to.",
  })
);

/**
 * Type accepted by the {@link ProviderKind} schema.
 *
 * **Example** (Satisfy ProviderKind type)
 *
 * ```ts
 * import type { ProviderKind } from "@beep/agents-domain/entities/ProviderInstance"
 *
 * const kind = "claude" satisfies ProviderKind
 * console.log(kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ProviderKind = typeof ProviderKind.Type;

/**
 * Trimmed non-empty display label for one provider instance.
 *
 * **Example** (Decode instance label)
 *
 * ```ts
 * import { InstanceLabel } from "@beep/agents-domain/entities/ProviderInstance"
 * import * as S from "effect/Schema"
 *
 * const label = S.decodeUnknownSync(InstanceLabel)("personal-max")
 * console.log(label)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const InstanceLabel = S.NonEmptyString.check(S.isTrimmed(), S.isMaxLength(120)).pipe(
  S.brand("InstanceLabel"),
  $I.annoteSchema("InstanceLabel", {
    description: "Trimmed non-empty display label for one provider instance, at most 120 characters.",
  })
);

/**
 * Type accepted by the {@link InstanceLabel} schema.
 *
 * **Example** (Type decoded instance label)
 *
 * ```ts
 * import { InstanceLabel } from "@beep/agents-domain/entities/ProviderInstance"
 * import * as S from "effect/Schema"
 *
 * const label: InstanceLabel = S.decodeUnknownSync(InstanceLabel)("personal-max")
 * console.log(label)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type InstanceLabel = typeof InstanceLabel.Type;

/**
 * Non-empty filesystem path to the provider CLI binary.
 *
 * **Example** (Decode binary path)
 *
 * ```ts
 * import { BinaryPath } from "@beep/agents-domain/entities/ProviderInstance"
 * import * as S from "effect/Schema"
 *
 * const binaryPath = S.decodeUnknownSync(BinaryPath)("/usr/local/bin/claude")
 * console.log(binaryPath)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BinaryPath = S.NonEmptyString.pipe(
  S.brand("BinaryPath"),
  $I.annoteSchema("BinaryPath", {
    description: "Non-empty filesystem path to the provider CLI binary.",
  })
);

/**
 * Type accepted by the {@link BinaryPath} schema.
 *
 * **Example** (Type decoded binary path)
 *
 * ```ts
 * import { BinaryPath } from "@beep/agents-domain/entities/ProviderInstance"
 * import * as S from "effect/Schema"
 *
 * const binaryPath: BinaryPath = S.decodeUnknownSync(BinaryPath)("/usr/local/bin/claude")
 * console.log(binaryPath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BinaryPath = typeof BinaryPath.Type;

/**
 * Non-empty filesystem path used as the isolated HOME directory of one
 * provider instance.
 *
 * **Example** (Decode home path)
 *
 * ```ts
 * import { HomePath } from "@beep/agents-domain/entities/ProviderInstance"
 * import * as S from "effect/Schema"
 *
 * const homePath = S.decodeUnknownSync(HomePath)("/home/beep/.beep/providers/personal-max")
 * console.log(homePath)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HomePath = S.NonEmptyString.pipe(
  S.brand("HomePath"),
  $I.annoteSchema("HomePath", {
    description: "Non-empty filesystem path used as the isolated HOME directory of one provider instance.",
  })
);

/**
 * Type accepted by the {@link HomePath} schema.
 *
 * **Example** (Type decoded home path)
 *
 * ```ts
 * import { HomePath } from "@beep/agents-domain/entities/ProviderInstance"
 * import * as S from "effect/Schema"
 *
 * const homePath: HomePath = S.decodeUnknownSync(HomePath)("/home/beep/.beep/providers/personal-max")
 * console.log(homePath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HomePath = typeof HomePath.Type;

/**
 * Environment-variable name safe to persist on a provider instance.
 *
 * **Details**
 *
 * Rejects token-bearing names at decode time (`ANTHROPIC_API_KEY`,
 * `ANTHROPIC_AUTH_TOKEN`, `OPENAI_API_KEY`, `OPENAI_ACCESS_TOKEN`, plus the
 * `*_TOKEN`, `*_SECRET`, `*_KEY` suffix families and the `AI_*_API_KEY`
 * prefix family) so provider credentials can never smuggle into beep-owned
 * storage. Use the colocated `EnvVarName.is` guard, derived via `S.is`.
 *
 * **Example** (Guard token-safe env names)
 *
 * ```ts
 * import { EnvVarName } from "@beep/agents-domain/entities/ProviderInstance"
 *
 * console.log(EnvVarName.is("NO_PROXY")) // true
 * console.log(EnvVarName.is("ANTHROPIC_API_KEY")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EnvVarName = S.NonEmptyString.check(
  S.isPattern(envVarNamePattern, {
    identifier: $I`EnvVarNamePatternCheck`,
    title: "Env Var Name",
    description: "Checks that env-var names are POSIX-style identifiers.",
    message: "Env var names must start with a letter or underscore and contain only letters, digits, and underscores.",
  }),
  S.makeFilter(isTokenSafeEnvVarName, {
    identifier: $I`TokenSafeEnvVarNameCheck`,
    title: "Token-Safe Env Var Name",
    description: "Checks that an env-var name cannot carry a provider token, secret, or API key.",
    message:
      "Env var names that carry credentials (ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, OPENAI_API_KEY, OPENAI_ACCESS_TOKEN, *_TOKEN, *_SECRET, *_KEY, AI_*_API_KEY) cannot be stored on a provider instance.",
  })
).pipe(
  S.brand("EnvVarName"),
  $I.annoteSchema("EnvVarName", {
    description: "Environment-variable name safe to persist on a provider instance; token-bearing names rejected.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Type accepted by the {@link EnvVarName} schema.
 *
 * **Example** (Type decoded env var name)
 *
 * ```ts
 * import { EnvVarName } from "@beep/agents-domain/entities/ProviderInstance"
 * import * as S from "effect/Schema"
 *
 * const name: EnvVarName = S.decodeUnknownSync(EnvVarName)("EDITOR")
 * console.log(name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EnvVarName = typeof EnvVarName.Type;

const TokenSafeEnvVarRecord = S.Record(S.String, S.NonEmptyString).check(
  S.makeFilter(hasOnlyValidEnvVarNames, {
    identifier: $I`TokenSafeEnvVarRecordCheck`,
    title: "Token-Safe Env Var Record",
    description: "Checks that every env-var name in the record is a token-safe POSIX-style identifier.",
    message:
      "Env var names that carry credentials (ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, OPENAI_API_KEY, OPENAI_ACCESS_TOKEN, *_TOKEN, *_SECRET, *_KEY, AI_*_API_KEY) or malformed names cannot be stored on a provider instance.",
  })
);

/**
 * Extra child-process environment injected when spawning the provider CLI,
 * keyed by token-safe {@link EnvVarName}.
 *
 * **Details**
 *
 * Decoding fails (rather than silently dropping keys, the default record
 * key-selection behavior) when any name is token-bearing or malformed, so a
 * credential-smuggling record can never reach beep-owned storage.
 *
 * **Example** (Decode token-safe env vars)
 *
 * ```ts
 * import { EnvVars } from "@beep/agents-domain/entities/ProviderInstance"
 * import * as S from "effect/Schema"
 *
 * const envVars = S.decodeUnknownSync(EnvVars)({ NO_PROXY: "localhost" })
 * console.log(envVars)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EnvVars = TokenSafeEnvVarRecord.pipe(
  S.decodeTo(S.Record(EnvVarName, S.NonEmptyString), SchemaTransformation.passthrough()),
  $I.annoteSchema("EnvVars", {
    description: "Extra child-process environment injected when spawning the provider CLI, token-safe names only.",
  }),
  SchemaUtils.withCodecStatics(["decodeEffect"])
);

/**
 * Type accepted by the {@link EnvVars} schema.
 *
 * **Example** (Type decoded env vars)
 *
 * ```ts
 * import { EnvVars } from "@beep/agents-domain/entities/ProviderInstance"
 * import * as S from "effect/Schema"
 *
 * const envVars: EnvVars = S.decodeUnknownSync(EnvVars)({ EDITOR: "nvim" })
 * console.log(envVars)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EnvVars = typeof EnvVars.Type;

/**
 * Closed vocabulary of credential sources a probe can report.
 *
 * **Example** (Check token source membership)
 *
 * ```ts
 * import { TokenSource } from "@beep/agents-domain/entities/ProviderInstance"
 *
 * console.log(TokenSource.is.chatgpt("chatgpt"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TokenSource = LiteralKit(["claude.ai", "console", "api-key", "chatgpt"]).pipe(
  $I.annoteSchema("TokenSource", {
    description: "Closed vocabulary of credential sources a provider auth probe can report.",
  })
);

/**
 * Type accepted by the {@link TokenSource} schema.
 *
 * **Example** (Satisfy TokenSource type)
 *
 * ```ts
 * import type { TokenSource } from "@beep/agents-domain/entities/ProviderInstance"
 *
 * const source = "chatgpt" satisfies TokenSource
 * console.log(source)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TokenSource = typeof TokenSource.Type;

/**
 * Auth-snapshot variant for a logged-in provider CLI, carrying whatever
 * account detail the probe surfaced.
 *
 * **Example** (Decode authenticated snapshot)
 *
 * ```ts
 * import { AuthenticatedSnapshot } from "@beep/agents-domain/entities/ProviderInstance"
 * import * as S from "effect/Schema"
 *
 * const snapshot = S.decodeUnknownSync(AuthenticatedSnapshot)({
 *   status: "authenticated",
 *   email: "dev@example.com",
 *   subscriptionLabel: "max",
 *   tokenSource: "claude.ai",
 *   probedAt: "2026-07-11T00:00:00.000Z",
 * })
 * console.log(snapshot.status)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class AuthenticatedSnapshot extends S.Class<AuthenticatedSnapshot>($I`AuthenticatedSnapshot`)(
  {
    status: S.tag("authenticated"),
    email: S.OptionFromNullOr(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Account email reported by the probe; encodes absence as null.",
    }),
    subscriptionLabel: S.OptionFromNullOr(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Subscription or plan label reported by the probe; encodes absence as null.",
    }),
    tokenSource: S.OptionFromNullOr(TokenSource).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Credential source reported by the probe; encodes absence as null.",
    }),
    probedAt: S.DateTimeUtcFromString.annotateKey({
      description: "UTC instant at which the probe observed this state.",
    }),
  },
  $I.annote("AuthenticatedSnapshot", {
    description: "Auth-snapshot variant for a logged-in provider CLI.",
  })
) {
  static readonly is = S.is(AuthenticatedSnapshot);
}

/**
 * Auth-snapshot variant for a provider CLI that responded but is logged out.
 *
 * **Example** (Decode unauthenticated snapshot)
 *
 * ```ts
 * import { UnauthenticatedSnapshot } from "@beep/agents-domain/entities/ProviderInstance"
 * import * as S from "effect/Schema"
 *
 * const snapshot = S.decodeUnknownSync(UnauthenticatedSnapshot)({
 *   status: "unauthenticated",
 *   probedAt: "2026-07-11T00:00:00.000Z",
 * })
 * console.log(snapshot.status)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class UnauthenticatedSnapshot extends S.Class<UnauthenticatedSnapshot>($I`UnauthenticatedSnapshot`)(
  {
    status: S.tag("unauthenticated"),
    probedAt: S.DateTimeUtcFromString.annotateKey({
      description: "UTC instant at which the probe observed this state.",
    }),
  },
  $I.annote("UnauthenticatedSnapshot", {
    description: "Auth-snapshot variant for a provider CLI that responded but is logged out.",
  })
) {}

/**
 * Auth-snapshot variant for a probe that failed at the transport level before
 * any auth state could be read. Deliberately carries no error text so raw CLI
 * output never enters the domain.
 *
 * **Example** (Decode probe-failed snapshot)
 *
 * ```ts
 * import { ProbeFailedSnapshot } from "@beep/agents-domain/entities/ProviderInstance"
 * import * as S from "effect/Schema"
 *
 * const snapshot = S.decodeUnknownSync(ProbeFailedSnapshot)({
 *   status: "probe-failed",
 *   probedAt: "2026-07-11T00:00:00.000Z",
 * })
 * console.log(snapshot.status)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ProbeFailedSnapshot extends S.Class<ProbeFailedSnapshot>($I`ProbeFailedSnapshot`)(
  {
    status: S.tag("probe-failed"),
    probedAt: S.DateTimeUtcFromString.annotateKey({
      description: "UTC instant at which the probe attempt failed.",
    }),
  },
  $I.annote("ProbeFailedSnapshot", {
    description: "Auth-snapshot variant for a transport-level probe failure; carries no error text.",
  })
) {}

/**
 * Tagged union of provider auth-probe outcomes, discriminated by `status`.
 *
 * **Example** (Build auth snapshot union)
 *
 * ```ts
 * import { AuthSnapshot } from "@beep/agents-domain/entities/ProviderInstance"
 *
 * const snapshot = AuthSnapshot.decodeUnknownSync({
 *   status: "unauthenticated",
 *   probedAt: "2026-07-11T00:00:00.000Z",
 * })
 * console.log(AuthSnapshot.is(snapshot))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AuthSnapshot = pipe(
  S.Union([AuthenticatedSnapshot, UnauthenticatedSnapshot, ProbeFailedSnapshot]),
  $I.annoteSchema("AuthSnapshot", {
    description: "Tagged union of provider auth-probe outcomes, discriminated by status.",
  }),
  SchemaUtils.withCodecStatics(["decodeUnknownSync", "is"]),
  (schema) =>
    schema.pipe(
      S.toTaggedUnion("status"),
      SchemaUtils.withStatics(() => ({
        decodeUnknownSync: schema.decodeUnknownSync,
        is: schema.is,
      }))
    )
);

/**
 * Type accepted by the {@link AuthSnapshot} schema.
 *
 * **Example** (Type auth snapshot union)
 *
 * ```ts
 * import { ProbeFailedSnapshot } from "@beep/agents-domain/entities/ProviderInstance"
 * import type { AuthSnapshot } from "@beep/agents-domain/entities/ProviderInstance"
 * import * as S from "effect/Schema"
 *
 * const snapshot: AuthSnapshot = S.decodeUnknownSync(ProbeFailedSnapshot)({
 *   status: "probe-failed",
 *   probedAt: "2026-07-11T00:00:00.000Z",
 * })
 * console.log(snapshot.status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AuthSnapshot = typeof AuthSnapshot.Type;
