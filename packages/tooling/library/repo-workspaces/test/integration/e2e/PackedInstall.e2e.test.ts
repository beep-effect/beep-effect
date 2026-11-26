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
const BUNDLER_NPM_OUTPUT = "dist/prod/npm/pkg";

const HOST_ENV: Readonly<Record<string, string | undefined>> = process.env;
const THIS_RUNTIME = process.execPath;
const MODULE_NOT_FOUND = process.versions.bun === undefined ? /ERR_MODULE_NOT_FOUND/ : /Cannot find module/;
const PARENT_MANAGER_CONTEXT = A.filter(R.keys(HOST_ENV), (key) =>
  /^(npm_|pnpm_config_|PNPM_SCRIPT_SRC_DIR$)/i.test(key)
);
const USER_AGENT = O.getOrElse(O.fromUndefinedOr(HOST_ENV.npm_config_user_agent), () => "");

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
const INSTALL_SCRUBBED_ENV = PackedInstall.scrubEnv(OFFLINE);

const fixture = makeNodeFixture();
afterAll(() => fixture.close());

const spawnScrubbed = (
  executable: string,
  args: ReadonlyArray<string>,
  cwd: string,
  timeout: Duration.Input = "30 seconds"
) =>
  Run.collect(
    ChildProcess.make(executable, args, { cwd, env: INSTALL_SCRUBBED_ENV, extendEnv: false, stdin: "ignore" }),
    {
      timeout,
    }
  );

const write = Effect.fnUntraced(function* (root: string, file: string, content: string, mode?: number) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(root, file);
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  yield* fs.writeFileString(target, content);
  if (mode !== undefined) yield* fs.chmod(target, mode);
});
const encodeIndentedJson = flow(
  S.encodeResult(S.fromJsonString(S.Unknown, { space: 2 })),
  Result.getOrThrowWith(identity)
);
const json = (value: unknown): string => `${encodeIndentedJson(value)}\n`;
const decodeJson = S.decodeEffect(JsonValue);

const realpathedScratchDirectory = Effect.fnUntraced(function* (prefix: string) {
  const fs = yield* FileSystem.FileSystem;
  const tempDirectory1 = yield* fixture.tempDirectory(prefix);
  return yield* fs.realPath(tempDirectory1);
});

const writeWorkspaceFixture = Effect.fnUntraced(function* () {
  const root = yield* realpathedScratchDirectory("packed-install-fixture-");
  yield* write(root, "package.json", json({ name: "packed-install-fixture-root", version: "0.0.0", private: true }));
  yield* write(root, "pnpm-workspace.yaml", "packages:\n  - packages/*\n");

  const lib = { name: LIB, version: VERSION, type: "module", exports: { ".": "./index.js" }, files: ["index.js"] };
  const greet = `export const greet = () => "${GREETING}";\n`;
  for (const dir of ["packages/lib", `packages/lib/${BUNDLER_NPM_OUTPUT}`]) {
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
  const sourceProdAndBrokenRawCarriers: ReadonlyArray<readonly [string, string]> = [
    ["packages/carrier", "workspace:^"],
    [`packages/carrier/${BUNDLER_NPM_OUTPUT}`, VERSION],
    ["packages/carrier/dist/raw", "workspace:^"],
  ];
  for (const [dir, dependency] of sourceProdAndBrokenRawCarriers) {
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
    [`packages/plugin/${BUNDLER_NPM_OUTPUT}`, VERSION],
  ] as const) {
    yield* write(root, `${dir}/package.json`, json(plugin(peer)));
    yield* write(root, `${dir}/index.js`, shout);
  }

  const mirrorBinPackage = (name: string, printed: string, dependencies: Readonly<Record<string, string>>) => ({
    manifest: {
      name,
      version: VERSION,
      type: "module",
      bin: { [SHARED_BIN]: "./bin.js" },
      files: ["bin.js"],
      dependencies,
    },
    bin: `#!/usr/bin/env node\nconsole.log(${encodeIndentedJson(printed)});\n`,
  });
  for (const [dir, pkg] of [
    ["packages/shared-cli", mirrorBinPackage(SHARED_FRONT, "front", {})],
    [`packages/shared-cli/${BUNDLER_NPM_OUTPUT}`, mirrorBinPackage(SHARED_FRONT, "front", {})],
    ["packages/shared-plugin", mirrorBinPackage(SHARED_CARRIER, "carrier", { [SHARED_FRONT]: "workspace:^" })],
    [
      `packages/shared-plugin/${BUNDLER_NPM_OUTPUT}`,
      mirrorBinPackage(SHARED_CARRIER, "carrier", { [SHARED_FRONT]: VERSION }),
    ],
  ] as const) {
    yield* write(root, `${dir}/package.json`, json(pkg.manifest));
    yield* write(root, `${dir}/bin.js`, pkg.bin, 0o755);
  }
  return root;
});

const OUTSIDE_ANY_PROJECT = await fixture.runtime.runPromise(realpathedScratchDirectory("packed-install-outside-"));

const SELF_FETCHING_YARN_SHIM_BOUND: Duration.Input = "30 seconds";
const respondsToVersionProbe = (pm: PackageManagerName) =>
  spawnScrubbed(pm, ["--version"], OUTSIDE_ANY_PROJECT, SELF_FETCHING_YARN_SHIM_BOUND).pipe(
    Effect.map((out) => out.succeeded),
    Effect.orElseSucceed(() => false)
  );
const ON_PATH: Readonly<Record<PackageManagerName, boolean>> = await fixture.runtime.runPromise(
  Effect.all(
    {
      npm: respondsToVersionProbe("npm"),
      pnpm: respondsToVersionProbe("pnpm"),
      yarn: respondsToVersionProbe("yarn"),
      bun: respondsToVersionProbe("bun"),
    },
    { concurrency: 1 }
  )
);
const HAS_NPM = ON_PATH.npm;
const HAS_PNPM = ON_PATH.pnpm;
const HAS_YARN = ON_PATH.yarn;
const availableInOrder = (managers: ReadonlyArray<PackageManagerName>): ReadonlyArray<PackageManagerName> =>
  A.filter(managers, (pm) => ON_PATH[pm]);

const FIRST_BUN_LINKING_DIRECT_DEP_BIN = SemVer.of(1, 4, 4);
const bunGivesTheCarrierTheSlot = (version: string | undefined): boolean =>
  version !== undefined &&
  Result.match(SemVer.parseResult(version), {
    onFailure: () => false,
    onSuccess: (parsed) => parsed.gte(FIRST_BUN_LINKING_DIRECT_DEP_BIN),
  });

const ROOT = await fixture.runtime.runPromise(writeWorkspaceFixture());
const OFFLINE_WORKSPACE_INSTALL = HAS_PNPM
  ? await fixture.runtime.runPromise(
      spawnScrubbed("pnpm", ["install", "--offline", "--config.ignore-scripts=true"], ROOT, "2 minutes").pipe(
        Effect.option
      )
    )
  : O.none();

const Live = Workspaces.layer({ cwd: ROOT }).pipe(Layer.provideMerge(nodeHost));

const LINKED = "@effected/packed-install-fixture-linked";
const BRIDGE = "@effected/packed-install-fixture-bridge";
const EXTERNAL = "@effected/packed-install-fixture-external";
const EXTERNAL_VERSION = "7.7.7-unpublished";
const LINKED_BIN = "fixture-linked";
const BRIDGED = "bridged from the unpublished external";

const writeOverridesWorkspaceFixture = Effect.fnUntraced(function* () {
  const path = yield* Path.Path;
  const base = yield* realpathedScratchDirectory("packed-install-linked-");
  const root = path.join(base, "workspace");
  yield* write(root, "package.json", json({ name: "packed-install-linked-root", version: "0.0.0", private: true }));
  yield* write(
    root,
    "pnpm-workspace.yaml",
    `packages:\n  - packages/*\noverrides:\n  ${encodeIndentedJson(EXTERNAL)}: "file:../external"\n`
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
  for (const dir of ["packages/bridge", `packages/bridge/${BUNDLER_NPM_OUTPUT}`]) {
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
    [`packages/linked/${BUNDLER_NPM_OUTPUT}`, VERSION],
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
    ? yield* spawnScrubbed(
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
const LINKED_FIXTURE = await fixture.runtime.runPromise(writeOverridesWorkspaceFixture());
const LinkedLive = Workspaces.layer({ cwd: LINKED_FIXTURE.root }).pipe(Layer.provideMerge(nodeHost));

const guardsLetNamedErrorFireFirst = (...runs: ReadonlyArray<PackedInstallBudget.Encoded>) => {
  const effect = A.reduce(A.map(runs, PackedInstall.timeoutBudget), Duration.zero, Duration.sum);
  return { effect, vitest: Duration.toMillis(effect) + 60_000 };
};

const readJson = Effect.fnUntraced(function* (file: string) {
  const fs = yield* FileSystem.FileSystem;
  const readFileString2 = yield* fs.readFileString(file);
  return yield* decodeJson(readFileString2);
});

const packedManifestViaHostTar = Effect.fnUntraced(function* (tarball: string) {
  const out = yield* spawnScrubbed("tar", ["-xzOf", tarball, "package/package.json"], OUTSIDE_ANY_PROJECT);
  assert.strictEqual(out.exitCode, 0, `host tar (bsdtar on macOS) reading package/package.json: ${out.stderr}`);
  return yield* decodeJson(out.stdout);
});

const packedNames = (tarballs: Readonly<Record<string, string>>): ReadonlyArray<string> =>
  A.sort(R.keys(tarballs), Str.Order);

const assertInstallPathPromises = Effect.fn("assertConsumer")(function* (
  consumer: InstalledConsumer,
  tarballs: Readonly<Record<string, string>>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const scratch = path.dirname(consumer.directory);
  const realPath3 = yield* fs.realPath(consumer.directory);
  assert.strictEqual(
    consumer.directory,
    realPath3,
    `${consumer.manager}: the scratch is realpath'd so file: specs and the install cwd agree`
  );
  if ((yield* HostProcessPlatform) === "darwin")
    assert.match(
      consumer.directory,
      /^\/private\//,
      `${consumer.manager}: darwin per the HostProcessPlatform reference, which defaults to this runner's`
    );
  for (const tarball of R.values(tarballs)) assert.isTrue(Str.startsWith(`${scratch}/`)(tarball), tarball);
  const inside = yield* spawnScrubbed(consumer.manager, ["--version"], consumer.directory);
  assert.strictEqual(inside.exitCode, 0, `${consumer.manager}: ${inside.stderr}`);
  const resolved = Str.replace(/^v/, "")(Str.trim(inside.stdout));
  assert.isTrue(Result.isSuccess(SemVer.parseResult(resolved)), `${consumer.manager} --version: ${resolved}`);
  assert.strictEqual(
    consumer.managerVersion,
    resolved,
    `${consumer.manager}, run inside the consumer under its own pin, keeps the version the run pinned; the pin is read here, never from a host PATH probe, which a shim can answer differently (the vite-plus pnpm shim answered 12.15.0 outside any project while the consumer resolved 12.16.1), so the probe checks availability only`
  );
  const manifest = yield* readJson(path.join(consumer.directory, "package.json"));
  if (consumer.manager === "pnpm") {
    assert.deepInclude(manifest, {
      devEngines: { packageManager: { name: "pnpm", version: resolved, onFail: "ignore" } },
    });
    assert.notProperty(manifest, "packageManager");
  } else {
    assert.deepInclude(manifest, { packageManager: `${consumer.manager}@${resolved}` });
  }
  const out = yield* spawnScrubbed(consumer.binPath(BIN_NAME), [], OUTSIDE_ANY_PROJECT);
  assert.strictEqual(Str.trim(out.stdout), GREETING, `${consumer.manager}: ${out.stderr}`);
  assert.strictEqual(
    out.exitCode,
    0,
    `${consumer.manager}: the bin, run through binPath while the scope is open, reaches the packed lib`
  );
  const ran = yield* consumer.runBin(BIN_NAME);
  assert.deepStrictEqual(
    [Str.trim(ran.stdout), ran.exitCode],
    [GREETING, 0],
    `${consumer.manager}: runBin, under the env the install carried, runs the same bin to the same result: ${ran.stderr}`
  );
  const provenance = yield* consumer.binProvenance(BIN_NAME);
  if (consumer.manager === "pnpm") {
    assert.isUndefined(provenance, "pnpm's .bin shim is not read");
  } else {
    assert.strictEqual(
      provenance?.package,
      CARRIER,
      `${consumer.manager}: a symlinking manager's .bin entry resolves into the carrier`
    );
    assert.isTrue(Str.startsWith(`${consumer.directory}/node_modules/`)(provenance?.target ?? ""), provenance?.target);
  }
});

describe("PackedInstall past the pack memfs cannot pre-seed: real packs, host tar, realpath, installs, bins, scratch removal", () => {
  layer(Live, { excludeTestServices: true, timeout: "30 seconds" })((it) => {
    it.effect("runs under bun, and every manager spawn gets the parent's context scrubbed", () =>
      Effect.sync(() => {
        assert.isAbove(
          PARENT_MANAGER_CONTEXT.length,
          0,
          "positive control: run this suite through bunx --bun so the scrub meets the real parent context, not a hand-written list"
        );
        assert.match(USER_AGENT, /^bun\//);
        assert.deepStrictEqual(
          A.filter(R.keys(INSTALL_SCRUBBED_ENV), (key) => A.contains(PARENT_MANAGER_CONTEXT, key)),
          []
        );
        assert.strictEqual(INSTALL_SCRUBBED_ENV.HTTPS_PROXY, DEAD_PROXY);
      })
    );

    it.effect.skipIf(!HAS_NPM)("the dead proxy the installs run behind really blocks the registry", () =>
      Effect.gen(function* () {
        const out = yield* spawnScrubbed(
          "npm",
          ["view", LIB, "version", "--prefer-online", "--fetch-retries=0"],
          OUTSIDE_ANY_PROJECT
        );
        assert.isFalse(
          out.succeeded,
          "without this control, installed with no network would be vacuous: a manager reaching the registry (an override that missed) or downloading itself (a packageManager pin not matching the running version) must fail, not quietly succeed"
        );
        assert.include(
          out.stderr,
          "ECONNREFUSED",
          "every manager honours HTTP(S)_PROXY and nothing listens on the dead proxy's port; assumes no proxy in ~/.npmrc: HOME is inherited on purpose, so a proxy or https-proxy there may win (precedence not verified) and this would fail with a proxy or E404 error instead, while the installs stay hermetic because the fixture has no external dependencies; the scrub strips every npm_config_* variable, so an env override cannot pin it from here"
        );
      }).pipe(Effect.timeout("25 seconds"))
    );

    const prodManagers = availableInOrder(["npm", "pnpm", "bun"]);
    it.effect.skipIf(!HAS_NPM)(
      "packs dist/prod/npm/pkg by default, installs under every available manager, runs the bin, then removes the scratch directory",
      () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
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
            const manifest = yield* packedManifestViaHostTar(O.getOrElse(R.get(result.tarballs, CARRIER), () => ""));
            assert.deepStrictEqual(manifest.dependencies, { [LIB]: VERSION });
            for (const consumer of result.consumers) yield* assertInstallPathPromises(consumer, result.tarballs);
            const scratch = path.dirname(O.getOrElse(A.head(A.map(result.consumers, (c) => c.directory)), () => ""));
            const exists4 = yield* fs.exists(scratch);
            assert.isTrue(exists4, "the scratch directory exists while the scope is open");
            return scratch;
          }).pipe(Scope.provide(scope));
          yield* Scope.close(scope, Exit.void);
          const exists5 = yield* fs.exists(seen);
          assert.isFalse(
            exists5,
            `${seen} survived the run's own scope, closed by hand so the removal is observed after it`
          );
        }).pipe(Effect.timeout("150 seconds")),
      180_000
    );

    const sourceManagers = availableInOrder(["npm", "pnpm", "bun"]);
    it.effect.skipIf(!HAS_PNPM)(
      "packs from source in the installed workspace, rewriting workspace:^, and every available manager's bin runs",
      () =>
        Effect.gen(function* () {
          const preinstall = O.getOrUndefined(OFFLINE_WORKSPACE_INSTALL);
          assert.strictEqual(
            preinstall?.exitCode,
            0,
            `pnpm packs a workspace: specifier only in an INSTALLED workspace (P3 C8), offline since the fixture has no external dependencies\n${preinstall?.stdout}\n${preinstall?.stderr}`
          );
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
          const manifest = yield* packedManifestViaHostTar(O.getOrElse(R.get(result.tarballs, CARRIER), () => ""));
          assert.deepStrictEqual(
            manifest.dependencies,
            { [LIB]: `^${VERSION}` },
            "pnpm rewrote workspace:^ to the lib's version"
          );
          assert.deepStrictEqual(
            A.map(result.consumers, (consumer) => consumer.manager),
            sourceManagers
          );
          for (const consumer of result.consumers) yield* assertInstallPathPromises(consumer, result.tarballs);
        }).pipe(Effect.timeout("150 seconds")),
      180_000
    );

    it.effect.skipIf(!HAS_YARN)(
      "yarn installs the packed carrier (skipped without yarn on PATH; passed 2026-09-23 under yarn 1.22.22 and 4.18.0)",
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
          assert.strictEqual(
            O.getOrUndefined(yarn)?.manager,
            "yarn",
            "runs on every machine with yarn on PATH (a GitHub-hosted runner ships yarn 1); the 2026-09-23 pass prepended scratch yarn installs to PATH"
          );
          if (O.isSome(yarn)) yield* assertInstallPathPromises(yarn.value, result.tarballs);
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

    const importPluginAndPeerFromRoot = (consumer: InstalledConsumer) =>
      spawnScrubbed(
        THIS_RUNTIME,
        [
          "--input-type=module",
          "-e",
          `import { greet } from "${LIB}"; import { shout } from "${PLUGIN}"; console.log(greet() + "|" + shout());`,
        ],
        consumer.directory
      );

    const s1Managers = availableInOrder(["npm", "pnpm", "bun"]);
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
            s1Managers,
            "npm included: a consumerDependencies range for a packed package once met npm's EOVERRIDE (a direct spec that differs from the override), which a pnpm-only run could not see"
          );
          for (const consumer of result.consumers) {
            const manifest = yield* readJson(path.join(consumer.directory, "package.json"));
            assert.deepInclude(
              manifest.dependencies,
              { [LIB]: `file:${O.getOrElse(R.get(result.tarballs, LIB), () => "")}` },
              `${consumer.manager}: the range the caller passed became the packed tarball, the one spec npm accepts beside the override`
            );
            const out = yield* importPluginAndPeerFromRoot(consumer);
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
          const out = yield* importPluginAndPeerFromRoot(pnpm.value);
          assert.isFalse(out.succeeded);
          assert.match(
            out.stderr,
            MODULE_NOT_FOUND,
            "Node reports ERR_MODULE_NOT_FOUND; under bunx --bun the runner and THIS_RUNTIME are Bun, which reports Cannot find module"
          );
          assert.include(out.stderr, LIB, "either way the unresolved specifier is the peer");
        }).pipe(Effect.timeout("100 seconds")),
      120_000
    );

    const sharedManagers = availableInOrder(["npm", "pnpm", "yarn", "bun"]);
    const refusedRunStopsBeforeInstall: PackedInstallBudget.Encoded = {
      managers: sharedManagers,
      installTimeout: "0 seconds",
      packages: 2,
      perConsumer: "0 seconds",
    };
    const allowedRunTwoBinsAMinuteEach: PackedInstallBudget.Encoded = {
      managers: sharedManagers,
      installTimeout: "90 seconds",
      packages: 2,
      perConsumer: "2 minutes",
    };
    const SHARED_GUARDS = guardsLetNamedErrorFireFirst(refusedRunStopsBeforeInstall, allowedRunTwoBinsAMinuteEach);
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
          assert.deepStrictEqual(
            [refused.reason, refused.package],
            ["BinConflict", SHARED_FRONT],
            "a front end sharing the carrier's bin name is a BinConflict by default"
          );

          const result = yield* PackedInstall.run({ ...options, allowSharedBins: true });
          const seen: Array<readonly [PackageManagerName, string]> = [];
          for (const consumer of result.consumers) {
            const slot = Str.trim((yield* consumer.runBin(SHARED_BIN)).stdout);
            const provenance = yield* consumer.binProvenance(SHARED_BIN);
            if (consumer.manager === "pnpm") {
              assert.isUndefined(provenance, "only pnpm's shell shims carry no provenance");
            } else {
              assert.isDefined(
                provenance,
                `${consumer.manager}: the flat layouts write .bin entries as symlinks, so their provenance is mandatory`
              );
              assert.strictEqual(
                slot,
                provenance?.package === SHARED_FRONT ? "front" : "carrier",
                `${consumer.manager}: what .bin ran agrees with who owns the slot`
              );
            }
            seen.push([consumer.manager, slot]);
            const own = yield* consumer.runCarrierBin(SHARED_BIN);
            assert.deepStrictEqual(
              [Str.trim(own.stdout), own.exitCode],
              ["carrier", 0],
              `${consumer.manager}: ${own.stderr}`
            );
          }
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
            R.fromEntries(A.map(sharedManagers, (pm) => [pm, winner[pm]] as const)),
            "every manager on PATH, yarn included: with npm 11.19 to 12.2 and bun 1.4.0-1.4.3 the name sorting first takes the slot, so shared-cli (the front end) beats shared-plugin (the carrier), as @vitest-agent/cli beats @vitest-agent/plugin, and named the other way round the carrier won both; bun 1.4.4 gives the slot to the carrier, the consumer's direct dependency, so bun's row is keyed by the bun consumer's pinned version; yarn 1.22 and 4.18 (node-modules linker) gave the slot to the carrier; pnpm links only the direct dependency"
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
  const everyManagerOnMachine = availableInOrder(["npm", "pnpm", "yarn", "bun"]);

  const assertBinReachesExternal = Effect.fn("assertLinked")(function* (consumers: ReadonlyArray<InstalledConsumer>) {
    assert.deepStrictEqual(
      A.map(consumers, (consumer) => consumer.manager),
      everyManagerOnMachine
    );
    for (const consumer of consumers) {
      const ran = yield* consumer.runBin(LINKED_BIN);
      assert.deepStrictEqual([Str.trim(ran.stdout), ran.exitCode], [BRIDGED, 0], `${consumer.manager}: ${ran.stderr}`);
      const direct = yield* Run.collect(consumer.command(LINKED_BIN), { timeout: "30 seconds" });
      assert.deepStrictEqual(
        [Str.trim(direct.stdout), direct.exitCode],
        [BRIDGED, 0],
        `${consumer.manager}: the command runBin builds reaches external through bridge too`
      );
      const resolved = yield* spawnScrubbed(
        THIS_RUNTIME,
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
      assert.strictEqual(
        Str.trim(resolved.stdout),
        EXTERNAL_VERSION,
        `${consumer.manager}: the external the bridge resolves is the supplied one, at the version no registry has: ${resolved.stderr}`
      );
    }
  });

  const CONTROL: PackageManagerName = ON_PATH.bun ? "bun" : "npm";
  const CONTROL_GUARDS_PAST_CHILD_KILL = guardsLetNamedErrorFireFirst({
    managers: [CONTROL],
    installTimeout: "90 seconds",
    packages: [LINKED, BRIDGE],
    perConsumer: "0 seconds",
  });
  const RUNBIN_COMMAND_RESOLVE_GUARDS = guardsLetNamedErrorFireFirst({
    managers: everyManagerOnMachine,
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
          assert.include(
            `${error.message}\n${error.output ?? ""}`,
            CONTROL === "bun" ? EXTERNAL : "timed out",
            "it failed on the external, not on something else: bun gives up on the dead proxy at once, npm and pnpm retry until installTimeout fires (about 90 seconds)"
          );
        }).pipe(Effect.timeout(CONTROL_GUARDS_PAST_CHILD_KILL.effect)),
      CONTROL_GUARDS_PAST_CHILD_KILL.vitest
    );

    it.effect.skipIf(!HAS_NPM)(
      "overrides: a supplied .tgz installs for the closure's transitive reference under every available manager",
      () =>
        Effect.gen(function* () {
          assert.isTrue(Str.endsWith(".tgz")(LINKED_FIXTURE.externalTarball), "the fixture packed external");
          const options = {
            carrier: LINKED,
            closure: "auto",
            managers: everyManagerOnMachine,
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
          yield* assertBinReachesExternal(result.consumers);
        }).pipe(Effect.timeout(RUNBIN_COMMAND_RESOLVE_GUARDS.effect)),
      RUNBIN_COMMAND_RESOLVE_GUARDS.vitest
    );

    it.effect.skipIf(!HAS_NPM)(
      "workspaceOverrides: the workspace's own file: link to a directory installs under every available manager",
      () =>
        Effect.gen(function* () {
          const result = yield* PackedInstall.run({
            carrier: LINKED,
            closure: "auto",
            managers: everyManagerOnMachine,
            require: "all",
            bins: [LINKED_BIN],
            env: OFFLINE,
            installTimeout: "90 seconds",
            workspaceOverrides: true,
          });
          assert.deepStrictEqual(R.keys(result.tarballs), [LINKED, BRIDGE, EXTERNAL]);
          const external = O.getOrElse(R.get(result.tarballs, EXTERNAL), () => "");
          assert.isTrue(
            Str.startsWith(`${result.scratch}/`)(external),
            `${external}: the directory was npm-packed into the scratch root, not used in place`
          );
          yield* assertBinReachesExternal(result.consumers);
        }).pipe(Effect.timeout(RUNBIN_COMMAND_RESOLVE_GUARDS.effect)),
      RUNBIN_COMMAND_RESOLVE_GUARDS.vitest
    );
  });
});
