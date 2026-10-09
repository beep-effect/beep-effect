import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CliRuntime } from "../../effected/cli/CliRuntime.ts";
import { Fmt } from "../../effected/cli/Fmt.ts";

const runs = { arbitrary: fcRuns(100) };
const text = S.Array(S.Literals(["a", "b", "界", "%", " "])).pipe(Arbitrary.schema, Arbitrary.map(A.join("")));

it.effect.prop("default failure rendering preserves its message and stabilizes after sanitization", [text], ([message]) => Effect.sync(() => {
  const details = { cause: Cause.fail(message), isDefect: false };
  const rendered = CliRuntime.defaultRender(message, details, { status: false });
  const normalized = Str.trimEnd(message);
  assert.deepStrictEqual(rendered, normalized === "" ? [] : [normalized]);
  const parsed = typeof rendered === "string" ? rendered : A.join(rendered, "\n");
  assert.strictEqual(parsed, normalized);
  assert.deepStrictEqual(CliRuntime.defaultRender(parsed, { cause: Cause.fail(parsed), isDefect: false }, { status: false }), rendered);
  assert.deepStrictEqual(CliRuntime.defaultRender(Fmt.sanitize(message), { cause: Cause.fail(Fmt.sanitize(message)), isDefect: false }, { status: false }), rendered);
}), runs);
