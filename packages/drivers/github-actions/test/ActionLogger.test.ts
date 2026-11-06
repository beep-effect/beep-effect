import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { ActionEnvironment, ActionLogger } from "@beep/github-actions";
import { WithBufferOptions, WithStepOptions } from "@beep/github-actions/ActionLogger";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Latch from "effect/Latch";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as References from "effect/References";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import type { AnnotationProperties } from "@beep/github-commands";

/** Everything written to `Console.log`, as strings, in order. */
const lines = Effect.map(TestConsole.logLines, (captured) => A.map(captured, String));

/** The lines a single buffer flushed, between its header and its footer. */
const bufferedFor = (label: string, captured: ReadonlyArray<string>): ReadonlyArray<string> => {
  const start = O.getOrElse(
    A.findFirstIndex(captured, (line) => Str.includes(`Buffered output for "${label}"`)(line)),
    () => -1
  );
  const end = O.getOrElse(
    A.findFirstIndex(captured, (line) => Str.includes(`End buffered output for "${label}"`)(line)),
    () => -1
  );
  return start === -1 || end === -1 ? [] : captured.slice(start + 1, end);
};

describe("ActionLogger", () => {
  describe("options contracts", () => {
    it.effect("WithBufferOptions preserves plain objects and exact optional flush/discard policies", () =>
      Effect.gen(function* () {
        const omitted: WithBufferOptions.Encoded = {};
        const value1 = yield* S.decodeEffect(WithBufferOptions)(omitted);
        assert.deepStrictEqual(value1, WithBufferOptions.make({}));
        const value2 = yield* S.encodeEffect(WithBufferOptions)(WithBufferOptions.make(omitted));
        assert.deepStrictEqual(value2, {});
        for (const onSuccess of ["flush", "discard"] as const) {
          const options: WithBufferOptions.Encoded = { onSuccess };
          const value3 = yield* S.decodeEffect(WithBufferOptions)(options);
          assert.deepStrictEqual(value3, options);
        }
        assert.isFalse(S.is(WithBufferOptions)({ onSuccess: undefined }));
        assert.isFalse(S.is(WithBufferOptions)({ onSuccess: "ignore" }));
        assert.isFalse(S.is(WithBufferOptions)({ onSuccess: null }));
      })
    );

    it.effect("WithStepOptions preserves plain objects, exact optional summaries and empty strings", () =>
      Effect.gen(function* () {
        const omitted: WithStepOptions.Encoded = {};
        const value4 = yield* S.decodeEffect(WithStepOptions)(omitted);
        assert.deepStrictEqual(value4, WithStepOptions.make({}));
        const value5 = yield* S.encodeEffect(WithStepOptions)(WithStepOptions.make(omitted));
        assert.deepStrictEqual(value5, {});
        for (const summary of ["", "Published"]) {
          const options: WithStepOptions.Encoded = { summary };
          const value6 = yield* S.decodeEffect(WithStepOptions)(options);
          assert.deepStrictEqual(value6, options);
        }
        assert.isFalse(S.is(WithStepOptions)({ summary: undefined }));
        assert.isFalse(S.is(WithStepOptions)({ summary: 7 }));
        assert.isFalse(S.is(WithStepOptions)({ summary: null }));
      })
    );
  });

  describe("groups", () => {
    it.layer(ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({}))), { timeout: "30 seconds" })(
      (it) => {
        it.effect("brackets the effect with ::group:: and ::endgroup::", () =>
          Effect.gen(function* () {
            const logger = yield* ActionLogger;
            const value = yield* logger.group("install", Effect.succeed(7));
            assert.strictEqual(value, 7);
            const captured = yield* lines;
            assert.deepStrictEqual(captured, ["::group::install", "::endgroup::"]);
          })
        );
      }
    );

    it.layer(ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({}))), { timeout: "30 seconds" })(
      (it) => {
        it.effect("closes the group even when the effect fails", () =>
          Effect.gen(function* () {
            const logger = yield* ActionLogger;
            yield* Effect.flip(logger.group("install", Effect.fail("boom")));
            const captured = yield* lines;
            assert.strictEqual(captured.at(-1), "::endgroup::");
          })
        );
      }
    );

    it.layer(ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({}))), { timeout: "30 seconds" })(
      (it) => {
        it.effect("escapes a group name that would otherwise inject a command", () =>
          Effect.gen(function* () {
            const logger = yield* ActionLogger;
            yield* logger.group("bad\n::error::smuggled", Effect.void);
            const captured = yield* lines;
            assert.strictEqual(captured[0], "::group::bad%0A::error::smuggled");
          })
        );
      }
    );
  });

  describe("annotations", () => {
    it.layer(ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({}))), { timeout: "30 seconds" })(
      (it) => {
        it.effect("emits a notice with its source annotation", () =>
          Effect.gen(function* () {
            yield* (yield* ActionLogger).notice("looks odd", { file: "src/a.ts", startLine: 12 });
            const captured = yield* lines;
            assert.deepStrictEqual(captured, ["::notice file=src/a.ts,line=12::looks odd"]);
          })
        );
      }
    );

    it.layer(
      Layer.mergeAll(ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({}))), ActionLogger.layerLogger),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("annotated puts file and line on a log the workflow logger renders", () =>
        Effect.gen(function* () {
          const logger = yield* ActionLogger;
          yield* logger.annotated({ file: "src/b.ts", startLine: 3, startColumn: 5 }, Effect.logWarning("careful"));
          const captured = yield* lines;
          assert.deepStrictEqual(captured, ["::warning file=src/b.ts,line=3,col=5::careful"]);
        })
      );
    });
  });

  describe("the workflow-command logger", () => {
    const logged = Effect.fn("logged")(function* <A, E>(program: Effect.Effect<A, E>) {
      yield* program;
      return yield* lines;
    });

    it.layer(ActionLogger.layerLogger, { timeout: "30 seconds" })((it) => {
      it.effect("maps error to ::error::", () =>
        Effect.gen(function* () {
          const logged7 = yield* logged(Effect.logError("it broke"));
          assert.deepStrictEqual(logged7, ["::error::it broke"]);
        })
      );
    });

    it.layer(ActionLogger.layerLogger, { timeout: "30 seconds" })((it) => {
      it.effect("maps warning to ::warning::", () =>
        Effect.gen(function* () {
          const logged8 = yield* logged(Effect.logWarning("careful"));
          assert.deepStrictEqual(logged8, ["::warning::careful"]);
        })
      );
    });

    it.layer(ActionLogger.layerLogger, { timeout: "30 seconds" })((it) => {
      it.effect("maps info to plain text, with no command prefix", () =>
        Effect.gen(function* () {
          const logged9 = yield* logged(Effect.logInfo("hello"));
          assert.deepStrictEqual(logged9, ["hello"]);
        })
      );
    });

    it.layer(ActionLogger.layerLogger, { timeout: "30 seconds" })((it) => {
      it.effect("maps debug to ::debug::", () =>
        Effect.gen(function* () {
          const captured = yield* logged(
            Effect.logDebug("noisy").pipe(Effect.provideService(References.MinimumLogLevel, "All"))
          );
          assert.deepStrictEqual(captured, ["::debug::noisy"]);
        })
      );
    });

    it.layer(ActionLogger.layerLogger, { timeout: "30 seconds" })((it) => {
      it.effect("escapes a newline so a log line cannot become a second command", () =>
        Effect.gen(function* () {
          const logged10 = yield* logged(Effect.logError("line one\n::error::smuggled"));
          assert.deepStrictEqual(logged10, ["::error::line one%0A::error::smuggled"]);
        })
      );
    });

    it.layer(ActionLogger.layerLogger, { timeout: "30 seconds" })((it) => {
      it.effect("joins a multi-part message", () =>
        Effect.gen(function* () {
          const logged11 = yield* logged(Effect.logInfo("count", 3));
          assert.deepStrictEqual(logged11, ["count 3"]);
        })
      );
    });
  });

  describe("buffering", () => {
    it.layer(ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({}))), { timeout: "30 seconds" })(
      (it) => {
        it.effect("captures verbose output and flushes it when the step succeeds", () =>
          Effect.gen(function* () {
            const logger = yield* ActionLogger;
            yield* logger.withBuffer(
              "install",
              Effect.logInfo("resolving").pipe(Effect.andThen(Effect.logInfo("done")))
            );
            const captured = yield* lines;
            assert.deepStrictEqual(bufferedFor("install", captured), ["resolving", "done"]);
          })
        );
      }
    );

    it.layer(ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({}))), { timeout: "30 seconds" })(
      (it) => {
        it.effect("flushes the transcript when the step fails", () =>
          Effect.gen(function* () {
            const logger = yield* ActionLogger;
            yield* Effect.flip(
              logger.withBuffer("install", Effect.andThen(Effect.logInfo("resolving"), Effect.fail("boom")))
            );
            const captured = yield* lines;
            assert.deepStrictEqual(bufferedFor("install", captured), ["resolving"]);
          })
        );
      }
    );

    it.layer(ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({}))), { timeout: "30 seconds" })(
      (it) => {
        it.effect("onSuccess: 'discard' drops the transcript when the step succeeds", () =>
          Effect.gen(function* () {
            const logger = yield* ActionLogger;
            const value = yield* logger.withBuffer(
              "install",
              Effect.as(Effect.andThen(Effect.logInfo("resolving"), Effect.logInfo("done")), 7),
              { onSuccess: "discard" }
            );
            assert.strictEqual(value, 7);
            const captured = yield* lines;
            // A green step leaves NOTHING behind — no header, no footer, no body.
            assert.deepStrictEqual(captured, []);
          })
        );
      }
    );

    it.layer(ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({}))), { timeout: "30 seconds" })(
      (it) => {
        it.effect("onSuccess: 'discard' still flushes the transcript when the step fails", () =>
          Effect.gen(function* () {
            const logger = yield* ActionLogger;
            yield* Effect.flip(
              logger.withBuffer("install", Effect.andThen(Effect.logInfo("resolving"), Effect.fail("boom")), {
                onSuccess: "discard",
              })
            );
            const captured = yield* lines;
            // Discard is a statement about SUCCESS only; the failure transcript
            // is exactly what the buffer was kept for.
            assert.deepStrictEqual(bufferedFor("install", captured), ["resolving"]);
          })
        );
      }
    );

    it.layer(ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({}))), { timeout: "30 seconds" })(
      (it) => {
        it.effect("onSuccess: 'flush' spelled explicitly matches the default", () =>
          Effect.gen(function* () {
            const logger = yield* ActionLogger;
            yield* logger.withBuffer("install", Effect.logInfo("resolving"), { onSuccess: "flush" });
            const captured = yield* lines;
            assert.deepStrictEqual(bufferedFor("install", captured), ["resolving"]);
          })
        );
      }
    );

    it.layer(ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({}))), { timeout: "30 seconds" })(
      (it) => {
        it.effect("onSuccess: 'discard' does not suppress warnings, which never entered the buffer", () =>
          Effect.gen(function* () {
            const logger = yield* ActionLogger;
            yield* logger.withBuffer(
              "install",
              Effect.andThen(Effect.logWarning("deprecated"), Effect.logInfo("done")),
              {
                onSuccess: "discard",
              }
            );
            const captured = yield* lines;
            // The warning went out live; only the Info transcript was discarded.
            assert.deepStrictEqual(captured, ["::warning::deprecated"]);
          })
        );
      }
    );

    it.layer(ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({}))), { timeout: "30 seconds" })(
      (it) => {
        it.effect("passes warnings through immediately rather than burying them in the buffer", () =>
          Effect.gen(function* () {
            const logger = yield* ActionLogger;
            yield* logger.withBuffer(
              "install",
              Effect.andThen(Effect.logWarning("deprecated"), Effect.logInfo("done"))
            );
            const captured = yield* lines;
            // The warning is emitted before the flush header, so it is visible
            // while the step is still running.
            assert.strictEqual(captured[0], "::warning::deprecated");
            assert.deepStrictEqual(bufferedFor("install", captured), ["done"]);
          })
        );
      }
    );

    it.layer(
      Layer.mergeAll(
        ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({ RUNNER_DEBUG: "1" }))),
        ActionLogger.layerLogger
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("does not buffer when the runner has step debugging enabled", () =>
        Effect.gen(function* () {
          const logger = yield* ActionLogger;
          yield* logger.withBuffer("install", Effect.logInfo("resolving"));
          const captured = yield* lines;
          assert.deepStrictEqual(captured, ["resolving"]);
        })
      );
    });

    it.layer(ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({}))), { timeout: "30 seconds" })(
      (it) => {
        it.effect("flushes an enclosing buffer inside the group that failed", () =>
          Effect.gen(function* () {
            const logger = yield* ActionLogger;
            yield* Effect.flip(
              logger.withBuffer(
                "install",
                logger.group("resolve", Effect.andThen(Effect.logInfo("resolving"), Effect.fail("boom")))
              )
            );
            const captured = yield* lines;
            const endGroup = captured.indexOf("::endgroup::");
            const flushed = O.getOrElse(
              A.findFirstIndex(captured, (line) => Str.includes('Buffered output for "install"')(line)),
              () => -1
            );
            assert.isAbove(endGroup, 0, "the group must close");
            assert.isBelow(flushed, endGroup, "the transcript belongs inside the group that failed");
            assert.deepStrictEqual(bufferedFor("install", captured), ["resolving"]);
          })
        );
      }
    );

    it.layer(ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({}))), { timeout: "30 seconds" })(
      (it) => {
        it.effect("keeps concurrent buffers separate", () =>
          Effect.gen(function* () {
            const logger = yield* ActionLogger;
            // THREE latches, and the order is the whole test. A save/restore
            // implementation over a shared "current buffer" global is LIFO-correct
            // whenever two buffers nest, so the obvious interleaving passes for the
            // wrong reason. This order forces LEFT TO LOG WHILE RIGHT'S BUFFER IS
            // STILL APPLIED AND UNRESTORED — which only a fiber-local
            // implementation survives.
            const leftInside = yield* Latch.make();
            const rightInside = yield* Latch.make();
            const leftDone = yield* Latch.make();
            yield* Effect.all(
              [
                logger.withBuffer(
                  "left",
                  Effect.gen(function* () {
                    yield* Effect.logInfo("left-first");
                    yield* leftInside.open;
                    yield* rightInside.await;
                    yield* Effect.logInfo("left-second");
                    yield* leftDone.open;
                  })
                ),
                Effect.gen(function* () {
                  yield* leftInside.await;
                  yield* logger.withBuffer(
                    "right",
                    Effect.gen(function* () {
                      yield* Effect.logInfo("right-only");
                      yield* rightInside.open;
                      yield* leftDone.await;
                    })
                  );
                }),
              ],
              { concurrency: 2 }
            );
            const captured = yield* lines;
            assert.deepStrictEqual(bufferedFor("left", captured), ["left-first", "left-second"]);
            assert.deepStrictEqual(bufferedFor("right", captured), ["right-only"]);
          })
        );
      }
    );
  });

  describe("steps", () => {
    /** `withStep` renders its summary through `Effect.logInfo`, so the log-to-
     * workflow-command logger has to be installed for the line to be observable
     * — the same one `Action.run` installs. */

    it.layer(
      Layer.mergeAll(ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({}))), ActionLogger.layerLogger),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("trades the transcript for exactly one summary line on success", () =>
        Effect.gen(function* () {
          const logger = yield* ActionLogger;
          const value = yield* logger.withStep(
            "install",
            Effect.as(Effect.andThen(Effect.logInfo("resolving"), Effect.logInfo("done")), 7)
          );
          assert.strictEqual(value, 7);
          // The whole point: two verbose lines in, one summary line out. This is
          // the step `withBuffer({ onSuccess: "discard" })` alone cannot reach —
          // it leaves ZERO lines, which is why the recipe kept coming out wrong.
          const lines12 = yield* lines;
          assert.deepStrictEqual(lines12, ["✅ install"]);
        })
      );
    });

    it.layer(
      Layer.mergeAll(ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({}))), ActionLogger.layerLogger),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("a supplied summary replaces the default line", () =>
        Effect.gen(function* () {
          const logger = yield* ActionLogger;
          yield* logger.withStep("install", Effect.logInfo("resolving"), { summary: "installed 42 packages" });
          const lines13 = yield* lines;
          assert.deepStrictEqual(lines13, ["installed 42 packages"]);
        })
      );
    });

    it.layer(
      Layer.mergeAll(ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({}))), ActionLogger.layerLogger),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("emits the failure header BEFORE the transcript it announces", () =>
        Effect.gen(function* () {
          const logger = yield* ActionLogger;
          yield* Effect.flip(
            logger.withStep("install", Effect.andThen(Effect.logInfo("resolving"), Effect.fail("boom")))
          );
          const captured = yield* lines;
          const header = captured.indexOf("❌ install");
          const flushed = O.getOrElse(
            A.findFirstIndex(captured, (line) => Str.includes('Buffered output for "install"')(line)),
            () => -1
          );
          assert.isAtLeast(header, 0, "the failure header must be emitted");
          assert.isBelow(header, flushed, "the header introduces the transcript, so it cannot follow it");
          assert.deepStrictEqual(bufferedFor("install", captured), ["resolving"]);
          // The success line is a statement about success; a failed step must not
          // claim one. Mutating the `Effect.tap` to `Effect.onExit` fails here.
          assert.isFalse(captured.includes("✅ install"));
        })
      );
    });

    it.layer(
      Layer.mergeAll(ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({}))), ActionLogger.layerLogger),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("the summary is never captured by the buffer it replaces", () =>
        Effect.gen(function* () {
          const logger = yield* ActionLogger;
          yield* logger.withStep("install", Effect.logInfo("resolving"));
          const captured = yield* lines;
          // Emitting the summary INSIDE the buffered region would discard it
          // along with the transcript, leaving a green step with no line at all.
          assert.deepStrictEqual(captured, ["✅ install"]);
        })
      );
    });

    it.layer(
      Layer.mergeAll(ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({}))), ActionLogger.layerLogger),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("warnings still go out live rather than into the discarded transcript", () =>
        Effect.gen(function* () {
          const logger = yield* ActionLogger;
          yield* logger.withStep("install", Effect.andThen(Effect.logWarning("deprecated"), Effect.logInfo("done")));
          const lines14 = yield* lines;
          assert.deepStrictEqual(lines14, ["::warning::deprecated", "✅ install"]);
        })
      );
    });

    it.layer(
      Layer.mergeAll(
        ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({ RUNNER_DEBUG: "1" }))),
        ActionLogger.layerLogger
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("keeps the summary when step debugging turns buffering off", () =>
        Effect.gen(function* () {
          const logger = yield* ActionLogger;
          yield* logger.withStep("install", Effect.logInfo("resolving"));
          // Verbose output goes live AND the summary still lands: someone asking
          // for debug output has not asked to lose the line naming what passed.
          const lines15 = yield* lines;
          assert.deepStrictEqual(lines15, ["resolving", "✅ install"]);
        })
      );
    });

    it.layer(
      Layer.mergeAll(
        ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({ RUNNER_DEBUG: "1" }))),
        ActionLogger.layerLogger
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("under step debugging a FAILING step emits the header after the live transcript", () =>
        Effect.gen(function* () {
          const logger = yield* ActionLogger;
          yield* Effect.flip(
            logger.withStep("install", Effect.andThen(Effect.logInfo("resolving"), Effect.fail("boom")))
          );
          const captured = yield* lines;
          // The documented ordering ("header first, then the transcript") is a
          // property of the BUFFERED path only. With step debugging on,
          // withBuffer returns the effect unbuffered, so its output has already
          // gone out live by the time tapCause fires and the header lands LAST.
          // Pinned rather than papered over: the docstring is qualified to
          // match. The debug suite previously only exercised a successful step,
          // so this ordering was undocumented and unverified.
          assert.deepStrictEqual(captured, ["resolving", "❌ install"]);
        })
      );
    });

    it.layer(ActionLogger.layerTest(), { timeout: "30 seconds" })((it) => {
      it.effect("the test double passes the effect through without a summary", () =>
        Effect.gen(function* () {
          const logger = yield* ActionLogger;
          const withStep16 = yield* logger.withStep("step", Effect.succeed("value"));
          assert.strictEqual(withStep16, "value");
          const lines17 = yield* lines;
          assert.deepStrictEqual(lines17, []);
        })
      );
    });
  });

  describe("silence", () => {
    it.layer(ActionLogger.layerSilent, { timeout: "30 seconds" })((it) => {
      it.effect("layerSilent drops log output entirely", () =>
        Effect.gen(function* () {
          yield* Effect.logError("would be noisy");
          const lines18 = yield* lines;
          assert.deepStrictEqual(lines18, []);
        })
      );
    });

    it.layer(ActionLogger.layerSilent, { timeout: "30 seconds" })((it) => {
      it.effect("layerSilent still serves the service, passing effects through", () =>
        Effect.gen(function* () {
          const logger = yield* ActionLogger;
          const group19 = yield* logger.group("quiet", Effect.succeed(1));
          assert.strictEqual(group19, 1);
          const lines20 = yield* lines;
          assert.deepStrictEqual(lines20, []);
        })
      );
    });
  });

  describe("test double", () => {
    it.layer(ActionLogger.layerTest(), { timeout: "30 seconds" })((it) => {
      it.effect("the default double is silent rather than dying", () =>
        Effect.gen(function* () {
          const logger = yield* ActionLogger;
          yield* logger.notice("nothing to see");
          const withBuffer21 = yield* logger.withBuffer("step", Effect.succeed("value"));
          assert.strictEqual(withBuffer21, "value");
          const lines22 = yield* lines;
          assert.deepStrictEqual(lines22, []);
        })
      );
    });

    {
      const notices: Array<string> = [];
      it.layer(
        ActionLogger.layerTest({
          notice: dual(
            (args) => P.isString(args[0]),
            (message: string, _properties?: AnnotationProperties.Encoded): Effect.Effect<void> =>
              Effect.sync(() => void notices.push(message))
          ),
        }),
        { timeout: "30 seconds" }
      )((it) => {
        it.effect("an override wins over the silent default", () =>
          Effect.gen(function* () {
            yield* (yield* ActionLogger).notice("recorded");
            assert.deepStrictEqual(notices, ["recorded"]);
          })
        );
      });
    }
  });
});

describe("WithStepOptions codec property", () => {
  it.effect.prop(
    "WithStepOptions round-trips through its codec",
    [Arbitrary.schema(WithStepOptions)],
    ([value]) =>
      Effect.gen(function* () {
        const argument = S.decodeEffect(WithStepOptions);
        const value7 = yield* S.encodeEffect(WithStepOptions)(value);
        const value23 = yield* argument(value7);
        assert.deepStrictEqual(value23, value);
      }),
    { arbitrary: fcRuns(100) }
  );
});
