import { MAX_NESTING_DEPTH } from "@beep/markdown/internal/limits";
import { Markdown } from "@beep/markdown/Markdown";
import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import { MarkdownFormat, MarkdownFormattingOptions, MarkdownModificationError } from "@beep/markdown/MarkdownFormat";
import { Blockquote, Paragraph, Text } from "@beep/markdown/MarkdownNode";
import { assert, describe, it, vi } from "@effect/vitest";
import { assertDefined, assertFailure } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import type { MarkdownParseError, MarkdownParseOptions } from "@beep/markdown/Markdown";
import type { FlowContent, Root } from "@beep/markdown/MarkdownNode";

describe("MarkdownFormat coverage", () => {
  it.effect("allows a link-free fragment inside a link", () =>
    Effect.gen(function* () {
      const doc = yield* MarkdownDocument.parse("[outer](/a)\n");
      const target = doc.find("text");
      assertDefined(target);
      const modifyToString1 = yield* MarkdownFormat.modifyToString(doc, target, Text.make({ value: "inner" }));
      assert.strictEqual(modifyToString1, "[inner](/a)\n");
    })
  );
  it.effect("retains bullet spellings and rejects flow edits when contextual parsing fails", () =>
    Effect.gen(function* () {
      const doc = yield* MarkdownDocument.parse("hello\n");
      const target = doc.find("paragraph");
      assertDefined(target);
      const rejected = Markdown.parseResult(`${Str.repeat(MAX_NESTING_DEPTH + 1)("> ")}deep\n`);
      assertFailure(
        Result.mapError(rejected, (error) => error.diagnostic.code),
        "NestingDepthExceeded"
      );
      const parse = Markdown.parseResult;
      const spy = vi.spyOn(Markdown, "parseResult");
      try {
        spy.mockImplementation(
          dual(
            (args) => P.isString(args[0]),
            (source: string, options?: MarkdownParseOptions): Result.Result<Root, MarkdownParseError> =>
              source === "* a\n" ? parse(source, options) : rejected
          )
        );
        assert.strictEqual(
          MarkdownFormat.formatToString("* a\n", undefined, MarkdownFormattingOptions.make({ bulletChar: "-" })),
          "* a\n"
        );
        const result = yield* Effect.result(MarkdownFormat.modify(doc, target, "replacement"));
        assertFailure(
          Result.mapError(result, (error) => error.code),
          "UnsupportedTarget"
        );
        spy.mockImplementation(
          dual(
            (args) => P.isString(args[0]),
            (source: string, options?: MarkdownParseOptions): Result.Result<Root, MarkdownParseError> =>
              source === "replacement" ? parse(source, options) : rejected
          )
        );
        const contextual = yield* Effect.result(MarkdownFormat.modify(doc, target, "replacement"));
        assertFailure(
          Result.mapError(contextual, (error) => error.code),
          "UnsupportedTarget"
        );
      } finally {
        spy.mockRestore();
      }
    })
  );

  it.effect("reports typed errors with the concrete target span", () =>
    Effect.gen(function* () {
      const doc = yield* MarkdownDocument.parse("hello\n");
      const target = doc.find("paragraph");
      assertDefined(target);
      let replacement: FlowContent = Paragraph.make({ children: [Text.make({ value: "deep" })] });
      for (let i = 0; i <= MAX_NESTING_DEPTH; i++) replacement = Blockquote.make({ children: [replacement] });
      const result = yield* Effect.result(MarkdownFormat.modify(doc, target, replacement));
      assertFailure(
        Result.mapError(result, (error) => error.code),
        "FragmentUnrenderable"
      );
      if (Result.isSuccess(result)) return assert.fail("expected a rendering failure");
      assert.strictEqual(result.failure.code, "FragmentUnrenderable");
      assert.strictEqual(result.failure.offset, 0);
      assert.strictEqual(result.failure.length, 5);
      const error = MarkdownModificationError.make({
        code: "UnsupportedTarget",
        detail: "detail",
        offset: 2,
        length: 3,
      });
      assert.strictEqual(error.message, "Markdown modification failed: UnsupportedTarget detail");
      const textTarget = doc.find("text");
      assertDefined(textTarget);
      const categoryResult = yield* Effect.result(
        MarkdownFormat.modify(doc, textTarget, Paragraph.make({ children: [] }))
      );
      assertFailure(
        Result.mapError(categoryResult, (error) => error.code),
        "FragmentCategoryMismatch"
      );
      const rootResult = yield* Effect.result(MarkdownFormat.modify(doc, doc.root, "x"));
      assertFailure(
        Result.mapError(rootResult, (error) => error.code),
        "UnsupportedTarget"
      );
      if (Result.isSuccess(rootResult)) return assert.fail("expected an unsupported root");
      assert.strictEqual(rootResult.failure.code, "UnsupportedTarget");
    })
  );

  it.effect("normalizes safe markers while retaining hazardous container spellings", () =>
    Effect.gen(function* () {
      const cases: ReadonlyArray<readonly [string, MarkdownFormattingOptions, string]> = [
        ["```", MarkdownFormattingOptions.make({ fenceChar: "~" }), "~~~"],
        ["``` \t", MarkdownFormattingOptions.make({ fenceChar: "~" }), "~~~ \t"],
        ["* a\n\nparagraph\n\n+ b\n", MarkdownFormattingOptions.make({ bulletChar: "-" }), "- a\n\nparagraph\n\n- b\n"],
        ["***\r\n\r\ntext\n", MarkdownFormattingOptions.make({ thematicBreakChar: "_" }), "___\r\n\r\ntext\n"],
        ["a\n\r\n***\n", MarkdownFormattingOptions.make({ thematicBreakChar: "-" }), "a\n\r\n---\n"],
        ["# *word*\n", MarkdownFormattingOptions.make({ headingStyle: "setext", emphasisChar: "_" }), "# _word_\n"],
        ["~~~\n` middle `\n~~~\n", MarkdownFormattingOptions.make({ fenceChar: "`" }), "```\n` middle `\n```\n"],
        ["  ```\ncode\n```\n", MarkdownFormattingOptions.make({ codeBlockStyle: "indented" }), "  ```\ncode\n```\n"],
        ["_a_**b**\n", MarkdownFormattingOptions.make({ emphasisChar: "_" }), "_a_**b**\n"],
        ["**a**_b_\n", MarkdownFormattingOptions.make({ emphasisChar: "_" }), "**a**_b_\n"],
        ["*a **b** c*\n", MarkdownFormattingOptions.make({ emphasisChar: "_" }), "_a __b__ c_\n"],
        ["~~~\ncode\n", MarkdownFormattingOptions.make({ fenceChar: "`" }), "```\ncode\n"],
        ["  ~~~\ncode\n  ~~~\n", MarkdownFormattingOptions.make({ fenceChar: "`" }), "  ```\ncode\n  ```\n"],
        ["> * a\r\n>\r\n> + b\r\n", MarkdownFormattingOptions.make({ bulletChar: "-" }), "> - a\r\n>\r\n> - b\r\n"],
        ["# _word_\n", MarkdownFormattingOptions.make({ headingStyle: "setext", emphasisChar: "*" }), "# *word*\n"],
        ["one\ntwo\n===\n", MarkdownFormattingOptions.make({ headingStyle: "atx" }), "one\ntwo\n===\n"],
        ["* a\n\n+ b\n", MarkdownFormattingOptions.make({ bulletChar: "-" }), "* a\n\n+ b\n"],
        [" \t\r\n***\r\n", MarkdownFormattingOptions.make({ thematicBreakChar: "-" }), " \t\r\n---\r\n"],
        [
          "paragraph\n```\ncode\n```\n",
          MarkdownFormattingOptions.make({ codeBlockStyle: "indented" }),
          "paragraph\n```\ncode\n```\n",
        ],
        [
          "```\na\n \t\nb\n```\n",
          MarkdownFormattingOptions.make({ codeBlockStyle: "indented" }),
          "```\na\n \t\nb\n```\n",
        ],
        ["***a***\n", MarkdownFormattingOptions.make({ emphasisChar: "_" }), "*__a__*\n"],
      ];
      for (const [source, options, expected] of cases) {
        assert.strictEqual(MarkdownFormat.formatToString(source, undefined, options), expected);
      }
      yield* Effect.void;
    })
  );
});
