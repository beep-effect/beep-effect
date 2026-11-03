// effected#842: a diff across a config-dependency bump, where the BASE side
// declares a version this checkout never installed.
//
// A real git repository: `base` pins cfg-842@0.11.1 as a bare spec, with the
// integrity only in its pnpm-lock.yaml env preamble; `head` bumps it to
// 0.11.2, which is what `.pnpm-config` holds. The store holds no 0.11.1.
// Further tags break the integrity record one way each.
//
// No live package manager runs. A fake `pnpm` on PATH (see
// `writeFakePnpm`) stands in for the fetch rung's `pnpm install
// --frozen-lockfile`: it serves each version from a fake registry and refuses
// a tarball whose integrity does not match the pinned lockfile, as pnpm does
// (probed against pnpm 11.27.1 and 12.6.0 for the real command). Real `git`
// and `node` run through `NodeServices`, and the fixture is written through
// Effect's FileSystem on the same platform services.

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
/** The integrity the base lockfile records for 0.11.1, and what the fake registry serves. */
const BASE_SRI = `sha512-${Str.repeat(86)("A")}==`;
/** A different, well-formed integrity. */
const OTHER_SRI = `sha512-${Str.repeat(86)("B")}==`;

let root: string;
let store: string;
/** The canonical spelling of the store's parent, as the fetch hands it to pnpm. */
let storeParentReal: string;
let pnpmLog: string;
const fixture = makeNodeFixture();

const workspaceYaml = (spec: string): string =>
  A.join(
    ["packages:", "  - packages/*", "catalog:", "  effect: ^4.0.0", "configDependencies:", `  ${NAME}: '${spec}'`, ""],
    "\n"
  );

/** The two-document pnpm-lock.yaml pnpm 11/12 write for one config dependency (see the lockfiles fixtures env-configdeps-pnpm11/12). */
const lockfileRecording = (version: string, integrity: string): string =>
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

/** One line of the fake pnpm's log. */
const PnpmRun = S.Struct({
  argv: S.Array(S.String),
  lockfile: S.String,
  workspaceYaml: S.String,
  npmrc: S.NullOr(S.String),
});
const PnpmRunLine = S.fromJsonString(PnpmRun);

/** The fake pnpm's runs so far, in order. */
const pnpmRuns = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  if (!(yield* fs.exists(pnpmLog))) return A.empty<typeof PnpmRun.Type>();
  const readFileString1 = yield* fs.readFileString(pnpmLog);
  const lines = A.filter(Str.split(readFileString1, "\n"), Str.isNonEmpty);
  return yield* Effect.forEach(lines, (line) => S.decodeEffect(PnpmRunLine)(line));
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

  // The checkout after `pnpm install` on the bumped branch: .pnpm-config holds
  // 0.11.2 only, and the workspace store holds nothing of cfg-842.
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
  // The #842 base: a bare spec, the integrity only in the lockfile preamble.
  yield* commit("base", "0.11.1", lockfileRecording("0.11.1", BASE_SRI));
  // The legacy inline form and no lockfile at all: the inline integrity is the only record.
  yield* commit("inline-only", `0.11.1+${BASE_SRI}`, undefined);
  // Inline and lockfile disagree.
  yield* commit("mismatch", `0.11.1+${OTHER_SRI}`, lockfileRecording("0.11.1", BASE_SRI));
  // A bare spec and no lockfile: nothing to verify against.
  yield* commit("unrecorded", "0.11.1", undefined);
  // The record says OTHER_SRI; the registry serves BASE_SRI — a tampered or
  // republished tarball, which pnpm's own check refuses.
  yield* commit("tampered", "0.11.1", lockfileRecording("0.11.1", OTHER_SRI));
  // The bumped head, as installed.
  yield* commit("head", "0.11.2", lockfileRecording("0.11.2", OTHER_SRI));
});

beforeAll(() => fixture.runtime.runPromise(setUp));

beforeEach(() => {
  // No `.npmrc` in the checkout, so the fake pnpm refuses a scratch that has one.
  vi.stubEnv("FAKE_PNPM_EXPECT_NPMRC", "");
  // Every test starts from the #842 state: no 0.11.1 anywhere in the store,
  // and no pnpm runs yet.
  return fixture.runtime.runPromise(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.remove(join(store, "links"), { recursive: true, force: true });
      yield* fs.remove(pnpmLog, { force: true });
      yield* fs.remove(join(root, ".npmrc"), { force: true });
    })
  );
});

afterAll(() => {
  vi.unstubAllEnvs();
  return fixture.close();
});

const Subprocess = () =>
  Workspaces.layerWithGitAndConfigDependenciesSubprocess({ cwd: root }).pipe(Layer.provideMerge(nodeHost));
const InProcess = () => Workspaces.layerWithGitAndConfigDependencies({ cwd: root }).pipe(Layer.provideMerge(nodeHost));

/** `at(ref)`'s failure, which must be a typed hooks-source assembly error. */
const failureAt = Effect.fn("failureAt")(function* (ref: string) {
  const snapshots = yield* WorkspaceSnapshots;
  const error = yield* Effect.flip(snapshots.at(ref));
  assert.instanceOf(error, CatalogAssemblyError);
  assert.strictEqual(error.source, "hooks");
  assert.strictEqual(error.path, NAME);
  return error;
});

describe("effected#842 — the base side of a config-dependency bump", () => {
  it.layer(Layer.unwrap(Effect.sync(Subprocess)), { timeout: "30 seconds" })((it) => {
    it.effect("the subprocess composite fetches the base version, verified, and the diff succeeds", () =>
      Effect.gen(function* () {
        const snapshots = yield* WorkspaceSnapshots;
        const base = yield* snapshots.at("base");
        const head = yield* snapshots.at("head");
        // Each side replays ITS OWN pinned version: the bump is a visible row.
        assertSome(base.catalogs.rangeOf("hooked-dep", O.none()), "^0.11.1");
        assertSome(head.catalogs.rangeOf("hooked-dep", O.none()), "^0.11.2");
        assert.deepStrictEqual(base.hookReplays, { [NAME]: "0.11.1" });

        // Exactly one fetch, pinned to the BASE lockfile's integrity, writing to
        // the store the ladder searched (pnpm appends the `v11` itself).
        const runs = yield* pnpmRuns;
        assert.strictEqual(runs.length, 1);
        const [run] = runs;
        assert.deepStrictEqual(run?.argv.slice(0, 2), ["install", "--frozen-lockfile"]);
        assert.strictEqual(run?.argv[run.argv.indexOf("--store-dir") + 1], storeParentReal);
        assert.include(run?.lockfile, `resolution: {integrity: "${BASE_SRI}"}`);
        // The scratch workspace is gone.
        const scratch = run?.argv[run.argv.indexOf("--dir") + 1] ?? "";
        const exists2 = yield* (yield* FileSystem.FileSystem).exists(scratch);
        assert.isFalse(exists2);
        // The checkout has no `.npmrc` and no registry keys, so none are invented.
        assert.isNull(run?.npmrc);
        assert.notInclude(run?.workspaceYaml, "registry");
        assert.notInclude(run?.workspaceYaml, "registries");
      })
    );
  });

  it.layer(Layer.unwrap(Effect.sync(() => ConfigDependencyHooks.layerSubprocess.pipe(Layer.provideMerge(nodeHost)))), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("the fetch inherits the workspace's .npmrc verbatim and its registry keys", () => {
      // A scoped registry with an env-var token and a default-registry mirror:
      // the fetch must reach the registries `pnpm install` in the checkout would.
      // A literal `${NPM_TOKEN}` reference, spelled so it reads as npmrc text, not a template.
      const tokenRef = `${"$"}{NPM_TOKEN}`;
      const npmrc = `@acme:registry=https://npm.acme.example/\n//npm.acme.example/:_authToken=${tokenRef}\n`;
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
        const lockfile = lockfileRecording("0.11.1", BASE_SRI);
        const result = yield* hooks.inject(root, { [NAME]: "0.11.1" }, {}, undefined, { lockfile, ref: "base" });
        assert.deepStrictEqual(result.replays, { [NAME]: HookReplay.make({ version: "0.11.1", source: "fetched" }) });
        const [run] = yield* pnpmRuns;
        // Byte for byte: the `${NPM_TOKEN}` reference is pnpm's to expand.
        assert.strictEqual(run?.npmrc, npmrc);
        assert.include(run?.workspaceYaml, 'registry: "https://mirror.example/"');
        assert.include(run?.workspaceYaml, 'registries:\n  "@acme": "https://npm.acme.example/"');
        // The copy goes with the scratch.
        const exists3 = yield* fs.exists(run?.argv[run.argv.indexOf("--dir") + 1] ?? "");
        assert.isFalse(exists3);
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
        const lockfile = lockfileRecording("0.11.1", BASE_SRI);
        const first = yield* hooks.inject(root, { [NAME]: "0.11.1" }, {}, undefined, { lockfile, ref: "base" });
        assert.deepStrictEqual(first.replays, { [NAME]: HookReplay.make({ version: "0.11.1", source: "fetched" }) });
        const second = yield* hooks.inject(root, { [NAME]: "0.11.1" }, {}, undefined, { lockfile, ref: "base" });
        assert.deepStrictEqual(second.replays, { [NAME]: HookReplay.make({ version: "0.11.1", source: "store" }) });
        assert.strictEqual((yield* pnpmRuns).length, 1);
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
        // The remediation names the primitive that fetches, not one composite.
        assert.include(error.message, "This replay layer does not fetch; ConfigDependencyHooks.layerSubprocess");
        assert.strictEqual((yield* pnpmRuns).length, 0);
      })
    );
  });

  it.layer(Layer.unwrap(Effect.sync(Subprocess)), { timeout: "30 seconds" })((it) => {
    it.effect("the legacy inline integrity alone verifies a fetch when the side has no lockfile", () =>
      Effect.gen(function* () {
        const snapshots = yield* WorkspaceSnapshots;
        const snapshot = yield* snapshots.at("inline-only");
        assertSome(snapshot.catalogs.rangeOf("hooked-dep", O.none()), "^0.11.1");
        assert.include((yield* pnpmRuns)[0]?.lockfile, BASE_SRI);
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
        assert.strictEqual((yield* pnpmRuns).length, 0);
      })
    );
  });

  it.layer(Layer.unwrap(Effect.sync(Subprocess)), { timeout: "30 seconds" })((it) => {
    it.effect("a bare spec with no lockfile fails integrityUnavailable, and nothing runs", () =>
      Effect.gen(function* () {
        const error = yield* failureAt("unrecorded");
        assert.strictEqual(error.reason, "integrityUnavailable");
        assert.include(error.message, "ref unrecorded records no integrity");
        assert.strictEqual((yield* pnpmRuns).length, 0);
      })
    );
  });

  it.layer(Layer.unwrap(Effect.sync(Subprocess)), { timeout: "30 seconds" })((it) => {
    it.effect("a served tarball that does not match the recorded integrity fails fetchFailed, with no replay", () =>
      Effect.gen(function* () {
        const error = yield* failureAt("tampered");
        assert.strictEqual(error.reason, "fetchFailed");
        assert.include(error.message, "ERR_PNPM_TARBALL_INTEGRITY");
        assert.include(error.message, `pnpm add --config ${NAME}@0.11.1`);
        // pnpm ran once, pinned to the tampered record, and installed nothing.
        assert.strictEqual((yield* pnpmRuns).length, 1);
        assert.include((yield* pnpmRuns)[0]?.lockfile, OTHER_SRI);
        const exists4 = yield* (yield* FileSystem.FileSystem).exists(join(store, "links", NAME, "0.11.1"));
        assert.isFalse(exists4);
      })
    );
  });
});
