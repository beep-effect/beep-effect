import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Stream from "effect/Stream";

const run = Effect.fn("RetainedScriptAdaptersTest.run")(function* (
  executable: string,
  script: string,
  cwd: string,
  args: ReadonlyArray<string> = []
) {
  const path = yield* Path.Path;
  const source = yield* path.fromFileUrl(new URL(`../../../../../scripts/${script}`, import.meta.url));
  const handle = yield* ChildProcess.make(executable, [source, ...args], {
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = yield* Effect.all(
    [
      handle.exitCode,
      handle.stdout.pipe(Stream.decodeText, Stream.mkString),
      handle.stderr.pipe(Stream.decodeText, Stream.mkString),
    ],
    { concurrency: "unbounded" }
  );
  return { exitCode, stdout, stderr };
}, Effect.scoped);

it.layer(NodeServices.layer, { timeout: "30 seconds" })("retained install and pre-runtime adapters", (it) => {
  it.effect(
    "settles parallel cloud downloads before cleaning up a failed Bun bootstrap",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "cloud-download-failure-" });
      const repoRoot = yield* path.fromFileUrl(new URL("../../../../../", import.meta.url));
      const bin = path.join(root, "bin");
      const home = path.join(root, "home");
      yield* fs.makeDirectory(path.join(root, "scripts/cloud"), { recursive: true });
      yield* fs.makeDirectory(bin);
      yield* fs.makeDirectory(home);
      for (const file of ["scripts/cloud/bootstrap.sh", ".bun-version", ".nvmrc", ".bun-linux-x64.sha256"]) {
        yield* fs.copyFile(path.join(repoRoot, file), path.join(root, file));
      }
      // The second wait releases Node. The old early-exit path instead releases
      // it during cleanup, making the ordering observable without a timed race.
      const bashEnv = path.join(root, "bash-env");
      yield* fs.writeFileString(
        bashEnv,
        `wait_calls=0
wait() {
  wait_calls=$((wait_calls + 1))
  if [ "$wait_calls" -eq 2 ]; then : > "$BEEP_BOOTSTRAP_FIXTURE/release-node"; fi
  builtin wait "$@"
}
`
      );
      for (const [name, source] of [
        ["bun", '#!/bin/sh\nprintf "0.0.0\\n"\n'],
        ["node", '#!/bin/sh\nprintf "v0.0.0\\n"\n'],
        ["uname", '#!/bin/sh\ncase "$1" in -s) echo Linux;; -m) echo x86_64;; esac\n'],
        [
          "curl",
          `#!/bin/sh
case "$*" in
  *index.tab*)
    until [ -f "$BEEP_BOOTSTRAP_FIXTURE/release-node" ]; do sleep 0.01; done
    printf 'node-finished\\n' >> "$BEEP_BOOTSTRAP_FIXTURE/events"
    ;;
esac
exit 22
`,
        ],
        [
          "rm",
          `#!/bin/sh
printf 'cleanup\\n' >> "$BEEP_BOOTSTRAP_FIXTURE/events"
: > "$BEEP_BOOTSTRAP_FIXTURE/release-node"
exec /bin/rm "$@"
`,
        ],
      ] as const) {
        const target = path.join(bin, name);
        yield* fs.writeFileString(target, source);
        yield* fs.chmod(target, 0o755);
      }
      const handle = yield* ChildProcess.make("bash", [path.join(root, "scripts/cloud/bootstrap.sh")], {
        cwd: root,
        env: {
          BASH_ENV: bashEnv,
          BEEP_BOOTSTRAP_FIXTURE: root,
          BEEP_CLOUD_SKIP_OP: "1",
          BEEP_CLOUD_VENDOR: "fixture",
          HOME: home,
          NVM_DIR: path.join(home, ".nvm"),
          PATH: `${bin}:/usr/bin:/bin`,
          XDG_CACHE_HOME: path.join(root, "cache"),
        },
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      });
      // Finalizers run in reverse acquisition order: release the fixture worker
      // before the child-process finalizer runs on an interrupted test.
      yield* Effect.addFinalizer(() => fs.writeFileString(path.join(root, "release-node"), "").pipe(Effect.orDie));
      const [exitCode, stderr] = yield* Effect.all(
        [handle.exitCode, handle.stderr.pipe(Stream.decodeText, Stream.mkString), Stream.runDrain(handle.stdout)],
        { concurrency: "unbounded" }
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain("download or checksum failed");
      expect(yield* fs.readFileString(path.join(root, "events"))).toBe("node-finished\ncleanup\n");
      expect(yield* fs.readDirectory(path.join(root, "cache/beep/cloud-bootstrap"))).toEqual([]);
    })
  );

  it.effect("keeps compiler originals and unrelated files while removing only rotations and patched leftovers", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "tsgo-prune-fixture-" });
      for (const name of ["native", "typescript-linux-x64"]) {
        const lib = path.join(root, "node_modules", "@typescript", name, "lib");
        yield* fs.makeDirectory(lib, { recursive: true });
        for (const file of [
          "tsc.original",
          "tsc.original.1",
          "tsc.original.12",
          "tsc.patched",
          "tsc.original.old",
          "tsc",
        ]) {
          yield* fs.writeFileString(path.join(lib, file), file);
        }
      }
      expect((yield* run("node", "prune-tsgo-backups.mjs", root)).exitCode).toBe(0);
      for (const name of ["native", "typescript-linux-x64"]) {
        const lib = path.join(root, "node_modules", "@typescript", name, "lib");
        expect(yield* fs.exists(path.join(lib, "tsc.original.1"))).toBe(false);
        expect(yield* fs.exists(path.join(lib, "tsc.original.12"))).toBe(false);
        expect(yield* fs.exists(path.join(lib, "tsc.patched"))).toBe(false);
        expect(yield* fs.readFileString(path.join(lib, "tsc.original"))).toBe("tsc.original");
        expect(yield* fs.readFileString(path.join(lib, "tsc.original.old"))).toBe("tsc.original.old");
        expect(yield* fs.readFileString(path.join(lib, "tsc"))).toBe("tsc");
      }
      expect((yield* run("node", "prune-tsgo-backups.mjs", root)).exitCode).toBe(0);
    })
  );

  it.effect("does nothing before install and warns without blocking install on an invalid package directory", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "tsgo-prune-noop-" });
      expect(yield* run("node", "prune-tsgo-backups.mjs", root)).toEqual({ exitCode: 0, stdout: "", stderr: "" });
      yield* fs.makeDirectory(path.join(root, "node_modules"));
      yield* fs.writeFileString(path.join(root, "node_modules", "@typescript"), "not a directory");
      const failed = yield* run("node", "prune-tsgo-backups.mjs", root);
      expect(failed.exitCode).toBe(0);
      expect(failed.stderr).toContain("[prune-tsgo-backups] skipped:");
    })
  );

  it.effect("prunes only top-level third-party apt sources in a synthetic tree without privilege", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "apt-sources-fixture-" });
      const sources = path.join(root, "sources.list.d");
      yield* fs.makeDirectory(path.join(sources, "nested"), { recursive: true });
      for (const file of ["ubuntu.sources", "vendor.list", "vendor.sources", "README", "nested/keep.list"]) {
        yield* fs.writeFileString(path.join(sources, file), file);
      }
      yield* fs.writeFileString(path.join(root, "sources.list"), "archive");
      yield* fs.symlink(path.join(root, "sources.list"), path.join(sources, "linked.list"));
      const result = yield* run("bash", "ci-prune-apt-sources.sh", root, [sources]);
      expect(result.exitCode, result.stderr).toBe(0);
      expect(yield* fs.exists(path.join(sources, "vendor.list"))).toBe(false);
      expect(yield* fs.exists(path.join(sources, "vendor.sources"))).toBe(false);
      for (const file of ["ubuntu.sources", "README", "nested/keep.list"]) {
        expect(yield* fs.readFileString(path.join(sources, file))).toBe(file);
      }
      expect(yield* fs.readFileString(path.join(root, "sources.list"))).toBe("archive");
      expect(yield* fs.readLink(path.join(sources, "linked.list"))).toBe(path.join(root, "sources.list"));
      expect((yield* run("bash", "ci-prune-apt-sources.sh", root, [sources])).exitCode).toBe(0);
      expect((yield* run("bash", "ci-prune-apt-sources.sh", root, [path.join(root, "missing")])).exitCode).not.toBe(0);
    })
  );
});
