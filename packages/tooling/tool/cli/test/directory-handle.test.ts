import {
  directoryIdentity,
  openDirectoryHandle,
  removeThroughDirectoryHandle,
  sameDirectoryIdentity,
  unlinkBoundFile,
} from "@beep/repo-cli/test/RepoRun";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import * as O from "effect/Option";

// A stale tree with a file, a nested file, and a link that points OUT of the tree
// at a live directory: the removal must delete the link, never what it points at.
const seedStaleTree = Effect.fnUntraced(function* (root: string, bystander: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const victim = path.join(root, "victim");
  yield* fs.makeDirectory(path.join(victim, "sub"), { recursive: true });
  yield* fs.writeFileString(path.join(victim, "file.txt"), "stale\n");
  yield* fs.writeFileString(path.join(victim, "sub", "deep.txt"), "stale\n");
  yield* fs.symlink(bystander, path.join(victim, "escape"));
  return victim;
});

const seedBystander = Effect.fnUntraced(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const bystander = path.join(root, "bystander");
  yield* fs.makeDirectory(bystander);
  yield* fs.writeFileString(path.join(bystander, "keep.txt"), "live\n");
  return bystander;
});

describe("DirectoryHandle", () => {
  it.effect("binds a real directory to its inode and refuses links, files, and missing paths", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "directory-handle-bind-" });
      const real = path.join(root, "real");
      const link = path.join(root, "link");
      const file = path.join(root, "file.txt");
      yield* fs.makeDirectory(real);
      yield* fs.symlink(real, link);
      yield* fs.writeFileString(file, "");

      const bound = yield* openDirectoryHandle(real);
      const expected = directoryIdentity(yield* fs.stat(real));
      expect(O.isSome(bound)).toBe(true);
      expect(O.isSome(expected)).toBe(true);
      expect(sameDirectoryIdentity(O.getOrThrow(bound).identity, O.getOrThrow(expected))).toBe(true);

      expect(O.isNone(yield* openDirectoryHandle(link))).toBe(true);
      expect(O.isNone(yield* openDirectoryHandle(file))).toBe(true);
      expect(O.isNone(yield* openDirectoryHandle(path.join(root, "missing")))).toBe(true);
    }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer))
  );

  it.effect("removes a bound tree in place without following the links inside it", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "directory-handle-remove-" });
      const bystander = yield* seedBystander(root);
      const victim = yield* seedStaleTree(root, bystander);

      const handle = O.getOrThrow(yield* openDirectoryHandle(victim));
      expect(yield* removeThroughDirectoryHandle(handle, victim)).toBe("removed");

      expect(yield* fs.exists(victim)).toBe(false);
      expect(yield* fs.exists(path.join(bystander, "keep.txt"))).toBe(true);
    }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer))
  );

  it.effect("keeps deleting through the descriptor after the path was swapped for a link to a bystander", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "directory-handle-swap-" });
      const bystander = yield* seedBystander(root);
      const victim = yield* seedStaleTree(root, bystander);
      const handle = O.getOrThrow(yield* openDirectoryHandle(victim));

      // The race the handle exists for: after binding, the bound directory is moved
      // aside and its path now leads to a live directory through a link.
      const moved = path.join(root, "moved");
      yield* fs.rename(victim, moved);
      yield* fs.symlink(bystander, victim);

      // Emptying followed the descriptor to the moved directory; the final step found a
      // link instead of the bound directory at the path and left it alone.
      expect(yield* removeThroughDirectoryHandle(handle, victim)).toBe("identity-changed");
      expect(yield* fs.readDirectory(moved)).toEqual([]);
      expect(yield* fs.exists(path.join(bystander, "keep.txt"))).toBe(true);
      expect(O.isSome(yield* fs.readLink(victim).pipe(Effect.option))).toBe(true);
    }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer))
  );

  it.effect("leaves a directory renamed into the path after emptying untouched", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "directory-handle-rename-" });
      const bystander = yield* seedBystander(root);
      const victim = yield* seedStaleTree(root, bystander);
      const handle = O.getOrThrow(yield* openDirectoryHandle(victim));

      // Another (empty) directory now sits at the path: the bound one moved aside. The
      // final rmdir checks the entry's identity through the parent and refuses it.
      const moved = path.join(root, "moved");
      yield* fs.rename(victim, moved);
      yield* fs.makeDirectory(victim);

      expect(yield* removeThroughDirectoryHandle(handle, victim)).toBe("identity-changed");
      expect(yield* fs.readDirectory(moved)).toEqual([]);
      expect(yield* fs.exists(victim)).toBe(true);
    }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer))
  );

  it.effect("unlinks a bound file only while it is still the assessed inode", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "directory-handle-unlink-" });
      const bystander = yield* seedBystander(root);
      const stale = path.join(root, "stale.jsonl");
      yield* fs.writeFileString(stale, "stale\n");
      const assessed = O.getOrThrow(directoryIdentity(yield* fs.stat(stale)));

      // A replacement written while the original still exists has another inode; once
      // renamed over the original it is kept, not unlinked.
      const fresh = path.join(root, "fresh.jsonl");
      yield* fs.writeFileString(fresh, "fresh\n");
      yield* fs.rename(fresh, stale);
      expect(yield* unlinkBoundFile(stale, assessed)).toBe("identity-changed");
      expect(yield* fs.readFileString(stale)).toBe("fresh\n");

      // A link put in its place is never followed, and a missing entry reads the same way.
      yield* fs.remove(stale);
      yield* fs.symlink(path.join(bystander, "keep.txt"), stale);
      expect(yield* unlinkBoundFile(stale, assessed)).toBe("identity-changed");
      expect(yield* fs.exists(path.join(bystander, "keep.txt"))).toBe(true);
      yield* fs.remove(stale);
      expect(yield* unlinkBoundFile(stale, assessed)).toBe("identity-changed");

      // The assessed inode itself goes.
      yield* fs.writeFileString(stale, "stale\n");
      const current = O.getOrThrow(directoryIdentity(yield* fs.stat(stale)));
      expect(yield* unlinkBoundFile(stale, current)).toBe("removed");
      expect(yield* fs.exists(stale)).toBe(false);

      // A parent that cannot be bound, or an unlink the directory forbids, fails closed.
      expect(yield* unlinkBoundFile(path.join(bystander, "keep.txt", "child"), current)).toBe("removal-failed");
      const sealed = path.join(root, "sealed");
      const pinned = path.join(sealed, "pinned.txt");
      yield* fs.makeDirectory(sealed);
      yield* fs.writeFileString(pinned, "stale\n");
      const pinnedIdentity = O.getOrThrow(directoryIdentity(yield* fs.stat(pinned)));
      const forbidden = yield* Effect.acquireUseRelease(
        fs.chmod(sealed, 0o500),
        () => unlinkBoundFile(pinned, pinnedIdentity),
        () => fs.chmod(sealed, 0o700).pipe(Effect.ignore)
      );
      expect(forbidden).toBe("removal-failed");
      expect(yield* fs.exists(pinned)).toBe(true);
    }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer))
  );
});
