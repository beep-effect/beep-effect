import { tmpdir, userInfo } from "node:os";
import {
  admissionRootFor,
  perUserRuntimeRoot,
  provideRuntimeRootForTesting,
  RuntimeRootChoice,
} from "@beep/repo-cli/test/RepoRun";
import { proofCoordinatorLockPath } from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, FileSystem, Layer, Path } from "effect";
import * as O from "effect/Option";

const uid = userInfo().uid;
const runUserDirectory = `/run/user/${uid}`;

const directoryInfo: FileSystem.File.Info = {
  type: "Directory",
  mtime: O.none(),
  atime: O.none(),
  birthtime: O.none(),
  dev: 1,
  ino: O.none(),
  mode: 0o700,
  nlink: O.none(),
  uid: O.some(uid),
  gid: O.none(),
  rdev: O.none(),
  size: FileSystem.Size(0),
  blksize: O.none(),
  blocks: O.none(),
};

const writableRunUser = FileSystem.layerNoop({
  stat: (path) =>
    path === runUserDirectory
      ? Effect.succeed(directoryInfo)
      : Effect.fail(new Error(`unexpected stat ${path}`) as never),
  makeTempDirectory: () => Effect.succeed(`${runUserDirectory}/.beep-runtime-root-probe-test`),
  remove: () => Effect.void,
});

const unwritableRunUser = FileSystem.layerNoop({
  stat: () => Effect.succeed(directoryInfo),
  makeTempDirectory: () => Effect.fail(new Error("unwritable") as never),
});

const fileAtRunUser = FileSystem.layerNoop({
  stat: () => Effect.succeed({ ...directoryInfo, type: "File" }),
});

const resolveWith = (fileSystem: Layer.Layer<FileSystem.FileSystem>, environment: Readonly<Record<string, string>>) =>
  perUserRuntimeRoot().pipe(
    Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(environment)),
    provideScopedLayer(Layer.mergeAll(fileSystem, NodePath.layer))
  );

describe("per-user runtime root", () => {
  it.effect("ignores arbitrary XDG_RUNTIME_DIR values and chooses the run-user root", () =>
    Effect.gen(function* () {
      const configured = yield* resolveWith(writableRunUser, { XDG_RUNTIME_DIR: "/configured/runtime" });
      const scrubbed = yield* resolveWith(writableRunUser, {});
      expect(configured).toStrictEqual(RuntimeRootChoice.make({ kind: "run-user", root: runUserDirectory }));
      expect(scrubbed).toStrictEqual(configured);
    })
  );

  it.effect("ignores relative and empty XDG_RUNTIME_DIR values", () =>
    Effect.gen(function* () {
      const relative = yield* resolveWith(writableRunUser, { XDG_RUNTIME_DIR: "relative/runtime" });
      const empty = yield* resolveWith(writableRunUser, { XDG_RUNTIME_DIR: "" });
      expect(relative).toStrictEqual(RuntimeRootChoice.make({ kind: "run-user", root: runUserDirectory }));
      expect(empty).toStrictEqual(relative);
    })
  );

  it.effect("uses /run/user/<uid> when a child directory can be created and removed", () =>
    Effect.gen(function* () {
      const choice = yield* resolveWith(writableRunUser, {});
      expect(choice).toStrictEqual(RuntimeRootChoice.make({ kind: "run-user", root: runUserDirectory }));
    })
  );

  it.effect("falls back to the temporary directory when /run/user/<uid> is absent", () =>
    Effect.gen(function* () {
      const choice = yield* resolveWith(FileSystem.layerNoop({}), {});
      expect(choice).toStrictEqual(RuntimeRootChoice.make({ kind: "tmpdir", root: tmpdir() }));
    })
  );

  it.effect("falls back to the temporary directory when /run/user/<uid> exists but is not writable", () =>
    Effect.gen(function* () {
      const choice = yield* resolveWith(unwritableRunUser, {});
      expect(choice).toStrictEqual(RuntimeRootChoice.make({ kind: "tmpdir", root: tmpdir() }));
    })
  );

  it.effect("falls back to the temporary directory when /run/user/<uid> is not a directory", () =>
    Effect.gen(function* () {
      const choice = yield* resolveWith(fileAtRunUser, {});
      expect(choice).toStrictEqual(RuntimeRootChoice.make({ kind: "tmpdir", root: tmpdir() }));
    })
  );

  it.effect("accepts an explicit isolated test override", () =>
    Effect.gen(function* () {
      const override = RuntimeRootChoice.make({ kind: "test-override", root: "/isolated/runtime" });
      const choice = yield* perUserRuntimeRoot().pipe(
        provideRuntimeRootForTesting(override),
        provideScopedLayer(Layer.mergeAll(FileSystem.layerNoop({}), NodePath.layer))
      );
      expect(choice).toStrictEqual(override);
    })
  );

  it.effect("keeps the admission and proof-lock leaves where they always lived", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const configured = RuntimeRootChoice.make({ kind: "test-override", root: "/configured/runtime" });
      const temporary = RuntimeRootChoice.make({ kind: "tmpdir", root: tmpdir() });
      expect(admissionRootFor(path, configured)).toBe("/configured/runtime/beep/admit");
      expect(admissionRootFor(path, temporary)).toBe(path.join(tmpdir(), `beep-admit-uid-${uid}`));

      const lock = yield* proofCoordinatorLockPath("https://github.com/acme/repo.git").pipe(
        provideRuntimeRootForTesting(configured),
        provideScopedLayer(FileSystem.layerNoop({}))
      );
      expect(lock.startsWith("/configured/runtime/beep-yeet-proof-locks-")).toBe(true);
      expect(lock).not.toContain("/beep/admit/");
    }).pipe(provideScopedLayer(NodePath.layer))
  );
});
