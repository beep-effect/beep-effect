import * as Test from "@alchemy.run/test/Vitest";
import { AiMetricsHostConfig, aiMetricsConfigEnvKey } from "@beep/infra-hosts/AiMetricsConfig";
import {
  aiMetricsStackName,
  aiMetricsStackProgram,
  renderRetireComposeCommand,
} from "@beep/infra-hosts/AiMetricsStack";
import { describe, expect } from "@effect/vitest";
import * as Alchemy from "alchemy";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fakeCommandProviders, fakeDockerProviders, makeInspectableState, makeRecording } from "./fakes.ts";
import type { Recording } from "./fakes.ts";

const { test, deploy } = Test.make({ providers: Layer.empty, state: makeInspectableState().layer });

const dataVolume = "beep-ai-metrics-dankserver_phoenix_data";

const configBody = {
  sshDestination: "metrics-host",
  phoenix: { image: "arizephoenix/phoenix:15.5.0" },
  tailnet: { fqdn: "metrics-host.example.ts.net" },
  legacyCompose: { configRoot: "/srv/ai-metrics" },
  secretRefs: {
    hashSalt: "op://vault/ai-metrics/hash-salt",
    rawArchiveKey: "op://vault/ai-metrics/raw-archive-key",
  },
};

const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));

const writeConfigFile = Effect.fn("AiMetricsStackTest.writeConfigFile")(function* (body: unknown) {
  const fs = yield* FileSystem.FileSystem;
  const dir = yield* fs.makeTempDirectoryScoped();
  const path = `${dir}/ai-metrics.json`;
  const text = yield* encodeJson(body);
  yield* fs.writeFileString(path, text);
  return path;
});

const makeStack = (recording: Recording, env: Record<string, string>) => {
  const state = makeInspectableState();
  const stack = Alchemy.Stack(
    aiMetricsStackName,
    {
      providers: Layer.mergeAll(fakeDockerProviders(recording), fakeCommandProviders(recording)),
      state: state.layer,
    },
    aiMetricsStackProgram.pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)))
  );
  return { stack, state };
};

const deployExit = (recording: Recording, env: Record<string, string>, stage: string) =>
  Effect.exit(deploy(makeStack(recording, env).stack, { stage }));

const containerProps = (recording: Recording) =>
  O.getOrThrow(MutableHashMap.get(recording.props, "Docker.Container/Phoenix")) as {
    readonly name: string;
    readonly image: string;
    readonly start: boolean;
    readonly restart: string;
    readonly ports: ReadonlyArray<{ readonly external: string; readonly internal: number }>;
    readonly volumes: ReadonlyArray<{ readonly hostPath: string; readonly containerPath: string }>;
    readonly networks: ReadonlyArray<{ readonly name: string }>;
    readonly healthcheck: { readonly cmd: ReadonlyArray<string> };
  };

describe("AI metrics host stack", () => {
  test(
    "prod declares the context, network, looked-up data volume, Phoenix and its host steps",
    Effect.gen(function* () {
      const recording = makeRecording([dataVolume]);
      const path = yield* writeConfigFile(configBody);
      const { stack } = makeStack(recording, { [aiMetricsConfigEnvKey]: path });

      const output = yield* deploy(stack, { stage: "prod" });

      expect(output.phoenixUrl).toBe("https://metrics-host.example.ts.net:8447");
      expect(output.otlpTraceUrl).toBe("https://metrics-host.example.ts.net:8447/v1/traces");
      expect(O.getOrThrow(MutableHashMap.get(recording.props, "Docker.Context/Host"))).toMatchObject({
        name: "beep-ai-metrics",
        docker: "host=ssh://metrics-host",
      });
      expect(O.getOrThrow(MutableHashMap.get(recording.props, "Docker.Network/Network"))).toMatchObject({
        name: "beep-ai-metrics",
        driver: "bridge",
      });
      // The data volume is looked up, never reconciled.
      expect(O.isNone(MutableHashMap.get(recording.props, "Docker.Volume/RehearsalData"))).toBe(true);

      const phoenix = containerProps(recording);
      expect(phoenix.name).toBe("beep-ai-metrics-phoenix");
      expect(phoenix.image).toBe("arizephoenix/phoenix:15.5.0");
      expect(phoenix.start).toBe(true);
      expect(phoenix.restart).toBe("unless-stopped");
      expect(phoenix.ports).toEqual([{ external: "127.0.0.1:6006", internal: 6006 }]);
      expect(phoenix.volumes).toEqual([{ hostPath: dataVolume, containerPath: "/data" }]);
      expect(phoenix.networks).toEqual([{ name: "beep-ai-metrics" }]);
      expect(phoenix.healthcheck.cmd[0]).toBe("CMD");

      const commands = A.map(recording.commands, ({ command }) => command);
      expect(commands).toHaveLength(4);
      expect(A.every(commands, Str.startsWith("ssh -o BatchMode=yes"))).toBe(true);
      expect(commands[0]).toContain("docker volume inspect");
      expect(commands[1]).toContain("disable --now");
      expect(commands[2]).toContain("tailscale serve --yes --bg");
      expect(commands[3]).toContain("https://metrics-host.example.ts.net:8447");
    })
  );

  test(
    "a rehearsal stage owns a stage-suffixed volume and skips Compose retirement and Serve",
    Effect.gen(function* () {
      const recording = makeRecording();
      const path = yield* writeConfigFile(configBody);
      const { stack } = makeStack(recording, { [aiMetricsConfigEnvKey]: path });

      const output = yield* deploy(stack, { stage: "dev_operator" });

      expect(output.phoenixUrl).toBe("http://127.0.0.1:16006");
      expect(O.getOrThrow(MutableHashMap.get(recording.props, "Docker.Volume/RehearsalData"))).toMatchObject({
        name: `${dataVolume}-dev_operator`,
      });
      const phoenix = containerProps(recording);
      expect(phoenix.name).toBe("beep-ai-metrics-phoenix-dev_operator");
      expect(phoenix.ports).toEqual([{ external: "127.0.0.1:16006", internal: 6006 }]);
      const commands = A.map(recording.commands, ({ command }) => command);
      expect(commands).toHaveLength(2);
      expect(A.some(commands, Str.includes("tailscale serve --yes"))).toBe(false);
      expect(A.some(commands, Str.includes("disable --now"))).toBe(false);
    })
  );

  test(
    "prod refuses to run in CI and runs without it",
    Effect.gen(function* () {
      const path = yield* writeConfigFile(configBody);
      const refusedRecording = makeRecording([dataVolume]);
      const refused = yield* deployExit(refusedRecording, { CI: "true", [aiMetricsConfigEnvKey]: path }, "prod");
      expect(Exit.isFailure(refused)).toBe(true);
      expect(Exit.isFailure(refused) ? Cause.pretty(refused.cause) : "").toContain("workstation only");
      expect(refusedRecording.commands).toHaveLength(0);

      const recording = makeRecording([dataVolume]);
      const allowed = yield* deployExit(recording, { CI: "false", [aiMetricsConfigEnvKey]: path }, "prod");
      expect(Exit.isSuccess(allowed)).toBe(true);
      expect(recording.commands).toHaveLength(4);
    })
  );

  test(
    "a rehearsal stage may run in CI",
    Effect.gen(function* () {
      const path = yield* writeConfigFile(configBody);
      const recording = makeRecording();
      const exit = yield* deployExit(recording, { CI: "true", [aiMetricsConfigEnvKey]: path }, "ci_check");
      expect(Exit.isSuccess(exit)).toBe(true);
      expect(recording.commands).toHaveLength(2);
    })
  );

  test(
    "prod fails when the data volume does not exist",
    Effect.gen(function* () {
      const path = yield* writeConfigFile(configBody);
      const exit = yield* deployExit(makeRecording(), { [aiMetricsConfigEnvKey]: path }, "prod");
      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

  test(
    "configuration that is missing or malformed stops the stack before any resource",
    Effect.gen(function* () {
      const missingEnv = makeRecording([dataVolume]);
      const unset = yield* deployExit(missingEnv, {}, "prod");
      expect(Exit.isFailure(unset)).toBe(true);
      expect(missingEnv.commands).toHaveLength(0);

      const latestPath = yield* writeConfigFile({ ...configBody, phoenix: { image: "arizephoenix/phoenix:latest" } });
      const latestRecording = makeRecording([dataVolume]);
      const latest = yield* deployExit(latestRecording, { [aiMetricsConfigEnvKey]: latestPath }, "prod");
      expect(Exit.isFailure(latest)).toBe(true);
      expect(latestRecording.commands).toHaveLength(0);

      const badRefPath = yield* writeConfigFile({
        ...configBody,
        secretRefs: { hashSalt: "plain", rawArchiveKey: "x" },
      });
      const badRef = yield* deployExit(makeRecording([dataVolume]), { [aiMetricsConfigEnvKey]: badRefPath }, "prod");
      expect(Exit.isFailure(badRef)).toBe(true);

      const notJsonPath = yield* writeConfigFile("not an object");
      const notJson = yield* deployExit(makeRecording([dataVolume]), { [aiMetricsConfigEnvKey]: notJsonPath }, "prod");
      expect(Exit.isFailure(notJson)).toBe(true);

      const missingFile = yield* deployExit(
        makeRecording([dataVolume]),
        { [aiMetricsConfigEnvKey]: "/nonexistent/beep-ai-metrics.json" },
        "prod"
      );
      expect(Exit.isFailure(missingFile)).toBe(true);
    })
  );

  test(
    "state and outputs carry op:// references and never a resolved secret",
    Effect.gen(function* () {
      const sentinel = "resolved-secret-sentinel-4f1c";
      const path = yield* writeConfigFile(configBody);
      const recording = makeRecording([dataVolume]);
      const { stack, state } = makeStack(recording, {
        [aiMetricsConfigEnvKey]: path,
        AI_METRICS_HASH_SALT: sentinel,
      });
      yield* deploy(stack, { stage: "prod" });

      const persisted = yield* encodeJson({ resources: state.store, outputs: state.outputs });
      expect(persisted).toContain("op://vault/ai-metrics/hash-salt");
      expect(persisted).not.toContain(sentinel);
    })
  );
});

describe("AI metrics configuration", () => {
  test(
    "decodes defaults that match the Compose deployment",
    Effect.gen(function* () {
      const config = yield* S.decodeEffect(AiMetricsHostConfig)(configBody);
      expect(config.phoenix.containerName).toBe("beep-ai-metrics-phoenix");
      expect(config.phoenix.dataVolume).toBe(dataVolume);
      expect(config.tailnet.httpsPort).toBe(8447);
      expect(config.legacyCompose.unitName).toBe("ai-metrics-phoenix.service");
      expect(renderRetireComposeCommand(config)).toContain("com.docker.compose.project");
    })
  );

  test(
    "rejects an untagged image, a bad port and an SSH destination carrying options",
    Effect.gen(function* () {
      const decode = (body: unknown) => Effect.exit(S.decodeUnknownEffect(AiMetricsHostConfig)(body));
      const untagged = yield* decode({ ...configBody, phoenix: { image: "arizephoenix/phoenix" } });
      const badPort = yield* decode({ ...configBody, tailnet: { fqdn: "h.example", httpsPort: 70_000 } });
      const sshOptions = yield* decode({ ...configBody, sshDestination: "-oProxyCommand=x host" });
      const noDestination = yield* decode({ ...configBody, sshDestination: undefined });
      expect(A.every([untagged, badPort, sshOptions, noDestination], Exit.isFailure)).toBe(true);
    })
  );
});
