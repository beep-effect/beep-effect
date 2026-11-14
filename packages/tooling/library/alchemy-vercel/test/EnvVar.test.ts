import * as Vercel from "@beep/alchemy-vercel";
import { describe, expect } from "@effect/vitest";
import { adopt, Unowned } from "alchemy/AdoptPolicy";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as Str from "effect/String";
import { FakeVercel, TEAM_ID } from "./harness/FakeVercel.ts";
import { failureTag, makeHarness, persistedStrings, typed } from "./harness/Harness.ts";
import { envVarRead } from "./harness/Readers.ts";

const { test } = makeHarness();

/** Run a deploy with these config values, as `op run` would export them. */
const withConfig =
  (values: Record<string, string>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    Effect.provideService(effect, ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(values));

const stackWith = Effect.fn("stackWith")(function* (
  projectName: string,
  env: Omit<Vercel.EnvVarProps, "project" | "teamId">
) {
  const project = yield* Vercel.Project("Web", { name: projectName, teamId: TEAM_ID });
  return yield* Vercel.EnvVar("Var", { project: project.projectId, teamId: TEAM_ID, ...env });
});

describe("Vercel.EnvVar", () => {
  test.provider("creates, updates and deletes a sensitive variable without exposing its value", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      yield* stack.destroy();
      const created = yield* stack.deploy(
        stackWith("vt-env-crud", {
          key: "HUBSPOT_TOKEN",
          value: Redacted.make("secret-one"),
          targets: ["production"],
          type: "sensitive",
        })
      );
      expect(created.key).toBe("HUBSPOT_TOKEN");
      expect(created.type).toBe("sensitive");
      expect(created.targets).toEqual(["production"]);
      expect(P.hasProperty(created, "value")).toBe(false);
      expect(O.getOrThrow(FakeVercel.env(created.envId)).value).toBe("secret-one");
      // A literal `value` is persisted in state (Alchemy keeps a Redacted prop's plain text), which is why
      // secrets use `valueFrom`; this also proves `persistedStrings` sees through the envelope.
      const persisted = yield* persistedStrings;
      expect(A.some(persisted, Str.includes("secret-one"))).toBe(true);

      const rotated = yield* stack.deploy(
        stackWith("vt-env-crud", {
          key: "HUBSPOT_TOKEN",
          value: Redacted.make("secret-two"),
          targets: ["production", "preview"],
          type: "sensitive",
        })
      );
      expect(rotated.envId).toBe(created.envId);
      expect(rotated.targets).toEqual(["production", "preview"]);
      expect(O.getOrThrow(FakeVercel.env(created.envId)).value).toBe("secret-two");

      yield* stack.destroy();
      expect(O.isNone(FakeVercel.env(created.envId))).toBe(true);
    })
  );

  test.provider("scopes a preview variable to a git branch", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      yield* stack.destroy();
      const created = yield* stack.deploy(
        stackWith("vt-env-branch", {
          key: "NEXT_PUBLIC_STAGE",
          value: Redacted.make("staging"),
          targets: ["preview"],
          gitBranch: "staging",
        })
      );
      expect(created.gitBranch).toBe("staging");
      expect(created.type).toBe("encrypted");
      yield* stack.destroy();
    })
  );

  test.provider("replaces the variable when its type changes", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      yield* stack.destroy();
      const env = { key: "SITE", value: Redacted.make("a"), targets: ["production"] } as const;
      const first = yield* stack.deploy(stackWith("vt-env-replace", { ...env, type: "encrypted" }));
      const second = yield* stack.deploy(stackWith("vt-env-replace", { ...env, type: "sensitive" }));
      expect(second.envId).not.toBe(first.envId);
      expect(O.isNone(FakeVercel.env(first.envId))).toBe(true);
      yield* stack.destroy();
    })
  );

  test.provider("reads an owned variable plainly and a foreign one as unowned", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      yield* stack.destroy();
      const deployed = yield* stack.deploy(
        stackWith("vt-env-read", { key: "SITE", value: Redacted.make("v"), targets: ["production"] })
      );
      const read = yield* envVarRead;
      const olds = {
        project: deployed.projectId,
        teamId: TEAM_ID,
        key: "SITE",
        value: Redacted.make("v"),
        targets: ["production"],
      } as const;
      const input = { id: "Var", fqn: "Var", instanceId: "00", olds };

      const owned = yield* read({ ...input, output: deployed });
      expect(Unowned.is(owned)).toBe(false);
      expect(owned?.envId).toBe(deployed.envId);

      const foreign = yield* read({ ...input, output: undefined });
      expect(Unowned.is(foreign)).toBe(true);

      const missing = yield* read({ ...input, olds: { ...olds, key: "ABSENT" }, output: undefined });
      expect(missing).toBeUndefined();
      yield* stack.destroy();
    })
  );

  test.provider("adopts an existing variable only under adopt(true) and overwrites its value", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      yield* stack.destroy();
      const project = FakeVercel.seedProject("vt-env-adopt");
      const seeded = FakeVercel.seedEnv({
        projectId: project.id,
        key: "SANITY_DATASET",
        value: "old",
        type: "encrypted",
        target: ["production"],
      });
      const declare = Vercel.EnvVar("Var", {
        project: project.id,
        teamId: TEAM_ID,
        key: "SANITY_DATASET",
        value: Redacted.make("production"),
        targets: ["production"],
      });

      const refused = yield* Effect.exit(stack.deploy(declare));
      expect(failureTag(refused)).toEqual(O.some("OwnedBySomeoneElse"));

      const adopted = yield* stack.deploy(declare.pipe(adopt(true)));
      expect(adopted.envId).toBe(seeded.id);
      expect(O.getOrThrow(FakeVercel.env(seeded.id)).value).toBe("production");
      yield* stack.destroy();
      expect(O.isNone(FakeVercel.env(seeded.id))).toBe(true);
    })
  );
  test.provider("treats a variable on overlapping targets as foreign", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      yield* stack.destroy();
      const project = FakeVercel.seedProject("vt-env-overlap");
      const seeded = FakeVercel.seedEnv({
        projectId: project.id,
        key: "SITE",
        value: "foreign",
        type: "encrypted",
        target: ["production", "preview"],
      });
      const declare = Vercel.EnvVar("Var", {
        project: project.id,
        teamId: TEAM_ID,
        key: "SITE",
        value: Redacted.make("ours"),
        targets: ["production"],
      });

      const refused = yield* Effect.exit(stack.deploy(declare));
      expect(failureTag(refused)).toEqual(O.some("OwnedBySomeoneElse"));
      expect(O.getOrThrow(FakeVercel.env(seeded.id)).value).toBe("foreign");

      const adopted = yield* stack.deploy(declare.pipe(adopt(true)));
      expect(adopted.envId).toBe(seeded.id);
      expect(adopted.targets).toEqual(["production"]);
      yield* stack.destroy();
    })
  );

  test.provider("keeps the variable when the default type is written out", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      yield* stack.destroy();
      const env = { key: "SITE", value: Redacted.make("a"), targets: ["production"] } as const;
      const implicit = yield* stack.deploy(stackWith("vt-env-default-type", env));
      const explicit = yield* stack.deploy(stackWith("vt-env-default-type", { ...env, type: "encrypted" }));
      expect(explicit.envId).toBe(implicit.envId);
      yield* stack.destroy();
    })
  );
  test.provider("replaces an adopted variable whose stored type is weaker than declared", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      yield* stack.destroy();
      const project = FakeVercel.seedProject("vt-env-adopt-type");
      const seeded = FakeVercel.seedEnv({
        projectId: project.id,
        key: "HUBSPOT_TOKEN",
        value: "old",
        type: "encrypted",
        target: ["production"],
      });
      const adopted = yield* stack.deploy(
        Vercel.EnvVar("Var", {
          project: project.id,
          teamId: TEAM_ID,
          key: "HUBSPOT_TOKEN",
          value: Redacted.make("secret"),
          targets: ["production"],
          type: "sensitive",
        }).pipe(adopt(true))
      );
      expect(adopted.type).toBe("sensitive");
      expect(O.isNone(FakeVercel.env(seeded.id))).toBe(true);
      const stored = O.getOrThrow(FakeVercel.env(adopted.envId));
      expect(stored.type).toBe("sensitive");
      expect(stored.value).toBe("secret");
      yield* stack.destroy();
    })
  );
  test.provider("accepts a stronger stored type and converges without replacing", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      yield* stack.destroy();
      FakeVercel.storeTypeAs("TEAM_POLICY_VAR", "sensitive");
      const env = { key: "TEAM_POLICY_VAR", value: Redacted.make("v"), targets: ["production"] } as const;
      const first = yield* stack.deploy(stackWith("vt-env-stronger", env));
      expect(first.type).toBe("sensitive");
      const before = A.length(FakeVercel.requestsFor(first.projectId));
      const second = yield* stack.deploy(stackWith("vt-env-stronger", env));
      const secondDeploy = A.drop(FakeVercel.requestsFor(first.projectId), before);
      expect(second.envId).toBe(first.envId);
      expect(A.contains(secondDeploy, "DELETE Env")).toBe(false);
      expect(A.contains(secondDeploy, "POST Envs")).toBe(false);
      expect(O.getOrThrow(FakeVercel.env(first.envId)).type).toBe("sensitive");
      yield* stack.destroy();
    })
  );

  test.provider("keeps a valueFrom secret out of state and plans a rotation from its digest", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      yield* stack.destroy();
      const declare = stackWith("vt-env-value-from", {
        key: "HUBSPOT_TOKEN",
        valueFrom: { config: "VT_HUBSPOT_TOKEN" },
        targets: ["production"],
        type: "sensitive",
      });
      const created = yield* stack.deploy(declare).pipe(withConfig({ VT_HUBSPOT_TOKEN: "secret-from-env-one" }));
      expect(O.getOrThrow(FakeVercel.env(created.envId)).value).toBe("secret-from-env-one");
      expect(created.valueDigest).toMatch(/^[0-9a-f]{64}$/);
      const persisted = yield* persistedStrings;
      expect(A.some(persisted, Str.includes("secret-from-env-one"))).toBe(false);
      expect(A.contains(persisted, "VT_HUBSPOT_TOKEN")).toBe(true);

      const before = A.length(FakeVercel.requestsFor(created.projectId));
      const unchanged = yield* stack.deploy(declare).pipe(withConfig({ VT_HUBSPOT_TOKEN: "secret-from-env-one" }));
      expect(unchanged.valueDigest).toBe(created.valueDigest);
      expect(A.contains(A.drop(FakeVercel.requestsFor(created.projectId), before), "PATCH Env")).toBe(false);

      const rotated = yield* stack.deploy(declare).pipe(withConfig({ VT_HUBSPOT_TOKEN: "secret-from-env-two" }));
      expect(rotated.envId).toBe(created.envId);
      expect(rotated.valueDigest).not.toBe(created.valueDigest);
      expect(O.getOrThrow(FakeVercel.env(created.envId)).value).toBe("secret-from-env-two");
      const afterRotation = yield* persistedStrings;
      expect(A.some(afterRotation, Str.includes("secret-from-env-two"))).toBe(false);
      yield* stack.destroy();
    })
  );

  test.provider("fails when a variable declares neither value nor valueFrom", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      yield* stack.destroy();
      const refused = yield* Effect.exit(
        stack.deploy(stackWith("vt-env-no-value", { key: "EMPTY", targets: ["production"] }))
      );
      expect(failureTag(refused)).toEqual(O.some("EnvVarValueMissing"));
      yield* stack.destroy();
    })
  );

  test.provider("fails when Vercel keeps a weaker type than declared", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      yield* stack.destroy();
      FakeVercel.storeTypeAs("WEAK_POLICY_VAR", "encrypted");
      const refused = yield* Effect.exit(
        stack.deploy(
          stackWith("vt-env-weaker", {
            key: "WEAK_POLICY_VAR",
            value: Redacted.make("v"),
            targets: ["production"],
            type: "sensitive",
          })
        )
      );
      expect(failureTag(refused)).toEqual(O.some("EnvVarTypeNotApplied"));
      yield* stack.destroy();
    })
  );
});
