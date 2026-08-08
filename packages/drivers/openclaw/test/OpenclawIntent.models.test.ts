import {
  OpenclawAgentIntent,
  OpenclawAuthProfileIntent,
  OpenclawControlUiIntent,
  OpenclawDeploymentIntent,
  OpenclawGatewayIntent,
  OpenclawLoggingIntent,
  OpenclawModelDeclaration,
  OpenclawModelProviderIntent,
  OpenclawModelProviderParams,
  OpenclawPersonaIntent,
  OpenclawProviderApiKey,
  OpenclawProviderApiKeyPlaceholder,
  OpenclawProviderApiKeySecretRef,
  OpenclawSecretReference,
  OpenclawSecretsResolverIntent,
  OpenclawTargetVersion,
  OpenclawTelegramGroupIntent,
  OpenclawTelegramIntent,
} from "@beep/openclaw/OpenclawIntent.models";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const SecretReferenceArbitrary = S.toArbitrary(OpenclawSecretReference);
const TargetVersionArbitrary = S.toArbitrary(OpenclawTargetVersion);
const ProviderApiKeyArbitrary = S.toArbitrary(OpenclawProviderApiKey);
const GatewayIntentArbitrary = S.toArbitrary(OpenclawGatewayIntent);
const TelegramIntentArbitrary = S.toArbitrary(OpenclawTelegramIntent);
const DeploymentIntentArbitrary = S.toArbitrary(OpenclawDeploymentIntent);

const sameProviderApiKey = S.toEquivalence(OpenclawProviderApiKey);
const sameGatewayIntent = S.toEquivalence(OpenclawGatewayIntent);
const sameTelegramIntent = S.toEquivalence(OpenclawTelegramIntent);
const sameDeploymentIntent = S.toEquivalence(OpenclawDeploymentIntent);

const acceptedReferences = [
  "op://v/i/f",
  "op://beep-p0-spike3/spike3-rotating/password",
  "op://Private/Discord Bot/token",
  "op://vault/item/section/field",
];

const rejectedReferences = [
  "",
  "http://vault/item/field",
  "op://vault/item",
  "op://vault/item/",
  "op:///item/field",
  "op://vault//field",
  "op:/vault/item/field",
];

const ollamaProvider = OpenclawModelProviderIntent.make({
  api: "ollama",
  apiKey: OpenclawProviderApiKeyPlaceholder.make({ _tag: "Placeholder", value: "ollama-local" }),
  baseUrl: "http://127.0.0.1:11434",
  contextTokens: O.some(32768),
  id: "ollama",
  models: [OpenclawModelDeclaration.make({ id: "gemma3:4b", input: ["text"], name: "gemma3:4b" })],
  params: O.some(OpenclawModelProviderParams.make({ numCtx: O.some(32768) })),
});

const minimalIntent = OpenclawDeploymentIntent.make({
  agent: OpenclawAgentIntent.make({
    id: "spike3",
    model: "ollama/gemma3:4b",
    name: "Spike 3",
    workspace: "/var/lib/beep/spike3",
  }),
  controlUi: OpenclawControlUiIntent.make({
    allowedOrigins: ["http://127.0.0.1:19031", "http://localhost:19031"],
    enabled: true,
  }),
  gateway: OpenclawGatewayIntent.make({
    authTokenRef: OpenclawSecretReference.make("op://beep-p0-spike3/spike3-rotating/password"),
    port: 19031,
  }),
  logging: OpenclawLoggingIntent.make({ filePath: "/var/lib/beep/spike3/log/openclaw.log" }),
  openclawVersion: "2026.7.1-2",
  persona: OpenclawPersonaIntent.make({
    clientDataPolicy: "synthetic-only",
    confidentialityPolicy: "advisory",
    soulMarkdown: "# Synthetic legal assistant",
  }),
  providers: [ollamaProvider],
  secretsResolver: OpenclawSecretsResolverIntent.make({
    commandPath: "/opt/beep/openclaw/op-resolver.sh",
    opBinaryPath: "/usr/bin/op",
    trustedDir: "/opt/beep/openclaw",
  }),
});

describe("@beep/openclaw intent models", () => {
  it("accepts well-formed op:// secret references", () => {
    for (const reference of acceptedReferences) {
      expect(O.isSome(OpenclawSecretReference.decodeOption(reference))).toBe(true);
    }
  });

  it("rejects malformed secret references", () => {
    for (const reference of rejectedReferences) {
      expect(O.isNone(OpenclawSecretReference.decodeOption(reference))).toBe(true);
    }
  });

  it("materializes defaults and keeps the minimal intent wire shape byte-identical", () => {
    expect(O.isNone(minimalIntent.telegram)).toBe(true);
    expect(Result.getOrThrow(S.encodeResult(OpenclawDeploymentIntent)(minimalIntent))).toEqual({
      agent: {
        id: "spike3",
        model: "ollama/gemma3:4b",
        name: "Spike 3",
        workspace: "/var/lib/beep/spike3",
      },
      authProfiles: [],
      controlUi: {
        allowedOrigins: ["http://127.0.0.1:19031", "http://localhost:19031"],
        enabled: true,
      },
      gateway: {
        authTokenRef: "op://beep-p0-spike3/spike3-rotating/password",
        bind: "loopback",
        port: 19031,
      },
      guardrails: { toolsDeny: ["*"] },
      logging: { filePath: "/var/lib/beep/spike3/log/openclaw.log" },
      openclawVersion: "2026.7.1-2",
      persona: {
        clientDataPolicy: "synthetic-only",
        confidentialityPolicy: "advisory",
        soulMarkdown: "# Synthetic legal assistant",
      },
      providers: [
        {
          api: "ollama",
          apiKey: { _tag: "Placeholder", value: "ollama-local" },
          baseUrl: "http://127.0.0.1:11434",
          contextTokens: 32768,
          id: "ollama",
          models: [{ id: "gemma3:4b", input: ["text"], name: "gemma3:4b" }],
          params: { numCtx: 32768 },
        },
      ],
      secretsResolver: {
        commandPath: "/opt/beep/openclaw/op-resolver.sh",
        opBinaryPath: "/usr/bin/op",
        passEnv: ["OP_SERVICE_ACCOUNT_TOKEN", "PATH"],
        trustedDir: "/opt/beep/openclaw",
      },
      skills: [],
    });
  });

  it("encodes telegram and auth-profile intents onto their wire shapes", () => {
    const telegram = OpenclawTelegramIntent.make({
      botTokenRef: OpenclawSecretReference.make("op://beep-p0-spike3/spike3-telegram/token"),
      defaultTo: O.some("@p0_spike1_jul25"),
      dmPolicy: "disabled",
      groupPolicy: "open",
      groups: {
        "-1004475923698": OpenclawTelegramGroupIntent.make({
          groupPolicy: O.some("open"),
          requireMention: false,
        }),
      },
    });
    const authProfile = OpenclawAuthProfileIntent.make({
      mode: "api_key",
      profileId: "ollama:manual",
      provider: "ollama",
    });

    expect(Result.getOrThrow(S.encodeResult(OpenclawTelegramIntent)(telegram))).toEqual({
      botTokenRef: "op://beep-p0-spike3/spike3-telegram/token",
      defaultTo: "@p0_spike1_jul25",
      dmPolicy: "disabled",
      groupPolicy: "open",
      groups: {
        "-1004475923698": { groupPolicy: "open", requireMention: false },
      },
    });
    expect(Result.getOrThrow(S.encodeResult(OpenclawAuthProfileIntent)(authProfile))).toEqual({
      mode: "api_key",
      profileId: "ollama:manual",
      provider: "ollama",
    });
  });

  it("keeps secret-ref api keys tagged and distinguishable from placeholders", () => {
    const secretRef = OpenclawProviderApiKeySecretRef.make({
      _tag: "SecretRef",
      ref: OpenclawSecretReference.make("op://vault/provider/api-key"),
    });

    expect(Result.getOrThrow(S.encodeResult(OpenclawProviderApiKey)(secretRef))).toEqual({
      _tag: "SecretRef",
      ref: "op://vault/provider/api-key",
    });
    expect(S.is(OpenclawProviderApiKey)(secretRef)).toBe(true);
  });

  it("requires HTTPS for secret-backed hosted providers while preserving loopback placeholders", () => {
    const secretApiKey = {
      _tag: "SecretRef",
      ref: "op://vault/provider/api-key",
    };
    const provider = {
      api: "openai-compat",
      apiKey: secretApiKey,
      baseUrl: "https://provider.example/v1",
      id: "hosted",
      models: [{ id: "model", input: ["text"], name: "model" }],
    };

    expect(Result.isSuccess(S.decodeUnknownResult(OpenclawModelProviderIntent)(provider))).toBe(true);
    expect(
      Result.isFailure(
        S.decodeUnknownResult(OpenclawModelProviderIntent)({ ...provider, baseUrl: "http://provider.example/v1" })
      )
    ).toBe(true);
    expect(S.is(OpenclawModelProviderIntent)(ollamaProvider)).toBe(true);
  });

  it("round-trips schema-derived intent payloads", () =>
    fc.assert(
      fc.property(
        SecretReferenceArbitrary,
        TargetVersionArbitrary,
        ProviderApiKeyArbitrary,
        GatewayIntentArbitrary,
        TelegramIntentArbitrary,
        DeploymentIntentArbitrary,
        (reference, version, apiKey, gateway, telegram, deployment) => {
          expect(
            Result.getOrThrow(
              S.decodeResult(OpenclawSecretReference)(
                Result.getOrThrow(S.encodeResult(OpenclawSecretReference)(reference))
              )
            )
          ).toBe(reference);
          expect(
            Result.getOrThrow(
              S.decodeResult(OpenclawTargetVersion)(Result.getOrThrow(S.encodeResult(OpenclawTargetVersion)(version)))
            )
          ).toBe(version);
          expect(
            sameProviderApiKey(
              Result.getOrThrow(
                S.decodeResult(OpenclawProviderApiKey)(
                  Result.getOrThrow(S.encodeResult(OpenclawProviderApiKey)(apiKey))
                )
              ),
              apiKey
            )
          ).toBe(true);
          expect(
            sameGatewayIntent(
              Result.getOrThrow(
                S.decodeResult(OpenclawGatewayIntent)(Result.getOrThrow(S.encodeResult(OpenclawGatewayIntent)(gateway)))
              ),
              gateway
            )
          ).toBe(true);
          expect(
            sameTelegramIntent(
              Result.getOrThrow(
                S.decodeResult(OpenclawTelegramIntent)(
                  Result.getOrThrow(S.encodeResult(OpenclawTelegramIntent)(telegram))
                )
              ),
              telegram
            )
          ).toBe(true);
          expect(
            sameDeploymentIntent(
              Result.getOrThrow(
                S.decodeResult(OpenclawDeploymentIntent)(
                  Result.getOrThrow(S.encodeResult(OpenclawDeploymentIntent)(deployment))
                )
              ),
              deployment
            )
          ).toBe(true);
        }
      ),
      fcRuns(50)
    ));
});
