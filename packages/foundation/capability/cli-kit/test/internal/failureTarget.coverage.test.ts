import { CliDoc } from "@beep/cli-kit/CliFailure";
import { CliLinks } from "@beep/cli-kit/CliLinks";
import { CliTheme } from "@beep/cli-kit/CliTheme";
import { Doc } from "@beep/cli-kit/Doc";
import {
  currentTarget,
  FailureTargetCell,
  fallbackTarget,
  linesOf,
  plainFailureLines,
  readSpans,
  refreshFailureTarget,
} from "@beep/cli-kit/internal/failureTarget";
import { Status } from "@beep/cli-kit/Status";
import { TerminalEnv } from "@beep/runtime-env";
import { AudienceShape } from "@beep/runtime-env/Audience";
import { assert, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { Document } from "@beep/cli-kit/Doc";
import type { FailureSettings } from "@beep/cli-kit/internal/failureTarget";

it.effect("refresh overloads dispatch omitted and undefined audiences to Effects and settings to a callable", () =>
  Effect.gen(function* () {
    const omitted: Effect.Effect<void> = refreshFailureTarget();
    const explicitUndefined: Effect.Effect<void> = refreshFailureTarget(undefined);
    const curry: (settings: FailureSettings.Encoded) => (audience?: AudienceShape) => Effect.Effect<void> =
      refreshFailureTarget;
    const curried = curry({ spans: "off" });
    assert.isTrue(Effect.isEffect(omitted));
    assert.isTrue(Effect.isEffect(explicitUndefined));
    assert.isFunction(curried);
    yield* omitted;
    yield* explicitUndefined;
    yield* curried();
    yield* curried(undefined);
    yield* curried(AudienceShape.make({ kind: "agent", source: "flag" }));
    yield* refreshFailureTarget(undefined, { spans: "off" });
  })
);

const services = Layer.mergeAll(CliTheme.layerTest(), TerminalEnv.layerTest(), CliLinks.layerTest("off"));
it.effect(
  "refresh builds without an audience service when an explicit shape is supplied and keeps recorded settings",
  () =>
    Effect.gen(function* () {
      yield* refreshFailureTarget();
      const context = yield* Layer.build(services);
      const cell = MutableRef.make<typeof fallbackTarget | undefined>(undefined);
      yield* Effect.gen(function* () {
        yield* refreshFailureTarget(AudienceShape.make({ kind: "agent", source: "flag" }), {
          displayPath: (path) => Str.replace("/root/", "")(path),
          stackFrames: "all",
          spans: "off",
          appModule: "/app/main.ts",
        });
        const first = yield* currentTarget;
        assert.strictEqual(first.ctx.audience, "agent");
        assert.strictEqual(first.ctx.displayPath("/root/a"), "a");
        yield* refreshFailureTarget(AudienceShape.make({ kind: "human", source: "flag" }));
        const second = yield* currentTarget;
        assert.strictEqual(second.ctx.audience, "human");
        assert.strictEqual(second.stackFrames, "all");
        assert.strictEqual(second.spans, "off");
        assert.strictEqual(second.appModule, "/app/main.ts");
        assert.strictEqual(second.ctx.displayPath("/root/a"), "a");
      }).pipe(Effect.provideContext(context), Effect.provideService(FailureTargetCell, cell));
      const empty = MutableRef.make<typeof fallbackTarget | undefined>(undefined);
      yield* refreshFailureTarget({})(undefined).pipe(
        Effect.provideContext(context),
        Effect.provideService(FailureTargetCell, empty)
      );
      assert.strictEqual(MutableRef.get(empty), undefined);
      const pipe1 = yield* currentTarget.pipe(Effect.provideContext(context));
      assert.strictEqual(pipe1, fallbackTarget);
      assert.strictEqual(fallbackTarget.ctx.paint("accent", "x"), "x");
      assert.strictEqual(fallbackTarget.ctx.link({ url: "/x" }, "x"), "x");
    })
);
const NamedInput = S.Struct({ name: S.String });
it.effect("status removal handles schema trees and empty reports", () =>
  Effect.gen(function* () {
    const error = yield* S.decodeUnknownEffect(NamedInput)({ name: 1 }).pipe(Effect.flip);
    const cause = Cause.fail(error);
    const withStatus = linesOf(cause, fallbackTarget);
    const withoutStatus = linesOf(fallbackTarget, false)(cause);
    assert.isAbove(withoutStatus.length, 0);
    assert.notDeepEqual(withStatus, withoutStatus);
    assert.deepStrictEqual(plainFailureLines(false)(cause), withoutStatus);
    assert.deepStrictEqual(linesOf(Cause.empty, fallbackTarget, false), []);
  })
);
it.effect("span settings distinguish missing, empty, folded and invalid configuration", () =>
  Effect.gen(function* () {
    for (const [raw, expected] of [
      ["", undefined],
      ["ALL", "all"],
      ["APP", "app"],
      ["OFF", "off"],
    ] as const) {
      const result = yield* readSpans("SPANS")(undefined).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ SPANS: raw }))
      );
      assert.deepStrictEqual(result, { spans: expected, invalid: undefined });
    }
    const invalid = yield* readSpans(undefined, "SPANS").pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ SPANS: "typo" }))
    );
    assert.strictEqual(invalid.invalid, "SPANS=typo is not a span setting (app|all|off); ignoring it");
  })
);

it.effect("custom failure documents remove a status without a spacer and keep unrelated blocks", () =>
  Effect.sync(() => {
    const custom = {
      [CliDoc]: (): Document => [
        Doc.heading(2, "custom"),
        Doc.paragraph(Doc.status(Status.core, "failure"), "tight"),
        Doc.paragraph(Doc.status(Status.core, "failure")),
        Doc.paragraph("ordinary"),
      ],
    };
    assert.deepStrictEqual(plainFailureLines(Cause.fail(custom), false), ["custom", "tight", "", "ordinary"]);
  })
);
