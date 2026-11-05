import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Audience, AudienceOptions, AudienceShape } from "@beep/runtime-env/Audience";
import { CurrentRuntimeEnv, RuntimeEnv } from "@beep/runtime-env/RuntimeEnv";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import * as S from "effect/Schema";

/** A pure logger stub that replaces the defaults, so TestConsole is never involved. */
const capture = (lines: Array<{ readonly level: string; readonly text: string }>) =>
  Logger.layer([
    Logger.make(({ logLevel, message }) => {
      lines.push({ level: logLevel, text: A.isArray(message) ? A.join(A.map(message, String), " ") : String(message) });
    }),
  ]);

const capturedAudience = (
  self: Layer.Layer<Audience>,
  lines: Array<{ readonly level: string; readonly text: string }>
) => {
  const loggerLayer = capture(lines);
  return Layer.effectContext(
    Effect.scopedWith((scope) =>
      Effect.flatMap(Layer.buildWithScope(loggerLayer, scope), (context) =>
        Effect.provideContext(Layer.buildWithScope(self, scope), context)
      )
    )
  );
};

const runtime = (fields: { agent?: string; ci?: "github-actions" | "generic" }) =>
  RuntimeEnv.make({
    agent: O.fromNullishOr(fields.agent),
    ci: O.fromNullishOr(fields.ci),
    terminal: O.none(),
  });

/** `Audience.layer` fed by the real `CurrentRuntimeEnv.layer`, so the whole chain reads one environment. */
const audienceLayer = (env: Record<string, string>, envVar = "OKFIT_AUDIENCE") =>
  Audience.layer({ envVar }).pipe(
    Layer.provide(CurrentRuntimeEnv.layer),
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env)))
  );

describe("Audience.detect", () => {
  it("agent beats CI (an agent inside a CI job gets agent output)", () =>
    assert.strictEqual(Audience.detect(runtime({ agent: "claude", ci: "github-actions" })), "agent"));
  it("CI only is ci", () => assert.strictEqual(Audience.detect(runtime({ ci: "generic" })), "ci"));
  it("agent only is agent", () => assert.strictEqual(Audience.detect(runtime({ agent: "codex" })), "agent"));
  it("nothing is human", () => assert.strictEqual(Audience.detect(runtime({})), "human"));
});

describe("Audience.layer", () => {
  class Valid extends Context.Service<Valid, Context.Service.Shape<typeof Audience>>()(
    "@beep/runtime-env/test/Audience.test/Valid"
  ) {}
  class Invalid extends Context.Service<Invalid, Context.Service.Shape<typeof Audience>>()(
    "@beep/runtime-env/test/Audience.test/Invalid"
  ) {}
  it.layer(audienceLayer({ CLAUDECODE: "1", OKFIT_AUDIENCE: "human" }), { timeout: "30 seconds" })((it) => {
    it.effect("the override beats detection: CLAUDECODE=1 with OKFIT_AUDIENCE=human is a human", () =>
      Effect.map(Audience, (audience) => assert.deepStrictEqual({ ...audience }, { kind: "human", source: "override" }))
    );
  });

  it.layer(audienceLayer({ CLAUDECODE: "1" }), { timeout: "30 seconds" })((it) => {
    it.effect("CLAUDECODE=1 with no override is an agent, detected, never a refusal", () =>
      Effect.map(Audience, (audience) => assert.deepStrictEqual({ ...audience }, { kind: "agent", source: "detected" }))
    );
  });

  it.layer(audienceLayer({}), { timeout: "30 seconds" })((it) => {
    it.effect("no signals and no override is a detected human", () =>
      Effect.map(Audience, (audience) => assert.deepStrictEqual({ ...audience }, { kind: "human", source: "detected" }))
    );
  });

  it.layer(audienceLayer({ GITHUB_ACTIONS: "true" }), { timeout: "30 seconds" })((it) => {
    it.effect("CI detection feeds the audience", () =>
      Effect.map(Audience, (audience) => assert.deepStrictEqual({ ...audience }, { kind: "ci", source: "detected" }))
    );
  });

  {
    const lines: Array<{ readonly level: string; readonly text: string }> = [];
    it.layer(capturedAudience(audienceLayer({ OKFIT_AUDIENCE: "robot", CLAUDECODE: "1" }), lines), {
      timeout: "30 seconds",
    })((it) => {
      it.effect("an invalid override falls back to detection and logs exactly one warning", () =>
        Audience.pipe(
          Effect.tap((audience) =>
            Effect.sync(() => {
              assert.deepStrictEqual({ ...audience }, { kind: "agent", source: "detected" });
              assert.lengthOf(lines, 1);
              assert.strictEqual(lines[0]?.level, "Warn");
              assert.strictEqual(lines[0]?.text, "OKFIT_AUDIENCE=robot is not one of human|agent|ci; ignoring it");
            })
          )
        )
      );
    });
  }

  {
    const valid: Array<{ readonly level: string; readonly text: string }> = [];
    const invalid: Array<{ readonly level: string; readonly text: string }> = [];
    it.layer(
      Layer.mergeAll(
        Layer.effect(Valid, Audience).pipe(
          Layer.provide(capturedAudience(audienceLayer({ OKFIT_AUDIENCE: "ci" }), valid))
        ),
        Layer.effect(Invalid, Audience).pipe(
          Layer.provide(capturedAudience(audienceLayer({ OKFIT_AUDIENCE: "nope" }), invalid))
        )
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("the capture is live: a valid override logs nothing, an invalid one logs (positive control)", () =>
        Effect.gen(function* () {
          yield* Valid;
          yield* Invalid;
          assert.lengthOf(valid, 0);
          assert.lengthOf(invalid, 1);
        })
      );
    });
  }

  {
    const lines: Array<{ readonly level: string; readonly text: string }> = [];
    it.layer(capturedAudience(audienceLayer({ OKFIT_AUDIENCE: "", GITHUB_ACTIONS: "true" }), lines), {
      timeout: "30 seconds",
    })((it) => {
      it.effect("an empty override is unset: detected, with no warning", () =>
        Audience.pipe(
          Effect.tap((audience) =>
            Effect.sync(() => {
              assert.deepStrictEqual({ ...audience }, { kind: "ci", source: "detected" });
              assert.lengthOf(lines, 0);
            })
          )
        )
      );
    });
  }

  {
    const lines: Array<{ readonly level: string; readonly text: string }> = [];
    it.layer(
      capturedAudience(
        Layer.provide(Audience.layer({ envVar: "OKFIT_AUDIENCE" }), CurrentRuntimeEnv.layer).pipe(
          Layer.provide(
            ConfigProvider.layer(
              ConfigProvider.fromUnknown({ OKFIT_AUDIENCE: "", GITHUB_ACTIONS: "true" }, { preserveEmptyStrings: true })
            )
          )
        ),
        lines
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("an empty override is unset even when the provider preserves empty strings", () =>
        Audience.pipe(
          Effect.tap((audience) =>
            Effect.sync(() => {
              assert.deepStrictEqual({ ...audience }, { kind: "ci", source: "detected" });
              assert.lengthOf(lines, 0);
            })
          )
        )
      );
    });
  }

  it.layer(audienceLayer({ OKFIT_AUDIENCE: "HUMAN", CLAUDECODE: "1" }), { timeout: "30 seconds" })((it) => {
    it.effect("the override is case-insensitive", () =>
      Effect.map(Audience, (audience) => assert.deepStrictEqual({ ...audience }, { kind: "human", source: "override" }))
    );
  });

  it.layer(
    Layer.provide(Audience.layer(), CurrentRuntimeEnv.layer).pipe(
      Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ CLAUDECODE: "1", OKFIT_AUDIENCE: "human" })))
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("without an envVar option the audience is always detected", () =>
      Effect.gen(function* () {
        const audience = yield* Audience;
        assert.deepStrictEqual({ ...audience }, { kind: "agent", source: "detected" });
      })
    );
  });
});

describe("Audience options", () => {
  it("the named options type is the one layer takes", () => {
    const options: AudienceOptions.Encoded = { envVar: "OKFIT_AUDIENCE" };
    assert.isDefined(Audience.layer(options));
  });

  it.effect("decodes omitted envVar without adding a key", () =>
    Effect.map(S.decodeEffect(AudienceOptions)({}), (options) =>
      assert.deepStrictEqual(options, AudienceOptions.make({}))
    )
  );

  it.effect("accepts strings without trimming or restricting variable names", () =>
    Effect.gen(function* () {
      for (const envVar of ["", "OKFIT_AUDIENCE", " ", "custom.name", "観客\n"]) {
        const options = yield* S.decodeEffect(AudienceOptions)({ envVar });
        assert.deepStrictEqual(options, AudienceOptions.make({ envVar }));
      }
    })
  );

  it("rejects non-string envVar values and explicit undefined", () => {
    for (const envVar of [undefined, null, 1, true, {}, []]) {
      assert.isFalse(S.is(AudienceOptions)({ envVar }));
    }
  });

  it.effect("plain omitted-key options preserve detection despite an override in the environment", () =>
    Effect.gen(function* () {
      const context = yield* Layer.build(
        Audience.layer({}).pipe(
          Layer.provide(CurrentRuntimeEnv.layer),
          Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ CLAUDECODE: "1", OKFIT_AUDIENCE: "human" })))
        )
      );
      const audience = Context.get(context, Audience);
      assert.deepStrictEqual({ ...audience }, { kind: "agent", source: "detected" });
    })
  );

  it.effect("decoded options preserve the named override's precedence over detection", () =>
    Effect.gen(function* () {
      const context = yield* Layer.build(
        S.decodeEffect(AudienceOptions)({ envVar: "CUSTOM_AUDIENCE" }).pipe(
          Effect.map(Audience.layer),
          Layer.unwrap,
          Layer.provide(CurrentRuntimeEnv.layer),
          Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ CLAUDECODE: "1", CUSTOM_AUDIENCE: "human" })))
        )
      );
      const audience = Context.get(context, Audience);
      assert.deepStrictEqual({ ...audience }, { kind: "human", source: "override" });
    })
  );
});

describe("Audience.layerTest", () => {
  it.layer(Audience.layerTest("ci"), { timeout: "30 seconds" })((it) => {
    it.effect("fixes the kind as an override and needs nothing", () =>
      Effect.gen(function* () {
        const audience = yield* Audience;
        assert.deepStrictEqual({ ...audience }, { kind: "ci", source: "override" });
      })
    );
  });
  it.effect("takes the source as a second argument, so a test can say the variable did not decide", () =>
    Effect.gen(function* () {
      const audiences = [
        yield* Layer.build(Audience.layerTest("human", "detected")).pipe(
          Effect.map((context) => Context.get(context, Audience))
        ),
        yield* Layer.build(Audience.layerTest("human", "override")).pipe(
          Effect.map((context) => Context.get(context, Audience))
        ),
        yield* Layer.build(Audience.layerTest("agent")).pipe(Effect.map((context) => Context.get(context, Audience))),
        yield* Layer.build(Audience.layerTest("ci", "flag")).pipe(
          Effect.map((context) => Context.get(context, Audience))
        ),
      ];
      assert.deepStrictEqual(
        A.map(audiences, (audience) => ({ ...audience })),
        [
          AudienceShape.make({ kind: "human", source: "detected" }),
          AudienceShape.make({ kind: "human", source: "override" }),
          AudienceShape.make({ kind: "agent", source: "override" }),
          AudienceShape.make({ kind: "ci", source: "flag" }),
        ]
      );
    })
  );
});

describe("Audience schema property floor", () => {
  it.effect.prop(
    "AudienceShape: decode(encode(x)) equals x, and layerTest provides exactly the generated shape",
    [Arbitrary.schema(AudienceShape)],
    ([shape]) =>
      Effect.gen(function* () {
        const argument1 = S.decodeEffect(AudienceShape);
        const value = yield* S.encodeEffect(AudienceShape)(shape);
        const decoded = yield* argument1(value);
        assert.isTrue(S.toEquivalence(AudienceShape)(decoded, shape));
        const build1 = yield* Layer.build(Audience.layerTest(shape.kind, shape.source));
        const provided = Context.get(build1, Audience);
        assert.deepStrictEqual(provided, shape);
      }),
    { arbitrary: fcRuns(50) }
  );
  it.effect.prop(
    "AudienceOptions: decode(encode(x)) equals x for every generated options record",
    [Arbitrary.schema(AudienceOptions)],
    ([options]) =>
      Effect.gen(function* () {
        const argument2 = S.decodeEffect(AudienceOptions);
        const value1 = yield* S.encodeEffect(AudienceOptions)(options);
        const decoded = yield* argument2(value1);
        assert.isTrue(S.toEquivalence(AudienceOptions)(decoded, options));
      }),
    { arbitrary: fcRuns(50) }
  );
});
