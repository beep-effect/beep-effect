import * as GitHub from "@alchemy.run/github";
import * as Test from "@alchemy.run/test/Vitest";
import { productionConfig } from "@beep/infra-github/Production";
import { decodeLiveRuleset, liveReviewerCheck } from "@beep/infra-github/RulesetGuard";
import { guardedRulesetProvider } from "@beep/infra-github/RulesetWriteGuard";
import { declareStack } from "@beep/infra-github/Stack";
import { atRegistration } from "@beep/test-utils/Registration";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { FakeRepository, fakeProviders } from "./support/FakeGitHub.ts";
import { typed } from "./support/Scratch.ts";
import type { RequiredCheck } from "@beep/infra-github/Config";
import type { TypedScratch } from "./support/Scratch.ts";

type Rule = { readonly type: string; readonly parameters?: Record<string, unknown> };

const MAIN = 10_240_248;
const reviewer = { context: "beep-reviewer", integration_id: 5_321_138 };

const setReviewerLive = (fake: FakeRepository, present: boolean) => {
  const live = fake.ruleset(MAIN);
  MutableHashMap.set(fake.rulesets, MAIN, {
    ...live,
    rules: A.map(live.rules as ReadonlyArray<Rule>, (rule) => {
      if (rule.type !== "required_status_checks") return rule;
      const checks = A.filter(
        (rule.parameters?.required_status_checks ?? []) as ReadonlyArray<{ context: string }>,
        (check) => check.context !== "beep-reviewer"
      );
      return {
        ...rule,
        parameters: { ...rule.parameters, required_status_checks: present ? [...checks, reviewer] : checks },
      };
    }),
  });
};

const writesToMain = (fake: FakeRepository) =>
  A.filter(fake.writes(), (call) => Str.endsWith(`/rulesets/${MAIN}`)(call.path));

const scenario = (
  name: string,
  beforeCapture: (fake: FakeRepository) => void,
  afterCapture: (fake: FakeRepository) => void,
  body: (stack: TypedScratch, fake: FakeRepository, carried: O.Option<RequiredCheck>) => Effect.Effect<void>
) => {
  const fake = FakeRepository.fromCensus();
  beforeCapture(fake);
  const capture = atRegistration(decodeLiveRuleset(fake.ruleset(MAIN)));
  const providers = guardedRulesetProvider(capture).pipe(Layer.provideMerge(fakeProviders(fake)));
  const { test } = Test.make({ providers, stage: "test" });
  test.provider(name, (stack) =>
    Effect.gen(function* () {
      afterCapture(fake);
      yield* body(typed(stack), fake, liveReviewerCheck(capture));
    })
  );
  return capture;
};

const deploy = (stack: TypedScratch, carried: O.Option<RequiredCheck>) =>
  Effect.exit(stack.deploy(declareStack(productionConfig, carried)));

const refusalTag = <A, E>(exit: Exit.Exit<A, E>) =>
  Exit.match(exit, {
    onSuccess: () => "success",
    onFailure: (cause) =>
      cause.pipe(Cause.pretty, Str.includes("RulesetChangedSinceCapture")) ? "refused" : Cause.pretty(cause),
  });

scenario(
  "the write goes through when the live ruleset still equals the capture",
  () => undefined,
  () => undefined,
  (stack, fake, carried) =>
    Effect.gen(function* () {
      const exit = yield* deploy(stack, carried);
      expect(refusalTag(exit)).toBe("success");
      expect(A.map(writesToMain(fake), (call) => call.method)).toEqual(["PUT"]);
    })
);

scenario(
  "a reviewer required after the capture refuses the write and sends no PUT",
  () => undefined,
  (fake) => setReviewerLive(fake, true),
  (stack, fake, carried) =>
    Effect.gen(function* () {
      const exit = yield* deploy(stack, carried);
      expect(refusalTag(exit)).toBe("refused");
      expect(writesToMain(fake)).toEqual([]);
    })
);

scenario(
  "a reviewer released after the capture refuses the write and sends no PUT",
  (fake) => setReviewerLive(fake, true),
  (fake) => setReviewerLive(fake, false),
  (stack, fake, carried) =>
    Effect.gen(function* () {
      expect(O.isSome(carried)).toBe(true);
      const exit = yield* deploy(stack, carried);
      expect(refusalTag(exit)).toBe("refused");
      expect(writesToMain(fake)).toEqual([]);
    })
);

{
  const fake = FakeRepository.fromCensus();
  const { id: _id, ...withoutId } = fake.ruleset(MAIN);
  const capture = atRegistration(decodeLiveRuleset(withoutId));
  const providers = guardedRulesetProvider(capture).pipe(Layer.provideMerge(fakeProviders(fake)));
  const { test } = Test.make({ providers, stage: "test" });
  test.provider("a capture without an id cannot be re-read, so the deploy fails closed before any write", (scratch) =>
    Effect.gen(function* () {
      const exit = yield* deploy(typed(scratch), liveReviewerCheck(capture));
      const message = Exit.match(exit, { onSuccess: () => "deployed", onFailure: Cause.pretty });
      expect(Str.includes("CaptureWithoutId")(message)).toBe(true);
      expect(writesToMain(fake)).toEqual([]);
    })
  );
}

{
  const fake = FakeRepository.fromCensus();
  const capture = atRegistration(decodeLiveRuleset(fake.ruleset(MAIN)));
  const providers = guardedRulesetProvider(capture).pipe(Layer.provideMerge(fakeProviders(fake)));
  const { test } = Test.make({ providers, stage: "test" });
  test.provider(
    "a ruleset with another name goes straight to the shipped provider, with no re-read of 10240248",
    (scratch) =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(
          typed(scratch).deploy(
            GitHub.Ruleset("Other", {
              owner: "beep-effect",
              repository: "beep-effect",
              name: "other",
              conditions: { include: ["refs/heads/other"] },
            })
          )
        );
        expect(exit._tag).toBe("Success");
        expect(
          A.filter(fake.calls, (call) => call.method === "GET" && Str.endsWith(`/rulesets/${MAIN}`)(call.path))
        ).toEqual([]);
      })
  );
}

{
  const fake = FakeRepository.fromCensus();
  const capture = atRegistration(decodeLiveRuleset(fake.ruleset(MAIN)));
  const providers = guardedRulesetProvider(capture).pipe(Layer.provideMerge(fakeProviders(fake)));
  const { test } = Test.make({ providers, stage: "test" });
  test.provider(
    "a missed name-based read plans a create that would POST a second ruleset; it is refused and nothing is sent",
    (scratch) =>
      Effect.gen(function* () {
        MutableHashMap.set(fake.rulesets, MAIN, { ...fake.ruleset(MAIN), name: "main-renamed" });
        fake.calls.length = 0;
        const exit = yield* deploy(typed(scratch), liveReviewerCheck(capture));
        const message = Exit.match(exit, { onSuccess: () => "deployed", onFailure: Cause.pretty });
        expect(Str.includes("RulesetTargetIsNotTheCapture")(message)).toBe(true);
        expect(A.filter(fake.writes(), (call) => Str.includes("/rulesets")(call.path))).toEqual([]);
      })
  );
}
