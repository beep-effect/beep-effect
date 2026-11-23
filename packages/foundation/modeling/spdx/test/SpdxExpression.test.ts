import { InvalidSpdxExpressionError, License } from "@beep/spdx/License";
import {
  AndNode,
  isValidExpression,
  LicenseNode,
  LicenseRefNode,
  OrNode,
  SpdxExpression,
  WithExceptionNode,
} from "@beep/spdx/SpdxExpression";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure, assertNone, assertSome, assertSuccess } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Exit from "effect/Exit";
import { identity } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { SpdxExpression as SpdxExpressionAst } from "@beep/spdx/SpdxExpression";

const UnknownJson = S.fromJsonString(S.Unknown);
const typedFailurePreservingTraceAnnotations = (
  error: InvalidSpdxExpressionError,
  cause: Cause.Cause<InvalidSpdxExpressionError>
): Cause.Cause<InvalidSpdxExpressionError> => Cause.annotate(Cause.fail(error), Cause.annotations(cause));

const KNOWN_LICENSES = ["MIT", "Apache-2.0", "BSD-3-Clause", "ISC", "GPL-2.0-or-later", "MPL-2.0"] as const;
const KNOWN_EXCEPTIONS = ["Classpath-exception-2.0", "Bison-exception-2.2", "GCC-exception-2.0"] as const;
const idstring = S.String.check(S.isPattern(/^[A-Za-z0-9.-]{1,12}$/));
const uniformChoiceOfArbitrariesSinceNativeUnionTakesSchemas = <A>(
  first: Arbitrary.Arbitrary<A>,
  ...rest: ReadonlyArray<Arbitrary.Arbitrary<A>>
): Arbitrary.Arbitrary<A> =>
  Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: rest.length }))).pipe(
    Arbitrary.flatMap((index) => (index === 0 ? first : (rest[index - 1] ?? first)))
  );
const licenseNode = Arbitrary.schema(S.Struct({ id: S.Literals(KNOWN_LICENSES), plus: S.Boolean })).pipe(
  Arbitrary.map(({ id, plus }) => LicenseNode.make({ id, plus }))
);
const licenseRefNode = Arbitrary.schema(S.Struct({ documentRef: S.optionalKey(idstring), ref: idstring })).pipe(
  Arbitrary.map((fields) => LicenseRefNode.make(fields))
);
const withExceptionNode = Arbitrary.all({
  license: uniformChoiceOfArbitrariesSinceNativeUnionTakesSchemas<LicenseNode | LicenseRefNode>(
    licenseNode,
    licenseRefNode
  ),
  exception: Arbitrary.schema(S.Literals(KNOWN_EXCEPTIONS)),
}).pipe(Arbitrary.map(({ license, exception }) => WithExceptionNode.make({ license, exception })));
const simpleExpression = uniformChoiceOfArbitrariesSinceNativeUnionTakesSchemas<SpdxExpressionAst>(
  licenseNode,
  licenseRefNode,
  withExceptionNode
);
const MAX_GENERATED_COMPOUND_NESTING = 4;
const expressionAt = (depth: number): Arbitrary.Arbitrary<SpdxExpressionAst> => {
  if (depth === 0) return simpleExpression;
  const operand = expressionAt(depth - 1);
  return uniformChoiceOfArbitrariesSinceNativeUnionTakesSchemas<SpdxExpressionAst>(
    simpleExpression,
    Arbitrary.all([operand, operand]).pipe(Arbitrary.map(([left, right]) => AndNode.make({ left, right }))),
    Arbitrary.all([operand, operand]).pipe(Arbitrary.map(([left, right]) => OrNode.make({ left, right })))
  );
};
const knownIdExpressionArb = expressionAt(MAX_GENERATED_COMPOUND_NESTING);

const VALID = [
  "MIT",
  "Apache-2.0+",
  "(MIT OR Apache-2.0)",
  "MIT AND BSD-3-Clause",
  "GPL-2.0-or-later WITH Bison-exception-2.2",
  "LicenseRef-Proprietary",
  "DocumentRef-spdx-tool-1.2:LicenseRef-MIT-Style-2",
  "LicenseRef-Foo WITH Bison-exception-2.2",
  "DocumentRef-spdx-tool-1.2:LicenseRef-MIT-Style-2 WITH Classpath-exception-2.0",
  "MIT and BSD-3-Clause",
  "(MIT AND (Apache-2.0 OR BSD-3-Clause))",
];
const REFERENCE_NEVER_CARRIES_PLUS = "LicenseRef-Foo+ WITH Bison-exception-2.2";
const INVALID = [
  "NOPE-1.0",
  "MIT AND",
  "(MIT",
  "MIT OR OR Apache-2.0",
  "",
  "LicenseRef-Foo WITH Bogus-exception",
  REFERENCE_NEVER_CARRIES_PLUS,
];

describe("SpdxExpression", () => {
  for (const s of VALID) {
    it.effect(`parses ${s}`, () =>
      Effect.gen(function* () {
        const expr = yield* SpdxExpression.parse(s);
        assert.isDefined(expr);
      })
    );
    it(`validates ${s} synchronously`, () => assert.isTrue(isValidExpression(s)));
  }
  for (const s of INVALID) {
    it.effect(
      `rejects ${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(s), identity)} as a typed error`,
      () =>
        Effect.gen(function* () {
          const exit = yield* Effect.exit(SpdxExpression.parse(s));
          const cause = exit.pipe(Exit.filterCause, Result.getOrThrow);
          assertExitFailure(
            exit,
            typedFailurePreservingTraceAnnotations(InvalidSpdxExpressionError.make({ input: s }), cause)
          );
          assert.isFalse(Cause.hasDies(exit.cause), "a typed failure, not a defect");
        })
    );
    it(`invalidates ${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(s), identity)} synchronously`, () =>
      assert.isFalse(isValidExpression(s)));
  }
  it.effect("fails invalid input with the typed InvalidSpdxExpressionError", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(SpdxExpression.parse("NOPE-1.0"));
      assert.instanceOf(error, InvalidSpdxExpressionError);
      assert.strictEqual(error.input, "NOPE-1.0");
    })
  );
  it.effect("round-trips through toString", () =>
    Effect.gen(function* () {
      const expr = yield* SpdxExpression.parse("(MIT OR Apache-2.0)");
      assert.strictEqual(expr.toString(), "(MIT OR Apache-2.0)");
    })
  );
  it.effect("FromString decodes a string to the AST that re-serializes to canonical form", () =>
    Effect.gen(function* () {
      const ast = yield* S.decodeEffect(SpdxExpression.FromString)("(MIT OR Apache-2.0)");
      assert.strictEqual(ast._tag, "Or");
      assert.strictEqual(ast.toString(), "(MIT OR Apache-2.0)", "the decoded AST is the tree the sync parser produces");
    })
  );
  for (const s of [
    "(MIT OR Apache-2.0)",
    "Apache-2.0+",
    "GPL-2.0-or-later WITH Bison-exception-2.2",
    "LicenseRef-Foo WITH Bison-exception-2.2",
    "DocumentRef-spdx-tool-1.2:LicenseRef-MIT-Style-2 WITH Classpath-exception-2.0",
    "(MIT AND (Apache-2.0 OR BSD-3-Clause))",
  ]) {
    it.effect(`FromString encode round-trips ${s} to its canonical string, never "[object Object]"`, () =>
      Effect.gen(function* () {
        const ast = yield* S.decodeEffect(SpdxExpression.FromString)(s);
        const encoded = yield* S.encodeEffect(SpdxExpression.FromString)(ast);
        assert.strictEqual(encoded, s, "encode emits the canonical string the input already is");
        const reAst = yield* S.decodeEffect(SpdxExpression.FromString)(encoded);
        const reEncoded = yield* S.encodeEffect(SpdxExpression.FromString)(reAst);
        assert.strictEqual(reEncoded, encoded, "decode∘encode is identity");
      })
    );
  }
  it.effect("binds WITH to a LicenseRef reference", () =>
    Effect.gen(function* () {
      const expr = yield* SpdxExpression.parse("LicenseRef-Foo WITH Bison-exception-2.2");
      assert.instanceOf(expr, WithExceptionNode);
      if (S.is(WithExceptionNode)(expr)) {
        assert.instanceOf(expr.license, LicenseRefNode);
        assert.strictEqual(expr.exception, "Bison-exception-2.2");
      }
      assert.strictEqual(expr.toString(), "LicenseRef-Foo WITH Bison-exception-2.2");
    })
  );
  it.effect("preserves the + marker", () =>
    Effect.gen(function* () {
      const expr = yield* SpdxExpression.parse("Apache-2.0+");
      assert.strictEqual(expr.toString(), "Apache-2.0+");
    })
  );
  it.effect("does not overflow on deeply nested input", () =>
    Effect.gen(function* () {
      const deep = `${Str.repeat(5000)("(")}MIT${Str.repeat(5000)(")")}`;
      const exit = yield* Effect.exit(SpdxExpression.parse(deep));
      const cause = exit.pipe(Exit.filterCause, Result.getOrThrow);
      assertExitFailure(
        exit,
        typedFailurePreservingTraceAnnotations(InvalidSpdxExpressionError.make({ input: deep }), cause)
      );
      assert.isFalse(Cause.hasDies(exit.cause), "caps out as a typed failure, never a RangeError defect");
      assert.isTrue(Cause.hasFails(exit.cause));
    })
  );
  it.effect("caps a long AND chain as a typed failure, not a defect", () =>
    Effect.gen(function* () {
      const chain = A.join(A.replicate("MIT", 6000), " AND ");
      const exit = yield* Effect.exit(SpdxExpression.parse(chain));
      const cause = exit.pipe(Exit.filterCause, Result.getOrThrow);
      assertExitFailure(
        exit,
        typedFailurePreservingTraceAnnotations(InvalidSpdxExpressionError.make({ input: chain }), cause)
      );
      assert.isFalse(Cause.hasDies(exit.cause));
    })
  );
  it.effect.prop(
    "FromString round-trips decode(encode(e)) on ASTs over known ids, since schema-derived leaf strings are not grammatical",
    [knownIdExpressionArb],
    ([e]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeUnknownEffect(SpdxExpression.FromString)(e);
        const decoded = yield* S.decodeEffect(SpdxExpression.FromString)(encoded);
        assert.isTrue(Equal.equals(decoded, e), `expected ${decoded.toString()} to equal ${e.toString()}`);
        const reEncoded = yield* S.encodeUnknownEffect(SpdxExpression.FromString)(decoded);
        assert.strictEqual(reEncoded, encoded);
      })
  );
});

describe("SpdxExpression — collapsing an expression to licenses", () => {
  const parse = (input: string) => {
    const result = SpdxExpression.parseResult(input);
    assertSuccess(result, Result.getOrThrow(result));
    return result.success;
  };

  it("a simple license is its own primary", () => {
    assertSome(SpdxExpression.primaryLicense(parse("MIT")), License.of("MIT"));
  });

  it("OR takes the leftmost — the choice the author wrote first", () => {
    assertSome(SpdxExpression.primaryLicense(parse("MIT OR Apache-2.0")), License.of("MIT"));
    assertSome(SpdxExpression.primaryLicense(parse("(GPL-3.0-only OR MIT) OR Apache-2.0")), License.of("GPL-3.0-only"));
  });

  it("AND has no single license, and says so rather than dropping a term", () => {
    assertNone(SpdxExpression.primaryLicense(parse("MIT AND Apache-2.0")));
  });

  it("an OR whose left branch is an AND has no primary either: recursion does not sidestep the AND rule", () => {
    assertNone(SpdxExpression.primaryLicense(parse("(MIT AND Apache-2.0) OR GPL-3.0-only")));
  });

  it("an exception qualifies its license, and the license is the primary", () => {
    assertSome(
      SpdxExpression.primaryLicense(parse("GPL-2.0-only WITH Bison-exception-2.2")),
      License.of("GPL-2.0-only")
    );
  });

  it("the `+` marker qualifies a catalog entry, it does not name another", () => {
    assertSome(SpdxExpression.primaryLicense(parse("AFL-2.0+")), License.of("AFL-2.0"));
  });

  it("a LicenseRef resolves as a reference", () => {
    assertSome(SpdxExpression.primaryLicense(parse("LicenseRef-Proprietary")), License.of("LicenseRef-Proprietary"));
    assertSome(
      SpdxExpression.primaryLicense(parse("DocumentRef-spdx-tool:LicenseRef-Proprietary")),
      License.of("DocumentRef-spdx-tool:LicenseRef-Proprietary")
    );
  });

  it("a deprecated id keeps its deprecated flag through the collapse", () => {
    const primary = SpdxExpression.primaryLicense(parse("GPL-3.0"));
    assertSome(primary, License.of("GPL-3.0", true));
    assert.strictEqual(primary.value.id, "GPL-3.0");
    assert.isTrue(primary.value.deprecated);
  });

  it("licensesOf keeps every term, in written order", () => {
    assert.deepStrictEqual(
      A.map(SpdxExpression.licensesOf(parse("MIT OR Apache-2.0")), (license) => license.id),
      ["MIT", "Apache-2.0"]
    );
    assert.deepStrictEqual(
      A.map(SpdxExpression.licensesOf(parse("MIT AND Apache-2.0")), (license) => license.id),
      ["MIT", "Apache-2.0"]
    );
  });

  it("licensesOf answers where primaryLicense declines", () => {
    const expr = parse("MIT AND Apache-2.0");
    assertNone(SpdxExpression.primaryLicense(expr));
    assert.strictEqual(SpdxExpression.licensesOf(expr).length, 2);
  });

  it("licensesOf flattens nesting left to right", () => {
    assert.deepStrictEqual(
      A.map(
        SpdxExpression.licensesOf(parse("(MIT OR Apache-2.0) AND (GPL-3.0-only WITH Bison-exception-2.2)")),
        (license) => license.id
      ),
      ["MIT", "Apache-2.0", "GPL-3.0-only"]
    );
  });

  it("licensesOf de-duplicates by identifier, keeping first appearance", () => {
    assert.deepStrictEqual(
      A.map(SpdxExpression.licensesOf(parse("(Apache-2.0 OR MIT) AND MIT")), (license) => license.id),
      ["Apache-2.0", "MIT"]
    );
  });

  it("licensesOf skips a hand-built leaf whose id resolves to no license", () => {
    assert.deepStrictEqual(SpdxExpression.licensesOf(LicenseNode.make({ id: "NOT-A-LICENSE", plus: false })), []);
  });

  it("licensesOf of a simple license is that one license", () => {
    assert.deepStrictEqual(
      A.map(SpdxExpression.licensesOf(parse("MIT")), (license) => license.id),
      ["MIT"]
    );
  });
});
