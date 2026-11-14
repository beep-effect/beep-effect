import * as Test from "@alchemy.run/test/Vitest";
import { productionConfig } from "@beep/infra-github/Production";
import { readOnlyGitHubProviders } from "@beep/infra-github/ReadOnlyProviders";
import { declareStack } from "@beep/infra-github/Stack";
import { expect } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { FakeRepository, fakeProviders } from "./support/FakeGitHub.ts";
import { typed } from "./support/Scratch.ts";

// A preview stage gets the read-only providers over the in-memory GitHub; the token is irrelevant.
const fake = FakeRepository.fromCensus();
const providers = readOnlyGitHubProviders("dev_x").pipe(Layer.provideMerge(fakeProviders(fake)));
const { test } = Test.make({ providers, stage: "dev_x" });

test.provider("a preview stage plans, but its deploy fails before any mutating request", (scratch) =>
  Effect.gen(function* () {
    const stack = typed(scratch);
    const plan = yield* Effect.exit(stack.plan(declareStack(productionConfig, O.none())));
    expect(plan._tag).toBe("Success");

    const deployed = yield* Effect.exit(stack.deploy(declareStack(productionConfig, O.none())));
    const message = Exit.match(deployed, { onSuccess: () => "deployed", onFailure: Cause.pretty });
    expect(Str.includes("PreviewStageIsReadOnly")(message)).toBe(true);
    expect(fake.writes()).toEqual([]);
  })
);
