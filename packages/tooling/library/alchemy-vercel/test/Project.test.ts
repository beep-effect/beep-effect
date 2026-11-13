import * as Vercel from "@beep/alchemy-vercel";
import { describe, expect } from "@effect/vitest";
import { adopt, Unowned } from "alchemy/AdoptPolicy";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { FakeVercel, TEAM_ID } from "./harness/FakeVercel.ts";
import { failureTag, makeHarness, typed } from "./harness/Harness.ts";
import { projectRead } from "./harness/Readers.ts";

const { test } = makeHarness();

const webProps = (name: string) =>
  ({
    name,
    teamId: TEAM_ID,
    framework: "nextjs",
    buildCommand: "cd ../.. && bun run --cwd apps/oip-web build:pwa",
    installCommand: "cd ../.. && bun install",
    rootDirectory: "apps/oip-web",
    gitRepository: { type: "github", repo: "acme/oip" },
    deploymentProtection: "none",
    nodeVersion: "22.x",
    autoExposeSystemEnvs: true,
  }) as const;

describe("Vercel.Project", () => {
  test.provider("creates, updates and deletes a project", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      yield* stack.destroy();
      const created = yield* stack.deploy(Vercel.Project("Web", webProps("vt-project-crud")));
      expect(created.name).toBe("vt-project-crud");
      expect(created.accountId).toBe(TEAM_ID);
      expect(created.deploymentProtection).toBe("none");
      expect(created.link).toEqual({ type: "github", repo: "acme/oip", productionBranch: "main" });
      const record = O.getOrThrow(FakeVercel.project(created.projectId));
      expect(record.ssoProtection).toBeNull();
      expect(record.nodeVersion).toBe("22.x");
      expect(record.autoExposeSystemEnvs).toBe(true);

      const updated = yield* stack.deploy(
        Vercel.Project("Web", {
          ...webProps("vt-project-crud"),
          buildCommand: "bun run build",
          nodeVersion: "24.x",
          deploymentProtection: "preview",
        })
      );
      expect(updated.projectId).toBe(created.projectId);
      expect(updated.buildCommand).toBe("bun run build");
      expect(updated.nodeVersion).toBe("24.x");
      expect(updated.deploymentProtection).toBe("preview");

      yield* stack.destroy();
      expect(O.isNone(FakeVercel.project(created.projectId))).toBe(true);
    })
  );

  test.provider("replaces the project when its git repository changes", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      yield* stack.destroy();
      const first = yield* stack.deploy(Vercel.Project("Web", webProps("vt-project-replace")));
      const second = yield* stack.deploy(
        Vercel.Project("Web", {
          ...webProps("vt-project-replace"),
          gitRepository: { type: "github", repo: "acme/other" },
        })
      );
      expect(second.projectId).not.toBe(first.projectId);
      expect(O.isNone(FakeVercel.project(first.projectId))).toBe(true);
      expect(second.link?.repo).toBe("acme/other");
      yield* stack.destroy();
    })
  );

  test.provider("reads an owned project plainly and a foreign one as unowned", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      yield* stack.destroy();
      const props = webProps("vt-project-read");
      const deployed = yield* stack.deploy(Vercel.Project("Web", props));
      const read = yield* projectRead;
      const input = { id: "Web", fqn: "Web", instanceId: "00", olds: props };

      const owned = yield* read({ ...input, output: deployed });
      expect(owned?.projectId).toBe(deployed.projectId);
      expect(Unowned.is(owned)).toBe(false);

      const foreign = yield* read({ ...input, output: undefined });
      expect(foreign?.projectId).toBe(deployed.projectId);
      expect(Unowned.is(foreign)).toBe(true);

      const missing = yield* read({ ...input, olds: { ...props, name: "vt-project-absent" }, output: undefined });
      expect(missing).toBeUndefined();
      yield* stack.destroy();
    })
  );

  test.provider("adopts an existing project only under adopt(true)", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      yield* stack.destroy();
      const seeded = FakeVercel.seedProject("vt-project-adopt");

      const refused = yield* Effect.exit(stack.deploy(Vercel.Project("Web", webProps("vt-project-adopt"))));
      expect(failureTag(refused)).toEqual(O.some("OwnedBySomeoneElse"));

      const adopted = yield* stack.deploy(Vercel.Project("Web", webProps("vt-project-adopt")).pipe(adopt(true)));
      expect(adopted.projectId).toBe(seeded.id);
      expect(adopted.framework).toBe("nextjs");
      expect(adopted.rootDirectory).toBe("apps/oip-web");
      yield* stack.destroy();
      expect(O.isNone(FakeVercel.project(seeded.id))).toBe(true);
    })
  );
});
