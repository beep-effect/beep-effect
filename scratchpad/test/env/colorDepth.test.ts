// @effect-diagnostics nodeBuiltinImport:skip-file
import { readFileSync } from "node:fs";
import * as tty from "node:tty";
import { fileURLToPath } from "node:url";
import { assert, describe, it } from "@effect/vitest";
import { colorDepth, colorKeys } from "../../effected/env/internal/colorDepth.ts";

const nodeDepth = (env: Record<string, string>): string => {
	const bits = tty.WriteStream.prototype.getColorDepth.call(undefined, env);
	return bits === 1 ? "none" : bits === 4 ? "basic" : bits === 8 ? "256" : "truecolor";
};

const CASES: ReadonlyArray<Record<string, string>> = [
	{},
	{ TERM: "xterm-256color" },
	{ TERM: "xterm" },
	{ TERM: "dumb" },
	{ TERM: "xterm-kitty" },
	{ TERM: "screen" },
	{ TERM: "vt100" },
	{ TERM: "rxvt-unicode-24bit" },
	{ TERM: "xterm-truecolor" },
	{ COLORTERM: "truecolor" },
	{ COLORTERM: "24bit" },
	{ COLORTERM: "yes" },
	{ TERM_PROGRAM: "iTerm.app", TERM_PROGRAM_VERSION: "3.5.0" },
	{ TERM_PROGRAM: "iTerm.app", TERM_PROGRAM_VERSION: "2.9.0" },
	{ TERM_PROGRAM: "iTerm.app" },
	{ TERM_PROGRAM: "Apple_Terminal" },
	{ TERM_PROGRAM: "HyperTerm" },
	{ TMUX: "/tmp/tmux-501/default,1,0" },
	{ CI: "true" },
	{ CI: "true", GITHUB_ACTIONS: "true" },
	{ CI: "1", GITLAB_CI: "true" },
	{ CI: "true", CI_NAME: "codeship" },
	{ TF_BUILD: "True", AGENT_NAME: "x" },
	{ TEAMCITY_VERSION: "9.1.0" },
	{ TEAMCITY_VERSION: "8.0.0" },
	{ NO_COLOR: "1", TERM: "xterm-256color" },
	{ NODE_DISABLE_COLORS: "1", TERM: "xterm-256color" },
	{ FORCE_COLOR: "0", TERM: "xterm-256color" },
	{ FORCE_COLOR: "1" },
	{ FORCE_COLOR: "true" },
	{ FORCE_COLOR: "2" },
	{ FORCE_COLOR: "3" },
	{ FORCE_COLOR: "banana" },
	{ FORCE_COLOR: "3", NO_COLOR: "1" },
	{ FORCE_COLOR: "1", TERM: "dumb" },
];

const win32 = process.platform === "win32";

// Added beyond the brief's table, which stays unedited above: terminals Node maps through its TERM table and
// regex list, and the rows the first table skips. The Node oracle takes a win32 branch on Windows, so it is
// skipped there.
const EXTRA_CASES: ReadonlyArray<Record<string, string>> = [
	{ TERM: "eterm" },
	{ TERM: "putty" },
	{ TERM: "st" },
	{ TERM: "terminator" },
	{ TERM: "mosh" },
	{ TERM: "ansi" },
	{ TERM: "color-foo" },
	{ TERM: "linux" },
	{ TERM: "direct" },
	{ TERM: "vt220" },
	{ TERM_PROGRAM: "MacTerm" },
	{ TF_BUILD: "True" },
];

describe("colorDepth", () => {
	for (const env of EXTRA_CASES) {
		it.skipIf(win32)(`matches Node on a TTY for the extra row ${JSON.stringify(env)}`, () => {
			assert.strictEqual(colorDepth(env, true), nodeDepth(env));
		});
	}

	// Node looks TERM up in a plain object, so TERM=constructor reaches Object.prototype and returns a function
	// as a depth. Here the table is a Map: these rows are pinned against colorDepth only, never against Node.
	for (const term of ["constructor", "__proto__", "toString"]) {
		it(`TERM=${term} cannot reach Object.prototype and reads as none`, () => {
			assert.strictEqual(colorDepth({ TERM: term }, true), "none");
		});
	}

	for (const env of CASES) {
		it.skipIf(win32)(`matches Node on a TTY for ${JSON.stringify(env)}`, () => {
			assert.strictEqual(colorDepth(env, true), nodeDepth(env));
		});
	}

	// Added beyond the brief's table: the CI provider keys live in a table the source regex cannot see.
	for (const name of [
		"APPVEYOR",
		"BUILDKITE",
		"CIRCLECI",
		"DRONE",
		"GITEA_ACTIONS",
		"GITHUB_ACTIONS",
		"GITLAB_CI",
		"TRAVIS",
	]) {
		it.skipIf(win32)(`matches Node for CI provider ${name}`, () => {
			const env = { CI: "true", [name]: "true" };
			assert.strictEqual(colorDepth(env, true), nodeDepth(env));
			assert.include(colorKeys, name);
		});
	}

	it.skipIf(win32)(
		"the oracle is live: Node distinguishes at least three levels across the table (positive control)",
		() => {
			assert.isAtLeast(new Set(CASES.map(nodeDepth)).size, 3);
		},
	);

	it("a non-TTY stream is none unless FORCE_COLOR says otherwise", () => {
		assert.strictEqual(colorDepth({ TERM: "xterm-256color" }, false), "none");
		assert.strictEqual(colorDepth({ FORCE_COLOR: "2" }, false), "256");
		assert.strictEqual(colorDepth({ FORCE_COLOR: "0" }, false), "none");
	});

	it("FORCE_COLOR beats NO_COLOR (Node precedence, okf/decisions/force-color-honoured-node-precedence.md)", () => {
		assert.strictEqual(colorDepth({ FORCE_COLOR: "3", NO_COLOR: "1" }, false), "truecolor");
	});

	it.skipIf(win32)(
		'documented divergence: FORCE_COLOR="" is unset here because readEnv normalizes empty strings to absent',
		() => {
			// Node: "" forces 16 colours. Our env record never carries "" (readEnv drops it),
			// so the record the detector sees has no FORCE_COLOR key at all.
			assert.strictEqual(nodeDepth({ FORCE_COLOR: "", TERM: "dumb" }), "basic");
			assert.strictEqual(colorDepth({ TERM: "dumb" }, true), "none");
		},
	);

	// Node's win32 branch sits after the FORCE_COLOR and disable checks and before every other row, and gives truecolor
	// from Windows 10 build 14931. Env is read only through Config, so `OS=Windows_NT`, which Windows sets system-wide
	// and Git Bash keeps, stands in for the platform. The Node oracle reads `process.platform`, so these rows are pinned
	// against colorDepth only.
	describe("on Windows (OS=Windows_NT)", () => {
		const OS = "Windows_NT";

		it("a TTY with no TERM is truecolor, as in cmd.exe, PowerShell and Windows Terminal", () => {
			assert.strictEqual(colorDepth({ OS }, true), "truecolor");
		});

		it("the Windows branch comes before TERM, CI and the rest of the table", () => {
			for (const env of [
				{ OS, TERM: "xterm" },
				{ OS, TERM: "cygwin" },
				{ OS, CI: "true" },
				{ OS, TF_BUILD: "True", AGENT_NAME: "x" },
				{ OS, TERM_PROGRAM: "Apple_Terminal" },
			]) {
				assert.strictEqual(colorDepth(env, true), "truecolor", JSON.stringify(env));
			}
		});

		it("FORCE_COLOR, NO_COLOR, NODE_DISABLE_COLORS and TERM=dumb still win, and a stream that is not a TTY is none", () => {
			assert.strictEqual(colorDepth({ OS, FORCE_COLOR: "0" }, true), "none");
			assert.strictEqual(colorDepth({ OS, FORCE_COLOR: "1" }, true), "basic");
			assert.strictEqual(colorDepth({ OS, NO_COLOR: "1" }, true), "none");
			assert.strictEqual(colorDepth({ OS, NODE_DISABLE_COLORS: "1" }, true), "none");
			assert.strictEqual(colorDepth({ OS, TERM: "dumb" }, true), "none");
			assert.strictEqual(colorDepth({ OS }, false), "none");
		});

		it("another OS value is not Windows", () => {
			assert.strictEqual(colorDepth({ OS: "Linux" }, true), "none");
			assert.strictEqual(colorDepth({ OS: "windows_nt" }, true), "none");
		});
	});

	it("colorKeys lists every env key the detector reads", () => {
		const dir = fileURLToPath(new URL("../../effected/env/internal/", import.meta.url));
		const source = readFileSync(`${dir}colorDepth.ts`, "utf8");
		const read = new Set(
			[...source.matchAll(/(?<![\w./])env(?:\.([A-Z][A-Za-z_]+)|\[\s*"([A-Za-z_]+)"\s*\])/g)].flatMap((m) => {
				const key = m[1] ?? m[2];
				return key === undefined ? [] : [key];
			}),
		);
		assert.isAbove(read.size, 10, "the regex found the reads (control)");
		for (const key of read) assert.include(colorKeys, key, `colorKeys is missing ${key}`);
	});
});
