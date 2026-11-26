import { CatalogAssemblyError } from "@beep/npm-spec/CatalogAssemblyError";
import { ConfigDependencyHooks, WorkspaceSnapshots, Workspaces } from "@beep/repo-workspaces";
import { HookReplay } from "@beep/repo-workspaces/ConfigDependencyReplay";
import { HostProcessPlatform } from "@beep/utils/HostProcess";
import { join } from "@beep/utils/Path";
import { afterAll, assert, beforeAll, beforeEach, describe, it, vi } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { installConfigDependency, writeFakePnpm, writeModulesYaml } from "./utils/configDependencyFixtures.ts";
import { gitIn, makeNodeFixture, nodeHost } from "./utils/nodeFixture.ts";

const NAME = "cfg-842";
const BASE_SRI = `sha512-${Str.repeat(86)("A")}==`;
const OTHER_SRI = `sha512-${Str.repeat(86)("B")}==`;

let root: string;
let store: string;
let storeParentReal: string;
let pnpmLog: string;
const fixture = makeNodeFixture();

const workspaceYaml = (spec: string): string =>
  A.join(
    ["packages:", "  - packages/*", "catalog:", "  effect: ^4.0.0", "configDependencies:", `  ${NAME}: '${spec}'`, ""],
    "\n"
  );

const pnpm11Or12ConfigLockfile = (version: string, integrity: string): string =>
  A.join(
    [
      "---",
      "lockfileVersion: '9.0'",
      "",
      "importers:",
      "",
      "  .:",
      "    configDependencies:",
      `      ${NAME}:`,
      `        specifier: ${version}`,
      `        version: ${version}`,
      "",
      "packages:",
      "",
      `  ${NAME}@${version}:`,
      `    resolution: {integrity: ${integrity}}`,
      "",
      "snapshots:",
      "",
      `  ${NAME}@${version}: {}`,
      "",
      "---",
      "lockfileVersion: '9.0'",
      "",
      "importers:",
      "",
      "  .: {}",
      "",
    ],
    "\n"
  );

const PnpmRun = S.Struct({
  argv: S.Array(S.String),
  lockfile: S.String,
  workspaceYaml: S.String,
  npmrc: S.NullOr(S.String),
});
const PnpmRunLine = S.fromJsonString(PnpmRun);

const pnpmRunsInOrder = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  if (!(yield* fs.exists(pnpmLog))) return A.empty<typeof PnpmRun.Type>();
  const readFileString1 = yield* fs.readFileString(pnpmLog);
  const lines = A.filter(Str.split(readFileString1, "\n"), Str.isNonEmpty);
  return yield* Effect.forEach(lines, (line) => S.decodeEffect(PnpmRunLine)(line), { concurrency: 1 });
});

const setUp = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const tracked = fixture.tempDirectory;
  root = yield* tracked("effected-842-repo-");
  const git = gitIn(root);
  const storeParent = yield* tracked("effected-842-store-");
  store = join(storeParent, "v11");
  yield* fs.makeDirectory(store, { recursive: true });
  storeParentReal = yield* fs.realPath(storeParent);
  const scratch = yield* tracked("effected-842-bin-");
  const binDir = join(scratch, "bin");
  pnpmLog = join(scratch, "pnpm.log");
  yield* writeFakePnpm(binDir);
  const delimiter = (yield* HostProcessPlatform) === "win32" ? ";" : ":";
  const path = yield* Config.String("PATH").pipe(Config.withDefault(""));
  vi.stubEnv("PATH", `${binDir}${delimiter}${path}`);
  vi.stubEnv("FAKE_PNPM_LOG", pnpmLog);
  vi.stubEnv("FAKE_PNPM_PUBLISHED", `{"${NAME}@0.11.1":"${BASE_SRI}"}`);

  yield* writeModulesYaml(root, store);
  yield* installConfigDependency(root, NAME, "0.11.2", [
    "pnpmfile.mjs",
    'export const hooks = { updateConfig(config) { return { ...config, catalog: { ...(config.catalog ?? {}), "hooked-dep": "^0.11.2" } }; } };\n',
  ]);
  yield* fs.writeFileString(join(root, "package.json"), '{"name":"root","version":"0.0.0","private":true}');
  yield* fs.makeDirectory(join(root, "packages", "a"), { recursive: true });
  yield* fs.writeFileString(
    join(root, "packages", "a", "package.json"),
    '{"name":"@x/a","version":"1.0.0","dependencies":{"hooked-dep":"catalog:"}}'
  );
  yield* fs.writeFileString(join(root, ".gitignore"), "node_modules\n");

  const commit = Effect.fnUntraced(function* (tag: string, spec: string, lockfile: string | undefined) {
    yield* fs.writeFileString(join(root, "pnpm-workspace.yaml"), workspaceYaml(spec));
    if (lockfile === undefined) yield* fs.remove(join(root, "pnpm-lock.yaml"), { force: true });
    else yield* fs.writeFileString(join(root, "pnpm-lock.yaml"), lockfile);
    yield* git("add", "-A");
    yield* git("commit", "-q", "--allow-empty", "-m", tag);
    yield* git("tag", tag);
  });
  yield* git("init", "-q");
  yield* git("config", "user.email", "test@example.com");
  yield* git("config", "user.name", "Test");
  yield* commit("base", "0.11.1", pnpm11Or12ConfigLockfile("0.11.1", BASE_SRI));
  yield* commit("inline-only", `0.11.1+${BASE_SRI}`, undefined);
  yield* commit("mismatch", `0.11.1+${OTHER_SRI}`, pnpm11Or12ConfigLockfile("0.11.1", BASE_SRI));
  yield* commit("unrecorded", "0.11.1", undefined);
  yield* commit("tampered", "0.11.1", pnpm11Or12ConfigLockfile("0.11.1", OTHER_SRI));
  yield* commit("head", "0.11.2", pnpm11Or12ConfigLockfile("0.11.2", OTHER_SRI));
});

beforeAll(() => fixture.runtime.runPromise(setUp));

beforeEach(() => {
  const checkoutHasNoNpmrc = "";
  vi.stubEnv("FAKE_PNPM_EXPECT_NPMRC", checkoutHasNoNpmrc);
  const resetToUnfetchedBase = Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    yield* fs.remove(join(store, "links"), { recursive: true, force: true });
    yield* fs.remove(pnpmLog, { force: true });
    yield* fs.remove(join(root, ".npmrc"), { force: true });
  });
  return fixture.runtime.runPromise(resetToUnfetchedBase);
});

afterAll(() => {
  vi.unstubAllEnvs();
  return fixture.close();
});

const Subprocess = () =>
  Workspaces.layerWithGitAndConfigDependenciesSubprocess({ cwd: root }).pipe(Layer.provideMerge(nodeHost));
const InProcess = () => Workspaces.layerWithGitAndConfigDependencies({ cwd: root }).pipe(Layer.provideMerge(nodeHost));

const failureAt = Effect.fn("failureAt")(function* (ref: string) {
  const snapshots = yield* WorkspaceSnapshots;
  const error = yield* Effect.flip(snapshots.at(ref));
  assert.instanceOf(error, CatalogAssemblyError);
  assert.strictEqual(error.source, "hooks");
  assert.strictEqual(error.path, NAME);
  return error;
});

describe("the base side of a config-dependency bump the checkout never installed, over real git and a fake pnpm", () => {
  it.layer(Layer.unwrap(Effect.sync(Subprocess)), { timeout: "30 seconds" })((it) => {
    it.effect(
      "the subprocess composite fetches the bare-spec base version, lockfile-preamble integrity verified; the diff succeeds",
      () =>
        Effect.gen(function* () {
          const snapshots = yield* WorkspaceSnapshots;
          const base = yield* snapshots.at("base");
          const head = yield* snapshots.at("head");
          const baseReplaysItsOwnPin = base.catalogs.rangeOf("hooked-dep", O.none());
          assertSome(baseReplaysItsOwnPin, "^0.11.1");
          const headReplaysItsOwnPin = head.catalogs.rangeOf("hooked-dep", O.none());
          assertSome(headReplaysItsOwnPin, "^0.11.2");
          assert.deepStrictEqual(base.hookReplays, { [NAME]: "0.11.1" });

          const runs = yield* pnpmRunsInOrder;
          assert.strictEqual(runs.length, 1, "exactly one fetch");
          const [run] = runs;
          assert.deepStrictEqual(run?.argv.slice(0, 2), ["install", "--frozen-lockfile"]);
          assert.strictEqual(
            run?.argv[run.argv.indexOf("--store-dir") + 1],
            storeParentReal,
            "the fetch hands pnpm the canonical spelling of the store parent the ladder searched; pnpm appends v11 itself"
          );
          assert.include(
            run?.lockfile,
            `resolution: {integrity: "${BASE_SRI}"}`,
            "pinned to the base lockfile integrity"
          );
          const scratch = run?.argv[run.argv.indexOf("--dir") + 1] ?? "";
          const scratchStillExists = yield* (yield* FileSystem.FileSystem).exists(scratch);
          assert.isFalse(scratchStillExists, "the scratch workspace is gone");
          assert.isNull(run?.npmrc, "the checkout has no .npmrc and no registry keys, so none are invented");
          assert.notInclude(run?.workspaceYaml, "registry");
          assert.notInclude(run?.workspaceYaml, "registries");
        })
    );
  });

  it.layer(Layer.unwrap(Effect.sync(() => ConfigDependencyHooks.layerSubprocess.pipe(Layer.provideMerge(nodeHost)))), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("the fetch inherits the workspace's .npmrc verbatim and its registry keys", () => {
      const literalNpmTokenReference = `${"$"}{NPM_TOKEN}`;
      const npmrc = `@acme:registry=https://npm.acme.example/\n//npm.acme.example/:_authToken=${literalNpmTokenReference}\n`;
      const yamlWithRegistries = A.join(
        [
          workspaceYaml("0.11.2"),
          "registry: https://mirror.example/",
          "registries:",
          "  '@acme': https://npm.acme.example/",
          "",
        ],
        "\n"
      );
      return Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.writeFileString(join(root, ".npmrc"), npmrc);
        yield* fs.writeFileString(join(root, "pnpm-workspace.yaml"), yamlWithRegistries);
        vi.stubEnv("FAKE_PNPM_EXPECT_NPMRC", npmrc);
        const hooks = yield* ConfigDependencyHooks;
        const lockfile = pnpm11Or12ConfigLockfile("0.11.1", BASE_SRI);
        const result = yield* hooks.inject(root, { [NAME]: "0.11.1" }, {}, undefined, { lockfile, ref: "base" });
        assert.deepStrictEqual(result.replays, { [NAME]: HookReplay.make({ version: "0.11.1", source: "fetched" }) });
        const [run] = yield* pnpmRunsInOrder;
        assert.strictEqual(run?.npmrc, npmrc, "byte for byte: the NPM_TOKEN reference is pnpm's to expand");
        assert.include(run?.workspaceYaml, 'registry: "https://mirror.example/"');
        assert.include(
          run?.workspaceYaml,
          'registries:\n  "@acme": "https://npm.acme.example/"',
          "the fetch must reach the registries pnpm install in the checkout would: a scoped registry with an env-var token and a default-registry mirror"
        );
        const npmrcCopyExists = yield* fs.exists(run?.argv[run.argv.indexOf("--dir") + 1] ?? "");
        assert.isFalse(npmrcCopyExists, "the copy goes with the scratch");
      }).pipe(
        Effect.ensuring(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* fs.remove(join(root, ".npmrc"), { force: true });
            yield* fs.writeFileString(join(root, "pnpm-workspace.yaml"), workspaceYaml("0.11.2"));
          }).pipe(Effect.orDie)
        )
      );
    });
  });

  it.layer(Layer.unwrap(Effect.sync(() => ConfigDependencyHooks.layerSubprocess.pipe(Layer.provideMerge(nodeHost)))), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("the replay records that the fetch rung answered, and the next replay finds it in the store", () =>
      Effect.gen(function* () {
        const hooks = yield* ConfigDependencyHooks;
        const lockfile = pnpm11Or12ConfigLockfile("0.11.1", BASE_SRI);
        const first = yield* hooks.inject(root, { [NAME]: "0.11.1" }, {}, undefined, { lockfile, ref: "base" });
        assert.deepStrictEqual(first.replays, { [NAME]: HookReplay.make({ version: "0.11.1", source: "fetched" }) });
        const second = yield* hooks.inject(root, { [NAME]: "0.11.1" }, {}, undefined, { lockfile, ref: "base" });
        assert.deepStrictEqual(second.replays, { [NAME]: HookReplay.make({ version: "0.11.1", source: "store" }) });
        assert.strictEqual((yield* pnpmRunsInOrder).length, 1);
      })
    );
  });

  it.layer(Layer.unwrap(Effect.sync(InProcess)), { timeout: "30 seconds" })((it) => {
    it.effect("a non-fetching layer fails with the distinct notInstalled reason, naming the base side", () =>
      Effect.gen(function* () {
        const error = yield* failureAt("base");
        assert.strictEqual(error.reason, "notInstalled");
        assert.include(error.message, `${NAME}@0.11.1 (declared at ref base) is not installed`);
        assert.include(error.message, "holds version 0.11.2");
        assert.include(error.message, "the base side of a diff across a config-dependency bump");
        assert.include(error.message, `pnpm add --config ${NAME}@0.11.1`);
        assert.include(
          error.message,
          "This replay layer does not fetch; ConfigDependencyHooks.layerSubprocess",
          "the remediation names the primitive that fetches, not one composite"
        );
        assert.strictEqual((yield* pnpmRunsInOrder).length, 0);
      })
    );
  });

  it.layer(Layer.unwrap(Effect.sync(Subprocess)), { timeout: "30 seconds" })((it) => {
    it.effect("the legacy inline integrity alone verifies a fetch when the side has no lockfile", () =>
      Effect.gen(function* () {
        const snapshots = yield* WorkspaceSnapshots;
        const snapshot = yield* snapshots.at("inline-only");
        assertSome(snapshot.catalogs.rangeOf("hooked-dep", O.none()), "^0.11.1");
        assert.include((yield* pnpmRunsInOrder)[0]?.lockfile, BASE_SRI);
      })
    );
  });
});

describe("effected#842 — the fetch is never unverified", () => {
  it.layer(Layer.unwrap(Effect.sync(Subprocess)), { timeout: "30 seconds" })((it) => {
    it.effect("inline and lockfile integrities that disagree fail integrityMismatch, and nothing runs", () =>
      Effect.gen(function* () {
        const error = yield* failureAt("mismatch");
        assert.strictEqual(error.reason, "integrityMismatch");
        assert.include(error.message, OTHER_SRI);
        assert.include(error.message, BASE_SRI);
        assert.strictEqual((yield* pnpmRunsInOrder).length, 0);
      })
    );
  });

  it.layer(Layer.unwrap(Effect.sync(Subprocess)), { timeout: "30 seconds" })((it) => {
    it.effect("a bare spec with no lockfile fails integrityUnavailable, and nothing runs", () =>
      Effect.gen(function* () {
        const error = yield* failureAt("unrecorded");
        assert.strictEqual(error.reason, "integrityUnavailable");
        assert.include(error.message, "ref unrecorded records no integrity");
        assert.strictEqual((yield* pnpmRunsInOrder).length, 0);
      })
    );
  });

  it.layer(Layer.unwrap(Effect.sync(Subprocess)), { timeout: "30 seconds" })((it) => {
    it.effect("a served tarball that does not match the recorded integrity fails fetchFailed, with no replay", () =>
      Effect.gen(function* () {
        const error = yield* failureAt("tampered");
        assert.strictEqual(error.reason, "fetchFailed");
        assert.include(
          error.message,
          "ERR_PNPM_TARBALL_INTEGRITY",
          "the fake pnpm refuses a tampered or republished tarball whose integrity does not match the pinned lockfile, as pnpm 11.27.1 and 12.6.0 do (probed for the real command)"
        );
        assert.include(error.message, `pnpm add --config ${NAME}@0.11.1`);
        assert.strictEqual(
          (yield* pnpmRunsInOrder).length,
          1,
          "pnpm ran once, pinned to the tampered record, and installed nothing"
        );
        assert.include((yield* pnpmRunsInOrder)[0]?.lockfile, OTHER_SRI);
        const tamperedVersionStored = yield* (yield* FileSystem.FileSystem).exists(
          join(store, "links", NAME, "0.11.1")
        );
        assert.isFalse(tamperedVersionStored);
      })
    );
  });
});
