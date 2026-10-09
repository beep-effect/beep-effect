import { assert, describe, it, layer } from "@effect/vitest";
import { Effect, Option } from "effect";
import { resolveExports, resolveExtendsTarget } from "../../effected/tsconfig-json/internal/extendsTarget.ts";
import { TsconfigLoader } from "../../effected/tsconfig-json/TsconfigLoader.ts";
import { fixtureLayer } from "./fixtures.ts";

/** Build a fixture tree from `[absolutePath, contents]` pairs. */
const tree = (...entries: ReadonlyArray<readonly [string, string]>): ReadonlyMap<string, string> => new Map(entries);

const EMPTY = "{}";

// ---------------------------------------------------------------------------
// E1 — relative / rooted targets
// ---------------------------------------------------------------------------

layer(fixtureLayer(tree(["/proj/base.json", EMPTY])))("resolveExtendsTarget, relative .json retry", (it) => {
	it.effect("appends .json when the extensionless file is absent", () =>
		Effect.gen(function* () {
			const result = yield* resolveExtendsTarget("./base", "/proj/tsconfig.json");
			assert.deepStrictEqual(result, Option.some("/proj/base.json"));
		}),
	);
});

layer(fixtureLayer(tree(["/proj/base", EMPTY], ["/proj/base.json", "SHADOWED"])))(
	"resolveExtendsTarget, extensionless exact match",
	(it) => {
		it.effect("accepts an existing extensionless file verbatim, before the .json retry", () =>
			Effect.gen(function* () {
				const result = yield* resolveExtendsTarget("./base", "/proj/tsconfig.json");
				assert.deepStrictEqual(result, Option.some("/proj/base"));
			}),
		);
	},
);

layer(fixtureLayer(tree(["/proj/dir/tsconfig.json", EMPTY])))("resolveExtendsTarget, no directory fallback", (it) => {
	it.effect("a relative path to a directory never tries <dir>/tsconfig.json", () =>
		Effect.gen(function* () {
			// The volume creates real directories, so `/proj/dir` exists — which
			// makes the package's documented file-only divergence OBSERVABLE here
			// rather than hidden. `exists` is directory-true where tsc's
			// `host.fileExists` is file-only, so the directory itself resolves; a
			// directory hit then fails typed at `readFileString` (see the
			// file-only contract in the loader header). What this test pins is
			// that no `<dir>/tsconfig.json` fallback was tried — tsc would have
			// retried `./dir.json`, and we resolve neither.
			const result = yield* resolveExtendsTarget("./dir", "/proj/tsconfig.json");
			assert.deepStrictEqual(result, Option.some("/proj/dir"));
		}),
	);
});

layer(fixtureLayer(tree(["/proj/base.json", EMPTY])))("resolveExtendsTarget, parent-relative target", (it) => {
	it.effect("resolves a ../ target against the extending config directory", () =>
		Effect.gen(function* () {
			const result = yield* resolveExtendsTarget("../base", "/proj/sub/tsconfig.json");
			assert.deepStrictEqual(result, Option.some("/proj/base.json"));
		}),
	);
});

layer(fixtureLayer(tree(["/abs/base.json", EMPTY])))("resolveExtendsTarget, rooted target", (it) => {
	it.effect("accepts an absolute target verbatim", () =>
		Effect.gen(function* () {
			const result = yield* resolveExtendsTarget("/abs/base.json", "/proj/tsconfig.json");
			assert.deepStrictEqual(result, Option.some("/abs/base.json"));
		}),
	);
});

// ---------------------------------------------------------------------------
// E2 — bare specifiers
// ---------------------------------------------------------------------------

layer(fixtureLayer(tree(["/proj/node_modules/foo/package.json", EMPTY], ["/proj/node_modules/foo/bar.json", EMPTY])))(
	"resolveExtendsTarget, foo/bar.json is bare not relative",
	(it) => {
		it.effect("resolves a slash-bearing spec with no ./ through node_modules", () =>
			Effect.gen(function* () {
				const result = yield* resolveExtendsTarget("foo/bar.json", "/proj/tsconfig.json");
				assert.deepStrictEqual(result, Option.some("/proj/node_modules/foo/bar.json"));
			}),
		);
	},
);

layer(
	fixtureLayer(tree(["/proj/node_modules/pkg/package.json", EMPTY], ["/proj/node_modules/pkg/tsconfig.json", EMPTY])),
)("resolveExtendsTarget, walk up ancestors", (it) => {
	it.effect("finds the package two ancestors up when nearer dirs have no node_modules", () =>
		Effect.gen(function* () {
			const result = yield* resolveExtendsTarget("pkg", "/proj/a/b/tsconfig.json");
			assert.deepStrictEqual(result, Option.some("/proj/node_modules/pkg/tsconfig.json"));
		}),
	);
});

layer(
	fixtureLayer(
		tree(
			["/proj/node_modules/node_modules/pkg/package.json", EMPTY],
			["/proj/node_modules/node_modules/pkg/tsconfig.json", EMPTY],
		),
	),
)("resolveExtendsTarget, skip node_modules-named ancestors", (it) => {
	it.effect("does not probe under an ancestor literally named node_modules", () =>
		Effect.gen(function* () {
			const result = yield* resolveExtendsTarget("pkg", "/proj/node_modules/tsconfig.json");
			assert.deepStrictEqual(result, Option.none());
		}),
	);
});

layer(
	fixtureLayer(
		tree(
			["/proj/node_modules/@tsconfig/node20/package.json", EMPTY],
			["/proj/node_modules/@tsconfig/node20/tsconfig.json", EMPTY],
		),
	),
)("resolveExtendsTarget, scoped subpath exact hit", (it) => {
	it.effect("resolves @tsconfig/node20/tsconfig.json to the exact file", () =>
		Effect.gen(function* () {
			const result = yield* resolveExtendsTarget("@tsconfig/node20/tsconfig.json", "/proj/tsconfig.json");
			assert.deepStrictEqual(result, Option.some("/proj/node_modules/@tsconfig/node20/tsconfig.json"));
		}),
	);
});

layer(fixtureLayer(tree(["/proj/node_modules/pkg/package.json", EMPTY], ["/proj/node_modules/pkg/base.json", EMPTY])))(
	"resolveExtendsTarget, subpath .json retry",
	(it) => {
		it.effect("pkg/base resolves to node_modules/pkg/base.json", () =>
			Effect.gen(function* () {
				const result = yield* resolveExtendsTarget("pkg/base", "/proj/tsconfig.json");
				assert.deepStrictEqual(result, Option.some("/proj/node_modules/pkg/base.json"));
			}),
		);
	},
);

layer(
	fixtureLayer(
		tree(
			["/proj/node_modules/withfield/package.json", '{"tsconfig":"./tsconfigs/base.json"}'],
			["/proj/node_modules/withfield/tsconfigs/base.json", EMPTY],
			["/proj/node_modules/withfield/tsconfig.json", "SHADOWED"],
		),
	),
)("resolveExtendsTarget, bare package tsconfig field", (it) => {
	it.effect("respects the package.json tsconfig field over the default tsconfig.json", () =>
		Effect.gen(function* () {
			const result = yield* resolveExtendsTarget("withfield", "/proj/tsconfig.json");
			assert.deepStrictEqual(result, Option.some("/proj/node_modules/withfield/tsconfigs/base.json"));
		}),
	);
});

layer(
	fixtureLayer(
		tree(["/proj/node_modules/plain/package.json", EMPTY], ["/proj/node_modules/plain/tsconfig.json", EMPTY]),
	),
)("resolveExtendsTarget, bare package default tsconfig.json", (it) => {
	it.effect("falls back to <pkg>/tsconfig.json when there is no tsconfig field", () =>
		Effect.gen(function* () {
			const result = yield* resolveExtendsTarget("plain", "/proj/tsconfig.json");
			assert.deepStrictEqual(result, Option.some("/proj/node_modules/plain/tsconfig.json"));
		}),
	);
});

// ---------------------------------------------------------------------------
// E2 — exports resolution (through resolveExtendsTarget)
// ---------------------------------------------------------------------------

layer(
	fixtureLayer(
		tree(
			["/proj/node_modules/exp/package.json", '{"exports":{"./tsconfig.json":"./cfg/base.json"}}'],
			["/proj/node_modules/exp/cfg/base.json", EMPTY],
			["/proj/node_modules/exp/tsconfig.json", "SHADOWED"],
		),
	),
)("resolveExtendsTarget, exports resolution wins", (it) => {
	it.effect("an exports map redirects the subpath and beats the plain file", () =>
		Effect.gen(function* () {
			const result = yield* resolveExtendsTarget("exp/tsconfig.json", "/proj/tsconfig.json");
			assert.deepStrictEqual(result, Option.some("/proj/node_modules/exp/cfg/base.json"));
		}),
	);
});

layer(
	fixtureLayer(
		tree(
			["/proj/node_modules/exp/package.json", '{"exports":{"./other.json":"./x.json"}}'],
			["/proj/node_modules/exp/tsconfig.json", "NEVER-PROBED"],
		),
	),
)("resolveExtendsTarget, exports blocks all fallbacks", (it) => {
	it.effect("an exports map that fails to resolve the subpath yields none, no tsconfig.json probe", () =>
		Effect.gen(function* () {
			const result = yield* resolveExtendsTarget("exp", "/proj/tsconfig.json");
			assert.deepStrictEqual(result, Option.none());
		}),
	);
});

layer(
	fixtureLayer(
		tree(["/proj/node_modules/bad/package.json", "{ not json"], ["/proj/node_modules/bad/tsconfig.json", EMPTY]),
	),
)("resolveExtendsTarget, malformed manifest coerced to empty", (it) => {
	it.effect("a hostile package.json falls through to the tsconfig.json probe, never a defect", () =>
		Effect.gen(function* () {
			// tsc's readJson (typescript.js:21176) coerces an unparseable
			// manifest to {} and the manifest-less lookups still run.
			const result = yield* resolveExtendsTarget("bad", "/proj/tsconfig.json");
			assert.deepStrictEqual(result, Option.some("/proj/node_modules/bad/tsconfig.json"));
		}),
	);
});

layer(
	fixtureLayer(
		tree(
			["/proj/node_modules/badfield/package.json", '{"tsconfig":"./nope.json"}'],
			["/proj/node_modules/badfield/tsconfig.json", EMPTY],
		),
	),
)("resolveExtendsTarget, tsconfig field pointing at a missing file", (it) => {
	it.effect("falls through to the tsconfig.json probe when the field target does not exist", () =>
		Effect.gen(function* () {
			// tsc parity: a falsy packageFileResult falls through to
			// loadModuleFromFile(indexPath) — typescript.js:45943-45945.
			const result = yield* resolveExtendsTarget("badfield", "/proj/tsconfig.json");
			assert.deepStrictEqual(result, Option.some("/proj/node_modules/badfield/tsconfig.json"));
		}),
	);
});

layer(
	fixtureLayer(
		tree(
			["/proj/node_modules/emptyfield/package.json", '{"tsconfig":""}'],
			["/proj/node_modules/emptyfield/tsconfig.json", EMPTY],
			// `path.resolve(pkgDir, "")` resolves to the package DIRECTORY, which
			// a directory-true `exists` accepts. The volume creates that directory
			// on its own, so the discriminating condition is real here rather than
			// simulated: under the old `typeof tsField === "string"` guard the
			// empty field "resolved" to the directory instead of a config file.
			// The fixed guard treats it as falsy and never probes the path.
		),
	),
)("resolveExtendsTarget, empty-string tsconfig field falls through", (it) => {
	it.effect("treats an empty tsconfig field as falsy, per tsc's packageFile && loader(...) parity", () =>
		Effect.gen(function* () {
			// tsc parity: `path.resolve(pkgDir, "")` resolves to the package
			// directory, which a directory-true `exists` would accept — but tsc
			// treats a falsy packageFile as no-match and falls through to the
			// `<pkg>/tsconfig.json` probe (typescript.js:45943-45945, same
			// citation as the "field pointing at a missing file" case above).
			const result = yield* resolveExtendsTarget("emptyfield", "/proj/tsconfig.json");
			assert.deepStrictEqual(result, Option.some("/proj/node_modules/emptyfield/tsconfig.json"));
		}),
	);
});

layer(
	fixtureLayer(tree(["/proj/node_modules/arr/package.json", "[]"], ["/proj/node_modules/arr/tsconfig.json", EMPTY])),
)("resolveExtendsTarget, non-object manifest coerced to empty", (it) => {
	it.effect("a non-object package.json falls through to the tsconfig.json probe", () =>
		Effect.gen(function* () {
			const result = yield* resolveExtendsTarget("arr", "/proj/tsconfig.json");
			assert.deepStrictEqual(result, Option.some("/proj/node_modules/arr/tsconfig.json"));
		}),
	);
});

layer(fixtureLayer(tree(["/proj/node_modules/nomanifest/tsconfig.json", EMPTY])))(
	"resolveExtendsTarget, package with no package.json at all",
	(it) => {
		it.effect("probes tsconfig.json even when the manifest is absent", () =>
			Effect.gen(function* () {
				const result = yield* resolveExtendsTarget("nomanifest", "/proj/tsconfig.json");
				assert.deepStrictEqual(result, Option.some("/proj/node_modules/nomanifest/tsconfig.json"));
			}),
		);
	},
);

layer(
	fixtureLayer(
		tree(
			["/proj/a/node_modules/dual/package.json", EMPTY],
			["/proj/node_modules/dual/package.json", EMPTY],
			["/proj/node_modules/dual/tsconfig.json", EMPTY],
		),
	),
)("resolveExtendsTarget, walk continues past an unresolved candidate", (it) => {
	it.effect("a nearer copy that does not resolve does not shadow a farther one that does", () =>
		Effect.gen(function* () {
			// tsc's ancestor walk only stops on a defined result
			// (forEachAncestorDirectoryStoppingAtGlobalCache, typescript.js:46466).
			const result = yield* resolveExtendsTarget("dual", "/proj/a/tsconfig.json");
			assert.deepStrictEqual(result, Option.some("/proj/node_modules/dual/tsconfig.json"));
		}),
	);
});

// ---------------------------------------------------------------------------
// resolveExports — pure unit tests, including hostile inputs
// ---------------------------------------------------------------------------

describe("resolveExports", () => {
	it("resolves a bare string exports target for the root subpath", () => {
		assert.deepStrictEqual(resolveExports("./tsconfig.json", "."), Option.some("./tsconfig.json"));
	});

	it("matches conditions in map insertion order (require before default)", () => {
		const exports = { ".": { require: "./r.json", default: "./d.json" } };
		assert.deepStrictEqual(resolveExports(exports, "."), Option.some("./r.json"));
	});

	it("walks a fallback array to the first resolvable entry", () => {
		const exports = { ".": [{ unknowncond: "./a.json" }, "./b.json"] };
		assert.deepStrictEqual(resolveExports(exports, "."), Option.some("./b.json"));
	});

	it("substitutes a single-star subpath pattern", () => {
		const exports = { "./*": "./cfg/*" };
		assert.deepStrictEqual(resolveExports(exports, "./node20.json"), Option.some("./cfg/node20.json"));
	});

	it("rejects a non-.json target", () => {
		assert.deepStrictEqual(resolveExports({ ".": "./tsconfig" }, "."), Option.none());
	});

	it("reads a top-level fallback array as the root target", () => {
		assert.deepStrictEqual(resolveExports(["./a.json"], "."), Option.some("./a.json"));
	});

	it("returns none for a non-object, non-string exports value", () => {
		assert.deepStrictEqual(resolveExports(42, "."), Option.none());
	});

	it("returns none when a subpath map has no matching key or pattern", () => {
		assert.deepStrictEqual(resolveExports({ "./a.json": "./x.json" }, "./b.json"), Option.none());
	});

	it("substitutes a wildcard into a nested condition object", () => {
		const exports = { "./*": { types: "./cfg/*.json" } };
		assert.deepStrictEqual(resolveExports(exports, "./node20"), Option.some("./cfg/node20.json"));
	});

	it("substitutes a wildcard into a fallback array target", () => {
		const exports = { "./*": ["./cfg/*.json"] };
		assert.deepStrictEqual(resolveExports(exports, "./node20"), Option.some("./cfg/node20.json"));
	});

	it("picks the pattern with the longest base prefix, not the first in key order", () => {
		const exports = { "./*.json": "./generic/*.json", "./cfg/*.json": "./specific/*.json" };
		assert.deepStrictEqual(resolveExports(exports, "./cfg/node20.json"), Option.some("./specific/node20.json"));
	});

	it("skips a __proto__ condition key", () => {
		const exports = JSON.parse('{".":{"__proto__":"./evil.json","default":"./safe.json"}}');
		assert.deepStrictEqual(resolveExports(exports, "."), Option.some("./safe.json"));
	});

	const deepConditions = (depth: number): unknown => {
		let node: unknown = "./deep.json";
		for (let i = 0; i < depth; i += 1) node = { types: node };
		return { ".": node };
	};

	it("resolves shallow condition nesting", () => {
		assert.deepStrictEqual(resolveExports(deepConditions(5), "."), Option.some("./deep.json"));
	});

	it("returns none past the depth guard", () => {
		assert.deepStrictEqual(resolveExports(deepConditions(100), "."), Option.none());
	});
});

// ---------------------------------------------------------------------------
// TsconfigLoader.load — read one file, decode, wrap decode failures
// ---------------------------------------------------------------------------

layer(fixtureLayer(tree(["/proj/tsconfig.json", '{"compilerOptions":{"strict":true}}'])))(
	"TsconfigLoader.load, single file",
	(it) => {
		it.effect("reads and decodes one config, no extends resolution", () =>
			Effect.gen(function* () {
				const doc = yield* TsconfigLoader.load("/proj/tsconfig.json");
				assert.strictEqual(doc.compilerOptions?.strict, true);
			}),
		);
	},
);

layer(fixtureLayer(tree(["/proj/tsconfig.json", "{ not valid jsonc"])))("TsconfigLoader.load, malformed file", (it) => {
	it.effect("wraps a decode failure in TsconfigParseError carrying the absolute path", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(TsconfigLoader.load("/proj/tsconfig.json"));
			assert.strictEqual(error._tag, "TsconfigParseError");
			if (error._tag === "TsconfigParseError") {
				assert.strictEqual(error.path, "/proj/tsconfig.json");
			}
		}),
	);
});

// ---------------------------------------------------------------------------
// TsconfigLoader.resolve — the full pipeline
// ---------------------------------------------------------------------------

layer(fixtureLayer(tree(["/proj/tsconfig.json", '{"compilerOptions":{"strict":true},"include":["src"]}'])))(
	"TsconfigLoader.resolve, single file no extends",
	(it) => {
		it.effect("resolves to the absolutized own config with extendedPaths === [configPath]", () =>
			Effect.gen(function* () {
				const resolved = yield* TsconfigLoader.resolve("/proj/tsconfig.json");
				assert.strictEqual(resolved.configPath, "/proj/tsconfig.json");
				assert.deepStrictEqual(resolved.extendedPaths, ["/proj/tsconfig.json"]);
				assert.strictEqual(resolved.compilerOptions.strict, true);
				assert.deepStrictEqual(resolved.include, ["src"]);
			}),
		);
	},
);

layer(
	fixtureLayer(
		tree(
			["/proj/base.json", '{"compilerOptions":{"strict":true,"noEmit":false}}'],
			["/proj/app/tsconfig.json", '{"extends":"../base.json","compilerOptions":{"noEmit":true,"declaration":true}}'],
		),
	),
)("TsconfigLoader.resolve, two-level relative chain", (it) => {
	it.effect("base options visible, derived wins per key, extendedPaths base-first", () =>
		Effect.gen(function* () {
			const resolved = yield* TsconfigLoader.resolve("/proj/app/tsconfig.json");
			assert.deepStrictEqual(resolved.extendedPaths, ["/proj/base.json", "/proj/app/tsconfig.json"]);
			assert.strictEqual(resolved.configPath, "/proj/app/tsconfig.json");
			assert.strictEqual(resolved.compilerOptions.strict, true); // inherited from base
			assert.strictEqual(resolved.compilerOptions.noEmit, true); // derived wins
			assert.strictEqual(resolved.compilerOptions.declaration, true); // derived only
		}),
	);
});

layer(
	fixtureLayer(
		tree(
			["/proj/c.json", '{"compilerOptions":{"noEmit":true,"declaration":false}}'],
			["/proj/a.json", '{"extends":"./c.json","compilerOptions":{"noEmit":false,"sourceMap":true}}'],
			["/proj/b.json", '{"compilerOptions":{"noEmit":true,"removeComments":true}}'],
			["/proj/tsconfig.json", '{"extends":["./a.json","./b.json"],"compilerOptions":{"removeComments":false}}'],
		),
	),
)("TsconfigLoader.resolve, array extends [A, B]", (it) => {
	it.effect("B beats A, own beats both, A's nested chain (C) applied before B (E3)", () =>
		Effect.gen(function* () {
			const resolved = yield* TsconfigLoader.resolve("/proj/tsconfig.json");
			// order applied: C, A, B, own
			assert.deepStrictEqual(resolved.extendedPaths, [
				"/proj/c.json",
				"/proj/a.json",
				"/proj/b.json",
				"/proj/tsconfig.json",
			]);
			assert.strictEqual(resolved.compilerOptions.noEmit, true); // B's true beats A's false
			assert.strictEqual(resolved.compilerOptions.declaration, false); // C (nested under A) survives
			assert.strictEqual(resolved.compilerOptions.sourceMap, true); // A only
			assert.strictEqual(resolved.compilerOptions.removeComments, false); // own beats B
		}),
	);
});

layer(
	fixtureLayer(
		tree(
			["/proj/c.json", '{"compilerOptions":{"strict":true}}'],
			["/proj/a.json", '{"extends":"./c.json","compilerOptions":{"declaration":true}}'],
			["/proj/b.json", '{"extends":"./c.json","compilerOptions":{"sourceMap":true}}'],
			["/proj/tsconfig.json", '{"extends":["./a.json","./b.json"]}'],
		),
	),
)("TsconfigLoader.resolve, diamond", (it) => {
	it.effect("A and B both extend C — legal, no cycle error (E6 per-branch stacks)", () =>
		Effect.gen(function* () {
			const resolved = yield* TsconfigLoader.resolve("/proj/tsconfig.json");
			assert.deepStrictEqual(resolved.extendedPaths, [
				"/proj/c.json",
				"/proj/a.json",
				"/proj/c.json",
				"/proj/b.json",
				"/proj/tsconfig.json",
			]);
			assert.strictEqual(resolved.compilerOptions.strict, true);
			assert.strictEqual(resolved.compilerOptions.declaration, true);
			assert.strictEqual(resolved.compilerOptions.sourceMap, true);
		}),
	);
});

layer(fixtureLayer(tree(["/proj/a.json", '{"extends":"./b.json"}'], ["/proj/b.json", '{"extends":"./a.json"}'])))(
	"TsconfigLoader.resolve, direct cycle",
	(it) => {
		it.effect("A extends B extends A fails TsconfigExtendsError reason cycle with the full chain", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(TsconfigLoader.resolve("/proj/a.json"));
				assert.strictEqual(error._tag, "TsconfigExtendsError");
				if (error._tag === "TsconfigExtendsError") {
					assert.strictEqual(error.reason, "cycle");
					assert.strictEqual(error.path, "/proj/b.json"); // the config whose extends re-entered
					assert.strictEqual(error.target, "/proj/a.json");
					assert.deepStrictEqual(error.chain, ["/proj/a.json", "/proj/b.json", "/proj/a.json"]);
				}
			}),
		);
	},
);

const deepTree = (): ReadonlyMap<string, string> => {
	const entries: Array<readonly [string, string]> = [];
	for (let i = 0; i < 40; i += 1) {
		entries.push([`/proj/c${i}.json`, i < 39 ? `{"extends":"./c${i + 1}.json"}` : EMPTY]);
	}
	return new Map(entries);
};

layer(fixtureLayer(deepTree()))("TsconfigLoader.resolve, depth guard", (it) => {
	it.effect("a chain deeper than MAX_EXTENDS_DEPTH fails reason depth", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(TsconfigLoader.resolve("/proj/c0.json"));
			assert.strictEqual(error._tag, "TsconfigExtendsError");
			if (error._tag === "TsconfigExtendsError") {
				assert.strictEqual(error.reason, "depth");
			}
		}),
	);
});

layer(fixtureLayer(tree(["/proj/tsconfig.json", '{"extends":""}'])))(
	"TsconfigLoader.resolve, empty extends string",
	(it) => {
		it.effect("an empty extends target fails reason empty", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(TsconfigLoader.resolve("/proj/tsconfig.json"));
				assert.strictEqual(error._tag, "TsconfigExtendsError");
				if (error._tag === "TsconfigExtendsError") {
					assert.strictEqual(error.reason, "empty");
					assert.strictEqual(error.path, "/proj/tsconfig.json");
					assert.strictEqual(error.target, "");
				}
			}),
		);
	},
);

layer(fixtureLayer(tree(["/proj/tsconfig.json", '{"extends":"./nope.json"}'])))(
	"TsconfigLoader.resolve, unresolvable target",
	(it) => {
		it.effect("a missing extends target fails reason not-found carrying the spec", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(TsconfigLoader.resolve("/proj/tsconfig.json"));
				assert.strictEqual(error._tag, "TsconfigExtendsError");
				if (error._tag === "TsconfigExtendsError") {
					assert.strictEqual(error.reason, "not-found");
					assert.strictEqual(error.target, "./nope.json");
					assert.strictEqual(error.path, "/proj/tsconfig.json");
				}
			}),
		);
	},
);

layer(fixtureLayer(tree(["/proj/base.json", "{ not valid"], ["/proj/tsconfig.json", '{"extends":"./base.json"}'])))(
	"TsconfigLoader.resolve, malformed extended file",
	(it) => {
		it.effect("a malformed EXTENDED file fails TsconfigParseError carrying THAT file's path", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(TsconfigLoader.resolve("/proj/tsconfig.json"));
				assert.strictEqual(error._tag, "TsconfigParseError");
				if (error._tag === "TsconfigParseError") {
					assert.strictEqual(error.path, "/proj/base.json");
				}
			}),
		);
	},
);

layer(
	fixtureLayer(
		tree(
			["/proj/base.json", `{"compilerOptions":{"outDir":"\${configDir}/dist"}}`],
			["/proj/app/tsconfig.json", '{"extends":"../base.json"}'],
		),
	),
)(`TsconfigLoader.resolve, \${configDir} in a base config`, (it) => {
	it.effect(`a base config's \${configDir} outDir substitutes against the TOP config's dir`, () =>
		Effect.gen(function* () {
			const resolved = yield* TsconfigLoader.resolve("/proj/app/tsconfig.json");
			assert.strictEqual(resolved.compilerOptions.outDir, "/proj/app/dist");
		}),
	);
});

layer(
	fixtureLayer(
		tree(
			["/proj/base.json", '{"include":["src"],"files":["main.ts"]}'],
			["/proj/app/tsconfig.json", '{"extends":"../base.json","compilerOptions":{"strict":true}}'],
		),
	),
)("TsconfigLoader.resolve, inherited files/include re-rooted", (it) => {
	it.effect("files/include inherited from base are re-rooted so they still point at the base's directory", () =>
		Effect.gen(function* () {
			const resolved = yield* TsconfigLoader.resolve("/proj/app/tsconfig.json");
			assert.deepStrictEqual(resolved.include, ["../src"]);
			assert.deepStrictEqual(resolved.files, ["../main.ts"]);
		}),
	);
});
