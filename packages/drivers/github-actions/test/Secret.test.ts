import { ActionOutputs, Secret } from "@beep/github-actions";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Str from "effect/String";
import { sourceModules, sourceOf } from "./support/sourceGraph.ts";

const recordingOutputs = () => {
  const masked: Array<string> = [];
  const service = ActionOutputs.makeTest({
    setSecret: (value) =>
      Effect.suspend(() => {
        masked.push(value);
        return Effect.void;
      }),
  });
  return { masked, service };
};

const withConfig = <A, E, R>(values: Record<string, string>, effect: Effect.Effect<A, E, R>) =>
  Effect.provideService(
    effect,
    ConfigProvider.ConfigProvider,
    ConfigProvider.make((path) => {
      const value = values[A.join(A.map(path, String), "_")];
      return Effect.succeed(value === undefined ? undefined : ConfigProvider.makeValue(value));
    })
  );

describe("Secret", () => {
  describe("forChildEnv", () => {
    it.effect("returns plaintext for a child process", () => {
      const outputs = recordingOutputs();
      return Effect.gen(function* () {
        const env = yield* Secret.forChildEnv({ TOKEN: Redacted.make("s3cr3t") });
        assert.deepStrictEqual(env, { TOKEN: "s3cr3t" });
      }).pipe(Effect.provideService(ActionOutputs, outputs.service));
    });

    it.effect("masks every value it declassifies", () => {
      const outputs = recordingOutputs();
      return Effect.gen(function* () {
        const env = yield* Secret.forChildEnv({ A: Redacted.make("aaa"), B: Redacted.make("bbb") });
        assert.deepStrictEqual(outputs.masked, ["aaa", "bbb"]);
        assert.deepStrictEqual(env, { A: "aaa", B: "bbb" });
      }).pipe(Effect.provideService(ActionOutputs, outputs.service));
    });

    it.effect("preserves an own __proto__ entry and masks every value in order", () => {
      const outputs = recordingOutputs();
      return Effect.gen(function* () {
        const env = yield* Secret.forChildEnv({
          ["__proto__"]: Redacted.make("proto-secret"),
          NORMAL: Redacted.make("normal-secret"),
        });
        assert.isTrue(R.has(env, "__proto__"));
        assert.deepStrictEqual(env, { ["__proto__"]: "proto-secret", NORMAL: "normal-secret" });
        assert.deepStrictEqual(outputs.masked, ["proto-secret", "normal-secret"]);
      }).pipe(Effect.provideService(ActionOutputs, outputs.service));
    });

    it.effect("masks a value before that value is in the returned record", () => {
      const seen: Array<string> = [];
      const service = ActionOutputs.makeTest({
        setSecret: (value) =>
          Effect.suspend(() => {
            seen.push(`mask:${value}`);
            return Effect.void;
          }),
      });
      return Effect.gen(function* () {
        const env = yield* Secret.forChildEnv({ A: Redacted.make("aaa") });
        seen.push(`returned:${env.A}`);
        assert.deepStrictEqual(
          seen,
          ["mask:aaa", "returned:aaa"],
          "the ordering is the invariant: a mask after the caller holds plaintext is a mask the caller could skip"
        );
      }).pipe(Effect.provideService(ActionOutputs, service));
    });

    it.effect("returns an empty record for no entries, masking nothing", () => {
      const outputs = recordingOutputs();
      return Effect.gen(function* () {
        const forChildEnv1 = yield* Secret.forChildEnv({});
        assert.deepStrictEqual(forChildEnv1, {});
        assert.lengthOf(
          outputs.masked,
          0,
          "the recorder suspends, so it logs a mask when it runs; an eager one logs calls that never happened"
        );
      }).pipe(Effect.provideService(ActionOutputs, outputs.service));
    });
  });

  describe("forRunnerFile", () => {
    it.effect("masks then returns the plaintext", () => {
      const outputs = recordingOutputs();
      return Effect.gen(function* () {
        const forRunnerFile2 = yield* Secret.forRunnerFile(Redacted.make("ghs_abc"));
        assert.strictEqual(forRunnerFile2, "ghs_abc");
        assert.deepStrictEqual(outputs.masked, ["ghs_abc"]);
      }).pipe(Effect.provideService(ActionOutputs, outputs.service));
    });
  });

  describe("forProcessEnv", () => {
    it.effect("masks then returns the plaintext", () => {
      const outputs = recordingOutputs();
      return Effect.gen(function* () {
        const forProcessEnv3 = yield* Secret.forProcessEnv(Redacted.make("ghs_env"));
        assert.strictEqual(forProcessEnv3, "ghs_env");
        assert.deepStrictEqual(outputs.masked, ["ghs_env"]);
      }).pipe(Effect.provideService(ActionOutputs, outputs.service));
    });

    it.effect("masks before the caller holds the plaintext", () => {
      const seen: Array<string> = [];
      const service = ActionOutputs.makeTest({
        setSecret: (value) =>
          Effect.suspend(() => {
            seen.push(`mask:${value}`);
            return Effect.void;
          }),
      });
      return Effect.gen(function* () {
        const plaintext = yield* Secret.forProcessEnv(Redacted.make("bridged"));
        seen.push(`returned:${plaintext}`);
        assert.deepStrictEqual(
          seen,
          ["mask:bridged", "returned:bridged"],
          "a mask after the caller holds plaintext is one it could skip on the way into process.env"
        );
      }).pipe(Effect.provideService(ActionOutputs, service));
    });

    it.effect("behaves identically to forRunnerFile — same mechanism, distinct audit name", () => {
      const outputs = recordingOutputs();
      return Effect.gen(function* () {
        const viaRunnerFile = yield* Secret.forRunnerFile(Redacted.make("same-secret"));
        const viaProcessEnv = yield* Secret.forProcessEnv(Redacted.make("same-secret"));
        assert.strictEqual(viaProcessEnv, viaRunnerFile);
        assert.deepStrictEqual(outputs.masked, ["same-secret", "same-secret"]);
      }).pipe(Effect.provideService(ActionOutputs, outputs.service));
    });
  });

  describe("mask", () => {
    it.effect("registers the value with the log filter and resolves void", () => {
      const outputs = recordingOutputs();
      return Effect.gen(function* () {
        const result = yield* Secret.mask(Redacted.make("register-only"));
        assert.isUndefined(result);
        assert.deepStrictEqual(outputs.masked, ["register-only"]);
      }).pipe(Effect.provideService(ActionOutputs, outputs.service));
    });

    it.effect("registers through the same route as forRunnerFile — one mechanism, observed identically", () => {
      const outputs = recordingOutputs();
      return Effect.gen(function* () {
        yield* Secret.forRunnerFile(Redacted.make("same-route"));
        yield* Secret.mask(Redacted.make("same-route"));
        assert.deepStrictEqual(outputs.masked, ["same-route", "same-route"]);
      }).pipe(Effect.provideService(ActionOutputs, outputs.service));
    });

    it("never hands back plaintext — the success channel is void, by type", () => {
      const witness: (secret: Redacted.Redacted<string>) => Effect.Effect<void, never, ActionOutputs> = Secret.mask;
      assert.strictEqual(
        witness,
        Secret.mask,
        "the proof is the typed witness: a mask returning plaintext (A = string) would not be assignable to void"
      );
    });
  });

  describe("adopt", () => {
    it.effect("re-wraps a plaintext handoff as Redacted", () =>
      withConfig(
        { HANDOFF_TOKEN: "from-parent" },
        Effect.gen(function* () {
          const adopted = yield* Secret.adopt("HANDOFF_TOKEN");
          assert.strictEqual(Redacted.value(adopted), "from-parent");
          assert.notInclude(String(adopted), "from-parent", "a Redacted must not leak through coercion");
        })
      )
    );

    it.effect("fails when the handoff variable is absent, rather than yielding an empty secret", () =>
      withConfig(
        {},
        Effect.gen(function* () {
          const exit = yield* Effect.exit(Secret.adopt("ABSENT_TOKEN"));
          assert.strictEqual(exit._tag, "Failure");
        })
      )
    );
  });

  describe("the declassification invariant", () => {
    const stripComments = (source: string): string =>
      pipe(source, Str.replace(/(^|\n)\s*\/\/.*/g, "$1"), Str.replace(/\/\*[\s\S]*?\*\//g, ""));

    const unwrappingModules = (): ReadonlyArray<string> =>
      A.filter(sourceModules, (module) => Str.includes("Redacted.value")(stripComments(sourceOf(module))));

    it("only Secret.ts unwraps a Redacted", () => {
      assert.deepStrictEqual(
        unwrappingModules(),
        ["Secret.ts"],
        "declassification stays coupled to masking only because nothing else may unwrap a Redacted"
      );
    });

    it("the guard can fail — it is asserting on a non-empty set", () => {
      assert.isAbove(
        unwrappingModules().length,
        0,
        "without this control the guard passes if Redacted were unused or the comment stripper blinded the scan"
      );
    });

    it("the comment stripper removes comments and only comments", () => {
      assert.notInclude(
        stripComments("/** mentions Redacted.value in TSDoc */\nconst a = 1;"),
        "Redacted.value",
        "a raw scan reads TSDoc as code, reporting a module that explains it does not unwrap as unwrapping"
      );
      assert.include(
        stripComments("// a note\nconst t = Redacted.value(s);"),
        "Redacted.value",
        "the stripper is load-bearing for the invariant, so it is tested rather than trusted"
      );
    });

    it("stripping order survives a `/*`-bearing token inside a LINE comment", () => {
      const fixture = "// note: see src/* for glob patterns\nconst v = Redacted.value(s);\n/** trailing doc */\n";
      assert.include(
        stripComments(fixture),
        "Redacted.value",
        "lines strip first: to a regex src/* or @octokit/* opens a block that eats real code up to the next */"
      );
    });
  });
});
