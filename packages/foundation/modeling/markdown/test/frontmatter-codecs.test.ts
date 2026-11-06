// Unit coverage for the three frontmatter codec modules (P3 Task 2).
//
// Each codec is a free-standing named export over its kit peer — never a
// namespace object (the config-file tree-shaking rule). The contract is
// field-identical across the three: check the capture's `format` marker
// first (mismatch fails typed, before any parsing), then decode through the
// peer's public parse surface, wrapping its typed failure structurally.
//
// Empty-capture behavior is pinned per engine, verified by probe: yaml's
// empty document is `null`, toml's is `{}`, and JSON has no empty-document
// value so the json codec fails typed on an empty capture.

import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Jsonc, JsoncParseError } from "@beep/jsonc/Jsonc";
import {
  FrontmatterCodec,
  FrontmatterDecodeError,
  FrontmatterEncodeError,
  FrontmatterFormatMismatchError,
  FrontmatterKeyError,
} from "@beep/markdown/Frontmatter";
import { JsonFrontmatter } from "@beep/markdown/JsonFrontmatter";
import { Markdown, MarkdownParseOptions } from "@beep/markdown/Markdown";
import { Frontmatter, Point, Position } from "@beep/markdown/MarkdownNode";
import { TomlFrontmatter } from "@beep/markdown/TomlFrontmatter";
import { YamlFrontmatter } from "@beep/markdown/YamlFrontmatter";
import { TomlParseError } from "@beep/toml/Toml";
import { Yaml, YamlParseError } from "@beep/yaml/Yaml";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { FrontmatterFormat } from "@beep/markdown/MarkdownNode";

const withFrontmatter = MarkdownParseOptions.make({ frontmatter: true });

/** A hand-built capture node; the position is synthetic and irrelevant here. */
const capture = (format: FrontmatterFormat, value: string): Frontmatter =>
  Frontmatter.make({
    format,
    value,
    position: Position.make({
      start: Point.make({ line: 1, column: 1, offset: 0 }),
      end: Point.make({ line: 1, column: 1, offset: 0 }),
    }),
  });

/** The head frontmatter node of a real capture-enabled parse. */
const parsedCapture = (source: string) =>
  Effect.map(Markdown.parse(source, withFrontmatter), (root) => {
    const head = root.children[0];
    assert.isDefined(head, "expected a head node");
    assert.strictEqual(head?.type, "frontmatter");
    if (head?.type !== "frontmatter") {
      throw new TypeError("unreachable: asserted the type above");
    }
    return head;
  });

/** The FrontmatterKeyError a codec's synchronous decode fails with. */
const keyFailure = (codec: FrontmatterCodec, value: string): FrontmatterKeyError => {
  const failure = codec.decodeResult(capture(codec.format, value)).pipe(Result.flip, Result.getOrThrow);
  assert.instanceOf(failure, FrontmatterDecodeError);
  assert.strictEqual(failure.format, codec.format);
  const cause = S.is(FrontmatterDecodeError)(failure) ? failure.cause : undefined;
  assert.instanceOf(cause, FrontmatterKeyError);
  if (!S.is(FrontmatterKeyError)(cause)) throw new TypeError("unreachable: asserted the cause above");
  return cause;
};

describe("frontmatter codecs", () => {
  describe("YamlFrontmatter", () => {
    it.effect("decodes a valid yaml capture to data", () =>
      Effect.gen(function* () {
        const data = yield* YamlFrontmatter.decode(capture("yaml", "title: Hello\ntags:\n  - a\n  - b\n"));
        assert.deepStrictEqual(data, { title: "Hello", tags: ["a", "b"] });
      })
    );

    it.effect("decodes an empty capture to null, yaml's empty document", () =>
      Effect.gen(function* () {
        const data = yield* YamlFrontmatter.decode(capture("yaml", ""));
        assert.isNull(data);
      })
    );

    it.effect("fails typed on unparseable yaml, carrying the YamlParseError structurally", () =>
      Effect.gen(function* () {
        const result = yield* Effect.result(YamlFrontmatter.decode(capture("yaml", "a: [1\n")));
        if (Result.isSuccess(result)) assert.fail("expected frontmatter decoding to fail");
        const error = result.failure;
        assert.instanceOf(error, FrontmatterDecodeError);
        assert.strictEqual(error.format, "yaml");
        assert.instanceOf(error.cause, YamlParseError);
      })
    );

    it.effect("fails typed on a format mismatch, before any parsing", () =>
      Effect.gen(function* () {
        const result = yield* Effect.result(YamlFrontmatter.decode(capture("toml", "a = 1\n")));
        if (Result.isSuccess(result)) assert.fail("expected frontmatter decoding to fail");
        const error = result.failure;
        assert.instanceOf(error, FrontmatterFormatMismatchError);
        assert.strictEqual(error.expected, "yaml");
        assert.strictEqual(error.actual, "toml");
      })
    );

    // #2138: a frontmatter value is a JSON-compatible object, so keys and
    // collections yaml can express but a JSON object cannot fail typed
    // instead of being rewritten (`{"": "c"}`, `{"a b": null}`).
    it("rejects a complex sequence key instead of rewriting it to the empty key", () => {
      const cause = keyFailure(YamlFrontmatter, "? [a, b]\n: c\n");
      assert.strictEqual(cause.reason, "ComplexKey");
      assert.strictEqual(cause.offset, 2);
      assert.strictEqual(cause.length, 6);
    });

    it("rejects a complex mapping key nested below the root", () => {
      const cause = keyFailure(YamlFrontmatter, "outer:\n  ? {x: 1}\n  : c\n");
      assert.strictEqual(cause.reason, "ComplexKey");
    });

    it("rejects an alias key whose anchor is a collection", () => {
      const cause = keyFailure(YamlFrontmatter, "base: &b [1]\n*b : x\n");
      assert.strictEqual(cause.reason, "ComplexKey");
    });

    it("rejects a !!set collection, flow or block, verbatim tag included", () => {
      for (const text of [
        "tags: !!set {a, b}\n",
        "tags: !!set\n  ? a\n  ? b\n",
        "tags: !<tag:yaml.org,2002:set> {a}\n",
      ]) {
        assert.strictEqual(keyFailure(YamlFrontmatter, text).reason, "SetCollection");
      }
    });

    it("still decodes scalar keys, scalar alias keys and merge keys", () => {
      assert.deepStrictEqual(Result.getOrThrow(YamlFrontmatter.decodeResult(capture("yaml", "x: &k name\n*k : 2\n"))), {
        x: "name",
        name: 2,
      });
      assert.deepStrictEqual(
        Result.getOrThrow(YamlFrontmatter.decodeResult(capture("yaml", "base: &b {a: 1}\nown:\n  <<: *b\n  c: 2\n"))),
        { base: { a: 1 }, own: { "<<": { a: 1 }, c: 2 } }
      );
      assert.deepStrictEqual(Result.getOrThrow(YamlFrontmatter.decodeResult(capture("yaml", "1: one\ntrue: yes\n"))), {
        1: "one",
        true: "yes",
      });
    });

    it("still decodes an explicit key with no value", () => {
      assert.deepStrictEqual(Result.getOrThrow(YamlFrontmatter.decodeResult(capture("yaml", "? a\nb: 1\n"))), {
        a: null,
        b: 1,
      });
    });

    // #2143 review: keys of different yaml types that project to the same
    // string key would merge last-wins; the engine's own DuplicateKey check
    // compares typed values, so the codec compares the projections.
    it("rejects keys that differ in type but project to the same string", () => {
      for (const [text, offset, length] of [
        ['1: a\n"1": b\n', 5, 3],
        ['true: a\n"true": b\n', 8, 6],
        ['~: a\n"": b\n', 5, 2],
        ['1.0: a\n"1": b\n', 7, 3],
        ['0x10: a\n"16": b\n', 8, 4],
        ['outer:\n  1: a\n  "1": b\n', 16, 3],
      ] as const) {
        const cause = keyFailure(YamlFrontmatter, text);
        assert.strictEqual(cause.reason, "DuplicateKey");
        assert.strictEqual(cause.offset, offset);
        assert.strictEqual(cause.length, length);
      }
    });

    it("rejects an alias key that projects onto an earlier key", () => {
      const cause = keyFailure(YamlFrontmatter, "x: &k a\na: 1\n*k : 2\n");
      assert.strictEqual(cause.reason, "DuplicateKey");
      assert.strictEqual(cause.offset, 13);
      assert.strictEqual(cause.length, 2);
    });

    it("still decodes keys whose projections differ, and the same key in sibling mappings", () => {
      assert.deepStrictEqual(Result.getOrThrow(YamlFrontmatter.decodeResult(capture("yaml", 'null: a\n"null": b\n'))), {
        "": "a",
        null: "b",
      });
      assert.deepStrictEqual(Result.getOrThrow(YamlFrontmatter.decodeResult(capture("yaml", '1.0: a\n"1.0": b\n'))), {
        1: "a",
        "1.0": "b",
      });
      assert.deepStrictEqual(
        Result.getOrThrow(YamlFrontmatter.decodeResult(capture("yaml", "x:\n  1: a\ny:\n  1: b\n"))),
        {
          x: { 1: "a" },
          y: { 1: "b" },
        }
      );
    });

    it("keeps the engine's parse failure ahead of the key check", () => {
      const failure = YamlFrontmatter.decodeResult(capture("yaml", "? [a]\n: 1\nb: [\n")).pipe(
        Result.flip,
        Result.getOrThrow
      );
      assert.isTrue(S.is(FrontmatterDecodeError)(failure) && S.is(YamlParseError)(failure.cause));
    });
  });

  describe("TomlFrontmatter", () => {
    it.effect("decodes a valid toml capture to data", () =>
      Effect.gen(function* () {
        const data = yield* TomlFrontmatter.decode(capture("toml", 'title = "Hello"\n\n[owner]\nname = "spencer"\n'));
        assert.deepStrictEqual(data, { title: "Hello", owner: { name: "spencer" } });
      })
    );

    it.effect("decodes an empty capture to an empty table, toml's empty document", () =>
      Effect.gen(function* () {
        const data = yield* TomlFrontmatter.decode(capture("toml", ""));
        assert.deepStrictEqual(data, {});
      })
    );

    it.effect("fails typed on unparseable toml, carrying the TomlParseError structurally", () =>
      Effect.gen(function* () {
        const result = yield* Effect.result(TomlFrontmatter.decode(capture("toml", "a = = 1\n")));
        if (Result.isSuccess(result)) assert.fail("expected frontmatter decoding to fail");
        const error = result.failure;
        assert.instanceOf(error, FrontmatterDecodeError);
        assert.strictEqual(error.format, "toml");
        assert.instanceOf(error.cause, TomlParseError);
      })
    );

    it.effect("fails typed on a format mismatch, before any parsing", () =>
      Effect.gen(function* () {
        const result = yield* Effect.result(TomlFrontmatter.decode(capture("json", '{"a": 1}')));
        if (Result.isSuccess(result)) assert.fail("expected frontmatter decoding to fail");
        const error = result.failure;
        assert.instanceOf(error, FrontmatterFormatMismatchError);
        assert.strictEqual(error.expected, "toml");
        assert.strictEqual(error.actual, "json");
      })
    );
  });

  describe("JsonFrontmatter", () => {
    it.effect("decodes a valid json capture to data", () =>
      Effect.gen(function* () {
        const data = yield* JsonFrontmatter.decode(capture("json", '{"title": "Hello", "draft": false}'));
        assert.deepStrictEqual(data, { title: "Hello", draft: false });
      })
    );

    it.effect("decodes jsonc leniencies — comments and trailing commas — rather than failing", () =>
      Effect.gen(function* () {
        const data = yield* JsonFrontmatter.decode(capture("json", '{\n\t// a comment\n\t"a": 1,\n}'));
        assert.deepStrictEqual(data, { a: 1 });
      })
    );

    it.effect("fails typed on an empty capture: JSON has no empty document", () =>
      Effect.gen(function* () {
        const result = yield* Effect.result(JsonFrontmatter.decode(capture("json", "")));
        if (Result.isSuccess(result)) assert.fail("expected frontmatter decoding to fail");
        const error = result.failure;
        assert.instanceOf(error, FrontmatterDecodeError);
        assert.strictEqual(error.format, "json");
        assert.instanceOf(error.cause, JsoncParseError);
      })
    );

    it.effect("fails typed on unparseable json, carrying the JsoncParseError structurally", () =>
      Effect.gen(function* () {
        const result = yield* Effect.result(JsonFrontmatter.decode(capture("json", "{a: \n")));
        if (Result.isSuccess(result)) assert.fail("expected frontmatter decoding to fail");
        const error = result.failure;
        assert.instanceOf(error, FrontmatterDecodeError);
        assert.strictEqual(error.format, "json");
        assert.instanceOf(error.cause, JsoncParseError);
      })
    );

    it.effect("fails typed on a format mismatch, before any parsing", () =>
      Effect.gen(function* () {
        const result = yield* Effect.result(JsonFrontmatter.decode(capture("yaml", "a: 1\n")));
        if (Result.isSuccess(result)) assert.fail("expected frontmatter decoding to fail");
        const error = result.failure;
        assert.instanceOf(error, FrontmatterFormatMismatchError);
        assert.strictEqual(error.expected, "json");
        assert.strictEqual(error.actual, "yaml");
      })
    );

    // #2138: duplicate keys fail typed, as they do for the yaml and toml
    // codecs, instead of resolving last-wins.
    it("rejects a duplicate key instead of resolving it last-wins", () => {
      const cause = keyFailure(JsonFrontmatter, '{"a": 1, "a": 2}');
      assert.strictEqual(cause.reason, "DuplicateKey");
      assert.strictEqual(cause.offset, 9);
      assert.strictEqual(cause.length, 3);
    });

    it("rejects a duplicate key in a nested object, escaped spellings included", () => {
      const cause = keyFailure(JsonFrontmatter, '{"outer": {"b": 1, "\\u0062": 2}}');
      assert.strictEqual(cause.reason, "DuplicateKey");
    });

    it("still decodes the same key in sibling objects", () => {
      assert.deepStrictEqual(
        Result.getOrThrow(
          JsonFrontmatter.decodeResult(capture("json", '{"x": {"a": 1}, "y": {"a": 2}, "z": [{"a": 3}]}'))
        ),
        { x: { a: 1 }, y: { a: 2 }, z: [{ a: 3 }] }
      );
    });

    it("rejects duplicates alike in all three codecs", () => {
      const yaml = YamlFrontmatter.decodeResult(capture("yaml", "a: 1\na: 2\n")).pipe(Result.flip, Result.getOrThrow);
      const toml = TomlFrontmatter.decodeResult(capture("toml", "a = 1\na = 2\n")).pipe(Result.flip, Result.getOrThrow);
      const json = JsonFrontmatter.decodeResult(capture("json", '{"a": 1, "a": 2}')).pipe(
        Result.flip,
        Result.getOrThrow
      );
      for (const failure of [yaml, toml, json]) {
        assert.instanceOf(failure, FrontmatterDecodeError);
      }
    });
  });

  // The #2138 shift lives in the frontmatter layer only: the engines keep
  // their general-purpose projections for every other consumer. These pin the
  // inverted pairs — the engine result the codec used to return, next to the
  // codec rejection that replaces it.
  describe("behaviour shift pins (#2138)", () => {
    it("Yaml.parseResult still projects complex keys and sets; the codec rejects them", () => {
      assert.deepStrictEqual(Result.getOrThrow(Yaml.parseResult("? [a, b]\n: c\n")), { "": "c" });
      assert.deepStrictEqual(Result.getOrThrow(Yaml.parseResult("tags: !!set\n  ? a\n")), { tags: { a: null } });
      assert.strictEqual(keyFailure(YamlFrontmatter, "? [a, b]\n: c\n").reason, "ComplexKey");
      assert.strictEqual(keyFailure(YamlFrontmatter, "tags: !!set\n  ? a\n").reason, "SetCollection");
    });

    it("Yaml.parseResult still merges keys that project to the same string; the codec rejects them", () => {
      assert.deepStrictEqual(Result.getOrThrow(Yaml.parseResult('1: a\n"1": b\n')), { 1: "b" });
      assert.deepStrictEqual(Result.getOrThrow(Yaml.parseResult("x: &k a\na: 1\n*k : 2\n")), { x: "a", a: 2 });
      assert.strictEqual(keyFailure(YamlFrontmatter, '1: a\n"1": b\n').reason, "DuplicateKey");
    });

    it("Jsonc.parseResult still resolves duplicates last-wins; the codec rejects them", () => {
      assert.deepStrictEqual(Result.getOrThrow(Jsonc.parseResult('{"a": 1, "a": 2}')), { a: 2 });
      assert.strictEqual(keyFailure(JsonFrontmatter, '{"a": 1, "a": 2}').reason, "DuplicateKey");
    });

    it("renders the key error message with its reason and offset", () => {
      assert.strictEqual(
        FrontmatterKeyError.make({ reason: "DuplicateKey", offset: 9, length: 3 }).message,
        "frontmatter key rejected: DuplicateKey at offset 9"
      );
    });
  });

  describe("end to end over Markdown.parse", () => {
    it.effect("yaml: parse with capture, decode the captured node", () =>
      Effect.gen(function* () {
        const node = yield* parsedCapture("---\ntitle: Hello\n---\n\n# Body\n");
        const data = yield* YamlFrontmatter.decode(node);
        assert.deepStrictEqual(data, { title: "Hello" });
      })
    );

    it.effect("toml: parse with capture, decode the captured node", () =>
      Effect.gen(function* () {
        const node = yield* parsedCapture('+++\ntitle = "Hello"\n+++\n\n# Body\n');
        const data = yield* TomlFrontmatter.decode(node);
        assert.deepStrictEqual(data, { title: "Hello" });
      })
    );

    it.effect("json: parse with capture, decode the captured node", () =>
      Effect.gen(function* () {
        const node = yield* parsedCapture('---json\n{"title": "Hello"}\n---\n\n# Body\n');
        const data = yield* JsonFrontmatter.decode(node);
        assert.deepStrictEqual(data, { title: "Hello" });
      })
    );
  });

  describe("contract shape", () => {
    it("the three codecs are FrontmatterCodec instances with both Effect and Result directions", () => {
      const codecs: ReadonlyArray<FrontmatterCodec> = [YamlFrontmatter, TomlFrontmatter, JsonFrontmatter];
      for (const codec of codecs) {
        assert.isTrue(codec instanceof FrontmatterCodec);
        assert.isFunction(codec.decode);
        assert.isFunction(codec.encode);
        assert.isFunction(codec.decodeResult);
        assert.isFunction(codec.encodeResult);
      }
      assert.deepStrictEqual(
        A.map(codecs, (codec) => codec.format),
        ["yaml", "toml", "json"]
      );
    });
  });

  describe("decodeResult / encodeResult", () => {
    it("decodes each codec's capture synchronously", () => {
      assert.deepStrictEqual(Result.getOrThrow(YamlFrontmatter.decodeResult(capture("yaml", "title: Hi\n"))), {
        title: "Hi",
      });
      assert.deepStrictEqual(Result.getOrThrow(TomlFrontmatter.decodeResult(capture("toml", 'title = "Hi"\n'))), {
        title: "Hi",
      });
      assert.deepStrictEqual(Result.getOrThrow(JsonFrontmatter.decodeResult(capture("json", '{"title":"Hi"}'))), {
        title: "Hi",
      });
    });

    it("fails a mismatched capture before parsing", () => {
      const failure = YamlFrontmatter.decodeResult(capture("toml", "x: [")).pipe(Result.flip, Result.getOrThrow);
      assert.instanceOf(failure, FrontmatterFormatMismatchError);
      if (S.is(FrontmatterFormatMismatchError)(failure)) {
        assert.strictEqual(failure.expected, "yaml");
        assert.strictEqual(failure.actual, "toml");
      }
    });

    it("wraps each engine's parse failure structurally", () => {
      const yaml = YamlFrontmatter.decodeResult(capture("yaml", "x: [")).pipe(Result.flip, Result.getOrThrow);
      const toml = TomlFrontmatter.decodeResult(capture("toml", "x = ")).pipe(Result.flip, Result.getOrThrow);
      const json = JsonFrontmatter.decodeResult(capture("json", "")).pipe(Result.flip, Result.getOrThrow);
      assert.isTrue(S.is(FrontmatterDecodeError)(yaml) && yaml.format === "yaml" && S.is(YamlParseError)(yaml.cause));
      assert.isTrue(S.is(FrontmatterDecodeError)(toml) && toml.format === "toml" && S.is(TomlParseError)(toml.cause));
      assert.isTrue(S.is(FrontmatterDecodeError)(json) && json.format === "json" && S.is(JsoncParseError)(json.cause));
    });

    it("encodes synchronously and fails typed on an unrepresentable value", () => {
      assert.strictEqual(Result.getOrThrow(JsonFrontmatter.encodeResult({})), "{}");
      assert.strictEqual(Result.getOrThrow(TomlFrontmatter.encodeResult({})), "");
      const cyclic: Record<string, unknown> = {};
      cyclic.self = cyclic;
      const failure = JsonFrontmatter.encodeResult(cyclic).pipe(Result.flip, Result.getOrThrow);
      assert.instanceOf(failure, FrontmatterEncodeError);
      assert.strictEqual(failure.format, "json");
    });

    it.effect("agrees with the Effect direction on success and failure", () =>
      Effect.gen(function* () {
        for (const node of [capture("yaml", "a: 1\n"), capture("yaml", "x: ["), capture("json", "{}")]) {
          const viaEffect = yield* Effect.result(YamlFrontmatter.decode(node));
          assert.deepStrictEqual(viaEffect, YamlFrontmatter.decodeResult(node));
        }
      })
    );

    it.effect.prop(
      "the Result and Effect directions agree on every JSON value, both ways",
      [S.Json],
      ([value]) =>
        Effect.gen(function* () {
          for (const codec of [YamlFrontmatter, TomlFrontmatter, JsonFrontmatter]) {
            const body = codec.encodeResult(value);
            const result1 = yield* Effect.result(codec.encode(value));
            assert.deepStrictEqual(result1, body);
            if (Result.isSuccess(body)) {
              const node = capture(codec.format, body.success);
              const result2 = yield* Effect.result(codec.decode(node));
              assert.deepStrictEqual(result2, codec.decodeResult(node));
            }
          }
        }),
      { arbitrary: fcRuns(100) }
    );
  });
});
