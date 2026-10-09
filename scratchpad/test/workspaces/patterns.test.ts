// `internal/patterns.ts` is tested directly, and deliberately so.
//
// Its two read failures are NOT distinguishable through `WorkspaceDiscovery`:
// discovery reads the root `package.json` a second time to build the root
// package, so an unreadable manifest fails there too, with the same `kind` and
// the same `path`. A discovery-level test therefore passes whether or not
// `readPatterns` swallows the error — it cannot fail for the right reason, which
// is worse than not existing. This one can.

import { assert, describe, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { readPatterns } from "../../effected/workspaces/internal/patterns.ts";
import type { Tree } from "./fixtures.ts";
import { platform } from "./fixtures.ts";

const tree: Tree = {
	"/repo/pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
	"/repo/package.json": JSON.stringify({ name: "root", workspaces: ["apps/*"] }),
};

describe("readPatterns — the happy paths", () => {
	layer(platform(tree), { timeout: "30 seconds" })((it) => {
		it.effect("prefers pnpm-workspace.yaml over the manifest workspaces field", () =>
			Effect.gen(function* () {
				assert.deepStrictEqual(yield* readPatterns("/repo"), ["packages/*"]);
			}),
		);
	});
});

describe("readPatterns — a pnpm-workspace.yaml with no packages key falls through", () => {
	layer(
		platform({
			"/repo/pnpm-workspace.yaml": "onlyBuiltDependencies:\n  - esbuild\n",
			"/repo/package.json": JSON.stringify({ name: "root", workspaces: ["apps/*"] }),
		}),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("reads the manifest workspaces field", () =>
			Effect.gen(function* () {
				assert.deepStrictEqual(yield* readPatterns("/repo"), ["apps/*"]);
			}),
		);
	});
});

describe("readPatterns — an absent config is not an error", () => {
	layer(platform({ "/repo/README.md": "no config here" }), { timeout: "30 seconds" })((it) => {
		it.effect("a standalone directory declares no patterns", () =>
			Effect.gen(function* () {
				// ABSENT is a real, distinguishable condition. Only UNREADABLE is the bug.
				assert.deepStrictEqual(yield* readPatterns("/repo"), []);
			}),
		);
	});
});

// ── the silent-degradation bug ─────────────────────────────────────────────
//
// The old code substituted "" for an unreadable pnpm-workspace.yaml and "{}" for
// an unreadable package.json. That made an UNREADABLE file and an EMPTY file
// produce byte-identical results, so the failure was invisible by construction:
// a permission error yielded "this workspace declares no packages".

describe("readPatterns — an unreadable pnpm-workspace.yaml", () => {
	layer(platform(tree, { unreadableFiles: new Set(["/repo/pnpm-workspace.yaml"]) }), { timeout: "30 seconds" })((it) => {
		it.effect("fails typed rather than reading as an empty document", () =>
			Effect.gen(function* () {
				const failure = yield* Effect.flip(readPatterns("/repo"));
				assert.strictEqual(failure.kind, "read");
				assert.strictEqual(failure.path, "/repo/pnpm-workspace.yaml");
			}),
		);
	});
});

describe("readPatterns — an unreadable package.json", () => {
	// The pnpm config parses but declares no `packages:`, so pattern reading falls
	// through to the manifest — and THAT is the unreadable file.
	layer(
		platform(
			{
				"/repo/pnpm-workspace.yaml": "onlyBuiltDependencies:\n  - esbuild\n",
				"/repo/package.json": JSON.stringify({ name: "root", workspaces: ["apps/*"] }),
			},
			{ unreadableFiles: new Set(["/repo/package.json"]) },
		),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("fails typed rather than reading as `{}`", () =>
			Effect.gen(function* () {
				const failure = yield* Effect.flip(readPatterns("/repo"));
				assert.strictEqual(failure.kind, "read");
				assert.strictEqual(failure.path, "/repo/package.json");
			}),
		);
	});
});

describe("readPatterns — a malformed config still fails typed", () => {
	layer(platform({ "/repo/pnpm-workspace.yaml": "packages:\n  - [unclosed\n" }), { timeout: "30 seconds" })((it) => {
		it.effect("invalid YAML is invalidYaml, not a defect", () =>
			Effect.gen(function* () {
				const failure = yield* Effect.flip(readPatterns("/repo"));
				assert.strictEqual(failure.kind, "invalidYaml");
			}),
		);
	});
});
