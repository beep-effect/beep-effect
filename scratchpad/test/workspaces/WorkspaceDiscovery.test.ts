import { assert, describe, it, layer } from "@effect/vitest";
import { WorkspaceResolver } from "../../effected/npm/index.ts";
import { Cause, Effect, Exit, Layer, Option } from "effect";
import {
	PackageNotFoundError,
	WorkspaceDiscovery,
	WorkspaceDiscoveryError,
	WorkspaceInfo,
	WorkspacePackage,
	WorkspacePatternError,
	WorkspaceRoot,
	WorkspaceRootNotFoundError,
} from "../../effected/workspaces/index.ts";
import type { Tree } from "./fixtures.ts";
import { manifest, platform, rootManifest } from "./fixtures.ts";

/** Discovery over a tree, rooted at `/repo`. */
const discoveryOver = (
	tree: Tree,
	options?: {
		readonly maxDepth?: number;
		readonly unreadable?: ReadonlySet<string>;
		readonly unreadableFiles?: ReadonlySet<string>;
	},
) => {
	const { unreadable, unreadableFiles, ...discoveryOptions } = options ?? {};
	const base = platform(tree, {
		...(unreadable === undefined ? {} : { unreadable }),
		...(unreadableFiles === undefined ? {} : { unreadableFiles }),
	});
	const roots = WorkspaceRoot.layer.pipe(Layer.provide(base));
	return Layer.mergeAll(
		roots,
		WorkspaceDiscovery.layer({ cwd: "/repo", ...discoveryOptions }).pipe(Layer.provide(roots), Layer.provide(base)),
	).pipe(Layer.provideMerge(base));
};

// ── one-level wildcards: the v3 behaviour, which must NOT regress ───────────

const oneLevel: Tree = {
	"/repo/package.json": rootManifest(["packages/*", "apps/*"]),
	"/repo/packages/alpha/package.json": manifest("@x/alpha"),
	"/repo/packages/beta/package.json": manifest("@x/beta", { dependencies: { "@x/alpha": "1.0.0" } }),
	"/repo/packages/no-manifest/README.md": "not a package",
	"/repo/apps/web/package.json": manifest("@x/web", { dependencies: { "@x/beta": "1.0.0" } }),
};

describe("WorkspaceDiscovery — one-level patterns", () => {
	layer(discoveryOver(oneLevel))((it) => {
		it.effect("discovers the root package first, then members sorted by relative path", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const packages = yield* discovery.listPackages();
				assert.deepStrictEqual(
					packages.map((pkg) => pkg.name),
					["root", "@x/web", "@x/alpha", "@x/beta"],
				);
				assert.isTrue(packages[0].isRootWorkspace);
				assert.strictEqual(packages[0].relativePath, ".");
			}),
		);

		it.effect("carries the as-read manifest record on every member", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const packages = yield* discovery.listPackages();
				const beta = packages.find((pkg) => pkg.name === "@x/beta");
				// The whole parsed record, not the typed slice: dependency fields AND
				// everything discovery never modeled ride along from the one read.
				assert.deepStrictEqual(beta?.manifestRecord, {
					name: "@x/beta",
					version: "1.0.0",
					dependencies: { "@x/alpha": "1.0.0" },
				});
			}),
		);

		it.effect("a directory without a package.json is not a workspace package", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const packages = yield* discovery.listPackages();
				assert.isFalse(packages.some((pkg) => pkg.relativePath === "packages/no-manifest"));
			}),
		);

		it.effect("importerMap keys on the root-relative path", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const importers = yield* discovery.importerMap();
				assert.strictEqual(importers.get("packages/alpha")?.name, "@x/alpha");
				assert.strictEqual(importers.get(".")?.name, "root");
			}),
		);

		it.effect("getPackage fails with the available names when the name is unknown", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const error = yield* Effect.flip(discovery.getPackage("@x/nope"));
				assert.instanceOf(error, PackageNotFoundError);
				assert.include(error.available, "@x/alpha");
			}),
		);

		it.effect("resolveFile attributes a file to its owning package by longest prefix", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				// The root package's path is a PREFIX of every member's, so a naive
				// first-match index would attribute this to `root`.
				const owner = yield* discovery.resolveFile("/repo/packages/alpha/src/index.ts");
				assert.isTrue(Option.isSome(owner));
				assert.strictEqual(Option.getOrThrow(owner).name, "@x/alpha");
			}),
		);

		it.effect("a file outside every package resolves to none", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				assert.isTrue(Option.isNone(yield* discovery.resolveFile("/elsewhere/x.ts")));
			}),
		);

		it.effect("resolveFiles returns each owner once, sorted", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const owners = yield* discovery.resolveFiles([
					"/repo/packages/beta/a.ts",
					"/repo/packages/beta/b.ts",
					"/repo/apps/web/c.ts",
				]);
				assert.deepStrictEqual(
					owners.map((pkg) => pkg.name),
					["@x/beta", "@x/web"],
				);
			}),
		);
	});
});

// ── the issue-#62 regression: a trailing /** must cross segment boundaries ──

const nested: Tree = {
	"/repo/pnpm-workspace.yaml": "packages:\n  - 'packages/**'\n",
	"/repo/packages/alpha/package.json": manifest("@x/alpha"),
	"/repo/packages/group/nested/package.json": manifest("@x/nested"),
	"/repo/packages/group/deeper/still/package.json": manifest("@x/deep"),
	"/repo/package.json": JSON.stringify({ name: "root", version: "0.0.0" }),
};

describe("WorkspaceDiscovery — packages/** crosses segments (workspaces #62)", () => {
	layer(discoveryOver(nested))((it) => {
		it.effect("finds a package TWO levels below the prefix, not just one", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const packages = yield* discovery.listPackages();
				const names = packages.map((pkg) => pkg.name);
				// v3 silently rewrote `packages/**` to `packages/*`, so it found alpha
				// and nothing else. Every name below is a package v3 could not see.
				assert.include(names, "@x/alpha");
				assert.include(names, "@x/nested");
				assert.include(names, "@x/deep");
			}),
		);

		it.effect("reads the packages list from pnpm-workspace.yaml via @effected/yaml", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const info = yield* discovery.info();
				assert.deepStrictEqual(info.patterns, ["packages/**"]);
				assert.strictEqual(info.root, "/repo");
			}),
		);
	});
});

// ── node_modules is pruned, exclusions exclude, depth is capped ─────────────

const withNodeModules: Tree = {
	"/repo/pnpm-workspace.yaml": "packages:\n  - 'packages/**'\n  - '!packages/private-*'\n",
	"/repo/package.json": JSON.stringify({ name: "root", version: "0.0.0" }),
	"/repo/packages/alpha/package.json": manifest("@x/alpha"),
	"/repo/packages/private-thing/package.json": manifest("@x/private"),
	// A package NESTED under an excluded directory. `!packages/private-*` rejects
	// `packages/private-thing` and nothing else — a `*` does not cross a segment
	// boundary — so `packages/**` still selects this one. It exists to pin that
	// the exclusion gate stays at ACCEPTANCE and never becomes a descent gate.
	"/repo/packages/private-thing/nested/package.json": manifest("@x/nested"),
	"/repo/packages/alpha/node_modules/evil/package.json": manifest("evil"),
	"/repo/packages/alpha/.git/hooks/package.json": manifest("git-junk"),
};

describe("WorkspaceDiscovery — pruning and exclusion", () => {
	layer(discoveryOver(withNodeModules))((it) => {
		it.effect("never descends into node_modules", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const packages = yield* discovery.listPackages();
				assert.isFalse(packages.some((pkg) => pkg.name === "evil"));
			}),
		);

		it.effect("never descends into .git", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const packages = yield* discovery.listPackages();
				assert.isFalse(packages.some((pkg) => pkg.name === "git-junk"));
			}),
		);

		it.effect("a leading-bang pattern excludes a package the includes matched", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const packages = yield* discovery.listPackages();
				assert.isTrue(packages.some((pkg) => pkg.name === "@x/alpha"));
				assert.isFalse(packages.some((pkg) => pkg.name === "@x/private"));
			}),
		);

		it.effect("an excluded directory is still DESCENDED — a package under it stays discovered", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const packages = yield* discovery.listPackages();
				// Excluding `packages/private-*` says nothing about what lives BELOW
				// it. Turning the acceptance gate into a descent gate — skipping
				// `traversal.push` for an excluded directory — would drop this member
				// with no diagnostic, which is the same silent-degradation shape as
				// the trailing-`/**` bug the enumerator exists to fix.
				assert.isFalse(packages.some((pkg) => pkg.name === "@x/private"));
				assert.isTrue(packages.some((pkg) => pkg.name === "@x/nested"));
			}),
		);
	});
});

describe("WorkspaceDiscovery — the descent is bounded", () => {
	layer(discoveryOver(nested, { maxDepth: 1 }))((it) => {
		it.effect("fails typed when a segment-crossing pattern descends past maxDepth", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const error = yield* Effect.flip(discovery.listPackages());
				assert.instanceOf(error, WorkspacePatternError);
				assert.strictEqual(error.kind, "depthExceeded");
				assert.strictEqual(error.pattern, "packages/**");
			}),
		);
	});
});

describe("WorkspaceDiscovery — a fractional maxDepth is a DEFECT, not a typed error", () => {
	layer(discoveryOver(nested, { maxDepth: 2.5 }))((it) => {
		it.effect("dies rather than silently enumerating a truncated tree", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const exit = yield* Effect.exit(discovery.listPackages());
				assert.isTrue(Exit.isFailure(exit));
				if (Exit.isFailure(exit)) {
					// A bare `depth < maxDepth` guard would admit 2.5 AND NaN; the
					// discriminating assertion is that no typed Fail is produced.
					assert.isFalse(exit.cause.reasons.some(Cause.isFailReason));
					assert.isTrue(Cause.hasDies(exit.cause));
				}
			}),
		);
	});
});

describe("WorkspaceDiscovery — NaN maxDepth is a DEFECT", () => {
	layer(discoveryOver(nested, { maxDepth: Number.NaN }))((it) => {
		it.effect("dies rather than returning an empty package list", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const exit = yield* Effect.exit(discovery.listPackages());
				assert.isTrue(Exit.isFailure(exit));
				if (Exit.isFailure(exit)) {
					assert.isFalse(exit.cause.reasons.some(Cause.isFailReason));
					assert.isTrue(Cause.hasDies(exit.cause));
				}
			}),
		);
	});
});

// ── failure paths ──────────────────────────────────────────────────────────

const missingBase: Tree = {
	"/repo/package.json": rootManifest(["packages/*", "apps/*"]),
	"/repo/packages/alpha/package.json": manifest("@x/alpha"),
};

describe("WorkspaceDiscovery — a pattern naming a missing directory fails typed", () => {
	layer(discoveryOver(missingBase))((it) => {
		it.effect("names the offending pattern, so a typo is obvious", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const error = yield* Effect.flip(discovery.listPackages());
				assert.instanceOf(error, WorkspacePatternError);
				assert.strictEqual(error.kind, "missingBaseDir");
				assert.strictEqual(error.pattern, "apps/*");
			}),
		);
	});
});

const malformed: Tree = {
	"/repo/package.json": rootManifest(["packages/*"]),
	"/repo/packages/bad/package.json": "{ not json",
};

describe("WorkspaceDiscovery — malformed input fails typed, never as a defect", () => {
	layer(discoveryOver(malformed))((it) => {
		it.effect("an unparseable member package.json is a typed WorkspaceDiscoveryError", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const result = yield* Effect.result(discovery.listPackages());
				assert.strictEqual(result._tag, "Failure");
				const error = yield* Effect.flip(discovery.listPackages());
				assert.instanceOf(error, WorkspaceDiscoveryError);
				assert.strictEqual(error.kind, "invalidJson");
				assert.strictEqual(error.path, "/repo/packages/bad/package.json");
			}),
		);
	});
});

const nameless: Tree = {
	"/repo/package.json": rootManifest(["packages/*"]),
	"/repo/packages/bad/package.json": JSON.stringify({ version: "1.0.0" }),
};

describe("WorkspaceDiscovery — a member without a name", () => {
	layer(discoveryOver(nameless))((it) => {
		it.effect("fails with the missingName discriminant", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const error = yield* Effect.flip(discovery.listPackages());
				assert.instanceOf(error, WorkspaceDiscoveryError);
				assert.strictEqual(error.kind, "missingName");
			}),
		);
	});
});

// ── a manifest without a version: discovered, as pnpm accepts it ────────────

const versionless: Tree = {
	// The ordinary private-monorepo root: a name and `workspaces`, no `version`.
	"/repo/package.json": JSON.stringify({ name: "root", private: true, workspaces: ["packages/*"] }),
	"/repo/packages/bare/package.json": JSON.stringify({ name: "@x/bare", private: true }),
	"/repo/packages/versioned/package.json": manifest("@x/versioned"),
};

describe("WorkspaceDiscovery — a manifest without a version is discovered (#472, #591, #605)", () => {
	layer(discoveryOver(versionless))((it) => {
		it.effect("a version-less ROOT manifest is discovered, root first, with `version` absent", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const packages = yield* discovery.listPackages();
				assert.deepStrictEqual(
					packages.map((pkg) => pkg.name),
					["root", "@x/bare", "@x/versioned"],
				);
				const root = packages[0];
				assert.isTrue(root.isRootWorkspace);
				// Absent, not a placeholder: no `"0.0.0"`, no `""`, and no present
				// `undefined` key either (exact-optional semantics).
				assert.isFalse(Object.hasOwn(root, "version"));
				assert.strictEqual(root.version, undefined);
			}),
		);

		it.effect("a version-less MEMBER is discovered with `version` absent, alongside its versioned sibling", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const bare = yield* discovery.getPackage("@x/bare");
				assert.isFalse(Object.hasOwn(bare, "version"));
				const versioned = yield* discovery.getPackage("@x/versioned");
				assert.strictEqual(versioned.version, "1.0.0");
			}),
		);

		it.effect("versionOf fails typed for a member that declares no version — none would mean non-member", () =>
			Effect.gen(function* () {
				const resolver = yield* WorkspaceResolver;
				// Positive control first: the versioned sibling still resolves.
				assert.deepStrictEqual(yield* resolver.versionOf("@x/versioned"), Option.some("1.0.0"));
				// A non-member is still `none`, per the contract.
				assert.deepStrictEqual(yield* resolver.versionOf("react"), Option.none());
				// The version-less member is a MEMBER with nothing to resolve to, which
				// the contract reserves for the typed channel rather than `none`.
				const error = yield* Effect.flip(resolver.versionOf("@x/bare"));
				assert.strictEqual(error._tag, "DependencyResolutionError");
				assert.strictEqual(error.specifier, "workspace:@x/bare");
				// The branch a `_tag` check cannot pin: this is the version-less case,
				// raised from structured data with no foreign failure to wrap.
				assert.strictEqual(error.reason, "no-version");
				assert.isUndefined(error.cause);
			}).pipe(Effect.provide(WorkspaceDiscovery.workspaceResolver)),
		);
	});
});

// ── a version that is PRESENT but EMPTY: never a legitimate pnpm shape ─────

const emptyVersion: Tree = {
	"/repo/package.json": rootManifest(["packages/*"]),
	"/repo/packages/empty/package.json": JSON.stringify({ name: "@x/empty", version: "" }),
	"/repo/packages/versioned/package.json": manifest("@x/versioned"),
};

describe("WorkspaceDiscovery — a version that is PRESENT but EMPTY", () => {
	// Optional `version` must not be read as "any present value is a version".
	// `""` is not one: it resolves `workspace:^` to a bare `"^"` and makes
	// `versionOf` answer `some("")`, which reads downstream as a real version.
	// Absence is the tolerated shape; a present empty string is the manifest's
	// shape being wrong, exactly like a present non-string.
	layer(discoveryOver(emptyVersion))((it) => {
		it.effect("fails with the invalidShape discriminant, naming the file", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const error = yield* Effect.flip(discovery.listPackages());
				assert.instanceOf(error, WorkspaceDiscoveryError);
				assert.strictEqual(error.kind, "invalidShape");
				assert.strictEqual(error.path, "/repo/packages/empty/package.json");
				// The same sentence the sync facade attaches to its skip, so the two
				// surfaces describe one condition one way.
				assert.strictEqual((error.cause as Error).message, "version must be a non-empty string");
			}),
		);

		it.effect('versionOf never answers some("") for it', () =>
			Effect.gen(function* () {
				const resolver = yield* WorkspaceResolver;
				// The listing fails, so resolution fails through the mechanism channel
				// rather than handing back an empty string dressed as a version.
				const error = yield* Effect.flip(resolver.versionOf("@x/empty"));
				assert.strictEqual(error._tag, "DependencyResolutionError");
				assert.strictEqual(error.specifier, "workspace:@x/empty");
				// A `""` version is a malformed manifest, not a version-less member:
				// the mechanism reason, carrying the discovery failure as its cause.
				assert.strictEqual(error.reason, "mechanism");
				assert.isDefined(error.cause);
			}).pipe(Effect.provide(WorkspaceDiscovery.workspaceResolver)),
		);
	});
});

const badVersion: Tree = {
	"/repo/package.json": rootManifest(["packages/*"]),
	"/repo/packages/bad/package.json": JSON.stringify({ name: "@x/bad", version: 42 }),
};

describe("WorkspaceDiscovery — a version that is PRESENT but not a string", () => {
	// The one version failure that remains after `version` became optional: the
	// key is there and the value is not a string, so the manifest's SHAPE is
	// wrong. Absence is fine; a lie about the field is not.
	layer(discoveryOver(badVersion))((it) => {
		it.effect("fails with the invalidShape discriminant, naming the file", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const error = yield* Effect.flip(discovery.listPackages());
				assert.instanceOf(error, WorkspaceDiscoveryError);
				assert.strictEqual(error.kind, "invalidShape");
				assert.strictEqual(error.path, "/repo/packages/bad/package.json");
			}),
		);
	});
});

// ── the tolerant projection: a non-semver version must NOT break discovery ──

const oddVersion: Tree = {
	"/repo/package.json": rootManifest(["packages/*"]),
	"/repo/packages/odd/package.json": JSON.stringify({ name: "@x/odd", version: "not-semver" }),
};

describe("WorkspaceDiscovery — the projection is deliberately tolerant", () => {
	layer(discoveryOver(oddVersion))((it) => {
		it.effect("a non-semver version discovers fine; only the strict manifest bridge is strict", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const pkg = yield* discovery.getPackage("@x/odd");
				assert.strictEqual(pkg.version, "not-semver");
			}),
		);
	});
});

// ── no workspace root at all ───────────────────────────────────────────────

describe("WorkspaceRoot — no marker anywhere", () => {
	const bare: Tree = { "/repo/src/index.ts": "" };
	const base = platform(bare);
	layer(WorkspaceRoot.layer.pipe(Layer.provideMerge(base)))((it) => {
		it.effect("fails typed, naming the markers it looked for", () =>
			Effect.gen(function* () {
				const roots = yield* WorkspaceRoot;
				const error = yield* Effect.flip(roots.find("/repo/src"));
				assert.instanceOf(error, WorkspaceRootNotFoundError);
				assert.include(error.markers, "pnpm-workspace.yaml");
			}),
		);
	});
});

// ── the layer-bound ceiling: a checkout nested in someone else's workspace ──

// The downstream probe: a CI checkout (a plain single-package repo) sits inside
// a directory that is itself a pnpm workspace root. An unbounded ascent adopts
// that outer workspace and its members; `stopAt: cwd` refuses it.
const nestedCheckout: Tree = {
	"/outer/pnpm-workspace.yaml": "packages:\n  - 'pkgs/*'\n",
	"/outer/package.json": JSON.stringify({ name: "outer-root", version: "0.0.0", private: true }),
	"/outer/pkgs/other/package.json": manifest("other"),
	"/outer/checkout/package.json": manifest("checkout"),
};

/** Discovery over a tree with explicit layer options — each distinct option set needs its own `layer(...)`. */
const discoveryWith = (tree: Tree, options: { readonly cwd: string; readonly stopAt?: string }) => {
	const base = platform(tree);
	const roots = WorkspaceRoot.layer.pipe(Layer.provide(base));
	return WorkspaceDiscovery.layer(options).pipe(Layer.provide(roots), Layer.provide(base));
};

describe("WorkspaceDiscovery — no stopAt adopts an enclosing workspace", () => {
	layer(discoveryWith(nestedCheckout, { cwd: "/outer/checkout" }))((it) => {
		it.effect("resolves the OUTER root and its members (the unbounded default, pinned)", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const info = yield* discovery.info();
				assert.strictEqual(info.root, "/outer");
				const packages = yield* discovery.listPackages();
				assert.deepStrictEqual(
					packages.map((pkg) => `${pkg.name}@${pkg.relativePath}`),
					["outer-root@.", "other@pkgs/other"],
				);
			}),
		);
	});
});

describe("WorkspaceDiscovery — stopAt: cwd refuses the enclosing workspace", () => {
	layer(discoveryWith(nestedCheckout, { cwd: "/outer/checkout", stopAt: "/outer/checkout" }))((it) => {
		it.effect("fails WorkspaceRootNotFoundError carrying the ceiling", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const error = yield* Effect.flip(discovery.listPackages());
				assert.instanceOf(error, WorkspaceRootNotFoundError);
				assert.strictEqual(error.searchPath, "/outer/checkout");
				assert.strictEqual(error.stopAt, "/outer/checkout");
			}),
		);

		it.effect("does not bound the per-call …In methods", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				// Deliberate: a layer-level ceiling cannot sensibly bound an arbitrary
				// caller-named directory, so the `…In` methods ascend unbounded.
				const info = yield* discovery.infoIn("/outer/checkout");
				assert.strictEqual(info.root, "/outer");
			}),
		);
	});

	const checkoutIsRoot: Tree = {
		...nestedCheckout,
		"/outer/checkout/pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
		"/outer/checkout/packages/inner/package.json": manifest("inner"),
	};
	layer(discoveryWith(checkoutIsRoot, { cwd: "/outer/checkout", stopAt: "/outer/checkout" }))((it) => {
		it.effect("still resolves a checkout that is itself a workspace root (the ceiling is inclusive)", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const info = yield* discovery.info();
				assert.strictEqual(info.root, "/outer/checkout");
				const packages = yield* discovery.listPackages();
				assert.deepStrictEqual(
					packages.map((pkg) => `${pkg.name}@${pkg.relativePath}`),
					["checkout@.", "inner@packages/inner"],
				);
			}),
		);
	});
});

describe("WorkspaceRoot — the NEAREST root wins", () => {
	const nestedRoots: Tree = {
		"/outer/package.json": rootManifest(["packages/*"]),
		"/outer/inner/pnpm-workspace.yaml": "packages:\n  - 'pkgs/*'\n",
		"/outer/inner/package.json": JSON.stringify({ name: "inner", version: "0.0.0" }),
		"/outer/inner/pkgs/a/package.json": manifest("@i/a"),
	};
	const base = platform(nestedRoots);
	layer(WorkspaceRoot.layer.pipe(Layer.provideMerge(base)))((it) => {
		it.effect("stops at the first marker on the way up, not the outermost", () =>
			Effect.gen(function* () {
				const roots = yield* WorkspaceRoot;
				assert.strictEqual(yield* roots.find("/outer/inner/pkgs/a"), "/outer/inner");
			}),
		);

		it.effect("ascends past directories with no marker", () =>
			Effect.gen(function* () {
				const roots = yield* WorkspaceRoot;
				assert.strictEqual(yield* roots.find("/outer/inner/pkgs"), "/outer/inner");
			}),
		);
	});
});

// ── a member manifest that is valid JSON but not an object ─────────────────

const nonObjectManifest: Tree = {
	"/repo/package.json": rootManifest(["packages/*"]),
	"/repo/packages/good/package.json": manifest("@x/good"),
	// `JSON.parse` returns `undefined` for NOTHING. A manifest of `null` parses
	// happily to `null`, and reading `.name` off it throws a TypeError — malformed
	// input escaping as an unhandled DEFECT rather than the typed channel.
	"/repo/packages/nullish/package.json": "null",
};

describe("WorkspaceDiscovery — a member package.json that is `null`", () => {
	layer(discoveryOver(nonObjectManifest))((it) => {
		it.effect("fails TYPED, never as a defect", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const exit = yield* Effect.exit(discovery.listPackages());
				assert.isTrue(Exit.isFailure(exit));
				if (Exit.isFailure(exit)) {
					// The discriminating assertion: no Die reason. An implementation that
					// lets the TypeError escape still "fails", but it fails as a defect.
					assert.isFalse(exit.cause.reasons.some(Cause.isDieReason));
					assert.isTrue(exit.cause.reasons.some(Cause.isFailReason));
				}

				const error = yield* Effect.flip(discovery.listPackages());
				assert.instanceOf(error, WorkspaceDiscoveryError);
				// `null` is VALID JSON — the text parses. What is wrong is its shape, so
				// this is invalidShape, not invalidJson. Asserting invalidJson here is
				// what let a never-constructed invalidShape kind ship unnoticed.
				assert.strictEqual(error.kind, "invalidShape");
			}),
		);
	});
});

// ── a well-formed manifest the schema rejects ──────────────────────────────

const wrongShape: Tree = {
	"/repo/package.json": rootManifest(["packages/*"]),
	// Valid JSON, valid name and version, but `dependencies` is not a string map:
	// the tolerant decode's schema rejects it and raises a SchemaError.
	"/repo/packages/bad/package.json": JSON.stringify({
		name: "@x/bad",
		version: "1.0.0",
		publishConfig: { access: 42 },
	}),
};

describe("WorkspaceDiscovery — a manifest whose shape the schema rejects", () => {
	layer(discoveryOver(wrongShape))((it) => {
		it.effect("is invalidShape, distinct from a JSON syntax error", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const error = yield* Effect.flip(discovery.listPackages());
				assert.instanceOf(error, WorkspaceDiscoveryError);
				// The SchemaError path. Previously reported as invalidJson, which told a
				// consumer the file was not JSON when in fact it parsed perfectly.
				assert.strictEqual(error.kind, "invalidShape");
				assert.strictEqual(error.path, "/repo/packages/bad/package.json");
			}),
		);
	});
});

// ── an unreadable directory must not silently vanish ───────────────────────

const permissionTree: Tree = {
	"/repo/package.json": rootManifest(["packages/*"]),
	"/repo/packages/visible/package.json": manifest("@x/visible"),
	"/repo/packages/secret/package.json": manifest("@x/secret"),
};

describe("WorkspaceDiscovery — a directory that cannot be read", () => {
	layer(discoveryOver(permissionTree, { unreadable: new Set(["/repo/packages"]) }))((it) => {
		it.effect("surfaces a typed unreadableDirectory rather than reporting an empty workspace", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				// Absorbing every readDirectory failure as "no entries" would return the
				// root package alone and look like a legitimately empty workspace — the
				// same silent-degradation shape as the trailing-`/**` bug. A permission
				// error is a WRONG ANSWER, not an empty one.
				const error = yield* Effect.flip(discovery.listPackages());
				assert.instanceOf(error, WorkspacePatternError);
				assert.strictEqual(error.kind, "unreadableDirectory");
			}),
		);
	});
});

// ── an unreadable workspace CONFIG must not read as "no patterns declared" ──

const unreadablePnpmWorkspace: Tree = {
	"/repo/pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
	"/repo/package.json": JSON.stringify({ name: "root", version: "0.0.0" }),
	"/repo/packages/a/package.json": manifest("@x/a"),
};

describe("WorkspaceDiscovery — an unreadable pnpm-workspace.yaml", () => {
	layer(discoveryOver(unreadablePnpmWorkspace, { unreadableFiles: new Set(["/repo/pnpm-workspace.yaml"]) }))((it) => {
		it.effect("fails typed rather than reading as a workspace with no patterns", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				// Substituting "" for an unreadable config made an UNREADABLE file and an
				// EMPTY file produce identical results — the failure was invisible by
				// construction. A permission error here would silently yield a workspace
				// with zero members and look exactly like a legitimately empty one.
				const error = yield* Effect.flip(discovery.listPackages());
				assert.instanceOf(error, WorkspaceDiscoveryError);
				assert.strictEqual(error.kind, "read");
				assert.strictEqual(error.path, "/repo/pnpm-workspace.yaml");
			}),
		);
	});
});

// ── the test double: stub ONE method, the derived surface answers consistently ──
//
// The motivating boilerplate (workspaces issue #109): `WorkspaceDiscoveryShape`
// is seven methods wide, and every in-memory double used to hand-stub all of
// them to satisfy tsc even when the test exercised one. `makeTest` fills the
// rest — and derives the lookup methods from the EFFECTIVE `listPackages`, so
// one stub yields a coherent workspace, not seven unrelated stubs.

const utilsPackage = WorkspacePackage.make({
	name: "@x/utils",
	version: "1.0.0",
	path: "/repo/packages/utils",
	packageJsonPath: "/repo/packages/utils/package.json",
	relativePath: "packages/utils",
	workspaceRoot: "/repo",
});

const nestedPackage = WorkspacePackage.make({
	name: "@x/utils-extra",
	version: "1.0.0",
	path: "/repo/packages/utils/extra",
	packageJsonPath: "/repo/packages/utils/extra/package.json",
	relativePath: "packages/utils/extra",
	workspaceRoot: "/repo",
});

// Bound to a const: layerTest is a parameterized layer factory and layers
// memoize by reference.
const StubbedDiscovery = WorkspaceDiscovery.layerTest({
	listPackages: () => Effect.succeed([utilsPackage, nestedPackage]),
});

describe("WorkspaceDiscovery.layerTest — one stubbed method", () => {
	layer(StubbedDiscovery)((it) => {
		it.effect("listPackages returns the stub", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const packages = yield* discovery.listPackages();
				assert.deepStrictEqual(
					packages.map((pkg) => pkg.name),
					["@x/utils", "@x/utils-extra"],
				);
			}),
		);

		it.effect("getPackage derives from the stubbed list — hit and typed miss", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const found = yield* discovery.getPackage("@x/utils");
				assert.strictEqual(found.relativePath, "packages/utils");

				const miss = yield* Effect.flip(discovery.getPackage("@x/nope"));
				assert.instanceOf(miss, PackageNotFoundError);
				assert.deepStrictEqual(miss.available, ["@x/utils", "@x/utils-extra"]);
			}),
		);

		it.effect("importerMap derives from the stubbed list", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const map = yield* discovery.importerMap();
				assert.strictEqual(map.get("packages/utils")?.name, "@x/utils");
				assert.strictEqual(map.size, 2);
			}),
		);

		it.effect("resolveFile derives by LONGEST prefix, not first match", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const owner = yield* discovery.resolveFile("/repo/packages/utils/extra/src/index.ts");
				assert.isTrue(Option.isSome(owner));
				assert.strictEqual(Option.isSome(owner) ? owner.value.name : "", "@x/utils-extra");

				const outside = yield* discovery.resolveFile("/elsewhere/file.ts");
				assert.isTrue(Option.isNone(outside));
			}),
		);

		it.effect("resolveFiles derives distinct owners sorted by name", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const owners = yield* discovery.resolveFiles([
					"/repo/packages/utils/extra/src/index.ts",
					"/repo/packages/utils/src/a.ts",
					"/repo/packages/utils/src/b.ts",
				]);
				assert.deepStrictEqual(
					owners.map((pkg) => pkg.name),
					["@x/utils", "@x/utils-extra"],
				);
			}),
		);
	});
});

// Bound to a const — see StubbedDiscovery.
const EmptyDiscovery = WorkspaceDiscovery.layerTest();

describe("WorkspaceDiscovery.makeTest — the empty-workspace defaults", () => {
	layer(EmptyDiscovery)((it) => {
		it.effect("list-shaped methods succeed empty and refresh is a no-op", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				assert.deepStrictEqual(yield* discovery.listPackages(), []);
				assert.strictEqual((yield* discovery.importerMap()).size, 0);
				assert.deepStrictEqual(yield* discovery.resolveFiles(["/repo/a.ts"]), []);
				assert.isTrue(Option.isNone(yield* discovery.resolveFile("/repo/a.ts")));
				yield* discovery.refresh();
			}),
		);

		it.effect("getPackage fails with the service's own typed error, never a fabricated one", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const miss = yield* Effect.flip(discovery.getPackage("@x/anything"));
				assert.instanceOf(miss, PackageNotFoundError);
				assert.deepStrictEqual(miss.available, []);
			}),
		);

		it.effect("info() DIES unless stubbed — an unstubbed call is a wiring mistake", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				// No honest default WorkspaceInfo exists (a fabricated root would leak
				// into consumer path logic), so the default is a defect, not a typed
				// failure a test could accidentally swallow.
				const exit = yield* Effect.exit(discovery.info());
				assert.isTrue(Exit.isFailure(exit));
				assert.isTrue(Exit.isFailure(exit) && Cause.hasDies(exit.cause));
			}),
		);
	});
});

describe("WorkspaceDiscovery.makeTest — overrides win over derivation", () => {
	it.effect("a stubbed info() succeeds and the shape needs nothing else", () =>
		Effect.gen(function* () {
			// The shape value directly — no layer needed to use a double inline.
			const double = WorkspaceDiscovery.makeTest({
				info: () => Effect.succeed(WorkspaceInfo.make({ root: "/repo", patterns: ["packages/*"] })),
			});
			const info = yield* double.info();
			assert.strictEqual(info.root, "/repo");
			assert.deepStrictEqual(yield* double.listPackages(), []);
		}),
	);
});

// ── duplicate names: first match wins, as `Array.find` did ──────────────────

const duplicateNames: Tree = {
	"/repo/package.json": rootManifest(["packages/*"]),
	"/repo/packages/alpha/package.json": manifest("@x/dup", { version: "1.0.0" }),
	"/repo/packages/beta/package.json": manifest("@x/dup", { version: "2.0.0" }),
};

describe("WorkspaceDiscovery — duplicate package names", () => {
	// Discovery does not reject duplicate `name` values, so the name indexes must
	// keep the FIRST match. A plain `new Map(all.map(...))` keeps the last, which
	// silently changes which package a name resolves to.
	layer(discoveryOver(duplicateNames))((it) => {
		it.effect("getPackage returns the first package declaring the name", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const found = yield* discovery.getPackage("@x/dup");
				assert.strictEqual(found.relativePath, "packages/alpha");
				assert.strictEqual(found.version, "1.0.0");
			}),
		);

		it.effect("versionOf resolves the first package's version", () =>
			Effect.gen(function* () {
				const resolver = yield* WorkspaceResolver;
				assert.deepStrictEqual(yield* resolver.versionOf("@x/dup"), Option.some("1.0.0"));
			}).pipe(Effect.provide(WorkspaceDiscovery.workspaceResolver)),
		);
	});
});
