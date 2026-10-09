// Everything PackedInstall decides that does not need a process: which
// variables leak the parent manager's context, what each manager's consumer
// project looks like, and how each spells "skip lifecycle scripts". Pure, so
// every per-manager trap is pinned without spawning one.

import { Predicate, Result } from "effect";
import type { PackageManagerName } from "../PackageManagerName.ts";
import type { WorkspacePackage } from "../WorkspacePackage.ts";
import { RUNTIME_DEPENDENCY_FIELDS } from "./dependencyFields.ts";

/** Variables that carry the PARENT run's context into a child package manager. */
const TRAPS = new Set(["CI", "INIT_CWD", "NODE_V8_COVERAGE", "PNPM_SCRIPT_SRC_DIR", "PNPM_PACKAGE_NAME"]);

/** Prefixes of whole families of parent-run context: npm's, pnpm's config, and Yarn's. */
const TRAP_PREFIXES = /^(npm_|pnpm_config_|yarn_)/i;

/**
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
 */
export const scrubEnv = (env: Readonly<Record<string, string | undefined>>): Record<string, string> => {
	const out: Record<string, string> = {};
	for (const [key, value] of Object.entries(env)) {
		if (value !== undefined && !TRAP_PREFIXES.test(key) && !TRAPS.has(key)) out[key] = value;
	}
	return out;
};

/** The last version-shaped line of `--version` output, without a leading `v`. */
export const versionOf = (stdout: string): string | undefined => {
	for (const line of stdout.split(/\r?\n/).reverse()) {
		const match = /^v?(\d+\.\d+\.\d+\S*)$/.exec(line.trim());
		if (match?.[1] !== undefined) return match[1];
	}
	return undefined;
};

/** The carrier first, then the rest of the closure; the failure names the first package the workspace lacks. */
export const closureOf = (
	packages: ReadonlyArray<WorkspacePackage>,
	carrier: string,
	closure: ReadonlyArray<string> | "auto",
): Result.Result<ReadonlyArray<WorkspacePackage>, string> => {
	const byName = new Map(packages.map((pkg) => [pkg.name, pkg] as const));
	const root = byName.get(carrier);
	if (root === undefined) return Result.fail(carrier);
	if (closure !== "auto") {
		const unknown = closure.find((name) => !byName.has(name));
		if (unknown !== undefined) return Result.fail(unknown);
		const rest = [...new Set(closure)].filter((name) => name !== carrier);
		return Result.succeed([root, ...rest.flatMap((name) => byName.get(name) ?? [])]);
	}
	const ordered: Array<WorkspacePackage> = [root];
	const seen = new Set([carrier]);
	for (let head = 0; head < ordered.length; head++) {
		const current = ordered[head];
		if (current === undefined) continue;
		for (const field of RUNTIME_DEPENDENCY_FIELDS) {
			for (const name of Object.keys(current[field]).sort()) {
				const dependency = byName.get(name);
				if (dependency !== undefined && !seen.has(name)) {
					seen.add(name);
					ordered.push(dependency);
				}
			}
		}
	}
	return Result.succeed(ordered);
};

/** What one consumer project needs. */
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
	const entries = Object.entries(specs);
	return entries.length === 0
		? "minimumReleaseAge: 0\noverrides: {}\n"
		: `minimumReleaseAge: 0\noverrides:\n${entries.map(([name, spec]) => `  ${JSON.stringify(name)}: ${JSON.stringify(spec)}`).join("\n")}\n`;
};

/**
 * The files of one scratch consumer. The carrier and the caller's extra
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
 */
export const consumerFiles = (
	input: ConsumerInput,
): ReadonlyArray<{ readonly file: string; readonly content: string }> => {
	const specs = Object.fromEntries(Object.entries(input.overrides).map(([name, tarball]) => [name, `file:${tarball}`]));
	const carrierSpec = `file:${input.carrier.tarball}`;
	const extra = Object.fromEntries(
		Object.entries(input.dependencies)
			.filter(([name]) => name !== input.carrier.name)
			.map(([name, spec]) => [name, Object.hasOwn(specs, name) ? (specs[name] ?? spec) : spec]),
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

/** The install argv, lifecycle scripts skipped the way this manager spells it. */
export const installArgs = (manager: PackageManagerName, version: string): ReadonlyArray<string> => {
	switch (manager) {
		case "npm":
			return ["install", "--ignore-scripts", "--no-audit", "--no-fund"];
		case "pnpm":
			// pnpm 12 fails an install that IGNORED a dependency build script; skipping them outright is the stable spelling.
			return ["install", "--config.ignore-scripts=true"];
		case "yarn":
			// Berry has no --ignore-scripts; enableScripts: false in .yarnrc.yml is the equivalent.
			return major(version) >= 2 ? ["install"] : ["install", "--ignore-scripts", "--non-interactive"];
		case "bun":
			return ["install", "--ignore-scripts"];
	}
};

/**
 * A specifier no consumer outside the workspace can resolve: `workspace:`,
 * `catalog:`, `link:`, or a relative `file:` path. An absolute `file:` path
 * is left alone: it resolves wherever the file exists.
 */
const UNRESOLVABLE = /^(?:workspace:|catalog:|link:|file:(?!\/))/;

/** What a packed `package.json` says that the run checks before any install. */
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

/** Parse a packed manifest into the facts the run checks; the failure is the parse error or a non-object. */
export const readPackedManifest = (manifestJson: string): Result.Result<PackedManifest, unknown> => {
	let manifest: unknown;
	try {
		manifest = JSON.parse(manifestJson);
	} catch (cause) {
		return Result.fail(cause);
	}
	if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest))
		return Result.fail(new Error("package.json is not an object"));
	const record = manifest as Record<string, unknown>;
	const name = typeof record.name === "string" ? record.name : undefined;
	const unresolved = RUNTIME_DEPENDENCY_FIELDS.flatMap((field) => {
		const block = record[field];
		if (typeof block !== "object" || block === null) return [];
		return Object.entries(block as Record<string, unknown>)
			.filter(([, spec]) => typeof spec === "string" && UNRESOLVABLE.test(spec))
			.map(([dependency, spec]) => `${field}.${dependency}: ${String(spec)}`);
	});
	const bin = record.bin;
	const bins =
		typeof bin === "string"
			? name === undefined
				? []
				: [name.replace(/^@[^/]+\//, "")]
			: typeof bin === "object" && bin !== null && !Array.isArray(bin)
				? Object.keys(bin)
				: [];
	return Result.succeed({ name, unresolved, bins });
};

/**
 * The file a manifest's `bin` declares for `name`: a `bin` object's entry, or
 * a `bin` string when `name` is the unscoped package name. `undefined` when
 * the manifest is not a JSON object or declares no such bin.
 */
export const binTargetOf = (manifestJson: string, name: string): string | undefined => {
	let manifest: unknown;
	try {
		manifest = JSON.parse(manifestJson);
	} catch {
		return undefined;
	}
	if (!Predicate.isObject(manifest) || Array.isArray(manifest)) return undefined;
	const bin = manifest.bin;
	if (typeof bin === "string") {
		return typeof manifest.name === "string" && manifest.name.replace(/^@[^/]+\//, "") === name ? bin : undefined;
	}
	if (!Predicate.isObject(bin) || Array.isArray(bin)) return undefined;
	const target = (bin as Record<string, unknown>)[name];
	return typeof target === "string" && Object.hasOwn(bin, name) ? target : undefined;
};

/** Every specifier in a packed manifest's runtime maps that only the workspace could resolve (see `UNRESOLVABLE`). */
export const unresolvedSpecifiers = (manifestJson: string): Result.Result<ReadonlyArray<string>, unknown> =>
	Result.map(readPackedManifest(manifestJson), (manifest) => manifest.unresolved);

/**
 * The first bin the carrier declares that another packed package declares
 * too. Under a flat layout (npm, bun, Yarn's `node-modules` linker) either
 * package can take `node_modules/.bin/<bin>`, so a bin check or a bin run
 * could pass on the wrong package. `PackedInstall.run` refuses it unless the
 * caller shares bin names deliberately (`allowSharedBins`).
 */
export const binConflict = (
	carrier: { readonly name: string; readonly bins: ReadonlyArray<string> },
	others: ReadonlyArray<{ readonly name: string; readonly bins: ReadonlyArray<string> }>,
): { readonly bin: string; readonly package: string } | undefined => {
	for (const bin of carrier.bins) {
		const other = others.find((pkg) => pkg.name !== carrier.name && pkg.bins.includes(bin));
		if (other !== undefined) return { bin, package: other.name };
	}
	return undefined;
};

/** A bare package name, scoped or not: an override key carrying a selector (`a>b`, `a@1`) is not one. */
const BARE_NAME = /^(?:@[^/@\s>]+\/)?[^/@\s>]+$/;

/**
 * The `file:` entries of a parsed `pnpm-workspace.yaml`'s `overrides:` map,
 * name to the path after `file:` (relative paths are the caller's to resolve,
 * against the workspace root, as pnpm does). Entries that are not strings,
 * not `file:`, or keyed by anything but a bare package name are skipped, and
 * so is `__proto__`, which no npm package can be named. The map has no
 * prototype, so a package named `constructor` or `prototype` is an ordinary
 * own entry and a missing name never resolves to an inherited member.
 */
export const fileOverridesOf = (document: unknown): Record<string, string> => {
	const out: Record<string, string> = Object.create(null);
	if (!Predicate.isObject(document) || !Predicate.isObject(document.overrides) || Array.isArray(document.overrides))
		return out;
	for (const [name, spec] of Object.entries(document.overrides)) {
		if (name === "__proto__") continue;
		if (typeof spec === "string" && spec.startsWith("file:") && BARE_NAME.test(name)) out[name] = spec.slice(5);
	}
	return out;
};

/** An `overrides` value without the `file:` prefix a caller may copy from a workspace file. */
export const overridePath = (spec: string): string => (spec.startsWith("file:") ? spec.slice(5) : spec);
