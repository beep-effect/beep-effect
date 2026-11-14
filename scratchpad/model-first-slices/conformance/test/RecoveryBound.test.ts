import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { ENTITY_MESSAGE_POLL_MS, LEASE_MS, RECOVERY_BOUND_MS } from "./RecoveryBound.ts";

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
});
