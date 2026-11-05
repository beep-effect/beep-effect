import {
  GoalCompletionReceipt,
  GoalCompletionReceiptStore,
  goalCompletionReceiptPartition,
  goalCompletionReceiptStore,
  layerGoalCompletionReceiptStoreLive,
  layerGoalCompletionReceiptStoreMemory,
  makeGoalCompletionReceiptStoreAt,
  makeGoalCompletionReceiptStoreLive,
} from "@beep/repo-cli/test/Goals";
import { YeetCommandError } from "@beep/repo-cli/test/Yeet";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import { NodeTestLayer } from "./support/CommandTest.ts";

const receipt = (repository: string, packet: string) =>
  GoalCompletionReceipt.make({
    schemaVersion: "goal-completion-receipt/v1",
    repository,
    packet,
    declarationDigest: "digest",
    acceptedDeclarationDigest: O.none(),
    finalPullRequest: 7,
    acceptedHead: O.none(),
    merge: O.none(),
    evidence: [],
    nonRequiredReds: [],
    subClaims: [],
    outcome: "unknown",
    verifiedAt: DateTime.makeUnsafe("2026-11-01T00:00:00Z"),
  });

const withStateRoot = (env: Record<string, string>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }));

const packets = A.map((row: GoalCompletionReceipt) => row.packet);

describe("goal completion receipt partition", () => {
  it("lowercases the owner and name so every clone shares one file", () => {
    expect(goalCompletionReceiptPartition("Example/Repo")).toEqual({
      host: "github.com",
      owner: "example",
      name: "repo",
    });
  });
  it("keeps a slug without a slash total", () => {
    expect(goalCompletionReceiptPartition("unobserved")).toEqual({ host: "github.com", owner: "unobserved", name: "" });
  });
});

const MemoryStoreTestLayer = Layer.mergeAll(NodeTestLayer, layerGoalCompletionReceiptStoreMemory);

it.layer(MemoryStoreTestLayer, { timeout: "60 seconds" })("goal completion receipt memory store", (it) => {
  it.effect("memory store lists only the requested repository, whatever its case", () =>
    Effect.gen(function* () {
      const store = yield* GoalCompletionReceiptStore;
      yield* store.append(receipt("example/repo", "a"));
      yield* store.append(receipt("other/repo", "b"));
      const list1 = yield* store.list("Example/Repo");
      expect(packets(list1)).toEqual(["a"]);
      const list2 = yield* store.list("missing/repo");
      expect(packets(list2)).toEqual([]);
    })
  );
  it.effect("prefers a provided store over the live workstation store", () =>
    Effect.gen(function* () {
      const provided = yield* GoalCompletionReceiptStore;
      const resolved = yield* goalCompletionReceiptStore();
      expect(resolved).toBe(provided);
    })
  );
});

it.layer(NodeTestLayer, { timeout: "30 seconds" })("goal completion receipt store", (it) => {
  it.effect("live store resolves BEEP_GOALS_STATE_ROOT and round-trips receipts per repository file", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "goal-receipts-" });
      const directory = path.join(root, "goals");
      const context = yield* Layer.build(layerGoalCompletionReceiptStoreLive).pipe(
        withStateRoot({ BEEP_GOALS_STATE_ROOT: directory, HOME: root })
      );
      const store = Context.get(context, GoalCompletionReceiptStore);
      const list3 = yield* store.list("example/repo");
      expect(list3).toEqual([]);
      yield* store.append(receipt("Example/Repo", "a"));
      yield* store.append(receipt("example/repo", "b"));
      const list4 = yield* store.list("example/repo");
      expect(packets(list4)).toEqual(["a", "b"]);
      const exists5 = yield* fs.exists(path.join(directory, "github.com__example__repo.jsonl"));
      expect(exists5).toBe(true);
    })
  );
  it.effect("falls back to the live store under XDG_STATE_HOME when none is provided", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "goal-receipts-" });
      const xdg = path.join(root, "xdg");
      const store = yield* goalCompletionReceiptStore().pipe(withStateRoot({ XDG_STATE_HOME: xdg, HOME: root }));
      yield* store.append(receipt("example/repo", "a"));
      const exists6 = yield* fs.exists(path.join(xdg, "beep", "goals", "github.com__example__repo.jsonl"));
      expect(exists6).toBe(true);
    })
  );
  it.effect("reports an unresolvable state directory as a typed command error", () =>
    Effect.gen(function* () {
      const error = yield* makeGoalCompletionReceiptStoreLive().pipe(withStateRoot({}), Effect.flip);
      expect(error).toBeInstanceOf(YeetCommandError);
      expect(error.message).toBe("Cannot resolve the goal completion receipt store directory.");
    })
  );
  it.effect("reports a receipt that cannot encode as a typed command error before touching the file", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "goal-receipts-" });
      const store = yield* makeGoalCompletionReceiptStoreAt(root);
      // Checks are skipped at construction only; encoding still enforces a positive final PR.
      const invalid = GoalCompletionReceipt.make(
        { ...receipt("example/repo", "a"), finalPullRequest: 0 },
        {
          disableChecks: true,
        }
      );
      const error = yield* store.append(invalid).pipe(Effect.flip);
      expect(error).toBeInstanceOf(YeetCommandError);
      expect(error.message).toBe("Failed to encode the goal completion receipt.");
      const exists7 = yield* fs.exists(path.join(root, "github.com__example__repo.jsonl"));
      expect(exists7).toBe(false);
    })
  );
  it.effect("maps filesystem failures on append and list to typed command errors", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "goal-receipts-" });
      // A regular file where the store directory belongs blocks both reads and appends.
      const blocked = path.join(root, "blocked");
      yield* fs.writeFileString(blocked, "");
      const store = yield* makeGoalCompletionReceiptStoreAt(blocked);
      const appendError = yield* store.append(receipt("example/repo", "a")).pipe(Effect.flip);
      expect(appendError).toBeInstanceOf(YeetCommandError);
      expect(appendError.message).toMatch(/^Goal completion receipt store: /u);
      const listError = yield* store.list("example/repo").pipe(Effect.flip);
      expect(listError).toBeInstanceOf(YeetCommandError);
      expect(listError.message).toMatch(/^Goal completion receipt store: /u);
    })
  );
});
