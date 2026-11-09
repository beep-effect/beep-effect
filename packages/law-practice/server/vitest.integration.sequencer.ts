import * as NodePath from "@effect/platform-node/NodePath";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { BaseSequencer } from "vitest/node";
import integrationPlan from "./vitest.integration.shards.json" with { type: "json" };
import unitPlan from "./vitest.shards.json" with { type: "json" };
import type { TestSpecification } from "vitest/node";

const INTEGRATION_ROOT = "test/integration/";
const path = Effect.runSync(Effect.provide(Path.Path, NodePath.layer));
const integrationShards: ReadonlyArray<ReadonlyArray<string>> = integrationPlan.shards;
const unitShards: ReadonlyArray<ReadonlyArray<string>> = unitPlan.shards;
const plannedSeconds: Readonly<Record<string, number>> = integrationPlan.fileSeconds;

// One-based shard that names `relative` in `shards`; none when the plan does not list the file.
const plannedShard = (shards: ReadonlyArray<ReadonlyArray<string>>, relative: string): O.Option<number> =>
  O.map(
    A.findFirstIndex(shards, (entries) => A.contains(entries, relative)),
    (index) => index + 1
  );

/**
 * Applies this package's two committed LPT shard plans to `vitest run --shard=N/<count>`.
 *
 * The hosted `lps-int-N` partitions (repo-cli `CiLanePartitions.ts`) run the integration files
 * one Vitest shard each through `vitest run test/integration --shard=N/16`; the hosted
 * `law-practice-N` Test Unit partitions run the unit files through `--shard=N/12`. Vitest's
 * default shard is a hash split with equal file counts, which cannot balance files ranging from
 * 2 s to 1100 s, so this sequencer places files by plan instead. The integration plan
 * (`vitest.integration.shards.json`) applies when the shard count equals its length and every
 * collected file is an integration file; otherwise the unit plan (`vitest.shards.json`, written by
 * `beep ci partitions rebalance`) applies when the shard count equals its length; any other shard
 * count keeps Vitest's hash split. A file neither plan names is hash-sharded over the unknown set,
 * so a new file still runs exactly once. Within an integration shard the heaviest files start
 * first so the two workers balance. `test/vitest-integration-shards.test.ts` and
 * `test/vitest-shards-plan.test.ts` prove this. The file stays free of root imports because the
 * package's test tsconfig (`rootDir` = the package) type-checks it.
 */
export class LawPracticeSequencer extends BaseSequencer {
  private relativePath(file: TestSpecification): string {
    return Str.replaceAll(path.sep, "/")(path.relative(this.ctx.config.root, file.moduleId));
  }

  private integrationPlanApplies(files: ReadonlyArray<TestSpecification>): boolean {
    const shard = this.ctx.config.shard;
    return (
      shard !== undefined &&
      shard.count === A.length(integrationShards) &&
      A.every(files, (file) => Str.startsWith(INTEGRATION_ROOT)(this.relativePath(file)))
    );
  }

  // The files `shards` plans for shard `index`, then the files no plan names, hash-sharded by
  // Vitest over that unknown set alone so each of them still runs in exactly one shard.
  private placeByPlan(
    files: TestSpecification[],
    shards: ReadonlyArray<ReadonlyArray<string>>,
    index: number
  ): Promise<TestSpecification[]> {
    const assignment = (file: TestSpecification) => plannedShard(shards, this.relativePath(file));
    const planned = A.filter(files, (file) => O.contains(assignment(file), index));
    const unknown = A.filter(files, (file) => O.isNone(assignment(file)));
    return super.shard(unknown).then((rest) => A.appendAll(planned, rest));
  }

  override shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const shard = this.ctx.config.shard;
    if (shard === undefined) return super.shard(files);
    if (this.integrationPlanApplies(files)) return this.placeByPlan(files, integrationShards, shard.index);
    if (shard.count === A.length(unitShards)) return this.placeByPlan(files, unitShards, shard.index);
    return super.shard(files);
  }

  override sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    if (!this.integrationPlanApplies(files)) return super.sort(files);
    // Unknown files first (unmeasured, treated as heavy), then measured files heaviest first.
    const weight = (file: TestSpecification): number =>
      -O.getOrElse(R.get(plannedSeconds, this.relativePath(file)), () => Number.POSITIVE_INFINITY);
    return Promise.resolve(A.sort(files, Order.mapInput(Order.Number, weight)));
  }
}
