import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

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
  for (const scenario of [
    {
      signal: "TERM",
      phase: "escaped",
      worker: "unzip",
      exitCode: 143,
      name: "negative control without worker TERM ownership",
    },
    {
      signal: "TERM",
      phase: "wait",
      worker: "checksum",
      exitCode: 143,
      name: "TERM during unresponsive Node checksum",
    },
    {
      signal: "",
      phase: "deadline",
      worker: "checksum",
      exitCode: 1,
      name: "timeout expiry during unresponsive Node checksum",
    },
    { signal: "TERM", phase: "wait", worker: "unzip", exitCode: 143, name: "TERM during unresponsive extraction" },
    {
      signal: "",
      phase: "deadline",
      worker: "unzip",
      exitCode: 1,
      name: "timeout expiry during unresponsive extraction",
    },
    { signal: "", phase: "wait", worker: "node", exitCode: 1, name: "failed Bun download" },
    { signal: "", phase: "wait", worker: "op", exitCode: 1, name: "failed Bun with optional op still running" },
    { signal: "TERM", phase: "wait", worker: "node", exitCode: 143, name: "TERM interruption" },
    { signal: "TERM", phase: "register", worker: "bun", exitCode: 143, name: "TERM before PID registration" },
    { signal: "TERM", phase: "cleanup", worker: "node", exitCode: 143, name: "repeated TERM at cleanup entry" },
    {
      signal: "TERM",
      phase: "exit-cleanup",
      worker: "node",
      exitCode: 143,
      name: "TERM at failed-download cleanup entry",
    },
    { signal: "HUP", phase: "wait", worker: "node", exitCode: 129, name: "HUP interruption" },
    { signal: "HUP", phase: "register", worker: "bun", exitCode: 129, name: "HUP before PID registration" },
    { signal: "HUP", phase: "cleanup", worker: "node", exitCode: 129, name: "repeated HUP at cleanup entry" },
    { signal: "INT", phase: "wait", worker: "node", exitCode: 130, name: "INT interruption" },
    { signal: "INT", phase: "register", worker: "bun", exitCode: 130, name: "INT before PID registration" },
    { signal: "INT", phase: "cleanup", worker: "node", exitCode: 130, name: "repeated INT at cleanup entry" },
  ]) {
    it.effect(
      `settles parallel cloud downloads before cleanup after ${scenario.name}`,
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
        for (const file of [
          "scripts/cloud/bootstrap.sh",
          "scripts/cloud/fetch.sh",
          ".bun-version",
          ".nvmrc",
          ".bun-linux-x64.sha256",
        ]) {
          yield* fs.copyFile(path.join(repoRoot, file), path.join(root, file));
        }
        if (scenario.phase === "escaped") {
          const workerPath = path.join(root, "scripts/cloud/fetch.sh");
          const worker = yield* fs.readFileString(workerPath);
          yield* fs.writeFileString(workerPath, Str.replace("trap 'exit 143' TERM", "")(worker));
        }
        if (scenario.phase === "cleanup" || scenario.phase === "exit-cleanup") {
          const bootstrapPath = path.join(root, "scripts/cloud/bootstrap.sh");
          const bootstrap = yield* fs.readFileString(bootstrapPath);
          // Deliver the next signal at the copied function's entry, before its
          // first mask. The marker prevents a recursive cleanup from reinjecting.
          yield* fs.writeFileString(
            bootstrapPath,
            Str.replace(
              "cleanup_run_dir() {",
              `cleanup_run_dir() {
  if [ ! -f "$BEEP_BOOTSTRAP_FIXTURE/repeated-signal" ]; then
    : > "$BEEP_BOOTSTRAP_FIXTURE/repeated-signal"
    kill -"$BEEP_BOOTSTRAP_SIGNAL" "$BASHPID"
  fi`
            )(bootstrap)
          );
        }
        // Deliver signals only after the selected fake child is running. A DEBUG
        // hook covers the gap between launch and PID registration without sleeps.
        // Expiry cases deliver GNU timeout's ALRM event after child readiness,
        // avoiding a deadline that expires before a loaded runner starts the child.
        const bashEnv = path.join(root, "bash-env");
        yield* fs.writeFileString(
          bashEnv,
          `signal_sent=0
fixture_ready() {
  while [ -d "$BEEP_BOOTSTRAP_FIXTURE" ] && [ ! -f "$BEEP_BOOTSTRAP_FIXTURE/worker-ready" ]; do
    kill -0 "$1" 2>/dev/null || return 1
    sleep 0.01
  done
}
trap 'if [[ "$BEEP_BOOTSTRAP_PHASE" == register && "$BASH_COMMAND" == pids+=* && "$signal_sent" == 0 ]]; then signal_sent=1; fixture_ready "$!"; kill -"$BEEP_BOOTSTRAP_SIGNAL" "$$"; fi' DEBUG
wait() {
  if [ "$#" -eq 1 ] && [ "$signal_sent" = 0 ]; then
    fixture_ready "$1"
    signal_sent=1
    if [ "$BEEP_BOOTSTRAP_PHASE" = deadline ]; then kill -ALRM "$1"; fi
    if [[ "$BEEP_BOOTSTRAP_PHASE" != deadline && "$BEEP_BOOTSTRAP_PHASE" != exit-cleanup && -n "$BEEP_BOOTSTRAP_SIGNAL" ]]; then kill -"$BEEP_BOOTSTRAP_SIGNAL" "$$"; fi
  fi
  builtin wait "$@"
}
`
        );
        for (const [name, source] of [
          [
            "bun",
            `#!/bin/sh
if [ "$BEEP_BOOTSTRAP_WORKER" = checksum ] && [ "$BEEP_BOOTSTRAP_PHASE" = deadline ]; then cat .bun-version; else printf '0.0.0\\n'; fi
`,
          ],
          ["node", '#!/bin/sh\nprintf "v0.0.0\\n"\n'],
          ["sudo", "#!/bin/sh\nexit 1\n"],
          [
            "sha256sum",
            `#!/bin/sh
if [ "$BEEP_BOOTSTRAP_WORKER" = checksum ]; then
  trap '' TERM
  printf '%s\\n' "$$" > "$BEEP_BOOTSTRAP_FIXTURE/worker-pid"
  : > "$BEEP_BOOTSTRAP_FIXTURE/worker-ready"
  reported=0
while [ -d "$BEEP_BOOTSTRAP_FIXTURE" ] && [ ! -f "$BEEP_BOOTSTRAP_FIXTURE/release-workers" ]; do
  if [ "$reported" = 0 ] && [ -f "$BEEP_BOOTSTRAP_FIXTURE/cleanup-start" ]; then
    printf 'worker-after-cleanup\\n' >> "$BEEP_BOOTSTRAP_FIXTURE/events"
    reported=1
  fi
  sleep 0.01
done
fi
cat >/dev/null
exit 0
`,
          ],
          [
            "timeout",
            `#!/bin/sh
if [ "$1" = --kill-after=5s ]; then
  [ "$2" = 240s ] || exit 86
  if [ "$BEEP_BOOTSTRAP_PHASE" = deadline ]; then
    shift 2
    exec /usr/bin/timeout --kill-after=0.1s 240s "$@"
  fi
fi
exec /usr/bin/timeout "$@"
`,
          ],
          [
            "unzip",
            `#!/bin/sh
[ "$BEEP_BOOTSTRAP_WORKER" = unzip ] || exit 22
trap '' TERM
printf '%s\\n' "$$" > "$BEEP_BOOTSTRAP_FIXTURE/worker-pid"
: > "$BEEP_BOOTSTRAP_FIXTURE/worker-ready"
reported=0
while [ -d "$BEEP_BOOTSTRAP_FIXTURE" ] && [ ! -f "$BEEP_BOOTSTRAP_FIXTURE/release-workers" ]; do
  if [ "$reported" = 0 ] && [ -f "$BEEP_BOOTSTRAP_FIXTURE/cleanup-start" ]; then
    printf 'worker-after-cleanup\\n' >> "$BEEP_BOOTSTRAP_FIXTURE/events"
    reported=1
  fi
  sleep 0.01
done
`,
          ],
          ["uname", '#!/bin/sh\ncase "$1" in -s) echo Linux;; -m) echo x86_64;; esac\n'],
          [
            "curl",
            `#!/bin/sh
case "$*" in
  *"--connect-timeout 15 --max-time 120 --retry-max-time 120"*) ;;
  *) echo 'missing download bounds' >&2; exit 86;;
esac
if [ "$BEEP_BOOTSTRAP_WORKER" = checksum ]; then
  case "$*" in
    *index.tab*|*SHASUMS256.txt*)
      url="$*"
      while [ "$#" -gt 0 ]; do
        if [ "$1" = --output ]; then shift; output="$1"; break; fi
        shift
      done
      version=$(cat .nvmrc)
      case "$url" in
        *index.tab*) printf 'v%s\\n' "$version" > "$output" ;;
        *) printf '00 node-v%s-linux-x64.tar.xz\\n' "$version" > "$output" ;;
      esac
      exit 0
      ;;
    *node-*.tar.xz*) exit 0 ;;
  esac
fi
worker=""
case "$*" in
  *bun-linux-x64.zip*) worker=bun ;;
  *index.tab*) worker=node ;;
  *op_linux_amd64*) worker=op ;;
esac
if [ "$worker" = bun ] && [ "$BEEP_BOOTSTRAP_WORKER" = unzip ]; then exit 0; fi
if [ "$worker" = "$BEEP_BOOTSTRAP_WORKER" ]; then
  trap 'printf "%s-finished\\n" "$worker" >> "$BEEP_BOOTSTRAP_FIXTURE/events"; exit 22' TERM
  : > "$BEEP_BOOTSTRAP_FIXTURE/worker-ready"
  reported=0
while [ -d "$BEEP_BOOTSTRAP_FIXTURE" ] && [ ! -f "$BEEP_BOOTSTRAP_FIXTURE/release-workers" ]; do
  if [ "$reported" = 0 ] && [ -f "$BEEP_BOOTSTRAP_FIXTURE/cleanup-start" ]; then
    printf 'worker-after-cleanup\\n' >> "$BEEP_BOOTSTRAP_FIXTURE/events"
    reported=1
  fi
  sleep 0.01
done
elif [ "$worker" = bun ]; then
  while [ -d "$BEEP_BOOTSTRAP_FIXTURE" ] && [ ! -f "$BEEP_BOOTSTRAP_FIXTURE/worker-ready" ]; do sleep 0.01; done
fi
exit 22
`,
          ],
          [
            "rm",
            `#!/bin/sh
case "$*" in *run.orphan*) exec /bin/rm "$@" ;; esac
: > "$BEEP_BOOTSTRAP_FIXTURE/cleanup-start"
if [ -f "$BEEP_BOOTSTRAP_FIXTURE/worker-pid" ]; then
  pid=$(cat "$BEEP_BOOTSTRAP_FIXTURE/worker-pid")
  attempt=0
  while [ "$attempt" -lt 100 ]; do
    state=$(awk '{print $3}' "/proc/$pid/stat" 2>/dev/null || true)
    case "$state" in ''|Z|X) break ;; esac
    attempt=$((attempt + 1))
    sleep 0.01
  done
  case "$state" in ''|Z|X) ;; *) printf 'worker-live\\n' >> "$BEEP_BOOTSTRAP_FIXTURE/events"; cat "/proc/$pid/status" >&2 ;; esac
fi
printf 'cleanup\\n' >> "$BEEP_BOOTSTRAP_FIXTURE/events"
: > "$BEEP_BOOTSTRAP_FIXTURE/release-workers"
exec /bin/rm "$@"
`,
          ],
        ] as const) {
          const target = path.join(bin, name);
          yield* fs.writeFileString(target, source);
          yield* fs.chmod(target, 0o755);
        }
        const checkStaleRuns = scenario.name === "failed Bun download";
        if (checkStaleRuns) {
          const cache = path.join(root, "cache/beep/cloud-bootstrap");
          for (const name of ["run.active", "run.orphan", "run.legacy"]) {
            const directory = path.join(cache, name);
            yield* fs.makeDirectory(directory, { recursive: true });
            if (name !== "run.legacy") yield* fs.writeFileString(path.join(directory, ".lock"), "");
            const touch = yield* ChildProcess.make("touch", ["-d", "2 hours ago", directory], {
              stdin: "ignore",
              stdout: "ignore",
              stderr: "ignore",
            });
            expect(yield* touch.exitCode).toBe(0);
          }
          const owner = yield* ChildProcess.make(
            "flock",
            ["--exclusive", path.join(cache, "run.active/.lock"), "sh", "-c", "printf 'locked\\n'; sleep 30"],
            { stdin: "ignore", stdout: "pipe", stderr: "ignore" }
          );
          // The child prints only after acquiring the lock, before bootstrap sweeps.
          yield* Stream.runHead(owner.stdout);
        }
        const handle = yield* ChildProcess.make("bash", [path.join(root, "scripts/cloud/bootstrap.sh")], {
          cwd: root,
          env: {
            BASH_ENV: bashEnv,
            BEEP_BOOTSTRAP_FIXTURE: root,
            BEEP_BOOTSTRAP_SIGNAL: scenario.signal,
            BEEP_BOOTSTRAP_PHASE: scenario.phase,
            BEEP_BOOTSTRAP_WORKER: scenario.worker,
            BEEP_CLOUD_SKIP_OP: scenario.worker === "op" ? "0" : "1",
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
        yield* Effect.addFinalizer(() => fs.writeFileString(path.join(root, "release-workers"), "").pipe(Effect.orDie));
        const [exitCode, stderr] = yield* Effect.all(
          [handle.exitCode, handle.stderr.pipe(Stream.decodeText, Stream.mkString), Stream.runDrain(handle.stdout)],
          { concurrency: "unbounded" }
        );
        expect(exitCode).toBe(scenario.exitCode);
        expect(yield* fs.exists(path.join(root, "worker-ready")), stderr).toBe(true);
        if (scenario.phase === "cleanup" || scenario.phase === "exit-cleanup") {
          expect(yield* fs.exists(path.join(root, "repeated-signal"))).toBe(true);
        }
        if (scenario.signal === "") {
          expect(stderr).toContain(
            scenario.worker === "checksum" ? "provisioning failed" : "download or checksum failed"
          );
        }
        expect(stderr).not.toContain("missing download bounds");
        const events = yield* fs.readFileString(path.join(root, "events"));
        if (scenario.phase === "escaped") {
          expect(events).toContain("worker-after-cleanup");
          expect(events).toContain("worker-live");
        } else {
          expect(events, stderr).toBe(
            scenario.worker === "unzip" || scenario.worker === "checksum"
              ? "cleanup\n"
              : `${scenario.worker}-finished\ncleanup\n`
          );
        }
        expect(A.sort(yield* fs.readDirectory(path.join(root, "cache/beep/cloud-bootstrap")), Str.Order)).toEqual(
          checkStaleRuns ? ["run.active", "run.legacy"] : []
        );
        expect(yield* fs.exists(path.join(home, ".bun"))).toBe(false);
        expect(yield* fs.exists(path.join(root, "node_modules"))).toBe(false);
      })
    );
  }

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
