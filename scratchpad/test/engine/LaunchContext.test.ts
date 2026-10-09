// biome-ignore-all lint/suspicious/noTemplateCurlyInString: the fixtures are unsubstituted ${...} launch placeholders, and a literal placeholder is what the tests assert on
import { assert, describe, it } from "@effect/vitest";
import { Schema } from "effect";
import { LaunchContext } from "../../effected/engine/index.ts";

const keys = ["OKFIT_PROJECT_DIR", "CLAUDE_PROJECT_DIR"] as const;

// A mix of hostile literals (empty, whitespace-only, unsubstituted placeholders)
// and arbitrary strings — per effect-v4-testing, a Schema.Literals union rather
// than a filter, so the hostile shapes are sampled directly instead of hoped for.
const EdgeString = Schema.Union([
	Schema.Literals(["", " ", "\t", "${CLAUDE_PROJECT_DIR}", "  ${CLAUDE_PROJECT_DIR}  ", "${}"]),
	Schema.String,
]);

// A Struct of optionalKey fields, not a Schema.Record — a Record always emits
// every key, which would never exercise the "key absent" branch of projectDir.
const EnvArb = Schema.Struct({
	OKFIT_PROJECT_DIR: Schema.optionalKey(EdgeString),
	CLAUDE_PROJECT_DIR: Schema.optionalKey(EdgeString),
});

describe("LaunchContext.projectDir", () => {
	it("prefers a usable argv value", () => {
		assert.strictEqual(
			LaunchContext.projectDir({ argv: ["/from/argv"], env: { CLAUDE_PROJECT_DIR: "/from/env" }, keys, cwd: "/cwd" }),
			"/from/argv",
		);
	});

	it("walks env keys in order", () => {
		assert.strictEqual(
			LaunchContext.projectDir({ env: { OKFIT_PROJECT_DIR: "/a", CLAUDE_PROJECT_DIR: "/b" }, keys, cwd: "/cwd" }),
			"/a",
		);
	});

	it("skips an empty-string env value instead of returning it", () => {
		assert.strictEqual(
			LaunchContext.projectDir({ env: { OKFIT_PROJECT_DIR: "", CLAUDE_PROJECT_DIR: "/b" }, keys, cwd: "/cwd" }),
			"/b",
		);
	});

	it("skips a literal ${VAR} Claude Code left unsubstituted", () => {
		assert.strictEqual(
			LaunchContext.projectDir({
				argv: ["${CLAUDE_PROJECT_DIR}"],
				env: { CLAUDE_PROJECT_DIR: "${CLAUDE_PROJECT_DIR}" },
				keys,
				cwd: "/cwd",
			}),
			"/cwd",
		);
	});

	it("trims surrounding whitespace", () => {
		assert.strictEqual(LaunchContext.projectDir({ env: { CLAUDE_PROJECT_DIR: "  /b  " }, keys, cwd: "/cwd" }), "/b");
	});

	it("falls back to cwd when nothing is usable", () => {
		assert.strictEqual(LaunchContext.projectDir({ env: {}, keys, cwd: "/cwd" }), "/cwd");
	});
});

describe("LaunchContext.projectDir — property", () => {
	it.prop(
		"never returns an empty string when cwd is non-empty",
		{ argv: Schema.Array(EdgeString), env: EnvArb, cwd: Schema.NonEmptyString },
		({ argv, env, cwd }) => {
			const result = LaunchContext.projectDir({ argv, env, keys, cwd });
			return result !== "" && !LaunchContext.isUnsubstituted(result);
		},
		{ arbitrary: { runs: 200 } },
	);
});

describe("LaunchContext.isUnsubstituted", () => {
	it("detects a placeholder anywhere in the value", () => {
		assert.isTrue(LaunchContext.isUnsubstituted("${CLAUDE_PROJECT_DIR}"));
		assert.isTrue(LaunchContext.isUnsubstituted("${CLAUDE_PROJECT_DIR}/sub"));
		assert.isFalse(LaunchContext.isUnsubstituted("/real/path"));
		assert.isFalse(LaunchContext.isUnsubstituted("$HOME"));
	});

	it("agrees with the placeholder pattern `${`, any non-`}` run, `}`", () => {
		const reference = /\$\{[^}]*\}/;
		for (const value of ["${}", "${A", "A}", "}${", "${A}${", "${${A}", "}${A}", "$ {A}", "${{", "a${b}c", "${\n}"]) {
			assert.strictEqual(LaunchContext.isUnsubstituted(value), reference.test(value), JSON.stringify(value));
		}
	});

	it("stays linear on a long run of unclosed openers", () => {
		const hostile = "${{".repeat(200_000);
		const started = performance.now();
		assert.isFalse(LaunchContext.isUnsubstituted(hostile));
		assert.isBelow(performance.now() - started, 100);
	});
});
