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
import type { TestSpecification } from "vitest/node";

const INTEGRATION_ROOT = "test/integration/";
const path = Effect.runSync(Effect.provide(Path.Path, NodePath.layer));
const plannedShards: ReadonlyArray<ReadonlyArray<string>> = integrationPlan.shards;
const plannedSeconds: Readonly<Record<string, number>> = integrationPlan.fileSeconds;

/**
 * Applies the committed LPT shard plan to `vitest run test/integration --shard=N/<count>`.
 *
 * The hosted `lps-int-N` partitions (repo-cli `CiLanePartitions.ts`) run this package's
 * integration files one Vitest shard each. Vitest's default shard is a hash split with equal
 * file counts, which cannot balance files ranging from 2 s to 1100 s, so this sequencer places
 * files by `vitest.integration.shards.json` instead. The plan applies only when the shard count
 * equals its length and every collected file is an integration file; the unit lane's `--shard`
 * keeps Vitest's hash split. A file the plan does not name is hash-sharded over the unknown
 * set, so a new file still runs exactly once. Within a shard the heaviest files start first so
 * the two workers balance. `test/vitest-integration-shards.test.ts` proves all of this.
 */
export class IntegrationSequencer extends BaseSequencer {
  private relativePath(file: TestSpecification): string {
    return Str.replaceAll(path.sep, "/")(path.relative(this.ctx.config.root, file.moduleId));
  }

  private planApplies(files: ReadonlyArray<TestSpecification>): boolean {
    const shard = this.ctx.config.shard;
    return (
      shard !== undefined &&
      shard.count === A.length(plannedShards) &&
      A.every(files, (file) => Str.startsWith(INTEGRATION_ROOT)(this.relativePath(file)))
    );
  }

  override shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const shard = this.ctx.config.shard;
    if (shard === undefined || !this.planApplies(files)) return super.shard(files);
    const assignment = (file: TestSpecification) => {
      const relative = this.relativePath(file);
      return A.findFirstIndex(plannedShards, (entries) => A.contains(entries, relative));
    };
    return Effect.promise(() => super.shard(A.filter(files, (file) => O.isNone(assignment(file))))).pipe(
      Effect.map((unknown) =>
        A.appendAll(
          A.filter(files, (file) => O.contains(assignment(file), shard.index - 1)),
          unknown
        )
      ),
      Effect.runPromise
    );
  }

  override sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    if (!this.planApplies(files)) return super.sort(files);
    // Unknown files first (unmeasured, treated as heavy), then measured files heaviest first.
    const weight = (file: TestSpecification): number =>
      -O.getOrElse(R.get(plannedSeconds, this.relativePath(file)), () => Number.POSITIVE_INFINITY);
    return Promise.resolve(A.sort(files, Order.mapInput(Order.Number, weight)));
  }
}
