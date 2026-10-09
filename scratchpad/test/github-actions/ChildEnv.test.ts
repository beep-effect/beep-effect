// The three traps ARE the test matrix. Each of these cost a real consumer a
// cross-OS matrix round or a review catch before the helper existed:
// (a) `env` without `extendEnv: true` silently strips the child's environment;
// (b) Windows inherits `Path`, and emitting `PATH` beside it leaves the winner
//     to Node's case-insensitive lexicographic-first dedupe — an undocumented
//     internal — so the helper must write THROUGH the inherited casing;
// (c) `.cmd` shims need `shell: true` since CVE-2024-27980.

import { assert, describe, it } from "@effect/vitest";
import { ChildEnv } from "../../effected/github-actions/index.ts";

describe("ChildEnv", () => {
	describe("trap (a): the extendEnv pair", () => {
		it("answers env AND extendEnv: true as one value", () => {
			// The pair is the point: a caller spreading the whole answer cannot
			// forget the flag, and a mutant returning only `env` fails here.
			const answer = ChildEnv.prependPath(["/tools/bin"], { base: { PATH: "/usr/bin" }, platform: "linux" });
			assert.deepStrictEqual(answer, { env: { PATH: "/tools/bin:/usr/bin" }, extendEnv: true });
		});

		it("carries exactly one env entry — the additions, nothing restated", () => {
			// The DetachedProcess composition takes `.env` alone and merges it over
			// the parent itself; restating unrelated variables here would make that
			// merge clobber them with stale copies.
			const answer = ChildEnv.prependPath(["/tools/bin"], {
				base: { PATH: "/usr/bin", HOME: "/home/ci" },
				platform: "linux",
			});
			assert.deepStrictEqual(Object.keys(answer.env), ["PATH"]);
		});
	});

	describe("trap (b): the Windows casing write-through", () => {
		it("writes through an inherited `Path`, never emitting `PATH` beside it", () => {
			const answer = ChildEnv.prependPath(["D:\\tools"], {
				base: { Path: "C:\\Windows\\system32", SystemRoot: "C:\\Windows" },
				platform: "win32",
			});
			// The discriminating assertion: the KEY is the inherited spelling. A
			// mutant that hardcodes "PATH" produces two case-colliding entries in
			// the merged block and leaves the winner to Node's internals.
			assert.deepStrictEqual(answer.env, { Path: "D:\\tools;C:\\Windows\\system32" });
		});

		it("finds the key case-insensitively, whatever the casing", () => {
			assert.strictEqual(ChildEnv.pathKeyOf({ path: "/usr/bin" }), "path");
			assert.strictEqual(ChildEnv.pathKeyOf({ Path: "x" }), "Path");
			assert.strictEqual(ChildEnv.pathKeyOf({ PATH: "x" }), "PATH");
			assert.strictEqual(ChildEnv.pathKeyOf({ HOME: "/home/ci" }), "PATH");
		});

		it("uses the platform's delimiter: `;` on win32, `:` elsewhere", () => {
			const win = ChildEnv.prependPath(["a", "b"], { base: { Path: "c" }, platform: "win32" });
			assert.deepStrictEqual(win.env, { Path: "a;b;c" });
			const posix = ChildEnv.prependPath(["a", "b"], { base: { PATH: "c" }, platform: "darwin" });
			assert.deepStrictEqual(posix.env, { PATH: "a:b:c" });
		});
	});

	describe("trap (c): the win32 shell decision", () => {
		it("asks for a shell on win32 only", () => {
			// `.cmd` shims cannot be spawned directly since CVE-2024-27980; POSIX
			// gets no shell, which would only add a quoting hazard.
			assert.isTrue(ChildEnv.needsShell("win32"));
			assert.isFalse(ChildEnv.needsShell("linux"));
			assert.isFalse(ChildEnv.needsShell("darwin"));
		});
	});

	describe("the prepend itself", () => {
		it("keeps the caller's order — the first directory wins name collisions", () => {
			const answer = ChildEnv.prependPath(["/pm/shims", "/runtime/bin"], {
				base: { PATH: "/usr/bin" },
				platform: "linux",
			});
			assert.deepStrictEqual(answer.env, { PATH: "/pm/shims:/runtime/bin:/usr/bin" });
		});

		it("appends nothing for an absent or empty inherited PATH — no empty trailing entry", () => {
			// A trailing delimiter is an empty PATH entry, which both platforms
			// historically read as "the current directory" — an injection, not a
			// tidiness issue.
			assert.deepStrictEqual(ChildEnv.prependPath(["/tools"], { base: {}, platform: "linux" }).env, {
				PATH: "/tools",
			});
			assert.deepStrictEqual(ChildEnv.prependPath(["/tools"], { base: { PATH: "" }, platform: "linux" }).env, {
				PATH: "/tools",
			});
		});
	});
});
