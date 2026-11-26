import { fcRuns } from "@beep/fc-runs";
import { Jsonc } from "@beep/jsonc/Jsonc";
import { FrontmatterMissingError, FrontmatterValidationError, MarkdownFrontmatter } from "@beep/markdown/Frontmatter";
import { JsonFrontmatter } from "@beep/markdown/JsonFrontmatter";
import { MarkdownParseOptions } from "@beep/markdown/Markdown";
import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import { TomlFrontmatter } from "@beep/markdown/TomlFrontmatter";
import { YamlFrontmatter } from "@beep/markdown/YamlFrontmatter";
import { Toml } from "@beep/toml/Toml";
import { Yaml } from "@beep/yaml/Yaml";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const withFrontmatter = MarkdownParseOptions.make({ frontmatter: true });

const Meta = S.Struct({
  title: S.String,
  count: S.Finite,
});

const parseDoc = MarkdownDocument.parse(withFrontmatter);

describe("MarkdownFrontmatter.schema", () => {
  it.effect("decodes yaml frontmatter to typed data end to end", () =>
    Effect.gen(function* () {
      const document = yield* parseDoc("---\ntitle: Hello\ncount: 2\n---\n\n# Body\n");
      const data = yield* MarkdownFrontmatter.schema(Meta, YamlFrontmatter)(document);
      assert.deepStrictEqual(data, { title: "Hello", count: 2 });
    })
  );

  it.effect("decodes toml frontmatter to typed data end to end", () =>
    Effect.gen(function* () {
      const document = yield* parseDoc('+++\ntitle = "Hello"\ncount = 2\n+++\n\n# Body\n');
      const data = yield* MarkdownFrontmatter.schema(Meta, TomlFrontmatter)(document);
      assert.deepStrictEqual(data, { title: "Hello", count: 2 });
    })
  );

  it.effect("decodes json frontmatter to typed data end to end", () =>
    Effect.gen(function* () {
      const document = yield* parseDoc('---json\n{ "title": "Hello", "count": 2 }\n---\n\n# Body\n');
      const data = yield* MarkdownFrontmatter.schema(Meta, JsonFrontmatter)(document);
      assert.deepStrictEqual(data, { title: "Hello", count: 2 });
    })
  );

  it.effect("fails typed with FrontmatterMissingError reason absent when the source has no block", () =>
    Effect.gen(function* () {
      const document = yield* parseDoc("# Just a heading\n");
      const error = yield* Effect.flip(MarkdownFrontmatter.schema(Meta, YamlFrontmatter)(document));
      assert.strictEqual(error._tag, "FrontmatterMissingError");
      assert.instanceOf(error, FrontmatterMissingError);
      assert.strictEqual(error.reason, "absent", "capture was on, so the source genuinely carries no block");
    })
  );

  it.effect("a fenced document parsed with capture off reports missing with reason captureDisabled", () =>
    Effect.gen(function* () {
      const document = yield* MarkdownDocument.parse("---\ntitle: Hello\n---\n");
      const error = yield* Effect.flip(MarkdownFrontmatter.schema(Meta, YamlFrontmatter)(document));
      assert.strictEqual(error._tag, "FrontmatterMissingError");
      assert.instanceOf(error, FrontmatterMissingError);
      assert.strictEqual(
        error.reason,
        "captureDisabled",
        "the source visibly opens with a frontmatter block, but the parse ran with the toggle off"
      );
    })
  );

  it.effect("an unclosed fence is not frontmatter, so the reason is absent", () =>
    Effect.gen(function* () {
      const document = yield* MarkdownDocument.parse("---\ntitle: Hello\n\n# Body\n");
      const error = yield* Effect.flip(MarkdownFrontmatter.schema(Meta, YamlFrontmatter)(document));
      assert.instanceOf(error, FrontmatterMissingError);
      assert.strictEqual(
        error.reason,
        "absent",
        "an unclosed opening fence is a thematic break plus content: capture on would capture nothing, so captureDisabled would lie"
      );
    })
  );

  it.effect("propagates the codec's format mismatch error", () =>
    Effect.gen(function* () {
      const document = yield* parseDoc('+++\ntitle = "Hello"\ncount = 2\n+++\n');
      const error = yield* Effect.flip(MarkdownFrontmatter.schema(Meta, YamlFrontmatter)(document));
      assert.strictEqual(error._tag, "FrontmatterFormatMismatchError");
    })
  );

  it.effect("propagates the codec's decode error for unparseable content", () =>
    Effect.gen(function* () {
      const document = yield* parseDoc("---\n: [\n---\n");
      const error = yield* Effect.flip(MarkdownFrontmatter.schema(Meta, YamlFrontmatter)(document));
      assert.strictEqual(error._tag, "FrontmatterDecodeError");
    })
  );

  it.effect("fails typed with FrontmatterValidationError carrying the structured issue", () =>
    Effect.gen(function* () {
      const document = yield* parseDoc("---\ntitle: 42\ncount: 2\n---\n");
      const error = yield* Effect.flip(MarkdownFrontmatter.schema(Meta, YamlFrontmatter)(document));
      assert.strictEqual(error._tag, "FrontmatterValidationError");
      assert.instanceOf(error, FrontmatterValidationError);
      assert.isObject(error.issue, "the structured v4 issue tree, never a string");
      const issue = error.issue;
      if (!P.isObject(issue)) assert.fail("expected a structured issue");
      assert.isString(issue._tag);
    })
  );
});

describe("MarkdownDocument.frontmatter", () => {
  it.effect("returns the captured node when frontmatter was parsed", () =>
    Effect.gen(function* () {
      const document = yield* parseDoc("---\ntitle: Hello\n---\n\nbody\n");
      const node = document.frontmatter;
      assert.isDefined(node);
      assert.strictEqual(node?.type, "frontmatter");
      assert.strictEqual(node?.format, "yaml");
      assert.strictEqual(
        node?.value,
        "title: Hello",
        "the value is the raw text between the fences without the final line terminator"
      );
      assert.strictEqual(node, document.root.children[0]);
    })
  );

  it.effect("is undefined when the document has no frontmatter", () =>
    Effect.gen(function* () {
      const document = yield* parseDoc("# Heading\n");
      assert.isUndefined(document.frontmatter);
    })
  );

  it.effect("is undefined for a fenced document parsed with capture off", () =>
    Effect.gen(function* () {
      const document = yield* MarkdownDocument.parse("---\ntitle: Hello\n---\n");
      assert.isUndefined(document.frontmatter);
    })
  );
});

describe("MarkdownDocument.hasFrontmatterBlock", () => {
  it.effect("is true for a fenced document parsed with capture off — the disambiguating signal", () =>
    Effect.gen(function* () {
      const document = yield* MarkdownDocument.parse("---\ntitle: Hello\n---\n\nbody\n");
      assert.isUndefined(document.frontmatter);
      assert.isTrue(
        document.hasFrontmatterBlock,
        "the pair the accessor alone cannot tell apart: no capture node, yet the source opens with a block"
      );
    })
  );

  it.effect("is true when the block was captured too — it reads the source, not the parse options", () =>
    Effect.gen(function* () {
      const document = yield* parseDoc("---\ntitle: Hello\n---\n\nbody\n");
      assert.isDefined(document.frontmatter);
      assert.isTrue(document.hasFrontmatterBlock);
    })
  );

  it.effect("recognizes the whole closed fence grammar: toml and json fences", () =>
    Effect.gen(function* () {
      const toml = yield* MarkdownDocument.parse('+++\ntitle = "Hello"\n+++\n');
      assert.isTrue(toml.hasFrontmatterBlock);
      const json = yield* MarkdownDocument.parse('---json\n{ "title": "Hello" }\n---\n');
      assert.isTrue(json.hasFrontmatterBlock);
    })
  );

  it.effect("is false when the source has no block", () =>
    Effect.gen(function* () {
      const document = yield* MarkdownDocument.parse("# Heading\n");
      assert.isFalse(document.hasFrontmatterBlock);
    })
  );

  it.effect("is false for an unclosed fence — an opening fence with no close is not frontmatter", () =>
    Effect.gen(function* () {
      const document = yield* MarkdownDocument.parse("---\ntitle: Hello\n\n# Body\n");
      assert.isFalse(document.hasFrontmatterBlock);
    })
  );

  it.effect("is false for a fence below the head of the document", () =>
    Effect.gen(function* () {
      const document = yield* MarkdownDocument.parse("intro\n\n---\ntitle: Hello\n---\n");
      assert.isFalse(document.hasFrontmatterBlock);
    })
  );
});

describe("frontmatter round-trip property", () => {
  const recoversExactly =
    "strings are newline-free: a multi-line string may put a bare fence-closer at column zero, as toml multi-line basic strings do, which the capture rightly reads as the closing fence; counts stay in the 32-bit range every codec represents exactly";
  const NewlineFreeScalar = S.String.check(S.makeFilter((s) => !Str.includes("\n")(s) && !Str.includes("\r")(s)));
  const MetaArb = S.Struct({
    title: NewlineFreeScalar,
    count: S.Int.check(S.isBetween({ minimum: -(2 ** 31), maximum: 2 ** 31 - 1 })),
  });

  const fenced = (open: string, block: string, close: string): string =>
    `${open}\n${block}${Str.endsWith("\n")(block) ? "" : "\n"}${close}\n\nbody\n`;

  const decodeVia = (source: string, codec: typeof YamlFrontmatter) =>
    Effect.flatMap(parseDoc(source), (document) => MarkdownFrontmatter.schema(Meta, codec)(document));

  it.effect.prop(
    "yaml: stringify, parse and decode recovers the data",
    [MetaArb],
    ([data]) =>
      Effect.gen(function* () {
        const block = yield* Yaml.stringify(data);
        const decodedVia = yield* decodeVia(fenced("---", block, "---"), YamlFrontmatter);
        assert.deepStrictEqual(decodedVia, data, recoversExactly);
      }),
    { arbitrary: fcRuns(60) }
  );

  it.effect.prop(
    "toml: stringify, parse and decode recovers the data",
    [MetaArb],
    ([data]) =>
      Effect.gen(function* () {
        const block = yield* Toml.stringify(data);
        const decodedVia1 = yield* decodeVia(fenced("+++", block, "+++"), TomlFrontmatter);
        assert.deepStrictEqual(decodedVia1, data, recoversExactly);
      }),
    { arbitrary: fcRuns(60) }
  );

  it.effect.prop(
    "json: stringify, parse and decode recovers the data",
    [MetaArb],
    ([data]) =>
      Effect.gen(function* () {
        const block = yield* Jsonc.stringify(data);
        const decodedVia2 = yield* decodeVia(fenced("---json", block, "---"), JsonFrontmatter);
        assert.deepStrictEqual(decodedVia2, data, recoversExactly);
      }),
    { arbitrary: fcRuns(60) }
  );
});
