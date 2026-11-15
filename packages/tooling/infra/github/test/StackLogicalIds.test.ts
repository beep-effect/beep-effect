import * as Test from "@alchemy.run/test/Vitest";
import { EnvironmentSpec, LabelSpec, StackConfig, VariableSpec } from "@beep/infra-github/Config";
import { productionConfig } from "@beep/infra-github/Production";
import { declarations, declareStack, findDuplicateLogicalId } from "@beep/infra-github/Stack";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import { FakeRepository, fakeProviders } from "./support/FakeGitHub.ts";
import { typed } from "./support/Scratch.ts";

const label = (name: string) => LabelSpec.make({ name, color: "ffffff", description: O.none() });
const environment = (name: string, variables: ReadonlyArray<string> = []) =>
  EnvironmentSpec.make({
    name,
    branches: ["main"],
    variables: A.map(variables, (variable) => VariableSpec.make({ name: variable, value: "x" })),
  });
const config = (overrides: Partial<Pick<StackConfig, "labels" | "environments" | "variables">>) =>
  StackConfig.make({ ...productionConfig, labels: [], environments: [], variables: [], ...overrides });

/** The collision `findDuplicateLogicalId` reports, as plain fields. */
const collision = (stack: StackConfig) =>
  O.map(findDuplicateLogicalId(stack), ({ kind, logicalId, first, second }) => ({ kind, logicalId, first, second }));

describe("declareStack refuses two config names that derive one logical id", () => {
  it("passes the production configuration: no collision, every derived id distinct", () => {
    assertNone(findDuplicateLogicalId(productionConfig));
    const ids = A.map(declarations(productionConfig), (entry) => entry.logicalId);
    deepStrictEqual(A.dedupe(ids), ids);
  });

  it("names both labels that fold to one fragment", () => {
    assertSome(collision(config({ labels: [label("size/L"), label("size-L")] })), {
      kind: "label",
      logicalId: "Label-size-L",
      first: "size/L",
      second: "size-L",
    });
  });

  it("names both environments that fold to one fragment", () => {
    assertSome(collision(config({ environments: [environment("deploy prod"), environment("deploy-prod")] })), {
      kind: "environment",
      logicalId: "Environment-deploy-prod",
      first: "deploy prod",
      second: "deploy-prod",
    });
  });

  it("catches names equal up to case, which GitHub resolves to one object", () => {
    assertSome(collision(config({ labels: [label("Bug"), label("bug")] })), {
      kind: "label",
      logicalId: "Label-bug",
      first: "Bug",
      second: "bug",
    });
    assertSome(
      collision(
        config({
          variables: [
            VariableSpec.make({ name: "MY_VAR", value: "1" }),
            VariableSpec.make({ name: "my_var", value: "2" }),
          ],
        })
      ),
      { kind: "variable", logicalId: "Variable-my_var", first: "MY_VAR", second: "my_var" }
    );
    assertSome(collision(config({ environments: [environment("Staging"), environment("staging")] })), {
      kind: "environment",
      logicalId: "Environment-staging",
      first: "Staging",
      second: "staging",
    });
  });

  it("catches environment variables whose environment and variable names split differently", () => {
    assertSome(collision(config({ environments: [environment("a-b", ["c"]), environment("a", ["b-c"])] })), {
      kind: "environment variable",
      logicalId: "EnvironmentVariable-a-b-c",
      first: "a-b/c",
      second: "a/b-c",
    });
  });
});

{
  const fake = FakeRepository.fromCensus();
  const { test } = Test.make({ providers: fakeProviders(fake), stage: "test" });
  test.provider("a colliding configuration declares nothing: the plan dies and no request is sent", (scratch) =>
    Effect.gen(function* () {
      const colliding = StackConfig.make({
        ...productionConfig,
        labels: [...productionConfig.labels, label("size-L")],
      });
      const exit = yield* Effect.exit(typed(scratch).plan(declareStack(colliding, O.none())));
      const text = Exit.match(exit, { onSuccess: () => "", onFailure: Cause.pretty });
      expect(text).toContain("DuplicateLogicalId");
      expect(text).toContain('label "size/L" and "size-L" both derive Label-size-L');
      expect(fake.calls).toEqual([]);
    })
  );
}
