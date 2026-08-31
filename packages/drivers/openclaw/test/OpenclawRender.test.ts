import { OpenclawSchemaPlaceholderFinding } from "@beep/openclaw/Openclaw.models";
import {
  OpenclawAgentIntent,
  OpenclawControlUiIntent,
  OpenclawDeploymentIntent,
  OpenclawGatewayIntent,
  OpenclawLoggingIntent,
  OpenclawModelDeclaration,
  OpenclawModelProviderIntent,
  OpenclawPersonaIntent,
  OpenclawProviderApiKeyPlaceholder,
  OpenclawProviderApiKeySecretRef,
  OpenclawSecretReference,
  OpenclawSecretsResolverIntent,
} from "@beep/openclaw/OpenclawIntent.models";
import {
  declaredExtensionSurfaces,
  findLossySchemaPlaceholders,
  RenderedOpenclawConfig,
  renderOpenclawConfig,
} from "@beep/openclaw/OpenclawRender";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { pipe, Result } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";
import {
  goldenDeploymentIntent,
  goldenIntentCanonicalJson,
  goldenIntentContentHash,
} from "./fixtures/golden-intent.expected.ts";

const IntentArbitrary = S.toArbitrary(OpenclawDeploymentIntent)(fc);

const decodeJsonDocument = (json: string): unknown => Result.getOrThrow(UnknownFromJsonString.decodeResult(json));

const parseDocument = (json: string): { readonly [key: string]: unknown } =>
  O.getOrThrow(pipe(decodeJsonDocument(json), O.liftPredicate(P.isObject)));

const withoutSecretsJson = (json: string): string =>
  Result.getOrThrow(UnknownFromJsonString.encodeResult(R.remove(parseDocument(json), "secrets")));

const secretReferenceCount = (json: string): number => Str.split(json, "op://").length - 1;

const minimalIntent = OpenclawDeploymentIntent.make({
  agent: OpenclawAgentIntent.make({
    id: "spike",
    model: "ollama/gemma3:4b",
    name: "P0 Spike 1",
    workspace: "/var/lib/beep/openclaw/workspace",
  }),
  controlUi: OpenclawControlUiIntent.make({
    allowedOrigins: ["http://127.0.0.1:19021", "http://localhost:19021"],
    enabled: true,
  }),
  gateway: OpenclawGatewayIntent.make({
    authTokenRef: OpenclawSecretReference.make("op://beep-p0-spike3/spike3-rotating/password"),
    port: 19021,
  }),
  logging: OpenclawLoggingIntent.make({ filePath: "/var/lib/beep/openclaw/state/log/openclaw.log" }),
  openclawVersion: "2026.7.1-2",
  persona: OpenclawPersonaIntent.make({
    clientDataPolicy: "synthetic-only",
    confidentialityPolicy: "advisory",
    soulMarkdown: "# Synthetic legal assistant",
  }),
  providers: [],
  secretsResolver: OpenclawSecretsResolverIntent.make({
    commandPath: "/opt/beep/openclaw/op-resolver.sh",
    opBinaryPath: "/opt/beep/openclaw/bin/op",
    trustedDir: "/opt/beep/openclaw",
  }),
});

const ollamaProvider = (id: string) =>
  OpenclawModelProviderIntent.make({
    api: "ollama",
    apiKey: OpenclawProviderApiKeyPlaceholder.make({ _tag: "Placeholder", value: "ollama-local" }),
    baseUrl: "http://127.0.0.1:11434",
    id,
    models: [OpenclawModelDeclaration.make({ id: "gemma3:4b", input: ["text"], name: "gemma3:4b" })],
  });

describe("@beep/openclaw render adapter", () => {
  it("renders the golden intent to byte-identical canonical JSON with the pinned content hash", () => {
    const rendered = renderOpenclawConfig(goldenDeploymentIntent);

    expect(rendered.canonicalJson).toBe(goldenIntentCanonicalJson);
    expect(rendered.contentHash).toBe(goldenIntentContentHash);
    expect(rendered.targetVersion).toBe("2026.7.1-2");
    expect(S.is(RenderedOpenclawConfig)(rendered)).toBe(true);
  });

  it("renders deterministically", () => {
    const first = renderOpenclawConfig(goldenDeploymentIntent);
    const second = renderOpenclawConfig(goldenDeploymentIntent);

    expect(second.canonicalJson).toBe(first.canonicalJson);
    expect(second.contentHash).toBe(first.contentHash);
  });

  it("enforces the 2026.7.1-2 adapter invariants in the rendered document", () => {
    const rendered = renderOpenclawConfig(goldenDeploymentIntent);
    const json = rendered.canonicalJson;
    const parsed = parseDocument(json);

    expect(pipe(json, Str.includes('"configWrites": false'))).toBe(true);
    expect(pipe(json, Str.includes('"meta"'))).toBe(false);
    expect(parsed).toMatchObject({
      agents: { list: [{ id: "spike3", model: { primary: "ollama/gemma3:4b" } }] },
      channels: {
        telegram: {
          botToken: { id: "value", provider: "op_telegram", source: "exec" },
          configWrites: false,
          enabled: true,
        },
      },
      gateway: {
        auth: { mode: "token", token: { id: "value", provider: "op_gateway", source: "exec" } },
        bind: "loopback",
        controlUi: {
          allowedOrigins: ["http://127.0.0.1:19031", "http://localhost:19031"],
          enabled: true,
        },
        mode: "local",
        reload: { mode: "off" },
      },
    });

    expect(secretReferenceCount(json)).toBe(2);
    expect(parsed).toMatchObject({
      secrets: {
        providers: {
          op_gateway: { args: ["/opt/beep/openclaw/bin/op", "op://beep-p0-spike3/spike3-rotating/password"] },
          op_telegram: { args: ["/opt/beep/openclaw/bin/op", "op://beep-p0-spike3/spike3-telegram/bot-token"] },
        },
      },
    });
    expect(pipe(withoutSecretsJson(json), Str.includes("op://"))).toBe(false);
  });

  it("omits channels and the telegram secrets provider for the minimal intent", () => {
    const rendered = renderOpenclawConfig(minimalIntent);

    expect(pipe(rendered.canonicalJson, Str.includes("op_telegram"))).toBe(false);
    expect(parseDocument(rendered.canonicalJson)).toEqual({
      agents: {
        list: [
          {
            id: "spike",
            model: { primary: "ollama/gemma3:4b" },
            name: "P0 Spike 1",
            workspace: "/var/lib/beep/openclaw/workspace",
          },
        ],
      },
      gateway: {
        auth: { mode: "token", token: { id: "value", provider: "op_gateway", source: "exec" } },
        bind: "loopback",
        controlUi: {
          allowedOrigins: ["http://127.0.0.1:19021", "http://localhost:19021"],
          enabled: true,
        },
        mode: "local",
        port: 19021,
        reload: { mode: "off" },
      },
      logging: { file: "/var/lib/beep/openclaw/state/log/openclaw.log" },
      secrets: {
        providers: {
          op_gateway: {
            args: ["/opt/beep/openclaw/bin/op", "op://beep-p0-spike3/spike3-rotating/password"],
            command: "/opt/beep/openclaw/op-resolver.sh",
            jsonOnly: false,
            passEnv: ["OP_SERVICE_ACCOUNT_TOKEN", "PATH"],
            source: "exec",
            trustedDirs: ["/opt/beep/openclaw"],
          },
        },
      },
      tools: { deny: ["*"] },
    });
  });

  it("renders secret-referenced provider api keys as exec secret references", () => {
    const rendered = renderOpenclawConfig(
      OpenclawDeploymentIntent.make({
        agent: minimalIntent.agent,
        controlUi: minimalIntent.controlUi,
        gateway: minimalIntent.gateway,
        logging: minimalIntent.logging,
        openclawVersion: "2026.7.1-2",
        persona: minimalIntent.persona,
        providers: [
          OpenclawModelProviderIntent.make({
            api: "openai-compat",
            apiKey: OpenclawProviderApiKeySecretRef.make({
              _tag: "SecretRef",
              ref: OpenclawSecretReference.make("op://beep-p0-spike3/corp-llm/api-key"),
            }),
            baseUrl: "https://llm.example.com/v1",
            id: "corp",
            models: [OpenclawModelDeclaration.make({ id: "corp-model", input: ["text"], name: "Corp Model" })],
          }),
        ],
        secretsResolver: minimalIntent.secretsResolver,
      })
    );
    const parsed = parseDocument(rendered.canonicalJson);

    expect(parsed).toMatchObject({
      models: {
        providers: {
          corp: {
            api: "openai-compat",
            apiKey: { id: "value", provider: "op_provider_corp", source: "exec" },
            baseUrl: "https://llm.example.com/v1",
          },
        },
      },
      secrets: {
        providers: {
          op_provider_corp: { args: ["/opt/beep/openclaw/bin/op", "op://beep-p0-spike3/corp-llm/api-key"] },
        },
      },
    });
    expect(secretReferenceCount(rendered.canonicalJson)).toBe(2);
    expect(pipe(withoutSecretsJson(rendered.canonicalJson), Str.includes("op://"))).toBe(false);
  });

  it("declares extension surfaces per intent", () => {
    expect(declaredExtensionSurfaces(goldenDeploymentIntent)).toEqual([
      "gateway.controlUi",
      "channels.telegram",
      "models.providers.ollama",
    ]);
    expect(declaredExtensionSurfaces(minimalIntent)).toEqual(["gateway.controlUi"]);
    expect(
      declaredExtensionSurfaces(
        OpenclawDeploymentIntent.make({
          agent: minimalIntent.agent,
          controlUi: minimalIntent.controlUi,
          gateway: minimalIntent.gateway,
          logging: minimalIntent.logging,
          openclawVersion: "2026.7.1-2",
          persona: minimalIntent.persona,
          providers: [ollamaProvider("ollama"), ollamaProvider("ollama-backup")],
          secretsResolver: minimalIntent.secretsResolver,
        })
      )
    ).toEqual(["gateway.controlUi", "models.providers.ollama"]);
  });

  it("accepts rich schema exports for every declared surface", () => {
    const richExport = {
      properties: {
        channels: {
          properties: {
            telegram: {
              additionalProperties: false,
              properties: { enabled: { type: "boolean" } },
              type: "object",
            },
          },
          type: "object",
        },
        gateway: {
          properties: {
            controlUi: {
              additionalProperties: false,
              properties: { enabled: { type: "boolean" } },
              type: "object",
            },
          },
          type: "object",
        },
        models: {
          properties: {
            providers: {
              additionalProperties: {
                properties: { baseUrl: { type: "string" } },
                type: "object",
              },
              type: "object",
            },
          },
          type: "object",
        },
      },
      type: "object",
    };

    expect(findLossySchemaPlaceholders(richExport, ["channels.telegram", "models.providers.ollama"])).toEqual([]);
  });

  it("flags surfaces missing from the schema export", () => {
    const gatewayOnlyExport = {
      properties: { gateway: { properties: { port: { type: "number" } }, type: "object" } },
      type: "object",
    };
    const findings = findLossySchemaPlaceholders(gatewayOnlyExport, ["channels.telegram"]);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toBeInstanceOf(OpenclawSchemaPlaceholderFinding);
    expect(Result.getOrThrow(S.encodeResult(OpenclawSchemaPlaceholderFinding)(findings[0]))).toEqual({
      reason: "missing",
      surface: "channels.telegram",
    });
  });

  it("flags surfaces collapsed to additionalProperties placeholders", () => {
    const placeholderExport = {
      properties: {
        channels: {
          properties: { telegram: { additionalProperties: true, type: "object" } },
          type: "object",
        },
        models: {
          properties: { providers: { additionalProperties: true, type: "object" } },
          type: "object",
        },
      },
      type: "object",
    };
    const findings = findLossySchemaPlaceholders(placeholderExport, ["channels.telegram", "models.providers.ollama"]);

    expect(
      findings.map((finding) => Result.getOrThrow(S.encodeResult(OpenclawSchemaPlaceholderFinding)(finding)))
    ).toEqual([
      { reason: "placeholder", surface: "channels.telegram" },
      { reason: "placeholder", surface: "models.providers.ollama" },
    ]);
  });

  it("renders deterministically for arbitrary intents", () =>
    fc.assert(
      fc.property(IntentArbitrary, (intent) => {
        const first = renderOpenclawConfig(intent);
        const second = renderOpenclawConfig(intent);

        expect(second.canonicalJson).toBe(first.canonicalJson);
        expect(second.contentHash).toBe(first.contentHash);
        expect(Result.isSuccess(UnknownFromJsonString.decodeResult(first.canonicalJson))).toBe(true);
      }),
      fcRuns(25)
    ));
});
