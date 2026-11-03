import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { XdgBase, XdgBaseKind } from "@beep/xdg/XdgBase";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };

const Kind = Arbitrary.schema(XdgBaseKind);
const Text = Arbitrary.schema(S.String);

describe("XdgBase laws", () => {
  it.effect.prop(
    "XdgBaseKind: decode(encode(x)) equals x",
    [Kind],
    ([kind]) =>
      Effect.gen(function* () {
        const argument = S.decodeEffect(XdgBaseKind);
        const value2 = yield* S.encodeEffect(XdgBaseKind)(kind);
        const value1 = yield* argument(value2);
        assert.strictEqual(value1, kind);
      }),
    runs
  );

  it.effect.prop(
    "an absolute value wins verbatim over any HOME",
    [Kind, Text, Text],
    ([kind, body, home]) =>
      Effect.sync(() => {
        assertSome(XdgBase.resolve(kind, { value: `/${body}`, home }), `/${body}`);
      }),
    runs
  );

  it.effect.prop(
    "a relative value never appears in the answer",
    [Kind, Text, Text],
    ([kind, value, home]) =>
      Effect.sync(() => {
        const relative = Str.startsWith("/")(value) ? `.${value}` : value;
        const resolved = XdgBase.resolve(kind, { value: relative, home: `/${home}` });
        assertTrue(O.getOrUndefined(resolved) !== relative);
        assertTrue(O.isNone(resolved) || Str.startsWith("/")(resolved.value));
      }),
    runs
  );

  it.effect.prop(
    "without a valid value, the answer is the default under HOME or absent",
    [Kind, Text],
    ([kind, home]) =>
      Effect.sync(() => {
        const resolved = XdgBase.resolve(kind, { home: `/${home}` });
        if (kind === "runtime") {
          assertNone(resolved);
          return;
        }
        const dir = O.getOrThrow(resolved);
        assertTrue(Str.startsWith("/")(dir));
        // The default never carries an empty or `.` segment from HOME.
        assertTrue(!Str.includes("//")(dir) && !Str.includes("/./")(dir));
        // A relative HOME has no default at all.
        if (!Str.startsWith("/")(home)) assertNone(XdgBase.resolve(kind, { home }));
      }),
    runs
  );
});
