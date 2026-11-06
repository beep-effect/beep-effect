import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it, layer } from "@effect/vitest";
import { AlchemyContext } from "alchemy/AlchemyContext";
import { CredentialsUnavailable } from "alchemy/Auth/Resolve";
import * as Interaction from "alchemy/Interaction";
import * as Provisioning from "alchemy/State/Provisioning";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as HttpClient from "effect/http/HttpClient";
import * as Layer from "effect/Layer";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { vi } from "vitest";

import { deployedCacheState, withoutStateProvisioning } from "../read-state.js";
import { handoffToken } from "../token.js";
import { stateReadFailure } from "../token-failure.js";

const token = "test-only-handoff-secret";
const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));
const identity = { resourceNamePrefix: "Example", team: "alpha", teams: ["alpha"] };

const alchemyContext = {
  adopt: false,
  dev: false,
  dotAlchemy: ".alchemy",
  updateStateStore: true,
};

const MissingCredentialsLive = Layer.mergeAll(
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make(() => Effect.die("missing-credentials-must-not-reach-network")),
  ),
  Layer.succeed(AlchemyContext, alchemyContext),
  Interaction.layerNonInteractive().pipe(Layer.provideMerge(NodeServices.layer)),
).pipe(Layer.provideMerge(ConfigProvider.layer(ConfigProvider.fromUnknown({}))));

layer(MissingCredentialsLive)("without Cloudflare credentials", (it) => {
  it.effect("missing credentials name the required variable without blaming the store", () =>
    Effect.gen(function* missingCredentials() {
      const before = { ...process.env };

      const result = yield* deployedCacheState("example-state-store").pipe(
        Effect.catchCause(flow(stateReadFailure, Effect.fail)),
        Effect.result,
      );

      expect(Result.isFailure(result)).toBe(true);

      if (Result.isFailure(result)) {
        expect(result.failure.message).toContain("CredentialsUnavailable");
        expect(result.failure.message).toContain("Missing required env: CLOUDFLARE_ACCOUNT_ID");
        expect(result.failure.message).not.toContain("unavailable or requires an upgrade");
      }

      const after = { ...process.env };
      expect(after).toEqual(before);
    }),
  );
});

it.effect.prop(
  "state failure diagnostics retain source fields without serializing credential data",
  { value: S.String },
  ({ value }) =>
    Effect.gen(function* credentialRedaction() {
    const failure = CredentialsUnavailable.make({
      cause: { apiToken: `fixture-only-credential:${value}` },
      message: "Missing required env: CLOUDFLARE_API_TOKEN",
      provider: "Cloudflare",
    }).pipe(Cause.die, stateReadFailure);

    expect(failure.message).toContain("CredentialsUnavailable");
    expect(failure.message).toContain("Missing required env: CLOUDFLARE_API_TOKEN");
    const serialized = yield* encodeJson(failure);
    expect(serialized).not.toContain("fixture-only-credential:");
    }),
);

const records = (fqn: string) =>
  Effect.succeed(
    fqn === "Example"
      ? {
          attr: { url: "https://cache.example.test/" },
          status: "updated",
        }
      : {
          attr: { text: Redacted.make(token) },
          resourceType: "Alchemy.Random",
          status: "created",
        },
  );

const receiver = A.join(
  [
    "const crypto = require('node:crypto');",
    "let input = '';",
    "process.stdin.on('data', chunk => input += chunk);",
    "process.stdin.on('end', () => {",
    "const hash = crypto.createHash('sha256').update(input).digest('hex');",
    "process.stdout.write(input); process.stderr.write(input);",
    "const leaked = process.argv.some(arg => arg.includes(input)) || Object.values(process.env).includes(input);",
    "process.exit(hash === process.argv[1] && !leaked ? 0 : 9);",
    "});",
  ],
  "\n",
);

layer(NodeServices.layer)("token handoff", (it) => {
  it.effect("sends a deployed token only through stdin and suppresses receiver output", () =>
    Effect.gen(function* stdinHandoff() {
      const stdout = vi.spyOn(process.stdout, "write");
      const stderr = vi.spyOn(process.stderr, "write");
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          stdout.mockRestore();
          stderr.mockRestore();
        }),
      );

      const values = yield* handoffToken(records, {
        args: ["-e", receiver, "8c6bb4ecb5f9adadb0fec015d9e69e5f8a0c4c0bf597a7960f4be9c69b8c600a"],
        command: process.execPath,
        ...identity,
      });

      expect(values).toEqual({
        TURBO_API: "https://cache.example.test",
        TURBO_TEAM: "alpha",
      });
      const stdoutCalls = yield* encodeJson(stdout.mock.calls);
      const stderrCalls = yield* encodeJson(stderr.mock.calls);
      expect(stdoutCalls).not.toContain(token);
      expect(stderrCalls).not.toContain(token);
    }),
  );

  it.effect("suppresses receiver output across the actual process boundary", () =>
    Effect.gen(function* outputBoundary() {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const child = yield* spawner.spawn(
        ChildProcess.make(process.execPath, [
          new URL("fixtures/handoff.ts", import.meta.url).pathname,
        ]),
      );
      const output = yield* child.all.pipe(Stream.decodeText(), Stream.mkString);
      const exitCode = yield* child.exitCode;
      expect(exitCode).toBe(0);
      expect(Str.includes(token)(output)).toBe(false);
      expect(output).toBe("");
    }),
  );

  it.effect("refuses undeployed records and never includes state contents in the error", () =>
    Effect.gen(function* missingToken() {
      const result = yield* handoffToken(() => Effect.succeed({ attr: { text: token } }), {
        args: ["-e", "process.exit(99)"],
        command: process.execPath,
        ...identity,
      }).pipe(Effect.result);

      const encoded = yield* encodeJson(result);
      expect(Result.isFailure(result)).toBe(true);
      expect(encoded).not.toContain(token);
    }),
  );
});

const ProvisioningEnabledLive = Layer.mergeAll(
  Layer.succeed(AlchemyContext, alchemyContext),
  ConfigProvider.layer(ConfigProvider.fromUnknown({ CI: false })),
);

layer(ProvisioningEnabledLive)("state provisioning policy", (it) => {
  it.effect(
    "state reads refuse bootstrap and upgrade even when the caller enables provisioning",
    () =>
      Effect.gen(function* readOnlyStatePolicy() {
        const changed = yield* Ref.make(false);
        const mutate = Ref.set(changed, true);

        const missing = yield* withoutStateProvisioning(
          Provisioning.deployMissing({ backend: "cloudflare", label: "test store" }, mutate),
        ).pipe(Effect.result);

        const outdated = yield* withoutStateProvisioning(
          Provisioning.upgradeOutdated(
            { backend: "cloudflare", expected: 2, label: "test store", observed: 1 },
            mutate,
          ),
        ).pipe(Effect.result);

        const mutated = yield* Ref.get(changed);
        expect(Result.isFailure(missing)).toBe(true);
        expect(Result.isFailure(outdated)).toBe(true);
        expect(mutated).toBe(false);
      }),
  );
});
