import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { nodeFileSystem, nodePath, nodeSyncOps } from "../../effected/workspaces/node-sync.ts";

it.effect("Node sync binding reads actual source entries and reports directory types", () => Effect.sync(() => {
  const source = nodePath.resolve("scratchpad/effected/workspaces/node-sync.ts");
  const directory = nodePath.dirname(source);
  assert.isTrue(nodeFileSystem.exists(source));
  assert.isFalse(nodeFileSystem.exists(""));
  assert.include(nodeFileSystem.readFile(source), "export const nodeSyncOps");
  assert.include(nodeFileSystem.readDirectory(directory), "node-sync.ts");
  assert.isTrue(nodeFileSystem.isDirectory(directory));
  assert.isFalse(nodeFileSystem.isDirectory(source));
  const entries = nodeFileSystem.readDirectoryWithTypes?.(directory);
  assert.isDefined(entries);
  assert.includeDeepMembers([...(entries ?? [])], [
    { name: "internal", isDirectory: true, isSymbolicLink: false },
    { name: "node-sync.ts", isDirectory: false, isSymbolicLink: false },
  ]);
  assert.strictEqual(nodeSyncOps.fileSystem, nodeFileSystem);
  assert.strictEqual(nodeSyncOps.path, nodePath);
}));
