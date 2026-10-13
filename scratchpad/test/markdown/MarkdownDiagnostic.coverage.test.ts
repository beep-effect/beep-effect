import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { MarkdownDiagnostic } from "../../effected/markdown/MarkdownDiagnostic.ts";

it.effect("CRLF is one line break and an offset inside its pair remains on the preceding line", () => Effect.sync(() => {
  const source = "a\r\nb\rc\nd";
  for (const [offset, line, character] of [[2, 0, 2], [3, 1, 0], [5, 2, 0], [7, 3, 0], [12, 3, 5]] as const) {
    const diagnostic = MarkdownDiagnostic.fromRaw(source, { code: "NestingDepthExceeded", message: "guard", offset, length: 0 });
    assert.strictEqual(diagnostic.offset, offset);
    assert.strictEqual(diagnostic.line, line);
    assert.strictEqual(diagnostic.character, character);
  }
}));
