import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Num from "effect/Number";
import * as Path from "effect/Path";
import * as Str from "@beep/utils/Str";
import {
  ENTITY_MESSAGE_POLL_MS,
  ENTITY_TERMINATION_MS,
  FROZEN_WRITE_BOUND_MS,
  LEASE_MS,
  RECOVERY_BOUND_MS,
  REFRESH_ASSIGNMENTS_MS,
  REFUSED_WRITE_BOUND_MS,
  RETRY_SPACING_MS,
  SHARD_LOCK_REFRESH_MS,
  TRANSIT_ATTEMPT_ALLOWANCE_MS,
  TRANSIT_RETRY_BUDGET_MS,
} from "./RecoveryBound.ts";

// D42: the recovery case's bound is derived from the library's lease and the cluster's message poll.
// Both are read from the installed sources, so a library or cluster change that moves either fails
// here before the case is run against a stack with the wrong bound.

const sources = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const prototype = yield* path.fromFileUrl(new URL("../../", import.meta.url));
  const library = yield* fs.readFileString(path.join(prototype, "node_modules/@alchemy.run/domain/src/DurableObjects.ts"));
  const sharding = yield* fs.readFileString(path.join(prototype, "node_modules/effect/src/cluster/ShardingConfig.ts"));
  return { library, sharding };
});

it.layer(NodeServices.layer)((it) => {
  it.effect("the bound is the library's lease plus two of the cluster's message polls", () =>
    Effect.gen(function* () {
      const { library, sharding } = yield* sources;
      expect(pipe(library, Str.includes("const LEASE_MS = 60_000;"))).toBe(true);
      expect(LEASE_MS).toBe(60_000);
      expect(pipe(sharding, Str.includes("entityMessagePollInterval: Duration.seconds(10),"))).toBe(true);
      expect(ENTITY_MESSAGE_POLL_MS).toBe(10_000);
      expect(RECOVERY_BOUND_MS).toBe(80_000);
    }),
  );

  // Phase 11 (D49): the refused write's bound, from the cluster's defaults and the library's retry.
  it.effect("a refused write's bound is the cluster's refresh, assignment and termination times plus a retry, within the retry budget", () =>
    Effect.gen(function* () {
      const { library, sharding } = yield* sources;
      expect(pipe(sharding, Str.includes("shardLockRefreshInterval: Duration.seconds(10),"))).toBe(true);
      expect(SHARD_LOCK_REFRESH_MS).toBe(10_000);
      expect(pipe(sharding, Str.includes("refreshAssignmentsInterval: Duration.seconds(3),"))).toBe(true);
      expect(REFRESH_ASSIGNMENTS_MS).toBe(3_000);
      expect(pipe(sharding, Str.includes("entityTerminationTimeout: Duration.seconds(15),"))).toBe(true);
      expect(ENTITY_TERMINATION_MS).toBe(15_000);
      expect(pipe(library, Str.includes('schedule: Schedule.min([Schedule.exponential("100 millis"), Schedule.spaced("2 seconds")]),'))).toBe(true);
      expect(pipe(library, Str.includes("times: 35,"))).toBe(true);
      expect(RETRY_SPACING_MS).toBe(2_000);
      expect(REFUSED_WRITE_BOUND_MS).toBe(33_000);
      expect(TRANSIT_RETRY_BUDGET_MS).toBe(63_100);
      expect(REFUSED_WRITE_BOUND_MS).toBeLessThan(TRANSIT_RETRY_BUDGET_MS);
    }),
  );
  // Phase 12 (D55): the frozen runner's bound is the retry budget, which is TRANSIT_RETRY's own delays.
  it.effect("a write sent to a frozen runner is answered within the retry budget: TRANSIT_RETRY's 35 delays, plus the attempts' time on a cluster", () =>
    Effect.gen(function* () {
      const { library } = yield* sources;
      expect(pipe(library, Str.includes('schedule: Schedule.min([Schedule.exponential("100 millis"), Schedule.spaced("2 seconds")]),'))).toBe(true);
      expect(pipe(library, Str.includes("times: 35,"))).toBe(true);
      // Each delay is the shorter of the exponential (100 ms, doubling) and the 2 s spacing.
      const delays = A.makeBy(35, (n) => Num.min(100 * 2 ** n, RETRY_SPACING_MS));
      expect(A.reduce(delays, 0, Num.sum)).toBe(TRANSIT_RETRY_BUDGET_MS);
      expect(FROZEN_WRITE_BOUND_MS).toBe(TRANSIT_RETRY_BUDGET_MS + TRANSIT_ATTEMPT_ALLOWANCE_MS);
    }),
  );
});
