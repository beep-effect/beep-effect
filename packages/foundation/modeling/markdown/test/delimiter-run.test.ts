import { makeInlineNode } from "@beep/markdown/internal/inlineNode";
import { DelimiterRun, scanDelims } from "@beep/markdown/internal/inlines/emphasis";
import { InlineScanner } from "@beep/markdown/internal/inlineTypes";
import { assert, describe, it } from "@effect/vitest";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { InlineNode } from "@beep/markdown/internal/inlineNode";
import type { Bracket, Delimiter } from "@beep/markdown/internal/inlineTypes";
import type { Definition } from "@beep/markdown/MarkdownNode";

class ScanDelimsCursorScanner extends InlineScanner {
  readonly refmap = HashMap.empty<string, Definition>();
  readonly footnoteLabels = HashSet.empty<string>();
  delimiters: Delimiter | undefined = undefined;
  brackets: Bracket | undefined = undefined;
  readonly closingBacktickRun = dual(2, (_from: number, _length: number): number | undefined => undefined);
  readonly appendText = dual(
    3,
    (value: string, from: number, to: number): InlineNode => makeInlineNode("text", from, to, value)
  );
  readonly addBracket = dual(3, (_node: InlineNode, _index: number, _image: boolean): void => {});

  readonly subject: string;
  pos: number;

  constructor(subject: string, pos: number) {
    super();
    this.subject = subject;
    this.pos = pos;
  }

  peek(): string {
    return Str.slice(this.pos, this.pos + 1)(this.subject);
  }

  match(): string | undefined {
    return undefined;
  }

  matchAhead(): string | undefined {
    return undefined;
  }

  hasAhead(): boolean {
    return false;
  }

  append(): void {}

  lastChild(): InlineNode | undefined {
    return undefined;
  }

  unputText(): boolean {
    return false;
  }

  trimTrailingSpaces(): number {
    return 0;
  }

  removeDelimiter(): void {}

  removeBracket(): void {}

  deactivateLinkOpeners(): void {}

  processEmphasis(): void {}
}

const scannerFor: {
  (subject: string, pos: number): InlineScanner;
  (pos: number): (subject: string) => InlineScanner;
} = dual(2, (subject: string, pos: number): InlineScanner => new ScanDelimsCursorScanner(subject, pos));

describe("delimiter measurements", () => {
  it("returns the same schema payload in both call forms and restores the cursor", () => {
    const scanner = scannerFor(" **word**", 1);
    const expected = DelimiterRun.makeOption({ numdelims: 2, canOpen: true, canClose: false });
    assert.deepStrictEqual(scanDelims(scanner, "*"), expected);
    assert.strictEqual(scanner.pos, 1);
    assert.deepStrictEqual(scanDelims("*")(scanner), expected);
    assert.strictEqual(scanner.pos, 1);
  });

  it("returns None without advancing when the requested run is absent or at EOF", () => {
    for (const pos of [0, 1]) {
      const scanner = scannerFor("a", pos);
      assert.deepStrictEqual(scanDelims(scanner, "*"), O.none());
      assert.strictEqual(scanner.pos, pos);
      assert.deepStrictEqual(scanDelims("*")(scanner), O.none());
      assert.strictEqual(scanner.pos, pos);
    }
  });

  it("derives validation from the three-field runtime contract", () => {
    const isRun = S.is(DelimiterRun);
    assert.isTrue(isRun({ numdelims: 2, canOpen: true, canClose: false }));
    assert.isFalse(isRun({ numdelims: "2", canOpen: true, canClose: false }));
    assert.isFalse(isRun({ numdelims: 2, canOpen: 1, canClose: false }));
    assert.isFalse(isRun({ numdelims: Number.POSITIVE_INFINITY, canOpen: true, canClose: false }));
    assert.isFalse(isRun({ numdelims: 0, canOpen: true, canClose: false }));
    assert.isFalse(isRun({ numdelims: -3, canOpen: true, canClose: false }));
    assert.isFalse(isRun({ numdelims: 2.5, canOpen: true, canClose: false }));
  });

  it("counts delimiters and cursor offsets in UTF-16 units beside astral characters", () => {
    const scanner = scannerFor("😀__a__😀", 2);
    assert.deepStrictEqual(
      scanDelims(scanner, "_"),
      DelimiterRun.makeOption({ numdelims: 2, canOpen: true, canClose: false })
    );
    assert.strictEqual(scanner.pos, 2);
    scanner.pos = 5;
    assert.deepStrictEqual(
      scanDelims("_")(scanner),
      DelimiterRun.makeOption({ numdelims: 2, canOpen: false, canClose: true })
    );
    assert.strictEqual(scanner.pos, 5);
  });

  it("does not step backward over an unpaired low surrogate", () => {
    const scanner = scannerFor("a\udc00_a", 2);
    assert.deepStrictEqual(
      scanDelims(scanner, "_"),
      DelimiterRun.makeOption({ numdelims: 1, canOpen: false, canClose: false })
    );
    assert.strictEqual(scanner.pos, 2);
  });
});
