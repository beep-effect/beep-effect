import { assert, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import { MarkdownDiagnostic } from "../../effected/markdown/MarkdownDiagnostic.ts";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { Markdown, MarkdownParseOptions, MarkdownParseError, parsePassResult } from "../../effected/markdown/Markdown.ts";
import { Root, Blockquote } from "../../effected/markdown/MarkdownNode.ts";
import { RawMarkdownError } from "../../effected/markdown/internal/carriers.ts";
import { inlineDialect } from "../../effected/markdown/internal/inlineRegistry.ts";

const throwsIdentity = (evaluate: () => unknown, expected: Error): void => {
  let caught: unknown;
  try { evaluate(); } catch (error) { caught = error; }
  assert.strictEqual(caught, expected);
};

// Scoped registry injection exercises the facade's error boundary and restores
// the shared table before this test yields to another Effect.
it.effect("raw diagnostics become typed failures while programmer defects retain identity", () => Effect.sync(() => {
  const dialect = inlineDialect("commonmark");
  const text = dialect.text;
  const options = MarkdownParseOptions.make({ dialect: "commonmark" });
  const raw = new RawMarkdownError({ code: "NestingDepthExceeded", message: "raw guard", offset: 2, length: 1 });
  const defect = new Error("extension defect");
  try {
    Object.assign(dialect, { text: { ...text, parse: () => { throw raw; } } });
    const failed = parsePassResult(options)("abc");
    assertFailure(failed, MarkdownParseError.make({ diagnostic: MarkdownDiagnostic.make({
      code: "NestingDepthExceeded", message: "raw guard", offset: 2, length: 1, line: 0, character: 2
    }) }));
    Object.assign(dialect, { text: { ...text, parse: () => { throw defect; } } });
    throwsIdentity(() => Markdown.parseResult("abc", options), defect);
    throwsIdentity(() => Markdown.parsePhrasingResult("abc", options), defect);
  } finally { Object.assign(dialect, { text }); }
  assertSuccess(Result.map(Markdown.parseResult("abc", options), (root) => root.type), "root");
}));
it.effect("stringify preserves programmer defects rather than converting them to parse failures", () => Effect.sync(() => {
  const root = Root.make({ children: [] });
  const defect = new Error("broken tree accessor");
  Object.defineProperty(root, "children", { get: () => { throw defect; } });
  throwsIdentity(() => Markdown.stringifyResult(root), defect);
}));
it.effect("the string codec maps parser and serializer guard errors to structured schema errors", () => Effect.gen(function* () {
  const codec = Markdown.fromString();
  const decodeError = yield* Effect.flip(S.decodeEffect(codec)("> ".repeat(300) + "text"));
  assert.include(decodeError.message, "Markdown parse failed: NestingDepthExceeded");
  let node = Blockquote.make({ children: [] });
  for (let depth = 0; depth < 300; depth++) node = Blockquote.make({ children: [node] });
  const encodeError = yield* Effect.flip(S.encodeEffect(codec)(Root.make({ children: [node] })));
  assert.include(encodeError.message, "Markdown stringify failed: NestingDepthExceeded");
}));
