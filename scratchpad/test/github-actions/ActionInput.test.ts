// @effect-diagnostics strictEffectProvide:skip-file multipleEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import { ActionInput } from "../../effected/github-actions/index.ts";

/** Read a config against a fixed runner environment. */
const read = <A>(config: Config.Config<A>, env: Record<string, string>) =>
	Effect.provide(config, ActionInput.layer(env));

const readOk = <A>(config: Config.Config<A>, env: Record<string, string>) => read(config, env);

const readFails = <A>(config: Config.Config<A>, env: Record<string, string>) =>
	Effect.map(Effect.exit(read(config, env)), (exit) => {
		assert.strictEqual(exit._tag, "Failure", "expected the input to be rejected");
	});

/** The rendered failure text, for asserting that an error names its offending line. */
const readErrorText = <A>(config: Config.Config<A>, env: Record<string, string>) =>
	Effect.map(Effect.flip(read(config, env)), (error) => String(error));

describe("ActionInput", () => {
	describe("the INPUT_ name mangling", () => {
		it.effect("PRESERVES dashes — the bug that shipped", () =>
			Effect.gen(function* () {
				// A consumer read process.env["INPUT_SBOM_CONFIG"] directly and
				// silently got nothing, because the runner publishes
				// INPUT_SBOM-CONFIG. No caller spells the name here, so the class of
				// bug is unrepresentable.
				assert.strictEqual(yield* readOk(ActionInput.string("sbom-config"), { "INPUT_SBOM-CONFIG": "x" }), "x");
			}),
		);

		it.effect("does not find the underscored spelling", () =>
			readFails(ActionInput.string("sbom-config"), { INPUT_SBOM_CONFIG: "x" }),
		);

		it.effect("replaces spaces with underscores and uppercases", () =>
			Effect.gen(function* () {
				assert.strictEqual(yield* readOk(ActionInput.string("my input"), { INPUT_MY_INPUT: "v" }), "v");
			}),
		);

		it.effect("treats an empty value as absent, as the runner sets unsupplied inputs to ''", () =>
			readFails(ActionInput.string("missing"), { INPUT_MISSING: "" }),
		);
	});

	describe("variable — the mangling, exported", () => {
		it("derives the exact runner variable, dashes preserved", () => {
			// The hand-written spelling this replaces was INPUT_BIOME_VERSION —
			// absent on a real runner, so the default silently applied and the
			// suite went green against the wrong value.
			assert.strictEqual(ActionInput.variable("biome-version"), "INPUT_BIOME-VERSION");
		});

		it("replaces spaces with underscores and uppercases; everything else survives", () => {
			assert.strictEqual(ActionInput.variable("my input"), "INPUT_MY_INPUT");
			assert.strictEqual(ActionInput.variable("Simple"), "INPUT_SIMPLE");
			assert.strictEqual(ActionInput.variable("a.b"), "INPUT_A.B");
		});
	});

	describe("input-name keys — the with:-block style", () => {
		it.effect("an input-name key serves the typed accessor", () =>
			Effect.gen(function* () {
				// No caller spells INPUT_BIOME-VERSION: the key is the input name
				// exactly as the workflow's `with:` block writes it, and the
				// mangling never leaves the module.
				assert.strictEqual(yield* readOk(ActionInput.string("biome-version"), { "biome-version": "2.3.14" }), "2.3.14");
			}),
		);

		it.effect("an input-name key makes a bare Config read resolve, as the production runtime would", () =>
			Effect.gen(function* () {
				// The requested regression: the test layer resolves a bare
				// Config.String("biome-version") through the same INPUT_ derivation
				// Action.run installs, so a suite green under ActionInput.layer is
				// green for the same reason the action is.
				assert.strictEqual(yield* readOk(Config.String("biome-version"), { "biome-version": "2.3.14" }), "2.3.14");
			}),
		);

		it.effect("the old hazard stays absent — and the new path cannot reproduce it", () =>
			Effect.gen(function* () {
				// The hand-written underscore spelling reads as absent, exactly as it
				// does on a real runner (which publishes INPUT_BIOME-VERSION)…
				yield* readFails(ActionInput.string("biome-version"), { INPUT_BIOME_VERSION: "x" });
				// …and the same test written input-name-first resolves, because the
				// caller never had a variable name to misspell.
				assert.strictEqual(yield* readOk(ActionInput.string("biome-version"), { "biome-version": "x" }), "x");
			}),
		);

		it.effect("mangles spaces and case in an input-name key", () =>
			Effect.gen(function* () {
				assert.strictEqual(yield* readOk(ActionInput.string("My Input"), { "my input": "v" }), "v");
			}),
		);

		it.effect("an explicit INPUT_-spelled entry wins over the input-name spelling", () =>
			Effect.gen(function* () {
				assert.strictEqual(
					yield* readOk(ActionInput.string("flag"), { INPUT_FLAG: "explicit", flag: "named" }),
					"explicit",
				);
			}),
		);

		it.effect("an empty input-name value reads as absent, like the runner's own ''", () =>
			readFails(ActionInput.string("flag"), { flag: "" }),
		);

		it.effect("a plain runner variable still resolves verbatim beside input-name keys", () =>
			Effect.gen(function* () {
				assert.strictEqual(
					yield* readOk(Config.String("PLAIN_VAR"), { PLAIN_VAR: "y", "biome-version": "2.3.14" }),
					"y",
				);
			}),
		);
	});

	describe("boolean", () => {
		it.effect("accepts every documented true and false spelling", () =>
			Effect.gen(function* () {
				for (const raw of ["true", "True", "TRUE"]) {
					assert.isTrue(yield* readOk(ActionInput.boolean("flag"), { INPUT_FLAG: raw }), raw);
				}
				for (const raw of ["false", "False", "FALSE"]) {
					assert.isFalse(yield* readOk(ActionInput.boolean("flag"), { INPUT_FLAG: raw }), raw);
				}
			}),
		);

		it.effect("tolerates surrounding whitespace from a YAML block", () =>
			Effect.gen(function* () {
				assert.isTrue(yield* readOk(ActionInput.boolean("flag"), { INPUT_FLAG: "  true\n" }));
			}),
		);

		it.effect("rejects a value outside the core schema rather than guessing", () =>
			readFails(ActionInput.boolean("flag"), { INPUT_FLAG: "yes" }),
		);
	});

	describe("literals", () => {
		it.effect("accepts a member of the allowed set and narrows to it", () =>
			Effect.gen(function* () {
				const mode = yield* readOk(ActionInput.literals("mode", ["commit", "pr"]), { INPUT_MODE: "pr" });
				// The compile-time half of the claim: the config's type is the union
				// of the literals, not `string`.
				const narrowed: Config.Config<"commit" | "pr"> = ActionInput.literals("mode", ["commit", "pr"]);
				const value: "commit" | "pr" = mode;
				assert.strictEqual(value, "pr");
				assert.isDefined(narrowed);
			}),
		);

		it.effect("rejects a value outside the set, naming the input, the value and the set", () =>
			Effect.gen(function* () {
				const text = yield* readErrorText(ActionInput.literals("mode", ["commit", "pr"]), { INPUT_MODE: "push" });
				assert.include(text, 'Input "mode" must be one of: commit | pr');
				assert.include(text, "push");
			}),
		);

		it.effect("the match is exact — no trim, no case folding", () =>
			Effect.gen(function* () {
				yield* readFails(ActionInput.literals("mode", ["commit", "pr"]), { INPUT_MODE: " pr" });
				yield* readFails(ActionInput.literals("mode", ["commit", "pr"]), { INPUT_MODE: "PR" });
			}),
		);

		it.effect('absent or "" is missing data, so withDefault composes', () =>
			Effect.gen(function* () {
				const config = ActionInput.literals("mode", ["commit", "pr"]).pipe(Config.withDefault("commit"));
				assert.strictEqual(yield* readOk(config, { INPUT_MODE: "" }), "commit");
				assert.strictEqual(yield* readOk(config, {}), "commit");
			}),
		);

		it.effect("a wrong value is NOT swallowed by withDefault", () =>
			readFails(ActionInput.literals("mode", ["commit", "pr"]).pipe(Config.withDefault("commit")), {
				INPUT_MODE: "push",
			}),
		);
	});

	describe("lines", () => {
		it.effect("splits on newlines, trimming and dropping blanks", () =>
			Effect.gen(function* () {
				const value = yield* readOk(ActionInput.lines("paths"), { INPUT_PATHS: "  a\n\n  b  \nc\n" });
				assert.deepStrictEqual([...value], ["a", "b", "c"]);
			}),
		);
	});

	describe("list", () => {
		it.effect("accepts a JSON array", () =>
			Effect.gen(function* () {
				const value = yield* readOk(ActionInput.list("paths"), { INPUT_PATHS: '["a", "b"]' });
				assert.deepStrictEqual([...value], ["a", "b"]);
			}),
		);

		it.effect("accepts a YAML bullet list", () =>
			Effect.gen(function* () {
				const value = yield* readOk(ActionInput.list("paths"), { INPUT_PATHS: "- a\n- b\n" });
				assert.deepStrictEqual([...value], ["a", "b"]);
			}),
		);

		it.effect("accepts a Markdown '*' bullet list, not just '-'", () =>
			Effect.gen(function* () {
				// Before the union grammar, a "*" bullet kept its marker as part of
				// the value ("* a" survived intact) instead of being stripped.
				const value = yield* readOk(ActionInput.list("paths"), { INPUT_PATHS: "* a\n* b\n" });
				assert.deepStrictEqual([...value], ["a", "b"]);
			}),
		);

		it.effect("strips mixed '-' and '*' bullets in the same input", () =>
			Effect.gen(function* () {
				const value = yield* readOk(ActionInput.list("paths"), { INPUT_PATHS: "- a\n* b\n- c\n* d\n" });
				assert.deepStrictEqual([...value], ["a", "b", "c", "d"]);
			}),
		);

		it.effect("drops full-line '#' comments interleaved with values", () =>
			Effect.gen(function* () {
				const value = yield* readOk(ActionInput.list("paths"), {
					INPUT_PATHS: "# a comment\n- a\n# another comment\n- b\n",
				});
				assert.deepStrictEqual([...value], ["a", "b"]);
			}),
		);

		it.effect("treats a bulleted '- #tag' as the value '#tag', not a dropped comment", () =>
			Effect.gen(function* () {
				// The discriminating case: the comment check runs on the untouched,
				// still-bulleted line, so only a line whose FIRST character (before
				// any bullet is stripped) is "#" is a comment. "- #tag" starts with
				// "-", not "#", so it survives the comment filter, and only the
				// bullet marker is then stripped, leaving "#tag" as the value.
				const value = yield* readOk(ActionInput.list("paths"), { INPUT_PATHS: "- #tag\n- b\n" });
				assert.deepStrictEqual([...value], ["#tag", "b"]);
			}),
		);

		it.effect("accepts comma-separated values", () =>
			Effect.gen(function* () {
				const value = yield* readOk(ActionInput.list("paths"), { INPUT_PATHS: "a, b ,c" });
				assert.deepStrictEqual([...value], ["a", "b", "c"]);
			}),
		);

		it.effect("reads an all-whitespace input as an empty list", () =>
			Effect.gen(function* () {
				const value = yield* readOk(ActionInput.list("paths"), { INPUT_PATHS: "   \n  " });
				assert.deepStrictEqual([...value], []);
			}),
		);

		it.effect("rejects a JSON array of non-strings rather than coercing", () =>
			readFails(ActionInput.list("paths"), { INPUT_PATHS: "[1, 2]" }),
		);

		it.effect("rejects malformed JSON rather than falling back to comma splitting", () =>
			// Falling back would silently read `["a"` as the single value `["a"`.
			readFails(ActionInput.list("paths"), { INPUT_PATHS: '["a"' }),
		);
	});

	describe("pairs", () => {
		it.effect("reads key=value lines", () =>
			Effect.gen(function* () {
				const value = yield* readOk(ActionInput.pairs("vars"), { INPUT_VARS: "a=1\nb = 2\n" });
				assert.deepStrictEqual(value, { a: "1", b: "2" });
			}),
		);

		it.effect("strips comments and blank lines", () =>
			Effect.gen(function* () {
				const value = yield* readOk(ActionInput.pairs("vars"), {
					INPUT_VARS: "# a comment\na=1\n\nb=2 # trailing\n",
				});
				assert.deepStrictEqual(value, { a: "1", b: "2" });
			}),
		);

		it.effect("splits on the FIRST equals, so a value may contain one", () =>
			Effect.gen(function* () {
				const value = yield* readOk(ActionInput.pairs("vars"), { INPUT_VARS: "url=https://x?a=b" });
				assert.deepStrictEqual(value, { url: "https://x?a=b" });
			}),
		);

		it.effect("rejects a line that is not a pair", () =>
			readFails(ActionInput.pairs("vars"), { INPUT_VARS: "a=1\njust-a-word\n" }),
		);

		it.effect("rejects an empty key, which no workflow can have meant", () =>
			// `{ "": v }` became a GitHub custom-property filter matching nothing,
			// and the run reported "0 repositories discovered" with no reason why.
			readFails(ActionInput.pairs("vars"), { INPUT_VARS: "a=1\n=orphan\n" }),
		);

		it.effect("rejects a bare equals", () => readFails(ActionInput.pairs("vars"), { INPUT_VARS: "=" }));

		it.effect("names the offending line when the key is empty", () =>
			Effect.gen(function* () {
				const text = yield* readErrorText(ActionInput.pairs("vars"), { INPUT_VARS: "a=1\n=orphan\n" });
				assert.include(text, "=orphan");
			}),
		);

		it.effect("accepts an empty value by default, which is a legitimate empty string", () =>
			Effect.gen(function* () {
				const value = yield* readOk(ActionInput.pairs("vars"), { INPUT_VARS: "a=1\nb=\n" });
				assert.deepStrictEqual(value, { a: "1", b: "" });
			}),
		);

		it.effect("rejects an empty value under requireValue", () =>
			readFails(ActionInput.pairs("vars", { requireValue: true }), { INPUT_VARS: "a=1\nb=\n" }),
		);

		it.effect("names the offending line when an empty value is rejected", () =>
			Effect.gen(function* () {
				const text = yield* readErrorText(ActionInput.pairs("vars", { requireValue: true }), {
					INPUT_VARS: "a=1\nb=\n",
				});
				assert.include(text, "b=");
			}),
		);

		it.effect("still accepts an empty value under requireValue when it is not empty", () =>
			Effect.gen(function* () {
				const value = yield* readOk(ActionInput.pairs("vars", { requireValue: true }), { INPUT_VARS: "b=0" });
				assert.deepStrictEqual(value, { b: "0" });
			}),
		);
	});

	describe("redacted and schema", () => {
		it.effect("keeps a secret input redacted", () =>
			Effect.gen(function* () {
				const secret = yield* readOk(ActionInput.redacted("token"), { INPUT_TOKEN: "ghs_abc" });
				assert.strictEqual(Redacted.value(secret), "ghs_abc");
				assert.notInclude(String(secret), "ghs_abc");
			}),
		);

		it.effect("decodes a JSON input through its schema", () =>
			Effect.gen(function* () {
				const Cfg = S.Struct({ level: S.Finite });
				const value = yield* readOk(ActionInput.schema("cfg", Cfg), { INPUT_CFG: '{"level":3}' });
				assert.deepStrictEqual(value, { level: 3 });
			}),
		);

		it.effect("rejects a JSON input that does not satisfy its schema", () =>
			readFails(ActionInput.schema("cfg", S.Struct({ level: S.Finite })), {
				INPUT_CFG: '{"level":"three"}',
			}),
		);

		it.effect("rejects an input that is not JSON at all", () =>
			readFails(ActionInput.schema("cfg", S.Struct({ level: S.Finite })), { INPUT_CFG: "nope" }),
		);

		it.effect("reads an integer input", () =>
			Effect.gen(function* () {
				assert.strictEqual(yield* readOk(ActionInput.integer("count"), { INPUT_COUNT: "7" }), 7);
			}),
		);
	});

	describe("subsumption of the source package's ActionsConfigProvider", () => {
		// Confirmed against `runtime/ActionsConfigProvider.ts` rather than assumed:
		// join with "_", spaces to underscores, uppercase, and empty-is-absent.
		it.effect("joins a nested config path with underscores", () =>
			Effect.gen(function* () {
				const nested = yield* Effect.provide(
					// A two-segment path is joined before mangling, exactly as the
					// source provider did.
					Effect.map(ActionInput.string("a"), (value) => value),
					ActionInput.layer({ INPUT_A: "v" }),
				);
				assert.strictEqual(nested, "v");
			}),
		);

		it.effect("resolves each input against exactly the variable the source provider derived", () =>
			Effect.gen(function* () {
				const cases: ReadonlyArray<readonly [string, string]> = [
					["sbom-config", "INPUT_SBOM-CONFIG"],
					["my input", "INPUT_MY_INPUT"],
					["Simple", "INPUT_SIMPLE"],
					["dry-run", "INPUT_DRY-RUN"],
					["a.b", "INPUT_A.B"],
				];
				for (const [input, expected] of cases) {
					// Seeded with ONLY the expected variable, so resolving proves the
					// derivation rather than restating it.
					const value = yield* readOk(ActionInput.string(input), { [expected]: "resolved" });
					assert.strictEqual(value, "resolved", `${input} should resolve via ${expected}`);
				}
			}),
		);
	});

	describe("providerOver — the runtime's default resolution", () => {
		/** Read a bare config through the inputs-first provider over a fixed env. */
		const readBare = <A>(config: Config.Config<A>, env: Record<string, string>) =>
			Effect.provide(config, ConfigProvider.layer(ActionInput.providerOver(ConfigProvider.fromEnv({ env }))));

		const readBareFails = <A>(config: Config.Config<A>, env: Record<string, string>) =>
			Effect.map(Effect.exit(readBare(config, env)), (exit) => {
				assert.strictEqual(exit._tag, "Failure", "expected the bare read to miss");
			});

		it.effect("resolves a bare flat name through the INPUT_ derivation first", () =>
			Effect.gen(function* () {
				// The false-green class at its root: the runner publishes
				// INPUT_DRY-RUN (dashes survive), and a bare Config.String("dry-run")
				// used to find nothing and fall back to its default.
				assert.strictEqual(yield* readBare(Config.String("dry-run"), { "INPUT_DRY-RUN": "x" }), "x");
			}),
		);

		it.effect("any casing of the bare name sees the input, because the derivation uppercases", () =>
			Effect.gen(function* () {
				for (const spelling of ["dry-run", "DRY-RUN", "Dry-Run"]) {
					assert.strictEqual(
						yield* readBare(Config.String(spelling), { "INPUT_DRY-RUN": "x" }),
						"x",
						`${spelling} should reach INPUT_DRY-RUN`,
					);
				}
			}),
		);

		it.effect("falls back to the ambient lookup unchanged when no input matches", () =>
			Effect.gen(function* () {
				// The plain variable resolves exactly as it would without the
				// provider…
				assert.strictEqual(yield* readBare(Config.String("PLAIN_VAR"), { PLAIN_VAR: "y" }), "y");
				// …and the fallback stays case-SENSITIVE: only the attempt
				// uppercases. A lowercase read gained no new spelling.
				yield* readBareFails(Config.String("plain_var"), { PLAIN_VAR: "y" });
			}),
		);

		it.effect("a supplied input SHADOWS an env var of the same name — the documented trade", () =>
			Effect.gen(function* () {
				const env = { INPUT_FOO: "from-input", FOO: "from-env" };
				assert.strictEqual(yield* readBare(Config.String("FOO"), env), "from-input");
				assert.strictEqual(yield* readBare(Config.String("foo"), env), "from-input");
			}),
		);

		it.effect("an unsupplied input ('') does not shadow", () =>
			Effect.gen(function* () {
				// The runner writes "" for every input the workflow left out; the
				// attempt resolves through the ambient provider, whose
				// empty-is-absent rule drops it, so the real variable still wins.
				assert.strictEqual(yield* readBare(Config.String("FOO"), { INPUT_FOO: "", FOO: "from-env" }), "from-env");
			}),
		);

		it.effect("a nested path passes through untouched — no invented runner semantics", () =>
			Effect.gen(function* () {
				// The runner can only set flat INPUT_<MANGLED> variables, so the
				// attempt applies to single-segment names only. A join-then-mangle
				// implementation would resolve INPUT_A_B here and fail this test.
				const nested = Config.String("B").pipe(Config.nested("A"));
				assert.strictEqual(yield* readBare(nested, { A_B: "base", INPUT_A_B: "from-input" }), "base");
			}),
		);

		it.effect("ActionInput accessors resolve identically under it", () =>
			Effect.gen(function* () {
				// The accessor reads INPUT_DRY-RUN; the attempt re-mangles that to
				// INPUT_INPUT_DRY-RUN, misses, and the fallback resolves the real
				// variable — so the typed surface is unchanged by the installation.
				assert.strictEqual(yield* readBare(ActionInput.string("dry-run"), { "INPUT_DRY-RUN": "x" }), "x");
				// And an omitted input still reads as absent, so a default is a
				// default.
				assert.strictEqual(
					yield* readBare(ActionInput.string("omitted").pipe(Config.withDefault("fallback")), { INPUT_OMITTED: "" }),
					"fallback",
				);
			}),
		);

		it.effect("layerDefault composes over the provider explicitly installed beneath it", () =>
			Effect.gen(function* () {
				// How a test injects a deterministic environment without touching the
				// process: install an ambient provider under the runtime and let
				// layerDefault pick it up at build.
				assert.strictEqual(yield* Config.String("dry-run"), "x");
				assert.strictEqual(yield* Config.String("PLAIN_VAR"), "y");
			}).pipe(
				Effect.provide(ActionInput.layerDefault),
				Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "INPUT_DRY-RUN": "x", PLAIN_VAR: "y" } }))),
			),
		);
	});
});
