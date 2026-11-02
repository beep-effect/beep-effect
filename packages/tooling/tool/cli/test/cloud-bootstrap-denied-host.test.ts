import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

// Hermetic denied-host proof for scripts/cloud/bootstrap.sh (cloud-agent-readiness
// D2/D42). Every download tool is a stub on a fixture PATH, HOME and the cache
// live in a scoped temp directory, and `ln` is stubbed so link_global can never
// touch /usr/local/bin even when the runner is root. No request leaves the host.

const stubs = {
  curl: `#!/bin/sh
case "$*" in
  *"--connect-timeout 15 --max-time 120 --retry-max-time 120"*) ;;
  *) echo 'missing download bounds' >&2; exit 86;;
esac
output=""; url=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --output|-o) shift; output="$1" ;;
    https://*) url="$1" ;;
  esac
  shift
done
host=\${url#https://}; host=\${host%%/*}
printf 'curl %s\\n' "$host" >> "$FIXTURE/events"
case " $FIXTURE_DENY " in
  *" $host "*)
    printf '000 403'
    echo 'curl: (56) CONNECT tunnel failed, response 403' >&2
    exit 56
    ;;
esac
case " $FIXTURE_UNRESOLVED " in
  *" $host "*) printf '000 000'; echo "curl: (6) Could not resolve host: $host" >&2; exit 6 ;;
esac
case " $FIXTURE_MISSING " in
  *" $host "*) printf '404 000'; echo 'curl: (22) The requested URL returned error: 404' >&2; exit 22 ;;
esac
version=$(cat .nvmrc)
case "$url" in
  *index.tab) printf 'v%s\\t2026-01-01\\n' "$version" > "$output" ;;
  *.tar.xz)
    tar -cJf "$output" -C "$FIXTURE/node-src" "node-v$version-linux-x64"
    cp "$output" "$FIXTURE/node.tar.xz"
    ;;
  *SHASUMS256.txt)
    if [ -n "$FIXTURE_BAD_SUM" ]; then sum=$(printf '0%.0s' $(seq 64)); else sum=$(sha256sum "$FIXTURE/node.tar.xz" | cut -d' ' -f1); fi
    printf '%s  node-v%s-linux-x64.tar.xz\\n' "$sum" "$version" > "$output"
    ;;
  *) exit 22 ;;
esac
printf '200 200'
`,
  bun: `#!/bin/sh
case "$1" in
  --version) if [ "$FIXTURE_BUN" = pinned ]; then cat .bun-version; else printf '0.0.0\\n'; fi ;;
  install) printf 'bun-install\\n' >> "$FIXTURE/events"; mkdir -p node_modules ;;
  add) printf 'bun-add\\n' >> "$FIXTURE/events"; exit 1 ;;
  run) printf 'bun-run-%s\\n' "$2" >> "$FIXTURE/events" ;;
esac
`,
  node: `#!/bin/sh
if [ "$FIXTURE_NODE" = pinned ]; then printf 'v%s\\n' "$(cat .nvmrc)"; else printf 'v0.0.0\\n'; fi
`,
  ln: `#!/bin/sh
printf 'ln %s\\n' "$*" >> "$FIXTURE/events"
`,
  sudo: "#!/bin/sh\nexit 1\n",
  uname: '#!/bin/sh\ncase "$1" in -s) echo Linux;; -m) echo x86_64;; esac\n',
} as const;

type Scenario = {
  readonly bun: "pinned" | "stale";
  readonly node: "pinned" | "stale";
  readonly deny?: string;
  readonly unresolved?: string;
  readonly missing?: string;
  readonly badSum?: boolean;
};

const prepareFixture = Effect.fn("CloudBootstrapDeniedHostTest.prepareFixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "cloud-denied-host-" });
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
  // Stand-ins for the files the install and prepare stamps hash.
  yield* fs.writeFileString(path.join(root, "bun.lock"), "fixture lock\n");
  yield* fs.writeFileString(path.join(root, "package.json"), "{}\n");
  yield* fs.writeFileString(path.join(root, "scripts/prune-tsgo-backups.mjs"), "\n");
  const nodeVersion = Str.trim(yield* fs.readFileString(path.join(root, ".nvmrc")));
  const nodeBin = path.join(root, "node-src", `node-v${nodeVersion}-linux-x64`, "bin");
  yield* fs.makeDirectory(nodeBin, { recursive: true });
  for (const name of ["node", "npm", "npx"]) {
    yield* fs.writeFileString(path.join(nodeBin, name), `#!/bin/sh\nprintf 'v${nodeVersion}\\n'\n`);
    yield* fs.chmod(path.join(nodeBin, name), 0o755);
  }
  for (const [name, source] of R.toEntries(stubs)) {
    yield* fs.writeFileString(path.join(bin, name), source);
    yield* fs.chmod(path.join(bin, name), 0o755);
  }
  yield* fs.writeFileString(path.join(root, "events"), "");
  return { root, bin, home };
});

const runBootstrap = Effect.fn("CloudBootstrapDeniedHostTest.runBootstrap")(function* (
  fixture: { readonly root: string; readonly bin: string; readonly home: string },
  scenario: Scenario
) {
  const path = yield* Path.Path;
  const handle = yield* ChildProcess.make("bash", [path.join(fixture.root, "scripts/cloud/bootstrap.sh")], {
    cwd: fixture.root,
    env: {
      BEEP_CLOUD_SKIP_OP: "1",
      BEEP_CLOUD_VENDOR: "fixture",
      FIXTURE: fixture.root,
      FIXTURE_BAD_SUM: scenario.badSum === true ? "1" : "",
      FIXTURE_BUN: scenario.bun,
      FIXTURE_DENY: scenario.deny ?? "",
      FIXTURE_MISSING: scenario.missing ?? "",
      FIXTURE_NODE: scenario.node,
      FIXTURE_UNRESOLVED: scenario.unresolved ?? "",
      HOME: fixture.home,
      NVM_DIR: path.join(fixture.home, ".nvm"),
      PATH: `${fixture.bin}:/usr/bin:/bin`,
      XDG_CACHE_HOME: path.join(fixture.root, "cache"),
    },
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

const expectUntouched = Effect.fn("CloudBootstrapDeniedHostTest.expectUntouched")(function* (
  fixture: { readonly root: string; readonly home: string },
  stderr: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const events = yield* fs.readFileString(path.join(fixture.root, "events"));
  for (const mutation of ["bun-install", "bun-add", "bun-run-prepare", "ln "]) {
    expect(events, stderr).not.toContain(mutation);
  }
  for (const target of [
    path.join(fixture.home, ".bun"),
    path.join(fixture.home, ".local"),
    path.join(fixture.home, ".bashrc"),
    path.join(fixture.root, "node_modules"),
  ]) {
    expect(yield* fs.exists(target), target).toBe(false);
  }
  expect(yield* fs.readDirectory(path.join(fixture.root, "cache/beep/cloud-bootstrap"))).toEqual([]);
});

const remedy = (hosts: string) =>
  `ERROR: required download host denied: ${hosts}; remedy: add ${hosts} to the environment's allowed domains (docs/runbooks/cloud-environments.md).`;

it.layer(NodeServices.layer, { timeout: "30 seconds" })("cloud bootstrap required-host denial", (it) => {
  for (const [name, scenario, hosts] of [
    ["proxy-denied Bun host", { bun: "stale", node: "pinned", deny: "github.com" }, "github.com"],
    ["unresolvable Node host", { bun: "pinned", node: "stale", unresolved: "nodejs.org" }, "nodejs.org"],
    [
      "both required hosts proxy-denied",
      { bun: "stale", node: "stale", deny: "github.com nodejs.org" },
      "github.com nodejs.org",
    ],
  ] as const) {
    it.effect(`exits 78 naming the host before any mutation for a ${name}`, () =>
      Effect.gen(function* () {
        const fixture = yield* prepareFixture();
        const result = yield* runBootstrap(fixture, scenario);
        expect(result.exitCode, result.stderr).toBe(78);
        expect(result.stderr).toContain(remedy(hosts));
        yield* expectUntouched(fixture, result.stderr);
      })
    );
  }

  it.effect("keeps a non-denial download failure on the plain exit 1 path", () =>
    Effect.gen(function* () {
      const fixture = yield* prepareFixture();
      const result = yield* runBootstrap(fixture, { bun: "stale", node: "pinned", missing: "github.com" });
      expect(result.exitCode, result.stderr).toBe(1);
      expect(result.stderr).toContain("download or checksum failed");
      expect(result.stderr).not.toContain("required download host denied");
      yield* expectUntouched(fixture, result.stderr);
    })
  );

  it.effect("keeps a Node checksum mismatch a hard non-78 failure", () =>
    Effect.gen(function* () {
      const fixture = yield* prepareFixture();
      const result = yield* runBootstrap(fixture, { bun: "pinned", node: "stale", badSum: true });
      expect(result.exitCode, result.stderr).toBe(1);
      expect(result.stderr).toContain("Node");
      expect(result.stderr).not.toContain("required download host denied");
      yield* expectUntouched(fixture, result.stderr);
    })
  );

  it.effect("continues through install on an allowed host and is a no-op on re-run", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* prepareFixture();
      const first = yield* runBootstrap(fixture, { bun: "pinned", node: "stale" });
      expect(first.exitCode, first.stderr).toBe(0);
      expect(first.stdout).toContain("ready: bun");
      const events = A.filter(
        Str.split("\n")(yield* fs.readFileString(path.join(fixture.root, "events"))),
        Str.isNonEmpty
      );
      expect(events).toContain("curl nodejs.org");
      expect(events).toContain("bun-install");
      expect(events).toContain("bun-run-prepare");
      expect(A.some(events, Str.startsWith("curl github.com"))).toBe(false);
      expect(yield* fs.exists(path.join(fixture.root, "node_modules/.beep-cloud-bootstrap.lock.sha256"))).toBe(true);

      yield* fs.writeFileString(path.join(fixture.root, "events"), "");
      const second = yield* runBootstrap(fixture, { bun: "pinned", node: "stale" });
      expect(second.exitCode, second.stderr).toBe(0);
      expect(second.stdout).toContain("dependencies already match bun.lock; skipping install");
      const rerun = yield* fs.readFileString(path.join(fixture.root, "events"));
      expect(rerun).not.toContain("curl ");
      expect(rerun).not.toContain("bun-install");
    })
  );
});
