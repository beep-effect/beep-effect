// Covers the Pulumi component in `infra/src/AIMetrics.ts` under Pulumi's mock
// runtime: the dankserver target declares the three remote Phoenix commands
// with their SSH connection and rendered scripts; the local target declares
// none. This is the live Pulumi deploy path until the hosts cutover.

import { AIMetricsStack, makeAIMetricsStackArgsFromConfigValues } from "@beep/infra";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as pulumi from "@pulumi/pulumi";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

class AIMetricsPulumiTestOperationError extends S.TaggedError<
  AIMetricsPulumiTestOperationError,
  { readonly brand: unique symbol }
>()(
  "AIMetricsPulumiTestOperationError",
  { cause: S.Defect({ includeStack: true }) },
  { description: "A failed Pulumi mock-runtime operation in AIMetricsPulumi.test.ts." }
) {}

interface RemoteCommandInputs {
  readonly connection: { readonly host: string; readonly user: string; readonly agentSocketPath?: string };
  readonly create: string;
  readonly update: string;
}

/** Inputs of every `command:remote:Command` the mock runtime saw, by resource name. */
const remoteCommands = MutableHashMap.empty<string, RemoteCommandInputs>();

const PulumiMockRuntime = Layer.effectDiscard(
  Effect.acquireRelease(
    Effect.tryPromise({
      try: () =>
        pulumi.runtime.setMocks(
          {
            call: (call) => call.inputs,
            newResource: (resource) => {
              if (resource.type === "command:remote:Command") {
                MutableHashMap.set(remoteCommands, resource.name, resource.inputs as RemoteCommandInputs);
              }
              return { id: `${resource.name}-id`, state: { ...resource.inputs, stdout: "" } };
            },
          },
          "beep-ai-metrics",
          "test"
        ),
      catch: (cause) => AIMetricsPulumiTestOperationError.make({ cause }),
    }),
    () => Effect.promise(() => pulumi.runtime.disconnect())
  )
);

const dankserverArgs = makeAIMetricsStackArgsFromConfigValues({
  hashSaltSecretRef: "op://TBK/ai-metrics/hash-salt",
  phoenixImage: "arizephoenix/phoenix:15.5.0",
  phoenixTailnetHttpsPort: 9446,
  rawArchiveKeySecretRef: "op://TBK/ai-metrics/raw-archive-key",
  remoteConfigRoot: "/srv/ai-metrics",
  sshAgentSocketPath: "/run/user/1000/agent.sock",
  sshHost: "metrics-host",
  sshUser: "deploy",
  tailnetFqdn: "metrics-host.example.ts.net",
  target: "dankserver",
});

/** Construct the component and wait until each remote step's stdout output resolves. */
const declareStack = Effect.fn("AIMetricsPulumiTest.declareStack")(function* (
  name: string,
  args: typeof dankserverArgs
) {
  MutableHashMap.clear(remoteCommands);
  const stack = new AIMetricsStack(name, args);
  yield* Effect.callback<void>((resume) => {
    pulumi
      .all([stack.remotePreflightStdout, stack.remoteApplyStdout, stack.remoteHealthStdout])
      .apply(() => resume(Effect.void));
  });
  return stack;
});

const remoteCommand = (name: string): RemoteCommandInputs => O.getOrThrow(MutableHashMap.get(remoteCommands, name));

describe("@beep/infra AIMetricsStack", { concurrent: false }, () => {
  it.layer(PulumiMockRuntime, { timeout: "30 seconds" })("under the Pulumi mock runtime", (it) => {
    it.effect("declares preflight, apply and health over the configured SSH connection for dankserver", () =>
      Effect.gen(function* () {
        yield* declareStack("ai-metrics", dankserverArgs);
        const names = remoteCommands.pipe(MutableHashMap.keys, A.fromIterable, A.sort(Str.Order));
        expect(names).toEqual([
          "ai-metrics-phoenix-apply",
          "ai-metrics-phoenix-health",
          "ai-metrics-phoenix-preflight",
        ]);
        expect(remoteCommand("ai-metrics-phoenix-preflight").connection).toMatchObject({
          agentSocketPath: "/run/user/1000/agent.sock",
          host: "metrics-host",
          user: "deploy",
        });
        expect(remoteCommand("ai-metrics-phoenix-preflight").create).toContain(
          "AI metrics Phoenix preflight passed for metrics-host.example.ts.net:9446"
        );
      })
    );

    it.effect("renders the Compose file, user unit and Tailscale Serve port into the apply step", () =>
      Effect.gen(function* () {
        yield* declareStack("ai-metrics", dankserverArgs);
        const apply = remoteCommand("ai-metrics-phoenix-apply");
        expect(apply.create).toBe(apply.update);
        expect(apply.create).toContain("image: arizephoenix/phoenix:15.5.0");
        expect(apply.create).toContain("container_name: beep-ai-metrics-phoenix");
        expect(apply.create).toContain("127.0.0.1:6006:6006");
        expect(apply.create).toContain("/srv/ai-metrics/phoenix.compose.yaml");
        expect(apply.create).toContain("systemctl --user restart ai-metrics-phoenix.service");
        expect(apply.create).toContain("current_tailnet_port='\"'\"'9446'\"'\"'");
      })
    );

    it.effect("probes loopback, Tailscale Serve and the public URL in the health step", () =>
      Effect.gen(function* () {
        yield* declareStack("ai-metrics", dankserverArgs);
        const health = remoteCommand("ai-metrics-phoenix-health");
        expect(health.create).toContain("curl -fsS http://127.0.0.1:6006");
        expect(health.create).toContain("https://metrics-host.example.ts.net:9446");
        expect(health.create).toContain("docker logs beep-ai-metrics-phoenix --tail 80");
      })
    );

    it.effect("declares no remote command for the local target", () =>
      Effect.gen(function* () {
        yield* declareStack(
          "ai-metrics-local",
          makeAIMetricsStackArgsFromConfigValues({ dataRoot: "/srv/ai-metrics-local", target: "local" })
        );
        expect(MutableHashMap.size(remoteCommands)).toBe(0);
      })
    );
  });
});
