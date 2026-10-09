import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { assertSuccess } from "@effect/vitest/utils";
import { Yaml } from "../../effected/yaml/Yaml.ts";
import { YamlDocument } from "../../effected/yaml/YamlDocument.ts";
import {
  AliasExpansionBudgetExceeded, CollectionStyle, QuoteCompat, QuoteStyle, ScalarChomp, ScalarStyle,
  YamlAlias, YamlNode, YamlScalar, YamlSeq, nodeToJsValue,
} from "../../effected/yaml/YamlNode.ts";
import {
  buildAnchorMap, checkAnchorOnAlias, getAliasName, getAnchorName, getNodeValue, makeAlias,
  registerAnchor, scanName,
} from "../../effected/yaml/internal/composer/anchors.ts";
import {
  NodeMeta, clearMeta, commentProps, createState, enterNesting, exitNesting,
  hasNonWhitespaceBeforeOnLine, lineCol, lineIndentColumn, sameLine,
} from "../../effected/yaml/internal/composer/state.ts";
import { composeFlowMap, composeFlowSeq } from "../../effected/yaml/internal/composer/flow.ts";
import { resolveTagHandle, validateTagHandlesInDocument } from "../../effected/yaml/internal/composer/tags.ts";
import type { CstNode } from "../../effected/yaml/internal/cst.ts";

const flow = { composeFlowMap, composeFlowSeq };
const isBudgetExceeded = S.is(AliasExpansionBudgetExceeded);
const duplicateAnchors = "first: &x 1\nbefore: *x\nsecond: &x 2\nafter: *x\n";
const duplicateValues = { first: 1, before: 1, second: 2, after: 2 };

function budgetTree(): YamlSeq {
  return YamlSeq.make({
    items: [
      YamlScalar.make({ value: 1, anchor: "x", style: "plain", offset: 0, length: 1 }),
      YamlAlias.make({ name: "x", offset: 2, length: 2 }),
    ],
    style: "flow", offset: 0, length: 4,
  });
}

describe("g1 core regressions", () => {
  it("strips lexer comments while preserving literal and folded block content", () => {
    for (const style of ["|", ">", "|-"]) {
      const source = `a: ${style} # header\n  # literal content\n# trailing\n`;
      const stripped = `a: ${style} \n  # literal content\n\n`;
      assert.strictEqual(Yaml.stripComments(source), stripped);
      assert.isTrue(Yaml.equals(source, stripped));
    }
  });

  it("strips comments after plain apostrophes without stripping scalar hashes", () => {
    assert.strictEqual(Yaml.stripComments("a: bob's # comment\n"), "a: bob's \n");
    assert.strictEqual(Yaml.stripComments("a: bob's#data # comment\n"), "a: bob's#data \n");
    assert.strictEqual(Yaml.stripComments("a: 'quoted # data' # comment\n"), "a: 'quoted # data' \n");
  });

  it("replaces only comment spans and preserves CRLF offsets", () => {
    const source = "a: | # header\r\n  # literal\r\nb: bob's # end\r\n";
    const expected = "a: |         \r\n  # literal\r\nb: bob's      \r\n";
    const stripped = Yaml.stripComments(source, " ");
    assert.strictEqual(stripped, expected);
    assert.strictEqual(stripped.length, source.length);
  });

  it("preserves scalar and container equality cases without native type comparison", () => {
    assert.isTrue(Yaml.equalsValue(".nan", Number.NaN));
    assert.isTrue(Yaml.equals("{ a: 1, b: 2 }", "{ b: 2, a: 1 }"));
    assert.isTrue(Yaml.equalsValue("[1, 2]", [1, 2]));
    assert.isFalse(Yaml.equalsValue("1", "1"));
    assert.isFalse(Yaml.equalsValue("true", 1));
    assert.isFalse(Yaml.equalsValue("[]", {}));
    assert.isFalse(Yaml.equalsValue("{}", []));
    assert.isFalse(Yaml.equalsValue("null", {}));
  });

  it.effect("resolves sequential duplicate anchors through facade, stream and document extraction", () =>
    Effect.gen(function* () {
    assertSuccess(Yaml.parseResult(duplicateAnchors), duplicateValues);
    assertSuccess(Yaml.parseAllResult(duplicateAnchors), [duplicateValues]);
    const document = yield* YamlDocument.parse(duplicateAnchors);
    assert.deepStrictEqual(document.toValue(), duplicateValues);
    const anchors = MutableHashMap.empty<string, YamlNode>();
    assert.deepStrictEqual(getNodeValue(document.contents, anchors), duplicateValues);
    const resolved = anchors.pipe(MutableHashMap.get("x"), O.getOrThrow);
    assert.ok(S.is(YamlScalar)(resolved));
    assert.deepStrictEqual(getNodeValue(document.contents, buildAnchorMap(document.contents)), duplicateValues);
    assert.isTrue(Yaml.equalsValue(duplicateAnchors, duplicateValues));
    }),
  );

  it("keeps null and unresolved alias extraction unchanged", () => {
    assert.isNull(getNodeValue(null));
    assert.isNull(getNodeValue(YamlAlias.make({ name: "missing", offset: 0, length: 8 })));
    assert.strictEqual(MutableHashMap.size(buildAnchorMap(null)), 0);
  });

  it.effect("keeps alias budget errors schema-backed, named, catchable and codec-stable", () =>
    Effect.gen(function* () {
      const error = AliasExpansionBudgetExceeded.make({ message: "Alias expansion exceeded budget of 0 nodes" });
      assert.isTrue(isBudgetExceeded(error));
      assert.strictEqual(error.name, "AliasExpansionBudgetExceeded");
      assert.strictEqual(error._tag, "AliasExpansionBudgetExceeded");
      const caught = yield* Effect.fail(error).pipe(Effect.catchTag("AliasExpansionBudgetExceeded", Effect.succeed));
      assert.strictEqual(caught, error);
      const encoded = yield* S.encodeEffect(AliasExpansionBudgetExceeded)(error);
      const decoded = yield* S.decodeEffect(AliasExpansionBudgetExceeded)(encoded);
      assert.strictEqual(decoded.name, error.name);
      assert.strictEqual(decoded.message, error.message);

    }),
  );

  it("throws the schema-backed budget error at the extraction boundary", () => {
    const message = "Alias expansion exceeded budget of 0 nodes";
    assert.throws(() => nodeToJsValue(budgetTree(), MutableHashMap.empty(), -1), message);
    try {
      nodeToJsValue(budgetTree(), MutableHashMap.empty(), -1);
      assert.fail("alias expansion must exhaust the zero-node budget");
    } catch (defect) {
      assert.ok(isBudgetExceeded(defect));
      assert.strictEqual(defect.message, message);
    }
  });

  it("maps alias expansion failures to facade diagnostics and malformed equality", () => {
    const lines = ["a1: &a1 [x, x, x, x, x, x, x, x, x, x]"];
    for (let i = 2; i <= 8; i++) lines.push(`a${i}: &a${i} [${A.join(A.replicate(`*a${i - 1}`, 10), ", ")}]`);
    lines.push("top: *a8");
    const bomb = A.join(lines, "\n");
    const result = Yaml.parseResult(bomb);
    assert.ok(result._tag === "Failure");
    assert.strictEqual(result.failure.diagnostics[0]?.code, "AliasCountExceeded");
    assert.strictEqual(result.failure.diagnostics[0]?.message, "Alias expansion exceeded budget of 1010000 nodes");
    assert.isFalse(Yaml.equals(bomb, bomb));
  });

  it("retains named literal vocabulary and recursive schema identity", () => {
    assert.isTrue(S.is(ScalarStyle)("block-literal"));
    assert.isTrue(S.is(CollectionStyle)("flow"));
    assert.isTrue(S.is(QuoteStyle)("double"));
    assert.isTrue(S.is(QuoteCompat)("yaml-1.1"));
    assert.isTrue(S.is(ScalarChomp)("keep"));
    assert.isTrue(ScalarStyle.is.plain("plain"));
    assert.strictEqual(ScalarStyle.Enum.plain, "plain");
    assert.isDefined(YamlNode.ast.annotations?.identifier);
  });

  it.effect("derives writable optional metadata and keeps omitted comment fields omitted", () =>
    Effect.gen(function* () {
      const meta: NodeMeta = yield* S.decodeEffect(NodeMeta)({ anchor: "x", tag: "!!str" });
      meta.comment = "comment";
      clearMeta(meta);
      assert.deepStrictEqual(meta, {});
      assert.deepStrictEqual(commentProps({}), {});
      assert.deepStrictEqual(commentProps({ comment: "", commentBefore: "before", spaceBefore: false }), {
        comment: "", commentBefore: "before", spaceBefore: false,
      });
    }),
  );

  it("calls restored composer helpers directly with upstream optional defaults", () => {
    const state = createState("&x *x", flow);
    const anchor: CstNode = { type: "anchor", offset: 0, length: 2, source: "&x" };
    const alias: CstNode = { type: "alias", offset: 3, length: 2, source: "*x" };
    const scalar = YamlScalar.make({ value: 1, style: "plain", offset: 0, length: 1 });
    assert.strictEqual(state.options.maxAliasCount, 100);
    assert.strictEqual(createState("", flow, { maxAliasCount: 3 }).options.maxAliasCount, 3);
    assert.strictEqual(getAnchorName(anchor, state.text), "x");
    assert.strictEqual(getAliasName(alias, state.text), "x");
    assert.strictEqual(scanName("name,next", 0), "name");
    registerAnchor(scalar, "x", state, 0);
    assert.strictEqual(makeAlias(alias, state).name, "x");
    checkAnchorOnAlias({}, alias, state);
    assert.strictEqual(state.errors.length, 0);
    assert.isTrue(enterNesting(state, alias));
    exitNesting(state);
    assert.strictEqual(state.depth, 0);
    assert.deepStrictEqual(lineCol("a\nb", 2), { line: 1, column: 0 });
    assert.isTrue(sameLine("abc", 0, 2));
    assert.isFalse(sameLine("a\nb", 0, 2));
    assert.isTrue(hasNonWhitespaceBeforeOnLine("x y", 2));
    assert.strictEqual(lineIndentColumn("a\n  b", 4), 2);
    assert.strictEqual(resolveTagHandle("!!int", state), "tag:yaml.org,2002:int");
  });

  it("decodes equivalent named, secondary and primary tag suffixes before resolution", () => {
    for (const [prefix, tag] of [["%TAG !e! tag:yaml.org,2002:\n---\n", "!e!"], ["", "!!"], ["%TAG ! tag:yaml.org,2002:\n---\n", "!"]]) {
      assertSuccess(Yaml.parseResult(`${prefix}${tag}%69nt 123\n`), 123);
      assertSuccess(Yaml.parseResult(`${prefix}${tag}int 123\n`), 123);
    }
    const state = createState("", flow);
    assert.strictEqual(resolveTagHandle("!caf%C3%A9", state), "!café");
  });

  it("reports positioned composer diagnostics for malformed tag encodings", () => {
    for (const suffix of ["%", "%GG", "%C3%28"]) {
      const tag = `!!${suffix}`;
      const source = `a: ${tag} 123\n`;
      const result = Yaml.parseResult(source);
      assert.ok(result._tag === "Failure");
      const diagnostic = A.findFirst(result.failure.diagnostics, (d) => Str.includes("Malformed percent encoding")(d.message));
      assert.ok(O.isSome(diagnostic));
      assert.strictEqual(diagnostic.value.offset, 3);
      assert.strictEqual(diagnostic.value.length, tag.length);
      assert.strictEqual(diagnostic.value.code, "UnresolvedTag");
    }
  });
  it("positions repeated malformed collection tags through the document CST validator", () => {
    const source = "a: !!% [1]\nb: !!% [2]\n";
    const state = createState(source, flow);
    const cst: CstNode = {
      type: "document", offset: 0, length: source.length, source,
      children: [
        { type: "tag", offset: 3, length: 3, source: "!!%" },
        { type: "tag", offset: 14, length: 3, source: "!!%" },
      ],
    };
    validateTagHandlesInDocument(cst, state);
    assert.strictEqual(state.errors.length, 2);
    for (const offset of [3, 14]) {
      const diagnostic = A.findFirst(state.errors, (error) => error.offset === offset);
      assert.ok(O.isSome(diagnostic));
      assert.strictEqual(diagnostic.value.length, 3);
      assert.strictEqual(diagnostic.value.code, "UnresolvedTag");
      assert.strictEqual(diagnostic.value.message, "Malformed percent encoding in tag !!%");
    }
  });

});
