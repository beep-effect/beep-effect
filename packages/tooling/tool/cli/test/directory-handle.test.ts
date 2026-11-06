import {
  directoryIdentity,
  openDirectoryHandle,
  removeThroughDirectoryHandle,
  sameDirectoryIdentity,
  unlinkBoundFile,
} from "@beep/repo-cli/test/RepoRun";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";

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

it.layer(NodeServices.layer, { timeout: "30 seconds" })("DirectoryHandle", (it) => {
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
      const stat1 = yield* fs.stat(real);
      const expected = directoryIdentity(stat1);
      bound.pipe(O.isSome, assertTrue);
      expected.pipe(O.isSome, assertTrue);
      expect(sameDirectoryIdentity(O.getOrThrow(bound).identity, O.getOrThrow(expected))).toBe(true);

      (yield* openDirectoryHandle(link)).pipe(assertNone);
      (yield* openDirectoryHandle(file)).pipe(assertNone);
      (yield* openDirectoryHandle(path.join(root, "missing"))).pipe(assertNone);
    })
  );

  it.effect("removes a bound tree in place without following the links inside it", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "directory-handle-remove-" });
      const bystander = yield* seedBystander(root);
      const victim = yield* seedStaleTree(root, bystander);

      const openDirectoryHandle2 = yield* openDirectoryHandle(victim);
      const handle = O.getOrThrow(openDirectoryHandle2);
      const removeThroughDirectoryHandle3 = yield* removeThroughDirectoryHandle(handle, victim);
      expect(removeThroughDirectoryHandle3).toBe("removed");

      const exists4 = yield* fs.exists(victim);
      expect(exists4).toBe(false);
      const exists5 = yield* fs.exists(path.join(bystander, "keep.txt"));
      expect(exists5).toBe(true);
    })
  );

  it.effect("keeps deleting through the descriptor after the path was swapped for a link to a bystander", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "directory-handle-swap-" });
      const bystander = yield* seedBystander(root);
      const victim = yield* seedStaleTree(root, bystander);
      const openDirectoryHandle6 = yield* openDirectoryHandle(victim);
      const handle = O.getOrThrow(openDirectoryHandle6);

      // The race the handle exists for: after binding, the bound directory is moved
      // aside and its path now leads to a live directory through a link.
      const moved = path.join(root, "moved");
      yield* fs.rename(victim, moved);
      yield* fs.symlink(bystander, victim);

      // Emptying followed the descriptor to the moved directory; the final step found a
      // link instead of the bound directory at the path and left it alone.
      const removeThroughDirectoryHandle7 = yield* removeThroughDirectoryHandle(handle, victim);
      expect(removeThroughDirectoryHandle7).toBe("identity-changed");
      const readDirectory8 = yield* fs.readDirectory(moved);
      expect(readDirectory8).toEqual([]);
      const exists9 = yield* fs.exists(path.join(bystander, "keep.txt"));
      expect(exists9).toBe(true);
      (yield* fs.readLink(victim).pipe(Effect.option)).pipe(O.isSome, assertTrue);
    })
  );

  it.effect("leaves a directory renamed into the path after emptying untouched", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "directory-handle-rename-" });
      const bystander = yield* seedBystander(root);
      const victim = yield* seedStaleTree(root, bystander);
      const openDirectoryHandle10 = yield* openDirectoryHandle(victim);
      const handle = O.getOrThrow(openDirectoryHandle10);

      // Another (empty) directory now sits at the path: the bound one moved aside. The
      // final rmdir checks the entry's identity through the parent and refuses it.
      const moved = path.join(root, "moved");
      yield* fs.rename(victim, moved);
      yield* fs.makeDirectory(victim);

      const removeThroughDirectoryHandle11 = yield* removeThroughDirectoryHandle(handle, victim);
      expect(removeThroughDirectoryHandle11).toBe("identity-changed");
      const readDirectory12 = yield* fs.readDirectory(moved);
      expect(readDirectory12).toEqual([]);
      const exists13 = yield* fs.exists(victim);
      expect(exists13).toBe(true);
    })
  );

  it.effect("unlinks a bound file only while it is still the assessed inode", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "directory-handle-unlink-" });
      const bystander = yield* seedBystander(root);
      const stale = path.join(root, "stale.jsonl");
      yield* fs.writeFileString(stale, "stale\n");
      const stat14 = yield* fs.stat(stale);
      const assessed = O.getOrThrow(directoryIdentity(stat14));

      // A replacement written while the original still exists has another inode; once
      // renamed over the original it is kept, not unlinked.
      const fresh = path.join(root, "fresh.jsonl");
      yield* fs.writeFileString(fresh, "fresh\n");
      yield* fs.rename(fresh, stale);
      const unlinkBoundFile15 = yield* unlinkBoundFile(stale, assessed);
      expect(unlinkBoundFile15).toBe("identity-changed");
      const readFileString16 = yield* fs.readFileString(stale);
      expect(readFileString16).toBe("fresh\n");

      // A link put in its place is never followed, and a missing entry reads the same way.
      yield* fs.remove(stale);
      yield* fs.symlink(path.join(bystander, "keep.txt"), stale);
      const unlinkBoundFile17 = yield* unlinkBoundFile(stale, assessed);
      expect(unlinkBoundFile17).toBe("identity-changed");
      const exists18 = yield* fs.exists(path.join(bystander, "keep.txt"));
      expect(exists18).toBe(true);
      yield* fs.remove(stale);
      const unlinkBoundFile19 = yield* unlinkBoundFile(stale, assessed);
      expect(unlinkBoundFile19).toBe("identity-changed");

      // The assessed inode itself goes.
      yield* fs.writeFileString(stale, "stale\n");
      const stat20 = yield* fs.stat(stale);
      const current = O.getOrThrow(directoryIdentity(stat20));
      const unlinkBoundFile21 = yield* unlinkBoundFile(stale, current);
      expect(unlinkBoundFile21).toBe("removed");
      const exists22 = yield* fs.exists(stale);
      expect(exists22).toBe(false);

      // A parent that cannot be bound, or an unlink the directory forbids, fails closed.
      const unlinkBoundFile23 = yield* unlinkBoundFile(path.join(bystander, "keep.txt", "child"), current);
      expect(unlinkBoundFile23).toBe("removal-failed");
      const sealed = path.join(root, "sealed");
      const pinned = path.join(sealed, "pinned.txt");
      yield* fs.makeDirectory(sealed);
      yield* fs.writeFileString(pinned, "stale\n");
      const stat24 = yield* fs.stat(pinned);
      const pinnedIdentity = O.getOrThrow(directoryIdentity(stat24));
      const forbidden = yield* Effect.acquireUseRelease(
        fs.chmod(sealed, 0o500),
        () => unlinkBoundFile(pinned, pinnedIdentity),
        () => fs.chmod(sealed, 0o700).pipe(Effect.ignore)
      );
      expect(forbidden).toBe("removal-failed");
      const exists25 = yield* fs.exists(pinned);
      expect(exists25).toBe(true);
    })
  );
});
