// biome-ignore-all lint/suspicious/noTemplateCurlyInString: the fixtures are unsubstituted ${...} launch placeholders, and a literal placeholder is what the tests assert on
import { $ScratchpadId } from "@beep/identity/packages";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { LaunchContext, ProjectDirInput } from "../../effected/engine/index.ts";

const keys = ["OKFIT_PROJECT_DIR", "CLAUDE_PROJECT_DIR"] as const;

// A mix of hostile literals (empty, whitespace-only, unsubstituted placeholders)
// and arbitrary strings — per effect-v4-testing, a Schema.Literals union rather
// than a filter, so the hostile shapes are sampled directly instead of hoped for.
const EdgeString = S.Union([
	S.Literals(["", " ", "\t", "${CLAUDE_PROJECT_DIR}", "  ${CLAUDE_PROJECT_DIR}  ", "${}"]),
	S.String,
]);

// A Struct of optionalKey fields, not a Schema.Record — a Record always emits
// every key, which would never exercise the "key absent" branch of projectDir.
const EnvArb = S.Struct({
	OKFIT_PROJECT_DIR: S.optionalKey(EdgeString),
	CLAUDE_PROJECT_DIR: S.optionalKey(EdgeString),
});

describe("ProjectDirInput", () => {
	it("carries its own composed identity", () => {
		const $I = $ScratchpadId.create("effected/engine/LaunchContext");
		assert.deepStrictEqual(
			ProjectDirInput.ast.annotations,
			$I.annote("ProjectDirInput", {
				description: "The process-derived facts a front end resolves once, passed in as values.",
			}),
		);
	});

	it.effect("accepts omitted, undefined and readonly argv with undefined environment values", () =>
		Effect.gen(function* () {
			const env = { OKFIT_PROJECT_DIR: undefined, CLAUDE_PROJECT_DIR: "  /from/env  " } as const;
			const inputs: ReadonlyArray<ProjectDirInput> = [
				{ env, keys, cwd: "/cwd" },
				{ argv: undefined, env, keys, cwd: "/cwd" },
				{ argv: [] as const, env, keys, cwd: "/cwd" },
				{ argv: ["  /from/argv  "] as const, env, keys, cwd: "/cwd" },
				{ env: { OKFIT_PROJECT_DIR: undefined }, keys, cwd: "  /cwd  " },
			];
			for (const input of inputs) {
				const decoded = yield* S.decodeEffect(ProjectDirInput)(input);
				const encoded = yield* S.encodeEffect(ProjectDirInput)(decoded);
				assert.deepStrictEqual(decoded, input);
				assert.deepStrictEqual(encoded, input);
				assert.strictEqual(LaunchContext.projectDir(decoded), LaunchContext.projectDir(input));
			}
		}),
	);
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
		{ argv: S.Array(EdgeString), env: EnvArb, cwd: S.NonEmptyString },
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
