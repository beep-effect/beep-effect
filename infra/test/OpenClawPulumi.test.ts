// Covers the Pulumi-only half of `infra/src/OpenClaw.ts` (the stack config
// loader and the component) under Pulumi's mock runtime; the generation model
// and scripts it renders are tested where they now live, in @beep/infra-hosts.

import { loadOpenClawStackArgs, makeOpenClawGeneration, OpenClawStack } from "@beep/infra";
import { it } from "@beep/test-runner";
import * as NodeCrypto from "@effect/platform-node-shared/NodeCrypto";
import { describe, expect } from "@effect/vitest";
import * as pulumi from "@pulumi/pulumi";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

class OpenClawPulumiTestOperationError extends S.TaggedError<
  OpenClawPulumiTestOperationError,
  { readonly brand: unique symbol }
>()(
  "OpenClawPulumiTestOperationError",
  { cause: S.Defect({ includeStack: true }) },
  { description: "A failed Pulumi mock-runtime operation in OpenClawPulumi.test.ts." }
) {}

const stackConfig = {
  "openclaw:expectedHome": "/home/example",
  "openclaw:expectedHostname": "workstation",
  "openclaw:expectedMachineId": "0bffc9bc5a6b48928f1ab4794df5244b",
  "openclaw:expectedRuntimeDir": "/run/user/1000",
  "openclaw:expectedUid": "1000",
  "openclaw:expectedUsername": "operator",
  "openclaw:hostedProviderApiKeyRef": "op://beep-openclaw/hosted/api-key",
  "openclaw:hostedProviderBaseUrl": "https://hosted.example.test/v1",
  "openclaw:hostedProviderId": "hosted",
  "openclaw:hostedProviderModelId": "hosted-model",
  "openclaw:hostedProviderModelName": "Hosted Model",
  "openclaw:localProviderBaseUrl": "http://127.0.0.1:11434/v1",
  "openclaw:localProviderId": "local",
  "openclaw:localProviderModelId": "local-model",
  "openclaw:localProviderModelName": "Local Model",
  "openclaw:telegramBotTokenRef": "op://beep-openclaw/telegram/bot-token",
  "openclaw:telegramDmPolicy": "disabled",
  "openclaw:telegramGroupPolicy": "open",
  "openclaw:backupPassphraseSecretRef": "op://beep-openclaw/backup/passphrase",
  "openclaw:backupSshHost": "backup-host",
  "openclaw:backupSshUser": "backup-user",
  "openclaw:backupRemoteDir": "/srv/backups/openclaw",
};

const {
  "openclaw:backupPassphraseSecretRef": _passphrase,
  "openclaw:backupSshHost": _host,
  "openclaw:backupSshUser": _user,
  "openclaw:backupRemoteDir": _remoteDir,
  ...stackConfigWithoutBackup
} = stackConfig;

/** Every resource the mock runtime saw declared, as `<type> <name>`, in order. */
const declared: Array<string> = [];

/**
 * The Pulumi mock runtime with one stack config, restored and disconnected
 * when the layer is released.
 */
const PulumiMockRuntime = (config: Record<string, string>) =>
  Layer.effectDiscard(
    Effect.acquireRelease(
      Effect.gen(function* () {
        const previous = pulumi.runtime.allConfig();
        pulumi.runtime.setAllConfig(config);
        declared.length = 0;
        yield* Effect.tryPromise({
          try: () =>
            pulumi.runtime.setMocks(
              {
                call: (call) => call.inputs,
                newResource: (resource) => {
                  declared.push(`${resource.type} ${resource.name}`);
                  return { id: `${resource.name}-id`, state: { ...resource.inputs, stdout: "" } };
                },
              },
              "beep-openclaw",
              "test"
            ),
          catch: (cause) => OpenClawPulumiTestOperationError.make({ cause }),
        });
        return previous;
      }),
      (previous) =>
        Effect.promise(() => pulumi.runtime.disconnect()).pipe(
          Effect.ensuring(Effect.sync(() => pulumi.runtime.setAllConfig(previous)))
        )
    )
  ).pipe(Layer.provideMerge(NodeCrypto.layerDigest));

const declareStack = Effect.fn("OpenClawPulumiTest.declareStack")(function* () {
  const args = loadOpenClawStackArgs();
  const generation = yield* makeOpenClawGeneration(args);
  const stack = new OpenClawStack("openclaw", args, generation);
  // Mock registration is asynchronous: every step's stdout output resolves only
  // after its command resource was registered.
  yield* Effect.callback<void>((resume) => {
    pulumi
      .all([stack.preflightStdout, stack.stageStdout, stack.applyStdout, stack.probeStdout, stack.backupShipStdout])
      .apply(() => resume(Effect.void));
  });
  return A.filter(declared, Str.startsWith("command:local:Command "));
});

describe("@beep/infra OpenClaw Pulumi program", { concurrent: false }, () => {
  it.layer(PulumiMockRuntime(stackConfig), { timeout: "30 seconds" })("with a backup target", (it) => {
    it.effect("loads stack args, backup target included, from the openclaw config namespace", () =>
      Effect.sync(() => {
        const args = loadOpenClawStackArgs();
        expect(args.identity.hostname).toBe("workstation");
        expect(args.identity.uid).toBe(1000);
        expect(args.deployment.hostedProvider.providerId).toBe("hosted");
        expect(args.deployment.telegramDmPolicy).toBe("disabled");
        expect(args.deployment.telegramGroupPolicy).toBe("open");
        expect(O.getOrThrow(args.backup).host).toBe("backup-host");
        expect(O.getOrThrow(args.backup).remoteDir).toBe("/srv/backups/openclaw");
      })
    );

    it.effect("declares the preflight, stage, apply, probe and backup ship commands", () =>
      declareStack().pipe(
        Effect.map((commands) =>
          expect(commands).toEqual([
            "command:local:Command openclaw-preflight",
            "command:local:Command openclaw-stage",
            "command:local:Command openclaw-apply",
            "command:local:Command openclaw-probe",
            "command:local:Command openclaw-backup-ship",
          ])
        )
      )
    );
  });

  it.layer(PulumiMockRuntime(stackConfigWithoutBackup), { timeout: "30 seconds" })("without a backup target", (it) => {
    it.effect("declares no backup ship command", () =>
      declareStack().pipe(
        Effect.map((commands) =>
          expect(commands).toEqual([
            "command:local:Command openclaw-preflight",
            "command:local:Command openclaw-stage",
            "command:local:Command openclaw-apply",
            "command:local:Command openclaw-probe",
          ])
        )
      )
    );
  });
});
