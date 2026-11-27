import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { ActionInput } from "@beep/github-actions";
import { PairsOptions } from "@beep/github-actions/ActionInput";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";

const read = <A>(config: Config.Config<A>, env: Record<string, string>) =>
  Effect.flatMap(Layer.build(ActionInput.layer(env)), (context) => Effect.provideContext(config, context));

const readOk = <A>(config: Config.Config<A>, env: Record<string, string>) => read(config, env);

const readFails = <A>(config: Config.Config<A>, env: Record<string, string>) =>
  Effect.map(Effect.exit(read(config, env)), (exit) => {
    Exit.match(exit, {
      onFailure: (cause) => assertExitFailure(exit, cause),
      onSuccess: () => assert.fail("expected the config read to fail"),
    });
  });

const readErrorText = <A>(config: Config.Config<A>, env: Record<string, string>) =>
  Effect.map(Effect.flip(read(config, env)), (error) => String(error));

describe("ActionInput", () => {
  describe("PairsOptions contract", () => {
    it.effect("preserves plain objects, exact optional keys and boolean values", () =>
      Effect.gen(function* () {
        const omitted: PairsOptions.Encoded = {};
        const value1 = yield* S.decodeEffect(PairsOptions)(omitted);
        assert.deepStrictEqual(value1, PairsOptions.make({}));
        const value2 = yield* S.encodeEffect(PairsOptions)(PairsOptions.make(omitted));
        assert.deepStrictEqual(value2, {});
        for (const requireValue of [false, true]) {
          const options: PairsOptions.Encoded = { requireValue };
          const value3 = yield* S.decodeEffect(PairsOptions)(options);
          assert.deepStrictEqual(value3, options);
        }
        assert.isFalse(S.is(PairsOptions)({ requireValue: undefined }));
        assert.isFalse(S.is(PairsOptions)({ requireValue: "true" }));
        assert.isFalse(S.is(PairsOptions)({ requireValue: null }));
      })
    );
  });

  describe("the INPUT_ name mangling", () => {
    it.effect("PRESERVES dashes — the bug that shipped", () =>
      Effect.gen(function* () {
        const readOk4 = yield* readOk(ActionInput.string("sbom-config"), { "INPUT_SBOM-CONFIG": "x" });
        assert.strictEqual(
          readOk4,
          "x",
          'A consumer read process.env["INPUT_SBOM_CONFIG"] directly and silently got nothing, because the runner publishes INPUT_SBOM-CONFIG. No caller spells the name here, so the class of bug is unrepresentable.'
        );
      })
    );

    it.effect("does not find the underscored spelling", () =>
      readFails(ActionInput.string("sbom-config"), { INPUT_SBOM_CONFIG: "x" })
    );

    it.effect("replaces spaces with underscores and uppercases", () =>
      Effect.gen(function* () {
        const readOk5 = yield* readOk(ActionInput.string("my input"), { INPUT_MY_INPUT: "v" });
        assert.strictEqual(readOk5, "v");
      })
    );

    it.effect("treats an empty value as absent, as the runner sets unsupplied inputs to ''", () =>
      readFails(ActionInput.string("missing"), { INPUT_MISSING: "" })
    );

    it.effect("treats an inherited-only runner input as absent", () =>
      Effect.gen(function* () {
        const env: Record<string, string> = {};
        Object.setPrototypeOf(env, { INPUT_TOKEN: "prototype-token" });
        yield* readFails(ActionInput.string("token"), env);
        yield* readFails(Config.String("token"), env);
      })
    );

    it.effect("an inherited runner name cannot shadow an own input-name entry", () =>
      Effect.gen(function* () {
        const env = { token: "own-token" };
        Object.setPrototypeOf(env, { INPUT_TOKEN: "prototype-token" });
        const readOk6 = yield* readOk(ActionInput.string("token"), env);
        assert.strictEqual(readOk6, "own-token");
        const readOk7 = yield* readOk(Config.String("token"), env);
        assert.strictEqual(readOk7, "own-token");
      })
    );
  });

  describe("variable — the mangling, exported", () => {
    it("derives the exact runner variable, dashes preserved", () => {
      assert.strictEqual(
        ActionInput.variable("biome-version"),
        "INPUT_BIOME-VERSION",
        "The hand-written spelling this replaces was INPUT_BIOME_VERSION — absent on a real runner, so the default silently applied and the suite went green against the wrong value."
      );
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
        const readOk8 = yield* readOk(ActionInput.string("biome-version"), { "biome-version": "2.3.14" });
        assert.strictEqual(
          readOk8,
          "2.3.14",
          "No caller spells INPUT_BIOME-VERSION: the key is the input name exactly as the workflow's with: block writes it, and the mangling never leaves the module."
        );
      })
    );

    it.effect("an input-name key makes a bare Config read resolve, as the production runtime would", () =>
      Effect.gen(function* () {
        const readOk9 = yield* readOk(Config.String("biome-version"), { "biome-version": "2.3.14" });
        assert.strictEqual(
          readOk9,
          "2.3.14",
          'The test layer resolves a bare Config.String("biome-version") through the same INPUT_ derivation installed by Action.run.'
        );
      })
    );

    it.effect("the old hazard stays absent — and the new path cannot reproduce it", () =>
      Effect.gen(function* () {
        yield* readFails(ActionInput.string("biome-version"), { INPUT_BIOME_VERSION: "x" });
        const readOk10 = yield* readOk(ActionInput.string("biome-version"), { "biome-version": "x" });
        assert.strictEqual(
          readOk10,
          "x",
          "The hand-written underscore spelling reads as absent, exactly as it does on a real runner (which publishes INPUT_BIOME-VERSION)… …and the same test written input-name-first resolves, because the caller never had a variable name to misspell."
        );
      })
    );

    it.effect("mangles spaces and case in an input-name key", () =>
      Effect.gen(function* () {
        const readOk11 = yield* readOk(ActionInput.string("My Input"), { "my input": "v" });
        assert.strictEqual(readOk11, "v");
      })
    );

    it.effect("an explicit INPUT_-spelled entry wins over the input-name spelling", () =>
      Effect.gen(function* () {
        const readOk12 = yield* readOk(ActionInput.string("flag"), { INPUT_FLAG: "explicit", flag: "named" });
        assert.strictEqual(readOk12, "explicit");
      })
    );

    it.effect("an empty input-name value reads as absent, like the runner's own ''", () =>
      readFails(ActionInput.string("flag"), { flag: "" })
    );

    it.effect("a plain runner variable still resolves verbatim beside input-name keys", () =>
      Effect.gen(function* () {
        const readOk13 = yield* readOk(Config.String("PLAIN_VAR"), { PLAIN_VAR: "y", "biome-version": "2.3.14" });
        assert.strictEqual(readOk13, "y");
      })
    );
  });

  describe("boolean", () => {
    it.effect("accepts every documented true and false spelling", () =>
      Effect.gen(function* () {
        for (const raw of ["true", "True", "TRUE"]) {
          const readOk14 = yield* readOk(ActionInput.boolean("flag"), { INPUT_FLAG: raw });
          assert.isTrue(readOk14, raw);
        }
        for (const raw of ["false", "False", "FALSE"]) {
          const readOk15 = yield* readOk(ActionInput.boolean("flag"), { INPUT_FLAG: raw });
          assert.isFalse(readOk15, raw);
        }
      })
    );

    it.effect("tolerates surrounding whitespace from a YAML block", () =>
      Effect.gen(function* () {
        const readOk16 = yield* readOk(ActionInput.boolean("flag"), { INPUT_FLAG: "  true\n" });
        assert.isTrue(readOk16);
      })
    );

    it.effect("rejects a value outside the core schema rather than guessing", () =>
      readFails(ActionInput.boolean("flag"), { INPUT_FLAG: "yes" })
    );
  });

  describe("literals", () => {
    it.effect("accepts a member of the allowed set and narrows to it", () =>
      Effect.gen(function* () {
        const mode = yield* readOk(ActionInput.literals("mode", ["commit", "pr"]), { INPUT_MODE: "pr" });
        const narrowed: Config.Config<"commit" | "pr"> = ActionInput.literals("mode", ["commit", "pr"]);
        const value: "commit" | "pr" = mode;
        assert.strictEqual(value, "pr");
        assert.isDefined(narrowed);
      })
    );

    it.effect("rejects a value outside the set, naming the input, the value and the set", () =>
      Effect.gen(function* () {
        const text = yield* readErrorText(ActionInput.literals("mode", ["commit", "pr"]), { INPUT_MODE: "push" });
        assert.include(text, 'Input "mode" must be one of: commit | pr');
        assert.include(text, "push");
      })
    );

    it.effect("the match is exact — no trim, no case folding", () =>
      Effect.gen(function* () {
        yield* readFails(ActionInput.literals("mode", ["commit", "pr"]), { INPUT_MODE: " pr" });
        yield* readFails(ActionInput.literals("mode", ["commit", "pr"]), { INPUT_MODE: "PR" });
      })
    );

    it.effect('absent or "" is missing data, so withDefault composes', () =>
      Effect.gen(function* () {
        const config = ActionInput.literals("mode", ["commit", "pr"]).pipe(Config.withDefault("commit"));
        const readOk17 = yield* readOk(config, { INPUT_MODE: "" });
        assert.strictEqual(readOk17, "commit");
        const readOk18 = yield* readOk(config, {});
        assert.strictEqual(readOk18, "commit");
      })
    );

    it.effect("a wrong value is NOT swallowed by withDefault", () =>
      readFails(ActionInput.literals("mode", ["commit", "pr"]).pipe(Config.withDefault("commit")), {
        INPUT_MODE: "push",
      })
    );
  });

  describe("lines", () => {
    it.effect("splits on newlines, trimming and dropping blanks", () =>
      Effect.gen(function* () {
        const value = yield* readOk(ActionInput.lines("paths"), { INPUT_PATHS: "  a\n\n  b  \nc\n" });
        assert.deepStrictEqual([...value], ["a", "b", "c"]);
      })
    );
  });

  describe("list", () => {
    it.effect("accepts a JSON array", () =>
      Effect.gen(function* () {
        const value = yield* readOk(ActionInput.list("paths"), { INPUT_PATHS: '["a", "b"]' });
        assert.deepStrictEqual([...value], ["a", "b"]);
      })
    );

    it.effect("accepts a YAML bullet list", () =>
      Effect.gen(function* () {
        const value = yield* readOk(ActionInput.list("paths"), { INPUT_PATHS: "- a\n- b\n" });
        assert.deepStrictEqual([...value], ["a", "b"]);
      })
    );

    it.effect("accepts a Markdown '*' bullet list, not just '-'", () =>
      Effect.gen(function* () {
        const value = yield* readOk(ActionInput.list("paths"), { INPUT_PATHS: "* a\n* b\n" });
        assert.deepStrictEqual(
          [...value],
          ["a", "b"],
          'Before the union grammar, a "*" bullet kept its marker as part of the value ("* a" survived intact) instead of being stripped.'
        );
      })
    );

    it.effect("strips mixed '-' and '*' bullets in the same input", () =>
      Effect.gen(function* () {
        const value = yield* readOk(ActionInput.list("paths"), { INPUT_PATHS: "- a\n* b\n- c\n* d\n" });
        assert.deepStrictEqual([...value], ["a", "b", "c", "d"]);
      })
    );

    it.effect("drops full-line '#' comments interleaved with values", () =>
      Effect.gen(function* () {
        const value = yield* readOk(ActionInput.list("paths"), {
          INPUT_PATHS: "# a comment\n- a\n# another comment\n- b\n",
        });
        assert.deepStrictEqual([...value], ["a", "b"]);
      })
    );

    it.effect("treats a bulleted '- #tag' as the value '#tag', not a dropped comment", () =>
      Effect.gen(function* () {
        const value = yield* readOk(ActionInput.list("paths"), { INPUT_PATHS: "- #tag\n- b\n" });
        assert.deepStrictEqual(
          [...value],
          ["#tag", "b"],
          'The discriminating case: the comment check runs on the untouched, still-bulleted line, so only a line whose FIRST character (before any bullet is stripped) is "#" is a comment. "- #tag" starts with "-", not "#", so it survives the comment filter, and only the bullet marker is then stripped, leaving "#tag" as the value.'
        );
      })
    );

    it.effect("accepts comma-separated values", () =>
      Effect.gen(function* () {
        const value = yield* readOk(ActionInput.list("paths"), { INPUT_PATHS: "a, b ,c" });
        assert.deepStrictEqual([...value], ["a", "b", "c"]);
      })
    );

    it.effect("reads an all-whitespace input as an empty list", () =>
      Effect.gen(function* () {
        const value = yield* readOk(ActionInput.list("paths"), { INPUT_PATHS: "   \n  " });
        assert.deepStrictEqual([...value], []);
      })
    );

    it.effect("rejects a JSON array of non-strings rather than coercing", () =>
      readFails(ActionInput.list("paths"), { INPUT_PATHS: "[1, 2]" })
    );

    it.effect("rejects malformed JSON rather than falling back to comma splitting", () =>
      readFails(ActionInput.list("paths"), { INPUT_PATHS: '["a"' })
    );
  });

  describe("pairs", () => {
    it.effect("reads key=value lines", () =>
      Effect.gen(function* () {
        const value = yield* readOk(ActionInput.pairs("vars"), { INPUT_VARS: "a=1\nb = 2\n" });
        assert.deepStrictEqual(value, { a: "1", b: "2" });
      })
    );

    it.effect("preserves an accepted __proto__ pair as an own property of the plain record", () =>
      Effect.gen(function* () {
        const value = yield* readOk(ActionInput.pairs("vars"), {
          INPUT_VARS: "__proto__=first\nnormal=ok\n__proto__=value",
        });
        assert.isTrue(R.has(value, "__proto__"));
        assert.deepStrictEqual(R.get(value, "__proto__"), O.some("value"));
        assert.deepStrictEqual(value, { ["__proto__"]: "value", normal: "ok" });
      })
    );

    it.effect("strips comments and blank lines", () =>
      Effect.gen(function* () {
        const value = yield* readOk(ActionInput.pairs("vars"), {
          INPUT_VARS: "# a comment\na=1\n\nb=2 # trailing\n",
        });
        assert.deepStrictEqual(value, { a: "1", b: "2" });
      })
    );

    it.effect("splits on the FIRST equals, so a value may contain one", () =>
      Effect.gen(function* () {
        const value = yield* readOk(ActionInput.pairs("vars"), { INPUT_VARS: "url=https://x?a=b" });
        assert.deepStrictEqual(value, { url: "https://x?a=b" });
      })
    );

    it.effect("rejects a line that is not a pair", () =>
      readFails(ActionInput.pairs("vars"), { INPUT_VARS: "a=1\njust-a-word\n" })
    );

    it.effect("rejects an empty key, which no workflow can have meant", () =>
      readFails(ActionInput.pairs("vars"), { INPUT_VARS: "a=1\n=orphan\n" })
    );

    it.effect("rejects a bare equals", () => readFails(ActionInput.pairs("vars"), { INPUT_VARS: "=" }));

    it.effect("names the offending line when the key is empty", () =>
      Effect.gen(function* () {
        const text = yield* readErrorText(ActionInput.pairs("vars"), { INPUT_VARS: "a=1\n=orphan\n" });
        assert.include(
          text,
          "=orphan",
          '{ "": v } became a GitHub custom-property filter matching nothing, and the run reported "0 repositories discovered" with no reason why.'
        );
      })
    );

    it.effect("accepts an empty value by default, which is a legitimate empty string", () =>
      Effect.gen(function* () {
        const value = yield* readOk(ActionInput.pairs("vars"), { INPUT_VARS: "a=1\nb=\n" });
        assert.deepStrictEqual(value, { a: "1", b: "" });
      })
    );

    it.effect("rejects an empty value under requireValue", () =>
      readFails(ActionInput.pairs("vars", { requireValue: true }), { INPUT_VARS: "a=1\nb=\n" })
    );

    it.effect("names the offending line when an empty value is rejected", () =>
      Effect.gen(function* () {
        const text = yield* readErrorText(ActionInput.pairs("vars", { requireValue: true }), {
          INPUT_VARS: "a=1\nb=\n",
        });
        assert.include(text, "b=");
      })
    );

    it.effect("still accepts an empty value under requireValue when it is not empty", () =>
      Effect.gen(function* () {
        const value = yield* readOk(ActionInput.pairs("vars", { requireValue: true }), { INPUT_VARS: "b=0" });
        assert.deepStrictEqual(value, { b: "0" });
      })
    );
  });

  describe("redacted and schema", () => {
    it.effect("keeps a secret input redacted", () =>
      Effect.gen(function* () {
        const secret = yield* readOk(ActionInput.redacted("token"), { INPUT_TOKEN: "ghs_abc" });
        assert.strictEqual(Redacted.value(secret), "ghs_abc");
        assert.notInclude(String(secret), "ghs_abc");
      })
    );

    it.effect("decodes a JSON input through its schema", () =>
      Effect.gen(function* () {
        const Cfg = S.Struct({ level: S.Finite });
        const value = yield* readOk(ActionInput.schema("cfg", Cfg), { INPUT_CFG: '{"level":3}' });
        assert.deepStrictEqual(value, { level: 3 });
      })
    );

    it.effect("rejects a JSON input that does not satisfy its schema", () =>
      readFails(ActionInput.schema("cfg", S.Struct({ level: S.Finite })), {
        INPUT_CFG: '{"level":"three"}',
      })
    );

    it.effect("rejects an input that is not JSON at all", () =>
      readFails(ActionInput.schema("cfg", S.Struct({ level: S.Finite })), { INPUT_CFG: "nope" })
    );

    it.effect("reads an integer input", () =>
      Effect.gen(function* () {
        const readOk19 = yield* readOk(ActionInput.integer("count"), { INPUT_COUNT: "7" });
        assert.strictEqual(readOk19, 7);
      })
    );
  });

  describe("subsumption of the source package's ActionsConfigProvider", () => {
    it.effect("joins a nested config path with underscores", () =>
      Effect.gen(function* () {
        const nested = yield* Effect.provideService(
          Effect.map(ActionInput.string("a"), (value) => value),
          ConfigProvider.ConfigProvider,
          ActionInput.provider({ INPUT_A: "v" })
        );
        assert.strictEqual(
          nested,
          "v",
          'Confirmed against runtime/ActionsConfigProvider.ts rather than assumed: join with "_", spaces to underscores, uppercase, and empty-is-absent.'
        );
      })
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
          const value = yield* readOk(ActionInput.string(input), { [expected]: "resolved" });
          assert.strictEqual(
            value,
            "resolved",
            `${input} should resolve via ${expected} Seeded with ONLY the expected variable, so resolving proves the derivation rather than restating it.`
          );
        }
      })
    );
  });

  describe("providerOver — the runtime's default resolution", () => {
    const readBare = <A>(config: Config.Config<A>, env: Record<string, string>) =>
      Effect.provideService(
        config,
        ConfigProvider.ConfigProvider,
        ActionInput.providerOver(ConfigProvider.fromEnv({ env }))
      );

    const readBareFails = <A>(config: Config.Config<A>, env: Record<string, string>) =>
      Effect.map(Effect.exit(readBare(config, env)), (exit) => {
        Exit.match(exit, {
          onFailure: (cause) => assertExitFailure(exit, cause),
          onSuccess: () => assert.fail("expected the config read to fail"),
        });
      });

    it.effect("resolves a bare flat name through the INPUT_ derivation first", () =>
      Effect.gen(function* () {
        const readBare20 = yield* readBare(Config.String("dry-run"), { "INPUT_DRY-RUN": "x" });
        assert.strictEqual(
          readBare20,
          "x",
          'The false-green class at its root: the runner publishes INPUT_DRY-RUN (dashes survive), and a bare Config.String("dry-run") used to find nothing and fall back to its default.'
        );
      })
    );

    it.effect("any casing of the bare name sees the input, because the derivation uppercases", () =>
      Effect.gen(function* () {
        for (const spelling of ["dry-run", "DRY-RUN", "Dry-Run"]) {
          const readBare21 = yield* readBare(Config.String(spelling), { "INPUT_DRY-RUN": "x" });
          assert.strictEqual(readBare21, "x", `${spelling} should reach INPUT_DRY-RUN`);
        }
      })
    );

    it.effect("falls back to the unchanged, case-sensitive ambient lookup when no input matches", () =>
      Effect.gen(function* () {
        const readBare22 = yield* readBare(Config.String("PLAIN_VAR"), { PLAIN_VAR: "y" });
        assert.strictEqual(readBare22, "y", "The plain variable resolves exactly as it would without the provider.");
        yield* readBareFails(Config.String("plain_var"), { PLAIN_VAR: "y" });
      })
    );

    it.effect("a supplied input SHADOWS an env var of the same name — the documented trade", () =>
      Effect.gen(function* () {
        const env = { INPUT_FOO: "from-input", FOO: "from-env" };
        const readBare23 = yield* readBare(Config.String("FOO"), env);
        assert.strictEqual(readBare23, "from-input");
        const readBare24 = yield* readBare(Config.String("foo"), env);
        assert.strictEqual(readBare24, "from-input");
      })
    );

    it.effect("an unsupplied input ('') does not shadow", () =>
      Effect.gen(function* () {
        const readBare25 = yield* readBare(Config.String("FOO"), { INPUT_FOO: "", FOO: "from-env" });
        assert.strictEqual(
          readBare25,
          "from-env",
          'The runner writes "" for every input the workflow left out; the attempt resolves through the ambient provider, whose empty-is-absent rule drops it, so the real variable still wins.'
        );
      })
    );

    it.effect("a nested path passes through untouched — no invented runner semantics", () =>
      Effect.gen(function* () {
        const nested = Config.String("B").pipe(Config.nested("A"));
        const readBare26 = yield* readBare(nested, { A_B: "base", INPUT_A_B: "from-input" });
        assert.strictEqual(
          readBare26,
          "base",
          "The runner can only set flat INPUT_<MANGLED> variables, so the attempt applies to single-segment names only. A join-then-mangle implementation would resolve INPUT_A_B here and fail this test."
        );
      })
    );

    it.effect("ActionInput accessors resolve identically under it", () =>
      Effect.gen(function* () {
        const readBare27 = yield* readBare(ActionInput.string("dry-run"), { "INPUT_DRY-RUN": "x" });
        assert.strictEqual(
          readBare27,
          "x",
          "The accessor reads INPUT_DRY-RUN; the attempt re-mangles that to INPUT_INPUT_DRY-RUN, misses, and the fallback resolves the real variable — so the typed surface is unchanged by the installation."
        );
        const readBare28 = yield* readBare(ActionInput.string("omitted").pipe(Config.withDefault("fallback")), {
          INPUT_OMITTED: "",
        });
        assert.strictEqual(
          readBare28,
          "fallback",
          "And an omitted input still reads as absent, so a default is a default."
        );
      })
    );

    it.layer(
      ActionInput.layerDefault.pipe(
        Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "INPUT_DRY-RUN": "x", PLAIN_VAR: "y" } })))
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("layerDefault composes over the provider explicitly installed beneath it", () =>
        Effect.gen(function* () {
          const String29 = yield* Config.String("dry-run");
          assert.strictEqual(
            String29,
            "x",
            "How a test injects a deterministic environment without touching the process: install an ambient provider under the runtime and let layerDefault pick it up at build."
          );
          const String30 = yield* Config.String("PLAIN_VAR");
          assert.strictEqual(String30, "y");
        })
      );
    });
  });
});

describe("PairsOptions codec property", () => {
  it.effect.prop(
    "PairsOptions round-trips through its codec",
    [Arbitrary.schema(PairsOptions)],
    ([value]) =>
      Effect.gen(function* () {
        const argument = S.decodeEffect(PairsOptions);
        const value4 = yield* S.encodeEffect(PairsOptions)(value);
        const value31 = yield* argument(value4);
        assert.deepStrictEqual(value31, value);
      }),
    { arbitrary: fcRuns(100) }
  );
});
