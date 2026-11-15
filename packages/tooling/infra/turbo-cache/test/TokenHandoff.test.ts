import { CachePolicy, Principal, Team } from "@beep/infra-turbo-cache/CachePolicy";
import { deployedCacheState, withoutStateProvisioning } from "@beep/infra-turbo-cache/internal/StateReader";
import { handoffToken, stateReadFailure, TokenHandoffOptions } from "@beep/infra-turbo-cache/TokenHandoff";
import { MemoryFileSystem } from "@beep/memfs";
import * as NodeChildProcessSpawner from "@effect/platform-node/NodeChildProcessSpawner";
import * as NodePath from "@effect/platform-node/NodePath";
import { expect, it, layer } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { AlchemyContext } from "alchemy/AlchemyContext";
import { ProfileStoreLive } from "alchemy/Auth/Profile";
import { CredentialsUnavailable } from "alchemy/Auth/Resolve";
import * as Interaction from "alchemy/Interaction";
import * as Provisioning from "alchemy/State/Provisioning";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as HttpClient from "effect/http/HttpClient";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { state } from "../alchemy.run.ts";

// The handoff spawns real receiver processes (native spawner and path); the
// file system is an empty in-memory volume, so the profile store finds no
// Alchemy profile on any machine and nothing on disk is read or written.
const PlatformLive = NodeChildProcessSpawner.layer.pipe(
  Layer.provideMerge(Layer.merge(MemoryFileSystem.layer, NodePath.layer))
);

const token = "test-only-handoff-secret";
const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));
const policy = CachePolicy.make({
  teams: [Team.make({ slug: "alpha", principals: [Principal.make({ name: "writer", access: "write", rotation: 1 })] })],
});
const identity = { policy, principal: "writer", resourceNamePrefix: "Example", team: "alpha" };

const alchemyContext = {
  adopt: false,
  dev: false,
  dotAlchemy: ".alchemy",
  updateStateStore: true,
};

const MissingCredentialsLive = Layer.mergeAll(
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make(() => Effect.die("missing-credentials-must-not-reach-network"))
  ),
  Layer.succeed(AlchemyContext, alchemyContext),
  Interaction.layerNonInteractive().pipe(Layer.provideMerge(PlatformLive)),
  ProfileStoreLive.pipe(Layer.provide(PlatformLive), Layer.orDie)
).pipe(
  // beta.86's state store needs SecureRandom.
  Layer.provideMerge(SecureRandom.layerWebCrypto),
  Layer.provideMerge(ConfigProvider.layer(ConfigProvider.fromUnknown({})))
);

layer(MissingCredentialsLive, { timeout: "30 seconds" })("without AWS credentials", (it) => {
  it.effect("missing AWS credentials fail the state read without blaming the store", () =>
    Effect.gen(function* missingCredentials() {
      const before = { ...process.env };

      // Building the S3 store is lazy; the first read is what needs credentials.
      const result = yield* deployedCacheState(state).pipe(
        Effect.flatMap((store) => store.get({ fqn: "TurboCache", stack: "TurboCache", stage: "prod" })),
        Effect.catchCause(flow(stateReadFailure, Effect.fail)),
        Effect.result
      );

      result.pipe(Result.isFailure, assertTrue);

      if (Result.isFailure(result)) {
        expect(result.failure.message).toContain("The token handoff failed before sending a credential.");
        expect(result.failure.message).not.toContain("unavailable or requires an upgrade");
      }

      const after = { ...process.env };
      expect(after).toEqual(before);
    })
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
    })
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
        }
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
  "\n"
);

layer(PlatformLive, { timeout: "30 seconds" })("token handoff", (it) => {
  // The receiver exits 0 only when stdin carried the token and neither its
  // argv nor its environment did; output suppression is proven across the
  // process boundary by the next test.
  it.effect("sends a deployed token only through stdin", () =>
    Effect.gen(function* stdinHandoff() {
      const values = yield* handoffToken(
        records,
        TokenHandoffOptions.make({
          args: ["-e", receiver, "8c6bb4ecb5f9adadb0fec015d9e69e5f8a0c4c0bf597a7960f4be9c69b8c600a"],
          command: process.execPath,
          ...identity,
        })
      );

      expect(values).toEqual({
        TURBO_API: "https://cache.example.test",
        TURBO_TEAM: "alpha",
      });
    })
  );

  it.effect("suppresses receiver output across the actual process boundary", () =>
    Effect.gen(function* outputBoundary() {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const path = yield* Path.Path;
      const fixture = yield* path.fromFileUrl(new URL("fixtures/Handoff.ts", import.meta.url));
      const child = yield* spawner.spawn(ChildProcess.make(process.execPath, [fixture]));
      const output = yield* child.all.pipe(Stream.decodeText(), Stream.mkString);
      const exitCode = yield* child.exitCode;
      expect(exitCode).toBe(0);
      expect(Str.includes(token)(output)).toBe(false);
      expect(output).toBe("");
    })
  );

  it.effect("refuses undeployed records and never includes state contents in the error", () =>
    Effect.gen(function* missingToken() {
      const result = yield* handoffToken(
        () => Effect.succeed({ attr: { text: token } }),
        TokenHandoffOptions.make({
          args: ["-e", "process.exit(99)"],
          command: process.execPath,
          ...identity,
        })
      ).pipe(Effect.result);

      const encoded = yield* encodeJson(result);
      result.pipe(Result.isFailure, assertTrue);
      expect(encoded).not.toContain(token);
    })
  );
});

const ProvisioningEnabledLive = Layer.mergeAll(
  Layer.succeed(AlchemyContext, alchemyContext),
  ConfigProvider.layer(ConfigProvider.fromUnknown({ CI: false }))
);

layer(ProvisioningEnabledLive, { timeout: "30 seconds" })("state provisioning policy", (it) => {
  it.effect("state reads refuse bootstrap and upgrade even when the caller enables provisioning", () =>
    Effect.gen(function* readOnlyStatePolicy() {
      const changed = yield* Ref.make(false);
      const mutate = Ref.set(changed, true);

      const missing = yield* withoutStateProvisioning(
        Provisioning.deployMissing({ backend: "cloudflare", label: "test store" }, mutate)
      ).pipe(Effect.result);

      const outdated = yield* withoutStateProvisioning(
        Provisioning.upgradeOutdated({ backend: "cloudflare", expected: 2, label: "test store", observed: 1 }, mutate)
      ).pipe(Effect.result);

      const mutated = yield* Ref.get(changed);
      missing.pipe(Result.isFailure, assertTrue);
      outdated.pipe(Result.isFailure, assertTrue);
      expect(mutated).toBe(false);
    })
  );
});
