import * as Vercel from "@beep/alchemy-vercel";
import { describe, expect } from "@effect/vitest";
import { adopt, Unowned } from "alchemy/AdoptPolicy";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import { FakeVercel, TEAM_ID } from "./harness/FakeVercel.ts";
import { failureTag, makeHarness, typed } from "./harness/Harness.ts";
import { envVarRead } from "./harness/Readers.ts";

const { test } = makeHarness();

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
});
