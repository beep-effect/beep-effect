import * as Vercel from "@beep/alchemy-vercel";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import { adopt } from "alchemy/AdoptPolicy";
import { formatPlanLines } from "alchemy/Cli/LoggingCli";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Str from "effect/String";
import { FakeVercel, TEAM_ID } from "./harness/FakeVercel.ts";
import { failureTag, makeHarness, typed } from "./harness/Harness.ts";

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
        expect(mutating(calls)).toEqual(["PATCH Env"]);
        expect(env.envId).toBe(seeded.id);
        const stored = A.filter(FakeVercel.envsOf(live.id), (record) => record.key === "CRM_HUBSPOT_SERVICE_KEY");
        expect(A.map(stored, (record) => [record.id, record.value, record.type, record.target])).toEqual([
          [seeded.id, "live-token", "sensitive", ["production"]],
        ]);
      })
  );
});
