import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { laneProofVirtualTreeSha } from "@beep/repo-cli/test/Quality";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import { NodeTestLayer } from "./support/CommandTest.ts";
import { provideSpawner } from "./support/ScriptedProcess.ts";

// The temporary index's path comes from `Git.gitDir` (W7b, SPEC D-19); both of its failure arms stay the lane
// proof's own `LaneProofGitError`.
it.layer(NodeTestLayer, { timeout: "30 seconds" })("lane proof virtual tree index path", (it) => {
  it.effect("fails typed outside a repository", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const plain = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-plain-" });
      const error = yield* Effect.flip(laneProofVirtualTreeSha(plain));
      expect(error._tag).toBe("LaneProofGitError");
    })
  );

  it.effect("names the command when git never ran", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const plain = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-spawn-" });
      const error = yield* laneProofVirtualTreeSha(plain).pipe(
        provideSpawner(ScriptedSpawner.make(() => ScriptedSpawner.notFound("git"))),
        Effect.flip
      );
      expect(error._tag).toBe("LaneProofGitError");
      expect(error.message).toContain("Unable to run git rev-parse");
    })
  );
  it.effect("cleans the temporary index when read-tree cannot spawn after Git resolves its path", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-read-tree-spawn-" });
      const temporaryIndex = path.join(root, "proof-index");
      yield* fs.writeFileString(temporaryIndex, "temporary index owned by this proof");
      const spawner = ScriptedSpawner.make((_command, args) =>
        A.contains(args, "--git-path") ? { stdout: `${temporaryIndex}\n` } : ScriptedSpawner.notFound("git")
      );
      const failure = yield* laneProofVirtualTreeSha(root).pipe(provideSpawner(spawner), Effect.flip);
      expect(failure._tag).toBe("LaneProofGitError");
      expect(failure.message).toBe("Unable to run git read-tree HEAD.");
      expect(spawner.spawns).toHaveLength(2);
      expect(A.getUnsafe(spawner.spawns, 0).args).toContain("--git-path");
      expect(A.getUnsafe(spawner.spawns, 1).args).toEqual(["read-tree", "HEAD"]);
      const retained = yield* fs.exists(temporaryIndex);
      expect(retained).toBe(false);
    })
  );
});
