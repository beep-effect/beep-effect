import {
  AIMetricsPulumiConfigValues,
  AIMetricsRemoteDeploymentConfig,
  AIMetricsRemoteSshConfig,
  AIMetricsStackArgs,
  makeAIMetricsStackArgsFromConfigValues,
} from "@beep/infra";
import { AiMetricsDeployTarget, AiMetricsInstallInput, makeAiMetricsInstallSpec } from "@beep/repo-ai-metrics";
import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils";
import * as O from "@beep/utils/Option";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";
import { expectSchemaRoundTrip } from "./schemaParity.ts";

describe("@beep/infra AIMetrics", () => {
  it("keeps stack args import-safe and target-aware", () => {
    const args = AIMetricsStackArgs.new(
      AiMetricsInstallInput.make({
        hashSaltSecretRef: O.some("op://TBK/ai-metrics/hash-salt"),
        rawArchiveKeySecretRef: O.some("op://TBK/ai-metrics/raw-archive-key"),
        target: AiMetricsDeployTarget.Enum.dankserver,
      }),
      AIMetricsRemoteDeploymentConfig.make({})
    );

    expect(args.install.target).toBe("dankserver");
    expect(O.isNone(args.install.dataRoot)).toBe(true);
    expect(args.remote.remoteConfigRoot).toBe("/home/elpresidank/ai-metrics");
    expect(args.remote.remoteMirrorRoot).toBe("/srv/data/ai-metrics/p7-derived-mirror");
    expect(args.remote.phoenixTailnetHttpsPort).toBe(8447);
    expect(O.getOrUndefined(Effect.runSync(makeAiMetricsInstallSpec(args.install)).hashSaltSecretRef)).toBe(
      "op://TBK/ai-metrics/hash-salt"
    );
    expect(O.getOrUndefined(Effect.runSync(makeAiMetricsInstallSpec(args.install)).rawArchiveKeySecretRef)).toBe(
      "op://TBK/ai-metrics/raw-archive-key"
    );
  });

  it("maps the dankserver Pulumi stack config to a production-safe install spec", () => {
    const args = makeAIMetricsStackArgsFromConfigValues({
      hashSaltSecretRef: "op://TBK/ai-metrics/hash-salt",
      rawArchiveKeySecretRef: "op://TBK/ai-metrics/raw-archive-key",
      target: "dankserver",
    });
    const spec = Effect.runSync(makeAiMetricsInstallSpec(args.install));

    expect(args.install.target).toBe("dankserver");
    expect(O.getOrUndefined(args.install.publicBaseUrl)).toBe("https://dankserver.tailc7c348.ts.net:8447");
    expect(args.remote.ssh.host).toBe("dankserver");
    expect(args.remote.ssh.user).toBe("elpresidank");
    expect(args.remote.remoteMirrorRoot).toBe("/srv/data/ai-metrics/p7-derived-mirror");
    expect(spec.target).toBe("dankserver");
    expect(O.getOrUndefined(spec.hashSaltSecretRef)).toBe("op://TBK/ai-metrics/hash-salt");
    expect(O.getOrUndefined(spec.rawArchiveKeySecretRef)).toBe("op://TBK/ai-metrics/raw-archive-key");
    expect(spec.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          enabledByDefault: true,
          internalUrl: "http://127.0.0.1:6006",
          otlp: expect.objectContaining({
            signalScope: "traces_only",
            traceUrl: "https://dankserver.tailc7c348.ts.net:8447/v1/traces",
          }),
          publicUrl: "https://dankserver.tailc7c348.ts.net:8447",
          tool: "phoenix",
        }),
      ])
    );
  });

  it("applies remote Phoenix image, port, and SSH config overrides", () => {
    const args = makeAIMetricsStackArgsFromConfigValues({
      hashSaltSecretRef: "op://TBK/ai-metrics/hash-salt",
      phoenixImage: "arizephoenix/phoenix:latest-p5b",
      phoenixTailnetHttpsPort: 9446,
      rawArchiveKeySecretRef: "op://TBK/ai-metrics/raw-archive-key",
      remoteConfigRoot: "/srv/ai-metrics",
      remoteMirrorRoot: "/srv/ai-metrics/p7-mirror",
      sshAgentSocketPath: "/tmp/agent.sock",
      sshHost: "dankserver-yubi",
      sshUser: "deploy",
      tailnetFqdn: "dankserver.tail.example.ts.net",
      target: "dankserver",
    });
    const spec = Effect.runSync(makeAiMetricsInstallSpec(args.install));

    expect(O.getOrUndefined(args.install.publicBaseUrl)).toBe("https://dankserver.tail.example.ts.net:9446");
    expect(args.remote.remoteConfigRoot).toBe("/srv/ai-metrics");
    expect(args.remote.remoteMirrorRoot).toBe("/srv/ai-metrics/p7-mirror");
    expect(O.getOrUndefined(args.remote.ssh.agentSocketPath)).toBe("/tmp/agent.sock");
    expect(args.remote.ssh.host).toBe("dankserver-yubi");
    expect(args.remote.ssh.user).toBe("deploy");
    expect(spec.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          image: "arizephoenix/phoenix:latest-p5b",
          otlp: expect.objectContaining({
            traceUrl: "https://dankserver.tail.example.ts.net:9446/v1/traces",
          }),
          publicUrl: "https://dankserver.tail.example.ts.net:9446",
          tool: "phoenix",
        }),
      ])
    );
  });

  it("decodes numeric Pulumi tailnet HTTPS port values", () => {
    const decoded = Effect.runSync(
      AIMetricsPulumiConfigValues.decodeEffect({
        phoenixTailnetHttpsPort: 9446,
      })
    );

    expect(decoded.phoenixTailnetHttpsPort).toBe(9446);
    expect(() =>
      Effect.runSync(
        AIMetricsPulumiConfigValues.decodeEffect({
          phoenixTailnetHttpsPort: "9446",
        })
      )
    ).toThrow();
    expect(() =>
      Effect.runSync(
        AIMetricsPulumiConfigValues.decodeEffect({
          phoenixTailnetHttpsPort: 0,
        })
      )
    ).toThrow();
  });

  it("rejects dankserver install specs when the hash salt secret reference is absent", () => {
    const args = makeAIMetricsStackArgsFromConfigValues({
      target: "dankserver",
    });

    expect(() => Effect.runSync(makeAiMetricsInstallSpec(args.install))).toThrow(
      "non-local installs require hashSaltSecretRef"
    );
  });

  it("encodes AI metrics remote config with unchanged optional-key wire shapes", () => {
    const encodedSsh = Effect.runSync(
      S.encodeUnknownEffect(AIMetricsRemoteSshConfig)(
        AIMetricsRemoteSshConfig.make({
          agentSocketPath: O.some("/tmp/agent.sock"),
        })
      )
    );
    const encodedRemote = Effect.runSync(
      S.encodeUnknownEffect(AIMetricsRemoteDeploymentConfig)(
        AIMetricsRemoteDeploymentConfig.make({
          phoenixTailnetHttpsPort: 9446,
        })
      )
    );

    expect(encodedSsh).toEqual({
      agentSocketPath: "/tmp/agent.sock",
      host: "dankserver",
      user: "elpresidank",
    });
    expect(encodedRemote).toEqual({
      phoenixTailnetHttpsPort: 9446,
      remoteConfigRoot: "/home/elpresidank/ai-metrics",
      remoteMirrorRoot: "/srv/data/ai-metrics/p7-derived-mirror",
      ssh: {
        host: "dankserver",
        user: "elpresidank",
      },
      tailnetFqdn: "dankserver.tailc7c348.ts.net",
    });
  });

  it("round-trips AI metrics config schemas through encoded wire values", () => {
    assertSchemaArbitraryDecodesToSelf(AIMetricsPulumiConfigValues, {
      numRuns: 25,
    });
    expectSchemaRoundTrip(AIMetricsPulumiConfigValues);
    expectSchemaRoundTrip(AIMetricsRemoteSshConfig);
    expectSchemaRoundTrip(AIMetricsRemoteDeploymentConfig);
  });
});
