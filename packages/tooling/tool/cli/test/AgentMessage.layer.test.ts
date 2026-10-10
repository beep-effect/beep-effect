import { AgentMessageStore, agentMessageStoreLayer, requirePrivateAgentPath } from "@beep/repo-cli/test/AgentMessage";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

const query = Effect.fn("AgentMessageLayerTest.query")(function* (directory: string) {
  const context = yield* Layer.build(agentMessageStoreLayer(directory));
  return yield* Effect.gen(function* () {
    return yield* (yield* AgentMessageStore).endpoints;
  }).pipe(Effect.provide(context));
});
it.layer(NodeServices.layer, { timeout: "30 seconds" })("AgentMessage private filesystem boundary", (it) => {
  it.effect("opens real private SQLite and preserves private state modes", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped());
      yield* fs.chmod(root, 0o700);
      const directory = path.join(root, "router");
      expect(yield* query(directory)).toEqual([]);
      expect((yield* fs.stat(directory)).mode & 0o077).toBe(0);
      expect((yield* fs.stat(path.join(directory, "messages.sqlite"))).mode & 0o077).toBe(0);
    })
  );
  it.effect("concurrent first opens share one private database without clobbering initialization", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped());
      yield* fs.chmod(root, 0o700);
      const directory = path.join(root, "fresh-router");
      const results = yield* Effect.all([query(directory), query(directory)], { concurrency: "unbounded" });
      expect(results).toEqual([[], []]);
      expect((yield* fs.stat(path.join(directory, "messages.sqlite"))).mode & 0o077).toBe(0);
      expect(yield* query(directory)).toEqual([]);
    })
  );
  it.effect("refuses shared directory and grant file permissions", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped());
      yield* fs.chmod(root, 0o755);
      expect((yield* Effect.flip(requirePrivateAgentPath(root, "Directory")))._tag).toBe("RouterError");
      yield* fs.chmod(root, 0o700);
      const grant = path.join(root, "grant.json");
      yield* fs.writeFileString(grant, "{}", { mode: 0o644 });
      expect((yield* Effect.flip(requirePrivateAgentPath(grant, "File")))._tag).toBe("RouterError");
      yield* fs.chmod(grant, 0o600);
      expect(yield* requirePrivateAgentPath(grant, "File")).toBe(grant);
    })
  );
  it.effect("rejects symlinks before database creation", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped());
      yield* fs.chmod(root, 0o700);
      const directory = path.join(root, "actual");
      yield* fs.makeDirectory(directory, { mode: 0o700 });
      const alias = path.join(root, "alias");
      yield* fs.symlink(directory, alias);
      expect((yield* Effect.flip(requirePrivateAgentPath(alias, "Directory")))._tag).toBe("RouterError");
      const file = path.join(directory, "grant.json");
      yield* fs.writeFileString(file, "{}", { mode: 0o600 });
      const link = path.join(root, "grant-link.json");
      yield* fs.symlink(file, link);
      expect((yield* Effect.flip(requirePrivateAgentPath(link, "File")))._tag).toBe("RouterError");
      expect((yield* Effect.flip(query(alias)))._tag).toBe("RouterError");
      expect(yield* fs.exists(path.join(directory, "messages.sqlite"))).toBe(false);
    })
  );
  it.effect("rejects shared existing databases and relative state directories", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped());
      yield* fs.chmod(root, 0o700);
      yield* fs.writeFileString(path.join(root, "messages.sqlite"), "", { mode: 0o644 });
      expect((yield* Effect.flip(query(root)))._tag).toBe("RouterError");
      expect((yield* Effect.flip(query("relative-router-state")))._tag).toBe("RouterError");
    })
  );
});
