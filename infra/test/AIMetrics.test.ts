import {
  AIMetricsPulumiConfigValues,
  AIMetricsRemoteDeploymentConfig,
  AIMetricsRemoteSshConfig,
  AIMetricsStackArgs,
  makeAIMetricsStackArgsFromConfigValues,
} from "@beep/infra";
import { AiMetricsDeployTarget, AiMetricsInstallInput, makeAiMetricsInstallSpec } from "@beep/repo-ai-metrics";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as O from "@beep/utils/Option";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import { Effect } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";
import { expectSchemaRoundTrip } from "./schemaParity.ts";

const decodeAIMetricsPulumiConfigValues = S.decodeEffect(AIMetricsPulumiConfigValues);
const isAIMetricsPulumiConfigValues = S.is(AIMetricsPulumiConfigValues);
const AIMetricsPulumiConfigValuesEquivalent = S.toEquivalence(AIMetricsPulumiConfigValues);

const encodeUnknownAIMetricsRemoteDeploymentConfig = S.encodeUnknownEffect(AIMetricsRemoteDeploymentConfig);
const encodeUnknownAIMetricsRemoteSshConfig = S.encodeUnknownEffect(AIMetricsRemoteSshConfig);

describe("@beep/infra AIMetrics", () => {
  it.effect(
    "keeps stack args import-safe and target-aware",
    Effect.fnUntraced(function* () {
      const args = AIMetricsStackArgs.new(
        AiMetricsInstallInput.make({
          hashSaltSecretRef: O.some("op://TBK/ai-metrics/hash-salt"),
          rawArchiveKeySecretRef: O.some("op://TBK/ai-metrics/raw-archive-key"),
          target: AiMetricsDeployTarget.Enum.dankserver,
        }),
        AIMetricsRemoteDeploymentConfig.make({})
      );

      expect(args.install.target).toBe("dankserver");
      assertNone(args.install.dataRoot);
      expect(args.remote.remoteConfigRoot).toBe("/home/elpresidank/ai-metrics");
      expect(args.remote.remoteMirrorRoot).toBe("/srv/data/ai-metrics/p7-derived-mirror");
      expect(args.remote.phoenixTailnetHttpsPort).toBe(8447);
      expect(O.getOrUndefined((yield* makeAiMetricsInstallSpec(args.install)).hashSaltSecretRef)).toBe(
        "op://TBK/ai-metrics/hash-salt"
      );
      expect(O.getOrUndefined((yield* makeAiMetricsInstallSpec(args.install)).rawArchiveKeySecretRef)).toBe(
        "op://TBK/ai-metrics/raw-archive-key"
      );
    })
  );

  it.effect(
    "maps the dankserver Pulumi stack config to a production-safe install spec",
    Effect.fnUntraced(function* () {
      const args = makeAIMetricsStackArgsFromConfigValues({
        hashSaltSecretRef: "op://TBK/ai-metrics/hash-salt",
        rawArchiveKeySecretRef: "op://TBK/ai-metrics/raw-archive-key",
        target: "dankserver",
      });
      const spec = yield* makeAiMetricsInstallSpec(args.install);

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
    })
  );

  it.effect(
    "applies remote Phoenix image, port, and SSH config overrides",
    Effect.fnUntraced(function* () {
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
      const spec = yield* makeAiMetricsInstallSpec(args.install);

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
    })
  );

  it.effect(
    "decodes numeric Pulumi tailnet HTTPS port values",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(AIMetricsPulumiConfigValues)({
        phoenixTailnetHttpsPort: 9446,
      });

      expect(decoded.phoenixTailnetHttpsPort).toBe(9446);
      expect(
        (yield* Effect.flip(
          S.decodeUnknownEffect(AIMetricsPulumiConfigValues)({
            phoenixTailnetHttpsPort: "9446",
          })
        ))._tag
      ).toBe("SchemaError");
      expect(
        (yield* Effect.flip(
          S.decodeEffect(AIMetricsPulumiConfigValues)({
            phoenixTailnetHttpsPort: 0,
          })
        ))._tag
      ).toBe("SchemaError");
    })
  );

  it.effect(
    "rejects dankserver install specs when the hash salt secret reference is absent",
    Effect.fnUntraced(function* () {
      const args = makeAIMetricsStackArgsFromConfigValues({
        target: "dankserver",
      });

      expect((yield* Effect.flip(makeAiMetricsInstallSpec(args.install))).message).toContain(
        "non-local installs require hashSaltSecretRef"
      );
    })
  );

  it.effect(
    "encodes AI metrics remote config with unchanged optional-key wire shapes",
    Effect.fnUntraced(function* () {
      const encodedSsh = yield* encodeUnknownAIMetricsRemoteSshConfig(
        AIMetricsRemoteSshConfig.make({
          agentSocketPath: O.some("/tmp/agent.sock"),
        })
      );
      const encodedRemote = yield* encodeUnknownAIMetricsRemoteDeploymentConfig(
        AIMetricsRemoteDeploymentConfig.make({
          phoenixTailnetHttpsPort: 9446,
        })
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
    })
  );

  it.effect.prop(
    "round-trips AI metrics config schemas through encoded wire values",
    [Arbitrary.schema(AIMetricsPulumiConfigValues)],
    ([value]) =>
      Effect.gen(function* () {
        const decoded = yield* decodeAIMetricsPulumiConfigValues(value);
        assertTrue(isAIMetricsPulumiConfigValues(value) && AIMetricsPulumiConfigValuesEquivalent(decoded, value));
      }),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips AIMetricsPulumiConfigValues through its encoded wire codec",
    [Arbitrary.schema(AIMetricsPulumiConfigValues)],
    ([value]) => expectSchemaRoundTrip(AIMetricsPulumiConfigValues, value),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips AIMetricsRemoteSshConfig through its encoded wire codec",
    [Arbitrary.schema(AIMetricsRemoteSshConfig)],
    ([value]) => expectSchemaRoundTrip(AIMetricsRemoteSshConfig, value),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips AIMetricsRemoteDeploymentConfig through its encoded wire codec",
    [Arbitrary.schema(AIMetricsRemoteDeploymentConfig)],
    ([value]) => expectSchemaRoundTrip(AIMetricsRemoteDeploymentConfig, value),
    { arbitrary: fcRuns(25) }
  );
});
