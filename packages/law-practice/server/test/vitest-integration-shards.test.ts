import { it } from "@beep/test-runner";
import { NodePath } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { LawPracticeSequencer } from "../vitest.integration.sequencer.ts";
import integrationPlan from "../vitest.integration.shards.json" with { type: "json" };
import unitPlan from "../vitest.shards.json" with { type: "json" };
import type { TestSpecification } from "vitest/node";

const integrationFiles = R.keys(
  import.meta.glob<string>("./integration/*.test.ts", { eager: true, import: "default", query: "?raw" })
);
const plannedSeconds: Readonly<Record<string, number>> = integrationPlan.fileSeconds;

it("plans every checked-in integration file in exactly one shard, so plan drift cannot silently unbalance the partitions", () => {
  const onDisk = A.sort(
    A.map(integrationFiles, (file) => `test/${Str.slice(Str.length("./"))(file)}`),
    Str.Order
  );
  const planned = A.sort(A.flatten(integrationPlan.shards), Str.Order);

  expect(A.length(integrationPlan.shards)).toBeGreaterThanOrEqual(2);
  for (const shard of integrationPlan.shards) {
    expect(A.isReadonlyArrayNonEmpty(shard)).toBe(true);
  }
  expect(planned).toEqual(A.dedupe(planned));
  expect(planned, "vitest.integration.shards.json drifted from test/integration; regenerate the plan").toEqual(onDisk);
  expect(A.sort(R.keys(integrationPlan.fileSeconds), Str.Order)).toEqual(planned);
  expect(A.length(integrationPlan.shardSeconds)).toBe(A.length(integrationPlan.shards));
});

it.layer(NodePath.layer)(
  "integration shard plan, proved through the sequencer the hosted lps-int-N partitions run",
  (it) => {
    it.effect("assigns every shard its planned files, heaviest first, and places an unplanned file once", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const root = yield* path.fromFileUrl(new URL("../", import.meta.url));
        const count = A.length(integrationPlan.shards);
        const moduleIdOnlySpecification = (file: string) =>
          ({ moduleId: path.join(root, file) }) as unknown as TestSpecification;
        const relative = (specification: { readonly moduleId: string }) =>
          Str.replaceAll(path.sep, "/")(path.relative(root, specification.moduleId));
        const planned = A.map(A.flatten(integrationPlan.shards), moduleIdOnlySpecification);
        const unplanned = moduleIdOnlySpecification("test/integration/CitationUnplanned.test.ts");
        const sequencer = (index: number) =>
          new LawPracticeSequencer({
            config: { root, shard: { index, count } },
          } as unknown as ConstructorParameters<typeof LawPracticeSequencer>[0]);
        let unplannedPlacements = 0;
        for (const index of A.range(1, count)) {
          const assigned = yield* Effect.promise(() => sequencer(index).shard([...planned, unplanned]));
          const files = A.map(assigned, relative);
          unplannedPlacements += A.length(A.filter(files, (file) => file === relative(unplanned)));
          expect(
            A.sort(
              A.filter(files, (file) => file !== relative(unplanned)),
              Str.Order
            )
          ).toEqual(A.sort(integrationPlan.shards[index - 1] ?? [], Str.Order));
          const ordered = yield* Effect.promise(() => sequencer(index).sort(A.map(assigned, (entry) => entry)));
          const seconds = A.map(ordered, (entry) => R.get(plannedSeconds, relative(entry)));
          expect(seconds, "unmeasured files first, then measured seconds descending").toEqual(
            A.sort(
              seconds,
              Order.mapInput(
                Order.Number,
                (weight: O.Option<number>) => -O.getOrElse(weight, () => Number.POSITIVE_INFINITY)
              )
            )
          );
        }
        expect(unplannedPlacements).toBe(1);
      })
    );

    it.effect("falls through to the unit plan for the hosted law-practice-N Test Unit shard count", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const root = yield* path.fromFileUrl(new URL("../", import.meta.url));
        const count = A.length(unitPlan.shards);
        const specification = (file: string) => ({ moduleId: path.join(root, file) }) as unknown as TestSpecification;
        const relative = (specification: { readonly moduleId: string }) =>
          Str.replaceAll(path.sep, "/")(path.relative(root, specification.moduleId));
        const planned = A.map(A.flatten(unitPlan.shards), specification);
        expect(count).not.toBe(A.length(integrationPlan.shards));
        for (const index of A.range(1, count)) {
          const sequencer = new LawPracticeSequencer({
            config: { root, shard: { index, count } },
          } as unknown as ConstructorParameters<typeof LawPracticeSequencer>[0]);
          const assigned = yield* Effect.promise(() => sequencer.shard([...planned]));
          expect(A.sort(A.map(assigned, relative), Str.Order)).toEqual(
            A.sort(unitPlan.shards[index - 1] ?? [], Str.Order)
          );
        }
      })
    );
  }
);
