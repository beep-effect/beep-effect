import * as Test from "@alchemy.run/test/Vitest";
import { SecretSpec, SecretsConfig } from "@beep/infra-github/Config";
import { productionConfig, productionSecretsConfig, productionStage } from "@beep/infra-github/Production";
import {
  DuplicateSecretName,
  declareSecrets,
  SecretsStageIsNotProd,
  secretLogicalId,
  secretsEnvFile,
  secretsProgram,
} from "@beep/infra-github/Secrets";
import * as BunServices from "@effect/platform-bun/BunServices";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FakeRepository, fakeProviders } from "./support/FakeGitHub.ts";
import { typed } from "./support/Scratch.ts";
import type { TypedScratch } from "./support/Scratch.ts";

const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const plaintextForTests = "fleet-watch-placeholder-key-never-a-real-secret";

const scenario = <E>(
  name: string,
  body: (stack: TypedScratch, fake: FakeRepository) => Effect.Effect<void, E>,
  stage = "test"
) => {
  const fake = FakeRepository.fromCensus();
  const { test } = Test.make({ providers: fakeProviders(fake), stage });
  test.provider(name, (stack) => body(typed(stack), fake));
};

const recordingConfig = (overrides: Readonly<Record<string, string>> = {}) => {
  const loaded: Array<string> = [];
  const values = ConfigProvider.fromUnknown({
    INFRA_GITHUB_SECRETS_PLANE: "workstation",
    FLEET_WATCH_APP_PRIVATE_KEY: plaintextForTests,
    ...overrides,
  });
  const provider = ConfigProvider.make((path) => {
    loaded.push(A.join(A.map(path, String), "."));
    return values.load(path);
  });
  return { loaded, program: Effect.provideService(secretsProgram, ConfigProvider.ConfigProvider, provider) };
};

scenario("a stage other than prod dies before any configuration read or request", (stack, fake) =>
  Effect.gen(function* () {
    const config = recordingConfig();
    const exit = yield* Effect.exit(stack.deploy(config.program));
    const text = Exit.match(exit, { onSuccess: () => "deployed", onFailure: Cause.pretty });
    expect(text).toContain(SecretsStageIsNotProd.make({ stage: "test" }).message);
    expect(config.loaded).toEqual([]);
    expect(fake.calls).toEqual([]);
  })
);

scenario(
  "on prod from a workstation the program reads the key and uploads it once",
  (stack, fake) =>
    Effect.gen(function* () {
      const config = recordingConfig();
      yield* stack.deploy(config.program);
      expect(config.loaded).toContain("FLEET_WATCH_APP_PRIVATE_KEY");
      expect(A.map(fake.writes(), ({ method, path }) => `${method} ${path}`)).toEqual([
        "PUT /repos/beep-effect/beep-effect/environments/fleet-watch/secrets/FLEET_WATCH_APP_PRIVATE_KEY",
      ]);
    }),
  productionStage
);

scenario(
  "on prod a set CI variable dies before the key is read or any request is sent",
  (stack, fake) =>
    Effect.gen(function* () {
      const config = recordingConfig({ CI: "true" });
      const exit = yield* Effect.exit(stack.deploy(config.program));
      const text = Exit.match(exit, { onSuccess: () => "deployed", onFailure: Cause.pretty });
      expect(text).toContain("InfraGithubSecrets deploys from a workstation under op run, never from CI.");
      expect(config.loaded).not.toContain("FLEET_WATCH_APP_PRIVATE_KEY");
      expect(fake.writes()).toEqual([]);
    }),
  productionStage
);

scenario(
  "on prod an empty CI variable is not CI and the key still uploads",
  (stack, fake) =>
    Effect.gen(function* () {
      const config = recordingConfig({ CI: "" });
      yield* stack.deploy(config.program);
      expect(A.length(fake.writes())).toBe(1);
    }),
  productionStage
);

scenario(
  "on prod an empty key dies before any declaration, so it never replaces the working secret",
  (stack, fake) =>
    Effect.gen(function* () {
      const config = recordingConfig({ FLEET_WATCH_APP_PRIVATE_KEY: "" });
      const exit = yield* Effect.exit(stack.deploy(config.program));
      const text = Exit.match(exit, { onSuccess: () => "deployed", onFailure: Cause.pretty });
      expect(text).toContain("FLEET_WATCH_APP_PRIVATE_KEY");
      expect(Str.includes(plaintextForTests)(text)).toBe(false);
      expect(fake.writes()).toEqual([]);
    }),
  productionStage
);

scenario("deploying uploads each secret sealed to its environment's key and never sends the value", (stack, fake) =>
  Effect.gen(function* () {
    const output = yield* stack.deploy(declareSecrets(productionSecretsConfig, () => Redacted.make(plaintextForTests)));
    expect(output.secrets).toEqual(["Secret-fleet-watch-FLEET_WATCH_APP_PRIVATE_KEY"]);
    expect(A.map(fake.writes(), ({ method, path }) => `${method} ${path}`)).toEqual([
      "PUT /repos/beep-effect/beep-effect/environments/fleet-watch/secrets/FLEET_WATCH_APP_PRIVATE_KEY",
    ]);
    const stored = O.getOrThrow(MutableHashMap.get(fake.secrets, "fleet-watch/FLEET_WATCH_APP_PRIVATE_KEY"));
    expect(stored.key_id).toBe("fake-environment-key");
    expect(typeof stored.encrypted_value).toBe("string");
    const recorded = yield* encodeJson({ calls: fake.calls, output });
    expect(Str.includes(plaintextForTests)(recorded)).toBe(false);
  })
);

scenario("two secrets with one name die before any request", (stack, fake) =>
  Effect.gen(function* () {
    const spec = (environment: string) =>
      SecretSpec.make({ environment, name: "SHARED_KEY", reference: "op://BEEP_SECRETS/item/field" });
    const doubled = SecretsConfig.make({
      ...productionSecretsConfig,
      secrets: [spec("fleet-watch"), spec("turbo-cache-write")],
    });
    const exit = yield* Effect.exit(stack.deploy(declareSecrets(doubled, () => Redacted.make(plaintextForTests))));
    const text = Exit.match(exit, { onSuccess: () => "", onFailure: Cause.pretty });
    expect(text).toContain("DuplicateSecretName");
    expect(text).toContain(DuplicateSecretName.make({ secretName: "SHARED_KEY" }).message);
    expect(fake.writes()).toEqual([]);
  })
);

describe("InfraGithubSecrets configuration", () => {
  it("names each secret by its environment and name", () => {
    expect(A.map(productionSecretsConfig.secrets, secretLogicalId)).toEqual([
      "Secret-fleet-watch-FLEET_WATCH_APP_PRIVATE_KEY",
    ]);
  });

  it("leaves every secret it owns unmanaged in the CI stack", () => {
    const unmanagedSecrets = A.map(
      A.filter(productionConfig.unmanaged, (object) => object.objectClass === "secret"),
      ({ name }) => name
    );
    for (const spec of productionSecretsConfig.secrets) {
      expect(unmanagedSecrets).toContain(`${spec.environment}/${spec.name}`);
    }
  });
});

it.layer(BunServices.layer)("InfraGithubSecrets committed files", (it) => {
  it.effect("commits an op run env file that matches the configuration and holds references only", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const packageRoot = yield* path.fromFileUrl(new URL("../", import.meta.url));
      const text = yield* fs.readFileString(path.join(packageRoot, "secrets.env"));
      expect(text).toBe(secretsEnvFile(productionSecretsConfig));
      for (const line of A.filter(Str.split(text, "\n"), Str.isNonEmpty)) {
        expect(line).toMatch(/^[A-Z0-9_]+="op:\/\/[^"]+"$/u);
      }
    })
  );

  it.effect("is referenced by no workflow, so it never deploys from CI", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* path.fromFileUrl(new URL("../../../../../", import.meta.url));
      const workflows = path.join(repoRoot, ".github", "workflows");
      const files = yield* fs.readDirectory(workflows);
      const referencing = yield* Effect.filter(
        files,
        (file) =>
          Effect.map(
            fs.readFileString(path.join(workflows, file)),
            (text) => Str.includes("secrets.alchemy.run.ts")(text) || Str.includes("InfraGithubSecrets")(text)
          ),
        { concurrency: 1 }
      );
      expect(referencing).toEqual([]);
    })
  );
});
