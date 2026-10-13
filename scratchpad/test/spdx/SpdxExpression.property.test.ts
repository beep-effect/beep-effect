import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertSuccess, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as S from "effect/Schema";
import { AndNode, LicenseNode, LicenseRefNode, OrNode, SpdxExpression, WithExceptionNode } from "../../effected/spdx/SpdxExpression.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(`${name}: decode(encode(x)) equals x without failure`, [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assertTrue(S.toEquivalence(schema)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

// The AST field schemas deliberately accept strings outside the parser domain.
// Preserve arbitrary tree shapes, plus flags and optional scope presence while
// projecting identifiers onto SPDX grammar/catalog members for string fidelity.
const validTree: (node: SpdxExpression) => SpdxExpression = Match.type<SpdxExpression>().pipe(
  Match.tagsExhaustive({
    License: (node) => LicenseNode.make({ id: node.id.length % 2 === 0 ? "MIT" : "Apache-2.0", plus: node.plus }),
    LicenseRef: (node) => LicenseRefNode.make(node.documentRef === undefined
      ? { ref: `custom-${node.ref.length}` }
      : { ref: `custom-${node.ref.length}`, documentRef: `doc-${node.documentRef.length}` }),
    WithException: (node) => WithExceptionNode.make({
      license: node.license._tag === "License"
        ? LicenseNode.make({ id: "GPL-2.0-only", plus: node.license.plus })
        : LicenseRefNode.make(node.license.documentRef === undefined
          ? { ref: `custom-${node.license.ref.length}` }
          : { ref: `custom-${node.license.ref.length}`, documentRef: `doc-${node.license.documentRef.length}` }),
      exception: node.exception.length % 2 === 0 ? "Classpath-exception-2.0" : "Nokia-Qt-exception-1.1",
    }),
    And: (node) => AndNode.make({ left: validTree(node.left), right: validTree(node.right) }),
    Or: (node) => OrNode.make({ left: validTree(node.left), right: validTree(node.right) }),
  }),
);

describe("SpdxExpression property floor", () => {
  roundTrips("LicenseNode", LicenseNode);
  roundTrips("LicenseRefNode", LicenseRefNode);
  roundTrips("WithExceptionNode", WithExceptionNode);
  roundTrips("AndNode", AndNode);
  roundTrips("OrNode", OrNode);
  roundTrips("SpdxExpression.Schema", SpdxExpression.Schema);

  it.effect.prop("FromString codec round-trips valid arbitrary expression trees without decode failure",
    [Arbitrary.schema(SpdxExpression.FromString).pipe(Arbitrary.map(validTree))], ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(SpdxExpression.FromString)(value);
        const decoded = yield* S.decodeEffect(SpdxExpression.FromString)(encoded);
        assertTrue(S.toEquivalence(SpdxExpression.Schema)(decoded, value));
        assert.strictEqual(yield* S.encodeEffect(SpdxExpression.FromString)(decoded), encoded);
      }), runs);

  it.effect.prop("every node formatter is idempotent and parsing preserves its AST and written license order",
    [Arbitrary.schema(SpdxExpression.Schema).pipe(Arbitrary.map(validTree))], ([value]) =>
      Effect.gen(function* () {
        const text = value.toString();
        const parsed = yield* SpdxExpression.parse(text);
        const reparsed = yield* SpdxExpression.parse(parsed.toString());
        assertTrue(S.toEquivalence(SpdxExpression.Schema)(parsed, value));
        assertTrue(S.toEquivalence(SpdxExpression.Schema)(reparsed, parsed));
        assert.strictEqual(reparsed.toString(), text);
        assertSuccess(SpdxExpression.parseResult(text), parsed);
        assert.deepStrictEqual(SpdxExpression.licensesOf(parsed), SpdxExpression.licensesOf(value));
      }), runs);
});
