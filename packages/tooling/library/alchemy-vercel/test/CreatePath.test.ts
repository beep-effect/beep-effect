import * as Vercel from "@beep/alchemy-vercel";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import { adopt } from "alchemy/AdoptPolicy";
import { formatPlanLines } from "alchemy/Cli/LoggingCli";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Str from "effect/String";
import { FakeVercel, TEAM_ID } from "./harness/FakeVercel.ts";
import { dropStateRow, failureTag, makeHarness, typed } from "./harness/Harness.ts";

// The create path: a domain or variable whose `project` prop is another resource's output is not
// resolved when the plan is made, so the engine cannot read it for adoption and plans `create`.
// A stack that adopts a live project (OipWeb) takes this path for every domain and variable on
// it. These tests pin what the real providers then do to the objects that already exist.

const { test } = makeHarness();

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

/** The plan's resource lines without color codes: `[Domain] create`. */
const planLines = (plan: Parameters<typeof formatPlanLines>[0]) => A.map(formatPlanLines(plan), Str.replace(ANSI, ""));

/** Requests that change something: everything but reads. */
const mutating = (calls: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.filter(calls, (call) => !Str.startsWith("GET ")(call));

const withConfig =
  (values: Record<string, string>) =>
  <X, E, R>(effect: Effect.Effect<X, E, R>): Effect.Effect<X, E, R> =>
    Effect.provideService(effect, ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(values));

describe("the create path onto existing objects", { concurrent: false }, () => {
  test.provider("Vercel.Domain makes no mutating request for a domain already on the target project", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      yield* stack.destroy();
      const live = FakeVercel.seedProject("vt-create-path-domain");
      FakeVercel.seedDomain("create-path.test", live.id);
      const declare = Effect.fn("declare")(function* (owned: boolean) {
        const project = yield* Vercel.Project("Web", { name: "vt-create-path-domain", teamId: TEAM_ID }).pipe(
          adopt(true)
        );
        return yield* Vercel.Domain("Domain", {
          project: project.projectId,
          teamId: TEAM_ID,
          name: "create-path.test",
        }).pipe(adopt(owned));
      });

      const plan = yield* stack.plan(declare(true));
      expect(planLines(plan)).toContain("[Domain] create");

      // Without adopt(true) the apply refuses the existing domain instead of taking it over.
      const start = A.length(FakeVercel.requestsFor(live.id));
      const refused = yield* Effect.exit(stack.deploy(declare(false)));
      assertSome(failureTag(refused), "OwnedBySomeoneElse");
      expect(
        A.filter(mutating(A.drop(FakeVercel.requestsFor(live.id), start)), (call) =>
          /Domain|Domains|Move|Verify/.test(call)
        )
      ).toEqual([]);

      const before = A.length(FakeVercel.requestsFor(live.id));
      yield* stack.deploy(declare(true));
      const calls = A.drop(FakeVercel.requestsFor(live.id), before);
      expect(A.filter(mutating(calls), (call) => /Domain|Domains|Move|Verify/.test(call))).toEqual([]);
      expect(O.getOrThrow(FakeVercel.domain("create-path.test")).projectId).toBe(live.id);
    })
  );

  test.provider(
    "Vercel.EnvVar writes an existing literal variable once, in place, and never duplicates it",
    (scratch) =>
      Effect.gen(function* () {
        const stack = typed(scratch);
        yield* stack.destroy();
        const live = FakeVercel.seedProject("vt-create-path-env");
        const seeded = FakeVercel.seedEnv({
          projectId: live.id,
          key: "NEXT_DISABLE_PWA",
          value: "0",
          type: "encrypted",
          target: ["preview", "production"],
        });
        const declare = Effect.gen(function* () {
          const project = yield* Vercel.Project("Web", { name: "vt-create-path-env", teamId: TEAM_ID }).pipe(
            adopt(true)
          );
          return yield* Vercel.EnvVar("Env", {
            project: project.projectId,
            teamId: TEAM_ID,
            key: "NEXT_DISABLE_PWA",
            value: Redacted.make("0"),
            targets: ["production", "preview"],
            type: "encrypted",
          }).pipe(adopt(true));
        });

        const plan = yield* stack.plan(declare);
        expect(planLines(plan)).toContain("[Env] create");

        const before = A.length(FakeVercel.requestsFor(live.id));
        const env = yield* stack.deploy(declare);
        const calls = A.drop(FakeVercel.requestsFor(live.id), before);
        expect(mutating(calls)).toEqual(["PATCH Env"]);
        expect(FakeVercel.envPatchFieldsFor(live.id)).toEqual([["value"]]);
        expect(env.envId).toBe(seeded.id);
        const stored = A.filter(FakeVercel.envsOf(live.id), (record) => record.key === "NEXT_DISABLE_PWA");
        expect(
          A.map(stored, (record) => [record.id, record.value, record.type, A.sort(record.target, Str.Order)])
        ).toEqual([[seeded.id, "0", "encrypted", ["preview", "production"]]]);
      })
  );

  test.provider(
    "Vercel.EnvVar writes an existing sensitive valueFrom variable once, in place, and never duplicates it",
    (scratch) =>
      Effect.gen(function* () {
        const stack = typed(scratch);
        yield* stack.destroy();
        const live = FakeVercel.seedProject("vt-create-path-secret");
        const seeded = FakeVercel.seedEnv({
          projectId: live.id,
          key: "CRM_HUBSPOT_SERVICE_KEY",
          value: "live-token",
          type: "sensitive",
          target: ["production"],
        });
        const declare = Effect.gen(function* () {
          const project = yield* Vercel.Project("Web", { name: "vt-create-path-secret", teamId: TEAM_ID }).pipe(
            adopt(true)
          );
          return yield* Vercel.EnvVar("Secret", {
            project: project.projectId,
            teamId: TEAM_ID,
            key: "CRM_HUBSPOT_SERVICE_KEY",
            valueFrom: { config: "VT_CREATE_PATH_TOKEN" },
            targets: ["production"],
            type: "sensitive",
          }).pipe(adopt(true));
        });
        const config = withConfig({ VT_CREATE_PATH_TOKEN: "live-token" });

        const plan = yield* stack.plan(declare).pipe(config);
        expect(planLines(plan)).toContain("[Secret] create");

        const before = A.length(FakeVercel.requestsFor(live.id));
        const env = yield* stack.deploy(declare).pipe(config);
        const calls = A.drop(FakeVercel.requestsFor(live.id), before);
        // The real API refuses any `key` on a sensitive variable (run 43585534113); the fake does too.
        expect(mutating(calls)).toEqual(["PATCH Env"]);
        expect(FakeVercel.envPatchFieldsFor(live.id)).toEqual([["value"]]);
        expect(env.envId).toBe(seeded.id);
        const stored = A.filter(FakeVercel.envsOf(live.id), (record) => record.key === "CRM_HUBSPOT_SERVICE_KEY");
        expect(A.map(stored, (record) => [record.id, record.value, record.type, record.target])).toEqual([
          [seeded.id, "live-token", "sensitive", ["production"]],
        ]);
      })
  );

  test.provider(
    "Vercel.EnvVar edits a sensitive variable's value and targets in place, without key or type",
    (scratch) =>
      Effect.gen(function* () {
        const stack = typed(scratch);
        yield* stack.destroy();
        const project = FakeVercel.seedProject("vt-sensitive-edit");
        const declare = (targets: A.NonEmptyReadonlyArray<"production" | "preview">) =>
          Vercel.EnvVar("Secret", {
            project: project.id,
            teamId: TEAM_ID,
            key: "VT_SENSITIVE_EDIT",
            valueFrom: { config: "VT_SENSITIVE_EDIT_TOKEN" },
            targets,
            type: "sensitive",
          });
        const created = yield* stack
          .deploy(declare(["production"]))
          .pipe(withConfig({ VT_SENSITIVE_EDIT_TOKEN: "one" }));
        const rotated = yield* stack
          .deploy(declare(["production"]))
          .pipe(withConfig({ VT_SENSITIVE_EDIT_TOKEN: "two" }));
        const retargeted = yield* stack
          .deploy(declare(["production", "preview"]))
          .pipe(withConfig({ VT_SENSITIVE_EDIT_TOKEN: "two" }));
        expect([rotated.envId, retargeted.envId]).toEqual([created.envId, created.envId]);
        expect(FakeVercel.envPatchFieldsFor(project.id)).toEqual([["value"], ["target", "value"]]);
        expect(A.filter(mutating(FakeVercel.requestsFor(project.id)), (call) => call === "DELETE Env")).toEqual([]);
        const stored = O.getOrThrow(FakeVercel.env(created.envId));
        expect([stored.value, stored.type, A.sort(stored.target, Str.Order)]).toEqual([
          "two",
          "sensitive",
          ["preview", "production"],
        ]);
      })
  );

  test.provider("Vercel.EnvVar replaces a renamed sensitive variable create-first", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      yield* stack.destroy();
      const project = FakeVercel.seedProject("vt-sensitive-rename");
      const declare = (key: string) =>
        Vercel.EnvVar("Secret", {
          project: project.id,
          teamId: TEAM_ID,
          key,
          value: Redacted.make("token"),
          targets: ["production"],
          type: "sensitive",
        });
      const envWrites = (from: number) =>
        A.filter(mutating(A.drop(FakeVercel.requestsFor(project.id), from)), (call) => / Envs?$/.test(call));
      const first = yield* stack.deploy(declare("VT_OLD_NAME"));
      const plan = yield* stack.plan(declare("VT_NEW_NAME"));
      expect(planLines(plan)).toContain("[Secret] replace");

      // A failed create leaves the old variable in place: nothing is deleted before the new one exists.
      const start = A.length(FakeVercel.requestsFor(project.id));
      FakeVercel.refuseEnvCreate("VT_NEW_NAME");
      const failed = yield* Effect.exit(stack.deploy(declare("VT_NEW_NAME")));
      FakeVercel.allowEnvCreate("VT_NEW_NAME");
      expect(Exit.isFailure(failed)).toBe(true);
      expect(envWrites(start)).not.toContain("DELETE Env");
      expect(A.map(FakeVercel.envsOf(project.id), (record) => [record.id, record.key])).toEqual([
        [first.envId, "VT_OLD_NAME"],
      ]);

      const before = A.length(FakeVercel.requestsFor(project.id));
      const renamed = yield* stack.deploy(declare("VT_NEW_NAME"));
      expect(envWrites(before)).toEqual(["POST Envs", "DELETE Env"]);
      expect(renamed.envId).not.toBe(first.envId);
      expect(FakeVercel.envPatchFieldsFor(project.id)).toEqual([]);
      expect(A.map(FakeVercel.envsOf(project.id), (record) => record.key)).toEqual(["VT_NEW_NAME"]);
    })
  );

  test.provider("Vercel.EnvVar still replaces a type change delete-first, after resolving the value", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      yield* stack.destroy();
      const project = FakeVercel.seedProject("vt-type-change");
      const declare = (type: "encrypted" | "sensitive") =>
        Vercel.EnvVar("Var", {
          project: project.id,
          teamId: TEAM_ID,
          key: "VT_TYPE_CHANGE",
          valueFrom: { config: "VT_TYPE_CHANGE_TOKEN" },
          targets: ["production"],
          type,
        });
      const envWrites = (from: number) =>
        A.filter(mutating(A.drop(FakeVercel.requestsFor(project.id), from)), (call) => / Envs?$/.test(call));
      const config = withConfig({ VT_TYPE_CHANGE_TOKEN: "token" });
      yield* stack.deploy(declare("encrypted")).pipe(config);

      // A missing `valueFrom` key fails the plan before the delete-first replacement deletes anything.
      const start = A.length(FakeVercel.requestsFor(project.id));
      const missing = yield* Effect.exit(stack.deploy(declare("sensitive")).pipe(withConfig({})));
      expect(Exit.isFailure(missing)).toBe(true);
      expect(mutating(A.drop(FakeVercel.requestsFor(project.id), start))).toEqual([]);

      const before = A.length(FakeVercel.requestsFor(project.id));
      yield* stack.deploy(declare("sensitive")).pipe(config);
      expect(envWrites(before)).toEqual(["DELETE Env", "POST Envs"]);
      expect(A.map(FakeVercel.envsOf(project.id), (record) => record.type)).toEqual(["sensitive"]);
    })
  );

  test.provider(
    "Vercel.EnvVar adopts a sensitive variable whose row is missing with one value-only edit, then plans no changes",
    (scratch) =>
      Effect.gen(function* () {
        // The staging re-run after run 43585534113: the project's row exists, the variable's does not.
        const stack = typed(scratch);
        yield* stack.destroy();
        const declare = Effect.gen(function* () {
          const project = yield* Vercel.Project("Web", { name: "vt-adopt-missing-row", teamId: TEAM_ID }).pipe(
            adopt(true)
          );
          return yield* Vercel.EnvVar("Secret", {
            project: project.projectId,
            teamId: TEAM_ID,
            key: "VT_ADOPT_MISSING_ROW",
            valueFrom: { config: "VT_ADOPT_MISSING_ROW_TOKEN" },
            targets: ["production"],
            type: "sensitive",
          }).pipe(adopt(true));
        });
        const config = withConfig({ VT_ADOPT_MISSING_ROW_TOKEN: "live-token" });
        const first = yield* stack.deploy(declare).pipe(config);
        yield* dropStateRow("Secret");
        const projectId = O.getOrThrow(FakeVercel.project("vt-adopt-missing-row")).id;
        const edits = A.length(FakeVercel.envPatchFieldsFor(projectId));

        const plan = yield* stack.plan(declare).pipe(config);
        expect(planLines(plan)).toContain("[Secret] adopted");
        const adopted = yield* stack.deploy(declare).pipe(config);
        expect(adopted.envId).toBe(first.envId);
        expect(A.drop(FakeVercel.envPatchFieldsFor(projectId), edits)).toEqual([["value"]]);
        const next = yield* stack.plan(declare).pipe(config);
        expect(planLines(next)).toContain("[Secret] noop");
      })
  );
});
