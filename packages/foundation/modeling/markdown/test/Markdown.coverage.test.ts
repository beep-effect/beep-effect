import { RawMarkdownError } from "@beep/markdown/internal/carriers";
import { inlineDialect } from "@beep/markdown/internal/inlineRegistry";
import { Markdown, MarkdownParseError, MarkdownParseOptions, parsePassResult } from "@beep/markdown/Markdown";
import { MarkdownDiagnostic } from "@beep/markdown/MarkdownDiagnostic";
import { Blockquote, Root } from "@beep/markdown/MarkdownNode";
import { assert, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const throwsIdentity = (evaluate: () => unknown, expected: Error): void => {
  let caught: unknown;
  try {
    evaluate();
  } catch (error) {
    caught = error;
  }
  assert.strictEqual(caught, expected);
};

it.effect("raw diagnostics become typed failures while programmer defects retain identity", () =>
  Effect.sync(() => {
    const sharedDialect = inlineDialect("commonmark");
    const text = sharedDialect.text;
    const options = MarkdownParseOptions.make({ dialect: "commonmark" });
    const raw = RawMarkdownError.make({ code: "NestingDepthExceeded", message: "raw guard", offset: 2, length: 1 });
    const defect = new Error("extension defect");
    try {
      Object.assign(sharedDialect, {
        text: {
          ...text,
          parse: () => {
            throw raw;
          },
        },
      });
      const failed = parsePassResult(options)("abc");
      assertFailure(
        failed,
        MarkdownParseError.make({
          diagnostic: MarkdownDiagnostic.make({
            code: "NestingDepthExceeded",
            message: "raw guard",
            offset: 2,
            length: 1,
            line: 0,
            character: 2,
          }),
        })
      );
      Object.assign(sharedDialect, {
        text: {
          ...text,
          parse: () => {
            throw defect;
          },
        },
      });
      throwsIdentity(() => Markdown.parseResult("abc", options), defect);
      throwsIdentity(() => Markdown.parsePhrasingResult("abc", options), defect);
    } finally {
      Object.assign(sharedDialect, { text });
    }
    const parseAfterTableRestored = Result.map(Markdown.parseResult("abc", options), (root) => root.type);
    assertSuccess(parseAfterTableRestored, "root");
  })
);
it.effect("stringify preserves programmer defects rather than converting them to parse failures", () =>
  Effect.sync(() => {
    const root = Root.make({ children: [] });
    const defect = new Error("broken tree accessor");
    Object.defineProperty(root, "children", {
      get: () => {
        throw defect;
      },
    });
    throwsIdentity(() => Markdown.stringifyResult(root), defect);
  })
);
it.effect("the string codec maps parser and serializer guard errors to structured schema errors", () =>
  Effect.gen(function* () {
    const codec = Markdown.fromString();
    const decodeError = yield* Effect.flip(S.decodeEffect(codec)(`${Str.repeat(300)("> ")}text`));
    assert.include(decodeError.message, "Markdown parse failed: NestingDepthExceeded");
    let node = Blockquote.make({ children: [] });
    for (let depth = 0; depth < 300; depth++) node = Blockquote.make({ children: [node] });
    const encodeError = yield* Effect.flip(S.encodeEffect(codec)(Root.make({ children: [node] })));
    assert.include(encodeError.message, "Markdown stringify failed: NestingDepthExceeded");
  })
);
