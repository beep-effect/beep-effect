import * as NodePath from "@effect/platform-node/NodePath";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { BaseSequencer } from "vitest/node";
import type { TestSpecification } from "vitest/node";

/**
 * The committed shape of a package's `vitest.shards.json`.
 *
 * **Details**
 *
 * `shards[i]` lists the package-relative test files hosted shard `i + 1` runs. The other fields
 * are provenance and the measured estimate behind the assignment; `beep ci partitions rebalance`
 * owns them and the sequencer reads only `shards`.
 *
 * **Example** (A two-shard plan)
 *
 * ```ts
 * import type { MeasuredShardPlan } from "./vitest.sequencer.ts"
 * const plan: MeasuredShardPlan = { shards: [["test/a.test.ts"], ["test/b.test.ts"]] }
 * ```
 */
export interface MeasuredShardPlan {
  readonly shards: ReadonlyArray<ReadonlyArray<string>>;
}

/**
 * Find the one-based shard a package-relative test file is planned into.
 *
 * **Example** (Look up a planned file)
 *
 * ```ts
 * import { plannedShardIndex } from "./vitest.sequencer.ts"
 * const plan = { shards: [["test/a.test.ts"], ["test/b.test.ts"]] }
 * console.log(plannedShardIndex(plan, "test/b.test.ts")) // Option.some(2)
 * ```
 */
export const plannedShardIndex: {
  (plan: MeasuredShardPlan, relativeFile: string): O.Option<number>;
  (relativeFile: string): (plan: MeasuredShardPlan) => O.Option<number>;
} = dual(
  2,
  (plan: MeasuredShardPlan, relativeFile: string): O.Option<number> =>
    A.findFirstIndex(plan.shards, (entries) => A.contains(entries, relativeFile)).pipe(O.map((index) => index + 1))
);

/**
 * Build the Vitest sequencer class that applies a committed measured shard plan.
 *
 * **Details**
 *
 * The plan applies only when `--shard=<index>/<count>` names exactly `plan.shards.length` shards,
 * so every hosted runner of the lane sees the same assignment. Files the plan does not know use
 * Vitest's own hash partition over that unknown set, so a new test still runs exactly once; files
 * the plan names but the package no longer has never enter collection. Other shard counts keep
 * Vitest's default behaviour unchanged. Sorting within a shard is untouched: the plan changes
 * scheduling only, never selection or assertions.
 *
 * **Example** (Install the sequencer)
 *
 * ```ts
 * import { makeMeasuredSequencer } from "./vitest.sequencer.ts"
 * import plan from "./vitest.shards.json" with { type: "json" }
 * const sequencer = makeMeasuredSequencer(plan)
 * ```
 */
export const makeMeasuredSequencer = (plan: MeasuredShardPlan): typeof BaseSequencer =>
  class MeasuredSequencer extends BaseSequencer {
    override shard(files: TestSpecification[]): Promise<TestSpecification[]> {
      const shard = this.ctx.config.shard;
      if (shard === undefined || shard.count !== plan.shards.length) return super.shard(files);
      const path = Effect.runSync(Effect.provide(Path.Path, NodePath.layer));
      const assignment = (file: TestSpecification) =>
        plannedShardIndex(plan, Str.replaceAll(path.sep, "/")(path.relative(this.ctx.config.root, file.moduleId)));
      return Effect.promise(() => super.shard(A.filter(files, (file) => O.isNone(assignment(file))))).pipe(
        Effect.map((unknown) =>
          A.appendAll(
            A.filter(files, (file) => O.contains(assignment(file), shard.index)),
            unknown
          )
        ),
        Effect.runPromise
      );
    }
  };
