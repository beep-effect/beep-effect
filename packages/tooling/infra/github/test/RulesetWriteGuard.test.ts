import * as Test from "@alchemy.run/test/Vitest";
import { productionConfig } from "@beep/infra-github/Production";
import { decodeLiveRuleset, liveReviewerCheck } from "@beep/infra-github/RulesetGuard";
import { guardedRulesetProvider } from "@beep/infra-github/RulesetWriteGuard";
import { declareStack } from "@beep/infra-github/Stack";
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

/** Sets the live reviewer check the way `beep reviewer ruleset require|release --apply` would. */
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

/**
 * One scenario against its own fake, with the write guard built from a capture
 * taken after `before` ran; `between` then runs before the deploy writes.
 */
const scenario = (
  name: string,
  before: (fake: FakeRepository) => void,
  between: (fake: FakeRepository) => void,
  body: (stack: TypedScratch, fake: FakeRepository, carried: O.Option<RequiredCheck>) => Effect.Effect<void>
) => {
  const fake = FakeRepository.fromCensus();
  before(fake);
  const capture = Effect.runSync(decodeLiveRuleset(fake.ruleset(MAIN)));
  const providers = guardedRulesetProvider(capture).pipe(Layer.provideMerge(fakeProviders(fake)));
  const { test } = Test.make({ providers, stage: "test" });
  test.provider(name, (stack) =>
    Effect.gen(function* () {
      between(fake);
      yield* body(typed(stack), fake, liveReviewerCheck(capture));
    })
  );
  return capture;
};

/** The deploy as the workflow runs it: the body carries the reviewer read from the capture. */
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
