/**
 * Desired-intent schema for OpenClaw deployments.
 *
 * The intent vocabulary is ours, not an upstream mirror: consumers describe the
 * deployment they want in stable technical terms and the versioned render
 * adapter maps it onto the pinned OpenClaw `openclaw.json` shape. Secrets are
 * always op:// references — never plaintext values.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OpenclawId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $OpenclawId.create("OpenclawIntent.models");
const secretReferencePattern = /^op:\/\/[^/]+\/[^/]+\/.+$/u;
const absolutePathPattern = /^\/.*$/u;
const agentIdentifierPattern = /^[a-z0-9][a-z0-9_-]*$/u;
const httpUrlPattern = /^https?:\/\/\S+$/u;
const OpenclawTargetVersionBase = LiteralKit(["2026.7.1-2"]);
const OpenclawGatewayBindBase = LiteralKit(["loopback"]);
const OpenclawProviderApiBase = LiteralKit(["ollama", "openai-compat"]);
const OpenclawModelInputKindBase = LiteralKit(["text", "image"]);
const OpenclawAuthProfileModeBase = LiteralKit(["api_key", "oauth"]);
const OpenclawTelegramDmPolicyBase = LiteralKit(["pairing", "disabled", "open"]);
const OpenclawTelegramGroupPolicyBase = LiteralKit(["open", "disabled"]);
const OpenclawConfidentialityPolicyBase = LiteralKit(["advisory"]);
const OpenclawClientDataPolicyBase = LiteralKit(["synthetic-only"]);

/**
 * Driver-local 1Password secret reference (`op://vault/item/field`).
 *
 * Extra path segments after the field are allowed (section-qualified
 * references). The reference itself is non-secret data; the driver never
 * embeds resolved secret values anywhere.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawSecretReference } from "@beep/openclaw/OpenclawIntent.models"
 *
 * const reference = OpenclawSecretReference.make("op://beep-p0-spike3/spike3-rotating/password")
 * console.log(reference) // "op://beep-p0-spike3/spike3-rotating/password"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenclawSecretReference = S.String.check(
  S.isPattern(secretReferencePattern, {
    identifier: "OpenclawSecretReference",
    title: "OpenClaw secret reference",
    description: "A 1Password op://vault/item/field secret reference.",
    message: "Expected an op://vault/item/field secret reference",
  })
).pipe(
  S.brand("OpenclawSecretReference"),
  $I.annoteSchema("OpenclawSecretReference", {
    description: "Driver-local op://vault/item/field 1Password secret reference.",
  }),
  SchemaUtils.withCodecStatics(["decodeUnknownOption"])
);

/**
 * Runtime type for {@link OpenclawSecretReference}.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawSecretReference } from "@beep/openclaw/OpenclawIntent.models"
 *
 * const reference: OpenclawSecretReference = OpenclawSecretReference.make("op://vault/item/field")
 * console.log(reference)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenclawSecretReference = typeof OpenclawSecretReference.Type;

/**
 * OpenClaw versions this driver's render adapter targets.
 *
 * The set is intentionally a pinned literal domain: rendering is
 * version-keyed because upstream config schemas break between releases
 * (`agents.list` became `agents.entries` at `2026.7.2-beta.4`).
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawTargetVersion } from "@beep/openclaw/OpenclawIntent.models"
 *
 * console.log(OpenclawTargetVersion.Options) // ["2026.7.1-2"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenclawTargetVersion = OpenclawTargetVersionBase.pipe(
  $I.annoteSchema("OpenclawTargetVersion", {
    description: "Pinned OpenClaw versions supported by the render adapter.",
  }),
  SchemaUtils.withLiteralKitStatics(OpenclawTargetVersionBase)
);

/**
 * Runtime type for {@link OpenclawTargetVersion}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { OpenclawTargetVersion } from "@beep/openclaw/OpenclawIntent.models"
 *
 * const version: OpenclawTargetVersion = "2026.7.1-2"
 * console.log(version)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenclawTargetVersion = typeof OpenclawTargetVersion.Type;

/**
 * Absolute filesystem path used by OpenClaw deployment intents.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawAbsolutePath } from "@beep/openclaw/OpenclawIntent.models"
 *
 * const path = OpenclawAbsolutePath.make("/var/lib/beep/openclaw")
 * console.log(path) // "/var/lib/beep/openclaw"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenclawAbsolutePath = S.String.check(
  S.isPattern(absolutePathPattern, {
    identifier: "OpenclawAbsolutePath",
    title: "OpenClaw absolute path",
    description: "An absolute filesystem path starting with '/'.",
    message: "Expected an absolute path starting with '/'",
  })
).pipe(
  $I.annoteSchema("OpenclawAbsolutePath", {
    description: "Absolute filesystem path starting with '/'.",
  })
);

/**
 * Runtime type for {@link OpenclawAbsolutePath}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { OpenclawAbsolutePath } from "@beep/openclaw/OpenclawIntent.models"
 *
 * const path: OpenclawAbsolutePath = "/var/lib/beep/openclaw"
 * console.log(path)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenclawAbsolutePath = typeof OpenclawAbsolutePath.Type;

/**
 * Unprivileged TCP port for the loopback-bound OpenClaw gateway.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawGatewayPort } from "@beep/openclaw/OpenclawIntent.models"
 *
 * const port = OpenclawGatewayPort.make(19031)
 * console.log(port) // 19031
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenclawGatewayPort = S.Int.check(S.isBetween({ minimum: 1024, maximum: 65535 })).pipe(
  $I.annoteSchema("OpenclawGatewayPort", {
    description: "Unprivileged TCP port in the 1024-65535 range.",
  })
);

/**
 * Runtime type for {@link OpenclawGatewayPort}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { OpenclawGatewayPort } from "@beep/openclaw/OpenclawIntent.models"
 *
 * const port: OpenclawGatewayPort = 19031
 * console.log(port)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenclawGatewayPort = typeof OpenclawGatewayPort.Type;

/**
 * Gateway bind policy — the driver only supports loopback binds.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawGatewayBind } from "@beep/openclaw/OpenclawIntent.models"
 *
 * console.log(OpenclawGatewayBind.Options) // ["loopback"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenclawGatewayBind = OpenclawGatewayBindBase.pipe(
  $I.annoteSchema("OpenclawGatewayBind", {
    description: "Gateway network bind policy supported by managed deployments.",
  }),
  SchemaUtils.withLiteralKitStatics(OpenclawGatewayBindBase)
);

/**
 * Runtime type for {@link OpenclawGatewayBind}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { OpenclawGatewayBind } from "@beep/openclaw/OpenclawIntent.models"
 *
 * const bind: OpenclawGatewayBind = "loopback"
 * console.log(bind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenclawGatewayBind = typeof OpenclawGatewayBind.Type;

/**
 * Desired gateway configuration for an OpenClaw deployment.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawGatewayIntent, OpenclawSecretReference } from "@beep/openclaw/OpenclawIntent.models"
 *
 * const gateway = OpenclawGatewayIntent.make({
 *   authTokenRef: OpenclawSecretReference.make("op://beep-p0-spike3/spike3-rotating/password"),
 *   port: 19031
 * })
 * console.log(gateway.bind) // "loopback"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawGatewayIntent extends S.Class<OpenclawGatewayIntent>($I`OpenclawGatewayIntent`)(
  {
    authTokenRef: OpenclawSecretReference.annotateKey({
      description: "op:// reference resolved at runtime into the gateway auth token.",
    }),
    bind: OpenclawGatewayBind.pipe(SchemaUtils.withKeyDefaults("loopback")).annotateKey({
      description: "Gateway network bind policy; managed deployments stay on loopback.",
    }),
    port: OpenclawGatewayPort.annotateKey({
      description: "Loopback TCP port the gateway listens on.",
    }),
  },
  $I.annote("OpenclawGatewayIntent", {
    description: "Desired OpenClaw gateway configuration with a secret-referenced auth token.",
  })
) {}

/**
 * Legal-workstation confidentiality handling policy.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawConfidentialityPolicy } from "@beep/openclaw"
 *
 * console.log(OpenclawConfidentialityPolicy.Options) // ["advisory"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenclawConfidentialityPolicy = OpenclawConfidentialityPolicyBase.pipe(
  $I.annoteSchema("OpenclawConfidentialityPolicy", {
    description: "Advisory-only confidentiality handling policy.",
  }),
  SchemaUtils.withLiteralKitStatics(OpenclawConfidentialityPolicyBase)
);

/**
 * Runtime type for {@link OpenclawConfidentialityPolicy}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { OpenclawConfidentialityPolicy } from "@beep/openclaw"
 *
 * const policy: OpenclawConfidentialityPolicy = "advisory"
 * console.log(policy)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenclawConfidentialityPolicy = typeof OpenclawConfidentialityPolicy.Type;

/**
 * Client-data handling policy for the legal-workstation persona.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawClientDataPolicy } from "@beep/openclaw"
 *
 * console.log(OpenclawClientDataPolicy.Options) // ["synthetic-only"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenclawClientDataPolicy = OpenclawClientDataPolicyBase.pipe(
  $I.annoteSchema("OpenclawClientDataPolicy", {
    description: "Synthetic-only client-data handling policy.",
  }),
  SchemaUtils.withLiteralKitStatics(OpenclawClientDataPolicyBase)
);

/**
 * Runtime type for {@link OpenclawClientDataPolicy}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { OpenclawClientDataPolicy } from "@beep/openclaw"
 *
 * const policy: OpenclawClientDataPolicy = "synthetic-only"
 * console.log(policy)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenclawClientDataPolicy = typeof OpenclawClientDataPolicy.Type;

/**
 * Declarative persona artifact and its handling policies.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawPersonaIntent } from "@beep/openclaw"
 *
 * const persona = OpenclawPersonaIntent.make({
 *   clientDataPolicy: "synthetic-only",
 *   confidentialityPolicy: "advisory",
 *   soulMarkdown: "Use synthetic examples only."
 * })
 * console.log(persona.confidentialityPolicy) // "advisory"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawPersonaIntent extends S.Class<OpenclawPersonaIntent>($I`OpenclawPersonaIntent`)(
  {
    clientDataPolicy: OpenclawClientDataPolicy,
    confidentialityPolicy: OpenclawConfidentialityPolicy,
    soulMarkdown: S.NonEmptyString,
  },
  $I.annote("OpenclawPersonaIntent", {
    description: "Legal-workstation persona artifact with explicit confidentiality and client-data policies.",
  })
) {}

/**
 * Loopback Control UI configuration.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawControlUiIntent } from "@beep/openclaw"
 *
 * const controlUi = OpenclawControlUiIntent.make({
 *   allowedOrigins: ["http://openclaw.beep.localhost:1355"],
 *   enabled: true
 * })
 * console.log(controlUi.enabled) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawControlUiIntent extends S.Class<OpenclawControlUiIntent>($I`OpenclawControlUiIntent`)(
  {
    allowedOrigins: S.Array(S.NonEmptyString),
    enabled: S.Literal(true),
  },
  $I.annote("OpenclawControlUiIntent", {
    description: "Enabled Control UI with an explicit origin allowlist.",
  })
) {}

/**
 * Desired agent registration for an OpenClaw deployment.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawAgentIntent } from "@beep/openclaw/OpenclawIntent.models"
 *
 * const agent = OpenclawAgentIntent.make({
 *   id: "spike3",
 *   model: "ollama/gemma3:4b",
 *   name: "Spike 3",
 *   workspace: "/var/lib/beep/spike3"
 * })
 * console.log(agent.id) // "spike3"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawAgentIntent extends S.Class<OpenclawAgentIntent>($I`OpenclawAgentIntent`)(
  {
    id: S.NonEmptyString.check(
      S.isPattern(agentIdentifierPattern, {
        identifier: "OpenclawAgentIdentifier",
        title: "OpenClaw agent identifier",
        description: "A lowercase slug identifying the agent.",
        message: "Expected a lowercase slug agent identifier",
      })
    ).annotateKey({
      description: "Stable slug identifying the agent in config and state paths.",
    }),
    model: S.NonEmptyString.annotateKey({
      description: "Primary model reference, e.g. 'ollama/gemma3:4b'.",
    }),
    name: S.NonEmptyString.annotateKey({
      description: "Human-readable agent display name.",
    }),
    workspace: OpenclawAbsolutePath.annotateKey({
      description: "Absolute path of the agent workspace directory.",
    }),
  },
  $I.annote("OpenclawAgentIntent", {
    description: "Desired OpenClaw agent registration.",
  })
) {}

/**
 * Model provider API families supported by the render adapter.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawProviderApi } from "@beep/openclaw/OpenclawIntent.models"
 *
 * console.log(OpenclawProviderApi.Options) // ["ollama", "openai-compat"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenclawProviderApi = OpenclawProviderApiBase.pipe(
  $I.annoteSchema("OpenclawProviderApi", {
    description: "Model provider API family used by an OpenClaw model provider.",
  }),
  SchemaUtils.withLiteralKitStatics(OpenclawProviderApiBase)
);

/**
 * Runtime type for {@link OpenclawProviderApi}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { OpenclawProviderApi } from "@beep/openclaw/OpenclawIntent.models"
 *
 * const api: OpenclawProviderApi = "ollama"
 * console.log(api)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenclawProviderApi = typeof OpenclawProviderApi.Type;

/**
 * Input modality a declared model accepts.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawModelInputKind } from "@beep/openclaw/OpenclawIntent.models"
 *
 * console.log(OpenclawModelInputKind.Options) // ["text", "image"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenclawModelInputKind = OpenclawModelInputKindBase.pipe(
  $I.annoteSchema("OpenclawModelInputKind", {
    description: "Input modality accepted by a declared model.",
  }),
  SchemaUtils.withLiteralKitStatics(OpenclawModelInputKindBase)
);

/**
 * Runtime type for {@link OpenclawModelInputKind}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { OpenclawModelInputKind } from "@beep/openclaw/OpenclawIntent.models"
 *
 * const input: OpenclawModelInputKind = "text"
 * console.log(input)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenclawModelInputKind = typeof OpenclawModelInputKind.Type;

/**
 * Provider API key sourced from a 1Password secret reference.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawProviderApiKeySecretRef, OpenclawSecretReference } from "@beep/openclaw/OpenclawIntent.models"
 *
 * const apiKey = OpenclawProviderApiKeySecretRef.make({
 *   _tag: "SecretRef",
 *   ref: OpenclawSecretReference.make("op://vault/provider/api-key")
 * })
 * console.log(apiKey._tag) // "SecretRef"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawProviderApiKeySecretRef extends S.Class<OpenclawProviderApiKeySecretRef>(
  $I`OpenclawProviderApiKeySecretRef`
)(
  {
    _tag: S.tag("SecretRef").annotateKey({
      description: "Discriminator for secret-referenced provider API keys.",
    }),
    ref: OpenclawSecretReference.annotateKey({
      description: "op:// reference resolved at runtime into the provider API key.",
    }),
  },
  $I.annote("OpenclawProviderApiKeySecretRef", {
    description: "Provider API key resolved from a 1Password secret reference.",
  })
) {}

/**
 * Non-secret provider API key sentinel (e.g. `ollama-local`).
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawProviderApiKeyPlaceholder } from "@beep/openclaw/OpenclawIntent.models"
 *
 * const apiKey = OpenclawProviderApiKeyPlaceholder.make({ _tag: "Placeholder", value: "ollama-local" })
 * console.log(apiKey.value) // "ollama-local"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawProviderApiKeyPlaceholder extends S.Class<OpenclawProviderApiKeyPlaceholder>(
  $I`OpenclawProviderApiKeyPlaceholder`
)(
  {
    _tag: S.tag("Placeholder").annotateKey({
      description: "Discriminator for non-secret placeholder API keys.",
    }),
    value: S.NonEmptyString.annotateKey({
      description: "Non-secret sentinel value accepted by the provider, e.g. 'ollama-local'.",
    }),
  },
  $I.annote("OpenclawProviderApiKeyPlaceholder", {
    description: "Non-secret sentinel provider API key.",
  })
) {}

/**
 * Provider API key source: a secret reference or a non-secret sentinel.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawProviderApiKey, OpenclawProviderApiKeyPlaceholder } from "@beep/openclaw/OpenclawIntent.models"
 * import * as S from "effect/Schema"
 *
 * const apiKey = OpenclawProviderApiKeyPlaceholder.make({ _tag: "Placeholder", value: "ollama-local" })
 * console.log(S.is(OpenclawProviderApiKey)(apiKey)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenclawProviderApiKey = S.Union([
  OpenclawProviderApiKeySecretRef,
  OpenclawProviderApiKeyPlaceholder,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("OpenclawProviderApiKey", {
    description: "Tagged union of provider API key sources.",
  })
);

/**
 * Runtime type for {@link OpenclawProviderApiKey}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { OpenclawProviderApiKey } from "@beep/openclaw/OpenclawIntent.models"
 * import { OpenclawProviderApiKeyPlaceholder } from "@beep/openclaw/OpenclawIntent.models"
 *
 * const apiKey: OpenclawProviderApiKey = OpenclawProviderApiKeyPlaceholder.make({
 *   _tag: "Placeholder",
 *   value: "ollama-local"
 * })
 * console.log(apiKey._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenclawProviderApiKey = typeof OpenclawProviderApiKey.Type;

/**
 * Optional provider tuning parameters.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawModelProviderParams } from "@beep/openclaw/OpenclawIntent.models"
 * import * as O from "effect/Option"
 *
 * const params = OpenclawModelProviderParams.make({ numCtx: O.some(32768) })
 * console.log(O.getOrThrow(params.numCtx)) // 32768
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawModelProviderParams extends S.Class<OpenclawModelProviderParams>($I`OpenclawModelProviderParams`)(
  {
    numCtx: S.OptionFromOptionalKey(S.Int).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Context window override (rendered as params.num_ctx), when declared.",
    }),
  },
  $I.annote("OpenclawModelProviderParams", {
    description: "Optional model provider tuning parameters.",
  })
) {}

/**
 * A model declared under a provider.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawModelDeclaration } from "@beep/openclaw/OpenclawIntent.models"
 *
 * const model = OpenclawModelDeclaration.make({ id: "gemma3:4b", input: ["text"], name: "gemma3:4b" })
 * console.log(model.id) // "gemma3:4b"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawModelDeclaration extends S.Class<OpenclawModelDeclaration>($I`OpenclawModelDeclaration`)(
  {
    id: S.NonEmptyString.annotateKey({
      description: "Provider-scoped model identifier.",
    }),
    input: S.Array(OpenclawModelInputKind).annotateKey({
      description: "Input modalities the model accepts.",
    }),
    name: S.NonEmptyString.annotateKey({
      description: "Human-readable model display name.",
    }),
  },
  $I.annote("OpenclawModelDeclaration", {
    description: "Model declared under an OpenClaw model provider.",
  })
) {}

/**
 * Desired model provider entry for an OpenClaw deployment.
 *
 * **Example** (Usage)
 * ```ts
 * import {
 *   OpenclawModelDeclaration,
 *   OpenclawModelProviderIntent,
 *   OpenclawProviderApiKeyPlaceholder
 * } from "@beep/openclaw/OpenclawIntent.models"
 * import * as O from "effect/Option"
 *
 * const provider = OpenclawModelProviderIntent.make({
 *   api: "ollama",
 *   apiKey: OpenclawProviderApiKeyPlaceholder.make({ _tag: "Placeholder", value: "ollama-local" }),
 *   baseUrl: "http://127.0.0.1:11434",
 *   contextTokens: O.some(32768),
 *   id: "ollama",
 *   models: [OpenclawModelDeclaration.make({ id: "gemma3:4b", input: ["text"], name: "gemma3:4b" })]
 * })
 * console.log(provider.id) // "ollama"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawModelProviderIntent extends S.Class<OpenclawModelProviderIntent>($I`OpenclawModelProviderIntent`)(
  S.Struct({
    api: OpenclawProviderApi.annotateKey({
      description: "Provider API family used to reach the model endpoint.",
    }),
    apiKey: OpenclawProviderApiKey.annotateKey({
      description: "API key source; either a secret reference or a non-secret sentinel.",
    }),
    baseUrl: S.NonEmptyString.check(
      S.isPattern(httpUrlPattern, {
        identifier: "OpenclawProviderBaseUrl",
        title: "OpenClaw provider base URL",
        description: "An http(s) base URL for the provider endpoint.",
        message: "Expected an http(s) URL",
      })
    ).annotateKey({
      description: "http(s) base URL of the provider endpoint.",
    }),
    contextTokens: S.OptionFromOptionalKey(S.Int).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Declared provider context token budget, when known.",
    }),
    id: S.NonEmptyString.annotateKey({
      description: "Provider identifier used as the models.providers key.",
    }),
    models: S.Array(OpenclawModelDeclaration).annotateKey({
      description: "Models declared under this provider.",
    }),
    params: S.OptionFromOptionalKey(OpenclawModelProviderParams).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Optional tuning parameters forwarded to the provider.",
    }),
  }).check(
    S.makeFilter((provider) => provider.apiKey._tag !== "SecretRef" || Str.startsWith("https://")(provider.baseUrl), {
      identifier: "OpenclawSecretProviderHttpsInvariant",
      title: "OpenClaw secret-backed provider transport",
      description: "Requires secret-backed model providers to use HTTPS.",
      message: "Expected an HTTPS base URL for a secret-backed provider",
    })
  ),
  $I.annote("OpenclawModelProviderIntent", {
    description: "Desired OpenClaw model provider configuration.",
  })
) {}

/**
 * Auth profile mode recorded in non-secret `auth.profiles` metadata.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawAuthProfileMode } from "@beep/openclaw/OpenclawIntent.models"
 *
 * console.log(OpenclawAuthProfileMode.Options) // ["api_key", "oauth"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenclawAuthProfileMode = OpenclawAuthProfileModeBase.pipe(
  $I.annoteSchema("OpenclawAuthProfileMode", {
    description: "Authentication mode recorded for an auth profile.",
  }),
  SchemaUtils.withLiteralKitStatics(OpenclawAuthProfileModeBase)
);

/**
 * Runtime type for {@link OpenclawAuthProfileMode}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { OpenclawAuthProfileMode } from "@beep/openclaw/OpenclawIntent.models"
 *
 * const mode: OpenclawAuthProfileMode = "api_key"
 * console.log(mode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenclawAuthProfileMode = typeof OpenclawAuthProfileMode.Type;

/**
 * Non-secret auth profile metadata rendered into `auth.profiles`.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawAuthProfileIntent } from "@beep/openclaw/OpenclawIntent.models"
 *
 * const profile = OpenclawAuthProfileIntent.make({
 *   mode: "api_key",
 *   profileId: "ollama:manual",
 *   provider: "ollama"
 * })
 * console.log(profile.profileId) // "ollama:manual"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawAuthProfileIntent extends S.Class<OpenclawAuthProfileIntent>($I`OpenclawAuthProfileIntent`)(
  {
    mode: OpenclawAuthProfileMode.annotateKey({
      description: "Authentication mode for the profile.",
    }),
    profileId: S.NonEmptyString.annotateKey({
      description: "Profile identifier used as the auth.profiles key.",
    }),
    provider: S.NonEmptyString.annotateKey({
      description: "Provider the profile authenticates against.",
    }),
  },
  $I.annote("OpenclawAuthProfileIntent", {
    description: "Non-secret auth.profiles metadata entry.",
  })
) {}

/**
 * Telegram direct-message policy.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawTelegramDmPolicy } from "@beep/openclaw/OpenclawIntent.models"
 *
 * console.log(OpenclawTelegramDmPolicy.Options) // ["pairing", "disabled", "open"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenclawTelegramDmPolicy = OpenclawTelegramDmPolicyBase.pipe(
  $I.annoteSchema("OpenclawTelegramDmPolicy", {
    description: "Telegram direct-message policy.",
  }),
  SchemaUtils.withLiteralKitStatics(OpenclawTelegramDmPolicyBase)
);

/**
 * Runtime type for {@link OpenclawTelegramDmPolicy}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { OpenclawTelegramDmPolicy } from "@beep/openclaw/OpenclawIntent.models"
 *
 * const policy: OpenclawTelegramDmPolicy = "pairing"
 * console.log(policy)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenclawTelegramDmPolicy = typeof OpenclawTelegramDmPolicy.Type;

/**
 * Telegram group policy.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawTelegramGroupPolicy } from "@beep/openclaw/OpenclawIntent.models"
 *
 * console.log(OpenclawTelegramGroupPolicy.Options) // ["open", "disabled"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenclawTelegramGroupPolicy = OpenclawTelegramGroupPolicyBase.pipe(
  $I.annoteSchema("OpenclawTelegramGroupPolicy", {
    description: "Telegram group participation policy.",
  }),
  SchemaUtils.withLiteralKitStatics(OpenclawTelegramGroupPolicyBase)
);

/**
 * Runtime type for {@link OpenclawTelegramGroupPolicy}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { OpenclawTelegramGroupPolicy } from "@beep/openclaw/OpenclawIntent.models"
 *
 * const policy: OpenclawTelegramGroupPolicy = "open"
 * console.log(policy)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenclawTelegramGroupPolicy = typeof OpenclawTelegramGroupPolicy.Type;

/**
 * Per-group Telegram channel behavior.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawTelegramGroupIntent } from "@beep/openclaw/OpenclawIntent.models"
 * import * as O from "effect/Option"
 *
 * const group = OpenclawTelegramGroupIntent.make({ groupPolicy: O.some("open"), requireMention: false })
 * console.log(group.requireMention) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawTelegramGroupIntent extends S.Class<OpenclawTelegramGroupIntent>($I`OpenclawTelegramGroupIntent`)(
  {
    groupPolicy: S.OptionFromOptionalKey(OpenclawTelegramGroupPolicy).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Per-group policy override, when declared.",
    }),
    requireMention: S.Boolean.annotateKey({
      description: "Whether the bot only reacts to messages that mention it.",
    }),
  },
  $I.annote("OpenclawTelegramGroupIntent", {
    description: "Per-group Telegram channel behavior.",
  })
) {}

/**
 * Desired Telegram channel configuration.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawSecretReference, OpenclawTelegramIntent } from "@beep/openclaw/OpenclawIntent.models"
 *
 * const telegram = OpenclawTelegramIntent.make({
 *   botTokenRef: OpenclawSecretReference.make("op://vault/telegram-bot/token"),
 *   dmPolicy: "pairing",
 *   groupPolicy: "open"
 * })
 * console.log(telegram.dmPolicy) // "pairing"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawTelegramIntent extends S.Class<OpenclawTelegramIntent>($I`OpenclawTelegramIntent`)(
  {
    botTokenRef: OpenclawSecretReference.annotateKey({
      description: "op:// reference resolved at runtime into the Telegram bot token.",
    }),
    defaultTo: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Default send target (e.g. a group username), when declared.",
    }),
    dmPolicy: OpenclawTelegramDmPolicy.annotateKey({
      description: "Direct-message policy for the Telegram channel.",
    }),
    groupPolicy: OpenclawTelegramGroupPolicy.annotateKey({
      description: "Default group participation policy.",
    }),
    groups: S.Record(S.String, OpenclawTelegramGroupIntent).pipe(SchemaUtils.withKeyDefaults(R.empty())).annotateKey({
      description: "Per-group behavior keyed by Telegram group id.",
    }),
  },
  $I.annote("OpenclawTelegramIntent", {
    description: "Desired Telegram channel configuration with a secret-referenced bot token.",
  })
) {}

/**
 * Exec-provider secret resolver wiring for op:// references.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawSecretsResolverIntent } from "@beep/openclaw/OpenclawIntent.models"
 *
 * const resolver = OpenclawSecretsResolverIntent.make({
 *   commandPath: "/opt/beep/openclaw/op-resolver.sh",
 *   opBinaryPath: "/usr/bin/op",
 *   trustedDir: "/opt/beep/openclaw"
 * })
 * console.log(resolver.passEnv) // ["OP_SERVICE_ACCOUNT_TOKEN", "PATH"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawSecretsResolverIntent extends S.Class<OpenclawSecretsResolverIntent>(
  $I`OpenclawSecretsResolverIntent`
)(
  {
    commandPath: OpenclawAbsolutePath.annotateKey({
      description: "Absolute path of the exec-provider resolver command.",
    }),
    opBinaryPath: OpenclawAbsolutePath.annotateKey({
      description: "Absolute path of the pinned 1Password CLI binary.",
    }),
    passEnv: S.Array(S.NonEmptyString)
      .pipe(SchemaUtils.withKeyDefaults(["OP_SERVICE_ACCOUNT_TOKEN", "PATH"]))
      .annotateKey({
        description: "Environment variable names forwarded to the resolver process.",
      }),
    trustedDir: OpenclawAbsolutePath.annotateKey({
      description: "Directory OpenClaw trusts to contain the resolver command.",
    }),
  },
  $I.annote("OpenclawSecretsResolverIntent", {
    description: "Exec-provider secret resolver wiring for op:// references.",
  })
) {}

/**
 * Guardrails applied to every rendered deployment.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawGuardrailsIntent } from "@beep/openclaw/OpenclawIntent.models"
 *
 * const guardrails = OpenclawGuardrailsIntent.make({})
 * console.log(guardrails.toolsDeny) // ["*"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawGuardrailsIntent extends S.Class<OpenclawGuardrailsIntent>($I`OpenclawGuardrailsIntent`)(
  {
    toolsDeny: S.Array(S.String)
      .pipe(SchemaUtils.withKeyDefaults(["*"]))
      .annotateKey({
        description: "Tool deny-list rendered into tools.deny; defaults to deny-all.",
      }),
  },
  $I.annote("OpenclawGuardrailsIntent", {
    description: "Deployment guardrails; tools are denied by default.",
  })
) {}

/**
 * Pinned skill artifact consumed by the generation engine.
 *
 * Skills are workspace mutations, not config keys — the render adapter never
 * emits them into `openclaw.json`.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawSkillPin } from "@beep/openclaw/OpenclawIntent.models"
 *
 * const skill = OpenclawSkillPin.make({
 *   integrity: "sha256-3v0kQXMhFdkAYWWLIvhbEP2Rgz0kmxLp9octq6vHYNM=",
 *   name: "docket-summarizer",
 *   source: "https://example.com/skills/docket-summarizer.tar.gz",
 *   version: "1.2.0"
 * })
 * console.log(skill.name) // "docket-summarizer"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawSkillPin extends S.Class<OpenclawSkillPin>($I`OpenclawSkillPin`)(
  {
    integrity: S.NonEmptyString.annotateKey({
      description: "Content integrity pin (sha256 hex or SRI) for the skill artifact.",
    }),
    name: S.NonEmptyString.annotateKey({
      description: "Skill name as installed into the workspace.",
    }),
    source: S.NonEmptyString.annotateKey({
      description: "Skill artifact source URL or filesystem path.",
    }),
    version: S.NonEmptyString.annotateKey({
      description: "Pinned skill version.",
    }),
  },
  $I.annote("OpenclawSkillPin", {
    description: "Pinned skill artifact reference for workspace provisioning.",
  })
) {}

/**
 * Desired gateway log file location.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawLoggingIntent } from "@beep/openclaw/OpenclawIntent.models"
 *
 * const logging = OpenclawLoggingIntent.make({ filePath: "/var/lib/beep/openclaw/log/openclaw.log" })
 * console.log(logging.filePath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawLoggingIntent extends S.Class<OpenclawLoggingIntent>($I`OpenclawLoggingIntent`)(
  {
    filePath: OpenclawAbsolutePath.annotateKey({
      description: "Absolute path of the gateway log file.",
    }),
  },
  $I.annote("OpenclawLoggingIntent", {
    description: "Desired gateway log file location.",
  })
) {}

/**
 * Root desired-intent document for one OpenClaw deployment.
 *
 * The render adapter (versioned on `openclawVersion`) turns this intent into
 * the canonical `openclaw.json` for the pinned binary. Secret material only
 * ever appears as op:// references.
 *
 * **Example** (Usage)
 * ```ts
 * import {
 *   OpenclawAgentIntent,
 *   OpenclawControlUiIntent,
 *   OpenclawDeploymentIntent,
 *   OpenclawGatewayIntent,
 *   OpenclawLoggingIntent,
 *   OpenclawPersonaIntent,
 *   OpenclawSecretReference,
 *   OpenclawSecretsResolverIntent
 * } from "@beep/openclaw/OpenclawIntent.models"
 *
 * const intent = OpenclawDeploymentIntent.make({
 *   agent: OpenclawAgentIntent.make({
 *     id: "spike3",
 *     model: "ollama/gemma3:4b",
 *     name: "Spike 3",
 *     workspace: "/var/lib/beep/spike3"
 *   }),
 *   controlUi: OpenclawControlUiIntent.make({
 *     allowedOrigins: ["http://127.0.0.1:19031"],
 *     enabled: true
 *   }),
 *   gateway: OpenclawGatewayIntent.make({
 *     authTokenRef: OpenclawSecretReference.make("op://beep-p0-spike3/spike3-rotating/password"),
 *     port: 19031
 *   }),
 *   logging: OpenclawLoggingIntent.make({ filePath: "/var/lib/beep/spike3/log/openclaw.log" }),
 *   openclawVersion: "2026.7.1-2",
 *   persona: OpenclawPersonaIntent.make({
 *     clientDataPolicy: "synthetic-only",
 *     confidentialityPolicy: "advisory",
 *     soulMarkdown: "Use synthetic examples only."
 *   }),
 *   providers: [],
 *   secretsResolver: OpenclawSecretsResolverIntent.make({
 *     commandPath: "/opt/beep/openclaw/op-resolver.sh",
 *     opBinaryPath: "/usr/bin/op",
 *     trustedDir: "/opt/beep/openclaw"
 *   })
 * })
 * console.log(intent.guardrails.toolsDeny) // ["*"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawDeploymentIntent extends S.Class<OpenclawDeploymentIntent>($I`OpenclawDeploymentIntent`)(
  {
    agent: OpenclawAgentIntent.annotateKey({
      description: "Agent registered with the deployment.",
    }),
    authProfiles: S.Array(OpenclawAuthProfileIntent).pipe(SchemaUtils.withKeyDefaults([])).annotateKey({
      description: "Non-secret auth.profiles metadata entries.",
    }),
    controlUi: OpenclawControlUiIntent.annotateKey({
      description: "Loopback Control UI configuration.",
    }),
    gateway: OpenclawGatewayIntent.annotateKey({
      description: "Gateway listener and auth-token configuration.",
    }),
    guardrails: OpenclawGuardrailsIntent.pipe(
      SchemaUtils.withKeyDefaults(OpenclawGuardrailsIntent.make({}))
    ).annotateKey({
      description: "Deployment guardrails; defaults to deny-all tools.",
    }),
    logging: OpenclawLoggingIntent.annotateKey({
      description: "Gateway log file location.",
    }),
    openclawVersion: OpenclawTargetVersion.annotateKey({
      description: "Pinned OpenClaw version the render adapter targets.",
    }),
    persona: OpenclawPersonaIntent.annotateKey({
      description: "Legal-workstation persona and handling policies.",
    }),
    providers: S.Array(OpenclawModelProviderIntent).annotateKey({
      description: "Model providers rendered into models.providers.",
    }),
    secretsResolver: OpenclawSecretsResolverIntent.annotateKey({
      description: "Exec-provider secret resolver wiring for op:// references.",
    }),
    skills: S.Array(OpenclawSkillPin).pipe(SchemaUtils.withKeyDefaults([])).annotateKey({
      description: "Pinned skill artifacts consumed by the generation engine, never by the render adapter.",
    }),
    telegram: S.OptionFromOptionalKey(OpenclawTelegramIntent).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Telegram channel configuration, when the deployment enables it.",
    }),
  },
  $I.annote("OpenclawDeploymentIntent", {
    description: "Root desired-intent document for one OpenClaw deployment.",
  })
) {}
