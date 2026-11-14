import * as Test from "@alchemy.run/test/Vitest";
import { openClawConfigEnvKey, openClawStackName, openClawStackProgram } from "@beep/infra-hosts/OpenClawStack";
import { describe, expect } from "@effect/vitest";
import * as Alchemy from "alchemy";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fakeCommandProviders, makeInspectableState, makeRecording } from "./fakes.ts";
import type { Recording } from "./fakes.ts";

const { test, deploy } = Test.make({ providers: Layer.empty, state: makeInspectableState().layer });

const argsBody = {
  identity: {
    home: "/home/example",
    hostname: "workstation",
    machineId: "0bffc9bc5a6b48928f1ab4794df5244b",
    runtimeDir: "/run/user/1000",
    uid: 1000,
    username: "operator",
  },
  deployment: {
    hostedProvider: {
      apiKeyRef: "op://beep-openclaw/hosted/api-key",
      baseUrl: "https://hosted.example.test/v1",
      modelId: "hosted-model",
      modelName: "Hosted Model",
      providerId: "hosted",
    },
    localProvider: {
      baseUrl: "http://127.0.0.1:11434/v1",
      modelId: "local-model",
      modelName: "Local Model",
      providerId: "local",
    },
    telegramBotTokenRef: "op://beep-openclaw/telegram/bot-token",
  },
};

const withBackup = {
  ...argsBody,
  backup: {
    host: "backup-host",
    passphraseSecretRef: "op://beep-openclaw/backup/passphrase",
    remoteDir: "/srv/backups/openclaw",
    user: "backup-user",
  },
};

const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));

const writeConfigFile = Effect.fn("OpenClawStackTest.writeConfigFile")(function* (body: unknown) {
  const fs = yield* FileSystem.FileSystem;
  const dir = yield* fs.makeTempDirectoryScoped();
  const path = `${dir}/openclaw.json`;
  const text = yield* encodeJson(body);
  yield* fs.writeFileString(path, text);
  return path;
});

const makeStack = (recording: Recording, env: Record<string, string>) => {
  const state = makeInspectableState();
  const stack = Alchemy.Stack(
    openClawStackName,
    { providers: fakeCommandProviders(recording), state: state.layer },
    openClawStackProgram.pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)))
  );
  return { stack, state };
};

describe("OpenClaw host stack", () => {
  test(
    "prod runs preflight, stage, apply and probe in order, each the rendered script",
    Effect.gen(function* () {
      const recording = makeRecording();
      const path = yield* writeConfigFile(argsBody);
      const output = yield* deploy(makeStack(recording, { [openClawConfigEnvKey]: path }).stack, { stage: "prod" });

      const commands = A.map(recording.commands, ({ command }) => command);
      expect(commands).toHaveLength(4);
      expect(A.every(commands, Str.startsWith("/bin/bash --noprofile --norc -p -c '"))).toBe(true);
      expect(commands[0]).toContain("0bffc9bc5a6b48928f1ab4794df5244b");
      expect(commands[0]).toContain("machine-id mismatch");
      expect(commands[1]).toContain(output.generationId);
      expect(commands[2]).toContain(output.generationId);
      expect(output.generationId).toMatch(/^[0-9a-f]{64}$/u);
      expect(output.generationDir).toBe(`/etc/beep/openclaw/${output.generationId}`);
      expect(output.operatorCommands.rollback).toContain("/bin/bash");
    })
  );

  test(
    "a configured backup adds the ship step after the probe",
    Effect.gen(function* () {
      const recording = makeRecording();
      const path = yield* writeConfigFile(withBackup);
      yield* deploy(makeStack(recording, { [openClawConfigEnvKey]: path }).stack, { stage: "prod" });
      expect(recording.commands).toHaveLength(5);
      expect(recording.commands[4]?.command).toContain("backup-user@backup-host");
    })
  );

  test(
    "a rehearsal stage renders the generation and runs no command",
    Effect.gen(function* () {
      const recording = makeRecording();
      const path = yield* writeConfigFile(argsBody);
      const output = yield* deploy(makeStack(recording, { [openClawConfigEnvKey]: path, CI: "true" }).stack, {
        stage: "dev_operator",
      });
      expect(recording.commands).toHaveLength(0);
      expect(output.stage).toBe("rehearsal");
      expect(output.generationId).toMatch(/^[0-9a-f]{64}$/u);
    })
  );

  test(
    "prod refuses to run in CI",
    Effect.gen(function* () {
      const recording = makeRecording();
      const path = yield* writeConfigFile(argsBody);
      const exit = yield* Effect.exit(
        deploy(makeStack(recording, { [openClawConfigEnvKey]: path, CI: "true" }).stack, { stage: "prod" })
      );
      expect(Exit.isFailure(exit)).toBe(true);
      expect(recording.commands).toHaveLength(0);
    })
  );

  test(
    "an incomplete identity or a plaintext secret reference is rejected before any command",
    Effect.gen(function* () {
      const { identity: _identity, ...noIdentity } = argsBody;
      const plaintext = {
        ...argsBody,
        deployment: { ...argsBody.deployment, telegramBotTokenRef: "plaintext-token" },
      };
      for (const body of [noIdentity, plaintext]) {
        const recording = makeRecording();
        const path = yield* writeConfigFile(body);
        const exit = yield* Effect.exit(
          deploy(makeStack(recording, { [openClawConfigEnvKey]: path }).stack, { stage: "prod" })
        );
        expect(Exit.isFailure(exit)).toBe(true);
        expect(recording.commands).toHaveLength(0);
      }
    })
  );

  test(
    "the backup passphrase never reaches state, outputs or a step's props",
    Effect.gen(function* () {
      const sentinel = "resolved-passphrase-sentinel-9d2e";
      const recording = makeRecording();
      const path = yield* writeConfigFile(withBackup);
      // The passphrase reaches the backup step only through the deploy process
      // environment `op run` builds; here it sits in the stack's configuration
      // surface, which the stack must never copy into props or state.
      const { stack, state } = makeStack(recording, {
        [openClawConfigEnvKey]: path,
        OPENCLAW_BACKUP_PASSPHRASE: sentinel,
      });
      yield* deploy(stack, { stage: "prod" });

      // Step props carry only the ordering edge, never a credential variable.
      const envKeys = A.dedupe(A.flatMap(recording.commands, ({ env }) => R.keys(env)));
      expect(envKeys).toEqual(["BEEP_HOSTS_AFTER"]);

      const persisted = yield* encodeJson({
        resources: state.store,
        outputs: state.outputs,
        steps: recording.commands,
      });
      expect(persisted).toContain("op://beep-openclaw/backup/passphrase");
      expect(persisted).not.toContain(sentinel);
    })
  );
});
