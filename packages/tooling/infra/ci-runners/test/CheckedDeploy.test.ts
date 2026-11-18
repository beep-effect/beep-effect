import {
  applyIfUnchanged,
  CheckedPlan,
  CheckedPlanJson,
  CheckedResource,
  checkEnginePlan,
  planDifferences,
  readEnginePlan,
} from "@beep/infra-ci-runners/CheckedDeploy";
import { program } from "@beep/infra-ci-runners/CiRunners";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Fakes from "./support/Fakes.ts";

const productionEnvironment = Effect.provideService(
  ConfigProvider.ConfigProvider,
  ConfigProvider.fromUnknown({
    CI: "true",
    CI_RUNNERS_GITHUB_APP_ID: "12345",
    CI_RUNNERS_GITHUB_APP_KEY_BASE64: "a2V5",
    CI_RUNNERS_GITHUB_WEBHOOK_SECRET: "webhook-secret",
  })
);

const production = program.pipe(productionEnvironment);

// A pure stand-in digest (hex of the input): deterministic, and distinct inputs stay distinct.
const hexDigest = Digest.Digest.of({
  digest: Effect.fnUntraced(function* (_algorithm: Digest.Algorithm, data: Uint8Array) {
    return data;
  }),
  digestHex: Effect.fnUntraced(function* (_algorithm: Digest.Algorithm, data: Uint8Array) {
    return Hex.encode(data);
  }),
});

const planOf = (stack: Fakes.TypedStack) =>
  stack.plan(production).pipe(
    Effect.flatMap((plan) => readEnginePlan("prod", plan)),
    Effect.provideService(Digest.Digest, hexDigest)
  );

// The outcome's tag, so a refusal and a success compare alike.
const outcomeOf = <E extends { readonly _tag: string }, R>(effect: Effect.Effect<string, E, R>) =>
  Effect.match(effect, { onFailure: (error) => error._tag, onSuccess: (value) => value });

// The apply stand-in: it records that it ran, so a refusal proves nothing was written.
const recordingWrite = (written: Ref.Ref<boolean>) => Ref.set(written, true).pipe(Effect.as("applied"));

const resource = (fqn: string, overrides: Partial<CheckedResource> = {}) =>
  CheckedResource.make({ fqn, type: "EC2.Vpc", action: "create", bindings: [], propsDigest: "d1", ...overrides });

const planWith = (...resources: ReadonlyArray<CheckedResource>) =>
  CheckedPlan.make({ stage: "prod", resources, actions: [] });

describe("CiRunners checked deploy", () => {
  const stable = Fakes.harness({ stage: "prod" });
  stable.provider("reads the same checked plan from two plans of one state, and it passes the check", (stack) =>
    Effect.gen(function* () {
      const first = yield* planOf(stack);
      const second = yield* planOf(stack);
      expect(planDifferences(first, second)).toStrictEqual({ added: [], removed: [], changed: [] });
      const resources = yield* checkEnginePlan(first);
      assertTrue(A.isReadonlyArrayNonEmpty(resources));
      assertTrue(A.every(first.resources, (row) => row.action === "create"));
      const text = yield* S.encodeEffect(CheckedPlanJson)(first);
      const decoded = yield* S.decodeEffect(CheckedPlanJson)(text);
      expect(decoded).toStrictEqual(first);
    })
  );

  const moved = Fakes.harness({ stage: "prod" });
  moved.provider("refuses before any write when the state moved between the check and the deploy", (stack) =>
    Effect.gen(function* () {
      const checked = yield* planOf(stack);
      yield* stack.deploy(production);
      const current = yield* planOf(stack);
      const written = yield* Ref.make(false);
      const outcome = yield* outcomeOf(applyIfUnchanged(checked, current, recordingWrite(written)));
      expect(outcome).toBe("PlanDrift");
      const wrote = yield* Ref.get(written);
      assertFalse(wrote);
    })
  );

  it.effect("applies an unchanged plan and refuses every simulated drift with nothing written", () =>
    Effect.gen(function* () {
      const checked = planWith(resource("Vpc"), resource("Reaper"));
      const written = yield* Ref.make(false);
      const applied = yield* applyIfUnchanged(checked, checked, recordingWrite(written));
      expect(applied).toBe("applied");
      const wrote = yield* Ref.get(written);
      assertTrue(wrote);

      const drifts = [
        planWith(resource("Vpc"), resource("Reaper"), resource("FlowLog")),
        planWith(resource("Vpc")),
        planWith(resource("Vpc", { propsDigest: "d2" }), resource("Reaper")),
        planWith(resource("Vpc", { action: "update" }), resource("Reaper")),
        planWith(resource("Vpc", { bindings: ["Vpc/Grant create"] }), resource("Reaper")),
        CheckedPlan.make({ stage: "dev-alice", resources: checked.resources, actions: [] }),
      ];
      const differences = A.map(drifts, (current) => planDifferences(checked, current));
      expect(differences).toStrictEqual([
        { added: ["FlowLog"], removed: [], changed: [] },
        { added: [], removed: ["Reaper"], changed: [] },
        { added: [], removed: [], changed: ["Vpc"] },
        { added: [], removed: [], changed: ["Vpc"] },
        { added: [], removed: [], changed: ["Vpc"] },
        { added: [], removed: [], changed: ["stage"] },
      ]);
      const untouched = yield* Ref.make(false);
      const tags = yield* Effect.forEach(
        drifts,
        (current) => outcomeOf(applyIfUnchanged(checked, current, recordingWrite(untouched))),
        { concurrency: 1 }
      );
      expect(tags).toStrictEqual(A.replicate("PlanDrift", drifts.length));
      const touched = yield* Ref.get(untouched);
      assertFalse(touched);
    })
  );

  it.effect("refuses a deploy plan that fails the plan check even when it equals the checked plan", () =>
    Effect.gen(function* () {
      const replaced = planWith(resource("Vpc", { action: "replace" }));
      const unbound = planWith(resource("Reaper", { bindings: ["Reaper/Reaper unbind"] }));
      const acting = CheckedPlan.make({ stage: "prod", resources: [], actions: [{ fqn: "Seed", action: "run" }] });
      const written = yield* Ref.make(false);
      const tags = yield* Effect.forEach(
        [replaced, unbound, acting],
        (plan) => outcomeOf(applyIfUnchanged(plan, plan, recordingWrite(written))),
        { concurrency: 1 }
      );
      expect(tags).toStrictEqual(["PlanRefused", "PlanRefused", "PlanRefused"]);
      const wrote = yield* Ref.get(written);
      assertFalse(wrote);
    })
  );
});
