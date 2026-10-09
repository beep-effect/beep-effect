import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, describe, it } from "@effect/vitest";
import { LanguageVariant, SyntaxKind, computeLineStarts, createScanner } from "typescript/unstable/ast";

/**
 * The package's rule that ambient process state is never read behind a
 * caller's back — stated in `ChildEnv`'s class doc — held structurally.
 *
 * @remarks
 * `ActionEnvironment` is THE reader of `process.env`; everything else asks
 * it, or takes the environment as an argument. The sites below are the
 * closed list of exceptions, each a documented default a caller can
 * override or a host fact no runner variable carries. A new match anywhere
 * else fails here, naming the file and line, rather than in review.
 */
const RULE =
	"ambient process state (process.env / process.arch / process.platform) is never read behind a caller's back — " +
	"read it through ActionEnvironment, or take it as an argument (see ChildEnv's class doc). " +
	"A new sanctioned default must be added to the allowlist in __test__/ambientReads.test.ts WITH its reason.";

const srcRoot = fileURLToPath(new URL("../src/", import.meta.url));

const AMBIENT_MEMBERS: ReadonlySet<string> = new Set(["env", "arch", "platform"]);

/**
 * Every `process.env` / `process.arch` / `process.platform` read in `text`,
 * found by walking TypeScript's own token stream rather than a regex over
 * comment-stripped source.
 *
 * @remarks
 * A site is the token triple `process` `.` `env|arch|platform`. The scanner
 * skips trivia, so comments never match; a string literal is one
 * `StringLiteral` token, so `"/* process.env *\/"` never matches either — the
 * two false-positive classes a regex has to approximate. Template literals
 * are the one place the scanner needs steering: after a `TemplateHead` or
 * `TemplateMiddle` the code inside `${…}` is scanned as code — a read there
 * IS a read and is counted — and when its closing brace arrives the scanner
 * is told to `reScanTemplateToken`, so the template's remaining text is a
 * template span, not code. Without that, a `}` inside a template resumes
 * scanning template text as identifiers.
 *
 * The scanner is TypeScript 7's, from `typescript/unstable/ast` — the
 * package's root export carries only `version` now that the compiler is
 * native, and the JS scanner moved there with a shorter signature (no
 * `ScriptTarget`) and `SyntaxKind.EndOfFile` in place of `EndOfFileToken`.
 */
const scanAmbientReads = (text: string): ReadonlyArray<{ readonly line: number; readonly text: string }> => {
	const found: Array<{ readonly line: number; readonly text: string }> = [];
	const lineStarts = computeLineStarts(text);
	const lines = text.split("\n");
	const lineOf = (position: number): number => {
		// The last line start at or before `position`; 0-based.
		let line = 0;
		while (line + 1 < lineStarts.length && (lineStarts[line + 1] ?? Number.POSITIVE_INFINITY) <= position) {
			line += 1;
		}
		return line;
	};
	const scanner = createScanner(true, LanguageVariant.Standard, text);
	// One entry per open template substitution: the brace depth at which its
	// `}` closes the `${`. A `{` inside the substitution pushes deeper.
	const templateDepths: Array<number> = [];
	let depth = 0;
	// The two tokens before the current one, oldest first, as (kind, text).
	let history: ReadonlyArray<readonly [SyntaxKind, string]> = [];
	const remember = (kind: SyntaxKind, value: string) => {
		history = [...history.slice(-1), [kind, value]];
	};
	let token = scanner.scan();
	while (token !== SyntaxKind.EndOfFile) {
		if (token === SyntaxKind.TemplateHead || token === SyntaxKind.TemplateMiddle) {
			templateDepths.push(depth);
		} else if (token === SyntaxKind.OpenBraceToken) {
			depth += 1;
		} else if (token === SyntaxKind.CloseBraceToken) {
			if (templateDepths[templateDepths.length - 1] === depth) {
				templateDepths.pop();
				// The `}` ends a substitution: what follows is template text, not
				// code, until the next `${` (`TemplateMiddle`) or the closing
				// backtick (`TemplateTail`).
				token = scanner.reScanTemplateToken(false);
				if (token === SyntaxKind.TemplateMiddle) {
					templateDepths.push(depth);
				}
				remember(token, "");
				token = scanner.scan();
				continue;
			}
			depth -= 1;
		}
		if (
			token === SyntaxKind.Identifier &&
			AMBIENT_MEMBERS.has(scanner.getTokenValue()) &&
			history[1]?.[0] === SyntaxKind.DotToken &&
			history[0]?.[0] === SyntaxKind.Identifier &&
			history[0][1] === "process"
		) {
			const line = lineOf(scanner.getTokenStart());
			found.push({ line: line + 1, text: (lines[line] ?? "").trim() });
		}
		remember(token, token === SyntaxKind.Identifier ? scanner.getTokenValue() : "");
		token = scanner.scan();
	}
	return found;
};

/** One read of ambient process state in `src/`. */
interface Site {
	/** Relative to `src/`. */
	readonly file: string;
	/** 1-based. */
	readonly line: number;
	/** The line's text, trimmed. */
	readonly text: string;
}

/** Every read of ambient process state in `src/`, by token. */
const ambientReadSites = (): ReadonlyArray<Site> => {
	const found: Array<Site> = [];
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(path);
			} else if (entry.name.endsWith(".ts")) {
				for (const site of scanAmbientReads(readFileSync(path, "utf8"))) {
					found.push({ file: relative(srcRoot, path), ...site });
				}
			}
		}
	};
	walk(srcRoot);
	return found.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
};

/**
 * The sanctioned sites, and why each is one. Keep it minimal: remove an
 * entry when its read goes away, and never add one without a reason.
 */
const ALLOWED: ReadonlyArray<readonly [string, string, string]> = [
	[
		"ActionEnvironment.ts",
		"Effect.sync(() => ({ ...process.env }) as Readonly<Record<string, string>>),",
		"THE reader: seeds the environment once, at layer construction",
	],
	[
		"ActionInput.ts",
		"static provider(env: Readonly<Record<string, string | undefined>> = process.env): ConfigProvider.ConfigProvider {",
		"a default parameter the caller overrides by passing an environment",
	],
	[
		"DetachedProcess.ts",
		"env: { ...(options.base ?? process.env), ...options.env },",
		"the `base` default — the one sanctioned ambient fallback, same class as ActionInput.provider's",
	],
	[
		"PackageManagerInstaller.ts",
		"Option.match(found, { onNone: () => process.arch as string, onSome: archFromRunner }),",
		"the off-runner fallback for RUNNER_ARCH, selecting the native-binary target",
	],
	[
		"ToolInstaller.ts",
		"ToolInstaller.cachePath({ root, tool, version, arch: process.arch });",
		"the tool-cache layout's arch segment is Node's spelling by contract with the runner",
	],
	[
		"ToolInstaller.ts",
		'const testRoot = (): string => process.env.RUNNER_TOOL_CACHE ?? "/tmp/runner-tool-cache";',
		"makeTest's cachePath default root — test-double only, a double has no ActionEnvironment to ask",
	],
	[
		"ToolInstaller.ts",
		"cachePath: (tool, version) => ToolInstaller.cachePath({ root: testRoot(), tool, version, arch: process.arch }),",
		"makeTest's cachePath default — the same arch segment `make` writes, for the same reason",
	],
	[
		"internal/pnpmExe.ts",
		'if (process.platform !== "linux") {',
		"detectMusl: the host libc is a host fact no runner variable carries",
	],
];

describe("ambient process reads", () => {
	// Keyed on (file, line text), not the line NUMBER: an edit above a sanctioned
	// site must not fail the gate. The number is for the report.
	const key = (site: { readonly file: string; readonly text: string }) => `${site.file} :: ${site.text}`;
	const render = (site: Site) => `  ${site.file}:${site.line}: ${site.text}`;

	it("every read of process.env / process.arch / process.platform in src/ is an allowlisted site", () => {
		const actual = ambientReadSites();
		const allowed = ALLOWED.map(([file, text]) => ({ file, text }));
		const unexpected = actual.filter((site) => !allowed.some((entry) => key(entry) === key(site)));
		const missing = allowed.filter((entry) => !actual.some((site) => key(entry) === key(site)));
		assert.deepStrictEqual(
			unexpected,
			[],
			`unsanctioned ambient read(s):\n${unexpected.map(render).join("\n")}\n${RULE}`,
		);
		assert.deepStrictEqual(
			missing,
			[],
			`allowlisted site(s) no longer present — remove them from the allowlist:\n${missing
				.map((site) => `  ${site.file}: ${site.text}`)
				.join("\n")}`,
		);
	});

	it("the scan can fail — it is asserting on a non-empty set with ActionEnvironment in it", () => {
		const files = ambientReadSites().map((site) => site.file);
		assert.include(files, "ActionEnvironment.ts");
	});

	// biome-ignore-start lint/suspicious/noTemplateCurlyInString: the fixtures are SOURCE TEXT holding template substitutions for the scanner to read — the `${` is the point
	it("the scanner counts code, not comments or strings, and sees inside a template substitution", () => {
		const fixture = [
			'const a = "/* process.env */";', // a string literal: one token, never a read
			"// process.env", // a comment: trivia, skipped
			"const b = `${process.env.X}`;", // a real read inside `${…}`
			"const c = process.env.Y; // trailing process.env", // one read, then a comment
		].join("\n");
		assert.deepStrictEqual(scanAmbientReads(fixture), [
			{ line: 3, text: "const b = `${process.env.X}`;" },
			{ line: 4, text: "const c = process.env.Y; // trailing process.env" },
		]);
	});

	it("the scanner resumes template text after a substitution, so `}` inside a template is not code", () => {
		// After `${a}` the text ` process.env ` is template span, not an
		// identifier chain; the object literal inside the substitution has its
		// own braces, which must not close the template early.
		const fixture = "const s = `${({ k: process.arch }).k} process.env ${process.platform}`;";
		assert.deepStrictEqual(
			scanAmbientReads(fixture).map((site) => site.line),
			[1, 1],
		);
		assert.deepStrictEqual(scanAmbientReads("const t = `${1} process.env`; const u = 2;"), []);
	});
	// biome-ignore-end lint/suspicious/noTemplateCurlyInString: fixtures end

	it("a lookalike is not a read: another object's `.env`, or `process` without the member", () => {
		assert.deepStrictEqual(scanAmbientReads("const a = options.env; const b = process; const c = process.pid;"), []);
	});
});
