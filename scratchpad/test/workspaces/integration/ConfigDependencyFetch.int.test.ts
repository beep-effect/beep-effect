// @effect-diagnostics strictEffectProvide:skip-file nodeBuiltinImport:skip-file processEnv:skip-file processEnvInEffect:skip-file
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
// and `node` run through `NodeServices`.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { afterAll, assert, beforeAll, beforeEach, describe, it } from "@effect/vitest";
import { CatalogAssemblyError } from "../../../effected/npm/index.ts";
import { Effect, Layer, Option } from "effect";
import { ConfigDependencyHooks, WorkspaceSnapshots, Workspaces } from "../../../effected/workspaces/index.ts";
import { installConfigDependency, writeFakePnpm, writeModulesYaml } from "./utils/configDependencyFixtures.ts";

const NAME = "cfg-842";
/** The integrity the base lockfile records for 0.11.1, and what the fake registry serves. */
const BASE_SRI = `sha512-${"A".repeat(86)}==`;
/** A different, well-formed integrity. */
const OTHER_SRI = `sha512-${"B".repeat(86)}==`;

let root: string;
let store: string;
let pnpmLog: string;
let binDir: string;
let savedPath: string | undefined;

const workspaceYaml = (spec: string): string =>
	[
		"packages:",
		"  - packages/*",
		"catalog:",
		"  effect: ^4.0.0",
		"configDependencies:",
		`  ${NAME}: '${spec}'`,
		"",
	].join("\n");

/** The two-document pnpm-lock.yaml pnpm 11/12 write for one config dependency (see the lockfiles fixtures env-configdeps-pnpm11/12). */
const lockfileRecording = (version: string, integrity: string): string =>
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
	].join("\n");

/** The fake pnpm's runs so far, in order. */
const pnpmRuns = (): ReadonlyArray<{
	readonly argv: ReadonlyArray<string>;
	readonly lockfile: string;
	readonly workspaceYaml: string;
	readonly npmrc: string | null;
}> =>
	existsSync(pnpmLog)
		? readFileSync(pnpmLog, "utf8")
				.split("\n")
				.filter((line) => line.length > 0)
				.map((line) => JSON.parse(line))
		: [];

beforeAll(() => {
	root = mkdtempSync(join(tmpdir(), "effected-842-repo-"));
	store = join(mkdtempSync(join(tmpdir(), "effected-842-store-")), "v11");
	mkdirSync(store, { recursive: true });
	const scratch = mkdtempSync(join(tmpdir(), "effected-842-bin-"));
	binDir = join(scratch, "bin");
	pnpmLog = join(scratch, "pnpm.log");
	writeFakePnpm(binDir);
	savedPath = process.env.PATH;
	process.env.PATH = `${binDir}${delimiter}${savedPath ?? ""}`;
	process.env.FAKE_PNPM_LOG = pnpmLog;
	process.env.FAKE_PNPM_PUBLISHED = JSON.stringify({ [`${NAME}@0.11.1`]: BASE_SRI });

	// The checkout after `pnpm install` on the bumped branch: .pnpm-config holds
	// 0.11.2 only, and the workspace store holds nothing of cfg-842.
	writeModulesYaml(root, store);
	installConfigDependency(root, NAME, "0.11.2", [
		"pnpmfile.mjs",
		'export const hooks = { updateConfig(config) { return { ...config, catalog: { ...(config.catalog ?? {}), "hooked-dep": "^0.11.2" } }; } };\n',
	]);
	writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root", version: "0.0.0", private: true }));
	mkdirSync(join(root, "packages", "a"), { recursive: true });
	writeFileSync(
		join(root, "packages", "a", "package.json"),
		JSON.stringify({ name: "@x/a", version: "1.0.0", dependencies: { "hooked-dep": "catalog:" } }),
	);
	writeFileSync(join(root, ".gitignore"), "node_modules\n");

	const git = (...args: ReadonlyArray<string>): void => {
		execFileSync("git", args, { cwd: root, env: { ...process.env, LC_ALL: "C", GIT_TERMINAL_PROMPT: "0" } });
	};
	const commit = (tag: string, spec: string, lockfile: string | undefined): void => {
		writeFileSync(join(root, "pnpm-workspace.yaml"), workspaceYaml(spec));
		if (lockfile === undefined) rmSync(join(root, "pnpm-lock.yaml"), { force: true });
		else writeFileSync(join(root, "pnpm-lock.yaml"), lockfile);
		git("add", "-A");
		git("commit", "-q", "--allow-empty", "-m", tag);
		git("tag", tag);
	};
	git("init", "-q");
	git("config", "user.email", "test@example.com");
	git("config", "user.name", "Test");
	// The #842 base: a bare spec, the integrity only in the lockfile preamble.
	commit("base", "0.11.1", lockfileRecording("0.11.1", BASE_SRI));
	// The legacy inline form and no lockfile at all: the inline integrity is the only record.
	commit("inline-only", `0.11.1+${BASE_SRI}`, undefined);
	// Inline and lockfile disagree.
	commit("mismatch", `0.11.1+${OTHER_SRI}`, lockfileRecording("0.11.1", BASE_SRI));
	// A bare spec and no lockfile: nothing to verify against.
	commit("unrecorded", "0.11.1", undefined);
	// The record says OTHER_SRI; the registry serves BASE_SRI — a tampered or
	// republished tarball, which pnpm's own check refuses.
	commit("tampered", "0.11.1", lockfileRecording("0.11.1", OTHER_SRI));
	// The bumped head, as installed.
	commit("head", "0.11.2", lockfileRecording("0.11.2", OTHER_SRI));
});

beforeEach(() => {
	// Every test starts from the #842 state: no 0.11.1 anywhere in the store,
	// and no pnpm runs yet.
	rmSync(join(store, "links"), { recursive: true, force: true });
	rmSync(pnpmLog, { force: true });
	// No `.npmrc` in the checkout, so the fake pnpm refuses a scratch that has one.
	rmSync(join(root, ".npmrc"), { force: true });
	process.env.FAKE_PNPM_EXPECT_NPMRC = "";
});

afterAll(() => {
	process.env.PATH = savedPath;
	delete process.env.FAKE_PNPM_LOG;
	delete process.env.FAKE_PNPM_PUBLISHED;
	delete process.env.FAKE_PNPM_EXPECT_NPMRC;
	for (const dir of [root, dirname(store), dirname(binDir)]) {
		if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
	}
});

const Subprocess = () =>
	Workspaces.layerWithGitAndConfigDependenciesSubprocess({ cwd: root }).pipe(Layer.provideMerge(NodeServices.layer));
const InProcess = () =>
	Workspaces.layerWithGitAndConfigDependencies({ cwd: root }).pipe(Layer.provideMerge(NodeServices.layer));

/** `at(ref)`'s failure, which must be a typed hooks-source assembly error. */
const failureAt = (ref: string) =>
	Effect.gen(function* () {
		const snapshots = yield* WorkspaceSnapshots;
		const error = yield* Effect.flip(snapshots.at(ref));
		assert.instanceOf(error, CatalogAssemblyError);
		assert.strictEqual(error.source, "hooks");
		assert.strictEqual(error.path, NAME);
		return error;
	});

describe("effected#842 — the base side of a config-dependency bump", () => {
	it.effect("the subprocess composite fetches the base version, verified, and the diff succeeds", () =>
		Effect.gen(function* () {
			const snapshots = yield* WorkspaceSnapshots;
			const base = yield* snapshots.at("base");
			const head = yield* snapshots.at("head");
			// Each side replays ITS OWN pinned version: the bump is a visible row.
			assert.deepStrictEqual(base.catalogs.rangeOf("hooked-dep", Option.none()), Option.some("^0.11.1"));
			assert.deepStrictEqual(head.catalogs.rangeOf("hooked-dep", Option.none()), Option.some("^0.11.2"));
			assert.deepStrictEqual(base.hookReplays, { [NAME]: "0.11.1" });

			// Exactly one fetch, pinned to the BASE lockfile's integrity, writing to
			// the store the ladder searched (pnpm appends the `v11` itself).
			const runs = pnpmRuns();
			assert.strictEqual(runs.length, 1);
			const [run] = runs;
			assert.deepStrictEqual(run?.argv.slice(0, 2), ["install", "--frozen-lockfile"]);
			assert.strictEqual(run?.argv[run.argv.indexOf("--store-dir") + 1], realpathSync(dirname(store)));
			assert.include(run?.lockfile, `resolution: {integrity: "${BASE_SRI}"}`);
			// The scratch workspace is gone.
			const scratch = run?.argv[run.argv.indexOf("--dir") + 1] ?? "";
			assert.isFalse(existsSync(scratch));
			// The checkout has no `.npmrc` and no registry keys, so none are invented.
			assert.isNull(run?.npmrc);
			assert.notInclude(run?.workspaceYaml, "registr");
		}).pipe(Effect.provide(Subprocess())),
	);

	it.effect("the fetch inherits the workspace's .npmrc verbatim and its registry keys", () => {
		// A scoped registry with an env-var token and a default-registry mirror:
		// the fetch must reach the registries `pnpm install` in the checkout would.
		// A literal `${NPM_TOKEN}` reference, spelled so it reads as npmrc text, not a template.
		const tokenRef = "$".concat("{NPM_TOKEN}");
		const npmrc = `@acme:registry=https://npm.acme.example/\n//npm.acme.example/:_authToken=${tokenRef}\n`;
		const yamlWithRegistries = [
			workspaceYaml("0.11.2"),
			"registry: https://mirror.example/",
			"registries:",
			"  '@acme': https://npm.acme.example/",
			"",
		].join("\n");
		return Effect.gen(function* () {
			writeFileSync(join(root, ".npmrc"), npmrc);
			writeFileSync(join(root, "pnpm-workspace.yaml"), yamlWithRegistries);
			process.env.FAKE_PNPM_EXPECT_NPMRC = npmrc;
			const hooks = yield* ConfigDependencyHooks;
			const lockfile = lockfileRecording("0.11.1", BASE_SRI);
			const result = yield* hooks.inject(root, { [NAME]: "0.11.1" }, {}, undefined, { lockfile, ref: "base" });
			assert.deepStrictEqual(result.replays, { [NAME]: { version: "0.11.1", source: "fetched" } });
			const [run] = pnpmRuns();
			// Byte for byte: the `${NPM_TOKEN}` reference is pnpm's to expand.
			assert.strictEqual(run?.npmrc, npmrc);
			assert.include(run?.workspaceYaml, 'registry: "https://mirror.example/"');
			assert.include(run?.workspaceYaml, 'registries:\n  "@acme": "https://npm.acme.example/"');
			// The copy goes with the scratch.
			assert.isFalse(existsSync(run?.argv[run.argv.indexOf("--dir") + 1] ?? ""));
		}).pipe(
			Effect.ensuring(
				Effect.sync(() => {
					rmSync(join(root, ".npmrc"), { force: true });
					writeFileSync(join(root, "pnpm-workspace.yaml"), workspaceYaml("0.11.2"));
				}),
			),
			Effect.provide(ConfigDependencyHooks.layerSubprocess.pipe(Layer.provide(NodeServices.layer))),
		);
	});

	it.effect("the replay records that the fetch rung answered, and the next replay finds it in the store", () =>
		Effect.gen(function* () {
			const hooks = yield* ConfigDependencyHooks;
			const lockfile = lockfileRecording("0.11.1", BASE_SRI);
			const first = yield* hooks.inject(root, { [NAME]: "0.11.1" }, {}, undefined, { lockfile, ref: "base" });
			assert.deepStrictEqual(first.replays, { [NAME]: { version: "0.11.1", source: "fetched" } });
			const second = yield* hooks.inject(root, { [NAME]: "0.11.1" }, {}, undefined, { lockfile, ref: "base" });
			assert.deepStrictEqual(second.replays, { [NAME]: { version: "0.11.1", source: "store" } });
			assert.strictEqual(pnpmRuns().length, 1);
		}).pipe(Effect.provide(ConfigDependencyHooks.layerSubprocess.pipe(Layer.provide(NodeServices.layer)))),
	);

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
			assert.strictEqual(pnpmRuns().length, 0);
		}).pipe(Effect.provide(InProcess())),
	);

	it.effect("the legacy inline integrity alone verifies a fetch when the side has no lockfile", () =>
		Effect.gen(function* () {
			const snapshots = yield* WorkspaceSnapshots;
			const snapshot = yield* snapshots.at("inline-only");
			assert.deepStrictEqual(snapshot.catalogs.rangeOf("hooked-dep", Option.none()), Option.some("^0.11.1"));
			assert.include(pnpmRuns()[0]?.lockfile, BASE_SRI);
		}).pipe(Effect.provide(Subprocess())),
	);
});

describe("effected#842 — the fetch is never unverified", () => {
	it.effect("inline and lockfile integrities that disagree fail integrityMismatch, and nothing runs", () =>
		Effect.gen(function* () {
			const error = yield* failureAt("mismatch");
			assert.strictEqual(error.reason, "integrityMismatch");
			assert.include(error.message, OTHER_SRI);
			assert.include(error.message, BASE_SRI);
			assert.strictEqual(pnpmRuns().length, 0);
		}).pipe(Effect.provide(Subprocess())),
	);

	it.effect("a bare spec with no lockfile fails integrityUnavailable, and nothing runs", () =>
		Effect.gen(function* () {
			const error = yield* failureAt("unrecorded");
			assert.strictEqual(error.reason, "integrityUnavailable");
			assert.include(error.message, "ref unrecorded records no integrity");
			assert.strictEqual(pnpmRuns().length, 0);
		}).pipe(Effect.provide(Subprocess())),
	);

	it.effect("a served tarball that does not match the recorded integrity fails fetchFailed, with no replay", () =>
		Effect.gen(function* () {
			const error = yield* failureAt("tampered");
			assert.strictEqual(error.reason, "fetchFailed");
			assert.include(error.message, "ERR_PNPM_TARBALL_INTEGRITY");
			assert.include(error.message, `pnpm add --config ${NAME}@0.11.1`);
			// pnpm ran once, pinned to the tampered record, and installed nothing.
			assert.strictEqual(pnpmRuns().length, 1);
			assert.include(pnpmRuns()[0]?.lockfile, OTHER_SRI);
			assert.isFalse(existsSync(join(store, "links", NAME, "0.11.1")));
		}).pipe(Effect.provide(Subprocess())),
	);
});
