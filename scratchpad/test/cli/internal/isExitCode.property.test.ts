import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const runs = { arbitrary: fcRuns(100) };
import { isExitCode } from "../../../effected/cli/internal/isExitCode.ts";
it.effect.prop("POSIX exit validation accepts exactly the finite byte integers", [Arbitrary.schema(S.Finite)], ([code]) => Effect.sync(() => {
  assert.strictEqual(isExitCode(code), Number.isFinite(code) && Math.floor(code) === code && code >= 0 && code < 256);
}), runs);
