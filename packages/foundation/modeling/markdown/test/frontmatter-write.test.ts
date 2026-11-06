// Coverage for the typed frontmatter write seam (`MarkdownFrontmatter.set` /
// `setToString`) and the codecs' `encode` members.
//
// The write side mirrors the decode seam: schema-ENCODE the typed data,
// serialize the encoded value through the codec, then splice — one
// whole-block replacement when a capture of the codec's format exists, one
// offset-0 insert when the document has none. The empty-object rulings are
// pinned per codec: yaml encodes `{}` to the flow mapping body `{}\n`
// (deliberately not an empty body, which would round-trip as `null`), toml
// encodes `{}` to the empty body (the mirror of its empty-capture decode
// ruling), json encodes `{}` to `{}`.
//
// Property strings are newline-free for the same reason the decode-side
// round-trip constrains them: a multi-line string could legally place a bare
// fence-closer at column zero inside the block, which the capture scanner
// rightly treats as the closing fence — fence semantics, not a codec defect.

import { fcRuns } from "@beep/fc-runs";
import {
  FrontmatterEncodeError,
  FrontmatterFormatMismatchError,
  FrontmatterValidationError,
  MarkdownFrontmatter,
} from "@beep/markdown/Frontmatter";
import { JsonFrontmatter } from "@beep/markdown/JsonFrontmatter";
import { MarkdownParseOptions } from "@beep/markdown/Markdown";
import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import { MarkdownEdit } from "@beep/markdown/MarkdownEdit";
import { TomlFrontmatter } from "@beep/markdown/TomlFrontmatter";
import { YamlFrontmatter } from "@beep/markdown/YamlFrontmatter";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { deliberatelyInvalid } from "./support/deliberatelyInvalid.ts";

const withFrontmatter = MarkdownParseOptions.make({ frontmatter: true });
const parseDoc = MarkdownDocument.parse(withFrontmatter);

const Meta = S.Struct({
  title: S.String,
  count: S.Finite,
});

describe("codec encode", () => {
  it.effect("YamlFrontmatter.encode pins the empty object to the flow mapping body", () =>
    Effect.gen(function* () {
      const encoded1 = yield* YamlFrontmatter.encode({});
      assert.strictEqual(encoded1, "{}\n");
    })
  );

  it.effect("TomlFrontmatter.encode pins the empty object to the empty body", () =>
    Effect.gen(function* () {
      const encoded2 = yield* TomlFrontmatter.encode({});
      assert.strictEqual(encoded2, "");
    })
  );

  it.effect("JsonFrontmatter.encode pins the empty object to {}", () =>
    Effect.gen(function* () {
      const encoded3 = yield* JsonFrontmatter.encode({});
      assert.strictEqual(encoded3, "{}");
    })
  );

  it.effect("encode output is the body only — never fences", () =>
    Effect.gen(function* () {
      const yaml = yield* YamlFrontmatter.encode({ title: "Hi" });
      const toml = yield* TomlFrontmatter.encode({ title: "Hi" });
      const json = yield* JsonFrontmatter.encode({ title: "Hi" });
      assert.strictEqual(yaml, "title: Hi\n");
      assert.strictEqual(toml, 'title = "Hi"\n');
      assert.strictEqual(json, '{\n  "title": "Hi"\n}');
    })
  );

  it.effect("a serialization failure is typed with the format package's error preserved structurally", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(JsonFrontmatter.encode({ big: BigInt(1) }));
      assert.instanceOf(error, FrontmatterEncodeError);
      assert.strictEqual(error._tag, "FrontmatterEncodeError");
      assert.strictEqual(error.format, "json");
      // The cause is the jsonc engine's typed stringify error, never a string.
      const cause = error.cause;
      if (!P.isObject(cause)) assert.fail("expected a structured cause");
      assert.strictEqual(cause._tag, "JsoncStringifyError");
    })
  );
});

describe("MarkdownFrontmatter.set", () => {
  it.effect("replaces an existing yaml block with one edit and preserves the rest byte-identically", () =>
    Effect.gen(function* () {
      const source = "---\ntitle: Old\ncount: 1\n---\n\n# Body\n\ntext after the block\n";
      const document = yield* parseDoc(source);
      const node = document.frontmatter;
      assert.isDefined(node);
      const edits = yield* MarkdownFrontmatter.set(Meta, YamlFrontmatter)(document, { title: "New", count: 2 });
      assert.strictEqual(edits.length, 1);
      assert.strictEqual(edits[0]?.offset, 0);
      const updated = MarkdownEdit.applyAll(source, edits);
      // Everything after the closing fence survives byte-identical.
      assert.isTrue(Str.endsWith(Str.slice(node?.position.end.offset ?? 0)(source))(updated));
      // The re-parsed document decodes the new data with the same tree shape.
      const reparsed = yield* parseDoc(updated);
      const data = yield* MarkdownFrontmatter.schema(Meta, YamlFrontmatter)(reparsed);
      assert.deepStrictEqual(data, { title: "New", count: 2 });
      assert.deepStrictEqual(
        A.map(reparsed.root.children, (child) => child.type),
        A.map(document.root.children, (child) => child.type)
      );
    })
  );

  it.effect("rewrites a block with padded fences to canonical fences in every format", () =>
    Effect.gen(function* () {
      for (const [source, codec, expected] of [
        [
          "--- \ntitle: Old\ncount: 1\n---\t\n\n# Body\n",
          YamlFrontmatter,
          "---\ntitle: New\ncount: 2\n---\n\n# Body\n",
        ],
        [
          '+++\t\ntitle = "Old"\ncount = 1\n+++ \n\n# Body\n',
          TomlFrontmatter,
          '+++\ntitle = "New"\ncount = 2\n+++\n\n# Body\n',
        ],
        [
          '---json \n{"title":"Old","count":1}\n---  \n\n# Body\n',
          JsonFrontmatter,
          '---json\n{\n  "title": "New",\n  "count": 2\n}\n---\n\n# Body\n',
        ],
      ] as const) {
        const document = yield* parseDoc(source);
        assert.isDefined(document.frontmatter, source);
        const updated = yield* MarkdownFrontmatter.setToString(Meta, codec)(document, { title: "New", count: 2 });
        assert.strictEqual(updated, expected, source);
      }
    })
  );

  it.effect("inserts a fenced block at offset 0 with a blank line when the document has none", () =>
    Effect.gen(function* () {
      const source = "# Body\n\ntext\n";
      const document = yield* parseDoc(source);
      const edits = yield* MarkdownFrontmatter.set(Meta, TomlFrontmatter)(document, { title: "Hi", count: 3 });
      assert.strictEqual(edits.length, 1);
      assert.strictEqual(edits[0]?.offset, 0);
      assert.strictEqual(edits[0]?.length, 0);
      const updated = MarkdownEdit.applyAll(source, edits);
      // The existing content survives byte-identical after the blank line.
      assert.isTrue(Str.endsWith(`\n\n${source}`)(updated));
      const reparsed = yield* parseDoc(updated);
      const data = yield* MarkdownFrontmatter.schema(Meta, TomlFrontmatter)(reparsed);
      assert.deepStrictEqual(data, { title: "Hi", count: 3 });
    })
  );

  it.effect("a format mismatch fails typed and never switches fences", () =>
    Effect.gen(function* () {
      const document = yield* parseDoc('+++\ntitle = "Old"\ncount = 1\n+++\n\nbody\n');
      const error = yield* Effect.flip(
        MarkdownFrontmatter.set(Meta, YamlFrontmatter)(document, { title: "New", count: 2 })
      );
      assert.instanceOf(error, FrontmatterFormatMismatchError);
      assert.strictEqual(error.expected, "yaml");
      assert.strictEqual(error.actual, "toml");
    })
  );

  it.effect(
    "schema-encode-invalid data fails typed with FrontmatterValidationError carrying the structured issue",
    () =>
      Effect.gen(function* () {
        const document = yield* parseDoc("# Body\n");
        const error = yield* Effect.flip(
          MarkdownFrontmatter.set(Meta, YamlFrontmatter)(
            document,
            deliberatelyInvalid<never>({ title: 42, count: "x" })
          )
        );
        assert.instanceOf(error, FrontmatterValidationError);
        // The issue is the structured v4 issue tree, never a string.
        assert.isObject(error.issue);
        const issue = error.issue;
        if (!P.isObject(issue)) assert.fail("expected a structured issue");
        assert.isString(issue._tag);
      })
  );

  it.effect("a codec serialization failure propagates as FrontmatterEncodeError", () =>
    Effect.gen(function* () {
      const document = yield* parseDoc("# Body\n");
      const error = yield* Effect.flip(
        MarkdownFrontmatter.set(S.Unknown, JsonFrontmatter)(document, { big: BigInt(1) })
      );
      assert.instanceOf(error, FrontmatterEncodeError);
      assert.strictEqual(error.format, "json");
    })
  );
});

describe("MarkdownFrontmatter.setToString", () => {
  const Empty = S.Struct({});

  it.effect("pins the empty-object block per codec on an empty document", () =>
    Effect.gen(function* () {
      const document = yield* parseDoc("");
      const value4 = yield* MarkdownFrontmatter.setToString(Empty, YamlFrontmatter)(document, {});
      assert.strictEqual(value4, "---\n{}\n---\n");
      const value5 = yield* MarkdownFrontmatter.setToString(Empty, TomlFrontmatter)(document, {});
      assert.strictEqual(value5, "+++\n+++\n");
      const value6 = yield* MarkdownFrontmatter.setToString(Empty, JsonFrontmatter)(document, {});
      assert.strictEqual(value6, "---json\n{}\n---\n");
    })
  );

  it.effect("the empty-object block re-parses and decodes back to the empty object in every codec", () =>
    Effect.gen(function* () {
      const document = yield* parseDoc("");
      for (const codec of [YamlFrontmatter, TomlFrontmatter, JsonFrontmatter]) {
        const updated = yield* MarkdownFrontmatter.setToString(Empty, codec)(document, {});
        const reparsed = yield* parseDoc(updated);
        const data = yield* MarkdownFrontmatter.schema(Empty, codec)(reparsed);
        assert.deepStrictEqual(data, {});
      }
    })
  );

  it.effect("writes the json block with its language-hint fence", () =>
    Effect.gen(function* () {
      const document = yield* parseDoc("body\n");
      const updated = yield* MarkdownFrontmatter.setToString(Meta, JsonFrontmatter)(document, {
        title: "Hi",
        count: 1,
      });
      assert.strictEqual(updated, '---json\n{\n  "title": "Hi",\n  "count": 1\n}\n---\n\nbody\n');
    })
  );
});

describe("frontmatter write round-trip property", () => {
  // Newline-free strings only — see the file header for why. The count stays
  // in the 32-bit range every frontmatter codec represents exactly.
  const Scalar = S.String.check(S.makeFilter((s) => !Str.includes("\n")(s) && !Str.includes("\r")(s)));
  const MetaArb = S.Struct({
    title: Scalar,
    count: S.Int.check(S.isBetween({ minimum: -(2 ** 31), maximum: 2 ** 31 - 1 })),
  });
  const bodyDoc = "# Title\n\nsome *emphasis* text\n";

  const insertRoundTrip = Effect.fn("insertRoundTrip")(function* (
    codec: typeof YamlFrontmatter,
    data: { readonly title: string; readonly count: number }
  ) {
    const document = yield* parseDoc(bodyDoc);
    const updated = yield* MarkdownFrontmatter.setToString(Meta, codec)(document, data);
    // The pre-existing content survives byte-identical.
    assert.isTrue(Str.endsWith(`\n\n${bodyDoc}`)(updated));
    const reparsed = yield* parseDoc(updated);
    return yield* MarkdownFrontmatter.schema(Meta, codec)(reparsed);
  });

  it.effect.prop(
    "yaml: set then re-parse then decode recovers the data",
    [MetaArb],
    ([data]) =>
      Effect.gen(function* () {
        const insertRoundTrip7 = yield* insertRoundTrip(YamlFrontmatter, data);
        assert.deepStrictEqual(insertRoundTrip7, data);
      }),
    { arbitrary: fcRuns(60) }
  );

  it.effect.prop(
    "toml: set then re-parse then decode recovers the data",
    [MetaArb],
    ([data]) =>
      Effect.gen(function* () {
        const insertRoundTrip8 = yield* insertRoundTrip(TomlFrontmatter, data);
        assert.deepStrictEqual(insertRoundTrip8, data);
      }),
    { arbitrary: fcRuns(60) }
  );

  it.effect.prop(
    "json: set then re-parse then decode recovers the data",
    [MetaArb],
    ([data]) =>
      Effect.gen(function* () {
        const insertRoundTrip9 = yield* insertRoundTrip(JsonFrontmatter, data);
        assert.deepStrictEqual(insertRoundTrip9, data);
      }),
    { arbitrary: fcRuns(60) }
  );

  const fenced = `---\ntitle: Old\ncount: 0\n---\n\n${bodyDoc}`;
  it.effect.prop(
    "yaml: replacing an existing block preserves the suffix byte-for-byte and recovers the data",
    [MetaArb],
    ([data]) =>
      Effect.gen(function* () {
        const document = yield* parseDoc(fenced);
        const updated = yield* MarkdownFrontmatter.setToString(Meta, YamlFrontmatter)(document, data);
        assert.isTrue(Str.endsWith(`\n\n${bodyDoc}`)(updated));
        const reparsed = yield* parseDoc(updated);
        const result = yield* MarkdownFrontmatter.schema(Meta, YamlFrontmatter)(reparsed);
        assert.deepStrictEqual(result, data);
      }),
    { arbitrary: fcRuns(60) }
  );
});
