import { assert, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";
import * as S from "effect/Schema";
import { TerminalEnv } from "../../../effected/env/index.ts";
import { CliDoc } from "../../../effected/cli/CliFailure.ts";
import { Doc } from "../../../effected/cli/Doc.ts";
import type { Document } from "../../../effected/cli/Doc.ts";
import { Status } from "../../../effected/cli/Status.ts";
import { CliTheme } from "../../../effected/cli/CliTheme.ts";
import { CliLinks } from "../../../effected/cli/CliLinks.ts";
import { FailureTargetCell, currentTarget, fallbackTarget, refreshFailureTarget, linesOf, plainFailureLines, readSpans } from "../../../effected/cli/internal/failureTarget.ts";

const services = Layer.mergeAll(CliTheme.layerTest(), TerminalEnv.layerTest(), CliLinks.layerTest("off"));
it.effect("refresh builds without an audience service when an explicit shape is supplied and keeps recorded settings", () => Effect.gen(function* () {
  yield* refreshFailureTarget();
  const context = yield* Layer.build(services);
  const cell = MutableRef.make<typeof fallbackTarget | undefined>(undefined);
  yield* Effect.gen(function* () {
    yield* refreshFailureTarget({ kind: "agent", source: "flag" }, { displayPath: (path) => path.replace("/root/", ""), stackFrames: "all", spans: "off", appModule: "/app/main.ts" });
    const first = yield* currentTarget;
    assert.strictEqual(first.ctx.audience, "agent");
    assert.strictEqual(first.ctx.displayPath("/root/a"), "a");
    yield* refreshFailureTarget({ kind: "human", source: "flag" });
    const second = yield* currentTarget;
    assert.strictEqual(second.ctx.audience, "human");
    assert.strictEqual(second.stackFrames, "all");
    assert.strictEqual(second.spans, "off");
    assert.strictEqual(second.appModule, "/app/main.ts");
    assert.strictEqual(second.ctx.displayPath("/root/a"), "a");
  }).pipe(Effect.provideContext(context), Effect.provideService(FailureTargetCell, cell));
  const empty = MutableRef.make<typeof fallbackTarget | undefined>(undefined);
  yield* refreshFailureTarget({})(undefined).pipe(Effect.provideContext(context), Effect.provideService(FailureTargetCell, empty));
  assert.strictEqual(MutableRef.get(empty), undefined);
  assert.strictEqual(yield* currentTarget.pipe(Effect.provideContext(context)), fallbackTarget);
  assert.strictEqual(fallbackTarget.ctx.paint("accent", "x"), "x");
  assert.strictEqual(fallbackTarget.ctx.link({ url: "/x" }, "x"), "x");
}));
it.effect("status removal handles schema trees and empty reports", () => Effect.gen(function* () {
  const error = yield* S.decodeUnknownEffect(S.Struct({ name: S.String }))({ name: 1 }).pipe(Effect.flip);
  const cause = Cause.fail(error);
  const withStatus = linesOf(cause, fallbackTarget);
  const withoutStatus = linesOf(fallbackTarget, false)(cause);
  assert.isAbove(withoutStatus.length, 0);
  assert.notDeepEqual(withStatus, withoutStatus);
  assert.deepStrictEqual(plainFailureLines(false)(cause), withoutStatus);
  assert.deepStrictEqual(linesOf(Cause.empty, fallbackTarget, false), []);
}));
it.effect("span settings distinguish missing, empty, folded and invalid configuration", () => Effect.gen(function* () {
  for (const [raw, expected] of [["", undefined], ["ALL", "all"], ["APP", "app"], ["OFF", "off"]] as const) {
    const result = yield* readSpans("SPANS")(undefined).pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ SPANS: raw })));
    assert.deepStrictEqual(result, { spans: expected, invalid: undefined });
  }
  const invalid = yield* readSpans(undefined, "SPANS").pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ SPANS: "typo" })));
  assert.strictEqual(invalid.invalid, "SPANS=typo is not a span setting (app|all|off); ignoring it");
}));

it.effect("custom failure documents remove a status without a spacer and keep unrelated blocks", () => Effect.sync(() => {
  const custom = {
    [CliDoc]: (): Document => [
      Doc.heading(2, "custom"),
      Doc.paragraph(Doc.status(Status.core, "failure"), "tight"),
      Doc.paragraph(Doc.status(Status.core, "failure")),
      Doc.paragraph("ordinary"),
    ],
  };
  assert.deepStrictEqual(plainFailureLines(Cause.fail(custom), false), ["custom", "tight", "", "ordinary"]);
}));
