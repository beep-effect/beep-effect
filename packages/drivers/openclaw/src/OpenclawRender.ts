/**
 * Versioned render adapter for OpenClaw deployment intents.
 *
 * Renders an {@link OpenclawDeploymentIntent} into the canonical
 * `openclaw.json` document accepted by the pinned OpenClaw binary. Rendering
 * is version-keyed because upstream config schemas break between releases
 * (`agents.list` became `agents.entries` at `2026.7.2-beta.4`); adding a
 * supported version later is a new dispatch branch, never a consumer change.
 * Canonical output is `jq -S`-equivalent strict JSON (recursively sorted
 * keys, two-space indent, trailing newline) so equal intents always render to
 * byte-identical documents with stable content hashes. Secret material only
 * ever appears as op:// references inside `secrets.providers.*.args`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { createHash } from "node:crypto";
import { $OpenclawId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { O } from "@beep/utils";
import { flow, Match, Order, pipe, Result } from "effect";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { OpenclawSchemaPlaceholderFinding } from "./Openclaw.models.ts";
import { OpenclawTargetVersion } from "./OpenclawIntent.models.ts";
import type { OpenclawSchemaPlaceholderReason } from "./Openclaw.models.ts";
import type {
  OpenclawDeploymentIntent,
  OpenclawModelProviderIntent,
  OpenclawSecretReference,
  OpenclawSecretsResolverIntent,
  OpenclawTelegramIntent,
} from "./OpenclawIntent.models.ts";

const $I = $OpenclawId.create("OpenclawRender");
const sha256HexPattern = /^[0-9a-f]{64}$/u;
const indentUnit = "  ";
const gatewaySecretsProviderName = "op_gateway";
const telegramSecretsProviderName = "op_telegram";
const modelProviderSecretsName = (providerId: string): string => `op_provider_${providerId}`;
const encodeCompactJson = S.encodeResult(S.UnknownFromJsonString);
const encodeJsonLeaf: (value: unknown) => string = flow(encodeCompactJson, Result.getOrThrow);
const jsonEntryOrder = Order.mapInput(Order.String, ([key]: readonly [string, unknown]) => key);

const encodeCanonicalValue = (value: unknown, indent: string): string => {
  const nested = `${indent}${indentUnit}`;
  if (A.isArray(value)) {
    return A.match(value, {
      onEmpty: () => "[]",
      onNonEmpty: (items) =>
        `[\n${A.join(
          A.map(items, (item) => `${nested}${encodeCanonicalValue(item, nested)}`),
          ",\n"
        )}\n${indent}]`,
    });
  }
  if (P.isObject(value)) {
    return A.match(A.sort(R.toEntries(value), jsonEntryOrder), {
      onEmpty: () => "{}",
      onNonEmpty: (entries) =>
        `{\n${A.join(
          A.map(entries, ([key, entry]) => `${nested}${encodeJsonLeaf(key)}: ${encodeCanonicalValue(entry, nested)}`),
          ",\n"
        )}\n${indent}}`,
    });
  }
  return encodeJsonLeaf(value);
};

const canonicalizeDocument = (document: unknown): string => `${encodeCanonicalValue(document, "")}\n`;

const secretRefDocument = (providerName: string) => ({
  id: "value",
  provider: providerName,
  source: "exec",
});

const execSecretsProviderDocument = (resolver: OpenclawSecretsResolverIntent, reference: OpenclawSecretReference) => ({
  args: [resolver.opBinaryPath, reference],
  command: resolver.commandPath,
  jsonOnly: false,
  passEnv: resolver.passEnv,
  source: "exec",
  trustedDirs: [resolver.trustedDir],
});

const modelProviderSecretReference = (provider: OpenclawModelProviderIntent): O.Option<OpenclawSecretReference> =>
  pipe(
    Match.value(provider.apiKey),
    Match.tagsExhaustive({
      Placeholder: O.none<OpenclawSecretReference>,
      SecretRef: (secretRef) => O.some(secretRef.ref),
    })
  );

const modelProviderApiKeyDocument = (provider: OpenclawModelProviderIntent): unknown =>
  pipe(
    Match.value(provider.apiKey),
    Match.tagsExhaustive({
      Placeholder: (placeholder): unknown => placeholder.value,
      SecretRef: () => secretRefDocument(modelProviderSecretsName(provider.id)),
    })
  );

const modelProviderDocument = (provider: OpenclawModelProviderIntent) => ({
  api: provider.api,
  apiKey: modelProviderApiKeyDocument(provider),
  baseUrl: provider.baseUrl,
  models: A.map(provider.models, (model) => ({ id: model.id, input: model.input, name: model.name })),
  ...O.getSomesStruct({
    contextTokens: provider.contextTokens,
    params: O.map(
      O.flatMap(provider.params, (params) => params.numCtx),
      (numCtx) => ({ num_ctx: numCtx })
    ),
  }),
});

const telegramChannelDocument = (telegram: OpenclawTelegramIntent) => ({
  botToken: secretRefDocument(telegramSecretsProviderName),
  configWrites: false,
  dmPolicy: telegram.dmPolicy,
  enabled: true,
  groupPolicy: telegram.groupPolicy,
  groups: R.map(telegram.groups, (group) => ({
    requireMention: group.requireMention,
    ...O.getSomesStruct({ groupPolicy: group.groupPolicy }),
  })),
  ...O.getSomesStruct({ defaultTo: telegram.defaultTo }),
});

const secretsProvidersDocument = (intent: OpenclawDeploymentIntent) => ({
  [gatewaySecretsProviderName]: execSecretsProviderDocument(intent.secretsResolver, intent.gateway.authTokenRef),
  ...R.fromEntries(
    A.getSomes(
      A.map(intent.providers, (provider) =>
        O.map(
          modelProviderSecretReference(provider),
          (reference) =>
            [
              modelProviderSecretsName(provider.id),
              execSecretsProviderDocument(intent.secretsResolver, reference),
            ] as const
        )
      )
    )
  ),
  ...O.getSomesStruct({
    [telegramSecretsProviderName]: O.map(intent.telegram, (telegram) =>
      execSecretsProviderDocument(intent.secretsResolver, telegram.botTokenRef)
    ),
  }),
});

const renderDocument2026_7_1_2 = (intent: OpenclawDeploymentIntent): Record<string, unknown> => ({
  agents: {
    list: [
      {
        id: intent.agent.id,
        model: { primary: intent.agent.model },
        name: intent.agent.name,
        workspace: intent.agent.workspace,
      },
    ],
  },
  gateway: {
    auth: { mode: "token", token: secretRefDocument(gatewaySecretsProviderName) },
    bind: intent.gateway.bind,
    mode: "local",
    port: intent.gateway.port,
    reload: { mode: "off" },
  },
  logging: { file: intent.logging.filePath },
  secrets: { providers: secretsProvidersDocument(intent) },
  tools: { deny: intent.guardrails.toolsDeny },
  ...O.getSomesStruct({
    auth: O.map(pipe(intent.authProfiles, O.liftPredicate(A.isReadonlyArrayNonEmpty)), (profiles) => ({
      profiles: R.fromEntries(
        A.map(profiles, (profile) => [profile.profileId, { mode: profile.mode, provider: profile.provider }] as const)
      ),
    })),
    channels: O.map(intent.telegram, (telegram) => ({ telegram: telegramChannelDocument(telegram) })),
    models: O.map(pipe(intent.providers, O.liftPredicate(A.isReadonlyArrayNonEmpty)), (providers) => ({
      providers: R.fromEntries(A.map(providers, (provider) => [provider.id, modelProviderDocument(provider)] as const)),
    })),
  }),
});

const versionedDocumentRenderer = Match.type<OpenclawTargetVersion>().pipe(
  Match.when("2026.7.1-2", () => renderDocument2026_7_1_2),
  Match.exhaustive
);

const schemaNodeChild = (record: { readonly [key: string]: unknown }, key: string): O.Option<unknown> =>
  pipe(
    R.get(record, "properties"),
    O.filter(P.isObject),
    O.flatMap(R.get(key)),
    O.orElse(() => R.get(record, "additionalProperties"))
  );

const resolveSchemaNode = (node: unknown, segments: ReadonlyArray<string>): O.Option<unknown> =>
  node === true
    ? O.some(node)
    : A.match(segments, {
        onEmpty: () => O.some(node),
        onNonEmpty: (path) =>
          O.flatMap(pipe(node, O.liftPredicate(P.isObject)), (record) =>
            O.flatMap(schemaNodeChild(record, A.headNonEmpty(path)), (child) =>
              resolveSchemaNode(child, A.tailNonEmpty(path))
            )
          ),
      });

const hasOpenAdditionalProperties = (record: { readonly [key: string]: unknown }): boolean =>
  O.exists(R.get(record, "additionalProperties"), (value) => value === true);

const hasDeclaredProperties = (record: { readonly [key: string]: unknown }): boolean =>
  O.exists(pipe(R.get(record, "properties"), O.filter(P.isObject)), (properties) => !R.isEmptyRecord(properties));

const placeholderSchemaNode = (record: { readonly [key: string]: unknown }): boolean =>
  hasOpenAdditionalProperties(record) && !hasDeclaredProperties(record);

const schemaNodeReason: (node: unknown) => O.Option<OpenclawSchemaPlaceholderReason> = Match.type<unknown>().pipe(
  Match.when(true, () => O.some<OpenclawSchemaPlaceholderReason>("placeholder")),
  Match.when(P.isObject, (record) =>
    O.map(pipe(record, O.liftPredicate(placeholderSchemaNode)), (): OpenclawSchemaPlaceholderReason => "placeholder")
  ),
  Match.orElse(() => O.some<OpenclawSchemaPlaceholderReason>("missing"))
);

const surfaceReason = (schemaExport: unknown, surface: string): O.Option<OpenclawSchemaPlaceholderReason> =>
  O.match(resolveSchemaNode(schemaExport, Str.split(surface, ".")), {
    onNone: () => O.some<OpenclawSchemaPlaceholderReason>("missing"),
    onSome: schemaNodeReason,
  });

/**
 * Lowercase 64-character hexadecimal SHA-256 digest.
 *
 * Identifies rendered config content: the digest of the canonical JSON bytes
 * is the generation directory name used by content-addressed deployments.
 *
 * @example
 * ```ts
 * import { OpenclawSha256Hex } from "@beep/openclaw/OpenclawRender"
 *
 * const hash = OpenclawSha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * console.log(hash.length) // 64
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenclawSha256Hex = S.String.check(
  S.isPattern(sha256HexPattern, {
    identifier: "OpenclawSha256Hex",
    title: "OpenClaw SHA-256 hex digest",
    description: "A lowercase 64-character hexadecimal SHA-256 digest.",
    message: "Expected a lowercase 64-character hex SHA-256 digest",
  })
).pipe(
  S.brand("OpenclawSha256Hex"),
  $I.annoteSchema("OpenclawSha256Hex", {
    description: "Lowercase 64-character hexadecimal SHA-256 digest of canonical config bytes.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link OpenclawSha256Hex}.
 *
 * @example
 * ```ts
 * import { OpenclawSha256Hex } from "@beep/openclaw/OpenclawRender"
 *
 * const hash: OpenclawSha256Hex = OpenclawSha256Hex.make(
 *   "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * )
 * console.log(hash)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenclawSha256Hex = typeof OpenclawSha256Hex.Type;

/**
 * A rendered canonical `openclaw.json` document for one pinned version.
 *
 * `canonicalJson` is byte-stable `jq -S`-equivalent JSON (recursively sorted
 * keys, two-space indent, trailing newline) and `contentHash` is the SHA-256
 * of its UTF-8 bytes.
 *
 * @example
 * ```ts
 * import { OpenclawSha256Hex, RenderedOpenclawConfig } from "@beep/openclaw/OpenclawRender"
 *
 * const rendered = RenderedOpenclawConfig.make({
 *   canonicalJson: "{}\n",
 *   contentHash: OpenclawSha256Hex.make("34dbd0518b2c1b9d64a0132a29c5921ab869d7ac67d33756d171ca27fbd0d1ec"),
 *   targetVersion: "2026.7.1-2"
 * })
 * console.log(rendered.targetVersion) // "2026.7.1-2"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RenderedOpenclawConfig extends S.Class<RenderedOpenclawConfig>($I`RenderedOpenclawConfig`)(
  {
    canonicalJson: S.String.annotateKey({
      description: "Canonical jq -S-equivalent JSON document with a trailing newline.",
    }),
    contentHash: OpenclawSha256Hex.annotateKey({
      description: "SHA-256 hex digest of the canonical JSON UTF-8 bytes.",
    }),
    targetVersion: OpenclawTargetVersion.annotateKey({
      description: "Pinned OpenClaw version the document was rendered for.",
    }),
  },
  $I.annote("RenderedOpenclawConfig", {
    description: "Canonical rendered openclaw.json document with its content hash.",
  })
) {}

/**
 * Render a deployment intent into the canonical `openclaw.json` document.
 *
 * Total and pure: dispatch is keyed on `intent.openclawVersion` over the
 * pinned version domain, so every valid intent renders without failure.
 * Adapter invariants for `2026.7.1-2`: `gateway.mode` is `"local"`,
 * `gateway.reload.mode` is `"off"`, Telegram renders with `enabled: true` and
 * `configWrites: false`, `agents.list` is the emitted agent shape, and no
 * `meta` key is ever emitted. Secrets render exclusively as exec secret
 * references; op:// references appear only inside `secrets.providers.*.args`.
 *
 * @example
 * ```ts
 * import {
 *   OpenclawAgentIntent,
 *   OpenclawDeploymentIntent,
 *   OpenclawGatewayIntent,
 *   OpenclawLoggingIntent,
 *   OpenclawSecretReference,
 *   OpenclawSecretsResolverIntent
 * } from "@beep/openclaw/OpenclawIntent.models"
 * import { renderOpenclawConfig } from "@beep/openclaw/OpenclawRender"
 *
 * const rendered = renderOpenclawConfig(
 *   OpenclawDeploymentIntent.make({
 *     agent: OpenclawAgentIntent.make({
 *       id: "spike3",
 *       model: "ollama/gemma3:4b",
 *       name: "Spike 3",
 *       workspace: "/var/lib/beep/spike3"
 *     }),
 *     gateway: OpenclawGatewayIntent.make({
 *       authTokenRef: OpenclawSecretReference.make("op://beep-p0-spike3/spike3-rotating/password"),
 *       port: 19031
 *     }),
 *     logging: OpenclawLoggingIntent.make({ filePath: "/var/lib/beep/spike3/log/openclaw.log" }),
 *     openclawVersion: "2026.7.1-2",
 *     providers: [],
 *     secretsResolver: OpenclawSecretsResolverIntent.make({
 *       commandPath: "/opt/beep/openclaw/op-resolver.sh",
 *       opBinaryPath: "/opt/beep/openclaw/bin/op",
 *       trustedDir: "/opt/beep/openclaw"
 *     })
 *   })
 * )
 * console.log(rendered.targetVersion) // "2026.7.1-2"
 * console.log(rendered.contentHash.length) // 64
 * ```
 *
 * @category rendering
 * @since 0.0.0
 */
export const renderOpenclawConfig = (intent: OpenclawDeploymentIntent): RenderedOpenclawConfig => {
  const canonicalJson = canonicalizeDocument(versionedDocumentRenderer(intent.openclawVersion)(intent));
  return RenderedOpenclawConfig.make({
    canonicalJson,
    contentHash: OpenclawSha256Hex.make(createHash("sha256").update(canonicalJson, "utf8").digest("hex")),
    targetVersion: intent.openclawVersion,
  });
};

/**
 * List the extension surfaces a deployment intent declares.
 *
 * Surfaces are dotted config paths (`channels.telegram` when Telegram is
 * enabled, `models.providers.<api>` per declared provider API family). The
 * lossy schema-export guard resolves each declared surface against the pinned
 * binary's `config schema` export via {@link findLossySchemaPlaceholders}.
 *
 * @example
 * ```ts
 * import {
 *   OpenclawAgentIntent,
 *   OpenclawDeploymentIntent,
 *   OpenclawGatewayIntent,
 *   OpenclawLoggingIntent,
 *   OpenclawSecretReference,
 *   OpenclawSecretsResolverIntent
 * } from "@beep/openclaw/OpenclawIntent.models"
 * import { declaredExtensionSurfaces } from "@beep/openclaw/OpenclawRender"
 *
 * const surfaces = declaredExtensionSurfaces(
 *   OpenclawDeploymentIntent.make({
 *     agent: OpenclawAgentIntent.make({
 *       id: "spike3",
 *       model: "ollama/gemma3:4b",
 *       name: "Spike 3",
 *       workspace: "/var/lib/beep/spike3"
 *     }),
 *     gateway: OpenclawGatewayIntent.make({
 *       authTokenRef: OpenclawSecretReference.make("op://beep-p0-spike3/spike3-rotating/password"),
 *       port: 19031
 *     }),
 *     logging: OpenclawLoggingIntent.make({ filePath: "/var/lib/beep/spike3/log/openclaw.log" }),
 *     openclawVersion: "2026.7.1-2",
 *     providers: [],
 *     secretsResolver: OpenclawSecretsResolverIntent.make({
 *       commandPath: "/opt/beep/openclaw/op-resolver.sh",
 *       opBinaryPath: "/opt/beep/openclaw/bin/op",
 *       trustedDir: "/opt/beep/openclaw"
 *     })
 *   })
 * )
 * console.log(surfaces) // []
 * ```
 *
 * @category rendering
 * @since 0.0.0
 */
export const declaredExtensionSurfaces = (intent: OpenclawDeploymentIntent): ReadonlyArray<string> =>
  A.appendAll(
    A.fromOption(O.as(intent.telegram, "channels.telegram")),
    A.dedupe(A.map(intent.providers, (provider) => `models.providers.${provider.api}`))
  );

/**
 * Detect declared extension surfaces the exported config schema cannot
 * validate.
 *
 * Walks a `config schema` JSON-schema export: a declared surface is lossy
 * when its resolved schema node is missing, or when it collapses to an
 * `additionalProperties: true` placeholder without declared properties (the
 * shape upstream substitutes once per-extension or aggregate schema caps are
 * exceeded). Pure and total over any export document shape.
 *
 * @example
 * ```ts
 * import { findLossySchemaPlaceholders } from "@beep/openclaw/OpenclawRender"
 *
 * const findings = findLossySchemaPlaceholders(
 *   {
 *     properties: {
 *       channels: {
 *         properties: { telegram: { additionalProperties: true, type: "object" } },
 *         type: "object"
 *       }
 *     },
 *     type: "object"
 *   },
 *   ["channels.telegram", "models.providers.ollama"]
 * )
 * console.log(findings.map((finding) => `${finding.surface}:${finding.reason}`))
 * // ["channels.telegram:placeholder", "models.providers.ollama:missing"]
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const findLossySchemaPlaceholders = (
  schemaExport: unknown,
  surfaces: ReadonlyArray<string>
): ReadonlyArray<OpenclawSchemaPlaceholderFinding> =>
  A.getSomes(
    A.map(surfaces, (surface) =>
      O.map(surfaceReason(schemaExport, surface), (reason) =>
        OpenclawSchemaPlaceholderFinding.make({ reason, surface })
      )
    )
  );
