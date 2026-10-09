import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
// Everything PackedInstall decides that does not need a process: which
// variables leak the parent manager's context, what each manager's consumer
// project looks like, and how each spells "skip lifecycle scripts". Pure, so
// every per-manager trap is pinned without spawning one.

import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { PackageManagerName } from "../PackageManagerName.ts";
import type { WorkspacePackage } from "../WorkspacePackage.ts";
import { RUNTIME_DEPENDENCY_FIELDS } from "./dependencyFields.ts";

const $I = $ScratchpadId.create("effected/workspaces/internal/packedInstallPlan");

class PackedManifestError extends S.TaggedError<PackedManifestError>($I`PackedManifestError`)("PackedManifestError", {
	message: S.String,
}, $I.annote("PackedManifestError", { description: "A packed package.json is not an object." })) {}

/** Variables that carry the PARENT run's context into a child package manager. */
const TRAPS = MutableHashSet.make("CI", "INIT_CWD", "NODE_V8_COVERAGE", "PNPM_SCRIPT_SRC_DIR", "PNPM_PACKAGE_NAME");

/** Prefixes of whole families of parent-run context: npm's, pnpm's config, and Yarn's. */
const TRAP_PREFIXES = /^(npm_|pnpm_config_|yarn_)/i;

/**
 * Removes undefined values and parent package-manager context from a child environment.
 *
 * **Details**
 *
 * `env` without undefined values and without the parent's context: every
 * `npm_*` variable (a pnpm-run vitest leaks `npm_config_user_agent`), every
 * `pnpm_config_*` variable plus `PNPM_SCRIPT_SRC_DIR` and `PNPM_PACKAGE_NAME`
 * (a `pnpm exec` child carries all three, `pnpm_config_verify_deps_before_run`
 * among them), every `YARN_*` variable (Berry lets them override
 * `.yarnrc.yml`, so `YARN_NODE_LINKER=pnp` would defeat the consumer's
 * `nodeLinker`), `CI` (Yarn Berry turns on immutable installs), `INIT_CWD`,
 * and `NODE_V8_COVERAGE` (a spawned manager writes coverage files that race
 * vitest's V8 provider).
 *
 * Stripping `CI` does not make the child believe it runs locally: ci-info
 * also reads provider variables such as `GITHUB_ACTIONS`, which stay. That is
 * harmless today, because the only CI-conditional behaviour a consumer
 * install trips on (Berry's immutable installs, pnpm's frozen lockfile) keys
 * on a lockfile the fresh consumer does not have, or is switched off in the
 * files `consumerFiles` writes.
 *
 * User-level configuration is inherited by design: `HOME` stays, so each
 * manager still reads the user's `~/.npmrc`, `~/.yarnrc.yml` and friends, and
 * with them the registry, auth and proxy a real install on this machine
 * would use.
 *
 * **Example** (Keep user configuration while removing parent context)
 *
 * ```ts
 * import { scrubEnv } from "@beep/scratchpad/effected/workspaces/internal/packedInstallPlan";
 *
 * const env = scrubEnv({ HOME: "/home/consumer", CI: "true", npm_config_user_agent: "pnpm", EMPTY: undefined });
 * console.log(JSON.stringify(env)) // {"HOME":"/home/consumer"}
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const scrubEnv = (env: Readonly<Record<string, string | undefined>>): Record<string, string> => {
	const out: Record<string, string> = {};
	for (const [key, value] of R.toEntries(env)) {
		if (value !== undefined && !TRAP_PREFIXES.test(key) && !MutableHashSet.has(TRAPS, key)) out[key] = value;
	}
	return out;
};

/**
 * The last version-shaped line of `--version` output, without a leading `v`.
 *
 * **Example** (Read the final version line)
 *
 * ```ts
 * import { versionOf } from "@beep/scratchpad/effected/workspaces/internal/packedInstallPlan";
 *
 * console.log(versionOf("startup notice\nv4.10.0\n")) // 4.10.0
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const versionOf = (stdout: string): string | undefined => {
	for (const line of stdout.split(/\r?\n/).reverse()) {
		const match = /^v?(\d+\.\d+\.\d+\S*)$/.exec(line.trim());
		if (match?.[1] !== undefined) return match[1];
	}
	return undefined;
};

/**
 * The carrier first, then the rest of the closure; the failure names the first package the workspace lacks.
 *
 * **Example** (Report a missing carrier)
 *
 * ```ts
 * import { closureOf } from "@beep/scratchpad/effected/workspaces/internal/packedInstallPlan";
 *
 * import * as Result from "effect/Result";
 *
 * const closure = closureOf([], "@demo/carrier", "auto");
 * console.log(Result.isFailure(closure)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const closureOf: {
	(carrier: string, closure: ReadonlyArray<string> | "auto"): (packages: ReadonlyArray<WorkspacePackage>) => Result.Result<ReadonlyArray<WorkspacePackage>, string>;
	(packages: ReadonlyArray<WorkspacePackage>, carrier: string, closure: ReadonlyArray<string> | "auto"): Result.Result<ReadonlyArray<WorkspacePackage>, string>;
} = dual(3, (
	packages: ReadonlyArray<WorkspacePackage>,
	carrier: string,
	closure: ReadonlyArray<string> | "auto",
): Result.Result<ReadonlyArray<WorkspacePackage>, string> => {
	const byName = MutableHashMap.fromIterable(packages.map((pkg) => [pkg.name, pkg] as const));
	const root = O.getOrUndefined(MutableHashMap.get(byName, carrier));
	if (root === undefined) return Result.fail(carrier);
	if (closure !== "auto") {
		const unknown = closure.find((name) => !MutableHashMap.has(byName, name));
		if (unknown !== undefined) return Result.fail(unknown);
		const rest = A.dedupe(closure).filter((name) => name !== carrier);
		return Result.succeed([root, ...rest.flatMap((name) => O.toArray(MutableHashMap.get(byName, name)))]);
	}
	const ordered: Array<WorkspacePackage> = [root];
	const seen = MutableHashSet.make(carrier);
	for (let head = 0; head < ordered.length; head++) {
		const current = ordered[head];
		if (current === undefined) continue;
		for (const field of RUNTIME_DEPENDENCY_FIELDS) {
			for (const name of A.sort(R.keys(current[field]), Str.Order)) {
				const dependency = O.getOrUndefined(MutableHashMap.get(byName, name));
				if (dependency !== undefined && !MutableHashSet.has(seen, name)) {
					MutableHashSet.add(seen, name);
					ordered.push(dependency);
				}
			}
		}
	}
	return Result.succeed(ordered);
});

/**
 * What one consumer project needs.
 *
 * @category models
 * @since 0.0.0
 */
export interface ConsumerInput {
	readonly manager: PackageManagerName;
	/** The version `--version` reported, pinned so the consumer runs the manager that was probed. */
	readonly version: string;
	readonly carrier: { readonly name: string; readonly tarball: string };
	/** Every packed package except the carrier: name to absolute tarball path. */
	readonly overrides: Readonly<Record<string, string>>;
	readonly dependencies: Readonly<Record<string, string>>;
}

const major = (version: string): number => Number.parseInt(version.split(".")[0] ?? "", 10);

const minor = (version: string): number => Number.parseInt(version.split(".")[1] ?? "", 10);

const YARNRC =
	"nodeLinker: node-modules\nenableImmutableInstalls: false\nenableScripts: false\nenableTelemetry: false\n";

/**
 * Berry's release-age gate, off: the consumer installs packages its caller
 * has just released, so the gate only ever quarantines them. 4.10 introduced
 * the setting, and Berry fails every command on a setting it does not know.
 */
const YARNRC_AGE_GATE = "npmMinimalAgeGate: 0\n";

const yarnrc = (version: string): string =>
	major(version) > 4 || (major(version) === 4 && minor(version) >= 10) ? `${YARNRC}${YARNRC_AGE_GATE}` : YARNRC;

/**
 * JSON strings are valid YAML double-quoted scalars. `minimumReleaseAge: 0`
 * switches off pnpm's release-age gate, on by default in pnpm 11 and 12 and
 * non-strict: it would rewrite this file with exclusions for fresh packages,
 * and resolve a range to an older, mature match where one exists.
 */
const pnpmWorkspaceYaml = (specs: Readonly<Record<string, string>>): string => {
	const entries = R.toEntries(specs);
	return entries.length === 0
		? "minimumReleaseAge: 0\noverrides: {}\n"
		: `minimumReleaseAge: 0\noverrides:\n${entries.map(([name, spec]) => `  ${JSON.stringify(name)}: ${JSON.stringify(spec)}`).join("\n")}\n`;
};

/**
 * Builds the files of one scratch consumer.
 *
 * **Details**
 *
 * The carrier and the caller's extra
 * dependencies are its only direct dependencies; every other packed package
 * is steered to its tarball through the field this manager reads:
 * `overrides` (npm, bun), `resolutions` (yarn), or a settings-only
 * `pnpm-workspace.yaml` (pnpm 10+ reads overrides there, and pnpm 11+ no
 * longer reads `package.json#pnpm`).
 *
 * An extra dependency that names a packed package (the carrier or a closure
 * member) is written as that package's `file:` tarball spec, whatever the
 * caller passed: the packed tarball always wins. npm fails an install whose
 * override differs from a direct spec for the same package (`EOVERRIDE`), and
 * accepts one that is identical; and a caller's range must never silently
 * replace the tarball the run exists to prove.
 *
 * **Example** (List the pnpm consumer files)
 *
 * ```ts
 * import { consumerFiles } from "@beep/scratchpad/effected/workspaces/internal/packedInstallPlan";
 *
 * const files = consumerFiles({
 *   manager: "pnpm",
 *   version: "12.0.0",
 *   carrier: { name: "@demo/carrier", tarball: "/tmp/carrier.tgz" },
 *   overrides: {},
 *   dependencies: {},
 * });
 * console.log(files.map((entry) => entry.file).join(", ")) // package.json, pnpm-workspace.yaml
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const consumerFiles = (
	input: ConsumerInput,
): ReadonlyArray<{ readonly file: string; readonly content: string }> => {
	const specs = R.fromEntries(R.toEntries(input.overrides).map(([name, tarball]) => [name, `file:${tarball}`] as const));
	const carrierSpec = `file:${input.carrier.tarball}`;
	const extra = R.fromEntries(
		R.toEntries(input.dependencies)
			.filter(([name]) => name !== input.carrier.name)
			.map(([name, spec]) => [name, O.getOrElse(R.get(specs, name), () => spec)] as const),
	);
	const manifest = {
		name: `packed-install-${input.manager}`,
		version: "0.0.0",
		private: true,
		// pnpm resolves a `packageManager` pin from the registry even when it names the
		// running version, which fails an offline install; devEngines with onFail
		// "ignore" pins the same version without a fetch. Every other manager keeps
		// `packageManager`, which is what corepack and yarn read.
		...(input.manager === "pnpm"
			? { devEngines: { packageManager: { name: "pnpm", version: input.version, onFail: "ignore" } } }
			: { packageManager: `${input.manager}@${input.version}` }),
		// dependencies, never devDependencies: a host NODE_ENV=production or omit=dev would skip a dev one.
		dependencies: { [input.carrier.name]: carrierSpec, ...extra },
		...(input.manager === "npm" || input.manager === "bun" ? { overrides: specs } : {}),
		...(input.manager === "yarn" ? { resolutions: specs } : {}),
	};
	const files = [{ file: "package.json", content: `${JSON.stringify(manifest, null, 2)}\n` }];
	if (input.manager === "pnpm") files.push({ file: "pnpm-workspace.yaml", content: pnpmWorkspaceYaml(specs) });
	if (input.manager === "yarn" && major(input.version) >= 2)
		files.push({ file: ".yarnrc.yml", content: yarnrc(input.version) });
	return files;
};

/**
 * The install argv, lifecycle scripts skipped the way this manager spells it.
 *
 * **Example** (Skip lifecycle scripts with pnpm)
 *
 * ```ts
 * import { installArgs } from "@beep/scratchpad/effected/workspaces/internal/packedInstallPlan";
 *
 * console.log(installArgs("pnpm", "12.0.0").join(" ")) // install --config.ignore-scripts=true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const installArgs: {
	(version: string): (manager: PackageManagerName) => ReadonlyArray<string>;
	(manager: PackageManagerName, version: string): ReadonlyArray<string>;
} = dual(2, (manager: PackageManagerName, version: string): ReadonlyArray<string> =>
	Match.value(manager).pipe(
		Match.when("npm", () => ["install", "--ignore-scripts", "--no-audit", "--no-fund"]),
		// pnpm 12 fails an install that IGNORED a dependency build script; skipping them outright is the stable spelling.
		Match.when("pnpm", () => ["install", "--config.ignore-scripts=true"]),
		// Berry has no --ignore-scripts; enableScripts: false in .yarnrc.yml is the equivalent.
		Match.when("yarn", () => major(version) >= 2 ? ["install"] : ["install", "--ignore-scripts", "--non-interactive"]),
		Match.when("bun", () => ["install", "--ignore-scripts"]),
		Match.exhaustive,
	),
);

/**
 * A specifier no consumer outside the workspace can resolve: `workspace:`,
 * `catalog:`, `link:`, or a relative `file:` path. An absolute `file:` path
 * is left alone: it resolves wherever the file exists.
 */
const UNRESOLVABLE = /^(?:workspace:|catalog:|link:|file:(?!\/))/;

/**
 * What a packed `package.json` says that the run checks before any install.
 *
 * @category models
 * @since 0.0.0
 */
export interface PackedManifest {
	/** Its `name`, when that is a string. */
	readonly name: string | undefined;
	/** Every runtime specifier only the workspace could resolve (see `UNRESOLVABLE`), as `field.name: spec`. */
	readonly unresolved: ReadonlyArray<string>;
	/**
	 * The bin names it declares: the keys of a `bin` object, or for a `bin`
	 * string the package name without its scope, as npm links it.
	 */
	readonly bins: ReadonlyArray<string>;
}

/**
 * Parse a packed manifest into the facts the run checks; the failure is the parse error or a non-object.
 *
 * **Example** (Distinguish a manifest from a scalar)
 *
 * ```ts
 * import { readPackedManifest } from "@beep/scratchpad/effected/workspaces/internal/packedInstallPlan";
 *
 * import * as Result from "effect/Result";
 *
 * console.log(Result.isSuccess(readPackedManifest('{"name":"@demo/carrier","bin":"cli.js"}'))) // true
 * console.log(Result.isFailure(readPackedManifest("42"))) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const readPackedManifest = (manifestJson: string): Result.Result<PackedManifest, unknown> => {
	let manifest: unknown;
	try {
		manifest = JSON.parse(manifestJson);
	} catch (cause) {
		return Result.fail(cause);
	}
	if (!P.isObject(manifest))
		return Result.fail(PackedManifestError.make({ message: "package.json is not an object" }));
	const record = manifest;
	const name = P.isString(record.name) ? record.name : undefined;
	const unresolved = RUNTIME_DEPENDENCY_FIELDS.flatMap((field) => {
		const block = record[field];
		if (!P.isObjectOrArray(block)) return [];
		return R.toEntries({ ...block })
			.filter(([, spec]) => P.isString(spec) && UNRESOLVABLE.test(spec))
			.map(([dependency, spec]) => `${field}.${dependency}: ${String(spec)}`);
	});
	const bin = record.bin;
	const bins =
		P.isString(bin)
			? name === undefined
				? []
				: [name.replace(/^@[^/]+\//, "")]
			: P.isObject(bin)
				? R.keys(bin)
				: [];
	return Result.succeed({ name, unresolved, bins });
};

/**
 * The file a manifest's `bin` declares for `name`: a `bin` object's entry, or
 * a `bin` string when `name` is the unscoped package name. `undefined` when
 * the manifest is not a JSON object or declares no such bin.
 *
 * **Example** (Resolve a scoped package executable)
 *
 * ```ts
 * import { binTargetOf } from "@beep/scratchpad/effected/workspaces/internal/packedInstallPlan";
 *
 * console.log(binTargetOf('{"name":"@demo/carrier","bin":"cli.js"}', "carrier")) // cli.js
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const binTargetOf: {
	(name: string): (manifestJson: string) => string | undefined;
	(manifestJson: string, name: string): string | undefined;
} = dual(2, (manifestJson: string, name: string): string | undefined => {
	let manifest: unknown;
	try {
		manifest = JSON.parse(manifestJson);
	} catch {
		return undefined;
	}
	if (!P.isObject(manifest)) return undefined;
	const bin = manifest.bin;
	if (P.isString(bin)) {
		return P.isString(manifest.name) && manifest.name.replace(/^@[^/]+\//, "") === name ? bin : undefined;
	}
	if (!P.isObject(bin)) return undefined;
	const target = bin[name];
	return P.isString(target) && R.has(bin, name) ? target : undefined;
});

/**
 * Every specifier in a packed manifest's runtime maps that only the workspace could resolve (see `UNRESOLVABLE`).
 *
 * **Example** (Check whether manifest inspection succeeds)
 *
 * ```ts
 * import { unresolvedSpecifiers } from "@beep/scratchpad/effected/workspaces/internal/packedInstallPlan";
 *
 * import * as Result from "effect/Result";
 *
 * const specifiers = unresolvedSpecifiers('{"dependencies":{"@demo/core":"workspace:*"}}');
 * console.log(Result.isSuccess(specifiers)) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const unresolvedSpecifiers = (manifestJson: string): Result.Result<ReadonlyArray<string>, unknown> =>
	Result.map(readPackedManifest(manifestJson), (manifest) => manifest.unresolved);

/**
 * The first bin the carrier declares that another packed package declares
 * too.
 *
 * **Gotchas**
 *
 * Under a flat layout (npm, bun, Yarn's `node-modules` linker) either
 * package can take `node_modules/.bin/<bin>`, so a bin check or a bin run
 * could pass on the wrong package. `PackedInstall.run` refuses it unless the
 * caller shares bin names deliberately (`allowSharedBins`).
 *
 * **Example** (Identify the package sharing an executable)
 *
 * ```ts
 * import { binConflict } from "@beep/scratchpad/effected/workspaces/internal/packedInstallPlan";
 *
 * const conflict = binConflict(
 *   { name: "@demo/carrier", bins: ["demo"] },
 *   [{ name: "@demo/other", bins: ["demo"] }],
 * );
 * console.log(conflict?.package) // @demo/other
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const binConflict: {
	(others: ReadonlyArray<{ readonly name: string; readonly bins: ReadonlyArray<string> }>): (carrier: { readonly name: string; readonly bins: ReadonlyArray<string> }) => { readonly bin: string; readonly package: string } | undefined;
	(carrier: { readonly name: string; readonly bins: ReadonlyArray<string> }, others: ReadonlyArray<{ readonly name: string; readonly bins: ReadonlyArray<string> }>): { readonly bin: string; readonly package: string } | undefined;
} = dual(2, (
	carrier: { readonly name: string; readonly bins: ReadonlyArray<string> },
	others: ReadonlyArray<{ readonly name: string; readonly bins: ReadonlyArray<string> }>,
): { readonly bin: string; readonly package: string } | undefined => {
	for (const bin of carrier.bins) {
		const other = others.find((pkg) => pkg.name !== carrier.name && pkg.bins.includes(bin));
		if (other !== undefined) return { bin, package: other.name };
	}
	return undefined;
});

/** A bare package name, scoped or not: an override key carrying a selector (`a>b`, `a@1`) is not one. */
const BARE_NAME = /^(?:@[^/@\s>]+\/)?[^/@\s>]+$/;

/**
 * The `file:` entries of a parsed `pnpm-workspace.yaml`'s `overrides:` map,
 * name to the path after `file:` (relative paths are the caller's to resolve,
 * against the workspace root, as pnpm does).
 *
 * **Details**
 *
 * Entries that are not strings,
 * not `file:`, or keyed by anything but a bare package name are skipped, and
 * so is `__proto__`, which no npm package can be named. A package named
 * `constructor` or `prototype` is an ordinary own entry; read the public
 * record with `R.get` so missing names never resolve to inherited members.
 *
 * **Example** (Extract tarball paths from plain override keys)
 *
 * ```ts
 * import { fileOverridesOf } from "@beep/scratchpad/effected/workspaces/internal/packedInstallPlan";
 *
 * const overrides = fileOverridesOf({ overrides: {
 *   "@demo/core": "file:./core.tgz",
 *   "core@1": "file:./old-core.tgz",
 *   external: "^1.0.0",
 * } });
 * console.log(JSON.stringify(overrides)) // {"@demo/core":"./core.tgz"}
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const fileOverridesOf = (document: unknown): Record<string, string> => {
	let out = HashMap.empty<string, string>();
	const order: Array<string> = [];
	if (!P.isObject(document) || !P.isObject(document.overrides))
		return R.fromEntries([]);
	for (const [name, spec] of R.toEntries(document.overrides)) {
		if (name === "__proto__") continue;
		if (P.isString(spec) && spec.startsWith("file:") && BARE_NAME.test(name)) {
			out = HashMap.set(out, name, spec.slice(5));
			order.push(name);
		}
	}
	return R.fromEntries(A.getSomes(order.map((name) =>
		O.map(HashMap.get(out, name), (spec) => [name, spec] as const),
	)));
};

/**
 * An `overrides` value without the `file:` prefix a caller may copy from a workspace file.
 *
 * **Example** (Remove a tarball specifier prefix)
 *
 * ```ts
 * import { overridePath } from "@beep/scratchpad/effected/workspaces/internal/packedInstallPlan";
 *
 * console.log(overridePath("file:./core.tgz")) // ./core.tgz
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const overridePath = (spec: string): string => (spec.startsWith("file:") ? spec.slice(5) : spec);
