import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { parse } from "../../../effected/spdx/internal/parser.ts";
import { SpdxExpression } from "../../../effected/spdx/SpdxExpression.ts";

const runs = { arbitrary: fcRuns(100) };
const ExpressionText = S.Struct({
  left: S.Literals(["MIT", "GPL-2.0-only+", "LicenseRef-local", "DocumentRef-doc:LicenseRef-local"]),
  right: S.Literals(["Apache-2.0", "BSD-3-Clause", "GPL-3.0-only WITH Classpath-exception-2.0"]),
  operator: S.Literals(["AND", "OR", "and", "or"]),
});

describe("raw SPDX parser property floor", () => {
  it.effect.prop("parse/stringify/parse fidelity and canonical format idempotence preserve precedence", [Arbitrary.schema(ExpressionText)], ([parts]) =>
    Effect.gen(function* () {
      const input = `${parts.left} ${parts.operator} ${parts.right} AND MIT`;
      const expression = yield* SpdxExpression.parse(input);
      const formatted = expression.toString();
      assert.deepStrictEqual(parse(formatted), parse(input));
      assert.strictEqual((yield* SpdxExpression.parse(formatted)).toString(), formatted);
      assert.deepStrictEqual(parse(`(${formatted})`), parse(input));
    }), runs);
});
