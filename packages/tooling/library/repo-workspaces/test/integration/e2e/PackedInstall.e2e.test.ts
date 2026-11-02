// PackedInstall against real package managers and a real fixture workspace.
//
// The unit suite (PackedInstall.test.ts) stops at the pack: the tarball lands
// in a random temp directory that memfs cannot pre-seed. Everything past it —
// a real `npm pack` and `pnpm pack`, reading the packed manifest with the
// host's `tar`, the macOS /var -> /private/var realpath, the installs, the
// bins, and the scratch directory's removal — is proven here.
//
// Hermetic by construction: the fixture has no external dependencies, and
// every install runs with its network routed to a dead proxy and corepack's
// network switched off. A manager that tried to reach the registry (an
// override that missed) or to download itself (a `packageManager` pin that
// did not match the running version) fails instead of quietly succeeding.
//
// Run it through Bun (`bunx --bun vitest run`): the first test asserts the
// parent manager's context is present, so the scrub is exercised against the
// real variables rather than a hand-written list. The fixtures are written
// through Effect's FileSystem on the host platform before the suites are
// declared, because each test's skip decision and timeout depend on the
// managers the probe found.

import { Run } from "@beep/commands";
import { Workspaces } from "@beep/repo-workspaces";
import { PackedInstall } from "@beep/repo-workspaces/testing";
import { SemVer } from "@beep/semver";
import { HostProcessPlatform } from "@beep/utils/HostProcess";
import { afterAll, assert, describe, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { flow, identity, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Str from "effect/String";
import { makeNodeFixture, nodeHost } from "../utils/nodeFixture.ts";
import type { PackageManagerName } from "@beep/repo-workspaces";
import type { InstalledConsumer, PackedInstallBudget } from "@beep/repo-workspaces/testing";

const JsonValue = S.fromJsonString(S.Record(S.String, S.Unknown));

const CARRIER = "@effected/packed-install-fixture-carrier";
const LIB = "@effected/packed-install-fixture-lib";
const PLUGIN = "@effected/packed-install-fixture-plugin";
const VERSION = "0.0.0-fixture";
const GREETING = "hello from the packed lib";
const BIN_NAME = "fixture-carrier";
const BIN = `#!/usr/bin/env node\nimport { greet } from "${LIB}";\nconsole.log(greet());\n`;
const SHARED_CARRIER = "@effected/packed-install-fixture-shared-plugin";
const SHARED_FRONT = "@effected/packed-install-fixture-shared-cli";
const SHARED_BIN = "fixture-shared";
/** The effected bundler's prod npm output, and PackedInstall's default pack source. */
const PROD = "dist/prod/npm/pkg";

// The host edge, read once at module scope: the runner's environment and the
// runtime binary that spawns the consumer-side imports.
const HOST_ENV: Readonly<Record<string, string | undefined>> = process.env;
const NODE = process.execPath;
// `NODE` is this process's own binary: Bun under `bunx --bun`, Node otherwise. Each runtime words a
// missing module its own way, so the expected wording is keyed by the runtime that spawns it.
const MODULE_NOT_FOUND = process.versions.bun === undefined ? /ERR_MODULE_NOT_FOUND/ : /Cannot find module/;
/** The parent manager's context this runner carries, which every spawn must lose. */
const LEAKED = A.filter(R.keys(HOST_ENV), (key) => /^(npm_|pnpm_config_|PNPM_SCRIPT_SRC_DIR$)/i.test(key));
const USER_AGENT = O.getOrElse(O.fromUndefinedOr(HOST_ENV.npm_config_user_agent), () => "");

// A port nothing listens on. Every manager honours HTTP(S)_PROXY, so a
// registry fetch or a self-download fails fast with ECONNREFUSED.
//
// Assumes no proxy in the user's ~/.npmrc. HOME is inherited on purpose, so a
// `proxy` or `https-proxy` set there may win over these variables (precedence
// not verified). The dead-proxy control below would then fail with a proxy or
// E404 error instead of ECONNREFUSED. The installs stay hermetic either way,
// because the fixture has no external dependencies. The scrub strips every
// `npm_config_*` variable, so an env override cannot pin it from here.
const DEAD_PROXY = "http://127.0.0.1:9";
const OFFLINE: Readonly<Record<string, string | undefined>> = {
  ...HOST_ENV,
  HTTPS_PROXY: DEAD_PROXY,
  HTTP_PROXY: DEAD_PROXY,
  https_proxy: DEAD_PROXY,
  http_proxy: DEAD_PROXY,
  NO_PROXY: undefined,
  no_proxy: undefined,
  COREPACK_ENABLE_NETWORK: "0",
};
/** What the bins and the fixture's own spawns run under: the same scrub the installs get. */
const CHILD_ENV = PackedInstall.scrubEnv(OFFLINE);

const fixture = makeNodeFixture();
afterAll(() => fixture.close());

/** A child under the scrubbed environment, nothing inherited, stdin the null device. */
const spawn = (executable: string, args: ReadonlyArray<string>, cwd: string, timeout: Duration.Input = "30 seconds") =>
  Run.collect(ChildProcess.make(executable, args, { cwd, env: CHILD_ENV, extendEnv: false, stdin: "ignore" }), {
    timeout,
  });

const write = Effect.fnUntraced(function* (root: string, file: string, content: string, mode?: number) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(root, file);
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  yield* fs.writeFileString(target, content);
  if (mode !== undefined) yield* fs.chmod(target, mode);
});
/** JSON text, two-space indented: a manifest document, or a quoted string inside a script or YAML. */
const encodeJson = flow(S.encodeResult(S.fromJsonString(S.Unknown, { space: 2 })), Result.getOrThrowWith(identity));
const json = (value: unknown): string => `${encodeJson(value)}\n`;
const decodeJson = S.decodeEffect(JsonValue);

/** A realpath'd temporary directory, removed when the suite closes. */
const scratchDirectory = Effect.fnUntraced(function* (prefix: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.realPath(yield* fixture.tempDirectory(prefix));
});

/**
 * A three-package pnpm workspace. The source manifests carry `workspace:^`;
 * each `dist/prod/npm/pkg` is the publish-ready build with those specifiers
 * resolved, as the bundler writes it. `carrier/dist/raw` is a broken build
 * that still carries `workspace:^`.
 *
 * - lib: exports `greet`.
 * - carrier: a bin that prints lib's greeting (a runtime dependency on lib).
 * - plugin: a peer dependency on lib and no bin — P3's S1 shape, where the
 *   consumer itself imports the peer.
 */
const writeFixture = Effect.fnUntraced(function* () {
  const root = yield* scratchDirectory("packed-install-fixture-");
  yield* write(root, "package.json", json({ name: "packed-install-fixture-root", version: "0.0.0", private: true }));
  yield* write(root, "pnpm-workspace.yaml", "packages:\n  - packages/*\n");

  const lib = { name: LIB, version: VERSION, type: "module", exports: { ".": "./index.js" }, files: ["index.js"] };
  const greet = `export const greet = () => "${GREETING}";\n`;
  for (const dir of ["packages/lib", `packages/lib/${PROD}`]) {
    yield* write(root, `${dir}/package.json`, json(lib));
    yield* write(root, `${dir}/index.js`, greet);
  }

  const carrier = (dependency: string) => ({
    name: CARRIER,
    version: VERSION,
    type: "module",
    bin: { [BIN_NAME]: "./bin.js" },
    files: ["bin.js"],
    dependencies: { [LIB]: dependency },
  });
  const carriers: ReadonlyArray<readonly [string, string]> = [
    ["packages/carrier", "workspace:^"],
    [`packages/carrier/${PROD}`, VERSION],
    ["packages/carrier/dist/raw", "workspace:^"],
  ];
  for (const [dir, dependency] of carriers) {
    yield* write(root, `${dir}/package.json`, json(carrier(dependency)));
    yield* write(root, `${dir}/bin.js`, BIN, 0o755);
  }

  const plugin = (peer: string) => ({
    name: PLUGIN,
    version: VERSION,
    type: "module",
    exports: { ".": "./index.js" },
    files: ["index.js"],
    peerDependencies: { [LIB]: peer },
  });
  const shout = `import { greet } from "${LIB}";\nexport const shout = () => greet().toUpperCase();\n`;
  for (const [dir, peer] of [
    ["packages/plugin", "workspace:^"],
    [`packages/plugin/${PROD}`, VERSION],
  ] as const) {
    yield* write(root, `${dir}/package.json`, json(plugin(peer)));
    yield* write(root, `${dir}/index.js`, shout);
  }

  // A carrier and a front end that BOTH declare fixture-shared: the mirror-bin shape allowSharedBins permits.
  const shared = (name: string, printed: string, dependencies: Readonly<Record<string, string>>) => ({
    manifest: {
      name,
      version: VERSION,
      type: "module",
      bin: { [SHARED_BIN]: "./bin.js" },
      files: ["bin.js"],
      dependencies,
    },
    bin: `#!/usr/bin/env node\nconsole.log(${encodeJson(printed)});\n`,
  });
  for (const [dir, pkg] of [
    ["packages/shared-cli", shared(SHARED_FRONT, "front", {})],
    [`packages/shared-cli/${PROD}`, shared(SHARED_FRONT, "front", {})],
    ["packages/shared-plugin", shared(SHARED_CARRIER, "carrier", { [SHARED_FRONT]: "workspace:^" })],
    [`packages/shared-plugin/${PROD}`, shared(SHARED_CARRIER, "carrier", { [SHARED_FRONT]: VERSION })],
  ] as const) {
    yield* write(root, `${dir}/package.json`, json(pkg.manifest));
    yield* write(root, `${dir}/bin.js`, pkg.bin, 0o755);
  }
  return root;
});

/** An empty directory outside any project, for spawns that must not pick up a project's pins. */
const OUTSIDE = await fixture.runtime.runPromise(scratchDirectory("packed-install-outside-"));

/**
 * Whether a manager answers `--version` from outside any project. Bounded like PackedInstall's own
 * probe (30 seconds): a Yarn shim that tries to fetch itself would otherwise hang collection.
 *
 * Availability only, never the version: a host shim can answer differently here than in the run's
 * scratch root (the vite-plus `pnpm` shim answered 12.15.0 here while the consumer resolved
 * 12.16.1), so the version a consumer is pinned to is read from the consumer itself.
 */
const answers = (pm: PackageManagerName) =>
  spawn(pm, ["--version"], OUTSIDE).pipe(
    Effect.map((out) => out.succeeded),
    Effect.orElseSucceed(() => false)
  );
const ON_PATH: Readonly<Record<PackageManagerName, boolean>> = await fixture.runtime.runPromise(
  Effect.all({ npm: answers("npm"), pnpm: answers("pnpm"), yarn: answers("yarn"), bun: answers("bun") })
);
const HAS_NPM = ON_PATH.npm;
const HAS_PNPM = ON_PATH.pnpm;
const HAS_YARN = ON_PATH.yarn;
/** The managers of `managers` this machine has, in order. */
const available = (managers: ReadonlyArray<PackageManagerName>): ReadonlyArray<PackageManagerName> =>
  A.filter(managers, (pm) => ON_PATH[pm]);

/** The first bun release observed to link a shared bin name to the consumer's direct dependency. */
const BUN_CARRIER_SLOT_SINCE = SemVer.of(1, 4, 4);
const bunGivesTheCarrierTheSlot = (version: string | undefined): boolean =>
  version !== undefined &&
  Result.match(SemVer.parseResult(version), {
    onFailure: () => false,
    onSuccess: (parsed) => parsed.gte(BUN_CARRIER_SLOT_SINCE),
  });

const ROOT = await fixture.runtime.runPromise(writeFixture());
// P3 C8: pnpm packs a `workspace:` specifier only in an INSTALLED workspace.
// No external dependencies, so the install is offline.
const PREINSTALL = HAS_PNPM
  ? await fixture.runtime.runPromise(
      spawn("pnpm", ["install", "--offline", "--config.ignore-scripts=true"], ROOT, "2 minutes").pipe(Effect.option)
    )
  : O.none();

const Live = Workspaces.layer({ cwd: ROOT }).pipe(Layer.provideMerge(nodeHost));

const LINKED = "@effected/packed-install-fixture-linked";
const BRIDGE = "@effected/packed-install-fixture-bridge";
/** Outside the workspace, and at a version no registry has: only an override can install it. */
const EXTERNAL = "@effected/packed-install-fixture-external";
const EXTERNAL_VERSION = "7.7.7-unpublished";
const LINKED_BIN = "fixture-linked";
const BRIDGED = "bridged from the unpublished external";

/**
 * A second workspace for `overrides`: carrier `linked` -> closure member
 * `bridge` -> `external@7.7.7-unpublished`, which lives beside the workspace,
 * not in it. The root's `pnpm-workspace.yaml` links it the dogfood way,
 * `"<name>": "file:../external"`, and `externalTarball` is the same package
 * packed with npm. Nothing here is ever installed in the workspace itself.
 */
const writeLinkedFixture = Effect.fnUntraced(function* () {
  const path = yield* Path.Path;
  const base = yield* scratchDirectory("packed-install-linked-");
  const root = path.join(base, "workspace");
  yield* write(root, "package.json", json({ name: "packed-install-linked-root", version: "0.0.0", private: true }));
  yield* write(
    root,
    "pnpm-workspace.yaml",
    `packages:\n  - packages/*\noverrides:\n  ${encodeJson(EXTERNAL)}: "file:../external"\n`
  );
  const external = {
    name: EXTERNAL,
    version: EXTERNAL_VERSION,
    type: "module",
    exports: { ".": "./index.js" },
    files: ["index.js"],
  };
  yield* write(base, "external/package.json", json(external));
  yield* write(base, "external/index.js", 'export const origin = () => "from the unpublished external";\n');

  const bridge = {
    name: BRIDGE,
    version: VERSION,
    type: "module",
    exports: { ".": "./index.js" },
    files: ["index.js"],
    dependencies: { [EXTERNAL]: EXTERNAL_VERSION },
  };
  const bridged = `import { origin } from "${EXTERNAL}";\nexport const bridge = () => "bridged " + origin();\n`;
  for (const dir of ["packages/bridge", `packages/bridge/${PROD}`]) {
    yield* write(root, `${dir}/package.json`, json(bridge));
    yield* write(root, `${dir}/index.js`, bridged);
  }
  const linked = (dependency: string) => ({
    name: LINKED,
    version: VERSION,
    type: "module",
    bin: { [LINKED_BIN]: "./bin.js" },
    files: ["bin.js"],
    dependencies: { [BRIDGE]: dependency },
  });
  for (const [dir, dependency] of [
    ["packages/linked", "workspace:^"],
    [`packages/linked/${PROD}`, VERSION],
  ] as const) {
    yield* write(root, `${dir}/package.json`, json(linked(dependency)));
    yield* write(
      root,
      `${dir}/bin.js`,
      `#!/usr/bin/env node\nimport { bridge } from "${BRIDGE}";\nconsole.log(bridge());\n`,
      0o755
    );
  }

  const fs = yield* FileSystem.FileSystem;
  const tarballs = path.join(base, "tarballs");
  yield* fs.makeDirectory(tarballs, { recursive: true });
  const packed = HAS_NPM
    ? yield* spawn(
        "npm",
        ["pack", "--ignore-scripts", "--pack-destination", tarballs],
        path.join(base, "external")
      ).pipe(Effect.option)
    : O.none();
  const externalTarball = pipe(
    packed,
    O.filter((out) => out.succeeded),
    O.flatMap((out) => A.last(Str.split("\n")(Str.trim(out.stdout)))),
    O.match({ onNone: () => "", onSome: (file) => path.join(tarballs, file) })
  );
  return { base, root, externalTarball };
});
const LINKED_FIXTURE = await fixture.runtime.runPromise(writeLinkedFixture());
const LinkedLive = Workspaces.layer({ cwd: LINKED_FIXTURE.root }).pipe(Layer.provideMerge(nodeHost));

/**
 * An outer `Effect.timeout` sized by the run's own ceilings, and vitest's guard a
 * minute above it, so a named PackedInstallError fires before either guard does.
 */
const guards = (...runs: ReadonlyArray<PackedInstallBudget.Encoded>) => {
  const effect = A.reduce(A.map(runs, PackedInstall.timeoutBudget), Duration.zero, Duration.sum);
  return { effect, vitest: Duration.toMillis(effect) + 60_000 };
};

const readJson = Effect.fnUntraced(function* (file: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* decodeJson(yield* fs.readFileString(file));
});

/** The `package/package.json` a tarball packs, read back with the host `tar` (bsdtar on macOS). */
const packedManifest = Effect.fnUntraced(function* (tarball: string) {
  const out = yield* spawn("tar", ["-xzOf", tarball, "package/package.json"], OUTSIDE);
  assert.strictEqual(out.exitCode, 0, out.stderr);
  return yield* decodeJson(out.stdout);
});

/** The names a run packed, sorted. */
const packedNames = (tarballs: Readonly<Record<string, string>>): ReadonlyArray<string> =>
  A.sort(R.keys(tarballs), Str.Order);

/** Every consumer-side fact the install path promises, for one consumer. */
const assertConsumer = Effect.fn("assertConsumer")(function* (
  consumer: InstalledConsumer,
  tarballs: Readonly<Record<string, string>>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const scratch = path.dirname(consumer.directory);
  // The realpath'd scratch: file: specs and the install cwd agree.
  assert.strictEqual(consumer.directory, yield* fs.realPath(consumer.directory), consumer.manager);
  // The host platform comes from the HostProcessPlatform reference, which defaults to this runner's.
  if ((yield* HostProcessPlatform) === "darwin") assert.match(consumer.directory, /^\/private\//, consumer.manager);
  for (const tarball of R.values(tarballs)) assert.isTrue(Str.startsWith(`${scratch}/`)(tarball), tarball);
  // The version the consumer resolves: its manager, run inside it under its own pin. The expected
  // pin comes from here, never from a probe of the host PATH, which a shim can answer differently.
  const inside = yield* spawn(consumer.manager, ["--version"], consumer.directory);
  assert.strictEqual(inside.exitCode, 0, `${consumer.manager}: ${inside.stderr}`);
  const resolved = Str.replace(/^v/, "")(Str.trim(inside.stdout));
  assert.isTrue(Result.isSuccess(SemVer.parseResult(resolved)), `${consumer.manager} --version: ${resolved}`);
  // The same manager, run inside the consumer, does not switch away from the version the run pinned.
  assert.strictEqual(consumer.managerVersion, resolved, consumer.manager);
  const manifest = yield* readJson(path.join(consumer.directory, "package.json"));
  if (consumer.manager === "pnpm") {
    assert.deepInclude(manifest, {
      devEngines: { packageManager: { name: "pnpm", version: resolved, onFail: "ignore" } },
    });
    assert.notProperty(manifest, "packageManager");
  } else {
    assert.deepInclude(manifest, { packageManager: `${consumer.manager}@${resolved}` });
  }
  // The bin, run through binPath while the scope is open, reaches the packed lib.
  const out = yield* spawn(consumer.binPath(BIN_NAME), [], OUTSIDE);
  assert.strictEqual(Str.trim(out.stdout), GREETING, `${consumer.manager}: ${out.stderr}`);
  assert.strictEqual(out.exitCode, 0, consumer.manager);
  // runBin, under the env the install carried, runs the same bin to the same result.
  const ran = yield* consumer.runBin(BIN_NAME);
  assert.deepStrictEqual([Str.trim(ran.stdout), ran.exitCode], [GREETING, 0], `${consumer.manager}: ${ran.stderr}`);
  // A symlinking manager's .bin entry resolves into the carrier; pnpm's shim is not read.
  const provenance = yield* consumer.binProvenance(BIN_NAME);
  if (consumer.manager === "pnpm") {
    assert.isUndefined(provenance);
  } else {
    assert.strictEqual(provenance?.package, CARRIER, consumer.manager);
    assert.isTrue(Str.startsWith(`${consumer.directory}/node_modules/`)(provenance?.target ?? ""), provenance?.target);
  }
});

describe("PackedInstall against a real fixture workspace", () => {
  layer(Live, { excludeTestServices: true, timeout: "30 seconds" })((it) => {
    it.effect("runs under bun, and every manager spawn gets the parent's context scrubbed", () =>
      Effect.sync(() => {
        // Positive control: the real Bun context is present in this process.
        assert.isAbove(LEAKED.length, 0, "run this suite through bunx so its context is real");
        assert.match(USER_AGENT, /^bun\//);
        assert.deepStrictEqual(
          A.filter(R.keys(CHILD_ENV), (key) => A.contains(LEAKED, key)),
          []
        );
        assert.strictEqual(CHILD_ENV.HTTPS_PROXY, DEAD_PROXY);
      })
    );

    it.effect.skipIf(!HAS_NPM)("the dead proxy the installs run behind really blocks the registry", () =>
      Effect.gen(function* () {
        // Without this control, "installed with no network" would be vacuous.
        const out = yield* spawn("npm", ["view", LIB, "version", "--prefer-online", "--fetch-retries=0"], OUTSIDE);
        assert.isFalse(out.succeeded);
        assert.include(out.stderr, "ECONNREFUSED");
      }).pipe(Effect.timeout("25 seconds"))
    );

    const prodManagers = available(["npm", "pnpm", "bun"]);
    it.effect.skipIf(!HAS_NPM)(
      "packs dist/prod/npm/pkg by default, installs under every available manager, runs the bin, then removes the scratch directory",
      () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          // The run's own scope, closed by hand so the removal is observed after it.
          const scope = yield* Scope.make();
          const seen = yield* Effect.gen(function* () {
            const result = yield* PackedInstall.run({
              carrier: CARRIER,
              closure: "auto",
              managers: prodManagers,
              require: "all",
              bins: [BIN_NAME],
              env: OFFLINE,
              installTimeout: "90 seconds",
            });
            assert.deepStrictEqual(packedNames(result.tarballs), A.sort([CARRIER, LIB], Str.Order));
            assert.deepStrictEqual(result.unavailable, []);
            assert.deepStrictEqual(
              A.map(result.consumers, (consumer) => consumer.manager),
              prodManagers
            );
            const manifest = yield* packedManifest(O.getOrElse(R.get(result.tarballs, CARRIER), () => ""));
            assert.deepStrictEqual(manifest.dependencies, { [LIB]: VERSION });
            for (const consumer of result.consumers) yield* assertConsumer(consumer, result.tarballs);
            const scratch = path.dirname(O.getOrElse(A.head(A.map(result.consumers, (c) => c.directory)), () => ""));
            assert.isTrue(yield* fs.exists(scratch), "the scratch directory exists while the scope is open");
            return scratch;
          }).pipe(Scope.provide(scope));
          yield* Scope.close(scope, Exit.void);
          assert.isFalse(yield* fs.exists(seen), `${seen} survived the scope`);
        }).pipe(Effect.timeout("150 seconds")),
      180_000
    );

    const sourceManagers = available(["npm", "pnpm", "bun"]);
    it.effect.skipIf(!HAS_PNPM)(
      "packs from source in the installed workspace, rewriting workspace:^, and every available manager's bin runs",
      () =>
        Effect.gen(function* () {
          const preinstall = O.getOrUndefined(PREINSTALL);
          assert.strictEqual(preinstall?.exitCode, 0, `${preinstall?.stdout}\n${preinstall?.stderr}`);
          const result = yield* PackedInstall.run({
            carrier: CARRIER,
            closure: "auto",
            managers: sourceManagers,
            require: "all",
            packFrom: "source",
            bins: [BIN_NAME],
            env: OFFLINE,
            installTimeout: "90 seconds",
          });
          // pnpm rewrote workspace:^ to the lib's version.
          const manifest = yield* packedManifest(O.getOrElse(R.get(result.tarballs, CARRIER), () => ""));
          assert.deepStrictEqual(manifest.dependencies, { [LIB]: `^${VERSION}` });
          assert.deepStrictEqual(
            A.map(result.consumers, (consumer) => consumer.manager),
            sourceManagers
          );
          for (const consumer of result.consumers) yield* assertConsumer(consumer, result.tarballs);
        }).pipe(Effect.timeout("150 seconds")),
      180_000
    );

    // A machine without yarn skips this. It was run once (2026-09-23) with
    // scratch installs of yarn 1.22.22 and 4.18.0 prepended to PATH, and passed
    // under both; a machine with yarn on PATH (a GitHub-hosted runner ships
    // yarn 1) runs it every time.
    it.effect.skipIf(!HAS_YARN)(
      "yarn installs the packed carrier (skipped where yarn is not on PATH)",
      () =>
        Effect.gen(function* () {
          const result = yield* PackedInstall.run({
            carrier: CARRIER,
            closure: "auto",
            managers: ["yarn"],
            require: "all",
            bins: [BIN_NAME],
            env: OFFLINE,
            installTimeout: "90 seconds",
          });
          const yarn = A.head(result.consumers);
          assert.strictEqual(O.getOrUndefined(yarn)?.manager, "yarn");
          if (O.isSome(yarn)) yield* assertConsumer(yarn.value, result.tarballs);
        }).pipe(Effect.timeout("100 seconds")),
      120_000
    );

    it.effect.skipIf(!HAS_NPM || HAS_YARN)(
      "a requested manager that is not installed lands in unavailable (yarn, on a machine without it)",
      () =>
        Effect.gen(function* () {
          const result = yield* PackedInstall.run({
            carrier: CARRIER,
            closure: "auto",
            managers: ["npm", "yarn"],
            bins: [BIN_NAME],
            env: OFFLINE,
            installTimeout: "90 seconds",
          });
          assert.deepStrictEqual(result.unavailable, ["yarn"]);
          assert.deepStrictEqual(
            A.map(result.consumers, (consumer) => consumer.manager),
            ["npm"]
          );
        }).pipe(Effect.timeout("100 seconds")),
      120_000
    );

    /** Import the plugin AND its peer from the consumer ROOT, as the consumer's own code would. */
    const importFromRoot = (consumer: InstalledConsumer) =>
      spawn(
        NODE,
        [
          "--input-type=module",
          "-e",
          `import { greet } from "${LIB}"; import { shout } from "${PLUGIN}"; console.log(greet() + "|" + shout());`,
        ],
        consumer.directory
      );

    // Every available manager, npm included: a consumerDependencies range for a
    // packed package once met npm's EOVERRIDE (a direct spec that differs from
    // the override), which a pnpm-only run could not see.
    const s1Managers = available(["npm", "pnpm", "bun"]);
    it.effect.skipIf(!HAS_NPM)(
      "P3 S1 under every available manager: a peer the consumer imports is declared through consumerDependencies",
      () =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const result = yield* PackedInstall.run({
            carrier: PLUGIN,
            closure: "auto",
            managers: s1Managers,
            require: "all",
            bins: [],
            env: OFFLINE,
            consumerDependencies: { [LIB]: VERSION },
            installTimeout: "90 seconds",
          });
          assert.deepStrictEqual(packedNames(result.tarballs), A.sort([LIB, PLUGIN], Str.Order));
          assert.deepStrictEqual(
            A.map(result.consumers, (consumer) => consumer.manager),
            s1Managers
          );
          for (const consumer of result.consumers) {
            // The range the caller passed became the packed tarball: the one spec npm accepts beside the override.
            const manifest = yield* readJson(path.join(consumer.directory, "package.json"));
            assert.deepInclude(
              manifest.dependencies,
              { [LIB]: `file:${O.getOrElse(R.get(result.tarballs, LIB), () => "")}` },
              consumer.manager
            );
            const out = yield* importFromRoot(consumer);
            assert.strictEqual(
              Str.trim(out.stdout),
              `${GREETING}|${Str.toUpperCase(GREETING)}`,
              `${consumer.manager}: ${out.stderr}`
            );
          }
        }).pipe(Effect.timeout("150 seconds")),
      180_000
    );

    it.effect.skipIf(!HAS_PNPM)(
      "P3 S1 control: without consumerDependencies pnpm resolves the peer inside the plugin but not at the root",
      () =>
        Effect.gen(function* () {
          const result = yield* PackedInstall.run({
            carrier: PLUGIN,
            closure: "auto",
            managers: ["pnpm"],
            require: "all",
            bins: [],
            env: OFFLINE,
            installTimeout: "90 seconds",
          });
          const pnpm = A.head(result.consumers);
          assert.strictEqual(O.getOrUndefined(pnpm)?.manager, "pnpm");
          if (O.isNone(pnpm)) return;
          const out = yield* importFromRoot(pnpm.value);
          assert.isFalse(out.succeeded);
          // Node reports ERR_MODULE_NOT_FOUND; under `bunx --bun` the runner and `NODE` are Bun, which
          // reports "Cannot find module". Either way the unresolved specifier is the peer.
          assert.match(out.stderr, MODULE_NOT_FOUND);
          assert.include(out.stderr, LIB);
        }).pipe(Effect.timeout("100 seconds")),
      120_000
    );

    // A front end sharing the carrier's bin name: BinConflict by default; with allowSharedBins
    // a flat layout can hand the .bin slot to the front end, and runCarrierBin still reaches the carrier.
    const sharedManagers = available(["npm", "pnpm", "yarn", "bun"]);
    const SHARED_GUARDS = guards(
      // The refused run probes and packs, then stops before any install.
      { managers: sharedManagers, installTimeout: "0 seconds", packages: 2, perConsumer: "0 seconds" },
      // The allowed run: runBin and runCarrierBin per consumer, a minute each.
      { managers: sharedManagers, installTimeout: "90 seconds", packages: 2, perConsumer: "2 minutes" }
    );
    it.effect.skipIf(!HAS_NPM)(
      "allowSharedBins: .bin may run the front end under a flat layout, runCarrierBin always runs the carrier",
      () =>
        Effect.gen(function* () {
          const options = {
            carrier: SHARED_CARRIER,
            closure: "auto",
            managers: sharedManagers,
            require: "all",
            bins: [SHARED_BIN],
            env: OFFLINE,
            installTimeout: "90 seconds",
          } as const;
          const refused = yield* Effect.flip(PackedInstall.run(options));
          assert.deepStrictEqual([refused.reason, refused.package], ["BinConflict", SHARED_FRONT]);

          const result = yield* PackedInstall.run({ ...options, allowSharedBins: true });
          const seen: Array<readonly [PackageManagerName, string]> = [];
          for (const consumer of result.consumers) {
            const slot = Str.trim((yield* consumer.runBin(SHARED_BIN)).stdout);
            const provenance = yield* consumer.binProvenance(SHARED_BIN);
            // What .bin ran agrees with who owns the slot. The flat layouts write .bin entries as
            // symlinks, so their provenance is mandatory; only pnpm's shell shims carry none.
            if (consumer.manager === "pnpm") {
              assert.isUndefined(provenance, consumer.manager);
            } else {
              assert.isDefined(provenance, consumer.manager);
              assert.strictEqual(slot, provenance?.package === SHARED_FRONT ? "front" : "carrier", consumer.manager);
            }
            seen.push([consumer.manager, slot]);
            const own = yield* consumer.runCarrierBin(SHARED_BIN);
            assert.deepStrictEqual(
              [Str.trim(own.stdout), own.exitCode],
              ["carrier", 0],
              `${consumer.manager}: ${own.stderr}`
            );
          }
          // Observed with npm 11.19 to 12.2 and bun 1.4.0-1.4.3: the package whose name sorts first
          // takes the slot, so shared-cli (the front end) beats shared-plugin (the carrier), as
          // @vitest-agent/cli beats @vitest-agent/plugin; named the other way round, the carrier won
          // both. Bun 1.4.4 gives the slot to the carrier, the consumer's direct dependency, so bun's
          // row is keyed by the bun consumer's pinned version. Yarn 1.22 and 4.18 (node-modules linker)
          // gave the slot to the carrier. pnpm links only the direct dependency. Every manager on
          // PATH is asserted, yarn included.
          const bunVersion = pipe(
            A.findFirst(result.consumers, (consumer) => consumer.manager === "bun"),
            O.map((consumer) => consumer.managerVersion),
            O.getOrUndefined
          );
          const winner: Record<PackageManagerName, string> = {
            npm: "front",
            bun: bunGivesTheCarrierTheSlot(bunVersion) ? "carrier" : "front",
            yarn: "carrier",
            pnpm: "carrier",
          };
          assert.deepStrictEqual(
            R.fromEntries(seen),
            R.fromEntries(A.map(sharedManagers, (pm) => [pm, winner[pm]] as const))
          );
        }).pipe(Effect.timeout(SHARED_GUARDS.effect)),
      SHARED_GUARDS.vitest
    );

    it.effect.skipIf(!HAS_NPM)(
      "a built directory still carrying workspace: fails UnresolvedProtocol, naming the specifier",
      () =>
        Effect.gen(function* () {
          const error = yield* Effect.flip(
            PackedInstall.run({
              carrier: CARRIER,
              closure: [],
              managers: ["npm"],
              packFrom: { directory: "dist/raw" },
              bins: [],
              env: OFFLINE,
            })
          );
          assert.strictEqual(error.reason, "UnresolvedProtocol");
          assert.include(error.message, `dependencies.${LIB}: workspace:^`);
        }).pipe(Effect.timeout("60 seconds")),
      90_000
    );

    it.effect.skipIf(!HAS_NPM)(
      "an expected bin the carrier does not ship fails MissingBin",
      () =>
        Effect.gen(function* () {
          const error = yield* Effect.flip(
            PackedInstall.run({
              carrier: CARRIER,
              closure: "auto",
              managers: ["npm"],
              bins: ["not-a-bin"],
              env: OFFLINE,
              installTimeout: "90 seconds",
            })
          );
          assert.deepStrictEqual([error.reason, error.manager], ["MissingBin", "npm"]);
        }).pipe(Effect.timeout("100 seconds")),
      120_000
    );
  });
});

describe("PackedInstall overrides: a dependency no registry has, supplied from outside the workspace", () => {
  /** Every manager on this machine: yarn joins wherever it is on PATH. */
  const linkedManagers = available(["npm", "pnpm", "yarn", "bun"]);

  /** The bin reaches external through bridge, by runBin and by the command runBin builds, under every consumer. */
  const assertLinked = Effect.fn("assertLinked")(function* (consumers: ReadonlyArray<InstalledConsumer>) {
    assert.deepStrictEqual(
      A.map(consumers, (consumer) => consumer.manager),
      linkedManagers
    );
    for (const consumer of consumers) {
      const ran = yield* consumer.runBin(LINKED_BIN);
      assert.deepStrictEqual([Str.trim(ran.stdout), ran.exitCode], [BRIDGED, 0], `${consumer.manager}: ${ran.stderr}`);
      const direct = yield* Run.collect(consumer.command(LINKED_BIN), { timeout: "30 seconds" });
      assert.deepStrictEqual([Str.trim(direct.stdout), direct.exitCode], [BRIDGED, 0], `${consumer.manager}: command`);
      // The external the bridge resolves is the supplied one, at the version no registry has.
      const resolved = yield* spawn(
        NODE,
        [
          "--input-type=module",
          "-e",
          A.join(
            [
              'import { createRequire } from "node:module";',
              'import { readFileSync } from "node:fs";',
              'import { dirname, join } from "node:path";',
              `const carrier = createRequire(process.cwd() + "/").resolve("${LINKED}/package.json");`,
              `const bridge = createRequire(carrier).resolve("${BRIDGE}");`,
              `const external = createRequire(bridge).resolve("${EXTERNAL}");`,
              'console.log(JSON.parse(readFileSync(join(dirname(external), "package.json"), "utf8")).version);',
            ],
            " "
          ),
        ],
        consumer.directory
      );
      assert.strictEqual(Str.trim(resolved.stdout), EXTERNAL_VERSION, `${consumer.manager}: ${resolved.stderr}`);
    }
  });

  // bun gives up on the dead proxy at once; npm and pnpm retry until installTimeout fires (about 90 seconds).
  const CONTROL: PackageManagerName = ON_PATH.bun ? "bun" : "npm";
  // The probe, both packs, the install to its ceiling, and the kill of the child it interrupts.
  const CONTROL_GUARDS = guards({
    managers: [CONTROL],
    installTimeout: "90 seconds",
    packages: [LINKED, BRIDGE],
    perConsumer: "0 seconds",
  });
  // Per consumer: runBin (a minute), the direct command and the resolve spawn (30 seconds each).
  const LINKED_GUARDS = guards({
    managers: linkedManagers,
    installTimeout: "90 seconds",
    packages: [LINKED, BRIDGE, EXTERNAL],
    perConsumer: "2 minutes",
  });

  layer(LinkedLive, { excludeTestServices: true, timeout: "30 seconds" })((it) => {
    it.effect.skipIf(!HAS_NPM)(
      "the fixture really is unresolvable: without an override the install fails behind the dead proxy",
      () =>
        Effect.gen(function* () {
          const error = yield* Effect.flip(
            PackedInstall.run({
              carrier: LINKED,
              closure: "auto",
              managers: [CONTROL],
              require: "all",
              bins: [LINKED_BIN],
              env: OFFLINE,
              installTimeout: "90 seconds",
            })
          );
          assert.deepStrictEqual([error.reason, error.manager], ["InstallFailed", CONTROL]);
          // It failed on the external, not on something else.
          assert.include(`${error.message}\n${error.output ?? ""}`, CONTROL === "bun" ? EXTERNAL : "timed out");
        }).pipe(Effect.timeout(CONTROL_GUARDS.effect)),
      CONTROL_GUARDS.vitest
    );

    it.effect.skipIf(!HAS_NPM)(
      "overrides: a supplied .tgz installs for the closure's transitive reference under every available manager",
      () =>
        Effect.gen(function* () {
          assert.isTrue(Str.endsWith(".tgz")(LINKED_FIXTURE.externalTarball), "the fixture packed external");
          const options = {
            carrier: LINKED,
            closure: "auto",
            managers: linkedManagers,
            require: "all",
            bins: [LINKED_BIN],
            env: OFFLINE,
            installTimeout: "90 seconds",
            overrides: { [EXTERNAL]: LINKED_FIXTURE.externalTarball },
          } as const;
          const planned = yield* PackedInstall.closure(LINKED, options);
          assert.deepStrictEqual(planned, [LINKED, BRIDGE, EXTERNAL]);
          const result = yield* PackedInstall.run(options);
          assert.deepStrictEqual(R.keys(result.tarballs), planned, "closure names exactly what the run packed");
          assert.strictEqual(
            O.getOrUndefined(R.get(result.tarballs, EXTERNAL)),
            LINKED_FIXTURE.externalTarball,
            "a tarball is used as it is"
          );
          yield* assertLinked(result.consumers);
        }).pipe(Effect.timeout(LINKED_GUARDS.effect)),
      LINKED_GUARDS.vitest
    );

    it.effect.skipIf(!HAS_NPM)(
      "workspaceOverrides: the workspace's own file: link to a directory installs under every available manager",
      () =>
        Effect.gen(function* () {
          const result = yield* PackedInstall.run({
            carrier: LINKED,
            closure: "auto",
            managers: linkedManagers,
            require: "all",
            bins: [LINKED_BIN],
            env: OFFLINE,
            installTimeout: "90 seconds",
            workspaceOverrides: true,
          });
          assert.deepStrictEqual(R.keys(result.tarballs), [LINKED, BRIDGE, EXTERNAL]);
          // The directory was npm-packed into the scratch root, not used in place.
          const external = O.getOrElse(R.get(result.tarballs, EXTERNAL), () => "");
          assert.isTrue(Str.startsWith(`${result.scratch}/`)(external), external);
          yield* assertLinked(result.consumers);
        }).pipe(Effect.timeout(LINKED_GUARDS.effect)),
      LINKED_GUARDS.vitest
    );
  });
});
