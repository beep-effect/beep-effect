import { ActionEnvironment, ActionOutputs, ActionState } from "@beep/github-actions";
import { MemoryFileSystem } from "@beep/memfs";
import { UnstubbedMemberError } from "@beep/utils/TestDouble";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure, assertNone } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

const Json = S.fromJsonString(S.Unknown);
const JsonString = S.fromJsonString(S.String);
const NegativeZero = S.Finite.check(
  S.makeFilter((value) => 1 / value === Number.NEGATIVE_INFINITY, {
    identifier: "NegativeZero",
    title: "NegativeZero",
    description: "A negative zero whose sign must survive state serialization.",
  })
);

const Token = S.Struct({ value: S.String, expires: S.Finite });

const runnerFiles = () => {
  const handle = MemoryFileSystem.makeSync({ "/rf": MemoryFileSystem.directory() });
  return { written: handle.volume, layer: handle.layer };
};

const stateFixture = (env: Record<string, string> = { GITHUB_STATE: "/rf/state" }) => {
  const files = runnerFiles();
  const base = Layer.mergeAll(ActionEnvironment.layerTest(env), files.layer);
  const outputs = ActionOutputs.layer.pipe(Layer.provide(base));
  return { files, layer: ActionState.layer.pipe(Layer.provide(Layer.mergeAll(base, outputs))) };
};

describe("ActionState", () => {
  for (const os of ["Windows", "Linux", "macOS"]) {
    const { files, layer } = stateFixture({ GITHUB_STATE: "/rf/state", RUNNER_OS: os });
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect(`uses ${os} framing and preserves terminal CR, CRLF and LF in saved state and secrets`, () =>
        Effect.gen(function* () {
          const state = yield* ActionState;
          const newline = os === "Windows" ? "\r\n" : "\n";
          let expected = "";
          for (const value of ["\r", "abc\r", "abc\r\n", "abc\n"]) {
            const serialized = yield* S.encodeEffect(JsonString)(value);
            yield* state.save("result", value, S.String);
            yield* state.saveSecret("secret", value);
            expected += `result<<EFFECTED_EOF${newline}${serialized}${newline}EFFECTED_EOF${newline}`;
            expected += `secret<<EFFECTED_EOF${newline}${serialized}${newline}EFFECTED_EOF${newline}`;
            assert.strictEqual(
              files.written.text("/rf/state"),
              expected,
              "a fresh in-memory volume performs the real flag: a appends; /rf is seeded since a write needs a parent"
            );
            const value1 = yield* S.decodeEffect(JsonString)(serialized);
            assert.strictEqual(value1, value);
          }
        })
      );
    });
  }

  {
    const { files, layer } = stateFixture();
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect("persists a value as a delimited block on the state file", () => {
        const run = Effect.gen(function* () {
          yield* (yield* ActionState).save("token", { value: "abc", expires: 1 }, Token);
        });
        return Effect.map(run, () => {
          const body = files.written.text("/rf/state") ?? "";
          assert.isTrue(Str.startsWith("token<<")(body));
          assert.include(body, '{"value":"abc","expires":1}');
        });
      });
    });
  }

  {
    const { files, layer } = stateFixture();
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect("refuses a key that cannot head a block, and writes nothing", () => {
        const run = Effect.gen(function* () {
          const error = yield* Effect.flip((yield* ActionState).save("to\nken", { value: "abc", expires: 1 }, Token));
          assert.strictEqual(
            error.reason,
            "writeFailed",
            "as in ActionOutputs, a line break would end the block early and corrupt every later entry"
          );
          assert.strictEqual(error.key, "to\nken");
        });
        return Effect.map(run, () => {
          assert.isUndefined(files.written.text("/rf/state"));
        });
      });
    });
  }

  {
    const { files, layer } = stateFixture();
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect("refuses a key containing the runner-file separators, and writes nothing", () => {
        const run = Effect.gen(function* () {
          const forEquals = yield* Effect.flip(
            (yield* ActionState).save("to=ken", { value: "abc", expires: 1 }, Token)
          );
          assert.strictEqual(
            forEquals.reason,
            "writeFailed",
            "the runner reads up to the first = or <<, so a key with = parses as key=value before the block opens"
          );
          assert.strictEqual(forEquals.key, "to=ken");
          const forHeredoc = yield* Effect.flip(
            (yield* ActionState).save("to<<ken", { value: "abc", expires: 1 }, Token)
          );
          assert.strictEqual(
            forHeredoc.reason,
            "writeFailed",
            "a key with << splits at the wrong delimiter and corrupts every later entry"
          );
          assert.strictEqual(forHeredoc.key, "to<<ken");
          const forTrailing = yield* Effect.flip((yield* ActionState).save("to<", { value: "abc", expires: 1 }, Token));
          assert.strictEqual(
            forTrailing.reason,
            "writeFailed",
            "a trailing < composes to<<<DELIM, whose first << matches early and leaves an unmatchable delimiter"
          );
          assert.strictEqual(forTrailing.key, "to<");
        });
        return Effect.map(run, () => {
          assert.isUndefined(files.written.text("/rf/state"));
        });
      });
    });
  }

  {
    const { layer } = stateFixture({ GITHUB_STATE: "/rf/state", STATE_token: '{"value":"abc","expires":1}' });
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect("reads a value back from the STATE_ variable the runner republishes", () =>
        Effect.gen(function* () {
          const value = yield* (yield* ActionState).get("token", Token);
          assert.deepStrictEqual(value, { value: "abc", expires: 1 });
        })
      );
    });
  }

  {
    const { layer } = stateFixture();
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect("getOptional answers none for a key that was never saved", () =>
        Effect.gen(function* () {
          const gotOptional = yield* (yield* ActionState).getOptional("absent", Token);
          assertNone(gotOptional);
        })
      );
    });
  }

  {
    const { layer } = stateFixture();
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect("get fails typed for a key that was never saved", () =>
        Effect.gen(function* () {
          const error = yield* Effect.flip((yield* ActionState).get("absent", Token));
          assert.strictEqual(error._tag, "ActionStateError");
          assert.strictEqual(error.reason, "missing");
          assert.strictEqual(error.key, "absent");
        })
      );
    });
  }

  {
    const { layer } = stateFixture({ GITHUB_STATE: "/rf/state", STATE_token: '{"value":"abc"}' });
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect("fails typed when the persisted value does not satisfy its schema", () =>
        Effect.gen(function* () {
          const error = yield* Effect.flip((yield* ActionState).get("token", Token));
          assert.strictEqual(error.reason, "malformed");
        })
      );
    });
  }

  {
    const { layer } = stateFixture({ GITHUB_STATE: "/rf/state", STATE_token: "{ not json" });
    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect("fails typed when the persisted value is not JSON", () =>
        Effect.gen(function* () {
          const error = yield* Effect.flip((yield* ActionState).get("token", Token));
          assert.strictEqual(error.reason, "malformed");
        })
      );
    });
  }

  describe("save-time round-trip validation", () => {
    for (const [name, value] of [
      ["NaN", Number.NaN],
      ["an undefined object member", { kept: "x", missing: undefined }],
    ] as const) {
      const { files, layer } = stateFixture();
      it.layer(layer, { timeout: "30 seconds" })((it) => {
        it.effect(`rejects ${name} with a permissive schema before appending`, () =>
          Effect.gen(function* () {
            const error = yield* Effect.flip((yield* ActionState).save("payload", value, S.Unknown));
            assert.strictEqual(error._tag, "ActionStateError");
            assert.strictEqual(error.reason, "notPlainJson");
            assert.strictEqual(error.key, "payload");
            assert.isUndefined(files.written.text("/rf/state"));
          })
        );
      });
    }

    {
      const { files, layer } = stateFixture();
      it.layer(layer, { timeout: "30 seconds" })((it) => {
        it.effect("a schema whose encoded form is not plain JSON fails AT SAVE, naming the key", () => {
          const run = Effect.gen(function* () {
            return yield* Effect.flip((yield* ActionState).save("choice", O.some("x"), S.Option(S.String)));
          });
          return Effect.map(run, (error) => {
            assert.strictEqual(error._tag, "ActionStateError");
            assert.strictEqual(
              error.reason,
              "notPlainJson",
              "Schema.Option encodes to an Option whose toJSON is {_id: Option}; save decodes the parsed value"
            );
            assert.strictEqual(error.key, "choice");
            assert.include(error.message, "plain JSON");
            assert.isUndefined(
              files.written.text("/rf/state"),
              "the failure precedes the write, or post would later fail malformed with no pointer to the cause"
            );
          });
        });
      });
    }

    {
      const { files, layer } = stateFixture();
      it.layer(layer, { timeout: "30 seconds" })((it) => {
        it.effect("Schema.OptionFromNullOr is the sanctioned spelling and still saves", () => {
          const run = Effect.gen(function* () {
            const state = yield* ActionState;
            yield* state.save("some", O.some("x"), S.OptionFromNullOr(S.String));
            yield* state.save("none", O.none<string>(), S.OptionFromNullOr(S.String));
          });
          return Effect.map(run, () => {
            const body = files.written.text("/rf/state") ?? "";
            assert.include(body, '"x"');
            assert.include(body, "null");
          });
        });
      });
    }

    {
      const { layer } = stateFixture();
      it.layer(layer, { timeout: "30 seconds" })((it) => {
        it.effect("an unstringifiable encoded form fails typed rather than as a defect", () =>
          Effect.gen(function* () {
            const error = yield* Effect.flip((yield* ActionState).save("big", { n: 1n }, S.Any));
            assert.strictEqual(
              error.reason,
              "notPlainJson",
              "JSON.stringify throws on a bigint; save must keep that on the typed channel, not the defect one"
            );
            assert.strictEqual(error.key, "big");
          })
        );
      });
    }
  });

  describe("saveSecret", () => {
    {
      const { files, layer } = stateFixture();
      it.layer(layer, { timeout: "30 seconds" })((it) => {
        it.effect("masks the secret BEFORE persisting it", () => {
          const run = Effect.gen(function* () {
            yield* (yield* ActionState).saveSecret("gh-token", "ghs_abc123");
          });
          return Effect.gen(function* () {
            yield* run;
            const argument = S.encodeResult(Json);
            const logLines1 = yield* TestConsole.logLines;
            const lines = Result.getOrThrowWith(argument(logLines1), (error) => error);
            assert.include(
              lines,
              "::add-mask::ghs_abc123",
              "GITHUB_STATE is plaintext by GitHub's protocol, so the mask is the only defense and must have happened"
            );
            assert.include(files.written.text("/rf/state") ?? "", "ghs_abc123");
          });
        });
      });
    }
  });

  describe("test double", () => {
    it.layer(ActionState.layerTest(), { timeout: "30 seconds" })((it) => {
      it.effect("an unstubbed member dies loudly", () =>
        Effect.gen(function* () {
          const exit = yield* Effect.exit((yield* ActionState).get("k", Token));
          assertExitFailure(
            exit,
            Cause.die(
              UnstubbedMemberError.make({
                message: "ActionState.makeTest: get() was called but not stubbed — pass a `get` override.",
              })
            )
          );
        })
      );
    });
  });
});

{
  const { files, layer } = stateFixture();
  it.layer(layer, { timeout: "5 seconds" })((it) => {
    it.effect("a JSON-normalized value that no longer decodes is refused before writing state", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip((yield* ActionState).save("signed-zero", -0, NegativeZero));
        assert.strictEqual(error.reason, "notPlainJson");
        assert.strictEqual(error.key, "signed-zero");
        assert.instanceOf(
          error.cause,
          S.SchemaError,
          "JSON canonicalizes -0 to 0, so NegativeZero encodes and then fails the parsed round trip"
        );
        assert.isUndefined(files.written.text("/rf/state"));
      })
    );
  });
}
