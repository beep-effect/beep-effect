import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as R from "effect/Record";
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
case " $FIXTURE_DENY_LATE " in
  *" $host "*)
    # Deny only after the other required worker has already failed, so the
    # denial is recorded strictly later than the Bun failure.
    tries=0
    until [ -f "$FIXTURE/failed.$FIXTURE_DENY_LATE_AFTER" ]; do
      tries=$((tries + 1)); [ "$tries" -ge 500 ] && break; sleep 0.01
    done
    sleep 0.5
    printf '000 403 %s' "$url"
    echo 'curl: (56) CONNECT tunnel failed, response 403' >&2
    exit 56
    ;;
esac
case " $FIXTURE_DENY " in
  *" $host "*)
    printf '000 403 %s' "$url"
    echo 'curl: (56) CONNECT tunnel failed, response 403' >&2
    exit 56
    ;;
esac
case " $FIXTURE_REDIRECT_DENY " in
  *" $host "*)
    # The caller's host answered with a redirect; the proxy refused the hop.
    printf '000 403 https://release-assets.fixture.test/asset'
    echo 'curl: (56) CONNECT tunnel failed, response 403' >&2
    exit 56
    ;;
esac
case " $FIXTURE_PROXY_DOWN " in
  *" $host "*) printf '000 000 %s' "$url"; echo 'curl: (5) Could not resolve proxy' >&2; exit 5 ;;
esac
case " $FIXTURE_ORIGIN_403 " in
  *" $host "*) printf '403 200 %s' "$url"; echo 'curl: (22) The requested URL returned error: 403' >&2; exit 22 ;;
esac
case " $FIXTURE_UNRESOLVED " in
  *" $host "*) printf '000 000 %s' "$url"; echo "curl: (6) Could not resolve host: $host" >&2; exit 6 ;;
esac
case " $FIXTURE_UNREACHABLE " in
  *" $host "*) printf '000 000 %s' "$url"; echo 'curl: (7) Failed to connect' >&2; exit 7 ;;
esac
case " $FIXTURE_MISSING " in
  *" $host "*)
    # Order a mixed failure deterministically: let the other worker record its
    # denial before this one fails (bounded, so a regression cannot hang).
    if [ -n "$FIXTURE_FAIL_AFTER_DENIAL" ]; then
      tries=0
      until ls "$FIXTURE"/cache/beep/cloud-bootstrap/run.*/"$FIXTURE_FAIL_AFTER_DENIAL".denied >/dev/null 2>&1; do
        tries=$((tries + 1)); [ "$tries" -ge 500 ] && break; sleep 0.01
      done
    fi
    : > "$FIXTURE/failed.$host"
    printf '404 000 %s' "$url"; echo 'curl: (22) The requested URL returned error: 404' >&2; exit 22 ;;
esac
case "$url" in
  *crate-ci/typos/*|*gitleaks/gitleaks/*)
    tool=gitleaks; case "$url" in *crate-ci/typos/*) tool=typos ;; esac
    printf 'fetch %s\\n' "$url" >> "$FIXTURE/events"
    case " $FIXTURE_TOOL_404 " in
      *" $tool "*) printf '404 000 %s' "$url"; echo 'curl: (22) The requested URL returned error: 404' >&2; exit 22 ;;
    esac
    cp "$FIXTURE/$tool.tar.gz" "$output"
    printf '200 200 %s' "$url"
    exit 0
    ;;
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
printf '200 200 %s' "$url"
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
  // Pre-existing publication tools: pinned unless the scenario marks them stale.
  typos: `#!/bin/sh
v=$(cat "$FIXTURE/typos.version"); [ "\${FIXTURE_TYPOS:-pinned}" = stale ] && v=0.0.1
printf 'typos-cli %s\\n' "$v"
[ "\${FIXTURE_TYPOS:-pinned}" != failing ] || exit 3
`,
  gitleaks: `#!/bin/sh
v=$(cat "$FIXTURE/gitleaks.version"); [ "\${FIXTURE_GITLEAKS:-pinned}" = stale ] && v=0.0.1
printf '%s\\n' "$v"
[ "\${FIXTURE_GITLEAKS:-pinned}" != failing ] || exit 3
`,
  // Delegates to the real timeout, except that a named fetch worker reports a
  // deadline expiry (exit 124) at once, so the attribution path runs in ms.
  timeout: `#!/bin/sh
if [ -n "$FIXTURE_TIMEOUT_KIND" ]; then
  case " $* " in *"fetch.sh $FIXTURE_TIMEOUT_KIND "*) exit 124 ;; esac
fi
exec /usr/bin/timeout "$@"
`,
  uname: '#!/bin/sh\ncase "$1" in -s) echo Linux;; -m) echo x86_64;; esac\n',
} as const;

type Scenario = {
  readonly bun: "pinned" | "stale";
  readonly node: "pinned" | "stale";
  readonly deny?: string;
  readonly unresolved?: string;
  readonly missing?: string;
  readonly failAfterDenial?: string;
  readonly denyLate?: string;
  readonly denyLateAfter?: string;
  readonly redirectDeny?: string;
  readonly proxyDown?: string;
  readonly origin403?: string;
  readonly unreachable?: string;
  readonly proxy?: string;
  readonly badSum?: "1";
  // "failing" prints the pinned version but exits non-zero.
  readonly typos?: "pinned" | "stale" | "failing";
  readonly gitleaks?: "pinned" | "stale" | "failing";
  readonly tool404?: string;
  readonly timeoutKind?: string;
};

// Each scenario field becomes one stub-facing environment variable; fields a
// scenario omits stay unset, which the stubs read as empty.
const scenarioEnvKeys: { readonly [K in keyof Scenario]-?: string } = {
  bun: "FIXTURE_BUN",
  node: "FIXTURE_NODE",
  deny: "FIXTURE_DENY",
  unresolved: "FIXTURE_UNRESOLVED",
  missing: "FIXTURE_MISSING",
  failAfterDenial: "FIXTURE_FAIL_AFTER_DENIAL",
  denyLate: "FIXTURE_DENY_LATE",
  denyLateAfter: "FIXTURE_DENY_LATE_AFTER",
  redirectDeny: "FIXTURE_REDIRECT_DENY",
  proxyDown: "FIXTURE_PROXY_DOWN",
  origin403: "FIXTURE_ORIGIN_403",
  unreachable: "FIXTURE_UNREACHABLE",
  proxy: "HTTPS_PROXY",
  badSum: "FIXTURE_BAD_SUM",
  typos: "FIXTURE_TYPOS",
  gitleaks: "FIXTURE_GITLEAKS",
  tool404: "FIXTURE_TOOL_404",
  timeoutKind: "FIXTURE_TIMEOUT_KIND",
};

const scenarioEnv = (scenario: Scenario): Record<string, string> =>
  R.fromEntries(
    A.map(
      R.toEntries(scenario as Record<keyof Scenario, string>),
      ([key, value]) => [scenarioEnvKeys[key], value] as const
    )
  );

// Expected pins, stated independently of the script under test so that a base
// script without provisioning still runs the fixture and fails on behavior.
const TYPOS_VERSION = "1.50.3";
const GITLEAKS_VERSION = "8.30.1";

// Builds the fixture release archives (each holds a stub binary that reports
// the pinned version) and, when `fixturePins` is set, rewrites only the copied
// fetch.sh digests to those archives' hashes. The repo's fetch.sh is untouched.
const tarballScript = `set -eu
for tool in typos gitleaks; do
  v=$(cat "$tool.version")
  mkdir -p "$tool-src"
  if [ "$tool" = typos ]; then printf '#!/bin/sh\\nprintf "typos-cli %s\\\\n"\\n' "$v" > typos-src/typos; member=./typos
  else printf '#!/bin/sh\\nprintf "%s\\\\n"\\n' "$v" > gitleaks-src/gitleaks; member=gitleaks; fi
  chmod 0755 "$tool-src/$tool"
  tar -czf "$tool.tar.gz" -C "$tool-src" "$member"
  if [ "$FIXTURE_PINS" = 1 ]; then
    sum=$(sha256sum "$tool.tar.gz" | cut -d' ' -f1)
    esc=$(printf '%s' "$v" | sed 's/\\./\\\\./g')
    sed -i "s/\\($esc) sha=.\\)[0-9a-f]\\{64\\}/\\1$sum/" scripts/cloud/fetch.sh
  fi
done
`;

const prepareFixture = Effect.fn("CloudBootstrapDeniedHostTest.prepareFixture")(function* (
  options: { readonly fixturePins?: boolean } = {}
) {
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
  yield* fs.writeFileString(path.join(root, "typos.version"), TYPOS_VERSION);
  yield* fs.writeFileString(path.join(root, "gitleaks.version"), GITLEAKS_VERSION);
  const archives = yield* ChildProcess.make("sh", ["-c", tarballScript], {
    cwd: root,
    env: { FIXTURE_PINS: options.fixturePins === true ? "1" : "0", PATH: "/usr/bin:/bin" },
    stdin: "ignore",
    stdout: "ignore",
    stderr: "inherit",
  });
  expect(yield* archives.exitCode).toBe(0);
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
      ...scenarioEnv(scenario),
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

  it.effect("does not let a Bun 404 mask an already recorded Node denial", () =>
    Effect.gen(function* () {
      const fixture = yield* prepareFixture();
      const result = yield* runBootstrap(fixture, {
        bun: "stale",
        node: "stale",
        missing: "github.com",
        deny: "nodejs.org",
        failAfterDenial: "node",
      });
      expect(result.exitCode, result.stderr).toBe(78);
      expect(result.stderr).toContain("download or checksum failed");
      expect(result.stderr).toContain(remedy("nodejs.org"));
      yield* expectUntouched(fixture, result.stderr);
    })
  );

  it.effect("waits for a Node denial that is recorded only after Bun has failed", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* prepareFixture();
      const result = yield* runBootstrap(fixture, {
        bun: "stale",
        node: "stale",
        missing: "github.com",
        denyLate: "nodejs.org",
        denyLateAfter: "github.com",
      });
      expect(yield* fs.exists(path.join(fixture.root, "failed.github.com"))).toBe(true);
      expect(result.exitCode, result.stderr).toBe(78);
      expect(result.stderr).toContain("download or checksum failed");
      expect(result.stderr).toContain(remedy("nodejs.org"));
      yield* expectUntouched(fixture, result.stderr);
    })
  );

  it.effect("keeps a Bun denial named when Node fails without a denial", () =>
    Effect.gen(function* () {
      const fixture = yield* prepareFixture();
      const result = yield* runBootstrap(fixture, {
        bun: "stale",
        node: "stale",
        deny: "github.com",
        missing: "nodejs.org",
      });
      expect(result.exitCode, result.stderr).toBe(78);
      expect(result.stderr).toContain("Node");
      expect(result.stderr).toContain(remedy("github.com"));
      yield* expectUntouched(fixture, result.stderr);
    })
  );

  it.effect("keeps a Node checksum mismatch a hard non-78 failure", () =>
    Effect.gen(function* () {
      const fixture = yield* prepareFixture();
      const result = yield* runBootstrap(fixture, { bun: "pinned", node: "stale", badSum: "1" });
      expect(result.exitCode, result.stderr).toBe(1);
      expect(result.stderr).toContain("Node");
      expect(result.stderr).not.toContain("required download host denied");
      yield* expectUntouched(fixture, result.stderr);
    })
  );

  it.effect("names the denied redirect hop, not the caller's already allowed host", () =>
    Effect.gen(function* () {
      const fixture = yield* prepareFixture();
      const result = yield* runBootstrap(fixture, { bun: "stale", node: "pinned", redirectDeny: "github.com" });
      expect(result.exitCode, result.stderr).toBe(78);
      expect(result.stderr).toContain(remedy("release-assets.fixture.test"));
      expect(result.stderr).not.toContain("add github.com");
      yield* expectUntouched(fixture, result.stderr);
    })
  );

  for (const [name, scenario] of [
    ["an unresolvable egress proxy (curl 5)", { bun: "stale", node: "pinned", proxyDown: "github.com" }],
    ["an origin 403 through an open tunnel", { bun: "stale", node: "pinned", origin403: "github.com" }],
    [
      "a connect failure through a configured proxy (curl 7)",
      { bun: "stale", node: "pinned", unreachable: "github.com", proxy: "http://proxy.fixture.test:3128" },
    ],
    [
      "an unresolvable host through a configured proxy (curl 6)",
      { bun: "stale", node: "pinned", unresolved: "github.com", proxy: "http://proxy.fixture.test:3128" },
    ],
  ] as const) {
    it.effect(`does not call ${name} a host denial`, () =>
      Effect.gen(function* () {
        const fixture = yield* prepareFixture();
        const result = yield* runBootstrap(fixture, scenario);
        expect(result.exitCode, result.stderr).toBe(1);
        expect(result.stderr).toContain("download or checksum failed");
        expect(result.stderr).not.toContain("required download host denied");
        yield* expectUntouched(fixture, result.stderr);
      })
    );
  }

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

it.layer(NodeServices.layer, { timeout: "30 seconds" })("cloud bootstrap publication hook tools", (it) => {
  const readEvents = Effect.fn("CloudBootstrapDeniedHostTest.readEvents")(function* (root: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    return yield* fs.readFileString(path.join(root, "events"));
  });

  it.effect("fetches nothing and reports ready when the pinned tools are already on PATH", () =>
    Effect.gen(function* () {
      const fixture = yield* prepareFixture();
      const result = yield* runBootstrap(fixture, { bun: "pinned", node: "pinned" });
      expect(result.exitCode, result.stderr).toBe(0);
      expect(yield* readEvents(fixture.root)).not.toContain("fetch ");
      expect(result.stdout).toContain(
        `publication tools: ready (typos ${TYPOS_VERSION}, gitleaks ${GITLEAKS_VERSION})`
      );
    })
  );

  it.effect("refuses readiness when a tool prints the pinned version but exits non-zero", () =>
    Effect.gen(function* () {
      const fixture = yield* prepareFixture();
      // The probe fails, so the tool counts as missing and is re-fetched; the
      // fetch then 404s, leaving only the failing binary on PATH.
      const result = yield* runBootstrap(fixture, {
        bun: "pinned",
        node: "pinned",
        typos: "failing",
        tool404: "typos",
      });
      expect(result.exitCode, result.stderr).toBe(0);
      expect(yield* readEvents(fixture.root)).toContain("fetch https://github.com/crate-ci/typos/");
      expect(result.stderr).toMatch(/typos \S+ download or checksum failed \(exit 22\); not installed\./);
      expect(result.stdout).toContain("typos missing");
      expect(result.stderr).toContain(`publication tools: NOT ready (missing typos ${TYPOS_VERSION})`);
      expect(result.stdout).not.toContain("publication tools: ready");
    })
  );

  it.effect("acquires stale typos and gitleaks from the pinned release URLs, installs them, then no-ops", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* prepareFixture({ fixturePins: true });
      const typosVersion = TYPOS_VERSION;
      const gitleaksVersion = GITLEAKS_VERSION;
      const first = yield* runBootstrap(fixture, { bun: "pinned", node: "pinned", typos: "stale", gitleaks: "stale" });
      expect(first.exitCode, first.stderr).toBe(0);
      const events = yield* readEvents(fixture.root);
      expect(events).toContain(
        `fetch https://github.com/crate-ci/typos/releases/download/v${typosVersion}/typos-v${typosVersion}-x86_64-unknown-linux-musl.tar.gz`
      );
      expect(events).toContain(
        `fetch https://github.com/gitleaks/gitleaks/releases/download/v${gitleaksVersion}/gitleaks_${gitleaksVersion}_linux_x64.tar.gz`
      );
      for (const tool of ["typos", "gitleaks"]) {
        expect(yield* fs.exists(path.join(fixture.home, ".bun/bin", tool)), tool).toBe(true);
      }
      expect(first.stdout).toContain(`publication tools: ready (typos ${typosVersion}, gitleaks ${gitleaksVersion})`);

      // The installed binaries now precede the stale stubs on PATH.
      yield* fs.writeFileString(path.join(fixture.root, "events"), "");
      const second = yield* runBootstrap(fixture, { bun: "pinned", node: "pinned", typos: "stale", gitleaks: "stale" });
      expect(second.exitCode, second.stderr).toBe(0);
      expect(yield* readEvents(fixture.root)).not.toContain("fetch ");
      expect(second.stdout).toContain("publication tools: ready");
    })
  );

  it.effect("refuses an archive whose digest does not match the recorded pin", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      // Real pins against fixture archives: both digests mismatch.
      const fixture = yield* prepareFixture();
      const result = yield* runBootstrap(fixture, { bun: "pinned", node: "pinned", typos: "stale", gitleaks: "stale" });
      expect(result.exitCode, result.stderr).toBe(0);
      expect(result.stderr).toMatch(/typos \S+ download or checksum failed \(exit 1\); not installed\./);
      expect(result.stderr).toMatch(/gitleaks \S+ download or checksum failed \(exit 1\); not installed\./);
      expect(result.stderr).toContain("publication tools: NOT ready");
      expect(result.stdout).not.toContain("publication tools: ready");
      for (const tool of ["typos", "gitleaks"]) {
        expect(yield* fs.exists(path.join(fixture.home, ".bun/bin", tool)), tool).toBe(false);
      }
    })
  );

  it.effect("names a denied host for a publication tool but keeps it a warning, not exit 78", () =>
    Effect.gen(function* () {
      const fixture = yield* prepareFixture({ fixturePins: true });
      const result = yield* runBootstrap(fixture, {
        bun: "pinned",
        node: "pinned",
        typos: "stale",
        deny: "github.com",
      });
      expect(result.exitCode, result.stderr).toBe(0);
      expect(result.stderr).toMatch(/typos \S+ download host denied: github\.com; not installed\./);
      expect(result.stderr).not.toContain("required download host denied");
      expect(result.stderr).toContain("publication tools: NOT ready (missing typos");
      expect(result.stdout).toContain("ready: bun");
    })
  );

  it.effect("attributes a 404 and a worker deadline expiry separately", () =>
    Effect.gen(function* () {
      const fixture = yield* prepareFixture({ fixturePins: true });
      const result = yield* runBootstrap(fixture, {
        bun: "pinned",
        node: "pinned",
        typos: "stale",
        gitleaks: "stale",
        tool404: "typos",
        timeoutKind: "gitleaks",
      });
      expect(result.exitCode, result.stderr).toBe(0);
      expect(result.stderr).toMatch(/typos \S+ download or checksum failed \(exit 22\); not installed\./);
      expect(result.stderr).toMatch(/gitleaks \S+ download timed out \(exit 124\); not installed\./);
      expect(result.stderr).toContain("publication tools: NOT ready (missing typos");
    })
  );
});
