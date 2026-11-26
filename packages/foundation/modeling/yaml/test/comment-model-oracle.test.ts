// decision: comment-oracle-literal-parity
import { YamlAlias, YamlDocument, YamlMap, YamlScalar, YamlSeq } from "@beep/yaml";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type { YamlNode } from "@beep/yaml";

interface Comments {
  readonly comment?: string;
  readonly commentBefore?: string;
  readonly spaceBefore?: boolean;
}

const commentsOf = (node: YamlNode | null): Comments => {
  if (node === null) return {};
  return {
    ...(node.commentBefore !== undefined ? { commentBefore: node.commentBefore } : {}),
    ...(node.comment !== undefined ? { comment: node.comment } : {}),
    ...(node.spaceBefore !== undefined ? { spaceBefore: node.spaceBefore } : {}),
  };
};

const rootMap = (doc: YamlDocument): YamlMap => {
  assert.instanceOf(doc.contents, YamlMap);
  assert.ok(S.is(YamlMap)(doc.contents));
  return doc.contents;
};

const pairComments = (doc: YamlDocument, index = 0): { key: Comments; value: Comments } => {
  const pair = rootMap(doc).items[index];
  assert.isDefined(pair);
  return { key: commentsOf(pair.key), value: commentsOf(pair.value) };
};

const collectCommentedScalars = (node: YamlNode | null, found: YamlScalar[]): void => {
  if (node === null) return;
  if (S.is(YamlScalar)(node)) {
    if (node.comment !== undefined) found.push(node);
    return;
  }
  if (S.is(YamlSeq)(node)) for (const item of node.items) collectCommentedScalars(item, found);
  if (S.is(YamlMap)(node)) collectPairScalars(node, found);
};

const collectPairScalars = (node: YamlMap, found: YamlScalar[]): void => {
  for (const pair of node.items) {
    collectCommentedScalars(pair.key, found);
    collectCommentedScalars(pair.value, found);
  }
};

describe("node-level comment model — oracle contract (yaml@2.9.0)", () => {
  describe("the pair itself carries nothing", () => {
    it.effect("YamlPair has no comment fields at all", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("a: 1 # t\n# lead\nb: 2\n");
        for (const pair of rootMap(doc).items) {
          assert.notProperty(
            pair,
            "commentBefore",
            "comment fields live on the key and value NODES: on `YamlPair`, where the reference puts none, one pair slot against the reference's two independent node slots was the root of four recorded divergences (a relocated key-line comment, the alias drop, the multi-line complex-key drop and the explicit-key spelling)"
          );
          assert.notProperty(pair, "comment");
          assert.notProperty(pair, "spaceBefore");
        }
      })
    );
  });

  // decision: comments-on-nodes
  describe("attribution: which node owns which comment", () => {
    it.effect("a trailing comment belongs to the VALUE node", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("a: 1 # t\n");
        assert.deepStrictEqual(pairComments(doc), { key: {}, value: { comment: " t" } });
      })
    );

    it.effect("an own-line comment above a key belongs to the KEY node", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("a: 1\n# section\nb: 2\n");
        assert.deepStrictEqual(pairComments(doc, 1), { key: { commentBefore: " section" }, value: {} });
      })
    );

    it.effect("a blank line above the comment run sets spaceBefore on the KEY node", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("a: 1\n\n# section\nb: 2\n");
        assert.deepStrictEqual(pairComments(doc, 1), {
          key: { commentBefore: " section", spaceBefore: true },
          value: {},
        });
      })
    );

    it.effect("a key-line comment with the value below trails the KEY — a deliberate divergence", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("a: # kc\n  1\n");
        assert.deepStrictEqual(
          pairComments(doc),
          { key: { comment: " kc" }, value: {} },
          "the oracle folds this into the value's `commentBefore`, which makes `a: # kc` and `a:` + an own-line `# kc` above the value the same AST, so one of the two source shapes has to be rewritten on emit; attaching it to the KEY, whose line it was written on, keeps them distinct and lets both round-trip byte-intact"
        );

        const spilled = yield* YamlDocument.parse("a:\n  # kc\n  1\n");
        assert.deepStrictEqual(
          pairComments(spilled),
          { key: {}, value: { commentBefore: " kc" } },
          "the own-line form keeps its own line, and neither shape moves"
        );
      })
    );

    it.effect("a key-line comment on an ABSENT value lands on the key — the one placement divergence", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("a: # kc\nb: 2\n");
        assert.deepStrictEqual(pairComments(doc), { key: { comment: " kc" }, value: {} });
      })
    );
  });

  describe("aliases carry comments (the old blanket drop is gone)", () => {
    it.effect("a trailing comment on an alias value", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("a: &x 1\nb: *x # ac\n");
        const value = rootMap(doc).items[1]?.value;
        assert.instanceOf(value, YamlAlias);
        assert.ok(S.is(YamlAlias)(value));
        assert.deepStrictEqual(commentsOf(value), { comment: " ac" });
      })
    );

    it.effect("a leading comment on an alias value", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("a: &x 1\nb:\n  # lead\n  *x\n");
        const value = rootMap(doc).items[1]?.value;
        assert.instanceOf(value, YamlAlias);
        assert.ok(S.is(YamlAlias)(value));
        assert.deepStrictEqual(commentsOf(value), { commentBefore: " lead" });
      })
    );

    it.effect("a comment on an alias inside a sequence", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("a: &x 1\nb:\n  - *x # ac\n");
        const seq = rootMap(doc).items[1]?.value;
        assert.instanceOf(seq, YamlSeq);
        assert.ok(S.is(YamlSeq)(seq));
        const item = seq.items[0];
        assert.instanceOf(item, YamlAlias);
        assert.ok(S.is(YamlAlias)(item));
        assert.deepStrictEqual(commentsOf(item), { comment: " ac" });
      })
    );

    const aliasRoundtrips: ReadonlyArray<readonly [string, string]> = [
      ["trailing on a mapping value", "a: &x 1\nb: *x # ac\n"],
      ["leading on a mapping value", "a: &x 1\nb:\n  # lead\n  *x\n"],
      ["trailing on a sequence item, unindented under the default indentSequences", "a: &x 1\nb:\n- *x # ac\n"],
      ["leading on a sequence item, unindented under the default indentSequences", "a: &x 1\nb:\n# lead\n- *x\n"],
    ];
    for (const [name, source] of aliasRoundtrips) {
      it.effect(`re-emits an alias comment byte-intact: ${name}`, () =>
        Effect.gen(function* () {
          const doc = yield* YamlDocument.parse(source);
          const out = yield* doc.stringify();
          assert.strictEqual(
            out,
            source,
            "capture alone proves nothing: the fields existed on the node while three `instanceof YamlAlias` guards in the stringifier still skipped them, so every one of these round-tripped its comment straight out of existence; emission is the assertion that has teeth"
          );
          const again = yield* YamlDocument.parse(out);
          const stringify1 = yield* again.stringify();
          assert.strictEqual(stringify1, out);
        })
      );
    }
  });

  describe("complex keys keep their pair's trailing comment", () => {
    it.effect("a block-scalar key's pair comment lands on the value", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("? |\n  k\n: v # t\n");
        assert.deepStrictEqual(
          commentsOf(rootMap(doc).items[0]?.value ?? null),
          { comment: " t" },
          "previously dropped: a multi-line key has no line that can carry a `#`, and the single pair slot put the comment there; the value node has a line of its own"
        );
      })
    );

    it.effect("a sequence key's pair comment lands on the value", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("? - k\n: v # t\n");
        assert.deepStrictEqual(commentsOf(rootMap(doc).items[0]?.value ?? null), { comment: " t" });
      })
    );

    it.effect("a value's own leading comment stays on the value", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("? - k\n:\n  # lead\n  - v\n");
        assert.deepStrictEqual(commentsOf(rootMap(doc).items[0]?.value ?? null), { commentBefore: " lead" });
      })
    );
  });

  describe("flow collections attribute to their inner nodes", () => {
    it.effect("an own-line comment inside a flow map leads the inner KEY", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("a: {\n  # lead\n  b: 1,\n}\n");
        const inner = rootMap(doc).items[0]?.value;
        assert.instanceOf(inner, YamlMap);
        assert.ok(S.is(YamlMap)(inner));
        assert.deepStrictEqual(commentsOf(inner.items[0]?.key ?? null), { commentBefore: " lead" });
      })
    );

    it.effect("an own-line comment inside a flow seq leads the ITEM", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("a: [\n  # lead\n  1,\n]\n");
        const inner = rootMap(doc).items[0]?.value;
        assert.instanceOf(inner, YamlSeq);
        assert.ok(S.is(YamlSeq)(inner));
        assert.deepStrictEqual(commentsOf(inner.items[0] ?? null), { commentBefore: " lead" });
      })
    );

    it.effect("a trailing comment after a flow collection belongs to that collection", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("a: {b: 1} # t\n");
        assert.deepStrictEqual(commentsOf(rootMap(doc).items[0]?.value ?? null), { comment: " t" });
      })
    );
  });

  describe("document fields follow the reference naming and attribution", () => {
    it.effect("a header comment leads the FIRST KEY, not the document", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("# hdr\na: 1\n");
        assert.isUndefined(doc.commentBefore);
        assert.isUndefined(doc.comment);
        assert.deepStrictEqual(pairComments(doc), { key: { commentBefore: " hdr" }, value: {} });
      })
    );

    it.effect("a trailing block is the document's `comment` (was `commentAfter`)", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("# hdr\na: 1\n# tail\n");
        assert.strictEqual(doc.comment, " tail");
        assert.deepStrictEqual(pairComments(doc), { key: { commentBefore: " hdr" }, value: {} });
      })
    );

    it.effect("a comment after a `...` marker is the document's `comment` too", () =>
      Effect.gen(function* () {
        const doc = yield* YamlDocument.parse("a: 1\n...\n# tail\n");
        assert.strictEqual(doc.comment, " tail");
      })
    );
  });

  describe("block-scalar header comments live on the scalar, at every depth", () => {
    const headers: ReadonlyArray<readonly [string, string]> = [
      ["pair value", "a: | # hdr\n  body\n"],
      ["seq item", "- | # hdr\n  body\n"],
      ["explicit-key value", "? - k\n: | # hdr\n  body\n"],
      ["document root", "| # hdr\n  body\n"],
    ];
    for (const [name, source] of headers) {
      it.effect(`captures the header comment on the scalar: ${name}`, () =>
        Effect.gen(function* () {
          const doc = yield* YamlDocument.parse(source);
          const found: YamlScalar[] = [];
          collectCommentedScalars(doc.contents, found);
          assert.lengthOf(found, 1);
          assert.strictEqual(found[0]?.comment, " hdr");
        })
      );
    }
  });
});
