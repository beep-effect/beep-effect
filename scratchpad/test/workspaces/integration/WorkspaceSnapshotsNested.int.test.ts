// `WorkspaceSnapshots.at(ref)` against a workspace root NESTED inside a larger
// git repo — the case a scripted `Git` mock cannot discriminate, because it
// needs real git's two path-base conventions to diverge.
//
// `git ls-tree` (run with cwd == the workspace root) emits paths relative to
// cwd, but `git show <ref>:<path>` resolves <path> relative to the git repo
// TOP-LEVEL, not cwd. When the workspace root is nested inside a larger repo
// (`.git` is not a workspace marker — nesting is a supported shape), a bare
// `git show <ref>:package.json` reads the OUTER repo's manifest, and member
// `git show <ref>:<dir>/package.json` reads outer paths that do not exist. The
// reader `./`-prefixes every path so git resolves it relative to cwd, aligning
// with ls-tree.
//
// This suite builds a git repo whose ROOT is one workspace (catalog `^3.0.0`,
// member `@outer/a`) and whose NESTED `inner/` subdirectory is its OWN workspace
// (catalog `^4.0.0`, members `@inner/a` / `@inner/b`), resolves the workspace
// root to `inner/`, and asserts the snapshot reflects the INNER workspace. Under
// the un-prefixed reader the snapshot reads the outer manifest instead — root
// `outer-root` alone, catalog `^3.0.0` — so every assertion below fails.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { afterAll, assert, beforeAll, describe, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { WorkspaceSnapshots, Workspaces } from "../../../effected/workspaces/index.ts";

let root: string;
let inner: string;

/** Writes `content` at `path`, creating parent directories as needed. */
const write = (path: string, content: string): void => {
	mkdirSync(join(path, ".."), { recursive: true });
	writeFileSync(path, content);
};

beforeAll(() => {
	root = mkdtempSync(join(tmpdir(), "effected-nested-snapshot-"));
	inner = join(root, "inner");

	// ── OUTER workspace (the whole temp dir is the git repo) ─────────────────
	write(
		join(root, "pnpm-workspace.yaml"),
		["packages:", "  - packages/*", "catalog:", "  effect: ^3.0.0", ""].join("\n"),
	);
	write(join(root, "package.json"), JSON.stringify({ name: "outer-root", version: "0.0.0", private: true }));
	write(join(root, "packages", "outer-a", "package.json"), JSON.stringify({ name: "@outer/a", version: "9.9.9" }));

	// ── INNER workspace (nested, its OWN pnpm-workspace.yaml and catalog) ─────
	write(
		join(inner, "pnpm-workspace.yaml"),
		["packages:", "  - packages/*", "catalog:", "  effect: ^4.0.0", ""].join("\n"),
	);
	write(join(inner, "package.json"), JSON.stringify({ name: "inner-root", version: "1.0.0", private: true }));
	write(
		join(inner, "packages", "inner-a", "package.json"),
		JSON.stringify({ name: "@inner/a", version: "1.1.0", dependencies: { effect: "catalog:" } }),
	);
	write(
		join(inner, "packages", "inner-b", "package.json"),
		JSON.stringify({ name: "@inner/b", version: "1.2.0", dependencies: { "@inner/a": "workspace:*" } }),
	);

	const git = (...args: ReadonlyArray<string>): void => {
		execFileSync("git", args, {
			cwd: root,
			env: { ...process.env, LC_ALL: "C", GIT_TERMINAL_PROMPT: "0" },
		});
	};
	git("init", "-q");
	git("config", "user.email", "test@example.com");
	git("config", "user.name", "Test");
	git("add", "-A");
	git("commit", "-q", "-m", "fixture");
});

afterAll(() => {
	if (root !== undefined) rmSync(root, { recursive: true, force: true });
});

describe("WorkspaceSnapshots.at — a workspace root nested inside a larger git repo", () => {
	it.effect("reads the INNER workspace's manifest, members and catalog — not the outer root's", () => {
		// The layer resolves the workspace root from `inner/`; `Git` runs against
		// the outer repo's `.git`, so `at(ref)` must `./`-anchor every read to
		// `inner/` rather than the repo top-level.
		const Live = Workspaces.layerWithGit({ cwd: inner }).pipe(Layer.provideMerge(NodeServices.layer));
		return Effect.gen(function* () {
			const snapshots = yield* WorkspaceSnapshots;
			const snapshot = yield* snapshots.at("HEAD");

			// The inner root plus both inner members — NOT `outer-root`/`@outer/a`.
			// The un-prefixed reader collapses to just ["outer-root"].
			const names = [...snapshot.versions.keys()].sort();
			assert.deepStrictEqual(names, ["@inner/a", "@inner/b", "inner-root"]);

			// The inner catalog. The un-prefixed reader carries the OUTER `^3.0.0`.
			assert.deepStrictEqual(snapshot.resolve("effect", "catalog:"), Option.some("^4.0.0"));

			// The inner workspace: specifier resolves against the inner member's version.
			assert.deepStrictEqual(snapshot.resolve("@inner/a", "workspace:*"), Option.some("1.1.0"));
		}).pipe(Effect.provide(Live));
	});
});
